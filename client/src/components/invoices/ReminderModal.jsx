import { X, Copy, CheckCheck } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function ReminderModal({ open, onClose, reminder }) {
  const [copied, setCopied] = useState(false);
  if (!open || !reminder) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(reminder.body).then(() => {
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-modal w-full max-w-lg p-6 z-10 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h2 className="text-lg font-semibold">Payment Reminder Draft</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex-shrink-0">
          <p className="text-xs text-amber-700">This is a draft. Review and send manually via your email client. Do not send without reviewing.</p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">To</p>
            <p className="text-sm text-slate-700">{reminder.to || '(no email on file)'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Subject</p>
            <p className="text-sm text-slate-700 font-medium">{reminder.subject}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Body</p>
            <pre className="text-sm text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200 whitespace-pre-wrap font-sans">{reminder.body}</pre>
          </div>
        </div>

        <div className="flex gap-3 mt-4 flex-shrink-0">
          <button onClick={onClose} className="btn-outline flex-1">Close</button>
          <button onClick={handleCopy} className="btn-primary flex-1">
            {copied ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Text'}
          </button>
        </div>
      </div>
    </div>
  );
}
