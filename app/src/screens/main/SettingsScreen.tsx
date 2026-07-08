import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AppScreenLayout, { TAB_BAR_SCROLL_PADDING } from '../../components/common/AppScreenLayout';
import colors from '../../theme/colors';
import useAuth from '../../hooks/useAuth';

function Chevron() {
  return (
    <Text style={styles.chevron}>›</Text>
  );
}

type RowProps = {
  label: string;
  sub?: string;
  onPress: () => void;
};

function SettingsRow({ label, sub, onPress }: RowProps) {
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

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export default function SettingsScreen({ navigation }: { navigation: any }) {
  const { refreshProfile } = useAuth();

  useFocusEffect(useCallback(() => { refreshProfile(); }, [])); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppScreenLayout navigation={navigation} title="Settings" onBack={() => navigation.goBack()}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: TAB_BAR_SCROLL_PADDING }]}
          showsVerticalScrollIndicator={false}>

          <SectionTitle>Account</SectionTitle>
          <View style={styles.card}>
            <SettingsRow
              label="Change password"
              sub="Update your sign-in password"
              onPress={() => navigation.navigate('ChangePassword')}
            />
            <View style={styles.divider} />
            <SettingsRow
              label="Connect to your mail"
              sub="Gmail or Outlook for importing travel docs"
              onPress={() => navigation.navigate('ConnectedEmail')}
            />
          </View>

          <SectionTitle>Notification preferences</SectionTitle>
          <View style={styles.card}>
            <SettingsRow
              label="Push & email preferences"
              sub="Reminders, quiet hours, and email digest"
              onPress={() => navigation.navigate('NotificationSettings')}
            />
          </View>
        </ScrollView>
    </AppScreenLayout>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 4 },

  sectionTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#0f172a',
    marginBottom: 8,
    marginLeft: 2,
  },
  card: {
   
    borderRadius: 14,
    paddingVertical: 4,
    marginBottom: 20,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  rowTextWrap: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: 15, fontWeight: '400', color: colors.textPrimary },
  rowSub: { fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 16 },
  chevron: { fontSize: 20, color: colors.textMuted, lineHeight: 22 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(148,163,184,0.12)', marginLeft: 14 },
});
