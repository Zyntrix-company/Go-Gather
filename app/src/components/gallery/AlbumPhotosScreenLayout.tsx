import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppScreenLayout, { TAB_BAR_BASE_HEIGHT } from '../common/AppScreenLayout';
import type { TabType } from '../common/FloatingTabBar';
import { AlbumPhotosOverlayContext } from './AlbumPhotosContext';

export { useAlbumPhotosOverlay } from './AlbumPhotosContext';

type AlbumPhotosScreenLayoutProps = {
  navigation: any;
  activeTab: TabType;
  onClose: () => void;
  photoIndex?: number;
  photoTotal?: number;
  /** Action buttons rendered over the top-right of the hero image. */
  heroOverlay?: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
  /** Transparent chrome over app gradient (Gallery modals). */
  galleryChrome?: boolean;
};

function buildPhotosHeaderSubtitle(photoIndex: number, photoTotal: number): string | undefined {
  if (photoTotal > 0) {
    return `${photoIndex + 1}/${photoTotal}`;
  }
  return undefined;
}

/** Full-screen album view with app-wide AppHeader + FloatingTabBar. */
export default function AlbumPhotosScreenLayout({
  navigation,
  activeTab,
  onClose,
  photoIndex = 0,
  photoTotal = 0,
  heroOverlay,
  footer,
  children,
}: AlbumPhotosScreenLayoutProps) {
  const insets = useSafeAreaInsets();
  const tabBarPad = TAB_BAR_BASE_HEIGHT + insets.bottom + 6;

  return (
    <AppScreenLayout
      navigation={navigation}
      activeTab={activeTab}
      title="Photos"
      subtitle={buildPhotosHeaderSubtitle(photoIndex, photoTotal)}
      onLogoPress={onClose}
    >
      <AlbumPhotosOverlayContext.Provider value={heroOverlay ?? null}>
        <View style={{ flex: 1, paddingBottom: tabBarPad }}>
          <View style={{ flex: 1, overflow: 'hidden' }}>{children}</View>
          {footer}
        </View>
      </AlbumPhotosOverlayContext.Provider>
    </AppScreenLayout>
  );
}
