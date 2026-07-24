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

  public listRuns(): Array<{ runId: string; created: Date; hasRender: boolean }> {
    if (!fs.existsSync(this.baseDir)) return [];
    const dirs = fs.readdirSync(this.baseDir).filter((d) => d.startsWith('run_'));
    
    return dirs.sort().reverse().map((runId) => {
      const runDir = path.join(this.baseDir, runId);
      const stats = fs.statSync(runDir);
      const renderPath = path.join(runDir, 'render', 'final.mp4');
      return {
        runId,
        created: stats.birthtime,
        hasRender: fs.existsSync(renderPath),
      };
    });
  }
}
