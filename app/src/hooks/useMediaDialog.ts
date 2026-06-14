import { useCallback, useMemo, useState } from 'react';
import { Dimensions } from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import type { Photo } from '../api/trips.api';
import {
  deleteTripPhoto,
  reorderActivityPhotos,
  reorderTripPhotos,
  uploadTripPhotos,
} from '../api/trips.api';
import {
  deleteEventPhoto,
  reorderEventPhotos,
  uploadEventPhotos,
} from '../api/events.api';
import { updateTrip } from '../api/trips.api';
import { updateEvent } from '../api/events.api';
import useUploadLimits from './useUploadLimits';
import { sortAlbumPhotosOldestFirst, buildReorderPayload } from '../utils/albumPhotosOrder';
import type { MediaThumbnailItem } from '../components/media/MediaThumbnail';

const GRID_H_PADDING = 32;
const GRID_GAP = 8;
const GRID_COLUMNS = 3;
const { width: SCREEN_W } = Dimensions.get('window');
export const MEDIA_CELL_SIZE = Math.floor((SCREEN_W - GRID_H_PADDING - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS);

export type MediaItem = MediaThumbnailItem & {
  name?: string;
  uploadedBy?: string;
  activityId?: string | null;
  activityTitle?: string | null;
  createdAt?: string | null;
  displayOrder?: number | null;
};

export function mapApiPhoto(p: Photo, localUri?: string): MediaItem {
  return {
    id: p.id,
    uri: p.url ?? p.fileUrl ?? '',
    localUri,
    mimeType: p.mimeType ?? null,
    name: p.id,
    uploadedBy: p.uploadedBy,
    activityId: p.activityId ?? null,
    activityTitle: p.activityTitle ?? null,
    createdAt: p.createdAt ?? p.uploadedAt ?? null,
    displayOrder: p.displayOrder ?? null,
  };
}

type ActivityRef = { id: string; title: string };

type UseMediaDialogOptions = {
  mode: 'trip' | 'event';
  entityId: string;
  activities?: ActivityRef[];
  bannerImageUrl?: string | null;
  onBannerUpdated?: (url: string) => void;
  onError?: (err: unknown) => void;
};

export function useMediaDialog({
  mode,
  entityId,
  activities = [],
  bannerImageUrl,
  onBannerUpdated,
  onError,
}: UseMediaDialogOptions) {
  const uploadLimits = useUploadLimits();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingBanner, setSettingBanner] = useState(false);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);

  const capTotal = mode === 'trip'
    ? uploadLimits.tripPhoto.maxFilesTotal
    : uploadLimits.eventPhoto.maxFilesTotal;

  const tripLevelItems = useMemo(
    () => sortAlbumPhotosOldestFirst(items.filter((p) => !p.activityId)),
    [items],
  );

  const activitySections = useMemo(() => {
    if (mode !== 'trip') return [];
    const byAct = new Map<string, MediaItem[]>();
    items.forEach((p) => {
      if (!p.activityId) return;
      const list = byAct.get(p.activityId) ?? [];
      list.push(p);
      byAct.set(p.activityId, list);
    });

    const ordered: { activityId: string; title: string; photos: MediaItem[] }[] = [];
    activities.forEach((act) => {
      const photos = sortAlbumPhotosOldestFirst(byAct.get(act.id) ?? []);
      if (photos.length > 0) {
        ordered.push({ activityId: act.id, title: act.title, photos });
      }
    });
    byAct.forEach((photos, activityId) => {
      if (ordered.some((s) => s.activityId === activityId)) return;
      const title = photos[0]?.activityTitle?.trim() || 'Activity';
      ordered.push({ activityId, title, photos: sortAlbumPhotosOldestFirst(photos) });
    });
    return ordered;
  }, [mode, items, activities]);

  const eventItems = useMemo(
    () => (mode === 'event' ? sortAlbumPhotosOldestFirst(items) : []),
    [mode, items],
  );

  const mediaCount = mode === 'trip' ? tripLevelItems.length : eventItems.length;
  const uploadDisabled = capTotal != null && mediaCount >= capTotal;

  const setFromApiPhotos = useCallback((photos: Photo[], localCache: Record<string, string> = {}) => {
    const mapped = photos.map((p) => mapApiPhoto(p, localCache[p.id]));
    setItems(sortAlbumPhotosOldestFirst(mapped));
  }, []);

  const mergeApiPhotos = useCallback((photos: Photo[]) => {
    setItems((prev) => {
      const cache: Record<string, string> = {};
      prev.forEach((p) => { if (p.localUri) cache[p.id] = p.localUri; });
      const mapped = photos.map((p) => mapApiPhoto(p, cache[p.id]));
      return sortAlbumPhotosOldestFirst(mapped);
    });
  }, []);

  const handlePick = useCallback((cam: boolean) => {
    if (uploadDisabled) return;
    const fn = cam ? launchCamera : launchImageLibrary;
    const batchCap = mode === 'trip'
      ? uploadLimits.tripPhoto.maxBatchFiles
      : uploadLimits.eventPhoto.maxBatchFiles;
    const opts = cam
      ? { mediaType: 'mixed' as const }
      : { mediaType: 'mixed' as const, selectionLimit: batchCap };

    fn(opts, async (res) => {
      if (res.didCancel || res.errorCode) return;
      const assets = (res.assets || []).map((a) => ({
        uri: a.uri ?? '',
        type: a.type ?? 'image/jpeg',
        name: a.fileName ?? 'photo.jpg',
      })).filter((a) => a.uri);
      if (!assets.length) return;

      const tempIds = assets.map((_, i) => `temp_${Date.now()}_${i}`);
      const optimistic: MediaItem[] = assets.map((a, i) => ({
        id: tempIds[i],
        uri: a.uri,
        localUri: a.uri,
        mimeType: a.type ?? 'image/jpeg',
        activityId: null,
        activityTitle: null,
        createdAt: new Date().toISOString(),
      }));

      setItems((prev) => sortAlbumPhotosOldestFirst([...prev, ...optimistic]));
      setUploading(true);
      try {
        const data = mode === 'trip'
          ? await uploadTripPhotos(entityId, assets)
          : await uploadEventPhotos(entityId, assets);
        setItems((prev) => {
          const withoutTemps = prev.filter((ph) => !tempIds.includes(ph.id));
          const newPhotos = data.photos.map((ph, i) => mapApiPhoto(ph, assets[i]?.uri));
          return sortAlbumPhotosOldestFirst([...withoutTemps, ...newPhotos]);
        });
      } catch (err) {
        setItems((prev) => prev.filter((ph) => !tempIds.includes(ph.id)));
        onError?.(err);
      } finally {
        setUploading(false);
      }
    });
  }, [uploadDisabled, mode, entityId, uploadLimits, onError]);

  const handleDelete = useCallback(async (photoId: string) => {
    if (photoId.startsWith('temp_')) return;
    setDeletingId(photoId);
    try {
      if (mode === 'trip') {
        await deleteTripPhoto(entityId, photoId);
      } else {
        await deleteEventPhoto(entityId, photoId);
      }
      setItems((prev) => prev.filter((p) => p.id !== photoId));
      if (previewItem?.id === photoId) setPreviewItem(null);
    } catch (err) {
      onError?.(err);
    } finally {
      setDeletingId(null);
    }
  }, [mode, entityId, previewItem, onError]);

  const handleReorderTripLevel = useCallback(async (reordered: MediaItem[]) => {
    const payload = buildReorderPayload(reordered);
    const prev = items;
    setItems((p) => {
      const activity = p.filter((x) => x.activityId);
      return sortAlbumPhotosOldestFirst([...reordered, ...activity]);
    });
    try {
      await reorderTripPhotos(entityId, payload);
    } catch (err) {
      setItems(prev);
      onError?.(err);
    }
  }, [items, entityId, onError]);

  const handleReorderActivity = useCallback(async (activityId: string, reordered: MediaItem[]) => {
    const payload = buildReorderPayload(reordered);
    const prev = items;
    setItems((p) => {
      const other = p.filter((x) => x.activityId !== activityId);
      return sortAlbumPhotosOldestFirst([...other, ...reordered]);
    });
    try {
      await reorderActivityPhotos(entityId, activityId, payload);
    } catch (err) {
      setItems(prev);
      onError?.(err);
    }
  }, [items, entityId, onError]);

  const handleReorderEvent = useCallback(async (reordered: MediaItem[]) => {
    const payload = buildReorderPayload(reordered);
    const prev = items;
    setItems(sortAlbumPhotosOldestFirst(reordered));
    try {
      await reorderEventPhotos(entityId, payload);
    } catch (err) {
      setItems(prev);
      onError?.(err);
    }
  }, [items, entityId, onError]);

  const handleSetBanner = useCallback(async (item: MediaItem) => {
    const url = item.uri;
    setSettingBanner(true);
    try {
      if (mode === 'trip') {
        await updateTrip(entityId, { bannerImageUrl: url });
      } else {
        await updateEvent(entityId, { bannerImageUrl: url });
      }
      onBannerUpdated?.(url);
    } catch (err) {
      onError?.(err);
    } finally {
      setSettingBanner(false);
    }
  }, [mode, entityId, onBannerUpdated, onError]);

  return {
    items,
    setItems,
    setFromApiPhotos,
    mergeApiPhotos,
    loading,
    setLoading,
    uploading,
    deletingId,
    settingBanner,
    previewItem,
    setPreviewItem,
    capTotal,
    mediaCount,
    uploadDisabled,
    tripLevelItems,
    activitySections,
    eventItems,
    cellSize: MEDIA_CELL_SIZE,
    handlePick,
    handleDelete,
    handleReorderTripLevel,
    handleReorderActivity,
    handleReorderEvent,
    handleSetBanner,
    bannerImageUrl,
  };
}
