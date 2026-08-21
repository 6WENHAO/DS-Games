/**
 * game/mining.js
 * ------------------------------------------------------------------
 * Block breaking and placing.
 *
 * Break time follows the vanilla formula:
 *
 *     damage per tick = toolSpeed / hardness / (canHarvest ? 30 : 100)
 *
 * so a wooden pickaxe on stone (speed 2, hardness 1.5) takes
 * 1 / (2/1.5/30) = 22.5 ticks ~ 1.15 s, which is what the real game does.
 *
 * Also handles drops (including the "wrong tool means no drop" rule),
 * tool wear, gravity blocks falling and where a placed block may go.
 */

import { blocks, getBlock, IS_REPLACEABLE, IS_COLLIDABLE, MODEL_OF } from '../world/blocks.js';
import { MODEL, WORLD_HEIGHT } from '../world/constants.js';
import { toolEffect, ITEM_FOR_BLOCK, itemId, getItemByName } from './items.js';
import { AABB } from '../core/math.js';

/** Ticks per second, matching vanilla's simulation rate. */
const TICKS_PER_SECOND = 20;

/**
 * Progress per second when mining `block` with `heldItemId`.
 * @returns {{perSecond: number, canHarvest: boolean, instant: boolean}}
 */
export function breakSpeed(heldItemId, block) {
  if (block.hardness < 0) return { perSecond: 0, canHarvest: false, instant: false };
  if (block.hardness === 0) return { perSecond: Infinity, canHarvest: true, instant: true };
  const { speed, canHarvest } = toolEffect(heldItemId, block);
  const divisor = canHarvest ? 30 : 100;
  const perTick = speed / block.hardness / divisor;
  return { perSecond: perTick * TICKS_PER_SECOND, canHarvest, instant: false };
}

/** Seconds needed to break a block, or Infinity when unbreakable. */
export function breakTime(heldItemId, block) {
  const { perSecond } = breakSpeed(heldItemId, block);
  if (perSecond === Infinity) return 0;
  if (perSecond <= 0) return Infinity;
  return 1 / perSecond;
}

/**
 * Tracks progress on the block the player is currently mining.
 * Progress resets whenever the target or the held item changes, which is
 * exactly how vanilla behaves.
 */
export class MiningState {
  constructor() {
    this.active = false;
    this.x = 0; this.y = 0; this.z = 0;
    this.blockId = 0;
    this.heldId = -1;
    this.progress = 0;
    /** Accumulated time, for the swing/crack animation. */
    this.elapsed = 0;
    /** Set when the block finished breaking this frame. */
    this.justBroke = false;
  }

  /** Begins or continues mining a target. Returns true if progress reset. */
  target(x, y, z, blockId, heldId) {
    if (this.active && this.x === x && this.y === y && this.z === z
      && this.blockId === blockId && this.heldId === heldId) {
      return false;
    }
    this.active = true;
    this.x = x; this.y = y; this.z = z;
    this.blockId = blockId;
    this.heldId = heldId;
    this.progress = 0;
    this.elapsed = 0;
    return true;
  }

  stop() {
    this.active = false;
    this.progress = 0;
    this.elapsed = 0;
    this.blockId = 0;
  }

  /**
   * Advances mining.
   * @returns {boolean} true when the block should break now
   */
  advance(dt) {
    if (!this.active) return false;
    const def = getBlock(this.blockId);
    const { perSecond, instant } = breakSpeed(this.heldId, def);
    if (instant) { this.progress = 1; return true; }
    if (perSecond <= 0) { this.progress = 0; return false; }
    this.elapsed += dt;
    this.progress += perSecond * dt;
    if (this.progress >= 1) { this.progress = 1; return true; }
    return false;
  }
}

/**
 * What a block drops when broken.
 * @returns {Array<{item: number, count: number}>}
 */
export function blockDrops(block, heldItemId, random = Math.random) {
  const { canHarvest } = toolEffect(heldItemId, block);
  if (!canHarvest) return [];
  if (block.drops === null) return [];

  // A named drop wins; otherwise the block drops its own item form.
  let itemIdValue;
  if (typeof block.drops === 'string') {
    itemIdValue = itemId(block.drops) || ITEM_FOR_BLOCK[block.id];
  } else {
    itemIdValue = ITEM_FOR_BLOCK[block.id];
  }
  if (!itemIdValue) return [];
  if (block.dropChance < 1 && random() > block.dropChance) return [];
  return [{ item: itemIdValue, count: block.dropCount }];
}

