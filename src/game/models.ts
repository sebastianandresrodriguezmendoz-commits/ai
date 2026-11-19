import * as THREE from 'three';
import { ProceduralTextures } from './textures';
import { WeaponId } from './types';

export type EnemyVariant = 'assault' | 'rusher' | 'heavy' | 'sniper';

export interface EnemyVisualRefs {
  root: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  upperBody: THREE.Group;
  headMesh: THREE.Mesh;
  visorMat: THREE.MeshStandardMaterial;
  telegraphBeam: THREE.Mesh;
  muzzleFlash: THREE.Mesh;
  headHitbox: THREE.Mesh;
  bodyHitbox: THREE.Mesh;
  armorMeshes: THREE.Mesh[];
}

export interface ViewmodelRefs {
  root: THREE.Group;
  muzzleTip: THREE.Object3D;
  muzzleFlash: THREE.Mesh;
}

export function createViewmodelWeapon(weaponId: WeaponId): ViewmodelRefs {
  const root = new THREE.Group();

  const gunMetal = new THREE.MeshStandardMaterial({
    color: 0x262a33,
    roughness: 0.32,
    metalness: 0.85,
  });
  const darkPolymer = new THREE.MeshStandardMaterial({
    color: 0x16181d,
    roughness: 0.78,
    metalness: 0.12,
  });
  const woodOrAccent = new THREE.MeshStandardMaterial({
    color:
      weaponId === 'ak47'
        ? 0x8b4513
        : weaponId === 'mp40'
          ? 0x0ea5e9
          : weaponId === 'm1887'
            ? 0x991b1b
            : 0xca8a04,
    roughness: 0.48,
    metalness: weaponId === 'ak47' ? 0.15 : 0.65,
  });
  const opticGlass = new THREE.MeshStandardMaterial({
    color: weaponId === 'awm' ? 0xfacc15 : 0x22d3ee,
    emissive: weaponId === 'awm' ? 0xf59e0b : 0x06b6d4,
    emissiveIntensity: 1.5,
    roughness: 0.1,
    metalness: 0.2,
    transparent: true,
    opacity: 0.75,
  });

  // 1. Receiver
  const recLen = weaponId === 'awm' ? 0.44 : weaponId === 'mp40' ? 0.32 : 0.38;
  const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.088, recLen), gunMetal);
  receiver.position.set(0, 0, 0);
  root.add(receiver);

  // 2. Upper Rail
  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(0.042, 0.018, recLen * 0.85),
    darkPolymer
  );
  rail.position.set(0, 0.052, -0.02);
  root.add(rail);

  // 3. Handguard / Forend
  const handguardLen = weaponId === 'awm' ? 0.32 : weaponId === 'm1887' ? 0.28 : 0.24;
  const handguard = new THREE.Mesh(
    new THREE.BoxGeometry(0.058, 0.064, handguardLen),
    woodOrAccent
  );
  handguard.position.set(0, -0.005, -(recLen * 0.5 + handguardLen * 0.45));
  root.add(handguard);

  // 4. Barrel
  const barrelLen = weaponId === 'awm' ? 0.56 : weaponId === 'mp40' ? 0.22 : 0.38;
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.016, barrelLen, 10),
    gunMetal
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.012, -(recLen * 0.5 + barrelLen * 0.5));
  root.add(barrel);

  // Double barrel look for M1887
  if (weaponId === 'm1887') {
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.013, 0.013, barrelLen * 0.88, 10),
      darkPolymer
    );
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, -0.016, -(recLen * 0.5 + barrelLen * 0.44));
    root.add(tube);
  }

  // 5. Muzzle Brake / Suppressor
  const brake = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.02, weaponId === 'awm' ? 0.14 : 0.06, 10),
    darkPolymer
  );
  brake.rotation.x = Math.PI / 2;
  brake.position.set(0, 0.012, -(recLen * 0.5 + barrelLen + 0.02));
  root.add(brake);

  // 6. Grip
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.12, 0.055), darkPolymer);
  grip.position.set(0, -0.085, 0.09);
  grip.rotation.x = 0.28;
  root.add(grip);

  // 7. Magazine
  if (weaponId !== 'm1887') {
    const magHeight = weaponId === 'mp40' ? 0.2 : weaponId === 'awm' ? 0.09 : 0.16;
    const mag = new THREE.Mesh(
      new THREE.BoxGeometry(0.036, magHeight, 0.055),
      weaponId === 'ak47' ? woodOrAccent : gunMetal
    );
    mag.position.set(0, -0.1, -0.045);
    mag.rotation.x = weaponId === 'ak47' ? -0.22 : -0.06;
    root.add(mag);
  }

  // 8. Stock
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.085, 0.22), darkPolymer);
  stock.position.set(0, -0.018, recLen * 0.5 + 0.1);
  root.add(stock);

  // 9. Optic / Scope
  if (weaponId === 'awm') {
    const scopeBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.022, 0.24, 12),
      gunMetal
    );
    scopeBody.rotation.x = Math.PI / 2;
    scopeBody.position.set(0, 0.092, -0.02);
    root.add(scopeBody);

    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.019, 12), opticGlass);
    lens.position.set(0, 0.092, 0.102);
    root.add(lens);
  } else {
    const holoFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.048, 0.042, 0.062),
      darkPolymer
    );
    holoFrame.position.set(0, 0.08, -0.02);
    root.add(holoFrame);

    const reticle = new THREE.Mesh(new THREE.PlaneGeometry(0.028, 0.024), opticGlass);
    reticle.position.set(0, 0.082, 0.012);
    root.add(reticle);
  }

  // Muzzle tip & flash
  const muzzleTip = new THREE.Object3D();
  muzzleTip.position.set(0, 0.012, -(recLen * 0.5 + barrelLen + 0.07));
  root.add(muzzleTip);

  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffc857,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const muzzleFlash = new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 0), flashMat);
  muzzleFlash.position.copy(muzzleTip.position);
  muzzleFlash.scale.set(0.8, 0.8, 1.9);
  muzzleFlash.visible = false;
  root.add(muzzleFlash);

  return { root, muzzleTip, muzzleFlash };
}

