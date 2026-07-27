import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

import { StorageService } from './services/StorageService';
import { LoggingService } from './services/LoggingService';
import { NewsService } from './services/NewsService';
import { AIService } from './services/AIService';
import { VoiceService } from './services/VoiceService';
import { SubtitleService } from './services/SubtitleService';
import { VideoService } from './services/VideoService';
import { RemotionService } from './services/RemotionService';
import { SettingsService } from './services/SettingsService';
import { PipelineOrchestrator } from './orchestrator/PipelineOrchestrator';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Services initialization
const settingsService = new SettingsService();
const settings = settingsService.getSettings();

const storageService = new StorageService(settings.outputFolder);
const logger = new LoggingService();
const newsService = new NewsService(settings.finnhubApiKey);
const aiService = new AIService(settings.geminiApiKey);
const voiceService = new VoiceService(settings.geminiApiKey);
const subtitleService = new SubtitleService(settings.whisperApiKey);
const videoService = new VideoService(settings.pexelsApiKey);
const remotionService = new RemotionService();

const orchestrator = new PipelineOrchestrator(
  storageService,
  logger,
  newsService,
  aiService,
  voiceService,
  subtitleService,
  videoService,
  remotionService
);

// =======================================================================
//  WIZARD STEP-BY-STEP API ENDPOINTS
// =======================================================================

// Step 1: Fetch news → analyze → generate script
app.post('/api/wizard/step1-script', async (req, res) => {
  try {
    const result = await orchestrator.wizardStep1_Script();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Step 2: Generate scene plan from approved script
app.post('/api/wizard/step2-scenes', async (req, res) => {
  try {
    const { script, runId } = req.body;
    if (!script || !runId) return res.status(400).json({ success: false, message: 'script and runId required' });
    const result = await orchestrator.wizardStep2_Scenes(script, runId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Step 3: Generate voice TTS
app.post('/api/wizard/step3-voice', async (req, res) => {
  try {
    const { scriptText, runId, voiceName, provider, elevenLabsApiKey, ttsSpeed } = req.body;
    if (!scriptText || !runId) return res.status(400).json({ success: false, message: 'scriptText and runId required' });
    const result = await orchestrator.wizardStep3_Voice(scriptText, runId, voiceName, provider, elevenLabsApiKey, ttsSpeed ? parseFloat(ttsSpeed) : undefined);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Step 4: Generate all clips
app.post('/api/wizard/step4-clips', async (req, res) => {
  try {
    const { masterPlan, runId } = req.body;
    if (!masterPlan || !runId) return res.status(400).json({ success: false, message: 'masterPlan and runId required' });
    const result = await orchestrator.wizardStep4_Clips(masterPlan, runId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Step 4b: Regenerate single clip
app.post('/api/wizard/step4-regen-clip', async (req, res) => {
  try {
    const { sceneNumber, searchKeyword, durationSeconds, runId } = req.body;
    if (!sceneNumber || !runId) return res.status(400).json({ success: false, message: 'sceneNumber and runId required' });
    const result = await orchestrator.wizardStep4_RegenClip(sceneNumber, searchKeyword || 'business', durationSeconds || 5, runId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Step 5: Render final video
app.post('/api/wizard/step5-render', async (req, res) => {
  try {
    const { runId } = req.body;
    if (!runId) return res.status(400).json({ success: false, message: 'runId required' });
    const result = await orchestrator.wizardStep5_Render(runId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Step 6: Generate metadata
app.post('/api/wizard/step6-metadata', async (req, res) => {
  try {
    const { runId } = req.body;
    if (!runId) return res.status(400).json({ success: false, message: 'runId required' });
    const result = await orchestrator.wizardStep6_Metadata(runId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Save user edits
app.post('/api/wizard/save-edits', async (req, res) => {
  try {
    const { runId, field, data } = req.body;
    if (!runId || !field || !data) return res.status(400).json({ success: false, message: 'runId, field, and data required' });
    orchestrator.saveUserEdits(runId, field, data);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// =======================================================================
//  LEGACY & UTILITY ENDPOINTS
// =======================================================================

// Current pipeline/wizard state
app.get('/api/pipeline/state', (req, res) => {
  const state = orchestrator.getCurrentState();
  const wizardState = orchestrator.getWizardState();
  res.json({ state, wizardState });
});

// SSE Log Stream
app.get('/api/pipeline/logs/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const onLog = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  logger.on('log', onLog);
  req.on('close', () => {
    logger.off('log', onLog);
  });
});

// Runs listing
app.get('/api/runs', (req, res) => {
  const runs = storageService.listRuns();
  res.json({ runs });
});

// Run files
app.get('/api/runs/:runId/files', (req, res) => {
  const { runId } = req.params;
  const runDir = path.join(process.cwd(), settingsService.getSettings().outputFolder, runId);
  if (!fs.existsSync(runDir)) return res.status(404).json({ error: 'Run folder not found' });

  const getFilesRecursive = (dir: string, prefix = ''): string[] => {
    const items = fs.readdirSync(dir);
    let results: string[] = [];
    for (const item of items) {
      const full = path.join(dir, item);
      const rel = prefix ? `${prefix}/${item}` : item;
      if (fs.statSync(full).isDirectory()) {
        results = results.concat(getFilesRecursive(full, rel));
      } else {
        results.push(rel);
      }
    }
    return results;
  };

  const files = getFilesRecursive(runDir);
  res.json({ runId, files });
});

// Serve run file content / media
app.get('/api/runs/:runId/file/*', (req, res) => {
  const { runId } = req.params;
  const filePathRel = (req.params as any)[0];
  const runDir = path.join(process.cwd(), settingsService.getSettings().outputFolder, runId);
  const fullPath = path.join(runDir, filePathRel);

  if (!fs.existsSync(fullPath)) {
    return res.status(404).send('File not found');
  }

  res.sendFile(fullPath);
});

// Settings API
app.get('/api/settings', (req, res) => {
  res.json(settingsService.getSettings());
});

app.post('/api/settings', (req, res) => {
  const updated = settingsService.saveSettings(req.body);
  newsService.setApiKey(updated.finnhubApiKey);
  aiService.setApiKey(updated.geminiApiKey);
  voiceService.setApiKey(updated.geminiApiKey);
  subtitleService.setApiKey(updated.whisperApiKey);
  videoService.setPexelsApiKey(updated.pexelsApiKey);
  res.json({ success: true, settings: updated });
});

// Prompts API
app.get('/api/prompts/:name', (req, res) => {
  try {
    const content = aiService.getPromptTemplate(req.params.name);
    res.json({ name: req.params.name, content });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/prompts/:name', (req, res) => {
  try {
    aiService.savePromptTemplate(req.params.name, req.body.content);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Serve static frontend assets if built
const distDir = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distDir, 'index.html'));
    }
  });
}

app.listen(PORT, () => {
  console.log(`🚀 AI Reel Factory Backend server listening on http://localhost:${PORT}`);
});
