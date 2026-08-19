import { M } from '../voxel/palette.js';

/** 在 [a,b] 上均匀取整数点（含两端），用于柱位、窗位 */
export function spread(a, b, step) {
  const n = Math.max(1, Math.round((b - a) / step));
  const out = [];
  for (let i = 0; i <= n; i++) out.push(Math.round(a + ((b - a) * i) / n));
  return out;
}

/* ============================ 台基 ============================ */

/**
 * 须弥座式台基，返回台面上层 y（即首层地面高度）
 */
export function platform(world, o) {
  const {
    cx, cz, halfX, halfZ, y0 = 0, height = 3,
    body = M.STONE, face = M.MARBLE, edge = M.MARBLE_DARK, waist = true
  } = o;
  for (let h = 0; h < height; h++) {
    const inset = waist && height >= 3 && h > 0 && h < height - 1 ? 1 : 0;
    const mat = h === height - 1 ? face : body;
    world.box(cx - halfX + inset, y0 + h, cz - halfZ + inset,
              cx + halfX - inset, y0 + h, cz + halfZ - inset, mat);
  }
  // 压边石一圈
  world.ring(cx - halfX, cz - halfZ, cx + halfX, cz + halfZ, y0 + height - 1, edge, 1);
  return y0 + height;
}

/* ============================ 台阶 ============================ */

/**
 * 正面踏道（含御路），dir=-1 向 -z 方向下行，dir=+1 向 +z
 */
export function stairsZ(world, o) {
  const {
    cx, zStart, yTop, width = 9, steps = 4, dir = -1,
    tread = M.MARBLE, edge = M.MARBLE_DARK, royal = M.MARBLE_DARK, ground = 0
  } = o;
  const hw = Math.floor(width / 2);
  for (let s = 0; s < steps; s++) {
    const z = zStart + dir * s;
    const y = yTop - 1 - s;
    world.box(cx - hw, ground, z, cx + hw, y, z, M.STONE);
    world.slab(cx - hw, z, cx + hw, z, y, tread);
    world.set(cx - hw, y, z, edge);
    world.set(cx + hw, y, z, edge);
    if (royal) world.box(cx - 2, y, z, cx + 2, y, z, royal);   // 御路石
  }
}

/** 侧面踏道（沿 x 方向下行） */
export function stairsX(world, o) {
  const {
    cz, xStart, yTop, width = 9, steps = 4, dir = -1,
    tread = M.MARBLE, edge = M.MARBLE_DARK, ground = 0
  } = o;
  const hw = Math.floor(width / 2);
  for (let s = 0; s < steps; s++) {
    const x = xStart + dir * s;
    const y = yTop - 1 - s;
    world.box(x, ground, cz - hw, x, y, cz + hw, M.STONE);
    world.box(x, y, cz - hw, x, y, cz + hw, tread);
    world.set(x, y, cz - hw, edge);
    world.set(x, y, cz + hw, edge);
  }
}

/* ============================ 石栏杆 ============================ */

/**
 * 一段石栏（望柱 + 栏板）
 * axis='x' 时沿 x 铺设、fixed 为 z 坐标
 */
export function railingSegment(world, o) {
  const {
    axis = 'x', fixed, a0, a1, y, step = 3,
    post = M.MARBLE, panel = M.MARBLE_DARK, skip = null
  } = o;
  const put = (a, yy, mat) => {
    if (skip && a >= skip[0] && a <= skip[1]) return;
    if (axis === 'x') world.set(a, yy, fixed, mat);
    else world.set(fixed, yy, a, mat);
  };
  const posts = new Set(spread(a0, a1, step));
  for (let a = a0; a <= a1; a++) {
    put(a, y, panel);
    if (posts.has(a)) { put(a, y + 1, post); put(a, y + 2, post); }
  }
}

/* ============================ 门 · 窗 · 匾 ============================ */

