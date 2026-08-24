# Testing New User Flow - Edge Cases

## Bug Fixes Applied

### Bug #1: Relaunch mid-flow treated as existing user
**Problem**: First launch timestamp was written immediately, so any relaunch/background would treat them as existing.

**Fix**: Use `godlykids_new_user_cohort` flag instead of timestamp. Once set to 'true', user stays in new flow until:
- They complete new onboarding, OR
- They create an account

**Test**: 
1. Start as new user → see new flow
2. Background app mid-flow
3. Reopen app
4. ✅ Should still be in new flow (not redirected to old onboarding)

### Bug #2: Existing FREE users with v6 data hit hard paywall
**Problem**: Only checked v7 data and email, missing v6, auth_token, premium, tutorial

**Fix**: Check ALL existing-user signals:
- `godly_kids_data_v7` (old onboarding v7)
- `godly_kids_data_v6` (old onboarding v6)  
- `godlykids_auth_token` (authenticated account)
- `godlykids_user_email` (account email)
- `godlykids_premium` (premium/subscribed)
- `godlykids_tutorial_complete` (completed tutorial)
- `godlykids_welcome_seen` (seen welcome screen)

**Test**:
1. User with ONLY v6 data (no v7, no email) → OLD flow (never hard paywall)
2. User with ONLY auth token → OLD flow
3. User with premium flag → OLD flow
4. User with tutorial complete → OLD flow
5. ✅ ALL existing users avoid hard paywall

## Test Scenarios

### Scenario 1: True New Install
**Setup**: Fresh install, no existing data
**Expected Flow**:
1. Landing → "Get Started"
2. NewUserOnboarding (2 questions)
3. TrialIntro (7-day trial explanation)
4. NewUserPaywall (HARD - no X button)
5. After Continue → NewUserAccount
6. NewUserVoiceSelection
7. FirstStory (lands in content)

**Verification**:
- ✅ `godlykids_new_user_cohort` = 'true' (set on first launch)
- ✅ No existing-user signals present
- ✅ Stays in new flow through relaunches

### Scenario 2: New User - Relaunch Mid-Flow
**Setup**: New install, background app after question 1
**Expected Flow**:
1. Launch → Question 1 → Select age
2. **Background app** (Despia WebView recreate)
3. Relaunch
4. ✅ Resume at Question 2 (NOT redirected to old onboarding)
5. Complete flow normally

**Verification**:
- ✅ `godlykids_new_user_cohort` = 'true' persists
- ✅ `shouldSeeNewOnboardingFlow()` returns true
- ✅ No redirect to /onboarding

### Scenario 3: Existing User with V6 Data
**Setup**: User has `godly_kids_data_v6` but NO v7
**Expected Flow**:
1. Landing → "Get Started"
2. ✅ Redirected to /onboarding (OLD flow)
3. ✅ NEVER sees /paywall-new-user (hard paywall)

**Verification**:
- ✅ `hasAnyExistingUserSignal()` returns true (v6 detected)
- ✅ `shouldSeeNewOnboardingFlow()` returns false
- ✅ Soft paywall with X button (not hard paywall)

### Scenario 4: Existing FREE User with Token
**Setup**: User has `godlykids_auth_token` but not premium
**Expected Flow**:
1. Landing → "Get Started"
2. ✅ Redirected to /onboarding (OLD flow)
3. ✅ NEVER sees hard paywall

**Verification**:
- ✅ `hasAnyExistingUserSignal()` returns true (token detected)
- ✅ `shouldSeeNewOnboardingFlow()` returns false

### Scenario 5: Existing User Tries Direct URL
**Setup**: Existing user manually navigates to `/paywall-new-user`
**Expected Flow**:
1. Try to access `/paywall-new-user`
2. ✅ Guard redirects to `/paywall` (soft paywall with X)

**Verification**:
- ✅ useEffect guard in NewUserPaywallPage fires
- ✅ Console logs: "CRITICAL: Existing user tried to access hard paywall"
- ✅ Redirected to soft paywall

### Scenario 6: New User Completes Flow
**Setup**: New user completes entire onboarding
**Expected Flow**:
1. Complete new onboarding → reaches FirstStory
2. `markNewOnboardingComplete()` called
3. ✅ Now treated as existing user
4. If they somehow return to landing, use OLD flow

**Verification**:
- ✅ `godlykids_new_onboarding_complete` = 'true'
- ✅ `godlykids_new_user_cohort` removed
- ✅ `shouldSeeNewOnboardingFlow()` returns false
- ✅ Future relaunches use old flow

## Guard System

Every page in new flow has a guard:

### NewUserOnboardingPage
```typescript
useEffect(() => {
  if (!shouldSeeNewOnboardingFlow()) {
    navigate('/onboarding', { replace: true });
  }
}, [navigate]);
```

### TrialIntroPage
```typescript
useEffect(() => {
  if (!shouldSeeNewOnboardingFlow()) {
    navigate('/paywall', { replace: true });
  }
}, [navigate]);
```

### NewUserPaywallPage (CRITICAL)
```typescript
useEffect(() => {
  if (!shouldSeeNewOnboardingFlow()) {
    console.log('⚠️ CRITICAL: Existing user tried to access hard paywall - redirecting');
    navigate('/paywall', { replace: true });
  }
}, [navigate]);
```

## Key Invariants

1. **New users stay in new flow through relaunches** until complete
2. **Any existing-user signal → OLD flow** (never hard paywall)
3. **Hard paywall ONLY for new cohort** (no existing signals)
4. **Prices unchanged**: $39.99 annual, $5.99 monthly, 7-day trial
5. **GodlyKidsGem2 only**: No push to live split repos

## Rollback Plan

If issues found in production:
1. Set feature flag to disable new flow globally
2. All users route to `/onboarding` (old flow)
3. Fix issues on branch
4. Re-enable feature flag
