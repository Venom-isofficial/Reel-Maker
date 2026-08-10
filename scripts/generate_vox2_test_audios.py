import os
import sys
import time
import requests

# Force UTF-8 stdout
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try: sys.stdout.reconfigure(encoding="utf-8")
    except Exception: pass

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT_DIR = os.path.join(PROJECT_ROOT, "workspace", "vox2_celebrity_test_audios")
os.makedirs(OUT_DIR, exist_ok=True)

TEXT = """The Phuket–Delhi flight that experienced a “momentary loss in altitude” on August 4, injuring 17 people on board, was preceded by a cascade of failures involving the aircraft’s hydraulic and flight-control systems, according to multiple sources familiar with the matter, contradicting the airline’s initial attribution of the incident to turbulence.

Nearly 2.5 hours after taking off from Phuket at 6.56 a.m., Air India flight AI 2379 operated on Airbus A320 neo was hit by a cascade of technical failures at 9.32 a.m. IST, involving the aircraft’s hydraulic and flight-control systems."""

CELEBRITIES = [
    {"name": "Tom Hardy",       "id": "id08608 / n008608", "preset": "vox_n008608_male",   "filename": "01_Tom_Hardy.mp3"},
    {"name": "Anthony Hopkins", "id": "id00692 / n000692", "preset": "vox_n000692_male",   "filename": "02_Anthony_Hopkins.mp3"},
    {"name": "Ian McKellen",    "id": "id03524 / n003524", "preset": "vox_n003524_male",   "filename": "03_Ian_McKellen.mp3"},
    {"name": "Gary Oldman",     "id": "id02978 / n002978", "preset": "vox_n002978_male",   "filename": "04_Gary_Oldman.mp3"},
    {"name": "Nigella Lawson",  "id": "id06540 / n006540", "preset": "vox_n006540_female", "filename": "05_Nigella_Lawson.mp3"},
]

print("=" * 80)
print("🎙️ Generating High-Fidelity Test Audios for 5 Top VoxCeleb2 British Celebrities")
print(f"📁 Output Directory: {OUT_DIR}")
print("=" * 80)

success_count = 0
for idx, celeb in enumerate(CELEBRITIES, 1):
    out_file = os.path.join(OUT_DIR, celeb["filename"])
    print(f"\n[{idx}/5] Generating voice for {celeb['name']} ({celeb['id']})...")
    
    payload = {
        "text": TEXT,
        "voice_preset": celeb["preset"],
        "speed": 1.15,
        "exaggeration": 0.45,
        "cfg_weight": 0.70,
        "output_path": out_file
    }

    t0 = time.time()
    try:
        res = requests.post("http://127.0.0.1:8002/synthesize", json=payload, timeout=120)
        dur = time.time() - t0
        if res.status_code == 200 and os.path.exists(out_file) and os.path.getsize(out_file) > 1000:
            size_kb = os.path.getsize(out_file) / 1024
            print(f"   ✅ Success! {celeb['name']} generated in {dur:.2f}s ({size_kb:.1f} KB)")
            print(f"   🔊 Path: {out_file}")
            success_count += 1
        else:
            print(f"   ❌ Failed for {celeb['name']}: Status {res.status_code} - {res.text[:200]}")
    except Exception as e:
        print(f"   ❌ Error generating for {celeb['name']}: {e}")

print("\n" + "=" * 80)
print(f"🎉 GENERATION COMPLETE! ({success_count}/5 Celebrities Generated)")
print(f"📁 Audio Files Location: {OUT_DIR}")
print("=" * 80)