export function createEnemySoldier(variant: EnemyVariant): EnemyVisualRefs {
  const root = new THREE.Group();

  const primaryColor =
    variant === 'heavy'
      ? 0x7f1d1d
      : variant === 'rusher'
        ? 0x0f766e
        : variant === 'sniper'
          ? 0x3f6212
          : 0x334155;

  const secondaryColor =
    variant === 'heavy'
      ? 0x27272a
      : variant === 'rusher'
        ? 0x1e293b
        : variant === 'sniper'
          ? 0x1c1917
          : 0x1e293b;

  const visorColor =
    variant === 'heavy'
      ? 0xff3b30
      : variant === 'rusher'
        ? 0x00e5ff
        : variant === 'sniper'
          ? 0xfacc15
          : 0xff7b00;

  const scaleFactor = variant === 'heavy' ? 1.16 : variant === 'rusher' ? 0.97 : 1.0;
  root.scale.setScalar(scaleFactor);

  const clothMat = new THREE.MeshStandardMaterial({
    color: primaryColor,
    roughness: 0.84,
    metalness: 0.08,
  });
  const armorMat = new THREE.MeshStandardMaterial({
    color: secondaryColor,
    roughness: 0.38,
    metalness: 0.65,
  });
  const gunMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.3,
    metalness: 0.85,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: visorColor,
    emissive: visorColor,
    emissiveIntensity: 1.8,
    roughness: 0.15,
    metalness: 0.2,
  });

  const armorMeshes: THREE.Mesh[] = [];

  // Legs (pivoted at hip y = 0.82 so feet sit at y = 0)
  const makeLeg = (xOffset: number) => {
    const legGroup = new THREE.Group();
    legGroup.position.set(xOffset, 0.82, 0);

    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.44, 0.24), clothMat);
    thigh.position.y = -0.22;
    thigh.castShadow = true;
    legGroup.add(thigh);

    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.38, 0.21), armorMat);
    shin.position.y = -0.6;
    shin.castShadow = true;
    legGroup.add(shin);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.12, 0.3), gunMat);
    boot.position.set(0, -0.76, 0.04);
    boot.castShadow = true;
    legGroup.add(boot);

    armorMeshes.push(thigh, shin);
    return legGroup;
  };

  const leftLeg = makeLeg(-0.15);
  const rightLeg = makeLeg(0.15);
  root.add(leftLeg, rightLeg);

  // Upper body pivot at waist y = 0.84
  const upperBody = new THREE.Group();
  upperBody.position.set(0, 0.84, 0);
  root.add(upperBody);

  // Torso + Tactical Vest
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.6, 0.3), clothMat);
  torso.position.y = 0.3;
  torso.castShadow = true;
  upperBody.add(torso);

  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.44, 0.35), armorMat);
  vest.position.y = 0.34;
  vest.castShadow = true;
  upperBody.add(vest);

  // Backpack
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.42, 0.18), armorMat);
  pack.position.set(0, 0.34, -0.22);
  pack.castShadow = true;
  upperBody.add(pack);

  // Shoulders
  const shoulderGeo = new THREE.BoxGeometry(0.18, 0.22, 0.22);
  const lShoulder = new THREE.Mesh(shoulderGeo, armorMat);
  lShoulder.position.set(-0.36, 0.5, 0);
  const rShoulder = new THREE.Mesh(shoulderGeo, armorMat);
  rShoulder.position.set(0.36, 0.5, 0);
  upperBody.add(lShoulder, rShoulder);

  // Arms holding weapon forward (+Z is forward)
  const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.42), clothMat);
  lArm.position.set(-0.26, 0.36, 0.22);
  lArm.rotation.y = 0.35;
  const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.42), clothMat);
  rArm.position.set(0.24, 0.36, 0.22);
  rArm.rotation.y = -0.2;
  upperBody.add(lArm, rArm);

  // Weapon assembly
  const weaponGroup = new THREE.Group();
  weaponGroup.position.set(0.12, 0.36, 0.42);
  const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.48), gunMat);
  const gunBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.02, variant === 'sniper' ? 0.52 : 0.32, 8),
    gunMat
  );
  gunBarrel.rotation.x = Math.PI / 2;
  gunBarrel.position.set(0, 0.02, 0.35);
  weaponGroup.add(gunBody, gunBarrel);
  upperBody.add(weaponGroup);

  // Enemy Muzzle Flash
  const muzzleFlash = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.13, 0),
    new THREE.MeshBasicMaterial({ color: 0xffaa33 })
  );
  muzzleFlash.position.set(0.12, 0.38, 0.94);
  muzzleFlash.visible = false;
  upperBody.add(muzzleFlash);

  // Windup Telegraph Laser Beam (glows brightly right before enemy shoots!)
  const beamGeo = new THREE.CylinderGeometry(0.012, 0.012, 16, 6);
  beamGeo.rotateX(Math.PI / 2);
  beamGeo.translate(0, 0, 8);
  const telegraphBeam = new THREE.Mesh(
    beamGeo,
    new THREE.MeshBasicMaterial({
      color: 0xff2a3c,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    })
  );
  telegraphBeam.position.set(0.12, 0.38, 0.9);
  telegraphBeam.visible = false;
  upperBody.add(telegraphBeam);

  // Head + Helmet + Visor
  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), armorMat);
  headMesh.position.set(0, 0.78, 0);
  headMesh.castShadow = true;
  upperBody.add(headMesh);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.06), visorMat);
  visor.position.set(0, 0.79, 0.15);
  upperBody.add(visor);

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.24, 6), gunMat);
  antenna.position.set(-0.14, 0.98, -0.08);
  upperBody.add(antenna);

  armorMeshes.push(torso, vest, pack, lShoulder, rShoulder, headMesh);

  // Invisible simplified hitboxes on Layer 1 for crisp, accurate raycasting
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const headHitbox = new THREE.Mesh(new THREE.SphereGeometry(0.27, 8, 8), hitMat);
  headHitbox.position.set(0, 1.64, 0);
  headHitbox.layers.set(1);
  root.add(headHitbox);

  const bodyHitbox = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 1.4, 8), hitMat);
  bodyHitbox.position.set(0, 0.72, 0);
  bodyHitbox.layers.set(1);
  root.add(bodyHitbox);

  return {
    root,
    leftLeg,
    rightLeg,
    upperBody,
    headMesh,
    visorMat,
    telegraphBeam,
    muzzleFlash,
    headHitbox,
    bodyHitbox,
    armorMeshes,
  };
}

