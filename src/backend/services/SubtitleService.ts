import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { CaptionData, CaptionWord, ServiceResult } from '../types';

const execAsync = promisify(exec);

export class SubtitleService {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.WHISPER_API_KEY || process.env.OPENAI_API_KEY || '';
  }

  public setApiKey(key: string) {
    this.apiKey = key;
  }

  private formatSrtTime(seconds: number): string {
    const pad = (num: number, size: number) => String(num).padStart(size, '0');
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);
    return `${pad(hrs, 2)}:${pad(mins, 2)}:${pad(secs, 2)},${pad(millis, 3)}`;
  }

  public writeSrtFile(words: CaptionWord[], srtFilePath: string) {
    const phrases: { text: string; start: number; end: number }[] = [];
    let currentPhrase: string[] = [];
    let phraseStart = 0;
    let phraseEnd = 0;

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (currentPhrase.length === 0) phraseStart = w.start;
      currentPhrase.push(w.word);
      phraseEnd = w.end;

      const isSentenceEnd = /[.?!]/.test(w.word);
      const isClauseEnd = /[:;,]/.test(w.word);
      const isMaxWords = currentPhrase.length >= 3;
      const isLast = i === words.length - 1;

      if (isSentenceEnd || isClauseEnd || isMaxWords || isLast) {
        phrases.push({
          text: currentPhrase.join(' ').toUpperCase(),
          start: phraseStart,
          end: phraseEnd
        });
        currentPhrase = [];
      }
    }

    const srtLines = phrases.map((p, idx) => {
      return `${idx + 1}\n${this.formatSrtTime(p.start)} --> ${this.formatSrtTime(p.end)}\n${p.text}\n`;
    });

    fs.writeFileSync(srtFilePath, srtLines.join('\n'), 'utf-8');
  }

  public writeAssFile(words: CaptionWord[], assFilePath: string) {
    const formatAssTime = (sec: number) => {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = Math.floor(sec % 60);
      const cs = Math.floor((sec % 1) * 100);
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
    };

    // Group words into 3-word chunks
    const MAX_WORDS = 3;
    const phrases: CaptionWord[][] = [];
    let current: CaptionWord[] = [];

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      current.push(w);
      const isEnd = /[.?!;,]/.test(w.word) || current.length >= MAX_WORDS || i === words.length - 1;
      if (isEnd) {
        phrases.push(current);
        current = [];
      }
    }

    const events: string[] = [];

    for (const chunk of phrases) {
      if (chunk.length === 0) continue;
      for (let idx = 0; idx < chunk.length; idx++) {
        const activeWord = chunk[idx];
        const nextWord = chunk[idx + 1];
        const start = activeWord.start;
        // Strictly prevent timestamp overlap so libass collision handler never stacks duplicate lines
        const end = nextWord ? Math.max(start + 0.1, nextWord.start - 0.02) : activeWord.end + 0.15;

        // Build line with active word in Soft Warm Yellow (\c&H08B3EA&) and inactive in White (\c&HFFFFFF&)
        const lineText = chunk
          .map((item, itemIdx) => {
            const clean = item.word.replace(/[.?!;,]/g, '').toUpperCase();
            if (itemIdx === idx) {
              return `{\\c&H08B3EA&}${clean}{\\c&HFFFFFF&}`;
            }
            return clean;
          })
          .join(' ');

        events.push(
          `Dialogue: 0,${formatAssTime(start)},${formatAssTime(end)},Default,,0,0,0,,${lineText}`
        );
      }
    }

    const assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Montserrat,34,&H00FFFFFF,&H0008B3EA,&H00000000,&H00000000,1,0,0,0,100,100,1,0,1,2.0,1.0,2,40,40,760,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.join('\n')}
