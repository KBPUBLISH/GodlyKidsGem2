# Vertex AI Gemini 2.5 Flash Image – 429 RESOURCE_EXHAUSTED

Gemini 2.5 Flash Image uses **Standard PayGo** (shared capacity). There is no project-based quota to raise in Cloud Console; 429 means the region’s shared pool is temporarily full.

## What we do in code (per Google’s recommendations)

1. **Randomized exponential backoff**  
   On 429 or other transient failure we retry with:
   - **429**: base 5s, delay = min(5s × 2^attempt + jitter, 120s)
   - Other: base 2s, delay = min(2s × 2^attempt + jitter, 30s)  
   Jitter spreads retries so we don’t all retry at once.

2. **Smooth request rate**  
   We wait **5 seconds** between generating one page and the next (configurable), so we don’t burst many requests in a row.

3. **Multiple regions**  
   We round-robin across all supported Vertex regions. Each retry uses a different region (different shared pool), which often avoids 429 on the next attempt.

## Environment variables (backend)

| Variable | Default | Purpose |
|----------|---------|--------|
| `MONTHLY_BOOK_GEMINI_MAX_ATTEMPTS` | 20 | Max retries per page before failing. |
| `MONTHLY_BOOK_DELAY_BETWEEN_PAGES_MS` | 5000 | Ms to wait between generating each page (smooth rate). |
| `VERTEX_AI_IMAGE_REGIONS` | (all supported) | Comma-separated regions, e.g. `us-central1,us-east1,europe-west1`. |
| `VERTEX_AI_IMAGE_LOCATION` | (unset) | Set to `global` to use the global endpoint (separate quota). |

If 429s persist, try:

- Increasing `MONTHLY_BOOK_DELAY_BETWEEN_PAGES_MS` (e.g. 8000–10000).
- Setting `VERTEX_AI_IMAGE_REGIONS` to a few less busy regions (e.g. `europe-west1,asia-northeast1`).
- Setting `VERTEX_AI_IMAGE_LOCATION=global` to use the global endpoint.

## Provisioned Throughput (guaranteed capacity)

If you need a guaranteed request rate and can’t rely on retries:

- [Provisioned Throughput](https://cloud.google.com/vertex-ai/generative-ai/docs/provisioned-throughput) lets you reserve dedicated capacity (billed separately).
- Contact GCP Support or use the Cloud Console flow linked in the docs above.

## References

- [Gemini 2.5 Flash Image](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/2-5-flash-image)
- [Standard PayGo](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/standard-paygo)
- [Error code 429 and retries](https://cloud.google.com/vertex-ai/generative-ai/docs/provisioned-throughput/error-code-429)
- [Retry strategy (exponential backoff)](https://cloud.google.com/storage/docs/retry-strategy)
