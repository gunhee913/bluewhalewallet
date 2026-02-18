export interface SkillDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  cost: number;
  cooldownMs: number;
  durationMs: number;
  minTier: number;
}

export const SKILLS: SkillDef[] = [
  {
    id: 'sonar_blast',
    name: '음파 폭발',
    icon: '📡',
    description: '주변 NPC를 기절시킴 (3초)',
    cost: 80,
    cooldownMs: 25000,
    durationMs: 3000,
    minTier: 2,
  },
  {
    id: 'ink_cloud',
    name: '먹물 구름',
    icon: '🌫️',
    description: '적 NPC 시야 차단 (5초)',
    cost: 150,
    cooldownMs: 30000,
    durationMs: 5000,
    minTier: 3,
  },
  {
    id: 'feeding_frenzy',
    name: '포식 광란',
    icon: '🔥',
    description: '포식 범위 2배 + 속도 +50% (4초)',
    cost: 300,
    cooldownMs: 35000,
    durationMs: 4000,
    minTier: 4,
  },
  {
    id: 'tidal_wave',
    name: '해일',
    icon: '🌊',
    description: '범위 내 하위 NPC 즉시 포식',
    cost: 500,
    cooldownMs: 45000,
    durationMs: 500,
    minTier: 5,
  },
];

export function getSkillById(id: string): SkillDef | undefined {
  return SKILLS.find((s) => s.id === id);
}

export function getAvailableSkills(tier: number, ownedSkillIds: string[]): SkillDef[] {
  return SKILLS.filter((s) => s.minTier <= tier && !ownedSkillIds.includes(s.id));
}
