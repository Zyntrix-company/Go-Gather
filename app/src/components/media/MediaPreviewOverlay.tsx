import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Text,
  PanResponder,
} from 'react-native';
import AppModal from '../common/AppModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import Video, { type OnLoadData, type OnProgressData, type VideoRef } from 'react-native-video';
import { Play, Pause, Volume2, VolumeX, Bookmark, Trash2, X } from 'lucide-react-native';
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

  const isVideo = item
    ? (isVideoMime(item.mimeType) || /\.(mp4|mov|m4v|mkv|webm|avi|3gp)(\?|$)/i.test(item.localUri || item.uri || ''))
    : false;
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

  const seekPanResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => handleSeek(evt.nativeEvent.locationX),
      onPanResponderMove: (evt) => handleSeek(evt.nativeEvent.locationX),
    }),
    [handleSeek],
  );

  if (!item) return null;

  const showBannerAction = !!onSetBanner && !isVideo;
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <AppModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView edges={['top']} style={styles.topSafe}>
          <View style={styles.toolbar}>
            <TouchableOpacity
              style={styles.toolbarClose}
              onPress={onClose}
              activeOpacity={0.75}
              accessibilityLabel="Close preview"
            >
              <X size={18} color="#f8fafc" strokeWidth={2.5} />
              <Text style={styles.toolbarCloseLabel}>Close</Text>
            </TouchableOpacity>

            {(showBannerAction || onDelete) && (
              <View style={styles.toolbarActions}>
                {showBannerAction && (
                  <TouchableOpacity
                    style={[styles.toolbarAction, isBanner && styles.toolbarActionActive]}
                    onPress={() => { if (!isBanner) onSetBanner(item); }}
                    disabled={settingBanner || isBanner}
                    activeOpacity={0.75}
                    accessibilityLabel="Set as banner"
                  >
                    {settingBanner ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Bookmark
                          size={17}
                          color={isBanner ? colors.success : '#fff'}
                          fill={isBanner ? colors.success : 'transparent'}
                        />
                        <Text style={[styles.toolbarActionLabel, isBanner && { color: colors.success }]}>
                          {isBanner ? 'Banner Image' : 'Set banner'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {onDelete && (
                  <TouchableOpacity
                    style={[styles.toolbarAction, styles.toolbarActionDanger]}
                    onPress={onDelete}
                    disabled={deleting}
                    activeOpacity={0.75}
                    accessibilityLabel="Delete media"
                  >
                    {deleting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Trash2 size={17} color="#fecaca" />
                        <Text style={[styles.toolbarActionLabel, styles.toolbarActionLabelDanger]}>
                          Delete
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </SafeAreaView>

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
                <SafeAreaView edges={['bottom']} style={styles.videoControlsWrap}>
                  <View style={styles.videoControls}>
                    <TouchableOpacity onPress={() => setPaused((p) => !p)} hitSlop={8}>
                      {paused ? <Play size={22} color="#fff" fill="#fff" /> : <Pause size={22} color="#fff" fill="#fff" />}
                    </TouchableOpacity>
                    <Text style={styles.timeText}>{formatVideoTime(currentTime)}</Text>
                    <View
                      style={styles.seekTrackHit}
                      onLayout={(e) => { seekTrackWidthRef.current = e.nativeEvent.layout.width; }}
                      {...seekPanResponder.panHandlers}
                    >
                      <View style={styles.seekTrack}>
                        <View
                          style={[styles.seekFill, { width: `${progressPct}%` }]}
                          pointerEvents="none"
                        />
                        <View
                          style={[styles.seekThumb, { left: `${progressPct}%` }]}
                          pointerEvents="none"
                        />
                      </View>
                    </View>
                    <Text style={styles.timeText}>{formatVideoTime(duration)}</Text>
                    <TouchableOpacity onPress={() => setMuted((m) => !m)} hitSlop={8}>
                      {muted ? <VolumeX size={20} color="#fff" /> : <Volume2 size={20} color="#fff" />}
                    </TouchableOpacity>
                  </View>
                </SafeAreaView>
              )}
            </>
          ) : (
            <CachedImage uri={uri} style={styles.photo} resizeMode="contain" />
          )}
        </View>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
  },
  topSafe: {
    backgroundColor: 'transparent',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
  },
  toolbarClose: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  toolbarCloseLabel: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '500',
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    justifyContent: 'flex-end',
  },
  toolbarAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  toolbarActionActive: {
    backgroundColor: 'rgba(16,185,129,0.22)',
    borderColor: 'rgba(16,185,129,0.45)',
  },
  toolbarActionDanger: {
    backgroundColor: 'rgba(239,68,68,0.18)',
    borderColor: 'rgba(239,68,68,0.35)',
  },
  toolbarActionLabel: {
    color: '#f1f5f9',
    fontSize: 13,
    fontWeight: '500',
  },
  toolbarActionLabelDanger: {
    color: '#fecaca',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  photo: {
    width: SCREEN_W - 16,
    maxWidth: SCREEN_W - 16,
    height: SCREEN_H * 0.8,
    maxHeight: SCREEN_H * 0.8,
  },
  video: {
    width: SCREEN_W - 16,
    maxWidth: SCREEN_W - 16,
    height: SCREEN_H * 0.72,
    maxHeight: SCREEN_H * 0.72,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoControlsWrap: {
    width: '100%',
    marginTop: 12,
  },
  videoControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(15,23,42,0.75)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  timeText: {
    color: '#fff',
    fontSize: 11,
    minWidth: 36,
    textAlign: 'center',
  },
  seekTrackHit: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 32,
    paddingVertical: 12,
  },
  seekTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2,
    overflow: 'visible',
    position: 'relative',
  },
  seekFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  seekThumb: {
    position: 'absolute',
    top: -4,
    width: 12,
    height: 12,
    marginLeft: -6,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: colors.accent,
  },
});