export function createShippingContainer(
  colorHex: number,
  textures: ProceduralTextures
): THREE.Group {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    map: textures.container,
    roughness: 0.56,
    metalness: 0.48,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.35,
    metalness: 0.82,
  });

  // 1. Main hull (6.0 x 2.8 x 2.6, bottom at y = 0)
  const hull = new THREE.Mesh(new THREE.BoxGeometry(6.0, 2.75, 2.55), bodyMat);
  hull.position.y = 1.375;
  hull.castShadow = true;
  hull.receiveShadow = true;
  group.add(hull);

  // 2. Corner steel posts (4 parts)
  const postGeo = new THREE.BoxGeometry(0.22, 2.82, 0.22);
  [
    [-2.92, 1.41, -1.2],
    [2.92, 1.41, -1.2],
    [-2.92, 1.41, 1.2],
    [2.92, 1.41, 1.2],
  ].forEach(([px, py, pz]) => {
    const post = new THREE.Mesh(postGeo, frameMat);
    post.position.set(px, py, pz);
    post.castShadow = true;
    group.add(post);
  });

  // 3. Top roof reinforcement rails
  const railGeo = new THREE.BoxGeometry(6.05, 0.12, 0.16);
  [-1.2, 1.2].forEach((rz) => {
    const rail = new THREE.Mesh(railGeo, frameMat);
    rail.position.set(0, 2.78, rz);
    group.add(rail);
  });

  // 4. Locking bars on front face
  const lockGeo = new THREE.CylinderGeometry(0.035, 0.035, 2.5, 6);
  [-0.5, 0.5].forEach((lx) => {
    const lock = new THREE.Mesh(lockGeo, frameMat);
    lock.position.set(3.01, 1.38, lx);
    group.add(lock);
  });

  return group;
}

