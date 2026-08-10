import os, sys, time, requests

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try: sys.stdout.reconfigure(encoding="utf-8")
    except: pass

OUT_DIR = os.path.abspath("workspace/top50_best_british_celebrity_audios")
text = (
    "Good morning. Here's your finance news update: global markets are trading cautiously today as investors monitor "
    "inflation data, interest-rate expectations, and corporate earnings. Stocks opened mixed, while the U.S. dollar "
    "strengthened and oil prices moved higher. Investors are now watching economic reports for signs of where markets "
    "could be headed next."
)

# The 3 that failed due to server not ready
missing = [
    (37, "10314", "vox_Felicity_Jones_female"),
    (38, "10316", "vox_Finola_Hughes_female"),
    (39, "10333", "vox_Geri_Halliwell_female"),
]

print("🔁 Retrying 3 failed British celebrity voices...")
for rank, id_num, folder in missing:
    out_file = os.path.join(OUT_DIR, f"{rank}_{id_num}_{folder}.mp3")
    if os.path.exists(out_file) and os.path.getsize(out_file) > 1000:
        print(f"[{rank}/50] ⏩ Already exists: {os.path.basename(out_file)}")
        continue
    for attempt in range(1, 4):
        try:
            t0 = time.time()
            res = requests.post("http://127.0.0.1:8002/synthesize", json={
                "text": text, "output_path": out_file, "voice_preset": folder,
                "cfg_weight": 0.7, "exaggeration": 0.5, "speed": 1.15,
            }, timeout=180)
            elapsed = time.time() - t0
            if res.status_code == 200 and os.path.exists(out_file) and os.path.getsize(out_file) > 1000:
                print(f"[{rank}/50] ✅ {folder} -> {os.path.basename(out_file)} ({elapsed:.1f}s, {os.path.getsize(out_file)/1024:.1f} KB)")
                break
            else:
                if attempt < 3: time.sleep(3)
                else: print(f"[{rank}/50] ❌ FAIL: {res.text[:100]}")
        except Exception as e:
            if attempt < 3: time.sleep(3)
            else: print(f"[{rank}/50] ❌ ERROR: {e}")

print("✅ Retry complete! All 50 Top British Celebrity voices should now be in:", OUT_DIR)
