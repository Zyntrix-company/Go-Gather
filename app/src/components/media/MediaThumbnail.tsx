import React from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
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
  bannerImageUrl?: string | null;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Separate long-press handler when drag also uses long press (shows delete confirm). */
  onLongPressDelete?: () => void;
  isActive?: boolean;
  deleting?: boolean;
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
  bannerImageUrl,
  onPress,
  onLongPress,
  onLongPressDelete,
  isActive,
  deleting,
}: MediaThumbnailProps) {
  const uri = item.localUri || item.uri;
  const isVideo = isVideoMime(item.mimeType);
  const isBanner = !!bannerImageUrl && (uri === bannerImageUrl || item.uri === bannerImageUrl);

  const handleLongPress = () => {
    if (onLongPressDelete) {
      onLongPressDelete();
      return;
    }
    onLongPress?.();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      onLongPress={onLongPress ? onLongPress : onLongPressDelete ? handleLongPress : undefined}
      delayLongPress={onLongPress ? 200 : 400}
      style={[
        styles.wrap,
        { width: size, height: size * 0.82 },
        isActive && styles.active,
      ]}
    >
      <CachedImage uri={uri} style={styles.image} resizeMode="cover" />
      {isVideo && (
        <View style={styles.playOverlay}>
          <PlayIcon />
        </View>
      )}
      {isBanner && <View style={styles.bannerDot} />}
      {deleting && (
        <View style={styles.deletingOverlay}>
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
  },
  image: {
    width: '100%',
    height: '100%',
  },
  active: {
    opacity: 0.85,
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
