import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { initAnalytics, trackGameEvent } from './analytics';
import { SoundEngine } from './audio';
import { initMonetag } from './monetization';
import {
  ARENA_PLAYABLE_RADIUS,
  ColliderBox,
  getFloorElevationAt,
  groundHeightAt,
  resolveCircleCollision,
} from './map';
import {
  createArmoredVehicle,
  createBunkerWall,
  createEnemySoldier,
  createGlooWallMesh,
  createLootPickup,
  createShippingContainer,
  createSupplyDrop,
  createViewmodelWeapon,
  createWatchtower,
  EnemyVariant,
  EnemyVisualRefs,
  LootKind,
  ViewmodelRefs,
} from './models';
import { createProceduralTextures, ProceduralTextures } from './textures';
import {
  GameMode,
  GamePhase,
  HudSnapshot,
  KillFeedItem,
  MedalEvent,
  MinimapEntity,
  WeaponId,
  WEAPONS,
  WeaponSlotState,
} from './types';

// Pre-allocated math helpers (Zero GC in render loop)
const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _vec3C = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

const BOT_CALLSIGNS = [
  'GHOST_CO',
  'KRAKEN_77',
  'VIPER_MED',
  'SHADOW_X',
  'COBRA_99',
  'FALCON_BR',
  'TITAN_OP',
  'SPECTRE',
  'REAPER_01',
  'NOVA_PRO',
  'VENOM_Z',
  'BLITZ_K',
  'APEX_WOLF',
  'DRACO_FF',
  'VALKYRIE',
  'OMEGA_6',
  'HUNTER_XL',
  'ROGUE_TX',
  'STRIKER',
  'PHANTOM',
  'CYBER_9',
  'JAGUAR_C',
  'ORION_V',
];

interface EnemyActor {
  id: number;
  name: string;
  variant: EnemyVariant;
  hp: number;
  maxHp: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  yaw: number;
  visual: EnemyVisualRefs;
  alive: boolean;
  fireCooldown: number;
  windupTimer: number;
  windingUp: boolean;
  hitFlashTimer: number;
  muzzleTimer: number;
  strafeDir: number;
  strafeTimer: number;
  patrolTarget: THREE.Vector3;
  walkPhase: number;
  botFightTimer: number;
}

interface GlooBarrier {
  id: number;
  mesh: THREE.Group;
  collider: ColliderBox;
  hp: number;
  pos: THREE.Vector3;
}

interface LootItem {
  id: number;
  kind: LootKind;
  mesh: THREE.Group;
  pos: THREE.Vector3;
  collected: boolean;
  isSupplyDrop?: boolean;
}

interface Tracer {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

const ZONE_PHASES = [
  { wait: 18, shrink: 18, targetRadius: 72 },
  { wait: 14, shrink: 16, targetRadius: 44 },
  { wait: 12, shrink: 15, targetRadius: 20 },
  { wait: 10, shrink: 14, targetRadius: 6 },
];

export class ZeroZoneEngine {
  private container: HTMLElement;
  private onHudUpdate: (snapshot: HudSnapshot) => void;
  private sound = new SoundEngine();

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private textures!: ProceduralTextures;
  private isSoftwareGl = false;

  private frameId = 0;
  private lastTime = 0;
  private disposed = false;

  // Game State
  private phase: GamePhase = 'title';
  private mode: GameMode = 'battle-royale';
  private matchTime = 0;
  private hitstopTimer = 0;
  private sensitivity = 1.0;

  // Player Physics & Combat
  private playerPos = new THREE.Vector3(0, 0, 22);
  private playerVel = new THREE.Vector3();
  private playerYaw = 0;
  private playerPitch = 0;
  private grounded = true;
  private hp = 200;
  private maxHp = 200;
  private shield = 100;
  private maxShield = 150;
  private stamina = 100;
  private glooWalls = 3;
  private medkits = 2;
  private kills = 0;
  private headshots = 0;
  private damageDealt = 0;
  private shotsFired = 0;
  private shotsHit = 0;
  private killstreak = 0;
  private placement = 24;

  // Movement states
  private isCrouching = false;
  private slideTimer = 0;
  private isAds = false;
  private fireCooldown = 0;
  private reloadTimer = 0;
  private isReloading = false;
  private recoilPitch = 0;
  private recoilYawOffset = 0;
  private cameraShake = 0;
  private walkBobPhase = 0;

  // Weapons & Viewmodels
  private slots: WeaponSlotState[] = [
    { id: 'ak47', mag: WEAPONS.ak47.magSize, reserve: 120 },
    { id: 'mp40', mag: WEAPONS.mp40.magSize, reserve: 144 },
    { id: 'm1887', mag: WEAPONS.m1887.magSize, reserve: 18 },
  ];
  private activeSlotIndex = 0;
  private viewmodels: Partial<Record<WeaponId, ViewmodelRefs>> = {};
  private viewmodelAnchor = new THREE.Group();
  private viewmodelKickZ = 0;
  private viewmodelMuzzleTimer = 0;
  private muzzlePointLight!: THREE.PointLight;

  // World & Entities
  private staticColliders: ColliderBox[] = [];
  private allColliders: ColliderBox[] = [];
  private glooBarriers: GlooBarrier[] = [];
  private nextGlooId = 1;
  private worldRaycastMeshes: THREE.Object3D[] = [];
  private enemies: EnemyActor[] = [];
  private lootItems: LootItem[] = [];
  private nextLootId = 1;
  private totalCombatants = 24;
  private aliveCount = 24;
  private botDuelTimer = 4.5;
  private blitzWave = 1;

  // Safe Zone
  private zoneCenter = new THREE.Vector2(0, 0);
  private zoneRadius = 110;
  private targetZoneRadius = 110;
  private zoneStartRadius = 110;
  private zonePhaseIndex = 0;
  private zoneTimer = ZONE_PHASES[0].wait;
  private zoneShrinking = false;
  private stormDamageAccum = 0;
  private zoneCylinder!: THREE.Mesh;

  // FX Pools
  private tracers: Tracer[] = [];
  private particles: Particle[] = [];
  private raycaster = new THREE.Raycaster();

  // HUD feedback
  private hitmarkerKey = 0;
  private hitmarkerHeadshot = false;
  private hitmarkerKill = false;
  private damageFlash = 0;
  private damageDirAngle: number | null = null;
  private killFeed: KillFeedItem[] = [];
  private nextFeedId = 1;
  private activeMedal: MedalEvent | null = null;
  private medalTimer = 0;
  private nextMedalId = 1;
  private lastHudPush = 0;

  // Input
  private keys: Record<string, boolean> = {};
  private mouseDownLeft = false;
  private mouseDownRight = false;
  private draggingLook = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private pointerLocked = false;
  private titleOrbitAngle = 0.4;

  // Bound event listeners
  private handleResizeBound = () => this.onResize();
  private handleKeyDownBound = (e: KeyboardEvent) => this.onKeyDown(e);
  private handleKeyUpBound = (e: KeyboardEvent) => this.onKeyUp(e);
  private handleBlurBound = () => this.onWindowBlur();
  private handleMouseDownBound = (e: MouseEvent) => this.onMouseDown(e);
  private handleMouseUpBound = (e: MouseEvent) => this.onMouseUp(e);
  private handleMouseMoveBound = (e: MouseEvent) => this.onMouseMove(e);
  private handleWheelBound = (e: WheelEvent) => this.onWheel(e);
  private handleContextMenuBound = (e: MouseEvent) => e.preventDefault();
  private handlePointerLockChangeBound = () => this.onPointerLockChange();

  constructor(container: HTMLElement, onHudUpdate: (snapshot: HudSnapshot) => void) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.initScene();
    this.buildArena();
    this.initViewmodels();
    this.initFxPools();
    this.bindEvents();
    this.spawnTitleShowcaseBots();
    this.pushHud(true);
    this.lastTime = performance.now();
    this.scheduleNextFrame();
  }

  private detectSoftwareGl(): boolean {
    try {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return true;
    }
  }

  private initScene(): void {
    this.isSoftwareGl = this.detectSoftwareGl();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.container.clientWidth || window.innerWidth, this.container.clientHeight || window.innerHeight);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const skyColor = new THREE.Color(0x9bb7cc);
    this.scene.background = skyColor;
    this.scene.fog = new THREE.FogExp2(0x9bb7cc, 0.0062);

    this.camera = new THREE.PerspectiveCamera(
      72,
      (this.container.clientWidth || window.innerWidth) /
        (this.container.clientHeight || window.innerHeight),
      0.08,
      360
    );
    this.scene.add(this.camera);

    // Mandatory studio environment reflection (RoomEnvironment) on all devices
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.textures = createProceduralTextures(this.renderer.capabilities.getMaxAnisotropy());

