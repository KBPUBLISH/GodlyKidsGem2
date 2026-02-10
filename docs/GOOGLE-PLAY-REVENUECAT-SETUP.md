# Connect Google Play Subscriptions with Android App & RevenueCat

This guide connects **Google Play Console** → **RevenueCat** → your **Android app** (Godly Kids, built with DeSpia). Your app uses these product IDs (must match RevenueCat + Google Play):

| Plan     | Product ID                    |
|----------|-------------------------------|
| Monthly  | `godlykidsmonthly:monthly`    |
| Annual   | `yearlymember:yearly`         |
| Lifetime | `lifetime`                    |

---

## Paywall → RevenueCat (when called from Android app)

When the user taps **Start Trial** on the in-app paywall from the **Android app**:

1. **PaywallPage** calls `purchase(selectedPlan)` with `'annual' | 'monthly' | 'lifetime'`.
2. **RevenueCatService** maps that to the product ID above and sets:
   - `revenuecat://purchase?external_id=USER_ID&product=PRODUCT_ID`
3. **DeSpia** receives this and calls the **RevenueCat SDK** with that product ID.
4. **RevenueCat** charges via **Google Play** using the product you added (monthly/yearly/lifetime).

So the subscription paywall **already calls those products in RevenueCat** when used on Android. In RevenueCat Dashboard → **Products**, identifiers must be exactly: `godlykidsmonthly:monthly`, `yearlymember:yearly`, `lifetime` (see table above).

---

## 1. RevenueCat: Add Android app & Google Play

