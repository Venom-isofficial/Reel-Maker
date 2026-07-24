import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';

export interface CaptionWord {
  word: string;
  start: number;
  end: number;
}

export interface PhraseChunk {
  words: CaptionWord[];
  start: number;
  end: number;
}

export const CaptionsOverlay: React.FC<{ words: CaptionWord[] }> = ({ words = [] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  if (!words || words.length === 0) return null;

  // Group words into FULL SENTENCES (1 full sentence per view)
  const phrases: PhraseChunk[] = [];
  let currentWords: CaptionWord[] = [];

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    currentWords.push(w);

    const isSentenceEnd = /[.?!]/.test(w.word);
    const isClauseEnd = /[:;]/.test(w.word) && currentWords.length >= 6;
    const isMaxSentenceWords = currentWords.length >= 11;
    const isLast = i === words.length - 1;

    if (isSentenceEnd || isClauseEnd || isMaxSentenceWords || isLast) {
      phrases.push({
        words: currentWords,
        start: currentWords[0].start,
        end: currentWords[currentWords.length - 1].end,
      });
      currentWords = [];
    }
  }

  // Smoothly extend each sentence's end time to the start of the next sentence
  for (let i = 0; i < phrases.length - 1; i++) {
    phrases[i].end = Math.max(phrases[i].end, phrases[i + 1].start - 0.05);
  }

  // Find active sentence for current video frame
  const activePhrase =
    phrases.find((p) => currentTime >= p.start && currentTime <= p.end) ||
    phrases.find((p) => currentTime < p.start) ||
    phrases[phrases.length - 1];

  if (!activePhrase || !activePhrase.words) return null;

  // Determine active word index with continuous gap-bridging alignment
  let activeWordIndex = -1;
  for (let idx = 0; idx < activePhrase.words.length; idx++) {
    const item = activePhrase.words[idx];
    const nextItem = activePhrase.words[idx + 1];
    
    // 50ms pre-padding for natural perception + bridge inter-word pause gaps
    const wordStart = item.start - 0.05;
    const wordEnd = nextItem ? nextItem.start - 0.01 : item.end + 0.2;

    if (currentTime >= wordStart && currentTime < wordEnd) {
      activeWordIndex = idx;
      break;
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '180px',
        left: '5%',
        right: '5%',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '12px 14px',
        padding: '24px 28px',
        background: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(18px)',
        borderRadius: '24px',
        border: '2px solid rgba(250, 204, 21, 0.45)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9)',
        textAlign: 'center',
        zIndex: 100,
      }}
    >
      {activePhrase.words.map((item, idx) => {
        const isHighlighted = idx === activeWordIndex;
        return (
          <span
            key={idx}
            style={{
              fontFamily: "Impact, 'Montserrat', 'Inter', sans-serif",
              fontSize: '44px',
              lineHeight: '1.25',
              fontWeight: '900',
              textTransform: 'uppercase',
              letterSpacing: '1.2px',
              color: isHighlighted ? '#FACC15' : '#FFFFFF',
              WebkitTextStroke: isHighlighted ? '1.5px #000' : '1.5px #000',
              textShadow: isHighlighted
                ? '0 0 30px rgba(250, 204, 21, 1), 0 0 15px rgba(250, 204, 21, 0.9), 0 4px 12px rgba(0, 0, 0, 0.95)'
                : '3px 3px 6px rgba(0, 0, 0, 0.9)',
              transform: isHighlighted ? 'scale(1.22)' : 'scale(1)',
              transition: 'all 0.08s ease-in-out',
              display: 'inline-block',
            }}
          >
            {item.word}
          </span>
        );
      })}
    </div>
  );
};
