import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, PanResponder, TouchableOpacity, Animated,
} from 'react-native';
import Video, { type OnLoadData, type OnProgressData, type VideoRef } from 'react-native-video';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react-native';
import CachedImage from '../common/CachedImage';
import { isVideoMime } from '../../api/uploadLimits.api';
import { ALBUM_HERO_RADIUS } from '../../constants/albumPhotosLayout';

export type GalleryHeroMediaItem = {
  id: string;
  uri: string;
  localUri?: string;
  mimeType?: string | null;
};

function formatVideoTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function inferIsVideo(uri: string, mimeType?: string | null): boolean {
  if (isVideoMime(mimeType)) return true;
  return /\.(mp4|mov|m4v|webm)(\?|$)/i.test(uri);
}

type GalleryHeroMediaProps = {
  photo: GalleryHeroMediaItem;
  /** When false, video playback pauses (carousel swiped away). */
  active?: boolean;
};

export default function GalleryHeroMedia({ photo, active = true }: GalleryHeroMediaProps) {
  const videoRef = useRef<VideoRef>(null);
  const [loading, setLoading] = useState(true);
  const [localUriFailed, setLocalUriFailed] = useState(false);
  const [paused, setPaused] = useState(!active);
  const [muted, setMuted] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const seekTrackWidthRef = useRef(0);
  const controlsAnim = useRef(new Animated.Value(0)).current;
  const [controlsVisible, setControlsVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideControls = useCallback(() => {
    Animated.timing(controlsAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
      setControlsVisible(false);
    });
  }, [controlsAnim]);

  const showControls = useCallback((isPaused: boolean) => {
    setControlsVisible(true);
    Animated.timing(controlsAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (!isPaused) {
      hideTimerRef.current = setTimeout(hideControls, 3000);
    } else {
      hideTimerRef.current = null;
    }
  }, [controlsAnim, hideControls]);

  React.useEffect(() => () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  const uri = (photo.localUri && !localUriFailed) ? photo.localUri : photo.uri;
  const isVideo = inferIsVideo(uri, photo.mimeType);

  const prevId = useRef(photo.id);
  React.useEffect(() => {
    if (prevId.current !== photo.id) {
      prevId.current = photo.id;
      setLocalUriFailed(false);
      setLoading(true);
      setPaused(!active);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [photo.id, active]);

  React.useEffect(() => {
    if (!active) {
      setPaused(true);
    }
  }, [active]);

  const handleSeek = useCallback((locationX: number) => {
    const w = seekTrackWidthRef.current;
    if (w <= 0 || duration <= 0) return;
    const ratio = Math.max(0, Math.min(1, locationX / w));
    const t = ratio * duration;
    videoRef.current?.seek(t);
    setCurrentTime(t);
  }, [duration]);

  const seekPanResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => handleSeek(evt.nativeEvent.locationX),
      onPanResponderMove: (evt) => handleSeek(evt.nativeEvent.locationX),
    }),
    [handleSeek],
  );

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <View style={styles.frame}>
      {isVideo ? (
        <>
          <Video
            ref={videoRef}
            source={{ uri }}
            style={styles.media}
            resizeMode="contain"
            paused={paused}
            muted={muted}
            controls={false}
            onLoad={(d: OnLoadData) => {
              setDuration(d.duration);
              setLoading(false);
              showControls(!active);
            }}
            onProgress={(d: OnProgressData) => setCurrentTime(d.currentTime)}
            onEnd={() => { setPaused(true); showControls(true); }}
            onError={() => {
              if (photo.localUri && !localUriFailed) {
                setLocalUriFailed(true);
                setLoading(true);
              } else {
                setLoading(false);
              }
            }}
          />
          {loading && (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color="#0d9488" />
            </View>
          )}
          {!loading && (
            <>
              <TouchableOpacity
                style={StyleSheet.absoluteFillObject}
                onPress={() => showControls(paused)}
                activeOpacity={1}
              />
              <Animated.View
                style={[styles.videoControls, { opacity: controlsAnim }]}
                pointerEvents={controlsVisible ? 'box-none' : 'none'}
              >
                <TouchableOpacity onPress={() => { const willPause = !paused; setPaused(willPause); showControls(willPause); }} hitSlop={8} activeOpacity={0.8}>
                  {paused
                    ? <Play size={18} color="#fff" fill="#fff" />
                    : <Pause size={18} color="#fff" fill="#fff" />}
                </TouchableOpacity>
                <Text style={styles.timeText}>{formatVideoTime(currentTime)}</Text>
                <View
                  style={styles.seekTrackHit}
                  onLayout={(e) => { seekTrackWidthRef.current = e.nativeEvent.layout.width; }}
                  {...seekPanResponder.panHandlers}
                >
                  <View style={styles.seekTrack}>
                    <View style={[styles.seekFill, { width: `${progressPct}%` }]} pointerEvents="none" />
                  </View>
                </View>
                <Text style={styles.timeText}>{formatVideoTime(duration)}</Text>
                <TouchableOpacity onPress={() => { setMuted((m) => !m); showControls(paused); }} hitSlop={8} activeOpacity={0.8}>
                  {muted ? <VolumeX size={17} color="#fff" /> : <Volume2 size={17} color="#fff" />}
                </TouchableOpacity>
              </Animated.View>
            </>
          )}
        </>
      ) : (
        <>
          <CachedImage
            uri={uri}
            style={styles.media}
            resizeMode="cover"
            onLoad={() => setLoading(false)}
            onError={() => {
              if (photo.localUri && !localUriFailed) {
                setLocalUriFailed(true);
                setLoading(true);
              } else {
                setLoading(false);
              }
            }}
          />
          {loading && (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color="#0d9488" />
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
    borderRadius: ALBUM_HERO_RADIUS,
    overflow: 'hidden',
  },
  media: {
    width: '100%',
    height: '100%',
    borderRadius: ALBUM_HERO_RADIUS,
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  videoControls: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(15,23,42,0.62)',
  },
  timeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    minWidth: 28,
    textAlign: 'center',
  },
  seekTrackHit: {
    flex: 1,
    height: 24,
    justifyContent: 'center',
  },
  seekTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.28)',
    overflow: 'hidden',
  },
  seekFill: {
    height: '100%',
    backgroundColor: '#5eead4',
    borderRadius: 2,
  },
});
