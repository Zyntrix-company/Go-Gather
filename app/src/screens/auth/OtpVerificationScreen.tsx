import React, { useState, useRef, useEffect } from 'react';
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
import Toast from 'react-native-toast-message';
import Logo from '../../components/common/Logo';
import BlobBackground from '../../components/common/BlobBackground';
import useAuth from '../../hooks/useAuth';
import useAuthStore from '../../store/authStore';

export default function OtpVerificationScreen({ navigation, route }: any) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputs = useRef<Array<TextInput | null>>([]);
  const [timer, setTimer] = useState(30);

  const { verifyOtp, resendOtp } = useAuth();
  const isLoading = useAuthStore((s) => s.isLoading);
  const setPendingProfileSetup = useAuthStore((s) => s.setPendingProfileSetup);
  const email = route.params?.email ?? 'your email';
  const source = route.params?.source;

  // ─── Countdown timer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  // ─── OTP input handlers ───────────────────────────────────────────────────
  const handleChange = (text: string, index: number) => {
    // Only accept digits
    const digit = text.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  // ─── Verify OTP ───────────────────────────────────────────────────────────
  const handleVerify = async () => {
    const otpValue = otp.join('');
    if (otpValue.length !== 6) {
      Toast.show({ type: 'error', text1: 'Incomplete OTP', text2: 'Please enter all 6 digits.' });
      return;
    }

    try {
      const res = await verifyOtp(email, otpValue);
      // After signup, or when profile is incomplete, show CreateProfile before Main
      if (source === 'signup' || res.user?.isProfileComplete === false) {
        setPendingProfileSetup(true);
        // RootNavigator will switch to ProfileSetupNavigator automatically
      }
      // If profile is complete, RootNavigator switches to MainStack automatically
    } catch {
      // Global Axios interceptor already shows an error toast.
      // Reset OTP fields so user can try again.
      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    }
  };

  // ─── Resend OTP ───────────────────────────────────────────────────────────
  const handleResend = async () => {
    try {
      await resendOtp(email, 'email-verification');
      setTimer(30);
    } catch {
      // Global interceptor handles error toast
    }
  };

  return (
    <BlobBackground>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          <View style={styles.logoRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <Logo size="small" />
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <Text style={styles.title}>Account Verification</Text>
            <Text style={styles.subtitle}>
              Please enter the 6-digit code sent to{'\n'}
              <Text style={styles.emailHighlight}>{email}</Text>
            </Text>

            {/* OTP Inputs */}
            <View style={styles.otpContainer}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => { inputs.current[index] = ref; }}
                  style={[
                    styles.otpInput,
                    digit !== '' && styles.otpInputFilled,
                  ]}
                  value={digit}
                  onChangeText={(text) => handleChange(text, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  keyboardType="numeric"
                  maxLength={1}
                  textAlign="center"
                  selectionColor="#0d9488"
                  editable={!isLoading}
                />
              ))}
            </View>

            {/* Verify button */}
            <TouchableOpacity
              style={[styles.primaryBtn, isLoading && { opacity: 0.7 }]}
              onPress={handleVerify}
              activeOpacity={0.85}
              disabled={isLoading}>
              {isLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>Verify OTP</Text>}
            </TouchableOpacity>

            {/* Resend */}
            <View style={styles.resendRow}>
              <Text style={styles.resendLabel}>Didn't receive code? </Text>
              {timer > 0 ? (
                <Text style={styles.timerText}>Resend in {timer}s</Text>
              ) : (
                <TouchableOpacity onPress={handleResend} activeOpacity={0.7}>
                  <Text style={styles.resendLink}>Resend now</Text>
                </TouchableOpacity>
              )}
            </View>
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
    paddingTop: 16,
    paddingBottom: 32,
  },
  logoRow: { marginBottom: 60 },
  form: { maxWidth: 400, width: '100%', alignSelf: 'center' },
  title: {
    fontSize: 27,
    fontWeight: '400',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#566170ff',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  emailHighlight: {
    color: '#0d9488',
    fontWeight: '600',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    gap: 8,
  },
  otpInput: {
    width: 45,
    height: 52,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    fontSize: 22,
    fontWeight: '600',
    color: '#0f172a',
  },
  otpInputFilled: {
    borderColor: '#0d9488',
  },
  primaryBtn: {
    backgroundColor: '#0d9488',
    borderRadius: 9,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    elevation: 2,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '400',
    letterSpacing: 0.1,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  resendLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  timerText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  resendLink: {
    fontSize: 14,
    color: '#0d9488',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
