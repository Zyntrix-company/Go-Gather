import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Platform,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { EmailProvider } from '../../api/trips.api';
import colors from '../../theme/colors';
import { EmailProviderIcon, EMAIL_PROVIDER_ASSETS, emailProviderLabel } from './EmailProviderIcons';
import { DriveBrandIcon } from './GoogleWorkspaceIcons';

const GLASS_TINT: Record<EmailProvider, string> = {
  gmail: 'rgba(234, 67, 53, 0.14)',
  outlook: 'rgba(0, 120, 212, 0.14)',
};

const DRIVE_GLASS_TINT = 'rgba(66, 133, 244, 0.14)';

const BORDER = colors.border;

export const emailProviderStyles = StyleSheet.create({
  connectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: colors.background,
  },
  connectBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: colors.background,
  },
  pickerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  pickerSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  providerRowLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  providerLabelText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  outlineBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: colors.background,
  },
  outlineBtnText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  glassCard: {
    borderRadius: 16,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.72)',
  },
  glassCardBg: {
    ...StyleSheet.absoluteFillObject,
  },
  glassCardBgIcon: {
    position: 'absolute',
    right: -28,
    bottom: -28,
    width: 140,
    height: 140,
    opacity: Platform.OS === 'ios' ? 0.55 : 0.28,
  },
  glassCardFrost: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.42)',
  },
  glassCardContent: {
    padding: 16,
  },
  glassOutlineBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  glassSecondaryBtn: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.75)',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  connectedBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(13, 148, 136, 0.12)',
  },
  connectedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.accent,
  },
});

/** Frosted card with blurred Drive watermark — Connected Services screen. */
export function DriveProviderGlassCard({
  connected,
  children,
}: {
  connected?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={emailProviderStyles.glassCard}>
      <View style={emailProviderStyles.glassCardBg} pointerEvents="none">
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: DRIVE_GLASS_TINT }]} />
        <View style={emailProviderStyles.glassCardBgIcon}>
          <DriveBrandIcon size={140} />
        </View>
        <View style={emailProviderStyles.glassCardFrost} />
      </View>
      <View style={emailProviderStyles.glassCardContent}>
        <View style={emailProviderStyles.providerRowLabel}>
          <DriveBrandIcon size={22} />
          <Text style={emailProviderStyles.providerLabelText}>Google Drive</Text>
        </View>
        {connected ? (
          <View style={emailProviderStyles.connectedBadge}>
            <Text style={emailProviderStyles.connectedBadgeText}>Connected</Text>
          </View>
        ) : null}
        {children}
      </View>
    </View>
  );
}

/** Frosted card with blurred brand watermark — Connect mail screen. */
export function EmailProviderGlassCard({
  provider,
  connected,
  children,
}: {
  provider: EmailProvider;
  connected?: boolean;
  children: React.ReactNode;
}) {
  const blurRadius = Platform.OS === 'ios' ? 28 : 0;
  return (
    <View style={emailProviderStyles.glassCard}>
      <View style={emailProviderStyles.glassCardBg} pointerEvents="none">
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: GLASS_TINT[provider] }]} />
        <Image
          source={EMAIL_PROVIDER_ASSETS[provider]}
          style={emailProviderStyles.glassCardBgIcon}
          resizeMode="contain"
          blurRadius={blurRadius}
        />
        <View style={emailProviderStyles.glassCardFrost} />
      </View>
      <View style={emailProviderStyles.glassCardContent}>
        <EmailProviderCardLabel provider={provider} />
        {connected ? (
          <View style={emailProviderStyles.connectedBadge}>
            <Text style={emailProviderStyles.connectedBadgeText}>Connected</Text>
          </View>
        ) : null}
        {children}
      </View>
    </View>
  );
}

function ChevRight() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
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

export function EmailProviderConnectButton({
  provider,
  connected,
  onPress,
  style,
}: {
  provider: EmailProvider;
  connected: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const label = emailProviderLabel(provider);
  return (
    <TouchableOpacity
      style={[emailProviderStyles.connectBtn, style]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <EmailProviderIcon provider={provider} size={20} />
      <Text style={emailProviderStyles.connectBtnText} numberOfLines={1}>
        {connected ? label : `Connect ${label}`}
      </Text>
    </TouchableOpacity>
  );
}

export function EmailProviderPickerRow({
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
    <TouchableOpacity
      style={emailProviderStyles.pickerRow}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={emailProviderStyles.pickerIconWrap}>
        <EmailProviderIcon provider={provider} size={26} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={emailProviderStyles.pickerTitle}>Import from {label}</Text>
        <Text style={emailProviderStyles.pickerSub}>
          {connected ? 'Connected' : 'Tap to connect'}
        </Text>
      </View>
      <ChevRight />
    </TouchableOpacity>
  );
}

export function EmailImportTitle({
  provider,
}: {
  provider?: EmailProvider;
}) {
  if (!provider) {
    return <Text style={emailProviderStyles.headerTitle}>Import from Email</Text>;
  }
  const label = emailProviderLabel(provider);
  return (
    <View style={emailProviderStyles.headerRow}>
      <EmailProviderIcon provider={provider} size={22} />
      <Text style={emailProviderStyles.headerTitle}>Import from {label}</Text>
    </View>
  );
}

export function EmailProviderCardLabel({ provider }: { provider: EmailProvider }) {
  return (
    <View style={emailProviderStyles.providerRowLabel}>
      <EmailProviderIcon provider={provider} size={22} />
      <Text style={emailProviderStyles.providerLabelText}>{emailProviderLabel(provider)}</Text>
    </View>
  );
}

export function EmailProviderOutlineButton({
  label,
  provider,
  onPress,
  loading,
  disabled,
  variant = 'default',
}: {
  label: string;
  provider?: EmailProvider;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'default' | 'glass';
}) {
  const btnStyle =
    variant === 'glass' ? emailProviderStyles.glassOutlineBtn : emailProviderStyles.outlineBtn;
  return (
    <TouchableOpacity
      style={[btnStyle, disabled && { opacity: 0.6 }]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {provider ? <EmailProviderIcon provider={provider} size={18} /> : null}
          <Text style={emailProviderStyles.outlineBtnText}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
