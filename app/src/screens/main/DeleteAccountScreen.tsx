import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import AppScreenLayout, { TAB_BAR_SCROLL_PADDING } from '../../components/common/AppScreenLayout';
import useAuth from '../../hooks/useAuth';
import useAuthStore from '../../store/authStore';
import { showAlert, showConfirm } from '../../store/alertStore';
import colors from '../../theme/colors';

// Same tokens as ThemedAlert's destructive button, used app-wide for delete actions
const DESTRUCTIVE_BG = 'rgba(239, 68, 68, 0.07)';
const DESTRUCTIVE_BORDER = 'rgba(239, 68, 68, 0.18)';

function TrashIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"
        stroke={colors.error} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      />
      <Path d="M10 11v6M14 11v6" stroke={colors.error} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function Bullet({ children }: { children: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

export default function DeleteAccountScreen({ navigation }: { navigation: any }) {
  const { deleteAccount } = useAuth();
  const userEmail = useAuthStore((s) => s.user?.email ?? '');

  const [isDeleting, setIsDeleting] = useState(false);

  function openConfirm() {
    if (isDeleting) return;
    showConfirm({
      title: 'Delete your account?',
      message: 'This permanently deletes your account and cannot be undone.',
      confirmText: 'Delete',
      destructive: true,
      onConfirm: handleDelete,
    });
  }

  async function handleDelete() {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      // On success the auth store clears and the navigator swaps to the auth stack.
      await deleteAccount();
    } catch (e: any) {
      setIsDeleting(false);
      showAlert({
        title: 'Could not delete account',
        message: e?.response?.data?.message || 'Please try again.',
      });
    }
  }

  return (
    <AppScreenLayout navigation={navigation} title="Delete Account" onBack={() => navigation.goBack()}>
      <View style={styles.kav}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: TAB_BAR_SCROLL_PADDING }]}
          showsVerticalScrollIndicator={false}>

          <View style={styles.form}>
            <View style={styles.iconBadge}>
              <TrashIcon />
            </View>

            <Text style={styles.subtitle}>
              This permanently deletes your GatherGo account. It cannot be undone.
            </Text>
            {userEmail ? <Text style={styles.emailText}>{userEmail}</Text> : null}

            <Text style={styles.sectionLabel}>What gets deleted</Text>
            <Bullet>Your profile, photo, email and phone number</Bullet>
            <Bullet>Your personal documents and gallery albums</Bullet>
            <Bullet>Your friends list, notifications and Swee chats</Bullet>
            <Bullet>Trips and events where you are the only member</Bullet>

            <Text style={styles.sectionLabel}>What stays for others</Text>
            <Bullet>Expenses, photos and notes you added to shared trips and events stay for the other members, shown as "Deleted user"</Bullet>
            <Bullet>Shared trips and events you organised are handed over to another member</Bullet>

            <TouchableOpacity
              style={[styles.deleteBtn, isDeleting && styles.deleteBtnBusy]}
              onPress={openConfirm}
              disabled={isDeleting}
              activeOpacity={0.85}>
              {isDeleting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.deleteBtnText}>Delete My Account</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </AppScreenLayout>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 48,
  },
  form: { maxWidth: 400, width: '100%', alignSelf: 'center' },

  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: DESTRUCTIVE_BG,
    borderWidth: 1.5,
    borderColor: DESTRUCTIVE_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 18,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 10,
  },
  emailText: {
    fontSize: 14,
    color: '#0d9488',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 12,
  },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 6,
    letterSpacing: 0.1,
  },
  bulletRow: { flexDirection: 'row', marginBottom: 4, paddingRight: 4 },
  bulletDot: { fontSize: 13, color: '#94a3b8', width: 16, lineHeight: 19 },
  bulletText: { flex: 1, fontSize: 13, color: '#475569', lineHeight: 19 },

  // Primary button style, as used across the app.
  deleteBtn: {
    backgroundColor: colors.buttonPrimary,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 24,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: 24,
  },
  deleteBtnBusy: { opacity: 0.7 },
  deleteBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  cancelBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  cancelBtnText: { fontSize: 15, color: '#64748b', fontWeight: '500' },
});
