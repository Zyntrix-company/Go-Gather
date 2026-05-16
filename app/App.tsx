/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect, useRef } from 'react';
import { StatusBar, Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import RootNavigator from './src/navigation/RootNavigator';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Geolocation from '@react-native-community/geolocation';
import Toast from 'react-native-toast-message';
import messaging from '@react-native-firebase/messaging';
import ThemedAlert from './src/components/common/ThemedAlert';
import { usePushNotifications } from './src/hooks/usePushNotifications';

// Configure geolocation to use native Android location provider
Geolocation.setRNConfiguration({ skipPermissionRequests: true, authorizationLevel: 'whenInUse' });

function navigateFromPushData(
  nav: NavigationContainerRef<any> | null,
  data?: Record<string, string>,
  type?: string,
) {
  if (!nav || !data) return;
  if (data.tripId && type !== 'FRIEND_REQUEST' && type !== 'FRIEND_ACCEPTED') {
    nav.navigate('TripDetail' as never, { trip: { id: data.tripId } } as never);
  } else if (data.eventId) {
    nav.navigate('EventDetail' as never, { event: { id: data.eventId } } as never);
  } else if (type === 'FRIEND_REQUEST' || type === 'FRIEND_ACCEPTED') {
    if (data.fromUserId || data.userId) {
      nav.navigate('FriendProfile' as never, {
        userId: data.fromUserId ?? data.userId,
      } as never);
    }
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

  // Push-tap navigation: cold start (app was killed)
  useEffect(() => {
    messaging().getInitialNotification().then((remoteMessage) => {
      if (!remoteMessage) return;
      // Delay until navigator is mounted and ready
      const timer = setTimeout(() => {
        navigateFromPushData(
          navigationRef.current,
          remoteMessage.data as Record<string, string> | undefined,
          remoteMessage.data?.type as string | undefined,
        );
      }, 500);
      return () => clearTimeout(timer);
    });
  }, []);

  useEffect(() => {
    const handleDeepLink = ({ url }: { url: string }) => {
      if (url.startsWith('gathergo://email-connected')) {
        navigationRef.current?.navigate('ConnectedEmail' as never);
      }
    };
    const subscription = Linking.addEventListener('url', handleDeepLink);
    // Handle cold-start case (app was not running when deep link fired)
    Linking.getInitialURL().then((url) => {
      if (url && url.startsWith('gathergo://email-connected')) {
        navigationRef.current?.navigate('ConnectedEmail' as never);
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    // TODO: replace with actual webClientId from Google Cloud console
    try {
      GoogleSignin.configure({
        webClientId: '444293164368-8rjq9b60t2kcbers0d77j4lic7oma5nl.apps.googleusercontent.com',
        iosClientId: '444293164368-62ticnka5jbe7phea60phv6otd69nkbe.apps.googleusercontent.com',
        offlineAccess: false,
        scopes: ['https://www.googleapis.com/auth/user.birthday.read'],
      });
    } catch (e) {
      // noop during scaffold
    }
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef} theme={{ dark: false, colors: { primary: '#0d9488', background: 'transparent', card: 'transparent', text: '#0f172a', border: 'transparent', notification: '#0d9488' }, fonts: { regular: { fontFamily: 'System', fontWeight: '400' }, medium: { fontFamily: 'System', fontWeight: '500' }, bold: { fontFamily: 'System', fontWeight: '700' }, heavy: { fontFamily: 'System', fontWeight: '900' } } }}>
        <StatusBar barStyle="dark-content" />
        <RootNavigator />
        <ThemedAlert />
        <Toast />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;
