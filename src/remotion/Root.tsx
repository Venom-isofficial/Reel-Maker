import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { ReelComposition } from './ReelComposition';

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="ReelComposition"
        component={ReelComposition}
        durationInFrames={1050} // 35 seconds @ 30 FPS
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          watermarkText: 'AI REEL FACTORY',
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

