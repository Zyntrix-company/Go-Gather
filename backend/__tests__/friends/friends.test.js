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
}));

jest.mock('../../src/utils/branch.util', () => ({
  createInviteSmartLink: jest.fn().mockResolvedValue('https://gathergo.app.link/test-invite'),
}));

jest.mock('../../src/utils/mailer', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  sendVerificationOTPEmail: jest.fn().mockResolvedValue(true),
}));

const db = require('../../src/config/database');

const USER_ID    = '123e4567-e89b-12d3-a456-426614174000';
const USER2_ID   = '223e4567-e89b-12d3-a456-426614174001';
const CONN_ID    = 'cccc0001-0000-4000-8000-000000000001';
const token      = generateAccessToken({ id: USER_ID, email: 'alice@test.com' });

describe('Friends Routes', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── POST /friends/request ──────────────────────────────────────────────────

  describe('POST /friends/request', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/friends/request')
        .send({ toUserId: USER2_ID });
      expect(res.statusCode).toBe(401);
    });

    it('returns 422 when toUserId is missing', async () => {
      const res = await request(app)
        .post('/friends/request')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.statusCode).toBe(422);
    });

    it('returns 400 when trying to send request to self', async () => {
      const res = await request(app)
        .post('/friends/request')
        .set('Authorization', `Bearer ${token}`)
        .send({ toUserId: USER_ID }); // same as authenticated user

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('SELF_REQUEST');
    });

    it('returns 404 when target user does not exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // user not found

      const res = await request(app)
        .post('/friends/request')
        .set('Authorization', `Bearer ${token}`)
        .send({ toUserId: USER2_ID });

      expect(res.statusCode).toBe(404);
      expect(res.body.error).toBe('USER_NOT_FOUND');
    });

    it('returns 409 when request already exists', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: USER2_ID }] })      // user exists
        .mockResolvedValueOnce({
          rows: [{
            id: CONN_ID,
            requester_id: USER_ID,
            addressee_id: USER2_ID,
            status: 'pending',
          }],
        });

      const res = await request(app)
        .post('/friends/request')
        .set('Authorization', `Bearer ${token}`)
        .send({ toUserId: USER2_ID });

      expect(res.statusCode).toBe(409);
      expect(res.body.error).toBe('REQUEST_ALREADY_EXISTS');
    });

    it('returns 409 when already friends', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: USER2_ID }] })
        .mockResolvedValueOnce({
          rows: [{ id: CONN_ID, requester_id: USER_ID, addressee_id: USER2_ID, status: 'accepted' }],
        });

      const res = await request(app)
        .post('/friends/request')
        .set('Authorization', `Bearer ${token}`)
        .send({ toUserId: USER2_ID });

      expect(res.statusCode).toBe(409);
      expect(res.body.error).toBe('ALREADY_FRIENDS');
    });

    it('returns 201 with connectionId when request is sent', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ id: USER2_ID }] })                      // user exists
        .mockResolvedValueOnce({ rows: [] })                                       // no existing connection
        .mockResolvedValueOnce({ rows: [{ id: CONN_ID }] })                        // INSERT connection
        .mockResolvedValueOnce({ rows: [{ full_name: 'Alice' }] })                 // requester name for FCM
        .mockResolvedValueOnce({ rows: [{ fcm_token: null }] });                   // no FCM token (fire-and-forget)

      const res = await request(app)
        .post('/friends/request')
        .set('Authorization', `Bearer ${token}`)
        .send({ toUserId: USER2_ID });

      expect(res.statusCode).toBe(201);
      expect(res.body.connectionId).toBe(CONN_ID);
      expect(res.body.status).toBe('pending');
    });
  });

  // ── PUT /friends/request/:connectionId ────────────────────────────────────

  describe('PUT /friends/request/:connectionId', () => {
    it('returns 422 when action is missing', async () => {
      const res = await request(app)
        .put(`/friends/request/${CONN_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.statusCode).toBe(422);
    });

    it('returns 422 when action is invalid', async () => {
      const res = await request(app)
        .put(`/friends/request/${CONN_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'maybe' });
      expect(res.statusCode).toBe(422);
    });

    it('returns 404 when connection does not exist', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .put(`/friends/request/${CONN_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'accept' });

      expect(res.statusCode).toBe(404);
    });

    it('returns 403 when non-addressee tries to respond', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          id: CONN_ID,
          requester_id: USER2_ID,
          addressee_id: 'someone-else-id',
          status: 'pending',
        }],
      });

      const res = await request(app)
        .put(`/friends/request/${CONN_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'accept' });

      expect(res.statusCode).toBe(403);
    });

    it('returns 200 with status accepted on accept', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: CONN_ID,
            requester_id: USER2_ID,
            addressee_id: USER_ID,   // authenticated user is the addressee
            status: 'pending',
          }],
        })
        .mockResolvedValueOnce({ rows: [] })                                        // UPDATE status
        .mockResolvedValueOnce({ rows: [{ full_name: 'Alice', avatar_url: null }] }) // accepter profile
        .mockResolvedValueOnce({ rows: [{ fcm_token: null }] });                    // requester FCM token

      const res = await request(app)
        .put(`/friends/request/${CONN_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'accept' });

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('accepted');
    });

    it('returns 200 with status declined on decline', async () => {
      db.query
        .mockResolvedValueOnce({
          rows: [{
            id: CONN_ID,
            requester_id: USER2_ID,
            addressee_id: USER_ID,
            status: 'pending',
          }],
        })
        .mockResolvedValueOnce({ rows: [] }); // UPDATE status

      const res = await request(app)
        .put(`/friends/request/${CONN_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'decline' });

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('declined');
    });
  });

  // ── GET /friends/requests ──────────────────────────────────────────────────

  describe('GET /friends/requests', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/friends/requests');
      expect(res.statusCode).toBe(401);
    });

    it('returns 200 with incoming and outgoing buckets', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            connectionId: CONN_ID,
            requester_id: USER2_ID,
            addressee_id: USER_ID,   // incoming request
            name: 'Bob Jones',
            avatarUrl: null,
            country: 'US',
            sentAt: new Date().toISOString(),
          },
        ],
      });

      const res = await request(app)
        .get('/friends/requests')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.incoming)).toBe(true);
      expect(Array.isArray(res.body.outgoing)).toBe(true);
      expect(res.body.incoming).toHaveLength(1);
      expect(res.body.incoming[0].user.name).toBe('Bob Jones');
    });
  });

  // ── GET /friends ───────────────────────────────────────────────────────────

  describe('GET /friends', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/friends');
      expect(res.statusCode).toBe(401);
    });

    it('returns 200 with friends list and total count', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{
          connectionId: CONN_ID,
          userId: USER2_ID,
          name: 'Bob Jones',
          avatarUrl: null,
          country: 'IN',
          bio: 'Explorer',
          mutualTripCount: 2,
          mutualEventCount: 0,
          connectedAt: new Date().toISOString(),
        }],
      });

      const res = await request(app)
        .get('/friends')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.friends).toHaveLength(1);
      expect(res.body.total).toBe(1);
      expect(res.body.friends[0].user.name).toBe('Bob Jones');
    });

    it('supports search query parameter', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/friends?search=bob')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.friends).toHaveLength(0);
    });
  });

  // ── DELETE /friends/:userId ────────────────────────────────────────────────

  describe('DELETE /friends/:userId', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).delete(`/friends/${USER2_ID}`);
      expect(res.statusCode).toBe(401);
    });

    it('returns 422 for invalid UUID', async () => {
      const res = await request(app)
        .delete('/friends/not-a-uuid')
        .set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toBe(422);
    });

    it('returns 404 when friendship not found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }); // no matching friendship

      const res = await request(app)
        .delete(`/friends/${USER2_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.error).toBe('NOT_FOUND');
    });

    it('returns 200 on successful unfriend', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: CONN_ID }] }); // DELETE returns deleted row

      const res = await request(app)
        .delete(`/friends/${USER2_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ── POST /friends/invite ───────────────────────────────────────────────────

  describe('POST /friends/invite', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/friends/invite')
        .send({ channels: ['share'] });
      expect(res.statusCode).toBe(401);
    });

    it('returns 422 when channels is missing', async () => {
      const res = await request(app)
        .post('/friends/invite')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.statusCode).toBe(422);
    });

    it('returns 201 with branchUrl and shareText', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ full_name: 'Alice Smith' }] }) // inviterName
        .mockResolvedValueOnce({ rows: [] });                             // INSERT friend_invite

      const res = await request(app)
        .post('/friends/invite')
        .set('Authorization', `Bearer ${token}`)
        .send({ channels: ['share'] });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('branchUrl');
      expect(res.body).toHaveProperty('shareText');
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('expiresAt');
    });
  });
});
