import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Trash2, Eye, Edit2 } from 'lucide-react';
import { useInvoices } from '../../hooks/useInvoices';
import { formatCurrency, formatDate } from '../../utils/formatters';
import StatusBadge from '../../components/ui/StatusBadge';
import Pagination from '../../components/ui/Pagination';
import EmptyState from '../../components/ui/EmptyState';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { InlineLoader } from '../../components/ui/LoadingSpinner';

const STATUSES = ['', 'draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled'];

export default function InvoiceList() {
  const { invoices, pagination, loading, fetchInvoices, deleteInvoice } = useInvoices();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    fetchInvoices({ page, limit: 10, search, status, sortBy: 'createdAt', sortOrder: 'desc' });
  }, [page, search, status, fetchInvoices]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (e) => { setSearch(e.target.value); setPage(1); };
  const handleStatus = (e) => { setStatus(e.target.value); setPage(1); };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await deleteInvoice(deleteTarget);
    setDeleting(false);
    setDeleteTarget(null);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">{pagination?.total ?? 0} total invoices</p>
        </div>
        <Link to="/invoices/create" className="btn-primary">
          <Plus className="w-4 h-4" /> New Invoice
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search" placeholder="Search invoice number or customer…"
            value={search} onChange={handleSearch}
            className="input pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <select value={status} onChange={handleStatus} className="select w-40">
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s === '' ? 'All statuses' : s.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <InlineLoader />
        ) : invoices.length === 0 ? (
          <EmptyState
            icon="invoice"
            title={search || status ? 'No matching invoices' : 'No invoices yet'}
            description={search || status ? 'Try adjusting your filters.' : 'Create your first invoice to get started.'}
            action={!search && !status ? <Link to="/invoices/create" className="btn-primary btn-sm">Create Invoice</Link> : null}
          />
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Customer</th>
                    <th>Issue Date</th>
                    <th>Due Date</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv._id} className="cursor-pointer" onClick={() => navigate(`/invoices/${inv._id}`)}>
                      <td className="font-medium text-primary-700">{inv.invoiceNumber}</td>
                      <td>{inv.customer?.name || inv.customerSnapshot?.name || '—'}</td>
                      <td>{formatDate(inv.issueDate)}</td>
                      <td>{formatDate(inv.dueDate)}</td>
                      <td className="font-semibold">{formatCurrency(inv.grandTotal)}</td>
                      <td><StatusBadge status={inv.status} /></td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Link to={`/invoices/${inv._id}`} className="btn-ghost btn-sm p-2" aria-label="View"><Eye className="w-3.5 h-3.5" /></Link>
                          {inv.status !== 'paid' && (
                            <Link to={`/invoices/${inv._id}/edit`} className="btn-ghost btn-sm p-2" aria-label="Edit"><Edit2 className="w-3.5 h-3.5" /></Link>
                          )}
                          {inv.status !== 'paid' && (
                            <button onClick={() => setDeleteTarget(inv._id)} className="btn-ghost btn-sm p-2 text-red-400 hover:text-red-600 hover:bg-red-50" aria-label="Delete">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4">
              <Pagination pagination={pagination} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Delete Invoice"
        message="This invoice will be permanently deleted. This action cannot be undone."
        confirmLabel="Delete Invoice"
      />
    </div>
  );
}
