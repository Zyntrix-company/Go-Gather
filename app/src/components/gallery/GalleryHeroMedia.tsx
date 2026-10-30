import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View, Text, Image, StyleSheet, ActivityIndicator, PanResponder, TouchableOpacity, Animated,
} from 'react-native';
import Video, { type OnLoadData, type OnProgressData, type VideoRef } from 'react-native-video';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react-native';
import CachedImage from '../common/CachedImage';
import { isVideoMime } from '../../api/uploadLimits.api';
import { ALBUM_HERO_RADIUS } from '../../constants/albumPhotosLayout';
import { useAlbumHeroScrollLock } from './AlbumPhotosContext';

export type GalleryHeroMediaItem = {
  id: string;
  uri: string;
  localUri?: string;
  mimeType?: string | null;
};

const MAX_ZOOM = 4;
const FIT_SCALE = 1.01;

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

function containBox(frameW: number, frameH: number, aspect: number) {
  if (frameW <= 0 || frameH <= 0 || !(aspect > 0)) return null;
  if (aspect > frameW / frameH) {
    const w = frameW;
    return { w, h: w / aspect };
  }
  const h = frameH;
  return { w: h * aspect, h };
}

function videoAspect(data: OnLoadData): number | null {
  const ns = data.naturalSize;
  if (!ns) return null;
  let w = ns.width;
  let h = ns.height;
  if (!(w > 0) || !(h > 0)) return null;
  if (ns.orientation === 'portrait' && w > h) {
    const swap = w;
    w = h;
    h = swap;
  } else if (ns.orientation === 'landscape' && h > w) {
    const swap = w;
    w = h;
    h = swap;
  }
  return w / h;
}

function touchDist(touches: { pageX: number; pageY: number }[]) {
  const dx = touches[0].pageX - touches[1].pageX;
  const dy = touches[0].pageY - touches[1].pageY;
  return Math.hypot(dx, dy);
}

type ZoomState = {
  scale: number;
  x: number;
  y: number;
  lastDist: number;
  lastX: number;
  lastY: number;
  lastMidX: number;
  lastMidY: number;
};

type GalleryHeroMediaProps = {
  photo: GalleryHeroMediaItem;
  /** When false, video playback pauses (carousel swiped away). */
  active?: boolean;
};

