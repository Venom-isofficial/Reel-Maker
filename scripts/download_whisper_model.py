import os
from huggingface_hub import snapshot_download

local_dir = os.path.abspath("python/models/faster-whisper-large-v3")
print(f"Downloading Systran/faster-whisper-large-v3 to {local_dir}...")
snapshot_download(repo_id="Systran/faster-whisper-large-v3", local_dir=local_dir)
print("✅ Download completed successfully!")
