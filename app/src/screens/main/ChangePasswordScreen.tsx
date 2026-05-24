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
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import BlobBackground from '../../components/common/BlobBackground';
import colors from '../../theme/colors';
import authApi from '../../api/auth.api';
import { changePasswordSchema } from '../../utils/validators';
import { showAlert } from '../../store/alertStore';

function BackArrow() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 12H5M12 19l-7-7 7-7"
        stroke={colors.textPrimary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

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

type FieldKey = 'currentPassword' | 'password' | 'confirmPassword';

function PasswordField({
  label,
  value,
  onChangeText,
  error,
  show,
  onToggleShow,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
  show: boolean;
  onToggleShow: () => void;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.passwordWrap, focused && styles.inputFocused, !!error && styles.inputError]}>
        <TextInput
          style={styles.passwordInput}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!show}
          placeholderTextColor="#94a3b8"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity onPress={onToggleShow} activeOpacity={0.7} style={styles.eyeBtn}>
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </TouchableOpacity>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export default function ChangePasswordScreen({ navigation }: { navigation: any }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [isLoading, setIsLoading] = useState(false);

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
      showAlert({
        title: 'Password updated',
        message: 'Your password has been changed successfully.',
        buttons: [{ text: 'OK', onPress: () => navigation.goBack() }],
      });
    } catch (e: any) {
      const message = e?.response?.data?.message || e?.message || 'Could not change password';
      showAlert({ title: 'Error', message });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <BlobBackground>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8} style={styles.backBtn}>
                <BackArrow />
              </TouchableOpacity>
              <View>
                <Text style={styles.title}>Change password</Text>
                <Text style={styles.subtitle}>Enter your current password, then choose a new one</Text>
              </View>
            </View>

            <PasswordField
              label="Current password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              error={errors.currentPassword}
              show={showCurrent}
              onToggleShow={() => setShowCurrent((v) => !v)}
            />
            <PasswordField
              label="New password"
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              show={showNew}
              onToggleShow={() => setShowNew((v) => !v)}
            />
            <PasswordField
              label="Confirm new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              error={errors.confirmPassword}
              show={showConfirm}
              onToggleShow={() => setShowConfirm((v) => !v)}
            />

            <TouchableOpacity
              style={[styles.primaryBtn, isLoading && styles.primaryBtnDisabled]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Update password</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </BlobBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    marginBottom: 24,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  title: { fontSize: 18, fontWeight: '500', color: colors.textPrimary, marginBottom: 2 },
  subtitle: { fontSize: 12, color: colors.textSecondary, lineHeight: 16 },
  fieldWrap: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 14,
  },
  inputFocused: { borderColor: colors.accent },
  inputError: { borderColor: '#ef4444' },
  passwordInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: 14,
  },
  eyeBtn: { padding: 4, marginLeft: 4 },
  errorText: { fontSize: 12, color: '#ef4444', marginTop: 6 },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
