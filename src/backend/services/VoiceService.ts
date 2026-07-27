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

  private async getExactAudioDuration(filePath: string): Promise<number> {
    try {
      const cmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath.replace(/\\/g, '/')}"`;
      const { stdout } = await execAsync(cmd, { timeout: 10000 });
      const parsed = parseFloat(stdout.trim());
      if (!isNaN(parsed) && parsed > 0) {
        return Math.ceil(parsed);
      }
    } catch (e) {}
    return 0;
  }

  private async applySpeedFilter(filePath: string, speedMultiplier: number = 1.15): Promise<void> {
    if (speedMultiplier <= 1.0) return;
    try {
      const tempSpeedPath = filePath.replace('.mp3', '_fast.mp3');
      const cmd = `ffmpeg -y -i "${filePath.replace(/\\/g, '/')}" -filter:a "atempo=${speedMultiplier}" "${tempSpeedPath.replace(/\\/g, '/')}"`;
      await execAsync(cmd, { timeout: 15000 });
      if (fs.existsSync(tempSpeedPath) && fs.statSync(tempSpeedPath).size > 1000) {
        fs.unlinkSync(filePath);
        fs.renameSync(tempSpeedPath, filePath);
      }
    } catch (e) {
      console.warn('Audio speed filter note:', e);
    }
  }

  public async generateVoiceElevenLabs(
    scriptText: string,
    outputMp3Path: string,
    voiceId: string = 'pNInz6obpgDQGcFmaJgB',
    apiKey?: string
  ): Promise<ServiceResult<{ audioPath: string; duration: number }>> {
    const key = apiKey || process.env.ELEVENLABS_API_KEY || '';
    if (!key) {
      return {
        success: false,
        retryable: false,
        errorMessage: 'ElevenLabs API Key is missing. Please enter your ElevenLabs API Key in Settings or the Voice menu.',
      };
    }

    try {
      console.log(`Generating ElevenLabs Cloud AI TTS (Voice ID: ${voiceId})...`);
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
      const response = await axios.post(
        url,
        {
          text: scriptText,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        },
        {
          headers: {
            'xi-api-key': key,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          responseType: 'arraybuffer',
          timeout: 45000,
        }
      );

      if (response.data) {
        fs.writeFileSync(outputMp3Path, Buffer.from(response.data));
        
        // Fast-paced narration speed boost (1.15x) for viral reel energy
        const speedBoost = parseFloat(process.env.TTS_SPEED || '1.15');
        if (speedBoost > 1.0) {
          await this.applySpeedFilter(outputMp3Path, speedBoost);
        }

        const exactDur = await this.getExactAudioDuration(outputMp3Path);
        const duration = exactDur || Math.max(12, Math.ceil(scriptText.split(' ').length / 3.2));
        console.log(`✅ ElevenLabs Fast-Paced Voice MP3 generated successfully (${fs.statSync(outputMp3Path).size} bytes, duration: ${duration}s)`);
        return {
          success: true,
          retryable: false,
          data: { audioPath: outputMp3Path, duration },
        };
      }
    } catch (err: any) {
      const msg = err.response?.data
        ? (Buffer.isBuffer(err.response.data) ? err.response.data.toString() : JSON.stringify(err.response.data))
        : err.message;
      console.error('ElevenLabs TTS Error:', msg);
      return {
        success: false,
        retryable: true,
        errorMessage: `ElevenLabs TTS failed: ${msg}`,
      };
    }

    return { success: false, retryable: true, errorMessage: 'ElevenLabs returned empty audio response' };
  }

  public async generateVoice(
    scriptText: string,
    outputMp3Path: string,
    voiceName: string = process.env.KOKORO_VOICE || 'am_michael',
    provider?: string,
    elevenLabsApiKey?: string,
    ttsSpeed?: number
  ): Promise<ServiceResult<{ audioPath: string; duration: number }>> {
    try {
      const dir = path.dirname(outputMp3Path);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const ttsEngine = provider || process.env.TTS_PROVIDER || 'kokoro';
      const speedVal = ttsSpeed || parseFloat(process.env.TTS_SPEED || '1.15');

      // 0. ElevenLabs Cloud AI TTS Engine (only if provider is explicitly set to elevenlabs)
      if (ttsEngine === 'elevenlabs') {
        const elVoice = (voiceName && !voiceName.startsWith('am_') && !voiceName.startsWith('af_') && !voiceName.startsWith('bm_') && !voiceName.startsWith('bf_'))
          ? voiceName
          : 'pNInz6obpgDQGcFmaJgB';
        const elRes = await this.generateVoiceElevenLabs(scriptText, outputMp3Path, elVoice, elevenLabsApiKey);
        if (elRes.success) return elRes;
        console.warn('ElevenLabs TTS failed or unconfigured, falling back to local Kokoro TTS:', elRes.errorMessage);
      }

      // 1. Kokoro Local Studio ONNX TTS Engine (Zero API Key / Zero Cost / Local Studio Quality)
      try {
        const pythonScript = path.resolve(process.cwd(), 'scripts/kokoro_tts.py');
        if (fs.existsSync(pythonScript)) {
          console.log(`Generating studio voice audio via Kokoro Local TTS (voice: ${voiceName}, speed: ${speedVal}x)...`);

          const tempTxtPath = path.join(dir, 'script_prompt.txt');
          fs.writeFileSync(tempTxtPath, scriptText, 'utf-8');

          const cmd = `python "${pythonScript.replace(/\\/g, '/')}" "${tempTxtPath.replace(/\\/g, '/')}" "${outputMp3Path.replace(/\\/g, '/')}" "${voiceName}" "${speedVal}"`;
          await execAsync(cmd, { timeout: 60000 });

          if (fs.existsSync(outputMp3Path) && fs.statSync(outputMp3Path).size > 1000) {
            const exactDur = await this.getExactAudioDuration(outputMp3Path);
            const duration = exactDur || Math.max(15, Math.ceil(scriptText.split(' ').length / 2.8));
            console.log(`✅ Real Kokoro Voice MP3 created successfully (${fs.statSync(outputMp3Path).size} bytes, exact audio duration: ${duration}s)`);
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
          const exactDur = await this.getExactAudioDuration(outputMp3Path);
          const duration = exactDur || Math.max(15, Math.ceil(scriptText.split(' ').length / 2.8));
          console.log(`✅ Google Synth Voice MP3 created successfully (${fs.statSync(outputMp3Path).size} bytes, exact audio duration: ${duration}s)`);
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
