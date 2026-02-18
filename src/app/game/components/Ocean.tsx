'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WORLD_SIZE, OCEAN_FLOOR_Y, WORLD_DEPTH } from '../lib/gameConfig';

const SURFACE_Y = OCEAN_FLOOR_Y + WORLD_DEPTH;

function OceanFloor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, OCEAN_FLOOR_Y, 0]} receiveShadow>
      <planeGeometry args={[WORLD_SIZE, WORLD_SIZE, 32, 32]} />
      <meshStandardMaterial color="#c2b280" roughness={0.95} metalness={0.0} />
    </mesh>
  );
}

function SeaweedStrand({ x, z, height, offset }: { x: number; z: number; height: number; offset: number }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.z = Math.sin(clock.getElapsedTime() * 0.8 + offset) * 0.15;
  });

  return (
    <mesh ref={meshRef} position={[x, OCEAN_FLOOR_Y + height / 2, z]}>
      <boxGeometry args={[0.15, height, 0.15]} />
      <meshStandardMaterial color="#27ae60" roughness={0.7} />
    </mesh>
  );
}

function Seaweed() {
  const seaweeds = useMemo(() =>
    Array.from({ length: 40 }, () => ({
      x: (Math.random() - 0.5) * WORLD_SIZE * 0.6,
      z: (Math.random() - 0.5) * WORLD_SIZE * 0.6,
      height: 1 + Math.random() * 3,
      offset: Math.random() * Math.PI * 2,
    })), []);

  return (
    <>
      {seaweeds.map((sw, i) => (
        <SeaweedStrand key={i} x={sw.x} z={sw.z} height={sw.height} offset={sw.offset} />
      ))}
    </>
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

  const bubbles = useMemo(() =>
    Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * WORLD_SIZE * 0.5,
      z: (Math.random() - 0.5) * WORLD_SIZE * 0.5,
      speed: 0.5 + Math.random() * 1.5,
      offset: Math.random() * WORLD_DEPTH,
      size: 0.1 + Math.random() * 0.2,
    })), []);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    bubbles.forEach((b, i) => {
      const y = OCEAN_FLOOR_Y + ((t * b.speed + b.offset) % WORLD_DEPTH);
      dummy.position.set(b.x + Math.sin(t + b.offset) * 0.5, y, b.z + Math.cos(t + b.offset) * 0.5);
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
  const rocks = useMemo(() =>
    Array.from({ length: 20 }, () => ({
      x: (Math.random() - 0.5) * WORLD_SIZE * 0.5,
      z: (Math.random() - 0.5) * WORLD_SIZE * 0.5,
      scale: [0.5 + Math.random() * 1.5, 0.3 + Math.random() * 0.8, 0.5 + Math.random() * 1.5] as [number, number, number],
      rotation: Math.random() * Math.PI,
    })), []);

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

function CoralFormations() {
  const corals = useMemo(() => {
    const palette = ['#ff6b6b', '#ff9ff3', '#feca57', '#ff6348', '#ee5a24', '#e056fd', '#ff7979'];
    return Array.from({ length: 15 }, () => {
      const branchCount = 2 + Math.floor(Math.random() * 4);
      const baseH = 0.8 + Math.random() * 1.5;
      const color = palette[Math.floor(Math.random() * palette.length)];
      return {
        x: (Math.random() - 0.5) * WORLD_SIZE * 0.55,
        z: (Math.random() - 0.5) * WORLD_SIZE * 0.55,
        color,
        branches: Array.from({ length: branchCount }, (_, j) => {
          const a = (j / branchCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
          return { angle: a, h: baseH * (0.5 + Math.random() * 0.5), lean: (Math.random() - 0.5) * 0.3, rad: 0.04 + Math.random() * 0.06 };
        }),
      };
    });
  }, []);

  return (
    <>
      {corals.map((c, i) => (
        <group key={i} position={[c.x, OCEAN_FLOOR_Y, c.z]}>
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.25, 0.35, 0.2, 8]} />
            <meshStandardMaterial color={c.color} roughness={0.5} />
          </mesh>
          {c.branches.map((b, j) => (
            <group key={j}>
              <mesh position={[Math.cos(b.angle) * 0.15, b.h / 2 + 0.2, Math.sin(b.angle) * 0.15]} rotation={[0, 0, b.lean]}>
                <cylinderGeometry args={[b.rad * 0.6, b.rad, b.h, 6]} />
                <meshStandardMaterial color={c.color} roughness={0.4} />
              </mesh>
              <mesh position={[Math.cos(b.angle) * 0.15, b.h + 0.25, Math.sin(b.angle) * 0.15]}>
                <sphereGeometry args={[b.rad + 0.04, 6, 6]} />
                <meshStandardMaterial color={c.color} roughness={0.3} emissive={c.color} emissiveIntensity={0.15} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </>
  );
}

function Starfish() {
  const starfish = useMemo(() => {
    const colors = ['#ff6348', '#f0932b', '#eb4d4b', '#9b59b6', '#e17055'];
    return Array.from({ length: 20 }, () => ({
      x: (Math.random() - 0.5) * WORLD_SIZE * 0.55,
      z: (Math.random() - 0.5) * WORLD_SIZE * 0.55,
      rot: Math.random() * Math.PI * 2,
      scale: 0.2 + Math.random() * 0.25,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
  }, []);

  return (
    <>
      {starfish.map((s, i) => (
        <group key={i} position={[s.x, OCEAN_FLOOR_Y + 0.03, s.z]} rotation={[-Math.PI / 2, 0, s.rot]}>
          {[0, 1, 2, 3, 4].map((arm) => (
            <mesh key={arm} position={[Math.cos((arm / 5) * Math.PI * 2) * s.scale * 0.6, Math.sin((arm / 5) * Math.PI * 2) * s.scale * 0.6, 0]}
              rotation={[0, 0, (arm / 5) * Math.PI * 2]}>
              <boxGeometry args={[s.scale * 0.25, s.scale * 0.8, s.scale * 0.08]} />
              <meshStandardMaterial color={s.color} roughness={0.6} />
            </mesh>
          ))}
          <mesh>
            <cylinderGeometry args={[s.scale * 0.2, s.scale * 0.2, s.scale * 0.06, 8]} />
            <meshStandardMaterial color={s.color} roughness={0.6} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function SeaShells() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const count = 20;

  const shells = useMemo(() =>
    Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * WORLD_SIZE * 0.5,
      z: (Math.random() - 0.5) * WORLD_SIZE * 0.5,
      rot: Math.random() * Math.PI * 2,
      scale: 0.15 + Math.random() * 0.2,
    })), []);

  const initialized = useRef(false);

  useFrame(() => {
    if (!meshRef.current || initialized.current) return;
    shells.forEach((s, i) => {
      dummy.position.set(s.x, OCEAN_FLOOR_Y + s.scale * 0.3, s.z);
      dummy.rotation.set(0.2, s.rot, 0);
      dummy.scale.set(s.scale, s.scale * 0.6, s.scale);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    initialized.current = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshStandardMaterial color="#f5e6ca" roughness={0.5} metalness={0.15} side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

function Caves() {
  const caves = useMemo(() =>
    Array.from({ length: 4 }, () => ({
      x: (Math.random() - 0.5) * WORLD_SIZE * 0.4,
      z: (Math.random() - 0.5) * WORLD_SIZE * 0.4,
      rot: Math.random() * Math.PI * 2,
      scale: 2 + Math.random() * 2,
    })), []);

  return (
    <>
      {caves.map((c, i) => (
        <group key={i} position={[c.x, OCEAN_FLOOR_Y, c.z]} rotation={[0, c.rot, 0]}>
          <mesh position={[0, c.scale * 0.35, 0]}>
            <sphereGeometry args={[c.scale, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#3d3d3d" roughness={0.95} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, c.scale * 0.02, c.scale * 0.6]}>
            <sphereGeometry args={[c.scale * 0.45, 10, 10]} />
            <meshStandardMaterial color="#1a1a2e" roughness={1} />
          </mesh>
          <pointLight position={[0, c.scale * 0.3, c.scale * 0.3]} intensity={0.3} color="#4a69bd" distance={c.scale * 3} />
        </group>
      ))}
    </>
  );
}

function HydrothermalVents() {
  const vents = useMemo(() =>
    Array.from({ length: 3 }, () => ({
      x: (Math.random() - 0.5) * WORLD_SIZE * 0.35,
      z: (Math.random() - 0.5) * WORLD_SIZE * 0.35,
      scale: 0.6 + Math.random() * 0.6,
    })), []);

  return (
    <>
      {vents.map((v, i) => (
        <group key={i} position={[v.x, OCEAN_FLOOR_Y, v.z]}>
          <mesh position={[0, v.scale * 0.5, 0]}>
            <coneGeometry args={[v.scale * 0.5, v.scale, 8]} />
            <meshStandardMaterial color="#2c2c34" roughness={0.9} />
          </mesh>
          <mesh position={[0, v.scale * 0.8, 0]}>
            <cylinderGeometry args={[v.scale * 0.15, v.scale * 0.25, v.scale * 0.3, 8]} />
            <meshStandardMaterial color="#444" roughness={0.85} />
          </mesh>
          <VentBubbles x={v.x} z={v.z} baseY={OCEAN_FLOOR_Y + v.scale} scale={v.scale} />
          <pointLight position={[0, v.scale * 0.6, 0]} intensity={0.5} color="#ff6b35" distance={v.scale * 4} />
        </group>
      ))}
    </>
  );
}

function VentBubbles({ x, z, baseY, scale }: { x: number; z: number; baseY: number; scale: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const count = 12;

  const particles = useMemo(() =>
    Array.from({ length: count }, () => ({
      offsetX: (Math.random() - 0.5) * scale * 0.3,
      offsetZ: (Math.random() - 0.5) * scale * 0.3,
      speed: 1 + Math.random() * 2,
      phase: Math.random() * 10,
      size: 0.06 + Math.random() * 0.1,
    })), [scale]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    particles.forEach((p, i) => {
      const y = baseY + ((t * p.speed + p.phase) % 6);
      dummy.position.set(x + p.offsetX + Math.sin(t * 2 + p.phase) * 0.1, y, z + p.offsetZ);
      dummy.scale.setScalar(p.size * (1 - ((t * p.speed + p.phase) % 6) / 8));
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color="#ffad76" transparent opacity={0.5} />
    </instancedMesh>
  );
}

function WaterSurface() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.opacity = 0.25 + Math.sin(clock.getElapsedTime() * 0.5) * 0.05;
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, SURFACE_Y, 0]}>
      <planeGeometry args={[WORLD_SIZE, WORLD_SIZE, 1, 1]} />
      <meshStandardMaterial color="#87ceeb" transparent opacity={0.25} roughness={0.1} metalness={0.3} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Sun() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.6 + Math.sin(clock.getElapsedTime() * 0.3) * 0.1;
  });

  return (
    <group position={[20, SURFACE_Y + 30, -15]}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[8, 16, 16]} />
        <meshBasicMaterial color="#fff5cc" transparent opacity={0.6} />
      </mesh>
      <mesh>
        <sphereGeometry args={[5, 16, 16]} />
        <meshBasicMaterial color="#ffffee" />
      </mesh>
      <directionalLight position={[0, 0, 0]} intensity={0.8} color="#fff8e7" />
    </group>
  );
}

function Clouds() {
  const clouds = useMemo(() =>
    Array.from({ length: 7 }, () => ({
      x: (Math.random() - 0.5) * WORLD_SIZE * 0.8,
      z: (Math.random() - 0.5) * WORLD_SIZE * 0.8,
      y: SURFACE_Y + 8 + Math.random() * 15,
      scaleX: 4 + Math.random() * 8,
      scaleY: 1.5 + Math.random() * 2,
      scaleZ: 3 + Math.random() * 5,
      speed: 0.2 + Math.random() * 0.4,
      dir: Math.random() > 0.5 ? 1 : -1,
    })), []);

  const refs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    clouds.forEach((c, i) => {
      const mesh = refs.current[i];
      if (!mesh) return;
      mesh.position.x = c.x + Math.sin(t * c.speed * 0.1) * 10 * c.dir;
      mesh.position.z = c.z + Math.cos(t * c.speed * 0.08) * 5;
    });
  });

  return (
    <>
      {clouds.map((c, i) => (
        <mesh
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          position={[c.x, c.y, c.z]}
          scale={[c.scaleX, c.scaleY, c.scaleZ]}
        >
          <sphereGeometry args={[1, 8, 6]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.35} />
        </mesh>
      ))}
    </>
  );
}

function LightRays() {
  const rays = useMemo(() =>
    Array.from({ length: 6 }, () => ({
      x: (Math.random() - 0.5) * WORLD_SIZE * 0.4,
      z: (Math.random() - 0.5) * WORLD_SIZE * 0.4,
      width: 0.5 + Math.random() * 1.5,
      phase: Math.random() * Math.PI * 2,
    })), []);

  const refs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    rays.forEach((r, i) => {
      const mesh = refs.current[i];
      if (!mesh) return;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.03 + Math.sin(t * 0.5 + r.phase) * 0.02;
    });
  });

  const midY = OCEAN_FLOOR_Y + WORLD_DEPTH / 2;
  return (
    <>
      {rays.map((r, i) => (
        <mesh
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          position={[r.x, midY, r.z]}
          rotation={[0, 0, (Math.random() - 0.5) * 0.15]}
        >
          <planeGeometry args={[r.width, WORLD_DEPTH]} />
          <meshBasicMaterial color="#ffffcc" transparent opacity={0.04} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  );
}

export default function Ocean() {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.6} color="#b3e5fc" />
      <CausticLight />
      <pointLight position={[0, 15, 0]} intensity={1} color="#81d4fa" distance={80} />

      {/* Sky / Surface */}
      <Sun />
      <Clouds />
      <WaterSurface />
      <LightRays />

      {/* Floor */}
      <OceanFloor />

      {/* Floor decorations */}
      <Seaweed />
      <Rocks />
      <CoralFormations />
      <Starfish />
      <SeaShells />
      <Caves />
      <HydrothermalVents />

      {/* Particles */}
      <Bubbles />
    </>
  );
}
