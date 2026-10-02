/**
 * DetailHeroCard — shared hero card for Trip & Event detail screens.
 *
 * Gradient card (mint/cyan) matching TripDetailScreen style:
 *   - Optional type badge (top-left)
 *   - Name (bold), date line, location text (left column)
 *   - Days counter + edit pencil button (right column)
 *   - Stats row inside the card: members | docs | photos | expenses
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ImageBackground, ImageSourcePropType } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { PenIcon } from './Icons';
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
  /** When true, hides the number and shows dayLabel as a pill (e.g. "Ongoing", "Today") */
  statusOnly?: boolean;
  memberCount: number;
  memberAvatars?: { id: string; uri: string }[];
  docCount: number;
  photoCount: number;
  /** Pre-formatted expense label; omit badge when null/empty/zero */
  totalExpenses?: number | string | null;
  /** Optional tag badge text (e.g. event type) */
  typeBadge?: string;
  /** Background color for the type badge pill */
  typeBadgeColor?: string;
  onEdit?: () => void;
  /** Gradient colors — defaults to trip-style mint/cyan */
  gradientColors?: [string, string, ...string[]];
  /** Optional decorative background image drawn behind the gradient/content */
  backgroundImage?: ImageSourcePropType;
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
  statusOnly = false,
  memberCount,
  memberAvatars = [],
  docCount,
  photoCount,
  totalExpenses = null,
  typeBadge,
  typeBadgeColor = '#fef3c7',
  onEdit,
  gradientColors = ['#ffffff', '#d1fef9'],
  backgroundImage,
}: DetailHeroCardProps) {
  const expenseDisplay = (() => {
    if (totalExpenses == null || totalExpenses === '') return null;
    if (typeof totalExpenses === 'number') {
      return totalExpenses > 0 ? totalExpenses.toFixed(0) : null;
    }
    if (totalExpenses === '0') return null;
    return totalExpenses;
  })();

  const content = (
    // A plain View owns the card's height: LinearGradient and Image do not reliably
    // size to their children, so they are absolute fills behind this instead.
    <View style={styles.cardContent}>
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
          {!!location && (
            <Text style={styles.location} numberOfLines={2}>{location}</Text>
          )}
        </View>

        <View style={styles.daysArea}>
          {statusOnly ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>{dayLabel}</Text>
              </View>
              {onEdit && (
                <TouchableOpacity onPress={onEdit} style={styles.pencilBtn} activeOpacity={0.7}>
                  <PenIcon color="#009788" size={17} />
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
                <Text style={styles.daysNumber}>{dayCount}</Text>
                {onEdit && (
                  <TouchableOpacity onPress={onEdit} style={styles.pencilBtn} activeOpacity={0.7}>
                    <PenIcon color="#009788" size={17} />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.daysLabel}>{dayLabel}</Text>
            </>
          )}
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
        {expenseDisplay != null && (
          <View style={[styles.statBadge, styles.expenseStatBadge]}>
            <Text
              style={styles.statTxt}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}>
              {expenseDisplay}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  const tint = (
    <LinearGradient
      colors={backgroundImage ? ['rgba(255,255,255,0.25)', 'rgba(209,254,249,0.25)'] : gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  );

  if (backgroundImage) {
    return (
      <ImageBackground
        source={backgroundImage}
        style={styles.card}
        imageStyle={styles.cardImage}
        resizeMode="cover"
      >
        {tint}
        {content}
      </ImageBackground>
    );
  }

  return (
    <View style={styles.card}>
      {tint}
      {content}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#9FE7E0',
    overflow: 'hidden',
  },
  cardImage: {
    borderRadius: 20,
  },
  cardContent: {
    padding: 16,
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
    fontWeight: '500',
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
    alignItems: 'stretch',
    paddingLeft: 8,
    minWidth: 80,
  },
  daysNumber: {
    fontSize: 28,
    fontWeight: '600',
    color: '#009788',
    lineHeight: 32,
  },
  daysLabel: {
    fontSize: 10,
    color: '#1B6265',
    fontWeight: '500',
    textAlign: 'left',
  },
  pencilBtn: {
    marginLeft: 5,
    marginTop: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  statusPill: {},
  statusPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#009788',
    letterSpacing: 0.2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 6,
    // Wraps rather than overflowing on narrow screens; safe because the card
    // height now follows its content instead of being clipped.
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
  expenseStatBadge: {
    flexShrink: 1,
    maxWidth: '100%',
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
