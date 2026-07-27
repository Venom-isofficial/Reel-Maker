import sys
import os
import asyncio

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

try:
    import edge_tts
except ImportError:
    print("Error: edge-tts module not installed. Please run pip install edge-tts")
    sys.exit(1)

VOICE_PROFILES = {
    "en-US-ChristopherNeural": "Christopher (Male Deep News Anchor - Default)",
    "en-US-GuyNeural": "Guy (Male High-Energy Deep)",
    "en-US-EricNeural": "Eric (Male Deep Resonant)",
    "en-US-AndrewNeural": "Andrew (Male Authoritative News)",
    "en-US-BrianNeural": "Brian (Male Professional Narration)",
    "en-GB-RyanNeural": "Ryan (British Male Financial)",
    "en-US-JennyNeural": "Jenny (Female Dynamic)",
    "en-US-AriaNeural": "Aria (Female Professional News)",
}

async def generate(text, output_path, voice_name, speed_multiplier):
    if os.path.exists(text):
        with open(text, "r", encoding="utf-8") as f:
            content = f.read()
    else:
        content = text

    # Convert numeric speed multiplier (e.g. 1.15) to percentage string (+15%)
    pct = int(round((speed_multiplier - 1.0) * 100))
    rate_str = f"+{pct}%" if pct >= 0 else f"{pct}%"

    print(f"Synthesizing Chatterbox MAX Neural Audio (Voice: {voice_name}, Rate: {rate_str})...")
    communicate = edge_tts.Communicate(content, voice_name, rate=rate_str)
    await communicate.save(output_path)
    if os.path.exists(output_path):
        print(f"SUCCESS: Chatterbox MAX Audio saved to {output_path} ({os.path.getsize(output_path)} bytes)")

def main():
    if len(sys.argv) >= 2 and sys.argv[1] in ["--list-voices", "-l"]:
        print("Available Chatterbox MAX Neural Voice Profiles:")
        for v, desc in VOICE_PROFILES.items():
            print(f"  - {v}: {desc}")
        sys.exit(0)

    if len(sys.argv) < 3:
        print("Usage: python chatterbox_tts.py <text_file_or_text> <output_path> [voice] [speed]")
        sys.exit(1)

    input_arg = sys.argv[1]
    output_path = sys.argv[2]
    voice_name = sys.argv[3] if len(sys.argv) > 3 else "en-US-ChristopherNeural"
    speed = float(sys.argv[4]) if len(sys.argv) >= 5 else 1.15

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    asyncio.run(generate(input_arg, output_path, voice_name, speed))

if __name__ == "__main__":
    main()
