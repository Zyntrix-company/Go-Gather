require('../setup');

const express = require('express');
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

const app = require('../../src/app');

const DEFAULTS = {
  galleryCommentMax: 100,
  galleryAlbumDescriptionMax: 80,
  tripNameMax: 40,
  eventNameMax: 40,
  bioMax: 150,
  sweeMessageMax: 1000,
  reportReasonMax: 500,
  maxLocations: 10,
  sweeTravelFocusMax: 3,
};

const ENV_KEYS = [
  'LIMIT_GALLERY_COMMENT_MAX',
  'LIMIT_GALLERY_ALBUM_DESCRIPTION_MAX',
  'LIMIT_TRIP_NAME_MAX',
  'LIMIT_EVENT_NAME_MAX',
  'LIMIT_BIO_MAX',
  'LIMIT_SWEE_MESSAGE_MAX',
  'LIMIT_REPORT_REASON_MAX',
  'LIMIT_MAX_LOCATIONS',
  'LIMIT_SWEE_TRAVEL_FOCUS_MAX',
];

describe('GET /config/app-limits', () => {
  afterEach(() => {
    ENV_KEYS.forEach((k) => delete process.env[k]);
  });

  it('is public and returns every limit at its default', async () => {
    const res = await request(app).get('/config/app-limits');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(DEFAULTS);
    expect(res.headers['cache-control']).toBe('public, max-age=300');
  });

  it('leaves /config/upload-limits untouched', async () => {
    const res = await request(app).get('/config/upload-limits');

    expect(res.statusCode).toBe(200);
    expect(res.body).not.toHaveProperty('galleryCommentMax');
    expect(res.body).toHaveProperty('tripPhoto');
  });

  it('reflects LIMIT_* env overrides in the response', async () => {
    process.env.LIMIT_GALLERY_COMMENT_MAX = '60';
    process.env.LIMIT_BIO_MAX = '200';
    process.env.LIMIT_MAX_LOCATIONS = '4';

    let router;
    jest.isolateModules(() => {
      router = require('../../src/modules/config/uploadLimits.routes');
    });
    const res = await request(express().use('/config', router)).get('/config/app-limits');

    expect(res.body).toEqual({
      ...DEFAULTS,
      galleryCommentMax: 60,
      bioMax: 200,
      maxLocations: 4,
    });
  });

  it('ignores invalid env values and keeps the default', async () => {
    process.env.LIMIT_TRIP_NAME_MAX = 'abc';
    process.env.LIMIT_EVENT_NAME_MAX = '0';

    let router;
    jest.isolateModules(() => {
      router = require('../../src/modules/config/uploadLimits.routes');
    });
    const res = await request(express().use('/config', router)).get('/config/app-limits');

    expect(res.body.tripNameMax).toBe(40);
    expect(res.body.eventNameMax).toBe(40);
  });

  it('clamps galleryCommentMax to the 500 DB ceiling', async () => {
    process.env.LIMIT_GALLERY_COMMENT_MAX = '600';

    let router;
    jest.isolateModules(() => {
      router = require('../../src/modules/config/uploadLimits.routes');
    });
    const res = await request(express().use('/config', router)).get('/config/app-limits');

    expect(res.body.galleryCommentMax).toBe(500);
  });

  it('drives MAX_LOCATIONS in locations.util from the config', () => {
    expect(require('../../src/utils/locations.util').MAX_LOCATIONS).toBe(10);

    process.env.LIMIT_MAX_LOCATIONS = '3';
    jest.isolateModules(() => {
      expect(require('../../src/utils/locations.util').MAX_LOCATIONS).toBe(3);
    });
  });
});
