/**
 * Service to determine if a user is a truly new install vs an existing user
 * For the new paywall-first onboarding flow
 */

const NEW_USER_KEY = 'godlykids_is_new_user';
const FIRST_LAUNCH_KEY = 'godlykids_first_launch_timestamp';
const HAS_SEEN_OLD_ONBOARDING_KEY = 'godly_kids_data_v7'; // Old onboarding data
const HAS_ACCOUNT_KEY = 'godlykids_user_email';

export interface UserType {
  isNewInstall: boolean;
  isExistingUser: boolean;
  firstLaunchTimestamp: number | null;
  hasAccount: boolean;
  hasSeenOldOnboarding: boolean;
}

/**
 * Determine if this is a truly new install
 * A new install means:
 * - Never launched the app before (no first launch timestamp)
 * - Never completed old onboarding
 * - No account created
 */
export function getUserType(): UserType {
  // Check if they've launched the app before
  const firstLaunch = localStorage.getItem(FIRST_LAUNCH_KEY);
  const hasSeenOldOnboarding = !!localStorage.getItem(HAS_SEEN_OLD_ONBOARDING_KEY);
  const hasAccount = !!localStorage.getItem(HAS_ACCOUNT_KEY);
  
  // If this is their very first time opening the app (no timestamp set yet)
  const isNewInstall = !firstLaunch && !hasSeenOldOnboarding && !hasAccount;
  
  // Mark first launch if this is a new install
  if (isNewInstall && !firstLaunch) {
    const now = Date.now();
    localStorage.setItem(FIRST_LAUNCH_KEY, now.toString());
    localStorage.setItem(NEW_USER_KEY, 'true');
  }
  
  return {
    isNewInstall,
    isExistingUser: !isNewInstall,
    firstLaunchTimestamp: firstLaunch ? parseInt(firstLaunch, 10) : null,
    hasAccount,
    hasSeenOldOnboarding,
  };
}

/**
 * Check if user should see the new paywall-first flow
 */
export function shouldSeeNewOnboardingFlow(): boolean {
  const { isNewInstall } = getUserType();
  return isNewInstall;
}

/**
 * Mark that user has seen the new onboarding (so they don't see it again)
 */
export function markNewOnboardingComplete(): void {
  localStorage.setItem('godlykids_new_onboarding_complete', 'true');
}

/**
 * Check if user has completed the new onboarding
 */
export function hasCompletedNewOnboarding(): boolean {
  return localStorage.getItem('godlykids_new_onboarding_complete') === 'true';
}
