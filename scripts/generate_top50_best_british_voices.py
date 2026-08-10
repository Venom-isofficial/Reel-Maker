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
OUT_DIR = os.path.join(PROJECT_ROOT, "workspace", "top50_best_british_celebrity_audios")

os.makedirs(OUT_DIR, exist_ok=True)

text = (
    "Good morning. Here's your finance news update: global markets are trading cautiously today as investors monitor "
    "inflation data, interest-rate expectations, and corporate earnings. Stocks opened mixed, while the U.S. dollar "
    "strengthened and oil prices moved higher. Investors are now watching economic reports for signs of where markets "
    "could be headed next."
)

# Step 1: Parse metadata CSV to identify UK celebrities
meta = {}
with open(META_PATH, "r", encoding="utf-8", errors="ignore") as f:
    for row in csv.reader(f, delimiter="\t"):
        if len(row) >= 4 and row[0].startswith("id"):
            meta[row[0].strip()] = {
                "v_id": row[0].strip(),
                "id_num": row[0].strip().replace("id", ""),
                "name": row[1].strip(),
                "gender": "female" if row[2].strip() == "f" else "male",
                "nat": row[3].strip().upper()
            }

dirs = set(os.listdir(SAMPLES_BASE))

uk_list = []
for v_id, info in meta.items():
    if info["nat"] in ["UK", "UK "]:
        clean_name = info["name"].replace(" ", "_").replace(".", "_")
        folder = f"vox_{clean_name}_{info['gender']}"
        if folder in dirs:
            uk_list.append((v_id, info["name"], info["gender"], folder, info["id_num"]))

# Iconic British Celebrities Ranking List
famous_names = [
    "David_Attenborough", "Gordon_Ramsay", "Tom_Hiddleston", "Alan_Rickman", "Bear_Grylls",
    "Daniel_Craig", "Ricky_Gervais", "Bill_Nighy", "Matt_Smith", "Natalie_Dormer",
    "Brian_Cox", "Charles_Dance", "Eddie_Izzard", "Dominic_Cooper", "Iain_Glen",
    "John_Rhys-Davies", "Paul_McGann", "Peter_Coyote", "Rhys_Ifans", "Robert_Carlyle",
    "Rupert_Everett", "Sam_Heughan", "Sam_Riley", "Stephen_Baldwin", "Steven_Moffat",
    "Agyness_Deyn", "Alice_Eve", "Abbie_Cornish", "Alexandra_Roach", "Alex_Kingston",
    "Andrea_Riseborough", "Ashley_Jensen", "Bonnie_Wright", "Brenda_Blethyn", "Celia_Imrie",
    "Charlotte_Gainsbourg", "Cilla_Black", "Dawn_French", "Eleanor_Tomlinson", "Emily_Atack",
    "Felicity_Jones", "Finola_Hughes", "Fiona_Shaw", "Geri_Halliwell", "Hannah_Spearritt",
    "Heather_Graham", "Heike_Makatsch", "Joanna_Lumley", "Kaya_Scodelario", "Kate_Walsh"
]

def sort_key(item):
    name_clean = item[1].replace(" ", "_").replace(".", "_")
    if name_clean in famous_names:
        return (0, famous_names.index(name_clean))
    return (1, item[0])

uk_list.sort(key=sort_key)
top50_british = uk_list[:50]

print(f"🇬🇧 Starting Batch Synthesis for TOP 50 Best British Celebrity Accents ({len(top50_british)} voices)...")
print(f"📁 Output Directory: {OUT_DIR}")
print("=" * 80)

completed_count = 0
failed_count = 0
skipped_count = 0

t_start = time.time()

for rank, (v_id, name, gender, folder_name, id_num) in enumerate(top50_british, 1):
    clean_name = name.replace(" ", "_").replace(".", "_")
    # Format: <Rank>_<IDNumber>_vox_<CelebrityName>_<Gender>.mp3
    out_filename = f"{rank}_{id_num}_vox_{clean_name}_{gender}.mp3"
    out_file = os.path.join(OUT_DIR, out_filename)

    # Skip if already generated cleanly
    if os.path.exists(out_file) and os.path.getsize(out_file) > 1000:
        skipped_count += 1
        size_kb = os.path.getsize(out_file) / 1024
        print(f"[{rank:02d}/50] ⏩ Skipped (already generated): {out_filename} ({size_kb:.1f} KB)")
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
                print(f"[{rank:02d}/50] ✅ [OK] {name} ({gender.capitalize()}) -> {out_filename} ({elapsed:.1f}s, {size_kb:.1f} KB)")
                success = True
                break
            else:
                if attempt < 3:
                    time.sleep(3)
                else:
                    failed_count += 1
                    err_msg = res.text[:100] if res.text else f"Status {res.status_code}"
                    print(f"[{rank:02d}/50] ❌ [FAIL] {name}: {err_msg}")
        except Exception as e:
            if attempt < 3:
                time.sleep(3)
            else:
                failed_count += 1
                print(f"[{rank:02d}/50] ❌ [ERROR] {name}: {e}")

total_elapsed = time.time() - t_start
print("=" * 80)
print(f"🎉 TOP 50 BEST BRITISH ACCENTS BATCH SYNTHESIS COMPLETE!")
print(f"✅ Generated: {completed_count} | ⏩ Skipped: {skipped_count} | ❌ Failed: {failed_count} | ⏱️ Total Time: {total_elapsed / 60:.2f} mins")
print(f"📁 Audio Files Saved to: {OUT_DIR}")
