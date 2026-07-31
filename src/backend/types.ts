export type StageStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'retrying';

export interface PipelineStage {
  id: string;
  name: string;
  stepNumber: number;
  status: StageStatus;
  progressPercent: number;
  startTime?: number;
  endTime?: number;
  error?: string;
  retries: number;
}

export interface NewsArticle {
  id: string;
  headline: string;
  summary: string;
  url: string;
  source: string;
  datetime: number;
  category: string;
  fullText?: string;
}

export interface GeminiAnalysis {
  summary: string;
  keywords: string[];
  entities: string[];
  importance: number;
  topic: string;
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
}

export interface ScriptOutput {
  hook: string;
  introduction: string;
  body: string;
  ending: string;
  cta: string;
  fullScript: string;
}

export interface SceneItem {
  sceneNumber: number;
  durationSeconds: number;
  narrationText: string;
  subtitleText: string;
  videoPrompt: string;
  visualPrompt?: string;
  searchKeyword?: string;
  transition: string;
  clipPath?: string;
  status: StageStatus;
  error?: string;
  retries: number;
}

export interface MasterPlan {
  totalDuration: number;
  scenes: SceneItem[];
}

export interface SceneKeywordItem {
  sceneNumber: number;
  searchKeyword: string;
}

export interface VideoKeywords {
  scenes: SceneKeywordItem[];
}

export interface VideoMetadata {
  title: string;
  description: string;
  hashtags: string[];
  thumbnailText: string;
  suggestedFilename: string;
}

export interface CaptionWord {
  word: string;
  start: number; // Seconds
  end: number;   // Seconds
}

export interface CaptionData {
  fullText: string;
  words: CaptionWord[];
}

export interface ServiceResult<T = any> {
  success: boolean;
  retryable: boolean;
  data?: T;
  errorMessage?: string;
}

export interface PipelineState {
  runId: string;
  runDir: string;
  currentStageId: string;
  overallProgress: number;
  status: 'idle' | 'running' | 'completed' | 'failed';
  stages: PipelineStage[];
  sceneProgress: Record<number, SceneItem>;
  logs: string[];
  error?: string;
}

// --- Wizard Step-by-Step State ---

export type WizardStepId = 1 | 2 | 3 | 4 | 5 | 6;

export interface WizardState {
  runId: string;
  runDir: string;
  currentStep: WizardStepId;
  article?: NewsArticle;
  analysis?: GeminiAnalysis;
  script?: ScriptOutput;
  masterPlan?: MasterPlan;
  metadata?: VideoMetadata;
  voicePath?: string;
  voiceDuration?: number;
  clips?: Array<{ sceneNumber: number; clipPath: string; searchKeyword: string }>;
  finalVideoPath?: string;
}

export interface AppSettings {
  finnhubApiKey: string;
  geminiApiKey: string;
  pexelsApiKey: string;
  whisperApiKey: string;
  elevenLabsApiKey?: string;
  muapiApiKey?: string;
  vadooApiKey?: string;
  ttsProvider?: string;
  kokoroVoice: string;
  whisperDevice?: string;
  whisperComputeType?: string;
  hardwareAcceleration?: string;
  outputFolder: string;
  videoQuality: string;
  voice: string;
  subtitleStyle: string;
  theme: string;
  logoUrl?: string;
  watermarkText?: string;
  bgMusicPath?: string;
}
