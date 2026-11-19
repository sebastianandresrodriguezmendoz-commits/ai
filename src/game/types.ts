export type GameMode = 'battle-royale' | 'blitz';

export type GamePhase = 'title' | 'playing' | 'paused' | 'victory' | 'gameover';

export type WeaponId = 'ak47' | 'mp40' | 'm1887' | 'awm';

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  category: 'RIFLE' | 'SMG' | 'ESCOPETA' | 'FRANCOTIRADOR';
  damage: number;
  headshotMult: number;
  fireRate: number; // shots per second
  magSize: number;
  maxReserve: number;
  reloadTime: number; // seconds
  pellets: number;
  hipSpread: number;
  adsSpread: number;
  adsFov: number;
  recoilKick: number;
  recoilYaw: number;
  range: number;
  automatic: boolean;
  color: string;
  accentColor: string;
}

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  ak47: {
    id: 'ak47',
    name: 'AK-47 DRACO',
    category: 'RIFLE',
    damage: 32,
    headshotMult: 2.1,
    fireRate: 9.2,
    magSize: 30,
    maxReserve: 150,
    reloadTime: 1.85,
    pellets: 1,
    hipSpread: 0.026,
    adsSpread: 0.005,
    adsFov: 52,
    recoilKick: 0.024,
    recoilYaw: 0.009,
    range: 145,
    automatic: true,
    color: '#ff8c2a',
    accentColor: '#ffb74d',
  },
  mp40: {
    id: 'mp40',
    name: 'MP40 COBRA',
    category: 'SMG',
    damage: 21,
    headshotMult: 1.85,
    fireRate: 14.5,
    magSize: 36,
    maxReserve: 180,
    reloadTime: 1.45,
    pellets: 1,
    hipSpread: 0.022,
    adsSpread: 0.008,
    adsFov: 58,
    recoilKick: 0.014,
    recoilYaw: 0.007,
    range: 95,
    automatic: true,
    color: '#00e5ff',
    accentColor: '#80f3ff',
  },
  m1887: {
    id: 'm1887',
    name: 'M1887 BESTIA',
    category: 'ESCOPETA',
    damage: 18,
    headshotMult: 1.75,
    fireRate: 1.65,
    magSize: 2,
    maxReserve: 28,
    reloadTime: 1.6,
    pellets: 8,
    hipSpread: 0.068,
    adsSpread: 0.044,
    adsFov: 60,
    recoilKick: 0.075,
    recoilYaw: 0.018,
    range: 42,
    automatic: false,
    color: '#ff3d5a',
    accentColor: '#ff8598',
  },
  awm: {
    id: 'awm',
    name: 'AWM FANTASMA',
    category: 'FRANCOTIRADOR',
    damage: 115,
    headshotMult: 2.6,
    fireRate: 0.85,
    magSize: 5,
    maxReserve: 25,
    reloadTime: 2.35,
    pellets: 1,
    hipSpread: 0.075,
    adsSpread: 0.0008,
    adsFov: 24,
    recoilKick: 0.095,
    recoilYaw: 0.012,
    range: 220,
    automatic: false,
    color: '#ffd54f',
    accentColor: '#ffe57f',
  },
};

export interface WeaponSlotState {
  id: WeaponId;
  mag: number;
  reserve: number;
}

export interface KillFeedItem {
  id: number;
  killer: string;
  victim: string;
  weapon: string;
  headshot: boolean;
  isPlayerKill: boolean;
  timestamp: number;
}

export interface MedalEvent {
  id: number;
  title: string;
  subtitle: string;
  points: number;
  color: string;
}

export interface MinimapEntity {
  x: number;
  z: number;
  type: 'enemy' | 'drop' | 'gloo' | 'loot';
}

export interface HudSnapshot {
  phase: GamePhase;
  mode: GameMode;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  stamina: number;
  glooWalls: number;
  medkits: number;
  aliveCount: number;
  totalCombatants: number;
  kills: number;
  headshots: number;
  damageDealt: number;
  shotsFired: number;
  shotsHit: number;
  killstreak: number;
  activeSlotIndex: number;
  slots: WeaponSlotState[];
  isReloading: boolean;
  reloadProgress: number;
  isAds: boolean;
  isSprinting: boolean;
  isCrouching: boolean;
  inStorm: boolean;
  zoneRadius: number;
  targetZoneRadius: number;
  zonePhase: number;
  zoneTimer: number;
  zoneShrinking: boolean;
  crosshairSpread: number;
  yaw: number;
  playerX: number;
  playerZ: number;
  zoneCenterX: number;
  zoneCenterZ: number;
  hitmarkerKey: number;
  hitmarkerHeadshot: boolean;
  hitmarkerKill: boolean;
  damageFlash: number;
  damageDirAngle: number | null;
  interactPrompt: string | null;
  killFeed: KillFeedItem[];
  activeMedal: MedalEvent | null;
  minimapEntities: MinimapEntity[];
  matchTime: number;
  placement: number;
  pointerLocked: boolean;
  muted: boolean;
  sensitivity: number;
}
