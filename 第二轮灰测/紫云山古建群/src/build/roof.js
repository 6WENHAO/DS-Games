import { M } from '../voxel/palette.js';

/**
 * 屋面举折曲线：返回每层的内收量（自檐口向脊逐层递增）
 * 檐口收得快（坡缓）、近脊收得慢（坡陡）—— 近似中式「举折」
 */
export function roofInsets(reach, layers, curve = 1.7) {
  const out = [];
  for (let i = 0; i < layers; i++) {
    const t = layers === 1 ? 1 : i / (layers - 1);
    const v = Math.round(reach * (1 - Math.pow(1 - t, curve)));
    out.push(Math.min(reach, Math.max(i === 0 ? 0 : out[i - 1], v)));
  }
  return out;
}

const TILE_SET = {
  gold:  { tile: M.TILE_GOLD,  rib: M.TILE_GOLD_RIB },
  green: { tile: M.TILE_GREEN, rib: M.TILE_GREEN_RIB },
  grey:  { tile: M.TILE_GREY,  rib: M.TILE_GREY_RIB }
};

/**
 * 通用中式屋顶（庑殿 / 歇山 / 攒尖）
 *
 * @param {object} o
 *  cx,cz      屋顶中心
 *  y          檐口层高度（第 0 层）
 *  halfX,halfZ 檐口半宽 / 半深（闭区间格数）
 *  layers     叠层数
 *  ridgeAxis  正脊方向 'x' | 'z'
 *  hipInset   歇山：正脊方向最大内收量；null = 庑殿（四面等收）
 *  tiles      'gold' | 'green' | 'grey'
 *  cap        顶层是否实心填满
 *  ridge      是否放正脊
 *  ridgeOrn   正脊两端是否放吻兽
 *  upturn     翘角长度（0 = 无）
 *  eaveTrim   檐下椽口材质（null 则不放）
 *  spire      攒尖宝顶高度（0 = 无）
 */
