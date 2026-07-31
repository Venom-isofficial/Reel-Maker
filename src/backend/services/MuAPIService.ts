import fs from 'fs';
import path from 'path';
import subprocess from 'child_process';
import { ServiceResult } from '../types';

export interface MuAPIGenerateOptions {
  prompt: string;
  outputPath: string;
  modelName?: string; // e.g. 'wan3.0-text-to-video'
}

export class MuAPIService {
  private apiKey: string;
  private baseUrl = 'https://api.muapi.ai/api/v1';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.MUAPI_API_KEY || '1bd8f8630d432391c79ba1acb6cf5510e648b228179ea4693523178aad6801e9';
  }

  public setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  public async generateVideoClip(options: MuAPIGenerateOptions): Promise<ServiceResult<{ videoPath: string; requestId: string }>> {
    const { prompt, outputPath, modelName = 'wan3.0-text-to-video' } = options;

    if (!this.apiKey) {
      return {
        success: false,
        retryable: false,
        errorMessage: 'MuAPI API key is missing.',
      };
    }

    try {
      console.log(`🎬 Submitting MuAPI task for model '${modelName}'... Prompt: "${prompt.slice(0, 50)}..."`);
      
      const submitEndpoint = `${this.baseUrl}/${modelName}`;
      const submitRes = await fetch(submitEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({ prompt }),
      });

      if (!submitRes.ok) {
        const errText = await submitRes.text();
        throw new Error(`MuAPI submission failed (${submitRes.status}): ${errText}`);
      }

      const submitData: any = await submitRes.json();
      const requestId = submitData.request_id || submitData.id || submitData.output?.id;

      if (!requestId) {
        throw new Error(`MuAPI submission response missing request_id: ${JSON.stringify(submitData)}`);
      }

      console.log(`⏳ MuAPI task submitted successfully! Request ID: ${requestId}. Polling for result...`);

      // Poll for result
      const pollEndpoint = `${this.baseUrl}/predictions/${requestId}/result`;
      let completedData: any = null;
      const startTime = Date.now();
      const timeoutMs = 180000; // 3 minutes

      while (Date.now() - startTime < timeoutMs) {
        await new Promise((r) => setTimeout(r, 4000));

        const pollRes = await fetch(pollEndpoint, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
          },
        });

        if (!pollRes.ok) {
          console.warn(`MuAPI poll warning (${pollRes.status}), retrying...`);
          continue;
        }

        const pollData: any = await pollRes.json();
        const status = (pollData.status || pollData.output?.status || '').toLowerCase();

        console.log(`  MuAPI Request [${requestId}] status: "${status}"`);

        if (status === 'completed' || status === 'succeeded') {
          completedData = pollData;
          break;
        } else if (status === 'failed') {
          const errMsg = pollData.error || pollData.output?.error || 'MuAPI generation failed.';
          throw new Error(errMsg);
        }
      }

      if (!completedData) {
        throw new Error(`MuAPI generation timed out after ${timeoutMs / 1000} seconds.`);
      }

      // Extract output video URL
      const videoUrl =
        completedData.outputs?.[0] ||
        completedData.output?.outputs?.[0] ||
        completedData.output?.urls?.get ||
        completedData.output?.url ||
        completedData.url;

      if (!videoUrl) {
        throw new Error(`MuAPI output missing video URL: ${JSON.stringify(completedData)}`);
      }

      console.log(`📥 Downloading generated video from MuAPI: ${videoUrl}`);

      const vidRes = await fetch(videoUrl);
      if (!vidRes.ok) {
        throw new Error(`Failed to download MuAPI video file: ${vidRes.statusText}`);
      }

      const tempFile = outputPath.replace(/\.mp4$/, '_raw.mp4');
      const outDir = path.dirname(outputPath);
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

      const buffer = await vidRes.arrayBuffer();
      fs.writeFileSync(tempFile, Buffer.from(buffer));

      // Re-encode to standard 1080x1920 30fps vertical MP4 reel via FFmpeg
      try {
        const ffmpegCmd = `ffmpeg -y -i "${tempFile}" -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30" -c:v libx264 -preset fast -pix_fmt yuv420p -an "${outputPath}"`;
        subprocess.execSync(ffmpegCmd, { stdio: 'ignore' });
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      } catch (ffErr) {
        console.warn(`FFmpeg re-encoding warning: ${ffErr}. Using raw MP4.`);
        if (fs.existsSync(tempFile)) {
          fs.renameSync(tempFile, outputPath);
        }
      }

      console.log(`✅ MuAPI Video Generated & Saved: ${outputPath} (${fs.statSync(outputPath).size} bytes)`);

      return {
        success: true,
        retryable: false,
        data: {
          videoPath: outputPath,
          requestId,
        },
      };
    } catch (error: any) {
      console.error(`❌ MuAPIService error: ${error.message}`);
      return {
        success: false,
        retryable: true,
        errorMessage: error.message,
      };
    }
  }
}
