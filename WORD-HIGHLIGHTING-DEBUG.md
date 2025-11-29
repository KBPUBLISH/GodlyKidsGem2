# Word Highlighting Debug Guide

## Overview
This document helps debug the word highlighting feature in the Book Reader app. The feature should highlight words in sync with TTS audio playback.

## How It Works

### 1. **Backend Flow (WebSocket)**
Located in: `backend/src/index.js` (lines 42-417)

```
Client → WebSocket → ElevenLabs API → Word Alignment → Client
```

**Key Steps:**
1. Client connects to WebSocket at `ws://localhost:5001/api/tts/ws`
2. Client sends: `{ text, voiceId, bookId }`
3. Backend connects to ElevenLabs WebSocket API
4. ElevenLabs returns:
   - Audio chunks (binary/base64)
   - Alignment data (character-level timestamps)
5. Backend converts character-level → word-level alignment
6. Backend sends to client:
   - `{ type: 'alignment', words: [...] }`
   - `{ type: 'audio', data: base64 }`
   - `{ type: 'complete', audioUrl, alignment }`

### 2. **Frontend Flow**
Located in: `pages/BookReaderPage.tsx`

**State Variables:**
- `wordAlignment` - Current word alignment data
- `currentWordIndex` - Index of currently highlighted word
- `wordAlignmentRef` - Ref to avoid closure issues

**Key Functions:**
- `handlePlayText()` (line 177) - Initiates TTS playback
- `ApiService.generateTTS()` - WebSocket communication
- `audio.ontimeupdate` (line 237) - Tracks playback and updates highlighting

## Common Issues & Solutions

### Issue 1: No Word Highlighting at All

**Symptoms:**
- Audio plays but words don't highlight
- Console shows: "⚠️ No alignment data available for highlighting"

**Debug Steps:**

1. **Check if alignment data is received:**
```javascript
// In browser console during playback:
console.log('Alignment:', wordAlignment);
console.log('Current word index:', currentWordIndex);
```

2. **Check WebSocket messages:**
```javascript
// Add to BookReaderPage.tsx in generateTTS callback (line 215):
(alignment) => {
    console.log('📝 Received word alignment:', alignment);
    console.log('📝 Words count:', alignment?.words?.length);
    console.log('📝 First 3 words:', alignment?.words?.slice(0, 3));
    setWordAlignment(alignment);
    wordAlignmentRef.current = alignment;
}
```

3. **Check backend logs:**
```bash
# Look for these in backend console:
✅ Sending word alignment: X words
📊 Alignment data received: ...
```

**Possible Causes:**
- ❌ ElevenLabs not returning alignment (WebSocket fallback to HTTP)
- ❌ Alignment data format mismatch
- ❌ State not updating due to React closure

### Issue 2: Highlighting Out of Sync

**Symptoms:**
- Words highlight but timing is off
- Highlights too fast or too slow

**Debug Steps:**

1. **Check audio timing:**
```javascript
// Add to audio.ontimeupdate (line 237):
audio.ontimeupdate = () => {
    const currentAlignment = wordAlignmentRef.current;
    if (currentAlignment && currentAlignment.words) {
        const currentTime = audio.currentTime;
        console.log('🕐 Audio time:', currentTime.toFixed(2));
        
        const wordIndex = currentAlignment.words.findIndex(
            (w) => currentTime >= w.start && currentTime < w.end
        );
        
        if (wordIndex !== -1) {
            console.log('📍 Word:', currentAlignment.words[wordIndex].word, 
                       'Start:', currentAlignment.words[wordIndex].start,
                       'End:', currentAlignment.words[wordIndex].end);
        }
    }
};
```

2. **Check alignment timing values:**
```javascript
// In browser console:
wordAlignment.words.forEach((w, i) => {
    console.log(`Word ${i}: "${w.word}" [${w.start.toFixed(2)}s - ${w.end.toFixed(2)}s]`);
});
```

**Possible Causes:**
- ❌ Estimated timing (0.4s per word) doesn't match actual audio
- ❌ ElevenLabs alignment data conversion error
- ❌ Character-to-word conversion logic issue

### Issue 3: WebSocket Connection Fails

**Symptoms:**
- Console shows WebSocket errors
- Falls back to HTTP (no real-time alignment)

**Debug Steps:**

1. **Check WebSocket connection:**
```javascript
// In browser console:
const ws = new WebSocket('ws://localhost:5001/api/tts/ws');
ws.onopen = () => console.log('✅ WebSocket connected');
ws.onerror = (e) => console.error('❌ WebSocket error:', e);
ws.onclose = (e) => console.log('🔌 WebSocket closed:', e.code, e.reason);
```

2. **Check backend WebSocket server:**
```bash
# Backend should show:
WebSocket server available at ws://localhost:5001/api/tts/ws
TTS WebSocket client connected
```

