import { Linking, Platform } from 'react-native';

/** Digits only, suitable for WhatsApp `phone` param (include country code, no +). */
export function normalizePhoneDigits(raw: string): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  return hasPlus ? digits : digits;
}

export function buildTripInviteMessage(inviterName: string, tripName: string, branchUrl: string): string {
  return `${inviterName} is inviting you to join their trip "${tripName}" on GatherGo!

Plan trips together, split expenses, and keep all your travel memories in one place.

Accept the invite:
${branchUrl}`;
}

export function buildEventInviteMessage(inviterName: string, eventName: string, branchUrl: string): string {
  return `${inviterName} is inviting you to "${eventName}" on GatherGo!

Plan trips together, split expenses, and keep all your travel memories in one place.

Accept the invite:
${branchUrl}`;
}

export async function openSms(phone: string, body: string): Promise<boolean> {
  const digits = normalizePhoneDigits(phone);
  const encoded = encodeURIComponent(body);
  const separator = Platform.OS === 'ios' ? '&' : '?';
  const url = `sms:${digits}${separator}body=${encoded}`;
  return Linking.openURL(url);
}

export async function openWhatsAppShare(body: string): Promise<boolean> {
  const encoded = encodeURIComponent(body);
  const appUrl = `whatsapp://send?text=${encoded}`;
  const webUrl = `https://wa.me/?text=${encoded}`;
  if (await Linking.canOpenURL(appUrl)) {
    await Linking.openURL(appUrl);
    return true;
  }
  await Linking.openURL(webUrl);
  return true;
}

export async function openWhatsApp(phone: string, body: string): Promise<boolean> {
  const digits = normalizePhoneDigits(phone);
  const encoded = encodeURIComponent(body);
  const appUrl = `whatsapp://send?phone=${digits}&text=${encoded}`;
  const webUrl = `https://wa.me/${digits}?text=${encoded}`;
  if (await Linking.canOpenURL(appUrl)) {
    await Linking.openURL(appUrl);
    return true;
  }
  await Linking.openURL(webUrl);
  return true;
}

export async function openEmail(email: string, subject: string, body: string): Promise<boolean> {
  const url = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return Linking.openURL(url);
}
