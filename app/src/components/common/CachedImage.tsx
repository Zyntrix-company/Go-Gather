import React from 'react';
import FastImage, { FastImageProps, ResizeMode } from '@d11/react-native-fast-image';
import { StyleProp, ImageStyle } from 'react-native';

export type CachedImageProps = {
  uri: string | undefined | null;
  style?: StyleProp<ImageStyle>;
  resizeMode?: ResizeMode;
  /** Use 'high' for above-fold avatars, 'normal' for thumbnails (default) */
  priority?: 'low' | 'normal' | 'high';
  onLoad?: () => void;
  onError?: () => void;
};

const PRIORITY_MAP = {
  low: FastImage.priority.low,
  normal: FastImage.priority.normal,
  high: FastImage.priority.high,
};

const RESIZE_MAP: Record<string, ResizeMode> = {
  cover: FastImage.resizeMode.cover,
  contain: FastImage.resizeMode.contain,
  stretch: FastImage.resizeMode.stretch,
  center: FastImage.resizeMode.center,
};

export default function CachedImage({
  uri,
  style,
  resizeMode = FastImage.resizeMode.cover,
  priority = 'normal',
  onLoad,
  onError,
}: CachedImageProps) {
  if (!uri) return null;

  const source: FastImageProps['source'] = {
    uri,
    priority: PRIORITY_MAP[priority],
    cache: FastImage.cacheControl.immutable,
  };

  const rm = typeof resizeMode === 'string' && resizeMode in RESIZE_MAP
    ? RESIZE_MAP[resizeMode]
    : resizeMode;

  return (
    <FastImage
      source={source}
      style={style as FastImageProps['style']}
      resizeMode={rm}
      onLoad={onLoad}
      onError={onError}
    />
  );
}
