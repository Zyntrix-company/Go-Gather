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
const USER3_ID = '323e4567-e89b-12d3-a456-426614174002';
const TRIP_ID  = 'aaaa0001-0000-4000-8000-000000000001';
const EXP_ID   = 'eeee0001-0000-4000-8000-000000000001';
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

const expenseRow = {
  id: EXP_ID,
  description: 'Hotel',
  amount: '6000.00',
  currency: 'INR',
  category: 'accommodation',
  split_type: 'equal',
  paid_by: USER_ID,
  parent_type: 'trip',
  parent_id: TRIP_ID,
  created_at: new Date().toISOString(),
};

describe('Expense Routes', () => {
  beforeEach(() => jest.resetAllMocks());

  // ── POST /trips/:id/expenses ───────────────────────────────────────────────

  describe('POST /trips/:id/expenses', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).post(`/trips/${TRIP_ID}/expenses`).send({});
      expect(res.statusCode).toBe(401);
    });

    it('returns 403 when not a trip member', async () => {
      db.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: TRIP_ID }] })
        .mockResolvedValueOnce({ rowCount: 0, rows: [] });

      const res = await request(app)
        .post(`/trips/${TRIP_ID}/expenses`)
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'Dinner', amount: 1000, splitType: 'equal', splitAmong: [{ userId: USER_ID }] });

      expect(res.statusCode).toBe(403);
    });

    it('returns 201 with equal split expense', async () => {
      mockTripMemberAdmin();

      // assertParentMember: paidBy + 3 splitAmong users
      db.query
        .mockResolvedValueOnce({ rowCount: 1 }) // paidBy (USER_ID) is trip member
        .mockResolvedValueOnce({ rowCount: 1 }) // USER_ID is trip member
        .mockResolvedValueOnce({ rowCount: 1 }) // USER2_ID is trip member
        .mockResolvedValueOnce({ rowCount: 1 }) // USER3_ID is trip member
        // fetchProfiles after transaction
        .mockResolvedValueOnce({ rows: [] })    // profiles fetch
        // computeSimplifiedDebts
        .mockResolvedValueOnce({ rows: [] })    // splits query
        .mockResolvedValueOnce({ rows: [] });   // settlements query

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined)                                  // BEGIN
          .mockResolvedValueOnce({ rows: [{ ...expenseRow, id: EXP_ID }] }) // INSERT expense
          .mockResolvedValueOnce({ rows: [] })                               // INSERT split 1
          .mockResolvedValueOnce({ rows: [] })                               // INSERT split 2
          .mockResolvedValueOnce({ rows: [] })                               // INSERT split 3
          .mockResolvedValueOnce(undefined),                                 // COMMIT
        release: jest.fn(),
      };
      db.getClient.mockResolvedValue(mockClient);

      const res = await request(app)
        .post(`/trips/${TRIP_ID}/expenses`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          description: 'Hotel',
          amount: 6000,
          currency: 'INR',
          category: 'accommodation',
          paidBy: USER_ID,
          splitType: 'equal',
          splitAmong: [
            { userId: USER_ID },
            { userId: USER2_ID },
            { userId: USER3_ID },
          ],
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.expense).toHaveProperty('id');
      expect(res.body.expense.description).toBe('Hotel');
    });

    it('returns 400 when amount split does not sum to total', async () => {
      mockTripMemberAdmin();

      // assertParentMember: paidBy + 2 splitAmong users
      db.query
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 1 })
        .mockResolvedValueOnce({ rowCount: 1 });

      const res = await request(app)
        .post(`/trips/${TRIP_ID}/expenses`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          description: 'Dinner',
          amount: 1000,
          paidBy: USER_ID,
          splitType: 'amount',
          splitAmong: [
            { userId: USER_ID,  amount: 400 },
            { userId: USER2_ID, amount: 400 }, // 400+400=800 ≠ 1000
          ],
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });

  // ── GET /trips/:id/expenses ────────────────────────────────────────────────

  describe('GET /trips/:id/expenses', () => {
    it('returns 200 with paginated expense list', async () => {
      mockTripMember();
      db.query
        .mockResolvedValueOnce({ rows: [{ grand_total: '6000' }] })  // grandTotal query
        .mockResolvedValueOnce({
          rows: [{
            ...expenseRow,
            paid_by_name: 'Alice',
            paid_by_avatar: null,
            splits: [
              { userId: USER_ID, amount: 2000, percentage: null },
              { userId: USER2_ID, amount: 2000, percentage: null },
              { userId: USER3_ID, amount: 2000, percentage: null },
            ],
            total_count: 1,
          }],
        });

      const res = await request(app)
        .get(`/trips/${TRIP_ID}/expenses`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.expenses)).toBe(true);
    });
  });

  // ── GET /trips/:id/balances ────────────────────────────────────────────────

  describe('GET /trips/:id/balances', () => {
    it('returns 200 with empty outstanding when no expenses', async () => {
      mockTripMember();
      db.query
        .mockResolvedValueOnce({ rows: [{ total_paid: '0' }] })   // total_paid (Promise.all[0])
        .mockResolvedValueOnce({ rows: [{ total_share: '0' }] })  // total_share (Promise.all[1])
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })        // total (Promise.all[2])
        .mockResolvedValueOnce({ rows: [] })                      // computeSimplifiedDebts: splits
        .mockResolvedValueOnce({ rows: [] });                     // computeSimplifiedDebts: settlements

      const res = await request(app)
        .get(`/trips/${TRIP_ID}/balances`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.outstanding).toEqual([]);
    });

    it('returns simplified debts when expenses exist', async () => {
      mockTripMember();
      db.query
        .mockResolvedValueOnce({ rows: [{ total_paid: '4000' }] })  // total_paid
        .mockResolvedValueOnce({ rows: [{ total_share: '2000' }] }) // total_share
        .mockResolvedValueOnce({ rows: [{ total: '6000' }] })       // total
        .mockResolvedValueOnce({
          rows: [
            { user_id: USER2_ID, amount: '2000', paid_by: USER_ID },
            { user_id: USER3_ID, amount: '2000', paid_by: USER_ID },
          ],
        })                                                          // computeSimplifiedDebts: splits
        .mockResolvedValueOnce({ rows: [] })                        // computeSimplifiedDebts: settlements
        .mockResolvedValueOnce({ rows: [] });                       // fetchProfiles

      const res = await request(app)
        .get(`/trips/${TRIP_ID}/balances`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.outstanding).toHaveLength(2);
      expect(res.body.outstanding[0].direction).toBe('owes_you');
    });
  });

  // ── POST /trips/:id/settlements ────────────────────────────────────────────

  describe('POST /trips/:id/settlements', () => {
    it('returns 400 when withUserId or amount is missing', async () => {
      mockTripMember();

      const res = await request(app)
        .post(`/trips/${TRIP_ID}/settlements`)
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 500 }); // missing withUserId

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 200 after recording settlement', async () => {
      mockTripMember();
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'settle-id' }] }) // INSERT settlement
        .mockResolvedValueOnce({ rows: [] })                    // splits for recompute
        .mockResolvedValueOnce({ rows: [] });                   // settlements for recompute

      const res = await request(app)
        .post(`/trips/${TRIP_ID}/settlements`)
        .set('Authorization', `Bearer ${token}`)
        .send({ withUserId: USER2_ID, amount: 2000 });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('outstanding');
    });
  });

  // ── DELETE /trips/:id/expenses/:eid ───────────────────────────────────────

  describe('DELETE /trips/:id/expenses/:eid', () => {
    it('returns 403 when member tries to delete someone else\'s expense', async () => {
      mockTripMember();
      db.query.mockResolvedValueOnce({
        rows: [{ ...expenseRow, created_by: USER2_ID }], // created by someone else
      });

      const res = await request(app)
        .delete(`/trips/${TRIP_ID}/expenses/${EXP_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(403);
    });

    it('returns 200 when creator deletes their own expense', async () => {
      mockTripMember();
      db.query
        .mockResolvedValueOnce({ rows: [{ ...expenseRow, paid_by: USER_ID, created_by: USER_ID }] }) // find expense
        .mockResolvedValueOnce({ rowCount: 1 })   // DELETE
        .mockResolvedValueOnce({ rows: [] })       // splits recompute
        .mockResolvedValueOnce({ rows: [] });      // settlements recompute

      const res = await request(app)
        .delete(`/trips/${TRIP_ID}/expenses/${EXP_ID}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
