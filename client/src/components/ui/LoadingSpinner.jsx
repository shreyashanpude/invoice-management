export default function LoadingSpinner({ size = 'md', className = '' }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-10 w-10', xl: 'h-16 w-16' };
  return (
    <svg
      className={`animate-spin text-primary-600 ${sizes[size]} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-label="Loading"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <LoadingSpinner size="xl" />
        <p className="mt-4 text-slate-500 text-sm">Loading…</p>
      </div>
    </div>
  );
}

export function InlineLoader({ text = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12">
      <LoadingSpinner size="md" />
      <span className="text-slate-500 text-sm">{text}</span>
    </div>
  );
}
