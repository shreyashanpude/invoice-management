import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // send cookies
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Attach JWT from localStorage as Bearer fallback
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && !config.headers['Authorization']) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Global response error handler
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Redirect only if not already on auth pages
      if (!window.location.pathname.startsWith('/login') &&
          !window.location.pathname.startsWith('/register')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

// ─── Profile ─────────────────────────────────────────────────────────────────
export const profileAPI = {
  get: () => api.get('/profile'),
  update: (data) => api.put('/profile', data),
  changePassword: (data) => api.put('/profile/password', data),
};

// ─── Dashboard ───────────────────────────────────────────────────────────────
export const dashboardAPI = {
  getSummary: () => api.get('/dashboard/summary'),
  getRevenue: (months = 12) => api.get(`/dashboard/revenue?months=${months}`),
  getInvoiceStatus: () => api.get('/dashboard/invoice-status'),
};

// ─── Invoices ─────────────────────────────────────────────────────────────────
export const invoiceAPI = {
  getAll: (params) => api.get('/invoices', { params }),
  getById: (id) => api.get(`/invoices/${id}`),
  create: (data) => api.post('/invoices', data),
  update: (id, data) => api.put(`/invoices/${id}`, data),
  delete: (id) => api.delete(`/invoices/${id}`),
  addPayment: (id, data) => api.post(`/invoices/${id}/payments`, data),
  getPayments: (id) => api.get(`/invoices/${id}/payments`),
  checkDuplicate: (params) => api.get('/invoices/check-duplicate', { params }),
};

// ─── Customers ────────────────────────────────────────────────────────────────
export const customerAPI = {
  getAll: (params) => api.get('/customers', { params }),
  getById: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
};

// ─── AI ───────────────────────────────────────────────────────────────────────
export const aiAPI = {
  extractInvoice: (formData) =>
    api.post('/ai/extract-invoice', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    }),
  getFinancialInsights: () => api.post('/ai/financial-insights'),
  generateReminder: (invoiceId) => api.post('/ai/payment-reminders', { invoiceId }),
};

// ─── Health ───────────────────────────────────────────────────────────────────
export const healthAPI = {
  check: () => api.get('/health'),
};

export default api;
