# Godly Kids email campaigns

This change fixes welcome-email persistence and adds a separate three-email update campaign. Nothing is sent merely by deploying this code or creating a draft.

## Prepared content

`src/campaigns/island-update.json` contains the complete update sequence. Day 1 invites families back to build their island; day 3 focuses on Bible adventures and unlocked characters; day 7 invites them to return and share feedback. Links point to https://app.godlykids.com/.

Content sources checked November 14, 2026: https://godlykids.com/ and https://godlykids.com/how-it-works. Search-engine snapshots contained older content; the copy uses the current live pages. These pages describe current features, not release dates; the emails do not claim every feature was newly introduced.

## Configuration and rollout

- Keep `EMAIL_CAMPAIGNS_ENABLED=false` while deploying and reviewing.
- Keep `EMAIL_WELCOME_ENABLED=false` unless the welcome scheduler should run. The separate welcome flag controls internal scheduling; explicit manual runs still require the global flag.
- Existing `EMAIL_USER` / `EMAIL_PASSWORD` configure Gmail. `SUPPORT_EMAIL` optionally overrides replies; the existing default is hello@kbpublish.org.
- Set `PUBLIC_API_URL` to the public HTTPS backend origin, not the frontend URL.
- Set a stable, dedicated `EMAIL_UNSUBSCRIBE_SECRET` of at least 32 characters. Rotating it invalidates existing unsubscribe links.
- Ensure indexes are created for `EmailDelivery` and `CampaignEnrollment` before sending. Runners await model initialization so a missing unique index fails closed.
- From the backend folder, run `node src/scripts/setup-update-campaign.js` to preview the payload. Add `--apply` to create a draft through the authenticated backend. This does not enroll or send. It requires `PUBLIC_API_URL` and `ADMIN_API_KEY`.
- Review `GET /api/email-campaigns/update-island-adventures-2026-11` using admin authentication. It returns HTML previews, audience counts, and queue counts.
- After review, set `EMAIL_CAMPAIGNS_ENABLED=true` and restart the backend. POST `/:key/launch` to enroll the fixed audience and activate the campaign. The hourly scheduler runs at minute 15 UTC; the backend must stay running.
- POST `/:key/pause` or `/:key/resume` controls later sends. A message already being sent may finish.

All campaign administration routes use the existing admin middleware (`x-admin-key` or admin bearer token). The legacy `/api/drip/*` routes retain `x-admin-api-key` / `x-migration-api-key` for existing callers.

## Audience and timing

Existing registered `User` accounts created on or before draft creation are matched to `EmailSubscriber` by normalized email. Only `optInUpdates: true` with no `unsubscribedAt` qualify. Missing preferences, invalid emails, duplicates, and later accounts are excluded. The draft preview counts these exclusions. AppUser-only anonymous profiles and legacy accounts not migrated to User are not silently treated as registered accounts.

Enrollment is unique per campaign/email and launch is repeatable to finish interrupted enrollment. First emails are due at launch; later emails are due two days and then four days after actual delivery. Each run processes up to 100 due recipients (manual limit 1–500), and subsequent runs pick remaining records. The source audience is fixed by account cutoff; a repeated launch can enroll accounts within that cutoff that have since explicitly subscribed.

The legacy welcome campaign keeps its existing eight-day signup window and stages 0/2/4/6/7. It now saves all tracking fields, requires subscriber eligibility, enforces a 24-hour gap, and uses the same delivery ledger. The eight-day window means delayed or previously missed welcome stages may not finish; the update campaign has no such expiry.

## Preview and manual execution

- `POST /api/drip/run` and `POST /api/email-campaigns/:key/run` default to dry runs; explicitly pass `{ "dryRun": false }` to send.
- `POST /api/email-campaigns` creates a draft. Empty messages are allowed for planning, but launch requires all three complete messages.
- `PUT /api/email-campaigns/:key` edits messages and appUrl while still in draft.
- GET unsubscribe links show confirmation without changing preferences; signed POST links support one-click unsubscribe. Link scanners cannot unsubscribe recipients with GET alone.
- Routine subscription calls without an explicit boolean preference preserve earlier opt-outs.

## Delivery behavior and recovery

SMTP cannot guarantee exactly-once delivery across a crash. A unique permanent claim prevents overlapping workers from sending the same campaign/email/stage twice. Ambiguous errors are held for manual review, never automatically retried. A crash may leave `sending` records, also held. Review `emaildeliveries` and `campaignenrollments` against Gmail logs before resolving them; do not delete claims blindly. A confirmed accepted delivery can be marked sent and its enrollment advanced; a confirmed never-submitted message can be explicitly reset after investigation.

Historical emails sent before tracking fields existed cannot be reconstructed from this code. Check historical send logs before enabling welcome automation. Each campaign deduplicates independently; enabling welcome and update simultaneously can send both types to a newly registered account. The Gmail account's actual sending limits and production credentials have not been verified by local tests. SMTP rejection is held for review; asynchronous bounce/complaint ingestion is not part of this change.

## Validation

Run `npm run test:email`. Tests start an isolated MongoDB and stub SMTP; no production data or recipients are used. First run downloads a MongoDB test binary. Node 20.19+ is required for the test database package. Production uses existing dependencies; the database test runner is development-only.
