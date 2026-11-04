import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { BriefcaseBusiness, Users, MapPin, ArrowLeft } from 'lucide-react';
import { saveOnboarding } from './saveOnboarding';
import type {
  OnboardingChoices,
  OnboardingRole,
} from './saveOnboarding';

interface OnboardingFlowProps {
  onComplete: () => void;
  initialChoices?: Partial<OnboardingChoices>;
}

const roles: {
  value: OnboardingRole;
  title: string;
  description: string;
  icon: typeof Users;
}[] = [
  {
    value: 'community_member',
    title: 'Community member',
    description: 'Find local services and connect with your neighborhood.',
    icon: Users,
  },
  {
    value: 'service_provider',
    title: 'Service provider',
    description: 'Offer your skills and connect with people who need them.',
    icon: BriefcaseBusiness,
  },
];

export function OnboardingFlow({
  onComplete,
  initialChoices,
}: OnboardingFlowProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<OnboardingRole | undefined>(
    initialChoices?.role,
  );
  const [neighborhoodName, setNeighborhoodName] = useState(
    initialChoices?.neighborhoodName ?? '',
  );
  const [radiusKm, setRadiusKm] = useState(
    initialChoices?.radiusKm ?? 5,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  function changeStep(next: 1 | 2) {
    setError('');
    setStep(next);
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (savingRef.current) return;

    if (!role) {
      setError('Choose how you want to use KonnectS.');
      return;
    }

    if (step === 1) {
      changeStep(2);
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setError('');

    try {
      await saveOnboarding({
        role,
        neighborhoodName,
        radiusKm,
      });
    } catch {
      setError(
        'We couldn’t save your choices. Check your connection and try again.',
      );
      savingRef.current = false;
      setSaving(false);
      return;
    }

    savingRef.current = false;
    setSaving(false);
    onComplete();
  }

  const inputClass =
    'mt-2 min-h-12 w-full rounded-xl border border-slate-300 ' +
    'bg-white px-4 py-3 text-base text-slate-900 ' +
    'focus:outline-none focus:ring-2 focus:ring-indigo-500 ' +
    'dark:border-slate-600 dark:bg-slate-900 dark:text-white';

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:flex lg:items-center lg:py-12 dark:bg-slate-950 dark:text-white">
      <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[340px_minmax(0,1fr)] dark:border-slate-800 dark:bg-slate-900">
        <aside className="bg-indigo-700 p-6 text-white sm:p-8 lg:p-10">
          <p className="text-sm font-semibold tracking-widest">
            KONNECTS
          </p>

          <h1 className="mt-6 text-3xl font-bold leading-tight lg:mt-12">
            Make yourself at home.
          </h1>

          <p className="mt-4 leading-relaxed text-indigo-100">
            Tell us how you want to use KonnectS and which neighborhood
            you’re interested in.
          </p>

          <ol aria-label="Setup progress" className="mt-8 space-y-4">
            {['Your role', 'Your neighborhood'].map((label, index) => (
              <li
                key={label}
                aria-current={step === index + 1 ? 'step' : undefined}
                className="flex items-center gap-3"
              >
                <span
                  className={
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold ' +
                    (step === index + 1
                      ? 'border-white bg-white text-indigo-700'
                      : 'border-indigo-300 text-white')
                  }
                >
                  {index + 1}
                </span>
                <span className="font-medium">{label}</span>
              </li>
            ))}
          </ol>
        </aside>

        <section className="min-w-0 p-6 sm:p-8 lg:p-10">
          <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
            Step {step} of 2
          </p>

          <h2
            ref={headingRef}
            tabIndex={-1}
            className="mt-3 text-2xl font-bold focus:outline-none sm:text-3xl"
          >
            {step === 1
              ? 'How will you use KonnectS?'
              : 'Choose your neighborhood'}
          </h2>

          <p className="mt-3 leading-relaxed text-slate-600 dark:text-slate-300">
            {step === 1
              ? 'Choose the option that best describes your main reason for joining.'
              : 'Enter an area and choose how far around it you want to explore.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-8">
            <fieldset disabled={saving} className="space-y-5">
              <legend className="sr-only">
                {step === 1 ? 'Choose your role' : 'Neighborhood preferences'}
              </legend>

              {step === 1 ? (
                <>
                  {roles.map((option) => {
                    const Icon = option.icon;
                    const selected = role === option.value;

                    return (
                      <label
                        key={option.value}
                        className={
                          'flex cursor-pointer items-start gap-4 rounded-2xl border-2 p-5 transition focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 ' +
                          (selected
                            ? 'border-indigo-600 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950'
                            : 'border-slate-200 bg-white hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-900')
                        }
                      >
                        <input
                          type="radio"
                          name="onboardingRole"
                          value={option.value}
                          checked={selected}
                          onChange={() => {
                            setRole(option.value);
                            setError('');
                          }}
                          required
                          className="mt-1 h-5 w-5 shrink-0 accent-indigo-600"
                        />

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Icon
                              size={20}
                              aria-hidden="true"
                              className="shrink-0 text-indigo-600 dark:text-indigo-300"
                            />
                            <span className="font-semibold">
                              {option.title}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                            {option.description}
                          </p>
                        </div>
                      </label>
                    );
                  })}

                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    Selecting service provider records your interest.
                    Provider setup and verification are separate steps.
                  </p>
                </>
              ) : (
                <>
                  <div>
                    <label
                      htmlFor="onboarding-neighborhood"
                      className="flex items-center gap-2 font-medium"
                    >
                      <MapPin size={18} aria-hidden="true" />
                      Neighborhood or area
                    </label>

                    <input
                      id="onboarding-neighborhood"
                      type="text"
                      value={neighborhoodName}
                      onChange={(event) => {
                        setNeighborhoodName(event.target.value);
                        setError('');
                      }}
                      placeholder="e.g. Shoreditch, London"
                      maxLength={100}
                      required
                      pattern=".*\S.*"
                      title="Enter a neighborhood name, not only spaces."
                      aria-describedby="neighborhood-help"
                      className={inputClass}
                    />

                    <p
                      id="neighborhood-help"
                      className="mt-2 text-sm text-slate-600 dark:text-slate-300"
                    >
                      Use a neighborhood name rather than your full home
                      address. GPS access isn’t required.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="onboarding-radius"
                      className="font-medium"
                    >
                      Preferred radius
                    </label>

                    <select
                      id="onboarding-radius"
                      value={radiusKm}
                      onChange={(event) =>
                        setRadiusKm(Number(event.target.value))
                      }
                      className={inputClass}
                    >
                      {[1, 2, 5, 10, 25, 50].map((radius) => (
                        <option key={radius} value={radius}>
                          Within {radius} km
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-xl bg-slate-100 p-4 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    Joining as:{' '}
                    <strong>
                      {roles.find((option) => option.value === role)?.title}
                    </strong>
                  </div>
                </>
              )}
            </fieldset>

            {error && (
              <p
                role="alert"
                className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950 dark:text-red-200"
              >
                {error}
              </p>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              {step === 2 && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => changeStep(1)}
                  className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-300 px-5 py-3 font-semibold hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
                >
                  <ArrowLeft size={18} aria-hidden="true" />
                  Back
                </button>
              )}

              <button
                type="submit"
                disabled={saving || !role}
                className="ml-auto min-h-12 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? 'Saving…'
                  : step === 1
                    ? 'Continue'
                    : 'Finish setup'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}