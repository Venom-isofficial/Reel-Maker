import React from 'react';
import { PipelineState } from '../../backend/types';
import { StageProgress } from './StageProgress';
import { SceneGrid } from './SceneGrid';
import { LogViewer } from './LogViewer';
import { PreviewPlayer } from './PreviewPlayer';
import { Sparkles, Play, Activity, FolderCheck, AlertTriangle } from 'lucide-react';

interface DashboardProps {
  pipelineState: PipelineState | null;
  runs: Array<{ runId: string; created: Date; hasRender: boolean }>;
  runFiles: string[];
  logs: string[];
  onStartPipeline: () => void;
  onRetryScene: (sceneNumber: number) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  pipelineState,
  runs,
  runFiles,
  logs,
  onStartPipeline,
  onRetryScene,
}) => {
  const isRunning = pipelineState?.status === 'running';

  return (
    <div className="space-y-6">
      {/* Top Banner & Launch Reel Button */}
      <div className="glass-panel rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute -top-12 -left-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="z-10 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-3">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Desktop-First AI Short Video Engine
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            AI Reel Factory Pipeline
          </h1>
          <p className="text-slate-400 text-xs md:text-sm mt-1.5 leading-relaxed">
            Convert financial news into vertical Reels complete with Veo visual clips, Gemini TTS audio narration, and animated word-by-word captions.
          </p>
        </div>

        <div className="z-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <button
            onClick={onStartPipeline}
            disabled={isRunning}
            className={`glow-button px-7 py-3.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2.5 ${
              isRunning ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isRunning ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                Pipeline In Progress...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" /> Generate Reel
              </>
            )}
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-slate-400 font-medium">Total Runs Executed</p>
          <p className="text-xl font-extrabold text-white mt-1">{runs.length}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-slate-400 font-medium">Current Active Folder</p>
          <p className="text-xl font-extrabold text-cyan-400 mt-1 font-mono">{pipelineState?.runId || (runs[0]?.runId || 'run_0001')}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-slate-400 font-medium">Overall Progress</p>
          <p className="text-xl font-extrabold text-indigo-400 mt-1">{pipelineState?.overallProgress || 0}%</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-slate-400 font-medium">Status</p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isRunning ? 'bg-amber-400 animate-ping' : pipelineState?.status === 'completed' ? 'bg-emerald-400' : 'bg-slate-500'
              }`}
            />
            <span className="text-sm font-semibold capitalize text-slate-200">
              {pipelineState?.status || 'Idle'}
            </span>
          </div>
        </div>
      </div>

      {/* Stage Progress (10 Steps) */}
      {pipelineState && <StageProgress stages={pipelineState.stages} />}

      {/* Scene Generation Grid */}
      <SceneGrid
        scenes={Object.values(pipelineState?.sceneProgress || {})}
        runId={pipelineState?.runId || runs[0]?.runId}
        onRetryScene={onRetryScene}
      />

      {/* Bottom Row: Preview & Execution Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <PreviewPlayer
            runId={pipelineState?.runId || runs[0]?.runId}
            files={runFiles}
            hasRender={pipelineState?.status === 'completed' || runs[0]?.hasRender}
          />
        </div>
        <div className="lg:col-span-5">
          <LogViewer logs={logs} />
        </div>
      </div>
    </div>
  );
};
