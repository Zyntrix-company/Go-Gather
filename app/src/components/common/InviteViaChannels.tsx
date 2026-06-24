import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  FlatList,
  StyleSheet,
  Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Toast from 'react-native-toast-message';
import { createFriendInvite, inviteToTrip } from '../../api/trips.api';
import { inviteToEvent } from '../../api/events.api';
import useAuthStore from '../../store/authStore';
import { showAlert } from '../../store/alertStore';
import {
  buildEventInviteMessage,
  buildTripInviteMessage,
  openSms,
  openWhatsAppShare,
} from '../../utils/inviteShare';
import {
  loadPickableContacts,
  pickBestPhone,
  requestContactsPermission,
  type PickableContact,
} from '../../utils/contactsAccess';

export type InviteChannel = 'email' | 'sms' | 'whatsapp';

type Props = {
  variant: 'friend' | 'trip' | 'event';
  tripId?: string;
  tripName?: string;
  eventId?: string;
  eventName?: string;
  onComplete?: () => void;
};

const BTN_SIZE = 52;

/** WhatsApp mark as vector paths (no icon font — avoids missing-glyph “X” when fonts aren’t bundled). */
function WhatsAppGlyph({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" accessibilityLabel="WhatsApp">
      <Path
        fill={color}
        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.149-.197.297-.767.965-.94 1.164-.173.199-.347.223-.644.074-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.149-.174.198-.298.298-.497.099-.199.05-.371-.025-.52-.075-.149-.669-1.611-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.873.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.984.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.123 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"
      />
    </Svg>
  );
}

