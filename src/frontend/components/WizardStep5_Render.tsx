import React, { useState, useEffect } from 'react';
import { Film, Loader2, ArrowLeft } from 'lucide-react';

interface Props {
  runId: string;
  onComplete: (data: { finalVideoUrl: string }) => void;
  onBack: () => void;
}

export const WizardStep5_Render: React.FC<Props> = ({ runId, onComplete, onBack }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    startRender();
  }, []);

  // Simulate progress since the actual render doesn't stream progress
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) return prev; // Cap at 92% until complete
        return prev + Math.random() * 3;
      });
    }, 1500);
    return () => clearInterval(interval);
  }, [loading]);

  const startRender = async () => {
    setLoading(true);
    setError(null);
    setProgress(5);
    try {
      const res = await fetch('/api/wizard/step5-render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Render failed');

      setProgress(100);
      setTimeout(() => {
        onComplete({ finalVideoUrl: data.finalVideoUrl });
      }, 800);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="glass-panel rounded-3xl p-10 text-center">
        <div className="max-w-md mx-auto">
          {loading ? (
            <>
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-tr from-indigo-500 to-cyan-500 p-0.5 shadow-lg shadow-cyan-500/20">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                  <Film className="w-8 h-8 text-cyan-400 animate-pulse" />
                </div>
              </div>
              <h2 className="text-xl font-extrabold text-white mb-2">Rendering Your Reel</h2>
              <p className="text-sm text-slate-400 mb-6">
                Generating captions, stitching clips, and compositing with Remotion...
              </p>

              {/* Progress Bar */}
              <div className="w-full bg-slate-800/80 rounded-full h-3 mb-3 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 transition-all duration-500"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 font-mono">{Math.round(progress)}% complete</p>

              <div className="mt-6 flex items-center justify-center gap-2 text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">This typically takes 1-3 minutes...</span>
              </div>
            </>
          ) : error ? (
            <>
              <h2 className="text-xl font-extrabold text-rose-400 mb-2">Render Failed</h2>
              <p className="text-sm text-slate-400 mb-4">{error}</p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={onBack}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 border border-slate-800 hover:bg-slate-900/50 flex items-center gap-2 transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Clips
                </button>
                <button
                  onClick={startRender}
                  className="glow-button px-6 py-2.5 rounded-xl text-xs font-bold text-white"
                >
                  Retry Render
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
