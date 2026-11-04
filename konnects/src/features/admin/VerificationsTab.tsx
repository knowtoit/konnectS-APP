import { useState } from 'react';
import { fetchPendingVerifications, setVerification, type Row } from './adminService';
import { displayName, safeImageSrc } from './adminLogic';
import { ActionDialog, Badge, Btn, Card, EmptyState, ErrorState, RefreshButton, Spinner, type ActionDialogProps } from './ui';
import { formatDate, useLoader } from './uiHelpers';
import type { TabProps } from './types';

type Dialog = Omit<ActionDialogProps, 'onClose'>;

export function VerificationsTab({ toast }: TabProps) {
  const { data, error, loading, reload } = useLoader(fetchPendingVerifications);
  const [dialog, setDialog] = useState<Dialog | null>(null);

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorState message={error ?? 'Could not load the queue.'} onRetry={reload} />;

  const decide = (row: Row, status: 'verified' | 'rejected') => {
    const label = displayName(row.data);
    setDialog({
      title: status === 'verified' ? `Approve ${label}?` : `Reject ${label}?`,
      description: status === 'verified' ? 'They will show as a verified worker.' : 'Explain what was wrong. This is saved in the audit log.',
      confirmLabel: status === 'verified' ? 'Approve' : 'Reject',
      tone: status === 'verified' ? 'primary' : 'danger',
      action: `verification_${status}`,
      reasonLabel: status === 'verified' ? 'Note (optional)' : 'Reason',
      onConfirm: async (reason) => {
        await setVerification({ id: row.id, label }, status, reason);
        toast.success(status === 'verified' ? `${label} is now verified.` : `${label}'s verification was rejected.`);
        reload();
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-400">{data.rows.length} waiting</p>
        <RefreshButton onClick={reload} />
      </div>
      {data.rows.length === 0 ? <EmptyState>No one is waiting for verification.</EmptyState> : (
        <div className="space-y-3">
          {data.rows.map((row) => {
            const u = row.data;
            const photo = safeImageSrc(u.verificationPhoto);
            const docs: string[] = Array.isArray(u.documents) ? u.documents.map((d: any) => (typeof d === 'string' ? d : d?.name)).filter(Boolean) : [];
            return (
              <Card key={row.id}>
                <div className="flex gap-4">
                  {photo ? <img src={photo} alt="Verification photo" className="h-20 w-20 shrink-0 rounded-2xl border border-slate-100 object-cover" /> : (
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-[10px] font-bold text-slate-300">No photo</div>
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-sm font-black text-slate-900">{displayName(u)}</p>
                    <p className="truncate text-[11px] font-medium text-slate-400">{u.email}{u.mobileNumber ? ` · ${u.mobileNumber}` : ''}</p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <Badge tone="violet">{u.workerType || 'worker'}</Badge>
                      {u.verificationStep != null && <Badge tone="blue">Step {String(u.verificationStep)}</Badge>}
                      <Badge>Joined {formatDate(u.createdAt)}</Badge>
                    </div>
                    <p className="pt-1 text-[11px] font-medium text-slate-500">
                      Documents: {docs.length ? docs.join(', ') : <span className="text-rose-500">none uploaded</span>}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
                  <Btn tone="danger" onClick={() => decide(row, 'rejected')}>Reject</Btn>
                  <Btn tone="primary" onClick={() => decide(row, 'verified')}>Approve</Btn>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {dialog && <ActionDialog {...dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}
