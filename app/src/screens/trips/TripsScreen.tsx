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
  Dimensions,
  FlatList,
  Animated,
  PanResponder,
  Switch,
  Platform,
  ActivityIndicator,
  NativeModules,
  SafeAreaView,
  Pressable,
} from 'react-native';
import LocationAutocomplete from '../../components/common/LocationAutocomplete';
import AppDatePicker from '../../components/common/AppDatePicker';
import { launchImageLibrary } from 'react-native-image-picker';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { Plane } from 'lucide-react-native';
import { UnifiedCard } from '../../components/common/Cards';
import CachedImage from '../../components/common/CachedImage';
import Toast from 'react-native-toast-message';
import useAuthStore from '../../store/authStore';
import { authFreshAvatarUrl, authUserId, resolveMemberAvatarUri } from '../../utils/avatarUri';
import DateInfoPopover from '../../components/common/DateInfoPopover';
import {
  getTrips,
  createTrip as apiCreateTrip,
  updateTrip as apiUpdateTrip,
  deleteTrip as apiDeleteTrip,
  archiveTrip as archiveTripApi,
  uploadTripPhotos,
  uploadDoc as uploadTripDoc,
  getFriends,
  handleApiError,
  getEmailStatus,
  listEmailAttachments,
  importEmailAttachments,
  type EmailAttachment,
} from '../../api/trips.api';
import { showAlert, showConfirm } from '../../store/alertStore';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────

// How the image is positioned/scaled relative to the card crop box.
// All values are fractions of the target display dimensions so rendering
// is fully resolution-independent.
export type BannerCropFraction = {
  imgFracX: number; // image left / targetWidth
  imgFracY: number; // image top  / targetHeight
  imgFracW: number; // image width  / targetWidth
  imgFracH: number; // image height / targetHeight
};

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
  shortStartDate: string;
  shortEndDate: string;
  image: any;
  bannerImageUrl?: string | null;
  bannerCropFraction?: BannerCropFraction | null;
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
    shortStartDate: '15 May',
    shortEndDate: '20 May',
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
    shortStartDate: '5 Jan',
    shortEndDate: '15 Jan',
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

// Validate that date is within 365 days from today
function validateDateRange(date: Date): { isValid: boolean; error?: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const daysDiff = Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff < -365) {
    return { isValid: false, error: 'Date must be within 365 days from today.' };
  }
  if (daysDiff > 365) {
    return { isValid: false, error: 'Date must be within 365 days from today.' };
  }
  return { isValid: true };
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

