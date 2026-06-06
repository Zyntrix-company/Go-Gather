import React from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import CachedImage from '../common/CachedImage';
import { ALBUM_THUMB_H, ALBUM_THUMB_W, albumChromeStyles as acs } from '../../constants/albumPhotosLayout';

type ThumbPhoto = { id: string; uri?: string; localUri?: string };

type AlbumPhotosThumbStripProps<T extends ThumbPhoto> = {
  photos: T[];
  heroIndex: number;
  onSelect: (index: number) => void;
  scrollEnabled?: boolean;
  renderOverlay?: (photo: T, index: number) => React.ReactNode;
};

export default function AlbumPhotosThumbStrip<T extends ThumbPhoto>({
  photos,
  heroIndex,
  onSelect,
  scrollEnabled = true,
  renderOverlay,
}: AlbumPhotosThumbStripProps<T>) {
  if (photos.length === 0) return null;

  return (
    <View style={acs.thumbStrip}>
      <ScrollView
        horizontal
        scrollEnabled={scrollEnabled}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {photos.map((ph, idx) => {
          const thumbUri = ph.localUri ?? ph.uri ?? '';
          const selected = idx === heroIndex;
          return (
            <View key={ph.id} style={styles.thumbWrap}>
              <TouchableOpacity
                onPress={() => onSelect(idx)}
                activeOpacity={0.85}
                style={[styles.thumb, selected && styles.thumbSelected]}
              >
                <CachedImage uri={thumbUri} style={StyleSheet.absoluteFill} resizeMode="cover" />
              </TouchableOpacity>
              {renderOverlay?.(ph, idx)}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Non-scroll column: hero flexes, thumbs + meta stay fixed height. */
export function AlbumPhotosBody({ children }: { children: React.ReactNode }) {
  return <View style={styles.body}>{children}</View>;
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: 12,
    gap: 6,
    flexDirection: 'row',
  },
  thumbWrap: {
    position: 'relative',
  },
  thumb: {
    width: ALBUM_THUMB_W,
    height: ALBUM_THUMB_H,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
  },
  thumbSelected: {
    borderWidth: 2,
    borderColor: '#0d9488',
  },
});
