/**
 * player/physics.js
 * ------------------------------------------------------------------
 * Axis-aligned voxel collision and the movement integrator.
 *
 * Collision resolution moves the box one axis at a time (Y, then X, then
 * Z) and clips the motion against every block the swept box overlaps.
 * That is exactly how Minecraft behaves: you can slide along a wall, you
 * never tunnel through a block at normal speeds, and landing on a ledge
 * stops vertical motion without cancelling horizontal motion.
 *
 * Tuning constants are lifted from vanilla so the movement *feels* right:
 * gravity 32 blocks/s^2, jump velocity 8.4 (which peaks at ~1.25 blocks),
 * walk 4.317 blocks/s, sprint 5.612, sneak 1.295.
 */

import { AABB, clamp } from '../core/math.js';
import { WORLD_HEIGHT } from '../world/constants.js';
import { IS_COLLIDABLE, IS_LIQUID, blocks, B } from '../world/blocks.js';

/** Movement tuning, in blocks and seconds. */
export const MOVE = {
  gravity: 32,
  terminalVelocity: 78.4,
  jumpVelocity: 8.4,
  walkSpeed: 4.317,
  sprintSpeed: 5.612,
  sneakSpeed: 1.295,
  flySpeed: 10.9,
  flySprintSpeed: 21.8,
  swimSpeed: 2.2,
  groundFriction: 0.546,
  airFriction: 0.91,
  liquidDrag: 0.8,
  liquidGravity: 6.4,
  swimUpSpeed: 3.0,
  /** Height the player can step up without jumping (a slab-ish nudge). */
  stepHeight: 0.6,
  /** Fall distance below which no damage is taken. */
  safeFallDistance: 3,
};

/** Player collision box dimensions. */
export const PLAYER_SIZE = {
  width: 0.6,
  height: 1.8,
  sneakHeight: 1.5,
  eyeHeight: 1.62,
  sneakEyeHeight: 1.32,
};

const EPSILON = 1e-4;

/**
 * Collects the collision boxes of every solid block overlapping `box`.
 * Reuses one array + AABB pool to stay allocation-free per frame.
 */
export class BlockCollider {
  constructor() {
    /** @type {AABB[]} */
    this.pool = [];
    this.boxes = [];
  }

  #box() {
    if (this.boxes.length < this.pool.length) return this.pool[this.boxes.length];
    const b = new AABB();
    this.pool.push(b);
    return b;
  }

  /**
   * @param {import('../world/world.js').World} world
   * @param {AABB} box region to search (already expanded by the motion)
   * @returns {AABB[]} solid block boxes overlapping the region
   */
  collect(world, box) {
    this.boxes.length = 0;
    const x0 = Math.floor(box.minX - EPSILON);
    const x1 = Math.floor(box.maxX + EPSILON);
    const y0 = Math.max(0, Math.floor(box.minY - EPSILON));
    const y1 = Math.min(WORLD_HEIGHT - 1, Math.floor(box.maxY + EPSILON));
    const z0 = Math.floor(box.minZ - EPSILON);
    const z1 = Math.floor(box.maxZ + EPSILON);

    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          const id = world.getBlock(x, y, z);
          if (!IS_COLLIDABLE[id]) continue;
          const b = this.#box();
          b.set(x, y, z, x + 1, y + 1, z + 1);
          this.boxes.push(b);
        }
      }
    }
    return this.boxes;
  }
}

/** How far `box` may move along Y before hitting one of `boxes`. */
function clipY(box, boxes, amount) {
  let move = amount;
  for (const b of boxes) {
    if (box.maxX <= b.minX + EPSILON || box.minX >= b.maxX - EPSILON) continue;
    if (box.maxZ <= b.minZ + EPSILON || box.minZ >= b.maxZ - EPSILON) continue;
    if (move > 0 && box.maxY <= b.minY + EPSILON) {
      move = Math.min(move, b.minY - box.maxY);
    } else if (move < 0 && box.minY >= b.maxY - EPSILON) {
      move = Math.max(move, b.maxY - box.minY);
    }
  }
  return move;
}

function clipX(box, boxes, amount) {
  let move = amount;
  for (const b of boxes) {
    if (box.maxY <= b.minY + EPSILON || box.minY >= b.maxY - EPSILON) continue;
    if (box.maxZ <= b.minZ + EPSILON || box.minZ >= b.maxZ - EPSILON) continue;
    if (move > 0 && box.maxX <= b.minX + EPSILON) {
      move = Math.min(move, b.minX - box.maxX);
    } else if (move < 0 && box.minX >= b.maxX - EPSILON) {
      move = Math.max(move, b.maxX - box.minX);
    }
  }
  return move;
}

function clipZ(box, boxes, amount) {
  let move = amount;
  for (const b of boxes) {
    if (box.maxY <= b.minY + EPSILON || box.minY >= b.maxY - EPSILON) continue;
    if (box.maxX <= b.minX + EPSILON || box.minX >= b.maxX - EPSILON) continue;
    if (move > 0 && box.maxZ <= b.minZ + EPSILON) {
      move = Math.min(move, b.minZ - box.maxZ);
    } else if (move < 0 && box.minZ >= b.maxZ - EPSILON) {
      move = Math.max(move, b.maxZ - box.minZ);
    }
  }
  return move;
}

function translate(box, dx, dy, dz) {
  box.minX += dx; box.maxX += dx;
  box.minY += dy; box.maxY += dy;
  box.minZ += dz; box.maxZ += dz;
}

