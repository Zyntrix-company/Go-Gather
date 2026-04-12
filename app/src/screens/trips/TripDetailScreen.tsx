import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal,
  TextInput, Alert, Animated, PanResponder, Image, Platform, Linking, NativeModules,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { WebView } from 'react-native-webview';
// DocumentPicker loaded dynamically to avoid crash if native module not yet linked
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import BlobBackground from '../../components/common/BlobBackground';
import SharedDetailHeroCard from '../../components/common/DetailHeroCard';
import useAuthStore from '../../store/authStore';
import Toast from 'react-native-toast-message';
import {
  getTripDetail,
  updateTrip as apiUpdateTrip,
  deleteTrip as apiDeleteTrip,
  getTripMembers,
  inviteToTrip,
  removeTripMember,
  getActivities,
  createActivity,
  updateActivity,
  deleteActivity,
  uploadActivityPhotos,

  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getBalances,
  settleDebt,
  getDocs,
  uploadDoc,
  deleteDoc,
  getTripPhotos,
  uploadTripPhotos,
  deleteTripPhoto,
  getNotes,
  createNote,
  updateNote,
  deleteNote,
  favoriteNote,
  getPolls,
  createPoll,
  voteOnPoll,
  getFriends,
  handleApiError,
} from '../../api/trips.api';
import type { TripMember, Debt } from '../../api/trips.api';


// ─── Types ────────────────────────────────────────────────────────────────────

type Activity = {
  id: string; title: string; date: string; hour: string; minute: string;
  location?: string; description?: string; completed?: boolean;
  linkedExpense?: { id: string; description: string; amount: number } | null;
};
type DocItem = { id: string; name: string; uri: string; mimeType?: string };
type PhotoItem = { id: string; uri: string; localUri?: string; name: string; uploadedBy?: string; activityId?: string | null; activityTitle?: string | null };
type Expense = {
  id: string; description: string; amount: number; category: string;
  paidBy: string; splitType: 'equally' | 'amount' | 'percent';
  splitAmong: string[]; date: string;
  activityId?: string | null;
  myAmount?: number;   // current user's share of this expense
};
type Poll = { id: string; question: string; options: { id: string; text: string; voteCount: number; votedByMe: boolean }[]; myVoteOptionId?: string | null };
type Note = { id: string; title: string; body: string; category: 'general' | 'idea' | 'important' | 'todo'; date: string; pinned?: boolean };

// ─── Friends ──────────────────────────────────────────────────────────────────

const FRIENDS = [
  { id: '1', name: 'Yuki Tanaka',     email: 'yuki.tanaka@example.com',  avatar: 'https://i.pravatar.cc/150?img=32' },
  { id: '2', name: 'Amara Okafor',    email: 'amara.okafor@example.com', avatar: 'https://i.pravatar.cc/150?img=38' },
  { id: '3', name: 'Marcus Johnson',  email: 'marcus.j@example.com',     avatar: 'https://i.pravatar.cc/150?img=13' },
  { id: '4', name: 'Priya Sharma',    email: 'priya.sharma@example.com', avatar: 'https://i.pravatar.cc/150?img=45' },
  { id: '5', name: 'Carlos Rodriguez',email: 'carlos.r@example.com',     avatar: 'https://i.pravatar.cc/150?img=12' },
];

const EXPENSE_CATS = [
  { label: 'General',       emoji: '📦' },
  { label: 'Food & Dining', emoji: '🍽️' },
  { label: 'Transport',     emoji: '🚗' },
  { label: 'Stay',          emoji: '🏨' },
  { label: 'Entertainment', emoji: '🎭' },
  { label: 'Shopping',      emoji: '🛍️' },
  { label: 'Other',         emoji: '🌐' },
];
const NOTE_CATS = [
  { key: 'general',   label: 'General',   emoji: '📝' },
  { key: 'idea',      label: 'Idea',       emoji: '💡' },
  { key: 'important', label: 'Important',  emoji: '⚠️' },
  { key: 'todo',      label: 'To-Do',      emoji: '✅' },
];

// ─── Balance helpers (handle both old and new backend formats) ────────────────

/** Enrich a flat debt array — fills in missing fromName/toName from members list */
function normalizeDebtArray(
  debts: any[],
  currentUid: string,
  membersList: { userId: string; fullName: string }[],
): { from: string; to: string; fromName: string; toName: string; amount: number }[] {
  return (debts ?? []).map((d: any) => ({
    from: d.from,
    to: d.to,
    fromName: d.fromName || (d.from === currentUid ? 'You' : (membersList.find(m => m.userId === d.from)?.fullName || 'Member')),
    toName:   d.toName   || (d.to   === currentUid ? 'You' : (membersList.find(m => m.userId === d.to)?.fullName   || 'Member')),
    amount: typeof d.amount === 'number' ? d.amount : parseFloat(d.amount ?? '0'),
  }));
}

/**
 * Parse getBalances response — handles both backend formats:
 * - NEW: { debts: [{from,to,fromName,toName,amount}], myBalance, totalExpenses }
 * - OLD: { summary: {netBalance, yoursTotal}, outstanding: [{userId,name,amount,direction}] }
 */
function parseBalanceResponse(
  balRes: any,
  currentUid: string,
  membersList: { userId: string; fullName: string }[],
) {
  if (Array.isArray(balRes?.debts)) {
    // New format
    return {
      debts: normalizeDebtArray(balRes.debts, currentUid, membersList),
      myBalance: typeof balRes.myBalance === 'number' ? balRes.myBalance : 0,
      totalExpenses: balRes.totalExpenses ?? '0',
    };
  }
  // Old format
  const debts = (balRes?.outstanding ?? []).map((o: any) => {
    const otherId = o.userId;
    const otherName = o.name || membersList.find(m => m.userId === otherId)?.fullName || 'Member';
    const youOwe = o.direction === 'you_owe';
    return {
      from: youOwe ? currentUid : otherId,
      to:   youOwe ? otherId : currentUid,
      fromName: youOwe ? 'You' : otherName,
      toName:   youOwe ? otherName : 'You',
      amount: typeof o.amount === 'number' ? o.amount : parseFloat(o.amount ?? '0'),
    };
  });
  return {
    debts,
    myBalance: typeof balRes?.summary?.netBalance === 'number' ? balRes.summary.netBalance : 0,
    totalExpenses: String(balRes?.summary?.yoursTotal ?? 0),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntilISO(iso: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(iso).getTime() - today.getTime()) / 86400000);
}
function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}
function parseActivityTime(t: any): { hour: string; minute: string } {
  if (!t) return { hour: '', minute: '' };
  if (typeof t === 'object' && t !== null) {
    return { hour: String(t.hour ?? ''), minute: String(t.minute ?? '').padStart(2, '0') };
  }
  const parts = String(t).split(':');
  return { hour: parts[0] ?? '', minute: parts[1] ?? '00' };
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const BackIcon = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path d="M19 12H5M12 19l-7-7 7-7" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
const PencilIcon = () => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
    <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
const ChevDown = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path d="M6 9l6 6 6-6" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
const ChevUp = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path d="M18 15l-6-6-6 6" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
const CloseX = ({ color = '#64748b' }) => (
  <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
    <Path d="M18 6L6 18M6 6l12 12" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
const TrashIcon = ({ color = '#ef4444' }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
const CheckIcon = () => (
  <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
    <Path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
const SparkleIcon = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <Path d="M9.937 15.5A2 2 0 008.5 14.063l-6.135-1.582a.5.5 0 010-.962L8.5 9.937A2 2 0 009.937 8.5l1.582-6.135a.5.5 0 01.963 0L14.063 8.5A2 2 0 0015.5 9.937l6.135 1.582a.5.5 0 010 .963L15.5 14.063A2 2 0 0014.063 15.5l-1.582 6.135a.5.5 0 01-.963 0z" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

function ActionIcon({ path, color }: { path: string; color: string }) {
  const s = { width: 22, height: 22 };
  switch (path) {
    case 'plus':    return <Svg {...s} viewBox="0 0 24 24" fill="none"><Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'docs':    return <Svg {...s} viewBox="0 0 24 24" fill="none"><Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /><Path d="M14 2v6h6M16 13H8M16 17H8" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'members': return <Svg {...s} viewBox="0 0 24 24" fill="none"><Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /><Path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'photos':  return <Svg {...s} viewBox="0 0 24 24" fill="none"><Rect x={3} y={3} width={18} height={18} rx={2} ry={2} stroke={color} strokeWidth={2} /><Circle cx={8.5} cy={8.5} r={1.5} fill={color} /><Path d="M21 15l-5-5L5 21" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'expenses':return <Svg {...s} viewBox="0 0 24 24" fill="none"><Path d="M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'polls':   return <Svg {...s} viewBox="0 0 24 24" fill="none"><Path d="M18 20V10M12 20V4M6 20v-6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'notes':   return <Svg {...s} viewBox="0 0 24 24" fill="none"><Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    default: return null;
  }
}

// ─── Swee FAB ─────────────────────────────────────────────────────────────────

function SweeFab({ onPress }: { onPress: () => void }) {
  const pan = useRef(new Animated.ValueXY()).current;
  const moved = useRef(false);
  const pr = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value }); pan.setValue({ x: 0, y: 0 }); moved.current = false; },
    onPanResponderMove: (_, g) => { if (Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4) moved.current = true; Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false })(_, g); },
    onPanResponderRelease: () => { pan.flattenOffset(); if (!moved.current) onPress(); },
  })).current;
  return (
    <Animated.View style={[styles.sweeFab, { transform: pan.getTranslateTransform() }]} {...pr.panHandlers}>
      <SparkleIcon />
    </Animated.View>
  );
}

// ─── Dialog Header ────────────────────────────────────────────────────────────

function DHeader({ title, subtitle, onClose }: { title: string; subtitle?: string; onClose: () => void }) {
  return (
    <View style={styles.dHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.dTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.dSubtitle}>{subtitle}</Text>}
      </View>
      <TouchableOpacity onPress={onClose} style={styles.dCloseBtn} activeOpacity={0.7}>
        <CloseX />
      </TouchableOpacity>
    </View>
  );
}

// ─── Tab Bar ─────────────────────────────────────────────────────────────────

