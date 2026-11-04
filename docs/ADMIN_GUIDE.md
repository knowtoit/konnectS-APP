# KonnectS Admin Panel: how it works

The Admin Panel lets trusted people review workers, handle reports and SOS alerts, take down listings and
suspend or ban accounts, with every action recorded. It is built into the `konnects/` app.

---

## 1. Who is an admin?

An admin is **anyone who has a document in the `admins` collection** of your Firestore database, where the
**document ID is that person's user ID**. That's all.

* Only someone with access to the **Firebase Console** can add or remove admins. The app itself can't, and no
  user can promote themselves. The security rules refuse every write to `admins` from the app.
* The panel only *looks* for that document to decide whether to show the menu item. The real check is in the
  database rules, which run on **every** admin read and write. Even someone who edits the page in their browser
  gets "permission denied".

### Make yourself the first admin (one time, about 2 minutes)

1. Open the **Firebase Console** → your project → **Authentication** → **Users**. Find your account and copy
   its **User UID** (a long string like `kF3a9Zx...`).
2. Go to **Firestore Database** → **Start collection** (or **+ Start collection** if the database is not empty).
   Collection ID: `admins`.
3. **Document ID:** paste your User UID (do *not* use "Auto-ID").
4. Add one field: name `role`, type `string`, value `owner`. Click **Save**.
5. In the app, sign out and sign in again. **Profile → Admin Panel** now appears at the top of the menu.

To add another admin, repeat steps 2–4 with their UID. To **remove** an admin, delete their document in the
console. They lose access immediately.

> Protect the Google account that owns your Firebase project with 2-step verification. Whoever controls it
> controls who is an admin.

---

## 2. Before it works: publish the security rules

Merging the code does **not** change your live database rules. You must publish them, or the panel will show
"Permission denied".

* Rules for this app: **`konnects/firestore.rules`** (if you use the `konnects/` app) and the root **`firestore.rules`**.
  Publish the one your project actually uses: Firebase Console → Firestore → **Rules** → paste → **Publish**,
  or run `firebase deploy --only firestore:rules`.
* These rules add: the `admins` list, the tamper-proof `admin_audit` log, admin-only access to reports and logs,
  and block enforcement (see "What a block does" below).

Test on a staging project first if you can (`npm run test:rules` runs the rule tests; they need Java).

---

## 3. Using the panel

Open it from **Profile → Admin Panel**. Close it with the **X** in the top corner.

### Overview
* **Needs attention**: shows how many SOS alerts are active, workers are waiting for verification and reports are
  open. Tap a row to jump straight to it.
* **At a glance**: users, workers, live listings, blocked accounts. "n/a" means that count couldn't be loaded
  (it never shows a wrong number).

### Users
* **Search** by *exact* username, email or user ID. Usernames are matched without regard to upper/lower case for
  people who have opened the app since the username registry was added; for anyone else, type the username exactly
  as they wrote it. The full list is shown newest first, 25 at a time ("Load more").
* Tap a person to see their details and the actions below.
* **Verification:** Approve, Reject (needs a reason), Revoke.
* **Account:** Warn, Suspend, Ban (all need a reason), Restore.
* You can't moderate **your own** account.

### Verifications
The queue of workers whose verification is **pending**: their documents' file names and photo. **Approve** or
**Reject** (a reason is required). The queue updates as you go.

### Reports & SOS
* **Bug reports & feedback**: filter Open / Investigating / Resolved. Move a report along with *Investigate*,
  *Resolve* or *Reopen*. Evidence photos are shown when the report has them. Reports from before this panel existed
  have no status and count as **Open**.
* **SOS alerts**: shows who triggered it, their emergency contact (tap the number to call) and **Open map**.
  Use **Mark resolved** once it's handled. *The panel doesn't contact emergency services. If someone is in danger,
  call them yourself.*

### Listings
The latest marketplace listings. **Remove** hides a listing (a reason is required). The seller keeps their account.
Removing is not undone from the panel; ask a developer to change it back in the database if needed.

### Audit log
Every admin action: who did it, what, to whom, when and why. Entries **can't be edited or deleted**, not even by
admins. Each action and its log entry are saved together in one step, so there is never a change without a record.

---

## 4. What happens to the user

| You do | The person experiences |
|---|---|
| Approve verification | They show as a verified worker. |
| Reject verification | Their status becomes rejected; your reason is stored on their profile. |
| Warn | Recorded on their profile. They can keep using the app. |
| Suspend / Ban | They see a "suspended / banned" screen with your reason and can only sign out. The rules also stop them creating listings, offers and bookings, even by bypassing the app. |
| Restore | Everything returns to normal; the note is cleared. |
| Remove listing | The listing disappears from the marketplace. |

**What a block does and doesn't do:** blocked accounts can't use the app and can't create new listings, offers or
bookings. They are **not** deleted, and the rules don't yet block *every* kind of write (for example chat messages
or reviews). Suspend/ban is meant to stop normal use; for abuse that needs more, contact a developer.

---

## 5. Troubleshooting

| Problem | Likely cause and fix |
|---|---|
| No "Admin Panel" in the Profile menu | Your UID isn't in `admins` (check the document ID matches exactly), or you haven't signed out and in again. |
| "Permission denied" everywhere | The new rules aren't published yet (section 2), or your `admins` document is missing. |
| A list says it "needs a database index" | Firebase needs a one-click index. Open the browser console (F12), click the link Firebase prints, create the index, wait a minute, retry. |
| A count shows "n/a" | That count couldn't load (usually missing permission). The rest of the panel still works. |
| An action says it failed | Nothing was saved (action and log entry are all-or-nothing). Try again. |
| User search finds nobody | Search is exact. Try their email, or paste their user ID from Firebase → Authentication. |

---

## 6. Good practice

* Give admin access to as few people as possible, and review `admins` regularly.
* Always write a clear reason. It goes into the audit log (and a block reason is shown to the user).
* Check the **Audit log** now and then.
* Keep personal details out of reasons: they are stored, and for blocks, shown to the user.

## 7. Limits to know about

* Search is exact-match, not "contains".
* Lists show the newest items (50 reports, 30 SOS alerts, 20 listings per page, 25 users per page).
* There is no admin "undo" button. Everything is recorded, so a developer can reverse a change.
* Roles are all-or-nothing: every admin can do everything in the panel.
* The old admin screen inside the worker area was removed, because anyone with a worker account could open it.
