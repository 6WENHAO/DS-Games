/* =====================================================================
 * Raycast — 体素射线（Amanatides & Woo DDA）+ 实体射线
 * ===================================================================== */
import { CHUNK_HEIGHT } from '../core/Constants.js';
import { BLOCKS, IS_LIQUID } from '../data/blocks.js';

/**
 * 对方块做射线检测
 * @returns {null|{x,y,z,id,face,nx,ny,nz,dist,px,py,pz}} face 为命中面索引，p* 为放置坐标
 */
export function raycastBlocks(world, ox, oy, oz, dx, dy, dz, maxDist = 5, opts = {}) {
  const includeLiquid = opts.includeLiquid === true;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-8) return null;
  dx /= len; dy /= len; dz /= len;

  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  const stepZ = dz > 0 ? 1 : dz < 0 ? -1 : 0;

  const tDeltaX = stepX !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = stepY !== 0 ? Math.abs(1 / dy) : Infinity;
  const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dz) : Infinity;

  let tMaxX = stepX > 0 ? (x + 1 - ox) * tDeltaX : stepX < 0 ? (ox - x) * tDeltaX : Infinity;
  let tMaxY = stepY > 0 ? (y + 1 - oy) * tDeltaY : stepY < 0 ? (oy - y) * tDeltaY : Infinity;
  let tMaxZ = stepZ > 0 ? (z + 1 - oz) * tDeltaZ : stepZ < 0 ? (oz - z) * tDeltaZ : Infinity;

  let face = -1;
  let t = 0;

  // 起点本身也要检查
  for (let guard = 0; guard < 512; guard++) {
    if (y >= 0 && y < CHUNK_HEIGHT) {
      const id = world.getBlockSafe(x, y, z);
      if (id > 0 && (includeLiquid || !IS_LIQUID[id])) {
        const b = BLOCKS[id];
        if (b.shape !== undefined) {
          const nx = face === 0 ? 1 : face === 1 ? -1 : 0;
          const ny = face === 2 ? 1 : face === 3 ? -1 : 0;
          const nz = face === 4 ? 1 : face === 5 ? -1 : 0;
          return {
            x, y, z, id, face, nx, ny, nz, dist: t,
            px: x + nx, py: y + ny, pz: z + nz,
          };
        }
      }
    }

    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      if (tMaxX > maxDist) break;
      x += stepX; t = tMaxX; tMaxX += tDeltaX;
      face = stepX > 0 ? 1 : 0;
    } else if (tMaxY < tMaxZ) {
      if (tMaxY > maxDist) break;
      y += stepY; t = tMaxY; tMaxY += tDeltaY;
      face = stepY > 0 ? 3 : 2;
    } else {
      if (tMaxZ > maxDist) break;
      z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ;
      face = stepZ > 0 ? 5 : 4;
    }
    if (t > maxDist) break;
  }
  return null;
}

/**
 * 对实体列表做射线检测（取最近命中）
 */
export function raycastEntities(entities, ox, oy, oz, dx, dy, dz, maxDist = 4) {
  let best = null, bestT = maxDist;
  for (const e of entities) {
    if (e.dead) continue;
    const box = e.box;
    const hit = box.rayIntersect(ox, oy, oz, dx, dy, dz);
    if (!hit) continue;
    const t = hit[0] >= 0 ? hit[0] : hit[1];
    if (t < 0 || t > bestT) continue;
    bestT = t;
    best = { entity: e, dist: t };
  }
  return best;
}

/** 从相机取一条视线 */
export function pickBlock(world, camera, reach = 5, includeLiquid = false) {
  const e = camera.eye;
  const f = camera.forward;
  return raycastBlocks(world, e[0], e[1], e[2], f[0], f[1], f[2], reach, { includeLiquid });
}
