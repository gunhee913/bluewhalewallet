'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGameStore } from '../lib/useGameStore';
import { playEventSound } from '../lib/sounds';
import { registerPlayerRef } from './NPCs';

export default function EventSystem() {
  const lastCheckRef = useRef(0);
  const { scene } = useThree();

  useFrame(() => {
    const state = useGameStore.getState();
    if (!state.isStarted || state.isGameOver || state.isCleared || state.isPaused) return;

    const now = Date.now();

    if (state.activeEvent && now > state.activeEvent.endTime) {
      if (state.activeEvent.type === 'darkness') {
        const fog = scene.fog as any;
        if (fog) fog.far = 60;
      }
      state.setEvent(null);
    }

    if (!state.activeEvent && now > state.nextEventTime && state.nextEventTime > 0) {
      const types = ['frenzy', 'current', 'darkness'] as const;
      const type = types[Math.floor(Math.random() * types.length)];
      let event: any = { type, endTime: 0 };

      switch (type) {
        case 'frenzy':
          event.endTime = now + 10000;
          playEventSound();
          break;
        case 'current':
          event.endTime = now + 15000;
          event.data = {
            dirX: (Math.random() - 0.5) * 2,
            dirZ: (Math.random() - 0.5) * 2,
          };
          playEventSound();
          break;
        case 'darkness':
          event.endTime = now + 12000;
          const fog = scene.fog as any;
          if (fog) fog.far = 20;
          playEventSound();
          break;
      }

      state.setEvent(event);
      state.setNextEventTime(now + 40000 + Math.random() * 30000);

      if (type === 'frenzy') {
        const playerPos = (scene.children.find((c: any) => c.type === 'Group') as any)?.position;
        if (playerPos) {
          state.spawnFrenzyNPCs(playerPos.x, playerPos.y, playerPos.z);
        } else {
          state.spawnFrenzyNPCs(0, 0, 0);
        }
      }
    }

    state.cleanExpiredEffects();
  });

  return null;
}
