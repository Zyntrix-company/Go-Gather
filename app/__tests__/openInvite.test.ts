import { actionForOpenResult, failureForOpenError } from '../src/utils/openInvite';
import type { OpenInviteResult } from '../src/api/invites.api';

const TRIP = 'aaaa0001-0000-4000-8000-000000000001';
const EVENT = 'bbbb0001-0000-4000-8000-000000000001';
const INVITE = 'cccc0001-0000-4000-8000-000000000001';

describe('actionForOpenResult', () => {
  it('friend link → Requests tab, no popup', () => {
    const r: OpenInviteResult = { type: 'friend', status: 'pending', inviterName: 'Asha' };
    expect(actionForOpenResult(r)).toEqual({ kind: 'requests' });
  });

  it('already friends → toast naming them', () => {
    const r: OpenInviteResult = { type: 'friend', status: 'already_friends', inviterName: 'Asha' };
    expect(actionForOpenResult(r)).toEqual({ kind: 'toast', tone: 'info', text: "You're already friends with Asha" });
  });

  it('they already sent a request → toast', () => {
    const r: OpenInviteResult = { type: 'friend', status: 'outgoing_pending', inviterName: 'Asha' };
    expect(actionForOpenResult(r)).toEqual({ kind: 'toast', tone: 'info', text: 'You already sent Asha a request' });
  });

  it('falls back gracefully when the inviter has no name', () => {
    const r: OpenInviteResult = { type: 'friend', status: 'already_friends', inviterName: null };
    expect(actionForOpenResult(r)).toMatchObject({ text: "You're already friends with them" });
  });

  it('trip link → Requests tab with the popup for that request', () => {
    const r: OpenInviteResult = { type: 'trip', status: 'pending', inviteId: INVITE, tripId: TRIP };
    expect(actionForOpenResult(r)).toEqual({ kind: 'requests', previewRequest: { type: 'trip', id: INVITE } });
  });

  it('event link → Requests tab with the popup for that request', () => {
    const r: OpenInviteResult = { type: 'event', status: 'pending', inviteId: INVITE, eventId: EVENT };
    expect(actionForOpenResult(r)).toEqual({ kind: 'requests', previewRequest: { type: 'event', id: INVITE } });
  });

  it('already a member (or the sharer) → straight to the trip / event', () => {
    expect(actionForOpenResult({ type: 'trip', status: 'member', tripId: TRIP }))
      .toEqual({ kind: 'detail', screen: 'TripDetail', id: TRIP });
    expect(actionForOpenResult({ type: 'event', status: 'member', eventId: EVENT }))
      .toEqual({ kind: 'detail', screen: 'EventDetail', id: EVENT });
  });
});

describe('failureForOpenError', () => {
  const http = (status: number, error?: string, message?: string) => ({ response: { status, data: { error, message } } });

  it.each([
    ['SELF_CLAIM', 400, 'This is your own invite link'],
    ['INVALID_INVITE', 404, 'This invite link has expired or was already used'],
    ['FORBIDDEN', 403, 'This invite was sent to someone else'],
  ])('%s is definitive with its own message', (code, status, toast) => {
    expect(failureForOpenError(http(status, code), { type: 'friend' })).toEqual({ toast, retryable: false });
  });

  it('a deleted trip/event says so', () => {
    expect(failureForOpenError(http(404, 'NOT_FOUND', 'This trip no longer exists'), { type: 'trip' }))
      .toEqual({ toast: 'This trip no longer exists', retryable: false });
    expect(failureForOpenError(http(404, 'NOT_FOUND', 'This event no longer exists'), { type: 'event' }))
      .toEqual({ toast: 'This event no longer exists', retryable: false });
  });

  it('an unknown token is just a dead link', () => {
    expect(failureForOpenError(http(404, 'NOT_FOUND', 'Invite not found'), { type: 'trip' }))
      .toEqual({ toast: 'This invite link has expired or was already used', retryable: false });
  });

  it.each([
    ['no response (offline)', { message: 'Network Error' }],
    ['a server error', http(503)],
    ['rate limiting', http(429)],
    ['an expired session', http(401)],
  ])('%s keeps the invite for the next start', (_label, err) => {
    expect(failureForOpenError(err, { type: 'trip' })).toEqual({
      toast: "Couldn't open the invite — check your connection",
      retryable: true,
    });
  });

  it('an unrecognised 4xx is treated as a dead link, not retried forever', () => {
    expect(failureForOpenError(http(400, 'SOMETHING_ELSE'), { type: 'friend' }).retryable).toBe(false);
  });
});
