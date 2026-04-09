import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Dimensions,
  FlatList,
  Animated,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import BlobBackground from '../../components/common/BlobBackground';
import AppHeader from '../../components/common/AppHeader';
import useAuthStore from '../../store/authStore';
import useAuth from '../../hooks/useAuth';
import {
  getTrips,
  archiveTrip as archiveTripApi,
  deleteTrip as apiDeleteTrip,
  handleApiError,
} from '../../api/trips.api';
import Toast from 'react-native-toast-message';
import TripsScreen from '../trips/TripsScreen';
import EventsScreen from '../events/EventsScreen';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────

type Trip = {
  id: string;
  name: string;
  location: string;
  startDate: string;        // Display: "May 15"
  endDate: string;          // Display: "May 20"
  startDateISO: string;     // "YYYY-MM-DD" for categorization
  endDateISO: string;
  fullStartDate: string;    // "15 May 2026"
  fullEndDate: string;
  image: any;
  bannerImageUrl?: string | null;
  members: { id: string; uri: string }[];
  extraMembers: number;
};

// ─── Static Data ──────────────────────────────────────────────────────────────

const MOCK_TRIPS: Trip[] = [
  {
    id: '1',
    name: 'Goa Birthday Trip',
    location: 'Goa, India',
    startDate: 'May 15',
    endDate: 'May 20',
    startDateISO: '2026-05-15',
    endDateISO: '2026-05-20',
    fullStartDate: '15 May 2026',
    fullEndDate: '20 May 2026',
    image: require('../../assets/images/goa_beach.png'),
    members: [
      { id: '1', uri: 'https://i.pravatar.cc/150?u=1' },
      { id: '2', uri: 'https://i.pravatar.cc/150?u=2' },
      { id: '3', uri: 'https://i.pravatar.cc/150?u=3' },
    ],
    extraMembers: 1,
  },
  {
    id: '2',
    name: 'Winter Ski Trip',
    location: 'Aspen, Colorado',
    startDate: 'Jan 5',
    endDate: 'Jan 15',
    startDateISO: '2026-01-05',
    endDateISO: '2026-01-15',
    fullStartDate: '5 Jan 2026',
    fullEndDate: '15 Jan 2026',
    image: require('../../assets/images/music_festival.png'),
    members: [
      { id: '1', uri: 'https://i.pravatar.cc/150?u=4' },
      { id: '2', uri: 'https://i.pravatar.cc/150?u=5' },
      { id: '3', uri: 'https://i.pravatar.cc/150?u=6' },
    ],
    extraMembers: 0,
  },
];


const MOCK_FRIENDS = [
  { id: '1', name: 'Alex Johnson', handle: '@alexj', initials: 'AJ', color: '#6366f1', mutualTrips: 2 },
  { id: '2', name: 'Sam Patel', handle: '@sampatel', initials: 'SP', color: '#f59e0b', mutualTrips: 1 },
  { id: '3', name: 'Priya Singh', handle: '@priyas', initials: 'PS', color: '#10b981', mutualTrips: 3 },
  { id: '4', name: 'Jordan Lee', handle: '@jordanl', initials: 'JL', color: '#ec4899', mutualTrips: 1 },
  { id: '5', name: 'Marcus Wei', handle: '@marcusw', initials: 'MW', color: '#8b5cf6', mutualTrips: 0 },
];

// Only Swee AI — no friend/group chats
const SWEE_CHAT = { id: 'swee', name: 'Swee', subtitle: 'Always active · AI Assistant', isSwee: true, lastMessage: "Hi! I'm Swee, your travel assistant. How can I help plan your next adventure?", time: 'Now', unread: 0 };

const TRAVEL_INSIGHTS = [
  {
    id: '1',
    title: 'Top 10 Adventure Destinations for 2026',
    readTime: '5 min read',
    image: require('../../assets/images/goa_beach.png'),
  },
  {
    id: '2',
    title: 'Budget Travel Tips for Group Trips',
    readTime: '3 min read',
    image: require('../../assets/images/music_festival.png'),
  },
  {
    id: '3',
    title: 'How to Plan the Perfect Beach Getaway',
    readTime: '4 min read',
    image: require('../../assets/images/goa_beach.png'),
  },
];

// ─── Date Helpers ─────────────────────────────────────────────────────────────

function parseLocalDate(iso: string): Date {
  if (!iso) return new Date(0);
  const parts = iso.split('-');
  if (parts.length !== 3) return new Date(0);
  // Use local time to avoid UTC offset shifting the date
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
}

