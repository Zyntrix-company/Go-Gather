import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import BlobBackground from '../../components/common/BlobBackground';
import Logo from '../../components/common/Logo';
import LegalModal from '../../components/common/LegalModal';
import colors from '../../theme/colors';
import useAuthStore from '../../store/authStore';

function Chevron() {
  return (
    <Text style={styles.chevron}>›</Text>
  );
}

function ExternalIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"
        stroke={colors.textMuted}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

type RowProps = {
  label: string;
  sub?: string;
  onPress: () => void;
  showExternal?: boolean;
};

function SettingsRow({ label, sub, onPress, showExternal }: RowProps) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.rowTextWrap}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      {showExternal ? <ExternalIcon /> : <Chevron />}
    </TouchableOpacity>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function openAppSettings() {
  Linking.openSettings();
}

export default function SettingsScreen({ navigation }: { navigation: any }) {
  const user = useAuthStore((s) => s.user);
  const [legal, setLegal] = useState<'terms' | 'privacy' | null>(null);

  const displayName = user?.fullName || 'User';
  const displayEmail = user?.email || '';

  return (
    <BlobBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}>

          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8} style={styles.logoBtn}>
            <Logo size="small" />
          </TouchableOpacity>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Account, notifications, and help</Text>

          <View style={styles.profileCard}>
            <View style={styles.avatarRing}>
              <View style={styles.avatarInner}>
                <Text style={styles.avatarInitial}>{displayName.trim().charAt(0) || '?'}</Text>
              </View>
            </View>
            <View style={styles.profileText}>
              <Text style={styles.profileName} numberOfLines={1}>{displayName}</Text>
              <Text style={styles.profileEmail} numberOfLines={1}>{displayEmail || '—'}</Text>
            </View>
          </View>

          <SectionTitle>Account</SectionTitle>
          <View style={styles.card}>
            <SettingsRow
              label="Profile info"
              sub="Name, photo, bio, and more"
              onPress={() => navigation.navigate('EditProfile')}
            />
            <View style={styles.divider} />
            <SettingsRow
              label="Notifications"
              sub="Your alerts and activity"
              onPress={() => navigation.navigate('Notifications')}
            />
            <View style={styles.divider} />
            <SettingsRow
              label="Location"
              sub="Open system settings for location access"
              onPress={openAppSettings}
              showExternal
            />
            <View style={styles.divider} />
            <SettingsRow
              label="Connected mail"
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

          <SectionTitle>Help & support</SectionTitle>
          <View style={styles.card}>
            <SettingsRow
              label="Privacy policy"
              onPress={() => setLegal('privacy')}
            />
            <View style={styles.divider} />
            <SettingsRow
              label="Terms & conditions"
              onPress={() => setLegal('terms')}
            />
            <View style={styles.divider} />
            <SettingsRow
              label="FAQ & help"
              sub="Questions and answers"
              onPress={() => navigation.navigate('Faq')}
            />
          </View>
        </ScrollView>

        <LegalModal visible={legal === 'terms'} type="terms" onClose={() => setLegal(null)} />
        <LegalModal visible={legal === 'privacy'} type="privacy" onClose={() => setLegal(null)} />
      </SafeAreaView>
    </BlobBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  logoBtn: { alignSelf: 'flex-start', paddingTop: 8, marginBottom: 4 },
  title: {
    fontSize: 22,
    fontWeight: '500',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 22,
    overflow: 'hidden',
  },
  avatarRing: {
    padding: 2,
    borderRadius: 28,
    backgroundColor: colors.accent,
  },
  avatarInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.gradientMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.accentHover,
  },
  profileText: { flex: 1, minWidth: 0 },
  profileName: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  profileEmail: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 2,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.2)',
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
  rowLabel: { fontSize: 15, fontWeight: '500', color: colors.textPrimary },
  rowSub: { fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 16 },
  chevron: { fontSize: 20, color: colors.textMuted, lineHeight: 22 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(148,163,184,0.12)', marginLeft: 14 },
});
