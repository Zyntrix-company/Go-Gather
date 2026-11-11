require('../setup');

const request = require('supertest');
const { validationResult } = require('express-validator');

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

jest.mock('../../src/modules/users/galleryEngagementNotifications', () => ({
  notifyGalleryLiked: jest.fn(),
  notifyGalleryComment: jest.fn(),
}));

jest.mock('../../src/modules/ai/ai.service', () => ({
  chat: jest.fn(),
  executeAction: jest.fn(),
  reportIssue: jest.fn(),
}));

jest.mock('../../src/modules/ai/aiUsage.service', () => ({
  logUsageEvent: jest.fn(),
}));

const app = require('../../src/app');
const db = require('../../src/config/database');
const aiService = require('../../src/modules/ai/ai.service');
const aiController = require('../../src/modules/ai/ai.controller');
const userValidators = require('../../src/modules/users/validators');
const tripValidation = require('../../src/modules/trips/trips.validation');
const eventValidation = require('../../src/modules/events/events.validation');
const galleryEngagement = require('../../src/modules/users/galleryEngagement.service');
const { generateAccessToken } = require('../../src/utils/token');

const USER_ID = '123e4567-e89b-12d3-a456-426614174000';
const TRIP_ID = 'aaaa0001-0000-4000-8000-000000000001';
const COMMENT_ID = 'cccc0001-0000-4000-8000-000000000001';
const token = generateAccessToken({ id: USER_ID, email: 'user@test.com' });

const str = (n) => 'a'.repeat(n);

// Runs express-validator chains against a body and returns the errors for one field.
const validate = async (chains, body, field, params = {}) => {
  const req = { body, params, query: {}, headers: {}, cookies: {} };
  for (const chain of chains) await chain.run(req);
  return validationResult(req).array().filter((e) => e.path === field);
};

const ENV_KEYS = [
  'LIMIT_GALLERY_COMMENT_MAX',
  'LIMIT_BIO_MAX',
  'LIMIT_TRIP_NAME_MAX',
  'LIMIT_SWEE_MESSAGE_MAX',
];

afterEach(() => {
  ENV_KEYS.forEach((k) => delete process.env[k]);
});

// ── Gallery comment (validator + service add/update) ─────────────────────────

describe('galleryCommentMax (100)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockReset();
  });

  it('validator accepts 100 chars and rejects 101 with "1–100 characters"', async () => {
    expect(await validate(userValidators.galleryCommentBody, { text: str(100) }, 'text')).toHaveLength(0);

    const errs = await validate(userValidators.galleryCommentBody, { text: str(101) }, 'text');
    expect(errs).toHaveLength(1);
    expect(errs[0].msg).toBe('Comment must be 1–100 characters');
  });

  it('addComment saves 100 chars', async () => {
    db.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{}] }) // isMember
      .mockResolvedValueOnce({ rows: [{ id: COMMENT_ID, user_id: USER_ID, text: str(100) }] }) // INSERT
      .mockResolvedValueOnce({ rows: [{ user_name: 'User', avatar_url: null }] }); // fetchUserDisplay

    const comment = await galleryEngagement.addComment(USER_ID, 'trip', TRIP_ID, str(100));
    expect(comment.text).toBe(str(100));
  });

  it('addComment rejects 101 chars with "1–100 characters"', async () => {
    db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{}] }); // isMember

    await expect(galleryEngagement.addComment(USER_ID, 'trip', TRIP_ID, str(101)))
      .rejects.toMatchObject({ statusCode: 400, message: 'Comment must be 1–100 characters' });
  });

  it('updateComment saves 100 chars and rejects 101', async () => {
    const row = { id: COMMENT_ID, user_id: USER_ID, parent_type: 'trip', parent_id: TRIP_ID, text: 'old' };
    db.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [row] }) // SELECT existing
      .mockResolvedValueOnce({ rowCount: 1, rows: [{}] }) // isMember
      .mockResolvedValueOnce({ rows: [{ ...row, text: str(100) }] }) // UPDATE
      .mockResolvedValueOnce({ rows: [{ user_name: 'User', avatar_url: null }] }); // fetchUserDisplay

    const updated = await galleryEngagement.updateComment(USER_ID, COMMENT_ID, str(100));
    expect(updated.text).toBe(str(100));

    await expect(galleryEngagement.updateComment(USER_ID, COMMENT_ID, str(101)))
      .rejects.toMatchObject({ statusCode: 400, message: 'Comment must be 1–100 characters' });
  });

  it('LIMIT_GALLERY_COMMENT_MAX changes validator and service', async () => {
    process.env.LIMIT_GALLERY_COMMENT_MAX = '60';
    let validators;
    let service;
    let isolatedDb;
    jest.isolateModules(() => {
      validators = require('../../src/modules/users/validators');
      service = require('../../src/modules/users/galleryEngagement.service');
      isolatedDb = require('../../src/config/database');
    });

    expect(await validate(validators.galleryCommentBody, { text: str(60) }, 'text')).toHaveLength(0);
    const errs = await validate(validators.galleryCommentBody, { text: str(61) }, 'text');
    expect(errs[0].msg).toBe('Comment must be 1–60 characters');

    isolatedDb.query.mockResolvedValueOnce({ rowCount: 1, rows: [{}] });
    await expect(service.addComment(USER_ID, 'trip', TRIP_ID, str(61)))
      .rejects.toMatchObject({ message: 'Comment must be 1–60 characters' });
  });
});

