import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import AppModal from './AppModal';
import CachedImage from './CachedImage';
import { getFriends, handleApiError } from '../../api/trips.api';

/**
 * "Invite Friends" while creating a trip/event. Built from the same pieces as the
 * Members → Invite Friends tab in TripDetail/EventDetail (header, search box, member
 * rows, check circles, teal button) so the two read as one design.
 *
 * Only picks friends — they get a request when the trip/event is created. Email, SMS
 * and WhatsApp invites need the trip's link, so they happen right after creating, in
 * Members → Invite New (the create modal opens it).
 */

type Friend = { id: string; name: string; avatarUrl: string | null };

type Props = {
  visible: boolean;
  parentType: 'trip' | 'event';
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onClose: () => void;
};

const CloseX = () => (
  <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
    <Path d="M18 6L6 18M6 6l12 12" stroke="#64748b" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const CheckIcon = () => (
  <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
    <Path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

function FriendAvatar({ uri, name }: { uri: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!uri || failed) {
    return (
      <View style={[styles.memberAvatar, styles.avatarFallback]}>
        <Text style={styles.avatarInitial}>{name?.[0]?.toUpperCase() ?? '?'}</Text>
      </View>
    );
  }
  return <CachedImage uri={uri} style={styles.memberAvatar as any} resizeMode="cover" blurUp onError={() => setFailed(true)} />;
}

export default function InviteFriendsPicker({ visible, parentType, selectedIds, onChange, onClose }: Props) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    getFriends()
      .then((data) => {
        if (cancelled) return;
        setFriends(data.friends.map((f) => ({ id: f.user.id, name: f.user.name, avatarUrl: f.user.avatarUrl })));
      })
      .catch((err) => { if (!cancelled) handleApiError(err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visible]);

  const q = search.trim().toLowerCase();
  const shown = q ? friends.filter((f) => f.name?.toLowerCase().includes(q)) : friends;
  const toggle = (id: string) =>
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  const count = selectedIds.length;

  return (
    <AppModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <View style={styles.dHeader}>
            <View style={styles.flex1}>
              <Text style={styles.dTitle}>Invite Friends</Text>
              <Text style={styles.dSubtitle}>They'll get a request to join when the {parentType} is created</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.dCloseBtn} activeOpacity={0.7}>
              <CloseX />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.flexShrink}
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            <View style={styles.searchBox}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Circle cx={11} cy={11} r={8} stroke="#94a3b8" strokeWidth={2} />
                <Path d="M21 21l-4.35-4.35" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <TextInput
                style={styles.searchInput}
                placeholder="Search friends..."
                placeholderTextColor="#94a3b8"
                value={search}
                onChangeText={setSearch}
              />
            </View>

            {loading && friends.length === 0 ? (
              <ActivityIndicator color="#0d9488" style={styles.loader} />
            ) : shown.length === 0 ? (
              <Text style={styles.empty}>
                {friends.length === 0 ? 'No friends yet. Add friends to invite them.' : 'No friends match your search.'}
              </Text>
            ) : (
              shown.map((f) => {
                const sel = selectedIds.includes(f.id);
                return (
                  <TouchableOpacity key={f.id} style={styles.memberRow} onPress={() => toggle(f.id)} activeOpacity={0.8}>
                    <FriendAvatar uri={f.avatarUrl} name={f.name} />
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{f.name}</Text>
                    </View>
                    {sel ? <View style={styles.checkCircle}><CheckIcon /></View> : null}
                  </TouchableOpacity>
                );
              })
            )}

            <Text style={styles.hint}>
              To invite someone by email, SMS or WhatsApp, use Invite New — it opens right after you create the {parentType}.
            </Text>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.tealBtnFull} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.tealBtnTxt}>
                {count > 0 ? `Done · ${count} friend${count === 1 ? '' : 's'} selected` : 'Done'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </AppModal>
  );
}

// Values mirror TripDetailScreen's Members dialog styles.
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.52)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  dialog: { backgroundColor: '#fff', borderRadius: 20, width: '100%', maxHeight: '82%', overflow: 'hidden' },
  dHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dTitle: { fontSize: 14, fontWeight: '500', color: '#0f172a' },
  dSubtitle: { fontSize: 10, color: '#64748b', marginTop: 1 },
  dCloseBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  flex1: { flex: 1 },
  flexShrink: { flexGrow: 0, flexShrink: 1 },
  body: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 10, gap: 8 },
  searchInput: { flex: 1, fontSize: 12, color: '#0f172a' },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  memberAvatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 16, fontWeight: '500', color: '#94a3b8' },
  memberInfo: { flex: 1, marginLeft: 10 },
  memberName: { fontSize: 12, fontWeight: '500', color: '#0f172a' },
  checkCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#0d9488', alignItems: 'center', justifyContent: 'center' },
  loader: { marginVertical: 24 },
  empty: { textAlign: 'center', color: '#94a3b8', fontSize: 13, marginTop: 16, marginBottom: 8 },
  hint: { fontSize: 11, color: '#64748b', lineHeight: 16, marginTop: 12, textAlign: 'center' },
  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  tealBtnFull: { flexDirection: 'row', backgroundColor: '#0d9488', borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  tealBtnTxt: { color: '#fff', fontWeight: '500', fontSize: 13 },
});
