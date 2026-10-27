const { body, param } = require('express-validator');
const { handleValidationErrors } = require('./authValidators');

const createCustomerValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Customer name is required')
    .isLength({ min: 2, max: 200 }).withMessage('Name must be 2–200 characters'),
  body('email')
    .optional({ checkFalsy: true })
    .trim()
    .isEmail().withMessage('Please enter a valid email address'),
  body('phone')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 20 }).withMessage('Phone cannot exceed 20 characters'),
  body('gstin')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
    .withMessage('Invalid GSTIN format (e.g. 22AAAAA0000A1Z5)'),
  handleValidationErrors,
];

const updateCustomerValidation = [
  param('id').isMongoId().withMessage('Invalid customer ID'),
  body('name')
    .optional()
    .trim()
    .notEmpty().withMessage('Name cannot be empty')
    .isLength({ min: 2, max: 200 }).withMessage('Name must be 2–200 characters'),
  body('email')
    .optional({ checkFalsy: true })
    .trim()
    .isEmail().withMessage('Please enter a valid email address'),
  body('gstin')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
    .withMessage('Invalid GSTIN format'),
  handleValidationErrors,
];

module.exports = { createCustomerValidation, updateCustomerValidation };
