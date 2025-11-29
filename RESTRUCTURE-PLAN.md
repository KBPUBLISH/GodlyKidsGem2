# GCS & MongoDB Restructuring Plan

## Problem
- Files scattered across "Godly Kids" and "test" folders in GCS
- MongoDB collections may have inconsistent data
- No clear organization by book
- Hard to find related assets

## Solution: Unified Book-Centric Structure

### 1. GCS Storage Structure

```
developmentgk/
├── books/
│   ├── {bookId}/
│   │   ├── cover.jpg                    # Book cover
│   │   ├── pages/
│   │   │   ├── page-1-background.jpg    # Page backgrounds
│   │   │   ├── page-1-scroll.png        # Page scrolls
│   │   │   ├── page-2-background.mp4    # Video backgrounds
│   │   │   └── ...
│   │   └── audio/
│   │       ├── {timestamp}_{hash}.mp3   # TTS audio files
│   │       └── ...
│   └── {anotherBookId}/
│       └── ...
├── categories/
│   ├── {categorySlug}-icon.png          # Category icons
│   └── ...
└── system/
    ├── default-cover.jpg                # System defaults
    └── placeholders/
```

### 2. MongoDB Structure

#### Collections:

**books** - Main book metadata
```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  author: String,
  coverUrl: String,              // → books/{bookId}/cover.jpg
  categoryId: ObjectId,           // Reference to categories
  level: String,
  isAudio: Boolean,
  isRead: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

**pages** - Book pages (linked to books)
```javascript
{
  _id: ObjectId,
  bookId: ObjectId,               // Reference to books
  pageNumber: Number,
  backgroundUrl: String,          // → books/{bookId}/pages/page-X-background.ext
  backgroundType: String,         // 'image' | 'video'
  scrollUrl: String,              // → books/{bookId}/pages/page-X-scroll.ext
  scrollHeight: Number,
  textBoxes: [{
    text: String,
    x: Number,
    y: Number,
    width: Number,
    alignment: String,
    fontFamily: String,
    fontSize: Number,
    color: String
  }],
  createdAt: Date,
  updatedAt: Date
}
```

**categories** - Book categories
```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  color: String,
  icon: String,                   // → categories/{slug}-icon.ext
  createdAt: Date,
  updatedAt: Date
}
```

**ttscaches** - TTS audio cache
```javascript
{
  _id: ObjectId,
  textHash: String,
  voiceId: String,
  text: String,
  audioUrl: String,               // → books/{bookId}/audio/{timestamp}_{hash}.mp3
  alignmentData: {
    words: [{
      word: String,
      start: Number,
      end: Number
    }]
  },
  createdAt: Date
}
```

**playlists** - User playlists
```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  bookIds: [ObjectId],            // References to books
  createdAt: Date,
  updatedAt: Date
}
```

**users** - User accounts
```javascript
{
  _id: ObjectId,
  email: String,
  firstName: String,
  lastName: String,
  age: Number,
  createdAt: Date,
  updatedAt: Date
}
```

### 3. Migration Steps

#### Step 1: Backup Current Data
```bash
# Backup MongoDB
mongodump --uri="mongodb+srv://..." --out=./backup

# List GCS files (for reference)
gsutil ls -r gs://developmentgk/ > gcs-backup-list.txt
```

#### Step 2: Clean Up MongoDB
- Remove orphaned pages (pages without valid bookId)
- Remove orphaned TTS cache entries
- Ensure all books have valid categoryId references
- Add missing indexes

#### Step 3: Reorganize GCS Files
- Copy files to new structure
- Update database URLs
- Verify all files are accessible
- Delete old files (after verification)

#### Step 4: Update Backend Code
- Ensure all upload endpoints use new structure
- Update file path generation
- Add validation for file organization

### 4. Benefits

✅ **Clear Organization**: Each book has its own folder
✅ **Easy Maintenance**: Find all assets for a book in one place
✅ **Better Performance**: Organized structure = faster queries
✅ **Scalability**: Easy to add new books without clutter
✅ **Data Integrity**: Proper references between collections
✅ **Backup Friendly**: Can backup/restore individual books

### 5. Implementation Files

1. `backend/src/scripts/restructure-gcs.js` - GCS file reorganization
2. `backend/src/scripts/cleanup-mongodb.js` - MongoDB cleanup
3. `backend/src/scripts/verify-structure.js` - Verification script
4. Updated upload routes to use new structure

### 6. Running the Migration

```bash
# 1. Backup first!
cd backend
npm run backup

# 2. Clean up MongoDB
node src/scripts/cleanup-mongodb.js

# 3. Restructure GCS
node src/scripts/restructure-gcs.js

# 4. Verify everything
node src/scripts/verify-structure.js

# 5. Test the app
npm start
```

### 7. Rollback Plan

If something goes wrong:
1. Stop all services
2. Restore MongoDB from backup
3. GCS files are copied (not moved), so originals still exist
4. Revert code changes
5. Restart services

---

**Status**: Ready to implement
**Estimated Time**: 30-60 minutes (depending on data size)
**Risk Level**: Low (we copy files, not move them)
