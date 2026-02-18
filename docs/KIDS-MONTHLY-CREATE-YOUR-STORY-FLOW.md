# Kids Monthly / Create Your Story — End-to-End Flow

This doc describes how **Kids Monthly** books work across the **app**, **backend**, and **portal**, and how they stay separate from the rest of published books.

---

## 1. Two completely different “kinds” of books

There are **two** distinct concepts. Mixing them causes the confusion.

| Concept | What it is | Where it lives | Who sees it |
|--------|------------|----------------|-------------|
| **Kids Monthly template** | A **Book** (in the Book model) that you create in the **Portal**, with `bookType: 'kids_monthly'`. It’s a **template** (e.g. “There Once Was a Carpenter”) that defines the story and pages. You use the kid’s avatar/name to **generate** a custom copy. | `Book` collection, `bookType: 'kids_monthly'`, `status: 'published'` | **Only** in the app’s **Create Your Story** flow as a selectable story. **Never** in the main library/explore/catalog. |
| **Kid-created (generated) book** | A **Book** created by the backend **job** when a user finishes Create Your Story. It’s a **copy** of a template with that kid’s name and avatar baked in. Stored as `CustomMonthlyBook.bookId`. | `Book` collection (with `bookType: 'standard'`) + `CustomMonthlyBook` links it to the user/kid | **Only** that user, in **My Books** (from `/api/monthly-book/my-books`). **Never** in the main catalog, featured, trending, or for other users. |

So:

- **Kids Monthly template** = one book type (its own “category”): only for Create Your Story picker, never in the rest of books.
- **Kid-created book** = output of that flow: only in that user’s My Books, never in the global list.

---

## 2. Backend — how the two types are kept separate

### 2.1 Books API: `GET /api/books`

- **No `bookType` in query** (e.g. app’s main library, explore, portal “List” with `status=all` when not filtering by type):
  - Backend sets `filter.bookType = { $ne: 'kids_monthly' }` when `status !== 'all'`.
  - So **Kids Monthly templates never appear** in the main catalog.
- **With `bookType=kids_monthly`** (only Create Your Story):
  - Returns **only** books where `bookType === 'kids_monthly'` and (typically) `status=published`.
  - So **only** this list is used for the Create Your Story template picker.

### 2.2 Excluding kid-created books from the main catalog

- **Kid-created books** are those whose `_id` appears as `CustomMonthlyBook.bookId`.
- Backend has `getGeneratedMonthlyBookIds()`: returns all such book IDs.
- For the main list, featured, top-rated, trending:
  - Those IDs are excluded with `_id: { $nin: generatedBookIds }`.
- So **kid-created books never appear** in:
  - Main book list
  - Featured
  - Top-rated
  - Trending

### 2.3 Where kid-created books *do* appear

- **`GET /api/monthly-book/my-books`**
  - Query: `userId` (or email/deviceId).
  - Returns that user’s `CustomMonthlyBook` records (completed + optionally in-progress), with the linked `bookId` (the generated Book).
  - So each user only sees **their own** Create Your Story books (My Books).

### 2.4 Creating a kid-created book (the flow that uses the template)

- **`POST /api/monthly-book/create-from-book`**
  - Body: `userId`, `kidId`, `bookId` (the **template** Book id), `childName`, `childCharacterImageUrl`, etc.
  - Backend checks: that `bookId` is a Book with `bookType === 'kids_monthly'` and `status === 'published'`.
  - Creates a `CustomMonthlyBook` (status `pending`), then kicks off **monthlyBookGenerator** job.
- **Job**:
  - Loads the **template** Book (kids_monthly) and its pages.
  - For each page: substitutes child name, uses kid’s avatar for character images, generates backgrounds if needed.
  - Creates a **new** `Book` with `bookType: 'standard'`, `status: 'published'`, and links it in `CustomMonthlyBook.bookId`.
  - That new Book is the **kid-created** one: it’s excluded from the main catalog via `getGeneratedMonthlyBookIds()` and only shown in My Books.

### 2.5 Notifications

- **Publishing a Kids Monthly template** (in the portal): we **do not** send the global “New Story Available!” notification (we skip when `book.bookType === 'kids_monthly'`). So it doesn’t go to the whole network.
- **When a kid’s story is ready**: we send a **user-specific** notification to that user only (“Your story is ready!”).

---

## 3. App (front-end) — how it uses the backend

### 3.1 Main library / explore (rest of books)

