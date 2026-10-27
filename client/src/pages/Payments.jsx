import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { invoiceAPI } from '../services/api';
import { formatCurrency, formatDate, getErrorMessage } from '../utils/formatters';
import StatusBadge from '../components/ui/StatusBadge';
import { InlineLoader } from '../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

export default function Payments() {
  const [overdueInvoices, setOverdueInvoices] = useState([]);
  const [upcomingInvoices, setUpcomingInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [overdueRes, upcomingRes] = await Promise.all([
          invoiceAPI.getAll({ status: 'overdue', limit: 20, sortBy: 'dueDate', sortOrder: 'asc' }),
          invoiceAPI.getAll({ status: 'sent', limit: 20, sortBy: 'dueDate', sortOrder: 'asc' }),
        ]);
        setOverdueInvoices(overdueRes.data.data || []);
        setUpcomingInvoices(upcomingRes.data.data || []);
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <InlineLoader />;

  const Section = ({ title, invoices, emptyMsg }) => (
    <div className="card">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="font-semibold text-slate-700">{title} <span className="badge-slate badge ml-2">{invoices.length}</span></h2>
      </div>
      {invoices.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-8">{emptyMsg}</p>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Due Date</th>
                <th>Outstanding</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const outstanding = inv.grandTotal - inv.paidAmount;
                const days = Math.round((new Date(inv.dueDate) - new Date()) / 86400000);
                return (
                  <tr key={inv._id}>
                    <td className="font-medium text-primary-700">{inv.invoiceNumber}</td>
                    <td>{inv.customer?.name || inv.customerSnapshot?.name}</td>
                    <td>
                      <span>{formatDate(inv.dueDate)}</span>
                      {days < 0 ? (
                        <span className="ml-2 badge-danger badge">{Math.abs(days)}d overdue</span>
                      ) : (
                        <span className="ml-2 badge-warning badge">in {days}d</span>
                      )}
                    </td>
                    <td className="font-semibold text-amber-600">{formatCurrency(outstanding)}</td>
                    <td><StatusBadge status={inv.status} /></td>
                    <td className="text-right">
                      <Link to={`/invoices/${inv._id}`} className="btn-primary btn-sm">View</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Payment Tracking</h1>
          <p className="page-subtitle">Overdue and upcoming invoices requiring attention</p>
        </div>
      </div>

      <Section title="Overdue Invoices" invoices={overdueInvoices} emptyMsg="No overdue invoices. Keep it up!" />
      <Section title="Sent — Awaiting Payment" invoices={upcomingInvoices} emptyMsg="No invoices currently awaiting payment." />
    </div>
  );
}
