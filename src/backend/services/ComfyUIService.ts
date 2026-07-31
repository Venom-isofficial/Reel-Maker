import path from 'path';
import fs from 'fs';
import { LoggingService } from './LoggingService';

export interface ComfyUIGenerateOptions {
  prompt: string;
  outputPath: string;
  model?: string;       // e.g. 'ltx-video' — used to pick the right workflow template
  height?: number;
  width?: number;
  numFrames?: number;
  numInferenceSteps?: number;
  guidanceScale?: number;
  seed?: number;
}

/**
 * Service that delegates video generation to a running ComfyUI instance
 * via its REST API (default http://127.0.0.1:8188).
 *
 * Workflow:
 *   1. POST /api/prompt   — submit a workflow JSON with the user prompt injected
 *   2. Poll /api/history/{prompt_id} until execution completes
 *   3. Download the output video via /api/view and save to outputPath
 */
export class ComfyUIService {
  private serverUrl: string;
  private logger = new LoggingService();
  private pollIntervalMs = 2000;
  private maxPollAttempts = 300; // 10 min max wait

  constructor(serverUrl = 'http://127.0.0.1:8188') {
    this.serverUrl = serverUrl.replace(/\/+$/, ''); // strip trailing slashes
  }

  /** Check if ComfyUI server is reachable */
  public async isServerAlive(): Promise<boolean> {
    try {
      const res = await fetch(`${this.serverUrl}/api/system_stats`, {
        signal: AbortSignal.timeout(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Build the LTX-Video workflow JSON with the user's prompt injected */
  private buildLTXWorkflow(options: ComfyUIGenerateOptions): Record<string, any> {
    const seed = options.seed ?? Math.floor(Math.random() * 2147483647);

    // This is a minimal ComfyUI API-format workflow for LTX-Video text-to-video.
    // Node IDs are strings. Adjust node types if your ComfyUI uses different class names.
    return {
      "1": {
        "class_type": "LTXVLoader",
        "inputs": {}
      },
      "2": {
        "class_type": "EmptyLTXVLatentVideo",
        "inputs": {
          "width": options.width || 512,
          "height": options.height || 768,
          "length": options.numFrames || 97,
          "batch_size": 1
        }
      },
      "3": {
        "class_type": "LTXVTextEncode",
        "inputs": {
          "text": options.prompt,
          "ltxv_model": ["1", 0]
        }
      },
      "4": {
        "class_type": "LTXVTextEncode",
        "inputs": {
          "text": "",
          "ltxv_model": ["1", 0]
        }
      },
      "5": {
        "class_type": "LTXVSampler",
        "inputs": {
          "seed": seed,
          "steps": options.numInferenceSteps || 25,
          "cfg": options.guidanceScale || 3.0,
          "ltxv_model": ["1", 0],
          "positive": ["3", 0],
          "negative": ["4", 0],
          "latent_image": ["2", 0]
        }
      },
      "6": {
        "class_type": "LTXVDecode",
        "inputs": {
          "ltxv_model": ["1", 0],
          "samples": ["5", 0]
        }
      },
      "7": {
        "class_type": "SaveAnimatedWEBP",
        "inputs": {
          "filename_prefix": "ReelMaker",
          "fps": 24,
          "lossless": false,
          "quality": 90,
          "method": "default",
          "images": ["6", 0]
        }
      },
      "8": {
        "class_type": "VHS_VideoCombine",
        "inputs": {
          "frame_rate": 24,
          "loop_count": 0,
          "filename_prefix": "ReelMaker",
          "format": "video/h264-mp4",
          "pingpong": false,
          "save_output": true,
          "images": ["6", 0]
        }
      }
    };
  }

  /**
   * Submit a prompt workflow to ComfyUI and wait for the output video.
   */
  public async generateVideoClip(
    options: ComfyUIGenerateOptions
  ): Promise<{ success: boolean; videoPath: string }> {

    // 1. Verify server is running
    const alive = await this.isServerAlive();
    if (!alive) {
      throw new Error(
        `ComfyUI server is not reachable at ${this.serverUrl}. Please start ComfyUI Desktop first.`
      );
    }

    this.logger.info(
      `🎨 ComfyUI: Submitting workflow (model=${options.model || 'ltx-video'}) — "${options.prompt.slice(0, 50)}..."`
    );

    // 2. Build workflow based on selected model
    const workflow = this.buildLTXWorkflow(options);

    // 3. POST /api/prompt
    const submitRes = await fetch(`${this.serverUrl}/api/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow }),
    });

    if (!submitRes.ok) {
      const errText = await submitRes.text();
      throw new Error(`ComfyUI prompt submission failed (${submitRes.status}): ${errText}`);
    }

    const submitData = await submitRes.json();
    const promptId: string = submitData.prompt_id;
    this.logger.info(`🎨 ComfyUI: Prompt queued — prompt_id=${promptId}`);

    // 4. Poll /api/history/{prompt_id} until done
    let outputInfo: { filename: string; subfolder: string; type: string } | null = null;
    let attempts = 0;

    while (attempts < this.maxPollAttempts) {
      await new Promise((r) => setTimeout(r, this.pollIntervalMs));
      attempts++;

      try {
        const histRes = await fetch(`${this.serverUrl}/api/history/${promptId}`);
        if (!histRes.ok) continue;

        const histData = await histRes.json();
        const entry = histData[promptId];

        if (!entry) continue; // not yet in history

        // Check for errors
        if (entry.status?.status_str === 'error') {
          const errMsg = entry.status?.messages?.map((m: any) => JSON.stringify(m)).join('; ') || 'Unknown error';
          throw new Error(`ComfyUI execution error: ${errMsg}`);
        }

        if (entry.status?.completed || entry.outputs) {
          // Find the video output from VHS_VideoCombine (node "8") or fallback to any gifs/videos node
          const outputs = entry.outputs || {};
          for (const nodeId of Object.keys(outputs)) {
            const nodeOutput = outputs[nodeId];
            // VHS_VideoCombine puts results in "gifs" array
            if (nodeOutput.gifs && nodeOutput.gifs.length > 0) {
              outputInfo = nodeOutput.gifs[0];
              break;
            }
            // Some nodes use "videos" array
            if (nodeOutput.videos && nodeOutput.videos.length > 0) {
              outputInfo = nodeOutput.videos[0];
              break;
            }
            // Fallback: images array (for SaveAnimatedWEBP etc)
            if (nodeOutput.images && nodeOutput.images.length > 0) {
              outputInfo = nodeOutput.images[0];
              break;
            }
          }
          break;
        }
      } catch (err: any) {
        if (err.message.startsWith('ComfyUI execution error')) throw err;
        // Network hiccup — keep polling
      }

      if (attempts % 15 === 0) {
        this.logger.info(`🎨 ComfyUI: Still generating... (${attempts * this.pollIntervalMs / 1000}s elapsed)`);
      }
    }

    if (!outputInfo) {
      throw new Error(`ComfyUI: Timed out waiting for video output after ${this.maxPollAttempts * this.pollIntervalMs / 1000}s`);
    }

    this.logger.info(`🎨 ComfyUI: Generation complete — downloading ${outputInfo.filename}`);

    // 5. Download the output video
    const viewUrl = `${this.serverUrl}/api/view?filename=${encodeURIComponent(outputInfo.filename)}&subfolder=${encodeURIComponent(outputInfo.subfolder || '')}&type=${encodeURIComponent(outputInfo.type || 'output')}`;
    const videoRes = await fetch(viewUrl);

    if (!videoRes.ok) {
      throw new Error(`ComfyUI: Failed to download output video (${videoRes.status})`);
    }

    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
    const outDir = path.dirname(options.outputPath);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    fs.writeFileSync(options.outputPath, videoBuffer);

    this.logger.info(`✅ ComfyUI: Video saved to ${options.outputPath} (${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

    return {
      success: true,
      videoPath: options.outputPath,
    };
  }
}
