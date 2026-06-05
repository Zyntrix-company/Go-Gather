import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Image,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import BlobBackground from '../../components/common/BlobBackground';
import colors from '../../theme/colors';
import {
  EmailProviderGlassCard,
  EmailProviderOutlineButton,
  emailProviderStyles,
} from '../../components/common/EmailProviderUI';
import {
  getEmailStatus,
  getEmailConnectUrl,
  disconnectEmailProvider,
  getDriveStatus,
  getDriveConnectUrl,
  disconnectDrive,
  type EmailProvider,
} from '../../api/trips.api';

function BackArrow() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 12H5M12 19l-7-7 7-7"
        stroke={colors.textPrimary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

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

const OAUTH_ERROR_LABELS: Record<string, string> = {
  PROVIDER_ERROR: 'Sign-in with the provider failed. Check your redirect URI and credentials.',
  INVALID_STATE:  'Session expired — please try again.',
  STATE_EXPIRED:  'Session expired — please try again.',
  access_denied:  'Permission was denied. Please try again and accept all requested permissions.',
  NO_CODE:        'No authorisation code received. Verify the redirect URI matches exactly.',
};

export default function ConnectedEmailScreen({ navigation, route }: { navigation: any; route: any }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<EmailProvider | 'drive' | null>(null);
  const [gmail, setGmail] = useState({ connected: false, email: null as string | null });
  const [outlook, setOutlook] = useState({ connected: false, email: null as string | null });
  const [drive, setDrive] = useState({ connected: false, email: null as string | null });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [emailData, driveData] = await Promise.all([getEmailStatus(), getDriveStatus()]);
      const n = normalizeStatus(emailData);
      setGmail(n.gmail);
      setOutlook(n.outlook);
      setDrive({ connected: Boolean(driveData?.connected), email: driveData?.email ?? null });
    } catch {
      setError('Could not load connected services.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const { oauthSuccess, oauthError, oauthProvider } = (route?.params ?? {}) as {
      oauthSuccess?: boolean;
      oauthError?: string;
      oauthProvider?: string;
    };
    if (oauthSuccess === false && oauthError) {
      const label = oauthProvider === 'outlook' ? 'Outlook' : oauthProvider === 'gmail' ? 'Gmail' : oauthProvider === 'drive' ? 'Google Drive' : 'service';
      const detail = OAUTH_ERROR_LABELS[oauthError] ?? `Error code: ${oauthError}`;
      setError(`Could not connect ${label}. ${detail}`);
    } else if (oauthSuccess === true) {
      setError(null);
    }
  }, [route?.params]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

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
      if (!ok) { setError('Cannot open the sign-in page on this device.'); return; }
      await Linking.openURL(url);
    } catch {
      setError(`Could not start ${provider === 'gmail' ? 'Gmail' : 'Outlook'} connection. Try again.`);
    } finally {
      setConnecting(null);
    }
  }

  async function onConnectDrive() {
    setConnecting('drive');
    setError(null);
    try {
      const { url } = await getDriveConnectUrl();
      const ok = await Linking.canOpenURL(url);
      if (!ok) { setError('Cannot open the sign-in page on this device.'); return; }
      await Linking.openURL(url);
    } catch {
      setError('Could not start Google Drive connection. Try again.');
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

  function confirmDisconnectDrive() {
    Alert.alert(
      'Disconnect Google Drive?',
      'Imported docs stay in your trips; you can reconnect anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await disconnectDrive();
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
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8} style={styles.backBtn}>
            <BackArrow />
          </TouchableOpacity>

          <View style={styles.headerTextBlock}>
            <Text style={styles.headerTitle}>Connected Services</Text>
            <Text style={styles.headerSubtitle}>Link Gmail, Outlook or Google Drive to import travel docs</Text>
          </View>

          {loading && (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {!loading && (
            <>
              <EmailProviderGlassCard provider="gmail" connected={gmail.connected}>
                {gmail.connected ? (
                  <View style={styles.connectedRow}>
                    <Text style={styles.connectedEmail} numberOfLines={1}>
                      {gmail.email || 'Connected'}
                    </Text>
                    <TouchableOpacity
                      style={emailProviderStyles.glassSecondaryBtn}
                      onPress={() => confirmDisconnect('gmail', 'Gmail')}
                      activeOpacity={0.8}>
                      <Text style={styles.secondaryBtnText}>Disconnect</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <EmailProviderOutlineButton
                    label="Connect Gmail"
                    provider="gmail"
                    variant="glass"
                    onPress={() => onConnect('gmail')}
                    loading={connecting === 'gmail'}
                    disabled={connecting !== null && connecting !== 'gmail'}
                  />
                )}
              </EmailProviderGlassCard>

              <EmailProviderGlassCard provider="outlook" connected={outlook.connected}>
                {outlook.connected ? (
                  <View style={styles.connectedRow}>
                    <Text style={styles.connectedEmail} numberOfLines={1}>
                      {outlook.email || 'Connected'}
                    </Text>
                    <TouchableOpacity
                      style={emailProviderStyles.glassSecondaryBtn}
                      onPress={() => confirmDisconnect('outlook', 'Outlook')}
                      activeOpacity={0.8}>
                      <Text style={styles.secondaryBtnText}>Disconnect</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <EmailProviderOutlineButton
                    label="Connect Outlook"
                    provider="outlook"
                    variant="glass"
                    onPress={() => onConnect('outlook')}
                    loading={connecting === 'outlook'}
                    disabled={connecting !== null && connecting !== 'outlook'}
                  />
                )}
              </EmailProviderGlassCard>

              {/* Google Drive card */}
              <View style={[emailProviderStyles.glassCard, { backgroundColor: 'rgba(66, 133, 244, 0.06)' }]}>
                <View style={emailProviderStyles.glassCardContent}>
                  <View style={emailProviderStyles.providerRowLabel}>
                    <Image
                      source={require('../../../assets/drive-icon.png')}
                      style={{ width: 22, height: 22 }}
                      resizeMode="contain"
                    />
                    <Text style={emailProviderStyles.providerLabelText}>Google Drive</Text>
                  </View>
                  {drive.connected ? (
                    <>
                      <View style={emailProviderStyles.connectedBadge}>
                        <Text style={emailProviderStyles.connectedBadgeText}>Connected</Text>
                      </View>
                      <View style={styles.connectedRow}>
                        <Text style={styles.connectedEmail} numberOfLines={1}>
                          {drive.email || 'Connected'}
                        </Text>
                        <TouchableOpacity
                          style={emailProviderStyles.glassSecondaryBtn}
                          onPress={confirmDisconnectDrive}
                          activeOpacity={0.8}>
                          <Text style={styles.secondaryBtnText}>Disconnect</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <EmailProviderOutlineButton
                      label="Connect Google Drive"
                      variant="glass"
                      onPress={onConnectDrive}
                      loading={connecting === 'drive'}
                      disabled={connecting !== null && connecting !== 'drive'}
                    />
                  )}
                </View>
              </View>

              <Text style={styles.hint}>
                After tapping Connect, sign in via your browser. Status refreshes when you return to this screen.
              </Text>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </BlobBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },

  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 14,
  },
  headerTextBlock: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.textSecondary,
  },

  center: { paddingVertical: 24, alignItems: 'center' },
  errorText: { fontSize: 13, color: colors.error, marginBottom: 12 },

  connectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 4,
  },
  connectedEmail: {
    flex: 1,
    fontSize: 13,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  secondaryBtnText: { fontSize: 13, color: colors.textPrimary, fontWeight: '500' },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 18, marginTop: 4 },
});
