import React, { useState, useEffect } from 'react';
import { ScriptOutput, NewsArticle, GeminiAnalysis, MasterPlan } from '../../backend/types';
import { Newspaper, Sparkles, Loader2, ArrowRight, Edit3, Code, Copy, History, RotateCcw, PlayCircle, CheckCircle2, Folder, FileText, ArrowUpRight, PlusCircle } from 'lucide-react';

interface Props {
  initialScript?: ScriptOutput | null;
  initialArticle?: NewsArticle | null;
  initialAnalysis?: GeminiAnalysis | null;
  initialRunId?: string | null;
  onResumeRun?: (data: {
    runId: string;
    article: NewsArticle | null;
    analysis: GeminiAnalysis | null;
    script: ScriptOutput | null;
    masterPlan: MasterPlan | null;
    clips: any[];
    finalVideoUrl: string | null;
    step: number;
  }) => void;
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
  onResumeRun,
  onComplete,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [article, setArticle] = useState<NewsArticle | null>(initialArticle || null);
  const [analysis, setAnalysis] = useState<GeminiAnalysis | null>(initialAnalysis || null);
  const [script, setScript] = useState<ScriptOutput | null>(initialScript || null);
  const [runId, setRunId] = useState<string | null>(initialRunId || null);
  const [editedScript, setEditedScript] = useState(initialScript?.fullScript || '');

  // 3-Way Creation Mode State: 'news' | 'custom' | 'history'
  const [creationMode, setCreationMode] = useState<'news' | 'custom' | 'history'>('news');

  // Way 1 State: Live News Provider
  const [newsSource, setNewsSource] = useState<'marketaux' | 'alphavantage' | 'benzinga' | 'finnhub'>('marketaux');

  // Way 2 State: Custom Script Input
  const [customTitle, setCustomTitle] = useState('');
  const [customText, setCustomText] = useState('');

  // Way 3 State: History & Past Runs
  const [pastRuns, setPastRuns] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [resumingRunId, setResumingRunId] = useState<string | null>(null);

