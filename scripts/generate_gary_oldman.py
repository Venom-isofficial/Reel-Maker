import os
import sys
import requests

# Force UTF-8 stdout
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try: sys.stdout.reconfigure(encoding="utf-8")
    except Exception: pass

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT_FILE = os.path.join(PROJECT_ROOT, "workspace", "vox2_celebrity_test_audios", "04_Gary_Oldman.mp3")

TEXT = """The Phuket–Delhi flight that experienced a “momentary loss in altitude” on August 4, injuring 17 people on board, was preceded by a cascade of failures involving the aircraft’s hydraulic and flight-control systems, according to multiple sources familiar with the matter, contradicting the airline’s initial attribution of the incident to turbulence.

Nearly 2.5 hours after taking off from Phuket at 6.56 a.m., Air India flight AI 2379 operated on Airbus A320 neo was hit by a cascade of technical failures at 9.32 a.m. IST, involving the aircraft’s hydraulic and flight-control systems."""

payload = {
    "text": TEXT,
    "voice_preset": "vox_n002978_male",
    "speed": 1.15,
    "exaggeration": 0.45,
    "cfg_weight": 0.70,
    "output_path": OUT_FILE
}

print(f"🎙️ Generating voice clone for Gary Oldman -> {OUT_FILE}...")
res = requests.post("http://127.0.0.1:8002/synthesize", json=payload, timeout=300)
if res.status_code == 200 and os.path.exists(OUT_FILE):
    print(f"✅ Success! Gary Oldman audio saved ({os.path.getsize(OUT_FILE)/1024:.1f} KB)")
else:
    print(f"❌ Error: Status {res.status_code} - {res.text[:200]}")
