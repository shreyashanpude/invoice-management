import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { invoiceAPI, customerAPI } from '../../services/api';
import { formatCurrency, formatDateInput, getErrorMessage, paiseToRupees } from '../../utils/formatters';
import toast from 'react-hot-toast';
import LoadingSpinner, { InlineLoader } from '../../components/ui/LoadingSpinner';

const lineItemSchema = z.object({
  description: z.string().min(1, 'Required').max(500),
  quantity: z.coerce.number().min(0.001, 'Must be > 0'),
  unitPrice: z.coerce.number().min(0, 'Must be ≥ 0'),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  hsnCode: z.string().max(20).optional().default(''),
});

const schema = z.object({
  customerId: z.string().min(1, 'Please select a customer'),
  issueDate: z.string().min(1, 'Issue date is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  lineItems: z.array(lineItemSchema).min(1, 'Add at least one line item'),
  discountType: z.enum(['percentage', 'fixed']).default('percentage'),
  discountValue: z.coerce.number().min(0).default(0),
  notes: z.string().max(2000).optional().default(''),
  terms: z.string().max(2000).optional().default(''),
  status: z.enum(['draft', 'sent']).default('draft'),
});

export default function InvoiceForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  const {
    register, control, handleSubmit, watch, reset, setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      lineItems: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0, hsnCode: '' }],
      discountType: 'percentage',
      discountValue: 0,
      status: 'draft',
      issueDate: formatDateInput(new Date()),
      dueDate: formatDateInput(new Date(Date.now() + 30 * 86400000)),
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' });
  const watchItems = watch('lineItems');
  const watchDiscountType = watch('discountType');
  const watchDiscountValue = watch('discountValue');

  // Computed totals
  const subtotal = watchItems?.reduce((sum, item) => {
    return sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0);
  }, 0) || 0;

  const taxTotal = watchItems?.reduce((sum, item) => {
    const amt = (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0);
    return sum + amt * ((parseFloat(item.taxRate) || 0) / 100);
  }, 0) || 0;

  let discountAmount = 0;
  if (watchDiscountType === 'percentage') {
    discountAmount = subtotal * ((parseFloat(watchDiscountValue) || 0) / 100);
  } else {
    discountAmount = parseFloat(watchDiscountValue) || 0;
  }

  const grandTotal = subtotal + taxTotal - discountAmount;

  useEffect(() => {
    customerAPI.getAll({ limit: 100 }).then((r) => setCustomers(r.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      invoiceAPI.getById(id).then((r) => {
        const inv = r.data.data.invoice;
        reset({
          customerId: inv.customer?._id || inv.customer,
          issueDate: formatDateInput(inv.issueDate),
          dueDate: formatDateInput(inv.dueDate),
          lineItems: inv.lineItems.map((li) => ({
            description: li.description,
            quantity: li.quantity,
            unitPrice: paiseToRupees(li.unitPrice),
            taxRate: li.taxRate,
            hsnCode: li.hsnCode || '',
          })),
          discountType: inv.discountType || 'percentage',
          discountValue: inv.discountValue || 0,
          notes: inv.notes || '',
          terms: inv.terms || '',
          status: ['draft', 'sent'].includes(inv.status) ? inv.status : 'sent',
        });
      }).catch(() => toast.error('Could not load invoice')).finally(() => setLoading(false));
    }
  }, [id, isEdit, reset]);

  const checkDuplicate = async (data) => {
    try {
      const res = await invoiceAPI.checkDuplicate({
        customerId: data.customerId,
        grandTotal: grandTotal.toFixed(2),
        issueDate: data.issueDate,
        ...(isEdit ? { excludeId: id } : {}),
      });
      if (res.data.data.isDuplicate) {
        setDuplicateWarning(res.data.data.duplicates);
        return true;
      }
    } catch {}
    return false;
  };

  const onSubmit = async (data, force = false) => {
    if (!force) {
      const isDup = await checkDuplicate(data);
      if (isDup) return;
    }

    setSubmitting(true);
    try {
      const payload = { ...data };
      if (isEdit) {
        await invoiceAPI.update(id, payload);
        toast.success('Invoice updated successfully');
      } else {
        const res = await invoiceAPI.create(payload);
        toast.success('Invoice created successfully');
        navigate(`/invoices/${res.data.data.invoice._id}`);
        return;
      }
      navigate(`/invoices/${id}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <InlineLoader text="Loading invoice…" />;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">{isEdit ? 'Edit Invoice' : 'Create Invoice'}</h1>
          <p className="page-subtitle">All totals are calculated server-side for accuracy</p>
        </div>
      </div>

      {/* Duplicate warning */}
      {duplicateWarning && (
        <div className="card p-4 border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">Possible Duplicate Detected</p>
              <p className="text-xs text-amber-700 mt-1">
                A similar invoice exists: {duplicateWarning.map((d) => d.invoiceNumber).join(', ')}. 
                Do you want to proceed anyway?
              </p>
              <div className="flex gap-2 mt-3">
                <button onClick={() => { setDuplicateWarning(null); handleSubmit((d) => onSubmit(d, true))(); }} className="btn-primary btn-sm">Save Anyway</button>
                <button onClick={() => setDuplicateWarning(null)} className="btn-outline btn-sm">Review</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit((d) => onSubmit(d, false))} noValidate>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Main form */}
          <div className="lg:col-span-2 space-y-5">
            {/* Customer + dates */}
            <div className="card p-5 space-y-4">
              <h2 className="font-semibold text-slate-700">Invoice Details</h2>
              <div>
                <label className="label">Customer <span className="text-red-400">*</span></label>
                <select className={`select ${errors.customerId ? 'input-error' : ''}`} {...register('customerId')}>
                  <option value="">Select a customer…</option>
                  {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
                {errors.customerId && <p className="error-text">{errors.customerId.message}</p>}
                {customers.length === 0 && (
                  <p className="text-xs text-slate-400 mt-1">No customers yet. <a href="/customers" className="text-primary-600 hover:underline">Add one first</a>.</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Issue Date <span className="text-red-400">*</span></label>
                  <input type="date" className={`input ${errors.issueDate ? 'input-error' : ''}`} {...register('issueDate')} />
                  {errors.issueDate && <p className="error-text">{errors.issueDate.message}</p>}
                </div>
                <div>
                  <label className="label">Due Date <span className="text-red-400">*</span></label>
                  <input type="date" className={`input ${errors.dueDate ? 'input-error' : ''}`} {...register('dueDate')} />
                  {errors.dueDate && <p className="error-text">{errors.dueDate.message}</p>}
                </div>
              </div>
              <div>
                <label className="label">Status</label>
                <select className="select" {...register('status')}>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                </select>
              </div>
            </div>

            {/* Line items */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-700">Line Items</h2>
                <button type="button" onClick={() => append({ description: '', quantity: 1, unitPrice: 0, taxRate: 0, hsnCode: '' })} className="btn-outline btn-sm">
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
              </div>
              {errors.lineItems?.root && <p className="error-text mb-2">{errors.lineItems.root.message}</p>}

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex gap-2 mb-2">
                      <div className="flex-1">
                        <label className="label text-xs">Description</label>
                        <input type="text" placeholder="Item description" className={`input text-sm ${errors.lineItems?.[index]?.description ? 'input-error' : ''}`} {...register(`lineItems.${index}.description`)} />
                        {errors.lineItems?.[index]?.description && <p className="error-text">{errors.lineItems[index].description.message}</p>}
                      </div>
                      {fields.length > 1 && (
                        <button type="button" onClick={() => remove(index)} className="mt-5 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="label text-xs">Qty</label>
                        <input type="number" step="0.001" min="0.001" className={`input text-sm ${errors.lineItems?.[index]?.quantity ? 'input-error' : ''}`} {...register(`lineItems.${index}.quantity`)} />
                      </div>
                      <div>
                        <label className="label text-xs">Unit Price (₹)</label>
                        <input type="number" step="0.01" min="0" className={`input text-sm ${errors.lineItems?.[index]?.unitPrice ? 'input-error' : ''}`} {...register(`lineItems.${index}.unitPrice`)} />
                      </div>
                      <div>
                        <label className="label text-xs">Tax %</label>
                        <input type="number" step="0.01" min="0" max="100" className="input text-sm" {...register(`lineItems.${index}.taxRate`)} />
                      </div>
                      <div>
                        <label className="label text-xs">HSN Code</label>
                        <input type="text" className="input text-sm" {...register(`lineItems.${index}.hsnCode`)} />
                      </div>
                    </div>
                    <div className="text-right mt-1.5 text-xs text-slate-500">
                      Amount: {formatCurrency(
                        Math.round((parseFloat(watchItems[index]?.quantity) || 0) * (parseFloat(watchItems[index]?.unitPrice) || 0) * 100)
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes & terms */}
            <div className="card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Notes</label>
                <textarea rows={3} className="textarea" placeholder="Payment instructions, thank you note…" {...register('notes')} />
              </div>
              <div>
                <label className="label">Terms & Conditions</label>
                <textarea rows={3} className="textarea" placeholder="Payment terms, late fee policy…" {...register('terms')} />
              </div>
            </div>
          </div>

          {/* Summary panel */}
          <div className="space-y-4">
            <div className="card p-5 sticky top-4">
              <h2 className="font-semibold text-slate-700 mb-4">Summary</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span><span>{formatCurrency(Math.round(subtotal * 100))}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tax</span><span>{formatCurrency(Math.round(taxTotal * 100))}</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-600">
                    <span>Discount</span>
                    <span className="text-red-500">-{formatCurrency(Math.round(discountAmount * 100))}</span>
                  </div>
                  <div className="flex gap-2">
                    <select className="select text-xs py-1" {...register('discountType')}>
                      <option value="percentage">%</option>
                      <option value="fixed">₹ Fixed</option>
                    </select>
                    <input type="number" step="0.01" min="0" className="input text-xs py-1 w-20" {...register('discountValue')} />
                  </div>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-900 text-base">
                  <span>Total</span>
                  <span>{formatCurrency(Math.round(Math.max(0, grandTotal) * 100))}</span>
                </div>
              </div>

              <p className="text-xs text-slate-400 mt-3 text-center">
                Final totals are recalculated on the server
              </p>

              <div className="mt-4 space-y-2">
                <button type="submit" className="btn-primary w-full" disabled={submitting}>
                  {submitting ? <LoadingSpinner size="sm" /> : null}
                  {submitting ? 'Saving…' : isEdit ? 'Update Invoice' : 'Create Invoice'}
                </button>
                <button type="button" onClick={() => navigate(-1)} className="btn-outline w-full" disabled={submitting}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
