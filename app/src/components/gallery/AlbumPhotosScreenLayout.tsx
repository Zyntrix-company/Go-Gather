import React from 'react';
import { View, ScrollView } from 'react-native';
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
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** Transparent chrome over app gradient (Gallery modals). */
  galleryChrome?: boolean;
  /** Custom block below app header (trip title, location, actions). */
  subHeader?: React.ReactNode;
  /** Scroll main content (gallery album detail with comments). */
  scrollable?: boolean;
};

/** Full-screen album view with app-wide AppHeader + FloatingTabBar. */
export default function AlbumPhotosScreenLayout({
  navigation,
  activeTab,
  onClose,
  heroOverlay,
  footer,
  children,
  subHeader,
  scrollable = false,
}: AlbumPhotosScreenLayoutProps) {
  const insets = useSafeAreaInsets();
  const tabBarPad = TAB_BAR_BASE_HEIGHT + insets.bottom + 6;

  const body = scrollable ? (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 12 }}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={{ flex: 1, overflow: 'hidden' }}>{children}</View>
  );

  return (
    <AppScreenLayout
      navigation={navigation}
      activeTab={activeTab}
      onLogoPress={onClose}
    >
      <AlbumPhotosOverlayContext.Provider value={heroOverlay ?? null}>
        <View style={{ flex: 1, paddingBottom: tabBarPad }}>
          {subHeader}
          {body}
          {footer}
        </View>
      </AlbumPhotosOverlayContext.Provider>
    </AppScreenLayout>
  );
}
