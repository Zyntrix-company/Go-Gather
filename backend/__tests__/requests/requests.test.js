const request = require('supertest');
const app = require('../../src/app');
const { generateAccessToken } = require('../../src/utils/token');

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { connect: jest.fn(), end: jest.fn() },
}));

jest.mock('../../src/config/aws', () => ({
  s3Client: {},
  sesClient: { send: jest.fn() },
  snsClient: { send: jest.fn() },
}));

jest.mock('../../src/utils/fcm.util', () => ({
  sendFCMNotification: jest.fn().mockResolvedValue(true),
  notifyUsers: jest.fn().mockResolvedValue(true),
  createAndSendNotification: jest.fn().mockResolvedValue(true),
  createAndSendNotifications: jest.fn().mockResolvedValue(true),
  registerDeviceToken: jest.fn().mockResolvedValue(true),
  isInQuietHours: jest.fn().mockReturnValue(false),
  notifySafely: jest.fn((factory) => { try { const r = factory(); if (r?.catch) r.catch(() => {}); } catch { /* swallowed */ } }),
}));

jest.mock('../../src/utils/branch.util', () => ({
  createInviteSmartLink: jest.fn().mockResolvedValue('https://gatherrgo.com/invite/test'),
}));

jest.mock('../../src/utils/mailer', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  sendVerificationOTPEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetOTPEmail: jest.fn().mockResolvedValue(true),
  sendConnectionRequestEmail: jest.fn().mockResolvedValue(true),
  sendRequestAcceptedEmail: jest.fn().mockResolvedValue(true),
  wrapEmail: jest.fn((html) => html),
  buildInviteEmail: jest.fn(() => '<html></html>'),
}));

const db = require('../../src/config/database');
const { createAndSendNotification } = require('../../src/utils/fcm.util');

// ── Constants ─────────────────────────────────────────────────────────────────

const ALICE     = '123e4567-e89b-12d3-a456-426614174000'; // inviter / current user
const BOB       = '223e4567-e89b-12d3-a456-426614174001'; // invitee
const TRIP_ID   = 'aaaa0001-0000-4000-8000-000000000001';
const EVENT_ID  = 'bbbb0001-0000-4000-8000-000000000001';
const INVITE_ID = 'cccc0001-0000-4000-8000-000000000001';
const CONN_ID   = 'dddd0001-0000-4000-8000-000000000001';

const aliceToken = generateAccessToken({ id: ALICE, email: 'alice@test.com' });
const bobToken   = generateAccessToken({ id: BOB,   email: 'bob@test.com' });

/**
 * Route queries by the SQL they run rather than by call order — order-based
 * mocks break every time an unrelated query is added.
 */
const routeQueries = (handlers) => {
  db.query.mockImplementation(async (sql) => {
    const text = String(sql).replace(/\s+/g, ' ').trim();
    for (const [pattern, result] of handlers) {
      if (text.includes(pattern)) {
        return typeof result === 'function' ? result(text) : result;
      }
    }
    return { rows: [], rowCount: 0 };
  });
};

const EMPTY = { rows: [], rowCount: 0 };

