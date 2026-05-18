import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { EmailProvider } from '../../api/trips.api';
import colors from '../../theme/colors';
import { EmailProviderIcon, emailProviderLabel } from './EmailProviderIcons';

type EmailConnectionStatus = {
  gmail: { connected: boolean };
  outlook: { connected: boolean };
};

function UploadIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"
        stroke="#fff"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ChevRight() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 18l6-6-6-6"
        stroke={colors.textMuted}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function EmailImportRow({
  provider,
  connected,
  onPress,
}: {
  provider: EmailProvider;
  connected: boolean;
  onPress: () => void;
}) {
  const label = emailProviderLabel(provider);
  return (
    <TouchableOpacity style={styles.importRow} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.importIconWrap}>
        <EmailProviderIcon provider={provider} size={26} />
      </View>
      <View style={styles.importTextCol}>
        <Text style={styles.importTitle}>{label}</Text>
        <Text style={styles.importSub}>
          {connected ? 'Connected · tap to import' : `Connect ${label} to import`}
        </Text>
      </View>
      <ChevRight />
    </TouchableOpacity>
  );
}

/**
 * Upload actions for trip/event Documents modals — phone upload + Gmail/Outlook import rows.
 */
export default function DocumentsUploadSection({
  onUploadPhone,
  emailStatus,
  onGmail,
  onOutlook,
}: {
  onUploadPhone: () => void;
  emailStatus: EmailConnectionStatus;
  onGmail: () => void;
  onOutlook: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.phoneBtn} onPress={onUploadPhone} activeOpacity={0.85}>
        <UploadIcon />
        <Text style={styles.phoneBtnText}>Upload from device</Text>
      </TouchableOpacity>

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>Import from email</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.importList}>
        <EmailImportRow
          provider="gmail"
          connected={emailStatus.gmail.connected}
          onPress={onGmail}
        />
        <EmailImportRow
          provider="outlook"
          connected={emailStatus.outlook.connected}
          onPress={onOutlook}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
  },
  phoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 13,
  },
  phoneBtnText: {
    color: colors.accentForeground,
    fontSize: 14,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  importList: {
    gap: 10,
  },
  importRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    gap: 12,
  },
  importIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importTextCol: {
    flex: 1,
    minWidth: 0,
  },
  importTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  importSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
});
