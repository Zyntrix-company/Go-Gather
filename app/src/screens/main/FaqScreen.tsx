import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import BlobBackground from '../../components/common/BlobBackground';
import Logo from '../../components/common/Logo';
import colors from '../../theme/colors';
import { GATHERGO_FAQS } from '../../content/faqs';

function FaqAccordion({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => setOpen((v) => !v)}
      style={styles.faqItem}>
      <View style={styles.faqRow}>
        <Text style={styles.faqQ}>{q}</Text>
        <View style={[styles.faqChevron, open && styles.faqChevronOpen]}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path d="M6 9l6 6 6-6" stroke={colors.accent} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
      </View>
      {open ? <Text style={styles.faqA}>{a}</Text> : null}
    </TouchableOpacity>
  );
}

export default function FaqScreen({ navigation }: { navigation: any }) {
  return (
    <BlobBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8} style={styles.logoBtn}>
            <Logo size="small" />
          </TouchableOpacity>
          <Text style={styles.title}>FAQ</Text>
          <Text style={styles.subtitle}>Common questions about GatherrGo</Text>

          <View style={styles.list}>
            {GATHERGO_FAQS.map((item) => (
              <FaqAccordion key={item.q} q={item.q} a={item.a} />
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </BlobBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  logoBtn: { alignSelf: 'flex-start', paddingTop: 8, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '500', color: colors.textPrimary, textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: 20 },
  list: { gap: 10 },
  faqItem: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  faqRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  faqQ: { fontSize: 13, fontWeight: '500', color: colors.textPrimary, flex: 1, lineHeight: 19 },
  faqChevron: {},
  faqChevronOpen: { transform: [{ rotate: '180deg' }] },
  faqA: { fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginTop: 10 },
});
