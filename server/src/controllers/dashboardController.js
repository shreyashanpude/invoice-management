const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const Payment = require('../models/Payment');
const { successResponse } = require('../utils/apiResponse');

// GET /api/v1/dashboard/summary
const getSummary = async (req, res, next) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const now = new Date();

    // Sync overdue status for invoices that are past due and unpaid
    await Invoice.updateMany(
      {
        user: userId,
        dueDate: { $lt: now },
        paidAmount: 0,
        status: { $nin: ['paid', 'cancelled', 'draft', 'partially_paid'] },
      },
      { $set: { status: 'overdue' } }
    );

    const [stats] = await Invoice.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: null,
          totalInvoiced: { $sum: '$grandTotal' },
          totalPaid:     { $sum: '$paidAmount' },
          totalCount:    { $sum: 1 },
          draftCount: {
            $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] },
          },
          sentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] },
          },
          paidCount: {
            $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] },
          },
          partialCount: {
            $sum: { $cond: [{ $eq: ['$status', 'partially_paid'] }, 1, 0] },
          },
          overdueCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $lt: ['$dueDate', now] },
                    { $eq: ['$paidAmount', 0] },
                    { $ne: ['$status', 'paid'] },
                    { $ne: ['$status', 'cancelled'] },
                    { $ne: ['$status', 'draft'] },
                  ],
                },
                1, 0,
              ],
            },
          },
          overdueAmount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $lt: ['$dueDate', now] },
                    { $lt: ['$paidAmount', '$grandTotal'] },
                    { $ne: ['$status', 'paid'] },
                    { $ne: ['$status', 'cancelled'] },
                    { $ne: ['$status', 'draft'] },
                  ],
                },
                { $subtract: ['$grandTotal', '$paidAmount'] },
                0,
              ],
            },
          },
        },
      },
    ]);

    const summary = stats || {
      totalInvoiced: 0, totalPaid: 0, totalCount: 0,
      draftCount: 0, sentCount: 0, paidCount: 0,
      partialCount: 0, overdueCount: 0, overdueAmount: 0,
    };
    summary.totalUnpaid = (summary.totalInvoiced || 0) - (summary.totalPaid || 0);

    const customerCount = await Customer.countDocuments({ user: userId, isActive: true });
    summary.customerCount = customerCount;

    // Recent invoices
    const recentInvoices = await Invoice.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('customer', 'name email')
      .lean();

    // Upcoming due (next 7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const upcomingDue = await Invoice.find({
      user: userId,
      dueDate: { $gte: now, $lte: sevenDaysFromNow },
      status: { $nin: ['paid', 'cancelled', 'draft'] },
    })
      .sort({ dueDate: 1 })
      .limit(5)
      .populate('customer', 'name email')
      .lean();

    return successResponse(res, { summary, recentInvoices, upcomingDue });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/dashboard/revenue
const getRevenue = async (req, res, next) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);
    const { months = 12 } = req.query;
    const monthsBack = Math.min(24, Math.max(1, parseInt(months)));

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack + 1);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    const monthlyRevenue = await Payment.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          paymentDate: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$paymentDate' },
            month: { $month: '$paymentDate' },
          },
          revenue: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Monthly invoiced
    const monthlyInvoiced = await Invoice.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          issueDate: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$issueDate' },
            month: { $month: '$issueDate' },
          },
          invoiced: { $sum: '$grandTotal' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const months_labels = [];
    const revenueMap = {};
    const invoicedMap = {};

    monthlyRevenue.forEach((r) => {
      const key = `${r._id.year}-${String(r._id.month).padStart(2, '0')}`;
      revenueMap[key] = r.revenue;
    });
    monthlyInvoiced.forEach((r) => {
      const key = `${r._id.year}-${String(r._id.month).padStart(2, '0')}`;
      invoicedMap[key] = r.invoiced;
    });

    const chartData = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
      chartData.push({
        month: label,
        key,
        revenue: revenueMap[key] || 0,
        invoiced: invoicedMap[key] || 0,
      });
    }

    return successResponse(res, { chartData });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/dashboard/invoice-status
const getInvoiceStatus = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const now = new Date();

    const statusData = await Invoice.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      {
        $addFields: {
          computedStatus: {
            $switch: {
              branches: [
                { case: { $eq: ['$status', 'paid'] },       then: 'paid' },
                { case: { $eq: ['$status', 'cancelled'] },  then: 'cancelled' },
                { case: { $eq: ['$status', 'draft'] },      then: 'draft' },
                // partially_paid must come before overdue
                {
                  case: {
                    $and: [
                      { $gt: ['$paidAmount', 0] },
                      { $lt: ['$paidAmount', '$grandTotal'] },
                    ],
                  },
                  then: 'partially_paid',
                },
                {
                  case: {
                    $and: [
                      { $lt: ['$dueDate', now] },
                      { $eq: ['$paidAmount', 0] },
                    ],
                  },
                  then: 'overdue',
                },
              ],
              default: '$status',
            },
          },
        },
      },
      {
        $group: {
          _id: '$computedStatus',
          count: { $sum: 1 },
          total: { $sum: '$grandTotal' },
        },
      },
    ]);

    // Top customers by invoice value
    const topCustomers = await Invoice.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$customer',
          totalAmount: { $sum: '$grandTotal' },
          invoiceCount: { $sum: 1 },
          paidAmount: { $sum: '$paidAmount' },
        },
      },
      { $sort: { totalAmount: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'customers',
          localField: '_id',
          foreignField: '_id',
          as: 'customerInfo',
        },
      },
      { $unwind: { path: '$customerInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: '$customerInfo.name',
          email: '$customerInfo.email',
          totalAmount: 1,
          invoiceCount: 1,
          paidAmount: 1,
          outstandingAmount: { $subtract: ['$totalAmount', '$paidAmount'] },
        },
      },
    ]);

    return successResponse(res, { statusData, topCustomers });
  } catch (error) {
    next(error);
  }
};

module.exports = { getSummary, getRevenue, getInvoiceStatus };
