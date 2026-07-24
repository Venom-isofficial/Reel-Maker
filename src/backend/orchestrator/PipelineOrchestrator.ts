import fs from 'fs';
import path from 'path';
import { StorageService } from '../services/StorageService';
import { LoggingService } from '../services/LoggingService';
import { NewsService } from '../services/NewsService';
import { AIService } from '../services/AIService';
import { VoiceService } from '../services/VoiceService';
import { SubtitleService } from '../services/SubtitleService';
import { VideoService } from '../services/VideoService';
import { RemotionService } from '../services/RemotionService';
import {
  PipelineStage, PipelineState, WizardState, WizardStepId,
  NewsArticle, GeminiAnalysis, ScriptOutput, MasterPlan,
  VideoMetadata, SceneItem
} from '../types';

export class PipelineOrchestrator {
  private storageService: StorageService;
  private logger: LoggingService;
  private newsService: NewsService;
  private aiService: AIService;
  private voiceService: VoiceService;
  private subtitleService: SubtitleService;
  private videoService: VideoService;
  private remotionService: RemotionService;

  private currentState?: PipelineState;
  private wizardState?: WizardState;
  private isRunning: boolean = false;

  constructor(
    storageService: StorageService,
    logger: LoggingService,
    newsService: NewsService,
    aiService: AIService,
    voiceService: VoiceService,
    subtitleService: SubtitleService,
    videoService: VideoService,
    remotionService: RemotionService
  ) {
    this.storageService = storageService;
    this.logger = logger;
    this.newsService = newsService;
    this.aiService = aiService;
    this.voiceService = voiceService;
    this.subtitleService = subtitleService;
    this.videoService = videoService;
    this.remotionService = remotionService;
  }

  public getCurrentState(): PipelineState | null {
    return this.currentState || null;
  }

  public getWizardState(): WizardState | null {
    return this.wizardState || null;
  }

  // ========================================================================
  //  WIZARD STEP 1: Fetch News → Analyze → Generate Script
  // ========================================================================
  public async wizardStep1_Script(): Promise<{
    article: NewsArticle;
    analysis: GeminiAnalysis;
    script: ScriptOutput;
    runId: string;
    runDir: string;
  }> {
    const { runId, runDir } = this.storageService.createNextRun();
    this.logger.setRunDir(runDir);

    this.wizardState = {
      runId,
      runDir,
      currentStep: 1,
    };

    this.logger.info(`🚀 Wizard Step 1: Fetching news & generating script (${runId})`);

    // 1a. Fetch News
    const newsRes = await this.newsService.fetchLatestFinanceArticle();
    if (!newsRes.success || !newsRes.data) throw new Error(newsRes.errorMessage || 'Failed to fetch news');
    this.storageService.saveJson(runDir, 'article.json', newsRes.data);
    this.logger.info(`Headline: "${newsRes.data.headline}"`);

    // 1b. Analyze
    const analysisRes = await this.aiService.analyzeArticle(newsRes.data);
    if (!analysisRes.success || !analysisRes.data) throw new Error(analysisRes.errorMessage || 'Analysis failed');
    this.storageService.saveJson(runDir, 'analysis.json', analysisRes.data);
    this.logger.info(`Topic: ${analysisRes.data.topic} | Sentiment: ${analysisRes.data.sentiment}`);

    // 1c. Generate Script
    const scriptRes = await this.aiService.generateScript(analysisRes.data);
    if (!scriptRes.success || !scriptRes.data) throw new Error(scriptRes.errorMessage || 'Script generation failed');
    this.storageService.saveJson(runDir, 'script.json', scriptRes.data);
    this.logger.info(`Hook: "${scriptRes.data.hook}"`);

    this.wizardState.article = newsRes.data;
    this.wizardState.analysis = analysisRes.data;
    this.wizardState.script = scriptRes.data;

    return {
      article: newsRes.data,
      analysis: analysisRes.data,
      script: scriptRes.data,
      runId,
      runDir,
    };
  }

