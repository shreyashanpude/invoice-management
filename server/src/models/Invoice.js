const mongoose = require('mongoose');

// All monetary values stored as integers in paise (1 INR = 100 paise)
// to avoid floating-point precision issues

const lineItemSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: [true, 'Item description is required'],
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0.001, 'Quantity must be positive'],
    },
    unitPrice: {
      type: Number, // paise
      required: [true, 'Unit price is required'],
      min: [0, 'Unit price cannot be negative'],
    },
    taxRate: {
      type: Number, // percentage (e.g., 18 for 18%)
      default: 0,
      min: [0, 'Tax rate cannot be negative'],
      max: [100, 'Tax rate cannot exceed 100%'],
    },
    taxAmount: {
      type: Number, // paise - calculated on backend
      default: 0,
    },
    amount: {
      type: Number, // paise - quantity * unitPrice (before tax)
      required: true,
    },
    hsnCode: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: true }
);

const invoiceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    invoiceNumber: {
      type: String,
      required: [true, 'Invoice number is required'],
      trim: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer is required'],
    },
    // Snapshot of customer info at time of invoice creation
    customerSnapshot: {
      name: String,
      email: String,
      phone: String,
      address: String,
      gstin: String,
    },
    status: {
      type: String,
      enum: ['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled'],
      default: 'draft',
    },
    issueDate: {
      type: Date,
      required: [true, 'Issue date is required'],
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },
    lineItems: {
      type: [lineItemSchema],
      validate: {
        validator: function (items) {
          return items && items.length > 0;
        },
        message: 'Invoice must have at least one line item',
      },
    },
    subtotal: {
      type: Number, // paise
      required: true,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'percentage',
    },
    discountValue: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
    },
    discountAmount: {
      type: Number, // paise - calculated
      default: 0,
    },
    taxTotal: {
      type: Number, // paise - sum of all line item taxes
      default: 0,
    },
    grandTotal: {
      type: Number, // paise
      required: true,
    },
    paidAmount: {
      type: Number, // paise
      default: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [2000, 'Notes cannot exceed 2000 characters'],
      default: '',
    },
    terms: {
      type: String,
      trim: true,
      maxlength: [2000, 'Terms cannot exceed 2000 characters'],
      default: '',
    },
    // AI extraction metadata
    aiExtracted: {
      type: Boolean,
      default: false,
    },
    aiConfidence: {
      type: Number,
      default: null,
    },
    sourceFile: {
      type: String,
      default: '',
    },
    // Duplicate detection flag
    duplicateWarning: {
      type: Boolean,
      default: false,
    },
    sentAt: {
      type: Date,
    },
    paidAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
      virtuals: true,
    },
    toObject: { virtuals: true },
  }
);

// Virtual: outstanding balance in paise
invoiceSchema.virtual('outstandingBalance').get(function () {
  return this.grandTotal - this.paidAmount;
});

// Virtual: is overdue based on date and balance
invoiceSchema.virtual('isOverdue').get(function () {
  const now = new Date();
  return (
    this.dueDate < now &&
    this.paidAmount < this.grandTotal &&
    !['paid', 'cancelled', 'draft'].includes(this.status)
  );
});

// Compound unique index: invoice number per user
invoiceSchema.index({ user: 1, invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ user: 1, customer: 1 });
invoiceSchema.index({ user: 1, status: 1 });
invoiceSchema.index({ user: 1, dueDate: 1 });
invoiceSchema.index({ user: 1, issueDate: -1 });

// Auto-compute effective status considering overdue
invoiceSchema.methods.computeStatus = function () {
  if (['paid', 'cancelled', 'draft'].includes(this.status)) return this.status;
  const now = new Date();
  if (this.paidAmount >= this.grandTotal) return 'paid';
  if (this.dueDate < now && this.paidAmount < this.grandTotal) return 'overdue';
  if (this.paidAmount > 0 && this.paidAmount < this.grandTotal) return 'partially_paid';
  return this.status;
};

const Invoice = mongoose.model('Invoice', invoiceSchema);

module.exports = Invoice;
