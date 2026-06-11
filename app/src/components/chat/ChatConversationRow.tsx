import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import SweeIcon from '../common/SweeIcon';
import { PlaneIcon } from '../common/Icons';
import type { AiConversation } from '../../api/ai.api';
import { getRelativeTime } from '../../utils/relativeTime';

function EventCalendarIcon({ color = '#fff', size = 22 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={4} width={18} height={18} rx={2} ry={2} stroke={color} strokeWidth={2} />
      <Path d="M16 2v4M8 2v4M3 10h18" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function NoteIcon({ color = '#fff', size = 22 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 11l3 3L22 4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CategoryAvatar({ category }: { category: AiConversation['category'] }) {
  switch (category) {
    case 'trip':
      return (
        <View style={[styles.avatar, { backgroundColor: '#0d9488' }]}>
          <PlaneIcon color="#fff" size={22} />
        </View>
      );
    case 'event':
      return (
        <View style={[styles.avatar, { backgroundColor: '#ea580c' }]}>
          <EventCalendarIcon />
        </View>
      );
    case 'content':
      return (
        <View style={[styles.avatar, { backgroundColor: '#6366f1' }]}>
          <NoteIcon />
        </View>
      );
    default:
      return (
        <View style={[styles.avatar, { backgroundColor: '#0d9488' }]}>
          <SweeIcon size={22} color="#fff" />
        </View>
      );
  }
}

type Props = {
  conversation: AiConversation;
  onPress: () => void;
};

export default function ChatConversationRow({ conversation, onPress }: Props) {
  const preview = conversation.preview?.trim() || 'Start chatting with Swee…';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <CategoryAvatar category={conversation.category} />
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0fdfa',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  info: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
    gap: 8,
  },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0f172a' },
  time: { fontSize: 11, color: '#94a3b8', flexShrink: 0 },
  preview: { fontSize: 13, color: '#64748b' },
});
