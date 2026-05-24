import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import BlobBackground from '../../components/common/BlobBackground';
import LegalModal from '../../components/common/LegalModal';
import CachedImage from '../../components/common/CachedImage';
import colors from '../../theme/colors';
import useAuthStore from '../../store/authStore';
import useAuth from '../../hooks/useAuth';

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
  const user = useAuthStore((s) => s.user);
  const avatarUpdatedAt = useAuthStore((s) => s.avatarUpdatedAt);
  const { refreshProfile } = useAuth();
  const [legal, setLegal] = useState<'terms' | 'privacy' | null>(null);

  useFocusEffect(useCallback(() => { refreshProfile(); }, [])); // eslint-disable-line react-hooks/exhaustive-deps

  const displayName = user?.fullName || 'User';
  const displayEmail = user?.email || '';
  const avatarUrl = user?.photoUrl || user?.avatarUrl || (user?.profile as any)?.avatarUrl || null;

  return (
    <BlobBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8} style={styles.backBtn}>
              <BackArrow />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>Settings</Text>
              <Text style={styles.headerSubtitle}>Profile, notifications, help</Text>
            </View>
          </View>

          <View style={styles.profileCard}>
            <View style={styles.avatarRing}>
              <View style={styles.avatarInner}>
                {avatarUrl ? (
                  <CachedImage
                    key={`${avatarUrl}${avatarUpdatedAt}`}
                    uri={avatarUrl}
                    style={styles.avatarImage}
                    resizeMode="cover"
                    priority="high"
                  />
                ) : (
                  <Text style={styles.avatarInitial}>{displayName.trim().charAt(0) || '?'}</Text>
                )}
              </View>
            </View>
            <View style={styles.profileText}>
              <Text style={styles.profileName} numberOfLines={1}>{displayName}</Text>
              <Text style={styles.profileEmail} numberOfLines={1}>{displayEmail || '—'}</Text>
            </View>
          </View>

          <SectionTitle>Profile</SectionTitle>
          <View style={styles.card}>
            <SettingsRow
              label="Profile info"
              sub="Name, photo, bio, and more"
              onPress={() => navigation.navigate('EditProfile')}
            />
            <View style={styles.divider} />
            <SettingsRow
              label="Change password"
              sub="Update your sign-in password"
              onPress={() => navigation.navigate('ChangePassword')}
            />
            <View style={styles.divider} />
            <SettingsRow
              label="Notifications"
              sub="Your alerts and activity"
              onPress={() => navigation.navigate('Notifications')}
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

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    marginBottom: 20,
    gap: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 1,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
   
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    
    
    padding: 16,
    marginBottom: 10,
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
    overflow: 'hidden',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '500',
    color: colors.accentHover,
  },
  profileText: { flex: 1, minWidth: 0 },
  profileName: { fontSize: 15, fontWeight: '500', color: colors.textPrimary },
  profileEmail: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },

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
