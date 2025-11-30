# Implementation Plan: Custom Voice Cloning System (XTTS v2)

## Objective
Create a self-hosted voice cloning system that allows users to record a ~30-second sample and use it to generate Text-to-Speech (TTS) for reading books, replacing the need for ElevenLabs.

## Technology Stack
- **AI Model**: [Coqui XTTS v2](https://huggingface.co/coqui/XTTS-v2) (State-of-the-art open voice cloning).
- **AI Service**: Python + FastAPI (to host the model).
- **Backend**: Existing Node.js server (to manage files/requests).
- **Frontend**: React + MediaRecorder API (for recording).

---

## Phase 1: Python AI Service Setup
Since AI models require Python/PyTorch, we need a separate microservice.

1.  **Create Directory**: `ai-service/` in the project root.
2.  **Dependencies**: `requirements.txt`
    ```text
    fastapi
    uvicorn
    torch
    tts  # Coqui TTS
    pydub
    python-multipart
    ```
3.  **API Server**: Create `main.py` with FastAPI.
    -   **Endpoint**: `POST /generate`
        -   Input: `{ text: string, speaker_wav_path: string, language: string }`
        -   Action: Loads XTTS model, runs inference using `speaker_wav_path` as the voice clone reference.
        -   Output: Audio stream (wav/mp3).

## Phase 2: Frontend Voice Recorder
Add a UI for the user to create their voice clone.

1.  **New Component**: `VoiceRecorder.tsx`
    -   Visualizer for microphone input.
    -   "Record" / "Stop" / "Play Preview" buttons.
    -   "Save Voice" button.
2.  **Logic**:
    -   Record ~30s of reading a sample text (e.g., "The quick brown fox...").
    -   Convert to `Blob` (WAV format preferred).
    -   Upload to Backend via `FormData`.

## Phase 3: Backend Integration
Update the existing Node.js backend to handle the voice files and proxy requests to the Python service.

1.  **Upload Endpoint**: `POST /api/voice/upload`
    -   Saves the uploaded WAV file to `uploads/voices/{userId}_reference.wav`.
2.  **TTS Proxy**: Update the existing TTS route.
    -   If `voiceId` == 'custom_user_voice', skip ElevenLabs.
    -   Instead, send request to `http://localhost:8000/generate` (Python Service).
    -   Pass the path to the stored `{userId}_reference.wav`.
    -   Stream the response back to the frontend.

## Phase 4: Hardware Optimization (Mac)
Since you are on a Mac:
-   Ensure PyTorch uses `mps` (Metal Performance Shaders) for GPU acceleration.
-   XTTS v2 is reasonably fast on M1/M2/M3 chips but may have a slight delay (1-3s) before playback starts compared to cloud APIs.

## Risks & Mitigations
-   **Latency**: Local inference is slower than cloud.
    -   *Mitigation*: Implement streaming response so audio plays as it generates.
-   **Model Size**: XTTS v2 is ~2GB.
    -   *Mitigation*: Download once and cache it.
-   **Quality**: Background noise in the 30s recording ruins the clone.
    -   *Mitigation*: Add a simple noise reduction step (using `pydub` or `noisereduce`) in the Python service before processing.

---

## Step-by-Step Execution

### Step 1: Create Python Service
- [ ] Create `ai-service` folder.
- [ ] Install dependencies.
- [ ] Write `server.py` to load XTTS and serve requests.

### Step 2: Backend File Handling
- [ ] Add route to save uploaded voice recordings.

### Step 3: Frontend UI
- [ ] Build `VoiceRecorder` modal.
- [ ] Add "Use My Voice" option in the book reader settings.

### Step 4: Connection
- [ ] Wire up the Book Reader to call the local Python service when "My Voice" is selected.
