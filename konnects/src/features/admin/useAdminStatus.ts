import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Is the signed-in person an admin?
 *  - they have a document in /admins/{their user id} (created by hand in the Firebase Console), or
 *  - their sign-in token carries the `admin` custom claim.
 *
 * This only decides what the app SHOWS. The real protection is in the Firestore security rules,
 * which check the same thing on every admin read and write, so editing the page cannot grant access.
 */
export function useAdminStatus() {
  const { user, loading } = useAuth();
  const [result, setResult] = useState<{ uid: string; isAdmin: boolean } | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    (async () => {
      let admin = false;
      try {
        admin = (await getDoc(doc(db, 'admins', user.uid))).exists();
      } catch {
        /* not an admin, or rules not published yet */
      }
      if (!admin) {
        try {
          admin = (await auth.currentUser?.getIdTokenResult())?.claims?.admin === true;
        } catch {
          /* ignore */
        }
      }
      if (!cancelled) setResult({ uid: user.uid, isAdmin: admin });
    })();
    return () => { cancelled = true; };
  }, [loading, user]);

  const known = !!user && result?.uid === user.uid;
  return { isAdmin: known && !!result?.isAdmin, checking: !!user && !known };
}
