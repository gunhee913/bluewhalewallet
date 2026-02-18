import { create } from 'zustand';
import {
  CREATURE_STAGES,
  getStageByTier,
  WORLD_SIZE,
  WORLD_DEPTH,
  OCEAN_FLOOR_Y,
  GOLD_PER_TIER,
  EVOLUTION_COST,
  SPEED_UPGRADES,
  EAT_RANGE_UPGRADES,
  NPC_COUNT_UPGRADES,
  MAX_UPGRADE_LEVEL,
  DASH_UPGRADES,
  MAX_DASH_LEVEL,
} from './gameConfig';
import { PerkDef, PERK_POOL, rollPerkChoices, PerkEffect } from './gamePerks';
import { SkillDef, SKILLS, getSkillById } from './gameSkills';
import { QuestProgress, pickQuests, QUEST_POOL } from './gameQuests';

export interface PerkBonuses {
  speedBonus: number;
  eatRangeBonus: number;
  goldBonus: number;
  expBonus: number;
  dashCooldownReduction: number;
  itemDurationBonus: number;
  comboTimeBonus: number;
  autoMagnetRange: number;
  bossDelay: number;
  dashAutoEat: boolean;
  permanentShieldInterval: number;
  freeNextEvolve: boolean;
  goldDouble: boolean;
}

function buildPerkBonuses(perkEffects: PerkEffect[]): PerkBonuses {
  const b: PerkBonuses = {
    speedBonus: 0, eatRangeBonus: 0, goldBonus: 0, expBonus: 0,
    dashCooldownReduction: 0, itemDurationBonus: 0, comboTimeBonus: 0,
    autoMagnetRange: 0, bossDelay: 0, dashAutoEat: false,
    permanentShieldInterval: 0, freeNextEvolve: false, goldDouble: false,
  };
  for (const e of perkEffects) {
    switch (e.type) {
      case 'speed_bonus': b.speedBonus += e.value; break;
      case 'eat_range_bonus': b.eatRangeBonus += e.value; break;
      case 'gold_bonus': b.goldBonus += e.value; break;
      case 'exp_bonus': b.expBonus += e.value; break;
      case 'dash_cooldown_reduction': b.dashCooldownReduction += e.value; break;
      case 'item_duration_bonus': b.itemDurationBonus += e.value; break;
      case 'combo_time_bonus': b.comboTimeBonus += e.value; break;
      case 'auto_magnet_range': b.autoMagnetRange = Math.max(b.autoMagnetRange, e.value); break;
      case 'boss_delay': b.bossDelay += e.value; break;
      case 'dash_auto_eat': b.dashAutoEat = true; break;
      case 'permanent_shield_interval': b.permanentShieldInterval = e.value; break;
      case 'free_next_evolve': b.freeNextEvolve = true; break;
      case 'gold_double': b.goldDouble = true; break;
    }
  }
  return b;
}

export interface NPC {
  id: string;
  tier: number;
  variant: number;
  x: number;
  y: number;
  z: number;
  dirX: number;
  dirY: number;
  dirZ: number;
  alive: boolean;
}

export interface GameItem {
  id: string;
  type: 'speed' | 'magnet' | 'shield' | 'exp2x';
  x: number;
  y: number;
  z: number;
}

export interface ActiveEffect {
  type: 'speed' | 'magnet' | 'shield' | 'exp2x';
  endTime: number;
}

export interface GameEvent {
  type: 'frenzy' | 'current' | 'darkness';
  endTime: number;
  data?: { dirX: number; dirZ: number };
}

export interface BossState {
  x: number;
  y: number;
  z: number;
  alive: boolean;
  spawnTime: number;
}

function spawnNPC(tier: number): NPC {
  const half = WORLD_SIZE / 2 - 5;
  return {
    id: `${tier}-${Math.random().toString(36).slice(2, 8)}`,
    tier,
    variant: Math.random() < 0.3 ? 1 : 0,
    x: (Math.random() - 0.5) * half * 2,
    y: OCEAN_FLOOR_Y + 1 + Math.random() * (WORLD_DEPTH - 3),
    z: (Math.random() - 0.5) * half * 2,
    dirX: (Math.random() - 0.5) * 2,
    dirY: (Math.random() - 0.5) * 0.5,
    dirZ: (Math.random() - 0.5) * 2,
    alive: true,
  };
}

