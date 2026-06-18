import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import AppModal from '../common/AppModal';
import DetailDialogHeader from '../details/DetailDialogHeader';
import {
  AlbumPhotosOverlayContext,
  AlbumPhotosPageWidthContext,
} from './AlbumPhotosContext';

type AlbumPhotosDialogLayoutProps = {
  visible: boolean;
  onClose: () => void;
  photoIndex?: number;
  photoTotal?: number;
  /** Action buttons (upload / camera / drive) rendered below the header. */
  actions?: React.ReactNode;
  /** Edit / check control over the hero image. */
  heroOverlay?: React.ReactNode;
  children: React.ReactNode;
  maxHeight?: `${number}%` | number;
  /** Hide photo counter in header while fetching. */
  loading?: boolean;
};

function buildPhotosHeaderSubtitle(photoIndex: number, photoTotal: number): string | undefined {
  if (photoTotal > 0) {
    return `${photoIndex + 1}/${photoTotal}`;
  }
  return undefined;
}

/** Centered dialog album view — matches trip/event detail modal pattern. */
export default function AlbumPhotosDialogLayout({
  visible,
  onClose,
  photoIndex = 0,
  photoTotal = 0,
  actions,
  heroOverlay,
  children,
  maxHeight = '85%',
  loading = false,
}: AlbumPhotosDialogLayoutProps) {
  const [contentWidth, setContentWidth] = useState(0);

  return (
    <AppModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.dialog, { maxHeight }]}>
          <DetailDialogHeader
            title="Photos"
            subtitle={loading ? undefined : buildPhotosHeaderSubtitle(photoIndex, photoTotal)}
            onClose={onClose}
          />
          {actions}
          <View
            style={styles.content}
            onLayout={(e) => {
              const w = Math.round(e.nativeEvent.layout.width);
              if (w > 0 && w !== contentWidth) setContentWidth(w);
            }}
          >
            <AlbumPhotosOverlayContext.Provider value={heroOverlay ?? null}>
              <AlbumPhotosPageWidthContext.Provider value={contentWidth > 0 ? contentWidth : null}>
                {children}
              </AlbumPhotosPageWidthContext.Provider>
            </AlbumPhotosOverlayContext.Provider>
          </View>
        </View>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.52)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  dialog: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    overflow: 'hidden',
  },
  content: {
    flexShrink: 1,
    minHeight: 0,
  },
});