/**
 * Moves an axis-aligned body through the world, resolving collisions.
 *
 * @param {import('../world/world.js').World} world
 * @param {AABB} box    mutated in place to the resolved position
 * @param {{x:number,y:number,z:number}} motion desired displacement
 * @param {BlockCollider} collider
 * @param {{stepHeight?: number}} [opts]
 * @returns {{onGround: boolean, hitCeiling: boolean, hitWallX: boolean, hitWallZ: boolean, stepped: boolean}}
 */
export function moveBody(world, box, motion, collider, opts = {}) {
  const stepHeight = opts.stepHeight ?? 0;
  const result = { onGround: false, hitCeiling: false, hitWallX: false, hitWallZ: false, stepped: false };

  const search = new AABB(box.minX, box.minY, box.minZ, box.maxX, box.maxY, box.maxZ);
  search.expand(motion.x, motion.y, motion.z);
  search.grow(1);
  const boxes = collider.collect(world, search);

  // --- vertical -------------------------------------------------
  const clippedY = clipY(box, boxes, motion.y);
  if (clippedY !== motion.y) {
    if (motion.y < 0) result.onGround = true;
    else result.hitCeiling = true;
  }
  translate(box, 0, clippedY, 0);

  // --- horizontal ----------------------------------------------
  const wantX = motion.x;
  const wantZ = motion.z;
  let clippedX = clipX(box, boxes, wantX);
  translate(box, clippedX, 0, 0);
  let clippedZ = clipZ(box, boxes, wantZ);
  translate(box, 0, 0, clippedZ);

  // --- auto step up (walk onto a 0.5-block ledge) ---------------
  const blockedX = Math.abs(clippedX - wantX) > EPSILON;
  const blockedZ = Math.abs(clippedZ - wantZ) > EPSILON;
  if (stepHeight > 0 && result.onGround && (blockedX || blockedZ)) {
    // Try again from a raised position; keep it only if it gains ground.
    const trial = new AABB(box.minX, box.minY, box.minZ, box.maxX, box.maxY, box.maxZ);
    translate(trial, -clippedX, 0, -clippedZ);
    const lift = clipY(trial, boxes, stepHeight);
    if (lift > EPSILON) {
      translate(trial, 0, lift, 0);
      const stepX = clipX(trial, boxes, wantX);
      translate(trial, stepX, 0, 0);
      const stepZ = clipZ(trial, boxes, wantZ);
      translate(trial, 0, 0, stepZ);
      const gained = Math.abs(stepX) + Math.abs(stepZ);
      const original = Math.abs(clippedX) + Math.abs(clippedZ);
      if (gained > original + EPSILON) {
        // Settle back down onto the step.
        const drop = clipY(trial, boxes, -lift);
        translate(trial, 0, drop, 0);
        box.set(trial.minX, trial.minY, trial.minZ, trial.maxX, trial.maxY, trial.maxZ);
        clippedX = stepX;
        clippedZ = stepZ;
        result.stepped = true;
      }
    }
  }

  result.hitWallX = Math.abs(clippedX - wantX) > EPSILON;
  result.hitWallZ = Math.abs(clippedZ - wantZ) > EPSILON;
  result.movedX = clippedX;
  result.movedY = clippedY;
  result.movedZ = clippedZ;
  return result;
}

/** True when any block overlapping the box is a liquid of the given id. */
export function isInLiquid(world, box, liquidId) {
  const x0 = Math.floor(box.minX);
  const x1 = Math.floor(box.maxX);
  const y0 = Math.max(0, Math.floor(box.minY));
  const y1 = Math.min(WORLD_HEIGHT - 1, Math.floor(box.maxY));
  const z0 = Math.floor(box.minZ);
  const z1 = Math.floor(box.maxZ);
  for (let y = y0; y <= y1; y++) {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        const id = world.getBlock(x, y, z);
        if (liquidId === undefined ? IS_LIQUID[id] : id === liquidId) return true;
      }
    }
  }
  return false;
}

/** True when a ladder or vine overlaps the box (enables climbing). */
export function isOnClimbable(world, box) {
  const x0 = Math.floor(box.minX);
  const x1 = Math.floor(box.maxX);
  const y0 = Math.max(0, Math.floor(box.minY));
  const y1 = Math.min(WORLD_HEIGHT - 1, Math.floor(box.maxY));
  const z0 = Math.floor(box.minZ);
  const z1 = Math.floor(box.maxZ);
  for (let y = y0; y <= y1; y++) {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        if (blocks[world.getBlock(x, y, z)].climbable) return true;
      }
    }
  }
  return false;
}

/** Block the body is standing on, for footstep sounds and particles. */
export function blockBelow(world, box) {
  const y = Math.floor(box.minY - 0.08);
  const cx = (box.minX + box.maxX) / 2;
  const cz = (box.minZ + box.maxZ) / 2;
  let id = world.getBlock(Math.floor(cx), y, Math.floor(cz));
  if (IS_COLLIDABLE[id]) return id;
  // Check the four corners so standing on an edge still reports a block.
  for (const [x, z] of [[box.minX, box.minZ], [box.maxX, box.minZ], [box.minX, box.maxZ], [box.maxX, box.maxZ]]) {
    id = world.getBlock(Math.floor(x), y, Math.floor(z));
    if (IS_COLLIDABLE[id]) return id;
  }
  return 0;
}

/** Damage taken from a fall, following vanilla's 1 heart per block past 3. */
export function fallDamage(distance) {
  return Math.max(0, Math.floor(distance - MOVE.safeFallDistance));
}

/**
 * Applies horizontal friction/drag.
 * @param {number} v current velocity
 * @param {number} factor per-tick retention (vanilla-style)
 * @param {number} dt seconds
 */
export function applyDrag(v, factor, dt) {
  // factor is per 1/20 s tick; convert to the actual frame time.
  return v * Math.pow(factor, dt * 20);
}

export { clamp, B };
