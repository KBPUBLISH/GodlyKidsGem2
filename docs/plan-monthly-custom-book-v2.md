# Monthly Custom Book Feature — Plan v2

**Simplified MVP (initial release):**
- **One proven book style** — skip 5-style picker; use a single beautiful, proven style for all books.
- **Story picker** — User **chooses which of the 12 main Bible character stories** they want (e.g. "Help David slay Goliath," "Journey with Noah"). Gets kids excited and invested.
- **4-step onboarding:** Name → Selfie → Pick Bible character story → Done!
- **Post-MVP:** 5 book styles, supportive characters.

---

## 0. Character Identity and Unique Identification (Kids vs Bible)

When a kid creates their character (selfie + style), we must save that character with a **unique identification tag** tied to that user/kid — not their first name. Otherwise we cannot tell "this child Noah's avatar" from "the biblical character Noah" or from another kid named Noah.

**Two namespaces:**

1. **Portal / global characters (Bible and story characters)**  
   - Stored in the portal "saved characters" table.  
   - Use a **reserved internal tag** that is never the same as a kid's name, e.g. `bible_noah`, `bible_david`, `bible_jesus`.  
   - Display name can still be "Noah" or "David" in the app; internally we resolve by `bible_noah` so there is no collision with any kid named Noah.  
   - Templates reference the Bible character by this internal tag (e.g. `bibleCharacterTag: 'bible_noah'`), not by display name.

2. **User/kid-scoped characters (kid avatar — MVP)**  
   - Stored **per user, per kid** in our database.  
   - **Never use first name as the unique identifier.** Use a stable, unique key so that when a new book is created we tag **that specific kid's** saved character.  
   - **Child (main character):** Resolve by `userId` + `kidId`. The kid's avatar (reference image + style) is stored on the kid profile (e.g. `AppUser.kidProfiles[kidId].characterAvatar`, `originalSelfie`, `characterStyle`). When generating a book we load the character for **that** `kidId` — so a thousand kids named Noah each have their own avatar keyed by their own `kidId`.  
   - **Optional explicit character tag:** If we want a single "character tag" that can be referenced in prompts (e.g. for future APIs), we can generate a **unique character tag ID** when the kid first creates their avatar (e.g. UUID or `kid_${kidId}`) and store it on the kid profile and/or in a `KidCharacter` table: `{ characterTagId, userId, kidId, referenceImageUrl, styleId, displayName }`. Resolution for "the child in this book" is always by `kidId` (or `characterTagId`), never by `displayName`.  
   - **Supportive characters (post-MVP):** When we add them later, each would get a unique tag per user/book (e.g. `supportive_${customMonthlyBookId}_0`) and a display name for story text only.

**Summary (MVP):** Story text uses the kid's first name; image generation resolves by **Bible:** internal tag (`bible_noah`), **Child:** `kidId`. No supportive characters in v1.

---

## 1. Book Style (MVP: Single; Post-MVP: 5 Choices)

- **MVP:** One default **style prompt** for all books (e.g. soft storybook illustration, warm lighting). No style picker in app.
- **Post-MVP:** Add 5 selectable book styles (Watercolor, Cartoon, Storybook, etc.); user chooses in app.
- **Relationship:** Style drives illustration look; selfie → avatar uses one consistent look for MVP.


---

## 2. Saved Characters in the Portal (OpenArt-Style @Tag)

**Goal:** Like OpenArt, we want to “save a character” and reference it when prompting (e.g. “@David” so the model uses the saved David).

**Portal feature: “Saved characters” (or “Character library”)**

- **Create / save a character** with:
  - **Name / tag:** e.g. `David`, `Noah`, `Jesus` (used as the “@tag” in prompts).
  - **Reference image (optional):** One or more images that define how this character looks.
  - **Style prompt (required):** A detailed, fixed text description used in every scene where this character appears (e.g. “young shepherd boy with sling and stones, biblical Israel attire, brown hair, determined expression”). This is the main driver of consistency.
- **Usage when generating:** When building the prompt for a page, we inject the character’s **style prompt** (and optionally pass the reference image to the API). So “@David” in our system means: “include David’s stylePrompt in the scene description, and optionally attach David’s reference image.”

**Technical reality (Vertex Imagen):**

- Our current stack already uses **reference images** for **one subject** in [devotional-stories](backend/src/routes/devotional-stories.js) (`referenceImages` + `REFERENCE_TYPE_SUBJECT`). That works well for **one person per scene** (e.g. the child).
- Google’s docs state that **placing two or more people in different scenes while preserving their identities is an unintended use case** and produces poor results. So we **cannot** rely on Imagen to keep the child + 2 supportive characters + 1 Bible character all consistent via multiple reference images in one call.

**Practical approach for automated book illustrations:**

