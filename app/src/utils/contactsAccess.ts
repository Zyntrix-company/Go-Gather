import { PermissionsAndroid, Platform } from 'react-native';
import Contacts, { Contact } from 'react-native-contacts';

export type ContactPhone = { number: string; label: string };

export type PickableContact = {
  id: string;
  name: string;
  phones: ContactPhone[];
  emails: string[];
};

export async function requestContactsPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
      {
        title: 'Contacts',
        message: 'GatherGo needs access to your contacts so you can invite friends via SMS or WhatsApp.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  const status = await Contacts.requestPermission();
  return status === 'authorized';
}

function contactDisplayName(c: Contact): string {
  const name = [c.givenName, c.middleName, c.familyName].filter(Boolean).join(' ').trim();
  return name || c.displayName || c.company || 'Unknown';
}

export function mapContact(c: Contact): PickableContact | null {
  const phones: ContactPhone[] = (c.phoneNumbers ?? [])
    .map(p => ({ number: p.number?.trim() ?? '', label: (p.label || '').toLowerCase() }))
    .filter(p => !!p.number);
  const emails = (c.emailAddresses ?? [])
    .map(e => e.email?.trim())
    .filter((n): n is string => !!n);
  if (!phones.length && !emails.length) return null;
  return {
    id: c.recordID,
    name: contactDisplayName(c),
    phones,
    emails,
  };
}

/** Prefer mobile/iPhone/cell label, otherwise first number. */
export function pickBestPhone(phones: ContactPhone[]): string | null {
  if (!phones.length) return null;
  const mobile = phones.find(
    p => p.label.includes('mobile') || p.label.includes('iphone') || p.label.includes('cell'),
  );
  return (mobile ?? phones[0]).number;
}

export async function loadPickableContacts(): Promise<PickableContact[]> {
  const raw = await Contacts.getAll();
  const mapped = raw
    .map(mapContact)
    .filter((c): c is PickableContact => c !== null)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return mapped;
}
