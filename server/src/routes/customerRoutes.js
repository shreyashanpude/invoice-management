const express = require('express');
const router = express.Router();
const {
  getCustomers,
  createCustomer,
  getCustomer,
  updateCustomer,
  deleteCustomer,
} = require('../controllers/customerController');
const {
  createCustomerValidation,
  updateCustomerValidation,
} = require('../validators/customerValidators');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', getCustomers);
router.post('/', createCustomerValidation, createCustomer);
router.get('/:id', getCustomer);
router.put('/:id', updateCustomerValidation, updateCustomer);
router.delete('/:id', deleteCustomer);

module.exports = router;
