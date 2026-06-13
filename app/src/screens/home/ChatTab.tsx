import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import ChatConversationRow from '../../components/chat/ChatConversationRow';
import ChatListSkeleton from '../../components/chat/ChatListSkeleton';
import SweeIcon from '../../components/common/SweeIcon';
import useChatStore from '../../store/chatStore';
import { type AiConversation } from '../../api/ai.api';

type Props = {
  onOpenConversation: (conversationId: string) => void;
  onOpenNewChat: () => void;
};

function PlusIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ChatTab({ onOpenConversation, onOpenNewChat }: Props) {
  const conversations = useChatStore((s) => s.conversations);
  const loading = useChatStore((s) => s.loading);
  const hasMore = useChatStore((s) => s.hasMore);
  const fetchConversations = useChatStore((s) => s.fetchConversations);

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchConversations(true);
  }, [fetchConversations]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConversations(true);
    setRefreshing(false);
  }, [fetchConversations]);

  const handleNewChat = useCallback(() => {
    onOpenNewChat();
  }, [onOpenNewChat]);

  const renderItem = useCallback(({ item }: { item: AiConversation }) => (
    <ChatConversationRow
      conversation={item}
      onPress={() => onOpenConversation(item.id)}
    />
  ), [onOpenConversation]);

  const showInitialSkeleton = loading && conversations.length === 0;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.newChatBtn}
        onPress={handleNewChat}
        activeOpacity={0.85}
      >
        <PlusIcon />
        <Text style={styles.newChatText}>Start New Chat</Text>
      </TouchableOpacity>

      {showInitialSkeleton ? (
        <ChatListSkeleton />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#0d9488" />
          }
          onEndReached={() => fetchConversations(false)}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <SweeIcon size={28} color="#0d9488" />
                </View>
                <Text style={styles.emptyTitle}>Start your first chat with Swee</Text>
                <Text style={styles.emptySubtitle}>
                  Plan trips, create events, or ask anything travel-related.
                </Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            loading && conversations.length > 0 ? (
              <ActivityIndicator style={styles.footerLoader} color="#0d9488" />
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 100 },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0d9488',
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 14,
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  newChatText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  listContent: { gap: 10, flexGrow: 1, paddingBottom: 16 },
  empty: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f0fdfa',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  footerLoader: { marginVertical: 16 },
});

export default ChatTab;
