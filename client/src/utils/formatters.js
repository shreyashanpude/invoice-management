/**
 * Format paise (integer) to INR currency string
 */
export const formatCurrency = (paise, compact = false) => {
  const rupees = (paise || 0) / 100;
  if (compact && rupees >= 100000) {
    return `₹${(rupees / 100000).toFixed(2)}L`;
  }
  if (compact && rupees >= 1000) {
    return `₹${(rupees / 1000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
};

/**
 * Format a Date or ISO string to readable date
 */
export const formatDate = (date) => {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
};

/**
 * Format date as YYYY-MM-DD for input[type=date]
 */
export const formatDateInput = (date) => {
  if (!date) return '';
  return new Date(date).toISOString().split('T')[0];
};

/**
 * Days remaining until due date (negative = overdue)
 */
export const daysUntilDue = (dueDate) => {
  if (!dueDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.round((due - now) / (1000 * 60 * 60 * 24));
};

/**
 * Map invoice status to badge config
 */
export const getStatusBadge = (status) => {
  const map = {
    draft:          { label: 'Draft',          className: 'badge-slate' },
    sent:           { label: 'Sent',            className: 'badge-info' },
    partially_paid: { label: 'Partial',         className: 'badge-warning' },
    paid:           { label: 'Paid',            className: 'badge-success' },
    overdue:        { label: 'Overdue',         className: 'badge-danger' },
    cancelled:      { label: 'Cancelled',       className: 'badge-slate' },
  };
  return map[status] || { label: status, className: 'badge-slate' };
};

/**
 * Truncate long text with ellipsis
 */
export const truncate = (str, len = 40) => {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '…' : str;
};

/**
 * Extract readable API error message
 */
export const getErrorMessage = (error) => {
  if (!error) return 'An unexpected error occurred.';
  if (error.response?.data?.message) return error.response.data.message;
  if (error.response?.data?.errors?.[0]?.message) return error.response.data.errors[0].message;
  if (error.message) return error.message;
  return 'An unexpected error occurred.';
};

/**
 * Rupees string → paise integer
 */
export const rupeesToPaise = (val) => Math.round(parseFloat(val || 0) * 100);

/**
 * Paise integer → rupees number
 */
export const paiseToRupees = (paise) => (paise || 0) / 100;
