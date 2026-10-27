/**
 * Invoice calculation utilities.
 * All monetary amounts are stored and computed in paise (integer).
 * 1 INR = 100 paise
 */

/**
 * Round to nearest integer (paise)
 */
const toPaise = (amount) => Math.round(amount);

/**
 * Convert INR (rupees) to paise
 */
const rupeesToPaise = (rupees) => toPaise(parseFloat(rupees || 0) * 100);

/**
 * Convert paise to INR rupees
 */
const paiseToRupees = (paise) => (paise || 0) / 100;

/**
 * Format paise value as INR currency string
 */
const formatCurrency = (paise) => {
  const rupees = paiseToRupees(paise);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(rupees);
};

/**
 * Calculate line item totals
 * @param {Object} item - Line item from request
 * @returns {Object} - Calculated line item with amounts in paise
 */
const calculateLineItem = (item) => {
  const quantity = parseFloat(item.quantity) || 0;
  const unitPrice = rupeesToPaise(item.unitPrice); // input in rupees
  const taxRate = parseFloat(item.taxRate) || 0;

  const amount = toPaise(quantity * unitPrice); // pre-tax amount
  const taxAmount = toPaise(amount * (taxRate / 100));

  return {
    description: item.description,
    quantity,
    unitPrice,
    taxRate,
    taxAmount,
    amount,
    hsnCode: item.hsnCode || '',
  };
};

/**
 * Calculate full invoice totals server-side
 * @param {Array} lineItems - Array of line item objects (unitPrice in rupees from frontend)
 * @param {Object} discountConfig - { type: 'percentage'|'fixed', value: number }
 * @returns {Object} - All calculated totals in paise
 */
const calculateInvoiceTotals = (lineItems, discountConfig = {}) => {
  if (!lineItems || lineItems.length === 0) {
    throw new Error('Invoice must have at least one line item');
  }

  const calculatedItems = lineItems.map(calculateLineItem);

  const subtotal = calculatedItems.reduce((sum, item) => sum + item.amount, 0);
  const taxTotal = calculatedItems.reduce((sum, item) => sum + item.taxAmount, 0);

  const discountType = discountConfig.type || 'percentage';
  const discountValue = parseFloat(discountConfig.value) || 0;

  let discountAmount = 0;
  if (discountType === 'percentage') {
    if (discountValue < 0 || discountValue > 100) {
      throw new Error('Discount percentage must be between 0 and 100');
    }
    discountAmount = toPaise(subtotal * (discountValue / 100));
  } else if (discountType === 'fixed') {
    discountAmount = rupeesToPaise(discountValue);
    if (discountAmount < 0) throw new Error('Discount amount cannot be negative');
    if (discountAmount > subtotal + taxTotal) {
      throw new Error('Discount cannot exceed the invoice total');
    }
  }

  const grandTotal = subtotal + taxTotal - discountAmount;

  if (grandTotal < 0) {
    throw new Error('Grand total cannot be negative');
  }

  return {
    lineItems: calculatedItems,
    subtotal,
    taxTotal,
    discountAmount,
    grandTotal,
  };
};

/**
 * Validate that line items have required fields
 */
const validateLineItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return { valid: false, error: 'At least one line item is required' };
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.description || !item.description.trim()) {
      return { valid: false, error: `Line item ${i + 1}: description is required` };
    }
    if (item.quantity === undefined || item.quantity === null || item.quantity <= 0) {
      return { valid: false, error: `Line item ${i + 1}: quantity must be positive` };
    }
    if (item.unitPrice === undefined || item.unitPrice === null || parseFloat(item.unitPrice) < 0) {
      return { valid: false, error: `Line item ${i + 1}: unit price must be non-negative` };
    }
  }

  return { valid: true };
};

module.exports = {
  toPaise,
  rupeesToPaise,
  paiseToRupees,
  formatCurrency,
  calculateLineItem,
  calculateInvoiceTotals,
  validateLineItems,
};
