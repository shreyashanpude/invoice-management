import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Edit2, Mail, Phone, MapPin, FileText } from 'lucide-react';
import { customerAPI } from '../../services/api';
import { formatCurrency, formatDate, getErrorMessage } from '../../utils/formatters';
import StatusBadge from '../../components/ui/StatusBadge';
import { InlineLoader } from '../../components/ui/LoadingSpinner';
import CustomerFormModal from '../../components/customers/CustomerFormModal';
import toast from 'react-hot-toast';

export default function CustomerDetail() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await customerAPI.getById(id);
      setCustomer(res.data.data.customer);
      setInvoices(res.data.data.invoices || []);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return <InlineLoader text="Loading customer…" />;
  if (!customer) return <div className="card p-8 text-center text-slate-400">Customer not found.</div>;

  const addr = customer.billingAddress;
  const addressStr = [addr?.street, addr?.city, addr?.state, addr?.postalCode, addr?.country].filter(Boolean).join(', ');

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">{customer.name}</h1>
          {customer.gstin && <p className="page-subtitle">GSTIN: {customer.gstin}</p>}
        </div>
        <button onClick={() => setEditOpen(true)} className="btn-outline"><Edit2 className="w-4 h-4" /> Edit</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(customer.totalInvoiced || 0)}</p>
          <p className="text-xs text-slate-500 mt-0.5">Total Billed</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(customer.totalPaid || 0)}</p>
          <p className="text-xs text-slate-500 mt-0.5">Total Paid</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{formatCurrency(customer.outstandingBalance || 0)}</p>
          <p className="text-xs text-slate-500 mt-0.5">Outstanding</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-slate-700">Contact Info</h2>
          {customer.email && <div className="flex items-center gap-2 text-sm text-slate-600"><Mail className="w-4 h-4 text-slate-400" />{customer.email}</div>}
          {customer.phone && <div className="flex items-center gap-2 text-sm text-slate-600"><Phone className="w-4 h-4 text-slate-400" />{customer.phone}</div>}
          {addressStr && <div className="flex items-start gap-2 text-sm text-slate-600"><MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" /><span>{addressStr}</span></div>}
          {customer.notes && (
            <div className="pt-2 border-t border-slate-200">
              <p className="text-xs text-slate-400 mb-1">Notes</p>
              <p className="text-sm text-slate-600">{customer.notes}</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-700">Invoice History</h2>
            <Link to={`/invoices/create`} className="btn-primary btn-sm"><FileText className="w-3.5 h-3.5" /> New Invoice</Link>
          </div>
          {invoices.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">No invoices for this customer yet</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <Link key={inv._id} to={`/invoices/${inv._id}`} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-primary-700">{inv.invoiceNumber}</p>
                    <p className="text-xs text-slate-400">{formatDate(inv.issueDate)} — Due {formatDate(inv.dueDate)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(inv.grandTotal)}</p>
                    <StatusBadge status={inv.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <CustomerFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSuccess={() => { setEditOpen(false); load(); }}
        customer={customer}
      />
    </div>
  );
}
