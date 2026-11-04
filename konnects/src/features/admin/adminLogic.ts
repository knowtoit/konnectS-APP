/** Pure helpers for the admin panel (no Firebase imports, so they are easy to test). */

export type ModerationStatus = 'active' | 'warned' | 'temp_blocked' | 'perm_blocked';
export type ReportStatus = 'open' | 'investigating' | 'resolved';
export type VerificationStatus = 'unverified' | 'in_progress' | 'pending' | 'verified' | 'rejected';

export const MODERATION_LABELS: Record<ModerationStatus, string> = {
  active: 'Active',
  warned: 'Warned',
  temp_blocked: 'Suspended',
  perm_blocked: 'Banned',
};

/** Accounts in these states cannot use the app or create listings, offers or bookings. */
export const isBlockedStatus = (status?: string | null): boolean => status === 'temp_blocked' || status === 'perm_blocked';

export function moderationOf(data: { moderationStatus?: string } | undefined | null): ModerationStatus {
  const s = data?.moderationStatus;
  return s === 'warned' || s === 'temp_blocked' || s === 'perm_blocked' ? s : 'active';
}

/** Older reports were saved without a status; those count as open. */
export function reportStatusOf(data: { status?: string } | undefined | null): ReportStatus {
  const s = data?.status;
  return s === 'investigating' || s === 'resolved' ? s : 'open';
}

export type SearchKind = 'empty' | 'email' | 'uid' | 'username';

/** Decide how to look a person up from whatever the admin typed. */
export function classifySearchTerm(raw: string): { kind: SearchKind; value: string } {
  const term = raw.trim();
  if (!term) return { kind: 'empty', value: '' };
  if (term.includes('@') && /^[^\s@]+@[^\s@]+$/.test(term)) return { kind: 'email', value: term.toLowerCase() };
  if (/^[A-Za-z0-9]{20,36}$/.test(term)) return { kind: 'uid', value: term };
  return { kind: 'username', value: term.replace(/^@/, '') };
}

/** Only show images from safe sources (inline images or https); never javascript: or other schemes. */
export function safeImageSrc(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v)) return v;
  if (/^https:\/\/[^\s]+$/.test(v)) return v;
  return null;
}

export const REASON_MIN_LENGTH = 5;

/** Actions that must be explained in writing (the reason goes into the audit trail and, for bans, to the user). */
export function reasonRequired(action: string): boolean {
  return (
    action === 'verification_rejected' ||
    action === 'moderation_warned' ||
    action === 'moderation_temp_blocked' ||
    action === 'moderation_perm_blocked' ||
    action === 'listing_removed'
  );
}

export function validateReason(action: string, reason: string): string | null {
  const r = reason.trim();
  if (!reasonRequired(action)) return r.length > 500 ? 'Please keep the note under 500 characters.' : null;
  if (r.length < REASON_MIN_LENGTH) return `Please give a reason (at least ${REASON_MIN_LENGTH} characters).`;
  if (r.length > 500) return 'Please keep the reason under 500 characters.';
  return null;
}

const ACTION_LABELS: Record<string, string> = {
  verification_verified: 'Approved verification',
  verification_rejected: 'Rejected verification',
  verification_unverified: 'Revoked verification',
  moderation_active: 'Restored account',
  moderation_warned: 'Warned user',
  moderation_temp_blocked: 'Suspended user',
  moderation_perm_blocked: 'Banned user',
  report_open: 'Reopened report',
  report_investigating: 'Marked report as investigating',
  report_resolved: 'Resolved report',
  sos_resolved: 'Resolved SOS alert',
  listing_removed: 'Removed listing',
};
export const actionLabel = (action: string): string => ACTION_LABELS[action] ?? action.replace(/_/g, ' ');

/** Drop undefined values (Firestore rejects them) and trim strings. */
export function cleanFields<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[k] = typeof v === 'string' ? v.trim() : v;
  }
  return out as Partial<T>;
}

export function displayName(data: { fullName?: string; displayName?: string; username?: string; email?: string } | undefined | null): string {
  return data?.fullName || data?.displayName || data?.username || data?.email || 'Unknown';
}
