const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [200, 'Name cannot exceed 200 characters'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    billingAddress: {
      street: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: '' },
      state: { type: String, trim: true, default: '' },
      postalCode: { type: String, trim: true, default: '' },
      country: { type: String, trim: true, default: 'India' },
    },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },
    panNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Computed stats - updated via aggregation or hooks
    totalInvoiced: {
      type: Number,
      default: 0, // stored in paise
    },
    totalPaid: {
      type: Number,
      default: 0, // stored in paise
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

customerSchema.virtual('outstandingBalance').get(function () {
  return this.totalInvoiced - this.totalPaid;
});

customerSchema.index({ user: 1, name: 1 });
customerSchema.index({ user: 1, email: 1 });

const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;
