import os
import requests

BASE_URL = "https://huggingface.co/Systran/faster-whisper-large-v3/resolve/main"
FILES = ["config.json", "model.bin", "tokenizer.json", "vocabulary.json"]
DEST_DIR = os.path.abspath("python/models/large-v3")

os.makedirs(DEST_DIR, exist_ok=True)

for fname in FILES:
    dest_path = os.path.join(DEST_DIR, fname)
    url = f"{BASE_URL}/{fname}"

    if os.path.exists(dest_path) and os.path.getsize(dest_path) > 1000:
        print(f"File {fname} already exists ({os.path.getsize(dest_path)} bytes). Skipping.")
        continue

    print(f"Downloading {fname} from HuggingFace...")
    res = requests.get(url, stream=True, headers={'User-Agent': 'Mozilla/5.0'})
    if res.status_code != 200:
        print(f"Warning: {fname} returned HTTP {res.status_code}")
        continue

    total_size = int(res.headers.get('content-length', 0))
    downloaded = 0

    with open(dest_path, "wb") as f:
        for chunk in res.iter_content(chunk_size=1024 * 1024):
            if chunk:
                f.write(chunk)
                downloaded += len(chunk)
                if total_size > 0 and downloaded % (10 * 1024 * 1024) == 0:
                    percent = (downloaded / total_size) * 100
                    print(f"  {fname}: {percent:.1f}% ({downloaded // (1024*1024)}MB / {total_size // (1024*1024)}MB)")

print(f"✅ All model files saved to {DEST_DIR}")
