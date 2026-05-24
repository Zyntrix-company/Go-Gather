import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import BlobBackground from '../../components/common/BlobBackground';
import { BackIcon } from '../../components/common/Icons';
import {
  getArchivedTrips,
  unarchiveTrip,
  deleteTrip,
  handleApiError,
} from '../../api/trips.api';
import { getArchivedEvents, unarchiveEvent, deleteEvent } from '../../api/events.api';
import { getArchivedUserGallery, unarchiveGalleryItem } from '../../api/ai.api';
import { unarchiveGalleryAlbum, deleteGalleryAlbum } from '../../api/gallery.api';
import { showConfirm } from '../../store/alertStore';
import { UnifiedCard } from '../../components/common/Cards';
import useAuthStore from '../../store/authStore';
import { authFreshAvatarUrl, authUserId, resolveMemberAvatarUri } from '../../utils/avatarUri';

const { width: SCREEN_W } = Dimensions.get('window');
const GALLERY_CARD_W = (SCREEN_W - 52) / 2;

type ArchivedGalleryItem = {
  id: string;
  name: string;
  type: 'trip' | 'event';
  bannerImageUrl?: string | null;
  location?: string;
  isCustom?: boolean;
};

// ─── Types ────────────────────────────────────────────────────────────────────

type ArchivedTrip = {
  id: string;
  name: string;
  location: string;
  startDate: string;
  endDate: string;
  bannerImageUrl?: string | null;
  members: { id: string; uri: string }[];
  extraMembers: number;
};

