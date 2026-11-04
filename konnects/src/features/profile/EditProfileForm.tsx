import { useEffect, useMemo, useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  updateProfile as updateAuthProfile,
  verifyBeforeUpdateEmail,
} from "firebase/auth";
import {
  AlertCircle,
  AtSign,
  CheckCircle2,
  Loader2,
  Mail,
  Phone,
  User,
} from "lucide-react";
import { auth, db } from "../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { haptics } from "../../utils/haptics";
import { cleanMobile } from "../../lib/contactValidation";
import { AvatarUploader } from "./AvatarUploader";
import type { ToastApi } from "./useToast";
import {
  changeUsername,
  isUsernameAvailable,
  UsernameTakenError,
} from "./usernameRegistry";
import {
  normalizeUsername,
  validateProfileForm,
  type ProfileFormValues,
} from "./validation";
import type { WorkerType } from "../../types";

interface EditProfileFormProps {
  toast: ToastApi;
  /** Called after a successful save to return to the profile screen */
  onDone: () => void;
}

type UsernameState = "idle" | "checking" | "available" | "taken" | "unknown";

const WORKER_TYPES = [
  "plumber",
  "mechanic",
  "doctor",
  "electrician",
  "cleaner",
  "cab_owner",
  "other",
];
const INPUT =
  "w-full min-h-12 min-w-0 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-medium text-slate-900 placeholder:text-slate-500 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100";
const INPUT_ERROR =
  "border-2 border-rose-500 bg-rose-50/30 text-rose-700 ring-2 ring-rose-500/20";
const LABEL = "block text-sm font-semibold text-slate-700 dark:text-slate-200";

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p
      role="alert"
      className="ml-1 mt-1 flex items-center gap-1.5 text-sm font-bold text-rose-500"
    >
      <AlertCircle size={13} className="shrink-0" />
      <span>{msg}</span>
    </p>
  );
}

function friendlyEmailError(err: any): string {
  switch (err?.code) {
    case "auth/requires-recent-login":
      return "For security, please sign out and sign back in, then try changing your email again.";
    case "auth/email-already-in-use":
      return "That email address is already in use by another account.";
    case "auth/invalid-email":
      return "That email address is not valid.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a few minutes and try again.";
    default:
      return err?.message || "We could not start the email change.";
  }
}

