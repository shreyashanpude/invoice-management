const express = require('express');
const router = express.Router();
const { getSummary, getRevenue, getInvoiceStatus } = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/summary', getSummary);
router.get('/revenue', getRevenue);
router.get('/invoice-status', getInvoiceStatus);

module.exports = router;
