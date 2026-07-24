import React, { useState, useEffect } from 'react';
import { ScriptOutput } from '../../backend/types';
import { Mic, Loader2, ArrowRight, ArrowLeft, RefreshCw, Edit3 } from 'lucide-react';

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
  const [voiceName, setVoiceName] = useState('am_michael');

  useEffect(() => {
    generateVoice();
  }, []);

  const generateVoice = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/wizard/step3-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptText: editedText, runId, voiceName }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Voice generation failed');
      setAudioUrl(data.audioUrl + `?t=${Date.now()}`);
      setDuration(data.duration);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const VOICE_OPTIONS = [
    { value: 'am_michael', label: '🎙️ Michael (Male News Anchor - Default)' },
    { value: 'af_bella', label: '🎙️ Bella (Female Professional)' },
    { value: 'am_adam', label: '🎙️ Adam (Male Deep)' },
    { value: 'bm_george', label: '🎙️ George (British Male)' },
  ];

  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-rose-950/40 border border-rose-800/50 rounded-xl px-4 py-3 text-rose-300 text-xs">{error}</div>
      )}

      {/* Audio Player */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Mic className="w-5 h-5 text-cyan-400" />
          <div>
            <h2 className="text-lg font-bold text-white">Voice Narration</h2>
            <p className="text-xs text-slate-400">
              {loading ? 'Generating with Kokoro TTS...' : audioUrl ? `Generated via Kokoro TTS • ~${duration}s` : 'Preparing...'}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-cyan-400 animate-spin mr-3" />
            <span className="text-sm text-slate-300">Generating voice audio...</span>
          </div>
        ) : audioUrl ? (
          <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800">
            <audio controls className="w-full" key={audioUrl}>
              <source src={audioUrl} type="audio/mpeg" />
            </audio>
          </div>
        ) : null}
      </div>

      {/* Voice Selector */}
      <div className="glass-panel rounded-2xl p-5">
        <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">Voice Profile</label>
        <select
          value={voiceName}
          onChange={(e) => setVoiceName(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
        >
          {VOICE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Editable Narration Text */}
      <div className="glass-panel rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-amber-400" /> Narration Text
          </h3>
          <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
            Edit text and click Regenerate
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
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600/30 text-amber-300 border border-amber-500/40 hover:bg-amber-600/40 flex items-center gap-1.5 transition"
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
          className={`glow-button px-7 py-3.5 rounded-2xl text-sm font-bold text-white flex items-center gap-2.5 ${!audioUrl || loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Next: Generate Clips <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