`;

    fs.writeFileSync(assFilePath, assContent, 'utf-8');
  }

  private async getAudioDuration(filePath: string): Promise<number> {
    try {
      const cmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath.replace(/\\/g, '/')}"`;
      const { stdout } = await execAsync(cmd, { timeout: 10000 });
      const parsed = parseFloat(stdout.trim());
      if (!isNaN(parsed) && parsed > 0) return parsed;
    } catch (e) {}
    return 0;
  }

  public async generateCaptions(
    audioFilePath: string,
    scriptText: string,
    outputCaptionsPath: string
  ): Promise<ServiceResult<CaptionData>> {
    try {
      let finalWords: CaptionWord[] = [];
      let fullText = scriptText;

      const srtPath = path.join(path.dirname(outputCaptionsPath), 'captions.srt');

      // 1. Local Faster-Whisper Transcription Engine (python/subtitle/transcribe.py)
      if (fs.existsSync(audioFilePath)) {
        try {
          const scriptPath = path.resolve(process.cwd(), 'python/subtitle/transcribe.py');
          if (fs.existsSync(scriptPath)) {
            console.log('Running local Faster-Whisper (large-v3) transcription...');
            const cmd = `python "${scriptPath.replace(/\\/g, '/')}" --input "${audioFilePath.replace(/\\/g, '/')}" --json "${outputCaptionsPath.replace(/\\/g, '/')}" --srt "${srtPath.replace(/\\/g, '/')}"`;
            
            await execAsync(cmd, { 
              timeout: 180000,
              env: { ...process.env, PYTHONUNBUFFERED: '1' }
            });

            if (fs.existsSync(outputCaptionsPath)) {
              const data = JSON.parse(fs.readFileSync(outputCaptionsPath, 'utf-8'));
              if (data?.words && Array.isArray(data.words) && data.words.length > 0) {
                finalWords = data.words;
                console.log(`✅ Local Faster-Whisper (large-v3) Transcribed ${finalWords.length} words successfully!`);
              }
            }
          }
        } catch (fwErr: any) {
          console.warn("Local Faster-Whisper transcription warning, falling back to script alignment:", fwErr.message);
        }
      }

      // 2. Script Text Alignment Engine (Fallback)
      if (finalWords.length === 0) {
        console.log('Generating captions via script text timing alignment fallback...');
        const wordsList = scriptText.replace(/[^\w\s'$%-]/gi, '').split(/\s+/).filter(Boolean);
        const audioDur = (await this.getAudioDuration(audioFilePath)) || 30;
        
        // Calculate raw duration sum based on word lengths
        const rawDurations = wordsList.map((w) => Math.max(0.25, Math.min(0.7, w.length * 0.075)));
        const rawSum = rawDurations.reduce((a, b) => a + b, 0) + (wordsList.length * 0.08);
        
        // Proportional time scaling factor to stretch/compress words across full audio duration
        const scaleFactor = (audioDur - 0.5) / Math.max(1, rawSum);
        let currentTime = 0.2;

        for (let i = 0; i < wordsList.length; i++) {
          const word = wordsList[i];
          const duration = Math.max(0.2, rawDurations[i] * scaleFactor);
          const start = parseFloat(currentTime.toFixed(2));
          const end = parseFloat((currentTime + duration).toFixed(2));
          
          finalWords.push({ word, start, end });
          currentTime = parseFloat((end + (0.08 * scaleFactor)).toFixed(2));
        }

        const captionData: CaptionData = { fullText, words: finalWords };
        fs.writeFileSync(outputCaptionsPath, JSON.stringify(captionData, null, 2), 'utf-8');
        this.writeSrtFile(finalWords, srtPath);
      }

      // Always write clean 3-word chunked SRT and ASS files for subtitle burn-in fallbacks
      const assPath = path.join(path.dirname(outputCaptionsPath), 'captions.ass');
      this.writeSrtFile(finalWords, srtPath);
      this.writeAssFile(finalWords, assPath);

      const captionData: CaptionData = {
        fullText,
        words: finalWords,
      };

      return {
        success: true,
        retryable: false,
        data: captionData,
      };
    } catch (err: any) {
      return {
        success: false,
        retryable: true,
        errorMessage: `Subtitle generation failed: ${err.message}`,
      };
    }
  }
}
