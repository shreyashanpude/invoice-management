const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');

const TEST_DB = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/smart_invoice_test';

let token;
let customerId;
let userId;

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
  await Invoice.deleteMany({});

  // Register and login
  const regRes = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'Test User', email: 'test@example.com', password: 'Password1' });
  token = regRes.body.data.token;
  userId = regRes.body.data.user._id;

  // Create customer
  const custRes = await request(app)
    .post('/api/v1/customers')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Test Customer', email: 'customer@test.com' });
  customerId = custRes.body.data.customer._id;
});

const validInvoicePayload = () => ({
  customerId,
  issueDate: '2025-01-01',
  dueDate: '2025-01-31',
  lineItems: [
    { description: 'Web Development', quantity: 10, unitPrice: 500, taxRate: 18 },
  ],
  discountType: 'percentage',
  discountValue: 0,
  status: 'draft',
});

describe('Invoice CRUD API', () => {
  describe('POST /api/v1/invoices', () => {
    it('creates an invoice and returns correct totals', async () => {
      const res = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${token}`)
        .send(validInvoicePayload());

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const inv = res.body.data.invoice;
      expect(inv.invoiceNumber).toBeDefined();
      // subtotal: 10 * 50000 = 500000 paise
      expect(inv.subtotal).toBe(500000);
      // taxTotal: 500000 * 0.18 = 90000 paise
      expect(inv.taxTotal).toBe(90000);
      expect(inv.grandTotal).toBe(590000);
      expect(inv.paidAmount).toBe(0);
    });

    it('saves the uploaded source file reference', async () => {
      const sourceFile = 'invoice-original.pdf';
      const res = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validInvoicePayload(), sourceFile });

      expect(res.status).toBe(201);
      expect(res.body.data.invoice.sourceFile).toBe(sourceFile);
    });

    it('rejects invoice with no line items', async () => {
      const res = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validInvoicePayload(), lineItems: [] });
      expect(res.status).toBe(422);
    });

    it('rejects invoice with invalid customer', async () => {
      const res = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validInvoicePayload(), customerId: new mongoose.Types.ObjectId().toString() });
      expect(res.status).toBe(404);
    });

    it('rejects due date before issue date', async () => {
      const res = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validInvoicePayload(), issueDate: '2025-02-01', dueDate: '2025-01-01' });
      expect(res.status).toBe(422);
    });

    it('rejects unauthenticated request', async () => {
      const res = await request(app).post('/api/v1/invoices').send(validInvoicePayload());
      expect(res.status).toBe(401);
    });

    it('server recalculates totals ignoring frontend-submitted totals', async () => {
      // Even if frontend sends wrong totals, server recalculates
      const payload = {
        ...validInvoicePayload(),
        // These should be ignored - server calculates from lineItems
        submittedGrandTotal: 999999,
        submittedSubtotal: 1,
      };
      const res = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);
      expect(res.status).toBe(201);
      expect(res.body.data.invoice.grandTotal).toBe(590000); // correct server-calculated value
    });
  });

  describe('GET /api/v1/invoices', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${token}`)
        .send(validInvoicePayload());
    });

    it('returns paginated list of invoices', async () => {
      const res = await request(app)
        .get('/api/v1/invoices')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.data.length).toBe(1);
    });

    it('filters by status', async () => {
      const res = await request(app)
        .get('/api/v1/invoices?status=sent')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0); // invoice is draft, not sent
    });

    it('does not return other users invoices', async () => {
      // Create a second user
      const reg2 = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'User 2', email: 'user2@example.com', password: 'Password1' });
      const token2 = reg2.body.data.token;

      const res = await request(app)
        .get('/api/v1/invoices')
        .set('Authorization', `Bearer ${token2}`);
      expect(res.body.data.length).toBe(0);
    });
  });

  describe('GET /api/v1/invoices/:id', () => {
    let invoiceId;
    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${token}`)
        .send(validInvoicePayload());
      invoiceId = res.body.data.invoice._id;
    });

    it('returns invoice by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.invoice._id).toBe(invoiceId);
    });

    it('returns 404 for non-existent invoice', async () => {
      const res = await request(app)
        .get(`/api/v1/invoices/${new mongoose.Types.ObjectId()}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('prevents cross-user access', async () => {
      const reg2 = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'User 2', email: 'user2@example.com', password: 'Password1' });
      const token2 = reg2.body.data.token;

      const res = await request(app)
        .get(`/api/v1/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${token2}`);
      expect(res.status).toBe(404); // not leaked as 403, appears as not found
    });
  });

  describe('PUT /api/v1/invoices/:id', () => {
    let invoiceId;
    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${token}`)
        .send(validInvoicePayload());
      invoiceId = res.body.data.invoice._id;
    });

    it('updates notes and status', async () => {
      const res = await request(app)
        .put(`/api/v1/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ notes: 'Updated notes', status: 'sent' });
      expect(res.status).toBe(200);
      expect(res.body.data.invoice.notes).toBe('Updated notes');
      expect(res.body.data.invoice.status).toBe('sent');
    });

    it('recalculates totals on line item update', async () => {
      const res = await request(app)
        .put(`/api/v1/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          lineItems: [{ description: 'New Item', quantity: 1, unitPrice: 200, taxRate: 0 }],
        });
      expect(res.status).toBe(200);
      expect(res.body.data.invoice.grandTotal).toBe(20000); // ₹200 = 20000 paise
    });
  });

  describe('DELETE /api/v1/invoices/:id', () => {
    let invoiceId;
    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${token}`)
        .send(validInvoicePayload());
      invoiceId = res.body.data.invoice._id;
    });

    it('deletes a draft invoice', async () => {
      const res = await request(app)
        .delete(`/api/v1/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);

      const check = await request(app)
        .get(`/api/v1/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(check.status).toBe(404);
    });
  });

  describe('Duplicate Invoice Detection', () => {
    it('detects duplicate invoice by customer + amount + date', async () => {
      // Create first invoice
      await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${token}`)
        .send(validInvoicePayload());

      // Check duplicate
      const res = await request(app)
        .get('/api/v1/invoices/check-duplicate')
        .set('Authorization', `Bearer ${token}`)
        .query({ customerId, grandTotal: '5900', issueDate: '2025-01-01' });
      expect(res.status).toBe(200);
      expect(res.body.data.isDuplicate).toBe(true);
    });
  });
});

describe('Payment API', () => {
  let invoiceId;
  let grandTotal;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validInvoicePayload(), status: 'sent' });
    invoiceId = res.body.data.invoice._id;
    grandTotal = res.body.data.invoice.grandTotal;
  });

  it('records a partial payment', async () => {
    const res = await request(app)
      .post(`/api/v1/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 1000, paymentDate: '2025-01-15', paymentMethod: 'upi' });
    expect(res.status).toBe(201);
    expect(res.body.data.payment.amount).toBe(100000); // ₹1000 = 100000 paise
  });

  it('rejects overpayment', async () => {
    const res = await request(app)
      .post(`/api/v1/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 99999, paymentMethod: 'cash' });
    expect(res.status).toBe(422);
  });

  it('marks invoice paid when full amount received', async () => {
    // Pay the full amount in rupees
    const fullAmountRupees = grandTotal / 100;
    await request(app)
      .post(`/api/v1/invoices/${invoiceId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: fullAmountRupees, paymentMethod: 'bank_transfer' });

    const invRes = await request(app)
      .get(`/api/v1/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(invRes.body.data.invoice.status).toBe('paid');
    expect(invRes.body.data.invoice.paidAmount).toBe(grandTotal);
  });
});
