import React, { useState } from 'react';
import { Award, Check, Crosshair, Download, Gift, RotateCcw, Share2, ShieldAlert, Trophy } from 'lucide-react';
import { trackGameEvent } from '../game/analytics';
import {
  generateMatchScorecardPng,
  getMonetizationConfig,
  triggerRewardedSupplyDrop,
} from '../game/monetization';
import { GameMode, HudSnapshot } from '../game/types';

interface OverlayModalsProps {
  hud: HudSnapshot;
  onResume: () => void;
  onRestart: (mode: GameMode, rewardedDrop?: boolean) => void;
  onReturnTitle: () => void;
  onChangeSensitivity: (val: number) => void;
}

export const OverlayModals: React.FC<OverlayModalsProps> = ({
  hud,
  onResume,
  onRestart,
  onReturnTitle,
  onChangeSensitivity,
}) => {
  const [copiedChallenge, setCopiedChallenge] = useState(false);
  const [rewardFeedback, setRewardFeedback] = useState<string | null>(null);

  if (hud.phase !== 'paused' && hud.phase !== 'victory' && hud.phase !== 'gameover') {
    return null;
  }

  const accuracy =
    hud.shotsFired > 0 ? Math.round((hud.shotsHit / hud.shotsFired) * 100) : 0;

  if (hud.phase === 'paused') {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#06080c]/82 p-4">
        <div className="w-full max-w-md bg-[#0e131d] border border-white/20 p-6 space-y-5 shadow-2xl">
          <div className="border-b border-white/10 pb-3">
            <span className="text-[11px] font-display tracking-widest text-amber-400 uppercase">
              MENÚ TÁCTICO
            </span>
            <h2 className="font-display font-bold text-2xl tracking-wider text-white uppercase">
              COMBATE EN PAUSA
            </h2>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-display text-slate-300">
              <span>SENSIBILIDAD DE MIRA</span>
              <span className="font-mono-num text-amber-400">{hud.sensitivity.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.3"
              max="2.4"
              step="0.05"
              value={hud.sensitivity}
              onChange={(e) => onChangeSensitivity(parseFloat(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>

          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              onClick={onResume}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold tracking-widest uppercase cursor-pointer"
            >
              CONTINUAR COMBATE
            </button>
            <button
              type="button"
              onClick={() => onRestart(hud.mode, false)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-display font-semibold tracking-wider uppercase border border-white/15 cursor-pointer"
            >
              REINICIAR PARTIDA
            </button>
            <button
              type="button"
              onClick={onReturnTitle}
              className="w-full py-2.5 bg-transparent hover:bg-white/5 text-slate-300 font-display tracking-wider uppercase border border-white/15 cursor-pointer"
            >
              VOLVER AL MENÚ PRINCIPAL
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isVictory = hud.phase === 'victory';

  const handleDownloadScorecard = () => {
    const dataUrl = generateMatchScorecardPng(hud);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `zero-zone-${isVictory ? 'booyah' : 'combate'}-${hud.kills}kills.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    trackGameEvent('download_scorecard', { kills: hud.kills, victory: isVictory });
  };

  const handleShareChallenge = async () => {
    const { itchUrl } = getMonetizationConfig();
    const challengeMsg = isVictory
      ? `¡Hice ¡BOOYAH! en ZERO ZONE con ${hud.kills} bajas (${hud.headshots} headshots) y ${accuracy}% de precisión! ¿Puedes superarme? ${itchUrl}`
      : `Logré ${hud.kills} bajas (#${hud.placement}) en ZERO ZONE 3D. ¡Acepta el reto aquí!: ${itchUrl}`;

    trackGameEvent('share_scorecard', { kills: hud.kills, victory: isVictory });

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'ZERO ZONE // Reto de Combate',
          text: challengeMsg,
          url: itchUrl,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(challengeMsg);
      setCopiedChallenge(true);
      setTimeout(() => setCopiedChallenge(false), 2200);
    } catch {
      // Ignore
    }
  };

  const handleSponsoredRematch = () => {
    const res = triggerRewardedSupplyDrop();
    if (res.activated) {
      onRestart(hud.mode, true);
    } else {
      setRewardFeedback(res.message);
      setTimeout(() => setRewardFeedback(null), 4500);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#06080c]/88 p-4">
      <div
        className={`w-full max-w-lg bg-[#0e131d] border p-7 space-y-5 shadow-2xl ${
          isVictory ? 'border-amber-400/70' : 'border-rose-500/60'
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <span
              className={`text-xs font-display tracking-widest uppercase ${
                isVictory ? 'text-amber-400' : 'text-rose-400'
              }`}
            >
              {hud.mode === 'battle-royale'
                ? `POSICIÓN #${hud.placement} / ${hud.totalCombatants}`
                : 'OPERACIÓN BLITZ'}
            </span>
            <h2 className="font-display font-bold text-3xl tracking-wider text-white uppercase mt-0.5">
              {isVictory ? '¡BOOYAH! VICTORIA TÁCTICA' : 'ELIMINADO EN ACCIÓN'}
            </h2>
          </div>
          {isVictory ? (
            <Trophy className="w-11 h-11 text-amber-400 shrink-0" />
          ) : (
            <ShieldAlert className="w-11 h-11 text-rose-500 shrink-0" />
          )}
        </div>

        {/* Combat Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-[#151c29] border border-white/10">
            <div className="text-[10px] font-display text-slate-400 uppercase">BAJAS</div>
            <div className="font-mono-num font-bold text-2xl text-white mt-0.5">{hud.kills}</div>
          </div>
          <div className="p-3 bg-[#151c29] border border-white/10">
            <div className="text-[10px] font-display text-slate-400 uppercase flex items-center gap-1">
              <Crosshair className="w-3 h-3 text-rose-400" /> HEADSHOTS
            </div>
            <div className="font-mono-num font-bold text-2xl text-rose-400 mt-0.5">
              {hud.headshots}
            </div>
          </div>
          <div className="p-3 bg-[#151c29] border border-white/10">
            <div className="text-[10px] font-display text-slate-400 uppercase">DAÑO TOTAL</div>
            <div className="font-mono-num font-bold text-2xl text-amber-400 mt-0.5">
              {hud.damageDealt}
            </div>
          </div>
          <div className="p-3 bg-[#151c29] border border-white/10">
            <div className="text-[10px] font-display text-slate-400 uppercase flex items-center gap-1">
              <Award className="w-3 h-3 text-cyan-400" /> PRECISIÓN
            </div>
            <div className="font-mono-num font-bold text-2xl text-cyan-400 mt-0.5">
              {accuracy}%
            </div>
          </div>
        </div>

        {/* Viral Share & Download Match Card Row */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleDownloadScorecard}
            className="flex items-center justify-center gap-2 py-2.5 bg-[#151c29] hover:bg-[#1e293b] border border-white/15 text-xs font-display font-semibold tracking-wider uppercase text-slate-200 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>TARJETA PNG</span>
          </button>

          <button
            type="button"
            onClick={handleShareChallenge}
            className="flex items-center justify-center gap-2 py-2.5 bg-[#151c29] hover:bg-[#1e293b] border border-cyan-500/40 text-xs font-display font-semibold tracking-wider uppercase text-cyan-300 cursor-pointer"
          >
            {copiedChallenge ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Share2 className="w-3.5 h-3.5" />
            )}
            <span>{copiedChallenge ? 'RETO COPIADO' : 'COMPARTIR RETO'}</span>
          </button>
        </div>

        {/* Primary & Monetized Rematch Actions */}
        <div className="space-y-2.5 pt-1">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => onRestart(hud.mode, false)}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-display font-bold tracking-widest uppercase cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              JUGAR DE NUEVO
            </button>
            <button
              type="button"
              onClick={onReturnTitle}
              className="px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-display font-semibold tracking-wider uppercase border border-white/15 cursor-pointer"
            >
              MENÚ
            </button>
          </div>

          <button
            type="button"
            onClick={handleSponsoredRematch}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-400/40 text-cyan-200 font-display font-semibold text-xs tracking-widest uppercase cursor-pointer"
          >
            <Gift className="w-4 h-4 text-amber-400" />
            <span>REVANCHA CON DROP PATROCINADO (+AWM Y +2 GLOO)</span>
          </button>

          {rewardFeedback && (
            <div className="px-3 py-2 bg-[#151c29] border border-amber-400/40 text-xs text-amber-200 font-display">
              {rewardFeedback}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
