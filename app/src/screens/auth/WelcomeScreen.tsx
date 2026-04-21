import React, { useCallback } from 'react';
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
} from 'react-native';
import BlobBackground from '../../components/common/BlobBackground';
import Logo from '../../components/common/Logo';
import colors from '../../theme/colors';
import { setAuthWelcomeSeen } from '../../utils/authWelcomeStorage';

const SCREEN_W = Dimensions.get('window').width;
const DEMO_URL = 'https://www.youtube.com/@GatherrGo';

export default function WelcomeScreen({ navigation }: { navigation: any }) {
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
            <Text style={styles.headline}>
              Group Travel,{'\n'}
              Organized.{'\n'}
              <Text style={styles.headlineAccent}>Finally.</Text>
            </Text>

            <Text style={styles.subtitle}>
              All your trip plans, expenses, memories, and group chats—in one private space.
            </Text>
          </View>

          <View style={styles.ctaBlock}>
            <TouchableOpacity
              style={styles.primaryBtn}
              activeOpacity={0.85}
              onPress={onGetStarted}>
              <Text style={styles.primaryBtnText}>Get Started</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onWatchDemo} activeOpacity={0.7} style={styles.demoBtnWrap}>
              <Text style={styles.demoBtnText}>Watch Demo</Text>
            </TouchableOpacity>
          </View>
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
  headlineAccent: {
    color: colors.accent,
  },
  subtitle: {
    fontSize: SCREEN_W < 375 ? 17 : 19,
    color: '#334155',
    lineHeight: SCREEN_W < 375 ? 26 : 30,
    maxWidth: 520,
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
