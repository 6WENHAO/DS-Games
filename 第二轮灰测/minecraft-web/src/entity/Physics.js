/* =====================================================================
 * Physics — AABB 体素碰撞（逐轴扫掠 + 台阶 + 潜行防跌落）
 * ===================================================================== */
import { AABB } from '../math/AABB.js';
import { CHUNK_HEIGHT } from '../core/Constants.js';
import { IS_SOLID, HEIGHT_OF, BLOCKS } from '../data/blocks.js';

const scratchBlock = new AABB();
const colliders = [];

/**
 * 收集与 box 扫掠区域相交的方块碰撞盒
 */
export function collectColliders(world, box, dx, dy, dz, out = colliders) {
  out.length = 0;
  const minX = Math.floor(Math.min(box.minX, box.minX + dx) - 0.001);
  const maxX = Math.floor(Math.max(box.maxX, box.maxX + dx) + 0.001);
  const minY = Math.floor(Math.min(box.minY, box.minY + dy) - 0.001);
  const maxY = Math.floor(Math.max(box.maxY, box.maxY + dy) + 0.001);
  const minZ = Math.floor(Math.min(box.minZ, box.minZ + dz) - 0.001);
  const maxZ = Math.floor(Math.max(box.maxZ, box.maxZ + dz) + 0.001);

  for (let y = minY; y <= maxY; y++) {
    if (y < 0 || y >= CHUNK_HEIGHT) {
      if (y < 0) out.push(new AABB(minX - 1, y, minZ - 1, maxX + 2, y + 1, maxZ + 2));
      continue;
    }
    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        const id = world.getBlockCollide(x, y, z);
        if (id <= 0 || !IS_SOLID[id]) continue;
        const h = HEIGHT_OF[id] ?? 1;
        const b = BLOCKS[id];
        let inset = 0;
        if (b && b.shape === 6) inset = 1 / 16;      // 仙人掌
        out.push(new AABB(x + inset, y, z + inset, x + 1 - inset, y + h, z + 1 - inset));
      }
    }
  }
  return out;
}

/**
 * 逐轴移动 box，返回实际位移与碰撞信息
 * @returns {{dx:number,dy:number,dz:number,onGround:boolean,hitCeiling:boolean,hitWall:boolean}}
 */
export function collideMove(world, box, dx, dy, dz, stepHeight = 0) {
  const list = collectColliders(world, box, dx, dy, dz);
  let ody = dy;
  let onGround = false, hitCeiling = false, hitWall = false;

  // ---- Y ----
  if (dy !== 0) {
    for (const c of list) dy = box.clipY(c, dy);
    box.translate(0, dy, 0);
    if (dy !== ody) {
      if (ody < 0) onGround = true; else hitCeiling = true;
    }
  }

  // ---- X ----
  let odx = dx;
  if (dx !== 0) {
    for (const c of list) dx = box.clipX(c, dx);
    box.translate(dx, 0, 0);
    if (dx !== odx) hitWall = true;
  }

  // ---- Z ----
  let odz = dz;
  if (dz !== 0) {
    for (const c of list) dz = box.clipZ(c, dz);
    box.translate(0, 0, dz);
    if (dz !== odz) hitWall = true;
  }

  // ---- 台阶（自动上台阶，仅在地面且撞墙时尝试） ----
  if (stepHeight > 0 && onGround === false && hitWall && ody <= 0) {
    // 试着抬升后再走
    const saved = box.clone();
    const upList = collectColliders(world, box, 0, stepHeight, 0);
    let up = stepHeight;
    for (const c of upList) up = box.clipY(c, up);
    if (up > 0.01) {
      box.translate(0, up, 0);
      let sdx = odx - dx, sdz = odz - dz;
      const l2 = collectColliders(world, box, sdx, 0, sdz);
      for (const c of l2) sdx = box.clipX(c, sdx);
      box.translate(sdx, 0, 0);
      for (const c of l2) sdz = box.clipZ(c, sdz);
      box.translate(0, 0, sdz);
      if (Math.abs(sdx) < 0.001 && Math.abs(sdz) < 0.001) {
        box.copyFrom(saved);
      } else {
        dx += sdx; dz += sdz; dy += up;
      }
    }
  }

  return { dx, dy, dz, onGround, hitCeiling, hitWall };
}

/** box 是否与任何固体方块重叠 */
export function isColliding(world, box) {
  const minX = Math.floor(box.minX), maxX = Math.floor(box.maxX - 1e-6);
  const minY = Math.floor(box.minY), maxY = Math.floor(box.maxY - 1e-6);
  const minZ = Math.floor(box.minZ), maxZ = Math.floor(box.maxZ - 1e-6);
  for (let y = minY; y <= maxY; y++) {
    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        const id = world.getBlockCollide(x, y, z);
        if (id <= 0 || !IS_SOLID[id]) continue;
        const h = HEIGHT_OF[id] ?? 1;
        scratchBlock.set(x, y, z, x + 1, y + h, z + 1);
        if (box.intersectsEps(scratchBlock)) return true;
      }
    }
  }
  return false;
}

/** 潜行时是否会走出边缘（下方无支撑） */
export function wouldFallOff(world, box, dx, dz) {
  const test = box.clone().translate(dx, -0.02, dz);
  const minX = Math.floor(test.minX + 0.02), maxX = Math.floor(test.maxX - 0.02);
  const minZ = Math.floor(test.minZ + 0.02), maxZ = Math.floor(test.maxZ - 0.02);
  const y = Math.floor(test.minY);
  for (let z = minZ; z <= maxZ; z++) {
    for (let x = minX; x <= maxX; x++) {
      const id = world.getBlockCollide(x, y, z);
      if (id > 0 && IS_SOLID[id]) return false;
    }
  }
  return true;
}
