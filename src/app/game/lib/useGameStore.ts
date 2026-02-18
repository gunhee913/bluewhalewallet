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
  MAX_LEVEL,
  getLevelExpRequired,
  getLevelReward,
} from './gameConfig';
import { PerkDef, PERK_POOL, rollPerkChoices, PerkEffect } from './gamePerks';
import { QuestDef, QuestProgress, pickQuests, QUEST_POOL } from './gameQuests';

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

interface QuestInitState {
  killCount: number;
  totalGoldEarned: number;
  playerTier: number;
  elapsed: number;
  dashCount: number;
  combo: number;
}

function getQuestInitialProgress(def: QuestDef, state: QuestInitState): { current: number; completed: boolean } {
  let current = 0;
  switch (def.type) {
    case 'eat_count': current = Math.min(state.killCount, def.target); break;
    case 'gold_earn': current = Math.min(state.totalGoldEarned, def.target); break;
    case 'evolve': current = Math.min(state.playerTier, def.target); break;
    case 'survive_time': current = Math.min(state.elapsed, def.target); break;
    case 'dash_count': current = Math.min(state.dashCount, def.target); break;
    case 'combo': current = Math.min(state.combo, def.target); break;
    case 'eat_tier': current = 0; break;
  }
  return { current, completed: current >= def.target };
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
  level: number;
  levelExp: number;
  levelUpMessage: string | null;
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
  scoreAtWhale: number;

  moveInput: { x: number; y: number };
  cameraRotation: { x: number; y: number };

  ownedPerks: string[];
  perkChoices: PerkDef[] | null;
  showPerkSelection: boolean;
  perkBonuses: PerkBonuses;

  shellDefenseAvailable: boolean;


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
  batchEatNPCs: (npcIds: string[], totalExp: number, totalGold: number) => void;
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
  level: 1,
  levelExp: 0,
  levelUpMessage: null,
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
  scoreAtWhale: 0,

  moveInput: { x: 0, y: 0 },
  cameraRotation: { x: 0, y: 0 },

  ownedPerks: [],
  perkChoices: null,
  showPerkSelection: false,
  perkBonuses: buildPerkBonuses([]),
  shellDefenseAvailable: false,


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
    const { playerTier, gold, perkBonuses } = get();
    if (playerTier >= 7) return false;
    const cost = EVOLUTION_COST[playerTier];
    if (!cost) return false;
    const finalCost = perkBonuses.freeNextEvolve ? 0 : cost;
    if (gold < finalCost) return false;
    const usedFree = perkBonuses.freeNextEvolve;
    const nextTier = playerTier + 1;
    const whaleUpdate = nextTier === 7 ? { scoreAtWhale: get().score } : {};
    set({
      playerTier: nextTier,
      gold: gold - finalCost,
      shellDefenseAvailable: nextTier >= 2 ? true : false,
      ...whaleUpdate,
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
    const { level, levelExp, activeEffects, ownedPerks } = get();
    if (level >= MAX_LEVEL) return;
    const now = Date.now();
    const hasExp2x = activeEffects.some((e) => e.type === 'exp2x' && e.endTime > now);
    const finalAmount = Math.round(hasExp2x ? amount * 2 : amount);

    let currentLevel = level;
    let currentExp = levelExp + finalAmount;
    let totalGoldReward = 0;
    let lastMessage: string | null = null;
    let didLevelUp = false;

    while (currentLevel < MAX_LEVEL) {
      const required = getLevelExpRequired(currentLevel);
      if (currentExp < required) break;
      currentExp -= required;
      currentLevel++;
      didLevelUp = true;
      const reward = getLevelReward(currentLevel);
      totalGoldReward += reward.gold;
      lastMessage = reward.message;
    }

    set({ level: currentLevel, levelExp: currentExp });
    if (totalGoldReward > 0) {
      get().addGold(totalGoldReward);
    }
    if (lastMessage) {
      set({ levelUpMessage: lastMessage });
      setTimeout(() => set({ levelUpMessage: null }), 2000);
    }
    if (didLevelUp && !get().showPerkSelection) {
      const tryShowPerk = () => {
        if (get().showPerkSelection || get().isGameOver) return;
        const hasUnclaimedQuest = get().quests.some((q) => q.completed && !q.claimed);
        if (hasUnclaimedQuest) {
          setTimeout(tryShowPerk, 1500);
          return;
        }
        const latestPerks = get().ownedPerks;
        const choices = rollPerkChoices(latestPerks, 3);
        if (choices.length > 0) {
          set({ perkChoices: choices, showPerkSelection: true, isPaused: true });
        }
      };
      setTimeout(tryShowPerk, 1500);
    }
  },

  setGameOver: () => set({ isGameOver: true }),
  setClear: () => set({ isCleared: true }),

  startGame: () => {
    const now = Date.now();
    const { upgrades, completedQuestIds, playerTier } = get();
    const npcMultiplier = NPC_COUNT_UPGRADES[upgrades.npcCount - 1]?.multiplier ?? 1.0;
    const initialQuests = pickQuests(3, completedQuestIds, playerTier);
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
      scoreAtWhale: 0,
      combo: 0,
      lastEatTime: 0,
      isDashing: false,
      dashCooldownEnd: 0,
      startTime: now,
      nextEventTime: now + 30000 + Math.random() * 30000,
      nextBossTime: now + 90000 + (get().perkBonuses.bossDelay ?? 0),
      dashCount: 0,
      level: 1,
      levelExp: 0,
      levelUpMessage: null,
      quests: initialQuests.map((q) => {
        const init = getQuestInitialProgress(q, { killCount: 0, totalGoldEarned: 0, playerTier, elapsed: 0, dashCount: 0, combo: 0 });
        return { questId: q.id, current: init.current, completed: init.completed, claimed: false };
      }),
      questRewardPopup: null,
    });
  },

  resetGame: () =>
    set({
      playerTier: 1,
      exp: 0,
      level: 1,
      levelExp: 0,
      levelUpMessage: null,
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
      scoreAtWhale: 0,
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
    get().updateQuestProgress('eat_tier', 1, npc.tier);
    setTimeout(() => get().respawnNPC(npc.tier), 3000 + Math.random() * 5000);
  },

  batchEatNPCs: (npcIds: string[], totalExp: number, totalGold: number) => {
    if (npcIds.length === 0) return;
    const { npcs, score, killCount, combo, lastEatTime, perkBonuses } = get();

    const idSet = new Set(npcIds);
    let addedScore = 0;
    const tiers: number[] = [];
    for (const n of npcs) {
      if (idSet.has(n.id)) {
        addedScore += Math.max(n.tier, 1);
        tiers.push(n.tier);
      }
    }

    const now = Date.now();
    const comboWindow = 2000 + perkBonuses.comboTimeBonus;
    const newCombo = now - lastEatTime < comboWindow ? combo + npcIds.length : npcIds.length;
    const newKill = killCount + npcIds.length;

    set({
      npcs: npcs.map((n) => (idSet.has(n.id) ? { ...n, alive: false } : n)),
      score: score + addedScore,
      killCount: newKill,
      combo: newCombo,
      lastEatTime: now,
    });

    get().addExp(totalExp);
    get().addGold(totalGold);
    get().updateQuestProgress('eat_count', newKill);
    get().updateQuestProgress('combo', newCombo);
    const tierCounts = new Map<number, number>();
    for (const tier of tiers) {
      tierCounts.set(tier, (tierCounts.get(tier) ?? 0) + 1);
      setTimeout(() => get().respawnNPC(tier), 3000 + Math.random() * 5000);
    }
    for (const [tier, count] of tierCounts) {
      get().updateQuestProgress('eat_tier', count, tier);
    }
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
    const { upgrades, dashCount, perkBonuses } = get();
    const baseCooldown = DASH_UPGRADES[upgrades.dashCooldown - 1]?.cooldownMs ?? 5000;
    const cooldownMs = Math.max(1000, baseCooldown - perkBonuses.dashCooldownReduction);
    set({ isDashing: true, dashCooldownEnd: now + cooldownMs, dashCount: dashCount + 1 });
    get().updateQuestProgress('dash_count', dashCount + 1);
    setTimeout(() => get().endDash(), 500);
  },

  endDash: () => set({ isDashing: false }),

  getDashCooldownMs: () => {
    const { upgrades, perkBonuses } = get();
    const baseCooldown = DASH_UPGRADES[upgrades.dashCooldown - 1]?.cooldownMs ?? 5000;
    return Math.max(1000, baseCooldown - perkBonuses.dashCooldownReduction);
  },

  incrementCombo: () => {
    const now = Date.now();
    const { lastEatTime, combo, perkBonuses } = get();
    const comboWindow = 2000 + perkBonuses.comboTimeBonus;
    const newCombo = now - lastEatTime < comboWindow ? combo + 1 : 1;
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
    const { items, activeEffects, perkBonuses } = get();
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const now = Date.now();
    const baseDurations: Record<string, number> = { speed: 8000, magnet: 8000, shield: 5000, exp2x: 10000 };
    const duration = Math.round(baseDurations[item.type] * (1 + perkBonuses.itemDurationBonus));
    const newEffect: ActiveEffect = { type: item.type, endTime: now + duration };
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
      const newCurrent = type === 'eat_tier'
        ? Math.min(qp.current + value, def.target)
        : Math.min(value, def.target);
      if (newCurrent <= qp.current) return qp;
      changed = true;
      return { ...qp, current: newCurrent, completed: newCurrent >= def.target };
    });
    if (changed) set({ quests: updated });
  },

  claimQuestReward: (questId: string) => {
    const { quests, completedQuestIds } = get();
    const qp = quests.find((q) => q.questId === questId);
    if (!qp || !qp.completed || qp.claimed) return;
    const def = QUEST_POOL.find((q) => q.id === questId);
    if (!def) return;
    const rewardGold = def.reward.gold ?? 0;
    const rewardExp = def.reward.exp ?? 0;
    if (rewardExp > 0) get().addExp(rewardExp);
    const freshGold = get().gold;
    const freshQuests = get().quests;
    const newCompleted = [...completedQuestIds, questId];
    const newQuests = freshQuests.map((q) => q.questId === questId ? { ...q, claimed: true } : q);
    const extra = pickQuests(1, newCompleted, get().playerTier);
    const { killCount, totalGoldEarned, playerTier, startTime, dashCount, combo } = get();
    const elapsed = startTime > 0 ? Math.floor((Date.now() - startTime) / 1000) : 0;
    extra.forEach((q) => {
      const initial = getQuestInitialProgress(q, { killCount, totalGoldEarned, playerTier, elapsed, dashCount, combo });
      newQuests.push({ questId: q.id, current: initial.current, completed: initial.completed, claimed: false });
    });
    set({
      gold: freshGold + rewardGold,
      quests: newQuests,
      completedQuestIds: newCompleted,
      questRewardPopup: { gold: rewardGold, exp: rewardExp },
    });
    setTimeout(() => get().dismissRewardPopup(), 2000);
  },

  dismissRewardPopup: () => set({ questRewardPopup: null }),
}));
