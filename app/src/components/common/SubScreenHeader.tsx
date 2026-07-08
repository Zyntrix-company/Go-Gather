import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type TextStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { typeStyle } from '../../theme';

function BackArrow() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 12H5M12 5l-7 7 7 7"
        stroke="#0d9488"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

type SubScreenHeaderProps = {
  title: string;
  onBack: () => void;
  /** Optional per-screen override (e.g. lighter weight) — leaves other screens unaffected. */
  titleStyle?: TextStyle;
};

export default function SubScreenHeader({ title, onBack, titleStyle }: SubScreenHeaderProps) {
  return (
    <View style={s.header}>
      <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.7}>
        <BackArrow />
      </TouchableOpacity>
      <Text style={[s.title, titleStyle]} numberOfLines={1}>{title}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 2,
    paddingBottom: 6,
    backgroundColor: 'transparent',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    ...typeStyle('navTitle'),
    color: '#0f172a',
    textAlign: 'left',
  },
});
