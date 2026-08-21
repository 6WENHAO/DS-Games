/**
 * player/raycast.js
 * ------------------------------------------------------------------
 * Voxel ray casting for block targeting.
 *
 * Uses the Amanatides & Woo grid traversal ("fast voxel traversal"),
 * which visits every voxel the ray passes through in order without ever
 * missing a thin corner - important because the player must be able to
 * mine a block seen edge-on.
 *
 * The hit result includes the face normal, which is what "place a block
 * against the side I'm looking at" needs.
 */

import { FACE } from '../world/constants.js';

/** Reusable hit record so per-frame targeting never allocates. */
export class RayHit {
  constructor() {
    this.hit = false;
    /** Block coordinates of the voxel that was struck. */
    this.x = 0; this.y = 0; this.z = 0;
    /** Block id at the hit. */
    this.block = 0;
    /** Outward face normal of the struck face. */
    this.nx = 0; this.ny = 0; this.nz = 0;
    /** Face id (FACE.*) of the struck face. */
    this.face = FACE.UP;
    /** Distance from the ray origin to the hit point. */
    this.distance = 0;
    /** Exact world-space hit point. */
    this.px = 0; this.py = 0; this.pz = 0;
  }

  /** Coordinates of the empty voxel the ray came from, for placement. */
  placeX() { return this.x + this.nx; }
  placeY() { return this.y + this.ny; }
  placeZ() { return this.z + this.nz; }

  reset() { this.hit = false; this.distance = 0; return this; }
}

/** Maps a normal onto the face id used by the renderer and block models. */
function faceFromNormal(nx, ny, nz) {
  if (nx > 0) return FACE.EAST;
  if (nx < 0) return FACE.WEST;
  if (ny > 0) return FACE.UP;
  if (ny < 0) return FACE.DOWN;
  if (nz > 0) return FACE.SOUTH;
  return FACE.NORTH;
}

/**
 * Casts a ray through the voxel grid.
 *
 * @param {import('../world/world.js').World} world
 * @param {number} ox @param {number} oy @param {number} oz  ray origin
 * @param {number} dx @param {number} dy @param {number} dz  unit direction
 * @param {number} maxDistance
 * @param {(id: number) => boolean} isTarget predicate for "solid enough to hit"
 * @param {RayHit} [out]
 * @returns {RayHit}
 */
export function raycastVoxels(world, ox, oy, oz, dx, dy, dz, maxDistance, isTarget, out = new RayHit()) {
  out.reset();

  let x = Math.floor(ox);
  let y = Math.floor(oy);
  let z = Math.floor(oz);

  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  const stepZ = dz > 0 ? 1 : dz < 0 ? -1 : 0;

  // Distance along the ray between successive grid planes per axis.
  const tDeltaX = stepX === 0 ? Infinity : Math.abs(1 / dx);
  const tDeltaY = stepY === 0 ? Infinity : Math.abs(1 / dy);
  const tDeltaZ = stepZ === 0 ? Infinity : Math.abs(1 / dz);

  // Distance to the first grid plane on each axis.
  const boundary = (origin, cell, step) => {
    if (step === 0) return Infinity;
    return step > 0 ? (cell + 1 - origin) : (origin - cell);
  };
  let tMaxX = stepX === 0 ? Infinity : boundary(ox, x, stepX) * tDeltaX;
  let tMaxY = stepY === 0 ? Infinity : boundary(oy, y, stepY) * tDeltaY;
  let tMaxZ = stepZ === 0 ? Infinity : boundary(oz, z, stepZ) * tDeltaZ;

  // The origin voxel itself may already be a target (standing in a block).
  let travelled = 0;
  let nx = 0; let ny = 0; let nz = 0;

  // Bounded loop: the worst case is ~3 * maxDistance steps.
  const maxSteps = Math.ceil(maxDistance * 3) + 3;
  for (let step = 0; step <= maxSteps; step++) {
    const id = world.getBlock(x, y, z);
    if (isTarget(id)) {
      out.hit = true;
      out.x = x; out.y = y; out.z = z;
      out.block = id;
      out.nx = nx; out.ny = ny; out.nz = nz;
      out.face = faceFromNormal(nx, ny, nz);
      out.distance = travelled;
      out.px = ox + dx * travelled;
      out.py = oy + dy * travelled;
      out.pz = oz + dz * travelled;
      return out;
    }

    // Advance to the nearest grid plane.
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      travelled = tMaxX;
      if (travelled > maxDistance) break;
      x += stepX;
      tMaxX += tDeltaX;
      nx = -stepX; ny = 0; nz = 0;
    } else if (tMaxY < tMaxZ) {
      travelled = tMaxY;
      if (travelled > maxDistance) break;
      y += stepY;
      tMaxY += tDeltaY;
      nx = 0; ny = -stepY; nz = 0;
    } else {
      travelled = tMaxZ;
      if (travelled > maxDistance) break;
      z += stepZ;
      tMaxZ += tDeltaZ;
      nx = 0; ny = 0; nz = -stepZ;
    }
  }
  return out;
}

/**
 * Ray/AABB intersection, used for hitting entities.
 * @returns {number} distance along the ray, or -1 when there is no hit
 */
export function raycastBox(ox, oy, oz, dx, dy, dz, box, maxDistance) {
  const inv = (d) => (d === 0 ? Infinity : 1 / d);
  const ix = inv(dx); const iy = inv(dy); const iz = inv(dz);
  let t1 = (box.minX - ox) * ix;
  let t2 = (box.maxX - ox) * ix;
  let tmin = Math.min(t1, t2);
  let tmax = Math.max(t1, t2);
  t1 = (box.minY - oy) * iy;
  t2 = (box.maxY - oy) * iy;
  tmin = Math.max(tmin, Math.min(t1, t2));
  tmax = Math.min(tmax, Math.max(t1, t2));
  t1 = (box.minZ - oz) * iz;
  t2 = (box.maxZ - oz) * iz;
  tmin = Math.max(tmin, Math.min(t1, t2));
  tmax = Math.min(tmax, Math.max(t1, t2));
  if (tmax < 0 || tmin > tmax || tmin > maxDistance) return -1;
  return tmin < 0 ? 0 : tmin;
}
