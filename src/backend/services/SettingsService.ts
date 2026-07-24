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
      geminiApiKey: process.env.GEMINI_API_KEY || '',
      pexelsApiKey: process.env.PEXELS_API_KEY || '',
      whisperApiKey: process.env.WHISPER_API_KEY || '',
      kokoroVoice: process.env.KOKORO_VOICE || 'am_michael',
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
    if (updated.finnhubApiKey) process.env.FINNHUB_API_KEY = updated.finnhubApiKey;
    if (updated.geminiApiKey) process.env.GEMINI_API_KEY = updated.geminiApiKey;
    if (updated.pexelsApiKey) process.env.PEXELS_API_KEY = updated.pexelsApiKey;
    if (updated.whisperApiKey) process.env.WHISPER_API_KEY = updated.whisperApiKey;

    return updated;
  }
}
