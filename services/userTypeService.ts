/**
 * Service to determine if a user is a truly new install vs an existing user
 * For the new paywall-first onboarding flow
 *
 * CRITICAL:
 * - New install with NO completed-user signals → new paywall-first flow (persists through relaunches)
 * - Anyone who actually used the app (completed onboarding, account, tutorial, premium) → OLD path
 *
 * Do NOT treat a default UserContext write of godly_kids_data_v6 (parentName: "Parent", no kids)
 * as an existing user. That key is written on first app load for everyone.
 */

const NEW_USER_COHORT_KEY = 'godlykids_new_user_cohort';
const NEW_ONBOARDING_COMPLETE_KEY = 'godlykids_new_onboarding_complete';
const FORCE_NEW_ONBOARDING_KEY = 'godlykids_force_new_onboarding';

export interface UserType {
  isNewInstall: boolean;
  isExistingUser: boolean;
  hasAnyExistingUserSignal: boolean;
  inNewUserCohort: boolean;
  hasCompletedNewOnboarding: boolean;
}

function parseUserDataBlob(raw: string | null): any | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * True only when saved user data shows they already completed (or started) the old product.
 * Default first-load state is { parentName: "Parent", kids: [] } — that is NOT existing.
 */
function hasCompletedLegacyOnboarding(): boolean {
  const data =
    parseUserDataBlob(localStorage.getItem('godly_kids_data_v7')) ||
    parseUserDataBlob(localStorage.getItem('godly_kids_data_v6'));
  if (!data) return false;

  const parentName = typeof data.parentName === 'string' ? data.parentName.trim() : '';
  const hasRealParent = parentName !== '' && parentName !== 'Parent';
  const hasKids = Array.isArray(data.kids) && data.kids.length > 0;
  const isSubscribed = data.isSubscribed === true;

  return hasRealParent || hasKids || isSubscribed;
}

/**
 * Reviewer / QA override: #/?newOnboarding=1 or localStorage godlykids_force_new_onboarding=true
 */
export function isForcedNewOnboarding(): boolean {
  try {
    if (localStorage.getItem(FORCE_NEW_ONBOARDING_KEY) === 'true') return true;
    const hash = window.location.hash || '';
    const query = hash.includes('?') ? hash.slice(hash.indexOf('?')) : window.location.search;
    return /(?:\?|&)newOnboarding=1(?:&|$)/.test(query);
  } catch {
    return false;
  }
}

/**
 * Check if user has ANY signal that indicates they're an existing user
 * who must keep the old path (never hard-wall).
 */
function hasAnyExistingUserSignal(): boolean {
  if (localStorage.getItem('godlykids_auth_token')) return true;
  if (localStorage.getItem('godlykids_user_email')) return true;
  if (localStorage.getItem('godlykids_premium') === 'true') return true;
  if (localStorage.getItem('godlykids_tutorial_complete') === 'true') return true;
  if (hasCompletedLegacyOnboarding()) return true;
  return false;
}

/**
 * Determine if this is a truly new install
 *
 * Logic:
 * 1. QA force flag → new flow
 * 2. If they have ANY real existing-user signal → existing user (never hard-wall)
 * 3. If they're marked as new user cohort → new user (persists through relaunches)
 * 4. If completed new onboarding → existing user now
 * 5. Otherwise → new install, mark them as new cohort
 */
export function getUserType(): UserType {
  const forced = isForcedNewOnboarding();
  const hasExistingSignal = !forced && hasAnyExistingUserSignal();
  const inNewUserCohort = localStorage.getItem(NEW_USER_COHORT_KEY) === 'true';
  const completedNewOnboarding = localStorage.getItem(NEW_ONBOARDING_COMPLETE_KEY) === 'true';

  if (hasExistingSignal) {
    return {
      isNewInstall: false,
      isExistingUser: true,
      hasAnyExistingUserSignal: true,
      inNewUserCohort: false,
      hasCompletedNewOnboarding: completedNewOnboarding,
    };
  }

  if (!forced && completedNewOnboarding) {
    return {
      isNewInstall: false,
      isExistingUser: true,
      hasAnyExistingUserSignal: false,
      inNewUserCohort: false,
      hasCompletedNewOnboarding: true,
    };
  }

  if (inNewUserCohort || forced) {
    if (!inNewUserCohort) {
      localStorage.setItem(NEW_USER_COHORT_KEY, 'true');
    }
    return {
      isNewInstall: true,
      isExistingUser: false,
      hasAnyExistingUserSignal: false,
      inNewUserCohort: true,
      hasCompletedNewOnboarding: false,
    };
  }

  localStorage.setItem(NEW_USER_COHORT_KEY, 'true');
  console.log('🆕 New user detected - marked as new cohort for paywall-first flow');

  return {
    isNewInstall: true,
    isExistingUser: false,
    hasAnyExistingUserSignal: false,
    inNewUserCohort: true,
    hasCompletedNewOnboarding: false,
  };
}

/**
 * Check if user should see the new paywall-first flow
 */
export function shouldSeeNewOnboardingFlow(): boolean {
  if (isForcedNewOnboarding()) return true;
  const userType = getUserType();
  if (userType.hasAnyExistingUserSignal) return false;
  if (userType.hasCompletedNewOnboarding) return false;
  return userType.isNewInstall || userType.inNewUserCohort;
}

/**
 * Mark that user has completed the new onboarding
 */
export function markNewOnboardingComplete(): void {
  localStorage.setItem(NEW_ONBOARDING_COMPLETE_KEY, 'true');
  localStorage.removeItem(NEW_USER_COHORT_KEY);
  localStorage.removeItem(FORCE_NEW_ONBOARDING_KEY);
  console.log('✅ New onboarding complete - user now treated as existing');
}

/**
 * Check if user has completed the new onboarding
 */
export function hasCompletedNewOnboarding(): boolean {
  return localStorage.getItem(NEW_ONBOARDING_COMPLETE_KEY) === 'true';
}
