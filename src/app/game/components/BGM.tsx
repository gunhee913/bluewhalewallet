'use client';

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../lib/useGameStore';

const BGM_TRACKS = ['/game/bgm1.mp3', '/game/bgm2.mp3', '/game/bgm3.mp3'];

export default function BGM() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
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
    const handler = (e: Event) => {
      const vol = (e as CustomEvent).detail;
      if (audioRef.current) audioRef.current.volume = vol;
    };
    window.addEventListener('bgm-volume', handler);
    return () => window.removeEventListener('bgm-volume', handler);
  }, []);

  return null;
}
