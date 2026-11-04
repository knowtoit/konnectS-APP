import { Ban, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

/** Shown instead of the app to suspended or banned accounts (the security rules also stop them creating listings, offers and bookings). */
export function AccountBlockedScreen({ status, reason }: { status?: string; reason?: string }) {
  const { logout } = useAuth();
  const banned = status === 'perm_blocked';
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6" role="alert">
      <div className="w-full max-w-md space-y-5 rounded-[2rem] bg-white p-8 text-center shadow-xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600"><Ban size={26} /></div>
        <div className="space-y-2">
          <h1 className="text-xl font-black tracking-tight text-slate-900">{banned ? 'Your account has been banned' : 'Your account is suspended'}</h1>
          <p className="text-xs font-medium leading-relaxed text-slate-500">
            {banned
              ? 'This account can no longer be used on KonnectS.'
              : 'You can’t use KonnectS while your account is suspended.'}
          </p>
        </div>
        {reason && (
          <p className="rounded-2xl bg-slate-50 px-4 py-3 text-left text-xs font-medium text-slate-600"><b className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Reason</b>{reason}</p>
        )}
        <p className="text-[11px] font-medium text-slate-400">If you think this is a mistake, please contact KonnectS support.</p>
        <button type="button" onClick={() => logout()} className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 text-xs font-black uppercase tracking-widest text-white active:scale-95">
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </div>
  );
}
