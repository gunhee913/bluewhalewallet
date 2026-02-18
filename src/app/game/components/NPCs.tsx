'use client';

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore, NPC } from '../lib/useGameStore';
import { getStageByTier, WORLD_SIZE, WORLD_DEPTH, OCEAN_FLOOR_Y } from '../lib/gameConfig';
import { getTerrainHeight } from '../lib/terrain';
import { updateNPCPosition, removeNPCPosition, clearNPCPositions, getLastStartle } from '../lib/npcRegistry';
import CreatureModel from './CreatureModels';

const SPEED_MULTIPLIER: Record<number, number> = {
  0: 0.15, 1: 0.25, 2: 0.3, 3: 0.35,
  4: 0.4, 5: 0.45, 6: 0.55, 7: 0.35,
};

const DETECT_RANGE = 5;
const FLEE_RANGE = 6;
const STARTLE_RANGE = 10;
const STARTLE_DURATION = 1200;

type BehaviorState = 'cruise' | 'dash' | 'idle' | 'zigzag' | 'circle' | 'burst' | 'rise' | 'dive' | 'startle';

interface BehaviorWeights {
  cruise: number;
  dash: number;
  idle: number;
  zigzag: number;
  circle: number;
  burst: number;
  rise: number;
  dive: number;
}

const TIER_BEHAVIORS: Record<number, BehaviorWeights> = {
  0: { cruise: 0.40, dash: 0.00, idle: 0.20, zigzag: 0.25, circle: 0.05, burst: 0.00, rise: 0.05, dive: 0.05 },
  1: { cruise: 0.35, dash: 0.03, idle: 0.15, zigzag: 0.25, circle: 0.05, burst: 0.05, rise: 0.06, dive: 0.06 },
  2: { cruise: 0.30, dash: 0.05, idle: 0.12, zigzag: 0.22, circle: 0.08, burst: 0.08, rise: 0.07, dive: 0.08 },
  3: { cruise: 0.28, dash: 0.07, idle: 0.10, zigzag: 0.18, circle: 0.10, burst: 0.10, rise: 0.08, dive: 0.09 },
  4: { cruise: 0.25, dash: 0.10, idle: 0.08, zigzag: 0.15, circle: 0.12, burst: 0.12, rise: 0.09, dive: 0.09 },
  5: { cruise: 0.22, dash: 0.12, idle: 0.06, zigzag: 0.12, circle: 0.15, burst: 0.15, rise: 0.09, dive: 0.09 },
  6: { cruise: 0.20, dash: 0.15, idle: 0.05, zigzag: 0.10, circle: 0.15, burst: 0.18, rise: 0.08, dive: 0.09 },
  7: { cruise: 0.25, dash: 0.08, idle: 0.10, zigzag: 0.15, circle: 0.18, burst: 0.08, rise: 0.08, dive: 0.08 },
};

function pickBehavior(tier: number): { behavior: BehaviorState; duration: number } {
  const w = TIER_BEHAVIORS[tier] ?? TIER_BEHAVIORS[1];
  const entries = Object.entries(w) as [BehaviorState, number][];
  let roll = Math.random();
  for (const [behavior, weight] of entries) {
    roll -= weight;
    if (roll <= 0) {
      const duration = getBehaviorDuration(behavior);
      return { behavior, duration };
    }
  }
  return { behavior: 'cruise', duration: 2 + Math.random() * 4 };
}

function getBehaviorDuration(b: BehaviorState): number {
  switch (b) {
    case 'cruise': return 2 + Math.random() * 5;
    case 'dash': return 0.6 + Math.random() * 1.0;
    case 'idle': return 1 + Math.random() * 2;
    case 'zigzag': return 2 + Math.random() * 3;
    case 'circle': return 2 + Math.random() * 4;
    case 'burst': return 0.3 + Math.random() * 0.3;
    case 'rise': return 1.5 + Math.random() * 1.5;
    case 'dive': return 1.5 + Math.random() * 1.5;
    case 'startle': return STARTLE_DURATION / 1000;
    default: return 3;
  }
}

