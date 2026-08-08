import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MoreVertical, Star } from 'lucide-react-native';
import { CardMenu } from '../common/Cards';
import type { AiConversation } from '../../api/ai.api';
import { getRelativeTime } from '../../utils/relativeTime';

type Props = {
  conversation: AiConversation;
  onPress: () => void;
  onToggleMenu: () => void;
  showMenu: boolean;
  onToggleStar: () => void;
  onDelete: () => void;
};

export default function ChatConversationRow({
  conversation, onPress, onToggleMenu, showMenu, onToggleStar, onDelete,
}: Props) {
  const preview = conversation.preview?.trim() || 'Start chatting with Swee…';

  return (
    <View style={[styles.wrapper, showMenu && styles.wrapperRaised]}>
      <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
        <View style={styles.info}>
          <View style={styles.titleRow}>
            {conversation.starred ? (
              <Star size={13} color="#f59e0b" fill="#f59e0b" strokeWidth={2} />
            ) : null}
            <Text style={styles.title} numberOfLines={1}>{conversation.title}</Text>
            <Text style={styles.time}>{getRelativeTime(conversation.updatedAt)}</Text>
            <TouchableOpacity
              style={styles.moreBtn}
              onPress={onToggleMenu}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MoreVertical size={14} color="#64748b" strokeWidth={1.8} />
            </TouchableOpacity>
          </View>
          <Text style={styles.preview} numberOfLines={1}>{preview}</Text>
        </View>
      </TouchableOpacity>

      {showMenu && (
        <CardMenu
          extraItems={[{
            label: conversation.starred ? 'Unstar' : 'Star',
            onPress: onToggleStar,
            icon: <Star size={15} color="#64748b" strokeWidth={2} />,
          }]}
          onDelete={onDelete}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    zIndex: 1,
  },
  wrapperRaised: {
    zIndex: 100,
  },
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
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  title: { flex: 1, fontSize: 14, fontWeight: '500', color: '#0d9488' },
  time: { fontSize: 11, color: '#94a3b8', flexShrink: 0 },
  moreBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  preview: { fontSize: 13, color: '#64748b' },
});
