import React, { useEffect, useRef, useMemo, useState } from 'react';
import { View, Image, StyleSheet, Animated, Easing, useWindowDimensions, Platform, PermissionsAndroid } from 'react-native';
import Video from 'react-native-video';
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
  const setSplashComplete = useAuthStore((s) => s.setSplashComplete);

  // ── Responsive sizes ──────────────────────────────────────────────────
  const { width: screenW, height: screenH } = useWindowDimensions();

  // Base icon size on screen height so it scales correctly on short screens.
  // Slightly conservative scale + cap so wordmark reads refined, not oversized.
  const ICON_SIZE   = Math.round(Math.min(Math.max(screenH * 0.056, 38), 56));
  const WORDMARK_H  = ICON_SIZE;
  const WORDMARK_W  = Math.round(ICON_SIZE * 4.05);
  const GAP          = Math.round(screenW * 0.03);
  // Lift the vertically-centred logo above dead-centre. Padding at the bottom
  // shrinks the centring area, so the content rises by ~half this value.
  // Height-relative → consistent nudge across all screen sizes.
  const LIFT_UP      = Math.round(screenH * 0.14);
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

  // ── Splash chime ──────────────────────────────────────────────────────
  // The asset is 3.6 s but only the first 3 s is wanted, so the cut happens at
  // playback time (no transcoded copy to keep in sync with the original).
  //
  // The Video is mounted from the first render but held paused, so the decoder
  // is warm by the time the drop begins. Mounting it at drop time instead would
  // put source loading between the spring starting and the first audible
  // sample, and the chime would trail the icon.
  const [chimePaused, setChimePaused] = useState(true);
  // Ramped to 0 over the last 300 ms — an abrupt stop mid-waveform clicks.
  const [chimeVolume, setChimeVolume] = useState(1);

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
    const chimeTimers: ReturnType<typeof setTimeout>[] = [];
    let fadeInterval: ReturnType<typeof setInterval> | null = null;

    function tryNavigate() {
      if (!authDone || !animDone || resolved) return;
      resolved = true;
      setSplashComplete(true);
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

      // No valid token: always go to Welcome.
      navigation.replace('Welcome');
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

      // Chime is unpaused on the same tick the spring is started, so the first
      // audible sample lines up with the icon leaving the top of the screen.
      // Cut at 3.0 s: fade from 2.7 s, then pause. Navigation at 3.5 s leaves
      // 500 ms of headroom so the sound never clips against the transition.
      setChimePaused(false);
      chimeTimers.push(setTimeout(() => {
        const FADE_MS = 300;
        const STEP_MS = 50;
        let elapsed = 0;
        fadeInterval = setInterval(() => {
          elapsed += STEP_MS;
          setChimeVolume(Math.max(0, 1 - elapsed / FADE_MS));
          if (elapsed >= FADE_MS && fadeInterval) {
            clearInterval(fadeInterval);
            fadeInterval = null;
          }
        }, STEP_MS);
      }, 2700));
      chimeTimers.push(setTimeout(() => setChimePaused(true), 3000));

      Animated.spring(logoY, {
        toValue: 0,
        tension: 60,
        friction: 4,
        useNativeDriver: true,
      }).start();

      // Phase 3 — After 1.5 s, slide icon + wordmark left together, wordmark fades in.
      Animated.sequence([
        Animated.delay(1200),
        Animated.parallel([
          Animated.timing(logoX, {
            toValue: ICON_SHIFT_X,
            duration: 500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(wordmarkX, {
            toValue: 0,
            duration: 500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(wordmarkOpacity, {
            toValue: 1,
            duration: 500,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      // Phase 4 — Hold for full animation duration then navigate.
      animTimer = setTimeout(() => { animDone = true; tryNavigate(); }, 3500);
    })();

    return () => {
      if (animTimer) clearTimeout(animTimer);
      if (fadeInterval) clearInterval(fadeInterval);
      chimeTimers.forEach(clearTimeout);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <BlobBackground>
      <View style={[styles.screen, { paddingBottom: LIFT_UP }]}>
        {/*
          Audio-only playback. v6 dropped the `audioOnly` prop, so the standard
          approach is a zero-size Video — the sound plays with nothing rendered.
          ignoreSilentSwitch="inherit" respects the iOS ringer switch; a splash
          chime that overrides a silenced phone is not a good first impression.
        */}
        <Video
          source={require('../../../assets/sounds/splash.mp3')}
          style={styles.chime}
          volume={chimeVolume}
          paused={chimePaused}
          repeat={false}
          ignoreSilentSwitch="inherit"
          disableFocus
          playInBackground={false}
          onError={() => { /* Chime is decorative — never block the splash */ }}
        />
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
  // Zero-size + absolute so the audio-only Video never affects layout.
  chime: { position: 'absolute', width: 0, height: 0, opacity: 0 },
});
