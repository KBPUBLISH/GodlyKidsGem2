import os
import torch
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
from TTS.api import TTS
import uvicorn
import io
import tempfile
import shutil

# Initialize FastAPI
app = FastAPI(title="GodlyKids Voice Cloning Service")

# Global model variable
tts_model = None

@app.on_event("startup")
async def startup_event():
    global tts_model
    print("⏳ Loading Coqui XTTS v2 model... This may take a while on first run.")
    
    # Check for GPU (CUDA or MPS for Mac)
    device = "cpu"
    if torch.cuda.is_available():
        device = "cuda"
    elif torch.backends.mps.is_available():
        device = "mps"
    
    print(f"🚀 Using device: {device}")
    
    try:
        # Initialize TTS with XTTS v2 model
        # This will download the model if not present
        tts_model = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
        print("✅ Model loaded successfully!")
    except Exception as e:
        print(f"❌ Failed to load model: {e}")
        # Fallback or exit? For now we'll just print error
        pass

@app.get("/")
def read_root():
    return {"status": "online", "model_loaded": tts_model is not None}

@app.post("/generate")
async def generate_speech(
    text: str = Form(...),
    language: str = Form("en"),
    speaker_wav: UploadFile = File(...)
):
    if not tts_model:
        raise HTTPException(status_code=503, detail="TTS Model is not loaded")

    try:
        # Save uploaded speaker wav to a temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_wav:
            shutil.copyfileobj(speaker_wav.file, temp_wav)
            temp_wav_path = temp_wav.name

        # Generate audio
        # XTTS output is usually a wav file path or we can stream
        # For simplicity, we'll save to a temp file and stream it back
        output_path = temp_wav_path.replace(".wav", "_output.wav")
        
        tts_model.tts_to_file(
            text=text,
            speaker_wav=temp_wav_path,
            language=language,
            file_path=output_path
        )

        # Read the generated file into memory
        with open(output_path, "rb") as f:
            audio_data = io.BytesIO(f.read())
        
        # Cleanup temp files
        os.remove(temp_wav_path)
        os.remove(output_path)
        
        return StreamingResponse(audio_data, media_type="audio/wav")

    except Exception as e:
        print(f"❌ Generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
