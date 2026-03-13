import React from 'react';
import { Image, View, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

type Props = {
  uri?: string | null;
  size?: number;
  onPress?: () => void;
};

function PersonPlaceholder({ size }: { size: number }) {
  const iconSize = size * 0.65;
  return (
    <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="#94a3b8">
      <Path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </Svg>
  );
}

export default function Avatar({ uri, size = 96, onPress }: Props) {
  const borderRadius = size / 2;

  const inner = (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: '#e2e8f0',
        },
      ]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius }}
          resizeMode="cover"
        />
      ) : (
        <PersonPlaceholder size={size} />
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
        {inner}
      </TouchableOpacity>
    );
  }
  return inner;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
