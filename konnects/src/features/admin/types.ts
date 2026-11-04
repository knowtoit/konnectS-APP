import type { ToastApi } from '../profile/useToast';

export type TabId = 'overview' | 'users' | 'verifications' | 'reports' | 'listings' | 'audit';

export interface TabProps {
  toast: ToastApi;
  /** The signed-in admin's own user id (admins cannot moderate themselves) */
  myUid: string;
  goTo: (tab: TabId) => void;
}
