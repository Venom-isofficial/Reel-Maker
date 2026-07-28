import React, { useState, useEffect } from 'react';
import { MasterPlan } from '../../backend/types';
import { Video, Sparkles, Loader2, ArrowRight, ArrowLeft, RefreshCw, CheckCircle, AlertTriangle, Film, Play, Layers } from 'lucide-react';

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
  const [provider, setProvider] = useState<'pexels' | 'ltx'>('pexels');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [regenLoading, setRegenLoading] = useState<Record<number, boolean>>({});
  const [prompts, setPrompts] = useState<Record<number, string>>({});

  // Initialize scene prompts on mount
  useEffect(() => {
    const initialPrompts: Record<number, string> = {};
    const initialClips: ClipItem[] = [];

    (masterPlan.scenes || []).forEach((scene) => {
      initialPrompts[scene.sceneNumber] = scene.visualPrompt || scene.searchKeyword || 'business corporate technology';
      initialClips.push({
        sceneNumber: scene.sceneNumber,
        clipUrl: `/api/runs/${runId}/file/clips/scene_${String(scene.sceneNumber).padStart(2, '0')}.mp4`,
        searchKeyword: scene.searchKeyword || 'business corporate',
        status: 'pending',
      });
    });

    setPrompts(initialPrompts);
    setClips(initialClips);

    // Check if clips already exist on disk
    fetch(`/api/runs/${runId}/file/clips/scene_01.mp4`, { method: 'HEAD' })
      .then((r) => {
        if (r.ok) {
          setClips((prev) => prev.map((c) => ({ ...c, status: 'completed' })));
        }
      })
      .catch(() => {});
  }, [masterPlan, runId]);

  const generateClips = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/wizard/step4-clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterPlan,
          runId,
          provider,
          prompts,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Clip generation failed');
      setClips(data.clips);
    } catch (err: any) {
      setError(err.message || 'Failed to generate video clips');
    } finally {
      setLoading(false);
    }
  };

  const regenSingleClip = async (sceneNumber: number) => {
    setRegenLoading((prev) => ({ ...prev, [sceneNumber]: true }));
    try {
      const scene = masterPlan.scenes.find((s) => s.sceneNumber === sceneNumber);
      const res = await fetch('/api/wizard/step4-regen-clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneNumber,
          searchKeyword: prompts[sceneNumber] || 'business',
          durationSeconds: scene?.durationSeconds || 5,
          runId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setClips((prev) =>
          prev.map((c) =>
            c.sceneNumber === sceneNumber
              ? { ...c, clipUrl: data.clipUrl, searchKeyword: prompts[sceneNumber], status: data.status }
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

  const readyCount = clips.filter((c) => c.status === 'completed').length;

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-rose-950/40 border border-rose-800/50 rounded-xl px-4 py-3 text-rose-300 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-400 font-bold hover:text-white">✕</button>
        </div>
      )}

      {/* Provider Selector Switch */}
      <div className="space-y-3">
        <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider">
          Select Video Generation Engine
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pexels Provider Option */}
          <button
            type="button"
            onClick={() => setProvider('pexels')}
            className={`p-4 rounded-xl border text-left transition ${
              provider === 'pexels'
                ? 'bg-cyan-950/40 border-cyan-500 text-white shadow-lg shadow-cyan-500/10'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-bold flex items-center gap-2">
                <Video className="w-4 h-4 text-cyan-400" /> Pexels Stock Video
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-cyan-950 border border-cyan-700 text-cyan-400">
                Stock API
              </span>
            </div>
            <p className="text-xs text-slate-400">Fetch 1080x1920 HD vertical stock video footage automatically via Pexels keywords.</p>
          </button>

          {/* LTX-Video AI Provider Option */}
          <button
            type="button"
            onClick={() => setProvider('ltx')}
            className={`p-4 rounded-xl border text-left transition ${
              provider === 'ltx'
                ? 'bg-purple-950/40 border-purple-500 text-white shadow-lg shadow-purple-500/10'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" /> LTX-Video AI Generation
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-purple-950 border border-purple-700 text-purple-300">
                Local AI
              </span>
            </div>
            <p className="text-xs text-slate-400">Synthesize custom neural video clips per scene based on detailed AI visual prompts.</p>
          </button>
        </div>
      </div>

      {/* Top Action Header Bar */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-cyan-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Scene Video Prompts & Wireframe</h2>
            <p className="text-xs text-slate-400">
              {readyCount}/{masterPlan.scenes?.length || 0} clips ready • Engine: <span className="text-cyan-300 font-semibold">{provider === 'ltx' ? 'LTX-Video AI Baseplate' : 'Pexels Stock Downloader'}</span>
            </p>
          </div>
        </div>

        <button
          onClick={generateClips}
          disabled={loading}
          className={`glow-button px-7 py-3 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 shadow-lg transition-all ${
            loading ? 'opacity-75 cursor-wait' : ''
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
              Generating Scene Clips...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-amber-300" />
              Generate Video Clips ({provider === 'ltx' ? 'LTX-Video' : 'Pexels'})
            </>
          )}
        </button>
      </div>

      {/* Scene Wireframe Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {(masterPlan.scenes || []).map((scene) => {
          const clip = clips.find((c) => c.sceneNumber === scene.sceneNumber) || {
            sceneNumber: scene.sceneNumber,
            clipUrl: `/api/runs/${runId}/file/clips/scene_${String(scene.sceneNumber).padStart(2, '0')}.mp4`,
            searchKeyword: scene.searchKeyword || '',
            status: 'pending',
          };
          const isRegen = regenLoading[scene.sceneNumber];

          return (
            <div key={scene.sceneNumber} className="glass-card rounded-2xl overflow-hidden border border-slate-800 flex flex-col transition hover:border-slate-700">
              {/* Wireframe Preview Frame */}
              <div className="aspect-[9/13] bg-slate-950 relative flex flex-col items-center justify-center border-b border-slate-800/80 overflow-hidden">
                {clip.status === 'completed' && clip.clipUrl ? (
                  <video
                    controls
                    className="w-full h-full object-cover"
                    key={clip.clipUrl}
                  >
                    <source src={clip.clipUrl} type="video/mp4" />
                  </video>
                ) : (
                  /* Wireframe Placeholder Baseplate */
                  <div className="p-6 text-center space-y-3">
                    <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto transition-transform ${
                      provider === 'ltx' ? 'bg-purple-950/40 border-purple-800/60 text-purple-400' : 'bg-cyan-950/40 border-cyan-800/60 text-cyan-400'
                    }`}>
                      {provider === 'ltx' ? <Sparkles className="w-7 h-7" /> : <Film className="w-7 h-7" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                        {provider === 'ltx' ? 'LTX AI Wireframe Frame' : 'Pexels Video Preview'}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1 font-mono">
                        Prompt Ready • Click Generate
                      </p>
                    </div>
                  </div>
                )}

                {/* Top Badge: Scene Number */}
                <div className="absolute top-3 left-3 bg-black/80 backdrop-blur px-2.5 py-1 rounded-lg border border-slate-800">
                  <span className="text-[11px] font-bold font-mono text-cyan-400">
                    SCENE {String(scene.sceneNumber).padStart(2, '0')}
                  </span>
                </div>

                {/* Top Badge: Duration & Status */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5">
                  <span className="bg-black/80 backdrop-blur px-2 py-1 rounded-lg border border-slate-800 text-[10px] font-mono text-slate-300">
                    {scene.durationSeconds || 5}s
                  </span>
                  {clip.status === 'completed' ? (
                    <div className="bg-emerald-950/80 border border-emerald-800/80 p-1 rounded-lg text-emerald-400">
                      <CheckCircle className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <div className="bg-amber-950/80 border border-amber-800/80 p-1 rounded-lg text-amber-400">
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              </div>

              {/* Editable Prompt & Actions */}
              <div className="p-4 space-y-3.5 flex-1 flex flex-col justify-between bg-slate-900/30">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                      {provider === 'ltx' ? 'LTX AI Video Prompt' : 'Pexels Search Query'}
                    </label>
                    <span className="text-[10px] text-slate-500 italic line-clamp-1 max-w-[140px]">
                      "{scene.narrationText?.slice(0, 20)}..."
                    </span>
                  </div>

                  <textarea
                    rows={3}
                    value={prompts[scene.sceneNumber] || ''}
                    onChange={(e) => setPrompts((prev) => ({ ...prev, [scene.sceneNumber]: e.target.value }))}
                    placeholder={provider === 'ltx' ? 'Describe the visual AI video scene...' : 'Enter Pexels search keywords...'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 resize-none font-sans leading-relaxed"
                  />
                </div>

                <button
                  onClick={() => regenSingleClip(scene.sceneNumber)}
                  disabled={isRegen}
                  className="w-full py-2 rounded-xl text-xs font-semibold bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 flex items-center justify-center gap-1.5 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRegen ? 'animate-spin' : ''}`} />
                  {isRegen ? 'Generating Scene...' : `Regenerate Scene ${scene.sceneNumber}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Navigation Bar */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
        <button
          onClick={onBack}
          className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 border border-slate-800 hover:bg-slate-900/50 flex items-center gap-2 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Voice
        </button>
        <button
          onClick={() => onComplete({ clips })}
          disabled={clips.length === 0}
          className={`glow-button px-7 py-3 rounded-2xl text-sm font-bold text-white flex items-center gap-2.5 ${clips.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Next: Render Final <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
