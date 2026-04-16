import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// Mock data
export const MOCK_FRIENDS = [
  { id: '1', name: 'Alex Johnson', handle: '@alexj', initials: 'AJ', color: '#6366f1', mutualTrips: 2 },
  { id: '2', name: 'Sam Patel', handle: '@sampatel', initials: 'SP', color: '#f59e0b', mutualTrips: 1 },
  { id: '3', name: 'Priya Singh', handle: '@priyas', initials: 'PS', color: '#10b981', mutualTrips: 3 },
  { id: '4', name: 'Jordan Lee', handle: '@jordanl', initials: 'JL', color: '#ec4899', mutualTrips: 1 },
  { id: '5', name: 'Marcus Wei', handle: '@marcusw', initials: 'MW', color: '#8b5cf6', mutualTrips: 0 },
];

const PlusIcon = ({ color = '#fff', size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

function FriendsTab() {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      <View style={styles.tabHeaderRow}>
        <Text style={styles.tabScreenTitle}>Friends</Text>
        <TouchableOpacity style={styles.fabInline} onPress={() => Alert.alert('Add Friend', 'Search by username or invite via email')} activeOpacity={0.85}>
          <PlusIcon size={16} />
          <Text style={styles.fabInlineText}>Add Friend</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.friendsSearchWrap}>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <Text style={styles.friendsSearchPlaceholder}>Search friends...</Text>
      </View>
      <Text style={styles.friendsCount}>{MOCK_FRIENDS.length} friends</Text>
      {MOCK_FRIENDS.map(friend => (
        <TouchableOpacity key={friend.id} style={styles.friendCard} activeOpacity={0.8} onPress={() => Alert.alert(friend.name, `Handle: ${friend.handle}\nMutual trips: ${friend.mutualTrips}`)}>
          <View style={[styles.friendAvatar, { backgroundColor: friend.color + '20' }]}>
            <Text style={[styles.friendInitials, { color: friend.color }]}>{friend.initials}</Text>
          </View>
          <View style={styles.friendInfo}>
            <Text style={styles.friendName}>{friend.name}</Text>
            <Text style={styles.friendHandle}>{friend.handle}</Text>
          </View>
          {friend.mutualTrips > 0 && (
            <View style={styles.mutualBadge}>
              <Text style={styles.mutualBadgeText}>{friend.mutualTrips} trip{friend.mutualTrips > 1 ? 's' : ''}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 4 },
  tabHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 4 },
  tabScreenTitle: { fontSize: 24, fontWeight: '500', color: '#45556C' },
  fabInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0d9488',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  fabInlineText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  friendsSearchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12, gap: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  friendsSearchPlaceholder: { fontSize: 14, color: '#94a3b8' },
  friendsCount: { fontSize: 13, color: '#94a3b8', fontWeight: '500', marginBottom: 12 },
  friendCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 10, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  friendAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  friendInitials: { fontSize: 18, fontWeight: '700' },
  friendInfo: { flex: 1 },
  friendName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  friendHandle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  mutualBadge: { backgroundColor: '#f0fdfa', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  mutualBadgeText: { fontSize: 11, color: '#0d9488', fontWeight: '600' },
});

export default FriendsTab;
