import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { MoreVertical, Eye, Trash2 } from 'lucide-react-native';
import CachedImage from '../../components/common/CachedImage';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import Toast from 'react-native-toast-message';
import { SkeletonBox } from '../../components/common/ExpenseTabSkeleton';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getFriends, createTrip, uploadTripPhotos, updateTrip as apiUpdateTrip, removeFriend } from '../../api/trips.api';
import InviteViaChannels from '../../components/common/InviteViaChannels';
import { showAlert, showConfirm } from '../../store/alertStore';
import { CreateTripModal, BannerCropFraction } from '../trips/TripsScreen';
import { CreateEventModal } from '../events/EventsScreen';
import { requireTripFromResponse, runSafePostCreate } from '../../utils/createEntityFlow';
import { toLocationPayload, type LocationPoint } from '../../utils/locations';

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

// Avatar color palette
const AVATAR_COLORS = [
  { bg: '#ddd6fe', text: '#7c3aed' },
  { bg: '#fde68a', text: '#92400e' },
  { bg: '#99f6e4', text: '#0f766e' },
  { bg: '#fecaca', text: '#b91c1c' },
  { bg: '#e9d5ff', text: '#7e22ce' },
  { bg: '#bfdbfe', text: '#1d4ed8' },
];

// ─── Friend Row Component ─────────────────────────────────────────────────────

function FriendRow({
  friend,
  index,
  onView,
  onRemove,
  isSelecting,
  isSelected,
  onSelect,
  onLongPress,
}: {
  friend: Friend;
  index: number;
  onView: (friend: Friend) => void;
  onRemove: (friend: Friend) => void;
  isSelecting: boolean;
  isSelected: boolean;
  onSelect: (friend: Friend) => void;
  onLongPress: (friend: Friend) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  const menuBtnRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);

  const openMenu = () => {
    menuBtnRef.current?.measureInWindow((x, y, width, height) => {
      const screenWidth = Dimensions.get('window').width;
      setAnchor({ top: y + height + 4, right: screenWidth - (x + width) });
      setMenuOpen(true);
    });
  };

  const fallbackAvatar = `https://i.pravatar.cc/150?u=${encodeURIComponent(friend.user.id)}`;
  const primaryUri = friend.user.avatarUrl || fallbackAvatar;
  const [imgFailed, setImgFailed] = useState(false);
  const displayUri = imgFailed ? fallbackAvatar : primaryUri;
  const firstLetter = friend.user.name?.[0]?.toUpperCase() || '?';
  const subtitle = friend.user.tag ? `@${friend.user.tag}` : '';

  const colorPair = AVATAR_COLORS[index % 6];

  useEffect(() => {
    setImgFailed(false);
  }, [friend.user.avatarUrl, friend.user.id]);

  const handleImageError = () => {
    if (!imgFailed && friend.user.avatarUrl) {
      setImgFailed(true);
    }
  };

  function handlePress() {
    if (isSelecting) {
      onSelect(friend);
    } else {
      onView(friend);
    }
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.friendRow, isSelected && styles.friendRowSelected]}
        onPress={handlePress}
        onLongPress={() => onLongPress(friend)}
        activeOpacity={0.7}
        delayLongPress={300}
      >
        {/* Checkbox — visible in selection mode */}
        {isSelecting && (
          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
            {isSelected && (
              <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M20 6L9 17l-5-5"
                  stroke="#fff"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            )}
          </View>
        )}

        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: colorPair.bg }]}>
          {displayUri ? (
            <CachedImage
              uri={displayUri}
              style={styles.avatarImage}
              resizeMode="cover"
              priority="normal"
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

        {/* Actions — hidden during selection mode */}
        {!isSelecting && (
          <View style={styles.friendActions}>
            <TouchableOpacity
              ref={menuBtnRef}
              style={styles.menuBtn}
              onPress={openMenu}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={`Options for ${friend.user.name || 'friend'}`}
            >
              <MoreVertical size={16} color="#64748b" strokeWidth={1.8} />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>

      {/* Overflow menu — anchored under the dots button (matches ExpenseCard) */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
          <View
            style={[
              styles.menuSheet,
              anchor ? { top: anchor.top, right: anchor.right } : { bottom: '40%', right: 16 },
            ]}
          >
            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.8}
              onPress={() => { setMenuOpen(false); onView(friend); }}
            >
              <Eye size={14} color="#64748b" strokeWidth={2} />
              <Text style={styles.menuText}>View</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemBorder]}
              activeOpacity={0.8}
              onPress={() => { setMenuOpen(false); onRemove(friend); }}
            >
              <Trash2 size={14} color="#ef4444" strokeWidth={2} />
              <Text style={[styles.menuText, styles.menuTextDanger]}>Remove friend</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <View style={styles.separator} />
    </>
  );
}

