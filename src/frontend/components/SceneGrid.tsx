import React from 'react';
import { SceneItem } from '../../backend/types';
import { Video, RefreshCw, CheckCircle, AlertTriangle, Play } from 'lucide-react';

interface SceneGridProps {
  scenes: SceneItem[];
  runId?: string;
  onRetryScene: (sceneNumber: number) => void;
}

export const SceneGrid: React.FC<SceneGridProps> = ({ scenes, runId, onRetryScene }) => {
  if (!scenes || scenes.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-6 text-center text-slate-400">
        <Video className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Scene visual plan will populate once Step 4 completes.</p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <Video className="w-5 h-5 text-indigo-400" />
          Veo AI Scene Generation Grid ({scenes.length} Scenes)
        </h2>
        <span className="text-xs text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
          Independent Scene Pipeline
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {scenes.map((scene) => (
          <div key={scene.sceneNumber} className="glass-card rounded-xl p-4 flex flex-col justify-between border border-slate-800">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold font-mono text-cyan-400">
                  SCENE {String(scene.sceneNumber).padStart(2, '0')}
                </span>
                <span className="text-[11px] text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded">
                  {scene.durationSeconds || 5}s
                </span>
              </div>

              <p className="text-xs text-slate-300 line-clamp-2 mb-3 italic">
                "{scene.narrationText}"
              </p>

              <div className="bg-slate-950/80 rounded-lg p-2.5 mb-3 border border-slate-800/80">
                <p className="text-[11px] font-mono text-slate-400 uppercase mb-1">Veo Prompt:</p>
                <p className="text-[11px] text-slate-400 line-clamp-2">{scene.videoPrompt}</p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {scene.status === 'completed' ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                    <CheckCircle className="w-3.5 h-3.5" /> Ready
                  </span>
                ) : scene.status === 'failed' ? (
                  <span className="inline-flex items-center gap-1 text-xs text-rose-400">
                    <AlertTriangle className="w-3.5 h-3.5" /> Failed
                  </span>
                ) : scene.status === 'retrying' ? (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Retrying
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">Pending</span>
                )}
              </div>

              {scene.status === 'failed' && (
                <button
                  onClick={() => onRetryScene(scene.sceneNumber)}
                  className="text-xs px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 flex items-center gap-1 transition"
                >
                  <RefreshCw className="w-3 h-3" /> Retry
                </button>
              )}

              {scene.status === 'completed' && runId && (
                <a
                  href={`/api/runs/${runId}/file/clips/scene_${String(scene.sceneNumber).padStart(2, '0')}.mp4`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <Play className="w-3 h-3" /> Play Clip
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
