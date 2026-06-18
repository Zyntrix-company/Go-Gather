import React from 'react';
import { Image, View, type ImageStyle, type StyleProp } from 'react-native';
import type { EmailProvider } from '../../api/trips.api';
import { GmailBrandIcon } from './GoogleWorkspaceIcons';

/** Brand assets for decorative backgrounds (e.g. glass cards). */
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
    <View
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityLabel={emailProviderLabel(provider)}
    >
      <Image
        source={EMAIL_PROVIDER_ASSETS.outlook}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    </View>
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
