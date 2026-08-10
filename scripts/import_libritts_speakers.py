import os
import sys
import tarfile
import subprocess
import json
from pathlib import Path

def import_libritts_speakers(limit: int = 50):
    project_root = Path(__file__).resolve().parent.parent
    archive_path = project_root / "scripts" / "models" / "OpenSLRModels" / "train-clean-100.tar.gz"
    output_base = project_root / "scripts" / "models" / "ChatterboxTrainingAudioSamples"

    if not archive_path.exists():
        print(f"Error: Archive not found at {archive_path}")
        return

    print(f"Opening {archive_path.name}...")
    with tarfile.open(archive_path, "r:gz") as tar:
        print("Reading LibriSpeech/SPEAKERS.TXT metadata...")
        speakers_meta = {}
        speakers_file = tar.extractfile("LibriSpeech/SPEAKERS.TXT")
        if speakers_file:
            for line in speakers_file.readlines():
                decoded = line.decode("utf-8", errors="ignore").strip()
                if not decoded or decoded.startswith(";"):
                    continue
                parts = [p.strip() for p in decoded.split("|")]
                if len(parts) >= 5:
                    spk_id, gender, subset, minutes, name = parts[0], parts[1], parts[2], parts[3], parts[4]
                    if subset == "train-clean-100":
                        speakers_meta[spk_id] = {
                            "gender": "Female" if gender == "F" else "Male",
                            "name": name,
                            "minutes": minutes
                        }

        print(f"Found {len(speakers_meta)} speakers in train-clean-100.")

        # Find members in tar corresponding to audio files per speaker
        speaker_samples = {}
        for member in tar.getmembers():
            if member.name.endswith(".flac") and "train-clean-100" in member.name:
                parts = member.name.split("/")
                if len(parts) >= 4:
                    spk_id = parts[2]
                    if spk_id not in speaker_samples:
                        speaker_samples[spk_id] = []
                    if len(speaker_samples[spk_id]) < 2:
                        speaker_samples[spk_id].append(member)

        print(f"Identified audio files for {len(speaker_samples)} speakers.")

        imported_count = 0
        for spk_id, members in speaker_samples.items():
            if limit and imported_count >= limit:
                break

            meta = speakers_meta.get(spk_id, {"gender": "Voice", "name": f"Speaker {spk_id}"})
            gender_prefix = "Female" if meta["gender"] == "Female" else "Male"
            folder_name = f"libri_{spk_id}"
            spk_dir = output_base / folder_name
            spk_dir.mkdir(parents=True, exist_ok=True)

            ref_wav = spk_dir / "reference.wav"
            meta_json = spk_dir / "metadata.json"

            # Extract temp flac
            first_member = members[0]
            temp_flac = spk_dir / "temp.flac"

            with open(temp_flac, "wb") as f_out:
                f_in = tar.extractfile(first_member)
                if f_in:
                    f_out.write(f_in.read())

            # Convert to 10s 24kHz mono PCM WAV with loudnorm
            try:
                cmd = [
                    "ffmpeg", "-y", "-i", str(temp_flac),
                    "-ss", "0", "-t", "10",
                    "-af", "loudnorm",
                    "-ar", "24000", "-ac", "1",
                    str(ref_wav)
                ]
                subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except Exception as e:
                print(f"Warning: Failed converting sample for speaker {spk_id}: {e}")
                continue
            finally:
                if temp_flac.exists():
                    temp_flac.unlink()

            # Write metadata
            meta_data = {
                "speakerId": spk_id,
                "name": meta["name"],
                "gender": meta["gender"],
                "label": f"{gender_prefix} - {meta['name']} (LibriSpeech #{spk_id})"
            }
            with open(meta_json, "w", encoding="utf-8") as f_meta:
                json.dump(meta_data, f_meta, indent=2)

            imported_count += 1
            print(f"  [{imported_count}/{limit or len(speaker_samples)}] Imported Speaker #{spk_id}: {meta_data['label']}")

    print(f"Successfully imported {imported_count} LibriSpeech speakers into {output_base}!")

if __name__ == "__main__":
    limit_num = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    import_libritts_speakers(limit=limit_num)
