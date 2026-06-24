import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Easing,
  StyleSheet,
} from 'react-native';

type Props = {
  text: string;
  voteCount: number;
  pct: number;
  isMyVote: boolean;
  isCompleted: boolean;
  onPress?: () => void;
  disabled?: boolean;
};

export default function PollOptionItem({
  text,
  voteCount,
  pct,
  isMyVote,
  isCompleted,
  onPress,
  disabled,
}: Props) {
  const barAnim = useRef(new Animated.Value(pct)).current;
  const dotScale = useRef(new Animated.Value(isMyVote ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(barAnim, {
      toValue: pct,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    Animated.timing(dotScale, {
      toValue: isMyVote ? 1 : 0,
      duration: 240,
      easing: isMyVote ? Easing.out(Easing.back(1.4)) : Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isMyVote]); // eslint-disable-line react-hooks/exhaustive-deps

  const widthInterpolated = barAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  const inner = (
    <>
      <View style={styles.row}>
        {/* Radio circle — outer ring switches color instantly via conditional style */}
        <View style={styles.radioWrap}>
          <View style={[styles.radioOuter, isMyVote && styles.radioOuterSelected]}>
            {/* Inner white dot — animates scale in/out */}
            <Animated.View style={[styles.radioInner, { transform: [{ scale: dotScale }] }]} />
          </View>
        </View>
        <Text style={[styles.optTxt, isMyVote && styles.optTxtSelected]} numberOfLines={2}>
          {text}
        </Text>
        <Text style={styles.votes}>{voteCount} votes</Text>
      </View>

      {/* Progress bar — always primary teal, width animated */}
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            {
              width: widthInterpolated,
              opacity: isMyVote ? 1 : 0.35,
            },
          ]}
        />
      </View>
    </>
  );

  if (isCompleted || disabled) {
    return <View style={styles.wrap}>{inner}</View>;
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={styles.wrap}>
      {inner}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  radioWrap: {
    marginRight: 8,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: '#0d9488',
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#0d9488',
  },
  optTxt: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
    lineHeight: 18,
  },
  optTxtSelected: {
    color: '#0d9488',
    fontWeight: '600',
  },
  votes: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
    marginLeft: 8,
  },
  track: {
    height: 5,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    overflow: 'hidden',
    marginLeft: 28,
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#0d9488',
  },
});
