import { useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Award,
  CheckCircle2,
  ChevronRight,
  Clock3,
  LogOut,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Settings,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { UserProfile } from "../../types";
import { AvatarUploader } from "./AvatarUploader";
import type { ToastApi } from "./useToast";

interface ProfileAction {
  label: string;
  value: string;
}

interface ProfileOverviewProps {
  profile: UserProfile | null;
  toast: ToastApi;
  actions: ProfileAction[];
  onOpen: (view: string) => void;
  onLogout: () => void | Promise<void>;
  accountControls: ReactNode;
}

const panel =
  "min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm " +
  "dark:border-slate-800 dark:bg-slate-900";

const secondaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl " +
  "border border-slate-200 bg-white px-4 py-2 text-sm font-semibold " +
  "text-slate-700 transition hover:bg-slate-50 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 " +
  "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 " +
  "dark:hover:bg-slate-800";

function Detail({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value?: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <div className="mt-1 shrink-0 text-slate-400">{icon}</div>
      <div className="min-w-0">
        <dt className="text-xs font-medium text-slate-600 dark:text-slate-400">
          {label}
        </dt>
        <dd className="mt-1 break-words text-sm font-medium text-slate-900 dark:text-slate-100">
          {value || "Not added yet"}
        </dd>
      </div>
    </div>
  );
}

export function ProfileOverview({
  profile,
  toast,
  actions,
  onOpen,
  onLogout,
  accountControls,
}: ProfileOverviewProps) {
  const [loggingOut, setLoggingOut] = useState(false);

  if (!profile) {
    return (
      <section className={`${panel} p-8`} role="status">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
          Loading your profile
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Your account details will appear here when available.
        </p>
      </section>
    );
  }

  const name =
    profile.fullName?.trim() ||
    [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
    profile.displayName ||
    profile.username ||
    "Community member";

  const role =
    profile.onboardingRole === "service_provider"
      ? "Service provider"
      : profile.onboardingRole === "community_member"
        ? "Community member"
        : profile.isWorker
          ? "Service provider"
          : "Community member";

  const address =
    profile.neighborhood?.name?.trim() || profile.location?.address?.trim();

  const radiusKm = profile.neighborhood?.radiusKm;

  const radiusLabel =
    profile.neighborhood?.name?.trim() &&
    typeof radiusKm === "number" &&
    Number.isFinite(radiusKm) &&
    radiusKm >= 1 &&
    radiusKm <= 50
      ? `Within ${radiusKm} km`
      : undefined;
  const points = Number.isFinite(profile.rewardsPoints)
    ? Math.max(0, profile.rewardsPoints)
    : 0;
  const badges = [...new Set(profile.earnedBadges || [])];

  const details = [
    Boolean(profile.firstName || profile.fullName || profile.displayName),
    Boolean(profile.username),
    Boolean(profile.email),
    Boolean(profile.mobileNumber),
    Boolean(address),
    Boolean(profile.bio),
  ];
  const completed = details.filter(Boolean).length;
  const completion = Math.round((completed / details.length) * 100);

  const verified = profile.verificationStatus === "verified";
  const pending =
    profile.verificationStatus === "pending" ||
    profile.verificationStatus === "in_progress";
  const rejected = profile.verificationStatus === "rejected";

  const verificationLabel = verified
    ? "Identity verified"
    : pending
      ? "Verification in progress"
      : rejected
        ? "Verification needs attention"
        : "Identity not verified";

  const verificationDescription = verified
    ? "Your profile has an approved identity-verification status."
    : pending
      ? "Your verification is in progress. Check its status for further details."
      : rejected
        ? "Review the verification screen for the next steps."
        : "Review the available verification steps for your account.";

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await onLogout();
    } catch {
      toast.error("Could not sign out. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      {/* Desktop page heading */}
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            Your KonnectS account
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">My profile</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Manage your identity, community presence, and account details.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onOpen("edit")}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <Pencil size={16} aria-hidden="true" />
          Edit profile
        </button>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Left column */}
        <aside className="min-w-0 space-y-5">
          <section className={`${panel} overflow-hidden`}>
            <div className="h-20 bg-gradient-to-r from-indigo-600 to-violet-500" />

            <div className="px-6 pb-6">
              <div className="-mt-10 inline-block rounded-3xl bg-white p-1.5 dark:bg-slate-900">
                <AvatarUploader
                  toast={toast}
                  avatarClassName="h-20 w-20 rounded-2xl"
                  overlayClassName="rounded-2xl"
                />
              </div>

              <h2 className="mt-4 break-words text-xl font-bold">{name}</h2>
              <p className="mt-1 break-all text-sm text-slate-600 dark:text-slate-400">
                @{profile.username}
              </p>

              <span className="mt-4 inline-flex rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                {role}
              </span>

              <div className="mt-5 flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                <MapPin
                  size={17}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <span className="min-w-0 break-words">
                  {address || "Neighborhood not selected"}
                </span>
              </div>

              <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">Profile completeness</span>
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    {completion}%
                  </span>
                </div>
                <progress
                  value={completed}
                  max={details.length}
                  aria-label="Profile completeness"
                  className="mt-3 h-2 w-full overflow-hidden rounded-full accent-indigo-600"
                />
                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {completed} of {details.length} basic details added.
                </p>
              </div>
            </div>
          </section>

          <section className={`${panel} p-5`}>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Account controls
            </h2>
            <div className="mt-4 space-y-5">{accountControls}</div>
          </section>
          <nav className={`${panel} p-3`} aria-label="Profile sections">
            <div
              aria-current="page"
              className="flex min-h-11 items-center gap-3 rounded-xl bg-indigo-50 px-3 py-3 text-sm font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
            >
              <UserRound size={18} aria-hidden="true" />
              Profile overview
            </div>

            {[
              { label: "Edit personal details", value: "edit", icon: Pencil },
              {
                label: "Verification",
                value: "verification",
                icon: ShieldCheck,
              },
              { label: "Rewards & badges", value: "rewards", icon: Award },
              { label: "Account settings", value: "settings", icon: Settings },
            ].map(({ label, value, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => onOpen(value)}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Icon size={18} className="shrink-0" aria-hidden="true" />
                {label}
                <ChevronRight size={15} className="ml-auto shrink-0" />
              </button>
            ))}

            <div className="my-2 border-t border-slate-100 dark:border-slate-800" />

            <button
              type="button"
              disabled={loggingOut}
              onClick={handleLogout}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-950"
            >
              <LogOut size={18} aria-hidden="true" />
              {loggingOut ? "Signing out…" : "Sign out"}
            </button>
          </nav>
        </aside>

        {/* Right column */}
        <main className="min-w-0 space-y-6">
          <section className={`${panel} p-5 sm:p-6`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Personal details</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Your account and contact information.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpen("edit")}
                className={secondaryButton}
              >
                <Pencil size={15} />
                Edit
              </button>
            </div>

            <dl className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2">
              <Detail
                icon={<UserRound size={18} />}
                label="Name"
                value={name}
              />
              <Detail
                icon={<Mail size={18} />}
                label="Email"
                value={profile.email}
              />
              <Detail
                icon={<Phone size={18} />}
                label="Mobile number"
                value={profile.mobileNumber}
              />
              <Detail
                icon={<MapPin size={18} />}
                label="Neighborhood"
                value={address}
              />
              <Detail
                icon={<UserRound size={18} />}
                label="Joining as"
                value={role}
              />
              <Detail
                icon={<MapPin size={18} />}
                label="Preferred radius"
                value={radiusLabel}
              />
            </dl>

            <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
              <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">
                About you
              </h3>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
                {profile.bio || "You haven’t added an introduction yet."}
              </p>
            </div>
          </section>

          <div className="grid items-start gap-6 xl:grid-cols-2">
            <section className={`${panel} p-5 sm:p-6`}>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                {verified ? (
                  <CheckCircle2 size={22} />
                ) : (
                  <ShieldCheck size={22} />
                )}
              </div>
              <h2 className="mt-4 text-lg font-semibold">Verification</h2>
              <p className="mt-2 text-sm font-medium">{verificationLabel}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                {verificationDescription}
              </p>
              <button
                type="button"
                onClick={() => onOpen("verification")}
                className={`${secondaryButton} mt-5`}
              >
                View verification
                <ArrowUpRight size={16} />
              </button>
            </section>

            <section className={`${panel} p-5 sm:p-6`}>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                <Award size={22} />
              </div>
              <h2 className="mt-4 text-lg font-semibold">Community rewards</h2>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight">
                  {points.toLocaleString()}
                </span>
                <span className="text-sm text-slate-600">reward points</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                Your saved reward balance. Contribution XP is not included.
              </p>
              <button
                type="button"
                onClick={() => onOpen("rewards")}
                className={`${secondaryButton} mt-5`}
              >
                View rewards
                <ArrowUpRight size={16} />
              </button>
            </section>
          </div>

          <section className={`${panel} p-5 sm:p-6`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Earned badges</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold dark:bg-slate-800">
                {badges.length} earned
              </span>
            </div>

            {badges.length ? (
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {badges.map((badge) => (
                  <li
                    key={badge}
                    className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-100 p-4 dark:border-slate-800"
                  >
                    <Award className="shrink-0 text-indigo-500" size={22} />
                    <span className="break-words text-sm font-semibold capitalize">
                      {badge.replace(/[_-]/g, " ")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-5 rounded-xl border border-dashed border-slate-200 p-6 text-center dark:border-slate-700">
                <Award size={26} className="mx-auto text-slate-400" />
                <p className="mt-3 text-sm font-semibold">
                  No badges earned yet
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Badges will appear here when they’re recorded on your profile.
                </p>
              </div>
            )}
          </section>

          <section className={`${panel} p-5 sm:p-6`}>
            <h2 className="text-lg font-semibold">More account tools</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Your existing activity, preferences, and account features.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {actions.map((action) => (
                <button
                  key={action.value}
                  type="button"
                  onClick={() => onOpen(action.value)}
                  className="flex min-h-12 min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 text-left text-sm font-medium transition hover:border-indigo-300 hover:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <span className="min-w-0 break-words">{action.label}</span>
                  <ChevronRight size={16} className="shrink-0 text-slate-400" />
                </button>
              ))}
            </div>
          </section>

          <p className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <Clock3 size={14} className="shrink-0" />
            Profile details reflect the currently loaded account.
          </p>
        </main>
      </div>
    </div>
  );
}
