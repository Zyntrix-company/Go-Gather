import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import BlobBackground from '../../components/common/BlobBackground';
import { getFriends, createFriendInvite } from '../../api/trips.api';
import { showAlert } from '../../store/alertStore';

// ─── Types ────────────────────────────────────────────────────────────────────

type Friend = {
  connectionId: string;
  user: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
    country?: string | null;
    bio?: string | null;
    tag?: string | null;
  };
  mutualTripCount: number;
  mutualEventCount: number;
  connectedAt: string;
};

// ─── Mock Data ────────────────────────────────────────────────────────────────


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
  onView: (friend: Friend) => void;
  onDelete: (id: string) => void;
}) {
  const fallbackAvatar = `https://i.pravatar.cc/150?u=${encodeURIComponent(friend.user.id)}`;
  const [imageUri, setImageUri] = useState<string>(friend.user.avatarUrl || fallbackAvatar);
  const firstLetter = friend.user.name?.[0]?.toUpperCase() || '?';
  const subtitle = friend.user.tag ? `@${friend.user.tag}` : '';
  const avatarSource = { uri: imageUri };
  const colorPair = AVATAR_COLORS[index % 6];

  const handleImageError = () => {
    if (imageUri !== fallbackAvatar) {
      setImageUri(fallbackAvatar);
    }
  };

  return (
    <>
      <View style={styles.friendRow}>
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: colorPair.bg }]}> 
          {avatarSource ? (
            <Image
              source={avatarSource}
              style={styles.avatarImage}
              resizeMode="cover"
              onError={handleImageError}
            />
          ) : (
            <Text style={[styles.avatarText, { color: colorPair.text }]}>{firstLetter}</Text>
          )}
        </View>

        {/* Info */}
        <View style={styles.friendInfo}>
          <Text style={styles.friendName}>{friend.user.name || 'Unknown'}</Text>
          {subtitle ? <Text style={styles.friendHandle}>{subtitle}</Text> : null}
          <Text style={styles.friendStats}>
            {friend.mutualTripCount} mutual trip{friend.mutualTripCount !== 1 ? 's' : ''} · {friend.mutualEventCount} mutual event{friend.mutualEventCount !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.friendActions}>
          <TouchableOpacity
            style={styles.viewBtn}
            onPress={() => onView(friend)}
            activeOpacity={0.8}
          >
            <Text style={styles.viewBtnText}>View</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => onDelete(friend.user.id)}
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
  const navigation = useNavigation<any>();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteMethod, setInviteMethod] = useState<'email' | 'sms' | 'whatsapp'>('email');
  const [inviteInput, setInviteInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  async function fetchFriends() {
    setIsLoading(true);
    try {
      const result = await getFriends(searchQuery.trim() || undefined);
      setFriends(result.friends);
    } catch (error) {
      console.error('[FriendsScreen] getFriends failed', error);
      setFriends([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchFriends();
  }, [searchQuery]);

  function handleViewFriend(friend: Friend) {
    navigation.navigate('FriendProfile', { userId: friend.user.id, friendName: friend.user.name ?? 'Friend' });
  }

  function handleDeleteFriend(id: string) {
    // TODO: replace with API call to delete friend
    setFriends(prev => prev.filter(f => f.user.id !== id));
    console.log('delete friend', id);
  }

  function handleInviteFriends() {
    setInviteInput('');
    setInviteMethod('email');
    setShowInviteModal(true);
  }

  async function handleSendInvite() {
    if (!inviteInput.trim()) {
      showAlert({ title: 'Error', message: inviteMethod === 'email' ? 'Enter an email address' : 'Enter a phone number' });
      return;
    }
    if (isSending) return;
    setIsSending(true);
    try {
      const res = await createFriendInvite({
        channels: [inviteMethod],
        emails: inviteMethod === 'email' ? [inviteInput.trim()] : [],
      });
      Toast.show({ type: 'success', text1: 'Invite sent!' });
      if (res.branchUrl) {
        showAlert({ title: 'Invite Link', message: `Share this link:\n${res.branchUrl}` });
      }
      setInviteInput('');
      setShowInviteModal(false);
    } catch (err) {
      showAlert({ title: 'Error', message: 'Failed to send invite. Please try again.' });
    } finally {
      setIsSending(false);
    }
  }

  const showingEmptyState = !isLoading && friends.length === 0 && !searchQuery.trim();

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

          {showingEmptyState ? (
            <>
              {/* Empty State */}
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Svg width={80} height={80} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M2 21a8 8 0 0 1 13.292-6"
                      stroke="#94a3b8"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <Circle cx={10} cy={8} r={5} stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    <Path
                      d="M19 16v6"
                      stroke="#94a3b8"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <Path
                      d="M22 19h-6"
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
              {/* Invite Button */}
              <TouchableOpacity
                style={styles.inviteBtn}
                onPress={handleInviteFriends}
                activeOpacity={0.85}
              >
                <Text style={styles.inviteBtnText}>Invite Friends</Text>
              </TouchableOpacity>

              {/* Connected Friends Label */}
              <Text style={styles.sectionLabel}>Connected Friends</Text>

              {/* Search Bar */}
              <View style={styles.searchContainer}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={styles.searchIcon}>
                  <Path
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by name or handle..."
                  placeholderTextColor="#94a3b8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>

              {/* Friends List */}
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#0d9488" />
                  <Text style={styles.loadingText}>Loading friends...</Text>
                </View>
              ) : (
                <View style={styles.friendsList}>
                  {friends.length > 0 ? (
                    friends.map((friend, idx) => (
                      <FriendRow
                        key={friend.connectionId}
                        friend={friend}
                        index={idx}
                        onView={handleViewFriend}
                        onDelete={handleDeleteFriend}
                      />
                    ))
                  ) : (
                    <Text style={styles.noResultsText}>No friends match your search</Text>
                  )}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* ── Invite Friends Modal ── */}
      <Modal visible={showInviteModal} transparent animationType="fade" onRequestClose={() => setShowInviteModal(false)}>
        <View style={modalStyles.overlay}>
          <View style={modalStyles.dialog}>
            {/* Header */}
            <View style={modalStyles.dHeader}>
              <View style={{ flex: 1 }}>
                <Text style={modalStyles.dTitle}>Invite Friends</Text>
                <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Invite people to join GatherGo</Text>
              </View>
              <TouchableOpacity onPress={() => setShowInviteModal(false)} style={modalStyles.closeBtn} activeOpacity={0.7}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path d="M18 6L6 18M6 6l12 12" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 16, paddingVertical: 18 }}>
              <Text style={modalStyles.sectionLabel}>Send via</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                {[
                  {
                    key: 'email',
                    icon: (active: boolean) => (
                      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                        <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke={active ? '#fff' : '#64748b'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        <Path d="M22 6l-10 7L2 6" stroke={active ? '#fff' : '#64748b'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                    ),
                  },
                  {
                    key: 'sms',
                    icon: (active: boolean) => (
                      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                        <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={active ? '#fff' : '#64748b'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                    ),
                  },
                  {
                    key: 'whatsapp',
                    icon: (active: boolean) => (
                      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                        <Path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke={active ? '#fff' : '#64748b'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                    ),
                  },
                ].map(m => (
                  <TouchableOpacity
                    key={m.key}
                    onPress={() => setInviteMethod(m.key as any)}
                    style={[modalStyles.inviteIconBtn, inviteMethod === m.key && modalStyles.inviteIconBtnActive]}
                    activeOpacity={0.7}
                  >
                    {m.icon(inviteMethod === m.key)}
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput
                  style={[modalStyles.fInput, { flex: 1 }]}
                  placeholder={inviteMethod === 'email' ? 'Enter email address' : inviteMethod === 'sms' ? 'Enter phone number' : 'Enter WhatsApp number'}
                  placeholderTextColor="#94a3b8"
                  value={inviteInput}
                  onChangeText={setInviteInput}
                  keyboardType={inviteMethod === 'email' ? 'email-address' : 'phone-pad'}
                  autoCapitalize="none"
                />
                <TouchableOpacity style={modalStyles.sendBtn} onPress={handleSendInvite} activeOpacity={0.85} disabled={isSending}>
                  {isSending
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={modalStyles.sendBtnTxt}>Send</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
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
  headerTitle:{ fontFamily: 'Inter', fontSize: 20, fontWeight: '400', color: '#0F172B',
    textAlign: 'center', lineHeight: 28, letterSpacing: 0, },

  headerSubtitle: {
    fontFamily: 'Inter', fontSize: 14, fontWeight: '400', color: '#45556C', textAlign: 'center', lineHeight: 19, letterSpacing: 0, marginTop: 9,},
  // Invite Button
  inviteBtn: {
    backgroundColor: '#0d9488',
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 22,
    alignSelf: 'center',
    marginBottom: 16,
    gap: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  inviteBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Section Label
  sectionLabel: {
     fontFamily: 'Inter', fontSize: 14, fontWeight: '400', color: '#45556C', lineHeight: 19, letterSpacing: 0, marginTop: 9, marginBottom: 10, },
  
 

  // Search Bar
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffff',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    padding: 0,
  },
  noResultsText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#94a3b8',
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
    overflow: 'hidden',
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
    fontWeight: '500',
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
    backgroundColor: '#eeffff',
    borderRadius: 90,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewBtnText: {
    color: '#0d9488',
    fontSize: 11,
    fontWeight: '500',
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
    fontWeight: '500',
    color: '#334155',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 20,
  },
});

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.52)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  dialog: { backgroundColor: '#fff', borderRadius: 20, width: '100%', overflow: 'hidden' },
  dHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  fInput: { backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#0f172a' },
  inviteIconBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  inviteIconBtnActive: { borderColor: '#0d9488', backgroundColor: '#0d9488' },
  sendBtn: { backgroundColor: '#0d9488', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  sendBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
