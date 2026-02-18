import { OCEAN_FLOOR_Y, WORLD_SIZE } from './gameConfig';

function hash(x: number, z: number): number {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);

  const a = hash(ix, iz);
  const b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1);
  const d = hash(ix + 1, iz + 1);

  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, z: number): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  for (let i = 0; i < 4; i++) {
    value += smoothNoise(x * frequency, z * frequency) * amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value;
}

export function getTerrainHeight(x: number, z: number): number {
  const h = fbm(x * 0.04, z * 0.04) * 5 - 2;
  const edgeFade = 1 - Math.pow(Math.max(Math.abs(x), Math.abs(z)) / (WORLD_SIZE * 0.5), 2);
  return OCEAN_FLOOR_Y + h * Math.max(0, edgeFade);
}

export interface RockData {
  x: number;
  z: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  rotation: number;
  collisionRadius: number;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export const ROCK_DATA: RockData[] = (() => {
  const rng = seededRandom(42);
  return Array.from({ length: 30 }, () => {
    const sx = 0.8 + rng() * 2.5;
    const sy = 0.5 + rng() * 1.5;
    const sz = 0.8 + rng() * 2.5;
    return {
      x: (rng() - 0.5) * WORLD_SIZE * 0.7,
      z: (rng() - 0.5) * WORLD_SIZE * 0.7,
      scaleX: sx,
      scaleY: sy,
      scaleZ: sz,
      rotation: rng() * Math.PI,
      collisionRadius: Math.max(sx, sz) * 0.55,
    };
  });
})();

export interface CaveData {
  x: number;
  z: number;
  rotation: number;
  width: number;
  height: number;
  depth: number;
}

export const CAVE_DATA: CaveData[] = (() => {
  const rng = seededRandom(77);
  return Array.from({ length: 5 }, () => ({
    x: (rng() - 0.5) * WORLD_SIZE * 0.5,
    z: (rng() - 0.5) * WORLD_SIZE * 0.5,
    rotation: rng() * Math.PI * 2,
    width: 3 + rng() * 3,
    height: 2.5 + rng() * 2,
    depth: 4 + rng() * 4,
  }));
})();

export function checkRockCollision(px: number, py: number, pz: number, playerRadius: number): { x: number; z: number } | null {
  for (const rock of ROCK_DATA) {
    const terrainY = getTerrainHeight(rock.x, rock.z);
    const rockTop = terrainY + rock.scaleY * 0.85;
    if (py > rockTop + playerRadius) continue;

    const dx = px - rock.x;
    const dz = pz - rock.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const minDist = rock.collisionRadius + playerRadius;
    if (dist < minDist && dist > 0.001) {
      const push = minDist - dist;
      const nx = dx / dist;
      const nz = dz / dist;
      return { x: px + nx * push, z: pz + nz * push };
    }
  }
  return null;
}
