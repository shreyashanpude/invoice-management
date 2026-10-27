const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const Payment = require('../models/Payment');
const User = require('../models/User');
const { calculateInvoiceTotals, validateLineItems, rupeesToPaise } = require('../utils/invoiceCalculations');
const { withTransaction } = require('../utils/dbTransaction');
const {
  successResponse, createdResponse, errorResponse, paginatedResponse, buildPagination,
} = require('../utils/apiResponse');

// ─── GET /api/v1/invoices ────────────────────────────────────────────────────
const getInvoices = async (req, res, next) => {
  try {
    const {
      page = 1, limit = 10, search = '', status = '',
      customerId = '', dateFrom = '', dateTo = '',
      sortBy = 'createdAt', sortOrder = 'desc',
    } = req.query;

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip     = (pageNum - 1) * limitNum;

    const filter = { user: req.user._id };
    if (search) {
      filter.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { 'customerSnapshot.name': { $regex: search, $options: 'i' } },
      ];
    }
    if (status) filter.status = status;
    if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
      filter.customer = new mongoose.Types.ObjectId(customerId);
    }
    if (dateFrom || dateTo) {
      filter.issueDate = {};
      if (dateFrom) filter.issueDate.$gte = new Date(dateFrom);
      if (dateTo)   filter.issueDate.$lte = new Date(dateTo);
    }

    const allowed = ['invoiceNumber','issueDate','dueDate','grandTotal','status','createdAt'];
    const sortField = allowed.includes(sortBy) ? sortBy : 'createdAt';
    const sortDir   = sortOrder === 'asc' ? 1 : -1;

    const [invoices, total] = await Promise.all([
      Invoice.find(filter).sort({ [sortField]: sortDir }).skip(skip).limit(limitNum)
        .populate('customer', 'name email').lean(),
      Invoice.countDocuments(filter),
    ]);

    const now = new Date();
    const enriched = invoices.map((inv) => {
      let s = inv.status;
      if (!['paid','cancelled','draft'].includes(s)) {
        if (inv.paidAmount >= inv.grandTotal)  s = 'paid';
        // partially_paid takes priority over overdue — a part-paid invoice is
        // not "overdue" in the same sense even if the due date passed
        else if (inv.paidAmount > 0 && inv.paidAmount < inv.grandTotal) s = 'partially_paid';
        else if (inv.dueDate < now && inv.paidAmount === 0)             s = 'overdue';
      }
      return { ...inv, status: s, outstandingBalance: inv.grandTotal - inv.paidAmount };
    });

    return paginatedResponse(res, enriched, buildPagination(pageNum, limitNum, total));
  } catch (err) { next(err); }
};

// ─── POST /api/v1/invoices ───────────────────────────────────────────────────
const createInvoice = async (req, res, next) => {
  try {
    const {
      customerId, issueDate, dueDate, lineItems,
      discountType, discountValue, notes, terms, status, sourceFile,
    } = req.body;

    // 1. Validate customer ownership (no session needed)
    const customer = await Customer.findOne({ _id: customerId, user: req.user._id });
    if (!customer) return errorResponse(res, 'Customer not found or does not belong to your account.', 404);

    // 2. Validate line items
    const validation = validateLineItems(lineItems);
    if (!validation.valid) return errorResponse(res, validation.error, 422);

    // 3. Server-side calculation
    let totals;
    try {
      totals = calculateInvoiceTotals(lineItems, { type: discountType, value: discountValue });
    } catch (e) { return errorResponse(res, e.message, 422); }

    // 4. Generate invoice number atomically
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id, { $inc: { invoiceCounter: 1 } }, { new: false }
    );
    const invoiceNumber = updatedUser.getNextInvoiceNumber();

    // 5. Duplicate check
    const existing = await Invoice.findOne({ user: req.user._id, invoiceNumber });
    if (existing) return errorResponse(res, `Invoice number ${invoiceNumber} already exists.`, 409);

    const billingAddress = [
      customer.billingAddress?.street, customer.billingAddress?.city,
      customer.billingAddress?.state,  customer.billingAddress?.postalCode,
    ].filter(Boolean).join(', ');

    // 6. Create invoice
    const invoice = await Invoice.create({
      user: req.user._id,
      invoiceNumber,
      customer: customer._id,
      customerSnapshot: {
        name: customer.name, email: customer.email,
        phone: customer.phone, address: billingAddress, gstin: customer.gstin,
      },
      status: status || 'draft',
      issueDate: new Date(issueDate),
      dueDate:   new Date(dueDate),
      lineItems:      totals.lineItems,
      subtotal:       totals.subtotal,
      discountType:   discountType || 'percentage',
      discountValue:  parseFloat(discountValue) || 0,
      discountAmount: totals.discountAmount,
      taxTotal:       totals.taxTotal,
      grandTotal:     totals.grandTotal,
      paidAmount: 0,
      currency: req.user.currency || 'INR',
      notes:  notes  || '',
      terms:  terms  || '',
      sourceFile: sourceFile || '',
    });

    // 7. Update customer totalInvoiced (best-effort, non-blocking)
    await Customer.findByIdAndUpdate(customer._id, { $inc: { totalInvoiced: totals.grandTotal } });

    const populated = await Invoice.findById(invoice._id).populate('customer', 'name email phone');
    return createdResponse(res, { invoice: populated }, 'Invoice created successfully');
  } catch (err) { next(err); }
};

