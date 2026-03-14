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
import Svg, { Path } from 'react-native-svg';
import Logo from '../../components/common/Logo';
import BlobBackground from '../../components/common/BlobBackground';
import authApi from '../../api/auth.api';
import Toast from 'react-native-toast-message';

// ─── Icons ────────────────────────────────────────────────────────────────────
function EyeIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <Path stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        d="M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" />
    </Svg>
  );
}

function EyeOffIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <Path stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        d="M1 1l22 22" />
    </Svg>
  );
}

function CheckCircleIcon() {
  return (
    <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
      <Path stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <Path stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        d="M22 4L12 14.01l-3-3" />
    </Svg>
  );
}

// ─── Password strength indicator ─────────────────────────────────────────────
function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'Uppercase letter (A-Z)', ok: /[A-Z]/.test(password) },
    { label: 'Lowercase letter (a-z)', ok: /[a-z]/.test(password) },
    { label: 'Number (0-9)', ok: /[0-9]/.test(password) },
    { label: 'Special character (!@#$%)', ok: /[^A-Za-z0-9]/.test(password) },
  ];
  if (!password) return null;
  return (
    <View style={pwStrengthStyles.container}>
      {checks.map((c, i) => (
        <View key={i} style={pwStrengthStyles.row}>
          <Text style={[pwStrengthStyles.bullet, c.ok && pwStrengthStyles.bulletOk]}>
            {c.ok ? '✓' : '○'}
          </Text>
          <Text style={[pwStrengthStyles.label, c.ok && pwStrengthStyles.labelOk]}>{c.label}</Text>
        </View>
      ))}
    </View>
  );
}

