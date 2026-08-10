import React, { useState, useEffect, useRef } from 'react';
import { ScriptOutput } from '../../backend/types';
import { Mic, Loader2, ArrowRight, ArrowLeft, RefreshCw, Edit3, Key, Play, Sparkles, CheckCircle2, Upload, Folder, Music, Check, Clock, Volume2, Star } from 'lucide-react';

interface Props {
  script: ScriptOutput;
  runId: string;
  onComplete: () => void;
  onBack: () => void;
}

export interface VoiceTake {
  id: string;
  takeNumber: number;
  audioUrl: string;
  takeFileName?: string;
  duration: number;
  provider: string;
  voiceName: string;
  params: {
    speed: number;
    exaggeration?: number;
    cfgWeight?: number;
  };
  timestamp: string;
  isUploaded?: boolean;
  fileName?: string;
}

export const WizardStep3_Voice: React.FC<Props> = ({ script, runId, onComplete, onBack }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [editedText, setEditedText] = useState(script.fullScript);

  // Takes Stack & Upload
  const [takes, setTakes] = useState<VoiceTake[]>([]);
  const [activeTakeId, setActiveTakeId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Provider: 'kokoro' | 'chatterbox' | 'chatterbox_vox2' | 'elevenlabs'
  const [provider, setProvider] = useState<'kokoro' | 'chatterbox' | 'chatterbox_vox2' | 'elevenlabs'>('kokoro');
  const [kokoroVoice, setKokoroVoice] = useState('am_michael');
  const [chatterboxVoice, setChatterboxVoice] = useState('custom1');
  const [chatterboxVox2Voice, setChatterboxVox2Voice] = useState('vox_Benedict_Cumberbatch_male');
  const [elevenLabsVoice, setElevenLabsVoice] = useState('pNInz6obpgDQGcFmaJgB');
  const [customVoiceId, setCustomVoiceId] = useState('');
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState('');
  const [keySaved, setKeySaved] = useState(false);

  const [ttsSpeed, setTtsSpeed] = useState<number>(1.15);
  const [exaggeration, setExaggeration] = useState<number>(0.5);
  const [cfgWeight, setCfgWeight] = useState<number>(0.7);
  const [dynamicChatterboxVoices, setDynamicChatterboxVoices] = useState<{ value: string; label: string }[]>([]);
  const [dynamicVox2Voices, setDynamicVox2Voices] = useState<{ value: string; label: string }[]>([]);
  const [vox1SearchQuery, setVox1SearchQuery] = useState('');
  const [vox2SearchQuery, setVox2SearchQuery] = useState('');

  // Calibrated Studio Audio Tuning Toggle Switch (OFF by default as requested!)
  const [calibratedTuning, setCalibratedTuning] = useState<boolean>(false);

  // Favorite / Starred Voices System (Alex Kingston starred by default!)
  const [starredVoiceIds, setStarredVoiceIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('chatterbox_starred_voices');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return ['vox_Alex_Kingston_female'];
  });

  const toggleStarVoice = (voiceId: string) => {
    if (!voiceId) return;
    setStarredVoiceIds((prev) => {
      const next = prev.includes(voiceId) ? prev.filter((id) => id !== voiceId) : [...prev, voiceId];
      try {
        localStorage.setItem('chatterbox_starred_voices', JSON.stringify(next));
        fetch('/api/chatterbox/starred-voices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ starredVoices: next }),
        }).catch(() => {});
      } catch (e) {}
      return next;
    });
  };

  // Fetch saved settings, permanently saved starred voices, Chatterbox Vox1 and Vox2 custom voices on mount
  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.elevenLabsApiKey) setElevenLabsApiKey(data.elevenLabsApiKey);
      })
      .catch(() => { });

    fetch('/api/chatterbox/starred-voices')
      .then((r) => r.json())
      .then((data) => {
        if (data.starredVoices && Array.isArray(data.starredVoices) && data.starredVoices.length > 0) {
          setStarredVoiceIds(data.starredVoices);
        }
      })
      .catch(() => { });

    fetch('/api/chatterbox/custom-voices')
      .then((r) => r.json())
      .then((data) => {
        if (data.voices && Array.isArray(data.voices)) {
          setDynamicChatterboxVoices(data.voices);
          if (data.voices.length > 0) {
            setChatterboxVoice(data.voices[0].value);
          }
        }
      })
      .catch(() => { });

    fetch('/api/chatterbox/vox2-voices')
      .then((r) => r.json())
      .then((data) => {
        if (data.voices && Array.isArray(data.voices)) {
          setDynamicVox2Voices(data.voices);
          if (data.voices.length > 0) {
            setChatterboxVox2Voice(data.voices[0].value);
          }
        }
      })
      .catch(() => { });
  }, []);

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

  const selectTake = async (take: VoiceTake) => {
    try {
      if (take.takeFileName) {
        await fetch('/api/wizard/step3-select-take', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ runId, takeFileName: take.takeFileName }),
        });
      }
      setActiveTakeId(take.id);
      setAudioUrl(take.audioUrl);
      setDuration(take.duration);
    } catch (e) {
      console.error('Failed selecting take:', e);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          const res = await fetch('/api/wizard/step3-upload-voice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              runId,
              fileData: base64Data,
              originalName: file.name,
            }),
          });
          const data = await res.json();
          if (!data.success) throw new Error(data.message || 'Failed uploading voice audio file');

          const newTakeNumber = data.takeNumber || (takes.length + 1);
          const newTake: VoiceTake = {
            id: `take_${newTakeNumber}_${Date.now()}`,
            takeNumber: newTakeNumber,
            audioUrl: data.audioUrl,
            takeFileName: `take_${String(newTakeNumber).padStart(2, '0')}.mp3`,
            duration: data.duration,
            provider: 'Uploaded File',
            voiceName: file.name,
            params: { speed: 1.0 },
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isUploaded: true,
            fileName: file.name,
          };

          setTakes((prev) => [newTake, ...prev]);
          setActiveTakeId(newTake.id);
          setAudioUrl(data.audioUrl);
          setDuration(data.duration);
        } catch (err: any) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const generateVoice = async () => {
    setLoading(true);
    setError(null);
    try {
      const selectedVoice = provider === 'elevenlabs'
        ? (elevenLabsVoice === 'custom' ? customVoiceId.trim() : elevenLabsVoice)
        : provider === 'chatterbox_vox2'
          ? chatterboxVox2Voice
          : provider === 'chatterbox'
            ? chatterboxVoice
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
          provider: provider === 'chatterbox_vox2' ? 'chatterbox' : provider,
          elevenLabsApiKey,
          ttsSpeed,
          exaggeration: (provider === 'chatterbox' || provider === 'chatterbox_vox2') && calibratedTuning ? 0.45 : exaggeration,
          cfgWeight: (provider === 'chatterbox' || provider === 'chatterbox_vox2') && calibratedTuning ? 0.70 : cfgWeight,
          calibratedTuning,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Voice generation failed');

      const actualProviderLabel = provider === 'chatterbox_vox2'
        ? 'Chatterbox Vox2 (HD)'
        : data.provider === 'chatterbox'
          ? 'Chatterbox MAX (Vox1)'
          : data.provider === 'elevenlabs'
            ? 'ElevenLabs API'
            : 'Kokoro Local';

      const newTakeNumber = data.takeNumber || (takes.length + 1);
      const newTake: VoiceTake = {
        id: `take_${newTakeNumber}_${Date.now()}`,
        takeNumber: newTakeNumber,
        audioUrl: data.audioUrl,
        takeFileName: `take_${String(newTakeNumber).padStart(2, '0')}.mp3`,
        duration: data.duration,
        provider: actualProviderLabel,
        voiceName: selectedVoice,
        params: {
          speed: ttsSpeed,
          exaggeration: provider === 'chatterbox' ? exaggeration : undefined,
          cfgWeight: provider === 'chatterbox' ? cfgWeight : undefined,
        },
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setTakes((prev) => [newTake, ...prev]);
      setActiveTakeId(newTake.id);
      setAudioUrl(data.audioUrl);
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
    { value: 'am_fenrir', label: '🎙️ Fenrir (Male Intense Cinematic)' },
    { value: 'am_puck', label: '🎙️ Puck (Male Warm Conversational)' },
    { value: 'bm_george', label: '🎙️ George (British Male Financial)' },
    { value: 'bm_daniel', label: '🎙️ Daniel (British Male Deep)' },
    { value: 'af_bella', label: '🎙️ Bella (Female Dynamic)' },
    { value: 'af_nicole', label: '🎙️ Nicole (Female Professional)' },
    { value: 'bf_emma', label: '🎙️ Emma (British Female Storyteller)' },
  ];

  const baseChatterboxVoices = [
    { value: 'default', label: '🎙️ Chatterbox 500M Master Voice (Default)' },
    { value: 'custom1', label: '🎙️ Custom Profile 1 (Sample Audio Folder 1)' },
    { value: 'newsroom_anchor', label: '🎙️ Newsroom Male Anchor (Zero-Shot)' },
    { value: 'storyteller_expressive', label: '🎙️ Expressive Storyteller (Zero-Shot)' },
    { value: 'financial_analyst', label: '🎙️ Financial Analyst (Zero-Shot)' },
  ];

  const existingVals = new Set(baseChatterboxVoices.map(v => v.value));
  const rawChatterboxVoices = [
    ...baseChatterboxVoices,
    ...dynamicChatterboxVoices.filter(v => !existingVals.has(v.value))
  ];

  const filteredVox1Voices = React.useMemo(() => {
    let list = rawChatterboxVoices.map(opt => ({
      ...opt,
      isStarred: starredVoiceIds.includes(opt.value)
    }));

    if (vox1SearchQuery.trim()) {
      const q = vox1SearchQuery.toLowerCase();
      list = list.filter(v => v.label.toLowerCase().includes(q) || v.value.toLowerCase().includes(q));
    }

    return list.sort((a, b) => {
      if (a.isStarred && !b.isStarred) return -1;
      if (!a.isStarred && b.isStarred) return 1;
      return a.label.localeCompare(b.label);
    });
  }, [dynamicChatterboxVoices, starredVoiceIds, vox1SearchQuery]);

  const filteredVox2Voices = React.useMemo(() => {
    let list = dynamicVox2Voices.map(opt => ({
      ...opt,
      isStarred: starredVoiceIds.includes(opt.value)
    }));

    if (vox2SearchQuery.trim()) {
      const q = vox2SearchQuery.toLowerCase();
      list = list.filter(v => v.label.toLowerCase().includes(q) || v.value.toLowerCase().includes(q));
    }

    return list.sort((a, b) => {
      if (a.isStarred && !b.isStarred) return -1;
      if (!a.isStarred && b.isStarred) return 1;
      return a.label.localeCompare(b.label);
    });
  }, [dynamicVox2Voices, starredVoiceIds, vox2SearchQuery]);

  // Codependent Sync: Auto-select 1st matching item in search list when user types in Vox1 Search input
  useEffect(() => {
    if (filteredVox1Voices.length > 0) {
      const exists = filteredVox1Voices.some(v => v.value === chatterboxVoice);
      if (!exists) {
        setChatterboxVoice(filteredVox1Voices[0].value);
      }
    }
  }, [vox1SearchQuery, filteredVox1Voices]);

  // Codependent Sync: Auto-select 1st matching item in search list when user types in Vox2 Search input
  useEffect(() => {
    if (filteredVox2Voices.length > 0) {
      const exists = filteredVox2Voices.some(v => v.value === chatterboxVox2Voice);
      if (!exists) {
        setChatterboxVox2Voice(filteredVox2Voices[0].value);
      }
    }
  }, [vox2SearchQuery, filteredVox2Voices]);

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

          {/* Header Action Buttons (Start Generation & Browse File) */}
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept="audio/*"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="px-4 py-3 rounded-xl text-xs font-bold text-slate-200 bg-slate-900 border border-slate-700 hover:bg-slate-800 hover:border-slate-600 flex items-center gap-2 transition shadow-md"
            >
              <Folder className="w-4 h-4 text-amber-400" /> Browse & Add Audio
            </button>

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
        </div>

        {/* Provider Toggle Tabs (4-Column Grid) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <button
            type="button"
            onClick={() => setProvider('kokoro')}
            className={`p-4 rounded-xl border text-left transition ${provider === 'kokoro'
                ? 'bg-cyan-950/40 border-cyan-500 text-white shadow-lg shadow-cyan-500/10'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" /> Kokoro Local
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-400">
                Free
              </span>
            </div>
            <p className="text-xs text-slate-400">Fast ONNX offline studio voice generation.</p>
          </button>

          <button
            type="button"
            onClick={() => setProvider('chatterbox')}
            className={`p-4 rounded-xl border text-left transition ${provider === 'chatterbox'
                ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" /> Chatterbox Vox1
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300">
                1,251 Voices
              </span>
            </div>
            <p className="text-xs text-slate-400">VoxCeleb 1 celebrity voice cloning profiles.</p>
          </button>

          <button
            type="button"
            onClick={() => setProvider('chatterbox_vox2')}
            className={`p-4 rounded-xl border text-left transition ${provider === 'chatterbox_vox2'
                ? 'bg-purple-950/40 border-purple-500 text-white shadow-lg shadow-purple-500/10'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" /> Chatterbox Vox2
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-purple-950 border border-purple-700 text-purple-300">
                6,112 HD Voices
              </span>
            </div>
            <p className="text-xs text-slate-400">VoxCeleb 2 HD studio celebrity library (Local Models).</p>
          </button>

          <button
            type="button"
            onClick={() => setProvider('elevenlabs')}
            className={`p-4 rounded-xl border text-left transition ${provider === 'elevenlabs'
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
            <p className="text-xs text-slate-400">Ultra-realistic AI voice synthesis.</p>
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
        ) : provider === 'chatterbox' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs text-emerald-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Chatterbox Vox1 Voice Profile (1,251 Voices)
                  </label>
                  <span className="text-[11px] text-amber-400 font-semibold flex items-center gap-1">
                    <Star className="w-3 h-3 fill-amber-400" /> Starred Voices Top
                  </span>
                </div>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="🔍 Search celebrity by name (e.g., David Attenborough, Alan Rickman)..."
                    value={vox1SearchQuery}
                    onChange={(e) => setVox1SearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-emerald-900/60 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <div className="flex items-center gap-2">
                    <select
                      value={chatterboxVoice}
                      onChange={(e) => setChatterboxVoice(e.target.value)}
                      className="w-full bg-slate-950 border border-emerald-900/60 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-medium truncate"
                    >
                      {filteredVox1Voices.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.isStarred ? `⭐ [FAVORITE] ${opt.label.replace(/^⭐\s*/, '')}` : opt.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => toggleStarVoice(chatterboxVoice)}
                      title={starredVoiceIds.includes(chatterboxVoice) ? "Unstar Voice (Remove from Top Favorites)" : "Star Voice as Favorite (Pin to Top)"}
                      className={`px-3 py-2.5 rounded-xl border transition flex items-center gap-1.5 font-bold text-xs shrink-0 ${
                        starredVoiceIds.includes(chatterboxVoice)
                          ? "bg-amber-950/60 border-amber-500/50 text-amber-400 hover:bg-amber-900/60 shadow-lg shadow-amber-500/10"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-amber-400 hover:border-slate-700"
                      }`}
                    >
                      <Star className={`w-4 h-4 ${starredVoiceIds.includes(chatterboxVoice) ? "fill-amber-400 text-amber-400" : ""}`} />
                      <span className="hidden sm:inline">{starredVoiceIds.includes(chatterboxVoice) ? "Starred" : "Star"}</span>
                    </button>
                  </div>
                </div>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/60">
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
                <p className="text-[11px] text-slate-400 mb-2">Prompt adherence & pacing guidance strength</p>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.1"
                    max="2.0"
                    step="0.05"
                    value={cfgWeight}
                    onChange={(e) => setCfgWeight(parseFloat(e.target.value))}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                  <input
                    type="number"
                    min="0.1"
                    max="2.0"
                    step="0.05"
                    value={cfgWeight}
                    onChange={(e) => setCfgWeight(parseFloat(e.target.value) || 0.7)}
                    className="w-16 bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-xs text-center font-mono text-emerald-300 font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Calibrated Studio Audio Tuning Toggle Switch Button (OFF by default as requested!) */}
            <div className="flex items-center justify-between p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${calibratedTuning ? "bg-amber-950/60 text-amber-400" : "bg-slate-900 text-slate-500"}`}>
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    Calibrated Studio Audio Tuning
                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${calibratedTuning ? "bg-amber-950 text-amber-400 border border-amber-800" : "bg-slate-900 text-slate-500"}`}>
                      {calibratedTuning ? "Active" : "Disabled (Default)"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">Applies -3dB loudness normalization, 80Hz high-pass filter, and soft limiter mastering chain.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCalibratedTuning(!calibratedTuning)}
                className={`w-12 h-6 flex items-center rounded-full p-1 transition cursor-pointer ${
                  calibratedTuning ? "bg-amber-500 justify-end shadow-md shadow-amber-500/20" : "bg-slate-800 justify-start"
                }`}
              >
                <div className="bg-white w-4 h-4 rounded-full shadow-md transform transition" />
              </button>
            </div>
          </div>
        ) : provider === 'chatterbox_vox2' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs text-purple-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> VoxCeleb 2 HD Celebrity Voice (6,112 Voices)
                  </label>
                  <span className="text-[11px] text-amber-400 font-semibold flex items-center gap-1">
                    <Star className="w-3 h-3 fill-amber-400" /> Starred Voices Top
                  </span>
                </div>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="🔍 Search celebrity by name (e.g., Tom Hardy, Emma Watson)..."
                    value={vox2SearchQuery}
                    onChange={(e) => setVox2SearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-purple-900/60 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                  <div className="flex items-center gap-2">
                    <select
                      value={chatterboxVox2Voice}
                      onChange={(e) => setChatterboxVox2Voice(e.target.value)}
                      className="w-full bg-slate-950 border border-purple-900/60 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 font-medium truncate"
                    >
                      {filteredVox2Voices.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.isStarred ? `⭐ [FAVORITE] ${opt.label.replace(/^⭐\s*/, '')}` : opt.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => toggleStarVoice(chatterboxVox2Voice)}
                      title={starredVoiceIds.includes(chatterboxVox2Voice) ? "Unstar Voice (Remove from Top Favorites)" : "Star Voice as Favorite (Pin to Top)"}
                      className={`px-3 py-2.5 rounded-xl border transition flex items-center gap-1.5 font-bold text-xs shrink-0 ${
                        starredVoiceIds.includes(chatterboxVox2Voice)
                          ? "bg-amber-950/60 border-amber-500/50 text-amber-400 hover:bg-amber-900/60 shadow-lg shadow-amber-500/10"
                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-amber-400 hover:border-slate-700"
                      }`}
                    >
                      <Star className={`w-4 h-4 ${starredVoiceIds.includes(chatterboxVox2Voice) ? "fill-amber-400 text-amber-400" : ""}`} />
                      <span className="hidden sm:inline">{starredVoiceIds.includes(chatterboxVox2Voice) ? "Starred" : "Star"}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Speaking Speed
                  </label>
                  <span className="text-xs font-mono font-bold text-purple-400">{ttsSpeed.toFixed(2)}x</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.80"
                    max="1.50"
                    step="0.05"
                    value={ttsSpeed}
                    onChange={(e) => setTtsSpeed(parseFloat(e.target.value))}
                    className="w-full accent-purple-400 cursor-pointer"
                  />
                  <input
                    type="number"
                    min="0.80"
                    max="1.50"
                    step="0.05"
                    value={ttsSpeed}
                    onChange={(e) => setTtsSpeed(parseFloat(e.target.value) || 1.15)}
                    className="w-16 bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-xs text-center font-mono text-purple-300 font-bold focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>

            {/* Calibrated Studio Audio Tuning Toggle Switch Button (OFF by default as requested!) */}
            <div className="flex items-center justify-between p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${calibratedTuning ? "bg-amber-950/60 text-amber-400" : "bg-slate-900 text-slate-500"}`}>
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    Calibrated Studio Audio Tuning
                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${calibratedTuning ? "bg-amber-950 text-amber-400 border border-amber-800" : "bg-slate-900 text-slate-500"}`}>
                      {calibratedTuning ? "Active" : "Disabled (Default)"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">Applies -3dB loudness normalization, 80Hz high-pass filter, and soft limiter mastering chain.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCalibratedTuning(!calibratedTuning)}
                className={`w-12 h-6 flex items-center rounded-full p-1 transition cursor-pointer ${
                  calibratedTuning ? "bg-amber-500 justify-end shadow-md shadow-amber-500/20" : "bg-slate-800 justify-start"
                }`}
              >
                <div className="bg-white w-4 h-4 rounded-full shadow-md transform transition" />
              </button>
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
                    onClick={saveApiKeyToSettings}
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

      {/* Voice Takes Stack & Selection Studio */}
      {takes.length > 0 && (
        <div className="glass-panel rounded-2xl p-5 border border-cyan-500/30 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-cyan-400" /> Voice Takes Studio ({takes.length} {takes.length === 1 ? 'Take' : 'Takes'})
              </h3>
            </div>

            {/* Quick Browse Add Button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-300 bg-amber-950/40 border border-amber-800/60 hover:bg-amber-950/70 flex items-center gap-1.5 transition"
              >
                <Folder className="w-3.5 h-3.5 text-amber-400" /> Browse & Add Audio
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Audio takes stack in order (Take #1 at bottom). Click any take to listen and choose which one to finalize for video reel narration.
          </p>

          {/* Render Stack: Take #1 at bottom, Take #2 above it, Take #3 at top */}
          <div className="flex flex-col gap-4">
            {takes.map((take) => {
              const isActive = activeTakeId === take.id;
              return (
                <div
                  key={take.id}
                  className={`rounded-2xl p-4 transition-all border ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-950/50 via-slate-950 to-slate-950 border-emerald-500 shadow-lg shadow-emerald-500/10'
                      : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className={`text-xs font-extrabold uppercase px-2.5 py-1 rounded-lg border font-mono ${
                        isActive
                          ? 'bg-emerald-950 border-emerald-600 text-emerald-300'
                          : 'bg-slate-900 border-slate-700 text-slate-400'
                      }`}>
                        Take #{take.takeNumber}
                      </span>

                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        {take.isUploaded ? <Music className="w-3.5 h-3.5 text-amber-400" /> : <Mic className="w-3.5 h-3.5 text-cyan-400" />}
                        {take.voiceName}
                      </span>

                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                        {take.provider}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" /> {take.timestamp}
                      </span>
                      <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded-lg">
                        {take.duration}s
                      </span>
                      <button
                        type="button"
                        onClick={() => selectTake(take)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                          isActive
                            ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                            : 'bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {isActive ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-slate-950" /> Active Choice
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5 text-slate-400" /> Select For Final Video
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Detailed Parameter Chips */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-[10px] font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-slate-400">
                      Speed: <strong className="text-white">{take.params.speed.toFixed(2)}x</strong>
                    </span>
                    {take.params.exaggeration !== undefined && (
                      <span className="text-[10px] font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-slate-400">
                        Exaggeration: <strong className="text-emerald-400">{take.params.exaggeration.toFixed(2)}</strong>
                      </span>
                    )}
                    {take.params.cfgWeight !== undefined && (
                      <span className="text-[10px] font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-slate-400">
                        CFG: <strong className="text-emerald-400">{take.params.cfgWeight.toFixed(2)}</strong>
                      </span>
                    )}
                  </div>

                  {/* Inline Audio Player for this Take */}
                  <div className="bg-slate-950 rounded-xl p-2.5 border border-slate-900">
                    <audio controls className="w-full h-8" key={take.audioUrl}>
                      <source src={take.audioUrl} type="audio/mpeg" />
                    </audio>
                  </div>
                </div>
              );
            })}
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
          className={`glow-button px-7 py-3.5 rounded-2xl text-sm font-bold text-white flex items-center gap-2.5 ${!audioUrl || loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
        >
          Next: Generate Clips <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
