'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore, GameItem } from '../lib/useGameStore';

const ITEM_COLORS: Record<string, string> = {
  speed: '#ffdd00',
  magnet: '#aa44ff',
  shield: '#44aaff',
  exp2x: '#44ff44',
};

function ItemGeo({ type }: { type: string }) {
  switch (type) {
    case 'speed': return <octahedronGeometry args={[0.35, 0]} />;
    case 'magnet': return <sphereGeometry args={[0.35, 8, 8]} />;
    case 'shield': return <octahedronGeometry args={[0.4, 0]} />;
    case 'exp2x': return <dodecahedronGeometry args={[0.35, 0]} />;
    default: return <sphereGeometry args={[0.35, 8, 8]} />;
  }
}

function ItemMesh({ item }: { item: GameItem }) {
  const ref = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.rotation.y = t * 2;
    ref.current.position.y = item.y + Math.sin(t * 3) * 0.3;
  });

  const color = ITEM_COLORS[item.type];

  return (
    <group ref={ref} position={[item.x, item.y, item.z]}>
      <mesh>
        <ItemGeo type={item.type} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} roughness={0.2} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.55, 8, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} />
      </mesh>
      <pointLight color={color} intensity={1} distance={5} />
    </group>
  );
}

export default function Items() {
  const items = useGameStore((s) => s.items);
  const isStarted = useGameStore((s) => s.isStarted);
  const isGameOver = useGameStore((s) => s.isGameOver);
  const isCleared = useGameStore((s) => s.isCleared);

  if (!isStarted || isGameOver || isCleared) return null;

  return (
    <>
      {items.map((item) => (
        <ItemMesh key={item.id} item={item} />
      ))}
    </>
  );
}
