# Monthly Credits Verification

How to verify that subscribers get 1 credit per month and new subscribers receive their credit immediately.

---

## Flow Summary

1. **User subscribes** → RevenueCat SDK fires, app sets `godlykids_premium=true`, `isPremium=true`
2. **RevenueCat webhook** → Backend receives INITIAL_PURCHASE/RENEWAL, finds AppUser by email/deviceId, sets `subscriptionStatus='active'`
3. **Backend credit limit** → Uses AppUser.subscriptionStatus (active, trial, reverse_trial) as source of truth; falls back to request `hasTrialOrPaid` for brief webhook delay
4. **GET /api/monthly-book/credits** → Returns `usedThisMonth` and `limit` (1 for subscribed, 0 for free, 100 for special email)
5. **POST /api/monthly-book/create-from-book** → Checks `usedThisMonth < limit`; blocks if exceeded

---

## How to Verify

### 1. New subscriber gets 1 credit

- **Sign up** as a new user and **subscribe** (RevenueCat/Stripe).
- Open Create Your Story flow → Step 4 (Ready to Create).
- You should see **"1 of 1 monthly credit available"** above the Create my story button.
- On HomePage, Dive into The Bible should show **"1 of 1 monthly credits available"**.

### 2. Used credit blocks creation

- After creating one story in the current month, attempt to create another.
- You should get: **"You've used your monthly story credit. Come back next month for another!"**

### 3. Non-subscriber has 0 credits

- Use a free account (not subscribed).
- Credits should show **"0 of 1 monthly credits available"** (subscribing unlocks 1).
- Tapping Create my story should show the paywall (or error if not logged in).

### 4. Backend verification

- The backend now uses **AppUser.subscriptionStatus** as source of truth for the limit.
- `subscriptionStatus` in `['active','trial','reverse_trial']` → limit = 1.
- Request `hasTrialOrPaid` is used as fallback when webhook hasn’t run yet (a few seconds after subscribe).

### 5. API checks

```bash
# Get credits (replace USER_ID with email or deviceId)
curl "https://YOUR_BACKEND/api/monthly-book/credits?userId=USER_ID"
# Response: { "success": true, "usedThisMonth": 0, "limit": 1 }
# limit=1 when subscribed, limit=0 when free
```

---

## Webhook ID Matching

RevenueCat sends `app_user_id` and optional `aliases`, `subscriber_attributes.$email`. The backend looks up AppUser by:

- `email` (from subscriber attributes)
- `deviceId` (if used as app_user_id)
- MongoDB ObjectId (if 24-char hex)

**Important:** The app should set RevenueCat’s `app_user_id` to something the backend can resolve (e.g. email or deviceId). If the webhook cannot find the AppUser, subscription status will not be updated; the user will still get credits via the fallback `hasTrialOrPaid` from the frontend until the webhook matches.
