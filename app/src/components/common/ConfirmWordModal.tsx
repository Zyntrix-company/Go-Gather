import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import colors from '../../theme/colors';
import AppModal from './AppModal';
import { KeyboardAvoider, KeyboardProvider } from './KeyboardAvoider';

// Same look as ThemedAlert (overlay, card, destructive button), plus a "type the word" field.
const OVERLAY_COLOR = 'rgba(15, 23, 42, 0.48)';
const DESTRUCTIVE_BG = 'rgba(239, 68, 68, 0.07)';
const DESTRUCTIVE_BORDER = 'rgba(239, 68, 68, 0.18)';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  /** The word the user must type, e.g. "DELETE". Matching ignores case and surrounding spaces. */
  word: string;
  confirmLabel: string;
  /** True while the action runs: locks the dialog and shows a spinner on the button. */
  busy?: boolean;
  /** Shown under the field when the action failed. */
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmWordModal({
  visible,
  title,
  message,
  word,
  confirmLabel,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: Props) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);

  // Start empty every time the dialog opens.
  useEffect(() => {
    if (visible) setText('');
  }, [visible]);

  const matches = text.trim().toUpperCase() === word.toUpperCase();
  const canConfirm = matches && !busy;
  const cancel = () => {
    if (!busy) onCancel();
  };

  return (
    <AppModal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={cancel}>
      {/* A RN Modal is its own native window, invisible to the app-root KeyboardProvider
          (App.tsx), so nest one here — same translucency flags as the Modal. */}
      <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
        <KeyboardAvoider style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={cancel} accessibilityLabel="Cancel" />
          <View style={styles.card}>
            <View style={styles.content}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.message}>{message}</Text>

              <Text style={styles.fieldLabel}>
                Type <Text style={styles.word}>{word}</Text> to confirm
              </Text>
              <TextInput
                style={[styles.input, focused && styles.inputFocused]}
                placeholder={word}
                placeholderTextColor="#94a3b8"
                value={text}
                onChangeText={setText}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!busy}
                underlineColorAndroid="transparent"
                selectionColor={colors.accent}
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>

            <View style={styles.actions}>
              <Pressable
                style={({ pressed }) => [styles.btn, styles.btnDestructive, !canConfirm && styles.btnDisabled, pressed && canConfirm && styles.btnPressed]}
                onPress={onConfirm}
                disabled={!canConfirm}
                accessibilityRole="button"
                accessibilityLabel={confirmLabel}>
                {busy ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <Text style={styles.btnTextDestructive}>{confirmLabel}</Text>
                )}
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.btn, styles.btnCancel, pressed && styles.btnPressed]}
                onPress={cancel}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Cancel">
                <Text style={styles.btnTextCancel}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoider>
      </KeyboardProvider>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: OVERLAY_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 10,
  },
  content: {
    paddingTop: 26,
    paddingHorizontal: 22,
    paddingBottom: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginTop: 18,
    marginBottom: 7,
    letterSpacing: 0.1,
  },
  word: { color: colors.error, fontWeight: '700' },
  input: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
  },
  inputFocused: { borderColor: colors.accent },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: 8,
    marginLeft: 2,
  },
  actions: {
    marginTop: 18,
    flexDirection: 'column',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    minHeight: 46,
    paddingVertical: 13,
  },
  btnDestructive: {
    backgroundColor: DESTRUCTIVE_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DESTRUCTIVE_BORDER,
  },
  btnCancel: { backgroundColor: colors.surfaceSecondary },
  btnPressed: { opacity: 0.88 },
  btnDisabled: { opacity: 0.45 },
  btnTextDestructive: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
    color: colors.error,
  },
  btnTextCancel: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.1,
    color: colors.textPrimary,
  },
});
