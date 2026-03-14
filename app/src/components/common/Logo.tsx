import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

type LogoProps = {
  size?: 'small' | 'default' | 'large';
  iconOnly?: boolean;
};

export function Logo({ size = 'default', iconOnly = false }: LogoProps) {
  const scale = size === 'small' ? 1 : size === 'large' ? 1.6 : 3;
  const iconW = Math.round(40 * scale);
  const iconH = Math.round(36 * scale);
  const textSize = size === 'small' ? 23 : size === 'large' ? 32 : 26;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {/* Briefcase icon via SVG – exactly matches Figma */}
      <Svg width={iconW} height={iconH} viewBox="0 0 56 48" fill="none">
        {/* Handle – inverted U stroke only */}
        <Path
          d="M 22 12 L 22 8 C 22 6.5 23 6 24 6 L 32 6 C 33 6 34 6.5 34 8 L 34 12"
          stroke="#0d9488"
          strokeWidth={4}
          strokeLinecap="round"
          fill="none"
        />
        {/* Body – filled teal rectangle */}
        <Rect x={8} y={13} width={40} height={30} rx={4} fill="#0d9488" />
        {/* White heart */}
        <Path
          d="M 28 24 L 24 20 C 23 19 21 19 20 20 C 19 21 19 23 20 24 L 28 32 L 36 24 C 37 23 37 21 36 20 C 35 19 33 19 32 20 L 28 24 Z"
          fill="white"
        />
      </Svg>

      {!iconOnly && (
        <Text
          style={{
            fontSize: textSize,
            fontWeight: '700',
            color: '#0d9488',
            letterSpacing: -0.1,
          }}>
          GatherGo
        </Text>
      )}
    </View>
  );
}

export default Logo;
