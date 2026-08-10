import React, { useState } from 'react';
import { ScriptOutput, NewsArticle, GeminiAnalysis } from '../../backend/types';
import { Newspaper, Sparkles, Loader2, ArrowRight, Edit3, Code, Copy } from 'lucide-react';

interface Props {
  initialScript?: ScriptOutput | null;
  initialArticle?: NewsArticle | null;
  initialAnalysis?: GeminiAnalysis | null;
  initialRunId?: string | null;
  onComplete: (data: {
    article: NewsArticle;
    analysis: GeminiAnalysis;
    script: ScriptOutput;
    runId: string;
  }) => void;
}

export const WizardStep1_Script: React.FC<Props> = ({
  initialScript,
  initialArticle,
  initialAnalysis,
  initialRunId,
  onComplete,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [article, setArticle] = useState<NewsArticle | null>(initialArticle || null);
  const [analysis, setAnalysis] = useState<GeminiAnalysis | null>(initialAnalysis || null);
  const [script, setScript] = useState<ScriptOutput | null>(initialScript || null);
  const [runId, setRunId] = useState<string | null>(initialRunId || null);
  const [editedScript, setEditedScript] = useState(initialScript?.fullScript || '');
  const [newsSource, setNewsSource] = useState<'marketaux' | 'alphavantage' | 'benzinga' | 'finnhub'>('marketaux');

  const handleGenerate = async (overrideSource?: 'marketaux' | 'alphavantage' | 'benzinga' | 'finnhub') => {
    const targetSource = overrideSource || newsSource;
    if (overrideSource) setNewsSource(overrideSource);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/wizard/step1-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newsSource: targetSource }),
      });
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

  const getSourceLabel = (src: string) => {
    switch (src) {
      case 'alphavantage': return 'Alpha Vantage';
      case 'benzinga': return 'Benzinga';
      case 'finnhub': return 'Finnhub';
      default: return 'Marketaux';
    }
  };

  return (
    <div className="space-y-6">
      {/* Generate Button (Initial State) */}
      {!script && (
        <div className="glass-panel rounded-3xl p-8 text-center">
          <div className="max-w-3xl mx-auto">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-tr from-indigo-500 to-cyan-500 p-0.5 shadow-lg shadow-cyan-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Newspaper className="w-7 h-7 text-cyan-400" />
              </div>
            </div>
            <h2 className="text-xl font-extrabold text-white mb-2">Fetch Latest Finance News & Generate Script</h2>
            <p className="text-sm text-slate-400 mb-6">
              Select your preferred financial news source provider below, then click Generate Script.
            </p>

            {/* News Provider Selection Option Cards (4 Providers) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left mb-7">
              <button
                type="button"
                onClick={() => setNewsSource('marketaux')}
                className={`p-4 rounded-2xl border transition-all ${
                  newsSource === 'marketaux'
                    ? 'bg-gradient-to-br from-cyan-950/60 to-indigo-950/60 border-cyan-500 shadow-lg shadow-cyan-500/10'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-white flex items-center gap-2">
                    📈 Marketaux API
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-400">
                    Recommended
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Real-time global stock market intelligence, business news & ticker feeds.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setNewsSource('alphavantage')}
                className={`p-4 rounded-2xl border transition-all ${
                  newsSource === 'alphavantage'
                    ? 'bg-gradient-to-br from-indigo-950/60 to-blue-950/60 border-indigo-500 shadow-lg shadow-indigo-500/10'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-white flex items-center gap-2">
                    ⚡ Alpha Vantage API
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-950 border border-blue-700 text-blue-300">
                    Sentiment AI
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Wall Street market news with real-time sentiment scoring & topics.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setNewsSource('benzinga')}
                className={`p-4 rounded-2xl border transition-all ${
                  newsSource === 'benzinga'
                    ? 'bg-gradient-to-br from-amber-950/60 to-orange-950/60 border-amber-500 shadow-lg shadow-amber-500/10'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-white flex items-center gap-2">
                    📰 Benzinga API
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-950 border border-amber-700 text-amber-300">
                    Stock News
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Real-time stock market breaking news & analyst coverage.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setNewsSource('finnhub')}
                className={`p-4 rounded-2xl border transition-all ${
                  newsSource === 'finnhub'
                    ? 'bg-gradient-to-br from-purple-950/60 to-slate-950/60 border-purple-500 shadow-lg shadow-purple-500/10'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-white flex items-center gap-2">
                    🏛️ Finnhub API
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400">
                    General News
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  General market news & company announcements from Finnhub API.
                </p>
              </button>
            </div>

            <button
              onClick={() => handleGenerate()}
              disabled={loading}
              className="glow-button px-8 py-3.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2.5 mx-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Fetching {getSourceLabel(newsSource)} News...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Generate Script from {getSourceLabel(newsSource)}
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
          {/* Raw API Response Data Panel (Exact JSON output from API) */}
          <div className="glass-panel rounded-2xl p-5 border border-cyan-500/30">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Raw API Data (Exact Provider Response)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300">
                  Provider: {article.source}
                </span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(article.rawData || article, null, 2))}
                  className="text-[11px] text-slate-400 hover:text-white bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg flex items-center gap-1 transition"
                >
                  <Copy className="w-3 h-3 text-cyan-400" /> Copy JSON
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Below is the exact raw data structure returned directly from the selected API endpoint before processing:
            </p>
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 overflow-x-auto max-h-72 font-mono text-xs text-emerald-400 leading-relaxed shadow-inner">
              <pre>{JSON.stringify(article.rawData || article, null, 2)}</pre>
            </div>
          </div>

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
              <p className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                <span>{editedScript.split(' ').filter(Boolean).length} words • ~{Math.ceil(editedScript.split(' ').filter(Boolean).length / 2.7)}s speech target</span>
                <span className={editedScript.split(' ').filter(Boolean).length <= 75 ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                  {editedScript.split(' ').filter(Boolean).length <= 75 ? '⚡ Ideal for 25–30s Reel' : '⚠️ Long text: may exceed 30s'}
                </span>
              </p>
            </div>
          </div>

          {/* Refetch & Provider Switcher Action Toolbar */}
          <div className="glass-panel rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-400">Generate From API:</span>
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => handleGenerate('marketaux')}
                  disabled={loading}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    newsSource === 'marketaux'
                      ? 'bg-cyan-950 border border-cyan-700 text-cyan-300 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  📈 Marketaux
                </button>

                <button
                  type="button"
                  onClick={() => handleGenerate('alphavantage')}
                  disabled={loading}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    newsSource === 'alphavantage'
                      ? 'bg-indigo-950 border border-indigo-700 text-indigo-300 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  ⚡ Alpha Vantage
                </button>

                <button
                  type="button"
                  onClick={() => handleGenerate('benzinga')}
                  disabled={loading}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    newsSource === 'benzinga'
                      ? 'bg-amber-950 border border-amber-700 text-amber-300 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  📰 Benzinga
                </button>

                <button
                  type="button"
                  onClick={() => handleGenerate('finnhub')}
                  disabled={loading}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    newsSource === 'finnhub'
                      ? 'bg-purple-950 border border-purple-700 text-purple-300 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  🏛️ Finnhub
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              <button
                onClick={() => handleGenerate()}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 bg-slate-900 border border-slate-800 hover:bg-slate-800 flex items-center gap-2 transition"
              >
                <Sparkles className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : 'text-amber-400'}`} />
                {loading ? `Fetching ${getSourceLabel(newsSource)}...` : `Refetch ${getSourceLabel(newsSource)}`}
              </button>

              <button
                onClick={handleNext}
                disabled={loading}
                className="glow-button px-6 py-3 rounded-2xl text-sm font-bold text-white flex items-center gap-2 shadow-lg shadow-cyan-500/10 shrink-0"
              >
                Next: Scene Planning <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
