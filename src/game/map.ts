import * as THREE from 'three';

export interface ColliderBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  kind: 'solid' | 'gloo';
  glooId?: number;
}

export const ARENA_PLAYABLE_RADIUS = 112;

export function groundHeightAt(x: number, z: number): number {
  const dist = Math.hypot(x, z);

  // Flat central military compound plateau (r <= 34)
  if (dist <= 34) {
    return 0;
  }

  // Smooth blend out from plateau
  const blend = THREE.MathUtils.smoothstep(dist, 34, 48);

  // Tactical rolling hills and ridges
  const hills =
    Math.sin(x * 0.045) * Math.cos(z * 0.045) * 2.4 +
    Math.sin(x * 0.09 + 1.2) * Math.sin(z * 0.08 - 0.7) * 1.1;

  // Perimeter canyon/cliff wall beyond playable radius
  let cliff = 0;
  if (dist > 114) {
    const t = Math.min(1, (dist - 114) / 48);
    cliff = t * t * 22 + Math.sin(x * 0.14) * Math.cos(z * 0.14) * 2.5 * t;
  }

  return blend * hills + cliff;
}

export function resolveCircleCollision(
  pos: THREE.Vector3,
  radius: number,
  colliders: ColliderBox[],
  playerFeetY: number,
  actorHeight = 1.75
): void {
  // Keep within playable island radius
  const r = Math.hypot(pos.x, pos.z);
  const maxR = ARENA_PLAYABLE_RADIUS - radius;
  if (r > maxR && r > 0.001) {
    pos.x = (pos.x / r) * maxR;
    pos.z = (pos.z / r) * maxR;
  }

  // Resolve AABB colliders horizontally
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    // Vertical overlap check (allow stepping on top of crates or jumping over low walls)
    if (playerFeetY >= c.maxY - 0.15 || playerFeetY + actorHeight <= c.minY) {
      continue;
    }

    const closestX = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const closestZ = Math.max(c.minZ, Math.min(pos.z, c.maxZ));

    const dx = pos.x - closestX;
    const dz = pos.z - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < radius * radius) {
      const dist = Math.sqrt(distSq);
      if (dist > 0.0001) {
        const push = radius - dist;
        pos.x += (dx / dist) * push;
        pos.z += (dz / dist) * push;
      } else {
        // Inside AABB fallback: push out along shallowest axis
        const penLeft = Math.abs(pos.x - c.minX);
        const penRight = Math.abs(c.maxX - pos.x);
        const penTop = Math.abs(pos.z - c.minZ);
        const penBottom = Math.abs(c.maxZ - pos.z);
        const m = Math.min(penLeft, penRight, penTop, penBottom);
        if (m === penLeft) pos.x = c.minX - radius;
        else if (m === penRight) pos.x = c.maxX + radius;
        else if (m === penTop) pos.z = c.minZ - radius;
        else pos.z = c.maxZ + radius;
      }
    }
  }
}

export function getFloorElevationAt(
  x: number,
  z: number,
  currentY: number,
  colliders: ColliderBox[]
): number {
  let h = groundHeightAt(x, z);
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (x >= c.minX - 0.25 && x <= c.maxX + 0.25 && z >= c.minZ - 0.25 && z <= c.maxZ + 0.25) {
      if (currentY >= c.maxY - 0.65 && c.maxY > h) {
        h = c.maxY;
      }
    }
  }
  return h;
}