- **BooksContext** (and any “all books” / explore UI) calls **`ApiService.getBooks()`**.
- That calls **`GET /api/books`** (with optional `excludeGeneratedMonthly=1`; backend already excludes both kids_monthly and generated IDs when not requesting a specific bookType).
- So the app’s **main book list** never includes:
  - Kids Monthly templates
  - Kid-created books

So in the app, “the rest of the books that are published” = only standard, non–kid-created books.

### 3.2 Create Your Story — picking a template

- **Create Your Story** flow (e.g. `CreateYourStoryPage`) loads the **template list** with:
  - **`GET /api/books?bookType=kids_monthly&status=published`**
- So the user only sees **Kids Monthly** books here. These are in their “own category list” (only this screen), not in the main library.

### 3.3 My Books (kid-created books)

- **Library** (and any “My Books” section) calls **`GET /api/monthly-book/my-books?userId=...&includeInProgress=1`**.
- Response is the list of **CustomMonthlyBook** for that user (with `bookId`, title, cover, status).
- So the user sees **only their own** generated stories, not anyone else’s and not the templates.

---

## 4. Portal — how it fits in

### 4.1 Creating and managing Kids Monthly **templates**

- In the **Portal** you create/edit **Books**.
- For a book that should be a **Create Your Story** template you set **Book type = “Kids Monthly Book”** (`bookType: 'kids_monthly'`).
- You publish it like any other book. That book is then:
  - **Only** returned by the backend when the app asks for `bookType=kids_monthly`.
  - **Never** returned in the main `GET /api/books` (no bookType) list.
  - **Never** triggers a global “new book” notification (we skip that for `kids_monthly`).

So the portal is where you define the **separate category** of “Kids Monthly” books; the backend and app treat them as their own list.

### 4.2 Portal Books page — three lists

- **List**: all books (e.g. `status=all`), typically excluding archived in the UI. Backend can return both `standard` and `kids_monthly` when `status=all` (portal needs to see both).
- **Archived**: books with `status=archived`.
- **Kids Monthly Books**: in the portal this tab is for **kid-created** books (admin view). It uses **`GET /api/books?status=all&onlyGeneratedMonthly=1`**, which returns only books whose IDs are in `CustomMonthlyBook.bookId` — i.e. the generated copies, not the templates.

So in the portal:

- **Templates** (bookType kids_monthly) appear in the main List (and can be filtered/labeled there).
- **Kid-created** (generated) books appear in the “Kids Monthly Books” tab via `onlyGeneratedMonthly=1`.

---

## 5. End-to-end flow in one paragraph

You create a **Kids Monthly** book in the **Portal** (Book type = Kids Monthly Book) and publish it. That book is a **template**. In the **app**, it appears **only** in the Create Your Story flow when we call **`GET /api/books?bookType=kids_monthly&status=published`**; it does **not** appear in the rest of the books (backend excludes `kids_monthly` when bookType is not specified). When a user picks that template and completes Create Your Story, the **backend job** creates a **new** Book (with the kid’s name and avatar) and links it in **CustomMonthlyBook**. That new book is **kid-created**; the backend excludes all such books from the main catalog, featured, trending, and top-rated, and serves them **only** via **`GET /api/monthly-book/my-books`** for that user. So: **Kids Monthly templates** = their own category (Create Your Story only). **Kid-created books** = their own list (My Books only). **Rest of books** = standard published books only; no mixing.

---

## 6. Summary table

| Audience | Where they see books | API / filter | What’s included |
|----------|----------------------|--------------|-----------------|
| App – main library/explore | Main book list, categories, etc. | `GET /api/books` (no bookType) | Only standard published books; no kids_monthly, no generated. |
| App – Create Your Story picker | “Pick a story” step | `GET /api/books?bookType=kids_monthly&status=published` | Only Kids Monthly **templates**. |
| App – My Books | Library “My Books” section | `GET /api/monthly-book/my-books` | Only **that user’s** kid-created books. |
| Portal – List tab | Books list | `GET /api/books?status=all` (or with status filter) | All books (standard + kids_monthly templates). Portal can show type. |
| Portal – Kids Monthly Books tab | Admin view of kid-created | `GET /api/books?status=all&onlyGeneratedMonthly=1` | Only **generated** (kid-created) books. |

So: **Kids Monthly templates** and **kid-created books** are each in their own category/list; they never appear in “the rest of the books” for the app’s main catalog.
