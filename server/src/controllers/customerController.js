const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const {
  successResponse,
  createdResponse,
  errorResponse,
  paginatedResponse,
  buildPagination,
} = require('../utils/apiResponse');

// GET /api/v1/customers
const getCustomers = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const filter = { user: req.user._id, isActive: true };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { gstin: { $regex: search, $options: 'i' } },
      ];
    }

    const sortDir = sortOrder === 'asc' ? 1 : -1;
    const allowedSortFields = ['name', 'email', 'createdAt', 'totalInvoiced'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const [customers, total] = await Promise.all([
      Customer.find(filter)
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Customer.countDocuments(filter),
    ]);

    // Add virtual outstanding balance
    const enriched = customers.map((c) => ({
      ...c,
      outstandingBalance: (c.totalInvoiced || 0) - (c.totalPaid || 0),
    }));

    return paginatedResponse(res, enriched, buildPagination(pageNum, limitNum, total));
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/customers
const createCustomer = async (req, res, next) => {
  try {
    const { name, email, phone, billingAddress, gstin, panNumber, notes } = req.body;

    const customer = await Customer.create({
      user: req.user._id,
      name,
      email: email || '',
      phone: phone || '',
      billingAddress: billingAddress || {},
      gstin: gstin || '',
      panNumber: panNumber || '',
      notes: notes || '',
    });

    return createdResponse(res, { customer }, 'Customer created successfully');
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/customers/:id
const getCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findOne({
      _id: req.params.id,
      user: req.user._id,
      isActive: true,
    });

    if (!customer) {
      return errorResponse(res, 'Customer not found.', 404);
    }

    // Fetch customer invoices
    const invoices = await Invoice.find({
      user: req.user._id,
      customer: customer._id,
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('invoiceNumber status issueDate dueDate grandTotal paidAmount currency')
      .lean();

    const invoicesWithBalance = invoices.map((inv) => ({
      ...inv,
      outstandingBalance: inv.grandTotal - inv.paidAmount,
    }));

    return successResponse(res, {
      customer: {
        ...customer.toObject(),
        outstandingBalance: customer.totalInvoiced - customer.totalPaid,
      },
      invoices: invoicesWithBalance,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/customers/:id
const updateCustomer = async (req, res, next) => {
  try {
    const { name, email, phone, billingAddress, gstin, panNumber, notes } = req.body;

    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id, isActive: true },
      {
        $set: {
          name,
          email: email || '',
          phone: phone || '',
          billingAddress: billingAddress || {},
          gstin: gstin || '',
          panNumber: panNumber || '',
          notes: notes || '',
        },
      },
      { new: true, runValidators: true }
    );

    if (!customer) {
      return errorResponse(res, 'Customer not found.', 404);
    }

    return successResponse(res, { customer }, 'Customer updated successfully');
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/customers/:id
const deleteCustomer = async (req, res, next) => {
  try {
    // Check for associated invoices
    const invoiceCount = await Invoice.countDocuments({
      user: req.user._id,
      customer: req.params.id,
    });

    if (invoiceCount > 0) {
      // Soft delete if has invoices
      await Customer.findOneAndUpdate(
        { _id: req.params.id, user: req.user._id },
        { isActive: false }
      );
      return successResponse(
        res,
        null,
        `Customer deactivated. ${invoiceCount} associated invoice(s) are preserved.`
      );
    }

    const customer = await Customer.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!customer) {
      return errorResponse(res, 'Customer not found.', 404);
    }

    return successResponse(res, null, 'Customer deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCustomers,
  createCustomer,
  getCustomer,
  updateCustomer,
  deleteCustomer,
};
