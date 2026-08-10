import os
import sys
import csv
import json
import requests

# Force UTF-8 stdout
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try: sys.stdout.reconfigure(encoding="utf-8")
    except Exception: pass

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
VOX2_DIR = os.path.join(PROJECT_ROOT, "scripts", "models")
IDENTITY_META_PATH = os.path.join(VOX2_DIR, "identity_meta.csv")
VOX2_META_PATH = os.path.join(VOX2_DIR, "vox2_meta.csv")
SAMPLES_BASE = os.path.join(VOX2_DIR, "ChatterboxVox2Samples")

VOX1_META = os.path.join(PROJECT_ROOT, "scripts", "models", "vox1_meta.csv")
INDEX_JSON_PATH = os.path.join(PROJECT_ROOT, "scripts", "models", "vox2_master_index.json")
MASTER_CSV_PATH = os.path.join(PROJECT_ROOT, "scripts", "models", "all_celebrities_master_mapping.csv")
WORKSPACE_CSV_PATH = os.path.join(PROJECT_ROOT, "workspace", "all_celebrities_master_mapping.csv")

print("=" * 80)
print("🌟 Updating VoxCeleb2 Celebrity Names & Master Mapping CSV")
print("=" * 80)

# Step 1: Download identity_meta.csv if not present
if not os.path.exists(IDENTITY_META_PATH):
    print("📥 Downloading VGGFace2 celebrity identity mapping file (identity_meta.csv)...")
    url = "https://huggingface.co/datasets/ProgramComputer/VGGFace2/resolve/main/meta/identity_meta.csv"
    res = requests.get(url, timeout=30)
    if res.status_code == 200:
        with open(IDENTITY_META_PATH, "w", encoding="utf-8") as f:
            f.write(res.text)
        print(f"✅ Downloaded identity_meta.csv ({os.path.getsize(IDENTITY_META_PATH)/1024:.1f} KB)")
    else:
        print(f"❌ Failed to download identity_meta.csv: Status {res.status_code}")

# Step 2: Parse identity_meta.csv (Class_ID -> Name)
vgg_name_map = {}
if os.path.exists(IDENTITY_META_PATH):
    with open(IDENTITY_META_PATH, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) >= 2 and row[0].strip().startswith("n00"):
                vgg_id = row[0].strip()
                raw_name = row[1].strip().strip('"').replace("_", " ")
                vgg_name_map[vgg_id] = raw_name

print(f"📊 Loaded {len(vgg_name_map)} celebrity identity names from VGGFace2 metadata.")

# Step 3: Parse vox2_meta.csv (VoxID -> VGGFace2 ID)
vox2_to_vgg = {}
if os.path.exists(VOX2_META_PATH):
    with open(VOX2_META_PATH, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) >= 3 and row[0].strip().startswith("id"):
                v_id = row[0].strip()
                vgg_id = row[1].strip()
                gender = "female" if row[2].strip().lower() == "f" else "male"
                celeb_name = vgg_name_map.get(vgg_id, f"Celebrity {v_id.replace('id', '')}")
                vox2_to_vgg[v_id] = {
                    "v_id": v_id,
                    "vgg_id": vgg_id,
                    "name": celeb_name,
                    "gender": gender
                }

# Step 4: Build vox2_master_index.json
vox2_voices_list = []
if os.path.exists(SAMPLES_BASE):
    dirs = [d for d in os.listdir(SAMPLES_BASE) if os.path.isdir(os.path.join(SAMPLES_BASE, d))]
    print(f"📁 Indexing {len(dirs)} VoxCeleb2 audio directories with real names...")

    for d in sorted(dirs):
        ref_file = os.path.join(SAMPLES_BASE, d, "reference.wav")
        if not os.path.exists(ref_file):
            continue

        # Extract VoxID from folder name (vox_n000012_male -> n000012 or id00012)
        parts = d.replace("vox_", "").split("_")
        gen_str = parts.pop() if parts else "male"
        id_part = "_".join(parts)

        # Match name via vgg_name_map
        celeb_name = vgg_name_map.get(id_part, id_part)
        gender_cap = "Female" if gen_str.lower() == "female" else "Male"
        icon = "👩" if gender_cap == "Female" else "🎙️"
        label = f"{icon} 🌟 {celeb_name} ({gender_cap} Celebrity - Vox2)"

        vox2_voices_list.append({
            "value": d,
            "label": label,
            "name": celeb_name,
            "gender": gender_cap,
            "ref_path": ref_file,
            "provider": "chatterbox_vox2"
        })

with open(INDEX_JSON_PATH, "w", encoding="utf-8") as f:
    json.dump(vox2_voices_list, f, indent=2, ensure_ascii=False)

print(f"✅ Updated vox2_master_index.json with {len(vox2_voices_list)} real celebrity names!")

# Step 5: Build Master CSV (all_celebrities_master_mapping.csv)
csv_rows = []
headers = ["Dataset", "Vox_ID", "VGGFace2_ID", "Celebrity_Name", "Gender", "Nationality_Country", "Audio_Preset_Folder", "Audio_Sample_Path"]

# Vox1 rows
if os.path.exists(VOX1_META):
    with open(VOX1_META, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.reader(f, delimiter="\t")
        for r in reader:
            if len(r) >= 4 and r[0].startswith("id"):
                v_id = r[0].strip()
                name = r[1].strip().replace("_", " ")
                clean_name = r[1].strip().replace(" ", "_").replace(".", "_")
                gender = "Female" if r[2].strip().lower() == "f" else "Male"
                country = r[3].strip().upper()
                preset_folder = f"vox_{clean_name}_{gender.lower()}"
                sample_path = os.path.join(PROJECT_ROOT, "scripts", "models", "ChatterboxTrainingAudioSamples", preset_folder, "reference.wav")

                csv_rows.append([
                    "VoxCeleb1", v_id, "N/A", name, gender, country, preset_folder, sample_path
                ])

# Vox2 rows
for item in vox2_voices_list:
    d = item["value"]
    parts = d.replace("vox_", "").split("_")
    gen_str = parts.pop() if parts else "male"
    vgg_id = "_".join(parts)

    csv_rows.append([
        "VoxCeleb2",
        "N/A",
        vgg_id,
        item["name"],
        item["gender"],
        "Global (Multi-National)",
        d,
        item["ref_path"]
    ])

for target_csv in [MASTER_CSV_PATH, WORKSPACE_CSV_PATH]:
    with open(target_csv, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(csv_rows)

print("=" * 80)
print(f"🎉 MASTER CSV & UI INDEX SUCCESSFULLY UPDATED WITH REAL CELEBRITY NAMES!")
print(f"📊 Total Mapped Celebrities: {len(csv_rows)}")
print(f"💾 CSV Saved to: {MASTER_CSV_PATH}")
print("=" * 80)
