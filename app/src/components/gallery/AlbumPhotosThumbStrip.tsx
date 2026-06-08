import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ListRenderItemInfo,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import CachedImage from '../common/CachedImage';
import { ALBUM_THUMB_H, ALBUM_THUMB_W, albumChromeStyles as acs } from '../../constants/albumPhotosLayout';

/** Thumb width + trailing gap — one snap slot per thumbnail. */
const THUMB_GAP = 6;
const THUMB_SLOT = ALBUM_THUMB_W + THUMB_GAP;
const THUMB_INNER_W = ALBUM_THUMB_W - 4;
const THUMB_INNER_H = ALBUM_THUMB_H - 4;

type ThumbPhoto = { id: string; uri?: string; localUri?: string };

/** Left inset for the thumb strip — thumbs start from the left edge. */
const STRIP_H_PAD = 12;

type AlbumPhotosThumbStripProps<T extends ThumbPhoto> = {
  photos: T[];
  heroIndex: number;
  onSelect: (index: number) => void;
  scrollEnabled?: boolean;
  renderOverlay?: (photo: T, index: number) => React.ReactNode;
  /** Transparent strip over app gradient (Gallery modals). */
  transparent?: boolean;
  galleryChrome?: boolean;
};

const AlbumStripThumb = React.memo(function AlbumStripThumb({
  photo,
  galleryChrome,
}: {
  photo: ThumbPhoto;
  galleryChrome?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [localUriFailed, setLocalUriFailed] = useState(false);
  const displayUri = (photo.localUri && !localUriFailed) ? photo.localUri : (photo.uri ?? '');
  const loadedUriRef = useRef<string | null>(null);

  const prevIdRef = useRef(photo.id);
  useEffect(() => {
    if (prevIdRef.current !== photo.id) {
      prevIdRef.current = photo.id;
      setLocalUriFailed(false);
      setFailed(false);
      setLoading(true);
      loadedUriRef.current = null;
    }
  }, [photo.id]);

  const prevDisplayUriRef = useRef(displayUri);
  useEffect(() => {
    if (prevDisplayUriRef.current === displayUri) return;
    prevDisplayUriRef.current = displayUri;
    if (loadedUriRef.current === displayUri) {
      setLoading(false);
      setFailed(false);
    } else {
      setLoading(true);
      setFailed(false);
    }
  }, [displayUri]);

  const markLoaded = useCallback(() => {
    if (!displayUri) return;
    loadedUriRef.current = displayUri;
    setLoading(false);
    setFailed(false);
  }, [displayUri]);

  const handleError = useCallback(() => {
    if (photo.localUri && !localUriFailed) {
      setLocalUriFailed(true);
      setLoading(true);
      setFailed(false);
    } else {
      setLoading(false);
      setFailed(true);
    }
  }, [photo.localUri, localUriFailed]);

  if (!displayUri || failed) {
    return (
      <View
        style={[
          styles.thumbInner,
          { backgroundColor: galleryChrome ? '#e2e8f0' : '#334155' },
        ]}
      />
    );
  }

  const showLoader = loading && loadedUriRef.current !== displayUri;

  return (
    <View style={styles.thumbInner} collapsable={false}>
      <CachedImage
        uri={displayUri}
        style={styles.thumbImage}
        resizeMode="cover"
        onLoad={markLoaded}
        onLoadEnd={markLoaded}
        onError={handleError}
      />
      {showLoader && (
        <View style={[styles.thumbLoader, galleryChrome && styles.thumbLoaderGallery]}>
          <ActivityIndicator size="small" color={galleryChrome ? '#0d9488' : '#5eead4'} />
        </View>
      )}
    </View>
  );
});

function preloadThumbPhotos(photos: ThumbPhoto[]) {
  const seen = new Set<string>();
  const sources: { uri: string; priority: typeof FastImage.priority.normal }[] = [];

  for (const photo of photos) {
    for (const uri of [photo.uri, photo.localUri]) {
      if (uri && !seen.has(uri)) {
        seen.add(uri);
        sources.push({ uri, priority: FastImage.priority.normal });
      }
    }
  }

  if (sources.length > 0) {
    FastImage.preload(sources);
  }
}

function nearestSnapOffset(offsetX: number, offsets: number[]): number {
  if (offsets.length === 0) return 0;
  let best = offsets[0];
  let bestDist = Math.abs(offsetX - best);
  for (let i = 1; i < offsets.length; i += 1) {
    const dist = Math.abs(offsetX - offsets[i]);
    if (dist < bestDist) {
      bestDist = dist;
      best = offsets[i];
    }
  }
  return best;
}

export default function AlbumPhotosThumbStrip<T extends ThumbPhoto>({
  photos,
  heroIndex,
  onSelect,
  scrollEnabled = true,
  renderOverlay,
  transparent = false,
  galleryChrome = false,
}: AlbumPhotosThumbStripProps<T>) {
  const stripRef = useRef<FlatList<T>>(null);
  const [stripWidth, setStripWidth] = useState(0);
  const photosKey = photos.map((p) => p.id).join('|');
  const contentWidth = STRIP_H_PAD * 2 + Math.max(0, (photos.length - 1) * THUMB_SLOT + ALBUM_THUMB_W);
  const maxScroll = Math.max(0, contentWidth - stripWidth);

  /** Left-aligned snap: thumb index i scrolls to i × slot width (no center padding). */
  const snapOffsets = useMemo(() => {
    if (stripWidth <= 0 || photos.length === 0) return [] as number[];
    return photos.map((_, index) => Math.min(maxScroll, Math.max(0, index * THUMB_SLOT)));
  }, [maxScroll, photos.length, stripWidth]);

  useEffect(() => {
    preloadThumbPhotos(photos);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- photosKey tracks photo list identity
  }, [photosKey]);

  const scrollStripToIndex = useCallback((index: number, animated: boolean) => {
    if (photos.length === 0 || index < 0 || stripWidth <= 0) return;
    const offset = snapOffsets[index];
    if (offset != null) {
      stripRef.current?.scrollToOffset({ offset, animated });
      return;
    }
    stripRef.current?.scrollToIndex({ index, viewPosition: 0, animated });
  }, [photos.length, snapOffsets, stripWidth]);

  useEffect(() => {
    if (photos.length === 0 || heroIndex < 0 || stripWidth <= 0) return;
    scrollStripToIndex(heroIndex, true);
  }, [heroIndex, photos.length, stripWidth, scrollStripToIndex]);

  const handleMomentumScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (snapOffsets.length === 0) return;
    const raw = e.nativeEvent.contentOffset.x;
    const snapped = nearestSnapOffset(raw, snapOffsets);
    if (Math.abs(snapped - raw) > 1) {
      stripRef.current?.scrollToOffset({ offset: snapped, animated: true });
    }
  }, [snapOffsets]);

  const renderItem = useCallback(({ item, index }: ListRenderItemInfo<T>) => {
    const selected = index === heroIndex;
    return (
      <View style={styles.thumbSlot} collapsable={false}>
        <TouchableOpacity
          onPress={() => onSelect(index)}
          activeOpacity={0.85}
          style={[
            styles.thumb,
            galleryChrome && styles.thumbGallery,
            selected ? styles.thumbSelected : styles.thumbUnselected,
          ]}
        >
          <AlbumStripThumb photo={item} galleryChrome={galleryChrome} />
        </TouchableOpacity>
        {renderOverlay?.(item, index)}
      </View>
    );
  }, [galleryChrome, heroIndex, onSelect, renderOverlay]);

  if (photos.length === 0) return null;

  return (
    <View
      style={[acs.thumbStrip, transparent && acs.thumbStripTransparent]}
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w > 0 && w !== stripWidth) setStripWidth(w);
      }}
    >
      <FlatList
        ref={stripRef}
        data={photos}
        horizontal
        scrollEnabled={scrollEnabled}
        showsHorizontalScrollIndicator={false}
        removeClippedSubviews={false}
        keyboardShouldPersistTaps="handled"
        decelerationRate="fast"
        snapToOffsets={snapOffsets.length > 0 ? snapOffsets : undefined}
        snapToAlignment="start"
        disableIntervalMomentum
        contentContainerStyle={{ paddingHorizontal: STRIP_H_PAD }}
        keyExtractor={(item) => item.id}
        getItemLayout={(_, index) => ({
          length: THUMB_SLOT,
          offset: THUMB_SLOT * index,
          index,
        })}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            stripRef.current?.scrollToIndex({
              index: info.index,
              viewPosition: 0,
              animated: false,
            });
          }, 50);
        }}
        renderItem={renderItem}
        extraData={heroIndex}
      />
    </View>
  );
}

/** Non-scroll column: hero flexes, thumbs + meta stay fixed height. */
export function AlbumPhotosBody({
  children,
  compact = false,
}: {
  children: React.ReactNode;
  compact?: boolean;
}) {
  return <View style={[styles.body, compact && styles.bodyCompact]}>{children}</View>;
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    overflow: 'hidden',
  },
  bodyCompact: {
    flex: 0,
  },
  thumbSlot: {
    width: THUMB_SLOT,
    position: 'relative',
  },
  thumb: {
    width: ALBUM_THUMB_W,
    height: ALBUM_THUMB_H,
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#334155',
  },
  thumbGallery: {
    backgroundColor: '#e2e8f0',
  },
  thumbUnselected: {
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbSelected: {
    borderWidth: 2,
    borderColor: '#0d9488',
  },
  thumbInner: {
    width: THUMB_INNER_W,
    height: THUMB_INNER_H,
    borderRadius: 6,
    overflow: 'hidden',
  },
  thumbImage: {
    width: THUMB_INNER_W,
    height: THUMB_INNER_H,
  },
  thumbLoader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.5)',
  },
  thumbLoaderGallery: {
    backgroundColor: 'rgba(248,250,252,0.6)',
  },
});
