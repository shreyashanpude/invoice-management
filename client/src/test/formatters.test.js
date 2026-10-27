import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatDate,
  formatDateInput,
  daysUntilDue,
  getStatusBadge,
  truncate,
  getErrorMessage,
  rupeesToPaise,
  paiseToRupees,
} from '../utils/formatters';

describe('formatCurrency', () => {
  it('formats paise to INR string', () => {
    expect(formatCurrency(100000)).toContain('1,000');
    expect(formatCurrency(0)).toContain('0');
  });

  it('handles null/undefined', () => {
    expect(formatCurrency(null)).toContain('0');
    expect(formatCurrency(undefined)).toContain('0');
  });

  it('uses compact notation for large values', () => {
    expect(formatCurrency(10000000, true)).toContain('L'); // 1L
    expect(formatCurrency(100000, true)).toContain('K');   // 1K
  });
});

describe('formatDate', () => {
  it('formats a valid date', () => {
    const result = formatDate('2025-01-15');
    expect(result).toContain('2025');
  });

  it('returns em-dash for null', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
  });
});

describe('formatDateInput', () => {
  it('formats to YYYY-MM-DD', () => {
    const result = formatDateInput(new Date('2025-06-01'));
    expect(result).toBe('2025-06-01');
  });

  it('returns empty string for null', () => {
    expect(formatDateInput(null)).toBe('');
  });
});

describe('daysUntilDue', () => {
  it('returns a number', () => {
    const future = new Date(Date.now() + 7 * 86400000).toISOString();
    expect(daysUntilDue(future)).toBeGreaterThan(0);
  });

  it('returns negative for past dates', () => {
    const past = new Date(Date.now() - 7 * 86400000).toISOString();
    expect(daysUntilDue(past)).toBeLessThan(0);
  });

  it('returns null for missing date', () => {
    expect(daysUntilDue(null)).toBeNull();
  });
});

describe('getStatusBadge', () => {
  it('returns correct label for paid', () => {
    expect(getStatusBadge('paid').label).toBe('Paid');
  });

  it('returns correct label for overdue', () => {
    expect(getStatusBadge('overdue').label).toBe('Overdue');
  });

  it('falls back for unknown status', () => {
    const result = getStatusBadge('unknown_status');
    expect(result.label).toBe('unknown_status');
  });
});

describe('truncate', () => {
  it('truncates long strings', () => {
    const long = 'a'.repeat(50);
    expect(truncate(long, 40)).toHaveLength(41); // 40 + ellipsis char
    expect(truncate(long, 40)).toContain('…');
  });

  it('does not truncate short strings', () => {
    expect(truncate('hello', 40)).toBe('hello');
  });

  it('handles null', () => {
    expect(truncate(null)).toBe('');
  });
});

describe('getErrorMessage', () => {
  it('extracts message from axios-style error', () => {
    const err = { response: { data: { message: 'Not found' } } };
    expect(getErrorMessage(err)).toBe('Not found');
  });

  it('falls back to error.message', () => {
    const err = { message: 'Network error' };
    expect(getErrorMessage(err)).toBe('Network error');
  });

  it('handles null', () => {
    expect(getErrorMessage(null)).toBe('An unexpected error occurred.');
  });
});

describe('rupeesToPaise / paiseToRupees', () => {
  it('converts correctly', () => {
    expect(rupeesToPaise(100)).toBe(10000);
    expect(paiseToRupees(10000)).toBe(100);
  });

  it('round-trips cleanly', () => {
    const original = 1234.56;
    expect(paiseToRupees(rupeesToPaise(original))).toBeCloseTo(original, 1);
  });
});
