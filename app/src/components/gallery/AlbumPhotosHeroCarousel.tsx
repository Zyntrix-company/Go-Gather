import React, { useState } from 'react';
import { View, Text, ActivityIndicator, FlatList, Dimensions, StyleSheet } from 'react-native';

const { width: SCREEN_W } = Dimensions.get('window');

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
}: AlbumPhotosHeroCarouselProps<T>) {
  const [heroH, setHeroH] = useState(0);

  return (
    <View
      style={styles.heroSlot}
      onLayout={(e) => {
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
          initialScrollIndex={Math.min(heroIndex, photos.length - 1)}
          getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
          onMomentumScrollEnd={(e) => onIndexChange(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
          renderItem={({ item }) => (
            <View style={{ width: SCREEN_W, height: heroH }}>
              {renderPhoto(item)}
            </View>
          )}
          keyExtractor={(item) => item.id}
        />
      ) : !loading ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>{emptyLabel}</Text>
        </View>
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },
});
