import React from 'react';
import { StyleSheet, ViewStyle, type TextStyle } from 'react-native';
import { type Edge } from 'react-native-safe-area-context';
import BlobBackground from './BlobBackground';
import AppHeader from './AppHeader';
import SubScreenHeader from './SubScreenHeader';
import ChromeSafeAreaView from './ChromeSafeAreaView';
import FloatingTabBar, { TabType, TAB_BAR_BASE_HEIGHT } from './FloatingTabBar';

export { TAB_BAR_BASE_HEIGHT };
export type { TabType };

/** Extra bottom padding for scroll content above the floating tab bar. */
export const TAB_BAR_SCROLL_PADDING = 150;

/** Pass the bottom inset from `useChromeInsets()`. */
export function tabBarContentPadding(bottomInset: number, extra = 24): number {
  return TAB_BAR_BASE_HEIGHT + bottomInset + 6 + extra;
}

type AppScreenLayoutProps = {
  navigation: any;
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  /** Optional override for the sub-screen header title (only used when onBack is set). */
  titleStyle?: TextStyle;
  activeTab?: TabType | null;
  onLogoPress?: () => void;
  onBellPress?: () => void;
  onMenuPress?: () => void;
  onBack?: () => void;
  safeAreaStyle?: ViewStyle;
  showFooter?: boolean;
  /** Which edges get safe-area padding. Only 'bottom' is honoured — top/left/right
   *  are always padded. Omit to pad the bottom only when there is no footer (the
   *  tab bar pads for the home indicator itself). Screens that manage their own
   *  bottom spacing (e.g. a keyboard-tracking composer) pass ['top','left','right']
   *  so the bottom stays unpadded even while the footer is hidden. */
  edges?: readonly Edge[];
};

export default function AppScreenLayout({
  navigation,
  children,
  title,
  subtitle,
  titleStyle,
  activeTab = null,
  onLogoPress,
  onBellPress,
  onMenuPress,
  onBack,
  safeAreaStyle,
  showFooter = true,
  edges,
}: AppScreenLayoutProps) {
  const handleMenuPress = onMenuPress ?? (() => navigation.navigate('Menu'));
  const includeBottom = edges ? edges.includes('bottom') : !showFooter;

  return (
    <BlobBackground>
      <ChromeSafeAreaView style={[styles.container, safeAreaStyle]} includeBottom={includeBottom}>
        <AppHeader
          title={onBack ? undefined : title}
          subtitle={onBack ? undefined : subtitle}
          onLogoPress={onLogoPress ?? (() => navigation.goBack())}
          onBellPress={onBellPress ?? (() => navigation.navigate('Notifications'))}
          onMenuPress={handleMenuPress}
        />
        {onBack ? (
          <SubScreenHeader title={title ?? ''} onBack={onBack} titleStyle={titleStyle} />
        ) : null}
        {children}
        {showFooter ? <FloatingTabBar activeTab={activeTab} navigation={navigation} /> : null}
      </ChromeSafeAreaView>
    </BlobBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