3. **Check CORS/Network:**
- Ensure backend is running on port 5001
- Check browser Network tab for WebSocket connection
- Look for "101 Switching Protocols" response

**Possible Causes:**
- ❌ Backend not running
- ❌ Port 5001 blocked
- ❌ CORS issues
- ❌ ElevenLabs API key invalid

### Issue 4: Highlighting Stops Mid-Playback

**Symptoms:**
- First few words highlight, then stops
- Audio continues playing

**Debug Steps:**

1. **Check for errors in ontimeupdate:**
```javascript
audio.ontimeupdate = () => {
    try {
        const currentAlignment = wordAlignmentRef.current;
        console.log('🔄 Update tick, has alignment:', !!currentAlignment);
        // ... rest of code
    } catch (error) {
        console.error('❌ Error in ontimeupdate:', error);
    }
};
```

2. **Check if alignment is being cleared:**
```javascript
// Search for setWordAlignment(null) calls
// Make sure they're not being called prematurely
```

**Possible Causes:**
- ❌ State update causing re-render and clearing alignment
- ❌ Error in findIndex logic
- ❌ Audio time exceeds last word's end time

## Testing Checklist

### Backend Tests

- [ ] Backend server running on port 5001
- [ ] MongoDB connected successfully
- [ ] ElevenLabs API key configured in `.env`
- [ ] WebSocket server initialized
- [ ] Can connect to `ws://localhost:5001/api/tts/ws`

### Frontend Tests

- [ ] Main app running on port 3000
- [ ] Can navigate to a book
- [ ] Can see text boxes on page
- [ ] Play button appears and is clickable
- [ ] Audio plays when clicking play
- [ ] Console shows alignment data received
- [ ] Words highlight during playback
- [ ] Highlighting syncs with audio

## Quick Test Script

Run this in the browser console while on a book page:

```javascript
// Test word highlighting
const testHighlighting = async () => {
    console.log('🧪 Testing word highlighting...');
    
    // 1. Check if we have text boxes
    const textBoxes = document.querySelectorAll('[class*="textBox"]');
    console.log('📝 Text boxes found:', textBoxes.length);
    
    // 2. Check WebSocket connection
    const ws = new WebSocket('ws://localhost:5001/api/tts/ws');
    ws.onopen = () => {
        console.log('✅ WebSocket connected');
        ws.send(JSON.stringify({
            text: 'Hello world test',
            voiceId: '21m00Tcm4TlvDq8ikWAM'
        }));
    };
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('📨 Received:', data.type, data);
        
        if (data.type === 'alignment') {
            console.log('✅ Alignment received:', data.words.length, 'words');
        }
        
        if (data.type === 'complete') {
            console.log('✅ Audio URL:', data.audioUrl);
            console.log('✅ Final alignment:', data.alignment);
            ws.close();
        }
    };
    
    ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
    };
};

testHighlighting();
```

## Expected Console Output

When word highlighting works correctly, you should see:

```
📝 Received word alignment: { words: [...] }
📝 Words count: 15
🔍 Rendering check: { isActive: true, hasWordAlignment: true, wordsCount: 15, currentWordIndex: 0 }
🕐 Audio time: 0.00
📍 Word: "Once" [0.00s - 0.40s]
🕐 Audio time: 0.45
📍 Word: "upon" [0.40s - 0.80s]
...
```

## Files to Check

1. **Frontend:**
   - `pages/BookReaderPage.tsx` - Main reader component
   - `services/apiService.ts` - WebSocket communication (line 875-992)

2. **Backend:**
   - `backend/src/index.js` - WebSocket server (line 42-417)
   - `backend/src/routes/tts.js` - HTTP fallback endpoint
   - `backend/src/models/TTSCache.js` - Caching model

3. **Config:**
   - `backend/.env` - API keys and settings
   - `constants.ts` - API base URL

## Environment Variables

Required in `backend/.env`:
```
ELEVENLABS_API_KEY=your_key_here
MONGO_URI=mongodb+srv://...
PORT=5001
```

## Known Limitations

1. **Estimated Timing:** When ElevenLabs WebSocket fails, we fall back to HTTP which uses estimated timing (0.4s per word). This is less accurate than real alignment data.

2. **Character-to-Word Conversion:** The backend converts character-level timestamps to word-level. This may have slight inaccuracies at word boundaries.

3. **Punctuation:** Words with punctuation (e.g., "Hello,") are treated as single words, which may affect alignment.

## Next Steps for Improvement

1. **Use ElevenLabs WebSocket with alignment:** Ensure WebSocket connection succeeds to get real-time character-level alignment
2. **Better fallback timing:** Use audio duration to calculate more accurate word timings
3. **Visual feedback:** Add loading states and error messages for alignment issues
4. **Caching:** Cache alignment data with audio for faster subsequent playbacks
