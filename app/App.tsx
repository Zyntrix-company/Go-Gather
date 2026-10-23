/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect, useRef, useState } from 'react';
import { StatusBar, Linking } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import RootNavigator from './src/navigation/RootNavigator';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Geolocation from '@react-native-community/geolocation';
import Toast from 'react-native-toast-message';
import messaging from '@react-native-firebase/messaging';
import ThemedAlert from './src/components/common/ThemedAlert';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { loadUploadLimits } from './src/utils/uploadLimits';
import useAuthStore from './src/store/authStore';
import usePendingInviteStore, { PendingInvite } from './src/store/pendingInviteStore';
import { applyInstallReferrer } from './src/utils/installReferrer';
import { consumeInFlowConnect } from './src/utils/drivePickerFlow';
import { openInvite } from './src/api/invites.api';
import { actionForOpenResult, failureForOpenError, type OpenInviteAction } from './src/utils/openInvite';

// Configure geolocation to use native Android location provider
Geolocation.setRNConfiguration({ skipPermissionRequests: true, authorizationLevel: 'whenInUse' });

// Invites are approval-based: these open the Requests tab, never the trip/event
// itself — you are not a member until you accept. Trip/event requests also open the
// invite popup (the push carries the request's id as `inviteId`).
const REQUEST_PUSH_TYPES = ['FRIEND_REQUEST', 'TRIP_REQUEST', 'EVENT_REQUEST'];

