const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { body } = require('express-validator');
const { handleValidationErrors } = require('../validators/authValidators');

router.use(authenticate);

// GET /api/v1/profile
router.get('/', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    return successResponse(res, { user });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v1/profile
router.put(
  '/',
  [
    body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 chars'),
    body('businessName').optional().trim().isLength({ max: 200 }),
    body('phone').optional().trim().isLength({ max: 20 }),
    body('invoicePrefix').optional().trim().isLength({ max: 10 }),
    handleValidationErrors,
  ],
  async (req, res, next) => {
    try {
      const { name, businessName, businessAddress, phone, gstin, invoicePrefix, timezone, currency } = req.body;

      const allowedFields = {};
      if (name !== undefined) allowedFields.name = name;
      if (businessName !== undefined) allowedFields.businessName = businessName;
      if (businessAddress !== undefined) allowedFields.businessAddress = businessAddress;
      if (phone !== undefined) allowedFields.phone = phone;
      if (gstin !== undefined) allowedFields.gstin = gstin || '';
      if (invoicePrefix !== undefined) allowedFields.invoicePrefix = invoicePrefix;
      if (timezone !== undefined) allowedFields.timezone = timezone;
      if (currency !== undefined) allowedFields.currency = currency;

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: allowedFields },
        { new: true, runValidators: true }
      );

      return successResponse(res, { user }, 'Profile updated successfully');
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/v1/profile/password
router.put(
  '/password',
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
      .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
      .matches(/[0-9]/).withMessage('Password must contain a number'),
    handleValidationErrors,
  ],
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;

      const user = await User.findById(req.user._id).select('+password');
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return errorResponse(res, 'Current password is incorrect.', 401);
      }

      user.password = newPassword;
      await user.save();

      return successResponse(res, null, 'Password changed successfully');
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
