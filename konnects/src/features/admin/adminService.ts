import {
  collection, doc, getCountFromServer, getDoc, getDocs, limit, orderBy, query, serverTimestamp, startAfter,
  where, writeBatch, type DocumentData, type QueryConstraint, type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { classifySearchTerm, cleanFields, type ModerationStatus, type ReportStatus } from './adminLogic';
import { usernameKey } from '../profile/usernameRegistry';

export interface Row { id: string; data: DocumentData }
export interface Page { rows: Row[]; cursor: QueryDocumentSnapshot<DocumentData> | null; hasMore: boolean }

const PAGE_SIZE = 25;
const toRows = (docs: QueryDocumentSnapshot<DocumentData>[]): Row[] => docs.map((d) => ({ id: d.id, data: d.data() }));

function currentAdmin() {
  const u = auth.currentUser;
  if (!u) throw new Error('You are signed out. Please sign in again.');
  return { uid: u.uid, email: u.email ?? '' };
}

export interface AuditInput {
  action: string;
  targetType: 'user' | 'listing' | 'report' | 'sos';
  targetId: string;
  targetLabel?: string;
  reason?: string;
}

/**
 * Apply a change AND record who did it, in one atomic batch: either both happen or neither does,
 * so there is never an admin action without an audit entry. The audit collection can't be edited later.
 */
async function applyWithAudit(apply: (batch: ReturnType<typeof writeBatch>, adminUid: string) => void, audit: AuditInput) {
  const admin = currentAdmin();
  const batch = writeBatch(db);
  apply(batch, admin.uid);
  batch.set(doc(collection(db, 'admin_audit')), {
    ...cleanFields({ ...audit }),
    adminUid: admin.uid,
    adminEmail: admin.email,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

// ---------------------------------------------------------------- actions

export function setVerification(target: { id: string; label: string }, status: 'verified' | 'rejected' | 'unverified', reason = '') {
  return applyWithAudit(
    (batch, adminUid) =>
      batch.update(doc(db, 'users', target.id), {
        verificationStatus: status,
        verificationReviewedBy: adminUid,
        verificationReviewedAt: serverTimestamp(),
        verificationNote: reason.trim(),
      }),
    { action: `verification_${status}`, targetType: 'user', targetId: target.id, targetLabel: target.label, reason }
  );
}

export function setModeration(target: { id: string; label: string }, status: ModerationStatus, reason = '') {
  return applyWithAudit(
    (batch, adminUid) =>
      batch.update(doc(db, 'users', target.id), {
        moderationStatus: status,
        moderationNotes: status === 'active' ? '' : reason.trim(),
        moderationUpdatedBy: adminUid,
        moderationUpdatedAt: serverTimestamp(),
      }),
    { action: `moderation_${status}`, targetType: 'user', targetId: target.id, targetLabel: target.label, reason }
  );
}

export function setReportStatus(target: { id: string; label: string }, status: ReportStatus) {
  return applyWithAudit(
    (batch, adminUid) => batch.update(doc(db, 'feedback', target.id), { status, resolvedBy: adminUid, updatedAt: serverTimestamp() }),
    { action: `report_${status}`, targetType: 'report', targetId: target.id, targetLabel: target.label }
  );
}

export function resolveSos(target: { id: string; label: string }) {
  return applyWithAudit(
    (batch, adminUid) => batch.update(doc(db, 'sos_alerts', target.id), { status: 'resolved', resolvedBy: adminUid, resolvedAt: serverTimestamp() }),
    { action: 'sos_resolved', targetType: 'sos', targetId: target.id, targetLabel: target.label }
  );
}

export function removeListing(target: { id: string; label: string }, reason: string) {
  return applyWithAudit(
    (batch, adminUid) =>
      batch.update(doc(db, 'items', target.id), {
        status: 'deleted',
        moderatedBy: adminUid,
        moderationReason: reason.trim(),
        updatedAt: serverTimestamp(),
      }),
    { action: 'listing_removed', targetType: 'listing', targetId: target.id, targetLabel: target.label, reason }
  );
}

// ---------------------------------------------------------------- reading

async function page(col: string, constraints: QueryConstraint[], after?: QueryDocumentSnapshot<DocumentData> | null, size = PAGE_SIZE): Promise<Page> {
  const q = query(collection(db, col), ...constraints, ...(after ? [startAfter(after)] : []), limit(size + 1));
  const snap = await getDocs(q);
  const docs = snap.docs.slice(0, size);
  return { rows: toRows(docs), cursor: docs.length ? docs[docs.length - 1] : null, hasMore: snap.docs.length > size };
}

export const fetchUsersPage = (after?: QueryDocumentSnapshot<DocumentData> | null) => page('users', [orderBy('createdAt', 'desc')], after);
export const fetchPendingVerifications = () => page('users', [where('verificationStatus', '==', 'pending')], null, 50);
export const fetchReports = () => page('feedback', [orderBy('createdAt', 'desc')], null, 50);
export const fetchSosAlerts = () => page('sos_alerts', [orderBy('triggeredAt', 'desc')], null, 30);
export const fetchListings = (after?: QueryDocumentSnapshot<DocumentData> | null) => page('items', [orderBy('createdAt', 'desc')], after, 20);
export const fetchAudit = () => page('admin_audit', [orderBy('createdAt', 'desc')], null, 50);

/** Look someone up by exact email, user id or username (as typed, and lower-case). */
export async function searchUsers(raw: string): Promise<Row[]> {
  const { kind, value } = classifySearchTerm(raw);
  if (kind === 'empty') return [];
  if (kind === 'uid') {
    const snap = await getDoc(doc(db, 'users', value));
    return snap.exists() ? [{ id: snap.id, data: snap.data() }] : [];
  }
  const field = kind === 'email' ? 'email' : 'username';
  const variants = [...new Set([value, value.toLowerCase()])];
  const found = new Map<string, Row>();

  if (kind === 'username') {
    // The username registry is case-insensitive ("Bob_B" is found by "bob_b"); registered names resolve straight to a user id.
    try {
      const entry = await getDoc(doc(db, 'login_index', usernameKey(value)));
      const uid = entry.exists() ? (entry.data()?.uid as string | undefined) : undefined;
      if (uid) {
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists()) found.set(snap.id, { id: snap.id, data: snap.data() });
      }
    } catch {
      /* registry not reachable: fall back to exact matches below */
    }
  }
  for (const v of variants) {
    const snap = await getDocs(query(collection(db, 'users'), where(field, '==', v), limit(10)));
    snap.docs.forEach((d) => found.set(d.id, { id: d.id, data: d.data() }));
  }
  return [...found.values()];
}

export interface Counts {
  users: number | null;
  workers: number | null;
  pendingVerifications: number | null;
  blockedUsers: number | null;
  activeSos: number | null;
  openReports: number | null;
  liveListings: number | null;
}

async function count(col: string, ...constraints: QueryConstraint[]): Promise<number | null> {
  try {
    const snap = await getCountFromServer(query(collection(db, col), ...constraints));
    return snap.data().count;
  } catch (err) {
    console.warn(`[admin] could not count ${col}:`, err);
    return null; // shown as "n/a" instead of a wrong number
  }
}

export async function fetchCounts(): Promise<Counts> {
  const [users, workers, pendingVerifications, blockedUsers, activeSos, reportsTotal, reportsResolved, liveListings] = await Promise.all([
    count('users'),
    count('users', where('isWorker', '==', true)),
    count('users', where('verificationStatus', '==', 'pending')),
    count('users', where('moderationStatus', 'in', ['temp_blocked', 'perm_blocked'])),
    count('sos_alerts', where('status', '==', 'active')),
    count('feedback'),
    count('feedback', where('status', '==', 'resolved')),
    count('items', where('status', '==', 'available')),
  ]);
  return {
    users, workers, pendingVerifications, blockedUsers, activeSos, liveListings,
    openReports: reportsTotal !== null && reportsResolved !== null ? reportsTotal - reportsResolved : null,
  };
}