describe('Invites as approval-based requests', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── Invite must create a request, never a member ───────────────────────────

  describe('POST /trips/:id/invite', () => {
    it('creates a pending request for a friend instead of adding them to the trip', async () => {
      const inserts = [];

      db.query.mockImplementation(async (sql, params) => {
        const text = String(sql).replace(/\s+/g, ' ').trim();
        if (text.startsWith('INSERT')) inserts.push(text);

        if (text.includes('SELECT id FROM trips WHERE id'))            return { rows: [{ id: TRIP_ID }], rowCount: 1 };
        if (text.includes('SELECT role FROM trip_members'))            return { rows: [{ role: 'admin' }], rowCount: 1 };
        if (text.includes('FROM profiles p WHERE p.user_id'))          return { rows: [{ full_name: 'Alice' }], rowCount: 1 };
        if (text.includes('SELECT name FROM trips'))                   return { rows: [{ name: 'Goa Trip' }], rowCount: 1 };
        if (text.includes('FROM friend_connections'))                  return { rows: [{ id: CONN_ID }], rowCount: 1 };
        if (text.includes('SELECT 1 FROM trip_members'))               return EMPTY; // not a member yet
        if (text.includes('INSERT INTO trip_invites'))                 return { rows: [{ id: INVITE_ID }], rowCount: 1 };
        if (text.includes('SELECT full_name AS name FROM profiles'))   return { rows: [{ name: 'Bob' }], rowCount: 1 };
        return EMPTY;
      });

      const res = await request(app)
        .post(`/trips/${TRIP_ID}/invite`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ friendIds: [BOB] });

      expect(res.statusCode).toBe(200);
      expect(res.body.requested).toHaveLength(1);
      expect(res.body.requested[0]).toMatchObject({ userId: BOB, inviteId: INVITE_ID });
      expect(res.body.added).toEqual([]);

      // The whole point: no membership row is created by an invite.
      expect(inserts.some((s) => s.includes('INSERT INTO trip_members'))).toBe(false);
      expect(inserts.some((s) => s.includes('INSERT INTO trip_invites'))).toBe(true);

      expect(createAndSendNotification).toHaveBeenCalledWith(
        BOB,
        expect.objectContaining({ title: expect.stringContaining('Goa Trip') }),
        'TRIP_REQUEST',
        expect.objectContaining({ tripId: TRIP_ID, inviteId: INVITE_ID, screen: 'requests' }),
      );
    });

    it('skips someone who is already a member', async () => {
      db.query.mockImplementation(async (sql) => {
        const text = String(sql).replace(/\s+/g, ' ').trim();
        if (text.includes('SELECT id FROM trips WHERE id'))   return { rows: [{ id: TRIP_ID }], rowCount: 1 };
        if (text.includes('SELECT role FROM trip_members'))   return { rows: [{ role: 'admin' }], rowCount: 1 };
        if (text.includes('FROM profiles p WHERE p.user_id')) return { rows: [{ full_name: 'Alice' }], rowCount: 1 };
        if (text.includes('SELECT name FROM trips'))          return { rows: [{ name: 'Goa Trip' }], rowCount: 1 };
        if (text.includes('FROM friend_connections'))         return { rows: [{ id: CONN_ID }], rowCount: 1 };
        if (text.includes('SELECT 1 FROM trip_members'))      return { rows: [{ '?column?': 1 }], rowCount: 1 };
        return EMPTY;
      });

      const res = await request(app)
        .post(`/trips/${TRIP_ID}/invite`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ friendIds: [BOB] });

      expect(res.statusCode).toBe(200);
      expect(res.body.requested).toEqual([]);
      expect(res.body.skipped).toEqual([{ userId: BOB, reason: 'already_member' }]);
    });
  });

  // ── GET /requests ──────────────────────────────────────────────────────────

  describe('GET /requests', () => {
    it('returns pending friend, trip and event requests in one list', async () => {
      routeQueries([
        ['FROM friend_connections fc', {
          rows: [{
            id: CONN_ID,
            created_at: '2026-07-10T10:00:00Z',
            requester_id: ALICE,
            inviter_name: 'Alice',
            inviter_avatar: null,
          }],
          rowCount: 1,
        }],
        ['FROM trip_invites ti', {
          rows: [{
            id: INVITE_ID,
            created_at: '2026-07-12T10:00:00Z',
            expires_at: '2026-07-19T10:00:00Z',
            trip_id: TRIP_ID,
            invited_by: ALICE,
            context_name: 'Goa Trip',
            location_name: 'Goa',
            start_date: '2026-08-01',
            end_date: '2026-08-05',
            inviter_name: 'Alice',
            inviter_avatar: null,
          }],
          rowCount: 1,
        }],
        ['FROM event_invites ei', {
          rows: [{
            id: 'eeee0001-0000-4000-8000-000000000001',
            created_at: '2026-07-11T10:00:00Z',
            expires_at: '2026-07-18T10:00:00Z',
            event_id: EVENT_ID,
            invited_by: ALICE,
            context_name: 'Birthday',
            location_name: null,
            start_date: '2026-09-01',
            end_date: '2026-09-01',
            inviter_name: 'Alice',
            inviter_avatar: null,
          }],
          rowCount: 1,
        }],
      ]);

      const res = await request(app)
        .get('/requests')
        .set('Authorization', `Bearer ${bobToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.total).toBe(3);

      // Newest first.
      expect(res.body.requests.map((r) => r.type)).toEqual(['trip', 'event', 'friend']);

      const trip = res.body.requests.find((r) => r.type === 'trip');
      expect(trip.id).toBe(INVITE_ID);                 // the id needed to approve it
      expect(trip.from).toMatchObject({ id: ALICE, name: 'Alice' });
      expect(trip.context).toMatchObject({ tripId: TRIP_ID, name: 'Goa Trip' });

      const friend = res.body.requests.find((r) => r.type === 'friend');
      expect(friend.id).toBe(CONN_ID);                 // connectionId
    });

    it('requires auth', async () => {
      const res = await request(app).get('/requests');
      expect(res.statusCode).toBe(401);
    });
  });

  // ── Approve / decline ──────────────────────────────────────────────────────

  describe('PUT /requests/trip/:id', () => {
    it('approve adds the member and marks the invite accepted', async () => {
      const client = {
        query: jest.fn(),
        release: jest.fn(),
      };
      client.query.mockImplementation(async (sql) => {
        const text = String(sql).replace(/\s+/g, ' ').trim();
        if (text.includes('FROM trip_invites') && text.includes('FOR UPDATE')) {
          return { rows: [{ id: INVITE_ID, trip_id: TRIP_ID, invited_by: ALICE, user_id: BOB }], rowCount: 1 };
        }
        return EMPTY;
      });
      db.getClient.mockResolvedValue(client);

      routeQueries([
        ['SELECT name FROM trips',   { rows: [{ name: 'Goa Trip' }], rowCount: 1 }],
        ['role = \'admin\'',         { rows: [{ user_id: ALICE }], rowCount: 1 }],
        ['FROM profiles',            { rows: [{ full_name: 'Bob' }], rowCount: 1 }],
      ]);

      const res = await request(app)
        .put(`/requests/trip/${INVITE_ID}`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ action: 'approve' });

      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({ type: 'trip', status: 'accepted', tripId: TRIP_ID });

      const statements = client.query.mock.calls.map(([s]) => String(s).replace(/\s+/g, ' '));
      expect(statements.some((s) => s.includes('INSERT INTO trip_members'))).toBe(true);
      expect(statements.some((s) => s.includes("SET status = 'accepted'"))).toBe(true);
      expect(statements).toContain('COMMIT');
    });

    it('rejects approving a request addressed to someone else', async () => {
      const client = { query: jest.fn(), release: jest.fn() };
      client.query.mockImplementation(async (sql) => {
        const text = String(sql).replace(/\s+/g, ' ').trim();
        if (text.includes('FROM trip_invites') && text.includes('FOR UPDATE')) {
          // Addressed to Alice, but Bob is the caller.
          return { rows: [{ id: INVITE_ID, trip_id: TRIP_ID, invited_by: ALICE, user_id: ALICE }], rowCount: 1 };
        }
        return EMPTY;
      });
      db.getClient.mockResolvedValue(client);

      const res = await request(app)
        .put(`/requests/trip/${INVITE_ID}`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ action: 'approve' });

      expect(res.statusCode).toBe(403);
      const statements = client.query.mock.calls.map(([s]) => String(s));
      expect(statements.some((s) => s.includes('INSERT INTO trip_members'))).toBe(false);
    });

    it('decline marks the invite declined and adds no member', async () => {
      routeQueries([
        ["UPDATE trip_invites SET status = 'declined'", { rows: [{ id: INVITE_ID }], rowCount: 1 }],
      ]);

      const res = await request(app)
        .put(`/requests/trip/${INVITE_ID}`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ action: 'decline' });

      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({ type: 'trip', status: 'declined' });

      const statements = db.query.mock.calls.map(([s]) => String(s));
      expect(statements.some((s) => s.includes('INSERT INTO trip_members'))).toBe(false);
    });

    it('404s when the request is not yours or already answered', async () => {
      routeQueries([["UPDATE trip_invites SET status = 'declined'", EMPTY]]);

      const res = await request(app)
        .put(`/requests/trip/${INVITE_ID}`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ action: 'decline' });

      expect(res.statusCode).toBe(404);
    });

    it('rejects an unknown action', async () => {
      const res = await request(app)
        .put(`/requests/trip/${INVITE_ID}`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ action: 'maybe' });

      expect(res.statusCode).toBe(422); // validate middleware's code for a bad body
    });
  });

  describe('PUT /requests/friend/:id', () => {
    it('approve accepts the friend connection', async () => {
      routeQueries([
        ['SELECT id, requester_id, addressee_id, status FROM friend_connections', {
          rows: [{ id: CONN_ID, requester_id: ALICE, addressee_id: BOB, status: 'pending' }],
          rowCount: 1,
        }],
        ['UPDATE friend_connections SET status', { rows: [], rowCount: 1 }],
        ['FROM profiles p WHERE p.user_id', { rows: [{ full_name: 'Bob', avatar_url: null }], rowCount: 1 }],
        ['SELECT u.email, p.full_name', { rows: [{ email: 'alice@test.com', full_name: 'Alice' }], rowCount: 1 }],
      ]);

      const res = await request(app)
        .put(`/requests/friend/${CONN_ID}`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ action: 'approve' });

      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({ type: 'friend', status: 'accepted' });

      const statements = db.query.mock.calls.map(([s]) => String(s).replace(/\s+/g, ' '));
      expect(statements.some((s) => s.includes('UPDATE friend_connections SET status'))).toBe(true);
    });

    it('forbids responding to someone else’s request', async () => {
      routeQueries([
        ['SELECT id, requester_id, addressee_id, status FROM friend_connections', {
          rows: [{ id: CONN_ID, requester_id: ALICE, addressee_id: ALICE, status: 'pending' }],
          rowCount: 1,
        }],
      ]);

      const res = await request(app)
        .put(`/requests/friend/${CONN_ID}`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ action: 'approve' });

      expect(res.statusCode).toBe(403);
    });
  });
});

// ── Signup matching ──────────────────────────────────────────────────────────

describe('linkPendingInvitesToUser (install → sign up → request appears)', () => {
  const { linkPendingInvitesToUser } = require('../../src/modules/invites/invites.service');

  beforeEach(() => jest.clearAllMocks());

  it('attaches a trip invite that was addressed to the new user’s email', async () => {
    routeQueries([
      ['UPDATE trip_invites ti', {
        rows: [{ id: INVITE_ID, trip_id: TRIP_ID, trip_name: 'Goa Trip', inviter_name: 'Alice' }],
        rowCount: 1,
      }],
      ['UPDATE event_invites ei', EMPTY],
      ['FROM friend_invites fi', EMPTY],
    ]);

    const summary = await linkPendingInvitesToUser(BOB, { email: 'bob@test.com', phone: null });

    expect(summary.trips).toBe(1);
    expect(createAndSendNotification).toHaveBeenCalledWith(
      BOB,
      expect.objectContaining({ title: expect.stringContaining('Goa Trip') }),
      'TRIP_REQUEST',
      expect.objectContaining({ tripId: TRIP_ID, screen: 'requests' }),
    );
  });

  it('attaches an event invite that was addressed to the new user’s phone', async () => {
    routeQueries([
      ['UPDATE trip_invites ti', EMPTY],
      ['UPDATE event_invites ei', {
        rows: [{ id: INVITE_ID, event_id: EVENT_ID, event_name: 'Birthday', inviter_name: 'Alice' }],
        rowCount: 1,
      }],
      ['FROM friend_invites fi', EMPTY],
    ]);

    const summary = await linkPendingInvitesToUser(BOB, { email: null, phone: '+919999999999' });

    expect(summary.events).toBe(1);
    expect(createAndSendNotification).toHaveBeenCalledWith(
      BOB,
      expect.objectContaining({ title: expect.stringContaining('Birthday') }),
      'EVENT_REQUEST',
      expect.objectContaining({ eventId: EVENT_ID, screen: 'requests' }),
    );
  });

  it('turns a matching friend invite into a pending friend request', async () => {
    routeQueries([
      ['UPDATE trip_invites ti', EMPTY],
      ['UPDATE event_invites ei', EMPTY],
      ['FROM friend_invites fi', {
        rows: [{ id: 'ffff0001-0000-4000-8000-000000000001', token: 'tok', invited_by: ALICE, inviter_name: 'Alice' }],
        rowCount: 1,
      }],
      ['INSERT INTO friend_connections', { rows: [{ id: CONN_ID }], rowCount: 1 }],
    ]);

    const summary = await linkPendingInvitesToUser(BOB, { email: 'bob@test.com', phone: null });

    expect(summary.friends).toBe(1);
    expect(createAndSendNotification).toHaveBeenCalledWith(
      BOB,
      expect.objectContaining({ title: expect.stringContaining('Alice') }),
      'FRIEND_REQUEST',
      expect.objectContaining({ connectionId: CONN_ID, screen: 'requests' }),
    );
  });

  it('does nothing when the new user has neither a matching email nor phone', async () => {
    const summary = await linkPendingInvitesToUser(BOB, {});
    expect(summary).toEqual({ trips: 0, events: 0, friends: 0 });
    expect(db.query).not.toHaveBeenCalled();
  });
});