1. **One reference per generated image:** Use **one** reference image per page — the **child** (from selfie + character style). That keeps the child’s appearance consistent across the 15–20 pages.
2. **Bible character:** Use the **saved character** system:
   - **Always** use the saved character’s **stylePrompt** in the text prompt (e.g. “David (young shepherd with sling, biblical attire) stands beside the child”). That gives the model a fixed, repeatable description so “David” looks similar page to page.
   - **Optionally** try passing the Bible character’s reference image as a **second** reference in the same Imagen call. Google doesn’t guarantee multi-person consistency, but we can experiment; if quality is poor, we rely on **stylePrompt only** for the Bible character.
3. **Supportive characters:** Post-MVP (not in v1).
4. **Summary:** The “saved character” feature is **absolutely valuable**: it gives a single place to define **name + stylePrompt + optional reference** (e.g. @Jesus, @David). When we prompt the image generator we “tag” that reference by injecting the **stylePrompt** (and optionally the reference image). True multi-reference identity preservation is limited by Imagen today, so the **stylePrompt is the backbone of consistency** for non-child characters; reference images can still help when we use a single subject (child) or when we experiment with two subjects.

---

## 3. Book Builder in the Portal

**Concept:** The portal defines 12 templates (one per main Bible character). **MVP:** The user **chooses which Bible character story** they want (e.g. Noah, David, Moses, Jesus). Story picker in the app shows all 12 options; backend uses the selected template for that character.

**Portal components:**

1. **Book style (MVP):** One default style prompt. **Post-MVP:** 5 selectable styles.
2. **Saved characters:** As above — name/tag, optional reference image, required style prompt. Used for Bible characters (and optionally other recurring characters).
3. **Monthly book templates (12):** Each template has:
   - Month index (1–12), title, description.
   - **Bible character:** Link to one saved character (e.g. David, Noah).
   - **Supportive roles:** Post-MVP; for MVP use 0.
   - **Story pages:** Array of 15–20 pages: `pageNumber`, `text` (with `{childName}` only for MVP), and optional `sceneDescription` or `imagePromptTemplate` for that page.
4. **Flow:** Portal admins create/edit saved characters and book style, then build the 12 templates. When the user creates their monthly book, they **pick one of the 12 Bible character stories** in the app; the backend loads that template and runs the generator with the child's name + character ref + saved Bible character stylePrompt.

**Saving the generated books:** Generated output is stored as a **Book** (existing model) with **Pages** (existing model), and a **CustomMonthlyBook** record points to that book and the template/style/characters used. So “saving” is: create Book + Pages in DB and GCS, and link from CustomMonthlyBook.

---

## 4. App Placement: My Library (Front and Center)

**Where it lives:** The feature appears as a **very prominent entry** in the **My Library** section of the app so it's obvious that users can create their own story and "enter the Bible."

- **Entry point:** A front-and-center card or CTA in [LibraryPage](pages/LibraryPage.tsx) (e.g. "Create your story" / "Enter the Bible" / "Your monthly adventure"). Tapping it starts the onboarding flow; no need to dig into menus.
- **Messaging:** Make clear that **once a month** they get their own brand new story — reinforce this in the CTA or short copy.

---

## 5. Onboarding Flow (Create Your Story) — 4 Steps (MVP)

**Order of steps:**

1. **Name** — Ask for the name used in the story (e.g. "What name should we use in your story?"). Store as **child name**; substitute everywhere the template has `{childName}` (or "enter kid's name here").
2. **Selfie** — User takes a selfie; it gets turned into the **one proven style** (existing pipeline: selfie + default style → avatar). We store the result as the child's character reference (keyed by kidId).
3. **Pick Bible character story** — User **chooses which of the 12 main Bible character stories** they want (e.g. "Help David slay Goliath," "Journey with Noah," "Adventure with Jesus"). This gets kids excited and invested. App sends the selected template (Bible character) to the backend.
4. **Done!** — App calls the backend with child name + character ref + **selected story/template**. User can exit; we notify when the story is done.

**Trial gate (first 4 pages):** If no active trial, only create and show first 4 pages; prompt to start trial for full story. **Once a month** = one new story.

---

## 5b. Make the First Experience MAGICAL

- **Progress screen:** "Creating your story with [Bible character]..." (e.g. "Creating your story with Jesus...")
- **Progress animation** with **fun facts** (e.g. "Did you know Jesus loved children just like you?")
- **Preview of 1 generated page** appears when first page is ready
- **Copy:** "Your story is almost ready! We'll notify you in ~5 minutes"

---

## 5c. Smart Notification Copy

- **Immediate (when build starts):** "📚 Your story is being written by angels..."
- **~5 min later (when ready):** "✨ [Child's name], your adventure with [Bible character] is ready!" (e.g. "your adventure with Moses is ready!")
- **If not opened in 24h:** "Your special story is waiting for you!"

