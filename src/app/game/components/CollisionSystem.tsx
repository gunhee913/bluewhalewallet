'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../lib/useGameStore';
import { getStageByTier } from '../lib/gameConfig';
import { getNPCPosition } from '../lib/npcRegistry';
import { triggerEatEffect } from './EatEffect';
import { playEatSound, playItemSound } from '../lib/sounds';

export default function CollisionSystem({ playerRef }: { playerRef: React.RefObject<any> }) {
  const cooldownRef = useRef(0);

  useFrame((_, delta) => {
    const state = useGameStore.getState();
    const { npcs, playerTier, isStarted, isGameOver, isCleared, isPaused,
      addExp, eatNPC, setGameOver, isDashing, items, collectItem, boss, setBoss,
      incrementCombo, getComboMultiplier, combo } = state;

    if (!playerRef.current?.position || !isStarted || isGameOver || isCleared || isPaused) return;

    cooldownRef.current -= delta;
    if (cooldownRef.current > 0) return;

    const playerPos = playerRef.current.position;
    const playerStage = getStageByTier(playerTier);
    const now = Date.now();
    const hasShield = state.activeEffects.some((e) => e.type === 'shield' && e.endTime > now);
    const isInvincible = isDashing || hasShield;

    for (const npc of npcs) {
      if (!npc.alive) continue;

      const npcPos = getNPCPosition(npc.id);
      if (!npcPos) continue;

      const dx = playerPos.x - npcPos.x;
      const dy = playerPos.y - npcPos.y;
      const dz = playerPos.z - npcPos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      const npcStage = getStageByTier(npc.tier);
      const eatRange = (playerStage.size + npcStage.size) * 1.2;
      const dangerRange = (playerStage.size + npcStage.size) * 0.4;

      if (npc.tier <= playerTier && dist < eatRange) {
        incrementCombo();
        const multiplier = getComboMultiplier();
        const baseExp = npc.tier < playerTier ? Math.max(npc.tier, 1) : 1;
        const expGain = Math.round(baseExp * multiplier);
        addExp(expGain);
        eatNPC(npc.id);
        triggerEatEffect(npcPos.x, npcPos.y, npcPos.z, npcStage.color);
        playEatSound(combo);
        cooldownRef.current = 0.08;
        break;
      } else if (npc.tier > playerTier && dist < dangerRange && !isInvincible) {
        setGameOver();
        break;
      }
    }

    for (const item of items) {
      const dx = playerPos.x - item.x;
      const dy = playerPos.y - item.y;
      const dz = playerPos.z - item.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < playerStage.size + 1.0) {
        collectItem(item.id);
        playItemSound();
        break;
      }
    }

    if (boss?.alive) {
      const dx = playerPos.x - boss.x;
      const dy = playerPos.y - boss.y;
      const dz = playerPos.z - boss.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < playerStage.size + 3 && !isInvincible) {
        setGameOver();
      }
    }
  });

  return null;
}
