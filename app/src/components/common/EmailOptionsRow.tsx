import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { EmailProviderIcon } from './EmailProviderIcons';
import colors from '../../theme/colors';

type Props = {
  onGmail?: () => void;
  onOutlook?: () => void;
  gmailImporting?: boolean;
  outlookImporting?: boolean;
  disabled?: boolean;
  /** Transparent (outlined) cards instead of the default filled grey. */
  transparent?: boolean;
};

export default function EmailOptionsRow({
  onGmail,
  onOutlook,
  gmailImporting = false,
  outlookImporting = false,
  disabled = false,
  transparent = false,
}: Props) {
  const busy = disabled;
  const btnStyle = [styles.btn, transparent && styles.btnTransparent];

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[btnStyle, (busy || gmailImporting) && styles.btnDisabled]}
        onPress={onGmail}
        disabled={busy || gmailImporting}
        activeOpacity={0.85}
      >
        {gmailImporting ? (
          <ActivityIndicator color={colors.accent} size="small" />
        ) : (
          <EmailProviderIcon provider="gmail" size={28} />
        )}
        <Text style={styles.btnLabel}>Gmail</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[btnStyle, (busy || outlookImporting) && styles.btnDisabled]}
        onPress={onOutlook}
        disabled={busy || outlookImporting}
        activeOpacity={0.85}
      >
        {outlookImporting ? (
          <ActivityIndicator color={colors.accent} size="small" />
        ) : (
          <EmailProviderIcon provider="outlook" size={28} />
        )}
        <Text style={styles.btnLabel}>Outlook</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 72,
  },
  btnTransparent: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#334155',
    textAlign: 'center',
  },
});