export function EditProfileForm({ toast, onDone }: EditProfileFormProps) {
  const { user, profile, updateProfile } = useAuth();

  // What the form started with; used to see what changed and to avoid re-validating untouched legacy values
  const [original] = useState<ProfileFormValues>(() => ({
    firstName: profile?.firstName ?? "",
    lastName: profile?.lastName ?? "",
    username: profile?.username ?? "",
    mobile: profile?.mobileNumber ?? "",
    email: profile?.email ?? user?.email ?? "",
    hourlyRate: profile?.hourlyRate != null ? String(profile.hourlyRate) : "",
  }));
  const [values, setValues] = useState<ProfileFormValues>(original);
  const [originalNeighborhood] = useState(() => ({
    name: profile?.neighborhood?.name ?? "",
    radiusKm: profile?.neighborhood?.radiusKm ?? 5,
  }));

  const [neighborhoodName, setNeighborhoodName] = useState(
    originalNeighborhood.name,
  );
  const [neighborhoodRadius, setNeighborhoodRadius] = useState(
    String(originalNeighborhood.radiusKm),
  );

  const neighborhoodChanged =
    neighborhoodName.trim() !== originalNeighborhood.name.trim() ||
    Number(neighborhoodRadius) !== originalNeighborhood.radiusKm;

  const neighborhoodNameError = neighborhoodChanged
    ? !neighborhoodName.trim()
      ? "Enter your neighborhood name."
      : neighborhoodName.trim().length > 100
        ? "Use 100 characters or fewer."
        : undefined
    : undefined;

  const neighborhoodRadiusError =
    neighborhoodChanged &&
    (!neighborhoodRadius.trim() ||
      !Number.isFinite(Number(neighborhoodRadius)) ||
      Number(neighborhoodRadius) < 1 ||
      Number(neighborhoodRadius) > 50)
      ? "Enter a radius between 1 and 50 km."
      : undefined;
  const [workerType, setWorkerType] = useState<WorkerType>(
    profile?.workerType ?? "other",
  );
  const [touched, setTouched] = useState<
    Partial<Record<keyof ProfileFormValues, boolean>>
  >({});
  const [saving, setSaving] = useState(false);
  const [usernameResult, setUsernameResult] = useState<{
    name: string;
    state: Exclude<UsernameState, "idle" | "checking">;
  } | null>(null);

  // Email can only be changed for accounts that sign in with an email + password.
  // (Google/Apple accounts get their email from the provider.)
  const canEditEmail = !!auth.currentUser?.providerData.some(
    (p) => p.providerId === "password",
  );
  const isWorker = !!profile?.isWorker;

  const errors = useMemo(
    () => validateProfileForm(values, original, { canEditEmail, isWorker }),
    [values, original, canEditEmail, isWorker],
  );

  const set = (key: keyof ProfileFormValues, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setTouched((t) => ({ ...t, [key]: true }));
  };
  const blur = (key: keyof ProfileFormValues) =>
    setTouched((t) => ({ ...t, [key]: true }));

  const usernameChanged =
    normalizeUsername(values.username) !== normalizeUsername(original.username);
  const candidate = normalizeUsername(values.username);
  const needsUsernameCheck = usernameChanged && !errors.username;

  // Check availability a moment after the person stops typing
  useEffect(() => {
    if (!needsUsernameCheck || !user) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const free = await isUsernameAvailable(candidate, user.uid);
        if (!cancelled)
          setUsernameResult({
            name: candidate,
            state: free ? "available" : "taken",
          });
      } catch {
        if (!cancelled)
          setUsernameResult({ name: candidate, state: "unknown" });
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [needsUsernameCheck, candidate, user]);

  const usernameState: UsernameState = !needsUsernameCheck
    ? "idle"
    : usernameResult?.name === candidate
      ? usernameResult.state
      : "checking";

  const nameChanged =
    values.firstName.trim() !== original.firstName.trim() ||
    values.lastName.trim() !== original.lastName.trim();
  const phoneChanged = values.mobile.trim() !== original.mobile.trim();
  const emailChanged =
    canEditEmail &&
    values.email.trim().toLowerCase() !== original.email.trim().toLowerCase();
  const rateChanged =
    isWorker && values.hourlyRate.trim() !== original.hourlyRate.trim();
  const typeChanged =
    isWorker && workerType !== (profile?.workerType ?? "other");
  const anyChange =
    nameChanged ||
    usernameChanged ||
    phoneChanged ||
    emailChanged ||
    rateChanged ||
    typeChanged ||
    neighborhoodChanged;

  const hasErrors =
    Object.keys(errors).length > 0 ||
    !!neighborhoodNameError ||
    !!neighborhoodRadiusError;
  const blocked =
    hasErrors || usernameState === "checking" || usernameState === "taken";
  const canSave = anyChange && !blocked && !saving;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !canSave) return;
    setSaving(true);

    let claimedNewUsername = false;
    const newUsername = candidate;
    const oldUsername = original.username;
    try {
      // 1) Username first: it is the only step that can legitimately lose a race against another person
      if (usernameChanged) {
        try {
          await changeUsername({
            uid: user.uid,
            email: user.email ?? values.email,
            oldUsername,
            newUsername,
          });
          claimedNewUsername = true;
        } catch (err) {
          if (err instanceof UsernameTakenError) {
            setUsernameResult({ name: newUsername, state: "taken" });
            haptics.heavy();
            toast.error("Username already taken");
            return;
          }
          throw err;
        }
      }

      // 2) The profile document
      const first = values.firstName.trim();
      const last = values.lastName.trim();
      const fullName = [first, last].filter(Boolean).join(" ");
      const updates: Record<string, unknown> = {};
      if (nameChanged)
        Object.assign(updates, {
          firstName: first,
          lastName: last,
          fullName,
          displayName: fullName,
        });
      if (usernameChanged) updates.username = newUsername;
      if (phoneChanged) updates.mobileNumber = cleanMobile(values.mobile);
      if (rateChanged) updates.hourlyRate = Number(values.hourlyRate) || 0;
      if (typeChanged) updates.workerType = workerType;
      if (neighborhoodChanged) {
        updates.neighborhood = {
          name: neighborhoodName.trim(),
          radiusKm: Number(neighborhoodRadius),
        };
      }

      if (Object.keys(updates).length > 0) {
        await setDoc(
          doc(db, "users", user.uid),
          { ...updates, updatedAt: serverTimestamp() },
          { merge: true },
        );
        await updateProfile(updates as any); // refresh the in-app copy
      }

      // 3) Display name on the sign-in account too
      if (nameChanged && auth.currentUser) {
        try {
          await updateAuthProfile(auth.currentUser, { displayName: fullName });
        } catch (err) {
          console.warn(
            "[EditProfile] Auth displayName not updated (profile document is):",
            err,
          );
        }
      }

      // 4) Email: Firebase sends a verification link; the email only changes once it is confirmed
      let emailNote = "";
      let emailProblem = "";
      if (emailChanged && auth.currentUser) {
        try {
          await verifyBeforeUpdateEmail(auth.currentUser, values.email.trim());
          emailNote = ` We sent a verification link to ${values.email.trim()}. Your email changes once you confirm it.`;
        } catch (err) {
          emailProblem = friendlyEmailError(err);
        }
      }

      haptics.success();
      const phoneNote = phoneChanged
        ? " Your new number is saved but not verified yet."
        : "";
      toast.success(`Profile updated successfully!${phoneNote}${emailNote}`);
      if (emailProblem)
        toast.error(`Your email was not changed: ${emailProblem}`);
      onDone();
    } catch (err: any) {
      console.warn("[EditProfile] save failed:", err);
      // Give the username back if the rest of the save did not go through
      if (claimedNewUsername) {
        changeUsername({
          uid: user.uid,
          email: user.email ?? values.email,
          oldUsername: newUsername,
          newUsername: oldUsername || newUsername,
        }).catch(() => {});
      }
      haptics.heavy();
      const denied = err?.code === "permission-denied";
      toast.error(
        denied
          ? "We couldn't save your changes (permission denied). Please try again later."
          : err?.message || "We couldn't save your changes. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const showErr = (k: keyof ProfileFormValues) =>
    touched[k] || anyChange ? errors[k] : undefined;
  return (
    <form
      onSubmit={handleSave}
      noValidate
      className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]"
      aria-busy={saving}
    >
      <button
        type="button"
        disabled={saving}
        onClick={() => {
          if (
            !anyChange ||
            window.confirm(
              "Discard your unsaved form changes? Uploaded photos are already saved.",
            )
          ) {
            onDone();
          }
        }}
        className="inline-flex min-h-11 items-center gap-2 justify-self-start rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 lg:col-span-2 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <span aria-hidden="true">←</span>
        Back to profile
      </button>
      <aside className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Profile photo
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Choose a photo that helps your community recognize you.
        </p>
        <div className="my-6 flex justify-center">
          <AvatarUploader
            toast={toast}
            avatarClassName="h-28 w-28 rounded-3xl"
            overlayClassName="rounded-3xl"
          />
        </div>
        <p className="text-center text-sm text-slate-600 dark:text-slate-300">
          JPG, PNG or WebP. Maximum 5 MB.
        </p>
        <div className="mt-6 rounded-xl bg-indigo-50 p-4 text-sm leading-6 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200">
          Photo changes save immediately. Use Save changes for the details in
          the form.
        </div>
      </aside>
      <section className="min-w-0 space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 pb-5 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Personal information
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Keep your name and contact details up to date.
          </p>
        </div>
        <fieldset
          disabled={saving}
          className="min-w-0 space-y-6 border-0 p-0 m-0"
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="ep-first" className={LABEL}>
                First name
              </label>
              <input
                id="ep-first"
                value={values.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                onBlur={() => blur("firstName")}
                autoComplete="given-name"
                placeholder="John"
                className={`${INPUT} ${showErr("firstName") ? INPUT_ERROR : ""}`}
              />
              <FieldError msg={showErr("firstName")} />
            </div>
            <div className="space-y-2">
              <label htmlFor="ep-last" className={LABEL}>
                Last name
              </label>
              <input
                id="ep-last"
                value={values.lastName}
                onChange={(e) => set("lastName", e.target.value)}
                onBlur={() => blur("lastName")}
                autoComplete="family-name"
                placeholder="Doe"
                className={`${INPUT} ${showErr("lastName") ? INPUT_ERROR : ""}`}
              />
              <FieldError msg={showErr("lastName")} />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="ep-username" className={LABEL}>
              Username
            </label>
            <div className="relative">
              <AtSign
                size={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-300"
              />
              <input
                id="ep-username"
                value={values.username}
                onChange={(e) => set("username", e.target.value)}
                onBlur={() => blur("username")}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                className={`${INPUT} pl-11 pr-12 ${showErr("username") || usernameState === "taken" ? INPUT_ERROR : ""}`}
              />
              <span
                className="absolute right-4 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              >
                {usernameState === "checking" && (
                  <Loader2
                    size={16}
                    className="animate-spin text-slate-600 dark:text-slate-300"
                  />
                )}
                {usernameState === "available" && (
                  <CheckCircle2 size={16} className="text-emerald-500" />
                )}
                {usernameState === "taken" && (
                  <AlertCircle size={16} className="text-rose-500" />
                )}
              </span>
            </div>
            <FieldError
              msg={
                showErr("username") ||
                (usernameState === "taken"
                  ? "Username already taken"
                  : undefined)
              }
            />
            {usernameState === "available" && (
              <p className="ml-1 mt-1 text-sm font-bold text-emerald-600">
                @{candidate} is available
              </p>
            )}
            {usernameState === "unknown" && (
              <p className="ml-1 mt-1 text-sm font-bold text-slate-600 dark:text-slate-300">
                We couldn't check this username right now. It will be checked
                when you save.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="ep-phone" className={LABEL}>
              Mobile number
            </label>
            <div className="relative">
              <Phone
                size={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-300"
              />
              <input
                id="ep-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={values.mobile}
                onChange={(e) => set("mobile", e.target.value)}
                onBlur={() => blur("mobile")}
                placeholder="+44 7700 900123"
                className={`${INPUT} pl-11 ${showErr("mobile") ? INPUT_ERROR : ""}`}
              />
            </div>
            <FieldError msg={showErr("mobile")} />
            {phoneChanged && !errors.mobile && (
              <p className="ml-1 mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">
                A changed number is saved as unverified until SMS verification
                is available.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="ep-email" className={LABEL}>
              Email address
            </label>
            <div className="relative">
              <Mail
                size={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-300"
              />
              <input
                id="ep-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={values.email}
                onChange={(e) => set("email", e.target.value)}
                onBlur={() => blur("email")}
                disabled={!canEditEmail}
                className={`${INPUT} pl-11 disabled:opacity-60 ${showErr("email") ? INPUT_ERROR : ""}`}
              />
            </div>
            <FieldError msg={showErr("email")} />
            {!canEditEmail && (
              <p className="ml-1 mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">
                Your email comes from your Google or Apple sign-in, so it can't
                be changed here.
              </p>
            )}
            {emailChanged && !errors.email && (
              <p className="ml-1 mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">
                We'll email a verification link to the new address. Your email
                only changes once you confirm it.
              </p>
            )}
          </div>

          {isWorker && (
            <div className="space-y-4 border-t border-slate-100 pt-2">
              <div className="space-y-2">
                <label htmlFor="ep-rate" className={LABEL}>
                  Hourly rate (£)
                </label>
                <input
                  id="ep-rate"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={values.hourlyRate}
                  onChange={(e) => set("hourlyRate", e.target.value)}
                  onBlur={() => blur("hourlyRate")}
                  placeholder="25"
                  className={`${INPUT} ${showErr("hourlyRate") ? INPUT_ERROR : ""}`}
                />
                <FieldError msg={showErr("hourlyRate")} />
              </div>
              <div className="space-y-2">
                <label htmlFor="ep-type" className={LABEL}>
                  Worker speciality
                </label>
                <select
                  id="ep-type"
                  value={workerType}
                  onChange={(e) => setWorkerType(e.target.value as WorkerType)}
                  className={`${INPUT} appearance-none`}
                >
                  {WORKER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace("_", " ").toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <div className="space-y-5 border-t border-slate-200 pt-6 dark:border-slate-700">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Your neighborhood
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Choose your preferred area and radius. This does not change your
                current GPS location.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="ep-neighborhood" className={LABEL}>
                  Neighborhood or area
                </label>
                <input
                  id="ep-neighborhood"
                  value={neighborhoodName}
                  onChange={(event) => setNeighborhoodName(event.target.value)}
                  maxLength={100}
                  placeholder="e.g. Shoreditch, London"
                  aria-invalid={!!neighborhoodNameError}
                  aria-describedby="ep-neighborhood-help ep-neighborhood-error"
                  className={`${INPUT} ${neighborhoodNameError ? INPUT_ERROR : ""}`}
                />
                <p
                  id="ep-neighborhood-help"
                  className="text-sm text-slate-600 dark:text-slate-300"
                >
                  Enter an area, rather than your full home address.
                </p>
                <div id="ep-neighborhood-error">
                  <FieldError msg={neighborhoodNameError} />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="ep-neighborhood-radius" className={LABEL}>
                  Preferred radius (km)
                </label>
                <input
                  id="ep-neighborhood-radius"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  max={50}
                  step="any"
                  value={neighborhoodRadius}
                  onChange={(event) =>
                    setNeighborhoodRadius(event.target.value)
                  }
                  aria-invalid={!!neighborhoodRadiusError}
                  aria-describedby="ep-radius-help ep-radius-error"
                  className={`${INPUT} ${neighborhoodRadiusError ? INPUT_ERROR : ""}`}
                />
                <p
                  id="ep-radius-help"
                  className="text-sm text-slate-600 dark:text-slate-300"
                >
                  Choose between 1 and 50 kilometres.
                </p>
                <div id="ep-radius-error">
                  <FieldError msg={neighborhoodRadiusError} />
                </div>
              </div>
            </div>
          </div>
        </fieldset>
        <footer className="flex flex-col gap-4 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
          <p
            role="status"
            className="text-sm text-slate-600 dark:text-slate-300"
          >
            {saving
              ? "Saving your changes…"
              : !anyChange
                ? "No unsaved changes."
                : blocked
                  ? "Please resolve the highlighted fields before saving."
                  : "You have unsaved changes."}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                if (
                  !anyChange ||
                  window.confirm(
                    "Discard your unsaved form changes? Uploaded photos are already saved.",
                  )
                )
                  onDone();
              }}
              className="min-h-11 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-600 dark:disabled:bg-slate-700 dark:disabled:text-slate-300"
            >
              {saving ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <CheckCircle2 size={17} />
              )}
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </footer>
      </section>
    </form>
  );
}
