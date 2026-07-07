import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import AppScreenLayout, { TAB_BAR_SCROLL_PADDING } from '../../components/common/AppScreenLayout';
import colors from '../../theme/colors';

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

export default function ProfileScreen({ navigation }: { navigation: any }) {
  return (
    <AppScreenLayout navigation={navigation} title="Profile" onBack={() => navigation.goBack()}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: TAB_BAR_SCROLL_PADDING }]}
        showsVerticalScrollIndicator={false}>

        <View style={styles.card}>
          <Row
            label="Edit Profile"
            sub="Name, photo, bio, gender & more"
            onPress={() => navigation.navigate('EditProfile')}
          />
          <View style={styles.divider} />
          <Row
            label="Documents"
            sub="Your personal files & travel docs"
            onPress={() => navigation.navigate('PersonalDocuments')}
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