function FriendRowSkeleton() {
  return (
    <View style={styles.skeletonRow}>
      <SkeletonBox width={40} height={40} style={{ borderRadius: 20 }} />
      <View style={{ flex: 1, gap: 6 }}>
        <SkeletonBox height={14} width="45%" />
        <SkeletonBox height={11} width="65%" />
      </View>
      <SkeletonBox width={24} height={24} style={{ borderRadius: 12 }} />
    </View>
  );
}

function FriendListSkeleton() {
  return (
    <View style={styles.friendsList}>
      {[1, 2, 3, 4, 5].map((i) => (
        <FriendRowSkeleton key={i} />
      ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FriendsScreen() {
  const navigation = useNavigation<any>();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const isSelecting = selectedIds.size > 0;
  const selectedFriends = friends.filter(f => selectedIds.has(f.user.id));

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Create Trip modal (reuses TripsScreen modal)
  const [showTripModal, setShowTripModal] = useState(false);
  const [bannerImageUri, setBannerImageUri] = useState<string | undefined>(undefined);
  const [bannerImageType, setBannerImageType] = useState<string>('image/jpeg');
  const [bannerCropFraction, setBannerCropFraction] = useState<BannerCropFraction | null>(null);

  // Create Event modal
  const [showEventModal, setShowEventModal] = useState(false);

  const fetchFriends = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getFriends(searchQuery.trim() || undefined);
      setFriends(
        result.friends.map(f => ({
          ...f,
          mutualEventCount: (f as Friend).mutualEventCount ?? 0,
        })),
      );
    } catch (error) {
      console.error('[FriendsScreen] getFriends failed', error);
      setFriends([]);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useFocusEffect(
    useCallback(() => {
      fetchFriends();
    }, [fetchFriends]),
  );

  function handleViewFriend(friend: Friend) {
    navigation.navigate('FriendProfile', { userId: friend.user.id, friendName: friend.user.name ?? 'Friend', avatarUrl: friend.user.avatarUrl ?? null });
  }

  function handleRemoveFriend(friend: Friend) {
    const name = friend.user.name || 'This friend';
    showConfirm({
      title: 'Remove friend?',
      message: `${name} will be removed from your friends list.`,
      confirmText: 'Remove',
      destructive: true,
      onConfirm: async () => {
        try {
          await removeFriend(friend.user.id);
          setFriends(prev => prev.filter(f => f.user.id !== friend.user.id));
          Toast.show({ type: 'success', text1: 'Friend removed' });
        } catch (error) {
          console.error('[FriendsScreen] removeFriend failed', error);
          Toast.show({ type: 'error', text1: 'Could not remove friend', text2: 'Please try again.' });
        }
      },
    });
  }

  function handleLongPress(friend: Friend) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.add(friend.user.id);
      return next;
    });
  }

  function handleToggleSelect(friend: Friend) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(friend.user.id)) {
        next.delete(friend.user.id);
      } else {
        next.add(friend.user.id);
      }
      return next;
    });
  }

  function handleClearSelection() {
    setSelectedIds(new Set());
  }

  function handleOpenCreateTrip() {
    setShowTripModal(true);
  }

  function handleOpenCreateEvent() {
    setShowEventModal(true);
  }

  function handleInviteFriends() {
    setShowInviteModal(true);
  }

  const showingEmptyState = !isLoading && friends.length === 0 && !searchQuery.trim();

  return (
    <>
      <View style={styles.safe}>

        {/* ── Selection Action Bar ── */}
        {isSelecting && (
          <View style={styles.selectionBar}>
            <TouchableOpacity onPress={handleClearSelection} style={styles.selectionCancelBtn} activeOpacity={0.7}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M18 6L6 18M6 6l12 12" stroke="#64748b" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.selectionCancelText}>{selectedIds.size} selected</Text>
            </TouchableOpacity>

            <View style={styles.selectionActions}>
              <TouchableOpacity style={styles.selectionActionBtn} onPress={handleOpenCreateTrip} activeOpacity={0.8}>
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                  <Path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" fill="#fff" />
                </Svg>
                <Text style={styles.selectionActionText}>Trip</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.selectionActionBtn, styles.selectionActionBtnEvent]} onPress={handleOpenCreateEvent} activeOpacity={0.8}>
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                  <Rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M16 2v4M8 2v4M3 10h18" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M12 16v-4M10 14h4" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={[styles.selectionActionText, styles.selectionActionTextEvent]}>Event</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Header — hidden when selecting */}
          {!isSelecting && (
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Your Friends</Text>
              <Text style={styles.headerSubtitle}>Connect and enjoy together</Text>
            </View>
          )}

          {showingEmptyState ? (
            <>
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
                    <Path d="M19 16v6" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M22 19h-6" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
                <Text style={styles.emptyTitle}>No friends yet</Text>
                <Text style={styles.emptyText}>Invite your friends to join GatherrGo</Text>
                <TouchableOpacity style={[styles.inviteBtn, { marginTop: 20 }]} onPress={handleInviteFriends} activeOpacity={0.85}>
                  <Text style={styles.inviteBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>Invite Friends</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              {!isSelecting && (
                <TouchableOpacity style={styles.inviteBtn} onPress={handleInviteFriends} activeOpacity={0.85}>
                  <Text style={styles.inviteBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>Invite Friends</Text>
                </TouchableOpacity>
              )}

              <Text style={styles.sectionLabel}>
                {isSelecting ? 'Tap friends to select / deselect' : 'Connected Friends'}
              </Text>

              {!isSelecting && (
                <View style={styles.searchBar}>
                  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" style={styles.searchIcon}>
                    <Path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name or handle..."
                    placeholderTextColor="#64748b"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>
              )}

              {isLoading ? (
                <FriendListSkeleton />
              ) : (
                <View style={styles.friendsList}>
                  {friends.length > 0 ? (
                    friends.map((friend, idx) => (
                      <FriendRow
                        key={friend.connectionId}
                        friend={friend}
                        index={idx}
                        onView={handleViewFriend}
                        onRemove={handleRemoveFriend}
                        isSelecting={isSelecting}
                        isSelected={selectedIds.has(friend.user.id)}
                        onSelect={handleToggleSelect}
                        onLongPress={handleLongPress}
                      />
                    ))
                  ) : (
                    <Text style={styles.noResultsText}>No friends match your search</Text>
                  )}
                </View>
              )}

              {isSelecting && (
                <Text style={styles.selectHint}>Long press any friend to start selecting</Text>
              )}
            </>
          )}
        </ScrollView>
      </View>

      {/* ── Invite Friends Modal ── */}
      <Modal visible={showInviteModal} transparent animationType="fade" onRequestClose={() => setShowInviteModal(false)}>
        <View style={modalStyles.overlay}>
          <View style={modalStyles.dialog}>
            <View style={modalStyles.dHeader}>
              <View style={{ flex: 1 }}>
                <Text style={modalStyles.dTitle}>Invite Friends</Text>
                <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Invite people to join GatherrGo</Text>
              </View>
              <TouchableOpacity onPress={() => setShowInviteModal(false)} style={modalStyles.closeBtn} activeOpacity={0.7}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path d="M18 6L6 18M6 6l12 12" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: 16, paddingVertical: 18 }}>
              <InviteViaChannels variant="friend" onComplete={() => setShowInviteModal(false)} />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Create Trip Modal (reuses TripsScreen modal) ── */}
      <CreateTripModal
        visible={showTripModal}
        onClose={() => setShowTripModal(false)}
        initialFriendIds={Array.from(selectedIds)}
        bannerImageUri={bannerImageUri}
        setBannerImageUri={setBannerImageUri}
        bannerImageType={bannerImageType}
        setBannerImageType={setBannerImageType}
        bannerCropFraction={bannerCropFraction}
        setBannerCropFraction={setBannerCropFraction}
        onSave={async (data) => {
          const cropFraction = data.bannerCropFraction as BannerCropFraction | null;
          const tripLocations = (data.locations as LocationPoint[] | undefined) ?? [];
          const res = await createTrip({
            name: data.name as string,
            startDate: (data.startDateISO ?? data.startDate ?? '') as string,
            endDate: (data.endDateISO ?? data.endDate ?? '') as string,
            locations: toLocationPayload(tripLocations.length > 0 ? tripLocations : [{ name: 'TBD' }]),
            friendIds: (data.friendIds as string[] | undefined)?.length ? data.friendIds as string[] : undefined,
            emails: data.inviteEmail ? [data.inviteEmail as string] : undefined,
            reminders: data.reminders as boolean | undefined,
            ...(cropFraction && { bannerCropFraction: cropFraction }),
          });
          const newTrip = requireTripFromResponse(res);
          const localUri = data.bannerImageUrl as string | undefined;
          const isLocalUri = localUri && (localUri.startsWith('file://') || localUri.startsWith('content://') || localUri.startsWith('file:'));
          if (isLocalUri) {
            await runSafePostCreate('Banner upload', async () => {
              const photoRes = await uploadTripPhotos(newTrip.id, [{
                uri: localUri,
                type: (data.bannerImageType as string) ?? 'image/jpeg',
                name: `banner.${((data.bannerImageType as string) ?? 'image/jpeg').split('/')[1] ?? 'jpg'}`,
              }]);
              const photo = photoRes.photos?.[0];
              const permanentUrl = (photo as Record<string, unknown>)?.fileUrl as string ?? photo?.url;
              if (permanentUrl) {
                await apiUpdateTrip(newTrip.id, { bannerImageUrl: permanentUrl, ...(cropFraction && { bannerCropFraction: cropFraction }) });
              }
            });
          }
          Toast.show({ type: 'success', text1: 'Trip created!', text2: `${selectedIds.size} friend${selectedIds.size !== 1 ? 's' : ''} added` });
          setBannerImageUri(undefined);
          setBannerImageType('image/jpeg');
          setBannerCropFraction(null);
          setShowTripModal(false);
          setSelectedIds(new Set());
        }}
      />

      {/* ── Create Event Modal (reuses EventsScreen modal) ── */}
      <CreateEventModal
        visible={showEventModal}
        onClose={() => setShowEventModal(false)}
        initialFriendIds={Array.from(selectedIds)}
        onSave={() => {
          Toast.show({ type: 'success', text1: 'Event created!', text2: `${selectedIds.size} friend${selectedIds.size !== 1 ? 's' : ''} added` });
          setShowEventModal(false);
          setSelectedIds(new Set());
        }}
      />
    </>
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

  // Selection bar
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  selectionCancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectionCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  selectionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  selectionActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0d9488',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  selectionActionBtnEvent: {
    backgroundColor: '#61BFCE',
  },
  selectionActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  selectionActionTextEvent: {
    color: '#fff',
  },
  selectHint: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 10,
  },

  // Header
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontFamily: 'Inter',
    fontSize: 22,
    fontWeight: '600',
    color: '#0F172B',
    textAlign: 'center',
    lineHeight: 30,
    letterSpacing: 0,
  },
  headerSubtitle: {
    fontFamily: 'Inter',
    fontSize: 15,
    fontWeight: '600',
    color: '#45556C',
    textAlign: 'center',
    lineHeight: 21,
    letterSpacing: 0,
    marginTop: 9,
  },

  // Invite Button
  inviteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#009788', borderRadius: 999,
    width: 130, height: 40, gap: 4,
    alignSelf: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  inviteBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
  },

  // Section Label
  sectionLabel: {
    fontFamily: 'Inter',
    fontSize: 15,
    fontWeight: '600',
    color: '#404a59',
    lineHeight: 21,
    letterSpacing: 0,
    marginTop: 9,
    marginBottom: 10,
  },

  // Search bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.12)',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '400',
    color: '#0f172a',
    padding: 0,
    backgroundColor: 'transparent',
  },
  noResultsText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 20,
  },
  // Friends List
  friendsList: {
    marginBottom: 20,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  friendRowSelected: {
    backgroundColor: 'rgba(13, 148, 136, 0.07)',
  },

  // Checkbox
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  checkboxSelected: {
    backgroundColor: '#0d9488',
    borderColor: '#0d9488',
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
    fontSize: 16,
    fontWeight: '600',
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 14,
    fontWeight: '400',
    color: '#0f172a',
    marginBottom: 2,
  },
  friendHandle: {
    fontSize: 12,
    fontWeight: '400',
    color: '#0d9488',
    marginBottom: 2,
  },
  friendStats: {
    fontSize: 11,
    fontWeight: '400',
    color: '#94a3b8',
  },
  friendActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // Overflow menu — mirrors ExpenseCard's dots menu
  menuBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  menuSheet: {
    position: 'absolute',
    width: 168,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  menuItemBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f1f5f9',
  },
  menuText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
  },
  menuTextDanger: {
    color: '#ef4444',
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
    fontSize: 17,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 20,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.52)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  dialog: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    overflow: 'hidden',
    maxHeight: '85%',
  },
  dHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#334155',
    marginBottom: 6,
    marginTop: 10,
  },
  fInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
  },

  // Friend chips
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Primary action button
  primaryBtn: {
    backgroundColor: '#0d9488',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryBtnEvent: {
    backgroundColor: '#6366f1',
  },
  primaryBtnTxt: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },

  // Invite modal specifics
  inviteIconBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteIconBtnActive: {
    borderColor: '#0d9488',
    backgroundColor: '#0d9488',
  },
  sendBtn: {
    backgroundColor: '#0d9488',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnTxt: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
