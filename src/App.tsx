/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHUD } from './components/GameHUD';
import { OverlayModals } from './components/OverlayModals';
import { TitleScreen } from './components/TitleScreen';
import { initAnalytics } from './game/analytics';
import { ZeroZoneEngine } from './game/engine';
import { initMonetag } from './game/monetization';
import { GameMode, HudSnapshot, WEAPONS } from './game/types';

const INITIAL_HUD: HudSnapshot = {
  phase: 'title',
  mode: 'battle-royale',
  hp: 200,
  maxHp: 200,
  shield: 100,
  maxShield: 150,
  stamina: 100,
  glooWalls: 3,
  medkits: 2,
  aliveCount: 24,
  totalCombatants: 24,
  kills: 0,
  headshots: 0,
  damageDealt: 0,
  shotsFired: 0,
  shotsHit: 0,
  killstreak: 0,
  activeSlotIndex: 0,
  slots: [
    { id: 'ak47', mag: WEAPONS.ak47.magSize, reserve: 120 },
    { id: 'mp40', mag: WEAPONS.mp40.magSize, reserve: 144 },
    { id: 'm1887', mag: WEAPONS.m1887.magSize, reserve: 18 },
  ],
  isReloading: false,
  reloadProgress: 0,
  isAds: false,
  isSprinting: false,
  isCrouching: false,
  inStorm: false,
  zoneRadius: 110,
  targetZoneRadius: 110,
  zonePhase: 1,
  zoneTimer: 18,
  zoneShrinking: false,
  crosshairSpread: 14,
  yaw: 0,
  playerX: 0,
  playerZ: 22,
  zoneCenterX: 0,
  zoneCenterZ: 0,
  hitmarkerKey: 0,
  hitmarkerHeadshot: false,
  hitmarkerKill: false,
  damageFlash: 0,
  damageDirAngle: null,
  interactPrompt: null,
  killFeed: [],
  activeMedal: null,
  minimapEntities: [],
  matchTime: 0,
  placement: 24,
  pointerLocked: false,
  muted: false,
  sensitivity: 1.0,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ZeroZoneEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);

  useEffect(() => {
    initAnalytics();
    initMonetag();
    const mount = canvasMountRef.current;
    if (!mount) return;
    const engine = new ZeroZoneEngine(mount, (snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleStart = useCallback((mode: GameMode, rewardedDrop = false) => {
    engineRef.current?.startGame(mode, rewardedDrop);
  }, []);

  const handleResume = useCallback(() => {
    engineRef.current?.resumeGame();
  }, []);

  const handleReturnTitle = useCallback(() => {
    engineRef.current?.returnToTitle();
  }, []);

  const handleToggleMute = useCallback(() => {
    engineRef.current?.toggleMute();
  }, []);

  const handleSensitivity = useCallback((val: number) => {
    engineRef.current?.setSensitivity(val);
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#090b0f]">
      {/* Isolated WebGL Viewport Container */}
      <div ref={canvasMountRef} className="fixed inset-0 w-full h-full" />

      {/* Title Screen */}
      {hud.phase === 'title' && (
        <TitleScreen
          onStart={handleStart}
          muted={hud.muted}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Active Gameplay HUD */}
      {hud.phase === 'playing' && (
        <GameHUD hud={hud} onToggleMute={handleToggleMute} />
      )}

      {/* Pause, Victory & Game Over Modals */}
      <OverlayModals
        hud={hud}
        onResume={handleResume}
        onRestart={handleStart}
        onReturnTitle={handleReturnTitle}
        onChangeSensitivity={handleSensitivity}
      />
    </div>
  );
}