function fmtDateNoYear(iso: string): string {
  if (!iso) return 'TBD';
  const clean = iso.includes('T') ? iso.split('T')[0] : iso;
  const parts = clean.split('-');
  if (parts.length !== 3) return 'TBD';
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  if (isNaN(d.getTime())) return 'TBD';
  return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
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
    shortStartDate: fmtDateNoYear(s),
    shortEndDate: fmtDateNoYear(e),
    image: require('../../assets/images/goa_beach.png'),
    bannerImageUrl: t.bannerImageUrl ?? null,
    bannerCropFraction: t.bannerCropFraction ?? null,
    members: (t.memberAvatars || []).slice(0, 2).map((av: any, idx: number) => {
      const rawUri = typeof av === 'string' ? av : (av.uri ?? '');
      const memberId = typeof av === 'string' ? undefined : (av.id != null ? String(av.id) : undefined);
      const state = useAuthStore.getState();
      const user = state.user;
      const uri = resolveMemberAvatarUri(rawUri, {
        memberId,
        currentUserId: authUserId(user),
        freshUrl: authFreshAvatarUrl(user),
        prevUrl: state.prevAvatarUrl ?? '',
      });
      const stableId = memberId || uri || `av-${idx}`;
      return { id: stableId, uri };
    }),
    extraMembers: (t.memberAvatars || []).length === 0 ? (t.memberCount ?? 0) : Math.max(0, (t.memberCount ?? 0) - Math.min((t.memberAvatars || []).length, 2)),
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

const PlaneIcon = ({ color = '#0d9488', size = 28 }) => (
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

// ─── Banner image renderer (respects crop fraction if present) ────────────────

function BannerImage({
  uri, fallback, crop, style, resizeMode = 'cover',
}: {
  uri?: string | null;
  fallback?: any;
  crop?: BannerCropFraction | null;
  style: any;
  resizeMode?: 'cover' | 'stretch' | 'contain';
}) {
  if (uri && crop) {
    return (
      <View style={[style, { overflow: 'hidden' }]}>
        <CachedImage
          uri={uri}
          style={{
            position: 'absolute',
            width: `${crop.imgFracW * 100}%`,
            height: `${crop.imgFracH * 100}%`,
            left: `${crop.imgFracX * 100}%`,
            top: `${crop.imgFracY * 100}%`,
          }}
          resizeMode="stretch"
        />
      </View>
    );
  }
  if (uri) return <CachedImage uri={uri} style={style} resizeMode={resizeMode} />;
  return <Image source={fallback} style={style} resizeMode={resizeMode} />;
}

// ─── Trip Card (Upcoming / Ongoing) ──────────────────────────────────────────

function TripCardFullLocal({ trip, onPress, showMenu, onToggleMenu, onArchive, onDelete }: {
  trip: Trip; onPress: () => void;
  showMenu: boolean; onToggleMenu: () => void;
  onArchive: () => void; onDelete: () => void;
}) {
  const days = daysUntil(trip.startDateISO);
  return (
    <UnifiedCard
      imageUri={trip.bannerImageUrl}
      imageFallback={trip.image}
      name={trip.name}
      location={trip.location}
      dateLabel={`${trip.shortStartDate} – ${trip.shortEndDate}`}
      members={trip.members}
      extraMembers={trip.extraMembers}
      daysToGo={days > 0 ? days : undefined}
      onPress={onPress}
      onToggleMenu={onToggleMenu}
      showMenu={showMenu}
      archiveLabel="Archive Trip"
      onArchive={onArchive}
      onDelete={onDelete}
      mb={8}
    />
  );
}

// ─── Past Trip Card ───────────────────────────────────────────────────────────

function TripCardPastLocal({ trip, onPress, showMenu, onToggleMenu, onArchive, onDelete }: {
  trip: Trip; onPress: () => void;
  showMenu: boolean; onToggleMenu: () => void;
  onArchive: () => void; onDelete: () => void;
}) {
  return (
    <UnifiedCard
      imageUri={trip.bannerImageUrl}
      imageFallback={trip.image}
      name={trip.name}
      location={trip.location}
      dateLabel={`${trip.fullStartDate} – ${trip.fullEndDate}`}
      members={trip.members}
      extraMembers={trip.extraMembers}
      onPress={onPress}
      onToggleMenu={onToggleMenu}
      showMenu={showMenu}
      archiveLabel="Archive Trip"
      onArchive={onArchive}
      onDelete={onDelete}
      mb={8}
    />
  );
}

// ─── Create Trip Modal ────────────────────────────────────────────────────────

// Props for lifted banner state (survives tab navigation & Android image-picker re-renders)
export type CreateTripModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  // Lifted: banner state lives in TripsScreen so it isn't lost on nav
  bannerImageUri: string | undefined;
  setBannerImageUri: (v: string | undefined) => void;
  bannerImageType: string;
  setBannerImageType: (v: string) => void;
  bannerCropFraction: BannerCropFraction | null;
  setBannerCropFraction: (v: BannerCropFraction | null) => void;
  // Pre-select friends (e.g. when opening from Friends screen)
  initialFriendIds?: string[];
};

export function CreateTripModal({
  visible,
  onClose,
  onSave,
  bannerImageUri,
  setBannerImageUri,
  bannerImageType,
  setBannerImageType,
  bannerCropFraction,
  setBannerCropFraction,
  initialFriendIds,
}: CreateTripModalProps) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [startDateObj, setStartDateObj] = useState<Date | undefined>(undefined);
  const [endDateObj, setEndDateObj] = useState<Date | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiFriends, setApiFriends] = useState<typeof CT_FRIENDS>([]);
  const [reminders, setReminders] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<{ uri: string; name: string; type: string }[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEmailPicker, setShowEmailPicker] = useState(false);
  const [emailPickerProvider, setEmailPickerProvider] = useState<'gmail' | 'outlook'>('gmail');
  const [emailAttachments, setEmailAttachments] = useState<EmailAttachment[]>([]);
  const [selectedAttachIds, setSelectedAttachIds] = useState<Set<string>>(new Set());
  const [emailPickerLoading, setEmailPickerLoading] = useState(false);
  const [emailStatus, setEmailStatus] = useState({ gmail: { connected: false }, outlook: { connected: false } });
  const [emailSelectedDocs, setEmailSelectedDocs] = useState<{ attachmentId: string; messageId: string; fileName: string; provider: 'gmail' | 'outlook' }[]>([]);
  const [memberTab, setMemberTab] = useState<'friends' | 'new'>('friends');
  const [friendSearch, setFriendSearch] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteWhatsapp, setInviteWhatsapp] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);
  const [showStartDateTooltip, setShowStartDateTooltip] = useState(false);
  const [showEndDateTooltip, setShowEndDateTooltip] = useState(false);
  const [startDateError, setStartDateError] = useState<string | null>(null);
  const [endDateError, setEndDateError] = useState<string | null>(null);
  const [startIconPos, setStartIconPos] = useState({ x: 0, y: 0 });
  const [endIconPos, setEndIconPos] = useState({ x: 0, y: 0 });
  const startIconRef = useRef<any>(null);
  const endIconRef = useRef<any>(null);
  // Crop-flow state (purely local — only needed while the crop modal is open)
  const [cropPreviewUri, setCropPreviewUri] = useState<string | undefined>(undefined);
  const [cropPreviewType, setCropPreviewType] = useState<string>('image/jpeg');
  const [pickedOrigSize, setPickedOrigSize] = useState({ w: 1, h: 1 });
  // Actual layout dimensions of the crop canvas (set via onLayout)
  const [cropAreaSize, setCropAreaSize] = useState({ w: SCREEN_W, h: SCREEN_W });
  // (zoom % display removed — zoom is pinch-only)

  // Card banner dimensions — crop box must match these proportions exactly
  const CARD_BANNER_W = SCREEN_W - 40; // scrollContent paddingHorizontal 20 each side
  const CARD_BANNER_H = 144;

  const cropScaleAnim = useRef(new Animated.Value(1)).current;
  const cropTransXAnim = useRef(new Animated.Value(0)).current;
  const cropTransYAnim = useRef(new Animated.Value(0)).current;
  // All mutable gesture state lives in a ref so PanResponder callbacks
  // (created once) can always read/write the latest values without stale closures.
  const cropState = useRef({
    scale: 1, x: 0, y: 0,
    lastDist: 0, lastMidX: 0, lastMidY: 0,
    lastX: 0, lastY: 0,   // for incremental single-finger pan
  });

  function cropTouchDist(touches: any[]) {
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // PanResponder uses INCREMENTAL deltas (current − last) so there's no jump
  // when switching between single-finger pan and two-finger pinch.
  const cropPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const touches = e.nativeEvent.touches;
      const s = cropState.current;
      if (touches.length >= 2) {
        s.lastDist = cropTouchDist(touches);
        s.lastMidX = (touches[0].pageX + touches[1].pageX) / 2;
        s.lastMidY = (touches[0].pageY + touches[1].pageY) / 2;
        s.lastX = s.lastMidX;
        s.lastY = s.lastMidY;
      } else {
        s.lastX = touches[0]?.pageX ?? 0;
        s.lastY = touches[0]?.pageY ?? 0;
        s.lastDist = 0;
      }
    },
    onPanResponderMove: (e) => {
      const touches = e.nativeEvent.touches;
      const s = cropState.current;
      if (touches.length >= 2) {
        // Two-finger pinch-to-zoom + pan from midpoint
        const dist = cropTouchDist(touches);
        const midX = (touches[0].pageX + touches[1].pageX) / 2;
        const midY = (touches[0].pageY + touches[1].pageY) / 2;
        if (s.lastDist > 0) {
          s.scale = Math.max(0.25, Math.min(s.scale * (dist / s.lastDist), 8));
          cropScaleAnim.setValue(s.scale);
          s.x += midX - s.lastMidX;
          s.y += midY - s.lastMidY;
          cropTransXAnim.setValue(s.x);
          cropTransYAnim.setValue(s.y);
        }
        s.lastDist = dist;
        s.lastMidX = midX;
        s.lastMidY = midY;
        s.lastX = midX;
        s.lastY = midY;
      } else {
        // Single-finger pan — use incremental delta to avoid jump on finger lift
        const tx = touches[0]?.pageX ?? s.lastX;
        const ty = touches[0]?.pageY ?? s.lastY;
        s.x += tx - s.lastX;
        s.y += ty - s.lastY;
        cropTransXAnim.setValue(s.x);
        cropTransYAnim.setValue(s.y);
        s.lastX = tx;
        s.lastY = ty;
        s.lastDist = 0;
      }
    },
    onPanResponderRelease: () => {
      cropState.current.lastDist = 0;
    },
  })).current;

  function formatDate(d: Date | undefined): string {
    if (!d) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  }

  const navigation = useNavigation<any>();

  useEffect(() => {
    if (!visible) return;
    getEmailStatus().then((d: any) => {
      setEmailStatus({
        gmail:   { connected: Boolean(d?.gmail?.connected) },
        outlook: { connected: Boolean(d?.outlook?.connected) },
      });
    }).catch(() => {});
  }, [visible]);

  async function openEmailPicker(provider: 'gmail' | 'outlook') {
    if (!emailStatus[provider].connected) {
      onClose();
      navigation.navigate('ConnectedEmail');
      return;
    }
    setEmailPickerProvider(provider);
    setEmailPickerLoading(true);
    setSelectedAttachIds(new Set());
    setEmailAttachments([]);
    setShowEmailPicker(true);
    try {
      const res = await listEmailAttachments(provider);
      setEmailAttachments(res.attachments);
    } catch (err) {
      handleApiError(err);
      setShowEmailPicker(false);
    } finally {
      setEmailPickerLoading(false);
    }
  }

  function confirmEmailSelection() {
    const selected = emailAttachments.filter(a => selectedAttachIds.has(a.attachmentId));
    const newDocs = selected.map(a => ({ attachmentId: a.attachmentId, messageId: a.messageId, fileName: a.fileName, provider: emailPickerProvider }));
    setEmailSelectedDocs(prev => {
      const existing = new Set(prev.map(d => d.attachmentId));
      return [...prev, ...newDocs.filter(d => !existing.has(d.attachmentId))];
    });
    setShowEmailPicker(false);
  }

  function reset() {
    setName(''); setLocation('');
    setStartDateObj(undefined); setEndDateObj(undefined);
    setStartDateError(null); setEndDateError(null);
    setReminders(false); setUploadedDocs([]); setSelectedFriendIds([]);
    setEmailSelectedDocs([]);
    setFriendSearch(''); setInviteEmail(''); setInvitePhone(''); setInviteWhatsapp('');
    // Banner state lives in the parent — do NOT reset it here so it
    // survives the user tapping Cancel and re-opening the modal.
    // Parent clears it only after a successful trip creation.
    setCropAreaSize({ w: SCREEN_W, h: SCREEN_W });
  }

  async function handleSave() {
    if (!name.trim()) { showAlert({ title: 'Error', message: 'Please enter a trip name' }); return; }
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
        bannerCropFraction: bannerCropFraction,
        uploadedDocs,
        emailDocs: emailSelectedDocs,
        reminders,
      });
      reset();
      onClose();
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUploadDocs() {
    try {
      const FilePicker = NativeModules.FilePicker;
      if (!FilePicker) {
        showAlert({ title: 'Not Available', message: 'File picker requires a fresh build.' });
        return;
      }
      const file: { uri: string; name: string; type: string } = await FilePicker.pick();
      if (!file?.uri) return;
      setUploadedDocs(p => [...p, { uri: file.uri, name: file.name ?? `file_${Date.now()}`, type: file.type ?? 'application/octet-stream' }]);
    } catch (err: any) {
      if (err?.code === 'CANCELLED' || err?.message === 'User cancelled') return;
      showAlert({ title: 'Error', message: 'Could not open file picker.' });
    }
  }

  function toggleFriend(id: string) {
    setSelectedFriendIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  }

  useEffect(() => {
    if (visible && initialFriendIds && initialFriendIds.length > 0) {
      setSelectedFriendIds(initialFriendIds);
    }
  }, [visible]);

  useEffect(() => {
    if (!showInviteModal) return;
    getFriends(friendSearch || undefined).then(data => {
      const mapped = data.friends.map(f => ({
        id: f.user.id,
        name: f.user.name,
        email: '',
        uri: f.user.avatarUrl ?? `https://i.pravatar.cc/150?u=${f.user.id}`,
      }));
      setApiFriends(mapped);
    }).catch((err) => { handleApiError(err); });
  }, [showInviteModal]);

  const filteredFriends = apiFriends.filter(f =>
    f.name.toLowerCase().includes(friendSearch.toLowerCase()) ||
    (f.email && f.email.toLowerCase().includes(friendSearch.toLowerCase()))
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={styles.modalDialog} onStartShouldSetResponder={() => true}>

          <View style={styles.ctHeader}>
            <Text style={styles.ctTitle}>Create New Trip</Text>
            <TouchableOpacity onPress={onClose} style={styles.ctCloseBtn} activeOpacity={0.7}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M18 6L6 18M6 6l12 12" stroke="#64748b" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always" contentContainerStyle={styles.ctScrollContent}>

            {/* Trip Name */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.ctLabel}>Trip Name</Text>
              <Text style={{ fontSize: 11, color: name.length >= 20 ? '#ef4444' : '#94a3b8' }}>{name.length}/20</Text>
            </View>
            <TextInput style={styles.ctInput} placeholder="e.g., Tokyo Getaway" placeholderTextColor="#94a3b8" value={name} onChangeText={setName} maxLength={20} />

            {/* Start / End Date row */}
            <View style={styles.ctDateRow}>
              <View style={{ flex: 1, gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.ctLabel}>Start Date</Text>
                  <TouchableOpacity
                    ref={startIconRef}
                    style={{ marginTop: 6 }}
                    onPress={() => {
                      if (startIconRef.current) {
                        startIconRef.current.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
                          setStartIconPos({ x: pageX + width / 2, y: pageY + height / 2 });
                        });
                      }
                      setShowStartDateTooltip(true);
                    }}
                    activeOpacity={0.6}
                  >
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                      <Circle cx={12} cy={12} r={10} stroke="#0d9488" strokeWidth={2} />
                      <Path d="M12 7v5M12 17a1 1 0 100-2 1 1 0 000 2z" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </TouchableOpacity>
                </View>
                <AppDatePicker
                  mode="trip"
                  value={startDateObj ? `${startDateObj.getFullYear()}-${String(startDateObj.getMonth() + 1).padStart(2, '0')}-${String(startDateObj.getDate()).padStart(2, '0')}` : ''}
                  onChange={(iso) => {
                    const [y, m, d] = iso.split('-').map(n => parseInt(n, 10));
                    setStartDateObj(new Date(y, m - 1, d));
                    setStartDateError(null);
                  }}
                  error={startDateError}
                  title="Select start date"
                />
              </View>
              <View style={{ flex: 1, gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.ctLabel}>End Date</Text>
                  <TouchableOpacity
                    ref={endIconRef}
                    style={{ marginTop: 6 }}
                    onPress={() => {
                      if (endIconRef.current) {
                        endIconRef.current.measure((_x: number, _y: number, width: number, height: number, pageX: number, pageY: number) => {
                          setEndIconPos({ x: pageX + width / 2, y: pageY + height / 2 });
                        });
                      }
                      setShowEndDateTooltip(true);
                    }}
                    activeOpacity={0.6}
                  >
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                      <Circle cx={12} cy={12} r={10} stroke="#0d9488" strokeWidth={2} />
                      <Path d="M12 7v5M12 17a1 1 0 100-2 1 1 0 000 2z" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </TouchableOpacity>
                </View>
                <AppDatePicker
                  mode="trip"
                  value={endDateObj ? `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')}` : ''}
                  minDate={startDateObj}
                  onChange={(iso) => {
                    const [y, m, d] = iso.split('-').map(n => parseInt(n, 10));
                    setEndDateObj(new Date(y, m - 1, d));
                    setEndDateError(null);
                  }}
                  error={endDateError}
                  title="Select end date"
                />
              </View>
            </View>

            {/* Location */}
            <Text style={styles.ctLabel}>Location</Text>
            <View style={{ zIndex: 10 }}>
              <LocationAutocomplete
                initialValue={location}
                onChangeText={setLocation}
                placeholder="Search location..."
                variant="create"
              />
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
                <Text style={styles.ctDocChipText} numberOfLines={1}>{doc.name}</Text>
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
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 2 }}>
              <TouchableOpacity style={[styles.ctRow, { flex: 1, backgroundColor: '#EA4335' }]} onPress={() => openEmailPicker('gmail')} activeOpacity={0.8}>
                <View style={styles.ctRowLeft}>
                  <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" style={{ marginRight: 6 }}>
                    <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M22 6l-10 7L2 6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <Text style={[styles.ctRowText, { color: '#fff' }]} numberOfLines={1}>{emailStatus.gmail.connected ? 'Gmail' : 'Connect Gmail'}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.ctRow, { flex: 1, backgroundColor: '#0078D4' }]} onPress={() => openEmailPicker('outlook')} activeOpacity={0.8}>
                <View style={styles.ctRowLeft}>
                  <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" style={{ marginRight: 6 }}>
                    <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M22 6l-10 7L2 6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <Text style={[styles.ctRowText, { color: '#fff' }]} numberOfLines={1}>{emailStatus.outlook.connected ? 'Outlook' : 'Connect Outlook'}</Text>
                </View>
              </TouchableOpacity>
            </View>
            {emailSelectedDocs.map((doc, i) => (
              <View key={doc.attachmentId} style={styles.ctDocChip}>
                <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                  <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke={doc.provider === 'gmail' ? '#EA4335' : '#0078D4'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={styles.ctDocChipText} numberOfLines={1}>{doc.fileName}</Text>
                <TouchableOpacity onPress={() => setEmailSelectedDocs(p => p.filter((_, j) => j !== i))}>
                  <View style={styles.ctDocRemove}>
                    <Svg width={9} height={9} viewBox="0 0 24 24" fill="none">
                      <Path d="M18 6L6 18M6 6l12 12" stroke="#ef4444" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </View>
                </TouchableOpacity>
              </View>
            ))}

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

            {/* Banner Image */}
            <Text style={[styles.ctLabel, { marginTop: 16 }]}>Banner Image <Text style={{ color: '#94a3b8', fontWeight: '400' }}>(optional — auto-assigned if skipped)</Text></Text>
            <View
              style={{ width: '100%', height: 140, borderRadius: 12, backgroundColor: '#f1f5f9', overflow: 'hidden', marginBottom: 14, borderWidth: bannerImageUri ? 0 : 1, borderColor: '#e2e8f0', borderStyle: 'dashed' }}
            >
              {bannerImageUri ? (
                <>
                  <BannerImage
                    uri={bannerImageUri}
                    crop={bannerCropFraction}
                    style={{ width: '100%', height: '100%', borderRadius: 12 }}
                  />
                  <TouchableOpacity
                    style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}
                    onPress={() => {
                      setIsCompressing(true);
                      launchImageLibrary({
                        mediaType: 'photo', selectionLimit: 1, includeBase64: false,
                        presentationStyle: 'fullScreen',
                        maxWidth: 1280, maxHeight: 720, quality: 0.7,
                      }, res => {
                        setIsCompressing(false);
                        if (res.didCancel || res.errorCode) return;
                        const asset = res.assets?.[0];
                        if (asset?.uri) {
                          setPickedOrigSize({ w: asset.width ?? 1280, h: asset.height ?? 720 });
                          setCropPreviewUri(asset.uri);
                          setCropPreviewType(asset.type ?? 'image/jpeg');
                          setBannerCropFraction(null);
                        }
                      });
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '500' }}>Change</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 4 }}
                    onPress={() => { setBannerImageUri(undefined); setBannerCropFraction(null); }}
                  >
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                      <Path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </TouchableOpacity>
                </>
              ) : isCompressing ? (
                <TouchableOpacity style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 }} activeOpacity={1}>
                  <ActivityIndicator size="small" color="#0d9488" />
                  <Text style={{ color: '#64748b', fontSize: 13 }}>Compressing image…</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  onPress={() => {
                    setIsCompressing(true);
                    launchImageLibrary({
                      mediaType: 'photo', selectionLimit: 1, includeBase64: false,
                      presentationStyle: 'fullScreen',
                      maxWidth: 1280, maxHeight: 720, quality: 0.7,
                    }, res => {
                      setIsCompressing(false);
                      if (res.didCancel || res.errorCode) return;
                      const asset = res.assets?.[0];
                      if (asset?.uri) {
                        setPickedOrigSize({ w: asset.width ?? 1280, h: asset.height ?? 720 });
                        setCropPreviewUri(asset.uri);
                        setCropPreviewType(asset.type ?? 'image/jpeg');
                        setBannerCropFraction(null);
                      }
                    });
                  }}
                  activeOpacity={0.8}
                >
                  <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                    <Rect x={3} y={3} width={18} height={18} rx={2} ry={2} stroke="#94a3b8" strokeWidth={2} />
                    <Circle cx={8.5} cy={8.5} r={1.5} fill="#94a3b8" />
                    <Path d="M21 15l-5-5L5 21" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <Text style={{ color: '#94a3b8', fontSize: 13 }}>Tap to add banner photo</Text>
                </TouchableOpacity>
              )}
            </View>

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
                      {filteredFriends.length === 0
                        ? <Text style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, marginTop: 8, marginBottom: 4 }}>No friends found.</Text>
                        : filteredFriends.map(friend => {
                          const sel = selectedFriendIds.includes(friend.id);
                          return (
                            <TouchableOpacity key={friend.id} style={[styles.friendSelectRow, sel && { backgroundColor: '#f0fdfa' }]} onPress={() => toggleFriend(friend.id)} activeOpacity={0.8}>
                              <FriendSelectAvatar uri={friend.uri} name={friend.name} style={styles.friendSelectAvatar as any} />
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
                        })
                      }
                    </>
                  )}
                  {memberTab === 'new' && (
                    <>
                      <Text style={[styles.ctLabel, { marginTop: 0 }]}>Email Address</Text>
                      <TextInput style={[styles.ctInput, { marginBottom: 8 }]} placeholder="Enter email address" placeholderTextColor="#94a3b8" value={inviteEmail} onChangeText={setInviteEmail} keyboardType="email-address" autoCapitalize="none" />
                      <Text style={styles.ctLabel}>Phone Number</Text>
                      <TextInput style={[styles.ctInput, { marginBottom: 8 }]} placeholder="Enter phone number" placeholderTextColor="#94a3b8" value={invitePhone} onChangeText={setInvitePhone} keyboardType="phone-pad" />
                      <Text style={styles.ctLabel}>WhatsApp Number</Text>
                      <TextInput style={[styles.ctInput, { marginBottom: 8 }]} placeholder="Enter WhatsApp number" placeholderTextColor="#94a3b8" value={inviteWhatsapp} onChangeText={setInviteWhatsapp} keyboardType="phone-pad" />
                      <TouchableOpacity
                        style={[styles.ctCreateBtn, { alignSelf: 'stretch', marginTop: 4 }]}
                        onPress={() => {
                          const hasAny = inviteEmail.trim() || invitePhone.trim() || inviteWhatsapp.trim();
                          if (hasAny) {
                            const via = [inviteEmail.trim() && 'email', invitePhone.trim() && 'phone', inviteWhatsapp.trim() && 'WhatsApp'].filter(Boolean).join(', ');
                            showAlert({ title: 'Invite sent!', message: `Invitation sent via ${via}` });
                            setInviteEmail(''); setInvitePhone(''); setInviteWhatsapp('');
                          }
                        }}
                        activeOpacity={0.85}>
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

        {/* Email Attachment Picker */}
        <Modal visible={showEmailPicker} transparent animationType="slide" onRequestClose={() => setShowEmailPicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalDialog, { maxHeight: '85%' }]}>
              <View style={styles.ctHeader}>
                <Text style={styles.ctTitle}>Import from {emailPickerProvider === 'gmail' ? 'Gmail' : 'Outlook'}</Text>
                <TouchableOpacity onPress={() => setShowEmailPicker(false)} style={styles.ctCloseBtn} activeOpacity={0.7}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path d="M18 6L6 18M6 6l12 12" stroke="#64748b" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </TouchableOpacity>
              </View>
              {emailPickerLoading ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="#0d9488" />
                  <Text style={{ marginTop: 12, color: '#64748b', fontSize: 13 }}>Loading attachments…</Text>
                </View>
              ) : emailAttachments.length === 0 ? (
                <View style={{ padding: 32, alignItems: 'center' }}>
                  <Text style={{ color: '#64748b', fontSize: 14, textAlign: 'center' }}>No attachments found in the last 30 days.</Text>
                </View>
              ) : (
                <FlatList
                  data={emailAttachments}
                  keyExtractor={a => a.attachmentId}
                  style={{ maxHeight: 360 }}
                  renderItem={({ item }) => {
                    const sel = selectedAttachIds.has(item.attachmentId);
                    return (
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderColor: '#e2e8f0' }}
                        onPress={() => setSelectedAttachIds(prev => { const n = new Set(prev); sel ? n.delete(item.attachmentId) : n.add(item.attachmentId); return n; })}
                        activeOpacity={0.7}>
                        <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: sel ? '#0d9488' : '#cbd5e1', backgroundColor: sel ? '#0d9488' : 'transparent', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                          {sel && <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✓</Text>}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '500', color: '#0f172a' }} numberOfLines={1}>{item.fileName}</Text>
                          {item.emailSubject ? <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }} numberOfLines={1}>{item.emailSubject}</Text> : null}
                          <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{Math.round(item.fileSizeBytes / 1024)} KB</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
              )}
              {!emailPickerLoading && emailAttachments.length > 0 && (
                <View style={[styles.ctFooter, { gap: 10 }]}>
                  <TouchableOpacity style={[styles.ctCreateBtn, { flex: 1, backgroundColor: '#f1f5f9' }]} onPress={() => setShowEmailPicker(false)} activeOpacity={0.85}>
                    <Text style={[styles.ctCreateBtnText, { color: '#0f172a' }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.ctCreateBtn, { flex: 1, opacity: selectedAttachIds.size === 0 ? 0.5 : 1 }]}
                    onPress={confirmEmailSelection}
                    disabled={selectedAttachIds.size === 0}
                    activeOpacity={0.85}>
                    <Text style={styles.ctCreateBtnText}>Add {selectedAttachIds.size > 0 ? `${selectedAttachIds.size} file${selectedAttachIds.size > 1 ? 's' : ''}` : 'Selected'}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>
      </Pressable>

      {/* Banner crop/preview modal */}
      <Modal
        visible={!!cropPreviewUri}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setCropPreviewUri(undefined)}
        onShow={() => {
          const s = cropState.current;
          s.scale = 1; s.x = 0; s.y = 0;
          s.lastDist = 0; s.lastX = 0; s.lastY = 0;
          cropScaleAnim.setValue(1);
          cropTransXAnim.setValue(0);
          cropTransYAnim.setValue(0);
        }}
      >
        {/*
          Layout:
            - Black full-screen background
            - Canvas area (flex:1) holds the image + crop overlay
            - Canvas uses onLayout to record actual pixel size → cropAreaSize
            - Image is centered in the canvas and sized to fill it (contain)
            - Crop box = card banner aspect ratio (CARD_BANNER_W : CARD_BANNER_H)
              constrained to canvas width so it never overflows
            - Zoom buttons + zoom % display
            - Cancel / Reset / Done action row
        */}
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {/* Canvas — full remaining height, pan+pinch target */}
          <View
            style={{ flex: 1, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              setCropAreaSize({ w: width, h: height });
            }}
            {...cropPanResponder.panHandlers}
          >
            {cropPreviewUri && (() => {
              // Size the image to fill the canvas while preserving aspect ratio (contain-style)
              const canvasW = cropAreaSize.w || SCREEN_W;
              const canvasH = cropAreaSize.h || SCREEN_W;
              const origAspect = pickedOrigSize.w / pickedOrigSize.h;
              let imgDisplayW: number, imgDisplayH: number;
              if (origAspect > canvasW / canvasH) {
                imgDisplayW = canvasW;
                imgDisplayH = canvasW / origAspect;
              } else {
                imgDisplayH = canvasH;
                imgDisplayW = canvasH * origAspect;
              }
              return (
                <Animated.Image
                  source={{ uri: cropPreviewUri }}
                  style={[
                    { width: imgDisplayW, height: imgDisplayH },
                    { transform: [{ translateX: cropTransXAnim }, { translateY: cropTransYAnim }, { scale: cropScaleAnim }] },
                  ]}
                  resizeMode="stretch"
                />
              );
            })()}

            {/* Crop overlay — absoluteFill + flex-center guarantees the box is
                exactly centered in the canvas, matching the Done handler's math
                (which assumes cropLeft = canvasCX - cropBoxW/2). Using plain
                position:'absolute' without top/left would place it at (0,0)
                in React Native Yoga, NOT centered. */}
            {(() => {
              const canvasW = cropAreaSize.w || SCREEN_W;
              const bannerAspect = CARD_BANNER_W / CARD_BANNER_H;
              const cropBoxW = Math.min(canvasW * 0.92, canvasW);
              const cropBoxH = cropBoxW / bannerAspect;
              return (
                <View
                  pointerEvents="none"
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}
                >
                  <View
                    style={{
                      width: cropBoxW,
                      height: cropBoxH,
                      borderWidth: 2,
                      borderColor: 'rgba(255,255,255,0.85)',
                      borderRadius: 8,
                    }}
                  >
                    {/* Rule-of-thirds grid lines */}
                    <View style={{ position: 'absolute', left: '33.3%', top: 0, bottom: 0, borderLeftWidth: 0.5, borderLeftColor: 'rgba(255,255,255,0.4)' }} />
                    <View style={{ position: 'absolute', left: '66.6%', top: 0, bottom: 0, borderLeftWidth: 0.5, borderLeftColor: 'rgba(255,255,255,0.4)' }} />
                    <View style={{ position: 'absolute', top: '33.3%', left: 0, right: 0, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.4)' }} />
                    <View style={{ position: 'absolute', top: '66.6%', left: 0, right: 0, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.4)' }} />
                  </View>
                </View>
              );
            })()}
          </View>

          {/* Action row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 40, paddingVertical: 28, backgroundColor: '#000' }}>
            <TouchableOpacity onPress={() => setCropPreviewUri(undefined)} activeOpacity={0.8}>
              <Text style={{ color: '#aaa', fontSize: 17, fontWeight: '500' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {
              const s = cropState.current;
              s.scale = 1; s.x = 0; s.y = 0;
              s.lastDist = 0; s.lastX = 0; s.lastY = 0;
              cropScaleAnim.setValue(1);
              cropTransXAnim.setValue(0);
              cropTransYAnim.setValue(0);
            }} activeOpacity={0.8}>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '500' }}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {
              /*
                BannerCropFraction — how to position the image inside the card.

                BannerImage renders the image as an absolute child of the card View:
                  left:   imgFracX * 100%  (fraction of cardW, can be negative)
                  top:    imgFracY * 100%  (fraction of cardH, can be negative)
                  width:  imgFracW * 100%  (fraction of cardW, typically > 1)
                  height: imgFracH * 100%  (fraction of cardH, typically > 1)
                  resizeMode="stretch"     (no extra scaling — fractions do it all)
                  parent overflow="hidden" clips to card bounds

                Derivation:
                  The card shows exactly what was inside the crop box.
                  cropBoxW must map to cardW  →  scale factor = cardW / cropBoxW
                  (expressed as fractions of cardW so cardW cancels out)

                  imgFracW = imgVisW / cropBoxW       (> 1 → image wider than card)
                  imgFracH = imgVisH / cropBoxH
                  imgFracX = (imgVisLeft − cropLeft) / cropBoxW  (< 0 → image shifts left)
                  imgFracY = (imgVisTop  − cropTop ) / cropBoxH
              */
              const s = cropState.current;
              const canvasW = cropAreaSize.w || SCREEN_W;
              const canvasH = cropAreaSize.h || SCREEN_W;
              const origAspect = pickedOrigSize.w / pickedOrigSize.h;
              let imgDisplayW: number, imgDisplayH: number;
              if (origAspect > canvasW / canvasH) {
                imgDisplayW = canvasW;
                imgDisplayH = canvasW / origAspect;
              } else {
                imgDisplayH = canvasH;
                imgDisplayW = canvasH * origAspect;
              }
              const bannerAspect = CARD_BANNER_W / CARD_BANNER_H;
              const cropBoxW = Math.min(canvasW * 0.92, canvasW);
              const cropBoxH = cropBoxW / bannerAspect;

              const canvasCX = canvasW / 2;
              const canvasCY = canvasH / 2;

              const imgVisW = imgDisplayW * s.scale;
              const imgVisH = imgDisplayH * s.scale;
              const imgVisLeft = canvasCX + s.x - imgVisW / 2;
              const imgVisTop = canvasCY + s.y - imgVisH / 2;

              const cropLeft = canvasCX - cropBoxW / 2;
              const cropTop = canvasCY - cropBoxH / 2;

              // Correct fractions: image position/size relative to card dimensions
              const imgFracW = imgVisW / cropBoxW;
              const imgFracH = imgVisH / cropBoxH;
              const imgFracX = (imgVisLeft - cropLeft) / cropBoxW;
              const imgFracY = (imgVisTop - cropTop) / cropBoxH;

              setBannerCropFraction({ imgFracX, imgFracY, imgFracW, imgFracH });
              setBannerImageUri(cropPreviewUri!);
              setBannerImageType(cropPreviewType);
              setCropPreviewUri(undefined);
            }} activeOpacity={0.8}>
              <Text style={{ color: '#0d9488', fontSize: 17, fontWeight: '600' }}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Info Popovers */}
      <DateInfoPopover visible={showStartDateTooltip} onClose={() => setShowStartDateTooltip(false)} iconX={startIconPos.x} iconY={startIconPos.y} />
      <DateInfoPopover visible={showEndDateTooltip} onClose={() => setShowEndDateTooltip(false)} iconX={endIconPos.x} iconY={endIconPos.y} />
    </Modal>
  );
}

