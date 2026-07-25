import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppScreenLayout, { TAB_BAR_BASE_HEIGHT } from '../common/AppScreenLayout';
import { KeyboardAvoider } from '../common/KeyboardAvoider';
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
  // Keyboard avoidance is handled once, below, for both platforms — the window
  // no longer resizes itself on Android (see KeyboardProvider in App.tsx), so
  // there is no double-shrink to guard against.
  const body = scrollable ? (
    <View style={{ flex: 1 }}>{children}</View>
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
           * Bottom space is max(tabBarPad, keyboardHeight): the tab-bar padding
           * is reclaimed as the keyboard rises rather than dropped in one step,
           * so the engagement section (flex:1 at the bottom) keeps maximum
           * height for comments and the compose input without a layout jump.
           */}
          <KeyboardAvoider existingBottomSpace={tabBarPad}>
            <View style={{ flex: 1, paddingBottom: tabBarPad }}>
              {subHeader}
              {body}
              {footer}
            </View>
          </KeyboardAvoider>
        </AlbumPhotosScrollContext.Provider>
      </AlbumPhotosOverlayContext.Provider>
    </AppScreenLayout>
  );
}
