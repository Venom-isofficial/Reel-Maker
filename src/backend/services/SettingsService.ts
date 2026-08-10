import fs from 'fs';
import path from 'path';
import { AppSettings } from '../types';

export class SettingsService {
  private configPath: string;

  constructor(configDir?: string) {
    const dir = path.resolve(process.cwd(), configDir || './config');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.configPath = path.join(dir, 'settings.json');
  }

  public getSettings(): AppSettings {
    if (fs.existsSync(this.configPath)) {
      try {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        return JSON.parse(content);
      } catch (err) {
        console.error('Error reading settings.json, falling back to defaults:', err);
      }
    }

    return {
      finnhubApiKey: process.env.FINNHUB_API_KEY || '',
      marketauxApiKey: process.env.MARKETAUX_API_KEY || 'HC2frmeEAmHQdKbR6xpzcfPgEc3yrkKfc2l47o2J',
      alphavantageApiKey: process.env.ALPHAVANTAGE_API_KEY || 'SFVEPBJN5VEQJD3E',
      benzingaApiKey: process.env.BENZINGA_API_KEY || 'bz.DAHUHM6A22IB6N2DBYBPSGEW5342FMLW',
      newsSource: process.env.NEWS_SOURCE || 'marketaux',
      geminiApiKey: process.env.GEMINI_API_KEY || '',
      pexelsApiKey: process.env.PEXELS_API_KEY || '',
      whisperApiKey: process.env.WHISPER_API_KEY || '',
      elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || '',
      muapiApiKey: process.env.MUAPI_API_KEY || '1bd8f8630d432391c79ba1acb6cf5510e648b228179ea4693523178aad6801e9',
      vadooApiKey: process.env.VADOO_API_KEY || '2GmLXthKf1MYmPX33jET1Izns06fUZlExpRoOJoa5BQ',
      ttsProvider: process.env.TTS_PROVIDER || 'kokoro',
      kokoroVoice: process.env.KOKORO_VOICE || 'am_michael',
      whisperDevice: process.env.WHISPER_DEVICE || 'cuda',
      whisperComputeType: process.env.WHISPER_COMPUTE_TYPE || 'float16',
      hardwareAcceleration: process.env.HARDWARE_ACCELERATION || 'nvenc',
      outputFolder: process.env.WORKSPACE_DIR || './workspace',
      videoQuality: process.env.OUTPUT_QUALITY || '1080p',
      voice: process.env.KOKORO_VOICE || 'am_michael',
      subtitleStyle: process.env.SUBTITLE_STYLE || 'animated-highlight',
      theme: 'dark',
      logoUrl: '',
      watermarkText: 'AI Reel Factory',
      bgMusicPath: '',
    };
  }

  public saveSettings(newSettings: Partial<AppSettings>): AppSettings {
    const current = this.getSettings();
    const updated: AppSettings = { ...current, ...newSettings };
    fs.writeFileSync(this.configPath, JSON.stringify(updated, null, 2), 'utf-8');
    
    // Also update process.env for runtime services
    if (updated.finnhubApiKey !== undefined) process.env.FINNHUB_API_KEY = updated.finnhubApiKey;
    if (updated.marketauxApiKey !== undefined) process.env.MARKETAUX_API_KEY = updated.marketauxApiKey;
    if (updated.alphavantageApiKey !== undefined) process.env.ALPHAVANTAGE_API_KEY = updated.alphavantageApiKey;
    if (updated.benzingaApiKey !== undefined) process.env.BENZINGA_API_KEY = updated.benzingaApiKey;
    if (updated.newsSource !== undefined) process.env.NEWS_SOURCE = updated.newsSource;
    if (updated.geminiApiKey !== undefined) process.env.GEMINI_API_KEY = updated.geminiApiKey;
    if (updated.pexelsApiKey !== undefined) process.env.PEXELS_API_KEY = updated.pexelsApiKey;
    if (updated.whisperApiKey !== undefined) process.env.WHISPER_API_KEY = updated.whisperApiKey;
    if (updated.elevenLabsApiKey !== undefined) process.env.ELEVENLABS_API_KEY = updated.elevenLabsApiKey;
    if (updated.ttsProvider !== undefined) process.env.TTS_PROVIDER = updated.ttsProvider;
    if (updated.whisperDevice !== undefined) process.env.WHISPER_DEVICE = updated.whisperDevice;
    if (updated.whisperComputeType !== undefined) process.env.WHISPER_COMPUTE_TYPE = updated.whisperComputeType;
    if (updated.hardwareAcceleration !== undefined) process.env.HARDWARE_ACCELERATION = updated.hardwareAcceleration;

    // Sync to .env file for persistence across server restarts
    try {
      const envPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        let envLines = fs.readFileSync(envPath, 'utf-8').split(/\r?\n/);
        let hasChanges = false;
        const updateEnvVar = (key: string, val: string) => {
          const idx = envLines.findIndex((line) => line.trim().startsWith(`${key}=`));
          if (idx >= 0) {
            if (envLines[idx] !== `${key}=${val}`) {
              envLines[idx] = `${key}=${val}`;
              hasChanges = true;
            }
          } else {
            envLines.push(`${key}=${val}`);
            hasChanges = true;
          }
        };
        if (updated.elevenLabsApiKey !== undefined) updateEnvVar('ELEVENLABS_API_KEY', updated.elevenLabsApiKey);
        if (updated.ttsProvider !== undefined) updateEnvVar('TTS_PROVIDER', updated.ttsProvider);
        if (updated.whisperDevice !== undefined) updateEnvVar('WHISPER_DEVICE', updated.whisperDevice);
        if (updated.whisperComputeType !== undefined) updateEnvVar('WHISPER_COMPUTE_TYPE', updated.whisperComputeType);
        if (updated.hardwareAcceleration !== undefined) updateEnvVar('HARDWARE_ACCELERATION', updated.hardwareAcceleration);
        if (hasChanges) {
          fs.writeFileSync(envPath, envLines.join('\n'), 'utf-8');
        }
      }
    } catch (envErr) {
      console.warn('Could not sync settings to .env file:', envErr);
    }

    return updated;
  }
}
