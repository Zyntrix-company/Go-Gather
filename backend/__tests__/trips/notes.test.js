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

const USER_ID  = '123e4567-e89b-12d3-a456-426614174000';
const USER2_ID = '223e4567-e89b-12d3-a456-426614174001';
const TRIP_ID  = 'aaaa0001-0000-4000-8000-000000000001';
const NOTE_ID  = 'abcd0001-0000-4000-8000-000000000001';
const token    = generateAccessToken({ id: USER_ID, email: 'alice@test.com' });

const mockTripMemberAdmin = () => {
  db.query
    .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: TRIP_ID }] })
    .mockResolvedValueOnce({ rowCount: 1, rows: [{ role: 'admin' }] });
};

const mockTripMember = () => {
  db.query
    .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: TRIP_ID }] })
    .mockResolvedValueOnce({ rowCount: 1, rows: [{ role: 'member' }] });
};

const noteRow = {
  id: NOTE_ID,
  parent_type: 'trip',
  parent_id: TRIP_ID,
  title: 'Things to pack',
  content: 'Sunscreen, camera, adapter',
  category: 'todo',
  created_by: USER_ID,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('Notes Routes', () => {
  beforeEach(() => jest.resetAllMocks());

  // ── GET /trips/:id/notes ───────────────────────────────────────────────────

  describe('GET /trips/:id/notes', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get(`/trips/${TRIP_ID}/notes`);
      expect(res.statusCode).toBe(401);
    });

    it('returns 200 with notes list', async () => {
      mockTripMember();
      db.query.mockResolvedValueOnce({ rows: [noteRow] });

      const res = await request(app)
        .get(`/trips/${TRIP_ID}/notes`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.notes).toHaveLength(1);
      expect(res.body.notes[0].title).toBe('Things to pack');
    });
  });

  // ── POST /trips/:id/notes ──────────────────────────────────────────────────

  describe('POST /trips/:id/notes', () => {
    it('returns 400 when title is missing', async () => {
      mockTripMember();

      const res = await request(app)
        .post(`/trips/${TRIP_ID}/notes`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Some content', category: 'general' });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when content is missing', async () => {
      mockTripMember();

      const res = await request(app)
        .post(`/trips/${TRIP_ID}/notes`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'My Note' });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for invalid category', async () => {
      mockTripMember();

      const res = await request(app)
        .post(`/trips/${TRIP_ID}/notes`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'My Note', content: 'Content', category: 'invalid_category' });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when title exceeds 255 characters', async () => {
      mockTripMember();

      const res = await request(app)
        .post(`/trips/${TRIP_ID}/notes`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'a'.repeat(256), content: 'Content' });

      expect(res.statusCode).toBe(400);
    });

    it('returns 201 with created note', async () => {
      mockTripMember();
      db.query
        .mockResolvedValueOnce({ rows: [noteRow] })                             // INSERT note
        .mockResolvedValueOnce({ rows: [{ full_name: 'Alice', avatar_url: null }] }); // profile fetch

      const res = await request(app)
        .post(`/trips/${TRIP_ID}/notes`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Things to pack', content: 'Sunscreen, camera', category: 'todo' });

      expect(res.statusCode).toBe(201);
      expect(res.body.note.title).toBe('Things to pack');
      expect(res.body.note.category).toBe('todo');
    });

    it('accepts all valid categories', async () => {
      const categories = ['general', 'idea', 'important', 'todo'];

      for (const category of categories) {
        mockTripMember();
        db.query
          .mockResolvedValueOnce({ rows: [{ ...noteRow, category }] })          // INSERT note
          .mockResolvedValueOnce({ rows: [{ full_name: 'Alice', avatar_url: null }] }); // profile fetch

        const res = await request(app)
          .post(`/trips/${TRIP_ID}/notes`)
          .set('Authorization', `Bearer ${token}`)
          .send({ title: 'Test', content: 'Test', category });

        expect(res.statusCode).toBe(201);
        jest.clearAllMocks();
      }
    });
  });

  // ── PUT /trips/:id/notes/:noteId ───────────────────────────────────────────

  describe('PUT /trips/:id/notes/:noteId', () => {
    it('returns 200 when any member updates a note', async () => {
      mockTripMember();
      db.query
        .mockResolvedValueOnce({ rows: [{ ...noteRow, created_by: USER2_ID }] })          // find note
        .mockResolvedValueOnce({ rows: [{ ...noteRow, title: 'Updated', created_by: USER2_ID }] }) // UPDATE
        .mockResolvedValueOnce({ rows: [{ full_name: 'Bob', avatar_url: null }] })        // creator profile
        .mockResolvedValueOnce({ rows: [{ full_name: 'Alice' }] });                       // editor profile

      const res = await request(app)
        .put(`/trips/${TRIP_ID}/notes/${NOTE_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Updated' });

      expect(res.statusCode).toBe(200);
    });

    it('returns 200 when creator updates own note', async () => {
      mockTripMember();
      db.query
        .mockResolvedValueOnce({ rows: [{ ...noteRow, created_by: USER_ID }] })            // find note
        .mockResolvedValueOnce({ rows: [{ ...noteRow, title: 'Updated Title' }] })         // UPDATE
        .mockResolvedValueOnce({ rows: [{ full_name: 'Alice', avatar_url: null }] })       // creator profile
        .mockResolvedValueOnce({ rows: [{ full_name: 'Alice' }] });                        // editor profile

      const res = await request(app)
        .put(`/trips/${TRIP_ID}/notes/${NOTE_ID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Updated Title' });

      expect(res.statusCode).toBe(200);
    });
  });

  // ── DELETE /trips/:id/notes/:noteId ───────────────────────────────────────

  describe('DELETE /trips/:id/notes/:noteId', () => {
    it('returns 200 when admin deletes any note', async () => {
      mockTripMemberAdmin();
      db.query
        .mockResolvedValueOnce({ rows: [{ ...noteRow, created_by: USER2_ID }] }) // find note
        .mockResolvedValueOnce({ rows: [{ id: NOTE_ID }] });                     // DELETE

      const res = await request(app)
        .delete(`/trips/${TRIP_ID}/notes/${NOTE_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
