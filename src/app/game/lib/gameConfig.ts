export const CREATURE_STAGES = [
  { id: 'plankton', name: 'PLANKTON', nameKo: '플랑크톤', tier: 0, size: 0.6, speed: 1.5, color: '#7fff7f', expToNext: 0 },
  { id: 'krill', name: 'KRILL', nameKo: '크릴', tier: 1, size: 0.3, speed: 4, color: '#ff6b6b', expToNext: 6 },
  { id: 'clam', name: 'CLAM', nameKo: '조개', tier: 2, size: 0.5, speed: 3.5, color: '#ffd93d', expToNext: 15 },
  { id: 'shell', name: 'SHELL', nameKo: '소라', tier: 3, size: 0.8, speed: 5, color: '#6bcb77', expToNext: 30 },
  { id: 'pearl', name: 'PEARL', nameKo: '진주조개', tier: 4, size: 1.2, speed: 5.5, color: '#e8daef', expToNext: 60 },
  { id: 'coral', name: 'CORAL', nameKo: '산호', tier: 5, size: 1.8, speed: 6, color: '#ff8fab', expToNext: 120 },
  { id: 'dolphin', name: 'DOLPHIN', nameKo: '돌고래', tier: 6, size: 2.5, speed: 8, color: '#74b9ff', expToNext: 250 },
  { id: 'whale', name: 'WHALE', nameKo: '고래', tier: 7, size: 3.0, speed: 6, color: '#2d3436', expToNext: Infinity },
] as const;

export type CreatureStage = (typeof CREATURE_STAGES)[number];

export const WORLD_SIZE = 120;
export const WORLD_DEPTH = 40;

export const CAMERA_OFFSET = { x: 0, y: 2.5, z: 5 };
export const CAMERA_LERP_SPEED = 0.08;

export const FOG_COLOR = '#0c4a7a';
export const FOG_NEAR = 10;
export const FOG_FAR = 60;

export const OCEAN_FLOOR_Y = -WORLD_DEPTH / 2;

export function getStageByTier(tier: number) {
  return CREATURE_STAGES.find((s) => s.tier === tier) ?? CREATURE_STAGES[1];
}

export const GOLD_PER_TIER: Record<number, number> = {
  0: 1, 1: 2, 2: 4, 3: 6, 4: 8, 5: 10, 6: 13, 7: 15,
};

export const EVOLUTION_COST: Record<number, number> = {
  1: 25,    // KRILL -> CLAM
  2: 70,    // CLAM -> SHELL
  3: 160,   // SHELL -> PEARL
  4: 350,   // PEARL -> CORAL
  5: 750,   // CORAL -> DOLPHIN
  6: 1500,  // DOLPHIN -> WHALE
};

export const MAX_UPGRADE_LEVEL = 10;

function generateUpgrades(baseMultiplier: number, step: number, costs: number[]) {
  return costs.map((cost, i) => ({
    level: i + 1,
    multiplier: +(baseMultiplier + step * i).toFixed(2),
    cost,
  }));
}

export const SPEED_UPGRADES = generateUpgrades(1.0, 0.1, [
  0, 10, 25, 50, 90, 150, 250, 400, 600, 900,
]);

export const EAT_RANGE_UPGRADES = generateUpgrades(1.0, 0.06, [
  0, 10, 25, 50, 90, 150, 250, 400, 600, 900,
]);

export const NPC_COUNT_UPGRADES = generateUpgrades(1.0, 0.1, [
  0, 15, 35, 70, 120, 200, 320, 500, 700, 1000,
]);

export const DASH_COOLDOWN_BASE = 5000;
export const MAX_DASH_LEVEL = 11;

export const DASH_UPGRADES = [
  { level: 1, cooldownMs: 5000, cost: 0 },
  { level: 2, cooldownMs: 4600, cost: 15 },
  { level: 3, cooldownMs: 4200, cost: 35 },
  { level: 4, cooldownMs: 3800, cost: 70 },
  { level: 5, cooldownMs: 3400, cost: 120 },
  { level: 6, cooldownMs: 3000, cost: 200 },
  { level: 7, cooldownMs: 2600, cost: 320 },
  { level: 8, cooldownMs: 2200, cost: 500 },
  { level: 9, cooldownMs: 1800, cost: 700 },
  { level: 10, cooldownMs: 1400, cost: 1000 },
  { level: 11, cooldownMs: 1000, cost: 1300 },
];

export interface EvoAbility {
  tier: number;
  name: string;
  icon: string;
  description: string;
}

export const EVOLUTION_ABILITIES: EvoAbility[] = [
  { tier: 1, name: '없음', icon: '', description: '' },
  { tier: 2, name: '방어 껍질', icon: '🛡️', description: '첫 피격 1회 방어' },
  { tier: 3, name: '나선 가속', icon: '🌀', description: '연속 이동 시 속도 +20%' },
  { tier: 4, name: '빛의 유혹', icon: '✨', description: '하위 NPC를 범위 5 내 유인' },
  { tier: 5, name: '독성 포자', icon: '☠️', description: '근접 적 NPC 속도 -40%' },
  { tier: 6, name: '음파 탐지', icon: '📡', description: '포식 가능 NPC 범위 +50%' },
  { tier: 7, name: '폭풍 흡입', icon: '🌊', description: '포식 범위 2배, 자동 흡입' },
];

export function getEvoAbility(tier: number): EvoAbility | null {
  return EVOLUTION_ABILITIES.find((a) => a.tier === tier) ?? null;
}

export const MAX_LEVEL = 50;

export function getLevelExpRequired(level: number): number {
  if (level >= MAX_LEVEL) return Infinity;
  return Math.floor(5 + level * 2.5 + (level ** 1.4) * 0.8);
}

export interface LevelReward {
  gold: number;
  message: string;
}

export function getLevelReward(level: number): LevelReward {
  const baseGold = 5 + Math.floor(level * 1.5);
  const bonusGold = level % 5 === 0 ? level * 3 : 0;
  const gold = baseGold + bonusGold;
  const message = level % 5 === 0 ? `LV ${level} 달성! 보너스 골드 +${gold}` : `LV ${level} 달성! 골드 +${gold}`;
  return { gold, message };
}
