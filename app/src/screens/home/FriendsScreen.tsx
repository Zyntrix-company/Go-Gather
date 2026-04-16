import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  SafeAreaView,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import BlobBackground from '../../components/common/BlobBackground';

// ─── Types ────────────────────────────────────────────────────────────────────

type Friend = {
  id: string;
  name: string;
  handle: string;
  trips: number;
  events: number;
  avatar: string | null;
};

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_FRIENDS: Friend[] = [
  { id: '1', name: 'Yuki Tanaka', handle: '@yuki_tanaka', trips: 2, events: 3, avatar: null },
  { id: '2', name: 'Amara Okafor', handle: '@amara2025', trips: 2, events: 2, avatar: null },
  { id: '3', name: 'Marcus Johnson', handle: '@marcusj_nyc', trips: 2, events: 3, avatar: null },
  { id: '4', name: 'Sofia Rodriguez', handle: '@sofia_rio', trips: 1, events: 2, avatar: null },
  { id: '5', name: 'Ahmed Al-Rashid', handle: '@ahmed_explorer', trips: 2, events: 2, avatar: null },
  { id: '6', name: 'Emma Zhang', handle: '@emma_zhang_au', trips: 2, events: 2, avatar: null },
];

// Avatar color palette
const AVATAR_COLORS = [
  { bg: '#ddd6fe', text: '#7c3aed' }, // Purple
  { bg: '#fde68a', text: '#92400e' }, // Yellow
  { bg: '#99f6e4', text: '#0f766e' }, // Teal
  { bg: '#fecaca', text: '#b91c1c' }, // Red
  { bg: '#e9d5ff', text: '#7e22ce' }, // Violet
  { bg: '#bfdbfe', text: '#1d4ed8' }, // Blue
];

// ─── Icons ────────────────────────────────────────────────────────────────────

const TrashIcon = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
      stroke="#ef4444"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// ─── Friend Row Component ─────────────────────────────────────────────────────

function FriendRow({ friend, index, onView, onDelete }: {
  friend: Friend;
  index: number;
  onView: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const firstLetter = friend.name[0]?.toUpperCase() || '?';
  const colorPair = AVATAR_COLORS[index % 6];

  return (
    <>
      <View style={styles.friendRow}>
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: colorPair.bg }]}>
          {friend.avatar ? (
            <Image source={{ uri: friend.avatar }} style={styles.avatarImage} />
          ) : (
            <Text style={[styles.avatarText, { color: colorPair.text }]}>{firstLetter}</Text>
          )}
        </View>

        {/* Info */}
        <View style={styles.friendInfo}>
          <Text style={styles.friendName}>{friend.name}</Text>
          <Text style={styles.friendHandle}>{friend.handle}</Text>
          <Text style={styles.friendStats}>
            {friend.trips} trip{friend.trips !== 1 ? 's' : ''} · {friend.events} event{friend.events !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.friendActions}>
          <TouchableOpacity
            style={styles.viewBtn}
            onPress={() => onView(friend.id)}
            activeOpacity={0.8}
          >
            <Text style={styles.viewBtnText}>View</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => onDelete(friend.id)}
            activeOpacity={0.8}
          >
            <TrashIcon />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.separator} />
    </>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FriendsScreen() {
  // TODO: replace with API call to fetch friends
  const [friends, setFriends] = useState<Friend[]>(MOCK_FRIENDS);

  function handleViewFriend(id: string) {
    // TODO: navigate to friend gallery or profile
    console.log('view friend', id);
  }

  function handleDeleteFriend(id: string) {
    // TODO: replace with API call to delete friend
    setFriends(prev => prev.filter(f => f.id !== id));
    console.log('delete friend', id);
  }

  function handleInviteFriends() {
    // TODO: navigate to invite friends screen or open modal
    console.log('invite friends');
  }

  const isEmpty = friends.length === 0;

  return (
    <BlobBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Your Friends</Text>
            <Text style={styles.headerSubtitle}>Connect and enjoy together</Text>
          </View>

          {/* Invite Button */}
          <TouchableOpacity
            style={styles.inviteBtn}
            onPress={handleInviteFriends}
            activeOpacity={0.85}
          >
            <Text style={styles.inviteBtnText}>Invite Friends</Text>
          </TouchableOpacity>

          {isEmpty ? (
            <>
              {/* Empty State */}
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M12 7a4 4 0 100-8 4 4 0 000 8zM20 9v6M23 12h-6"
                      stroke="#94a3b8"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </View>
                <Text style={styles.emptyTitle}>No friends yet</Text>
                <Text style={styles.emptyText}>Invite your friends to join GatherGo</Text>

                {/* Empty state invite button */}
                <TouchableOpacity
                  style={[styles.inviteBtn, { marginTop: 20 }]}
                  onPress={handleInviteFriends}
                  activeOpacity={0.85}
                >
                  <Text style={styles.inviteBtnText}>Invite Friends</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              {/* Connected Friends Label */}
              <Text style={styles.sectionLabel}>Connected Friends</Text>

              {/* Friends List */}
              <View style={styles.friendsList}>
                {friends.map((friend, idx) => (
                  <FriendRow
                    key={friend.id}
                    friend={friend}
                    index={idx}
                    onView={handleViewFriend}
                    onDelete={handleDeleteFriend}
                  />
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </BlobBackground>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: '5%',
    paddingVertical: 16,
    paddingBottom: 40,
  },

  // Header
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 21,
    fontWeight: '500',
    color: '#45556C',
    textAlign: 'center',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
  },

  // Invite Button
  inviteBtn: {
    backgroundColor: '#0d9488',
  borderRadius: 999,
    paddingVertical: 9, paddingHorizontal: 22,
    alignSelf: 'center', marginBottom: 30, gap: 5,
  },
  inviteBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Section Label
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#45556C',
    marginBottom: 12,
    textTransform: 'uppercase',
   
  },

  // Friends List
  friendsList: {
    marginBottom: 20,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  friendHandle: {
    fontSize: 11,
    color: '#0d9488',
    marginBottom: 2,
  },
  friendStats: {
    fontSize: 10,
    color: '#94a3b8',
  },
  friendActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewBtn: {
    backgroundColor: '#f0fdfa',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewBtnText: {
    color: '#0d9488',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#fff2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 20,
  },
});
