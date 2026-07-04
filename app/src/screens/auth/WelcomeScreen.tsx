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

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
const DEMO_URL = 'https://www.youtube.com/@GatherrGo';
const HEADLINE_LINES = [
  ['Group', 'Travel,'],
  ['Organized.'],
  ['Finally.'],
] as const;
const SUBTEXT_LINE_ONE_WORDS = ['All', 'your', 'trips,', 'plans,', 'expenses,', 'memories'] as const;
const SUBTEXT_LINE_TWO_WORDS = ['and', 'group', 'chats—in', 'one', 'private', 'space.'] as const;
const ALL_HEADLINE_WORDS = ([] as string[]).concat(...HEADLINE_LINES.map((line) => [...line]));
const ALL_SUBTEXT_WORDS = [...SUBTEXT_LINE_ONE_WORDS, ...SUBTEXT_LINE_TWO_WORDS] as const;

const MOTION = {
  headlineWordDuration: 340,
  headlineWordStagger: 140,
  subtextWordDuration: 220,
  subtextWordStagger: 70,
  ctaDuration: 320,
  ctaDelayAfterSubtext: 80,
} as const;

export default function WelcomeScreen({ navigation }: { navigation: any }) {
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const [animationsReady, setAnimationsReady] = useState(false);

  const headlineAnimations = useRef(
    ALL_HEADLINE_WORDS.map(() => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(8),
    })),
  ).current;

  const subtextAnimations = useRef(
    ALL_SUBTEXT_WORDS.map(() => ({
      opacity: new Animated.Value(0),
      translateX: new Animated.Value(7),
    })),
  ).current;

  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const ctaScale = useRef(new Animated.Value(0.96)).current;

  const onGetStarted = useCallback(() => {
    navigation.navigate('Signup');
  }, [navigation]);

  const onWatchDemo = useCallback(() => {
    Linking.openURL(DEMO_URL).catch(() => {});
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
      MOTION.subtextWordStagger,
      subtextAnimations.map(({ opacity, translateX }) =>
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: MOTION.subtextWordDuration,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(translateX, {
            toValue: 0,
            duration: MOTION.subtextWordDuration,
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
    () => {
      let wordOffset = 0;
      return HEADLINE_LINES.map((line, lineIndex) => {
        const lineWords = line.map((word, wordIndex) => {
          const animationIndex = wordOffset + wordIndex;
          return (
            <Animated.View
              key={`${word}-${animationIndex}`}
              style={{
                opacity: headlineAnimations[animationIndex].opacity,
                transform: [{ translateY: headlineAnimations[animationIndex].translateY }],
              }}>
              <Text style={[styles.headlineWord, word === 'Finally.' ? styles.headlineAccent : null]}>
                {word}
                {wordIndex < line.length - 1 ? ' ' : ''}
              </Text>
            </Animated.View>
          );
        });
        wordOffset += line.length;
        return (
          <View key={`headline-line-${lineIndex}`} style={styles.headlineLine}>
            {lineWords}
          </View>
        );
      });
    },
    [headlineAnimations],
  );

  const subtextLineOneNodes = useMemo(
    () =>
      SUBTEXT_LINE_ONE_WORDS.map((word, index) => (
        <Animated.View
          key={`subtext-line-1-word-${index}`}
          style={{
            opacity: subtextAnimations[index].opacity,
            transform: [{ translateX: subtextAnimations[index].translateX }],
          }}>
          <Text style={styles.subtitleWord}>
            {word}
            {index < SUBTEXT_LINE_ONE_WORDS.length - 1 ? ' ' : ''}
          </Text>
        </Animated.View>
      )),
    [subtextAnimations],
  );

  const subtextLineTwoNodes = useMemo(
    () =>
      SUBTEXT_LINE_TWO_WORDS.map((word, index) => {
        const animationIndex = SUBTEXT_LINE_ONE_WORDS.length + index;
        return (
          <Animated.View
            key={`subtext-line-2-word-${index}`}
            style={{
              opacity: subtextAnimations[animationIndex].opacity,
              transform: [{ translateX: subtextAnimations[animationIndex].translateX }],
            }}>
            <Text style={styles.subtitleWord}>
              {word}
              {index < SUBTEXT_LINE_TWO_WORDS.length - 1 ? ' ' : ''}
            </Text>
          </Animated.View>
        );
      }),
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
            <View style={styles.headlineWrap}>{headlineNodes}</View>

            <View style={styles.subtitleWrap}>
              <View style={styles.subtitleLine}>{subtextLineOneNodes}</View>
              <View style={styles.subtitleLine}>{subtextLineTwoNodes}</View>
            </View>
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
    paddingHorizontal: SCREEN_W < 375 ? 16 : 20,
    paddingTop: SCREEN_H < 700 ? 12 : SCREEN_H < 812 ? 18 : 24,
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
  headlineWrap: {
    gap: 2,
    maxWidth: 540,
  },
  headlineLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  headlineWord: {
    fontSize: SCREEN_W < 375 ? 30 : SCREEN_W >= 768 ? 44 : 36,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: SCREEN_W < 375 ? 38 : SCREEN_W >= 768 ? 52 : 44,
    letterSpacing: -0.5,
  },
  headlineAccent: {
    color: colors.accent,
  },
  subtitleWrap: {
    gap: 4,
    width: '100%',
    alignItems: 'center',
  },
  subtitleLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
  },
  subtitleWord: {
    fontSize: SCREEN_W < 340 ? 13 : SCREEN_W < 375 ? 15 : SCREEN_W < 430 ? 18 : SCREEN_W >= 768 ? 24 : 20,
    color: '#334155',
    lineHeight: SCREEN_W < 340 ? 21 : SCREEN_W < 375 ? 24 : SCREEN_W < 430 ? 28 : SCREEN_W >= 768 ? 34 : 30,
    letterSpacing: -0.2,
  },
  ctaBlock: {
    marginTop: 36,
    gap: 8,
    alignItems: 'center',
    paddingTop: 8,
  },
  primaryBtn: {
    backgroundColor: colors.buttonPrimary,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
    minWidth: 140,
    alignItems: 'center',
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 22,
    elevation: 10,
  },
  primaryBtnText: {
    color: colors.accentForeground,
    fontSize: 15,
    fontWeight: '600',
  },
  demoBtnWrap: {
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  demoBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    textDecorationLine: 'underline',
    textDecorationColor: colors.textPrimary,
  },
});
