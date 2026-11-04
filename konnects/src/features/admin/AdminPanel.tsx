import { useEffect, useState } from 'react';
import { Activity, Flag, LayoutDashboard, ShieldCheck, ShoppingBag, UserCheck, Users, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../profile/useToast';
import { useAdminStatus } from './useAdminStatus';
import { OverviewTab } from './OverviewTab';
import { UsersTab } from './UsersTab';
import { VerificationsTab } from './VerificationsTab';
import { ReportsTab } from './ReportsTab';
import { ListingsTab } from './ListingsTab';
import { AuditTab } from './AuditTab';
import type { TabId, TabProps } from './types';

const TABS: { id: TabId; label: string; icon: typeof Users }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'verifications', label: 'Verifications', icon: UserCheck },
  { id: 'reports', label: 'Reports & SOS', icon: Flag },
  { id: 'listings', label: 'Listings', icon: ShoppingBag },
  { id: 'audit', label: 'Audit log', icon: Activity },
];

const TAB_VIEWS: Record<TabId, (props: TabProps) => React.ReactElement> = {
  overview: OverviewTab,
  users: UsersTab,
  verifications: VerificationsTab,
  reports: ReportsTab,
  listings: ListingsTab,
  audit: AuditTab,
};

/** Full-screen admin panel. Only mounted for admins (see AdminPanelHost); the security rules enforce it again on every read/write. */
export function AdminPanel({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const { toast, ToastHost } = useToast();
  const [tab, setTab] = useState<TabId>('overview');
  const View = TAB_VIEWS[tab];

  return (
    <div className="fixed inset-0 z-[250] overflow-y-auto bg-slate-50" role="dialog" aria-modal="true" aria-label="Admin panel">
      {ToastHost}
      <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white"><ShieldCheck size={18} /></div>
            <div className="min-w-0">
              <h1 className="text-sm font-black tracking-tight text-slate-900">Admin Panel</h1>
              <p className="truncate text-[10px] font-medium text-slate-400">Signed in as {user?.email}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close admin panel" className="cursor-pointer rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
            <X size={18} />
          </button>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 pb-2" role="tablist" aria-label="Admin sections">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={`flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-[11px] font-black uppercase tracking-wider transition-colors ${tab === id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 pb-24">
        <View key={tab} toast={toast} myUid={user?.uid ?? ''} goTo={setTab} />
      </main>
    </div>
  );
}

/** Opens the panel when the profile menu fires `open-admin-panel`. Renders nothing for anyone who is not an admin. */
export function AdminPanelHost() {
  const { isAdmin } = useAdminStatus();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-admin-panel', handler);
    return () => window.removeEventListener('open-admin-panel', handler);
  }, []);

  if (!isAdmin || !open) return null;
  return <AdminPanel onClose={() => setOpen(false)} />;
}
