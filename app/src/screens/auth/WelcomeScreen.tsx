import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Dimensions,
  Linking,
  Platform,
  Animated,
  Easing,
  AccessibilityInfo,
} from 'react-native';
import BlobBackground from '../../components/common/BlobBackground';
import Logo from '../../components/common/Logo';
import colors from '../../theme/colors';
import { setAuthWelcomeSeen } from '../../utils/authWelcomeStorage';

const SCREEN_W = Dimensions.get('window').width;
const DEMO_URL = 'https://www.youtube.com/@GatherrGo';
const HEADLINE_WORDS = ['Group', 'Travel.', 'Organized.', 'Finally.'] as const;
const SUBTEXT = 'All your trips, plans, expenses, memories... in one place.';

const MOTION = {
  headlineWordDuration: 420,
  headlineWordStagger: 180,
  subtextCharDuration: 220,
  subtextCharStagger: 22,
  ctaDuration: 420,
  ctaDelayAfterSubtext: 120,
} as const;

export default function WelcomeScreen({ navigation }: { navigation: any }) {
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const [animationsReady, setAnimationsReady] = useState(false);

  const headlineAnimations = useRef(
    HEADLINE_WORDS.map(() => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(8),
    })),
  ).current;

  const subtextAnimations = useRef(
    Array.from(SUBTEXT).map(() => ({
      opacity: new Animated.Value(0),
      translateX: new Animated.Value(7),
    })),
  ).current;

  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const ctaScale = useRef(new Animated.Value(0.96)).current;

  const onGetStarted = useCallback(() => {
    void (async () => {
      await setAuthWelcomeSeen();
      navigation.navigate('Signup');
    })();
  }, [navigation]);

  const onWatchDemo = useCallback(() => {
    void (async () => {
      await setAuthWelcomeSeen();
      Linking.openURL(DEMO_URL).catch(() => {});
    })();
  }, []);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) {
          setReduceMotionEnabled(enabled);
          setAnimationsReady(true);
        }
      })
      .catch(() => {
        if (mounted) setAnimationsReady(true);
      });

    const motionSubscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        setReduceMotionEnabled(enabled);
      },
    );

    return () => {
      mounted = false;
      motionSubscription?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (!animationsReady) return;

    if (reduceMotionEnabled) {
      headlineAnimations.forEach(({ opacity, translateY }) => {
        opacity.setValue(1);
        translateY.setValue(0);
      });
      subtextAnimations.forEach(({ opacity, translateX }) => {
        opacity.setValue(1);
        translateX.setValue(0);
      });
      ctaOpacity.setValue(1);
      ctaScale.setValue(1);
      return;
    }

    headlineAnimations.forEach(({ opacity, translateY }) => {
      opacity.setValue(0);
      translateY.setValue(8);
    });
    subtextAnimations.forEach(({ opacity, translateX }) => {
      opacity.setValue(0);
      translateX.setValue(7);
    });
    ctaOpacity.setValue(0);
    ctaScale.setValue(0.96);

    const headlineSequence = Animated.stagger(
      MOTION.headlineWordStagger,
      headlineAnimations.map(({ opacity, translateY }) =>
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: MOTION.headlineWordDuration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: MOTION.headlineWordDuration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ),
    );

    const subtextSequence = Animated.stagger(
      MOTION.subtextCharStagger,
      subtextAnimations.map(({ opacity, translateX }) =>
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: MOTION.subtextCharDuration,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(translateX, {
            toValue: 0,
            duration: MOTION.subtextCharDuration,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ),
    );

    const ctaSequence = Animated.sequence([
      Animated.delay(MOTION.ctaDelayAfterSubtext),
      Animated.parallel([
        Animated.timing(ctaOpacity, {
          toValue: 1,
          duration: MOTION.ctaDuration,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(ctaScale, {
          toValue: 1,
          speed: 18,
          bounciness: 2,
          useNativeDriver: true,
        }),
      ]),
    ]);

    const timeline = Animated.sequence([headlineSequence, subtextSequence, ctaSequence]);
    timeline.start();

    return () => {
      timeline.stop();
    };
  }, [
    animationsReady,
    reduceMotionEnabled,
    headlineAnimations,
    subtextAnimations,
    ctaOpacity,
    ctaScale,
  ]);

  const headlineNodes = useMemo(
    () =>
      HEADLINE_WORDS.map((word, index) => (
        <Animated.Text
          key={`${word}-${index}`}
          style={[
            styles.headlineWord,
            word === 'Finally.' ? styles.headlineAccent : null,
            {
              opacity: headlineAnimations[index].opacity,
              transform: [{ translateY: headlineAnimations[index].translateY }],
            },
          ]}>
          {word}
          {index < HEADLINE_WORDS.length - 1 ? ' ' : ''}
        </Animated.Text>
      )),
    [headlineAnimations],
  );

  const subtextNodes = useMemo(
    () =>
      Array.from(SUBTEXT).map((char, index) => (
        <Animated.Text
          key={`subtext-char-${index}`}
          style={[
            styles.subtitleChar,
            {
              opacity: subtextAnimations[index].opacity,
              transform: [{ translateX: subtextAnimations[index].translateX }],
            },
          ]}>
          {char}
        </Animated.Text>
      )),
    [subtextAnimations],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <BlobBackground>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}>
          <View style={styles.logoRow}>
            <Logo size="default" />
          </View>

          <View style={styles.hero}>
            <Text style={styles.headline}>{headlineNodes}</Text>

            <Text style={styles.subtitle}>{subtextNodes}</Text>
          </View>

          <Animated.View
            style={[
              styles.ctaBlock,
              {
                opacity: ctaOpacity,
                transform: [{ scale: ctaScale }],
              },
            ]}>
            <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={onGetStarted}>
              <Text style={styles.primaryBtnText}>Get Started</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onWatchDemo} activeOpacity={0.7} style={styles.demoBtnWrap}>
              <Text style={styles.demoBtnText}>Watch Demo</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </BlobBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Match other auth screens (Login, etc.): BlobBackground provides the gradient fill
  safeArea: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SCREEN_W < 375 ? 20 : 24,
    paddingTop: SCREEN_W < 375 ? 8 : 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 24,
    maxWidth: 672,
    width: '100%',
    alignSelf: 'center',
  },
  logoRow: {
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  hero: {
    paddingTop: 8,
    gap: 36,
  },
  headline: {
    fontSize: SCREEN_W < 375 ? 30 : SCREEN_W >= 768 ? 44 : 36,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: SCREEN_W < 375 ? 38 : SCREEN_W >= 768 ? 52 : 44,
    letterSpacing: -0.5,
  },
  headlineWord: {
    color: colors.textPrimary,
  },
  headlineAccent: {
    color: colors.accent,
  },
  subtitle: {
    fontSize: SCREEN_W < 375 ? 17 : 19,
    color: '#334155',
    lineHeight: SCREEN_W < 375 ? 26 : 30,
    maxWidth: 520,
  },
  subtitleChar: {
    color: '#334155',
  },
  ctaBlock: {
    marginTop: 36,
    gap: 16,
    alignItems: 'center',
    paddingTop: 8,
  },
  primaryBtn: {
    backgroundColor: colors.buttonPrimary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 999,
    minWidth: 200,
    alignItems: 'center',
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryBtnText: {
    color: colors.accentForeground,
    fontSize: 16,
    fontWeight: '600',
  },
  demoBtnWrap: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  demoBtnText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
    textDecorationLine: 'underline',
    textDecorationColor: colors.textPrimary,
  },
});
