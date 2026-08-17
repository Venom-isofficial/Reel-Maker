import fs from 'fs';
import path from 'path';

export class StorageService {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = path.resolve(process.cwd(), baseDir || process.env.WORKSPACE_DIR || './workspace');
    this.ensureDir(this.baseDir);
  }

  public ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  public createNextRun(): { runId: string; runDir: string } {
    this.ensureDir(this.baseDir);
    const existingDirs = fs.readdirSync(this.baseDir).filter((d) => d.startsWith('run_'));
    
    let maxNum = 0;
    for (const dir of existingDirs) {
      const match = dir.match(/^run_(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }

    const nextNum = maxNum + 1;
    const runId = `run_${String(nextNum).padStart(4, '0')}`;
    const runDir = path.join(this.baseDir, runId);

    // Create required subdirectories
    this.ensureDir(runDir);
    this.ensureDir(path.join(runDir, 'clips'));
    this.ensureDir(path.join(runDir, 'render'));
    this.ensureDir(path.join(runDir, 'logs'));

    return { runId, runDir };
  }

  public saveJson<T>(runDir: string, fileName: string, data: T): void {
    const filePath = path.join(runDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  public readJson<T>(runDir: string, fileName: string): T | null {
    const filePath = path.join(runDir, fileName);
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  }

  public getRunDir(runId: string): string {
    return path.join(this.baseDir, runId);
  }

  public getFilePath(runDir: string, relativePath: string): string {
    return path.join(runDir, relativePath);
  }

  public fileExists(runDir: string, relativePath: string): boolean {
    return fs.existsSync(path.join(runDir, relativePath));
  }

  public listRuns(): Array<{
    runId: string;
    created: Date;
    formattedDate: string;
    title: string;
    scriptSnippet: string;
    step: number;
    stepLabel: string;
    hasVoice: boolean;
    hasClips: boolean;
    hasRender: boolean;
    finalVideoUrl: string | null;
  }> {
    if (!fs.existsSync(this.baseDir)) return [];
    const dirs = fs.readdirSync(this.baseDir).filter((d) => d.startsWith('run_'));
    
    return dirs.sort().reverse().map((runId) => {
      const runDir = path.join(this.baseDir, runId);
      const stats = fs.statSync(runDir);
      
      const articlePath = path.join(runDir, 'article.json');
      const scriptPath = path.join(runDir, 'script.json');
      const masterPath = path.join(runDir, 'master.json');
      const voicePath = path.join(runDir, 'voice.mp3');
      const clipsDir = path.join(runDir, 'clips');
      const renderPath = path.join(runDir, 'render', 'final.mp4');

      let title = `Run ${runId}`;
      let scriptSnippet = '';
      if (fs.existsSync(articlePath)) {
        try {
          const art = JSON.parse(fs.readFileSync(articlePath, 'utf-8'));
          if (art && art.headline) title = art.headline;
        } catch (e) {}
      }
      if (fs.existsSync(scriptPath)) {
        try {
          const scr = JSON.parse(fs.readFileSync(scriptPath, 'utf-8'));
          if (scr && scr.fullScript) {
            scriptSnippet = scr.fullScript.slice(0, 120) + (scr.fullScript.length > 120 ? '...' : '');
            if (title === `Run ${runId}` && scr.hook) title = scr.hook;
          }
        } catch (e) {}
      }

      const hasVoice = fs.existsSync(voicePath);
      const hasClips = fs.existsSync(clipsDir) && fs.readdirSync(clipsDir).filter(f => f.endsWith('.mp4')).length > 0;
      const hasRender = fs.existsSync(renderPath);

      let step = 1;
      let stepLabel = 'Step 1 (Script Saved)';
      if (hasRender) {
        step = 6;
        stepLabel = 'Step 6 (Render Complete)';
      } else if (hasClips) {
        step = 5;
        stepLabel = 'Step 5 (Clips Ready)';
      } else if (hasVoice) {
        step = 4;
        stepLabel = 'Step 4 (Voice Ready)';
      } else if (fs.existsSync(masterPath)) {
        step = 3;
        stepLabel = 'Step 3 (Scenes Ready)';
      } else if (fs.existsSync(scriptPath)) {
        step = 2;
        stepLabel = 'Step 2 (Script Ready)';
      }

      const finalVideoUrl = hasRender ? `/api/runs/${runId}/file/render/final.mp4` : null;
      const formattedDate = new Date(stats.birthtime).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      return {
        runId,
        created: stats.birthtime,
        formattedDate,
        title,
        scriptSnippet,
        step,
        stepLabel,
        hasVoice,
        hasClips,
        hasRender,
        finalVideoUrl
      };
    });
  }
}
