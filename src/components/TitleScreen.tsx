import React, { useEffect, useState } from 'react';
import { Check, Crosshair, Flame, Gift, Share2, Shield, Volume2, VolumeX } from 'lucide-react';
import { trackGameEvent } from '../game/analytics';
import { getMonetizationConfig, triggerRewardedSupplyDrop } from '../game/monetization';
import { GameMode } from '../game/types';

interface TitleScreenProps {
  onStart: (mode: GameMode, rewardedDrop?: boolean) => void;
  muted: boolean;
  onToggleMute: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStart,
  muted,
  onToggleMute,
}) => {
  const [selectedMode, setSelectedMode] = useState<GameMode>('battle-royale');
  const [copiedShare, setCopiedShare] = useState(false);
  const [rewardStatus, setRewardStatus] = useState<string | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onStart(selectedMode, false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onStart, selectedMode]);

  const handleShareGame = async () => {
    const { itchUrl } = getMonetizationConfig();
    trackGameEvent('share_title', { mode: selectedMode });
    const shareText = `¡Ven a jugar ZERO ZONE! Battle Royale 3D gratis estilo Free Fire y Call of Duty: ${itchUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'ZERO ZONE — Battle Royale 3D',
          text: shareText,
          url: itchUrl,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2200);
    } catch {
      // Clipboard blocked
    }
  };

  const handleRewardedDeploy = () => {
    const res = triggerRewardedSupplyDrop();
    if (res.activated) {
      onStart(selectedMode, true);
    } else {
      setRewardStatus(res.message);
      setTimeout(() => setRewardStatus(null), 4500);
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-6 md:p-10 pointer-events-none bg-gradient-to-r from-[#07090e]/90 via-[#07090e]/45 to-transparent">
      {/* Top Bar: Share & Audio Toggle */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 px-3 py-1.5 bg-[#0f141e]/90 border border-amber-500/30 text-xs font-display tracking-widest text-amber-400 uppercase">
          <Flame className="w-3.5 h-3.5" />
          <span>TEMPORADA TÁCTICA // OPERACIÓN RELÁMPAGO</span>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={handleShareGame}
            className="flex items-center gap-2 px-3.5 py-2 bg-[#0f141e]/90 hover:bg-[#192231] border border-cyan-500/35 text-xs font-display tracking-wider uppercase text-cyan-300 transition-colors cursor-pointer"
          >
            {copiedShare ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
            <span>{copiedShare ? 'ENLACE COPIADO' : 'COMPARTIR'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className="flex items-center gap-2 px-3.5 py-2 bg-[#0f141e]/90 hover:bg-[#192231] border border-white/15 text-xs font-display tracking-wider uppercase text-slate-200 transition-colors cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
            <span>{muted ? 'AUDIO OFF' : 'AUDIO ON'}</span>
          </button>
        </div>
      </div>

      {/* Left-Third Hero Lockup */}
      <div className="max-w-lg space-y-5 pointer-events-auto">
        <div className="space-y-3">
          {/* Bespoke Inline SVG Emblem & Title Lockup */}
          <svg
            viewBox="0 0 460 118"
            className="w-full max-w-[420px] h-auto drop-shadow-[0_6px_24px_rgba(0,0,0,0.75)]"
            aria-label="ZERO ZONE"
          >
            <defs>
              <linearGradient id="zzFire" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffb703" />
                <stop offset="55%" stopColor="#fb8500" />
                <stop offset="100%" stopColor="#e63946" />
              </linearGradient>
            </defs>
            {/* Tactical Target Crest */}
            <polygon
              points="18,16 58,16 70,38 58,60 18,60 6,38"
              fill="none"
              stroke="url(#zzFire)"
              strokeWidth="3.5"
            />
            <circle cx="38" cy="38" r="10" fill="none" stroke="#38bdf8" strokeWidth="2.5" />
            <line x1="38" y1="20" x2="38" y2="56" stroke="#f8fafc" strokeWidth="1.8" />
            <line x1="20" y1="38" x2="56" y2="38" stroke="#f8fafc" strokeWidth="1.8" />

            {/* Title Typography */}
            <text
              x="86"
              y="52"
              fill="#f8fafc"
              fontFamily="'Chakra Petch', sans-serif"
              fontWeight="700"
              fontSize="50"
              letterSpacing="4"
            >
              ZERO
            </text>
            <text
              x="248"
              y="52"
              fill="url(#zzFire)"
              fontFamily="'Chakra Petch', sans-serif"
              fontWeight="700"
              fontSize="50"
              letterSpacing="4"
            >
              ZONE
            </text>
            <rect x="86" y="64" width="335" height="3" fill="url(#zzFire)" />
            <text
              x="86"
              y="88"
              fill="#94a3b8"
              fontFamily="'Chakra Petch', sans-serif"
              fontWeight="600"
              fontSize="15"
              letterSpacing="5.5"
            >
              ISLA TÁCTICA // BATTLE ROYALE 3D
            </text>
          </svg>

          <p className="text-sm md:text-base text-slate-300/90 leading-relaxed max-w-md">
            Combate táctico en primera persona: zona segura encogiéndose, paredes Gloo instantáneas, cajas de suministro y duelos de alta precisión.
          </p>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <button
            type="button"
            onClick={() => setSelectedMode('battle-royale')}
            className={`text-left p-3.5 border transition-all cursor-pointer ${
              selectedMode === 'battle-royale'
                ? 'bg-amber-500/18 border-amber-400 text-white'
                : 'bg-[#0f141e]/85 border-white/15 text-slate-300 hover:border-white/35'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-display font-bold text-sm tracking-wider uppercase">
                BATTLE ROYALE
              </span>
              <Shield className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-xs text-slate-300/80">24 combatientes · Zona segura · ¡Último en pie!</p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedMode('blitz')}
            className={`text-left p-3.5 border transition-all cursor-pointer ${
              selectedMode === 'blitz'
                ? 'bg-cyan-500/18 border-cyan-400 text-white'
                : 'bg-[#0f141e]/85 border-white/15 text-slate-300 hover:border-white/35'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-display font-bold text-sm tracking-wider uppercase">
                ASALTO BLITZ
              </span>
              <Crosshair className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-xs text-slate-300/80">3 oleadas tácticas · Combate directo en base</p>
          </button>
        </div>

        {/* Primary & Monetag Rewarded Drop CTAs */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onStart(selectedMode, false)}
            className="px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-display font-bold text-lg tracking-widest uppercase shadow-[0_0_28px_rgba(245,158,11,0.45)] transition-transform active:scale-95 cursor-pointer"
          >
            ¡DESPLEGAR AHORA!
          </button>

          <button
            type="button"
            onClick={handleRewardedDeploy}
            className="flex items-center gap-2 px-4 py-4 bg-[#101724]/95 hover:bg-[#192438] border border-cyan-400/50 text-cyan-300 font-display font-bold text-xs tracking-wider uppercase transition-colors cursor-pointer"
          >
            <Gift className="w-4 h-4 text-amber-400" />
            <span>DROP PATROCINADO (+AWM)</span>
          </button>
        </div>

        {rewardStatus && (
          <div className="max-w-md px-3 py-2 bg-[#0f141e]/95 border border-amber-400/40 text-xs text-amber-200 font-display">
            {rewardStatus}
          </div>
        )}
      </div>

      {/* Single Flat Control Hint Line */}
      <div className="flex items-center justify-between border-t border-white/10 pt-3">
        <p className="text-xs font-mono-num text-slate-300/85 tracking-wide">
          WASD Mover · Shift Esprintar · C Deslizar · Clic Izq Disparar · Clic Der/Q Apuntar · R Recargar · G Pared Gloo · F Botiquín · 1-3 Armas · Esc Pausa
        </p>
      </div>
    </div>
  );
};
