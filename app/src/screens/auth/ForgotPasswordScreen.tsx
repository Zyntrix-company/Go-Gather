import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { KeyboardAvoider } from '../../components/common/KeyboardAvoider';
import Svg, { Path } from 'react-native-svg';
import Logo from '../../components/common/Logo';
import BlobBackground from '../../components/common/BlobBackground';
import authApi from '../../api/auth.api';

function ChevronLeft() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        stroke="#0d9488"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 18l-6-6 6-6"
      />
    </Svg>
  );
}


export default function ForgotPasswordScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  function validate(value: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  async function handleSubmit() {
    setError('');
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    if (!validate(email)) {
      setError('Please enter a valid email address');
      return;
    }
    setIsLoading(true);
    try {
      await authApi.forgotPassword(email.trim().toLowerCase());
      // Navigate to the OTP + new password screen
      navigation.navigate('ResetPassword', { email: email.trim().toLowerCase() });
    } catch {
      // Global interceptor shows error toast
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <BlobBackground>
        <KeyboardAvoider style={styles.kav}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>

          {/* Logo top-left */}
          <View style={styles.logoRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <Logo size="default" />
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <Text style={styles.title}>Forgot Password?</Text>
            <Text style={styles.subtitle}>
              No worries! We will send you reset instructions.
            </Text>

            {/* Email input */}
            <TextInput
              style={[
                styles.input,
                !!error && styles.inputError,
                isFocused && styles.inputFocused,
              ]}
              placeholder="Email"
              placeholderTextColor="#94a3b8"
              value={email}
              onChangeText={(t) => { setEmail(t); setError(''); }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
              underlineColorAndroid="transparent"
              selectionColor="#0d9488"
            />
            {!!error && <Text style={styles.errorText}>{error}</Text>}


            {/* Send OTP button */}
            <TouchableOpacity
              style={[styles.primaryBtn, isLoading && { opacity: 0.7 }]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Reset Password</Text>
              )}
            </TouchableOpacity>

            {/* Back to Login */}
            <TouchableOpacity
              style={styles.backRow}
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.7}>
              <ChevronLeft />
              <Text style={styles.backText}>Back to Login</Text>
            </TouchableOpacity>
          </View>
          </ScrollView>
        </KeyboardAvoider>
      </BlobBackground>
    </SafeAreaView>
  );
}

const SCREEN_W = Dimensions.get('window').width;

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  kav: { flex: 1 },
  // Layout mirrors LoginScreen/SignupScreen: same horizontal padding, same top
  // offset, logo pinned at the top with a fixed gap before the form.
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SCREEN_W < 375 ? 16 : 24,
    paddingTop: SCREEN_W < 375 ? 12 : 16,
    paddingBottom: SCREEN_W < 375 ? 24 : 32,
  },
  logoRow: { marginBottom: 58, alignItems: 'flex-start' },
  form: { maxWidth: 400, width: '100%', alignSelf: 'center' },

  title: {
    fontSize: SCREEN_W < 375 ? 21 : 25,
    fontWeight: '400',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: SCREEN_W < 375 ? 13 : 15,
    color: '#505c6dff',
    textAlign: 'center',
    lineHeight: SCREEN_W < 375 ? 18 : 20,
    marginBottom: 36,
  },

  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontSize: SCREEN_W < 375 ? 14 : 16,
    color: '#0f172a',
    marginTop: 8,
  },
  inputFocused: { borderColor: '#0d9488' },
  inputError: { borderColor: '#ef4444' },
  errorText: {
    fontSize: 11,
    color: '#ef4444',
    marginTop: 4,
    marginBottom: 2,
    marginLeft: 2,
  },
  helperText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 10,
    marginBottom: 20,
    lineHeight: 17,
  },

  primaryBtn: {
    backgroundColor: '#0d9488',
    borderRadius: 9,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
    elevation: 2,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: SCREEN_W < 375 ? 15 : 17,
    fontWeight: '400',
    letterSpacing: 0.1,
  },

  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  backText: {
    fontSize: SCREEN_W < 375 ? 13 : 15,
    color: '#0d9488',
    fontWeight: '500',
  },
});
