import os
import sys
import time
import argparse
import tempfile
import subprocess
from pathlib import Path

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Organize all model weights strictly inside the project directory
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PROJECT_MODELS_DIR = os.path.join(PROJECT_ROOT, "scripts", "models")
os.makedirs(PROJECT_MODELS_DIR, exist_ok=True)
os.environ["HF_HOME"] = os.path.join(PROJECT_MODELS_DIR, "huggingface")
os.environ["TRANSFORMERS_CACHE"] = os.path.join(PROJECT_MODELS_DIR, "huggingface")

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
import torch
import threading
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Starting background model loader for Resemble AI Chatterbox 500M...")
    threading.Thread(target=load_chatterbox_model, daemon=True).start()
    yield

app = FastAPI(title="Resemble AI Chatterbox 500M Local TTS Server", version="1.0.0", lifespan=lifespan)

# Global Chatterbox Model State
model_instance = None
device_name = "cpu"

class SynthesizeRequest(BaseModel):
    text: str
    output_path: str
    voice_preset: str = "default"
    cfg_weight: float = 0.7
    exaggeration: float = 0.5
    speed: float = 1.0
    temperature: float = 0.8
    repetition_penalty: float = 1.2
    top_p: float = 1.0
    min_p: float = 0.05

def load_chatterbox_model():
    global model_instance, device_name
    print("Loading Resemble AI Chatterbox 500M English Model into VRAM/RAM...")
    
    if torch.cuda.is_available():
        device_name = "cuda"
        print(f"GPU Acceleration Enabled: {torch.cuda.get_device_name(0)}")
    else:
        device_name = "cpu"
        print("Using CPU Inference")

    try:
        from chatterbox import ChatterboxTTS
        model_instance = ChatterboxTTS.from_pretrained(device_name)
        print(f"SUCCESS: Official Resemble AI Chatterbox 500M Model Loaded Successfully on {device_name.upper()}!")
    except Exception as e:
        print(f"Exception loading Chatterbox via ChatterboxTTS: {e}")
        try:
            import chatterbox
            if hasattr(chatterbox, "Chatterbox"):
                model_instance = chatterbox.Chatterbox.from_pretrained(device_name)
            else:
                from transformers import AutoModel
                model_instance = AutoModel.from_pretrained("resemble-ai/chatterbox-500m-en", trust_remote_code=True).to(device_name)
            print(f"SUCCESS: Chatterbox 500M Model Loaded on {device_name.upper()}!")
        except Exception as e2:
            print(f"Failed to load Chatterbox model: {e2}")
            model_instance = None

@app.get("/health")
def health_check():
    return {
        "status": "online",
        "model_loaded": model_instance is not None,
        "device": device_name,
        "engine": "Resemble AI Chatterbox 500M English"
    }

def resolve_audio_prompt(voice_preset: str) -> str | None:
    samples_base = os.path.abspath(os.path.join(os.path.dirname(__file__), "models", "ChatterboxTrainingAudioSamples"))
    candidates = [voice_preset]
    if voice_preset in ["default", "master"]:
        candidates.extend(["default", "master"])
    if voice_preset.startswith("custom"):
        raw_num = voice_preset.replace("custom", "")
        candidates.extend([raw_num, f"custom_{raw_num}", f"profile_{raw_num}"])
    
    for cand in candidates:
        if not cand:
            continue
        profile_dir = os.path.join(samples_base, cand)
        if os.path.isdir(profile_dir):
            ref_wav = os.path.join(profile_dir, "reference.wav")
            audio_files = [
                os.path.join(profile_dir, f) for f in os.listdir(profile_dir)
                if f.lower().endswith(('.mp3', '.wav', '.m4a', '.flac', '.ogg')) and f != "reference.wav"
            ]
            
            need_rebuild = not os.path.exists(ref_wav)
            if not need_rebuild and audio_files:
                ref_mtime = os.path.getmtime(ref_wav)
                if any(os.path.getmtime(af) > ref_mtime for af in audio_files):
                    need_rebuild = True

            if need_rebuild and audio_files:
                try:
                    print(f"🎙️ Rebuilding 10s normalized reference audio for '{cand}' from {len(audio_files)} sample files...")
                    first_audio = audio_files[0]
                    cmd = ["ffmpeg", "-y", "-i", first_audio, "-ss", "0", "-t", "10", "-af", "loudnorm", "-ar", "24000", "-ac", "1", ref_wav]
                    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                except Exception as e:
                    print(f"Warning: Could not build reference.wav for profile {cand}: {e}")
                    return audio_files[0]

            if os.path.exists(ref_wav):
                return ref_wav
            elif audio_files:
                return audio_files[0]
    return None

