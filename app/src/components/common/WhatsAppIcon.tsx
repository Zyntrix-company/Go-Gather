import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

type Props = {
  size?: number;
  style?: ViewStyle;
};

/** Official WhatsApp mark — sourced from app/assets/whatsapp-svgrepo-com.svg */
export default function WhatsAppIcon({ size = 52, style }: Props) {
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }, style]}>
      <Svg width={size} height={size} viewBox="0 0 512 512" accessibilityLabel="WhatsApp">
        <Rect width={512} height={512} rx={256} fill="#25d366" />
        <Path
          fill="#25d366"
          stroke="#ffffff"
          strokeWidth={26}
          d="M123 393l14-65a138 138 0 1150 47z"
        />
        <Path
          fill="#ffffff"
          d="M308 273c-3-2-6-3-9 1l-12 16c-3 2-5 3-9 1-15-8-36-17-54-47-1-4 1-6 3-8l9-14c2-2 1-4 0-6l-12-29c-3-8-6-7-9-7h-8c-2 0-6 1-10 5-22 22-13 53 3 73 3 4 23 40 66 59 32 14 39 12 48 10 11-1 22-10 27-19 1-3 6-16 2-18"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
});
