export type PerkRarity = 'common' | 'rare' | 'legendary';

export interface PerkDef {
  id: string;
  name: string;
  description: string;
  rarity: PerkRarity;
  icon: string;
  effect: PerkEffect;
}

export type PerkEffect =
  | { type: 'speed_bonus'; value: number }
  | { type: 'eat_range_bonus'; value: number }
  | { type: 'gold_bonus'; value: number }
  | { type: 'exp_bonus'; value: number }
  | { type: 'dash_cooldown_reduction'; value: number }
  | { type: 'item_duration_bonus'; value: number }
  | { type: 'combo_time_bonus'; value: number }
  | { type: 'auto_magnet_range'; value: number }
  | { type: 'boss_delay'; value: number }
  | { type: 'dash_auto_eat'; value: boolean }
  | { type: 'permanent_shield_interval'; value: number }
  | { type: 'free_next_evolve'; value: boolean }
  | { type: 'gold_double'; value: boolean };

export const PERK_POOL: PerkDef[] = [
  { id: 'speed_8', name: '빠른 지느러미', description: '이동속도 +8%', rarity: 'common', icon: '🏃', effect: { type: 'speed_bonus', value: 0.08 } },
  { id: 'eat_10', name: '큰 입', description: '포식범위 +10%', rarity: 'common', icon: '👄', effect: { type: 'eat_range_bonus', value: 0.1 } },
  { id: 'gold_15', name: '황금 비늘', description: '골드 획득 +15%', rarity: 'common', icon: '💰', effect: { type: 'gold_bonus', value: 0.15 } },
  { id: 'exp_10', name: '빠른 학습', description: 'EXP 획득 +10%', rarity: 'common', icon: '📚', effect: { type: 'exp_bonus', value: 0.1 } },
  { id: 'dash_cd_05', name: '가벼운 몸', description: '부스터 쿨다운 -0.5초', rarity: 'common', icon: '💨', effect: { type: 'dash_cooldown_reduction', value: 500 } },
  { id: 'speed_12', name: '해류 타기', description: '이동속도 +12%', rarity: 'common', icon: '🌊', effect: { type: 'speed_bonus', value: 0.12 } },
  { id: 'gold_10', name: '보물 사냥꾼', description: '골드 획득 +10%', rarity: 'common', icon: '🪙', effect: { type: 'gold_bonus', value: 0.1 } },
  { id: 'exp_15', name: '경험의 파도', description: 'EXP 획득 +15%', rarity: 'common', icon: '⭐', effect: { type: 'exp_bonus', value: 0.15 } },

  { id: 'item_dur_50', name: '아이템 마스터', description: '아이템 효과 +50%', rarity: 'rare', icon: '🔮', effect: { type: 'item_duration_bonus', value: 0.5 } },
  { id: 'combo_1s', name: '콤보 달인', description: '콤보 유지시간 +1초', rarity: 'rare', icon: '🔥', effect: { type: 'combo_time_bonus', value: 1000 } },
  { id: 'magnet_3', name: '자기장', description: '자동 자석 범위 3', rarity: 'rare', icon: '🧲', effect: { type: 'auto_magnet_range', value: 3 } },
  { id: 'boss_delay', name: '보스 지연', description: '보스 출현 +30초', rarity: 'rare', icon: '🛡️', effect: { type: 'boss_delay', value: 30000 } },
  { id: 'eat_20', name: '심해의 턱', description: '포식범위 +20%', rarity: 'rare', icon: '🦷', effect: { type: 'eat_range_bonus', value: 0.2 } },
  { id: 'dash_cd_1', name: '순간가속', description: '부스터 쿨다운 -1초', rarity: 'rare', icon: '⚡', effect: { type: 'dash_cooldown_reduction', value: 1000 } },

  { id: 'dash_eat', name: '돌진 포식', description: '대시 중 자동 포식', rarity: 'legendary', icon: '🌀', effect: { type: 'dash_auto_eat', value: true } },
  { id: 'perm_shield', name: '영구 보호막', description: '30초마다 쉴드 자동 생성', rarity: 'legendary', icon: '🛡️', effect: { type: 'permanent_shield_interval', value: 30000 } },
  { id: 'free_evolve', name: '이중 진화', description: '다음 진화 비용 무료', rarity: 'legendary', icon: '🧬', effect: { type: 'free_next_evolve', value: true } },
  { id: 'gold_2x', name: '미다스의 손', description: '골드 2배 드랍 (영구)', rarity: 'legendary', icon: '👑', effect: { type: 'gold_double', value: true } },
];

const RARITY_WEIGHTS: Record<PerkRarity, number> = {
  common: 60,
  rare: 30,
  legendary: 10,
};

export function rollPerkChoices(owned: string[], count = 3): PerkDef[] {
  const available = PERK_POOL.filter((p) => !owned.includes(p.id));
  if (available.length === 0) return [];

  const totalWeight = available.reduce((sum, p) => sum + RARITY_WEIGHTS[p.rarity], 0);
  const choices: PerkDef[] = [];

  while (choices.length < count && choices.length < available.length) {
    let roll = Math.random() * totalWeight;
    for (const perk of available) {
      roll -= RARITY_WEIGHTS[perk.rarity];
      if (roll <= 0 && !choices.find((c) => c.id === perk.id)) {
        choices.push(perk);
        break;
      }
    }
  }

  return choices;
}

export const RARITY_COLORS: Record<PerkRarity, string> = {
  common: '#94a3b8',
  rare: '#60a5fa',
  legendary: '#fbbf24',
};

export const RARITY_LABELS: Record<PerkRarity, string> = {
  common: '일반',
  rare: '희귀',
  legendary: '전설',
};
