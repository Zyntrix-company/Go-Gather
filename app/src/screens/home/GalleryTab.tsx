import React, { useState, useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  View, Text, TouchableOpacity, ScrollView, Image,
  Dimensions, StyleSheet, ActivityIndicator, Modal, TextInput, Animated, FlatList,
} from 'react-native';
import { showConfirm } from '../../store/alertStore';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import {
  createGalleryAlbum,
  updateGalleryAlbum,
  archiveGalleryAlbum,
  deleteGalleryAlbum,
  getMyGalleryAlbumPhotos,
  uploadGalleryAlbumPhotos,
  deleteGalleryAlbumPhoto,
  getMyGalleryItemPhotos,
  uploadGalleryItemPhotos,
  hideGallerySharedPhoto,
  deleteGalleryExtraPhoto,
  type GalleryAlbumCard,
} from '../../api/gallery.api';
import { migrateLocalCustomGalleryAlbums } from '../../utils/migrateCustomGalleryAlbums';
import CachedImage from '../../components/common/CachedImage';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { PencilLine, Pen, Archive, Trash2 } from 'lucide-react-native';
import { DriveBrandIcon } from '../../components/common/GoogleWorkspaceIcons';
import { getUserGallery, upsertGallerySubtitle, archiveGalleryItem } from '../../api/ai.api';
import { updateTrip, listDrivePhotoFiles, importDrivePhotosToGallery, type DriveFile } from '../../api/trips.api';
import { checkDriveConnected, promptConnectDrive, watchDriveConnect } from '../../utils/drivePickerFlow';
import { updateEvent } from '../../api/events.api';
import Toast from 'react-native-toast-message';
import { albumChromeStyles as acs, GALLERY_ALBUM_HERO_H } from '../../constants/albumPhotosLayout';
import AlbumPhotosFooter from '../../components/gallery/AlbumPhotosFooter';
import AlbumPhotosScreenLayout from '../../components/gallery/AlbumPhotosScreenLayout';
import AlbumPhotosHeroCarousel from '../../components/gallery/AlbumPhotosHeroCarousel';
import AlbumPhotosThumbStrip, { AlbumPhotosBody } from '../../components/gallery/AlbumPhotosThumbStrip';
import DrivePickerRow from '../../components/gallery/DrivePickerRow';
import GalleryAlbumSubHeader from '../../components/gallery/GalleryAlbumSubHeader';
import GalleryUploadSheet from '../../components/gallery/GalleryUploadSheet';
import GalleryTravelersRow, { type GalleryTraveler } from '../../components/gallery/GalleryTravelersRow';
import GalleryEngagementSection from '../../components/gallery/GalleryEngagementSection';
import { getTripMembers } from '../../api/trips.api';
import { getEventMembers } from '../../api/events.api';
import { focusAlbumPhotosAtEnd, sortAlbumPhotosOldestFirst } from '../../utils/albumPhotosOrder';
import useUploadLimits from '../../hooks/useUploadLimits';
import { useGalleryEngagement } from '../../hooks/useGalleryEngagement';

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
  localUri?: string;
  activityId?: string | null;
  activityTitle?: string | null;
  source?: 'shared' | 'extra';
  createdAt?: string | null;
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
        <View style={{ ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }}>
          <ActivityIndicator size="large" color="#0d9488" />
        </View>
      )}
    </View>
  );
}

// ─── Photos modal (trip/event cards — owner can edit, viewers read-only) ──────

