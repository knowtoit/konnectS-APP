import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';

export type OnboardingRole =
  | 'service_provider'
  | 'community_member';

export interface OnboardingChoices {
  role: OnboardingRole;
  neighborhoodName: string;
  radiusKm: number;
}

export async function saveOnboarding(
  choices: OnboardingChoices,
): Promise<void> {
  const user = auth.currentUser;

  if (!user || user.isAnonymous) {
    throw new Error('Please sign in to save your onboarding choices.');
  }

  if (
    choices.role !== 'service_provider' &&
    choices.role !== 'community_member'
  ) {
    throw new Error('Choose how you want to use KonnectS.');
  }

  const name = choices.neighborhoodName.trim();

  if (!name || name.length > 100) {
    throw new Error('Enter a neighborhood name between 1 and 100 characters.');
  }

  if (
    !Number.isFinite(choices.radiusKm) ||
    choices.radiusKm < 1 ||
    choices.radiusKm > 50
  ) {
    throw new Error('Choose a radius between 1 and 50 kilometres.');
  }

  await updateDoc(doc(db, 'users', user.uid), {
    onboardingRole: choices.role,
    neighborhood: {
      name,
      radiusKm: choices.radiusKm,
    },
    hasCompletedOnboarding: true,
    updatedAt: serverTimestamp(),
  });
}