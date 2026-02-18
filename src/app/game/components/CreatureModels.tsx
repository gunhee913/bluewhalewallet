'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function PlanktonModel({ scale = 1 }: { scale?: number }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    groupRef.current.rotation.y = Math.sin(t * 2) * 0.5;
    groupRef.current.rotation.z = Math.cos(t * 3) * 0.3;
  });

  return (
    <group scale={scale} ref={groupRef}>
      <mesh>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshStandardMaterial color="#7fff7f" transparent opacity={0.9} roughness={0.2} emissive="#7fff7f" emissiveIntensity={0.6} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.42, 8, 8]} />
        <meshStandardMaterial color="#7fff7f" transparent opacity={0.15} emissive="#7fff7f" emissiveIntensity={0.4} />
      </mesh>
      {[0, 1.05, 2.1, 3.15, 4.2, 5.25].map((angle, i) => (
        <mesh key={i} position={[Math.cos(angle) * 0.3, Math.sin(angle) * 0.3, 0]} rotation={[0, 0, angle]}>
          <planeGeometry args={[0.25, 0.06]} />
          <meshStandardMaterial color="#4eff4e" transparent opacity={0.7} side={THREE.DoubleSide} emissive="#4eff4e" emissiveIntensity={0.3} />
        </mesh>
      ))}
    </group>
  );
}