export function buildRoof(world, o) {
  const {
    cx, cz, y, halfX, halfZ, layers,
    ridgeAxis = 'x', hipInset = null, tiles = 'grey', curve = 1.7,
    cap = true, ridge = true, ridgeOrn = true, upturn = 3,
    eaveTrim = M.WOOD_DARK, gable = M.WOOD, spire = 0
  } = o;

  const set = TILE_SET[tiles] ?? TILE_SET.grey;
  const isX = ridgeAxis === 'x';
  const shortHalf = isX ? halfZ : halfX;
  const longHalf = isX ? halfX : halfZ;
  const insS = roofInsets(shortHalf, layers, curve);
  const insL = insS.map((v) => (hipInset == null ? Math.min(v, longHalf) : Math.min(v, hipInset)));

  // ---- 檐下椽口（出檐一圈木构，强化檐口阴影线）----
  if (eaveTrim) {
    world.ring(cx - halfX, cz - halfZ, cx + halfX, cz + halfZ, y - 1, eaveTrim, 1);
  }

  let topRect = null;
  for (let i = 0; i < layers; i++) {
    const iy = y + i;
    const ix = isX ? insL[i] : insS[i];
    const iz = isX ? insS[i] : insL[i];
    const x0 = cx - halfX + ix, x1 = cx + halfX - ix;
    const z0 = cz - halfZ + iz, z1 = cz + halfZ - iz;
    if (x1 < x0 || z1 < z0) break;

    const nextS = i + 1 < layers ? insS[i + 1] : insS[i] + 1;
    const t = Math.max(2, nextS - insS[i] + 1);
    const frozen = hipInset != null && insL[i] >= hipInset && i > 1;
    const last = i === layers - 1;

    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const dx = Math.min(x - x0, x1 - x);
        const dz = Math.min(z - z0, z1 - z);
        const dShort = isX ? dz : dx;   // 距坡面檐边
        const dLong = isX ? dx : dz;    // 距山面 / 端头
        const rib = (((isX ? x - cx : z - cz) % 3) + 3) % 3 === 0;
        const tileMat = rib ? set.rib : set.tile;

        let mat = null;
        if (dShort < t || (last && cap)) mat = tileMat;
        else if (frozen) { if (dLong === 0) mat = gable; }
        else if (dLong < t) mat = tileMat;

        if (!mat) continue;
        if (dShort === 0 && dLong === 0) mat = M.RIDGE;  // 垂脊 / 戗脊（对角金线）
        world.set(x, iy, z, mat);
      }
    }
    topRect = { x0, x1, z0, z1, iy };
  }

  // ---- 正脊 ----
  if (ridge && topRect) {
    const ry = topRect.iy + 1;
    world.box(topRect.x0, ry, topRect.z0, topRect.x1, ry, topRect.z1, M.RIDGE);
    if (ridgeOrn) {
      const ends = isX
        ? [[topRect.x0, -1, 0], [topRect.x1, 1, 0]]
        : [[topRect.z0, 0, -1], [topRect.z1, 0, 1]];
      for (const [, sx, sz] of ends) {
        const ex = isX ? (sx < 0 ? topRect.x0 : topRect.x1) : Math.round((topRect.x0 + topRect.x1) / 2);
        const ez = isX ? Math.round((topRect.z0 + topRect.z1) / 2) : (sz < 0 ? topRect.z0 : topRect.z1);
        world.box(ex, ry, ez, ex, ry + 2, ez, M.RIDGE);         // 吻兽立起
        world.set(ex + sx, ry + 2, ez + sz, M.GOLD);            // 上翘的尾
        world.set(ex + sx, ry + 1, ez + sz, M.RIDGE);
      }
    }
  }

  // ---- 攒尖宝顶 ----
  if (spire > 0 && topRect) {
    const mx = Math.round((topRect.x0 + topRect.x1) / 2);
    const mz = Math.round((topRect.z0 + topRect.z1) / 2);
    const base = topRect.iy + 1;
    world.box(mx, base, mz, mx, base + spire - 1, mz, M.RIDGE);
    world.box(mx - 1, base + 1, mz, mx + 1, base + 1, mz, M.RIDGE);
    world.box(mx, base + 1, mz - 1, mx, base + 1, mz + 1, M.RIDGE);
    world.set(mx, base + spire, mz, M.GOLD);
    world.set(mx + 1, base + spire - 1, mz, M.GOLD);
    world.set(mx - 1, base + spire - 1, mz, M.GOLD);
    world.set(mx, base + spire - 1, mz + 1, M.GOLD);
    world.set(mx, base + spire - 1, mz - 1, M.GOLD);
  }

  // ---- 飞檐翘角：四角斜向外上挑起 ----
  if (upturn > 0) {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const bx = cx + sx * halfX;
        const bz = cz + sz * halfZ;
        for (let k = 1; k <= upturn; k++) {
          const px = bx + sx * k, pz = bz + sz * k, py = y + k;
          world.set(px, py, pz, k === upturn ? M.RIDGE : set.tile);
          world.set(px - sx, py, pz, set.tile);
          world.set(px, py, pz - sz, set.tile);
          if (k > 1) world.set(px - sx, py - 1, pz - sz, set.rib);
        }
        const tx = bx + sx * upturn, tz = bz + sz * upturn;
        world.set(tx, y + upturn + 1, tz, M.GOLD);              // 角兽 / 宝珠
        world.set(tx - sx, y + upturn - 1, tz - sz, M.RIDGE);
      }
    }
  }

  return { top: (topRect?.iy ?? y) + (ridge ? 3 : 0) + spire };
}

/**
 * 腰檐 / 下檐（不收顶的一圈裙檐），用于重檐、塔身分层
 */
export function buildSkirtRoof(world, o) {
  const {
    cx, cz, y, halfX, halfZ, layers = 4,
    tiles = 'grey', upturn = 2, eaveTrim = M.WOOD_DARK
  } = o;
  const set = TILE_SET[tiles] ?? TILE_SET.grey;

  if (eaveTrim) world.ring(cx - halfX, cz - halfZ, cx + halfX, cz + halfZ, y - 1, eaveTrim, 1);

  for (let i = 0; i < layers; i++) {
    const x0 = cx - halfX + i, x1 = cx + halfX - i;
    const z0 = cz - halfZ + i, z1 = cz + halfZ - i;
    if (x1 < x0 || z1 < z0) break;
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++) {
        const d = Math.min(x - x0, x1 - x, z - z0, z1 - z);
        if (d >= 2) continue;
        const rib = (((x - cx) % 3) + 3) % 3 === 0;
        let mat = rib ? set.rib : set.tile;
        if (Math.min(x - x0, x1 - x) === 0 && Math.min(z - z0, z1 - z) === 0) mat = M.RIDGE;
        world.set(x, y + i, z, mat);
      }
  }

  if (upturn > 0) {
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const bx = cx + sx * halfX, bz = cz + sz * halfZ;
        for (let k = 1; k <= upturn; k++) {
          world.set(bx + sx * k, y + k, bz + sz * k, k === upturn ? M.RIDGE : set.tile);
          world.set(bx + sx * (k - 1), y + k, bz + sz * k, set.tile);
          world.set(bx + sx * k, y + k, bz + sz * (k - 1), set.tile);
        }
        world.set(bx + sx * upturn, y + upturn + 1, bz + sz * upturn, M.GOLD);
      }
  }
  return { top: y + layers };
}

