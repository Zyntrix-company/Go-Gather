import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator,
  ScrollView, Modal, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { MoreVertical, Pen } from 'lucide-react-native';
import CachedImage from '../common/CachedImage';
import { CardMenu } from '../common/Cards';
import { getRelativeTime } from '../../utils/relativeTime';
import type { GalleryComment } from '../../api/gallery.api';
import useAuthStore from '../../store/authStore';
import { showConfirm } from '../../store/alertStore';
import {
  GALLERY_COMMENT_ROW_H,
  GALLERY_MAX_VISIBLE_COMMENTS,
} from '../../constants/albumPhotosLayout';

const COMMENT_MAX = 20;

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill={filled ? '#ef4444' : 'none'}>
      <Path
        d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
        stroke="#ef4444"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CommentIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
        stroke="#0d9488"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

type GalleryEngagementSectionProps = {
  likeCount: number;
  likedByMe: boolean;
  comments: GalleryComment[];
  viewOnly?: boolean;
  canModerateComments?: boolean;
  scrollableComments?: boolean;
  maxVisibleComments?: number;
  style?: object;
  onToggleLike: () => void;
  onAddComment: (text: string) => Promise<void>;
  onEditComment: (commentId: string, text: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
};

function CommentRow({
  c,
  viewOnly,
  canModerateComments,
  currentUserId,
  editingId,
  editDraft,
  openMenuId,
  isLast,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditDraftChange,
  onToggleMenu,
  onConfirmDelete,
}: {
  c: GalleryComment;
  viewOnly: boolean;
  canModerateComments: boolean;
  currentUserId?: string;
  editingId: string | null;
  editDraft: string;
  openMenuId: string | null;
  isLast: boolean;
  onStartEdit: (c: GalleryComment) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditDraftChange: (t: string) => void;
  onToggleMenu: (id: string) => void;
  onConfirmDelete: (id: string) => void;
}) {
  const isOwn = c.userId === currentUserId;
  const isEditing = editingId === c.id;
  const showMenu = !viewOnly && (isOwn || canModerateComments);
  const moderatorOnly = !isOwn && canModerateComments;
  const menuOpen = openMenuId === c.id;

  return (
    <View
      style={[
        styles.commentRow,
        !isLast && styles.commentRowBorder,
        menuOpen && styles.commentRowRaised,
      ]}
    >
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
          {showMenu ? (
            <View style={styles.menuAnchor}>
              <TouchableOpacity
                style={styles.moreBtn}
                onPress={() => onToggleMenu(c.id)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MoreVertical size={14} color="#94a3b8" strokeWidth={1.8} />
              </TouchableOpacity>
              {menuOpen ? (
                <CardMenu
                  containerStyle={styles.commentMenuDropdown}
                  extraItems={moderatorOnly ? undefined : [{
                    label: 'Edit',
                    icon: <Pen size={15} color="#64748b" strokeWidth={2} />,
                    onPress: () => onStartEdit(c),
                  }]}
                  onDelete={() => onConfirmDelete(c.id)}
                />
              ) : null}
            </View>
          ) : null}
        </View>
        {isEditing ? (
          <View style={styles.editRow}>
            <TextInput
              value={editDraft}
              onChangeText={(t) => onEditDraftChange(t.slice(0, COMMENT_MAX))}
              style={styles.editInput}
              maxLength={COMMENT_MAX}
              autoFocus
            />
            <TouchableOpacity onPress={onSaveEdit}><Text style={styles.editSave}>Save</Text></TouchableOpacity>
            <TouchableOpacity onPress={onCancelEdit}><Text style={styles.editCancel}>Cancel</Text></TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.commentText}>{c.text}</Text>
        )}
      </View>
    </View>
  );
}

export default function GalleryEngagementSection({
  likeCount,
  likedByMe,
  comments,
  viewOnly = false,
  canModerateComments = false,
  scrollableComments = true,
  maxVisibleComments = GALLERY_MAX_VISIBLE_COMMENTS,
  style,
  onToggleLike,
  onAddComment,
  onEditComment,
  onDeleteComment,
}: GalleryEngagementSectionProps) {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const composeRef = useRef<TextInput>(null);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const openCompose = () => {
    setComposeOpen(true);
  };

  useEffect(() => {
    if (composeOpen) {
      const t = setTimeout(() => composeRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [composeOpen]);

  const closeCompose = () => {
    setComposeOpen(false);
    setDraft('');
  };

  const submitComment = async () => {
    const text = draft.trim();
    if (!text || posting) return;
    setPosting(true);
    try {
      await onAddComment(text);
      setDraft('');
      setComposeOpen(false);
    } finally {
      setPosting(false);
    }
  };

  const startEdit = (c: GalleryComment) => {
    setOpenMenuId(null);
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

  const confirmDelete = (commentId: string) => {
    setOpenMenuId(null);
    showConfirm({
      title: 'Delete comment?',
      message: 'This cannot be undone.',
      destructive: true,
      confirmText: 'Delete',
      onConfirm: () => onDeleteComment(commentId),
    });
  };

  const likeLabel = likeCount === 1 ? 'Like' : 'Likes';
  const commentLabel = comments.length === 1 ? 'Comment' : 'Comments';
  const commentListMaxH = GALLERY_COMMENT_ROW_H * maxVisibleComments;
  const showScrollIndicator = scrollableComments && comments.length > maxVisibleComments;

  const commentRows = comments.map((c, idx) => (
    <CommentRow
      key={c.id}
      c={c}
      viewOnly={viewOnly}
      canModerateComments={canModerateComments}
      currentUserId={currentUserId}
      editingId={editingId}
      editDraft={editDraft}
      openMenuId={openMenuId}
      isLast={idx === comments.length - 1}
      onStartEdit={startEdit}
      onSaveEdit={saveEdit}
      onCancelEdit={() => { setEditingId(null); setEditDraft(''); }}
      onEditDraftChange={setEditDraft}
      onToggleMenu={(id) => setOpenMenuId((prev) => (prev === id ? null : id))}
      onConfirmDelete={confirmDelete}
    />
  ));

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.statsRow}>
        <TouchableOpacity style={styles.stat} onPress={onToggleLike} activeOpacity={0.7}>
          <HeartIcon filled={likedByMe} />
          <Text style={styles.statText}>
            <Text style={styles.statCount}>{likeCount}</Text>
            {' '}{likeLabel}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.stat} onPress={openCompose} activeOpacity={0.7} disabled={viewOnly}>
          <CommentIcon />
          <Text style={styles.statText}>
            <Text style={styles.statCount}>{comments.length}</Text>
            {' '}{commentLabel}
          </Text>
        </TouchableOpacity>
      </View>

      {comments.length > 0 ? (
        scrollableComments ? (
          <ScrollView
            style={[styles.commentScroll, { maxHeight: commentListMaxH }]}
            contentContainerStyle={styles.commentScrollContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator={showScrollIndicator}
            keyboardShouldPersistTaps="handled"
          >
            {commentRows}
          </ScrollView>
        ) : (
          <View style={styles.commentList}>{commentRows}</View>
        )
      ) : null}

      {!viewOnly ? (
        <Modal
          visible={composeOpen}
          transparent
          animationType="fade"
          onRequestClose={closeCompose}
        >
          <View style={styles.composeBackdrop}>
            <Pressable style={styles.composeDismissArea} onPress={closeCompose} />
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.composeKeyboardWrap}
            >
              <View style={styles.composeSheet}>
                <TextInput
                  ref={composeRef}
                  value={draft}
                  onChangeText={(t) => setDraft(t.slice(0, COMMENT_MAX))}
                  placeholder="Add a comment…"
                  placeholderTextColor="#94a3b8"
                  style={styles.composeInput}
                  maxLength={COMMENT_MAX}
                  returnKeyType="send"
                  onSubmitEditing={submitComment}
                  multiline={false}
                />
                <TouchableOpacity
                  onPress={submitComment}
                  disabled={!draft.trim() || posting}
                  style={[styles.postBtn, (!draft.trim() || posting) && styles.postBtnDisabled]}
                >
                  {posting
                    ? <ActivityIndicator size="small" color="#0d9488" />
                    : <Text style={styles.postBtnText}>Post</Text>}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginBottom: 10,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#0d9488',
  },
  statCount: {
    fontWeight: '700',
  },
  composeBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15,23,42,0.25)',
  },
  composeDismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  composeKeyboardWrap: {
    width: '100%',
  },
  composeSheet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 12 : 16,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#cbd5e1',
  },
  composeInput: {
    flex: 1,
    fontSize: 15,
    color: '#334155',
    paddingVertical: 8,
    paddingHorizontal: 0,
    maxHeight: 80,
  },
  postBtn: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  postBtnDisabled: {
    opacity: 0.45,
  },
  postBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0d9488',
  },
  commentList: {
    marginTop: 2,
  },
  commentScroll: {
    marginTop: 2,
    flexGrow: 0,
  },
  commentScrollContent: {
    flexGrow: 0,
  },
  commentRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 12,
  },
  commentRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  commentRowRaised: {
    zIndex: 100,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  commentAvatarPlaceholder: {
    backgroundColor: '#f0fdfa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentInitial: {
    fontSize: 12,
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
    gap: 6,
    marginBottom: 3,
  },
  commentName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0d9488',
    flexShrink: 1,
  },
  commentTime: {
    fontSize: 11,
    color: '#94a3b8',
    marginLeft: 'auto',
  },
  menuAnchor: {
    position: 'relative',
    flexShrink: 0,
    marginLeft: 2,
  },
  moreBtn: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentMenuDropdown: {
    position: 'absolute',
    top: 24,
    right: 0,
    width: 132,
    zIndex: 200,
  },
  commentText: {
    fontSize: 13,
    fontWeight: '400',
    color: '#475569',
    lineHeight: 18,
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#cbd5e1',
    paddingHorizontal: 0,
    paddingVertical: 4,
    fontSize: 13,
    color: '#334155',
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
});
