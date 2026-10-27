const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');

const TEST_DB = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/smart_invoice_test';

beforeAll(async () => {
  await mongoose.connect(TEST_DB);
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('Health Check', () => {
  it('GET /api/v1/health returns connected status', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database.connected).toBe(true);
    expect(res.body.database.status).toBe('connected');
    // Ensure no credentials are leaked
    expect(JSON.stringify(res.body)).not.toContain('password');
    expect(JSON.stringify(res.body)).not.toContain('mongodb+srv');
  });
});