  // ========================================================================
  //  WIZARD STEP 2: Generate Scene Plan from (potentially edited) script
  // ========================================================================
  public async wizardStep2_Scenes(
    script: ScriptOutput,
    runId: string
  ): Promise<{ masterPlan: MasterPlan }> {
    const runDir = this.storageService.getRunDir(runId);
    this.logger.info(`🎬 Wizard Step 2: Generating scene plan for ${runId}`);

    // Save potentially edited script
    this.storageService.saveJson(runDir, 'script.json', script);

    const masterRes = await this.aiService.planScenes(script);
    if (!masterRes.success || !masterRes.data) throw new Error(masterRes.errorMessage || 'Scene planning failed');
    this.storageService.saveJson(runDir, 'master.json', masterRes.data);
    this.logger.info(`Planned ${masterRes.data.scenes.length} scenes (${masterRes.data.totalDuration}s)`);

    if (this.wizardState) {
      this.wizardState.currentStep = 2;
      this.wizardState.script = script;
      this.wizardState.masterPlan = masterRes.data;
    }

    return { masterPlan: masterRes.data };
  }

  // ========================================================================
  //  WIZARD STEP 3: Generate Voice TTS from (potentially edited) script text
  // ========================================================================
  public async wizardStep3_Voice(
    scriptText: string,
    runId: string,
    voiceName?: string
  ): Promise<{ audioUrl: string; duration: number }> {
    const runDir = this.storageService.getRunDir(runId);
    this.logger.info(`🎙️ Wizard Step 3: Generating Kokoro TTS voice for ${runId}`);

    const voiceMp3Path = this.storageService.getFilePath(runDir, 'voice.mp3');
    const voiceRes = await this.voiceService.generateVoice(scriptText, voiceMp3Path, voiceName);
    if (!voiceRes.success) throw new Error(voiceRes.errorMessage || 'Voice generation failed');

    const voiceSize = fs.existsSync(voiceMp3Path) ? fs.statSync(voiceMp3Path).size : 0;
    const duration = voiceRes.data?.duration || 20;
    this.logger.info(`Voice generated: ${voiceSize} bytes, ~${duration}s`);

    if (this.wizardState) {
      this.wizardState.currentStep = 3;
      this.wizardState.voicePath = voiceMp3Path;
      this.wizardState.voiceDuration = duration;
    }

    return { audioUrl: `/api/runs/${runId}/file/voice.mp3`, duration };
  }

  // ========================================================================
  //  WIZARD STEP 4: Download Pexels clips for all scenes
  // ========================================================================
  public async wizardStep4_Clips(
    masterPlan: MasterPlan,
    runId: string
  ): Promise<{ clips: Array<{ sceneNumber: number; clipUrl: string; searchKeyword: string; status: string }> }> {
    const runDir = this.storageService.getRunDir(runId);
    this.logger.info(`📹 Wizard Step 4: Generating video clips for ${runId}`);

    // Save potentially edited master plan
    this.storageService.saveJson(runDir, 'master.json', masterPlan);

    // Generate video keywords
    const keywordsRes = await this.aiService.generateVideoKeywords(masterPlan);
    if (keywordsRes.success && keywordsRes.data) {
      this.storageService.saveJson(runDir, 'video_keywords.json', keywordsRes.data);
    }

    const clipsDir = this.storageService.getFilePath(runDir, 'clips');
    const clips: Array<{ sceneNumber: number; clipUrl: string; searchKeyword: string; status: string }> = [];

    for (const scene of masterPlan.scenes) {
      const kwItem = keywordsRes.data?.scenes?.find((k) => k.sceneNumber === scene.sceneNumber);
      const searchKeyword = kwItem?.searchKeyword || scene.searchKeyword || 'business corporate';

      const res = await this.videoService.generateSceneClip(scene, clipsDir, searchKeyword);
      clips.push({
        sceneNumber: scene.sceneNumber,
        clipUrl: `/api/runs/${runId}/file/clips/scene_${String(scene.sceneNumber).padStart(2, '0')}.mp4`,
        searchKeyword,
        status: res.success ? 'completed' : 'failed',
      });

      if (res.success) {
        this.logger.info(`✅ Scene ${scene.sceneNumber} clip ready`);
      } else {
        this.logger.error(`❌ Scene ${scene.sceneNumber} clip failed: ${res.errorMessage}`);
      }
    }

    if (this.wizardState) {
      this.wizardState.currentStep = 4;
    }

    return { clips };
  }

