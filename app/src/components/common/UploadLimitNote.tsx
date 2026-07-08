import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

function InfoIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke="#94a3b8" strokeWidth={2} />
      <Path d="M12 16v-4M12 8h.01" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/** Small centered info line shown below upload options — matches MediaActionBar's disclaimer. */
export default function UploadLimitNote({ text }: { text: string }) {
  return (
    <View style={styles.infoRow}>
      <InfoIcon />
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  infoText: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 15,
    textAlign: 'center',
  },
});
