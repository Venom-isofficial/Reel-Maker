import os
import requests
import sys

def download_pytorch_cuda():
    url = "https://download-r2.pytorch.org/whl/cu124/torch-2.6.0%2Bcu124-cp313-cp313-win_amd64.whl"
    output_path = os.path.abspath("workspace/torch-2.6.0+cu124-cp313-cp313-win_amd64.whl")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    print(f"Target Wheel Path: {output_path}")
    existing_size = 0
    headers = {}
    file_mode = "wb"

    if os.path.exists(output_path):
        existing_size = os.path.getsize(output_path)
        headers["Range"] = f"bytes={existing_size}-"
        file_mode = "ab"
        print(f"Resuming download from byte {existing_size / (1024**2):.2f} MB...")

    try:
        resp = requests.get(url, headers=headers, stream=True, timeout=60)
        if resp.status_code in (200, 206):
            total_size = int(resp.headers.get("content-length", 0)) + existing_size
            with open(output_path, file_mode) as f:
                downloaded = existing_size
                for chunk in resp.iter_content(chunk_size=4 * 1024 * 1024):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total_size > 0:
                            pct = (downloaded / total_size) * 100
                            print(f"Downloading PyTorch CUDA: {downloaded / (1024**2):.2f} / {total_size / (1024**2):.2f} MB ({pct:.1f}%)", flush=True)
            print(f"\nSUCCESS: PyTorch CUDA Wheel Downloaded cleanly to {output_path}!")
            return True
        else:
            print(f"HTTP Error {resp.status_code} while fetching wheel.")
            return False
    except Exception as e:
        print(f"Download Exception: {e}")
        return False

if __name__ == "__main__":
    download_pytorch_cuda()