  // ========================================================================
  //  WIZARD STEP 4b: Regenerate a single scene clip with new keyword
  // ========================================================================
  public async wizardStep4_RegenClip(
    sceneNumber: number,
    searchKeyword: string,
    durationSeconds: number,
    runId: string
  ): Promise<{ clipUrl: string; status: string }> {
    const runDir = this.storageService.getRunDir(runId);
    const clipsDir = this.storageService.getFilePath(runDir, 'clips');

    this.logger.info(`🔄 Regenerating clip for Scene ${sceneNumber} with keyword: "${searchKeyword}"`);

    const scene: SceneItem = {
      sceneNumber,
      durationSeconds: durationSeconds || 5,
      narrationText: '',
      subtitleText: '',
      videoPrompt: '',
      searchKeyword,
      transition: 'fade',
      status: 'pending',
      retries: 0,
    };

    const res = await this.videoService.generateSceneClip(scene, clipsDir, searchKeyword);
    const clipUrl = `/api/runs/${runId}/file/clips/scene_${String(sceneNumber).padStart(2, '0')}.mp4`;

    return {
      clipUrl: clipUrl + `?t=${Date.now()}`, // cache-bust
      status: res.success ? 'completed' : 'failed',
    };
  }

  // ========================================================================
  //  WIZARD STEP 5: Captions + FFmpeg Stitch + Remotion Render
  // ========================================================================
  public async wizardStep5_Render(
    runId: string
  ): Promise<{ finalVideoUrl: string }> {
    const runDir = this.storageService.getRunDir(runId);
    this.logger.info(`🎞️ Wizard Step 5: Rendering final video for ${runId}`);

    // 5a. Generate captions from voice.mp3
    const voiceMp3Path = this.storageService.getFilePath(runDir, 'voice.mp3');
    const scriptPath = this.storageService.getFilePath(runDir, 'script.json');
    const captionsPath = this.storageService.getFilePath(runDir, 'captions.json');

    let scriptText = '';
    if (fs.existsSync(scriptPath)) {
      const scriptData = JSON.parse(fs.readFileSync(scriptPath, 'utf-8'));
      scriptText = scriptData.fullScript || '';
    }

    const capsRes = await this.subtitleService.generateCaptions(voiceMp3Path, scriptText, captionsPath);
    if (!capsRes.success) {
      this.logger.error(`Captions generation warning: ${capsRes.errorMessage}`);
    } else {
      this.logger.info(`Captions generated: ${capsRes.data?.words?.length || 0} words`);
    }

    // 5b. Remotion render (includes FFmpeg stitching)
    const renderRes = await this.remotionService.renderVideo(runDir);
    if (!renderRes.success) throw new Error(renderRes.errorMessage || 'Render failed');

    const finalMp4Path = this.storageService.getFilePath(runDir, 'render/final.mp4');
    const renderSize = fs.existsSync(finalMp4Path) ? fs.statSync(finalMp4Path).size : 0;
    this.logger.info(`✅ Final video rendered: ${(renderSize / 1024 / 1024).toFixed(1)} MB`);

    if (this.wizardState) {
      this.wizardState.currentStep = 5;
      this.wizardState.finalVideoPath = finalMp4Path;
    }

    return { finalVideoUrl: `/api/runs/${runId}/file/render/final.mp4` };
  }

  // ========================================================================
  //  WIZARD STEP 6: Generate Metadata
  // ========================================================================
  public async wizardStep6_Metadata(
    runId: string
  ): Promise<{ metadata: VideoMetadata }> {
    const runDir = this.storageService.getRunDir(runId);
    this.logger.info(`🏷️ Wizard Step 6: Generating metadata for ${runId}`);

    const masterPath = this.storageService.getFilePath(runDir, 'master.json');
    let masterPlan: MasterPlan = { totalDuration: 35, scenes: [] };
    if (fs.existsSync(masterPath)) {
      masterPlan = JSON.parse(fs.readFileSync(masterPath, 'utf-8'));
    }

    const metaRes = await this.aiService.generateMetadata(masterPlan);
    if (!metaRes.success || !metaRes.data) throw new Error(metaRes.errorMessage || 'Metadata generation failed');
    this.storageService.saveJson(runDir, 'metadata.json', metaRes.data);

    if (this.wizardState) {
      this.wizardState.currentStep = 6;
      this.wizardState.metadata = metaRes.data;
    }

    return { metadata: metaRes.data };
  }

