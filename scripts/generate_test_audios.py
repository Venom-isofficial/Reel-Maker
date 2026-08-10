import os
import sys
import json
import requests
from pathlib import Path

SCRIPT_TEXT = (
    "Samsung Electronics extended its record streak after reporting second-quarter operating profit that exceeded analysts' expectations. "
    "The stronger-than-expected results reflect resilient demand across key business segments, reinforcing Samsung's position as one of the world's leading technology companies. "
    "The earnings beat also signals continued optimism for the semiconductor and consumer electronics industries despite global economic uncertainties. "
    "But the bigger question is—can Samsung maintain this momentum as competition in the AI and chip markets continues to intensify?"
)

def generate_all_test_audios():
    project_root = Path(__file__).resolve().parent.parent
    samples_base = project_root / "scripts" / "models" / "ChatterboxTrainingAudioSamples"
    out_dir = project_root / "test_audios"
    out_dir.mkdir(parents=True, exist_ok=True)

    if not samples_base.exists():
        print(f"Error: Samples directory not found at {samples_base}")
        return

    speaker_folders = [d for d in samples_base.iterdir() if d.is_dir() and (d.name.startswith("libri_") or d.name in ["1", "2"])]
    print(f"Found {len(speaker_folders)} voice speaker profiles to generate.")

    server_url = "http://127.0.0.1:8002/synthesize"

    for idx, folder in enumerate(speaker_folders, 1):
        preset_name = folder.name
        meta_json = folder / "metadata.json"
        
        gender = "Voice"
        name = preset_name
        spk_id = preset_name

        if meta_json.exists():
            try:
                with open(meta_json, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                    gender = meta.get("gender", "Voice")
                    name = meta.get("name", preset_name)
                    spk_id = meta.get("speakerId", preset_name)
            except Exception:
                pass
        elif preset_name == "1":
            gender = "Male"
            name = "CustomProfile1"
            spk_id = "1"
        elif preset_name == "2":
            gender = "Male"
            name = "CustomProfile2"
            spk_id = "2"

        # Sanitize filename
        clean_name = "".join(c if c.isalnum() or c in ['_', '-'] else '_' for c in name.replace(" ", "_"))
        file_name = f"{gender}_{clean_name}_LibriSpeech_{spk_id}.mp3"
        out_path = out_dir / file_name

        print(f"[{idx}/{len(speaker_folders)}] Generating audio for: {file_name}...")

        payload = {
            "text": SCRIPT_TEXT,
            "output_path": str(out_path),
            "voice_preset": preset_name,
            "speed": 1.15,
            "exaggeration": 0.5,
            "cfg_weight": 0.7,
            "temperature": 0.8,
            "repetition_penalty": 1.2,
            "top_p": 1.0,
            "min_p": 0.05
        }

        try:
            r = requests.post(server_url, json=payload, timeout=120)
            if r.status_code == 200:
                res_data = r.json()
                if res_data.get("status") == "success":
                    size_kb = out_path.stat().st_size / 1024 if out_path.exists() else 0
                    print(f"  Success: Saved {file_name} ({size_kb:.1f} KB)")
                else:
                    print(f"  Warning: Server response: {res_data}")
            else:
                print(f"  Failed (Status {r.status_code}): {r.text[:100]}")
        except Exception as e:
            print(f"  Error synthesizing {preset_name}: {e}")

    print(f"All audio samples generated into: {out_dir}")

if __name__ == "__main__":
    generate_all_test_audios()
