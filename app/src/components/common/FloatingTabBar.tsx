import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TabType = 'trips' | 'events' | 'friends' | 'chat' | 'gallery';

interface FloatingTabBarProps {
  activeTab: TabType;
  navigation: any;
}

// ─── Navigation Icon Component (copied from HomeScreen) ────────────────────────
function NavIcon({ name, active, onPress }: { name: TabType; active: boolean; onPress: () => void }) {
  const color = active ? '#0d9488' : '#94a3b8';
  const labels: Record<TabType, string> = { trips: 'Trips', events: 'Events', friends: 'Friends', chat: 'Chat', gallery: 'Gallery' };

  return (
    <TouchableOpacity style={styles.navItem} onPress={onPress}>
      {name === 'trips' && (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path
            d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"
            stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
          />
        </Svg>
      )}
      {name === 'events' && (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Rect x={3} y={4} width={18} height={18} rx={2} ry={2} stroke={color} strokeWidth={2} />
          <Path d="M16 2v4M8 2v4M3 10h18" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
      {name === 'friends' && (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
      {name === 'chat' && (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
      {name === 'gallery' && (
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Rect x={3} y={3} width={18} height={18} rx={2} ry={2} stroke={color} strokeWidth={2} />
          <Circle cx={8.5} cy={8.5} r={1.5} fill={color} />
          <Path d="M21 15l-5-5L5 21" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )}
      <Text style={[styles.navText, active && styles.navTextActive]}>{labels[name]}</Text>
    </TouchableOpacity>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FloatingTabBar({ activeTab, navigation }: FloatingTabBarProps) {
  const insets = useSafeAreaInsets();
  const tabs: TabType[] = ['trips', 'events', 'friends', 'chat', 'gallery'];

  const handleTabPress = (tabName: TabType) => {
    if (tabName === activeTab) {
      navigation.goBack();
    } else {
      navigation.navigate('Home', { initialTab: tabName });
    }
  };

  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom + 6, height: 58 + insets.bottom }]}>
      {tabs.map(tab => (
        <NavIcon
          key={tab}
          name={tab}
          active={activeTab === tab}
          onPress={() => handleTabPress(tab)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#f0fdfa',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 10,
  },
  navItem: { alignItems: 'center', justifyContent: 'center', flex: 1, paddingTop: 4 },
  navText: { fontSize: 9, color: '#94a3b8', marginTop: 2, fontWeight: '500' },
  navTextActive: { color: '#0d9488', fontWeight: '600' },
});
