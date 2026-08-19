/* =====================================================================
 * ChunkMesher — 把 16³ section 转成 GPU 顶点数据
 *
 * 顶点格式 (7 × float32 = 28 字节):
 *   [0..2] 局部坐标 (相对区块原点)
 *   [3..5] u, v, 纹理层
 *   [6]    打包数据 = face + ao*8 + skyLight*32 + blockLight*512
 *
 * 特性: 隐藏面剔除、环境光遮蔽(AO)、四角平滑光照、三种渲染层、
 *       十字植物 / 液体 / 火把 / 仙人掌 等特殊形状
 * ===================================================================== */
import {
  CHUNK_SIZE, CHUNK_HEIGHT, SECTION_HEIGHT, FACES, LAYER, SHAPE,
} from '../core/Constants.js';
import {
  IS_OPAQUE, IS_FULL_CUBE, RENDER_LAYER, SHAPE_OF, CULL_SAME, OPACITY,
  BLOCKS, HEIGHT_OF,
} from '../data/blocks.js';

const FLOATS_PER_VERTEX = 7;
export const VERTEX_STRIDE = FLOATS_PER_VERTEX * 4;

/** 可增长的顶点缓冲 */
class Builder {
  constructor(initial = 1 << 16) {
    this.data = new Float32Array(initial);
    this.len = 0;
  }
  reset() { this.len = 0; }
  ensure(n) {
    if (this.len + n <= this.data.length) return;
    let cap = this.data.length * 2;
    while (cap < this.len + n) cap *= 2;
    const next = new Float32Array(cap);
    next.set(this.data.subarray(0, this.len));
    this.data = next;
  }
  vertex(x, y, z, u, v, layer, data) {
    const d = this.data; let i = this.len;
    d[i] = x; d[i + 1] = y; d[i + 2] = z;
    d[i + 3] = u; d[i + 4] = v; d[i + 5] = layer;
    d[i + 6] = data;
    this.len = i + FLOATS_PER_VERTEX;
  }
  get quadCount() { return this.len / (FLOATS_PER_VERTEX * 4); }
  slice() { return this.data.slice(0, this.len); }
}

/** 三个渲染层各一个复用缓冲 */
const builders = [new Builder(1 << 18), new Builder(1 << 16), new Builder(1 << 16)];

/** 邻域缓存：3×3×3 方块 ID 与光照，减少重复的跨区块查询 */
const nb = new Int32Array(27);
const nbSky = new Int32Array(27);
const nbBlk = new Int32Array(27);
const NB = (dx, dy, dz) => ((dy + 1) * 9 + (dz + 1) * 3 + (dx + 1));

/**
 * 构建一个 section 的网格
 * @returns {Array<{vertices:Float32Array, quads:number}|null>} 按 LAYER 索引
 */
