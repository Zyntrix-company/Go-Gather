import React from 'react';
import { View, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppScreenLayout, { TAB_BAR_BASE_HEIGHT } from '../common/AppScreenLayout';
import type { TabType } from '../common/FloatingTabBar';
import { AlbumPhotosOverlayContext, AlbumPhotosScrollContext } from './AlbumPhotosContext';
import { useKeyboardVisible } from '../../hooks/useKeyboardVisible';

export { useAlbumPhotosOverlay } from './AlbumPhotosContext';

// The album owns its bottom spacing via `tabBarPad` (which already includes
// insets.bottom), so opt the layout's SafeAreaView out of the bottom inset to
// avoid counting it twice — a double gap that scales with the device's nav-bar
// inset and pushes the content/footer up on large-inset screens.
const ALBUM_SAFE_AREA_EDGES = ['top', 'left', 'right'] as const;

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

  // Track keyboard so we can hide the tab bar while typing.
  // On Android (adjustResize) the SafeAreaView shrinks and the absolute-positioned
  // tab bar floats just above the keyboard — hiding it fixes that.
  // On iOS the tab bar naturally goes under the keyboard, but hiding it is harmless.
  const keyboardVisible = useKeyboardVisible();

  // Use a plain View (not ScrollView) so that flex layout works correctly inside:
  // a ScrollView gives children unbounded height, which breaks flex: 1 on the
  // nested comment list and causes the whole screen to shift on compose open.
  //
  // On iOS: KeyboardAvoidingView with behavior='padding' shrinks the body so the
  // compose input inside the comment ScrollView stays above the keyboard.
  // On Android: the window already resizes (adjustResize) — adding KAV on top
  // causes a double-shrink that crushes the engagement section to nothing.
  const body = scrollable ? (
    Platform.OS === 'ios' ? (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={insets.top + 56}
      >
        <View style={{ flex: 1 }}>
          {children}
        </View>
      </KeyboardAvoidingView>
    ) : (
      <View style={{ flex: 1 }}>{children}</View>
    )
  ) : (
    <View style={{ flex: 1, overflow: 'hidden' }}>{children}</View>
  );

  return (
    <AppScreenLayout
      navigation={navigation}
      activeTab={activeTab}
      onLogoPress={onClose}
      showFooter={!keyboardVisible}
      edges={ALBUM_SAFE_AREA_EDGES}
    >
      <AlbumPhotosOverlayContext.Provider value={heroOverlay ?? null}>
        <AlbumPhotosScrollContext.Provider value={null}>
          {/*
           * While the keyboard is up we reclaim the tab-bar padding so the
           * engagement section (flex:1 at the bottom) has maximum height to
           * show comments and the compose input above the keyboard.
           */}
          <View style={{ flex: 1, paddingBottom: keyboardVisible ? 0 : tabBarPad }}>
            {subHeader}
            {body}
            {footer}
          </View>
        </AlbumPhotosScrollContext.Provider>
      </AlbumPhotosOverlayContext.Provider>
    </AppScreenLayout>
  );
}
