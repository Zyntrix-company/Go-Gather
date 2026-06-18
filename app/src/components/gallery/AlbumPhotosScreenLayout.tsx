import React, { useRef } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppScreenLayout, { TAB_BAR_BASE_HEIGHT } from '../common/AppScreenLayout';
import type { TabType } from '../common/FloatingTabBar';
import { AlbumPhotosOverlayContext, AlbumPhotosScrollContext } from './AlbumPhotosContext';

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
  const scrollRef = useRef<ScrollView>(null);

  const body = scrollable ? (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 : 0}
    >
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
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
        <AlbumPhotosScrollContext.Provider value={scrollable ? scrollRef : null}>
          <View style={{ flex: 1, paddingBottom: tabBarPad }}>
            {subHeader}
            {body}
            {footer}
          </View>
        </AlbumPhotosScrollContext.Provider>
      </AlbumPhotosOverlayContext.Provider>
    </AppScreenLayout>
  );
}
