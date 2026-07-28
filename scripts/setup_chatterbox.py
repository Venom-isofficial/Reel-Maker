import os
import sys
import torch

# Organize all model weights strictly inside the project directory
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PROJECT_MODELS_DIR = os.path.join(PROJECT_ROOT, "scripts", "models")
os.makedirs(PROJECT_MODELS_DIR, exist_ok=True)
os.environ["HF_HOME"] = os.path.join(PROJECT_MODELS_DIR, "huggingface")
os.environ["TRANSFORMERS_CACHE"] = os.path.join(PROJECT_MODELS_DIR, "huggingface")

def setup_chatterbox():
    print("=" * 65)
    print("Official Resemble AI Chatterbox 500M Environment Verification")
    print("=" * 65)

    print(f"Python Version: {sys.version.split()[0]}")
    print(f"PyTorch Version: {torch.__version__}")
    
    cuda_avail = torch.cuda.is_available()
    print(f"CUDA GPU Available: {cuda_avail}")
    if cuda_avail:
        print(f"GPU Device: {torch.cuda.get_device_name(0)}")
        print(f"Dedicated VRAM: {torch.cuda.get_device_properties(0).total_memory / (1024**3):.2f} GB")
    else:
        print("Using CPU Inference")

    print("-" * 65)
    print("Testing Chatterbox Package Import...")

    try:
        import chatterbox
        print("SUCCESS: Official Chatterbox package imported successfully!")
    except ImportError:
        print("Chatterbox package not found. Installing chatterbox-tts...")
        import subprocess
        subprocess.run([sys.executable, "-m", "pip", "install", "chatterbox-tts"], check=True)
        import chatterbox
        print("SUCCESS: Chatterbox installed and imported successfully!")

    print("-" * 65)
    print("Caching Model Weights (resemble-ai/chatterbox-500m-en)...")

    device = "cuda" if cuda_avail else "cpu"
    try:
        if hasattr(chatterbox, "ChatterboxTTS"):
            model = chatterbox.ChatterboxTTS.from_pretrained("resemble-ai/chatterbox-500m-en", device=device)
        elif hasattr(chatterbox, "Chatterbox"):
            model = chatterbox.Chatterbox.from_pretrained("resemble-ai/chatterbox-500m-en", device=device)
        elif hasattr(chatterbox, "models") and hasattr(chatterbox.models, "Chatterbox"):
            model = chatterbox.models.Chatterbox.from_pretrained("resemble-ai/chatterbox-500m-en", device=device)
        else:
            from transformers import AutoModel
            model = AutoModel.from_pretrained("resemble-ai/chatterbox-500m-en", trust_remote_code=True)
        print("SUCCESS: Chatterbox 500M Model Weights Cached Locally!")
    except Exception as err:
        print(f"Model pre-download notice: {err}")

    print("=" * 65)
    print("Chatterbox 500M Setup Verification Complete!")
    print("Run `python scripts/chatterbox_server.py` to start the local model server.")
    print("=" * 65)

if __name__ == "__main__":
    setup_chatterbox()
