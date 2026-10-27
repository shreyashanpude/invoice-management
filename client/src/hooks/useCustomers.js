import { useState, useCallback } from 'react';
import { customerAPI } from '../services/api';
import { getErrorMessage } from '../utils/formatters';
import toast from 'react-hot-toast';

export const useCustomers = () => {
  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCustomers = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await customerAPI.getAll(params);
      setCustomers(res.data.data);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteCustomer = useCallback(async (id) => {
    try {
      const res = await customerAPI.delete(id);
      setCustomers((prev) => prev.filter((c) => c._id !== id));
      toast.success(res.data.message || 'Customer removed');
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err));
      return false;
    }
  }, []);

  return { customers, pagination, loading, error, fetchCustomers, deleteCustomer };
};
