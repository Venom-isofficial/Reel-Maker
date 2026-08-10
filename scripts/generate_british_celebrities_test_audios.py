import os
import sys
import time
import requests

# Force UTF-8 stdout
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try: sys.stdout.reconfigure(encoding="utf-8")
    except Exception: pass

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT_DIR = os.path.join(PROJECT_ROOT, "workspace", "british_celebrity_test_audios")
os.makedirs(OUT_DIR, exist_ok=True)

TEXT = "Iran's Revolutionary Guard says re-opening Strait of Hormuz does not depend on talks with Oman  Reuters. Reuters are tracking rapid shifts in business. With major moves around Iran's Revolutionary Guard says re-opening, investors are bracing for impact. Millions of dollars hang in the balance. Will markets recover, or is a major crash next? Drop your take below!"

CELEBRITIES = [
    {"name": "David Attenborough", "id": "id10203", "voice_name": "vox_David_Attenborough_male", "filename": "01_David_Attenborough_id10203.mp3"},
    {"name": "Stephen Fry",        "id": "id11111", "voice_name": "vox_Stephen_Fry_male",        "filename": "02_Stephen_Fry_id11111.mp3"},
    {"name": "Jeremy Irons",       "id": "id10482", "voice_name": "vox_Jeremy_Irons_male",       "filename": "03_Jeremy_Irons_id10482.mp3"},
    {"name": "Alan Rickman",       "id": "id10022", "voice_name": "vox_Alan_Rickman_male",       "filename": "04_Alan_Rickman_id10022.mp3"},
    {"name": "Charles Dance",      "id": "id10142", "voice_name": "vox_Charles_Dance_male",      "filename": "05_Charles_Dance_id10142.mp3"},
    {"name": "Brian Cox",          "id": "id10107", "voice_name": "vox_Brian_Cox_male",          "filename": "06_Brian_Cox_id10107.mp3"},
    {"name": "Tom Hiddleston",     "id": "id11183", "voice_name": "vox_Tom_Hiddleston_male",     "filename": "07_Tom_Hiddleston_id11183.mp3"},
    {"name": "David Tennant",      "id": "id10221", "voice_name": "vox_David_Tennant_male",      "filename": "08_David_Tennant_id10221.mp3"},
    {"name": "Hugh Laurie",        "id": "id10382", "voice_name": "vox_Hugh_Laurie_male",        "filename": "09_Hugh_Laurie_id10382.mp3"},
]

print("=" * 80)
print("🎙️ Generating High-Fidelity Test Audios for 9 Iconic British Celebrities")
print(f"📁 Output Directory: {OUT_DIR}")
print("=" * 80)

success_count = 0
for idx, celeb in enumerate(CELEBRITIES, 1):
    out_file = os.path.join(OUT_DIR, celeb["filename"])
    print(f"\n[{idx}/9] Generating voice for {celeb['name']} ({celeb['id']})...")
    
    payload = {
        "text": TEXT,
        "voice_preset": celeb["voice_name"],
        "speed": 1.15,
        "exaggeration": 0.45,
        "cfg_weight": 0.70,
        "output_path": out_file
    }

    t0 = time.time()
    try:
        res = requests.post("http://127.0.0.1:8002/synthesize", json=payload, timeout=120)
        dur = time.time() - t0
        if res.status_code == 200 and os.path.exists(out_file) and os.path.getsize(out_file) > 1000:
            size_kb = os.path.getsize(out_file) / 1024
            print(f"   ✅ Success! {celeb['name']} generated in {dur:.2f}s ({size_kb:.1f} KB)")
            print(f"   🔊 Path: {out_file}")
            success_count += 1
        else:
            print(f"   ❌ Failed for {celeb['name']}: Status {res.status_code} - {res.text[:200]}")
    except Exception as e:
        print(f"   ❌ Error generating for {celeb['name']}: {e}")

print("\n" + "=" * 80)
print(f"🎉 GENERATION COMPLETE! ({success_count}/9 British Celebrities Generated)")
print(f"📁 Audio Files Location: {OUT_DIR}")
print("=" * 80)
