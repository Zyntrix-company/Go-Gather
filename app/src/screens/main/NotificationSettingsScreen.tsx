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
import { SafeAreaView } from 'react-native-safe-area-context';
import BlobBackground from '../../components/common/BlobBackground';
import Logo from '../../components/common/Logo';
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
    <BlobBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}>

          {/* Header */}
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8} style={styles.logoBtn}>
            <Logo size="small" />
          </TouchableOpacity>
          <Text style={styles.title}>Notification Preferences</Text>
          <Text style={styles.subtitle}>Control how and when GatherrGo notifies you</Text>
          <Text style={styles.scopeNote}>
            All controls below save to your account. Quiet start/end times come from the server (default 22:00–08:00); editing those times in the app is not available yet.
          </Text>

          {/* Loading */}
          {loading && !settings && (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          )}

          {/* Error */}
          {error && !settings && (
            <View style={styles.center}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={fetchSettings} style={styles.retryBtn} activeOpacity={0.8}>
                <Text style={styles.retryText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Settings */}
          {settings && (
            <>
              {/* Activity Reminders */}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Push Reminders</Text>

                <View style={styles.row}>
                  <View style={styles.rowText}>
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
                  <View style={styles.rowText}>
                    <Text style={styles.rowLabel}>Quiet hours</Text>
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

              {/* Email Digest */}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Email Updates</Text>
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
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </BlobBackground>
  );
}



const styles = StyleSheet.create({
  safe:       { flex: 1 },
  scroll:     { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },

  logoBtn:    { alignSelf: 'flex-start', paddingTop: 8, marginBottom: 16 },
  title:      { fontSize: 20, fontWeight: '400', color: colors.textPrimary, textAlign: 'center', marginBottom: 4 },
  subtitle:   { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: 10 },
  scopeNote: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 20,
    paddingHorizontal: 4,
  },

  center:     { alignItems: 'center', marginTop: 60 },
  errorText:  { fontSize: 14, color: colors.error, marginBottom: 12 },
  retryBtn:   { backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24 },
  retryText:  { color: '#fff', fontWeight: '500', fontSize: 14 },

  card: {
    
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },

  sectionTitle: { fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 14 },
  digestSub:    { fontSize: 12, color: colors.textSecondary, marginBottom: 14 },

  row:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowText: { flex: 1, marginRight: 12 },
  rowLabel: { fontSize: 14, color: colors.textPrimary, fontWeight: '500' },
  rowSub:   { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  divider: { height: StyleSheet.hairlineWidth, marginVertical: 14 },

  pillRow:         { flexDirection: 'row', gap: 10 },
  pill:            { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 8, backgroundColor: 'rgba(241,245,249,0.85)' },
  pillActive:      { backgroundColor: colors.accent },
  pillText:        { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  pillTextActive:  { color: '#fff', fontWeight: '600' },
});
