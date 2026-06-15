import React from 'react';
import FastImage, { FastImageProps, ResizeMode } from '@d11/react-native-fast-image';
import { StyleProp, ImageStyle, type ViewProps } from 'react-native';

export type CachedImageProps = {
  uri: string | undefined | null;
  style?: StyleProp<ImageStyle>;
  resizeMode?: ResizeMode;
  /** Use 'high' for above-fold avatars, 'normal' for thumbnails (default) */
  priority?: 'low' | 'normal' | 'high';
  onLoad?: () => void;
  onLoadEnd?: () => void;
  onError?: () => void;
  pointerEvents?: ViewProps['pointerEvents'];
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
  onLoadEnd,
  onError,
  pointerEvents,
}: CachedImageProps) {
  if (!uri) return null;

  const source: FastImageProps['source'] = {
    uri,
    priority: PRIORITY_MAP[priority],
    // web = OS HTTP cache (NSURLSession/OkHttp). No in-session failedURLs blacklist unlike
    // immutable mode, so a URL that previously 403'd will be retried on next render.
    // CloudFront sets Cache-Control on responses; S3 objects carry it from upload time.
    cache: FastImage.cacheControl.web,
  };

  const rm = typeof resizeMode === 'string' && resizeMode in RESIZE_MAP
    ? RESIZE_MAP[resizeMode]
    : resizeMode;

  return (
    <FastImage
      source={source}
      style={style as FastImageProps['style']}
      resizeMode={rm}
      pointerEvents={pointerEvents}
      onLoad={onLoad}
      onLoadEnd={onLoadEnd}
      onError={onError}
    />
  );
}
