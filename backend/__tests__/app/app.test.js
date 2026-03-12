require('../setup');

const request = require('supertest');
const app = require('../../src/app');

describe('Health Check', () => {
  it('GET /health should return 200 with status ok', async () => {
    const res = await request(app).get('/health');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('environment');
  });
});

describe('404 Handler', () => {
  it('should return 404 for unknown routes', async () => {
    const res = await request(app).get('/nonexistent-route');

    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty('error', 'NotFound');
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('statusCode', 404);
  });
});