function generateInitialNPCs(npcMultiplier = 1.0): NPC[] {
  const npcs: NPC[] = [];
  const baseCounts: Record<number, number> = { 0: 150, 1: 80, 2: 50, 3: 40, 4: 30, 5: 20, 6: 12, 7: 8 };
  for (let tier = 0; tier <= 7; tier++) {
    const count = Math.round(baseCounts[tier] * npcMultiplier);
    for (let i = 0; i < count; i++) {
      npcs.push(spawnNPC(tier));
    }
  }
  return npcs;
}

function spawnItem(): GameItem {
  const types: GameItem['type'][] = ['speed', 'magnet', 'shield', 'exp2x'];
  const half = WORLD_SIZE / 2 - 10;
  return {
    id: `item-${Math.random().toString(36).slice(2, 8)}`,
    type: types[Math.floor(Math.random() * types.length)],
    x: (Math.random() - 0.5) * half * 2,
    y: OCEAN_FLOOR_Y + 2 + Math.random() * (WORLD_DEPTH - 6),
    z: (Math.random() - 0.5) * half * 2,
  };
}

function generateInitialItems(): GameItem[] {
  const items: GameItem[] = [];
  for (let i = 0; i < 8; i++) items.push(spawnItem());
  return items;
}

export interface Upgrades {
  speed: number;
  eatRange: number;
  npcCount: number;
  dashCooldown: number;
}

interface GameState {
  nickname: string;
  gold: number;
  totalGoldEarned: number;
  upgrades: Upgrades;
  showUpgradePanel: boolean;

  playerTier: number;
  exp: number;
  isGameOver: boolean;
  isCleared: boolean;
  isStarted: boolean;
  isPaused: boolean;
  npcs: NPC[];
  score: number;
  killCount: number;
  startTime: number;

  isDashing: boolean;
  dashCooldownEnd: number;

  combo: number;
  lastEatTime: number;

  items: GameItem[];
  activeEffects: ActiveEffect[];

  activeEvent: GameEvent | null;
  nextEventTime: number;

  boss: BossState | null;
  nextBossTime: number;

  moveInput: { x: number; y: number };
  cameraRotation: { x: number; y: number };

  ownedPerks: string[];
  perkChoices: PerkDef[] | null;
  showPerkSelection: boolean;
  perkBonuses: PerkBonuses;

  shellDefenseAvailable: boolean;

  ownedSkills: string[];
  activeSkill: { id: string; endTime: number } | null;
  skillCooldowns: Record<string, number>;

  quests: QuestProgress[];
  completedQuestIds: string[];
  dashCount: number;
  questRewardPopup: { gold: number; exp: number } | null;

  setNickname: (name: string) => void;
  addGold: (amount: number) => void;
  evolve: () => boolean;
  buyUpgrade: (type: keyof Upgrades) => boolean;
  toggleUpgradePanel: () => void;
  getUpgradeMultiplier: (type: keyof Upgrades) => number;
  getNextUpgradeCost: (type: keyof Upgrades) => number | null;

  addExp: (amount: number) => void;
  setGameOver: () => void;
  setClear: () => void;
  startGame: () => void;
  resetGame: () => void;
  togglePause: () => void;
  setMoveInput: (x: number, y: number) => void;
  setCameraRotation: (x: number, y: number) => void;
  eatNPC: (npcId: string) => void;
  respawnNPC: (tier: number) => void;

  startDash: () => void;
  endDash: () => void;
  getDashCooldownMs: () => number;

  incrementCombo: () => void;
  resetCombo: () => void;
  getComboMultiplier: () => number;

  collectItem: (itemId: string) => void;
  respawnItem: () => void;
  hasEffect: (type: ActiveEffect['type']) => boolean;
  cleanExpiredEffects: () => void;

  setEvent: (event: GameEvent | null) => void;
  setNextEventTime: (t: number) => void;

  setBoss: (boss: BossState | null) => void;
  setNextBossTime: (t: number) => void;

  spawnFrenzyNPCs: (px: number, py: number, pz: number) => void;

  selectPerk: (perkId: string) => void;
  skipPerks: () => void;
  getPerkBonuses: () => PerkBonuses;
  useShellDefense: () => boolean;

  buySkill: (skillId: string) => boolean;
  activateSkill: (skillId: string) => boolean;
  isSkillActive: (skillId: string) => boolean;
  isSkillOnCooldown: (skillId: string) => boolean;

