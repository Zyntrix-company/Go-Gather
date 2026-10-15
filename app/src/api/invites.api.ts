import client from './client';

export type InviteType = 'trip' | 'event' | 'friend';

/**
 * Answer to POST /invites/open/:token. Opening never joins anyone: a friend link
 * leaves a pending friend request, a trip/event link leaves a pending request that is
 * accepted from the popup. Errors: SELF_CLAIM, INVALID_INVITE, NOT_FOUND, FORBIDDEN.
 */
export type OpenInviteResult =
  | { type: 'friend'; status: 'pending' | 'already_friends' | 'outgoing_pending'; inviterName: string | null }
  | { type: 'trip'; status: 'pending'; inviteId: string; tripId: string }
  | { type: 'trip'; status: 'member'; tripId: string }
  | { type: 'event'; status: 'pending'; inviteId: string; eventId: string }
  | { type: 'event'; status: 'member'; eventId: string };

export async function openInvite(token: string): Promise<OpenInviteResult> {
  const res = await client.post(`/invites/open/${token}`);
  return res.data as OpenInviteResult;
}
