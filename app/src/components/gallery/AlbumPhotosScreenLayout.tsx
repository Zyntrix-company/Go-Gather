import React, { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { androidStatusBarPad, useChromeInsets } from '../common/ChromeSafeAreaView';
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
  const insets = useChromeInsets();
  const rawInsets = useSafeAreaInsets();
  const statusPad = androidStatusBarPad(rawInsets.top);
  const tabBarPad = TAB_BAR_BASE_HEIGHT + insets.bottom + 6;

  // Track keyboard so we can hide the tab bar while typing.
  // On Android (adjustResize) the SafeAreaView shrinks and the absolute-positioned
  // tab bar floats just above the keyboard — hiding it fixes that.
  // On iOS the tab bar naturally goes under the keyboard, but hiding it is harmless.
  const keyboardVisible = useKeyboardVisible();
  const scrollRef = useRef<ScrollView>(null);
  const [scrollViewportH, setScrollViewportH] = useState(0);

  // Gallery albums scroll as one page so members, likes, and comments stay
  // reachable under a tall portrait photo. Comments are in that same scroll.
  // The content is at least as tall as the viewport, and taller when the
  // column needs it. Avoid flexGrow here: on iOS it locks the scroll height
  // to the screen and clips the likes row. directionalLockEnabled is what
  // lets a vertical drag on the photo scroll the page on both platforms;
  // nestedScrollEnabled is the Android half of that same gesture.
  const body = scrollable ? (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={scrollViewportH > 0 ? { minHeight: scrollViewportH } : undefined}
      onLayout={(e) => {
        const h = Math.round(e.nativeEvent.layout.height);
        if (h > 0 && h !== scrollViewportH) setScrollViewportH(h);
      }}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      directionalLockEnabled
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}
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
      showFooter={!keyboardVisible}
      edges={ALBUM_SAFE_AREA_EDGES}
      additionalTopInset={statusPad}
    >
      <AlbumPhotosOverlayContext.Provider value={heroOverlay ?? null}>
        <AlbumPhotosScrollContext.Provider value={scrollable ? scrollRef : null}>
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
