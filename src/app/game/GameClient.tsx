'use client';

import { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import Ocean from './components/Ocean';
import Player from './components/Player';
import NPCs from './components/NPCs';
import CollisionSystem from './components/CollisionSystem';
import EatEffects from './components/EatEffect';
import EvolveEffects from './components/EvolveEffect';
import Items from './components/Items';
import EventSystem from './components/EventSystem';
import BossController from './components/Boss';
import HUD from './components/HUD';
import MobileControls from './components/MobileControls';
import BGM from './components/BGM';
import { FOG_COLOR, FOG_NEAR, FOG_FAR } from './lib/gameConfig';

function GameScene() {
  const playerRef = useRef<any>(null);

  return (
    <>
      <fog attach="fog" args={[FOG_COLOR, FOG_NEAR, FOG_FAR]} />
      <color attach="background" args={[FOG_COLOR]} />
      <Ocean />
      <Player ref={playerRef} />
      <NPCs />
      <Items />
      <BossController />
      <CollisionSystem playerRef={playerRef} />
      <EatEffects />
      <EvolveEffects />
      <EventSystem />
    </>
  );
}

export default function GameClient() {
  return (
    <div className="fixed inset-0 bg-[#0c4a7a]" style={{ touchAction: 'none', overscrollBehavior: 'none' }}>
      <Canvas
        camera={{ fov: 65, near: 0.1, far: 200, position: [0, 3, 8] }}
        style={{ width: '100%', height: '100%' }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        dpr={[1, 1.5]}
      >
        <GameScene />
      </Canvas>

      <HUD />
      <MobileControls />
      <BGM />
    </div>
  );
}
