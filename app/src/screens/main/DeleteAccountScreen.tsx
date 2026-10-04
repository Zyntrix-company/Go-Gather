import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { KeyboardAvoider } from '../../components/common/KeyboardAvoider';
import Svg, { Path } from 'react-native-svg';
import AppScreenLayout, { TAB_BAR_SCROLL_PADDING } from '../../components/common/AppScreenLayout';
import useAuth from '../../hooks/useAuth';
import useAuthStore from '../../store/authStore';

const CONFIRM_WORD = 'DELETE';

function TrashIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"
        stroke="#dc2626" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      />
      <Path d="M10 11v6M14 11v6" stroke="#dc2626" strokeWidth={2} strokeLinecap="round" />
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

  const [confirmText, setConfirmText] = useState('');
  const [focused, setFocused] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = confirmText.trim().toUpperCase() === CONFIRM_WORD && !isDeleting;

  async function handleDelete() {
    if (!canDelete) return;
    setError(null);
    setIsDeleting(true);
    try {
      // On success the auth store clears and the navigator swaps to the auth stack.
      await deleteAccount();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not delete your account. Please try again.');
      setIsDeleting(false);
    }
  }

  return (
    <AppScreenLayout navigation={navigation} title="Delete Account" onBack={() => navigation.goBack()}>
      <KeyboardAvoider style={styles.kav}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: TAB_BAR_SCROLL_PADDING }]}
          keyboardShouldPersistTaps="handled"
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

            <Text style={styles.fieldLabel}>
              Type <Text style={styles.confirmWord}>{CONFIRM_WORD}</Text> to confirm
            </Text>
            <TextInput
              style={[styles.input, focused && styles.inputFocused]}
              placeholder={CONFIRM_WORD}
              placeholderTextColor="#94a3b8"
              value={confirmText}
              onChangeText={(v) => { setConfirmText(v); if (error) setError(null); }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!isDeleting}
              underlineColorAndroid="transparent"
              selectionColor="#dc2626"
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.deleteBtn, !canDelete && styles.deleteBtnDisabled]}
              onPress={handleDelete}
              activeOpacity={0.85}
              disabled={!canDelete}>
              {isDeleting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.deleteBtnText}>Delete my account</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
              disabled={isDeleting}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoider>
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
    backgroundColor: '#fef2f2',
    borderWidth: 1.5,
    borderColor: '#fecaca',
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

  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginTop: 24,
    marginBottom: 7,
    letterSpacing: 0.1,
  },
  confirmWord: { color: '#dc2626', fontWeight: '700' },
  input: {
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#0f172a',
  },
  inputFocused: { borderColor: '#dc2626' },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 8,
    marginLeft: 2,
  },

  deleteBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 24,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: 24,
  },
  deleteBtnDisabled: { opacity: 0.45 },
  deleteBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  cancelBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  cancelBtnText: { fontSize: 15, color: '#64748b', fontWeight: '500' },
});
