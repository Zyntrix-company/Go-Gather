/**
 * Incoming requests — friend, trip and event invites all arrive here.
 * Nobody is added to anything until they approve.
 */
import client from './client';

export type RequestType = 'friend' | 'trip' | 'event';

export type RequestContext = {
  tripId?: string;
  eventId?: string;
  name: string;
  locationName: string | null;
  startDate: string | null;
  endDate: string | null;
};

export type IncomingRequest = {
  /** connectionId for friend requests, invite id for trip/event requests. */
  id: string;
  type: RequestType;
  from: { id: string; name: string | null; avatarUrl: string | null };
  context: RequestContext | null;
  createdAt: string;
  expiresAt: string | null;
};

export async function getRequests() {
  const res = await client.get('/requests');
  return res.data as { requests: IncomingRequest[]; total: number };
}

export async function respondToRequest(
  type: RequestType,
  id: string,
  action: 'approve' | 'decline',
) {
  const res = await client.put(`/requests/${type}/${id}`, { action });
  return res.data as {
    type: RequestType;
    id: string;
    status: 'accepted' | 'declined';
    tripId?: string;
    eventId?: string;
    name?: string;
  };
}

/** What the invite popup shows. Only the invitee can read it, and only while the request is pending. */
export type RequestPreview = {
  type: 'trip' | 'event';
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  locationName: string | null;
  /** Same banner the home card shows. Absent on older backends; the popup then uses the stock image. */
  bannerImageUrl?: string | null;
  inviter: { id: string; name: string | null; avatarUrl: string | null };
  members: { id: string; name: string | null; avatarUrl: string | null }[];
  memberCount: number;
};

export async function getRequestPreview(type: 'trip' | 'event', id: string) {
  const res = await client.get(`/requests/${type}/${id}/preview`);
  return res.data as RequestPreview;
}
