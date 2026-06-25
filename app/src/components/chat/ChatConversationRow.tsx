import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { AiConversation } from '../../api/ai.api';
import { getRelativeTime } from '../../utils/relativeTime';

type Props = {
  conversation: AiConversation;
  onPress: () => void;
};

export default function ChatConversationRow({ conversation, onPress }: Props) {
  const preview = conversation.preview?.trim() || 'Start chatting with Swee…';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{conversation.title}</Text>
          <Text style={styles.time}>{getRelativeTime(conversation.updatedAt)}</Text>
        </View>
        <Text style={styles.preview} numberOfLines={1}>{preview}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  info: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  title: { flex: 1, fontSize: 14, fontWeight: '500', color: '#0d9488' },
  time: { fontSize: 11, color: '#94a3b8', flexShrink: 0 },
  preview: { fontSize: 13, color: '#64748b' },
});
