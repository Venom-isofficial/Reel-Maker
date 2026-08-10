import os
import sys
import csv
import glob
import subprocess
import zipfile
import shutil
import time

# Force UTF-8 stdout
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try: sys.stdout.reconfigure(encoding="utf-8")
    except Exception: pass

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
VOX2_DIR = os.path.join(PROJECT_ROOT, "scripts", "models")
META_PATH = os.path.join(VOX2_DIR, "vox2_meta.csv")
OUT_SAMPLES_DIR = os.path.join(VOX2_DIR, "ChatterboxVox2Samples")
TEMP_EXTRACT_DIR = os.path.join(VOX2_DIR, "temp_extracted")

os.makedirs(OUT_SAMPLES_DIR, exist_ok=True)
os.makedirs(TEMP_EXTRACT_DIR, exist_ok=True)

print("=" * 80)
print("📦 Starting VoxCeleb2 Smart Reference Audio Extraction")
print(f"📁 Source: {VOX2_DIR}")
print(f"📁 Destination: {OUT_SAMPLES_DIR}")
print("=" * 80)

# Step 1: Parse vox2_meta.csv
meta_map = {}
if os.path.exists(META_PATH):
    with open(META_PATH, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) >= 3 and row[0].strip().startswith("id"):
                v_id = row[0].strip()
                name = row[1].strip()
                gender = "female" if row[2].strip().lower() == "f" else "male"
                clean_name = name.replace(" ", "_").replace(".", "_")
                meta_map[v_id] = {
                    "v_id": v_id,
                    "name": name,
                    "clean_name": clean_name,
                    "gender": gender,
                    "folder": f"vox_{clean_name}_{gender}"
                }
    print(f"📊 Loaded {len(meta_map)} celebrity identity mappings from vox2_meta.csv.")

# Step 2: Check multi-part zip volumes and test zip
zip_files = []
if os.path.exists(os.path.join(VOX2_DIR, "vox2_test_aac.zip")):
    zip_files.append(os.path.join(VOX2_DIR, "vox2_test_aac.zip"))

# Check if multi-part zip dev files exist
dev_parts = sorted(glob.glob(os.path.join(VOX2_DIR, "vox2_dev_aac_part*")))
combined_zip = os.path.join(VOX2_DIR, "vox2_dev_aac.zip")

if dev_parts and not os.path.exists(combined_zip):
    print(f"🧩 Concatenating {len(dev_parts)} multi-part dev archive files into vox2_dev_aac.zip...")
    t0 = time.time()
    with open(combined_zip, "wb") as outfile:
        for part in dev_parts:
            print(f"   Appending {os.path.basename(part)}...")
            with open(part, "rb") as infile:
                shutil.copyfileobj(infile, outfile)
    print(f"✅ Combined dev zip ready! ({os.path.getsize(combined_zip)/(1024**3):.2f} GB in {time.time()-t0:.1f}s)")

if os.path.exists(combined_zip):
    zip_files.append(combined_zip)

# Step 3: Iterate through zip files and extract 1 clean reference clip per celebrity
extracted_count = 0
skipped_count = 0

for zip_path in zip_files:
    print(f"\n📂 Processing archive: {os.path.basename(zip_path)}...")
    try:
        with zipfile.ZipFile(zip_path, 'r') as zf:
            namelist = zf.namelist()
            # Map celebrity folder IDs inside zip
            speaker_files = {}
            for item in namelist:
                parts = item.split('/')
                # Structure: dev/aac/id00012/10001/00001.m4a or aac/id00012/...
                for p in parts:
                    if p.startswith('id') and len(p) >= 7:
                        speaker_id = p
                        if speaker_id not in speaker_files:
                            speaker_files[speaker_id] = []
                        if item.endswith('.m4a') or item.endswith('.aac') or item.endswith('.wav'):
                            speaker_files[speaker_id].append(item)
                        break

            print(f"   Found {len(speaker_files)} unique celebrity speaker IDs in {os.path.basename(zip_path)}.")

            for speaker_id, files in speaker_files.items():
                if not files:
                    continue

                info = meta_map.get(speaker_id, {
                    "v_id": speaker_id,
                    "name": speaker_id,
                    "clean_name": speaker_id,
                    "gender": "male",
                    "folder": f"vox_{speaker_id}_male"
                })

                target_folder = os.path.join(OUT_SAMPLES_DIR, info["folder"])
                ref_wav = os.path.join(target_folder, "reference.wav")

                if os.path.exists(ref_wav) and os.path.getsize(ref_wav) > 10000:
                    skipped_count += 1
                    continue

                os.makedirs(target_folder, exist_ok=True)

                # Select best audio file (prefer second or third file for cleaner clip)
                chosen_file = files[min(1, len(files)-1)]
                temp_audio = os.path.join(TEMP_EXTRACT_DIR, os.path.basename(chosen_file))

                # Extract chosen audio file
                zf.extract(chosen_file, TEMP_EXTRACT_DIR)
                extracted_path = os.path.join(TEMP_EXTRACT_DIR, chosen_file)

                # Convert to 24kHz mono WAV with loudness normalization (-3dB) & high-pass 80Hz filter
                ffmpeg_cmd = [
                    "ffmpeg", "-y", "-i", extracted_path,
                    "-af", "highpass=f=80,loudnorm=I=-16:TP=-3:LRA=11",
                    "-ac", "1", "-ar", "24000",
                    "-t", "10", # Limit reference clip to optimal 10 seconds
                    ref_wav
                ]
                subprocess.run(ffmpeg_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

                if os.path.exists(ref_wav) and os.path.getsize(ref_wav) > 10000:
                    extracted_count += 1
                    print(f"   ✅ Extracted: {info['folder']} -> reference.wav ({os.path.getsize(ref_wav)/1024:.1f} KB)")

                # Cleanup temp file
                try:
                    if os.path.exists(extracted_path): os.remove(extracted_path)
                except: pass

    except Exception as e:
        print(f"❌ Error processing zip {zip_path}: {e}")

# Cleanup temp dir
try: shutil.rmtree(TEMP_EXTRACT_DIR, ignore_errors=True)
except: pass

print("\n" + "=" * 80)
print(f"🎉 VOXCELEB2 REFERENCE AUDIO EXTRACTION COMPLETE!")
print(f"✅ Newly Extracted: {extracted_count} | ⏩ Skipped Existing: {skipped_count}")
print(f"📁 Extracted Samples Location: {OUT_SAMPLES_DIR}")
print("=" * 80)
