import type { OpenInviteResult } from '../api/invites.api';
import type { PendingInvite } from '../store/pendingInviteStore';

/**
 * What the app does with the answer to POST /invites/open/:token.
 * Pure on purpose: App.tsx just executes the action, this decides it.
 */
export type OpenInviteAction =
  | { kind: 'requests'; previewRequest?: { type: 'trip' | 'event'; id: string } }
  | { kind: 'detail'; screen: 'TripDetail' | 'EventDetail'; id: string }
  | { kind: 'toast'; tone: 'info'; text: string };

export function actionForOpenResult(result: OpenInviteResult): OpenInviteAction {
  if (result.type === 'friend') {
    const name = result.inviterName || 'them';
    if (result.status === 'already_friends') {
      return { kind: 'toast', tone: 'info', text: `You're already friends with ${name}` };
    }
    if (result.status === 'outgoing_pending') {
      return { kind: 'toast', tone: 'info', text: `You already sent ${name} a request` };
    }
    return { kind: 'requests' };
  }

  if (result.status === 'member') {
    return result.type === 'trip'
      ? { kind: 'detail', screen: 'TripDetail', id: result.tripId }
      : { kind: 'detail', screen: 'EventDetail', id: result.eventId };
  }
  return { kind: 'requests', previewRequest: { type: result.type, id: result.inviteId } };
}

export type OpenInviteFailure = {
  toast: string;
  /**
   * True when the server never gave a definitive answer (offline, 5xx, rate limit,
   * expired session) — the pending invite is kept so it is tried again on the next start.
   */
  retryable: boolean;
};

const EXPIRED = 'This invite link has expired or was already used';

export function failureForOpenError(err: any, invite: Pick<PendingInvite, 'type'>): OpenInviteFailure {
  const status: number | undefined = err?.response?.status;
  const code: string | undefined = err?.response?.data?.error;
  const message: string = err?.response?.data?.message ?? '';

  if (!status || status >= 500 || status === 429 || status === 401) {
    return { toast: "Couldn't open the invite — check your connection", retryable: true };
  }

  switch (code) {
    case 'SELF_CLAIM':
      return { toast: 'This is your own invite link', retryable: false };
    case 'FORBIDDEN':
      return { toast: 'This invite was sent to someone else', retryable: false };
    case 'NOT_FOUND':
      // Only a deleted trip/event says so; an unknown token is just a dead link.
      return {
        toast: invite.type !== 'friend' && /no longer exists/i.test(message)
          ? `This ${invite.type} no longer exists`
          : EXPIRED,
        retryable: false,
      };
    case 'INVALID_INVITE':
    default:
      return { toast: EXPIRED, retryable: false };
  }
}
