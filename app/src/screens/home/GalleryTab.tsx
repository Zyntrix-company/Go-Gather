import React, { useState, useEffect, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  View, Text, TouchableOpacity, ScrollView, Image,
  Dimensions, StyleSheet, ActivityIndicator, Modal, TextInput, Animated, FlatList,
} from 'react-native';
import { showConfirm } from '../../store/alertStore';
import { launchImageLibrary } from 'react-native-image-picker';
import {
  createGalleryAlbum,
  updateGalleryAlbum,
  archiveGalleryAlbum,
  deleteGalleryAlbum,
  getMyGalleryAlbumPhotos,
  uploadGalleryAlbumPhotos,
  deleteGalleryAlbumPhoto,
  type GalleryAlbumCard,
} from '../../api/gallery.api';
import { migrateLocalCustomGalleryAlbums } from '../../utils/migrateCustomGalleryAlbums';
import CachedImage from '../../components/common/CachedImage';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { PencilLine, Pen, Archive, Trash2 } from 'lucide-react-native';
import { DriveBrandIcon } from '../../components/common/GoogleWorkspaceIcons';
import { getUserGallery, getUserPhotos, upsertGallerySubtitle, archiveGalleryItem } from '../../api/ai.api';
import { getTripPhotos, uploadTripPhotos, updateTrip, getDriveStatus, listDrivePhotoFiles, importDrivePhotos, type DriveFile } from '../../api/trips.api';
import { getEventPhotos, uploadEventPhotos, updateEvent } from '../../api/events.api';
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

