# GCS CORS Setup for Direct Uploads

The Karaoke form uses **direct-to-GCS** uploads (signed URLs) to avoid `ERR_INSUFFICIENT_RESOURCES` with large video files. For this to work, your GCS bucket must have CORS configured to allow requests from the portal.

## One-time setup

Run this from your machine (requires `gcloud` CLI and access to the project):

```bash
# Apply CORS to your production bucket
gcloud storage buckets update gs://productiongk --cors-file=backend/scripts/gcs-cors.json

# Or for development bucket
gcloud storage buckets update gs://developmentgk --cors-file=backend/scripts/gcs-cors.json
```

**Alternative with gsutil** (if you don't have gcloud storage):
```bash
gsutil cors set backend/scripts/gcs-cors.json gs://productiongk
```

## Verify

```bash
gcloud storage buckets describe gs://productiongk --format="json(cors)"
# or: gsutil cors get gs://productiongk
```

## What this allows

- **Origins:** portal.godlykids.com, localhost (for dev)
- **Methods:** PUT, POST, OPTIONS (needed for signed URL uploads)
- **Headers:** Content-Type, x-goog-resumable

## Chunked uploads & tmp cleanup

Karaoke video/audio use chunked uploads (5MB pieces). Chunks are stored in `tmp/` and composed into the final file. Orphaned chunks from failed uploads remain in `tmp/`. To auto-delete them after 24h, add a [GCS Lifecycle rule](https://cloud.google.com/storage/docs/lifecycle) on the bucket for prefix `tmp/` with age 1 day and action Delete.
