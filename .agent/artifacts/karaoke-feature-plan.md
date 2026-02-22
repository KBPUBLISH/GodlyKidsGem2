# Karaoke Feature Plan

## Overview

A Karaoke feature where users:
1. Select a background song from a library
2. Watch a video with on-screen lyrics to sing along
3. Record their voice during the session
4. Get a mixed track (background + their recording) timed correctly
5. Listen, save, and share the final recording

**Portal (admin)** manages: video upload, background song upload, cover image upload, and lyric timings.

---

## Architecture Summary

| Layer | Components |
|-------|------------|
| **Data** | `KaraokeSong` model, `KaraokeRecording` model (user saves) |
| **Backend** | `karaoke` routes, upload extensions for `karaoke/` folder |
| **Portal** | Karaoke management page (list, create, edit) |
| **App** | Karaoke library → Karaoke player (video + lyrics) → Record → Mix → Save/Share |

---

## Phase 1: Data Model & Backend

### 1.1 KaraokeSong Model

Create `backend/src/models/KaraokeSong.js`:

```javascript
{
  title: String,           // e.g. "Amazing Grace"
  description: String,
  coverImage: String,      // GCS URL - cover art for browse/list
  videoUrl: String,        // GCS URL - video that plays (karaoke-style, lyric prompts)
  backgroundAudioUrl: String,  // GCS URL - instrumental/backing track (no vocals)
  duration: Number,        // seconds
  // Lyric lines with timing (similar to Lesson captions)
  lyrics: [{
    text: String,          // "Amazing grace, how sweet the sound"
    startTime: Number,     // seconds
    endTime: Number,
  }],
  status: 'draft' | 'published',
  order: Number,
  minAge: Number,
  isMembersOnly: Boolean,
  goalTags: [String],      // for daily session matching
  viewCount: Number,
  recordCount: Number,
  createdAt, updatedAt
}
```

### 1.2 KaraokeRecording Model (optional – for saved recordings)

```javascript
{
  userId: ObjectId,
  karaokeSongId: ObjectId,
  mixedAudioUrl: String,   // GCS URL - final mix (background + user voice)
  recordedAt: Date,
  duration: Number
}
```

### 1.3 Backend Routes

- `GET /api/karaoke` – list published karaoke songs (paginated, filterable)
- `GET /api/karaoke/:id` – get one by ID
- `POST /api/karaoke` – create (portal only)
- `PUT /api/karaoke/:id` – update (portal only)
- `DELETE /api/karaoke/:id` – delete (portal only)
- `POST /api/karaoke/:id/record` – upload user recording (audio blob)
- `POST /api/karaoke/mix` – server-side mix (background + user recording) → returns mixed URL

### 1.4 Upload Extensions

Extend `backend/src/routes/upload.js`:

- Add `bookId=karaoke` for images (cover)
- Add `bookId=karaoke` for video
- Add `bookId=karaoke` for audio (background track, user recordings)

Path structure: `karaoke/{songId}/{type}/{filename}` (cover, video, audio, recordings).

---

## Phase 2: Portal – Karaoke Management

### 2.1 New Portal Pages

| Route | Page | Purpose |
|-------|------|---------|
| `/karaoke` | `KaraokeManagement.tsx` | List all karaoke songs, add/edit/delete |
| `/karaoke/new` | `KaraokeForm.tsx` | Create new karaoke song |
| `/karaoke/edit/:id` | `KaraokeForm.tsx` | Edit existing song |

### 2.2 Karaoke Form Fields

1. **Title** (required)
2. **Description** (optional)
3. **Cover Image** – upload via `/api/upload/image?bookId=karaoke&type=cover`
4. **Video** – upload via `/api/upload/video?bookId=karaoke&type=video`
5. **Background Song (Audio)** – upload via `/api/upload/audio?bookId=karaoke&type=audio`
6. **Lyrics** – array of `{ text, startTime, endTime }`:
   - Manual entry (text + start/end in seconds)
   - Optional: parse from LRC/SRT for import
7. **Status** – draft / published
8. **Metadata** – minAge, isMembersOnly, goalTags, order

### 2.3 Navigation

Add to `Layout.tsx` sidebar:

- `{ path: '/karaoke', icon: Music2, label: 'Karaoke' }`

---

## Phase 3: App – Karaoke Library & Player

### 3.1 Entry Point

**Option A: Listen Island / Listen Page**

- Add a “Karaoke” section or category on Listen page.
- Or add a Karaoke island on Explore (WorldPage) next to Listen.

**Option B: Dedicated Karaoke Island**

- New island on WorldPage or ListenPage that opens a Karaoke library modal/page.

**Recommended:** Add a Karaoke section on the Listen page (like “Continue Listening”) and a route `/karaoke` for the full library. Entry via Listen page card or bottom-nav if desired.

### 3.2 Routes

- `/karaoke` – KaraokeLibraryPage (grid of songs with cover image, title)
- `/karaoke/:id` – KaraokePlayerPage (video + lyrics + record flow)

### 3.3 KaraokeLibraryPage

- Fetch `GET /api/karaoke?status=published`
- Display cards: cover image, title, duration
- Tap → navigate to `/karaoke/:id`

---

## Phase 4: Karaoke Player & Recording

### 4.1 Player UI States

1. **Preview** – video + lyrics, no recording
2. **Recording** – video plays, lyrics scroll, mic records
3. **Processing** – mix background + recording
4. **Playback** – play mixed result
5. **Save / Share** – save to user library, share link or file

