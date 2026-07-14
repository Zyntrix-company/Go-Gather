const request = require('supertest');
const app = require('../../src/app');
const { generateAccessToken } = require('../../src/utils/token');

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

const db = require('../../src/config/database');

const USER_ID  = '123e4567-e89b-12d3-a456-426614174000';
const USER2_ID = '223e4567-e89b-12d3-a456-426614174001';
const TRIP_ID  = 'aaaa0001-0000-4000-8000-000000000001';
const token    = generateAccessToken({ id: USER_ID, email: 'alice@test.com' });

// Shared mock invite row
const validFriendInviteRow = {
  id: 'invite-row-id',
  invited_by: USER2_ID,
  expires_at: new Date(Date.now() + 7 * 24 * 3600000).toISOString(), // 7 days from now
  claimed_at: null,
  claimed_by: null,
  inviter_name: 'Bob Jones',
  inviter_avatar: 'https://cdn.test.com/bob.jpg',
};

const validTripInviteRow = {
  id: 'trip-invite-row-id',
  invited_by: USER2_ID,
  expires_at: new Date(Date.now() + 7 * 24 * 3600000).toISOString(),
  accepted_at: null,
  user_id: null,
  trip_id: TRIP_ID,
  context_name: 'Goa 2026',
  inviter_name: 'Bob Jones',
  inviter_avatar: null,
};

describe('Invites Routes', () => {
  beforeEach(() => jest.resetAllMocks());

  // ── GET /invites/validate/:token ───────────────────────────────────────────

  describe('GET /invites/validate/:token', () => {
    it('returns valid=false with reason NOT_FOUND for unknown token', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })  // friend_invites
        .mockResolvedValueOnce({ rows: [] })  // trip_invites
        .mockResolvedValueOnce({ rows: [] }); // event_invites

      const res = await request(app).get('/invites/validate/unknowntoken');

      expect(res.statusCode).toBe(200);
      expect(res.body.valid).toBe(false);
      expect(res.body.reason).toBe('NOT_FOUND');
    });

    it('returns valid=false with reason ALREADY_CLAIMED for used invite', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          ...validFriendInviteRow,
          claimed_at: new Date().toISOString(), // already claimed
        }],
      });

      const res = await request(app).get('/invites/validate/claimedtoken');

      expect(res.statusCode).toBe(200);
      expect(res.body.valid).toBe(false);
      expect(res.body.reason).toBe('ALREADY_CLAIMED');
    });

    it('returns valid=false with reason EXPIRED for expired invite', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          ...validFriendInviteRow,
          expires_at: new Date(Date.now() - 86400000).toISOString(), // past
        }],
      });

      const res = await request(app).get('/invites/validate/expiredtoken');

      expect(res.statusCode).toBe(200);
      expect(res.body.valid).toBe(false);
      expect(res.body.reason).toBe('EXPIRED');
    });

    it('returns valid=true with full details for valid friend invite', async () => {
      db.query.mockResolvedValueOnce({ rows: [validFriendInviteRow] });

      const res = await request(app).get('/invites/validate/validfriendtoken');

      expect(res.statusCode).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.type).toBe('friend');
      expect(res.body.invitedBy.name).toBe('Bob Jones');
      expect(res.body).toHaveProperty('installLinks');
      expect(res.body).toHaveProperty('expiresAt');
    });

    it('returns valid=true for valid trip invite', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })             // no friend invite match
        .mockResolvedValueOnce({ rows: [validTripInviteRow] }); // trip invite match

      const res = await request(app).get('/invites/validate/validtriptoken');

      expect(res.statusCode).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.type).toBe('trip');
      expect(res.body.context.tripName).toBe('Goa 2026');
    });
  });

  // ── POST /invites/claim/:token ─────────────────────────────────────────────

  describe('POST /invites/claim/:token', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).post('/invites/claim/sometoken');
      expect(res.statusCode).toBe(401);
    });

    it('returns 404 when token is not found', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [] })  // no friend invite
        .mockResolvedValueOnce({ rows: [] })  // no trip invite
        .mockResolvedValueOnce({ rows: [] }); // no event invite

      const res = await request(app)
        .post('/invites/claim/unknowntoken')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
    });

    it('returns 400 when user tries to claim their own invite', async () => {
      // First call is the pre-lock check (not inside transaction)
      db.query.mockResolvedValueOnce({ rows: [validFriendInviteRow] }); // type detection

      // Transaction client
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined)   // BEGIN
          .mockResolvedValueOnce({
            rows: [{
              ...validFriendInviteRow,
              invited_by: USER_ID, // same as claimant — self-claim!
            }],
          })                                  // FOR UPDATE lock
          .mockResolvedValueOnce(undefined),  // ROLLBACK
        release: jest.fn(),
      };
      db.getClient.mockResolvedValue(mockClient);

      const res = await request(app)
        .post('/invites/claim/selftoken')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('SELF_CLAIM');
    });

    it('returns type=friend with status=pending after claiming a friend invite', async () => {
      // Pre-lock type detection
      db.query.mockResolvedValueOnce({ rows: [validFriendInviteRow] });

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined)                // BEGIN
          .mockResolvedValueOnce({                         // FOR UPDATE lock
            rows: [{ ...validFriendInviteRow, invited_by: USER2_ID }],
          })
          .mockResolvedValueOnce({ rows: [] })             // check existing connection
          .mockResolvedValueOnce({ rows: [{ id: 'new-conn-id' }] }) // INSERT friend_connection
          .mockResolvedValueOnce({ rows: [] })             // UPDATE friend_invite (claimed)
          .mockResolvedValueOnce({ rows: [] })             // INSERT referral
          .mockResolvedValueOnce(undefined),               // COMMIT
        release: jest.fn(),
      };
      db.getClient.mockResolvedValue(mockClient);

      // Post-commit FCM lookups
      db.query
        .mockResolvedValueOnce({ rows: [{ fcm_token: null }] })    // inviter FCM
        .mockResolvedValueOnce({ rows: [{ full_name: 'Alice' }] }); // claimant name

      const res = await request(app)
        .post('/invites/claim/validfriendtoken')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.type).toBe('friend');
      expect(res.body.status).toBe('pending');
      expect(res.body).toHaveProperty('connectionId');
    });

    it('returns type=trip with tripId after claiming a trip invite', async () => {
      // Pre-lock type detection — no friend invite, has trip invite
      db.query
        .mockResolvedValueOnce({ rows: [] })                          // no friend invite
        .mockResolvedValueOnce({ rows: [validTripInviteRow] });       // trip invite found

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined)                           // BEGIN
          .mockResolvedValueOnce({ rows: [{ ...validTripInviteRow, invited_by: USER2_ID }] }) // FOR UPDATE lock
          .mockResolvedValueOnce({ rows: [] })                        // INSERT trip_members (ignore conflict)
          .mockResolvedValueOnce({ rows: [] })                        // UPDATE trip_invites accepted_at
          .mockResolvedValueOnce(undefined),                          // COMMIT
        release: jest.fn(),
      };
      db.getClient.mockResolvedValue(mockClient);

      // Post-commit FCM lookups
      db.query
        .mockResolvedValueOnce({ rows: [{ fcm_token: null }] })       // admin FCM
        .mockResolvedValueOnce({ rows: [{ full_name: 'Alice' }] });   // claimant name

      const res = await request(app)
        .post('/invites/claim/validtriptoken')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.type).toBe('trip');
      expect(res.body.tripId).toBe(TRIP_ID);
    });
  });
});
