import React, { useEffect, useRef, useMemo } from 'react';
import { View, Image, StyleSheet, Animated, Easing, useWindowDimensions, Platform, PermissionsAndroid } from 'react-native';
import BlobBackground from '../../components/common/BlobBackground';
import useAuth from '../../hooks/useAuth';
import useAuthStore from '../../store/authStore';

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
  const { width: screenW } = useWindowDimensions();

  const ICON_SIZE   = Math.round(Math.min(Math.max(screenW * 0.09, 32), 56));
  const WORDMARK_H  = ICON_SIZE;
  const WORDMARK_W  = Math.round(ICON_SIZE * 4.5);
  const GAP         = Math.round(screenW * 0.03);
  const ICON_SHIFT_X = -((GAP + WORDMARK_W) / 2);
  const BRAND_LEFT   = -(ICON_SIZE / 2) + ICON_SHIFT_X + ICON_SIZE + GAP;

  // ── Animated values ───────────────────────────────────────────────────
  // logoY starts at 0 so the icon is statically visible while permissions are requested.
  // It is reset to -180 just before the animation begins (imperceptible — single frame).
  const logoY           = useRef(new Animated.Value(0)).current;
  const logoX           = useRef(new Animated.Value(0)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkX       = useRef(new Animated.Value(-ICON_SHIFT_X)).current;

  // ── Styles (recalculate when screen size changes) ─────────────────────
  const dynStyles = useMemo(() => StyleSheet.create({
    iconWrap: {
      position: 'absolute',
      top:  -(ICON_SIZE / 2),
      left: -(ICON_SIZE / 2),
    },
    icon: { width: ICON_SIZE, height: ICON_SIZE },
    wordmarkWrap: {
      position: 'absolute',
      top:  -(WORDMARK_H / 2),
      left: BRAND_LEFT,
    },
    wordmark: { width: WORDMARK_W, height: WORDMARK_H },
  }), [ICON_SIZE, WORDMARK_H, WORDMARK_W, BRAND_LEFT]);

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
      if (!authUser) return navigation.replace('Login');
      if (authUser.isVerified === false) {
        return navigation.replace('OtpVerification', { email: authUser.email ?? '' });
      }
      if (authUser.isProfileComplete === false) {
        setPendingProfileSetup(true);
        return;
      }
      navigation.replace('Login');
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
      logoY.setValue(-180);

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
          Zero-size anchor at screen center.
          All pieces absolutely positioned relative to this point.
          Both icon and wordmark share the same `top` formula → same axis.
        */}
        <View style={styles.anchor}>
          <Animated.View
            style={[dynStyles.iconWrap, {
              transform: [{ translateY: logoY }, { translateX: logoX }],
            }]}
          >
            <Image
              source={require('../../../assets/icon_only.png')}
              style={dynStyles.icon}
              resizeMode="contain"
            />
          </Animated.View>

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
        </View>
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
  anchor: {
    width: 0,
    height: 0,
  },
});
