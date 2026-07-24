import React from 'react';
import { PipelineStage } from '../../backend/types';
import { CheckCircle2, Circle, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

interface StageProgressProps {
  stages: PipelineStage[];
}

export const StageProgress: React.FC<StageProgressProps> = ({ stages }) => {
  return (
    <div className="glass-panel rounded-2xl p-6 mb-6">
      <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
        Pipeline Stage Tracker (10 Steps)
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {stages.map((stage) => {
          let badgeColor = 'border-slate-800 text-slate-400 bg-slate-900/40';
          let icon = <Circle className="w-4 h-4 text-slate-500" />;

          if (stage.status === 'in_progress') {
            badgeColor = 'border-cyan-500/50 text-cyan-300 bg-cyan-950/40 shadow-sm shadow-cyan-500/20';
            icon = <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />;
          } else if (stage.status === 'completed') {
            badgeColor = 'border-emerald-500/40 text-emerald-300 bg-emerald-950/30';
            icon = <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
          } else if (stage.status === 'failed') {
            badgeColor = 'border-rose-500/50 text-rose-300 bg-rose-950/40';
            icon = <AlertCircle className="w-4 h-4 text-rose-400" />;
          } else if (stage.status === 'retrying') {
            badgeColor = 'border-amber-500/50 text-amber-300 bg-amber-950/40';
            icon = <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />;
          }

          return (
            <div
              key={stage.id}
              className={`flex flex-col justify-between p-3.5 rounded-xl border transition-all ${badgeColor}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-bold text-slate-400">
                  STEP {stage.stepNumber}
                </span>
                {icon}
              </div>
              <div>
                <p className="text-xs font-medium text-slate-200 truncate">{stage.name}</p>
                <div className="w-full bg-slate-800/80 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      stage.status === 'completed'
                        ? 'bg-emerald-400'
                        : stage.status === 'failed'
                        ? 'bg-rose-500'
                        : 'bg-gradient-to-r from-cyan-500 to-indigo-500'
                    }`}
                    style={{ width: `${stage.status === 'completed' ? 100 : stage.status === 'in_progress' ? 65 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
