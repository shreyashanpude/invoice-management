import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { profileAPI } from '../services/api';
import { getErrorMessage } from '../utils/formatters';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const profileSchema = z.object({
  name: z.string().min(2, 'At least 2 characters').max(100),
  businessName: z.string().max(200).optional().default(''),
  businessAddress: z.string().max(500).optional().default(''),
  phone: z.string().max(20).optional().default(''),
  gstin: z.string().max(15).optional().default(''),
  invoicePrefix: z.string().max(10).optional().default('INV'),
  currency: z.string().default('INR'),
  timezone: z.string().default('Asia/Kolkata'),
});

export default function Settings() {
  const { user, updateUser } = useAuth();
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      businessName: user?.businessName || '',
      businessAddress: user?.businessAddress || '',
      phone: user?.phone || '',
      gstin: user?.gstin || '',
      invoicePrefix: user?.invoicePrefix || 'INV',
      currency: user?.currency || 'INR',
      timezone: user?.timezone || 'Asia/Kolkata',
    },
  });

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      const res = await profileAPI.update(data);
      updateUser(res.data.data.user);
      toast.success('Settings saved');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Business and invoice preferences</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-5">
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-slate-700">Personal Information</h2>
            <div>
              <label className="label">Full Name <span className="text-red-400">*</span></label>
              <input type="text" className={`input ${errors.name ? 'input-error' : ''}`} {...register('name')} />
              {errors.name && <p className="error-text">{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">Phone</label>
              <input type="tel" className="input" {...register('phone')} />
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-slate-700">Business Information</h2>
            <div>
              <label className="label">Business Name</label>
              <input type="text" className="input" placeholder="Your company name" {...register('businessName')} />
            </div>
            <div>
              <label className="label">Business Address</label>
              <textarea rows={3} className="textarea" placeholder="Full address for invoice header" {...register('businessAddress')} />
            </div>
            <div>
              <label className="label">GSTIN</label>
              <input type="text" placeholder="22AAAAA0000A1Z5" className="input uppercase" {...register('gstin')} />
              <p className="text-xs text-slate-400 mt-1">Your business GST Identification Number</p>
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-slate-700">Invoice Preferences</h2>
            <div>
              <label className="label">Invoice Number Prefix</label>
              <input type="text" maxLength={10} placeholder="INV" className="input" {...register('invoicePrefix')} />
              <p className="text-xs text-slate-400 mt-1">Invoice numbers will be formatted as: PREFIX-0001</p>
            </div>
            <div>
              <label className="label">Currency</label>
              <select className="select" {...register('currency')}>
                <option value="INR">INR — Indian Rupee (₹)</option>
                <option value="USD">USD — US Dollar ($)</option>
                <option value="EUR">EUR — Euro (€)</option>
                <option value="GBP">GBP — British Pound (£)</option>
              </select>
            </div>
            <div>
              <label className="label">Timezone</label>
              <select className="select" {...register('timezone')}>
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
              </select>
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <LoadingSpinner size="sm" /> : null}
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