export default function GalleryHeroMedia({ photo, active = true }: GalleryHeroMediaProps) {
  const videoRef = useRef<VideoRef>(null);
  const setScrollLock = useAlbumHeroScrollLock();
  const [loading, setLoading] = useState(true);
  const [localUriFailed, setLocalUriFailed] = useState(false);
  const [paused, setPaused] = useState(!active);
  const [muted, setMuted] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [aspect, setAspect] = useState<number | null>(null);
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [zoomed, setZoomed] = useState(false);
  const seekTrackWidthRef = useRef(0);
  const controlsAnim = useRef(new Animated.Value(0)).current;
  const [controlsVisible, setControlsVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoomRef = useRef<ZoomState>({
    scale: 1, x: 0, y: 0, lastDist: 0, lastX: 0, lastY: 0, lastMidX: 0, lastMidY: 0,
  });
  const aspectRef = useRef<number | null>(null);
  const metricsRef = useRef({ frameW: 0, frameH: 0, containW: 0, containH: 0 });
  const gestureLockRef = useRef(false);
  const zoomedRef = useRef(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const transXAnim = useRef(new Animated.Value(0)).current;
  const transYAnim = useRef(new Animated.Value(0)).current;
  const apiRef = useRef({ active: true, lock: (_locked: boolean) => {} });
  const wasActiveRef = useRef(active);

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

  const applyZoom = useCallback(() => {
    const s = zoomRef.current;
    s.scale = Math.min(MAX_ZOOM, Math.max(1, s.scale));
    const { frameW, frameH, containW, containH } = metricsRef.current;
    const maxX = Math.max(0, (containW * s.scale - frameW) / 2);
    const maxY = Math.max(0, (containH * s.scale - frameH) / 2);
    s.x = Math.max(-maxX, Math.min(maxX, s.x));
    s.y = Math.max(-maxY, Math.min(maxY, s.y));
    scaleAnim.setValue(s.scale);
    transXAnim.setValue(s.x);
    transYAnim.setValue(s.y);
    const nextZoomed = s.scale > FIT_SCALE;
    if (nextZoomed !== zoomedRef.current) {
      zoomedRef.current = nextZoomed;
      setZoomed(nextZoomed);
    }
  }, [scaleAnim, transXAnim, transYAnim]);

  const noteLock = useCallback((twoFinger: boolean) => {
    const locked = twoFinger || zoomRef.current.scale > FIT_SCALE;
    if (locked === gestureLockRef.current) return;
    gestureLockRef.current = locked;
    if (!apiRef.current.active && locked) return;
    apiRef.current.lock(locked);
  }, []);

  const resetZoom = useCallback(() => {
    const s = zoomRef.current;
    s.scale = 1;
    s.x = 0;
    s.y = 0;
    s.lastDist = 0;
    scaleAnim.setValue(1);
    transXAnim.setValue(0);
    transYAnim.setValue(0);
    if (zoomedRef.current) {
      zoomedRef.current = false;
      setZoomed(false);
    }
    if (gestureLockRef.current) {
      gestureLockRef.current = false;
      apiRef.current.lock(false);
    }
  }, [scaleAnim, transXAnim, transYAnim]);

  apiRef.current = {
    active,
    lock: (locked: boolean) => {
      if (!active && locked) return;
      setScrollLock(photo.id, locked);
    },
  };

  const box = aspect != null ? containBox(frame.w, frame.h, aspect) : null;
  aspectRef.current = aspect;
  if (box) {
    metricsRef.current = { frameW: frame.w, frameH: frame.h, containW: box.w, containH: box.h };
  }

  React.useEffect(() => {
    applyZoom();
  }, [box?.w, box?.h, frame.w, frame.h, applyZoom]);

  React.useEffect(() => () => {
    setScrollLock(photo.id, false);
  }, [photo.id, setScrollLock]);

  React.useEffect(() => {
    if (wasActiveRef.current && !active) resetZoom();
    wasActiveRef.current = active;
  }, [active, resetZoom]);

  const prevId = useRef(photo.id);
  React.useEffect(() => {
    if (prevId.current !== photo.id) {
      prevId.current = photo.id;
      setLocalUriFailed(false);
      setLoading(true);
      setPaused(!active);
      setCurrentTime(0);
      setDuration(0);
      aspectRef.current = null;
      metricsRef.current = { frameW: 0, frameH: 0, containW: 0, containH: 0 };
      setAspect(null);
      resetZoom();
    }
  }, [photo.id, active, resetZoom]);

  React.useEffect(() => {
    if (!active) setPaused(true);
  }, [active]);

  React.useEffect(() => {
    if (isVideo || !uri) return undefined;
    let cancelled = false;
    Image.getSize(
      uri,
      (w, h) => {
        if (cancelled || !(w > 0) || !(h > 0)) return;
        const next = w / h;
        aspectRef.current = next;
        setAspect(next);
      },
      () => {},
    );
    return () => { cancelled = true; };
  }, [uri, isVideo]);

  const actionsRef = useRef({ applyZoom, noteLock, resetZoom });
  actionsRef.current = { applyZoom, noteLock, resetZoom };

  const zoomReady = () => aspectRef.current != null
    && metricsRef.current.containW > 0
    && metricsRef.current.containH > 0;

  const zoomPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: (e) => {
        if (!zoomReady() || e.nativeEvent.touches.length < 2) return false;
        actionsRef.current.noteLock(true);
        return true;
      },
      onMoveShouldSetPanResponderCapture: (e, g) => {
        if (!zoomReady()) return false;
        if (e.nativeEvent.touches.length >= 2) {
          actionsRef.current.noteLock(true);
          return true;
        }
        return zoomRef.current.scale > FIT_SCALE && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2);
      },
      onStartShouldSetPanResponder: (e) => {
        if (!zoomReady()) return false;
        if (e.nativeEvent.touches.length >= 2) return true;
        return zoomRef.current.scale > FIT_SCALE;
      },
      onMoveShouldSetPanResponder: (e, g) => {
        if (!zoomReady()) return false;
        if (e.nativeEvent.touches.length >= 2) return true;
        return zoomRef.current.scale > FIT_SCALE && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2);
      },
      onPanResponderTerminationRequest: () => (
        zoomRef.current.lastDist === 0 && zoomRef.current.scale <= FIT_SCALE
      ),
      onPanResponderGrant: (e) => {
        const touches = e.nativeEvent.touches;
        const s = zoomRef.current;
        if (touches.length >= 2) {
          s.lastDist = touchDist(touches);
          s.lastMidX = (touches[0].pageX + touches[1].pageX) / 2;
          s.lastMidY = (touches[0].pageY + touches[1].pageY) / 2;
          s.lastX = s.lastMidX;
          s.lastY = s.lastMidY;
          actionsRef.current.noteLock(true);
        } else {
          s.lastX = touches[0]?.pageX ?? 0;
          s.lastY = touches[0]?.pageY ?? 0;
          s.lastDist = 0;
        }
      },
      onPanResponderMove: (e) => {
        const touches = e.nativeEvent.touches;
        const s = zoomRef.current;
        if (touches.length >= 2) {
          const dist = touchDist(touches);
          const midX = (touches[0].pageX + touches[1].pageX) / 2;
          const midY = (touches[0].pageY + touches[1].pageY) / 2;
          if (s.lastDist > 0) {
            s.scale *= dist / s.lastDist;
            s.x += midX - s.lastMidX;
            s.y += midY - s.lastMidY;
          }
          s.lastDist = dist;
          s.lastMidX = midX;
          s.lastMidY = midY;
          s.lastX = midX;
          s.lastY = midY;
          actionsRef.current.applyZoom();
          actionsRef.current.noteLock(true);
        } else if (s.scale > FIT_SCALE) {
          const tx = touches[0]?.pageX ?? s.lastX;
          const ty = touches[0]?.pageY ?? s.lastY;
          s.x += tx - s.lastX;
          s.y += ty - s.lastY;
          s.lastX = tx;
          s.lastY = ty;
          s.lastDist = 0;
          actionsRef.current.applyZoom();
        }
      },
      onPanResponderRelease: () => {
        const s = zoomRef.current;
        s.lastDist = 0;
        if (s.scale <= FIT_SCALE) {
          s.scale = 1;
          s.x = 0;
          s.y = 0;
        }
        actionsRef.current.applyZoom();
        actionsRef.current.noteLock(false);
      },
      onPanResponderTerminate: () => {
        zoomRef.current.lastDist = 0;
        actionsRef.current.applyZoom();
        actionsRef.current.noteLock(false);
      },
    }),
  ).current;

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
  const fittedStyle = box ? {
    position: 'absolute' as const,
    width: box.w,
    height: box.h,
    left: (frame.w - box.w) / 2,
    top: (frame.h - box.h) / 2,
    transform: [
      { translateX: transXAnim },
      { translateY: transYAnim },
    ],
  } : styles.mediaFallback;
  const scaleStyle = {
    width: '100%' as const,
    height: '100%' as const,
    transform: [{ scale: scaleAnim }],
  };

  const mediaNode = isVideo ? (
    <Video
      ref={videoRef}
      source={{ uri }}
      style={styles.media}
      resizeMode="contain"
      paused={paused}
      muted={muted}
      controls={false}
      onLoad={(d: OnLoadData) => {
        const next = videoAspect(d);
        if (next) {
          aspectRef.current = next;
          setAspect(next);
        }
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
  ) : (
    <CachedImage
      uri={uri}
      style={styles.media}
      resizeMode="contain"
      blurUp
      onError={() => {
        if (photo.localUri && !localUriFailed) {
          setLocalUriFailed(true);
        }
      }}
    />
  );

  return (
    <View
      style={styles.frame}
      collapsable={false}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        const h = e.nativeEvent.layout.height;
        setFrame((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
      }}
    >
      <View
        style={styles.gestureLayer}
        {...zoomPanResponder.panHandlers}
        onTouchStart={(e) => {
          if (e.nativeEvent.touches.length >= 2 && zoomReady()) {
            actionsRef.current.noteLock(true);
          }
        }}
        onTouchEnd={(e) => {
          if (e.nativeEvent.touches.length < 2 && zoomRef.current.scale <= FIT_SCALE) {
            actionsRef.current.noteLock(false);
          }
        }}
        onTouchCancel={(e) => {
          if (e.nativeEvent.touches.length < 2 && zoomRef.current.scale <= FIT_SCALE) {
            actionsRef.current.noteLock(false);
          }
        }}
      >
        <Animated.View pointerEvents="none" style={fittedStyle}>
          {box ? (
            <Animated.View pointerEvents="none" style={scaleStyle}>
              {mediaNode}
            </Animated.View>
          ) : mediaNode}
        </Animated.View>
        {isVideo && !loading ? (
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            pointerEvents={zoomed ? 'none' : 'auto'}
            activeOpacity={1}
            onPress={() => showControls(paused)}
          />
        ) : null}
      </View>
      {isVideo && loading ? (
        <View style={styles.loader} pointerEvents="none">
          <ActivityIndicator size="large" color="#0d9488" />
        </View>
      ) : null}
      {isVideo && !loading ? (
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
      ) : null}
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
  gestureLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  mediaFallback: {
    ...StyleSheet.absoluteFillObject,
  },
  media: {
    width: '100%',
    height: '100%',
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    zIndex: 2,
  },
  videoControls: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    zIndex: 3,
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
