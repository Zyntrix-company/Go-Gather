import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  Modal, TextInput, Platform,
} from 'react-native';
import Svg, { Rect, Path, Circle } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import BlobBackground from '../../components/common/BlobBackground';
import colors from '../../theme/colors';
import { PinIcon, PencilIcon } from '../../components/common/Icons';

// ─── Types ────────────────────────────────────────────────────────────────────

type EventItem = {
  id: string;
  name: string;
  type: string;
  typeColor: string;
  location: string;
  dateISO: string;     // "YYYY-MM-DD"
  dateDisplay: string; // "10 Apr 2026"
  memberCount: number;
  description: string;
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

const CT_FRIENDS: { id: string; name: string; uri: string }[] = [
  { id: '1', name: 'Yuki Tanaka',      uri: 'https://i.pravatar.cc/150?img=32' },
  { id: '2', name: 'Amara Okafor',     uri: 'https://i.pravatar.cc/150?img=38' },
  { id: '3', name: 'Marcus Johnson',   uri: 'https://i.pravatar.cc/150?img=13' },
  { id: '4', name: 'Priya Sharma',     uri: 'https://i.pravatar.cc/150?img=45' },
  { id: '5', name: 'Carlos Rodriguez', uri: 'https://i.pravatar.cc/150?img=12' },
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

function fmtDateISO(d: Date): string {
  return d.toISOString().split('T')[0];
}

// ─── Compact Event List Card (teal gradient, mirrors DetailHeroCard) ──────────

function EventListCard({
  event,
  onPress,
  onEdit,
}: {
  event: EventItem;
  onPress: () => void;
  onEdit: () => void;
}) {
  const days = daysUntil(event.dateISO);
  const dayLabel = days > 0 ? 'DAYS TO GO' : days === 0 ? 'TODAY' : 'DAYS AGO';
  const dayCount = Math.abs(days);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={styles.cardWrap}>
      <LinearGradient
        colors={['#ccfbf1', '#cffafe']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        {/* Type badge */}
        <View style={[styles.typeBadge, { backgroundColor: TYPE_COLORS[event.type] ?? '#f8fafc' }]}>
          <Text style={styles.typeBadgeText}>{event.type.toUpperCase()}</Text>
        </View>

        {/* Name row */}
        <View style={styles.heroRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName} numberOfLines={2}>{event.name}</Text>
            <Text style={styles.heroDate}>{event.dateDisplay}</Text>
            <View style={styles.heroLocRow}>
              <PinIcon color={colors.textSecondary} size={13} />
              <Text style={styles.heroLoc} numberOfLines={1}>{event.location}</Text>
            </View>
          </View>

          <View style={styles.daysBadge}>
            <Text style={styles.daysNum}>{dayCount}</Text>
            <Text style={styles.daysLabel}>{dayLabel}</Text>
          </View>

          <TouchableOpacity style={styles.editBtn} onPress={onEdit} activeOpacity={0.7}>
            <PencilIcon color={colors.accent} size={14} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z" stroke={colors.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.statText}>{event.memberCount} member{event.memberCount !== 1 ? 's' : ''}</Text>
        </View>
        <View style={styles.statDiv} />
        <View style={styles.statItem}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={colors.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M14 2v6h6" stroke={colors.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.statText}>0 docs</Text>
        </View>
        <View style={styles.statDiv} />
        <View style={styles.statItem}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Rect x={3} y={3} width={18} height={18} rx={2} stroke={colors.accent} strokeWidth={1.8} />
            <Circle cx={8.5} cy={8.5} r={1.5} fill={colors.accent} />
            <Path d="M21 15l-5-5L5 21" stroke={colors.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.statText}>0 photos</Text>
        </View>
        <View style={styles.statDiv} />
        <View style={styles.statItem}>
          <Text style={[styles.statText, { fontWeight: '700' }]}>₹</Text>
          <Text style={styles.statText}>₹0</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Create Event Modal ───────────────────────────────────────────────────────

function CreateEventModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (ev: EventItem) => void;
}) {
  const [name, setName]             = useState('');
  const [type, setType]             = useState('Other');
  const [showTypeDrop, setShowTypeDrop] = useState(false);
  const [dateObj, setDateObj]       = useState<Date | undefined>(undefined);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [location, setLocation]     = useState('');
  const [invitedIds, setInvitedIds] = useState<string[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [friendSearch, setFriendSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function reset() {
    setName(''); setType('Other'); setShowTypeDrop(false);
    setDateObj(undefined); setShowDatePicker(false);
    setLocation(''); setInvitedIds([]); setShowInvite(false);
    setFriendSearch('');
  }

  function handleSave() {
    if (!name.trim()) { Alert.alert('Error', 'Please enter an event name'); return; }
    if (!dateObj)     { Alert.alert('Error', 'Please select an event date'); return; }
    if (!location.trim()) { Alert.alert('Error', 'Please enter a location'); return; }
    setIsSubmitting(true);
    const newEvent: EventItem = {
      id:          `ev_${Date.now()}`,
      name:        name.trim(),
      type,
      typeColor:   TYPE_COLORS[type] ?? '#f8fafc',
      location:    location.trim(),
      dateISO:     fmtDateISO(dateObj),
      dateDisplay: fmtDateDisplay(dateObj),
      memberCount: 1 + invitedIds.length,
      description: '',
    };
    onSave(newEvent);
    reset();
    setIsSubmitting(false);
    onClose();
  }

  const filteredFriends = CT_FRIENDS.filter(f =>
    f.name.toLowerCase().includes(friendSearch.toLowerCase())
  );

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

          {/* Scrollable fields */}
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
            <TouchableOpacity
              style={[modal.input, modal.row]}
              onPress={() => setShowTypeDrop(p => !p)}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 14, color: '#0f172a', flex: 1 }}>{type}</Text>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d={showTypeDrop ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
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
            <TouchableOpacity
              style={[modal.input, modal.row]}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.8}
            >
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

            {/* Location */}
            <Text style={modal.label}>Location</Text>
            <View style={modal.inputWrap}>
              <TextInput
                style={[modal.input, { paddingRight: 36 }]}
                placeholder="Search location"
                placeholderTextColor="#94a3b8"
                value={location}
                onChangeText={setLocation}
              />
              <View style={modal.inputIcon}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke="#94a3b8" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  <Circle cx={12} cy={10} r={3} stroke="#94a3b8" strokeWidth={1.8} />
                </Svg>
              </View>
            </View>

            {/* Upload Docs */}
            <TouchableOpacity
              style={modal.actionRow}
              activeOpacity={0.8}
              onPress={() => Alert.alert('Upload Docs', 'Document picker requires a native build.')}
            >
              <View style={modal.actionIcon}>
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                  <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <Text style={modal.actionText}>Upload Docs</Text>
              <Text style={modal.actionHint}>(PDF, JPG, PNG)</Text>
            </TouchableOpacity>

            {/* Extract from Email */}
            <TouchableOpacity
              style={modal.actionRow}
              activeOpacity={0.8}
              onPress={() => Alert.alert('Extract Docs from Email', 'Connect your Gmail or Outlook to extract attachments automatically.')}
            >
              <View style={modal.actionIcon}>
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                  <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M22 6l-10 7L2 6" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <Text style={modal.actionText}>Extract Docs from Email</Text>
            </TouchableOpacity>

            {/* Invite Group Members */}
            <TouchableOpacity
              style={modal.actionRow}
              activeOpacity={0.8}
              onPress={() => setShowInvite(true)}
            >
              <View style={modal.actionIcon}>
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                  <Path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M13 7a4 4 0 100 8 4 4 0 000-8z" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M20 8v6M23 11h-6" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <Text style={modal.actionText}>Invite Group Members</Text>
              {invitedIds.length > 0 && (
                <View style={modal.inviteBadge}>
                  <Text style={modal.inviteBadgeText}>{invitedIds.length} invited</Text>
                </View>
              )}
            </TouchableOpacity>

          </ScrollView>

          {/* Footer */}
          <View style={modal.footer}>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Text style={modal.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modal.createBtn, isSubmitting && { opacity: 0.7 }]}
              onPress={handleSave}
              activeOpacity={0.85}
              disabled={isSubmitting}
            >
              <Text style={modal.createBtnTxt}>Create Event</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Invite Members Sub-Modal ── */}
      <Modal visible={showInvite} transparent animationType="slide" onRequestClose={() => setShowInvite(false)}>
        <View style={modal.overlay}>
          <View style={[modal.dialog, { maxHeight: '80%' }]}>
            <View style={modal.header}>
              <Text style={modal.title}>Invite Members</Text>
              <TouchableOpacity onPress={() => setShowInvite(false)} style={modal.closeBtn} activeOpacity={0.7}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path d="M18 6L6 18M6 6l12 12" stroke="#64748b" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={modal.searchWrap}>
              <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                <Path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <TextInput
                style={modal.searchInput}
                placeholder="Search friends..."
                placeholderTextColor="#94a3b8"
                value={friendSearch}
                onChangeText={setFriendSearch}
              />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ paddingHorizontal: 16 }}>
              {filteredFriends.map(f => {
                const sel = invitedIds.includes(f.id);
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[modal.friendRow, sel && modal.friendRowSel]}
                    onPress={() => setInvitedIds(p => sel ? p.filter(x => x !== f.id) : [...p, f.id])}
                    activeOpacity={0.8}
                  >
                    <View style={modal.friendAvatar}>
                      <Text style={modal.friendAvatarText}>{f.name[0]}</Text>
                    </View>
                    <Text style={modal.friendName}>{f.name}</Text>
                    {sel && (
                      <View style={modal.checkCircle}>
                        <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                          <Path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={[modal.footer, { borderTopWidth: 1, borderTopColor: '#f1f5f9' }]}>
              <TouchableOpacity
                style={[modal.createBtn, { flex: 1 }]}
                onPress={() => setShowInvite(false)}
                activeOpacity={0.85}
              >
                <Text style={modal.createBtnTxt}>Done ({invitedIds.length} selected)</Text>
              </TouchableOpacity>
            </View>
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
  const [pastEvents,     setPastEvents]     = useState<EventItem[]>([]);
  const [archivedEvents, setArchivedEvents] = useState<EventItem[]>([]);
  const [openMenuId,     setOpenMenuId]     = useState<string | null>(null);
  const [showCreate,     setShowCreate]     = useState(false);
  const [editingEvent,   setEditingEvent]   = useState<EventItem | null>(null);

  const hasAnyEvent = upcomingEvents.length > 0 || pastEvents.length > 0;

  function handleCreateEvent(ev: EventItem) {
    const days = daysUntil(ev.dateISO);
    if (days >= 0) setUpcomingEvents(p => [ev, ...p]);
    else           setPastEvents(p => [ev, ...p]);
  }

  function archiveEvent(id: string, from: 'upcoming' | 'past') {
    const list = from === 'upcoming' ? upcomingEvents : pastEvents;
    const ev   = list.find(e => e.id === id);
    if (!ev) return;
    if (from === 'upcoming') setUpcomingEvents(p => p.filter(e => e.id !== id));
    else                     setPastEvents(p => p.filter(e => e.id !== id));
    setArchivedEvents(p => [ev, ...p]);
    setOpenMenuId(null);
  }

  function deleteEvent(id: string, from: 'upcoming' | 'past') {
    Alert.alert('Delete Event?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          if (from === 'upcoming') setUpcomingEvents(p => p.filter(e => e.id !== id));
          else setPastEvents(p => p.filter(e => e.id !== id));
          setOpenMenuId(null);
        },
      },
    ]);
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

  return (
    <BlobBackground>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
              <Rect x={2} y={6} width={20} height={14} rx={2} fill={colors.accent} />
              <Path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke={colors.accent} strokeWidth={2} />
              <Path d="M12 12l-2 2h4l-2-2z" fill="#fff" />
            </Svg>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.notifBtn}>
              <View style={styles.notifCircle}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke={colors.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <View style={styles.badge}><Text style={styles.badgeText}>2</Text></View>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuBtn}>
              <View style={{ width: 20, height: 2, backgroundColor: colors.accent, marginBottom: 4 }} />
              <View style={{ width: 20, height: 2, backgroundColor: colors.accent, marginBottom: 4 }} />
              <View style={{ width: 20, height: 2, backgroundColor: colors.accent }} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>

          {/* Page title row */}
          <View style={styles.pageTitleRow}>
            <View>
              <Text style={styles.sectionTitle}>Your Events</Text>
              <Text style={styles.sectionSub}>Manage all your gatherings</Text>
            </View>
            <TouchableOpacity
              style={styles.newEventBtn}
              activeOpacity={0.8}
              onPress={() => setShowCreate(true)}
            >
              <Text style={styles.newEventBtnText}>+ New Event</Text>
            </TouchableOpacity>
          </View>

          {/* Empty state */}
          {!hasAnyEvent && (
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
              <Text style={styles.heroTitle}>No events yet</Text>
              <Text style={styles.heroSub}>Create an event and invite your crew!</Text>
            </View>
          )}

          {/* Upcoming Events */}
          {upcomingEvents.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>UPCOMING</Text>
              {upcomingEvents.map(ev => (
                <EventListCard
                  key={ev.id}
                  event={ev}
                  onPress={() => navigateToDetail(ev)}
                  onEdit={() => navigateToDetail(ev)}
                />
              ))}
            </>
          )}

          {/* Past Events */}
          {pastEvents.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>PAST</Text>
              {pastEvents.map(ev => (
                <View key={ev.id} style={{ zIndex: openMenuId === ev.id ? 100 : 1 }}>
                  <EventListCard
                    event={ev}
                    onPress={() => navigateToDetail(ev)}
                    onEdit={() => navigateToDetail(ev)}
                  />
                  {/* Inline archive/delete menu */}
                  <View style={styles.cardMenuRow}>
                    <TouchableOpacity style={styles.cardMenuBtn} onPress={() => archiveEvent(ev.id, 'past')} activeOpacity={0.8}>
                      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                        <Path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                      <Text style={styles.cardMenuTxt}>Archive</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cardMenuBtn} onPress={() => deleteEvent(ev.id, 'past')} activeOpacity={0.8}>
                      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                        <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="#ef4444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                      <Text style={[styles.cardMenuTxt, { color: '#ef4444' }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* Archived Events link */}
          <TouchableOpacity
            style={styles.archiveLink}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('ArchivedEvents', { archivedEvents })}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.archiveLinkText}>View Archived Events</Text>
            {archivedEvents.length > 0 && (
              <View style={styles.archiveBadge}>
                <Text style={styles.archiveBadgeText}>{archivedEvents.length}</Text>
              </View>
            )}
          </TouchableOpacity>

        </ScrollView>

        {/* Create Event Modal */}
        <CreateEventModal
          visible={showCreate}
          onClose={() => setShowCreate(false)}
          onSave={handleCreateEvent}
        />
      </SafeAreaView>
    </BlobBackground>
  );
}