  updateQuestProgress: (type: string, value: number, tierTarget?: number) => void;
  claimQuestReward: (questId: string) => void;
  dismissRewardPopup: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  nickname: typeof window !== 'undefined' ? localStorage.getItem('blueGameNickname') || '' : '',
  gold: 0,
  totalGoldEarned: 0,
  upgrades: { speed: 1, eatRange: 1, npcCount: 1, dashCooldown: 1 },
  showUpgradePanel: false,

  playerTier: 1,
  exp: 0,
  isGameOver: false,
  isCleared: false,
  isStarted: false,
  isPaused: false,
  npcs: [],
  score: 0,
  killCount: 0,
  startTime: 0,

  isDashing: false,
  dashCooldownEnd: 0,

  combo: 0,
  lastEatTime: 0,

  items: [],
  activeEffects: [],

  activeEvent: null,
  nextEventTime: 0,

  boss: null,
  nextBossTime: 0,

  moveInput: { x: 0, y: 0 },
  cameraRotation: { x: 0, y: 0 },

  ownedPerks: [],
  perkChoices: null,
  showPerkSelection: false,
  perkBonuses: buildPerkBonuses([]),
  shellDefenseAvailable: false,

  ownedSkills: [],
  activeSkill: null,
  skillCooldowns: {},

  quests: [],
  completedQuestIds: [],
  dashCount: 0,
  questRewardPopup: null,

  setNickname: (name: string) => {
    if (typeof window !== 'undefined') localStorage.setItem('blueGameNickname', name);
    set({ nickname: name });
  },

  addGold: (amount: number) => {
    const { totalGoldEarned } = get();
    set((s) => ({ gold: s.gold + amount, totalGoldEarned: s.totalGoldEarned + amount }));
    get().updateQuestProgress('gold_earn', totalGoldEarned + amount);
  },

  evolve: () => {
    const { playerTier, gold, perkBonuses, ownedPerks } = get();
    if (playerTier >= 7) return false;
    const cost = EVOLUTION_COST[playerTier];
    if (!cost) return false;
    const finalCost = perkBonuses.freeNextEvolve ? 0 : cost;
    if (gold < finalCost) return false;
    const choices = rollPerkChoices(ownedPerks, 3);
    const usedFree = perkBonuses.freeNextEvolve;
    const nextTier = playerTier + 1;
    set({
      playerTier: nextTier,
      gold: gold - finalCost,
      exp: 0,
      perkChoices: choices.length > 0 ? choices : null,
      showPerkSelection: choices.length > 0,
      isPaused: choices.length > 0,
      shellDefenseAvailable: nextTier >= 2 ? true : false,
    });
    if (usedFree) {
      const updated = get().ownedPerks.filter((id) => id !== 'free_evolve');
      const effects = PERK_POOL.filter((p) => updated.includes(p.id)).map((p) => p.effect);
      set({ ownedPerks: updated, perkBonuses: buildPerkBonuses(effects) });
    }
    get().updateQuestProgress('evolve', nextTier);
    return true;
  },

  buyUpgrade: (type: keyof Upgrades) => {
    const { upgrades, gold, npcs } = get();
    const currentLevel = upgrades[type];
    const maxLevel = type === 'dashCooldown' ? MAX_DASH_LEVEL : MAX_UPGRADE_LEVEL;
    if (currentLevel >= maxLevel) return false;
    const table = type === 'speed' ? SPEED_UPGRADES : type === 'eatRange' ? EAT_RANGE_UPGRADES : type === 'dashCooldown' ? DASH_UPGRADES : NPC_COUNT_UPGRADES;
    const next = table[currentLevel];
    if (!next || gold < next.cost) return false;

    const newUpgrades = { ...upgrades, [type]: currentLevel + 1 };
    set({ gold: gold - next.cost, upgrades: newUpgrades });

    if (type === 'npcCount') {
      const oldMul = NPC_COUNT_UPGRADES[currentLevel - 1]?.multiplier ?? 1.0;
      const newMul = NPC_COUNT_UPGRADES[currentLevel]?.multiplier ?? 1.0;
      const baseCounts: Record<number, number> = { 0: 150, 1: 80, 2: 50, 3: 40, 4: 30, 5: 20, 6: 12, 7: 8 };
      const extraNpcs: NPC[] = [];
      for (let tier = 0; tier <= 7; tier++) {
        const oldCount = Math.round(baseCounts[tier] * oldMul);
        const newCount = Math.round(baseCounts[tier] * newMul);
        const diff = newCount - oldCount;
        for (let i = 0; i < diff; i++) {
          extraNpcs.push(spawnNPC(tier));
        }
      }
      if (extraNpcs.length > 0) {
        set((s) => ({ npcs: [...s.npcs, ...extraNpcs] }));
      }
    }
    return true;
  },