function GridCard({ item, onPress, chip }: { item: any; onPress: () => void; chip?: ChipType }) {
  const [imgError, setImgError] = useState(false);
  const hasImage = item.bannerImageUrl && !imgError;
  const borderColor = chip ? CHIP_CONFIG[chip].bg : undefined;

  return (
    <TouchableOpacity
      style={[styles.gridCard, borderColor && { borderWidth: 3, borderColor }]}
      onPress={onPress}
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

type CustomCard = GalleryAlbumCard & {
  type: 'trip' | 'event';
};

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

// ─── Full-size hero photo for album view ─────────────────────────────────────

function GalleryHeroPhoto({ photo }: { photo: PhotoItem }) {
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
  onArchived,
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
  onArchived?: () => void;
}) {
  const navigation = useNavigation<any>();
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();
  const [editMode, setEditMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);
  const heroFlatListRef = useRef<any>(null);
  const [nameDraft, setNameDraft] = useState(title);
  const [subtitleDraft, setSubtitleDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const localUriCache = useRef<Record<string, string>>({});
  const [driveStatus, setDriveStatus] = useState({ connected: false });
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [drivePickerLoading, setDrivePickerLoading] = useState(false);
  const [selectedDriveFileIds, setSelectedDriveFileIds] = useState<Set<string>>(new Set());
  const [driveImporting, setDriveImporting] = useState(false);

  useEffect(() => {
    if (!visible || userId) return;
    getDriveStatus()
      .then((d) => setDriveStatus({ connected: Boolean(d?.connected) }))
      .catch(() => setDriveStatus({ connected: false }));
  }, [visible, userId]);

  useEffect(() => {
    if (visible) {
      setEditMode(false);
      setHeroIndex(0);
      setDescExpanded(false);
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
        const mapped: PhotoItem[] = ((data as any).photos ?? []).map((ph: any) => ({
          id: ph.id,
          uri: ph.uri ?? ph.url ?? ph.fileUrl ?? '',
          localUri: capturedCache[ph.id],
          activityId: ph.activityId ?? null,
          activityTitle: ph.activityTitle ?? null,
        }));
        // Direct (trip/event-level) photos first, then activity photos
        setPhotos([...mapped.filter(p => !p.activityId), ...mapped.filter(p => !!p.activityId)]);
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

  const openPhotoDrivePicker = async () => {
    if (!driveStatus.connected) {
      navigation.navigate('ConnectedEmail');
      return;
    }
    setDriveFiles([]);
    setSelectedDriveFileIds(new Set());
    setDrivePickerLoading(true);
    setShowDrivePicker(true);
    try {
      const res = await listDrivePhotoFiles();
      setDriveFiles(res.files);
    } catch {
      Toast.show({ type: 'error', text1: 'Could not load Drive photos', text2: 'Please try again.' });
      setShowDrivePicker(false);
    } finally {
      setDrivePickerLoading(false);
    }
  };

  const confirmPhotoDriveImport = async () => {
    if (selectedDriveFileIds.size === 0 || driveImporting) return;
    setDriveImporting(true);
    try {
      const selected = driveFiles.filter((f) => selectedDriveFileIds.has(f.fileId));
      const res = await importDrivePhotos(parentType, parentId, selected);
      if (res.imported.length > 0) {
        setPhotos((prev) => [
          ...prev,
          ...res.imported.map((ph) => ({
            id: ph.id,
            uri: ph.url ?? ph.fileUrl ?? '',
            activityId: null,
            activityTitle: null,
          })),
        ]);
      }
      setShowDrivePicker(false);
      if (res.failed?.length) {
        Toast.show({ type: 'error', text1: `${res.failed.length} photo(s) failed to import` });
      } else if (res.imported.length > 0) {
        Toast.show({ type: 'success', text1: `${res.imported.length} photo(s) added from Drive` });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Import failed', text2: 'Please try again.' });
    } finally {
      setDriveImporting(false);
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

  const hideAlbumFromMyGallery = async () => {
    try {
      await archiveGalleryItem(parentType, parentId);
      Toast.show({ type: 'success', text1: 'Removed', text2: 'Hidden from your gallery only.' });
      onArchived?.();
      onClose();
    } catch {
      Toast.show({ type: 'error', text1: 'Could not update gallery', text2: 'Please try again.' });
    }
  };

  const handleArchiveAlbum = () => {
    const kind = parentType === 'trip' ? 'trip' : 'event';
    showConfirm({
      title: 'Archive album?',
      message:
        `Hide "${title}" from your gallery only (your view).\n\n` +
        `This does not archive the ${kind} for other members — they still see this album. ` +
        'You can restore it anytime from Archived.',
      confirmText: 'Archive',
      onConfirm: hideAlbumFromMyGallery,
    });
  };

  const handleRemoveFromGallery = () => {
    const kind = parentType === 'trip' ? 'trip' : 'event';
    showConfirm({
      title: 'Remove from my gallery?',
      message:
        `Remove "${title}" from your gallery only.\n\n` +
        `The ${kind} and photos stay for other members. Friends viewing your gallery will not see this album. ` +
        'Restore it anytime from Archived.',
      confirmText: 'Remove',
      destructive: true,
      onConfirm: hideAlbumFromMyGallery,
    });
  };

  const heroPhoto = photos.length > 0 ? photos[Math.min(heroIndex, photos.length - 1)] : null;
  const isActivityPhoto = !!(heroPhoto?.activityTitle);
  const dynamicTitle = isActivityPhoto ? heroPhoto!.activityTitle! : title;

  return (
    <>
      <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
        <View style={{ flex: 1, backgroundColor: '#f1f5f9' }}>

          {/* ── Sticky header bar (safe-area aware) ── */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30, paddingTop: insets.top, backgroundColor: 'transparent' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8 }}>
              {/* Back */}
              <TouchableOpacity
                onPress={onClose}
                style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, elevation: 4 }}
                activeOpacity={0.8}
              >
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path d="M19 12H5M12 5l-7 7 7 7" stroke="#0f172a" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </TouchableOpacity>
              {/* Edit / Archive */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {!userId && (
                  editMode ? (
                    <TouchableOpacity
                      onPress={handleDoneEdit}
                      style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, elevation: 4 }}
                      disabled={saving}
                    >
                      {saving ? <ActivityIndicator size="small" color="#0d9488" /> : <CheckIcon />}
                    </TouchableOpacity>
                  ) : (
                    <>
                      <TouchableOpacity
                        onPress={() => setEditMode(true)}
                        style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, elevation: 4 }}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Pen size={16} color="#0d9488" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleArchiveAlbum}
                        style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, elevation: 4 }}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Archive size={16} color="#64748b" />
                      </TouchableOpacity>
                    </>
                  )
                )}
              </View>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

            {/* ── Hero Photo (swipeable FlatList pager) ── */}
            <View style={{ height: 290, backgroundColor: '#0f172a', position: 'relative' }}>
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
                  onMomentumScrollEnd={e => {
                    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
                    setHeroIndex(idx);
                  }}
                  renderItem={({ item }) => (
                    <View style={{ width: SCREEN_W, height: 290 }}>
                      <GalleryHeroPhoto photo={item} />
                    </View>
                  )}
                  keyExtractor={item => item.id}
                />
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Svg width={56} height={56} viewBox="0 0 24 24" fill="none">
                    <Rect x={3} y={3} width={18} height={18} rx={2} stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} />
                    <Circle cx={8.5} cy={8.5} r={1.5} fill="rgba(255,255,255,0.25)" />
                    <Path d="M21 15l-5-5L5 21" stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 10 }}>No photos yet</Text>
                </View>
              )}
              {/* Photo count */}
              {photos.length > 0 && (
                <View style={{ position: 'absolute', bottom: 14, right: 14, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.52)', paddingHorizontal: 11, paddingVertical: 5, borderRadius: 14 }}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{heroIndex + 1} / {photos.length}</Text>
                </View>
              )}
            </View>

            {/* ── Thumbnail Strip ── */}
            {photos.length > 0 && (
              <View style={{ backgroundColor: '#fff', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, flexDirection: 'row' }}>
                  {photos.map((ph, idx) => {
                    const thumbUri = ph.localUri ?? ph.uri;
                    return (
                      <TouchableOpacity
                        key={ph.id}
                        onPress={() => { setHeroIndex(idx); heroFlatListRef.current?.scrollToIndex({ index: idx, animated: true }); }}
                        activeOpacity={0.85}
                        style={{
                          width: 74, height: 60, borderRadius: 10, overflow: 'hidden',
                          borderWidth: idx === heroIndex ? 2.5 : 0,
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

            {/* ── Identity Card ── */}
            <View style={{ backgroundColor: '#fff', marginTop: 10, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18 }}>
              {/* Edit mode name input */}
              {(editMode && !userId) ? (
                <TextInput
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  style={[styles.titleEditInput, { fontSize: 22, marginBottom: 6 }]}
                  placeholderTextColor="#94a3b8"
                  placeholder="Album title"
                  returnKeyType="next"
                />
              ) : (
                <>
                  {isActivityPhoto && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <View style={{ width: 3, height: 14, backgroundColor: '#0d9488', borderRadius: 2 }} />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#0d9488', letterSpacing: 0.3 }}>ACTIVITY</Text>
                    </View>
                  )}
                  <Text style={{ fontSize: 26, fontWeight: '700', color: '#0f172a', letterSpacing: -0.4, marginBottom: 4 }} numberOfLines={2}>
                    {dynamicTitle}
                  </Text>
                  {isActivityPhoto && (
                    <Text style={{ fontSize: 14, color: '#64748b', marginBottom: 8 }}>
                      from <Text style={{ fontWeight: '600', color: '#0f172a' }}>{title}</Text>
                    </Text>
                  )}
                </>
              )}

              {/* Subtitle edit / display */}
              {(editMode && !userId) ? (
                <TextInput
                  value={subtitleDraft}
                  onChangeText={setSubtitleDraft}
                  placeholder="Add a short description…"
                  placeholderTextColor="#94a3b8"
                  style={[styles.modalSubtitleInput, { marginBottom: 10 }]}
                  maxLength={80}
                  returnKeyType="done"
                  onSubmitEditing={handleDoneEdit}
                />
              ) : (initialSubtitle?.trim() ? (
                <Text style={{ fontSize: 14, color: '#64748b', marginBottom: 10 }}>{initialSubtitle}</Text>
              ) : null)}

              {/* Type badge + photo count */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <View style={{ backgroundColor: parentType === 'trip' ? '#f0fdf4' : '#fdf2f8', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  {parentType === 'trip' ? (
                    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                      <Path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" stroke="#0d9488" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  ) : (
                    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                      <Rect x={3} y={4} width={18} height={18} rx={2} ry={2} stroke="#db2777" strokeWidth={2} />
                      <Path d="M16 2v4M8 2v4M3 10h18" stroke="#db2777" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  )}
                  <Text style={{ fontSize: 12, fontWeight: '600', color: parentType === 'trip' ? '#0d9488' : '#db2777' }}>
                    {parentType === 'trip' ? 'Trip' : 'Event'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                    <Rect x={3} y={3} width={18} height={18} rx={2} stroke="#0d9488" strokeWidth={2} />
                    <Circle cx={8.5} cy={8.5} r={1.5} fill="#0d9488" />
                    <Path d="M21 15l-5-5L5 21" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <Text style={{ fontSize: 13, color: '#0d9488', fontWeight: '600' }}>
                    {photos.length === 0 ? 'No photos' : `${photos.length} ${photos.length === 1 ? 'Photo' : 'Photos'}`}
                  </Text>
                </View>
              </View>
            </View>

            {/* ── Description (subtitle as description) ── */}
            {!editMode && initialSubtitle && initialSubtitle.trim().length > 60 && (
              <View style={{ backgroundColor: '#fff', marginTop: 10, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 8 }}>Description</Text>
                <Text style={{ fontSize: 14, color: '#475569', lineHeight: 22 }} numberOfLines={descExpanded ? undefined : 3}>
                  {initialSubtitle}
                </Text>
                <TouchableOpacity onPress={() => setDescExpanded(p => !p)} activeOpacity={0.7} style={{ marginTop: 5 }}>
                  <Text style={{ color: '#0d9488', fontSize: 13, fontWeight: '600' }}>
                    {descExpanded ? 'Show less' : '.....Read more'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Add Photos Button (edit mode) / empty state ── */}
            <View style={{ backgroundColor: '#fff', marginTop: 10, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 36 }}>
              {!loading && photos.length === 0 && (
                <View style={styles.emptyCenter}>
                  <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
                    <Rect x={3} y={3} width={18} height={18} rx={2} stroke="#cbd5e1" strokeWidth={1.5} />
                    <Circle cx={8.5} cy={8.5} r={1.5} fill="#cbd5e1" />
                    <Path d="M21 15l-5-5L5 21" stroke="#cbd5e1" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <Text style={styles.emptyTitle}>No photos yet</Text>
                  <Text style={styles.emptySub}>
                    {!userId ? 'Tap "Add photos" below to capture memories.' : `No memories captured for this ${parentType}.`}
                  </Text>
                </View>
              )}
              {!userId && (
                <View style={{ gap: 10 }}>
                  <TouchableOpacity
                    style={[styles.addPhotosBtn, uploading && { opacity: 0.6 }]}
                    onPress={handleAddPhotos}
                    disabled={uploading}
                    activeOpacity={0.85}
                  >
                    {uploading ? <ActivityIndicator color="#0d9488" /> : <Text style={styles.addPhotosBtnText}>Add photos</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.addPhotosBtn, styles.drivePhotosBtn, (uploading || driveImporting) && { opacity: 0.6 }]}
                    onPress={openPhotoDrivePicker}
                    disabled={uploading || driveImporting}
                    activeOpacity={0.85}
                  >
                    {driveImporting ? (
                      <ActivityIndicator color="#0d9488" />
                    ) : (
                      <>
                        <DriveBrandIcon size={16} />
                        <Text style={styles.addPhotosBtnText}>Add from Drive</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>

          </ScrollView>
        </View>
      </Modal>
      <Modal visible={showDrivePicker} transparent animationType="slide" onRequestClose={() => setShowDrivePicker(false)}>
        <View style={styles.overlay}>
          <View style={[styles.dialog, { maxHeight: '85%' }]}>
            <View style={styles.dialogHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <DriveBrandIcon size={22} />
                <Text style={styles.dialogTitle} numberOfLines={1}>Import photos from Drive</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDrivePicker(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <CloseIcon />
              </TouchableOpacity>
            </View>
            {drivePickerLoading ? (
              <View style={styles.modalLoadingRow}>
                <ActivityIndicator color="#0d9488" />
                <Text style={{ marginTop: 12, color: '#64748b', fontSize: 13 }}>Loading photos…</Text>
              </View>
            ) : driveFiles.length === 0 ? (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <Text style={{ color: '#64748b', fontSize: 14, textAlign: 'center' }}>No photos found in your Drive root.</Text>
              </View>
            ) : (
              <FlatList
                data={driveFiles}
                keyExtractor={(f) => f.fileId}
                style={{ maxHeight: 380 }}
                renderItem={({ item }) => {
                  const sel = selectedDriveFileIds.has(item.fileId);
                  return (
                    <TouchableOpacity
                      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderColor: '#e2e8f0' }}
                      onPress={() => setSelectedDriveFileIds((prev) => {
                        const n = new Set(prev);
                        if (sel) n.delete(item.fileId); else n.add(item.fileId);
                        return n;
                      })}
                      activeOpacity={0.7}
                    >
                      <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: sel ? '#0d9488' : '#cbd5e1', backgroundColor: sel ? '#0d9488' : 'transparent', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        {sel && <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>✓</Text>}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '500', color: '#0f172a' }} numberOfLines={1}>{item.name}</Text>
                        <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                          {item.sizeBytes ? `${Math.round(item.sizeBytes / 1024)} KB · ` : ''}
                          {new Date(item.modifiedTime).toLocaleDateString()}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
            {!drivePickerLoading && driveFiles.length > 0 && (
              <View style={{ padding: 16, borderTopWidth: 0.5, borderColor: '#e2e8f0' }}>
                <TouchableOpacity
                  style={[styles.addPhotosBtn, { opacity: selectedDriveFileIds.size === 0 ? 0.5 : 1 }]}
                  onPress={confirmPhotoDriveImport}
                  disabled={selectedDriveFileIds.size === 0 || driveImporting}
                  activeOpacity={0.85}
                >
                  {driveImporting ? (
                    <ActivityIndicator color="#0d9488" />
                  ) : (
                    <Text style={styles.addPhotosBtnText}>
                      Import {selectedDriveFileIds.size > 0 ? `${selectedDriveFileIds.size} photo${selectedDriveFileIds.size > 1 ? 's' : ''}` : 'selected'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
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
  onCardUpdated,
  onArchiveCard,
  onDeleteCard,
}: {
  visible: boolean;
  card: CustomCard | null;
  onClose: () => void;
  onCardUpdated: (album: GalleryAlbumCard) => void;
  onArchiveCard: (id: string) => void;
  onDeleteCard: (id: string) => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadPhotos = () => {
    if (!card?.id) return;
    setLoading(true);
    getMyGalleryAlbumPhotos(card.id)
      .then((res) => {
        setPhotos(res.photos.map((p) => ({ id: p.id, uri: p.uri ?? '' })));
      })
      .catch(() => setPhotos([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!visible) {
      setEditMode(false);
      setPhotos([]);
    } else if (card) {
      setNameDraft(card.name);
      loadPhotos();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, card?.id]);

  const saveAndExitEdit = async () => {
    if (!card) return;
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== card.name) {
      try {
        const updated = await updateGalleryAlbum(card.id, { name: trimmed });
        onCardUpdated({ ...updated, type: card.type });
      } catch {
        Toast.show({ type: 'error', text1: 'Could not save', text2: 'Please try again.' });
      }
    }
    setEditMode(false);
  };

  const addPhotos = () => {
    if (!card) return;
    launchImageLibrary(
      { mediaType: 'photo', selectionLimit: 20, includeBase64: false, quality: 0.85, maxWidth: 2048, maxHeight: 2048 },
      async (res) => {
        if (res.didCancel || !res.assets?.length) return;
        const assets = res.assets
          .map((a) => ({ uri: a.uri ?? '', type: a.type ?? 'image/jpeg', name: a.fileName ?? 'photo.jpg' }))
          .filter((a) => a.uri);
        if (!assets.length) return;
        setUploading(true);
        try {
          const { photos: uploaded } = await uploadGalleryAlbumPhotos(card.id, assets);
          setPhotos((prev) => [
            ...prev,
            ...uploaded.map((p) => ({ id: p.id, uri: p.uri ?? '' })),
          ]);
          if (!card.bannerImageUrl && uploaded[0]?.uri) {
            const updated = await updateGalleryAlbum(card.id, { bannerImageUrl: uploaded[0].uri });
            onCardUpdated({ ...updated, type: card.type });
          }
        } catch {
          Toast.show({ type: 'error', text1: 'Upload failed', text2: 'Please try again.' });
        } finally {
          setUploading(false);
        }
      },
    );
  };

  const deletePhoto = async (photoId: string) => {
    if (!card) return;
    setDeletingId(photoId);
    try {
      await deleteGalleryAlbumPhoto(card.id, photoId);
      const removed = photos.find((p) => p.id === photoId);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      if (removed && card.bannerImageUrl === removed.uri) {
        const updated = await updateGalleryAlbum(card.id, { bannerImageUrl: null });
        onCardUpdated({ ...updated, type: card.type });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Could not delete', text2: 'Please try again.' });
    } finally {
      setDeletingId(null);
    }
  };

  const setPhotoAsCover = async (uri: string) => {
    if (!card) return;
    try {
      const updated = await updateGalleryAlbum(card.id, { bannerImageUrl: uri });
      onCardUpdated({ ...updated, type: card.type });
    } catch {
      Toast.show({ type: 'error', text1: 'Could not set cover', text2: 'Please try again.' });
    }
  };

  const changeCoverFromLibrary = () => {
    if (!card) return;
    launchImageLibrary(
      { mediaType: 'photo', selectionLimit: 1, quality: 0.9, maxWidth: 1200, maxHeight: 800 },
      async (res) => {
        if (res.didCancel || !res.assets?.length) return;
        const uri = res.assets[0].uri;
        if (!uri) return;
        const alreadyIn = photos.some((p) => p.uri === uri);
        if (!alreadyIn) {
          setUploading(true);
          try {
            const { photos: uploaded } = await uploadGalleryAlbumPhotos(card.id, [
              { uri, type: res.assets[0].type ?? 'image/jpeg', name: res.assets[0].fileName ?? 'cover.jpg' },
            ]);
            setPhotos((prev) => [...prev, ...uploaded.map((p) => ({ id: p.id, uri: p.uri ?? '' }))]);
            if (uploaded[0]?.uri) await setPhotoAsCover(uploaded[0].uri);
          } catch {
            Toast.show({ type: 'error', text1: 'Upload failed', text2: 'Please try again.' });
          } finally {
            setUploading(false);
          }
        } else {
          await setPhotoAsCover(uri);
        }
      },
    );
  };

  if (!card) return null;

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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {editMode ? (
                  <TouchableOpacity onPress={saveAndExitEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <CheckIcon />
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity onPress={() => setEditMode(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Pen size={18} color="#0d9488" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        showConfirm({
                          title: 'Archive album?',
                          message:
                            `Hide "${card.name}" from your gallery only.\n\n` +
                            'Friends will not see this album on your profile. Restore from Archived.',
                          confirmText: 'Archive',
                          onConfirm: () => { onArchiveCard(card.id); onClose(); },
                        });
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Archive size={18} color="#64748b" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        showConfirm({
                          title: 'Delete album permanently?',
                          message:
                            `Permanently delete "${card.name}" from your gallery.\n\n` +
                            'Does not delete shared trips or events. This cannot be undone.',
                          confirmText: 'Delete',
                          destructive: true,
                          onConfirm: () => { onDeleteCard(card.id); onClose(); },
                        });
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Trash2 size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </>
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
                      {editMode ? 'Tap "Add photos" below to fill this album.' : 'Tap the pencil icon to add photos.'}
                    </Text>
                  </View>
                )}

                {!loading && photos.length > 0 && (
                  <View style={styles.thumbRow}>
                    {photos.map((ph) => {
                      const isCover = !!card.bannerImageUrl && card.bannerImageUrl === ph.uri;
                      return (
                        <View key={ph.id} style={{ position: 'relative' }}>
                          <PhotoThumb
                            photo={ph}
                            onPress={() => !editMode && setPreviewIndex(photos.findIndex(p => p.id === ph.id))}
                          />
                          {/* Delete button — top-right */}
                          {editMode && (
                            <TouchableOpacity
                              onPress={() => {
                                showConfirm({
                                  title: 'Delete photo?',
                                  message: 'This photo will be removed from the album.',
                                  destructive: true,
                                  onConfirm: () => { deletePhoto(ph.id); },
                                });
                              }}
                              style={styles.thumbDeleteBtn}
                              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                              disabled={deletingId === ph.id}
                            >
                              {deletingId === ph.id
                                ? <ActivityIndicator size="small" color="#fff" style={{ width: 9, height: 9 }} />
                                : <Trash2 size={11} color="#fff" strokeWidth={2.5} />}
                            </TouchableOpacity>
                          )}
                          {/* Set as cover button — bottom-left, only in edit mode */}
                          {editMode && (
                            <TouchableOpacity
                              onPress={() => setPhotoAsCover(ph.uri)}
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
                  <TouchableOpacity
                    style={[styles.addPhotosBtn, uploading && { opacity: 0.6 }]}
                    onPress={addPhotos}
                    disabled={uploading}
                    activeOpacity={0.85}>
                    {uploading
                      ? <ActivityIndicator color="#0d9488" />
                      : <Text style={styles.addPhotosBtnText}>Add photos</Text>}
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

  const [customTripCards, setCustomTripCards] = useState<CustomCard[]>([]);
  const [customEventCards, setCustomEventCards] = useState<CustomCard[]>([]);
  const [showCreateCard, setShowCreateCard] = useState<'trip' | 'event' | null>(null);
  const [openCard, setOpenCard] = useState<CustomCard | null>(null);

  const userId: string = user?.id ?? '';
  const displayName = user?.fullName ?? '';
  const handle = user?.username ?? displayName.toLowerCase().replace(/ /g, '_') ?? 'username';

  useEffect(() => {
    setAvatarError(false);
  }, [user?.photoUrl]);

  const applyGalleryData = (data: Awaited<ReturnType<typeof getUserGallery>>) => {
    setGalleryTrips(data.trips ?? []);
    setGalleryEvents(data.events ?? []);
    const custom = data.customAlbums ?? { trip: [], event: [] };
    setCustomTripCards(
      (custom.trip ?? []).map((a) => ({ ...a, type: 'trip' as const })),
    );
    setCustomEventCards(
      (custom.event ?? []).map((a) => ({ ...a, type: 'event' as const })),
    );
  };

  const reloadGallery = () => {
    if (!userId) return;
    getUserGallery(userId)
      .then(applyGalleryData)
      .catch(() => {});
  };

  const createCustomCard = async (name: string, bannerUri?: string) => {
    const section = showCreateCard ?? 'trip';
    try {
      const album = await createGalleryAlbum({ name, section });
      if (bannerUri) {
        const { photos } = await uploadGalleryAlbumPhotos(album.id, [
          { uri: bannerUri, type: 'image/jpeg', name: 'cover.jpg' },
        ]);
        const coverUrl = photos[0]?.uri ?? bannerUri;
        await updateGalleryAlbum(album.id, { bannerImageUrl: coverUrl });
      }
      reloadGallery();
    } catch {
      Toast.show({ type: 'error', text1: 'Could not create album', text2: 'Please try again.' });
    }
  };

  const handleCardUpdated = (album: GalleryAlbumCard) => {
    const patch = (list: CustomCard[]) =>
      list.map((c) => (c.id === album.id ? { ...c, ...album, type: c.type } : c));
    setCustomTripCards(patch);
    setCustomEventCards(patch);
    setOpenCard((prev) => (prev?.id === album.id ? { ...prev, ...album } : prev));
  };

  const deleteCustomCard = async (id: string) => {
    try {
      await deleteGalleryAlbum(id);
      setCustomTripCards((p) => p.filter((c) => c.id !== id));
      setCustomEventCards((p) => p.filter((c) => c.id !== id));
      Toast.show({ type: 'success', text1: 'Deleted', text2: 'Album removed.' });
    } catch {
      Toast.show({ type: 'error', text1: 'Could not delete', text2: 'Please try again.' });
    }
  };

  const archiveCustomCard = async (id: string) => {
    try {
      await archiveGalleryAlbum(id);
      setCustomTripCards((p) => p.filter((c) => c.id !== id));
      setCustomEventCards((p) => p.filter((c) => c.id !== id));
      Toast.show({ type: 'success', text1: 'Archived', text2: 'Album moved to Archived.' });
    } catch {
      Toast.show({ type: 'error', text1: 'Could not archive', text2: 'Please try again.' });
    }
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

  // Fetch gallery data from server (+ one-time local migration)
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        await migrateLocalCustomGalleryAlbums(userId);
        const data = await getUserGallery(userId);
        if (!cancelled) applyGalleryData(data);
      } catch {
        if (!cancelled) setGalleryTrips(propTrips);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const displayTrips = galleryTrips.length > 0 ? galleryTrips : propTrips;

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
              icon={<Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" stroke="#0d9488" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>}
            />
            <View style={styles.grid}>
              {displayTrips.map((trip: any) => (
                <GridCard
                  key={trip.id}
                  item={trip}
                  onPress={() => setPhotoModal({ id: trip.id, name: trip.name, type: 'trip', subtitle: trip.gallerySubtitle ?? null, bannerImageUrl: trip.bannerImageUrl ?? null })}
                />
              ))}
              {customTripCards.map((card) => (
                <GridCard
                  key={card.id}
                  item={{ id: card.id, name: card.name, bannerImageUrl: card.bannerImageUrl }}
                  chip="custom-trip"
                  onPress={() => setOpenCard(card)}
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
              icon={<Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Rect x={3} y={4} width={18} height={18} rx={2} ry={2} stroke="#f59e0b" strokeWidth={2} /><Path d="M16 2v4M8 2v4M3 10h18" stroke="#f59e0b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>}
            />
            <View style={styles.grid}>
              {galleryEvents.map((ev: any) => (
                <GridCard
                  key={ev.id}
                  item={ev}
                  onPress={() => setPhotoModal({ id: ev.id, name: ev.name, type: 'event', subtitle: ev.gallerySubtitle ?? null, bannerImageUrl: ev.bannerImageUrl ?? null })}
                />
              ))}
              {customEventCards.map((card) => (
                <GridCard
                  key={card.id}
                  item={{ id: card.id, name: card.name, bannerImageUrl: card.bannerImageUrl }}
                  chip="custom-event"
                  onPress={() => setOpenCard(card)}
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
          onArchived={() => {
            setGalleryTrips((prev) => prev.filter((t) => t.id !== photoModal.id));
            setGalleryEvents((prev) => prev.filter((e) => e.id !== photoModal.id));
            reloadGallery();
          }}
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
        onCardUpdated={handleCardUpdated}
        onArchiveCard={archiveCustomCard}
        onDeleteCard={deleteCustomCard}
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
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  drivePhotosBtn: { borderColor: '#cbd5e1' },
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
