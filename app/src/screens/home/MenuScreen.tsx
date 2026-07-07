import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppScreenLayout, { tabBarContentPadding } from '../../components/common/AppScreenLayout';
import CachedImage from '../../components/common/CachedImage';
import SweeFab from '../../components/details/SweeFab';
import colors from '../../theme/colors';
import useAuthStore from '../../store/authStore';
import useAuth from '../../hooks/useAuth';
import { showConfirm } from '../../store/alertStore';

// App version shown at the bottom of the menu.
const APP_VERSION = '1.0.0';

// ─── Icons (line style, stroke #64748b — matches ProfileDropdown) ──────────────

function ProfileIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={12} cy={7} r={4} stroke="#64748b" strokeWidth={2} />
    </Svg>
  );
}

function SettingsIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function SupportIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function LegalIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ArchiveIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function LogoutIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="#ef4444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Masking helpers (mirror the mockup: "+91 90****8975 | an***@gmail.com") ────

function maskEmail(email?: string): string {
  if (!email) return '';
  const at = email.indexOf('@');
  if (at <= 0) return email;
  const head = email.slice(0, Math.min(2, at));
  return `${head}***${email.slice(at)}`;
}

function maskPhone(phone?: string): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  const digits = trimmed.replace(/[^\d]/g, '');
  if (digits.length <= 4) return trimmed;
  const last4 = digits.slice(-4);
  const head = trimmed.slice(0, Math.max(0, trimmed.length - digits.length) + Math.min(2, digits.length - 4)).trimEnd();
  return `${head || digits.slice(0, 2)}****${last4}`;
}

// ─── Row ───────────────────────────────────────────────────────────────────────

function MenuRow({
  icon,
  label,
  danger,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowIcon}>{icon}</View>
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
      {!danger && <Text style={styles.chevron}>›</Text>}
    </TouchableOpacity>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function MenuScreen({ navigation }: { navigation: any }) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user) as any;
  const avatarUpdatedAt = useAuthStore((s) => s.avatarUpdatedAt);
  const { logout, refreshProfile } = useAuth();
  const [imgFailed, setImgFailed] = useState(false);

  useFocusEffect(useCallback(() => { refreshProfile(); }, [])); // eslint-disable-line react-hooks/exhaustive-deps

  const displayName = user?.fullName || 'User';
  const avatarUrl = user?.photoUrl || user?.avatarUrl || (user?.profile as any)?.avatarUrl || '';
  const initial = displayName.trim().charAt(0).toUpperCase() || '?';

  const contactParts = [maskPhone(user?.phone), maskEmail(user?.email)].filter(Boolean);

  const confirmLogout = () => {
    showConfirm({
      title: 'Log out?',
      message: 'Are you sure you want to log out of your account?',
      confirmText: 'Log out',
      destructive: true,
      onConfirm: logout,
    });
  };

  return (
    <AppScreenLayout navigation={navigation} activeTab={null}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { flexGrow: 1, paddingBottom: tabBarContentPadding(insets.bottom, 12) }]}
        showsVerticalScrollIndicator={false}>

        {/* Profile header */}
        <View style={styles.profileBlock}>
          <View style={styles.avatarRing}>
            <View style={styles.avatarInner}>
              {avatarUrl && !imgFailed ? (
                <CachedImage
                  key={`${avatarUrl}${avatarUpdatedAt}`}
                  uri={avatarUrl}
                  style={styles.avatarImage}
                  resizeMode="cover"
                  priority="high"
                  onError={() => setImgFailed(true)}
                />
              ) : (
                <Text style={styles.avatarInitial}>{initial}</Text>
              )}
            </View>
          </View>
          <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
          {contactParts.length > 0 && (
            <Text style={styles.contact} numberOfLines={1}>{contactParts.join('  |  ')}</Text>
          )}
        </View>

        <View style={styles.topDivider} />

        {/* Menu rows */}
        <MenuRow icon={<ProfileIcon />}  label="Profile"  onPress={() => navigation.navigate('Profile')} />
        <View style={styles.rowDivider} />
        <MenuRow icon={<SettingsIcon />} label="Settings" onPress={() => navigation.navigate('Settings')} />
        <View style={styles.rowDivider} />
        <MenuRow icon={<SupportIcon />}  label="Support"  onPress={() => navigation.navigate('Support')} />
        <View style={styles.rowDivider} />
        <MenuRow icon={<LegalIcon />}    label="Legal"    onPress={() => navigation.navigate('Legal')} />
        <View style={styles.rowDivider} />
        <MenuRow icon={<ArchiveIcon />}  label="Archive"  onPress={() => navigation.navigate('Archived')} />
        <View style={styles.rowDivider} />
        <MenuRow icon={<LogoutIcon />}   label="Logout"   danger onPress={confirmLogout} />

        <Text style={styles.version}>GatherrGo · Version {APP_VERSION}</Text>
      </ScrollView>

      <SweeFab onPress={() => navigation.navigate('ChatDetail', {})} />
    </AppScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8 },

  profileBlock: { alignItems: 'center', paddingTop: 8, paddingBottom: 18 },
  avatarRing: {
    padding: 3,
    borderRadius: 52,
    backgroundColor: colors.accent,
  },
  avatarInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#f0fdfa',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },
  avatarInitial: { fontSize: 34, fontWeight: '600', color: colors.accent },
  name: { fontSize: 18, fontWeight: '500', color: colors.textPrimary, marginTop: 14 },
  contact: { fontSize: 13, color: colors.textSecondary, marginTop: 6 },

  topDivider: { height: 1, backgroundColor: 'rgba(148,163,184,0.16)', marginBottom: 4 },
  rowDivider: { height: 1, backgroundColor: 'rgba(148,163,184,0.12)', marginLeft: 52 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  rowIcon: { width: 24, alignItems: 'center' },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '400', color: colors.textPrimary },
  rowLabelDanger: { color: '#ef4444' },
  chevron: { fontSize: 22, color: colors.textMuted, lineHeight: 24 },

  version: { textAlign: 'center', fontSize: 12, color: colors.textMuted, marginTop: 'auto', paddingTop: 26 },
});
