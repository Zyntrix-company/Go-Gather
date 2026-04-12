import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  Modal, TextInput, Platform, PermissionsAndroid, ActivityIndicator, Image,
  RefreshControl, NativeModules, Animated, PanResponder, Dimensions, SafeAreaView,
} from 'react-native';
import Svg, { Rect, Path, Circle } from 'react-native-svg';

const { width: SCREEN_W } = Dimensions.get('window');

type BannerCropFraction = {
  imgFracX: number;
  imgFracY: number;
  imgFracW: number;
  imgFracH: number;
};
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { launchImageLibrary } from 'react-native-image-picker';
import Geolocation from '@react-native-community/geolocation';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { EventCard, EventCardPast, CardData } from '../../components/common/Cards';
import colors from '../../theme/colors';
import { getFriends } from '../../api/trips.api';
import {
  getEvents,
  createEvent as apiCreateEvent,
  updateEvent as apiUpdateEvent,
  archiveEvent as apiArchiveEvent,
  deleteEvent as apiDeleteEvent,
  handleApiError,
  Event as ApiEvent,
  uploadEventDoc,
  uploadEventPhotos,
} from '../../api/events.api';

// ─── Types ────────────────────────────────────────────────────────────────────

type EventItem = {
  id: string;
  name: string;
  type: string;
  typeColor: string;
  location: string;
  dateISO: string;
  dateDisplay: string;
  dateDisplayNoYear: string;
  memberCount: number;
  memberAvatars: string[];
  description: string;
  bannerImageUrl?: string | null;
  bannerCropFraction?: BannerCropFraction | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  'Wedding', 'Birthday', 'Party', 'Professional',
  'Meetup', 'Festival', 'Family', 'Sports', 'Religious', 'Other',
];

const TYPE_COLORS: Record<string, string> = {
  Wedding: '#fdf2f8', Birthday: '#fef3c7', Party: '#ede9fe',
  Professional: '#e0f2fe', Meetup: '#f0fdf4', Festival: '#ccfbf1',
  Family: '#fff7ed', Sports: '#fef2f2', Religious: '#f5f3ff', Other: '#f8fafc',
};

