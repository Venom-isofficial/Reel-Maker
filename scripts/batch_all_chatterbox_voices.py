import os
import time
import requests

text = (
    "Northwest Natural Holding reported stronger second-quarter results and raised its full-year 2026 earnings guidance. "
    "The company is projecting significant revenue and earnings growth through 2029 with an estimated fair value of $57.50."
)

base = "scripts/models/ChatterboxTrainingAudioSamples"
dirs = [d for d in os.listdir(base) if os.path.isdir(os.path.join(base, d))]

# Map folder names to preset keys
presets = []
for d in dirs:
    if d == "1":
        presets.append("custom1")
    elif d == "2":
        presets.append("custom2")
    else:
        presets.append(d)

out_dir = os.path.abspath("workspace/all_chatterbox_test_audios")
os.makedirs(out_dir, exist_ok=True)

print(f"Starting batch synthesis for ALL {len(presets)} Chatterbox & LibriSpeech voice profiles...")

success_count = 0
for idx, p in enumerate(presets, 1):
    out_file = os.path.join(out_dir, f"{idx:02d}_{p}.mp3")
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
        if res.status_code == 200 and os.path.exists(out_file) and os.path.getsize(out_file) > 1000:
            size_kb = os.path.getsize(out_file) / 1024
            success_count += 1
            print(f"[{idx}/{len(presets)}] [OK] {p} -> {os.path.basename(out_file)} ({elapsed:.1f}s, {size_kb:.1f} KB)")
        else:
            print(f"[{idx}/{len(presets)}] [FAIL] {p}: Status {res.status_code} - {res.text}")
    except Exception as e:
        print(f"[{idx}/{len(presets)}] [ERROR] {p}: Exception - {e}")

print(f"\nFINISHED! Successfully generated {success_count}/{len(presets)} voice audio files in '{out_dir}'.")
