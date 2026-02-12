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

## Possible future fallback: OpenAI DALL·E

If 429s persist after multi-region and quota requests, a code fallback to **OpenAI DALL·E** (e.g. DALL·E 3) is possible. Limitations:

- **Reference images:** DALL·E 3 does not accept reference images in the same way as Vertex (no “make the character look like this photo”). You can only send a text prompt. So child/character consistency would rely on prompt description only, or you’d need a different approach (e.g. img2img elsewhere, or accept less consistency).
- **API:** OpenAI’s Images API supports prompt-only generation; for “edit”/variation you’d need their image edit endpoint and a base image, which is a different flow.

Implementing a fallback would mean: on Vertex 429 (or after N retries), call DALL·E with the same scene prompt (no reference images), upload the result to GCS, and continue. Character likeness would be best-effort via text only.
