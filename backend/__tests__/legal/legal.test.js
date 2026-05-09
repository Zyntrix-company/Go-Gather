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

jest.mock('../../src/utils/mailer', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));

const db = require('../../src/config/database');

const USER_ID = '123e4567-e89b-12d3-a456-426614174000';
const token = generateAccessToken({ id: USER_ID, email: 'alice@test.com' });

const publishedRow = (type, version) => ({
  document_type: type,
  version,
  content_html: '<p>Test content</p>',
  effective_at: new Date('2026-05-01T00:00:00.000Z'),
  published_at: new Date('2026-05-01T00:00:00.000Z'),
});

describe('Legal documents', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('GET /legal/privacy', () => {
    it('returns 404 when nothing published', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/legal/privacy');
      expect(res.status).toBe(404);
    });

    it('returns current privacy document', async () => {
      db.query.mockResolvedValueOnce({ rows: [publishedRow('privacy', '1.0.0')] });
      const res = await request(app).get('/legal/privacy');
      expect(res.status).toBe(200);
      expect(res.body.version).toBe('1.0.0');
      expect(res.body.documentType).toBe('privacy');
      expect(res.body.contentHtml).toContain('Test content');
      expect(res.body.title).toBe('Privacy Policy');
    });
  });

  describe('GET /legal/terms', () => {
    it('returns current terms document', async () => {
      db.query.mockResolvedValueOnce({ rows: [publishedRow('terms', '1.2.3')] });
      const res = await request(app).get('/legal/terms');
      expect(res.status).toBe(200);
      expect(res.body.version).toBe('1.2.3');
      expect(res.body.title).toBe('Terms & Conditions');
    });
  });

  describe('GET /users/legal-status', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/users/legal-status');
      expect(res.status).toBe(401);
    });

    it('returns needsAck when user ack is behind', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [publishedRow('privacy', '1.0.1')] })
        .mockResolvedValueOnce({ rows: [publishedRow('terms', '2.0.0')] })
        .mockResolvedValueOnce({
          rows: [{ privacy_policy_ack_version: '1.0.0', terms_ack_version: '2.0.0' }],
        });

      const res = await request(app)
        .get('/users/legal-status')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.privacy.needsAck).toBe(true);
      expect(res.body.terms.needsAck).toBe(false);
      expect(res.body.privacy.currentVersion).toBe('1.0.1');
    });
  });

  describe('POST /users/legal-ack', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).post('/users/legal-ack').send({});
      expect(res.status).toBe(401);
    });

    it('returns 400 when version does not match current', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [publishedRow('privacy', '1.0.1')] })
        .mockResolvedValueOnce({ rows: [publishedRow('terms', '2.0.0')] });

      const res = await request(app)
        .post('/users/legal-ack')
        .set('Authorization', `Bearer ${token}`)
        .send({ privacyVersion: '9.9.9' });

      expect(res.status).toBe(400);
    });

    it('updates ack when version matches', async () => {
      const p = publishedRow('privacy', '1.0.1');
      const t = publishedRow('terms', '2.0.0');
      db.query
        .mockResolvedValueOnce({ rows: [p] })
        .mockResolvedValueOnce({ rows: [t] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [p] })
        .mockResolvedValueOnce({ rows: [t] })
        .mockResolvedValueOnce({
          rows: [{ privacy_policy_ack_version: '1.0.1', terms_ack_version: '2.0.0' }],
        });

      const res = await request(app)
        .post('/users/legal-ack')
        .set('Authorization', `Bearer ${token}`)
        .send({ privacyVersion: '1.0.1' });

      expect(res.status).toBe(200);
      expect(res.body.privacy.needsAck).toBe(false);
    });
  });
});
