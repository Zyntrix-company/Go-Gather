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

jest.mock('../../src/utils/mailer', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  sendConnectionRequestEmail: jest.fn().mockResolvedValue(true),
  sendRequestAcceptedEmail: jest.fn().mockResolvedValue(true),
  sendTripCancelledEmail: jest.fn().mockResolvedValue(true),
  wrapEmail: jest.fn((html) => html),
}));

const db = require('../../src/config/database');
const fcm = require('../../src/utils/fcm.util');
const mailer = require('../../src/utils/mailer');
const config = require('../../src/config');

const INVITER = '123e4567-e89b-12d3-a456-426614174000'; // Phone 1
const OPENER  = '223e4567-e89b-12d3-a456-426614174001'; // Phone 2
const TRIP_ID = 'aaaa0001-0000-4000-8000-000000000001';
const EVENT_ID = 'bbbb0001-0000-4000-8000-000000000001';
const INVITE_ID = 'cccc0001-0000-4000-8000-000000000001';
const CONN_ID = 'dddd0001-0000-4000-8000-000000000001';

const openerToken = generateAccessToken({ id: OPENER, email: 'bob@test.com' });
const EMPTY = { rows: [], rowCount: 0 };
const inDays = (d) => new Date(Date.now() + d * 86400000).toISOString();

// ── SQL-routed db mock ───────────────────────────────────────────────────────
// Routes by the SQL that runs, not by call order, and records everything so tests
// can assert what was (not) written. The transaction client shares the same router.

let sqlLog;
const install = (handlers) => {
  sqlLog = [];
  const run = async (sql, params) => {
    const text = String(sql).replace(/\s+/g, ' ').trim();
    sqlLog.push({ text, params });
    for (const [pattern, result] of handlers) {
      if (text.includes(pattern)) return typeof result === 'function' ? result(text, params) : result;
    }
    return EMPTY;
  };
  db.query.mockImplementation(run);
  db.getClient.mockResolvedValue({ query: jest.fn(run), release: jest.fn() });
};
const ran = (pattern) => sqlLog.filter((c) => c.text.includes(pattern));
const open = (tok = 'tok') =>
  request(app).post(`/invites/open/${tok}`).set('Authorization', `Bearer ${openerToken}`);
const pushTypes = () => fcm.createAndSendNotification.mock.calls.map((c) => c[2]);

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

