'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../lib/useGameStore';
import { getStageByTier, GOLD_PER_TIER, EAT_RANGE_UPGRADES } from '../lib/gameConfig';
import { getNPCPosition } from '../lib/npcRegistry';
import { triggerEatEffect } from './EatEffect';
import { playEatSound, playItemSound } from '../lib/sounds';

const MAX_EAT_RANGE_MULTIPLIER = 5;
const MAX_BATCH_EFFECTS = 5;
const MAX_BATCH_EAT = 15;

export default function CollisionSystem({ playerRef }: { playerRef: React.RefObject<any> }) {
  const cooldownRef = useRef(0);
  const lastShieldTimeRef = useRef(0);

  useFrame((_, delta) => {
    const state = useGameStore.getState();
    const { npcs, playerTier, isStarted, isGameOver, isCleared, isPaused,
      addExp, addGold, eatNPC, setGameOver, isDashing, items, collectItem, boss,
      incrementCombo, getComboMultiplier, combo, upgrades, perkBonuses, useShellDefense,
      batchEatNPCs } = state;

    if (!playerRef.current?.position || !isStarted || isGameOver || isCleared || isPaused) return;

    cooldownRef.current -= delta;
    if (cooldownRef.current > 0) return;

    const playerPos = playerRef.current.position;
    const playerStage = getStageByTier(playerTier);
    const now = Date.now();
    const hasShield = state.activeEffects.some((e) => e.type === 'shield' && e.endTime > now);
    const isInvincible = isDashing || hasShield;

    if (perkBonuses.permanentShieldInterval > 0 && !hasShield) {
      if (lastShieldTimeRef.current === 0) lastShieldTimeRef.current = now;
      if (now - lastShieldTimeRef.current >= perkBonuses.permanentShieldInterval) {
        const { activeEffects } = useGameStore.getState();
        useGameStore.setState({
          activeEffects: [...activeEffects.filter((e) => e.type !== 'shield'), { type: 'shield', endTime: now + 5000 }],
        });
        lastShieldTimeRef.current = now;
      }
    }

    let eatRangeMultiplier = EAT_RANGE_UPGRADES[upgrades.eatRange - 1]?.multiplier ?? 1.0;
    eatRangeMultiplier *= (1 + perkBonuses.eatRangeBonus);

    if (playerTier >= 6) eatRangeMultiplier *= 1.25;
    if (playerTier >= 7) eatRangeMultiplier *= 1.25;

    const { activeSkill } = state;
    const skillActive = activeSkill && now < activeSkill.endTime;
    if (skillActive && activeSkill.id === 'feeding_frenzy') eatRangeMultiplier *= 2;

    eatRangeMultiplier = Math.min(eatRangeMultiplier, MAX_EAT_RANGE_MULTIPLIER);

    if (skillActive && activeSkill.id === 'tidal_wave') {
      const ids: string[] = [];
      let totalExp = 0;
      let totalGold = 0;
      let effectCount = 0;
      for (const npc of npcs) {
        if (!npc.alive || npc.tier > playerTier) continue;
        if (ids.length >= MAX_BATCH_EAT) break;
        const npcPos = getNPCPosition(npc.id);
        if (!npcPos) continue;
        const d = Math.sqrt(
          (playerPos.x - npcPos.x) ** 2 + (playerPos.y - npcPos.y) ** 2 + (playerPos.z - npcPos.z) ** 2
        );
        if (d < 12) {
          ids.push(npc.id);
          totalExp += Math.max(npc.tier, 1);
          const goldAmount = GOLD_PER_TIER[npc.tier] ?? 1;
          totalGold += Math.round(goldAmount * (1 + perkBonuses.goldBonus));
          if (effectCount < MAX_BATCH_EFFECTS) {
            triggerEatEffect(npcPos.x, npcPos.y, npcPos.z, getStageByTier(npc.tier).color);
            effectCount++;
          }
        }
      }
      if (ids.length > 0) {
        batchEatNPCs(ids, totalExp, totalGold);
        playEatSound(combo);
      }
      cooldownRef.current = 0.5;
      return;
    }

    if (isDashing && perkBonuses.dashAutoEat) {
      const dashEatRange = Math.min(playerStage.size * 3 * eatRangeMultiplier, 25);
      const ids: string[] = [];
      let totalExp = 0;
      let totalGold = 0;
      let effectCount = 0;
      const multiplier = getComboMultiplier();
      for (const npc of npcs) {
        if (!npc.alive || npc.tier > playerTier) continue;
        if (ids.length >= MAX_BATCH_EAT) break;
        const npcPos = getNPCPosition(npc.id);
        if (!npcPos) continue;
        const d = Math.sqrt(
          (playerPos.x - npcPos.x) ** 2 + (playerPos.y - npcPos.y) ** 2 + (playerPos.z - npcPos.z) ** 2
        );
        if (d < dashEatRange) {
          ids.push(npc.id);
          const baseExp = npc.tier < playerTier ? Math.max(npc.tier, 1) : 1;
          totalExp += Math.round(baseExp * multiplier * (1 + perkBonuses.expBonus));
          const goldAmount = GOLD_PER_TIER[npc.tier] ?? 1;
          let goldGain = Math.round(goldAmount * multiplier * (1 + perkBonuses.goldBonus));
          if (perkBonuses.goldDouble) goldGain *= 2;
          totalGold += goldGain;
          if (effectCount < MAX_BATCH_EFFECTS) {
            triggerEatEffect(npcPos.x, npcPos.y, npcPos.z, getStageByTier(npc.tier).color);
            effectCount++;
          }
        }
      }
      if (ids.length > 0) {
        batchEatNPCs(ids, totalExp, totalGold);
        playEatSound(combo);
      }
    }

    for (const npc of npcs) {
      if (!npc.alive) continue;

      const npcPos = getNPCPosition(npc.id);
      if (!npcPos) continue;

      const dx = playerPos.x - npcPos.x;
      const dy = playerPos.y - npcPos.y;
      const dz = playerPos.z - npcPos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      const npcStage = getStageByTier(npc.tier);
      const eatRange = (playerStage.size + npcStage.size) * 1.2 * eatRangeMultiplier;
      const dangerRange = (playerStage.size + npcStage.size) * 0.4;

      if (npc.tier <= playerTier && dist < eatRange) {
        incrementCombo();
        const multiplier = getComboMultiplier();
        const baseExp = npc.tier < playerTier ? Math.max(npc.tier, 1) : 1;
        const expGain = Math.round(baseExp * multiplier * (1 + perkBonuses.expBonus));
        addExp(expGain);

        const goldAmount = GOLD_PER_TIER[npc.tier] ?? 1;
        let goldGain = Math.round(goldAmount * multiplier * (1 + perkBonuses.goldBonus));
        if (perkBonuses.goldDouble) goldGain *= 2;
        addGold(goldGain);

        eatNPC(npc.id);
        triggerEatEffect(npcPos.x, npcPos.y, npcPos.z, npcStage.color);
        playEatSound(combo);
        cooldownRef.current = 0.08;
        break;
      } else if (npc.tier > playerTier && dist < dangerRange && !isInvincible) {
        if (useShellDefense()) {
          continue;
        }
        setGameOver();
        break;
      }
    }

    const magnetRange = perkBonuses.autoMagnetRange > 0 ? perkBonuses.autoMagnetRange : 0;
    const itemPickupRange = playerStage.size + 1.0 + magnetRange;
    for (const item of items) {
      const dx = playerPos.x - item.x;
      const dy = playerPos.y - item.y;
      const dz = playerPos.z - item.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < itemPickupRange) {
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
        if (useShellDefense()) return;
        setGameOver();
      }
    }
  });

  return null;
}
