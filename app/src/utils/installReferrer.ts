import { NativeModules, Platform } from 'react-native';
import usePendingInviteStore, { PendingInvite } from '../store/pendingInviteStore';

/**
 * Play Install Referrer — the Android half of deferred deep linking.
 *
 * The invite landing page sends a recipient without the app to the Play Store with
 * `&referrer=invite%3D{type}%2F{token}` (built in backend invites.service.js). Play
 * hands that string back on first launch; we turn it into a pending invite and let the
 * normal flow (App.tsx) carry it through login to AcceptInvite.
 */

const INVITE_PARAM = /(?:^|&)invite=([^&]+)/;
const INVITE_VALUE = /^(trip|event|friend)\/([A-Za-z0-9_-]+)$/;

/** Parses a raw referrer string (`invite=friend/<token>`, possibly URL-encoded). */
export function parseInstallReferrer(raw: string | null | undefined): PendingInvite | null {
  if (!raw) return null;
  const param = raw.match(INVITE_PARAM);
  if (!param) return null;

  let value: string;
  try {
    value = decodeURIComponent(param[1]);
  } catch {
    return null;
  }
  const match = value.match(INVITE_VALUE);
  if (!match) return null;
  return { type: match[1] as PendingInvite['type'], token: match[2] };
}

/**
 * Reads the install referrer (the native side hands it out once per install) and, if it
 * carries an invite, stores it as the pending invite. Android only; a no-op elsewhere.
 */
export async function applyInstallReferrer(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const native = NativeModules.InstallReferrer as
    | { consumeInstallReferrer: () => Promise<string | null> }
    | undefined;
  if (!native) return;

  try {
    const invite = parseInstallReferrer(await native.consumeInstallReferrer());
    // A link tapped after install (App Link / custom scheme) may already have set one.
    if (invite && !usePendingInviteStore.getState().pendingInvite) {
      usePendingInviteStore.getState().setPendingInvite(invite);
    }
  } catch {
    // Best effort: a missing referrer must never block app start.
  }
}
