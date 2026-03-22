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

const db = require('../../src/config/database');

const USER_ID = '123e4567-e89b-12d3-a456-426614174000';
const TRIP_ID  = 'aaaa0001-0000-4000-8000-000000000001';
const token = generateAccessToken({ id: USER_ID, email: 'alice@test.com' });

describe('GET /home', () => {
  beforeEach(() => jest.resetAllMocks());

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/home');
    expect(res.statusCode).toBe(401);
  });

  it('returns dashboard with upcoming trips and user info', async () => {
    // 1. upcomingTrips query
    db.query
      .mockResolvedValueOnce({
        rows: [{
          id: TRIP_ID,
          name: 'Goa 2026',
          location: 'Goa, India',
          startDate: '2026-05-01',
          endDate: '2026-05-07',
          coverPhotoUrl: null,
          daysToGo: 40,
          memberAvatars: ['https://cdn.test.com/avatar1.jpg'],
        }],
      })
      // 2. ongoingTrip query
      .mockResolvedValueOnce({ rows: [] })
      // 3. user info + pendingFriendRequests
      .mockResolvedValueOnce({
        rows: [{
          id: USER_ID,
          name: 'Alice Smith',
          avatarUrl: 'https://cdn.test.com/alice.jpg',
          pendingFriendRequests: 2,
        }],
      });

    const res = await request(app)
      .get('/home')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.user.name).toBe('Alice Smith');
    expect(res.body.upcomingTrips).toHaveLength(1);
    expect(res.body.upcomingTrips[0].name).toBe('Goa 2026');
    expect(res.body.ongoing).toBeNull();
    expect(res.body.pendingFriendRequests).toBe(2);
    expect(res.body.upcomingEvents).toEqual([]);
  });

  it('returns ongoing trip when one is active', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] }) // no upcoming
      .mockResolvedValueOnce({
        rows: [{
          id: TRIP_ID,
          name: 'Beach Trip',
          location: 'Goa',
          endDate: '2026-03-25',
          type: 'trip',
        }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: USER_ID, name: 'Alice', avatarUrl: null, pendingFriendRequests: 0 }],
      });

    const res = await request(app)
      .get('/home')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.ongoing).not.toBeNull();
    expect(res.body.ongoing.name).toBe('Beach Trip');
    expect(res.body.ongoing.type).toBe('trip');
  });

  it('handles missing profile gracefully (null user)', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] }) // no upcoming
      .mockResolvedValueOnce({ rows: [] }) // no ongoing
      .mockResolvedValueOnce({ rows: [] }); // no user profile row

    const res = await request(app)
      .get('/home')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.pendingFriendRequests).toBe(0);
  });
});
