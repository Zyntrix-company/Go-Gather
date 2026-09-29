import client from './client';

export type InviteType = 'trip' | 'event' | 'friend';

export type InvitePreview = {
  valid: boolean;
  reason?: 'NOT_FOUND' | 'ALREADY_CLAIMED' | 'EXPIRED';
  type?: InviteType;
  token?: string;
  expiresAt?: string;
  invitedBy?: { name: string | null; avatarUrl: string | null };
  context?: { tripName: string | null; eventName: string | null };
  installLinks?: { android?: string; ios?: string };
};

export type ClaimInviteResult =
  | { type: 'trip'; tripId: string; tripName?: string }
  | { type: 'event'; eventId: string; eventName?: string }
  | { type: 'friend'; status: 'pending' | 'accepted'; connectionId: string | null };

export async function validateInvite(token: string): Promise<InvitePreview> {
  const res = await client.get(`/invites/validate/${token}`);
  return res.data as InvitePreview;
}

export async function claimInvite(token: string): Promise<ClaimInviteResult> {
  const res = await client.post(`/invites/claim/${token}`);
  return res.data as ClaimInviteResult;
}