  toggleUpgradePanel: () => {
    const { showUpgradePanel, isPaused } = get();
    if (!showUpgradePanel) {
      set({ showUpgradePanel: true, isPaused: true });
    } else {
      set({ showUpgradePanel: false, isPaused: false });
    }
  },

  getUpgradeMultiplier: (type: keyof Upgrades) => {
    const level = get().upgrades[type];
    if (type === 'dashCooldown') {
      return DASH_UPGRADES[level - 1]?.cooldownMs ?? 5000;
    }
    const table = type === 'speed' ? SPEED_UPGRADES : type === 'eatRange' ? EAT_RANGE_UPGRADES : NPC_COUNT_UPGRADES;
    return table[level - 1]?.multiplier ?? 1.0;
  },

  getNextUpgradeCost: (type: keyof Upgrades) => {
    const level = get().upgrades[type];
    const maxLevel = type === 'dashCooldown' ? MAX_DASH_LEVEL : MAX_UPGRADE_LEVEL;
    if (level >= maxLevel) return null;
    const table = type === 'speed' ? SPEED_UPGRADES : type === 'eatRange' ? EAT_RANGE_UPGRADES : type === 'dashCooldown' ? DASH_UPGRADES : NPC_COUNT_UPGRADES;
    return table[level]?.cost ?? null;
  },

  addExp: (amount: number) => {
    const { exp, activeEffects, playerTier } = get();
    const stage = getStageByTier(playerTier);
    const now = Date.now();
    const hasExp2x = activeEffects.some((e) => e.type === 'exp2x' && e.endTime > now);
    const finalAmount = hasExp2x ? amount * 2 : amount;
    const newExp = exp + finalAmount;
    const maxExp = stage.expToNext === Infinity ? newExp : Math.min(newExp, stage.expToNext);
    set({ exp: maxExp });
  },

  setGameOver: () => set({ isGameOver: true }),
  setClear: () => set({ isCleared: true }),

  startGame: () => {
    const now = Date.now();
    const { upgrades, completedQuestIds } = get();
    const npcMultiplier = NPC_COUNT_UPGRADES[upgrades.npcCount - 1]?.multiplier ?? 1.0;
    const initialQuests = pickQuests(3, completedQuestIds);
    set({
      isStarted: true,
      isPaused: false,
      showUpgradePanel: false,
      npcs: generateInitialNPCs(npcMultiplier),
      items: generateInitialItems(),
      activeEffects: [],
      activeEvent: null,
      boss: null,
      score: 0,
      killCount: 0,
      combo: 0,
      lastEatTime: 0,
      isDashing: false,
      dashCooldownEnd: 0,
      startTime: now,
      nextEventTime: now + 30000 + Math.random() * 30000,
      nextBossTime: now + 120000,
      dashCount: 0,
      quests: initialQuests.map((q) => ({ questId: q.id, current: 0, completed: false, claimed: false })),
      questRewardPopup: null,
    });
  },

  resetGame: () =>
    set({
      playerTier: 1,
      exp: 0,
      gold: 0,
      totalGoldEarned: 0,
      upgrades: { speed: 1, eatRange: 1, npcCount: 1, dashCooldown: 1 },
      showUpgradePanel: false,
      isGameOver: false,
      isCleared: false,
      isStarted: false,
      isPaused: false,
      npcs: [],
      items: [],
      activeEffects: [],
      activeEvent: null,
      boss: null,
      score: 0,
      killCount: 0,
      combo: 0,
      lastEatTime: 0,
      isDashing: false,
      dashCooldownEnd: 0,
      startTime: 0,
      nextEventTime: 0,
      nextBossTime: 0,
      moveInput: { x: 0, y: 0 },
      cameraRotation: { x: 0, y: 0 },
      ownedPerks: [],
      perkChoices: null,
      showPerkSelection: false,
      perkBonuses: buildPerkBonuses([]),
      shellDefenseAvailable: false,
      ownedSkills: [],
      activeSkill: null,
      skillCooldowns: {},
      quests: [],
      completedQuestIds: [],
      dashCount: 0,
      questRewardPopup: null,
    }),

