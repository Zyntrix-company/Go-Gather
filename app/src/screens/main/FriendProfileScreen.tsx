import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  Dimensions, StyleSheet, ActivityIndicator, Modal, Animated, FlatList,
} from 'react-native';
import { ALBUM_HERO_H, ALBUM_THUMB_H, ALBUM_THUMB_W, albumChromeStyles as acs } from '../../constants/albumPhotosLayout';
import AlbumPhotosFooter from '../../components/gallery/AlbumPhotosFooter';
import AlbumPhotosScreenLayout from '../../components/gallery/AlbumPhotosScreenLayout';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { UserMinus } from 'lucide-react-native';
import CachedImage from '../../components/common/CachedImage';
import AppScreenLayout, { TAB_BAR_SCROLL_PADDING } from '../../components/common/AppScreenLayout';
import { getUserProfile, removeFriend, handleApiError } from '../../api/trips.api';
import { showConfirm } from '../../store/alertStore';
import Toast from 'react-native-toast-message';
import { getUserGallery, getUserPhotos } from '../../api/ai.api';
import { getUserGalleryAlbumPhotos } from '../../api/gallery.api';
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

type PhotoItem = { id: string; uri: string; localUri?: string; activityId?: string | null; activityTitle?: string | null };

function PhotoThumb({ photo, onPress }: { photo: PhotoItem; onPress: () => void }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const displayUri = photo.localUri ?? photo.uri;
  const prevUri = useRef(displayUri);
  useEffect(() => {
    if (prevUri.current !== displayUri) {
      prevUri.current = displayUri;
      setFailed(false);
      setLoading(true);
    }
  }, [displayUri]);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.thumb}>
      {!failed ? (
        <>
          <CachedImage uri={displayUri} style={styles.thumbImg} resizeMode="cover" onLoad={() => setLoading(false)} onError={() => { setLoading(false); setFailed(true); }} />
          {loading && <View style={styles.thumbLoader}><ActivityIndicator size="small" color="#0d9488" /></View>}
        </>
      ) : (
        <View style={styles.thumbError}><CameraIcon /></View>
      )}
    </TouchableOpacity>
  );
}

