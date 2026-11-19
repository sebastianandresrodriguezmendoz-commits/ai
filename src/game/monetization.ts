import { trackGameEvent } from './analytics';
import { HudSnapshot } from './types';

let monetagInitialized = false;

export interface MonetizationConfig {
  zoneId: string;
  directLink: string;
  itchUrl: string;
  isMonetagActive: boolean;
}

export function getMonetizationConfig(): MonetizationConfig {
  const zoneId = (import.meta.env.VITE_MONETAG_ZONE_ID || '').trim();
  const directLink = (import.meta.env.VITE_MONETAG_DIRECT_LINK || '').trim();
  const itchUrl =
    (import.meta.env.VITE_ITCH_GAME_URL || '').trim() ||
    window.location.origin + window.location.pathname;

  return {
    zoneId,
    directLink,
    itchUrl,
    isMonetagActive: Boolean(zoneId || directLink),
  };
}

export function initMonetag(): void {
  const { zoneId } = getMonetizationConfig();
  if (!zoneId || monetagInitialized) return;

  monetagInitialized = true;
  // Standard Monetag MultiTag / Vignette / In-Page Push script loader
  const script = document.createElement('script');
  script.async = true;
  script.setAttribute('data-zone', zoneId);
  script.src = `https://alwingulla.com/88/tag.min.js`;
  document.head.appendChild(script);
}

/**
 * Triggers a rewarded Monetag Direct Link (using an anchor element, never window.open)
 * and grants a tactical supply boost if configured.
 */
export function triggerRewardedSupplyDrop(): { activated: boolean; message: string } {
  const { directLink, zoneId } = getMonetizationConfig();
  trackGameEvent('rewarded_supply_click', { configured: Boolean(directLink || zoneId) });

  if (directLink) {
    const a = document.createElement('a');
    a.href = directLink;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return {
      activated: true,
      message: '¡Suministro Táctico desbloqueado! (+AWM Fantasma y +2 Paredes Gloo)',
    };
  }

  if (zoneId) {
    return {
      activated: true,
      message: 'Zona Monetag activa. ¡Suministro Táctico desbloqueado!',
    };
  }

  return {
    activated: false,
    message:
      'Configura VITE_MONETAG_ZONE_ID o VITE_MONETAG_DIRECT_LINK en tu archivo .env para activar anuncios reales.',
  };
}

/**
 * Generates a downloadable PNG Match Scorecard for sharing on TikTok, X, Discord, and WhatsApp.
 */
export function generateMatchScorecardPng(hud: HudSnapshot): string {
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 540;
  const ctx = canvas.getContext('2d')!;

  // Dark tactical background
  const grad = ctx.createLinearGradient(0, 0, 960, 540);
  grad.addColorStop(0, '#090d16');
  grad.addColorStop(0.55, '#111827');
  grad.addColorStop(1, '#1e1b2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 960, 540);

  // Subtle diagonal tactical grid
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 2;
  for (let x = -540; x < 960; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 540, 540);
    ctx.stroke();
  }

  const isWin = hud.phase === 'victory';
  const accent = isWin ? '#f59e0b' : '#f43f5e';

  // Top Accent Bar
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 960, 8);

  // Title & Result
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('ZERO ZONE // REPORTE DE COMBATE 3D', 56, 68);

  ctx.fillStyle = accent;
  ctx.font = 'bold 54px sans-serif';
  ctx.fillText(isWin ? '¡BOOYAH! VICTORIA TÁCTICA' : `POSICIÓN #${hud.placement} / ${hud.totalCombatants}`, 56, 134);

  // Stats Cards
  const accuracy = hud.shotsFired > 0 ? Math.round((hud.shotsHit / hud.shotsFired) * 100) : 0;
  const stats = [
    { label: 'BAJAS', value: String(hud.kills), color: '#ffffff' },
    { label: 'HEADSHOTS', value: String(hud.headshots), color: '#fb7185' },
    { label: 'DAÑO TOTAL', value: String(hud.damageDealt), color: '#fbbf24' },
    { label: 'PRECISIÓN', value: `${accuracy}%`, color: '#22d3ee' },
  ];

  stats.forEach((st, idx) => {
    const bx = 56 + idx * 215;
    const by = 195;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(bx, by, 195, 145);
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, 195, 145);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(st.label, bx + 20, by + 40);

    ctx.fillStyle = st.color;
    ctx.font = 'bold 48px monospace';
    ctx.fillText(st.value, bx + 20, by + 108);
  });

  // Challenge Footer CTA
  const { itchUrl } = getMonetizationConfig();
  ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
  ctx.fillRect(56, 390, 848, 92);
  ctx.strokeStyle = accent;
  ctx.strokeRect(56, 390, 848, 92);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('¿CREES QUE PUEDES SUPERAR MI MARCA? JUEGA GRATIS:', 80, 428);
  ctx.fillStyle = '#fbbf24';
  ctx.font = '20px monospace';
  ctx.fillText(itchUrl.slice(0, 68), 80, 462);

  return canvas.toDataURL('image/png');
}