@app.post("/synthesize")
def synthesize(req: SynthesizeRequest):
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Text prompt cannot be empty.")
    
    # Wait for background model loading to complete
    start_wait = time.time()
    while model_instance is None and (time.time() - start_wait) < 120:
        time.sleep(1)

    if model_instance is None:
        raise HTTPException(status_code=500, detail="Chatterbox 500M model failed to load into memory within timeout.")

    try:
        audio_prompt = resolve_audio_prompt(req.voice_preset)
        if audio_prompt:
            print(f"🎙️ [VOICE CLONE] Preparing speaker embedding for '{req.voice_preset}' from: {audio_prompt}")
            try:
                model_instance.prepare_conditionals(audio_prompt, exaggeration=req.exaggeration)
            except Exception as cond_err:
                print(f"Warning: Failed to prepare conditionals directly: {cond_err}")
        else:
            print(f"⚠️ [VOICE WARNING] No custom reference audio found for preset '{req.voice_preset}', using default speaker embedding.")
        
        print(f"Synthesizing Chatterbox 500M Audio (Preset: {req.voice_preset}, CFG: {req.cfg_weight}, Exaggeration: {req.exaggeration}, Temp: {req.temperature}, RepPenalty: {req.repetition_penalty}, TopP: {req.top_p}, Speed: {req.speed}x)...")
        
        out_dir = Path(req.output_path).parent
        out_dir.mkdir(parents=True, exist_ok=True)
        
        temp_wav = out_dir / "temp_chatterbox.wav"

        # Prepare kwargs for inference
        gen_kwargs = {
            "text": req.text,
            "cfg_weight": req.cfg_weight,
            "exaggeration": req.exaggeration,
            "temperature": req.temperature,
            "repetition_penalty": req.repetition_penalty,
            "top_p": req.top_p,
            "min_p": req.min_p
        }
        if audio_prompt:
            gen_kwargs["audio_prompt_path"] = audio_prompt

        # Execute Chatterbox inference
        if hasattr(model_instance, "generate"):
            wav_bytes = model_instance.generate(**gen_kwargs)
        elif hasattr(model_instance, "tts"):
            wav_bytes = model_instance.tts(**gen_kwargs)
        else:
            wav_bytes = model_instance(req.text)

        # Handle tensor or array outputs
        import torchaudio
        if isinstance(wav_bytes, torch.Tensor):
            if wav_bytes.dim() == 1:
                wav_bytes = wav_bytes.unsqueeze(0)
            torchaudio.save(str(temp_wav), wav_bytes.cpu(), 24000)
        elif isinstance(wav_bytes, str) and os.path.exists(wav_bytes):
            temp_wav = Path(wav_bytes)

        # Process tempo/speed and convert to final MP3 via FFmpeg
        speed_filter = f"atempo={req.speed}" if req.speed != 1.0 else "anull"
        ffmpeg_cmd = [
            "ffmpeg", "-y", "-i", str(temp_wav),
            "-af", speed_filter,
            "-c:a", "libmp3lame", "-b:a", "192k",
            str(req.output_path)
        ]
        
        subprocess.run(ffmpeg_cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

        # Cleanup temp file
        if temp_wav.exists() and str(temp_wav) != str(req.output_path):
            try: os.remove(temp_wav)
            except: pass

        if os.path.exists(req.output_path) and os.path.getsize(req.output_path) > 1000:
            print(f"SUCCESS: Chatterbox 500M Local Audio generated: {req.output_path} ({os.path.getsize(req.output_path)} bytes)")
            return {
                "success": True,
                "audio_path": req.output_path,
                "size_bytes": os.path.getsize(req.output_path),
                "engine": "Resemble AI Chatterbox 500M"
            }
        else:
            raise Exception("Generated MP3 file is empty or missing.")

    except Exception as err:
        print(f"Error during Chatterbox inference: {err}")
        raise HTTPException(status_code=500, detail=str(err))

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8002)
    parser.add_argument("--host", type=str, default="127.0.0.1")
    args = parser.parse_args()
    
    print(f"Starting Resemble AI Chatterbox 500M Local Server on http://{args.host}:{args.port}")
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")
