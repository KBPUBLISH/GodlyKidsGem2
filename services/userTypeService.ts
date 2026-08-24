/**
 * Service to determine if a user is a truly new install vs an existing user
 * For the new paywall-first onboarding flow
 * 
 * CRITICAL:
 * - New install with NO existing signals → new paywall-first flow (persists through relaunches)
 * - Anyone with existing app data (v6/v7/token/tutorial/premium) → OLD path, NEVER hard-wall
 */

const NEW_USER_COHORT_KEY = 'godlykids_new_user_cohort'; // Once set, user stays in new flow until complete
const NEW_ONBOARDING_COMPLETE_KEY = 'godlykids_new_onboarding_complete';

// All possible existing-user signals (must check ALL to avoid hard-walling existing free users)
const EXISTING_USER_SIGNALS = {
  v7Data: 'godly_kids_data_v7',           // Old onboarding v7
  v6Data: 'godly_kids_data_v6',           // Old onboarding v6
  authToken: 'godlykids_auth_token',      // Has authenticated account
  userEmail: 'godlykids_user_email',      // Account email
  premium: 'godlykids_premium',           // Premium/subscribed user
  tutorialComplete: 'godlykids_tutorial_complete', // Completed tutorial
  welcomeSeen: 'godlykids_welcome_seen',  // Seen welcome screen (existing users)
};

export interface UserType {
  isNewInstall: boolean;
  isExistingUser: boolean;
  hasAnyExistingUserSignal: boolean;
  inNewUserCohort: boolean;
  hasCompletedNewOnboarding: boolean;
}

/**
 * Check if user has ANY signal that indicates they're an existing user
 * This prevents hard-walling existing free users who might only have v6 data or a token
 */
function hasAnyExistingUserSignal(): boolean {
  // Check all possible existing-user signals
  return Object.values(EXISTING_USER_SIGNALS).some(key => {
    const value = localStorage.getItem(key);
    // For premium and tutorial_complete, check if they're explicitly 'true'
    if (key === EXISTING_USER_SIGNALS.premium || key === EXISTING_USER_SIGNALS.tutorialComplete) {
      return value === 'true';
    }
    // For data keys (v6, v7) and others, any truthy value means they're existing
    return !!value;
  });
}

/**
 * Determine if this is a truly new install
 * 
 * Logic:
 * 1. If they have ANY existing-user signal → existing user (never hard-wall)
 * 2. If they're marked as new user cohort → new user (persists through relaunches)
 * 3. If completed new onboarding → existing user now
 * 4. Otherwise → new install, mark them as new cohort
 */
export function getUserType(): UserType {
  const hasExistingSignal = hasAnyExistingUserSignal();
  const inNewUserCohort = localStorage.getItem(NEW_USER_COHORT_KEY) === 'true';
  const completedNewOnboarding = localStorage.getItem(NEW_ONBOARDING_COMPLETE_KEY) === 'true';
  
  // If they have any existing-user signal, they're existing (NEVER hard-wall)
  if (hasExistingSignal) {
    return {
      isNewInstall: false,
      isExistingUser: true,
      hasAnyExistingUserSignal: true,
      inNewUserCohort: false,
      hasCompletedNewOnboarding: completedNewOnboarding,
    };
  }
  
  // If they completed new onboarding, treat as existing now
  if (completedNewOnboarding) {
    return {
      isNewInstall: false,
      isExistingUser: true,
      hasAnyExistingUserSignal: false,
      inNewUserCohort: false,
      hasCompletedNewOnboarding: true,
    };
  }
  
  // If already marked as new user cohort, keep them in new flow
  if (inNewUserCohort) {
    return {
      isNewInstall: true,
      isExistingUser: false,
      hasAnyExistingUserSignal: false,
      inNewUserCohort: true,
      hasCompletedNewOnboarding: false,
    };
  }
  
  // This is a true new install - mark them as new cohort
  // They'll stay in new flow even if they background/relaunch mid-onboarding
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
 * 
 * Show new flow if:
 * - They're a new install (no existing-user signals)
 * - OR they're in new user cohort but haven't completed it yet
 * 
 * Never show new flow if:
 * - They have ANY existing-user signal (v6/v7 data, token, premium, tutorial, etc.)
 * - They've completed new onboarding
 */
export function shouldSeeNewOnboardingFlow(): boolean {
  const userType = getUserType();
  
  // If they have any existing-user signal, use old flow
  if (userType.hasAnyExistingUserSignal) {
    return false;
  }
  
  // If they completed new onboarding, use old flow
  if (userType.hasCompletedNewOnboarding) {
    return false;
  }
  
  // If they're a new install or in new cohort, use new flow
  return userType.isNewInstall || userType.inNewUserCohort;
}

/**
 * Mark that user has completed the new onboarding
 * After this, they'll be treated as existing user
 */
export function markNewOnboardingComplete(): void {
  localStorage.setItem(NEW_ONBOARDING_COMPLETE_KEY, 'true');
  // Clear new user cohort flag since they're done
  localStorage.removeItem(NEW_USER_COHORT_KEY);
  console.log('✅ New onboarding complete - user now treated as existing');
}

/**
 * Check if user has completed the new onboarding
 */
export function hasCompletedNewOnboarding(): boolean {
  return localStorage.getItem(NEW_ONBOARDING_COMPLETE_KEY) === 'true';
}
