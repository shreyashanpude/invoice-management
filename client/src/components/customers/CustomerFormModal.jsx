import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { customerAPI } from '../../services/api';
import { getErrorMessage } from '../../utils/formatters';
import toast from 'react-hot-toast';
import LoadingSpinner from '../ui/LoadingSpinner';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(200),
  email: z.union([z.string().email('Invalid email address'), z.literal(''), z.undefined()]).optional().default(''),
  phone: z.string().max(20).optional().default(''),
  gstin: z.string().max(15).optional().default(''),
  billingAddress: z.object({
    street: z.string().max(200).optional().default(''),
    city: z.string().max(100).optional().default(''),
    state: z.string().max(100).optional().default(''),
    postalCode: z.string().max(20).optional().default(''),
    country: z.string().max(100).optional().default('India'),
  }).optional().default({}),
  notes: z.string().max(1000).optional().default(''),
});

export default function CustomerFormModal({ open, onClose, onSuccess, customer }) {
  const isEdit = !!customer;
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { billingAddress: { country: 'India' } },
  });

  useEffect(() => {
    if (customer) {
      reset({
        name: customer.name || '',
        email: customer.email || '',
        phone: customer.phone || '',
        gstin: customer.gstin || '',
        billingAddress: customer.billingAddress || { country: 'India' },
        notes: customer.notes || '',
      });
    } else {
      reset({ name: '', email: '', phone: '', gstin: '', billingAddress: { country: 'India' }, notes: '' });
    }
  }, [customer, reset, open]);

  if (!open) return null;

  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      // Clean empty strings
      const cleanData = {
        ...data,
        email: data.email?.trim() || '',
        phone: data.phone?.trim() || '',
        gstin: data.gstin?.trim().toUpperCase() || '',
        notes: data.notes?.trim() || '',
      };
      if (isEdit) {
        await customerAPI.update(customer._id, cleanData);
        toast.success('Customer updated');
      } else {
        await customerAPI.create(cleanData);
        toast.success('Customer added');
      }
      onSuccess?.();
    } catch (err) {
      const msg = err.response?.data?.errors?.[0]?.message
        || err.response?.data?.message
        || 'Failed to save customer';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-modal w-full max-w-lg p-6 z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5 sticky top-0 bg-white pb-2">
          <h2 className="text-lg font-semibold">{isEdit ? 'Edit Customer' : 'Add Customer'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <div>
            <label className="label">Name <span className="text-red-400">*</span></label>
            <input type="text" placeholder="Customer or company name" className={`input ${errors.name ? 'input-error' : ''}`} {...register('name')} />
            {errors.name && <p className="error-text">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Email</label>
              <input type="email" placeholder="billing@company.com" className={`input ${errors.email ? 'input-error' : ''}`} {...register('email')} />
              {errors.email && <p className="error-text">{errors.email.message}</p>}
            </div>
            <div>
              <label className="label">Phone</label>
              <input type="tel" placeholder="9876543210" className="input" {...register('phone')} />
            </div>
          </div>

          <div>
            <label className="label">GSTIN</label>
            <input type="text" placeholder="22AAAAA0000A1Z5" className="input uppercase" {...register('gstin')} />
          </div>

          <div className="space-y-2">
            <p className="label">Billing Address</p>
            <input type="text" placeholder="Street address" className="input" {...register('billingAddress.street')} />
            <div className="grid grid-cols-2 gap-2">
              <input type="text" placeholder="City" className="input" {...register('billingAddress.city')} />
              <input type="text" placeholder="State" className="input" {...register('billingAddress.state')} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" placeholder="Postal code" className="input" {...register('billingAddress.postalCode')} />
              <input type="text" placeholder="Country" className="input" {...register('billingAddress.country')} />
            </div>
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea rows={2} className="textarea" {...register('notes')} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-outline flex-1" disabled={submitting}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={submitting}>
              {submitting ? <LoadingSpinner size="sm" /> : null}
              {submitting ? 'Saving…' : isEdit ? 'Update' : 'Add Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
