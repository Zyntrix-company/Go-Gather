import React, { useEffect } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import AppScreenLayout, { TAB_BAR_SCROLL_PADDING } from '../../components/common/AppScreenLayout';
import useNotificationSettingsStore from '../../store/notificationSettingsStore';
import { NotificationSettings } from '../../api/notificationSettings.api';
import colors from '../../theme/colors';

const DIGEST_OPTIONS: { label: string; value: NotificationSettings['email_digest'] }[] = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Never', value: 'never' },
];

export default function NotificationSettingsScreen({ navigation }: any) {
  const { settings, loading, error, fetchSettings, updateSettings } =
    useNotificationSettingsStore();

  useEffect(() => {
    fetchSettings();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (key: keyof NotificationSettings, value: boolean) => {
    updateSettings({ [key]: value } as Partial<NotificationSettings>);
  };

  return (
    <AppScreenLayout navigation={navigation} title="Notification Preferences" onBack={() => navigation.goBack()}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: TAB_BAR_SCROLL_PADDING }]}
        showsVerticalScrollIndicator={false}>

        {loading && !settings && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        )}

        {error && !settings && (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={fetchSettings} style={styles.retryBtn} activeOpacity={0.8}>
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {settings && (
          <>
            <Text style={styles.sectionTitle}>Push Reminders</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.rowTextWrap}>
                  <Text style={styles.rowLabel}>Activity Reminders</Text>
                  <Text style={styles.rowSub}>Get reminded before each scheduled activity</Text>
                </View>
                <Switch
                  value={Boolean(settings.lock_screen_reminders)}
                  onValueChange={(v) => toggle('lock_screen_reminders', v)}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor="#fff"
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.row}>
                <View style={styles.rowTextWrap}>
                  <Text style={styles.rowLabel}>Quiet Hours</Text>
                  <Text style={styles.rowSub}>
                    Pause non-urgent notifications overnight ({settings.quiet_start} – {settings.quiet_end})
                  </Text>
                </View>
                <Switch
                  value={Boolean(settings.quiet_hours_enabled)}
                  onValueChange={(v) => toggle('quiet_hours_enabled', v)}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor="#fff"
                />
              </View>
            </View>

            <Text style={styles.sectionTitle}>Email Updates</Text>
            <View style={styles.card}>
              <View style={styles.digestContainer}>
                <Text style={styles.digestSub}>
                  Receive a summary of your trip and event activity
                </Text>
                <View style={styles.pillRow}>
                  {DIGEST_OPTIONS.map((opt) => {
                    const active = settings.email_digest === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.pill, active && styles.pillActive]}
                        onPress={() => updateSettings({ email_digest: opt.value })}
                        activeOpacity={0.8}>
                        <Text style={[styles.pillText, active && styles.pillTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </AppScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },

  center:     { alignItems: 'center', marginTop: 60 },
  errorText:  { fontSize: 14, color: colors.error, marginBottom: 12 },
  retryBtn:   { backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24 },
  retryText:  { color: '#fff', fontWeight: '500', fontSize: 14 },

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
    marginBottom: 8,
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  rowTextWrap: { flex: 1, minWidth: 0 },
  rowLabel:   { fontSize: 15, fontWeight: '400', color: colors.textPrimary },
  rowSub:     { fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 16 },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(148,163,184,0.12)',
    marginLeft: 14,
  },

  digestContainer: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  digestSub: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  pillRow:   { flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.surfaceSecondary,
  },
  pillActive:     { backgroundColor: colors.accent },
  pillText:       { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  pillTextActive: { color: '#fff', fontWeight: '600' },
});