  togglePause: () => set((s) => ({ isPaused: !s.isPaused })),

  eatNPC: (npcId: string) => {
    const { npcs, score, killCount } = get();
    const npc = npcs.find((n) => n.id === npcId);
    if (!npc) return;
    const newKill = killCount + 1;
    set({
      npcs: npcs.map((n) => (n.id === npcId ? { ...n, alive: false } : n)),
      score: score + Math.max(npc.tier, 1),
      killCount: newKill,
    });
    get().updateQuestProgress('eat_count', newKill);
    get().updateQuestProgress('eat_tier', newKill, npc.tier);
    setTimeout(() => get().respawnNPC(npc.tier), 3000 + Math.random() * 5000);
  },

  respawnNPC: (tier: number) => {
    set((state) => {
      const deadIndex = state.npcs.findIndex((n) => !n.alive && n.tier === tier);
      if (deadIndex >= 0) {
        const newNpcs = [...state.npcs];
        newNpcs[deadIndex] = spawnNPC(tier);
        return { npcs: newNpcs };
      }
      return { npcs: [...state.npcs, spawnNPC(tier)] };
    });
  },

  startDash: () => {
    const now = Date.now();
    if (now < get().dashCooldownEnd || get().isDashing) return;
    const { upgrades, dashCount } = get();
    const cooldownMs = DASH_UPGRADES[upgrades.dashCooldown - 1]?.cooldownMs ?? 5000;
    set({ isDashing: true, dashCooldownEnd: now + cooldownMs, dashCount: dashCount + 1 });
    get().updateQuestProgress('dash_count', dashCount + 1);
    setTimeout(() => get().endDash(), 500);
  },

  endDash: () => set({ isDashing: false }),

  getDashCooldownMs: () => {
    const { upgrades } = get();
    return DASH_UPGRADES[upgrades.dashCooldown - 1]?.cooldownMs ?? 5000;
  },

  incrementCombo: () => {
    const now = Date.now();
    const { lastEatTime, combo } = get();
    const newCombo = now - lastEatTime < 2000 ? combo + 1 : 1;
    set({ combo: newCombo, lastEatTime: now });
    get().updateQuestProgress('combo', newCombo);
  },

  resetCombo: () => set({ combo: 0, lastEatTime: 0 }),

  getComboMultiplier: () => {
    const { combo } = get();
    if (combo >= 10) return 3;
    if (combo >= 5) return 2;
    if (combo >= 3) return 1.5;
    return 1;
  },

  collectItem: (itemId: string) => {
    const { items, activeEffects } = get();
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const now = Date.now();
    const durations: Record<string, number> = { speed: 8000, magnet: 8000, shield: 5000, exp2x: 10000 };
    const newEffect: ActiveEffect = { type: item.type, endTime: now + durations[item.type] };
    set({
      items: items.filter((i) => i.id !== itemId),
      activeEffects: [...activeEffects.filter((e) => e.type !== item.type), newEffect],
    });
    setTimeout(() => get().respawnItem(), 10000 + Math.random() * 15000);
  },

  respawnItem: () => {
    set((state) => ({ items: [...state.items, spawnItem()] }));
  },

  hasEffect: (type: ActiveEffect['type']) => {
    const now = Date.now();
    return get().activeEffects.some((e) => e.type === type && e.endTime > now);
  },

  cleanExpiredEffects: () => {
    const now = Date.now();
    set((state) => ({
      activeEffects: state.activeEffects.filter((e) => e.endTime > now),
    }));
  },

  setEvent: (event) => set({ activeEvent: event }),
  setNextEventTime: (t) => set({ nextEventTime: t }),

  setBoss: (boss) => set({ boss }),
  setNextBossTime: (t) => set({ nextBossTime: t }),

  spawnFrenzyNPCs: (px, py, pz) => {
    set((state) => {
      const newNpcs = [...state.npcs];
      const tier = Math.max(0, state.playerTier - 1);
      for (let i = 0; i < 20; i++) {
        const npc = spawnNPC(tier);
        npc.x = px + (Math.random() - 0.5) * 15;
        npc.y = py + (Math.random() - 0.5) * 5;
        npc.z = pz + (Math.random() - 0.5) * 15;
        newNpcs.push(npc);
      }
      return { npcs: newNpcs };
    });
  },