// ─── Friend avatar with fallback ─────────────────────────────────────────────

function FriendSelectAvatar({ uri, name, style }: { uri: string; name: string; style: any }) {
  const [failed, setFailed] = useState(false);
  if (!uri || failed) {
    return (
      <View style={[style, { backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#94a3b8' }}>{name?.[0]?.toUpperCase() ?? '?'}</Text>
      </View>
    );
  }
  return <CachedImage uri={uri} style={style} resizeMode="cover" onError={() => setFailed(true)} />;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TripsScreen({ openCreateOnMount = false, onCreateMountHandled }: { openCreateOnMount?: boolean; onCreateMountHandled?: () => void } = {}) {
  const navigation = useNavigation<any>();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(false);
  const [tripsPage, setTripsPage] = useState(1);
  const [hasMoreTrips, setHasMoreTrips] = useState(false);
  const [showTripMenu, setShowTripMenu] = useState<string | null>(null);
  const [showCreateTrip, setShowCreateTrip] = useState(false);

  // Bug 3 fix: banner state lives here so it survives tab navigation and
  // Android image-picker activity restarts. Only cleared after successful creation.
  const [bannerImageUri, setBannerImageUri] = useState<string | undefined>(undefined);
  const [bannerImageType, setBannerImageType] = useState<string>('image/jpeg');
  const [bannerCropFraction, setBannerCropFraction] = useState<BannerCropFraction | null>(null);

  const { upcoming, ongoing, past } = categorizeTrips(trips);

  const avatarUpdatedAt = useAuthStore((s) => s.avatarUpdatedAt);
  const loadTripsRef = useRef<() => void>(() => { });
  useFocusEffect(useCallback(() => { loadTripsRef.current(); }, []));
  useEffect(() => {
    if (avatarUpdatedAt === 0) return;
    loadTripsRef.current();
  }, [avatarUpdatedAt]);

  // Open create trip modal if triggered from HomeScreen
  useEffect(() => {
    if (openCreateOnMount) {
      setShowCreateTrip(true);
      onCreateMountHandled?.();
    }
  }, [openCreateOnMount, onCreateMountHandled]);

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
    showConfirm({
      title: 'Archive Trip',
      message: `Archive "${trip.name}"? You can restore it from Archived Trips anytime.`,
      confirmText: 'Archive',
      onConfirm: async () => {
        try {
          await archiveTripApi(trip.id);
          setTrips(p => p.filter(t => t.id !== trip.id));
          Toast.show({ type: 'success', text1: 'Archived', text2: `"${trip.name}" moved to archive.` });
        } catch (err) {
          handleApiError(err);
        }
      },
    });
  }

  function deleteTrip(trip: Trip) {
    setShowTripMenu(null);
    showConfirm({
      title: 'Delete Trip',
      message: `Delete "${trip.name}"? This cannot be undone.`,
      destructive: true,
      onConfirm: async () => {
        try {
          await apiDeleteTrip(trip.id);
          setTrips(p => p.filter(t => t.id !== trip.id));
        } catch (err) {
          handleApiError(err);
        }
      },
    });
  }

  function toggleTripMenu(id: string) {
    setShowTripMenu(prev => prev === id ? null : id);
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        onScrollBeginDrag={() => setShowTripMenu(null)}>
        {/* Tap-outside backdrop — inside ScrollView so it shares stacking context with menus */}
        {showTripMenu !== null && (
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}
            onPress={() => setShowTripMenu(null)}
          />
        )}

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
            activeOpacity={0.85}>
            <Text style={styles.createTripBtnText}>Create Trip</Text>
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
        bannerImageUri={bannerImageUri}
        setBannerImageUri={setBannerImageUri}
        bannerImageType={bannerImageType}
        setBannerImageType={setBannerImageType}
        bannerCropFraction={bannerCropFraction}
        setBannerCropFraction={setBannerCropFraction}
        onSave={async (data) => {
          const cropFraction = data.bannerCropFraction as any;
          const res = await apiCreateTrip({
            name: data.name as string,
            startDate: (data.startDateISO ?? data.startDate ?? '') as string,
            endDate: (data.endDateISO ?? data.endDate ?? '') as string,
            location: { name: (data.location as string) || 'TBD' },
            friendIds: (data.friendIds as string[] | undefined)?.length ? data.friendIds as string[] : undefined,
            emails: data.inviteEmail ? [data.inviteEmail as string] : undefined,
            reminders: data.reminders as boolean | undefined,
            ...(cropFraction && { bannerCropFraction: cropFraction }),
          });
          let newTrip = res.trip;
          const localUri = data.bannerImageUrl as string | undefined;
          const isLocalUri = localUri && (localUri.startsWith('file://') || localUri.startsWith('content://') || localUri.startsWith('file:'));
          if (isLocalUri) {
            const tripWithBanner = mapApiTrip(newTrip);
            setTrips(p => [{ ...tripWithBanner, bannerImageUrl: localUri, bannerCropFraction: cropFraction || null }, ...p]);
            try {
              const photoRes = await uploadTripPhotos(newTrip.id, [{
                uri: localUri,
                type: (data.bannerImageType as string) ?? 'image/jpeg',
                name: `banner.${((data.bannerImageType as string) ?? 'image/jpeg').split('/')[1] ?? 'jpg'}`,
              }]);
              const photo = photoRes.photos?.[0];
              const permanentUrl = (photo as Record<string, unknown>)?.fileUrl as string ?? photo?.url;
              const displayUrl = photo?.url ?? permanentUrl;
              if (permanentUrl) {
                const updated = await apiUpdateTrip(newTrip.id, { bannerImageUrl: permanentUrl, ...(cropFraction && { bannerCropFraction: cropFraction }) });
                newTrip = updated.trip;
                setTrips(p => p.map(t => t.id === newTrip.id ? { ...t, bannerImageUrl: newTrip.bannerImageUrl ?? displayUrl } : t));
              }
            } catch (e: any) {
              console.warn('Banner upload failed:', e);
              showAlert({ title: 'Banner Upload Failed', message: 'Your trip was created but the cover image could not be saved. You can add it again from the trip page.' });
            }
          } else {
            setTrips(p => [mapApiTrip(newTrip), ...p]);
          }
          // Refresh trip list so memberAvatars are populated from the server
          loadTrips(1, true);
          // Import email attachments selected during creation
          const emailDocs = (data.emailDocs as { attachmentId: string; messageId: string; fileName: string; provider: 'gmail' | 'outlook' }[] | undefined) ?? [];
          if (emailDocs.length > 0) {
            const byProvider = emailDocs.reduce<Record<string, typeof emailDocs>>((acc, d) => {
              (acc[d.provider] = acc[d.provider] || []).push(d);
              return acc;
            }, {});
            for (const [provider, pdocs] of Object.entries(byProvider)) {
              try {
                await importEmailAttachments('trip', newTrip.id, provider as 'gmail' | 'outlook', pdocs);
              } catch {
                showAlert({ title: 'Email Import Failed', message: `Could not import ${pdocs.length} file(s) from ${provider}.` });
              }
            }
          }
          // Upload docs/photos attached during creation
          const extMime: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', mp4: 'video/mp4', mov: 'video/quicktime', pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', txt: 'text/plain', csv: 'text/csv' };
          const docs = (data.uploadedDocs as { uri: string; name: string; type: string }[] | undefined) ?? [];
          for (const file of docs) {
            const ext = (file.name.split('.').pop() ?? file.uri.split('.').pop() ?? '').toLowerCase();
            const resolvedType = file.type && file.type !== 'application/octet-stream' ? file.type : (extMime[ext] ?? 'application/octet-stream');
            const isImage = /^image\//i.test(resolvedType);
            try {
              if (isImage) {
                await uploadTripPhotos(newTrip.id, [{ uri: file.uri, type: resolvedType, name: file.name }]);
              } else {
                await uploadTripDoc(newTrip.id, { uri: file.uri, type: resolvedType, name: file.name });
              }
            } catch (e: any) {
              console.warn('Doc/photo upload failed:', e);
              showAlert({ title: 'Upload Failed', message: `Could not upload "${file.name}": ${e?.message ?? 'Unknown error'}` });
            }
          }
          // Clear banner only after the trip is successfully created
          setBannerImageUri(undefined);
          setBannerImageType('image/jpeg');
          setBannerCropFraction(null);
        }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 4 },

  // Trips Tab
  tripsCTA: { alignItems: 'center', marginTop: 18, marginBottom: 8, gap: 16 },
  tripsPlaneCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#cbfbf1',
    alignItems: 'center', justifyContent: 'center',
  },
  tripsCTATitle: { fontFamily: 'Inter', fontSize: 20, fontWeight: '400', color: '#0F172B', textAlign: 'center', lineHeight: 28, letterSpacing: 0, width: 266 },
  tripsCTASub: { fontFamily: 'Inter', fontSize: 16, fontWeight: '400', color: '#45556C', textAlign: 'center', lineHeight: 20, letterSpacing: 0, width: 316 },
  createTripBtn: {
   flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#009788', borderRadius: 999,
    width: 130, height: 40, gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  createTripBtnText: {  color: '#fff', fontSize: 14, fontWeight: '500', lineHeight: 20, textAlign: 'center' },
 tripsListHeader: { marginBottom: 16, paddingTop: 16 },
  tripsListTitle: {     fontFamily: 'Inter', fontSize: 16, fontWeight: '400', color: '#0F172B',
   lineHeight: 24, letterSpacing: 0 },
  tripsListSub: { fontSize: 15, fontWeight: '400', color: '#45556C', lineHeight: 19, letterSpacing: 0, marginTop: 2, marginBottom: 8 },
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
    position: 'absolute', bottom: 10, right: 10, flexDirection: 'row', alignItems: 'center',
  },
  miniAvatar: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: '#fff' },
  moreCounter: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#0d9488', borderWidth: 1.5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  moreCounterText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  cardBody: { padding: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardMain: { flex: 1, paddingRight: 8 },
  cardTitle: { fontSize: 16, fontWeight: '400', color: '#009788', marginBottom: 4, lineHeight: 22 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  infoText: { fontSize: 12, color: '#475569', fontWeight: '400' },
  daysBadge: { alignItems: 'flex-end', justifyContent: 'center', minWidth: 44 },
  daysNumber: { fontSize: 28, fontWeight: '700', color: '#0d9488', lineHeight: 32 },
  daysLabel: { fontSize: 8, color: '#94a3b8', fontWeight: '600', textAlign: 'right', letterSpacing: 0.5 },

  // Trip Menu Dropdown
  tripMenuDropdown: {
    position: 'absolute', top: 12, right: 48, width: 148,
    backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 12,
    elevation: 10, overflow: 'hidden', zIndex: 200,
  },
  tripMenuItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  tripMenuItemText: { fontSize: 12, color: '#334155', fontWeight: '500' },

  // Past Trip Card
  pastCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  pastCardImage: { width: 66, height: 66, borderRadius: 12, resizeMode: 'cover', flexShrink: 0 },
  pastCardInfo: { flex: 1, gap: 3 },
  pastCardTitle: { fontSize: 14, fontWeight: '400', color: '#009788', marginBottom: 2 },
  pastCardRight: { alignItems: 'center', justifyContent: 'flex-end' },
  pastAvatarsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pastAvatars: { flexDirection: 'row' },
  pastMiniAvatar: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#fff' },
  pastMoreBtn: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#f8fafc',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0',
  },
  pastExtraBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#E8F8F8', borderWidth: 1.5, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  pastExtraText: {
    fontSize: 8, fontWeight: '700' as const, color: '#0d9488',
  },

  // Empty State
  emptyState: { alignItems: 'center', paddingTop: 32, gap: 12 },
  emptyStateSubtitle: { fontSize: 14, color: '#94a3b8', textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  modalDialog: { backgroundColor: '#fff', borderRadius: 24, width: '100%', maxHeight: '90%', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 12 },

  // Create Trip Modal
  ctHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  ctTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  ctCloseBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  ctScrollContent: { paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
  ctLabel: { fontSize: 13, fontWeight: '400', color: '#0f172a', marginTop: 4 },
  ctInput: { borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#0f172a', backgroundColor: '#fff' },
  ctDateRow: { flexDirection: 'row', gap: 12, marginBottom: 0 },
  ctDateBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  ctDateText: { flex: 1, fontSize: 13, color: '#0f172a' },
  ctLocationBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  ctRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  ctRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  ctRowIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#2dd4bf', alignItems: 'center', justifyContent: 'center' },
  ctRowText: { fontSize: 13, fontWeight: '400', color: '#0f172a' },
  ctRowSub: { fontSize: 11, color: '#94a3b8' },
  ctCountBadge: { backgroundColor: '#ccfbf1', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  ctCountBadgeText: { fontSize: 11, color: '#0f766e', fontWeight: '500' },
  ctDocChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#a7f3d0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  ctDocChipText: { flex: 1, fontSize: 12, color: '#334155' },
  ctDocRemove: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' },
  ctFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  ctCancelText: { fontSize: 13, fontWeight: '500', color: '#0f172a', textDecorationLine: 'underline' },
  ctCreateBtn: { backgroundColor: '#0d9488', borderRadius: 999, paddingHorizontal: 28, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  ctCreateBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Invite modal tabs
  inviteTabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  inviteTab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  inviteTabActive: { borderBottomWidth: 2, borderBottomColor: '#0d9488', backgroundColor: '#f0fdfa' },
  inviteTabText: { fontSize: 13, fontWeight: '500', color: '#64748b' },
  inviteTabTextActive: { color: '#0d9488' },
  friendSelectRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 10, marginBottom: 4 },
  friendSelectAvatar: { width: 44, height: 44, borderRadius: 22 },
  checkCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#0d9488', alignItems: 'center', justifyContent: 'center' },
  friendName: { fontSize: 13, fontWeight: '400', color: '#0f172a' },
  friendHandle: { fontSize: 13, color: '#64748b', marginTop: 2 },
});
