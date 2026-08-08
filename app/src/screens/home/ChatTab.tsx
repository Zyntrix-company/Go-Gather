import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path, Circle } from 'react-native-svg';
import Toast from 'react-native-toast-message';
import ChatConversationRow from '../../components/chat/ChatConversationRow';
import ChatListSkeleton from '../../components/chat/ChatListSkeleton';
import SweeIcon from '../../components/common/SweeIcon';
import useChatStore from '../../store/chatStore';
import { showConfirm } from '../../store/alertStore';
import { handleApiError } from '../../api/trips.api';
import {
  deleteConversation,
  setConversationStarred,
  type AiConversation,
} from '../../api/ai.api';

type Props = {
  onOpenConversation: (conversationId: string) => void;
  onOpenNewChat: () => void;
};

function SearchIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={8} stroke="#94a3b8" strokeWidth={2} />
      <Path d="M21 21l-4.35-4.35" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

type HeaderProps = {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onNewChat: () => void;
};

function ListHeader({ searchQuery, onSearchChange, onNewChat }: HeaderProps) {
  return (
    <View>
      {/* Hero — mirrors the Trips/Events hero (icon circle → title → sub → pill CTA) */}
      <View style={styles.hero}>
        <View style={styles.heroIconWrap}>
          <SweeIcon size={28} color="#0d9488" />
        </View>
        <Text style={styles.heroHeading}>
          Ask Swee anything — trips, tips, or just chat!
        </Text>
        <Text style={styles.heroSubtitle}>
          Your AI travel companion, always ready to help
        </Text>
        <TouchableOpacity
          style={styles.newChatBtn}
          onPress={onNewChat}
          activeOpacity={0.85}
        >
          <Text style={styles.newChatText}>New Chat</Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchBar}>
        <SearchIcon />
        <TextInput
          style={styles.searchInput}
          placeholder="Search chats..."
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={onSearchChange}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

    </View>
  );
}

function ChatTab({ onOpenConversation, onOpenNewChat }: Props) {
  const conversations = useChatStore((s) => s.conversations);
  const loading = useChatStore((s) => s.loading);
  const hasMore = useChatStore((s) => s.hasMore);
  const fetchConversations = useChatStore((s) => s.fetchConversations);
  const updateConversation = useChatStore((s) => s.updateConversation);
  const removeConversation = useChatStore((s) => s.removeConversation);

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchConversations(true);
    }, [fetchConversations]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConversations(true);
    setRefreshing(false);
  }, [fetchConversations]);

  const handleEndReached = useCallback(() => {
    if (hasMore && !loading) fetchConversations(false);
  }, [hasMore, loading, fetchConversations]);

  const filteredConversations = searchQuery.trim()
    ? conversations.filter(
        (c) =>
          c.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.preview?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : conversations;

  const handleToggleStar = useCallback(async (conversation: AiConversation) => {
    setOpenMenuId(null);
    const nextStarred = !conversation.starred;
    updateConversation(conversation.id, { starred: nextStarred });
    try {
      await setConversationStarred(conversation.id, nextStarred);
    } catch (err) {
      updateConversation(conversation.id, { starred: conversation.starred });
      handleApiError(err);
    }
  }, [updateConversation]);

  const handleDeleteConversation = useCallback((conversation: AiConversation) => {
    setOpenMenuId(null);
    showConfirm({
      title: 'Delete chat',
      message: `Delete "${conversation.title}"? This cannot be undone.`,
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteConversation(conversation.id);
          removeConversation(conversation.id);
          Toast.show({ type: 'success', text1: 'Deleted', text2: 'Chat has been deleted.' });
        } catch (err) {
          handleApiError(err);
        }
      },
    });
  }, [removeConversation]);

  const renderItem = useCallback(
    ({ item }: { item: AiConversation }) => (
      <ChatConversationRow
        conversation={item}
        onPress={() => onOpenConversation(item.id)}
        onToggleMenu={() => setOpenMenuId((p) => (p === item.id ? null : item.id))}
        showMenu={openMenuId === item.id}
        onToggleStar={() => handleToggleStar(item)}
        onDelete={() => handleDeleteConversation(item)}
      />
    ),
    [onOpenConversation, openMenuId, handleToggleStar, handleDeleteConversation],
  );

  const renderHeader = useCallback(
    () => (
      <ListHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onNewChat={onOpenNewChat}
      />
    ),
    [searchQuery, onOpenNewChat],
  );

  const renderEmpty = useCallback(
    () =>
      !loading ? (
        <View style={styles.empty}>
          <SweeIcon size={28} color="#0d9488" />
          <Text style={styles.emptyTitle}>
            {searchQuery.trim()
              ? 'No chats match your search'
              : 'Start your first chat with Swee'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery.trim()
              ? 'Try a different keyword'
              : 'Plan trips, create events, or ask anything travel-related.'}
          </Text>
        </View>
      ) : null,
    [loading, searchQuery],
  );

  const renderFooter = useCallback(
    () =>
      loading && conversations.length > 0 ? (
        <ActivityIndicator style={styles.footerLoader} color="#0d9488" />
      ) : null,
    [loading, conversations.length],
  );

  return (
    <FlatList
      data={loading && conversations.length === 0 ? [] : filteredConversations}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      style={styles.list}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={
        loading && conversations.length === 0
          ? (
            <View style={styles.skeletonWrap}>
              <ChatListSkeleton />
            </View>
          )
          : renderEmpty()
      }
      ListFooterComponent={renderFooter}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#0d9488"
        />
      }
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.4}
      onScrollBeginDrag={() => setOpenMenuId(null)}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 120,
    flexGrow: 1,
  },

  // Hero — same metrics as TripsScreen.tripsCTA / EventsScreen.heroSection
  hero: { alignItems: 'center', marginTop: 18, marginBottom: 20, gap: 16 },
  heroIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#ccfbf1',
    alignItems: 'center', justifyContent: 'center',
  },
  heroHeading: {
    fontFamily: 'Inter', fontSize: 20, fontWeight: '400', color: '#0F172B',
    textAlign: 'center', lineHeight: 28, letterSpacing: 0, width: 266,
  },
  heroSubtitle: {
    fontFamily: 'Inter', fontSize: 16, fontWeight: '400', color: '#45556C',
    textAlign: 'center', lineHeight: 20, letterSpacing: 0, width: 316,
  },

  // New Chat button — same pill as Create Trip / Create Event
  newChatBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#009788', borderRadius: 999,
    width: 130, height: 40, gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  newChatText: { color: '#fff', fontSize: 14, fontWeight: '500', lineHeight: 20, textAlign: 'center' },

  // Search bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'android' ? 12 : 14,
    marginBottom: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    paddingVertical: 0,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },

  // Skeleton inside list
  skeletonWrap: { paddingTop: 8 },

  // Empty state
  empty: { alignItems: 'center', paddingTop: 32, paddingHorizontal: 24, gap: 8 },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#0f172a',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },

  footerLoader: { marginVertical: 16 },
});

export default ChatTab;