  setMoveInput: (x, y) => set({ moveInput: { x, y } }),
  setCameraRotation: (x, y) => set({ cameraRotation: { x, y } }),

  selectPerk: (perkId: string) => {
    const { perkChoices, ownedPerks } = get();
    if (!perkChoices) return;
    const perk = perkChoices.find((p) => p.id === perkId);
    if (!perk) return;
    const newOwned = [...ownedPerks, perk.id];
    const effects = PERK_POOL.filter((p) => newOwned.includes(p.id)).map((p) => p.effect);
    set({
      ownedPerks: newOwned,
      perkBonuses: buildPerkBonuses(effects),
      perkChoices: null,
      showPerkSelection: false,
      isPaused: false,
    });
  },

  skipPerks: () => {
    set({ perkChoices: null, showPerkSelection: false, isPaused: false });
  },

  getPerkBonuses: () => get().perkBonuses,

  buySkill: (skillId: string) => {
    const { ownedSkills, gold, playerTier } = get();
    if (ownedSkills.includes(skillId)) return false;
    const skill = getSkillById(skillId);
    if (!skill || playerTier < skill.minTier || gold < skill.cost) return false;
    set({ ownedSkills: [...ownedSkills, skillId], gold: gold - skill.cost });
    return true;
  },

  activateSkill: (skillId: string) => {
    const { ownedSkills, skillCooldowns, activeSkill } = get();
    if (!ownedSkills.includes(skillId)) return false;
    if (activeSkill && Date.now() < activeSkill.endTime) return false;
    const now = Date.now();
    if (skillCooldowns[skillId] && now < skillCooldowns[skillId]) return false;
    const skill = getSkillById(skillId);
    if (!skill) return false;
    set({
      activeSkill: { id: skillId, endTime: now + skill.durationMs },
      skillCooldowns: { ...skillCooldowns, [skillId]: now + skill.cooldownMs },
    });
    return true;
  },

  isSkillActive: (skillId: string) => {
    const { activeSkill } = get();
    return !!activeSkill && activeSkill.id === skillId && Date.now() < activeSkill.endTime;
  },

  isSkillOnCooldown: (skillId: string) => {
    const { skillCooldowns } = get();
    return !!skillCooldowns[skillId] && Date.now() < skillCooldowns[skillId];
  },

  useShellDefense: () => {
    const { shellDefenseAvailable, playerTier } = get();
    if (playerTier >= 2 && shellDefenseAvailable) {
      set({ shellDefenseAvailable: false });
      return true;
    }
    return false;
  },

  updateQuestProgress: (type: string, value: number, tierTarget?: number) => {
    const { quests } = get();
    let changed = false;
    const updated = quests.map((qp) => {
      if (qp.completed) return qp;
      const def = QUEST_POOL.find((q) => q.id === qp.questId);
      if (!def || def.type !== type) return qp;
      if (type === 'eat_tier' && tierTarget !== undefined && def.tierRequirement !== undefined && tierTarget < def.tierRequirement) return qp;
      const newCurrent = Math.min(value, def.target);
      if (newCurrent !== qp.current) changed = true;
      return { ...qp, current: newCurrent, completed: newCurrent >= def.target };
    });
    if (changed) set({ quests: updated });
  },

  claimQuestReward: (questId: string) => {
    const { quests, gold, completedQuestIds } = get();
    const qp = quests.find((q) => q.questId === questId);
    if (!qp || !qp.completed || qp.claimed) return;
    const def = QUEST_POOL.find((q) => q.id === questId);
    if (!def) return;
    const rewardGold = def.reward.gold ?? 0;
    const rewardExp = def.reward.exp ?? 0;
    if (rewardExp > 0) get().addExp(rewardExp);
    const newCompleted = [...completedQuestIds, questId];
    const newQuests = quests.map((q) => q.questId === questId ? { ...q, claimed: true } : q);
    const remaining = newQuests.filter((q) => !q.claimed);
    if (remaining.length < 2) {
      const extra = pickQuests(2, newCompleted);
      extra.forEach((q) => newQuests.push({ questId: q.id, current: 0, completed: false, claimed: false }));
    }
    set({
      gold: gold + rewardGold,
      quests: newQuests,
      completedQuestIds: newCompleted,
      questRewardPopup: { gold: rewardGold, exp: rewardExp },
    });
    setTimeout(() => get().dismissRewardPopup(), 2000);
  },

  dismissRewardPopup: () => set({ questRewardPopup: null }),
}));
