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
  TextInput,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';
import {
  Search,
  Sparkles,
  PlaneTakeoff,
  CalendarPlus,
  HelpCircle,
  Compass,
  Settings2,
  MapPin as LucideMapPin,
  Calendar as LucideCalendar,
  MoreVertical,
  ChevronLeft,
  PartyPopper,
} from 'lucide-react-native';
import BlobBackground from '../../components/common/BlobBackground';
import AppHeader from '../../components/common/AppHeader';
import useAuthStore from '../../store/authStore';
import useAuth from '../../hooks/useAuth';
import {
  getTrips,
  createTrip as apiCreateTrip,
  uploadTripPhotos,
  updateTrip as apiUpdateTrip,
  archiveTrip as archiveTripApi,
  deleteTrip as apiDeleteTrip,
  handleApiError,
} from '../../api/trips.api';
import { getEvents, createEvent as apiCreateEvent, archiveEvent as apiArchiveEvent, deleteEvent as apiDeleteEvent } from '../../api/events.api';
import { API_BASE } from '../../api/client';
import Toast from 'react-native-toast-message';
import TripsScreen, { CreateTripModal, BannerCropFraction as TripBannerCropFraction } from '../trips/TripsScreen';
import EventsScreen, { CreateEventModal } from '../events/EventsScreen';
import FriendsTab from './FriendsTab';
import ChatTab, { SWEE_CHAT } from './ChatTab';
import GalleryTab from './GalleryTab';
import ProfileDropdown from './ProfileDropdown';
import StackedAvatars from '../../components/common/StackedAvatars';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const INSIGHT_IMG_H = SCREEN_H < 700 ? 140 : SCREEN_H < 800 ? 160 : 192;

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
  bannerCropFraction?: { imgFracX: number; imgFracY: number; imgFracW: number; imgFracH: number } | null;
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

const SparklesIcon = ({ size = 24, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M9.937 15.5A2 2 0 008.5 14.063l-6.135-1.582a.5.5 0 010-.962L8.5 9.937A2 2 0 009.937 8.5l1.582-6.135a.5.5 0 01.963 0L14.063 8.5A2 2 0 0015.5 9.937l6.135 1.582a.5.5 0 010 .963L15.5 14.063A2 2 0 0014.063 15.5l-1.582 6.135a.5.5 0 01-.963 0z"
      stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
    />
    <Path d="M20 3v4M22 5h-4M4 17v2M5 18H3" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
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
            <StackedAvatars
              avatars={trip.members}
              totalCount={trip.members.length + trip.extraMembers}
              counterStyle="soft"
              size={22}
            />
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
    bannerCropFraction: t.bannerCropFraction ?? null,
    members: (t.memberAvatars || []).slice(0, 4).map((uri: string, idx: number) => ({ id: `av-${idx}`, uri })),
    extraMembers: (t.memberAvatars || []).length === 0
      ? (t.memberCount ?? 0)
      : Math.max(0, (t.memberCount ?? 0) - Math.min((t.memberAvatars || []).length, 4)),
  };
}



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