---

## 5d. Social Proof (Share Page)

- **"Share Page" button** on each story page
- Parents share → free marketing; **watermark:** "Created with GodlyKids"
- **Track shares** for viral coefficient (analytics)

---

## 5e. Technical Optimization

- **Pre-generate common elements** to reduce cost; reuse with child composite:

```javascript
// Pre-generate common elements to reduce costs:
const preGenerated = {
  backgrounds: ['bethlehem-stable', 'red-sea', 'ark'],
  bibleCharacters: ['jesus-style-1', 'moses-style-1', 'noah-style-1', 'david-style-1'],
  // Generate these once, reuse with child composite per page
};
```

- **Backgrounds:** e.g. `bethlehem-stable`, `red-sea`, `ark` — generate once, reuse across books.
- **Bible character assets:** e.g. `jesus-style-1`, `moses-style-1` — generate once per saved character, reuse; composite child into scene per page.
- Each book then only generates the **child-in-scene** per page (or composites child onto pre-generated background + Bible character).

---

## 6. End-to-End Flow (Revised — Simplified MVP)

1. **Portal:** One default book style, 12 saved Bible characters (stylePrompt + optional reference), 12 templates with `{childName}` (one per Bible character story).
2. **App — My Library:** Prominent "Create your story" / "Enter the Bible" entry → **4-step onboarding:** (1) Name, (2) Selfie, (3) **Pick which Bible character story** (1 of 12), (4) Done! Magical progress screen ("Creating your story with [chosen Bible character]...", fun facts, 1-page preview, "We'll notify you in ~5 min"). User can exit.
3. **Backend:** Create CustomMonthlyBook (**user-selected template**, single style, child ref, childName). **Trial gate:** No trial → only first 4 pages; trial/paid → full 15–20. Job loads selected template, substitutes childName, uses one style + saved Bible character; per page: build scene (optionally use pre-generated backgrounds/Bible assets); call Imagen; save to Book/Pages. **Notifications:** immediate ("Your story is being written by angels..."), ~5 min ("[Name], your adventure with [Bible character] is ready!"), 24h reminder if not opened.
4. **App:** Share Page button on each page; watermark "Created with GodlyKids"; track shares. User opens book from My Library when notified; free users see first 4 pages, prompt to start trial for rest.

---

## 7. Is This Possible?

**Yes.** We already do:

- **Reference image for one subject:** Devotional stories use Imagen with one reference (child’s selfie) and a style. We extend that pattern for the child in every page.
- **Text-driven consistency:** Using a fixed **stylePrompt** for Bible characters (MVP: child + Bible only) is a standard approach when the API doesn’t support multi-person reference. The portal “saved character” is the right place to define that.
- **Book builder:** The portal already has forms and CRUD for stories/books. Adding “Book styles,” “Saved characters,” and “Monthly book templates” is new data and UI, but the pattern is the same.

**Valuable additions:**

- **Save a character** in the portal (name, reference image, style prompt) and **tag it in the prompt** when generating — this is the right abstraction and matches the OpenArt mental model. Even if we only use the stylePrompt for non-child characters today, having the reference stored allows future use (e.g. different APIs or Imagen improvements).
- **MVP:** One proven style keeps the first experience simple; **post-MVP:** 5 book styles for more choice.

---

## 8. Implementation Additions (to Original Plan)

| Area | Addition |
|------|----------|
| Portal | **MVP:** One default style; 12 saved Bible characters; 12 templates (one per Bible character). **Post-MVP:** 5 styles. |
| App | **My Library:** Front-and-center CTA; **4-step onboarding:** Name → Selfie → **Pick Bible character story (1 of 12)** → Done. Story picker gets kids excited. |
| App | **Magical experience:** "Creating your story with [Bible character]..."; progress + fun facts; 1-page preview; "We'll notify you in ~5 min". |
| App | **Notifications:** Immediate "Your story is being written by angels..."; ~5 min "[Name], your adventure with [Bible character] is ready!"; 24h "Your special story is waiting for you!" if not opened. |
| App | **Share Page:** Button per page; watermark "Created with GodlyKids"; track shares. Trial gate: first 4 pages for free. |
| Backend | **Template:** Use **user-selected** story/template (from story picker). Trial gate: no trial → 4 pages; trial → full. Substitute {childName}. |
| Backend | **Generation:** One style + child ref + Bible stylePrompt. Pre-generate backgrounds + Bible assets; reuse with child composite. Notify: immediate, ~5 min, 24h. |

This keeps the feature feasible with current Imagen behavior while adding the “saved character” and “book style” system you described, **Post-MVP:** Supportive characters (photo + name, 1–2 per book); template supportive-role config; story placeholders like `{supportiveName1}`. Plan already defines unique tagging for them. Current doc leaves room to add that later (e.g. different API or future Imagen support).
