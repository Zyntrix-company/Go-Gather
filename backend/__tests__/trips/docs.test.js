const request = require('supertest');
const app = require('../../src/app');
const { generateAccessToken } = require('../../src/utils/token');
const path = require('path');

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

jest.mock('../../src/utils/s3.util', () => ({
  uploadToS3: jest.fn(),
  deleteFromS3: jest.fn(),
  sanitiseFilename: jest.fn(),
  getPresignedDownloadUrl: jest.fn(),
}));

const db = require('../../src/config/database');
const s3Util = require('../../src/utils/s3.util');

const USER_ID  = '123e4567-e89b-12d3-a456-426614174000';
const USER2_ID = '223e4567-e89b-12d3-a456-426614174001';
const TRIP_ID  = 'aaaa0001-0000-4000-8000-000000000001';
const DOC_ID   = 'dddd0001-0000-4000-8000-000000000001';
const token    = generateAccessToken({ id: USER_ID, email: 'alice@test.com' });

const mockTripMember = () => {
  db.query
    .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: TRIP_ID }] })
    .mockResolvedValueOnce({ rowCount: 1, rows: [{ role: 'member' }] });
};

const mockTripMemberAdmin = () => {
  db.query
    .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: TRIP_ID }] })
    .mockResolvedValueOnce({ rowCount: 1, rows: [{ role: 'admin' }] });
};

const docRow = {
  id: DOC_ID,
  parent_type: 'trip',
  parent_id: TRIP_ID,
  file_name: 'hotel_booking.pdf',
  s3_key: 'trips/uuid/docs/uuid-hotel_booking.pdf',
  file_url: 'https://cdn.test.com/hotel_booking.pdf',
  file_size: 245760,
  mime_type: 'application/pdf',
  uploaded_by: USER_ID,
  created_at: new Date().toISOString(),
};

describe('Docs Routes', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // resetAllMocks() wipes the mockResolvedValue set in the jest.mock() factory
    // above, so re-apply it here — uploadToS3's real return shape is
    // { url, finalBytes, compressed }, not a bare string.
    s3Util.uploadToS3.mockResolvedValue({ url: 'https://cdn.test.com/doc.pdf', finalBytes: 12345, compressed: false });
    s3Util.deleteFromS3.mockResolvedValue(true);
    s3Util.sanitiseFilename.mockImplementation((n) => n);
    s3Util.getPresignedDownloadUrl.mockResolvedValue('https://presigned.url/doc.pdf');
  });

  // ── GET /trips/:id/docs ────────────────────────────────────────────────────

  describe('GET /trips/:id/docs', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get(`/trips/${TRIP_ID}/docs`);
      expect(res.statusCode).toBe(401);
    });

    it('returns 200 with docs list', async () => {
      mockTripMember();
      db.query.mockResolvedValueOnce({ rows: [docRow] });

      const res = await request(app)
        .get(`/trips/${TRIP_ID}/docs`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.docs)).toBe(true);
      expect(res.body.docs[0].fileName).toBe('hotel_booking.pdf');
    });

    it('returns empty list when no docs uploaded', async () => {
      mockTripMember();
      db.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get(`/trips/${TRIP_ID}/docs`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.docs).toHaveLength(0);
    });
  });

  // ── POST /trips/:id/docs ───────────────────────────────────────────────────

  describe('POST /trips/:id/docs (multipart)', () => {
    it('returns 400 when no file is attached', async () => {
      mockTripMember();

      const res = await request(app)
        .post(`/trips/${TRIP_ID}/docs`)
        .set('Authorization', `Bearer ${token}`)
        // No file attached
        .send();

      // Multer won't process it; the controller checks req.file
      expect([400, 422]).toContain(res.statusCode);
    });

    it('returns 201 when a valid PDF is uploaded', async () => {
      mockTripMember();
      db.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })  // COUNT existing docs
        .mockResolvedValueOnce({ rows: [docRow] })           // INSERT doc
        .mockResolvedValueOnce({ rows: [{ full_name: 'Alice', avatar_url: null }] }); // profile fetch

      // Create a minimal valid PDF buffer (magic bytes: %PDF)
      const pdfBuffer = Buffer.from('%PDF-1.4 minimal test content');

      const res = await request(app)
        .post(`/trips/${TRIP_ID}/docs`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', pdfBuffer, { filename: 'hotel_booking.pdf', contentType: 'application/pdf' });

      expect(res.statusCode).toBe(201);
      expect(res.body.doc.fileName).toBe('hotel_booking.pdf');
    });
  });

  // ── DELETE /trips/:id/docs/:docId ──────────────────────────────────────────

  describe('DELETE /trips/:id/docs/:docId', () => {
    it('returns 403 when non-uploader non-admin tries to delete', async () => {
      mockTripMember();
      db.query.mockResolvedValueOnce({
        rows: [{ ...docRow, uploaded_by: USER2_ID }], // uploaded by someone else
      });

      const res = await request(app)
        .delete(`/trips/${TRIP_ID}/docs/${DOC_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(403);
    });

    it('returns 404 when doc not found', async () => {
      mockTripMember();
      db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

      const res = await request(app)
        .delete(`/trips/${TRIP_ID}/docs/${DOC_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(404);
    });

    it('returns 200 when uploader deletes own doc', async () => {
      mockTripMember();
      db.query
        .mockResolvedValueOnce({ rows: [{ ...docRow, uploaded_by: USER_ID }] }) // find doc
        .mockResolvedValueOnce({ rows: [{ id: DOC_ID }] });                    // DELETE

      const res = await request(app)
        .delete(`/trips/${TRIP_ID}/docs/${DOC_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 200 when admin deletes any doc', async () => {
      mockTripMemberAdmin();
      db.query
        .mockResolvedValueOnce({ rows: [{ ...docRow, uploaded_by: USER2_ID }] }) // find doc
        .mockResolvedValueOnce({ rows: [{ id: DOC_ID }] });                     // DELETE

      const res = await request(app)
        .delete(`/trips/${TRIP_ID}/docs/${DOC_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
    });
  });
});
