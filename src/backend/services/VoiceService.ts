import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ServiceResult } from '../types';

const execAsync = promisify(exec);

export class VoiceService {
  private openAiKey: string;
  private geminiKey: string;

  constructor(geminiKey?: string, openAiKey?: string) {
    this.geminiKey = geminiKey || process.env.GEMINI_API_KEY || '';
    this.openAiKey = openAiKey || process.env.WHISPER_API_KEY || process.env.OPENAI_API_KEY || '';
  }

  public setApiKey(key: string) {
    if (key.startsWith('sk-')) {
      this.openAiKey = key;
    } else {
      this.geminiKey = key;
    }
  }

  public async generateVoice(
    scriptText: string,
    outputMp3Path: string,
    voiceName: string = process.env.KOKORO_VOICE || 'am_michael'
  ): Promise<ServiceResult<{ audioPath: string; duration: number }>> {
    try {
      const dir = path.dirname(outputMp3Path);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      // 1. Kokoro Local Studio ONNX TTS Engine (Zero API Key / Zero Cost / Local Studio Quality)
      try {
        const pythonScript = path.resolve(process.cwd(), 'scripts/kokoro_tts.py');
        if (fs.existsSync(pythonScript)) {
          console.log(`Generating studio voice audio via Kokoro Local TTS (voice: ${voiceName})...`);

          const tempTxtPath = path.join(dir, 'script_prompt.txt');
          fs.writeFileSync(tempTxtPath, scriptText, 'utf-8');

          const cmd = `python "${pythonScript.replace(/\\/g, '/')}" "${tempTxtPath.replace(/\\/g, '/')}" "${outputMp3Path.replace(/\\/g, '/')}" "${voiceName}"`;
          await execAsync(cmd, { timeout: 60000 });

          if (fs.existsSync(outputMp3Path) && fs.statSync(outputMp3Path).size > 1000) {
            const duration = Math.max(15, Math.ceil(scriptText.split(' ').length / 2.8));
            console.log(`✅ Real Kokoro Voice MP3 created successfully (${fs.statSync(outputMp3Path).size} bytes)`);
            return {
              success: true,
              retryable: false,
              data: { audioPath: outputMp3Path, duration },
            };
          }
        }
      } catch (kokoroErr: any) {
        console.warn('Kokoro Local TTS warning, switching to Google Voice Synth:', kokoroErr.message);
      }

      // 2. Google Synthesize Audio Engine (Fallback)
      try {
        console.log('Generating real voice audio via Google Voice Synth...');
        const cleanScript = scriptText.replace(/[^\w\s.,!?-]/g, '');
        const chunks = cleanScript.match(/[^.!?]+[.!?]+/g) || [cleanScript];
        const audioBuffers: Buffer[] = [];

        for (const chunk of chunks) {
          const text = chunk.trim().substring(0, 180);
          if (!text) continue;
          const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=en&client=tw-ob`;
          const res = await axios.get(googleUrl, {
            responseType: 'arraybuffer',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            },
            timeout: 15000,
          });
          if (res.data) {
            audioBuffers.push(Buffer.from(res.data));
          }
        }

        if (audioBuffers.length > 0) {
          const concatenatedAudio = Buffer.concat(audioBuffers);
          fs.writeFileSync(outputMp3Path, concatenatedAudio);
          const duration = Math.max(15, Math.ceil(scriptText.split(' ').length / 2.8));
          console.log(`✅ Google Synth Voice MP3 created successfully (${fs.statSync(outputMp3Path).size} bytes)`);
          return {
            success: true,
            retryable: false,
            data: { audioPath: outputMp3Path, duration },
          };
        }
      } catch (googleErr: any) {
        console.error('Google Voice Synth Error:', googleErr.message);
      }

      return {
        success: false,
        retryable: true,
        errorMessage: 'Failed to generate voice narration audio via Kokoro TTS and Google Synth.',
      };
    } catch (err: any) {
      return {
        success: false,
        retryable: true,
        errorMessage: `Voice generation error: ${err.message}`,
      };
    }
  }
}