function PreviewItem({ photo }: { photo: PhotoItem }) {
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); }, [photo.uri]);
  return (
    <View style={{ width: SCREEN_W, flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <CachedImage uri={photo.localUri ?? photo.uri} style={styles.previewImg} resizeMode="contain" onLoad={() => setLoading(false)} onError={() => setLoading(false)} />
      {loading && <ActivityIndicator style={styles.previewLoader} size="large" color="#fff" />}
    </View>
  );
}

function PreviewModal({ photos, initialIndex, onClose }: {
  photos: PhotoItem[];
  initialIndex: number;
  onClose: () => void;
}) {
  const listRef = useRef<any>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  return (
    <View style={styles.previewBg}>
      <TouchableOpacity onPress={onClose} style={styles.previewClose} activeOpacity={0.8}>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path d="M18 6L6 18M6 6l12 12" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </TouchableOpacity>
      <FlatList
        ref={listRef}
        data={photos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
        style={{ flex: 1, alignSelf: 'stretch' }}
        onMomentumScrollEnd={e => setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
        renderItem={({ item }) => <PreviewItem photo={item} />}
        keyExtractor={item => item.id}
      />
      {photos.length > 1 && (
        <View style={styles.previewCounter}>
          <Text style={styles.previewCounterText}>{currentIndex + 1} / {photos.length}</Text>
        </View>
      )}
    </View>
  );
}

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
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const heroFlatListRef = useRef<any>(null);

  useEffect(() => {
    if (visible) setHeroIndex(0);
  }, [visible]);

  useEffect(() => {
    if (!visible || !albumId) return;
    setLoading(true);
    getUserGalleryAlbumPhotos(userId, albumId)
      .then((res) => setPhotos(res.photos.map((p) => ({ id: p.id, uri: p.uri ?? '' }))))
      .catch(() => setPhotos([]))
      .finally(() => setLoading(false));
  }, [visible, albumId, userId]);

  return (
    <>
      <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
        <AlbumPhotosScreenLayout
          navigation={navigation}
          activeTab="friends"
          onClose={onClose}
          photoIndex={heroIndex}
          photoTotal={photos.length}
          footer={<AlbumPhotosFooter viewOnly aboveTabBar />}
        >
          <ScrollView showsVerticalScrollIndicator={false} bounces={false} style={{ flex: 1 }}>
            <TouchableOpacity
              activeOpacity={photos.length > 0 ? 0.95 : 1}
              onPress={() => { if (photos.length > 0) setPreviewIndex(heroIndex); }}
            >
              <View style={{ height: ALBUM_HERO_H, backgroundColor: '#0f172a' }}>
                {loading ? (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color="#5eead4" />
                  </View>
                ) : photos.length > 0 ? (
                  <FlatList
                    ref={heroFlatListRef}
                    data={photos}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    initialScrollIndex={heroIndex}
                    getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
                    onMomentumScrollEnd={e => setHeroIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
                    renderItem={({ item }) => (
                      <View style={{ width: SCREEN_W, height: ALBUM_HERO_H }}>
                        <FriendHeroPhoto photo={item} />
                      </View>
                    )}
                    keyExtractor={item => item.id}
                  />
                ) : (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>No photos yet</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>

            {photos.length > 0 && (
              <View style={acs.thumbStrip}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 6, flexDirection: 'row' }}>
                  {photos.map((ph, idx) => (
                    <TouchableOpacity
                      key={ph.id}
                      onPress={() => {
                        setHeroIndex(idx);
                        heroFlatListRef.current?.scrollToIndex({ index: idx, animated: true });
                        setPreviewIndex(idx);
                      }}
                      activeOpacity={0.85}
                      style={{
                        width: ALBUM_THUMB_W, height: ALBUM_THUMB_H, borderRadius: 8, overflow: 'hidden',
                        borderWidth: idx === heroIndex ? 2 : 0,
                        borderColor: '#0d9488',
                        backgroundColor: '#e2e8f0',
                      }}
                    >
                      <CachedImage uri={ph.uri} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={acs.metaCard}>
              <Text style={acs.metaTitle} numberOfLines={2}>{title}</Text>
              <View style={acs.metaRow}>
                <View style={{ backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: '#0d9488' }}>Custom album</Text>
                </View>
                <Text style={acs.metaCount}>
                  {photos.length === 0 ? 'No photos' : `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}`}
                </Text>
              </View>
            </View>
          </ScrollView>
        </AlbumPhotosScreenLayout>
      </Modal>
      <Modal visible={previewIndex !== null} transparent animationType="fade" onRequestClose={() => setPreviewIndex(null)}>
        <PreviewModal photos={photos} initialIndex={previewIndex ?? 0} onClose={() => setPreviewIndex(null)} />
      </Modal>
    </>
  );
}

function FriendHeroPhoto({ photo }: { photo: PhotoItem }) {
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
        <View style={{ ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' }}>
          <ActivityIndicator size="large" color="#5eead4" />
        </View>
      )}
    </View>
  );
}

function PhotosModal({ visible, title, onClose, parentId, parentType, userId, gallerySubtitle }: {
  visible: boolean; title: string; onClose: () => void;
  parentId: string; parentType: 'trip' | 'event'; userId?: string; gallerySubtitle?: string | null;
}) {
  const navigation = useNavigation<any>();
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);
  const heroFlatListRef = useRef<any>(null);
  const localUriCache = useRef<Record<string, string>>({});

  useEffect(() => {
    if (visible) { setHeroIndex(0); setDescExpanded(false); }
  }, [visible]);

  useEffect(() => {
    if (!visible || !parentId) return;
    let cancelled = false;
    const capturedCache = { ...localUriCache.current };
    setLoading(true);
    setPhotos([]);

    let fetcher: Promise<{ photos?: any[] }>;
    if (userId) {
      fetcher = getUserPhotos(userId, { parentType, parentId }).then((data) => {
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
        const mapped: PhotoItem[] = (data.photos ?? []).map((ph: any) => ({
          id: ph.id,
          uri: ph.uri ?? ph.url ?? ph.fileUrl ?? '',
          localUri: capturedCache[ph.id],
          activityId: ph.activityId ?? null,
          activityTitle: ph.activityTitle ?? null,
        }));
        // Direct photos first, then activity photos
        setPhotos([...mapped.filter(p => !p.activityId), ...mapped.filter(p => !!p.activityId)]);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visible, parentId, parentType, userId]);

  const heroPhoto = photos.length > 0 ? photos[Math.min(heroIndex, photos.length - 1)] : null;
  const isActivityPhoto = !!(heroPhoto?.activityTitle);
  const dynamicTitle = isActivityPhoto ? heroPhoto!.activityTitle! : title;

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <AlbumPhotosScreenLayout
        navigation={navigation}
        activeTab="friends"
        onClose={onClose}
        photoIndex={heroIndex}
        photoTotal={photos.length}
        footer={<AlbumPhotosFooter viewOnly aboveTabBar />}
      >
        <ScrollView showsVerticalScrollIndicator={false} bounces={false} style={{ flex: 1 }}>
          <View style={{ height: ALBUM_HERO_H, backgroundColor: '#0f172a' }}>
            {loading ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color="#5eead4" />
              </View>
            ) : photos.length > 0 ? (
              <FlatList
                ref={heroFlatListRef}
                data={photos}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                initialScrollIndex={heroIndex}
                getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
                onMomentumScrollEnd={e => setHeroIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
                renderItem={({ item }) => (
                  <View style={{ width: SCREEN_W, height: ALBUM_HERO_H }}>
                    <FriendHeroPhoto photo={item} />
                  </View>
                )}
                keyExtractor={item => item.id}
              />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
                  <Rect x={3} y={3} width={18} height={18} rx={2} stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} />
                  <Circle cx={8.5} cy={8.5} r={1.5} fill="rgba(255,255,255,0.25)" />
                  <Path d="M21 15l-5-5L5 21" stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 8 }}>No photos yet</Text>
              </View>
            )}
          </View>

          {photos.length > 0 && (
            <View style={acs.thumbStrip}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 6, flexDirection: 'row' }}>
                {photos.map((ph, idx) => {
                  const thumbUri = ph.localUri ?? ph.uri;
                  return (
                    <TouchableOpacity
                      key={ph.id}
                      onPress={() => { setHeroIndex(idx); heroFlatListRef.current?.scrollToIndex({ index: idx, animated: true }); }}
                      activeOpacity={0.85}
                      style={{
                        width: ALBUM_THUMB_W, height: ALBUM_THUMB_H, borderRadius: 8, overflow: 'hidden',
                        borderWidth: idx === heroIndex ? 2 : 0,
                        borderColor: '#0d9488',
                        backgroundColor: '#e2e8f0',
                      }}
                    >
                      <CachedImage uri={thumbUri} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <View style={acs.metaCard}>
            {isActivityPhoto && (
              <Text style={{ fontSize: 10, fontWeight: '600', color: '#0d9488', letterSpacing: 0.4, marginBottom: 4 }}>ACTIVITY</Text>
            )}
            <Text style={acs.metaTitle} numberOfLines={2}>{dynamicTitle}</Text>
            {isActivityPhoto && (
              <Text style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>from {title}</Text>
            )}
            {gallerySubtitle?.trim() ? (
              <>
                <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }} numberOfLines={descExpanded ? undefined : 2}>
                  {gallerySubtitle}
                </Text>
                {gallerySubtitle.length > 80 && (
                  <TouchableOpacity onPress={() => setDescExpanded(v => !v)} activeOpacity={0.7}>
                    <Text style={{ fontSize: 12, color: '#0d9488', fontWeight: '600' }}>{descExpanded ? 'Show less' : 'Read more'}</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : null}
            <View style={acs.metaRow}>
              <View style={{ backgroundColor: parentType === 'trip' ? '#f0fdf4' : '#fdf2f8', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 }}>
                <Text style={{ fontSize: 10, fontWeight: '600', color: parentType === 'trip' ? '#0d9488' : '#db2777' }}>
                  {parentType === 'trip' ? 'Trip' : 'Event'}
                </Text>
              </View>
              <Text style={acs.metaCount}>
                {photos.length === 0 ? 'No photos' : `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}`}
              </Text>
            </View>
          </View>
        </ScrollView>
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
  const [photoModal, setPhotoModal] = useState<{ id: string; name: string; type: 'trip' | 'event'; subtitle?: string | null } | null>(null);
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
                <GridCard key={trip.id} item={trip} onPress={() => setPhotoModal({ id: trip.id, name: trip.name, type: 'trip', subtitle: trip.gallerySubtitle ?? null })} />
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
                <GridCard key={ev.id} item={ev} onPress={() => setPhotoModal({ id: ev.id, name: ev.name, type: 'event', subtitle: ev.gallerySubtitle ?? null })} />
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
          parentId={photoModal.id}
          parentType={photoModal.type}
          userId={userId}
          gallerySubtitle={photoModal.subtitle}
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

  thumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: 80, height: 80, borderRadius: 8, overflow: 'hidden', backgroundColor: '#e2e8f0' },
  thumbImg: { width: 80, height: 80, borderRadius: 8 },
  thumbLoader: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e2e8f0' },
  thumbError: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },

  previewBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' },
  previewClose: { position: 'absolute', top: 48, left: 20, zIndex: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  previewImg: { width: SCREEN_W, height: SCREEN_W * 1.2 },
  previewLoader: { position: 'absolute' },
  previewCounter: { position: 'absolute', bottom: 36, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  previewCounterText: { color: '#fff', fontSize: 13, fontWeight: '300' },

  modalSubtitleText: { fontSize: 13, color: '#0d9488', fontWeight: '300', fontStyle: 'italic', marginTop: 3 },
});
