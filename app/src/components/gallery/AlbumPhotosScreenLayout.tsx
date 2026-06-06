import React from 'react';
import { View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppScreenLayout, { TAB_BAR_BASE_HEIGHT } from '../common/AppScreenLayout';
import type { TabType } from '../common/FloatingTabBar';
import { albumChromeStyles as acs } from '../../constants/albumPhotosLayout';

type AlbumPhotosScreenLayoutProps = {
  navigation: any;
  activeTab: TabType;
  onClose: () => void;
  photoIndex?: number;
  photoTotal?: number;
  headerRight?: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
};

/** Full-screen album view with app-wide AppHeader + FloatingTabBar. */
export default function AlbumPhotosScreenLayout({
  navigation,
  activeTab,
  onClose,
  photoIndex = 0,
  photoTotal = 0,
  headerRight,
  footer,
  children,
}: AlbumPhotosScreenLayoutProps) {
  const insets = useSafeAreaInsets();
  const tabBarPad = TAB_BAR_BASE_HEIGHT + insets.bottom + 6;

  return (
    <AppScreenLayout navigation={navigation} activeTab={activeTab} onLogoPress={onClose}>
      <View style={{ flex: 1, paddingBottom: tabBarPad }}>
        <View style={acs.albumSubHeader}>
          <View style={acs.albumSubHeaderSide} />
          <View style={acs.headerCenter}>
            <Text style={acs.headerTitle}>Photos</Text>
            {photoTotal > 0 && (
              <Text style={acs.headerSub}>{photoIndex + 1} of {photoTotal}</Text>
            )}
          </View>
          <View style={acs.albumSubHeaderSide}>{headerRight}</View>
        </View>
        <View style={{ flex: 1, overflow: 'hidden' }}>{children}</View>
        {footer}
      </View>
    </AppScreenLayout>
  );
}
