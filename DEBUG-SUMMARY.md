# Word Highlighting Debug Summary

## What I've Done

### 1. Created Debug Documentation
**File:** `WORD-HIGHLIGHTING-DEBUG.md`

This comprehensive guide includes:
- How the word highlighting system works (backend + frontend flow)
- Common issues and their solutions
- Step-by-step debugging procedures
- Testing checklist
- Quick test script for browser console
- Expected console output examples

### 2. Enhanced Frontend Logging
**File:** `pages/BookReaderPage.tsx`

Added detailed console logging to track:
- **Alignment Reception** (line 214-225):
  - Words count
  - First 5 words
  - Timing range (first and last word)
  
- **Audio Time Tracking** (line 235-268):
  - Current playback time (every second)
  - Current word index
  - Word being highlighted with timing info
  - Word change events

### 3. Enhanced Backend Logging
**File:** `backend/src/index.js`

Added detailed logging for character-to-word conversion:
- Input data (total chars, total words, sample data)
- Each word conversion (first 5 words)
- Final timing range
- Alignment data structure

## How to Debug

### Step 1: Check Backend is Running
```bash
# Should show process IDs
lsof -ti:5001
```

### Step 2: Open Browser Console
1. Navigate to http://localhost:3000
2. Open DevTools (F12 or Cmd+Option+I)
3. Go to Console tab

### Step 3: Navigate to a Book
1. Click on any book
2. Click "Read Book"
3. Click the Play button (wood button at bottom left)

### Step 4: Watch Console Output

**Expected Output (Success):**

**Backend Console:**
```
TTS WebSocket client connected
Connected to ElevenLabs WebSocket
📨 ElevenLabs message: {...}
📊 Alignment data received: {...}
🔄 Converting character-level to word-level alignment
📊 Input: { totalChars: 150, totalWords: 25, ... }
  Word 0: "Once" [0.00s - 0.35s]
  Word 1: "upon" [0.35s - 0.68s]
  Word 2: "a" [0.68s - 0.75s]
  Word 3: "time" [0.75s - 1.10s]
  Word 4: "there" [1.10s - 1.45s]
✅ Sending word alignment: 25 words
📊 Timing range: { first: {...}, last: {...} }
```

**Frontend Console:**
```
📝 Received word alignment: { words: [...] }
📝 Words count: 25
📝 First 5 words: [{word: "Once", start: 0, end: 0.35}, ...]
📝 Timing range: { first: {...}, last: {...} }
✅ Received complete message from backend: /uploads/audio/...
🔍 Rendering check: { isActive: true, hasWordAlignment: true, wordsCount: 25, currentWordIndex: 0 }
🕐 Audio time: 0.00 Word index: 0
📍 Current word: Once [0.00s - 0.35s]
✨ Highlighting word 0 : Once
🕐 Audio time: 0.40 Word index: 1
📍 Current word: upon [0.35s - 0.68s]
✨ Highlighting word 1 : upon
...
```

### Step 5: Common Issues

#### Issue: No alignment data received
**Console shows:** `⚠️ No alignment data available for highlighting`

**Possible causes:**
1. WebSocket connection failed → Falls back to HTTP
2. ElevenLabs not returning alignment data
3. Backend conversion error

**Check:**
- Backend console for WebSocket errors
- Network tab for WebSocket connection (should show "101 Switching Protocols")
- ElevenLabs API key in `.env`

#### Issue: Alignment received but no highlighting
**Console shows:** Alignment data but no word highlighting

**Possible causes:**
1. State not updating (React closure issue)
2. Rendering logic not working
3. CSS not applying

**Check:**
- `currentWordIndex` value in console
- Inspect element to see if `bg-yellow-300` class is applied
- Check if `isActive` is true in rendering check

#### Issue: Highlighting out of sync
**Console shows:** Words highlighting but timing is off

**Possible causes:**
1. Using estimated timing (0.4s per word) instead of real alignment
2. Character-to-word conversion error
3. Audio playback speed mismatch

**Check:**
- Backend logs for "Converting character-level to word-level"
- Word timing values (should vary, not all 0.4s)
- Audio element playback rate (should be 1.0)

## Quick Fixes

### Fix 1: Restart Backend
If WebSocket isn't working:
```bash
cd backend
npm start
```

### Fix 2: Clear Cache
If using old cached audio without alignment:
```javascript
// In MongoDB or via backend
db.ttscaches.deleteMany({})
```

### Fix 3: Force HTTP Fallback
If WebSocket is problematic, you can test with HTTP only:
```javascript
// In apiService.ts, comment out WebSocket code and use:
const response = await fetchWithTimeout(`${baseUrl}tts/generate`, {
  method: 'POST',
  body: JSON.stringify({ text, voiceId, bookId })
});
```

## Testing Without a Book

You can test the TTS system directly in the browser console:

```javascript
// Test WebSocket connection
const ws = new WebSocket('ws://localhost:5001/api/tts/ws');

ws.onopen = () => {
  console.log('✅ Connected');
  ws.send(JSON.stringify({
    text: 'Hello world, this is a test.',
    voiceId: '21m00Tcm4TlvDq8ikWAM'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('📨', data.type, data);
};

ws.onerror = (error) => {
  console.error('❌ Error:', error);
};
```

## Visual Indicators

When word highlighting is working:
- ✅ Words should have yellow background (`bg-yellow-300`)
- ✅ Highlight should move smoothly from word to word
- ✅ Timing should match audio playback
- ✅ No lag or jumping

## Files Modified

1. `WORD-HIGHLIGHTING-DEBUG.md` - Comprehensive debug guide
2. `pages/BookReaderPage.tsx` - Enhanced frontend logging
3. `backend/src/index.js` - Enhanced backend logging
4. `DEBUG-SUMMARY.md` - This file

## Next Steps

1. **Test the feature:**
   - Run the main app
   - Navigate to a book
   - Click play and watch console

2. **Review logs:**
   - Check both frontend and backend consoles
   - Look for errors or warnings
   - Verify alignment data is received

3. **Report findings:**
   - Share console output
   - Note any errors or unexpected behavior
   - Check if highlighting works at all or just timing is off

## Environment Check

Make sure these are set in `backend/.env`:
```
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
MONGO_URI=your_mongodb_connection_string_here
PORT=5001
GCS_BUCKET_NAME=your_bucket_name
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
```

**⚠️ SECURITY NOTE: Never commit actual credentials to git!**

## Current Status

✅ Backend running on port 5001
✅ Frontend running on port 3000  
✅ MongoDB connected
✅ Enhanced logging added
✅ Debug documentation created

🔍 **Ready to test!** Open the app and try the word highlighting feature.
