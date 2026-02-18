'use client';

import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface EvolveParticle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
}

function EvolveParticles({ origin, color }: { origin: [number, number, number]; color: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const particles = useRef<EvolveParticle[]>([]);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const arr: EvolveParticle[] = [];
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const speed = 2 + Math.random() * 3;
      arr.push({
        pos: new THREE.Vector3(...origin),
        vel: new THREE.Vector3(
          Math.cos(angle) * speed * (0.5 + Math.random()),
          (Math.random() - 0.3) * speed,
          Math.sin(angle) * speed * (0.5 + Math.random())
        ),
        life: 1.0 + Math.random() * 0.5,
      });
    }
    particles.current = arr;
  }, [origin]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    let any = false;
    const children = groupRef.current.children;
    particles.current.forEach((p, i) => {
      p.life -= delta;
      if (p.life <= 0) return;
      any = true;
      p.pos.add(p.vel.clone().multiplyScalar(delta));
      p.vel.multiplyScalar(0.96);
      const mesh = children[i] as THREE.Mesh;
      if (mesh) {
        mesh.position.copy(p.pos);
        const s = p.life * 0.3;
        mesh.scale.setScalar(s);
        (mesh.material as THREE.MeshBasicMaterial).opacity = p.life;
      }
    });
    if (!any) setVisible(false);
  });

  if (!visible) return null;

  return (
    <group ref={groupRef}>
      {particles.current.map((_, i) => (
        <mesh key={i} position={origin}>
          <sphereGeometry args={[0.15, 6, 6]} />
          <meshBasicMaterial color={color} transparent opacity={1} />
        </mesh>
      ))}
    </group>
  );
}

interface EffectData {
  id: number;
  origin: [number, number, number];
  color: string;
}

let _evolveEffects: EffectData[] = [];
let _evolveId = 0;

export function triggerEvolveEffect(x: number, y: number, z: number, color: string) {
  _evolveEffects.push({ id: _evolveId++, origin: [x, y, z], color });
  if (_evolveEffects.length > 5) _evolveEffects.shift();
}

export default function EvolveEffects() {
  const [effects, setEffects] = useState<EffectData[]>([]);
  const timerRef = useRef(0);

  useFrame((_, delta) => {
    timerRef.current += delta;
    if (timerRef.current > 0.1) {
      timerRef.current = 0;
      if (_evolveEffects.length > 0) {
        setEffects([..._evolveEffects]);
      }
    }
  });

  return (
    <>
      {effects.map((e) => (
        <EvolveParticles key={e.id} origin={e.origin} color={e.color} />
      ))}
    </>
  );
}
