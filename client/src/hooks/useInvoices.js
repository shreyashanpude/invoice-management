import { useState, useCallback } from 'react';
import { invoiceAPI } from '../services/api';
import { getErrorMessage } from '../utils/formatters';
import toast from 'react-hot-toast';

export const useInvoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchInvoices = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await invoiceAPI.getAll(params);
      setInvoices(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteInvoice = useCallback(async (id) => {
    try {
      await invoiceAPI.delete(id);
      setInvoices((prev) => prev.filter((inv) => inv._id !== id));
      toast.success('Invoice deleted successfully');
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err));
      return false;
    }
  }, []);

  return { invoices, pagination, loading, error, fetchInvoices, deleteInvoice };
};

export const useInvoice = (id) => {
  const [invoice, setInvoice] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchInvoice = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await invoiceAPI.getById(id);
      setInvoice(res.data.data.invoice);
      setPayments(res.data.data.payments || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  return { invoice, payments, loading, error, fetchInvoice, setInvoice, setPayments };
};