export default function HomeScreen({ navigation, route }: any) {
  const { logout, refreshProfile } = useAuth();
  const rawUser = useAuthStore((s) => s.user) as any;
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showTripMenu, setShowTripMenu] = useState<string | null>(null);
  const [showEventMenu, setShowEventMenu] = useState<string | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(false);
  const [triggerCreateTrip, setTriggerCreateTrip] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);

  // Home-screen modal overlays (no tab switch)
  const [showCreateTripModal, setShowCreateTripModal] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);

  // Lifted banner state for CreateTripModal
  const [tripBannerUri, setTripBannerUri] = useState<string | undefined>(undefined);
  const [tripBannerType, setTripBannerType] = useState<string>('image/jpeg');
  const [tripBannerCrop, setTripBannerCrop] = useState<TripBannerCropFraction | null>(null);

  // Blogs + Deals for home feed
  const [blogs, setBlogs] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [blogsLoading, setBlogsLoading] = useState(true);
  const [dealsLoading, setDealsLoading] = useState(true);

  // Blog detail modal
  const [blogDetailVisible, setBlogDetailVisible] = useState(false);
  const [selectedBlog, setSelectedBlog] = useState<any>(null);

  // Upcoming events for home feed
  const [homeEvents, setHomeEvents] = useState<any[]>([]);

  // Carousel dot indices
  const [blogIndex, setBlogIndex] = useState(0);
  const [dealIndex, setDealIndex] = useState(0);
  const blogListRef = useRef<FlatList>(null);
  const blogIndexRef = useRef(0);
  const blogResettingRef = useRef(false);


  // Refresh profile on mount so name/avatar are always up to date
  useEffect(() => {
    refreshProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch blogs + deals once on mount (they don't change with archive/delete)
  useEffect(() => {
    async function fetchStaticHomeData() {
      try {
        setBlogsLoading(true);
        const blogsRes = await fetch(`${API_BASE}/blogs`);
        if (blogsRes.ok) setBlogs(await blogsRes.json());
      } catch { /* silently fall back to empty */ } finally { setBlogsLoading(false); }
      try {
        setDealsLoading(true);
        const dealsRes = await fetch(`${API_BASE}/deals`);
        if (dealsRes.ok) setDeals(await dealsRes.json());
      } catch { /* silently fall back to empty */ } finally { setDealsLoading(false); }
    }
    fetchStaticHomeData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll Get Inspired carousel every 3 seconds — true circular loop.
  // Data = [...blogs, blogs[0]] (clone of first item appended).
  // Sequence: 0 → 1 → 2 → … → N(clone, animated) → [silent snap to 0] → 1 → …
  // blogIndexRef is a plain mutable ref so the interval closure never goes stale.
  // The snap-back uses scrollToIndex (not scrollToOffset) so padding is accounted for.
  useEffect(() => {
    if (blogs.length < 2) return;
    blogIndexRef.current = 0;
    setBlogIndex(0);

    const timer = setInterval(() => {
      const next = blogIndexRef.current + 1;
      blogIndexRef.current = next;

      // Scroll forward (animated). If next === blogs.length we're on the clone.
      blogListRef.current?.scrollToIndex({ index: next, animated: true });
      setBlogIndex(next >= blogs.length ? 0 : next);

      if (next === blogs.length) {
        // After the forward-scroll animation settles, silently jump to real index 0.
        // Use scrollToIndex so getItemLayout handles the paddingLeft offset correctly.
        setTimeout(() => {
          blogResettingRef.current = true;
          blogIndexRef.current = 0;
          blogListRef.current?.scrollToIndex({ index: 0, animated: false });
          setBlogIndex(0);
          // Clear the flag after a short delay so normal user swipes work again
          setTimeout(() => { blogResettingRef.current = false; }, 100);
        }, 500);
      }
    }, 3000);

    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blogs.length]);

  // Handle initialTab param when returning from detail screens
  useEffect(() => {
    if (route?.params?.initialTab) {
      setActiveTab(route.params.initialTab as Tab);
      navigation.setParams({ initialTab: undefined });
    }
  }, [route?.params?.initialTab, navigation]);

  // Load trips AND upcoming events on mount AND every time screen gains focus
  // so archive/delete actions in Events/Trips tabs are immediately reflected here
  const loadTripsRef = useRef<() => void>(() => {});
  const loadHomeDataRef = useRef<() => void>(() => {});

  useFocusEffect(useCallback(() => {
    loadTripsRef.current();
    loadHomeDataRef.current();
  }, []));

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

  async function loadHomeEvents() {
    try {
      const evRes = await getEvents({ status: 'upcoming', limit: 10 });
      setHomeEvents(evRes.events);
    } catch { /* silently fall back to empty */ }
  }

  // Always keep refs pointing at latest functions (avoids stale closure in useFocusEffect)
  loadTripsRef.current = () => loadTrips(1, true);
  loadHomeDataRef.current = () => loadHomeEvents();

  const user = rawUser ? {
    id: rawUser.id ?? rawUser.sub ?? '',
    fullName: rawUser.fullName ?? rawUser.full_name ?? '',
    username: rawUser.username ?? '',
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
    setShowEventMenu(null);
    setShowTripMenu(prev => prev === id ? null : id);
  }

  function toggleEventMenu(id: string) {
    setShowTripMenu(null);
    setShowEventMenu(prev => prev === id ? null : id);
  }

  function archiveHomeEvent(ev: any) {
    setShowEventMenu(null);
    Alert.alert('Archive Event', `Archive "${ev.name}"? You can restore it anytime.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive', onPress: async () => {
          try {
            await apiArchiveEvent(ev.id);
            setHomeEvents(p => p.filter(e => e.id !== ev.id));
          } catch (err) { handleApiError(err); }
        },
      },
    ]);
  }

  function deleteHomeEvent(ev: any) {
    setShowEventMenu(null);
    Alert.alert('Delete Event?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await apiDeleteEvent(ev.id);
            setHomeEvents(p => p.filter(e => e.id !== ev.id));
          } catch (err) { handleApiError(err); }
        },
      },
    ]);
  }

  function navigateToEventDetail(ev: any) {
    const locName = typeof ev.location === 'string' ? ev.location : (ev.location?.name ?? '');
    navigation.navigate('EventDetail', {
      event: {
        id: ev.id, name: ev.name,
        type: ev.eventType ?? ev.type ?? 'Other',
        typeColor: ev.typeColor ?? '#f8fafc',
        location: locName,
        fullDate: fmtFullDate(ev.eventDate ?? ''),
        daysToGo: daysUntil(ev.eventDate ?? ''),
        description: ev.description ?? '',
      },
    });
  }

  // ─── Home-feed constants ────────────────────────────────────────────────────
  const H_PAD = 16;
  const CARD_BLOG_W      = SCREEN_W * 0.485;  // ≈182px on 375px — Figma exact
  const CARD_BLOG_H      = SCREEN_W * 0.362;  // ≈136px on 375px — Figma exact
  const CARD_BLOG_TEXT_H = SCREEN_W * 0.08;   // ≈30px — black title strip
  const CARD_DEAL_W      = SCREEN_W * 0.317;  // ≈119px on 375px — Figma exact
  const CARD_DEAL_H      = SCREEN_W * 0.304;  // ≈114px on 375px — Figma exact
  const DEAL_BG_COLORS   = ['#ffffff', '#ffffff', '#ffffff'];

  // ─── Reusable home-feed sub-components ─────────────────────────────────────

  const SectionHeader = ({
    icon,
    title,
    color = '#1a1a2e',
  }: {
    icon: React.ReactNode;
    title: string;
    color?: string;
  }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: H_PAD, marginTop: 24, marginBottom: 12 }}>
      {icon}
      <Text style={{ fontSize: 16, fontWeight: '700', color }}>{title}</Text>
    </View>
  );

  const CarouselDots = ({ total, active }: { total: number; active: number }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, marginTop: 10, marginBottom: 2 }}>
      {Array.from({ length: Math.min(total, 5) }).map((_, i) => (
        <View
          key={i}
          style={{
            width: i === active ? 16 : 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i === active ? '#0d9488' : '#D1CBC0',
          }}
        />
      ))}
    </View>
  );

  // Shared compact card used by both Upcoming Trips and Upcoming Events
  function HomeCompactCard({
    title, imageSource, line1Icon, line1Text,
    line2Icon, line2Text, members, extraMembers, onMorePress, onPress,
  }: {
    title: string; imageSource: any;
    line1Icon: React.ReactNode; line1Text: string;
    line2Icon: React.ReactNode; line2Text: string;
    members?: { id: string; uri: string }[]; extraMembers?: number;
    onMorePress?: () => void; onPress?: () => void;
  }) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.87}
        style={{
          backgroundColor: '#fff',
          borderRadius: 16,
          marginHorizontal: H_PAD,
          marginBottom: 10,
          paddingVertical: 12,
          paddingHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
          elevation: 2,
        }}>
        {/* Thumbnail */}
        <Image
          source={imageSource}
          style={{ width: 72, height: 72, borderRadius: 12, flexShrink: 0 }}
          resizeMode="cover"
        />
        {/* Middle: title + two info rows */}
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#1a1a2e', lineHeight: 20 }} numberOfLines={1}>{title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {line1Icon}
            <Text style={{ fontSize: 12, color: '#64748b', flex: 1 }} numberOfLines={1}>{line1Text}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {line2Icon}
            <Text style={{ fontSize: 12, color: '#64748b', flex: 1 }} numberOfLines={1}>{line2Text}</Text>
          </View>
        </View>
        {/* Right: avatars cluster + three-dot, all in one row, vertically centred */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <StackedAvatars
            avatars={members ?? []}
            totalCount={(members?.length ?? 0) + (extraMembers ?? 0)}
            counterStyle="soft"
            size={26}
          />
          {/* Three-dot button — same row as avatars, horizontally centred with card */}
          <TouchableOpacity
            onPress={onMorePress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' }}>
            <MoreVertical size={15} color="#64748b" strokeWidth={1.8} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  // ─── HOME TAB (Main Dashboard) ─────────────────────────────────────────────

  const renderHomeTab = () => (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
        onScrollBeginDrag={() => { setShowTripMenu(null); setShowEventMenu(null); }}
      >
        {/* Tap-outside backdrop — inside ScrollView so it shares stacking context with menus */}
        {(showTripMenu !== null || showEventMenu !== null) && (
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}
            onPress={() => { setShowTripMenu(null); setShowEventMenu(null); }}
          />
        )}
        {/* ── 1. Welcome ── */}
        <Text style={{
          fontWeight: '500',
          fontSize: 24,
          lineHeight: 32,
          color: '#45556C',
          textAlign: 'center',
          marginTop: 12,
        }}>
          Welcome, {firstName}!
        </Text>
        <Text style={{
          fontSize: 15,
          color: '#45556C',
          fontWeight: '400',
          textAlign: 'left',
          marginTop: 6,
          marginBottom: 14,
          paddingHorizontal: H_PAD,
        }}>
          Ready for your next trip?
        </Text>

        {/* ── 2. Search Bar ── */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          height: 48,
          borderRadius: 999,
          borderWidth: 1.5,
          borderColor: '#E0DBD3',
          backgroundColor: '#fff',
          marginHorizontal: H_PAD,
          paddingHorizontal: 12,
          gap: 8,
        }}>
          <Search size={18} color="#94a3b8" />
          <TextInput
            style={{ flex: 1, fontSize: 14, color: '#1a1a2e', paddingVertical: 0 }}
            placeholder="Where should we go?"
            placeholderTextColor="#94a3b8"
          />
          <TouchableOpacity
            onPress={() => navigateToChat(SWEE_CHAT)}
            activeOpacity={0.85}
            style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: '#009788', borderRadius: 999,
              paddingHorizontal: 12, paddingVertical: 7, gap: 5,
            }}>
            <Sparkles size={13} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Ask Swee</Text>
          </TouchableOpacity>
        </View>

        {/* ── 3. Action Buttons Row — all 3 in one row, flex:1 each ── */}
        <View style={{ flexDirection: 'row', marginHorizontal: H_PAD, marginTop: 12, gap: 8, paddingVertical: 6 }}>
          <TouchableOpacity
            onPress={() => setShowCreateTripModal(true)}
            activeOpacity={0.85}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#009788', borderRadius: 999, paddingVertical: 9, gap: 5 }}>
            <PlaneTakeoff size={15} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '500' }}>Create Trip</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowCreateEventModal(true)}
            activeOpacity={0.85}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#61BFCE', borderRadius: 999, paddingVertical: 9, gap: 5 }}>
            <CalendarPlus size={15} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '500' }}>Create Event</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFA76A', borderRadius: 999, paddingVertical: 9, gap: 5 }}>
            <HelpCircle size={15} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '500' }}>How it works</Text>
          </TouchableOpacity>
        </View>

        {/* ── 4. Get Inspired (Blogs Carousel) ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: H_PAD, marginTop: 20, marginBottom: 10 }}>
          <Compass size={19} color="#000000" strokeWidth={1.8} />
          <Text style={{ fontSize: 14, fontWeight: '500', color: '#0F172B' }}>Get Inspired</Text>
        </View>
        {blogsLoading ? (
          <View style={{ flexDirection: 'row', paddingLeft: H_PAD, gap: 10 }}>
            {[0, 1].map(i => (
              <View key={i} style={{ width: CARD_BLOG_W, height: CARD_BLOG_H, borderRadius: 14, backgroundColor: '#E8E4DF' }} />
            ))}
          </View>
        ) : blogs.length === 0 ? (
          <Text style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', marginTop: 4 }}>No blogs available</Text>
        ) : (
          <>
            <FlatList
              ref={blogListRef}
              data={blogs.length > 0 ? [...blogs, blogs[0]] : blogs}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_BLOG_W + 10}
              snapToAlignment="start"
              decelerationRate="fast"
              contentContainerStyle={{ paddingLeft: H_PAD, paddingRight: 6 }}
              keyExtractor={(item: any, index: number) => `${item.id}-${index}`}
              getItemLayout={(_: any, index: number) => ({
                length: CARD_BLOG_W + 10,
                offset: (CARD_BLOG_W + 10) * index,
                index,
              })}
              onMomentumScrollEnd={e => {
                if (blogResettingRef.current) return;
                const idx = Math.round(e.nativeEvent.contentOffset.x / (CARD_BLOG_W + 10));
                const clamped = idx >= blogs.length ? 0 : idx;
                blogIndexRef.current = clamped;
                setBlogIndex(clamped);
              }}
              renderItem={({ item }: { item: any }) => {
                const imgUri = item.imageUrl ?? item.image_url ?? item.coverImage ?? item.thumbnail ?? item.image;
                return (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => { setSelectedBlog(item); setBlogDetailVisible(true); }}
                    style={{ width: CARD_BLOG_W, height: CARD_BLOG_H, borderRadius: 14, overflow: 'hidden', marginRight: 10 }}>
                    {/* Full-bleed background image */}
                    {imgUri ? (
                      <Image
                        source={{ uri: imgUri }}
                        style={{ width: '100%', height: '100%', position: 'absolute' }}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={{ width: '100%', height: '100%', position: 'absolute', backgroundColor: '#E8E4DF' }} />
                    )}
                    {/* 75% opacity black strip at bottom — Figma exact */}
                    <View style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      height: CARD_BLOG_TEXT_H,
                      backgroundColor: 'rgba(0,0,0,0.75)',
                      justifyContent: 'center',
                      paddingHorizontal: 8,
                    }}>
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600', lineHeight: 14 }} numberOfLines={1}>
                        {item.title}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
            <CarouselDots total={blogs.length} active={blogIndex >= blogs.length ? 0 : blogIndex} />
          </>
        )}

        {/* ── 5. Explore Amazing Deals — horizontal scrollable carousel ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: H_PAD, marginTop: 24, marginBottom: 12 }}>
          <Settings2 size={19} color="#000000" strokeWidth={1.8} />
          <Text style={{ fontSize: 14, fontWeight: '500', color: '#0F172B' }}>Explore Amazing Deals</Text>
        </View>
        {dealsLoading ? (
          <View style={{ flexDirection: 'row', paddingLeft: H_PAD, gap: 10 }}>
            {[0, 1, 2].map(i => (
              <View key={i} style={{ width: CARD_DEAL_W, height: CARD_DEAL_H, borderRadius: 14, backgroundColor: '#E8E4DF' }} />
            ))}
          </View>
        ) : deals.length === 0 ? (
          <Text style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', marginTop: 4 }}>No deals available</Text>
        ) : (
          <>
            <FlatList
              data={deals}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_DEAL_W + 10}
              snapToAlignment="start"
              decelerationRate="fast"
              contentContainerStyle={{ paddingLeft: H_PAD, paddingRight: 6 }}
              keyExtractor={(item: any) => String(item.id)}
              onMomentumScrollEnd={e => {
                setDealIndex(Math.round(e.nativeEvent.contentOffset.x / (CARD_DEAL_W + 10)));
              }}
              renderItem={({ item, index }: { item: any; index: number }) => {
                const imgUri = item.imageUrl ?? item.image_url ?? item.coverImage ?? item.thumbnail ?? item.image;
                // Figma exact: image area 115×68 px on 375px screen
                const IMG_H = SCREEN_W * 0.181; // ≈68px
                return (
                  <TouchableOpacity
                    activeOpacity={0.87}
                    style={{
                      width: CARD_DEAL_W,         // SCREEN_W * 0.317 ≈ 119px
                      borderRadius: 14,
                      backgroundColor: item.bgColor || DEAL_BG_COLORS[index % 3],
                      alignItems: 'center',
                      paddingTop: 10,
                      paddingBottom: 10,
                      paddingHorizontal: 8,
                      marginRight: 10,
                    }}>
                    {/* Image container — rounded with overflow clip */}
                    <View style={{
                      width: '100%',
                      height: IMG_H,
                      borderRadius: 10,
                      overflow: 'hidden',
                      backgroundColor: 'transparent',
                    }}>
                      {imgUri ? (
                        <Image
                          source={{ uri: imgUri }}
                          style={{ width: '100%', height: '100%' }}
                          resizeMode="contain"
                        />
                      ) : null}
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#1a1a2e', textAlign: 'center', marginTop: 8 }} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {item.subtitle ? (
                      <Text style={{ fontSize: 10, color: '#64748b', textAlign: 'center', marginTop: 2 }} numberOfLines={1}>
                        {item.subtitle}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              }}
            />
            <CarouselDots total={deals.length} active={dealIndex} />
          </>
        )}

        {/* ── 6. Upcoming Trips ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: H_PAD, marginTop: 24, marginBottom: 10 }}>
          <LucideMapPin size={19} color="#000000" strokeWidth={1.8} />
          <Text style={{ fontSize: 14, fontWeight: '500', color: '#0F172B' }}>Upcoming Trips</Text>
        </View>
        {[...ongoing, ...upcoming].length === 0 && !isLoadingTrips ? (
          <Text style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', marginTop: 4 }}>No upcoming trips</Text>
        ) : (
          [...ongoing, ...upcoming].slice(0, 3).map(trip => (
            <View key={trip.id} style={{ zIndex: showTripMenu === trip.id ? 100 : 1 }}>
              <HomeCompactCard
                title={trip.name}
                imageSource={trip.bannerImageUrl ? { uri: trip.bannerImageUrl } : trip.image}
                line1Icon={<LucideMapPin size={12} color="#0d9488" strokeWidth={1.8} />}
                line1Text={trip.location}
                line2Icon={<LucideCalendar size={12} color="#f97316" strokeWidth={1.8} />}
                line2Text={`${trip.startDate} - ${trip.endDate}`}
                members={trip.members}
                extraMembers={trip.extraMembers}
                onMorePress={() => toggleTripMenu(trip.id)}
                onPress={() => navigateToTrip(trip)}
              />
              {showTripMenu === trip.id && (
                <View style={styles.tripMenuDropdown}>
                  <TouchableOpacity style={styles.tripMenuItem} onPress={() => archiveTrip(trip)} activeOpacity={0.8}>
                    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                      <Path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <Text style={styles.tripMenuItemText}>Archive Trip</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.tripMenuItem, { borderTopWidth: 1, borderTopColor: '#f1f5f9' }]} onPress={() => deleteTrip(trip)} activeOpacity={0.8}>
                    <TrashIcon />
                    <Text style={[styles.tripMenuItemText, { color: '#ef4444' }]}>Delete Trip</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}

        {/* ── 7. Upcoming Events ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: H_PAD, marginTop: 24, marginBottom: 10 }}>
          <PartyPopper size={19} color="#000000" strokeWidth={1.8} />
          <Text style={{ fontSize: 14, fontWeight: '500', color: '#0F172B' }}>Upcoming Events</Text>
        </View>
        {homeEvents.length === 0 ? (
          <Text style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', marginTop: 4 }}>No upcoming events</Text>
        ) : (
          homeEvents.slice(0, 3).map((ev: any) => {
            const locName = typeof ev.location === 'string' ? ev.location : (ev.location?.name ?? '');
            const rawAvatars: string[] = (ev.memberAvatars || []).slice(0, 4);
            const avatars: { id: string; uri: string }[] = rawAvatars.map((uri: string, i: number) => ({ id: `ev-av-${i}`, uri }));
            const evExtra = rawAvatars.length === 0
              ? (ev.memberCount ?? 0)
              : Math.max(0, (ev.memberCount ?? 0) - rawAvatars.length);
            return (
              <View key={ev.id} style={{ zIndex: showEventMenu === ev.id ? 100 : 1 }}>
                <HomeCompactCard
                  title={ev.name}
                  imageSource={ev.bannerImageUrl ? { uri: ev.bannerImageUrl } : require('../../assets/images/goa_beach.png')}
                  line1Icon={<LucideMapPin size={12} color="#0d9488" strokeWidth={1.8} />}
                  line1Text={locName || 'Location TBD'}
                  line2Icon={<LucideCalendar size={12} color="#f97316" strokeWidth={1.8} />}
                  line2Text={fmtFullDate(ev.eventDate ?? '')}
                  members={avatars}
                  extraMembers={evExtra}
                  onMorePress={() => toggleEventMenu(ev.id)}
                  onPress={() => navigateToEventDetail(ev)}
                />
                {showEventMenu === ev.id && (
                  <View style={styles.tripMenuDropdown}>
                    <TouchableOpacity style={styles.tripMenuItem} onPress={() => archiveHomeEvent(ev)} activeOpacity={0.8}>
                      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                        <Path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                      <Text style={styles.tripMenuItemText}>Archive Event</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.tripMenuItem, { borderTopWidth: 1, borderTopColor: '#f1f5f9' }]} onPress={() => deleteHomeEvent(ev)} activeOpacity={0.8}>
                      <TrashIcon />
                      <Text style={[styles.tripMenuItemText, { color: '#ef4444' }]}>Delete Event</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ── Blog Detail Full-Screen Modal ── */}
      <Modal
        visible={blogDetailVisible}
        animationType="slide"
        onRequestClose={() => setBlogDetailVisible(false)}
        statusBarTranslucent>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
            <TouchableOpacity onPress={() => setBlogDetailVisible(false)} style={{ marginRight: 12 }}>
              <ChevronLeft size={24} color="#1a1a2e" />
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#1a1a2e', flex: 1 }} numberOfLines={1}>
              {selectedBlog?.title}
            </Text>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {(() => {
              const uri = selectedBlog?.imageUrl ?? selectedBlog?.image_url ?? selectedBlog?.coverImage ?? selectedBlog?.thumbnail ?? selectedBlog?.image;
              return uri ? (
                <Image source={{ uri }} style={{ width: '100%', height: SCREEN_W * 0.55 }} resizeMode="cover" />
              ) : (
                <View style={{ width: '100%', height: SCREEN_W * 0.55, backgroundColor: '#E8E4DF' }} />
              );
            })()}
            <View style={{ padding: 20 }}>
              {selectedBlog?.category && (
                <View style={{ backgroundColor: '#E0F7F4', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 12 }}>
                  <Text style={{ color: '#0d9488', fontSize: 12, fontWeight: '600' }}>{selectedBlog.category}</Text>
                </View>
              )}
              <Text style={{ fontSize: SCREEN_W < 360 ? 18 : 22, fontWeight: '700', color: '#1a1a2e', lineHeight: 30, marginBottom: 8 }}>
                {selectedBlog?.title}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                {selectedBlog?.authorAvatar && (
                  <Image source={{ uri: selectedBlog.authorAvatar }} style={{ width: 28, height: 28, borderRadius: 14 }} />
                )}
                <Text style={{ fontSize: 13, color: '#64748b' }}>
                  {selectedBlog?.author ?? selectedBlog?.authorName ?? ''}
                  {selectedBlog?.publishedAt ? `  ·  ${selectedBlog.publishedAt}` : ''}
                  {selectedBlog?.readTime ? `  ·  ${selectedBlog.readTime}` : ''}
                </Text>
              </View>
              <Text style={{ fontSize: 15, color: '#334155', lineHeight: 24 }}>
                {selectedBlog?.content ?? selectedBlog?.body ?? selectedBlog?.description ?? ''}
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── Create Trip Modal overlay — no tab switch ── */}
      <CreateTripModal
        visible={showCreateTripModal}
        onClose={() => setShowCreateTripModal(false)}
        bannerImageUri={tripBannerUri}
        setBannerImageUri={setTripBannerUri}
        bannerImageType={tripBannerType}
        setBannerImageType={setTripBannerType}
        bannerCropFraction={tripBannerCrop}
        setBannerCropFraction={setTripBannerCrop}
        onSave={async (data) => {
          const cropFraction = data.bannerCropFraction as TripBannerCropFraction | null;
          const res = await apiCreateTrip({
            name: data.name as string,
            startDate: (data.startDateISO ?? data.startDate ?? '') as string,
            endDate: (data.endDateISO ?? data.endDate ?? '') as string,
            location: { name: (data.location as string) || 'TBD' },
            friendIds: (data.friendIds as string[] | undefined)?.length ? data.friendIds as string[] : undefined,
            emails: data.inviteEmail ? [data.inviteEmail as string] : undefined,
            ...(cropFraction ? { bannerCropFraction: cropFraction } : {}),
          });
          let newTrip = res.trip;
          const localUri = data.bannerImageUrl as string | undefined;
          const isLocalUri = localUri && (localUri.startsWith('file://') || localUri.startsWith('content://'));
          if (isLocalUri) {
            setTrips(p => [{ ...mapApiTrip(newTrip), bannerImageUrl: localUri, bannerCropFraction: cropFraction || null }, ...p]);
            try {
              const photoRes = await uploadTripPhotos(newTrip.id, [{
                uri: localUri,
                type: (data.bannerImageType as string) ?? 'image/jpeg',
                name: `banner.${((data.bannerImageType as string) ?? 'image/jpeg').split('/')[1] ?? 'jpg'}`,
              }]);
              const photo = photoRes.photos?.[0];
              const permanentUrl = (photo as any)?.fileUrl ?? photo?.url;
              if (permanentUrl) {
                const updated = await apiUpdateTrip(newTrip.id, { bannerImageUrl: permanentUrl, ...(cropFraction ? { bannerCropFraction: cropFraction } : {}) });
                newTrip = updated.trip;
                setTrips(p => p.map(t => t.id === newTrip.id ? { ...t, bannerImageUrl: newTrip.bannerImageUrl ?? permanentUrl } : t));
              }
            } catch (e) { console.warn('Banner upload failed:', e); }
          } else {
            setTrips(p => [mapApiTrip(newTrip), ...p]);
          }
          // Refresh trip list so memberAvatars are populated from the server
          loadTrips(1, true);
          setTripBannerUri(undefined);
          setTripBannerCrop(null);
        }}
      />

      {/* ── Create Event Modal overlay — no tab switch ── */}
      <CreateEventModal
        visible={showCreateEventModal}
        onClose={() => setShowCreateEventModal(false)}
        onSave={(ev) => {
          setShowCreateEventModal(false);
          // Add to homeEvents feed if upcoming
          const days = daysUntil(ev.dateISO);
          if (days >= 0) setHomeEvents(p => [ev, ...p]);
          // Refresh events so memberAvatars are populated from the server
          getEvents({ status: 'upcoming' }).then(res => setHomeEvents(res.events)).catch(() => {});
        }}
      />
    </>
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

        {showProfileMenu && (
          <ProfileDropdown
            user={user}
            firstName={firstName}
            onClose={() => setShowProfileMenu(false)}
            onNavigateToAccount={() => navigation.navigate('EditProfile')}
            onNavigateToArchived={() => navigation.navigate('Archived')}
            onLogout={logout}
          />
        )}

        {activeTab === 'home' && renderHomeTab()}
        {/* Keep TripsScreen mounted to allow nav from other places */}
        <View style={{ flex: 1, display: activeTab === 'trips' ? 'flex' : 'none' }}>
          <TripsScreen openCreateOnMount={triggerCreateTrip} onCreateMountHandled={() => setTriggerCreateTrip(false)} />
        </View>
        {/* Keep EventsScreen mounted to preserve local state across tab switches */}
        <View style={{ flex: 1, display: activeTab === 'events' ? 'flex' : 'none' }}>
          <EventsScreen openCreateOnMount={showCreateEvent} onCreateMountHandled={() => setShowCreateEvent(false)} />
        </View>
        {activeTab === 'friends' && <FriendsTab />}
        {activeTab === 'chat' && <ChatTab onNavigateToChat={navigateToChat} />}
        {activeTab === 'gallery' && (
          <GalleryTab
            user={user}
            trips={trips}
            onEditProfile={() => navigation.navigate('EditProfile')}
            onNavigateToTrip={navigateToTrip}
            onSetActiveTab={setActiveTab}
          />
        )}

        {/* Draggable Swee FAB */}
        <SweeFab onPress={() => navigateToChat(SWEE_CHAT)} />

        {/* Bottom Tab Bar */}
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
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 4 },

  // ── Home Tab ──
  // responsive: tighten spacing on small screens so Travel Insights is visible in first viewport
  welcomeCenter: { alignItems: 'center', marginTop: SCREEN_H < 700 ? 4 : 8, marginBottom: SCREEN_H < 700 ? 14 : 20 },
  // Figma: text-2xl font-bold text-slate-600 — reduced from 24 to 20
  welcomeTitle: { fontSize: SCREEN_W < 375 ? 18 : 20, fontWeight: '700', color: '#475569', textAlign: 'center', marginBottom: 8 },
  // Figma: text-lg font-normal text-slate-900 — reduced from 18 to 15
  welcomeSubtitle: { fontSize: SCREEN_W < 375 ? 13 : 15, fontWeight: '400', color: '#0f172a', textAlign: 'center', lineHeight: 20 },

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

  // Insights carousel — show peek of next card on sides
  insightCarousel: { marginBottom: 20, position: 'relative', marginHorizontal: -20, overflow: 'visible' },
  insightArrowLeft: {
    position: 'absolute', left: 2, top: SCREEN_H < 700 ? 52 : SCREEN_H < 800 ? 62 : 78, zIndex: 10,
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18, shadowRadius: 4, elevation: 5,
  },
  insightArrowRight: {
    position: 'absolute', right: 2, top: SCREEN_H < 700 ? 52 : SCREEN_H < 800 ? 62 : 78, zIndex: 10,
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18, shadowRadius: 4, elevation: 5,
  },
  insightArrowActive: { backgroundColor: '#0d9488' },
  insightArrowInactive: { backgroundColor: '#e2e8f0' },
  insightSlide: {
    width: SCREEN_W - 80,
    marginHorizontal: 10,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  insightImage: { width: '100%', height: INSIGHT_IMG_H },
  insightOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingTop: 32,
    paddingBottom: 14,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  insightReadTimePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
  },
  insightReadTimeText: {
    fontSize: 11,
    color: '#e2e8f0',
    fontWeight: '600',
  },
  insightTitle: { fontSize: 14, fontWeight: '600', color: '#ffffff', lineHeight: 20 },

  // Section headers
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 8 },
  // Figma: text-lg font-normal text-slate-900 — reduced from 18 to 16
  sectionTitle: { fontSize: SCREEN_W < 375 ? 14 : 16, fontWeight: '400', color: '#0f172a', marginBottom: 10 },
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

// ─── Home-tab styles ──────────────────────────────────────────────────────────

const hStyles = StyleSheet.create({
  scrollContent: { paddingBottom: 100 },

  welcomeTitle: { fontSize: 26, fontWeight: '700', color: '#1a1a1a', textAlign: 'center', marginTop: 16 },
  welcomeSub:   { fontSize: 15, color: '#555', textAlign: 'center', marginTop: 4 },

  // Search row
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginHorizontal: 16,
    gap: 8,
  },
  searchBar: {
    flex: 1,
    height: 48,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E0DBD3',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  searchPlaceholder: { fontSize: 14, color: '#94a3b8', flex: 1 },
  askSweeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0d9488',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  askSweeBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Action buttons row
  actionBtnsRow:    { marginTop: 14 },
  actionBtnsContent: { paddingHorizontal: 16, gap: 10 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    height: 38,
  },
  actionBtnText: { fontSize: 13, fontWeight: '600' },

  // Section headers
  sectionHeader: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginLeft: 16, marginTop: 24, marginBottom: 12 },

  // Skeleton placeholders
  skeletonRow: { flexDirection: 'row', gap: 10, paddingLeft: 16, marginBottom: 8 },
  skeletonCard: { borderRadius: 16, backgroundColor: '#E8E4DF' },

  // Blog carousel card
  blogCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#ccc',
  },
  blogGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    justifyContent: 'flex-end',
    padding: 10,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  blogTitle: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Deal carousel card
  dealCard: {
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 12,
    overflow: 'hidden',
  },
  dealTitle:    { fontSize: 14, fontWeight: '700', color: '#1a1a1a', paddingHorizontal: 10, marginTop: 8, textAlign: 'center' },
  dealSubtitle: { fontSize: 12, color: '#666', paddingHorizontal: 10, textAlign: 'center' },

  // Pagination dots
  dotsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, marginTop: 8, marginBottom: 4 },
  dot:     { borderRadius: 3 },

  // Trip/Event compact card
  teCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  teCardImg:  { width: 72, height: 72, borderRadius: 12 },
  teCardBody: { flex: 1 },
  teCardName: { fontSize: 15, fontWeight: '700', color: '#0d9488', marginBottom: 4 },
  teCardRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  teCardMeta: { fontSize: 13, color: '#64748b', flex: 1 },
  teCardRight: { alignItems: 'center', justifyContent: 'center' },
  teAvatarsRow: { flexDirection: 'row', alignItems: 'center' },
  teAvatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#fff' },
  teExtraCounter: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#e0f7f4', borderWidth: 2, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  teExtraText: { fontSize: 9, color: '#0d9488', fontWeight: '700' },

  emptyLabel: { fontSize: 13, color: '#94a3b8', marginLeft: 16, marginBottom: 8 },
});