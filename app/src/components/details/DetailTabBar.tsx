/**
 * DetailTabBar — shared tab bar used inside detail screen modals.
 * Underline style matching TripDetailScreen and EventDetailScreen members sheets.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, typeStyle } from '../../theme';

interface DetailTabBarProps {
  tabs: string[];
  active: string;
  onSelect: (tab: string) => void;
}

export default function DetailTabBar({ tabs, active, onSelect }: DetailTabBarProps) {
  return (
    <View style={styles.container}>
      {tabs.map(t => (
        <TouchableOpacity
          key={t}
          style={[styles.tab, active === t && styles.tabActive]}
          onPress={() => onSelect(t)}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, active === t && styles.tabTextActive]}>
            {t}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tab: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
  },
  tabText: {
    ...typeStyle('label'),
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
});
