import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from 'recharts';
import { dashboardAPI } from '../services/api';
import { formatCurrency, getErrorMessage } from '../utils/formatters';
import { InlineLoader } from '../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

export default function Reports() {
  const [revenueData, setRevenueData] = useState([]);
  const [statusData, setStatusData] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(12);

  useEffect(() => {
    loadReports();
  }, [months]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const [revRes, statusRes] = await Promise.all([
        dashboardAPI.getRevenue(months),
        dashboardAPI.getInvoiceStatus(),
      ]);
      setRevenueData(revRes.data.data.chartData);
      setStatusData(statusRes.data.data.statusData);
      setTopCustomers(statusRes.data.data.topCustomers);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const chartData = revenueData.map((d) => ({
    month: d.month,
    Revenue: d.revenue / 100,
    Invoiced: d.invoiced / 100,
  }));

  const totalInvoiced = revenueData.reduce((s, d) => s + d.invoiced, 0);
  const totalCollected = revenueData.reduce((s, d) => s + d.revenue, 0);
  const collectionRate = totalInvoiced > 0 ? ((totalCollected / totalInvoiced) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Financial performance overview</p>
        </div>
        <select value={months} onChange={(e) => setMonths(parseInt(e.target.value))} className="select w-36">
          <option value={3}>Last 3 months</option>
          <option value={6}>Last 6 months</option>
          <option value={12}>Last 12 months</option>
          <option value={24}>Last 24 months</option>
        </select>
      </div>

      {loading ? <InlineLoader /> : (
        <>
          {/* Summary metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Invoiced', value: formatCurrency(totalInvoiced), color: 'text-primary-700' },
              { label: 'Total Collected', value: formatCurrency(totalCollected), color: 'text-emerald-600' },
              { label: 'Outstanding', value: formatCurrency(totalInvoiced - totalCollected), color: 'text-amber-600' },
              { label: 'Collection Rate', value: `${collectionRate}%`, color: collectionRate >= 80 ? 'text-emerald-600' : 'text-red-500' },
            ].map((s) => (
              <div key={s.label} className="card p-4 text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Revenue bar chart */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Monthly Revenue vs Invoiced</h2>
            {chartData.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-8">No data for this period</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} />
                  <Tooltip formatter={(val) => [`₹${val.toLocaleString('en-IN')}`, '']} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
                  <Bar dataKey="Invoiced" fill="#c7d2fe" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Revenue" fill="#4338ca" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Invoice status distribution */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Invoice Status Breakdown</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {statusData.map((s) => (
                <div key={s._id} className="text-center p-3 rounded-xl bg-slate-50">
                  <p className="text-lg font-bold text-slate-800">{s.count}</p>
                  <p className="text-xs text-slate-500 capitalize">{s._id?.replace('_', ' ')}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatCurrency(s.total)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Top customers */}
          {topCustomers.length > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Top 5 Customers by Revenue</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={topCustomers.map((c) => ({ name: c.name || 'Unknown', Billed: c.totalAmount / 100, Paid: c.paidAmount / 100 }))}
                  layout="vertical"
                  margin={{ top: 0, right: 20, left: 80, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}K`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={75} />
                  <Tooltip formatter={(val) => [`₹${val.toLocaleString('en-IN')}`, '']} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="Billed" fill="#c7d2fe" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="Paid" fill="#4338ca" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
