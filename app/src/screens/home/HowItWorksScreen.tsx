import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Polygon, Rect } from 'react-native-svg';
import { Plane, CalendarDays, Play, Pause, RotateCcw, Volume2, VolumeX } from 'lucide-react-native';
import Video, { type OnLoadData, type OnProgressData, type VideoRef } from 'react-native-video';
import BlobBackground from '../../components/common/BlobBackground';
import SweeIcon from '../../components/common/SweeIcon';
import colors from '../../theme/colors';
import { GATHERGO_FAQS } from '../../content/faqs';
import { FaqAccordionList } from '../../components/common/FaqAccordion';
import { API_BASE } from '../../api/client';

const { width: SCREEN_W } = Dimensions.get('window');
const CONTROLS_HIDE_MS = 6000;

function formatVideoTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type FeatureIconType = 'trips' | 'events' | 'expenses' | 'photos' | 'polls' | 'swee';

const FEATURE_COLORS: Record<FeatureIconType, string> = {
  trips: '#0d9488',    // teal — app brand accent
  events: '#f59e0b',   // amber — warning/events colour
  expenses: '#facc15', // bright yellow — split expenses
  photos: '#ef4444',   // red — share memories
  polls: '#3b82f6',    // blue — group polls
  swee: '#0d9488',     // teal — Swee AI uses brand accent
};

function FeatureIcon({ type }: { type: FeatureIconType }) {
  const size = 22;
  const color = FEATURE_COLORS[type];
  switch (type) {
    case 'trips':
      return <Plane size={size} color={color} strokeWidth={2} />;
    case 'events':
      return <CalendarDays size={size} color={color} strokeWidth={2} />;
    case 'expenses':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'photos':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x={3} y={3} width={18} height={18} rx={2} ry={2} stroke={color} strokeWidth={2} />
          <Circle cx={8.5} cy={8.5} r={1.5} fill={color} />
          <Path d="M21 15l-5-5L5 21" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'polls':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M18 20V10M12 20V4M6 20v-6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      );
    case 'swee':
      return <SweeIcon size={size} color={color} />;
    default:
      return null;
  }
}

