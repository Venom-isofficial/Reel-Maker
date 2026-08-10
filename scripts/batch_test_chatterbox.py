import os
import time
import requests

text = (
    "Northwest Natural Holding reported stronger second-quarter results and raised its full-year 2026 earnings guidance "
    "to the upper half of its $2.95 to $3.15 range. Improved first-half earnings, regulatory developments, and progress on "
    "its MX3 gas-storage expansion are supporting the outlook. The company is also projecting significant revenue and earnings "
    "growth through 2029, with an estimated fair value of $57.50, suggesting 14% upside. But with decarbonization and electrification "
    "threatening long-term gas demand, one question remains: can Northwest Natural grow fast enough to overcome the energy transition?"
)

presets = [
    "default",
    "libri_3240",
    "libri_1272",
    "libri_8419",
    "libri_1993",
    "newsroom_anchor",
]

out_dir = os.path.abspath("workspace/test_chatterbox_takes")
os.makedirs(out_dir, exist_ok=True)

print(f"Batch synthesizing {len(presets)} Chatterbox voice profiles...")

for p in presets:
    out_file = os.path.join(out_dir, f"{p}.mp3")
    t0 = time.time()
    try:
        res = requests.post(
            "http://127.0.0.1:8002/synthesize",
            json={
                "text": text,
                "output_path": out_file,
                "voice_preset": p,
                "cfg_weight": 0.7,
                "exaggeration": 0.5,
                "speed": 1.15,
            },
            timeout=180,
        )
        elapsed = time.time() - t0
        if res.status_code == 200:
            size_kb = os.path.getsize(out_file) / 1024
            print(f"[OK] {p}: Generated in {elapsed:.1f}s ({size_kb:.1f} KB)")
        else:
            print(f"[FAIL] {p}: Error {res.status_code} - {res.text}")
    except Exception as e:
        print(f"[ERROR] {p}: Exception - {e}")
