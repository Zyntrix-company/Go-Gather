import React, { createContext, useContext, RefObject } from 'react';
import { Dimensions, ScrollView } from 'react-native';

const { width: SCREEN_W } = Dimensions.get('window');

export const AlbumPhotosOverlayContext = createContext<React.ReactNode>(null);
export const AlbumPhotosPageWidthContext = createContext<number | null>(null);
export const AlbumPhotosScrollContext = createContext<RefObject<ScrollView | null> | null>(null);

/** Active hero calls this so a pinch or zoom can pause horizontal paging. */
export type AlbumHeroScrollLock = (ownerId: string, locked: boolean) => void;
const AlbumHeroScrollLockContext = createContext<AlbumHeroScrollLock>(() => {});

export function useAlbumPhotosOverlay() {
  return useContext(AlbumPhotosOverlayContext);
}

/** Pager width — dialog content width when inside AlbumPhotosDialogLayout, else screen width. */
export function useAlbumPhotosPageWidth() {
  const w = useContext(AlbumPhotosPageWidthContext);
  return w ?? SCREEN_W;
}

/** Parent ScrollView ref when album detail is scrollable (comment compose). */
export function useAlbumPhotosScroll() {
  return useContext(AlbumPhotosScrollContext);
}

export function useAlbumHeroScrollLock() {
  return useContext(AlbumHeroScrollLockContext);
}

export { AlbumHeroScrollLockContext };
