import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal,
  TextInput, Image, Platform, NativeModules, Dimensions, Linking,
  ActivityIndicator, FlatList,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { WebView } from 'react-native-webview';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AppDatePicker from '../../components/common/AppDatePicker';
import BlobBackground from '../../components/common/BlobBackground';
import LocationAutocomplete from '../../components/common/LocationAutocomplete';
import CachedImage from '../../components/common/CachedImage';
import DetailDialogHeader from '../../components/details/DetailDialogHeader';
import DetailTabBar from '../../components/details/DetailTabBar';
import SharedDetailHeroCard from '../../components/common/DetailHeroCard';
import SweeFab from '../../components/details/SweeFab';
import FloatingTabBar from '../../components/common/FloatingTabBar';
import AppHeader from '../../components/common/AppHeader';
import useNotificationStore from '../../store/notificationStore';
import {
  BackIcon, PencilIcon, TrashIcon, CheckIcon,
} from '../../components/common/Icons';
import {
  getEventDetail,
  updateEvent as apiUpdateEvent,
  getEventMembers,
  inviteToEvent,
  removeEventMember,
  getEventDocs,
  uploadEventDoc,
  deleteEventDoc,
  getEventPhotos,
  uploadEventPhotos,
  deleteEventPhoto,
  getEventExpenses,
  createEventExpense,
  updateEventExpense,
  deleteEventExpense,
  getEventBalances,
  settleEventDebt,
  getEventNotes,
  createEventNote,
  updateEventNote,
  deleteEventNote,
  getEventPolls,
  createEventPoll,
  voteOnEventPoll,
  deleteEventPoll,
  handleApiError,
} from '../../api/events.api';
import { getFriends, getEmailStatus, listEmailAttachments, importEmailAttachments, type EmailAttachment } from '../../api/trips.api';
import useAuthStore from '../../store/authStore';
import { authUserId } from '../../utils/avatarUri';
import { showAlert, showConfirm } from '../../store/alertStore';
import { markEventSectionViewed } from '../../api/events.api';

// ─── Types ────────────────────────────────────────────────────────────────────

type DocItem = { id: string; name: string; uri: string; mimeType?: string };
type PhotoItem = { id: string; uri: string; localUri?: string; name: string };
type EventMemberLocal = { userId: string; fullName: string; avatarUrl?: string; role: 'admin' | 'member' };
type ExpenseLocal = {
  id: string; description: string; amount: number; category: string;
  paidBy: string; splitType: 'equally' | 'amount' | 'percent'; splitAmong: string[]; date: string; myAmount?: number;
  createdByUserId?: string;
  splitBreakdown?: { userId: string; amount: number; percentage: number | null }[];
};
type PollLocal = { id: string; question: string; options: { id: string; text: string; voteCount: number; votedByMe: boolean }[]; myVoteOptionId?: string | null; createdBy?: string };
type NoteLocal = { id: string; title: string; body: string; category: 'general' | 'idea' | 'important' | 'todo'; date: string; pinned?: boolean };
type DebtLocal = { from: string; to: string; fromName: string; toName: string; amount: number };

// ─── Constants ────────────────────────────────────────────────────────────────

const EXPENSE_CATS = [
  { label: 'General', emoji: '📦' },
  { label: 'Food & Dining', emoji: '🍽️' },
  { label: 'Transport', emoji: '🚗' },
  { label: 'Stay', emoji: '🏨' },
  { label: 'Entertainment', emoji: '🎭' },
  { label: 'Shopping', emoji: '🛍️' },
  { label: 'Other', emoji: '🌐' },
];

const EXPENSE_CAT_SLUG_TO_LABEL: Record<string, string> = {
  general: 'General',
  food: 'Food & Dining',
  transportation: 'Transport',
  accommodation: 'Stay',
  entertainment: 'Entertainment',
  shopping: 'Shopping',
  other: 'Other',
};

function normalizeDebtArray(
  debts: any[],
  currentUid: string,
  membersList: { userId: string; fullName?: string }[],
): DebtLocal[] {
  return (debts ?? []).map((d: any) => ({
    from: d.from,
    to: d.to,
    fromName: d.fromName || (d.from === currentUid ? 'You' : (membersList.find(m => m.userId === d.from)?.fullName || 'Member')),
    toName: d.toName || (d.to === currentUid ? 'You' : (membersList.find(m => m.userId === d.to)?.fullName || 'Member')),
    amount: typeof d.amount === 'number' ? d.amount : parseFloat(d.amount ?? '0'),
  }));
}

function mapApiEventExpenseToState(e: any, currentUserId: string, membersList: EventMemberLocal[]): ExpenseLocal {
  const resolvePaidBy = (paidByRaw: any): string => {
    if (typeof paidByRaw === 'object' && paidByRaw !== null) {
      const uid = paidByRaw.userId ?? paidByRaw.id ?? '';
      if (uid === currentUserId) return 'You';
      return paidByRaw.name ?? paidByRaw.fullName ?? uid ?? 'Unknown';
    }
    const uid = String(paidByRaw ?? '');
    if (uid === currentUserId) return 'You';
    const member = membersList.find(m => m.userId === uid);
    return member?.fullName ?? uid ?? 'Unknown';
  };
  const paidByStr = resolvePaidBy(e.paidBy);
  const splits = e.splits ?? [];
  const mySplit = splits.find((s: any) => s.userId === currentUserId);
  const myAmount = mySplit ? parseFloat(String(mySplit.amount ?? '0')) : 0;
  const creatorRaw = e.createdBy ?? e.created_by;
  const creatorId = typeof creatorRaw === 'object' && creatorRaw !== null
    ? String((creatorRaw as any).userId ?? (creatorRaw as any).id ?? '')
    : String(creatorRaw ?? '').trim();
  const catSlug = (e.category ?? 'general').toString().toLowerCase();
  return {
    id: e.id,
    description: e.description,
    amount: parseFloat(String(e.amount)),
    category: catSlug,
    paidBy: paidByStr,
    splitType: e.splitType === 'equal' ? 'equally' : e.splitType === 'percentage' ? 'percent' : 'amount',
    splitAmong: splits.map((s: any) => s.userId),
    date: new Date(e.createdAt).toLocaleDateString('default', { day: 'numeric', month: 'short' }),
    myAmount,
    createdByUserId: creatorId || undefined,
    splitBreakdown: splits.map((s: any) => ({
      userId: s.userId,
      amount: parseFloat(String(s.amount ?? '0')),
      percentage: s.percentage != null && s.percentage !== '' ? parseFloat(String(s.percentage)) : null,
    })),
  };
}

function renderTextWithLinks(text: string, textStyle: any, linkStyle: any) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <Text style={textStyle}>
      {parts.map((part, idx) => {
        const isLink = /^https?:\/\/[^\s]+$/i.test(part);
        if (!isLink) return <React.Fragment key={`${part}-${idx}`}>{part}</React.Fragment>;
        return (
          <Text
            key={`${part}-${idx}`}
            style={linkStyle}
            onPress={async () => {
              try {
                const canOpen = await Linking.canOpenURL(part);
                if (canOpen) await Linking.openURL(part);
              } catch {
                Toast.show({ type: 'error', text1: 'Unable to open link' });
              }
            }}
          >
            {part}
          </Text>
        );
      })}
    </Text>
  );
}

const NOTE_CATS = [
  { key: 'general', label: 'General', emoji: '📝' },
  { key: 'idea', label: 'Idea', emoji: '💡' },
  { key: 'important', label: 'Important', emoji: '⚠️' },
  { key: 'todo', label: 'To-Do', emoji: '✅' },
];


// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function daysUntil(isoDate: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
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

