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
