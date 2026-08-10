import os
import sys
import time
import requests

# Force UTF-8 stdout
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try: sys.stdout.reconfigure(encoding="utf-8")
    except Exception: pass

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TARGET_DIR = os.path.join(PROJECT_ROOT, "scripts", "models")
os.makedirs(TARGET_DIR, exist_ok=True)

BASE_URL = "https://huggingface.co/datasets/ProgramComputer/voxceleb/resolve/main/vox2/"

FILES_TO_DOWNLOAD = [
    ("vox2_meta.csv", 159126),
    ("vox2_test_aac.zip", 2594018146),
    ("vox2_dev_aac_partaa", 10737418240),
    ("vox2_dev_aac_partab", 10737418240),
    ("vox2_dev_aac_partac", 10737418240),
    ("vox2_dev_aac_partad", 10737418240),
    ("vox2_dev_aac_partae", 10737418240),
    ("vox2_dev_aac_partaf", 10737418240),
    ("vox2_dev_aac_partag", 10737418240),
    ("vox2_dev_aac_partah", 2315355528)
]

total_dataset_bytes = sum(size for _, size in FILES_TO_DOWNLOAD)
print("=" * 80)
print(f"📦 Starting Automated VoxCeleb2 Dataset Download (6,112 Celebrities)")
print(f"📁 Target Destination: {TARGET_DIR}")
print(f"📊 Total Dataset Volume: {total_dataset_bytes / (1024**3):.2f} GB")
print("=" * 80)

def download_file(filename, expected_size):
    filepath = os.path.join(TARGET_DIR, filename)
    url = BASE_URL + filename

    # Resume support
    file_mode = "wb"
    existing_bytes = 0
    headers = {}

    if os.path.exists(filepath):
        existing_bytes = os.path.getsize(filepath)
        if existing_bytes == expected_size:
            print(f"⏩ [SKIP] {filename} is already fully downloaded ({existing_bytes / (1024**2):.1f} MB)")
            return True
        elif existing_bytes < expected_size:
            print(f"🔄 [RESUME] Resuming {filename} from {existing_bytes / (1024**2):.1f} MB...")
            file_mode = "ab"
            headers["Range"] = f"bytes={existing_bytes}-"

    t0 = time.time()
    try:
        res = requests.get(url, headers=headers, stream=True, timeout=30)
        if res.status_code not in (200, 206):
            print(f"❌ [ERROR] Failed to download {filename}: Status {res.status_code}")
            return False

        downloaded = existing_bytes
        chunk_size = 1024 * 1024 # 1MB chunks

        with open(filepath, file_mode) as f:
            for chunk in res.iter_content(chunk_size=chunk_size):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)
                    elapsed = time.time() - t0
                    speed_mb = ((downloaded - existing_bytes) / (1024**2)) / max(0.1, elapsed)
                    pct = (downloaded / expected_size) * 100
                    sys.stdout.write(
                        f"\r📥 Downloading {filename}: {pct:.1f}% ({downloaded / (1024**2):.1f}/{expected_size / (1024**2):.1f} MB) | Speed: {speed_mb:.2f} MB/s"
                    )
                    sys.stdout.flush()

        print(f"\n✅ [COMPLETED] {filename} saved ({os.path.getsize(filepath) / (1024**2):.1f} MB)")
        return True
    except Exception as e:
        print(f"\n❌ [EXCEPTION] Download error for {filename}: {e}")
        return False

# Execute downloads sequentially
success_count = 0
for filename, expected_size in FILES_TO_DOWNLOAD:
    print(f"\n🚀 Processing: {filename}...")
    if download_file(filename, expected_size):
        success_count += 1

print("\n" + "=" * 80)
if success_count == len(FILES_TO_DOWNLOAD):
    print("🎉 ALL VOXCELEB2 DATASET FILES HAVE BEEN SUCCESSFULLY DOWNLOADED!")
    print(f"📁 Files Saved in: {TARGET_DIR}")
else:
    print(f"⚠️ Download finished with {success_count}/{len(FILES_TO_DOWNLOAD)} files completed.")
print("=" * 80)
