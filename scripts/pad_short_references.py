import os
import sys
import torchaudio
import torch

# Force UTF-8 stdout
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try: sys.stdout.reconfigure(encoding="utf-8")
    except Exception: pass

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BASES = [
    os.path.join(PROJECT_ROOT, "scripts", "models", "ChatterboxTrainingAudioSamples"),
    os.path.join(PROJECT_ROOT, "scripts", "models", "ChatterboxVox2Samples")
]

print("=" * 80)
print("🔊 Enhancing Reference Audio Durations for All Celebrities")
print("=" * 80)

enhanced_count = 0
for base in BASES:
    if not os.path.exists(base):
        continue
    for folder in os.listdir(base):
        ref_path = os.path.join(base, folder, "reference.wav")
        if not os.path.exists(ref_path):
            continue
        try:
            info = torchaudio.info(ref_path)
            duration = info.num_frames / info.sample_rate
            if duration < 7.0:
                wav, sr = torchaudio.load(ref_path)
                repeat_count = int(8.0 / duration) + 1
                tensors = [wav] * repeat_count
                combined = torch.cat(tensors, dim=1)
                max_samples = sr * 10 # 10 seconds cap
                if combined.shape[1] > max_samples:
                    combined = combined[:, :max_samples]
                torchaudio.save(ref_path, combined, sr)
                enhanced_count += 1
        except Exception as e:
            pass

print(f"✅ Successfully enhanced {enhanced_count} short reference audio files to full 8-10 seconds!")
