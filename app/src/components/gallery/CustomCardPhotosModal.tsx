import React, { useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Modal,
} from 'react-native';
import { showConfirm } from '../../store/alertStore';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import {
  updateGalleryAlbum,
  getMyGalleryAlbumPhotos,
  uploadGalleryAlbumPhotos,
  deleteGalleryAlbumPhoto,
  type GalleryAlbumCard,
} from '../../api/gallery.api';
import { Trash2 } from 'lucide-react-native';
import Toast from 'react-native-toast-message';
import { useGalleryViewportHeroHeight } from '../../hooks/useGalleryViewportHeroHeight';
import AlbumPhotosScreenLayout from './AlbumPhotosScreenLayout';
import AlbumPhotosHeroCarousel from './AlbumPhotosHeroCarousel';
import AlbumPhotosThumbStrip from './AlbumPhotosThumbStrip';
import GalleryAlbumSubHeader from './GalleryAlbumSubHeader';
import GalleryUploadSheet from './GalleryUploadSheet';
import GalleryEngagementSection from './GalleryEngagementSection';
import GalleryAlbumDescription from './GalleryAlbumDescription';
import GalleryHeroMedia, { type GalleryHeroMediaItem } from './GalleryHeroMedia';
import { focusAlbumPhotosAtEnd, sortAlbumPhotosOldestFirst } from '../../utils/albumPhotosOrder';
import useUploadLimits from '../../hooks/useUploadLimits';
import { useGalleryEngagement } from '../../hooks/useGalleryEngagement';
import { useKeyboardVisible } from '../../hooks/useKeyboardVisible';

export type CustomCard = GalleryAlbumCard & {
  type: 'trip' | 'event';
};

type CustomAlbumPhoto = GalleryHeroMediaItem & {
  createdAt?: string | null;
};

function renderGalleryHero(photo: CustomAlbumPhoto, index: number, heroIndex: number) {
  return <GalleryHeroMedia photo={photo} active={index === heroIndex} />;
}

// ─── Custom card photos modal (view mode + edit mode toggled by pencil) ──────
// Shared between the live Gallery tab and the Archived screen — the only
// difference for archived albums is the sub-header action reads "Restore"
// instead of "Archive" and skips straight to unarchiving.

