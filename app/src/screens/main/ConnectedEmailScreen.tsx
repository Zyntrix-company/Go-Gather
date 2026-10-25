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
import { useFocusEffect } from '@react-navigation/native';
import { clearInFlowConnect } from '../../utils/drivePickerFlow';
import AppScreenLayout, { TAB_BAR_SCROLL_PADDING } from '../../components/common/AppScreenLayout';
import colors from '../../theme/colors';
import { Mail, Cloud, ChevronDown, ChevronUp } from 'lucide-react-native';
import { EmailProviderIcon } from '../../components/common/EmailProviderIcons';
import { DriveBrandIcon } from '../../components/common/GoogleWorkspaceIcons';
import { APP_BRAND_NAME } from '../../constants/brand';
import {
  getEmailStatus,
  getEmailConnectUrl,
  disconnectEmailProvider,
  getDriveStatus,
  getDriveConnectUrl,
  disconnectDrive,
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

const OAUTH_ERROR_LABELS: Record<string, string> = {
  PROVIDER_ERROR: 'Sign-in with the provider failed. Check your redirect URI and credentials.',
  INVALID_STATE:  'Session expired — please try again.',
  STATE_EXPIRED:  'Session expired — please try again.',
  access_denied:  'Permission was denied. Please try again and accept all requested permissions.',
  NO_CODE:        'No authorisation code received. Verify the redirect URI matches exactly.',
};

// ─── Layout pieces ────────────────────────────────────────────────────────────

/** Tinted, collapsible group (Email accounts / Cloud storage) holding a white list of providers. */
function ServiceSection({
  title, icon, tint, iconBg, open, onToggle, children,
}: {
  title: string;
  icon: React.ReactNode;
  tint: string;
  iconBg: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.section, { backgroundColor: tint }]}>
      <TouchableOpacity style={styles.sectionHeader} onPress={onToggle} activeOpacity={0.7}>
        <View style={[styles.sectionIcon, { backgroundColor: iconBg }]}>{icon}</View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {open
          ? <ChevronUp size={18} color={colors.textSecondary} strokeWidth={2} />
          : <ChevronDown size={18} color={colors.textSecondary} strokeWidth={2} />}
      </TouchableOpacity>
      {open ? <View style={styles.sectionList}>{children}</View> : null}
    </View>
  );
}

/** One provider: logo tile, name (and the connected account), Connect or Disconnect. */
function ProviderRow({
  logo, name, connected, account, connecting, disabled, onConnect, onDisconnect, last,
}: {
  logo: React.ReactNode;
  name: string;
  connected: boolean;
  account: string | null;
  connecting: boolean;
  disabled: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <View style={styles.logoTile}>{logo}</View>
      <View style={styles.rowText}>
        <Text style={styles.providerName}>{name}</Text>
        {connected ? (
          <Text style={styles.account} numberOfLines={1}>{account || 'Connected'}</Text>
        ) : null}
      </View>
      {connected ? (
        <TouchableOpacity style={styles.disconnectBtn} onPress={onDisconnect} activeOpacity={0.8}>
          <Text style={styles.disconnectText}>Disconnect</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.connectBtn, disabled && styles.btnDisabled]}
          onPress={onConnect}
          disabled={disabled || connecting}
          activeOpacity={0.85}>
          {connecting
            ? <ActivityIndicator size="small" color="#ffffff" />
            : <Text style={styles.connectText}>Connect</Text>}
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function ConnectedEmailScreen({ navigation, route }: { navigation: any; route: any }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<EmailProvider | 'drive' | null>(null);
  const [gmail, setGmail] = useState({ connected: false, email: null as string | null });
  const [outlook, setOutlook] = useState({ connected: false, email: null as string | null });
  const [drive, setDrive] = useState({ connected: false, email: null as string | null });
  const [emailOpen, setEmailOpen] = useState(true);
  const [cloudOpen, setCloudOpen] = useState(true);

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
    clearInFlowConnect(); // this sign-in returns here, not to an abandoned in-flow connect
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
    clearInFlowConnect();
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
    <AppScreenLayout navigation={navigation} title="Connected Services" onBack={() => navigation.goBack()}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: TAB_BAR_SCROLL_PADDING }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
        >
          <Text style={styles.headerSubtitle}>
            Connect your accounts to import bookings, tickets and documents into {APP_BRAND_NAME}.
          </Text>

          {loading && (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {!loading && (
            <>
              <ServiceSection
                title="Email accounts"
                icon={<Mail size={18} color="#D97706" strokeWidth={2} />}
                tint="#FFF8E7"
                iconBg="#FDECC4"
                open={emailOpen}
                onToggle={() => setEmailOpen(v => !v)}>
                <ProviderRow
                  logo={<EmailProviderIcon provider="gmail" size={24} />}
                  name="Gmail"
                  connected={gmail.connected}
                  account={gmail.email}
                  connecting={connecting === 'gmail'}
                  disabled={connecting !== null && connecting !== 'gmail'}
                  onConnect={() => onConnect('gmail')}
                  onDisconnect={() => confirmDisconnect('gmail', 'Gmail')}
                />
                <ProviderRow
                  logo={<EmailProviderIcon provider="outlook" size={24} />}
                  name="Outlook"
                  connected={outlook.connected}
                  account={outlook.email}
                  connecting={connecting === 'outlook'}
                  disabled={connecting !== null && connecting !== 'outlook'}
                  onConnect={() => onConnect('outlook')}
                  onDisconnect={() => confirmDisconnect('outlook', 'Outlook')}
                  last
                />
              </ServiceSection>

              <ServiceSection
                title="Cloud storage"
                icon={<Cloud size={18} color="#2563EB" strokeWidth={2} />}
                tint="#EEF5FD"
                iconBg="#D9E8FA"
                open={cloudOpen}
                onToggle={() => setCloudOpen(v => !v)}>
                <ProviderRow
                  logo={<DriveBrandIcon size={24} />}
                  name="Google Drive"
                  connected={drive.connected}
                  account={drive.email}
                  connecting={connecting === 'drive'}
                  disabled={connecting !== null && connecting !== 'drive'}
                  onConnect={onConnectDrive}
                  onDisconnect={confirmDisconnectDrive}
                  last
                />
              </ServiceSection>
            </>
          )}
        </ScrollView>
    </AppScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },

  headerSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.textSecondary,
    lineHeight: 19,
    marginBottom: 18,
  },

  center: { paddingVertical: 24, alignItems: 'center' },
  errorText: { fontSize: 13, color: colors.error, marginBottom: 12 },

  // Section card
  section: { borderRadius: 18, padding: 8, marginBottom: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 6, paddingVertical: 6 },
  sectionIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.textPrimary },
  sectionList: { backgroundColor: colors.surface, borderRadius: 14, marginTop: 8, paddingHorizontal: 12 },

  // Provider row
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  logoTile: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  rowText: { flex: 1, minWidth: 0 },
  providerName: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  account: { fontSize: 12, fontWeight: '400', color: colors.textSecondary, marginTop: 2 },

  connectBtn: {
    backgroundColor: colors.buttonPrimary, borderRadius: 999,
    paddingHorizontal: 22, height: 34, minWidth: 92,
    alignItems: 'center', justifyContent: 'center',
  },
  connectText: { fontSize: 13, fontWeight: '500', color: '#ffffff' },
  btnDisabled: { opacity: 0.6 },
  disconnectBtn: {
    borderRadius: 999, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 16, height: 34,
    alignItems: 'center', justifyContent: 'center',
  },
  disconnectText: { fontSize: 13, fontWeight: '500', color: colors.textPrimary },
});