// ═══════════════════════════════════════════════════════════════════════════
// A. Friend invite
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /invites/open/:token — friend link', () => {
  const friendInvite = (over = {}) => ({
    rows: [{
      id: 'fi-1', invited_by: INVITER, expires_at: inDays(5), claimed_at: null, claimed_by: null,
      inviter_name: 'Phone One', inviter_avatar: null, ...over,
    }],
  });

  const base = (invite, pair = EMPTY) => [
    ['FROM friend_invites fi', invite],
    ['SELECT id, requester_id, status FROM friend_connections', pair],
    ['INSERT INTO friend_connections', { rows: [{ id: CONN_ID }], rowCount: 1 }],
    ['UPDATE friend_connections', { rows: [{ id: CONN_ID }], rowCount: 1 }],
  ];

  it('requires auth', async () => {
    const res = await request(app).post('/invites/open/tok');
    expect(res.statusCode).toBe(401);
  });

  it('creates a pending request FROM the inviter TO the opener, consumes the link, notifies no one', async () => {
    install(base(friendInvite()));

    const res = await open();

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ type: 'friend', status: 'pending', inviterName: 'Phone One' });
    expect(ran('INSERT INTO friend_connections')[0].params).toEqual([INVITER, OPENER]);
    expect(ran('UPDATE friend_invites SET claimed_at')).toHaveLength(1);
    expect(ran('INSERT INTO referrals')).toHaveLength(1);
    expect(fcm.createAndSendNotification).not.toHaveBeenCalled();
    expect(mailer.sendConnectionRequestEmail).not.toHaveBeenCalled();
  });

  it('SELF_CLAIM when the inviter opens their own link — and the link is NOT consumed', async () => {
    install(base(friendInvite({ invited_by: OPENER })));

    const res = await open();

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('SELF_CLAIM');
    expect(ran('UPDATE friend_invites')).toHaveLength(0);
    expect(ran('INSERT INTO friend_connections')).toHaveLength(0);
  });

  it('already_friends — consumes the link, creates nothing', async () => {
    install(base(friendInvite(), { rows: [{ id: CONN_ID, requester_id: OPENER, status: 'accepted' }] }));

    const res = await open();

    expect(res.body.status).toBe('already_friends');
    expect(ran('UPDATE friend_invites SET claimed_at')).toHaveLength(1);
    expect(ran('INSERT INTO friend_connections')).toHaveLength(0);
  });

  it('INVALID_INVITE when the link was already used by someone else', async () => {
    install(base(friendInvite({ claimed_at: new Date().toISOString(), claimed_by: INVITER + 'x' })));

    const res = await open();

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('INVALID_INVITE');
    expect(ran('INSERT INTO friend_connections')).toHaveLength(0);
  });

  it('INVALID_INVITE when the link is older than 7 days', async () => {
    install(base(friendInvite({ expires_at: inDays(-1) })));

    const res = await open();

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('INVALID_INVITE');
    expect(ran('INSERT INTO friend_connections')).toHaveLength(0);
  });

  it('outgoing_pending when the opener already sent the inviter a request — consumes, adds nothing', async () => {
    install(base(friendInvite(), { rows: [{ id: CONN_ID, requester_id: OPENER, status: 'pending' }] }));

    const res = await open();

    expect(res.body).toMatchObject({ status: 'outgoing_pending', inviterName: 'Phone One' });
    expect(ran('UPDATE friend_invites SET claimed_at')).toHaveLength(1);
    expect(ran('INSERT INTO friend_connections')).toHaveLength(0);
    expect(ran('UPDATE friend_connections')).toHaveLength(0);
  });

  it('re-opens a previously declined pair as pending, inviter → opener', async () => {
    install(base(friendInvite(), { rows: [{ id: CONN_ID, requester_id: OPENER, status: 'declined' }] }));

    const res = await open();

    expect(res.body.status).toBe('pending');
    expect(ran('UPDATE friend_connections')[0].params).toEqual([INVITER, OPENER, CONN_ID]);
    expect(ran('INSERT INTO friend_connections')).toHaveLength(0);
  });

  it('treats a block (either side) as INVALID_INVITE and does not consume the link', async () => {
    install(base(friendInvite(), { rows: [{ id: CONN_ID, requester_id: INVITER, status: 'blocked' }] }));

    const res = await open();

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('INVALID_INVITE');
    expect(ran('UPDATE friend_invites')).toHaveLength(0);
  });

  it('is idempotent: the same person opening the used link again still gets pending', async () => {
    install([
      ...base(friendInvite({ claimed_at: new Date().toISOString(), claimed_by: OPENER })),
      ['SELECT requester_id, status FROM friend_connections', { rows: [{ requester_id: INVITER, status: 'pending' }] }],
    ]);

    const res = await open();

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('pending');
    expect(ran('UPDATE friend_invites')).toHaveLength(0);
    expect(ran('INSERT INTO friend_connections')).toHaveLength(0);
  });

  it('idempotent re-open after approving reports already_friends', async () => {
    install([
      ...base(friendInvite({ claimed_at: new Date().toISOString(), claimed_by: OPENER })),
      ['SELECT requester_id, status FROM friend_connections', { rows: [{ requester_id: INVITER, status: 'accepted' }] }],
    ]);

    const res = await open();

    expect(res.body.status).toBe('already_friends');
  });

  it('is race-safe: losing the insert race re-reads the pair instead of failing', async () => {
    let reads = 0;
    install([
      ['FROM friend_invites fi', friendInvite()],
      ['SELECT id, requester_id, status FROM friend_connections', () => {
        reads += 1;
        // first read: nothing yet; after the other request's insert wins, it is there
        return reads === 1 ? EMPTY : { rows: [{ id: CONN_ID, requester_id: INVITER, status: 'pending' }] };
      }],
      ['INSERT INTO friend_connections', EMPTY], // ON CONFLICT DO NOTHING — someone else got there first
    ]);

    const res = await open();

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('pending');
    expect(reads).toBe(2);
  });

  it('NOT_FOUND for an unknown token', async () => {
    install([]);

    const res = await open('nope');

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// B. Trip / event invite
// ═══════════════════════════════════════════════════════════════════════════

describe.each([
  ['trip', 'trips', 'trip_members', 'trip_invites', 'tripId', TRIP_ID, 'trip_id', 'trip_invite'],
  ['event', 'events', 'event_members', 'event_invites', 'eventId', EVENT_ID, 'event_id', 'event_invite'],
])('POST /invites/open/:token — %s link', (type, parents, members, invitesTable, idKey, parentId, col) => {
  const shareRow = { rows: [{ id: 'sl-1', parent_type: type, parent_id: parentId, invited_by: INVITER, inviter_name: 'Phone One', inviter_avatar: null }] };

  // membership: set of user ids who are members; parentExists toggles a deleted trip/event
  const world = ({ memberIds = [INVITER], parentExists = true, pair = EMPTY, upsertId = INVITE_ID, extra = [] } = {}) => install([
    ...extra,
    [`FROM share_links sl`, shareRow],
    [`SELECT 1 FROM ${parents} WHERE id`, parentExists ? { rows: [{}], rowCount: 1 } : EMPTY],
    [`SELECT 1 FROM ${members} WHERE ${col}`, (_t, p) => (memberIds.includes(p[1]) ? { rows: [{}], rowCount: 1 } : EMPTY)],
    [`INSERT INTO ${invitesTable}`, { rows: [{ id: upsertId }], rowCount: 1 }],
    ['SELECT id, requester_id, status FROM friend_connections', pair],
    ['INSERT INTO friend_connections', { rows: [{ id: CONN_ID }], rowCount: 1 }],
  ]);

  it('creates the opener a pending request (no join yet) and a separate friend request from the sharer', async () => {
    world();

    const res = await open();

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ type, status: 'pending', inviteId: INVITE_ID, [idKey]: parentId });
    const upsert = ran(`INSERT INTO ${invitesTable}`)[0];
    expect(upsert.params.slice(0, 3)).toEqual([parentId, INVITER, OPENER]); // invited_by = sharer, user = opener
    expect(ran(`INSERT INTO ${members}`)).toHaveLength(0);                 // instant join happens on Accept, not on open
    expect(ran('INSERT INTO friend_connections')[0].params).toEqual([INVITER, OPENER]);
    expect(pushTypes()).not.toContain('FRIEND_REQUEST');                   // the friend request is quiet
  });

  it('upserts on the unique pending index and refreshes expires_at, so a lapsed request reappears', async () => {
    world();

    await open();

    const sql = ran(`INSERT INTO ${invitesTable}`)[0].text;
    expect(sql).toContain(`ON CONFLICT (${col}, user_id) WHERE status = 'pending' AND user_id IS NOT NULL`);
    expect(sql).toContain('DO UPDATE SET expires_at = EXCLUDED.expires_at');
    expect(sql).toContain("NOW() + INTERVAL '7 days'");
  });

  it('opening the same link twice (or from two channels) yields the one request', async () => {
    world();

    const a = await open();
    const b = await open();

    expect(a.body.inviteId).toBe(b.body.inviteId);
  });

  it('already a member → straight to the trip/event, no request, no friend request', async () => {
    world({ memberIds: [INVITER, OPENER] });

    const res = await open();

    expect(res.body).toEqual({ type, status: 'member', [idKey]: parentId });
    expect(ran(`INSERT INTO ${invitesTable}`)).toHaveLength(0);
    expect(ran('INSERT INTO friend_connections')).toHaveLength(0);
  });

  it('the sharer opening their own link goes straight to the trip/event', async () => {
    // the token's owner is the caller
    install([
      [`FROM share_links sl`, { rows: [{ ...shareRow.rows[0], invited_by: OPENER }] }],
      [`SELECT 1 FROM ${parents} WHERE id`, { rows: [{}], rowCount: 1 }],
      [`SELECT 1 FROM ${members} WHERE ${col}`, { rows: [{}], rowCount: 1 }],
    ]);

    const res = await open();

    expect(res.body.status).toBe('member');
    expect(ran(`INSERT INTO ${invitesTable}`)).toHaveLength(0);
  });

  it(`NOT_FOUND when the ${type} has been deleted`, async () => {
    world({ parentExists: false });

    const res = await open();

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
    expect(res.body.message).toMatch(/no longer exists/);
  });

  it('INVALID_INVITE when the member who shared the link has since left', async () => {
    world({ memberIds: [] });

    const res = await open();

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('INVALID_INVITE');
    expect(ran(`INSERT INTO ${invitesTable}`)).toHaveLength(0);
  });

  it('a removed member can rejoin through the link (just a fresh request)', async () => {
    world({ memberIds: [INVITER] }); // opener is not a member (any more)

    const res = await open();

    expect(res.body.status).toBe('pending');
  });

  describe('rule 4 — the separate friend request is skipped when it should be', () => {
    it.each([
      ['already friends', { rows: [{ id: CONN_ID, requester_id: OPENER, status: 'accepted' }] }],
      ['a request is already pending from the inviter', { rows: [{ id: CONN_ID, requester_id: INVITER, status: 'pending' }] }],
      ['a request is already pending from the opener', { rows: [{ id: CONN_ID, requester_id: OPENER, status: 'pending' }] }],
      ['either side blocked the other', { rows: [{ id: CONN_ID, requester_id: OPENER, status: 'blocked' }] }],
    ])('%s', async (_label, pair) => {
      world({ pair });

      const res = await open();

      expect(res.body.status).toBe('pending'); // joining is still possible
      expect(ran('INSERT INTO friend_connections')).toHaveLength(0);
      expect(ran('UPDATE friend_connections')).toHaveLength(0);
    });

    it('a previously declined pair gets a fresh request from the inviter', async () => {
      world({ pair: { rows: [{ id: CONN_ID, requester_id: OPENER, status: 'declined' }] }, extra: [['UPDATE friend_connections', { rows: [{ id: CONN_ID }], rowCount: 1 }]] });

      await open();

      expect(ran('UPDATE friend_connections')[0].params).toEqual([INVITER, OPENER, CONN_ID]);
    });

    it('a failure creating the friend request never fails the open', async () => {
      world({ extra: [['SELECT id, requester_id, status FROM friend_connections', () => { throw new Error('boom'); }]] });

      const res = await open();

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('pending');
    });
  });

  describe('older single-use links (pre-change tokens)', () => {
    const legacyRow = (over = {}) => ({
      rows: [{
        id: INVITE_ID, invited_by: INVITER, expires_at: inDays(3), claimed_at: null, claimed_by: null,
        status: 'pending', [col]: parentId, context_name: 'X', inviter_name: 'Phone One', inviter_avatar: null, ...over,
      }],
    });
    const legacyWorld = (row, extra = []) => install([
      ...extra,
      [`FROM ${invitesTable} ${type === 'trip' ? 'ti' : 'ei'}`, row],
      [`SELECT 1 FROM ${parents} WHERE id`, { rows: [{}], rowCount: 1 }],
      [`SELECT 1 FROM ${members} WHERE ${col}`, (_t, p) => (p[1] === INVITER ? { rows: [{}], rowCount: 1 } : EMPTY)],
      [`UPDATE ${invitesTable}`, { rows: [{ id: INVITE_ID }], rowCount: 1 }],
      [`INSERT INTO ${invitesTable}`, { rows: [{ id: 'new-row' }], rowCount: 1 }],
      ['SELECT id, requester_id, status FROM friend_connections', EMPTY],
      ['INSERT INTO friend_connections', { rows: [{ id: CONN_ID }], rowCount: 1 }],
    ]);

    it('an unbound link binds to the opener and shows the same request', async () => {
      legacyWorld(legacyRow());

      const res = await open();

      expect(res.body).toEqual({ type, status: 'pending', inviteId: INVITE_ID, [idKey]: parentId });
      expect(ran(`UPDATE ${invitesTable}`)[0].params).toEqual([OPENER, INVITE_ID, parentId]);
      expect(ran('INSERT INTO friend_connections')[0].params).toEqual([INVITER, OPENER]);
    });

    it('a link already bound to the opener is reused (their pending request)', async () => {
      legacyWorld(legacyRow({ claimed_by: OPENER }), [[`INSERT INTO ${invitesTable}`, { rows: [{ id: INVITE_ID }], rowCount: 1 }]]);

      const res = await open();

      expect(res.body.inviteId).toBe(INVITE_ID);
      expect(ran(`UPDATE ${invitesTable}`)).toHaveLength(0); // no re-binding
    });

    it('a link bound to someone else is FORBIDDEN', async () => {
      legacyWorld(legacyRow({ claimed_by: '999e4567-e89b-12d3-a456-426614174999' }));

      const res = await open();

      expect(res.statusCode).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
      expect(res.body.message).toBe('This invite was sent to someone else');
    });

    it('an expired unbound link still works', async () => {
      legacyWorld(legacyRow({ expires_at: inDays(-3) }));

      const res = await open();

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('pending');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Public validate — landing page data
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /invites/validate/:token — share links and landing-page context', () => {
  const shareRow = { rows: [{ id: 'sl-1', parent_type: 'trip', parent_id: TRIP_ID, invited_by: INVITER, inviter_name: 'Phone One', inviter_avatar: null }] };
  const ctxRow = { rows: [{ name: 'Goa 2026', start_date: '2026-12-01', end_date: '2026-12-05', location_name: 'Goa', member_count: 4 }] };

  it('a share link is valid while the trip exists and its sharer is a member — with dates, place and a member COUNT only', async () => {
    install([
      ['FROM share_links sl', shareRow],
      ['FROM trips p WHERE p.id', ctxRow],
      ['SELECT 1 FROM trip_members WHERE trip_id', { rows: [{}], rowCount: 1 }],
    ]);

    const res = await request(app).get('/invites/validate/tok');

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      valid: true,
      type: 'trip',
      expiresAt: null,
      invitedBy: { name: 'Phone One' },
      context: { tripName: 'Goa 2026', startDate: '2026-12-01', endDate: '2026-12-05', locationName: 'Goa', memberCount: 4 },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/members"/);
  });

  it.each([
    ['the trip is gone', { ctx: EMPTY, member: { rows: [{}], rowCount: 1 } }],
    ['the sharer left', { ctx: ctxRow, member: EMPTY }],
  ])('a share link is not valid when %s', async (_l, { ctx, member }) => {
    install([
      ['FROM share_links sl', shareRow],
      ['FROM trips p WHERE p.id', ctx],
      ['SELECT 1 FROM trip_members WHERE trip_id', member],
    ]);

    const res = await request(app).get('/invites/validate/tok');

    expect(res.body).toEqual({ valid: false, reason: 'NOT_FOUND' });
  });

  it('an older single-use trip invite also carries the landing-page context', async () => {
    install([
      ['FROM trip_invites ti', { rows: [{
        id: INVITE_ID, invited_by: INVITER, expires_at: inDays(2), claimed_at: null, claimed_by: null,
        status: 'pending', trip_id: TRIP_ID, context_name: 'Goa 2026', inviter_name: 'Phone One', inviter_avatar: null,
      }] }],
      ['FROM trips p WHERE p.id', ctxRow],
    ]);

    const res = await request(app).get('/invites/validate/tok');

    expect(res.body.context).toMatchObject({ tripName: 'Goa 2026', memberCount: 4, locationName: 'Goa' });
  });

  it('friend validation keeps its old shape', async () => {
    install([['FROM friend_invites fi', { rows: [{
      id: 'fi-1', invited_by: INVITER, expires_at: inDays(2), claimed_at: null, claimed_by: null, inviter_name: 'Phone One', inviter_avatar: null,
    }] }]]);

    const res = await request(app).get('/invites/validate/tok');

    expect(res.body.context).toEqual({ tripName: null, eventName: null });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /requests/:type/:id/preview — the invite popup
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /requests/:type/:id/preview', () => {
  const get = (type = 'trip', id = INVITE_ID) =>
    request(app).get(`/requests/${type}/${id}/preview`).set('Authorization', `Bearer ${openerToken}`);

  const header = { rows: [{
    parent_id: TRIP_ID, invited_by: INVITER, name: 'Goa 2026', start_date: '2026-12-01', end_date: '2026-12-05',
    location_name: 'Goa', inviter_name: 'Phone One', inviter_avatar: 'https://bucket.s3.ap-south-1.amazonaws.com/avatars/a.jpg',
  }] };

  it('returns the trip, the inviter and who is already in (avatars via CloudFront, count separate from the capped list)', async () => {
    install([
      ['FROM trip_invites i', header],
      ['FROM trip_members m', { rows: [{ id: INVITER, name: 'Phone One', avatar_url: null }, { id: 'u2', name: 'Asha', avatar_url: 'https://undefined/x.png' }] }],
      ['COUNT(*)::int AS n', { rows: [{ n: 40 }] }],
    ]);

    const res = await get();

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      type: 'trip', id: INVITE_ID, name: 'Goa 2026', startDate: '2026-12-01', endDate: '2026-12-05', locationName: 'Goa',
      inviter: { id: INVITER, name: 'Phone One' },
      memberCount: 40,
    });
    expect(res.body.inviter.avatarUrl).toBe(`https://${config.s3.cloudfrontDomain}/avatars/a.jpg`);
    expect(res.body.members).toEqual([
      { id: INVITER, name: 'Phone One', avatarUrl: null },
      { id: 'u2', name: 'Asha', avatarUrl: null },
    ]);
    expect(ran('FROM trip_members m')[0].text).toMatch(/LIMIT 12/);
  });

  it('is scoped to the invitee: only their own, still-pending, unexpired request', async () => {
    install([['FROM trip_invites i', EMPTY]]);

    const res = await get();

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('NOT_FOUND');
    const q = ran('FROM trip_invites i')[0];
    expect(q.params).toEqual([INVITE_ID, OPENER]);
    expect(q.text).toContain("i.user_id = $2 AND i.status = 'pending' AND i.expires_at > NOW()");
  });

  it('works for events', async () => {
    install([
      ['FROM event_invites i', { rows: [{ ...header.rows[0], parent_id: EVENT_ID }] }],
      ['FROM event_members m', EMPTY],
      ['COUNT(*)::int AS n', { rows: [{ n: 0 }] }],
    ]);

    const res = await get('event');

    expect(res.statusCode).toBe(200);
    expect(ran('FROM event_invites i')[0].text).toContain('p.event_date AS start_date');
  });

  it('rejects friend requests and bad ids', async () => {
    install([]);
    expect((await get('friend')).statusCode).toBe(422);
    expect((await get('trip', 'not-a-uuid')).statusCode).toBe(422);
  });

  it('requires auth', async () => {
    const res = await request(app).get(`/requests/trip/${INVITE_ID}/preview`);
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /requests — inviter avatars', () => {
  it('are served through CloudFront like everywhere else', async () => {
    install([
      ['FROM friend_connections fc', { rows: [{ id: CONN_ID, created_at: new Date(), requester_id: INVITER, inviter_name: 'Phone One', inviter_avatar: 'https://bucket.s3.ap-south-1.amazonaws.com/avatars/a.jpg' }] }],
    ]);

    const res = await request(app).get('/requests').set('Authorization', `Bearer ${openerToken}`);

    expect(res.body.requests[0].from.avatarUrl).toBe(`https://${config.s3.cloudfrontDomain}/avatars/a.jpg`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Sending invites (trips/events services) — reusable link in every message
// ═══════════════════════════════════════════════════════════════════════════

describe('sending trip/event invites', () => {
  const tripsService = require('../../src/modules/trips/trips.service');
  const eventsService = require('../../src/modules/events/events.service');
  const shareUrl = (type) => `${config.appDeepLinkBaseUrl}/invite/${type}/share-token`;

  const sendWorld = (type, { existingUser = null, upsert = { rows: [{ id: INVITE_ID }], rowCount: 1 }, pair = EMPTY } = {}) => install([
    ['FROM profiles p WHERE p.user_id', { rows: [{ full_name: 'Phone One' }] }],
    ['SELECT full_name AS name FROM profiles', { rows: [{ name: 'Asha' }] }],
    [`SELECT name FROM ${type}s WHERE id`, { rows: [{ name: 'Goa 2026' }], rowCount: 1 }],
    ['INSERT INTO share_links', { rows: [{ token: 'share-token' }] }],
    ['SELECT id FROM users WHERE email_normalized', existingUser ? { rows: [{ id: existingUser }] } : EMPTY],
    ['SELECT id FROM users WHERE phone_key', existingUser ? { rows: [{ id: existingUser }] } : EMPTY],
    [`SELECT 1 FROM ${type}_members`, EMPTY],
    [`INSERT INTO ${type}_invites`, upsert],
    ['SELECT id, requester_id, status FROM friend_connections', pair],
    ['INSERT INTO friend_connections', { rows: [{ id: CONN_ID }], rowCount: 1 }],
  ]);

  describe.each([['trip', tripsService.inviteToTrip, TRIP_ID], ['event', eventsService.inviteToEvent, EVENT_ID]])('%s', (type, invite, id) => {
    it('Share (WhatsApp) returns the sharer\'s one reusable link and writes no per-person row', async () => {
      sendWorld(type);

      const res = await invite(id, INVITER, { shareOnly: true });

      expect(res.invited[0]).toEqual({ branchUrl: shareUrl(type), expiresAt: null });
      expect(res.shareText).toContain(shareUrl(type));
      expect(ran(`INSERT INTO ${type}_invites`)).toHaveLength(0);
      expect(ran('INSERT INTO share_links')[0].params.slice(0, 3)).toEqual([type, id, INVITER]);
    });

    it('SMS to a number with no account: message carries the reusable link, the per-person row is still recorded', async () => {
      sendWorld(type);

      const res = await invite(id, INVITER, { phones: ['+919812345678'] });

      expect(res.invited[0].branchUrl).toBe(shareUrl(type));
      expect(res.invited[0].shareText).toContain(shareUrl(type));
      expect(res.invited[0].expiresAt).toBeNull();
      const row = ran(`INSERT INTO ${type}_invites`)[0];
      expect(row.params).toContain('+919812345678'); // so sign-up matching can still attach it
    });

    it('email to an address with no account: sends the reusable link, tagged as an invite email', async () => {
      sendWorld(type);

      await invite(id, INVITER, { emails: ['new@person.com'] });

      expect(mailer.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
        to: 'new@person.com',
        tags: ['transactional', 'invite'],
        text: expect.stringContaining(shareUrl(type)),
        html: expect.stringContaining(shareUrl(type)),
      }));
      expect(ran(`INSERT INTO ${type}_invites`)).toHaveLength(1);
    });

    it('an address that already has an account gets a request + push (no link) and a quiet friend request', async () => {
      sendWorld(type, { existingUser: OPENER });

      const res = await invite(id, INVITER, { emails: ['bob@test.com'] });

      expect(res.requested).toHaveLength(1);
      expect(res.invited).toHaveLength(0);
      expect(mailer.sendEmail).not.toHaveBeenCalled();
      expect(fcm.createAndSendNotification).toHaveBeenCalledWith(
        OPENER, expect.anything(), type === 'trip' ? 'TRIP_REQUEST' : 'EVENT_REQUEST',
        expect.objectContaining({ inviteId: INVITE_ID }),
      );
      expect(ran('INSERT INTO friend_connections')[0].params).toEqual([INVITER, OPENER]);
      expect(pushTypes()).not.toContain('FRIEND_REQUEST');
    });

    it('re-inviting someone with a live pending request is a no-op (and sends no second friend request)', async () => {
      sendWorld(type, { existingUser: OPENER, upsert: EMPTY });

      const res = await invite(id, INVITER, { emails: ['bob@test.com'] });

      expect(res.skipped).toEqual([{ userId: OPENER, reason: 'already_invited' }]);
      expect(ran('INSERT INTO friend_connections')).toHaveLength(0);
    });

    it('re-inviting after the request lapsed revives it (expires_at refreshed only when already expired)', async () => {
      sendWorld(type, { existingUser: OPENER });

      await invite(id, INVITER, { emails: ['bob@test.com'] });

      const sql = ran(`INSERT INTO ${type}_invites`)[0].text;
      expect(sql).toContain(`ON CONFLICT (${type}_id, user_id) WHERE status = 'pending' AND user_id IS NOT NULL`);
      expect(sql).toContain('DO UPDATE SET expires_at = EXCLUDED.expires_at');
      expect(sql).toContain(`WHERE ${type}_invites.expires_at <= NOW()`);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Sign-up matching
// ═══════════════════════════════════════════════════════════════════════════

describe('linkPendingInvitesToUser — rule 4', () => {
  const { linkPendingInvitesToUser } = require('../../src/modules/invites/invites.service');

  it('a matched trip invite also gets the separate, quiet friend request from the inviter', async () => {
    install([
      ['UPDATE trip_invites ti', { rows: [{ id: INVITE_ID, trip_id: TRIP_ID, invited_by: INVITER, trip_name: 'Goa', inviter_name: 'Phone One' }], rowCount: 1 }],
      ['SELECT id, requester_id, status FROM friend_connections', EMPTY],
      ['INSERT INTO friend_connections', { rows: [{ id: CONN_ID }], rowCount: 1 }],
    ]);

    const summary = await linkPendingInvitesToUser(OPENER, { email: 'bob@test.com' });

    expect(summary.trips).toBe(1);
    expect(ran('INSERT INTO friend_connections')[0].params).toEqual([INVITER, OPENER]);
    expect(pushTypes()).toEqual(['TRIP_REQUEST']);
  });

  it('a matched event invite does the same', async () => {
    install([
      ['UPDATE event_invites ei', { rows: [{ id: INVITE_ID, event_id: EVENT_ID, invited_by: INVITER, event_name: 'Party', inviter_name: 'Phone One' }], rowCount: 1 }],
      ['INSERT INTO friend_connections', { rows: [{ id: CONN_ID }], rowCount: 1 }],
    ]);

    await linkPendingInvitesToUser(OPENER, { phone: '+919999999999' });

    expect(ran('INSERT INTO friend_connections')[0].params).toEqual([INVITER, OPENER]);
  });

  it('skips the friend request if one already exists in either direction', async () => {
    install([
      ['UPDATE trip_invites ti', { rows: [{ id: INVITE_ID, trip_id: TRIP_ID, invited_by: INVITER, trip_name: 'Goa', inviter_name: 'Phone One' }], rowCount: 1 }],
      ['SELECT id, requester_id, status FROM friend_connections', { rows: [{ id: CONN_ID, requester_id: OPENER, status: 'pending' }] }],
    ]);

    await linkPendingInvitesToUser(OPENER, { email: 'bob@test.com' });

    expect(ran('INSERT INTO friend_connections')).toHaveLength(0);
  });

  it('a friend invite whose pair already has a request the other way no longer aborts matching', async () => {
    install([
      ['FROM friend_invites fi', { rows: [{ id: 'fi-1', token: 'tok', invited_by: INVITER, inviter_name: 'Phone One' }] }],
      ['SELECT id, requester_id, status FROM friend_connections', { rows: [{ id: CONN_ID, requester_id: OPENER, status: 'pending' }] }],
    ]);

    const summary = await linkPendingInvitesToUser(OPENER, { email: 'bob@test.com' });

    expect(summary.friends).toBe(0);
    expect(ran('UPDATE friend_invites SET claimed_at')).toHaveLength(1); // still consumed
    expect(ran('INSERT INTO friend_connections')).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Friend invite email
// ═══════════════════════════════════════════════════════════════════════════

describe('friend invite email', () => {
  const friendsService = require('../../src/modules/friends/friends.service');

  it('is tagged as an invite email and uses the brand name from config', async () => {
    install([
      ['FROM profiles WHERE user_id', { rows: [{ full_name: 'Phone One' }] }],
      ['INSERT INTO friend_invites', EMPTY],
    ]);

    await friendsService.createFriendInvite(INVITER, { channels: ['email'], emails: ['new@person.com'] });

    const sent = mailer.sendEmail.mock.calls[0][0];
    expect(sent.tags).toEqual(['transactional', 'invite']);
    expect(sent.html).toContain(config.brandName);
    expect(sent.html).not.toContain('Gatherrgo');
  });
});
