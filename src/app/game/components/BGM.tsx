'use client';

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../lib/useGameStore';

const BGM_TRACKS = ['/game/bgm1.mp3', '/game/bgm2.mp3', '/game/bgm3.mp3'];

export default function BGM() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(0);
  const isStarted = useGameStore((s) => s.isStarted);

  useEffect(() => {
    if (!isStarted) return;

    const idx = Math.floor(Math.random() * BGM_TRACKS.length);
    setCurrentTrack(idx);

    const audio = new Audio(BGM_TRACKS[idx]);
    audio.loop = true;
    audio.volume = 0.3;
    audio.play().catch(() => {});
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [isStarted]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    const handler = (e: Event) => {
      const vol = (e as CustomEvent).detail;
      if (audioRef.current) audioRef.current.volume = vol;
    };
    window.addEventListener('bgm-volume', handler);
    return () => window.removeEventListener('bgm-volume', handler);
  }, []);

  if (!isStarted) return null;

  return (
    <button
      onClick={() => setIsMuted(!isMuted)}
      className="fixed bottom-4 right-4 z-50 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
      title={isMuted ? '음악 켜기' : '음악 끄기'}
    >
      {isMuted ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <path d="M19.07 4.93a10 10 0 010 14.14" />
          <path d="M15.54 8.46a5 5 0 010 7.07" />
        </svg>
      )}
    </button>
  );
}