/** 直棂格心窗 */
export function windowPanel(world, o) {
  const {
    axis = 'x', fixed, a0, a1, yFrom, yTo,
    lattice = M.LATTICE, glass = M.WINDOW, frame = M.WOOD_DARK
  } = o;
  for (let a = a0; a <= a1; a++) {
    for (let y = yFrom; y <= yTo; y++) {
      const edge = a === a0 || a === a1 || y === yFrom || y === yTo;
      const grid = (((a % 2) + 2) % 2) === 0 || (((y % 2) + 2) % 2) === 0;
      const mat = edge ? frame : grid ? lattice : glass;
      if (axis === 'x') world.set(a, y, fixed, mat);
      else world.set(fixed, y, a, mat);
    }
  }
}

/** 朱漆板门（含门钉、门框、抱框） */
export function doorPanel(world, o) {
  const {
    axis = 'x', fixed, a0, a1, yFrom, yTo,
    door = M.DOOR, frame = M.WOOD_DARK, stud = M.GOLD, threshold = M.STONE_DARK
  } = o;
  const mid = Math.round((a0 + a1) / 2);
  for (let a = a0; a <= a1; a++) {
    for (let y = yFrom; y <= yTo; y++) {
      let mat = door;
      if (a === a0 || a === a1 || y === yTo) mat = frame;
      else if (a === mid) mat = frame;                                  // 双扇缝
      else if ((((a * 2 + y) % 5) + 5) % 5 === 0) mat = stud;           // 门钉
      if (y === yFrom && threshold) mat = threshold;                    // 门槛
      if (axis === 'x') world.set(a, y, fixed, mat);
      else world.set(fixed, y, a, mat);
    }
  }
}

/** 匾额 */
export function plaque(world, o) {
  const { axis = 'x', fixed, center, halfLen = 3, y, frame = M.GOLD, face = M.WOOD_DARK } = o;
  for (let a = center - halfLen; a <= center + halfLen; a++) {
    for (let yy = y; yy <= y + 1; yy++) {
      const edge = a === center - halfLen || a === center + halfLen;
      const mat = edge ? frame : face;
      if (axis === 'x') world.set(a, yy, fixed, mat);
      else world.set(fixed, yy, a, mat);
    }
  }
  // 「字」
  for (const d of [-2, 0, 2]) {
    if (axis === 'x') world.set(center + d, y + 1, fixed, frame);
    else world.set(fixed, y + 1, center + d, frame);
  }
}

/* ============================ 斗拱层 ============================ */

/**
 * 额枋 + 彩画 + 斗拱（向外挑出一格），返回屋顶檐口层 y
 */
export function dougong(world, o) {
  const {
    cx, cz, halfX, halfZ, y, colStep = 4,
    beam = M.WOOD_DARK, paint = M.WALL_RED, block = M.WOOD, accent = M.GOLD
  } = o;
  const x0 = cx - halfX, x1 = cx + halfX, z0 = cz - halfZ, z1 = cz + halfZ;
  world.ring(x0, z0, x1, z1, y, beam, 1);
  world.ring(x0, z0, x1, z1, y + 1, paint, 1);
  world.ring(x0, z0, x1, z1, y + 2, block, 1);

  for (const x of spread(x0, x1, colStep)) {
    world.set(x, y + 2, z0 - 1, block);
    world.set(x, y + 2, z1 + 1, block);
    world.set(x, y + 1, z0, accent);
    world.set(x, y + 1, z1, accent);
  }
  for (const z of spread(z0, z1, colStep)) {
    world.set(x0 - 1, y + 2, z, block);
    world.set(x1 + 1, y + 2, z, block);
    world.set(x0, y + 1, z, accent);
    world.set(x1, y + 1, z, accent);
  }
  return y + 3;
}

/* ============================ 殿身（柱廊 + 墙 + 门窗） ============================ */

/**
 * 殿身。外圈为檐柱（形成外廊），内退一格为墙体
 * @returns {number} 墙顶 y（斗拱层起始高度）
 */
