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

jest.mock('../../src/modules/ai/ai.service', () => ({
  chat: jest.fn(),
  executeAction: jest.fn(),
  reportIssue: jest.fn(),
}));

const db = require('../../src/config/database');
const aiService = require('../../src/modules/ai/ai.service');
const conversationsService = require('../../src/modules/ai/conversations.service');

const USER_ID = '123e4567-e89b-12d3-a456-426614174000';
const OTHER_USER = '223e4567-e89b-12d3-a456-426614174001';
const CONV_ID = 'aaaa0001-0000-4000-8000-000000000001';
const MSG_ID = 'bbbb0001-0000-4000-8000-000000000001';
const token = generateAccessToken({ id: USER_ID, email: 'alice@test.com' });

const convRow = {
  id: CONV_ID,
  user_id: USER_ID,
  title: 'Trip to Bali',
  preview: 'What dates work for you?',
  category: 'trip',
  trip_context: { contextType: 'trip', name: 'Bali' },
  metadata: {},
  created_at: '2026-06-01T10:00:00Z',
  updated_at: '2026-06-08T10:00:00Z',
  deleted_at: null,
};

describe('conversations.service helpers', () => {
  it('refineTitle uses destination for create_trip', () => {
    expect(conversationsService.refineTitle('plan bali', {
      intent: 'create_trip',
      draft: { destination: 'Bali' },
    }, 'New chat')).toBe('Trip to Bali');
  });

  it('inferCategory maps trip context and intents', () => {
    expect(conversationsService.inferCategory({ contextType: 'trip' }, null)).toBe('trip');
    expect(conversationsService.inferCategory(null, { intent: 'create_event' })).toBe('event');
    expect(conversationsService.inferCategory(null, { intent: 'add_note' })).toBe('content');
    expect(conversationsService.inferCategory(null, null)).toBe('general');
  });

  it('buildPreview strips markdown and truncates', () => {
    const preview = conversationsService.buildPreview('**Hello** | col | and more text that should be truncated eventually');
    expect(preview).not.toContain('**');
    expect(preview.length).toBeLessThanOrEqual(80);
  });

  it('titleFromFirstMessage truncates first user message', () => {
    const long = 'a'.repeat(80);
    expect(conversationsService.titleFromFirstMessage(long).length).toBeLessThanOrEqual(50);
  });
});

describe('GET /ai/conversations', () => {
  beforeEach(() => jest.resetAllMocks());

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/ai/conversations');
    expect(res.statusCode).toBe(401);
  });

  it('returns paginated conversations', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [convRow] })
      .mockResolvedValueOnce({ rows: [{ total: 1 }] });

    const res = await request(app)
      .get('/ai/conversations?page=1&limit=20')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.conversations).toHaveLength(1);
    expect(res.body.conversations[0].title).toBe('Trip to Bali');
    expect(res.body.hasMore).toBe(false);
  });
});

describe('POST /ai/conversations', () => {
  beforeEach(() => jest.resetAllMocks());

  it('creates a conversation with optional trip context', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ ...convRow, title: 'Chat: Bali Trip', preview: '' }],
    });

    const res = await request(app)
      .post('/ai/conversations')
      .set('Authorization', `Bearer ${token}`)
      .send({ tripContext: { contextType: 'trip', name: 'Bali Trip' } });

    expect(res.statusCode).toBe(201);
    expect(res.body.category).toBe('trip');
    expect(res.body.title).toContain('Bali');
  });
});

describe('DELETE /ai/conversations/:id', () => {
  beforeEach(() => jest.resetAllMocks());

  it('returns 404 when conversation is not owned', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete(`/ai/conversations/${CONV_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(404);
  });

  it('soft-deletes owned conversation', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [convRow] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete(`/ai/conversations/${CONV_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /ai/conversations/:id/messages', () => {
  beforeEach(() => jest.resetAllMocks());

  it('returns messages for owned conversation', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [convRow] })
      .mockResolvedValueOnce({
        rows: [{
          id: MSG_ID,
          role: 'assistant',
          content: 'Hi there',
          metadata: {},
          created_at: '2026-06-08T10:00:00Z',
        }],
      });

    const res = await request(app)
      .get(`/ai/conversations/${CONV_ID}/messages`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.messages).toHaveLength(1);
    expect(res.body.messages[0].content).toBe('Hi there');
  });
});

describe('POST /ai/chat with conversationId', () => {
  beforeEach(() => jest.resetAllMocks());

  it('returns conversationId from chat service', async () => {
    aiService.chat.mockResolvedValueOnce({
      reply: 'Sure!',
      pendingAction: null,
      conversationId: CONV_ID,
      messageId: MSG_ID,
    });

    const res = await request(app)
      .post('/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Hello', conversationId: CONV_ID });

    expect(res.statusCode).toBe(200);
    expect(res.body.conversationId).toBe(CONV_ID);
    expect(aiService.chat).toHaveBeenCalledWith(
      USER_ID,
      'Hello',
      expect.objectContaining({ conversationId: CONV_ID }),
    );
  });

  it('rejects invalid conversationId', async () => {
    const res = await request(app)
      .post('/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Hello', conversationId: 'not-a-uuid' });

    expect(res.statusCode).toBe(400);
  });
});
