import React from 'react';
import { Crosshair, Heart, Shield, Skull, Volume2, VolumeX } from 'lucide-react';
import { HudSnapshot, WEAPONS } from '../game/types';

interface GameHUDProps {
  hud: HudSnapshot;
  onToggleMute: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({ hud, onToggleMute }) => {
  const activeSlot = hud.slots[hud.activeSlotIndex] || hud.slots[0];
  const activeWeapon = WEAPONS[activeSlot.id];
  const isSniperScoped = hud.isAds && activeSlot.id === 'awm';

  const hpPct = Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100));
  const shieldPct = Math.max(0, Math.min(100, (hud.shield / hud.maxShield) * 100));

  // Compass heading (0-360)
  const deg = (((-hud.yaw * 180) / Math.PI) % 360 + 360) % 360;
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  const cardinal = dirs[Math.round(deg / 45) % 8];

  const spread = Math.min(34, Math.max(4, hud.crosshairSpread));

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none overflow-hidden">
      {/* AWM Tactical Sniper Scope Overlay */}
      {isSniperScoped && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-full h-full"
            style={{
              background:
                'radial-gradient(circle at center, transparent 28%, rgba(5,8,12,0.96) 31%, rgba(3,5,8,0.99) 100%)',
            }}
          />
          <div className="absolute w-[58vh] h-[58vh] rounded-full border-2 border-amber-400/70 flex items-center justify-center">
            <div className="absolute inset-x-0 h-[1px] bg-amber-300/75" />
            <div className="absolute inset-y-0 w-[1px] bg-amber-300/75" />
            <div className="w-2 h-2 rounded-full bg-rose-500" />
          </div>
        </div>
      )}

      {/* Damage Vignette & Storm Border */}
      {(hud.damageFlash > 0.02 || hud.inStorm) && (
        <div
          className="absolute inset-0 transition-opacity duration-100"
          style={{
            boxShadow: hud.inStorm
              ? 'inset 0 0 95px rgba(6, 182, 212, 0.55)'
              : `inset 0 0 110px rgba(239, 68, 68, ${Math.min(0.7, hud.damageFlash * 0.68)})`,
          }}
        />
      )}

      {/* Damage Directional Indicator Arc */}
      {hud.damageFlash > 0.15 && hud.damageDirAngle !== null && (
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56"
          style={{ transform: `translate(-50%, -50%) rotate(${hud.damageDirAngle}rad)` }}
        >
          <div className="mx-auto w-14 h-2.5 bg-rose-500 rounded-full opacity-90 shadow-[0_0_16px_rgba(244,63,94,0.9)]" />
        </div>
      )}

      {/* TOP BAR: Minimap (Left), Match Status & Compass (Center), Kill Feed & Mute (Right) */}
      <div className="absolute top-4 left-4 right-4 flex items-start justify-between gap-4">
        {/* Tactical Radar Minimap */}
        <div className="w-32 h-32 md:w-36 md:h-36 bg-[#0b0e14]/88 border border-white/20 relative overflow-hidden">
          <svg viewBox="-65 -65 130 130" className="w-full h-full">
            {/* Grid */}
            <circle cx="0" cy="0" r="30" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />
            <circle cx="0" cy="0" r="58" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />
            <line x1="-65" y1="0" x2="65" y2="0" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />
            <line x1="0" y1="-65" x2="0" y2="65" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />

            {/* Relative Safe Zone Circle */}
            {hud.mode === 'battle-royale' && (
              <circle
                cx={hud.zoneCenterX - hud.playerX}
                cy={hud.zoneCenterZ - hud.playerZ}
                r={hud.zoneRadius}
                fill="rgba(6, 182, 212, 0.08)"
                stroke="#22d3ee"
                strokeWidth="1.5"
              />
            )}

            {/* Nearby Enemies & Supply Drops */}
            {hud.minimapEntities.map((ent, idx) => {
              const rx = ent.x - hud.playerX;
              const rz = ent.z - hud.playerZ;
              return ent.type === 'drop' ? (
                <rect
                  key={`d-${idx}`}
                  x={rx - 2.6}
                  y={rz - 2.6}
                  width="5.2"
                  height="5.2"
                  fill="#f59e0b"
                />
              ) : (
                <circle key={`e-${idx}`} cx={rx} cy={rz} r="2.4" fill="#fb7185" />
              );
            })}

            {/* Player Arrow (rotated by yaw) */}
            <g transform={`rotate(${(-hud.yaw * 180) / Math.PI})`}>
              <polygon points="0,-5 3.6,4 0,2 -3.6,4" fill="#4ade80" />
            </g>
          </svg>
          <span className="absolute bottom-1 left-1.5 text-[10px] font-mono-num text-slate-400">
            RADAR
          </span>
        </div>

        {/* Top-Center: Compass + Alive + Kills + Safe Zone */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-3 px-4 py-1.5 bg-[#0b0e14]/88 border border-white/15 text-xs font-display tracking-wider">
            <div className="flex items-center gap-1.5 text-amber-400">
              <span className="text-slate-400">VIVOS</span>
              <span className="font-mono-num font-bold text-sm text-white">{hud.aliveCount}</span>
            </div>
            <div className="w-[1px] h-3.5 bg-white/15" />
            <div className="flex items-center gap-1.5 text-rose-400">
              <Skull className="w-3.5 h-3.5" />
              <span className="font-mono-num font-bold text-sm text-white">{hud.kills}</span>
            </div>
            <div className="w-[1px] h-3.5 bg-white/15" />
            <div className="font-mono-num text-slate-300">
              {cardinal} {Math.round(deg)}°
            </div>
            {hud.mode === 'battle-royale' && (
              <>
                <div className="w-[1px] h-3.5 bg-white/15" />
                <div className={`font-mono-num ${hud.zoneShrinking ? 'text-cyan-400' : 'text-slate-300'}`}>
                  {hud.zoneShrinking ? 'ZONA CERRANDO' : `ZONA ${hud.zonePhase}`} · {hud.zoneTimer}s
                </div>
              </>
            )}
          </div>

          {hud.inStorm && (
            <div className="px-3 py-1 bg-cyan-950/90 border border-cyan-400 text-cyan-200 text-xs font-display font-bold tracking-widest uppercase">
              FUERA DE ZONA SEGURA — REGRESA AL CÍRCULO
            </div>
          )}
        </div>

        {/* Top-Right: Mute + Kill Feed */}
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={onToggleMute}
            className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1.5 bg-[#0b0e14]/88 hover:bg-[#171d29] border border-white/15 text-xs font-display text-slate-200 cursor-pointer"
          >
            {hud.muted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-cyan-400" />}
            <span>ESC Pausa</span>
          </button>

          <div className="flex flex-col items-end gap-1">
            {hud.killFeed.map((kf) => (
              <div
                key={kf.id}
                className={`px-2.5 py-1 text-[11px] font-display tracking-wide border-r-2 bg-[#0b0e14]/85 ${
                  kf.isPlayerKill
                    ? 'border-amber-400 text-amber-200'
                    : 'border-rose-500/70 text-slate-300'
                }`}
              >
                <span className="font-bold">{kf.killer}</span>
                <span className="mx-1.5 text-slate-400">
                  [{kf.weapon}{kf.headshot ? ' ★' : ''}]
                </span>
                <span className="text-rose-300">{kf.victim}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CENTER: Reactive Crosshair, Hitmarker & CoD Medal Banner */}
      {!isSniperScoped && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {/* Center dot */}
          <div className="w-1 h-1 rounded-full bg-white/95 shadow-[0_0_4px_rgba(0,0,0,0.9)]" />
          {/* 4 Dynamic Ticks */}
          <div
            className="absolute left-1/2 -translate-x-1/2 w-[2px] h-2.5 bg-white/90"
            style={{ bottom: `${spread}px` }}
          />
          <div
            className="absolute left-1/2 -translate-x-1/2 w-[2px] h-2.5 bg-white/90"
            style={{ top: `${spread}px` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 h-[2px] w-2.5 bg-white/90"
            style={{ right: `${spread}px` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 h-[2px] w-2.5 bg-white/90"
            style={{ left: `${spread}px` }}
          />
        </div>
      )}

      {/* Hitmarker X */}
      {hud.hitmarkerKey > 0 && (
        <div
          key={hud.hitmarkerKey}
          className="animate-hitmarker absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center"
        >
          <svg viewBox="0 0 32 32" className="w-7 h-7">
            <path
              d="M5 5 L12 12 M27 5 L20 12 M5 27 L12 20 M27 27 L20 20"
              stroke={hud.hitmarkerHeadshot || hud.hitmarkerKill ? '#ff3d5a' : '#ffffff'}
              strokeWidth={hud.hitmarkerHeadshot ? '3' : '2.4'}
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}

      {/* CoD Medal / Killstreak Banner */}
      {hud.activeMedal && (
        <div
          key={hud.activeMedal.id}
          className="animate-banner absolute top-24 left-1/2 -translate-x-1/2 flex flex-col items-center text-center"
        >
          <div
            className="px-4 py-1 bg-[#0b0e14]/90 border-t-2 font-display font-bold text-sm tracking-widest uppercase"
            style={{ borderColor: hud.activeMedal.color, color: hud.activeMedal.color }}
          >
            {hud.activeMedal.title}
            {hud.activeMedal.points > 0 ? ` +${hud.activeMedal.points}` : ''}
          </div>
          <span className="text-[11px] font-display tracking-wider text-slate-200 bg-[#0b0e14]/75 px-2.5 py-0.5">
            {hud.activeMedal.subtitle}
          </span>
        </div>
      )}

      {/* Interact Prompt */}
      {hud.interactPrompt && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 px-4 py-2 bg-[#0b0e14]/92 border border-amber-400 text-amber-300 font-display font-bold text-xs tracking-widest uppercase">
          {hud.interactPrompt}
        </div>
      )}

      {/* Pointer Lock Hint */}
      {!hud.pointerLocked && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#0b0e14]/80 border border-white/15 text-[11px] font-display text-slate-300 tracking-wide">
          Haz clic en el campo de batalla para fijar la mira FPS (o arrastra para apuntar)
        </div>
      )}

      {/* BOTTOM LEFT: Health, Shield, Stamina, Gloo Wall & Medkit */}
      <div className="absolute bottom-4 left-4 w-72 space-y-2 bg-[#0b0e14]/88 border border-white/15 p-3">
        {/* Quick Tactical Items */}
        <div className="flex items-center gap-2 text-xs font-display">
          <div className="flex-1 flex items-center justify-between px-2.5 py-1 bg-cyan-950/60 border border-cyan-500/40">
            <span className="text-cyan-300 font-bold">[G] GLOO</span>
            <span className="font-mono-num font-bold text-white">{hud.glooWalls}</span>
          </div>
          <div className="flex-1 flex items-center justify-between px-2.5 py-1 bg-emerald-950/60 border border-emerald-500/40">
            <span className="text-emerald-300 font-bold">[F] KIT</span>
            <span className="font-mono-num font-bold text-white">{hud.medkits}</span>
          </div>
        </div>

        {/* Shield Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono-num text-cyan-300">
            <span className="flex items-center gap-1 font-display">
              <Shield className="w-3.5 h-3.5" /> CHALECO
            </span>
            <span>{hud.shield}</span>
          </div>
          <div className="h-1.5 bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-cyan-400 transition-all duration-100"
              style={{ width: `${shieldPct}%` }}
            />
          </div>
        </div>

        {/* HP Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs font-mono-num">
            <span className="flex items-center gap-1 font-display font-bold text-white">
              <Heart className="w-3.5 h-3.5 text-emerald-400" /> SALUD
            </span>
            <span className="font-bold text-white">
              {hud.hp} <span className="text-slate-400 text-[10px]">/ {hud.maxHp}</span>
            </span>
          </div>
          <div className="h-2.5 bg-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-100 ${
                hpPct > 45 ? 'bg-emerald-400' : hpPct > 20 ? 'bg-amber-400' : 'bg-rose-500'
              }`}
              style={{ width: `${hpPct}%` }}
            />
          </div>
        </div>

        {/* Sprint Stamina */}
        <div className="h-1 bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-amber-400/80 transition-all duration-75"
            style={{ width: `${hud.stamina}%` }}
          />
        </div>
      </div>

      {/* BOTTOM RIGHT: Weapon Info, Ammo & Slots */}
      <div className="absolute bottom-4 right-4 w-72 bg-[#0b0e14]/88 border border-white/15 p-3 space-y-2">
        {hud.isReloading && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-display tracking-widest text-amber-300 uppercase">
              <span>RECARGANDO...</span>
              <span className="font-mono-num">{Math.round(hud.reloadProgress * 100)}%</span>
            </div>
            <div className="h-1 bg-slate-800">
              <div
                className="h-full bg-amber-400"
                style={{ width: `${hud.reloadProgress * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] font-display tracking-widest text-amber-400 uppercase">
              {activeWeapon.category}
            </div>
            <div className="font-display font-bold text-base tracking-wide text-white flex items-center gap-1.5">
              <Crosshair className="w-4 h-4 text-amber-400" />
              {activeWeapon.name}
            </div>
          </div>

          <div className="text-right font-mono-num leading-none">
            <span className="text-2xl font-bold text-white">{activeSlot.mag}</span>
            <span className="text-xs text-slate-400 ml-1">/ {activeSlot.reserve}</span>
          </div>
        </div>

        {/* Weapon Slots Strip */}
        <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-white/10">
          {hud.slots.map((s, idx) => {
            const spec = WEAPONS[s.id];
            const active = idx === hud.activeSlotIndex;
            return (
              <div
                key={`${s.id}-${idx}`}
                className={`px-2 py-1 text-[10px] font-display border ${
                  active
                    ? 'bg-amber-500/20 border-amber-400 text-white'
                    : 'bg-slate-900/70 border-white/10 text-slate-400'
                }`}
              >
                <span className="font-mono-num mr-1">[{idx + 1}]</span>
                {spec.id.toUpperCase()}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
