# 🎬 Reel Maker — Local AI Video Factory

An end-to-end local-first AI Video Reel creation pipeline powered by React/Vite, Express, Remotion, and Resemble AI Chatterbox 500M / Kokoro TTS.

---

## 🚀 How to Run the Project

Simply run the one-shot launcher script:

```bash
python start.py
```

### What `python start.py` does automatically:
1. **Frees stuck ports** (3001, 3005, 8002) if previous instances were left running.
2. **Starts Express Backend API** on `http://localhost:3001`
3. **Starts React/Vite Frontend UI** on `http://localhost:3005`
4. **Starts Chatterbox 500M TTS Server** on `http://127.0.0.1:8002`
5. **Monitors health status** and automatically opens `http://localhost:3005` in your web browser!

---

## 🔌 Plug & Play Configurable Architecture (`start.py`)

`start.py` is fully configurable. If you integrate new AI models or services in the future (e.g. Wan2GP Video Generation, Local Whisper API), simply add them to the `SERVICES` list in `start.py`:

```python
SERVICES = [
    { "name": "Backend Express API", "cmd": "npm run dev:backend", "port": 3001, "enabled": True },
    { "name": "Frontend Vite UI",    "cmd": "npm run dev:frontend", "port": 3005, "enabled": True },
    { "name": "Chatterbox 500M TTS", "cmd": "python scripts/chatterbox_server.py --port 8002", "port": 8002, "enabled": True },
    # Add new services below:
    # { "name": "Wan2GP Video AI",   "cmd": "python scripts/wan2gp_server.py --port 7860", "port": 7860, "enabled": True },
]
```
