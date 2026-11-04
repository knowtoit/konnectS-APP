import { useState } from 'react';
import { fetchReports, fetchSosAlerts, resolveSos, setReportStatus, type Row } from './adminService';
import { reportStatusOf, safeImageSrc, type ReportStatus } from './adminLogic';
import { Badge, Btn, Card, EmptyState, ErrorState, RefreshButton, Spinner, type Tone } from './ui';
import { formatDate, friendlyError, useLoader } from './uiHelpers';
import type { TabProps } from './types';

const STATUS_TONE: Record<ReportStatus, Tone> = { open: 'amber', investigating: 'blue', resolved: 'green' };
const FILTERS: { id: ReportStatus | 'all'; label: string }[] = [
  { id: 'open', label: 'Open' }, { id: 'investigating', label: 'Investigating' }, { id: 'resolved', label: 'Resolved' }, { id: 'all', label: 'All' },
];

function ReportCard({ row, onSet }: { row: Row; onSet: (row: Row, status: ReportStatus) => void }) {
  const [expanded, setExpanded] = useState(false);
  const r = row.data;
  const status = reportStatusOf(r);
  const long = typeof r.description === 'string' && r.description.length > 220;
  const photos: string[] = (Array.isArray(r.evidencePhotos) ? r.evidencePhotos : []).map(safeImageSrc).filter((x: string | null): x is string => !!x).slice(0, 3);
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[status]}>{status}</Badge>
        {r.type && <Badge tone={r.type === 'bug' ? 'red' : 'slate'}>{String(r.type)}</Badge>}
        {r.severity && <Badge tone="amber">{String(r.severity)}</Badge>}
        <span className="ml-auto text-[10px] font-bold text-slate-400">{formatDate(r.createdAt)}</span>
      </div>
      <p className="mt-2 text-sm font-black text-slate-900">{r.subject || '(no subject)'}</p>
      <p className="text-[11px] font-medium text-slate-400">From {r.username || 'unknown'}{r.email ? ` · ${r.email}` : ''}</p>
      <p className="mt-2 whitespace-pre-wrap text-xs font-medium leading-relaxed text-slate-600">
        {expanded || !long ? r.description : `${String(r.description).slice(0, 220)}…`}
      </p>
      {long && <button type="button" onClick={() => setExpanded((e) => !e)} className="mt-1 cursor-pointer text-[11px] font-bold text-indigo-600">{expanded ? 'Show less' : 'Show more'}</button>}
      {photos.length > 0 && (
        <div className="mt-3 flex gap-2">
          {photos.map((src, i) => <img key={i} src={src} alt={`Evidence ${i + 1}`} className="h-16 w-16 rounded-xl border border-slate-100 object-cover" />)}
        </div>
      )}
      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
        {status === 'open' && <Btn onClick={() => onSet(row, 'investigating')}>Investigate</Btn>}
        {status !== 'resolved' && <Btn tone="primary" onClick={() => onSet(row, 'resolved')}>Resolve</Btn>}
        {status !== 'open' && <Btn onClick={() => onSet(row, 'open')}>Reopen</Btn>}
      </div>
    </Card>
  );
}

function ReportsList({ toast }: Pick<TabProps, 'toast'>) {
  const { data, error, loading, reload } = useLoader(fetchReports);
  const [filter, setFilter] = useState<ReportStatus | 'all'>('open');
  const [overrides, setOverrides] = useState<Record<string, ReportStatus>>({});

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorState message={error ?? 'Could not load reports.'} onRetry={reload} />;

  const rows = data.rows.map((r) => (overrides[r.id] ? { ...r, data: { ...r.data, status: overrides[r.id] } } : r));
  const shown = rows.filter((r) => filter === 'all' || reportStatusOf(r.data) === filter);

  const set = async (row: Row, status: ReportStatus) => {
    try {
      await setReportStatus({ id: row.id, label: String(row.data.subject || row.id) }, status);
      setOverrides((o) => ({ ...o, [row.id]: status }));
      toast.success(status === 'resolved' ? 'Report resolved.' : status === 'open' ? 'Report reopened.' : 'Marked as investigating.');
    } catch (err) {
      toast.error(friendlyError(err));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" onClick={() => setFilter(f.id)} aria-pressed={filter === f.id}
            className={`cursor-pointer whitespace-nowrap rounded-full px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wider ${filter === f.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>
            {f.label}
          </button>
        ))}
        <span className="ml-auto"><RefreshButton onClick={reload} /></span>
      </div>
      {shown.length === 0 ? <EmptyState>No {filter === 'all' ? '' : filter} reports.</EmptyState> : shown.map((r) => <ReportCard key={r.id} row={r} onSet={set} />)}
      <p className="text-center text-[10px] font-medium text-slate-300">Showing the 50 most recent reports.</p>
    </div>
  );
}

function SosList({ toast }: Pick<TabProps, 'toast'>) {
  const { data, error, loading, reload } = useLoader(fetchSosAlerts);
  const [resolved, setResolved] = useState<Record<string, boolean>>({});
  if (loading) return <Spinner />;
  if (error || !data) return <ErrorState message={error ?? 'Could not load SOS alerts.'} onRetry={reload} />;

  const resolve = async (row: Row) => {
    try {
      await resolveSos({ id: row.id, label: String(row.data.userName || row.id) });
      setResolved((r) => ({ ...r, [row.id]: true }));
      toast.success('SOS alert marked as resolved.');
    } catch (err) {
      toast.error(friendlyError(err));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><RefreshButton onClick={reload} /></div>
      {data.rows.length === 0 ? <EmptyState>No SOS alerts.</EmptyState> : data.rows.map((row) => {
        const a = row.data;
        const isActive = a.status === 'active' && !resolved[row.id];
        const lat = a.coords?.lat, lng = a.coords?.lng;
        const hasCoords = typeof lat === 'number' && typeof lng === 'number';
        const phone = typeof a.contactPhone === 'string' ? a.contactPhone.replace(/[^\d+]/g, '') : '';
        return (
          <Card key={row.id}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={isActive ? 'red' : 'green'}>{isActive ? 'Active' : 'Resolved'}</Badge>
              <span className="ml-auto text-[10px] font-bold text-slate-400">{formatDate(a.triggeredAt)}</span>
            </div>
            <p className="mt-2 text-sm font-black text-slate-900">{a.userName || 'Unknown user'}</p>
            <p className="text-[11px] font-medium text-slate-500">Emergency contact: {a.contactName || '—'}{phone ? <> · <a className="font-bold text-indigo-600 underline" href={`tel:${phone}`}>{a.contactPhone}</a></> : null}</p>
            <p className="text-[11px] font-medium text-slate-500">{a.address || 'No address'}</p>
            <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
              {hasCoords && <a className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50" href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noopener noreferrer">Open map</a>}
              {isActive && <Btn tone="primary" onClick={() => resolve(row)}>Mark resolved</Btn>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export function ReportsTab(props: TabProps) {
  const [view, setView] = useState<'reports' | 'sos'>('reports');
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-full bg-slate-100 p-1" role="tablist">
        {(['reports', 'sos'] as const).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
            className={`cursor-pointer rounded-full px-4 py-1.5 text-[11px] font-black uppercase tracking-wider ${view === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
            {v === 'reports' ? 'Bug reports & feedback' : 'SOS alerts'}
          </button>
        ))}
      </div>
      {view === 'reports' ? <ReportsList toast={props.toast} /> : <SosList toast={props.toast} />}
    </div>
  );
}
