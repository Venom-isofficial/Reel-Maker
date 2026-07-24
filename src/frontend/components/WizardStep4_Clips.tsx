import React, { useState, useEffect, useRef } from 'react';
import { MasterPlan } from '../../backend/types';
import { Video, Loader2, ArrowRight, ArrowLeft, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';

interface ClipItem {
  sceneNumber: number;
  clipUrl: string;
  searchKeyword: string;
  status: string;
}

interface Props {
  masterPlan: MasterPlan;
  runId: string;
  onComplete: (data: { clips: ClipItem[] }) => void;
  onBack: () => void;
}

export const WizardStep4_Clips: React.FC<Props> = ({ masterPlan, runId, onComplete, onBack }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [regenLoading, setRegenLoading] = useState<Record<number, boolean>>({});
  const [editedKeywords, setEditedKeywords] = useState<Record<number, string>>({});
  const hasFiredRef = useRef(false);

  useEffect(() => {
    if (!hasFiredRef.current) {
      hasFiredRef.current = true;
      generateClips();
    }
  }, []);

  const generateClips = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/wizard/step4-clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterPlan, runId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Clip generation failed');
      setClips(data.clips);
      // Initialize keyword editors
      const kws: Record<number, string> = {};
      data.clips.forEach((c: ClipItem) => { kws[c.sceneNumber] = c.searchKeyword; });
      setEditedKeywords(kws);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const regenClip = async (sceneNumber: number) => {
    setRegenLoading((prev) => ({ ...prev, [sceneNumber]: true }));
    try {
      const scene = masterPlan.scenes.find((s) => s.sceneNumber === sceneNumber);
      const res = await fetch('/api/wizard/step4-regen-clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneNumber,
          searchKeyword: editedKeywords[sceneNumber] || 'business',
          durationSeconds: scene?.durationSeconds || 5,
          runId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setClips((prev) =>
          prev.map((c) =>
            c.sceneNumber === sceneNumber
              ? { ...c, clipUrl: data.clipUrl, searchKeyword: editedKeywords[sceneNumber], status: data.status }
              : c
          )
        );
      }
    } catch (err: any) {
      console.error('Regen clip error:', err);
    } finally {
      setRegenLoading((prev) => ({ ...prev, [sceneNumber]: false }));
    }
  };

  if (loading) {
    return (
      <div className="glass-panel rounded-2xl p-12 text-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-300">Downloading Pexels video clips...</p>
        <p className="text-xs text-slate-500 mt-1">This may take 30-60 seconds</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-rose-950/40 border border-rose-800/50 rounded-xl px-4 py-3 text-rose-300 text-xs">{error}</div>
      )}

      {/* Header */}
      <div className="glass-panel rounded-2xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Video className="w-5 h-5 text-cyan-400" />
          <div>
            <h2 className="text-lg font-bold text-white">Video Clips Review</h2>
            <p className="text-xs text-slate-400">
              {clips.filter((c) => c.status === 'completed').length}/{clips.length} clips ready • Play, review, and regenerate any clip
            </p>
          </div>
        </div>
      </div>

      {/* Clips Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {clips.map((clip) => {
          const scene = masterPlan.scenes.find((s) => s.sceneNumber === clip.sceneNumber);
          const isRegen = regenLoading[clip.sceneNumber];

          return (
            <div key={clip.sceneNumber} className="glass-card rounded-xl overflow-hidden border border-slate-800">
              {/* Video Player */}
              <div className="aspect-[9/12] bg-black relative">
                {clip.status === 'completed' ? (
                  <video
                    controls
                    className="w-full h-full object-cover"
                    key={clip.clipUrl}
                  >
                    <source src={clip.clipUrl} type="video/mp4" />
                  </video>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-500">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                )}
                <div className="absolute top-2 left-2 bg-black/70 backdrop-blur px-2 py-1 rounded-lg">
                  <span className="text-[10px] font-bold font-mono text-cyan-400">
                    SCENE {String(clip.sceneNumber).padStart(2, '0')}
                  </span>
                </div>
                <div className="absolute top-2 right-2">
                  {clip.status === 'completed' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="p-3 space-y-2">
                <p className="text-[10px] text-slate-400 line-clamp-1 italic">
                  "{scene?.narrationText || ''}"
                </p>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Search Keyword</label>
                  <input
                    type="text"
                    value={editedKeywords[clip.sceneNumber] || ''}
                    onChange={(e) => setEditedKeywords((prev) => ({ ...prev, [clip.sceneNumber]: e.target.value }))}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <button
                  onClick={() => regenClip(clip.sceneNumber)}
                  disabled={isRegen}
                  className="w-full px-3 py-2 rounded-lg text-xs font-semibold bg-amber-600/20 text-amber-300 border border-amber-500/40 hover:bg-amber-600/30 flex items-center justify-center gap-1.5 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRegen ? 'animate-spin' : ''}`} />
                  {isRegen ? 'Regenerating...' : 'Regenerate Clip'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 border border-slate-800 hover:bg-slate-900/50 flex items-center gap-2 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Voice
        </button>
        <button
          onClick={() => onComplete({ clips })}
          disabled={clips.length === 0}
          className={`glow-button px-7 py-3.5 rounded-2xl text-sm font-bold text-white flex items-center gap-2.5 ${clips.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Next: Render Final <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
