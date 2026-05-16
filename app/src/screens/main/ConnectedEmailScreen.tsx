import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import BlobBackground from '../../components/common/BlobBackground';
import Logo from '../../components/common/Logo';
import colors from '../../theme/colors';
import {
  getEmailStatus,
  getEmailConnectUrl,
  disconnectEmailProvider,
  type EmailProvider,
} from '../../api/trips.api';

function normalizeStatus(data: unknown) {
  const d = data as Record<string, { connected?: boolean; email?: string | null }> | null | undefined;
  return {
    gmail: {
      connected: Boolean(d?.gmail?.connected),
      email: d?.gmail?.email ?? null,
    },
    outlook: {
      connected: Boolean(d?.outlook?.connected),
      email: d?.outlook?.email ?? null,
    },
  };
}

export default function ConnectedEmailScreen({ navigation }: { navigation: any }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<EmailProvider | null>(null);
  const [gmail, setGmail] = useState({ connected: false, email: null as string | null });
  const [outlook, setOutlook] = useState({ connected: false, email: null as string | null });

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await getEmailStatus();
      const n = normalizeStatus(data);
      setGmail(n.gmail);
      setOutlook(n.outlook);
    } catch {
      setError('Could not load email connections.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Auto-refresh when OAuth deep link fires (handles case where screen is already focused)
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (url.startsWith('gathergo://email-connected')) load();
    });
    return () => sub.remove();
  }, [load]);

  async function onConnect(provider: EmailProvider) {
    setConnecting(provider);
    setError(null);
    try {
      const { url } = await getEmailConnectUrl(provider);
      const ok = await Linking.canOpenURL(url);
      if (!ok) {
        setError('Cannot open the sign-in page on this device.');
        return;
      }
      await Linking.openURL(url);
    } catch {
      setError(`Could not start ${provider === 'gmail' ? 'Gmail' : 'Outlook'} connection. Try again.`);
    } finally {
      setConnecting(null);
    }
  }

  function confirmDisconnect(provider: EmailProvider, label: string) {
    Alert.alert(
      `Disconnect ${label}?`,
      'Imported docs stay in your trips; you can reconnect anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await disconnectEmailProvider(provider);
              await load();
            } catch {
              setError('Could not disconnect. Try again.');
            }
          },
        },
      ],
    );
  }

  return (
    <BlobBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
        >
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8} style={styles.logoBtn}>
            <Logo size="small" />
          </TouchableOpacity>
          <Text style={styles.title}>Connected mail</Text>
          <Text style={styles.subtitle}>
            Link Gmail or Outlook so GatherrGo can find travel attachments when you import from email.
          </Text>

          {loading && (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {!loading && (
            <>
              <View style={styles.card}>
                <Text style={styles.providerLabel}>Gmail</Text>
                {gmail.connected ? (
                  <>
                    <Text style={styles.connectedEmail} numberOfLines={1}>{gmail.email || 'Connected'}</Text>
                    <TouchableOpacity
                      style={styles.secondaryBtn}
                      onPress={() => confirmDisconnect('gmail', 'Gmail')}
                      activeOpacity={0.8}>
                      <Text style={styles.secondaryBtnText}>Disconnect</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={() => onConnect('gmail')}
                    disabled={connecting !== null}
                    activeOpacity={0.85}>
                    {connecting === 'gmail' ? (
                      <ActivityIndicator color={colors.accentForeground} />
                    ) : (
                      <Text style={styles.primaryBtnText}>Connect Gmail</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.card}>
                <Text style={styles.providerLabel}>Outlook</Text>
                {outlook.connected ? (
                  <>
                    <Text style={styles.connectedEmail} numberOfLines={1}>{outlook.email || 'Connected'}</Text>
                    <TouchableOpacity
                      style={styles.secondaryBtn}
                      onPress={() => confirmDisconnect('outlook', 'Outlook')}
                      activeOpacity={0.8}>
                      <Text style={styles.secondaryBtnText}>Disconnect</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={() => onConnect('outlook')}
                    disabled={connecting !== null}
                    activeOpacity={0.85}>
                    {connecting === 'outlook' ? (
                      <ActivityIndicator color={colors.accentForeground} />
                    ) : (
                      <Text style={styles.primaryBtnText}>Connect Outlook</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.hint}>
                After you tap Connect, sign in in your browser. When you return to the app, status refreshes when you open this screen again.
              </Text>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </BlobBackground>
  );
}

const CARD_BG = 'rgba(255,255,255,0.2)';

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  logoBtn: { alignSelf: 'flex-start', paddingTop: 8, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '500', color: colors.textPrimary, textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: 20, lineHeight: 19 },
  center: { paddingVertical: 24, alignItems: 'center' },
  errorText: { fontSize: 13, color: colors.error, textAlign: 'center', marginBottom: 12 },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  providerLabel: { fontSize: 12, fontWeight: '600', color: colors.accent, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  connectedEmail: { fontSize: 15, fontWeight: '500', color: colors.textPrimary, marginBottom: 12 },
  primaryBtn: {
    backgroundColor: colors.buttonPrimary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: colors.accentForeground, fontSize: 15, fontWeight: '500' },
  secondaryBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  secondaryBtnText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 18, marginTop: 4 },
});
