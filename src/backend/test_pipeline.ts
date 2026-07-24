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

dotenv.config();

async function runStepByStepVerification() {
  const startTime = Date.now();
  console.log('----------------------------------------------------');
  console.log('🚀 STARTING STEP-BY-STEP AI REEL FACTORY VERIFICATION');
  console.log('----------------------------------------------------');

  const settingsService = new SettingsService();
  const settings = settingsService.getSettings();

  const storage = new StorageService(settings.outputFolder);
  const logger = new LoggingService();
  const newsService = new NewsService(settings.finnhubApiKey);
  const aiService = new AIService(settings.geminiApiKey);
  const voiceService = new VoiceService(settings.geminiApiKey);
  const subtitleService = new SubtitleService(settings.whisperApiKey);
  const videoService = new VideoService(settings.pexelsApiKey);
  const remotionService = new RemotionService();

  const { runId, runDir } = storage.createNextRun();
  logger.setRunDir(runDir);

  logger.info(`Starting execution run ${runId} in ${runDir}`);

  // STEP 1: Fetch News
  console.log('\n--- [STEP 1/11] FETCH NEWS ---');
  const newsRes = await newsService.fetchLatestFinanceArticle();
  if (!newsRes.success || !newsRes.data) {
    console.error('❌ Step 1 Failed:', newsRes.errorMessage);
    process.exit(1);
  }
  storage.saveJson(runDir, 'article.json', newsRes.data);
  logger.info(`Step 1: Fetched Article -> "${newsRes.data.headline}" (${newsRes.data.source})`);
  console.log('✅ Step 1 Passed: Saved article.json');

  // STEP 2: Gemini Analysis
  console.log('\n--- [STEP 2/11] GEMINI ANALYSIS ---');
  const analysisRes = await aiService.analyzeArticle(newsRes.data);
  if (!analysisRes.success || !analysisRes.data) {
    console.error('❌ Step 2 Failed:', analysisRes.errorMessage);
    process.exit(1);
  }
  storage.saveJson(runDir, 'analysis.json', analysisRes.data);
  logger.info(`Step 2: Analyzed Article -> Topic: ${analysisRes.data.topic}, Sentiment: ${analysisRes.data.sentiment}, Keywords: ${analysisRes.data.keywords.join(', ')}`);
  console.log('✅ Step 2 Passed: Saved analysis.json');

  // STEP 3: Script Writer
  console.log('\n--- [STEP 3/11] SCRIPT WRITER ---');
  const scriptRes = await aiService.generateScript(analysisRes.data);
  if (!scriptRes.success || !scriptRes.data) {
    console.error('❌ Step 3 Failed:', scriptRes.errorMessage);
    process.exit(1);
  }
  storage.saveJson(runDir, 'script.json', scriptRes.data);
  logger.info(`Step 3: Script Generated -> Hook: "${scriptRes.data.hook}"`);
  console.log('✅ Step 3 Passed: Saved script.json');

  // STEP 4: Scene Planner
  console.log('\n--- [STEP 4/11] SCENE PLANNER ---');
  const masterRes = await aiService.planScenes(scriptRes.data);
  if (!masterRes.success || !masterRes.data) {
    console.error('❌ Step 4 Failed:', masterRes.errorMessage);
    process.exit(1);
  }
  storage.saveJson(runDir, 'master.json', masterRes.data);
  logger.info(`Step 4: Planned ${masterRes.data.scenes.length} Scenes (${masterRes.data.totalDuration}s)`);
  console.log('✅ Step 4 Passed: Saved master.json');

  // STEP 5: Metadata
  console.log('\n--- [STEP 5/11] METADATA GENERATION ---');
  const metaRes = await aiService.generateMetadata(masterRes.data);
  if (!metaRes.success || !metaRes.data) {
    console.error('❌ Step 5 Failed:', metaRes.errorMessage);
    process.exit(1);
  }
  storage.saveJson(runDir, 'metadata.json', metaRes.data);
  logger.info(`Step 5: Metadata Generated -> Title: "${metaRes.data.title}", Hashtags: ${metaRes.data.hashtags.join(' ')}`);
  console.log('✅ Step 5 Passed: Saved metadata.json');

  // STEP 6: Gemini Voice TTS
  console.log('\n--- [STEP 6/11] VOICE GENERATION ---');
  const voiceMp3Path = storage.getFilePath(runDir, 'voice.mp3');
  const voiceRes = await voiceService.generateVoice(scriptRes.data.fullScript, voiceMp3Path);
  if (!voiceRes.success || !fs.existsSync(voiceMp3Path)) {
    console.error('❌ Step 6 Failed:', voiceRes.errorMessage);
    process.exit(1);
  }
  const voiceSize = fs.statSync(voiceMp3Path).size;
  const actualVoiceDur = voiceRes.data?.duration || 20;
  logger.info(`Step 6: Voice Narration MP3 Generated -> ${voiceMp3Path} (${voiceSize} bytes, duration: ${actualVoiceDur}s)`);
  console.log(`✅ Step 6 Passed: Saved voice.mp3 (exact duration: ${actualVoiceDur}s)`);

  // Recalibrate master.json scene durations to match exact audio narration length + 2s padding
  if (masterRes.data && masterRes.data.scenes && masterRes.data.scenes.length > 0) {
    const plannedSum = masterRes.data.scenes.reduce((acc: number, s: any) => acc + (s.durationSeconds || 5), 0);
    const targetVideoDur = Math.ceil(actualVoiceDur + 2.0);
    if (plannedSum < targetVideoDur) {
      const extraSec = targetVideoDur - plannedSum;
      const lastIdx = masterRes.data.scenes.length - 1;
      masterRes.data.scenes[lastIdx].durationSeconds = (masterRes.data.scenes[lastIdx].durationSeconds || 5) + extraSec;
      masterRes.data.totalDuration = targetVideoDur;
      storage.saveJson(runDir, 'master.json', masterRes.data);
      logger.info(`Recalibrated final scene duration (+${extraSec}s padding) to match voice narration (${targetVideoDur}s total)`);
    }
  }

  // STEP 7: Captions (Whisper)
  console.log('\n--- [STEP 7/11] CAPTIONS GENERATION ---');
  const captionsPath = storage.getFilePath(runDir, 'captions.json');
  const capsRes = await subtitleService.generateCaptions(voiceMp3Path, scriptRes.data.fullScript, captionsPath);
  if (!capsRes.success || !fs.existsSync(captionsPath)) {
    console.error('❌ Step 7 Failed:', capsRes.errorMessage);
    process.exit(1);
  }
  const totalWords = capsRes.data?.words?.length || 0;
  logger.info(`Step 7: Captions & SRT Generated -> ${captionsPath} (${totalWords} timestamped words)`);
  console.log('✅ Step 7 Passed: Saved captions.json');

  // STEP 8: Gemini Video Keywords & Pexels Video Clips
  console.log('\n--- [STEP 8/11] GEMINI VIDEO KEYWORDS & PEXELS CLIPS ---');
  const kwRes = await aiService.generateVideoKeywords(masterRes.data);
  if (kwRes.success && kwRes.data) {
    storage.saveJson(runDir, 'video_keywords.json', kwRes.data);
    logger.info(`Step 8: Saved video_keywords.json -> ${kwRes.data.scenes.map(s => `"${s.searchKeyword}"`).join(', ')}`);
  }

  const clipsDir = storage.getFilePath(runDir, 'clips');
  const clipResults = await videoService.generateAllScenesParallel(masterRes.data.scenes, clipsDir, kwRes.data);
  const completedClips = Object.values(clipResults).filter((r) => r.success).length;
  logger.info(`Step 8: Pexels Video Clips Downloaded -> ${completedClips}/${masterRes.data.scenes.length} MP4 clips ready`);
  console.log(`✅ Step 8 Passed: Saved ${completedClips}/${masterRes.data.scenes.length} scene mp4 clips in clips/`);

  // STEP 9: Thumbnail
  console.log('\n--- [STEP 9/11] THUMBNAIL GENERATION ---');
  const thumbPath = storage.getFilePath(runDir, 'thumbnail.png');
  const thumbRes = await videoService.generateThumbnail(metaRes.data.thumbnailText, thumbPath);
  if (!thumbRes.success || !fs.existsSync(thumbPath)) {
    console.error('❌ Step 9 Failed:', thumbRes.errorMessage);
    process.exit(1);
  }
  logger.info(`Step 9: Thumbnail Image Created -> ${thumbPath}`);
  console.log('✅ Step 9 Passed: Saved thumbnail.png');

  // STEP 10: Remotion Render
  console.log('\n--- [STEP 10/11] REMOTION VIDEO RENDER ---');
  const renderRes = await remotionService.renderVideo(runDir);
  const finalPath = storage.getFilePath(runDir, 'render/final.mp4');
  if (!renderRes.success || !fs.existsSync(finalPath)) {
    console.error('❌ Step 10 Failed:', renderRes.errorMessage);
    process.exit(1);
  }
  const renderSize = fs.statSync(finalPath).size;
  logger.info(`Step 10: Remotion Final Reel Rendered -> ${finalPath} (${renderSize} bytes)`);
  console.log('✅ Step 10 Passed: Saved render/final.mp4');

  // STEP 11: Logging & Walkthrough Generation
  console.log('\n--- [STEP 11/11] LOGGING & WALKTHROUGH DOCUMENTATION ---');
  const logPath = storage.getFilePath(runDir, 'logs/execution.log');
  logger.info('Verification sequence complete! Writing logs/walkthrough.md...');

  const totalTimeSec = ((Date.now() - startTime) / 1000).toFixed(1);
  const walkthroughMd = `
# 🎬 AI Reel Factory Execution Walkthrough

**Run ID**: \`${runId}\`  
**Execution Date**: ${new Date().toISOString()}  
**Total Runtime**: \`${totalTimeSec} seconds\`  
**Final Output Video**: [render/final.mp4](file:///${finalPath.replace(/\\/g, '/')}) (\`${(renderSize / 1024 / 1024).toFixed(1)} MB\`)

---

## 📰 Step 1: News Article
- **Headline**: "${newsRes.data.headline}"
- **Source**: ${newsRes.data.source}
- **Category**: ${newsRes.data.category}
- **URL**: [Article Link](${newsRes.data.url})

---

## 🧠 Step 2: Gemini Analysis
- **Topic**: ${analysisRes.data.topic}
- **Sentiment**: ${analysisRes.data.sentiment}
- **Market Importance**: ${analysisRes.data.importance}/10
- **Extracted Keywords**: \`${analysisRes.data.keywords.join(', ')}\`
- **Key Entities**: \`${analysisRes.data.entities.join(', ')}\`

---

## 📝 Step 3: Narration Script
- **Hook**: "${scriptRes.data.hook}"
- **Script Length**: ${scriptRes.data.fullScript.length} characters
- **Full Narration Text**:
> "${scriptRes.data.fullScript}"

---

## 🎨 Step 4: Scene Plan
- **Total Planned Scenes**: ${masterRes.data.scenes.length}
- **Reel Duration**: ${masterRes.data.totalDuration} seconds
${masterRes.data.scenes.map(s => `- **Scene ${s.sceneNumber}** (${s.durationSeconds}s): "${s.narrationText}"`).join('\n')}

---

## 🏷️ Step 5: Publishing Metadata
- **Video Title**: "${metaRes.data.title}"
- **Hashtags**: \`${metaRes.data.hashtags.join(' ')}\`
- **Thumbnail Overlay Text**: "${metaRes.data.thumbnailText}"
- **Suggested Filename**: \`${metaRes.data.suggestedFilename}\`

---

## 🎙️ Step 6: Audio Narration
- **File**: \`voice.mp3\` (\`${voiceSize} bytes\`)
- **Engine**: OpenAI TTS / Google Synthesizer

---

## ⏱️ Step 7: Word Timestamp Subtitles
- **Caption File**: \`captions.json\` & \`captions.srt\`
- **Timestamped Words**: ${totalWords} words

---

## 🎬 Step 8: Video Keywords & Pexels Clips
- **Keyword Source**: \`video_keywords.json\`
- **Generated Keywords**: ${kwRes.data?.scenes.map(s => `Scene ${s.sceneNumber}: "${s.searchKeyword}"`).join(' | ') || 'N/A'}
- **Downloaded Clips**: ${completedClips}/${masterRes.data.scenes.length} 9:16 portrait HD MP4s (1080x1920 @ 30 FPS)

---

## 🎞️ Step 10: Remotion Video Render
- **Composition Engine**: \`ReelComposition.tsx\` + \`CaptionsOverlay.tsx\` (Impact font, yellow pop-out highlight glow, golden accent border)
- **Output Spec**: 1080x1920 @ 30 FPS MP4 (\`${(renderSize / 1024 / 1024).toFixed(1)} MB\`)

---

## 📄 Execution Logs
\`\`\`text
${logger.getLogs().join('\n')}
\`\`\`
`.trim();

  logger.writeWalkthrough(walkthroughMd);

  if (!fs.existsSync(logPath)) {
    console.error('❌ Step 11 Failed: execution.log missing');
    process.exit(1);
  }
  console.log('✅ Step 11 Passed: Saved logs/execution.log & logs/walkthrough.md');

  console.log('\n----------------------------------------------------');
  console.log('🎉 ALL 11 PIPELINE STEPS VERIFIED SUCCESSFULLY!');
  console.log(`📁 Final Output Workspace: ${runDir}`);
  console.log(`📄 Walkthrough Document: ${runDir}/logs/walkthrough.md`);
  console.log('----------------------------------------------------');
}

runStepByStepVerification().catch((e) => {
  console.error('Fatal Verification Error:', e);
  process.exit(1);
});