export function hallBody(world, o) {
  const {
    cx, cz, halfX, halfZ, y0, height, colStep = 4,
    wall = M.WALL_RED, trim = M.WALL_RED_DARK, column = M.COLUMN,
    front = '-z', doorHalf = 2, doorHeight = 7, windows = true,
    openPavilion = false, plaqueOn = true, floor = M.MARBLE_DARK
  } = o;

  const top = y0 + height - 1;
  const px0 = cx - halfX, px1 = cx + halfX, pz0 = cz - halfZ, pz1 = cz + halfZ;
  const wx0 = px0 + 1, wx1 = px1 - 1, wz0 = pz0 + 1, wz1 = pz1 - 1;

  // 地面（外廊铺装）
  world.slab(px0, pz0, px1, pz1, y0 - 1, floor);

  if (!openPavilion) {
    world.wallBox(wx0, wz0, wx1, wz1, y0, top - 1, wall, 1);
    world.ring(wx0, wz0, wx1, wz1, y0, trim, 1);
    world.ring(wx0, wz0, wx1, wz1, top - 1, trim, 1);
  }

  // 檐柱 + 柱础
  const xs = spread(px0, px1, colStep);
  const zs = spread(pz0, pz1, colStep);
  const putCol = (x, z) => {
    world.pillar(x, z, y0, top, column);
    world.set(x, y0 - 1, z, M.STONE_DARK);
    world.set(x, top, z, M.WOOD_DARK);
  };
  for (const x of xs) { putCol(x, pz0); putCol(x, pz1); }
  for (const z of zs) { putCol(px0, z); putCol(px1, z); }

  if (openPavilion) return top;

  /* ---- 门窗开设 ---- */
  const faces = {
    '-z': { axis: 'x', fixed: wz0, a0: wx0, a1: wx1, c: cx },
    '+z': { axis: 'x', fixed: wz1, a0: wx0, a1: wx1, c: cx },
    '-x': { axis: 'z', fixed: wx0, a0: wz0, a1: wz1, c: cz },
    '+x': { axis: 'z', fixed: wx1, a0: wz0, a1: wz1, c: cz }
  };
  const f = faces[front];

  // 正面：中央大门 + 两侧格心窗
  world.clearBox(
    f.axis === 'x' ? f.c - doorHalf : f.fixed, y0,
    f.axis === 'x' ? f.fixed : f.c - doorHalf,
    f.axis === 'x' ? f.c + doorHalf : f.fixed, y0 + doorHeight,
    f.axis === 'x' ? f.fixed : f.c + doorHalf
  );
  doorPanel(world, {
    axis: f.axis, fixed: f.fixed,
    a0: f.c - doorHalf, a1: f.c + doorHalf,
    yFrom: y0, yTo: y0 + doorHeight
  });
  if (plaqueOn) {
    plaque(world, {
      axis: f.axis, fixed: f.fixed, center: f.c,
      halfLen: Math.max(3, doorHalf), y: Math.min(top - 2, y0 + doorHeight + 1)
    });
  }

  if (windows) {
    const wy0 = y0 + 3, wy1 = Math.min(top - 3, y0 + doorHeight - 1);
    if (wy1 > wy0 + 1) {
      for (const [key, g] of Object.entries(faces)) {
        const isFront = key === front;
        const span = g.a1 - g.a0;
        const slots = spread(g.a0 + 3, g.a1 - 3, Math.max(6, Math.round(span / 4)));
        for (const s of slots) {
          if (isFront && Math.abs(s - g.c) <= doorHalf + 3) continue;
          if (s - 2 <= g.a0 || s + 2 >= g.a1) continue;
          windowPanel(world, {
            axis: g.axis, fixed: g.fixed, a0: s - 2, a1: s + 2, yFrom: wy0, yTo: wy1
          });
        }
      }
    }
  }
  return top;
}

/* ============================ 灯笼 ============================ */

export function hangLantern(world, x, y, z, len = 2) {
  world.set(x, y, z, M.WOOD_DARK);
  for (let i = 1; i <= len; i++) world.set(x, y - i, z, M.LANTERN);
  world.set(x, y - len - 1, z, M.GOLD);
}

/** 沿檐口挂一排灯笼 */
export function lanternRow(world, o) {
  const { axis = 'x', fixed, a0, a1, y, step = 6, len = 2 } = o;
  for (const a of spread(a0, a1, step)) {
    if (axis === 'x') hangLantern(world, a, y, fixed, len);
    else hangLantern(world, fixed, y, a, len);
  }
}
