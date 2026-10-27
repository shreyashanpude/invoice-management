const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const Customer = require('../models/Customer');

const TEST_DB = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/smart_invoice_test';

let token;
let token2;

beforeAll(async () => {
  await mongoose.connect(TEST_DB);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Customer.deleteMany({});

  const reg1 = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'User 1', email: 'user1@example.com', password: 'Password1' });
  token = reg1.body.data.token;

  const reg2 = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'User 2', email: 'user2@example.com', password: 'Password1' });
  token2 = reg2.body.data.token;
});

describe('Customer CRUD API', () => {
  describe('POST /api/v1/customers', () => {
    it('creates a customer', async () => {
      const res = await request(app)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'ACME Corp', email: 'acme@example.com', phone: '9876543210' });
      expect(res.status).toBe(201);
      expect(res.body.data.customer.name).toBe('ACME Corp');
      expect(res.body.data.customer.user).toBeDefined();
    });

    it('rejects customer with short name', async () => {
      const res = await request(app)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'A' });
      expect(res.status).toBe(422);
    });

    it('rejects invalid email', async () => {
      const res = await request(app)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Valid Name', email: 'not-valid' });
      expect(res.status).toBe(422);
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .post('/api/v1/customers')
        .send({ name: 'ACME Corp' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/customers', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Customer One' });
      await request(app)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Customer Two' });
    });

    it('returns only current user customers', async () => {
      const res = await request(app)
        .get('/api/v1/customers')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);

      // user2 should see 0 customers
      const res2 = await request(app)
        .get('/api/v1/customers')
        .set('Authorization', `Bearer ${token2}`);
      expect(res2.body.data.length).toBe(0);
    });

    it('supports search', async () => {
      const res = await request(app)
        .get('/api/v1/customers?search=One')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].name).toBe('Customer One');
    });

    it('supports pagination', async () => {
      const res = await request(app)
        .get('/api/v1/customers?page=1&limit=1')
        .set('Authorization', `Bearer ${token}`);
      expect(res.body.pagination.total).toBe(2);
      expect(res.body.data.length).toBe(1);
    });
  });

  describe('GET /api/v1/customers/:id', () => {
    let customerId;
    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test Customer' });
      customerId = res.body.data.customer._id;
    });

    it('returns customer by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/customers/${customerId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.customer._id).toBe(customerId);
    });

    it('prevents cross-user access', async () => {
      const res = await request(app)
        .get(`/api/v1/customers/${customerId}`)
        .set('Authorization', `Bearer ${token2}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/v1/customers/:id', () => {
    let customerId;
    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Original Name' });
      customerId = res.body.data.customer._id;
    });

    it('updates a customer', async () => {
      const res = await request(app)
        .put(`/api/v1/customers/${customerId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name', phone: '1234567890' });
      expect(res.status).toBe(200);
      expect(res.body.data.customer.name).toBe('Updated Name');
    });

    it('prevents cross-user update', async () => {
      const res = await request(app)
        .put(`/api/v1/customers/${customerId}`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ name: 'Hacked Name' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/customers/:id', () => {
    let customerId;
    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'To Delete' });
      customerId = res.body.data.customer._id;
    });

    it('deletes a customer with no invoices', async () => {
      const res = await request(app)
        .delete(`/api/v1/customers/${customerId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);

      const check = await request(app)
        .get(`/api/v1/customers/${customerId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(check.status).toBe(404);
    });
  });
});
