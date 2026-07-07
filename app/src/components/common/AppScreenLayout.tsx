import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import BlobBackground from './BlobBackground';
import AppHeader from './AppHeader';
import SubScreenHeader from './SubScreenHeader';
import FloatingTabBar, { TabType, TAB_BAR_BASE_HEIGHT } from './FloatingTabBar';

export { TAB_BAR_BASE_HEIGHT };
export type { TabType };

/** Extra bottom padding for scroll content above the floating tab bar. */
export const TAB_BAR_SCROLL_PADDING = 150;

export function tabBarContentPadding(bottomInset: number, extra = 24): number {
  return TAB_BAR_BASE_HEIGHT + bottomInset + 6 + extra;
}

type AppScreenLayoutProps = {
  navigation: any;
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  activeTab?: TabType | null;
  onLogoPress?: () => void;
  onBellPress?: () => void;
  onMenuPress?: () => void;
  onBack?: () => void;
  safeAreaStyle?: ViewStyle;
  showFooter?: boolean;
  /** Which edges get safe-area padding. Omit for all edges. Screens that manage
   *  their own bottom spacing (e.g. a keyboard-tracking composer) pass
   *  ['top','left','right'] to opt out of the bottom inset. */
  edges?: readonly Edge[];
};

export default function AppScreenLayout({
  navigation,
  children,
  title,
  subtitle,
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

  return (
    <BlobBackground>
      <SafeAreaView style={[styles.container, safeAreaStyle]} edges={edges}>
        <AppHeader
          title={onBack ? undefined : title}
          subtitle={onBack ? undefined : subtitle}
          onLogoPress={onLogoPress ?? (() => navigation.goBack())}
          onBellPress={onBellPress ?? (() => navigation.navigate('Notifications'))}
          onMenuPress={handleMenuPress}
        />
        {onBack ? (
          <SubScreenHeader title={title ?? ''} onBack={onBack} />
        ) : null}
        {children}
        {showFooter ? <FloatingTabBar activeTab={activeTab} navigation={navigation} /> : null}
      </SafeAreaView>
    </BlobBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
