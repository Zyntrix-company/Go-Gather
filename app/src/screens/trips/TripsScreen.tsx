import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
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
  ActivityIndicator,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { launchImageLibrary } from 'react-native-image-picker';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { TripCardFull, TripCardPast, CardData } from '../../components/common/Cards';
import Toast from 'react-native-toast-message';
import {
  getTrips,
  createTrip as apiCreateTrip,
  updateTrip as apiUpdateTrip,
  deleteTrip as apiDeleteTrip,
  archiveTrip as archiveTripApi,
  uploadTripPhotos,
  getFriends,
  handleApiError,
} from '../../api/trips.api';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────

type Trip = {
  id: string;
  name: string;
  location: string;
  startDate: string;
  endDate: string;
  startDateISO: string;
  endDateISO: string;
  fullStartDate: string;
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

const CT_FRIENDS = [
  { id: '1', name: 'Yuki Tanaka', email: 'yuki_tanaka@example.com', uri: 'https://i.pravatar.cc/150?img=32' },
  { id: '2', name: 'Amara Okafor', email: 'amara2025@example.com', uri: 'https://i.pravatar.cc/150?img=38' },
  { id: '3', name: 'Marcus Johnson', email: 'marcusj_nyc@example.com', uri: 'https://i.pravatar.cc/150?img=13' },
  { id: '4', name: 'Sofia Rodriguez', email: 'sofia_rio@example.com', uri: 'https://i.pravatar.cc/150?img=45' },
  { id: '5', name: 'Ahmed Al-Rashid', email: 'ahmed_explorer@example.com', uri: 'https://i.pravatar.cc/150?img=53' },
];

// ─── Date Helpers ─────────────────────────────────────────────────────────────

function parseLocalDate(iso: string): Date {
  if (!iso) return new Date(0);
  const parts = iso.split('-');
  if (parts.length !== 3) return new Date(0);
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

function fmtDisplayDate(iso: string): string {
  if (!iso) return 'TBD';
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

const TrashIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="#ef4444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// ─── Trip Card (Upcoming / Ongoing) ──────────────────────────────────────────

function TripCardFullLocal({ trip, onPress, showMenu, onToggleMenu, onArchive, onDelete }: {
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

function TripCardPastLocal({ trip, onPress, showMenu, onToggleMenu, onArchive, onDelete }: {
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

// ─── Create Trip Modal ────────────────────────────────────────────────────────

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
  const [bannerImageType, setBannerImageType] = useState<string>('image/jpeg');
  const [cropPreviewUri, setCropPreviewUri] = useState<string | undefined>(undefined);
  const [cropPreviewType, setCropPreviewType] = useState<string>('image/jpeg');
  const [bannerCrop, setBannerCrop] = useState<{ scale: number; x: number; y: number } | null>(null);

  const cropScaleAnim  = useRef(new Animated.Value(1)).current;
  const cropTransXAnim = useRef(new Animated.Value(0)).current;
  const cropTransYAnim = useRef(new Animated.Value(0)).current;
  const cropState = useRef({ scale: 1, x: 0, y: 0, lastDist: 0, lastMidX: 0, lastMidY: 0, isPinch: false });

  function cropTouchDist(touches: any[]) {
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  const cropPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const touches = e.nativeEvent.touches;
      const s = cropState.current;
      s.isPinch = touches.length >= 2;
      if (s.isPinch) {
        s.lastDist = cropTouchDist(touches);
        s.lastMidX = (touches[0].pageX + touches[1].pageX) / 2;
        s.lastMidY = (touches[0].pageY + touches[1].pageY) / 2;
      }
    },
    onPanResponderMove: (e, gs) => {
      const touches = e.nativeEvent.touches;
      const s = cropState.current;
      if (touches.length >= 2) {
        s.isPinch = true;
        const dist = cropTouchDist(touches);
        const midX = (touches[0].pageX + touches[1].pageX) / 2;
        const midY = (touches[0].pageY + touches[1].pageY) / 2;
        if (s.lastDist > 0) {
          s.scale = Math.max(0.5, Math.min(s.scale * (dist / s.lastDist), 6));
          cropScaleAnim.setValue(s.scale);
          s.x += midX - s.lastMidX;
          s.y += midY - s.lastMidY;
          cropTransXAnim.setValue(s.x);
          cropTransYAnim.setValue(s.y);
        }
        s.lastDist = dist;
        s.lastMidX = midX;
        s.lastMidY = midY;
      } else {
        cropTransXAnim.setValue(s.x + gs.dx);
        cropTransYAnim.setValue(s.y + gs.dy);
      }
    },
    onPanResponderRelease: (_, gs) => {
      const s = cropState.current;
      if (!s.isPinch) {
        s.x += gs.dx;
        s.y += gs.dy;
      }
      s.lastDist = 0;
      s.isPinch = false;
    },
  })).current;

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
    setBannerImageType('image/jpeg');
    setBannerCrop(null);
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
        bannerImageType: bannerImageType,
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
          const parts = [
            a.suburb || a.neighbourhood || a.village || a.town,
            a.city || a.county || a.state_district,
            a.state,
            a.country,
          ].filter(Boolean);
          setLocation(parts.length > 0 ? parts.join(', ') : data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        } catch {
          setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
        setFetchingLocation(false);
      },
      (err) => {
        setFetchingLocation(false);
        const msg = err.message || '';
        if (msg.includes('provider') || msg.includes('No location') || msg.includes('disabled')) {
          Alert.alert('Location Unavailable', 'Please enable GPS / Location Services on your device, then try again. Or type your location manually.');
        } else {
          Alert.alert('Location Error', 'Could not get location. Please type it manually.');
        }
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 }
    );
  }

  function toggleFriend(id: string) {
    setSelectedFriendIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  }

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

          <View style={styles.ctHeader}>
            <Text style={styles.ctTitle}>Create New Trip</Text>
            <TouchableOpacity onPress={onClose} style={styles.ctCloseBtn} activeOpacity={0.7}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M18 6L6 18M6 6l12 12" stroke="#64748b" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.ctScrollContent}>

            {/* Banner Image */}
            <Text style={styles.ctLabel}>Banner Image <Text style={{ color: '#94a3b8', fontWeight: '400' }}>(optional — auto-assigned if skipped)</Text></Text>
            <TouchableOpacity
              style={{ width: '100%', height: 140, borderRadius: 12, backgroundColor: '#f1f5f9', overflow: 'hidden', marginBottom: 14, alignItems: 'center', justifyContent: 'center', borderWidth: bannerImageUri ? 0 : 1, borderColor: '#e2e8f0', borderStyle: 'dashed' }}
              onPress={() => launchImageLibrary({
                mediaType: 'photo',
                selectionLimit: 1,
                includeBase64: false,
                presentationStyle: 'fullScreen',
              }, res => {
                if (res.didCancel || res.errorCode) return;
                const asset = res.assets?.[0];
                if (asset?.uri) {
                  setCropPreviewUri(asset.uri);
                  setCropPreviewType(asset.type ?? 'image/jpeg');
                }
              })}
              activeOpacity={0.8}
            >
              {bannerImageUri ? (
                <>
                  {bannerCrop ? (() => {
                    const previewH = 140;
                    const overlayW = SCREEN_W * 0.9;
                    const ratio = (SCREEN_W - 48) / overlayW;
                    const imgSize = SCREEN_W * ratio * bannerCrop.scale;
                    const imgLeft = ((SCREEN_W - 48) - imgSize) / 2 + bannerCrop.x * ratio;
                    const imgTop  = (previewH - imgSize) / 2 + bannerCrop.y * ratio;
                    return (
                      <Image
                        source={{ uri: bannerImageUri }}
                        style={{ position: 'absolute', width: imgSize, height: imgSize, left: imgLeft, top: imgTop }}
                        resizeMode="cover"
                      />
                    );
                  })() : (
                    <Image source={{ uri: bannerImageUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  )}
                  <TouchableOpacity
                    style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 4 }}
                    onPress={() => { setBannerImageUri(undefined); setBannerCrop(null); }}
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
                  <Text style={{ color: '#94a3b8', fontSize: 13 }}>Tap to add banner photo (auto-matched otherwise)</Text>
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
                {fetchingLocation
                  ? <ActivityIndicator size="small" color="#0d9488" />
                  : <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      <Circle cx={12} cy={10} r={3} stroke="#0d9488" strokeWidth={2} />
                    </Svg>
                }
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

          <View style={styles.ctFooter}>
            <TouchableOpacity onPress={() => { reset(); onClose(); }} activeOpacity={0.7}>
              <Text style={styles.ctCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.ctCreateBtn, isSubmitting && { opacity: 0.6 }]} onPress={handleSave} disabled={isSubmitting} activeOpacity={0.85}>
              <Text style={styles.ctCreateBtnText}>{isSubmitting ? 'Creating...' : 'Create Trip'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Invite Members Sub-Modal */}
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

        {/* Extract from Email Sub-Modal */}
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

      {/* Banner crop/preview modal */}
      <Modal
        visible={!!cropPreviewUri}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setCropPreviewUri(undefined)}
        onShow={() => {
          const s = cropState.current;
          s.scale = 1; s.x = 0; s.y = 0; s.lastDist = 0;
          cropScaleAnim.setValue(1);
          cropTransXAnim.setValue(0);
          cropTransYAnim.setValue(0);
        }}
      >
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <View
            style={{ flex: 1, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}
            {...cropPanResponder.panHandlers}
          >
            {cropPreviewUri && (
              <Animated.Image
                source={{ uri: cropPreviewUri }}
                style={[
                  { width: SCREEN_W, height: SCREEN_W },
                  { transform: [{ translateX: cropTransXAnim }, { translateY: cropTransYAnim }, { scale: cropScaleAnim }] },
                ]}
                resizeMode="contain"
              />
            )}
            <View pointerEvents="none" style={{ position: 'absolute', width: SCREEN_W * 0.9, aspectRatio: 16 / 9, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)', borderRadius: 6 }}>
              <View style={{ position: 'absolute', left: '33.3%', top: 0, bottom: 0, borderLeftWidth: 0.5, borderLeftColor: 'rgba(255,255,255,0.4)' }} />
              <View style={{ position: 'absolute', left: '66.6%', top: 0, bottom: 0, borderLeftWidth: 0.5, borderLeftColor: 'rgba(255,255,255,0.4)' }} />
              <View style={{ position: 'absolute', top: '33.3%', left: 0, right: 0, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.4)' }} />
              <View style={{ position: 'absolute', top: '66.6%', left: 0, right: 0, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.4)' }} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 40, paddingVertical: 32, backgroundColor: '#000' }}>
            <TouchableOpacity onPress={() => setCropPreviewUri(undefined)} activeOpacity={0.8}>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '500' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {
              const s = cropState.current;
              s.scale = 1; s.x = 0; s.y = 0;
              Animated.parallel([
                Animated.spring(cropScaleAnim,  { toValue: 1, useNativeDriver: true }),
                Animated.spring(cropTransXAnim, { toValue: 0, useNativeDriver: true }),
                Animated.spring(cropTransYAnim, { toValue: 0, useNativeDriver: true }),
              ]).start();
            }} activeOpacity={0.8}>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '500' }}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {
              const s = cropState.current;
              setBannerImageUri(cropPreviewUri);
              setBannerImageType(cropPreviewType);
              setBannerCrop({ scale: s.scale, x: s.x, y: s.y });
              setCropPreviewUri(undefined);
            }} activeOpacity={0.8}>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TripsScreen() {
  const navigation = useNavigation<any>();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(false);
  const [tripsPage, setTripsPage] = useState(1);
  const [hasMoreTrips, setHasMoreTrips] = useState(false);
  const [showTripMenu, setShowTripMenu] = useState<string | null>(null);
  const [showCreateTrip, setShowCreateTrip] = useState(false);

  const { upcoming, ongoing, past } = categorizeTrips(trips);

  const loadTripsRef = useRef<() => void>(() => {});
  useFocusEffect(useCallback(() => { loadTripsRef.current(); }, []));

  async function loadTrips(page: number = 1, replace: boolean = false) {
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

  loadTripsRef.current = () => loadTrips(1, true);

  function navigateToTrip(trip: Trip) { navigation.navigate('TripDetail', { trip }); }

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

  return (
    <View style={{ flex: 1 }}>
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
                  <TripCardFullLocal
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

            {/* UPCOMING */}
            {upcoming.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>UPCOMING</Text>
                {upcoming.map(trip => (
                  <TripCardFullLocal
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

            {/* PAST */}
            {past.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>PAST</Text>
                {past.map(trip => (
                  <TripCardPastLocal
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

      <CreateTripModal
        visible={showCreateTrip}
        onClose={() => setShowCreateTrip(false)}
        onSave={async (data: any) => {
          const res = await apiCreateTrip({
            name: data.name,
            startDate: data.startDateISO ?? data.startDate ?? '',
            endDate: data.endDateISO ?? data.endDate ?? '',
            location: { name: data.location || 'TBD' },
            friendIds: data.friendIds?.length ? data.friendIds : undefined,
            emails: data.inviteEmail ? [data.inviteEmail] : undefined,
          });
          let newTrip = res.trip;
          const localUri: string | undefined = data.bannerImageUrl;
          const isLocalUri = localUri && (localUri.startsWith('file://') || localUri.startsWith('content://') || localUri.startsWith('file:'));
          if (isLocalUri) {
            setTrips(p => [{ ...mapApiTrip(newTrip), bannerImageUrl: localUri! }, ...p]);
            try {
              const photoRes = await uploadTripPhotos(newTrip.id, [{
                uri: localUri!,
                type: data.bannerImageType ?? 'image/jpeg',
                name: `banner.${(data.bannerImageType ?? 'image/jpeg').split('/')[1] ?? 'jpg'}`,
              }]);
              const photo = photoRes.photos?.[0];
              const permanentUrl = (photo as any)?.fileUrl ?? photo?.url;
              const displayUrl = photo?.url ?? permanentUrl;
              if (permanentUrl) {
                const updated = await apiUpdateTrip(newTrip.id, { bannerImageUrl: permanentUrl });
                newTrip = updated.trip;
                setTrips(p => p.map(t => t.id === newTrip.id ? { ...t, bannerImageUrl: newTrip.bannerImageUrl ?? displayUrl } : t));
              }
            } catch { /* keep local URI shown */ }
          } else {
            setTrips(p => [mapApiTrip(newTrip), ...p]);
          }
        }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 4 },

  // Trips Tab
  tripsCTA: { alignItems: 'center', paddingVertical: 1, marginBottom: 8 },
  tripsPlaneCircle: {
    width: 83, height: 83, borderRadius: 40,
    backgroundColor: '#cbfbf1',
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  tripsCTATitle: { fontSize: 20, fontWeight: '600', color: '#0f172a', textAlign: 'center', marginBottom: 10, paddingHorizontal: 24 },
  tripsCTASub: { fontSize: 14, color: '#64748b', marginBottom: 26, textAlign: 'center' },
  createTripBtn: {
    backgroundColor: '#0d9488', borderRadius: 999, paddingVertical: 11, paddingHorizontal: 32,
    alignSelf: 'center', marginBottom: 1,
    shadowColor: '#0d9488', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  createTripBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  tripsListHeader: { marginBottom: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 16 },
  tripsListTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  tripsListSub: { fontSize: 13, color: '#64748b', marginTop: 2 },
  sectionLabel: {
    fontSize: 13, fontWeight: '600', color: '#64748b', letterSpacing: 0.6,
    marginBottom: 10, marginTop: 4, textTransform: 'uppercase',
  },

  // Cards
  card: {
    backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardMedia: { height: 144, position: 'relative' },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  ongoingBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: '#10b981', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  ongoingBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  cardMoreBtn: {
    position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  participantAvatars: {
    position: 'absolute', bottom: 8, right: 8, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 20, padding: 3,
  },
  miniAvatar: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#fff' },
  moreCounter: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#f0fdfa', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  moreCounterText: { fontSize: 9, color: '#0d9488', fontWeight: 'bold' },
  cardBody: { padding: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardMain: { flex: 1, paddingRight: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 4, lineHeight: 22 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  infoText: { fontSize: 12, color: '#475569', fontWeight: '400' },
  daysBadge: { alignItems: 'flex-end', justifyContent: 'center', minWidth: 44 },
  daysNumber: { fontSize: 28, fontWeight: '700', color: '#0d9488', lineHeight: 32 },
  daysLabel: { fontSize: 8, color: '#94a3b8', fontWeight: '600', textAlign: 'right', letterSpacing: 0.5 },

  // Trip Menu Dropdown
  tripMenuDropdown: {
    position: 'absolute', top: 12, right: 48, width: 176,
    backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16,
    elevation: 12, overflow: 'hidden', zIndex: 200,
  },
  tripMenuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 11 },
  tripMenuItemText: { fontSize: 14, color: '#334155', fontWeight: '500' },

  // Past Trip Card
  pastCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  pastCardImage: { width: 66, height: 66, borderRadius: 12, resizeMode: 'cover', flexShrink: 0 },
  pastCardInfo: { flex: 1, gap: 3 },
  pastCardTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 2 },
  pastCardRight: { alignItems: 'center', justifyContent: 'flex-end' },
  pastAvatarsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pastAvatars: { flexDirection: 'row' },
  pastMiniAvatar: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#fff' },
  pastMoreBtn: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#f8fafc',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0',
  },

  // Empty State
  emptyState: { alignItems: 'center', paddingTop: 32, gap: 12 },
  emptyStateSubtitle: { fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  modalDialog: { backgroundColor: '#fff', borderRadius: 24, width: '100%', maxHeight: '90%', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 12 },

  // Create Trip Modal
  ctHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  ctTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  ctCloseBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  ctScrollContent: { paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
  ctLabel: { fontSize: 13, fontWeight: '600', color: '#0f172a', marginTop: 4 },
  ctInput: { borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#0f172a', backgroundColor: '#fff' },
  ctDateRow: { flexDirection: 'row', gap: 10 },
  ctDateBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  ctDateText: { flex: 1, fontSize: 13, color: '#0f172a' },
  ctLocationBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  ctRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  ctRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  ctRowIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#2dd4bf', alignItems: 'center', justifyContent: 'center' },
  ctRowText: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  ctRowSub: { fontSize: 11, color: '#94a3b8' },
  ctCountBadge: { backgroundColor: '#ccfbf1', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  ctCountBadgeText: { fontSize: 11, color: '#0f766e', fontWeight: '600' },
  ctDocChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  ctDocChipText: { flex: 1, fontSize: 12, color: '#334155' },
  ctDocRemove: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' },
  ctFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  ctCancelText: { fontSize: 13, fontWeight: '600', color: '#0f172a', textDecorationLine: 'underline' },
  ctCreateBtn: { backgroundColor: '#0d9488', borderRadius: 999, paddingHorizontal: 28, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  ctCreateBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Invite modal tabs
  inviteTabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  inviteTab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  inviteTabActive: { borderBottomWidth: 2, borderBottomColor: '#0d9488', backgroundColor: '#f0fdfa' },
  inviteTabText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  inviteTabTextActive: { color: '#0d9488' },
  friendSelectRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 10, marginBottom: 4 },
  friendSelectAvatar: { width: 44, height: 44, borderRadius: 22 },
  checkCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#0d9488', alignItems: 'center', justifyContent: 'center' },
  friendName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  friendHandle: { fontSize: 13, color: '#64748b', marginTop: 2 },
});