/* ============ 八角形（宝塔）工具 ============ */

/** 体素八边形判定 */
export const inOct = (dx, dz, r) =>
  Math.abs(dx) <= r && Math.abs(dz) <= r && Math.abs(dx) + Math.abs(dz) <= Math.round(r * 1.42);

/** 八角形实心层 */
export function octSlab(world, cx, cz, y, r, mat) {
  for (let dx = -r; dx <= r; dx++)
    for (let dz = -r; dz <= r; dz++)
      if (inOct(dx, dz, r)) world.set(cx + dx, y, cz + dz, mat);
}

/** 八角形环（塔身墙） */
export function octRing(world, cx, cz, y0, y1, r, mat, t = 1) {
  for (let y = y0; y <= y1; y++)
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++)
        if (inOct(dx, dz, r) && !inOct(dx, dz, r - t)) world.set(cx + dx, y, cz + dz, mat);
}

/** 八角腰檐 / 八角攒尖顶 */
export function buildOctRoof(world, o) {
  const {
    cx, cz, y, r, layers, tiles = 'grey', cap = false,
    upturn = 2, spire = 0, eaveTrim = M.WOOD_DARK
  } = o;
  const set = TILE_SET[tiles] ?? TILE_SET.grey;

  if (eaveTrim) {
    for (let dx = -r; dx <= r; dx++)
      for (let dz = -r; dz <= r; dz++)
        if (inOct(dx, dz, r) && !inOct(dx, dz, r - 1)) world.set(cx + dx, y - 1, cz + dz, eaveTrim);
  }

  let lastR = r;
  for (let i = 0; i < layers; i++) {
    const rr = r - i;
    if (rr < 1) break;
    lastR = rr;
    const last = i === layers - 1;
    for (let dx = -rr; dx <= rr; dx++)
      for (let dz = -rr; dz <= rr; dz++) {
        if (!inOct(dx, dz, rr)) continue;
        const edge = !inOct(dx, dz, rr - 2);
        if (!edge && !(last && cap)) continue;
        const rib = (((dx % 3) + 3) % 3) === 0;
        let mat = rib ? set.rib : set.tile;
        const outer = !inOct(dx, dz, rr - 1);
        // 八条垂脊：正交轴 + 对角
        if (outer && (dx === 0 || dz === 0 || Math.abs(dx) === Math.abs(dz))) mat = M.RIDGE;
        world.set(cx + dx, y + i, cz + dz, mat);
      }
  }

  if (upturn > 0) {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    for (const [sx, sz] of dirs) {
      const d = Math.abs(sx) + Math.abs(sz) === 2 ? Math.round(r * 0.7) : r;
      const bx = cx + sx * d, bz = cz + sz * d;
      for (let k = 1; k <= upturn; k++) {
        world.set(bx + sx * k, y + k, bz + sz * k, k === upturn ? M.RIDGE : set.tile);
      }
      world.set(bx + sx * upturn, y + upturn + 1, bz + sz * upturn, M.GOLD);
    }
  }

  if (spire > 0) {
    const base = y + layers;
    world.box(cx, base, cz, cx, base + spire - 1, cz, M.RIDGE);
    for (let i = 1; i < spire; i += 2) {                        // 相轮
      world.box(cx - 1, base + i, cz, cx + 1, base + i, cz, M.GOLD);
      world.box(cx, base + i, cz - 1, cx, base + i, cz + 1, M.GOLD);
    }
    world.set(cx, base + spire, cz, M.GOLD);
    world.set(cx, base + spire + 1, cz, M.LANTERN);             // 塔刹宝珠
  }
  return { top: y + layers + spire, lastR };
}
