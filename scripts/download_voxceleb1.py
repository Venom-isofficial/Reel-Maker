import os
import sys
import csv
import json
import time
import tarfile
import subprocess
import requests

# Set encoding to UTF-8
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try: sys.stdout.reconfigure(encoding="utf-8")
    except Exception: pass

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODELS_DIR = os.path.join(PROJECT_ROOT, "scripts", "models")
SAMPLES_BASE = os.path.join(MODELS_DIR, "ChatterboxTrainingAudioSamples")
META_PATH = os.path.join(MODELS_DIR, "vox1_meta.csv")
TAR_PATH = os.path.join(MODELS_DIR, "voxceleb1_test_0000000.tar")

os.makedirs(SAMPLES_BASE, exist_ok=True)

# Step 1: Ensure metadata CSV exists
if not os.path.exists(META_PATH):
    print("📥 Downloading VoxCeleb1 Metadata CSV...")
    meta_url = "https://openslr.trmal.net/resources/49/vox1_meta.csv"
    res = requests.get(meta_url, timeout=30)
    with open(META_PATH, "wb") as f:
        f.write(res.content)
    print("✅ Metadata CSV downloaded.")

# Parse celebrity metadata mapping (VoxCeleb ID -> Celebrity Name & Gender)
meta_map = {}
with open(META_PATH, "r", encoding="utf-8", errors="ignore") as f:
    reader = csv.reader(f, delimiter="\t")
    for row in reader:
        if len(row) >= 3 and row[0].startswith("id"):
            v_id = row[0].strip()
            name = row[1].strip()
            gender = row[2].strip()
            nat = row[3].strip() if len(row) > 3 else ""
            meta_map[v_id] = {
                "name": name,
                "gender": "male" if gender == "m" else "female",
                "nat": nat
            }

print(f"📊 Loaded {len(meta_map)} celebrity identity mappings from metadata.")

if not os.path.exists(TAR_PATH):
    print(f"❌ Error: {TAR_PATH} not found!")
    sys.exit(1)

print(f"📂 Reading VoxCeleb1 archive: {TAR_PATH} ({os.path.getsize(TAR_PATH) / (1024*1024):.1f} MB)...")

speaker_wav_map = {}

t0 = time.time()
with tarfile.open(TAR_PATH, "r:*") as tar:
    members = tar.getmembers()
    json_members = [m for m in members if m.name.endswith(".json")]
    wav_members = {m.name: m for m in members if m.name.endswith(".wav")}

    print(f"🔍 Found {len(json_members)} metadata JSON entries and {len(wav_members)} WAV audio clips in archive.")

    for jm in json_members:
        try:
            fobj = tar.extractfile(jm)
            if not fobj: continue
            data = json.loads(fobj.read().decode("utf-8", errors="ignore"))
            spk_id = data.get("speakerid")
            if not spk_id: continue

            wav_name = jm.name.replace(".json", ".wav")
            if wav_name in wav_members and spk_id not in speaker_wav_map:
                speaker_wav_map[spk_id] = wav_members[wav_name]
        except Exception:
            pass

    print(f"🎙️ Mapped {len(speaker_wav_map)} unique celebrity speakers to reference audio clips.")

    extracted_count = 0
    for spk_id, wav_m in speaker_wav_map.items():
        meta = meta_map.get(spk_id, {"name": spk_id, "gender": "unknown"})
        clean_name = meta["name"].replace(" ", "_").replace(".", "_")
        folder_name = f"vox_{clean_name}_{meta['gender']}"
        profile_dir = os.path.join(SAMPLES_BASE, folder_name)
        os.makedirs(profile_dir, exist_ok=True)

        ref_file = os.path.join(profile_dir, "reference.wav")

        if not os.path.exists(ref_file) or os.path.getsize(ref_file) < 1000:
            f_in = tar.extractfile(wav_m)
            if f_in:
                temp_wav = os.path.join(profile_dir, "temp_raw.wav")
                with open(temp_wav, "wb") as f_out:
                    f_out.write(f_in.read())

                # Convert/normalize to 24kHz single channel reference.wav
                try:
                    cmd = ["ffmpeg", "-y", "-i", temp_wav, "-ar", "24000", "-ac", "1", ref_file]
                    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    if os.path.exists(temp_wav): os.remove(temp_wav)
                except Exception:
                    if os.path.exists(temp_wav):
                        os.rename(temp_wav, ref_file)

                extracted_count += 1
                if extracted_count <= 25 or extracted_count % 50 == 0:
                    print(f"✅ [{extracted_count}/{len(speaker_wav_map)}] Created Voice Profile: '{folder_name}' ({meta['name']})")

print(f"\n🎉 SUCCESS: Extracted {extracted_count} VoxCeleb celebrity voice profiles into Chatterbox in {time.time() - t0:.1f}s!")