// ─── GET /api/v1/invoices/:id ────────────────────────────────────────────────
const getInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user._id })
      .populate('customer', 'name email phone billingAddress gstin').lean();
    if (!invoice) return errorResponse(res, 'Invoice not found.', 404);

    const now = new Date();
    let s = invoice.status;
    if (!['paid','cancelled','draft'].includes(s)) {
      if (invoice.paidAmount >= invoice.grandTotal)                                 s = 'paid';
      else if (invoice.paidAmount > 0 && invoice.paidAmount < invoice.grandTotal)  s = 'partially_paid';
      else if (invoice.dueDate < now && invoice.paidAmount === 0)                  s = 'overdue';
    }

    const payments = await Payment.find({ invoice: invoice._id, user: req.user._id })
      .sort({ paymentDate: -1 });

    return successResponse(res, {
      invoice: { ...invoice, status: s, outstandingBalance: invoice.grandTotal - invoice.paidAmount },
      payments,
    });
  } catch (err) { next(err); }
};

// ─── PUT /api/v1/invoices/:id ────────────────────────────────────────────────
const updateInvoice = async (req, res, next) => {
  try {
    const existing = await Invoice.findOne({ _id: req.params.id, user: req.user._id });
    if (!existing) return errorResponse(res, 'Invoice not found.', 404);
    if (existing.status === 'paid') return errorResponse(res, 'Cannot edit a fully paid invoice.', 400);

    const { customerId, issueDate, dueDate, lineItems, discountType, discountValue, notes, terms, status } = req.body;

    let customer = null;
    if (customerId) {
      customer = await Customer.findOne({ _id: customerId, user: req.user._id });
      if (!customer) return errorResponse(res, 'Customer not found.', 404);
    }

    const updateData = {
      notes:  notes  !== undefined ? notes  : existing.notes,
      terms:  terms  !== undefined ? terms  : existing.terms,
      status: status || existing.status,
    };
    if (issueDate) updateData.issueDate = new Date(issueDate);
    if (dueDate)   updateData.dueDate   = new Date(dueDate);

    if (lineItems) {
      const validation = validateLineItems(lineItems);
      if (!validation.valid) return errorResponse(res, validation.error, 422);

      let totals;
      try {
        totals = calculateInvoiceTotals(lineItems, { type: discountType, value: discountValue });
      } catch (e) { return errorResponse(res, e.message, 422); }

      const diff = totals.grandTotal - existing.grandTotal;
      if (diff !== 0) {
        await Customer.findByIdAndUpdate(existing.customer, { $inc: { totalInvoiced: diff } });
      }

      Object.assign(updateData, {
        lineItems:      totals.lineItems,
        subtotal:       totals.subtotal,
        discountType:   discountType || 'percentage',
        discountValue:  parseFloat(discountValue) || 0,
        discountAmount: totals.discountAmount,
        taxTotal:       totals.taxTotal,
        grandTotal:     totals.grandTotal,
      });
    }

    if (customer) {
      const addr = [
        customer.billingAddress?.street, customer.billingAddress?.city,
        customer.billingAddress?.state,  customer.billingAddress?.postalCode,
      ].filter(Boolean).join(', ');
      updateData.customer = customer._id;
      updateData.customerSnapshot = {
        name: customer.name, email: customer.email,
        phone: customer.phone, address: addr, gstin: customer.gstin,
      };
    }

    const updated = await Invoice.findByIdAndUpdate(req.params.id, updateData, {
      new: true, runValidators: true,
    }).populate('customer', 'name email phone');

    return successResponse(res, { invoice: updated }, 'Invoice updated successfully');
  } catch (err) { next(err); }
};

