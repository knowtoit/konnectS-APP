import { fetchAudit } from './adminService';
import { actionLabel } from './adminLogic';
import { Badge, Card, EmptyState, ErrorState, RefreshButton, Spinner } from './ui';
import { formatDate, useLoader } from './uiHelpers';
import type { TabProps } from './types';

export function AuditTab(_props: TabProps) {
  const { data, error, loading, reload } = useLoader(fetchAudit);
  if (loading) return <Spinner />;
  if (error || !data) return <ErrorState message={error ?? 'Could not load the audit log.'} onRetry={reload} />;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-400">Every admin action, newest first. Entries can't be edited or deleted.</p>
        <RefreshButton onClick={reload} />
      </div>
      {data.rows.length === 0 ? <EmptyState>No admin actions yet.</EmptyState> : data.rows.map(({ id, data: e }) => (
        <Card key={id}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black text-slate-900">{actionLabel(String(e.action))}</p>
            <Badge>{String(e.targetType || '')}</Badge>
            <span className="ml-auto text-[10px] font-bold text-slate-400">{formatDate(e.createdAt)}</span>
          </div>
          <p className="mt-1 text-xs font-medium text-slate-600">{e.targetLabel || e.targetId}</p>
          {e.reason && <p className="mt-1 rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-500">“{e.reason}”</p>}
          <p className="mt-2 text-[10px] font-medium text-slate-300">By {e.adminEmail || e.adminUid}</p>
        </Card>
      ))}
    </div>
  );
}
