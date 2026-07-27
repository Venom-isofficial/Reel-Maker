import React, { useState, useEffect } from 'react';
import { ScriptOutput } from '../../backend/types';
import { Mic, Loader2, ArrowRight, ArrowLeft, RefreshCw, Edit3, Key, Play, Sparkles, CheckCircle2 } from 'lucide-react';

interface Props {
  script: ScriptOutput;
  runId: string;
  onComplete: () => void;
  onBack: () => void;
}

export const WizardStep3_Voice: React.FC<Props> = ({ script, runId, onComplete, onBack }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [editedText, setEditedText] = useState(script.fullScript);
  
  // Provider: 'kokoro' | 'elevenlabs'
  const [provider, setProvider] = useState<'kokoro' | 'elevenlabs'>('kokoro');
  const [kokoroVoice, setKokoroVoice] = useState('am_michael');
  const [elevenLabsVoice, setElevenLabsVoice] = useState('pNInz6obpgDQGcFmaJgB');
  const [customVoiceId, setCustomVoiceId] = useState('');
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState('');
  const [keySaved, setKeySaved] = useState(false);

  const [ttsSpeed, setTtsSpeed] = useState<number>(1.15);

  // Fetch saved settings on mount to pre-fill API keys & default voice
  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.elevenLabsApiKey) setElevenLabsApiKey(data.elevenLabsApiKey);
        if (data.ttsProvider) setProvider(data.ttsProvider as 'kokoro' | 'elevenlabs');
        if (data.kokoroVoice) setKokoroVoice(data.kokoroVoice);
      })
      .catch((err) => console.warn('Could not load settings:', err));
  }, []);

  const handleSaveApiKey = async () => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elevenLabsApiKey, ttsProvider: provider, kokoroVoice }),
      });
      if (res.ok) {
        setKeySaved(true);
        setTimeout(() => setKeySaved(false), 2500);
      }
    } catch (e) {
      console.error('Failed saving API key to .env:', e);
    }
  };

  const generateVoice = async () => {
    setLoading(true);
    setError(null);
    try {
      const selectedVoice = provider === 'elevenlabs' 
        ? (elevenLabsVoice === 'custom' ? customVoiceId.trim() : elevenLabsVoice)
        : kokoroVoice;

      if (provider === 'elevenlabs' && (!elevenLabsApiKey || elevenLabsApiKey.trim().length < 5)) {
        throw new Error('Please enter a valid ElevenLabs API Key.');
      }

      const res = await fetch('/api/wizard/step3-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptText: editedText,
          runId,
          voiceName: selectedVoice,
          provider,
          elevenLabsApiKey,
          ttsSpeed,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Voice generation failed');
      setAudioUrl(data.audioUrl + `?t=${Date.now()}`);
      setDuration(data.duration);
    } catch (err: any) {
      const msg = err.message === 'Failed to fetch' 
        ? 'Server connection interrupted. Please click Start Generation again.' 
        : err.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const KOKORO_VOICES = [
    { value: 'am_adam', label: '🎙️ Adam (Male Deep - High Energy)' },
    { value: 'am_michael', label: '🎙️ Michael (Male News Anchor - Default)' },
    { value: 'am_echo', label: '🎙️ Echo (Male Smooth & Crisp)' },
    { value: 'am_eric', label: '🎙️ Eric (Male Energetic)' },
    { value: 'am_fenrir', label: '🎙️ Fenrir (Male Intense Deep)' },
    { value: 'am_liam', label: '🎙️ Liam (Male Friendly & Warm)' },
    { value: 'am_onyx', label: '🎙️ Onyx (Male Deep Resonant)' },
    { value: 'bm_george', label: '🎙️ George (British Male Financial)' },
    { value: 'bm_daniel', label: '🎙️ Daniel (British Male Deep)' },
    { value: 'af_bella', label: '🎙️ Bella (Female Dynamic)' },
    { value: 'af_nicole', label: '🎙️ Nicole (Female Professional)' },
    { value: 'bf_emma', label: '🎙️ Emma (British Female Storyteller)' },
  ];

  const ELEVENLABS_VOICES = [
    { value: 'pNInz6obpgDQGcFmaJgB', label: '🎙️ Adam (Male Deep & Engaging - Default)' },
    { value: 'onwK4e9ZLuTAKqWW03F9', label: '🎙️ Michael (News & Media Anchor)' },
    { value: '21m00Tcm4TlvDq8ikWAM', label: '🎙️ Rachel (Calm & Professional)' },
    { value: 'ErXwobaYiN019PkySvjV', label: '🎙️ Antoni (Expressive)' },
    { value: 'TxGEqnHWrfWFTfGW9XjX', label: '🎙️ Josh (Deep & Warm)' },
    { value: 'VR6AewLTigWG4xVOgG7A', label: '🎙️ Arnold (Crisp Narration)' },
    { value: 'EXAVITQu4vr4xnSDxMaL', label: '🎙️ Bella (Energetic)' },
    { value: 'custom', label: '✏️ Enter Custom Voice ID...' },
  ];

  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-rose-950/40 border border-rose-800/50 rounded-xl px-4 py-3 text-rose-300 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Engine Selection & Start Button Bar */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-500 p-0.5 shadow-md shadow-cyan-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Mic className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Voice Narration Studio</h2>
              <p className="text-xs text-slate-400">Choose TTS Engine, configure voice options, then click Start Generation</p>
            </div>
          </div>

          {/* Start Generation Button */}
          <button
            onClick={generateVoice}
            disabled={loading}
            className={`glow-button px-6 py-3 rounded-xl text-sm font-bold text-white flex items-center gap-2 transition ${
              loading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
                Generating Audio...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current text-cyan-300" />
                Start Generation
              </>
            )}
          </button>
        </div>

        {/* Provider Toggle Tabs */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <button
            type="button"
            onClick={() => setProvider('kokoro')}
            className={`p-4 rounded-xl border text-left transition ${
              provider === 'kokoro'
                ? 'bg-cyan-950/40 border-cyan-500 text-white shadow-lg shadow-cyan-500/10'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" /> Kokoro Local TTS
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-400">
                Free / Local
              </span>
            </div>
            <p className="text-xs text-slate-400">Fast ONNX offline studio voice generation. Zero API keys required.</p>
          </button>

          <button
            type="button"
            onClick={() => setProvider('elevenlabs')}
            className={`p-4 rounded-xl border text-left transition ${
              provider === 'elevenlabs'
                ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-lg shadow-indigo-500/10'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold flex items-center gap-2">
                <Mic className="w-4 h-4 text-indigo-400" /> ElevenLabs API
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-950 border border-indigo-700 text-indigo-300">
                Cloud AI
              </span>
            </div>
            <p className="text-xs text-slate-400">Ultra-realistic AI voice synthesis powered by your ElevenLabs API Key.</p>
          </button>
        </div>

        {/* Dynamic Options depending on Provider */}
        {provider === 'kokoro' ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">
                Kokoro Voice Profile
              </label>
              <select
                value={kokoroVoice}
                onChange={(e) => setKokoroVoice(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 font-medium"
              >
                {KOKORO_VOICES.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  Speaking Speed
                </label>
                <span className="text-xs font-mono font-bold text-cyan-400">{ttsSpeed.toFixed(2)}x</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.80"
                  max="1.50"
                  step="0.05"
                  value={ttsSpeed}
                  onChange={(e) => setTtsSpeed(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
                <input
                  type="number"
                  min="0.80"
                  max="1.50"
                  step="0.05"
                  value={ttsSpeed}
                  onChange={(e) => setTtsSpeed(parseFloat(e.target.value) || 1.15)}
                  className="w-16 bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-xs text-center font-mono text-cyan-300 font-bold focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">
                  ElevenLabs Voice Profile
                </label>
                <select
                  value={elevenLabsVoice}
                  onChange={(e) => setElevenLabsVoice(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  {ELEVENLABS_VOICES.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-400" /> ElevenLabs API Key
                  </label>
                  {keySaved && (
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Saved to .env
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={elevenLabsApiKey}
                    onChange={(e) => setElevenLabsApiKey(e.target.value)}
                    placeholder="sk_..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleSaveApiKey}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>

            {elevenLabsVoice === 'custom' && (
              <div>
                <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
                  Custom ElevenLabs Voice ID
                </label>
                <input
                  type="text"
                  value={customVoiceId}
                  onChange={(e) => setCustomVoiceId(e.target.value)}
                  placeholder="e.g. 21m00Tcm4TlvDq8ikWAM"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Audio Player (rendered once generated) */}
      {audioUrl && (
        <div className="glass-panel rounded-2xl p-5 border border-cyan-500/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                Voice Generated Successfully ({duration}s)
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              Provider: {provider === 'elevenlabs' ? 'ElevenLabs API' : 'Kokoro Local'}
            </span>
          </div>

          <div className="bg-slate-950/90 rounded-xl p-4 border border-slate-800">
            <audio controls className="w-full" key={audioUrl}>
              <source src={audioUrl} type="audio/mpeg" />
            </audio>
          </div>
        </div>
      )}

      {/* Editable Narration Text */}
      <div className="glass-panel rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-amber-400" /> Narration Script Text
          </h3>
          <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
            Edit text then click Start Generation above
          </span>
        </div>
        <textarea
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
          rows={5}
          className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 leading-relaxed focus:outline-none focus:border-cyan-500 resize-y"
        />
        <div className="flex items-center justify-between mt-3">
          <p className="text-[10px] text-slate-500">{editedText.split(' ').length} words</p>
          <button
            onClick={generateVoice}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-600/40 flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Regenerate Voice
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 border border-slate-800 hover:bg-slate-900/50 flex items-center gap-2 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Scenes
        </button>
        <button
          onClick={onComplete}
          disabled={!audioUrl || loading}
          className={`glow-button px-7 py-3.5 rounded-2xl text-sm font-bold text-white flex items-center gap-2.5 ${
            !audioUrl || loading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          Next: Generate Clips <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
