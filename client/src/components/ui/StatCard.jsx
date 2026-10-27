import { TrendingUp, TrendingDown } from 'lucide-react';

export default function StatCard({ title, value, icon: Icon, iconColor = 'text-primary-600', iconBg = 'bg-primary-50', trend, trendLabel, loading = false }) {
  if (loading) {
    return (
      <div className="stat-card">
        <div className="skeleton h-4 w-24 mb-3 rounded" />
        <div className="skeleton h-8 w-32 mb-2 rounded" />
        <div className="skeleton h-3 w-20 rounded" />
      </div>
    );
  }

  const trendPositive = trend >= 0;

  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider truncate">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1 truncate">{value}</p>
          {trendLabel && (
            <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${trendPositive ? 'text-emerald-600' : 'text-red-500'}`}>
              {trendPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>{trendLabel}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0 ml-3`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
        )}
      </div>
    </div>
  );
}
