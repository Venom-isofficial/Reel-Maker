import os
import requests

url = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx"
dest = "scripts/models/kokoro-v1.0.onnx"

print("Downloading kokoro-v1.0.onnx from GitHub release...")
r = requests.get(url, stream=True, headers={'User-Agent': 'Mozilla/5.0'})
r.raise_for_status()

total = int(r.headers.get('content-length', 0))
downloaded = 0

with open(dest, 'wb') as f:
    for chunk in r.iter_content(chunk_size=1024 * 1024):
        if chunk:
            f.write(chunk)
            downloaded += len(chunk)
            print(f"Downloaded: {downloaded // (1024*1024)}MB / {total // (1024*1024)}MB")

print(f"Done! Saved {dest} ({os.path.getsize(dest)} bytes)")
