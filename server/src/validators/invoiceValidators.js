const { body, param, query } = require('express-validator');
const { handleValidationErrors } = require('./authValidators');

const createInvoiceValidation = [
  body('customerId')
    .notEmpty().withMessage('Customer is required')
    .isMongoId().withMessage('Invalid customer ID'),
  body('issueDate')
    .notEmpty().withMessage('Issue date is required')
    .isISO8601().withMessage('Invalid issue date format'),
  body('dueDate')
    .notEmpty().withMessage('Due date is required')
    .isISO8601().withMessage('Invalid due date format')
    .custom((dueDate, { req }) => {
      if (new Date(dueDate) < new Date(req.body.issueDate)) {
        throw new Error('Due date cannot be before issue date');
      }
      return true;
    }),
  body('lineItems')
    .isArray({ min: 1 }).withMessage('At least one line item is required'),
  body('lineItems.*.description')
    .trim()
    .notEmpty().withMessage('Line item description is required')
    .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
  body('lineItems.*.quantity')
    .isFloat({ min: 0.001 }).withMessage('Quantity must be a positive number'),
  body('lineItems.*.unitPrice')
    .isFloat({ min: 0 }).withMessage('Unit price must be non-negative'),
  body('lineItems.*.taxRate')
    .optional()
    .isFloat({ min: 0, max: 100 }).withMessage('Tax rate must be between 0 and 100'),
  body('discountType')
    .optional()
    .isIn(['percentage', 'fixed']).withMessage('Discount type must be percentage or fixed'),
  body('discountValue')
    .optional()
    .isFloat({ min: 0 }).withMessage('Discount value must be non-negative'),
  body('status')
    .optional()
    .isIn(['draft', 'sent', 'cancelled']).withMessage('Invalid status for new invoice'),
  handleValidationErrors,
];

const updateInvoiceValidation = [
  param('id').isMongoId().withMessage('Invalid invoice ID'),
  body('dueDate')
    .optional()
    .isISO8601().withMessage('Invalid due date format'),
  body('lineItems')
    .optional()
    .isArray({ min: 1 }).withMessage('At least one line item is required'),
  body('lineItems.*.description')
    .optional()
    .trim()
    .notEmpty().withMessage('Line item description is required'),
  body('lineItems.*.quantity')
    .optional()
    .isFloat({ min: 0.001 }).withMessage('Quantity must be a positive number'),
  body('lineItems.*.unitPrice')
    .optional()
    .isFloat({ min: 0 }).withMessage('Unit price must be non-negative'),
  body('status')
    .optional()
    .isIn(['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled'])
    .withMessage('Invalid status'),
  handleValidationErrors,
];

const addPaymentValidation = [
  param('id').isMongoId().withMessage('Invalid invoice ID'),
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
  body('paymentDate')
    .optional()
    .isISO8601().withMessage('Invalid payment date'),
  body('paymentMethod')
    .optional()
    .isIn(['cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other'])
    .withMessage('Invalid payment method'),
  handleValidationErrors,
];

module.exports = {
  createInvoiceValidation,
  updateInvoiceValidation,
  addPaymentValidation,
};
