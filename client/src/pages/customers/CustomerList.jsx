import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Trash2, Eye, Edit2 } from 'lucide-react';
import { useCustomers } from '../../hooks/useCustomers';
import { formatCurrency } from '../../utils/formatters';
import Pagination from '../../components/ui/Pagination';
import EmptyState from '../../components/ui/EmptyState';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { InlineLoader } from '../../components/ui/LoadingSpinner';
import CustomerFormModal from '../../components/customers/CustomerFormModal';

export default function CustomerList() {
  const { customers, pagination, loading, fetchCustomers, deleteCustomer } = useCustomers();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);

  const load = useCallback(() => {
    fetchCustomers({ page, limit: 10, search });
  }, [page, search, fetchCustomers]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (e) => { setSearch(e.target.value); setPage(1); };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await deleteCustomer(deleteTarget);
    setDeleting(false);
    setDeleteTarget(null);
    load();
  };

  const handleFormClose = () => { setFormOpen(false); setEditCustomer(null); };
  const handleFormSuccess = () => { handleFormClose(); load(); };

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">{pagination?.total ?? 0} total customers</p>
        </div>
        <button onClick={() => setFormOpen(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Customer
        </button>
      </div>

      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="search" placeholder="Search by name, email, or phone…" value={search} onChange={handleSearch} className="input pl-9" />
        </div>
      </div>

      <div className="card">
        {loading ? (
          <InlineLoader />
        ) : customers.length === 0 ? (
          <EmptyState
            icon="customer"
            title={search ? 'No matching customers' : 'No customers yet'}
            description={search ? 'Try a different search.' : 'Add your first customer to start creating invoices.'}
            action={!search ? <button onClick={() => setFormOpen(true)} className="btn-primary btn-sm">Add Customer</button> : null}
          />
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Total Billed</th>
                    <th>Outstanding</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c._id} className="cursor-pointer" onClick={() => navigate(`/customers/${c._id}`)}>
                      <td className="font-medium text-primary-700">{c.name}</td>
                      <td className="text-slate-500">{c.email || '—'}</td>
                      <td className="text-slate-500">{c.phone || '—'}</td>
                      <td>{formatCurrency(c.totalInvoiced || 0)}</td>
                      <td className={c.outstandingBalance > 0 ? 'text-amber-600 font-medium' : 'text-slate-400'}>
                        {formatCurrency(c.outstandingBalance || 0)}
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Link to={`/customers/${c._id}`} className="btn-ghost btn-sm p-2" aria-label="View"><Eye className="w-3.5 h-3.5" /></Link>
                          <button onClick={() => { setEditCustomer(c); setFormOpen(true); }} className="btn-ghost btn-sm p-2" aria-label="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setDeleteTarget(c._id)} className="btn-ghost btn-sm p-2 text-red-400 hover:text-red-600 hover:bg-red-50" aria-label="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4"><Pagination pagination={pagination} onPageChange={setPage} /></div>
          </>
        )}
      </div>

      <CustomerFormModal open={formOpen} onClose={handleFormClose} onSuccess={handleFormSuccess} customer={editCustomer} />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        title="Remove Customer"
        message="If this customer has invoices, they will be deactivated but invoices preserved. Otherwise the customer will be deleted."
        confirmLabel="Remove"
      />
    </div>
  );
}
