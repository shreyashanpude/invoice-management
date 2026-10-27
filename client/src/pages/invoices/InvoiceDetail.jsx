import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Edit2, Trash2, Printer, CreditCard, Send, Copy, FileDown } from 'lucide-react';
import { useInvoice } from '../../hooks/useInvoices';
import { formatCurrency, formatDate, getErrorMessage, paiseToRupees } from '../../utils/formatters';
import StatusBadge from '../../components/ui/StatusBadge';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { InlineLoader } from '../../components/ui/LoadingSpinner';
import { invoiceAPI, aiAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import AddPaymentModal from '../../components/invoices/AddPaymentModal';
import ReminderModal from '../../components/invoices/ReminderModal';

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { invoice, payments, loading, error, fetchInvoice } = useInvoice(id);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderData, setReminderData] = useState(null);

  useEffect(() => { fetchInvoice(); }, [fetchInvoice]);

  if (loading) return <InlineLoader text="Loading invoice…" />;
  if (error) return <div className="card p-8 text-center text-red-500">{error}</div>;
  if (!invoice) return null;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await invoiceAPI.delete(id);
      toast.success('Invoice deleted');
      navigate('/invoices');
    } catch (err) {
      toast.error(getErrorMessage(err));
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const handleSendStatus = async () => {
    try {
      await invoiceAPI.update(id, { status: 'sent' });
      toast.success('Invoice marked as sent');
      fetchInvoice();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleGenerateReminder = async () => {
    try {
      const res = await aiAPI.generateReminder(id);
      setReminderData(res.data.data.reminder);
      setReminderOpen(true);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handlePrint = () => window.print();

  const outstanding = invoice.grandTotal - invoice.paidAmount;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="page-header no-print">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="page-title">{invoice.invoiceNumber}</h1>
            <StatusBadge status={invoice.status} />
          </div>
          <p className="page-subtitle">Created {formatDate(invoice.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handlePrint} className="btn-outline btn-sm"><Printer className="w-3.5 h-3.5" /> Print</button>
          {invoice.status === 'draft' && (
            <button onClick={handleSendStatus} className="btn-outline btn-sm"><Send className="w-3.5 h-3.5" /> Mark Sent</button>
          )}
          {/* View Original PDF if uploaded via AI Scanner */}
          {invoice.sourceFile && (
            <a
              href={`http://localhost:5000/api/v1/uploads/${invoice.sourceFile}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline btn-sm"
            >
              <FileDown className="w-3.5 h-3.5" /> View Original PDF
            </a>
          )}
          {['sent', 'overdue', 'partially_paid'].includes(invoice.status) && (
            <button onClick={handleGenerateReminder} className="btn-outline btn-sm"><Copy className="w-3.5 h-3.5" /> Reminder Draft</button>
          )}
          {invoice.status !== 'paid' && outstanding > 0 && (
            <button onClick={() => setPaymentOpen(true)} className="btn-primary btn-sm"><CreditCard className="w-3.5 h-3.5" /> Record Payment</button>
          )}
          {invoice.status !== 'paid' && (
            <Link to={`/invoices/${id}/edit`} className="btn-outline btn-sm"><Edit2 className="w-3.5 h-3.5" /> Edit</Link>
          )}
          {invoice.status !== 'paid' && (
            <button onClick={() => setDeleteOpen(true)} className="btn-danger btn-sm"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
          )}
        </div>
      </div>

      {/* Invoice card - printable */}
      <div className="card p-8 print-card">
        {/* Business + Customer headers */}
        <div className="flex flex-col sm:flex-row justify-between gap-6 mb-8">
          <div>
            <p className="text-lg font-bold text-slate-900">{user?.businessName || user?.name}</p>
            {user?.businessAddress && <p className="text-sm text-slate-500 mt-0.5 whitespace-pre-line">{user.businessAddress}</p>}
            {user?.gstin && <p className="text-sm text-slate-500">GSTIN: {user.gstin}</p>}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary-700">INVOICE</p>
            <p className="text-sm text-slate-500 mt-1">#{invoice.invoiceNumber}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 p-4 bg-slate-50 rounded-xl">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Bill To</p>
            <p className="text-sm font-semibold">{invoice.customerSnapshot?.name}</p>
            <p className="text-xs text-slate-500">{invoice.customerSnapshot?.email}</p>
            {invoice.customerSnapshot?.gstin && <p className="text-xs text-slate-500">GSTIN: {invoice.customerSnapshot.gstin}</p>}
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Issue Date</p>
            <p className="text-sm font-medium">{formatDate(invoice.issueDate)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Due Date</p>
            <p className="text-sm font-medium">{formatDate(invoice.dueDate)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Status</p>
            <StatusBadge status={invoice.status} />
          </div>
        </div>

        {/* Line items */}
        <div className="table-container mb-6">
          <table className="table">
            <thead>
              <tr>
                <th>Description</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Unit Price</th>
                <th className="text-right">Tax %</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems?.map((item, i) => (
                <tr key={i}>
                  <td>
                    <p className="font-medium">{item.description}</p>
                    {item.hsnCode && <p className="text-xs text-slate-400">HSN: {item.hsnCode}</p>}
                  </td>
                  <td className="text-right">{item.quantity}</td>
                  <td className="text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="text-right">{item.taxRate}%</td>
                  <td className="text-right font-medium">{formatCurrency(item.amount + item.taxAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{formatCurrency(invoice.subtotal)}</span></div>
            <div className="flex justify-between text-slate-600"><span>Tax</span><span>{formatCurrency(invoice.taxTotal)}</span></div>
            {invoice.discountAmount > 0 && (
              <div className="flex justify-between text-red-500"><span>Discount</span><span>-{formatCurrency(invoice.discountAmount)}</span></div>
            )}
            <div className="border-t pt-2 flex justify-between font-bold text-base text-slate-900">
              <span>Grand Total</span><span>{formatCurrency(invoice.grandTotal)}</span>
            </div>
            {invoice.paidAmount > 0 && (
              <>
                <div className="flex justify-between text-emerald-600"><span>Paid</span><span>{formatCurrency(invoice.paidAmount)}</span></div>
                <div className="flex justify-between font-semibold text-amber-600 border-t pt-2">
                  <span>Outstanding</span><span>{formatCurrency(outstanding)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Notes */}
        {(invoice.notes || invoice.terms) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-200">
            {invoice.notes && (
              <div><p className="text-xs font-semibold text-slate-400 uppercase mb-1">Notes</p><p className="text-sm text-slate-600 whitespace-pre-line">{invoice.notes}</p></div>
            )}
            {invoice.terms && (
              <div><p className="text-xs font-semibold text-slate-400 uppercase mb-1">Terms</p><p className="text-sm text-slate-600 whitespace-pre-line">{invoice.terms}</p></div>
            )}
          </div>
        )}
      </div>

      {/* Payments */}
      {payments.length > 0 && (
        <div className="card p-5 no-print">
          <h2 className="font-semibold text-slate-700 mb-3">Payment History</h2>
          <div className="space-y-2">
            {payments.map((p) => (
              <div key={p._id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-slate-700">{formatDate(p.paymentDate)}</p>
                  <p className="text-xs text-slate-400">{p.paymentMethod.replace('_', ' ')} {p.referenceNumber ? `• Ref: ${p.referenceNumber}` : ''}</p>
                </div>
                <p className="text-sm font-semibold text-emerald-600">{formatCurrency(p.amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Invoice"
        message="This invoice will be permanently deleted."
        confirmLabel="Delete Invoice"
      />

      <AddPaymentModal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        invoiceId={id}
        outstanding={outstanding}
        onSuccess={() => { setPaymentOpen(false); fetchInvoice(); }}
      />

      <ReminderModal
        open={reminderOpen}
        onClose={() => setReminderOpen(false)}
        reminder={reminderData}
      />
    </div>
  );
}