const CT_FRIENDS: { id: string; name: string; email: string; uri: string }[] = [
  { id: '1', name: 'Yuki Tanaka', email: 'yuki_tanaka@example.com', uri: 'https://i.pravatar.cc/150?img=32' },
  { id: '2', name: 'Amara Okafor', email: 'amara2025@example.com', uri: 'https://i.pravatar.cc/150?img=38' },
  { id: '3', name: 'Marcus Johnson', email: 'marcusj_nyc@example.com', uri: 'https://i.pravatar.cc/150?img=13' },
  { id: '4', name: 'Priya Sharma', email: 'priya.sharma@example.com', uri: 'https://i.pravatar.cc/150?img=45' },
  { id: '5', name: 'Carlos Rodriguez', email: 'carlos.r@example.com', uri: 'https://i.pravatar.cc/150?img=12' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntil(isoDate: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(isoDate);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function fmtDateDisplay(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateNoYear(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function fmtDateISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

function mapApiEvent(e: ApiEvent): EventItem {
  const eventDate = new Date(e.eventDate);
  return {
    id: e.id,
    name: e.name,
    type: e.eventType ?? 'Other',
    typeColor: TYPE_COLORS[e.eventType ?? 'Other'] ?? '#f8fafc',
    location: e.location?.name ?? '',
    dateISO: e.eventDate,
    dateDisplay: eventDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    dateDisplayNoYear: fmtDateNoYear(eventDate),
    memberCount: e.memberCount ?? 1,
    memberAvatars: e.memberAvatars ?? [],
    description: e.description ?? '',
    bannerImageUrl: e.bannerImageUrl ?? null,
  };
}

function toCardData(ev: EventItem): CardData {
  const days = daysUntil(ev.dateISO);
  return {
    id: ev.id,
    name: ev.name,
    location: ev.location,
    fullDate: days > 0 ? ev.dateDisplayNoYear : ev.dateDisplay,
    image: require('../../assets/images/music_festival.png'),
    bannerImageUrl: ev.bannerImageUrl ?? null,
    members: ev.memberAvatars.slice(0, 3).map((uri, idx) => ({ id: `av-${idx}`, uri })),
    extraMembers: ev.memberAvatars.length === 0 ? ev.memberCount : Math.max(0, ev.memberCount - 3),
    type: ev.type,
    daysToGo: days > 0 ? days : undefined,
  };
}

// ─── Create Event Modal ───────────────────────────────────────────────────────

function CreateEventModal({ visible, onClose, onSave }: {
  visible: boolean; onClose: () => void; onSave: (ev: EventItem) => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState('Other');
  const [showTypeDrop, setShowTypeDrop] = useState(false);
  const [dateObj, setDateObj] = useState<Date | undefined>(undefined);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [location, setLocation] = useState('');
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<{ uri: string; name: string; type: string }[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [apiFriends, setApiFriends] = useState<typeof CT_FRIENDS>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [memberTab, setMemberTab] = useState<'friends' | 'new'>('friends');
  const [friendSearch, setFriendSearch] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [bannerImageUri, setBannerImageUri] = useState<string | undefined>(undefined);
  const [bannerCropFraction, setBannerCropFraction] = useState<BannerCropFraction | null>(null);
  const [cropPreviewUri, setCropPreviewUri] = useState<string | undefined>(undefined);
  const [pickedOrigSize, setPickedOrigSize] = useState({ w: 1, h: 1 });
  const [cropAreaSize, setCropAreaSize] = useState({ w: SCREEN_W, h: SCREEN_W });

  const CARD_BANNER_W = SCREEN_W - 40;
  const CARD_BANNER_H = 144;

  const cropScaleAnim  = useRef(new Animated.Value(1)).current;
  const cropTransXAnim = useRef(new Animated.Value(0)).current;
  const cropTransYAnim = useRef(new Animated.Value(0)).current;
  const cropState = useRef({ scale: 1, x: 0, y: 0, lastDist: 0, lastMidX: 0, lastMidY: 0, lastX: 0, lastY: 0 });

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
      if (touches.length >= 2) {
        s.lastDist = cropTouchDist(touches);
        s.lastMidX = (touches[0].pageX + touches[1].pageX) / 2;
        s.lastMidY = (touches[0].pageY + touches[1].pageY) / 2;
        s.lastX = s.lastMidX; s.lastY = s.lastMidY;
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
        const dist = cropTouchDist(touches);
        const midX = (touches[0].pageX + touches[1].pageX) / 2;
        const midY = (touches[0].pageY + touches[1].pageY) / 2;
        if (s.lastDist > 0) {
          s.scale = Math.max(0.25, Math.min(s.scale * (dist / s.lastDist), 8));
          cropScaleAnim.setValue(s.scale);
          s.x += midX - s.lastMidX; s.y += midY - s.lastMidY;
          cropTransXAnim.setValue(s.x); cropTransYAnim.setValue(s.y);
        }
        s.lastDist = dist; s.lastMidX = midX; s.lastMidY = midY;
        s.lastX = midX; s.lastY = midY;
      } else {
        const tx = touches[0]?.pageX ?? s.lastX;
        const ty = touches[0]?.pageY ?? s.lastY;
        s.x += tx - s.lastX; s.y += ty - s.lastY;
        cropTransXAnim.setValue(s.x); cropTransYAnim.setValue(s.y);
        s.lastX = tx; s.lastY = ty; s.lastDist = 0;
      }
    },
    onPanResponderRelease: () => { cropState.current.lastDist = 0; },
  })).current;

  useEffect(() => {
    if (!showInviteModal) return;
    getFriends(friendSearch || undefined).then(data => {
      const mapped = data.friends.map((f: any) => ({
        id: f.user.id,
        name: f.user.name,
        email: '',
        uri: f.user.avatarUrl ?? `https://i.pravatar.cc/150?u=${f.user.id}`,
      }));
      setApiFriends(mapped);
    }).catch(() => {});
  }, [showInviteModal]);

  const filteredFriends = apiFriends.filter(f =>
    f.name.toLowerCase().includes(friendSearch.toLowerCase()) ||
    f.email.toLowerCase().includes(friendSearch.toLowerCase())
  );

  function reset() {
    setName(''); setType('Other'); setShowTypeDrop(false);
    setDateObj(undefined); setShowDatePicker(false);
    setLocation(''); setFetchingLocation(false);
    setUploadedDocs([]); setSelectedFriendIds([]);
    setShowInviteModal(false); setShowEmailModal(false);
    setMemberTab('friends'); setFriendSearch(''); setInviteEmail('');
    setBannerImageUri(undefined); setBannerCropFraction(null);
    setCropPreviewUri(undefined);
  }

  async function handleSave() {
    if (!name.trim()) { Alert.alert('Error', 'Please enter an event name'); return; }
    if (!dateObj) { Alert.alert('Error', 'Please select an event date'); return; }
    if (!location.trim()) { Alert.alert('Error', 'Please enter a location'); return; }
    setIsSubmitting(true);
    try {
      const result = await apiCreateEvent({
        name: name.trim(),
        eventDate: fmtDateISO(dateObj),
        eventType: type,
        location: { name: location.trim() },
        friendIds: selectedFriendIds.length > 0 ? selectedFriendIds : undefined,
        reminders: true,
      });
      const newEvent: EventItem = {
        id: result.event.id,
        name: result.event.name,
        type: result.event.eventType ?? type,
        typeColor: TYPE_COLORS[result.event.eventType ?? type] ?? '#f8fafc',
        location: result.event.location?.name ?? location.trim(),
        dateISO: result.event.eventDate,
        dateDisplay: fmtDateDisplay(dateObj),
        dateDisplayNoYear: fmtDateNoYear(dateObj),
        memberCount: result.memberCount ?? 1 + selectedFriendIds.length,
        memberAvatars: [],
        description: result.event.description ?? '',
        bannerImageUrl: null,
        bannerCropFraction: bannerCropFraction,
      };
      // Upload banner → photos module → get CDN URL → save to banner_image_url
      const localBannerUri = bannerImageUri;
      const isLocalUri = localBannerUri && (localBannerUri.startsWith('file://') || localBannerUri.startsWith('content://'));
      if (isLocalUri) {
        newEvent.bannerImageUrl = localBannerUri; // show locally while uploading
        try {
          const ext = localBannerUri.split('.').pop()?.toLowerCase() ?? 'jpg';
          const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', webp: 'image/webp' };
          const mime = mimeMap[ext] ?? 'image/jpeg';
          const photoRes = await uploadEventPhotos(newEvent.id, [{ uri: localBannerUri, type: mime, name: `banner.${ext}` }]);
          const photo = photoRes.photos?.[0];
          const permanentUrl = (photo as any)?.fileUrl as string ?? photo?.url;
          if (permanentUrl) {
            await apiUpdateEvent(newEvent.id, { bannerImageUrl: permanentUrl });
            newEvent.bannerImageUrl = permanentUrl;
          }
        } catch (e) { console.warn('Banner upload failed:', e); }
      }
      // Upload docs — images → photos module, everything else → docs module
      const extMime: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', mp4: 'video/mp4', mov: 'video/quicktime', pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', txt: 'text/plain', csv: 'text/csv' };
      const docs = [...uploadedDocs];
      for (const file of docs) {
        const ext = (file.name.split('.').pop() ?? file.uri.split('.').pop() ?? '').toLowerCase();
        const resolvedType = file.type && file.type !== 'application/octet-stream' ? file.type : (extMime[ext] ?? 'application/octet-stream');
        const isImage = /^image\//i.test(resolvedType);
        try {
          if (isImage) {
            await uploadEventPhotos(newEvent.id, [{ uri: file.uri, type: resolvedType, name: file.name }]);
          } else {
            await uploadEventDoc(newEvent.id, { uri: file.uri, type: resolvedType, name: file.name });
          }
        } catch (e: any) {
          console.warn('Doc upload failed:', e);
          Alert.alert('Upload Failed', `Could not upload "${file.name}": ${e?.message ?? 'Unknown error'}`);
        }
      }
      onSave(newEvent);
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
      if (!FilePicker) { Alert.alert('Not Available', 'File picker requires a fresh build.'); return; }
      const file: { uri: string; name: string; type: string } = await FilePicker.pick();
      if (!file?.uri) return;
      setUploadedDocs(p => [...p, { uri: file.uri, name: file.name ?? `file_${Date.now()}`, type: file.type ?? 'application/octet-stream' }]);
    } catch (err: any) {
      if (err?.code === 'CANCELLED' || err?.message === 'User cancelled') return;
      Alert.alert('Error', 'Could not open file picker.');
    }
  }

  async function handleFetchLocation() {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          { title: 'Location Permission', message: 'GatherGo needs your location for the event location.', buttonPositive: 'Allow', buttonNegative: 'Deny' }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission Denied', 'Please type your location manually.');
          return;
        }
      } catch {
        Alert.alert('Permission Error', 'Could not request location permission.');
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
            a.state, a.country,
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
          Alert.alert('Location Unavailable', 'Please enable GPS and try again, or type your location manually.');
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={modal.overlay}>
        <View style={modal.dialog}>

          {/* Header */}
          <View style={modal.header}>
            <Text style={modal.title}>Create New Event</Text>
            <TouchableOpacity onPress={onClose} style={modal.closeBtn} activeOpacity={0.7}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M18 6L6 18M6 6l12 12" stroke="#64748b" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={modal.scrollContent}>

            {/* Event Name */}
            <Text style={modal.label}>Event Name</Text>
            <TextInput
              style={modal.input}
              placeholder="e.g., Birthday Celebration"
              placeholderTextColor="#94a3b8"
              value={name}
              onChangeText={setName}
            />

            {/* Event Type */}
            <Text style={modal.label}>Event Type</Text>
            <TouchableOpacity style={[modal.input, modal.row]} onPress={() => setShowTypeDrop(p => !p)} activeOpacity={0.8}>
              <Text style={{ fontSize: 14, color: '#0f172a', flex: 1 }}>{type}</Text>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d={showTypeDrop ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
            {showTypeDrop && (
              <View style={modal.dropdown}>
                {EVENT_TYPES.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[modal.dropItem, type === t && modal.dropItemActive]}
                    onPress={() => { setType(t); setShowTypeDrop(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[modal.dropItemText, type === t && modal.dropItemTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Event Date */}
            <Text style={modal.label}>Event Date</Text>
            <TouchableOpacity style={[modal.input, modal.row]} onPress={() => setShowDatePicker(true)} activeOpacity={0.8}>
              <Text style={{ fontSize: 14, color: dateObj ? '#0f172a' : '#94a3b8', flex: 1 }}>
                {dateObj ? fmtDateDisplay(dateObj) : 'DD/MM/YY'}
              </Text>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Rect x={3} y={4} width={18} height={18} rx={2} stroke="#94a3b8" strokeWidth={1.8} />
                <Path d="M16 2v4M8 2v4M3 10h18" stroke="#94a3b8" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={dateObj ?? new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_: DateTimePickerEvent, d?: Date) => {
                  if (Platform.OS === 'android') setShowDatePicker(false);
                  if (d) setDateObj(d);
                  else setShowDatePicker(false);
                }}
              />
            )}

            {/* Location with GPS */}
            <Text style={modal.label}>Location</Text>
            <View style={modal.locationBox}>
              <TextInput
                style={{ flex: 1, fontSize: 13, color: '#0f172a' }}
                placeholder="Search or tap pin for GPS"
                placeholderTextColor="#94a3b8"
                value={location}
                onChangeText={setLocation}
              />
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
            <TouchableOpacity style={modal.ctRow} onPress={handleUploadDocs} activeOpacity={0.8}>
              <View style={modal.ctRowLeft}>
                <View style={modal.ctRowIcon}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
                <View>
                  <Text style={modal.ctRowText}>Upload Docs</Text>
                  <Text style={modal.ctRowSub}>(PDF, JPG, PNG)</Text>
                </View>
              </View>
              {uploadedDocs.length > 0 && (
                <View style={modal.ctCountBadge}>
                  <Text style={modal.ctCountBadgeText}>{uploadedDocs.length} file{uploadedDocs.length > 1 ? 's' : ''}</Text>
                </View>
              )}
            </TouchableOpacity>
            {uploadedDocs.map((doc, i) => (
              <View key={i} style={modal.ctDocChip}>
                <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                  <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={modal.ctDocChipText} numberOfLines={1}>{doc.name}</Text>
                <TouchableOpacity onPress={() => setUploadedDocs(p => p.filter((_, j) => j !== i))}>
                  <View style={modal.ctDocRemove}>
                    <Svg width={9} height={9} viewBox="0 0 24 24" fill="none">
                      <Path d="M18 6L6 18M6 6l12 12" stroke="#ef4444" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </View>
                </TouchableOpacity>
              </View>
            ))}

            {/* Extract Docs from Email */}
            <TouchableOpacity style={modal.ctRow} onPress={() => setShowEmailModal(true)} activeOpacity={0.8}>
              <View style={modal.ctRowLeft}>
                <View style={modal.ctRowIcon}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M22 6l-10 7L2 6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
                <Text style={modal.ctRowText}>Extract Docs from Email</Text>
              </View>
            </TouchableOpacity>

            {/* Invite Group Members */}
            <TouchableOpacity style={modal.ctRow} onPress={() => setShowInviteModal(true)} activeOpacity={0.8}>
              <View style={modal.ctRowLeft}>
                <View style={modal.ctRowIcon}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M12 7a4 4 0 100 8 4 4 0 000-8zM20 8v6M23 11h-6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
                <Text style={modal.ctRowText}>Invite Group Members</Text>
              </View>
              {selectedFriendIds.length > 0 && (
                <View style={modal.ctCountBadge}>
                  <Text style={modal.ctCountBadgeText}>{selectedFriendIds.length} invited</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Banner Image */}
            <Text style={[modal.label, { marginTop: 4 }]}>Banner Image <Text style={{ color: '#94a3b8', fontWeight: '400' }}>(optional)</Text></Text>
            <View style={{ width: '100%', height: 140, borderRadius: 12, backgroundColor: '#f1f5f9', overflow: 'hidden', marginBottom: 14, borderWidth: bannerImageUri ? 0 : 1, borderColor: '#e2e8f0', borderStyle: 'dashed' }}>
              {bannerImageUri ? (
                <>
                  <Image source={{ uri: bannerImageUri }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} resizeMode="cover" />
                  <TouchableOpacity
                    style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}
                    onPress={() => {
                      setIsCompressing(true);
                      launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, includeBase64: false, presentationStyle: 'fullScreen', maxWidth: 1280, maxHeight: 720, quality: 0.7 }, res => {
                        setIsCompressing(false);
                        if (res.didCancel || res.errorCode) return;
                        const asset = res.assets?.[0];
                        if (asset?.uri) {
                          setPickedOrigSize({ w: asset.width ?? 1280, h: asset.height ?? 720 });
                          setCropPreviewUri(asset.uri);

                          setBannerCropFraction(null);
                        }
                      });
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>Change</Text>
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
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <ActivityIndicator size="small" color="#0d9488" />
                  <Text style={{ color: '#64748b', fontSize: 13 }}>Compressing image…</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  onPress={() => {
                    setIsCompressing(true);
                    launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, includeBase64: false, presentationStyle: 'fullScreen', maxWidth: 1280, maxHeight: 720, quality: 0.7 }, res => {
                      setIsCompressing(false);
                      if (res.didCancel || res.errorCode) return;
                      const asset = res.assets?.[0];
                      if (asset?.uri) {
                        setPickedOrigSize({ w: asset.width ?? 1280, h: asset.height ?? 720 });
                        setCropPreviewUri(asset.uri);
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

          {/* Footer */}
          <View style={modal.footer}>
            <TouchableOpacity onPress={() => { reset(); onClose(); }} activeOpacity={0.7}>
              <Text style={modal.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modal.createBtn, isSubmitting && { opacity: 0.7 }]}
              onPress={handleSave}
              activeOpacity={0.85}
              disabled={isSubmitting}
            >
              <Text style={modal.createBtnTxt}>{isSubmitting ? 'Creating...' : 'Create Event'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Invite Members Sub-Modal ── */}
      {showInviteModal && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowInviteModal(false)}>
          <View style={modal.overlay}>
            <View style={[modal.dialog, { maxHeight: '85%' }]}>
              <View style={[modal.header, { backgroundColor: '#f0fdfa' }]}>
                <Text style={modal.title}>Invite Members</Text>
                <TouchableOpacity onPress={() => setShowInviteModal(false)} style={modal.closeBtn} activeOpacity={0.7}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path d="M18 6L6 18M6 6l12 12" stroke="#64748b" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </TouchableOpacity>
              </View>
              <View style={modal.inviteTabBar}>
                <TouchableOpacity style={[modal.inviteTab, memberTab === 'friends' && modal.inviteTabActive]} onPress={() => setMemberTab('friends')}>
                  <Text style={[modal.inviteTabText, memberTab === 'friends' && modal.inviteTabTextActive]}>Friends</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[modal.inviteTab, memberTab === 'new' && modal.inviteTabActive]} onPress={() => setMemberTab('new')}>
                  <Text style={[modal.inviteTabText, memberTab === 'new' && modal.inviteTabTextActive]}>Invite New</Text>
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={{ padding: 14 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {memberTab === 'friends' && (
                  <>
                    <TextInput
                      style={[modal.input, { marginBottom: 12 }]}
                      placeholder="Search friends..."
                      placeholderTextColor="#94a3b8"
                      value={friendSearch}
                      onChangeText={setFriendSearch}
                    />
                    {filteredFriends.length === 0
                      ? <Text style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, marginTop: 8, marginBottom: 4 }}>No friends found.</Text>
                      : filteredFriends.map(friend => {
                        const sel = selectedFriendIds.includes(friend.id);
                        return (
                          <TouchableOpacity
                            key={friend.id}
                            style={[modal.friendSelectRow, sel && { backgroundColor: '#f0fdfa' }]}
                            onPress={() => toggleFriend(friend.id)}
                            activeOpacity={0.8}
                          >
                            <View style={modal.friendAvatar}>
                              <Text style={modal.friendAvatarText}>{friend.name[0]}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={modal.friendName}>{friend.name}</Text>
                              <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{friend.email}</Text>
                            </View>
                            {sel && (
                              <View style={modal.checkCircle}>
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
                    <Text style={[modal.label, { marginTop: 0 }]}>Email Address</Text>
                    <TextInput
                      style={modal.input}
                      placeholder="Enter email address"
                      placeholderTextColor="#94a3b8"
                      value={inviteEmail}
                      onChangeText={setInviteEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={[modal.createBtn, { alignSelf: 'stretch', marginTop: 8 }]}
                      onPress={() => { if (inviteEmail.trim()) { Alert.alert('Invite sent!', `Invitation sent to ${inviteEmail}`); setInviteEmail(''); } }}
                      activeOpacity={0.85}
                    >
                      <Text style={modal.createBtnTxt}>Send Invitation</Text>
                    </TouchableOpacity>
                  </>
                )}
              </ScrollView>
              <View style={[modal.footer, { borderTopWidth: 1, borderTopColor: '#f1f5f9' }]}>
                <TouchableOpacity style={[modal.createBtn, { flex: 1 }]} onPress={() => setShowInviteModal(false)} activeOpacity={0.85}>
                  <Text style={modal.createBtnTxt}>Done ({selectedFriendIds.length} selected)</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ── Extract from Email Sub-Modal ── */}
      {showEmailModal && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowEmailModal(false)}>
          <View style={modal.overlay}>
            <View style={modal.dialog}>
              <View style={modal.header}>
                <Text style={modal.title}>Extract from Email</Text>
                <TouchableOpacity onPress={() => setShowEmailModal(false)} style={modal.closeBtn} activeOpacity={0.7}>
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
                  We'll extract event invitations, venue bookings, and other documents automatically.
                </Text>
                <View style={{ backgroundColor: '#fff7ed', borderRadius: 12, borderWidth: 1.5, borderColor: '#fed7aa', padding: 12, width: '100%' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#92400e' }}>📧 Demo Mode</Text>
                  <Text style={{ fontSize: 11, color: '#b45309', marginTop: 3 }}>In production, this connects to Gmail/Outlook to extract attachments.</Text>
                </View>
              </View>
              <View style={[modal.footer, { gap: 10 }]}>
                <TouchableOpacity style={[modal.createBtn, { flex: 1, backgroundColor: '#f1f5f9' }]} onPress={() => setShowEmailModal(false)} activeOpacity={0.85}>
                  <Text style={[modal.createBtnTxt, { color: '#0f172a' }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[modal.createBtn, { flex: 1, backgroundColor: '#ea580c' }]}
                  onPress={() => { setShowEmailModal(false); Alert.alert('Success', 'Extracted 2 documents from email!'); }}
                  activeOpacity={0.85}
                >
                  <Text style={modal.createBtnTxt}>Extract Docs</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* ── Banner crop/preview modal ── */}
      <Modal
        visible={!!cropPreviewUri}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setCropPreviewUri(undefined)}
        onShow={() => {
          const s = cropState.current;
          s.scale = 1; s.x = 0; s.y = 0; s.lastDist = 0; s.lastX = 0; s.lastY = 0;
          cropScaleAnim.setValue(1); cropTransXAnim.setValue(0); cropTransYAnim.setValue(0);
        }}
      >
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <View
            style={{ flex: 1, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}
            onLayout={(e) => { const { width, height } = e.nativeEvent.layout; setCropAreaSize({ w: width, h: height }); }}
            {...cropPanResponder.panHandlers}
          >
            {cropPreviewUri && (() => {
              const canvasW = cropAreaSize.w || SCREEN_W;
              const canvasH = cropAreaSize.h || SCREEN_W;
              const origAspect = pickedOrigSize.w / pickedOrigSize.h;
              let imgDisplayW: number, imgDisplayH: number;
              if (origAspect > canvasW / canvasH) {
                imgDisplayW = canvasW; imgDisplayH = canvasW / origAspect;
              } else {
                imgDisplayH = canvasH; imgDisplayW = canvasH * origAspect;
              }
              return (
                <Animated.Image
                  source={{ uri: cropPreviewUri }}
                  style={[{ width: imgDisplayW, height: imgDisplayH }, { transform: [{ translateX: cropTransXAnim }, { translateY: cropTransYAnim }, { scale: cropScaleAnim }] }]}
                  resizeMode="stretch"
                />
              );
            })()}
            {(() => {
              const canvasW = cropAreaSize.w || SCREEN_W;
              const cropBoxW = Math.min(canvasW * 0.92, canvasW);
              const cropBoxH = cropBoxW / (CARD_BANNER_W / CARD_BANNER_H);
              return (
                <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: cropBoxW, height: cropBoxH, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)', borderRadius: 8 }}>
                    <View style={{ position: 'absolute', left: '33.3%', top: 0, bottom: 0, borderLeftWidth: 0.5, borderLeftColor: 'rgba(255,255,255,0.4)' }} />
                    <View style={{ position: 'absolute', left: '66.6%', top: 0, bottom: 0, borderLeftWidth: 0.5, borderLeftColor: 'rgba(255,255,255,0.4)' }} />
                    <View style={{ position: 'absolute', top: '33.3%', left: 0, right: 0, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.4)' }} />
                    <View style={{ position: 'absolute', top: '66.6%', left: 0, right: 0, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.4)' }} />
                  </View>
                </View>
              );
            })()}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 40, paddingVertical: 28, backgroundColor: '#000' }}>
            <TouchableOpacity onPress={() => setCropPreviewUri(undefined)} activeOpacity={0.8}>
              <Text style={{ color: '#aaa', fontSize: 17, fontWeight: '500' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {
              const s = cropState.current;
              s.scale = 1; s.x = 0; s.y = 0; s.lastDist = 0; s.lastX = 0; s.lastY = 0;
              cropScaleAnim.setValue(1); cropTransXAnim.setValue(0); cropTransYAnim.setValue(0);
            }} activeOpacity={0.8}>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '500' }}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {
              const s = cropState.current;
              const canvasW = cropAreaSize.w || SCREEN_W;
              const canvasH = cropAreaSize.h || SCREEN_W;
              const origAspect = pickedOrigSize.w / pickedOrigSize.h;
              let imgDisplayW: number, imgDisplayH: number;
              if (origAspect > canvasW / canvasH) {
                imgDisplayW = canvasW; imgDisplayH = canvasW / origAspect;
              } else {
                imgDisplayH = canvasH; imgDisplayW = canvasH * origAspect;
              }
              const cropBoxW = Math.min(canvasW * 0.92, canvasW);
              const cropBoxH = cropBoxW / (CARD_BANNER_W / CARD_BANNER_H);
              const canvasCX = canvasW / 2;
              const canvasCY = canvasH / 2;
              const imgVisW = imgDisplayW * s.scale;
              const imgVisH = imgDisplayH * s.scale;
              const imgVisLeft = canvasCX + s.x - imgVisW / 2;
              const imgVisTop  = canvasCY + s.y - imgVisH / 2;
              const cropLeft = canvasCX - cropBoxW / 2;
              const cropTop  = canvasCY - cropBoxH / 2;
              setBannerCropFraction({
                imgFracW: imgVisW / cropBoxW,
                imgFracH: imgVisH / cropBoxH,
                imgFracX: (imgVisLeft - cropLeft) / cropBoxW,
                imgFracY: (imgVisTop  - cropTop ) / cropBoxH,
              });
              setBannerImageUri(cropPreviewUri!);
              setCropPreviewUri(undefined);
            }} activeOpacity={0.8}>
              <Text style={{ color: '#0d9488', fontSize: 17, fontWeight: '700' }}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EventsScreen() {
  const navigation = useNavigation<any>();
  const [upcomingEvents, setUpcomingEvents] = useState<EventItem[]>([]);
  const [pastEvents, setPastEvents] = useState<EventItem[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadEvents(silent = false) {
    if (!silent) setLoading(true);
    try {
      const [upcomingRes, pastRes] = await Promise.all([
        getEvents({ status: 'upcoming' }),
        getEvents({ status: 'past' }),
      ]);
      setUpcomingEvents(upcomingRes.events.map(mapApiEvent));
      setPastEvents(pastRes.events.map(mapApiEvent));
    } catch (err) {
      handleApiError(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { loadEvents(); }, []));

  function handleCreateEvent(ev: EventItem) {
    const days = daysUntil(ev.dateISO);
    if (days >= 0) setUpcomingEvents(p => [ev, ...p]);
    else setPastEvents(p => [ev, ...p]);
  }

  function archiveEvent(id: string, from: 'upcoming' | 'past') {
    const list = from === 'upcoming' ? upcomingEvents : pastEvents;
    const ev = list.find(e => e.id === id);
    if (!ev) return;
    Alert.alert('Archive Event', `Archive "${ev.name}"? You can restore it anytime.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive', onPress: async () => {
          try {
            await apiArchiveEvent(id);
            if (from === 'upcoming') setUpcomingEvents(p => p.filter(e => e.id !== id));
            else setPastEvents(p => p.filter(e => e.id !== id));
            setOpenMenuId(null);
          } catch (err) {
            handleApiError(err);
          }
        },
      },
    ]);
  }

  function deleteEvent(id: string, from: 'upcoming' | 'past') {
    Alert.alert('Delete Event?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await apiDeleteEvent(id);
            if (from === 'upcoming') setUpcomingEvents(p => p.filter(e => e.id !== id));
            else setPastEvents(p => p.filter(e => e.id !== id));
            setOpenMenuId(null);
          } catch (err) {
            handleApiError(err);
          }
        },
      },
    ]);
  }

  function toggleMenu(id: string) {
    setOpenMenuId(prev => prev === id ? null : id);
  }

  function navigateToDetail(ev: EventItem) {
    navigation.navigate('EventDetail', {
      event: {
        id: ev.id, name: ev.name, type: ev.type, typeColor: ev.typeColor,
        location: ev.location, fullDate: ev.dateDisplay,
        daysToGo: daysUntil(ev.dateISO), description: ev.description,
      },
    });
  }

  const isEmpty = upcomingEvents.length === 0 && pastEvents.length === 0;

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadEvents(true); }}
            colors={[colors.accent]}
            tintColor={colors.accent}
          />
        }
      >

        {/* Hero section — always visible */}
        <View style={styles.heroSection}>
          <View style={styles.calendarCircle}>
            <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
              <Rect x={3} y={4} width={18} height={18} rx={2} ry={2} stroke="#f97316" strokeWidth={2} />
              <Path d="M16 2v4M8 2v4M3 10h18" stroke="#f97316" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              <Circle cx={8} cy={14} r={1} fill="#f97316" />
              <Circle cx={12} cy={14} r={1} fill="#f97316" />
              <Circle cx={16} cy={14} r={1} fill="#f97316" />
              <Circle cx={8} cy={18} r={1} fill="#f97316" />
              <Circle cx={12} cy={18} r={1} fill="#f97316" />
            </Svg>
          </View>
          <Text style={styles.heroTitle}>{"Let's get social! \uD83C\uDF89 Plan your\nfirst gathering"}</Text>
          <Text style={styles.heroSub}>Create another memorable event</Text>
          <TouchableOpacity style={[styles.newEventBtn, { marginTop: 8 }]} activeOpacity={0.8} onPress={() => setShowCreate(true)}>
            <Text style={styles.newEventBtnText}>Create Event</Text>
          </TouchableOpacity>
        </View>

        {/* Events list header — only show if events exist */}
        {!isEmpty && (
          <View style={styles.eventListHeader}>
            <Text style={styles.eventListTitle}>Your Events</Text>
            <Text style={styles.eventListSub}>Manage all your gatherings</Text>
          </View>
        )}

        {loading ? (
          <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Upcoming Events */}
            {upcomingEvents.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>UPCOMING</Text>
                {upcomingEvents.map(ev => (
                  <EventCard
                    key={ev.id}
                    event={toCardData(ev)}
                    onPress={() => navigateToDetail(ev)}
                    showMenu={openMenuId === ev.id}
                    onToggleMenu={() => toggleMenu(ev.id)}
                    onArchive={() => archiveEvent(ev.id, 'upcoming')}
                    onDelete={() => deleteEvent(ev.id, 'upcoming')}
                  />
                ))}
              </>
            )}

            {/* Past Events */}
            {pastEvents.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>PAST</Text>
                {pastEvents.map(ev => (
                  <EventCardPast
                    key={ev.id}
                    event={toCardData(ev)}
                    onPress={() => navigateToDetail(ev)}
                    showMenu={openMenuId === ev.id}
                    onToggleMenu={() => toggleMenu(ev.id)}
                    onArchive={() => archiveEvent(ev.id, 'past')}
                    onDelete={() => deleteEvent(ev.id, 'past')}
                  />
                ))}
              </>
            )}

            {isEmpty && !loading && (
              <Text style={{ textAlign: 'center', color: '#94a3b8', marginTop: 20, fontSize: 14 }}>
                Tap "Create Event" to plan your first gathering!
              </Text>
            )}
          </>
        )}

        {/* bottom spacer */}
        <View style={{ height: 20 }} />

      </ScrollView>

      <CreateEventModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onSave={handleCreateEvent}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 4 },

  pageTitleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 4, paddingBottom: 12,
  },
   eventListHeader: { marginBottom: 1, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 20},
  eventListTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  eventListSub: { fontSize: 13, color: '#64748b', marginTop: 2, marginBottom: 12 },
   sectionLabel: {
    fontSize: 13, fontWeight: '600', color: '#64748b', letterSpacing: 0.6,
    marginBottom: 10, marginTop: 4, textTransform: 'uppercase',
  },
  newEventBtn: {
    backgroundColor: colors.accent, borderRadius: 999,
    paddingVertical: 11, paddingHorizontal: 22,
    shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  newEventBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  heroSection: { alignItems: 'center', marginTop: 18, marginBottom: 1, gap: 10 },
  calendarCircle: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: '#fff7ed',
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 20, fontWeight: '600', color: colors.textPrimary,
    textAlign: 'center', lineHeight: 28,
  },
  heroSub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },

});

// ─── Modal Styles ─────────────────────────────────────────────────────────────

const modal = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 16,
  },
  dialog: {
    backgroundColor: '#fff', borderRadius: 24, width: '100%',
    maxHeight: '90%', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 24, elevation: 12,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  title: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center',
  },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 8, gap: 12 },

  label: { fontSize: 13, fontWeight: '600', color: '#0f172a', marginTop: 4 },
  input: {
    borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#0f172a', backgroundColor: '#fff',
  },
  row: { flexDirection: 'row', alignItems: 'center' },

  dropdown: {
    borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 12,
    backgroundColor: '#fff', overflow: 'hidden',
  },
  dropItem: { paddingHorizontal: 14, paddingVertical: 11 },
  dropItemActive: { backgroundColor: '#f0fdfa' },
  dropItemText: { fontSize: 14, color: '#0f172a' },
  dropItemTextActive: { color: '#0d9488', fontWeight: '700' },

  locationBox: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, gap: 8,
  },

  // Action rows (matching TripsScreen style)
  ctRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
  },
  ctRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  ctRowIcon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#2dd4bf', alignItems: 'center', justifyContent: 'center',
  },
  ctRowText: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  ctRowSub: { fontSize: 11, color: '#94a3b8' },
  ctCountBadge: { backgroundColor: '#ccfbf1', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  ctCountBadgeText: { fontSize: 11, color: '#0f766e', fontWeight: '600' },
  ctDocChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#a7f3d0',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
  },
  ctDocChipText: { flex: 1, fontSize: 12, color: '#334155' },
  ctDocRemove: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center',
  },

  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#e2e8f0',
  },
  cancelTxt: { fontSize: 13, fontWeight: '600', color: '#0f172a', textDecorationLine: 'underline' },
  createBtn: {
    backgroundColor: colors.accent, borderRadius: 999,
    paddingHorizontal: 28, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  createBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Invite modal
  inviteTabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  inviteTab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  inviteTabActive: { borderBottomWidth: 2, borderBottomColor: '#0d9488', backgroundColor: '#f0fdfa' },
  inviteTabText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  inviteTabTextActive: { color: '#0d9488' },
  friendSelectRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 10, borderRadius: 10, marginBottom: 4,
  },
  friendAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#ccfbf1', alignItems: 'center', justifyContent: 'center',
  },
  friendAvatarText: { fontSize: 16, fontWeight: '700', color: colors.accent },
  friendName: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  checkCircle: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
});