export function createWatchtower(textures: ProceduralTextures): THREE.Group {
  const group = new THREE.Group();
  const concreteMat = new THREE.MeshStandardMaterial({
    map: textures.concrete,
    roughness: 0.85,
    metalness: 0.05,
  });
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.35,
    metalness: 0.82,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.8,
    roughness: 0.3,
    metalness: 0.4,
  });

  // 4 support pillars
  const pillarGeo = new THREE.BoxGeometry(0.45, 4.2, 0.45);
  [
    [-2.1, 2.1, -2.1],
    [2.1, 2.1, -2.1],
    [-2.1, 2.1, 2.1],
    [2.1, 2.1, 2.1],
  ].forEach(([px, py, pz]) => {
    const p = new THREE.Mesh(pillarGeo, steelMat);
    p.position.set(px, py, pz);
    p.castShadow = true;
    p.receiveShadow = true;
    group.add(p);
  });

  // Platform deck
  const deck = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.36, 5.2), concreteMat);
  deck.position.y = 4.25;
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);

  // Parapet walls
  const wallN = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.0, 0.25), concreteMat);
  wallN.position.set(0, 4.9, -2.47);
  const wallS = wallN.clone();
  wallS.position.set(0, 4.9, 2.47);
  const wallW = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.0, 4.7), concreteMat);
  wallW.position.set(-2.47, 4.9, 0);
  const wallE = wallW.clone();
  wallE.position.set(2.47, 4.9, 0);
  group.add(wallN, wallS, wallW, wallE);

  // Roof supports & canopy
  const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.4, 8);
  [
    [-2.2, 5.6, -2.2],
    [2.2, 5.6, -2.2],
    [-2.2, 5.6, 2.2],
    [2.2, 5.6, 2.2],
  ].forEach(([px, py, pz]) => {
    const post = new THREE.Mesh(postGeo, steelMat);
    post.position.set(px, py, pz);
    group.add(post);
  });

  const roof = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.22, 5.6), steelMat);
  roof.position.y = 6.85;
  roof.castShadow = true;
  group.add(roof);

  // Beacon light on top
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.28, 10), accentMat);
  beacon.position.y = 7.1;
  group.add(beacon);

  return group;
}

