import fs from 'fs';
import path from 'path';
import http from 'http';
import net from 'net';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ServiceResult } from '../types';

const execAsync = promisify(exec);

export class RemotionService {
  /**
   * Helper to stitch scene clips into stitched_video.mp4 using FFmpeg concat filter
   */
  public async stitchClipsWithFFmpeg(runDir: string, sceneCount: number): Promise<string | null> {
    const clipsDir = path.join(runDir, 'clips');
    const stitchedPath = path.join(clipsDir, 'stitched_video.mp4');
    const concatListPath = path.join(clipsDir, 'concat_list.txt');

    try {
      if (!fs.existsSync(clipsDir)) return null;

      const clipFiles: string[] = [];
      for (let i = 1; i <= sceneCount; i++) {
        const clipName = `scene_${String(i).padStart(2, '0')}.mp4`;
        const fullPath = path.join(clipsDir, clipName);
        if (fs.existsSync(fullPath)) {
          clipFiles.push(`file '${clipName}'`);
        }
      }

      if (clipFiles.length === 0) return null;

      fs.writeFileSync(concatListPath, clipFiles.join('\n'), 'utf-8');

      console.log(`Stitching ${clipFiles.length} scene clips with FFmpeg into stitched_video.mp4...`);
      const cmd = `ffmpeg -y -f concat -safe 0 -i "${concatListPath.replace(/\\/g, '/')}" -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30" -c:v libx264 -preset ultrafast -pix_fmt yuv420p -an "${stitchedPath.replace(/\\/g, '/')}"`;
      await execAsync(cmd, { timeout: 45000 });

      if (fs.existsSync(stitchedPath) && fs.statSync(stitchedPath).size > 100000) {
        console.log(`✅ FFmpeg Video Stitching Complete: (${fs.statSync(stitchedPath).size} bytes)`);
        return stitchedPath;
      }
    } catch (err: any) {
      console.warn('FFmpeg scene stitching error:', err.message);
    }
    return null;
  }

