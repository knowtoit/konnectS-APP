import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { validateReason } from './adminLogic';
import { friendlyError } from './uiHelpers';

// ---------------------------------------------------------------- small pieces
export type Tone = 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'violet';
const TONES: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-600',
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-rose-50 text-rose-700',
  blue: 'bg-blue-50 text-blue-700',
  violet: 'bg-violet-50 text-violet-700',
};

export function Badge({ tone = 'slate', children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${TONES[tone]}`}>{children}</span>;
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-xs font-bold text-slate-400" role="status">
      <Loader2 size={16} className="animate-spin" /> {label}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-slate-200 bg-white py-10 text-center text-xs font-bold text-slate-400">{children}</p>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-xs font-bold text-rose-700">
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <div className="flex-1">
        <p>{message}</p>
        {onRetry && <button type="button" onClick={onRetry} className="mt-2 cursor-pointer underline">Try again</button>}
      </div>
    </div>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">{children}</div>;
}

export function Btn({
  children, onClick, tone = 'default', disabled, title, type = 'button',
}: { children: React.ReactNode; onClick?: () => void; tone?: 'default' | 'primary' | 'danger'; disabled?: boolean; title?: string; type?: 'button' | 'submit' }) {
  const styles = {
    default: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    primary: 'bg-slate-900 text-white hover:bg-slate-800',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
  }[tone];
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title} className={`cursor-pointer rounded-xl px-3.5 py-2 text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${styles}`}>
      {children}
    </button>
  );
}

export function RefreshButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Refresh" className="cursor-pointer rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50">
      <RefreshCw size={14} />
    </button>
  );
}

// ---------------------------------------------------------------- confirmation dialog
export interface ActionDialogProps {
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  /** The audit action name; decides whether a written reason is required */
  action: string;
  reasonLabel?: string;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}

export function ActionDialog({ title, description, confirmLabel, tone = 'primary', action, reasonLabel = 'Reason', onConfirm, onClose }: ActionDialogProps) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateReason(action, reason);
    if (problem) { setError(problem); return; }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/60 p-4" role="dialog" aria-modal="true" aria-labelledby="admin-dialog-title">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-2xl">
        <h2 id="admin-dialog-title" className="text-lg font-black tracking-tight text-slate-900">{title}</h2>
        {description && <div className="text-xs font-medium leading-relaxed text-slate-500">{description}</div>}
        <div className="space-y-1.5">
          <label htmlFor="admin-dialog-reason" className="text-[10px] font-black uppercase tracking-widest text-slate-400">{reasonLabel}</label>
          <textarea
            id="admin-dialog-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} autoFocus
            className="w-full resize-none rounded-2xl bg-slate-50 p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="This is saved in the audit log."
          />
        </div>
        {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Btn onClick={onClose} disabled={busy}>Cancel</Btn>
          <Btn type="submit" tone={tone === 'danger' ? 'danger' : 'primary'} disabled={busy}>{busy ? 'Working…' : confirmLabel}</Btn>
        </div>
      </form>
    </div>
  );
}
