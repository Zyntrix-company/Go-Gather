import type { RefObject } from 'react';
import type { FlatList } from 'react-native';

export type OrderedAlbumPhoto = {
  id: string;
  createdAt?: string | null;
};

/** Oldest first so new uploads appear on the right in the carousel / thumb strip. */
export function sortAlbumPhotosOldestFirst<T extends OrderedAlbumPhoto>(photos: T[]): T[] {
  return [...photos].sort((a, b) => {
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
