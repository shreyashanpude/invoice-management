const {
  toPaise,
  rupeesToPaise,
  paiseToRupees,
  calculateLineItem,
  calculateInvoiceTotals,
  validateLineItems,
} = require('../utils/invoiceCalculations');

describe('Invoice Calculation Utilities', () => {
  describe('toPaise', () => {
    it('rounds to nearest integer', () => {
      expect(toPaise(100.4)).toBe(100);
      expect(toPaise(100.5)).toBe(101);
      expect(toPaise(0)).toBe(0);
    });
  });

  describe('rupeesToPaise', () => {
    it('converts rupees to paise', () => {
      expect(rupeesToPaise(1)).toBe(100);
      expect(rupeesToPaise(10.5)).toBe(1050);
      expect(rupeesToPaise(0)).toBe(0);
    });
    it('handles string input', () => {
      expect(rupeesToPaise('5.99')).toBe(599);
    });
    it('handles null/undefined', () => {
      expect(rupeesToPaise(null)).toBe(0);
      expect(rupeesToPaise(undefined)).toBe(0);
    });
  });

  describe('paiseToRupees', () => {
    it('converts paise to rupees', () => {
      expect(paiseToRupees(100)).toBe(1);
      expect(paiseToRupees(1050)).toBe(10.5);
      expect(paiseToRupees(0)).toBe(0);
    });
  });

  describe('calculateLineItem', () => {
    it('calculates amount and tax correctly', () => {
      const item = {
        description: 'Service A',
        quantity: 2,
        unitPrice: 100, // ₹100 = 10000 paise after conversion
        taxRate: 18,
        hsnCode: '',
      };
      const result = calculateLineItem(item);
      expect(result.amount).toBe(2 * 10000); // 20000 paise
      expect(result.taxAmount).toBe(Math.round(20000 * 0.18)); // 3600 paise
      expect(result.quantity).toBe(2);
      expect(result.taxRate).toBe(18);
    });

    it('handles zero tax rate', () => {
      const item = { description: 'Item', quantity: 1, unitPrice: 50, taxRate: 0 };
      const result = calculateLineItem(item);
      expect(result.taxAmount).toBe(0);
    });
  });

  describe('calculateInvoiceTotals', () => {
    const items = [
      { description: 'Item A', quantity: 2, unitPrice: 500, taxRate: 18 },
      { description: 'Item B', quantity: 1, unitPrice: 1000, taxRate: 0 },
    ];

    it('calculates grand total correctly with no discount', () => {
      const result = calculateInvoiceTotals(items);
      const expectedSubtotal = 2 * 50000 + 1 * 100000; // 200000 paise
      const expectedTax = Math.round(100000 * 0.18);
      expect(result.subtotal).toBe(expectedSubtotal);
      expect(result.taxTotal).toBe(expectedTax);
      expect(result.discountAmount).toBe(0);
      expect(result.grandTotal).toBe(expectedSubtotal + expectedTax);
    });

    it('applies percentage discount', () => {
      const result = calculateInvoiceTotals(items, { type: 'percentage', value: 10 });
      expect(result.discountAmount).toBe(Math.round(result.subtotal * 0.1));
    });

    it('applies fixed discount', () => {
      const result = calculateInvoiceTotals(items, { type: 'fixed', value: 100 });
      expect(result.discountAmount).toBe(10000); // ₹100 = 10000 paise
    });

    it('throws on invalid discount percentage', () => {
      expect(() => calculateInvoiceTotals(items, { type: 'percentage', value: 110 })).toThrow();
    });

    it('throws on negative grand total', () => {
      const bigDiscount = { type: 'fixed', value: 999999 };
      expect(() => calculateInvoiceTotals(items, bigDiscount)).toThrow();
    });

    it('throws on empty items', () => {
      expect(() => calculateInvoiceTotals([])).toThrow();
    });
  });

  describe('validateLineItems', () => {
    it('passes valid items', () => {
      const result = validateLineItems([{ description: 'Test', quantity: 1, unitPrice: 100 }]);
      expect(result.valid).toBe(true);
    });

    it('fails empty array', () => {
      const result = validateLineItems([]);
      expect(result.valid).toBe(false);
    });

    it('fails missing description', () => {
      const result = validateLineItems([{ description: '', quantity: 1, unitPrice: 100 }]);
      expect(result.valid).toBe(false);
    });

    it('fails zero quantity', () => {
      const result = validateLineItems([{ description: 'Test', quantity: 0, unitPrice: 100 }]);
      expect(result.valid).toBe(false);
    });

    it('fails negative unit price', () => {
      const result = validateLineItems([{ description: 'Test', quantity: 1, unitPrice: -10 }]);
      expect(result.valid).toBe(false);
    });
  });
});
