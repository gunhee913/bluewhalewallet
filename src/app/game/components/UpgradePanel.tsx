'use client';

import { useState, useEffect, useCallback } from 'react';
import { useGameStore, type Upgrades } from '../lib/useGameStore';
import {
  getStageByTier,
  EVOLUTION_COST,
  SPEED_UPGRADES,
  EAT_RANGE_UPGRADES,
  NPC_COUNT_UPGRADES,
  MAX_UPGRADE_LEVEL,
  MAX_DASH_LEVEL,
  CREATURE_STAGES,
} from '../lib/gameConfig';

function GoldFlash({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="absolute inset-0 rounded-xl pointer-events-none animate-ping bg-yellow-400/20" />
  );
}

function ProgressBar({ current, max, color }: { current: number; max: number; color: string }) {
  const pct = Math.min((current / max) * 100, 100);
  return (
    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500 ease-out"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

interface UpgradeRowProps {
  icon: string;
  label: string;
  sublabel: string;
  level: number;
  maxLevel: number;
  cost: number | null;
  gold: number;
  multiplier: number;
  multiplierLabel?: string;
  color: string;
  onBuy: () => boolean;
}

function UpgradeRow({ icon, label, sublabel, level, maxLevel, cost, gold, multiplier, multiplierLabel, color, onBuy }: UpgradeRowProps) {
  const [flash, setFlash] = useState(false);
  const [shake, setShake] = useState(false);
  const isMaxed = level >= maxLevel;
  const canAfford = cost !== null && gold >= cost;

  const handleClick = () => {
    if (isMaxed || !canAfford) {
      setShake(true);
      setTimeout(() => setShake(false), 300);
      return;
    }
    const success = onBuy();
    if (success) {
      setFlash(true);
      setTimeout(() => setFlash(false), 600);
    }
  };

  return (
    <div className={`relative rounded-xl p-3.5 transition-all duration-200 border ${
      isMaxed ? 'bg-white/[0.03] border-white/5' : canAfford ? 'bg-white/[0.08] hover:bg-white/[0.12] border-white/10' : 'bg-white/[0.03] border-white/5'
    } ${shake ? 'animate-[shake_0.3s_ease-in-out]' : ''}`}>
      <GoldFlash show={flash} />
      <div className="flex items-center gap-3.5">
        <div className="text-2xl w-10 h-10 flex items-center justify-center rounded-lg bg-white/5 flex-shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-white text-sm font-semibold">{label}</span>
            <span className="text-white/50 text-[10px]">Lv.{level}/{maxLevel}</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/50 text-xs">{sublabel}</span>
            <span className="font-mono text-xs font-bold" style={{ color }}>
              {multiplierLabel ?? `x${multiplier.toFixed(1)}`}
            </span>
          </div>
          <ProgressBar current={level} max={maxLevel} color={color} />
        </div>
        <button
          onClick={handleClick}
          disabled={isMaxed}
          className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 active:scale-90 ${
            isMaxed
              ? 'bg-white/5 text-white/30 cursor-default'
              : canAfford
                ? 'bg-gradient-to-b from-yellow-400 to-yellow-600 text-black hover:from-yellow-300 hover:to-yellow-500 shadow-lg shadow-yellow-500/20'
                : 'bg-white/10 text-white/40 cursor-not-allowed'
          }`}
        >
          {isMaxed ? 'MAX' : `🪙 ${cost}`}
        </button>
      </div>
    </div>
  );
}

export default function UpgradePanel() {
  const showUpgradePanel = useGameStore((s) => s.showUpgradePanel);
  const toggleUpgradePanel = useGameStore((s) => s.toggleUpgradePanel);
  const gold = useGameStore((s) => s.gold);
  const playerTier = useGameStore((s) => s.playerTier);
  const upgrades = useGameStore((s) => s.upgrades);
  const evolve = useGameStore((s) => s.evolve);
  const buyUpgrade = useGameStore((s) => s.buyUpgrade);
  const getUpgradeMultiplier = useGameStore((s) => s.getUpgradeMultiplier);
  const getNextUpgradeCost = useGameStore((s) => s.getNextUpgradeCost);

  const perkBonuses = useGameStore((s) => s.perkBonuses);
  const [evolveFlash, setEvolveFlash] = useState(false);

  const handleEvolve = () => {
    const success = evolve();
    if (success) {
      setEvolveFlash(true);
      setTimeout(() => setEvolveFlash(false), 600);
    }
    return success;
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && showUpgradePanel) {
      toggleUpgradePanel();
    }
  }, [showUpgradePanel, toggleUpgradePanel]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!showUpgradePanel) return null;

  const currentStage = getStageByTier(playerTier);
  const nextStage = playerTier < 7 ? getStageByTier(playerTier + 1) : null;
  const rawEvolveCost = EVOLUTION_COST[playerTier] ?? null;
  const isFreeEvolve = perkBonuses.freeNextEvolve;
  const evolveCost = isFreeEvolve ? 0 : rawEvolveCost;
  const canEvolve = evolveCost !== null && gold >= evolveCost;
  const isMaxTier = playerTier >= 7;

  const speedCost = getNextUpgradeCost('speed');
  const rangeCost = getNextUpgradeCost('eatRange');
  const npcCost = getNextUpgradeCost('npcCount');
  const dashCost = getNextUpgradeCost('dashCooldown');
  const dashCooldownMs = getUpgradeMultiplier('dashCooldown');

  return (
    <div className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center" onClick={toggleUpgradePanel}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

      <div
        className="relative w-full sm:w-[520px] max-h-[90vh] bg-gradient-to-b from-[#0c3a5c] via-[#082d4a] to-[#051c30] rounded-t-3xl sm:rounded-3xl shadow-[0_0_40px_rgba(0,180,255,0.15)] border border-cyan-400/20 flex flex-col animate-[slideUp_0.3s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-cyan-500/15 bg-gradient-to-r from-cyan-800/20 via-blue-800/20 to-indigo-800/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <span className="text-xl">🏪</span>
              </div>
              <div>
                <h2 className="text-white font-bold text-xl leading-tight">상점</h2>
                <p className="text-cyan-300/50 text-[10px]">능력을 강화하세요</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-500/20 to-amber-500/10 rounded-xl px-4 py-2 border border-yellow-500/25">
                <span className="text-lg">🪙</span>
                <span className="text-yellow-300 font-bold text-base">{gold}</span>
              </div>
              <button
                onClick={toggleUpgradePanel}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 text-white/40 hover:text-white transition-all text-lg"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-white/10">
          {/* Evolution */}
          <div className={`relative rounded-xl p-4 transition-all duration-200 border ${
            isMaxTier ? 'bg-white/[0.03] border-white/5' : canEvolve ? 'bg-gradient-to-r from-green-500/10 to-emerald-500/5 border-green-500/20 hover:border-green-400/30' : 'bg-white/[0.03] border-white/5'
          }`}>
            <GoldFlash show={evolveFlash} />
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                <div className="w-7 h-7 rounded-full" style={{ backgroundColor: currentStage.color, boxShadow: `0 0 12px ${currentStage.color}50` }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white text-sm font-bold">진화</span>
                  {!isMaxTier && nextStage && (
                    <span className="text-white/40 text-[10px]">
                      {currentStage.nameKo} → {nextStage.nameKo}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {CREATURE_STAGES.filter(s => s.tier > 0).map((s) => (
                    <div
                      key={s.tier}
                      className={`w-4 h-4 rounded-full transition-all duration-300 ${
                        s.tier <= playerTier ? 'scale-100' : 'scale-75 opacity-30'
                      }`}
                      style={{
                        backgroundColor: s.color,
                        boxShadow: s.tier <= playerTier ? `0 0 8px ${s.color}60` : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={handleEvolve}
                disabled={isMaxTier}
                className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 active:scale-90 ${
                  isMaxTier
                    ? 'bg-white/5 text-white/30 cursor-default'
                    : canEvolve
                      ? 'bg-gradient-to-b from-green-400 to-green-600 text-black hover:from-green-300 hover:to-green-500 shadow-lg shadow-green-500/20'
                      : 'bg-white/10 text-white/40 cursor-not-allowed'
                }`}
              >
                {isMaxTier ? 'MAX' : isFreeEvolve ? '🧬 무료!' : `🪙 ${evolveCost}`}
              </button>
            </div>
          </div>

          {/* Upgrades section */}
          <div className="pt-1 pb-0.5 flex items-center gap-2">
            <span className="text-amber-400/80 text-xs">✦</span>
            <span className="text-amber-300/60 text-xs font-semibold uppercase tracking-wider">능력 강화</span>
          </div>

          {/* Speed */}
          <UpgradeRow
            icon="⚡"
            label="속도"
            sublabel="이동 속도 증가"
            level={upgrades.speed}
            maxLevel={MAX_UPGRADE_LEVEL}
            cost={speedCost}
            gold={gold}
            multiplier={getUpgradeMultiplier('speed')}
            color="#fbbf24"
            onBuy={() => buyUpgrade('speed')}
          />

          {/* Eat Range */}
          <UpgradeRow
            icon="🎯"
            label="포식 범위"
            sublabel="먹기 반경 증가"
            level={upgrades.eatRange}
            maxLevel={MAX_UPGRADE_LEVEL}
            cost={rangeCost}
            gold={gold}
            multiplier={getUpgradeMultiplier('eatRange')}
            color="#34d399"
            onBuy={() => buyUpgrade('eatRange')}
          />

          {/* NPC Count */}
          <UpgradeRow
            icon="🐟"
            label="개체 수"
            sublabel="NPC 수 증가"
            level={upgrades.npcCount}
            maxLevel={MAX_UPGRADE_LEVEL}
            cost={npcCost}
            gold={gold}
            multiplier={getUpgradeMultiplier('npcCount')}
            color="#60a5fa"
            onBuy={() => buyUpgrade('npcCount')}
          />

          {/* Dash Cooldown */}
          <UpgradeRow
            icon="💨"
            label="부스터"
            sublabel="돌진 쿨다운 감소"
            level={upgrades.dashCooldown}
            maxLevel={MAX_DASH_LEVEL}
            cost={dashCost}
            gold={gold}
            multiplier={dashCooldownMs / 1000}
            multiplierLabel={`${(dashCooldownMs / 1000).toFixed(1)}초`}
            color="#c084fc"
            onBuy={() => buyUpgrade('dashCooldown')}
          />

        </div>

        {/* Bottom hint */}
        <div className="px-4 py-2.5 border-t border-white/5 bg-black/20">
          <p className="text-white/25 text-[10px] text-center">ESC로 닫기 · 해양생물을 먹어 골드를 모으세요</p>
        </div>
      </div>
    </div>
  );
}
