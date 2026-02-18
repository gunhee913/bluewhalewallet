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
  color: string;
  onBuy: () => boolean;
}

function UpgradeRow({ icon, label, sublabel, level, maxLevel, cost, gold, multiplier, color, onBuy }: UpgradeRowProps) {
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
    <div className={`relative rounded-xl p-3 transition-all duration-200 ${
      isMaxed ? 'bg-white/5' : canAfford ? 'bg-white/10 hover:bg-white/15' : 'bg-white/5'
    } ${shake ? 'animate-[shake_0.3s_ease-in-out]' : ''}`}>
      <GoldFlash show={flash} />
      <div className="flex items-center gap-3">
        <div className="text-2xl w-9 text-center flex-shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-white text-sm font-semibold">{label}</span>
            <span className="text-white/50 text-[10px]">Lv.{level}/{maxLevel}</span>
          </div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-white/60 text-xs">{sublabel}</span>
            <span className="font-mono text-xs font-bold" style={{ color }}>
              x{multiplier.toFixed(1)}
            </span>
          </div>
          <ProgressBar current={level} max={maxLevel} color={color} />
        </div>
        <button
          onClick={handleClick}
          disabled={isMaxed}
          className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-bold transition-all duration-200 active:scale-90 ${
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
  const evolveCost = EVOLUTION_COST[playerTier] ?? null;
  const canEvolve = evolveCost !== null && gold >= evolveCost;
  const isMaxTier = playerTier >= 7;

  const speedCost = getNextUpgradeCost('speed');
  const rangeCost = getNextUpgradeCost('eatRange');
  const npcCost = getNextUpgradeCost('npcCount');

  return (
    <div className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center" onClick={toggleUpgradePanel}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="relative w-full sm:w-[380px] max-h-[85vh] bg-gradient-to-b from-[#0d3b5e] to-[#072a45] rounded-t-2xl sm:rounded-2xl shadow-2xl border border-white/10 flex flex-col animate-[slideUp_0.3s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-bold text-lg">업그레이드</h2>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-yellow-500/20 rounded-lg px-3 py-1.5">
                <span className="text-sm">🪙</span>
                <span className="text-yellow-300 font-bold text-sm">{gold}</span>
              </div>
              <button
                onClick={toggleUpgradePanel}
                className="text-white/40 hover:text-white/80 transition-colors text-lg"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-white/10">
          {/* Evolution */}
          <div className={`relative rounded-xl p-3 transition-all duration-200 ${
            isMaxTier ? 'bg-white/5' : canEvolve ? 'bg-white/10 hover:bg-white/15' : 'bg-white/5'
          }`}>
            <GoldFlash show={evolveFlash} />
            <div className="flex items-center gap-3">
              <div className="text-2xl w-9 text-center flex-shrink-0">
                <div className="w-7 h-7 rounded-full mx-auto" style={{ backgroundColor: currentStage.color, boxShadow: `0 0 12px ${currentStage.color}40` }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-white text-sm font-semibold">진화</span>
                  {!isMaxTier && nextStage && (
                    <span className="text-white/40 text-[10px]">
                      {currentStage.nameKo} → {nextStage.nameKo}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {CREATURE_STAGES.filter(s => s.tier > 0).map((s) => (
                    <div
                      key={s.tier}
                      className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${
                        s.tier <= playerTier ? 'scale-100' : 'scale-75 opacity-30'
                      }`}
                      style={{
                        backgroundColor: s.color,
                        boxShadow: s.tier <= playerTier ? `0 0 6px ${s.color}60` : 'none',
                      }}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={handleEvolve}
                disabled={isMaxTier}
                className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-bold transition-all duration-200 active:scale-90 ${
                  isMaxTier
                    ? 'bg-white/5 text-white/30 cursor-default'
                    : canEvolve
                      ? 'bg-gradient-to-b from-green-400 to-green-600 text-black hover:from-green-300 hover:to-green-500 shadow-lg shadow-green-500/20'
                      : 'bg-white/10 text-white/40 cursor-not-allowed'
                }`}
              >
                {isMaxTier ? 'MAX' : `🪙 ${evolveCost}`}
              </button>
            </div>
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
        </div>

        {/* Bottom hint */}
        <div className="px-4 py-2.5 border-t border-white/10">
          <p className="text-white/30 text-[10px] text-center">해양생물을 먹어 골드를 모으세요</p>
        </div>
      </div>
    </div>
  );
}