function fmtEventDateLine(isoDate: string): string {
  if (!isoDate) return 'TBD';
  const d = new Date(isoDate);
  const days = daysUntil(isoDate);
  if (days > 0) {
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ActionIcon({ path, color }: { path: string; color: string }) {
  const s = { width: 18, height: 18 };
  switch (path) {
    case 'docs': return <Svg {...s} viewBox="0 0 24 24" fill="none"><Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /><Path d="M14 2v6h6M16 13H8M16 17H8" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'members': return <Svg {...s} viewBox="0 0 24 24" fill="none"><Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /><Path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'photos': return <Svg {...s} viewBox="0 0 24 24" fill="none"><Rect x={3} y={3} width={18} height={18} rx={2} ry={2} stroke={color} strokeWidth={2} /><Circle cx={8.5} cy={8.5} r={1.5} fill={color} /><Path d="M21 15l-5-5L5 21" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'expenses': return <Svg {...s} viewBox="0 0 24 24" fill="none"><Path d="M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'polls': return <Svg {...s} viewBox="0 0 24 24" fill="none"><Path d="M18 20V10M12 20V4M6 20v-6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'notes': return <Svg {...s} viewBox="0 0 24 24" fill="none"><Path d="M9 11l3 3L22 4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /><Path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    default: return null;
  }
}

const { width: SCREEN_W } = Dimensions.get('window');
const isSmall = SCREEN_W < 360;

const DHeader = DetailDialogHeader;
const TabBar = DetailTabBar;

// ─── Photo helper components ──────────────────────────────────────────────────

function EventPhotoThumb({ photo, onPress }: { photo: PhotoItem; onPress: () => void }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // Fall back from localUri to server URL if the local temp file is gone
  const [localUriFailed, setLocalUriFailed] = useState(false);
  const uri = (photo.localUri && !localUriFailed) ? photo.localUri : photo.uri;

  const prevId = useRef(photo.id);
  useEffect(() => {
    if (prevId.current !== photo.id) {
      prevId.current = photo.id;
      setLocalUriFailed(false);
      setFailed(false);
      setLoading(true);
    }
  }, [photo.id]);

  const handleError = () => {
    if (photo.localUri && !localUriFailed) {
      setLocalUriFailed(true);
      setLoading(true);
    } else {
      setLoading(false);
      setFailed(true);
    }
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={{ width: 80, height: 80, borderRadius: 8, overflow: 'hidden', backgroundColor: '#e2e8f0' }}>
      {!failed ? (
        <>
          <CachedImage
            uri={uri}
            style={{ width: 80, height: 80 }}
            resizeMode="cover"
            onLoad={() => setLoading(false)}
            onError={handleError}
          />
          {loading && (
            <View style={{ ...StyleSheet.absoluteFillObject as any, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e2e8f0' }}>
              <ActivityIndicator size="small" color="#0d9488" />
            </View>
          )}
        </>
      ) : (
        <View style={{ width: 80, height: 80, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' }}>
          <Text style={{ fontSize: 22 }}>🖼️</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function EventMainPhotoItem({ photo, size, onPress }: { photo: PhotoItem; size: number; onPress: () => void }) {
  const [localUriFailed, setLocalUriFailed] = useState(false);
  const uri = (photo.localUri && !localUriFailed) ? photo.localUri : photo.uri;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <CachedImage
        uri={uri}
        style={{ width: size, height: size, borderRadius: 10, backgroundColor: '#e2e8f0' }}
        resizeMode="cover"
        onError={() => { if (photo.localUri && !localUriFailed) setLocalUriFailed(true); }}
      />
    </TouchableOpacity>
  );
}

function EventFriendAvatar({ uri, name, style }: { uri: string; name: string; style: any }) {
  const [failed, setFailed] = useState(false);
  const prevUri = useRef(uri);
  useEffect(() => {
    if (prevUri.current !== uri) {
      prevUri.current = uri;
      setFailed(false);
    }
  }, [uri]);

  if (!uri || failed) {
    return (
      <View style={[style, { backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontSize: 16, fontWeight: '500', color: '#94a3b8' }}>{name?.[0]?.toUpperCase() ?? '?'}</Text>
      </View>
    );
  }
  return <CachedImage uri={uri} style={style} resizeMode="cover" onError={() => setFailed(true)} />;
}

function resolveFriendAvatar(friend: any): string {
  const id = friend?.user?.id ?? friend?.id ?? '';
  const candidates = [
    friend?.user?.photoUrl,
    friend?.user?.avatarUrl,
    friend?.user?.profile?.avatarUrl,
    friend?.user?.avatar,
    friend?.avatarUrl,
  ];

  const chosen = candidates.find((v) => typeof v === 'string' && v.trim().length > 0) as string | undefined;
  if (chosen && !chosen.includes('/undefined') && !chosen.includes('https://undefined/')) {
    return chosen;
  }
  return `https://i.pravatar.cc/150?u=${encodeURIComponent(String(id || 'friend'))}`;
}

function EventPhotoPreview({ photo }: { photo: PhotoItem }) {
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); }, [photo.uri]);
  return (
    <View style={{ width: SCREEN_W, flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <CachedImage
        uri={photo.localUri ?? photo.uri}
        style={{ width: SCREEN_W, height: SCREEN_W * 1.2 }}
        resizeMode="contain"
        onLoad={() => setLoading(false)}
        onError={() => setLoading(false)}
      />
      {loading && <ActivityIndicator style={{ position: 'absolute' }} size="large" color="#fff" />}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EventDetailScreen({ route, navigation }: any) {
  const rawEvent = route?.params?.event;
  const unreadCount = useNotificationStore(s => s.notifications.filter(n => !n.read).length);

  // Derive display fields from whatever shape the event param has
  const [event, setEvent] = useState({
    id: rawEvent?.id ?? 'e1',
    name: rawEvent?.name ?? 'Spring Music Festival',
    location: rawEvent?.location ?? 'Central Park, NY',
    dateLine: rawEvent?.fullDate ?? rawEvent?.dateLine ?? '15 Mar 2026',
    type: rawEvent?.type ?? 'Festival',
    typeColor: rawEvent?.typeColor ?? '#fdf2f8',
    dayCount: rawEvent?.daysToGo ?? rawEvent?.dayCount ?? 15,
    description: rawEvent?.description ?? 'Join us for the annual Spring Music Festival in the heart of Central Park. Experience live performances from local and international artists across multiple stages.',
  });

  const currentUserId = useAuthStore(s => authUserId(s.user));
  const avatarUpdatedAt = useAuthStore(s => s.avatarUpdatedAt);
  const [failedAvatarIds, setFailedAvatarIds] = useState<Set<string>>(new Set());


  // ── Modal visibility (declared before hooks that reference them) ──
  const [showDocs, setShowDocs] = useState(false);
  const [showEmailPicker, setShowEmailPicker] = useState(false);
  const [emailPickerProvider, setEmailPickerProvider] = useState<'gmail' | 'outlook'>('gmail');
  const [emailAttachments, setEmailAttachments] = useState<EmailAttachment[]>([]);
  const [selectedAttachIds, setSelectedAttachIds] = useState<Set<string>>(new Set());
  const [emailPickerLoading, setEmailPickerLoading] = useState(false);
  const [emailImporting, setEmailImporting] = useState(false);
  const [emailStatus, setEmailStatus] = useState({ gmail: { connected: false }, outlook: { connected: false } });
  const [showMembers, setShowMembers] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const [showExpenses, setShowExpenses] = useState(false);
  const [showPolls, setShowPolls] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showEditEvent, setShowEditEvent] = useState(false);
  const [previewPhotoIndex, setPreviewPhotoIndex] = useState<number | null>(null);
  const photoListRef = useRef<any>(null);
  const [docPreviewUrl, setDocPreviewUrl] = useState<string | null>(null);

  // ── Data state ──
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [members, setMembers] = useState<EventMemberLocal[]>([]);
  const [apiFriends, setApiFriends] = useState<{ id: string; name: string; avatar: string }[]>([]);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseLocal[]>([]);
  const [balances, setBalances] = useState<DebtLocal[]>([]);
  const [myBalance, setMyBalance] = useState(0);
  const [polls, setPolls] = useState<PollLocal[]>([]);
  const [notes, setNotes] = useState<NoteLocal[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const previewPhoto = previewPhotoIndex !== null ? photos[previewPhotoIndex] ?? null : null;
  const myMemberRole = members.find(m => m.userId === currentUserId)?.role ?? 'member';

  // ── Load event detail and all modules from API on every focus ──
  useFocusEffect(
    useCallback(() => {
      if (!event.id) return;
      setLoadingDetail(true);

      const loadAllData = async () => {
        try {
          const eventData = await getEventDetail(event.id);
          if (eventData.unreadCounts) setUnreadCounts(eventData.unreadCounts);
          setEvent(prev => ({
            ...prev,
            name: eventData.event.name,
            location: eventData.event.location?.name ?? prev.location,
            dateLine: eventData.event.eventDate ? fmtEventDateLine(eventData.event.eventDate) : prev.dateLine,
            type: eventData.event.eventType ?? prev.type,
            description: eventData.event.description ?? prev.description,
          }));
          const state = useAuthStore.getState();
          const freshUrl = state.user?.photoUrl || state.user?.avatarUrl || null;
          const cuid = authUserId(state.user);
          setMembers(eventData.members.map(m => ({
            userId: m.userId,
            fullName: m.fullName ?? (m as any).name ?? 'Member',
            avatarUrl: (m.userId === cuid && freshUrl) ? freshUrl : (m.avatarUrl ?? undefined),
            role: m.role,
          })));

          // Load all module data in parallel
          try {
            const [docsData, photosData, expData, balData, pollsData, notesData] = await Promise.all([
              getEventDocs(event.id),
              getEventPhotos(event.id),
              getEventExpenses(event.id),
              getEventBalances(event.id),
              getEventPolls(event.id),
              getEventNotes(event.id),
            ]);

            // Update docs
            setDocs(docsData.docs.map(d => ({ id: d.id, name: d.fileName, uri: d.downloadUrl ?? d.fileUrl ?? '', mimeType: d.mimeType })));

            // Update photos (preserve localUri from previous session state)
            setPhotos(prev => {
              const cache: Record<string, string> = {};
              prev.forEach(p => { if ((p as any).localUri) cache[p.id] = (p as any).localUri; });
              return photosData.photos.map(p => ({
                id: p.id,
                uri: p.url ?? p.fileUrl ?? '',
                localUri: cache[p.id],
                name: 'photo.jpg',
              }));
            });

            // Update expenses and balances
            const membersForMap: EventMemberLocal[] = eventData.members.map((m: any) => ({
              userId: m.userId,
              fullName: m.fullName ?? m.name ?? 'Member',
              avatarUrl: m.avatarUrl,
              role: m.role,
            }));
            setExpenses((expData.expenses ?? []).map(e => mapApiEventExpenseToState(e, currentUserId, membersForMap)));
            setBalances(normalizeDebtArray(balData.debts, currentUserId, membersForMap));
            setMyBalance(balData.myBalance ?? 0);

            // Update polls
            setPolls(pollsData.polls.map(p => ({
              id: p.id,
              question: p.question,
              options: p.options.map(o => ({ id: o.id, text: o.text, voteCount: o.voteCount, votedByMe: o.votedByMe })),
              myVoteOptionId: p.myVoteOptionId,
            })));

            // Update notes
            setNotes(notesData.notes.map(n => ({
              id: n.id,
              title: n.title,
              body: n.content,
              category: (n.category ?? 'general') as NoteLocal['category'],
              date: new Date(n.createdAt).toLocaleDateString('default', { day: 'numeric', month: 'short' }),
              pinned: n.pinned ?? false,
            })));
          } catch (moduleErr) {
            handleApiError(moduleErr);
          }
        } catch (err) {
          handleApiError(err);
        } finally {
          setLoadingDetail(false);
        }
      };

      loadAllData();
    }, [event.id, currentUserId])
  );

  // Load friends when Members modal opens
  useEffect(() => {
    if (!showDocs) return;
    getEmailStatus().then((d: any) => {
      setEmailStatus({
        gmail:   { connected: Boolean(d?.gmail?.connected) },
        outlook: { connected: Boolean(d?.outlook?.connected) },
      });
    }).catch(() => {});
  }, [showDocs]);

  useEffect(() => {
    if (!showMembers) return;
    getFriends().then(data => {
      setApiFriends(data.friends.map(f => ({
        id: f.user.id,
        name: f.user.name || 'Friend',
        avatar: resolveFriendAvatar(f),
      })));
    }).catch(() => { });
  }, [showMembers]);

  // Re-patch current user's avatar when photo is updated
  useEffect(() => {
    if (avatarUpdatedAt === 0) return;
    const freshUrl = useAuthStore.getState().user?.photoUrl || useAuthStore.getState().user?.avatarUrl || null;
    if (!freshUrl) return;
    setMembers(prev => prev.map(m =>
      m.userId === currentUserId ? { ...m, avatarUrl: freshUrl } : m
    ));
    setFailedAvatarIds(new Set());
  }, [avatarUpdatedAt, currentUserId]);

  // ── Members modal ──
  const [memberTab, setMemberTab] = useState<'From Friends' | 'Invite New'>('From Friends');
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [inviteMethod, setInviteMethod] = useState<'email' | 'sms' | 'whatsapp'>('email');
  const [inviteInput, setInviteInput] = useState('');

  // ── Expenses modal ──
  const [expTab, setExpTab] = useState<'All Expenses' | 'Balances'>('All Expenses');
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState(EXPENSE_CATS[0]);
  const [expPaidBy, setExpPaidBy] = useState('You');
  const [expSplitType, setExpSplitType] = useState<'equally' | 'amount' | 'percent'>('equally');
  const [expSplitAmong, setExpSplitAmong] = useState<string[]>(['You']);
  const [expSplitDetails, setExpSplitDetails] = useState<{ [k: string]: string }>({});
  const [showExpCatDrop, setShowExpCatDrop] = useState(false);
  const [showPaidByDrop, setShowPaidByDrop] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  // ── Polls modal ──
  const [showPollForm, setShowPollForm] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [votingPollId, setVotingPollId] = useState<string | null>(null);

  // ── Notes modal ──
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [noteCategory, setNoteCategory] = useState<'general' | 'idea' | 'important' | 'todo'>('general');
  const [showNoteCatDrop, setShowNoteCatDrop] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [viewingNote, setViewingNote] = useState<NoteLocal | null>(null);

  // ── Inline description editing ──
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');

  // ── Edit Event form ──
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editType, setEditType] = useState('');
  const [editDateObj, setEditDateObj] = useState<Date | undefined>(undefined);
  const [showEditTypeDrop, setShowEditTypeDrop] = useState(false);
  const [editDateError, setEditDateError] = useState<string | null>(null);

  const EVENT_TYPE_LIST = ['Wedding', 'Birthday', 'Party', 'Professional', 'Meetup', 'Festival', 'Family', 'Sports', 'Religious', 'Other'];

  // ── Derived ──
  const memberCount = members.length;
  const totalExp = expenses.reduce((s, e) => s + e.amount, 0);
  const noteCatDisplay = NOTE_CATS.find(c => c.key === noteCategory)!;

  // Badges = server-computed unread counts (items added by others since user last viewed)
  const badgeCounts = {
    docs: unreadCounts.docs ?? 0,
    members: unreadCounts.members ?? 0,
    photos: unreadCounts.photos ?? 0,
    expenses: unreadCounts.expenses ?? 0,
    polls: unreadCounts.polls ?? 0,
    notes: unreadCounts.notes ?? 0,
  };
  const memberIdSet = new Set(members.map(m => m.userId));
  const filteredFriends = apiFriends
    .filter(f => !memberIdSet.has(f.id) && f.name.toLowerCase().includes(memberSearch.toLowerCase()));
  const dayLabel = event.dayCount > 0 ? 'Days to go' : event.dayCount === 0 ? 'Today!' : 'Days ago';

  // ── Handlers ──

  async function handleUploadDoc() {
    try {
      const FilePicker = NativeModules.FilePicker;
      if (!FilePicker) {
        // Fallback: use image picker for images only if native FilePicker not available
        launchImageLibrary({ mediaType: 'mixed', selectionLimit: 1, includeBase64: false }, async res => {
          if (res.didCancel || res.errorCode) return;
          const asset = res.assets?.[0];
          if (!asset?.uri) return;
          try {
            const result = await uploadEventDoc(event.id, { uri: asset.uri, type: asset.type, name: asset.fileName ?? 'document' });
            setDocs(p => [...p, { id: result.doc.id, name: result.doc.fileName, uri: result.doc.downloadUrl ?? result.doc.fileUrl ?? '', mimeType: result.doc.mimeType }]);
          } catch (err) { handleApiError(err); }
        });
        return;
      }
      const file: { uri: string; name: string; type: string } = await FilePicker.pick();
      if (!file?.uri) return;
      const result = await uploadEventDoc(event.id, { uri: file.uri, type: file.type ?? 'application/octet-stream', name: file.name ?? 'document' });
      setDocs(p => [...p, { id: result.doc.id, name: result.doc.fileName, uri: result.doc.downloadUrl ?? result.doc.fileUrl ?? '', mimeType: result.doc.mimeType }]);
    } catch (err: any) {
      if (err?.code === 'CANCELLED' || err?.message === 'User cancelled') return;
      handleApiError(err);
    }
  }

  async function openEmailPicker(provider: 'gmail' | 'outlook') {
    if (!emailStatus[provider].connected) {
      setShowDocs(false);
      (navigation as any).navigate('ConnectedEmail');
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

  async function confirmEmailImport() {
    if (selectedAttachIds.size === 0 || emailImporting) return;
    setEmailImporting(true);
    try {
      const selected = emailAttachments.filter(a => selectedAttachIds.has(a.attachmentId));
      const res = await importEmailAttachments('event', event.id, emailPickerProvider, selected);
      setDocs(p => [...p, ...res.imported.map((d: any) => ({ id: d.docId, name: d.fileName, uri: d.fileUrl }))]);
      setShowEmailPicker(false);
      if (res.failed?.length) {
        Toast.show({ type: 'error', text1: `${res.failed.length} file(s) failed to import` });
      } else {
        Toast.show({ type: 'success', text1: `${res.imported.length} file(s) imported` });
      }
    } catch (err) {
      handleApiError(err);
    } finally {
      setEmailImporting(false);
    }
  }

  function handlePickPhoto(cam: boolean) {
    const fn = cam ? launchCamera : launchImageLibrary;
    const opts = cam ? { mediaType: 'photo' as const, maxWidth: 1280, maxHeight: 1280, quality: 0.7 } : { mediaType: 'photo' as const, maxWidth: 1280, maxHeight: 1280, quality: 0.7, selectionLimit: 20 };
    fn(opts, async res => {
      if (res.didCancel || res.errorCode) return;
      const assets = (res.assets || []).filter(a => a.uri);
      if (!assets.length) return;

      // Optimistic: add temp photos with local URIs so they display immediately
      const tempIds = assets.map((_, i) => `temp-${Date.now()}-${i}`);
      const tempPhotos = assets.map((a, i) => ({ id: tempIds[i], uri: a.uri!, localUri: a.uri!, name: a.fileName ?? 'photo.jpg' }));
      setPhotos(prev => [...prev, ...tempPhotos]);

      try {
        const result = await uploadEventPhotos(event.id, assets.map(a => ({ uri: a.uri!, type: a.type, name: a.fileName ?? 'photo.jpg' })));
        // Replace temp entries with real CDN-backed ones (keep localUri as fallback)
        setPhotos(prev => {
          const withoutTemps = prev.filter(ph => !tempIds.includes(ph.id));
          const newPhotos = result.photos.map((ph, i) => ({
            id: ph.id,
            uri: ph.url ?? ph.fileUrl ?? assets[i]?.uri ?? '',
            localUri: assets[i]?.uri,
            name: 'photo.jpg',
          }));
          return [...withoutTemps, ...newPhotos];
        });
      } catch (err) {
        // Remove temp entries on failure
        setPhotos(prev => prev.filter(ph => !tempIds.includes(ph.id)));
        handleApiError(err);
      }
    });
  }

  function openPhotoPreview(photoId: string) {
    const idx = photos.findIndex(x => x.id === photoId);
    if (idx >= 0) setPreviewPhotoIndex(idx);
  }
  function showPrevPhoto() {
    if (previewPhotoIndex === null || photos.length <= 1) return;
    const next = (previewPhotoIndex - 1 + photos.length) % photos.length;
    setPreviewPhotoIndex(next);
    photoListRef.current?.scrollToIndex({ index: next, animated: true });
  }
  function showNextPhoto() {
    if (previewPhotoIndex === null || photos.length <= 1) return;
    const next = (previewPhotoIndex + 1) % photos.length;
    setPreviewPhotoIndex(next);
    photoListRef.current?.scrollToIndex({ index: next, animated: true });
  }

  async function handleAddExpense() {
    if (!expDesc.trim() || !expAmount) { showAlert({ title: 'Error', message: 'Please fill description and amount' }); return; }
    const amount = parseFloat(expAmount) || 0;

    const resolveId = (id: string) => id === 'You' ? currentUserId : id;
    const splitAmongIds = expSplitAmong.map(resolveId);

    const uniqueIds = new Set(splitAmongIds);
    if (uniqueIds.size !== splitAmongIds.length) {
      showAlert({ title: 'Error', message: 'Cannot split expense among same person twice' });
      return;
    }

    const apiSplitType = expSplitType === 'equally' ? 'equal' : expSplitType === 'percent' ? 'percentage' : 'amount';

    const splitAmong = splitAmongIds.map(uid => {
      if (apiSplitType === 'equal') return { userId: uid };
      const raw = expSplitDetails[uid === currentUserId ? 'You' : uid] ?? '0';
      if (apiSplitType === 'percentage') return { userId: uid, percentage: parseFloat(raw) || 0 };
      return { userId: uid, amount: parseFloat(raw) || 0 };
    });

    if (apiSplitType === 'amount') {
      const sum = splitAmong.reduce((s: number, x: any) => s + (x.amount ?? 0), 0);
      if (Math.abs(sum - amount) > 0.01) {
        showAlert({ title: 'Validation Error', message: 'Split amounts must sum to the total expense amount.' });
        return;
      }
    }
    if (apiSplitType === 'percentage') {
      const sum = splitAmong.reduce((s: number, x: any) => s + (x.percentage ?? 0), 0);
      if (Math.abs(sum - 100) > 0.01) {
        showAlert({ title: 'Validation Error', message: 'Percentages must sum to 100.' });
        return;
      }
    }

    const catMap: Record<string, string> = {
      'General': 'general', 'Food & Dining': 'food', 'Transport': 'transportation',
      'Stay': 'accommodation', 'Entertainment': 'entertainment', 'Shopping': 'shopping', 'Other': 'other',
    };
    const categorySlug = catMap[expCategory.label] ?? 'general';

    const paidByUserId = expPaidBy === 'You' ? currentUserId
      : members.find(m => m.fullName === expPaidBy)?.userId ?? currentUserId;

    try {
      if (editingExpenseId) {
        const res = await updateEventExpense(event.id, editingExpenseId, {
          description: expDesc.trim(), amount, category: categorySlug,
          splitType: apiSplitType, splitAmong,
        });
        const mapped = mapApiEventExpenseToState(res.expense, currentUserId, members);
        setExpenses(p => p.map(e => e.id === editingExpenseId ? mapped : e));
        if (res.balances) setBalances(normalizeDebtArray(res.balances, currentUserId, members));
        const balData = await getEventBalances(event.id);
        setBalances(normalizeDebtArray(balData.debts, currentUserId, members));
        setMyBalance(balData.myBalance ?? 0);
        setEditingExpenseId(null);
      } else {
        const res = await createEventExpense(event.id, {
          description: expDesc.trim(), amount, category: categorySlug,
          paidBy: paidByUserId, splitType: apiSplitType, splitAmong,
        });
        setExpenses(p => [...p, mapApiEventExpenseToState(res.expense, currentUserId, members)]);
        if (res.balances) setBalances(normalizeDebtArray(res.balances, currentUserId, members));
        const balData = await getEventBalances(event.id);
        setBalances(normalizeDebtArray(balData.debts, currentUserId, members));
        setMyBalance(balData.myBalance ?? 0);
      }
    } catch (err: any) {
      const errorMsg = err?.message?.toLowerCase() || '';
      if (errorMsg.includes('duplicate') || errorMsg.includes('unique')) {
        showAlert({ title: 'Duplicate Expense', message: 'This expense already exists. Please check your entries and try again.' });
      } else {
        handleApiError(err);
      }
    }
    setExpDesc(''); setExpAmount(''); setExpCategory(EXPENSE_CATS[0]);
    setExpPaidBy('You'); setExpSplitType('equally');
    setExpSplitAmong(['You']); setExpSplitDetails({});
    setEditingExpenseId(null);
    setShowAddExpense(false);
  }

  /** A user can edit an expense if they are an admin, the creator, or have a share in the split. */
  function canEditExpense(exp: ExpenseLocal): boolean {
    if (myMemberRole === 'admin') return true;
    if (exp.createdByUserId === currentUserId) return true;
    if (exp.splitAmong?.includes(currentUserId)) return true;
    return false;
  }

  function startEditExpense(exp: ExpenseLocal) {
    setExpDesc(exp.description);
    setExpAmount(String(exp.amount));
    const catLabel = EXPENSE_CAT_SLUG_TO_LABEL[exp.category] ?? exp.category;
    setExpCategory(EXPENSE_CATS.find(c => c.label === catLabel) || EXPENSE_CATS[0]);
    setExpPaidBy(exp.paidBy);
    setExpSplitType(exp.splitType);
    const among = (exp.splitAmong ?? []).map(uid => (uid === currentUserId ? 'You' : uid));
    setExpSplitAmong(among.length ? among : ['You']);
    const details: Record<string, string> = {};
    if (exp.splitBreakdown?.length) {
      exp.splitBreakdown.forEach(s => {
        const key = s.userId === currentUserId ? 'You' : s.userId;
        if (exp.splitType === 'amount') {
          details[key] = String(s.amount);
        } else if (exp.splitType === 'percent') {
          const p = s.percentage != null && !Number.isNaN(s.percentage)
            ? s.percentage
            : (exp.amount > 0 ? (s.amount / exp.amount) * 100 : 0);
          details[key] = String(Math.round(p * 100) / 100);
        }
      });
    }
    setExpSplitDetails(details);
    setEditingExpenseId(exp.id);
    setShowAddExpense(true);
  }

  function handleDeleteExpense(eid: string, createdByUserId: string) {
    if (myMemberRole !== 'admin' && createdByUserId !== currentUserId) {
      Toast.show({ type: 'error', text1: 'Permission denied', text2: 'You can only delete your own expenses.' });
      return;
    }
    showConfirm({
      title: 'Delete Expense',
      message: 'This will permanently remove this expense. This action cannot be undone.',
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteEventExpense(event.id, eid);
          setExpenses(p => p.filter(e => e.id !== eid));
          const balData = await getEventBalances(event.id);
          setBalances(normalizeDebtArray(balData.debts, currentUserId, members));
          setMyBalance(balData.myBalance ?? 0);
        } catch (err) { handleApiError(err); }
      },
    });
  }

  function handleSettleEventDebt(withUserId: string, amount: number) {
    const amt = typeof amount === 'number' && !Number.isNaN(amount) ? amount : parseFloat(String(amount));
    if (!amt || amt <= 0) {
      showAlert({ title: 'Invalid amount', message: 'Enter a valid settlement amount.' });
      return;
    }
    showConfirm({
      title: 'Record settlement',
      message: `Record a payment of ₹${amt.toFixed(2)} to settle this balance? Balances will update for everyone on this event.`,
      confirmText: 'Settle',
      destructive: false,
      onConfirm: async () => {
        try {
          const res = await settleEventDebt(event.id, { withUserId, amount: amt });
          setBalances(normalizeDebtArray(res.outstanding ?? [], currentUserId, members));
          const balData = await getEventBalances(event.id);
          setMyBalance(balData.myBalance ?? 0);
          setBalances(normalizeDebtArray(balData.debts, currentUserId, members));
          Toast.show({ type: 'success', text1: 'Settlement recorded' });
        } catch (err) {
          handleApiError(err);
        }
      },
    });
  }

  async function handleAddNote() {
    if (!noteTitle.trim()) { showAlert({ title: 'Error', message: 'Please enter a title' }); return; }
    try {
      if (editingNoteId) {
        const existingNote = notes.find(n => n.id === editingNoteId);
        await updateEventNote(event.id, editingNoteId, { title: noteTitle, content: noteBody, category: noteCategory, pinned: existingNote?.pinned ?? false });
        setNotes(p => p.map(n => n.id === editingNoteId ? { ...n, title: noteTitle, body: noteBody, category: noteCategory } : n));
        setEditingNoteId(null);
      } else {
        const res = await createEventNote(event.id, { title: noteTitle.trim(), content: noteBody, category: noteCategory });
        setNotes(p => [...p, {
          id: res.note.id, title: res.note.title, body: res.note.content,
          category: (res.note.category ?? 'general') as NoteLocal['category'],
          date: new Date(res.note.createdAt).toLocaleDateString('default', { day: 'numeric', month: 'short' }),
          pinned: false,
        }]);
      }
    } catch (err) { handleApiError(err); }
    setNoteTitle(''); setNoteBody(''); setNoteCategory('general');
  }

  function startEditNote(note: NoteLocal) {
    setNoteTitle(note.title); setNoteBody(note.body); setNoteCategory(note.category);
    setEditingNoteId(note.id); setShowNoteCatDrop(false);
  }

  async function handleTogglePinNote(note: NoteLocal) {
    const newPinnedStatus = !note.pinned;
    // Optimistic update
    setNotes(p => p.map(n => n.id === note.id ? { ...n, pinned: newPinnedStatus } : n));
    try {
      // Persist to backend
      await updateEventNote(event.id, note.id, { title: note.title, content: note.body, category: note.category, pinned: newPinnedStatus });
    } catch (err) {
      // Revert on error
      setNotes(p => p.map(n => n.id === note.id ? { ...n, pinned: !newPinnedStatus } : n));
      handleApiError(err);
    }
  }

  async function handleAddMembersFromFriends() {
    if (!selectedFriends.length && !inviteInput.trim()) {
      showAlert({ title: 'Error', message: 'Select friends or enter a contact to invite' });
      return;
    }
    try {
      const res = await inviteToEvent(event.id, {
        friendIds: selectedFriends.length > 0 ? selectedFriends : undefined,
        emails: inviteInput.trim() ? [inviteInput.trim()] : undefined,
      });
      // Add newly added members to local list
      const added = apiFriends
        .filter(f => res.added.some(a => a.userId === f.id))
        .map(f => ({ userId: f.id, fullName: f.name, avatarUrl: f.avatar, role: 'member' as const }));
      setMembers(p => {
        const existing = new Set(p.map(m => m.userId));
        return [...p, ...added.filter(m => !existing.has(m.userId))];
      });
      if (res.invited.length > 0) showAlert({ title: 'Invite Sent', message: `Invitation sent to ${inviteInput.trim()}` });
    } catch (err) { handleApiError(err); }
    setSelectedFriends([]);
    setInviteInput('');
  }

  async function handleCreatePoll() {
    const valid = pollOptions.filter(o => o.trim());
    if (!pollQuestion.trim() || valid.length < 2) { showAlert({ title: 'Error', message: 'Enter a question and at least 2 options' }); return; }
    try {
      const res = await createEventPoll(event.id, { question: pollQuestion.trim(), options: valid });
      setPolls(prev => [...prev, {
        id: res.poll.id,
        question: res.poll.question,
        options: res.poll.options.map(o => ({ id: o.id, text: o.text, voteCount: o.voteCount, votedByMe: o.votedByMe })),
        myVoteOptionId: res.poll.myVoteOptionId,
        createdBy: res.poll.createdBy,
      }]);
      setPollQuestion(''); setPollOptions(['', '']);
      setShowPollForm(false);
      Toast.show({ type: 'success', text1: 'Poll created!' });
    } catch (err) { handleApiError(err); }
  }

  async function handleDeletePoll(pollId: string) {
    showConfirm({
      title: 'Delete Poll',
      message: 'Are you sure you want to delete this poll?',
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteEventPoll(event.id, pollId);
          setPolls(p => p.filter(po => po.id !== pollId));
        } catch (err) { handleApiError(err); }
      },
    });
  }

  async function handleVote(pollId: string, optionId: string) {
    if (votingPollId === pollId) return;
    setVotingPollId(pollId);
    try {
      const res = await voteOnEventPoll(event.id, pollId, optionId);
      setPolls(prev => prev.map(p => p.id === pollId ? {
        id: res.poll.id,
        question: res.poll.question,
        options: res.poll.options.map(o => ({ id: o.id, text: o.text, voteCount: o.voteCount, votedByMe: o.votedByMe })),
        myVoteOptionId: res.poll.myVoteOptionId,
      } : p));
      Toast.show({ type: 'success', text1: 'Vote recorded!' });
    } catch (err) { handleApiError(err); }
    finally { setVotingPollId(null); }
  }

  async function handleSaveEvent() {
    if (!editName.trim()) { showAlert({ title: 'Error', message: 'Event name is required' }); return; }
    try {
      await apiUpdateEvent(event.id, {
        name: editName.trim(),
        ...(editLocation ? { location: { name: editLocation } } : {}),
        ...(editType ? { eventType: editType } : {}),
        ...(editDateObj ? { eventDate: editDateObj.toISOString().split('T')[0] } : {}),
      });
      // Immediately fetch fresh event data to ensure consistency
      const freshData = await getEventDetail(event.id);
      setEvent(prev => ({
        ...prev,
        name: freshData.event.name,
        location: freshData.event.location?.name ?? prev.location,
        dateLine: freshData.event.eventDate
          ? new Date(freshData.event.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
          : prev.dateLine,
        type: freshData.event.eventType ?? prev.type,
        description: freshData.event.description ?? prev.description,
      }));
    } catch (err) { handleApiError(err); }
    setShowEditEvent(false);
  }

  function openEditEvent() {
    setEditName(event.name);
    setEditLocation(event.location);
    setEditType(event.type);
    setEditDateObj(undefined);
    setShowEditTypeDrop(false);
    setShowEditEvent(true);
  }

  function countWords(text: string) {
    return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
  }

  return (
    <BlobBackground>
      <SafeAreaView style={styles.container}>

        <AppHeader
          notificationCount={unreadCount}
          onLogoPress={() => navigation.goBack()}
          onBellPress={() => navigation.navigate('Notifications')}
          onMenuPress={() => navigation.goBack()}
        />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          {loadingDetail && (
            <ActivityIndicator size="small" color="#0d9488" style={{ marginVertical: 8 }} />
          )}

          {/* Hero Card — with stats row inside */}
          <SharedDetailHeroCard
            name={event.name}
            dateLine={event.dateLine}
            location={event.location}
            dayCount={Math.abs(event.dayCount)}
            dayLabel={dayLabel}
            memberCount={memberCount}
            memberAvatars={members
              .map(m => ({ id: m.userId, uri: m.avatarUrl ?? '' }))
              .filter(m => m.uri)}
            docCount={docs.length}
            photoCount={photos.length}
            totalExpenses={totalExp}
            onEdit={openEditEvent}
          />

          {/* ── Action Buttons: 4 top row, 2 bottom aligned under Docs & Members ── */}
          <View style={styles.actionsWrap}>
            {/* Row 1: Docs | Members | Photos | Expenses */}
            <View style={styles.actionsRow}>
              {[
                { label: 'Docs', bg: '#E8F5EE', ic: '#0D9488', p: 'docs', fn: () => { setShowDocs(true); setUnreadCounts(p => ({ ...p, docs: 0 })); markEventSectionViewed(event.id, 'docs'); }, count: badgeCounts.docs },
                { label: 'Members', bg: '#F1E8FF', ic: '#8B5CF6', p: 'members', fn: () => { setShowMembers(true); setUnreadCounts(p => ({ ...p, members: 0 })); markEventSectionViewed(event.id, 'members'); }, count: badgeCounts.members },
                { label: 'Photos', bg: '#FFEAF0', ic: '#F43F5E', p: 'photos', fn: () => { setShowPhotos(true); setUnreadCounts(p => ({ ...p, photos: 0 })); markEventSectionViewed(event.id, 'photos'); }, count: badgeCounts.photos },
                { label: 'Expenses', bg: '#FFF0DD', ic: '#F59E0B', p: 'expenses', fn: () => { setShowExpenses(true); setUnreadCounts(p => ({ ...p, expenses: 0 })); markEventSectionViewed(event.id, 'expenses'); }, count: badgeCounts.expenses },
              ].map(btn => (
                <TouchableOpacity key={btn.p} style={styles.actionBtn} onPress={btn.fn} activeOpacity={0.8}>
                  <View style={{ position: 'relative' }}>
                    <View style={[styles.actionCircle, { backgroundColor: btn.bg }]}><ActionIcon path={btn.p} color={btn.ic} /></View>
                    {btn.count > 0 && (
                      <View style={styles.cardBadge}>
                        <Text style={styles.cardBadgeText}>{btn.count > 99 ? '99+' : btn.count}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.actionLabel}>{btn.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Row 2: Polls under Docs (col 0), Notes under Members (col 1), rest empty */}
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => { setShowPolls(true); setUnreadCounts(p => ({ ...p, polls: 0 })); markEventSectionViewed(event.id, 'polls'); }} activeOpacity={0.8}>
                <View style={{ position: 'relative' }}>
                  <View style={[styles.actionCircle, { backgroundColor: '#F1EBFF' }]}><ActionIcon path="polls" color="#8B5CF6" /></View>
                  {badgeCounts.polls > 0 && (
                    <View style={styles.cardBadge}>
                      <Text style={styles.cardBadgeText}>{badgeCounts.polls > 99 ? '99+' : badgeCounts.polls}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.actionLabel}>Polls</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => { setShowNotes(true); setUnreadCounts(p => ({ ...p, notes: 0 })); markEventSectionViewed(event.id, 'notes'); }} activeOpacity={0.8}>
                <View style={{ position: 'relative' }}>
                  <View style={[styles.actionCircle, { backgroundColor: '#E8F7EA' }]}><ActionIcon path="notes" color="#10B981" /></View>
                  {badgeCounts.notes > 0 && (
                    <View style={styles.cardBadge}>
                      <Text style={styles.cardBadgeText}>{badgeCounts.notes > 99 ? '99+' : badgeCounts.notes}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.actionLabel}>Notes</Text>
              </TouchableOpacity>
              {/* Spacers to keep alignment with 4-col grid */}
              <View style={styles.actionBtn} />
              <View style={styles.actionBtn} />
            </View>
          </View>

          {/* ── Description ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Rect x={3} y={2} width={18} height={18} rx={2} stroke="#0d9488" strokeWidth={2} />
                  <Path d="M16 2v4M8 2v4M3 10h18" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={styles.sectionTitle}>Description</Text>
              </View>
              {!editingDesc && (
                <TouchableOpacity
                  onPress={() => { setDescDraft(event.description); setEditingDesc(true); }}
                  activeOpacity={0.7} style={{ padding: 4 }}>
                  <PencilIcon size={14} color="#64748b" />
                </TouchableOpacity>
              )}
            </View>
            {editingDesc ? (
              <View style={styles.descEditCard}>
                <TextInput
                  style={styles.descInput}
                  value={descDraft}
                  onChangeText={v => {
                    if (countWords(v) <= 100) setDescDraft(v);
                  }}
                  multiline
                  autoFocus
                  placeholderTextColor="#94a3b8"
                  placeholder={"Description\nGet ready for an amazing event! Use the action buttons above to manage documents, invite members, share photos, track expenses, create polls, and add notes."}
                />
                <View style={styles.descEditFooter}>
                  <Text style={[styles.descWordCount, countWords(descDraft) >= 100 && { color: '#ef4444' }]}>
                    {countWords(descDraft)} / 100 words
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      style={styles.descCancelBtn}
                      onPress={() => setEditingDesc(false)}
                      activeOpacity={0.7}>
                      <Text style={styles.descCancelTxt}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.descSaveBtn}
                      onPress={async () => {
                        try {
                          await apiUpdateEvent(event.id, { description: descDraft });
                          setEvent(prev => ({ ...prev, description: descDraft }));
                        } catch (err) { handleApiError(err); }
                        setEditingDesc(false);
                      }}
                      activeOpacity={0.85}>
                      <Text style={styles.descSaveTxt}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.descCard}
                onPress={() => { setDescDraft(event.description); setEditingDesc(true); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.descText, !event.description && { color: '#94a3b8', fontStyle: 'italic' }]}>
                  {event.description || 'Add a description for your event — what\'s it about, what to expect, dress code, agenda...'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Photos ── */}
          <View style={styles.section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Rect x={3} y={3} width={18} height={18} rx={2} stroke="#0d9488" strokeWidth={2} />
                <Circle cx={8.5} cy={8.5} r={1.5} fill="#0d9488" />
                <Path d="M21 15l-5-5L5 21" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Photos</Text>
            </View>

            {photos.length === 0 ? (
              <View style={styles.emptyBox}>
                <Svg width={36} height={36} viewBox="0 0 24 24" fill="none">
                  <Rect x={3} y={3} width={18} height={18} rx={2} stroke="#cbd5e1" strokeWidth={1.5} />
                  <Circle cx={8.5} cy={8.5} r={1.5} fill="#cbd5e1" />
                  <Path d="M21 15l-5-5L5 21" stroke="#cbd5e1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={styles.emptyTitle}>No photos yet</Text>
                <Text style={styles.emptySub}>Add photos to capture event memories</Text>
              </View>
            ) : (() => {
              const THUMB = (Dimensions.get('window').width - 32 - 32 - 16) / 3;
              return (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {photos.map(p => (
                    <EventMainPhotoItem key={p.id} photo={p} size={THUMB} onPress={() => openPhotoPreview(p.id)} />
                  ))}
                </View>
              );
            })()}
          </View>

        </ScrollView>

        <SweeFab
          onPress={() => navigation.navigate('ChatDetail', {
            chat: { id: 'swee', name: 'Swee', isSwee: true, subtitle: 'Always active · AI Assistant' },
            tripContext: {
              name: event?.name,
              destination: typeof event?.location === 'string' ? event.location : '',
              startDate: event?.dateLine ?? undefined,
              memberCount: members?.length,
              contextType: 'event',
            },
          })}
          fabStyle={{ bottom: 78 }}
        />

        <FloatingTabBar activeTab="events" navigation={navigation} />

        {/* ═══════════════════════════════════════════════════
            MODAL 1 — Documents
        ═══════════════════════════════════════════════════ */}
        <Modal visible={showDocs} transparent animationType="fade" onRequestClose={() => setShowDocs(false)}>
          <View style={styles.overlay}>
            <View style={[styles.dialog, { maxHeight: '80%' }]}>
              <DHeader title="Documents" onClose={() => setShowDocs(false)} />
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.dBody}>
                  <TouchableOpacity style={styles.tealBtnFull} onPress={handleUploadDoc} activeOpacity={0.85}>
                    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" style={{ marginRight: 8 }}>
                      <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <Text style={styles.tealBtnTxt}>Upload from Phone</Text>
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <TouchableOpacity style={[styles.tealBtnFull, { flex: 1, backgroundColor: '#EA4335' }]} onPress={() => openEmailPicker('gmail')} activeOpacity={0.85}>
                      <Text style={styles.tealBtnTxt} numberOfLines={1}>{emailStatus.gmail.connected ? 'Gmail' : 'Connect Gmail'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.tealBtnFull, { flex: 1, backgroundColor: '#0078D4' }]} onPress={() => openEmailPicker('outlook')} activeOpacity={0.85}>
                      <Text style={styles.tealBtnTxt} numberOfLines={1}>{emailStatus.outlook.connected ? 'Outlook' : 'Connect Outlook'}</Text>
                    </TouchableOpacity>
                  </View>
                  {docs.length === 0 ? (
                    <View style={styles.emptyCenter}>
                      <Svg width={52} height={52} viewBox="0 0 24 24" fill="none">
                        <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#cbd5e1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                        <Path d="M14 2v6h6M16 13H8M16 17H8" stroke="#cbd5e1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                      <Text style={styles.emptyTitle}>No documents yet</Text>
                      <Text style={styles.emptySub}>Upload important documents for your event</Text>
                    </View>
                  ) : docs.map(doc => (
                    <TouchableOpacity key={doc.id} style={styles.docRow} activeOpacity={0.7}
                      onPress={() => doc.uri ? setDocPreviewUrl(doc.uri) : showAlert({ title: 'Error', message: 'Document URL not available.' })}>
                      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                        <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        <Path d="M14 2v6h6M16 13H8M16 17H8" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                      <Text style={{ flex: 1, fontSize: 13, color: '#0f172a', marginLeft: 10 }} numberOfLines={1}>{doc.name}</Text>
                      <TouchableOpacity onPress={async () => {
                        try { await deleteEventDoc(event.id, doc.id); setDocs(p => p.filter(d => d.id !== doc.id)); }
                        catch (err) { handleApiError(err); }
                      }} activeOpacity={0.7}>
                        <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '500' }}>Remove</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ═══════════════════════════════════════════════════
            MODAL 1b — Email Attachment Picker
        ═══════════════════════════════════════════════════ */}
        <Modal visible={showEmailPicker} transparent animationType="slide" onRequestClose={() => setShowEmailPicker(false)}>
          <View style={styles.overlay}>
            <View style={[styles.dialog, { maxHeight: '85%' }]}>
              <DHeader title={`Import from ${emailPickerProvider === 'gmail' ? 'Gmail' : 'Outlook'}`} onClose={() => setShowEmailPicker(false)} />
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
                  style={{ maxHeight: 380 }}
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
                <View style={{ padding: 16, borderTopWidth: 0.5, borderColor: '#e2e8f0' }}>
                  <TouchableOpacity
                    style={[styles.tealBtnFull, { opacity: selectedAttachIds.size === 0 ? 0.5 : 1 }]}
                    onPress={confirmEmailImport}
                    disabled={selectedAttachIds.size === 0 || emailImporting}
                    activeOpacity={0.85}>
                    {emailImporting
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.tealBtnTxt}>Import {selectedAttachIds.size > 0 ? `${selectedAttachIds.size} file${selectedAttachIds.size > 1 ? 's' : ''}` : 'Selected'}</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* ═══════════════════════════════════════════════════
            MODAL 2 — Members
        ═══════════════════════════════════════════════════ */}
        <Modal visible={showMembers} transparent animationType="fade" onRequestClose={() => setShowMembers(false)}>
          <View style={styles.overlay}>
            <View style={[styles.dialog, { maxHeight: '88%' }]}>
              <DHeader title="Event Members" subtitle={`Current members: ${memberCount}`} onClose={() => setShowMembers(false)} />
              <TabBar tabs={['From Friends', 'Invite New']} active={memberTab} onSelect={t => setMemberTab(t as any)} />
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
                  <Text style={styles.memberSectionLabel}>Current Members</Text>
                  {members.map(m => (
                    <View key={m.userId} style={styles.memberRow}>
                      {m.avatarUrl && !failedAvatarIds.has(m.userId)
                        ? <CachedImage
                            uri={m.avatarUrl}
                            style={styles.memberAvatar as any}
                            resizeMode="cover"
                            priority="normal"
                            onError={() => setFailedAvatarIds(prev => { const s = new Set(prev); s.add(m.userId); return s; })}
                          />
                        : <View style={styles.avatarPlaceholder}><Text style={{ fontSize: 18 }}>👤</Text></View>}
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.memberName}>{m.fullName}{m.userId === currentUserId ? ' (You)' : ''}</Text>
                      </View>
                      {m.role === 'admin'
                        ? <View style={styles.ownerBadge}><Text style={styles.ownerTxt}>Admin</Text></View>
                        : m.userId !== currentUserId
                          ? <TouchableOpacity onPress={async () => {
                            try { await removeEventMember(event.id, m.userId); setMembers(p => p.filter(x => x.userId !== m.userId)); }
                            catch (err) { handleApiError(err); }
                          }} activeOpacity={0.7}>
                            <Text style={{ color: '#ef4444', fontSize: 12 }}>Remove</Text>
                          </TouchableOpacity>
                          : null}
                    </View>
                  ))}
                </View>

                {memberTab === 'From Friends' && (
                  <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 }}>
                    <Text style={styles.memberSectionLabel}>Add from Friends</Text>
                    <View style={styles.searchBox}>
                      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"><Circle cx={11} cy={11} r={8} stroke="#94a3b8" strokeWidth={2} /><Path d="M21 21l-4.35-4.35" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
                      <TextInput style={styles.searchInput} placeholder="Search by name..." placeholderTextColor="#94a3b8" value={memberSearch} onChangeText={setMemberSearch} />
                    </View>
                    {filteredFriends.length === 0 ? (
                      <Text style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, marginTop: 16, marginBottom: 8 }}>
                        {apiFriends.length === 0 ? 'No friends found. Add friends to invite them.' : 'All your friends are already members.'}
                      </Text>
                    ) : filteredFriends.map(f => {
                      const sel = selectedFriends.includes(f.id);
                      return (
                        <TouchableOpacity key={f.id} style={styles.memberRow} onPress={() => setSelectedFriends(p => p.includes(f.id) ? p.filter(x => x !== f.id) : [...p, f.id])} activeOpacity={0.8}>
                          <EventFriendAvatar uri={f.avatar} name={f.name} style={styles.memberAvatar as any} />
                          <View style={{ flex: 1, marginLeft: 10 }}><Text style={styles.memberName}>{f.name}</Text></View>
                          {sel ? <View style={styles.checkCircle}><CheckIcon /></View> : null}
                        </TouchableOpacity>
                      );
                    })}
                    {selectedFriends.length > 0 && (
                      <TouchableOpacity style={[styles.tealBtnFull, { marginTop: 12 }]} onPress={handleAddMembersFromFriends} activeOpacity={0.85}>
                        <Text style={styles.tealBtnTxt}>Add {selectedFriends.length} Member{selectedFriends.length > 1 ? 's' : ''}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {memberTab === 'Invite New' && (
                  <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 }}>
                    <Text style={styles.memberSectionLabel}>Invite new people to this event</Text>
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                      {[
                        { key: 'email', icon: (a: boolean) => <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke={a ? '#fff' : '#64748b'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /><Path d="M22 6l-10 7L2 6" stroke={a ? '#fff' : '#64748b'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg> },
                        { key: 'sms', icon: (a: boolean) => <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={a ? '#fff' : '#64748b'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg> },
                        { key: 'whatsapp', icon: (a: boolean) => <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke={a ? '#fff' : '#64748b'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg> },
                      ].map(m => (
                        <TouchableOpacity key={m.key} onPress={() => setInviteMethod(m.key as any)} style={[styles.inviteIconBtn, inviteMethod === m.key && styles.inviteIconBtnActive]} activeOpacity={0.7}>
                          {m.icon(inviteMethod === m.key)}
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TextInput style={[styles.fInput, { flex: 1 }]} placeholder={inviteMethod === 'email' ? 'Enter email address' : 'Enter phone number'} placeholderTextColor="#94a3b8" value={inviteInput} onChangeText={setInviteInput} keyboardType={inviteMethod === 'email' ? 'email-address' : 'phone-pad'} autoCapitalize="none" />
                      <TouchableOpacity style={styles.sendBtn} onPress={handleAddMembersFromFriends} activeOpacity={0.85}>
                        <Text style={styles.tealBtnTxt}>Send</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ═══════════════════════════════════════════════════
            MODAL 3 — Photos
        ═══════════════════════════════════════════════════ */}
        <Modal visible={showPhotos} transparent animationType="fade" onRequestClose={() => setShowPhotos(false)}>
          <View style={styles.overlay}>
            <View style={[styles.dialog, { maxHeight: '90%' }]}>
              <DHeader title="Event Photos" onClose={() => setShowPhotos(false)} />
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.dBody}>
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                    <TouchableOpacity style={styles.uploadPhotosBtn} onPress={() => handlePickPhoto(false)} activeOpacity={0.85}>
                      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ marginRight: 6 }}>
                        <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="#be123c" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                      <Text style={styles.uploadPhotosTxt}>Upload Photos</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.takePhotoBtn} onPress={() => handlePickPhoto(true)} activeOpacity={0.85}>
                      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ marginRight: 6 }}>
                        <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="#0e7490" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        <Circle cx={12} cy={13} r={4} stroke="#0e7490" strokeWidth={2} />
                      </Svg>
                      <Text style={styles.takePhotoTxt}>Take Photo</Text>
                    </TouchableOpacity>
                  </View>

                  {photos.length === 0 ? (
                    <View style={styles.emptyCenter}>
                      <Svg width={52} height={52} viewBox="0 0 24 24" fill="none">
                        <Rect x={3} y={3} width={18} height={18} rx={2} stroke="#cbd5e1" strokeWidth={1.5} />
                        <Circle cx={8.5} cy={8.5} r={1.5} fill="#cbd5e1" />
                        <Path d="M21 15l-5-5L5 21" stroke="#cbd5e1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                      <Text style={styles.emptyTitle}>No photos yet</Text>
                      <Text style={styles.emptySub}>Start capturing memories from this event!</Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {photos.map(ph => (
                        <EventPhotoThumb key={ph.id} photo={ph} onPress={() => openPhotoPreview(ph.id)} />
                      ))}
                    </View>
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Fullscreen photo preview */}
        <Modal visible={!!previewPhoto} transparent animationType="fade" onRequestClose={() => setPreviewPhotoIndex(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' }}>
            <FlatList
              ref={photoListRef}
              data={photos}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={previewPhotoIndex ?? 0}
              getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
              style={{ flex: 1 }}
              onMomentumScrollEnd={e => setPreviewPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
              renderItem={({ item }) => <EventPhotoPreview photo={item} />}
              keyExtractor={item => item.id}
            />
            {/* Close button — top left */}
            <TouchableOpacity
              onPress={() => setPreviewPhotoIndex(null)}
              style={{ position: 'absolute', top: 48, left: 20, zIndex: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}
              activeOpacity={0.8}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
            {/* Delete button — top right */}
            {previewPhoto && (
              <TouchableOpacity
                onPress={() => {
                  if (!previewPhoto) return;
                  showConfirm({
                    title: 'Delete Photo',
                    message: 'Remove this photo?',
                    destructive: true,
                    onConfirm: async () => {
                      try {
                        await deleteEventPhoto(event.id, previewPhoto.id);
                        setPhotos(p => p.filter(x => x.id !== previewPhoto.id));
                        setPreviewPhotoIndex(null);
                      } catch (err) { handleApiError(err); }
                    },
                  });
                }}
                style={{ position: 'absolute', top: 48, right: 20, zIndex: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(239,68,68,0.85)', alignItems: 'center', justifyContent: 'center' }}
                activeOpacity={0.8}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </TouchableOpacity>
            )}
            {photos.length > 1 && (
              <>
                <TouchableOpacity
                  onPress={showPrevPhoto}
                  activeOpacity={0.8}
                  style={{ position: 'absolute', left: 12, top: '50%', marginTop: -22, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: '#fff', fontSize: 28, lineHeight: 30 }}>{'‹'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={showNextPhoto}
                  activeOpacity={0.8}
                  style={{ position: 'absolute', right: 12, top: '50%', marginTop: -22, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: '#fff', fontSize: 28, lineHeight: 30 }}>{'›'}</Text>
                </TouchableOpacity>
                <View style={{ position: 'absolute', bottom: 36, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '500' }}>{(previewPhotoIndex ?? 0) + 1} / {photos.length}</Text>
                </View>
              </>
            )}
          </View>
        </Modal>

        {/* Document preview modal */}
        <Modal visible={!!docPreviewUrl} transparent={false} animationType="slide" onRequestClose={() => setDocPreviewUrl(null)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#1e293b' }}>
              <TouchableOpacity onPress={() => setDocPreviewUrl(null)} activeOpacity={0.7} style={{ marginRight: 12 }}>
                <Text style={{ color: '#5eead4', fontSize: 15, fontWeight: '500' }}>✕ Close</Text>
              </TouchableOpacity>
              <Text style={{ color: '#f1f5f9', fontSize: 14, fontWeight: '500', flex: 1 }} numberOfLines={1}>Document Preview</Text>
            </View>
            {docPreviewUrl && (() => {
              const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|heic)(\?|$)/i.test(docPreviewUrl) ||
                docs.find(d => d.uri === docPreviewUrl)?.mimeType?.startsWith('image/');
              return isImage
                ? <Image source={{ uri: docPreviewUrl }} style={{ flex: 1 }} resizeMode="contain" />
                : <WebView
                  source={{ uri: `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(docPreviewUrl)}` }}
                  style={{ flex: 1 }}
                  startInLoadingState
                  javaScriptEnabled
                />;
            })()}
          </SafeAreaView>
        </Modal>

        {/* ═══════════════════════════════════════════════════
            MODAL 4 — Expenses
        ═══════════════════════════════════════════════════ */}
        <Modal visible={showExpenses} transparent animationType="fade" onRequestClose={() => { setShowExpenses(false); setShowAddExpense(false); setEditingExpenseId(null); }}>
          <View style={styles.overlay}>
            <View style={[styles.dialog, { maxHeight: '92%' }]}>
              <DHeader title="Expenses" onClose={() => { setShowExpenses(false); setShowAddExpense(false); setEditingExpenseId(null); }} />
              <TabBar tabs={['All Expenses', 'Balances']} active={expTab} onSelect={t => setExpTab(t as any)} />
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                {expTab === 'All Expenses' && (
                  <View style={styles.dBody}>
                    <TouchableOpacity style={styles.tealBtnFull} onPress={() => {
                      const allIds = ['You', ...members.filter(m => m.userId !== currentUserId).map(m => m.userId)];
                      setExpSplitAmong(allIds); setExpPaidBy('You');
                      setExpDesc(''); setExpAmount(''); setExpSplitType('equally'); setExpSplitDetails({});
                      setEditingExpenseId(null);
                      setShowAddExpense(p => !p);
                    }} activeOpacity={0.85}>
                      <Text style={styles.tealBtnTxt}>+ Add Expense</Text>
                    </TouchableOpacity>

                    {showAddExpense && (
                      <View style={{ marginTop: 14 }}>
                        <Text style={styles.fLabel}>Description</Text>
                        <TextInput style={styles.fInput} placeholder="e.g., Event tickets" placeholderTextColor="#94a3b8" value={expDesc} onChangeText={setExpDesc} />
                        <Text style={styles.fLabel}>Amount (₹)</Text>
                        <TextInput style={styles.fInput} placeholder="0.00" placeholderTextColor="#94a3b8" value={expAmount} onChangeText={setExpAmount} keyboardType="numeric" />
                        <Text style={styles.fLabel}>Category</Text>
                        <TouchableOpacity style={styles.fInputTouch} onPress={() => setShowExpCatDrop(p => !p)} activeOpacity={0.8}>
                          <Text style={{ fontSize: 13, color: '#0f172a' }}>{expCategory.emoji} {expCategory.label}</Text>
                        </TouchableOpacity>
                        {showExpCatDrop && (
                          <View style={styles.dropdown}>
                            {EXPENSE_CATS.map(c => (
                              <TouchableOpacity key={c.label} style={styles.dropdownItem} onPress={() => { setExpCategory(c); setShowExpCatDrop(false); }} activeOpacity={0.7}>
                                <Text style={{ fontSize: 13, color: '#0f172a' }}>{c.emoji} {c.label}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                        <Text style={styles.fLabel}>Paid by</Text>
                        <TouchableOpacity style={styles.fInputTouch} onPress={() => setShowPaidByDrop(p => !p)} activeOpacity={0.8}>
                          <Text style={{ fontSize: 13, color: '#0f172a' }}>{expPaidBy}</Text>
                        </TouchableOpacity>
                        {showPaidByDrop && (
                          <View style={styles.dropdown}>
                            {['You', ...members.filter(m => m.userId !== currentUserId).map(m => m.fullName)].map(name => (
                              <TouchableOpacity key={name} style={styles.dropdownItem} onPress={() => { setExpPaidBy(name); setShowPaidByDrop(false); }} activeOpacity={0.7}>
                                <Text style={{ fontSize: 13, color: '#0f172a' }}>{name}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                        <Text style={styles.fLabel}>Split type</Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
                          {(['equally', 'amount', 'percent'] as const).map((key, i) => (
                            <TouchableOpacity key={key} onPress={() => setExpSplitType(key)} style={[styles.splitTypeBtn, expSplitType === key && styles.splitTypeBtnActive]} activeOpacity={0.8}>
                              <Text style={[styles.splitTypeTxt, expSplitType === key && styles.splitTypeTxtActive]}>{['Equally', 'By Amount', 'By %'][i]}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <Text style={styles.fLabel}>Split among</Text>
                        <TouchableOpacity style={[styles.splitRow, expSplitAmong.includes('You') && styles.splitRowActive]} onPress={() => setExpSplitAmong(p => p.includes('You') ? p.filter(x => x !== 'You') : [...p, 'You'])} activeOpacity={0.8}>
                          <View style={[styles.splitCheck, expSplitAmong.includes('You') && styles.splitCheckActive]}>
                            {expSplitAmong.includes('You') && <CheckIcon />}
                          </View>
                          <Text style={{ fontSize: 13, color: '#0f172a', flex: 1, marginLeft: 8 }}>You</Text>
                          {expSplitType !== 'equally' && (
                            <TextInput style={[styles.fInput, { width: 72, marginBottom: 0, paddingVertical: 6, textAlign: 'right' }]} placeholder={expSplitType === 'percent' ? '0 %' : '0.00'} placeholderTextColor="#94a3b8" keyboardType="numeric" value={expSplitDetails['You'] || ''} onChangeText={v => setExpSplitDetails(p => ({ ...p, You: v }))} />
                          )}
                        </TouchableOpacity>
                        {members.filter(m => m.userId !== currentUserId).map(m => (
                          <TouchableOpacity key={m.userId} style={[styles.splitRow, expSplitAmong.includes(m.userId) && styles.splitRowActive]} onPress={() => setExpSplitAmong(p => p.includes(m.userId) ? p.filter(x => x !== m.userId) : [...p, m.userId])} activeOpacity={0.8}>
                            <View style={[styles.splitCheck, expSplitAmong.includes(m.userId) && styles.splitCheckActive]}>
                              {expSplitAmong.includes(m.userId) && <CheckIcon />}
                            </View>
                            <Text style={{ fontSize: 13, color: '#0f172a', flex: 1, marginLeft: 8 }}>{m.fullName}</Text>
                            {expSplitType !== 'equally' && (
                              <TextInput style={[styles.fInput, { width: 72, marginBottom: 0, paddingVertical: 6, textAlign: 'right' }]} placeholder={expSplitType === 'percent' ? '0 %' : '0.00'} placeholderTextColor="#94a3b8" keyboardType="numeric" value={expSplitDetails[m.userId] || ''} onChangeText={v => setExpSplitDetails(p => ({ ...p, [m.userId]: v }))} />
                            )}
                          </TouchableOpacity>
                        ))}
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                          <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowAddExpense(false); setEditingExpenseId(null); }} activeOpacity={0.7}><Text style={styles.cancelTxt}>Cancel</Text></TouchableOpacity>
                          <TouchableOpacity style={[styles.tealBtnFull, { flex: 1 }]} onPress={handleAddExpense} activeOpacity={0.85}><Text style={styles.tealBtnTxt}>{editingExpenseId ? 'Update Expense' : 'Add Expense'}</Text></TouchableOpacity>
                        </View>
                      </View>
                    )}

                    {expenses.length === 0 && !showAddExpense ? (
                      <View style={styles.emptyCenter}>
                        <Svg width={52} height={52} viewBox="0 0 24 24" fill="none">
                          <Path d="M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6" stroke="#cbd5e1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                        <Text style={styles.emptyTitle}>No expenses tracked yet</Text>
                        <Text style={styles.emptySub}>Start adding expenses to split with your group</Text>
                      </View>
                    ) : (
                      <View style={{ marginTop: 12 }}>
                        {expenses.map(exp => {
                          const myAmt = exp.myAmount ?? 0;
                          const balText = exp.paidBy === 'You'
                            ? `You lent ₹${(exp.amount - myAmt).toFixed(2)}`
                            : `You owe ₹${myAmt.toFixed(2)}`;
                          const balColor = exp.paidBy === 'You' ? '#0d9488' : '#ef4444';
                          return (
                            <View key={exp.id} style={styles.expRow}>
                              <View style={styles.expIconBox}><Text style={{ fontSize: 18 }}>{EXPENSE_CATS.find(c => c.label === (EXPENSE_CAT_SLUG_TO_LABEL[(exp.category || '').toLowerCase()] ?? exp.category))?.emoji || '📦'}</Text></View>
                              <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={styles.expName}>{exp.description}</Text>
                                <Text style={styles.expMeta}>Paid by {exp.paidBy}</Text>
                                <Text style={styles.expMeta}>{exp.date}</Text>
                              </View>
                              <View style={{ alignItems: 'flex-end' }}>
                                <Text style={styles.expAmt}>₹{exp.amount.toFixed(2)}</Text>
                                <Text style={{ fontSize: 11, color: balColor, marginBottom: 6 }}>{balText}</Text>
                                {(canEditExpense(exp) || myMemberRole === 'admin' || exp.createdByUserId === currentUserId) && (
                                  <View style={{ flexDirection: 'row', gap: 12 }}>
                                    {canEditExpense(exp) && (
                                      <TouchableOpacity onPress={() => startEditExpense(exp)} activeOpacity={0.7}><Text style={{ fontSize: 12, color: '#0d9488', fontWeight: '500' }}>Edit</Text></TouchableOpacity>
                                    )}
                                    {(myMemberRole === 'admin' || exp.createdByUserId === currentUserId) && (
                                      <TouchableOpacity onPress={() => handleDeleteExpense(exp.id, exp.createdByUserId ?? '')} activeOpacity={0.7}><Text style={{ fontSize: 12, color: '#ef4444', fontWeight: '500' }}>Delete</Text></TouchableOpacity>
                                    )}
                                  </View>
                                )}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}

                {expTab === 'Balances' && (
                  <View style={styles.dBody}>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                      <View style={styles.balCard}><Text style={styles.balLabel}>Total</Text><Text style={styles.balValue}>₹{totalExp.toFixed(0)}</Text></View>
                      <View style={[styles.balCard, { backgroundColor: myBalance >= 0 ? '#f0fdf4' : '#fff1f2' }]}>
                        <Text style={styles.balLabel}>My Balance</Text>
                        <Text style={[styles.balValue, { color: myBalance >= 0 ? '#16a34a' : '#e11d48' }]}>
                          {myBalance >= 0 ? '+' : ''}₹{Math.abs(myBalance).toFixed(0)}
                        </Text>
                      </View>
                    </View>
                    {balances.length === 0 ? (
                      <View style={styles.emptyCenter}>
                        <Svg width={52} height={52} viewBox="0 0 24 24" fill="none">
                          <Path d="M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6" stroke="#cbd5e1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                        <Text style={styles.emptyTitle}>All settled up!</Text>
                        <Text style={styles.emptySub}>No outstanding balances</Text>
                      </View>
                    ) : balances.map((debt, i) => (
                      <View key={i} style={[styles.expRow, { alignItems: 'center' }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.expName}>{debt.fromName} owes {debt.toName}</Text>
                          <Text style={styles.expMeta}>₹{debt.amount.toFixed(2)}</Text>
                        </View>
                        {debt.from === currentUserId && (
                          <TouchableOpacity style={[styles.tealBtnFull, { paddingHorizontal: 12, paddingVertical: 6 }]}
                            onPress={() => handleSettleEventDebt(debt.to, debt.amount)}
                            activeOpacity={0.85}>
                            <Text style={[styles.tealBtnTxt, { fontSize: 12 }]}>Settle</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ═══════════════════════════════════════════════════
            MODAL 5 — Polls
        ═══════════════════════════════════════════════════ */}
        <Modal visible={showPolls} transparent animationType="fade" onRequestClose={() => setShowPolls(false)}>
          <Toast />
          <View style={styles.overlay}>
            <View style={[styles.dialog, { maxHeight: '88%' }]}>
              <DHeader title="Polls" onClose={() => { setShowPolls(false); setShowPollForm(false); setPollQuestion(''); setPollOptions(['', '']); }} />
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={styles.dBody}>

                  {/* Create Poll button */}
                  <TouchableOpacity
                    style={styles.tealBtnFull}
                    onPress={() => setShowPollForm(v => !v)}
                    activeOpacity={0.85}>
                    <Text style={styles.tealBtnTxt}>{showPollForm ? '✕  Cancel' : '+  Create Poll'}</Text>
                  </TouchableOpacity>

                  {/* Inline create form */}
                  {showPollForm && (
                    <View style={{ marginTop: 14 }}>
                      <Text style={styles.fLabel}>Question</Text>
                      <TextInput style={styles.fInput} placeholder="What do you want to ask?" placeholderTextColor="#94a3b8" value={pollQuestion} onChangeText={setPollQuestion} />
                      <Text style={[styles.fLabel, { marginTop: 12 }]}>Options</Text>
                      {pollOptions.map((opt, i) => (
                        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <TextInput style={[styles.fInput, { flex: 1 }]} placeholder={`Option ${i + 1}`} placeholderTextColor="#94a3b8" value={opt} onChangeText={v => setPollOptions(p => { const n = [...p]; n[i] = v; return n; })} />
                          {pollOptions.length > 2 && (
                            <TouchableOpacity onPress={() => setPollOptions(p => p.filter((_, j) => j !== i))} activeOpacity={0.7}>
                              <TrashIcon color="#ef4444" />
                            </TouchableOpacity>
                          )}
                        </View>
                      ))}
                      <TouchableOpacity onPress={() => setPollOptions(p => [...p, ''])} activeOpacity={0.7} style={{ marginTop: 2, marginBottom: 12 }}>
                        <Text style={{ fontSize: 13, color: '#0d9488', fontWeight: '500' }}>+ Add Option</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.tealBtnFull} onPress={handleCreatePoll} activeOpacity={0.85}>
                        <Text style={styles.tealBtnTxt}>Submit Poll</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Poll list */}
                  {polls.length > 0 && <View style={{ marginTop: 16 }} />}
                  {polls.map(poll => {
                    const totalVotes = poll.options.reduce((s, o) => s + o.voteCount, 0);
                    const isOwner = poll.createdBy === currentUserId;
                    const isVoting = votingPollId === poll.id;
                    return (
                      <View key={poll.id} style={styles.pollCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.pollQ}>{poll.question}</Text>
                            <Text style={styles.pollMeta}>{isOwner ? 'By You' : 'By a member'} • {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}</Text>
                          </View>
                          <TouchableOpacity onPress={() => handleDeletePoll(poll.id)} activeOpacity={0.7} style={styles.pollDeleteBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                            <TrashIcon color="#ef4444" size={15} />
                          </TouchableOpacity>
                        </View>
                        {poll.options.map(opt => {
                          const pct = totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 100) : 0;
                          const isMyVote = opt.votedByMe || poll.myVoteOptionId === opt.id;
                          return (
                            <TouchableOpacity
                              key={opt.id}
                              disabled={isVoting}
                              onPress={() => handleVote(poll.id, opt.id)}
                              activeOpacity={0.8}
                              style={styles.pollOptRow}>
                              <View style={[styles.pollBar, { width: `${pct}%` as any, backgroundColor: isMyVote ? '#0d9488' : '#ccfbf1' }]} />
                              <Text style={[styles.pollOptTxt, isMyVote && { fontWeight: '600', color: '#0d9488' }]} numberOfLines={1}>
                                {isMyVote ? '✓  ' : ''}{opt.text}
                              </Text>
                              <Text style={styles.pollVotes}>{opt.voteCount}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    );
                  })}

                  {polls.length === 0 && !showPollForm && (
                    <View style={styles.emptyCenter}>
                      <Text style={styles.emptyTitle}>No polls yet</Text>
                      <Text style={styles.emptySub}>Create the first poll above</Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ═══════════════════════════════════════════════════
            MODAL 6 — Notes
        ═══════════════════════════════════════════════════ */}
        <Modal visible={showNotes} transparent animationType="fade" onRequestClose={() => setShowNotes(false)}>
          <View style={styles.overlay}>
            <View style={[styles.dialog, { maxHeight: '88%' }]}>
              <DHeader title="Event Notes" onClose={() => setShowNotes(false)} />
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={styles.dBody}>
                  <TextInput style={styles.fInput} placeholder="Note title..." placeholderTextColor="#94a3b8" value={noteTitle} onChangeText={setNoteTitle} />
                  <TextInput style={[styles.fInput, { height: 90, textAlignVertical: 'top', paddingTop: 10, marginTop: 8 }]} placeholder="Write your note here..." placeholderTextColor="#94a3b8" value={noteBody} onChangeText={setNoteBody} multiline />
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, alignItems: 'center' }}>
                    <TouchableOpacity style={styles.catBtn} onPress={() => setShowNoteCatDrop(p => !p)} activeOpacity={0.8}>
                      <Text style={{ fontSize: 13, color: '#0f172a' }}>{noteCatDisplay.emoji} {noteCatDisplay.label}</Text>
                    </TouchableOpacity>
                    {editingNoteId && (
                      <TouchableOpacity onPress={() => { setEditingNoteId(null); setNoteTitle(''); setNoteBody(''); setNoteCategory('general'); }} activeOpacity={0.7} style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
                        <Text style={{ fontSize: 13, color: '#64748b' }}>Cancel</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[styles.tealBtnFull, { flex: 1 }]} onPress={handleAddNote} activeOpacity={0.85}>
                      <Text style={styles.tealBtnTxt}>{editingNoteId ? 'Update Note' : 'Add Note'}</Text>
                    </TouchableOpacity>
                  </View>
                  {showNoteCatDrop && (
                    <View style={styles.dropdown}>
                      {NOTE_CATS.map(c => (
                        <TouchableOpacity key={c.key} style={styles.dropdownItem} onPress={() => { setNoteCategory(c.key as any); setShowNoteCatDrop(false); }} activeOpacity={0.7}>
                          <Text style={{ fontSize: 13, color: '#0f172a' }}>{c.emoji} {c.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {notes.length === 0 ? (
                    <View style={styles.emptyCenter}>
                      <Svg width={44} height={44} viewBox="0 0 24 24" fill="none">
                        <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#cbd5e1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                        <Path d="M14 2v6h6M16 13H8M16 17H8" stroke="#cbd5e1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                      <Text style={styles.emptyTitle}>No notes yet</Text>
                      <Text style={styles.emptySub}>Add notes to keep track of important information</Text>
                    </View>
                  ) : (
                    <View style={{ marginTop: 12 }}>
                      {notes.map(note => {
                        const cat = NOTE_CATS.find(c => c.key === note.category)!;
                        return (
                          <TouchableOpacity
                            key={note.id}
                            activeOpacity={0.85}
                            onPress={() => setViewingNote(note)}
                            style={[styles.noteCard, note.pinned && { backgroundColor: '#fefce8', borderColor: '#fde68a' }]}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                              <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: '#f0fdf9', alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 20 }}>{cat.emoji}</Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.noteTitle, { fontSize: 14 }]} numberOfLines={1}>{note.title}</Text>
                                <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                                  {(() => { const cb = (note as any).createdBy; const name = cb ? (typeof cb === 'string' ? cb : cb.name ?? cb.username ?? '') : ''; return name ? `By ${name}` : 'By You'; })()}{note.date ? ` • ${note.date}` : ''}
                                </Text>
                              </View>
                              {/* Star only */}
                              <TouchableOpacity onPress={() => handleTogglePinNote(note)} activeOpacity={0.7} style={{ padding: 6 }}>
                                <Svg width={18} height={18} viewBox="0 0 24 24" fill={note.pinned ? '#0d9488' : 'none'}>
                                  <Path d="M12 2l3 6.5 7 1-5 4.8 1.2 7L12 18l-6.2 3.3L7 14.3 2 9.5l7-1z" stroke={note.pinned ? '#0d9488' : '#94a3b8'} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                                </Svg>
                              </TouchableOpacity>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ═══════════════════════════════════════════════════
            MODAL 6b — Note Detail View
        ═══════════════════════════════════════════════════ */}
        <Modal visible={!!viewingNote} transparent animationType="slide" onRequestClose={() => setViewingNote(null)}>
          <View style={styles.overlay}>
            <View style={[styles.dialog, { maxHeight: '88%' }]}>
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                <TouchableOpacity onPress={() => setViewingNote(null)} activeOpacity={0.7} style={{ marginRight: 10 }}>
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                    <Path d="M19 12H5M12 19l-7-7 7-7" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </TouchableOpacity>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: '#0f172a' }} numberOfLines={1}>{viewingNote?.title}</Text>
                {/* Edit */}
                <TouchableOpacity
                  onPress={() => { if (viewingNote) { startEditNote(viewingNote); setViewingNote(null); } }}
                  activeOpacity={0.7}
                  style={{ padding: 6, marginLeft: 4 }}
                >
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="#64748b" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#64748b" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </TouchableOpacity>
                {/* Delete */}
                <TouchableOpacity
                  onPress={async () => {
                    if (!viewingNote) return;
                    try { await deleteEventNote(event.id, viewingNote.id); setNotes(p => p.filter(n => n.id !== viewingNote.id)); }
                    catch (err) { handleApiError(err); }
                    setViewingNote(null);
                  }}
                  activeOpacity={0.7}
                  style={{ padding: 6, marginLeft: 4 }}
                >
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="#ef4444" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
                {/* Category + meta */}
                {viewingNote && (() => {
                  const cat = NOTE_CATS.find(c => c.key === viewingNote.category)!;
                  return (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                      <View style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#f0fdf9', borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={{ fontSize: 13 }}>{cat.emoji}</Text>
                        <Text style={{ fontSize: 12, color: '#0d9488', fontWeight: '600' }}>{cat.label}</Text>
                      </View>
                      <Text style={{ fontSize: 12, color: '#94a3b8' }}>
                        {(() => { const cb = (viewingNote as any).createdBy; const name = cb ? (typeof cb === 'string' ? cb : cb.name ?? cb.username ?? '') : ''; return name ? `By ${name}` : 'By You'; })()}{viewingNote.date ? ` • ${viewingNote.date}` : ''}
                      </Text>
                    </View>
                  );
                })()}
                {/* Body with hyperlinks */}
                {!!viewingNote?.body
                  ? renderTextWithLinks(viewingNote.body, { fontSize: 15, color: '#334155', lineHeight: 24 }, { color: '#0d9488', textDecorationLine: 'underline' })
                  : <Text style={{ fontSize: 14, color: '#94a3b8', fontStyle: 'italic' }}>No content.</Text>
                }
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ═══════════════════════════════════════════════════
            MODAL 7 — Edit Event
        ═══════════════════════════════════════════════════ */}
        <Modal visible={showEditEvent} transparent animationType="fade" onRequestClose={() => setShowEditEvent(false)}>
          <View style={styles.overlay}>
            <View style={[styles.dialog, { maxHeight: '88%' }]}>
              <DHeader title="Edit Event" onClose={() => setShowEditEvent(false)} />
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always">
                <View style={[styles.dBody, { zIndex: showEditTypeDrop ? 10 : 1 }]}>

                  <Text style={styles.fLabel}>Event Name</Text>
                  <TextInput style={styles.fInput} placeholder="e.g., Spring Music Festival" placeholderTextColor="#94a3b8" value={editName} onChangeText={setEditName} />

                  <Text style={styles.fLabel}>Event Type</Text>
                  <TouchableOpacity
                    style={[styles.fInputTouch, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                    onPress={() => setShowEditTypeDrop(p => !p)} activeOpacity={0.8}>
                    <Text style={{ fontSize: 13, color: '#0f172a' }}>{editType || 'Select type'}</Text>
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                      <Path d="M6 9l6 6 6-6" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </TouchableOpacity>
                  {showEditTypeDrop && (
                    <View style={styles.dropdown}>
                      {EVENT_TYPE_LIST.map(t => (
                        <TouchableOpacity key={t} style={[styles.dropdownItem, editType === t && { backgroundColor: '#f0fdfa' }]}
                          onPress={() => { setEditType(t); setShowEditTypeDrop(false); }} activeOpacity={0.7}>
                          <Text style={[{ fontSize: 13, color: '#0f172a' }, editType === t && { color: '#0d9488', fontWeight: '500' }]}>{t}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <Text style={styles.fLabel}>Event Date</Text>
                  <AppDatePicker
                    mode="event"
                    value={editDateObj ? `${editDateObj.getFullYear()}-${String(editDateObj.getMonth() + 1).padStart(2, '0')}-${String(editDateObj.getDate()).padStart(2, '0')}` : ''}
                    onChange={(iso) => {
                      const [y, m, d] = iso.split('-').map(n => parseInt(n, 10));
                      setEditDateObj(new Date(y, m - 1, d));
                      setEditDateError(null);
                    }}
                    placeholder={event.dateLine || 'Select date'}
                    error={editDateError}
                    title="Edit event date"
                  />

                  <Text style={styles.fLabel}>Location</Text>
                  <View style={{ zIndex: 10 }}>
                    <LocationAutocomplete
                      initialValue={editLocation}
                      onChangeText={setEditLocation}
                      placeholder="e.g., Central Park, NY"
                      variant="edit"
                    />
                  </View>

                </View>
              </ScrollView>
              <View style={styles.dFooterRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEditEvent(false)} activeOpacity={0.7}><Text style={styles.cancelTxt}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.tealBtnFull, { flex: 1 }]} onPress={handleSaveEvent} activeOpacity={0.85}><Text style={styles.tealBtnTxt}>Save Changes</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </BlobBackground>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  topBar: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 2, flexDirection: 'row', alignItems: 'center' },
  topBarTitle: { flex: 1, fontSize: 16, fontWeight: '500', color: '#0f172a', textAlign: 'center' },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingBottom: 150 },

  actionsWrap: { paddingHorizontal: 20, paddingVertical: 16, gap: 16, marginBottom: 6 },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  actionBtn: { alignItems: 'center', width: isSmall ? 52 : 62, gap: 4 },
  actionCircle: { width: isSmall ? 38 : 44, height: isSmall ? 38 : 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
  actionLabel: { fontSize: 13, fontWeight: '500', color: '#0f172a', textAlign: 'center', lineHeight: 16 },
  cardBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#ffffff', paddingHorizontal: 3, zIndex: 10 },
  cardBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '700', lineHeight: 13 },

  section: { paddingHorizontal: 16, marginTop: 20, marginBottom: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '500', color: '#0f172a', marginBottom: 5 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle1: { fontSize: 15, fontWeight: '500', color: '#0f172a', marginBottom: 12 },

  descCard: { backgroundColor: 'transparent', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(13,148,136,0.2)' },
  descText: { fontSize: 13, color: '#475569', lineHeight: 19 },
  descEditCard: { backgroundColor: 'transparent', borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(13,148,136,0.35)' },
  descInput: { fontSize: 13, color: '#0f172a', lineHeight: 19, padding: 14, minHeight: 100, textAlignVertical: 'top', backgroundColor: 'transparent' },
  descEditFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(15,23,42,0.08)' },
  descWordCount: { fontSize: 11, color: '#94a3b8', fontWeight: '500' },
  descCancelBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: '#f1f5f9' },
  descCancelTxt: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  descSaveBtn: { paddingHorizontal: 18, paddingVertical: 7, borderRadius: 8, backgroundColor: '#0d9488' },
  descSaveTxt: { fontSize: 13, color: '#fff', fontWeight: '500' },

  emptyBox: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: '#e2e8f0', paddingVertical: 32, paddingHorizontal: 20, alignItems: 'center' },
  emptyCenter: { alignItems: 'center', paddingVertical: 28 },
  emptyTitle: { fontSize: 13, color: '#64748b', fontWeight: '500', marginTop: 10 },
  emptySub: { fontSize: 12, color: '#94a3b8', marginTop: 4, textAlign: 'center' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.52)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  dialog: { backgroundColor: '#fff', borderRadius: 20, width: '100%', maxHeight: '90%', overflow: 'hidden' },

  dBody: { padding: 16 },
  dFooterSingle: { padding: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  dFooterRow: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' },

  fLabel: { fontSize: 12, fontWeight: '500', color: '#374151', marginBottom: 6, marginTop: 12 },
  fInput: { backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#0f172a' },
  fInputTouch: { backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11 },

  tealBtnFull: { flexDirection: 'row', backgroundColor: '#0d9488', borderRadius: 10, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  tealBtnTxt: { color: '#fff', fontWeight: '500', fontSize: 13 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  cancelTxt: { fontSize: 14, color: '#64748b', fontWeight: '500' },

  docRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },

  memberSectionLabel: { fontSize: 12, fontWeight: '500', color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  memberAvatar: { width: 40, height: 40, borderRadius: 20 },
  memberName: { fontSize: 13, fontWeight: '500', color: '#0f172a' },
  ownerBadge: { backgroundColor: '#f0fdfa', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#99f6e4' },
  ownerTxt: { fontSize: 11, color: '#0d9488', fontWeight: '500' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, marginBottom: 12, gap: 8 },
  searchInput: { flex: 1, fontSize: 13, color: '#0f172a' },
  checkCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#0d9488', alignItems: 'center', justifyContent: 'center' },
  inviteIconBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  inviteIconBtnActive: { borderColor: '#0d9488', backgroundColor: '#0d9488' },
  sendBtn: { backgroundColor: '#0d9488', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },

  uploadPhotosBtn: { flex: 1, flexDirection: 'row', backgroundColor: '#fff1f2', borderWidth: 1.5, borderColor: '#fecdd3', borderRadius: 10, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  uploadPhotosTxt: { fontSize: 13, fontWeight: '500', color: '#be123c' },
  takePhotoBtn: { flex: 1, flexDirection: 'row', backgroundColor: '#ecfeff', borderWidth: 1.5, borderColor: '#a5f3fc', borderRadius: 10, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  takePhotoTxt: { fontSize: 13, fontWeight: '500', color: '#0e7490' },

  expRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  expIconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },
  expName: { fontSize: 13, fontWeight: '500', color: '#0f172a', marginBottom: 2 },
  expMeta: { fontSize: 11, color: '#94a3b8', marginBottom: 1 },
  expAmt: { fontSize: 13, fontWeight: '500', color: '#0f172a', marginBottom: 2 },
  dropdown: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, overflow: 'hidden', marginTop: 4 },
  dropdownItem: { paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  splitTypeBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center' },
  splitTypeBtnActive: { backgroundColor: '#0d9488' },
  splitTypeTxt: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  splitTypeTxtActive: { color: '#fff', fontWeight: '500' },
  splitRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', marginVertical: 4 },
  splitRowActive: { borderColor: '#0d9488', backgroundColor: '#f0fdfa' },
  splitCheck: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center' },
  splitCheckActive: { backgroundColor: '#0d9488', borderColor: '#0d9488' },

  balCard: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, alignItems: 'center' },
  balLabel: { fontSize: 11, color: '#64748b', fontWeight: '500', marginBottom: 4 },
  balValue: { fontSize: 13, fontWeight: '500', color: '#0f172a' },

  pollCard: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  pollQ: { fontSize: 13, fontWeight: '600', color: '#0f172a', marginBottom: 2 },
  pollMeta: { fontSize: 11, color: '#64748b', fontWeight: '400', marginBottom: 10 },
  pollDeleteBtn: { padding: 4 },
  pollOptRow: { position: 'relative', flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', paddingVertical: 10, paddingHorizontal: 12, marginBottom: 6, overflow: 'hidden' },
  pollBar: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 8 },
  pollOptTxt: { flex: 1, fontSize: 12, color: '#0f172a', fontWeight: '500', zIndex: 1 },
  pollVotes: { fontSize: 12, color: '#64748b', fontWeight: '500', zIndex: 1 },

  noteCard: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  noteTitle: { fontSize: 12, fontWeight: '500', color: '#0f172a', flex: 1 },
  noteBody: { fontSize: 12, color: '#64748b', lineHeight: 18 },
  noteLink: { color: '#0d9488', textDecorationLine: 'underline' },
  catBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },

  // ── Highlights sub-section styles ──
  hlSubTitle: { fontSize: 12, fontWeight: '500', color: '#2a303c' },
  seeAllLink: { fontSize: 12, color: '#0d9488', fontWeight: '500' },

  hlDocRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', paddingVertical: 10, paddingHorizontal: 12, gap: 10 },
  hlDocIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center' },
  hlDocName: { flex: 1, fontSize: 12, fontWeight: '500', color: '#0f172a' },

  hlPollCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', padding: 14, gap: 8 },
  hlPollQuestion: { flex: 1, fontSize: 12, fontWeight: '500', color: '#0f172a', lineHeight: 20 },
  hlPollOption: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', paddingVertical: 10, paddingHorizontal: 12, minHeight: 40, position: 'relative', overflow: 'hidden', backgroundColor: '#f8fafc' },
  hlPollOptionVoted: {},
  hlPollOptionUnvoted: {},
  hlPollBar: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 10 },
  hlPollOptionInner: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hlPollOptText: { flex: 1, fontSize: 12, color: '#0f172a', fontWeight: '500' },
  hlPollPct: { fontSize: 11, color: '#64748b', fontWeight: '500', marginLeft: 8 },
  hlPollTotal: { fontSize: 10, color: '#94a3b8', textAlign: 'right', marginTop: 2 },
});