export function meshSection(world, chunk, si) {
  for (const b of builders) b.reset();

  const y0 = si * SECTION_HEIGHT;
  const y1 = y0 + SECTION_HEIGHT;
  const blocks = chunk.blocks;
  const ox = chunk.originX, oz = chunk.originZ;

  for (let ly = y0; ly < y1; ly++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const id = blocks[(ly << 8) | (lz << 4) | lx];
        if (id === 0) continue;

        const layer = RENDER_LAYER[id];
        const builder = builders[layer];
        const shape = SHAPE_OF[id];
        const def = BLOCKS[id];

        // 载入 3×3×3 邻域
        loadNeighborhood(world, chunk, lx, ly, lz, ox, oz);

        switch (shape) {
          case SHAPE.CROSS:
            emitCross(builder, lx, ly, lz, def);
            break;
          case SHAPE.PANE:
            emitCross(builder, lx, ly, lz, def, 0.06);
            break;
          case SHAPE.TORCH:
            emitTorch(builder, lx, ly, lz, def);
            break;
          case SHAPE.FARMLAND:
            emitFlat(builder, lx, ly, lz, def, HEIGHT_OF[id]);
            break;
          case SHAPE.LIQUID: {
            const above = nb[NB(0, 1, 0)];
            const sameAbove = above === id;
            const h = sameAbove ? 1 : HEIGHT_OF[id];
            // doubleSided：液体薄层需要从下往上也可见（水面背面），
            // 网格正反两份输出后，透明层可以安全开启背面剔除
            emitCube(builder, lx, ly, lz, id, def, 0, 0, 0, 1, h, 1, true, sameAbove, false, true);
            break;
          }
          case SHAPE.CACTUS:
            emitCube(builder, lx, ly, lz, id, def, 1 / 16, 0, 1 / 16, 15 / 16, 1, 15 / 16, false, false, true);
            break;
          default:
            emitCube(builder, lx, ly, lz, id, def, 0, 0, 0, 1, 1, 1, true, false);
            break;
        }
      }
    }
  }

  const out = [null, null, null];
  for (let l = 0; l < LAYER.COUNT; l++) {
    const b = builders[l];
    if (b.len === 0) continue;
    out[l] = { vertices: b.slice(), quads: b.quadCount };
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 邻域载入
 * ------------------------------------------------------------------ */
function loadNeighborhood(world, chunk, lx, ly, lz, ox, oz) {
  const blocks = chunk.blocks, light = chunk.light;
  for (let dy = -1; dy <= 1; dy++) {
    const y = ly + dy;
    for (let dz = -1; dz <= 1; dz++) {
      const z = lz + dz;
      for (let dx = -1; dx <= 1; dx++) {
        const x = lx + dx;
        const k = NB(dx, dy, dz);
        if (y < 0) { nb[k] = 1; nbSky[k] = 0; nbBlk[k] = 0; continue; }
        if (y >= CHUNK_HEIGHT) { nb[k] = 0; nbSky[k] = 15; nbBlk[k] = 0; continue; }
        if (x >= 0 && x < 16 && z >= 0 && z < 16) {
          const i = (y << 8) | (z << 4) | x;
          nb[k] = blocks[i];
          const l = light[i];
          nbSky[k] = l >> 4; nbBlk[k] = l & 15;
        } else {
          const wx = ox + x, wz = oz + z;
          const b = world.getBlock(wx, y, wz);
          nb[k] = b < 0 ? 0 : b;
          nbSky[k] = world.getSkyLight(wx, y, wz);
          nbBlk[k] = world.getBlockLight(wx, y, wz);
        }
      }
    }
  }
}

/** 邻居是否遮挡本方块的面 */
function occludes(selfId, otherId) {
  if (otherId <= 0) return false;
  if (IS_FULL_CUBE[otherId] && IS_OPAQUE[otherId]) return true;
  if (otherId === selfId && CULL_SAME[selfId]) return true;
  // 液体被相邻液体遮挡
  if (IS_FULL_CUBE[otherId] && OPACITY[otherId] >= 15) return true;
  return false;
}

const isSolidForAO = (id) => id > 0 && IS_FULL_CUBE[id] === 1 && IS_OPAQUE[id] === 1;

/* ------------------------------------------------------------------ *
 * 立方体（可自定义包围盒）
 * ------------------------------------------------------------------ */
function emitCube(builder, lx, ly, lz, id, def, minX, minY, minZ, maxX, maxY, maxZ,
  doCull = true, skipTop = false, forceSides = false, doubleSided = false) {
  for (let f = 0; f < 6; f++) {
    if (skipTop && f === 2) continue;
    const F = FACES[f];
    const n = F.normal;
    const neighbor = nb[NB(n[0], n[1], n[2])];
    if (doCull && !forceSides && occludes(id, neighbor)) continue;
    if (forceSides && (f === 2 || f === 3) && occludes(id, neighbor)) continue;
    emitFace(builder, lx, ly, lz, f, minX, minY, minZ, maxX, maxY, maxZ, def.layers[f], true, false);
    // 反面（反绕序）：供背面剔除开启后仍能从内侧看到（如水面下侧）
    if (doubleSided) {
      emitFace(builder, lx, ly, lz, f, minX, minY, minZ, maxX, maxY, maxZ, def.layers[f], true, true);
    }
  }
}

/**
 * 输出一个面（含 AO 与平滑光照）
 * backside=true 时按反绕序输出（背面），配合背面剔除实现双面渲染
 */
function emitFace(builder, lx, ly, lz, f, minX, minY, minZ, maxX, maxY, maxZ, layer, smooth, backside = false) {
  const F = FACES[f];
  const o = F.origin, du = F.du, dv = F.dv, n = F.normal;
  const sx = maxX - minX, sy = maxY - minY, sz = maxZ - minZ;

  builder.ensure(4 * FLOATS_PER_VERTEX);

  // 四个角的 AO / 光照
  let ao0, ao1, ao2, ao3, d0, d1, d2, d3;
  const corners = CORNER_UV;
  const tmp = FACE_TMP;
  for (let k = 0; k < 4; k++) {
    const cu = corners[k * 2], cv = corners[k * 2 + 1];
    const su = cu ? 1 : -1, sv = cv ? 1 : -1;

    // 面外侧的 4 个采样点
    const bx = n[0], by = n[1], bz = n[2];
    const s1x = bx + du[0] * su, s1y = by + du[1] * su, s1z = bz + du[2] * su;
    const s2x = bx + dv[0] * sv, s2y = by + dv[1] * sv, s2z = bz + dv[2] * sv;
    const ccx = s1x + dv[0] * sv, ccy = s1y + dv[1] * sv, ccz = s1z + dv[2] * sv;

    const iBase = NB(bx, by, bz);
    const i1 = NB(s1x, s1y, s1z);
    const i2 = NB(s2x, s2y, s2z);
    const i3 = NB(ccx, ccy, ccz);

    let ao = 3;
    if (smooth) {
      const b1 = isSolidForAO(nb[i1]) ? 1 : 0;
      const b2 = isSolidForAO(nb[i2]) ? 1 : 0;
      const b3 = isSolidForAO(nb[i3]) ? 1 : 0;
      ao = (b1 && b2) ? 0 : (3 - (b1 + b2 + b3));
    }

    // 光照平均（跳过不透光方块）
    let skySum = 0, blkSum = 0, cnt = 0;
    for (const idx of [iBase, i1, i2, i3]) {
      if (isSolidForAO(nb[idx])) continue;
      skySum += nbSky[idx]; blkSum += nbBlk[idx]; cnt++;
    }
    if (cnt === 0) { skySum = nbSky[iBase]; blkSum = nbBlk[iBase]; cnt = 1; }
    const sky = Math.round(skySum / cnt);
    const blk = Math.round(blkSum / cnt);

    tmp[k] = f + ao * 8 + sky * 32 + blk * 512;
    tmp[4 + k] = ao;
  }
  d0 = tmp[0]; d1 = tmp[1]; d2 = tmp[2]; d3 = tmp[3];
  ao0 = tmp[4]; ao1 = tmp[5]; ao2 = tmp[6]; ao3 = tmp[7];

  // 反向三角化，消除 AO 的方向性瑕疵
  const flip = (ao0 + ao2) < (ao1 + ao3);

  for (let i = 0; i < 4; i++) {
    const k = backside ? 3 - i : i;      // 反面：顶点顺序倒序 → 绕序反转
    const kk = flip ? (k + 1) & 3 : k;
    const cu = corners[kk * 2], cv = corners[kk * 2 + 1];
    const ux = o[0] + du[0] * cu + dv[0] * cv;
    const uy = o[1] + du[1] * cu + dv[1] * cv;
    const uz = o[2] + du[2] * cu + dv[2] * cv;
    const px = lx + minX + ux * sx;
    const py = ly + minY + uy * sy;
    const pz = lz + minZ + uz * sz;
    const data = kk === 0 ? d0 : kk === 1 ? d1 : kk === 2 ? d2 : d3;
    builder.vertex(px, py, pz, cu, 1 - cv, layer, data);
  }
}

const CORNER_UV = new Int8Array([0, 0, 1, 0, 1, 1, 0, 1]);
const FACE_TMP = new Float32Array(8);

/* ------------------------------------------------------------------ *
 * 十字植物（双面）
 * ------------------------------------------------------------------ */
function emitCross(builder, lx, ly, lz, def, inset = 0.146) {
  const layer = def.layers[2];
  const i = NB(0, 0, 0);
  const sky = nbSky[i], blk = nbBlk[i];
  const data = 2 + 3 * 8 + sky * 32 + blk * 512;    // face=2(顶面亮度), ao=3
  const a = inset, b = 1 - inset;

  builder.ensure(16 * FLOATS_PER_VERTEX);
  // 对角面 1: (a,0,a) → (b,0,b)
  quad(builder, a, 0, a, b, 0, b, layer, data);
  // 对角面 2: (a,0,b) → (b,0,a)
  quad(builder, a, 0, b, b, 0, a, layer, data);

  function quad(bd, x0, y0, z0, x1, y1, z1, lay, dat) {
    const X0 = lx + x0, Z0 = lz + z0, X1 = lx + x1, Z1 = lz + z1;
    const Y0 = ly + y0, Y1 = ly + y0 + 1;
    // 正面
    bd.vertex(X0, Y0, Z0, 0, 1, lay, dat);
    bd.vertex(X1, Y0, Z1, 1, 1, lay, dat);
    bd.vertex(X1, Y1, Z1, 1, 0, lay, dat);
    bd.vertex(X0, Y1, Z0, 0, 0, lay, dat);
    // 背面
    bd.vertex(X1, Y0, Z1, 0, 1, lay, dat);
    bd.vertex(X0, Y0, Z0, 1, 1, lay, dat);
    bd.vertex(X0, Y1, Z0, 1, 0, lay, dat);
    bd.vertex(X1, Y1, Z1, 0, 0, lay, dat);
  }
}

/* ------------------------------------------------------------------ *
 * 火把（细柱 + 顶面）
 * ------------------------------------------------------------------ */
function emitTorch(builder, lx, ly, lz, def) {
  const layer = def.layers[2];
  const i = NB(0, 0, 0);
  const sky = nbSky[i], blk = Math.max(nbBlk[i], 14);
  const a = 7 / 16, b = 9 / 16, top = 10 / 16;

  builder.ensure(24 * FLOATS_PER_VERTEX);
  // 四个侧面（使用贴图中央条带）
  const u0 = 7 / 16, u1 = 9 / 16, v0 = 6 / 16, v1 = 1;
  const data = (f) => f + 3 * 8 + sky * 32 + blk * 512;

  side(b, b, b, a, 0);   // +X
  side(a, a, a, b, 1);   // -X
  side(a, b, b, b, 4);   // +Z
  side(b, a, a, a, 5);   // -Z

  // 顶面（火焰）
  builder.vertex(lx + a, ly + top, lz + b, u0, 1 - v1, layer, data(2));
  builder.vertex(lx + b, ly + top, lz + b, u1, 1 - v1, layer, data(2));
  builder.vertex(lx + b, ly + top, lz + a, u1, 1 - v0, layer, data(2));
  builder.vertex(lx + a, ly + top, lz + a, u0, 1 - v0, layer, data(2));

  function side(x0, z0, x1, z1, f) {
    const d = data(f);
    builder.vertex(lx + x0, ly, lz + z0, u0, 1, layer, d);
    builder.vertex(lx + x1, ly, lz + z1, u1, 1, layer, d);
    builder.vertex(lx + x1, ly + top, lz + z1, u1, 1 - top, layer, d);
    builder.vertex(lx + x0, ly + top, lz + z0, u0, 1 - top, layer, d);
  }
}

/* ------------------------------------------------------------------ *
 * 平板（睡莲）
 * ------------------------------------------------------------------ */
function emitFlat(builder, lx, ly, lz, def, h) {
  const layer = def.layers[2];
  const i = NB(0, 0, 0);
  const data = 2 + 3 * 8 + nbSky[i] * 32 + nbBlk[i] * 512;
  const y = ly + Math.max(h, 0.03);
  builder.ensure(8 * FLOATS_PER_VERTEX);
  builder.vertex(lx, y, lz + 1, 0, 1, layer, data);
  builder.vertex(lx + 1, y, lz + 1, 1, 1, layer, data);
  builder.vertex(lx + 1, y, lz, 1, 0, layer, data);
  builder.vertex(lx, y, lz, 0, 0, layer, data);
  // 背面
  builder.vertex(lx, y, lz, 0, 0, layer, data);
  builder.vertex(lx + 1, y, lz, 1, 0, layer, data);
  builder.vertex(lx + 1, y, lz + 1, 1, 1, layer, data);
  builder.vertex(lx, y, lz + 1, 0, 1, layer, data);
}

/* ------------------------------------------------------------------ *
 * 单个方块的立方体网格（手持物品 / 掉落物 / 图标）
 * ------------------------------------------------------------------ */
export function buildBlockCubeMesh(def, size = 1) {
  const b = new Builder(6 * 4 * FLOATS_PER_VERTEX);
  const s = size, off = (1 - size) / 2;
  for (let f = 0; f < 6; f++) {
    const F = FACES[f];
    const o = F.origin, du = F.du, dv = F.dv;
    for (let k = 0; k < 4; k++) {
      const cu = CORNER_UV[k * 2], cv = CORNER_UV[k * 2 + 1];
      const ux = o[0] + du[0] * cu + dv[0] * cv;
      const uy = o[1] + du[1] * cu + dv[1] * cv;
      const uz = o[2] + du[2] * cu + dv[2] * cv;
      b.vertex(off + ux * s, off + uy * s, off + uz * s, cu, 1 - cv, def.layers[f], f);
    }
  }
  return { vertices: b.slice(), quads: 6 };
}

/** 十字物品（平面）网格：用于手持工具 */
export function buildFlatItemMesh(layer) {
  const b = new Builder(2 * 4 * FLOATS_PER_VERTEX);
  const t = 1 / 16;
  // 正面 (+Z)
  b.vertex(0, 0, t, 0, 1, layer, 4);
  b.vertex(1, 0, t, 1, 1, layer, 4);
  b.vertex(1, 1, t, 1, 0, layer, 4);
  b.vertex(0, 1, t, 0, 0, layer, 4);
  // 背面 (-Z)
  b.vertex(1, 0, 0, 0, 1, layer, 5);
  b.vertex(0, 0, 0, 1, 1, layer, 5);
  b.vertex(0, 1, 0, 1, 0, layer, 5);
  b.vertex(1, 1, 0, 0, 0, layer, 5);
  return { vertices: b.slice(), quads: 2 };
}