const pwStrengthStyles = StyleSheet.create({
  container: { marginTop: 8, marginBottom: 4, paddingHorizontal: 4 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  bullet: { fontSize: 13, color: '#94a3b8', width: 18 },
  bulletOk: { color: '#0d9488' },
  label: { fontSize: 12, color: '#94a3b8' },
  labelOk: { color: '#0d9488' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ResetPasswordScreen({ navigation, route }: any) {
  const email: string = route.params?.email ?? '';

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputs = useRef<Array<TextInput | null>>([]);
  const [timer, setTimer] = useState(60);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // ─── Countdown ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (timer <= 0) return;
    const t = setInterval(() => setTimer((p) => p - 1), 1000);
    return () => clearInterval(t);
  }, [timer]);

  // ─── OTP input ──────────────────────────────────────────────────────────
  const handleOtpChange = (text: string, index: number) => {
    const digit = text.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    if (digit && index < 5) inputs.current[index + 1]?.focus();
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  // ─── Resend OTP ─────────────────────────────────────────────────────────
  async function handleResend() {
    try {
      await authApi.resendOtp({ email, purpose: 'forgot-password' });
      setTimer(60);
      Toast.show({ type: 'success', text1: 'OTP Sent', text2: 'A new code was sent to your email.' });
    } catch {
      // toast handled globally
    }
  }

  // ─── Validate ────────────────────────────────────────────────────────────
  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    const otpValue = otp.join('');

    if (otpValue.length !== 6) {
      newErrors.otp = 'Please enter all 6 digits';
    }
    if (!password) {
      newErrors.password = 'New password is required';
    } else {
      if (password.length < 8) newErrors.password = 'Password must be at least 8 characters';
      else if (!/[A-Z]/.test(password)) newErrors.password = 'Must contain an uppercase letter';
      else if (!/[a-z]/.test(password)) newErrors.password = 'Must contain a lowercase letter';
      else if (!/[0-9]/.test(password)) newErrors.password = 'Must contain a number';
      else if (!/[^A-Za-z0-9]/.test(password)) newErrors.password = 'Must contain a special character';
    }
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords don't match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // ─── Submit ─────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!validate()) return;
    const otpValue = otp.join('');
    setIsLoading(true);
    try {
      await authApi.resetPassword(email, otpValue, password);
      setIsDone(true);
    } catch {
      // toast handled globally
      // Reset OTP so user can retry
      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  }

  // ─── Success State ───────────────────────────────────────────────────────
  if (isDone) {
    return (
      <BlobBackground>
        <View style={styles.centered}>
          <View style={styles.successCircle}>
            <CheckCircleIcon />
          </View>
          <Text style={styles.successTitle}>Password Reset!</Text>
          <Text style={styles.successSubtitle}>
            Your password has been updated successfully.{'\n'}
            You can now log in with your new password.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn1}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </BlobBackground>
    );
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

          {/* Logo */}
          <View style={styles.logoRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <Logo size="small" />
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              Enter the 6-digit code sent to{'\n'}
              <Text style={styles.emailHighlight}>{email}</Text>
            </Text>

            {/* ── OTP Row ── */}
            <View style={styles.otpContainer}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => { inputs.current[index] = ref; }}
                  style={[
                    styles.otpInput,
                    digit !== '' && styles.otpInputFilled,
                    errors.otp && styles.otpInputError,
                  ]}
                  value={digit}
                  onChangeText={(t) => { handleOtpChange(t, index); setErrors((e) => ({ ...e, otp: '' })); }}
                  onKeyPress={(e) => handleOtpKeyPress(e, index)}
                  keyboardType="numeric"
                  maxLength={1}
                  textAlign="center"
                  selectionColor="#0d9488"
                  editable={!isLoading}
                />
              ))}
            </View>
            {errors.otp ? <Text style={styles.errorText}>{errors.otp}</Text> : null}

            {/* ── Resend ── */}
            <View style={styles.resendRow}>
              <Text style={styles.resendLabel}>Didn't receive code? </Text>
              {timer > 0 ? (
                <Text style={styles.timerText}>Resend in {timer}s</Text>
              ) : (
                <TouchableOpacity onPress={handleResend} activeOpacity={0.7}>
                  <Text style={styles.resendLink}>Resend OTP</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* ── Divider ── */}
            <View style={styles.divider} />

            {/* ── New Password ── */}
            <Text style={styles.fieldLabel}>New Password</Text>
            <View style={[
              styles.passwordWrap,
              focusedField === 'password' && styles.inputFocused,
              errors.password && styles.inputError,
            ]}>
              <TextInput
                style={styles.passwordField}
                placeholder="Enter new password"
                placeholderTextColor="#94a3b8"
                value={password}
                onChangeText={(t) => { setPassword(t); setErrors((e) => ({ ...e, password: '' })); }}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                secureTextEntry={!showPassword}
                underlineColorAndroid="transparent"
                selectionColor="#0d9488"
                editable={!isLoading}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.7}>
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </TouchableOpacity>
            </View>
            {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
            <PasswordStrength password={password} />

            {/* ── Confirm Password ── */}
            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Confirm Password</Text>
            <View style={[
              styles.passwordWrap,
              focusedField === 'confirm' && styles.inputFocused,
              errors.confirmPassword && styles.inputError,
            ]}>
              <TextInput
                style={styles.passwordField}
                placeholder="Re-enter new password"
                placeholderTextColor="#94a3b8"
                value={confirmPassword}
                onChangeText={(t) => { setConfirmPassword(t); setErrors((e) => ({ ...e, confirmPassword: '' })); }}
                onFocus={() => setFocusedField('confirm')}
                onBlur={() => setFocusedField(null)}
                secureTextEntry={!showConfirm}
                underlineColorAndroid="transparent"
                selectionColor="#0d9488"
                editable={!isLoading}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowConfirm(!showConfirm)}
                activeOpacity={0.7}>
                {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
              </TouchableOpacity>
            </View>
            {errors.confirmPassword
              ? <Text style={styles.errorText}>{errors.confirmPassword}</Text>
              : null}

            {/* ── Submit ── */}
            <TouchableOpacity
              style={[styles.primaryBtn, isLoading && { opacity: 0.7 }]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={isLoading}>
              {isLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>Set New Password</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.7}>
              <Text style={styles.backBtnText}>← Back to Login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </BlobBackground>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  kav: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  logoRow: { marginBottom: 52 },
  form: { maxWidth: 400, width: '100%', alignSelf: 'center' },

  title: {
    fontSize: 27,
    fontWeight: '400',
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
  emailHighlight: {
    color: '#0d9488',
    fontWeight: '600',
  },

  // ── OTP ──
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  otpInput: {
    flex: 1,
    height: 52,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    fontSize: 22,
    fontWeight: '600',
    color: '#0f172a',
    maxWidth: 48,
  },
  otpInputFilled: { borderColor: '#0d9488' },
  otpInputError: { borderColor: '#ef4444' },

  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  resendLabel: { fontSize: 13, color: '#64748b' },
  timerText: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
  resendLink: { fontSize: 13, color: '#0d9488', fontWeight: '600', textDecorationLine: 'underline' },

  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 20 },

  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },

  // ── Password inputs ──
  passwordWrap: {
    position: 'relative',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 9,
    backgroundColor: '#ffffff',
  },
  inputFocused: { borderColor: '#0d9488' },
  inputError: { borderColor: '#ef4444' },
  passwordField: {
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingRight: 46,
    fontSize: 16,
    color: '#0f172a',
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },

  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
    marginBottom: 2,
    marginLeft: 2,
  },
  primaryBtn1: {
    backgroundColor: '#0d9488',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 22,
    elevation: 2,
  },

  primaryBtn: {
    backgroundColor: '#0d9488',
    borderRadius: 11,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 24,
    elevation: 2,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  backBtn: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 4,
  },
  backBtnText: {
    fontSize: 14,
    color: '#0d9488',
    fontWeight: '500',
  },

  // ── Success state ──
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#ccfbf1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
});
