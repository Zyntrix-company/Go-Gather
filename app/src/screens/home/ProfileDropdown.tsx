import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const UserMenuIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path d="M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const SettingsIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const LogoutIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="#ef4444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const ArchiveIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

function AvatarOrInitial({ photoUrl, initial }: { photoUrl?: string; initial: string }) {
  const [imgOk, setImgOk] = React.useState(false);

  // Reset imgOk when the URL changes so a new photo re-evaluates
  const prevUrl = React.useRef<string | undefined>(undefined);
  if (prevUrl.current !== photoUrl) {
    prevUrl.current = photoUrl;
    // Can't call setState during render — schedule it
    if (imgOk) setImgOk(false);
  }

  const Initials = (
    <View style={[styles.dropdownAvatar, { backgroundColor: '#f0fdfa', alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ fontSize: 18, fontWeight: '700', color: '#0d9488' }}>{initial}</Text>
    </View>
  );

  if (!photoUrl) return Initials;

  // Initials sit underneath as placeholder; image fades in on successful load
  return (
    <View style={styles.dropdownAvatar}>
      <View style={[styles.dropdownAvatar, { position: 'absolute', backgroundColor: '#f0fdfa', alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#0d9488' }}>{initial}</Text>
      </View>
      <Image
        source={{ uri: photoUrl }}
        style={[styles.dropdownAvatar, { opacity: imgOk ? 1 : 0 }]}
        onLoad={() => setImgOk(true)}
        onError={() => setImgOk(false)}
      />
    </View>
  );
}

function ProfileDropdown({ user, firstName, onClose, onNavigateToAccount, onNavigateToArchived, onLogout }: any) {
  const photoUrl = user?.photoUrl || user?.avatarUrl || user?.profile?.avatarUrl || '';
  return (
    <View style={styles.dropdownOverlay}>
      <TouchableOpacity style={styles.dropdownBackdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.profileDropdown}>
        <View style={styles.dropdownHeader}>
          <AvatarOrInitial photoUrl={photoUrl} initial={firstName?.[0] ?? '?'} />
          <View style={styles.dropdownUserText}>
            <Text style={styles.dropdownName}>{user?.fullName || 'User'}</Text>
            <Text style={styles.dropdownEmail} numberOfLines={1}>@{user?.username || user?.email || ''}</Text>
          </View>
        </View>
        <View style={styles.dropdownDivider} />
        <TouchableOpacity style={styles.dropdownItem} onPress={() => { onClose(); onNavigateToAccount(); }} activeOpacity={0.8}>
          <UserMenuIcon />
          <Text style={styles.dropdownItemText}>Account</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.dropdownItem} onPress={onClose} activeOpacity={0.8}>
          <SettingsIcon />
          <Text style={styles.dropdownItemText}>Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dropdownItem} onPress={() => { onClose(); onNavigateToArchived(); }} activeOpacity={0.8}>
          <ArchiveIcon />
          <Text style={styles.dropdownItemText}>Archived</Text>
        </TouchableOpacity>
        <View style={styles.dropdownDivider} />
        <TouchableOpacity style={styles.dropdownItem} onPress={() => { onClose(); onLogout(); }} activeOpacity={0.8}>
          <LogoutIcon />
          <Text style={[styles.dropdownItemText, styles.logoutLabel]}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dropdownOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 },
  dropdownBackdrop: { flex: 1 },
  profileDropdown: { position: 'absolute', top: 70, right: 20, width: 240, maxHeight: 420, backgroundColor: '#fff', borderRadius: 16, padding: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 8, borderWidth: 1, borderColor: '#f1f5f9' },
  dropdownHeader: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
  dropdownAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f1f5f9' },
  dropdownUserText: { flex: 1 },
  dropdownName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  dropdownEmail: { fontSize: 12, color: '#64748b', marginTop: 2 },
  dropdownDivider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 4 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12, borderRadius: 10 },
  dropdownItemText: { fontSize: 14, fontWeight: '500', color: '#334155' },
  logoutLabel: { color: '#ef4444' },
});

export default ProfileDropdown;