// ── Album description / subtitle ─────────────────────────────────────────────

describe('galleryAlbumDescriptionMax (80)', () => {
  it('create and update validators accept 80 and reject 81', async () => {
    const params = { albumId: TRIP_ID };
    for (const chains of [userValidators.createGalleryAlbumValidation, userValidators.updateGalleryAlbumValidation]) {
      expect(await validate(chains, { name: 'Album', section: 'trip', subtitle: str(80) }, 'subtitle', params)).toHaveLength(0);
      expect(await validate(chains, { name: 'Album', section: 'trip', subtitle: str(81) }, 'subtitle', params)).toHaveLength(1);
    }
  });
});

// ── Bio ──────────────────────────────────────────────────────────────────────

describe('bioMax (150)', () => {
  it('save and update profile validators accept 150 and reject 151', async () => {
    for (const chains of [userValidators.saveProfileValidation, userValidators.updateProfileValidation]) {
      expect(await validate(chains, { fullName: 'Test User', bio: str(150) }, 'bio')).toHaveLength(0);

      const errs = await validate(chains, { fullName: 'Test User', bio: str(151) }, 'bio');
      expect(errs).toHaveLength(1);
      expect(errs[0].msg).toBe('Bio must be at most 150 characters');
    }
  });

  it('LIMIT_BIO_MAX changes the validator', async () => {
    process.env.LIMIT_BIO_MAX = '200';
    let validators;
    jest.isolateModules(() => {
      validators = require('../../src/modules/users/validators');
    });

    expect(await validate(validators.updateProfileValidation, { bio: str(200) }, 'bio')).toHaveLength(0);
    const errs = await validate(validators.updateProfileValidation, { bio: str(201) }, 'bio');
    expect(errs[0].msg).toBe('Bio must be at most 200 characters');
  });
});

// ── Trip / event names ───────────────────────────────────────────────────────

describe('tripNameMax (40, min 3)', () => {
  it('create accepts 40, rejects 41 and rejects below the minimum of 3', async () => {
    expect(await validate(tripValidation.createTripValidation, { name: str(40) }, 'name')).toHaveLength(0);
    expect(await validate(tripValidation.createTripValidation, { name: str(41) }, 'name')).toHaveLength(1);
    expect(await validate(tripValidation.createTripValidation, { name: str(2) }, 'name')).toHaveLength(1);
    expect(await validate(tripValidation.createTripValidation, { name: str(3) }, 'name')).toHaveLength(0);
  });

  it('update keeps its 255 ceiling so existing longer names stay editable', async () => {
    const params = { id: TRIP_ID };
    expect(await validate(tripValidation.updateTripValidation, { name: str(255) }, 'name', params)).toHaveLength(0);
    expect(await validate(tripValidation.updateTripValidation, { name: str(256) }, 'name', params)).toHaveLength(1);
  });

  it('LIMIT_TRIP_NAME_MAX changes the validator', async () => {
    process.env.LIMIT_TRIP_NAME_MAX = '25';
    let validation;
    jest.isolateModules(() => {
      validation = require('../../src/modules/trips/trips.validation');
    });

    expect(await validate(validation.createTripValidation, { name: str(25) }, 'name')).toHaveLength(0);
    expect(await validate(validation.createTripValidation, { name: str(26) }, 'name')).toHaveLength(1);
  });
});

