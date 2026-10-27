import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Zap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/formatters';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  businessName: z.string().max(200).optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export default function Register() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      await registerUser({ name: data.name, email: data.email, password: data.password, businessName: data.businessName });
      toast.success('Account created! Welcome aboard.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-700 rounded-2xl mb-4">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Create account</h1>
          <p className="text-slate-500 text-sm mt-1">Start managing your invoices today</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="label">Full name <span className="text-red-400">*</span></label>
                <input id="name" type="text" placeholder="Your name" className={`input ${errors.name ? 'input-error' : ''}`} {...register('name')} />
                {errors.name && <p className="error-text">{errors.name.message}</p>}
              </div>

              <div>
                <label htmlFor="email" className="label">Email address <span className="text-red-400">*</span></label>
                <input id="email" type="email" placeholder="you@example.com" className={`input ${errors.email ? 'input-error' : ''}`} {...register('email')} />
                {errors.email && <p className="error-text">{errors.email.message}</p>}
              </div>

              <div>
                <label htmlFor="businessName" className="label">Business name <span className="text-slate-400 font-normal">(optional)</span></label>
                <input id="businessName" type="text" placeholder="Your company or trade name" className="input" {...register('businessName')} />
              </div>

              <div>
                <label htmlFor="password" className="label">Password <span className="text-red-400">*</span></label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPass ? 'text' : 'password'}
                    placeholder="Min 8 chars, 1 uppercase, 1 number"
                    className={`input pr-10 ${errors.password ? 'input-error' : ''}`}
                    {...register('password')}
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Toggle password">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="error-text">{errors.password.message}</p>}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="label">Confirm password <span className="text-red-400">*</span></label>
                <input id="confirmPassword" type="password" placeholder="Repeat your password" className={`input ${errors.confirmPassword ? 'input-error' : ''}`} {...register('confirmPassword')} />
                {errors.confirmPassword && <p className="error-text">{errors.confirmPassword.message}</p>}
              </div>

              <button type="submit" className="btn-primary w-full btn-lg mt-2" disabled={submitting}>
                {submitting ? <LoadingSpinner size="sm" /> : null}
                {submitting ? 'Creating account…' : 'Create account'}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-200 text-center">
            <p className="text-sm text-slate-500">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-primary-700 hover:underline">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
