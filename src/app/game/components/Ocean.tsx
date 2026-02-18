'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WORLD_SIZE, OCEAN_FLOOR_Y, WORLD_DEPTH } from '../lib/gameConfig';

function OceanFloor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, OCEAN_FLOOR_Y, 0]} receiveShadow>
      <planeGeometry args={[WORLD_SIZE, WORLD_SIZE, 32, 32]} />
      <meshStandardMaterial color="#c2b280" roughness={0.95} metalness={0.0} />
    </mesh>
  );
}

function Seaweed() {
  const seaweeds = useMemo(() => {
    const arr: { x: number; z: number; height: number; offset: number }[] = [];
    for (let i = 0; i < 40; i++) {
      arr.push({
        x: (Math.random() - 0.5) * WORLD_SIZE * 0.6,
        z: (Math.random() - 0.5) * WORLD_SIZE * 0.6,
        height: 1 + Math.random() * 3,
        offset: Math.random() * Math.PI * 2,
      });
    }
    return arr;
  }, []);

  return (
    <>
      {seaweeds.map((sw, i) => (
        <SeaweedStrand key={i} x={sw.x} z={sw.z} height={sw.height} offset={sw.offset} />
      ))}
    </>
  );
}

function SeaweedStrand({ x, z, height, offset }: { x: number; z: number; height: number; offset: number }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    meshRef.current.rotation.z = Math.sin(t * 0.8 + offset) * 0.15;
  });

  return (
    <mesh ref={meshRef} position={[x, OCEAN_FLOOR_Y + height / 2, z]}>
      <boxGeometry args={[0.15, height, 0.15]} />
      <meshStandardMaterial color="#27ae60" roughness={0.7} />
    </mesh>
  );
}

function CausticLight() {
  const lightRef = useRef<THREE.DirectionalLight>(null);

  useFrame(({ clock }) => {
    if (!lightRef.current) return;
    const t = clock.getElapsedTime();
    lightRef.current.position.x = Math.sin(t * 0.3) * 10;
    lightRef.current.position.z = Math.cos(t * 0.2) * 10;
    lightRef.current.intensity = 1.2 + Math.sin(t * 1.5) * 0.3;
  });

  return <directionalLight ref={lightRef} position={[5, 30, 5]} intensity={1.2} color="#87ceeb" />;
}

function Bubbles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const count = 50;

  const bubbles = useMemo(() => {
    const arr: { x: number; z: number; speed: number; offset: number; yBase: number; size: number }[] = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        x: (Math.random() - 0.5) * WORLD_SIZE * 0.5,
        z: (Math.random() - 0.5) * WORLD_SIZE * 0.5,
        speed: 0.5 + Math.random() * 1.5,
        offset: Math.random() * WORLD_DEPTH,
        yBase: OCEAN_FLOOR_Y,
        size: 0.1 + Math.random() * 0.2,
      });
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();

    bubbles.forEach((b, i) => {
      const y = b.yBase + ((t * b.speed + b.offset) % WORLD_DEPTH);
      dummy.position.set(
        b.x + Math.sin(t + b.offset) * 0.5,
        y,
        b.z + Math.cos(t + b.offset) * 0.5
      );
      dummy.scale.setScalar(b.size);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color="#e0f7fa" transparent opacity={0.4} />
    </instancedMesh>
  );
}

function Rocks() {
  const rocks = useMemo(() => {
    const arr: { x: number; z: number; scale: [number, number, number]; rotation: number }[] = [];
    for (let i = 0; i < 20; i++) {
      arr.push({
        x: (Math.random() - 0.5) * WORLD_SIZE * 0.5,
        z: (Math.random() - 0.5) * WORLD_SIZE * 0.5,
        scale: [0.5 + Math.random() * 1.5, 0.3 + Math.random() * 0.8, 0.5 + Math.random() * 1.5],
        rotation: Math.random() * Math.PI,
      });
    }
    return arr;
  }, []);

  return (
    <>
      {rocks.map((r, i) => (
        <mesh key={i} position={[r.x, OCEAN_FLOOR_Y + r.scale[1] * 0.4, r.z]} rotation={[0, r.rotation, 0]} scale={r.scale}>
          <dodecahedronGeometry args={[0.5, 0]} />
          <meshStandardMaterial color="#5d6d7e" roughness={0.9} />
        </mesh>
      ))}
    </>
  );
}

export default function Ocean() {
  return (
    <>
      <ambientLight intensity={0.6} color="#b3e5fc" />
      <CausticLight />
      <pointLight position={[0, 15, 0]} intensity={1} color="#81d4fa" distance={80} />
      <OceanFloor />
      <Bubbles />
      <Seaweed />
      <Rocks />
    </>
  );
}