function KrillModel({ scale = 1 }: { scale?: number }) {
  const tailRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!tailRef.current) return;
    tailRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 8) * 0.3;
  });

  return (
    <group scale={scale} rotation={[0, 0, 0]}>
      {/* Body segments */}
      <mesh position={[0, 0, 0]}>
        <capsuleGeometry args={[0.12, 0.4, 8, 16]} />
        <meshStandardMaterial color="#ff7675" roughness={0.3} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0, -0.25]}>
        <capsuleGeometry args={[0.1, 0.2, 8, 16]} />
        <meshStandardMaterial color="#fab1a0" roughness={0.3} metalness={0.1} />
      </mesh>
      {/* Tail */}
      <group ref={tailRef} position={[0, 0, -0.45]}>
        <mesh position={[0, 0, -0.1]}>
          <coneGeometry args={[0.08, 0.25, 8]} />
          <meshStandardMaterial color="#e17055" roughness={0.3} />
        </mesh>
        <mesh position={[0.06, 0, -0.2]} rotation={[0, 0, 0.5]}>
          <planeGeometry args={[0.12, 0.06]} />
          <meshStandardMaterial color="#e17055" side={THREE.DoubleSide} transparent opacity={0.8} />
        </mesh>
        <mesh position={[-0.06, 0, -0.2]} rotation={[0, 0, -0.5]}>
          <planeGeometry args={[0.12, 0.06]} />
          <meshStandardMaterial color="#e17055" side={THREE.DoubleSide} transparent opacity={0.8} />
        </mesh>
      </group>
      {/* Antennae */}
      <mesh position={[0.04, 0.02, 0.3]} rotation={[0.3, 0.2, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.3, 4]} />
        <meshStandardMaterial color="#d63031" />
      </mesh>
      <mesh position={[-0.04, 0.02, 0.3]} rotation={[0.3, -0.2, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.3, 4]} />
        <meshStandardMaterial color="#d63031" />
      </mesh>
      {/* Eyes */}
      <mesh position={[0.06, 0.06, 0.15]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#2d3436" />
      </mesh>
      <mesh position={[-0.06, 0.06, 0.15]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#2d3436" />
      </mesh>
      {/* Legs */}
      {[-0.15, -0.05, 0.05, 0.15].map((z, i) => (
        <group key={i}>
          <mesh position={[0.08, -0.1, z]} rotation={[0, 0, 0.4]}>
            <cylinderGeometry args={[0.008, 0.005, 0.12, 4]} />
            <meshStandardMaterial color="#fab1a0" />
          </mesh>
          <mesh position={[-0.08, -0.1, z]} rotation={[0, 0, -0.4]}>
            <cylinderGeometry args={[0.008, 0.005, 0.12, 4]} />
            <meshStandardMaterial color="#fab1a0" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function ClamModel({ scale = 1 }: { scale?: number }) {
  const topRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!topRef.current) return;
    topRef.current.rotation.x = -0.15 + Math.sin(clock.getElapsedTime() * 2) * 0.08;
  });

  return (
    <group scale={scale}>
      {/* Bottom shell */}
      <mesh rotation={[0.1, 0, 0]}>
        <sphereGeometry args={[0.3, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#f0c27a" roughness={0.5} metalness={0.15} />
      </mesh>
      {/* Top shell */}
      <mesh ref={topRef} rotation={[-0.15, 0, 0]}>
        <sphereGeometry args={[0.3, 16, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial color="#dda15e" roughness={0.5} metalness={0.15} />
      </mesh>
      {/* Interior */}
      <mesh position={[0, 0.02, 0.05]}>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial color="#ffeaa7" roughness={0.2} />
      </mesh>
      {/* Eyes */}
      <mesh position={[0.06, 0.08, 0.2]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial color="#2d3436" />
      </mesh>
      <mesh position={[-0.06, 0.08, 0.2]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial color="#2d3436" />
      </mesh>
    </group>
  );
}

function ShellModel({ scale = 1 }: { scale?: number }) {
  return (
    <group scale={scale}>
      {/* Spiral shell body */}
      <mesh>
        <coneGeometry args={[0.3, 0.6, 16]} />
        <meshStandardMaterial color="#a0855b" roughness={0.4} metalness={0.2} />
      </mesh>
      {/* Shell spiral ridges */}
      <mesh position={[0, -0.1, 0]} rotation={[0, 0.5, 0]}>
        <torusGeometry args={[0.25, 0.04, 8, 16]} />
        <meshStandardMaterial color="#8d6e3f" roughness={0.4} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation={[0, 1.0, 0]}>
        <torusGeometry args={[0.2, 0.035, 8, 16]} />
        <meshStandardMaterial color="#8d6e3f" roughness={0.4} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.18, 0]} rotation={[0, 1.5, 0]}>
        <torusGeometry args={[0.12, 0.03, 8, 16]} />
        <meshStandardMaterial color="#8d6e3f" roughness={0.4} metalness={0.2} />
      </mesh>
      {/* Snail body */}
      <mesh position={[0.15, -0.3, 0.15]}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshStandardMaterial color="#7fad71" roughness={0.4} />
      </mesh>
      {/* Eye stalks */}
      <mesh position={[0.2, -0.18, 0.2]} rotation={[0, 0, -0.3]}>
        <cylinderGeometry args={[0.015, 0.015, 0.15, 6]} />
        <meshStandardMaterial color="#7fad71" />
      </mesh>
      <mesh position={[0.1, -0.18, 0.22]} rotation={[0, 0, -0.3]}>
        <cylinderGeometry args={[0.015, 0.015, 0.15, 6]} />
        <meshStandardMaterial color="#7fad71" />
      </mesh>
      <mesh position={[0.22, -0.1, 0.21]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#2d3436" />
      </mesh>
      <mesh position={[0.12, -0.1, 0.23]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshStandardMaterial color="#2d3436" />
      </mesh>
    </group>
  );
}

function PearlModel({ scale = 1 }: { scale?: number }) {
  const topRef = useRef<THREE.Mesh>(null);
  const pearlRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (topRef.current) {
      topRef.current.rotation.x = -0.3 + Math.sin(clock.getElapsedTime() * 1.5) * 0.1;
    }
    if (pearlRef.current) {
      pearlRef.current.position.y = 0.08 + Math.sin(clock.getElapsedTime() * 3) * 0.02;
    }
  });

  return (
    <group scale={scale}>
      {/* Bottom shell */}
      <mesh rotation={[0.15, 0, 0]}>
        <sphereGeometry args={[0.35, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#a97ec4" roughness={0.3} metalness={0.3} />
      </mesh>
      {/* Top shell */}
      <mesh ref={topRef} rotation={[-0.3, 0, 0]}>
        <sphereGeometry args={[0.35, 16, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial color="#c39bd3" roughness={0.3} metalness={0.3} />
      </mesh>
      {/* Interior */}
      <mesh position={[0, 0.01, 0]}>
        <sphereGeometry args={[0.22, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#f5b7b1" roughness={0.2} />
      </mesh>
      {/* Pearl */}
      <mesh ref={pearlRef} position={[0, 0.08, 0]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial color="#fdfefe" roughness={0.05} metalness={0.6} emissive="#fdfefe" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

function CoralModel({ scale = 1 }: { scale?: number }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.5) * 0.05;
  });

  return (
    <group scale={scale} ref={groupRef}>
      {/* Base */}
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[0.25, 0.35, 0.15, 12]} />
        <meshStandardMaterial color="#e74c3c" roughness={0.5} />
      </mesh>
      {/* Main branches */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.06, 0.12, 0.55, 8]} />
        <meshStandardMaterial color="#ff6b6b" roughness={0.4} />
      </mesh>
      <mesh position={[0.15, 0.1, 0.05]} rotation={[0, 0, -0.3]}>
        <cylinderGeometry args={[0.04, 0.08, 0.45, 8]} />
        <meshStandardMaterial color="#fc5c65" roughness={0.4} />
      </mesh>
      <mesh position={[-0.12, 0.12, -0.05]} rotation={[0, 0, 0.25]}>
        <cylinderGeometry args={[0.04, 0.08, 0.4, 8]} />
        <meshStandardMaterial color="#eb3b5a" roughness={0.4} />
      </mesh>
      <mesh position={[0.05, 0.08, 0.12]} rotation={[0.3, 0, -0.15]}>
        <cylinderGeometry args={[0.035, 0.07, 0.35, 8]} />
        <meshStandardMaterial color="#fc5c65" roughness={0.4} />
      </mesh>
      {/* Branch tips */}
      {[
        [0, 0.45, 0],
        [0.22, 0.35, 0.07],
        [-0.18, 0.35, -0.07],
        [0.08, 0.28, 0.18],
        [0.12, 0.42, -0.04],
        [-0.08, 0.4, 0.06],
      ].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <sphereGeometry args={[0.05 + Math.random() * 0.03, 8, 8]} />
          <meshStandardMaterial color="#ff9ff3" roughness={0.3} emissive="#ff6b6b" emissiveIntensity={0.1} />
        </mesh>
      ))}
      {/* Eyes on base */}
      <mesh position={[0.08, -0.1, 0.24]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color="#2d3436" />
      </mesh>
      <mesh position={[-0.08, -0.1, 0.24]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color="#2d3436" />
      </mesh>
    </group>
  );
}

function DolphinModel({ scale = 1 }: { scale?: number }) {
  const tailRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (tailRef.current) {
      tailRef.current.rotation.y = Math.sin(t * 6) * 0.25;
    }
    if (bodyRef.current) {
      bodyRef.current.rotation.z = Math.sin(t * 3) * 0.03;
    }
  });

  return (
    <group scale={scale} ref={bodyRef}>
      {/* Main body */}
      <mesh rotation={[0, 0, 0]}>
        <capsuleGeometry args={[0.2, 0.7, 12, 24]} />
        <meshStandardMaterial color="#636e72" roughness={0.3} metalness={0.2} />
      </mesh>
      {/* Belly */}
      <mesh position={[0, -0.05, 0.05]} rotation={[0.1, 0, 0]}>
        <capsuleGeometry args={[0.15, 0.5, 10, 20]} />
        <meshStandardMaterial color="#dfe6e9" roughness={0.3} metalness={0.1} />
      </mesh>
      {/* Snout */}
      <mesh position={[0, -0.02, 0.5]} rotation={[-0.1, 0, 0]}>
        <coneGeometry args={[0.1, 0.35, 12]} />
        <meshStandardMaterial color="#636e72" roughness={0.3} />
      </mesh>
      {/* Dorsal fin */}
      <mesh position={[0, 0.28, -0.05]} rotation={[0.3, 0, 0]}>
        <coneGeometry args={[0.12, 0.25, 8]} />
        <meshStandardMaterial color="#535c68" roughness={0.3} />
      </mesh>
      {/* Pectoral fins */}
      <mesh position={[0.2, -0.1, 0.1]} rotation={[0, 0.3, -0.8]}>
        <coneGeometry args={[0.08, 0.25, 6]} />
        <meshStandardMaterial color="#636e72" roughness={0.3} />
      </mesh>
      <mesh position={[-0.2, -0.1, 0.1]} rotation={[0, -0.3, 0.8]}>
        <coneGeometry args={[0.08, 0.25, 6]} />
        <meshStandardMaterial color="#636e72" roughness={0.3} />
      </mesh>
      {/* Tail */}
      <group ref={tailRef} position={[0, 0, -0.55]}>
        <mesh>
          <cylinderGeometry args={[0.08, 0.14, 0.2, 8]} />
          <meshStandardMaterial color="#636e72" roughness={0.3} />
        </mesh>
        <mesh position={[0.12, 0, -0.1]} rotation={[0, 0.4, 0]}>
          <planeGeometry args={[0.22, 0.1]} />
          <meshStandardMaterial color="#535c68" side={THREE.DoubleSide} roughness={0.3} />
        </mesh>
        <mesh position={[-0.12, 0, -0.1]} rotation={[0, -0.4, 0]}>
          <planeGeometry args={[0.22, 0.1]} />
          <meshStandardMaterial color="#535c68" side={THREE.DoubleSide} roughness={0.3} />
        </mesh>
      </group>
      {/* Eyes */}
      <mesh position={[0.15, 0.05, 0.25]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color="#2d3436" />
      </mesh>
      <mesh position={[-0.15, 0.05, 0.25]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color="#2d3436" />
      </mesh>
      {/* Eye highlight */}
      <mesh position={[0.16, 0.06, 0.27]}>
        <sphereGeometry args={[0.012, 6, 6]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[-0.14, 0.06, 0.27]}>
        <sphereGeometry args={[0.012, 6, 6]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
      </mesh>
      {/* Mouth line */}
      <mesh position={[0, -0.06, 0.45]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.06, 0.005, 4, 12, Math.PI]} />
        <meshStandardMaterial color="#2d3436" />
      </mesh>
    </group>
  );
}

function WhaleModel({ scale = 1 }: { scale?: number }) {
  const tailRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (tailRef.current) {
      tailRef.current.rotation.y = Math.sin(t * 4) * 0.2;
    }
    if (bodyRef.current) {
      bodyRef.current.position.y = Math.sin(t * 1.5) * 0.05;
    }
  });

  return (
    <group scale={scale} ref={bodyRef}>
      {/* Main body */}
      <mesh>
        <capsuleGeometry args={[0.4, 1.2, 16, 32]} />
        <meshStandardMaterial color="#2c3e50" roughness={0.4} metalness={0.15} />
      </mesh>
      {/* Belly */}
      <mesh position={[0, -0.1, 0.1]}>
        <capsuleGeometry args={[0.3, 0.9, 12, 24]} />
        <meshStandardMaterial color="#5dade2" roughness={0.3} metalness={0.1} />
      </mesh>
      {/* Head bump */}
      <mesh position={[0, 0.1, 0.6]}>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshStandardMaterial color="#2c3e50" roughness={0.4} />
      </mesh>
      {/* Jaw */}
      <mesh position={[0, -0.12, 0.65]}>
        <sphereGeometry args={[0.28, 16, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial color="#5dade2" roughness={0.3} />
      </mesh>
      {/* Dorsal fin */}
      <mesh position={[0, 0.45, -0.15]} rotation={[0.2, 0, 0]}>
        <coneGeometry args={[0.1, 0.2, 8]} />
        <meshStandardMaterial color="#1a252f" roughness={0.3} />
      </mesh>
      {/* Pectoral fins */}
      <mesh position={[0.38, -0.15, 0.2]} rotation={[0.1, 0.2, -0.7]}>
        <coneGeometry args={[0.12, 0.5, 8]} />
        <meshStandardMaterial color="#2c3e50" roughness={0.3} />
      </mesh>
      <mesh position={[-0.38, -0.15, 0.2]} rotation={[0.1, -0.2, 0.7]}>
        <coneGeometry args={[0.12, 0.5, 8]} />
        <meshStandardMaterial color="#2c3e50" roughness={0.3} />
      </mesh>
      {/* Tail */}
      <group ref={tailRef} position={[0, 0, -0.85]}>
        <mesh>
          <cylinderGeometry args={[0.12, 0.25, 0.3, 10]} />
          <meshStandardMaterial color="#2c3e50" roughness={0.4} />
        </mesh>
        <mesh position={[0.2, 0, -0.15]} rotation={[0, 0.3, Math.PI / 2]}>
          <coneGeometry args={[0.15, 0.4, 8]} />
          <meshStandardMaterial color="#1a252f" roughness={0.3} />
        </mesh>
        <mesh position={[-0.2, 0, -0.15]} rotation={[0, -0.3, -Math.PI / 2]}>
          <coneGeometry args={[0.15, 0.4, 8]} />
          <meshStandardMaterial color="#1a252f" roughness={0.3} />
        </mesh>
      </group>
      {/* Eyes */}
      <mesh position={[0.28, 0.12, 0.55]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#2d3436" />
      </mesh>
      <mesh position={[-0.28, 0.12, 0.55]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#2d3436" />
      </mesh>
      <mesh position={[0.3, 0.14, 0.57]}>
        <sphereGeometry args={[0.015, 6, 6]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[-0.26, 0.14, 0.57]}>
        <sphereGeometry args={[0.015, 6, 6]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
      </mesh>
      {/* Blowhole */}
      <mesh position={[0, 0.42, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.05, 8]} />
        <meshStandardMaterial color="#1a252f" />
      </mesh>
    </group>
  );
}

const CREATURE_COMPONENTS: Record<string, React.FC<{ scale?: number }>> = {
  plankton: PlanktonModel,
  krill: KrillModel,
  clam: ClamModel,
  shell: ShellModel,
  pearl: PearlModel,
  coral: CoralModel,
  dolphin: DolphinModel,
  whale: WhaleModel,
};

export default function CreatureModel({ creatureId, scale = 1 }: { creatureId: string; scale?: number }) {
  const Component = CREATURE_COMPONENTS[creatureId];
  if (!Component) return null;
  return <Component scale={scale} />;
}
