import React from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import CachedImage from '../common/CachedImage';
import colors from '../../theme/colors';
import { isVideoMime } from '../../api/uploadLimits.api';

export type MediaThumbnailItem = {
  id: string;
  uri: string;
  localUri?: string;
  mimeType?: string | null;
};

type MediaThumbnailProps = {
  item: MediaThumbnailItem;
  size: number;
  layoutMode?: 'fixed' | 'fluid';
  bannerImageUrl?: string | null;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  onLongPress?: () => void;
  longPressDelay?: number;
  isActive?: boolean;
  disabled?: boolean;
  deleting?: boolean;
  imagePointerEvents?: 'auto' | 'none' | 'box-none';
};

function PlayIcon() {
  return (
    <View style={styles.playCircle}>
      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={11} fill="rgba(255,255,255,0.85)" />
        <Path d="M10 8l6 4-6 4V8z" fill="#0f172a" />
      </Svg>
    </View>
  );
}

export default function MediaThumbnail({
  item,
  size,
  layoutMode = 'fixed',
  bannerImageUrl,
  onPress,
  onPressIn,
  onPressOut,
  onLongPress,
  longPressDelay = 400,
  isActive,
  disabled,
  deleting,
  imagePointerEvents = 'auto',
}: MediaThumbnailProps) {
  const uri = item.localUri || item.uri;
  const isVideo = isVideoMime(item.mimeType);
  const isBanner = !!bannerImageUrl && (uri === bannerImageUrl || item.uri === bannerImageUrl);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onLongPress={onLongPress}
      delayLongPress={onLongPress ? longPressDelay : undefined}
      disabled={disabled}
      style={[
        styles.wrap,
        layoutMode === 'fluid'
          ? { width: '100%', aspectRatio: 1 / 0.82 }
          : { width: size, height: size * 0.82 },
        isActive && styles.active,
      ]}
    >
      <CachedImage
        uri={uri}
        style={styles.image}
        resizeMode="cover"
        pointerEvents={imagePointerEvents}
      />
      {isVideo && (
        <View style={styles.playOverlay} pointerEvents="none">
          <PlayIcon />
        </View>
      )}
      {isBanner && <View style={styles.bannerDot} pointerEvents="none" />}
      {deleting && (
        <View style={styles.deletingOverlay} pointerEvents="none">
          <ActivityIndicator size="small" color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
    flexShrink: 0,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  active: {
    opacity: 0.92,
    transform: [{ scale: 1.03 }],
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  playCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  deletingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
