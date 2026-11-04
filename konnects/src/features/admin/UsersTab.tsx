import { useEffect, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import {
  fetchUsersPage, searchUsers, setModeration, setVerification, type Page, type Row,
} from './adminService';
import {
  MODERATION_LABELS, displayName, moderationOf, type ModerationStatus,
} from './adminLogic';
import { ActionDialog, Badge, Btn, Card, EmptyState, ErrorState, Spinner, type ActionDialogProps, type Tone } from './ui';
import { formatDate, friendlyError } from './uiHelpers';
import type { TabProps } from './types';

const MOD_TONE: Record<ModerationStatus, Tone> = { active: 'green', warned: 'amber', temp_blocked: 'red', perm_blocked: 'red' };
const VERIF_TONE: Record<string, Tone> = { verified: 'green', pending: 'amber', rejected: 'red', in_progress: 'blue', unverified: 'slate' };

type Dialog = Omit<ActionDialogProps, 'onClose'>;

function UserCard({ row, myUid, onAsk }: { row: Row; myUid: string; onAsk: (d: Dialog) => void; }) {
  const [open, setOpen] = useState(false);
  const u = row.data;
  const label = displayName(u);
  const target = { id: row.id, label };
  const mod = moderationOf(u);
  const verification = (u.verificationStatus as string) || 'unverified';
  const isSelf = row.id === myUid;

  const ask = (d: Dialog) => onAsk(d);
  const moderate = (status: ModerationStatus, title: string, confirmLabel: string, description: string, danger = false) =>
    ask({
      title, confirmLabel, tone: danger ? 'danger' : 'primary', action: `moderation_${status}`, description,
      reasonLabel: status === 'active' ? 'Note (optional)' : 'Reason (shown to the user)',
      onConfirm: (reason) => setModeration(target, status, reason),
    });
  const verify = (status: 'verified' | 'rejected' | 'unverified', title: string, confirmLabel: string, description: string, danger = false) =>
    ask({
      title, confirmLabel, tone: danger ? 'danger' : 'primary', action: `verification_${status}`, description,
      reasonLabel: status === 'rejected' ? 'Reason' : 'Note (optional)',
      onConfirm: (reason) => setVerification(target, status, reason),
    });

  return (
    <Card>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full cursor-pointer items-center gap-3 text-left">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-sm font-black text-indigo-600">{label.charAt(0).toUpperCase()}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-slate-900">{label}{isSelf && <span className="ml-2 text-[10px] font-bold text-slate-400">(you)</span>}</p>
          <p className="truncate text-[11px] font-medium text-slate-400">{u.email || 'no email'}{u.username ? ` · @${u.username}` : ''}</p>
        </div>
        <div className="hidden flex-wrap justify-end gap-1.5 sm:flex">
          {u.isWorker && <Badge tone="violet">Worker</Badge>}
          <Badge tone={VERIF_TONE[verification] ?? 'slate'}>{verification.replace('_', ' ')}</Badge>
          {mod !== 'active' && <Badge tone={MOD_TONE[mod]}>{MODERATION_LABELS[mod]}</Badge>}
        </div>
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap gap-1.5 sm:hidden">
            {u.isWorker && <Badge tone="violet">Worker</Badge>}
            <Badge tone={VERIF_TONE[verification] ?? 'slate'}>{verification.replace('_', ' ')}</Badge>
            {mod !== 'active' && <Badge tone={MOD_TONE[mod]}>{MODERATION_LABELS[mod]}</Badge>}
          </div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
            {[
              ['User ID', row.id], ['Joined', formatDate(u.createdAt)], ['Mobile', u.mobileNumber || '—'],
              ['Worker type', u.isWorker ? (u.workerType || 'other') : '—'], ['Logins', u.loginCount ?? '—'], ['Rating', u.rating != null ? `${u.rating} (${u.reviewCount ?? 0} reviews)` : '—'],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-3 border-b border-slate-50 pb-1">
                <dt className="font-bold text-slate-400">{k}</dt>
                <dd className="break-all text-right font-bold text-slate-700">{String(v)}</dd>
              </div>
            ))}
          </dl>
          {u.moderationNotes && <p className="rounded-xl bg-rose-50 px-3 py-2 text-[11px] font-medium text-rose-700"><b>Moderation note:</b> {u.moderationNotes}</p>}
          {u.verificationNote && <p className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-600"><b>Verification note:</b> {u.verificationNote}</p>}

          {isSelf ? (
            <p className="text-[11px] font-bold text-slate-400">You can't moderate your own account.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">Verification</p>
                <div className="flex flex-wrap gap-2">
                  <Btn tone="primary" disabled={verification === 'verified'} onClick={() => verify('verified', `Approve ${label}?`, 'Approve', 'They will show as a verified worker.')}>Approve</Btn>
                  <Btn disabled={verification === 'rejected'} onClick={() => verify('rejected', `Reject ${label}'s verification?`, 'Reject', 'Explain what was wrong so it is on record.', true)}>Reject</Btn>
                  <Btn disabled={verification === 'unverified'} onClick={() => verify('unverified', `Revoke ${label}'s verification?`, 'Revoke', 'They go back to unverified.')}>Revoke</Btn>
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">Account</p>
                <div className="flex flex-wrap gap-2">
                  <Btn disabled={mod === 'warned'} onClick={() => moderate('warned', `Warn ${label}?`, 'Send warning', 'Records a warning. They can still use the app.')}>Warn</Btn>
                  <Btn tone="danger" disabled={mod === 'temp_blocked'} onClick={() => moderate('temp_blocked', `Suspend ${label}?`, 'Suspend', 'They are blocked from the app until you restore them.', true)}>Suspend</Btn>
                  <Btn tone="danger" disabled={mod === 'perm_blocked'} onClick={() => moderate('perm_blocked', `Ban ${label}?`, 'Ban', 'They are blocked from the app. You can still restore them later.', true)}>Ban</Btn>
                  <Btn disabled={mod === 'active'} onClick={() => moderate('active', `Restore ${label}?`, 'Restore', 'Removes any warning, suspension or ban.')}>Restore</Btn>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export function UsersTab({ toast, myUid }: TabProps) {
  const [rows, setRows] = useState<Row[]>([]);
  const [cursor, setCursor] = useState<Page['cursor']>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [term, setTerm] = useState('');
  const [searching, setSearching] = useState<string | null>(null); // the term currently shown, null = browsing
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [version, setVersion] = useState(0);

  // First page, and again after "Clear" or a manual refresh
  useEffect(() => {
    let cancelled = false;
    fetchUsersPage()
      .then((p) => { if (!cancelled) { setRows(p.rows); setCursor(p.cursor); setHasMore(p.hasMore); setError(null); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(friendlyError(err)); setLoading(false); } });
    return () => { cancelled = true; };
  }, [version]);

  const doSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = term.trim();
    if (!t) return;
    setLoading(true); setError(null);
    try {
      setRows(await searchUsers(t));
      setSearching(t); setHasMore(false);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const clear = () => { setTerm(''); setSearching(null); setLoading(true); setVersion((v) => v + 1); };

  const more = async () => {
    setLoadingMore(true);
    try {
      const p = await fetchUsersPage(cursor);
      setRows((r) => [...r, ...p.rows]); setCursor(p.cursor); setHasMore(p.hasMore);
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setLoadingMore(false);
    }
  };

  // After an action: reload so the card shows what is really stored
  const closeDialog = () => setDialog(null);
  const ask = (d: Dialog) => setDialog({
    ...d,
    onConfirm: async (reason) => {
      await d.onConfirm(reason);
      toast.success('Done. The change is saved and logged.');
      if (searching) { setRows(await searchUsers(searching)); } else { setVersion((v) => v + 1); }
    },
  });

  return (
    <div className="space-y-4">
      <form onSubmit={doSearch} className="flex gap-2" role="search">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Find by exact username, email or user ID" aria-label="Search users"
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <Btn type="submit" tone="primary" disabled={!term.trim()}>Search</Btn>
        {searching !== null && <Btn onClick={clear}>Clear</Btn>}
      </form>

      {searching !== null && <p className="text-[11px] font-bold text-slate-400">{rows.length} result(s) for “{searching}”</p>}
      {loading ? <Spinner /> : error ? <ErrorState message={error} onRetry={clear} /> : rows.length === 0 ? (
        <EmptyState>{searching !== null ? 'No one matches that exactly. Check the spelling, or paste their email or user ID.' : 'No users yet.'}</EmptyState>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => <UserCard key={r.id} row={r} myUid={myUid} onAsk={ask} />)}
          {hasMore && <div className="pt-2 text-center"><Btn onClick={more} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more'}</Btn></div>}
        </div>
      )}
      {dialog && <ActionDialog {...dialog} onClose={closeDialog} />}
    </div>
  );
}
