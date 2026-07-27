import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { loadFont as loadBangers } from '@remotion/google-fonts/Bangers';
import { loadFont as loadMontserrat } from '@remotion/google-fonts/Montserrat';
import { ReelComposition } from './ReelComposition';

loadBangers();
loadMontserrat('italic', { weights: ['900'] });

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="ReelComposition"
        component={ReelComposition}
        calculateMetadata={async ({ props }: { props: any }) => {
          const words: any[] = (props && Array.isArray(props.words)) ? props.words : [];
          const lastWordEnd = words.length > 0 ? (words[words.length - 1]?.end || 0) : 0;
          const scenes: any[] = (props && Array.isArray(props.scenes)) ? props.scenes : [];
          const scenesTotal = scenes.reduce((acc: number, s: any) => acc + (s.durationSeconds || 5), 0);

          // Calculate exact video duration in seconds (capped strictly under 30s)
          const rawDuration = Math.max(lastWordEnd + 0.8, scenesTotal + 0.5, 24);
          const durationSeconds = Math.min(29.5, rawDuration);
          return {
            durationInFrames: Math.ceil(durationSeconds * 30),
          };
        }}
        durationInFrames={1200}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          watermarkText: 'Nexus - Market News',
          scenes: [
            { sceneNumber: 1, durationSeconds: 5, narrationText: 'Tech stock rally record high' },
            { sceneNumber: 2, durationSeconds: 5, narrationText: 'Inflation reports spark surge' },
          ],
          words: [
            { word: 'TECH', start: 0.2, end: 0.5 },
            { word: 'STOCKS', start: 0.5, end: 0.9 },
            { word: 'SURGE', start: 0.9, end: 1.4 },
          ],
        }}
      />
    </>
  );
};

registerRoot(Root);

