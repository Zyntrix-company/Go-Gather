import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Image,
  Dimensions, StyleSheet, ActivityIndicator, Modal, TextInput, Animated, FlatList,
} from 'react-native';
import { showConfirm } from '../../store/alertStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';
import CachedImage from '../../components/common/CachedImage';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { Plane, CalendarDays, PencilLine, Pen } from 'lucide-react-native';
import { getUserGallery, getUserPhotos, upsertGallerySubtitle } from '../../api/ai.api';
import { getTripPhotos, uploadTripPhotos, deleteTripPhoto, updateTrip } from '../../api/trips.api';
import { getEventPhotos, uploadEventPhotos, deleteEventPhoto, updateEvent } from '../../api/events.api';
import Toast from 'react-native-toast-message';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = (SCREEN_W - 52) / 2;

// ─── Icons ─────────────────────────────────────────────────────────────────

const PinIcon = ({ color = '#94a3b8', size = 13 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx={12} cy={10} r={3} stroke={color} strokeWidth={2} />
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

const XIcon = ({ color = '#fff', size = 13 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M18 6L6 18M6 6l12 12" stroke={color} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const CheckIcon = () => (
  <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
    <Path d="M20 6L9 17l-5-5" stroke="#0d9488" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
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

// ─── Gallery grid card ────────────────────────────────────────────────────────

const CHIP_CONFIG = {
  'custom-trip':  { label: 'Custom', bg: '#0d9488' },
  'custom-event': { label: 'Custom', bg: '#f59e0b' },
} as const;

type ChipType = keyof typeof CHIP_CONFIG;

function GridCard({ item, onPress, onLongPress, chip }: { item: any; onPress: () => void; onLongPress?: () => void; chip?: ChipType }) {
  const [imgError, setImgError] = useState(false);
  const hasImage = item.bannerImageUrl && !imgError;
  const borderColor = chip ? CHIP_CONFIG[chip].bg : undefined;

  return (
    <TouchableOpacity
      style={[styles.gridCard, borderColor && { borderWidth: 3, borderColor }]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      activeOpacity={0.85}
    >
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

// ─── Gallery skeleton ────────────────────────────────────────────────────────

const skStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  iconBox: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#e2e8f0' },
  titleBar: { width: 120, height: 16, borderRadius: 6, backgroundColor: '#e2e8f0' },
  card: { width: CARD_W, height: 140, borderRadius: 14, backgroundColor: '#E8E4DF' },
});

function GallerySkeleton() {
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
      <View style={skStyles.header}>
        <View style={skStyles.iconBox} />
        <View style={skStyles.titleBar} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {cardKeys.map(k => <View key={k} style={skStyles.card} />)}
      </View>
      <View style={{ height: 24 }} />
      <View style={skStyles.header}>
        <View style={skStyles.iconBox} />
        <View style={skStyles.titleBar} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {cardKeys.map(k => <View key={k} style={skStyles.card} />)}
      </View>
    </Animated.View>
  );
}

// ─── Types ──────────────────────────────────────────────────────────────────

type PhotoItem = {
  id: string;
  uri: string;
  localUri?: string;   // local file:// URI from picker — shown optimistically, survives refetch
  activityId?: string | null;
  activityTitle?: string | null;
};

type CustomCard = {
  id: string;
  name: string;
  bannerImageUrl?: string;
  type: 'trip' | 'event';
  photos: PhotoItem[];
};

function customCardsStorageKey(userId: string) {
  return `gogather_gallery_custom_cards_${userId}`;
}

// ─── Photo thumbnail with loading state ──────────────────────────────────────

function PhotoThumb({ photo, onPress }: { photo: PhotoItem; onPress: () => void }) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  // If localUri fails (e.g. OS cleaned the picker temp file), fall back to the
  // server URL (CloudFront CDN or presigned S3) rather than showing a placeholder.
  const [localUriFailed, setLocalUriFailed] = useState(false);
  const displayUri = (photo.localUri && !localUriFailed) ? photo.localUri : photo.uri;

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
      // localUri failed — retry with the server URL
      setLocalUriFailed(true);
      setLoading(true);
    } else {
      setLoading(false);
      setFailed(true);
    }
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.thumb}>
      {!failed ? (
        <>
          <CachedImage
            uri={displayUri}
            style={styles.thumbImg}
            resizeMode="cover"
            onLoad={() => setLoading(false)}
            onError={handleError}
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

// ─── Full-screen preview (swipeable) ────────────────────────────────────────

function PreviewItem({ photo }: { photo: PhotoItem }) {
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); }, [photo.uri]);
  return (
    <View style={{ width: SCREEN_W, flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <CachedImage
        uri={photo.localUri ?? photo.uri}
        style={styles.previewImg}
        resizeMode="contain"
        onLoad={() => setLoading(false)}
        onError={() => setLoading(false)}
      />
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

// ─── Photos modal (trip/event cards — owner can edit, viewers read-only) ──────

function PhotosModal({
  visible,
  title,
  onClose,
  parentId,
  parentType,
  userId,
  isOwner,
  gallerySubtitle: initialSubtitle,
  bannerImageUrl,
  onSubtitleSaved,
  onNameSaved,
  onBannerSaved,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  parentId: string;
  parentType: 'trip' | 'event';
  userId?: string;
  isOwner?: boolean;
  gallerySubtitle?: string | null;
  bannerImageUrl?: string | null;
  onSubtitleSaved?: (subtitle: string | null) => void;
  onNameSaved?: (name: string) => void;
  onBannerSaved?: (uri: string) => void;
}) {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [nameDraft, setNameDraft] = useState(title);
  const [subtitleDraft, setSubtitleDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const localUriCache = useRef<Record<string, string>>({});

  useEffect(() => {
    if (visible) {
      setEditMode(false);
      setNameDraft(title);
      setSubtitleDraft(initialSubtitle ?? '');
    }
  }, [visible]);

  useEffect(() => {
    if (visible) setSubtitleDraft(initialSubtitle ?? '');
  }, [initialSubtitle, visible]);

  const loadPhotos = () => {
    if (!parentId) return;
    let cancelled = false;
    // Snapshot the localUri map BEFORE clearing photos so it is available
    // inside the async callback (setPhotos([]) would wipe it from prev otherwise).
    const capturedCache = { ...localUriCache.current };

    setLoading(true);
    setPhotos([]);

    let fetcher: Promise<{ photos?: any[] }>;
    if (userId) {
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
        setPhotos(((data as any).photos ?? []).map((ph: any) => ({
          id: ph.id,
          uri: ph.uri ?? ph.url ?? ph.fileUrl ?? '',
          localUri: capturedCache[ph.id],
          activityId: ph.activityId ?? null,
          activityTitle: ph.activityTitle ?? null,
        })));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  };

  useEffect(() => {
    if (!visible || !parentId) return;
    return loadPhotos();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, parentId, parentType, userId]);

  const handleAddPhotos = () => {
    launchImageLibrary(
      { mediaType: 'photo', selectionLimit: 20, quality: 0.85, maxWidth: 2048, maxHeight: 2048 },
      async (res) => {
        if (res.didCancel || !res.assets?.length) return;

        const assets = res.assets.map((a) => ({
          uri: a.uri ?? '',
          type: a.type ?? 'image/jpeg',
          name: a.fileName ?? 'photo.jpg',
        })).filter((a) => a.uri);
        if (!assets.length) return;

        // Optimistic: add photos immediately with local file URIs so they display
        // right away without waiting for the S3 upload to complete.
        const tempIds = assets.map((_, i) => `temp_${Date.now()}_${i}`);
        setPhotos((prev) => [
          ...prev,
          ...assets.map((a, i) => ({
            id: tempIds[i],
            uri: a.uri,
            localUri: a.uri,
            activityId: null,
            activityTitle: null,
          })),
        ]);

        setUploading(true);
        try {
          const result = parentType === 'trip'
            ? await uploadTripPhotos(parentId, assets)
            : await uploadEventPhotos(parentId, assets);

          // Replace temp entries with server-backed photos; keep localUri as fallback
          setPhotos((prev) => {
            const withoutTemps = prev.filter((p) => !tempIds.includes(p.id));
            const uploaded: PhotoItem[] = result.photos.map((ph: any, i: number) => ({
              id: ph.id,
              uri: ph.url ?? ph.fileUrl ?? assets[i]?.uri ?? '',
              localUri: assets[i]?.uri,
              activityId: null,
              activityTitle: null,
            }));
            // Persist localUris so they survive the next setPhotos([]) call in loadPhotos
            uploaded.forEach((p) => { if (p.localUri) localUriCache.current[p.id] = p.localUri; });
            return [...withoutTemps, ...uploaded];
          });
        } catch (err: any) {
          // Roll back optimistic entries on failure
          setPhotos((prev) => prev.filter((p) => !tempIds.includes(p.id)));
          const status = err?.response?.status;
          Toast.show({
            type: 'error',
            text1: status === 403 ? 'Permission denied' : 'Upload failed',
            text2: status === 403 ? 'You do not have permission to add photos here.' : 'Please try again.',
          });
        } finally {
          setUploading(false);
        }
      },
    );
  };

  const handleDeletePhoto = async (photo: PhotoItem) => {
    setDeletingId(photo.id);
    try {
      if (parentType === 'trip') await deleteTripPhoto(parentId, photo.id);
      else await deleteEventPhoto(parentId, photo.id);
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not delete',
        text2: err?.response?.data?.message ?? 'Please try again.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDoneEdit = async () => {
    setSaving(true);
    try {
      const newName = nameDraft.trim();
      if (newName && newName !== title) {
        if (parentType === 'trip') await updateTrip(parentId, { name: newName });
        else await updateEvent(parentId, { name: newName });
        onNameSaved?.(newName);
      }

      const clean = subtitleDraft.trim();
      const prev = initialSubtitle?.trim() ?? '';
      if (clean !== prev) {
        const result = await upsertGallerySubtitle(parentType, parentId, clean || null);
        onSubtitleSaved?.(result.subtitle);
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Could not save changes', text2: 'Please try again.' });
    } finally {
      setSaving(false);
    }
    setEditMode(false);
  };

  const handleSetAsCover = async (uri: string) => {
    try {
      if (parentType === 'trip') await updateTrip(parentId, { bannerImageUrl: uri });
      else await updateEvent(parentId, { bannerImageUrl: uri });
      onBannerSaved?.(uri);
    } catch {
      Toast.show({ type: 'error', text1: 'Could not set cover', text2: 'Please try again.' });
    }
  };

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

  const renderThumb = (ph: PhotoItem) => {
    const isCover = !!bannerImageUrl && bannerImageUrl === ph.uri;
    return (
      <View key={ph.id} style={{ position: 'relative' }}>
        <PhotoThumb photo={ph} onPress={() => !editMode && setPreviewIndex(photos.findIndex(p => p.id === ph.id))} />
        {editMode && isOwner && (
          <TouchableOpacity
            style={styles.thumbDeleteBtn}
            onPress={() => handleDeletePhoto(ph)}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            disabled={deletingId === ph.id}
          >
            {deletingId === ph.id
              ? <ActivityIndicator size="small" color="#fff" style={{ width: 9, height: 9 }} />
              : <XIcon size={9} />
            }
          </TouchableOpacity>
        )}
        {editMode && isOwner && (
          <TouchableOpacity
            onPress={() => handleSetAsCover(ph.uri)}
            style={[styles.thumbCoverBtn, isCover && styles.thumbCoverBtnActive]}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Svg width={9} height={9} viewBox="0 0 24 24" fill="none">
              <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke={isCover ? '#0d9488' : '#fff'} strokeWidth={2} />
              <Circle cx={12} cy={13} r={4} stroke={isCover ? '#0d9488' : '#fff'} strokeWidth={2} />
            </Svg>
          </TouchableOpacity>
        )}
        {isCover && !editMode && (
          <View style={styles.coverBadge}>
            <Text style={styles.coverBadgeText}>Cover</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={[styles.dialog, { maxHeight: '85%' }]}>
            <View style={styles.dialogHeader}>
              {/* Left side: title + subtitle */}
              <View style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                {(editMode && isOwner && !userId) ? (
                  <TextInput
                    value={nameDraft}
                    onChangeText={setNameDraft}
                    style={styles.titleEditInput}
                    placeholderTextColor="#94a3b8"
                    placeholder="Album title"
                    returnKeyType="next"
                  />
                ) : (
                  <Text style={styles.dialogTitle} numberOfLines={1}>{title}</Text>
                )}
                {(editMode && isOwner && !userId) ? (
                  <TextInput
                    value={subtitleDraft}
                    onChangeText={setSubtitleDraft}
                    placeholder="Add a short description…"
                    placeholderTextColor="#94a3b8"
                    style={styles.modalSubtitleInput}
                    maxLength={80}
                    returnKeyType="done"
                    onSubmitEditing={handleDoneEdit}
                  />
                ) : (initialSubtitle?.trim() ? (
                  <Text style={styles.modalSubtitleText}>{initialSubtitle}</Text>
                ) : null)}
              </View>

              {/* Right side: edit toggle + close */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {isOwner && !userId && (
                  editMode ? (
                    <TouchableOpacity
                      onPress={handleDoneEdit}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      disabled={saving}
                    >
                      {saving
                        ? <ActivityIndicator size="small" color="#0d9488" />
                        : <CheckIcon />
                      }
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() => setEditMode(true)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Pen size={18} color="#0d9488" />
                    </TouchableOpacity>
                  )
                )}
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <CloseIcon />
                </TouchableOpacity>
              </View>
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
                    <Text style={styles.emptySub}>
                      {editMode && isOwner
                        ? 'Tap "Add photos" below to capture memories.'
                        : `No memories captured for this ${parentType}.`}
                    </Text>
                  </View>
                )}

                {!loading && photos.length > 0 && (
                  <View>
                    {directPhotos.length > 0 && (
                      <View style={{ marginBottom: Object.keys(activityGroups).length > 0 ? 16 : 8 }}>
                        {Object.keys(activityGroups).length > 0 && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 }}>
                            <View style={{ width: 3, height: 14, backgroundColor: '#64748b', borderRadius: 2 }} />
                            <Text style={{ fontSize: 13, fontWeight: '500', color: '#0f172a' }}>
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
                    {Object.entries(activityGroups).map(([actTitle, actPhotos]) => (
                      <View key={actTitle} style={{ marginBottom: 16 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 }}>
                          <View style={{ width: 3, height: 14, backgroundColor: '#0d9488', borderRadius: 2 }} />
                          <Text style={{ fontSize: 13, fontWeight: '500', color: '#0f172a' }}>{actTitle}</Text>
                          <Text style={{ fontSize: 11, color: '#94a3b8' }}>({actPhotos.length})</Text>
                        </View>
                        <View style={styles.thumbRow}>
                          {actPhotos.map(renderThumb)}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {editMode && isOwner && !userId && (
                  <TouchableOpacity
                    style={[styles.addPhotosBtn, uploading && { opacity: 0.6 }]}
                    onPress={handleAddPhotos}
                    disabled={uploading}
                    activeOpacity={0.85}
                  >
                    {uploading
                      ? <ActivityIndicator color="#0d9488" />
                      : <Text style={styles.addPhotosBtnText}>Add photos</Text>
                    }
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal visible={previewIndex !== null} transparent animationType="fade" onRequestClose={() => setPreviewIndex(null)}>
        <PreviewModal photos={photos} initialIndex={previewIndex ?? 0} onClose={() => setPreviewIndex(null)} />
      </Modal>
    </>
  );
}

// ─── Create card modal (name + banner image picker) ──────────────────────────

function CreateCardModal({
  visible,
  type,
  onClose,
  onCreate,
}: {
  visible: boolean;
  type: 'trip' | 'event';
  onClose: () => void;
  onCreate: (name: string, bannerUri?: string) => void;
}) {
  const [name, setName] = useState('');
  const [bannerUri, setBannerUri] = useState<string | undefined>();
  const [bannerImgError, setBannerImgError] = useState(false);

  useEffect(() => {
    if (visible) {
      setName('');
      setBannerUri(undefined);
      setBannerImgError(false);
    }
  }, [visible]);

  const pickBanner = () => {
    launchImageLibrary(
      { mediaType: 'photo', selectionLimit: 1, quality: 0.9, maxWidth: 1200, maxHeight: 800 },
      (res) => {
        if (res.didCancel || !res.assets?.length) return;
        const uri = res.assets[0].uri;
        if (uri) { setBannerUri(uri); setBannerImgError(false); }
      },
    );
  };

  const submit = () => {
    const t = name.trim();
    if (!t) return;
    onCreate(t, bannerUri);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={styles.dialogHeader}>
            <View>
              <Text style={styles.dialogTitle}>
                New {type === 'trip' ? 'trip' : 'event'} album
              </Text>
              <Text style={styles.dialogSubheading}>
                {type === 'trip' ? 'Save your travel memories' : 'Capture the moment'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <CloseIcon />
            </TouchableOpacity>
          </View>
          <View style={styles.dialogBody}>
            {/* Cover photo — compact row */}
            <TouchableOpacity onPress={pickBanner} style={styles.coverPhotoRow} activeOpacity={0.8}>
              {bannerUri && !bannerImgError ? (
                <View style={{ position: 'relative' }}>
                  <CachedImage
                    uri={bannerUri}
                    style={styles.coverThumb}
                    resizeMode="cover"
                    onError={() => setBannerImgError(true)}
                  />
                  <View style={styles.coverThumbEditBadge}>
                    <PencilLine size={11} color="#fff" />
                  </View>
                </View>
              ) : (
                <View style={styles.coverThumbEmpty}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="#94a3b8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                    <Circle cx={12} cy={13} r={4} stroke="#94a3b8" strokeWidth={1.5} />
                  </Svg>
                </View>
              )}
              <Text style={styles.coverPhotoRowLabel}>
                {bannerUri && !bannerImgError ? 'Change cover photo' : 'Add cover photo'}
              </Text>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={{ marginLeft: 'auto' }}>
                <Path d="M9 18l6-6-6-6" stroke="#cbd5e1" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </TouchableOpacity>

            {/* Album title */}
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={type === 'trip' ? 'Album title, e.g. Bali 2025' : 'Album title, e.g. Summer BBQ'}
              placeholderTextColor="#94a3b8"
              style={styles.createAlbumInput}
              returnKeyType="done"
              onSubmitEditing={submit}
            />
            <TouchableOpacity
              style={[styles.createAlbumBtn, !name.trim() && styles.createAlbumBtnDisabled]}
              onPress={submit}
              disabled={!name.trim()}
              activeOpacity={0.85}
            >
              <Text style={styles.createAlbumBtnText}>Create album</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Custom card photos modal (view mode + edit mode toggled by pencil) ──────

function CustomCardPhotosModal({
  visible,
  card,
  onClose,
  onUpdateCard,
}: {
  visible: boolean;
  card: CustomCard | null;
  onClose: () => void;
  onUpdateCard: (next: CustomCard) => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!visible) {
      setEditMode(false);
    } else if (card) {
      setNameDraft(card.name);
    }
  }, [visible, card]);

  const saveAndExitEdit = () => {
    if (!card) return;
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== card.name) {
      onUpdateCard({ ...card, name: trimmed });
    }
    setEditMode(false);
  };

  const addPhotos = () => {
    if (!card) return;
    launchImageLibrary(
      { mediaType: 'photo', selectionLimit: 20, includeBase64: false, quality: 0.85, maxWidth: 2048, maxHeight: 2048 },
      (res) => {
        if (res.didCancel || !res.assets?.length) return;
        const ts = Date.now();
        const newPhotos: PhotoItem[] = res.assets
          .map((a, i) => ({ id: `local_${ts}_${i}`, uri: a.uri ?? '' }))
          .filter((p) => p.uri);
        if (!newPhotos.length) return;
        onUpdateCard({ ...card, photos: [...card.photos, ...newPhotos] });
      },
    );
  };

  const deletePhoto = (photoId: string) => {
    if (!card) return;
    const next = card.photos.filter((p) => p.id !== photoId);
    // If the deleted photo was the cover, clear the cover
    const deletedUri = card.photos.find((p) => p.id === photoId)?.uri;
    const nextBanner = deletedUri && card.bannerImageUrl === deletedUri ? undefined : card.bannerImageUrl;
    onUpdateCard({ ...card, photos: next, bannerImageUrl: nextBanner });
  };

  const setPhotoAsCover = (uri: string) => {
    if (!card) return;
    onUpdateCard({ ...card, bannerImageUrl: uri });
  };

  const changeCoverFromLibrary = () => {
    if (!card) return;
    launchImageLibrary(
      { mediaType: 'photo', selectionLimit: 1, quality: 0.9, maxWidth: 1200, maxHeight: 800 },
      (res) => {
        if (res.didCancel || !res.assets?.length) return;
        const uri = res.assets[0].uri;
        if (!uri) return;
        // Add to photos if not already present, and set as cover
        const alreadyIn = card.photos.some((p) => p.uri === uri);
        const photos = alreadyIn
          ? card.photos
          : [...card.photos, { id: `local_${Date.now()}_cover`, uri, localUri: uri }];
        onUpdateCard({ ...card, bannerImageUrl: uri, photos });
      },
    );
  };

  if (!card) return null;
  const photos = card.photos;

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={[styles.dialog, { maxHeight: '85%' }]}>

            {/* Header */}
            <View style={styles.dialogHeader}>
              {editMode ? (
                <TextInput
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  style={styles.albumNameInput}
                  placeholderTextColor="#94a3b8"
                  placeholder="Album title"
                  returnKeyType="done"
                  onSubmitEditing={saveAndExitEdit}
                  autoFocus
                />
              ) : (
                <Text style={styles.dialogTitle} numberOfLines={1}>{card.name}</Text>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {editMode ? (
                  <TouchableOpacity onPress={saveAndExitEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <CheckIcon />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => setEditMode(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Pen size={18} color="#0d9488" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <CloseIcon />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.dialogBody}>

                {/* Change cover row — only in edit mode */}
                {editMode && (
                  <TouchableOpacity style={styles.changeCoverRow} onPress={changeCoverFromLibrary} activeOpacity={0.75}>
                    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                      <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      <Circle cx={12} cy={13} r={4} stroke="#0d9488" strokeWidth={2} />
                    </Svg>
                    <Text style={styles.changeCoverText}>Change cover photo</Text>
                  </TouchableOpacity>
                )}

                {photos.length === 0 && (
                  <View style={styles.emptyCenter}>
                    <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
                      <Rect x={3} y={3} width={18} height={18} rx={2} stroke="#cbd5e1" strokeWidth={1.5} />
                      <Circle cx={8.5} cy={8.5} r={1.5} fill="#cbd5e1" />
                      <Path d="M21 15l-5-5L5 21" stroke="#cbd5e1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <Text style={styles.emptyTitle}>No photos yet</Text>
                    <Text style={styles.emptySub}>
                      {editMode ? 'Tap "Add photos" below to fill this album.' : 'Tap the pencil icon to add photos.'}
                    </Text>
                  </View>
                )}

                {photos.length > 0 && (
                  <View style={styles.thumbRow}>
                    {photos.map((ph) => {
                      const isCover = !!card.bannerImageUrl && card.bannerImageUrl === (ph.localUri ?? ph.uri);
                      return (
                        <View key={ph.id} style={{ position: 'relative' }}>
                          <PhotoThumb
                            photo={ph}
                            onPress={() => !editMode && setPreviewIndex(photos.findIndex(p => p.id === ph.id))}
                          />
                          {/* Delete button — top-right */}
                          {editMode && (
                            <TouchableOpacity
                              onPress={() => deletePhoto(ph.id)}
                              style={styles.thumbDeleteBtn}
                              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                            >
                              <XIcon size={9} />
                            </TouchableOpacity>
                          )}
                          {/* Set as cover button — bottom-left, only in edit mode */}
                          {editMode && (
                            <TouchableOpacity
                              onPress={() => setPhotoAsCover(ph.localUri ?? ph.uri)}
                              style={[styles.thumbCoverBtn, isCover && styles.thumbCoverBtnActive]}
                              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                            >
                              <Svg width={9} height={9} viewBox="0 0 24 24" fill={isCover ? '#0d9488' : '#fff'}>
                                <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke={isCover ? '#0d9488' : '#fff'} strokeWidth={2} />
                                <Circle cx={12} cy={13} r={4} stroke={isCover ? '#0d9488' : '#fff'} strokeWidth={2} />
                              </Svg>
                            </TouchableOpacity>
                          )}
                          {/* Cover indicator badge — visible in both modes */}
                          {isCover && !editMode && (
                            <View style={styles.coverBadge}>
                              <Text style={styles.coverBadgeText}>Cover</Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}

                {editMode && (
                  <TouchableOpacity style={styles.addPhotosBtn} onPress={addPhotos} activeOpacity={0.85}>
                    <Text style={styles.addPhotosBtnText}>Add photos</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={previewIndex !== null} transparent animationType="fade" onRequestClose={() => setPreviewIndex(null)}>
        <PreviewModal photos={photos} initialIndex={previewIndex ?? 0} onClose={() => setPreviewIndex(null)} />
      </Modal>
    </>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

interface GalleryTabProps {
  user: any;
  trips?: any[];
  onEditProfile: () => void;
  onNavigateToTrip: (trip: any) => void;
  onSetActiveTab: (tab: string) => void;
  onNavigateToEvent?: (event: any) => void;
}

export default function GalleryTab({
  user,
  trips: propTrips = [],
  onEditProfile,
}: GalleryTabProps) {
  const [avatarError, setAvatarError] = useState(false);
  const [galleryTrips, setGalleryTrips] = useState<any[]>([]);
  const [galleryEvents, setGalleryEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Photo modal for API-driven trip/event cards
  const [photoModal, setPhotoModal] = useState<{
    id: string;
    name: string;
    type: 'trip' | 'event';
    subtitle: string | null;
    bannerImageUrl?: string | null;
  } | null>(null);

  // Custom cards (local, stored in AsyncStorage)
  const [customCards, setCustomCards] = useState<CustomCard[]>([]);
  const [cardsLoaded, setCardsLoaded] = useState(false);
  const [showCreateCard, setShowCreateCard] = useState<'trip' | 'event' | null>(null);
  const [openCard, setOpenCard] = useState<CustomCard | null>(null);

  const userId: string = user?.id ?? '';
  const displayName = user?.fullName ?? '';
  const handle = user?.username ?? displayName.toLowerCase().replace(/ /g, '_') ?? 'username';

  useEffect(() => {
    setAvatarError(false);
  }, [user?.photoUrl]);

  // Load custom cards from device storage
  useEffect(() => {
    if (!userId) {
      setCustomCards([]);
      setCardsLoaded(false);
      return;
    }
    let cancelled = false;
    AsyncStorage.getItem(customCardsStorageKey(userId))
      .then((raw) => {
        if (cancelled) return;
        try {
          const parsed = raw ? JSON.parse(raw) : [];
          setCustomCards(Array.isArray(parsed) ? parsed : []);
        } catch {
          setCustomCards([]);
        }
      })
      .finally(() => { if (!cancelled) setCardsLoaded(true); });
    return () => { cancelled = true; };
  }, [userId]);

  const saveCustomCards = (next: CustomCard[]) => {
    setCustomCards(next);
    if (userId) {
      AsyncStorage.setItem(customCardsStorageKey(userId), JSON.stringify(next)).catch(() => {});
    }
  };

  const createCustomCard = (name: string, bannerUri?: string) => {
    const photos: PhotoItem[] = bannerUri
      ? [{ id: `local_${Date.now()}_0`, uri: bannerUri, localUri: bannerUri }]
      : [];
    const card: CustomCard = {
      id: `cc_${Date.now()}`,
      name,
      bannerImageUrl: bannerUri,
      type: showCreateCard ?? 'trip',
      photos,
    };
    saveCustomCards([...customCards, card]);
  };

  const updateCustomCard = (next: CustomCard) => {
    const updated = customCards.map((c) => (c.id === next.id ? next : c));
    saveCustomCards(updated);
    setOpenCard((prev) => (prev?.id === next.id ? next : prev));
  };

  const deleteCustomCard = (id: string) => {
    saveCustomCards(customCards.filter((c) => c.id !== id));
  };

  const handleSubtitleSaved = (parentId: string, parentType: 'trip' | 'event', subtitle: string | null) => {
    if (parentType === 'trip') {
      setGalleryTrips((prev) => prev.map((t) => t.id === parentId ? { ...t, gallerySubtitle: subtitle } : t));
    } else {
      setGalleryEvents((prev) => prev.map((e) => e.id === parentId ? { ...e, gallerySubtitle: subtitle } : e));
    }
    setPhotoModal((prev) => prev?.id === parentId ? { ...prev, subtitle } : prev);
  };

  const handleNameSaved = (parentId: string, parentType: 'trip' | 'event', name: string) => {
    if (parentType === 'trip') {
      setGalleryTrips((prev) => prev.map((t) => t.id === parentId ? { ...t, name } : t));
    } else {
      setGalleryEvents((prev) => prev.map((e) => e.id === parentId ? { ...e, name } : e));
    }
    setPhotoModal((prev) => prev?.id === parentId ? { ...prev, name } : prev);
  };

  const handleBannerSaved = (parentId: string, parentType: 'trip' | 'event', uri: string) => {
    if (parentType === 'trip') {
      setGalleryTrips((prev) => prev.map((t) => t.id === parentId ? { ...t, bannerImageUrl: uri } : t));
    } else {
      setGalleryEvents((prev) => prev.map((e) => e.id === parentId ? { ...e, bannerImageUrl: uri } : e));
    }
    setPhotoModal((prev) => prev?.id === parentId ? { ...prev, bannerImageUrl: uri } : prev);
  };

  // Fetch gallery data from server
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
        if (!cancelled) setGalleryTrips(propTrips);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const displayTrips = galleryTrips.length > 0 ? galleryTrips : propTrips;

  const customTripCards = customCards.filter((c) => c.type === 'trip');
  const customEventCards = customCards.filter((c) => c.type === 'event');

  return (
    <>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ── Profile card ── */}
        <View style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View style={styles.avatarWrap}>
              {user?.photoUrl && !avatarError ? (
                <CachedImage
                  uri={user.photoUrl}
                  style={styles.avatar}
                  resizeMode="cover"
                  priority="high"
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
                    <Pen size={15} color="#64748b" />
                  </TouchableOpacity>
                </View>
              ) : null}
              {handle ? <Text style={styles.handle}>@{handle}</Text> : null}
              {user?.country ? (
                <View style={styles.locationRow}>
                  <PinIcon color="#0d9488" size={12} />
                  <Text style={styles.locationText}>{user.country}</Text>
                </View>
              ) : null}
            </View>
          </View>
          {user?.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
        </View>

        {/* ── Skeleton while loading, real sections after ── */}
        {loading ? (
          <GallerySkeleton />
        ) : (
          <>
            {/* ── Trips ── */}
            <SectionHeader
              title="Trips"
              count={displayTrips.length + customTripCards.length}
              onAdd={() => setShowCreateCard('trip')}
              icon={<Plane size={20} color="#0d9488" />}
            />
            <View style={styles.grid}>
              {displayTrips.map((trip: any) => (
                <GridCard
                  key={trip.id}
                  item={trip}
                  onPress={() => setPhotoModal({ id: trip.id, name: trip.name, type: 'trip', subtitle: trip.gallerySubtitle ?? null, bannerImageUrl: trip.bannerImageUrl ?? null })}
                />
              ))}
              {cardsLoaded && customTripCards.map((card) => (
                <GridCard
                  key={card.id}
                  item={{ id: card.id, name: card.name, bannerImageUrl: card.bannerImageUrl }}
                  chip="custom-trip"
                  onPress={() => setOpenCard(card)}
                  onLongPress={() => showConfirm({
                    title: 'Delete album?',
                    message: `Are you sure you want to delete "${card.name}"? This cannot be undone.`,
                    confirmText: 'Delete',
                    destructive: true,
                    onConfirm: () => deleteCustomCard(card.id),
                  })}
                />
              ))}
              {displayTrips.length === 0 && customTripCards.length === 0 && (
                <EmptyCard label="Tap + to create a trip album" />
              )}
            </View>

            {/* ── Events ── */}
            <View style={styles.sectionSpacer} />
            <SectionHeader
              title="Events"
              count={galleryEvents.length + customEventCards.length}
              onAdd={() => setShowCreateCard('event')}
              icon={<CalendarDays size={20} color="#f59e0b" />}
            />
            <View style={styles.grid}>
              {galleryEvents.map((ev: any) => (
                <GridCard
                  key={ev.id}
                  item={ev}
                  onPress={() => setPhotoModal({ id: ev.id, name: ev.name, type: 'event', subtitle: ev.gallerySubtitle ?? null, bannerImageUrl: ev.bannerImageUrl ?? null })}
                />
              ))}
              {cardsLoaded && customEventCards.map((card) => (
                <GridCard
                  key={card.id}
                  item={{ id: card.id, name: card.name, bannerImageUrl: card.bannerImageUrl }}
                  chip="custom-event"
                  onPress={() => setOpenCard(card)}
                  onLongPress={() => showConfirm({
                    title: 'Delete album?',
                    message: `Are you sure you want to delete "${card.name}"? This cannot be undone.`,
                    confirmText: 'Delete',
                    destructive: true,
                    onConfirm: () => deleteCustomCard(card.id),
                  })}
                />
              ))}
              {galleryEvents.length === 0 && customEventCards.length === 0 && (
                <EmptyCard label="Tap + to create an event album" />
              )}
            </View>
          </>
        )}

      </ScrollView>

      {/* ── Modals (outside ScrollView) ── */}
      {photoModal && (
        <PhotosModal
          visible
          title={photoModal.name}
          parentId={photoModal.id}
          parentType={photoModal.type}
          isOwner
          gallerySubtitle={photoModal.subtitle}
          bannerImageUrl={photoModal.bannerImageUrl}
          onSubtitleSaved={(subtitle) => handleSubtitleSaved(photoModal.id, photoModal.type, subtitle)}
          onNameSaved={(name) => handleNameSaved(photoModal.id, photoModal.type, name)}
          onBannerSaved={(uri) => handleBannerSaved(photoModal.id, photoModal.type, uri)}
          onClose={() => setPhotoModal(null)}
        />
      )}

      <CreateCardModal
        visible={showCreateCard !== null}
        type={showCreateCard ?? 'trip'}
        onClose={() => setShowCreateCard(null)}
        onCreate={createCustomCard}
      />

      <CustomCardPhotosModal
        visible={!!openCard}
        card={openCard}
        onClose={() => setOpenCard(null)}
        onUpdateCard={updateCustomCard}
      />
    </>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 4 },

  profileCard: { marginTop: 14, marginBottom: 28, alignItems: 'center' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 32 },
  avatarWrap: { position: 'relative' },
  profileInfo: { justifyContent: 'center', gap: 4 },
  avatar: { width: 112, height: 112, borderRadius: 56, borderWidth: 3, borderColor: '#0d9488' },
  avatarPlaceholder: { backgroundColor: '#f0fdfa', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 38, fontWeight: '700', color: '#0d9488' },
  editBtn: { alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 18, fontWeight: '400', color: '#0F172B' },
  handle: { fontSize: 14, color: '#0d9488', fontWeight: '500' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { fontSize: 14, color: '#45556C' },
  bio: { fontSize: 14, color: '#45556C', textAlign: 'center', marginTop: 12, lineHeight: 20 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionIcon: { alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '400', color: '#0F172B' },
  countBadge: {
    backgroundColor: '#f0fdfa', borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1, borderColor: '#ccfbf1',
  },
  countBadgeText: { fontSize: 12, fontWeight: '700', color: '#0d9488' },

  sectionSpacer: { height: 24 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  gridCard: { width: CARD_W, height: 140, borderRadius: 14, overflow: 'hidden', backgroundColor: '#f1f5f9' },
  gridCardTall: { height: 160 },
  gridCardImage: { width: '100%', height: '100%' },
  gridCardPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
  gridCardOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 32,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  gridCardOverlayTall: { height: 50, justifyContent: 'center', paddingVertical: 6 },
  gridCardText: { color: '#fff', fontSize: 12, fontWeight: '400', lineHeight: 15 },
  gridCardSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '400', lineHeight: 14, marginTop: 2 },
  cardChip: {
    position: 'absolute', top: 8, left: 8,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 6, zIndex: 10,
  },
  cardChipText: { fontSize: 10, fontWeight: '600', color: '#fff', letterSpacing: 0.4 },
  gridCardEditBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.52)',
    alignItems: 'center',
    justifyContent: 'center',
  },

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

  // Per-photo delete button inside CustomCardPhotosModal
  thumbDeleteBtn: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(220,38,38,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Full-screen preview
  previewBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' },
  previewClose: {
    position: 'absolute', top: 48, left: 20, zIndex: 10,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  previewImg: { width: SCREEN_W, height: SCREEN_W * 1.2 },
  previewLoader: { position: 'absolute' },
  previewCounter: {
    position: 'absolute', bottom: 36, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12,
  },
  previewCounterText: { color: '#fff', fontSize: 13, fontWeight: '300' },

  dialogSubheading: { fontSize: 12, color: '#94a3b8', fontWeight: '400', marginTop: 2 },

  // Create card modal — compact cover photo row
  coverPhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  coverThumb: { width: 44, height: 44, borderRadius: 8 },
  coverThumbEmpty: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  coverThumbEditBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPhotoRowLabel: { fontSize: 14, color: '#334155', fontWeight: '400' },

  createAlbumInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a',
    marginBottom: 14,
  },
  createAlbumBtn: {
    backgroundColor: '#0d9488',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  createAlbumBtnDisabled: { opacity: 0.45 },
  createAlbumBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },

  addPhotosBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#0d9488',
    alignItems: 'center',
  },
  addPhotosBtnText: { fontSize: 15, fontWeight: '400', color: '#0d9488' },

  fieldLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    marginBottom: 6,
    letterSpacing: 0.2,
  },

  albumNameInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#0f172a',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 12,
  },
  titleEditInput: {
    fontSize: 15,
    fontWeight: '500',
    color: '#0f172a',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 6,
  },

  changeCoverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 2,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  changeCoverText: { fontSize: 13, color: '#0d9488', fontWeight: '400' },

  thumbCoverBtn: {
    position: 'absolute',
    bottom: 3,
    left: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbCoverBtnActive: { backgroundColor: '#fff' },

  coverBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(13,148,136,0.85)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  coverBadgeText: { fontSize: 9, color: '#fff', fontWeight: '600' },

  modalSubtitleText: {
    fontSize: 13,
    color: '#0d9488',
    fontWeight: '300',
    fontStyle: 'italic',
    marginTop: 3,
  },
  modalSubtitleInput: {
    fontSize: 13,
    color: '#0d9488',
    backgroundColor: '#f0fdfa',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 6,
  },
});