// Matches https://gatherrgo.com/invite/{type}/{token} (Universal/App Link) and
// gathergo://invite/{type}/{token} (custom-scheme fallback from the web landing page).
function parseInviteUrl(url: string): PendingInvite | null {
  const match = url.match(/^(?:https?:\/\/(?:www\.)?gatherrgo\.com|gathergo:\/\/)\/?invite\/(trip|event|friend)\/([^/?#]+)/i);
  if (!match) return null;
  const [, type, token] = match;
  return { type: type.toLowerCase() as PendingInvite['type'], token };
}

function navigateFromPushData(
  nav: NavigationContainerRef<any> | null,
  data?: Record<string, string>,
  type?: string,
) {
  if (!nav || !data) return;
  if (type && REQUEST_PUSH_TYPES.includes(type)) {
    const previewRequest =
      data.inviteId && (type === 'TRIP_REQUEST' || type === 'EVENT_REQUEST')
        ? { type: type === 'TRIP_REQUEST' ? 'trip' : 'event', id: data.inviteId }
        : undefined;
    nav.navigate('Notifications' as never, { initialTab: 'requests', previewRequest } as never);
  } else if (data.tripId && type !== 'FRIEND_ACCEPTED') {
    nav.navigate('TripDetail' as never, { trip: { id: data.tripId } } as never);
  } else if (data.eventId) {
    nav.navigate('EventDetail' as never, { event: { id: data.eventId } } as never);
  } else if (type === 'FRIEND_ACCEPTED') {
    if (data.fromUserId || data.userId) {
      nav.navigate('FriendProfile' as never, {
        userId: data.fromUserId ?? data.userId,
      } as never);
    }
  }
}

function runOpenInviteAction(nav: NavigationContainerRef<any> | null, action: OpenInviteAction) {
  if (!nav) return;
  // The ref is typed against an unknown param list, so go through a plain (name, params) signature.
  const go = (name: string, params: object) => (nav as { navigate: (n: string, p: object) => void }).navigate(name, params);
  switch (action.kind) {
    case 'requests':
      go('Notifications', { initialTab: 'requests', previewRequest: action.previewRequest });
      break;
    case 'detail':
      go(action.screen, action.screen === 'TripDetail' ? { trip: { id: action.id } } : { event: { id: action.id } });
      break;
    case 'toast':
      Toast.show({ type: action.tone, text1: action.text });
      break;
  }
}

function App() {
  usePushNotifications();
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  // Push-tap navigation: background → foreground (app was suspended)
  useEffect(() => {
    const unsubscribe = messaging().onNotificationOpenedApp((remoteMessage) => {
      navigateFromPushData(
        navigationRef.current,
        remoteMessage.data as Record<string, string> | undefined,
        remoteMessage.data?.type as string | undefined,
      );
    });
    return unsubscribe;
  }, []);

  // Push-tap navigation: cold start (app was killed). The tap is held until the user is
  // signed in and past splash — navigating earlier lands on a navigator that doesn't have
  // the screen yet and silently goes nowhere.
  const [coldStartPush, setColdStartPush] = useState<{ data: Record<string, string>; type?: string } | null>(null);
  useEffect(() => {
    messaging().getInitialNotification().then((remoteMessage) => {
      if (!remoteMessage?.data) return;
      setColdStartPush({
        data: remoteMessage.data as Record<string, string>,
        type: remoteMessage.data.type as string | undefined,
      });
    });
  }, []);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isSplashComplete = useAuthStore((s) => s.isSplashComplete);
  const pendingProfileSetup = useAuthStore((s) => s.pendingProfileSetup);
  const profileComplete = useAuthStore((s) => s.user?.isProfileComplete !== false);
  const appReady = isSplashComplete && isAuthenticated && !pendingProfileSetup && profileComplete;

  useEffect(() => {
    if (!coldStartPush || !appReady) return;
    const timer = setTimeout(() => {
      navigateFromPushData(navigationRef.current, coldStartPush.data, coldStartPush.type);
      setColdStartPush(null);
    }, 400);
    return () => clearTimeout(timer);
  }, [coldStartPush, appReady]);

  useEffect(() => {
    function navigateEmailConnected(url: string) {
      const qs = url.includes('?') ? url.split('?')[1] : '';
      const params = new URLSearchParams(qs);
      // Started from a trip/event/gallery flow: stay there — its watcher opens the picker.
      if (consumeInFlowConnect()) {
        if (params.get('success') !== 'true') {
          Toast.show({ type: 'error', text1: 'Could not connect', text2: 'Please try again.' });
        }
        return;
      }
      navigationRef.current?.navigate('ConnectedEmail' as never, {
        oauthProvider: params.get('provider') ?? undefined,
        oauthSuccess: params.get('success') === 'true',
        oauthError: params.get('error') ?? undefined,
      } as never);
    }
    const handleDeepLink = ({ url }: { url: string }) => {
      if (url.startsWith('gathergo://email-connected')) return navigateEmailConnected(url);
      const invite = parseInviteUrl(url);
      if (invite) usePendingInviteStore.getState().setPendingInvite(invite);
    };
    const subscription = Linking.addEventListener('url', handleDeepLink);
    // Handle cold-start case (app was not running when deep link fired)
    Linking.getInitialURL().then((url) => {
      if (!url) return;
      if (url.startsWith('gathergo://email-connected')) return navigateEmailConnected(url);
      const invite = parseInviteUrl(url);
      if (invite) usePendingInviteStore.getState().setPendingInvite(invite);
    });
    return () => subscription.remove();
  }, []);

  // First launch after a Play Store install: recover the invite the recipient tapped
  // before they had the app.
  useEffect(() => {
    // Restore an invite stashed before a kill first, so a fresh referrer doesn't race it.
    usePendingInviteStore.getState().hydratePendingInvite().then(applyInstallReferrer);
  }, []);

  // Open a pending invite link once the user is authenticated, past splash, and has a
  // complete profile — i.e. once MainStack is actually mounted. Covers "tapped link while
  // logged out, then logged in" and "tapped link while already logged in". The server
  // creates the request; the answer decides where we go (see utils/openInvite.ts).
  const pendingInvite = usePendingInviteStore((s) => s.pendingInvite);
  const openingRef = useRef(false);
  const [openTick, setOpenTick] = useState(0);

  useEffect(() => {
    if (!pendingInvite || !appReady || openingRef.current) return;
    const timer = setTimeout(async () => {
      if (openingRef.current) return;
      openingRef.current = true;
      const invite = pendingInvite;
      // Only a definitive server answer clears the stash — and never a newer link tapped meanwhile.
      const clearIfStillCurrent = () => {
        const current = usePendingInviteStore.getState().pendingInvite;
        if (current && current.token === invite.token && current.type === invite.type) {
          usePendingInviteStore.getState().setPendingInvite(null);
        }
      };
      try {
        const result = await openInvite(invite.token);
        clearIfStillCurrent();
        runOpenInviteAction(navigationRef.current, actionForOpenResult(result));
      } catch (err) {
        const failure = failureForOpenError(err, invite);
        Toast.show({ type: 'error', text1: failure.toast });
        if (!failure.retryable) clearIfStillCurrent();
        // retryable: the invite stays stashed and is tried again on the next app start
      } finally {
        openingRef.current = false;
        const next = usePendingInviteStore.getState().pendingInvite;
        if (next && (next.token !== invite.token || next.type !== invite.type)) setOpenTick((t) => t + 1);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [pendingInvite, appReady, openTick]);

  useEffect(() => {
    // TODO: replace with actual webClientId from Google Cloud console
    try {
      GoogleSignin.configure({
        webClientId: '444293164368-8rjq9b60t2kcbers0d77j4lic7oma5nl.apps.googleusercontent.com',
        iosClientId: '444293164368-v314tg3b5il3bs9as4pnf3k7a1evjat5.apps.googleusercontent.com',
        offlineAccess: false,
        scopes: ['https://www.googleapis.com/auth/user.birthday.read'],
      });
    } catch (e) {
      // noop during scaffold
    }
  }, []);

  useEffect(() => {
    loadUploadLimits();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Owns the native IME insets so the window never auto-resizes for the
          keyboard on any Android version. Every composer/form in the app then
          positions itself from a single continuously-reported keyboard height
          instead of guessing whether the OS already resized the window. */}
      <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
        <SafeAreaProvider>
          <NavigationContainer ref={navigationRef} theme={{ dark: false, colors: { primary: '#0d9488', background: 'transparent', card: 'transparent', text: '#0f172a', border: 'transparent', notification: '#0d9488' }, fonts: { regular: { fontFamily: 'System', fontWeight: '400' }, medium: { fontFamily: 'System', fontWeight: '500' }, bold: { fontFamily: 'System', fontWeight: '700' }, heavy: { fontFamily: 'System', fontWeight: '900' } } }}>
            <StatusBar barStyle="dark-content" />
            <RootNavigator />
            <ThemedAlert />
            <Toast />
          </NavigationContainer>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

export default App;