    // 3-Point Warm/Cool Outdoor Tactical Lighting Rig
    const hemi = new THREE.HemisphereLight(0xbbe0ff, 0x4d4332, 0.9);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff0d4, 2.15);
    sun.position.set(55, 82, 42);
    sun.castShadow = !this.isSoftwareGl;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 210;
    const d = 68;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);

    const rim = new THREE.DirectionalLight(0x7cc4ff, 0.55);
    rim.position.set(-60, 35, -55);
    this.scene.add(rim);

    // Muzzle point light attached to camera
    this.muzzlePointLight = new THREE.PointLight(0xffb347, 0, 12, 2);
    this.muzzlePointLight.position.set(0.25, -0.1, -0.8);
    this.camera.add(this.muzzlePointLight);
  }

  private buildArena(): void {
    // 1. Extended Terrain Mesh (380 x 380 so horizon never ends in a box)
    const terrainGeo = new THREE.PlaneGeometry(380, 380, 112, 112);
    terrainGeo.rotateX(-Math.PI / 2);
    const posAttr = terrainGeo.attributes.position;
    const colors = new Float32Array(posAttr.count * 3);

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const vy = groundHeightAt(vx, vz);
      posAttr.setY(i, vy);

      const dist = Math.hypot(vx, vz);
      if (dist < 35) {
        _color.setHex(0x6e6858); // Packed compound dirt
      } else if (dist > 114) {
        _color.setHex(0x4c4840); // Perimeter canyon rock
      } else if (vy > 1.3) {
        _color.setHex(0x636b48); // Ridge moss/grass
      } else {
        _color.setHex(0x7c7056); // Arid soil
      }
      colors[i * 3] = _color.r;
      colors[i * 3 + 1] = _color.g;
      colors[i * 3 + 2] = _color.b;
    }
    terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      map: this.textures.ground,
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.04,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    this.scene.add(terrainMesh);
    this.worldRaycastMeshes.push(terrainMesh);

    // 2. Central Asphalt Compound + Helipad
    const tarmacMat = new THREE.MeshStandardMaterial({
      map: this.textures.asphalt,
      roughness: 0.85,
      metalness: 0.08,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const tarmac = new THREE.Mesh(new THREE.BoxGeometry(52, 0.08, 52), tarmacMat);
    tarmac.position.set(0, 0.02, 0);
    tarmac.receiveShadow = true;
    this.scene.add(tarmac);

    const helipadMat = new THREE.MeshStandardMaterial({
      map: this.textures.helipad,
      roughness: 0.78,
      metalness: 0.1,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const helipad = new THREE.Mesh(new THREE.BoxGeometry(16, 0.06, 16), helipadMat);
    helipad.position.set(0, 0.06, 0);
    helipad.receiveShadow = true;
    this.scene.add(helipad);

    // 3. Shipping Containers (CQB Tactical Lanes)
    const containerPlacements: Array<{ x: number; z: number; rotY: number; color: number }> = [
      { x: -13, z: -10, rotY: 0, color: 0x3b5249 },
      { x: 14, z: -12, rotY: Math.PI / 2, color: 0xb45309 },
      { x: -16, z: 12, rotY: Math.PI / 2, color: 0x1e3a5f },
      { x: 15, z: 14, rotY: 0.15, color: 0x7c2d12 },
      { x: -34, z: -26, rotY: 0.4, color: 0x3f6212 },
      { x: 36, z: 24, rotY: -0.35, color: 0x9a3412 },
    ];

    containerPlacements.forEach((cp) => {
      const c = createShippingContainer(cp.color, this.textures);
      const gy = groundHeightAt(cp.x, cp.z);
      c.position.set(cp.x, gy, cp.z);
      c.rotation.y = cp.rotY;
      this.scene.add(c);
      this.worldRaycastMeshes.push(c);

      // Compute oriented bounding box roughly as AABB
      const cos = Math.abs(Math.cos(cp.rotY));
      const sin = Math.abs(Math.sin(cp.rotY));
      const halfW = 3.0 * cos + 1.3 * sin;
      const halfD = 3.0 * sin + 1.3 * cos;
      this.staticColliders.push({
        minX: cp.x - halfW,
        maxX: cp.x + halfW,
        minY: gy,
        maxY: gy + 2.85,
        minZ: cp.z - halfD,
        maxZ: cp.z + halfD,
        kind: 'solid',
      });
    });

    // 4. Tactical Watchtowers
    const towerSpots = [
      { x: -24, z: -24 },
      { x: 25, z: -24 },
      { x: 0, z: 30 },
    ];
    towerSpots.forEach((ts) => {
      const wt = createWatchtower(this.textures);
      const gy = groundHeightAt(ts.x, ts.z);
      wt.position.set(ts.x, gy, ts.z);
      this.scene.add(wt);
      this.worldRaycastMeshes.push(wt);
      // 4 leg colliders or central core collider
      this.staticColliders.push({
        minX: ts.x - 2.3,
        maxX: ts.x + 2.3,
        minY: gy,
        maxY: gy + 4.2,
        minZ: ts.z - 2.3,
        maxZ: ts.z + 2.3,
        kind: 'solid',
      });
    });

    // 5. Armored Vehicles
    const vehicleSpots = [
      { x: -8, z: 16, rotY: 0.65, color: 0x4b533e },
      { x: 10, z: 4, rotY: -0.9, color: 0x57534e },
      { x: -46, z: 14, rotY: 1.1, color: 0x3f4f3c },
      { x: 44, z: -32, rotY: -0.4, color: 0x6b5c43 },
    ];
    vehicleSpots.forEach((vs) => {
      const veh = createArmoredVehicle(vs.color);
      const gy = groundHeightAt(vs.x, vs.z);
      veh.position.set(vs.x, gy, vs.z);
      veh.rotation.y = vs.rotY;
      this.scene.add(veh);
      this.worldRaycastMeshes.push(veh);
      const cos = Math.abs(Math.cos(vs.rotY));
      const sin = Math.abs(Math.sin(vs.rotY));
      const hw = 1.25 * cos + 2.45 * sin;
      const hd = 1.25 * sin + 2.45 * cos;
      this.staticColliders.push({
        minX: vs.x - hw,
        maxX: vs.x + hw,
        minY: gy,
        maxY: gy + 2.2,
        minZ: vs.z - hd,
        maxZ: vs.z + hd,
        kind: 'solid',
      });
    });

    // 6. Concrete Tactical Bunker Walls
    const bunkerSpots = [
      { x: 0, z: -14, w: 7.5, h: 1.65, d: 0.8, rotY: 0 },
      { x: -12, z: 0, w: 6.5, h: 1.65, d: 0.8, rotY: Math.PI / 2 },
      { x: 12, z: 0, w: 6.5, h: 1.65, d: 0.8, rotY: Math.PI / 2 },
      { x: 0, z: 15, w: 6.0, h: 1.5, d: 0.8, rotY: 0 },
      { x: -42, z: -8, w: 8.0, h: 2.0, d: 0.9, rotY: 0.5 },
      { x: 42, z: 8, w: 8.0, h: 2.0, d: 0.9, rotY: -0.5 },
      { x: 18, z: -48, w: 8.5, h: 2.1, d: 0.9, rotY: 0.2 },
      { x: -20, z: 48, w: 8.5, h: 2.1, d: 0.9, rotY: -0.2 },
    ];
    bunkerSpots.forEach((bs) => {
      const b = createBunkerWall(bs.w, bs.h, bs.d, this.textures);
      const gy = groundHeightAt(bs.x, bs.z);
      b.position.set(bs.x, gy, bs.z);
      b.rotation.y = bs.rotY;
      this.scene.add(b);
      this.worldRaycastMeshes.push(b);
      const cos = Math.abs(Math.cos(bs.rotY));
      const sin = Math.abs(Math.sin(bs.rotY));
      const hw = (bs.w / 2) * cos + (bs.d / 2) * sin;
      const hd = (bs.w / 2) * sin + (bs.d / 2) * cos;
      this.staticColliders.push({
        minX: bs.x - hw,
        maxX: bs.x + hw,
        minY: gy,
        maxY: gy + bs.h + 0.15,
        minZ: bs.z - hd,
        maxZ: bs.z + hd,
        kind: 'solid',
      });
    });

    // 7. Instanced Trees & Boulders around outer tactical zone (Natural Outdoor Perimeter)
    this.buildInstancedFoliageAndRocks();

    // 8. Shrinking Safe Zone Cylindrical Forcefield
    const zoneGeo = new THREE.CylinderGeometry(1, 1, 55, 64, 1, true);
    const zoneMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.zoneCylinder = new THREE.Mesh(zoneGeo, zoneMat);
    this.zoneCylinder.position.set(0, 22, 0);
    this.zoneCylinder.scale.set(this.zoneRadius, 1, this.zoneRadius);
    this.scene.add(this.zoneCylinder);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private buildInstancedFoliageAndRocks(): void {
    // 85 Pine Trees (Instanced trunks + Instanced foliage cones)
    const treeCount = 85;
    const trunkGeo = new THREE.CylinderGeometry(0.24, 0.36, 3.2, 7);
    trunkGeo.translate(0, 1.6, 0);
    const trunkMat = new THREE.MeshStandardMaterial({
      map: this.textures.bark,
      roughness: 0.9,
      metalness: 0.02,
    });
    const canopyGeo = new THREE.ConeGeometry(2.1, 5.4, 8);
    canopyGeo.translate(0, 4.9, 0);
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x3b5932,
      roughness: 0.82,
      metalness: 0.04,
    });

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, treeCount);
    trunks.castShadow = !this.isSoftwareGl;
    canopies.castShadow = !this.isSoftwareGl;
    canopies.receiveShadow = true;

    let placed = 0;
    let seed = 1337;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    while (placed < treeCount) {
      const ang = rand() * Math.PI * 2;
      const rad = 38 + rand() * 88;
      const x = Math.cos(ang) * rad;
      const z = Math.sin(ang) * rad;
      const gy = groundHeightAt(x, z);
      const scale = 0.85 + rand() * 0.35;

      _dummy.position.set(x, gy - 0.1, z);
      _dummy.rotation.set(0, rand() * Math.PI * 2, 0);
      _dummy.scale.setScalar(scale);
      _dummy.updateMatrix();
      trunks.setMatrixAt(placed, _dummy.matrix);
      canopies.setMatrixAt(placed, _dummy.matrix);

      _color.setHSL(0.27 + (rand() - 0.5) * 0.05, 0.35, 0.25 + rand() * 0.12);
      canopies.setColorAt(placed, _color);

      if (rad < ARENA_PLAYABLE_RADIUS) {
        this.staticColliders.push({
          minX: x - 0.45 * scale,
          maxX: x + 0.45 * scale,
          minY: gy,
          maxY: gy + 3.5 * scale,
          minZ: z - 0.45 * scale,
          maxZ: z + 0.45 * scale,
          kind: 'solid',
        });
      }
      placed++;
    }
    trunks.instanceMatrix.needsUpdate = true;
    canopies.instanceMatrix.needsUpdate = true;
    if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
    trunks.computeBoundingSphere();
    canopies.computeBoundingSphere();
    this.scene.add(trunks, canopies);
    this.worldRaycastMeshes.push(trunks, canopies);

    // 70 Tactical Boulders
    const rockCount = 70;
    const rockGeo = new THREE.DodecahedronGeometry(1.5, 1);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x676258,
      roughness: 0.9,
      metalness: 0.08,
    });
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
    rocks.castShadow = !this.isSoftwareGl;
    rocks.receiveShadow = true;

    for (let i = 0; i < rockCount; i++) {
      const ang = rand() * Math.PI * 2;
      const rad = 32 + rand() * 82;
      const x = Math.cos(ang) * rad;
      const z = Math.sin(ang) * rad;
      const gy = groundHeightAt(x, z);
      const sx = 0.8 + rand() * 1.1;
      const sy = 0.65 + rand() * 0.85;
      const sz = 0.8 + rand() * 1.1;

      _dummy.position.set(x, gy + sy * 0.45, z);
      _dummy.rotation.set(rand() * 2, rand() * 2, rand() * 2);
      _dummy.scale.set(sx, sy, sz);
      _dummy.updateMatrix();
      rocks.setMatrixAt(i, _dummy.matrix);

      _color.setHSL(0.1, 0.08, 0.35 + rand() * 0.14);
      rocks.setColorAt(i, _color);

      if (rad < ARENA_PLAYABLE_RADIUS) {
        const rRad = Math.max(sx, sz) * 1.15;
        this.staticColliders.push({
          minX: x - rRad,
          maxX: x + rRad,
          minY: gy,
          maxY: gy + sy * 1.6,
          minZ: z - rRad,
          maxZ: z + rRad,
          kind: 'solid',
        });
      }
    }
    rocks.instanceMatrix.needsUpdate = true;
    if (rocks.instanceColor) rocks.instanceColor.needsUpdate = true;
    rocks.computeBoundingSphere();
    this.scene.add(rocks);
    this.worldRaycastMeshes.push(rocks);
  }

  private initViewmodels(): void {
    this.camera.add(this.viewmodelAnchor);
    (['ak47', 'mp40', 'm1887', 'awm'] as WeaponId[]).forEach((wId) => {
      const vm = createViewmodelWeapon(wId);
      vm.root.visible = false;
      this.viewmodelAnchor.add(vm.root);
      this.viewmodels[wId] = vm;
    });
    this.viewmodelAnchor.visible = false;
  }

  private initFxPools(): void {
    // Pooled Tracer Streaks
    const tracerGeo = new THREE.CylinderGeometry(0.014, 0.014, 1.0, 5);
    tracerGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < 24; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffd166,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(tracerGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.tracers.push({ mesh, life: 0, maxLife: 0.09 });
    }

    // Pooled Spark / Dust Particles
    const pGeo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
    for (let i = 0; i < 64; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff9f1c,
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(pGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.particles.push({ mesh, vel: new THREE.Vector3(), life: 0, maxLife: 0.35 });
    }
  }

  private spawnTitleShowcaseBots(): void {
    this.clearDynamicEntities();
    // Spawn 6 patrolling soldiers around the compound for the live Title camera flyover
    const spots = [
      { x: -7, z: -5, v: 'assault' as EnemyVariant },
      { x: 8, z: -6, v: 'rusher' as EnemyVariant },
      { x: -12, z: 8, v: 'heavy' as EnemyVariant },
      { x: 10, z: 10, v: 'sniper' as EnemyVariant },
      { x: 2, z: -18, v: 'assault' as EnemyVariant },
      { x: -20, z: -2, v: 'rusher' as EnemyVariant },
    ];
    spots.forEach((sp, idx) => {
      this.spawnEnemyAt(sp.x, sp.z, sp.v, BOT_CALLSIGNS[idx]);
    });
    this.spawnSupplyDropsAndLoot();
  }

  public startGame(mode: GameMode, rewardedDrop = false): void {
    initAnalytics();
    initMonetag();
    this.sound.unlock();
    this.mode = mode;
    this.phase = 'playing';
    this.matchTime = 0;
    this.hitstopTimer = 0;
    trackGameEvent('game_start', { mode, rewarded_drop: rewardedDrop });

    // Reset player stats
    this.playerPos.set(0, groundHeightAt(0, 22), 22);
    this.playerVel.set(0, 0, 0);
    this.playerYaw = 0;
    this.playerPitch = 0;
    this.grounded = true;
    this.hp = 200;
    this.maxHp = 200;
    this.shield = rewardedDrop ? 150 : 100;
    this.maxShield = 150;
    this.stamina = 100;
    this.glooWalls = rewardedDrop ? 5 : 3;
    this.medkits = rewardedDrop ? 3 : 2;
    this.kills = 0;
    this.headshots = 0;
    this.damageDealt = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.killstreak = 0;

    this.isCrouching = false;
    this.slideTimer = 0;
    this.isAds = false;
    this.fireCooldown = 0;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.recoilPitch = 0;
    this.recoilYawOffset = 0;
    this.cameraShake = 0;
    this.damageFlash = 0;
    this.damageDirAngle = null;
    this.killFeed = [];
    this.activeMedal = null;

    this.slots = [
      { id: 'ak47', mag: WEAPONS.ak47.magSize, reserve: 120 },
      { id: 'mp40', mag: WEAPONS.mp40.magSize, reserve: 144 },
      rewardedDrop
        ? { id: 'awm', mag: WEAPONS.awm.magSize, reserve: 20 }
        : { id: 'm1887', mag: WEAPONS.m1887.magSize, reserve: 18 },
    ];
    this.activeSlotIndex = 0;
    this.viewmodelAnchor.visible = true;

    // Reset Safe Zone
    this.zoneCenter.set((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20);
    this.zoneRadius = mode === 'battle-royale' ? 110 : 75;
    this.zoneStartRadius = this.zoneRadius;
    this.targetZoneRadius = ZONE_PHASES[0].targetRadius;
    this.zonePhaseIndex = 0;
    this.zoneTimer = ZONE_PHASES[0].wait;
    this.zoneShrinking = false;
    this.zoneCylinder.position.set(this.zoneCenter.x, 22, this.zoneCenter.y);
    this.zoneCylinder.scale.set(this.zoneRadius, 1, this.zoneRadius);
    this.zoneCylinder.visible = mode === 'battle-royale';

    // Reset World Entities
    this.clearDynamicEntities();
    this.spawnSupplyDropsAndLoot();

    if (mode === 'battle-royale') {
      this.totalCombatants = 24;
      this.aliveCount = 24;
      this.placement = 24;
      this.botDuelTimer = 4.2;
      this.spawnBattleRoyaleBots(23);
    } else {
      this.blitzWave = 1;
      this.totalCombatants = 12;
      this.aliveCount = 6;
      this.placement = 1;
      this.spawnBlitzWave(1);
    }

    this.requestLock();
    this.pushHud(true);
  }

  private clearDynamicEntities(): void {
    this.enemies.forEach((e) => this.scene.remove(e.visual.root));
    this.enemies = [];
    this.glooBarriers.forEach((g) => this.scene.remove(g.mesh));
    this.glooBarriers = [];
    this.lootItems.forEach((l) => this.scene.remove(l.mesh));
    this.lootItems = [];
    this.rebuildColliders();
  }

  private rebuildColliders(): void {
    this.allColliders = [...this.staticColliders];
    for (let i = 0; i < this.glooBarriers.length; i++) {
      this.allColliders.push(this.glooBarriers[i].collider);
    }
  }

  private spawnEnemyAt(x: number, z: number, variant: EnemyVariant, name: string): void {
    const gy = groundHeightAt(x, z);
    const visual = createEnemySoldier(variant);
    visual.root.position.set(x, gy, z);
    this.scene.add(visual.root);

    const maxHp =
      variant === 'heavy' ? 210 : variant === 'rusher' ? 110 : variant === 'sniper' ? 105 : 135;

    this.enemies.push({
      id: this.enemies.length + 1,
      name,
      variant,
      hp: maxHp,
      maxHp,
      pos: new THREE.Vector3(x, gy, z),
      vel: new THREE.Vector3(),
      yaw: Math.random() * Math.PI * 2,
      visual,
      alive: true,
      fireCooldown: 0.7 + Math.random() * 1.1,
      windupTimer: 0,
      windingUp: false,
      hitFlashTimer: 0,
      muzzleTimer: 0,
      strafeDir: Math.random() > 0.5 ? 1 : -1,
      strafeTimer: 1.5 + Math.random() * 2,
      patrolTarget: new THREE.Vector3(x, gy, z),
      walkPhase: Math.random() * Math.PI * 2,
      botFightTimer: 6 + Math.random() * 14,
    });
  }

  private spawnBattleRoyaleBots(count: number): void {
    const variants: EnemyVariant[] = ['assault', 'rusher', 'assault', 'sniper', 'heavy'];
    for (let i = 0; i < count; i++) {
      // First 5 bots near compound for immediate action, others spread across the island
      const near = i < 5;
      const ang = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const dist = near ? 22 + Math.random() * 18 : 42 + Math.random() * 58;
      const x = Math.cos(ang) * dist;
      const z = Math.sin(ang) * dist;
      const variant = variants[i % variants.length];
      this.spawnEnemyAt(x, z, variant, BOT_CALLSIGNS[i % BOT_CALLSIGNS.length]);
    }
  }

  private spawnBlitzWave(wave: number): void {
    const count = 4 + wave * 2;
    this.aliveCount = count;
    const variants: EnemyVariant[] = ['assault', 'rusher', 'heavy', 'sniper'];
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const dist = 26 + Math.random() * 22;
      const x = Math.cos(ang) * dist;
      const z = Math.sin(ang) * dist;
      this.spawnEnemyAt(
        x,
        z,
        variants[(i + wave) % variants.length],
        `ESCUADRÓN-${wave}.${i + 1}`
      );
    }
  }

  private spawnSupplyDropsAndLoot(): void {
    // 2 Tactical Supply Drops
    const drops: Array<{ x: number; z: number; kind: LootKind }> = [
      { x: 0, z: -2, kind: 'weapon_awm' },
      { x: -28, z: 18, kind: 'weapon_m1887' },
    ];
    drops.forEach((d) => {
      const gy = groundHeightAt(d.x, d.z);
      const mesh = createSupplyDrop(this.textures);
      mesh.position.set(d.x, gy, d.z);
      this.scene.add(mesh);
      this.lootItems.push({
        id: this.nextLootId++,
        kind: d.kind,
        mesh,
        pos: new THREE.Vector3(d.x, gy, d.z),
        collected: false,
        isSupplyDrop: true,
      });
    });

    // 18 Tactical Ground Pickups
    const kinds: LootKind[] = ['medkit', 'shield', 'gloo', 'ammo'];
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2 + 0.2;
      const rad = i < 8 ? 10 + Math.random() * 14 : 26 + Math.random() * 52;
      const x = Math.cos(ang) * rad;
      const z = Math.sin(ang) * rad;
      const gy = groundHeightAt(x, z);
      const kind = kinds[i % kinds.length];
      const mesh = createLootPickup(kind);
      mesh.position.set(x, gy, z);
      this.scene.add(mesh);
      this.lootItems.push({
        id: this.nextLootId++,
        kind,
        mesh,
        pos: new THREE.Vector3(x, gy, z),
        collected: false,
      });
    }
  }

  private spawnLootDropAt(x: number, z: number, kind: LootKind): void {
    const gy = groundHeightAt(x, z);
    const mesh = createLootPickup(kind);
    mesh.position.set(x, gy, z);
    this.scene.add(mesh);
    this.lootItems.push({
      id: this.nextLootId++,
      kind,
      mesh,
      pos: new THREE.Vector3(x, gy, z),
      collected: false,
    });
  }

  public resumeGame(): void {
    if (this.phase === 'paused') {
      this.phase = 'playing';
      this.requestLock();
      this.pushHud(true);
    }
  }

  public pauseGame(): void {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.mouseDownLeft = false;
      this.mouseDownRight = false;
      this.isAds = false;
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
      this.pushHud(true);
    }
  }

  public returnToTitle(): void {
    this.phase = 'title';
    this.viewmodelAnchor.visible = false;
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    this.spawnTitleShowcaseBots();
    this.pushHud(true);
  }

  public toggleMute(): void {
    this.sound.toggleMute();
    this.pushHud(true);
  }

  public setSensitivity(val: number): void {
    this.sensitivity = THREE.MathUtils.clamp(val, 0.3, 2.5);
    this.pushHud(true);
  }

  private requestLock(): void {
    try {
      const p = this.renderer.domElement.requestPointerLock?.() as unknown as Promise<void> | undefined;
      if (p && typeof p.catch === 'function') {
        p.catch(() => {});
      }
    } catch {
      // Fallback drag/aim continues seamlessly
    }
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResizeBound);
    window.addEventListener('keydown', this.handleKeyDownBound);
    window.addEventListener('keyup', this.handleKeyUpBound);
    window.addEventListener('blur', this.handleBlurBound);
    document.addEventListener('pointerlockchange', this.handlePointerLockChangeBound);

    const dom = this.renderer.domElement;
    dom.addEventListener('mousedown', this.handleMouseDownBound);
    window.addEventListener('mouseup', this.handleMouseUpBound);
    window.addEventListener('mousemove', this.handleMouseMoveBound);
    dom.addEventListener('wheel', this.handleWheelBound, { passive: true });
    dom.addEventListener('contextmenu', this.handleContextMenuBound);
  }

  private onResize(): void {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private onPointerLockChange(): void {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    this.pushHud(true);
  }

  private onWindowBlur(): void {
    this.keys = {};
    this.mouseDownLeft = false;
    this.mouseDownRight = false;
    this.draggingLook = false;
  }

  private onKeyDown(e: KeyboardEvent): void {
    this.keys[e.code] = true;

    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (this.phase === 'playing') {
        this.pauseGame();
      } else if (this.phase === 'paused') {
        this.resumeGame();
      }
      return;
    }

    if (this.phase !== 'playing') return;

    if (e.code === 'Digit1') this.switchWeapon(0);
    if (e.code === 'Digit2') this.switchWeapon(1);
    if (e.code === 'Digit3' && this.slots[2]) this.switchWeapon(2);
    if (e.code === 'KeyR') this.startReload();
    if (e.code === 'KeyG') this.deployGlooWall();
    if (e.code === 'KeyF') this.useMedkit();
    if (e.code === 'KeyE') this.interactNearby();
    if (e.code === 'KeyQ' || e.code === 'KeyV') this.isAds = !this.isAds;
    if (e.code === 'KeyC' || e.code === 'ControlLeft') this.triggerCrouchOrSlide();
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keys[e.code] = false;
  }

  private onMouseDown(e: MouseEvent): void {
    if (this.phase !== 'playing') return;
    this.sound.unlock();

    if (!this.pointerLocked) {
      this.requestLock();
    }

    if (e.button === 0) {
      this.mouseDownLeft = true;
      this.draggingLook = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      // Single-shot weapons fire immediately on click
      const w = WEAPONS[this.slots[this.activeSlotIndex].id];
      if (!w.automatic) {
        this.tryFirePlayer();
      }
    } else if (e.button === 2) {
      this.mouseDownRight = true;
      this.isAds = true;
    }
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button === 0) {
      this.mouseDownLeft = false;
      this.draggingLook = false;
    } else if (e.button === 2) {
      this.mouseDownRight = false;
      this.isAds = false;
    }
  }

  private onMouseMove(e: MouseEvent): void {
    if (this.phase !== 'playing') return;
    const sens = (this.isAds ? 0.0014 : 0.0023) * this.sensitivity;

    if (this.pointerLocked) {
      this.playerYaw -= e.movementX * sens;
      this.playerPitch -= e.movementY * sens;
      this.playerPitch = THREE.MathUtils.clamp(this.playerPitch, -1.38, 1.38);
    } else if (this.draggingLook) {
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.playerYaw -= dx * sens * 1.4;
      this.playerPitch -= dy * sens * 1.4;
      this.playerPitch = THREE.MathUtils.clamp(this.playerPitch, -1.38, 1.38);
    }
  }

  private onWheel(e: WheelEvent): void {
    if (this.phase !== 'playing') return;
    const dir = e.deltaY > 0 ? 1 : -1;
    const next = (this.activeSlotIndex + dir + this.slots.length) % this.slots.length;
    this.switchWeapon(next);
  }

  private switchWeapon(idx: number): void {
    if (idx < 0 || idx >= this.slots.length || idx === this.activeSlotIndex) return;
    this.activeSlotIndex = idx;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.viewmodelKickZ = 0.08;
    this.pushHud(true);
  }

  private startReload(): void {
    const slot = this.slots[this.activeSlotIndex];
    const spec = WEAPONS[slot.id];
    if (this.isReloading || slot.mag >= spec.magSize || slot.reserve <= 0) return;
    this.isReloading = true;
    this.reloadTimer = spec.reloadTime;
    this.isAds = false;
    this.sound.playReload();
    this.pushHud(true);
  }

  private triggerCrouchOrSlide(): void {
    const sprinting = Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight']) && !this.isAds;
    if (sprinting && this.grounded && this.slideTimer <= 0 && this.stamina >= 18) {
      this.slideTimer = 0.52;
      this.stamina -= 18;
      this.isCrouching = true;
      this.sound.playSlide();
    } else {
      this.isCrouching = !this.isCrouching;
    }
  }

  private useMedkit(): void {
    if (this.medkits <= 0 || this.hp >= this.maxHp) return;
    this.medkits--;
    this.hp = Math.min(this.maxHp, this.hp + 70);
    this.sound.playHeal();
    this.triggerMedal('BOTIQUÍN APLICADO', '+70 SALUD TÁCTICA', 0, '#22c55e');
    this.pushHud(true);
  }

  private deployGlooWall(): void {
    if (this.glooWalls <= 0) return;
    this.glooWalls--;
    this.sound.playGlooDeploy();

    const forwardX = -Math.sin(this.playerYaw);
    const forwardZ = -Math.cos(this.playerYaw);
    const gx = this.playerPos.x + forwardX * 3.1;
    const gz = this.playerPos.z + forwardZ * 3.1;
    const gy = groundHeightAt(gx, gz);

    const mesh = createGlooWallMesh(this.textures);
    mesh.position.set(gx, gy, gz);
    mesh.rotation.y = this.playerYaw;
    this.scene.add(mesh);

    const cos = Math.abs(Math.cos(this.playerYaw));
    const sin = Math.abs(Math.sin(this.playerYaw));
    const hw = 1.95 * cos + 0.25 * sin;
    const hd = 1.95 * sin + 0.25 * cos;

    const id = this.nextGlooId++;
    const collider: ColliderBox = {
      minX: gx - hw,
      maxX: gx + hw,
      minY: gy,
      maxY: gy + 2.5,
      minZ: gz - hd,
      maxZ: gz + hd,
      kind: 'gloo',
      glooId: id,
    };

    this.glooBarriers.push({
      id,
      mesh,
      collider,
      hp: 340,
      pos: new THREE.Vector3(gx, gy, gz),
    });
    this.rebuildColliders();
    this.spawnParticles(new THREE.Vector3(gx, gy + 1.2, gz), 0x38bdf8, 12);
    this.pushHud(true);
  }

  private interactNearby(): void {
    for (let i = 0; i < this.lootItems.length; i++) {
      const item = this.lootItems[i];
      if (item.collected) continue;
      const dist = item.pos.distanceTo(this.playerPos);
      if (dist < 3.4) {
        this.collectLoot(item);
        break;
      }
    }
  }

  private collectLoot(item: LootItem): void {
    item.collected = true;
    item.mesh.visible = false;
    this.sound.playPickup();

    if (item.kind === 'medkit') {
      this.medkits++;
      this.triggerMedal('BOTIQUÍN', '+1 KIT MÉDICO', 0, '#22c55e');
    } else if (item.kind === 'shield') {
      this.shield = Math.min(this.maxShield, this.shield + 65);
      this.triggerMedal('CHALECO NIVEL 3', '+65 BLINDAJE', 0, '#38bdf8');
    } else if (item.kind === 'gloo') {
      this.glooWalls = Math.min(8, this.glooWalls + 2);
      this.triggerMedal('PARED GLOO', '+2 ESCUDOS GLOO', 0, '#06b6d4');
    } else if (item.kind === 'ammo') {
      this.slots.forEach((s) => {
        s.reserve = Math.min(WEAPONS[s.id].maxReserve, s.reserve + Math.round(WEAPONS[s.id].magSize * 1.5));
      });
      this.triggerMedal('MUNICIÓN TÁCTICA', 'CARGADORES REABASTECIDOS', 0, '#f59e0b');
    } else if (item.kind === 'weapon_awm') {
      this.slots[2] = { id: 'awm', mag: WEAPONS.awm.magSize, reserve: 20 };
      this.activeSlotIndex = 2;
      this.shield = Math.min(this.maxShield, this.shield + 75);
      this.glooWalls = Math.min(8, this.glooWalls + 2);
      this.triggerMedal('SUMINISTRO ÉPICO', 'AWM FANTASMA + BLINDAJE', 0, '#facc15');
    } else if (item.kind === 'weapon_m1887') {
      this.slots[2] = { id: 'm1887', mag: WEAPONS.m1887.magSize, reserve: 24 };
      this.activeSlotIndex = 2;
      this.medkits++;
      this.triggerMedal('SUMINISTRO DE ASALTO', 'M1887 BESTIA + BOTIQUÍN', 0, '#ef4444');
    }
    this.pushHud(true);
  }

  private tryFirePlayer(): void {
    if (this.phase !== 'playing' || this.isReloading || this.fireCooldown > 0) return;
    const slot = this.slots[this.activeSlotIndex];
    const spec = WEAPONS[slot.id];

    if (slot.mag <= 0) {
      this.sound.playEmptyClick();
      this.fireCooldown = 0.25;
      if (slot.reserve > 0) this.startReload();
      return;
    }

    slot.mag--;
    this.fireCooldown = 1 / spec.fireRate;
    this.shotsFired++;
    this.sound.playGunshot(slot.id, 1);

    // Recoil & Muzzle Flash
    this.recoilPitch += spec.recoilKick * (this.isAds ? 0.65 : 1.0);
    this.recoilYawOffset += (Math.random() - 0.5) * spec.recoilYaw;
    this.viewmodelKickZ = spec.id === 'awm' || spec.id === 'm1887' ? 0.14 : 0.065;
    this.viewmodelMuzzleTimer = 0.045;
    this.muzzlePointLight.intensity = 4.5;
    this.cameraShake = Math.max(this.cameraShake, spec.id === 'm1887' ? 0.035 : 0.015);

    const vm = this.viewmodels[slot.id];
    const muzzleWorld = new THREE.Vector3();
    if (vm) {
      vm.muzzleFlash.visible = true;
      vm.muzzleFlash.rotation.z = Math.random() * Math.PI;
      vm.muzzleTip.getWorldPosition(muzzleWorld);
    } else {
      muzzleWorld.copy(this.camera.position);
    }

    // Raycast Pellets
    const spread = this.isAds ? spec.adsSpread : spec.hipSpread * (this.isCrouching ? 0.72 : 1.0);
    const enemyHitMeshes: THREE.Object3D[] = [];
    for (let i = 0; i < this.enemies.length; i++) {
      if (this.enemies[i].alive) {
        enemyHitMeshes.push(this.enemies[i].visual.headHitbox, this.enemies[i].visual.bodyHitbox);
      }
    }

    let anyHit = false;
    let anyHeadshot = false;
    let anyKill = false;

    for (let p = 0; p < spec.pellets; p++) {
      _dir.set(0, 0, -1);
      _dir.x += (Math.random() - 0.5) * spread * 2;
      _dir.y += (Math.random() - 0.5) * spread * 2;
      _dir.normalize();
      _dir.applyQuaternion(this.camera.quaternion);

      this.raycaster.set(this.camera.position, _dir);
      this.raycaster.near = 0.2;
      this.raycaster.far = spec.range;

      // Check world & gloo cover distance first
      this.raycaster.layers.set(0);
      const glooMeshes = this.glooBarriers.map((g) => g.mesh);
      const worldHits = this.raycaster.intersectObjects([...this.worldRaycastMeshes, ...glooMeshes], true);
      const coverDist = worldHits.length > 0 ? worldHits[0].distance : spec.range;

      // Check enemy hitboxes on layer 1
      this.raycaster.layers.set(1);
      const eHits = this.raycaster.intersectObjects(enemyHitMeshes, false);

      let endPoint = _vec3A.copy(this.camera.position).addScaledVector(_dir, coverDist);

      if (eHits.length > 0 && eHits[0].distance <= coverDist) {
        const hit = eHits[0];
        endPoint.copy(hit.point);
        const enemy = this.enemies.find(
          (en) => en.alive && (en.visual.headHitbox === hit.object || en.visual.bodyHitbox === hit.object)
        );
        if (enemy) {
          anyHit = true;
          const isHead = enemy.visual.headHitbox === hit.object;
          if (isHead) anyHeadshot = true;
          const dmg = Math.round(spec.damage * (isHead ? spec.headshotMult : 1.0));
          const killed = this.damageEnemy(enemy, dmg, isHead, hit.point, spec.name);
          if (killed) anyKill = true;
        }
      } else if (worldHits.length > 0) {
        const wHit = worldHits[0];
        this.spawnParticles(wHit.point, 0xd4d4d8, 4);
        // Check if hit a Gloo Wall
        for (let g = 0; g < this.glooBarriers.length; g++) {
          const gloo = this.glooBarriers[g];
          let belongs = false;
          wHit.object.traverseAncestors((anc) => {
            if (anc === gloo.mesh) belongs = true;
          });
          if (belongs) {
            this.damageGlooBarrier(gloo, spec.damage);
            this.spawnParticles(wHit.point, 0x38bdf8, 6);
            break;
          }
        }
      }

      this.spawnTracer(muzzleWorld, endPoint, isHeadColor(anyHeadshot));
    }

    if (anyHit) {
      this.shotsHit++;
      this.hitmarkerKey++;
      this.hitmarkerHeadshot = anyHeadshot;
      this.hitmarkerKill = anyKill;
      this.sound.playHitmarker(anyHeadshot, anyKill);
      if (anyKill && (anyHeadshot || slot.id === 'm1887' || slot.id === 'awm')) {
        this.hitstopTimer = 0.036; // Crisp 36ms impact hitstop
      }
    }

    if (slot.mag === 0 && slot.reserve > 0) {
      this.startReload();
    }
  }

  private damageEnemy(
    enemy: EnemyActor,
    dmg: number,
    isHeadshot: boolean,
    hitPoint: THREE.Vector3,
    weaponName: string
  ): boolean {
    if (!enemy.alive) return false;
    enemy.hp -= dmg;
    this.damageDealt += dmg;
    enemy.hitFlashTimer = 0.1;

    // Hit flash on armor
    enemy.visual.armorMeshes.forEach((m) => {
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissive.setHex(isHeadshot ? 0xff3b30 : 0xffffff);
      mat.emissiveIntensity = isHeadshot ? 1.4 : 0.7;
    });

    this.spawnParticles(hitPoint, isHeadshot ? 0xff3b30 : 0xffaa00, isHeadshot ? 10 : 6);

    if (enemy.hp <= 0) {
      enemy.alive = false;
      enemy.visual.root.rotation.x = -Math.PI / 2;
      enemy.visual.root.position.y += 0.25;
      enemy.visual.telegraphBeam.visible = false;
      setTimeout(() => {
        if (!this.disposed) this.scene.remove(enemy.visual.root);
      }, 900);

      this.kills++;
      this.killstreak++;
      if (isHeadshot) this.headshots++;
      this.aliveCount = Math.max(1, this.aliveCount - 1);

      this.pushKillFeed('TÚ', enemy.name, weaponName, isHeadshot, true);
      if (isHeadshot) {
        this.triggerMedal('TIRO A LA CABEZA', `ELIMINASTE A ${enemy.name}`, 150, '#ff3d5a');
      } else if (this.killstreak >= 3) {
        this.triggerMedal(`RACHA x${this.killstreak}`, 'DOMINIO TÁCTICO', 200, '#facc15');
      } else {
        this.triggerMedal('BAJA CONFIRMADA', enemy.name, 100, '#ff8c2a');
      }

      // Drop tactical loot on death
      const dropKind: LootKind = Math.random() < 0.35 ? 'medkit' : Math.random() < 0.65 ? 'gloo' : 'shield';
      this.spawnLootDropAt(enemy.pos.x, enemy.pos.z, dropKind);

      // Check Victory!
      if (this.mode === 'battle-royale') {
        const remainingBots = this.enemies.filter((e) => e.alive).length;
        this.aliveCount = remainingBots + 1;
        if (remainingBots === 0) {
          this.triggerVictory();
        }
      } else {
        const remainingBots = this.enemies.filter((e) => e.alive).length;
        this.aliveCount = remainingBots;
        if (remainingBots === 0) {
          if (this.blitzWave >= 3) {
            this.triggerVictory();
          } else {
            this.blitzWave++;
            this.triggerMedal(`OLEADA ${this.blitzWave}`, 'REFUERZOS EN CAMINO', 250, '#00e5ff');
            this.spawnBlitzWave(this.blitzWave);
          }
        }
      }
      return true;
    }
    return false;
  }

  private damageGlooBarrier(gloo: GlooBarrier, dmg: number): void {
    gloo.hp -= dmg;
    if (gloo.hp <= 0) {
      this.scene.remove(gloo.mesh);
      this.glooBarriers = this.glooBarriers.filter((g) => g.id !== gloo.id);
      this.rebuildColliders();
      this.spawnParticles(gloo.pos.clone().setY(gloo.pos.y + 1.2), 0x38bdf8, 18);
    }
  }

  private damagePlayer(dmg: number, attackerPos: THREE.Vector3 | null, attackerName: string): void {
    if (this.phase !== 'playing') return;
    this.sound.playDamageTaken();
    this.damageFlash = 1.0;
    this.cameraShake = Math.max(this.cameraShake, 0.045);

    if (attackerPos) {
      const dx = attackerPos.x - this.playerPos.x;
      const dz = attackerPos.z - this.playerPos.z;
      const angleToEnemy = Math.atan2(dx, -dz);
      this.damageDirAngle = angleToEnemy + this.playerYaw;
    } else {
      this.damageDirAngle = null;
    }

    let remaining = dmg;
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, remaining * 0.65);
      this.shield -= absorbed;
      remaining -= absorbed;
    }
    this.hp = Math.max(0, this.hp - remaining);

    if (this.hp <= 0) {
      this.placement = this.mode === 'battle-royale' ? this.aliveCount : 1;
      this.pushKillFeed(attackerName, 'TÚ', 'AK-47', false, false);
      this.phase = 'gameover';
      trackGameEvent('match_complete', {
        outcome: 'defeat',
        kills: this.kills,
        placement: this.placement,
      });
      if (document.pointerLockElement) document.exitPointerLock();
      this.pushHud(true);
    }
  }

  private triggerVictory(): void {
    this.placement = 1;
    this.phase = 'victory';
    this.sound.playVictory();
    trackGameEvent('booyah_victory', {
      mode: this.mode,
      kills: this.kills,
      headshots: this.headshots,
    });
    if (document.pointerLockElement) document.exitPointerLock();
    this.pushHud(true);
  }

  private pushKillFeed(
    killer: string,
    victim: string,
    weapon: string,
    headshot: boolean,
    isPlayerKill: boolean
  ): void {
    this.killFeed.unshift({
      id: this.nextFeedId++,
      killer,
      victim,
      weapon,
      headshot,
      isPlayerKill,
      timestamp: performance.now(),
    });
    if (this.killFeed.length > 5) this.killFeed.pop();
  }

  private triggerMedal(title: string, subtitle: string, points: number, color: string): void {
    this.activeMedal = {
      id: this.nextMedalId++,
      title,
      subtitle,
      points,
      color,
    };
    this.medalTimer = 2.1;
  }

  private spawnTracer(start: THREE.Vector3, end: THREE.Vector3, critical: boolean): void {
    const tracer = this.tracers.find((t) => t.life <= 0);
    if (!tracer) return;
    const dist = start.distanceTo(end);
    if (dist < 0.2) return;

    tracer.life = tracer.maxLife;
    tracer.mesh.visible = true;
    tracer.mesh.position.copy(start).lerp(end, 0.5);
    tracer.mesh.lookAt(end);
    tracer.mesh.scale.set(1, 1, dist);
    (tracer.mesh.material as THREE.MeshBasicMaterial).color.setHex(critical ? 0xff3d5a : 0xffd166);
  }

  private spawnParticles(pos: THREE.Vector3, colorHex: number, count: number): void {
    let spawned = 0;
    for (let i = 0; i < this.particles.length && spawned < count; i++) {
      const p = this.particles[i];
      if (p.life <= 0) {
        p.life = p.maxLife;
        p.mesh.visible = true;
        p.mesh.position.copy(pos);
        p.mesh.scale.setScalar(1);
        (p.mesh.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
        p.vel.set(
          (Math.random() - 0.5) * 6.5,
          1.5 + Math.random() * 4.5,
          (Math.random() - 0.5) * 6.5
        );
        spawned++;
      }
    }
  }

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => {
        if (!this.disposed) this.tick();
      });
    } else {
      this.frameId = requestAnimationFrame(() => this.tick());
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick(): void {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(rawDt, 0.05);

    if (this.phase === 'title') {
      this.updateTitleShowcase(dt);
    } else if (this.phase === 'playing') {
      if (this.hitstopTimer > 0) {
        this.hitstopTimer -= dt;
      } else {
        this.matchTime += dt;
        this.updatePlayer(dt);
        this.updateWeapons(dt);
        this.updateEnemies(dt);
        this.updateZone(dt);
        this.updateLoot(dt);
      }
      this.updateFx(dt);
      this.pushHud(false);
    }

    this.renderer.render(this.scene, this.camera);
    this.scheduleNextFrame();
  }

  private updateTitleShowcase(dt: number): void {
    this.titleOrbitAngle += dt * 0.14;
    const r = 34;
    const cx = Math.cos(this.titleOrbitAngle) * r;
    const cz = Math.sin(this.titleOrbitAngle) * r;
    this.camera.position.set(cx, 13.5 + Math.sin(this.titleOrbitAngle * 2) * 1.4, cz);
    this.camera.lookAt(0, 2.5, 0);

    // Animate showcase bots gently patrolling
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      e.walkPhase += dt * 4.5;
      e.yaw += dt * 0.35 * (i % 2 === 0 ? 1 : -1);
      e.visual.root.rotation.y = e.yaw;
      e.visual.leftLeg.rotation.x = Math.sin(e.walkPhase) * 0.35;
      e.visual.rightLeg.rotation.x = -Math.sin(e.walkPhase) * 0.35;
    }

    // Bob loot
    for (let i = 0; i < this.lootItems.length; i++) {
      const l = this.lootItems[i];
      if (!l.isSupplyDrop) {
        l.mesh.children[1].rotation.y += dt * 1.8;
      }
    }
  }

  private updatePlayer(dt: number): void {
    // Arrow key fallback rotation (helpful if pointer lock is unavailable)
    if (this.keys['ArrowLeft']) this.playerYaw += 2.2 * dt;
    if (this.keys['ArrowRight']) this.playerYaw -= 2.2 * dt;
    if (this.keys['ArrowUp']) this.playerPitch = Math.min(1.3, this.playerPitch + 1.6 * dt);
    if (this.keys['ArrowDown']) this.playerPitch = Math.max(-1.3, this.playerPitch - 1.6 * dt);

    // Movement input
    let moveForward = 0;
    let moveRight = 0;
    if (this.keys['KeyW']) moveForward += 1;
    if (this.keys['KeyS']) moveForward -= 1;
    if (this.keys['KeyD']) moveRight += 1;
    if (this.keys['KeyA']) moveRight -= 1;

    const moving = moveForward !== 0 || moveRight !== 0;
    const wantsSprint =
      Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight']) &&
      moveForward > 0 &&
      !this.isAds &&
      !this.isCrouching &&
      this.stamina > 2;

    if (wantsSprint) {
      this.stamina = Math.max(0, this.stamina - 22 * dt);
    } else {
      this.stamina = Math.min(100, this.stamina + 16 * dt);
    }

    if (this.slideTimer > 0) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) this.isCrouching = false;
    }

    let speed = 7.4;
    if (this.slideTimer > 0) speed = 13.8;
    else if (wantsSprint) speed = 11.2;
    else if (this.isAds) speed = 4.6;
    else if (this.isCrouching) speed = 4.3;

    const sinY = Math.sin(this.playerYaw);
    const cosY = Math.cos(this.playerYaw);

    _vec3A.set(0, 0, 0);
    if (moving || this.slideTimer > 0) {
      const mf = this.slideTimer > 0 ? 1 : moveForward;
      const mr = this.slideTimer > 0 ? 0 : moveRight;
      _vec3A.x = -sinY * mf + cosY * mr;
      _vec3A.z = -cosY * mf - sinY * mr;
      if (_vec3A.lengthSq() > 0) _vec3A.normalize();
    }

    const accel = this.grounded ? 18 : 6;
    this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, _vec3A.x * speed, accel, dt);
    this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, _vec3A.z * speed, accel, dt);

    // Jump & Gravity
    if (this.keys['Space'] && this.grounded) {
      this.playerVel.y = 8.4;
      this.grounded = false;
      this.isCrouching = false;
      this.slideTimer = 0;
    }
    this.playerVel.y -= 23.5 * dt;

    this.playerPos.x += this.playerVel.x * dt;
    this.playerPos.z += this.playerVel.z * dt;
    this.playerPos.y += this.playerVel.y * dt;

    resolveCircleCollision(this.playerPos, 0.55, this.allColliders, this.playerPos.y, 1.75);

    const floorY = getFloorElevationAt(this.playerPos.x, this.playerPos.z, this.playerPos.y, this.allColliders);
    if (this.playerPos.y <= floorY) {
      this.playerPos.y = floorY;
      this.playerVel.y = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    // Camera Eye Height + Recoil + Shake
    const targetEye = this.isCrouching ? 1.05 : 1.66;
    if (moving && this.grounded) {
      this.walkBobPhase += dt * (wantsSprint ? 13 : 9);
    }
    const bobOffset = moving && this.grounded && !this.isAds ? Math.sin(this.walkBobPhase) * 0.045 : 0;

    this.recoilPitch = THREE.MathUtils.damp(this.recoilPitch, 0, 12, dt);
    this.recoilYawOffset = THREE.MathUtils.damp(this.recoilYawOffset, 0, 12, dt);
    this.cameraShake = THREE.MathUtils.damp(this.cameraShake, 0, 14, dt);

    const shakeX = (Math.random() - 0.5) * this.cameraShake;
    const shakeY = (Math.random() - 0.5) * this.cameraShake;

    this.camera.position.set(
      this.playerPos.x + shakeX,
      this.playerPos.y + targetEye + bobOffset + shakeY,
      this.playerPos.z
    );

    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.playerYaw + this.recoilYawOffset;
    this.camera.rotation.x = THREE.MathUtils.clamp(this.playerPitch + this.recoilPitch, -1.45, 1.45);

    // Smooth ADS FOV
    const activeSpec = WEAPONS[this.slots[this.activeSlotIndex].id];
    const targetFov = this.isAds ? activeSpec.adsFov : wantsSprint ? 78 : 72;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 14, dt);
      this.camera.updateProjectionMatrix();
    }

    // Damage flash decay
    if (this.damageFlash > 0) this.damageFlash = Math.max(0, this.damageFlash - dt * 2.4);
    if (this.medalTimer > 0) {
      this.medalTimer -= dt;
      if (this.medalTimer <= 0) this.activeMedal = null;
    }
  }

  private updateWeapons(dt: number): void {
    const slot = this.slots[this.activeSlotIndex];
    const spec = WEAPONS[slot.id];

    if (this.fireCooldown > 0) this.fireCooldown -= dt;

    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const needed = spec.magSize - slot.mag;
        const load = Math.min(needed, slot.reserve);
        slot.mag += load;
        slot.reserve -= load;
        this.isReloading = false;
        this.reloadTimer = 0;
      }
    }

    if (this.mouseDownLeft && spec.automatic) {
      this.tryFirePlayer();
    }

    // Update Viewmodel Visibility & Smooth Damping
    (['ak47', 'mp40', 'm1887', 'awm'] as WeaponId[]).forEach((wId) => {
      const vm = this.viewmodels[wId];
      if (!vm) return;
      vm.root.visible = wId === slot.id && !(this.isAds && slot.id === 'awm');
      if (this.viewmodelMuzzleTimer <= 0) {
        vm.muzzleFlash.visible = false;
      }
    });

    if (this.viewmodelMuzzleTimer > 0) {
      this.viewmodelMuzzleTimer -= dt;
    } else {
      this.muzzlePointLight.intensity = 0;
    }

    this.viewmodelKickZ = THREE.MathUtils.damp(this.viewmodelKickZ, 0, 16, dt);

    const activeVm = this.viewmodels[slot.id];
    if (activeVm) {
      const targetX = this.isAds ? 0 : 0.24;
      const targetY = this.isReloading ? -0.32 : this.isAds ? -0.145 : -0.21;
      const targetZ = (this.isAds ? -0.32 : -0.44) + this.viewmodelKickZ;
      const swayX = Math.cos(this.walkBobPhase * 0.5) * 0.008;
      const swayY = Math.abs(Math.sin(this.walkBobPhase)) * 0.009;

      activeVm.root.position.x = THREE.MathUtils.damp(activeVm.root.position.x, targetX + swayX, 18, dt);
      activeVm.root.position.y = THREE.MathUtils.damp(activeVm.root.position.y, targetY - swayY, 18, dt);
      activeVm.root.position.z = THREE.MathUtils.damp(activeVm.root.position.z, targetZ, 18, dt);
      activeVm.root.rotation.x = this.isReloading ? -0.55 : this.viewmodelKickZ * 1.4;
    }
  }

  private updateEnemies(dt: number): void {
    // Organic Battle Royale bot-vs-bot fights in outer zones
    if (this.mode === 'battle-royale') {
      this.botDuelTimer -= dt;
      if (this.botDuelTimer <= 0) {
        this.botDuelTimer = 4.2 + Math.random() * 4.5;
        const farBots = this.enemies.filter(
          (e) => e.alive && e.pos.distanceTo(this.playerPos) > 36
        );
        if (farBots.length >= 2) {
          const victim = farBots[Math.floor(Math.random() * farBots.length)];
          const killer = farBots.find((b) => b.id !== victim.id) || farBots[0];
          victim.alive = false;
          this.scene.remove(victim.visual.root);
          const remaining = this.enemies.filter((e) => e.alive).length;
          this.aliveCount = remaining + 1;
          this.pushKillFeed(killer.name, victim.name, 'MP40', Math.random() < 0.28, false);
          if (remaining === 0) this.triggerVictory();
        }
      }
    }

    const glooMeshes = this.glooBarriers.map((g) => g.mesh);

    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.alive) continue;

      // Hit flash recovery
      if (e.hitFlashTimer > 0) {
        e.hitFlashTimer -= dt;
        if (e.hitFlashTimer <= 0) {
          e.visual.armorMeshes.forEach((m) => {
            const mat = m.material as THREE.MeshStandardMaterial;
            mat.emissive.setHex(0x000000);
            mat.emissiveIntensity = 0;
          });
        }
      }
      if (e.muzzleTimer > 0) {
        e.muzzleTimer -= dt;
        if (e.muzzleTimer <= 0) e.visual.muzzleFlash.visible = false;
      }

      const dx = this.playerPos.x - e.pos.x;
      const dz = this.playerPos.z - e.pos.z;
      const distToPlayer = Math.hypot(dx, dz);

      const detectRange = e.variant === 'sniper' ? 78 : 54;
      let canSeePlayer = false;

      if (distToPlayer < detectRange) {
        _vec3B.set(e.pos.x, e.pos.y + 1.45, e.pos.z);
        _vec3C.set(this.playerPos.x, this.playerPos.y + 1.4, this.playerPos.z);
        _dir.copy(_vec3C).sub(_vec3B).normalize();
        this.raycaster.set(_vec3B, _dir);
        this.raycaster.near = 0.2;
        this.raycaster.far = distToPlayer;
        this.raycaster.layers.set(0);
        const obs = this.raycaster.intersectObjects([...this.worldRaycastMeshes, ...glooMeshes], true);
        if (obs.length === 0 || obs[0].distance > distToPlayer - 0.6) {
          canSeePlayer = true;
        }
      }

      // Zone pull: stay inside safe zone!
      const distFromZone = Math.hypot(e.pos.x - this.zoneCenter.x, e.pos.z - this.zoneCenter.y);
      const outsideZone = this.mode === 'battle-royale' && distFromZone > this.zoneRadius - 4;

      let moveSpeed = e.variant === 'rusher' ? 6.2 : e.variant === 'heavy' ? 3.8 : 4.9;

      if (outsideZone) {
        // Sprint toward safe zone center
        const toCenterX = this.zoneCenter.x - e.pos.x;
        const toCenterZ = this.zoneCenter.y - e.pos.z;
        const targetYaw = Math.atan2(toCenterX, toCenterZ);
        e.yaw = targetYaw;
        e.vel.x = Math.sin(targetYaw) * moveSpeed * 1.15;
        e.vel.z = Math.cos(targetYaw) * moveSpeed * 1.15;
        e.windingUp = false;
        e.visual.telegraphBeam.visible = false;
      } else if (canSeePlayer) {
        // Combat Engagement! Face player
        const targetYaw = Math.atan2(dx, dz);
        e.yaw = targetYaw;

        e.strafeTimer -= dt;
        if (e.strafeTimer <= 0) {
          e.strafeTimer = 1.1 + Math.random() * 1.6;
          e.strafeDir = -e.strafeDir;
        }

        const preferredDist =
          e.variant === 'rusher' ? 8 : e.variant === 'sniper' ? 36 : e.variant === 'heavy' ? 14 : 18;
        const fwdFactor = distToPlayer > preferredDist + 3 ? 1 : distToPlayer < preferredDist - 3 ? -0.6 : 0;

        const dirX = Math.sin(targetYaw);
        const dirZ = Math.cos(targetYaw);
        const perpX = dirZ * e.strafeDir;
        const perpZ = -dirX * e.strafeDir;

        e.vel.x = (dirX * fwdFactor + perpX * 0.7) * moveSpeed * 0.78;
        e.vel.z = (dirZ * fwdFactor + perpZ * 0.7) * moveSpeed * 0.78;

        // Windup Telegraph -> Fire!
        e.fireCooldown -= dt;
        if (e.fireCooldown <= 0.42 && !e.windingUp) {
          e.windingUp = true;
          e.windupTimer = 0.42;
          e.visual.telegraphBeam.visible = true;
        }
        if (e.windingUp) {
          e.windupTimer -= dt;
          if (e.windupTimer <= 0) {
            e.windingUp = false;
            e.visual.telegraphBeam.visible = false;
            this.fireEnemyWeapon(e, distToPlayer);
            e.fireCooldown =
              e.variant === 'rusher'
                ? 0.45 + Math.random() * 0.35
                : e.variant === 'sniper'
                  ? 2.2 + Math.random() * 0.8
                  : 0.85 + Math.random() * 0.65;
          }
        }
      } else {
        // Patrol or hunt toward player slowly if few remain
        e.windingUp = false;
        e.visual.telegraphBeam.visible = false;
        if (this.aliveCount <= 5 || this.mode === 'blitz') {
          e.patrolTarget.copy(this.playerPos);
        } else if (e.pos.distanceTo(e.patrolTarget) < 2.5) {
          const ang = Math.random() * Math.PI * 2;
          const r = 10 + Math.random() * 24;
          e.patrolTarget.set(
            THREE.MathUtils.clamp(this.zoneCenter.x + Math.cos(ang) * r, -95, 95),
            0,
            THREE.MathUtils.clamp(this.zoneCenter.y + Math.sin(ang) * r, -95, 95)
          );
        }
        const px = e.patrolTarget.x - e.pos.x;
        const pz = e.patrolTarget.z - e.pos.z;
        const pYaw = Math.atan2(px, pz);
        e.yaw = pYaw;
        e.vel.x = Math.sin(pYaw) * moveSpeed * 0.65;
        e.vel.z = Math.cos(pYaw) * moveSpeed * 0.65;
      }

      e.pos.x += e.vel.x * dt;
      e.pos.z += e.vel.z * dt;
      resolveCircleCollision(e.pos, 0.55, this.allColliders, e.pos.y, 1.75);
      e.pos.y = groundHeightAt(e.pos.x, e.pos.z);

      e.visual.root.position.copy(e.pos);
      e.visual.root.rotation.y = e.yaw;

      const movingSpeed = Math.hypot(e.vel.x, e.vel.z);
      if (movingSpeed > 0.4) {
        e.walkPhase += dt * movingSpeed * 1.9;
        e.visual.leftLeg.rotation.x = Math.sin(e.walkPhase) * 0.5;
        e.visual.rightLeg.rotation.x = -Math.sin(e.walkPhase) * 0.5;
      } else {
        e.visual.leftLeg.rotation.x = 0;
        e.visual.rightLeg.rotation.x = 0;
      }
    }
  }

  private fireEnemyWeapon(enemy: EnemyActor, distToPlayer: number): void {
    enemy.visual.muzzleFlash.visible = true;
    enemy.muzzleTimer = 0.06;

    const atten = Math.max(0.08, 1 - distToPlayer / 90);
    this.sound.playGunshot(enemy.variant === 'sniper' ? 'awm' : 'ak47', atten * 0.55);

    const origin = new THREE.Vector3(enemy.pos.x, enemy.pos.y + 1.38, enemy.pos.z);
    const target = new THREE.Vector3(
      this.playerPos.x + (Math.random() - 0.5) * (distToPlayer * 0.08),
      this.playerPos.y + 1.25 + (Math.random() - 0.5) * 0.7,
      this.playerPos.z + (Math.random() - 0.5) * (distToPlayer * 0.08)
    );

    const dir = target.clone().sub(origin).normalize();
    this.raycaster.set(origin, dir);
    this.raycaster.near = 0.2;
    this.raycaster.far = distToPlayer + 4;
    this.raycaster.layers.set(0);

    const glooMeshes = this.glooBarriers.map((g) => g.mesh);
    const hits = this.raycaster.intersectObjects([...this.worldRaycastMeshes, ...glooMeshes], true);

    if (hits.length > 0 && hits[0].distance < distToPlayer - 0.4) {
      // Blocked by cover or Gloo Wall!
      this.spawnTracer(origin, hits[0].point, false);
      this.spawnParticles(hits[0].point, 0x38bdf8, 5);
      for (let g = 0; g < this.glooBarriers.length; g++) {
        const gloo = this.glooBarriers[g];
        let belongs = false;
        hits[0].object.traverseAncestors((anc) => {
          if (anc === gloo.mesh) belongs = true;
        });
        if (belongs) {
          this.damageGlooBarrier(gloo, 22);
          break;
        }
      }
      return;
    }

    // Check if shot actually hits player capsule
    const hitChance =
      enemy.variant === 'sniper' ? 0.55 : distToPlayer < 16 ? 0.58 : distToPlayer < 35 ? 0.36 : 0.2;
    this.spawnTracer(origin, target, false);

    if (Math.random() < hitChance) {
      const dmg = enemy.variant === 'sniper' ? 38 : enemy.variant === 'heavy' ? 16 : 12;
      this.damagePlayer(dmg, enemy.pos, enemy.name);
    }
  }

  private updateZone(dt: number): void {
    if (this.mode !== 'battle-royale') return;
    const phaseSpec = ZONE_PHASES[this.zonePhaseIndex];
    if (!phaseSpec) return;

    this.zoneTimer -= dt;
    if (!this.zoneShrinking) {
      if (this.zoneTimer <= 0) {
        this.zoneShrinking = true;
        this.zoneStartRadius = this.zoneRadius;
        this.targetZoneRadius = phaseSpec.targetRadius;
        this.zoneTimer = phaseSpec.shrink;
        this.triggerMedal('ZONA ENCOGIMIENTO', `FASE ${this.zonePhaseIndex + 1} ACTIVA`, 0, '#06b6d4');
      }
    } else {
      const progress = 1 - Math.max(0, this.zoneTimer) / phaseSpec.shrink;
      this.zoneRadius = THREE.MathUtils.lerp(this.zoneStartRadius, this.targetZoneRadius, progress);
      this.zoneCylinder.scale.set(this.zoneRadius, 1, this.zoneRadius);
      if (this.zoneTimer <= 0) {
        this.zoneShrinking = false;
        if (this.zonePhaseIndex < ZONE_PHASES.length - 1) {
          this.zonePhaseIndex++;
          this.zoneTimer = ZONE_PHASES[this.zonePhaseIndex].wait;
          this.targetZoneRadius = ZONE_PHASES[this.zonePhaseIndex].targetRadius;
        } else {
          this.zoneTimer = 999;
        }
      }
    }

    // Storm damage if player is outside safe zone
    const distFromZone = Math.hypot(
      this.playerPos.x - this.zoneCenter.x,
      this.playerPos.z - this.zoneCenter.y
    );
    if (distFromZone > this.zoneRadius) {
      this.stormDamageAccum += dt * (4 + this.zonePhaseIndex * 3.5);
      if (this.stormDamageAccum >= 6) {
        this.damagePlayer(Math.round(this.stormDamageAccum), null, 'TORMENTA');
        this.stormDamageAccum = 0;
      }
    } else {
      this.stormDamageAccum = 0;
    }
  }

  private updateLoot(dt: number): void {
    for (let i = 0; i < this.lootItems.length; i++) {
      const l = this.lootItems[i];
      if (l.collected) continue;
      if (!l.isSupplyDrop && l.mesh.children[1]) {
        l.mesh.children[1].rotation.y += dt * 2.0;
        l.mesh.children[1].position.y = 0.52 + Math.sin(this.matchTime * 3 + i) * 0.08;
      }
      // Auto-collect ground pickups when walking right over them
      if (!l.isSupplyDrop && l.pos.distanceTo(this.playerPos) < 1.65) {
        this.collectLoot(l);
      }
    }
  }

  private updateFx(dt: number): void {
    for (let i = 0; i < this.tracers.length; i++) {
      const t = this.tracers[i];
      if (t.life > 0) {
        t.life -= dt;
        if (t.life <= 0) t.mesh.visible = false;
        else (t.mesh.material as THREE.MeshBasicMaterial).opacity = (t.life / t.maxLife) * 0.85;
      }
    }
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (p.life > 0) {
        p.life -= dt;
        if (p.life <= 0) {
          p.mesh.visible = false;
        } else {
          p.vel.y -= 15 * dt;
          p.mesh.position.addScaledVector(p.vel, dt);
          p.mesh.scale.setScalar(p.life / p.maxLife);
        }
      }
    }
  }

  private pushHud(force: boolean): void {
    const now = performance.now();
    if (!force && now - this.lastHudPush < 45) return;
    this.lastHudPush = now;

    // Clean stale kill feed items (> 4.5s)
    this.killFeed = this.killFeed.filter((k) => now - k.timestamp < 4500);

    let interactPrompt: string | null = null;
    for (let i = 0; i < this.lootItems.length; i++) {
      const l = this.lootItems[i];
      if (!l.collected && l.isSupplyDrop && l.pos.distanceTo(this.playerPos) < 3.4) {
        interactPrompt =
          l.kind === 'weapon_awm'
            ? '[E] ABRIR CAJA DE SUMINISTRO (AWM FANTASMA)'
            : '[E] ABRIR CAJA DE SUMINISTRO (M1887 BESTIA)';
        break;
      }
    }

    const activeSpec = WEAPONS[this.slots[this.activeSlotIndex].id];
    const inStorm =
      this.mode === 'battle-royale' &&
      Math.hypot(this.playerPos.x - this.zoneCenter.x, this.playerPos.z - this.zoneCenter.y) >
        this.zoneRadius;

    const minimapEntities: MinimapEntity[] = [];
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.alive && e.pos.distanceTo(this.playerPos) < 62) {
        minimapEntities.push({ x: e.pos.x, z: e.pos.z, type: 'enemy' });
      }
    }
    for (let i = 0; i < this.lootItems.length; i++) {
      const l = this.lootItems[i];
      if (!l.collected && l.isSupplyDrop) {
        minimapEntities.push({ x: l.pos.x, z: l.pos.z, type: 'drop' });
      }
    }

    this.onHudUpdate({
      phase: this.phase,
      mode: this.mode,
      hp: Math.ceil(this.hp),
      maxHp: this.maxHp,
      shield: Math.ceil(this.shield),
      maxShield: this.maxShield,
      stamina: Math.round(this.stamina),
      glooWalls: this.glooWalls,
      medkits: this.medkits,
      aliveCount: this.aliveCount,
      totalCombatants: this.totalCombatants,
      kills: this.kills,
      headshots: this.headshots,
      damageDealt: this.damageDealt,
      shotsFired: this.shotsFired,
      shotsHit: this.shotsHit,
      killstreak: this.killstreak,
      activeSlotIndex: this.activeSlotIndex,
      slots: this.slots.map((s) => ({ ...s })),
      isReloading: this.isReloading,
      reloadProgress: this.isReloading ? 1 - this.reloadTimer / activeSpec.reloadTime : 0,
      isAds: this.isAds,
      isSprinting: Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight']) && !this.isAds,
      isCrouching: this.isCrouching,
      inStorm,
      zoneRadius: this.zoneRadius,
      targetZoneRadius: this.targetZoneRadius,
      zonePhase: this.zonePhaseIndex + 1,
      zoneTimer: Math.max(0, Math.ceil(this.zoneTimer)),
      zoneShrinking: this.zoneShrinking,
      crosshairSpread: this.isAds ? 4 : this.isCrouching ? 10 : 16 + this.recoilPitch * 260,
      yaw: this.playerYaw,
      playerX: this.playerPos.x,
      playerZ: this.playerPos.z,
      zoneCenterX: this.zoneCenter.x,
      zoneCenterZ: this.zoneCenter.y,
      hitmarkerKey: this.hitmarkerKey,
      hitmarkerHeadshot: this.hitmarkerHeadshot,
      hitmarkerKill: this.hitmarkerKill,
      damageFlash: this.damageFlash,
      damageDirAngle: this.damageDirAngle,
      interactPrompt,
      killFeed: [...this.killFeed],
      activeMedal: this.activeMedal,
      minimapEntities,
      matchTime: Math.floor(this.matchTime),
      placement: this.placement,
      pointerLocked: this.pointerLocked,
      muted: this.sound.isMuted(),
      sensitivity: this.sensitivity,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResizeBound);
    window.removeEventListener('keydown', this.handleKeyDownBound);
    window.removeEventListener('keyup', this.handleKeyUpBound);
    window.removeEventListener('blur', this.handleBlurBound);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChangeBound);

    const dom = this.renderer.domElement;
    dom.removeEventListener('mousedown', this.handleMouseDownBound);
    window.removeEventListener('mouseup', this.handleMouseUpBound);
    window.removeEventListener('mousemove', this.handleMouseMoveBound);
    dom.removeEventListener('wheel', this.handleWheelBound);
    dom.removeEventListener('contextmenu', this.handleContextMenuBound);

    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose();
        if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
        else m.material?.dispose();
      }
    });
    this.textures.dispose();
    this.renderer.dispose();
    if (dom.parentElement === this.container) {
      this.container.removeChild(dom);
    }
  }
}

function isHeadColor(critical: boolean): boolean {
  return critical;
}
