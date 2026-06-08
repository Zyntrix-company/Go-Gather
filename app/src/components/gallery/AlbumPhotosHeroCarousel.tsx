import React, { useState } from 'react';
import { View, Text, ActivityIndicator, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { useAlbumPhotosOverlay, useAlbumPhotosPageWidth } from './AlbumPhotosContext';
import { ALBUM_HERO_H_PAD, ALBUM_HERO_RADIUS } from '../../constants/albumPhotosLayout';
const MAX_DOTS = 15;

function AlbumPhotosPagerDots({
  count,
  activeIndex,
  galleryChrome = false,
  rounded = false,
}: {
  count: number;
  activeIndex: number;
  galleryChrome?: boolean;
  rounded?: boolean;
}) {
  if (count <= 1) return null;

  const wrapStyle = [styles.dotsWrap, rounded && styles.dotsWrapRounded];

  if (count > MAX_DOTS) {
    return (
      <View style={wrapStyle} pointerEvents="none">
        <View style={styles.dotsPill}>
          <Text style={[styles.dotsPillText, galleryChrome && styles.dotsPillTextGallery]}>
            {activeIndex + 1} / {count}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={wrapStyle} pointerEvents="none">
      <View style={styles.dotsRow}>
        {Array.from({ length: count }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              galleryChrome ? styles.dotGallery : styles.dotDark,
              i === activeIndex && (galleryChrome ? styles.dotActiveGallery : styles.dotActiveDark),
            ]}
          />
        ))}
      </View>
    </View>
  );
}

export type AlbumHeroPhoto = { id: string };

type AlbumPhotosHeroCarouselProps<T extends AlbumHeroPhoto> = {
  photos: T[];
  heroIndex: number;
  onIndexChange: (index: number) => void;
  heroRef?: React.RefObject<FlatList<T> | null>;
  renderPhoto: (photo: T) => React.ReactNode;
  loading?: boolean;
  emptyLabel?: string;
  scrollEnabled?: boolean;
  onPhotoPress?: (index: number) => void;
  /** Show gradient behind hero instead of solid dark (Gallery modals). */
  galleryChrome?: boolean;
  /** Fixed hero height (trip/event dialog) instead of flex-grow. */
  fixedHeight?: number;
};

/** Flex-grow hero pager — height follows available space (no fixed % of screen). */
export default function AlbumPhotosHeroCarousel<T extends AlbumHeroPhoto>({
  photos,
  heroIndex,
  onIndexChange,
  heroRef,
  renderPhoto,
  loading = false,
  emptyLabel = 'No photos yet',
  scrollEnabled = true,
  onPhotoPress,
  galleryChrome = false,
  fixedHeight,
}: AlbumPhotosHeroCarouselProps<T>) {
  const [heroH, setHeroH] = useState(fixedHeight ?? 0);
  const heroOverlay = useAlbumPhotosOverlay();
  const pageWidth = useAlbumPhotosPageWidth();
  const lightChrome = galleryChrome || fixedHeight != null;
  const rounded = fixedHeight != null;
  const slotStyle = fixedHeight != null
    ? [styles.heroSlot, styles.heroSlotFixed, { height: fixedHeight }, galleryChrome && styles.heroSlotGallery]
    : [styles.heroSlot, galleryChrome && styles.heroSlotGallery];

  const renderHeroPhoto = (item: T, index: number) => {
    const photo = renderPhoto(item);
    if (!rounded) {
      return (
        <TouchableOpacity
          style={{ width: pageWidth, height: heroH }}
          activeOpacity={0.95}
          onPress={() => onPhotoPress?.(index)}
          disabled={!onPhotoPress}
        >
          {photo}
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.heroSlideRounded, { width: pageWidth, height: heroH }]}
        activeOpacity={0.95}
        onPress={() => onPhotoPress?.(index)}
        disabled={!onPhotoPress}
      >
        <View style={styles.heroFrameOuter}>
          <View style={styles.heroFrameInner}>{photo}</View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={slotStyle}
      onLayout={fixedHeight != null ? undefined : (e) => {
        const h = Math.round(e.nativeEvent.layout.height);
        if (h > 0 && h !== heroH) setHeroH(h);
      }}
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#5eead4" />
        </View>
      ) : photos.length > 0 && heroH > 0 ? (
        <FlatList
          ref={heroRef}
          data={photos}
          horizontal
          pagingEnabled
          scrollEnabled={scrollEnabled}
          showsHorizontalScrollIndicator={false}
          removeClippedSubviews={false}
          windowSize={Math.min(photos.length, 5) + 2}
          initialScrollIndex={Math.min(heroIndex, photos.length - 1)}
          getItemLayout={(_, index) => ({ length: pageWidth, offset: pageWidth * index, index })}
          onMomentumScrollEnd={(e) => onIndexChange(Math.round(e.nativeEvent.contentOffset.x / pageWidth))}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              heroRef?.current?.scrollToIndex({ index: info.index, animated: false });
            }, 50);
          }}
          extraData={heroIndex}
          renderItem={({ item, index }) => renderHeroPhoto(item, index)}
          keyExtractor={(item) => item.id}
        />
      ) : !loading ? (
        <View style={styles.center}>
          <Text style={lightChrome ? styles.emptyText : styles.emptyTextDark}>{emptyLabel}</Text>
        </View>
      ) : null}

      {heroOverlay ? (
        <View style={[styles.heroOverlay, rounded && styles.heroOverlayRounded]} pointerEvents="box-none">
          {heroOverlay}
        </View>
      ) : null}

      {!loading && photos.length > 1 ? (
        <AlbumPhotosPagerDots
          count={photos.length}
          activeIndex={heroIndex}
          galleryChrome={lightChrome}
          rounded={rounded}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  heroSlot: {
    flex: 1,
    minHeight: 100,
    backgroundColor: '#0f172a',
    overflow: 'hidden',
  },
  heroSlotFixed: {
    flex: 0,
    minHeight: undefined,
    backgroundColor: '#f1f5f9',
    overflow: 'visible',
  },
  heroSlideRounded: {
    paddingHorizontal: ALBUM_HERO_H_PAD,
    paddingTop: 4,
    paddingBottom: 6,
  },
  heroFrameOuter: {
    flex: 1,
    borderRadius: ALBUM_HERO_RADIUS,
    backgroundColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  heroFrameInner: {
    flex: 1,
    borderRadius: ALBUM_HERO_RADIUS,
    overflow: 'hidden',
  },
  heroSlotGallery: {
    backgroundColor: 'transparent',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: 'rgba(15,23,42,0.45)',
    fontSize: 12,
  },
  emptyTextDark: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },
  heroOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
  },
  heroOverlayRounded: {
    top: 16,
    right: ALBUM_HERO_H_PAD + 12,
  },
  dotsWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 10,
    alignItems: 'center',
    zIndex: 9,
  },
  dotsWrapRounded: {
    bottom: 16,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dotDark: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotGallery: {
    backgroundColor: 'rgba(15,23,42,0.25)',
  },
  dotActiveDark: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#fff',
  },
  dotActiveGallery: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#0d9488',
  },
  dotsPill: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  dotsPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  dotsPillTextGallery: {
    color: '#0f172a',
  },
});
