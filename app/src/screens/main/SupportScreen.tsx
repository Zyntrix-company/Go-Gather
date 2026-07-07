import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import AppScreenLayout, { TAB_BAR_SCROLL_PADDING } from '../../components/common/AppScreenLayout';
import colors from '../../theme/colors';
import { showAlert } from '../../store/alertStore';

function Chevron() {
  return <Text style={styles.chevron}>›</Text>;
}

function Row({ label, sub, onPress }: { label: string; sub?: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.rowTextWrap}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      <Chevron />
    </TouchableOpacity>
  );
}

export default function SupportScreen({ navigation }: { navigation: any }) {
  const comingSoon = (title: string) =>
    showAlert({ title, message: 'This feature is coming soon.', buttons: [{ text: 'OK' }] });

  return (
    <AppScreenLayout navigation={navigation} title="Support" onBack={() => navigation.goBack()}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: TAB_BAR_SCROLL_PADDING }]}
        showsVerticalScrollIndicator={false}>

        <View style={styles.card}>
          <Row
            label="How it works"
            sub="Video, highlights & FAQs"
            onPress={() => navigation.navigate('HowItWorks')}
          />
          <View style={styles.divider} />
          <Row
            label="Help Center"
            sub="Guides & articles"
            onPress={() => comingSoon('Help Center')}
          />
          <View style={styles.divider} />
          <Row
            label="Report a Problem"
            sub="Tell us what went wrong"
            onPress={() => comingSoon('Report a Problem')}
          />
        </View>
      </ScrollView>
    </AppScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 8 },
  card: { borderRadius: 14, paddingVertical: 4, marginBottom: 20, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, gap: 12 },
  rowTextWrap: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: 15, fontWeight: '400', color: colors.textPrimary },
  rowSub: { fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 16 },
  chevron: { fontSize: 20, color: colors.textMuted, lineHeight: 22 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(148,163,184,0.12)', marginLeft: 14 },
});
