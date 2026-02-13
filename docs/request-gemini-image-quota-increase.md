# How to Request a Quota Increase for Gemini 2.5 Flash Image (Monthly Book)

The monthly custom book feature uses **Vertex AI → Gemini 2.5 Flash Image** (`gemini-2.5-flash-image`) in **us-central1** for page image generation. The "Generate content requests per minute" quota for this model is often **capped at 10 RPM** and may not be adjustable in the Cloud Console. Below are the official ways to request an increase.

## 1. Required role

- **Quota Administrator** (`roles/servicemanagement.quotaAdmin`) on the project (to request adjustments).
- **Quota Viewer** (`roles/servicemanagement.quotaViewer`) to view quotas.

## 2. Find the quota (Console)

1. Go to **IAM & Admin → Quotas & System Limits**:  
   https://console.cloud.google.com/iam-admin/quotas  
2. **Filter** by:
   - **Service:** `Vertex AI API` (or filter by "generate content" / "gemini").
   - Optionally by **Dimensions:** `region: us-central1`, `base_model: gemini-2.5-flash-image` (or the exact model id shown for image generation).
3. Find the row: **"Generate content requests per minute per project per base model per minute per region per base_model"** (or similar) for `us-central1` and the Gemini image model.
4. If the row has **Edit** / **Request increase** and **Adjustable: Yes**, use **Edit** and submit a higher value (e.g. 30 or 60) with a short justification.

If that quota is not listed or the value is fixed at 10 and not editable, use the paths below.

## 3. Request via Cloud Quotas API (when Console doesn’t allow it)

When the Console won’t let you request above 10, you can submit a **quota preference** via the **Cloud Quotas API**.

