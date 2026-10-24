import React from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// iOS reports generous insets: the status-bar inset includes a margin below the
// notch / Dynamic Island, and the home-indicator inset (34pt) is far taller than
// the indicator itself. Used as-is they leave a visible empty band above the
// AppHeader and below the tab bar, which Android doesn't have. Reserve a little
// less on iOS — still clear of the notch, island and home indicator.
const IOS_TOP_TRIM = 10;
// The home indicator is drawn inside the window, in the bottom ~13pt (8pt up, 5pt tall);
// Android's nav bar sits outside it. The tab bar already leaves ~12pt under its labels
// (TAB_BAR_BASE_HEIGHT), so this is only what is needed on top of that to keep the labels
// ~3pt clear of the indicator and well inside the rounded display corners. Devices with
// no home indicator report 0 and get 0.
const IOS_HOME_INDICATOR_RESERVE = 5;

/**
 * Safe-area insets for the app chrome (AppHeader + tab bar). Use these instead of
 * raw `useSafeAreaInsets()` for anything sized against the header or tab bar so
 * every screen agrees on where the chrome sits.
 */
export function useChromeInsets() {
  const insets = useSafeAreaInsets();
  if (Platform.OS !== 'ios') return insets;
  return {
    ...insets,
    top: insets.top > 20 ? insets.top - IOS_TOP_TRIM : insets.top,
    bottom: Math.min(insets.bottom, IOS_HOME_INDICATOR_RESERVE),
  };
}

type ChromeSafeAreaViewProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Pad the bottom inset too. Leave off on screens with the tab bar — the bar
   *  already sits over the home indicator and pads for it, so padding here as
   *  well would reserve that space twice. */
  includeBottom?: boolean;
};

/** Root container for screens that render AppHeader (and usually the tab bar). */
export default function ChromeSafeAreaView({ children, style, includeBottom = false }: ChromeSafeAreaViewProps) {
  const insets = useSafeAreaInsets();
  const chrome = useChromeInsets();
  return (
    <View
      style={[
        {
          flex: 1,
          paddingTop: chrome.top,
          paddingLeft: insets.left,
          paddingRight: insets.right,
          paddingBottom: includeBottom ? insets.bottom : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
