import { useState } from 'react';
import { fetchListings, removeListing, type Page, type Row } from './adminService';
import { safeImageSrc } from './adminLogic';
import { ActionDialog, Badge, Btn, Card, EmptyState, ErrorState, RefreshButton, Spinner, type ActionDialogProps } from './ui';
import { formatDate, friendlyError, useLoader } from './uiHelpers';
import type { TabProps } from './types';

type Dialog = Omit<ActionDialogProps, 'onClose'>;

export function ListingsTab({ toast }: TabProps) {
  const { data, error, loading, reload } = useLoader(() => fetchListings());
  const [extra, setExtra] = useState<Row[]>([]);
  const [cursor, setCursor] = useState<Page['cursor'] | undefined>(undefined);
  const [more, setMore] = useState<boolean | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [removed, setRemoved] = useState<Record<string, boolean>>({});
  const [dialog, setDialog] = useState<Dialog | null>(null);

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorState message={error ?? 'Could not load listings.'} onRetry={reload} />;

  const rows = [...data.rows, ...extra];
  const nextCursor = cursor === undefined ? data.cursor : cursor;
  const hasMore = more === undefined ? data.hasMore : more;

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const p = await fetchListings(nextCursor);
      setExtra((e) => [...e, ...p.rows]); setCursor(p.cursor); setMore(p.hasMore);
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setLoadingMore(false);
    }
  };

  const remove = (row: Row) => {
    const label = String(row.data.title || row.id);
    setDialog({
      title: `Remove “${label}”?`,
      description: 'The listing is hidden from the marketplace. The seller keeps their account.',
      confirmLabel: 'Remove listing', tone: 'danger', action: 'listing_removed', reasonLabel: 'Reason',
      onConfirm: async (reason) => {
        await removeListing({ id: row.id, label }, reason);
        setRemoved((r) => ({ ...r, [row.id]: true }));
        toast.success('Listing removed.');
      },
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><RefreshButton onClick={() => { setExtra([]); setCursor(undefined); setMore(undefined); reload(); }} /></div>
      {rows.length === 0 ? <EmptyState>No listings yet.</EmptyState> : rows.map((row) => {
        const it = row.data;
        const status = removed[row.id] ? 'deleted' : String(it.status || 'available');
        const img = safeImageSrc(Array.isArray(it.images) ? it.images[0] : null);
        return (
          <Card key={row.id}>
            <div className="flex gap-3">
              {img ? <img src={img} alt="" className="h-16 w-16 shrink-0 rounded-xl border border-slate-100 object-cover" /> : <div className="h-16 w-16 shrink-0 rounded-xl bg-slate-50" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-slate-900">{it.title || '(untitled)'}</p>
                <p className="text-[11px] font-medium text-slate-400">{it.isFree ? 'Free' : `£${Number(it.price ?? 0).toFixed(2)}`} · {it.category || 'other'} · {formatDate(it.createdAt)}</p>
                <p className="truncate text-[10px] font-medium text-slate-300">Seller ID: {it.sellerId || '—'}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Badge tone={status === 'available' ? 'green' : status === 'deleted' ? 'red' : 'slate'}>{status}</Badge>
                  {it.moderationReason && <Badge tone="red">Removed by admin</Badge>}
                </div>
              </div>
              {status !== 'deleted' && <div className="shrink-0 self-center"><Btn tone="danger" onClick={() => remove(row)}>Remove</Btn></div>}
            </div>
          </Card>
        );
      })}
      {hasMore && <div className="pt-2 text-center"><Btn onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more'}</Btn></div>}
      {dialog && <ActionDialog {...dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}
