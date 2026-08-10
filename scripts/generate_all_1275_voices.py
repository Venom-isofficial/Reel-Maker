import os
import sys
import time
import requests

# Force UTF-8 output
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try: sys.stdout.reconfigure(encoding="utf-8")
    except Exception: pass

text = (
    "Good morning. Here's your finance news update: global markets are trading cautiously today as investors monitor "
    "inflation data, interest-rate expectations, and corporate earnings. Stocks opened mixed, while the U.S. dollar "
    "strengthened and oil prices moved higher. Investors are now watching economic reports for signs of where markets "
    "could be headed next."
)

base_dir = os.path.abspath("scripts/models/ChatterboxTrainingAudioSamples")
# Filter for first 20 VoxCeleb celebrity profiles
dirs = sorted([d for d in os.listdir(base_dir) if os.path.isdir(os.path.join(base_dir, d)) and d.startswith("vox_")])[:20]

# Use the existing folder where profiles 1,2,3,4,5,8,9,10,11 are ALREADY generated!
out_dir = os.path.abspath("workspace/voxceleb_celebrity_finance_audios")
os.makedirs(out_dir, exist_ok=True)

total_count = len(dirs)
print(f"🌟 Starting Batch Audio Generation for FIRST {total_count} VoxCeleb Celebrity Profiles...")
print(f"📁 Output Directory: {out_dir}")
print("=" * 80)

completed_count = 0
failed_count = 0
skipped_count = 0

t_start = time.time()

for idx, folder_name in enumerate(dirs, 1):
    preset_key = folder_name
    out_file = os.path.join(out_dir, f"{idx:04d}_{folder_name}.mp3")

    # Skip if ALREADY completed!
    if os.path.exists(out_file) and os.path.getsize(out_file) > 1000:
        skipped_count += 1
        print(f"[{idx}/{total_count}] ⏩ Already Completed! Skipping {os.path.basename(out_file)}")
        continue

    t0 = time.time()
    try:
        res = requests.post(
            "http://127.0.0.1:8002/synthesize",
            json={
                "text": text,
                "output_path": out_file,
                "voice_preset": preset_key,
                "cfg_weight": 0.7,
                "exaggeration": 0.5,
                "speed": 1.15,
            },
            timeout=180,
        )
        elapsed = time.time() - t0

        if res.status_code == 200 and os.path.exists(out_file) and os.path.getsize(out_file) > 1000:
            completed_count += 1
            size_kb = os.path.getsize(out_file) / 1024
            print(f"[{idx}/{total_count}] ✅ [OK] {folder_name} -> {os.path.basename(out_file)} ({elapsed:.1f}s, {size_kb:.1f} KB)")
        else:
            failed_count += 1
            err_msg = res.text[:100] if res.text else f"Status {res.status_code}"
            print(f"[{idx}/{total_count}] ❌ [FAIL] {folder_name}: {err_msg}")
    except Exception as e:
        failed_count += 1
        print(f"[{idx}/{total_count}] ❌ [ERROR] {folder_name}: {e}")

total_elapsed = time.time() - t_start
print("=" * 80)
print(f"🎉 FIRST 20 VOXCELEB BATCH COMPLETE!")
print(f"✅ Generated New: {completed_count} | ⏩ Already Done: {skipped_count} | ❌ Failed: {failed_count} | ⏱️ Time: {total_elapsed / 60:.2f} mins")
