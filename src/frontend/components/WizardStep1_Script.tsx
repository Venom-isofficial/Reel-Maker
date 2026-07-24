import React, { useState } from 'react';
import { ScriptOutput, NewsArticle, GeminiAnalysis } from '../../backend/types';
import { Newspaper, Sparkles, Loader2, ArrowRight, Edit3 } from 'lucide-react';

interface Props {
  onComplete: (data: {
    article: NewsArticle;
    analysis: GeminiAnalysis;
    script: ScriptOutput;
    runId: string;
  }) => void;
}

export const WizardStep1_Script: React.FC<Props> = ({ onComplete }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [analysis, setAnalysis] = useState<GeminiAnalysis | null>(null);
  const [script, setScript] = useState<ScriptOutput | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [editedScript, setEditedScript] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/wizard/step1-script', { method: 'POST' });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to generate script');

      setArticle(data.article);
      setAnalysis(data.analysis);
      setScript(data.script);
      setRunId(data.runId);
      setEditedScript(data.script.fullScript);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (!script || !article || !analysis || !runId) return;

    // Build updated script with edited fullScript
    const updatedScript: ScriptOutput = {
      ...script,
      fullScript: editedScript,
    };

    onComplete({ article, analysis, script: updatedScript, runId });
  };

  return (
    <div className="space-y-6">
      {/* Generate Button (Initial State) */}
      {!script && (
        <div className="glass-panel rounded-3xl p-8 text-center">
          <div className="max-w-lg mx-auto">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-tr from-indigo-500 to-cyan-500 p-0.5 shadow-lg shadow-cyan-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Newspaper className="w-7 h-7 text-cyan-400" />
              </div>
            </div>
            <h2 className="text-xl font-extrabold text-white mb-2">Fetch Latest News & Generate Script</h2>
            <p className="text-sm text-slate-400 mb-6">
              This will fetch the latest financial headline, analyze it with AI, and generate a narration script for your reel.
            </p>
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="glow-button px-8 py-3.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2.5 mx-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Generating Script...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Generate Script
                </>
              )}
            </button>
            {error && (
              <p className="text-rose-400 text-xs mt-4 bg-rose-950/40 border border-rose-800/50 rounded-xl px-4 py-2">{error}</p>
            )}
          </div>
        </div>
      )}

      {/* Results: Headline + Editable Script */}
      {script && article && (
        <>
          {/* Article Info */}
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <Newspaper className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-1">News Headline</h3>
                <p className="text-lg font-bold text-white leading-tight">{article.headline}</p>
                <p className="text-xs text-slate-400 mt-1">
                  Source: {article.source} • Category: {article.category}
                </p>
              </div>
            </div>
          </div>

          {/* Analysis Summary */}
          {analysis && (
            <div className="glass-panel rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" /> AI Analysis
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
                  <p className="text-[10px] text-slate-500 uppercase">Topic</p>
                  <p className="text-sm font-bold text-white">{analysis.topic}</p>
                </div>
                <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
                  <p className="text-[10px] text-slate-500 uppercase">Sentiment</p>
                  <p className={`text-sm font-bold ${analysis.sentiment === 'Bullish' ? 'text-emerald-400' : analysis.sentiment === 'Bearish' ? 'text-rose-400' : 'text-amber-400'}`}>
                    {analysis.sentiment}
                  </p>
                </div>
                <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
                  <p className="text-[10px] text-slate-500 uppercase">Importance</p>
                  <p className="text-sm font-bold text-indigo-400">{analysis.importance}/10</p>
                </div>
                <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
                  <p className="text-[10px] text-slate-500 uppercase">Keywords</p>
                  <p className="text-xs text-slate-300 truncate">{analysis.keywords.slice(0, 3).join(', ')}</p>
                </div>
              </div>
            </div>
          )}

          {/* Editable Script */}
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" /> Narration Script
              </h3>
              <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
                Editable — modify before proceeding
              </span>
            </div>

            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1 font-medium">Hook</label>
              <input
                type="text"
                value={script.hook}
                readOnly
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1 font-medium">Full Narration Text</label>
              <textarea
                value={editedScript}
                onChange={(e) => setEditedScript(e.target.value)}
                rows={6}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 leading-relaxed focus:outline-none focus:border-cyan-500 resize-y"
              />
              <p className="text-[10px] text-slate-500 mt-1">{editedScript.split(' ').length} words • ~{Math.ceil(editedScript.split(' ').length / 2.8)}s estimated duration</p>
            </div>
          </div>

          {/* Next Button */}
          <div className="flex justify-end">
            <button
              onClick={handleNext}
              className="glow-button px-7 py-3.5 rounded-2xl text-sm font-bold text-white flex items-center gap-2.5"
            >
              Next: Scene Planning <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
};
