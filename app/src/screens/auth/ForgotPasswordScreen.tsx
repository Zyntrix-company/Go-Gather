import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
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

function MailIcon() {
  return (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
      <Path
        stroke="#0d9488"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76"
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
    <BlobBackground>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* Logo top-left */}
          <View style={styles.logoRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <Logo size="small" />
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            {/* Mail icon */}
            <View style={styles.iconWrap}>
              <View style={styles.iconCircle}>
                <MailIcon />
              </View>
            </View>

            <Text style={styles.title}>Forgot Password?</Text>
            <Text style={styles.subtitle}>
              No worries! Enter your registered email and we'll send you a 6-digit reset code.
            </Text>

            {/* Email input */}
            <Text style={styles.fieldLabel}>Email Address</Text>
            <TextInput
              style={[
                styles.input,
                !!error && styles.inputError,
                isFocused && styles.inputFocused,
              ]}
              placeholder="Enter your email"
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

            <Text style={styles.helperText}>
              We'll send a 6-digit OTP to this email. Check your inbox and spam folder.
            </Text>

            {/* Send OTP button */}
            <TouchableOpacity
              style={[styles.primaryBtn, isLoading && { opacity: 0.7 }]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Send Reset Code</Text>
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
      </KeyboardAvoidingView>
    </BlobBackground>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 40,
  },
  logoRow: { marginBottom: 32 },
  form: { maxWidth: 400, width: '100%', alignSelf: 'center' },

  iconWrap: { alignItems: 'center', marginBottom: 20 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ccfbf1',
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    fontSize: 26,
    fontWeight: '500',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: '#566170',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a',
  },
  inputFocused: { borderColor: '#0d9488' },
  inputError: { borderColor: '#ef4444' },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 5,
    marginLeft: 2,
  },
  helperText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 8,
    marginBottom: 20,
    lineHeight: 17,
  },

  primaryBtn: {
    backgroundColor: '#0d9488',
    borderRadius: 9,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 2,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
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
    fontSize: 15,
    color: '#0d9488',
    fontWeight: '500',
  },
});