function categorizeTrips(trips: Trip[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming: Trip[] = [];
  const ongoing: Trip[] = [];
  const past: Trip[] = [];
  for (const trip of trips) {
    const start = parseLocalDate(trip.startDateISO);
    const end = parseLocalDate(trip.endDateISO);
    if (!trip.startDateISO || !trip.endDateISO) { upcoming.push(trip); continue; }
    if (end < today) past.push(trip);
    else if (start <= today && end >= today) ongoing.push(trip);
    else upcoming.push(trip);
  }
  return { upcoming, ongoing, past };
}

function daysUntil(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(isoDate);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const PinIcon = ({ color = '#94a3b8', size = 13 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx={12} cy={10} r={3} stroke={color} strokeWidth={2} />
  </Svg>
);

const CalendarIcon = ({ color = '#94a3b8', size = 13 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x={3} y={4} width={18} height={18} rx={2} ry={2} stroke={color} strokeWidth={2} />
    <Path d="M16 2v4M8 2v4M3 10h18" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);


const PlusIcon = ({ color = '#fff', size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const MoreIcon = ({ color = '#fff' }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={5} r={1.5} fill={color} />
    <Circle cx={12} cy={12} r={1.5} fill={color} />
    <Circle cx={12} cy={19} r={1.5} fill={color} />
  </Svg>
);

const PlaneIcon = ({ color = '#0d9488', size = 44 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"
      stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
    />
  </Svg>
);

const UserMenuIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path d="M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const SettingsIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const LogoutIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="#ef4444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const EditIcon = () => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
    <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// ─── Bottom Nav ───────────────────────────────────────────────────────────────

type Tab = 'home' | 'trips' | 'events' | 'friends' | 'chat' | 'gallery';

function NavIcon({ name, active, onPress }: { name: Tab; active: boolean; onPress: () => void }) {
  const color = active ? '#0d9488' : '#94a3b8';
  const labels: Record<Tab, string> = { home: 'Home', trips: 'Trips', events: 'Events', friends: 'Friends', chat: 'Chat', gallery: 'Gallery' };

  return (
    <TouchableOpacity style={styles.navItem} onPress={onPress}>
      {name === 'home' && (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M9 22V12h6v10" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
      {name === 'trips' && (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path
            d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"
            stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
          />
        </Svg>
      )}
      {name === 'events' && (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Rect x={3} y={4} width={18} height={18} rx={2} ry={2} stroke={color} strokeWidth={2} />
          <Path d="M16 2v4M8 2v4M3 10h18" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
      {name === 'friends' && (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
      {name === 'chat' && (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
      {name === 'gallery' && (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Rect x={3} y={3} width={18} height={18} rx={2} ry={2} stroke={color} strokeWidth={2} />
          <Circle cx={8.5} cy={8.5} r={1.5} fill={color} />
          <Path d="M21 15l-5-5L5 21" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
      <Text style={[styles.navText, active && styles.navTextActive]}>{labels[name]}</Text>
    </TouchableOpacity>
  );
}


const TrashIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="#ef4444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// ─── Trip Card (Upcoming / Ongoing) ──────────────────────────────────────────

function TripCardFull({ trip, onPress, showMenu, onToggleMenu, onArchive, onDelete }: {
  trip: Trip; onPress: () => void;
  showMenu: boolean; onToggleMenu: () => void;
  onArchive: () => void; onDelete: () => void;
}) {
  const days = daysUntil(trip.startDateISO);
  const isOngoing = days <= 0 && daysUntil(trip.endDateISO) >= 0;

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
          {/* Avatars — bottom-right of image */}
          <View style={styles.participantAvatars}>
            {trip.members.slice(0, 3).map((m, i) => (
              <Image key={m.id} source={{ uri: m.uri }} style={[styles.miniAvatar as any, { marginLeft: i > 0 ? -10 : 0 }]} />
            ))}
            {trip.extraMembers > 0 && (
              <View style={[styles.moreCounter, { marginLeft: -10 }]}>
                <Text style={styles.moreCounterText}>+{trip.extraMembers}</Text>
              </View>
            )}
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
      {/* Inline dropdown menu */}
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

function TripCardPast({ trip, onPress, showMenu, onToggleMenu, onArchive, onDelete }: {
  trip: Trip; onPress: () => void;
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
            <Text style={[styles.infoText, { fontSize: 11 }]}>{trip.fullStartDate} – {trip.fullEndDate}</Text>
          </View>
        </View>
        <View style={styles.pastCardRight}>
          <View style={styles.pastAvatarsRow}>
            <View style={styles.pastAvatars}>
              {trip.members.slice(0, 3).map((m, i) => (
                <Image key={m.id} source={{ uri: m.uri }} style={[styles.pastMiniAvatar as any, { marginLeft: i > 0 ? -8 : 0 }]} />
              ))}
            </View>
            <TouchableOpacity style={styles.pastMoreBtn} onPress={onToggleMenu} activeOpacity={0.7}>
              <MoreIcon color="#64748b" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
      {/* Inline dropdown menu */}
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

// ─── API → UI trip mapper ─────────────────────────────────────────────────────

function fmtDisplayDate(iso: string): string {
  if (!iso) return 'TBD';
  // Handle both "YYYY-MM-DD" and ISO datetime strings
  const clean = iso.includes('T') ? iso.split('T')[0] : iso;
  const parts = clean.split('-');
  if (parts.length !== 3) return 'TBD';
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  if (isNaN(d.getTime())) return 'TBD';
  return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
}
function fmtFullDate(iso: string): string {
  if (!iso) return 'TBD';
  const clean = iso.includes('T') ? iso.split('T')[0] : iso;
  const parts = clean.split('-');
  if (parts.length !== 3) return 'TBD';
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  if (isNaN(d.getTime())) return 'TBD';
  return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
}
function mapApiTrip(t: any): Trip {
  const locName = typeof t.location === 'string'
    ? t.location
    : (t.location?.name ?? '');
  // API may return full ISO datetime or just YYYY-MM-DD — normalize to YYYY-MM-DD
  const rawS: string = t.startDate ?? '';
  const rawE: string = t.endDate ?? '';
  const s = rawS.includes('T') ? rawS.split('T')[0] : rawS;
  const e = rawE.includes('T') ? rawE.split('T')[0] : rawE;
  return {
    id: t.id,
    name: t.name,
    location: locName,
    startDate: fmtDisplayDate(s),
    endDate: fmtDisplayDate(e),
    startDateISO: s,
    endDateISO: e,
    fullStartDate: fmtFullDate(s),
    fullEndDate: fmtFullDate(e),
    image: require('../../assets/images/goa_beach.png'),
    bannerImageUrl: t.bannerImageUrl ?? null,
    members: (t.memberAvatars || []).map((uri: string, idx: number) => ({ id: `av-${idx}`, uri })),
    extraMembers: Math.max(0, (t.memberCount ?? 1) - 1),
  };
}



// ─── Sparkles Icon (matches Figma Sparkles / lucide) ─────────────────────────

const SparklesIcon = ({ size = 24, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M9.937 15.5A2 2 0 008.5 14.063l-6.135-1.582a.5.5 0 010-.962L8.5 9.937A2 2 0 009.937 8.5l1.582-6.135a.5.5 0 01.963 0L14.063 8.5A2 2 0 0015.5 9.937l6.135 1.582a.5.5 0 010 .963L15.5 14.063A2 2 0 0014.063 15.5l-1.582 6.135a.5.5 0 01-.963 0z"
      stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
    />
    <Path d="M20 3v4M22 5h-4M4 17v2M5 18H3" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// ─── Draggable Swee FAB ───────────────────────────────────────────────────────

function SweeFab({ onPress }: { onPress: () => void }) {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const hasMoved = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
        pan.setValue({ x: 0, y: 0 });
        hasMoved.current = false;
      },
      onPanResponderMove: (_, gesture) => {
        if (Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4) {
          hasMoved.current = true;
        }
        Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false })(_, gesture);
      },
      onPanResponderRelease: (_, gesture) => {
        pan.flattenOffset();
        if (!hasMoved.current) {
          onPress();
        }
      },
    })
  ).current;

  return (
    <Animated.View
      style={[styles.sweeFab, { transform: pan.getTranslateTransform() }]}
      {...panResponder.panHandlers}>
      <SparklesIcon size={24} color="#fff" />
    </Animated.View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }: any) {
  const { logout, refreshProfile } = useAuth();
  const rawUser = useAuthStore((s) => s.user) as any;
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showTripMenu, setShowTripMenu] = useState<string | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(false);
  const [archivedEventsList, setArchivedEventsList] = useState<any[]>([]);

  const [insightIndex, setInsightIndex] = useState(0);
  const insightRef = useRef<FlatList>(null);
  const [pressedArrow, setPressedArrow] = useState<'left' | 'right' | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  // Refresh profile on mount so name/avatar are always up to date
  useEffect(() => {
    refreshProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll Travel Insights every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setInsightIndex(prev => {
        const next = (prev + 1) % TRAVEL_INSIGHTS.length;
        insightRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Load trips on mount AND every time the screen comes back into focus
  // (so edits made in TripDetailScreen are reflected immediately)
  const loadTripsRef = useRef<() => void>(() => {});
  useFocusEffect(useCallback(() => { loadTripsRef.current(); }, []));

  async function loadTrips(page: number = 1, replace: boolean = false) {
    setIsLoadingTrips(true);
    try {
      const data = await getTrips({ page, limit: 50 });
      const mapped = data.trips.map(mapApiTrip);
      setTrips(prev => replace ? mapped : [...prev, ...mapped]);
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsLoadingTrips(false);
    }
  }
  // Always keep the ref pointing at the latest loadTrips (so useFocusEffect always calls fresh version)
  loadTripsRef.current = () => loadTrips(1, true);

  const user = rawUser ? {
    fullName: rawUser.fullName ?? rawUser.full_name ?? '',
    email: rawUser.email ?? '',
    country: rawUser.country ?? '',
    bio: rawUser.bio ?? '',
    photoUrl: rawUser.photoUrl ?? rawUser.avatarUrl ?? rawUser.profile?.avatarUrl ?? '',
  } : null;

  const firstName = user?.fullName?.split(' ')[0] || 'Explorer';
  const { upcoming, ongoing, past } = categorizeTrips(trips);

  function navigateToTrip(trip: Trip) { navigation.navigate('TripDetail', { trip }); }
  function navigateToChat(chat: any) { navigation.navigate('ChatDetail', { chat }); }

  function archiveTrip(trip: Trip) {
    setShowTripMenu(null);
    Alert.alert(
      'Archive Trip',
      `Archive "${trip.name}"? You can restore it from Archived Trips anytime.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive', onPress: async () => {
            try {
              await archiveTripApi(trip.id);
              setTrips(p => p.filter(t => t.id !== trip.id));
              Toast.show({ type: 'success', text1: 'Archived', text2: `"${trip.name}" moved to archive.` });
            } catch (err) {
              handleApiError(err);
            }
          },
        },
      ],
    );
  }

  function deleteTrip(trip: Trip) {
    setShowTripMenu(null);
    Alert.alert(
      'Delete Trip',
      `Delete "${trip.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              await apiDeleteTrip(trip.id);
              setTrips(p => p.filter(t => t.id !== trip.id));
            } catch (err) {
              handleApiError(err);
            }
          },
        },
      ],
    );
  }

  function toggleTripMenu(id: string) {
    setShowTripMenu(prev => prev === id ? null : id);
  }

  // ─── HOME TAB (Main Dashboard) ─────────────────────────────────────────────

  const renderHomeTab = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

      {/* Welcome Section — no avatar here */}
      <View style={styles.welcomeCenter}>
        <Text style={styles.welcomeTitle}>Welcome, {firstName}!</Text>
        <Text style={styles.welcomeSubtitle}>Gather your crew & make memories</Text>
      </View>

      {/* Create New Trip CTA */}
      <TouchableOpacity
        style={styles.createTripBtn1}
        onPress={() => setActiveTab('trips')}
        activeOpacity={0.9}>
        <Text style={styles.createTripBtnText}>Create New Trip</Text>
      </TouchableOpacity>

      {/* Ask Swee */}
      <View style={styles.sweeBox}>
        <Text style={styles.sweeBoxText}>Need help planning your adventure?</Text>
        <TouchableOpacity
          style={styles.askSweeBtn}
          onPress={() => navigateToChat(SWEE_CHAT)}
          activeOpacity={0.8}>
          <SparklesIcon size={14} color="#f97316" />
          <Text style={styles.askSweeBtnText}>Ask Swee</Text>
        </TouchableOpacity>
      </View>

      {/* Travel Insights — always visible */}
      <Text style={styles.sectionTitle}>Travel Insights</Text>
      <View style={styles.insightCarousel}>
        {/* Left arrow — teal only when user taps, grey otherwise */}
        <TouchableOpacity
          style={[styles.insightArrowLeft, pressedArrow === 'left' ? styles.insightArrowActive : styles.insightArrowInactive]}
          onPressIn={() => setPressedArrow('left')}
          onPressOut={() => setPressedArrow(null)}
          onPress={() => {
            if (insightIndex > 0) {
              const next = insightIndex - 1;
              setInsightIndex(next);
              insightRef.current?.scrollToIndex({ index: next, animated: true });
            }
          }}
          activeOpacity={1}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={pressedArrow === 'left' ? '#fff' : '#64748b'} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        {/* Right arrow — teal only when user taps, grey otherwise */}
        <TouchableOpacity
          style={[styles.insightArrowRight, pressedArrow === 'right' ? styles.insightArrowActive : styles.insightArrowInactive]}
          onPressIn={() => setPressedArrow('right')}
          onPressOut={() => setPressedArrow(null)}
          onPress={() => {
            if (insightIndex < TRAVEL_INSIGHTS.length - 1) {
              const next = insightIndex + 1;
              setInsightIndex(next);
              insightRef.current?.scrollToIndex({ index: next, animated: true });
            }
          }}
          activeOpacity={1}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M9 18l6-6-6-6" stroke={pressedArrow === 'right' ? '#fff' : '#64748b'} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <FlatList
          ref={insightRef}
          data={TRAVEL_INSIGHTS}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={item => item.id}
          onMomentumScrollEnd={e => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_W - 40));
            setInsightIndex(idx);
          }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.insightSlide} activeOpacity={0.9}>
              <Image source={item.image} style={styles.insightImage} resizeMode="cover" />
              <View style={styles.insightCaption}>
                <Text style={styles.insightTitle} numberOfLines={2}>{item.title}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
        {/* No dots — use arrow buttons only */}
      </View>

      {/* Ongoing / Active Trips — shown first */}
      {ongoing.length > 0 && (
        <>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Active Trips</Text>
            {ongoing.length > 1 && (
              <TouchableOpacity onPress={() => setActiveTab('trips')} activeOpacity={0.7}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            )}
          </View>
          {ongoing.slice(0, 1).map(trip => (
            <TripCardFull
              key={trip.id}
              trip={trip}
              onPress={() => navigateToTrip(trip)}
              showMenu={showTripMenu === trip.id}
              onToggleMenu={() => toggleTripMenu(trip.id)}
              onArchive={() => archiveTrip(trip)}
              onDelete={() => deleteTrip(trip)}
            />
          ))}
        </>
      )}

      {/* Upcoming Trips */}
      {upcoming.length > 0 && (
        <>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Upcoming Trips</Text>
            {upcoming.length > 1 && (
              <TouchableOpacity onPress={() => setActiveTab('trips')} activeOpacity={0.7}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            )}
          </View>
          {upcoming.slice(0, 1).map(trip => (
            <TripCardFull
              key={trip.id}
              trip={trip}
              onPress={() => navigateToTrip(trip)}
              showMenu={showTripMenu === trip.id}
              onToggleMenu={() => toggleTripMenu(trip.id)}
              onArchive={() => archiveTrip(trip)}
              onDelete={() => deleteTrip(trip)}
            />
          ))}
        </>
      )}

      {/* No trips yet — friendly empty state */}
      {!isLoadingTrips && trips.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>No trips yet</Text>
          <Text style={styles.emptyStateSubtitle}>Create your first trip and start planning with friends!</Text>
        </View>
      )}
    </ScrollView>
  );

  // ─── FRIENDS TAB ───────────────────────────────────────────────────────────

  const renderFriendsTab = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      <View style={styles.tabHeaderRow}>
        <Text style={styles.tabScreenTitle}>Friends</Text>
        <TouchableOpacity style={styles.fabInline} onPress={() => Alert.alert('Add Friend', 'Search by username or invite via email')} activeOpacity={0.85}>
          <PlusIcon size={16} />
          <Text style={styles.fabInlineText}>Add Friend</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.friendsSearchWrap}>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <Text style={styles.friendsSearchPlaceholder}>Search friends...</Text>
      </View>
      <Text style={styles.friendsCount}>{MOCK_FRIENDS.length} friends</Text>
      {MOCK_FRIENDS.map(friend => (
        <TouchableOpacity key={friend.id} style={styles.friendCard} activeOpacity={0.8} onPress={() => Alert.alert(friend.name, `Handle: ${friend.handle}\nMutual trips: ${friend.mutualTrips}`)}>
          <View style={[styles.friendAvatar, { backgroundColor: friend.color + '20' }]}>
            <Text style={[styles.friendInitials, { color: friend.color }]}>{friend.initials}</Text>
          </View>
          <View style={styles.friendInfo}>
            <Text style={styles.friendName}>{friend.name}</Text>
            <Text style={styles.friendHandle}>{friend.handle}</Text>
          </View>
          {friend.mutualTrips > 0 && (
            <View style={styles.mutualBadge}>
              <Text style={styles.mutualBadgeText}>{friend.mutualTrips} trip{friend.mutualTrips > 1 ? 's' : ''}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  // ─── CHAT TAB — Swee AI only ────────────────────────────────────────────────

  const renderChatTab = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      {/* Swee AI chat — the only entry */}
      <TouchableOpacity style={styles.sweeChatCard} onPress={() => navigateToChat(SWEE_CHAT)} activeOpacity={0.85}>
        <View style={styles.sweeChatAvatar}>
          <SparklesIcon size={22} color="#fff" />
        </View>
        <View style={styles.chatInfo}>
          <View style={styles.chatTitleRow}>
            <View>
              <Text style={styles.chatName}>{SWEE_CHAT.name}</Text>
              <Text style={styles.sweeChatSubtitle}>{SWEE_CHAT.subtitle}</Text>
            </View>
            <Text style={styles.chatTime}>{SWEE_CHAT.time}</Text>
          </View>
          <Text style={styles.chatLastMsg} numberOfLines={2}>{SWEE_CHAT.lastMessage}</Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );

  // ─── GALLERY TAB ───────────────────────────────────────────────────────────

  const renderGalleryTab = () => {
    const displayName = user?.fullName || '';
    const handle = displayName.toLowerCase().replace(/ /g, '_') || 'username';
    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.galleryProfile}>
          <View style={styles.galleryAvatarWrap}>
            {user?.photoUrl && !avatarError ? (
              <Image source={{ uri: user.photoUrl }} style={styles.galleryAvatar} onError={() => setAvatarError(true)} />
            ) : (
              <View style={[styles.galleryAvatar, styles.galleryAvatarPlaceholder]}>
                <Text style={styles.galleryAvatarInitial}>{displayName ? displayName[0].toUpperCase() : '?'}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.galleryEditBtn} onPress={() => navigation.navigate('CreateProfile')} activeOpacity={0.8}>
              <EditIcon />
            </TouchableOpacity>
          </View>
          {displayName ? <Text style={styles.galleryName}>{displayName}</Text> : null}
          {displayName ? <Text style={styles.galleryHandle}>@{handle}</Text> : null}
          {user?.country ? (
            <View style={styles.galleryLocationRow}>
              <PinIcon color="#0d9488" size={14} />
              <Text style={styles.galleryLocationText}>{user.country}</Text>
            </View>
          ) : null}
          {user?.bio ? <Text style={styles.galleryBio}>{user.bio}</Text> : null}
        </View>

        <View style={styles.gallerySectionHeader}>
          <Text style={styles.gallerySectionTitle}>Gallery of Trips</Text>
          <TouchableOpacity onPress={() => setActiveTab('trips')}>
            <PlusIcon color="#0d9488" size={18} />
          </TouchableOpacity>
        </View>
        <View style={styles.galleryGrid}>
          {trips.map(trip => (
            <TouchableOpacity key={trip.id} style={styles.galleryGridCard} onPress={() => navigateToTrip(trip)} activeOpacity={0.85}>
              <Image source={trip.image} style={styles.galleryGridImage} resizeMode="cover" />
              <View style={styles.galleryGridOverlay}>
                <Text style={styles.galleryGridText} numberOfLines={1}>{trip.name}</Text>
              </View>
            </TouchableOpacity>
          ))}
          {trips.length === 0 && (
            <View style={styles.galleryEmptyCard}>
              <PlusIcon color="#cbd5e1" size={28} />
              <Text style={styles.galleryEmptyText}>Add Trip</Text>
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  // ─── Profile Dropdown ───────────────────────────────────────────────────────

  const renderProfileDropdown = () => (
    <View style={styles.dropdownOverlay}>
      <TouchableOpacity style={styles.dropdownBackdrop} activeOpacity={1} onPress={() => setShowProfileMenu(false)} />
      <View style={styles.profileDropdown}>
        <View style={styles.dropdownHeader}>
          {user?.photoUrl && !avatarError ? (
            <Image source={{ uri: user.photoUrl }} style={styles.dropdownAvatar} />
          ) : (
            <View style={[styles.dropdownAvatar, { backgroundColor: '#f0fdfa', alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#0d9488' }}>{firstName[0]}</Text>
            </View>
          )}
          <View style={styles.dropdownUserText}>
            <Text style={styles.dropdownName}>{user?.fullName || 'User'}</Text>
            <Text style={styles.dropdownEmail} numberOfLines={1}>{user?.email || ''}</Text>
          </View>
        </View>
        <View style={styles.dropdownDivider} />
        <TouchableOpacity style={styles.dropdownItem} onPress={() => { setShowProfileMenu(false); navigation.navigate('CreateProfile'); }}>
          <UserMenuIcon />
          <Text style={styles.dropdownItemText}>Account</Text>
        </TouchableOpacity>
      
        <TouchableOpacity style={styles.dropdownItem} onPress={() => setShowProfileMenu(false)}>
          <SettingsIcon />
          <Text style={styles.dropdownItemText}>Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dropdownItem} onPress={() => { setShowProfileMenu(false); navigation.navigate('ArchivedTrips'); }}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.dropdownItemText}>Archived Trips</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dropdownItem} onPress={() => { setShowProfileMenu(false); navigation.navigate('ArchivedEvents', { archivedEvents: archivedEventsList }); }}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.dropdownItemText}>Archived Events</Text>
        </TouchableOpacity>
        <View style={styles.dropdownDivider} />
        <TouchableOpacity style={styles.dropdownItem} onPress={() => { setShowProfileMenu(false); logout(); }}>
          <LogoutIcon />
          <Text style={[styles.dropdownItemText, styles.logoutLabel]}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <BlobBackground>
      <SafeAreaView style={styles.container}>
        <AppHeader
          notificationCount={2}
          onLogoPress={() => setActiveTab('home')}
          onBellPress={() => navigation.navigate('Notifications')}
          onMenuPress={() => setShowProfileMenu(true)}
        />

        {showProfileMenu && renderProfileDropdown()}

        {activeTab === 'home' && renderHomeTab()}
        {activeTab === 'trips' && <TripsScreen />}
        {/* Keep EventsScreen mounted to preserve local state across tab switches */}
        <View style={{ flex: 1, display: activeTab === 'events' ? 'flex' : 'none' }}>
          <EventsScreen onArchivedEventsChange={setArchivedEventsList} />
        </View>
        {activeTab === 'friends' && renderFriendsTab()}
        {activeTab === 'chat' && renderChatTab()}
        {activeTab === 'gallery' && renderGalleryTab()}

        {/* Draggable Swee FAB */}
        <SweeFab onPress={() => navigateToChat(SWEE_CHAT)} />

        {/* Bottom Tab Bar — Home is NOT listed here; tap logo to return home */}
        <View style={styles.tabBar}>
          {(['trips', 'events', 'friends', 'chat', 'gallery'] as Tab[]).map(tab => (
            <NavIcon key={tab} name={tab} active={activeTab === tab} onPress={() => setActiveTab(tab)} />
          ))}
        </View>

      </SafeAreaView>
    </BlobBackground>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 4 },

  // ── Home Tab ──
  // responsive: tighten spacing on small screens so Travel Insights is visible in first viewport
  welcomeCenter: { alignItems: 'center', marginTop: SCREEN_H < 700 ? 2 : 6, marginBottom: SCREEN_H < 700 ? 10 : 16 },
  // Figma: text-2xl font-bold text-slate-600
  welcomeTitle: { fontSize: 24, fontWeight: '700', color: '#475569', textAlign: 'center', marginBottom: 6 },
  // Figma: text-lg font-normal text-slate-900
  welcomeSubtitle: { fontSize: 18, fontWeight: '400', color: '#0f172a', textAlign: 'center' },

  // Figma: bg-teal-600 px-8 py-3 rounded-full font-semibold shadow-lg
  createTripBtn1: {
    backgroundColor: '#0d9488',
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 32,
    alignSelf: 'center',
    marginBottom: 21,
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
   createTripBtn: {
    backgroundColor: '#0d9488',
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 32,
    alignSelf: 'center',
    marginBottom: 1,
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  // Figma: font-semibold (600)
  createTripBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Figma: bg-gradient from-teal-500/10 to-cyan-500/10 rounded-xl p-3 border border-teal-100
  sweeBox: {
    backgroundColor: 'rgba(13,148,136,0.08)',
    borderRadius: 12,
    padding: 10,
    marginBottom: SCREEN_H < 700 ? 12 : 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(13,148,136,0.12)',
    gap: 10,
  },
  // Figma: text-base font-normal text-slate-900
  sweeBoxText: { fontSize: 16, color: '#0f172a', fontWeight: '400', textAlign: 'center' },
  // Figma: bg-white text-teal-700 px-6 py-1.5 rounded-lg text-sm font-bold shadow-sm border border-teal-100
  askSweeBtn: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 24,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(13,148,136,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  // Figma: text-sm font-bold text-teal-700
  askSweeBtnText: { fontSize: 14, color: '#0f766e', fontWeight: '700' },

  // Insights carousel — Figma: text-lg font-normal heading, h-48 image, p-4 caption
  insightCarousel: { marginBottom: 20, position: 'relative' },
  insightArrowLeft: {
    position: 'absolute', left: 10, top: '40%', zIndex: 10,
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },
  insightArrowRight: {
    position: 'absolute', right: 10, top: '40%', zIndex: 10,
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },
  insightArrowActive: { backgroundColor: '#0d9488' },
  insightArrowInactive: { backgroundColor: '#e2e8f0' },
  insightSlide: {
    width: SCREEN_W - 40,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  // scale image height so card fits in first viewport alongside header content
  insightImage: { width: '100%', height: SCREEN_H < 700 ? 140 : SCREEN_H < 800 ? 160 : 192 },
  // Figma: p-4 bg-gradient from-teal-50 to-orange-50
  insightCaption: {
    padding: 16,
    backgroundColor: '#f0fdfa',
  },
  insightReadTime: { fontSize: 11, color: '#0d9488', fontWeight: '600', marginBottom: 4 },
  // Figma: text-sm font-medium text-slate-800
  insightTitle: { fontSize: 14, fontWeight: '500', color: '#1e293b', lineHeight: 20 },

  // Section headers
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 8 },
  // Figma: text-lg font-normal text-slate-900
  sectionTitle: { fontSize: 18, fontWeight: '400', color: '#0f172a', marginBottom: 10 },
  seeAll: { fontSize: 13, color: '#0d9488', fontWeight: '600' },

  // ── Trips Tab ──
  tripsCTA: { alignItems: 'center', paddingVertical: 1, marginBottom: 8 },
  tripsPlaneCircle: {
    width: 83,
    height: 83,
    borderRadius: 40,
    backgroundColor: '#cbfbf1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  // Figma: text-xl font-semibold
  tripsCTATitle: { fontSize: 20, fontWeight: '600', color: '#0f172a', textAlign: 'center', marginBottom: 10, paddingHorizontal: 24 },
  // Figma: text-sm text-slate-600
  tripsCTASub: { fontSize: 14, color: '#64748b', marginBottom: 26, textAlign: 'center' },

  tripsListHeader: { marginBottom: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 16 },
  // Figma: text-lg font-bold
  tripsListTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  tripsListSub: { fontSize: 13, color: '#64748b', marginTop: 2 },

  // Figma: text-sm font-semibold text-slate-500 uppercase tracking-wide
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    letterSpacing: 0.6,
    marginBottom: 10,
    marginTop: 4,
    textTransform: 'uppercase',
  },

  // ── Cards (Upcoming / Ongoing) — Figma: h-36 image, rounded-xl, p-2.5 body ──
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  // Figma: h-36 (144px)
  cardMedia: { height: 144, position: 'relative' },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  ongoingBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: '#10b981', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  ongoingBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  eventTypePill: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(13,148,136,0.85)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  eventTypePillText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  cardMoreBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantAvatars: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    padding: 3,
  },
  // Avatars at the bottom strip of the image (full-width, left-aligned)
  participantAvatarsBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  miniAvatar: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#fff' },
  moreCounter: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#f0fdfa', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  moreCounterText: { fontSize: 9, color: '#0d9488', fontWeight: 'bold' },
  // Figma: p-2.5 (10px)
  cardBody: { padding: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardMain: { flex: 1, paddingRight: 8 },
  // Figma: text-base font-bold text-slate-900
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 4, lineHeight: 22 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  // Figma: text-xs text-slate-600
  infoText: { fontSize: 12, color: '#475569', fontWeight: '400' },
  daysBadge: { alignItems: 'flex-end', justifyContent: 'center', minWidth: 44 },
  daysNumber: { fontSize: 28, fontWeight: '700', color: '#0d9488', lineHeight: 32 },
  daysLabel: { fontSize: 8, color: '#94a3b8', fontWeight: '600', textAlign: 'right', letterSpacing: 0.5 },

  // ── Trip Menu Dropdown ──
  tripMenuDropdown: {
    position: 'absolute',
    top: 12,
    right: 48,
    width: 176,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    overflow: 'hidden',
    zIndex: 200,
  },
  tripMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  tripMenuItemText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '500',
  },

  // ── Past Trip Card (compact) ──
  pastCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  pastCardImage: { width: 66, height: 66, borderRadius: 12, resizeMode: 'cover', flexShrink: 0 },
  pastCardInfo: { flex: 1, gap: 3 },
  pastCardTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 2 },
  pastCardRight: { alignItems: 'center', justifyContent: 'flex-end' },
  pastAvatarsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pastAvatars: { flexDirection: 'row' },
  pastMiniAvatar: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#fff' },
  pastMoreBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  // ── Empty State ──
  emptyState: { alignItems: 'center', paddingTop: 32, gap: 12 },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#f0fdfa',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyStateTitle: { fontSize: 18, fontWeight: '700', color: '#334155' },
  emptyStateSubtitle: { fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },

  // ── Tab header rows (Events/Friends/Chat) ──
  tabHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 4 },
  tabScreenTitle: { fontSize: 24, fontWeight: '700', color: '#1e293b' },
  fabInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0d9488',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  fabInlineText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // ── Friends ──
  friendsSearchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12, gap: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  friendsSearchPlaceholder: { fontSize: 14, color: '#94a3b8' },
  friendsCount: { fontSize: 13, color: '#94a3b8', fontWeight: '500', marginBottom: 12 },
  friendCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 10, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  friendAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  friendInitials: { fontSize: 18, fontWeight: '700' },
  friendInfo: { flex: 1 },
  friendName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  friendHandle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  mutualBadge: { backgroundColor: '#f0fdfa', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  mutualBadgeText: { fontSize: 11, color: '#0d9488', fontWeight: '600' },

  // ── Chat ──
  chatCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 10, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  chatAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  chatAvatarSwee: { backgroundColor: '#0d9488' },
  chatAvatarGroup: { backgroundColor: '#6366f1' },
  chatAvatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  // Swee-only chat card
  sweeChatCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3, borderWidth: 1, borderColor: '#f0fdfa' },
  sweeChatAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#0d9488', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sweeChatSubtitle: { fontSize: 12, color: '#0d9488', fontWeight: '500', marginTop: 1 },
  chatInfo: { flex: 1 },
  chatTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  chatName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  chatTime: { fontSize: 11, color: '#94a3b8' },
  chatMsgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chatLastMsg: { flex: 1, fontSize: 13, color: '#64748b' },
  unreadBadge: { backgroundColor: '#0d9488', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, marginLeft: 6 },
  unreadBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // ── Gallery ──
  galleryProfile: { alignItems: 'center', marginTop: 8, marginBottom: 24 },
  galleryAvatarWrap: { position: 'relative', marginBottom: 12 },
  galleryAvatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#0d9488' },
  galleryAvatarPlaceholder: { backgroundColor: '#f0fdfa', alignItems: 'center', justifyContent: 'center' },
  galleryAvatarInitial: { fontSize: 36, fontWeight: '700', color: '#0d9488' },
  galleryEditBtn: { position: 'absolute', bottom: 2, right: -4, width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  galleryName: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  galleryHandle: { fontSize: 13, color: '#0d9488', fontWeight: '500', marginTop: 2 },
  galleryLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  galleryLocationText: { fontSize: 13, color: '#64748b' },
  galleryBio: { fontSize: 14, color: '#334155', textAlign: 'center', marginTop: 8, paddingHorizontal: 20, lineHeight: 20 },
  gallerySectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  gallerySectionTitle: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  galleryGridCard: { width: (SCREEN_W - 52) / 2, height: 140, borderRadius: 14, overflow: 'hidden', backgroundColor: '#f1f5f9' },
  galleryGridImage: { width: '100%', height: '100%' },
  galleryGridOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.4)', padding: 8 },
  galleryGridText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  galleryEmptyCard: { width: (SCREEN_W - 52) / 2, height: 140, borderRadius: 14, borderWidth: 2, borderColor: '#e2e8f0', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 6 },
  galleryEmptyText: { fontSize: 12, color: '#cbd5e1', fontWeight: '500' },

  // ── Swee FAB — teal circle with white ring border ──
  sweeFab: {
    position: 'absolute',
    bottom: 68,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0d9488',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 50,
  },

  // ── Bottom Tab Bar — Figma: gradient bg from-slate-50 via-teal-50 to-cyan-50 ──
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 58,
    backgroundColor: '#f0fdfa',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 10,
  },
  navItem: { alignItems: 'center', justifyContent: 'center', flex: 1, paddingTop: 4 },
  navText: { fontSize: 9, color: '#94a3b8', marginTop: 2, fontWeight: '500' },
  navTextActive: { color: '#0d9488', fontWeight: '600' },

  // ── Profile Dropdown ──
  dropdownOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 },
  dropdownBackdrop: { flex: 1 },
  profileDropdown: { position: 'absolute', top: 70, right: 20, width: 240, maxHeight: 420, backgroundColor: '#fff', borderRadius: 16, padding: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 8, borderWidth: 1, borderColor: '#f1f5f9' },
  dropdownHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
  dropdownAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f1f5f9' },
  dropdownUserText: { flex: 1 },
  dropdownName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  dropdownEmail: { fontSize: 12, color: '#64748b', marginTop: 2 },
  dropdownDivider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 4 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12, borderRadius: 10 },
  dropdownItemText: { fontSize: 14, fontWeight: '500', color: '#334155' },
  logoutLabel: { color: '#ef4444' },

  // ── Modals (shared overlay + dialog shell) ──
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  modalDialog: { backgroundColor: '#fff', borderRadius: 24, width: '100%', maxHeight: '90%', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 12 },

  // ── Create Trip Modal — Figma-exact styles ──
  // Header (sticky)
  ctHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  ctTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  ctCloseBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  // Scroll area
  ctScrollContent: { paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
  // Field label (Figma: text-sm font-semibold text-slate-900)
  ctLabel: { fontSize: 13, fontWeight: '600', color: '#0f172a', marginTop: 4 },
  // Text input (Figma: border-2 border-slate-200 rounded-xl)
  ctInput: { borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#0f172a', backgroundColor: '#fff' },
  // Date row
  ctDateRow: { flexDirection: 'row', gap: 10 },
  ctDateBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  ctDateText: { flex: 1, fontSize: 13, color: '#0f172a' },
  // Location box with pin icon
  ctLocationBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  // Action rows (Figma: bg-slate-50 rounded-xl px-3 py-2 flex-row justify-between)
  ctRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  ctRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  // Teal-400 icon circle (Figma: w-7 h-7 rounded-full bg-teal-400)
  ctRowIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#2dd4bf', alignItems: 'center', justifyContent: 'center' },
  ctRowText: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  ctRowSub: { fontSize: 11, color: '#94a3b8' },
  // Count badge (Figma: bg-teal-100 text-teal-700 rounded-full px-2)
  ctCountBadge: { backgroundColor: '#ccfbf1', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  ctCountBadgeText: { fontSize: 11, color: '#0f766e', fontWeight: '600' },
  // Uploaded doc chip
  ctDocChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  ctDocChipText: { flex: 1, fontSize: 12, color: '#334155' },
  ctDocRemove: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' },
  // Footer (sticky bottom, Figma: border-t, Cancel text + rounded-full button)
  ctFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  ctCancelText: { fontSize: 13, fontWeight: '600', color: '#0f172a', textDecorationLine: 'underline' },
  // Figma: bg-teal-600 rounded-full px-10 py-3.5 font-semibold
  ctCreateBtn: { backgroundColor: '#0d9488', borderRadius: 999, paddingHorizontal: 28, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  ctCreateBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // ── Invite modal tabs ──
  inviteTabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  inviteTab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  inviteTabActive: { borderBottomWidth: 2, borderBottomColor: '#0d9488', backgroundColor: '#f0fdfa' },
  inviteTabText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  inviteTabTextActive: { color: '#0d9488' },
  friendSelectRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 10, marginBottom: 4 },
  friendSelectAvatar: { width: 44, height: 44, borderRadius: 22 },
  checkCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#0d9488', alignItems: 'center', justifyContent: 'center' },

  // Legacy field styles (kept for any remaining usage)
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  fieldInput: { backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#0f172a', marginBottom: 4 },
  dateRow: { flexDirection: 'row', gap: 10 },
  dateField: { flex: 1 },
  inviteRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  inviteAddBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#0d9488', alignItems: 'center', justifyContent: 'center' },
  inviteChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f0fdfa', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginTop: 8, borderWidth: 1, borderColor: '#ccfbf1' },
  inviteChipText: { fontSize: 13, color: '#0d9488', fontWeight: '500' },
  modalSaveBtn: { backgroundColor: '#0d9488', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  modalSaveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Keep these for old compatibility (modals/dropdown)
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
});