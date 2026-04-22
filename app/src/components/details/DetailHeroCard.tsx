/**
 * DetailHeroCard — hero card for Event/Trip detail screens.
 * Shows event/trip name, date, location, days badge, optional type badge, and edit button.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import colors from '../../theme/colors';
import LinearGradient from 'react-native-linear-gradient';
import { PinIcon, PencilIcon } from '../common/Icons';

interface DetailHeroCardProps {
  name: string;
  dateLine: string;
  location: string;
  dayCount: number;
  dayLabel: string;
  typeBadge?: string;
  typeBadgeColor?: string;
  onEdit?: () => void;
  /** Optional gradient background colors */
  gradientColors?: string[];
}

export default function DetailHeroCard({
  name,
  dateLine,
  location,
  dayCount,
  dayLabel,
  typeBadge,
  typeBadgeColor = '#f0fdfa',
  onEdit,
  gradientColors,
}: DetailHeroCardProps) {
  const Container = gradientColors ? LinearGradient : View;
  const containerProps = gradientColors ? { colors: gradientColors, start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } : {};

  return (
    <Container {...(containerProps as any)} style={[styles.card, gradientColors && styles.cardGradient]}>
      {typeBadge && (
        <View style={[styles.typeBadge, { backgroundColor: typeBadgeColor }]}>
          <Text style={styles.typeBadgeText}>{typeBadge}</Text>
        </View>
      )}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={2}>
            {name}
          </Text>
          <Text style={styles.date}>{dateLine}</Text>
          <View style={styles.locationRow}>
            <PinIcon color={colors.textSecondary} size={14} />
            <Text style={styles.locationText} numberOfLines={1}>
              {location}
            </Text>
          </View>
        </View>

        <View style={styles.daysBadge}>
          <Text style={styles.daysNumber}>{dayCount}</Text>
          <Text style={styles.daysLabel}>{(dayLabel || '').toUpperCase()}</Text>
        </View>

        {onEdit && (
          <TouchableOpacity
            style={styles.editBtn}
            onPress={onEdit}
            activeOpacity={0.7}
          >
            <PencilIcon color={colors.accent} size={16} />
          </TouchableOpacity>
        )}
      </View>
    </Container>
  );
}


const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardGradient: {
    backgroundColor: 'transparent',
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
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  name: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  date: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '400',
    marginBottom: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  daysBadge: {
    alignItems: 'center',
    minWidth: 48,
  },
  daysNumber: {
    fontSize: 28,
    fontWeight: '500',
    color: colors.textPrimary,
    lineHeight: 32,
  },
  daysLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '500',
    textAlign: 'center',
  },
  editBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