  // ========================================================================
  //  Save user edits to workspace JSON files
  // ========================================================================
  public saveUserEdits(runId: string, field: string, data: any): void {
    const runDir = this.storageService.getRunDir(runId);
    const fileMap: Record<string, string> = {
      script: 'script.json',
      masterPlan: 'master.json',
      metadata: 'metadata.json',
    };
    const filename = fileMap[field];
    if (filename) {
      this.storageService.saveJson(runDir, filename, data);
      this.logger.info(`User edits saved: ${filename}`);
    }
  }

  // ========================================================================
  //  Legacy: Full pipeline (kept for backward compatibility)
  // ========================================================================
  private initStages(): PipelineStage[] {
    return [
      { id: 'news', name: 'Fetch News', stepNumber: 1, status: 'pending', progressPercent: 0, retries: 0 },
      { id: 'analysis', name: 'Gemini Analysis', stepNumber: 2, status: 'pending', progressPercent: 0, retries: 0 },
      { id: 'script', name: 'Script Writer', stepNumber: 3, status: 'pending', progressPercent: 0, retries: 0 },
      { id: 'scene_plan', name: 'Scene Planner', stepNumber: 4, status: 'pending', progressPercent: 0, retries: 0 },
      { id: 'metadata', name: 'Generate Metadata', stepNumber: 5, status: 'pending', progressPercent: 0, retries: 0 },
      { id: 'voice', name: 'Voice Narration TTS', stepNumber: 6, status: 'pending', progressPercent: 0, retries: 0 },
      { id: 'captions', name: 'Whisper Captions', stepNumber: 7, status: 'pending', progressPercent: 0, retries: 0 },
      { id: 'video_clips', name: 'Pexels Video Clips', stepNumber: 8, status: 'pending', progressPercent: 0, retries: 0 },
      { id: 'thumbnail', name: 'Thumbnail Image', stepNumber: 9, status: 'pending', progressPercent: 0, retries: 0 },
      { id: 'remotion_render', name: 'Remotion Render', stepNumber: 10, status: 'pending', progressPercent: 0, retries: 0 },
    ];
  }

  private updateStage(stageId: string, updates: Partial<PipelineStage>) {
    if (!this.currentState) return;
    const stage = this.currentState.stages.find((s) => s.id === stageId);
    if (stage) {
      Object.assign(stage, updates);
      this.recalculateOverallProgress();
    }
  }

  private recalculateOverallProgress() {
    if (!this.currentState) return;
    const completed = this.currentState.stages.filter((s) => s.status === 'completed').length;
    this.currentState.overallProgress = Math.round((completed / this.currentState.stages.length) * 100);
  }

  public async retryScene(sceneNumber: number): Promise<boolean> {
    if (!this.currentState) return false;
    const scene = this.currentState.sceneProgress[sceneNumber];
    if (!scene) return false;

    scene.status = 'retrying';
    scene.retries += 1;
    this.logger.info(`Retrying single scene generation for Scene ${sceneNumber}...`);

    const clipsDir = this.storageService.getFilePath(this.currentState.runDir, 'clips');
    const res = await this.videoService.generateSceneClip(scene, clipsDir);

    if (res.success && res.data) {
      scene.status = 'completed';
      scene.clipPath = res.data;
      scene.error = undefined;
      this.logger.info(`Scene ${sceneNumber} Retry Succeeded!`);
      return true;
    } else {
      scene.status = 'failed';
      scene.error = res.errorMessage;
      this.logger.error(`Scene ${sceneNumber} Retry Failed: ${res.errorMessage}`);
      return false;
    }
  }
}
