/**
 * DetailDialogHeader — shared dialog header used in TripDetailScreen modals.
 * Styles match TripDetailScreen's inline DHeader exactly so visual output is unchanged.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface DetailDialogHeaderProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
}

function CloseX() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 6L6 18M6 6l12 12"
        stroke="#64748b"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function DetailDialogHeader({
  title,
  subtitle,
  onClose,
}: DetailDialogHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      <TouchableOpacity
        onPress={onClose}
        style={styles.closeBtn}
        activeOpacity={0.7}
      >
        <CloseX />
      </TouchableOpacity>
    </View>
  );
}

// Styles intentionally match TripDetailScreen's dHeader/dTitle/dSubtitle/dCloseBtn exactly
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
