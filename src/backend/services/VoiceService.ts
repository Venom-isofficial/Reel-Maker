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
    apiKey?: string,
    stability?: number,
    similarityBoost?: number,
    style?: number,
    useSpeakerBoost?: boolean,
    applyTextNormalization?: string,
    speed?: number
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
      console.log(`Generating ElevenLabs Cloud AI TTS (Voice ID: ${voiceId}, Speed: ${speed ?? 1.0}x, Stability: ${stability ?? 0.5}, Similarity: ${similarityBoost ?? 0.75}, Style: ${style ?? 0.0})...`);
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
      const response = await axios.post(
        url,
        {
          text: scriptText,
          model_id: 'eleven_multilingual_v2',
          apply_text_normalization: applyTextNormalization || 'auto',
          voice_settings: {
            stability: stability !== undefined ? stability : 0.5,
            similarity_boost: similarityBoost !== undefined ? similarityBoost : 0.75,
            style: style !== undefined ? style : 0.0,
            use_speaker_boost: useSpeakerBoost !== undefined ? useSpeakerBoost : true,
            speed: speed !== undefined ? speed : 1.0,
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
        
        // Apply optional additional speed filter if requested speed > 1.2
        if (speed && speed > 1.2) {
          await this.applySpeedFilter(outputMp3Path, speed / 1.2);
        }

        const exactDur = await this.getExactAudioDuration(outputMp3Path);
        const duration = exactDur || Math.max(12, Math.ceil(scriptText.split(' ').length / 3.2));
        console.log(`✅ ElevenLabs Voice MP3 generated successfully (${fs.statSync(outputMp3Path).size} bytes, duration: ${duration}s)`);
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
    ttsSpeed?: number,
    exaggeration?: number,
    cfgWeight?: number,
    temperature?: number,
    repetitionPenalty?: number,
    topP?: number,
    stability?: number,
    similarityBoost?: number,
    style?: number,
    useSpeakerBoost?: boolean,
    applyTextNormalization?: string
  ): Promise<ServiceResult<{ audioPath: string; duration: number }>> {
    try {
      const dir = path.dirname(outputMp3Path);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const ttsEngine = provider || process.env.TTS_PROVIDER || 'kokoro';
      const speedVal = ttsSpeed || parseFloat(process.env.TTS_SPEED || '1.15');

      // 0. ElevenLabs Cloud AI TTS Engine (only if provider is explicitly set to elevenlabs)
      if (ttsEngine === 'elevenlabs') {
        const elVoice = (voiceName && !voiceName.startsWith('am_') && !voiceName.startsWith('af_') && !voiceName.startsWith('bm_') && !voiceName.startsWith('bf_') && !voiceName.startsWith('en-'))
          ? voiceName
          : 'pNInz6obpgDQGcFmaJgB';
        const elRes = await this.generateVoiceElevenLabs(
          scriptText,
          outputMp3Path,
          elVoice,
          elevenLabsApiKey,
          stability,
          similarityBoost,
          style,
          useSpeakerBoost,
          applyTextNormalization,
          ttsSpeed
        );
        if (elRes.success) return elRes;
        console.warn('ElevenLabs TTS failed or unconfigured, falling back to local Chatterbox / Kokoro TTS:', elRes.errorMessage);
      }

      // 0b. Official Resemble AI Chatterbox 500M Local PyTorch TTS Engine
      if (ttsEngine === 'chatterbox') {
        try {
          console.log(`Generating local voice audio via Resemble AI Chatterbox 500M PyTorch Server (speed: ${speedVal}x, exaggeration: ${exaggeration ?? 0.5}, cfg: ${cfgWeight ?? 0.7}, temp: ${temperature ?? 0.8}, rep: ${repetitionPenalty ?? 1.2})...`);

          // Auto-start check: If Chatterbox server is offline, launch scripts/chatterbox_server.py
          let serverOnline = false;
          try {
            const healthRes = await axios.get('http://127.0.0.1:8002/health', { timeout: 2000 });
            if (healthRes.data && healthRes.data.status === 'online') serverOnline = true;
          } catch (e) {
            serverOnline = false;
          }

          if (!serverOnline) {
            console.log('⏳ Starting local Chatterbox 500M Model Server on http://127.0.0.1:8002...');
            const pyServerScript = path.resolve(process.cwd(), 'scripts/chatterbox_server.py');
            if (fs.existsSync(pyServerScript)) {
              execAsync(`python "${pyServerScript.replace(/\\/g, '/')}" --port 8002`);
              // Wait for server startup & model load
              await new Promise((r) => setTimeout(r, 6000));
            }
          }

          const response = await axios.post(
            'http://127.0.0.1:8002/synthesize',
            {
              text: scriptText,
              output_path: outputMp3Path,
              voice_preset: voiceName || 'default',
              cfg_weight: cfgWeight !== undefined ? cfgWeight : 0.7,
              exaggeration: exaggeration !== undefined ? exaggeration : 0.5,
              speed: speedVal,
              temperature: temperature !== undefined ? temperature : 0.8,
              repetition_penalty: repetitionPenalty !== undefined ? repetitionPenalty : 1.2,
              top_p: topP !== undefined ? topP : 1.0,
            },
            { timeout: 120000 }
          );

          if (fs.existsSync(outputMp3Path) && fs.statSync(outputMp3Path).size > 1000) {
            const exactDur = await this.getExactAudioDuration(outputMp3Path);
            const duration = exactDur || Math.max(12, Math.ceil(scriptText.split(' ').length / 3.2));
            console.log(`✅ Chatterbox 500M Local Voice MP3 created successfully (${fs.statSync(outputMp3Path).size} bytes, exact audio duration: ${duration}s)`);
            return {
              success: true,
              retryable: false,
              data: { audioPath: outputMp3Path, duration },
            };
          }
        } catch (cbErr: any) {
          console.warn('Official Chatterbox 500M TTS warning, falling back to Kokoro Local:', cbErr.message);
        }
      }

      // 1. Kokoro Local Studio ONNX TTS Engine (Zero API Key / Zero Cost / Local Studio Quality)
      try {
        const pythonScript = path.resolve(process.cwd(), 'scripts/kokoro_tts.py');
        if (fs.existsSync(pythonScript)) {
          const isMale = voiceName?.toLowerCase().includes('male') || voiceName?.toLowerCase().includes('anchor') || voiceName?.startsWith('custom') || voiceName === 'default';
          const targetKokoroVoice = (voiceName && !voiceName.startsWith('custom')) ? voiceName : (isMale ? 'am_adam' : 'af_heart');

          console.log(`Generating studio voice audio via Kokoro Local TTS (voice: ${targetKokoroVoice}, speed: ${speedVal}x)...`);

          const tempTxtPath = path.join(dir, 'script_prompt.txt');
          fs.writeFileSync(tempTxtPath, scriptText, 'utf-8');

          const cmd = `python "${pythonScript.replace(/\\/g, '/')}" "${tempTxtPath.replace(/\\/g, '/')}" "${outputMp3Path.replace(/\\/g, '/')}" "${targetKokoroVoice}" "${speedVal}"`;
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
