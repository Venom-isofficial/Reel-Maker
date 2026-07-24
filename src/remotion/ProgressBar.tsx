import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';

export const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const progressPercent = Math.min(100, (frame / durationInFrames) * 100);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '8px',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        zIndex: 100,
      }}
    >
      <div
        style={{
          width: `${progressPercent}%`,
          height: '100%',
          background: 'linear-gradient(90deg, #6366f1, #38bdf8, #ec4899)',
          boxShadow: '0 0 15px rgba(56, 189, 248, 0.8)',
          borderRadius: '0 4px 4px 0',
        }}
      />
    </div>
  );
};