export default function CustomCardPhotosModal({
  visible,
  card,
  onClose,
  onCardUpdated,
  onArchiveCard,
  onDeleteCard,
  isArchived = false,
}: {
  visible: boolean;
  card: CustomCard | null;
  onClose: () => void;
  onCardUpdated: (album: GalleryAlbumCard) => void;
  onArchiveCard: (id: string) => void;
  onDeleteCard: (id: string) => void;
  isArchived?: boolean;
}) {
  const navigation = useNavigation<any>();
  const uploadLimits = useUploadLimits();
  const [editMode, setEditMode] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [subtitleDraft, setSubtitleDraft] = useState('');
  const [photos, setPhotos] = useState<CustomAlbumPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [showUploadSheet, setShowUploadSheet] = useState(false);
  const heroFlatListRef = useRef<any>(null);

  const engagement = useGalleryEngagement({
    kind: 'custom',
    enabled: visible && !!card?.id,
    albumId: card?.id ?? '',
  });

  const keyboardVisible = useKeyboardVisible();
  const photosEmpty = photos.length === 0 && !loading;
  const heroHeight = useGalleryViewportHeroHeight({
    hasDescription: photos.length > 0,
    hasPhotos: photos.length > 0,
    emptyHero: photosEmpty,
    editMode,
    keyboardVisible,
  });

  const loadPhotos = () => {
    if (!card?.id) return;
    setLoading(true);
    getMyGalleryAlbumPhotos(card.id)
      .then((res) => {
        setPhotos(sortAlbumPhotosOldestFirst(
          res.photos.map((p) => ({
            id: p.id,
            uri: p.uri ?? '',
            mimeType: (p as { mimeType?: string }).mimeType ?? null,
            createdAt: p.createdAt ?? null,
          })),
        ));
      })
      .catch(() => setPhotos([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!visible) {
      setEditMode(false);
      setPhotos([]);
      setHeroIndex(0);
    } else if (card) {
      setNameDraft(card.name);
      setSubtitleDraft(card.gallerySubtitle?.trim() ?? '');
      loadPhotos();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, card?.id]);

  const saveAndExitEdit = async () => {
    if (!card) return;
    setSaving(true);
    try {
      const trimmedName = nameDraft.trim();
      const trimmedSubtitle = subtitleDraft.trim();
      const nameChanged = !!trimmedName && trimmedName !== card.name;
      const subtitleChanged = trimmedSubtitle !== (card.gallerySubtitle?.trim() ?? '');
      if (nameChanged || subtitleChanged) {
        const payload: { name?: string; subtitle?: string | null } = {};
        if (nameChanged) payload.name = trimmedName;
        if (subtitleChanged) payload.subtitle = trimmedSubtitle || null;
        const updated = await updateGalleryAlbum(card.id, payload);
        onCardUpdated({ ...updated, type: card.type } as GalleryAlbumCard);
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Could not save', text2: 'Please try again.' });
    } finally {
      setSaving(false);
    }
    setEditMode(false);
  };

  const uploadAssets = async (assets: { uri: string; type: string; name: string }[]) => {
    if (!card || !assets.length) return;
    setUploading(true);
    try {
      const { photos: uploaded } = await uploadGalleryAlbumPhotos(card.id, assets);
      setPhotos((prev) => {
        const mapped = uploaded.map((p, i) => ({
          id: p.id,
          uri: p.uri ?? '',
          mimeType: (p as any).mimeType ?? assets[i]?.type ?? null,
          createdAt: p.createdAt ?? new Date().toISOString(),
        }));
        focusAlbumPhotosAtEnd(prev.length, mapped.length, setHeroIndex, heroFlatListRef);
        return [...prev, ...mapped];
      });
      if (!card.bannerImageUrl && uploaded[0]?.uri) {
        const updated = await updateGalleryAlbum(card.id, { bannerImageUrl: uploaded[0].uri });
        onCardUpdated({ ...updated, type: card.type } as GalleryAlbumCard);
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Upload failed', text2: 'Please try again.' });
    } finally {
      setUploading(false);
    }
  };

  const pickPhotos = (cam: boolean) => {
    if (!card) return;
    const fn = cam ? launchCamera : launchImageLibrary;
    const batch = uploadLimits.galleryPhoto.maxBatchFiles;
    const opts = cam
      ? { mediaType: 'mixed' as const }
      : { mediaType: 'mixed' as const, selectionLimit: batch };
    fn(opts, async (res) => {
      if (res.didCancel || !res.assets?.length) return;
      const assets = res.assets
        .map((a) => ({ uri: a.uri ?? '', type: a.type ?? 'image/jpeg', name: a.fileName ?? 'media.jpg' }))
        .filter((a) => a.uri);
      await uploadAssets(assets);
    });
  };

  const deletePhoto = async (photoId: string) => {
    if (!card) return;
    setDeletingId(photoId);
    try {
      await deleteGalleryAlbumPhoto(card.id, photoId);
      const removed = photos.find((p) => p.id === photoId);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      if (removed && card.bannerImageUrl === removed.uri) {
        const updated = await updateGalleryAlbum(card.id, { bannerImageUrl: null });
        onCardUpdated({ ...updated, type: card.type } as GalleryAlbumCard);
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Could not delete', text2: 'Please try again.' });
    } finally {
      setDeletingId(null);
    }
  };

  const setPhotoAsCover = async (uri: string) => {
    if (!card) return;
    try {
      const updated = await updateGalleryAlbum(card.id, { bannerImageUrl: uri });
      onCardUpdated({ ...updated, type: card.type } as GalleryAlbumCard);
      Toast.show({ type: 'success', text1: 'Cover updated' });
    } catch {
      Toast.show({ type: 'error', text1: 'Could not set cover', text2: 'Please try again.' });
    }
  };

  if (!card) return null;

  return (
    <>
      <Modal
        visible={visible}
        transparent={false}
        animationType="slide"
        onRequestClose={onClose}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <AlbumPhotosScreenLayout
          navigation={navigation}
          activeTab="gallery"
          galleryChrome
          scrollable
          onClose={onClose}
          subHeader={
            <GalleryAlbumSubHeader
              title={card.name}
              editMode={editMode}
              nameDraft={nameDraft}
              onNameChange={setNameDraft}
              onBack={onClose}
              onEdit={() => setEditMode(true)}
              archiveLabel={isArchived ? 'Restore' : 'Archive'}
              onArchive={() => {
                if (isArchived) {
                  showConfirm({
                    title: 'Restore album?',
                    message: `Restore "${card.name}" to your gallery?`,
                    confirmText: 'Restore',
                    onConfirm: () => { onArchiveCard(card.id); onClose(); },
                  });
                } else {
                  showConfirm({
                    title: 'Archive album?',
                    message: `Hide "${card.name}" from your gallery only.\n\nFriends will not see this album on your profile. Restore from Archived.`,
                    confirmText: 'Archive',
                    onConfirm: () => { onArchiveCard(card.id); onClose(); },
                  });
                }
              }}
              onDelete={() => {
                showConfirm({
                  title: 'Delete album permanently?',
                  message: `Permanently delete "${card.name}" from your gallery only.\n\nDoes not delete shared trips or events. This cannot be undone.`,
                  confirmText: 'Delete',
                  destructive: true,
                  onConfirm: () => { onDeleteCard(card.id); onClose(); },
                });
              }}
              onUpload={() => setShowUploadSheet(true)}
              onDoneEdit={saveAndExitEdit}
              saving={saving}
            />
          }
        >
          <View style={[styles.galleryAlbumBody, photosEmpty && styles.galleryAlbumBodyEmpty]}>
            <AlbumPhotosHeroCarousel
              galleryChrome
              photos={photos}
              heroIndex={heroIndex}
              onIndexChange={setHeroIndex}
              heroRef={heroFlatListRef}
              loading={loading}
              scrollEnabled={!editMode}
              fixedHeight={photosEmpty ? undefined : heroHeight}
              emptyCentered={photosEmpty}
              showPagerDots={false}
              emptyVariant={photosEmpty ? 'own' : 'simple'}
              emptyAlbumKind={card.type}
              emptyAlbumName={card.name}
              onEmptyUpload={() => setShowUploadSheet(true)}
              renderPhoto={(item, index) => renderGalleryHero(item, index, heroIndex)}
            />
            {!keyboardVisible ? (
            <AlbumPhotosThumbStrip
              photos={photos}
              heroIndex={heroIndex}
              scrollEnabled={!editMode}
              transparent
              galleryChrome
              onSelect={(idx) => {
                setHeroIndex(idx);
                heroFlatListRef.current?.scrollToIndex({ index: idx, animated: true });
              }}
              renderOverlay={(ph, _idx) => {
                if (!editMode) return null;
                const isCover = !!card.bannerImageUrl && card.bannerImageUrl === ph.uri;
                return (
                  <>
                    <TouchableOpacity
                      onPress={() => {
                        showConfirm({
                          title: 'Delete photo?',
                          message: 'This photo will be removed from the album.',
                          destructive: true,
                          onConfirm: () => deletePhoto(ph.id),
                        });
                      }}
                      style={styles.thumbDeleteBtn}
                      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      disabled={deletingId === ph.id}
                      activeOpacity={0.7}
                    >
                      {deletingId === ph.id
                        ? <ActivityIndicator size="small" color="#fff" style={{ width: 9, height: 9 }} />
                        : <Trash2 size={11} color="#fff" strokeWidth={2.5} />}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setPhotoAsCover(ph.uri)}
                      style={[styles.thumbCoverBtn, isCover && styles.thumbCoverBtnActive]}
                      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 8, fontWeight: '600', color: isCover ? '#0d9488' : '#fff' }}>Cover</Text>
                    </TouchableOpacity>
                  </>
                );
              }}
            />
            ) : null}
            <GalleryAlbumDescription
              value={editMode ? subtitleDraft : (card.gallerySubtitle?.trim() ?? '')}
              editMode={editMode}
              onChange={setSubtitleDraft}
            />
            {photos.length > 0 ? (
              <GalleryEngagementSection
                likeCount={engagement.likeCount}
                likedByMe={engagement.likedByMe}
                comments={engagement.comments}
                canModerateComments
                scrollableComments
                onToggleLike={engagement.handleToggleLike}
                onAddComment={engagement.handleAddComment}
                onEditComment={engagement.handleEditComment}
                onDeleteComment={engagement.handleDeleteComment}
              />
            ) : null}
          </View>
        </AlbumPhotosScreenLayout>
      </Modal>
      <GalleryUploadSheet
        visible={showUploadSheet}
        onClose={() => setShowUploadSheet(false)}
        onGallery={() => pickPhotos(false)}
        onCamera={() => pickPhotos(true)}
        showDrive={false}
        busy={uploading}
      />
    </>
  );
}

const styles = StyleSheet.create({
  galleryAlbumBody: {
    flex: 1,
    minHeight: 0,
  },
  galleryAlbumBodyEmpty: {
    flexGrow: 1,
  },
  thumbDeleteBtn: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(220,38,38,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbCoverBtn: {
    position: 'absolute',
    bottom: 3,
    left: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbCoverBtnActive: { backgroundColor: '#fff' },
});