export function createArmoredVehicle(colorHex = 0x4b533e): THREE.Group {
  const group = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.58,
    metalness: 0.38,
  });
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x1e242b,
    roughness: 0.32,
    metalness: 0.84,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x161618,
    roughness: 0.9,
    metalness: 0.05,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x1e3a5f,
    roughness: 0.12,
    metalness: 0.65,
  });

  // Lower chassis
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.9, 4.8), hullMat);
  chassis.position.y = 0.88;
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  group.add(chassis);

  // Armored Cabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.82, 2.65), hullMat);
  cabin.position.set(0, 1.72, -0.25);
  cabin.castShadow = true;
  group.add(cabin);

  // Windshield
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.45, 0.12), glassMat);
  windshield.position.set(0, 1.75, 1.08);
  windshield.rotation.x = -0.2;
  group.add(windshield);

  // Front Bumper
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.36, 0.32), steelMat);
  bumper.position.set(0, 0.68, 2.48);
  group.add(bumper);

  // 4 Rugged Tires + Rims
  const tireGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.38, 14);
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.41, 10);
  rimGeo.rotateZ(Math.PI / 2);

  [
    [-1.18, 0.52, 1.55],
    [1.18, 0.52, 1.55],
    [-1.18, 0.52, -1.55],
    [1.18, 0.52, -1.55],
  ].forEach(([wx, wy, wz]) => {
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.position.set(wx, wy, wz);
    tire.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, steelMat);
    rim.position.set(wx, wy, wz);
    group.add(tire, rim);
  });

  // Roof Turret Ring
  const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.28, 12), steelMat);
  turret.position.set(0, 2.25, -0.2);
  group.add(turret);

  return group;
}

export function createBunkerWall(
  width: number,
  height: number,
  depth: number,
  textures: ProceduralTextures
): THREE.Group {
  const group = new THREE.Group();
  const concMat = new THREE.MeshStandardMaterial({
    map: textures.concrete,
    roughness: 0.86,
    metalness: 0.06,
  });
  const capMat = new THREE.MeshStandardMaterial({
    color: 0x272a30,
    roughness: 0.4,
    metalness: 0.72,
  });

  const base = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), concMat);
  base.position.y = height / 2;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.14, 0.18, depth + 0.14),
    capMat
  );
  cap.position.y = height + 0.08;
  cap.castShadow = true;
  group.add(cap);

  // Side buttresses
  const buttressGeo = new THREE.BoxGeometry(0.32, height * 0.7, depth + 0.38);
  [-width * 0.35, width * 0.35].forEach((bx) => {
    const b = new THREE.Mesh(buttressGeo, capMat);
    b.position.set(bx, height * 0.35, 0);
    b.castShadow = true;
    group.add(b);
  });

  return group;
}

