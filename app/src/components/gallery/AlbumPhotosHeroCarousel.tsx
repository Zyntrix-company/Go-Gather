import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { useAlbumPhotosOverlay, useAlbumPhotosPageWidth } from './AlbumPhotosContext';
import { ALBUM_HERO_H_PAD, ALBUM_HERO_RADIUS, GALLERY_HERO_CONTENT_MIN } from '../../constants/albumPhotosLayout';
import AlbumPhotosEmptyHero, { type AlbumEmptyVariant, type AlbumEmptyKind } from './AlbumPhotosEmptyHero';
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
  renderPhoto: (photo: T, index: number) => React.ReactNode;
  loading?: boolean;
  emptyLabel?: string;
  emptySubtitle?: string;
  emptyVariant?: AlbumEmptyVariant;
  emptyAlbumKind?: AlbumEmptyKind;
  emptyAlbumName?: string;
  emptyFriendName?: string;
  emptyLocationLabel?: string;
  onEmptyUpload?: () => void;
  /** Center rich empty state in available screen space (no photos). */
  emptyCentered?: boolean;
  scrollEnabled?: boolean;
  onPhotoPress?: (index: number) => void;
  /** Show gradient behind hero instead of solid dark (Gallery modals). */
  galleryChrome?: boolean;
  /** Fixed hero height (trip/event dialog) instead of flex-grow. */
  fixedHeight?: number;
  /** Transparent activity label strip at bottom of hero (gallery detail). */
  activityLabel?: string | null;
  /** Per-photo activity label — rendered inside each slide so it scrolls with the photo. */
  renderActivityLabel?: (item: T) => string | null;
  /** Show pager dots under hero (default true). */
  showPagerDots?: boolean;
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
  emptySubtitle,
  emptyVariant = 'simple',
  emptyAlbumKind = 'trip',
  emptyAlbumName,
  emptyFriendName,
  emptyLocationLabel,
  onEmptyUpload,
  emptyCentered = false,
  scrollEnabled = true,
  onPhotoPress,
  galleryChrome = false,
  fixedHeight,
  activityLabel,
  renderActivityLabel,
  showPagerDots = true,
}: AlbumPhotosHeroCarouselProps<T>) {
  const [heroH, setHeroH] = useState(fixedHeight ?? 0);
  const heroOverlay = useAlbumPhotosOverlay();
  const pageWidth = useAlbumPhotosPageWidth();
  const lightChrome = galleryChrome || fixedHeight != null;
  const rounded = fixedHeight != null;
  const richEmpty = !loading && photos.length === 0 && (emptyVariant === 'own' || emptyVariant === 'friend');
  const displayH = fixedHeight ?? heroH;

  useEffect(() => {
    if (fixedHeight != null && fixedHeight > 0) {
      setHeroH(fixedHeight);
    }
  }, [fixedHeight]);

  const slotStyle = richEmpty && emptyCentered
    ? [styles.heroSlot, styles.heroSlotEmptyCentered, galleryChrome && styles.heroSlotGallery]
    : fixedHeight != null
      ? [styles.heroSlot, styles.heroSlotFixed, { height: fixedHeight }, galleryChrome && styles.heroSlotGallery]
      : [styles.heroSlot, galleryChrome && styles.heroSlotGallery];

  const renderHeroPhoto = (item: T, index: number) => {
    const slideH = displayH > 0 ? displayH : GALLERY_HERO_CONTENT_MIN;
    const slideContentH = Math.max(0, slideH - 10);
    const slideContentW = Math.max(0, pageWidth - ALBUM_HERO_H_PAD * 2);
    const photo = renderPhoto(item, index);

    const activityText = renderActivityLabel ? renderActivityLabel(item) : null;
    const activityStripEl = activityText?.trim() ? (
      <View
        style={[styles.activityStrip, galleryChrome && styles.activityStripGallery]}
        pointerEvents="none"
      >
        <Text
          style={[styles.activityStripText, galleryChrome && styles.activityStripTextGallery]}
          numberOfLines={1}
        >
          {activityText}
        </Text>
      </View>
    ) : null;

    if (!rounded) {
      return (
        <TouchableOpacity
          style={{ width: pageWidth, height: slideH }}
          activeOpacity={0.95}
          onPress={() => onPhotoPress?.(index)}
          disabled={!onPhotoPress}
        >
          <View style={{ width: pageWidth, height: slideH }}>{photo}</View>
          {activityStripEl}
        </TouchableOpacity>
      );
    }

    const frameSize = { width: slideContentW, height: slideContentH };

    return (
      <TouchableOpacity
        style={[styles.heroSlideRounded, { width: pageWidth, height: slideH }]}
        activeOpacity={0.95}
        onPress={() => onPhotoPress?.(index)}
        disabled={!onPhotoPress}
      >
        {galleryChrome ? (
          <View style={[styles.heroFrameGallery, frameSize]}>
            {photo}
            {activityStripEl}
          </View>
        ) : (
          <View style={[styles.heroFrameOuter, frameSize]}>
            <View style={styles.heroFrameInner}>
              {photo}
              {activityStripEl}
            </View>
          </View>
        )}
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
      ) : photos.length > 0 ? (
        displayH > 0 ? (
        <FlatList
          ref={heroRef}
          style={{ height: displayH, width: '100%' }}
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
        ) : (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#5eead4" />
          </View>
        )
      ) : !loading && photos.length === 0 ? (
        <AlbumPhotosEmptyHero
          variant={emptyVariant}
          albumKind={emptyAlbumKind}
          albumName={emptyAlbumName}
          friendName={emptyFriendName}
          locationLabel={emptyLocationLabel}
          onUploadPress={onEmptyUpload}
          centered={emptyCentered}
          title={emptyLabel}
          subtitle={emptySubtitle}
          galleryChrome={galleryChrome}
        />
      ) : null}

      {heroOverlay ? (
        <View style={[styles.heroOverlay, rounded && styles.heroOverlayRounded]} pointerEvents="box-none">
          {heroOverlay}
        </View>
      ) : null}

      {/* Static activityLabel fallback — only used when renderActivityLabel is not provided */}
      {!renderActivityLabel && activityLabel?.trim() ? (
        <View
          style={[
            styles.activityStrip,
            rounded && styles.activityStripRounded,
            galleryChrome && styles.activityStripGallery,
          ]}
          pointerEvents="none"
        >
          <Text
            style={[styles.activityStripText, galleryChrome && styles.activityStripTextGallery]}
            numberOfLines={1}
          >
            {activityLabel}
          </Text>
        </View>
      ) : null}

      {showPagerDots && !loading && photos.length > 1 ? (
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
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  heroSlotEmptyCentered: {
    flex: 1,
    minHeight: 320,
    backgroundColor: 'transparent',
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
  heroFrameGallery: {
    borderRadius: ALBUM_HERO_RADIUS,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  heroFrameInner: {
    width: '100%',
    height: '100%',
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
  activityStrip: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(15,23,42,0.42)',
    zIndex: 8,
  },
  activityStripGallery: {
    backgroundColor: 'transparent',
  },
  activityStripRounded: {
    left: ALBUM_HERO_H_PAD,
    right: ALBUM_HERO_H_PAD,
    bottom: 6,
    borderBottomLeftRadius: ALBUM_HERO_RADIUS,
    borderBottomRightRadius: ALBUM_HERO_RADIUS,
  },
  activityStripText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.1,
  },
  activityStripTextGallery: {
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
