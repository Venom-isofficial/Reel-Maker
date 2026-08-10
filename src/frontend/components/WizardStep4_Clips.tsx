import React, { useState, useEffect, useRef } from 'react';
import { MasterPlan } from '../../backend/types';
import { Video, Sparkles, Loader2, ArrowRight, ArrowLeft, RefreshCw, CheckCircle, AlertTriangle, Film, Play, Layers, Globe, Upload, FolderPlus, FileVideo } from 'lucide-react';

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
  const [provider, setProvider] = useState<'pexels' | 'comfyui' | 'apicalls' | 'dropclips'>('dropclips');
  const [apiModel, setApiModel] = useState<string>('muapi/wan3.0-text-to-video');
  const [comfyModel, setComfyModel] = useState<string>('ltx-video');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [regenLoading, setRegenLoading] = useState<Record<number, boolean>>({});
  const [uploadLoading, setUploadLoading] = useState<Record<number, boolean>>({});
  const [prompts, setPrompts] = useState<Record<number, string>>({});
  const [sceneStartSec, setSceneStartSec] = useState<Record<number, number>>({});
  const [sceneDurations, setSceneDurations] = useState<Record<number, number>>({});

  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // Initialize scene prompts & trim durations on mount
  useEffect(() => {
    const initialPrompts: Record<number, string> = {};
    const initialClips: ClipItem[] = [];
    const initialStartSec: Record<number, number> = {};
    const initialDurations: Record<number, number> = {};

    (masterPlan.scenes || []).forEach((scene) => {
      const extractKeywords = (txt: string) => {
        const words = (txt || '').toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3 && !['this', 'that', 'with', 'from', 'have', 'more', 'about', 'will', 'these', 'their', 'they', 'what', 'which', 'when', 'shows', 'news', 'video'].includes(w));
        return Array.from(new Set(words)).slice(0, 4).join(' ');
      };

      const sceneKw = scene.searchKeyword && !scene.searchKeyword.includes('business corporate')
        ? scene.searchKeyword
        : extractKeywords(scene.narrationText);

      const promptValue = scene.videoPrompt || scene.visualPrompt || sceneKw || 'news broadcast footage';

      initialPrompts[scene.sceneNumber] = promptValue;
      initialStartSec[scene.sceneNumber] = scene.startSec || 0;
      initialDurations[scene.sceneNumber] = scene.durationSeconds || 5;

      initialClips.push({
        sceneNumber: scene.sceneNumber,
        clipUrl: `/api/runs/${runId}/file/clips/scene_${String(scene.sceneNumber).padStart(2, '0')}.mp4`,
        searchKeyword: sceneKw || 'news broadcast',
        status: 'pending',
      });
    });

    setPrompts(initialPrompts);
    setClips(initialClips);
    setSceneStartSec(initialStartSec);
    setSceneDurations(initialDurations);

    // Check if clips already exist on disk for each scene
    (masterPlan.scenes || []).forEach((scene) => {
      fetch(`/api/runs/${runId}/file/clips/scene_${String(scene.sceneNumber).padStart(2, '0')}.mp4`, { method: 'HEAD' })
        .then((r) => {
          if (r.ok) {
            setClips((prev) =>
              prev.map((c) => (c.sceneNumber === scene.sceneNumber ? { ...c, status: 'completed' } : c))
            );
          }
        })
        .catch(() => {});
    });
  }, [masterPlan, runId]);

  const handleStartSecChange = (sceneNumber: number, startVal: number) => {
    const val = Math.max(0, startVal);
    setSceneStartSec((prev) => ({ ...prev, [sceneNumber]: val }));

    const updatedScenes = (masterPlan.scenes || []).map((s) =>
      s.sceneNumber === sceneNumber ? { ...s, startSec: val } : s
    );
    masterPlan.scenes = updatedScenes;

    fetch('/api/wizard/save-edits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId, field: 'masterPlan', data: masterPlan }),
    }).catch(() => {});
  };

  const handleDurationChange = (sceneNumber: number, durVal: number) => {
    const val = Math.max(0.5, durVal);
    setSceneDurations((prev) => ({ ...prev, [sceneNumber]: val }));

    const updatedScenes = (masterPlan.scenes || []).map((s) =>
      s.sceneNumber === sceneNumber ? { ...s, durationSeconds: val } : s
    );
    masterPlan.scenes = updatedScenes;

    fetch('/api/wizard/save-edits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId, field: 'masterPlan', data: masterPlan }),
    }).catch(() => {});
  };

  const applyClipTrim = async (sceneNumber: number) => {
    const startSec = sceneStartSec[sceneNumber] || 0;
    const durationSeconds = sceneDurations[sceneNumber] || 5;

    const currentClip = clips.find((c) => c.sceneNumber === sceneNumber);
    if (!currentClip || currentClip.status !== 'completed') return;

    setUploadLoading((prev) => ({ ...prev, [sceneNumber]: true }));
    try {
      const res = await fetch('/api/wizard/step4-trim-clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneNumber, runId, startSec, durationSeconds }),
      });
      const data = await res.json();
      if (data.success && data.clipUrl) {
        setClips((prev) =>
          prev.map((c) =>
            c.sceneNumber === sceneNumber ? { ...c, clipUrl: data.clipUrl, status: 'completed' } : c
          )
        );
      }
    } catch (e) {
      console.error('Failed to trim clip:', e);
    } finally {
      setUploadLoading((prev) => ({ ...prev, [sceneNumber]: false }));
    }
  };

  const handleFileUpload = (sceneNumber: number, file: File) => {
    setUploadLoading((prev) => ({ ...prev, [sceneNumber]: true }));
    setError(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const fileData = reader.result as string;
        const res = await fetch('/api/wizard/step4-upload-clip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sceneNumber,
            runId,
            fileData,
          }),
        });

        const contentType = res.headers.get('content-type') || '';
        if (!res.ok || !contentType.includes('application/json')) {
          const text = await res.text();
          throw new Error(
            res.status === 413
              ? 'File size exceeds maximum upload limit (500MB). Please select a smaller file.'
              : `Upload failed (Status ${res.status}): ${text.slice(0, 100)}`
          );
        }

        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Clip upload failed');

        setClips((prev) =>
          prev.map((c) =>
            c.sceneNumber === sceneNumber
              ? { ...c, clipUrl: data.clipUrl, status: 'completed' }
              : c
          )
        );
      } catch (err: any) {
        setError(err.message || 'Failed to upload clip or image');
      } finally {
        setUploadLoading((prev) => ({ ...prev, [sceneNumber]: false }));
      }
    };
    reader.readAsDataURL(file);
  };

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
          apiModel,
          comfyModel,
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

          {/* ComfyUI Local AI Provider Option */}
          <div
            onClick={() => setProvider('comfyui')}
            className={`p-4 rounded-xl border text-left cursor-pointer transition ${
              provider === 'comfyui'
                ? 'bg-purple-950/40 border-purple-500 text-white shadow-lg shadow-purple-500/10'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" /> ComfyUI
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-purple-950 border border-purple-700 text-purple-300">
                Local ComfyUI
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-2">Local AI video generation powered by ComfyUI workflows and your GPU.</p>

            <div onClick={(e) => e.stopPropagation()}>
              <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Model Selection</label>
              <select
                value={comfyModel}
                onChange={(e) => setComfyModel(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-purple-500"
              >
                <option value="ltx-video">ltx-video</option>
              </select>
            </div>
          </div>

          {/* API Calls Provider Option */}
          <div
            onClick={() => setProvider('apicalls')}
            className={`p-4 rounded-xl border text-left cursor-pointer transition ${
              provider === 'apicalls'
                ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-bold flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-400" /> API Calls
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300">
                Cloud API
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-2">Cloud AI text-to-video generation powered by remote API provider models.</p>

            <div onClick={(e) => e.stopPropagation()}>
              <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1">Model Selection</label>
              <select
                value={apiModel}
                onChange={(e) => setApiModel(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-emerald-500"
              >
                <option value="muapi/wan3.0-text-to-video">muapi/wan3.0-text-to-video</option>
                <option value="muapi/wan2.1-text-to-video">muapi/wan2.1-text-to-video</option>
                <option value="vadoo/text-to-video">vadoo/text-to-video</option>
              </select>
            </div>
          </div>

          {/* Drop Clips Provider Option (NEW) */}
          <button
            type="button"
            onClick={() => setProvider('dropclips')}
            className={`p-4 rounded-xl border text-left transition ${
              provider === 'dropclips'
                ? 'bg-blue-950/40 border-blue-500 text-white shadow-lg shadow-blue-500/10'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-bold flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-400" /> Drop Clips
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-950 border border-blue-700 text-blue-300">
                Manual Drop
              </span>
            </div>
            <p className="text-xs text-slate-400">Browse or drop custom generated video clip files directly for each scene card.</p>
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
              {readyCount}/{masterPlan.scenes?.length || 0} clips ready • Engine: <span className="text-cyan-300 font-semibold">{provider === 'apicalls' ? `API Calls (${apiModel})` : provider === 'comfyui' ? `ComfyUI (${comfyModel})` : provider === 'dropclips' ? 'Drop Clips (Manual Video Drop)' : 'Pexels Stock Downloader'}</span>
            </p>
          </div>
        </div>

        {provider !== 'dropclips' && (
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
                Generate Video Clips ({provider === 'apicalls' ? 'API Calls' : provider === 'comfyui' ? 'ComfyUI' : 'Pexels'})
              </>
            )}
          </button>
        )}
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
          const isUploading = uploadLoading[scene.sceneNumber];

          return (
            <div key={scene.sceneNumber} className="glass-card rounded-2xl overflow-hidden border border-slate-800 flex flex-col transition hover:border-slate-700">
              {/* Wireframe Preview Frame / Drag & Drop Target */}
              <div
                className="aspect-[9/13] bg-slate-950 relative flex flex-col items-center justify-center border-b border-slate-800/80 overflow-hidden group cursor-pointer"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) {
                    handleFileUpload(scene.sceneNumber, e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRefs.current[scene.sceneNumber]?.click()}
              >
                {/* Hidden File Input per Scene */}
                <input
                  type="file"
                  accept="video/mp4,video/*"
                  className="hidden"
                  ref={(el) => (fileInputRefs.current[scene.sceneNumber] = el)}
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleFileUpload(scene.sceneNumber, e.target.files[0]);
                    }
                  }}
                />

                {isUploading ? (
                  <div className="p-6 text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-400 mx-auto" />
                    <p className="text-xs font-bold text-blue-300">Uploading Video Clip...</p>
                  </div>
                ) : clip.status === 'completed' && clip.clipUrl ? (
                  <div className="w-full h-full relative">
                    <video
                      controls
                      className="w-full h-full object-cover"
                      key={clip.clipUrl}
                    >
                      <source src={clip.clipUrl} type="video/mp4" />
                    </video>

                    {/* Change Clip Overlay on Hover */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 pointer-events-none">
                      <Upload className="w-6 h-6 text-blue-400" />
                      <span className="text-xs font-bold text-white">Click or Drop to Replace Clip</span>
                    </div>
                  </div>
                ) : (
                  /* Wireframe Placeholder Baseplate */
                  <div className="p-6 text-center space-y-3">
                    <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto transition-transform ${
                      provider === 'dropclips' ? 'bg-blue-950/40 border-blue-800/60 text-blue-400 group-hover:scale-105' : provider === 'comfyui' ? 'bg-purple-950/40 border-purple-800/60 text-purple-400' : 'bg-cyan-950/40 border-cyan-800/60 text-cyan-400'
                    }`}>
                      {provider === 'dropclips' ? <Upload className="w-7 h-7" /> : provider === 'comfyui' ? <Sparkles className="w-7 h-7" /> : <Film className="w-7 h-7" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                        {provider === 'dropclips' ? 'Drop / Browse Video Clip' : provider === 'comfyui' ? 'ComfyUI AI Preview' : 'Pexels Video Preview'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1 font-mono">
                        {provider === 'dropclips' ? 'Click to select .mp4 file' : 'Prompt Ready • Click Generate'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Top Badge: Scene Number */}
                <div className="absolute top-3 left-3 bg-black/80 backdrop-blur px-2.5 py-1 rounded-lg border border-slate-800 pointer-events-none">
                  <span className="text-[11px] font-bold font-mono text-cyan-400">
                    SCENE {String(scene.sceneNumber).padStart(2, '0')}
                  </span>
                </div>

                {/* Top Badge: Interactive Start Sec & Play Duration Controls */}
                <div
                  className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/90 backdrop-blur border border-slate-800 rounded-xl px-2 py-1 shadow-lg"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Start:</span>
                    <input
                      type="number"
                      min="0"
                      max="600"
                      step="0.5"
                      value={sceneStartSec[scene.sceneNumber] ?? 0}
                      onChange={(e) => handleStartSecChange(scene.sceneNumber, parseFloat(e.target.value) || 0)}
                      className="w-11 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[11px] text-cyan-300 font-mono font-bold text-center focus:outline-none focus:border-cyan-500"
                      title="Start timestamp in video (seconds) - Applied in Final Render"
                    />
                    <span className="text-[10px] text-slate-500 font-mono">s</span>
                  </div>

                  <span className="text-slate-700 text-xs font-bold">|</span>

                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Play:</span>
                    <input
                      type="number"
                      min="0.5"
                      max="120"
                      step="0.5"
                      value={sceneDurations[scene.sceneNumber] ?? 5}
                      onChange={(e) => handleDurationChange(scene.sceneNumber, parseFloat(e.target.value) || 5)}
                      className="w-11 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[11px] text-emerald-300 font-mono font-bold text-center focus:outline-none focus:border-emerald-500"
                      title="Playback duration (seconds) - Applied in Final Render"
                    />
                    <span className="text-[10px] text-slate-500 font-mono">s</span>
                  </div>

                  {clip.status === 'completed' ? (
                    <div className="bg-emerald-950/80 border border-emerald-800/80 p-0.5 rounded text-emerald-400 ml-0.5">
                      <CheckCircle className="w-3 h-3" />
                    </div>
                  ) : (
                    <div className="bg-amber-950/80 border border-amber-800/80 p-0.5 rounded text-amber-400 ml-0.5">
                      <AlertTriangle className="w-3 h-3" />
                    </div>
                  )}
                </div>
              </div>

              {/* Editable Prompt & Actions */}
              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between bg-slate-900/30">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                      {provider === 'comfyui' ? 'ComfyUI AI Video Prompt' : provider === 'dropclips' ? 'Scene Visual Prompt' : 'Pexels Search Query'}
                    </label>
                    <div className="relative group/tooltip">
                      <span className="text-[10px] text-slate-400 italic line-clamp-1 max-w-[140px] cursor-help hover:text-cyan-300 transition">
                        "{scene.narrationText?.slice(0, 20)}..."
                      </span>
                      {/* Full Narration Script Hover Card */}
                      <div className="absolute right-0 top-5 z-50 hidden group-hover/tooltip:block w-72 p-3 bg-slate-950/95 border border-cyan-800/80 rounded-xl shadow-2xl text-xs text-slate-200 font-sans font-normal leading-relaxed backdrop-blur-md">
                        <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                          🎙️ Full Scene Narration Script:
                        </p>
                        "{scene.narrationText || 'No narration text for this scene.'}"
                      </div>
                    </div>
                  </div>

                  <textarea
                    rows={2}
                    value={prompts[scene.sceneNumber] || ''}
                    onChange={(e) => setPrompts((prev) => ({ ...prev, [scene.sceneNumber]: e.target.value }))}
                    placeholder="Describe the visual scene..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 resize-none font-sans leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => fileInputRefs.current[scene.sceneNumber]?.click()}
                    disabled={isUploading}
                    className="py-2 px-3 rounded-xl text-xs font-bold bg-blue-950/80 border border-blue-800/80 hover:bg-blue-900/80 text-blue-300 flex items-center justify-center gap-1.5 transition shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5 text-blue-400" />
                    {isUploading ? 'Uploading...' : 'Browse Clip'}
                  </button>

                  <button
                    type="button"
                    onClick={() => regenSingleClip(scene.sceneNumber)}
                    disabled={isRegen || provider === 'dropclips'}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold bg-slate-950 border border-slate-800 text-slate-300 flex items-center justify-center gap-1.5 transition ${
                      provider === 'dropclips' ? 'opacity-40 cursor-not-allowed' : 'hover:border-slate-700'
                    }`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRegen ? 'animate-spin' : ''}`} />
                    {isRegen ? 'Generating...' : 'Auto Gen'}
                  </button>
                </div>
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
