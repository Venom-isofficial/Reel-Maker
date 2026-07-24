import sys
import os
import argparse
import json
import time
import ctranslate2
from faster_whisper import WhisperModel

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def format_srt_timestamp(seconds: float) -> str:
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int(round((seconds % 1) * 1000))
    return f"{hrs:02d}:{mins:02d}:{secs:02d},{millis:03d}"

def write_srt_file(words, srt_path):
    phrases = []
    current_phrase = []
    phrase_start = 0.0
    phrase_end = 0.0

    for i, w in enumerate(words):
        if not current_phrase:
            phrase_start = w["start"]
        current_phrase.append(w["word"])
        phrase_end = w["end"]

        is_sentence_end = any(c in w["word"] for c in ".?!")
        is_clause_end = any(c in w["word"] for c in ":;") and len(current_phrase) >= 6
        is_max_words = len(current_phrase) >= 11
        is_last = (i == len(words) - 1)

        if is_sentence_end or is_clause_end or is_max_words or is_last:
            phrases.append({
                "text": " ".join(current_phrase).upper(),
                "start": phrase_start,
                "end": phrase_end
            })
            current_phrase = []

    srt_lines = []
    for idx, p in enumerate(phrases):
        srt_lines.append(f"{idx + 1}\n{format_srt_timestamp(p['start'])} --> {format_srt_timestamp(p['end'])}\n{p['text']}\n")

    os.makedirs(os.path.dirname(os.path.abspath(srt_path)), exist_ok=True)
    with open(srt_path, "w", encoding="utf-8") as f:
        f.write("\n".join(srt_lines))

def run_transcription(audio_path, model):
    segments, info = model.transcribe(
        audio_path,
        beam_size=1,
        word_timestamps=True,
        language="en"
    )
    caption_words = []
    for segment in segments:
        if segment.words:
            for w in segment.words:
                clean_word = w.word.strip()
                if clean_word:
                    caption_words.append({
                        "word": clean_word,
                        "start": round(float(w.start), 2),
                        "end": round(float(w.end), 2)
                    })
    return caption_words

def main():
    parser = argparse.ArgumentParser(description="Local Faster-Whisper Subtitle Transcriber")
    parser.add_argument("--input", required=True, help="Input voice narration MP3/WAV audio path")
    parser.add_argument("--json", required=True, help="Output captions.json path")
    parser.add_argument("--srt", required=True, help="Output captions.srt path")
    args = parser.parse_args()

    audio_path = os.path.abspath(args.input)
    json_path = os.path.abspath(args.json)
    srt_path = os.path.abspath(args.srt)

    if not os.path.exists(audio_path):
        print(f"Error: Input audio file does not exist: {audio_path}")
        sys.exit(1)

    start_time = time.time()
    print("Loading large-v3...")

    model = None
    caption_words = None

    target_device = os.environ.get("WHISPER_DEVICE", "cuda")
    target_compute = os.environ.get("WHISPER_COMPUTE_TYPE", "float16")

    if target_device == "cuda":
        try:
            print("Attempting Faster-Whisper (large-v3, device='cuda', compute_type='float16')...")
            model = WhisperModel("large-v3", device="cuda", compute_type="float16")
            caption_words = run_transcription(audio_path, model)
        except Exception as cuda_err:
            print(f"CUDA execution warning: {cuda_err}")
            model = None

    if model is None or caption_words is None:
        print("Fallback: Initializing Faster-Whisper (large-v3, device='cpu', compute_type='int8')...")
        try:
            model = WhisperModel("large-v3", device="cpu", compute_type="int8")
            print("WhisperModel initialized successfully on CPU (int8)")
            caption_words = run_transcription(audio_path, model)
        except Exception as cpu_err:
            print(f"Error executing Faster-Whisper model on CPU: {cpu_err}")
            sys.exit(1)

    duration_sec = round(time.time() - start_time, 2)
    mem_mb = 0.0
    try:
        import psutil
        process = psutil.Process(os.getpid())
        mem_mb = round(process.memory_info().rss / (1024 * 1024), 1)
    except Exception:
        pass

    print(f"Word count: {len(caption_words)}")
    print(f"Processing time: {duration_sec}s")
    print(f"Memory usage: {mem_mb} MB")

    # Write captions.json
    os.makedirs(os.path.dirname(os.path.abspath(json_path)), exist_ok=True)
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({"words": caption_words}, f, indent=2)
    print(f"Captions generated: {json_path}")

    # Write captions.srt
    write_srt_file(caption_words, srt_path)
    print(f"SRT generated: {srt_path}")

    print("Finished successfully")

if __name__ == "__main__":
    main()
