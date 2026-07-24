import React, { useState, useEffect } from 'react';
import { AppSettings } from '../../backend/types';
import { Key, Sliders, Save, CheckCircle2, Mic } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>({
    finnhubApiKey: '',
    geminiApiKey: '',
    pexelsApiKey: '',
    whisperApiKey: '',
    kokoroVoice: 'am_michael',
    outputFolder: './workspace',
    videoQuality: '1080p',
    voice: 'am_michael',
    subtitleStyle: 'animated-highlight',
    theme: 'dark',
    watermarkText: 'AI Reel Factory',
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => setSettings(data))
      .catch((err) => console.error('Failed fetching settings:', err));
  }, []);

  const handleChange = (field: keyof AppSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch (err) {
      console.error('Failed saving settings:', err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="glass-panel rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-cyan-400" />
              Application & Service Configuration
            </h2>
            <p className="text-xs text-slate-400 mt-1">Configure your API credentials, voice profile, and output parameters.</p>
          </div>
          {saved && (
            <span className="text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4" /> Settings Saved!
            </span>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* API Keys */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2 mb-4">
              <Key className="w-4 h-4 text-indigo-400" /> API Keys & Access Tokens
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Finnhub API Key</label>
                <input
                  type="password"
                  value={settings.finnhubApiKey}
                  onChange={(e) => handleChange('finnhubApiKey', e.target.value)}
                  placeholder="Finnhub key..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Gemini API Key</label>
                <input
                  type="password"
                  value={settings.geminiApiKey}
                  onChange={(e) => handleChange('geminiApiKey', e.target.value)}
                  placeholder="Gemini key..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Pexels Video API Key</label>
                <input
                  type="password"
                  value={settings.pexelsApiKey}
                  onChange={(e) => handleChange('pexelsApiKey', e.target.value)}
                  placeholder="Pexels key..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Voice & Preferences */}
          <div className="pt-4 border-t border-slate-800">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <Mic className="w-4 h-4 text-cyan-400" /> Voice & Pipeline Preferences
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Kokoro Voice Profile</label>
                <select
                  value={settings.kokoroVoice}
                  onChange={(e) => { handleChange('kokoroVoice', e.target.value); handleChange('voice', e.target.value); }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  <option value="am_michael">🎙️ Michael (Male News Anchor - Default)</option>
                  <option value="af_bella">🎙️ Bella (Female Professional)</option>
                  <option value="am_adam">🎙️ Adam (Male Deep)</option>
                  <option value="bm_george">🎙️ George (British Male)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Output Folder</label>
                <input
                  type="text"
                  value={settings.outputFolder}
                  onChange={(e) => handleChange('outputFolder', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Video Resolution</label>
                <select
                  value={settings.videoQuality}
                  onChange={(e) => handleChange('videoQuality', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  <option value="1080p">1080x1920 (Full HD Vertical)</option>
                  <option value="720p">720x1280 (HD Vertical)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Subtitle Style</label>
                <select
                  value={settings.subtitleStyle}
                  onChange={(e) => handleChange('subtitleStyle', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  <option value="animated-highlight">Animated Word-by-Word Highlight</option>
                  <option value="classic-subtitle">Classic Bottom Subtitle</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Watermark / Brand Text</label>
                <input
                  type="text"
                  value={settings.watermarkText}
                  onChange={(e) => handleChange('watermarkText', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              type="submit"
              className="glow-button px-6 py-2.5 rounded-xl text-xs font-bold text-white flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
