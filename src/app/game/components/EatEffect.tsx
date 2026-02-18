'use client';

import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
}

function EatParticles({ position, color }: { position: [number, number, number]; color: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const particlesRef = useRef<Particle[]>([]);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const particles: Particle[] = [];
    for (let i = 0; i < 8; i++) {
      particles.push({
        position: new THREE.Vector3(...position),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 3
        ),
        life: 0.5 + Math.random() * 0.3,
      });
    }
    particlesRef.current = particles;
  }, [position]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    let anyAlive = false;
    const children = groupRef.current.children;

    particlesRef.current.forEach((p, i) => {
      p.life -= delta;
      if (p.life <= 0) return;
      anyAlive = true;

      p.position.add(p.velocity.clone().multiplyScalar(delta));
      p.velocity.multiplyScalar(0.95);

      const mesh = children[i] as THREE.Mesh;
      if (mesh) {
        mesh.position.copy(p.position);
        mesh.scale.setScalar(p.life * 2);
        (mesh.material as THREE.MeshBasicMaterial).opacity = p.life * 2;
      }
    });

    if (!anyAlive) {
      setVisible(false);
    }
  });

  if (!visible) return null;

  return (
    <group ref={groupRef}>
      {particlesRef.current.map((_, i) => (
        <mesh key={i} position={position}>
          <sphereGeometry args={[0.1, 6, 6]} />
          <meshBasicMaterial color={color} transparent opacity={1} />
        </mesh>
      ))}
    </group>
  );
}

interface EatEffectData {
  id: string;
  position: [number, number, number];
  color: string;
}

const eatEffects: EatEffectData[] = [];
let effectId = 0;

export function triggerEatEffect(x: number, y: number, z: number, color: string) {
  eatEffects.push({
    id: `eat-${effectId++}`,
    position: [x, y, z],
    color,
  });
  if (eatEffects.length > 10) {
    eatEffects.shift();
  }
}

export default function EatEffects() {
  const [effects, setEffects] = useState<EatEffectData[]>([]);
  const timerRef = useRef(0);

  useFrame((_, delta) => {
    timerRef.current += delta;
    if (timerRef.current > 0.1) {
      timerRef.current = 0;
      if (eatEffects.length > 0) {
        setEffects([...eatEffects]);
      }
    }
  });

  return (
    <>
      {effects.map((e) => (
        <EatParticles key={e.id} position={e.position} color={e.color} />
      ))}
    </>
  );
}
