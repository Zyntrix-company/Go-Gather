import { useState, useEffect, useCallback } from 'react';
import Toast from 'react-native-toast-message';
import {
  getGalleryEngagement,
  toggleGalleryLike,
  addGalleryComment,
  updateGalleryComment,
  deleteGalleryComment,
  getCustomAlbumEngagement,
  toggleCustomAlbumLike,
  addCustomAlbumComment,
  type GalleryComment,
} from '../api/gallery.api';

type TripEventEngagementParams = {
  kind: 'trip-event';
  enabled: boolean;
  parentType: 'trip' | 'event';
  parentId: string;
  galleryOwnerId?: string;
};

type CustomAlbumEngagementParams = {
  kind: 'custom';
  enabled: boolean;
  albumId: string;
};

export type UseGalleryEngagementParams = TripEventEngagementParams | CustomAlbumEngagementParams;

export function useGalleryEngagement(params: UseGalleryEngagementParams) {
  const [likeCount, setLikeCount] = useState(0);
  const [likedByMe, setLikedByMe] = useState(false);
  const [comments, setComments] = useState<GalleryComment[]>([]);
  const [liking, setLiking] = useState(false);

  const enabled = params.enabled;
  const parentType = params.kind === 'trip-event' ? params.parentType : undefined;
  const parentId = params.kind === 'trip-event' ? params.parentId : undefined;
  const galleryOwnerId = params.kind === 'trip-event' ? params.galleryOwnerId : undefined;
  const albumId = params.kind === 'custom' ? params.albumId : undefined;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const fetcher = params.kind === 'custom'
      ? getCustomAlbumEngagement(params.albumId)
      : getGalleryEngagement(params.parentType, params.parentId, params.galleryOwnerId);

    fetcher
      .then((engagement) => {
        if (cancelled) return;
        setLikeCount(engagement.likeCount);
        setLikedByMe(engagement.likedByMe);
        setComments(engagement.comments);
      })
      .catch(() => {
        if (!cancelled) {
          setLikeCount(0);
          setLikedByMe(false);
          setComments([]);
        }
      });

    return () => { cancelled = true; };
  }, [enabled, params.kind, parentType, parentId, galleryOwnerId, albumId]);

  const handleToggleLike = useCallback(async () => {
    if (liking || !enabled) return;
    setLiking(true);
    try {
      const res = params.kind === 'custom'
        ? await toggleCustomAlbumLike(params.albumId)
        : await toggleGalleryLike(params.parentType, params.parentId, params.galleryOwnerId);
      setLikedByMe(res.liked);
      setLikeCount(res.likeCount);
    } catch {
      Toast.show({ type: 'error', text1: 'Could not update like' });
    } finally {
      setLiking(false);
    }
  }, [liking, enabled, params]);

  const handleAddComment = useCallback(async (text: string) => {
    const comment = params.kind === 'custom'
      ? await addCustomAlbumComment(params.albumId, text)
      : await addGalleryComment(params.parentType, params.parentId, text, params.galleryOwnerId);
    setComments((prev) => [...prev, comment]);
  }, [params]);

  const handleEditComment = useCallback(async (commentId: string, text: string) => {
    const updated = await updateGalleryComment(commentId, text);
    setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
  }, []);

  const handleDeleteComment = useCallback(async (commentId: string) => {
    await deleteGalleryComment(commentId);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  }, []);

  return {
    likeCount,
    likedByMe,
    comments,
    liking,
    handleToggleLike,
    handleAddComment,
    handleEditComment,
    handleDeleteComment,
  };
}
