import type { RefObject } from 'react';
import type { FlatList } from 'react-native';

export type OrderedAlbumPhoto = {
  id: string;
  displayOrder?: number | null;
  createdAt?: string | null;
  activityId?: string | null;
};

/** Sort by displayOrder (server source of truth), then createdAt, then id. */
export function sortAlbumPhotosOldestFirst<T extends OrderedAlbumPhoto>(photos: T[]): T[] {
  return [...photos].sort((a, b) => {
    const oa = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
    const ob = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
    if (oa !== ob) return oa - ob;
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  });
}

/** Assign displayOrder from array index (row-major sequence within a section). */
export function applyDisplayOrder<T extends OrderedAlbumPhoto>(photos: T[]): T[] {
  return photos.map((photo, index) => ({ ...photo, displayOrder: index }));
}

/**
 * Flatten trip media: main trip photos first, then each activity's photos in activity order.
 * displayOrder is scoped per section (trip-level vs each activity).
 */
export function organizeTripMediaItems<T extends OrderedAlbumPhoto & { activityId?: string | null }>(
  photos: T[],
  activityOrder: string[] = [],
): T[] {
  const trip = sortAlbumPhotosOldestFirst(photos.filter((p) => !p.activityId));
  const byAct = new Map<string, T[]>();
  photos.forEach((p) => {
    if (!p.activityId) return;
    const list = byAct.get(p.activityId) ?? [];
    list.push(p);
    byAct.set(p.activityId, list);
  });

  const result: T[] = [...trip];
  for (const actId of activityOrder) {
    const list = byAct.get(actId);
    if (list?.length) {
      result.push(...sortAlbumPhotosOldestFirst(list));
      byAct.delete(actId);
    }
  }
  byAct.forEach((list) => {
    result.push(...sortAlbumPhotosOldestFirst(list));
  });
  return result;
}

export function focusAlbumPhotoAtIndex(
  index: number,
  setHeroIndex: (i: number) => void,
  heroRef: RefObject<FlatList<unknown> | null>,
) {
  if (index < 0) return;
  setHeroIndex(index);
  setTimeout(() => {
    const list = heroRef.current as any;
    const count = Array.isArray(list?.props?.data) ? list.props.data.length : null;
    if (count == null || count === 0) return;
    const safeIndex = Math.min(index, count - 1);
    if (safeIndex < 0) return;
    heroRef.current?.scrollToIndex({ index: safeIndex, animated: true });
  }, 80);
}

export function focusAlbumPhotosAtEnd(
  previousCount: number,
  addedCount: number,
  setHeroIndex: (i: number) => void,
  heroRef: RefObject<FlatList<unknown> | null>,
) {
  if (addedCount <= 0) return;
  focusAlbumPhotoAtIndex(previousCount + addedCount - 1, setHeroIndex, heroRef);
}

export function buildReorderPayload<T extends { id: string }>(items: T[]): { id: string; displayOrder: number }[] {
  return items.map((item, index) => ({ id: item.id, displayOrder: index }));
}
