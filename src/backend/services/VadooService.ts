import fs from 'fs';
import path from 'path';
import subprocess from 'child_process';
import { ServiceResult } from '../types';

export interface VadooGenerateOptions {
  topic: string;
  outputPath: string;
  voice?: string;
  theme?: string;
  language?: string;
  duration?: string;
}

export class VadooService {
  private apiKey: string;
  private baseUrl = 'https://viralapi.vadoo.tv/api';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.VADOO_API_KEY || '2GmLXthKf1MYmPX33jET1Izns06fUZlExpRoOJoa5BQ';
  }

  public setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  public async generateVideoClip(options: VadooGenerateOptions): Promise<ServiceResult<{ videoPath: string; vid: string }>> {
    const {
      topic,
      outputPath,
      voice = 'Charlie',
      theme = 'Hormozi_1',
      language = 'English',
      duration = '30-60'
    } = options;

    if (!this.apiKey) {
      return {
        success: false,
        retryable: false,
        errorMessage: 'Vadoo AI API key is missing.',
      };
    }

    try {
      console.log(`🎬 Submitting Vadoo AI Text-to-Video task... Topic: "${topic.slice(0, 50)}..."`);

      const submitEndpoint = `${this.baseUrl}/generate_video`;
      const submitRes = await fetch(submitEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': this.apiKey,
        },
        body: JSON.stringify({
          topic,
          voice,
          theme,
          language,
          duration,
        }),
      });

      const submitData: any = await submitRes.json();

      if (!submitRes.ok) {
        throw new Error(`Vadoo AI submission error (${submitRes.status}): ${submitData.message || JSON.stringify(submitData)}`);
      }

      const vid = submitData.vid;
      if (!vid) {
        throw new Error(`Vadoo AI response missing 'vid': ${JSON.stringify(submitData)}`);
      }

      console.log(`✅ Vadoo AI video task submitted! Video ID: ${vid}`);

      return {
        success: true,
        retryable: false,
        data: {
          videoPath: outputPath,
          vid,
        },
      };
    } catch (error: any) {
      console.error(`❌ VadooService error: ${error.message}`);
      return {
        success: false,
        retryable: true,
        errorMessage: error.message,
      };
    }
  }
}