  const loadPastRuns = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/runs');
      const data = await res.json();
      if (data.runs && Array.isArray(data.runs)) {
        setPastRuns(data.runs);
      }
    } catch (e) {
      console.error('Failed loading past runs:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadPastRuns();
  }, []);

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

  const handleCustomSubmit = async () => {
    if (!customText.trim()) {
      setError('Please enter your custom script narration text.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/wizard/step1-custom-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customTitle, customText }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed processing custom script');

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

  const handleResumeRun = async (targetRunId: string) => {
    setResumingRunId(targetRunId);
    try {
      const res = await fetch(`/api/runs/${targetRunId}/data`);
      const json = await res.json();
      if (json.success && json.data && onResumeRun) {
        onResumeRun(json.data);
      }
    } catch (err: any) {
      setError(`Failed loading run ${targetRunId}: ${err.message}`);
    } finally {
      setResumingRunId(null);
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
      {/* Generate / Input / History Container */}
      {!script && (
        <div className="glass-panel rounded-3xl p-8">
          <div className="max-w-4xl mx-auto text-center">
            
            {/* 3-Way Mode Switcher Tabs */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-8 p-1.5 bg-slate-950/80 border border-slate-800 rounded-2xl max-w-2xl mx-auto shadow-inner">
              <button
                type="button"
                onClick={() => setCreationMode('news')}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  creationMode === 'news'
                    ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-lg shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Newspaper className="w-4 h-4" /> Live Finance News API
              </button>

              <button
                type="button"
                onClick={() => setCreationMode('custom')}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  creationMode === 'custom'
                    ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-lg shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Edit3 className="w-4 h-4" /> Custom Script Input
              </button>

              <button
                type="button"
                onClick={() => {
                  setCreationMode('history');
                  loadPastRuns();
                }}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                  creationMode === 'history'
                    ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-lg shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <History className="w-4 h-4" /> Past Runs Studio ({pastRuns.length})
              </button>
            </div>

            {/* MODE 1: LIVE FINANCE NEWS API */}
            {creationMode === 'news' && (
              <div>
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-tr from-indigo-500 to-cyan-500 p-0.5 shadow-lg shadow-cyan-500/20">
                  <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                    <Newspaper className="w-7 h-7 text-cyan-400" />
                  </div>
                </div>
                <h2 className="text-xl font-extrabold text-white mb-2">Fetch Latest Finance News & Generate Script</h2>
                <p className="text-sm text-slate-400 mb-6 max-w-xl mx-auto">
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
              </div>
            )}

            {/* MODE 2: CUSTOM SCRIPT INPUT */}
            {creationMode === 'custom' && (
              <div className="text-left space-y-4 max-w-2xl mx-auto">
                <div className="text-center mb-4">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-500 p-0.5 shadow-lg shadow-cyan-500/20">
                    <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                      <Edit3 className="w-6 h-6 text-cyan-400" />
                    </div>
                  </div>
                  <h2 className="text-xl font-extrabold text-white mb-1">Write or Paste Your Custom Script</h2>
                  <p className="text-xs text-slate-400">
                    Enter your custom title/topic and full narration text below to proceed directly into scene planning & voice generation.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Topic / Headline (Optional)
                  </label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="e.g., Tech Stocks Surge: Apple & Nvidia Break All-Time Highs"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Narration Script Text <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    rows={6}
                    placeholder="Paste or type your full narration script text here (e.g. 50–200 words)..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 leading-relaxed focus:outline-none focus:border-cyan-500 resize-y"
                  />
                  <p className="text-[11px] text-slate-500 mt-1 flex justify-between">
                    <span>{customText.split(/\s+/).filter(Boolean).length} words</span>
                    <span>~{Math.max(10, Math.ceil(customText.split(/\s+/).filter(Boolean).length / 2.5))}s estimated duration</span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCustomSubmit}
                  disabled={loading || !customText.trim()}
                  className="glow-button w-full py-3.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-cyan-300" /> Processing Custom Script...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-cyan-300" /> Proceed with Custom Script <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}

            {/* MODE 3: HISTORY & PAST RUNS STUDIO */}
            {creationMode === 'history' && (
              <div className="text-left space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div>
                    <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                      <History className="w-5 h-5 text-cyan-400" /> Past Project Runs Studio ({pastRuns.length})
                    </h2>
                    <p className="text-xs text-slate-400">
                      Revisit previous video reel creations to resume progress, preview completed renders, or rerun scripts.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={loadPastRuns}
                    disabled={loadingHistory}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} /> Refresh Runs
                  </button>
                </div>

                {loadingHistory ? (
                  <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                    <span className="text-xs">Loading past project runs...</span>
                  </div>
                ) : pastRuns.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 bg-slate-950/60 rounded-2xl border border-slate-800 p-6">
                    <Folder className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <p className="text-sm font-semibold text-slate-400">No past runs found in workspace.</p>
                    <p className="text-xs text-slate-500 mt-1">Generate a new script above to create your first project run!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 max-h-[500px] overflow-y-auto pr-1">
                    {pastRuns.map((r) => (
                      <div
                        key={r.runId}
                        className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-extrabold font-mono px-2.5 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300">
                              {r.runId}
                            </span>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-400">
                              {r.stepLabel}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {r.formattedDate}
                            </span>
                          </div>

                          <h3 className="text-sm font-bold text-white truncate">
                            {r.title}
                          </h3>

                          {r.scriptSnippet && (
                            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                              "{r.scriptSnippet}"
                            </p>
                          )}
                        </div>

                        {/* Actions for Past Run */}
                        <div className="flex items-center gap-2 shrink-0">
                          {r.hasRender && r.finalVideoUrl && (
                            <a
                              href={r.finalVideoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-950 border border-emerald-700 text-emerald-300 hover:bg-emerald-900 flex items-center gap-1.5 transition"
                            >
                              <PlayCircle className="w-4 h-4 text-emerald-400" /> Watch Reel
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => handleResumeRun(r.runId)}
                            disabled={resumingRunId === r.runId}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-600/40 flex items-center gap-1.5 transition shadow-sm"
                          >
                            {resumingRunId === r.runId ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-300" /> Resuming...
                              </>
                            ) : (
                              <>
                                <RotateCcw className="w-3.5 h-3.5 text-cyan-300" /> Resume / Continue Run
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

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