- **Endpoint:** `POST .../quotaPreferences` (see [Cloud Quotas API](https://cloud.google.com/docs/quota/api)).
- **Service:** `aiplatform.googleapis.com` (Vertex AI).
- **Quota ID:** Use the exact `quotaId` from a 429 error if you have one (e.g. `GenerateRequestsPerMinutePerProjectPerModel` or the id shown in the Quotas table).
- **Dimensions:** e.g. `region: us-central1`, and if applicable `base_model` or `model: gemini-2.5-flash-image` (match the dimensions shown in the Quotas table or in the 429 error).
- **Justification:** e.g.  
  *"We use Vertex AI Gemini 2.5 Flash Image for custom children's storybook page generation. We need ~30–60 requests per minute to generate one book (15–20 images) within a few minutes. Current 10 RPM causes 429 RESOURCE_EXHAUSTED and blocks the feature."*
- **Contact email:** Your email for follow-up.

Example shape (replace placeholders with your project number and the exact quota/dimensions from your project):

```json
{
  "service": "aiplatform.googleapis.com",
  "quotaId": "QUOTA_ID_FROM_CONSOLE_OR_429",
  "quotaConfig": { "preferredValue": "30" },
  "dimensions": { "region": "us-central1", "base_model": "gemini-2.5-flash-image" },
  "justification": "Monthly custom storybook image generation; need 30–60 RPM to complete a book in a few minutes.",
  "contactEmail": "YOUR_EMAIL"
}
```

Get your **project number** (not project id):

```bash
gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)"
```

## 4. Project quota requests (support path)

From the Cloud Quotas docs:

> **Request project quota**  
> For more information about requesting additional project quotas, refer to the **Project quota requests support article**.

Use this when:

- The quota for Gemini image generation isn’t visible or editable in the Console, or  
- You’re told you can’t request above 10 for this model.

Steps:

1. Open **Google Cloud Console → Support** (or search “quota request” in the console).
2. Use **Project quota requests** / the support article linked from the Quotas docs.
3. In the request, specify:
   - **Product:** Vertex AI (Generative AI / Gemini).
   - **Quota:** Generate content **requests per minute** (image generation).
   - **Model:** Gemini 2.5 Flash Image (`gemini-2.5-flash-image`).
   - **Region:** `us-central1`.
   - **Current limit:** 10 RPM.
   - **Requested limit:** e.g. 30 or 60 RPM.
   - **Use case:** Custom children’s storybook page generation; one book = 15–20 images; need to complete within a few minutes without 429 errors.

You’ll get an acknowledgment and, after review, an approval or follow-up email.

## 5. View and track your request

- **IAM & Admin → Quotas & System Limits** → **Increase Requests** tab: lists pending and past increase requests; use filters to find your request.
- A **Pending** icon appears next to quotas with a pending decision.

## 5b. Scalability and cost (e.g. ~100 downloads)

- **Realistic load:** If the app has ~100 downloads and a fraction try “Create your story,” you might see on the order of 5–20 books per day. Each book = ~16–21 image requests (cover + 15–20 pages). The main bottleneck is **quota (RPM)**, not cost per image.
- **Cost per attempt:** Vertex AI bills for **successful** image generation only. A **429 (rate limit)** response means the request was rejected—**no image was generated and you are not charged** for that call. So increasing the number of retries (e.g. 20 attempts per page) does **not** increase cost when attempts fail; it only adds more chances across regions. You only pay when one attempt succeeds and returns an image.
- **More attempts:** The job uses `PAGE_GEMINI_MAX_ATTEMPTS` (default **20**), so it will try up to 20 regions per page before failing. Set `MONTHLY_BOOK_GEMINI_MAX_ATTEMPTS=30` (or lower) in the backend env if you want to cap or change this.

## 6. Use multiple regions or the global endpoint (no quota increase needed)

Vertex AI applies **per-region** (and separately **global**) quotas for Gemini 2.5 Flash Image. You can get more effective throughput without waiting for a quota increase:

### Option A: Global endpoint (recommended to try first)

The **global** endpoint has a **separate quota** from regional endpoints and can reduce 429 errors ([Vertex AI locations](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/locations)).

Set in your backend environment (e.g. Render):

```bash
VERTEX_AI_IMAGE_LOCATION=global
```

The job will call `https://aiplatform.googleapis.com/.../locations/global/...` instead of a single region. No code change required.

### Option B: Round-robin across regions

Each **region** has its own "requests per minute" limit (e.g. 10 RPM per region). If you send page 1 to us-central1, page 2 to us-east1, page 3 to us-west1, etc., each region is used independently and you get **3×** the effective RPM (e.g. 30 RPM for 3 regions).

Set in your backend environment:

```bash
VERTEX_AI_IMAGE_REGIONS=us-central1,us-east1,us-west1
```

Supported regions for Gemini 2.5 Flash Image include (see [Google model endpoint locations](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/locations)): **us-central1**, **us-east1**, **us-east4**, **us-east5**, **us-west1**, **us-west4**, **us-south1**, **northamerica-northeast1**, **europe-west1**, **europe-west2**, **europe-west4**, **europe-north1**, **asia-northeast1**, **asia-southeast1**, and others. Add more regions to the comma-separated list to increase effective RPM (e.g. 5 regions → up to 50 RPM if each has 10 RPM).

**Note:** If both `VERTEX_AI_IMAGE_LOCATION` and `VERTEX_AI_IMAGE_REGIONS` are set, `VERTEX_AI_IMAGE_LOCATION` wins (e.g. `global` disables round-robin).

## What else can we do for more RPM?

| Option | What it does |
|--------|----------------|
| **Request a quota increase** | Ask Google (Console, Quotas API, or Support) for higher RPM (e.g. 30–60). No code change; approval can take days. |
| **Global endpoint** | Set `VERTEX_AI_IMAGE_LOCATION=global`. Uses a separate quota from regional endpoints; can reduce 429s. Try this first. |
| **Multiple regions** | Already on: round-robin across ~29 regions. Each region has its own RPM; more regions = more effective throughput. |
| **Longer waits** | Increase `MONTHLY_BOOK_DELAY_BETWEEN_PAGES_MS` and `MONTHLY_BOOK_GEMINI_RATE_LIMIT_DELAY_MS` so we stay under limit. Book takes longer; no extra cost. |
| **Set expectations** | In-app copy: “Usually 5–10 minutes. Go explore — we’ll notify you when it’s ready.” So kids/parents don’t wait on the progress screen. |

Beyond the above, there’s no other way to get more RPM without Google increasing your quota. Letting the job run in the background with clear “5–10 minutes, go explore” messaging is the right UX.

## Summary

| Method | When to use |
|--------|-------------|
| **Console (Edit quota)** | Quota is visible and **Adjustable: Yes** for your model/region. |
| **Cloud Quotas API** | You have the exact quota id and dimensions; useful when Console doesn’t offer an increase. |
| **Project quota requests (support)** | Console and API don’t work or you need a human review (e.g. Gemini image 10 RPM cap). |
| **Global endpoint** | Try first: separate quota, often reduces 429s. Set `VERTEX_AI_IMAGE_LOCATION=global`. |
| **Multiple regions** | Round-robin: each region has its own RPM; e.g. 3 regions → up to 30 RPM. Set `VERTEX_AI_IMAGE_REGIONS=us-central1,us-east1,us-west1`. |

Our app uses **Vertex AI**, **gemini-2.5-flash-image** for monthly book page images. Default is now **round-robin across all supported regions** (~28 regions) to maximize effective RPM; you can override with `VERTEX_AI_IMAGE_LOCATION=global` or `VERTEX_AI_IMAGE_REGIONS=...` (section 6).

---

## Logs during the page builder process

Logs from `backend/src/jobs/monthlyBookGenerator.js` appear in this order during a book run (create-from-book flow):

| Order | Log message | When |
|-------|-------------|------|
| 1 | `MonthlyBookGenerator: Using N regions for Vertex Gemini image round-robin` | Once at startup when using multi-region (not when `VERTEX_AI_IMAGE_LOCATION=global`) |
| 2 | `MonthlyBookGenerator: Page N prompt: <preview>... location: <region>` | Before each page image request (N = 1, 2, …; region = e.g. us-east4) |
| 3 | `MonthlyBookGenerator: Page N prompt: ... location: <region> (retry K)` | Retry after 429 or failure (K = 1 or 2) |
| 4 | `MonthlyBookGenerator: Gemini page N failed 429 (rate limit)` | Vertex returned 429 for that request |
| 5 | `MonthlyBookGenerator: Gemini page N attempt K failed (429 rate limit); retrying in 20000 ms in a different region...` | Will wait 20s then try next region |
| 6 | `MonthlyBookGenerator: Generated page N with Vertex Gemini 2.5 Flash Image <url>` | Page image succeeded and was uploaded to GCS |
| 7 | `MonthlyBookGenerator: Waiting 5000 ms before page N (rate limit avoidance)` | Delay before starting the next page |
| 8 | `MonthlyBookGenerator: Page N/M using portal scene prompt` or `using fallback from page text` | Which prompt path was used for that page |
| 9 | `MonthlyBookGenerator: Generated cover <url>` | Cover image done (after pages or as part of flow) |
| 10 | `MonthlyBookGenerator: [id] Finished page N/M` | After each page image is saved and progress updated |
| 11 | `MonthlyBookGenerator: Completed (from book) <customMonthlyBookId> bookId <bookId>` | Book generation finished successfully |

Other possible logs: `Gemini page N returned no image`, `Gemini page N error ...`, `Could not fetch child image for cover`, `CustomMonthlyBook not found`, `Skipping non-pending`, `Failed <customMonthlyBookId>`.

**If it looks like pages were skipped (e.g. page 1 then page 4):** Logs from other API requests (GET /status, analytics, etc.) are interleaved with the job. To see the real order for one book, grep logs for the short id, e.g. `MonthlyBookGenerator: [698e7079]` (last 8 chars of `customMonthlyBookId`). You should see a strict sequence: `Starting page 1/15`, … `Finished page 1/15`, `Starting page 2/15`, … `Finished page 2/15`, etc. The job does not skip indices; if you see a gap, it’s log interleaving. Only one worker can claim each book (atomic `pending` → `generating`), so concurrent runs won’t double-run or skip pages.

---

## Why 429 can still happen in a “different” region

When you see **429** and then **retrying in a different region**, the next request may still return **429** in that other region. Reasons:

1. **Project-level quota**  
   For some Vertex AI image models, the “requests per minute” limit is **per project**, not per region. So switching from `us-east4` to `us-east5` or `us-west1` does **not** give you a new quota—all regions share the same project limit. You just have to wait for the 1‑minute window to roll over (the 20s delay helps but may not be enough if you already used 10 requests in that minute).

2. **Per-region quota but same minute window**  
   If the quota is per region, each region has its own RPM (e.g. 10 per region). You can still get 429 in the **next** region if:
   - That region was already used recently in the same minute (e.g. by an earlier page or retry), or
   - The **global** or **project** quota (if any) is still exceeded.

3. **Retries do eventually succeed**  
   In your logs, page 3 failed in `us-east4`, then `us-east5` (retry 1), then succeeded in `us-west1` (retry 2). So a different region plus the 20s backoff can work once the limit has had time to reset.

**What to do:** Prefer **`VERTEX_AI_IMAGE_LOCATION=global`** (separate quota from regional endpoints) and/or request a **quota increase** (sections 1–5). Multi-region round-robin helps when limits are per-region; if they’re project-level, only delay and higher quota will reduce 429s.

---

## Possible future fallback: OpenAI DALL·E

If 429s persist after multi-region and quota requests, a code fallback to **OpenAI DALL·E** (e.g. DALL·E 3) is possible. Limitations:

- **Reference images:** DALL·E 3 does not accept reference images in the same way as Vertex (no “make the character look like this photo”). You can only send a text prompt. So child/character consistency would rely on prompt description only, or you’d need a different approach (e.g. img2img elsewhere, or accept less consistency).
- **API:** OpenAI’s Images API supports prompt-only generation; for “edit”/variation you’d need their image edit endpoint and a base image, which is a different flow.

Implementing a fallback would mean: on Vertex 429 (or after N retries), call DALL·E with the same scene prompt (no reference images), upload the result to GCS, and continue. Character likeness would be best-effort via text only.
