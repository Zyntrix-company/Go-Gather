/**
 * DetailStatsBar — horizontal stats bar showing members, docs, photos, expenses.
 * Used in both EventDetailScreen and can be used in TripDetailScreen.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import colors from '../../theme/colors';

interface DetailStatsBarProps {
  memberCount: number;
  docCount: number;
  photoCount: number;
  /** Pre-formatted expense label; hidden when null */
  expenseLabel: string | null;
}

const ICON_COLOR = colors.accent;
const ICON_SIZE = 14;

function MembersIcon() {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
        stroke={ICON_COLOR}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function DocsIcon() {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
        stroke={ICON_COLOR}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14 2v6h6M16 13H8M16 17H8M10 9H8"
        stroke={ICON_COLOR}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function PhotosIcon() {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={3} width={18} height={18} rx={2} stroke={ICON_COLOR} strokeWidth={1.8} />
      <Circle cx={8.5} cy={8.5} r={1.5} stroke={ICON_COLOR} strokeWidth={1.5} />
      <Path
        d="M21 15l-5-5L5 21"
        stroke={ICON_COLOR}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function StatItem({
  icon,
  label,
  shrink,
}: {
  icon?: React.ReactNode;
  label: string;
  shrink?: boolean;
}) {
  return (
    <View style={[styles.statItem, shrink && styles.statItemShrink]}>
      {icon}
      <Text
        style={styles.statText}
        numberOfLines={shrink ? 1 : undefined}
        adjustsFontSizeToFit={shrink}
        minimumFontScale={shrink ? 0.8 : undefined}>
        {label}
      </Text>
    </View>
  );
}

export default function DetailStatsBar({
  memberCount,
  docCount,
  photoCount,
  expenseLabel,
}: DetailStatsBarProps) {
  return (
    <View style={styles.bar}>
      <StatItem
        icon={<MembersIcon />}
        label={`${memberCount} member${memberCount !== 1 ? 's' : ''}`}
      />
      <View style={styles.divider} />
      <StatItem
        icon={<DocsIcon />}
        label={`${docCount} doc${docCount !== 1 ? 's' : ''}`}
      />
      <View style={styles.divider} />
      <StatItem
        icon={<PhotosIcon />}
        label={`${photoCount} media`}
      />
      {expenseLabel != null && (
        <>
          <View style={styles.divider} />
          <StatItem
            label={expenseLabel}
            shrink
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    justifyContent: 'center',
  },
  statItemShrink: {
    flexShrink: 1,
    minWidth: 0,
  },
  statText: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '600',
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: colors.surfaceSecondary,
  },
});
