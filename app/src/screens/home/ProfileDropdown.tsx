import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import CachedImage from '../../components/common/CachedImage';
import LegalModal from '../../components/common/LegalModal';
import Svg, { Path } from 'react-native-svg';

const SettingsIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const PrivacyIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const TermsIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const ArchiveIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" stroke="#64748b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const LogoutIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="#ef4444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

function AvatarOrInitial({ photoUrl, initial }: { photoUrl?: string; initial: string }) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <View style={styles.dropdownAvatar}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: 22, backgroundColor: '#f0fdfa', alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#0d9488' }}>{initial}</Text>
      </View>
      {!!photoUrl && !imgFailed && (
        <CachedImage
          uri={photoUrl}
          style={[StyleSheet.absoluteFill, { borderRadius: 22 }]}
          resizeMode="cover"
          priority="high"
          onError={() => setImgFailed(true)}
        />
      )}
    </View>
  );
}

type ProfileDropdownProps = {
  user: any;
  firstName?: string;
  onClose: () => void;
  onNavigateToSettings: () => void;
  onNavigateToArchived: () => void;
  onLogout: () => void;
};

function ProfileDropdown({
  user,
  firstName,
  onClose,
  onNavigateToSettings,
  onNavigateToArchived,
  onLogout,
}: ProfileDropdownProps) {
  const [legal, setLegal] = useState<'terms' | 'privacy' | null>(null);
  const photoUrl = user?.photoUrl || user?.avatarUrl || user?.profile?.avatarUrl || '';

  const openLegal = (type: 'terms' | 'privacy') => {
    setLegal(type);
  };

  const closeLegal = () => {
    setLegal(null);
    onClose();
  };

  return (
    <>
      <View style={styles.dropdownOverlay}>
        <TouchableOpacity style={styles.dropdownBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.profileDropdown}>
          <View style={styles.dropdownHeader}>
            <AvatarOrInitial photoUrl={photoUrl} initial={firstName?.[0] ?? '?'} />
            <View style={styles.dropdownUserText}>
              <Text style={styles.dropdownName} numberOfLines={1}>{user?.fullName || 'User'}</Text>
              <Text style={styles.dropdownEmail} numberOfLines={1}>@{user?.username || user?.email || ''}</Text>
            </View>
          </View>

          <View style={styles.dropdownDivider} />

          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => { onClose(); onNavigateToSettings(); }}
            activeOpacity={0.8}
          >
            <SettingsIcon />
            <Text style={styles.dropdownItemText}>Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => openLegal('privacy')}
            activeOpacity={0.8}
          >
            <PrivacyIcon />
            <Text style={styles.dropdownItemText}>Privacy</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => openLegal('terms')}
            activeOpacity={0.8}
          >
            <TermsIcon />
            <Text style={styles.dropdownItemText}>Terms & Conditions</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => { onClose(); onNavigateToArchived(); }}
            activeOpacity={0.8}
          >
            <ArchiveIcon />
            <Text style={styles.dropdownItemText}>Archived</Text>
          </TouchableOpacity>

          <View style={styles.dropdownDivider} />

          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={onLogout}
            activeOpacity={0.8}
          >
            <LogoutIcon />
            <Text style={[styles.dropdownItemText, styles.logoutLabel]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <LegalModal visible={legal === 'terms'} type="terms" onClose={closeLegal} />
      <LegalModal visible={legal === 'privacy'} type="privacy" onClose={closeLegal} />
    </>
  );
}

const styles = StyleSheet.create({
  dropdownOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 },
  dropdownBackdrop: { flex: 1 },
  profileDropdown: {
    position: 'absolute',
    top: 70,
    right: 16,
    width: 240,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  dropdownHeader: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 10 },
  dropdownAvatar: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', borderWidth: 2, borderColor: '#0d9488', flexShrink: 0 },
  dropdownUserText: { flex: 1, minWidth: 0 },
  dropdownName: { fontSize: 14, fontWeight: '400', color: '#0f172a' },
  dropdownEmail: { fontSize: 11, color: '#64748b', marginTop: 2 },
  dropdownDivider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 4 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 10, borderRadius: 10 },
  dropdownItemText: { fontSize: 13, fontWeight: '400', color: '#0f172a', flex: 1 },
  logoutLabel: { color: '#ef4444' },
});

export default ProfileDropdown;