type ArchivedEvent = {
  id: string;
  name: string;
  location: string;
  fullDate: string;
  bannerImageUrl?: string | null;
  members: { id: string; uri: string }[];
  extraMembers: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapAvatars(memberAvatars: any[], memberCount: number): { members: { id: string; uri: string }[]; extraMembers: number } {
  const state = useAuthStore.getState();
  const user = state.user;
  const sliced = (memberAvatars || []).slice(0, 2);
  const members = sliced.map((av: any, idx: number) => {
    const rawUri = typeof av === 'string' ? av : (av.uri ?? '');
    const memberId = typeof av === 'string' ? undefined : (av.id != null ? String(av.id) : undefined);
    const uri = resolveMemberAvatarUri(rawUri, {
      memberId,
      currentUserId: authUserId(user),
      freshUrl: authFreshAvatarUrl(user),
      prevUrl: state.prevAvatarUrl ?? '',
    });
    const stableId = memberId || uri || `av-${idx}`;
    return { id: stableId, uri };
  });
  const extraMembers = sliced.length === 0
    ? (memberCount ?? 0)
    : Math.max(0, (memberCount ?? 0) - Math.min(sliced.length, 2));
  return { members, extraMembers };
}

// ─── Date helpers ────────────────────────────────────────────────────────────

function fmtDateTrip(iso: string): string {
  if (!iso) return 'TBD';
  const clean = iso.includes('T') ? iso.split('T')[0] : iso;
  const parts = clean.split('-');
  if (parts.length !== 3) return 'TBD';
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  if (isNaN(d.getTime())) return 'TBD';
  return `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`;
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ArchivedScreen() {
  const navigation = useNavigation<any>();
  const userId = authUserId(useAuthStore.getState().user) ?? '';
  const [trips, setTrips] = useState<ArchivedTrip[]>([]);
  const [events, setEvents] = useState<ArchivedEvent[]>([]);
  const [galleryItems, setGalleryItems] = useState<ArchivedGalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  async function loadArchived(silent = false) {
    if (!silent) setLoading(true);
    try {
      const [tripsRes, eventsRes, galleryRes] = await Promise.all([
        getArchivedTrips(),
        getArchivedEvents(),
        getArchivedUserGallery(),
      ]);

      setTrips((tripsRes.trips || []).map(t => {
        const { members, extraMembers } = mapAvatars((t as any).memberAvatars || [], t.memberCount ?? 0);
        return {
          id: t.id,
          name: t.name,
          location: t.location?.name ?? '',
          startDate: fmtDateTrip(t.startDate),
          endDate: fmtDateTrip(t.endDate),
          bannerImageUrl: t.bannerImageUrl,
          members,
          extraMembers,
        };
      }));

      setEvents((eventsRes.events || []).map(e => {
        const { members, extraMembers } = mapAvatars((e as any).memberAvatars || [], e.memberCount ?? 0);
        return {
          id: e.id,
          name: e.name,
          location: e.location?.name ?? '',
          fullDate: e.eventDate
            ? new Date(e.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            : '',
          bannerImageUrl: e.bannerImageUrl ?? null,
          members,
          extraMembers,
        };
      }));

      const apiGallery: ArchivedGalleryItem[] = [
        ...(galleryRes.trips ?? []).map((t: any) => ({
          id: t.id,
          name: t.name,
          type: 'trip' as const,
          bannerImageUrl: t.bannerImageUrl,
          location: t.location,
        })),
        ...(galleryRes.events ?? []).map((e: any) => ({
          id: e.id,
          name: e.name,
          type: 'event' as const,
          bannerImageUrl: e.bannerImageUrl,
          location: e.location,
        })),
      ];

      const customArchived: ArchivedGalleryItem[] = [
        ...(galleryRes.customAlbums?.trip ?? []).map((a: any) => ({
          id: a.id,
          name: a.name,
          type: 'trip' as const,
          bannerImageUrl: a.bannerImageUrl,
          isCustom: true,
        })),
        ...(galleryRes.customAlbums?.event ?? []).map((a: any) => ({
          id: a.id,
          name: a.name,
          type: 'event' as const,
          bannerImageUrl: a.bannerImageUrl,
          isCustom: true,
        })),
      ];

      setGalleryItems([...apiGallery, ...customArchived]);
    } catch (err) {
      handleApiError(err);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadArchived();
    }, [])
  );

  async function onRefresh() {
    setRefreshing(true);
    await loadArchived(true);
    setRefreshing(false);
  }

  function handleUnarchiveTrip(trip: ArchivedTrip) {
    setOpenMenuId(null);
    showConfirm({
      title: 'Restore Trip',
      message: `Restore "${trip.name}" to your trips?`,
      confirmText: 'Restore',
      onConfirm: async () => {
        try {
          await unarchiveTrip(trip.id);
          toast('Restored', `"${trip.name}" moved back to trips.`);
          setTrips(p => p.filter(t => t.id !== trip.id));
        } catch (err) {
          handleApiError(err);
        }
      },
    });
  }

  function handleDeleteTrip(trip: ArchivedTrip) {
    setOpenMenuId(null);
    showConfirm({
      title: 'Delete Trip',
      message: `Permanently delete "${trip.name}"? This cannot be undone.`,
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteTrip(trip.id);
          toast('Deleted', `"${trip.name}" has been deleted.`);
          setTrips(p => p.filter(t => t.id !== trip.id));
        } catch (err) {
          handleApiError(err);
        }
      },
    });
  }

  function handleUnarchiveEvent(event: ArchivedEvent) {
    setOpenMenuId(null);
    showConfirm({
      title: 'Restore Event',
      message: `Restore "${event.name}" to your events?`,
      confirmText: 'Restore',
      onConfirm: async () => {
        try {
          await unarchiveEvent(event.id);
          toast('Restored', `"${event.name}" moved back to events.`);
          setEvents(p => p.filter(e => e.id !== event.id));
        } catch (err) {
          handleApiError(err);
        }
      },
    });
  }

  function handleDeleteEvent(event: ArchivedEvent) {
    setOpenMenuId(null);
    showConfirm({
      title: 'Delete Event',
      message: `Permanently delete "${event.name}"? This cannot be undone.`,
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteEvent(event.id);
          toast('Deleted', `"${event.name}" has been deleted.`);
          setEvents(p => p.filter(e => e.id !== event.id));
        } catch (err) {
          handleApiError(err);
        }
      },
    });
  }

  function toast(title: string, msg: string) {
    Toast.show({ type: 'success', text1: title, text2: msg });
  }

  function handleRestoreGalleryItem(item: ArchivedGalleryItem) {
    setOpenMenuId(null);
    showConfirm({
      title: 'Restore album',
      message: `Restore "${item.name}" to your gallery?`,
      confirmText: 'Restore',
      onConfirm: async () => {
        try {
          if (item.isCustom) {
            await unarchiveGalleryAlbum(item.id);
          } else {
            await unarchiveGalleryItem(item.type, item.id);
          }
          toast('Restored', `"${item.name}" is back in your gallery.`);
          setGalleryItems((p) => p.filter((g) => !(g.id === item.id && !!g.isCustom === !!item.isCustom)));
        } catch (err) {
          handleApiError(err);
        }
      },
    });
  }

  function handleDeleteGalleryItem(item: ArchivedGalleryItem) {
    setOpenMenuId(null);
    if (!item.isCustom) {
      toast('Info', 'Remove trip/event albums from the Trips or Events sections below.');
      return;
    }
    showConfirm({
      title: 'Delete album',
      message: `Permanently delete "${item.name}"? This cannot be undone.`,
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteGalleryAlbum(item.id);
          toast('Deleted', `"${item.name}" has been deleted.`);
          setGalleryItems((p) => p.filter((g) => g.id !== item.id));
        } catch (err) {
          handleApiError(err);
        }
      },
    });
  }

  if (loading) {
    return (
      <BlobBackground>
        <SafeAreaView style={styles.container}>
          <View style={styles.backRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <BackIcon />
            </TouchableOpacity>
            <Text style={styles.title}>Archived</Text>
          </View>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#0d9488" />
          </View>
        </SafeAreaView>
      </BlobBackground>
    );
  }

  const isEmpty = trips.length === 0 && events.length === 0 && galleryItems.length === 0;

  return (
    <BlobBackground>
      <SafeAreaView style={styles.container}>
        <View style={styles.backRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <BackIcon />
          </TouchableOpacity>
          <Text style={styles.title}>Archived</Text>
        </View>

        {isEmpty ? (
          <View style={styles.emptyCenter}>
            <Svg width={52} height={52} viewBox="0 0 24 24" fill="none">
              <Path
                d="M4 7h16M8 4h8M6 7l.937 11.265A2 2 0 008.91 20h6.18a2 2 0 001.973-1.735L18 7M9 11v6M15 11v6"
                stroke="#cbd5e1"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={styles.emptyTitle}>No archived items</Text>
            <Text style={styles.emptySub}>Archived trips, events, and gallery albums will appear here</Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            onScrollBeginDrag={() => setOpenMenuId(null)}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0d9488']} />}
          >
            {/* Archived Trips Section */}
            {trips.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Archived Trips</Text>
                {trips.map(trip => (
                  <UnifiedCard
                    key={trip.id}
                    imageUri={trip.bannerImageUrl}
                    name={trip.name}
                    location={trip.location}
                    dateLabel={`${trip.startDate} – ${trip.endDate}`}
                    members={trip.members}
                    extraMembers={trip.extraMembers}
                    onPress={() => {}}
                    onToggleMenu={() => setOpenMenuId(openMenuId === trip.id ? null : trip.id)}
                    showMenu={openMenuId === trip.id}
                    archiveLabel="Restore"
                    onArchive={() => handleUnarchiveTrip(trip)}
                    onDelete={() => handleDeleteTrip(trip)}
                    mb={12}
                  />
                ))}
              </View>
            )}

            {/* Archived Events Section */}
            {events.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Archived Events</Text>
                {events.map(event => (
                  <UnifiedCard
                    key={event.id}
                    imageUri={event.bannerImageUrl}
                    name={event.name}
                    location={event.location}
                    dateLabel={event.fullDate}
                    members={event.members}
                    extraMembers={event.extraMembers}
                    onPress={() => {}}
                    onToggleMenu={() => setOpenMenuId(openMenuId === event.id ? null : event.id)}
                    showMenu={openMenuId === event.id}
                    archiveLabel="Restore"
                    onArchive={() => handleUnarchiveEvent(event)}
                    onDelete={() => handleDeleteEvent(event)}
                    mb={12}
                  />
                ))}
              </View>
            )}

            {galleryItems.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Archived Gallery</Text>
                <View style={styles.galleryGrid}>
                  {galleryItems.map((item) => {
                    const menuKey = `gallery-${item.isCustom ? 'custom' : item.type}-${item.id}`;
                    return (
                      <View key={menuKey} style={{ width: GALLERY_CARD_W, marginBottom: 12, zIndex: openMenuId === menuKey ? 100 : 1 }}>
                        <TouchableOpacity
                          style={styles.galleryCard}
                          activeOpacity={0.85}
                          onPress={() => setOpenMenuId(openMenuId === menuKey ? null : menuKey)}
                        >
                          {item.bannerImageUrl ? (
                            <Image source={{ uri: item.bannerImageUrl }} style={styles.galleryCardImage} resizeMode="cover" />
                          ) : (
                            <View style={[styles.galleryCardImage, styles.galleryCardPlaceholder]}>
                              <Text style={styles.galleryCardPlaceholderText}>No cover</Text>
                            </View>
                          )}
                          <View style={styles.galleryCardOverlay}>
                            <Text style={styles.galleryCardTitle} numberOfLines={1}>{item.name}</Text>
                            <Text style={styles.galleryCardMeta}>{item.isCustom ? 'Custom album' : item.type === 'trip' ? 'Trip album' : 'Event album'}</Text>
                          </View>
                        </TouchableOpacity>
                        {openMenuId === menuKey && (
                          <View style={styles.galleryMenu}>
                            <TouchableOpacity style={styles.galleryMenuItem} onPress={() => handleRestoreGalleryItem(item)} activeOpacity={0.7}>
                              <Text style={styles.galleryMenuItemText}>Restore</Text>
                            </TouchableOpacity>
                            {item.isCustom && (
                              <>
                                <View style={styles.galleryMenuDivider} />
                                <TouchableOpacity style={styles.galleryMenuItem} onPress={() => handleDeleteGalleryItem(item)} activeOpacity={0.7}>
                                  <Text style={[styles.galleryMenuItemText, { color: '#ef4444' }]}>Delete</Text>
                                </TouchableOpacity>
                              </>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </BlobBackground>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  backRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '500', color: '#141414', marginLeft: 12 },
  scrollContent: { paddingHorizontal: 16, paddingVertical: 12 },

  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 12, fontWeight: '500', color: '#45556C', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 },

  emptyCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '500', color: '#64748b', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#94a3b8', marginTop: 4, textAlign: 'center' },

  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  galleryCard: { width: GALLERY_CARD_W, height: 140, borderRadius: 14, overflow: 'hidden', backgroundColor: '#f1f5f9' },
  galleryCardImage: { width: '100%', height: '100%' },
  galleryCardPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  galleryCardPlaceholderText: { fontSize: 12, color: '#94a3b8' },
  galleryCardOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  galleryCardTitle: { fontSize: 13, fontWeight: '500', color: '#fff' },
  galleryCardMeta: { fontSize: 10, color: '#e2e8f0', marginTop: 2 },
  galleryMenu: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: '#fff', borderRadius: 10,
    borderWidth: 1, borderColor: '#e2e8f0',
    overflow: 'hidden', minWidth: 120,
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8,
  },
  galleryMenuItem: { paddingHorizontal: 14, paddingVertical: 11 },
  galleryMenuItemText: { fontSize: 13, color: '#0f172a', fontWeight: '500' },
  galleryMenuDivider: { height: 1, backgroundColor: '#f1f5f9' },
});
