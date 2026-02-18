'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../lib/useGameStore';
import { playBossWarning } from '../lib/sounds';
import { WORLD_SIZE, WORLD_DEPTH, OCEAN_FLOOR_Y } from '../lib/gameConfig';

function SharkModel() {
  return (
    <group>
      {/* Body */}
      <mesh>
        <capsuleGeometry args={[1.2, 4, 8, 16]} />
        <meshStandardMaterial color="#555566" roughness={0.5} />
      </mesh>
      {/* Dorsal fin */}
      <mesh position={[0, 1.5, -0.3]} rotation={[0.2, 0, 0]}>
        <coneGeometry args={[0.6, 1.5, 4]} />
        <meshStandardMaterial color="#444455" roughness={0.5} />
      </mesh>
      {/* Tail */}
      <mesh position={[0, 0.3, -3]} rotation={[0.3, 0, 0]}>
        <coneGeometry args={[0.8, 2, 4]} />
        <meshStandardMaterial color="#555566" roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.3, -3]} rotation={[-0.3, 0, 0]}>
        <coneGeometry args={[0.5, 1.5, 4]} />
        <meshStandardMaterial color="#555566" roughness={0.5} />
      </mesh>
      {/* Pectoral fins */}
      <mesh position={[1.2, -0.5, 0.5]} rotation={[0, 0, -0.6]}>
        <coneGeometry args={[0.3, 1.5, 4]} />
        <meshStandardMaterial color="#555566" roughness={0.5} />
      </mesh>
      <mesh position={[-1.2, -0.5, 0.5]} rotation={[0, 0, 0.6]}>
        <coneGeometry args={[0.3, 1.5, 4]} />
        <meshStandardMaterial color="#555566" roughness={0.5} />
      </mesh>
      {/* Eyes */}
      <mesh position={[0.7, 0.3, 2]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial color="#ff2222" emissive="#ff0000" emissiveIntensity={1} />
      </mesh>
      <mesh position={[-0.7, 0.3, 2]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial color="#ff2222" emissive="#ff0000" emissiveIntensity={1} />
      </mesh>
      <pointLight color="#ff0000" intensity={2} distance={10} />
    </group>
  );
}

export default function BossController() {
  const groupRef = useRef<THREE.Group>(null);
  const dirRef = useRef(new THREE.Vector3(1, 0, 0));
  const warningPlayed = useRef(false);
  const lastSpawnCheck = useRef(0);

  const boss = useGameStore((s) => s.boss);
  const isStarted = useGameStore((s) => s.isStarted);
  const isGameOver = useGameStore((s) => s.isGameOver);
  const isCleared = useGameStore((s) => s.isCleared);
  const isPaused = useGameStore((s) => s.isPaused);

  useFrame((_, delta) => {
    const state = useGameStore.getState();
    if (!state.isStarted || state.isGameOver || state.isCleared || state.isPaused) return;

    const now = Date.now();

    if (!state.boss && now > state.nextBossTime && state.nextBossTime > 0) {
      if (!warningPlayed.current) {
        playBossWarning();
        warningPlayed.current = true;
        setTimeout(() => {
          const s = useGameStore.getState();
          if (!s.isStarted || s.isGameOver || s.isCleared) return;
          const half = WORLD_SIZE / 2 - 10;
          s.setBoss({
            x: (Math.random() - 0.5) * half * 2,
            y: OCEAN_FLOOR_Y + 3 + Math.random() * (WORLD_DEPTH - 8),
            z: (Math.random() - 0.5) * half * 2,
            alive: true,
            spawnTime: Date.now(),
          });
          dirRef.current.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
        }, 2000);
      }
      return;
    }

    if (state.boss && !state.boss.alive) return;
    if (!state.boss || !groupRef.current) return;

    warningPlayed.current = false;

    if (now - state.boss.spawnTime > 20000) {
      state.setBoss(null);
      state.setNextBossTime(now + 120000 + (state.perkBonuses.bossDelay ?? 0));
      return;
    }

    const speed = 6;
    const chaseStrength = 0.3;

    const playerStore = useGameStore.getState();
    const scene = groupRef.current.parent;
    let playerPos: THREE.Vector3 | null = null;

    if (scene) {
      scene.traverse((child: any) => {
        if (child !== groupRef.current && child.type === 'Group' && child.children?.[0]?.type === 'Group') {
          playerPos = child.position.clone();
        }
      });
    }

    if (playerPos) {
      const toPlayer = new THREE.Vector3(
        playerPos.x - state.boss.x,
        playerPos.y - state.boss.y,
        playerPos.z - state.boss.z
      ).normalize();
      dirRef.current.lerp(toPlayer, chaseStrength * delta);
      dirRef.current.normalize();
    }

    const newX = state.boss.x + dirRef.current.x * speed * delta;
    const newY = state.boss.y + dirRef.current.y * speed * delta;
    const newZ = state.boss.z + dirRef.current.z * speed * delta;

    const half = WORLD_SIZE / 2 - 5;
    const clampedX = Math.max(-half, Math.min(half, newX));
    const clampedY = Math.max(OCEAN_FLOOR_Y + 2, Math.min(OCEAN_FLOOR_Y + WORLD_DEPTH - 3, newY));
    const clampedZ = Math.max(-half, Math.min(half, newZ));

    state.setBoss({ ...state.boss, x: clampedX, y: clampedY, z: clampedZ });
    groupRef.current.position.set(clampedX, clampedY, clampedZ);

    const angle = Math.atan2(dirRef.current.x, dirRef.current.z);
    groupRef.current.rotation.y = angle;
  });

  if (!boss?.alive) return null;

  return (
    <group ref={groupRef} position={[boss.x, boss.y, boss.z]} scale={[2, 2, 2]}>
      <SharkModel />
    </group>
  );
}
