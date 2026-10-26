/**
 * SEC-05 / D-1 — event permissions.
 * Admin only: delete the event, remove another member.
 * Any member: edit, archive, leave (remove self).
 * Non-members: nothing.
 */
const request = require('supertest');

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

jest.mock('../../src/modules/events/events.service', () => ({
  ...jest.requireActual('../../src/modules/events/events.service'),
  deleteEvent: jest.fn(),
  updateEvent: jest.fn(),
  archiveEvent: jest.fn(),
}));

const app = require('../../src/app');
const { generateAccessToken } = require('../../src/utils/token');
const db = require('../../src/config/database');
const eventsService = require('../../src/modules/events/events.service');

const ME = '123e4567-e89b-12d3-a456-426614174000';
const OTHER = '223e4567-e89b-12d3-a456-426614174001';
const EVENT = 'eeee0001-0000-4000-8000-000000000001';
const token = generateAccessToken({ id: ME, email: 'me@test.com' });

// eventMember middleware: event exists, then caller's membership row.
const as = (role) => {
  db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: EVENT }] });
  db.query.mockResolvedValueOnce(role
    ? { rowCount: 1, rows: [{ role }] }
    : { rowCount: 0, rows: [] });
};

const call = (method, path, body) => request(app)[method](path)
  .set('Authorization', `Bearer ${token}`)
  .send(body);

describe('Event authorization (SEC-05, D-1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockReset();
    eventsService.deleteEvent.mockResolvedValue(undefined);
    eventsService.updateEvent.mockResolvedValue({ id: EVENT, name: 'Holi' });
    eventsService.archiveEvent.mockResolvedValue({ id: EVENT });
  });

  describe('DELETE /events/:eventId', () => {
    it('admin → 200 and the event is deleted', async () => {
      as('admin');
      const res = await call('delete', `/events/${EVENT}`);
      expect(res.statusCode).toBe(200);
      expect(eventsService.deleteEvent).toHaveBeenCalledWith(EVENT);
    });

    it('plain member → 403 and nothing is deleted', async () => {
      as('member');
      const res = await call('delete', `/events/${EVENT}`);
      expect(res.statusCode).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
      expect(eventsService.deleteEvent).not.toHaveBeenCalled();
    });

    it('non-member → 403 and nothing is deleted', async () => {
      as(null);
      const res = await call('delete', `/events/${EVENT}`);
      expect(res.statusCode).toBe(403);
      expect(eventsService.deleteEvent).not.toHaveBeenCalled();
    });
  });

  describe('editing and archiving stay open to members (D-1)', () => {
    it('member can PUT the event', async () => {
      as('member');
      const res = await call('put', `/events/${EVENT}`, { name: 'Holi Bash' });
      expect(res.statusCode).toBe(200);
      expect(eventsService.updateEvent).toHaveBeenCalled();
    });

    it('member can archive the event', async () => {
      as('member');
      const res = await call('post', `/events/${EVENT}/archive`);
      expect(res.statusCode).toBe(200);
      expect(eventsService.archiveEvent).toHaveBeenCalled();
    });

    it('non-member cannot PUT the event', async () => {
      as(null);
      const res = await call('put', `/events/${EVENT}`, { name: 'Hijacked' });
      expect(res.statusCode).toBe(403);
      expect(eventsService.updateEvent).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /events/:eventId/members/:userId', () => {
    const removalSql = () => db.query.mock.calls.some(([sql]) => /DELETE FROM event_members/.test(sql));

    it('plain member removing someone else → 403, no delete', async () => {
      as('member');
      const res = await call('delete', `/events/${EVENT}/members/${OTHER}`);
      expect(res.statusCode).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
      expect(removalSql()).toBe(false);
    });

    it('admin removing a member → 200', async () => {
      as('admin');
      db.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ role: 'member', user_id: OTHER }] }) // target row
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })                                   // admin count
        .mockResolvedValueOnce({ rowCount: 1 })                                              // DELETE member
        .mockResolvedValueOnce({ rowCount: 0 });                                             // DELETE pending invites
      const res = await call('delete', `/events/${EVENT}/members/${OTHER}`);
      expect(res.statusCode).toBe(200);
      expect(removalSql()).toBe(true);
    });

    it('member leaving (removing self) → 200', async () => {
      as('member');
      db.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ role: 'member', user_id: ME }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 0 });
      const res = await call('delete', `/events/${EVENT}/members/${ME}`);
      expect(res.statusCode).toBe(200);
    });

    it('last admin still cannot remove themselves (unchanged rule)', async () => {
      as('admin');
      db.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ role: 'admin', user_id: ME }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });
      const res = await call('delete', `/events/${EVENT}/members/${ME}`);
      expect(res.statusCode).toBe(422);
      expect(res.body.error).toBe('LAST_ADMIN');
    });

    it('non-member → 403', async () => {
      as(null);
      const res = await call('delete', `/events/${EVENT}/members/${OTHER}`);
      expect(res.statusCode).toBe(403);
      expect(removalSql()).toBe(false);
    });
  });
});
