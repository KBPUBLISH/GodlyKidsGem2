# Python AI Service Setup Guide

## Step-by-Step Setup

### 1. Navigate to the ai-service directory
```bash
cd /Users/midhealbouchard/GodlyKidsGem2/ai-service
```

### 2. Create a Python virtual environment (recommended)
```bash
python3 -m venv venv
```

### 3. Activate the virtual environment
```bash
source venv/bin/activate
```

### 4. Upgrade pip (optional but recommended)
```bash
pip install --upgrade pip
```

### 5. Install dependencies
```bash
pip install -r requirements.txt
```

**Note:** This will take a while as it downloads:
- PyTorch (~2GB)
- Coqui TTS library
- XTTS v2 model (~2GB, downloaded on first run)

### 6. Start the service
```bash
python main.py
```

Or using uvicorn directly:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 7. Verify it's running
Open another terminal and test:
```bash
curl http://localhost:8000/
```

You should see: `{"status":"online","model_loaded":true}`

## Troubleshooting

### If you get "command not found: python3"
Try:
```bash
python -m venv venv
source venv/bin/activate
```

### If you get permission errors
You might need to use `pip3` instead of `pip`:
```bash
pip3 install -r requirements.txt
```

### If the model fails to load
- Check that you have enough disk space (~5GB free)
- Check your internet connection (model downloads on first run)
- On Mac, ensure you have Xcode Command Line Tools: `xcode-select --install`

## Stopping the Service
Press `Ctrl+C` in the terminal where it's running.

## Deactivating Virtual Environment
When done, you can deactivate:
```bash
deactivate
```


