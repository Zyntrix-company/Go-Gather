/**
 * DetailActionGrid — 3×2 grid of action buttons (Docs, Members, Photos, Expenses, Polls, Notes).
 * Both EventDetailScreen and TripDetailScreen use this layout.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import colors from '../../theme/colors';

export interface ActionButton {
  key: string;
  label: string;
  /** Background color for the button tile */
  backgroundColor: string;
  icon: React.ReactNode;
  count: number;
  onPress: () => void;
}

interface DetailActionGridProps {
  buttons: ActionButton[];
}

export default function DetailActionGrid({ buttons }: DetailActionGridProps) {
  return (
    <View style={styles.grid}>
      {buttons.map(btn => (
        <TouchableOpacity
          key={btn.key}
          style={[styles.btn, { backgroundColor: btn.backgroundColor }]}
          onPress={btn.onPress}
          activeOpacity={0.8}
        >
          <View style={styles.iconWrap}>{btn.icon}</View>
          <Text style={styles.label}>{btn.label}</Text>
          {btn.count > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{btn.count}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    marginHorizontal: 16,
    marginBottom: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  btn: {
    width: '30.5%',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    position: 'relative',
  },
  iconWrap: {},
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.accent,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: '700',
  },
});
