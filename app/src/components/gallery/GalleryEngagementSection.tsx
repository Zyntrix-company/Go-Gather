import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator,
  ScrollView, Keyboard, Modal, Pressable, Dimensions, BackHandler, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { MoreVertical, Pen, Trash2 } from 'lucide-react-native';
import CachedImage from '../common/CachedImage';
import { getRelativeTime } from '../../utils/relativeTime';
import type { GalleryComment } from '../../api/gallery.api';
import useAuthStore from '../../store/authStore';
import { showConfirm } from '../../store/alertStore';
import { useKeyboardHeight } from '../../hooks/useKeyboardVisible';
import { GALLERY_COMMENT_MAX } from '../../constants/albumPhotosLayout';

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill={filled ? '#f43f5e' : 'none'}>
      <Path
        d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
        stroke="#f43f5e"
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
        stroke="#94a3b8"
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
  isLast,
  onOpenMenu,
}: {
  c: GalleryComment;
  viewOnly: boolean;
  canModerateComments: boolean;
  currentUserId?: string;
  isLast: boolean;
  onOpenMenu: (id: string, x: number, y: number, w: number, h: number) => void;
}) {
  const anchorRef = useRef<View>(null);
  const isOwn = c.userId === currentUserId;
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
        <Text style={styles.commentText} numberOfLines={1} ellipsizeMode="tail">{c.text}</Text>
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
  // Pin the composer sheet directly above the keyboard. The Modal is its own
  // transparent window that does not honour the activity's adjustResize (which
  // also breaks on large edge-to-edge screens), so the measured keyboard height
  // is exactly how far to lift the sheet — consistent on every screen size.
  const keyboardHeight = useKeyboardHeight();
  const insets = useSafeAreaInsets();
  // On Android edge-to-edge (RN's default), Keyboard.endCoordinates.height
  // under-reports by the navigation-bar inset, but the translucent Modal draws
  // its content all the way down behind the nav bar. Without compensating, the
  // sheet is lifted too little and the input row hides behind the keyboard.
  // iOS reports the height from the screen bottom already, so no extra offset.
  const composerLift =
    keyboardHeight > 0
      ? keyboardHeight + (Platform.OS === 'android' ? insets.bottom : 0)
      // Keyboard not up yet (or focus hasn't landed): still clear the nav bar /
      // home indicator so the sheet never sits underneath it.
      : insets.bottom;
  const commentScrollRef = useRef<ScrollView>(null);
  const composerRef = useRef<TextInput>(null);
  const [posting, setPosting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuBounds, setMenuBounds] = useState<{ bottom: number; right: number } | null>(null);

  // Single keyboard-anchored composer handles both adding a new comment and
  // editing an existing one. It lives in a transparent Modal pinned just above
  // the keyboard, so the album screen behind never scrolls or shifts.
  const [composerMode, setComposerMode] = useState<'new' | 'edit' | null>(null);
  const [composerEditId, setComposerEditId] = useState<string | null>(null);
  const [composerText, setComposerText] = useState('');

  const openCompose = () => {
    if (viewOnly) return;
    setComposerEditId(null);
    setComposerText('');
    setComposerMode('new');
  };

  const startEdit = (c: GalleryComment) => {
    setOpenMenuId(null);
    setComposerEditId(c.id);
    setComposerText(c.text);
    setComposerMode('edit');
  };

  const closeComposer = () => {
    setComposerMode(null);
    setComposerEditId(null);
    setComposerText('');
    Keyboard.dismiss();
  };

  // Focus once the Modal's native window has actually finished presenting —
  // a fixed timeout tied to the state change races the native Dialog on
  // Android and can silently drop the focus() call, leaving the keyboard closed.
  const handleComposerShow = () => {
    setTimeout(() => composerRef.current?.focus(), Platform.OS === 'android' ? 150 : 50);
  };

  // Scroll to latest comment whenever the list grows
  useEffect(() => {
    if (comments.length > 0) {
      commentScrollRef.current?.scrollToEnd({ animated: false });
    }
  }, [comments.length]);

  // Hardware back (Android): while the composer is open, close it instead of
  // leaving the keyboard up / closing the album.
  useEffect(() => {
    if (!composerMode) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeComposer();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composerMode]);

  const submitComposer = async () => {
    const text = composerText.trim();
    if (!text || posting) return;
    setPosting(true);
    try {
      if (composerMode === 'edit' && composerEditId) {
        await onEditComment(composerEditId, text);
      } else {
        await onAddComment(text);
      }
      closeComposer();
    } finally {
      setPosting(false);
    }
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
      isLast={idx === comments.length - 1}
      onOpenMenu={(id, x, y, w, _h) => {
        const { width: sw, height: sh } = Dimensions.get('window');
        setMenuBounds({ bottom: sh - y + 4, right: sw - (x + w) });
        setOpenMenuId((prev) => (prev === id ? null : id));
      }}
    />
  ));

  const canSubmit = composerText.trim().length > 0 && !posting;

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

      {scrollableComments ? (
        // Only the comment list scrolls — the album screen behind stays fixed.
        // Composing/editing happens in the keyboard-anchored Modal below, so this
        // list never needs to shift to keep an input above the keyboard.
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
        comments.length > 0 ? <View style={styles.commentList}>{commentRows}</View> : null
      )}

      {/* Keyboard-anchored composer — new comment + edit. The sheet is lifted to
          sit flush on top of the keyboard by the measured keyboard height, so it
          stays visible on every screen size. The album screen behind never scrolls. */}
      <Modal
        visible={composerMode !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onShow={handleComposerShow}
        onRequestClose={closeComposer}
      >
        <View style={styles.composerRoot}>
          {/* Full-screen scrim — tap anywhere outside the sheet to dismiss. */}
          <Pressable style={StyleSheet.absoluteFill} onPress={closeComposer} />
          <View
            style={[styles.composerAvoider, { paddingBottom: composerLift }]}
            pointerEvents="box-none"
          >
            <View style={styles.composerSheet}>
              <View style={styles.composerHeaderRow}>
                <Text style={styles.composerTitle}>
                  {composerMode === 'edit' ? 'Edit comment' : 'Add a comment'}
                </Text>
                <Text style={[styles.charCount, composerText.length >= GALLERY_COMMENT_MAX && styles.charCountLimit]}>
                  {composerText.length}/{GALLERY_COMMENT_MAX}
                </Text>
              </View>
              <View style={styles.composerInputRow}>
                {currentUser?.photoUrl ? (
                  <CachedImage uri={currentUser.photoUrl} style={styles.commentAvatar} resizeMode="cover" />
                ) : (
                  <View style={[styles.commentAvatar, styles.commentAvatarPlaceholder]}>
                    <Text style={styles.commentInitial}>{userInitial}</Text>
                  </View>
                )}
                <TextInput
                  ref={composerRef}
                  value={composerText}
                  onChangeText={(t) => setComposerText(t.slice(0, GALLERY_COMMENT_MAX))}
                  placeholder="Write a comment…"
                  placeholderTextColor="#94a3b8"
                  style={styles.composerInput}
                  maxLength={GALLERY_COMMENT_MAX}
                  multiline={false}
                  numberOfLines={1}
                  returnKeyType="send"
                  onSubmitEditing={submitComposer}
                  blurOnSubmit={false}
                  underlineColorAndroid="transparent"
                  cursorColor="#0d9488"
                  selectionColor="#0d9488"
                />
                <TouchableOpacity
                  onPress={submitComposer}
                  disabled={!canSubmit}
                  style={[styles.composerSendBtn, !canSubmit && styles.composerSendBtnDisabled]}
                  activeOpacity={0.85}
                >
                  {posting
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.composerSendText}>{composerMode === 'edit' ? 'Save' : 'Post'}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

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
            statusBarTranslucent
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
    color: '#64748b',
  },
  statCount: {
    fontWeight: '600',
    color: '#64748b',
  },
  charCount: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  charCountLimit: {
    color: '#f59e0b',
  },
  // ── Keyboard-anchored composer ──
  composerRoot: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  composerAvoider: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  composerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },
  composerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  composerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  composerInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  composerInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
  },
  composerSendBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#0d9488',
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerSendBtnDisabled: {
    opacity: 0.45,
  },
  composerSendText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
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
    fontWeight: '600',
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
