import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import MediaDialogLayout from './MediaDialogLayout';
import MediaActionBar from './MediaActionBar';
import MediaGridSection from './MediaGridSection';
import MediaPreviewOverlay from './MediaPreviewOverlay';
import type { MediaItem } from '../../hooks/useMediaDialog';
import { showConfirm } from '../../store/alertStore';

type ActivitySection = {
  activityId: string;
  title: string;
  photos: MediaItem[];
};

type MediaModuleDialogProps = {
  visible: boolean;
  onClose: () => void;
  mode: 'trip' | 'event';
  loading?: boolean;
  uploading?: boolean;
  driveImporting?: boolean;
  uploadDisabled?: boolean;
  capTotal?: number | null;
  mediaCount: number;
  cellSize: number;
  bannerImageUrl?: string | null;
  tripLevelItems?: MediaItem[];
  activitySections?: ActivitySection[];
  eventItems?: MediaItem[];
  previewItem: MediaItem | null;
  deletingId?: string | null;
  settingBanner?: boolean;
  onUpload: () => void;
  onCamera: () => void;
  onDrive: () => void;
  onPressItem: (item: MediaItem) => void;
  onDeleteItem: (item: MediaItem) => void;
  onReorderTripLevel?: (items: MediaItem[]) => void;
  onReorderActivity?: (activityId: string, items: MediaItem[]) => void;
  onReorderEvent?: (items: MediaItem[]) => void;
  onClosePreview: () => void;
  onSetBanner?: (item: MediaItem) => void;
  deleteMessage: string;
};

export default function MediaModuleDialog({
  visible,
  onClose,
  mode,
  loading,
  uploading,
  driveImporting,
  uploadDisabled,
  capTotal,
  mediaCount,
  cellSize,
  bannerImageUrl,
  tripLevelItems = [],
  activitySections = [],
  eventItems = [],
  previewItem,
  deletingId,
  settingBanner,
  onUpload,
  onCamera,
  onDrive,
  onPressItem,
  onDeleteItem,
  onReorderTripLevel,
  onReorderActivity,
  onReorderEvent,
  onClosePreview,
  onSetBanner,
  deleteMessage,
}: MediaModuleDialogProps) {
  const confirmDelete = (item: MediaItem) => {
    showConfirm({
      title: 'Delete Media',
      message: deleteMessage,
      destructive: true,
      onConfirm: () => onDeleteItem(item),
    });
  };

  return (
    <>
      <MediaDialogLayout
        visible={visible}
        onClose={onClose}
        mediaCount={mediaCount}
        capTotal={capTotal}
        loading={loading}
        actions={
          <MediaActionBar
            onUpload={onUpload}
            onCamera={onCamera}
            onDrive={onDrive}
            uploading={uploading}
            driveImporting={driveImporting}
            disabled={uploadDisabled}
            capTotal={capTotal}
            entityLabel={mode}
          />
        }
      >
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color="#0d9488" />
          </View>
        ) : mode === 'trip' ? (
          <>
            {tripLevelItems.length > 0 && (
              <MediaGridSection
                items={tripLevelItems}
                bannerImageUrl={bannerImageUrl}
                cellSize={cellSize}
                deletingId={deletingId}
                onPressItem={onPressItem}
                onLongPressItem={confirmDelete}
                onReorder={onReorderTripLevel}
              />
            )}
            {activitySections.map((section) => (
              <MediaGridSection
                key={section.activityId}
                title={section.title}
                items={section.photos}
                bannerImageUrl={bannerImageUrl}
                cellSize={cellSize}
                deletingId={deletingId}
                onPressItem={onPressItem}
                onLongPressItem={confirmDelete}
                onReorder={(items) => onReorderActivity?.(section.activityId, items)}
              />
            ))}
          </>
        ) : (
          <MediaGridSection
            items={eventItems}
            bannerImageUrl={bannerImageUrl}
            cellSize={cellSize}
            deletingId={deletingId}
            onPressItem={onPressItem}
            onLongPressItem={confirmDelete}
            onReorder={onReorderEvent}
          />
        )}
      </MediaDialogLayout>

      <MediaPreviewOverlay
        visible={!!previewItem}
        item={previewItem}
        bannerImageUrl={bannerImageUrl}
        onClose={onClosePreview}
        onSetBanner={onSetBanner}
        onDelete={previewItem ? () => confirmDelete(previewItem) : undefined}
        settingBanner={settingBanner}
        deleting={!!previewItem && deletingId === previewItem.id}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingVertical: 48,
    alignItems: 'center',
  },
});
