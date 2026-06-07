import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import AppScreenLayout, { TAB_BAR_SCROLL_PADDING } from '../../components/common/AppScreenLayout';
import authApi from '../../api/auth.api';
import { changePasswordSchema } from '../../utils/validators';
import useAuthStore from '../../store/authStore';

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
    <Svg width={52} height={52} viewBox="0 0 24 24" fill="none">
      <Path stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <Path stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        d="M22 4L12 14.01l-3-3" />
    </Svg>
  );
}

function LockIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z"
        stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      />
      <Path
        d="M7 11V7a5 5 0 0110 0v4"
        stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      />
      <Circle cx={12} cy={16} r={1} fill="#0d9488" />
    </Svg>
  );
}

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'Uppercase letter (A–Z)', ok: /[A-Z]/.test(password) },
    { label: 'Lowercase letter (a–z)', ok: /[a-z]/.test(password) },
    { label: 'Number (0–9)', ok: /[0-9]/.test(password) },
    { label: 'Special character (!@#$%)', ok: /[^A-Za-z0-9]/.test(password) },
  ];
  if (!password) return null;
  return (
    <View style={pwStyles.container}>
      {checks.map((c, i) => (
        <View key={i} style={pwStyles.row}>
          <Text style={[pwStyles.bullet, c.ok && pwStyles.bulletOk]}>
            {c.ok ? '✓' : '○'}
          </Text>
          <Text style={[pwStyles.label, c.ok && pwStyles.labelOk]}>{c.label}</Text>
        </View>
      ))}
    </View>
  );
}

const pwStyles = StyleSheet.create({
  container: { marginTop: 8, marginBottom: 4, paddingHorizontal: 2 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  bullet: { fontSize: 13, color: '#94a3b8', width: 20 },
  bulletOk: { color: '#0d9488' },
  label: { fontSize: 12, color: '#94a3b8', lineHeight: 18 },
  labelOk: { color: '#0d9488' },
});

type FieldKey = 'currentPassword' | 'password' | 'confirmPassword';

export default function ChangePasswordScreen({ navigation }: { navigation: any }) {
  const userEmail = useAuthStore((s) => s.user?.email ?? '');

  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);

  function clearError(key: FieldKey) {
    setErrors((e) => ({ ...e, [key]: '' }));
  }

  async function handleSubmit() {
    setErrors({});
    const parsed = changePasswordSchema.safeParse({ currentPassword, password, confirmPassword });
    if (!parsed.success) {
      const next: Partial<Record<FieldKey, string>> = {};
      parsed.error.issues.forEach((issue) => {
        const key = issue.path[0] as FieldKey;
        if (key && !next[key]) next[key] = issue.message;
      });
      setErrors(next);
      return;
    }

    setIsLoading(true);
    try {
      await authApi.changePassword(currentPassword, password);
      setIsDone(true);
    } catch (e: any) {
      const message = e?.response?.data?.message || e?.message || 'Could not change password';
      if (message.toLowerCase().includes('current password')) {
        setErrors({ currentPassword: message });
      } else {
        setErrors({ password: message });
      }
    } finally {
      setIsLoading(false);
    }
  }

  if (isDone) {
    return (
      <AppScreenLayout navigation={navigation}>
        <View style={styles.centered}>
          <View style={styles.successCircle}>
            <CheckCircleIcon />
          </View>
          <Text style={styles.successTitle}>Password Updated!</Text>
          <Text style={styles.successSubtitle}>
            Your password has been changed successfully.{'\n'}
            Use your new password the next time you sign in.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Back to Settings</Text>
          </TouchableOpacity>
        </View>
      </AppScreenLayout>
    );
  }

  return (
    <AppScreenLayout navigation={navigation} title="Change Password">
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: TAB_BAR_SCROLL_PADDING }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          <View style={styles.form}>
            <View style={styles.iconBadge}>
              <LockIcon />
            </View>

            <Text style={styles.subtitle}>
              Enter your current password, then choose a new one
            </Text>
            {userEmail ? (
              <Text style={styles.emailText}>{userEmail}</Text>
            ) : null}

            <Text style={styles.fieldLabel}>Current Password</Text>
            <View style={[
              styles.passwordWrap,
              focusedField === 'current' && styles.inputFocused,
              errors.currentPassword && styles.inputError,
            ]}>
              <TextInput
                style={styles.passwordField}
                placeholder="Enter current password"
                placeholderTextColor="#94a3b8"
                value={currentPassword}
                onChangeText={(t) => { setCurrentPassword(t); clearError('currentPassword'); }}
                onFocus={() => setFocusedField('current')}
                onBlur={() => setFocusedField(null)}
                secureTextEntry={!showCurrent}
                underlineColorAndroid="transparent"
                selectionColor="#0d9488"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowCurrent(!showCurrent)}
                activeOpacity={0.7}>
                {showCurrent ? <EyeOffIcon /> : <EyeIcon />}
              </TouchableOpacity>
            </View>
            {errors.currentPassword ? <Text style={styles.errorText}>{errors.currentPassword}</Text> : null}

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>New Password</Text>
              <View style={styles.dividerLine} />
            </View>

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
                onChangeText={(t) => { setPassword(t); clearError('password'); }}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                secureTextEntry={!showPassword}
                underlineColorAndroid="transparent"
                selectionColor="#0d9488"
                autoCapitalize="none"
                autoCorrect={false}
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

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Confirm Password</Text>
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
                onChangeText={(t) => { setConfirmPassword(t); clearError('confirmPassword'); }}
                onFocus={() => setFocusedField('confirm')}
                onBlur={() => setFocusedField(null)}
                secureTextEntry={!showConfirm}
                underlineColorAndroid="transparent"
                selectionColor="#0d9488"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowConfirm(!showConfirm)}
                activeOpacity={0.7}>
                {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
              </TouchableOpacity>
            </View>
            {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryBtn, isLoading && { opacity: 0.7 }]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={isLoading}>
              {isLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>Update Password</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}>
              <Text style={styles.backBtnText}>← Back to Settings</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreenLayout>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 48,
  },
  form: { maxWidth: 400, width: '100%', alignSelf: 'center' },

  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f0fdfa',
    borderWidth: 1.5,
    borderColor: '#99f6e4',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 18,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 10,
  },
  emailText: {
    fontSize: 14,
    color: '#0d9488',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 28,
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 22,
    gap: 10,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e2e8f0' },
  dividerText: { fontSize: 12, color: '#94a3b8', fontWeight: '500', letterSpacing: 0.3 },

  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 7,
    letterSpacing: 0.1,
  },
  passwordWrap: {
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputFocused: { borderColor: '#0d9488', backgroundColor: 'transparent' },
  inputError: { borderColor: '#ef4444', backgroundColor: 'transparent' },
  passwordField: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    paddingRight: 44,
    fontSize: 15,
    color: '#0f172a',
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 5,
    marginBottom: 2,
    marginLeft: 2,
  },

  primaryBtn: {
    backgroundColor: '#0d9488',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  backBtn: {
    alignItems: 'center',
    marginTop: 18,
    paddingVertical: 4,
  },
  backBtnText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '400',
  },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0fdfa',
    borderWidth: 2,
    borderColor: '#99f6e4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  successSubtitle: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 36,
  },
});
