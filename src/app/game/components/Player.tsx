'use client';

import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../lib/useGameStore';
import {
  getStageByTier,
  CAMERA_OFFSET,
  CAMERA_LERP_SPEED,
  WORLD_SIZE,
  WORLD_DEPTH,
  OCEAN_FLOOR_Y,
} from '../lib/gameConfig';
import CreatureModel from './CreatureModels';
import { registerPlayerRef } from './NPCs';
import { triggerEvolveEffect } from './EvolveEffect';
import { playDashSound } from '../lib/sounds';

const keys: Record<string, boolean> = {};
const MOUSE_SENSITIVITY = 0.003;
const TOUCH_SENSITIVITY = 0.006;

const Player = forwardRef(function Player(_props, ref) {
  const meshRef = useRef<THREE.Group>(null);

  useImperativeHandle(ref, () => ({
    get position() {
      return meshRef.current?.position;
    },
  }));

  useEffect(() => {
    return () => {
      registerPlayerRef(null);
    };
  }, []);

  const velocityRef = useRef(new THREE.Vector3());
  const prevTierRef = useRef(1);
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const isTouchDevice = useRef(false);
  const isMouseDown = useRef(false);
  const cameraTouchId = useRef<number | null>(null);
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const zoomRef = useRef(1);

  const { camera } = useThree();
  const playerTier = useGameStore((s) => s.playerTier);
  const moveInput = useGameStore((s) => s.moveInput);
  const isStarted = useGameStore((s) => s.isStarted);
  const isGameOver = useGameStore((s) => s.isGameOver);
  const isCleared = useGameStore((s) => s.isCleared);

  const stage = getStageByTier(playerTier);

  useEffect(() => {
    isTouchDevice.current = 'ontouchstart' in window;
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    keys[e.key.toLowerCase()] = true;
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    keys[e.key.toLowerCase()] = false;
  }, []);

  const handleMouseDown = useCallback(() => {
    isMouseDown.current = true;
  }, []);

  const handleMouseUp = useCallback(() => {
    isMouseDown.current = false;
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isTouchDevice.current || !isMouseDown.current) return;
    yawRef.current -= e.movementX * MOUSE_SENSITIVITY;
    pitchRef.current -= e.movementY * MOUSE_SENSITIVITY;
    pitchRef.current = Math.max(-Math.PI * 0.44, Math.min(Math.PI * 0.7, pitchRef.current));
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const { isStarted, isGameOver, isCleared, isPaused } = useGameStore.getState();
    if (!isStarted || isGameOver || isCleared || isPaused) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('[role="button"]')) return;
    e.preventDefault();
    const screenW = window.innerWidth;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.clientX > screenW / 2 && cameraTouchId.current === null) {
        cameraTouchId.current = touch.identifier;
        lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
      }
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const { isStarted, isGameOver, isCleared, isPaused } = useGameStore.getState();
    if (!isStarted || isGameOver || isCleared || isPaused) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('[role="button"]')) return;
    e.preventDefault();
    if (cameraTouchId.current === null || !lastTouchRef.current) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === cameraTouchId.current) {
        const dx = touch.clientX - lastTouchRef.current.x;
        const dy = touch.clientY - lastTouchRef.current.y;
        yawRef.current -= dx * TOUCH_SENSITIVITY;
        pitchRef.current -= dy * TOUCH_SENSITIVITY;
        pitchRef.current = Math.max(-Math.PI * 0.44, Math.min(Math.PI * 0.7, pitchRef.current));
        lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
        break;
      }
    }
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === cameraTouchId.current) {
        cameraTouchId.current = null;
        lastTouchRef.current = null;
        break;
      }
    }
  }, []);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    zoomRef.current += e.deltaY * 0.001;
    zoomRef.current = Math.max(0.4, Math.min(2.5, zoomRef.current));
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [handleKeyDown, handleKeyUp, handleMouseDown, handleMouseUp, handleMouseMove, handleTouchStart, handleTouchMove, handleTouchEnd, handleWheel]);

  useFrame((_, delta) => {
    const { isPaused } = useGameStore.getState();
    if (!meshRef.current || !isStarted || isGameOver || isCleared || isPaused) return;
    registerPlayerRef({ position: meshRef.current.position });

    if (playerTier > prevTierRef.current) {
      const pos = meshRef.current.position;
      const newStage = getStageByTier(playerTier);
      triggerEvolveEffect(pos.x, pos.y, pos.z, newStage.color);
      prevTierRef.current = playerTier;
    }

    let inputX = 0;
    let inputZ = 0;

    if (isTouchDevice.current) {
      inputX = moveInput.x;
      inputZ = moveInput.y;
    } else {
      if (keys['w'] || keys['arrowup']) inputZ = -1;
      if (keys['s'] || keys['arrowdown']) inputZ = 1;
      if (keys['a'] || keys['arrowleft']) inputX = -1;
      if (keys['d'] || keys['arrowright']) inputX = 1;
    }

    const pitch = pitchRef.current;
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyAxisAngle(new THREE.Vector3(1, 0, 0), -pitch);
    forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), yawRef.current);

    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yawRef.current);

    const moveDir = new THREE.Vector3();
    moveDir.addScaledVector(forward, -inputZ);
    moveDir.addScaledVector(right, inputX);

    if (moveDir.length() > 0) {
      moveDir.normalize();
    }

    const { isDashing, activeEffects } = useGameStore.getState();
    const now = Date.now();
    let speedMul = 1;
    if (isDashing) speedMul = 2.5;
    else if (activeEffects.some((e) => e.type === 'speed' && e.endTime > now)) speedMul = 1.5;

    if (keys['shift'] && !isDashing) {
      useGameStore.getState().startDash();
      playDashSound();
    }

    const targetVelocity = moveDir.multiplyScalar(stage.speed * speedMul);
    velocityRef.current.lerp(targetVelocity, 0.1);

    const { activeEvent } = useGameStore.getState();
    const moveDelta = velocityRef.current.clone().multiplyScalar(delta);
    if (activeEvent?.type === 'current' && activeEvent.data && now < activeEvent.endTime) {
      moveDelta.x += activeEvent.data.dirX * 2 * delta;
      moveDelta.z += activeEvent.data.dirZ * 2 * delta;
    }
    meshRef.current.position.add(moveDelta);

    const halfWorld = WORLD_SIZE / 2 - 2;
    const topY = OCEAN_FLOOR_Y + WORLD_DEPTH - 1;
    const bottomY = OCEAN_FLOOR_Y + 0.3;

    meshRef.current.position.x = Math.max(-halfWorld, Math.min(halfWorld, meshRef.current.position.x));
    meshRef.current.position.z = Math.max(-halfWorld, Math.min(halfWorld, meshRef.current.position.z));
    meshRef.current.position.y = Math.max(bottomY, Math.min(topY, meshRef.current.position.y));

    const targetQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(pitch, yawRef.current + Math.PI, 0, 'YXZ')
    );
    meshRef.current.quaternion.slerp(targetQuat, 0.1);

    const zoom = zoomRef.current;
    const tierZoom = 1 + Math.max(0, (stage.size - 1) * 0.4);
    const totalZoom = zoom * tierZoom;
    const offsetVec = new THREE.Vector3(
      CAMERA_OFFSET.x,
      (CAMERA_OFFSET.y + Math.sin(pitchRef.current) * 3) * totalZoom,
      CAMERA_OFFSET.z * totalZoom
    ).applyAxisAngle(new THREE.Vector3(0, 1, 0), yawRef.current);

    const targetCamPos = meshRef.current.position.clone().add(offsetVec);
    camera.position.lerp(targetCamPos, CAMERA_LERP_SPEED);
    camera.lookAt(meshRef.current.position);
  });

  return (
    <group ref={meshRef} position={[0, 0, 0]}>
      <CreatureModel creatureId={stage.id} scale={stage.size} />
    </group>
  );
});

export default Player;