function DangerMark({ size, tierDiff }: { size: number; tierDiff: number }) {
  const color = tierDiff >= 3 ? '#ff0000' : tierDiff >= 2 ? '#ff6600' : '#ffaa00';
  return (
    <mesh position={[0, size * 1.5, 0]}>
      <octahedronGeometry args={[0.12, 0]} />
      <meshBasicMaterial color={color} transparent opacity={0.85} />
    </mesh>
  );
}

function EdibleMark({ size }: { size: number }) {
  return (
    <mesh position={[0, size * 1.4, 0]}>
      <sphereGeometry args={[0.08, 8, 8]} />
      <meshBasicMaterial color="#44ff44" transparent opacity={0.9} />
    </mesh>
  );
}

function NPCCreature({ npc, playerTier }: { npc: NPC; playerTier: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const dirRef = useRef(new THREE.Vector3(npc.dirX, npc.dirY, npc.dirZ).normalize());
  const changeTimer = useRef(Math.random() * 5);
  const behaviorRef = useRef<BehaviorState>('cruise');
  const behaviorTimer = useRef(2 + Math.random() * 4);
  const speedJitter = useRef(0.8 + Math.random() * 0.4);
  const terrainYRef = useRef(getTerrainHeight(npc.x, npc.z));
  const terrainTimer = useRef(0);

  const wobblePhase = useRef(Math.random() * Math.PI * 2);
  const circleAngle = useRef(Math.random() * Math.PI * 2);
  const lastStartleTime = useRef(0);

  const stage = getStageByTier(npc.tier);

  useEffect(() => {
    return () => {
      removeNPCPosition(npc.id);
    };
  }, [npc.id]);

  useFrame((_, delta) => {
    if (!groupRef.current || !npc.alive) return;
    const { isPaused } = useGameStore.getState();
    if (isPaused) return;

    const { playerTier: currentPlayerTier } = useGameStore.getState();
    const pos = groupRef.current.position;
    const now = Date.now();

    // --- Startle check ---
    const startle = getLastStartle();
    if (startle && startle.time > lastStartleTime.current && now - startle.time < 100) {
      const sdx = pos.x - startle.x;
      const sdy = pos.y - startle.y;
      const sdz = pos.z - startle.z;
      const sdist = Math.sqrt(sdx * sdx + sdy * sdy + sdz * sdz);
      if (sdist < STARTLE_RANGE && sdist > 0.5) {
        behaviorRef.current = 'startle';
        behaviorTimer.current = STARTLE_DURATION / 1000;
        dirRef.current.set(sdx / sdist, sdy / sdist, sdz / sdist);
        lastStartleTime.current = startle.time;
      }
    }

    // --- Behavior transition ---
    behaviorTimer.current -= delta;
    if (behaviorTimer.current <= 0 && behaviorRef.current !== 'startle') {
      const pick = pickBehavior(npc.tier);
      behaviorRef.current = pick.behavior;
      behaviorTimer.current = pick.duration;
      speedJitter.current = 0.7 + Math.random() * 0.6;

      if (pick.behavior === 'burst') {
        dirRef.current.set(
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 0.8,
          (Math.random() - 0.5) * 2
        ).normalize();
      }
    }
    if (behaviorRef.current === 'startle' && behaviorTimer.current <= 0) {
      const pick = pickBehavior(npc.tier);
      behaviorRef.current = pick.behavior;
      behaviorTimer.current = pick.duration;
    }

    // --- Direction changes (cruise/zigzag only) ---
    const behavior = behaviorRef.current;
    if (behavior === 'cruise' || behavior === 'zigzag') {
      changeTimer.current -= delta;
      if (changeTimer.current <= 0) {
        dirRef.current.set(
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 2
        ).normalize();
        changeTimer.current = 2 + Math.random() * 4;
      }
    }

    // --- Player reactions ---
    const playerMeshPos = getPlayerPosition();
    if (playerMeshPos && behavior !== 'startle') {
      const toPlayer = new THREE.Vector3(
        playerMeshPos.x - pos.x,
        playerMeshPos.y - pos.y,
        playerMeshPos.z - pos.z
      );
      const distToPlayer = toPlayer.length();

      if (npc.tier < currentPlayerTier && distToPlayer < FLEE_RANGE) {
        toPlayer.normalize();
        dirRef.current.lerp(toPlayer.negate(), 0.06);
        dirRef.current.normalize();
      } else if (npc.tier > currentPlayerTier && distToPlayer < DETECT_RANGE) {
        toPlayer.normalize();
        dirRef.current.lerp(toPlayer, 0.03);
        dirRef.current.normalize();
      }

      if (currentPlayerTier >= 4 && npc.tier <= currentPlayerTier && distToPlayer < 5 && distToPlayer > 0.5) {
        toPlayer.normalize();
        pos.x += toPlayer.x * 1.5 * delta;
        pos.y += toPlayer.y * 1.5 * delta;
        pos.z += toPlayer.z * 1.5 * delta;
      }
    }

    // --- Magnet effect ---
    const { activeEffects, activeEvent } = useGameStore.getState();
    const hasMagnet = activeEffects.some((e) => e.type === 'magnet' && e.endTime > now);
    if (hasMagnet && npc.tier <= currentPlayerTier && playerMeshPos) {
      const toPlayer = new THREE.Vector3(
        playerMeshPos.x - pos.x,
        playerMeshPos.y - pos.y,
        playerMeshPos.z - pos.z
      );
      const dist = toPlayer.length();
      if (dist < 12 && dist > 0.5) {
        toPlayer.normalize();
        pos.x += toPlayer.x * 4 * delta;
        pos.y += toPlayer.y * 4 * delta;
        pos.z += toPlayer.z * 4 * delta;
      }
    }

    // --- Speed calculation per behavior ---
    let speedMult = SPEED_MULTIPLIER[npc.tier] ?? 0.4;
    switch (behavior) {
      case 'dash': speedMult *= 1.8; break;
      case 'idle': speedMult *= 0.1; break;
      case 'burst': speedMult *= 2.8; break;
      case 'startle': speedMult *= 2.5; break;
      case 'rise': case 'dive': speedMult *= 0.8; break;
      case 'zigzag': speedMult *= 1.1; break;
      case 'circle': speedMult *= 0.6; break;
    }

    if (currentPlayerTier >= 5 && npc.tier > currentPlayerTier && playerMeshPos) {
      const toxicDist = Math.sqrt(
        (playerMeshPos.x - pos.x) ** 2 +
        (playerMeshPos.y - pos.y) ** 2 +
        (playerMeshPos.z - pos.z) ** 2
      );
      if (toxicDist < 6) speedMult *= 0.6;
    }

    const speed = stage.speed * speedMult * speedJitter.current;

    // --- Movement per behavior ---
    if (behavior === 'rise') {
      dirRef.current.y = Math.abs(dirRef.current.y) + 0.5;
      dirRef.current.normalize();
    } else if (behavior === 'dive') {
      dirRef.current.y = -(Math.abs(dirRef.current.y) + 0.5);
      dirRef.current.normalize();
    }

    if (behavior === 'circle') {
      circleAngle.current += delta * 2.5;
      const radius = 1.5 + npc.tier * 0.3;
      pos.x += Math.cos(circleAngle.current) * radius * delta * speed * 0.3;
      pos.z += Math.sin(circleAngle.current) * radius * delta * speed * 0.3;
      pos.y += dirRef.current.y * speed * delta * 0.2;
    } else {
      pos.x += dirRef.current.x * speed * delta;
      pos.y += dirRef.current.y * speed * delta;
      pos.z += dirRef.current.z * speed * delta;
    }

    // --- Zigzag perpendicular oscillation ---
    if (behavior === 'zigzag') {
      wobblePhase.current += delta * 5;
      const perpX = -dirRef.current.z;
      const perpZ = dirRef.current.x;
      const zigAmp = 0.8 + npc.tier * 0.15;
      pos.x += perpX * Math.sin(wobblePhase.current) * zigAmp * delta;
      pos.z += perpZ * Math.sin(wobblePhase.current) * zigAmp * delta;
    }

    // --- Wobble (always, subtle swim oscillation) ---
    wobblePhase.current += delta * 3;
    const wobbleAmp = 0.08 + npc.tier * 0.01;
    pos.y += Math.sin(wobblePhase.current) * wobbleAmp * delta;

    // --- Ocean current ---
    if (activeEvent?.type === 'current' && activeEvent.data && now < activeEvent.endTime) {
      pos.x += activeEvent.data.dirX * 1.5 * delta;
      pos.z += activeEvent.data.dirZ * 1.5 * delta;
    }

    // --- Boundary clamping ---
    const halfWorld = WORLD_SIZE / 2 - 5;
    const topY = OCEAN_FLOOR_Y + WORLD_DEPTH - 2;
    terrainTimer.current -= delta;
    if (terrainTimer.current <= 0) {
      terrainYRef.current = getTerrainHeight(pos.x, pos.z);
      terrainTimer.current = 0.5 + Math.random() * 0.5;
    }
    const bottomY = terrainYRef.current + 0.5;

    if (pos.x > halfWorld || pos.x < -halfWorld) dirRef.current.x *= -1;
    if (pos.y > topY || pos.y < bottomY) dirRef.current.y *= -1;
    if (pos.z > halfWorld || pos.z < -halfWorld) dirRef.current.z *= -1;

    pos.x = Math.max(-halfWorld, Math.min(halfWorld, pos.x));
    pos.y = Math.max(bottomY, Math.min(topY, pos.y));
    pos.z = Math.max(-halfWorld, Math.min(halfWorld, pos.z));

    // --- Rotation ---
    const targetAngle = Math.atan2(dirRef.current.x, dirRef.current.z);
    const swirlTilt = behavior === 'zigzag' ? Math.sin(wobblePhase.current) * 0.15 : 0;
    const targetQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(swirlTilt, targetAngle, 0)
    );
    groupRef.current.quaternion.slerp(targetQuat, behavior === 'burst' || behavior === 'startle' ? 0.2 : 0.05);

    updateNPCPosition(npc.id, pos.x, pos.y, pos.z);
  });

  if (!npc.alive) return null;

  const tierDiff = npc.tier - playerTier;

  return (
    <group ref={groupRef} position={[npc.x, npc.y, npc.z]}>
      <CreatureModel creatureId={stage.id} scale={stage.size} variant={npc.variant} />
      {tierDiff > 0 && <DangerMark size={stage.size} tierDiff={tierDiff} />}
      {tierDiff <= 0 && <EdibleMark size={stage.size} />}
    </group>
  );
}

let _playerRef: { position: THREE.Vector3 } | null = null;

export function registerPlayerRef(ref: { position: THREE.Vector3 } | null) {
  _playerRef = ref;
}

export function getPlayerPosition() {
  return _playerRef?.position ?? null;
}

export default function NPCs() {
  const npcs = useGameStore((s) => s.npcs);
  const playerTier = useGameStore((s) => s.playerTier);
  const isStarted = useGameStore((s) => s.isStarted);
  const isGameOver = useGameStore((s) => s.isGameOver);
  const isCleared = useGameStore((s) => s.isCleared);

  useEffect(() => {
    return () => {
      clearNPCPositions();
    };
  }, []);

  if (!isStarted || isGameOver || isCleared) return null;

  return (
    <>
      {npcs.map((npc) =>
        npc.alive ? <NPCCreature key={npc.id} npc={npc} playerTier={playerTier} /> : null
      )}
    </>
  );
}
