---
description: Start the Local AI Voice Service
---
To run the local voice cloning service, follow these steps:

1.  **Navigate to the AI Service directory**:
    ```bash
    cd ai-service
    ```

2.  **Create a virtual environment (recommended)**:
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```

3.  **Install Dependencies**:
    ```bash
    pip install -r requirements.txt
    ```
    *Note: On Mac with Apple Silicon (M1/M2/M3), you might need to install PyTorch with MPS support manually if the standard install doesn't pick it up:*
    ```bash
    pip install --pre torch torchaudio --index-url https://download.pytorch.org/whl/nightly/cpu
    ```

4.  **Accept Coqui TTS License**:
    The first time you run it, you might be asked to agree to the Coqui Public Model License.
    Set the environment variable to auto-agree:
    ```bash
    export COQUI_TOS_AGREED=1
    ```

5.  **Start the Server**:
    ```bash
    python3 main.py
    ```

The service will start on `http://localhost:8000`. The first run will download the XTTS v2 model (~2GB), so be patient!
