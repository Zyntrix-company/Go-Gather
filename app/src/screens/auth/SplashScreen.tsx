import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import Logo from '../../components/common/Logo';
import BlobBackground from '../../components/common/BlobBackground';
import useAuth from '../../hooks/useAuth';
import useAuthStore from '../../store/authStore';
import colors from '../../theme/colors';

export default function SplashScreen({ navigation }: any) {
  const { loadFromToken } = useAuth();
  const setPendingProfileSetup = useAuthStore((s) => s.setPendingProfileSetup);

  useEffect(() => {
    async function init() {
      try {
        // Wait for both the user profile to load AND at least 4 seconds
        const [user] = await Promise.all([
          loadFromToken(),
          new Promise<void>(resolve => setTimeout(resolve, 3000)),
        ]);

        if (!user) {
          // No valid token at all → go to Login
          return navigation.replace('Login');
        }

        // Token is valid — route based on profile status
        if (user.isVerified === false) {
          // User registered but hasn't verified email yet
          return navigation.replace('OtpVerification', { email: user.email ?? '' });
        }

        if (user.isProfileComplete === false) {
          // Verified but hasn't completed profile setup
          setPendingProfileSetup(true);
          return; // RootNavigator switches to ProfileSetupNavigator automatically
        }

        // Fully onboarded — RootNavigator will show HomeScreen automatically
        return navigation.replace('Login');
      } catch {
        navigation.replace('Login');
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <BlobBackground>
      <View style={styles.content}>
        <View style={styles.logoWrap}>
          <Logo size="large" />
        </View>

        <Text style={styles.tagline}>Your adventures, perfectly planned</Text>

        <ActivityIndicator size="large" color={colors.accent} style={styles.loader} />
      </View>
    </BlobBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 10,
  },
  logoWrap: {
    marginBottom: 28,
  },
  tagline: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 18,
    fontWeight: '400',
    marginBottom: 37,
    letterSpacing: 0.1,
  },
  loader: {
    marginTop: 4,
  },
});
