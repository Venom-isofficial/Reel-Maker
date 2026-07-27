import sys
import os
import soundfile as sf
from kokoro_onnx import Kokoro

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

VOICE_PROFILES = {
    "am_michael": "American Male - News Anchor (Default)",
    "af_bella": "American Female - Dynamic & Energetic",
    "bm_george": "British Male - Documentary & Financial",
    "bf_emma": "British Female - Storyteller",
    "am_adam": "American Male - Deep Voice",
}

def main():
    if len(sys.argv) >= 2 and sys.argv[1] in ["--list-voices", "-l"]:
        print("Available Kokoro Voice Profiles:")
        for v, desc in VOICE_PROFILES.items():
            print(f"  - {v}: {desc}")
        sys.exit(0)

    if len(sys.argv) < 3:
        print("Usage: python kokoro_tts.py <text_file_or_text> <output_path> [voice]")
        sys.exit(1)

    input_arg = sys.argv[1]
    output_path = sys.argv[2]
    voice_name = sys.argv[3] if len(sys.argv) > 3 else os.environ.get("KOKORO_VOICE", "am_michael")

    if voice_name not in VOICE_PROFILES:
        print(f"Warning: Voice '{voice_name}' not recognized, using voice '{voice_name}' directly")

    if os.path.exists(input_arg):
        with open(input_arg, "r", encoding="utf-8") as f:
            text = f.read()
    else:
        text = input_arg

    script_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(script_dir, "models", "kokoro-v1.0.onnx")
    voices_path = os.path.join(script_dir, "models", "voices-v1.0.bin")

    if not os.path.exists(model_path) or not os.path.exists(voices_path):
        print(f"Error: Missing Kokoro models at {model_path}")
        sys.exit(1)

    tts_speed = float(sys.argv[4]) if len(sys.argv) >= 5 else float(os.environ.get("TTS_SPEED", "1.15"))
    lang = "en-gb" if voice_name.startswith("b") else "en-us"

    print(f"Synthesizing Kokoro TTS audio (Voice: {voice_name}, Speed: {tts_speed}x)...")
    kokoro = Kokoro(model_path, voices_path)
    samples, sample_rate = kokoro.create(text, voice=voice_name, speed=tts_speed, lang=lang)

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    sf.write(output_path, samples, sample_rate)
    print(f"SUCCESS: Kokoro TTS audio saved to {output_path} ({os.path.getsize(output_path)} bytes)")

if __name__ == "__main__":
    main()
