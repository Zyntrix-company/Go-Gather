import React, { createContext, useContext } from 'react';
import { Dimensions } from 'react-native';

const { width: SCREEN_W } = Dimensions.get('window');

export const AlbumPhotosOverlayContext = createContext<React.ReactNode>(null);
export const AlbumPhotosPageWidthContext = createContext<number | null>(null);

export function useAlbumPhotosOverlay() {
  return useContext(AlbumPhotosOverlayContext);
}

/** Pager width — dialog content width when inside AlbumPhotosDialogLayout, else screen width. */
export function useAlbumPhotosPageWidth() {
  const w = useContext(AlbumPhotosPageWidthContext);
  return w ?? SCREEN_W;
}