1. **RevenueCat Dashboard** → [app.revenuecat.com](https://app.revenuecat.com) → your project (Godly Kids).
2. **Apps** → **+ New** (or edit existing):
   - **Platform:** Google Play Store  
   - **App name:** Godly Kids (or your Android app name)  
   - **Package name:** must match your Android app (e.g. `com.kbpublish.godlykidscb` — confirm in DeSpia/Play Console).
3. Save. You’ll see an **API Key** for this Android app; DeSpia/native config may need it later.

---

## 2. Google Play: Service account for RevenueCat

RevenueCat needs a **Google Play service account** with access to your app’s orders.

1. **Google Cloud Console**  
   - Go to [console.cloud.google.com](https://console.cloud.google.com).  
   - Use the same Google account that owns the Play Console app (or one in the same org).

2. **Create / use a project**  
   - Create a project or select the one linked to your Play app.

3. **Enable Google Play Android Developer API**  
   - **APIs & Services** → **Library** → search “Google Play Android Developer API” → **Enable**.

4. **Create service account**  
   - **APIs & Services** → **Credentials** → **Create credentials** → **Service account**.  
   - Name it (e.g. “RevenueCat Google Play”).  
   - **Create and continue** (no roles needed in GCP).  
   - **Done**.

5. **Create JSON key**  
   - Open the new service account → **Keys** → **Add key** → **Create new key** → **JSON** → **Create**.  
   - Download the `.json` file and keep it secure.

6. **Link service account in Play Console**  
   - **Google Play Console** → your app → **Setup** → **API access**.  
   - If needed, link the Google Cloud project.  
   - Under **Service accounts**, find the new account → **Grant access** (or **Link** then **Grant**).  
   - Permissions: enable at least **View financial data, orders, and cancellation survey data** (and **Manage orders and subscriptions** if you use that).  
   - **Invite user** / **Save**.

---

## 3. RevenueCat: Connect Google Play (credentials)

1. **RevenueCat** → your project → **Project settings** (or **Apps** → select Android app).
2. **Google Play** section:
   - **Service account credentials:** upload the JSON key file you downloaded (or paste contents), or paste the JSON into the field if the UI allows.
3. **Save**. RevenueCat will validate; wait until it shows as connected (no red errors).

---

## 4. Google Play: Create subscription products (match product IDs)

Create one subscription per plan; **Product ID** in Play must match RevenueCat (and your app).

### Monthly subscription

1. **Play Console** → your app → **Monetize** → **Subscriptions**.
2. **Create subscription** (or open “Monthly Member”):
   - **Product ID:** `godlykidsmonthly` (subscription product); base plan ID `monthly` → RevenueCat identifier `godlykidsmonthly:monthly`.
3. **Add base plan** (e.g. “Add base plan”):
   - **Base plan ID:** `monthly` (or `default`).
   - **Type:** Auto-renewing.  
   - **Billing period:** Monthly.  
   - Set price, trial, grace period, etc.  
   - **Save** and activate.

### Annual subscription

1. **Create subscription** (or open yearly product):
   - **Product ID:** `yearlymember` (subscription product); base plan ID `yearly` → RevenueCat identifier `yearlymember:yearly`.
2. **Add base plan**:
   - **Base plan ID:** e.g. `yearly` or `default`.
   - **Billing period:** Yearly.  
   - **Save** and activate.

### Lifetime (one-time)

- Create a **one-time product** (not subscription) in Play with Product ID: `lifetime`, and link it in RevenueCat with identifier `lifetime`.

---

## 5. RevenueCat: Products & offerings

1. **RevenueCat** → **Products** (or **Offerings**):
   - After Google Play is connected, RevenueCat can **sync** products from Play.  
   - Ensure the products show with IDs: `kbpublish.godlykids.monthly`, `kbpublish.godlykids.yearly` (and `Lifetimepurchase` if used).
2. **Offerings** (if you use them):
   - Create an offering (e.g. “default”) and attach these products so the app’s purchase flow can resolve them.

---

## 6. RevenueCat: Webhook (your backend)

Your backend already has a webhook at:

`POST https://<your-backend>/api/webhooks/revenuecat`

1. **RevenueCat** → **Project settings** → **Webhooks** (or **Integrations**).
2. **Add webhook**:
   - **URL:** `https://backendgk2-0.onrender.com/api/webhooks/revenuecat` (or your production backend URL).  
   - **Events:** at least `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`, `RESTORE`.  
3. **Save**.  
This lets your backend (and app) know when a Google Play subscription is purchased, renewed, or cancelled.

---

## 7. Android app (DeSpia) configuration

Your app uses **DeSpia** and triggers purchases via:

`revenuecat://purchase?external_id=USER_ID&product=PRODUCT_ID`

- **Product IDs** are already correct in `services/revenueCatService.ts`:  
  `kbpublish.godlykids.monthly`, `kbpublish.godlykids.yearly`, `Lifetimepurchase`.
- In **DeSpia dashboard** (or wherever you configure the native Android app):
  - Add / confirm the **RevenueCat Android API key** (from step 1) in the app’s config so the native RevenueCat SDK can talk to your RevenueCat project.
  - Ensure the app’s **package name** matches what you added in RevenueCat and in Google Play.

If DeSpia docs mention “RevenueCat Custom” or “RevenueCat SDK”, follow their steps for Android (API key and package name); the web app code is already aligned.

---

## 8. Quick checklist

- [ ] RevenueCat: Android app added, package name matches Play/DeSpia.  
- [ ] Google Cloud: Service account created, JSON key downloaded.  
- [ ] Play Console: API access granted to that service account.  
- [ ] RevenueCat: Google Play credentials (JSON) added and validated.  
- [ ] Play Console: Subscriptions created with IDs `kbpublish.godlykids.monthly` and `kbpublish.godlykids.yearly` (and base plans active).  
- [ ] RevenueCat: Products synced from Play (and offerings set if needed).  
- [ ] RevenueCat: Webhook URL set to your backend `/api/webhooks/revenuecat`.  
- [ ] DeSpia/Android: RevenueCat API key and package name configured.

After this, purchases on the Android app (via your existing purchase flow) should go: **Google Play** → **RevenueCat** → **your backend webhook** and **app** (e.g. `godlykids_premium` / restore).

---

## Troubleshooting

- **Purchases not showing in RevenueCat:**  
  Check package name, service account permissions, and that product IDs match exactly (including case).

- **Webhook not firing:**  
  Confirm URL is HTTPS and returns 200; check RevenueCat webhook logs and your backend logs.

- **App says “no premium” after purchase:**  
  Confirm webhook is updating your backend and that the app polls or receives updates (e.g. `godlykids_premium` in localStorage after webhook runs).

For RevenueCat + Google Play details: [RevenueCat – Google Play Setup](https://www.revenuecat.com/docs/getting-started/installation/android#google-play-setup).
