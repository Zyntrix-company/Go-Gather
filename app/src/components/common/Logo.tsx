import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { s } from '../../utils/responsive';

type LogoProps = {
  size?: 'small' | 'default' | 'large';
};

const SIZE_MAP = {
  small:   { w: s(120), h: s(48)  },
  default: { w: s(160), h: s(64)  },
  large:   { w: s(200), h: s(80)  },
};

export function Logo({ size = 'default' }: LogoProps) {
  const { w, h } = SIZE_MAP[size];
  return (
    <Image
      source={require('../../../assets/Complete Logo Teal w_o BG.png')}
      style={[styles.logo, { width: w, height: h }]}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  logo: {},
});

export default Logo;
