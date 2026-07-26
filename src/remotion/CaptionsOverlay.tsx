import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { loadFont as loadBangers } from '@remotion/google-fonts/Bangers';
import { loadFont as loadMontserrat } from '@remotion/google-fonts/Montserrat';

const { fontFamily: bangersFont } = loadBangers();
const { fontFamily: montserratFont } = loadMontserrat('italic', { weights: ['900'] });

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

  // Group words into MINIMAL CHUNKS (2-4 words per burst, default max 3 words)
  const MAX_WORDS_PER_CHUNK = 3;
  const phrases: PhraseChunk[] = [];
  let currentWords: CaptionWord[] = [];

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    currentWords.push(w);

    const isPunctuationEnd = /[.?!;,]/.test(w.word);
    const isChunkFull = currentWords.length >= MAX_WORDS_PER_CHUNK;
    const isLast = i === words.length - 1;

    if (isPunctuationEnd || isChunkFull || isLast) {
      phrases.push({
        words: currentWords,
        start: currentWords[0].start,
        end: currentWords[currentWords.length - 1].end,
      });
      currentWords = [];
    }
  }

  // Smoothly extend each chunk's end time to the start of the next chunk for continuous flow
  for (let i = 0; i < phrases.length - 1; i++) {
    phrases[i].end = Math.max(phrases[i].end, phrases[i + 1].start - 0.03);
  }

  // Find active 2-4 word chunk for current video frame
  const activePhrase =
    phrases.find((p) => currentTime >= p.start && currentTime <= p.end) ||
    phrases.find((p) => currentTime < p.start) ||
    phrases[phrases.length - 1];

  if (!activePhrase || !activePhrase.words || activePhrase.words.length === 0) return null;

  // Determine active word index with continuous gap-bridging alignment
  let activeWordIndex = -1;
  for (let idx = 0; idx < activePhrase.words.length; idx++) {
    const item = activePhrase.words[idx];
    const nextItem = activePhrase.words[idx + 1];

    const wordStart = item.start - 0.05;
    const wordEnd = nextItem ? nextItem.start - 0.01 : item.end + 0.25;

    if (currentTime >= wordStart && currentTime < wordEnd) {
      activeWordIndex = idx;
      break;
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '220px',
        left: '5%',
        right: '5%',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '10px 18px',
        padding: '0 20px',
        textAlign: 'center',
        zIndex: 100,
        pointerEvents: 'none',
      }}
    >
      {activePhrase.words.map((item, idx) => {
        const isHighlighted = idx === activeWordIndex;
        const cleanWord = item.word.replace(/[.?!;,]/g, '').toUpperCase();

        return (
          <span
            key={idx}
            style={{
              fontFamily: `${bangersFont}, ${montserratFont}, 'Impact', 'Arial Black', sans-serif`,
              fontStyle: 'italic',
              fontSize: '58px',
              lineHeight: '1.15',
              fontWeight: '900',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              color: isHighlighted ? '#FACC15' : '#FFFFFF',
              WebkitTextStroke: '3.5px #000000',
              paintOrder: 'stroke fill',
              textShadow: isHighlighted
                ? '3px 3px 0 #000, -3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 0 0 20px rgba(250, 204, 21, 0.8), 0 6px 12px rgba(0, 0, 0, 0.95)'
                : '3px 3px 0 #000, -3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 0 6px 12px rgba(0, 0, 0, 0.95)',
              display: 'inline-block',
            }}
          >
            {cleanWord}
          </span>
        );
      })}
    </div>
  );
};
