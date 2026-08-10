import os
import sys
import csv
import json

# Force UTF-8 stdout
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try: sys.stdout.reconfigure(encoding="utf-8")
    except Exception: pass

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
META_PATH = os.path.join(PROJECT_ROOT, "scripts", "models", "vox2_meta.csv")
SAMPLES_BASE = os.path.join(PROJECT_ROOT, "scripts", "models", "ChatterboxVox2Samples")
OUT_JSON_PATH = os.path.join(PROJECT_ROOT, "scripts", "models", "vox2_master_index.json")

print("=" * 80)
print("📊 Building VoxCeleb2 Master Index JSON")
print(f"📁 Metadata CSV: {META_PATH}")
print(f"📁 Audio Samples Directory: {SAMPLES_BASE}")
print("=" * 80)

vox2_voices = []

# Map metadata
meta = {}
if os.path.exists(META_PATH):
    with open(META_PATH, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) >= 3 and row[0].strip().startswith("id"):
                v_id = row[0].strip()
                name = row[1].strip()
                gender = "female" if row[2].strip().lower() == "f" else "male"
                clean_name = name.replace(" ", "_").replace(".", "_")
                meta[v_id] = {
                    "v_id": v_id,
                    "name": name,
                    "clean_name": clean_name,
                    "gender": gender,
                    "folder": f"vox_{clean_name}_{gender}"
                }

if os.path.exists(SAMPLES_BASE):
    dirs = [d for d in os.listdir(SAMPLES_BASE) if os.path.isdir(os.path.join(SAMPLES_BASE, d))]
    print(f"📁 Found {len(dirs)} celebrity audio directories in {SAMPLES_BASE}.")

    for d in sorted(dirs):
        ref_file = os.path.join(SAMPLES_BASE, d, "reference.wav")
        if not os.path.exists(ref_file):
            continue

        # Extract name & gender from folder name (vox_<CleanName>_<gender>)
        parts = d.replace("vox_", "").split("_")
        gen_str = parts.pop() if parts else "male"
        gender_cap = "Female" if gen_str.lower() == "female" else "Male"
        name_str = " ".join(parts).replace("_", " ")

        icon = "👩" if gender_cap == "Female" else "🎙️"
        label = f"{icon} 🌟 {name_str} ({gender_cap} Celebrity - Vox2)"

        vox2_voices.append({
            "value": d,
            "label": label,
            "name": name_str,
            "gender": gender_cap,
            "ref_path": ref_file,
            "provider": "chatterbox_vox2"
        })

os.makedirs(os.path.dirname(OUT_JSON_PATH), exist_ok=True)
with open(OUT_JSON_PATH, "w", encoding="utf-8") as f:
    json.dump(vox2_voices, f, indent=2, ensure_ascii=False)

print(f"✅ Generated master Vox2 index with {len(vox2_voices)} HD celebrity voice profiles!")
print(f"💾 Output JSON: {OUT_JSON_PATH}")
