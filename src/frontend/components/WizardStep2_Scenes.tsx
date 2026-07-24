import React, { useState, useEffect } from 'react';
import { ScriptOutput, MasterPlan, SceneItem } from '../../backend/types';
import { Clapperboard, Loader2, ArrowRight, ArrowLeft, Plus, Trash2, Edit3 } from 'lucide-react';

interface Props {
  script: ScriptOutput;
  runId: string;
  onComplete: (data: { masterPlan: MasterPlan }) => void;
  onBack: () => void;
}

export const WizardStep2_Scenes: React.FC<Props> = ({ script, runId, onComplete, onBack }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scenes, setScenes] = useState<SceneItem[]>([]);
  const [totalDuration, setTotalDuration] = useState(35);

  useEffect(() => {
    generateScenes();
  }, []);

  const generateScenes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/wizard/step2-scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script, runId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Scene planning failed');
      setScenes(data.masterPlan.scenes);
      setTotalDuration(data.masterPlan.totalDuration);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateScene = (index: number, field: keyof SceneItem, value: any) => {
    setScenes((prev) => {
      const updated = [...prev];
      (updated[index] as any)[field] = value;
      return updated;
    });
  };

  const addScene = () => {
    const newScene: SceneItem = {
      sceneNumber: scenes.length + 1,
      durationSeconds: 5,
      narrationText: '',
      subtitleText: '',
      videoPrompt: 'business corporate stock footage',
      transition: 'fade',
      status: 'pending',
      retries: 0,
    };
    setScenes((prev) => [...prev, newScene]);
  };

  const removeScene = (index: number) => {
    setScenes((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((s, i) => ({ ...s, sceneNumber: i + 1 }));
    });
  };

  const handleNext = () => {
    const computedDuration = scenes.reduce((acc, s) => acc + (s.durationSeconds || 5), 0);
    const masterPlan: MasterPlan = {
      totalDuration: computedDuration,
      scenes,
    };
    onComplete({ masterPlan });
  };

  if (loading) {
    return (
      <div className="glass-panel rounded-2xl p-12 text-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-300">Generating scene plan...</p>
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
          <Clapperboard className="w-5 h-5 text-indigo-400" />
          <div>
            <h2 className="text-lg font-bold text-white">Scene Plan</h2>
            <p className="text-xs text-slate-400">{scenes.length} scenes • ~{scenes.reduce((a, s) => a + (s.durationSeconds || 5), 0)}s total</p>
          </div>
        </div>
        <button
          onClick={addScene}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-600/40 flex items-center gap-1.5 transition"
        >
          <Plus className="w-3.5 h-3.5" /> Add Scene
        </button>
      </div>

      {/* Scene Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {scenes.map((scene, idx) => (
          <div key={idx} className="glass-card rounded-xl p-4 border border-slate-800 relative group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold font-mono text-cyan-400">
                SCENE {String(scene.sceneNumber).padStart(2, '0')}
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={2}
                  max={15}
                  value={scene.durationSeconds}
                  onChange={(e) => updateScene(idx, 'durationSeconds', parseInt(e.target.value) || 5)}
                  className="w-14 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-center text-white"
                />
                <span className="text-[10px] text-slate-500">sec</span>
                {scenes.length > 2 && (
                  <button
                    onClick={() => removeScene(idx)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-rose-950/60 text-rose-400 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Narration Text</label>
                <textarea
                  value={scene.narrationText}
                  onChange={(e) => updateScene(idx, 'narrationText', e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-0.5">Video Search Prompt</label>
                <input
                  type="text"
                  value={scene.videoPrompt}
                  onChange={(e) => updateScene(idx, 'videoPrompt', e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 border border-slate-800 hover:bg-slate-900/50 flex items-center gap-2 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Script
        </button>
        <button
          onClick={handleNext}
          className="glow-button px-7 py-3.5 rounded-2xl text-sm font-bold text-white flex items-center gap-2.5"
        >
          Next: Voice Narration <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
