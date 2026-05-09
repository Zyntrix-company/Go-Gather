import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  Dimensions, StyleSheet, ActivityIndicator, Modal, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { Plane, CalendarDays, UserMinus } from 'lucide-react-native';
import BlobBackground from '../../components/common/BlobBackground';
import CachedImage from '../../components/common/CachedImage';
import AppHeader from '../../components/common/AppHeader';
import useNotificationStore from '../../store/notificationStore';
import { getUserProfile, removeFriend, handleApiError } from '../../api/trips.api';
import { showConfirm } from '../../store/alertStore';
import Toast from 'react-native-toast-message';
import { getUserGallery, getUserPhotos } from '../../api/ai.api';
import { getTripPhotos } from '../../api/trips.api';
import { getEventPhotos } from '../../api/events.api';
import type { MainStackParamList } from '../../navigation/MainStack';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = (SCREEN_W - 52) / 2;

// ─── Icons ────────────────────────────────────────────────────────────────────

const PinIcon = ({ color = '#94a3b8', size = 13 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx={12} cy={10} r={3} stroke={color} strokeWidth={2} />
  </Svg>
);

const CloseIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Path d="M18 6L6 18M6 6l12 12" stroke="#64748b" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const CameraIcon = () => (
  <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
    <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="#cbd5e1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx={12} cy={13} r={4} stroke="#cbd5e1" strokeWidth={1.5} />
  </Svg>
);

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, count, icon }: { title: string; count: number; icon?: React.ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        {icon && <View style={styles.sectionIcon}>{icon}</View>}
        <Text style={styles.sectionTitle}>{title}</Text>
        {count > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{count}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function GridCard({ item, onPress }: { item: any; onPress: () => void }) {
  const [imgError, setImgError] = useState(false);
  const hasImage = item.bannerImageUrl && !imgError;
  const hasSubtitle = !!item.gallerySubtitle?.trim();
  return (
    <TouchableOpacity
      style={[styles.gridCard, hasSubtitle && styles.gridCardTall]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {hasImage ? (
        <CachedImage uri={item.bannerImageUrl} style={styles.gridCardImage} resizeMode="cover" onError={() => setImgError(true)} />
      ) : (
        <View style={styles.gridCardPlaceholder}><CameraIcon /></View>
      )}
      <View style={[styles.gridCardOverlay, hasSubtitle && styles.gridCardOverlayTall]}>
        <Text style={styles.gridCardText} numberOfLines={1}>{item.name}</Text>
        {hasSubtitle && (
          <Text style={styles.gridCardSubtitle} numberOfLines={1}>{item.gallerySubtitle}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function EmptyCard({ label }: { label: string }) {
  return (
    <View style={styles.emptyCard}>
      <CameraIcon />
      <Text style={styles.emptyCardText}>{label}</Text>
    </View>
  );
}

type PhotoItem = { id: string; uri: string; activityId?: string | null; activityTitle?: string | null };

function PhotoThumb({ photo, onPress }: { photo: PhotoItem; onPress: () => void }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const prevUri = useRef(photo.uri);
  useEffect(() => {
    if (prevUri.current !== photo.uri) {
      prevUri.current = photo.uri;
      setFailed(false);
      setLoading(true);
    }
  }, [photo.uri]);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.thumb}>
      {!failed ? (
        <>
          <CachedImage uri={photo.uri} style={styles.thumbImg} resizeMode="cover" onLoad={() => setLoading(false)} onError={() => { setLoading(false); setFailed(true); }} />
          {loading && <View style={styles.thumbLoader}><ActivityIndicator size="small" color="#0d9488" /></View>}
        </>
      ) : (
        <View style={styles.thumbError}><CameraIcon /></View>
      )}
    </TouchableOpacity>
  );
}

function PreviewModal({ photo, onClose }: { photo: PhotoItem | null; onClose: () => void }) {
  const [previewLoading, setPreviewLoading] = useState(true);
  useEffect(() => { if (photo) setPreviewLoading(true); }, [photo?.uri]);
  return (
    <View style={styles.previewBg}>
      <TouchableOpacity onPress={onClose} style={styles.previewClose} activeOpacity={0.8}>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </TouchableOpacity>
      {photo && (
        <>
          <CachedImage uri={photo.uri} style={styles.previewImg} resizeMode="contain" onLoad={() => setPreviewLoading(false)} onError={() => setPreviewLoading(false)} />
          {previewLoading && <ActivityIndicator style={styles.previewLoader} size="large" color="#fff" />}
        </>
      )}
    </View>
  );
}

function PhotosModal({ visible, title, onClose, parentId, parentType, userId, gallerySubtitle }: {
  visible: boolean; title: string; onClose: () => void;
  parentId: string; parentType: 'trip' | 'event'; userId?: string; gallerySubtitle?: string | null;
}) {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<PhotoItem | null>(null);

  useEffect(() => {
    if (!visible || !parentId) return;
    let cancelled = false;
    setLoading(true);
    setPhotos([]);

    let fetcher: Promise<{ photos?: any[] }>;

    if (userId) {
      // Viewing a friend's gallery — use the user photos endpoint which doesn't
      // require trip/event membership. Filter the response to this specific parent.
      fetcher = getUserPhotos(userId).then((data) => {
        const parentList: any[] = parentType === 'trip' ? (data.trips ?? []) : (data.events ?? []);
        const match = parentList.find((p: any) => p.id === parentId);
        const allPhotos = [
          ...(match?.photos ?? []),
          ...(match?.activities?.flatMap((a: any) => a.photos ?? []) ?? []),
        ];
        return { photos: allPhotos };
      });
    } else {
      fetcher = parentType === 'trip' ? getTripPhotos(parentId) : getEventPhotos(parentId);
    }

    fetcher
      .then((data) => {
        if (cancelled) return;
        setPhotos((data.photos ?? []).map((ph: any) => ({
          id: ph.id,
          uri: ph.uri ?? ph.url ?? ph.fileUrl ?? '',
          activityId: ph.activityId ?? null,
          activityTitle: ph.activityTitle ?? null,
        })));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visible, parentId, parentType, userId]);

  const activityGroups: Record<string, PhotoItem[]> = {};
  const directPhotos: PhotoItem[] = [];
  photos.forEach((ph) => {
    if (ph.activityId && ph.activityTitle) {
      if (!activityGroups[ph.activityTitle]) activityGroups[ph.activityTitle] = [];
      activityGroups[ph.activityTitle].push(ph);
    } else {
      directPhotos.push(ph);
    }
  });

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={[styles.dialog, { maxHeight: '85%' }]}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>{title}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <CloseIcon />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.dialogBody}>
                {gallerySubtitle?.trim() ? (
                  <Text style={styles.subtitleDisplay}>{gallerySubtitle}</Text>
                ) : null}
                {loading && <View style={styles.modalLoadingRow}><ActivityIndicator color="#0d9488" /></View>}

                {!loading && photos.length === 0 && (
                  <View style={styles.emptyCenter}>
                    <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
                      <Rect x={3} y={3} width={18} height={18} rx={2} stroke="#cbd5e1" strokeWidth={1.5} />
                      <Circle cx={8.5} cy={8.5} r={1.5} fill="#cbd5e1" />
                      <Path d="M21 15l-5-5L5 21" stroke="#cbd5e1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <Text style={styles.emptyTitle}>No photos yet</Text>
                    <Text style={styles.emptySub}>No memories captured for this {parentType}.</Text>
                  </View>
                )}

                {!loading && photos.length > 0 && (
                  <View>
                    {Object.entries(activityGroups).map(([actTitle, actPhotos]) => (
                      <View key={actTitle} style={{ marginBottom: 16 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 }}>
                          <View style={{ width: 3, height: 14, backgroundColor: '#0d9488', borderRadius: 2 }} />
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a' }}>{actTitle}</Text>
                          <Text style={{ fontSize: 11, color: '#94a3b8' }}>({actPhotos.length})</Text>
                        </View>
                        <View style={styles.thumbRow}>
                          {actPhotos.map(ph => <PhotoThumb key={ph.id} photo={ph} onPress={() => setPreviewPhoto(ph)} />)}
                        </View>
                      </View>
                    ))}
                    {directPhotos.length > 0 && (
                      <View style={{ marginBottom: 8 }}>
                        {Object.keys(activityGroups).length > 0 && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 }}>
                            <View style={{ width: 3, height: 14, backgroundColor: '#64748b', borderRadius: 2 }} />
                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a' }}>
                              {parentType === 'trip' ? 'Trip Photos' : 'Event Photos'}
                            </Text>
                            <Text style={{ fontSize: 11, color: '#94a3b8' }}>({directPhotos.length})</Text>
                          </View>
                        )}
                        <View style={styles.thumbRow}>
                          {directPhotos.map(ph => <PhotoThumb key={ph.id} photo={ph} onPress={() => setPreviewPhoto(ph)} />)}
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!previewPhoto} transparent animationType="fade" onRequestClose={() => setPreviewPhoto(null)}>
        <PreviewModal photo={previewPhoto} onClose={() => setPreviewPhoto(null)} />
      </Modal>
    </>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

type RouteParams = { userId: string; friendName: string };

export default function FriendProfileScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ FriendProfile: RouteParams }, 'FriendProfile'>>();
  const { userId, friendName } = route.params;
  const unreadCount = useNotificationStore(s => s.notifications.filter(n => !n.read).length);

  const [profile, setProfile] = useState<Awaited<ReturnType<typeof getUserProfile>> | null>(null);
  const [galleryTrips, setGalleryTrips] = useState<any[]>([]);
  const [galleryEvents, setGalleryEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [avatarError, setAvatarError] = useState(false);
  const [photoModal, setPhotoModal] = useState<{ id: string; name: string; type: 'trip' | 'event'; subtitle?: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getUserProfile(userId),
      getUserGallery(userId),
    ])
      .then(([prof, gallery]) => {
        if (cancelled) return;
        console.log('[FriendProfileScreen] avatarUrl =', prof?.avatarUrl);
        setProfile(prof);
        setGalleryTrips(gallery.trips ?? []);
        setGalleryEvents(gallery.events ?? []);
      })
      .catch((err) => { console.error('[FriendProfileScreen] load failed', err?.response?.data ?? err?.message ?? err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  const displayName = profile?.name ?? friendName;
  const handle = profile?.username ? `@${profile.username}` : '';
  const initial = displayName?.[0]?.toUpperCase() ?? '?';

  function handleRemoveFriend() {
    showConfirm({
      title: 'Remove friend?',
      message: `${displayName} will be removed from your friends list. You will not be able to undo this from here.`,
      destructive: true,
      confirmText: 'Remove',
      onConfirm: async () => {
        try {
          await removeFriend(userId);
          Toast.show({ type: 'success', text1: 'Friend removed' });
          navigation.goBack();
        } catch (err) {
          handleApiError(err);
        }
      },
    });
  }

  return (
    <BlobBackground>
      <SafeAreaView style={styles.container}>

        <AppHeader
          notificationCount={unreadCount}
          onLogoPress={() => navigation.goBack()}
          onBellPress={() => navigation.navigate('Notifications' as any)}
          onMenuPress={() => {}}
        />

        {loading ? (
          <View style={styles.loadingCenter}>
            <ActivityIndicator size="large" color="#0d9488" />
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

            {/* ── Profile card ── */}
            <View style={styles.profileCard}>
              {/* Top row: avatar left, info right */}
              <View style={styles.profileRow}>
                <View style={styles.avatarWrap}>
                  {profile?.avatarUrl && !avatarError ? (
                    <Image
                      source={{ uri: profile.avatarUrl }}
                      style={styles.avatar}
                      resizeMode="cover"
                      onError={() => {
                        console.warn('[FriendProfileScreen] avatar load failed, url:', profile.avatarUrl);
                        setAvatarError(true);
                      }}
                    />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Text style={styles.avatarInitial}>{initial}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.profileInfo}>
                  {displayName ? (
                    <View style={styles.nameHeaderWrap}>
                      <Text style={styles.name} numberOfLines={2}>{displayName}</Text>
                      {profile?.friendshipStatus === 'accepted' && (
                        <TouchableOpacity
                          style={styles.removeFriendIconBtn}
                          onPress={handleRemoveFriend}
                          activeOpacity={0.8}
                          accessibilityLabel="Remove friend"
                          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                        >
                          <UserMinus size={15} color="#64748b" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : null}
                  {handle ? <Text style={styles.handle}>{handle}</Text> : null}
                  {profile?.country ? (
                    <View style={styles.locationRow}>
                      <PinIcon color="#0d9488" size={13} />
                      <Text style={styles.locationText}>{profile.country}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Bio below, centered */}
              {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

            </View>

            {/* ── Gallery of Trips ── */}
            <SectionHeader
              title="Gallery of Trips"
              count={galleryTrips.length}
              icon={<Plane size={20} color="#0d9488" />}
            />
            <View style={styles.grid}>
              {galleryTrips.length > 0
                ? galleryTrips.map((trip: any) => (
                    <GridCard key={trip.id} item={trip} onPress={() => setPhotoModal({ id: trip.id, name: trip.name, type: 'trip', subtitle: trip.gallerySubtitle ?? null })} />
                  ))
                : <EmptyCard label="No past trips yet" />
              }
            </View>

            {/* ── Gallery of Events ── */}
            <View style={styles.sectionSpacer} />
            <SectionHeader
              title="Gallery of Events"
              count={galleryEvents.length}
              icon={<CalendarDays size={20} color="#f59e0b" />}
            />
            <View style={styles.grid}>
              {galleryEvents.length > 0
                ? galleryEvents.map((ev: any) => (
                    <GridCard key={ev.id} item={ev} onPress={() => setPhotoModal({ id: ev.id, name: ev.name, type: 'event', subtitle: ev.gallerySubtitle ?? null })} />
                  ))
                : <EmptyCard label="No past events yet" />
              }
            </View>

          </ScrollView>
        )}
      </SafeAreaView>

      {photoModal && (
        <PhotosModal
          visible
          title={photoModal.name}
          parentId={photoModal.id}
          parentType={photoModal.type}
          userId={userId}
          gallerySubtitle={photoModal.subtitle}
          onClose={() => setPhotoModal(null)}
        />
      )}
    </BlobBackground>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  backRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  screenTitle: { fontSize: 18, fontWeight: '500', color: '#45556C', marginLeft: 12, flex: 1 },

  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 4 },

  // Profile card — matches GalleryTab layout exactly
  profileCard: { marginTop: 14, marginBottom: 28, alignItems: 'center' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 32, alignSelf: 'stretch' },
  avatarWrap: { position: 'relative' },
  profileInfo: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 8 },
  /** Name + remove chip: chip sits top-right, slightly lifted like a small popup */
  nameHeaderWrap: {
    position: 'relative',
    alignSelf: 'stretch',
    paddingRight: 40,
    paddingTop: 2,
    minHeight: 30,
  },
  removeFriendIconBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 4,
  },
  avatar: { width: 112, height: 112, borderRadius: 56, borderWidth: 3, borderColor: '#0d9488' },
  avatarPlaceholder: { backgroundColor: '#f0fdfa', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 38, fontWeight: '600', color: '#0d9488' },
  name: { fontSize: 21, fontWeight: '600', color: '#0f172a', lineHeight: 26 },
  handle: { fontSize: 16, color: '#0d9488', fontWeight: '600' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { fontSize: 16, fontWeight: '600', color: '#64748b' },
  bio: { fontSize: 15, fontWeight: '500', color: '#334155', textAlign: 'center', marginTop: 16, lineHeight: 24 },

  // Sections
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionIcon: { alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: '#1e293b' },
  countBadge: { backgroundColor: '#f0fdfa', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: '#ccfbf1' },
  countBadgeText: { fontSize: 13, fontWeight: '600', color: '#0d9488' },
  sectionSpacer: { height: 24 },

  // Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridCard: { width: CARD_W, height: 140, borderRadius: 14, overflow: 'hidden', backgroundColor: '#f1f5f9' },
  gridCardTall: { height: 160 },
  gridCardImage: { width: '100%', height: '100%' },
  gridCardPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  gridCardOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 32, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', paddingHorizontal: 8 },
  gridCardOverlayTall: { height: 50, justifyContent: 'center', paddingVertical: 6 },
  gridCardText: { color: '#fff', fontSize: 13, fontWeight: '600', lineHeight: 16 },
  gridCardSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '400', lineHeight: 14, marginTop: 2 },
  emptyCard: { width: CARD_W, height: 140, borderRadius: 14, borderWidth: 2, borderColor: '#e2e8f0', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#fafafa' },
  emptyCardText: { fontSize: 13, color: '#cbd5e1', fontWeight: '600' },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  dialog: { width: '100%', backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden' },
  dialogHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dialogTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  dialogBody: { padding: 16 },
  modalLoadingRow: { alignItems: 'center', paddingVertical: 32 },
  emptyCenter: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: '#334155' },
  emptySub: { fontSize: 13, color: '#94a3b8', textAlign: 'center' },

  thumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: 80, height: 80, borderRadius: 8, overflow: 'hidden', backgroundColor: '#e2e8f0' },
  thumbImg: { width: 80, height: 80, borderRadius: 8 },
  thumbLoader: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e2e8f0' },
  thumbError: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },

  previewBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', justifyContent: 'center', alignItems: 'center' },
  previewClose: { position: 'absolute', top: 48, left: 20, zIndex: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  previewImg: { width: SCREEN_W, height: SCREEN_W * 1.2 },
  previewLoader: { position: 'absolute' },

  subtitleDisplay: { fontSize: 13, color: '#64748b', fontStyle: 'italic', marginBottom: 12, paddingHorizontal: 2 },
});
