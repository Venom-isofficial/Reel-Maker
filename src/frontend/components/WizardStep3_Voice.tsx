import React, { useState, useEffect } from 'react';
import { ScriptOutput } from '../../backend/types';
import { Mic, Loader2, ArrowRight, ArrowLeft, RefreshCw, Edit3, Key, Play, Sparkles, CheckCircle2 } from 'lucide-react';

interface VoiceHistoryItem {
  id: number;
  fileName: string;
  audioUrl: string;
  provider: string;
  rawProvider: string;
  voiceName: string;
  voiceLabel: string;
  speed: number;
  exaggeration: number;
  cfgWeight: number;
  temperature?: number;
  repetitionPenalty?: number;
  topP?: number;
  duration: number;
  timestamp: string;
  active?: boolean;
}

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
  const [history, setHistory] = useState<VoiceHistoryItem[]>([]);
  
  // Provider: 'kokoro' | 'chatterbox' | 'elevenlabs'
  const [provider, setProvider] = useState<'kokoro' | 'chatterbox' | 'elevenlabs'>('chatterbox');
  const [kokoroVoice, setKokoroVoice] = useState('am_michael');
  const [chatterboxVoice, setChatterboxVoice] = useState('newsroom_anchor');
  const [elevenLabsVoice, setElevenLabsVoice] = useState('pNInz6obpgDQGcFmaJgB');
  const [customVoiceId, setCustomVoiceId] = useState('');
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState('');
  const [keySaved, setKeySaved] = useState(false);

  const [ttsSpeed, setTtsSpeed] = useState<number>(1.15);
  const [exaggeration, setExaggeration] = useState<number>(0.5);
  const [cfgWeight, setCfgWeight] = useState<number>(0.7);
  const [temperature, setTemperature] = useState<number>(0.80);
  const [repetitionPenalty, setRepetitionPenalty] = useState<number>(1.20);
  const [topP, setTopP] = useState<number>(1.00);

  const [stability, setStability] = useState<number>(0.50);
  const [similarityBoost, setSimilarityBoost] = useState<number>(0.75);
  const [style, setStyle] = useState<number>(0.00);
  const [useSpeakerBoost, setUseSpeakerBoost] = useState<boolean>(true);
  const [applyTextNormalization, setApplyTextNormalization] = useState<string>('auto');

  // Fetch saved settings and voice history on mount
  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.elevenLabsApiKey) setElevenLabsApiKey(data.elevenLabsApiKey);
      })
      .catch(() => {});

    fetch(`/api/wizard/step3-voice-history/${runId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.history) && data.history.length > 0) {
          setHistory(data.history);
          const active = data.history.find((h: any) => h.active) || data.history[0];
          setAudioUrl(active.audioUrl);
          setDuration(active.duration || 20);
        }
      })
      .catch(() => {});
  }, [runId]);

  const selectVoiceTake = async (takeId: number) => {
    try {
      const res = await fetch('/api/wizard/step3-select-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId, takeId }),
      });
      const data = await res.json();
      if (data.success) {
        setHistory(data.history);
        setAudioUrl(data.activeAudioUrl);
        if (data.activeItem?.duration) setDuration(data.activeItem.duration);
      }
    } catch (e) {
      console.error('Failed to select voice take:', e);
    }
  };

  const saveApiKeyToSettings = async () => {
    if (!elevenLabsApiKey.trim()) return;
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elevenLabsApiKey: elevenLabsApiKey.trim() }),
      });
      const data = await res.json();
      if (data.success) {
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
      const selectedVoice =
        provider === 'kokoro'
          ? kokoroVoice
          : provider === 'chatterbox'
          ? chatterboxVoice
          : elevenLabsVoice === 'custom'
          ? customVoiceId
          : elevenLabsVoice;

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
          exaggeration,
          cfgWeight,
          temperature,
          repetitionPenalty,
          topP,
          stability,
          similarityBoost,
          style,
          useSpeakerBoost,
          applyTextNormalization,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Voice generation failed');
      
      if (data.history) {
        setHistory(data.history);
      }
      setAudioUrl(data.audioUrl);
      setDuration(data.duration);
    } catch (err: any) {
      setError(err.message || 'Failed to generate voice');
    } finally {
      setLoading(false);
    }
  };

  const KOKORO_VOICES = [
    { value: 'am_michael', label: '🎙️ Michael (American Male News Anchor - Default)' },
    { value: 'af_heart', label: '🎙️ Heart (American Female Warm Narrator)' },
    { value: 'am_adam', label: '🎙️ Adam (American Male Deep Studio)' },
    { value: 'af_sarah', label: '🎙️ Sarah (American Female Professional)' },
    { value: 'am_echo', label: '🎙️ Echo (Male Clear Resonant)' },
    { value: 'am_eric', label: '🎙️ Eric (Male Authoritative)' },
    { value: 'am_fenrir', label: '🎙️ Fenrir (Male Intense Cinematic)' },
    { value: 'am_puck', label: '🎙️ Puck (Male Warm Conversational)' },
    { value: 'bm_george', label: '🎙️ George (British Male Financial)' },
    { value: 'bm_daniel', label: '🎙️ Daniel (British Male Deep)' },
    { value: 'af_bella', label: '🎙️ Bella (Female Dynamic)' },
  ];

  const CHATTERBOX_VOICES = [
    { value: 'custom1', label: '🎙️ Custom Profile 1 (Sample Audio Folder 1)' },
    { value: 'custom2', label: '🎙️ Custom Profile 2 (Sample Audio Folder 2)' },
    { value: 'default', label: '🎙️ Chatterbox 500M Master Voice (Default)' },
    { value: 'newsroom_anchor', label: '🎙️ Newsroom Male Anchor (Zero-Shot)' },
    { value: 'storyteller_expressive', label: '🎙️ Expressive Storyteller (Zero-Shot)' },
    { value: 'financial_analyst', label: '🎙️ Financial Analyst (Zero-Shot)' },
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
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-cyan-400">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Voice Narration Engine</h2>
              <p className="text-xs text-slate-400">Select studio voice synthesis engine & fine-tune speaking pace.</p>
            </div>
          </div>

          <button
            onClick={generateVoice}
            disabled={loading}
            className={`glow-button px-7 py-3 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 shadow-lg transition-all ${
              loading ? 'opacity-75 cursor-wait' : ''
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
                Synthesizing Audio...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                Generate Voice Audio
              </>
            )}
          </button>
        </div>

        {/* Provider Radio Selector Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-cyan-950 border border-cyan-700 text-cyan-400">
                FREE / LOCAL
              </span>
            </div>
            <p className="text-xs text-slate-400">Fast ONNX offline studio voice generation. Zero API keys required.</p>
          </button>

          <button
            type="button"
            onClick={() => setProvider('chatterbox')}
            className={`p-4 rounded-xl border text-left transition ${
              provider === 'chatterbox'
                ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" /> Chatterbox MAX
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300">
                NEURAL AI
              </span>
            </div>
            <p className="text-xs text-slate-400">Ultra-high fidelity neural studio voices with natural intonation.</p>
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
                CLOUD AI
              </span>
            </div>
            <p className="text-xs text-slate-400">Ultra-realistic AI voice synthesis powered by your ElevenLabs API Key.</p>
          </button>
        </div>

        {/* Engine Voice Settings Form */}
        {provider === 'kokoro' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">
                Kokoro Studio Voice Profile
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
              <input
                type="range"
                min="0.80"
                max="1.50"
                step="0.05"
                value={ttsSpeed}
                onChange={(e) => setTtsSpeed(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>
        ) : provider === 'chatterbox' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">
                  Chatterbox 500M Voice Profile
                </label>
                <select
                  value={chatterboxVoice}
                  onChange={(e) => setChatterboxVoice(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-medium"
                >
                  {CHATTERBOX_VOICES.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Speaking Speed
                  </label>
                  <span className="text-xs font-mono font-bold text-emerald-400">{ttsSpeed.toFixed(2)}x</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.80"
                    max="1.50"
                    step="0.05"
                    value={ttsSpeed}
                    onChange={(e) => setTtsSpeed(parseFloat(e.target.value))}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                  <input
                    type="number"
                    min="0.80"
                    max="1.50"
                    step="0.05"
                    value={ttsSpeed}
                    onChange={(e) => setTtsSpeed(parseFloat(e.target.value) || 1.15)}
                    className="w-16 bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-xs text-center font-mono text-emerald-300 font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-800/60">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Exaggeration
                  </label>
                  <span className="text-xs font-mono font-bold text-emerald-400">{exaggeration.toFixed(2)}</span>
                </div>
                <p className="text-[11px] text-amber-400/80 mb-2 font-medium">Neutral = 0.5, extreme values can be unstable</p>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.0"
                    max="1.5"
                    step="0.05"
                    value={exaggeration}
                    onChange={(e) => setExaggeration(parseFloat(e.target.value))}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                  <input
                    type="number"
                    min="0.0"
                    max="1.5"
                    step="0.05"
                    value={exaggeration}
                    onChange={(e) => setExaggeration(parseFloat(e.target.value) || 0.5)}
                    className="w-16 bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-xs text-center font-mono text-emerald-300 font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    CFG / Pace
                  </label>
                  <span className="text-xs font-mono font-bold text-emerald-400">{cfgWeight.toFixed(2)}</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-2 font-medium">Prompt adherence & pacing guidance strength</p>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.0"
                    max="2.0"
                    step="0.05"
                    value={cfgWeight}
                    onChange={(e) => setCfgWeight(parseFloat(e.target.value))}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                  <input
                    type="number"
                    min="0.0"
                    max="2.0"
                    step="0.05"
                    value={cfgWeight}
                    onChange={(e) => setCfgWeight(parseFloat(e.target.value) || 0.7)}
                    className="w-16 bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-xs text-center font-mono text-emerald-300 font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-800/60">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Temperature
                  </label>
                  <span className="text-xs font-mono font-bold text-emerald-400">{temperature.toFixed(2)}</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-2 font-medium">Pitch creativity & emotion (Default: 0.80)</p>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.10"
                    max="1.50"
                    step="0.05"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                  <input
                    type="number"
                    min="0.10"
                    max="1.50"
                    step="0.05"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value) || 0.8)}
                    className="w-16 bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-xs text-center font-mono text-emerald-300 font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Repetition Penalty
                  </label>
                  <span className="text-xs font-mono font-bold text-emerald-400">{repetitionPenalty.toFixed(2)}</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-2 font-medium">Prevents repeating phonemes (Default: 1.20)</p>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="1.00"
                    max="2.00"
                    step="0.05"
                    value={repetitionPenalty}
                    onChange={(e) => setRepetitionPenalty(parseFloat(e.target.value))}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                  <input
                    type="number"
                    min="1.00"
                    max="2.00"
                    step="0.05"
                    value={repetitionPenalty}
                    onChange={(e) => setRepetitionPenalty(parseFloat(e.target.value) || 1.2)}
                    className="w-16 bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-xs text-center font-mono text-emerald-300 font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Top P (Nucleus)
                  </label>
                  <span className="text-xs font-mono font-bold text-emerald-400">{topP.toFixed(2)}</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-2 font-medium">Token sampling cutoff (Default: 1.00)</p>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.10"
                    max="1.00"
                    step="0.05"
                    value={topP}
                    onChange={(e) => setTopP(parseFloat(e.target.value))}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                  <input
                    type="number"
                    min="0.10"
                    max="1.00"
                    step="0.05"
                    value={topP}
                    onChange={(e) => setTopP(parseFloat(e.target.value) || 1.0)}
                    className="w-16 bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-xs text-center font-mono text-emerald-300 font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">
                  ElevenLabs Voice Selection
                </label>
                <select
                  value={elevenLabsVoice}
                  onChange={(e) => setElevenLabsVoice(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium"
                >
                  {ELEVENLABS_VOICES.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">
                  API Key Configuration
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={elevenLabsApiKey}
                    onChange={(e) => setElevenLabsApiKey(e.target.value)}
                    placeholder="Paste ElevenLabs API Key..."
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={saveApiKeyToSettings}
                    className="px-3 py-2.5 bg-indigo-950 border border-indigo-700 text-indigo-300 rounded-xl text-xs font-semibold hover:bg-indigo-900 transition flex items-center gap-1"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>

            {/* 6 ElevenLabs Parameters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-800/60">
              {/* 1. Speaking Speed */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Speaking Speed
                  </label>
                  <span className="text-xs font-mono font-bold text-indigo-400">{ttsSpeed.toFixed(2)}x</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-2 font-medium">ElevenLabs direct speaking speed (0.70x to 1.20x)</p>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.70"
                    max="1.20"
                    step="0.05"
                    value={ttsSpeed}
                    onChange={(e) => setTtsSpeed(parseFloat(e.target.value))}
                    className="w-full accent-indigo-400 cursor-pointer"
                  />
                  <input
                    type="number"
                    min="0.70"
                    max="1.20"
                    step="0.05"
                    value={ttsSpeed}
                    onChange={(e) => setTtsSpeed(parseFloat(e.target.value) || 1.0)}
                    className="w-16 bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-xs text-center font-mono text-indigo-300 font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* 2. Stability */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Stability
                  </label>
                  <span className="text-xs font-mono font-bold text-indigo-400">{stability.toFixed(2)}</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-2 font-medium">Lower = expressive & emotion; Higher = monotone stability</p>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.00"
                    max="1.00"
                    step="0.05"
                    value={stability}
                    onChange={(e) => setStability(parseFloat(e.target.value))}
                    className="w-full accent-indigo-400 cursor-pointer"
                  />
                  <input
                    type="number"
                    min="0.00"
                    max="1.00"
                    step="0.05"
                    value={stability}
                    onChange={(e) => setStability(parseFloat(e.target.value) || 0.5)}
                    className="w-16 bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-xs text-center font-mono text-indigo-300 font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* 3. Similarity Boost */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Clarity / Similarity
                  </label>
                  <span className="text-xs font-mono font-bold text-indigo-400">{similarityBoost.toFixed(2)}</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-2 font-medium">Higher = tighter match to speaker vocal timbre</p>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.00"
                    max="1.00"
                    step="0.05"
                    value={similarityBoost}
                    onChange={(e) => setSimilarityBoost(parseFloat(e.target.value))}
                    className="w-full accent-indigo-400 cursor-pointer"
                  />
                  <input
                    type="number"
                    min="0.00"
                    max="1.00"
                    step="0.05"
                    value={similarityBoost}
                    onChange={(e) => setSimilarityBoost(parseFloat(e.target.value) || 0.75)}
                    className="w-16 bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-xs text-center font-mono text-indigo-300 font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-800/60">
              {/* 4. Style Exaggeration */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Style Exaggeration
                  </label>
                  <span className="text-xs font-mono font-bold text-indigo-400">{style.toFixed(2)}</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-2 font-medium">Amplifies speaker emotional energy & style</p>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.00"
                    max="1.00"
                    step="0.05"
                    value={style}
                    onChange={(e) => setStyle(parseFloat(e.target.value))}
                    className="w-full accent-indigo-400 cursor-pointer"
                  />
                  <input
                    type="number"
                    min="0.00"
                    max="1.00"
                    step="0.05"
                    value={style}
                    onChange={(e) => setStyle(parseFloat(e.target.value) || 0.0)}
                    className="w-16 bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-xs text-center font-mono text-indigo-300 font-bold focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* 5. Speaker Boost */}
              <div>
                <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
                  Speaker Boost
                </label>
                <p className="text-[11px] text-slate-400 mb-2 font-medium">Enhances similarity & vocal presence</p>
                <button
                  type="button"
                  onClick={() => setUseSpeakerBoost(!useSpeakerBoost)}
                  className={`w-full py-2.5 rounded-xl border text-xs font-bold font-mono transition flex items-center justify-center gap-2 ${
                    useSpeakerBoost
                      ? 'bg-indigo-950/80 border-indigo-500 text-indigo-300'
                      : 'bg-slate-950/80 border-slate-800 text-slate-500'
                  }`}
                >
                  {useSpeakerBoost ? 'ENABLED (TRUE)' : 'DISABLED (FALSE)'}
                </button>
              </div>

              {/* 6. Text Normalization */}
              <div>
                <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
                  Text Normalization
                </label>
                <p className="text-[11px] text-slate-400 mb-2 font-medium">Auto-expands numbers, dates & symbols</p>
                <select
                  value={applyTextNormalization}
                  onChange={(e) => setApplyTextNormalization(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-indigo-300 font-mono font-bold focus:outline-none focus:border-indigo-500"
                >
                  <option value="auto">Auto (Default)</option>
                  <option value="on">Always On</option>
                  <option value="off">Off (Raw Text)</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Voice Generated History Stack Window */}
      {history && history.length > 0 && (
        <div className="glass-panel rounded-2xl p-5 border border-emerald-500/30 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                Voice Generated Successfully ({history.length} Take{history.length > 1 ? 's' : ''})
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
              Active Take: #{history.find((h) => h.active)?.id || history[0].id}
            </span>
          </div>

          {/* Stack list of generated audio takes, latest at top */}
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
            {history.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-xl border transition ${
                  item.active
                    ? 'bg-emerald-950/30 border-emerald-500/70 shadow-md shadow-emerald-500/10'
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* 1-Line Details Header */}
                <div className="flex items-center justify-between gap-2 mb-2 text-xs font-mono">
                  <span className="text-emerald-300 font-bold tracking-tight">
                    {item.id} - {item.provider}/{item.voiceLabel}/speakingspeed({item.speed})/Exaggeration ({item.exaggeration.toFixed(2)})/CFG ({item.cfgWeight.toFixed(2)}){item.temperature !== undefined ? `/Temp (${item.temperature.toFixed(2)})` : ''}{item.repetitionPenalty !== undefined ? `/RepPenalty (${item.repetitionPenalty.toFixed(2)})` : ''}
                  </span>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.active ? (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Active Choice
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => selectVoiceTake(item.id)}
                        className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 hover:border-emerald-500 hover:text-white transition"
                      >
                        Set Active
                      </button>
                    )}
                  </div>
                </div>

                {/* Audio Bar for this Take */}
                <div className="bg-slate-900/90 rounded-lg p-2.5 border border-slate-800/80">
                  <audio controls className="w-full h-9" key={item.audioUrl}>
                    <source src={item.audioUrl} type="audio/mpeg" />
                  </audio>
                </div>
              </div>
            ))}
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
