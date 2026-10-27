import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Sparkles, AlertTriangle, CheckCircle, X, FileText, Edit3 } from 'lucide-react';
import { aiAPI, customerAPI, invoiceAPI } from '../services/api';
import { getErrorMessage, formatDateInput } from '../utils/formatters';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useEffect } from 'react';

export default function AIScanner() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(null);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    customerAPI.getAll({ limit: 100 }).then((r) => setCustomers(r.data.data || [])).catch(() => {});
  }, []);

  const handleFile = (f) => {
    if (!f) return;
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowed.includes(f.type)) {
      toast.error('Only PDF, JPG, JPEG, PNG files are supported');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error('File size must be under 10MB');
      return;
    }
    setFile(f);
    setExtracted(null);
    setForm(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleExtract = async () => {
    if (!file) return;
    setExtracting(true);
    setExtracted(null);
    setForm(null);
    try {
      const fd = new FormData();
      fd.append('invoice', file);
      const res = await aiAPI.extractInvoice(fd);
      const data = res.data.data.extractedData;
      setExtracted(data);
      const savedFileName = res.data.data.savedFileName || null;
      // Pre-fill editable form
      setForm({
        invoiceNumber: data.invoiceNumber || '',
        invoiceDate: data.invoiceDate ? formatDateInput(new Date(data.invoiceDate)) : formatDateInput(new Date()),
        dueDate: data.dueDate ? formatDateInput(new Date(data.dueDate)) : formatDateInput(new Date(Date.now() + 30 * 86400000)),
        customerName: data.customerName || '',
        customerId: '',
        supplierName: data.supplierName || '',
        notes: data.notes || '',
        savedFileName,  // store for linking to invoice
        lineItems: (data.lineItems || [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0 }]).map((li) => ({
          description: li.description || '',
          quantity: li.quantity || 1,
          unitPrice: li.unitPrice || 0,
          taxRate: li.taxRate || 0,
          hsnCode: li.hsnCode || '',
        })),
      });
      toast.success('Invoice data extracted successfully');
    } catch (err) {
      const msg = getErrorMessage(err);
      toast.error(msg);
    } finally {
      setExtracting(false);
    }
  };

  const updateForm = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const updateLineItem = (i, key, value) => {
    setForm((f) => {
      const items = [...f.lineItems];
      items[i] = { ...items[i], [key]: value };
      return { ...f, lineItems: items };
    });
  };
  const addLineItem = () => setForm((f) => ({ ...f, lineItems: [...f.lineItems, { description: '', quantity: 1, unitPrice: 0, taxRate: 0, hsnCode: '' }] }));
  const removeLineItem = (i) => setForm((f) => ({ ...f, lineItems: f.lineItems.filter((_, idx) => idx !== i) }));

  const validate = () => {
    const errs = {};
    if (!form.customerId) errs.customerId = 'Please select or create a customer';
    if (!form.invoiceDate) errs.invoiceDate = 'Invoice date required';
    if (!form.dueDate) errs.dueDate = 'Due date required';
    if (!form.lineItems.length) errs.lineItems = 'Add at least one line item';
    form.lineItems.forEach((li, i) => {
      if (!li.description) errs[`li_${i}_desc`] = 'Description required';
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) { toast.error('Please fix the errors before saving'); return; }
    setSaving(true);
    try {
      const res = await invoiceAPI.create({
        customerId: form.customerId,
        issueDate: form.invoiceDate,
        dueDate: form.dueDate,
        lineItems: form.lineItems,
        notes: form.notes,
        status: 'draft',
        sourceFile: form.savedFileName || '', // link uploaded PDF to invoice
      });
      toast.success('Invoice saved successfully');
      navigate('/invoices');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const confidence = extracted?.confidence;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><Sparkles className="w-6 h-6 text-secondary-600" />AI Invoice Scanner</h1>
          <p className="page-subtitle">Upload an invoice PDF or image to extract data automatically</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="p-4 rounded-xl bg-secondary-50 border border-secondary-200 text-sm text-secondary-700">
        <strong>How it works:</strong> Upload a PDF or image → AI extracts invoice fields → Review &amp; correct → Save as invoice.
        Always verify extracted data before saving. GST compliance is not officially verified.
      </div>

      {/* Upload area */}
      <div className="card p-5">
        <h2 className="font-semibold text-slate-700 mb-4">Upload Invoice</h2>
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-primary-500 bg-primary-50' : 'border-slate-300 hover:border-primary-400 hover:bg-slate-50'
          }`}
        >
          <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
          <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
          {file ? (
            <div className="flex items-center justify-center gap-2">
              <FileText className="w-4 h-4 text-primary-600" />
              <span className="text-sm font-medium text-primary-700">{file.name}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); setExtracted(null); setForm(null); }} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600">Drag &amp; drop or click to upload</p>
              <p className="text-xs text-slate-400 mt-1">PDF, JPG, JPEG, PNG — max 10MB</p>
            </>
          )}
        </div>

        {file && !extracted && (
          <button onClick={handleExtract} disabled={extracting} className="btn-secondary w-full mt-4">
            {extracting ? <><LoadingSpinner size="sm" /><span>Extracting with AI…</span></> : <><Sparkles className="w-4 h-4" /> Extract Invoice Data</>}
          </button>
        )}
      </div>

      {/* Extraction result */}
      {extracted && (
        <div className="card p-5 border-emerald-200">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <h2 className="font-semibold text-slate-700">Extraction Complete</h2>
            {confidence !== null && confidence !== undefined && (
              <span className={`badge ${confidence >= 0.7 ? 'badge-success' : confidence >= 0.5 ? 'badge-warning' : 'badge-danger'}`}>
                {Math.round(confidence * 100)}% confidence
              </span>
            )}
          </div>
          {extracted.warnings?.length > 0 && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-700 mb-1">Warnings</p>
                  {extracted.warnings.map((w, i) => <p key={i} className="text-xs text-amber-600">{w}</p>)}
                </div>
              </div>
            </div>
          )}
          {extracted.missingFields?.length > 0 && (
            <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-xs text-slate-500">Fields not found: <span className="font-medium">{extracted.missingFields.join(', ')}</span>. Please fill them manually.</p>
            </div>
          )}
        </div>
      )}

      {/* Editable review form */}
      {form && (
        <div className="card p-5 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <Edit3 className="w-4 h-4 text-primary-600" />
            <h2 className="font-semibold text-slate-700">Review &amp; Correct Extracted Data</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Supplier Name</label>
              <input type="text" className="input" value={form.supplierName} onChange={(e) => updateForm('supplierName', e.target.value)} />
            </div>
            <div>
              <label className="label">Customer Name (extracted)</label>
              <input type="text" className="input" value={form.customerName} onChange={(e) => updateForm('customerName', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Map to Customer <span className="text-red-400">*</span></label>
            <select className={`select ${errors.customerId ? 'input-error' : ''}`} value={form.customerId} onChange={(e) => updateForm('customerId', e.target.value)}>
              <option value="">Select a customer from your account…</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
            {errors.customerId && <p className="error-text">{errors.customerId.message || errors.customerId}</p>}
            <p className="text-xs text-slate-400 mt-1">
              Customer not found? <a href="/customers" className="text-primary-600 hover:underline">Add them first</a>.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Invoice Date</label>
              <input type="date" className={`input ${errors.invoiceDate ? 'input-error' : ''}`} value={form.invoiceDate} onChange={(e) => updateForm('invoiceDate', e.target.value)} />
            </div>
            <div>
              <label className="label">Due Date</label>
              <input type="date" className={`input ${errors.dueDate ? 'input-error' : ''}`} value={form.dueDate} onChange={(e) => updateForm('dueDate', e.target.value)} />
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="label mb-0">Line Items</label>
              <button type="button" onClick={addLineItem} className="btn-outline btn-sm text-xs">+ Add Item</button>
            </div>
            <div className="space-y-3">
              {form.lineItems.map((li, i) => (
                <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex gap-2 mb-2">
                    <div className="flex-1">
                      <input type="text" placeholder="Description" className={`input text-sm ${errors[`li_${i}_desc`] ? 'input-error' : ''}`} value={li.description} onChange={(e) => updateLineItem(i, 'description', e.target.value)} />
                    </div>
                    {form.lineItems.length > 1 && (
                      <button type="button" onClick={() => removeLineItem(i)} className="p-2 text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div><label className="label text-xs">Qty</label><input type="number" step="0.001" className="input text-sm" value={li.quantity} onChange={(e) => updateLineItem(i, 'quantity', e.target.value)} /></div>
                    <div><label className="label text-xs">Unit Price (₹)</label><input type="number" step="0.01" className="input text-sm" value={li.unitPrice} onChange={(e) => updateLineItem(i, 'unitPrice', e.target.value)} /></div>
                    <div><label className="label text-xs">Tax %</label><input type="number" step="0.01" className="input text-sm" value={li.taxRate} onChange={(e) => updateLineItem(i, 'taxRate', e.target.value)} /></div>
                    <div><label className="label text-xs">HSN</label><input type="text" className="input text-sm" value={li.hsnCode} onChange={(e) => updateLineItem(i, 'hsnCode', e.target.value)} /></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea rows={2} className="textarea" value={form.notes} onChange={(e) => updateForm('notes', e.target.value)} />
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => { setForm(null); setExtracted(null); setFile(null); }} className="btn-outline flex-1">Start Over</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
              {saving ? <LoadingSpinner size="sm" /> : null}
              {saving ? 'Saving…' : 'Save as Invoice'}
            </button>
          </div>
        </div>
      )}

      {/* Manual fallback */}
      {!form && (
        <div className="card p-5 text-center">
          <p className="text-sm text-slate-500 mb-3">Prefer to enter data manually?</p>
          <a href="/invoices/create" className="btn-outline btn-sm">Create Invoice Manually</a>
        </div>
      )}
    </div>
  );
}
