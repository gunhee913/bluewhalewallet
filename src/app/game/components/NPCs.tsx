'use client';

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore, NPC } from '../lib/useGameStore';
import { getStageByTier, WORLD_SIZE, WORLD_DEPTH, OCEAN_FLOOR_Y } from '../lib/gameConfig';
import { getTerrainHeight } from '../lib/terrain';
import { updateNPCPosition, removeNPCPosition, clearNPCPositions } from '../lib/npcRegistry';
import CreatureModel from './CreatureModels';

const SPEED_MULTIPLIER: Record<number, number> = {
  0: 0.15,
  1: 0.25,
  2: 0.3,
  3: 0.35,
  4: 0.4,
  5: 0.45,
  6: 0.55,
  7: 0.35,
};

const DASH_CHANCE: Record<number, number> = {
  0: 0,
  1: 0.03,
  2: 0.05,
  3: 0.07,
  4: 0.1,
  5: 0.12,
  6: 0.15,
  7: 0.08,
};

const DETECT_RANGE = 5;
const FLEE_RANGE = 6;

type BehaviorState = 'cruise' | 'dash' | 'idle';

function DangerMark({ size, tierDiff }: { size: number; tierDiff: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = size * 1.5 + Math.sin(clock.getElapsedTime() * 4) * 0.1;
  });
  const color = tierDiff >= 3 ? '#ff0000' : tierDiff >= 2 ? '#ff6600' : '#ffaa00';
  return (
    <mesh ref={ref} position={[0, size * 1.5, 0]}>
      <octahedronGeometry args={[0.12, 0]} />
      <meshBasicMaterial color={color} transparent opacity={0.85} />
    </mesh>
  );
}

function EdibleMark({ size }: { size: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = size * 1.4 + Math.sin(clock.getElapsedTime() * 3) * 0.08;
      ref.current.scale.setScalar(0.8 + Math.sin(clock.getElapsedTime() * 4) * 0.15);
    }
  });
  return (
    <mesh ref={ref} position={[0, size * 1.4, 0]}>
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

    behaviorTimer.current -= delta;
    if (behaviorTimer.current <= 0) {
      const roll = Math.random();
      const dashChance = DASH_CHANCE[npc.tier] ?? 0.1;

      if (roll < dashChance) {
        behaviorRef.current = 'dash';
        behaviorTimer.current = 0.8 + Math.random() * 1.2;
      } else if (roll < dashChance + 0.15) {
        behaviorRef.current = 'idle';
        behaviorTimer.current = 1 + Math.random() * 2;
      } else {
        behaviorRef.current = 'cruise';
        behaviorTimer.current = 2 + Math.random() * 5;
      }
      speedJitter.current = 0.7 + Math.random() * 0.6;
    }

    changeTimer.current -= delta;
    if (changeTimer.current <= 0) {
      dirRef.current.set(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 2
      ).normalize();
      changeTimer.current = 2 + Math.random() * 4;
    }

    const playerMeshPos = getPlayerPosition();
    if (playerMeshPos) {
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

    const { activeEffects, activeEvent } = useGameStore.getState();

    const now = Date.now();

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

    let speedMult = SPEED_MULTIPLIER[npc.tier] ?? 0.4;
    if (behaviorRef.current === 'dash') {
      speedMult *= 1.8;
    } else if (behaviorRef.current === 'idle') {
      speedMult *= 0.1;
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
    pos.x += dirRef.current.x * speed * delta;
    pos.y += dirRef.current.y * speed * delta;
    pos.z += dirRef.current.z * speed * delta;

    if (activeEvent?.type === 'current' && activeEvent.data && now < activeEvent.endTime) {
      pos.x += activeEvent.data.dirX * 1.5 * delta;
      pos.z += activeEvent.data.dirZ * 1.5 * delta;
    }

    const halfWorld = WORLD_SIZE / 2 - 5;
    const topY = OCEAN_FLOOR_Y + WORLD_DEPTH - 2;
    const terrainY = getTerrainHeight(pos.x, pos.z);
    const bottomY = terrainY + 0.5;

    if (pos.x > halfWorld || pos.x < -halfWorld) dirRef.current.x *= -1;
    if (pos.y > topY || pos.y < bottomY) dirRef.current.y *= -1;
    if (pos.z > halfWorld || pos.z < -halfWorld) dirRef.current.z *= -1;

    pos.x = Math.max(-halfWorld, Math.min(halfWorld, pos.x));
    pos.y = Math.max(bottomY, Math.min(topY, pos.y));
    pos.z = Math.max(-halfWorld, Math.min(halfWorld, pos.z));

    const targetAngle = Math.atan2(dirRef.current.x, dirRef.current.z);
    const targetQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0, targetAngle, 0)
    );
    groupRef.current.quaternion.slerp(targetQuat, 0.05);

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
