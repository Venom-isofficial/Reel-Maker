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
      try {
        const nvencCmd = `ffmpeg -y -f concat -safe 0 -i "${concatListPath.replace(/\\/g, '/')}" -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,tpad=stop_mode=clone:stop_duration=15" -c:v h264_nvenc -preset p4 -pix_fmt yuv420p -an "${stitchedPath.replace(/\\/g, '/')}"`;
        await execAsync(nvencCmd, { timeout: 45000 });
        if (fs.existsSync(stitchedPath) && fs.statSync(stitchedPath).size > 100000) {
          console.log(`✅ NVIDIA NVENC FFmpeg Video Stitching Complete with Frame Padding: (${fs.statSync(stitchedPath).size} bytes)`);
          return stitchedPath;
        }
      } catch (nvencErr: any) {
        console.warn('NVENC FFmpeg scene stitching fallback to libx264:', nvencErr.message);
      }

      const cmd = `ffmpeg -y -f concat -safe 0 -i "${concatListPath.replace(/\\/g, '/')}" -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,tpad=stop_mode=clone:stop_duration=15" -c:v libx264 -preset ultrafast -pix_fmt yuv420p -an "${stitchedPath.replace(/\\/g, '/')}"`;
      await execAsync(cmd, { timeout: 45000 });

      if (fs.existsSync(stitchedPath) && fs.statSync(stitchedPath).size > 100000) {
        console.log(`✅ FFmpeg Video Stitching Complete with Frame Padding: (${fs.statSync(stitchedPath).size} bytes)`);
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
          const stat = fs.statSync(filePath);
          const fileSize = stat.size;
          const ext = path.extname(filePath).toLowerCase();
          const contentType = ext === '.mp3' ? 'audio/mpeg' : ext === '.mp4' ? 'video/mp4' : 'application/octet-stream';
          const range = req.headers.range;

          if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = end - start + 1;
            const file = fs.createReadStream(filePath, { start, end });
            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunksize,
              'Content-Type': contentType,
              'Access-Control-Allow-Origin': '*',
            });
            file.pipe(res);
          } else {
            res.writeHead(200, {
              'Content-Type': contentType,
              'Access-Control-Allow-Origin': '*',
              'Content-Length': fileSize,
              'Accept-Ranges': 'bytes',
            });
            fs.createReadStream(filePath).pipe(res);
          }
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
    const finalMp4Path = path.join(runDir, 'render/final.mp4');
    const renderDir = path.dirname(finalMp4Path);

    try {
      if (!fs.existsSync(renderDir)) {
        fs.mkdirSync(renderDir, { recursive: true });
      }

      const articlePath = path.join(runDir, 'article.json');
      const masterPath = path.join(runDir, 'master.json');
      const voicePath = path.join(runDir, 'voice.mp3');
      const captionsPath = path.join(runDir, 'captions.json');
      const srtPath = path.join(runDir, 'captions.srt');
      const metadataPath = path.join(runDir, 'metadata.json');

      if (!fs.existsSync(masterPath) || !fs.existsSync(voicePath)) {
        return {
          success: false,
          retryable: true,
          errorMessage: 'Missing master.json or voice.mp3 in run folder for Remotion render.',
        };
      }

      let articleData: any = {};
      let masterData: any = {};
      let captionData: any = {};
      let metadataData: any = {};
      if (fs.existsSync(articlePath)) articleData = JSON.parse(fs.readFileSync(articlePath, 'utf-8'));
      if (fs.existsSync(masterPath)) masterData = JSON.parse(fs.readFileSync(masterPath, 'utf-8'));
      if (fs.existsSync(captionsPath)) captionData = JSON.parse(fs.readFileSync(captionsPath, 'utf-8'));
      if (fs.existsSync(metadataPath)) metadataData = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

      const newsHeadline = articleData.headline || metadataData.title || masterData.title || 'Market Update';
      const watermarkText = `Nexus - ${newsHeadline}`;

      const sceneCount = (masterData.scenes || []).length || 6;
      
      // 1. Stitch scene clips with FFmpeg into stitched_video.mp4 using NVENC GPU acceleration
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
          watermarkText,
        };

        const propsJsonPath = path.join(runDir, 'remotion_props.json');
        fs.writeFileSync(propsJsonPath, JSON.stringify(propsObj, null, 2), 'utf-8');

        // 1. Primary Engine: Remotion CLI Render (Renders original Bangers/Montserrat animated yellow subtitles)
        try {
          const rootPath = path.resolve(process.cwd(), 'src/remotion/Root.tsx');
          const cmd = `npx remotion render "${rootPath.replace(/\\/g, '/')}" ReelComposition "${finalMp4Path.replace(/\\/g, '/')}" --props="${propsJsonPath.replace(/\\/g, '/')}" --gl=angle --enable-gpu --chromium-flags="--ignore-gpu-blocklist --gpu-active-vendor-id=0x10de --gpu-preference=2 --gpu-preference=high-performance --force-high-performance-gpu --enable-gpu-rasterization --enable-zero-copy --use-gl=angle --use-angle=d3d11 --disable-software-rasterizer" --concurrency=2`;
          
          const nvidiaEnv = {
            ...process.env,
            CUDA_VISIBLE_DEVICES: '0',
            SHIM_MCCOMPAT_ID: '1',
            __NV_PRIME_RENDER_OFFLOAD: '1',
            __GLX_VENDOR_LIBRARY_NAME: 'nvidia',
          };

          console.log(`🚀 Executing Remotion GPU Render (Bangers/Montserrat Animated Captions)...`);
          await execAsync(cmd, { env: nvidiaEnv, timeout: 180000 });

          if (fs.existsSync(finalMp4Path) && fs.statSync(finalMp4Path).size > 100000) {
            console.log(`✅ Remotion GPU Render Complete with Original Styled Captions (${fs.statSync(finalMp4Path).size} bytes)`);
            server.close();
            return { success: true, retryable: false, data: finalMp4Path };
          }
        } catch (cliErr: any) {
          console.warn('Remotion CLI render note:', cliErr.message);
        }

        // 2. Secondary Engine: FFmpeg NVENC Subtitle Burn-In (Fallback)
        if (stitchedLocalPath && fs.existsSync(voicePath)) {
          try {
            let filterChain = '';
            const assPath = path.join(runDir, 'captions.ass');
            if (fs.existsSync(assPath)) {
              const escapedAss = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');
              filterChain = `-vf "ass='${escapedAss}'"`;
            } else if (fs.existsSync(srtPath)) {
              const escapedSrt = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
              filterChain = `-vf "subtitles='${escapedSrt}':force_style='Fontname=Arial,FontSize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=3,Shadow=2,Alignment=2,MarginV=120,Bold=1,Italic=1'"`;
            }

            console.log(`Fallback: Executing FFmpeg NVENC Subtitle Burn-In...`);
            const nvencMuxCmd = `ffmpeg -y -i "${stitchedLocalPath.replace(/\\/g, '/')}" -i "${voicePath.replace(/\\/g, '/')}" ${filterChain} -c:v h264_nvenc -gpu 0 -preset p4 -pix_fmt yuv420p -c:a aac -shortest "${finalMp4Path.replace(/\\/g, '/')}"`;
            await execAsync(nvencMuxCmd, { timeout: 60000 });

            if (fs.existsSync(finalMp4Path) && fs.statSync(finalMp4Path).size > 100000) {
              console.log(`✅ FFmpeg NVENC Subtitle Burn-In Complete (${fs.statSync(finalMp4Path).size} bytes)`);
              server.close();
              return { success: true, retryable: false, data: finalMp4Path };
            }
          } catch (nvencMuxErr: any) {
            console.warn('NVENC FFmpeg GPU rendering note:', nvencMuxErr.message);
          }
        }

        return {
          success: false,
          retryable: true,
          errorMessage: 'Remotion render and FFmpeg video stitching both failed.',
        };
      } catch (innerErr: any) {
        server.close();
        return {
          success: false,
          retryable: true,
          errorMessage: `Inner render failed: ${innerErr.message}`,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        retryable: true,
        errorMessage: `Failed Remotion render: ${err.message}`,
      };
    }
  }
}
