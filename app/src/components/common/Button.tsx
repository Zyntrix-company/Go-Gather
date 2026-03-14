import React from 'react';
import {
  Pressable,
  Text,
  PressableProps,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';

type Variant = 'primary' | 'outline' | 'ghost';

type Props = PressableProps & {
  title: string;
  variant?: Variant;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

export default function Button({ title, variant = 'primary', style, textStyle, ...rest }: Props) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'outline' && styles.outline,
        variant === 'ghost' && styles.ghost,
        pressed && styles.pressed,
        style,
      ]}
      {...rest}>
      <Text
        style={[
          styles.text,
          variant === 'primary' && styles.textPrimary,
          variant === 'outline' && styles.textOutline,
          variant === 'ghost' && styles.textGhost,
          textStyle,
        ]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: '#0d9488',
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  outline: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  pressed: {
    opacity: 0.82,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  textPrimary: { color: '#ffffff' },
  textOutline: { color: '#334155' },
  textGhost: { color: '#0d9488' },
});