describe('eventNameMax (40, min 2)', () => {
  it('create accepts 40, rejects 41 and rejects below the minimum of 2', async () => {
    expect(await validate(eventValidation.createEventValidation, { name: str(40) }, 'name')).toHaveLength(0);
    expect(await validate(eventValidation.createEventValidation, { name: str(41) }, 'name')).toHaveLength(1);
    expect(await validate(eventValidation.createEventValidation, { name: str(1) }, 'name')).toHaveLength(1);
    expect(await validate(eventValidation.createEventValidation, { name: str(2) }, 'name')).toHaveLength(0);
  });

  it('update keeps its 255 ceiling so existing longer names stay editable', async () => {
    const params = { eventId: TRIP_ID };
    expect(await validate(eventValidation.updateEventValidation, { name: str(255) }, 'name', params)).toHaveLength(0);
    expect(await validate(eventValidation.updateEventValidation, { name: str(256) }, 'name', params)).toHaveLength(1);
  });
});

// ── maxLocations ─────────────────────────────────────────────────────────────

describe('maxLocations (10)', () => {
  const locs = (n) => Array.from({ length: n }, (_, i) => ({ name: `Place ${i}` }));

  it('trip and event validators accept 10 locations and reject 11', async () => {
    for (const chains of [tripValidation.createTripValidation, eventValidation.createEventValidation]) {
      expect(await validate(chains, { locations: locs(10) }, 'locations')).toHaveLength(0);

      const errs = await validate(chains, { locations: locs(11) }, 'locations');
      expect(errs).toHaveLength(1);
      expect(errs[0].msg).toBe('locations must be an array with 1-10 items');
    }
  });
});

// ── Swee message + report reason (new server checks) ─────────────────────────

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('sweeMessageMax (1000) — POST /ai/chat', () => {
  beforeEach(() => jest.clearAllMocks());

  it('accepts a 1000-char message', async () => {
    aiService.chat.mockResolvedValue({ reply: 'ok' });
    const res = mockRes();

    await aiController.chat({ user: { id: USER_ID }, body: { message: str(1000) } }, res, jest.fn());

    expect(aiService.chat).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rejects a 1001-char message with 400 and never calls Swee', async () => {
    const res = mockRes();

    await aiController.chat({ user: { id: USER_ID }, body: { message: str(1001) } }, res, jest.fn());

    expect(aiService.chat).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'BadRequest',
      message: 'message must be at most 1000 characters',
    });
  });

  it('measures the trimmed message', async () => {
    aiService.chat.mockResolvedValue({ reply: 'ok' });
    const res = mockRes();

    await aiController.chat({ user: { id: USER_ID }, body: { message: `  ${str(1000)}  ` } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('LIMIT_SWEE_MESSAGE_MAX changes the check', async () => {
    process.env.LIMIT_SWEE_MESSAGE_MAX = '20';
    let controller;
    jest.isolateModules(() => {
      controller = require('../../src/modules/ai/ai.controller');
    });
    const res = mockRes();

    await controller.chat({ user: { id: USER_ID }, body: { message: str(21) } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toBe('message must be at most 20 characters');
  });
});

describe('reportReasonMax (500) — POST /ai/report', () => {
  beforeEach(() => jest.clearAllMocks());

  it('accepts a 500-char reason', async () => {
    aiService.reportIssue.mockResolvedValue(undefined);
    const res = mockRes();

    await aiController.reportIssue({ user: { id: USER_ID }, body: { reason: str(500) } }, res, jest.fn());

    expect(aiService.reportIssue).toHaveBeenCalledWith(USER_ID, undefined, str(500));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('rejects a 501-char reason with 400', async () => {
    const res = mockRes();

    await aiController.reportIssue({ user: { id: USER_ID }, body: { reason: str(501) } }, res, jest.fn());

    expect(aiService.reportIssue).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'BadRequest',
      message: 'reason must be at most 500 characters',
    });
  });
});

describe('reportReasonMax (500) — POST /feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockReset();
  });

  it('accepts a 500-char message', async () => {
    db.query.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .post('/feedback')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: str(500) });

    expect(res.statusCode).toBe(201);
  });

  it('rejects a 501-char message with 400', async () => {
    const res = await request(app)
      .post('/feedback')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: str(501) });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('message must be at most 500 characters');
    expect(db.query).not.toHaveBeenCalled();
  });
});
