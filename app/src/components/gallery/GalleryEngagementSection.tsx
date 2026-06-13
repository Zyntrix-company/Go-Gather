import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Modal, Pressable,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import CachedImage from '../common/CachedImage';
import { getRelativeTime } from '../../utils/relativeTime';
import type { GalleryComment } from '../../api/gallery.api';
import useAuthStore from '../../store/authStore';
import { showConfirm } from '../../store/alertStore';

const COMMENT_MAX = 20;

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill={filled ? '#ef4444' : 'none'}>
      <Path
        d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
        stroke={filled ? '#ef4444' : '#64748b'}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CommentIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
        stroke="#64748b"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function DotsIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M12 13a1 1 0 100-2 1 1 0 000 2zM19 13a1 1 0 100-2 1 1 0 000 2zM5 13a1 1 0 100-2 1 1 0 000 2z" fill="#94a3b8" />
    </Svg>
  );
}

type GalleryEngagementSectionProps = {
  likeCount: number;
  likedByMe: boolean;
  comments: GalleryComment[];
  viewOnly?: boolean;
  onToggleLike: () => void;
  onAddComment: (text: string) => Promise<void>;
  onEditComment: (commentId: string, text: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  liking?: boolean;
};

export default function GalleryEngagementSection({
  likeCount,
  likedByMe,
  comments,
  viewOnly = false,
  onToggleLike,
  onAddComment,
  onEditComment,
  onDeleteComment,
  liking = false,
}: GalleryEngagementSectionProps) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [menuCommentId, setMenuCommentId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const submitComment = async () => {
    const text = draft.trim();
    if (!text || posting) return;
    setPosting(true);
    try {
      await onAddComment(text);
      setDraft('');
    } finally {
      setPosting(false);
    }
  };

  const startEdit = (c: GalleryComment) => {
    setMenuCommentId(null);
    setEditingId(c.id);
    setEditDraft(c.text);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const text = editDraft.trim();
    if (!text) return;
    await onEditComment(editingId, text);
    setEditingId(null);
    setEditDraft('');
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.statsRow}>
        <TouchableOpacity style={styles.stat} onPress={onToggleLike} disabled={liking} activeOpacity={0.8}>
          {liking ? <ActivityIndicator size="small" color="#ef4444" /> : <HeartIcon filled={likedByMe} />}
          <Text style={[styles.statText, likedByMe && styles.statTextLiked]}>
            {likeCount} {likeCount === 1 ? 'Like' : 'Likes'}
          </Text>
        </TouchableOpacity>
        <View style={styles.stat}>
          <CommentIcon />
          <Text style={styles.statText}>{comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}</Text>
        </View>
      </View>

      {!viewOnly ? (
        <View style={styles.composeRow}>
          <TextInput
            value={draft}
            onChangeText={(t) => setDraft(t.slice(0, COMMENT_MAX))}
            placeholder="Add a comment…"
            placeholderTextColor="#94a3b8"
            style={styles.composeInput}
            maxLength={COMMENT_MAX}
            returnKeyType="send"
            onSubmitEditing={submitComment}
          />
          <Text style={styles.charCount}>{draft.length}/{COMMENT_MAX}</Text>
          <TouchableOpacity onPress={submitComment} disabled={!draft.trim() || posting} style={styles.postBtn}>
            {posting ? <ActivityIndicator size="small" color="#0d9488" /> : <Text style={styles.postBtnText}>Post</Text>}
          </TouchableOpacity>
        </View>
      ) : null}

      {comments.map((c) => {
        const isOwn = c.userId === currentUserId;
        const isEditing = editingId === c.id;

        return (
          <View key={c.id} style={styles.commentRow}>
            {c.avatarUrl ? (
              <CachedImage uri={c.avatarUrl} style={styles.commentAvatar} resizeMode="cover" />
            ) : (
              <View style={[styles.commentAvatar, styles.commentAvatarPlaceholder]}>
                <Text style={styles.commentInitial}>{(c.userName ?? '?')[0]?.toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.commentBody}>
              <View style={styles.commentTop}>
                <Text style={styles.commentName} numberOfLines={1}>{c.userName}</Text>
                <Text style={styles.commentTime}>{getRelativeTime(c.createdAt)}</Text>
                {isOwn && !viewOnly ? (
                  <TouchableOpacity onPress={() => setMenuCommentId(c.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <DotsIcon />
                  </TouchableOpacity>
                ) : null}
              </View>
              {isEditing ? (
                <View style={styles.editRow}>
                  <TextInput
                    value={editDraft}
                    onChangeText={(t) => setEditDraft(t.slice(0, COMMENT_MAX))}
                    style={styles.editInput}
                    maxLength={COMMENT_MAX}
                    autoFocus
                  />
                  <TouchableOpacity onPress={saveEdit}><Text style={styles.editSave}>Save</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditingId(null)}><Text style={styles.editCancel}>Cancel</Text></TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.commentText}>{c.text}</Text>
              )}
            </View>
          </View>
        );
      })}

      <Modal visible={!!menuCommentId} transparent animationType="fade" onRequestClose={() => setMenuCommentId(null)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuCommentId(null)}>
          <View style={styles.menuSheet}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                const c = comments.find((x) => x.id === menuCommentId);
                if (c) startEdit(c);
              }}
            >
              <Text style={styles.menuItemText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemDanger]}
              onPress={() => {
                const id = menuCommentId;
                setMenuCommentId(null);
                if (!id) return;
                showConfirm({
                  title: 'Delete comment?',
                  message: 'This cannot be undone.',
                  destructive: true,
                  confirmText: 'Delete',
                  onConfirm: () => onDeleteComment(id),
                });
              }}
            >
              <Text style={[styles.menuItemText, styles.menuItemDangerText]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 12,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  statTextLiked: {
    color: '#ef4444',
  },
  composeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  composeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  charCount: {
    fontSize: 10,
    color: '#94a3b8',
    minWidth: 28,
  },
  postBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  postBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0d9488',
  },
  commentRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  commentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
  },
  commentAvatarPlaceholder: {
    backgroundColor: '#f0fdfa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentInitial: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0d9488',
  },
  commentBody: {
    flex: 1,
    minWidth: 0,
  },
  commentTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  commentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0d9488',
    flexShrink: 1,
  },
  commentTime: {
    fontSize: 11,
    color: '#94a3b8',
    marginLeft: 'auto',
  },
  commentText: {
    fontSize: 14,
    color: '#0f172a',
    lineHeight: 20,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  editInput: {
    flex: 1,
    minWidth: 120,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    color: '#0f172a',
  },
  editSave: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0d9488',
  },
  editCancel: {
    fontSize: 13,
    color: '#94a3b8',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 28,
  },
  menuItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  menuItemDanger: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '500',
  },
  menuItemDangerText: {
    color: '#ef4444',
  },
});
