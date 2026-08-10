import os
import sys
import zipfile
import shutil
import time
import glob

# Force UTF-8 stdout
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try: sys.stdout.reconfigure(encoding="utf-8")
    except Exception: pass

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
VOX2_DIR = os.path.join(PROJECT_ROOT, "scripts", "models")
OUT_DIR = os.path.join(PROJECT_ROOT, "workspace", "Emma_Watson_Raw_Dataset")
os.makedirs(OUT_DIR, exist_ok=True)

print("=" * 80)
print("📦 Standalone Raw Dataset Extractor for Inspection")
print(f"📁 Target Output Folder: {OUT_DIR}")
print("=" * 80)

# Check all available zip files in VOX2_DIR
zip_files = []
if os.path.exists(os.path.join(VOX2_DIR, "vox2_test_aac.zip")):
    zip_files.append(os.path.join(VOX2_DIR, "vox2_test_aac.zip"))

combined_dev = os.path.join(VOX2_DIR, "vox2_dev_aac.zip")
if os.path.exists(combined_dev):
    zip_files.append(combined_dev)

dev_parts = sorted(glob.glob(os.path.join(VOX2_DIR, "vox2_dev_aac_part*")))
if dev_parts and not os.path.exists(combined_dev):
    zip_files.extend(dev_parts)

print(f"🔍 Found {len(zip_files)} archive file(s) to inspect.")

# Let's inspect speaker IDs and extract sample raw folder structure
target_ids = ["id00022", "id00024", "id00025"] # Female speaker sample IDs from vox2_meta.csv
extracted_files = []

for zip_path in zip_files:
    print(f"\n📂 Inspecting archive: {os.path.basename(zip_path)}...")
    try:
        with zipfile.ZipFile(zip_path, 'r') as zf:
            namelist = zf.namelist()
            matching = [f for f in namelist if any(tid in f for tid in target_ids) and (f.endswith('.m4a') or f.endswith('.aac') or f.endswith('.wav'))]
            print(f"   Found {len(matching)} raw audio files matching target speaker ID.")

            for m in matching[:50]: # Extract sample set keeping 100% original path & name
                zf.extract(m, OUT_DIR)
                extracted_files.append(os.path.join(OUT_DIR, m))

    except Exception as e:
        print(f"⚠️ Zip inspection error for {zip_path}: {e}")

print("\n" + "=" * 80)
print(f"🎉 EXTRACTION COMPLETE!")
print(f"📁 Raw Files Location: {OUT_DIR}")
print(f"📊 Total Raw Files Extracted: {len(extracted_files)}")
print("=" * 80)
