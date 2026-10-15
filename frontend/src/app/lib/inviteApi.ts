export type InviteType = 'trip' | 'event' | 'friend';

export type InvitePreview = {
  valid: boolean;
  reason?: 'NOT_FOUND' | 'ALREADY_CLAIMED' | 'EXPIRED';
  type?: InviteType;
  token?: string;
  /** null for a reusable trip/event share link — those never expire. */
  expiresAt?: string | null;
  invitedBy?: { name: string | null; avatarUrl: string | null };
  context?: {
    tripName: string | null;
    eventName: string | null;
    // trip / event only. The page is public, so this is a head-count — never member names.
    startDate?: string | null;
    endDate?: string | null;
    locationName?: string | null;
    memberCount?: number | null;
  };
  installLinks?: { android?: string; ios?: string };
};

function apiRoot(): string {
  const base = import.meta.env.VITE_API_URL || 'https://api.gatherrgo.com';
  return String(base).replace(/\/$/, '');
}

export async function fetchInvitePreview(token: string): Promise<InvitePreview> {
  const res = await fetch(`${apiRoot()}/invites/validate/${encodeURIComponent(token)}`);
  if (!res.ok) {
    throw new Error(`Failed to load invite (${res.status})`);
  }
  return res.json();
}