function TabBar({ tabs, active, onSelect }: { tabs: string[]; active: string; onSelect: (t: string) => void }) {
  return (
    <View style={styles.tabBar}>
      {tabs.map(t => (
        <TouchableOpacity key={t} style={[styles.tab, active === t && styles.tabActive]} onPress={() => onSelect(t)} activeOpacity={0.8}>
          <Text style={[styles.tabTxt, active === t && styles.tabTxtActive]}>{t}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TripDetailScreen({ route, navigation }: any) {
  const [trip, setTrip] = useState(route?.params?.trip);
  const rawUser = useAuthStore(s => s.user) as any;
  const currentUserId: string = rawUser?.id ?? '';

  // ── API-driven state ──
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [members, setMembers] = useState<TripMember[]>([]);
  const [balances, setBalances] = useState<Debt[]>([]);
  const [myBalance, setMyBalance] = useState<number>(0);
  const [totalExpenses, setTotalExpenses] = useState<string>('0.00');
  const [apiStats, setApiStats] = useState<{ memberCount: number; docCount: number; photoVideoCount: number; totalExpenseAmount: number } | null>(null);

  // ── Loading / submitting flags ──
  const [, setIsLoadingInit] = useState(true);
  const [, setIsLoadingDocs] = useState(false);
  const [, setIsLoadingPhotos] = useState(false);
  const [, setIsLoadingExpenses] = useState(false);
  const [, setIsLoadingNotes] = useState(false);
  const [, setIsLoadingPolls] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Data state ──
  const [activities,    setActivities]   = useState<Activity[]>([]);
  const [docs,          setDocs]          = useState<DocItem[]>([]);
  const [photos,        setPhotos]        = useState<PhotoItem[]>([]);
  const [expenses,      setExpenses]      = useState<Expense[]>([]);
  const [polls,         setPolls]         = useState<Poll[]>([]);
  const [notes,         setNotes]         = useState<Note[]>([]);
  const [apiFriends,    setApiFriends]    = useState<{ id: string; name: string; avatarUrl: string | null }[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);

  const tripId: string = trip?.id ?? '';

  // ── Modal visibility ──
  const [showAddAct,   setShowAddAct]   = useState(false);
  const [showEditTrip, setShowEditTrip] = useState(false);
  const [showDocs,     setShowDocs]     = useState(false);
  const [showMembers,  setShowMembers]  = useState(false);
  const [showPhotos,   setShowPhotos]   = useState(false);
  const [showExpenses, setShowExpenses] = useState(false);
  const [showPolls,    setShowPolls]    = useState(false);
  const [showNotes,    setShowNotes]    = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<PhotoItem | null>(null);
  const [docPreviewUrl, setDocPreviewUrl] = useState<string | null>(null);
  const [actDateError, setActDateError] = useState<string>('');

  // ── Add Activity form ──
  const [actTitle,          setActTitle]          = useState('');
  const [actDate,           setActDate]           = useState<Date | undefined>(undefined);
  const [showActDatePicker, setShowActDatePicker] = useState(false);
  const [actHour,           setActHour]           = useState(''); // kept for edit-load compat
  const [actMin,            setActMin]            = useState(''); // kept for edit-load compat
  const [actLocation,       setActLocation]       = useState('');
  const [actDesc,           setActDesc]           = useState('');
  const [actTime,           setActTime]           = useState<Date | undefined>(undefined);
  const [showHourDrop,      setShowHourDrop]      = useState(false);
  const [showMinDrop,       setShowMinDrop]       = useState(false);
  const hourBtnRef = useRef<any>(null);
  const minBtnRef  = useRef<any>(null);
  const [hourDropPos, setHourDropPos] = useState({ x: 0, y: 0, w: 80 });
  const [minDropPos,  setMinDropPos]  = useState({ x: 0, y: 0, w: 80 });
  // ── Activity inline expense ──
  const [showActExp,        setShowActExp]        = useState(false);
  const [actExpDesc,        setActExpDesc]        = useState('');
  const [actExpAmount,      setActExpAmount]      = useState('');
  const [actExpCategory,    setActExpCategory]    = useState(EXPENSE_CATS[0]);
  const [actExpPaidBy,      setActExpPaidBy]      = useState('You');
  const [actExpSplitType,   setActExpSplitType]   = useState<'equally'|'amount'|'percent'>('equally');
  const [actExpSplitAmong,  setActExpSplitAmong]  = useState<string[]>(['You']);
  const [actExpSplitDetails, setActExpSplitDetails] = useState<{[k:string]:string}>({});
  const [showActExpCatDrop, setShowActExpCatDrop] = useState(false);
  const [showActExpPaidByDrop, setShowActExpPaidByDrop] = useState(false);
  const [actExpConfirmed, setActExpConfirmed] = useState(false);

  // ── Members modal ──
  const [memberTab,       setMemberTab]       = useState<'From Friends' | 'Invite New'>('From Friends');
  const [memberSearch,    setMemberSearch]    = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [inviteMethod,    setInviteMethod]    = useState<'email' | 'sms' | 'whatsapp'>('email');
  const [inviteInput,     setInviteInput]     = useState('');

  // ── Expenses modal ──
  const [expTab,              setExpTab]              = useState<'All Expenses' | 'Balances'>('All Expenses');
  const [showAddExpense,      setShowAddExpense]      = useState(false);
  const [expDesc,             setExpDesc]             = useState('');
  const [expAmount,           setExpAmount]           = useState('');
  const [expCategory,         setExpCategory]         = useState(EXPENSE_CATS[0]);
  const [expPaidBy,           setExpPaidBy]           = useState('You');
  const [expSplitType,        setExpSplitType]        = useState<'equally' | 'amount' | 'percent'>('equally');
  const [expSplitAmong,       setExpSplitAmong]       = useState<string[]>(['You']);
  const [expSplitDetails,     setExpSplitDetails]     = useState<{[k:string]:string}>({});
  const [showExpCatDrop,      setShowExpCatDrop]      = useState(false);
  const [showPaidByDrop,      setShowPaidByDrop]      = useState(false);

  // ── Polls modal ──
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions,  setPollOptions]  = useState<string[]>(['', '', '']);

  // ── Notes modal ──
  const [noteTitle,       setNoteTitle]       = useState('');
  const [noteBody,        setNoteBody]        = useState('');
  const [noteCategory,    setNoteCategory]    = useState<'general' | 'idea' | 'important' | 'todo'>('general');
  const [showNoteCatDrop, setShowNoteCatDrop] = useState(false);
  const [editingNoteId,   setEditingNoteId]   = useState<string | null>(null);
  const [expandedNoteId,  setExpandedNoteId]  = useState<string | null>(null);

  // ── Activity photos ──
  const [actPhotos, setActPhotos] = useState<string[]>([]);
  // ── Edit activity ──
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  // ── Edit expense ──
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  // ── Edit Trip form ──
  const [editName,           setEditName]           = useState('');
  const [editLocation,       setEditLocation]       = useState('');
  const [editStartDate,      setEditStartDate]      = useState<Date>(new Date());
  const [editEndDate,        setEditEndDate]        = useState<Date>(new Date());
  const [showStartPicker,    setShowStartPicker]    = useState(false);
  const [showEndPicker,      setShowEndPicker]      = useState(false);

  // ── Initial fetch: trip detail + members + activities ──
  useFocusEffect(useCallback(() => {
    if (!tripId) return;
    (async () => {
      try {
        const [detailRes, membersRes, activitiesRes, balRes] = await Promise.all([
          getTripDetail(tripId),
          getTripMembers(tripId),
          getActivities(tripId),
          getBalances(tripId),
        ]);
        const loc = detailRes.trip.location;
        const locStr = typeof loc === 'string' ? loc : (loc?.name ?? '');
        setTrip((prev: any) => ({ ...prev, ...detailRes.trip, location: locStr }));
        setRole(detailRes.role);
        if ((detailRes as any).stats) setApiStats((detailRes as any).stats);
        setMembers(membersRes.members);
        // Balance — handles both old and new backend formats
        const balParsed = parseBalanceResponse(balRes, currentUserId, membersRes.members);
        setBalances(balParsed.debts);
        setMyBalance(balParsed.myBalance);
        setTotalExpenses(balParsed.totalExpenses);
        const mapActivity = (a: any, completed: boolean) => {
          const { hour, minute } = parseActivityTime(a.time);
          return { id: a.id, title: a.title, date: a.date ?? '', hour, minute, location: a.location, description: a.description, completed, createdBy: a.createdBy, linkedExpense: a.linkedExpense ?? null };
        };
        setActivities([
          ...(activitiesRes.upcoming ?? []).map((a: any) => mapActivity(a, false)),
          ...(activitiesRes.completed ?? []).map((a: any) => mapActivity(a, true)),
        ]);
      } catch (err) {
        handleApiError(err);
      } finally {
        setIsLoadingInit(false);
      }
    })();
  }, [tripId]));

  // ── Load expenses + balances when expenses modal opens ──
  useEffect(() => {
    if (!showExpenses || !tripId) return;
    (async () => {
      setIsLoadingExpenses(true);
      try {
        const [expRes, balRes] = await Promise.all([
          getExpenses(tripId),
          getBalances(tripId),
        ]);
        const resolvePaidBy = (paidByRaw: any): string => {
          const uid = typeof paidByRaw === 'object' && paidByRaw !== null
            ? (paidByRaw.userId ?? paidByRaw.id ?? '')
            : String(paidByRaw ?? '');
          if (uid === currentUserId) return 'You';
          const member = members.find(m => m.userId === uid);
          if (member) return member.fullName;
          // fallback: if object had a name directly
          if (typeof paidByRaw === 'object' && paidByRaw !== null)
            return (paidByRaw.name ?? paidByRaw.fullName ?? uid) || 'Unknown';
          return uid || 'Unknown';
        };
        setExpenses((expRes.expenses ?? []).map(e => {
          const paidByStr = resolvePaidBy(e.paidBy);
          const mySplit = (e.splits ?? []).find((s: any) => s.userId === currentUserId);
          const myAmount = mySplit ? parseFloat(mySplit.amount ?? '0') : 0;
          return {
            id: e.id,
            description: e.description,
            amount: parseFloat(e.amount),
            category: e.category ?? 'general',
            paidBy: paidByStr,
            splitType: e.splitType === 'equal' ? 'equally' : e.splitType === 'percentage' ? 'percent' : 'amount',
            splitAmong: (e.splits ?? []).map((s: any) => s.userId),
            date: new Date(e.createdAt).toLocaleDateString('default', { day: 'numeric', month: 'short' }),
            createdBy: paidByStr,
            activityId: (e as any).activityId ?? null,
            myAmount,
          };
        }));
        const { debts: parsedDebts, myBalance: parsedBal, totalExpenses: parsedTotal } = parseBalanceResponse(balRes, currentUserId, members);
        setBalances(parsedDebts);
        setMyBalance(parsedBal);
        setTotalExpenses(parsedTotal);
      } catch (err) {
        handleApiError(err);
      } finally {
        setIsLoadingExpenses(false);
      }
    })();
  }, [showExpenses, tripId]);

  // ── Load docs when docs modal opens ──
  useEffect(() => {
    if (!showDocs || !tripId) return;
    (async () => {
      setIsLoadingDocs(true);
      try {
        const res = await getDocs(tripId);
        setDocs(res.docs.map(d => ({ id: d.id, name: d.fileName, uri: (d as any).downloadUrl ?? d.fileUrl ?? '', uploadedBy: d.uploadedBy, mimeType: d.mimeType })));
      } catch (err) {
        handleApiError(err);
      } finally {
        setIsLoadingDocs(false);
      }
    })();
  }, [showDocs, tripId]);

  // ── Load photos when photos modal opens ──
  useEffect(() => {
    if (!showPhotos || !tripId) return;
    (async () => {
      setIsLoadingPhotos(true);
      try {
        const res = await getTripPhotos(tripId);
        setPhotos(prev => {
          // Preserve any localUri we already have for photos in this session
          const cache: Record<string, string> = {};
          prev.forEach(p => { if (p.localUri) cache[p.id] = p.localUri; });
          return res.photos.map(p => ({
            id: p.id,
            uri: p.url ?? p.fileUrl ?? '',
            localUri: cache[p.id],   // prefer local for display; used as fallback when CDN fails
            name: p.id,
            uploadedBy: p.uploadedBy,
            activityId: p.activityId ?? null,
            activityTitle: p.activityTitle ?? null,
          }));
        });
      } catch (err) {
        handleApiError(err);
      } finally {
        setIsLoadingPhotos(false);
      }
    })();
  }, [showPhotos, tripId]);

  // ── Load notes when notes modal opens ──
  useEffect(() => {
    if (!showNotes || !tripId) return;
    (async () => {
      setIsLoadingNotes(true);
      try {
        const res = await getNotes(tripId);
        setNotes(res.notes.map(n => ({
          id: n.id,
          title: n.title,
          body: n.content,
          category: (n.category ?? 'general') as Note['category'],
          date: new Date(n.createdAt).toLocaleDateString('default', { day: 'numeric', month: 'short' }),
          pinned: (n as any).isFavorited ?? (n as any).isFavorite ?? (n as any).pinned ?? false,
          createdBy: n.createdBy,
        })));
      } catch (err) {
        handleApiError(err);
      } finally {
        setIsLoadingNotes(false);
      }
    })();
  }, [showNotes, tripId]);

  // ── Load polls when polls modal opens ──
  useEffect(() => {
    if (!showPolls || !tripId) return;
    (async () => {
      setIsLoadingPolls(true);
      try {
        const res = await getPolls(tripId);
        setPolls(res.polls.map(p => ({
          id: p.id,
          question: p.question,
          options: p.options.map(o => ({ id: o.id, text: o.text, voteCount: o.voteCount ?? 0, votedByMe: o.votedByMe ?? false })),
          myVoteOptionId: p.myVoteOptionId ?? null,
          createdBy: p.createdBy,
        })));
      } catch (err) {
        handleApiError(err);
      } finally {
        setIsLoadingPolls(false);
      }
    })();
  }, [showPolls, tripId]);

  // ── Load members + friends when members modal opens ──
  useEffect(() => {
    if (!showMembers || !tripId) return;
    getTripMembers(tripId).then(res => setMembers(res.members)).catch(handleApiError);
    getFriends().then(res => setApiFriends(res.friends.map(f => ({ id: f.user.id, name: f.user.name, avatarUrl: f.user.avatarUrl })))).catch(() => {});
  }, [showMembers, tripId]);

  // ── Derived ──
  const days        = trip?.startDateISO ? daysUntilISO(trip.startDateISO) : 0;
  const _today = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
  const upcomingActs = activities.filter((a: any) => {
    if (a.completed) return false;
    if (!a.date) return true;
    const ad = new Date(a.date); ad.setHours(0,0,0,0);
    return ad.getTime() >= _today;
  });
  const completed = activities.filter((a: any) => {
    if (a.completed) return true;
    if (!a.date) return false;
    const ad = new Date(a.date); ad.setHours(0,0,0,0);
    return ad.getTime() < _today;
  });
  const totalExp    = expenses.reduce((s, e) => s + e.amount, 0);
  const memberCount = members.length;
  const noteCatDisplay = NOTE_CATS.find(c => c.key === noteCategory)!;
  const memberIds = new Set(members.map(m => m.userId));
  const filteredFriends = apiFriends
    .filter(f => !memberIds.has(f.id) && f.name.toLowerCase().includes(memberSearch.toLowerCase()))
    .map(f => ({ id: f.id, name: f.name, avatar: f.avatarUrl ?? `https://i.pravatar.cc/150?u=${f.id}` }));

  // ── Handlers ──
  function resetActForm() {
    setActTitle(''); setActDate(undefined); setActHour(''); setActMin(''); setActTime(undefined); setShowHourDrop(false); setShowMinDrop(false);
    setActLocation(''); setActDesc(''); setShowActExp(false); setActPhotos([]);
    setActExpDesc(''); setActExpAmount(''); setActExpCategory(EXPENSE_CATS[0]);
    setActExpPaidBy('You'); setActExpSplitType('equally'); setActExpSplitAmong(['You']);
    setActExpSplitDetails({}); setActExpConfirmed(false);
    setEditingActivityId(null);
  }

  // ── Activity handlers (API-backed) ──

  async function handleAddActivity() {
    if (!actTitle.trim()) { Alert.alert('Error', 'Please enter a title'); return; }
    if (isSubmitting) return;
    // Validate activity date is within trip date range
    if (actDate) {
      const tripStart = trip?.startDateISO ? new Date(trip.startDateISO) : null;
      const tripEnd   = trip?.endDateISO   ? new Date(trip.endDateISO)   : null;
      const actD = new Date(actDate.toISOString().split('T')[0]);
      if (tripStart) tripStart.setHours(0,0,0,0);
      if (tripEnd)   tripEnd.setHours(23,59,59,999);
      if ((tripStart && actD < tripStart) || (tripEnd && actD > tripEnd)) {
        setActDateError(`Date must be between ${trip?.startDate ?? ''} and ${trip?.endDate ?? ''}`);
        return;
      }
    }
    setActDateError('');
    setIsSubmitting(true);
    try {
      const timeHr = actTime ? actTime.getHours() : (actHour !== '' ? parseInt(actHour, 10) : null);
      const timeMin = actTime ? actTime.getMinutes() : (actMin !== '' ? parseInt(actMin, 10) : null);
      const timeStr: { hour: number; minute: number } | undefined =
        (timeHr !== null && !isNaN(timeHr) && timeMin !== null && !isNaN(timeMin))
          ? { hour: timeHr, minute: timeMin }
          : undefined;
      const dateStr = actDate ? actDate.toISOString().split('T')[0] : undefined;

      // If an expense was staged, create it first then link to activity
      let linkedExpenseId: string | undefined;
      if (actExpConfirmed && actExpDesc.trim() && actExpAmount) {
        const catMap: Record<string, string> = {
          'General': 'general', 'Food & Dining': 'food', 'Transport': 'transportation',
          'Stay': 'accommodation', 'Entertainment': 'entertainment', 'Shopping': 'shopping', 'Other': 'other',
        };
        const apiSplitType = actExpSplitType === 'equally' ? 'equal' : actExpSplitType === 'percent' ? 'percentage' : 'amount';
        const expAmount = parseFloat(actExpAmount) || 0;
        const payerId = actExpPaidBy === 'You' ? currentUserId : (members.find(m => m.fullName === actExpPaidBy)?.userId ?? currentUserId);
        const memberIdsForSplit = actExpSplitAmong.map(id => id === 'You' ? currentUserId : id).filter(Boolean);
        const splitAmong = apiSplitType === 'equal'
          ? memberIdsForSplit.map(id => ({ userId: id }))
          : memberIdsForSplit.map(id => {
              const detailKey = id === currentUserId ? 'You' : id;
              return {
                userId: id,
                ...(apiSplitType === 'amount'
                  ? { amount: parseFloat(actExpSplitDetails[detailKey] || '0') }
                  : { percentage: parseFloat(actExpSplitDetails[detailKey] || '0') }),
              };
            });
        const expRes = await createExpense(tripId, {
          description: actExpDesc.trim(),
          amount: expAmount,
          category: catMap[actExpCategory.label] ?? 'general',
          paidBy: payerId,
          splitType: apiSplitType as 'equal' | 'amount' | 'percentage',
          splitAmong: splitAmong.length ? splitAmong : [{ userId: currentUserId }],
        });
        linkedExpenseId = expRes.expense.id;
        // Sync to expenses list so main expense management reflects it
        const exp = expRes.expense;
        const d = new Date(exp.createdAt);
        const uid572 = typeof exp.paidBy === 'object' && exp.paidBy !== null ? (exp.paidBy as any).userId ?? (exp.paidBy as any).id ?? '' : String(exp.paidBy ?? '');
        const paidByStr = uid572 === currentUserId ? 'You' : ((members.find(m => m.userId === uid572)?.fullName ?? (exp.paidBy as any)?.name ?? uid572) || 'Unknown');
        const mySplit572 = (exp.splits ?? []).find((s: any) => s.userId === currentUserId);
        setExpenses(prev => [...prev, {
          id: exp.id, description: exp.description, amount: parseFloat(String(exp.amount)),
          category: exp.category ?? 'general', paidBy: paidByStr,
          splitType: exp.splitType === 'equal' ? 'equally' : exp.splitType === 'percentage' ? 'percent' : 'amount',
          splitAmong: (exp.splits ?? []).map((s: any) => s.userId),
          date: `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`,
          createdBy: paidByStr,
          myAmount: mySplit572 ? parseFloat(mySplit572.amount ?? '0') : 0,
        }]);
        if (expRes.balances) setBalances(normalizeDebtArray(expRes.balances, currentUserId, members));
      }

      if (editingActivityId) {
        const res = await updateActivity(tripId, editingActivityId, {
          title: actTitle.trim(),
          description: actDesc || undefined,
          date: dateStr,
          time: timeStr,
          location: actLocation || undefined,
        });
        const { hour: updH, minute: updM } = parseActivityTime(res.activity.time);
        setActivities(p => p.map(a => a.id === editingActivityId ? {
          ...a,
          title: res.activity.title,
          date: res.activity.date ?? '',
          hour: updH,
          minute: updM,
          location: res.activity.location,
          description: res.activity.description,
        } : a));
      } else {
        const res = await createActivity(tripId, {
          title: actTitle.trim(),
          description: actDesc || undefined,
          date: dateStr,
          time: timeStr,
          location: actLocation || undefined,
          expenseId: linkedExpenseId,
        });
        const a = res.activity;
        const { hour: newH, minute: newM } = parseActivityTime(a.time);
        setActivities(p => [...p, {
          id: a.id,
          title: a.title,
          date: a.date ?? '',
          hour: newH,
          minute: newM,
          location: a.location,
          description: a.description,
          completed: false,
          createdBy: a.createdBy,
          linkedExpense: (a as any).linkedExpense ?? null,
        }]);
        if (actPhotos.length > 0) {
          const assets = actPhotos.map((uri, i) => ({ uri, name: `photo_${i}.jpg`, type: 'image/jpeg' }));
          const photoRes = await uploadActivityPhotos(tripId, a.id, assets).catch(() => null);
          if (photoRes?.photos?.length) {
            // Cache activity photos in state with localUri so they display correctly in the gallery
            const actPhotoItems: PhotoItem[] = (photoRes.photos as any[]).map((ph, i) => ({
              id: ph.id,
              uri: ph.url ?? ph.fileUrl ?? assets[i]?.uri ?? '',
              localUri: assets[i]?.uri,
              name: ph.id,
              uploadedBy: ph.uploadedBy ?? currentUserId,
              activityId: a.id,
              activityTitle: a.title,
            }));
            setPhotos(p => {
              const without = p.filter(e => !actPhotoItems.find(n => n.id === e.id));
              return [...without, ...actPhotoItems];
            });
          }
        }
      }
      resetActForm();
      setShowAddAct(false);
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEditActivity(act: Activity) {
    setActTitle(act.title);
    setActDate(undefined);
    setActHour((act as any).hour ?? '');
    setActMin((act as any).minute ?? '');
    setActLocation(act.location || '');
    setActDesc(act.description || '');
    setEditingActivityId(act.id);
    setShowHourDrop(false); setShowMinDrop(false); setShowActExp(false);
    setShowAddAct(true);
  }

  async function handleDeleteActivity(actId: string) {
    Alert.alert('Delete', 'Remove this activity?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await deleteActivity(tripId, actId);
          setActivities(p => p.filter(a => a.id !== actId));
        } catch (err) { handleApiError(err); }
      }},
    ]);
  }

  // ── Photo handlers (API-backed) ──

  function handlePickPhoto(cam: boolean) {
    const fn = cam ? launchCamera : launchImageLibrary;
    fn({ mediaType: 'mixed' }, async res => {
      if (res.didCancel || res.errorCode) return;
      const assets = (res.assets || []).map(a => ({
        uri: a.uri ?? '',
        type: a.type ?? 'image/jpeg',
        name: a.fileName ?? 'photo.jpg',
      })).filter(a => a.uri);
      if (!assets.length) return;
      // Optimistic: add with local URIs immediately so thumbnails show right away
      const tempIds = assets.map((_, i) => `temp_${Date.now()}_${i}`);
      setPhotos(p => [...p, ...assets.map((a, i) => ({ id: tempIds[i], uri: a.uri, localUri: a.uri, name: a.name, uploadedBy: currentUserId, activityId: null, activityTitle: null }))]);
      try {
        const data = await uploadTripPhotos(tripId, assets);
        // Replace temp entries with real CDN-backed ones (keep localUri as fallback)
        setPhotos(p => {
          const withoutTemps = p.filter(ph => !tempIds.includes(ph.id));
          const newPhotos = data.photos.map((ph, i) => ({
            id: ph.id,
            uri: ph.url ?? ph.fileUrl ?? assets[i]?.uri ?? '',
            localUri: assets[i]?.uri,
            name: ph.id,
            uploadedBy: ph.uploadedBy,
            activityId: null,
            activityTitle: null,
          }));
          return [...withoutTemps, ...newPhotos];
        });
      } catch (err) {
        // Remove optimistic entries on failure
        setPhotos(p => p.filter(ph => !tempIds.includes(ph.id)));
        handleApiError(err);
      }
    });
  }

  async function handleDeletePhoto(photoId: string, uploadedBy: string) {
    if (role !== 'admin' && uploadedBy !== currentUserId) {
      Toast.show({ type: 'error', text1: 'Permission Denied', text2: 'You can only delete your own photos.' });
      return;
    }
    try {
      await deleteTripPhoto(tripId, photoId);
      setPhotos(p => p.filter(ph => ph.id !== photoId));
    } catch (err) { handleApiError(err); }
  }

  // ── Doc handlers (API-backed) ──

  async function handleUploadDoc() {
    try {
      const FilePicker = NativeModules.FilePicker;
      if (!FilePicker) {
        Toast.show({ type: 'error', text1: 'Not Available', text2: 'File picker requires a fresh build.' });
        return;
      }
      const file: { uri: string; name: string; type: string } = await FilePicker.pick();
      if (!file?.uri) return;
      const data = await uploadDoc(tripId, { uri: file.uri, type: file.type ?? 'application/octet-stream', name: file.name ?? 'document' });
      setDocs(p => [...p, { id: data.doc.id, name: data.doc.fileName, uri: (data.doc as any).downloadUrl ?? data.doc.fileUrl ?? '', uploadedBy: data.doc.uploadedBy, mimeType: data.doc.mimeType }]);
    } catch (err: any) {
      if (err?.code === 'CANCELLED' || err?.message === 'User cancelled') return;
      handleApiError(err);
    }
  }

  async function handleDeleteDoc(docId: string, uploadedBy: string) {
    if (role !== 'admin' && uploadedBy !== currentUserId) {
      Toast.show({ type: 'error', text1: 'Permission Denied', text2: 'You can only delete your own documents.' });
      return;
    }
    try {
      await deleteDoc(tripId, docId);
      setDocs(p => p.filter(d => d.id !== docId));
    } catch (err) { handleApiError(err); }
  }

  // ── Expense handlers (API-backed) ──

  async function handleAddExpense() {
    if (!expDesc.trim() || !expAmount) { Alert.alert('Error', 'Please fill description and amount'); return; }
    if (isSubmitting) return;

    const amount = parseFloat(expAmount) || 0;
    // Build splitAmong — map 'You' → currentUserId, use only selected members
    const apiSplitType = expSplitType === 'equally' ? 'equal' : expSplitType === 'percent' ? 'percentage' : 'amount';
    const memberIds = expSplitAmong.map(id => id === 'You' ? currentUserId : id).filter(Boolean);
    const splitAmong = apiSplitType === 'equal'
      ? memberIds.map(id => ({ userId: id }))
      : memberIds.map(id => ({
          userId: id,
          ...(apiSplitType === 'amount' ? { amount: amount / Math.max(memberIds.length, 1) } : { percentage: 100 / Math.max(memberIds.length, 1) }),
        }));

    // Validation
    if (apiSplitType === 'amount') {
      const sum = (splitAmong as any[]).reduce((s: number, x: any) => s + (x.amount ?? 0), 0);
      if (Math.abs(sum - amount) > 0.01) {
        Alert.alert('Validation Error', 'Split amounts must sum to the total expense amount.');
        return;
      }
    }
    if (apiSplitType === 'percentage') {
      const sum = (splitAmong as any[]).reduce((s: number, x: any) => s + (x.percentage ?? 0), 0);
      if (Math.abs(sum - 100) > 0.01) {
        Alert.alert('Validation Error', 'Percentages must sum to 100.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const catMap: Record<string, string> = {
        'General': 'general', 'Food & Dining': 'food', 'Transport': 'transportation',
        'Stay': 'accommodation', 'Entertainment': 'entertainment', 'Shopping': 'shopping', 'Other': 'other',
      };
      const payerId = expPaidBy === 'You' ? currentUserId : (members.find(m => (m.fullName || (m as any).name) === expPaidBy)?.userId ?? currentUserId);
      const body = {
        description: expDesc.trim(),
        amount,
        category: catMap[expCategory.label] ?? 'general',
        paidBy: payerId,
        splitType: apiSplitType as 'equal' | 'amount' | 'percentage',
        splitAmong: splitAmong.length ? splitAmong : [{ userId: currentUserId }],
      };

      let res: any;
      if (editingExpenseId) {
        res = await updateExpense(tripId, editingExpenseId, body);
        setExpenses(p => p.map(e => e.id === editingExpenseId ? {
          ...e, description: res.expense.description,
          amount: parseFloat(res.expense.amount),
          category: res.expense.category ?? e.category,
        } : e));
        setEditingExpenseId(null);
      } else {
        res = await createExpense(tripId, body);
        const exp = res.expense;
        const d = new Date(exp.createdAt);
        const uid817 = typeof exp.paidBy === 'object' && exp.paidBy !== null ? (exp.paidBy as any).userId ?? (exp.paidBy as any).id ?? '' : String(exp.paidBy ?? '');
        const expPaidByStr = uid817 === currentUserId ? 'You' : ((members.find(m => m.userId === uid817)?.fullName ?? (exp.paidBy as any)?.name ?? uid817) || 'Unknown');
        const mySplit817 = (exp.splits ?? []).find((s: any) => s.userId === currentUserId);
        setExpenses(p => [...p, {
          id: exp.id, description: exp.description, amount: parseFloat(exp.amount),
          category: exp.category ?? 'general', paidBy: expPaidByStr,
          splitType: exp.splitType === 'equal' ? 'equally' : exp.splitType === 'percentage' ? 'percent' : 'amount',
          splitAmong: exp.splits.map((s: any) => s.userId),
          date: `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`,
          createdBy: expPaidByStr,
          myAmount: mySplit817 ? parseFloat(mySplit817.amount ?? '0') : 0,
        }]);
      }
      if (res.balances) {
        setBalances(normalizeDebtArray(res.balances, currentUserId, members));
      }
      // Refresh myBalance after expense changes
      const balData = await getBalances(tripId);
      setMyBalance(balData.myBalance ?? 0);
      setTotalExpenses(balData.totalExpenses ?? '0');
      setExpDesc(''); setExpAmount(''); setExpCategory(EXPENSE_CATS[0]);
      setExpPaidBy('You'); setExpSplitType('equally'); setExpSplitAmong(['You']);
      setExpSplitDetails({}); setShowAddExpense(false);
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEditExpense(exp: Expense) {
    setExpDesc(exp.description);
    setExpAmount(String(exp.amount));
    setExpCategory(EXPENSE_CATS.find(c => c.label === exp.category) || EXPENSE_CATS[0]);
    setExpPaidBy(exp.paidBy);
    setExpSplitType(exp.splitType);
    setExpSplitAmong(exp.splitAmong);
    setEditingExpenseId(exp.id);
    setShowAddExpense(true);
  }

  async function handleDeleteExpense(eid: string, createdBy: string) {
    if (role !== 'admin' && createdBy !== currentUserId) {
      Toast.show({ type: 'error', text1: 'Permission Denied', text2: 'You can only delete your own expenses.' });
      return;
    }
    Alert.alert('Delete', 'Remove this expense?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const res = await deleteExpense(tripId, eid);
          setExpenses(p => p.filter(e => e.id !== eid));
          if (res.balances) setBalances(normalizeDebtArray(res.balances, currentUserId, members));
          // Refresh myBalance after deleting expense
          const balData = await getBalances(tripId);
          setMyBalance(balData.myBalance ?? 0);
          setTotalExpenses(balData.totalExpenses ?? '0');
        } catch (err) { handleApiError(err); }
      }},
    ]);
  }

  async function handleSettleDebt(withUserId: string, amount: number) {
    try {
      const res = await settleDebt(tripId, { withUserId, amount });
      setBalances(normalizeDebtArray(res.outstanding ?? [], currentUserId, members));
      Toast.show({ type: 'success', text1: 'Settlement recorded!' });
    } catch (err) { handleApiError(err); }
  }

  // ── Poll handlers (API-backed) ──

  async function handleCreatePoll() {
    const valid = pollOptions.filter(o => o.trim());
    if (!pollQuestion.trim() || valid.length < 2) { Alert.alert('Error', 'Enter a question and at least 2 options'); return; }
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await createPoll(tripId, { question: pollQuestion.trim(), options: valid });
      const p = res.poll;
      setPolls(prev => [...prev, {
        id: p.id, question: p.question,
        options: p.options.map(o => ({ id: o.id, text: o.text, voteCount: o.voteCount ?? 0, votedByMe: o.votedByMe ?? false })),
        myVoteOptionId: p.myVoteOptionId ?? null,
        createdBy: p.createdBy,
      }]);
      setPollQuestion(''); setPollOptions(['', '', '']);
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVote(pollId: string, optionId: string) {
    try {
      const res = await voteOnPoll(tripId, pollId, optionId);
      setPolls(prev => prev.map(p => p.id === pollId ? {
        ...p,
        options: res.poll.options.map(o => ({ id: o.id, text: o.text, voteCount: o.voteCount ?? 0, votedByMe: o.votedByMe ?? false })),
        myVoteOptionId: res.poll.myVoteOptionId ?? null,
      } : p));
    } catch (err) { handleApiError(err); }
  }

  // ── Note handlers (API-backed) ──

  async function handleAddNote() {
    if (!noteTitle.trim()) { Alert.alert('Error', 'Please enter a title'); return; }
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (editingNoteId) {
        const res = await updateNote(tripId, editingNoteId, {
          title: noteTitle.trim(),
          content: noteBody,
          category: noteCategory,
        });
        setNotes(p => p.map(n => n.id === editingNoteId ? {
          ...n, title: res.note.title, body: res.note.content, category: res.note.category ?? noteCategory,
        } : n));
        setEditingNoteId(null);
      } else {
        const res = await createNote(tripId, {
          title: noteTitle.trim(),
          content: noteBody,
          category: noteCategory,
        });
        const n = res.note;
        const d = new Date(n.createdAt);
        setNotes(p => [...p, {
          id: n.id, title: n.title, body: n.content,
          category: (n.category ?? 'general') as Note['category'],
          date: `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`,
          pinned: false, createdBy: n.createdBy,
        }]);
      }
      setNoteTitle(''); setNoteBody(''); setNoteCategory('general');
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteNote(noteId: string) {
    try {
      await deleteNote(tripId, noteId);
      setNotes(p => p.filter(n => n.id !== noteId));
    } catch (err) { handleApiError(err); }
  }

  function startEditNote(note: Note) {
    setNoteTitle(note.title);
    setNoteBody(note.body);
    setNoteCategory(note.category);
    setEditingNoteId(note.id);
    setShowNoteCatDrop(false);
  }

  function openEditTrip() {
    setEditName(trip?.name || '');
    const rawLoc = trip?.location;
    setEditLocation(typeof rawLoc === 'string' ? rawLoc : (rawLoc?.name ?? ''));
    // Use ISO dates from trip (startDateISO / endDateISO) to build a real Date object
    const parseISO = (iso: string) => {
      if (!iso) return new Date();
      const clean = iso.includes('T') ? iso.split('T')[0] : iso;
      const [y, m, d] = clean.split('-').map(Number);
      return new Date(y, m - 1, d);
    };
    setEditStartDate(parseISO(trip?.startDateISO || trip?.startDate || ''));
    setEditEndDate(parseISO(trip?.endDateISO || trip?.endDate || ''));
    setShowEditTrip(true);
  }

  function toISODate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  async function handleSaveTrip() {
    if (!editName.trim()) { Alert.alert('Error', 'Trip name is required'); return; }
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await apiUpdateTrip(tripId, {
        name: editName.trim(),
        location: editLocation ? { name: editLocation } : undefined,
        startDate: toISODate(editStartDate),
        endDate: toISODate(editEndDate),
      });
      // Refresh local trip state so header/UI reflects changes immediately
      setTrip((prev: any) => ({
        ...prev,
        name: editName.trim(),
        location: editLocation,
        startDateISO: toISODate(editStartDate),
        endDateISO: toISODate(editEndDate),
        startDate: editStartDate.toLocaleString('default', { month: 'short', day: 'numeric' }),
        endDate: editEndDate.toLocaleString('default', { month: 'short', day: 'numeric' }),
      }));
      setShowEditTrip(false);
      Toast.show({ type: 'success', text1: 'Trip updated!' });
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleInviteMembers() {
    const emailsToInvite = inviteInput.trim() ? [inviteInput.trim()] : [];
    const friendsToAdd = selectedFriends.length ? selectedFriends : [];
    if (!emailsToInvite.length && !friendsToAdd.length) {
      Alert.alert('Error', 'Select friends or enter an email to invite');
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await inviteToTrip(tripId, {
        friendIds: friendsToAdd.length ? friendsToAdd : undefined,
        emails: emailsToInvite.length ? emailsToInvite : undefined,
      });
      const addedCount = res.added?.length ?? 0;
      const invitedCount = res.invited?.length ?? 0;
      Toast.show({ type: 'success', text1: `${addedCount} added, ${invitedCount} invite(s) sent` });
      if (res.invited?.length) {
        const url = res.invited[0].branchUrl;
        Alert.alert('Invite Link', `Share this link:\n${url}`);
      }
      // Refresh members list
      const membersRes = await getTripMembers(tripId);
      setMembers(membersRes.members);
      setInviteInput(''); setSelectedFriends([]);
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <BlobBackground>
    <SafeAreaView style={styles.container}>

      {/* Top back row */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <BackIcon />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ── Header Card ── */}
        <SharedDetailHeroCard
          name={trip?.name ?? 'Trip'}
          dateLine={`${trip?.startDate ?? ''}${trip?.endDate ? ` - ${trip.endDate}` : ''}`}
          location={typeof trip?.location === 'string' ? trip.location : trip?.location?.name ?? ''}
          dayCount={Math.abs(days)}
          dayLabel={days > 0 ? 'Days to go' : days === 0 ? 'Today!' : 'Days ago'}
          memberCount={memberCount}
          docCount={docs.length > 0 ? docs.length : (apiStats?.docCount ?? 0)}
          photoCount={photos.length > 0 ? photos.length : (apiStats?.photoVideoCount ?? 0)}
          totalExpenses={totalExp > 0 ? totalExp : (apiStats?.totalExpenseAmount ?? 0)}
          onEdit={openEditTrip}
        />
        {role === 'admin' && (
          <TouchableOpacity
            onPress={() => Alert.alert('Delete Trip', 'This will permanently delete the trip and all its data.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: async () => {
                try { await apiDeleteTrip(tripId); navigation.goBack(); }
                catch (err) { handleApiError(err); }
              }},
            ])}
            style={{ alignSelf: 'flex-end', marginRight: 16, marginBottom: 4, marginTop: -2 }}
            activeOpacity={0.7}>
            <Text style={{ fontSize: 11, color: '#ef4444', fontWeight: '600' }}>Delete Trip</Text>
          </TouchableOpacity>
        )}

        {/* ── Action Buttons ── */}
        <View style={styles.actionsWrap}>
          <View style={styles.actionsRow}>
            {[
              { label: 'Add\nActivity', bg: '#ccfbf1', ic: '#0f766e', p: 'plus',     fn: () => setShowAddAct(true) },
              { label: 'Docs',         bg: '#cffafe', ic: '#0e7490', p: 'docs',     fn: () => setShowDocs(true) },
              { label: 'Members',      bg: '#ede9fe', ic: '#6d28d9', p: 'members',  fn: () => setShowMembers(true) },
              { label: 'Photos',       bg: '#ffe4e6', ic: '#be123c', p: 'photos',   fn: () => setShowPhotos(true) },
            ].map(btn => (
              <TouchableOpacity key={btn.p} style={styles.actionBtn} onPress={btn.fn} activeOpacity={0.8}>
                <View style={[styles.actionCircle, { backgroundColor: btn.bg }]}><ActionIcon path={btn.p} color={btn.ic} /></View>
                <Text style={styles.actionLabel}>{btn.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.actionsRow}>
            {[
              { label: 'Expenses', bg: '#ffedd5', ic: '#c2410c', p: 'expenses', fn: () => setShowExpenses(true) },
              { label: 'Polls',    bg: '#e0e7ff', ic: '#4338ca', p: 'polls',    fn: () => setShowPolls(true) },
              { label: 'Notes',    bg: '#d1fae5', ic: '#065f46', p: 'notes',    fn: () => setShowNotes(true) },
            ].map(btn => (
              <TouchableOpacity key={btn.p} style={styles.actionBtn} onPress={btn.fn} activeOpacity={0.8}>
                <View style={[styles.actionCircle, { backgroundColor: btn.bg }]}><ActionIcon path={btn.p} color={btn.ic} /></View>
                <Text style={styles.actionLabel}>{btn.label}</Text>
              </TouchableOpacity>
            ))}
            {/* Invisible spacer to keep alignment under first row */}
            <View style={[styles.actionBtn, { opacity: 0 }]} pointerEvents="none" />
          </View>
        </View>

        {/* ── Upcoming Activities ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Activities</Text>
          {upcomingActs.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No upcoming activities</Text>
              <Text style={styles.emptySub}>Tap "Add Activity" to create your first activity</Text>
            </View>
          ) : (() => {
            // Group by date
            const groups = new Map<string, Activity[]>();
            upcomingActs.forEach(a => {
              const key = a.date || '__nodate__';
              if (!groups.has(key)) groups.set(key, []);
              groups.get(key)!.push(a);
            });
            const fmtActDate = (iso: string) => {
              if (!iso) return 'No Date';
              const d = new Date(iso);
              return d.toLocaleDateString('default', { weekday: 'short', day: 'numeric', month: 'short' });
            };
            return (
              <View>
                {Array.from(groups.entries()).map(([dateKey, acts]) => (
                  <View key={dateKey}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#0d9488', marginTop: 10, marginBottom: 4 }}>
                      {fmtActDate(dateKey === '__nodate__' ? '' : dateKey)}
                    </Text>
                    {acts.map(act => (
                      <View key={act.id} style={styles.actRow}>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          {!!act.hour && (
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748b', minWidth: 40 }}>
                              {String(act.hour).padStart(2,'0')}:{(act.minute || '00').padStart(2,'0')}
                            </Text>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={styles.actTitle}>{act.title}</Text>
                            {!!act.location && <Text style={styles.actMeta}>{act.location}</Text>}
                          </View>
                        </View>
                        <TouchableOpacity onPress={() => startEditActivity(act)} style={[styles.doneBtn, { marginLeft: 4 }]} activeOpacity={0.7}>
                          <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                            <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                            <Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                          </Svg>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={async () => {
                          setActivities(p => p.map(a => a.id === act.id ? { ...a, completed: true } : a));
                          try { await updateActivity(tripId, act.id, { isCompleted: true }); } catch { /* local state already updated */ }
                        }} style={styles.doneBtn} activeOpacity={0.7}>
                          <Text style={styles.doneTxt}>Done</Text>
                        </TouchableOpacity>
                        {(role === 'admin' || (act as any).createdBy === currentUserId) && (
                          <TouchableOpacity onPress={() => handleDeleteActivity(act.id)} style={styles.trashBtn} activeOpacity={0.7}>
                            <TrashIcon />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            );
          })()}
        </View>

        {/* ── Completed Activities ── */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.sectionHeaderRow} onPress={() => setShowCompleted(p => !p)} activeOpacity={0.7}>
            <Text style={styles.sectionTitleDark}>Completed Activities</Text>
            {showCompleted ? <ChevUp /> : <ChevDown />}
          </TouchableOpacity>
          {showCompleted && (
            completed.length === 0
              ? <View style={styles.emptyBox}><Text style={styles.emptyTitle}>No completed activities yet</Text></View>
              : completed.map(act => (
                <View key={act.id} style={[styles.actRow, { opacity: 0.55 }]}>
                  <Text style={[styles.actTitle, { flex: 1, textDecorationLine: 'line-through' }]}>{act.title}</Text>
                </View>
              ))
          )}
        </View>

      </ScrollView>

      <SweeFab onPress={() => navigation.navigate('ChatDetail', { chat: { id: 'swee', name: 'Swee', isSwee: true, subtitle: 'Always active · AI Assistant', lastMessage: "Hi! I'm Swee.", time: 'Now', unread: 0 } })} />

      {/* ═══════════════════════════════════════════════════
          MODAL 1 — Add Activity
      ═══════════════════════════════════════════════════ */}
      <Modal visible={showAddAct} transparent animationType="fade" onRequestClose={() => { resetActForm(); setShowAddAct(false); }}>
        <View style={styles.overlay}>
          <View style={[styles.dialog, { maxHeight: '92%' }]}>
            <DHeader title="Add Activity" onClose={() => { resetActForm(); setShowAddAct(false); }} />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.dBody}>

                <Text style={styles.fLabel}>Title</Text>
                <TextInput style={styles.fInput} placeholder="e.g., Visit Eiffel Tower" placeholderTextColor="#94a3b8" value={actTitle} onChangeText={setActTitle} autoFocus />

                {/* Date + Time */}
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
                  <View style={{ flex: 3 }}>
                    <Text style={styles.fLabel}>Date</Text>
                    <TouchableOpacity style={styles.fInputTouch} onPress={() => setShowActDatePicker(true)} activeOpacity={0.8}>
                      <Text style={{ fontSize: 13, color: actDate ? '#0f172a' : '#94a3b8' }}>{actDate ? fmtDate(actDate) : 'Select date'}</Text>
                    </TouchableOpacity>
                    {showActDatePicker && (
                      <DateTimePicker value={actDate || new Date()} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(e: DateTimePickerEvent, d?: Date) => { if (Platform.OS === 'android') setShowActDatePicker(false); if (e.type === 'set' && d) { setActDate(d); setActDateError(''); } else if (e.type === 'dismissed') setShowActDatePicker(false); }} />
                    )}
                    {showActDatePicker && Platform.OS === 'ios' && (
                      <TouchableOpacity style={[styles.tealBtnFull, { marginTop: 6 }]} onPress={() => setShowActDatePicker(false)}><Text style={styles.tealBtnTxt}>Done</Text></TouchableOpacity>
                    )}
                    {!!actDateError && <Text style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{actDateError}</Text>}
                  </View>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.fLabel}>Time</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      {/* Hour picker */}
                      <TouchableOpacity
                        ref={hourBtnRef}
                        style={[styles.fInputTouch, { flex: 1 }, showHourDrop && { borderColor: '#0d9488' }]}
                        onPress={() => {
                          (hourBtnRef.current as any)?.measureInWindow((x: number, y: number, w: number, h: number) => {
                            setHourDropPos({ x, y: y + h + 2, w });
                            setShowHourDrop(p => !p);
                            setShowMinDrop(false);
                          });
                        }}
                        activeOpacity={0.8}>
                        <Text style={{ fontSize: 13, color: actHour !== '' ? '#0f172a' : '#94a3b8', textAlign: 'center' }}>
                          {actHour !== '' ? String(actHour).padStart(2,'0') : 'HH'}
                        </Text>
                      </TouchableOpacity>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: '#94a3b8' }}>:</Text>
                      {/* Minute picker */}
                      <TouchableOpacity
                        ref={minBtnRef}
                        style={[styles.fInputTouch, { flex: 1 }, showMinDrop && { borderColor: '#0d9488' }]}
                        onPress={() => {
                          (minBtnRef.current as any)?.measureInWindow((x: number, y: number, w: number, h: number) => {
                            setMinDropPos({ x, y: y + h + 2, w });
                            setShowMinDrop(p => !p);
                            setShowHourDrop(false);
                          });
                        }}
                        activeOpacity={0.8}>
                        <Text style={{ fontSize: 13, color: actMin !== '' ? '#0f172a' : '#94a3b8', textAlign: 'center' }}>
                          {actMin !== '' ? String(actMin).padStart(2,'0') : 'MM'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                <Text style={styles.fLabel}>Location (Optional)</Text>
                <TextInput style={styles.fInput} placeholder="e.g., Champ de Mars, Paris" placeholderTextColor="#94a3b8" value={actLocation} onChangeText={setActLocation} />

                <Text style={styles.fLabel}>Description (Optional)</Text>
                <TextInput style={[styles.fInput, { height: 76, textAlignVertical: 'top', paddingTop: 10 }]} placeholder="Add any additional details..." placeholderTextColor="#94a3b8" value={actDesc} onChangeText={setActDesc} multiline />

                <View style={styles.actExtraRow}>
                  <Text style={styles.actExtraLabel}>Photos (Max 5)</Text>
                  {actPhotos.length < 5 && (
                    <TouchableOpacity onPress={() => {
                      launchImageLibrary({ mediaType: 'photo', selectionLimit: 5 - actPhotos.length }, res => {
                        if (res.didCancel || res.errorCode) return;
                        const uris = (res.assets || []).map(a => a.uri || '').filter(Boolean);
                        setActPhotos(p => [...p, ...uris].slice(0, 5));
                      });
                    }} activeOpacity={0.7}><Text style={styles.actExtraBtn}>+ Add Photos</Text></TouchableOpacity>
                  )}
                </View>
                {actPhotos.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {actPhotos.map((uri, i) => (
                      <View key={i} style={{ position: 'relative' }}>
                        <Image source={{ uri }} style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: '#e2e8f0' }} />
                        <TouchableOpacity
                          onPress={() => setActPhotos(p => p.filter((_, j) => j !== i))}
                          style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' }}
                          activeOpacity={0.7}>
                          <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
                <View style={styles.actExtraRow}>
                  <Text style={styles.actExtraLabel}>Expenses</Text>
                  {!actExpConfirmed && (
                    <TouchableOpacity onPress={() => setShowActExp(p => !p)} activeOpacity={0.7}>
                      <Text style={styles.actExtraBtn}>{showActExp ? '− Collapse' : '+ Add Expense'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {showActExp && (
                  <View style={{ backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, marginTop: 4 }}>
                    <TextInput style={styles.fInput} placeholder="Description" placeholderTextColor="#94a3b8" value={actExpDesc} onChangeText={setActExpDesc} />
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                      <TextInput style={[styles.fInput, { flex: 1 }]} placeholder="Amount (₹)" placeholderTextColor="#94a3b8" value={actExpAmount} onChangeText={setActExpAmount} keyboardType="numeric" />
                      <TouchableOpacity style={[styles.fInputTouch, { flex: 1 }]} onPress={() => setShowActExpCatDrop(p => !p)} activeOpacity={0.8}>
                        <Text style={{ fontSize: 12, color: '#0f172a' }}>{actExpCategory.emoji} {actExpCategory.label}</Text>
                      </TouchableOpacity>
                    </View>
                    {showActExpCatDrop && (
                      <View style={styles.dropdown}>
                        {EXPENSE_CATS.map(c => (
                          <TouchableOpacity key={c.label} style={styles.dropdownItem} onPress={() => { setActExpCategory(c); setShowActExpCatDrop(false); }} activeOpacity={0.7}>
                            <Text style={{ fontSize: 13, color: '#0f172a' }}>{c.emoji} {c.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    <Text style={[styles.fLabel, { marginTop: 8 }]}>Paid by</Text>
                    <TouchableOpacity style={styles.fInputTouch} onPress={() => setShowActExpPaidByDrop(p => !p)} activeOpacity={0.8}>
                      <Text style={{ fontSize: 13, color: '#0f172a' }}>{actExpPaidBy}</Text>
                    </TouchableOpacity>
                    {showActExpPaidByDrop && (
                      <View style={styles.dropdown}>
                        {['You', ...members.filter(m => m.userId !== currentUserId).map(m => m.fullName)].map(name => (
                          <TouchableOpacity key={name} style={styles.dropdownItem} onPress={() => { setActExpPaidBy(name); setShowActExpPaidByDrop(false); }} activeOpacity={0.7}>
                            <Text style={{ fontSize: 13, color: '#0f172a' }}>{name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    <Text style={[styles.fLabel, { marginTop: 8 }]}>Split type</Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {(['equally','amount','percent'] as const).map((k, i) => (
                        <TouchableOpacity key={k} onPress={() => setActExpSplitType(k)} style={[styles.splitTypeBtn, { flex: 1 }, actExpSplitType === k && styles.splitTypeBtnActive]} activeOpacity={0.8}>
                          <Text style={[styles.splitTypeTxt, actExpSplitType === k && styles.splitTypeTxtActive]}>{['Equally','By Amount','By %'][i]}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={[styles.fLabel, { marginTop: 8 }]}>Split among</Text>
                    <TouchableOpacity style={[styles.splitRow, actExpSplitAmong.includes('You') && styles.splitRowActive]} onPress={() => setActExpSplitAmong(p => p.includes('You') ? p.filter(x => x !== 'You') : [...p, 'You'])} activeOpacity={0.8}>
                      <View style={[styles.splitCheck, actExpSplitAmong.includes('You') && styles.splitCheckActive]}>{actExpSplitAmong.includes('You') && <CheckIcon />}</View>
                      <Text style={{ fontSize: 13, color: '#0f172a', flex: 1, marginLeft: 8 }}>You</Text>
                      {actExpSplitType !== 'equally' && (
                        <TextInput style={[styles.fInput, { width: 70, marginBottom: 0, paddingVertical: 5 }]} placeholder={actExpSplitType === 'percent' ? '%' : '₹'} placeholderTextColor="#94a3b8" keyboardType="numeric" value={actExpSplitDetails['You'] || ''} onChangeText={v => setActExpSplitDetails(p => ({ ...p, You: v }))} />
                      )}
                    </TouchableOpacity>
                    {members.filter(m => m.userId !== currentUserId).map(m => (
                      <TouchableOpacity key={m.userId} style={[styles.splitRow, actExpSplitAmong.includes(m.userId) && styles.splitRowActive]} onPress={() => setActExpSplitAmong(p => p.includes(m.userId) ? p.filter(x => x !== m.userId) : [...p, m.userId])} activeOpacity={0.8}>
                        <View style={[styles.splitCheck, actExpSplitAmong.includes(m.userId) && styles.splitCheckActive]}>{actExpSplitAmong.includes(m.userId) && <CheckIcon />}</View>
                        <Text style={{ fontSize: 13, color: '#0f172a', flex: 1, marginLeft: 8 }}>{m.fullName}</Text>
                        {actExpSplitType !== 'equally' && (
                          <TextInput style={[styles.fInput, { width: 70, marginBottom: 0, paddingVertical: 5 }]} placeholder={actExpSplitType === 'percent' ? '%' : '₹'} placeholderTextColor="#94a3b8" keyboardType="numeric" value={actExpSplitDetails[m.userId] || ''} onChangeText={v => setActExpSplitDetails(p => ({ ...p, [m.userId]: v }))} />
                        )}
                      </TouchableOpacity>
                    ))}
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                      <TouchableOpacity style={[styles.splitTypeBtn, { flex: 1, paddingVertical: 10 }]} onPress={() => { setShowActExp(false); if (!actExpConfirmed) { setActExpDesc(''); setActExpAmount(''); setActExpCategory(EXPENSE_CATS[0]); setActExpPaidBy('You'); setActExpSplitType('equally'); setActExpSplitAmong(['You']); setActExpSplitDetails({}); } }} activeOpacity={0.7}><Text style={styles.splitTypeTxt}>Cancel</Text></TouchableOpacity>
                      <TouchableOpacity style={[styles.tealBtnFull, { flex: 1.4 }]} onPress={() => {
                        if (actExpDesc.trim() && actExpAmount) {
                          setActExpConfirmed(true);
                          setShowActExp(false);
                        } else { Alert.alert('Error', 'Enter description and amount'); }
                      }} activeOpacity={0.85}><Text style={styles.tealBtnTxt}>Confirm</Text></TouchableOpacity>
                    </View>
                  </View>
                )}
                {actExpConfirmed && !showActExp && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf9', borderRadius: 8, padding: 10, marginTop: 4, borderWidth: 1, borderColor: '#ccfbf1' }}>
                    <Text style={{ fontSize: 13, color: '#0f172a', flex: 1 }} numberOfLines={1}>{actExpCategory.emoji} {actExpDesc} · ₹{actExpAmount}</Text>
                    <TouchableOpacity onPress={() => setShowActExp(true)} activeOpacity={0.7} style={{ marginRight: 10 }}>
                      <Text style={{ fontSize: 12, color: '#0d9488', fontWeight: '600' }}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setActExpConfirmed(false); setActExpDesc(''); setActExpAmount(''); setActExpCategory(EXPENSE_CATS[0]); setActExpPaidBy('You'); setActExpSplitType('equally'); setActExpSplitAmong(['You']); setActExpSplitDetails({}); }} activeOpacity={0.7}>
                      <Text style={{ fontSize: 12, color: '#ef4444', fontWeight: '600' }}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </ScrollView>
            <View style={styles.dFooterSingle}>
              <TouchableOpacity style={styles.tealBtnFull} onPress={handleAddActivity} activeOpacity={0.85}><Text style={styles.tealBtnTxt}>{editingActivityId ? 'Update Activity' : 'Add Activity'}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Hour dropdown overlay */}
      <Modal visible={showHourDrop} transparent animationType="none" onRequestClose={() => setShowHourDrop(false)}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowHourDrop(false)}>
          <View style={{ position: 'absolute', top: hourDropPos.y, left: hourDropPos.x, width: Math.max(hourDropPos.w, 72), backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', elevation: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 8, overflow: 'hidden', maxHeight: 200 }}>
            <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
              {Array.from({ length: 24 }, (_, i) => i).map(h => (
                <TouchableOpacity key={h}
                  style={{ paddingVertical: 11, alignItems: 'center', backgroundColor: String(h) === String(actHour) ? '#f0fdfa' : '#fff' }}
                  onPress={() => { setActHour(String(h)); setShowHourDrop(false); }}
                  activeOpacity={0.7}>
                  <Text style={{ fontSize: 14, color: String(h) === String(actHour) ? '#0d9488' : '#334155', fontWeight: String(h) === String(actHour) ? '700' : '400' }}>
                    {String(h).padStart(2, '0')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Minute dropdown overlay */}
      <Modal visible={showMinDrop} transparent animationType="none" onRequestClose={() => setShowMinDrop(false)}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowMinDrop(false)}>
          <View style={{ position: 'absolute', top: minDropPos.y, left: minDropPos.x, width: Math.max(minDropPos.w, 72), backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', elevation: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 8, overflow: 'hidden' }}>
            {['00', '15', '30', '45'].map(m => (
              <TouchableOpacity key={m}
                style={{ paddingVertical: 13, alignItems: 'center', backgroundColor: m === String(actMin).padStart(2,'0') ? '#f0fdfa' : '#fff' }}
                onPress={() => { setActMin(m); setShowMinDrop(false); }}
                activeOpacity={0.7}>
                <Text style={{ fontSize: 14, color: m === String(actMin).padStart(2,'0') ? '#0d9488' : '#334155', fontWeight: m === String(actMin).padStart(2,'0') ? '700' : '400' }}>
                  {m}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ═══════════════════════════════════════════════════
          MODAL 2 — Documents
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
                  <Text style={styles.tealBtnTxt}>Upload Documents</Text>
                </TouchableOpacity>
                {docs.length === 0 ? (
                  <View style={styles.emptyCenter}>
                    <Svg width={52} height={52} viewBox="0 0 24 24" fill="none">
                      <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#cbd5e1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                      <Path d="M14 2v6h6M16 13H8M16 17H8" stroke="#cbd5e1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <Text style={styles.emptyTitle}>No documents yet</Text>
                    <Text style={styles.emptySub}>Upload important documents for your trip</Text>
                  </View>
                ) : docs.map(doc => (
                  <TouchableOpacity key={doc.id} style={styles.docRow} activeOpacity={0.7}
                    onPress={() => doc.uri ? setDocPreviewUrl(doc.uri) : Alert.alert('Error', 'Document URL not available.')}>
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                      <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      <Path d="M14 2v6h6M16 13H8M16 17H8" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <Text style={{ flex: 1, fontSize: 13, color: '#0f172a', marginLeft: 10 }} numberOfLines={1}>{doc.name}</Text>
                    {(role === 'admin' || (doc as any).uploadedBy === currentUserId) && (
                      <TouchableOpacity onPress={e => { e.stopPropagation?.(); handleDeleteDoc(doc.id, (doc as any).uploadedBy ?? ''); }} activeOpacity={0.7}>
                        <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '600' }}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════
          MODAL 3 — Members
      ═══════════════════════════════════════════════════ */}
      <Modal visible={showMembers} transparent animationType="fade" onRequestClose={() => setShowMembers(false)}>
        <View style={styles.overlay}>
          <View style={[styles.dialog, { maxHeight: '88%' }]}>
            <DHeader title="Trip Members" subtitle={`Current members: ${memberCount}`} onClose={() => setShowMembers(false)} />
            <TabBar tabs={['From Friends', 'Invite New']} active={memberTab} onSelect={t => setMemberTab(t as any)} />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Current members (always visible) */}
              <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
                <Text style={styles.memberSectionLabel}>Current Members</Text>
                {members.map(m => (
                  <View key={m.userId} style={styles.memberRow}>
                    {m.avatarUrl
                      ? <Image source={{ uri: m.avatarUrl }} style={styles.memberAvatar as any} />
                      : <View style={styles.avatarPlaceholder}><Text style={{ fontSize: 18 }}>👤</Text></View>}
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.memberName}>{m.fullName || (m as any).name || 'Member'}{m.userId === currentUserId ? ' (You)' : ''}</Text>
                    </View>
                    {m.role === 'admin'
                      ? <View style={styles.ownerBadge}><Text style={styles.ownerTxt}>Admin</Text></View>
                      : role === 'admin' && m.userId !== currentUserId
                        ? <TouchableOpacity onPress={async () => { try { await removeTripMember(tripId, m.userId); setMembers(p => p.filter(x => x.userId !== m.userId)); } catch (e) { handleApiError(e); } }} activeOpacity={0.7}><Text style={{ color: '#ef4444', fontSize: 12 }}>Remove</Text></TouchableOpacity>
                        : null}
                  </View>
                ))}
              </View>

              {memberTab === 'From Friends' && (
                <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 }}>
                  <Text style={styles.memberSectionLabel}>Add from Friends</Text>
                  <View style={styles.searchBox}>
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"><Circle cx={11} cy={11} r={8} stroke="#94a3b8" strokeWidth={2} /><Path d="M21 21l-4.35-4.35" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
                    <TextInput style={styles.searchInput} placeholder="Search by name or email..." placeholderTextColor="#94a3b8" value={memberSearch} onChangeText={setMemberSearch} />
                  </View>
                  {filteredFriends.length === 0 ? (
                    <Text style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, marginTop: 16, marginBottom: 8 }}>
                      {apiFriends.length === 0 ? 'No friends found. Add friends to invite them.' : 'All your friends are already members.'}
                    </Text>
                  ) : filteredFriends.map(f => {
                    const sel = selectedFriends.includes(f.id);
                    return (
                      <TouchableOpacity key={f.id} style={styles.memberRow} onPress={() => setSelectedFriends(p => p.includes(f.id) ? p.filter(x => x !== f.id) : [...p, f.id])} activeOpacity={0.8}>
                        <Image source={{ uri: f.avatar }} style={styles.memberAvatar as any} />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={styles.memberName}>{f.name}</Text>
                        </View>
                        {sel ? <View style={styles.checkCircle}><CheckIcon /></View> : null}
                      </TouchableOpacity>
                    );
                  })}
                  {selectedFriends.length > 0 && (
                    <TouchableOpacity style={[styles.tealBtnFull, { marginTop: 12 }]} onPress={handleInviteMembers} activeOpacity={0.85}>
                      <Text style={styles.tealBtnTxt}>Add {selectedFriends.length} Member{selectedFriends.length > 1 ? 's' : ''}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {memberTab === 'Invite New' && (
                <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 }}>
                  <Text style={styles.memberSectionLabel}>Invite new people to join this trip</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                    {[
                      { key: 'email', icon: (active: boolean) => <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke={active ? '#fff' : '#64748b'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /><Path d="M22 6l-10 7L2 6" stroke={active ? '#fff' : '#64748b'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg> },
                      { key: 'sms',   icon: (active: boolean) => <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={active ? '#fff' : '#64748b'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg> },
                      { key: 'whatsapp', icon: (active: boolean) => <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke={active ? '#fff' : '#64748b'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg> },
                    ].map(m => (
                      <TouchableOpacity key={m.key} onPress={() => setInviteMethod(m.key as any)} style={[styles.inviteIconBtn, inviteMethod === m.key && styles.inviteIconBtnActive]} activeOpacity={0.7}>
                        {m.icon(inviteMethod === m.key)}
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TextInput style={[styles.fInput, { flex: 1 }]} placeholder={inviteMethod === 'email' ? 'Enter email address' : inviteMethod === 'sms' ? 'Enter phone number' : 'Enter WhatsApp number'} placeholderTextColor="#94a3b8" value={inviteInput} onChangeText={setInviteInput} keyboardType={inviteMethod === 'email' ? 'email-address' : 'phone-pad'} autoCapitalize="none" />
                    <TouchableOpacity style={styles.sendBtn} onPress={handleInviteMembers} activeOpacity={0.85}>
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
          MODAL 4 — Photos
      ═══════════════════════════════════════════════════ */}
      <Modal visible={showPhotos} transparent animationType="fade" onRequestClose={() => setShowPhotos(false)}>
        <View style={styles.overlay}>
          <View style={[styles.dialog, { maxHeight: '90%' }]}>
            <DHeader title="Trip Photos" onClose={() => setShowPhotos(false)} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.dBody}>
                {/* Upload / Camera buttons */}
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
                    <Text style={styles.emptySub}>Start capturing memories from your trip!</Text>
                  </View>
                ) : (() => {
                  // Group photos: activity photos first (by activityTitle), then direct trip photos
                  const activityGroups: Record<string, PhotoItem[]> = {};
                  const directPhotos: PhotoItem[] = [];
                  photos.forEach(ph => {
                    if (ph.activityId && ph.activityTitle) {
                      if (!activityGroups[ph.activityTitle]) activityGroups[ph.activityTitle] = [];
                      activityGroups[ph.activityTitle].push(ph);
                    } else {
                      directPhotos.push(ph);
                    }
                  });

                  const renderPhotoThumb = (ph: PhotoItem) => (
                    <TouchableOpacity key={ph.id} onPress={() => setPreviewPhoto(ph)} activeOpacity={0.85} style={{ width: 80, height: 80, borderRadius: 8, overflow: 'hidden', backgroundColor: '#e2e8f0' }}>
                      <Image
                        source={{ uri: ph.localUri ?? ph.uri }}
                        style={{ width: 80, height: 80, borderRadius: 8 }}
                        resizeMode="cover"
                        onError={() => {}}
                      />
                    </TouchableOpacity>
                  );

                  return (
                    <View>
                      {/* Activity photo groups */}
                      {Object.entries(activityGroups).map(([actTitle, actPhotos]) => (
                        <View key={actTitle} style={{ marginBottom: 16 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 }}>
                            <View style={{ width: 3, height: 14, backgroundColor: '#0d9488', borderRadius: 2 }} />
                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a' }}>{actTitle}</Text>
                            <Text style={{ fontSize: 11, color: '#94a3b8' }}>({actPhotos.length})</Text>
                          </View>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {actPhotos.map(ph => renderPhotoThumb(ph))}
                          </View>
                        </View>
                      ))}
                      {/* Direct trip photos */}
                      {directPhotos.length > 0 && (
                        <View style={{ marginBottom: 8 }}>
                          {Object.keys(activityGroups).length > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 }}>
                              <View style={{ width: 3, height: 14, backgroundColor: '#64748b', borderRadius: 2 }} />
                              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a' }}>Trip Photos</Text>
                              <Text style={{ fontSize: 11, color: '#94a3b8' }}>({directPhotos.length})</Text>
                            </View>
                          )}
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {directPhotos.map(ph => renderPhotoThumb(ph))}
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })()}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════
          FULLSCREEN PHOTO PREVIEW
      ═══════════════════════════════════════════════════ */}
      <Modal visible={!!previewPhoto} transparent animationType="fade" onRequestClose={() => setPreviewPhoto(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', justifyContent: 'center', alignItems: 'center' }}>
          {/* Close — top left */}
          <TouchableOpacity
            onPress={() => setPreviewPhoto(null)}
            style={{ position: 'absolute', top: 48, left: 20, zIndex: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}
            activeOpacity={0.8}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          {/* Delete — top right */}
          {previewPhoto && (role === 'admin' || previewPhoto.uploadedBy === currentUserId) && (
            <TouchableOpacity
              onPress={() => {
                if (!previewPhoto) return;
                Alert.alert('Delete Photo', 'Remove this photo?', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete', style: 'destructive',
                    onPress: async () => {
                      await handleDeletePhoto(previewPhoto.id, previewPhoto.uploadedBy ?? '');
                      setPreviewPhoto(null);
                    },
                  },
                ]);
              }}
              style={{ position: 'absolute', top: 48, right: 20, zIndex: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(239,68,68,0.85)', alignItems: 'center', justifyContent: 'center' }}
              activeOpacity={0.8}
            >
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>
          )}
          {previewPhoto && (
            <>
              <Image
                source={{ uri: previewPhoto.localUri ?? previewPhoto.uri }}
                style={{ width: '100%', height: '75%' }}
                resizeMode="contain"
                onError={() => {}}
              />
              {previewPhoto.activityTitle && (
                <View style={{ marginTop: 16, paddingHorizontal: 20, alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(13,148,136,0.25)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#0d9488' }} />
                    <Text style={{ color: '#5eead4', fontSize: 13, fontWeight: '600' }}>{previewPhoto.activityTitle}</Text>
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      </Modal>

      {/* Document preview modal — in-app WebView */}
      <Modal visible={!!docPreviewUrl} transparent={false} animationType="slide" onRequestClose={() => setDocPreviewUrl(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#1e293b' }}>
            <TouchableOpacity onPress={() => setDocPreviewUrl(null)} activeOpacity={0.7} style={{ marginRight: 12 }}>
              <Text style={{ color: '#5eead4', fontSize: 15, fontWeight: '600' }}>✕ Close</Text>
            </TouchableOpacity>
            <Text style={{ color: '#f1f5f9', fontSize: 14, fontWeight: '600', flex: 1 }} numberOfLines={1}>Document Preview</Text>
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
          MODAL 5 — Expenses
      ═══════════════════════════════════════════════════ */}
      <Modal visible={showExpenses} transparent animationType="fade" onRequestClose={() => { setShowExpenses(false); setShowAddExpense(false); }}>
        <View style={styles.overlay}>
          <View style={[styles.dialog, { maxHeight: '92%' }]}>
            <DHeader title="Expenses" onClose={() => { setShowExpenses(false); setShowAddExpense(false); }} />
            <TabBar tabs={['All Expenses', 'Balances']} active={expTab} onSelect={t => setExpTab(t as any)} />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {expTab === 'All Expenses' && (
                <View style={styles.dBody}>
                  <TouchableOpacity style={styles.tealBtnFull} onPress={() => {
                    // Initialize split among with all trip members
                    const allIds = ['You', ...members.filter(m => m.userId !== currentUserId).map(m => m.userId)];
                    setExpSplitAmong(allIds);
                    setExpPaidBy('You');
                    setExpDesc(''); setExpAmount(''); setExpSplitType('equally'); setExpSplitDetails({});
                    setShowAddExpense(p => !p);
                  }} activeOpacity={0.85}>
                    <Text style={styles.tealBtnTxt}>+ Add Expense</Text>
                  </TouchableOpacity>

                  {showAddExpense && (
                    <View style={{ marginTop: 14 }}>
                      <Text style={styles.fLabel}>Description</Text>
                      <TextInput style={styles.fInput} placeholder="e.g., Dinner at restaurant" placeholderTextColor="#94a3b8" value={expDesc} onChangeText={setExpDesc} />
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
                          {['You', ...members.filter(m => m.userId !== currentUserId).map(m => m.fullName || (m as any).name || 'Member')].map(name => (
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
                          <TextInput
                            style={[styles.fInput, { width: 72, marginBottom: 0, paddingVertical: 6, textAlign: 'right' }]}
                            placeholder={expSplitType === 'percent' ? '0 %' : '0.00'}
                            placeholderTextColor="#94a3b8"
                            keyboardType="numeric"
                            value={expSplitDetails['You'] || ''}
                            onChangeText={v => setExpSplitDetails(p => ({ ...p, You: v }))}
                          />
                        )}
                      </TouchableOpacity>
                      {/* Other trip members */}
                      {members.filter(m => m.userId !== currentUserId).map(m => (
                        <TouchableOpacity key={m.userId} style={[styles.splitRow, expSplitAmong.includes(m.userId) && styles.splitRowActive]} onPress={() => setExpSplitAmong(p => p.includes(m.userId) ? p.filter(x => x !== m.userId) : [...p, m.userId])} activeOpacity={0.8}>
                          <View style={[styles.splitCheck, expSplitAmong.includes(m.userId) && styles.splitCheckActive]}>
                            {expSplitAmong.includes(m.userId) && <CheckIcon />}
                          </View>
                          <Text style={{ fontSize: 13, color: '#0f172a', flex: 1, marginLeft: 8 }}>{m.fullName || (m as any).name || 'Member'}</Text>
                          {expSplitType !== 'equally' && (
                            <TextInput
                              style={[styles.fInput, { width: 72, marginBottom: 0, paddingVertical: 6, textAlign: 'right' }]}
                              placeholder={expSplitType === 'percent' ? '0 %' : '0.00'}
                              placeholderTextColor="#94a3b8"
                              keyboardType="numeric"
                              value={expSplitDetails[m.userId] || ''}
                              onChangeText={v => setExpSplitDetails(p => ({ ...p, [m.userId]: v }))}
                            />
                          )}
                        </TouchableOpacity>
                      ))}
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddExpense(false)} activeOpacity={0.7}><Text style={styles.cancelTxt}>Cancel</Text></TouchableOpacity>
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
                      {(() => {
                        // Group expenses by activity
                        const actExpGroups: { [actId: string]: { title: string; items: Expense[] } } = {};
                        const directExpenses: Expense[] = [];
                        expenses.forEach(exp => {
                          if (exp.activityId) {
                            const act = activities.find(a => a.id === exp.activityId);
                            const title = act?.title ?? 'Activity';
                            if (!actExpGroups[exp.activityId]) actExpGroups[exp.activityId] = { title, items: [] };
                            actExpGroups[exp.activityId].items.push(exp);
                          } else {
                            directExpenses.push(exp);
                          }
                        });
                        const hasGroups = Object.keys(actExpGroups).length > 0;

                        const renderExpRow = (exp: Expense) => {
                          const myAmt = exp.myAmount ?? 0;
                          const balText = exp.paidBy === 'You'
                            ? `You lent ₹${(exp.amount - myAmt).toFixed(2)}`
                            : `You owe ₹${myAmt.toFixed(2)}`;
                          const balColor = exp.paidBy === 'You' ? '#0d9488' : '#ef4444';
                          return (
                            <View key={exp.id} style={styles.expRow}>
                              <View style={styles.expIconBox}><Text style={{ fontSize: 18 }}>{EXPENSE_CATS.find(c => c.label === exp.category)?.emoji || '📦'}</Text></View>
                              <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={styles.expName}>{exp.description}</Text>
                                <Text style={styles.expMeta}>Paid by {exp.paidBy}</Text>
                                <Text style={styles.expMeta}>{exp.date}</Text>
                                <Text style={styles.expMeta}>Split {exp.splitType} • {exp.splitAmong.length} person</Text>
                              </View>
                              <View style={{ alignItems: 'flex-end' }}>
                                <Text style={styles.expAmt}>₹{exp.amount.toFixed(2)}</Text>
                                <Text style={{ fontSize: 11, color: balColor, marginBottom: 6 }}>{balText}</Text>
                                {(role === 'admin' || (exp as any).createdBy === currentUserId) && (
                                  <View style={{ flexDirection: 'row', gap: 12 }}>
                                    <TouchableOpacity onPress={() => startEditExpense(exp)} activeOpacity={0.7}><Text style={{ fontSize: 12, color: '#0d9488', fontWeight: '600' }}>Edit</Text></TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleDeleteExpense(exp.id, (exp as any).createdBy ?? '')} activeOpacity={0.7}><Text style={{ fontSize: 12, color: '#ef4444', fontWeight: '600' }}>Delete</Text></TouchableOpacity>
                                  </View>
                                )}
                              </View>
                            </View>
                          );
                        };

                        return (
                          <>
                            {Object.values(actExpGroups).map((group, idx) => (
                              <View key={idx}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 4, borderLeftWidth: 3, borderLeftColor: '#0d9488', paddingLeft: 8 }}>
                                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#0d9488', flex: 1 }}>{group.title}</Text>
                                  <Text style={{ fontSize: 11, color: '#94a3b8' }}>{group.items.length} expense{group.items.length !== 1 ? 's' : ''}</Text>
                                </View>
                                {group.items.map(renderExpRow)}
                              </View>
                            ))}
                            {directExpenses.length > 0 && (
                              <View>
                                {hasGroups && (
                                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 4, borderLeftWidth: 3, borderLeftColor: '#94a3b8', paddingLeft: 8 }}>
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748b', flex: 1 }}>Other Expenses</Text>
                                    <Text style={{ fontSize: 11, color: '#94a3b8' }}>{directExpenses.length} expense{directExpenses.length !== 1 ? 's' : ''}</Text>
                                  </View>
                                )}
                                {directExpenses.map(renderExpRow)}
                              </View>
                            )}
                          </>
                        );
                      })()}
                    </View>
                  )}
                </View>
              )}

              {expTab === 'Balances' && (
                <View style={styles.dBody}>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                    <View style={[styles.balCard]}><Text style={styles.balLabel}>Total</Text><Text style={styles.balValue}>₹{parseFloat(totalExpenses || '0').toFixed(0)}</Text></View>
                    <View style={[styles.balCard, { backgroundColor: myBalance >= 0 ? '#f0fdf4' : '#fff1f2' }]}>
                      <Text style={styles.balLabel}>My Balance</Text>
                      <Text style={[styles.balValue, { color: myBalance >= 0 ? '#16a34a' : '#e11d48' }]}>
                        {myBalance >= 0 ? '+' : ''}₹{isNaN(myBalance) ? '0' : Math.abs(myBalance).toFixed(0)}
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
                        <Text style={styles.expName}>{debt.fromName || 'Someone'} owes {debt.toName || 'Someone'}</Text>
                        <Text style={styles.expMeta}>₹{debt.amount.toFixed(2)}</Text>
                      </View>
                      {debt.from === currentUserId && (
                        <TouchableOpacity
                          style={[styles.tealBtnFull, { paddingHorizontal: 12, paddingVertical: 6 }]}
                          onPress={() => handleSettleDebt(debt.to, debt.amount)}
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
          MODAL 6 — Polls
      ═══════════════════════════════════════════════════ */}
      <Modal visible={showPolls} transparent animationType="fade" onRequestClose={() => setShowPolls(false)}>
        <View style={styles.overlay}>
          <View style={[styles.dialog, { maxHeight: '88%' }]}>
            <DHeader title="Polls" onClose={() => setShowPolls(false)} />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.dBody}>
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
                <TouchableOpacity onPress={() => setPollOptions(p => [...p, ''])} activeOpacity={0.7} style={{ marginTop: 2, marginBottom: 8 }}>
                  <Text style={{ fontSize: 13, color: '#0d9488', fontWeight: '600' }}>+ Add Option</Text>
                </TouchableOpacity>

                {/* Active polls */}
                {polls.map(poll => {
                  const totalVotes = poll.options.reduce((s, o) => s + o.voteCount, 0);
                  return (
                  <View key={poll.id} style={styles.pollCard}>
                    <Text style={styles.pollQ}>{poll.question}</Text>
                    {poll.options.map(opt => {
                      const pct = totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 100) : 0;
                      const isMyVote = opt.votedByMe || poll.myVoteOptionId === opt.id;
                      return (
                        <TouchableOpacity key={opt.id} style={styles.pollOptRow} onPress={() => handleVote(poll.id, opt.id)} activeOpacity={0.8}>
                          <View style={[styles.pollBar, { width: `${isMyVote ? 100 : pct}%` as any, backgroundColor: isMyVote ? '#0d9488' : '#ccfbf1' }]} />
                          <Text style={[styles.pollOptTxt, isMyVote && { fontWeight: '700', color: '#fff' }]}>{isMyVote ? '✓  ' : ''}{opt.text}</Text>
                          <Text style={[styles.pollVotes, isMyVote && { color: '#fff' }]}>{pct}%</Text>
                        </TouchableOpacity>
                      );
                    })}
                    {role === 'admin' && (
                      <TouchableOpacity onPress={() => setPolls(p => p.filter(po => po.id !== poll.id))} activeOpacity={0.7} style={{ marginTop: 8, alignSelf: 'flex-end' }}>
                        <Text style={{ fontSize: 11, color: '#ef4444' }}>Delete Poll</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  );
                })}
              </View>
            </ScrollView>
            <View style={styles.dFooterRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setPollQuestion(''); setPollOptions(['', '', '']); }} activeOpacity={0.7}><Text style={styles.cancelTxt}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.tealBtnFull, { flex: 1 }]} onPress={handleCreatePoll} activeOpacity={0.85}><Text style={styles.tealBtnTxt}>Create Poll</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══════════════════════════════════════════════════
          MODAL 7 — Notes
      ═══════════════════════════════════════════════════ */}
      <Modal visible={showNotes} transparent animationType="fade" onRequestClose={() => setShowNotes(false)}>
        <View style={styles.overlay}>
          <View style={[styles.dialog, { maxHeight: '88%' }]}>
            <DHeader title="Trip Notes" onClose={() => setShowNotes(false)} />
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
                          onPress={() => setExpandedNoteId(expandedNoteId === note.id ? null : note.id)}
                          style={[styles.noteCard, note.pinned && { backgroundColor: '#fefce8', borderColor: '#fde68a' }]}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                            {/* Category emoji */}
                            <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: '#f0fdf9', alignItems: 'center', justifyContent: 'center' }}>
                              <Text style={{ fontSize: 20 }}>{cat.emoji}</Text>
                            </View>
                            {/* Title + body */}
                            <View style={{ flex: 1 }}>
                              <Text style={styles.noteTitle}>{note.title}</Text>
                              {!!note.body && (
                                <Text style={styles.noteBody} numberOfLines={expandedNoteId === note.id ? undefined : 2}>
                                  {note.body}
                                </Text>
                              )}
                              <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                                By You{note.date ? ` • ${note.date}` : ''}{expandedNoteId !== note.id ? '  tap to expand' : '  tap to collapse'}
                              </Text>
                            </View>
                            {/* Action icons */}
                            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                              <TouchableOpacity
                                onPress={async () => {
                                  try {
                                    const favRes = await favoriteNote(tripId, note.id);
                                    const newPinned = favRes?.isFavorited ?? !note.pinned;
                                    setNotes(p => p.map(n => n.id === note.id ? { ...n, pinned: newPinned } : n));
                                  } catch (err) { handleApiError(err); }
                                }}
                                activeOpacity={0.7}
                                style={{ padding: 4 }}
                              >
                                <Svg width={16} height={16} viewBox="0 0 24 24" fill={note.pinned ? '#0d9488' : 'none'}>
                                  <Path d="M12 2l3 6.5 7 1-5 4.8 1.2 7L12 18l-6.2 3.3L7 14.3 2 9.5l7-1z" stroke={note.pinned ? '#0d9488' : '#94a3b8'} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                                </Svg>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => startEditNote(note)} activeOpacity={0.7} style={{ padding: 4 }}>
                                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                                  <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="#64748b" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                                  <Path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#64748b" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                                </Svg>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => handleDeleteNote(note.id)} activeOpacity={0.7} style={{ padding: 4 }}>
                                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                                  <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="#ef4444" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                                </Svg>
                              </TouchableOpacity>
                            </View>
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
          MODAL 8 — Edit Trip
      ═══════════════════════════════════════════════════ */}
      <Modal visible={showEditTrip} transparent animationType="fade" onRequestClose={() => setShowEditTrip(false)}>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <DHeader title="Edit Trip" onClose={() => setShowEditTrip(false)} />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.dBody}>
                <Text style={styles.fLabel}>Trip Name</Text>
                <TextInput style={styles.fInput} placeholder="e.g., Tokyo Getaway" placeholderTextColor="#94a3b8" value={editName} onChangeText={setEditName} />
                <Text style={styles.fLabel}>Start Date</Text>
                <TouchableOpacity style={styles.fInputTouch} onPress={() => setShowStartPicker(true)} activeOpacity={0.8}>
                  <Text style={{ color: '#0f172a', fontSize: 14 }}>
                    {`${String(editStartDate.getDate()).padStart(2,'0')}/${String(editStartDate.getMonth()+1).padStart(2,'0')}/${String(editStartDate.getFullYear()).slice(-2)}`}
                  </Text>
                </TouchableOpacity>
                {showStartPicker && (
                  <DateTimePicker
                    value={editStartDate}
                    mode="date"
                    display="default"
                    onChange={(_: DateTimePickerEvent, d?: Date) => { setShowStartPicker(false); if (d) setEditStartDate(d); }}
                  />
                )}
                <Text style={styles.fLabel}>End Date</Text>
                <TouchableOpacity style={styles.fInputTouch} onPress={() => setShowEndPicker(true)} activeOpacity={0.8}>
                  <Text style={{ color: '#0f172a', fontSize: 14 }}>
                    {`${String(editEndDate.getDate()).padStart(2,'0')}/${String(editEndDate.getMonth()+1).padStart(2,'0')}/${String(editEndDate.getFullYear()).slice(-2)}`}
                  </Text>
                </TouchableOpacity>
                {showEndPicker && (
                  <DateTimePicker
                    value={editEndDate}
                    mode="date"
                    display="default"
                    onChange={(_: DateTimePickerEvent, d?: Date) => { setShowEndPicker(false); if (d) setEditEndDate(d); }}
                  />
                )}
                <Text style={styles.fLabel}>Location</Text>
                <TextInput style={styles.fInput} placeholder="e.g., Paris, France" placeholderTextColor="#94a3b8" value={editLocation} onChangeText={setEditLocation} />
              </View>
            </ScrollView>
            <View style={styles.dFooterRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEditTrip(false)} activeOpacity={0.7}><Text style={styles.cancelTxt}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.tealBtnFull, { flex: 1 }, isSubmitting && { opacity: 0.6 }]} onPress={handleSaveTrip} disabled={isSubmitting} activeOpacity={0.85}><Text style={styles.tealBtnTxt}>{isSubmitting ? 'Saving...' : 'Save Changes'}</Text></TouchableOpacity>
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
  container:  { flex: 1, backgroundColor: 'transparent' },
  topBar:     { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 2 },
  backBtn:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingBottom: 120 },

  // Header card
  headerCard: { marginHorizontal: 16, marginBottom: 6, borderRadius: 20, borderWidth: 2, borderColor: '#99f6e4', padding: 16 },
  cardRow:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  tripName:   { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 3 },
  tripDates:  { fontSize: 13, color: '#475569', marginBottom: 2 },
  tripLocation: { fontSize: 13, color: '#64748b' },
  daysArea:   { alignItems: 'flex-end', paddingLeft: 8 },
  daysNumber: { fontSize: 40, fontWeight: '800', color: '#0f172a', lineHeight: 44 },
  daysLabel:  { fontSize: 11, color: '#64748b', fontWeight: '500', textAlign: 'right' },
  pencilBtn:  { marginTop: 4, marginLeft: 4, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#99f6e4' },

  statsRow:  { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  statTxt:   { fontSize: 12, fontWeight: '600', color: '#0f172a' },

  // Actions
  actionsWrap: { backgroundColor: '#f0fdfa', paddingHorizontal: 20, paddingVertical: 16, gap: 16, marginBottom: 6 },
  actionsRow:  { flexDirection: 'row', justifyContent: 'space-between' },
  actionBtn:   { alignItems: 'center', width: 72, gap: 6 },
  actionCircle:{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
  actionLabel: { fontSize: 11, fontWeight: '600', color: '#0f172a', textAlign: 'center', lineHeight: 14 },

  // Sections
  section:        { paddingHorizontal: 16, marginTop: 20, marginBottom: 4 },
  sectionTitle:   { fontSize: 17, fontWeight: '500', color: '#0f172a', marginBottom: 12 },
  sectionTitleDark: { fontSize: 17, fontWeight: '500', color: '#0f172a' },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },

  emptyBox:   { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: '#e2e8f0', paddingVertical: 32, paddingHorizontal: 20, alignItems: 'center' },
  emptyCenter:{ alignItems: 'center', paddingVertical: 28 },
  emptyTitle: { fontSize: 13, color: '#64748b', fontWeight: '600', marginTop: 10 },
  emptySub:   { fontSize: 12, color: '#94a3b8', marginTop: 4, textAlign: 'center' },

  actRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#f1f5f9' },
  actTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 2 },
  actMeta:  { fontSize: 12, color: '#94a3b8' },
  doneBtn:  { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#f0fdfa', marginLeft: 8 },
  doneTxt:  { fontSize: 12, color: '#0d9488', fontWeight: '600' },
  trashBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },

  // FAB
  sweeFab: { position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#0d9488', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff', elevation: 8, shadowColor: '#0d9488', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, zIndex: 50 },

  // Modal base
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.52)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  dialog:  { backgroundColor: '#fff', borderRadius: 20, width: '100%', maxHeight: '90%', overflow: 'hidden' },

  // Dialog header
  dHeader:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dTitle:    { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  dSubtitle: { fontSize: 12, color: '#64748b', marginTop: 1 },
  dCloseBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },

  dBody:        { padding: 16 },
  dFooterSingle:{ padding: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  dFooterRow:   { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' },

  // Form fields
  fLabel:     { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  fInput:     { backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#0f172a' },
  fInputTouch:{ backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11 },

  // Teal buttons
  tealBtnFull: { flexDirection: 'row', backgroundColor: '#0d9488', borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  tealBtnTxt:  { color: '#fff', fontWeight: '700', fontSize: 14 },
  cancelBtn:   { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  cancelTxt:   { fontSize: 14, color: '#64748b', fontWeight: '600' },

  // Tabs
  tabBar:        { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tab:           { flex: 1, paddingVertical: 11, alignItems: 'center' },
  tabActive:     { borderBottomWidth: 2, borderBottomColor: '#0d9488' },
  tabTxt:        { fontSize: 13, color: '#64748b', fontWeight: '500' },
  tabTxtActive:  { color: '#0d9488', fontWeight: '700' },

  // Activity extra rows
  actExtraRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', marginTop: 4 },
  actExtraLabel:{ fontSize: 13, color: '#0f172a', fontWeight: '500' },
  actExtraBtn:  { fontSize: 13, color: '#0d9488', fontWeight: '600' },

  // Documents
  docRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },

  // Members
  memberSectionLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  memberRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  memberAvatar:{ width: 40, height: 40, borderRadius: 20 },
  memberName:  { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  memberEmail: { fontSize: 12, color: '#64748b', marginTop: 1 },
  ownerBadge:  { backgroundColor: '#f0fdfa', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#99f6e4' },
  ownerTxt:    { fontSize: 11, color: '#0d9488', fontWeight: '700' },
  searchBox:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, marginBottom: 12, gap: 8 },
  searchInput: { flex: 1, fontSize: 13, color: '#0f172a' },
  checkCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#0d9488', alignItems: 'center', justifyContent: 'center' },
  inviteIconBtn:      { width: 52, height: 52, borderRadius: 26, backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  inviteIconBtnActive:{ borderColor: '#0d9488', backgroundColor: '#0d9488' },
  sendBtn:     { backgroundColor: '#0d9488', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },

  // Photos
  uploadPhotosBtn: { flex: 1, flexDirection: 'row', backgroundColor: '#fff1f2', borderWidth: 1.5, borderColor: '#fecdd3', borderRadius: 10, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  uploadPhotosTxt: { fontSize: 13, fontWeight: '600', color: '#be123c' },
  takePhotoBtn:    { flex: 1, flexDirection: 'row', backgroundColor: '#ecfeff', borderWidth: 1.5, borderColor: '#a5f3fc', borderRadius: 10, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  takePhotoTxt:    { fontSize: 13, fontWeight: '600', color: '#0e7490' },

  // Expenses
  expRow:    { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  expIconBox:{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },
  expName:   { fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 2 },
  expMeta:   { fontSize: 11, color: '#94a3b8', marginBottom: 1 },
  expAmt:    { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  dropdown:  { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, overflow: 'hidden', marginTop: 4 },
  dropdownItem: { paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  splitTypeBtn:       { flex: 1, paddingVertical: 9, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center' },
  splitTypeBtnActive: { backgroundColor: '#0d9488' },
  splitTypeTxt:       { fontSize: 12, color: '#64748b', fontWeight: '500' },
  splitTypeTxtActive: { color: '#fff', fontWeight: '700' },
  splitRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', marginVertical: 4 },
  splitRowActive: { borderColor: '#0d9488', backgroundColor: '#f0fdfa' },
  splitCheck:       { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center' },
  splitCheckActive: { backgroundColor: '#0d9488', borderColor: '#0d9488' },

  // Balances
  balCard:  { flex: 1, backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, alignItems: 'center' },
  balLabel: { fontSize: 11, color: '#64748b', fontWeight: '500', marginBottom: 4 },
  balValue: { fontSize: 16, fontWeight: '700', color: '#0f172a' },

  // Polls
  pollCard:   { backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  pollQ:      { fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 10 },
  pollOptRow: { position: 'relative', flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', paddingVertical: 9, paddingHorizontal: 12, marginBottom: 6, overflow: 'hidden' },
  pollBar:    { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#ccfbf1', borderRadius: 8 },
  pollOptTxt: { flex: 1, fontSize: 13, color: '#0f172a', fontWeight: '500', zIndex: 1 },
  pollVotes:  { fontSize: 12, color: '#64748b', fontWeight: '600', zIndex: 1 },

  // Notes
  noteCard:  { backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  noteTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a', flex: 1 },
  noteBody:  { fontSize: 13, color: '#64748b', lineHeight: 18 },
  catBtn:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
});