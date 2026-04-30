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

          {/* Loading */}
          {loading && !settings && (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#0d9488" />
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
                    value={settings.lock_screen_reminders}
                    onValueChange={(v) => toggle('lock_screen_reminders', v)}
                    trackColor={{ false: '#e2e8f0', true: '#0d9488' }}
                    thumbColor="#fff"
                  />
                </View>

                <View style={styles.divider} />

                <View style={styles.row}>
                  <View style={styles.rowText}>
                    <Text style={styles.rowLabel}>Quiet Hours (10pm – 8am)</Text>
                    <Text style={styles.rowSub}>Pause non-urgent notifications at night</Text>
                  </View>
                  <Switch
                    value={settings.quiet_hours_enabled}
                    onValueChange={(v) => toggle('quiet_hours_enabled', v)}
                    trackColor={{ false: '#e2e8f0', true: '#0d9488' }}
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
  scroll:     { paddingHorizontal: 20, paddingBottom: 40 },

  logoBtn:    { alignSelf: 'flex-start', paddingTop: 8, marginBottom: 4 },
  title:      { fontSize: 20, fontWeight: '400', color: '#0F172B', textAlign: 'center', marginBottom: 4 },
  subtitle:   { fontSize: 13, color: '#45556C', textAlign: 'center', marginBottom: 24 },

  center:     { alignItems: 'center', marginTop: 60 },
  errorText:  { fontSize: 14, color: '#ef4444', marginBottom: 12 },
  retryBtn:   { backgroundColor: '#0d9488', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 24 },
  retryText:  { color: '#fff', fontWeight: '600', fontSize: 14 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 14 },
  digestSub:    { fontSize: 12, color: '#64748b', marginBottom: 14 },

  row:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowText: { flex: 1, marginRight: 12 },
  rowLabel: { fontSize: 14, color: '#0f172a', fontWeight: '500' },
  rowSub:   { fontSize: 12, color: '#64748b', marginTop: 2 },

  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 14 },

  pillRow:         { flexDirection: 'row', gap: 10 },
  pill:            { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 8, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: 'transparent' },
  pillActive:      { backgroundColor: '#0d9488', borderColor: '#0d9488' },
  pillText:        { fontSize: 13, color: '#64748b', fontWeight: '500' },
  pillTextActive:  { color: '#fff', fontWeight: '600' },
});
