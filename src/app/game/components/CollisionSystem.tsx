'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../lib/useGameStore';
import { getStageByTier, GOLD_PER_TIER, EAT_RANGE_UPGRADES } from '../lib/gameConfig';
import { getNPCPosition, triggerStartle } from '../lib/npcRegistry';
import { triggerEatEffect } from './EatEffect';
import { playEatSound, playItemSound } from '../lib/sounds';

const MAX_EAT_RANGE_MULTIPLIER = 5;
const MAX_BATCH_EFFECTS = 5;
const MAX_BATCH_EAT = 20;

export default function CollisionSystem({ playerRef }: { playerRef: React.RefObject<any> }) {
  const cooldownRef = useRef(0);

  useFrame((_, delta) => {
    const state = useGameStore.getState();
    const { npcs, playerTier, isStarted, isGameOver, isCleared, isPaused,
      setGameOver, isDashing, items, collectItem, boss,
      getComboMultiplier, combo, upgrades, perkBonuses, useShellDefense,
      batchEatNPCs } = state;

    if (!playerRef.current?.position || !isStarted || isGameOver || isCleared || isPaused) return;

    cooldownRef.current -= delta;
    if (cooldownRef.current > 0) return;

    const playerPos = playerRef.current.position;
    const px = playerPos.x;
    const py = playerPos.y;
    const pz = playerPos.z;
    const playerStage = getStageByTier(playerTier);
    const now = Date.now();
    const hasShield = state.activeEffects.some((e) => e.type === 'shield' && e.endTime > now);
    const isInvincible = isDashing || hasShield;

    let eatRangeMultiplier = EAT_RANGE_UPGRADES[upgrades.eatRange - 1]?.multiplier ?? 1.0;
    eatRangeMultiplier *= (1 + perkBonuses.eatRangeBonus);
    if (playerTier >= 6) eatRangeMultiplier *= 1.25;
    if (playerTier >= 7) eatRangeMultiplier *= 1.25;
    eatRangeMultiplier = Math.min(eatRangeMultiplier, MAX_EAT_RANGE_MULTIPLIER);

    const maxEatRange = (playerStage.size + 3) * 1.2 * eatRangeMultiplier;
    const maxEatRangeSq = maxEatRange * maxEatRange;
    const multiplier = getComboMultiplier();

    const eatIds: string[] = [];
    let totalExp = 0;
    let totalGold = 0;
    let effectCount = 0;
    let died = false;

    for (const npc of npcs) {
      if (!npc.alive) continue;
      const npcPos = getNPCPosition(npc.id);
      if (!npcPos) continue;

      const dx = px - npcPos.x;
      const dy = py - npcPos.y;
      const dz = pz - npcPos.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq > maxEatRangeSq + 25) continue;

      const dist = Math.sqrt(distSq);
      const npcStage = getStageByTier(npc.tier);

      if (npc.tier <= playerTier) {
        const eatRange = (playerStage.size + npcStage.size) * 1.2 * eatRangeMultiplier;
        if (dist < eatRange && eatIds.length < MAX_BATCH_EAT) {
          eatIds.push(npc.id);
          const baseExp = npc.tier < playerTier ? Math.max(npc.tier, 1) : 1;
          totalExp += Math.round(baseExp * multiplier * (1 + perkBonuses.expBonus));
          const goldAmount = GOLD_PER_TIER[npc.tier] ?? 1;
          let goldGain = Math.round(goldAmount * multiplier * (1 + perkBonuses.goldBonus));
          if (perkBonuses.goldDouble) goldGain *= 2;
          totalGold += goldGain;
          if (effectCount < MAX_BATCH_EFFECTS) {
            triggerEatEffect(npcPos.x, npcPos.y, npcPos.z, npcStage.color);
            effectCount++;
          }
        }
      } else if (!isInvincible) {
        const dangerRange = (playerStage.size + npcStage.size) * 0.4;
        if (dist < dangerRange) {
          if (!useShellDefense()) {
            died = true;
            break;
          }
        }
      }
    }

    if (died) {
      setGameOver();
      return;
    }

    if (eatIds.length > 0) {
      batchEatNPCs(eatIds, totalExp, totalGold);
      playEatSound(combo);
      triggerStartle(px, py, pz);
      cooldownRef.current = eatIds.length > 3 ? 0.15 : 0.08;
    }

    const magnetRange = perkBonuses.autoMagnetRange > 0 ? perkBonuses.autoMagnetRange : 0;
    const itemPickupRange = playerStage.size + 1.0 + magnetRange;
    for (const item of items) {
      const dx = px - item.x;
      const dy = py - item.y;
      const dz = pz - item.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq < itemPickupRange * itemPickupRange) {
        collectItem(item.id);
        playItemSound();
        break;
      }
    }

    if (boss?.alive) {
      const dx = px - boss.x;
      const dy = py - boss.y;
      const dz = pz - boss.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      const bossHitRange = playerStage.size + 1.5 * (boss.scale ?? 2);
      if (distSq < bossHitRange * bossHitRange && !isInvincible) {
        if (useShellDefense()) return;
        setGameOver();
      }
    }
  });

  return null;
}
