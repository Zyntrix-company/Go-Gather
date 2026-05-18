import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Image, StyleSheet,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { MoreVertical } from 'lucide-react-native';
import StackedAvatars from './StackedAvatars';
import CachedImage from './CachedImage';
import { PinIcon, CalendarIcon, TrashIcon } from './Icons';

// ─── Shared card data type ────────────────────────────────────────────────────

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
  image?: any;
  bannerImageUrl?: string | null;
  members: Member[];
  extraMembers: number;
  type?: string;
  daysToGo?: number;
};

// ─── Menu dropdown (shared) ───────────────────────────────────────────────────

function CardMenu({
  archiveLabel,
  onArchive,
  onDelete,
  extraItems,
}: {
  archiveLabel: string;
  onArchive?: () => void;
  onDelete?: () => void;
  extraItems?: { label: string; onPress: () => void; color?: string }[];
}) {
  return (
    <View style={s.menuDropdown} onStartShouldSetResponder={() => true}>
      {extraItems?.map((item, i) => (
        <TouchableOpacity
          key={i}
          style={[s.menuItem, i > 0 ? s.menuItemBorder : null]}
          onPress={item.onPress}
          activeOpacity={0.8}
        >
          <Text style={[s.menuItemText, item.color ? { color: item.color } : null]}>{item.label}</Text>
        </TouchableOpacity>
      ))}
      {onArchive && (
        <TouchableOpacity
          style={[s.menuItem, extraItems?.length ? s.menuItemBorder : null]}
          onPress={onArchive}
          activeOpacity={0.8}
        >
          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
            <Path
              d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"
              stroke="#64748b" strokeWidth={2}
              strokeLinecap="round" strokeLinejoin="round"
            />
          </Svg>
          <Text style={s.menuItemText}>{archiveLabel}</Text>
        </TouchableOpacity>
      )}
      {onDelete && (
        <TouchableOpacity
          style={[s.menuItem, (onArchive || extraItems?.length) ? s.menuItemBorder : null]}
          onPress={onDelete}
          activeOpacity={0.8}
        >
          <TrashIcon />
          <Text style={[s.menuItemText, { color: '#ef4444' }]}>Delete</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Unified Card ─────────────────────────────────────────────────────────────
// Single layout used for ALL states: active, upcoming, ongoing, past, archived.

export type UnifiedCardProps = {
  // Content
  imageUri?: string | null;
  imageFallback?: any;
  name: string;
  location: string;
  dateLabel: string;            // pre-formatted date string
  members: Member[];
  extraMembers?: number;
  daysToGo?: number;            // pass >0 to show badge, omit/0 to hide
  isActiveToday?: boolean;      // show TODAY / ACTIVE badge (events happening today)
  // Interaction
  onPress: () => void;
  onToggleMenu?: () => void;
  showMenu?: boolean;
  // Menu actions
  archiveLabel?: string;
  onArchive?: () => void;
  onDelete?: () => void;
  // Extra menu items (e.g. "Move to Trips" for archived)
  extraMenuItems?: { label: string; onPress: () => void; color?: string }[];
  // Layout
  mb?: number;                  // marginBottom override (default 12)
};

export function UnifiedCard({
  imageUri, imageFallback,
  name, location, dateLabel,
  members, extraMembers = 0,
  daysToGo,
  isActiveToday = false,
  onPress, onToggleMenu, showMenu = false,
  archiveLabel = 'Archive', onArchive, onDelete,
  extraMenuItems,
  mb = 12,
}: UnifiedCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => { setImgFailed(false); }, [imageUri]);

  return (
    <View style={[s.wrapper, { marginBottom: mb, zIndex: showMenu ? 100 : 1 }]}>
      <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.85}>

        {/* Left — square image */}
        {imageUri && !imgFailed
          ? <CachedImage uri={imageUri} style={s.img} resizeMode="cover" onError={() => setImgFailed(true)} />
          : imageFallback
            ? <Image source={imageFallback} style={s.img} resizeMode="cover" />
            : <View style={[s.img, s.imgPlaceholder]}>
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                    stroke="#cbd5e1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
        }

        {/* Middle — info column */}
        <View style={s.info}>
          <Text style={s.name} numberOfLines={1} ellipsizeMode="tail">{name}</Text>
          <View style={s.infoRow}>
            <PinIcon color="#0d9488" size={11} />
            <Text style={s.infoText} numberOfLines={1} ellipsizeMode="tail">{location || 'Location TBD'}</Text>
          </View>
          <View style={s.infoRow}>
            <CalendarIcon color="#f97316" size={11} />
            <Text style={s.infoText} numberOfLines={1} ellipsizeMode="tail">{dateLabel}</Text>
          </View>
        </View>

        {/* Right — column: avatars+dots on top, days below */}
        <View style={s.right}>
          {/* Top row: avatars + 3-dot */}
          <View style={s.rightTop}>
            <StackedAvatars
              avatars={members}
              totalCount={members.length + extraMembers}
              counterStyle="soft"
              size={26}
              maxVisible={2}
            />
            <TouchableOpacity
              style={s.moreBtn}
              onPress={onToggleMenu}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MoreVertical size={15} color="#64748b" strokeWidth={1.8} />
            </TouchableOpacity>
          </View>

          {/* Bottom row: days to go — always reserves space for uniform height */}
          <View style={s.rightBottom}>
            {isActiveToday
              ? <Text style={[s.daysNum, { fontSize: 11, letterSpacing: 0.4 }]}>ONGOING</Text>
              : daysToGo && daysToGo > 0
                ? <>
                    <Text style={s.daysNum}>{daysToGo}</Text>
                    <Text style={s.daysLbl}>DAYS TO GO</Text>
                  </>
                : null
            }
          </View>
        </View>

      </TouchableOpacity>

      {showMenu && (
        <CardMenu
          archiveLabel={archiveLabel}
          onArchive={onArchive}
          onDelete={onDelete}
          extraItems={extraMenuItems}
        />
      )}
    </View>
  );
}

// ─── Legacy re-exports (kept for any remaining callers) ───────────────────────

export type { CardData as LegacyCardData };

export function TripCardFull(p: {
  trip: CardData; onPress: () => void;
  showMenu: boolean; onToggleMenu: () => void;
  onArchive: () => void; onDelete: () => void;
}) {
  const days = p.trip.startDateISO
    ? Math.ceil((new Date(p.trip.startDateISO).getTime() - Date.now()) / 86400000)
    : 0;
  return (
    <UnifiedCard
      imageUri={p.trip.bannerImageUrl}
      imageFallback={p.trip.image}
      name={p.trip.name}
      location={p.trip.location}
      dateLabel={`${p.trip.startDate ?? ''} – ${p.trip.endDate ?? ''}`}
      members={p.trip.members}
      extraMembers={p.trip.extraMembers}
      daysToGo={days > 0 ? days : undefined}
      onPress={p.onPress}
      onToggleMenu={p.onToggleMenu}
      showMenu={p.showMenu}
      archiveLabel="Archive Trip"
      onArchive={p.onArchive}
      onDelete={p.onDelete}
    />
  );
}

export function TripCardPast(p: {
  trip: CardData; onPress: () => void;
  showMenu: boolean; onToggleMenu: () => void;
  onArchive: () => void; onDelete: () => void;
}) {
  return (
    <UnifiedCard
      imageUri={p.trip.bannerImageUrl}
      imageFallback={p.trip.image}
      name={p.trip.name}
      location={p.trip.location}
      dateLabel={`${p.trip.startDate ?? ''} – ${p.trip.endDate ?? ''}`}
      members={p.trip.members}
      extraMembers={p.trip.extraMembers}
      onPress={p.onPress}
      onToggleMenu={p.onToggleMenu}
      showMenu={p.showMenu}
      archiveLabel="Archive Trip"
      onArchive={p.onArchive}
      onDelete={p.onDelete}
      mb={10}
    />
  );
}

export function EventCard(p: {
  event: CardData; onPress: () => void;
  showMenu?: boolean; onToggleMenu?: () => void;
  onArchive?: () => void; onDelete?: () => void;
  disabled?: boolean;
}) {
  return (
    <UnifiedCard
      imageUri={p.event.bannerImageUrl}
      imageFallback={p.event.image}
      name={p.event.name}
      location={p.event.location}
      dateLabel={p.event.fullDate ?? `${p.event.startDate ?? ''} ${p.event.endDate ?? ''}`}
      members={p.event.members}
      extraMembers={p.event.extraMembers}
      daysToGo={p.event.daysToGo}
      onPress={p.onPress}
      onToggleMenu={p.onToggleMenu}
      showMenu={p.showMenu ?? false}
      archiveLabel="Archive Event"
      onArchive={p.onArchive}
      onDelete={p.onDelete}
    />
  );
}

export function EventCardPast(p: {
  event: CardData; onPress: () => void;
  showMenu: boolean; onToggleMenu: () => void;
  onArchive: () => void; onDelete: () => void;
}) {
  return (
    <UnifiedCard
      imageUri={p.event.bannerImageUrl}
      imageFallback={p.event.image}
      name={p.event.name}
      location={p.event.location}
      dateLabel={p.event.fullDate ?? p.event.startDate ?? ''}
      members={p.event.members}
      extraMembers={p.event.extraMembers}
      onPress={p.onPress}
      onToggleMenu={p.onToggleMenu}
      showMenu={p.showMenu}
      archiveLabel="Archive Event"
      onArchive={p.onArchive}
      onDelete={p.onDelete}
      mb={10}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 90,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  img: {
    width: 66,
    height: 66,
    borderRadius: 12,
    flexShrink: 0,
  },
  imgPlaceholder: {
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 3,
    justifyContent: 'center',
    minWidth: 0,            // allows flex child to shrink and truncate text
  },
  name: {
    fontSize: 15,
    fontWeight: '400',
    color: '#009788',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 11,
    color: '#64748b',
    flex: 1,              // lets text truncate instead of wrapping
  },
  right: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 6,
    flexShrink: 0,
  },
  rightTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rightBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 16,        // reserves space even when no days badge, keeping height uniform
  },
  daysNum: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0d9488',
  },
  daysLbl: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94a3b8',
    letterSpacing: 0.2,
  },
  moreBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuDropdown: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 148,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 10,
    overflow: 'hidden',
    zIndex: 200,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  menuItemBorder: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  menuItemText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
  },
});
