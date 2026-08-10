import os
import sys
import csv
import time
import requests

# Force UTF-8 encoding
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try: sys.stdout.reconfigure(encoding="utf-8")
    except Exception: pass

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
META_PATH = os.path.join(PROJECT_ROOT, "scripts", "models", "vox1_meta.csv")
SAMPLES_BASE = os.path.join(PROJECT_ROOT, "scripts", "models", "ChatterboxTrainingAudioSamples")
OUT_DIR = os.path.join(PROJECT_ROOT, "workspace", "top50_british_celebrity_audios")

os.makedirs(OUT_DIR, exist_ok=True)

text = (
    "Good morning. Here's your finance news update: global markets are trading cautiously today as investors monitor "
    "inflation data, interest-rate expectations, and corporate earnings. Stocks opened mixed, while the U.S. dollar "
    "strengthened and oil prices moved higher. Investors are now watching economic reports for signs of where markets "
    "could be headed next."
)

# Step 1: Parse metadata CSV to identify UK celebrities
meta_map = {}
with open(META_PATH, "r", encoding="utf-8", errors="ignore") as f:
    reader = csv.reader(f, delimiter="\t")
    for row in reader:
        if len(row) >= 4 and row[0].startswith("id"):
            v_id = row[0].strip()
            name = row[1].strip()
            gender = "female" if row[2].strip() == "f" else "male"
            nat = row[3].strip().upper()
            if nat in ["UK", "UK "]:
                clean_name = name.replace(" ", "_").replace(".", "_")
                folder_name = f"vox_{clean_name}_{gender}"
                meta_map[folder_name] = {
                    "v_id": v_id,
                    "name": name,
                    "gender": gender,
                    "clean_name": clean_name
                }

print(f"📊 Loaded {len(meta_map)} British celebrity identity mappings from metadata.")

# Step 2: Match available directories in Chatterbox training samples
available_dirs = [d for d in os.listdir(SAMPLES_BASE) if d in meta_map]
# Sort by VoxCeleb official ID order
available_dirs.sort(key=lambda d: meta_map[d]["v_id"])

# Select Top 50 British Celebrities
top50_british = available_dirs[:50]

print(f"🇬🇧 Selected TOP 50 British Ranked Celebrity Voices for Batch Synthesis:")
print("=" * 80)

completed_count = 0
failed_count = 0
skipped_count = 0

t_start = time.time()

for idx, folder_name in enumerate(top50_british, 1):
    info = meta_map[folder_name]
    # Naming format: <official_orderno>_vox_<name>_<gender>.mp3
    out_filename = f"{idx:04d}_vox_{info['clean_name']}_{info['gender']}.mp3"
    out_file = os.path.join(OUT_DIR, out_filename)

    # Skip if already generated cleanly
    if os.path.exists(out_file) and os.path.getsize(out_file) > 1000:
        skipped_count += 1
        size_kb = os.path.getsize(out_file) / 1024
        print(f"[{idx:02d}/50] ⏩ Skipped (already generated): {out_filename} ({size_kb:.1f} KB)")
        continue

    t0 = time.time()
    success = False
    for attempt in range(1, 4):
        try:
            res = requests.post(
                "http://127.0.0.1:8002/synthesize",
                json={
                    "text": text,
                    "output_path": out_file,
                    "voice_preset": folder_name,
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
                print(f"[{idx:02d}/50] ✅ [OK] {info['name']} ({info['gender'].capitalize()}) -> {out_filename} ({elapsed:.1f}s, {size_kb:.1f} KB)")
                success = True
                break
            else:
                if attempt < 3:
                    time.sleep(3)
                else:
                    failed_count += 1
                    err_msg = res.text[:100] if res.text else f"Status {res.status_code}"
                    print(f"[{idx:02d}/50] ❌ [FAIL] {info['name']}: {err_msg}")
        except Exception as e:
            if attempt < 3:
                time.sleep(3)
            else:
                failed_count += 1
                print(f"[{idx:02d}/50] ❌ [ERROR] {info['name']}: {e}")

total_elapsed = time.time() - t_start
print("=" * 80)
print(f"🎉 TOP 50 BRITISH CELEBRITY BATCH SYNTHESIS COMPLETE!")
print(f"✅ Generated: {completed_count} | ⏩ Skipped: {skipped_count} | ❌ Failed: {failed_count} | ⏱️ Total Time: {total_elapsed / 60:.2f} mins")
print(f"📁 Audio Files Saved to: {OUT_DIR}")
