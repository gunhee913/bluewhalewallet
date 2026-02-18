'use client';

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../lib/useGameStore';
import { playDashSound } from '../lib/sounds';

export default function MobileControls() {
  const [isMobile, setIsMobile] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const joystickRef = useRef<HTMLDivElement>(null);
  const nippleManager = useRef<any>(null);
  const setMoveInput = useGameStore((s) => s.setMoveInput);
  const isStarted = useGameStore((s) => s.isStarted);

  useEffect(() => {
    setIsMobile('ontouchstart' in window);
    const checkOrientation = () => setIsPortrait(window.innerHeight > window.innerWidth);
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  useEffect(() => {
    if (!isMobile || !joystickRef.current) return;

    let manager: any;
    const size = isPortrait ? 100 : 120;
    const offset = isPortrait ? '60px' : '80px';

    import('nipplejs').then((nipplejs) => {
      manager = nipplejs.create({
        zone: joystickRef.current!,
        mode: 'static',
        position: { left: offset, bottom: offset },
        color: 'rgba(255, 255, 255, 0.3)',
        size,
      });

      manager.on('move', (_: any, data: any) => {
        if (data.vector) {
          setMoveInput(data.vector.x, -data.vector.y);
        }
      });

      manager.on('end', () => {
        setMoveInput(0, 0);
      });

      nippleManager.current = manager;
    });

    return () => {
      if (manager) manager.destroy();
    };
  }, [isMobile, isPortrait, setMoveInput]);

  const handleDash = () => {
    const { isDashing, dashCooldownEnd, startDash } = useGameStore.getState();
    const now = Date.now();
    if (isDashing || now < dashCooldownEnd) return;
    startDash();
    playDashSound();
  };

  if (!isMobile) return null;

  return (
    <>
      <div
        ref={joystickRef}
        style={{
          position: 'fixed',
          left: 0,
          bottom: 0,
          width: '50%',
          height: isPortrait ? '30%' : '40%',
          zIndex: 50,
          touchAction: 'none',
        }}
      />
      {isStarted && (
        <DashButton isPortrait={isPortrait} onDash={handleDash} />
      )}
    </>
  );
}

function DashButton({ isPortrait, onDash }: { isPortrait: boolean; onDash: () => void }) {
  const isDashing = useGameStore((s) => s.isDashing);
  const dashCooldownEnd = useGameStore((s) => s.dashCooldownEnd);
  const getDashCooldownMs = useGameStore((s) => s.getDashCooldownMs);
  const isStarted = useGameStore((s) => s.isStarted);
  const isGameOver = useGameStore((s) => s.isGameOver);
  const isCleared = useGameStore((s) => s.isCleared);

  const [cooldownPct, setCooldownPct] = useState(0);

  useEffect(() => {
    const cooldownMs = getDashCooldownMs();
    const iv = setInterval(() => {
      const now = Date.now();
      if (now < dashCooldownEnd) {
        const remaining = dashCooldownEnd - now;
        setCooldownPct(Math.min(100, (remaining / cooldownMs) * 100));
      } else {
        setCooldownPct(0);
      }
    }, 50);
    return () => clearInterval(iv);
  }, [dashCooldownEnd, getDashCooldownMs]);

  const isPaused = useGameStore((s) => s.isPaused);
  const showUpgradePanel = useGameStore((s) => s.showUpgradePanel);
  const showPerkSelection = useGameStore((s) => s.showPerkSelection);

  if (!isStarted || isGameOver || isCleared || isPaused || showUpgradePanel || showPerkSelection) return null;

  const size = isPortrait ? 56 : 64;
  const bottom = isPortrait ? 60 : 80;

  return (
    <button
      role="button"
      onTouchStart={(e) => { e.stopPropagation(); onDash(); }}
      style={{
        position: 'fixed',
        right: 20,
        bottom,
        width: size,
        height: size,
        borderRadius: '50%',
        border: '2px solid rgba(255,255,255,0.5)',
        background: cooldownPct > 0
          ? `conic-gradient(rgba(255,255,255,0.1) ${100 - cooldownPct}%, rgba(100,180,255,0.4) ${100 - cooldownPct}%)`
          : 'rgba(100,180,255,0.4)',
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
        zIndex: 55,
        touchAction: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: isDashing ? 0.5 : 1,
      }}
    >
      돌진
    </button>
  );
}
