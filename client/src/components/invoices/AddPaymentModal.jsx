import { useState } from 'react';
import { X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { invoiceAPI } from '../../services/api';
import { formatCurrency, getErrorMessage, formatDateInput } from '../../utils/formatters';
import toast from 'react-hot-toast';
import LoadingSpinner from '../ui/LoadingSpinner';

const schema = z.object({
  amount: z.coerce.number().min(0.01, 'Amount must be positive'),
  paymentDate: z.string().min(1, 'Date is required'),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'upi', 'cheque', 'card', 'other']),
  referenceNumber: z.string().max(100).optional().default(''),
  notes: z.string().max(500).optional().default(''),
});

export default function AddPaymentModal({ open, onClose, invoiceId, outstanding, onSuccess }) {
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      paymentDate: formatDateInput(new Date()),
      paymentMethod: 'bank_transfer',
    },
  });

  if (!open) return null;

  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      await invoiceAPI.addPayment(invoiceId, data);
      toast.success('Payment recorded successfully');
      reset();
      onSuccess?.();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => { reset(); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-modal w-full max-w-md p-6 z-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Record Payment</h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-slate-500 mb-4">Outstanding: <span className="font-semibold text-amber-600">{formatCurrency(outstanding)}</span></p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div>
            <label className="label">Amount (₹) <span className="text-red-400">*</span></label>
            <input type="number" step="0.01" min="0.01" className={`input ${errors.amount ? 'input-error' : ''}`} {...register('amount')} />
            {errors.amount && <p className="error-text">{errors.amount.message}</p>}
          </div>
          <div>
            <label className="label">Payment Date</label>
            <input type="date" className="input" {...register('paymentDate')} />
          </div>
          <div>
            <label className="label">Payment Method</label>
            <select className="select" {...register('paymentMethod')}>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="upi">UPI</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
              <option value="card">Card</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="label">Reference Number</label>
            <input type="text" placeholder="UTR / Cheque no." className="input" {...register('referenceNumber')} />
          </div>
          <div>
            <label className="label">Notes</label>
            <input type="text" className="input" {...register('notes')} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={handleClose} className="btn-outline flex-1" disabled={submitting}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={submitting}>
              {submitting ? <LoadingSpinner size="sm" /> : null}
              {submitting ? 'Saving…' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
