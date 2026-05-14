import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Polygon } from 'react-native-svg';
import Video from 'react-native-video';
import BlobBackground from '../../components/common/BlobBackground';
import colors from '../../theme/colors';
import { GATHERGO_FAQS } from '../../content/faqs';
import { API_BASE } from '../../api/client';

const { width: SCREEN_W } = Dimensions.get('window');

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => setOpen(v => !v)}
      style={styles.faqItem}>
      <View style={styles.faqRow}>
        <Text style={styles.faqQ}>{q}</Text>
        <View style={[styles.faqChevron, open && styles.faqChevronOpen]}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path d="M6 9l6 6 6-6" stroke={colors.accent} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
      </View>
      {open && <Text style={styles.faqA}>{a}</Text>}
    </TouchableOpacity>
  );
}

export default function HowItWorksScreen({ navigation }: { navigation: any }) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/promo-video`)
      .then(r => r.json())
      .then(data => { if (data?.videoUrl) setVideoUrl(data.videoUrl); })
      .catch(() => {});
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
          <Text style={styles.headerTitle}>How it works</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}>

          {/* Promotional / demo video */}
          <View style={styles.videoWrap}>
            {videoUrl && !videoError ? (
              <Video
                source={{ uri: videoUrl }}
                style={styles.videoPlayer}
                resizeMode="cover"
                muted
                repeat
                paused={false}
                controls={false}
                ignoreSilentSwitch="ignore"
                playInBackground={false}
                playWhenInactive={false}
                onError={() => setVideoError(true)}
                bufferConfig={{
                  minBufferMs: 2500,
                  maxBufferMs: 50000,
                  bufferForPlaybackMs: 2500,
                  bufferForPlaybackAfterRebufferMs: 5000,
                }}
              />
            ) : (
              <View style={styles.videoPlaceholder}>
                <View style={styles.playBtn}>
                  <Svg width={24} height={24} viewBox="0 0 24 24">
                    <Polygon points="10,8 10,16 16,12" fill="#fff" />
                  </Svg>
                </View>
                <Text style={styles.videoLabel}>Demo video coming soon</Text>
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
              <Text style={styles.cardTitle}>All your group travel, in one place</Text>
            </View>
            <Text style={styles.cardBody}>
              GatherGo is built for groups. Whether you're planning a weekend road trip, a destination wedding, or a birthday getaway — GatherGo keeps everyone on the same page with shared itineraries, group chats, expense tracking, photo albums, and travel documents — all in one private space.
            </Text>
          </View>

          {/* Features */}
          <Text style={styles.sectionTitle}>What you can do</Text>
          <View style={styles.featuresGrid}>
            {[
              { icon: '✈️', label: 'Plan Trips', desc: 'Create and manage group trips with full itineraries' },
              { icon: '🎉', label: 'Organise Events', desc: 'Birthdays, weddings, meetups — all in one place' },
              { icon: '💸', label: 'Split Expenses', desc: 'Track who paid and settle up easily' },
              { icon: '📸', label: 'Share Memories', desc: 'Group photo albums everyone can add to' },
              { icon: '💬', label: 'Group Chat', desc: 'One dedicated chat per trip or event' },
              { icon: '🤖', label: 'Ask Swee', desc: 'AI assistant for travel ideas and planning help' },
            ].map(f => (
              <View key={f.label} style={styles.featureCard}>
                <Text style={styles.featureEmoji}>{f.icon}</Text>
                <Text style={styles.featureLabel}>{f.label}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            ))}
          </View>

          {/* FAQs */}
          <Text style={styles.sectionTitle}>Frequently asked questions</Text>
          <View style={styles.faqList}>
            {GATHERGO_FAQS.map(item => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </View>

          

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
  videoWrap: { borderRadius: 16, overflow: 'hidden' },
  videoPlayer: {
    width: '100%',
    height: SCREEN_W * 0.56,
    backgroundColor: '#000',
    borderRadius: 16,
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
    fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: -8,
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
  featureEmoji: { fontSize: 22 },
  featureLabel: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginTop: 2 },
  featureDesc: { fontSize: 11, color: colors.textSecondary, lineHeight: 16 },

  // FAQ
  faqList: { gap: 8 },
  faqItem: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  faqRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  faqQ: { fontSize: 13, fontWeight: '500', color: colors.textPrimary, flex: 1, lineHeight: 19 },
  faqChevron: { opacity: 1 },
  faqChevronOpen: { transform: [{ rotate: '180deg' }] },
  faqA: { fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginTop: 10 },

  // Footer
  footerNote: { alignItems: 'center', paddingTop: 4 },
  footerText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
});