// ─── Screen Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  logoBox: { width: 32, height: 32 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  notifBtn: { padding: 4 },
  notifCircle: { position: 'relative' },
  badge: {
    position: 'absolute', top: -4, right: -4, backgroundColor: '#ef4444',
    minWidth: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#fff',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  menuBtn: { padding: 4 },

  pageTitleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12,
  },
  newEventBtn: {
    backgroundColor: colors.accent, borderRadius: 22,
    paddingVertical: 10, paddingHorizontal: 18,
    elevation: 3, shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 6,
  },
  newEventBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  sectionSub: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: colors.textSecondary,
    marginLeft: 16, marginTop: 16, marginBottom: 8, letterSpacing: 0.5,
  },

  heroSection: { alignItems: 'center', marginTop: 40, marginBottom: 40, paddingHorizontal: 40 },
  calendarCircle: {
    width: 90, height: 90, borderRadius: 45, backgroundColor: '#fff7ed',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  heroTitle: {
    fontSize: 20, fontWeight: '800', color: colors.textPrimary,
    textAlign: 'center', lineHeight: 28, marginBottom: 12,
  },
  heroSub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },

  // EventListCard
  cardWrap: { marginHorizontal: 16, marginBottom: 12 },
  heroCard: { borderRadius: 16, padding: 16, marginBottom: 0 },
  typeBadge: {
    alignSelf: 'flex-start', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 3, marginBottom: 10,
  },
  typeBadgeText: {
    fontSize: 11, fontWeight: '700', color: colors.accent,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heroName: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  heroDate: { fontSize: 13, color: colors.textSecondary, fontWeight: '500', marginBottom: 4 },
  heroLocRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroLoc: { fontSize: 13, color: colors.textSecondary, flex: 1 },
  daysBadge: { alignItems: 'center', minWidth: 52 },
  daysNum: { fontSize: 30, fontWeight: '900', color: colors.textPrimary, lineHeight: 34 },
  daysLabel: { fontSize: 9, color: colors.textMuted, fontWeight: '600', textAlign: 'center' },
  editBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#f0fdfa',
    alignItems: 'center', justifyContent: 'center',
  },

  // Stats bar (below card)
  statsBar: {
    backgroundColor: '#fff', borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
    padding: 12, flexDirection: 'row', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: '#e2f8f4',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  statItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center' },
  statText: { fontSize: 11, color: colors.accent, fontWeight: '600' },
  statDiv: { width: 1, height: 18, backgroundColor: colors.surfaceSecondary },

  // Past card menu
  cardMenuRow: {
    flexDirection: 'row', gap: 8,
    marginHorizontal: 16, marginTop: -4, marginBottom: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#fff', borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
    borderTopWidth: 1, borderTopColor: '#f1f5f9',
  },
  cardMenuBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 2, paddingHorizontal: 8 },
  cardMenuTxt: { fontSize: 12, fontWeight: '600', color: '#64748b' },

  archiveLink: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 24, marginBottom: 20,
    paddingVertical: 12, paddingHorizontal: 14,
    backgroundColor: '#f0fdfb', borderRadius: 12,
    borderWidth: 1, borderColor: '#ccfbf1',
  },
  archiveLinkText: { fontSize: 13, fontWeight: '600', color: '#0d9488', flex: 1 },
  archiveBadge: {
    backgroundColor: '#0d9488', borderRadius: 10,
    minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  archiveBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  listContent: { paddingBottom: 60 },
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
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  title: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center',
  },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },

  label: { fontSize: 13, fontWeight: '700', color: '#0f172a', marginBottom: 8, marginTop: 12 },
  input: {
    borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#0f172a', backgroundColor: '#fff',
    flexDirection: 'row', alignItems: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  inputWrap: { position: 'relative' },
  inputIcon: { position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' },

  dropdown: {
    borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12,
    backgroundColor: '#fff', marginTop: 4, overflow: 'hidden',
  },
  dropItem: { paddingHorizontal: 14, paddingVertical: 11 },
  dropItemActive: { backgroundColor: '#f0fdfa' },
  dropItemText: { fontSize: 14, color: '#0f172a' },
  dropItemTextActive: { color: '#0d9488', fontWeight: '700' },

  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#f8fafc', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, marginTop: 10,
  },
  actionIcon: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  actionText: { fontSize: 14, fontWeight: '600', color: '#0f172a', flex: 1 },
  actionHint: { fontSize: 12, color: '#94a3b8' },
  inviteBadge: {
    backgroundColor: '#ccfbf1', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  inviteBadgeText: { fontSize: 11, fontWeight: '700', color: '#0d9488' },

  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: '#f1f5f9',
  },
  cancelTxt: { fontSize: 14, fontWeight: '600', color: '#0f172a', textDecorationLine: 'underline' },
  createBtn: {
    backgroundColor: colors.accent, borderRadius: 24,
    paddingVertical: 13, paddingHorizontal: 28,
    elevation: 4, shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6,
  },
  createBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Invite sub-modal
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginVertical: 12,
    backgroundColor: '#f8fafc', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#0f172a', padding: 0 },
  friendRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: '#f8fafc',
  },
  friendRowSel: { backgroundColor: '#f0fdfa', borderRadius: 10, paddingHorizontal: 8 },
  friendAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#ccfbf1', alignItems: 'center', justifyContent: 'center',
  },
  friendAvatarText: { fontSize: 16, fontWeight: '700', color: colors.accent },
  friendName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#0f172a' },
  checkCircle: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
});
