// Voxel chunk mesher: face culling, baked ambient occlusion, MC-style directional shading.
// Pure function over a padded voxel volume — usable in a worker.

import { BLOCKS, RT, BID } from './blocks.js';
import { CH, CH_H, GW, PAD, padIdx } from './worldgen.js';
import { TILE_INDEX, tileUV } from './atlas.js';
import { hashFloat } from '../core/rng.js';

// face definitions: normal + 4 vertex corner offsets (CCW from outside)
const FACES = [
  { n: [0, 1, 0], axis: 1, sign: 1, verts: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], uvs: [[0, 0], [0, 1], [1, 1], [1, 0]], shade: 1.0, kind: 'top' },
  { n: [0, -1, 0], axis: 1, sign: -1, verts: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]], shade: 0.62, kind: 'bottom' },
  { n: [1, 0, 0], axis: 0, sign: 1, verts: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]], shade: 0.82, kind: 'side' },
  { n: [-1, 0, 0], axis: 0, sign: -1, verts: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]], shade: 0.82, kind: 'side' },
  { n: [0, 0, 1], axis: 2, sign: 1, verts: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]], shade: 0.72, kind: 'side' },
  { n: [0, 0, -1], axis: 2, sign: -1, verts: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]], shade: 0.72, kind: 'side' },
];

const AO_LEVELS = [0.52, 0.68, 0.85, 1.0];

class Builder {
  constructor() {
    this.cap = 4096;
    this.pos = new Float32Array(this.cap * 3);
    this.uv = new Float32Array(this.cap * 2);
    this.light = new Uint8Array(this.cap);
    this.emit = new Uint8Array(this.cap);
    this.sway = new Uint8Array(this.cap);
    this.tint = new Uint8Array(this.cap * 3);
    this.idx = [];
    this.n = 0;
  }
  ensure(extra) {
    if (this.n + extra <= this.cap) return;
    while (this.n + extra > this.cap) this.cap *= 2;
    const p = new Float32Array(this.cap * 3); p.set(this.pos); this.pos = p;
    const u = new Float32Array(this.cap * 2); u.set(this.uv); this.uv = u;
    const l = new Uint8Array(this.cap); l.set(this.light); this.light = l;
    const e = new Uint8Array(this.cap); e.set(this.emit); this.emit = e;
    const s = new Uint8Array(this.cap); s.set(this.sway); this.sway = s;
    const t = new Uint8Array(this.cap * 3); t.set(this.tint); this.tint = t;
  }
  vert(x, y, z, u, v, light, emit, sway, tr, tg, tb) {
    this.ensure(1);
    const n = this.n;
    this.pos[n * 3] = x; this.pos[n * 3 + 1] = y; this.pos[n * 3 + 2] = z;
    this.uv[n * 2] = u; this.uv[n * 2 + 1] = v;
    this.light[n] = light; this.emit[n] = emit; this.sway[n] = sway;
    this.tint[n * 3] = tr; this.tint[n * 3 + 1] = tg; this.tint[n * 3 + 2] = tb;
    this.n++;
    return n;
  }
  quad(a, b, c, d, flip) {
    if (flip) this.idx.push(a, b, c, a, c, d);
    else this.idx.push(a, b, c, a, c, d);
  }
  result() {
    // safety: index values must all be < vertex count
    return {
      position: this.pos.subarray(0, this.n * 3).slice(),
      uv: this.uv.subarray(0, this.n * 2).slice(),
      light: this.light.subarray(0, this.n).slice(),
      emit: this.emit.subarray(0, this.n).slice(),
      sway: this.sway.subarray(0, this.n).slice(),
      tint: this.tint.subarray(0, this.n * 3).slice(),
      index: (this.n > 65535 ? new Uint32Array(this.idx) : new Uint16Array(this.idx)),
      count: this.n,
    };
  }
}

function tileFor(def, faceKind) {
  let name = def.side;
  if (faceKind === 'top' && def.top) name = def.top;
  else if (faceKind === 'bottom' && def.bottom) name = def.bottom;
  const i = TILE_INDEX[name];
  return i === undefined ? 0 : i;
}

/**
 * @param {Uint8Array} pad padded volume (GW*GW*CH_H)
 * @param {number} cx chunk x
 * @param {number} cz chunk z
 * @param {number} seed planet seed for per-block variation
 */
