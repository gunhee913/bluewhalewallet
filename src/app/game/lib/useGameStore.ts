import { create } from 'zustand';
import { CREATURE_STAGES, getStageByTier, WORLD_SIZE, WORLD_DEPTH, OCEAN_FLOOR_Y } from './gameConfig';

export interface NPC {
  id: string;
  tier: number;
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
    x: (Math.random() - 0.5) * half * 2,
    y: OCEAN_FLOOR_Y + 1 + Math.random() * (WORLD_DEPTH - 3),
    z: (Math.random() - 0.5) * half * 2,
    dirX: (Math.random() - 0.5) * 2,
    dirY: (Math.random() - 0.5) * 0.5,
    dirZ: (Math.random() - 0.5) * 2,
    alive: true,
  };
}

function generateInitialNPCs(): NPC[] {
  const npcs: NPC[] = [];
  const countsPerTier: Record<number, number> = { 0: 150, 1: 80, 2: 50, 3: 40, 4: 30, 5: 20, 6: 12, 7: 8 };
  for (let tier = 0; tier <= 7; tier++) {
    const count = countsPerTier[tier];
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

interface GameState {
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
}

export const useGameStore = create<GameState>((set, get) => ({
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

  addExp: (amount: number) => {
    const { playerTier, exp, activeEffects } = get();
    const stage = getStageByTier(playerTier);
    const now = Date.now();
    const hasExp2x = activeEffects.some((e) => e.type === 'exp2x' && e.endTime > now);
    const finalAmount = hasExp2x ? amount * 2 : amount;
    const newExp = exp + finalAmount;

    if (newExp >= stage.expToNext && playerTier < 7) {
      set({ playerTier: playerTier + 1, exp: 0 });
    } else if (playerTier >= 7 && newExp >= stage.expToNext) {
      set({ isCleared: true });
    } else {
      set({ exp: newExp });
    }
  },

  setGameOver: () => set({ isGameOver: true }),
  setClear: () => set({ isCleared: true }),

  startGame: () => {
    const now = Date.now();
    set({
      isStarted: true,
      isPaused: false,
      npcs: generateInitialNPCs(),
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
    });
  },

  resetGame: () =>
    set({
      playerTier: 1,
      exp: 0,
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
    }),

  togglePause: () => set((s) => ({ isPaused: !s.isPaused })),

  eatNPC: (npcId: string) => {
    const { npcs, score, killCount } = get();
    const npc = npcs.find((n) => n.id === npcId);
    if (!npc) return;
    set({
      npcs: npcs.map((n) => (n.id === npcId ? { ...n, alive: false } : n)),
      score: score + Math.max(npc.tier, 1),
      killCount: killCount + 1,
    });
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
    set({ isDashing: true, dashCooldownEnd: now + 4000 });
    setTimeout(() => get().endDash(), 500);
  },

  endDash: () => set({ isDashing: false }),

  incrementCombo: () => {
    const now = Date.now();
    const { lastEatTime, combo } = get();
    if (now - lastEatTime < 2000) {
      set({ combo: combo + 1, lastEatTime: now });
    } else {
      set({ combo: 1, lastEatTime: now });
    }
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
}));
