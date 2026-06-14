import type { RefObject } from 'react';
import type { FlatList } from 'react-native';

export type OrderedAlbumPhoto = {
  id: string;
  displayOrder?: number | null;
  createdAt?: string | null;
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

export function focusAlbumPhotoAtIndex(
  index: number,
  setHeroIndex: (i: number) => void,
  heroRef: RefObject<FlatList<unknown> | null>,
) {
  if (index < 0) return;
  setHeroIndex(index);
  setTimeout(() => {
    heroRef.current?.scrollToIndex({ index, animated: true });
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
