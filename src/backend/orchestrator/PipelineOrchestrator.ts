import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
import { StorageService } from '../services/StorageService';
import { LoggingService } from '../services/LoggingService';
import { NewsService } from '../services/NewsService';
import { AIService } from '../services/AIService';
import { VoiceService } from '../services/VoiceService';
import { SubtitleService } from '../services/SubtitleService';
import { VideoService } from '../services/VideoService';
import { RemotionService } from '../services/RemotionService';
import { ComfyUIService } from '../services/ComfyUIService';
import { MuAPIService } from '../services/MuAPIService';
import { VadooService } from '../services/VadooService';
import { WanGPService } from '../services/WanGPService';
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
  private comfyUIService: ComfyUIService;
  private muAPIService: MuAPIService;
  private vadooService: VadooService;
  private wanGPService: WanGPService;

  private currentState?: PipelineState;
  private wizardState?: WizardState;
  private isRunning: boolean = false;

  private activeVoiceGenerations: Map<string, Promise<{ audioUrl: string; duration: number }>> = new Map();
  private activeVideoRenders: Map<string, Promise<{ finalVideoUrl: string }>> = new Map();

  constructor(
    storageService: StorageService,
    logger: LoggingService,
    newsService: NewsService,
    aiService: AIService,
    voiceService: VoiceService,
    subtitleService: SubtitleService,
    videoService: VideoService,
    remotionService: RemotionService,
    muapiApiKey?: string,
    vadooApiKey?: string,
    comfyuiUrl?: string
  ) {
    this.storageService = storageService;
    this.logger = logger;
    this.newsService = newsService;
    this.aiService = aiService;
    this.voiceService = voiceService;
    this.subtitleService = subtitleService;
    this.videoService = videoService;
    this.remotionService = remotionService;
    this.comfyUIService = new ComfyUIService(comfyuiUrl || 'http://127.0.0.1:8188');
    this.muAPIService = new MuAPIService(muapiApiKey);
    this.vadooService = new VadooService(vadooApiKey);
    this.wanGPService = new WanGPService();
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
  public async wizardStep1_Script(newsSource?: 'finnhub' | 'marketaux' | 'alphavantage' | 'benzinga'): Promise<{
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

    const selectedSource = newsSource || 'marketaux';
    this.logger.info(`🚀 Wizard Step 1: Fetching news & generating script (${runId}) [Source: ${selectedSource}]`);

    // 1a. Fetch News
    const newsRes = await this.newsService.fetchLatestFinanceArticle(selectedSource);
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
  //  WIZARD STEP 1b: Custom Script Input Mode (User Enters Title & Script Text)
  // ========================================================================
  public async wizardStep1_CustomScript(
    customTitle: string,
    customText: string
  ): Promise<{ article: NewsArticle; analysis: GeminiAnalysis; script: ScriptOutput; runId: string; runDir: string }> {
    const { runId, runDir } = this.storageService.createNextRun();
    this.logger.setRunDir(runDir);

    const cleanTitle = (customTitle || '').trim() || 'Custom Financial Narration';
    const cleanText = (customText || '').trim();

    const article: NewsArticle = {
      id: `custom_${Date.now()}`,
      headline: cleanTitle,
      summary: cleanText,
      url: 'custom://input',
      source: 'Custom Script Input',
      datetime: Date.now(),
      category: 'Custom',
      fullText: cleanText,
    };

    const analysis: GeminiAnalysis = {
      summary: cleanText,
      keywords: ['Custom', 'Input'],
      entities: ['User'],
      importance: 5,
      topic: cleanTitle,
      sentiment: 'Neutral',
    };

    const script: ScriptOutput = {
      hook: cleanTitle,
      introduction: cleanTitle,
      body: cleanText,
      ending: 'Follow for more updates!',
      cta: 'Follow for more updates!',
      fullScript: cleanText,
    };

    this.storageService.saveJson(runDir, 'article.json', article);
    this.storageService.saveJson(runDir, 'analysis.json', analysis);
    this.storageService.saveJson(runDir, 'script.json', script);

    this.wizardState = {
      runId,
      runDir,
      currentStep: 1,
      article,
      analysis,
      script,
    };

    return { article, analysis, script, runId, runDir };
  }

  // ========================================================================
  //  GET RUN DETAILS (Resume / Revisit Past Runs)
  // ========================================================================
  public getRunDetails(runId: string): any {
    const runDir = this.storageService.getRunDir(runId);
    if (!fs.existsSync(runDir)) return null;

    const article = this.storageService.readJson<NewsArticle>(runDir, 'article.json');
    const analysis = this.storageService.readJson<GeminiAnalysis>(runDir, 'analysis.json');
    const script = this.storageService.readJson<ScriptOutput>(runDir, 'script.json');
    const masterPlan = this.storageService.readJson<MasterPlan>(runDir, 'master.json');
    const takes = this.storageService.readJson<any[]>(runDir, 'takes/takes_meta.json') || [];

    const renderPath = path.join(runDir, 'render', 'final.mp4');
    const hasRender = fs.existsSync(renderPath);
    const finalVideoUrl = hasRender ? `/api/runs/${runId}/file/render/final.mp4` : null;

    const clipsDir = path.join(runDir, 'clips');
    const hasClips = fs.existsSync(clipsDir) && fs.readdirSync(clipsDir).filter(f => f.endsWith('.mp4')).length > 0;
    const voicePath = path.join(runDir, 'voice.mp3');
    const hasVoice = fs.existsSync(voicePath);

    let step = 1;
    if (hasRender) step = 6;
    else if (hasClips) step = 5;
    else if (hasVoice) step = 4;
    else if (masterPlan) step = 3;
    else if (script) step = 2;

    let clips: any[] = [];
    if (hasClips && masterPlan && Array.isArray(masterPlan.scenes)) {
      clips = masterPlan.scenes.map(s => ({
        sceneNumber: s.sceneNumber,
        clipUrl: `/api/runs/${runId}/file/clips/scene_${String(s.sceneNumber).padStart(2, '0')}.mp4`,
        searchKeyword: s.searchKeyword || s.videoPrompt || s.narrationText,
        status: 'completed'
      }));
    }

    return {
      runId,
      article,
      analysis,
      script,
      masterPlan,
      takes,
      clips,
      hasRender,
      finalVideoUrl,
      step,
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
    voiceName?: string,
    provider?: string,
    elevenLabsApiKey?: string,
    ttsSpeed?: number,
    exaggeration?: number,
    cfgWeight?: number
  ): Promise<{ audioUrl: string; duration: number }> {
    if (this.activeVoiceGenerations.has(runId)) {
      this.logger.info(`🎙️ Joining already active voice generation task for ${runId}`);
      return this.activeVoiceGenerations.get(runId)!;
    }

    const taskPromise = (async () => {
      try {
        const runDir = this.storageService.getRunDir(runId);
        this.logger.info(`🎙️ Wizard Step 3: Generating voice audio (${provider || 'kokoro'}) for ${runId}`);

        const voiceMp3Path = this.storageService.getFilePath(runDir, 'voice.mp3');
        const voiceRes = await this.voiceService.generateVoice(scriptText, voiceMp3Path, voiceName, provider, elevenLabsApiKey, ttsSpeed, exaggeration, cfgWeight);
        if (!voiceRes.success) throw new Error(voiceRes.errorMessage || 'Voice generation failed');

        const voiceSize = fs.existsSync(voiceMp3Path) ? fs.statSync(voiceMp3Path).size : 0;
        const duration = voiceRes.data?.duration || 20;
        const actualProvider = voiceRes.data?.provider || provider || 'kokoro';
        this.logger.info(`Voice generated (${actualProvider}): ${voiceSize} bytes, ~${duration}s`);

        // Save a sequential copy in runDir/takes/
        const takesDir = path.join(runDir, 'takes');
        if (!fs.existsSync(takesDir)) fs.mkdirSync(takesDir, { recursive: true });
        const existingTakes = fs.readdirSync(takesDir).filter(f => f.startsWith('take_') && f.endsWith('.mp3'));
        const takeNum = existingTakes.length + 1;
        const takeFileName = `take_${String(takeNum).padStart(2, '0')}.mp3`;
        fs.copyFileSync(voiceMp3Path, path.join(takesDir, takeFileName));

        // Recalibrate master.json scene durations to match exact audio narration length + 0.8s buffer padding (capped at 29.5s max)
        const masterPath = this.storageService.getFilePath(runDir, 'master.json');
        if (fs.existsSync(masterPath)) {
          try {
            const masterData = JSON.parse(fs.readFileSync(masterPath, 'utf-8'));
            if (masterData && Array.isArray(masterData.scenes) && masterData.scenes.length > 0) {
              const plannedSum = masterData.scenes.reduce((acc: number, s: any) => acc + (s.durationSeconds || 5), 0);
              const targetVideoDur = Math.min(29.5, Math.ceil(duration + 0.8));
              if (plannedSum < targetVideoDur) {
                const extraSec = targetVideoDur - plannedSum;
                const lastIdx = masterData.scenes.length - 1;
                masterData.scenes[lastIdx].durationSeconds = (masterData.scenes[lastIdx].durationSeconds || 5) + extraSec;
                masterData.totalDuration = targetVideoDur;
                this.storageService.saveJson(runDir, 'master.json', masterData);
                this.logger.info(`Recalibrated final scene duration (+${extraSec}s padding) to match voice narration (${targetVideoDur}s total)`);
              }
            }
          } catch (e) { }
        }

        if (this.wizardState) {
          this.wizardState.currentStep = 3;
          this.wizardState.voicePath = voiceMp3Path;
          this.wizardState.voiceDuration = duration;
        }

        const audioUrl = `/api/runs/${runId}/file/voice.mp3?t=${Date.now()}`;
        const takeUrl = `/api/runs/${runId}/file/takes/${takeFileName}?t=${Date.now()}`;

        // Save take metadata to takes_meta.json
        const takeMetaObj = {
          id: `take_${takeNum}_${Date.now()}`,
          takeNumber: takeNum,
          audioUrl: takeUrl,
          takeUrl: takeUrl,
          takeFileName: takeFileName,
          duration: duration,
          provider: actualProvider,
          voiceName: voiceName,
          params: {
            speed: ttsSpeed || 1.15,
            exaggeration: exaggeration,
            cfgWeight: cfgWeight
          },
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isUploaded: false
        };

        const takesMetaPath = path.join(takesDir, 'takes_meta.json');
        let takesList: any[] = [];
        if (fs.existsSync(takesMetaPath)) {
          try {
            const raw = fs.readFileSync(takesMetaPath, 'utf-8');
            takesList = JSON.parse(raw);
            if (!Array.isArray(takesList)) takesList = [];
          } catch (e) {}
        }
        takesList.unshift(takeMetaObj);
        fs.writeFileSync(takesMetaPath, JSON.stringify(takesList, null, 2), 'utf-8');

        return { audioUrl, takeUrl, duration, provider: actualProvider, takeNumber: takeNum };
      } finally {
        this.activeVoiceGenerations.delete(runId);
      }
    })();

    return taskPromise;
  }

  public async wizardStep3_GetTakes(runId: string): Promise<{ success: boolean; takes: any[] }> {
    const runDir = this.storageService.getRunDir(runId);
    const takesMetaPath = path.join(runDir, 'takes', 'takes_meta.json');
    if (fs.existsSync(takesMetaPath)) {
      try {
        const raw = fs.readFileSync(takesMetaPath, 'utf-8');
        const takes = JSON.parse(raw);
        if (Array.isArray(takes)) {
          return { success: true, takes };
        }
      } catch (e) {}
    }
    return { success: true, takes: [] };
  }

  // ========================================================================
  //  WIZARD STEP 3b: Upload / Copy custom browsed voice audio file
  // ========================================================================
  public async wizardStep3_UploadVoice(
    runId: string,
    fileData?: string,
    filePath?: string,
    originalName?: string
  ): Promise<{ success: boolean; audioUrl: string; takeUrl: string; duration: number; takeNumber: number; fileName: string }> {
    const runDir = this.storageService.getRunDir(runId);
    const takesDir = path.join(runDir, 'takes');
    if (!fs.existsSync(takesDir)) fs.mkdirSync(takesDir, { recursive: true });

    const existingTakes = fs.readdirSync(takesDir).filter(f => f.startsWith('take_') && f.endsWith('.mp3'));
    const takeNum = existingTakes.length + 1;
    const takeFileName = `take_${String(takeNum).padStart(2, '0')}.mp3`;
    const targetPath = path.join(takesDir, takeFileName);
    const mainVoicePath = this.storageService.getFilePath(runDir, 'voice.mp3');

    if (filePath && fs.existsSync(filePath)) {
      this.logger.info(`📁 Copying browsed voice audio file from "${filePath}" -> "${targetPath}"`);
      fs.copyFileSync(filePath, targetPath);
      fs.copyFileSync(filePath, mainVoicePath);
    } else if (fileData) {
      this.logger.info(`📁 Saving uploaded voice audio file (${originalName || 'custom_voice.mp3'})...`);
      const cleanBase64 = fileData.replace(/^data:audio\/\w+;base64,/, '').replace(/^data:application\/octet-stream;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');
      fs.writeFileSync(targetPath, buffer);
      fs.writeFileSync(mainVoicePath, buffer);
    } else {
      throw new Error('No valid audio file data or source file path provided');
    }

    const duration = (await this.voiceService.getExactAudioDuration(targetPath)) || 20;

    // Recalibrate master.json scene durations
    const masterPath = this.storageService.getFilePath(runDir, 'master.json');
    if (fs.existsSync(masterPath)) {
      try {
        const masterData = JSON.parse(fs.readFileSync(masterPath, 'utf-8'));
        if (masterData && Array.isArray(masterData.scenes) && masterData.scenes.length > 0) {
          const plannedSum = masterData.scenes.reduce((acc: number, s: any) => acc + (s.durationSeconds || 5), 0);
          const targetVideoDur = Math.min(29.5, Math.ceil(duration + 0.8));
          if (plannedSum < targetVideoDur) {
            const extraSec = targetVideoDur - plannedSum;
            const lastIdx = masterData.scenes.length - 1;
            masterData.scenes[lastIdx].durationSeconds = (masterData.scenes[lastIdx].durationSeconds || 5) + extraSec;
            masterData.totalDuration = targetVideoDur;
            this.storageService.saveJson(runDir, 'master.json', masterData);
          }
        }
      } catch (e) { }
    }

    const audioUrl = `/api/runs/${runId}/file/voice.mp3?t=${Date.now()}`;
    const takeUrl = `/api/runs/${runId}/file/takes/${takeFileName}?t=${Date.now()}`;

    // Save uploaded take metadata to takes_meta.json
    const takeMetaObj = {
      id: `take_${takeNum}_${Date.now()}`,
      takeNumber: takeNum,
      audioUrl: takeUrl,
      takeUrl: takeUrl,
      takeFileName: takeFileName,
      duration: duration,
      provider: 'Uploaded File',
      voiceName: originalName || takeFileName,
      params: { speed: 1.0 },
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isUploaded: true,
      fileName: originalName || takeFileName
    };

    const takesMetaPath = path.join(takesDir, 'takes_meta.json');
    let takesList: any[] = [];
    if (fs.existsSync(takesMetaPath)) {
      try {
        const raw = fs.readFileSync(takesMetaPath, 'utf-8');
        takesList = JSON.parse(raw);
        if (!Array.isArray(takesList)) takesList = [];
      } catch (e) {}
    }
    takesList.unshift(takeMetaObj);
    fs.writeFileSync(takesMetaPath, JSON.stringify(takesList, null, 2), 'utf-8');

    return { success: true, audioUrl, takeUrl, duration, takeNumber: takeNum, fileName: originalName || takeFileName };
  }

  // ========================================================================
  //  WIZARD STEP 3c: Select active take for video narration
  // ========================================================================
  public async wizardStep3_SelectTake(
    runId: string,
    takeFileName: string
  ): Promise<{ success: boolean; audioUrl: string; duration: number }> {
    const runDir = this.storageService.getRunDir(runId);
    const takePath = path.join(runDir, 'takes', takeFileName);
    const mainVoicePath = this.storageService.getFilePath(runDir, 'voice.mp3');

    if (!fs.existsSync(takePath)) {
      throw new Error(`Take file ${takeFileName} does not exist in run directory`);
    }

    fs.copyFileSync(takePath, mainVoicePath);
    const duration = (await this.voiceService.getExactAudioDuration(mainVoicePath)) || 20;

    const audioUrl = `/api/runs/${runId}/file/voice.mp3?t=${Date.now()}`;
    return { success: true, audioUrl, duration };
  }

  // ========================================================================
  //  WIZARD STEP 4: Download / Generate clips for all scenes (Pexels / ComfyUI / MuAPI)
  // ========================================================================
  public async wizardStep4_Clips(
    masterPlan: MasterPlan,
    runId: string,
    provider: 'pexels' | 'comfyui' | 'muapi' | 'apicalls' | 'dropclips' | 'localmodelshop' | 'wan2gp' = 'pexels',
    customPrompts?: Record<number, string>,
    muapiModel: string = 'muapi/wan3.0-text-to-video',
    comfyModel: string = 'ltx-video',
    localModel: string = 'Wan2.1/Text2video 1.3B/NVFP4 Lightx2v 4-step'
  ): Promise<{ clips: Array<{ sceneNumber: number; clipUrl: string; searchKeyword: string; status: string }> }> {
    const runDir = this.storageService.getRunDir(runId);
    this.logger.info(`📹 Wizard Step 4: Generating video clips (${provider}) for ${runId}`);

    // Save potentially edited master plan
    this.storageService.saveJson(runDir, 'master.json', masterPlan);

    const clipsDir = this.storageService.getFilePath(runDir, 'clips');
    if (!fs.existsSync(clipsDir)) fs.mkdirSync(clipsDir, { recursive: true });

    const clips: Array<{ sceneNumber: number; clipUrl: string; searchKeyword: string; status: string }> = [];

    for (const scene of masterPlan.scenes) {
      const dynamicKw = (scene.narrationText || '').toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3).slice(0, 4).join(' ');
      const userPrompt = customPrompts?.[scene.sceneNumber] || scene.videoPrompt || scene.visualPrompt || scene.searchKeyword || dynamicKw || 'news broadcast';
      const sceneClipPath = path.join(clipsDir, `scene_${String(scene.sceneNumber).padStart(2, '0')}.mp4`);

      if (provider === 'dropclips') {
        const exists = fs.existsSync(sceneClipPath);
        clips.push({
          sceneNumber: scene.sceneNumber,
          clipUrl: `/api/runs/${runId}/file/clips/scene_${String(scene.sceneNumber).padStart(2, '0')}.mp4?t=${Date.now()}`,
          searchKeyword: userPrompt,
          status: exists ? 'completed' : 'pending',
        });
      } else if (provider === 'localmodelshop' || provider === 'wan2gp') {
        const sceneClipPath = path.join(clipsDir, `scene_${String(scene.sceneNumber).padStart(2, '0')}.mp4`);
        try {
          this.logger.info(`🐉 Generating Local AI video clip via Wan2GP (${localModel}) for Scene ${scene.sceneNumber}...`);
          const wanRes = await this.wanGPService.generateVideoClip({
            prompt: userPrompt,
            outputPath: sceneClipPath,
            resolution: '480x832',
            numInferenceSteps: 4,
          });

          clips.push({
            sceneNumber: scene.sceneNumber,
            clipUrl: `/api/runs/${runId}/file/clips/scene_${String(scene.sceneNumber).padStart(2, '0')}.mp4`,
            searchKeyword: userPrompt,
            status: wanRes.success ? 'completed' : 'failed',
          });
        } catch (err: any) {
          this.logger.error(`❌ Wan2GP local generation error for Scene ${scene.sceneNumber}: ${err.message}`);
          const pexelsRes = await this.videoService.generateSceneClip(scene, clipsDir, userPrompt);
          clips.push({
            sceneNumber: scene.sceneNumber,
            clipUrl: `/api/runs/${runId}/file/clips/scene_${String(scene.sceneNumber).padStart(2, '0')}.mp4`,
            searchKeyword: userPrompt,
            status: pexelsRes.success ? 'completed' : 'failed',
          });
        }
      } else if (provider === 'muapi' || provider === 'apicalls') {
        const sceneClipPath = path.join(clipsDir, `scene_${String(scene.sceneNumber).padStart(2, '0')}.mp4`);
        const modelLower = muapiModel.toLowerCase();

        if (modelLower.startsWith('vadoo/')) {
          try {
            this.logger.info(`🎬 Generating Cloud AI video clip via Vadoo AI (${muapiModel}) for Scene ${scene.sceneNumber}...`);
            const vadooRes = await this.vadooService.generateVideoClip({
              topic: userPrompt,
              outputPath: sceneClipPath,
            });

            clips.push({
              sceneNumber: scene.sceneNumber,
              clipUrl: `/api/runs/${runId}/file/clips/scene_${String(scene.sceneNumber).padStart(2, '0')}.mp4`,
              searchKeyword: userPrompt,
              status: vadooRes.success ? 'completed' : 'failed',
            });
          } catch (err: any) {
            this.logger.error(`❌ Vadoo AI synthesis error for Scene ${scene.sceneNumber}: ${err.message}`);
            const pexelsRes = await this.videoService.generateSceneClip(scene, clipsDir, userPrompt);
            clips.push({
              sceneNumber: scene.sceneNumber,
              clipUrl: `/api/runs/${runId}/file/clips/scene_${String(scene.sceneNumber).padStart(2, '0')}.mp4`,
              searchKeyword: userPrompt,
              status: pexelsRes.success ? 'completed' : 'failed',
            });
          }
        } else {
          // Default MuAPI cloud model handler
          const cleanModelName = muapiModel.includes('/') ? muapiModel.split('/')[1] : muapiModel;
          try {
            this.logger.info(`☁️ Generating Cloud AI video clip via MuAPI (${cleanModelName}) for Scene ${scene.sceneNumber}...`);
            const muRes = await this.muAPIService.generateVideoClip({
              prompt: userPrompt,
              outputPath: sceneClipPath,
              modelName: cleanModelName,
            });

            clips.push({
              sceneNumber: scene.sceneNumber,
              clipUrl: `/api/runs/${runId}/file/clips/scene_${String(scene.sceneNumber).padStart(2, '0')}.mp4`,
              searchKeyword: userPrompt,
              status: muRes.success ? 'completed' : 'failed',
            });
          } catch (err: any) {
            this.logger.error(`❌ MuAPI synthesis error for Scene ${scene.sceneNumber}: ${err.message}`);
            const pexelsRes = await this.videoService.generateSceneClip(scene, clipsDir, userPrompt);
            clips.push({
              sceneNumber: scene.sceneNumber,
              clipUrl: `/api/runs/${runId}/file/clips/scene_${String(scene.sceneNumber).padStart(2, '0')}.mp4`,
              searchKeyword: userPrompt,
              status: pexelsRes.success ? 'completed' : 'failed',
            });
          }
        }
      } else if (provider === 'comfyui') {
        const sceneClipPath = path.join(clipsDir, `scene_${String(scene.sceneNumber).padStart(2, '0')}.mp4`);
        try {
          this.logger.info(`🎨 Generating AI video clip via ComfyUI (${comfyModel}) for Scene ${scene.sceneNumber}...`);
          await this.comfyUIService.generateVideoClip({
            prompt: userPrompt,
            outputPath: sceneClipPath,
            model: comfyModel,
            height: 768,
            width: 512,
            numFrames: Math.min(121, Math.max(49, Math.round((scene.durationSeconds || 5) * 24))),
          });
          clips.push({
            sceneNumber: scene.sceneNumber,
            clipUrl: `/api/runs/${runId}/file/clips/scene_${String(scene.sceneNumber).padStart(2, '0')}.mp4`,
            searchKeyword: userPrompt,
            status: 'completed',
          });
        } catch (err: any) {
          this.logger.error(`❌ ComfyUI synthesis error for Scene ${scene.sceneNumber}: ${err.message}`);
          const pexelsRes = await this.videoService.generateSceneClip(scene, clipsDir, userPrompt);
          clips.push({
            sceneNumber: scene.sceneNumber,
            clipUrl: `/api/runs/${runId}/file/clips/scene_${String(scene.sceneNumber).padStart(2, '0')}.mp4`,
            searchKeyword: userPrompt,
            status: pexelsRes.success ? 'completed' : 'failed',
          });
        }
      } else {
        // Pexels Stock Video Downloader
        const res = await this.videoService.generateSceneClip(scene, clipsDir, userPrompt);
        clips.push({
          sceneNumber: scene.sceneNumber,
          clipUrl: `/api/runs/${runId}/file/clips/scene_${String(scene.sceneNumber).padStart(2, '0')}.mp4`,
          searchKeyword: userPrompt,
          status: res.success ? 'completed' : 'failed',
        });
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
  //  WIZARD STEP 4c: Upload / Copy a custom dropped clip file for a scene
  // ========================================================================
  public async wizardStep4_UploadClip(
    sceneNumber: number,
    runId: string,
    base64Data?: string,
    sourceFilePath?: string
  ): Promise<{ success: boolean; clipUrl: string }> {
    const runDir = this.storageService.getRunDir(runId);
    const clipsDir = this.storageService.getFilePath(runDir, 'clips');
    if (!fs.existsSync(clipsDir)) fs.mkdirSync(clipsDir, { recursive: true });

    const targetPath = path.join(clipsDir, `scene_${String(sceneNumber).padStart(2, '0')}.mp4`);

    if (sourceFilePath && fs.existsSync(sourceFilePath)) {
      this.logger.info(`📁 Copying dropped clip file from "${sourceFilePath}" -> "${targetPath}"`);
      fs.copyFileSync(sourceFilePath, targetPath);
    } else if (base64Data) {
      this.logger.info(`📁 Saving uploaded clip file for Scene ${sceneNumber}...`);
      const cleanBase64 = base64Data.replace(/^data:video\/\w+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');
      fs.writeFileSync(targetPath, buffer);
    } else {
      throw new Error('No valid file data or source file path provided');
    }

    const clipUrl = `/api/runs/${runId}/file/clips/scene_${String(sceneNumber).padStart(2, '0')}.mp4?t=${Date.now()}`;
    return { success: true, clipUrl };
  }

  // ========================================================================
  //  WIZARD STEP 5: Captions + FFmpeg Stitch + Remotion Render
  // ========================================================================
  public async wizardStep5_Render(
    runId: string
  ): Promise<{ finalVideoUrl: string }> {
    if (this.activeVideoRenders.has(runId)) {
      this.logger.info(`🎞️ Joining already active video render task for ${runId}`);
      return this.activeVideoRenders.get(runId)!;
    }

    const taskPromise = (async () => {
      try {
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
      } finally {
        this.activeVideoRenders.delete(runId);
      }
    })();

    this.activeVideoRenders.set(runId, taskPromise);
    return taskPromise;
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

  public getCustomVoices(): { value: string; label: string; gender?: string }[] {
    const samplesBase = path.resolve(process.cwd(), 'scripts/models/ChatterboxTrainingAudioSamples');
    if (!fs.existsSync(samplesBase)) return [];

    const dirs = fs.readdirSync(samplesBase);
    const voices: { value: string; label: string; gender?: string }[] = [];

    for (const dirName of dirs) {
      if (['default', 'custom1', '1', '2'].includes(dirName)) continue;
      const fullDir = path.join(samplesBase, dirName);
      try {
        if (fs.statSync(fullDir).isDirectory()) {
          const metaPath = path.join(fullDir, 'metadata.json');
          let label = dirName;
          let gender = 'Male';

          if (fs.existsSync(metaPath)) {
            try {
              const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
              if (meta.label) label = meta.label;
              else if (meta.name) label = `${meta.gender || 'Male'} - ${meta.name} (#${meta.speakerId || ''})`.trim();
              if (meta.gender) gender = meta.gender;
            } catch (e) {}
          } else if (dirName.startsWith('libri_')) {
            const id = dirName.replace('libri_', '');
            label = `LibriSpeech Speaker #${id}`;
          } else if (dirName.startsWith('vox_')) {
            const parts = dirName.replace('vox_', '').split('_');
            const gen = parts.pop() || 'male';
            gender = gen.toLowerCase() === 'female' ? 'Female' : 'Male';
            const name = parts.join(' ').replace(/_/g, ' ');
            label = `🌟 ${name} (${gender} Celebrity)`;
          }

          const icon = gender.toLowerCase() === 'female' ? '👩' : '🎙️';
          voices.push({
            value: dirName,
            label: `${icon} ${label}`,
            gender,
          });
        }
      } catch (e) {}
    }

    voices.sort((a, b) => a.label.localeCompare(b.label));

    // Pin vox_Alex_Kingston_female to the very top of the list if present
    const topPresetIndex = voices.findIndex((v) => v.value === 'vox_Alex_Kingston_female');
    if (topPresetIndex > -1) {
      const [topPreset] = voices.splice(topPresetIndex, 1);
      topPreset.label = `⭐ 👩 Alex Kingston (Female Celebrity - Featured)`;
      voices.unshift(topPreset);
    }

    return voices;
  }

  public getVox2Voices(): { value: string; label: string; gender?: string }[] {
    const jsonIndex = path.resolve(process.cwd(), 'scripts/models/vox2_master_index.json');
    if (fs.existsSync(jsonIndex)) {
      try {
        const raw = fs.readFileSync(jsonIndex, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {}
    }

    const samplesBase = path.resolve(process.cwd(), 'scripts/models/ChatterboxVox2Samples');
    if (!fs.existsSync(samplesBase)) return [];

    try {
      const dirs = fs.readdirSync(samplesBase);
      const voices: { value: string; label: string; gender?: string }[] = [];

      for (const dirName of dirs) {
        const fullDir = path.join(samplesBase, dirName);
        if (fs.statSync(fullDir).isDirectory()) {
          const parts = dirName.replace('vox_', '').split('_');
          const gen = parts.pop() || 'male';
          const gender = gen.toLowerCase() === 'female' ? 'Female' : 'Male';
          const name = parts.join(' ').replace(/_/g, ' ');
          const icon = gender.toLowerCase() === 'female' ? '👩' : '🎙️';
          voices.push({
            value: dirName,
            label: `${icon} 🌟 ${name} (${gender} Celebrity - Vox2)`,
            gender,
          });
        }
      }
      return voices.sort((a, b) => a.label.localeCompare(b.label));
    } catch (e) {
      return [];
    }
  }

  public getStarredVoices(): string[] {
    const file = path.resolve(process.cwd(), 'scripts/models/starred_voices.json');
    if (fs.existsSync(file)) {
      try {
        const raw = fs.readFileSync(file, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return ['vox_Alex_Kingston_female'];
  }

  public saveStarredVoices(starredVoices: string[]): { success: boolean } {
    try {
      const file = path.resolve(process.cwd(), 'scripts/models/starred_voices.json');
      const dir = path.dirname(file);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, JSON.stringify(starredVoices, null, 2), 'utf-8');
      return { success: true };
    } catch (e) {
      return { success: false };
    }
  }

  public async addCustomVoice(fileData: string, fileName: string): Promise<{ success: boolean; voiceId: string; label: string }> {
    const samplesBase = path.resolve(process.cwd(), 'scripts/models/ChatterboxTrainingAudioSamples');
    if (!fs.existsSync(samplesBase)) fs.mkdirSync(samplesBase, { recursive: true });

    const timeId = Date.now();
    const folderName = `custom_${timeId}`;
    const targetDir = path.join(samplesBase, folderName);
    fs.mkdirSync(targetDir, { recursive: true });

    const base64Data = fileData.replace(/^data:audio\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const ext = path.extname(fileName) || '.mp3';
    const sampleFile = path.join(targetDir, `sample${ext}`);
    fs.writeFileSync(sampleFile, buffer);

    const cleanName = path.basename(fileName, ext).replace(/_/g, ' ');
    const label = `Custom Voice - ${cleanName}`;

    const metadata = {
      speakerId: `custom_${timeId}`,
      name: cleanName,
      gender: 'Male',
      label: `🎙️ ${label}`,
    };
    fs.writeFileSync(path.join(targetDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf-8');

    return {
      success: true,
      voiceId: folderName,
      label: `🎙️ ${label}`,
    };
  }
}
