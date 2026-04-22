import React, { useEffect, useRef, useMemo } from 'react';
import { View, Image, StyleSheet, Animated, Easing, useWindowDimensions, Platform, PermissionsAndroid } from 'react-native';
import BlobBackground from '../../components/common/BlobBackground';
import useAuth from '../../hooks/useAuth';
import useAuthStore from '../../store/authStore';
import { getAuthWelcomeSeen } from '../../utils/authWelcomeStorage';

// Request permissions sequentially — must resolve before animation starts.
// Android only; iOS permissions are handled contextually by the OS.
async function requestPermissions() {
  if (Platform.OS !== 'android') return;
  try {
    await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
  } catch {
    // Silently ignore — permissions can be requested contextually later
  }
}

type Props = {
  navigation: any;
  onFinish?: () => void;
};

export default function SplashScreen({ navigation, onFinish }: Props) {
  const { loadFromToken } = useAuth();
  const setPendingProfileSetup = useAuthStore((s) => s.setPendingProfileSetup);

  // ── Responsive sizes ──────────────────────────────────────────────────
  const { width: screenW, height: screenH } = useWindowDimensions();

  // Base icon size on screen height so it scales correctly on short screens.
  // Min 40 so it never looks tiny on compact devices (e.g. iPhone SE).
  const ICON_SIZE   = Math.round(Math.min(Math.max(screenH * 0.065, 40), 64));
  const WORDMARK_H  = ICON_SIZE;
  const WORDMARK_W  = Math.round(ICON_SIZE * 4.5);
  const GAP          = Math.round(screenW * 0.03);
  const ICON_SHIFT_X = -((GAP + WORDMARK_W) / 2);
  // Drop distance: 27% of screen height keeps the icon above the fold on all sizes.
  const DROP_OFFSET  = Math.round(screenH * 0.27);

  // ── Animated values ───────────────────────────────────────────────────
  // logoY starts at 0 so the icon is statically visible while permissions are requested.
  // It is reset to -180 just before the animation begins (imperceptible — single frame).
  const logoY           = useRef(new Animated.Value(0)).current;
  const logoX           = useRef(new Animated.Value(0)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkX       = useRef(new Animated.Value(-ICON_SHIFT_X)).current;

  // ── Styles (recalculate when screen size changes) ─────────────────────
  const dynStyles = useMemo(() => StyleSheet.create({
    icon: { width: ICON_SIZE, height: ICON_SIZE },
    // Wordmark is absolutely positioned to the right of the icon.
    // alignItems:'center' on the row handles vertical centering — no top math needed.
    wordmarkWrap: {
      position: 'absolute',
      left: ICON_SIZE + GAP,
      // Stretch to icon height then center the image inside — matches icon mid-line
      // regardless of internal whitespace in the wordmark asset.
      top: 0,
      bottom: 0,
      justifyContent: 'center',
      marginTop: Math.round(ICON_SIZE * 0.09),
    },
    wordmark: { width: WORDMARK_W, height: WORDMARK_H, marginTop: Math.round(ICON_SIZE * 0.07) },
  }), [ICON_SIZE, WORDMARK_H, WORDMARK_W, GAP]);

  // ── Sequenced: permissions → animation → navigate ─────────────────────
  useEffect(() => {
    let resolved = false;
    let authUser: any = undefined;
    let authDone = false;
    let animDone = false;
    let animTimer: ReturnType<typeof setTimeout> | null = null;

    function tryNavigate() {
      if (!authDone || !animDone || resolved) return;
      resolved = true;
      onFinish?.();

      // If RootNavigator already sees isAuthenticated = true (token was preserved
      // despite a network error during getMe), let it render MainStack automatically —
      // no explicit navigation needed.
      const { isAuthenticated } = useAuthStore.getState();
      if (isAuthenticated) {
        if (authUser?.isVerified === false) {
          return navigation.replace('OtpVerification', { email: authUser.email ?? '' });
        }
        if (authUser?.isProfileComplete === false) {
          setPendingProfileSetup(true);
        }
        // RootNavigator handles the rest — MainStack or ProfileSetupNavigator.
        return;
      }

      // No valid token: first launch → welcome marketing; thereafter → login (home path is authenticated above)
      void (async () => {
        const welcomeSeen = await getAuthWelcomeSeen();
        navigation.replace(welcomeSeen ? 'Login' : 'Welcome');
      })();
    }

    // Auth check runs immediately in parallel — result is held until animation finishes.
    loadFromToken()
      .then((user) => { authUser = user; authDone = true; tryNavigate(); })
      .catch(() => { authDone = true; tryNavigate(); });

    (async () => {
      // Phase 1 — Static logo on screen while permission dialogs are shown.
      // The user sees the logo at center; no animation runs.
      await requestPermissions();

      // Phase 2 — All dialogs resolved. Reset icon above screen then spring-drop.
      // setValue is synchronous so this is imperceptible (< 1 frame).
      logoY.setValue(-DROP_OFFSET);

      Animated.spring(logoY, {
        toValue: 0,
        tension: 60,
        friction: 4,
        useNativeDriver: true,
      }).start();

      // Phase 3 — After 1.5 s, slide icon + wordmark left together, wordmark fades in.
      Animated.sequence([
        Animated.delay(1500),
        Animated.parallel([
          Animated.timing(logoX, {
            toValue: ICON_SHIFT_X,
            duration: 700,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(wordmarkX, {
            toValue: 0,
            duration: 700,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(wordmarkOpacity, {
            toValue: 1,
            duration: 700,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      // Phase 4 — Hold for full animation duration then navigate.
      animTimer = setTimeout(() => { animDone = true; tryNavigate(); }, 4500);
    })();

    return () => { if (animTimer) clearTimeout(animTimer); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <BlobBackground>
      <View style={styles.screen}>
        {/*
          Flex-row container centred on screen.
          alignItems:'center' lets flexbox vertically align the icon and
          wordmark on the same axis regardless of image asset padding — the
          old zero-anchor/absolute-top approach depended on both assets
          having identical bounding-box padding, which they don't.

          The wordmark is position:'absolute' so it doesn't affect the row
          width while it's invisible (icon stays centred on screen alone).
          Horizontal animations (logoX, wordmarkX) are unchanged.
        */}
        <Animated.View
          style={[
            styles.logoRow,
            { transform: [{ translateY: logoY }, { translateX: logoX }] },
          ]}
        >
          <Image
            source={require('../../../assets/icon_only.png')}
            style={dynStyles.icon}
            resizeMode="contain"
          />
          <Animated.View
            style={[dynStyles.wordmarkWrap, {
              opacity: wordmarkOpacity,
              transform: [{ translateX: wordmarkX }],
            }]}
          >
            <Image
              source={require('../../../assets/Wordmark.png')}
              style={dynStyles.wordmark}
              resizeMode="contain"
            />
          </Animated.View>
        </Animated.View>
      </View>
    </BlobBackground>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Row that holds the icon (in flow) + wordmark (absolute).
  // alignItems:'center' is the key — it vertically centres both children
  // on the same axis without relying on image-asset bounding-box maths.
  logoRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
});
