import React from 'react';
import { Image } from 'react-native';

type LogoProps = {
  size?: 'small' | 'default' | 'large';
  iconOnly?: boolean;
};

export function Logo({ size = 'default', iconOnly = false }: LogoProps) {
  if (iconOnly) {
    const iconSize = size === 'small' ? 36 : size === 'large' ? 56 : 44;
    return (
      <Image
        source={require('../../../assets/icon_only.png')}
        style={{ width: iconSize, height: iconSize }}
        resizeMode="contain"
      />
    );
  }

  const width = size === 'small' ? 120 : size === 'large' ? 240 : 180;
  const height = Math.round(width * 0.4);

  return (
    <Image
      source={require('../../../assets/Complete Logo Teal w_o BG.png')}
      style={{ width, height }}
      resizeMode="contain"
    />
  );
}

export default Logo;
