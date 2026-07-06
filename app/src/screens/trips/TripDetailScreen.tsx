import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Animated, PanResponder, Image, Platform, Linking,
  ActivityIndicator, FlatList, Dimensions, Easing, InteractionManager, Pressable,
} from 'react-native';
import AppModal from '../../components/common/AppModal';
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const EXPENSES_MODAL_HEIGHT = Math.round(SCREEN_H * 0.78);
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import SweeIcon from '../../components/common/SweeIcon';
import SweeFab from '../../components/details/SweeFab';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { pick as pickDocument, types as docTypes, keepLocalCopy, isErrorWithCode, errorCodes } from '@react-native-documents/picker';
import { WebView } from 'react-native-webview';
// DocumentPicker loaded dynamically to avoid crash if native module not yet linked
import AppDatePicker from '../../components/common/AppDatePicker';
import BlobBackground from '../../components/common/BlobBackground';
import LocationAutocomplete from '../../components/common/LocationAutocomplete';
import LocationMultiPicker from '../../components/common/LocationMultiPicker';
import { formatLocationsLabel, formatLocationsLabelFull, formatLocationsHeroLabel, normalizeLocations, toLocationPayload, type LocationPoint } from '../../utils/locations';
import CachedImage from '../../components/common/CachedImage';
import PollOptionItem from '../../components/common/PollOptionItem';
import SharedDetailHeroCard from '../../components/common/DetailHeroCard';
import FloatingTabBar from '../../components/common/FloatingTabBar';
import AppHeader from '../../components/common/AppHeader';
import ProfileDropdown from '../home/ProfileDropdown';
import useAuth from '../../hooks/useAuth';
import UploadOptionsRow from '../../components/common/UploadOptionsRow';
import EmailOptionsRow from '../../components/common/EmailOptionsRow';
import DocumentItem, { DocItemSkeleton, stripExt } from '../../components/common/DocumentItem';
import InviteViaChannels from '../../components/common/InviteViaChannels';
import { EmailProviderIcon, emailProviderLabel } from '../../components/common/EmailProviderIcons';
import { DriveBrandIcon } from '../../components/common/GoogleWorkspaceIcons';
import useAuthStore from '../../store/authStore';
import useUploadLimits from '../../hooks/useUploadLimits';
import { showAlert, showConfirm } from '../../store/alertStore';
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
  getActivityPhotos,
  deleteActivityPhoto,

  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getBalances,
  settleDebt,
  getDocs,
  uploadDoc,
  deleteDoc,
  renameDoc,
  getTripPhotos,
  getEmailStatus,
  listEmailAttachments,
  importEmailAttachments,
  getDriveStatus,
  listDriveFiles,
  listDrivePhotoFiles,
  importDriveFiles,
  importDrivePhotos,
  type EmailAttachment,
  type DriveFile,
  getNotes,
  createNote,
  updateNote,
  deleteNote,
  favoriteNote,
  getPolls,
  createPoll,
  voteOnPoll,
  deletePoll,
  setPollStatus,
  getFriends,
  handleApiError,
} from '../../api/trips.api';
import type { TripMember, Debt } from '../../api/trips.api';
import { markTripSectionViewed } from '../../api/trips.api';
import ExpenseTotalsTab from '../../components/common/ExpenseTotalsTab';
import { ExpenseListSkeleton, TotalTabSkeleton, BalanceTabSkeleton } from '../../components/common/ExpenseTabSkeleton';
import ExpenseBalanceSummary from '../../components/common/ExpenseBalanceSummary';
import {
  EXPENSE_CATS as EXPENSE_CATEGORY_OPTIONS,
  NOTE_CATS as NOTE_CATEGORY_OPTIONS,
  ExpenseCategoryIcon,
  ExpenseCatRow,
  NoteCatRow,
  NoteCategoryIcon,
  resolveExpenseCategory,
} from '../../components/common/CategoryIcons';
import { buildGroupExpenseTotals, buildExpenseMemberRoster } from '../../utils/expenseTotals';
import { formatCurrencyFull, formatCurrencyCompact, buildExpenseLabel } from '../../utils/currency';
import { getExpenseRowBalanceLabel, hasRecordedGroupExpenses } from '../../utils/expenseDisplay';
import CurrencyPickerDropdown from '../../components/common/CurrencyPickerDropdown';
import OutstandingDebtsList from '../../components/common/OutstandingDebtsList';
import { closeExpenseOverlays, settleDebtKey } from '../../utils/expenseModalHelpers';
import typography from '../../theme/typography';
import DrivePickerRow from '../../components/gallery/DrivePickerRow';
import DrivePhotoPickerGrid from '../../components/gallery/DrivePhotoPickerGrid';
import MediaModuleDialog from '../../components/media/MediaModuleDialog';
import { useMediaDialog, mapApiPhoto } from '../../hooks/useMediaDialog';
import { organizeTripMediaItems } from '../../utils/albumPhotosOrder';
import { checkDriveConnected, promptConnectDrive, watchDriveConnect, promptConnectEmail } from '../../utils/drivePickerFlow';
import { drivePhotoSelectCap, toggleDriveFileSelection } from '../../utils/drivePickerSelection';


// ─── Types ────────────────────────────────────────────────────────────────────

type Activity = {
  id: string; title: string; date: string; hour: string; minute: string;
  location?: string; description?: string; completed?: boolean;
  linkedExpense?: { id: string; description: string; amount: number } | null;
  photoCount?: number;
};
type ActExistingPhoto = { id: string; uri: string };
type DocItem = { id: string; name: string; uri: string; mimeType?: string; uploadedBy?: any; fileSizeBytes?: number; createdAt?: string };
type PhotoItem = { id: string; uri: string; localUri?: string; name: string; uploadedBy?: string; activityId?: string | null; activityTitle?: string | null; createdAt?: string | null };
type Expense = {
  id: string; description: string; amount: number; category: string;
  currency: string;
  paidBy: string; splitType: 'equally' | 'amount' | 'percent';
  splitAmong: string[]; date: string;
  activityId?: string | null;
  myAmount?: number;   // current user's share of this expense
  /** Expense author (for edit/delete permissions) */
  createdByUserId?: string;
  splitBreakdown?: { userId: string; amount: number; percentage: number | null }[];
};
type Poll = { id: string; question: string; options: { id: string; text: string; voteCount: number; votedByMe: boolean }[]; myVoteOptionId?: string | null; createdBy?: string; createdByName?: string | null; createdAt?: string | null; status?: 'active' | 'completed' };
type Note = { id: string; title: string; body: string; category: 'general' | 'idea' | 'important' | 'todo'; date: string; pinned?: boolean };

// ─── Friends ──────────────────────────────────────────────────────────────────

const FRIENDS = [
  { id: '1', name: 'Yuki Tanaka', email: 'yuki.tanaka@example.com', avatar: 'https://i.pravatar.cc/150?img=32' },
  { id: '2', name: 'Amara Okafor', email: 'amara.okafor@example.com', avatar: 'https://i.pravatar.cc/150?img=38' },
  { id: '3', name: 'Marcus Johnson', email: 'marcus.j@example.com', avatar: 'https://i.pravatar.cc/150?img=13' },
  { id: '4', name: 'Priya Sharma', email: 'priya.sharma@example.com', avatar: 'https://i.pravatar.cc/150?img=45' },
  { id: '5', name: 'Carlos Rodriguez', email: 'carlos.r@example.com', avatar: 'https://i.pravatar.cc/150?img=12' },
];

function mapApiExpenseToState(e: any, currentUserId: string, members: TripMember[]): Expense {
  const resolvePaidBy = (paidByRaw: any): string => {
    const uid = typeof paidByRaw === 'object' && paidByRaw !== null
      ? (paidByRaw.userId ?? paidByRaw.id ?? '')
      : String(paidByRaw ?? '');
    if (uid === currentUserId) return 'You';
    const member = members.find(m => m.userId === uid);
    if (member) return member.fullName;
    if (typeof paidByRaw === 'object' && paidByRaw !== null)
      return (paidByRaw.name ?? paidByRaw.fullName ?? uid) || 'Unknown';
    return uid || 'Unknown';
  };
  const paidByStr = resolvePaidBy(e.paidBy);
  const mySplit = (e.splits ?? []).find((s: any) => s.userId === currentUserId);
  const myAmount = mySplit ? parseFloat(String(mySplit.amount ?? '0')) : 0;
  const creatorRaw = e.createdBy ?? e.created_by;
  const creatorId = typeof creatorRaw === 'object' && creatorRaw !== null
    ? String((creatorRaw as any).userId ?? (creatorRaw as any).id ?? '')
    : String(creatorRaw ?? '').trim();
  return {
    id: e.id,
    description: e.description,
    amount: parseFloat(String(e.amount)),
    currency: (e.currency as string) || 'INR',
    category: e.category ?? 'general',
    paidBy: paidByStr,
    splitType: e.splitType === 'equal' ? 'equally' : e.splitType === 'percentage' ? 'percent' : 'amount',
    splitAmong: (e.splits ?? []).map((s: any) => s.userId),
    date: new Date(e.createdAt).toLocaleDateString('default', { day: 'numeric', month: 'short' }),
    createdByUserId: creatorId || undefined,
    activityId: (e as any).activityId ?? null,
    myAmount,
    splitBreakdown: (e.splits ?? []).map((s: any) => ({
      userId: s.userId,
      amount: parseFloat(String(s.amount ?? '0')),
      percentage: s.percentage != null && s.percentage !== '' ? parseFloat(String(s.percentage)) : null,
    })),
  };
}
// ─── Balance helpers (handle both old and new backend formats) ────────────────

/** Enrich a flat debt array — fills in missing fromName/toName from members list */
function normalizeDebtArray(
  debts: any[],
  currentUid: string,
  membersList: { userId: string; fullName: string }[],
): Debt[] {
  return (debts ?? []).map((d: any) => ({
    from: d.from,
    to: d.to,
    fromName: d.fromName || (d.from === currentUid ? 'You' : (membersList.find(m => m.userId === d.from)?.fullName || 'Member')),
    toName: d.toName || (d.to === currentUid ? 'You' : (membersList.find(m => m.userId === d.to)?.fullName || 'Member')),
    amount: typeof d.amount === 'number' ? d.amount : parseFloat(d.amount ?? '0'),
    currency: d.currency || 'INR',
  }));
}

/**
 * Parse getBalances response — handles both backend formats:
 * - NEW (multi-currency): { debts, myBalances: {INR:x, USD:y}, totalExpensesByCurrency: {INR:'x'} }
 * - TRANSITIONAL: { debts, myBalance, totalExpenses }
 * - OLD: { summary: {netBalance, yoursTotal}, outstanding: [...] }
 */
function parseBalanceResponse(
  balRes: any,
  currentUid: string,
  membersList: { userId: string; fullName: string }[],
): { debts: Debt[]; myBalances: Record<string, number>; totalExpensesByCurrency: Record<string, string> } {
  if (Array.isArray(balRes?.debts)) {
    const debts = normalizeDebtArray(balRes.debts, currentUid, membersList);
    // New multi-currency format
    if (balRes.myBalances && typeof balRes.myBalances === 'object') {
      return {
        debts,
        myBalances: balRes.myBalances as Record<string, number>,
        totalExpensesByCurrency: (balRes.totalExpensesByCurrency ?? {}) as Record<string, string>,
      };
    }
    // Transitional: single myBalance/totalExpenses → wrap in INR bucket
    const mb = typeof balRes.myBalance === 'number' ? balRes.myBalance : 0;
    const te = balRes.totalExpenses ?? '0';
    return { debts, myBalances: { INR: mb }, totalExpensesByCurrency: { INR: te } };
  }
  // Old format
  const debts: Debt[] = (balRes?.outstanding ?? []).map((o: any) => {
    const otherId = o.userId;
    const otherName = o.name || membersList.find(m => m.userId === otherId)?.fullName || 'Member';
    const youOwe = o.direction === 'you_owe';
    return {
      from: youOwe ? currentUid : otherId,
      to: youOwe ? otherId : currentUid,
      fromName: youOwe ? 'You' : otherName,
      toName: youOwe ? otherName : 'You',
      amount: typeof o.amount === 'number' ? o.amount : parseFloat(o.amount ?? '0'),
      currency: 'INR',
    };
  });
  const mb = typeof balRes?.summary?.netBalance === 'number' ? balRes.summary.netBalance : 0;
  const te = String(balRes?.summary?.yoursTotal ?? 0);
  return { debts, myBalances: { INR: mb }, totalExpensesByCurrency: { INR: te } };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntilISO(iso: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(iso).getTime() - today.getTime()) / 86400000);
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