function PhotosModal({
  visible,
  title,
  location,
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
  location?: string | null;
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
  const uploadLimits = useUploadLimits();
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const heroFlatListRef = useRef<any>(null);
  const [nameDraft, setNameDraft] = useState(title);
  const [subtitleDraft, setSubtitleDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const localUriCache = useRef<Record<string, string>>({});
  const pendingDrivePickerRef = useRef(false);
  const [driveStatus, setDriveStatus] = useState({ connected: false });
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [drivePickerLoading, setDrivePickerLoading] = useState(false);
  const [selectedDriveFileIds, setSelectedDriveFileIds] = useState<Set<string>>(new Set());
  const [driveImporting, setDriveImporting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showUploadSheet, setShowUploadSheet] = useState(false);
  const [members, setMembers] = useState<GalleryTraveler[]>([]);

  const engagement = useGalleryEngagement({
    kind: 'trip-event',
    enabled: visible && !!parentId && !userId,
    parentType,
    parentId,
  });

  useEffect(() => {
    if (!visible || userId) return;
    checkDriveConnected().then((connected) => setDriveStatus({ connected }));

    return watchDriveConnect(() => {
      setDriveStatus({ connected: true });
      if (pendingDrivePickerRef.current && visible) {
        pendingDrivePickerRef.current = false;
        openPhotoDrivePicker();
      }
    });
  }, [visible, userId]);

  useEffect(() => {
    if (visible) {
      setEditMode(false);
      setHeroIndex(0);
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
      fetcher = Promise.resolve({ photos: [] });
    } else {
      fetcher = getMyGalleryItemPhotos(parentType, parentId);
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
          source: ph.source ?? 'shared',
          createdAt: ph.createdAt ?? null,
        }));
        setPhotos(sortAlbumPhotosOldestFirst(mapped));
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

  useEffect(() => {
    if (!visible || !parentId || userId) return;
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
  }, [visible, parentId, parentType, userId]);

  const pickPhotos = (cam: boolean) => {
    const fn = cam ? launchCamera : launchImageLibrary;
    const batch = uploadLimits.galleryPhoto.maxBatchFiles;
    const opts = cam
      ? { mediaType: 'photo' as const, quality: 0.85, maxWidth: 2048, maxHeight: 2048 }
      : { mediaType: 'photo' as const, selectionLimit: batch, quality: 0.85, maxWidth: 2048, maxHeight: 2048 };
    fn(opts, async (res) => {
      if (res.didCancel || !res.assets?.length) return;

      const assets = res.assets.map((a) => ({
        uri: a.uri ?? '',
        type: a.type ?? 'image/jpeg',
        name: a.fileName ?? 'photo.jpg',
      })).filter((a) => a.uri);
      if (!assets.length) return;

      const tempIds = assets.map((_, i) => `temp_${Date.now()}_${i}`);
      const optimistic: PhotoItem[] = assets.map((a, i) => ({
        id: tempIds[i],
        uri: a.uri,
        localUri: a.uri,
        activityId: null,
        activityTitle: null,
        source: 'extra' as const,
        createdAt: new Date().toISOString(),
      }));
      setPhotos((prev) => {
        focusAlbumPhotosAtEnd(prev.length, optimistic.length, setHeroIndex, heroFlatListRef);
        return [...prev, ...optimistic];
      });

      setUploading(true);
      try {
        const result = await uploadGalleryItemPhotos(parentType, parentId, assets);

        setPhotos((prev) => {
          const withoutTemps = prev.filter((p) => !tempIds.includes(p.id));
          const uploaded: PhotoItem[] = result.photos.map((ph: any, i: number) => ({
            id: ph.id,
            uri: ph.url ?? ph.fileUrl ?? ph.uri ?? assets[i]?.uri ?? '',
            localUri: assets[i]?.uri,
            activityId: null,
            activityTitle: null,
            source: 'extra' as const,
            createdAt: ph.createdAt ?? new Date().toISOString(),
          }));
          uploaded.forEach((p) => { if (p.localUri) localUriCache.current[p.id] = p.localUri; });
          const next = [...withoutTemps, ...uploaded];
          focusAlbumPhotosAtEnd(withoutTemps.length, uploaded.length, setHeroIndex, heroFlatListRef);
          return next;
        });
      } catch (err: any) {
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
    });
  };

  const openPhotoDrivePicker = async () => {
    const connected = await checkDriveConnected();
    setDriveStatus({ connected });

    if (!connected) {
      pendingDrivePickerRef.current = true;
      promptConnectDrive();
      return;
    }

    pendingDrivePickerRef.current = false;
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
      const res = await importDrivePhotosToGallery(parentType, parentId, selected);
      if (res.imported.length > 0) {
        const imported = res.imported.map((ph) => ({
          id: ph.id,
          uri: ph.url ?? ph.fileUrl ?? '',
          activityId: null,
          activityTitle: null,
          source: 'extra' as const,
          createdAt: ph.createdAt ?? new Date().toISOString(),
        }));
        setPhotos((prev) => {
          focusAlbumPhotosAtEnd(prev.length, imported.length, setHeroIndex, heroFlatListRef);
          return [...prev, ...imported];
        });
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

  const removePhotoFromGallery = async (ph: PhotoItem) => {
    setDeletingId(ph.id);
    try {
      if (ph.source === 'extra') {
        await deleteGalleryExtraPhoto(ph.id);
      } else {
        await hideGallerySharedPhoto(parentType, parentId, ph.id);
      }
      setPhotos((prev) => {
        const next = prev.filter((p) => p.id !== ph.id);
        setHeroIndex((hi) => Math.min(hi, Math.max(0, next.length - 1)));
        return next;
      });
    } catch {
      Toast.show({ type: 'error', text1: 'Could not remove photo', text2: 'Please try again.' });
    } finally {
      setDeletingId(null);
    }
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

  const currentPhoto = photos[heroIndex];
  const activityLabel = currentPhoto?.activityTitle?.trim() || null;
  const displaySubtitle = editMode ? subtitleDraft : (initialSubtitle?.trim() ?? '');

  return (
    <>
      <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
        <AlbumPhotosScreenLayout
          navigation={navigation}
          activeTab="gallery"
          galleryChrome
          scrollable
          onClose={onClose}
          subHeader={
            <GalleryAlbumSubHeader
              title={title}
              location={location}
              editMode={editMode}
              viewOnly={!!userId}
              nameDraft={nameDraft}
              subtitleDraft={subtitleDraft}
              onNameChange={setNameDraft}
              onSubtitleChange={setSubtitleDraft}
              onBack={onClose}
              onEdit={() => setEditMode(true)}
              onArchive={handleArchiveAlbum}
              onUpload={() => setShowUploadSheet(true)}
              onDoneEdit={handleDoneEdit}
              saving={saving}
            />
          }
        >
          <AlbumPhotosHeroCarousel
            galleryChrome
            photos={photos}
            heroIndex={heroIndex}
            onIndexChange={setHeroIndex}
            heroRef={heroFlatListRef}
            loading={loading}
            scrollEnabled={!editMode}
            fixedHeight={GALLERY_ALBUM_HERO_H}
            showPagerDots={false}
            activityLabel={activityLabel}
            renderPhoto={(item) => <GalleryHeroPhoto photo={item} />}
          />
          <AlbumPhotosThumbStrip
            photos={photos}
            heroIndex={heroIndex}
            scrollEnabled={!editMode}
            transparent
            galleryChrome
            onSelect={(idx) => {
              setHeroIndex(idx);
              heroFlatListRef.current?.scrollToIndex({ index: idx, animated: true });
            }}
            renderOverlay={(ph, _idx) => {
              if (!editMode || userId) return null;
              const isExtra = ph.source === 'extra';
              return (
                <TouchableOpacity
                  onPress={() => {
                    showConfirm({
                      title: isExtra ? 'Delete photo?' : 'Remove from my gallery?',
                      message: isExtra
                        ? 'This photo will be permanently removed from your gallery.'
                        : 'This photo stays in the trip/event album for other members.',
                      destructive: true,
                      confirmText: isExtra ? 'Delete' : 'Remove',
                      onConfirm: () => removePhotoFromGallery(ph as PhotoItem),
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
              );
            }}
          />
          {!editMode && displaySubtitle ? (
            <Text style={styles.galleryDescription}>{displaySubtitle}</Text>
          ) : null}
          {parentType === 'trip' ? <GalleryTravelersRow members={members} /> : null}
          {!userId ? (
            <GalleryEngagementSection
              likeCount={engagement.likeCount}
              likedByMe={engagement.likedByMe}
              comments={engagement.comments}
              canModerateComments
              onToggleLike={engagement.handleToggleLike}
              liking={engagement.liking}
              onAddComment={engagement.handleAddComment}
              onEditComment={engagement.handleEditComment}
              onDeleteComment={engagement.handleDeleteComment}
            />
          ) : null}
        </AlbumPhotosScreenLayout>
      </Modal>
      <GalleryUploadSheet
        visible={showUploadSheet}
        onClose={() => setShowUploadSheet(false)}
        onGallery={() => pickPhotos(false)}
        onCamera={() => pickPhotos(true)}
        onDrive={openPhotoDrivePicker}
        busy={uploading || driveImporting}
      />
      <Modal visible={showDrivePicker}  animationType="slide" onRequestClose={() => setShowDrivePicker(false)}>
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
                renderItem={({ item }) => (
                  <DrivePickerRow
                    file={item}
                    showThumbnail
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
                  style={[styles.addPhotosBtn, { opacity: selectedDriveFileIds.size === 0 ? 0.5 : 1 }]}
                  onPress={confirmPhotoDriveImport}
                  disabled={selectedDriveFileIds.size === 0 || driveImporting}
                  activeOpacity={0.85}
                >
                  {driveImporting ? (
                    <ActivityIndicator color="#0d9488" />
                  ) : (
                    <Text style={styles.addPhotosBtnText}>
                      Import
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
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
  const navigation = useNavigation<any>();
  const uploadLimits = useUploadLimits();
  const [editMode, setEditMode] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const heroFlatListRef = useRef<any>(null);

  const engagement = useGalleryEngagement({
    kind: 'custom',
    enabled: visible && !!card?.id,
    albumId: card?.id ?? '',
  });

  const loadPhotos = () => {
    if (!card?.id) return;
    setLoading(true);
    getMyGalleryAlbumPhotos(card.id)
      .then((res) => {
        setPhotos(sortAlbumPhotosOldestFirst(
          res.photos.map((p) => ({ id: p.id, uri: p.uri ?? '', createdAt: p.createdAt ?? null })),
        ));
      })
      .catch(() => setPhotos([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!visible) {
      setEditMode(false);
      setPhotos([]);
      setHeroIndex(0);
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

  const uploadAssets = async (assets: { uri: string; type: string; name: string }[]) => {
    if (!card || !assets.length) return;
    setUploading(true);
    try {
      const { photos: uploaded } = await uploadGalleryAlbumPhotos(card.id, assets);
      setPhotos((prev) => {
        const mapped = uploaded.map((p) => ({
          id: p.id,
          uri: p.uri ?? '',
          createdAt: p.createdAt ?? new Date().toISOString(),
        }));
        focusAlbumPhotosAtEnd(prev.length, mapped.length, setHeroIndex, heroFlatListRef);
        return [...prev, ...mapped];
      });
      if (!card.bannerImageUrl && uploaded[0]?.uri) {
        const updated = await updateGalleryAlbum(card.id, { bannerImageUrl: uploaded[0].uri });
        onCardUpdated({ ...updated, type: card.type });
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Upload failed', text2: 'Please try again.' });
    } finally {
      setUploading(false);
    }
  };

  const pickPhotos = (cam: boolean) => {
    if (!card) return;
    const fn = cam ? launchCamera : launchImageLibrary;
    const batch = uploadLimits.galleryPhoto.maxBatchFiles;
    const opts = cam
      ? { mediaType: 'photo' as const, quality: 0.85, maxWidth: 2048, maxHeight: 2048 }
      : { mediaType: 'photo' as const, selectionLimit: batch, includeBase64: false, quality: 0.85, maxWidth: 2048, maxHeight: 2048 };
    fn(opts, async (res) => {
      if (res.didCancel || !res.assets?.length) return;
      const assets = res.assets
        .map((a) => ({ uri: a.uri ?? '', type: a.type ?? 'image/jpeg', name: a.fileName ?? 'photo.jpg' }))
        .filter((a) => a.uri);
      await uploadAssets(assets);
    });
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
      Toast.show({ type: 'success', text1: 'Cover updated' });
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
          await uploadAssets([{ uri, type: res.assets[0].type ?? 'image/jpeg', name: res.assets[0].fileName ?? 'cover.jpg' }]);
        }
        await setPhotoAsCover(uri);
      },
    );
  };

  if (!card) return null;

  return (
    <>
      <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
        <AlbumPhotosScreenLayout
          navigation={navigation}
          activeTab="gallery"
          galleryChrome
          scrollable
          onClose={onClose}
          photoIndex={heroIndex}
          photoTotal={photos.length}
          heroOverlay={
            editMode ? (
              <TouchableOpacity onPress={saveAndExitEdit} style={acs.heroOverlayBtnLight}>
                <CheckIcon />
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity onPress={() => setEditMode(true)} style={acs.heroOverlayBtnLight} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Pen size={15} color="#0d9488" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    showConfirm({
                      title: 'Archive album?',
                      message: `Hide "${card.name}" from your gallery only.\n\nFriends will not see this album on your profile. Restore from Archived.`,
                      confirmText: 'Archive',
                      onConfirm: () => { onArchiveCard(card.id); onClose(); },
                    });
                  }}
                  style={acs.heroOverlayBtnLight}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Archive size={15} color="#64748b" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    showConfirm({
                      title: 'Delete album permanently?',
                      message: `Permanently delete "${card.name}" from your gallery only.\n\nDoes not delete shared trips or events. This cannot be undone.`,
                      confirmText: 'Delete',
                      destructive: true,
                      onConfirm: () => { onDeleteCard(card.id); onClose(); },
                    });
                  }}
                  style={acs.heroOverlayBtnLight}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Trash2 size={15} color="#ef4444" />
                </TouchableOpacity>
              </>
            )
          }
          footer={
            <AlbumPhotosFooter
              galleryChrome
              aboveTabBar
              onUpload={() => pickPhotos(false)}
              onCamera={() => pickPhotos(true)}
              uploading={uploading}
              showDrive={false}
            />
          }
        >
          <AlbumPhotosBody>
            <AlbumPhotosHeroCarousel
              galleryChrome
              photos={photos}
              heroIndex={heroIndex}
              onIndexChange={setHeroIndex}
              heroRef={heroFlatListRef}
              loading={loading}
              scrollEnabled={!editMode}
              renderPhoto={(item) => <GalleryHeroPhoto photo={item} />}
            />
            <AlbumPhotosThumbStrip
              photos={photos}
              heroIndex={heroIndex}
              scrollEnabled={!editMode}
              transparent
              galleryChrome
              onSelect={(idx) => {
                setHeroIndex(idx);
                heroFlatListRef.current?.scrollToIndex({ index: idx, animated: true });
              }}
              renderOverlay={(ph, idx) => {
                const isCover = !!card.bannerImageUrl && card.bannerImageUrl === ph.uri;
                if (!editMode && isCover) {
                  return (
                    <View style={[styles.coverBadge, { top: 4, left: 4 }]}>
                      <Text style={styles.coverBadgeText}>Cover</Text>
                    </View>
                  );
                }
                if (!editMode) return null;
                return (
                  <>
                    <TouchableOpacity
                      onPress={() => {
                        showConfirm({
                          title: 'Delete photo?',
                          message: 'This photo will be removed from the album.',
                          destructive: true,
                          onConfirm: () => deletePhoto(ph.id),
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
                    <TouchableOpacity
                      onPress={() => setPhotoAsCover(ph.uri)}
                      style={[styles.thumbCoverBtn, isCover && styles.thumbCoverBtnActive]}
                      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                    >
                      <Text style={{ fontSize: 8, fontWeight: '700', color: isCover ? '#0d9488' : '#fff' }}>Cover</Text>
                    </TouchableOpacity>
                  </>
                );
              }}
            />
            <View style={acs.metaCardTransparent}>
              {editMode ? (
                <>
                  <TextInput
                    value={nameDraft}
                    onChangeText={setNameDraft}
                    style={[styles.titleEditInput, { fontSize: 14, marginBottom: 4, paddingVertical: 4 }]}
                    placeholderTextColor="#94a3b8"
                    placeholder="Album title"
                    returnKeyType="done"
                    onSubmitEditing={saveAndExitEdit}
                  />
                  <TouchableOpacity style={[styles.changeCoverRow, { marginBottom: 4 }]} onPress={changeCoverFromLibrary} activeOpacity={0.75}>
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                      <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      <Circle cx={12} cy={13} r={4} stroke="#0d9488" strokeWidth={2} />
                    </Svg>
                    <Text style={[styles.changeCoverText, { fontSize: 12 }]}>Change cover</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={acs.metaTitle} numberOfLines={1}>{card.name}</Text>
              )}
              <View style={acs.metaRow}>
                <View style={{ backgroundColor: '#f0fdf4', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: '#0d9488' }}>
                    {card.type === 'trip' ? 'Custom trip album' : 'Custom event album'}
                  </Text>
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
              canModerateComments
              onToggleLike={engagement.handleToggleLike}
              liking={engagement.liking}
              onAddComment={engagement.handleAddComment}
              onEditComment={engagement.handleEditComment}
              onDeleteComment={engagement.handleDeleteComment}
            />
          </AlbumPhotosBody>
        </AlbumPhotosScreenLayout>
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
    location?: string | null;
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
                  onPress={() => setPhotoModal({ id: trip.id, name: trip.name, type: 'trip', subtitle: trip.gallerySubtitle ?? null, location: trip.location ?? null, bannerImageUrl: trip.bannerImageUrl ?? null })}
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
                  onPress={() => setPhotoModal({ id: ev.id, name: ev.name, type: 'event', subtitle: ev.gallerySubtitle ?? null, location: ev.location ?? null, bannerImageUrl: ev.bannerImageUrl ?? null })}
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
          location={photoModal.location}
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
  galleryDescription: {
    fontSize: 14,
    color: '#0f172a',
    lineHeight: 21,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
});
