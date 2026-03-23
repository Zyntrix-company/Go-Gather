import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  FlatList,
  Animated,
  PanResponder,
  Switch,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { launchImageLibrary } from 'react-native-image-picker';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import BlobBackground from '../../components/common/BlobBackground';
import AppHeader from '../../components/common/AppHeader';
import useAuthStore from '../../store/authStore';
import useAuth from '../../hooks/useAuth';
import {
  getTrips,
  createTrip as apiCreateTrip,
  updateTrip as apiUpdateTrip,
  deleteTrip as apiDeleteTrip,
  uploadTripPhotos,
  getFriends,
  handleApiError,
} from '../../api/trips.api';
import Toast from 'react-native-toast-message';

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

const MOCK_EVENTS = [
  {
    id: '1',
    name: 'Spring Music Festival',
    type: 'Music',
    location: 'Palace Grounds, Bangalore',
    date: 'Apr 10',
    fullDate: '10 Apr 2026',
    dateISO: '2026-04-10',
    daysToGo: 20,
    image: require('../../assets/images/music_festival.png'),
    members: [
      { id: '1', uri: 'https://i.pravatar.cc/150?u=1' },
      { id: '2', uri: 'https://i.pravatar.cc/150?u=6' },
    ],
    extraMembers: 1,
  },
  {
    id: '2',
    name: 'Birthday Dinner',
    type: 'Birthday',
    location: 'The Table, Mumbai',
    date: 'Jan 5',
    fullDate: '5 Jan 2026',
    dateISO: '2026-01-05',
    daysToGo: 0,
    image: require('../../assets/images/goa_beach.png'),
    members: [{ id: '1', uri: 'https://i.pravatar.cc/150?u=2' }],
    extraMembers: 3,
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

function TripCardFull({ trip, onPress, showMenu, onToggleMenu, onDelete }: {
  trip: Trip; onPress: () => void;
  showMenu: boolean; onToggleMenu: () => void;
  onDelete: () => void;
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
          <TouchableOpacity style={styles.tripMenuItem} onPress={onDelete} activeOpacity={0.8}>
            <TrashIcon />
            <Text style={[styles.tripMenuItemText, { color: '#ef4444' }]}>Delete Trip</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Past Trip Card (Compact) ─────────────────────────────────────────────────

function TripCardPast({ trip, onPress, showMenu, onToggleMenu, onDelete }: {
  trip: Trip; onPress: () => void;
  showMenu: boolean; onToggleMenu: () => void;
  onDelete: () => void;
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
          <TouchableOpacity style={styles.tripMenuItem} onPress={onDelete} activeOpacity={0.8}>
            <TrashIcon />
            <Text style={[styles.tripMenuItemText, { color: '#ef4444' }]}>Delete Trip</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({ event, onPress, onMore }: any) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.cardMedia}>
        <Image source={event.image} style={styles.cardImage as any} />
        <View style={styles.eventTypePill}>
          <Text style={styles.eventTypePillText}>{event.type}</Text>
        </View>
        <TouchableOpacity style={styles.cardMoreBtn} onPress={onMore} activeOpacity={0.8}>
          <MoreIcon />
        </TouchableOpacity>
        <View style={styles.participantAvatars}>
          {event.members.slice(0, 3).map((m: any, i: number) => (
            <Image key={m.id} source={{ uri: m.uri }} style={[styles.miniAvatar as any, { marginLeft: i > 0 ? -10 : 0 }]} />
          ))}
          {event.extraMembers > 0 && (
            <View style={[styles.moreCounter, { marginLeft: -10 }]}>
              <Text style={styles.moreCounterText}>+{event.extraMembers}</Text>
            </View>
          )}
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
            <Text style={styles.infoText}>{event.fullDate}</Text>
          </View>
        </View>
        {event.daysToGo > 0 && (
          <View style={styles.daysBadge}>
            <Text style={styles.daysNumber}>{event.daysToGo}</Text>
            <Text style={styles.daysLabel}>DAYS{'\n'}TO GO</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
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
    members: [],
    extraMembers: Math.max(0, (t.memberCount ?? 1) - 1),
  };
}

// ─── Create Trip Modal (matches Figma exactly) ───────────────────────────────

const CT_FRIENDS = [
  { id: '1', name: 'Yuki Tanaka', email: 'yuki_tanaka@example.com', uri: 'https://i.pravatar.cc/150?img=32' },
  { id: '2', name: 'Amara Okafor', email: 'amara2025@example.com', uri: 'https://i.pravatar.cc/150?img=38' },
  { id: '3', name: 'Marcus Johnson', email: 'marcusj_nyc@example.com', uri: 'https://i.pravatar.cc/150?img=13' },
  { id: '4', name: 'Sofia Rodriguez', email: 'sofia_rio@example.com', uri: 'https://i.pravatar.cc/150?img=45' },
  { id: '5', name: 'Ahmed Al-Rashid', email: 'ahmed_explorer@example.com', uri: 'https://i.pravatar.cc/150?img=53' },
];

function CreateTripModal({ visible, onClose, onSave }: { visible: boolean; onClose: () => void; onSave: (data: any) => Promise<void> }) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [startDateObj, setStartDateObj] = useState<Date | undefined>(undefined);
  const [endDateObj, setEndDateObj] = useState<Date | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiFriends, setApiFriends] = useState<typeof CT_FRIENDS>(CT_FRIENDS);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [reminders, setReminders] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<string[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [memberTab, setMemberTab] = useState<'friends' | 'new'>('friends');
  const [friendSearch, setFriendSearch] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [bannerImageUri, setBannerImageUri] = useState<string | undefined>(undefined);

  function formatDate(d: Date | undefined): string {
    if (!d) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  }

  function reset() {
    setName(''); setLocation('');
    setStartDateObj(undefined); setEndDateObj(undefined);
    setShowStartPicker(false); setShowEndPicker(false);
    setReminders(false); setUploadedDocs([]); setSelectedFriendIds([]);
    setFriendSearch(''); setInviteEmail('');
    setBannerImageUri(undefined);
  }

  async function handleSave() {
    if (!name.trim()) { Alert.alert('Error', 'Please enter a trip name'); return; }
    setIsSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        location: location.trim(),
        startDate: formatDate(startDateObj),
        endDate: formatDate(endDateObj),
        startDateISO: startDateObj ? startDateObj.toISOString().split('T')[0] : undefined,
        endDateISO: endDateObj ? endDateObj.toISOString().split('T')[0] : undefined,
        friendIds: selectedFriendIds,
        inviteEmail: inviteEmail.trim() || undefined,
        bannerImageUrl: bannerImageUri,
      });
      reset();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleUploadDocs() {
    launchImageLibrary(
      { mediaType: 'mixed', selectionLimit: 0 },
      (response) => {
        if (response.didCancel || response.errorCode) return;
        const names = (response.assets || []).map(a => a.fileName || `File_${Date.now()}.pdf`);
        setUploadedDocs(p => [...p, ...names]);
      }
    );
  }

  async function handleFetchLocation() {
    // On Android, request fine location permission first
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          { title: 'Location Permission', message: 'GoGather needs access to your location to fill in the trip location.', buttonPositive: 'Allow', buttonNegative: 'Deny' }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission Denied', 'Location permission was denied. Please type your location manually.');
          return;
        }
      } catch {
        Alert.alert('Permission Error', 'Could not request location permission. Please type your location manually.');
        return;
      }
    }
    setFetchingLocation(true);
    Geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`,
            { headers: { 'User-Agent': 'GatherGo/1.0' } }
          );
          const data = await res.json();
          const a = data.address || {};
          // Build a clean readable address: suburb/city, state, country
          const parts = [
            a.suburb || a.neighbourhood || a.village || a.town,
            a.city || a.county || a.state_district,
            a.state,
            a.country,
          ].filter(Boolean);
          setLocation(parts.length > 0 ? parts.join(', ') : data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        } catch {
          // Fallback to coordinates if reverse geocoding fails
          setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
        setFetchingLocation(false);
      },
      (err) => {
        setFetchingLocation(false);
        Alert.alert('Location Error', err.message || 'Could not get location. Please type it manually.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  function toggleFriend(id: string) {
    setSelectedFriendIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  }

  // Load real friends from API when invite sub-modal opens
  useEffect(() => {
    if (!showInviteModal) return;
    getFriends(friendSearch || undefined).then(data => {
      const mapped = data.friends.map(f => ({
        id: f.user.id,
        name: f.user.name,
        email: '',
        uri: f.user.avatarUrl ?? `https://i.pravatar.cc/150?u=${f.user.id}`,
      }));
      if (mapped.length > 0) setApiFriends(mapped);
    }).catch(() => { /* keep CT_FRIENDS fallback */ });
  }, [showInviteModal]);

  const filteredFriends = apiFriends.filter(f =>
    f.name.toLowerCase().includes(friendSearch.toLowerCase()) ||
    (f.email && f.email.toLowerCase().includes(friendSearch.toLowerCase()))
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalDialog}>

          {/* ── Header (sticky top) ── */}
          <View style={styles.ctHeader}>
            <Text style={styles.ctTitle}>Create New Trip</Text>
            <TouchableOpacity onPress={onClose} style={styles.ctCloseBtn} activeOpacity={0.7}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M18 6L6 18M6 6l12 12" stroke="#64748b" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          </View>

          {/* ── Scrollable Fields ── */}
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.ctScrollContent}>

            {/* Banner Image */}
            <Text style={styles.ctLabel}>Banner Image</Text>
            <TouchableOpacity
              style={{ width: '100%', height: 140, borderRadius: 12, backgroundColor: '#f1f5f9', overflow: 'hidden', marginBottom: 14, alignItems: 'center', justifyContent: 'center', borderWidth: bannerImageUri ? 0 : 1, borderColor: '#e2e8f0', borderStyle: 'dashed' }}
              onPress={() => launchImageLibrary({
                mediaType: 'photo',
                selectionLimit: 1,
                includeBase64: false,
                presentationStyle: 'fullScreen',
              }, res => {
                if (res.didCancel || res.errorCode) return;
                const uri = res.assets?.[0]?.uri;
                if (uri) setBannerImageUri(uri);
              })}
              activeOpacity={0.8}
            >
              {bannerImageUri ? (
                <>
                  <Image source={{ uri: bannerImageUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  <TouchableOpacity
                    style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 4 }}
                    onPress={() => setBannerImageUri(undefined)}
                  >
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                      <Path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={{ alignItems: 'center', gap: 6 }}>
                  <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                    <Rect x={3} y={3} width={18} height={18} rx={2} ry={2} stroke="#94a3b8" strokeWidth={2} />
                    <Circle cx={8.5} cy={8.5} r={1.5} fill="#94a3b8" />
                    <Path d="M21 15l-5-5L5 21" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <Text style={{ color: '#94a3b8', fontSize: 13 }}>Tap to add banner photo</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Trip Name */}
            <Text style={styles.ctLabel}>Trip Name</Text>
            <TextInput style={styles.ctInput} placeholder="e.g., Tokyo Getaway" placeholderTextColor="#94a3b8" value={name} onChangeText={setName} />

            {/* Start / End Date row */}
            <View style={styles.ctDateRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ctLabel}>Start Date</Text>
                <TouchableOpacity style={styles.ctDateBox} onPress={() => { setShowEndPicker(false); setShowStartPicker(true); }} activeOpacity={0.8}>
                  <Text style={[styles.ctDateText, { flex: 1, color: startDateObj ? '#0f172a' : '#94a3b8' }]}>
                    {startDateObj ? formatDate(startDateObj) : 'DD/MM/YY'}
                  </Text>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Rect x={3} y={4} width={18} height={18} rx={2} ry={2} stroke="#0d9488" strokeWidth={2} />
                    <Path d="M16 2v4M8 2v4M3 10h18" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.ctLabel}>End Date</Text>
                <TouchableOpacity style={styles.ctDateBox} onPress={() => { setShowStartPicker(false); setShowEndPicker(true); }} activeOpacity={0.8}>
                  <Text style={[styles.ctDateText, { flex: 1, color: endDateObj ? '#0f172a' : '#94a3b8' }]}>
                    {endDateObj ? formatDate(endDateObj) : 'DD/MM/YY'}
                  </Text>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Rect x={3} y={4} width={18} height={18} rx={2} ry={2} stroke="#0d9488" strokeWidth={2} />
                    <Path d="M16 2v4M8 2v4M3 10h18" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </TouchableOpacity>
              </View>
            </View>

            {/* Native Date Pickers */}
            {showStartPicker && (
              <DateTimePicker
                value={startDateObj || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event: DateTimePickerEvent, date?: Date) => {
                  if (Platform.OS === 'android') setShowStartPicker(false);
                  if (event.type === 'set' && date) setStartDateObj(date);
                  else if (event.type === 'dismissed') setShowStartPicker(false);
                }}
              />
            )}
            {showStartPicker && Platform.OS === 'ios' && (
              <TouchableOpacity onPress={() => setShowStartPicker(false)} style={styles.ctCreateBtn}>
                <Text style={styles.ctCreateBtnText}>Done</Text>
              </TouchableOpacity>
            )}
            {showEndPicker && (
              <DateTimePicker
                value={endDateObj || startDateObj || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event: DateTimePickerEvent, date?: Date) => {
                  if (Platform.OS === 'android') setShowEndPicker(false);
                  if (event.type === 'set' && date) setEndDateObj(date);
                  else if (event.type === 'dismissed') setShowEndPicker(false);
                }}
              />
            )}
            {showEndPicker && Platform.OS === 'ios' && (
              <TouchableOpacity onPress={() => setShowEndPicker(false)} style={styles.ctCreateBtn}>
                <Text style={styles.ctCreateBtnText}>Done</Text>
              </TouchableOpacity>
            )}

            {/* Location */}
            <Text style={styles.ctLabel}>Location</Text>
            <View style={styles.ctLocationBox}>
              <TextInput style={{ flex: 1, fontSize: 13, color: '#0f172a' }} placeholder="Search or tap pin for GPS" placeholderTextColor="#94a3b8" value={location} onChangeText={setLocation} />
              <TouchableOpacity onPress={handleFetchLocation} activeOpacity={0.7} disabled={fetchingLocation}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke={fetchingLocation ? '#94a3b8' : '#0d9488'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  <Circle cx={12} cy={10} r={3} stroke={fetchingLocation ? '#94a3b8' : '#0d9488'} strokeWidth={2} />
                </Svg>
              </TouchableOpacity>
            </View>

            {/* Upload Docs */}
            <TouchableOpacity style={styles.ctRow} onPress={handleUploadDocs} activeOpacity={0.8}>
              <View style={styles.ctRowLeft}>
                <View style={styles.ctRowIcon}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
                <View>
                  <Text style={styles.ctRowText}>Upload Docs</Text>
                  <Text style={styles.ctRowSub}>(PDF, JPG, PNG)</Text>
                </View>
              </View>
              {uploadedDocs.length > 0 && (
                <View style={styles.ctCountBadge}>
                  <Text style={styles.ctCountBadgeText}>{uploadedDocs.length} file{uploadedDocs.length > 1 ? 's' : ''}</Text>
                </View>
              )}
            </TouchableOpacity>
            {uploadedDocs.map((doc, i) => (
              <View key={i} style={styles.ctDocChip}>
                <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                  <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={styles.ctDocChipText} numberOfLines={1}>{doc}</Text>
                <TouchableOpacity onPress={() => setUploadedDocs(p => p.filter((_, j) => j !== i))}>
                  <View style={styles.ctDocRemove}>
                    <Svg width={9} height={9} viewBox="0 0 24 24" fill="none">
                      <Path d="M18 6L6 18M6 6l12 12" stroke="#ef4444" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </View>
                </TouchableOpacity>
              </View>
            ))}

            {/* Extract Docs from Email */}
            <TouchableOpacity style={styles.ctRow} onPress={() => setShowEmailModal(true)} activeOpacity={0.8}>
              <View style={styles.ctRowLeft}>
                <View style={styles.ctRowIcon}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M22 6l-10 7L2 6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
                <Text style={styles.ctRowText}>Extract Docs from Email</Text>
              </View>
            </TouchableOpacity>

            {/* Add Reminders */}
            <View style={styles.ctRow}>
              <View style={styles.ctRowLeft}>
                <View style={styles.ctRowIcon}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
                <Text style={styles.ctRowText}>Add Reminders</Text>
              </View>
              <Switch value={reminders} onValueChange={setReminders} trackColor={{ false: '#cbd5e1', true: '#0d9488' }} thumbColor="#fff" />
            </View>

            {/* Invite Group Members */}
            <TouchableOpacity style={styles.ctRow} onPress={() => setShowInviteModal(true)} activeOpacity={0.8}>
              <View style={styles.ctRowLeft}>
                <View style={styles.ctRowIcon}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M12 7a4 4 0 100 8 4 4 0 000-8zM20 8v6M23 11h-6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
                <Text style={styles.ctRowText}>Invite Group Members</Text>
              </View>
              {selectedFriendIds.length > 0 && (
                <View style={styles.ctCountBadge}>
                  <Text style={styles.ctCountBadgeText}>{selectedFriendIds.length} invited</Text>
                </View>
              )}
            </TouchableOpacity>

          </ScrollView>

          {/* ── Footer (sticky bottom) ── */}
          <View style={styles.ctFooter}>
            <TouchableOpacity onPress={() => { reset(); onClose(); }} activeOpacity={0.7}>
              <Text style={styles.ctCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.ctCreateBtn, isSubmitting && { opacity: 0.6 }]} onPress={handleSave} disabled={isSubmitting} activeOpacity={0.85}>
              <Text style={styles.ctCreateBtnText}>{isSubmitting ? 'Creating...' : 'Create Trip'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Invite Members Sub-Modal ── */}
        {showInviteModal && (
          <Modal visible transparent animationType="fade" onRequestClose={() => setShowInviteModal(false)}>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalDialog, { maxHeight: '85%' }]}>
                <View style={[styles.ctHeader, { backgroundColor: '#f0fdfa' }]}>
                  <Text style={styles.ctTitle}>Invite Members</Text>
                  <TouchableOpacity onPress={() => setShowInviteModal(false)} style={styles.ctCloseBtn} activeOpacity={0.7}>
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                      <Path d="M18 6L6 18M6 6l12 12" stroke="#64748b" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </TouchableOpacity>
                </View>
                <View style={styles.inviteTabBar}>
                  <TouchableOpacity style={[styles.inviteTab, memberTab === 'friends' && styles.inviteTabActive]} onPress={() => setMemberTab('friends')}>
                    <Text style={[styles.inviteTabText, memberTab === 'friends' && styles.inviteTabTextActive]}>Friends</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.inviteTab, memberTab === 'new' && styles.inviteTabActive]} onPress={() => setMemberTab('new')}>
                    <Text style={[styles.inviteTabText, memberTab === 'new' && styles.inviteTabTextActive]}>Invite New</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={{ padding: 14 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {memberTab === 'friends' && (
                    <>
                      <TextInput style={[styles.ctInput, { marginBottom: 12 }]} placeholder="Search friends..." placeholderTextColor="#94a3b8" value={friendSearch} onChangeText={setFriendSearch} />
                      {filteredFriends.map(friend => {
                        const sel = selectedFriendIds.includes(friend.id);
                        return (
                          <TouchableOpacity key={friend.id} style={[styles.friendSelectRow, sel && { backgroundColor: '#f0fdfa' }]} onPress={() => toggleFriend(friend.id)} activeOpacity={0.8}>
                            <Image source={{ uri: friend.uri }} style={styles.friendSelectAvatar as any} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.friendName}>{friend.name}</Text>
                              <Text style={[styles.friendHandle, { fontSize: 12 }]}>{friend.email}</Text>
                            </View>
                            {sel && (
                              <View style={styles.checkCircle}>
                                <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
                                  <Path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                                </Svg>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  )}
                  {memberTab === 'new' && (
                    <>
                      <Text style={[styles.ctLabel, { marginTop: 0 }]}>Email Address</Text>
                      <TextInput style={styles.ctInput} placeholder="Enter email address" placeholderTextColor="#94a3b8" value={inviteEmail} onChangeText={setInviteEmail} keyboardType="email-address" autoCapitalize="none" />
                      <TouchableOpacity style={[styles.ctCreateBtn, { alignSelf: 'stretch', marginTop: 8 }]} onPress={() => { if (inviteEmail.trim()) { Alert.alert('Invite sent!', `Invitation sent to ${inviteEmail}`); setInviteEmail(''); } }} activeOpacity={0.85}>
                        <Text style={styles.ctCreateBtnText}>Send Invitation</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </ScrollView>
                <View style={styles.ctFooter}>
                  <TouchableOpacity style={[styles.ctCreateBtn, { flex: 1 }]} onPress={() => setShowInviteModal(false)} activeOpacity={0.85}>
                    <Text style={styles.ctCreateBtnText}>Done ({selectedFriendIds.length} selected)</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* ── Extract from Email Sub-Modal ── */}
        {showEmailModal && (
          <Modal visible transparent animationType="fade" onRequestClose={() => setShowEmailModal(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalDialog}>
                <View style={styles.ctHeader}>
                  <Text style={styles.ctTitle}>Extract from Email</Text>
                  <TouchableOpacity onPress={() => setShowEmailModal(false)} style={styles.ctCloseBtn} activeOpacity={0.7}>
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                      <Path d="M18 6L6 18M6 6l12 12" stroke="#64748b" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </TouchableOpacity>
                </View>
                <View style={{ padding: 20, alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center' }}>
                    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                      <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="#f97316" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      <Path d="M22 6l-10 7L2 6" stroke="#f97316" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#0f172a' }}>Connect Your Email</Text>
                  <Text style={{ fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 19 }}>
                    We'll extract flight tickets, hotel bookings, and other travel documents automatically.
                  </Text>
                  <View style={{ backgroundColor: '#fff7ed', borderRadius: 12, borderWidth: 1.5, borderColor: '#fed7aa', padding: 12, width: '100%' }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#92400e' }}>📧 Demo Mode</Text>
                    <Text style={{ fontSize: 11, color: '#b45309', marginTop: 3 }}>In production, this connects to Gmail/Outlook to extract attachments.</Text>
                  </View>
                </View>
                <View style={[styles.ctFooter, { gap: 10 }]}>
                  <TouchableOpacity style={[styles.ctCreateBtn, { flex: 1, backgroundColor: '#f1f5f9' }]} onPress={() => setShowEmailModal(false)} activeOpacity={0.85}>
                    <Text style={[styles.ctCreateBtnText, { color: '#0f172a' }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.ctCreateBtn, { flex: 1, backgroundColor: '#ea580c' }]} onPress={() => { setShowEmailModal(false); Alert.alert('Success', 'Extracted 2 documents from email!'); }} activeOpacity={0.85}>
                    <Text style={styles.ctCreateBtnText}>Extract Docs</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}
      </View>
    </Modal>
  );
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
  const [showCreateTrip, setShowCreateTrip] = useState(false);
  const [showTripMenu, setShowTripMenu] = useState<string | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(false);
  const [tripsPage, setTripsPage] = useState(1);
  const [hasMoreTrips, setHasMoreTrips] = useState(false);
  const [events] = useState(MOCK_EVENTS);

  const [insightIndex, setInsightIndex] = useState(0);
  const insightRef = useRef<FlatList>(null);
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

  // Load trips on mount
  useEffect(() => {
    loadTrips(1, true);
  }, []);

  async function loadTrips(page: number = 1, replace: boolean = false) {
    if (isLoadingTrips) return;
    setIsLoadingTrips(true);
    try {
      const data = await getTrips({ page, limit: 50 });
      const mapped = data.trips.map(mapApiTrip);
      setTrips(prev => replace ? mapped : [...prev, ...mapped]);
      setTripsPage(page);
      setHasMoreTrips(data.trips.length === 50);
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsLoadingTrips(false);
    }
  }

  const user = rawUser ? {
    fullName: rawUser.fullName ?? rawUser.full_name ?? '',
    email: rawUser.email ?? '',
    country: rawUser.country ?? '',
    bio: rawUser.bio ?? '',
    photoUrl: rawUser.photoUrl ?? rawUser.avatarUrl ?? rawUser.profile?.avatarUrl ?? '',
  } : null;

  const firstName = user?.fullName?.split(' ')[0] || 'Explorer';
  const { upcoming, ongoing, past } = categorizeTrips(trips);
  const upcomingEvents = events.filter(e => new Date(e.dateISO) >= new Date());

  function navigateToTrip(trip: Trip) { navigation.navigate('TripDetail', { trip }); }
  function navigateToChat(chat: any) { navigation.navigate('ChatDetail', { chat }); }

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
        onPress={() => setShowCreateTrip(true)}
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
        {/* Left arrow — always same teal style */}
        <TouchableOpacity
          style={[styles.insightArrowLeft, styles.insightArrowActive]}
          onPress={() => {
            if (insightIndex > 0) {
              const next = insightIndex - 1;
              setInsightIndex(next);
              insightRef.current?.scrollToIndex({ index: next, animated: true });
            }
          }}
          activeOpacity={0.8}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        {/* Right arrow — always same teal style */}
        <TouchableOpacity
          style={[styles.insightArrowRight, styles.insightArrowActive]}
          onPress={() => {
            if (insightIndex < TRAVEL_INSIGHTS.length - 1) {
              const next = insightIndex + 1;
              setInsightIndex(next);
              insightRef.current?.scrollToIndex({ index: next, animated: true });
            }
          }}
          activeOpacity={0.8}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M9 18l6-6-6-6" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
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
          </View>
          {ongoing.slice(0, 1).map(trip => (
            <TripCardFull
              key={trip.id}
              trip={trip}
              onPress={() => navigateToTrip(trip)}
              showMenu={showTripMenu === trip.id}
              onToggleMenu={() => toggleTripMenu(trip.id)}
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
              onDelete={() => deleteTrip(trip)}
            />
          ))}
        </>
      )}

      {/* No trips yet — friendly empty state */}
      {trips.length === 0 && (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconCircle}>
            <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
              <Path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          <Text style={styles.emptyStateTitle}>No trips yet</Text>
          <Text style={styles.emptyStateSubtitle}>Create your first trip and start planning with friends!</Text>
        </View>
      )}
    </ScrollView>
  );

  // ─── TRIPS TAB (All Trips: Upcoming + Ongoing + Past) ──────────────────────

  const renderTripsTab = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

      {/* Always-visible CTA section */}
      <View style={styles.tripsCTA}>
        <View style={styles.tripsPlaneCircle}>
          <PlaneIcon />
        </View>
        <Text style={styles.tripsCTATitle}>Gather & Go: Plan your next shared adventure!</Text>
        <Text style={styles.tripsCTASub}>Round up the squad and start planning</Text>
        <TouchableOpacity
          style={styles.createTripBtn}
          onPress={() => setShowCreateTrip(true)}
          activeOpacity={0.9}>
          <Text style={styles.createTripBtnText}>Create New Trip</Text>
        </TouchableOpacity>
      </View>

      {/* If trips exist */}
      {trips.length > 0 && (
        <>
          <View style={styles.tripsListHeader}>
            <Text style={styles.tripsListTitle}>Your Trips</Text>
            <Text style={styles.tripsListSub}>Manage all your adventures</Text>
          </View>

          {/* ACTIVE / ONGOING */}
          {ongoing.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>ACTIVE</Text>
              {ongoing.map(trip => (
                <TripCardFull
                  key={trip.id}
                  trip={trip}
                  onPress={() => navigateToTrip(trip)}
                  showMenu={showTripMenu === trip.id}
                  onToggleMenu={() => toggleTripMenu(trip.id)}
                  onDelete={() => deleteTrip(trip)}
                />
              ))}
            </>
          )}

          {/* UPCOMING */}
          {upcoming.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>UPCOMING</Text>
              {upcoming.map(trip => (
                <TripCardFull
                  key={trip.id}
                  trip={trip}
                  onPress={() => navigateToTrip(trip)}
                  showMenu={showTripMenu === trip.id}
                  onToggleMenu={() => toggleTripMenu(trip.id)}
                  onDelete={() => deleteTrip(trip)}
                />
              ))}
            </>
          )}

          {/* PAST — compact horizontal card */}
          {past.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>PAST</Text>
              {past.map(trip => (
                <TripCardPast
                  key={trip.id}
                  trip={trip}
                  onPress={() => navigateToTrip(trip)}
                  showMenu={showTripMenu === trip.id}
                  onToggleMenu={() => toggleTripMenu(trip.id)}
                  onDelete={() => deleteTrip(trip)}
                />
              ))}
            </>
          )}

          {/* ARCHIVED */}
        </>
      )}

      {/* Loading / empty states */}
      {isLoadingTrips && trips.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateSubtitle}>Loading your trips...</Text>
        </View>
      )}
      {!isLoadingTrips && trips.length === 0 && (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconCircle}>
            <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
              <Path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          <Text style={styles.emptyStateTitle}>No trips yet</Text>
          <Text style={styles.emptyStateSubtitle}>Tap "Create New Trip" to plan your first adventure!</Text>
        </View>
      )}

      {/* Load More */}
      {hasMoreTrips && !isLoadingTrips && (
        <TouchableOpacity
          style={[styles.createTripBtn, { marginTop: 8, marginBottom: 16, backgroundColor: '#f0fdfa' }]}
          onPress={() => loadTrips(tripsPage + 1, false)}
          activeOpacity={0.8}>
          <Text style={[styles.createTripBtnText, { color: '#0d9488' }]}>Load More</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );

  // ─── EVENTS TAB ────────────────────────────────────────────────────────────

  const renderEventsTab = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      <View style={styles.tabHeaderRow}>
        <Text style={styles.tabScreenTitle}>Events</Text>
        <TouchableOpacity style={styles.fabInline} onPress={() => Alert.alert('Events', 'Create event coming soon')} activeOpacity={0.85}>
          <PlusIcon size={16} />
          <Text style={styles.fabInlineText}>New Event</Text>
        </TouchableOpacity>
      </View>

      {upcomingEvents.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>UPCOMING</Text>
          {upcomingEvents.map(ev => (
            <EventCard key={ev.id} event={ev} onPress={() => {}} onMore={() => {}} />
          ))}
        </>
      )}

      {upcomingEvents.length === 0 && (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconCircle, { backgroundColor: '#fff7ed' }]}>
            <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
              <Rect x={3} y={4} width={18} height={18} rx={2} ry={2} stroke="#f97316" strokeWidth={1.5} />
              <Path d="M16 2v4M8 2v4M3 10h18" stroke="#f97316" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          <Text style={styles.emptyStateTitle}>No events yet</Text>
          <Text style={styles.emptyStateSubtitle}>Create an event and invite your crew!</Text>
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
          <TouchableOpacity onPress={() => setShowCreateTrip(true)}>
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
        <TouchableOpacity style={styles.dropdownItem} onPress={() => { setShowProfileMenu(false); navigation.navigate('Notifications'); }}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.dropdownItemText}>Notifications</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dropdownItem} onPress={() => setShowProfileMenu(false)}>
          <SettingsIcon />
          <Text style={styles.dropdownItemText}>Settings</Text>
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
        {activeTab === 'trips' && renderTripsTab()}
        {activeTab === 'events' && renderEventsTab()}
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

        <CreateTripModal
          visible={showCreateTrip}
          onClose={() => setShowCreateTrip(false)}
          onSave={async (data: any) => {
            // Step 1: Create trip without bannerImageUrl (local URIs are rejected by API)
            const res = await apiCreateTrip({
              name: data.name,
              startDate: data.startDateISO ?? data.startDate ?? '',
              endDate: data.endDateISO ?? data.endDate ?? '',
              location: { name: data.location || 'TBD' },
              friendIds: data.friendIds?.length ? data.friendIds : undefined,
              emails: data.inviteEmail ? [data.inviteEmail] : undefined,
            });
            let newTrip = res.trip;
            // Step 2: If banner image selected, upload it and update trip with CDN URL
            if (data.bannerImageUrl && data.bannerImageUrl.startsWith('file')) {
              try {
                const photoRes = await uploadTripPhotos(newTrip.id, [{
                  uri: data.bannerImageUrl,
                  type: 'image/jpeg',
                  name: 'banner.jpg',
                }]);
                const cdnUrl = photoRes.photos?.[0]?.url;
                if (cdnUrl) {
                  const updated = await apiUpdateTrip(newTrip.id, { bannerImageUrl: cdnUrl });
                  newTrip = updated.trip;
                }
              } catch { /* banner upload failed — trip still created */ }
            }
            setTrips(p => [mapApiTrip(newTrip), ...p]);
          }}
        />
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
  profileDropdown: { position: 'absolute', top: 70, right: 20, width: 240, backgroundColor: '#fff', borderRadius: 16, padding: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 8, borderWidth: 1, borderColor: '#f1f5f9' },
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
