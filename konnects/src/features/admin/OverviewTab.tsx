import { AlertTriangle, ChevronRight } from 'lucide-react';
import { fetchCounts, type Counts } from './adminService';
import { Card, ErrorState, RefreshButton, Spinner } from './ui';
import { useLoader } from './uiHelpers';
import type { TabProps } from './types';

const fmt = (n: number | null) => (n === null ? 'n/a' : n.toLocaleString('en-GB'));

function Stat({ label, value, hint }: { label: string; value: number | null; hint?: string }) {
  return (
    <Card>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-900">{fmt(value)}</p>
      {hint && <p className="mt-1 text-[10px] font-medium text-slate-400">{hint}</p>}
    </Card>
  );
}

function Attention({ label, count, onClick }: { label: string; count: number | null; onClick: () => void }) {
  if (!count) return null;
  return (
    <button type="button" onClick={onClick} className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-xs font-black text-amber-800 hover:bg-amber-100">
      <span className="flex items-center gap-2"><AlertTriangle size={14} /> {count} {label}</span>
      <ChevronRight size={14} />
    </button>
  );
}

export function OverviewTab({ goTo }: TabProps) {
  const { data, error, loading, reload } = useLoader<Counts>(fetchCounts);
  if (loading) return <Spinner />;
  if (error || !data) return <ErrorState message={error ?? 'Could not load the overview.'} onRetry={reload} />;

  const nothingToDo = !data.pendingVerifications && !data.activeSos && !data.openReports;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Needs attention</h2>
        <RefreshButton onClick={reload} />
      </div>

      <div className="space-y-2">
        <Attention label="active SOS alert(s)" count={data.activeSos} onClick={() => goTo('reports')} />
        <Attention label="worker(s) waiting for verification" count={data.pendingVerifications} onClick={() => goTo('verifications')} />
        <Attention label="open report(s)" count={data.openReports} onClick={() => goTo('reports')} />
        {nothingToDo && <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">All clear. Nothing is waiting for you.</p>}
      </div>

      <h2 className="pt-2 text-sm font-black uppercase tracking-widest text-slate-500">At a glance</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Users" value={data.users} />
        <Stat label="Workers" value={data.workers} />
        <Stat label="Live listings" value={data.liveListings} />
        <Stat label="Blocked accounts" value={data.blockedUsers} hint="Suspended or banned" />
      </div>

      <Card>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">How access works</p>
        <p className="mt-1.5 text-xs font-medium leading-relaxed text-slate-500">
          Admins are the people listed in the <code className="rounded bg-slate-100 px-1">admins</code> collection in Firebase (Console → Firestore). Only the
          project owner can change that list; the app cannot. Every change you make here is saved in the Audit log with your name and the time, and can't be edited afterwards.
        </p>
      </Card>
    </div>
  );
}
