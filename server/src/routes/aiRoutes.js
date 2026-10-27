const express = require('express');
const router = express.Router();
const { extractInvoice, getFinancialInsights, generatePaymentReminder } = require('../controllers/aiController');
const { authenticate } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const rateLimit = require('express-rate-limit');

const aiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 200
     : (parseInt(process.env.AI_RATE_LIMIT_MAX) || 20),
  message: { success: false, message: 'Too many AI requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(authenticate);

router.post('/extract-invoice', aiLimiter, upload.single('invoice'), extractInvoice);
router.post('/financial-insights', aiLimiter, getFinancialInsights);
router.post('/payment-reminders', aiLimiter, generatePaymentReminder);

module.exports = router;
