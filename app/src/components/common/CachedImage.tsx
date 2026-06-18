import React, { useState, useEffect, useRef } from 'react';
import FastImage, { FastImageProps, ResizeMode } from '@d11/react-native-fast-image';
import { StyleProp, ImageStyle, type ViewProps, Animated, StyleSheet, View } from 'react-native';

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
  const [currentUri, setCurrentUri] = useState(uri);
  const [nextUri, setNextUri] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Track if this is a genuinely new image swap or just a re-render
  useEffect(() => {
    if (uri !== currentUri && uri !== nextUri) {
      if (!currentUri) {
        // Init state without crossfade
        setCurrentUri(uri);
      } else {
        // Schedule crossfade
        setNextUri(uri ?? null);
        fadeAnim.setValue(0);
      }
    }
  }, [uri, currentUri, nextUri, fadeAnim]);

  if (!currentUri && !nextUri) return null;

  const rm = typeof resizeMode === 'string' && resizeMode in RESIZE_MAP
    ? RESIZE_MAP[resizeMode]
    : (resizeMode as ResizeMode);

  // When wrapping FastImage in a container, we must pull out the layout constraints
  // from the style to apply them to the wrapper View, while keeping the absolute positioning
  // for the inner photos.
  const flatStyle = StyleSheet.flatten(style) || {};

  const renderFastImage = (imgUri: string, isNext: boolean) => {
    const source: FastImageProps['source'] = {
      uri: imgUri,
      priority: PRIORITY_MAP[priority] ?? FastImage.priority.normal,
      cache: FastImage.cacheControl.web,
    };

    return (
      <FastImage
        key={imgUri}
        source={source}
        style={StyleSheet.absoluteFillObject}
        resizeMode={rm}
        pointerEvents={pointerEvents}
        onLoad={() => {
          if (isNext && nextUri === imgUri) {
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 250,
              useNativeDriver: true,
            }).start(({ finished }) => {
              if (finished && nextUri === imgUri) {
                setCurrentUri(imgUri);
                setNextUri(null);
              }
            });
          }
          if (!isNext || nextUri === imgUri) onLoad?.();
        }}
        onLoadEnd={() => {
          if (!isNext || nextUri === imgUri) onLoadEnd?.();
        }}
        onError={() => {
          if (isNext && nextUri === imgUri) {
             // Fallback immediately if next image fails to load
             setCurrentUri(imgUri);
             setNextUri(null);
          }
          if (!isNext || nextUri === imgUri) onError?.();
        }}
      />
    );
  };

  return (
    <View style={[flatStyle, { overflow: 'hidden', position: 'relative' }]} pointerEvents={pointerEvents}>
      {/* Old image (base) */}
      {currentUri && renderFastImage(currentUri, false)}
      
      {/* New image fading in on top */}
      {nextUri && (
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: fadeAnim }]} pointerEvents="none">
          {renderFastImage(nextUri, true)}
        </Animated.View>
      )}
    </View>
  );
}
