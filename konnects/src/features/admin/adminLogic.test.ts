import { describe, it, expect } from 'vitest';
import {
  classifySearchTerm, safeImageSrc, reasonRequired, validateReason, reportStatusOf, moderationOf, isBlockedStatus,
  cleanFields, actionLabel, displayName,
} from './adminLogic';

describe('admin search', () => {
  it('recognises emails, user ids and usernames', () => {
    expect(classifySearchTerm('  Ada@Example.COM ')).toEqual({ kind: 'email', value: 'ada@example.com' });
    expect(classifySearchTerm('kF3a9ZxQ1mN7pR2sT5vW8yB0cD4e')).toEqual({ kind: 'uid', value: 'kF3a9ZxQ1mN7pR2sT5vW8yB0cD4e' });
    expect(classifySearchTerm('@ada_l')).toEqual({ kind: 'username', value: 'ada_l' });
    expect(classifySearchTerm('ada')).toEqual({ kind: 'username', value: 'ada' });
    expect(classifySearchTerm('   ')).toEqual({ kind: 'empty', value: '' });
  });
  it('does not mistake a normal username for a user id', () => {
    expect(classifySearchTerm('short_name').kind).toBe('username');
    expect(classifySearchTerm('has.dot.in.it.and.is.long.enough').kind).toBe('username');
  });
});

describe('safe images', () => {
  it('allows inline images and https only', () => {
    expect(safeImageSrc('https://example.com/a.png')).toBe('https://example.com/a.png');
    expect(safeImageSrc('data:image/png;base64,iVBORw0KGgo=')).toContain('data:image/png');
    expect(safeImageSrc('javascript:alert(1)')).toBeNull();
    expect(safeImageSrc('http://example.com/a.png')).toBeNull();
    expect(safeImageSrc('data:text/html;base64,PHNjcmlwdD4=')).toBeNull();
    expect(safeImageSrc('data:image/svg+xml;base64,AAAA')).toBeNull();
    expect(safeImageSrc(42)).toBeNull();
    expect(safeImageSrc(undefined)).toBeNull();
  });
});

describe('reasons', () => {
  it('requires a written reason for rejections, bans, suspensions, warnings and removals', () => {
    for (const a of ['verification_rejected', 'moderation_warned', 'moderation_temp_blocked', 'moderation_perm_blocked', 'listing_removed']) {
      expect(reasonRequired(a)).toBe(true);
      expect(validateReason(a, '')).toMatch(/reason/);
      expect(validateReason(a, 'abc')).toMatch(/at least/);
      expect(validateReason(a, 'Fake documents')).toBeNull();
    }
  });
  it('does not require one for approvals and restores, but caps the length', () => {
    expect(reasonRequired('verification_verified')).toBe(false);
    expect(validateReason('verification_verified', '')).toBeNull();
    expect(validateReason('moderation_active', '')).toBeNull();
    expect(validateReason('moderation_active', 'x'.repeat(501))).toMatch(/under 500/);
  });
});

describe('status helpers', () => {
  it('treats missing report status as open and unknown moderation as active', () => {
    expect(reportStatusOf({})).toBe('open');
    expect(reportStatusOf({ status: 'resolved' })).toBe('resolved');
    expect(reportStatusOf({ status: 'weird' })).toBe('open');
    expect(moderationOf(undefined)).toBe('active');
    expect(moderationOf({ moderationStatus: 'perm_blocked' })).toBe('perm_blocked');
  });
  it('only suspended and banned accounts are blocked', () => {
    expect(isBlockedStatus('temp_blocked')).toBe(true);
    expect(isBlockedStatus('perm_blocked')).toBe(true);
    expect(isBlockedStatus('warned')).toBe(false);
    expect(isBlockedStatus('active')).toBe(false);
    expect(isBlockedStatus(undefined)).toBe(false);
  });
});

describe('small utilities', () => {
  it('cleanFields drops undefined and trims strings', () => {
    expect(cleanFields({ a: ' x ', b: undefined, c: 3 })).toEqual({ a: 'x', c: 3 });
  });
  it('labels actions in plain words', () => {
    expect(actionLabel('moderation_perm_blocked')).toBe('Banned user');
    expect(actionLabel('something_new')).toBe('something new');
  });
  it('picks a sensible display name', () => {
    expect(displayName({ fullName: 'Ada L', username: 'ada' })).toBe('Ada L');
    expect(displayName({ email: 'a@b.co' })).toBe('a@b.co');
    expect(displayName(null)).toBe('Unknown');
  });
});
