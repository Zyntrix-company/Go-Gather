import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator,
  ScrollView, Keyboard, Modal, Pressable, Dimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { MoreVertical, Pen, Trash2 } from 'lucide-react-native';
import CachedImage from '../common/CachedImage';
import { getRelativeTime } from '../../utils/relativeTime';
import type { GalleryComment } from '../../api/gallery.api';
import useAuthStore from '../../store/authStore';
import { showConfirm } from '../../store/alertStore';
import { GALLERY_COMMENT_MAX } from '../../constants/albumPhotosLayout';

function HeartIcon({ filled }: { filled: boolean }) {
  const color = filled ? '#ef4444' : '#94a3b8';
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill={filled ? '#ef4444' : 'none'}>
      <Path
        d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
        stroke={color}
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
  isLast,
  onSaveEdit,
  onCancelEdit,
  onEditDraftChange,
  onOpenMenu,
}: {
  c: GalleryComment;
  viewOnly: boolean;
  canModerateComments: boolean;
  currentUserId?: string;
  editingId: string | null;
  editDraft: string;
  isLast: boolean;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditDraftChange: (t: string) => void;
  onOpenMenu: (id: string, x: number, y: number, w: number, h: number) => void;
}) {
  const anchorRef = useRef<View>(null);
  const isOwn = c.userId === currentUserId;
  const isEditing = editingId === c.id;
  const showMenu = !viewOnly && (isOwn || canModerateComments);

  return (
    <View style={[styles.commentRow, !isLast && styles.commentRowBorder]}>
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
            <View ref={anchorRef}>
              <TouchableOpacity
                style={styles.moreBtn}
                onPress={() => {
                  anchorRef.current?.measureInWindow((x, y, w, h) => onOpenMenu(c.id, x, y, w, h));
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MoreVertical size={14} color="#94a3b8" strokeWidth={1.8} />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
        {isEditing ? (
          <View style={styles.editRow}>
            <TextInput
              value={editDraft}
              onChangeText={(t) => onEditDraftChange(t.slice(0, GALLERY_COMMENT_MAX))}
              style={styles.editInput}
              maxLength={GALLERY_COMMENT_MAX}
              multiline={false}
              numberOfLines={1}
              autoFocus
              underlineColorAndroid="transparent"
            />
            <Text style={styles.editCharCount}>{editDraft.length}/{GALLERY_COMMENT_MAX}</Text>
            <TouchableOpacity style={styles.editSaveBtn} onPress={onSaveEdit}>
              <Text style={styles.editSave}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onCancelEdit}><Text style={styles.editCancel}>Cancel</Text></TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.commentText} numberOfLines={1} ellipsizeMode="tail">{c.text}</Text>
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
  style,
  onToggleLike,
  onAddComment,
  onEditComment,
  onDeleteComment,
}: GalleryEngagementSectionProps) {
  const currentUser = useAuthStore((s) => s.user);
  const commentScrollRef = useRef<ScrollView>(null);
  const composeRef = useRef<TextInput>(null);
  const composeAnchorRef = useRef<View>(null);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuBounds, setMenuBounds] = useState<{ bottom: number; right: number } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  const openCompose = () => {
    if (viewOnly) return;
    setComposeOpen(true);
  };

  useEffect(() => {
    if (!composeOpen) return undefined;
    const t = setTimeout(() => composeRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [composeOpen]);

  // Scroll to latest comment whenever the list grows
  useEffect(() => {
    if (comments.length > 0) {
      commentScrollRef.current?.scrollToEnd({ animated: false });
    }
  }, [comments.length]);

  const closeCompose = () => {
    setComposeOpen(false);
    setDraft('');
    Keyboard.dismiss();
  };

  const submitComment = async () => {
    const text = draft.trim();
    if (!text || posting) return;
    setPosting(true);
    try {
      await onAddComment(text);
      setDraft('');
      setComposeOpen(false);
      Keyboard.dismiss();
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
  const userInitial = (currentUser?.fullName ?? currentUser?.username ?? '?')[0]?.toUpperCase();

  const commentRows = comments.map((c, idx) => (
    <CommentRow
      key={c.id}
      c={c}
      viewOnly={viewOnly}
      canModerateComments={canModerateComments}
      currentUserId={currentUser?.id}
      editingId={editingId}
      editDraft={editDraft}
      isLast={idx === comments.length - 1 && !composeOpen}
      onSaveEdit={saveEdit}
      onCancelEdit={() => { setEditingId(null); setEditDraft(''); }}
      onEditDraftChange={setEditDraft}
      onOpenMenu={(id, x, y, w, _h) => {
        const { width: sw, height: sh } = Dimensions.get('window');
        setMenuBounds({ bottom: sh - y + 4, right: sw - (x + w) });
        setOpenMenuId((prev) => (prev === id ? null : id));
      }}
    />
  ));

  const composeBlock = composeOpen && !viewOnly ? (
    <View ref={composeAnchorRef} style={styles.composeRow}>
      {currentUser?.photoUrl ? (
        <CachedImage uri={currentUser.photoUrl} style={styles.commentAvatar} resizeMode="cover" />
      ) : (
        <View style={[styles.commentAvatar, styles.commentAvatarPlaceholder]}>
          <Text style={styles.commentInitial}>{userInitial}</Text>
        </View>
      )}
      <View style={styles.composeBody}>
        <TextInput
          ref={composeRef}
          value={draft}
          onChangeText={(t) => setDraft(t.slice(0, GALLERY_COMMENT_MAX))}
          placeholder="Write a comment…"
          placeholderTextColor="#94a3b8"
          style={styles.composeInput}
          maxLength={GALLERY_COMMENT_MAX}
          multiline={false}
          numberOfLines={1}
          returnKeyType="send"
          onSubmitEditing={submitComment}
          blurOnSubmit={false}
        />
        <View style={styles.composeFooter}>
          <Text style={[styles.charCount, draft.length >= GALLERY_COMMENT_MAX && styles.charCountLimit]}>
            {draft.length}/{GALLERY_COMMENT_MAX}
          </Text>
          <View style={styles.composeActions}>
            <TouchableOpacity onPress={closeCompose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.composeCancel}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={submitComment}
              disabled={!draft.trim() || posting}
              style={[styles.composePostBtn, (!draft.trim() || posting) && styles.composePostBtnDisabled]}
            >
              {posting
                ? <ActivityIndicator size="small" color="#0d9488" />
                : <Text style={styles.composePost}>Post</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  ) : null;

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
            ref={commentScrollRef}
            style={styles.commentScroll}
            contentContainerStyle={styles.commentScrollContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            decelerationRate="fast"
          >
            {commentRows}
          </ScrollView>
        ) : (
          <View style={styles.commentList}>{commentRows}</View>
        )
      ) : null}

      {composeBlock}

      {/* Comment action modal — rendered outside the scroll view to avoid Android clipping */}
      {(() => {
        const activeComment = openMenuId ? comments.find((c) => c.id === openMenuId) : null;
        if (!activeComment) return null;
        const isOwn = activeComment.userId === currentUser?.id;
        const moderatorOnly = !isOwn && canModerateComments;
        return (
          <Modal
            visible
            transparent
            animationType="fade"
            onRequestClose={() => setOpenMenuId(null)}
          >
            <Pressable style={styles.menuModalOverlay} onPress={() => setOpenMenuId(null)}>
              <View style={[styles.menuModalSheet, menuBounds ? { bottom: menuBounds.bottom, right: menuBounds.right } : styles.menuModalSheetFallback]}>
                {!moderatorOnly && (
                  <TouchableOpacity
                    style={styles.menuModalItem}
                    activeOpacity={0.8}
                    onPress={() => { setOpenMenuId(null); startEdit(activeComment); }}
                  >
                    <Pen size={15} color="#64748b" strokeWidth={2} />
                    <Text style={styles.menuModalText}>Edit</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.menuModalItem, styles.menuModalItemBorder]}
                  activeOpacity={0.8}
                  onPress={() => { setOpenMenuId(null); confirmDelete(activeComment.id); }}
                >
                  <Trash2 size={15} color="#ef4444" strokeWidth={2} />
                  <Text style={[styles.menuModalText, styles.menuModalTextDanger]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Modal>
        );
      })()}
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
  composeRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
  },
  composeBody: {
    flex: 1,
    minWidth: 0,
  },
  composeInput: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    paddingVertical: 4,
    paddingHorizontal: 0,
    height: 28,
  },
  composeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  charCount: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  charCountLimit: {
    color: '#f59e0b',
  },
  composeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  composeCancel: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
  composePostBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  composePostBtnDisabled: {
    opacity: 0.45,
  },
  composePost: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0d9488',
  },
  commentList: {
    marginTop: 2,
  },
  commentScroll: {
    flex: 1,
    marginTop: 2,
  },
  commentScrollContent: {
    flexGrow: 0,
  },
  commentRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 12,
    overflow: 'visible',
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
    fontWeight: '500',
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
    overflow: 'visible',
  },
  moreBtn: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentMenuBase: {
    position: 'absolute',
    right: 0,
    width: 132,
    zIndex: 200,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 3,
    overflow: 'hidden',
  },
  commentMenuBelow: {
    top: 24,
  },
  commentMenuAbove: {
    bottom: 24,
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
    minWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 4,
    fontSize: 13,
    color: '#334155',
    height: 28,
  },
  editCharCount: {
    fontSize: 11,
    color: '#94a3b8',
  },
  editSaveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: '#0d9488',
    borderRadius: 7,
  },
  editSave: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  editCancel: {
    fontSize: 13,
    color: '#94a3b8',
  },
  menuModalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  menuModalSheet: {
    position: 'absolute',
    width: 148,
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 6,
  },
  menuModalSheetFallback: {
    bottom: '40%',
    right: 16,
  },
  menuModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuModalItemBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f1f5f9',
  },
  menuModalText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
  },
  menuModalTextDanger: {
    color: '#ef4444',
  },
});
