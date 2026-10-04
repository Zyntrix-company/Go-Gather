jest.mock('../../src/config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { connect: jest.fn(), end: jest.fn() },
}));
jest.mock('../../src/utils/s3.util', () => ({ batchDeleteFromS3: jest.fn().mockResolvedValue() }));
jest.mock('../../src/modules/trips/trips.service', () => ({ deleteTrip: jest.fn().mockResolvedValue() }));
jest.mock('../../src/modules/events/events.service', () => ({ deleteEvent: jest.fn().mockResolvedValue() }));
jest.mock('../../src/modules/auth/apple', () => ({ revokeRefreshToken: jest.fn().mockResolvedValue() }));
jest.mock('../../src/utils/encrypt.util', () => ({ decrypt: (v) => `plain:${v}` }));

const db = require('../../src/config/database');
const { batchDeleteFromS3 } = require('../../src/utils/s3.util');
const tripsService = require('../../src/modules/trips/trips.service');
const apple = require('../../src/modules/auth/apple');
const { deleteUserAccount } = require('../../src/modules/users/accountDeletion.service');

const USER = 'u-1';

/** Route db.query calls by SQL text so the test doesn't depend on call order. */
const mockDb = (handlers) => {
  db.query.mockImplementation(async (sql, params) => {
    for (const [match, result] of handlers) {
      if (sql.includes(match)) return typeof result === 'function' ? result(params) : result;
    }
    return { rows: [] };
  });
};

describe('deleteUserAccount', () => {
  let client;

  beforeEach(() => {
    jest.clearAllMocks();
    client = { query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() };
    db.getClient.mockResolvedValue(client);
  });

  it('404s for an already-deleted account', async () => {
    mockDb([['FROM users u LEFT JOIN profiles', { rows: [{ id: USER, deleted_at: new Date() }] }]]);
    await expect(deleteUserAccount(USER)).rejects.toMatchObject({ statusCode: 404 });
    expect(db.getClient).not.toHaveBeenCalled();
  });

  it('refuses platform admins', async () => {
    mockDb([['FROM users u LEFT JOIN profiles', { rows: [{ id: USER, is_platform_admin: true }] }]]);
    await expect(deleteUserAccount(USER)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('deletes solo trips, hands shared ones over, anonymizes the user and removes files', async () => {
    mockDb([
      ['FROM users u LEFT JOIN profiles', {
        rows: [{
          id: USER,
          avatar_url: 'https://test.cloudfront.net/avatars/me.jpg',
          apple_refresh_token: 'enc-token',
        }],
      }],
      ['FROM trips g', { rows: [{ id: 'solo', created_by: USER }, { id: 'shared', created_by: USER }] }],
      ['FROM trip_members m', (params) => (params[0] === 'shared'
        ? { rows: [{ user_id: 'friend', role: 'member' }] }
        : { rows: [] })],
      ["parent_type = 'user'", { rows: [{ s3_key: 'docs/passport.pdf' }] }],
    ]);

    await deleteUserAccount(USER);

    expect(tripsService.deleteTrip).toHaveBeenCalledWith('solo', USER);
    expect(tripsService.deleteTrip).not.toHaveBeenCalledWith('shared', expect.anything());
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE trip_members SET role = 'admin'"), ['shared', 'friend'],
    );
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE trips SET created_by'), ['friend', 'shared'],
    );

    const sql = client.query.mock.calls.map((c) => c[0]);
    expect(sql[0]).toBe('BEGIN');
    expect(sql[sql.length - 1]).toBe('COMMIT');
    const userUpdate = client.query.mock.calls.find((c) => c[0].includes('UPDATE users SET'));
    expect(userUpdate[0]).toMatch(/google_id = NULL/);
    expect(userUpdate[0]).toMatch(/password_hash = NULL/);
    expect(userUpdate[0]).toMatch(/apple_id = NULL/);
    expect(userUpdate[1][0]).toBe(`deleted-${USER}@removed.gatherrgo.local`);
    expect(sql.some((s) => s.includes('DELETE FROM refresh_tokens'))).toBe(true);

    expect(batchDeleteFromS3).toHaveBeenCalledWith(['docs/passport.pdf', 'avatars/me.jpg']);
    expect(apple.revokeRefreshToken).toHaveBeenCalledWith('plain:enc-token');
    expect(client.release).toHaveBeenCalled();
  });

  it('rolls back and keeps files when the transaction fails', async () => {
    mockDb([['FROM users u LEFT JOIN profiles', { rows: [{ id: USER }] }]]);
    client.query.mockImplementation(async (sql) => {
      if (sql.includes('UPDATE users SET')) throw new Error('boom');
      return { rows: [] };
    });

    await expect(deleteUserAccount(USER)).rejects.toThrow('boom');
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(batchDeleteFromS3).not.toHaveBeenCalled();
    expect(apple.revokeRefreshToken).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalled();
  });
});
