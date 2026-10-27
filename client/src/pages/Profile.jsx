import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { profileAPI } from '../services/api';
import { getErrorMessage, formatDate } from '../utils/formatters';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { Shield } from 'lucide-react';

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password required'),
  newPassword: z.string().min(8, 'At least 8 characters').regex(/[A-Z]/, 'Must include uppercase').regex(/[0-9]/, 'Must include number'),
  confirmNewPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmNewPassword, { message: 'Passwords do not match', path: ['confirmNewPassword'] });

export default function Profile() {
  const { user } = useAuth();
  const [changingPwd, setChangingPwd] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(passwordSchema),
  });

  const onPasswordSubmit = async (data) => {
    setChangingPwd(true);
    try {
      await profileAPI.changePassword({ currentPassword: data.currentPassword, newPassword: data.newPassword });
      toast.success('Password changed successfully');
      reset();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setChangingPwd(false);
    }
  };

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <div className="max-w-2xl space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Profile</h1>
          <p className="page-subtitle">Account overview and security</p>
        </div>
      </div>

      {/* Profile card */}
      <div className="card p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center text-2xl font-bold text-primary-700 flex-shrink-0">
          {initials}
        </div>
        <div>
          <p className="text-xl font-bold text-slate-900">{user?.name}</p>
          <p className="text-slate-500">{user?.email}</p>
          {user?.businessName && <p className="text-sm text-slate-400 mt-0.5">{user.businessName}</p>}
          <p className="text-xs text-slate-400 mt-1">Member since {formatDate(user?.createdAt)}</p>
        </div>
      </div>

      {/* Account details */}
      <div className="card p-5 space-y-3">
        <h2 className="font-semibold text-slate-700">Account Details</h2>
        {[
          { label: 'Full Name', value: user?.name },
          { label: 'Email Address', value: user?.email },
          { label: 'Business Name', value: user?.businessName || '—' },
          { label: 'Phone', value: user?.phone || '—' },
          { label: 'Invoice Prefix', value: user?.invoicePrefix || 'INV' },
          { label: 'Currency', value: user?.currency || 'INR' },
          { label: 'Last Login', value: formatDate(user?.lastLogin) },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between py-2 border-b border-slate-100 last:border-0">
            <span className="text-sm text-slate-500">{label}</span>
            <span className="text-sm font-medium text-slate-700">{value}</span>
          </div>
        ))}
        <p className="text-xs text-slate-400 pt-1">To update profile details, go to <a href="/settings" className="text-primary-600 hover:underline">Settings</a>.</p>
      </div>

      {/* Change password */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-primary-600" />
          <h2 className="font-semibold text-slate-700">Change Password</h2>
        </div>
        <form onSubmit={handleSubmit(onPasswordSubmit)} noValidate className="space-y-4">
          <div>
            <label className="label">Current Password</label>
            <input type="password" className={`input ${errors.currentPassword ? 'input-error' : ''}`} {...register('currentPassword')} />
            {errors.currentPassword && <p className="error-text">{errors.currentPassword.message}</p>}
          </div>
          <div>
            <label className="label">New Password</label>
            <input type="password" className={`input ${errors.newPassword ? 'input-error' : ''}`} {...register('newPassword')} />
            {errors.newPassword && <p className="error-text">{errors.newPassword.message}</p>}
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <input type="password" className={`input ${errors.confirmNewPassword ? 'input-error' : ''}`} {...register('confirmNewPassword')} />
            {errors.confirmNewPassword && <p className="error-text">{errors.confirmNewPassword.message}</p>}
          </div>
          <button type="submit" className="btn-primary" disabled={changingPwd}>
            {changingPwd ? <LoadingSpinner size="sm" /> : null}
            {changingPwd ? 'Changing…' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