### 4.2 Video + Lyrics Display

- Use `<video>` (same pattern as `LessonPlayerPage`) with `onTimeUpdate` to sync lyrics.
- Lyrics shown below video; highlight current line based on `startTime` / `endTime`.
- Background audio: either from video (if instrumental) or separate `<audio>` (recommended: separate backing track for clean mix).

### 4.3 Recording

- **Despia:** No native protocol; use `DespiaService.recording.startRecording()` (Web APIs).
- `getUserMedia` + `MediaRecorder` → Blob (webm/opus). Works in Despia WebView with mic permission.
- Start recording when user taps “Record” (synced with video/audio start).
- Stop when video ends or user taps “Stop”.

### 4.4 Mixing Strategy

**Option A: Client-side (Web Audio API)**

- Load background track and recording into `AudioContext`.
- Create `GainNode` for each, `Destination` for mix.
- Use `MediaRecorder` on `MediaStreamDestination` to export mixed audio.
- Pros: No server load, instant. Cons: Safari/WebView quirks, export format limits.

**Option B: Server-side (FFmpeg)**

- Upload user recording to backend.
- FFmpeg mixes background + recording (with `-filter_complex amix`).
- Return mixed file URL.
- Pros: Reliable, consistent format. Cons: Server CPU, latency.

**Recommended:** Start with **Option B** – backend already uses FFmpeg and GCS. Add Option A as a future enhancement for offline/low-latency.

### 4.5 Timing

- Recording starts exactly when playback starts (shared `performance.now()` or `Date.now()`).
- Backend receives:
  - `recordingBlob` (or URL after upload)
  - `recordingStartOffset` (0 if recording started with playback)
- FFmpeg: mix `background.mp3` + `recording.webm` aligned at 0. No offset needed if start is synced.

---

## Phase 5: Save & Share

### 5.1 Save

- Store mixed URL in `KaraokeRecording` (or user’s “my recordings” collection).
- List in a “My Karaoke” section (e.g. on Listen page or profile).

### 5.2 Share

- **Link:** Generate shareable URL (e.g. `/karaoke/recording/:id`) that plays the mixed audio.
- **Download:** Offer “Download” to save mixed audio to device (if supported).
- **Social:** Use Web Share API (`navigator.share`) when available.

---

## Implementation Order

| Step | Task | Est. |
|------|------|------|
| 1 | Create `KaraokeSong` model | 1h |
| 2 | Create `karaoke` routes (CRUD, list) | 2h |
| 3 | Extend upload for karaoke (image, video, audio) | 1h |
| 4 | Portal: KaraokeManagement list page | 2h |
| 5 | Portal: KaraokeForm (create/edit) with uploads | 3h |
| 6 | App: KaraokeLibraryPage + route | 1.5h |
| 7 | App: KaraokePlayerPage – video + lyrics (no recording) | 3h |
| 8 | App: Add MediaRecorder recording flow | 2h |
| 9 | Backend: Mix endpoint (FFmpeg) | 2h |
| 10 | App: Processing, playback, save/share UI | 2h |
| 11 | KaraokeRecording model + save API (optional) | 1h |
| 12 | Listen page integration (Karaoke section) | 0.5h |
| 13 | Testing (iOS/Android/Web) | 2h |

**Total rough estimate:** ~20–22 hours

---

## Technical Notes

### Lyric Format

Reuse Lesson-style captions:

```json
[
  { "text": "Amazing grace, how sweet the sound", "startTime": 0.0, "endTime": 3.5 },
  { "text": "That saved a wretch like me", "startTime": 3.5, "endTime": 6.2 }
]
```

Optional: support LRC import in portal (`[00:12.34]Line text`).

### FFmpeg Mix Command (concept)

```bash
ffmpeg -i background.mp3 -i recording.webm -filter_complex "[0:a][1:a]amix=inputs=2:duration=first[aout]" -map "[aout]" -ac 2 -b:a 128k output.mp3
```

### Mobile / Despia Considerations

- Request microphone permission before recording.
- Ensure video uses `playsInline` and `muted` where needed for autoplay.
- Test MediaRecorder support in WebView (may need polyfill or server-side fallback).

---

## Open Questions

1. **Lyric import:** Manual only vs. LRC/SRT parser in portal?
2. **Video vs. static background:** Always video, or allow static image + lyrics?
3. **Recording storage:** Per-user quota? TTL for unsaved recordings?
4. **Share destination:** In-app only, or also external (e.g. link to standalone playback page)?

---

## Files to Create/Modify

### New Files
- `backend/src/models/KaraokeSong.js`
- `backend/src/models/KaraokeRecording.js` (optional)
- `backend/src/routes/karaoke.js`
- `projects-portal/src/pages/KaraokeManagement.tsx`
- `projects-portal/src/pages/KaraokeForm.tsx`
- `pages/KaraokeLibraryPage.tsx`
- `pages/KaraokePlayerPage.tsx`
- `services/karaokeService.ts`

### Modified Files
- `backend/src/index.js` – register karaoke routes
- `backend/src/routes/upload.js` – karaoke folder support
- `projects-portal/src/App.tsx` – karaoke routes
- `projects-portal/src/components/Layout.tsx` – karaoke nav item
- `App.tsx` – karaoke routes
- `pages/ListenPage.tsx` – Karaoke section (or link)
