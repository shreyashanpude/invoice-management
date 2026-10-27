const express = require('express');
const router = express.Router();
const {
  getInvoices,
  createInvoice,
  getInvoice,
  updateInvoice,
  deleteInvoice,
  addPayment,
  getPayments,
  checkDuplicate,
} = require('../controllers/invoiceController');
const {
  createInvoiceValidation,
  updateInvoiceValidation,
  addPaymentValidation,
} = require('../validators/invoiceValidators');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/check-duplicate', checkDuplicate);
router.get('/', getInvoices);
router.post('/', createInvoiceValidation, createInvoice);
router.get('/:id', getInvoice);
router.put('/:id', updateInvoiceValidation, updateInvoice);
router.delete('/:id', deleteInvoice);
router.post('/:id/payments', addPaymentValidation, addPayment);
router.get('/:id/payments', getPayments);

module.exports = router;