export default function HowItWorksScreen({ navigation }: { navigation: any }) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState(false);
  /** After `/promo-video` fetch settles — avoids flashing "coming soon" while URL is still loading. */
  const [promoFetchDone, setPromoFetchDone] = useState(false);
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoPaused, setVideoPaused] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [showVideoControls, setShowVideoControls] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);

  const videoRef = useRef<VideoRef>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekTrackWidthRef = useRef(1);
  const videoDurationRef = useRef(0);

  const scheduleHideControls = useCallback(() => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowVideoControls(false), CONTROLS_HIDE_MS);
  }, []);

  const revealVideoControls = useCallback(() => {
    setShowVideoControls(true);
    scheduleHideControls();
  }, [scheduleHideControls]);

  const seekTo = useCallback((seconds: number) => {
    const clamped = Math.max(0, Math.min(videoDurationRef.current, seconds));
    setVideoCurrentTime(clamped);
    videoRef.current?.seek(clamped);
    revealVideoControls();
  }, [revealVideoControls]);

  const seekFromX = useCallback((x: number) => {
    const width = seekTrackWidthRef.current;
    if (width <= 0 || videoDurationRef.current <= 0) return;
    const ratio = Math.max(0, Math.min(1, x / width));
    seekTo(ratio * videoDurationRef.current);
  }, [seekTo]);

  const seekFromXRef = useRef(seekFromX);
  seekFromXRef.current = seekFromX;

  const seekPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        setIsSeeking(true);
        seekFromXRef.current(e.nativeEvent.locationX);
      },
      onPanResponderMove: (e) => seekFromXRef.current(e.nativeEvent.locationX),
      onPanResponderRelease: () => setIsSeeking(false),
      onPanResponderTerminate: () => setIsSeeking(false),
    }),
  ).current;

  const togglePlayPause = () => {
    setVideoPaused(p => !p);
    revealVideoControls();
  };

  const handleReplay = () => {
    seekTo(0);
    setVideoPaused(false);
    revealVideoControls();
  };

  const toggleMute = () => {
    setVideoMuted(m => !m);
    revealVideoControls();
  };

  const handleVideoLoad = (data: OnLoadData) => {
    setVideoLoading(false);
    setVideoDuration(data.duration);
    videoDurationRef.current = data.duration;
  };

  const handleVideoProgress = (data: OnProgressData) => {
    if (!isSeeking) setVideoCurrentTime(data.currentTime);
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/promo-video`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        if (cancelled) return;
        if (data?.videoUrl) {
          setVideoUrl(data.videoUrl);
          setVideoError(false);
        }
      })
      .catch(err => {
        console.warn('[HowItWorks] Failed to fetch promo video URL:', err?.message ?? err);
      })
      .finally(() => {
        if (!cancelled) setPromoFetchDone(true);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <BlobBackground>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M19 12H5M12 5l-7 7 7 7" stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>How it works?</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}>

          {/* Promotional / demo video — transparent tap layer above Video (native view steals touches) */}
          <View style={styles.videoWrap}>
            {videoUrl && !videoError ? (
              <>
                <Video
                  ref={videoRef}
                  key={videoUrl}
                  source={{ uri: videoUrl }}
                  style={styles.videoPlayer}
                  resizeMode="cover"
                  repeat
                  paused={videoPaused}
                  muted={videoMuted}
                  controls={false}
                  pointerEvents="none"
                  ignoreSilentSwitch="ignore"
                  playInBackground={false}
                  playWhenInactive={false}
                  progressUpdateInterval={250}
                  onLoad={handleVideoLoad}
                  onProgress={handleVideoProgress}
                  onEnd={() => {
                    setVideoCurrentTime(0);
                    setVideoPaused(false);
                  }}
                  onError={(err: any) => {
                    console.warn('[HowItWorks] Video load error:', JSON.stringify(err?.error ?? err));
                    setVideoLoading(false);
                    setVideoError(true);
                  }}
                />
                {videoLoading && (
                  <View style={[StyleSheet.absoluteFill, styles.videoLoadingOverlay]}>
                    <ActivityIndicator size="large" color="#fff" />
                  </View>
                )}
                {!videoLoading && !showVideoControls && (
                  <Pressable
                    style={styles.videoTapLayer}
                    onPress={revealVideoControls}
                    accessibilityRole="button"
                    accessibilityLabel="Show video controls"
                  />
                )}
                {showVideoControls && !videoLoading && (
                  <View style={styles.videoControlsBar} pointerEvents="box-none">
                    <View style={styles.videoControlsBarInner} pointerEvents="auto">
                      <View style={styles.videoControlsRow}>
                        <TouchableOpacity
                          onPress={handleReplay}
                          hitSlop={8}
                          accessibilityLabel="Replay from start">
                          <RotateCcw size={20} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={togglePlayPause}
                          hitSlop={8}
                          accessibilityLabel={videoPaused ? 'Play' : 'Pause'}>
                          {videoPaused ? (
                            <Play size={22} color="#fff" fill="#fff" />
                          ) : (
                            <Pause size={22} color="#fff" fill="#fff" />
                          )}
                        </TouchableOpacity>
                        <Text style={styles.videoTimeText}>{formatVideoTime(videoCurrentTime)}</Text>
                        <View
                          style={styles.videoSeekTrack}
                          onLayout={(e) => {
                            seekTrackWidthRef.current = e.nativeEvent.layout.width;
                          }}
                          {...seekPanResponder.panHandlers}>
                          <View
                            style={[
                              styles.videoSeekFill,
                              {
                                width: videoDuration > 0
                                  ? `${(videoCurrentTime / videoDuration) * 100}%`
                                  : '0%',
                              },
                            ]}
                          />
                          <View
                            style={[
                              styles.videoSeekThumb,
                              {
                                left: videoDuration > 0
                                  ? `${(videoCurrentTime / videoDuration) * 100}%`
                                  : '0%',
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.videoTimeText}>{formatVideoTime(videoDuration)}</Text>
                        <TouchableOpacity
                          onPress={toggleMute}
                          hitSlop={8}
                          accessibilityLabel={videoMuted ? 'Unmute' : 'Mute'}>
                          {videoMuted ? (
                            <VolumeX size={20} color="#fff" />
                          ) : (
                            <Volume2 size={20} color="#fff" />
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}
              </>
            ) : !promoFetchDone ? (
              <View style={styles.videoPlaceholder}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.videoLabel}>Loading video…</Text>
              </View>
            ) : (
              <View style={styles.videoPlaceholder}>
                <View style={styles.playBtn}>
                  <Svg width={24} height={24} viewBox="0 0 24 24">
                    <Polygon points="10,8 10,16 16,12" fill="#fff" />
                  </Svg>
                </View>
                <Text style={styles.videoLabel}>
                  {videoError ? 'Video unavailable — check your connection' : 'Demo video coming soon'}
                </Text>
              </View>
            )}
          </View>

          {/* About */}
          <View style={styles.card}>
            <View style={styles.cardIconRow}>
              <View style={styles.cardIcon}>
                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M9 22V12h6v10" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </View>
              <Text style={styles.cardTitle}>All your group experiences, in one place</Text>
            </View>
            <Text style={styles.cardBody}>
              GatherrGo is built for groups. Whether you're planning a weekend road trip, a destination wedding, or a birthday getaway — GatherrGo keeps everyone on the same page with shared itineraries, group chats, expense tracking, photo albums, and travel documents — all in one private space.
            </Text>
          </View>

          {/* Features */}
          <Text style={styles.sectionTitle}>Highlights</Text>
          <View style={styles.featuresGrid}>
            {[
              { icon: 'trips' as const, label: 'Plan Trips', desc: 'Create and manage group trips with full itineraries' },
              { icon: 'events' as const, label: 'Organise Events', desc: 'Birthdays, weddings, meetups — all in one place' },
              { icon: 'expenses' as const, label: 'Split Expenses', desc: 'Track who paid and settle up easily' },
              { icon: 'photos' as const, label: 'Share Memories', desc: 'Group photo albums everyone can add to' },
              { icon: 'polls' as const, label: 'Group Polls', desc: 'Vote on dates, venues, and plans together' },
              { icon: 'swee' as const, label: 'Ask Swee', desc: 'AI assistant for travel ideas and planning help' },
            ].map(f => (
              <View key={f.label} style={styles.featureCard}>
                <FeatureIcon type={f.icon} />
                <Text style={styles.featureLabel}>{f.label}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            ))}
          </View>

          {/* FAQs */}
          <Text style={styles.sectionTitle}>FAQs</Text>
          <FaqAccordionList items={GATHERGO_FAQS} />

          

        </ScrollView>
      </BlobBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16, fontWeight: '600', color: colors.textPrimary,
  },

  scroll: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 20,
  },

  // Video
  videoWrap: { borderRadius: 16, overflow: 'hidden', position: 'relative' },
  videoTapLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    elevation: 2,
  },
  videoPlayer: {
    width: '100%',
    height: SCREEN_W * 0.56,
    backgroundColor: '#000',
    borderRadius: 16,
  },
  videoLoadingOverlay: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlaceholder: {
    width: '100%',
    height: SCREEN_W * 0.56,
    backgroundColor: '#0f2027',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    borderRadius: 16,
  },
  playBtn: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  videoLabel: {
    fontSize: 13, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.2,
  },
  videoControlsBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3,
    elevation: 3,
  },
  videoControlsBarInner: {
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  videoControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  videoTimeText: {
    fontSize: 11,
    color: '#fff',
    fontVariant: ['tabular-nums'],
    minWidth: 32,
  },
  videoSeekTrack: {
    flex: 1,
    height: 22,
    justifyContent: 'center',
    borderRadius: 4,
  },
  videoSeekFill: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  videoSeekThumb: {
    position: 'absolute',
    width: 12,
    height: 12,
    marginLeft: -6,
    top: 5,
    borderRadius: 6,
    backgroundColor: '#fff',
  },

  // About card
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  cardIconRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  cardBody: { fontSize: 13, color: colors.textSecondary, lineHeight: 21 },

  // Section title
  sectionTitle: {
    fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 4,
  },

  // Features grid
  featuresGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  featureCard: {
    width: (SCREEN_W - 32 - 10) / 2,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  featureLabel: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginTop: 6 },
  featureDesc: { fontSize: 12, color: colors.textSecondary, lineHeight: 21 },

  // Footer
  footerNote: { alignItems: 'center', paddingTop: 4 },
  footerText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
});
