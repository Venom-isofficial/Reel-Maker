import React from 'react';
import { Sequence, Audio, OffthreadVideo, Video, useCurrentFrame, useVideoConfig } from 'remotion';
import { CaptionsOverlay } from './CaptionsOverlay';
import { ProgressBar } from './ProgressBar';

export interface ReelCompositionProps {
  scenes?: Array<{
    sceneNumber: number;
    durationSeconds: number;
    narrationText: string;
    clipPath?: string;
  }>;
  words?: Array<{ word: string; start: number; end: number }>;
  audioPath?: string;
  stitchedVideoPath?: string;
  watermarkText?: string;
}

export const ReelComposition: React.FC<ReelCompositionProps> = ({
  scenes = [],
  words = [],
  audioPath,
  stitchedVideoPath,
  watermarkText = 'Nexus - Market News',
}) => {
  const { fps } = useVideoConfig();
  let currentStartFrame = 0;

  const bgGradients = [
    'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)',
    'linear-gradient(135deg, #064e3b 0%, #0f172a 50%, #1e293b 100%)',
    'linear-gradient(135deg, #451a03 0%, #311042 50%, #0f172a 100%)',
    'linear-gradient(135deg, #1e1b4b 0%, #064e3b 50%, #0f172a 100%)',
  ];

  return (
    <div
      style={{
        flex: 1,
        backgroundColor: '#0f172a',
        position: 'relative',
        width: '1080px',
        height: '1920px',
        overflow: 'hidden',
      }}
    >
      {/* Top Progress Bar */}
      <ProgressBar />

      {/* Watermark Logo Badge */}
      <div
        style={{
          position: 'absolute',
          top: '45px',
          left: '45px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 24px',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(14px)',
          borderRadius: '32px',
          border: '1px solid rgba(255,255,255,0.22)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          maxWidth: '990px',
          zIndex: 90,
        }}
      >
        <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#38bdf8', boxShadow: '0 0 12px #38bdf8', flexShrink: 0 }} />
        <span style={{ fontFamily: 'Inter', fontSize: '20px', fontWeight: '800', color: '#f8fafc', letterSpacing: '1.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {watermarkText.startsWith('Nexus -') ? watermarkText : `Nexus - ${watermarkText}`}
        </span>
      </div>

      {/* Main Video Background: Stitched Video or Sequential Clips */}
      {stitchedVideoPath ? (
        <OffthreadVideo
          src={stitchedVideoPath}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '1080px',
            height: '1920px',
            objectFit: 'cover',
            zIndex: 1,
          }}
        />
      ) : (
        scenes.map((scene, index) => {
          const sceneDurationFrames = Math.max(30, Math.round((scene.durationSeconds || 5) * fps));
          const fromFrame = currentStartFrame;
          currentStartFrame += sceneDurationFrames;
          const bgStyle = bgGradients[index % bgGradients.length];

          return (
            <Sequence key={index} from={fromFrame} durationInFrames={sceneDurationFrames}>
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  background: bgStyle,
                }}
              >
                {scene.clipPath && (
                  <OffthreadVideo
                    src={scene.clipPath}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                )}
              </div>
            </Sequence>
          );
        })
      )}

      {/* Animated Word Subtitles Overlay */}
      {words.length > 0 && <CaptionsOverlay words={words} />}

      {/* Audio Track Sync */}
      {audioPath && <Audio src={audioPath} />}
    </div>
  );
};