function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
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
const ChevDown = ({ color = '#64748b' }: { color?: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path d="M6 9l6 6 6-6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
const ChevUp = ({ color = '#64748b' }: { color?: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Path d="M18 15l-6-6-6 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
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

function formatActivityDate(iso: string) {
  if (!iso) return 'No Date';
  const d = new Date(iso);
  return d.toLocaleDateString('default', { weekday: 'short', day: 'numeric', month: 'short' });
}

function groupActivitiesByDate(items: Activity[]): [string, Activity[]][] {
  const groups = new Map<string, Activity[]>();
  items.forEach(a => {
    const key = a.date || '__nodate__';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(a);
  });
  return Array.from(groups.entries());
}

function ActivityGroupsList({
  activities,
  collapsedDates,
  onToggleDate,
  onActivityPress,
  animateKey,
  canAnimate,
  collapseKeyPrefix = '',
}: {
  activities: Activity[];
  collapsedDates: Set<string>;
  onToggleDate: (collapseKey: string) => void;
  onActivityPress: (act: Activity) => void;
  animateKey: number;
  canAnimate: boolean;
  collapseKeyPrefix?: string;
}) {
  const entries = useMemo(() => groupActivitiesByDate(activities), [activities]);
  const animRefs = useRef<Animated.Value[]>([]);
  const lastStartedKey = useRef(-1);

  const ensureAnim = (index: number) => {
    if (!animRefs.current[index]) {
      animRefs.current[index] = new Animated.Value(0);
    }
    return animRefs.current[index];
  };

  useLayoutEffect(() => {
    lastStartedKey.current = -1;
    animRefs.current = entries.map((_, i) => {
      const existing = animRefs.current[i];
      if (existing) {
        existing.setValue(0);
        return existing;
      }
      return new Animated.Value(0);
    });
  }, [entries.length, animateKey]);

  useEffect(() => {
    if (!canAnimate) lastStartedKey.current = -1;
  }, [canAnimate]);

  useEffect(() => {
    if (!canAnimate || entries.length === 0) return;
    if (lastStartedKey.current === animateKey) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const interactionTask = InteractionManager.runAfterInteractions(() => {
      timeoutId = setTimeout(() => {
        lastStartedKey.current = animateKey;
        const anims = animRefs.current.slice(0, entries.length);
        anims.forEach(v => v.setValue(0));
        Animated.stagger(
          72,
          anims.map(v =>
            Animated.timing(v, {
              toValue: 1,
              duration: 340,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ),
        ).start();
      }, 100);
    });

    return () => {
      interactionTask.cancel();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [canAnimate, animateKey, entries.length]);

  return (
    <View>
      {entries.map(([dateKey, acts], index) => {
        const collapseKey = `${collapseKeyPrefix}${dateKey}`;
        const isCollapsed = collapsedDates.has(collapseKey);
        const progress = ensureAnim(index);
        return (
          <Animated.View
            key={collapseKey}
            style={{
              marginBottom: 4,
              opacity: progress,
              transform: [{
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-14, 0],
                }),
              }],
            }}>
            <TouchableOpacity style={styles.actDateRow} onPress={() => onToggleDate(collapseKey)} activeOpacity={0.7}>
              <Text style={styles.actDateLabel}>
                {formatActivityDate(dateKey === '__nodate__' ? '' : dateKey)}
              </Text>
              {isCollapsed ? <ChevDown color="#0d9488" /> : <ChevUp color="#0d9488" />}
            </TouchableOpacity>
            {!isCollapsed && (
              <View style={styles.actItemsWrap}>
                {acts.map((act, idx) => (
                  <TouchableOpacity
                    key={act.id}
                    style={[styles.actItemRow, idx === acts.length - 1 && { marginBottom: 0 }]}
                    onPress={() => onActivityPress(act)}
                    activeOpacity={0.7}>
                    <Text style={[styles.actItemLine, styles.actTimeLabel]}>
                      {act.hour ? `${String(act.hour).padStart(2, '0')}:${(act.minute || '00').padStart(2, '0')}` : '     '}
                    </Text>
                    <Text style={[styles.actItemLine, styles.actItemTitle]} numberOfLines={1}>{act.title}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Animated.View>
        );
      })}
    </View>
  );
}

function ActionIcon({ path, color }: { path: string; color: string }) {
  const s = { width: 18, height: 18 };
  switch (path) {
    case 'plus': return <Svg {...s} viewBox="0 0 24 24" fill="none"><Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'docs': return <Svg {...s} viewBox="0 0 24 24" fill="none"><Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /><Path d="M14 2v6h6M16 13H8M16 17H8" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'members': return <Svg {...s} viewBox="0 0 24 24" fill="none"><Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /><Path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'photos': return <Svg {...s} viewBox="0 0 24 24" fill="none"><Rect x={3} y={3} width={18} height={18} rx={2} ry={2} stroke={color} strokeWidth={2} /><Circle cx={8.5} cy={8.5} r={1.5} fill={color} /><Path d="M21 15l-5-5L5 21" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'expenses': return <Svg {...s} viewBox="0 0 24 24" fill="none"><Path d="M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'polls': return <Svg {...s} viewBox="0 0 24 24" fill="none"><Path d="M18 20V10M12 20V4M6 20v-6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    case 'notes': return <Svg {...s} viewBox="0 0 24 24" fill="none"><Path d="M9 11l3 3L22 4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /><Path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
    default: return null;
  }
}

// ─── Poll Skeleton ────────────────────────────────────────────────────────────

function PollSkeleton() {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
    return () => pulse.stopAnimation();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const SkBox = ({ w, h, mt }: { w: string | number; h: number; mt?: number }) => (
    <Animated.View style={{ width: w, height: h, borderRadius: 6, backgroundColor: '#e2e8f0', marginTop: mt ?? 0, opacity: pulse }} />
  );
  return (
    <View style={{ marginTop: 20 }}>
      {[0, 1].map(i => (
        <View key={i} style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
          <SkBox w="75%" h={14} />
          {[0, 1, 2].map(j => (
            <View key={j} style={{ marginTop: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Animated.View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#e2e8f0', marginRight: 8, opacity: pulse }} />
                <SkBox w="55%" h={11} />
              </View>
              <SkBox w="100%" h={5} mt={0} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Dialog Header ────────────────────────────────────────────────────────────

function DHeader({ title, subtitle, leading, onClose }: { title: string; subtitle?: string; leading?: React.ReactNode; onClose: () => void }) {
  return (
    <View style={styles.dHeader}>
      <View style={{ flex: 1 }}>
        {leading ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {leading}
            <Text style={styles.dTitle}>{title}</Text>
          </View>
        ) : (
          <Text style={styles.dTitle}>{title}</Text>
        )}
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

// ─── Photo helper components ──────────────────────────────────────────────────

function TripPhotoThumb({ photo, onPress }: { photo: PhotoItem; onPress: () => void }) {
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
            style={{ width: 80, height: 80, borderRadius: 8 }}
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

function TripAlbumHeroPhoto({ photo }: { photo: PhotoItem }) {
  const [loading, setLoading] = useState(true);
  const [localUriFailed, setLocalUriFailed] = useState(false);
  const uri = (photo.localUri && !localUriFailed) ? photo.localUri : photo.uri;
  const prevId = useRef(photo.id);
  useEffect(() => {
    if (prevId.current !== photo.id) {
      prevId.current = photo.id;
      setLocalUriFailed(false);
      setLoading(true);
    }
  }, [photo.id]);
  return (
    <View style={{ flex: 1 }}>
      <CachedImage
        uri={uri}
        style={{ width: '100%', height: '100%' }}
        resizeMode="cover"
        onLoad={() => setLoading(false)}
        onError={() => {
          if (photo.localUri && !localUriFailed) { setLocalUriFailed(true); setLoading(true); }
          else setLoading(false);
        }}
      />
      {loading && (
        <View style={{ ...StyleSheet.absoluteFillObject as any, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' }}>
          <ActivityIndicator size="large" color="#5eead4" />
        </View>
      )}
    </View>
  );
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
              } catch (_err) {
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

function FriendAvatar({ uri, name, style }: { uri: string; name: string; style: any }) {
  const [failed, setFailed] = useState(false);
  if (!uri || failed) {
    return (
      <View style={[style, { backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontSize: 16, fontWeight: '500', color: '#94a3b8' }}>{name?.[0]?.toUpperCase() ?? '?'}</Text>
      </View>
    );
  }
  return <CachedImage uri={uri} style={style} resizeMode="cover" onError={() => setFailed(true)} />;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TripDetailScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const [trip, setTrip] = useState(route?.params?.trip);
  const rawUser = useAuthStore(s => s.user) as any;
  const currentUserId: string = rawUser?.id ?? rawUser?.sub ?? '';
  const currentUserName: string | null = rawUser?.fullName ?? rawUser?.profile?.fullName ?? null;
  const currentUserAvatar: string | null = rawUser?.avatarUrl ?? rawUser?.photoUrl ?? rawUser?.profile?.avatarUrl ?? null;
  const avatarUpdatedAt = useAuthStore(s => s.avatarUpdatedAt);
  const { logout, refreshProfile } = useAuth();
  const firstName = rawUser?.fullName?.split(' ')[0] || 'Explorer';
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const uploadLimits = useUploadLimits();

  // ── API-driven state ──
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [members, setMembers] = useState<TripMember[]>([]);
  const membersRef = useRef(members);
  membersRef.current = members;
  const [failedAvatarIds, setFailedAvatarIds] = useState<Set<string>>(new Set());
  const [balances, setBalances] = useState<Debt[]>([]);
  const [myBalances, setMyBalances] = useState<Record<string, number>>({});
  const [totalExpensesByCurrency, setTotalExpensesByCurrency] = useState<Record<string, string>>({});
  const [apiStats, setApiStats] = useState<{ memberCount: number; docCount: number; photoVideoCount: number; totalExpenseAmount: number } | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  // ── Loading / submitting flags ──
  const [, setIsLoadingInit] = useState(true);
  const [, setIsLoadingDocs] = useState(false);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(false);
  const [isRefreshingExpenses, setIsRefreshingExpenses] = useState(false);
  const [settlingDebtKey, setSettlingDebtKey] = useState<string | null>(null);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleTarget, setSettleTarget] = useState<{ toUserId: string; toName: string; maxAmount: number; currency: string } | null>(null);
  const [settleInputAmount, setSettleInputAmount] = useState('');
  const [, setIsLoadingNotes] = useState(false);
  const [isLoadingPolls, setIsLoadingPolls] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Data state ──
  const [activities, setActivities] = useState<Activity[]>([]);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [apiFriends, setApiFriends] = useState<{ id: string; name: string; avatarUrl: string | null }[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showUpcoming, setShowUpcoming] = useState(true);
  const [activitiesAnimKey, setActivitiesAnimKey] = useState(0);
  const [tripDetailReady, setTripDetailReady] = useState(false);

  const tripId: string = trip?.id ?? '';

  const media = useMediaDialog({
    mode: 'trip',
    entityId: tripId,
    activities: activities.map((a) => ({ id: a.id, title: a.title })),
    bannerImageUrl: trip?.bannerImageUrl ?? null,
    onBannerUpdated: (url) => setTrip((t) => (t ? { ...t, bannerImageUrl: url } : t)),
    onError: handleApiError,
  });

  const activityPhotoCap = uploadLimits.tripActivityPhoto.maxFilesTotal;
  const activityPhotoBatch = uploadLimits.tripActivityPhoto.maxBatchFiles;
  const drivePhotoSelectLimit = drivePhotoSelectCap(
    uploadLimits.tripPhoto.maxBatchFiles,
    media.mediaCount,
    media.capTotal,
  );

  const mergeActivityPhotosIntoMedia = useCallback((
    activityId: string,
    activityTitle: string,
    added: ReturnType<typeof mapApiPhoto>[],
    removedIds: string[] = [],
  ) => {
    media.setItems((prev) => {
      const activityOrder = activities.map((a) => a.id);
      const filtered = prev.filter((p) => !removedIds.includes(p.id));
      const withoutDupes = filtered.filter((p) => !added.some((n) => n.id === p.id));
      const withActivityMeta = added.map((p) => ({
        ...p,
        activityId,
        activityTitle,
      }));
      return organizeTripMediaItems([...withoutDupes, ...withActivityMeta], activityOrder);
    });
  }, [media, activities]);

  const refreshMediaFromServer = useCallback(async () => {
    if (!tripId) return;
    try {
      const res = await getTripPhotos(tripId);
      media.mergeApiPhotos(res.photos);
    } catch {
      // Non-blocking — local merge already applied
    }
  }, [tripId, media]);

  const uploadNewActivityPhotos = useCallback(async (
    activityId: string,
    activityTitle: string,
    localUris: string[],
  ) => {
    if (localUris.length === 0) return;
    const assets = localUris.map((uri, i) => ({
      uri,
      name: `photo_${i}.jpg`,
      type: 'image/jpeg',
    }));
    const photoRes = await uploadActivityPhotos(tripId, activityId, assets);
    if (photoRes.photos.length > 0) {
      const newItems = photoRes.photos.map((ph, i) => ({
        ...mapApiPhoto(ph, assets[i]?.uri),
        activityId,
        activityTitle,
      }));
      mergeActivityPhotosIntoMedia(activityId, activityTitle, newItems);
    }
  }, [tripId, mergeActivityPhotosIntoMedia]);

  // ── Modal visibility ──
  const [showAddAct, setShowAddAct] = useState(false);
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());
  const [showEditTrip, setShowEditTrip] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [renameTarget, setRenameTarget] = useState<DocItem | null>(null);
  const [renameText, setRenameText] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);
  const [uploadPending, setUploadPending] = useState(false);
  const [deletingDocIds, setDeletingDocIds] = useState<Set<string>>(new Set());
  const [showEmailPicker, setShowEmailPicker] = useState(false);
  const [emailPickerProvider, setEmailPickerProvider] = useState<'gmail' | 'outlook'>('gmail');
  const [emailAttachments, setEmailAttachments] = useState<EmailAttachment[]>([]);
  const [selectedAttachIds, setSelectedAttachIds] = useState<Set<string>>(new Set());
  const [emailPickerLoading, setEmailPickerLoading] = useState(false);
  const [emailImporting, setEmailImporting] = useState(false);
  const [emailStatus, setEmailStatus] = useState({ gmail: { connected: false }, outlook: { connected: false } });
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [drivePickerLoading, setDrivePickerLoading] = useState(false);
  const [selectedDriveFileIds, setSelectedDriveFileIds] = useState<Set<string>>(new Set());
  const [driveImporting, setDriveImporting] = useState(false);
  const [drivePickerTarget, setDrivePickerTarget] = useState<'docs' | 'photos'>('docs');
  const [driveStatus, setDriveStatus] = useState({ connected: false });
  const [showMembers, setShowMembers] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const [showExpenses, setShowExpenses] = useState(false);
  const showExpensesRef = useRef(showExpenses);
  showExpensesRef.current = showExpenses;
  const [showPolls, setShowPolls] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [docPreviewUrl, setDocPreviewUrl] = useState<string | null>(null);
  const [albumDescExpanded, setAlbumDescExpanded] = useState(false);
  const pendingDrivePickerRef = useRef<'docs' | 'photos' | null>(null);
  const [actDateError, setActDateError] = useState<string>('');

  // ── Add Activity form ──
  const [actTitle, setActTitle] = useState('');
  const [actDate, setActDate] = useState<Date | undefined>(undefined);
  const [actHour, setActHour] = useState(''); // kept for edit-load compat
  const [actMin, setActMin] = useState(''); // kept for edit-load compat
  const [actLocation, setActLocation] = useState('');
  const [actDesc, setActDesc] = useState('');
  const [actTime, setActTime] = useState<Date | undefined>(undefined);
  const [showHourDrop, setShowHourDrop] = useState(false);
  const [showMinDrop, setShowMinDrop] = useState(false);
  const hourBtnRef = useRef<any>(null);
  const minBtnRef = useRef<any>(null);
  const [hourDropPos, setHourDropPos] = useState({ x: 0, y: 0, w: 80 });
  const [minDropPos, setMinDropPos] = useState({ x: 0, y: 0, w: 80 });
  // ── Activity inline expense ──
  const [showActExp, setShowActExp] = useState(false);
  const [actExpDesc, setActExpDesc] = useState('');
  const [actExpAmount, setActExpAmount] = useState('');
  const [actExpCategory, setActExpCategory] = useState(EXPENSE_CATEGORY_OPTIONS[0]);
  const [actExpPaidBy, setActExpPaidBy] = useState('You');
  const [actExpSplitType, setActExpSplitType] = useState<'equally' | 'amount' | 'percent'>('equally');
  const [actExpSplitAmong, setActExpSplitAmong] = useState<string[]>(['You']);
  const [actExpSplitDetails, setActExpSplitDetails] = useState<{ [k: string]: string }>({});
  const [showActExpCatDrop, setShowActExpCatDrop] = useState(false);
  const [showActExpPaidByDrop, setShowActExpPaidByDrop] = useState(false);
  const [actExpCurrency, setActExpCurrency] = useState<string>('INR');
  const [showActExpCurrencyDrop, setShowActExpCurrencyDrop] = useState(false);
  const [actExpConfirmed, setActExpConfirmed] = useState(false);

  // ── Members modal ──
  const [memberTab, setMemberTab] = useState<'Members' | 'Invite Friends' | 'Invite New'>('Members');
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);

  // ── Expenses modal ──
  const [expTab, setExpTab] = useState<'Expense' | 'Total' | 'Balance'>('Expense');
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState(EXPENSE_CATEGORY_OPTIONS[0]);
  const [expPaidBy, setExpPaidBy] = useState('You');
  const [expSplitType, setExpSplitType] = useState<'equally' | 'amount' | 'percent'>('equally');
  const [expSplitAmong, setExpSplitAmong] = useState<string[]>(['You']);
  const [expSplitDetails, setExpSplitDetails] = useState<{ [k: string]: string }>({});
  const [expCurrency, setExpCurrency] = useState<string>('INR');
  const [showExpCatDrop, setShowExpCatDrop] = useState(false);
  const [showPaidByDrop, setShowPaidByDrop] = useState(false);
  const [showExpCurrencyDrop, setShowExpCurrencyDrop] = useState(false);

  // ── Polls modal ──
  const [showPollForm, setShowPollForm] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollMenuId, setPollMenuId] = useState<string | null>(null);

  // ── Notes modal ──
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [noteCategory, setNoteCategory] = useState<'general' | 'idea' | 'important' | 'todo'>('general');
  const [showNoteCatDrop, setShowNoteCatDrop] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);

  // ── Activity photos ──
  const [actExistingPhotos, setActExistingPhotos] = useState<ActExistingPhoto[]>([]);
  const [actNewPhotos, setActNewPhotos] = useState<string[]>([]);
  const [actPhotosLoading, setActPhotosLoading] = useState(false);

  const actPhotoUi = useMemo(() => {
    const count = actExistingPhotos.length + actNewPhotos.length;
    const remaining = activityPhotoCap != null
      ? Math.max(0, activityPhotoCap - count)
      : activityPhotoBatch;
    return {
      count,
      remaining,
      canAdd: remaining > 0,
      selectionLimit: Math.min(remaining, activityPhotoBatch),
      label: activityPhotoCap != null ? `Photos (${count}/${activityPhotoCap})` : `Photos (${count})`,
    };
  }, [
    actExistingPhotos.length,
    actNewPhotos.length,
    activityPhotoCap,
    activityPhotoBatch,
  ]);
  // ── Edit activity ──
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  // ── Edit expense ──
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  // ── Edit Trip form ──
  const [editName, setEditName] = useState('');
  const [editLocations, setEditLocations] = useState<LocationPoint[]>([]);
  const [editStartDate, setEditStartDate] = useState<Date>(new Date());
  const [editEndDate, setEditEndDate] = useState<Date>(new Date());
  const [editStartDateError, setEditStartDateError] = useState<string | null>(null);
  const [editEndDateError, setEditEndDateError] = useState<string | null>(null);

  const dismissExpenseOverlays = useCallback(() => {
    closeExpenseOverlays({
      setShowAddExpense,
      setEditingExpenseId,
      setShowExpCurrencyDrop,
      setShowExpCatDrop,
      setShowPaidByDrop,
    });
  }, []);

  const refreshExpenseData = useCallback(async () => {
    if (!tripId) return;
    const membersList = membersRef.current;
    setIsRefreshingExpenses(true);
    try {
      const [expRes, balRes] = await Promise.all([
        getExpenses(tripId),
        getBalances(tripId),
      ]);
      const mapped = (expRes.expenses ?? []).map(e => mapApiExpenseToState(e, currentUserId, membersList));
      setExpenses(mapped);
      const parsed = parseBalanceResponse(balRes, currentUserId, membersList);
      setBalances(parsed.debts);
      setMyBalances(parsed.myBalances);
      setTotalExpensesByCurrency(parsed.totalExpensesByCurrency);
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsRefreshingExpenses(false);
      setIsLoadingExpenses(false);
    }
  }, [tripId, currentUserId]);

  const handleExpenseTabSelect = useCallback((tab: 'Expense' | 'Total' | 'Balance') => {
    dismissExpenseOverlays();
    if (tab !== expTab) {
      setExpTab(tab);
      void refreshExpenseData();
    }
  }, [dismissExpenseOverlays, expTab, refreshExpenseData]);

  const closeExpensesModal = useCallback(() => {
    setShowExpenses(false);
    dismissExpenseOverlays();
    setShowActExpCurrencyDrop(false);
  }, [dismissExpenseOverlays]);

  const expenseTabBusy = isLoadingExpenses || isRefreshingExpenses;

  // ── Initial fetch: trip detail + members + activities ──
  useFocusEffect(useCallback(() => {
    if (!tripId) return;
    setTripDetailReady(false);
    (async () => {
      try {
        const [detailRes, membersRes, activitiesRes, balRes] = await Promise.all([
          getTripDetail(tripId),
          getTripMembers(tripId),
          getActivities(tripId),
          getBalances(tripId),
        ]);
        const locStr = formatLocationsLabel(detailRes.trip);
        setTrip((prev: any) => ({
          ...prev,
          ...detailRes.trip,
          location: locStr,
          locations: detailRes.trip.locations ?? normalizeLocations(detailRes.trip),
        }));
        setRole(detailRes.role);
        if ((detailRes as any).stats) setApiStats((detailRes as any).stats);
        if ((detailRes as any).unreadCounts) setUnreadCounts((detailRes as any).unreadCounts);
        const freshUrl = useAuthStore.getState().user?.photoUrl || useAuthStore.getState().user?.avatarUrl || null;
        setMembers(membersRes.members.map((m: TripMember) =>
          m.userId === currentUserId && freshUrl ? { ...m, avatarUrl: freshUrl } : m
        ));
        // Balance — handles both old and new backend formats
        const balParsed = parseBalanceResponse(balRes, currentUserId, membersRes.members);
        setBalances(balParsed.debts);
        setMyBalances(balParsed.myBalances);
        setTotalExpensesByCurrency(balParsed.totalExpensesByCurrency);
        const mapActivity = (a: any, completed: boolean) => {
          const { hour, minute } = parseActivityTime(a.time);
          return {
            id: a.id,
            title: a.title,
            date: a.date ?? '',
            hour,
            minute,
            location: a.location,
            description: a.description,
            completed,
            createdBy: a.createdBy,
            linkedExpense: a.linkedExpense ?? null,
            photoCount: a.photoCount ?? 0,
          };
        };
        setActivities([
          ...(activitiesRes.upcoming ?? []).map((a: any) => mapActivity(a, false)),
          ...(activitiesRes.completed ?? []).map((a: any) => mapActivity(a, true)),
        ]);
      } catch (err) {
        handleApiError(err);
      } finally {
        setIsLoadingInit(false);
        setTripDetailReady(true);
        requestAnimationFrame(() => {
          setActivitiesAnimKey(k => k + 1);
        });
      }
    })();
  }, [tripId, currentUserId]));

  // ── Load expenses + balances when expenses modal opens ──
  useEffect(() => {
    if (!showExpenses || !tripId) return;
    setIsLoadingExpenses(true);
    setUnreadCounts(prev => ({ ...prev, expenses: 0 }));
    markTripSectionViewed(tripId, 'expenses');
    void refreshExpenseData();
  }, [showExpenses, tripId, refreshExpenseData]);

  useFocusEffect(useCallback(() => {
    return () => {
      if (showExpensesRef.current) {
        setShowExpenses(false);
        dismissExpenseOverlays();
        setShowActExpCurrencyDrop(false);
      }
    };
  }, [dismissExpenseOverlays]));

  // ── Load docs when docs modal opens ──
  useEffect(() => {
    if (!showDocs || !tripId) return;
    (async () => {
      setIsLoadingDocs(true);
      try {
        const res = await getDocs(tripId);
        setDocs(res.docs.map(d => ({ id: d.id, name: stripExt(d.fileName), uri: (d as any).downloadUrl ?? d.fileUrl ?? '', uploadedBy: d.uploadedBy, mimeType: d.mimeType, fileSizeBytes: (d as any).fileSizeBytes, createdAt: (d as any).createdAt })));
        setUnreadCounts(prev => ({ ...prev, docs: 0 }));
        markTripSectionViewed(tripId, 'docs');
      } catch (err) {
        handleApiError(err);
      } finally {
        setIsLoadingDocs(false);
      }
    })();
  }, [showDocs, tripId]);

  useEffect(() => {
    if (!showDocs && !showPhotos) return;
    getEmailStatus().then((d: any) => {
      setEmailStatus({
        gmail:   { connected: Boolean(d?.gmail?.connected) },
        outlook: { connected: Boolean(d?.outlook?.connected) },
      });
    }).catch(() => {});
    checkDriveConnected().then((connected) => {
      setDriveStatus({ connected });
    });

    return watchDriveConnect(() => {
      setDriveStatus({ connected: true });
      const target = pendingDrivePickerRef.current;
      if (!target) return;
      if (target === 'photos' && showPhotos) {
        pendingDrivePickerRef.current = null;
        openDrivePicker('photos');
      } else if (target === 'docs' && showDocs) {
        pendingDrivePickerRef.current = null;
        openDrivePicker('docs');
      }
    });
  }, [showDocs, showPhotos]);

  // ── Load photos when photos modal opens ──
  useEffect(() => {
    if (!showPhotos || !tripId) return;
    const isInitialLoad = media.items.length === 0;
    (async () => {
      if (isInitialLoad) setIsLoadingPhotos(true);
      try {
        const res = await getTripPhotos(tripId);
        media.mergeApiPhotos(res.photos);
        setUnreadCounts(prev => ({ ...prev, photos: 0 }));
        markTripSectionViewed(tripId, 'photos');
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
        const mapped = res.notes.map(n => ({
          id: n.id,
          title: n.title,
          body: n.content,
          category: (n.category ?? 'general') as Note['category'],
          date: new Date(n.createdAt).toLocaleDateString('default', { day: 'numeric', month: 'short' }),
          pinned: (n as any).isFavorited ?? (n as any).isFavorite ?? (n as any).pinned ?? false,
          createdBy: n.createdBy,
        }));
        setNotes(mapped);
        setUnreadCounts(prev => ({ ...prev, notes: 0 }));
        markTripSectionViewed(tripId, 'notes');
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
        const mapped = res.polls.map(p => ({
          id: p.id,
          question: p.question,
          status: (p.status ?? 'active') as 'active' | 'completed',
          options: p.options.map(o => ({ id: o.id, text: o.text, voteCount: o.voteCount ?? 0, votedByMe: o.isMyVote ?? o.votedByMe ?? false })),
          myVoteOptionId: p.myVotedOptionId ?? p.myVoteOptionId ?? null,
          createdBy: p.createdBy,
          createdByName: p.createdByName ?? null,
          createdAt: p.createdAt ?? null,
        }));
        setPolls(mapped);
        setUnreadCounts(prev => ({ ...prev, polls: 0 }));
        markTripSectionViewed(tripId, 'polls');
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
    getTripMembers(tripId).then(res => {
      const freshUrl = useAuthStore.getState().user?.photoUrl || useAuthStore.getState().user?.avatarUrl || null;
      const mapped = res.members.map((m: TripMember) =>
        m.userId === currentUserId && freshUrl ? { ...m, avatarUrl: freshUrl } : m
      );
      setMembers(mapped);
      setUnreadCounts(prev => ({ ...prev, members: 0 }));
      markTripSectionViewed(tripId, 'members');
    }).catch(handleApiError);
    getFriends().then(res => setApiFriends(res.friends.map(f => ({ id: f.user.id, name: f.user.name, avatarUrl: f.user.avatarUrl })))).catch(() => { });
  }, [showMembers, tripId]);

  // ── Re-patch current user's avatar when photo is updated ──
  useEffect(() => {
    if (avatarUpdatedAt === 0) return;
    const freshUrl = useAuthStore.getState().user?.photoUrl || useAuthStore.getState().user?.avatarUrl || null;
    if (!freshUrl) return;
    setMembers(prev => prev.map(m =>
      m.userId === currentUserId ? { ...m, avatarUrl: freshUrl } : m
    ));
    setFailedAvatarIds(new Set());
  }, [avatarUpdatedAt, currentUserId]);

  // ── Derived ──
  const days = trip?.startDateISO ? daysUntilISO(trip.startDateISO) : 0;
  const isPastTrip = trip?.endDateISO
    ? new Date(trip.endDateISO).setHours(23, 59, 59, 999) < Date.now()
    : days < 0;
  const _today = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  const upcomingActs = activities.filter((a: any) => {
    if (a.completed) return false;
    if (!a.date) return true;
    const ad = new Date(a.date); ad.setHours(0, 0, 0, 0);
    return ad.getTime() >= _today;
  });
  const completed = activities.filter((a: any) => {
    if (a.completed) return true;
    if (!a.date) return false;
    const ad = new Date(a.date); ad.setHours(0, 0, 0, 0);
    return ad.getTime() < _today;
  });
  const expenseTotals = useMemo(
    () => buildGroupExpenseTotals(
      expenses,
      buildExpenseMemberRoster(members, currentUserId),
      currentUserId,
    ),
    [expenses, members, currentUserId],
  );
  const expenseLabel = useMemo(() => {
    const fromBalances = buildExpenseLabel(totalExpensesByCurrency);
    if (fromBalances) return fromBalances;
    const statTotal = apiStats?.totalExpenseAmount ?? 0;
    if (statTotal > 0) {
      return formatCurrencyCompact(statTotal as number, 'INR');
    }
    return null;
  }, [totalExpensesByCurrency, apiStats]);

  const toggleActivityDate = useCallback((collapseKey: string) => {
    setCollapsedDates(prev => {
      const next = new Set(prev);
      if (next.has(collapseKey)) next.delete(collapseKey);
      else next.add(collapseKey);
      return next;
    });
  }, []);
  const memberCount = members.length;
  const noteCatDisplay = NOTE_CATEGORY_OPTIONS.find(c => c.key === noteCategory)!;

  // Badges = server-computed unread counts (items added by others since user last viewed)
  const badgeCounts = {
    docs: unreadCounts.docs ?? 0,
    members: unreadCounts.members ?? 0,
    photos: unreadCounts.photos ?? 0,
    expenses: unreadCounts.expenses ?? 0,
    polls: unreadCounts.polls ?? 0,
    notes: unreadCounts.notes ?? 0,
  };
  const memberIds = new Set(members.map(m => m.userId));
  const filteredFriends = apiFriends
    .filter(f => !memberIds.has(f.id) && f.name.toLowerCase().includes(memberSearch.toLowerCase()))
    .map(f => ({ id: f.id, name: f.name, avatar: f.avatarUrl ?? `https://i.pravatar.cc/150?u=${f.id}` }));

  // ── Handlers ──
  function resetActForm() {
    setActTitle(''); setActDate(undefined); setActHour(''); setActMin(''); setActTime(undefined); setShowHourDrop(false); setShowMinDrop(false);
    setActLocation(''); setActDesc(''); setShowActExp(false);
    setActExistingPhotos([]); setActNewPhotos([]); setActPhotosLoading(false);
    setActExpDesc(''); setActExpAmount(''); setActExpCurrency('INR'); setActExpCategory(EXPENSE_CATEGORY_OPTIONS[0]);
    setActExpPaidBy('You'); setActExpSplitType('equally'); setActExpSplitAmong(['You']);
    setActExpSplitDetails({}); setActExpConfirmed(false);
    setEditingActivityId(null);
  }

  // ── Activity handlers (API-backed) ──

  async function handleAddActivity() {
    if (!actTitle.trim()) { showAlert({ title: 'Error', message: 'Please enter a title' }); return; }
    if (isSubmitting) return;
    // Validate activity date is within trip date range
    if (actDate) {
      const tripStart = trip?.startDateISO ? new Date(trip.startDateISO) : null;
      const tripEnd = trip?.endDateISO ? new Date(trip.endDateISO) : null;
      const actD = new Date(actDate.getFullYear(), actDate.getMonth(), actDate.getDate());
      if (tripStart) tripStart.setHours(0, 0, 0, 0);
      if (tripEnd) tripEnd.setHours(23, 59, 59, 999);
      if ((tripStart && actD < tripStart) || (tripEnd && actD > tripEnd)) {
        setActDateError(`Date must be between ${trip?.startDate ?? ''} and ${trip?.endDate ?? ''}`);
        return;
      }
    }
    setActDateError('');
    const totalActPhotos = actExistingPhotos.length + actNewPhotos.length;
    if (activityPhotoCap != null && totalActPhotos > activityPhotoCap) {
      showAlert({
        title: 'Photo limit reached',
        message: `This activity can have at most ${activityPhotoCap} photos.`,
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const timeHr = actTime ? actTime.getHours() : (actHour !== '' ? parseInt(actHour, 10) : null);
      const timeMin = actTime ? actTime.getMinutes() : (actMin !== '' ? parseInt(actMin, 10) : null);
      const timeStr: { hour: number; minute: number } | undefined =
        (timeHr !== null && !isNaN(timeHr) && timeMin !== null && !isNaN(timeMin))
          ? { hour: timeHr, minute: timeMin }
          : undefined;
      const dateStr = actDate ? `${actDate.getFullYear()}-${String(actDate.getMonth() + 1).padStart(2, '0')}-${String(actDate.getDate()).padStart(2, '0')}` : undefined;

      // If an expense was staged, create it first then link to activity
      let linkedExpenseId: string | undefined;
      if (actExpConfirmed && actExpDesc.trim() && actExpAmount) {
        const apiSplitType = actExpSplitType === 'equally' ? 'equal' : actExpSplitType === 'percent' ? 'percentage' : 'amount';
        const expAmount = parseFloat(actExpAmount) || 0;
        if (expAmount <= 0) {
          showAlert({ title: 'Error', message: 'Linked expense amount must be greater than zero.' });
          setIsSubmitting(false);
          return;
        }
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
          currency: actExpCurrency || 'INR',
          category: actExpCategory.slug,
          paidBy: payerId,
          splitType: apiSplitType as 'equal' | 'amount' | 'percentage',
          splitAmong: splitAmong.length ? splitAmong : [{ userId: currentUserId }],
        });
        linkedExpenseId = expRes.expense.id;
        // Sync to expenses list so main expense management reflects it
        const exp = expRes.expense;
        setExpenses(prev => [...prev, mapApiExpenseToState(exp, currentUserId, members)]);
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
        const updatedTitle = res.activity.title;
        setActivities(p => p.map(a => a.id === editingActivityId ? {
          ...a,
          title: updatedTitle,
          date: res.activity.date ?? '',
          hour: updH,
          minute: updM,
          location: res.activity.location,
          description: res.activity.description,
          photoCount: actExistingPhotos.length + actNewPhotos.length,
        } : a));
        if (actNewPhotos.length > 0) {
          await uploadNewActivityPhotos(editingActivityId, updatedTitle, actNewPhotos);
          setActivities(p => p.map(a => a.id === editingActivityId
            ? { ...a, photoCount: actExistingPhotos.length + actNewPhotos.length }
            : a));
        }
        await refreshMediaFromServer();
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
        if (actNewPhotos.length > 0) {
          await uploadNewActivityPhotos(a.id, a.title, actNewPhotos);
          setActivities(p => p.map(item => item.id === a.id
            ? { ...item, photoCount: actNewPhotos.length }
            : item));
        }
        await refreshMediaFromServer();
      }
      resetActForm();
      setShowAddAct(false);
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function startEditActivity(act: Activity) {
    setActTitle(act.title);
    setActDate((act as any).date ? new Date((act as any).date) : undefined);
    setActHour((act as any).hour ?? '');
    setActMin((act as any).minute ?? '');
    setActLocation(act.location || '');
    setActDesc(act.description || '');
    setEditingActivityId(act.id);
    setActExistingPhotos([]);
    setActNewPhotos([]);
    setShowHourDrop(false); setShowMinDrop(false); setShowActExp(false);
    setShowAddAct(true);

    setActPhotosLoading(true);
    try {
      const fromMedia = media.items
        .filter((p) => p.activityId === act.id && !p.id.startsWith('temp_'))
        .map((p) => ({ id: p.id, uri: p.localUri || p.uri }));
      if (fromMedia.length > 0) {
        setActExistingPhotos(fromMedia);
      } else {
        const res = await getActivityPhotos(tripId, act.id);
        setActExistingPhotos(
          res.photos.map((p) => ({
            id: p.id,
            uri: p.url ?? p.fileUrl ?? '',
          })),
        );
      }
    } catch (err) {
      handleApiError(err);
    } finally {
      setActPhotosLoading(false);
    }
  }

  async function handleRemoveExistingActPhoto(photoId: string) {
    if (!editingActivityId) return;
    try {
      await deleteActivityPhoto(tripId, editingActivityId, photoId);
      const nextExisting = actExistingPhotos.filter((ph) => ph.id !== photoId);
      setActExistingPhotos(nextExisting);
      setActivities((acts) => acts.map((a) => a.id === editingActivityId
        ? { ...a, photoCount: nextExisting.length + actNewPhotos.length }
        : a));
      media.setItems((prev) => prev.filter((p) => p.id !== photoId));
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleDeleteActivity(actId: string) {
    showConfirm({
      title: 'Delete Activity',
      message: 'This will permanently delete this activity. This action cannot be undone. Do you want to continue?',
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteActivity(tripId, actId);
          setActivities(p => p.filter(a => a.id !== actId));
          media.setItems((prev) => prev.filter((p) => p.activityId !== actId));
        } catch (err) { handleApiError(err); }
      },
    });
  }

  // ── Photo handlers (API-backed) ──

  function closePhotosModal() {
    setShowPhotos(false);
    media.setPreviewItem(null);
  }

  // ── Doc handlers (API-backed) ──

  function mapUploadedDoc(d: any): DocItem {
    return { id: d.id, name: stripExt(d.fileName), uri: (d as any).downloadUrl ?? d.fileUrl ?? '', uploadedBy: d.uploadedBy, mimeType: d.mimeType, fileSizeBytes: (d as any).fileSizeBytes, createdAt: (d as any).createdAt };
  }

  function currentUserUploadedBy() {
    return { userId: currentUserId, name: currentUserName, avatarUrl: currentUserAvatar };
  }

  async function handleUploadDoc() {
    setUploadPending(true);
    try {
      const [picked] = await pickDocument({ type: [docTypes.allFiles] });
      const [localCopy] = await keepLocalCopy({
        files: [{ uri: picked.uri, fileName: picked.name ?? 'document' }],
        destination: 'cachesDirectory',
      });
      if (localCopy.status === 'error') throw new Error(localCopy.copyError);
      const file = { uri: localCopy.localUri, name: decodeURIComponent(picked.name ?? 'document'), type: picked.type ?? 'application/octet-stream' };
      const data = await uploadDoc(tripId, file);
      setDocs(p => [...p, mapUploadedDoc(data.doc)]);
    } catch (err: any) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) return;
      handleApiError(err);
    } finally {
      setUploadPending(false);
    }
  }

  async function handleCameraDoc() {
    launchCamera({ mediaType: 'photo', quality: 0.85 }, async (res) => {
      if (res.didCancel || res.errorCode) return;
      const asset = res.assets?.[0];
      if (!asset?.uri) return;
      setUploadPending(true);
      try {
        const file = { uri: asset.uri, name: asset.fileName ?? 'photo.jpg', type: asset.type ?? 'image/jpeg' };
        const data = await uploadDoc(tripId, file);
        setDocs(p => [...p, mapUploadedDoc(data.doc)]);
      } catch (err) { handleApiError(err); }
      finally { setUploadPending(false); }
    });
  }

  async function handleDeleteDoc(docId: string, uploadedBy: string) {
    const uploaderId = typeof uploadedBy === 'object' && uploadedBy !== null ? (uploadedBy as any).userId : uploadedBy;
    if (role !== 'admin' && uploaderId !== currentUserId) {
      Toast.show({ type: 'error', text1: 'Permission Denied', text2: 'You can only delete your own documents.' });
      return;
    }
    setDeletingDocIds(p => new Set(p).add(docId));
    try {
      await deleteDoc(tripId, docId);
      setDocs(p => p.filter(d => d.id !== docId));
    } catch (err) { handleApiError(err); }
    finally { setDeletingDocIds(p => { const n = new Set(p); n.delete(docId); return n; }); }
  }

  async function handleRenameDoc() {
    if (!renameTarget || !renameText.trim()) return;
    setRenameLoading(true);
    try {
      const { doc } = await renameDoc(tripId, renameTarget.id, renameText.trim());
      setDocs(p => p.map(d => d.id === renameTarget.id ? { ...d, name: stripExt(doc.fileName) } : d));
      setRenameTarget(null);
    } catch (err) { handleApiError(err); }
    finally { setRenameLoading(false); }
  }

  async function openEmailPicker(provider: 'gmail' | 'outlook') {
    if (!emailStatus[provider].connected) {
      promptConnectEmail(provider, () => {
        getEmailStatus().then((d: any) => {
          setEmailStatus({ gmail: { connected: Boolean(d?.gmail?.connected) }, outlook: { connected: Boolean(d?.outlook?.connected) } });
          openEmailPicker(provider);
        }).catch(() => {});
      });
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
      const res = await importEmailAttachments('trip', tripId, emailPickerProvider, selected);
      setDocs(p => [...p, ...res.imported.map((d: any) => ({ id: d.docId, name: stripExt(d.fileName), uri: d.fileUrl, mimeType: d.mimeType, fileSizeBytes: d.fileSizeBytes, createdAt: d.createdAt ?? new Date().toISOString(), uploadedBy: currentUserUploadedBy() }))]);
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

  async function openDrivePicker(target: 'docs' | 'photos' = 'docs') {
    const connected = await checkDriveConnected();
    setDriveStatus({ connected });

    if (!connected) {
      pendingDrivePickerRef.current = target;
      promptConnectDrive();
      return;
    }

    pendingDrivePickerRef.current = null;
    setDrivePickerTarget(target);
    setDriveFiles([]);
    setSelectedDriveFileIds(new Set());
    setDrivePickerLoading(true);
    setShowDrivePicker(true);
    try {
      const res = target === 'photos' ? await listDrivePhotoFiles() : await listDriveFiles();
      setDriveFiles(res.files);
    } catch (err) {
      handleApiError(err);
      setShowDrivePicker(false);
    } finally {
      setDrivePickerLoading(false);
    }
  }

  async function confirmDriveImport() {
    if (selectedDriveFileIds.size === 0 || driveImporting) return;
    setDriveImporting(true);
    try {
      const selected = driveFiles.filter(f => selectedDriveFileIds.has(f.fileId));
      let res: { imported: unknown[]; failed?: { fileName: string; reason: string }[] };
      if (drivePickerTarget === 'photos') {
        res = await importDrivePhotos('trip', tripId, selected);
        const imported = res.imported.map((ph: any) => mapApiPhoto(ph));
        media.setItems((p) => organizeTripMediaItems([...p, ...imported], activities.map((a) => a.id)));
      } else {
        res = await importDriveFiles('trip', tripId, selected);
        setDocs(p => [...p, ...res.imported.map((d: any) => ({ id: d.docId, name: stripExt(d.fileName), uri: d.fileUrl, mimeType: d.mimeType, fileSizeBytes: d.fileSizeBytes, createdAt: d.createdAt ?? new Date().toISOString(), uploadedBy: currentUserUploadedBy() }))]);
      }
      setShowDrivePicker(false);
      if (res.failed?.length) {
        Toast.show({ type: 'error', text1: `${res.failed.length} file(s) failed to import` });
      } else {
        Toast.show({
          type: 'success',
          text1: drivePickerTarget === 'photos'
            ? `${res.imported.length} photo(s) added from Drive`
            : `${res.imported.length} file(s) imported from Drive`,
        });
      }
    } catch (err) {
      handleApiError(err);
    } finally {
      setDriveImporting(false);
    }
  }

  // ── Expense handlers (API-backed) ──

  async function handleAddExpense() {
    if (!expDesc.trim() || !expAmount) { showAlert({ title: 'Error', message: 'Please fill description and amount' }); return; }
    if (isSubmitting) return;

    const amount = parseFloat(expAmount) || 0;
    if (amount <= 0) {
      showAlert({ title: 'Error', message: 'Amount must be greater than zero.' });
      return;
    }
    // Build splitAmong — map 'You' → currentUserId, use only selected members
    const apiSplitType = expSplitType === 'equally' ? 'equal' : expSplitType === 'percent' ? 'percentage' : 'amount';
    const memberIds = expSplitAmong.map(id => id === 'You' ? currentUserId : id).filter(Boolean);
    let splitAmong: { userId: string; amount?: number; percentage?: number }[];
    if (apiSplitType === 'equal') {
      splitAmong = memberIds.map(userId => ({ userId }));
    } else if (apiSplitType === 'amount') {
      splitAmong = memberIds.map(userId => {
        const detailKey = userId === currentUserId ? 'You' : userId;
        return { userId, amount: parseFloat(expSplitDetails[detailKey] || '0') || 0 };
      });
    } else {
      splitAmong = memberIds.map(userId => {
        const detailKey = userId === currentUserId ? 'You' : userId;
        return { userId, percentage: parseFloat(expSplitDetails[detailKey] || '0') || 0 };
      });
    }

    // Validation
    if (apiSplitType === 'amount') {
      const sum = splitAmong.reduce((s: number, x) => s + (x.amount ?? 0), 0);
      if (Math.abs(sum - amount) > 0.01) {
        showAlert({ title: 'Validation Error', message: 'Split amounts must sum to the total expense amount.' });
        return;
      }
    }
    if (apiSplitType === 'percentage') {
      const sum = splitAmong.reduce((s: number, x) => s + (x.percentage ?? 0), 0);
      if (Math.abs(sum - 100) > 0.01) {
        showAlert({ title: 'Validation Error', message: 'Percentages must sum to 100.' });
        return;
      }
    }
    if (splitAmong.length === 0) {
      showAlert({ title: 'Error', message: 'Select at least one person to split with.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const payerId = expPaidBy === 'You' ? currentUserId : (members.find(m => (m.fullName || (m as any).name) === expPaidBy)?.userId ?? currentUserId);
      const body = {
        description: expDesc.trim(),
        amount,
        currency: expCurrency || 'INR',
        category: expCategory.slug,
        paidBy: payerId,
        splitType: apiSplitType as 'equal' | 'amount' | 'percentage',
        splitAmong: splitAmong.length ? splitAmong : [{ userId: currentUserId }],
      };

      if (editingExpenseId) {
        await updateExpense(tripId, editingExpenseId, body);
      } else {
        await createExpense(tripId, body);
      }
      setExpDesc(''); setExpAmount(''); setExpCurrency('INR'); setExpCategory(EXPENSE_CATEGORY_OPTIONS[0]);
      setExpPaidBy('You'); setExpSplitType('equally'); setExpSplitAmong(['You']);
      setExpSplitDetails({});
      dismissExpenseOverlays();
      await refreshExpenseData();
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEditExpense(exp: Expense) {
    setExpDesc(exp.description);
    setExpAmount(String(exp.amount));
    setExpCurrency(exp.currency || 'INR');
    setExpCategory(resolveExpenseCategory(exp.category));
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
    setShowExpCurrencyDrop(false);
    setShowExpCatDrop(false);
    setShowPaidByDrop(false);
    setShowAddExpense(true);
  }

  async function handleDeleteExpense(eid: string) {
    showConfirm({
      title: 'Delete',
      message: 'Remove this expense?',
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteExpense(tripId, eid);
          await refreshExpenseData();
        } catch (err) { handleApiError(err); }
      },
    });
  }

  function handleSettleDebt(withUserId: string, maxAmount: number, currency: string = 'INR', toName: string = 'Member') {
    const maxAmt = typeof maxAmount === 'number' && !Number.isNaN(maxAmount) ? maxAmount : parseFloat(String(maxAmount));
    if (!maxAmt || maxAmt <= 0) {
      showAlert({ title: 'Invalid amount', message: 'Enter a valid settlement amount.' });
      return;
    }
    setSettleTarget({ toUserId: withUserId, toName, maxAmount: maxAmt, currency });
    setSettleInputAmount(String(maxAmt));
    setShowSettleModal(true);
  }

  async function handleConfirmSettle() {
    if (!settleTarget) return;
    const amt = parseFloat(settleInputAmount);
    if (!amt || amt <= 0) {
      showAlert({ title: 'Invalid amount', message: 'Enter a valid settlement amount.' });
      return;
    }
    if (amt > settleTarget.maxAmount + 0.001) {
      showAlert({ title: 'Amount too large', message: `You can settle at most ${formatCurrencyFull(settleTarget.maxAmount, settleTarget.currency)}.` });
      return;
    }
    setShowSettleModal(false);
    const key = settleDebtKey(currentUserId, settleTarget.toUserId, settleTarget.currency);
    setSettlingDebtKey(key);
    const { toUserId, currency, maxAmount } = settleTarget;
    setSettleTarget(null);
    try {
      await settleDebt(tripId, { withUserId: toUserId, amount: amt, currency });
      await refreshExpenseData();
      const isPartial = amt < maxAmount - 0.001;
      Toast.show({ type: 'success', text1: isPartial ? 'Partial settlement recorded' : 'Settlement recorded' });
    } catch (err) {
      handleApiError(err);
    } finally {
      setSettlingDebtKey(null);
    }
  }

  // ── Poll handlers (API-backed) ──

  async function handleCreatePoll() {
    const valid = pollOptions.filter(o => o.trim());
    if (!pollQuestion.trim() || valid.length < 2) { showAlert({ title: 'Error', message: 'Enter a question and at least 2 options' }); return; }
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await createPoll(tripId, { question: pollQuestion.trim(), options: valid });
      const p = res.poll;
      setPolls(prev => [...prev, {
        id: p.id, question: p.question,
        options: p.options.map(o => ({ id: o.id, text: o.text, voteCount: o.voteCount ?? 0, votedByMe: o.isMyVote ?? o.votedByMe ?? false })),
        myVoteOptionId: p.myVotedOptionId ?? p.myVoteOptionId ?? null,
        createdBy: p.createdBy,
      }]);
      setPollQuestion(''); setPollOptions(['', '']);
      setShowPollForm(false);
      Toast.show({ type: 'success', text1: 'Poll created!' });
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeletePoll(pollId: string) {
    setPollMenuId(null);
    showConfirm({
      title: 'Delete Poll',
      message: 'Are you sure you want to delete this poll?',
      destructive: true,
      onConfirm: async () => {
        try {
          await deletePoll(tripId, pollId);
          setPolls(p => p.filter(po => po.id !== pollId));
        } catch (err) { handleApiError(err); }
      },
    });
  }

  async function handleCompletePoll(pollId: string) {
    setPollMenuId(null);
    setPolls(prev => prev.map(p => p.id === pollId ? { ...p, status: 'completed' as const } : p));
    try {
      const { poll } = await setPollStatus(tripId, pollId, 'completed');
      setPolls(prev => prev.map(p => p.id === pollId ? { ...p, ...poll } : p));
    } catch {
      setPolls(prev => prev.map(p => p.id === pollId ? { ...p, status: 'active' as const } : p));
    }
  }

  async function handleMakeActivePoll(pollId: string) {
    setPollMenuId(null);
    setPolls(prev => prev.map(p => p.id === pollId ? { ...p, status: 'active' as const } : p));
    try {
      const { poll } = await setPollStatus(tripId, pollId, 'active');
      setPolls(prev => prev.map(p => p.id === pollId ? { ...p, ...poll } : p));
    } catch {
      setPolls(prev => prev.map(p => p.id === pollId ? { ...p, status: 'completed' as const } : p));
    }
  }

  async function handleVote(pollId: string, optionId: string) {
    // Detect whether this click revokes an existing vote (clicking the same option).
    const current = polls.find(p => p.id === pollId);
    const wasMyVote = !!current && (current.myVoteOptionId === optionId
      || current.options.some(o => o.id === optionId && o.votedByMe));
    try {
      const res = await voteOnPoll(tripId, pollId, optionId);
      setPolls(prev => prev.map(p => p.id === pollId ? {
        ...p,
        options: res.poll.options.map(o => ({ id: o.id, text: o.text, voteCount: o.voteCount ?? 0, votedByMe: o.isMyVote ?? o.votedByMe ?? false })),
        myVoteOptionId: res.poll.myVotedOptionId ?? res.poll.myVoteOptionId ?? null,
      } : p));
      Toast.show({ type: 'success', text1: wasMyVote ? 'Vote removed' : 'Vote recorded!' });
    } catch (err) { handleApiError(err); }
  }

  // ── Note handlers (API-backed) ──

  async function handleAddNote() {
    if (!noteTitle.trim()) { showAlert({ title: 'Error', message: 'Please enter a title' }); return; }
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
    setEditLocations(normalizeLocations(trip ?? {}));
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
    if (!editName.trim()) { showAlert({ title: 'Error', message: 'Trip name is required' }); return; }
    if (editLocations.length === 0) { showAlert({ title: 'Error', message: 'Add at least one location' }); return; }
    if (editEndDate < editStartDate) { showAlert({ title: 'Error', message: 'End date must be on or after the start date' }); return; }
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await apiUpdateTrip(tripId, {
        name: editName.trim(),
        locations: toLocationPayload(editLocations),
        startDate: toISODate(editStartDate),
        endDate: toISODate(editEndDate),
      });
      const locationLabel = formatLocationsLabel(editLocations);
      // Refresh local trip state so header/UI reflects changes immediately
      setTrip((prev: any) => ({
        ...prev,
        name: editName.trim(),
        location: locationLabel,
        locations: editLocations,
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

  async function refreshTripMembers() {
    const membersRes = await getTripMembers(tripId);
    const freshUrl = useAuthStore.getState().user?.photoUrl || useAuthStore.getState().user?.avatarUrl || null;
    setMembers(membersRes.members.map((m: TripMember) =>
      m.userId === currentUserId && freshUrl ? { ...m, avatarUrl: freshUrl } : m,
    ));
  }

  async function handleInviteMembers() {
    const friendsToAdd = selectedFriends.length ? selectedFriends : [];
    if (!friendsToAdd.length) {
      showAlert({ title: 'Error', message: 'Select at least one friend to add' });
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await inviteToTrip(tripId, { friendIds: friendsToAdd });
      const addedCount = res.added?.length ?? 0;
      Toast.show({ type: 'success', text1: `${addedCount} member${addedCount === 1 ? '' : 's'} added` });
      await refreshTripMembers();
      setSelectedFriends([]);
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <BlobBackground>
      <SafeAreaView style={styles.container}>

        <AppHeader
          onLogoPress={() => navigation.goBack()}
          onBellPress={() => navigation.navigate('Notifications')}
          onMenuPress={() => { refreshProfile(); setShowProfileMenu(true); }}
        />
        {showProfileMenu && (
          <ProfileDropdown
            user={rawUser}
            firstName={firstName}
            onClose={() => setShowProfileMenu(false)}
            onNavigateToSettings={() => navigation.navigate('Settings')}
            onNavigateToArchived={() => navigation.navigate('Archived')}
            onLogout={() => {
              setShowProfileMenu(false);
              showConfirm({
                title: 'Log out?',
                message: 'Are you sure you want to log out of your account?',
                confirmText: 'Log out',
                destructive: true,
                onConfirm: logout,
              });
            }}
          />
        )}

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>



          <SharedDetailHeroCard
            name={trip?.name ?? 'Trip'}
            dateLine={`${trip?.startDateISO ? (days > 0 ? fmtDateNoYear(trip.startDateISO) : fmtFullDate(trip.startDateISO)) : (trip?.startDate ?? '')}${trip?.endDateISO ? ` — ${days > 0 ? fmtDateNoYear(trip.endDateISO) : fmtFullDate(trip.endDateISO)}` : (trip?.endDate ? ` - ${trip.endDate}` : '')}`}
            location={formatLocationsHeroLabel(trip ?? {})}
            dayCount={days < 0 && Math.abs(days) >= 365 ? Math.round(Math.abs(days) / 365) : Math.abs(days)}
            dayLabel={days > 0 ? 'Days to go' : days <= 0 ? 'Ongoing' : Math.abs(days) >= 365 ? (Math.round(Math.abs(days) / 365) === 1 ? 'Year ago' : 'Years ago') : 'Days ago'}
            statusOnly={days <= 0}
            memberCount={memberCount}
            memberAvatars={members
              .map(m => ({ id: m.userId, uri: m.avatarUrl ?? '' }))
              .filter(m => m.uri)}
            docCount={docs.length > 0 ? docs.length : (apiStats?.docCount ?? 0)}
            photoCount={media.items.length > 0 ? media.items.length : (apiStats?.photoVideoCount ?? 0)}
            totalExpenses={expenseLabel}
            onEdit={openEditTrip}
          />
          {role === 'admin' && (
            <TouchableOpacity
              onPress={() => showConfirm({
                title: 'Delete Trip',
                message: 'This will permanently delete the trip and all its data.',
                destructive: true,
                onConfirm: async () => {
                  try { await apiDeleteTrip(tripId); navigation.goBack(); }
                  catch (err) { handleApiError(err); }
                },
              })}
              style={{ alignSelf: 'flex-end', marginRight: 16, marginBottom: 4, marginTop: -2 }}
              activeOpacity={0.7}>
              <Text style={{ fontSize: 11, color: '#ef4444', fontWeight: '500' }}>Delete Trip</Text>
            </TouchableOpacity>
          )}

          {/* ── Action Buttons ── */}
          <View style={styles.actionsWrap}>
            <View style={styles.actionsRow}>
              {[
                { label: 'Activity', bg: '#E7F8F2', ic: '#0D9488', p: 'plus', fn: () => setShowAddAct(true), count: 0 },
                { label: 'Docs', bg: '#E8F5EE', ic: '#0D9488', p: 'docs', fn: () => setShowDocs(true), count: badgeCounts.docs },
                { label: 'Members', bg: '#F1E8FF', ic: '#8B5CF6', p: 'members', fn: () => setShowMembers(true), count: badgeCounts.members },
                { label: 'Media', bg: '#FFEAF0', ic: '#F43F5E', p: 'photos', fn: () => { setShowPhotos(true); setAlbumDescExpanded(false); }, count: badgeCounts.photos },
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
            <View style={styles.actionsRow}>
              {[
                { label: 'Expenses', bg: '#FFF0DD', ic: '#F59E0B', p: 'expenses', fn: () => setShowExpenses(true), count: badgeCounts.expenses },
                { label: 'Polls', bg: '#E3F4F7', ic: '#0891B2', p: 'polls', fn: () => setShowPolls(true), count: badgeCounts.polls },
                { label: 'Notes', bg: '#E8F7EA', ic: '#10B981', p: 'notes', fn: () => setShowNotes(true), count: badgeCounts.notes },
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
              {/* Invisible spacer to keep alignment under first row */}
              <View style={[styles.actionBtn, { opacity: 0 }]} pointerEvents="none" />
            </View>
          </View>

          {/* ── Upcoming Activities — hidden for past trips ── */}
          {!isPastTrip && <View style={styles.section}>
            <TouchableOpacity style={styles.sectionHeaderRow} onPress={() => setShowUpcoming(p => !p)} activeOpacity={0.7}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Rect x={3} y={4} width={18} height={18} rx={2} stroke="#0d9488" strokeWidth={2} />
                  <Path d="M16 2v4M8 2v4M3 10h18" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={styles.sectionTitleDark}>Upcoming Activities</Text>
              </View>
              {showUpcoming ? <ChevUp /> : <ChevDown />}
            </TouchableOpacity>
            {showUpcoming && (
              !tripDetailReady
                ? (
                  <View style={styles.activitiesLoading}>
                    <ActivityIndicator size="small" color="#0d9488" />
                  </View>
                )
                : upcomingActs.length === 0
                  ? <Text style={styles.emptySub}>No upcoming activities yet</Text>
                  : (
                    <ActivityGroupsList
                      activities={upcomingActs}
                      collapsedDates={collapsedDates}
                      onToggleDate={toggleActivityDate}
                      onActivityPress={startEditActivity}
                      animateKey={activitiesAnimKey}
                      canAnimate={tripDetailReady}
                    />
                  )
            )}
          </View>}

          {/* ── Activities (past trip: flat list) / Completed Activities (active trip: collapsible) ── */}
          {isPastTrip ? (
            <View style={styles.section}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Rect x={3} y={4} width={18} height={18} rx={2} stroke="#0d9488" strokeWidth={2} />
                  <Path d="M16 2v4M8 2v4M3 10h18" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Activities</Text>
              </View>
              {activities.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>No activities</Text>
                  <Text style={styles.emptySub}>No activities were recorded for this trip</Text>
                </View>
              ) : !tripDetailReady ? (
                <View style={styles.activitiesLoading}>
                  <ActivityIndicator size="small" color="#0d9488" />
                </View>
              ) : (
                <ActivityGroupsList
                  activities={activities}
                  collapsedDates={collapsedDates}
                  onToggleDate={toggleActivityDate}
                  onActivityPress={startEditActivity}
                  animateKey={activitiesAnimKey}
                  canAnimate={tripDetailReady}
                />
              )}
            </View>
          ) : (
            <View style={styles.section}>
              <TouchableOpacity style={styles.sectionHeaderRow} onPress={() => setShowCompleted(p => !p)} activeOpacity={0.7}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Rect x={3} y={4} width={18} height={18} rx={2} stroke="#0d9488" strokeWidth={2} />
                    <Path d="M16 2v4M8 2v4M3 10h18" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <Text style={styles.sectionTitleDark}>Completed Activities</Text>
                </View>
                {showCompleted ? <ChevUp /> : <ChevDown />}
              </TouchableOpacity>
              {showCompleted && (
                completed.length === 0
                  ? (
                    <Text style={styles.emptySub}>No completed activities yet</Text>
                  )
                  : !tripDetailReady ? (
                    <View style={styles.activitiesLoading}>
                      <ActivityIndicator size="small" color="#0d9488" />
                    </View>
                  ) : (
                    <ActivityGroupsList
                      activities={completed}
                      collapsedDates={collapsedDates}
                      onToggleDate={toggleActivityDate}
                      onActivityPress={startEditActivity}
                      animateKey={activitiesAnimKey}
                      canAnimate={tripDetailReady}
                      collapseKeyPrefix="completed:"
                    />
                  )
              )}
            </View>
          )}

        </ScrollView>

        <SweeFab
          onPress={() => navigation.navigate('ChatDetail', {
            tripContext: {
              name: trip?.name,
              destination: formatLocationsLabelFull(trip ?? {}),
              startDate: trip?.start_date ? new Date(trip.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : undefined,
              endDate: trip?.end_date ? new Date(trip.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : undefined,
              memberCount: members?.length,
              contextType: 'trip' as const,
            },
          })}
        />

        <FloatingTabBar activeTab="trips" navigation={navigation} />

        {/* ═══════════════════════════════════════════════════
          MODAL 1 — Add Activity
      ═══════════════════════════════════════════════════ */}
        <AppModal visible={showAddAct} transparent animationType="fade" onRequestClose={() => { resetActForm(); setShowAddAct(false); }}>
          <View style={styles.overlay}>
            <View style={styles.dialog}>
              {editingActivityId ? (
                <View style={styles.dHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dTitle}>View Activity</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => { resetActForm(); setShowAddAct(false); handleDeleteActivity(editingActivityId); }}
                    style={[styles.dCloseBtn, { marginRight: 4 }]}
                    activeOpacity={0.7}
                  >
                    <TrashIcon color="#ef4444" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { resetActForm(); setShowAddAct(false); }} style={styles.dCloseBtn} activeOpacity={0.7}>
                    <CloseX />
                  </TouchableOpacity>
                </View>
              ) : (
                <DHeader title="Activity" onClose={() => { resetActForm(); setShowAddAct(false); }} />
              )}
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always">
                <View style={styles.dBody}>

                  <Text style={styles.fLabel}>Title</Text>
                  <TextInput style={styles.fInput} placeholder="e.g., Visit Eiffel Tower" placeholderTextColor="#94a3b8" value={actTitle} onChangeText={setActTitle} autoFocus />

                  {/* Date + Time */}
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
                    <View style={{ flex: 3 }}>
                      <Text style={styles.fLabel}>Date</Text>
                      <AppDatePicker
                        mode="trip"
                        value={actDate ? `${actDate.getFullYear()}-${String(actDate.getMonth() + 1).padStart(2, '0')}-${String(actDate.getDate()).padStart(2, '0')}` : ''}
                        onChange={(iso) => {
                          const [y, m, d] = iso.split('-').map(n => parseInt(n, 10));
                          setActDate(new Date(y, m - 1, d));
                          setActDateError('');
                        }}
                        placeholder="Select date"
                        error={actDateError || null}
                        title="Activity date"
                      />
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
                            {actHour !== '' ? String(actHour).padStart(2, '0') : 'HH'}
                          </Text>
                        </TouchableOpacity>
                        <Text style={{ fontSize: 15, fontWeight: '500', color: '#94a3b8' }}>:</Text>
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
                            {actMin !== '' ? String(actMin).padStart(2, '0') : 'MM'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <Text style={styles.fLabel}>Location (Optional)</Text>
                  <View style={{ zIndex: 10 }}>
                    <LocationAutocomplete
                      initialValue={actLocation}
                      onChangeText={setActLocation}
                      placeholder="e.g., Champ de Mars, Paris"
                      variant="edit"
                    />
                  </View>

                  <Text style={styles.fLabel}>Description (Optional)</Text>
                  <TextInput style={[styles.fInput, { height: 76, textAlignVertical: 'top', paddingTop: 10 }]} placeholder="Add any additional details..." placeholderTextColor="#94a3b8" value={actDesc} onChangeText={setActDesc} multiline />

                  <View style={styles.actExtraRow}>
                    <Text style={styles.actExtraLabel}>{actPhotoUi.label}</Text>
                    {actPhotoUi.canAdd && (
                      <TouchableOpacity
                        onPress={() => {
                          launchImageLibrary(
                            { mediaType: 'photo', selectionLimit: actPhotoUi.selectionLimit },
                            (res) => {
                              if (res.didCancel || res.errorCode) return;
                              const uris = (res.assets || []).map((a) => a.uri || '').filter(Boolean);
                              if (!uris.length) return;
                              setActNewPhotos((p) => {
                                const cap = activityPhotoCap ?? Number.MAX_SAFE_INTEGER;
                                const room = cap - actExistingPhotos.length - p.length;
                                return [...p, ...uris.slice(0, Math.max(0, room))];
                              });
                            },
                          );
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.actExtraBtn}>
                          + Add{actPhotoUi.remaining > 0 ? ` (${actPhotoUi.remaining} left)` : ''}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {actPhotosLoading && (
                    <ActivityIndicator size="small" color="#0d9488" style={{ marginBottom: 8 }} />
                  )}
                  {(actExistingPhotos.length > 0 || actNewPhotos.length > 0) && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                      {actExistingPhotos.map((photo) => (
                        <View key={photo.id} style={{ position: 'relative' }}>
                          <CachedImage uri={photo.uri} style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: '#e2e8f0' }} resizeMode="cover" />
                          {editingActivityId && (
                            <TouchableOpacity
                              onPress={() => handleRemoveExistingActPhoto(photo.id)}
                              style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' }}
                              activeOpacity={0.7}
                            >
                              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>×</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      ))}
                      {actNewPhotos.map((uri, i) => (
                        <View key={`new-${uri}-${i}`} style={{ position: 'relative' }}>
                          <CachedImage uri={uri} style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: '#e2e8f0' }} resizeMode="cover" />
                          <TouchableOpacity
                            onPress={() => setActNewPhotos((p) => p.filter((_, j) => j !== i))}
                            style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' }}
                            activeOpacity={0.7}
                          >
                            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>×</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                  <View style={styles.actExtraRow}>
                    <Text style={styles.actExtraLabel}>Expenses</Text>
                    {!actExpConfirmed && (
                      <TouchableOpacity onPress={() => setShowActExp(true)} activeOpacity={0.7}>
                        <Text style={styles.actExtraBtn}>+ Add Expense</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {actExpConfirmed && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf9', borderRadius: 8, padding: 10, marginTop: 4, borderWidth: 1, borderColor: '#ccfbf1' }}>
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <ExpenseCategoryIcon category={actExpCategory.slug} size={16} />
                        <Text style={{ fontSize: 13, color: '#0f172a', flex: 1 }} numberOfLines={1}>{actExpDesc} · {actExpCurrency} {actExpAmount}</Text>
                      </View>
                      <TouchableOpacity onPress={() => setShowActExp(true)} activeOpacity={0.7} style={{ marginRight: 10 }}>
                        <Text style={{ fontSize: 12, color: '#0d9488', fontWeight: '500' }}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => { setActExpConfirmed(false); setActExpDesc(''); setActExpAmount(''); setActExpCategory(EXPENSE_CATEGORY_OPTIONS[0]); setActExpPaidBy('You'); setActExpSplitType('equally'); setActExpSplitAmong(['You']); setActExpSplitDetails({}); }} activeOpacity={0.7}>
                        <Text style={{ fontSize: 12, color: '#ef4444', fontWeight: '500' }}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </ScrollView>
              <View style={styles.dFooterSingle}>
                {editingActivityId ? (
                  <TouchableOpacity style={styles.tealBtnFull} onPress={handleAddActivity} activeOpacity={0.85}>
                    <Text style={styles.tealBtnTxt}>Update</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.tealBtnFull} onPress={handleAddActivity} activeOpacity={0.85}>
                    <Text style={styles.tealBtnTxt}>Save</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </AppModal>

        {/* Hour dropdown overlay */}
        <AppModal visible={showHourDrop} transparent animationType="none" onRequestClose={() => setShowHourDrop(false)}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowHourDrop(false)}>
            <View style={{ position: 'absolute', top: hourDropPos.y, left: hourDropPos.x, width: Math.max(hourDropPos.w, 72), backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', elevation: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 8, overflow: 'hidden', maxHeight: 200 }}>
              <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
                {Array.from({ length: 24 }, (_, i) => i).map(h => (
                  <TouchableOpacity key={h}
                    style={{ paddingVertical: 11, alignItems: 'center', backgroundColor: String(h) === String(actHour) ? '#f0fdfa' : '#fff' }}
                    onPress={() => { setActHour(String(h)); setShowHourDrop(false); }}
                    activeOpacity={0.7}>
                    <Text style={{ fontSize: 14, color: String(h) === String(actHour) ? '#0d9488' : '#334155', fontWeight: String(h) === String(actHour) ? '600' : '400' }}>
                      {String(h).padStart(2, '0')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </AppModal>

        {/* Minute dropdown overlay */}
        <AppModal visible={showMinDrop} transparent animationType="none" onRequestClose={() => setShowMinDrop(false)}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowMinDrop(false)}>
            <View style={{ position: 'absolute', top: minDropPos.y, left: minDropPos.x, width: Math.max(minDropPos.w, 72), backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', elevation: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 8, overflow: 'hidden' }}>
              {['00', '15', '30', '45'].map(m => (
                <TouchableOpacity key={m}
                  style={{ paddingVertical: 13, alignItems: 'center', backgroundColor: m === String(actMin).padStart(2, '0') ? '#f0fdfa' : '#fff' }}
                  onPress={() => { setActMin(m); setShowMinDrop(false); }}
                  activeOpacity={0.7}>
                  <Text style={{ fontSize: 14, color: m === String(actMin).padStart(2, '0') ? '#0d9488' : '#334155', fontWeight: m === String(actMin).padStart(2, '0') ? '600' : '400' }}>
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </AppModal>

        {/* ═══════════════════════════════════════════════════
          MODAL — Activity Expense Form
      ═══════════════════════════════════════════════════ */}
        <AppModal visible={showActExp} transparent animationType="fade" onRequestClose={() => setShowActExp(false)}>
          <View style={styles.overlay}>
            <View style={styles.dialog}>
              <DHeader title="Add Expense" subtitle="Link an expense to this activity." onClose={() => setShowActExp(false)} />
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
                <View style={styles.dBody}>
                  <Text style={styles.expFieldLabel}>Description</Text>
                  <TextInput style={styles.fInput} placeholder="e.g., Dinner at restaurant" placeholderTextColor="#94a3b8" value={actExpDesc} onChangeText={setActExpDesc} />
                  <Text style={styles.expFieldLabel}>Amount</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput style={[styles.fInput, { flex: 1 }]} placeholder="0.00" placeholderTextColor="#94a3b8" value={actExpAmount} onChangeText={setActExpAmount} keyboardType="numeric" />
                    <TouchableOpacity style={[styles.fInputTouch, { minWidth: 64, justifyContent: 'center' }]} onPress={() => { setShowActExpCurrencyDrop(p => !p); setShowActExpCatDrop(false); setShowActExpPaidByDrop(false); }} activeOpacity={0.8}>
                      <Text style={{ fontSize: 13, color: '#0f172a', fontWeight: '400' }}>{actExpCurrency}</Text>
                    </TouchableOpacity>
                  </View>
                  <CurrencyPickerDropdown
                    visible={showActExpCurrencyDrop}
                    selectedCode={actExpCurrency}
                    onSelect={code => { setActExpCurrency(code); setShowActExpCurrencyDrop(false); }}
                    style={styles.dropdown}
                    itemStyle={styles.dropdownItem}
                  />
                  <Text style={styles.expFieldLabel}>Category</Text>
                  <TouchableOpacity style={[styles.fInputTouch, { justifyContent: 'center' }]} onPress={() => { setShowActExpCatDrop(p => !p); setShowActExpCurrencyDrop(false); setShowActExpPaidByDrop(false); }} activeOpacity={0.8}>
                    <ExpenseCatRow cat={actExpCategory} />
                  </TouchableOpacity>
                  {showActExpCatDrop && (
                    <View style={styles.dropdown}>
                      {EXPENSE_CATEGORY_OPTIONS.map(c => (
                        <TouchableOpacity key={c.label} style={styles.dropdownItem} onPress={() => { setActExpCategory(c); setShowActExpCatDrop(false); }} activeOpacity={0.7}>
                          <ExpenseCatRow cat={c} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  <Text style={styles.expFieldLabel}>Paid by</Text>
                  <TouchableOpacity style={styles.fInputTouch} onPress={() => { setShowActExpPaidByDrop(p => !p); setShowActExpCurrencyDrop(false); setShowActExpCatDrop(false); }} activeOpacity={0.8}>
                    <Text style={{ fontSize: 13, color: '#0f172a' }}>{actExpPaidBy}</Text>
                  </TouchableOpacity>
                  {showActExpPaidByDrop && (
                    <View style={styles.dropdown}>
                      {['You', ...members.filter(m => m.userId !== currentUserId).map(m => m.fullName || (m as any).name || 'Member')].map(name => (
                        <TouchableOpacity key={name} style={styles.dropdownItem} onPress={() => { setActExpPaidBy(name); setShowActExpPaidByDrop(false); }} activeOpacity={0.7}>
                          <Text style={{ fontSize: 13, color: '#0f172a' }}>{name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  <Text style={styles.expFieldLabel}>Split type</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
                    {(['equally', 'amount', 'percent'] as const).map((key, i) => (
                      <TouchableOpacity key={key} onPress={() => setActExpSplitType(key)} style={[styles.splitTypeBtn, actExpSplitType === key && styles.splitTypeBtnActive]} activeOpacity={0.8}>
                        <Text style={[styles.splitTypeTxt, actExpSplitType === key && styles.splitTypeTxtActive]}>{['Equally', 'By Amount', 'By %'][i]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.expFieldLabel}>Split among</Text>
                  <TouchableOpacity style={[styles.splitRow, actExpSplitAmong.includes('You') && styles.splitRowActive]} onPress={() => setActExpSplitAmong(p => p.includes('You') ? p.filter(x => x !== 'You') : [...p, 'You'])} activeOpacity={0.8}>
                    <View style={[styles.splitCheck, actExpSplitAmong.includes('You') && styles.splitCheckActive]}>
                      {actExpSplitAmong.includes('You') && <CheckIcon />}
                    </View>
                    <Text style={{ fontSize: 13, color: '#0f172a', flex: 1, marginLeft: 8 }}>You</Text>
                    {actExpSplitType !== 'equally' && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        {actExpSplitType === 'amount' && <Text style={{ fontSize: 12, color: '#64748b' }}>{actExpCurrency}</Text>}
                        <TextInput style={[styles.fInput, { width: 62, marginBottom: 0, paddingVertical: 6, textAlign: 'right' }]} placeholder="0" placeholderTextColor="#94a3b8" keyboardType="numeric" value={actExpSplitDetails['You'] || ''} onChangeText={v => setActExpSplitDetails(p => ({ ...p, You: v }))} />
                        {actExpSplitType === 'percent' && <Text style={{ fontSize: 12, color: '#64748b' }}>%</Text>}
                      </View>
                    )}
                  </TouchableOpacity>
                  {members.filter(m => m.userId !== currentUserId).map(m => (
                    <TouchableOpacity key={m.userId} style={[styles.splitRow, actExpSplitAmong.includes(m.userId) && styles.splitRowActive]} onPress={() => setActExpSplitAmong(p => p.includes(m.userId) ? p.filter(x => x !== m.userId) : [...p, m.userId])} activeOpacity={0.8}>
                      <View style={[styles.splitCheck, actExpSplitAmong.includes(m.userId) && styles.splitCheckActive]}>
                        {actExpSplitAmong.includes(m.userId) && <CheckIcon />}
                      </View>
                      <Text style={{ fontSize: 13, color: '#0f172a', flex: 1, marginLeft: 8 }}>{m.fullName || (m as any).name || 'Member'}</Text>
                      {actExpSplitType !== 'equally' && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                          {actExpSplitType === 'amount' && <Text style={{ fontSize: 12, color: '#64748b' }}>{actExpCurrency}</Text>}
                          <TextInput style={[styles.fInput, { width: 62, marginBottom: 0, paddingVertical: 6, textAlign: 'right' }]} placeholder="0" placeholderTextColor="#94a3b8" keyboardType="numeric" value={actExpSplitDetails[m.userId] || ''} onChangeText={v => setActExpSplitDetails(p => ({ ...p, [m.userId]: v }))} />
                          {actExpSplitType === 'percent' && <Text style={{ fontSize: 12, color: '#64748b' }}>%</Text>}
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => {
                      setShowActExp(false);
                      if (!actExpConfirmed) {
                        setActExpDesc(''); setActExpAmount(''); setActExpCategory(EXPENSE_CATEGORY_OPTIONS[0]);
                        setActExpPaidBy('You'); setActExpSplitType('equally'); setActExpSplitAmong(['You']); setActExpSplitDetails({});
                      }
                    }} activeOpacity={0.7}>
                      <Text style={styles.cancelTxt}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.tealBtnFull, { flex: 1 }]} onPress={() => {
                      if (actExpDesc.trim() && actExpAmount) {
                        setActExpConfirmed(true);
                        setShowActExp(false);
                      } else {
                        showAlert({ title: 'Error', message: 'Enter description and amount' });
                      }
                    }} activeOpacity={0.85}>
                      <Text style={styles.tealBtnTxt}>Confirm</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </AppModal>

        {/* ═══════════════════════════════════════════════════
          MODAL 2 — Documents
      ═══════════════════════════════════════════════════ */}
        <AppModal visible={showDocs} transparent animationType="fade" onRequestClose={() => setShowDocs(false)}>
          <View style={styles.overlay}>
            <View style={styles.dialog}>
              <DHeader title="Documents" subtitle="Store and share important trip documents with your group." onClose={() => setShowDocs(false)} />
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.dBody}>
                  {/* Upload section */}
                  <View style={[styles.docSectionDivider, { marginTop: 0 }]}>
                    <View style={styles.docDividerLine} />
                    <Text style={styles.docDividerLabel}>UPLOAD DOCUMENTS</Text>
                    <View style={styles.docDividerLine} />
                  </View>
                  <UploadOptionsRow
                    onUpload={handleUploadDoc}
                    onCamera={handleCameraDoc}
                    onDrive={() => openDrivePicker('docs')}
                    showDrive={true}
                    uploading={uploadPending}
                  />

                  {/* Email import section */}
                  <View style={styles.docSectionDivider}>
                    <View style={styles.docDividerLine} />
                    <Text style={styles.docDividerLabel}>IMPORT FROM EMAIL</Text>
                    <View style={styles.docDividerLine} />
                  </View>
                  <EmailOptionsRow
                    onGmail={() => openEmailPicker('gmail')}
                    onOutlook={() => openEmailPicker('outlook')}
                  />

                  {/* Documents list */}
                  <View style={styles.docSectionDivider}>
                    <View style={styles.docDividerLine} />
                    <Text style={styles.docDividerLabel}>
                      {docs.length > 0 ? `UPLOADED DOCUMENTS (${docs.length})` : 'UPLOADED DOCUMENTS'}
                    </Text>
                    <View style={styles.docDividerLine} />
                  </View>

                  {docs.length === 0 && !uploadPending ? (
                    <View style={styles.emptyCenter}>
                      <Svg width={52} height={52} viewBox="0 0 24 24" fill="none">
                        <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#cbd5e1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                        <Path d="M14 2v6h6M16 13H8M16 17H8" stroke="#cbd5e1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                      <Text style={styles.emptyTitle}>No documents yet</Text>
                      <Text style={styles.emptySub}>Upload important documents for your trip</Text>
                    </View>
                  ) : (
                    <View>
                      {docs.map((doc, idx) => {
                        const uploaderObj = typeof doc.uploadedBy === 'object' && doc.uploadedBy !== null ? doc.uploadedBy : null;
                        const uploaderId = uploaderObj ? (uploaderObj as any).userId : doc.uploadedBy;
                        const canEdit = role === 'admin' || uploaderId === currentUserId;
                        const isDeleting = deletingDocIds.has(doc.id);
                        const isLast = idx === docs.length - 1 && !uploadPending;
                        return isDeleting ? (
                          <View key={doc.id} style={!isLast ? styles.docRow : undefined}>
                            <DocItemSkeleton />
                          </View>
                        ) : (
                          <TouchableOpacity
                            key={doc.id}
                            activeOpacity={0.7}
                            onPress={() => doc.uri ? setDocPreviewUrl(doc.uri) : showAlert({ title: 'Error', message: 'Document URL not available.' })}
                            style={!isLast ? styles.docRow : undefined}
                          >
                            <DocumentItem
                              doc={{
                                id: doc.id,
                                fileName: doc.name,
                                mimeType: doc.mimeType,
                                fileSizeBytes: doc.fileSizeBytes,
                                createdAt: doc.createdAt,
                                uploadedBy: doc.uploadedBy ?? '',
                              }}
                              canEdit={canEdit}
                              onEdit={() => { setRenameTarget(doc); setRenameText(doc.name); }}
                              onDelete={() => showConfirm({
                                title: 'Remove document?',
                                message: `Remove "${doc.name}" from this trip?`,
                                destructive: true,
                                confirmText: 'Remove',
                                onConfirm: async () => { await handleDeleteDoc(doc.id, doc.uploadedBy ?? ''); },
                              })}
                            />
                          </TouchableOpacity>
                        );
                      })}
                      {uploadPending && (
                        <View style={styles.docRow}>
                          <DocItemSkeleton />
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        </AppModal>

        {/* ═══════════════════════════════════════════════════
          MODAL 2-rename — Rename Document
      ═══════════════════════════════════════════════════ */}
        <AppModal visible={renameTarget !== null} transparent animationType="slide" onRequestClose={() => setRenameTarget(null)}>
          <View style={styles.overlay}>
            <View style={[styles.dialog, { paddingBottom: 8 }]}>
              <DHeader title="Edit Document" onClose={() => setRenameTarget(null)} />
              <View style={[styles.dBody, { gap: 16 }]}>
                <TextInput
                  value={renameText}
                  onChangeText={setRenameText}
                  style={styles.fInput}
                  placeholder="Document name"
                  placeholderTextColor="#94a3b8"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleRenameDoc}
                />
                <TouchableOpacity
                  style={[styles.tealBtnFull, renameLoading && { opacity: 0.6 }]}
                  onPress={handleRenameDoc}
                  disabled={renameLoading || !renameText.trim()}
                  activeOpacity={0.85}
                >
                  {renameLoading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.tealBtnTxt}>Save</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </AppModal>

        {/* ═══════════════════════════════════════════════════
          MODAL 2b — Email Attachment Picker
      ═══════════════════════════════════════════════════ */}
        <AppModal visible={showEmailPicker} transparent animationType="slide" onRequestClose={() => setShowEmailPicker(false)}>
          <View style={styles.overlay}>
            <View style={styles.dialog}>
              <DHeader
                title={`Import from ${emailProviderLabel(emailPickerProvider)}`}
                leading={<EmailProviderIcon provider={emailPickerProvider} size={22} />}
                onClose={() => setShowEmailPicker(false)}
              />
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
                          {sel && <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>✓</Text>}
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
                      : <Text style={styles.tealBtnTxt}>Import</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </AppModal>

        {/* ═══════════════════════════════════════════════════
          MODAL 2c — Google Drive File Picker
      ═══════════════════════════════════════════════════ */}
        <AppModal visible={showDrivePicker} transparent animationType="slide" onRequestClose={() => setShowDrivePicker(false)}>
          <View style={styles.overlay}>
            <View style={styles.dialog}>
              <DHeader
                title={drivePickerTarget === 'photos' ? 'Import photos from Google Drive' : 'Import from Google Drive'}
                leading={<DriveBrandIcon size={22} />}
                onClose={() => setShowDrivePicker(false)}
              />
              {drivePickerLoading ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="#0d9488" />
                  <Text style={{ marginTop: 12, color: '#64748b', fontSize: 13 }}>Loading files…</Text>
                </View>
              ) : driveFiles.length === 0 ? (
                <View style={{ padding: 32, alignItems: 'center' }}>
                  <Text style={{ color: '#64748b', fontSize: 14, textAlign: 'center' }}>
                    {drivePickerTarget === 'photos'
                      ? 'No photos found in your Drive root.'
                      : 'No compatible files found in your Drive root.'}
                  </Text>
                </View>
              ) : drivePickerTarget === 'photos' ? (
                <DrivePhotoPickerGrid
                  files={driveFiles}
                  selectedIds={selectedDriveFileIds}
                  maxSelectable={drivePhotoSelectLimit}
                  onToggle={(fileId) => setSelectedDriveFileIds((prev) => (
                    toggleDriveFileSelection(prev, fileId, drivePhotoSelectLimit)
                  ))}
                />
              ) : (
                <FlatList
                  data={driveFiles}
                  keyExtractor={f => f.fileId}
                  style={{ maxHeight: 380 }}
                  renderItem={({ item }) => (
                    <DrivePickerRow
                      file={item}
                      selected={selectedDriveFileIds.has(item.fileId)}
                      onToggle={() => setSelectedDriveFileIds((prev) => {
                        const n = new Set(prev);
                        if (n.has(item.fileId)) n.delete(item.fileId);
                        else n.add(item.fileId);
                        return n;
                      })}
                    />
                  )}
                />
              )}
              {!drivePickerLoading && driveFiles.length > 0 && (
                <View style={{ padding: 16, borderTopWidth: 0.5, borderColor: '#e2e8f0' }}>
                  <TouchableOpacity
                    style={[styles.tealBtnFull, { opacity: selectedDriveFileIds.size === 0 ? 0.5 : 1 }]}
                    onPress={confirmDriveImport}
                    disabled={selectedDriveFileIds.size === 0 || driveImporting}
                    activeOpacity={0.85}>
                    {driveImporting
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.tealBtnTxt}>
                          {selectedDriveFileIds.size > 0 ? `Import (${selectedDriveFileIds.size})` : 'Import'}
                        </Text>}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </AppModal>

        {/* ═══════════════════════════════════════════════════
          MODAL 3 — Members
      ═══════════════════════════════════════════════════ */}
        <AppModal visible={showMembers} transparent animationType="fade" onRequestClose={() => setShowMembers(false)}>
          <View style={styles.overlay}>
            <View style={styles.dialog}>
              <DHeader title="Trip Members" subtitle={`Current members: ${memberCount}`} onClose={() => setShowMembers(false)} />
              <TabBar tabs={['Members', 'Invite Friends', 'Invite New']} active={memberTab} onSelect={t => setMemberTab(t as any)} />
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {memberTab === 'Members' && (
                  <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 20 }}>
                    <Text style={styles.memberSectionLabel}>Current Members</Text>
                    {members.length === 0 ? (
                      <Text style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, marginTop: 16 }}>No members yet.</Text>
                    ) : members.map(m => (
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
                          <Text style={styles.memberName}>{m.fullName || (m as any).name || 'Member'}{m.userId === currentUserId ? ' (You)' : ''}</Text>
                        </View>
                        {m.role === 'admin'
                          ? <View style={styles.ownerBadge}><Text style={styles.ownerTxt}>Admin</Text></View>
                          : role === 'admin' && m.userId !== currentUserId
                            ? <TouchableOpacity onPress={() => {
                              showConfirm({
                                title: 'Remove member?',
                                message: `Remove ${m.fullName || (m as any).name || 'Member'} from this trip?`,
                                destructive: true,
                                confirmText: 'Remove',
                                onConfirm: async () => {
                                  try { await removeTripMember(tripId, m.userId); setMembers(p => p.filter(x => x.userId !== m.userId)); } catch (e) { handleApiError(e); }
                                },
                              });
                            }} activeOpacity={0.7}><Text style={{ color: '#ef4444', fontSize: 12 }}>Remove</Text></TouchableOpacity>
                            : null}
                      </View>
                    ))}
                  </View>
                )}

                {memberTab === 'Invite Friends' && (
                  <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20 }}>
                    <Text style={styles.memberSectionLabelTitle}>Invite Friends</Text>
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
                          <FriendAvatar uri={f.avatar} name={f.name} style={styles.memberAvatar as any} />
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
                  <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 20 }}>
                    <InviteViaChannels
                      variant="trip"
                      tripId={tripId}
                      tripName={trip?.name}
                      onComplete={() => { refreshTripMembers().catch(() => {}); }}
                    />
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </AppModal>

        {/* ═══════════════════════════════════════════════════
          MODAL 4 — Media
      ═══════════════════════════════════════════════════ */}
        <MediaModuleDialog
          visible={showPhotos}
          onClose={closePhotosModal}
          mode="trip"
          loading={isLoadingPhotos && media.items.length === 0}
          uploading={media.uploading}
          driveImporting={driveImporting}
          uploadDisabled={media.uploadDisabled}
          capTotal={media.capTotal}
          mediaCount={media.mediaCount}
          cellSize={media.cellSize}
          bannerImageUrl={media.bannerImageUrl}
          tripLevelItems={media.tripLevelItems}
          activitySections={media.activitySections}
          previewItem={media.previewItem}
          deletingId={media.deletingId}
          settingBanner={media.settingBanner}
          onUpload={() => media.handlePick(false)}
          onCamera={() => media.handlePick(true)}
          onDrive={() => openDrivePicker('photos')}
          onPressItem={(item) => media.setPreviewItem(item)}
          onDeleteItem={(item) => media.handleDelete(item.id)}
          onReorderTripLevel={media.handleReorderTripLevel}
          onReorderActivity={media.handleReorderActivity}
          onClosePreview={() => media.setPreviewItem(null)}
          onSetBanner={media.handleSetBanner}
          deleteMessage="Remove this media for everyone on this trip?"
        />

        {/* Document preview modal — in-app WebView */}
        <AppModal visible={!!docPreviewUrl} transparent={false} animationType="slide" onRequestClose={() => setDocPreviewUrl(null)}>
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
        </AppModal>

        {/* ═══════════════════════════════════════════════════
          MODAL — Settle Debt
      ═══════════════════════════════════════════════════ */}
        <AppModal visible={showSettleModal} transparent animationType="fade" onRequestClose={() => setShowSettleModal(false)}>
          <View style={styles.overlay}>
            <View style={[styles.dialog, { paddingBottom: 4 }]}>
              <DHeader
                title="Settle Up"
                subtitle={settleTarget ? `You owe ${settleTarget.toName}` : undefined}
                onClose={() => setShowSettleModal(false)}
              />
              <View style={styles.dBody}>
                {settleTarget && (
                  <>
                    <View style={{ backgroundColor: '#f0fdf9', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#ccfbf1' }}>
                      <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 2 }}>Total outstanding</Text>
                      <Text style={{ fontSize: 20, fontWeight: '600', color: '#0f172a' }}>
                        {formatCurrencyFull(settleTarget.maxAmount, settleTarget.currency)}
                      </Text>
                    </View>
                    <Text style={styles.expFieldLabel}>Amount to settle now</Text>
                    <TextInput
                      style={styles.fInput}
                      placeholder="0.00"
                      placeholderTextColor="#94a3b8"
                      value={settleInputAmount}
                      onChangeText={setSettleInputAmount}
                      keyboardType="decimal-pad"
                      autoFocus
                    />
                    <TouchableOpacity
                      style={{ marginTop: 6, marginBottom: 16, alignSelf: 'flex-start' }}
                      onPress={() => setSettleInputAmount(String(settleTarget.maxAmount))}
                      activeOpacity={0.7}>
                      <Text style={{ fontSize: 12, color: '#0d9488', fontWeight: '500' }}>
                        Settle in full ({formatCurrencyFull(settleTarget.maxAmount, settleTarget.currency)})
                      </Text>
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 8 }}>
                      <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowSettleModal(false)} activeOpacity={0.7}>
                        <Text style={styles.cancelTxt}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.tealBtnFull, { flex: 1, opacity: settlingDebtKey ? 0.6 : 1 }]}
                        onPress={handleConfirmSettle}
                        disabled={!!settlingDebtKey}
                        activeOpacity={0.85}>
                        <Text style={styles.tealBtnTxt}>Confirm Settlement</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>
          </View>
        </AppModal>

        {/* ═══════════════════════════════════════════════════
          MODAL 5 — Expenses
      ═══════════════════════════════════════════════════ */}
        <AppModal visible={showExpenses} transparent animationType="fade" onRequestClose={closeExpensesModal}>
          <View style={styles.overlay}>
            <View style={[styles.dialog, styles.expensesDialog]}>
              <DHeader title="Expenses" onClose={closeExpensesModal} />
              <TabBar tabs={['Expense', 'Total', 'Balance']} active={expTab} onSelect={t => handleExpenseTabSelect(t as 'Expense' | 'Total' | 'Balance')} />
              <ScrollView
                style={styles.expensesDialogScroll}
                contentContainerStyle={styles.expensesDialogScrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled">

                {expTab === 'Expense' && (
                  <View>
                    {expenseTabBusy ? (
                      <ExpenseListSkeleton />
                    ) : (
                      <>
                    <TouchableOpacity style={styles.tealBtnFull} disabled={isSubmitting} onPress={() => {
                      if (showAddExpense) {
                        dismissExpenseOverlays();
                        return;
                      }
                      const allIds = ['You', ...members.filter(m => m.userId !== currentUserId).map(m => m.userId)];
                      setExpSplitAmong(allIds);
                      setExpPaidBy('You');
                      setExpDesc(''); setExpAmount(''); setExpSplitType('equally'); setExpSplitDetails({});
                      setShowExpCurrencyDrop(false);
                      setShowExpCatDrop(false);
                      setShowPaidByDrop(false);
                      setShowAddExpense(true);
                    }} activeOpacity={0.85}>
                      <Text style={styles.tealBtnTxt}>+ Add Expense</Text>
                    </TouchableOpacity>

                    {showAddExpense && (
                      <View style={{ marginTop: 14 }}>
                        <Text style={styles.expFieldLabel}>Description</Text>
                        <TextInput style={styles.fInput} placeholder="e.g., Dinner at restaurant" placeholderTextColor="#94a3b8" value={expDesc} onChangeText={setExpDesc} />
                        <Text style={styles.expFieldLabel}>Amount</Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TextInput style={[styles.fInput, { flex: 1 }]} placeholder="0.00" placeholderTextColor="#94a3b8" value={expAmount} onChangeText={setExpAmount} keyboardType="numeric" />
                          <TouchableOpacity style={[styles.fInputTouch, { minWidth: 64, justifyContent: 'center' }]} onPress={() => { setShowExpCurrencyDrop(p => !p); setShowExpCatDrop(false); setShowPaidByDrop(false); }} activeOpacity={0.8}>
                            <Text style={{ fontSize: 13, color: '#0f172a', fontWeight: '400' }}>{expCurrency}</Text>
                          </TouchableOpacity>
                        </View>
                        <CurrencyPickerDropdown
                          visible={showExpCurrencyDrop}
                          selectedCode={expCurrency}
                          onSelect={code => { setExpCurrency(code); setShowExpCurrencyDrop(false); }}
                          style={styles.dropdown}
                          itemStyle={styles.dropdownItem}
                        />
                        <Text style={styles.expFieldLabel}>Category</Text>
                        <TouchableOpacity style={[styles.fInputTouch, { justifyContent: 'center' }]} onPress={() => { setShowExpCatDrop(p => !p); setShowExpCurrencyDrop(false); setShowPaidByDrop(false); }} activeOpacity={0.8}>
                          <ExpenseCatRow cat={expCategory} />
                        </TouchableOpacity>
                        {showExpCatDrop && (
                          <View style={styles.dropdown}>
                            {EXPENSE_CATEGORY_OPTIONS.map(c => (
                              <TouchableOpacity key={c.label} style={styles.dropdownItem} onPress={() => { setExpCategory(c); setShowExpCatDrop(false); }} activeOpacity={0.7}>
                                <ExpenseCatRow cat={c} />
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                        <Text style={styles.expFieldLabel}>Paid by</Text>
                        <TouchableOpacity style={styles.fInputTouch} onPress={() => { setShowPaidByDrop(p => !p); setShowExpCurrencyDrop(false); setShowExpCatDrop(false); }} activeOpacity={0.8}>
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
                        <Text style={styles.expFieldLabel}>Split type</Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
                          {(['equally', 'amount', 'percent'] as const).map((key, i) => (
                            <TouchableOpacity key={key} onPress={() => setExpSplitType(key)} style={[styles.splitTypeBtn, expSplitType === key && styles.splitTypeBtnActive]} activeOpacity={0.8}>
                              <Text style={[styles.splitTypeTxt, expSplitType === key && styles.splitTypeTxtActive]}>{['Equally', 'By Amount', 'By %'][i]}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <Text style={styles.expFieldLabel}>Split among</Text>
                        <TouchableOpacity style={[styles.splitRow, expSplitAmong.includes('You') && styles.splitRowActive]} onPress={() => setExpSplitAmong(p => p.includes('You') ? p.filter(x => x !== 'You') : [...p, 'You'])} activeOpacity={0.8}>
                          <View style={[styles.splitCheck, expSplitAmong.includes('You') && styles.splitCheckActive]}>
                            {expSplitAmong.includes('You') && <CheckIcon />}
                          </View>
                          <Text style={{ fontSize: 13, color: '#0f172a', flex: 1, marginLeft: 8 }}>You</Text>
                          {expSplitType !== 'equally' && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                              {expSplitType === 'amount' && <Text style={{ fontSize: 12, color: '#64748b' }}>{expCurrency}</Text>}
                              <TextInput
                                style={[styles.fInput, { width: 62, marginBottom: 0, paddingVertical: 6, textAlign: 'right' }]}
                                placeholder="0"
                                placeholderTextColor="#94a3b8"
                                keyboardType="numeric"
                                value={expSplitDetails['You'] || ''}
                                onChangeText={v => setExpSplitDetails(p => ({ ...p, You: v }))}
                              />
                              {expSplitType === 'percent' && <Text style={{ fontSize: 12, color: '#64748b' }}>%</Text>}
                            </View>
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
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                {expSplitType === 'amount' && <Text style={{ fontSize: 12, color: '#64748b' }}>{expCurrency}</Text>}
                                <TextInput
                                  style={[styles.fInput, { width: 62, marginBottom: 0, paddingVertical: 6, textAlign: 'right' }]}
                                  placeholder="0"
                                  placeholderTextColor="#94a3b8"
                                  keyboardType="numeric"
                                  value={expSplitDetails[m.userId] || ''}
                                  onChangeText={v => setExpSplitDetails(p => ({ ...p, [m.userId]: v }))}
                                />
                                {expSplitType === 'percent' && <Text style={{ fontSize: 12, color: '#64748b' }}>%</Text>}
                              </View>
                            )}
                          </TouchableOpacity>
                        ))}
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                          <TouchableOpacity style={styles.cancelBtn} onPress={dismissExpenseOverlays} activeOpacity={0.7} disabled={isSubmitting}><Text style={styles.cancelTxt}>Cancel</Text></TouchableOpacity>
                          <TouchableOpacity style={[styles.tealBtnFull, { flex: 1, opacity: isSubmitting ? 0.6 : 1 }]} onPress={handleAddExpense} disabled={isSubmitting} activeOpacity={0.85}>
                            <Text style={styles.tealBtnTxt}>
                              {isSubmitting ? (editingExpenseId ? 'Updating…' : 'Adding…') : (editingExpenseId ? 'Update Expense' : 'Add Expense')}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    {expenses.length === 0 && !showAddExpense ? (
                      <View style={styles.emptyCenter}>
                        <Svg width={52} height={52} viewBox="0 0 24 24" fill="none">
                          <Path d="M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6" stroke="#cbd5e1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                        <Text style={styles.emptyTitle}>No expenses yet</Text>
                        <Text style={styles.emptySub}>Add your first expense to start splitting costs</Text>
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
                            const balanceLabel = getExpenseRowBalanceLabel(exp);
                            return (
                              <View key={exp.id} style={styles.expRow}>
                                <View style={styles.expIconBox}><ExpenseCategoryIcon category={exp.category} size={20} /></View>
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                  <Text style={styles.expName}>{exp.description}</Text>
                                  <Text style={styles.expMeta}>Paid by {exp.paidBy}</Text>
                                  <Text style={styles.expMeta}>{exp.date}</Text>
                                  <Text style={styles.expMeta}>Split {exp.splitType} • {exp.splitAmong.length} person</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                  <Text
                                    style={styles.expAmt}
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                    minimumFontScale={0.8}>
                                    {formatCurrencyFull(exp.amount, exp.currency)}
                                  </Text>
                                  {balanceLabel && (
                                    <Text style={{ fontSize: 11, color: balanceLabel.color, marginBottom: 6 }}>{balanceLabel.text}</Text>
                                  )}
                                  <View style={{ flexDirection: 'row', gap: 12, marginTop: balanceLabel ? 0 : 6 }}>
                                    <TouchableOpacity onPress={() => startEditExpense(exp)} activeOpacity={0.7}><Text style={styles.expActionEdit}>Edit</Text></TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleDeleteExpense(exp.id)} activeOpacity={0.7}><Text style={styles.expActionDelete}>Delete</Text></TouchableOpacity>
                                  </View>
                                </View>
                              </View>
                            );
                          };

                          return (
                            <>
                              {Object.values(actExpGroups).map((group, idx) => (
                                <View key={idx}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 4, borderLeftWidth: 3, borderLeftColor: '#0d9488', paddingLeft: 8 }}>
                                    <Text style={{ fontSize: 12, fontWeight: '500', color: '#0d9488', flex: 1 }}>{group.title}</Text>
                                    <Text style={{ fontSize: 11, color: '#94a3b8' }}>{group.items.length} expense{group.items.length !== 1 ? 's' : ''}</Text>
                                  </View>
                                  {group.items.map(renderExpRow)}
                                </View>
                              ))}
                              {directExpenses.length > 0 && (
                                <View>
                                  {hasGroups && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 4, borderLeftWidth: 3, borderLeftColor: '#94a3b8', paddingLeft: 8 }}>
                                      <Text style={{ fontSize: 12, fontWeight: '500', color: '#64748b', flex: 1 }}>Other Expenses</Text>
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
                      </>
                    )}
                  </View>
                )}

                {expTab === 'Total' && (
                  <View>
                    {expenseTabBusy ? <TotalTabSkeleton /> : (
                      <ExpenseTotalsTab
                        totals={expenseTotals}
                        styles={{
                          emptyCenter: styles.emptyCenter,
                          emptyTitle: styles.emptyTitle,
                          emptySub: styles.emptySub,
                          balCard: styles.balCard,
                          balLabel: styles.balLabel,
                          balValue: styles.balValue,
                          expRow: styles.expRow,
                          expName: styles.expName,
                          expMeta: styles.expMeta,
                          expAmt: styles.expAmt,
                        }}
                      />
                    )}
                  </View>
                )}

                {expTab === 'Balance' && (
                  <View>
                    {expenseTabBusy ? <BalanceTabSkeleton /> : (
                      <>
                        <ExpenseBalanceSummary
                          totalExpensesByCurrency={totalExpensesByCurrency}
                          myBalances={myBalances}
                        />
                        {balances.length === 0 ? (
                          hasRecordedGroupExpenses(totalExpensesByCurrency) || expenses.length > 0 ? (
                            <View style={styles.emptyCenter}>
                              <Svg width={52} height={52} viewBox="0 0 24 24" fill="none">
                                <Path d="M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6" stroke="#cbd5e1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                              </Svg>
                              <Text style={styles.emptyTitle}>All settled up!</Text>
                              <Text style={styles.emptySub}>No one owes anyone right now</Text>
                            </View>
                          ) : null
                        ) : (
                          <OutstandingDebtsList
                            debts={balances}
                            currentUserId={currentUserId}
                            onSettle={handleSettleDebt}
                            settlingDebtKey={settlingDebtKey}
                            styles={{
                              expRow: styles.expRow,
                              expName: styles.expName,
                              expMeta: styles.expMeta,
                              tealBtnFull: styles.tealBtnFull,
                              tealBtnTxt: styles.tealBtnTxt,
                            }}
                          />
                        )}
                      </>
                    )}
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </AppModal>

        {/* ═══════════════════════════════════════════════════
          MODAL 6 — Polls
      ═══════════════════════════════════════════════════ */}
        <AppModal visible={showPolls} transparent animationType="fade" onRequestClose={() => { setShowPolls(false); setPollMenuId(null); }}>
          <Toast />
          <View style={styles.overlay}>
            <View style={styles.dialog}>
              <DHeader title="Polls" subtitle="Create polls, see what others think, and decide together." onClose={() => { setShowPolls(false); setPollMenuId(null); }} />
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Pressable style={styles.dBody} onPress={() => setPollMenuId(null)}>

                  <TouchableOpacity style={styles.tealBtnFull} onPress={() => setShowPollForm(true)} activeOpacity={0.85}>
                    <Text style={styles.tealBtnTxt}>Create Poll</Text>
                  </TouchableOpacity>

                  {/* ── Skeleton loading ── */}
                  {isLoadingPolls && <PollSkeleton />}

                  {/* ── Active Polls ── */}
                  {(() => {
                    const activePolls = polls.filter(p => (p.status ?? 'active') === 'active');
                    if (activePolls.length === 0) return null;
                    return (
                      <View style={{ marginTop: 20 }}>
                        <Text style={styles.pollSectionLabel}>Active Polls</Text>
                        {activePolls.map(poll => {
                          const totalVotes = poll.options.reduce((s, o) => s + o.voteCount, 0);
                          const menuOpen = pollMenuId === poll.id;
                          const voterAvatars = [...members].reverse().slice(0, Math.min(totalVotes, 5));
                          const extra = totalVotes > 5 ? totalVotes - 5 : 0;
                          return (
                            <View key={poll.id} style={styles.pollCard}>
                              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
                                <Text style={[styles.pollQ, { flex: 1, marginRight: 8 }]}>{poll.question}</Text>
                                <View>
                                  <TouchableOpacity onPress={() => setPollMenuId(menuOpen ? null : poll.id)} activeOpacity={0.7} style={{ padding: 4 }} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                                    <Text style={{ fontSize: 20, color: '#94a3b8', lineHeight: 20, letterSpacing: 1 }}>···</Text>
                                  </TouchableOpacity>
                                  {menuOpen && (
                                    <View style={styles.pollMenu}>
                                      <TouchableOpacity style={styles.pollMenuItem} onPress={() => handleCompletePoll(poll.id)} activeOpacity={0.8}>
                                        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"><Path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /><Path d="M22 4L12 14.01l-3-3" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
                                        <Text style={[styles.pollMenuTxt, { color: '#0d9488' }]}>Complete</Text>
                                      </TouchableOpacity>
                                      <View style={styles.pollMenuDivider} />
                                      <TouchableOpacity style={styles.pollMenuItem} onPress={() => handleDeletePoll(poll.id)} activeOpacity={0.8}>
                                        <TrashIcon color="#ef4444" size={14} />
                                        <Text style={[styles.pollMenuTxt, { color: '#ef4444' }]}>Delete</Text>
                                      </TouchableOpacity>
                                    </View>
                                  )}
                                </View>
                              </View>
                              {poll.options.map(opt => {
                                const pct = totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 100) : 0;
                                const isMyVote = opt.votedByMe || poll.myVoteOptionId === opt.id;
                                return (
                                  <PollOptionItem
                                    key={opt.id}
                                    text={opt.text}
                                    voteCount={opt.voteCount}
                                    pct={pct}
                                    isMyVote={isMyVote}
                                    isCompleted={false}
                                    onPress={() => handleVote(poll.id, opt.id)}
                                  />
                                );
                              })}
                              {totalVotes > 0 && (
                                <View style={styles.pollFooter}>
                                  <View style={styles.pollAvatarRow}>
                                    {voterAvatars.map((m, idx) => (
                                      m.avatarUrl
                                        ? <CachedImage key={m.userId} uri={m.avatarUrl} style={[styles.pollAvatar, { marginLeft: idx > 0 ? -8 : 0 }] as any} resizeMode="cover" priority="normal" />
                                        : <View key={m.userId} style={[styles.pollAvatar, styles.pollAvatarPlaceholder, { marginLeft: idx > 0 ? -8 : 0 }]}><Text style={styles.pollAvatarInitial}>{(m.fullName?.[0] || '?').toUpperCase()}</Text></View>
                                    ))}
                                    {extra > 0 && <View style={[styles.pollAvatar, styles.pollAvatarMore, { marginLeft: -8 }]}><Text style={styles.pollAvatarMoreTxt}>+{extra}</Text></View>}
                                  </View>
                                  <Text style={styles.pollTotalVotes}>{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}</Text>
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    );
                  })()}

                  {/* ── Completed Polls ── */}
                  {(() => {
                    const completedPolls = polls.filter(p => p.status === 'completed');
                    if (completedPolls.length === 0) return null;
                    return (
                      <View style={{ marginTop: 20 }}>
                        <Text style={styles.pollSectionLabel}>Completed Polls</Text>
                        {completedPolls.map(poll => {
                          const totalVotes = poll.options.reduce((s, o) => s + o.voteCount, 0);
                          const menuOpen = pollMenuId === poll.id;
                          const voterAvatars = [...members].reverse().slice(0, Math.min(totalVotes, 5));
                          const extra = totalVotes > 5 ? totalVotes - 5 : 0;
                          return (
                            <View key={poll.id} style={[styles.pollCard, { backgroundColor: '#f8fafc' }]}>
                              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
                                <Text style={[styles.pollQ, { flex: 1, marginRight: 8 }]}>{poll.question}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                  <View style={styles.pollCompletedBadge}><Text style={styles.pollCompletedTxt}>Completed</Text></View>
                                  <View>
                                    <TouchableOpacity onPress={() => setPollMenuId(menuOpen ? null : poll.id)} activeOpacity={0.7} style={{ padding: 4 }} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                                      <Text style={{ fontSize: 20, color: '#94a3b8', lineHeight: 20, letterSpacing: 1 }}>···</Text>
                                    </TouchableOpacity>
                                    {menuOpen && (
                                      <View style={styles.pollMenu}>
                                        <TouchableOpacity style={styles.pollMenuItem} onPress={() => handleMakeActivePoll(poll.id)} activeOpacity={0.8}>
                                          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none"><Path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
                                          <Text style={[styles.pollMenuTxt, { color: '#0d9488' }]}>Make Active</Text>
                                        </TouchableOpacity>
                                        <View style={styles.pollMenuDivider} />
                                        <TouchableOpacity style={styles.pollMenuItem} onPress={() => handleDeletePoll(poll.id)} activeOpacity={0.8}>
                                          <TrashIcon color="#ef4444" size={14} />
                                          <Text style={[styles.pollMenuTxt, { color: '#ef4444' }]}>Delete</Text>
                                        </TouchableOpacity>
                                      </View>
                                    )}
                                  </View>
                                </View>
                              </View>
                              {poll.options.map(opt => {
                                const pct = totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 100) : 0;
                                const isMyVote = opt.votedByMe || poll.myVoteOptionId === opt.id;
                                return (
                                  <PollOptionItem
                                    key={opt.id}
                                    text={opt.text}
                                    voteCount={opt.voteCount}
                                    pct={pct}
                                    isMyVote={isMyVote}
                                    isCompleted={true}
                                    disabled={true}
                                  />
                                );
                              })}
                              {totalVotes > 0 && (
                                <View style={styles.pollFooter}>
                                  <View style={styles.pollAvatarRow}>
                                    {voterAvatars.map((m, idx) => (
                                      m.avatarUrl
                                        ? <CachedImage key={m.userId} uri={m.avatarUrl} style={[styles.pollAvatar, { marginLeft: idx > 0 ? -8 : 0 }] as any} resizeMode="cover" priority="normal" />
                                        : <View key={m.userId} style={[styles.pollAvatar, styles.pollAvatarPlaceholder, { marginLeft: idx > 0 ? -8 : 0 }]}><Text style={styles.pollAvatarInitial}>{(m.fullName?.[0] || '?').toUpperCase()}</Text></View>
                                    ))}
                                    {extra > 0 && <View style={[styles.pollAvatar, styles.pollAvatarMore, { marginLeft: -8 }]}><Text style={styles.pollAvatarMoreTxt}>+{extra}</Text></View>}
                                  </View>
                                  <Text style={styles.pollTotalVotes}>{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}</Text>
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    );
                  })()}

                  {!isLoadingPolls && polls.length === 0 && (
                    <View style={styles.emptyCenter}>
                      <Text style={styles.emptyTitle}>No polls yet</Text>
                      <Text style={styles.emptySub}>Create the first poll above</Text>
                    </View>
                  )}
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </AppModal>

        {/* ── Create Poll sub-modal ── */}
        <AppModal visible={showPollForm} transparent animationType="slide" onRequestClose={() => { setShowPollForm(false); setPollQuestion(''); setPollOptions(['', '']); }}>
          <View style={styles.overlay}>
            <View style={styles.dialog}>
              <DHeader title="Create Poll" onClose={() => { setShowPollForm(false); setPollQuestion(''); setPollOptions(['', '']); }} />
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
                  <TouchableOpacity onPress={() => setPollOptions(p => [...p, ''])} activeOpacity={0.7} style={{ marginTop: 2, marginBottom: 16 }}>
                    <Text style={{ fontSize: 13, color: '#0d9488', fontWeight: '500' }}>+ Add Option</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.tealBtnFull} onPress={handleCreatePoll} activeOpacity={0.85}>
                    <Text style={styles.tealBtnTxt}>Submit Poll</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </AppModal>

        {/* ═══════════════════════════════════════════════════
          MODAL 7 — Notes
      ═══════════════════════════════════════════════════ */}
        <AppModal visible={showNotes} transparent animationType="fade" onRequestClose={() => setShowNotes(false)}>
          <View style={styles.overlay}>
            <View style={styles.dialog}>
              <DHeader title="Notes" onClose={() => setShowNotes(false)} />
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={styles.dBody}>
                  <TextInput style={styles.fInput} placeholder="Subject" placeholderTextColor="#94a3b8" value={noteTitle} onChangeText={setNoteTitle} />
                  <TextInput style={[styles.fInput, { height: 90, textAlignVertical: 'top', paddingTop: 10, marginTop: 8 }]} placeholder="Type or paste your note here..." placeholderTextColor="#94a3b8" value={noteBody} onChangeText={setNoteBody} multiline />
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, alignItems: 'center' }}>
                    <TouchableOpacity style={[styles.catBtn, { justifyContent: 'center', width: 120 }]} onPress={() => setShowNoteCatDrop(p => !p)} activeOpacity={0.8}>
                      <NoteCatRow cat={noteCatDisplay} />
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
                      {NOTE_CATEGORY_OPTIONS.map(c => (
                        <TouchableOpacity key={c.key} style={styles.dropdownItem} onPress={() => { setNoteCategory(c.key as any); setShowNoteCatDrop(false); }} activeOpacity={0.7}>
                          <NoteCatRow cat={c} />
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
                        const cat = NOTE_CATEGORY_OPTIONS.find(c => c.key === note.category)!;
                        return (
                          <TouchableOpacity
                            key={note.id}
                            activeOpacity={0.85}
                            onPress={() => setViewingNote(note)}
                            style={[styles.noteCard, note.pinned && { backgroundColor: '#fefce8', borderColor: '#fde68a' }]}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                              {(() => {
                                const cb = (note as any).createdBy;
                                const name = cb ? (typeof cb === 'string' ? cb : (cb.name ?? cb.username ?? '')) : '';
                                const creatorId = cb && typeof cb === 'object' ? String(cb.userId ?? cb.id ?? '') : (typeof cb === 'string' ? cb : '');
                                const avatarUri = (cb && typeof cb === 'object' ? (cb.avatarUrl ?? cb.avatar ?? null) : null)
                                  ?? members.find(m => m.userId === creatorId)?.avatarUrl
                                  ?? null;
                                const initial = name ? name[0].toUpperCase() : '?';
                                return avatarUri ? (
                                  <CachedImage uri={avatarUri} style={{ width: 38, height: 38, borderRadius: 19 } as any} resizeMode="cover" priority="normal" />
                                ) : (
                                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#f0fdf9', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#0d9488' }}>{initial}</Text>
                                  </View>
                                );
                              })()}
                              {/* Title + category */}
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.noteTitle, { fontSize: 14 }]} numberOfLines={1}>{note.title}</Text>
                                <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                                  {cat?.label ?? note.category}{note.date ? ` • ${note.date}` : ''}
                                </Text>
                              </View>
                              {/* Star only */}
                              <TouchableOpacity
                                onPress={async () => {
                                  try {
                                    const favRes = await favoriteNote(tripId, note.id);
                                    const newPinned = favRes?.isFavorited ?? !note.pinned;
                                    setNotes(p => p.map(n => n.id === note.id ? { ...n, pinned: newPinned } : n));
                                  } catch (err) { handleApiError(err); }
                                }}
                                activeOpacity={0.7}
                                style={{ padding: 6 }}
                              >
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
        </AppModal>

        {/* ═══════════════════════════════════════════════════
          MODAL 7b — Note Detail View
        ═══════════════════════════════════════════════════ */}
        <AppModal visible={!!viewingNote} transparent animationType="slide" onRequestClose={() => setViewingNote(null)}>
          <View style={styles.overlay}>
            <View style={styles.dialog}>
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                <TouchableOpacity onPress={() => setViewingNote(null)} activeOpacity={0.7} style={{ marginRight: 10 }}>
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                    <Path d="M19 12H5M12 19l-7-7 7-7" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </TouchableOpacity>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: '#0f172a' }} numberOfLines={1}>{viewingNote?.title}</Text>
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
                  onPress={() => {
                    if (!viewingNote) return;
                    showConfirm({
                      title: 'Delete note?',
                      message: 'This note will be permanently deleted.',
                      destructive: true,
                      onConfirm: async () => {
                        try {
                          await handleDeleteNote(viewingNote.id);
                        } finally {
                          setViewingNote(null);
                        }
                      },
                    });
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
                  const cat = NOTE_CATEGORY_OPTIONS.find(c => c.key === viewingNote.category)!;
                  return (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                      <View style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#f0fdf9', borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <NoteCategoryIcon categoryKey={cat.key} size={14} />
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
        </AppModal>

        {/* ═══════════════════════════════════════════════════
          MODAL 8 — Edit Trip
      ═══════════════════════════════════════════════════ */}
        <AppModal visible={showEditTrip} transparent animationType="fade" onRequestClose={() => setShowEditTrip(false)}>
          <View style={styles.overlay}>
            <View style={styles.dialog}>
              <DHeader title="Edit Trip" onClose={() => setShowEditTrip(false)} />
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always">
                <View style={styles.dBody}>
                  <Text style={styles.fLabel}>Trip Name</Text>
                  <TextInput style={styles.fInput} placeholder="e.g., Tokyo Getaway" placeholderTextColor="#94a3b8" value={editName} onChangeText={setEditName} />
                  <Text style={styles.fLabel}>Start Date</Text>
                  <AppDatePicker
                    mode="trip"
                    value={`${editStartDate.getFullYear()}-${String(editStartDate.getMonth() + 1).padStart(2, '0')}-${String(editStartDate.getDate()).padStart(2, '0')}`}
                    onChange={(iso) => {
                      const [y, m, d] = iso.split('-').map(n => parseInt(n, 10));
                      setEditStartDate(new Date(y, m - 1, d));
                      setEditStartDateError(null);
                    }}
                    error={editStartDateError}
                    title="Edit start date"
                  />
                  <Text style={styles.fLabel}>End Date</Text>
                  <AppDatePicker
                    mode="trip"
                    minDate={editStartDate}
                    value={`${editEndDate.getFullYear()}-${String(editEndDate.getMonth() + 1).padStart(2, '0')}-${String(editEndDate.getDate()).padStart(2, '0')}`}
                    onChange={(iso) => {
                      const [y, m, d] = iso.split('-').map(n => parseInt(n, 10));
                      setEditEndDate(new Date(y, m - 1, d));
                      setEditEndDateError(null);
                    }}
                    error={editEndDateError}
                    title="Edit end date"
                  />
                  <Text style={styles.fLabel}>Locations</Text>
                  <View style={{ zIndex: 10 }}>
                    <LocationMultiPicker
                      value={editLocations}
                      onChange={setEditLocations}
                      placeholder="Search and add destination..."
                      variant="edit"
                    />
                  </View>
                </View>
              </ScrollView>
              <View style={styles.dFooterRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowEditTrip(false)} activeOpacity={0.7}><Text style={styles.cancelTxt}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.tealBtnFull, { flex: 1 }, isSubmitting && { opacity: 0.6 }]} onPress={handleSaveTrip} disabled={isSubmitting} activeOpacity={0.85}><Text style={styles.tealBtnTxt}>{isSubmitting ? 'Saving...' : 'Save Changes'}</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </AppModal>

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

  // Header card
  headerCard: { marginHorizontal: 16, marginBottom: 6, borderRadius: 20, borderWidth: 2, borderColor: '#99f6e4', padding: 16 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  tripName: { fontSize: 20, fontWeight: '500', color: '#0f172a', marginBottom: 3 },
  tripDates: { fontSize: 13, color: '#475569', marginBottom: 2 },
  tripLocation: { fontSize: 13, color: '#64748b' },
  daysArea: { alignItems: 'flex-end', paddingLeft: 8 },
  daysNumber: { fontSize: 40, fontWeight: '500', color: '#0f172a', lineHeight: 44 },
  daysLabel: { fontSize: 11, color: '#64748b', fontWeight: '500', textAlign: 'right' },
  pencilBtn: { marginTop: 4, marginLeft: 4, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#99f6e4' },

  statsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  statTxt: { fontSize: 12, fontWeight: '500', color: '#0f172a' },

  // Actions
  actionsWrap: { paddingHorizontal: 20, paddingVertical: 16, gap: 16, marginBottom: 6 },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  actionBtn: { alignItems: 'center', width: 62, gap: 4 },
  actionCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
  actionLabel: { fontSize: 13, fontWeight: '500', color: '#0f172a', textAlign: 'center', lineHeight: 16 },
  cardBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#ffffff', paddingHorizontal: 3, zIndex: 10 },
  cardBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '600', lineHeight: 13 },

  // Sections
  section: { paddingHorizontal: 16, marginTop: 20, marginBottom: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '500', color: '#0f172a', marginBottom: 12 },
  sectionTitleDark: { fontSize: 15, fontWeight: '500', color: '#0f172a' },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },

  emptyBox: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: '#e2e8f0', paddingVertical: 32, paddingHorizontal: 20, alignItems: 'center' },
  emptyCompletedActivities: { backgroundColor: 'transparent', borderWidth: 0, paddingVertical: 16, paddingHorizontal: 12, alignItems: 'center' },
  emptyCenter: { alignItems: 'center', paddingVertical: 28 },
  emptyTitle: { fontSize: 13, color: '#64748b', fontWeight: '400', marginTop: 10, textAlign: 'center' },
  emptySub: { fontSize: 12, color: '#94a3b8', marginTop: 4, textAlign: 'center' },

  actRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#f1f5f9' },
  actTitle: { fontSize: 12, fontWeight: '400', color: '#0f172a', marginBottom: 2 },
  actMeta: { fontSize: 11, color: '#94a3b8' },
  activitiesLoading: { paddingVertical: 28, alignItems: 'center', justifyContent: 'center' },
  actDateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 4, marginBottom: 2 },
  actDateLabel: { fontSize: 13, fontWeight: '500', color: '#334155' },
  actItemsWrap: { marginLeft: 14, marginTop: 2, paddingBottom: 4 },
  actItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingLeft: 4, paddingRight: 4, borderWidth: 1, borderColor: 'transparent', borderRadius: 10, backgroundColor: 'transparent', gap: 8, marginBottom: 2 },
  actItemLine: { fontSize: 12, fontWeight: '400', color: '#0f172a' },
  actTimeLabel: { minWidth: 44 },
  actItemTitle: { flex: 1 },
  doneBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#f0fdfa', marginLeft: 8 },
  doneTxt: { fontSize: 12, color: '#0d9488', fontWeight: '500' },
  trashBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },

  // Modal base
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.52)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  dialog: { backgroundColor: '#fff', borderRadius: 20, width: '100%', maxHeight: '82%', overflow: 'hidden' },
  expensesDialog: {
    height: EXPENSES_MODAL_HEIGHT,
    maxHeight: '92%',
  },
  expensesDialogScroll: {
    flex: 1,
    minHeight: 0,
  },
  expensesDialogScrollContent: {
    padding: 16,
    flexGrow: 1,
  },

  // Dialog header
  dHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dTitle: { fontSize: 14, fontWeight: '500', color: '#0f172a' },
  dSubtitle: { fontSize: 10, color: '#64748b', marginTop: 1 },
  dCloseBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },

  dBody: { padding: 16 },
  dFooterSingle: { padding: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  dFooterRow: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' },

  // Form fields
  fLabel: { fontSize: 12, fontWeight: '500', color: '#374151', marginBottom: 6, marginTop: 10 },
  expFieldLabel: { ...typography.expFieldLabel, color: '#374151', marginBottom: 6, marginTop: 10 },
  expActionEdit: { ...typography.expAction, color: '#0d9488' },
  expActionDelete: { ...typography.expAction, color: '#ef4444' },
  fInput: { backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#0f172a' },
  fInputTouch: { backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11 },

  // Teal buttons
  tealBtnFull: { flexDirection: 'row', backgroundColor: '#0d9488', borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  tealBtnTxt: { color: '#fff', fontWeight: '500', fontSize: 13},
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  cancelTxt: { fontSize: 12, color: '#64748b', fontWeight: '500' },

  // Tabs
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tab: { flex: 1, paddingVertical: 11, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#0d9488' },
  tabTxt: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  tabTxtActive: { color: '#0d9488', fontWeight: '500' },

  // Activity extra rows
  actExtraRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', marginTop: 4 },
  actExtraLabel: { fontSize: 12, color: '#0f172a', fontWeight: '500' },
  actExtraBtn: { fontSize: 12, color: '#0d9488', fontWeight: '500' },

  // Documents
  docSubtitle: { fontSize: 13, color: '#64748b', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 2 },
  docRow: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f1f5f9' },
  docSectionDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 8 },
  docDividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#e2e8f0' },
  docDividerLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8', letterSpacing: 0.5 },

  // Members
  memberSectionLabel: { fontSize: 12, fontWeight: '500', color: '#64748b', marginBottom: 10 },
  memberSectionLabelTitle: { fontSize: 12, fontWeight: '500', color: '#64748b', marginBottom: 6 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  memberAvatar: { width: 40, height: 40, borderRadius: 20 },
  memberName: { fontSize: 12, fontWeight: '500', color: '#0f172a' },
  memberEmail: { fontSize: 11, color: '#64748b', marginTop: 1 },
  ownerBadge: { backgroundColor: '#f0fdfa', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#99f6e4' },
  ownerTxt: { fontSize: 11, color: '#0d9488', fontWeight: '500' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 10, gap: 8 },
  searchInput: { flex: 1, fontSize: 12, color: '#0f172a' },
  checkCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#0d9488', alignItems: 'center', justifyContent: 'center' },
  inviteIconBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  inviteIconBtnActive: { borderColor: '#0d9488', backgroundColor: '#0d9488' },
  sendBtn: { backgroundColor: '#0d9488', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },

  // Expenses
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

  // Balances
  balCard: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, alignItems: 'center' },
  balLabel: { fontSize: 11, color: '#64748b', fontWeight: '500', marginBottom: 4 },
  balValue: { ...typography.expTotalValue, color: '#0f172a' },

  // Polls
  pollSectionLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  pollCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  pollQ: { fontSize: 14, fontWeight: '500', color: '#0f172a', lineHeight: 20 },
  pollMeta: { fontSize: 11, color: '#64748b', fontWeight: '400', marginBottom: 10 },
  pollFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e2e8f0' },
  pollAvatarRow: { flexDirection: 'row', alignItems: 'center' },
  pollAvatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#fff' },
  pollAvatarPlaceholder: { backgroundColor: '#f0fdf9', alignItems: 'center' as const, justifyContent: 'center' as const },
  pollAvatarMore: { backgroundColor: '#e2e8f0', alignItems: 'center' as const, justifyContent: 'center' as const },
  pollAvatarInitial: { fontSize: 11, fontWeight: '600', color: '#0d9488' },
  pollAvatarMoreTxt: { fontSize: 10, fontWeight: '600', color: '#64748b' },
  pollTotalVotes: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  pollCompletedBadge: { backgroundColor: '#f0fdfa', borderWidth: 1, borderColor: '#0d9488', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  pollCompletedTxt: { fontSize: 11, fontWeight: '600', color: '#0d9488' },
  pollMenu: { position: 'absolute', right: 0, top: 26, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 12, zIndex: 100, minWidth: 148 },
  pollMenuItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  pollMenuTxt: { fontSize: 13, fontWeight: '500', color: '#0f172a' },
  pollMenuDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#e2e8f0' },

  // Notes
  noteCard: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  noteTitle: { fontSize: 12, fontWeight: '500', color: '#0d9488', flex: 1 },
  noteBody: { fontSize: 11, color: '#64748b', lineHeight: 18 },
  noteLink: { color: '#0d9488', textDecorationLine: 'underline' },
  catBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
});