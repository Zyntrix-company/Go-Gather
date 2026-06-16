import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  Dimensions, StyleSheet, ActivityIndicator, Modal, Animated,
} from 'react-native';
import { albumChromeStyles as acs } from '../../constants/albumPhotosLayout';
import { useGalleryViewportHeroHeight } from '../../hooks/useGalleryViewportHeroHeight';
import AlbumPhotosFooter from '../../components/gallery/AlbumPhotosFooter';
import AlbumPhotosScreenLayout from '../../components/gallery/AlbumPhotosScreenLayout';
import AlbumPhotosHeroCarousel from '../../components/gallery/AlbumPhotosHeroCarousel';
import AlbumPhotosThumbStrip from '../../components/gallery/AlbumPhotosThumbStrip';
import GalleryAlbumSubHeader from '../../components/gallery/GalleryAlbumSubHeader';
import GalleryTravelersRow, { type GalleryTraveler } from '../../components/gallery/GalleryTravelersRow';
import GalleryEngagementSection from '../../components/gallery/GalleryEngagementSection';
import GalleryHeroMedia from '../../components/gallery/GalleryHeroMedia';
import { getTripMembers } from '../../api/trips.api';
import { getEventMembers } from '../../api/events.api';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useGalleryEngagement } from '../../hooks/useGalleryEngagement';
import useAuthStore from '../../store/authStore';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { UserMinus } from 'lucide-react-native';
import CachedImage from '../../components/common/CachedImage';
import AppScreenLayout, { TAB_BAR_SCROLL_PADDING } from '../../components/common/AppScreenLayout';
import { getUserProfile, removeFriend, handleApiError } from '../../api/trips.api';
import { showConfirm } from '../../store/alertStore';
import Toast from 'react-native-toast-message';
import { getUserGallery } from '../../api/ai.api';
import { getUserGalleryAlbumPhotos, getUserGalleryItemPhotos } from '../../api/gallery.api';
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
  return (
    <TouchableOpacity style={styles.gridCard} onPress={onPress} activeOpacity={0.85}>
      {hasImage ? (
        <CachedImage uri={item.bannerImageUrl} style={styles.gridCardImage} resizeMode="cover" onError={() => setImgError(true)} />
      ) : (
        <View style={styles.gridCardPlaceholder}><CameraIcon /></View>
      )}
      <View style={styles.gridCardOverlay}>
        <Text style={styles.gridCardText} numberOfLines={1}>{item.name}</Text>
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

// ─── Profile skeleton ─────────────────────────────────────────────────────────

const fpSkStyles = StyleSheet.create({
  profileCard: { marginTop: 14, marginBottom: 28, alignItems: 'center' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 32, alignSelf: 'stretch' },
  avatar: { width: 112, height: 112, borderRadius: 56, backgroundColor: '#e2e8f0' },
  profileInfo: { flex: 1, gap: 8 },
  nameBar: { width: 160, height: 20, borderRadius: 6, backgroundColor: '#e2e8f0' },
  handleBar: { width: 100, height: 16, borderRadius: 5, backgroundColor: '#e2e8f0' },
  locationBar: { width: 80, height: 14, borderRadius: 5, backgroundColor: '#e2e8f0' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  iconBox: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#e2e8f0' },
  titleBar: { width: 120, height: 16, borderRadius: 6, backgroundColor: '#e2e8f0' },
  card: { width: CARD_W, height: 140, borderRadius: 14, backgroundColor: '#E8E4DF' },
});

function FriendProfileSkeleton() {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.85, duration: 750, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 750, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  const cardKeys = [0, 1, 2, 3];

  return (
    <Animated.View style={{ opacity: pulse }}>
      <View style={fpSkStyles.profileCard}>
        <View style={fpSkStyles.profileRow}>
          <View style={fpSkStyles.avatar} />
          <View style={fpSkStyles.profileInfo}>
            <View style={fpSkStyles.nameBar} />
            <View style={fpSkStyles.handleBar} />
            <View style={fpSkStyles.locationBar} />
          </View>
        </View>
      </View>
      <View style={fpSkStyles.header}>
        <View style={fpSkStyles.iconBox} />
        <View style={fpSkStyles.titleBar} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {cardKeys.map(k => <View key={k} style={fpSkStyles.card} />)}
      </View>
      <View style={{ height: 24 }} />
      <View style={fpSkStyles.header}>
        <View style={fpSkStyles.iconBox} />
        <View style={fpSkStyles.titleBar} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {cardKeys.map(k => <View key={k} style={fpSkStyles.card} />)}
      </View>
    </Animated.View>
  );
}

type PhotoItem = { id: string; uri: string; localUri?: string; mimeType?: string | null; activityId?: string | null; activityTitle?: string | null; createdAt?: string | null };

function CustomAlbumPhotosModal({
  visible,
  title,
  albumId,
  userId,
  onClose,
}: {
  visible: boolean;
  title: string;
  albumId: string;
  userId: string;
  onClose: () => void;
}) {
  const navigation = useNavigation<any>();
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const heroFlatListRef = useRef<any>(null);

  const engagement = useGalleryEngagement({
    kind: 'custom',
    enabled: visible && !!albumId,
    albumId,
  });

  const heroHeight = useGalleryViewportHeroHeight({
    hasFooter: true,
    hasMetaCard: true,
  });

  useEffect(() => {
    if (visible) setHeroIndex(0);
  }, [visible]);

  useEffect(() => {
    if (!visible || !albumId) return;
    setLoading(true);
    getUserGalleryAlbumPhotos(userId, albumId)
      .then((res) => setPhotos(res.photos.map((p) => ({
        id: p.id,
        uri: p.uri ?? '',
        mimeType: (p as { mimeType?: string }).mimeType ?? null,
      }))))
      .catch(() => setPhotos([]))
      .finally(() => setLoading(false));
  }, [visible, albumId, userId]);

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <AlbumPhotosScreenLayout
        navigation={navigation}
        activeTab="friends"
        galleryChrome
        onClose={onClose}
        photoIndex={heroIndex}
        photoTotal={photos.length}
        footer={<AlbumPhotosFooter viewOnly aboveTabBar />}
      >
        <View style={fpGalleryStyles.albumBody}>
          <AlbumPhotosHeroCarousel
            galleryChrome
            photos={photos}
            heroIndex={heroIndex}
            onIndexChange={setHeroIndex}
            heroRef={heroFlatListRef}
            loading={loading}
            fixedHeight={heroHeight}
            showPagerDots={false}
            renderPhoto={(item, index) => (
              <GalleryHeroMedia photo={item} active={index === heroIndex} />
            )}
          />
          <AlbumPhotosThumbStrip
            photos={photos}
            heroIndex={heroIndex}
            transparent
            galleryChrome
            onSelect={(idx) => {
              setHeroIndex(idx);
              heroFlatListRef.current?.scrollToIndex({ index: idx, animated: true });
            }}
          />
          <View style={acs.metaCardTransparent}>
            <Text style={acs.metaTitle} numberOfLines={1}>{title}</Text>
            <View style={acs.metaRow}>
              <View style={{ backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
                <Text style={{ fontSize: 10, fontWeight: '600', color: '#0d9488' }}>Custom album</Text>
              </View>
              <Text style={acs.metaCount}>
                {photos.length === 0 ? 'No photos' : `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}`}
              </Text>
            </View>
          </View>
          <GalleryEngagementSection
            likeCount={engagement.likeCount}
            likedByMe={engagement.likedByMe}
            comments={engagement.comments}
            scrollableComments
            onToggleLike={engagement.handleToggleLike}
            onAddComment={engagement.handleAddComment}
            onEditComment={engagement.handleEditComment}
            onDeleteComment={engagement.handleDeleteComment}
          />
        </View>
      </AlbumPhotosScreenLayout>
    </Modal>
  );
}

function PhotosModal({ visible, title, location, onClose, parentId, parentType, userId, gallerySubtitle, galleryHideTravelers = false }: {
  visible: boolean; title: string; location?: string | null; onClose: () => void;
  parentId: string; parentType: 'trip' | 'event'; userId?: string; gallerySubtitle?: string | null;
  galleryHideTravelers?: boolean;
}) {
  const navigation = useNavigation<any>();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const heroFlatListRef = useRef<any>(null);
  const localUriCache = useRef<Record<string, string>>({});
  const [members, setMembers] = useState<GalleryTraveler[]>([]);

  const engagement = useGalleryEngagement({
    kind: 'trip-event',
    enabled: visible && !!parentId,
    parentType,
    parentId,
    galleryOwnerId: userId,
  });

  const canModerateComments = members.some((m) => m.userId === currentUserId);

  useEffect(() => {
    if (visible) setHeroIndex(0);
  }, [visible]);

  useEffect(() => {
    if (!visible || !parentId) return;
    let cancelled = false;
    const capturedCache = { ...localUriCache.current };
    setLoading(true);
    setPhotos([]);

    let fetcher: Promise<{ photos?: any[] }>;
    if (userId) {
      fetcher = getUserGalleryItemPhotos(userId, parentType, parentId);
    } else {
      fetcher = Promise.resolve({ photos: [] });
    }

    fetcher
      .then((data) => {
        if (cancelled) return;
        const mapped: PhotoItem[] = (data.photos ?? []).map((ph: any) => ({
          id: ph.id,
          uri: ph.uri ?? ph.url ?? ph.fileUrl ?? '',
          localUri: capturedCache[ph.id],
          mimeType: ph.mimeType ?? null,
          activityId: ph.activityId ?? null,
          activityTitle: ph.activityTitle ?? null,
          displayOrder: ph.displayOrder ?? null,
          createdAt: ph.createdAt ?? null,
        }));
        setPhotos(mapped);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visible, parentId, parentType, userId]);

  useEffect(() => {
    if (!visible || !parentId) return;
    let cancelled = false;

    const membersFetcher = parentType === 'trip'
      ? getTripMembers(parentId).then((r) => r.members.map((m) => ({
          userId: m.userId,
          fullName: m.fullName,
          avatarUrl: m.avatarUrl,
        })))
      : getEventMembers(parentId).then((r) => r.members.map((m) => ({
          userId: m.userId,
          fullName: m.fullName,
          avatarUrl: m.avatarUrl,
        })));

    membersFetcher
      .then((memberList) => {
        if (!cancelled) setMembers(memberList);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });

    return () => { cancelled = true; };
  }, [visible, parentId, parentType]);

  const showTravelersRow = parentType === 'trip' && members.length > 0 && !galleryHideTravelers;
  const currentPhoto = photos[heroIndex];
  const activityLabel = currentPhoto?.activityTitle?.trim() || null;
  const hasDescription = !!gallerySubtitle?.trim();
  const heroHeight = useGalleryViewportHeroHeight({
    hasTravelers: showTravelersRow,
    hasDescription,
  });

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <AlbumPhotosScreenLayout
        navigation={navigation}
        activeTab="friends"
        galleryChrome
        onClose={onClose}
        subHeader={
          <GalleryAlbumSubHeader
            title={title}
            location={location}
            viewOnly
            onBack={onClose}
          />
        }
      >
        <View style={fpGalleryStyles.albumBody}>
          <AlbumPhotosHeroCarousel
            galleryChrome
            photos={photos}
            heroIndex={heroIndex}
            onIndexChange={setHeroIndex}
            heroRef={heroFlatListRef}
            loading={loading}
            fixedHeight={heroHeight}
            showPagerDots={false}
            activityLabel={activityLabel}
            renderPhoto={(item, index) => (
              <GalleryHeroMedia photo={item} active={index === heroIndex} />
            )}
          />
          <AlbumPhotosThumbStrip
            photos={photos}
            heroIndex={heroIndex}
            transparent
            galleryChrome
            onSelect={(idx) => {
              setHeroIndex(idx);
              heroFlatListRef.current?.scrollToIndex({ index: idx, animated: true });
            }}
          />
          {gallerySubtitle?.trim() ? (
            <Text style={fpGalleryStyles.description} numberOfLines={2}>{gallerySubtitle}</Text>
          ) : null}
          {showTravelersRow ? <GalleryTravelersRow members={members} /> : null}
          <GalleryEngagementSection
            likeCount={engagement.likeCount}
            likedByMe={engagement.likedByMe}
            comments={engagement.comments}
            canModerateComments={canModerateComments}
            scrollableComments
            onToggleLike={engagement.handleToggleLike}
            onAddComment={engagement.handleAddComment}
            onEditComment={engagement.handleEditComment}
            onDeleteComment={engagement.handleDeleteComment}
          />
        </View>
      </AlbumPhotosScreenLayout>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

type RouteParams = { userId: string; friendName: string; avatarUrl?: string | null };

export default function FriendProfileScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ FriendProfile: RouteParams }, 'FriendProfile'>>();
  const { userId, friendName, avatarUrl: paramAvatarUrl } = route.params;

  const [profile, setProfile] = useState<Awaited<ReturnType<typeof getUserProfile>> | null>(null);
  const [galleryTrips, setGalleryTrips] = useState<any[]>([]);
  const [galleryEvents, setGalleryEvents] = useState<any[]>([]);
  const [customTripAlbums, setCustomTripAlbums] = useState<any[]>([]);
  const [customEventAlbums, setCustomEventAlbums] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [avatarError, setAvatarError] = useState(false);
  const [photoModal, setPhotoModal] = useState<{
    id: string;
    name: string;
    type: 'trip' | 'event';
    subtitle?: string | null;
    hideTravelers?: boolean;
    location?: string | null;
  } | null>(null);
  const [customAlbumModal, setCustomAlbumModal] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => { setAvatarError(false); }, [profile?.avatarUrl, paramAvatarUrl]);

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
        setCustomTripAlbums(gallery.customAlbums?.trip ?? []);
        setCustomEventAlbums(gallery.customAlbums?.event ?? []);
      })
      .catch((err) => { console.error('[FriendProfileScreen] load failed', err?.response?.data ?? err?.message ?? err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  const displayName = profile?.name ?? friendName;
  const handle = profile?.username ? `@${profile.username}` : '';
  const initial = displayName?.[0]?.toUpperCase() ?? '?';
  const resolvedAvatarUrl = profile?.avatarUrl || paramAvatarUrl || null;

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
    <>
      <AppScreenLayout navigation={navigation} activeTab="friends">
        {loading ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: TAB_BAR_SCROLL_PADDING }]}>
            <FriendProfileSkeleton />
          </ScrollView>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: TAB_BAR_SCROLL_PADDING }]}>

            {/* ── Profile card ── */}
            <View style={styles.profileCard}>
              {/* Top row: avatar left, info right */}
              <View style={styles.profileRow}>
                <View style={styles.avatarWrap}>
                  {resolvedAvatarUrl && !avatarError ? (
                    <CachedImage
                      uri={resolvedAvatarUrl}
                      style={styles.avatar}
                      resizeMode="cover"
                      priority="high"
                      onError={() => setAvatarError(true)}
                    />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Text style={styles.avatarInitial}>{initial}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.profileInfo}>
                  {displayName ? (
                    <View style={styles.nameRow}>
                      <Text style={styles.name} numberOfLines={2}>{displayName}</Text>
                      {profile?.friendshipStatus === 'accepted' && (
                        <TouchableOpacity
                          style={styles.removeFriendBtn}
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
                      <PinIcon color="#0d9488" size={12} />
                      <Text style={styles.locationText}>{profile.country}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Bio below, centered */}
              {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

            </View>

            {/* ── Trips ── */}
            <SectionHeader
              title="Trips"
              count={galleryTrips.length + customTripAlbums.length}
              icon={<Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" stroke="#0d9488" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>}
            />
            <View style={styles.grid}>
              {galleryTrips.map((trip: any) => (
                <GridCard key={trip.id} item={trip} onPress={() => setPhotoModal({
                  id: trip.id,
                  name: trip.name,
                  type: 'trip',
                  subtitle: trip.gallerySubtitle ?? null,
                  hideTravelers: trip.galleryHideTravelers ?? false,
                  location: trip.location ?? null,
                })} />
              ))}
              {customTripAlbums.map((album: any) => (
                <GridCard key={`custom-${album.id}`} item={album} onPress={() => setCustomAlbumModal({ id: album.id, name: album.name })} />
              ))}
              {galleryTrips.length === 0 && customTripAlbums.length === 0 && (
                <EmptyCard label="No past trips yet" />
              )}
            </View>

            {/* ── Events ── */}
            <View style={styles.sectionSpacer} />
            <SectionHeader
              title="Events"
              count={galleryEvents.length + customEventAlbums.length}
              icon={<Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Rect x={3} y={4} width={18} height={18} rx={2} ry={2} stroke="#f59e0b" strokeWidth={2} /><Path d="M16 2v4M8 2v4M3 10h18" stroke="#f59e0b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>}
            />
            <View style={styles.grid}>
              {galleryEvents.map((ev: any) => (
                <GridCard key={ev.id} item={ev} onPress={() => setPhotoModal({ id: ev.id, name: ev.name, type: 'event', subtitle: ev.gallerySubtitle ?? null, location: ev.location ?? null })} />
              ))}
              {customEventAlbums.map((album: any) => (
                <GridCard key={`custom-${album.id}`} item={album} onPress={() => setCustomAlbumModal({ id: album.id, name: album.name })} />
              ))}
              {galleryEvents.length === 0 && customEventAlbums.length === 0 && (
                <EmptyCard label="No past events yet" />
              )}
            </View>

          </ScrollView>
        )}
      </AppScreenLayout>

      {photoModal && (
        <PhotosModal
          visible
          title={photoModal.name}
          location={photoModal.location}
          parentId={photoModal.id}
          parentType={photoModal.type}
          userId={userId}
          gallerySubtitle={photoModal.subtitle}
          galleryHideTravelers={photoModal.hideTravelers ?? false}
          onClose={() => setPhotoModal(null)}
        />
      )}

      {customAlbumModal && (
        <CustomAlbumPhotosModal
          visible
          title={customAlbumModal.name}
          albumId={customAlbumModal.id}
          userId={userId}
          onClose={() => setCustomAlbumModal(null)}
        />
      )}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const fpGalleryStyles = StyleSheet.create({
  albumBody: {
    flex: 1,
    minHeight: 0,
  },
  description: {
    fontSize: 13,
    fontWeight: '400',
    color: '#64748b',
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 0,
    flexShrink: 0,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  backRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  screenTitle: { fontSize: 18, fontWeight: '500', color: '#45556C', marginLeft: 12, flex: 1 },

  scrollContent: { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 4 },

  // Profile card — typography and spacing aligned with GalleryTab (friend-only chrome kept)
  profileCard: { marginTop: 14, marginBottom: 28, alignItems: 'center' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 32 },
  avatarWrap: { position: 'relative' },
  profileInfo: { justifyContent: 'center', gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  removeFriendBtn: { alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 112, height: 112, borderRadius: 56, borderWidth: 3, borderColor: '#0d9488' },
  avatarPlaceholder: { backgroundColor: '#f0fdfa', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 38, fontWeight: '700', color: '#0d9488' },
  name: { fontSize: 18, fontWeight: '400', color: '#0F172B', lineHeight: 22 },
  handle: { fontSize: 14, color: '#0d9488', fontWeight: '500' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { fontSize: 14, color: '#45556C' },
  bio: { fontSize: 14, color: '#45556C', textAlign: 'center', marginTop: 12, lineHeight: 20 },

  // Sections — match GalleryTab
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionIcon: { alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '400', color: '#0F172B' },
  countBadge: { backgroundColor: '#f0fdfa', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: '#ccfbf1' },
  countBadgeText: { fontSize: 12, fontWeight: '700', color: '#0d9488' },
  sectionSpacer: { height: 24 },

  // Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridCard: { width: CARD_W, height: 140, borderRadius: 14, overflow: 'hidden', backgroundColor: '#f1f5f9' },
  gridCardTall: { height: 160 },
  gridCardImage: { width: '100%', height: '100%' },
  gridCardPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  gridCardOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 32, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', paddingHorizontal: 8 },
  gridCardOverlayTall: { height: 50, justifyContent: 'center', paddingVertical: 6 },
  gridCardText: { color: '#fff', fontSize: 12, fontWeight: '400', lineHeight: 15 },
  gridCardSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '400', lineHeight: 14, marginTop: 2 },
  cardChip: {
    position: 'absolute', top: 8, left: 8,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 6, zIndex: 10,
  },
  cardChipText: { fontSize: 10, fontWeight: '600', color: '#fff', letterSpacing: 0.4 },
  emptyCard: { width: CARD_W, height: 140, borderRadius: 14, borderWidth: 2, borderColor: '#e2e8f0', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#fafafa' },
  emptyCardText: { fontSize: 12, color: '#cbd5e1', fontWeight: '500' },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  dialog: { width: '100%', backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden' },
  dialogHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dialogTitle: { fontSize: 17, fontWeight: '500', color: '#0f172a' },
  dialogBody: { padding: 16 },
  modalLoadingRow: { alignItems: 'center', paddingVertical: 32 },
  emptyCenter: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '400', color: '#334155' },
  emptySub: { fontSize: 13, color: '#94a3b8', textAlign: 'center' },

  modalSubtitleText: { fontSize: 13, color: '#0d9488', fontWeight: '300', fontStyle: 'italic', marginTop: 3 },
});
