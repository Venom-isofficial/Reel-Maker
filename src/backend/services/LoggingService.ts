import fs from 'fs';
import path from 'path';
import EventEmitter from 'events';

export class LoggingService extends EventEmitter {
  private logFilePath?: string;
  private walkthroughPath?: string;

  public setRunDir(runDir: string): void {
    const logsDir = path.join(runDir, 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    this.logFilePath = path.join(logsDir, 'execution.log');
    this.walkthroughPath = path.join(logsDir, 'walkthrough.md');
  }

  public log(message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO'): string {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    const formattedMessage = `[${timeStr}] [${level}] ${message}`;

    console.log(formattedMessage);

    if (this.logFilePath) {
      try {
        fs.appendFileSync(this.logFilePath, formattedMessage + '\n', 'utf-8');
      } catch (err) {
        console.error('Failed writing to log file:', err);
      }
    }

    this.emit('log', { timestamp: timeStr, level, message: formattedMessage });
    return formattedMessage;
  }

  public info(message: string): string {
    return this.log(message, 'INFO');
  }

  public warn(message: string): string {
    return this.log(message, 'WARN');
  }

  public error(message: string): string {
    return this.log(message, 'ERROR');
  }

  public writeWalkthrough(markdownContent: string): void {
    if (this.walkthroughPath) {
      try {
        fs.writeFileSync(this.walkthroughPath, markdownContent, 'utf-8');
      } catch (err) {
        console.error('Failed writing to walkthrough.md file:', err);
      }
    }
  }

  public getLogs(): string[] {
    if (!this.logFilePath || !fs.existsSync(this.logFilePath)) return [];
    return fs.readFileSync(this.logFilePath, 'utf-8').split('\n').filter(Boolean);
  }
}