export function meshChunk(pad, cx, cz, seed = 0) {
  const opaque = new Builder();
  const alpha = new Builder();
  const baseX = cx * CH, baseZ = cz * CH;

  const get = (x, y, z) => {
    if (y < 0 || y >= CH_H) return 0;
    if (x < -PAD || z < -PAD || x >= CH + PAD || z >= CH + PAD) return 0;
    return pad[padIdx(x, y, z)];
  };
  const occl = (x, y, z) => {
    const id = get(x, y, z);
    if (!id) return 0;
    const d = BLOCKS[id];
    return d && d.opaque ? 1 : 0;
  };

  // sky column height (for cave darkening)
  const skyTop = new Int16Array(GW * GW);
  for (let z = -PAD; z < CH + PAD; z++) {
    for (let x = -PAD; x < CH + PAD; x++) {
      let top = 0;
      for (let y = CH_H - 1; y >= 0; y--) {
        const id = pad[padIdx(x, y, z)];
        if (id && BLOCKS[id].opaque) { top = y; break; }
      }
      skyTop[(x + PAD) + GW * (z + PAD)] = top;
    }
  }
  const skyFactor = (x, y, z) => {
    const top = skyTop[(Math.max(-PAD, Math.min(CH + PAD - 1, x)) + PAD) + GW * (Math.max(-PAD, Math.min(CH + PAD - 1, z)) + PAD)];
    if (y >= top) return 1;
    const d = top - y;
    return Math.max(0.22, 1 - d * 0.11);
  };

  for (let y = 0; y < CH_H; y++) {
    for (let z = 0; z < CH; z++) {
      for (let x = 0; x < CH; x++) {
        const id = pad[padIdx(x, y, z)];
        if (!id) continue;
        const def = BLOCKS[id];
        const target = (id === BID.WATER || id === BID.GLASS || id === BID.ICE) ? alpha : opaque;
        const wx = baseX + x, wz = baseZ + z;
        const varv = 0.88 + hashFloat(wx, y, wz, seed + 5) * 0.24;
        const tr = Math.min(255, (varv * 255) | 0);
        const emit = (def.emissive * 255) | 0;
        const sway = def.sway ? 255 : 0;
        const sky = skyFactor(x, y, z);

        if (def.rt === RT.CROSS) {
          // two crossed quads
          const tile = tileFor(def, 'side');
          const [u0, v0, u1, v1] = tileUV(tile);
          const jx = (hashFloat(wx, 3, wz, seed + 9) - 0.5) * 0.34;
          const jz = (hashFloat(wx, 7, wz, seed + 19) - 0.5) * 0.34;
          const light = Math.min(255, (sky * 255) | 0);
          const b = target;
          const quads = [
            [[0.09, 0, 0.09], [0.91, 0, 0.91]],
            [[0.91, 0, 0.09], [0.09, 0, 0.91]],
          ];
          for (const [p0, p1] of quads) {
            const ax = x + p0[0] + jx, az = z + p0[2] + jz;
            const bx = x + p1[0] + jx, bz = z + p1[2] + jz;
            const i0 = b.vert(ax, y, az, u0, v0, light, emit, sway, tr, tr, tr);
            const i1 = b.vert(bx, y, bz, u1, v0, light, emit, sway, tr, tr, tr);
            const i2 = b.vert(bx, y + 1, bz, u1, v1, light, emit, sway, tr, tr, tr);
            const i3 = b.vert(ax, y + 1, az, u0, v1, light, emit, sway, tr, tr, tr);
            b.idx.push(i0, i1, i2, i0, i2, i3);
            // back faces so cross-plants are visible from every direction
            b.idx.push(i2, i1, i0, i3, i2, i0);
          }
          continue;
        }

        const isLiquid = def.rt === RT.LIQUID;
        for (let f = 0; f < 6; f++) {
          const F = FACES[f];
          const nx = x + F.n[0], ny = y + F.n[1], nz = z + F.n[2];
          const nid = get(nx, ny, nz);
          if (nid) {
            const nd = BLOCKS[nid];
            if (nd.opaque) continue;
            if (nid === id && (isLiquid || def.hasAlpha)) continue;
            if (isLiquid && nid === BID.WATER) continue;
          }
          if (isLiquid && F.kind === 'bottom') continue;
          if (y === 0 && F.kind === 'bottom') continue;   // world floor is never seen

          const tile = tileFor(def, F.kind);
          const [tu0, tv0, tu1, tv1] = tileUV(tile);
          const lightBase = F.shade * sky;
          const yOff = isLiquid && F.kind === 'top' ? -0.12 : 0;
          const ao = [];
          for (let v = 0; v < 4; v++) {
            const off = F.verts[v];
            // AO: sample the two tangent neighbours + corner in front of the face
            const t1 = (F.axis + 1) % 3, t2 = (F.axis + 2) % 3;
            const c1 = off[t1] * 2 - 1, c2 = off[t2] * 2 - 1;
            const p = [nx, ny, nz];
            const s1 = [p[0], p[1], p[2]]; s1[t1] += c1;
            const s2 = [p[0], p[1], p[2]]; s2[t2] += c2;
            const cc = [p[0], p[1], p[2]]; cc[t1] += c1; cc[t2] += c2;
            const o1 = occl(s1[0], s1[1], s1[2]);
            const o2 = occl(s2[0], s2[1], s2[2]);
            const oc = occl(cc[0], cc[1], cc[2]);
            const level = (o1 && o2) ? 0 : 3 - (o1 + o2 + oc);
            ao.push(AO_LEVELS[Math.max(0, Math.min(3, level))]);
          }
          const ids = [];
          for (let v = 0; v < 4; v++) {
            const off = F.verts[v];
            const uvv = F.uvs[v];
            const u = tu0 + (tu1 - tu0) * uvv[0];
            const vv = tv0 + (tv1 - tv0) * uvv[1];
            const lt = Math.min(255, Math.max(0, (lightBase * ao[v] * 255) | 0));
            ids.push(target.vert(
              x + off[0], y + off[1] + (off[1] === 1 ? yOff : 0), z + off[2],
              u, vv, lt, emit, sway, tr, tr, tr
            ));
          }
          // flip quad diagonal for smoother AO gradients
          if (ao[0] + ao[2] > ao[1] + ao[3]) target.idx.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]);
          else target.idx.push(ids[1], ids[2], ids[3], ids[1], ids[3], ids[0]);
        }
      }
    }
  }
  return { opaque: opaque.result(), alpha: alpha.result() };
}
