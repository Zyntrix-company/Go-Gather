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
