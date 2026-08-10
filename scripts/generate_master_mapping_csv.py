import os
import sys
import csv

# Force UTF-8 stdout
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try: sys.stdout.reconfigure(encoding="utf-8")
    except Exception: pass

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
VOX1_META = os.path.join(PROJECT_ROOT, "scripts", "models", "vox1_meta.csv")
VOX2_META = os.path.join(PROJECT_ROOT, "scripts", "models", "vox2_meta.csv")
OUT_CSV = os.path.join(PROJECT_ROOT, "workspace", "all_celebrities_master_mapping.csv")

os.makedirs(os.path.dirname(OUT_CSV), exist_ok=True)

rows_to_write = []
headers = ["Dataset", "Vox_ID", "VGGFace2_ID", "Celebrity_Name", "Gender", "Nationality_Country", "Audio_Preset_Folder", "Audio_Sample_Path"]

# 1. Parse VoxCeleb1 Metadata
if os.path.exists(VOX1_META):
    with open(VOX1_META, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.reader(f, delimiter="\t")
        for r in reader:
            if len(r) >= 4 and r[0].startswith("id"):
                v_id = r[0].strip()
                name = r[1].strip()
                clean_name = name.replace(" ", "_").replace(".", "_")
                gender = "Female" if r[2].strip().lower() == "f" else "Male"
                country = r[3].strip().upper()
                preset_folder = f"vox_{clean_name}_{gender.lower()}"
                sample_path = os.path.join(PROJECT_ROOT, "scripts", "models", "ChatterboxTrainingAudioSamples", preset_folder, "reference.wav")

                rows_to_write.append([
                    "VoxCeleb1",
                    v_id,
                    "N/A",
                    name.replace("_", " "),
                    gender,
                    country,
                    preset_folder,
                    sample_path
                ])

# 2. Parse VoxCeleb2 Metadata
if os.path.exists(VOX2_META):
    with open(VOX2_META, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.reader(f)
        for r in reader:
            if len(r) >= 3 and r[0].strip().startswith("id"):
                v_id = r[0].strip()
                vgg_id = r[1].strip()
                gender = "Female" if r[2].strip().lower() == "f" else "Male"
                preset_folder = f"vox_{v_id}_{gender.lower()}"
                sample_path = os.path.join(PROJECT_ROOT, "scripts", "models", "ChatterboxVox2Samples", preset_folder, "reference.wav")

                rows_to_write.append([
                    "VoxCeleb2",
                    v_id,
                    vgg_id,
                    f"Vox2 Celebrity #{v_id.replace('id', '')}",
                    gender,
                    "Global (Multi-National)",
                    preset_folder,
                    sample_path
                ])

with open(OUT_CSV, "w", encoding="utf-8", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(headers)
    writer.writerows(rows_to_write)

print("=" * 80)
print(f"🎉 MASTER CELEBRITY IDENTITY MAPPING CSV CREATED SUCCESSFULLY!")
print(f"📊 Total Mapped Celebrities: {len(rows_to_write)}")
print(f"💾 File Saved to: {OUT_CSV}")
print("=" * 80)
