import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Image,
  Dimensions, StyleSheet, ActivityIndicator, Modal,
} from 'react-native';
import CachedImage from '../../components/common/CachedImage';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { Plane, CalendarDays } from 'lucide-react-native';
import { getUserGallery } from '../../api/ai.api';
import { getTripPhotos } from '../../api/trips.api';
import { getEventPhotos } from '../../api/events.api';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = (SCREEN_W - 52) / 2;

// ─── Icons ─────────────────────────────────────────────────────────────────

const PinIcon = ({ color = '#94a3b8', size = 13 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx={12} cy={10} r={3} stroke={color} strokeWidth={2} />
  </Svg>
);

const EditIcon = () => (
  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
    <Path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const CameraIcon = () => (
  <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
    <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="#cbd5e1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx={12} cy={13} r={4} stroke="#cbd5e1" strokeWidth={1.5} />
  </Svg>
);

const CloseIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Path d="M18 6L6 18M6 6l12 12" stroke="#64748b" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);


// ─── Section header ─────────────────────────────────────────────────────────

function SectionHeader({ title, count, onAdd, icon }: { title: string; count: number; onAdd?: () => void; icon?: React.ReactNode }) {
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
      {onAdd && (
        <TouchableOpacity onPress={onAdd} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M12 5v14M5 12h14" stroke="#0d9488" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Gallery grid card ──────────────────────────────────────────────────────

function GridCard({ item, onPress }: { item: any; onPress: () => void }) {
  const [imgError, setImgError] = useState(false);
  const hasImage = item.bannerImageUrl && !imgError;

  return (
    <TouchableOpacity style={styles.gridCard} onPress={onPress} activeOpacity={0.85}>
      {hasImage ? (
        <CachedImage
          uri={item.bannerImageUrl}
          style={styles.gridCardImage}
          resizeMode="cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <View style={styles.gridCardPlaceholder}>
          <CameraIcon />
        </View>
      )}
      <View style={styles.gridCardOverlay}>
        <Text style={styles.gridCardText} numberOfLines={1}>{item.name}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Empty card ─────────────────────────────────────────────────────────────

function EmptyCard({ label }: { label: string }) {
  return (
    <View style={styles.emptyCard}>
      <CameraIcon />
      <Text style={styles.emptyCardText}>{label}</Text>
    </View>
  );
}

// ─── Photo type ──────────────────────────────────────────────────────────────

type PhotoItem = {
  id: string;
  uri: string;
  activityId?: string | null;
  activityTitle?: string | null;
};

// ─── Photo thumbnail with loading state ──────────────────────────────────────

function PhotoThumb({ photo, onPress }: { photo: PhotoItem; onPress: () => void }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.thumb}>
      {!failed ? (
        <>
          <CachedImage
            uri={photo.uri}
            style={styles.thumbImg}
            resizeMode="cover"
            onLoad={() => setLoading(false)}
            onError={() => { setLoading(false); setFailed(true); }}
          />
          {loading && (
            <View style={styles.thumbLoader}>
              <ActivityIndicator size="small" color="#0d9488" />
            </View>
          )}
        </>
      ) : (
        <View style={styles.thumbError}>
          <CameraIcon />
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Full-screen preview with loading indicator ───────────────────────────────

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
          <CachedImage
            uri={photo.uri}
            style={styles.previewImg}
            resizeMode="contain"
            onLoad={() => setPreviewLoading(false)}
            onError={() => setPreviewLoading(false)}
          />
          {previewLoading && (
            <ActivityIndicator style={styles.previewLoader} size="large" color="#fff" />
          )}
        </>
      )}
    </View>
  );
}

// ─── Photos modal ─────────────────────────────────────────────────────────────

function PhotosModal({
  visible,
  title,
  onClose,
  parentId,
  parentType,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  parentId: string;
  parentType: 'trip' | 'event';
}) {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<PhotoItem | null>(null);

  useEffect(() => {
    if (!visible || !parentId) return;
    let cancelled = false;
    setLoading(true);
    setPhotos([]);
    const fetcher = parentType === 'trip'
      ? getTripPhotos(parentId)
      : getEventPhotos(parentId);
    fetcher
      .then((data) => {
        if (cancelled) return;
        const mapped: PhotoItem[] = (data.photos ?? []).map((ph: any) => ({
          id: ph.id,
          uri: ph.uri ?? ph.url ?? ph.fileUrl ?? '',
          activityId: ph.activityId ?? null,
          activityTitle: ph.activityTitle ?? null,
        }));
        setPhotos(mapped);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visible, parentId, parentType]);

  // Group: activity photos by activityTitle, then direct photos
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

  const renderThumb = (ph: PhotoItem) => (
    <PhotoThumb key={ph.id} photo={ph} onPress={() => setPreviewPhoto(ph)} />
  );

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={[styles.dialog, { maxHeight: '85%' }]}>
            {/* Header */}
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>{title}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <CloseIcon />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.dialogBody}>
                {loading && (
                  <View style={styles.modalLoadingRow}>
                    <ActivityIndicator color="#0d9488" />
                  </View>
                )}

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
                    {/* Activity groups */}
                    {Object.entries(activityGroups).map(([actTitle, actPhotos]) => (
                      <View key={actTitle} style={{ marginBottom: 16 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 }}>
                          <View style={{ width: 3, height: 14, backgroundColor: '#0d9488', borderRadius: 2 }} />
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a' }}>{actTitle}</Text>
                          <Text style={{ fontSize: 11, color: '#94a3b8' }}>({actPhotos.length})</Text>
                        </View>
                        <View style={styles.thumbRow}>
                          {actPhotos.map(renderThumb)}
                        </View>
                      </View>
                    ))}
                    {/* Direct photos */}
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
                          {directPhotos.map(renderThumb)}
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

      {/* Full-screen preview */}
      <Modal visible={!!previewPhoto} transparent animationType="fade" onRequestClose={() => setPreviewPhoto(null)}>
        <PreviewModal photo={previewPhoto} onClose={() => setPreviewPhoto(null)} />
      </Modal>
    </>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

interface GalleryTabProps {
  user: any;
  trips?: any[];           // fallback from HomeScreen
  onEditProfile: () => void;
  onNavigateToTrip: (trip: any) => void;
  onSetActiveTab: (tab: string) => void;
  onNavigateToEvent?: (event: any) => void;
}

export default function GalleryTab({
  user,
  trips: propTrips = [],
  onEditProfile,
  onSetActiveTab,
}: GalleryTabProps) {
  const [avatarError, setAvatarError] = useState(false);
  const [galleryTrips, setGalleryTrips] = useState<any[]>([]);
  const [galleryEvents, setGalleryEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Photo modal state
  const [photoModal, setPhotoModal] = useState<{ id: string; name: string; type: 'trip' | 'event' } | null>(null);

  const userId: string = user?.id ?? '';
  const displayName = user?.fullName ?? '';
  const handle = user?.username ?? displayName.toLowerCase().replace(/ /g, '_') ?? 'username';

  // Reset avatar error when photo URL changes
  useEffect(() => {
    setAvatarError(false);
  }, [user?.photoUrl]);

  // Fetch gallery data when userId is available
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    getUserGallery(userId)
      .then((data) => {
        if (cancelled) return;
        setGalleryTrips(data.trips ?? []);
        setGalleryEvents(data.events ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setGalleryTrips(propTrips);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const displayTrips = galleryTrips.length > 0 ? galleryTrips : propTrips;

  return (
    <>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ── Profile card ── */}
        <View style={styles.profileCard}>
          {/* Top row: avatar left, info right */}
          <View style={styles.profileRow}>
            <View style={styles.avatarWrap}>
              {user?.photoUrl && !avatarError ? (
                <Image
                  source={{ uri: user.photoUrl }}
                  style={styles.avatar}
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarInitial}>{displayName ? displayName[0].toUpperCase() : '?'}</Text>
                </View>
              )}
            </View>

            <View style={styles.profileInfo}>
              {displayName ? (
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{displayName}</Text>
                  <TouchableOpacity style={styles.editBtn} onPress={onEditProfile} activeOpacity={0.8}>
                    <EditIcon />
                  </TouchableOpacity>
                </View>
              ) : null}
              {handle ? <Text style={styles.handle}>@{handle}</Text> : null}
              {user?.country ? (
                <View style={styles.locationRow}>
                  <PinIcon color="#0d9488" size={13} />
                  <Text style={styles.locationText}>{user.country}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Bio below, centered */}
          {user?.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
        </View>

        {/* ── Loading spinner ── */}
        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#0d9488" />
          </View>
        )}

        {/* ── Gallery of Trips ── */}
        <SectionHeader
          title="Gallery of Trips"
          count={displayTrips.length}
          onAdd={() => onSetActiveTab('trips')}
          icon={<Plane size={20} color="#0d9488" />}
        />
        <View style={styles.grid}>
          {displayTrips.length > 0
            ? displayTrips.map((trip: any) => (
                <GridCard
                  key={trip.id}
                  item={trip}
                  onPress={() => setPhotoModal({ id: trip.id, name: trip.name, type: 'trip' })}
                />
              ))
            : !loading && <EmptyCard label="No past trips yet" />
          }
        </View>

        {/* ── Gallery of Events ── */}
        <View style={styles.sectionSpacer} />
        <SectionHeader
          title="Gallery of Events"
          count={galleryEvents.length}
          onAdd={() => onSetActiveTab('events')}
          icon={<CalendarDays size={20} color="#f59e0b" />}
        />
        <View style={styles.grid}>
          {galleryEvents.length > 0
            ? galleryEvents.map((ev: any) => (
                <GridCard
                  key={ev.id}
                  item={ev}
                  onPress={() => setPhotoModal({ id: ev.id, name: ev.name, type: 'event' })}
                />
              ))
            : !loading && <EmptyCard label="No past events yet" />
          }
        </View>

      </ScrollView>

      {/* ── Photos modal (outside ScrollView so it renders above) ── */}
      {photoModal && (
        <PhotosModal
          visible
          title={photoModal.name}
          parentId={photoModal.id}
          parentType={photoModal.type}
          onClose={() => setPhotoModal(null)}
        />
      )}
    </>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 4 },

  profileCard: { marginTop: 14, marginBottom: 28, alignItems: 'center' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 32 },
  avatarWrap: { position: 'relative' },
  profileInfo: { justifyContent: 'center', gap: 8 },
  avatar: { width: 112, height: 112, borderRadius: 56, borderWidth: 3, borderColor: '#0d9488' },
  avatarPlaceholder: { backgroundColor: '#f0fdfa', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 38, fontWeight: '700', color: '#0d9488' },
  editBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 3, elevation: 1,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 21, fontWeight: '700', color: '#0f172a' },
  handle: { fontSize: 15, color: '#0d9488', fontWeight: '500' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { fontSize: 15, color: '#64748b' },
  bio: { fontSize: 14, color: '#334155', textAlign: 'center', marginTop: 16, lineHeight: 22 },

  loadingRow: { alignItems: 'center', marginBottom: 12 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionIcon: { alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
  countBadge: {
    backgroundColor: '#f0fdfa', borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1, borderColor: '#ccfbf1',
  },
  countBadgeText: { fontSize: 12, fontWeight: '700', color: '#0d9488' },

  sectionSpacer: { height: 24 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  gridCard: { width: CARD_W, height: 140, borderRadius: 14, overflow: 'hidden', backgroundColor: '#f1f5f9' },
  gridCardImage: { width: '100%', height: '100%' },
  gridCardPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  gridCardOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 32,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  gridCardText: { color: '#fff', fontSize: 12, fontWeight: '600', lineHeight: 15 },

  emptyCard: {
    width: CARD_W, height: 140, borderRadius: 14,
    borderWidth: 2, borderColor: '#e2e8f0', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#fafafa',
  },
  emptyCardText: { fontSize: 12, color: '#cbd5e1', fontWeight: '500' },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  dialog: { width: '100%', backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden' },
  dialogHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
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

  // Full-screen preview
  previewBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', justifyContent: 'center', alignItems: 'center' },
  previewClose: {
    position: 'absolute', top: 48, left: 20, zIndex: 10,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  previewImg: { width: SCREEN_W, height: SCREEN_W * 1.2 },
  previewLoader: { position: 'absolute' },
});