/**
 * May a block be placed at these coordinates?
 * Blocks go into air or replaceable blocks (grass, water) only, and never
 * inside an entity's collision box.
 *
 * @param {import('../world/world.js').World} world
 * @param {AABB[]} [avoidBoxes] entity boxes that must stay clear
 */
export function canPlaceAt(world, x, y, z, blockId, avoidBoxes = null) {
  if (y < 0 || y >= WORLD_HEIGHT) return false;
  const existing = world.getBlock(x, y, z);
  if (!IS_REPLACEABLE[existing] && existing !== 0) return false;

  const def = getBlock(blockId);
  // Non-solid decorations (plants, torches) need something underneath.
  if (def.model === MODEL.CROSS || def.model === MODEL.TORCH) {
    const below = world.getBlock(x, y - 1, z);
    if (!IS_COLLIDABLE[below]) return false;
  }
  if (avoidBoxes && IS_COLLIDABLE[blockId]) {
    const box = new AABB(x, y, z, x + 1, y + 1, z + 1);
    for (const other of avoidBoxes) if (box.intersects(other)) return false;
  }
  return true;
}

/**
 * Chooses the block variant to place for a given face - the log axis
 * trick: placing a log against a wall orients it horizontally in vanilla.
 * Kept simple here: only the six-face-textured blocks care.
 */
export function orientForPlacement(blockId, face) {
  void face;
  return blockId;
}

/**
 * Applies gravity to sand and gravel above `x,y,z`, letting the column
 * settle. Returns the number of blocks that fell.
 */
export function settleGravity(world, x, y, z, limit = 64) {
  let moved = 0;
  for (let scan = y; scan < WORLD_HEIGHT && moved < limit; scan++) {
    const id = world.getBlock(x, scan, z);
    if (id === 0) continue;
    if (!blocks[id].gravity) break;
    // Fall as far as possible.
    let dest = scan;
    while (dest > 0 && world.getBlock(x, dest - 1, z) === 0) dest--;
    if (dest === scan) continue;
    world.setBlock(x, scan, z, 0);
    world.setBlock(x, dest, z, id);
    moved++;
    scan = dest;   // continue checking above the new position
  }
  return moved;
}

/**
 * Fluid spreading: a very small water simulation so pools level out and
 * broken dams flow. Deliberately simpler than vanilla (no flow levels),
 * but it makes water behave believably.
 *
 * @returns {number} number of cells changed
 */
export function spreadLiquid(world, x, y, z, liquidId, budget = 24) {
  let changes = 0;
  const queue = [[x, y, z]];
  const seen = new Set();
  while (queue.length && changes < budget) {
    const [cx, cy, cz] = queue.shift();
    const key = `${cx},${cy},${cz}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (world.getBlock(cx, cy, cz) !== liquidId) continue;

    // Prefer flowing down.
    const below = world.getBlock(cx, cy - 1, cz);
    if (cy > 0 && (below === 0 || IS_REPLACEABLE[below]) && below !== liquidId) {
      world.setBlock(cx, cy - 1, cz, liquidId);
      changes++;
      queue.push([cx, cy - 1, cz]);
      continue;
    }
    // Otherwise spread sideways.
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx; const nz = cz + dz;
      const side = world.getBlock(nx, cy, nz);
      if (side !== 0 && !IS_REPLACEABLE[side]) continue;
      if (side === liquidId) continue;
      world.setBlock(nx, cy, nz, liquidId);
      changes++;
      queue.push([nx, cy, nz]);
      if (changes >= budget) break;
    }
  }
  return changes;
}

/** Is this block a plant that should pop off when its support is gone? */
export function needsSupport(blockId) {
  const model = MODEL_OF[blockId];
  return model === MODEL.CROSS || model === MODEL.TORCH;
}

/**
 * After a block changes, breaks any unsupported plant directly above.
 * @returns {number[]|null} dropped item ids
 */
export function updateSupports(world, x, y, z) {
  const above = world.getBlock(x, y + 1, z);
  if (!above || !needsSupport(above)) return null;
  const below = world.getBlock(x, y, z);
  if (IS_COLLIDABLE[below]) return null;
  const def = getBlock(above);
  world.setBlock(x, y + 1, z, 0);
  const drops = blockDrops(def, itemId('diamond_shovel'), () => 0);
  return drops.map((d) => d.item);
}

export { getItemByName };
