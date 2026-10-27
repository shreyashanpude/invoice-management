/**
 * Demo data seed script.
 * Usage: node src/utils/seed.js
 * WARNING: This creates a demo account. Do NOT run in production with real data.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');

const DEMO_EMAIL = 'demo@invoice.app';
const DEMO_PASSWORD = 'Demo@12345';

const customers = [
  { name: 'Acme Technologies Pvt Ltd', email: 'billing@acme.com', phone: '9876543210', gstin: '' },
  { name: 'Sunrise Retail Corp', email: 'accounts@sunrise.com', phone: '9123456780', gstin: '' },
  { name: 'Global Pharma Ltd', email: 'finance@globalpharma.in', phone: '8765432190', gstin: '' },
  { name: 'InnoSoft Solutions', email: 'pay@innosoft.io', phone: '7654321098', gstin: '' },
  { name: 'Metro Builders', email: 'billing@metrobuilders.com', phone: '6543210987', gstin: '' },
];

const statusPool = ['paid', 'sent', 'overdue', 'partially_paid', 'draft'];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function seed() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.\n');

    // Remove existing demo data
    const existingUser = await User.findOne({ email: DEMO_EMAIL });
    if (existingUser) {
      await Invoice.deleteMany({ user: existingUser._id });
      await Payment.deleteMany({ user: existingUser._id });
      await Customer.deleteMany({ user: existingUser._id });
      await User.deleteOne({ _id: existingUser._id });
      console.log('Removed existing demo data.');
    }

    // Create demo user
    const user = await User.create({
      name: 'Demo User',
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      businessName: 'Demo Business Solutions',
      businessAddress: '123 Demo Street, Mumbai, Maharashtra 400001',
      phone: '9000000000',
      invoicePrefix: 'DEMO',
      invoiceCounter: 1,
    });
    console.log(`✅ Demo user created: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);

    // Create customers
    const createdCustomers = await Customer.insertMany(
      customers.map((c) => ({ ...c, user: user._id }))
    );
    console.log(`✅ ${createdCustomers.length} customers created`);

    // Create invoices across past 6 months
    let invoiceCounter = 1;
    const invoiceDocs = [];
    const paymentDocs = [];

    for (let i = 0; i < 20; i++) {
      const customer = createdCustomers[i % createdCustomers.length];
      const issueDate = daysAgo(randomInt(5, 180));
      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + randomInt(15, 45));

      const numItems = randomInt(1, 4);
      const lineItems = [];
      for (let j = 0; j < numItems; j++) {
        const qty = randomInt(1, 10);
        const unitPrice = randomInt(500, 50000) * 100; // paise
        const taxRate = [0, 5, 12, 18][randomInt(0, 3)];
        const amount = qty * unitPrice;
        const taxAmount = Math.round(amount * (taxRate / 100));
        lineItems.push({
          description: `Service Item ${j + 1}`,
          quantity: qty,
          unitPrice,
          taxRate,
          taxAmount,
          amount,
          hsnCode: '',
        });
      }

      const subtotal = lineItems.reduce((s, it) => s + it.amount, 0);
      const taxTotal = lineItems.reduce((s, it) => s + it.taxAmount, 0);
      const grandTotal = subtotal + taxTotal;

      const statusIndex = i % statusPool.length;
      let status = statusPool[statusIndex];
      let paidAmount = 0;

      if (status === 'paid') {
        paidAmount = grandTotal;
      } else if (status === 'partially_paid') {
        paidAmount = Math.round(grandTotal * 0.5);
      } else if (status === 'overdue') {
        dueDate.setDate(dueDate.getDate() - 30); // force past due
      }

      // Recompute status based on date
      if (!['paid', 'draft', 'cancelled'].includes(status)) {
        if (dueDate < new Date() && paidAmount < grandTotal) status = 'overdue';
      }

      const invoiceNumber = `DEMO-${String(invoiceCounter).padStart(4, '0')}`;
      invoiceCounter++;

      const billingAddress = `${customer.billingAddress?.street || ''}, ${customer.billingAddress?.city || ''}`.trim();

      invoiceDocs.push({
        user: user._id,
        invoiceNumber,
        customer: customer._id,
        customerSnapshot: {
          name: customer.name,
          email: customer.email,
          phone: customer.phone || '',
          address: billingAddress,
          gstin: customer.gstin || '',
        },
        status,
        issueDate,
        dueDate,
        lineItems,
        subtotal,
        discountType: 'percentage',
        discountValue: 0,
        discountAmount: 0,
        taxTotal,
        grandTotal,
        paidAmount,
        currency: 'INR',
        notes: '',
        terms: 'Payment due within 30 days.',
        ...(status === 'paid' ? { paidAt: dueDate } : {}),
      });
    }

    const createdInvoices = await Invoice.insertMany(invoiceDocs);
    console.log(`✅ ${createdInvoices.length} invoices created`);

    // Create payments for paid/partially_paid invoices
    for (const inv of createdInvoices) {
      if (inv.paidAmount > 0) {
        paymentDocs.push({
          user: user._id,
          invoice: inv._id,
          customer: inv.customer,
          amount: inv.paidAmount,
          paymentDate: inv.paidAt || inv.dueDate,
          paymentMethod: ['bank_transfer', 'upi', 'cheque'][randomInt(0, 2)],
          referenceNumber: `REF-${randomInt(10000, 99999)}`,
        });

        // Update customer totals
        await Customer.findByIdAndUpdate(inv.customer, {
          $inc: { totalInvoiced: inv.grandTotal, totalPaid: inv.paidAmount },
        });
      } else {
        await Customer.findByIdAndUpdate(inv.customer, {
          $inc: { totalInvoiced: inv.grandTotal },
        });
      }
    }

    if (paymentDocs.length > 0) {
      await Payment.insertMany(paymentDocs);
      console.log(`✅ ${paymentDocs.length} payment records created`);
    }

    // Update user invoice counter
    await User.findByIdAndUpdate(user._id, { invoiceCounter });

    console.log('\n🎉 Seed complete!');
    console.log(`\n📧 Login: ${DEMO_EMAIL}`);
    console.log(`🔑 Password: ${DEMO_PASSWORD}\n`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
}

seed();