  /**
   * Spawns a temporary static HTTP server on a free port to serve run directory assets to Remotion Chromium
   */
  private startStaticHttpServer(baseDir: string): Promise<{ server: http.Server; baseUrl: string }> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        let reqPath = decodeURIComponent(req.url || '').split('?')[0];
        const filePath = path.join(baseDir, reqPath);

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          const contentType = ext === '.mp3' ? 'audio/mpeg' : ext === '.mp4' ? 'video/mp4' : 'application/octet-stream';
          res.writeHead(200, {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
            'Content-Length': fs.statSync(filePath).size
          });
          fs.createReadStream(filePath).pipe(res);
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as net.AddressInfo;
        resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
      });
    });
  }

  public async renderVideo(runDir: string): Promise<ServiceResult<string>> {
    const renderDir = path.join(runDir, 'render');
    const finalMp4Path = path.join(renderDir, 'final.mp4');

    try {
      if (!fs.existsSync(renderDir)) {
        fs.mkdirSync(renderDir, { recursive: true });
      }

      const masterPath = path.join(runDir, 'master.json');
      const voicePath = path.join(runDir, 'voice.mp3');
      const captionsPath = path.join(runDir, 'captions.json');
      const srtPath = path.join(runDir, 'captions.srt');

      if (!fs.existsSync(masterPath) || !fs.existsSync(voicePath)) {
        return {
          success: false,
          retryable: true,
          errorMessage: 'Missing master.json or voice.mp3 in run folder for Remotion render.',
        };
      }

      let masterData: any = {};
      let captionData: any = {};
      if (fs.existsSync(masterPath)) masterData = JSON.parse(fs.readFileSync(masterPath, 'utf-8'));
      if (fs.existsSync(captionsPath)) captionData = JSON.parse(fs.readFileSync(captionsPath, 'utf-8'));

      const sceneCount = (masterData.scenes || []).length || 6;
      
      // 1. Stitch scene clips with FFmpeg into stitched_video.mp4
      const stitchedLocalPath = await this.stitchClipsWithFFmpeg(runDir, sceneCount);

      // Start temporary local HTTP server on a random free port for Remotion Chromium
      const { server, baseUrl } = await this.startStaticHttpServer(runDir);

      try {
        const formattedScenes = (masterData.scenes || []).map((sc: any) => ({
          ...sc,
          clipPath: `${baseUrl}/clips/scene_${String(sc.sceneNumber).padStart(2, '0')}.mp4`,
        }));

        const propsObj = {
          scenes: formattedScenes,
          words: captionData.words || [],
          audioPath: `${baseUrl}/voice.mp3`,
          stitchedVideoPath: stitchedLocalPath ? `${baseUrl}/clips/stitched_video.mp4` : undefined,
          watermarkText: 'AI REEL FACTORY',
        };

        const propsJsonPath = path.join(runDir, 'remotion_props.json');
        fs.writeFileSync(propsJsonPath, JSON.stringify(propsObj, null, 2), 'utf-8');

        // 2. Remotion CLI Render (180s timeout so animated subtitles overlay completely renders)
        const rootPath = path.resolve(process.cwd(), 'src/remotion/Root.tsx');
        const cmd = `npx remotion render "${rootPath.replace(/\\/g, '/')}" ReelComposition "${finalMp4Path.replace(/\\/g, '/')}" --props="${propsJsonPath.replace(/\\/g, '/')}" --concurrency=2`;
        
        console.log(`Executing Remotion CLI render with Subtitles Overlay: ${cmd}`);
        await execAsync(cmd, { timeout: 180000 });

        if (fs.existsSync(finalMp4Path) && fs.statSync(finalMp4Path).size > 100000) {
          console.log(`✅ Remotion CLI Render Complete with Subtitles Overlay (${fs.statSync(finalMp4Path).size} bytes)`);
          server.close();
          return { success: true, retryable: false, data: finalMp4Path };
        }
      } catch (cliErr: any) {
        console.warn("Remotion CLI render note:", cliErr.message);
      } finally {
        server.close();
      }

      // 3. Fallback: FFmpeg Subtitle Burn-In Muxer
      if (stitchedLocalPath && fs.existsSync(voicePath)) {
        try {
          console.log('Burning subtitles and combining audio/video with FFmpeg...');
          let filterChain = '';
          if (fs.existsSync(srtPath)) {
            const escapedSrt = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
            filterChain = `-vf "subtitles='${escapedSrt}':force_style='Fontname=Impact,FontSize=28,PrimaryColour=&H0000FFFF,OutlineColour=&H00000000,BackColour=&H80000000,BorderStyle=4,Outline=2,Shadow=2,Alignment=2,MarginV=100,Bold=1'"`;
          }

          const muxCmd = `ffmpeg -y -i "${stitchedLocalPath.replace(/\\/g, '/')}" -i "${voicePath.replace(/\\/g, '/')}" ${filterChain} -c:v libx264 -preset ultrafast -c:a aac -shortest "${finalMp4Path.replace(/\\/g, '/')}"`;
          await execAsync(muxCmd, { timeout: 60000 });

          if (fs.existsSync(finalMp4Path) && fs.statSync(finalMp4Path).size > 100000) {
            console.log(`✅ FFmpeg Subtitle Burn-In Muxing Succeeded (${fs.statSync(finalMp4Path).size} bytes)`);
            return { success: true, retryable: false, data: finalMp4Path };
          }
        } catch (muxErr: any) {
          console.warn('FFmpeg subtitle muxing fallback error:', muxErr.message);
        }
      }

      return {
        success: false,
        retryable: true,
        errorMessage: 'Remotion render and FFmpeg video stitching both failed.',
      };
    } catch (err: any) {
      return {
        success: false,
        retryable: true,
        errorMessage: `Failed Remotion render: ${err.message}`,
      };
    }
  }
}
