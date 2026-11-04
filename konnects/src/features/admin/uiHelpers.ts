import { useCallback, useEffect, useRef, useState } from 'react';

export function formatDate(value: any): string {
  let d: Date | null = null;
  if (value?.toDate) d = value.toDate();
  else if (typeof value?.seconds === 'number') d = new Date(value.seconds * 1000);
  else if (value) d = new Date(value);
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

export function friendlyError(err: any): string {
  if (err?.code === 'permission-denied') return "Permission denied. You may not be an admin, or the latest security rules haven't been published yet.";
  if (err?.code === 'failed-precondition') return 'This list needs a database index. Open the browser console for the link Firebase provides, create it, and try again.';
  return err?.message || 'Something went wrong. Please try again.';
}

/** Load once, and again whenever `reload()` is called. Shows loading/error states. */
export function useLoader<T>(load: () => Promise<T>) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<{ version: number; data?: T; error?: string } | null>(null);
  const loadRef = useRef(load);
  // Keep the latest loader without re-running the load effect when its identity changes
  useEffect(() => { loadRef.current = load; });

  useEffect(() => {
    let cancelled = false;
    loadRef.current()
      .then((data) => { if (!cancelled) setResult({ version, data }); })
      .catch((err) => { if (!cancelled) setResult({ version, error: friendlyError(err) }); });
    return () => { cancelled = true; };
  }, [version]);

  const current = result && result.version === version ? result : null;
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data: current?.data, error: current?.error, loading: !current, reload };
}