function ChannelIcon({ channel, active }: { channel: InviteChannel; active: boolean }) {
  const stroke = active ? '#fff' : '#64748b';
  if (channel === 'email') {
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M22 6l-10 7L2 6" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function InviteViaChannels({ variant, tripId, tripName, eventId, eventName, onComplete }: Props) {
  const inviterName = useAuthStore(s => s.user?.fullName || s.user?.profile?.fullName || 'A GatherGo user');

  const [channel, setChannel] = useState<InviteChannel>('sms');
  const [emailInput, setEmailInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [showManualPhone, setShowManualPhone] = useState(false);
  const [busy, setBusy] = useState(false);

  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [contacts, setContacts] = useState<PickableContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);

  const filteredContacts = useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    const withPhone = contacts.filter(c => c.phones.length > 0);
    if (!q) return withPhone;
    return withPhone.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.phones.some(p => p.number.includes(q)),
    );
  }, [contacts, contactSearch]);

  const fetchWhatsAppShareText = useCallback(async (): Promise<string> => {
    if (variant === 'friend') {
      const res = await createFriendInvite({ channels: ['whatsapp'], emails: [] });
      return res.shareText;
    }
    if (variant === 'event') {
      if (!eventId) throw new Error('Event not found');
      const res = await inviteToEvent(eventId, { shareOnly: true });
      return res.shareText ?? buildEventInviteMessage(inviterName, eventName || 'an event', res.invited[0].branchUrl);
    }
    if (!tripId) throw new Error('Trip not found');
    const res = await inviteToTrip(tripId, { shareOnly: true });
    return res.shareText ?? buildTripInviteMessage(inviterName, tripName || 'a trip', res.invited[0].branchUrl);
  }, [variant, tripId, tripName, eventId, eventName, inviterName]);

  const fetchSmsShareText = useCallback(
    async (phone: string): Promise<string> => {
      if (variant === 'friend') {
        const res = await createFriendInvite({ channels: ['sms'], emails: [] });
        return res.shareText;
      }
      if (variant === 'event') {
        if (!eventId) throw new Error('Event not found');
        const res = await inviteToEvent(eventId, { phones: [phone] });
        if ((res.added?.length ?? 0) > 0 && !(res.invited?.length)) {
          throw new Error('ALREADY_MEMBER');
        }
        const branchUrl = res.invited?.[0]?.branchUrl;
        if (!branchUrl) throw new Error('No invite link returned');
        return res.shareText ?? buildEventInviteMessage(inviterName, eventName || 'an event', branchUrl);
      }
      if (!tripId) throw new Error('Trip not found');
      const res = await inviteToTrip(tripId, { phones: [phone] });
      if ((res.added?.length ?? 0) > 0 && !(res.invited?.length)) {
        throw new Error('ALREADY_MEMBER');
      }
      const branchUrl = res.invited?.[0]?.branchUrl;
      if (!branchUrl) throw new Error('No invite link returned');
      return res.shareText ?? buildTripInviteMessage(inviterName, tripName || 'a trip', branchUrl);
    },
    [variant, tripId, tripName, eventId, eventName, inviterName],
  );

  async function handleEmailSend() {
    const email = emailInput.trim();
    if (!email) {
      showAlert({ title: 'Error', message: 'Enter an email address' });
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      if (variant === 'friend') {
        await createFriendInvite({ channels: ['email'], emails: [email] });
      } else if (variant === 'event' && eventId) {
        await inviteToEvent(eventId, { emails: [email] });
      } else if (tripId) {
        await inviteToTrip(tripId, { emails: [email] });
      }
      Toast.show({ type: 'success', text1: 'Invite sent!' });
      setEmailInput('');
      onComplete?.();
    } catch {
      showAlert({ title: 'Error', message: 'Failed to send invite. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleOpenWhatsApp() {
    if (busy) return;
    setBusy(true);
    try {
      const shareText = await fetchWhatsAppShareText();
      await openWhatsAppShare(shareText);
      Toast.show({
        type: 'success',
        text1: 'WhatsApp opened',
        text2: 'Pick a contact — the invite message is ready to send',
      });
      onComplete?.();
    } catch {
      showAlert({ title: 'Error', message: 'Could not open WhatsApp. Make sure it is installed.' });
    } finally {
      setBusy(false);
    }
  }

  async function shareSmsWithPhone(phone: string) {
    if (busy) return;
    setBusy(true);
    try {
      const shareText = await fetchSmsShareText(phone);
      await openSms(phone, shareText);
      Toast.show({ type: 'success', text1: 'Ready to send', text2: 'Finish sending in Messages' });
      onComplete?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'ALREADY_MEMBER') {
        showAlert({
          title: variant === 'event' ? 'Already on event' : 'Already on trip',
          message:
            variant === 'event'
              ? 'This person is already a member of this event.'
              : 'This person is already a member of this trip.',
        });
      } else {
        showAlert({ title: 'Error', message: 'Could not prepare the invite. Please try again.' });
      }
    } finally {
      setBusy(false);
    }
  }

  async function shareWithContact(contact: PickableContact) {
    setContactPickerOpen(false);
    const phone = pickBestPhone(contact.phones);
    if (!phone) {
      showAlert({ title: 'No number', message: `${contact.name} has no phone number.` });
      return;
    }
    await shareSmsWithPhone(phone);
  }

  async function openContactPicker() {
    setContactsLoading(true);
    setContactPickerOpen(true);
    setContactSearch('');
    try {
      const ok = await requestContactsPermission();
      if (!ok) {
        setContactPickerOpen(false);
        showAlert({
          title: 'Contacts access',
          message: 'Allow contacts access in Settings to pick someone from your phone book.',
        });
        return;
      }
      setContacts(await loadPickableContacts());
    } catch {
      setContactPickerOpen(false);
      showAlert({ title: 'Error', message: 'Could not load contacts.' });
    } finally {
      setContactsLoading(false);
    }
  }

  async function handleManualSmsSend() {
    const phone = phoneInput.trim();
    if (!phone) {
      showAlert({ title: 'Error', message: 'Enter a phone number' });
      return;
    }
    await shareSmsWithPhone(phone);
    setPhoneInput('');
  }

  return (
    <View>
      <View style={styles.channelRow}>
        {(['email', 'sms', 'whatsapp'] as InviteChannel[]).map(key => {
          if (key === 'whatsapp') {
            const selected = channel === 'whatsapp';
            return (
              <TouchableOpacity
                key={key}
                onPress={() => setChannel('whatsapp')}
                activeOpacity={0.85}
                style={[styles.iconBtn, selected && styles.iconBtnActive]}
              >
                <WhatsAppGlyph color={selected ? '#fff' : '#64748b'} />
              </TouchableOpacity>
            );
          }
          const selected = channel === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setChannel(key)}
              style={[styles.iconBtn, selected && styles.iconBtnActive]}
              activeOpacity={0.7}
            >
              <ChannelIcon channel={key} active={selected} />
            </TouchableOpacity>
          );
        })}
      </View>

      {channel === 'email' && (
        <View style={styles.manualRow}>
          <TextInput
            style={styles.input}
            placeholder="Enter email address"
            placeholderTextColor="#94a3b8"
            value={emailInput}
            onChangeText={setEmailInput}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleEmailSend} disabled={busy} activeOpacity={0.85}>
            {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.sendBtnTxt}>Send</Text>}
          </TouchableOpacity>
        </View>
      )}

      {channel === 'sms' && (
        <>
          <Text style={styles.hint}>Pick a contact — Messages opens with the invite link filled in.</Text>
          <TouchableOpacity
            style={[styles.chooseBtn, busy && styles.chooseBtnDisabled]}
            onPress={openContactPicker}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.chooseBtnText}>Choose from contacts</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowManualPhone(v => !v)} style={styles.manualToggle} activeOpacity={0.7}>
            <Text style={styles.manualToggleText}>
              {showManualPhone ? 'Hide manual entry' : 'Or enter number manually'}
            </Text>
          </TouchableOpacity>
          {showManualPhone && (
            <View style={styles.manualRow}>
              <TextInput
                style={styles.input}
                placeholder="Phone number"
                placeholderTextColor="#94a3b8"
                value={phoneInput}
                onChangeText={setPhoneInput}
                keyboardType="phone-pad"
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.sendBtn} onPress={handleManualSmsSend} disabled={busy} activeOpacity={0.85}>
                {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.sendBtnTxt}>Open</Text>}
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {channel === 'whatsapp' && (
        <>
          <Text style={styles.hint}>
            Opens WhatsApp — pick who to send to and the invite link will already be typed for you.
          </Text>
          <TouchableOpacity
            style={[styles.whatsappShareBtn, busy && styles.chooseBtnDisabled]}
            onPress={handleOpenWhatsApp}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.chooseBtnText}>Open WhatsApp</Text>
            )}
          </TouchableOpacity>
        </>
      )}

      <Modal visible={contactPickerOpen} transparent animationType="slide" onRequestClose={() => setContactPickerOpen(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Choose a contact</Text>
              <TouchableOpacity onPress={() => setContactPickerOpen(false)} hitSlop={12}>
                <Text style={styles.pickerClose}>Done</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.pickerSearch}
              placeholder="Search name or number..."
              placeholderTextColor="#94a3b8"
              value={contactSearch}
              onChangeText={setContactSearch}
              autoCapitalize="none"
            />
            {contactsLoading ? (
              <ActivityIndicator style={{ marginVertical: 24 }} color="#0d9488" />
            ) : (
              <FlatList
                data={filteredContacts}
                keyExtractor={item => item.id}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={styles.emptyContacts}>
                    {contacts.length === 0 ? 'No contacts with phone numbers found.' : 'No matches.'}
                  </Text>
                }
                renderItem={({ item }) => {
                  const sub = pickBestPhone(item.phones);
                  return (
                    <TouchableOpacity style={styles.contactRow} onPress={() => shareWithContact(item)} activeOpacity={0.75}>
                      <View style={styles.contactAvatar}>
                        <Text style={styles.contactAvatarText}>{(item.name[0] || '?').toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.contactName}>{item.name}</Text>
                        {sub ? <Text style={styles.contactSub} numberOfLines={1}>{sub}</Text> : null}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  channelRow: { flexDirection: 'row', gap: 10, marginBottom: 16, alignItems: 'center', justifyContent: 'center' },
  iconBtn: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnActive: { borderColor: '#0d9488', backgroundColor: '#0d9488' },
  hint: { fontSize: 12, color: '#64748b', lineHeight: 18, marginBottom: 14 },
  chooseBtn: {
    backgroundColor: '#0d9488',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  whatsappShareBtn: {
    backgroundColor: '#0d9488',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  chooseBtnDisabled: { opacity: 0.7 },
  chooseBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  manualToggle: { alignItems: 'center', marginTop: 12, marginBottom: 4 },
  manualToggleText: { fontSize: 13, color: '#0d9488', fontWeight: '600' },
  manualRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  sendBtn: {
    backgroundColor: '#0d9488',
    borderRadius: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '78%',
    paddingBottom: 24,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  pickerTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  pickerClose: { fontSize: 15, fontWeight: '600', color: '#0d9488' },
  pickerSearch: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0fdfa',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contactAvatarText: { fontSize: 16, fontWeight: '700', color: '#0d9488' },
  contactName: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  contactSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  emptyContacts: { textAlign: 'center', color: '#94a3b8', marginTop: 24, fontSize: 14 },
});