// ─── DELETE /api/v1/invoices/:id ─────────────────────────────────────────────
const deleteInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user._id });
    if (!invoice) return errorResponse(res, 'Invoice not found.', 404);
    if (invoice.status === 'paid') return errorResponse(res, 'Cannot delete a paid invoice. Cancel it instead.', 400);

    await Customer.findByIdAndUpdate(invoice.customer, {
      $inc: { totalInvoiced: -invoice.grandTotal, totalPaid: -invoice.paidAmount },
    });
    await Payment.deleteMany({ invoice: invoice._id });
    await Invoice.deleteOne({ _id: invoice._id });

    return successResponse(res, null, 'Invoice deleted successfully');
  } catch (err) { next(err); }
};

// ─── POST /api/v1/invoices/:id/payments ──────────────────────────────────────
const addPayment = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user._id });
    if (!invoice)              return errorResponse(res, 'Invoice not found.', 404);
    if (invoice.status === 'paid') return errorResponse(res, 'Invoice is already fully paid.', 400);

    const { amount, paymentDate, paymentMethod, referenceNumber, notes } = req.body;
    const amountInPaise = rupeesToPaise(amount);
    const outstanding   = invoice.grandTotal - invoice.paidAmount;

    if (amountInPaise <= 0) return errorResponse(res, 'Payment amount must be positive.', 422);
    if (amountInPaise > outstanding) {
      return errorResponse(
        res,
        `Payment (₹${amount}) exceeds outstanding balance (₹${(outstanding / 100).toFixed(2)}).`,
        422
      );
    }

    const payment = await Payment.create({
      user: req.user._id,
      invoice: invoice._id,
      customer: invoice.customer,
      amount: amountInPaise,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      paymentMethod: paymentMethod || 'bank_transfer',
      referenceNumber: referenceNumber || '',
      notes: notes || '',
    });

    const newPaidAmount = invoice.paidAmount + amountInPaise;
    let newStatus = invoice.status;
    if (newPaidAmount >= invoice.grandTotal)  newStatus = 'paid';
    else if (newPaidAmount > 0)               newStatus = 'partially_paid';

    await Invoice.findByIdAndUpdate(invoice._id, {
      $inc: { paidAmount: amountInPaise },
      status: newStatus,
      ...(newStatus === 'paid' ? { paidAt: new Date() } : {}),
    });
    await Customer.findByIdAndUpdate(invoice.customer, { $inc: { totalPaid: amountInPaise } });

    return createdResponse(res, { payment }, 'Payment recorded successfully');
  } catch (err) { next(err); }
};

// ─── GET /api/v1/invoices/:id/payments ───────────────────────────────────────
const getPayments = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, user: req.user._id });
    if (!invoice) return errorResponse(res, 'Invoice not found.', 404);

    const payments = await Payment.find({ invoice: invoice._id, user: req.user._id })
      .sort({ paymentDate: -1 });
    return successResponse(res, { payments });
  } catch (err) { next(err); }
};

// ─── GET /api/v1/invoices/check-duplicate ────────────────────────────────────
const checkDuplicate = async (req, res, next) => {
  try {
    const { invoiceNumber, customerId, grandTotal, issueDate } = req.query;
    const filter = { user: req.user._id };
    const orConditions = [];

    if (invoiceNumber) {
      orConditions.push({ invoiceNumber: { $regex: `^${invoiceNumber}$`, $options: 'i' } });
    }
    if (customerId && grandTotal && issueDate) {
      const amount = rupeesToPaise(grandTotal);
      const date   = new Date(issueDate);
      const start  = new Date(date); start.setDate(start.getDate() - 3);
      const end    = new Date(date); end.setDate(end.getDate() + 3);
      orConditions.push({
        customer: customerId, grandTotal: amount,
        issueDate: { $gte: start, $lte: end },
      });
    }
    if (orConditions.length === 0) return successResponse(res, { isDuplicate: false, duplicates: [] });

    filter.$or = orConditions;
    if (req.query.excludeId) filter._id = { $ne: req.query.excludeId };

    const duplicates = await Invoice.find(filter)
      .select('invoiceNumber issueDate grandTotal status customerSnapshot').limit(5).lean();

    return successResponse(res, { isDuplicate: duplicates.length > 0, duplicates });
  } catch (err) { next(err); }
};

module.exports = {
  getInvoices, createInvoice, getInvoice, updateInvoice,
  deleteInvoice, addPayment, getPayments, checkDuplicate,
};
