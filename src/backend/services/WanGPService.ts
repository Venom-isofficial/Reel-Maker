import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { LoggingService } from './LoggingService';

export interface WanGPGenerateOptions {
  prompt: string;
  outputPath: string;
  resolution?: string;         // default "480x832" (vertical)
  numInferenceSteps?: number;  // default 4 (Lightx2v 4-step)
  seed?: number;
  modelName?: string;
}

export class WanGPService {
  private wangpDir: string;
  private pythonExe: string;
  private logger = new LoggingService();

  constructor(
    wangpDir = 'U:/GithubRepo/Wan-Model_LowGpu/Wan2GP',
    pythonExe = 'U:/GithubRepo/Wan-Model_LowGpu/Wan2GP/env_uv/Scripts/python.exe'
  ) {
    this.wangpDir = path.resolve(wangpDir);
    this.pythonExe = path.resolve(pythonExe);
  }

  public async generateVideoClip(options: WanGPGenerateOptions): Promise<{ success: boolean; videoPath: string }> {
    const seed = options.seed ?? Math.floor(Math.random() * 2147483647);
    const resolution = options.resolution || '480x832';
    const numSteps = options.numInferenceSteps || 4;

    this.logger.info(`🐉 WanGP: Generating local AI video clip (${resolution}, ${numSteps} steps) -> "${options.prompt.slice(0, 45)}..."`);

    // Prepare temp working directory for batch job
    const tempDir = path.resolve(this.wangpDir, 'outputs', `temp_job_${Date.now()}`);
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const jobSettingsPath = path.join(tempDir, 'job_settings.json');
    const jobSettings = {
      settings_version: 2.66,
      model_type: "t2v_1.3B_nvfp4",
      prompt: options.prompt,
      negative_prompt: "blur, low quality, distortion, text, watermark, bad anatomy, morphing, flickering, noise, glitch, ugly, low resolution",
      resolution: resolution,
      video_length: 81,
      flow_shift: 1,
      sample_solver: "unipc",
      guidance_scale: 1.0,
      sampler_solver: "euler",
      num_inference_steps: numSteps,
      temporal_upsampling: "rife2",
      force_fps: "30",
      seed: seed
    };

    fs.writeFileSync(jobSettingsPath, JSON.stringify(jobSettings, null, 2), 'utf-8');

    // Run WanGP CLI headless batch process
    const cmd = `"${this.pythonExe}" wgp.py --process "${jobSettingsPath}" --output-dir "${tempDir}"`;

    await new Promise<void>((resolve, reject) => {
      exec(cmd, { cwd: this.wangpDir }, (error, stdout, stderr) => {
        if (error) {
          this.logger.error(`WanGP CLI Process failed: ${error.message}`);
          this.logger.error(`WanGP Stderr: ${stderr}`);
          reject(new Error(`WanGP CLI generation failed: ${error.message}`));
          return;
        }
        this.logger.info(`WanGP CLI completed successfully.`);
        resolve();
      });
    });

    // Find generated MP4 file in tempDir
    const files = fs.readdirSync(tempDir);
    const mp4Files = files.filter(f => f.toLowerCase().endsWith('.mp4'));

    if (mp4Files.length === 0) {
      throw new Error(`WanGP CLI executed but output .mp4 was not found in ${tempDir}`);
    }

    const generatedMp4Path = path.join(tempDir, mp4Files[0]);
    this.logger.info(`WanGP Raw Clip Generated: ${generatedMp4Path}`);

    // Post-process with FFmpeg: Lanczos high-clarity upscale 480x832 -> 1080x1920 HD vertical video
    const finalOutputDir = path.dirname(options.outputPath);
    if (!fs.existsSync(finalOutputDir)) fs.mkdirSync(finalOutputDir, { recursive: true });

    const ffmpegCmd = `ffmpeg -y -i "${generatedMp4Path}" -vf "scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,setsar=1" -c:v libx264 -preset slow -crf 17 -c:a copy "${path.resolve(options.outputPath)}"`;

    await new Promise<void>((resolve, reject) => {
      exec(ffmpegCmd, (error) => {
        if (error) {
          // Fallback: copy directly if FFmpeg fails
          fs.copyFileSync(generatedMp4Path, path.resolve(options.outputPath));
          resolve();
        } else {
          resolve();
        }
      });
    });

    // Cleanup temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }

    this.logger.info(`✅ WanGP Video Clip finalized: ${options.outputPath}`);

    return {
      success: true,
      videoPath: options.outputPath
    };
  }
}