export function createSupplyDrop(textures: ProceduralTextures): THREE.Group {
  const group = new THREE.Group();

  const crateMat = new THREE.MeshStandardMaterial({
    map: textures.crate,
    roughness: 0.55,
    metalness: 0.35,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.3,
    metalness: 0.78,
  });

  const crate = new THREE.Mesh(new THREE.BoxGeometry(1.75, 1.5, 1.75), crateMat);
  crate.position.y = 0.75;
  crate.castShadow = true;
  crate.receiveShadow = true;
  group.add(crate);

  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.2, 1.9), frameMat);
  lid.position.y = 1.55;
  group.add(lid);

  // Tall glowing beacon beam
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.45, 28, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  beam.position.y = 15;
  group.add(beam);

  return group;
}

export function createGlooWallMesh(textures: ProceduralTextures): THREE.Group {
  const group = new THREE.Group();

  const shieldMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    map: textures.gloo,
    emissive: 0x0284c7,
    emissiveIntensity: 0.85,
    roughness: 0.2,
    metalness: 0.15,
    transparent: true,
    opacity: 0.88,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.32,
    metalness: 0.85,
  });

  // Main energy shield slab
  const shield = new THREE.Mesh(new THREE.BoxGeometry(3.8, 2.35, 0.28), shieldMat);
  shield.position.y = 1.25;
  shield.castShadow = true;
  group.add(shield);

  // Armored anchor base
  const base = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.26, 0.52), frameMat);
  base.position.y = 0.13;
  group.add(base);

  // Top & side emitter rails
  const topRail = new THREE.Mesh(new THREE.BoxGeometry(3.96, 0.16, 0.36), frameMat);
  topRail.position.y = 2.46;
  group.add(topRail);

  [-1.95, 1.95].forEach((sx) => {
    const sidePost = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.5, 0.4), frameMat);
    sidePost.position.set(sx, 1.25, 0);
    group.add(sidePost);
  });

  return group;
}

export type LootKind = 'medkit' | 'shield' | 'gloo' | 'ammo' | 'weapon_awm' | 'weapon_m1887';

export function createLootPickup(kind: LootKind): THREE.Group {
  const group = new THREE.Group();

  const colorMap: Record<LootKind, number> = {
    medkit: 0x22c55e,
    shield: 0x3b82f6,
    gloo: 0x06b6d4,
    ammo: 0xf59e0b,
    weapon_awm: 0xeab308,
    weapon_m1887: 0xef4444,
  };
  const col = colorMap[kind];

  // Ground glow ring
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.45, 0.62, 20),
    new THREE.MeshBasicMaterial({
      color: col,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  group.add(ring);

  const itemGroup = new THREE.Group();
  itemGroup.position.y = 0.52;
  group.add(itemGroup);

  const mat = new THREE.MeshStandardMaterial({
    color: col,
    emissive: col,
    emissiveIntensity: 0.35,
    roughness: 0.35,
    metalness: 0.55,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.45,
    metalness: 0.7,
  });

  if (kind === 'medkit') {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.38, 0.42), mat);
    const crossH = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.08, 0.45),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    const crossV = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.26, 0.45),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    itemGroup.add(box, crossH, crossV);
  } else if (kind === 'shield') {
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.56, 0.24), mat);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.14, 0.28), darkMat);
    itemGroup.add(vest, strap);
  } else if (kind === 'gloo') {
    const canister = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.52, 10), mat);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.12, 10), darkMat);
    cap.position.y = 0.3;
    itemGroup.add(canister, cap);
  } else if (kind === 'ammo') {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.32, 0.34), mat);
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.08, 0.38), darkMat);
    latch.position.y = 0.08;
    itemGroup.add(box, latch);
  } else {
    // High-tier weapon crate
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.18, 0.22), darkMat);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.95, 8), mat);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.y = 0.12;
    const scope = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.1), mat);
    scope.position.y = 0.18;
    itemGroup.add(body, barrel, scope);
  }

  return group;
}
