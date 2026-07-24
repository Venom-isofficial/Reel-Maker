import React, { useState } from 'react';
import { WizardStep1_Script } from './WizardStep1_Script';
import { WizardStep2_Scenes } from './WizardStep2_Scenes';
import { WizardStep3_Voice } from './WizardStep3_Voice';
import { WizardStep4_Clips } from './WizardStep4_Clips';
import { WizardStep5_Render } from './WizardStep5_Render';
import { WizardStep6_Preview } from './WizardStep6_Preview';
import { ScriptOutput, MasterPlan, NewsArticle, GeminiAnalysis, VideoMetadata } from '../../backend/types';
import { Sparkles, CheckCircle2, Circle, ArrowLeft } from 'lucide-react';

const STEPS = [
  { id: 1, label: 'Script', icon: '📝' },
  { id: 2, label: 'Scenes', icon: '🎬' },
  { id: 3, label: 'Voice', icon: '🎙️' },
  { id: 4, label: 'Clips', icon: '📹' },
  { id: 5, label: 'Render', icon: '🎞️' },
  { id: 6, label: 'Preview', icon: '🎉' },
];

export const WizardView: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [runId, setRunId] = useState<string | null>(null);

  // Data passed between steps
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [analysis, setAnalysis] = useState<GeminiAnalysis | null>(null);
  const [script, setScript] = useState<ScriptOutput | null>(null);
  const [masterPlan, setMasterPlan] = useState<MasterPlan | null>(null);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [clips, setClips] = useState<Array<{ sceneNumber: number; clipUrl: string; searchKeyword: string; status: string }>>([]);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);

  const handleReset = () => {
    setCurrentStep(1);
    setRunId(null);
    setArticle(null);
    setAnalysis(null);
    setScript(null);
    setMasterPlan(null);
    setMetadata(null);
    setClips([]);
    setFinalVideoUrl(null);
  };

  return (
    <div className="space-y-6">
      {/* Step Indicator Bar */}
      <div className="glass-panel rounded-3xl p-5 relative overflow-hidden">
        <div className="absolute -top-16 -left-16 w-56 h-56 bg-indigo-500/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-56 h-56 bg-cyan-500/8 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between mb-4 z-10 relative">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-cyan-400 to-pink-500 p-0.5 shadow-lg shadow-cyan-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-cyan-400" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white tracking-tight">Create New Reel</h1>
              <p className="text-[11px] text-slate-400">Step-by-step interactive reel creation</p>
            </div>
          </div>
          {runId && (
            <span className="text-xs font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-800/60 px-3 py-1 rounded-full">
              {runId}
            </span>
          )}
        </div>

        {/* Step Pills */}
        <div className="flex items-center gap-2 z-10 relative">
          {STEPS.map((step, idx) => {
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;
            const isClickable = step.id < currentStep;

            return (
              <React.Fragment key={step.id}>
                {idx > 0 && (
                  <div className={`flex-1 h-0.5 rounded-full transition-all ${isCompleted ? 'bg-emerald-500' : 'bg-slate-800'}`} />
                )}
                <button
                  onClick={() => isClickable && setCurrentStep(step.id)}
                  disabled={!isClickable}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-lg shadow-indigo-500/30'
                      : isCompleted
                      ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-700/50 cursor-pointer hover:bg-emerald-900/40'
                      : 'bg-slate-900/50 text-slate-500 border border-slate-800/60'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : isActive ? (
                    <span className="text-sm">{step.icon}</span>
                  ) : (
                    <Circle className="w-3.5 h-3.5 text-slate-600" />
                  )}
                  {step.label}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      {currentStep === 1 && (
        <WizardStep1_Script
          onComplete={(data) => {
            setRunId(data.runId);
            setArticle(data.article);
            setAnalysis(data.analysis);
            setScript(data.script);
            setCurrentStep(2);
          }}
        />
      )}

      {currentStep === 2 && script && runId && (
        <WizardStep2_Scenes
          script={script}
          runId={runId}
          onComplete={(data) => {
            setMasterPlan(data.masterPlan);
            setCurrentStep(3);
          }}
          onBack={() => setCurrentStep(1)}
        />
      )}

      {currentStep === 3 && script && runId && (
        <WizardStep3_Voice
          script={script}
          runId={runId}
          onComplete={() => setCurrentStep(4)}
          onBack={() => setCurrentStep(2)}
        />
      )}

      {currentStep === 4 && masterPlan && runId && (
        <WizardStep4_Clips
          masterPlan={masterPlan}
          runId={runId}
          onComplete={(data) => {
            setClips(data.clips);
            setCurrentStep(5);
          }}
          onBack={() => setCurrentStep(3)}
        />
      )}

      {currentStep === 5 && runId && (
        <WizardStep5_Render
          runId={runId}
          onComplete={(data) => {
            setFinalVideoUrl(data.finalVideoUrl);
            setCurrentStep(6);
          }}
          onBack={() => setCurrentStep(4)}
        />
      )}

      {currentStep === 6 && runId && finalVideoUrl && (
        <WizardStep6_Preview
          runId={runId}
          finalVideoUrl={finalVideoUrl}
          onNewReel={handleReset}
          onBack={() => setCurrentStep(5)}
        />
      )}
    </div>
  );
};
