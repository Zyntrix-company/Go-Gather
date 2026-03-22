import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';

type AppHeaderProps = {
  notificationCount?: number;
  onLogoPress?: () => void;
  onBellPress?: () => void;
  onMenuPress?: () => void;
};

function BellIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
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
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 12h18M3 6h18M3 18h18"
        stroke="#0d9488"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function AppHeader({ notificationCount = 0, onLogoPress, onBellPress, onMenuPress }: AppHeaderProps) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onLogoPress} activeOpacity={0.8} disabled={!onLogoPress}>
        <Image
          source={require('../../../assets/icon_only.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </TouchableOpacity>
      <View style={styles.rightSection}>
        <TouchableOpacity style={styles.iconBtn} onPress={onBellPress} activeOpacity={0.7}>
          <BellIcon />
          {notificationCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {notificationCount > 9 ? '9+' : notificationCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={onMenuPress} activeOpacity={0.7}>
          <HamburgerIcon />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  logo: {
    width: 40,
    height: 40,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
});
