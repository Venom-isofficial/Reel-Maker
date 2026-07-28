# Official Resemble AI Chatterbox 500M Setup & Documentation Guide 🎙️⚡

This repository integrates the official **Resemble AI Chatterbox 500M English Zero-Shot TTS Model** running **100% locally** via PyTorch, CUDA GPU acceleration, and a persistent local Python model server.

---

## 🏗️ Architecture & How It Works

```
┌─────────────────────────────┐        ┌─────────────────────────────┐        ┌─────────────────────────────┐
│  Frontend Studio UI         │        │  Node.js Backend            │        │  Local Python Model Server  │
│  http://localhost:3005      │ ────►  │  http://localhost:3001      │ ────►  │  http://127.0.0.1:8002    │
│  (Step 3 Voice Controls)    │        │  (VoiceService.ts)          │        │  (chatterbox_server.py)     │
└─────────────────────────────┘        └─────────────────────────────┘        └─────────────────────────────┘
                                                                                             │
                                                                                    ┌────────▼────────┐
                                                                                    │ PyTorch 500M    │
                                                                                    │ CUDA GPU Engine │
                                                                                    └─────────────────┘
```

1. **Zero External API Calls**: Does NOT communicate with Microsoft, Azure, Edge TTS, Google, or any online TTS service.
2. **Persistent In-Memory Model Server**: Model weights (`resemble-ai/chatterbox-500m-en`) are loaded **ONCE** into GPU VRAM / System RAM during startup by `scripts/chatterbox_server.py`.
3. **Instant Synthesis Endpoint**: Node.js backend (`VoiceService.ts`) calls `POST http://127.0.0.1:8002/synthesize` for instant zero-shot voice generation without per-request model loading overhead.

---

## 📋 System Requirements

- **Python**: 3.10+ (Python 3.11 / 3.12 / 3.13 supported)
- **PyTorch**: 2.0+ (`torch`, `torchaudio`, `torchvision`)
- **GPU (Recommended)**: NVIDIA GPU with CUDA support (e.g. NVIDIA RTX 4050 / 4060 / 3060+ with 4GB+ VRAM).
- **CPU (Fallback)**: 16GB+ System RAM.
- **Disk Storage**: ~1.5 GB for model weights (`~500 MB` model weights + dependencies).

---

## 🛠️ Step-by-Step Installation

### Step 1: Install Python & PyTorch with CUDA Support
Ensure Python 3.10+ is installed. To enable NVIDIA GPU acceleration:
```bash
pip install torch torchaudio torchvision --index-url https://download.pytorch.org/whl/cu121
```

### Step 2: Install Official Resemble AI Chatterbox Package
Install the official `chatterbox-tts` package:
```bash
pip install chatterbox-tts fastapi uvicorn pydub librosa
```

### Step 3: Run Environment Verification & Cache Model Weights
Execute the verification script to pre-download model weights and verify GPU detection:
```bash
python scripts/setup_chatterbox.py
```

---

## 🚀 Running the Persistent Chatterbox Model Server

Start the persistent Python model server on port `8002`:
```bash
python scripts/chatterbox_server.py --port 8002
```

- **Health Check Endpoint**: `GET http://127.0.0.1:8002/health`
- **Synthesis Endpoint**: `POST http://127.0.0.1:8002/synthesize`

*Note: If the server is not already running, `VoiceService.ts` automatically spawns `scripts/chatterbox_server.py` on demand.*

---

## ⚙️ Parameters & Creative Tuning Controls

- **CFG Weight (Classifier-Free Guidance)**: Range `0.5` – `3.0` (Default `1.0`). Controls prompt text adherence and clarity.
- **Exaggeration**: Range `0.0` – `2.0` (Default `1.0`). Controls vocal emotion and expressiveness.
- **Speaking Speed**: Range `0.80x` – `1.50x` (Default `1.15x`). Scales speech tempo while maintaining natural pitch.

---

## 🔧 Troubleshooting

| Symptom | Root Cause | Solution |
|---|---|---|
| `torchvision::nms does not exist` | Version mismatch between `torch` and `torchvision` | Run `pip install torchvision==0.21.0` |
| `Port 8002 in use` | Server already active in background | Server is ready; no action required |
| `Using CPU Inference` | CUDA not detected in Python | Reinstall PyTorch CUDA wheel via `pip install torch --index-url https://download.pytorch.org/whl/cu121` |
