import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Text,
  PanResponder,
} from 'react-native';
import Video, { type OnLoadData, type OnProgressData, type VideoRef } from 'react-native-video';
import { Play, Pause, Volume2, VolumeX, Bookmark, Trash2 } from 'lucide-react-native';
import CachedImage from '../common/CachedImage';
import { isVideoMime } from '../../api/uploadLimits.api';
import type { MediaThumbnailItem } from './MediaThumbnail';
import colors from '../../theme/colors';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

function formatVideoTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type MediaPreviewOverlayProps = {
  visible: boolean;
  item: MediaThumbnailItem | null;
  bannerImageUrl?: string | null;
  onClose: () => void;
  onSetBanner?: (item: MediaThumbnailItem) => void;
  onDelete?: () => void;
  settingBanner?: boolean;
  deleting?: boolean;
};

export default function MediaPreviewOverlay({
  visible,
  item,
  bannerImageUrl,
  onClose,
  onSetBanner,
  onDelete,
  settingBanner,
  deleting,
}: MediaPreviewOverlayProps) {
  const videoRef = useRef<VideoRef>(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const seekTrackWidthRef = useRef(0);

  const isVideo = item ? isVideoMime(item.mimeType) : false;
  const uri = item?.localUri || item?.uri || '';
  const isBanner = !!bannerImageUrl && (uri === bannerImageUrl || item?.uri === bannerImageUrl);

  const handleSeek = useCallback((locationX: number) => {
    const w = seekTrackWidthRef.current;
    if (w <= 0 || duration <= 0) return;
    const ratio = Math.max(0, Math.min(1, locationX / w));
    const t = ratio * duration;
    videoRef.current?.seek(t);
    setCurrentTime(t);
  }, [duration]);

  const seekPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => handleSeek(evt.nativeEvent.locationX),
      onPanResponderMove: (evt) => handleSeek(evt.nativeEvent.locationX),
    }),
  ).current;

  if (!item) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        {onDelete && (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={onDelete}
            disabled={deleting}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Delete media"
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Trash2 size={20} color="#fff" />
            )}
          </TouchableOpacity>
        )}

        {onSetBanner && !isVideo && (
          <TouchableOpacity
            style={[styles.bannerBtn, isBanner && styles.bannerBtnActive]}
            onPress={() => onSetBanner(item)}
            disabled={settingBanner}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Set as banner"
          >
            {settingBanner ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Bookmark size={20} color="#fff" fill={isBanner ? colors.success : 'transparent'} />
            )}
          </TouchableOpacity>
        )}

        <View style={styles.content}>
          {isVideo ? (
            <>
              <Video
                ref={videoRef}
                source={{ uri }}
                style={styles.video}
                resizeMode="contain"
                paused={paused}
                muted={muted}
                controls={false}
                onLoad={(d: OnLoadData) => {
                  setDuration(d.duration);
                  setLoading(false);
                }}
                onProgress={(d: OnProgressData) => setCurrentTime(d.currentTime)}
                onEnd={() => setPaused(true)}
              />
              {loading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#fff" />
                </View>
              )}
              {!loading && (
                <View style={styles.videoControls}>
                  <TouchableOpacity onPress={() => setPaused((p) => !p)} hitSlop={8}>
                    {paused ? <Play size={22} color="#fff" fill="#fff" /> : <Pause size={22} color="#fff" fill="#fff" />}
                  </TouchableOpacity>
                  <Text style={styles.timeText}>{formatVideoTime(currentTime)}</Text>
                  <View
                    style={styles.seekTrack}
                    onLayout={(e) => { seekTrackWidthRef.current = e.nativeEvent.layout.width; }}
                    {...seekPanResponder.panHandlers}
                  >
                    <View style={[styles.seekFill, { width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }]} />
                  </View>
                  <Text style={styles.timeText}>{formatVideoTime(duration)}</Text>
                  <TouchableOpacity onPress={() => setMuted((m) => !m)} hitSlop={8}>
                    {muted ? <VolumeX size={20} color="#fff" /> : <Volume2 size={20} color="#fff" />}
                  </TouchableOpacity>
                </View>
              )}
            </>
          ) : (
            <CachedImage uri={uri} style={styles.photo} resizeMode="contain" />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 48,
    left: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bannerBtn: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerBtnActive: {
    backgroundColor: 'rgba(16,185,129,0.35)',
  },
  deleteBtn: {
    position: 'absolute',
    top: 48,
    right: 64,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 80,
    paddingBottom: 40,
  },
  photo: {
    width: SCREEN_W - 24,
    height: SCREEN_H * 0.65,
  },
  video: {
    width: SCREEN_W - 24,
    height: SCREEN_H * 0.55,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    paddingHorizontal: 8,
    width: '100%',
  },
  timeText: {
    color: '#fff',
    fontSize: 11,
    minWidth: 36,
    textAlign: 'center',
  },
  seekTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  seekFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
});
