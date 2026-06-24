import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet, Text } from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import useNotificationStore from '../../store/notificationStore';
import { typeStyle } from '../../theme';

type AppHeaderProps = {
  title?: string;
  subtitle?: string;
  onLogoPress?: () => void;
  onBellPress?: () => void;
  onMenuPress?: () => void;
};

/** Keeps centered titles from overlapping logo / bell+menu. */
const TITLE_SIDE_INSET = 108;

function BellIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"
        stroke="#0d9488"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function HamburgerIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Line x1="3" y1="6" x2="21" y2="6" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" />
      <Line x1="3" y1="12" x2="21" y2="12" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" />
      <Line x1="3" y1="18" x2="21" y2="18" stroke="#0d9488" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export default function AppHeader({
  title,
  subtitle,
  onLogoPress,
  onBellPress,
  onMenuPress,
}: AppHeaderProps) {
  const notificationCount = useNotificationStore((s) => s.unreadCount);

  return (
    <View style={s.header}>
      <TouchableOpacity style={s.iconBtn} onPress={onLogoPress} activeOpacity={0.8} disabled={!onLogoPress}>
        <Image
          source={require('../../../assets/icon_only.png')}
          style={s.logo}
          resizeMode="contain"
        />
      </TouchableOpacity>

      <View style={s.rightSection}>
        <TouchableOpacity style={s.iconBtn} onPress={onBellPress} activeOpacity={0.7}>
          <BellIcon />
          {notificationCount > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>
                {notificationCount > 9 ? '9+' : notificationCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={s.iconBtn} onPress={onMenuPress} activeOpacity={0.8}>
          <HamburgerIcon />
        </TouchableOpacity>
      </View>

      {title ? (
        <View style={s.titleOverlay} pointerEvents="none">
          <Text style={[s.title, subtitle ? s.titleWithSubtitle : null]} numberOfLines={1}>{title}</Text>
          {subtitle ? (
            <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  logo: {
    width: 28,
    height: 28,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleOverlay: {
    position: 'absolute',
    left: TITLE_SIDE_INSET,
    right: TITLE_SIDE_INSET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typeStyle('navTitle'),
    color: '#0f172a',
    textAlign: 'center',
  },
  titleWithSubtitle: {
    ...typeStyle('titleMd'),
  },
  subtitle: {
    ...typeStyle('caption'),
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 1,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
    paddingHorizontal: 2,
  },
  badgeText: {
    ...typeStyle('micro'),
    color: '#fff',
  },
});
