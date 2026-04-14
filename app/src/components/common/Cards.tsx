import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import StackedAvatars from './StackedAvatars';

const { width: SW } = Dimensions.get('window');
const isSmall = SW < 360;
import { PinIcon, CalendarIcon, MoreIcon, TrashIcon } from './Icons';
import { daysUntil } from '../../utils/date';
import colors from '../../theme/colors';

export type Member = { id: string; uri: string };

export type CardData = {
  id: string;
  name: string;
  location: string;
  startDate?: string;
  endDate?: string;
  startDateISO?: string;
  endDateISO?: string;
  fullDate?: string;
  image: any;
  bannerImageUrl?: string | null;
  members: Member[];
  extraMembers: number;
  type?: string;
  daysToGo?: number;
};

// ─── Trip Card (Upcoming / Ongoing) ──────────────────────────────────────────

export function TripCardFull({ trip, onPress, showMenu, onToggleMenu, onArchive, onDelete }: {
  trip: CardData; onPress: () => void;
  showMenu: boolean; onToggleMenu: () => void;
  onArchive: () => void; onDelete: () => void;
}) {
  const days = trip.startDateISO ? daysUntil(trip.startDateISO) : 0;
  const isOngoing = days <= 0 && (trip.endDateISO ? daysUntil(trip.endDateISO) >= 0 : false);

  return (
    <View style={{ marginBottom: 18, zIndex: showMenu ? 100 : 1 }}>
      <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
        <View style={styles.cardMedia}>
          {trip.bannerImageUrl
            ? <Image source={{ uri: trip.bannerImageUrl }} style={styles.cardImage as any} resizeMode="cover" />
            : <Image source={trip.image} style={styles.cardImage as any} resizeMode="cover" />
          }
          {isOngoing && (
            <View style={styles.ongoingBadge}>
              <Text style={styles.ongoingBadgeText}>Ongoing</Text>
            </View>
          )}
          <TouchableOpacity style={styles.cardMoreBtn} onPress={onToggleMenu} activeOpacity={0.8}>
            <MoreIcon />
          </TouchableOpacity>
          <View style={styles.participantAvatars}>
            <StackedAvatars
              avatars={trip.members}
              totalCount={trip.members.length + trip.extraMembers}
              counterStyle="solid"
              size={26}
            />
          </View>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardMain}>
            <Text style={styles.cardTitle}>{trip.name}</Text>
            <View style={styles.infoItem}>
              <PinIcon color="#0d9488" />
              <Text style={styles.infoText}>{trip.location}</Text>
            </View>
            <View style={[styles.infoItem, { marginTop: 4 }]}>
              <CalendarIcon color="#f97316" />
              <Text style={styles.infoText}>{trip.startDate} – {trip.endDate}</Text>
            </View>
          </View>
          {!isOngoing && days > 0 && (
            <View style={styles.daysBadge}>
              <Text style={styles.daysNumber}>{days}</Text>
              <Text style={styles.daysLabel}>DAYS{'\n'}TO GO</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
      {showMenu && (
        <View style={styles.tripMenuDropdown}>
          <TouchableOpacity style={styles.tripMenuItem} onPress={onArchive} activeOpacity={0.8}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.tripMenuItemText}>Archive Trip</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tripMenuItem, { borderTopWidth: 1, borderTopColor: '#f1f5f9' }]} onPress={onDelete} activeOpacity={0.8}>
            <TrashIcon />
            <Text style={[styles.tripMenuItemText, { color: '#ef4444' }]}>Delete Trip</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Past Trip Card (Compact) ─────────────────────────────────────────────────

export function TripCardPast({ trip, onPress, showMenu, onToggleMenu, onArchive, onDelete }: {
  trip: CardData; onPress: () => void;
  showMenu: boolean; onToggleMenu: () => void;
  onArchive: () => void; onDelete: () => void;
}) {
  return (
    <View style={{ marginBottom: 10, zIndex: showMenu ? 100 : 1 }}>
      <TouchableOpacity style={styles.pastCard} onPress={onPress} activeOpacity={0.85}>
        {trip.bannerImageUrl
          ? <Image source={{ uri: trip.bannerImageUrl }} style={styles.pastCardImage as any} resizeMode="cover" />
          : <Image source={trip.image} style={styles.pastCardImage as any} resizeMode="cover" />
        }
        <View style={styles.pastCardInfo}>
          <Text style={styles.pastCardTitle} numberOfLines={1}>{trip.name}</Text>
          <View style={styles.infoItem}>
            <PinIcon color="#0d9488" size={12} />
            <Text style={[styles.infoText, { fontSize: 11 }]}>{trip.location}</Text>
          </View>
          <View style={[styles.infoItem, { marginTop: 2 }]}>
            <CalendarIcon color="#f97316" size={12} />
            <Text style={[styles.infoText, { fontSize: 11 }]}>{trip.startDate} – {trip.endDate}</Text>
          </View>
        </View>
        <View style={styles.pastCardRight}>
          <View style={styles.pastAvatarsRow}>
            <StackedAvatars
              avatars={trip.members}
              totalCount={trip.members.length + trip.extraMembers}
              counterStyle="soft"
              size={22}
              maxVisible={3}
            />
            <TouchableOpacity style={styles.pastMoreBtn} onPress={onToggleMenu} activeOpacity={0.7}>
              <MoreIcon color="#64748b" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
      {showMenu && (
        <View style={[styles.tripMenuDropdown, { right: 8 }]}>
          <TouchableOpacity style={styles.tripMenuItem} onPress={onArchive} activeOpacity={0.8}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.tripMenuItemText}>Archive Trip</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tripMenuItem, { borderTopWidth: 1, borderTopColor: '#f1f5f9' }]} onPress={onDelete} activeOpacity={0.8}>
            <TrashIcon />
            <Text style={[styles.tripMenuItemText, { color: '#ef4444' }]}>Delete Trip</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Event Card ───────────────────────────────────────────────────────────────

export function EventCard({ event, onPress, showMenu, onToggleMenu, onArchive, onDelete, disabled }: {
  event: CardData; onPress: () => void;
  showMenu?: boolean; onToggleMenu?: () => void;
  onArchive?: () => void; onDelete?: () => void;
  disabled?: boolean;
}) {
  const CardWrapper = disabled ? View : TouchableOpacity;
  const wrapperProps = disabled
    ? { style: styles.card }
    : { style: styles.card, onPress, activeOpacity: 0.9 };

  return (
    <View style={{ marginBottom: 18, zIndex: showMenu ? 100 : 1 }}>
      <CardWrapper {...(wrapperProps as any)}>
        <View style={styles.cardMedia}>
          {event.bannerImageUrl
            ? <Image source={{ uri: event.bannerImageUrl }} style={styles.cardImage as any} resizeMode="cover" />
            : <Image source={event.image} style={styles.cardImage as any} resizeMode="cover" />
          }
          {event.type && (
            <View style={styles.eventTypePill}>
              <Text style={styles.eventTypePillText}>{event.type}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.cardMoreBtnPlain} onPress={onToggleMenu} activeOpacity={0.8}>
            <MoreIcon />
          </TouchableOpacity>
          <View style={styles.participantAvatars}>
            <StackedAvatars
              avatars={event.members}
              totalCount={event.members.length + event.extraMembers}
              counterStyle="solid"
              size={26}
            />
          </View>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardMain}>
            <Text style={styles.cardTitle}>{event.name}</Text>
            <View style={styles.infoItem}>
              <PinIcon color="#0d9488" />
              <Text style={styles.infoText}>{event.location}</Text>
            </View>
            <View style={[styles.infoItem, { marginTop: 4 }]}>
              <CalendarIcon color="#f97316" />
              <Text style={styles.infoText}>{event.fullDate || (event.startDate + ' ' + event.endDate)}</Text>
            </View>
          </View>
          {event.daysToGo !== undefined && event.daysToGo > 0 && (
            <View style={styles.daysBadge}>
              <Text style={styles.daysNumber}>{event.daysToGo}</Text>
              <Text style={styles.daysLabel}>DAYS{'\n'}TO GO</Text>
            </View>
          )}
        </View>
      </CardWrapper>
      {showMenu && (
        <View style={styles.tripMenuDropdown}>
          <TouchableOpacity style={styles.tripMenuItem} onPress={onArchive} activeOpacity={0.8}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.tripMenuItemText}>Archive Event</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tripMenuItem, { borderTopWidth: 1, borderTopColor: '#f1f5f9' }]} onPress={onDelete} activeOpacity={0.8}>
            <TrashIcon />
            <Text style={[styles.tripMenuItemText, { color: '#ef4444' }]}>Delete Event</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}


// ─── Past Event Card (Compact) ────────────────────────────────────────────────

export function EventCardPast({ event, onPress, showMenu, onToggleMenu, onArchive, onDelete }: {
  event: CardData; onPress: () => void;
  showMenu: boolean; onToggleMenu: () => void;
  onArchive: () => void; onDelete: () => void;
}) {
  return (
    <View style={{ marginBottom: 10, zIndex: showMenu ? 100 : 1 }}>
      <TouchableOpacity style={styles.pastCard} onPress={onPress} activeOpacity={0.85}>
        {event.bannerImageUrl
          ? <Image source={{ uri: event.bannerImageUrl }} style={styles.pastCardImage as any} resizeMode="cover" />
          : <Image source={event.image} style={styles.pastCardImage as any} resizeMode="cover" />
        }
        <View style={styles.pastCardInfo}>
          <Text style={styles.pastCardTitle} numberOfLines={1}>{event.name}</Text>
          <View style={styles.infoItem}>
            <PinIcon color="#0d9488" size={12} />
            <Text style={[styles.infoText, { fontSize: 11 }]}>{event.location}</Text>
          </View>
          <View style={[styles.infoItem, { marginTop: 2 }]}>
            <CalendarIcon color="#f97316" size={12} />
            <Text style={[styles.infoText, { fontSize: 11 }]}>{event.fullDate || event.startDate}</Text>
          </View>
        </View>
        <View style={styles.pastCardRight}>
          <View style={styles.pastAvatarsRow}>
            <StackedAvatars
              avatars={event.members}
              totalCount={event.members.length + event.extraMembers}
              counterStyle="soft"
              size={22}
              maxVisible={3}
            />
            <TouchableOpacity style={styles.pastMoreBtn} onPress={onToggleMenu} activeOpacity={0.7}>
              <MoreIcon color="#64748b" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
      {showMenu && (
        <View style={[styles.tripMenuDropdown, { right: 8 }]}>
          <TouchableOpacity style={styles.tripMenuItem} onPress={onArchive} activeOpacity={0.8}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.tripMenuItemText}>Archive Event</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tripMenuItem, { borderTopWidth: 1, borderTopColor: '#f1f5f9' }]} onPress={onDelete} activeOpacity={0.8}>
            <TrashIcon />
            <Text style={[styles.tripMenuItemText, { color: '#ef4444' }]}>Delete Event</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 0,
  },
  cardMedia: {
    height: isSmall ? 130 : 160,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  ongoingBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#0d9488',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  ongoingBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  cardMoreBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Same position/size as cardMoreBtn but no background — used on EventCard
  cardMoreBtnPlain: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantAvatars: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#fff',
    marginLeft: -8,
  },
  moreCounter: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#0d9488',
    borderWidth: 1.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  moreCounterText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
  cardBody: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardMain: {
    flex: 1,
  },
  cardTitle: {
    fontSize: isSmall ? 14 : 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  infoText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  daysBadge: {
    alignItems: 'center',
    minWidth: 46,
    marginLeft: 10,
  },
  daysNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f172a',
    lineHeight: 24,
  },
  daysLabel: {
    fontSize: 8,
    color: '#94a3b8',
    fontWeight: '800',
    textAlign: 'center',
  },
  tripMenuDropdown: {
    position: 'absolute',
    top: 45,
    right: 16,
    width: 150,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    paddingVertical: 5,
    zIndex: 1000,
  },
  tripMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tripMenuItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  pastCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pastCardImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
  },
  pastCardInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  pastCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  pastCardRight: {
    marginLeft: 8,
  },
  pastAvatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pastAvatars: {
    flexDirection: 'row',
  },
  pastMiniAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  pastMoreBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pastExtraBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E8F8F8',
    borderWidth: 1.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pastExtraText: {
    fontSize: 8,
    fontWeight: '700' as const,
    color: '#0d9488',
  },
  eventTypePill: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  eventTypePillText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
