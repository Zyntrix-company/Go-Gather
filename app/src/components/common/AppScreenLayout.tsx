import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BlobBackground from './BlobBackground';
import AppHeader from './AppHeader';
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
  activeTab?: TabType | null;
  onLogoPress?: () => void;
  onBellPress?: () => void;
  onMenuPress?: () => void;
  safeAreaStyle?: ViewStyle;
  showFooter?: boolean;
};

export default function AppScreenLayout({
  navigation,
  children,
  activeTab = null,
  onLogoPress,
  onBellPress,
  onMenuPress,
  safeAreaStyle,
  showFooter = true,
}: AppScreenLayoutProps) {
  return (
    <BlobBackground>
      <SafeAreaView style={[styles.container, safeAreaStyle]}>
        <AppHeader
          onLogoPress={onLogoPress ?? (() => navigation.goBack())}
          onBellPress={onBellPress ?? (() => navigation.navigate('Notifications'))}
          onMenuPress={onMenuPress ?? (() => navigation.navigate('Settings'))}
        />
        {children}
        {showFooter ? <FloatingTabBar activeTab={activeTab} navigation={navigation} /> : null}
      </SafeAreaView>
    </BlobBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
