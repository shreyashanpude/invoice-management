import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DollarSign, FileText, AlertTriangle, TrendingUp,
  Users, Clock, ArrowRight, Sparkles
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { dashboardAPI, aiAPI } from '../services/api';
import { formatCurrency, formatDate, getErrorMessage } from '../utils/formatters';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import { InlineLoader } from '../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  paid: '#10b981', sent: '#3b82f6', draft: '#94a3b8',
  overdue: '#ef4444', partially_paid: '#f59e0b', cancelled: '#6b7280',
};

const INSIGHT_STYLES = {
  success: { bg: 'bg-emerald-50', border: 'border-emerald-200', title: 'text-emerald-700', msg: 'text-emerald-700', metric: 'text-emerald-500' },
  warning: { bg: 'bg-amber-50', border: 'border-amber-200', title: 'text-amber-700', msg: 'text-amber-700', metric: 'text-amber-500' },
  alert:   { bg: 'bg-red-50', border: 'border-red-200', title: 'text-red-700', msg: 'text-red-700', metric: 'text-red-500' },
  info:    { bg: 'bg-blue-50', border: 'border-blue-200', title: 'text-blue-700', msg: 'text-blue-700', metric: 'text-blue-500' },
};

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [statusData, setStatusData] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [insightsLoading, setInsightsLoading] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [summaryRes, revenueRes, statusRes] = await Promise.all([
        dashboardAPI.getSummary(),
        dashboardAPI.getRevenue(6),
        dashboardAPI.getInvoiceStatus(),
      ]);
      setSummary(summaryRes.data.data.summary);
      setChartData(revenueRes.data.data.chartData);
      setStatusData(statusRes.data.data.statusData);
      setTopCustomers(statusRes.data.data.topCustomers);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const loadInsights = async () => {
    setInsightsLoading(true);
    try {
      const res = await aiAPI.getFinancialInsights();
      setInsights(res.data.data.insights || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setInsightsLoading(false);
    }
  };

  const pieData = statusData.map((s) => ({
    name: s._id?.replace('_', ' ') || 'Unknown',
    value: s.count,
    color: STATUS_COLORS[s._id] || '#94a3b8',
  }));

  const revenueChart = chartData.map((d) => ({
    month: d.month,
    Revenue: d.revenue / 100,
    Invoiced: d.invoiced / 100,
  }));

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Your financial overview at a glance</p>
        </div>
        <Link to="/invoices/create" className="btn-primary">
          <FileText className="w-4 h-4" /> New Invoice
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Invoiced" loading={loading}
          value={summary ? formatCurrency(summary.totalInvoiced, true) : '₹0'}
          icon={DollarSign} iconColor="text-primary-600" iconBg="bg-primary-50"
        />
        <StatCard
          title="Amount Paid" loading={loading}
          value={summary ? formatCurrency(summary.totalPaid, true) : '₹0'}
          icon={TrendingUp} iconColor="text-emerald-600" iconBg="bg-emerald-50"
        />
        <StatCard
          title="Unpaid Amount" loading={loading}
          value={summary ? formatCurrency(summary.totalUnpaid, true) : '₹0'}
          icon={Clock} iconColor="text-amber-600" iconBg="bg-amber-50"
        />
        <StatCard
          title="Overdue Amount" loading={loading}
          value={summary ? formatCurrency(summary.overdueAmount, true) : '₹0'}
          icon={AlertTriangle} iconColor="text-red-600" iconBg="bg-red-50"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Invoices', value: summary?.totalCount || 0, color: 'text-slate-700' },
          { label: 'Paid', value: summary?.paidCount || 0, color: 'text-emerald-600' },
          { label: 'Overdue', value: summary?.overdueCount || 0, color: 'text-red-600' },
          { label: 'Customers', value: summary?.customerCount || 0, color: 'text-primary-600' },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            {loading ? (
              <><div className="skeleton h-8 w-16 mx-auto mb-1 rounded" /><div className="skeleton h-3 w-20 mx-auto rounded" /></>
            ) : (
              <><p className={`text-2xl font-bold ${s.color}`}>{s.value}</p><p className="text-xs text-slate-500 mt-0.5">{s.label}</p></>
            )}
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Revenue chart */}
        <div className="card p-5 xl:col-span-2">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Revenue vs Invoiced (6 months)</h2>
          {loading ? (
            <div className="skeleton h-52 rounded-xl" />
          ) : revenueChart.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-slate-400 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={revenueChart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4338ca" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#4338ca" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorInvoiced" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} />
                <Tooltip formatter={(val) => [`₹${val.toLocaleString('en-IN')}`, '']} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Area type="monotone" dataKey="Invoiced" stroke="#7c3aed" fill="url(#colorInvoiced)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="Revenue" stroke="#4338ca" fill="url(#colorRevenue)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Status pie */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Invoice Status</h2>
          {loading ? (
            <div className="skeleton h-52 rounded-xl" />
          ) : pieData.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-slate-400 text-sm">No invoices yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="45%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent invoices + upcoming */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent invoices */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Recent Invoices</h2>
            <Link to="/invoices" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="p-4 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-10 rounded-lg" />)}</div>
          ) : summary?.recentInvoices?.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">No invoices yet</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {(summary?.recentInvoices || []).map((inv) => (
                <Link key={inv._id} to={`/invoices/${inv._id}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{inv.invoiceNumber}</p>
                    <p className="text-xs text-slate-400">{inv.customer?.name || inv.customerSnapshot?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-800">{formatCurrency(inv.grandTotal)}</p>
                    <StatusBadge status={inv.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming due */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Due in 7 Days</h2>
            <Link to="/payments" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
              Payments <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="p-4 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-10 rounded-lg" />)}</div>
          ) : summary?.upcomingDue?.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">No upcoming payments</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {(summary?.upcomingDue || []).map((inv) => (
                <Link key={inv._id} to={`/invoices/${inv._id}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{inv.invoiceNumber}</p>
                    <p className="text-xs text-slate-400">Due {formatDate(inv.dueDate)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-800">{formatCurrency(inv.outstandingBalance || inv.grandTotal)}</p>
                    <StatusBadge status={inv.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top customers */}
      {!loading && topCustomers.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">Top Customers by Invoice Value</h2>
            <Link to="/customers" className="text-xs text-primary-600 hover:underline flex items-center gap-1">
              All customers <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Invoices</th>
                  <th>Total Billed</th>
                  <th>Total Paid</th>
                  <th>Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((c) => (
                  <tr key={c._id}>
                    <td className="font-medium">{c.name || '—'}</td>
                    <td>{c.invoiceCount}</td>
                    <td>{formatCurrency(c.totalAmount)}</td>
                    <td className="text-emerald-600">{formatCurrency(c.paidAmount)}</td>
                    <td className="text-amber-600">{formatCurrency(c.outstandingAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI Insights */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-secondary-600" />
            <h2 className="text-sm font-semibold text-slate-700">AI Financial Insights</h2>
          </div>
          <button onClick={loadInsights} disabled={insightsLoading} className="btn-outline btn-sm">
            {insightsLoading ? 'Generating…' : 'Generate Insights'}
          </button>
        </div>

        {insightsLoading && <InlineLoader text="Analyzing your financial data…" />}

        {!insightsLoading && insights.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">
            Click "Generate Insights" to get AI-powered observations based on your invoicing data.
          </p>
        )}

          {!insightsLoading && insights.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {insights.map((insight, i) => {
              const s = INSIGHT_STYLES[insight.type] || INSIGHT_STYLES.info;
              return (
                <div key={i} className={`p-4 rounded-xl border ${s.bg} ${s.border}`}>
                  <p className={`text-xs font-semibold ${s.title} mb-1`}>{insight.title}</p>
                  <p className={`text-sm ${s.msg}`}>{insight.message}</p>
                  {insight.metric && <p className={`text-xs ${s.metric} mt-1.5 font-mono`}>{insight.metric}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
