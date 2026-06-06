import React from 'react';
import { Image, View, type ImageStyle, type StyleProp } from 'react-native';
import type { EmailProvider } from '../../api/trips.api';
import { GmailBrandIcon } from './GoogleWorkspaceIcons';

/** Brand assets in app/assets (2026 Google Workspace refresh for Gmail). */
export const EMAIL_PROVIDER_ASSETS = {
  gmail: require('../../../assets/gmail-icon.png'),
  outlook: require('../../../assets/outlook-icon.png'),
} as const;

export function EmailProviderIcon({
  provider,
  size = 22,
  style,
}: {
  provider: EmailProvider;
  size?: number;
  style?: StyleProp<ImageStyle>;
}) {
  if (provider === 'gmail') {
    return (
      <View style={[{ width: size, height: size }, style]} accessibilityLabel={emailProviderLabel(provider)}>
        <GmailBrandIcon size={size} />
      </View>
    );
  }

  return (
    <Image
      source={EMAIL_PROVIDER_ASSETS[provider]}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
      accessibilityLabel={emailProviderLabel(provider)}
    />
  );
}

/** @deprecated Use EmailProviderIcon — kept for named imports. */
export function GmailIcon({ size = 22, style }: { size?: number; style?: StyleProp<ImageStyle> }) {
  return <EmailProviderIcon provider="gmail" size={size} style={style} />;
}

/** @deprecated Use EmailProviderIcon — kept for named imports. */
export function OutlookIcon({ size = 22, style }: { size?: number; style?: StyleProp<ImageStyle> }) {
  return <EmailProviderIcon provider="outlook" size={size} style={style} />;
}

export function emailProviderLabel(provider: EmailProvider): string {
  return provider === 'gmail' ? 'Gmail' : 'Outlook';
}
