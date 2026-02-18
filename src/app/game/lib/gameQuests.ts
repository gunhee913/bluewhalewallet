export type QuestType = 'eat_count' | 'eat_tier' | 'combo' | 'gold_earn' | 'evolve' | 'survive_time' | 'dash_count';

export interface QuestDef {
  id: string;
  name: string;
  description: string;
  type: QuestType;
  target: number;
  tierRequirement?: number;
  phase: 1 | 2 | 3;
  reward: QuestReward;
}

export interface QuestReward {
  gold?: number;
  exp?: number;
}

export interface QuestProgress {
  questId: string;
  current: number;
  completed: boolean;
  claimed: boolean;
}

export const QUEST_POOL: QuestDef[] = [
  // Phase 1: 초반 (Tier 1~2)
  { id: 'eat_5', name: '첫 사냥', description: '해양생물 5마리 포식', type: 'eat_count', target: 5, phase: 1, reward: { gold: 20 } },
  { id: 'eat_20', name: '숙련된 사냥꾼', description: '해양생물 20마리 포식', type: 'eat_count', target: 20, phase: 1, reward: { gold: 50, exp: 5 } },
  { id: 'combo_5', name: '콤보 초보', description: '5 콤보 달성', type: 'combo', target: 5, phase: 1, reward: { gold: 30 } },
  { id: 'gold_100', name: '동전 모으기', description: '골드 100 획득', type: 'gold_earn', target: 100, phase: 1, reward: { gold: 25 } },
  { id: 'survive_60', name: '생존자', description: '60초 생존', type: 'survive_time', target: 60, phase: 1, reward: { gold: 40 } },
  { id: 'dash_10', name: '돌진 연습', description: '부스터 10회 사용', type: 'dash_count', target: 10, phase: 1, reward: { gold: 30 } },
  { id: 'evolve_3', name: '성장의 시작', description: '3단계까지 진화', type: 'evolve', target: 3, phase: 1, reward: { gold: 60 } },

  // Phase 2: 중반 (Tier 3~5)
  { id: 'eat_50', name: '포식자', description: '해양생물 50마리 포식', type: 'eat_count', target: 50, phase: 2, reward: { gold: 120 } },
  { id: 'eat_t2', name: '조개 사냥꾼', description: '조개(Tier 2) 이상 10마리 포식', type: 'eat_tier', target: 10, tierRequirement: 2, phase: 2, reward: { gold: 40, exp: 3 } },
  { id: 'combo_10', name: '콤보 마스터', description: '10 콤보 달성', type: 'combo', target: 10, phase: 2, reward: { gold: 80, exp: 8 } },
  { id: 'gold_500', name: '부자 물고기', description: '골드 500 획득', type: 'gold_earn', target: 500, phase: 2, reward: { gold: 80 } },
  { id: 'survive_180', name: '끈질긴 생명', description: '180초 생존', type: 'survive_time', target: 180, phase: 2, reward: { gold: 100 } },
  { id: 'dash_30', name: '돌진 마니아', description: '부스터 30회 사용', type: 'dash_count', target: 30, phase: 2, reward: { gold: 80 } },
  { id: 'evolve_5', name: '강한 진화', description: '5단계까지 진화', type: 'evolve', target: 5, phase: 2, reward: { gold: 150, exp: 15 } },

  // Phase 3: 후반 (Tier 6+)
  { id: 'eat_100', name: '심해의 왕', description: '해양생물 100마리 포식', type: 'eat_count', target: 100, phase: 3, reward: { gold: 300 } },
  { id: 'eat_t4', name: '진주 수집가', description: '진주조개(Tier 4) 이상 5마리 포식', type: 'eat_tier', target: 5, tierRequirement: 4, phase: 3, reward: { gold: 80, exp: 10 } },
  { id: 'eat_t6', name: '돌고래 포식', description: '돌고래(Tier 6) 이상 3마리 포식', type: 'eat_tier', target: 3, tierRequirement: 6, phase: 3, reward: { gold: 200 } },
  { id: 'combo_20', name: '콤보의 신', description: '20 콤보 달성', type: 'combo', target: 20, phase: 3, reward: { gold: 200 } },
  { id: 'gold_2000', name: '해저 부호', description: '골드 2000 획득', type: 'gold_earn', target: 2000, phase: 3, reward: { gold: 250 } },
  { id: 'survive_300', name: '불사의 물고기', description: '300초 생존', type: 'survive_time', target: 300, phase: 3, reward: { gold: 250 } },
  { id: 'evolve_7', name: '최종 진화', description: '고래로 진화', type: 'evolve', target: 7, phase: 3, reward: { gold: 500 } },
];

function getPhaseForTier(tier: number): 1 | 2 | 3 {
  if (tier <= 2) return 1;
  if (tier <= 5) return 2;
  return 3;
}

export function pickQuests(count: number, completedIds: string[], playerTier: number = 1): QuestDef[] {
  const currentPhase = getPhaseForTier(playerTier);
  const available = QUEST_POOL.filter((q) => !completedIds.includes(q.id) && q.phase <= currentPhase);
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
