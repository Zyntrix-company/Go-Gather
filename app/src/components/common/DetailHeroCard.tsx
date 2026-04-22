/**
 * DetailHeroCard — shared hero card for Trip & Event detail screens.
 *
 * Gradient card (mint/cyan) matching TripDetailScreen style:
 *   - Optional type badge (top-left)
 *   - Name (bold), date line, location text (left column)
 *   - Days counter + edit pencil button (right column)
 *   - Stats row inside the card: members | docs | photos | ₹expenses
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { PencilIcon } from './Icons';
import StackedAvatars from './StackedAvatars';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DetailHeroCardProps {
  name: string;
  /** e.g. "15 Apr 2026" or "May 15 - May 20" */
  dateLine: string;
  location: string;
  dayCount: number;
  /** e.g. "Days to go" | "Today!" | "Days ago" */
  dayLabel: string;
  memberCount: number;
  memberAvatars?: { id: string; uri: string }[];
  docCount: number;
  photoCount: number;
  totalExpenses: number;
  /** Optional tag badge text (e.g. event type) */
  typeBadge?: string;
  /** Background color for the type badge pill */
  typeBadgeColor?: string;
  onEdit?: () => void;
  /** Gradient colors — defaults to trip-style mint/cyan */
  gradientColors?: [string, string, ...string[]];
}

// ─── Stat Icon Helpers ───────────────────────────────────────────────────────

function MembersIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z" stroke="#009788" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="#009788" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function DocsIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#009788" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 2v6h6" stroke="#009788" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function PhotosIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={3} width={18} height={18} rx={2} stroke="#009788" strokeWidth={2} />
      <Circle cx={8.5} cy={8.5} r={1.5} fill="#009788" />
      <Path d="M21 15l-5-5L5 21" stroke="#009788" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DetailHeroCard({
  name,
  dateLine,
  location,
  dayCount,
  dayLabel,
  memberCount,
  memberAvatars = [],
  docCount,
  photoCount,
  totalExpenses,
  typeBadge,
  typeBadgeColor = '#fef3c7',
  onEdit,
  gradientColors = ['#ffffff', '#d1fef9'],
}: DetailHeroCardProps) {
  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      {/* Optional type badge */}
      {!!typeBadge && (
        <View style={[styles.typeBadge, { backgroundColor: typeBadgeColor }]}>
          <Text style={styles.typeBadgeText}>{typeBadge.toUpperCase()}</Text>
        </View>
      )}

      {/* Main row: info left, days right */}
      <View style={styles.cardRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={2}>{name}</Text>
          <Text style={styles.dateLine}>{dateLine}</Text>
          {!!location && <Text style={styles.location} numberOfLines={1}>{location}</Text>}
        </View>

        <View style={styles.daysArea}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Text style={styles.daysNumber}>{dayCount}</Text>
            {onEdit && (
              <TouchableOpacity onPress={onEdit} style={styles.pencilBtn} activeOpacity={0.7}>
                <PencilIcon color="#009788" size={16} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.daysLabel}>{dayLabel.toUpperCase()}</Text>
        </View>
      </View>

      {/* Stats row — inside the card */}
      <View style={styles.statsRow}>
        <View style={styles.memberStackRow}>
          <StackedAvatars
            avatars={memberAvatars}
            totalCount={memberCount}
            maxVisible={2}
            size={26}
            overlap={7}
            counterStyle="soft"
            containerStyle={styles.memberAvatarStack}
          />
          <View style={styles.memberCountChip}>
            <MembersIcon />
            <Text style={styles.statTxt}>{memberCount}</Text>
          </View>
        </View>
        <View style={styles.statBadge}>
          <DocsIcon />
          <Text style={styles.statTxt}>{docCount}</Text>
        </View>
        <View style={styles.statBadge}>
          <PhotosIcon />
          <Text style={styles.statTxt}>{photoCount}</Text>
        </View>
        <View style={styles.statBadge}>
          <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
            <Path d="M6 3h12M6 8h12M6 13l10 8M6 8a6 6 0 0 0 0 5h3a6 6 0 0 0 6-5" stroke="#009788" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.statTxt}>{totalExpenses > 0 ? totalExpenses.toFixed(0) : '0'}</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    borderColor: '#9FE7E0',
  },
  typeBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 10,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '400',
    color: '#009788',
    letterSpacing: 0.5,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: '#009788',
    marginBottom: 2,
  },
  dateLine: {
    fontSize: 12,
    color: '#1B6265',
    fontWeight: '400',
    marginBottom: 2,
  },
  location: {
    fontSize: 12,
    color: '#1B6265',
  },
  daysArea: {
    alignItems: 'flex-end',
    paddingLeft: 8,
  },
  daysNumber: {
    fontSize: 28,
    fontWeight: '500',
    color: '#009788',
    lineHeight: 32,
  },
  daysLabel: {
    fontSize: 10,
    color: '#1B6265',
    fontWeight: '500',
    textAlign: 'right',
  },
  pencilBtn: {
    marginTop: 4,
    marginLeft: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#feffff',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  statTxt: {
    fontSize: 11,
    fontWeight: '400',
    color: '#050505',
  },
  memberStackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    marginRight: 2,
  },
  memberAvatarStack: {
    zIndex: 2,
  },
  memberCountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#feffff',
    borderRadius: 999,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 4,
    marginLeft: -10,
    zIndex: 1,
  },
});
