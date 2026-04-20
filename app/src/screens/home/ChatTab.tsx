import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import SweeIcon from '../../components/common/SweeIcon';

// Mock data
export const SWEE_CHAT = {
  id: 'swee',
  name: 'Swee',
  subtitle: 'Always active · AI Assistant',
  isSwee: true,
  lastMessage: "Hi! I'm Swee, your travel assistant. How can I help plan your next adventure?",
  time: 'Now',
  unread: 0,
};


function ChatTab({ onNavigateToChat }: { onNavigateToChat: (chat: any) => void }) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      {/* Swee AI chat — the only entry */}
      <TouchableOpacity style={styles.sweeChatCard} onPress={() => onNavigateToChat(SWEE_CHAT)} activeOpacity={0.85}>
        <View style={styles.sweeChatAvatar}>
          <SweeIcon size={22} />
        </View>
        <View style={styles.chatInfo}>
          <View style={styles.chatTitleRow}>
            <View>
              <Text style={styles.chatName}>{SWEE_CHAT.name}</Text>
              <Text style={styles.sweeChatSubtitle}>{SWEE_CHAT.subtitle}</Text>
            </View>
            <Text style={styles.chatTime}>{SWEE_CHAT.time}</Text>
          </View>
          <Text style={styles.chatLastMsg} numberOfLines={2}>{SWEE_CHAT.lastMessage}</Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 4 },
  sweeChatCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3, borderWidth: 1, borderColor: '#f0fdfa' },
  sweeChatAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#0d9488', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sweeChatSubtitle: { fontSize: 12, color: '#0d9488', fontWeight: '500', marginTop: 1 },
  chatInfo: { flex: 1 },
  chatTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  chatName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  chatTime: { fontSize: 11, color: '#94a3b8' },
  chatLastMsg: { flex: 1, fontSize: 13, color: '#64748b' },
});

export default ChatTab;
