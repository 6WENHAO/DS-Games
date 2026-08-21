/**
 * SALTWAKE — world construction.
 *
 * A level is authored as text. Each zone contributes a rectangle of characters
 * to one **global cell grid**: a `plan` grid of surface types plus optional
 * `height` and `ceil` grids of hex digits. Zones are placed at integer cell
 * offsets, so walls between neighbouring zones appear automatically and the
 * player, the enemy pathing and the headless solver all read the same grid with
 * no seams to special-case.
 *
 * The tilted-street look comes from two places that do not disturb the grid:
 * rotated decorative geometry (`props`, which become oriented box colliders) and
 * a persistent view roll applied per district.
 *
 * From the grid this module produces, in one pass:
 *
 *   geometry  — floor, ceiling and wall quads subdivided to WORLD.lightGrid so
 *               per-vertex lighting has somewhere to land, merged into a single
 *               buffer with per-face atlas rects. One draw call for the level.
 *   colliders — oriented boxes for decorative props and doors. Grid cells are
 *               handled analytically, which is faster and cannot tunnel.
 *   light     — baked vertex colour from the placed lights with a stepped
 *               occlusion test, which is a 1997 lightmap bake done per vertex.
 */
import * as THREE from 'three';
import { WORLD, PALETTE, BAKE } from '../core/config.js';
import { CELL, STEP, CELLS, WorldGrid, compositeGrid } from './grid.js';
import { TILES, textures } from '../gfx/textures.js';
import { createWorldMaterial } from '../gfx/materials.js';

export { CELL, STEP, CELLS, WorldGrid, compositeGrid };

/* ================================================================== *
 * Oriented box colliders, for props and door leaves
 * ================================================================== */

export class Collider {
  constructor(cx, cz, halfX, halfZ, y0, y1, yaw = 0, tag = null) {
    this.cx = cx;
    this.cz = cz;
    this.halfX = halfX;
    this.halfZ = halfZ;
    this.y0 = y0;
    this.y1 = y1;
    this.yaw = yaw;
    this.cos = Math.cos(yaw);
    this.sin = Math.sin(yaw);
    this.tag = tag;
    this.disabled = false;
  }

  toLocal(x, z, out) {
    const dx = x - this.cx;
    const dz = z - this.cz;
    out.x = dx * this.cos - dz * this.sin;
    out.z = dx * this.sin + dz * this.cos;
    return out;
  }

  toWorldDir(lx, lz, out) {
    out.x = lx * this.cos + lz * this.sin;
    out.z = -lx * this.sin + lz * this.cos;
    return out;
  }

  bounds() {
    const ex = Math.abs(this.halfX * this.cos) + Math.abs(this.halfZ * this.sin);
    const ez = Math.abs(this.halfX * this.sin) + Math.abs(this.halfZ * this.cos);
    return { minX: this.cx - ex, maxX: this.cx + ex, minZ: this.cz - ez, maxZ: this.cz + ez };
  }
}

/** Uniform-grid broadphase over world XZ. */
export class ColliderIndex {
  constructor(cellSize = 6) {
    this.cellSize = cellSize;
    this.buckets = new Map();
    this.all = [];
    this._seen = new Set();
  }

  add(collider) {
    this.all.push(collider);
    const b = collider.bounds();
    const i0 = Math.floor(b.minX / this.cellSize);
    const i1 = Math.floor(b.maxX / this.cellSize);
    const j0 = Math.floor(b.minZ / this.cellSize);
    const j1 = Math.floor(b.maxZ / this.cellSize);
    for (let j = j0; j <= j1; j += 1) {
      for (let i = i0; i <= i1; i += 1) {
        const k = `${i}|${j}`;
        let list = this.buckets.get(k);
        if (!list) { list = []; this.buckets.set(k, list); }
        list.push(collider);
      }
    }
    return collider;
  }

  query(minX, minZ, maxX, maxZ, out) {
    out.length = 0;
    const seen = this._seen;
    seen.clear();
    const i0 = Math.floor(minX / this.cellSize);
    const i1 = Math.floor(maxX / this.cellSize);
    const j0 = Math.floor(minZ / this.cellSize);
    const j1 = Math.floor(maxZ / this.cellSize);
    for (let j = j0; j <= j1; j += 1) {
      for (let i = i0; i <= i1; i += 1) {
        const list = this.buckets.get(`${i}|${j}`);
        if (!list) continue;
        for (let k = 0; k < list.length; k += 1) {
          const c = list[k];
          if (c.disabled || seen.has(c)) continue;
          seen.add(c);
          out.push(c);
        }
      }
    }
    return out;
  }
}

/* ================================================================== *
 * Geometry accumulation
 * ================================================================== */

const _t1 = new THREE.Vector3();
const _t2 = new THREE.Vector3();
let _atlasRects = null;

function tileRect(index) {
  if (!_atlasRects) _atlasRects = textures.world.rects;
  const i = Math.max(0, Math.min(textures.world.count - 1, index | 0)) * 4;
  return [_atlasRects[i], _atlasRects[i + 1], _atlasRects[i + 2], _atlasRects[i + 3]];
}

export class SurfaceBuilder {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.uv = [];
    this.tile = [];
    this.col = [];
    this.count = 0;
    this.faces = [];
  }

  /** Quad corners counter-clockwise seen from the front. */
  quad(a, b, c, d, normal, tileIndex, uvScaleX, uvScaleY, meta) {
    const rect = tileRect(tileIndex);
    const wLen = a.distanceTo(b);
    const hLen = a.distanceTo(d);
    const wN = Math.max(1, Math.min(8, Math.round(wLen / WORLD.lightGrid)));
    const hN = Math.max(1, Math.min(8, Math.round(hLen / WORLD.lightGrid)));

    const bilinear = (u, v, out) => {
      const top = _t1.lerpVectors(a, b, u);
      const bot = _t2.lerpVectors(d, c, u);
      return out.lerpVectors(top, bot, v);
    };

    for (let j = 0; j < hN; j += 1) {
      for (let i = 0; i < wN; i += 1) {
        const u0 = i / wN; const u1 = (i + 1) / wN;
        const v0 = j / hN; const v1 = (j + 1) / hN;
        const p00 = bilinear(u0, v0, new THREE.Vector3());
        const p10 = bilinear(u1, v0, new THREE.Vector3());
        const p11 = bilinear(u1, v1, new THREE.Vector3());
        const p01 = bilinear(u0, v1, new THREE.Vector3());
        const tu0 = u0 * uvScaleX; const tu1 = u1 * uvScaleX;
        const tv0 = (1 - v0) * uvScaleY; const tv1 = (1 - v1) * uvScaleY;
        this.tri(p00, p10, p11, normal, rect, tu0, tv0, tu1, tv0, tu1, tv1, meta);
        this.tri(p00, p11, p01, normal, rect, tu0, tv0, tu1, tv1, tu0, tv1, meta);
      }
    }
  }

  tri(p0, p1, p2, n, rect, u0, v0, u1, v1, u2, v2, meta) {
    this.pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
    for (let k = 0; k < 3; k += 1) {
      this.nrm.push(n.x, n.y, n.z);
      this.tile.push(rect[0], rect[1], rect[2], rect[3]);
      this.col.push(1, 1, 1);
    }
    this.uv.push(u0, v0, u1, v1, u2, v2);
    this.faces.push({ start: this.count, meta });
    this.count += 3;
  }

  build(material, name) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    geometry.setAttribute('aTile', new THREE.Float32BufferAttribute(this.tile, 4));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name || 'level';
    mesh.matrixAutoUpdate = false;
    mesh.frustumCulled = false;
    return mesh;
  }
}


/* ================================================================== *
 * Grid to geometry
 * ================================================================== */

const SIDES = [
  { dc: 0, dr: -1, ax: [0, 0], bx: [1, 0], n: [0, 0, -1] },
  { dc: 1, dr: 0, ax: [1, 0], bx: [1, 1], n: [1, 0, 0] },
  { dc: 0, dr: 1, ax: [1, 1], bx: [0, 1], n: [0, 0, 1] },
  { dc: -1, dr: 0, ax: [0, 1], bx: [0, 0], n: [-1, 0, 0] },
];

function emitGeometry(grid, surf, index, doorCells) {
  const V = () => new THREE.Vector3();
  const at = (col, row, fx, fz, y, out = V()) => out.set((col + fx) * CELL, y, (row + fz) * CELL);
  const uvPerMetre = 0.5;   // one texture repeat every two metres

  grid.forEach((cell, col, row) => {
    if (cell.info.name === 'void') return;

    const fy = cell.floorY;
    const cy = cell.ceilY;

    if (cell.solid) return;    // faces come from the open neighbours

    if (cell.door) {
      const leafTile = cell.secret
        ? TILES[cell.tiles.wall]
        : TILES[cell.tiles.door || 'brassDoor'];
      // Two back-to-back faces across the middle of the cell.
      const mid = 0.5;
      surf.quad(
        at(col, row, 0.12, mid, fy), at(col, row, 0.88, mid, fy),
        at(col, row, 0.88, mid, cy), at(col, row, 0.12, mid, cy),
        new THREE.Vector3(0, 0, -1), leafTile, 1, 1, { kind: 'doorLeaf', col, row },
      );
      surf.quad(
        at(col, row, 0.88, mid, fy), at(col, row, 0.12, mid, fy),
        at(col, row, 0.12, mid, cy), at(col, row, 0.88, mid, cy),
        new THREE.Vector3(0, 0, 1), leafTile, 1, 1, { kind: 'doorLeaf', col, row },
      );
      const collider = index.add(new Collider(
        (col + 0.5) * CELL, (row + 0.5) * CELL, CELL * 0.5, CELL * 0.5, fy, cy, 0,
        { kind: cell.secret ? 'secret' : 'door', col, row },
      ));
      cell.collider = collider;
      doorCells.push(cell);
      return;
    }

    /* ---- floor ---- */
    if (!cell.pit) {
      const floorTile = cell.water ? TILES.sludge
        : cell.hazard ? TILES.mosaic
          : TILES[cell.tiles.floor];
      surf.quad(
        at(col, row, 0, 1, fy), at(col, row, 1, 1, fy),
        at(col, row, 1, 0, fy), at(col, row, 0, 0, fy),
        new THREE.Vector3(0, 1, 0), floorTile, CELL * uvPerMetre, CELL * uvPerMetre,
        { kind: 'floor', col, row },
      );
    }

    /* ---- ceiling ---- */
    if (!cell.openSky) {
      surf.quad(
        at(col, row, 0, 0, cy), at(col, row, 1, 0, cy),
        at(col, row, 1, 1, cy), at(col, row, 0, 1, cy),
        new THREE.Vector3(0, -1, 0), TILES[cell.tiles.ceil], CELL * uvPerMetre, CELL * uvPerMetre,
        { kind: 'ceil', col, row },
      );
    }

    /* ---- walls, risers and headers ---- */
    for (const side of SIDES) {
      const nb = grid.get(col + side.dc, row + side.dr);
      const normal = new THREE.Vector3(-side.n[0], 0, -side.n[2]);
      const a = at(col, row, side.ax[0], side.ax[1], fy);
      const b = at(col, row, side.bx[0], side.bx[1], fy);

      const missing = !nb || nb.info.name === 'void';
      if (missing || nb.solid) {
        const top = (missing && cell.openSky) ? cy + 3.0 : cy;
        surf.quad(
          a.clone(), b.clone(),
          at(col, row, side.bx[0], side.bx[1], top), at(col, row, side.ax[0], side.ax[1], top),
          normal, TILES[cell.tiles.wall], CELL * uvPerMetre, (top - fy) * uvPerMetre,
          { kind: 'wall', col, row },
        );
        continue;
      }
      if (!nb.walk) continue;

      if (nb.floorY < fy - 0.01) {
        surf.quad(
          at(col, row, side.ax[0], side.ax[1], nb.floorY), at(col, row, side.bx[0], side.bx[1], nb.floorY),
          b.clone(), a.clone(),
          normal, TILES[cell.tiles.trim || cell.tiles.wall],
          CELL * uvPerMetre, (fy - nb.floorY) * uvPerMetre,
          { kind: 'riser', col, row },
        );
      }
      if (nb.ceilY < cy - 0.01 && !cell.openSky) {
        surf.quad(
          at(col, row, side.ax[0], side.ax[1], nb.ceilY), at(col, row, side.bx[0], side.bx[1], nb.ceilY),
          at(col, row, side.bx[0], side.bx[1], cy), at(col, row, side.ax[0], side.ax[1], cy),
          normal, TILES[cell.tiles.wall], CELL * uvPerMetre, (cy - nb.ceilY) * uvPerMetre,
          { kind: 'header', col, row },
        );
      }
    }
  });
}

/* ================================================================== *
 * Decorative props: rotated boxes, which is where the tilt comes from
 * ================================================================== */

function emitProps(propSpecs, surf, index) {
  const list = [];
  for (const p of propSpecs || []) {
    const yaw = (p.yaw || 0) * Math.PI / 180;
    const roll = (p.roll || 0) * Math.PI / 180;
    const [w, h, d] = p.size;
    const [px, py, pz] = p.pos;
    const tile = TILES[p.tile] !== undefined ? TILES[p.tile] : TILES.dockPlanks;

    // Build the box in local space, then rotate by yaw and lean by roll. The
    // lean is what makes a facade read as subsiding into the mud.
    const cy = Math.cos(yaw); const sy = Math.sin(yaw);
    const cr = Math.cos(roll); const sr = Math.sin(roll);
    const corner = (lx, ly, lz, out = new THREE.Vector3()) => {
      // roll about local Z first, then yaw about Y
      const rx = lx * cr - ly * sr;
      const ry = lx * sr + ly * cr;
      return out.set(px + rx * cy + lz * sy, py + ry, pz - rx * sy + lz * cy);
    };
    const hx = w * 0.5; const hz = d * 0.5;
    const c000 = corner(-hx, 0, -hz); const c100 = corner(hx, 0, -hz);
    const c110 = corner(hx, 0, hz); const c010 = corner(-hx, 0, hz);
    const t000 = corner(-hx, h, -hz); const t100 = corner(hx, h, -hz);
    const t110 = corner(hx, h, hz); const t010 = corner(-hx, h, hz);

    const uvW = w * 0.5;
    const uvH = h * 0.5;
    const face = (p0, p1, p2, p3, nx, ny, nz, su, sv) => surf.quad(
      p0, p1, p2, p3, new THREE.Vector3(nx, ny, nz).normalize(), tile, su, sv,
      { kind: 'prop', id: p.id },
    );
    face(c000, c100, t100, t000, sy, sr, -cy, uvW, uvH);       // -Z
    face(c110, c010, t010, t110, -sy, sr, cy, uvW, uvH);       // +Z
    face(c100, c110, t110, t100, cy, sr, sy, d * 0.5, uvH);    // +X
    face(c010, c000, t000, t010, -cy, sr, -sy, d * 0.5, uvH);  // -X
    face(t000, t100, t110, t010, 0, 1, 0, uvW, d * 0.5);       // top
    if (p.solid !== false) {
      index.add(new Collider(px, pz, hx, hz, py, py + h, yaw, { kind: 'prop', id: p.id }));
    }
    list.push(p);
  }
  return list;
}

/* ================================================================== *
 * Light bake
 * ================================================================== */

function bakeLight(surf, lightList, grid, index, sky) {
  const pos = surf.pos;
  const nrm = surf.nrm;
  const out = surf.col;
  const vertexCount = pos.length / 3;
  const scratch = [];
  const local = { x: 0, z: 0 };

  /**
   * Stepped occlusion. Grid cells are tested analytically, prop colliders
   * through the broadphase. Coarse on purpose: a period lightmap had exactly
   * this blotchy, slightly wrong quality.
   */
  const occluded = (fx, fy, fz, tx, ty, tz) => {
    const dx = tx - fx;
    const dy = ty - fy;
    const dz = tz - fz;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 0.25) return false;
    const steps = Math.min(28, Math.max(3, Math.round(dist / 0.8)));
    index.query(Math.min(fx, tx), Math.min(fz, tz), Math.max(fx, tx), Math.max(fz, tz), scratch);
    for (let s = 1; s < steps; s += 1) {
      const t = s / steps;
      const px = fx + dx * t;
      const py = fy + dy * t;
      const pz = fz + dz * t;
      const cell = grid.atWorld(px, pz);
      if (!cell || cell.info.name === 'void') return true;
      if (cell.solid) return true;
      if (py < cell.floorY - 0.12 || py > cell.ceilY + 0.12) return true;
      for (let i = 0; i < scratch.length; i += 1) {
        const c = scratch[i];
        if (c.tag && (c.tag.kind === 'door' || c.tag.kind === 'secret')) continue;
        if (py < c.y0 - 0.05 || py > c.y1 + 0.05) continue;
        c.toLocal(px, pz, local);
        if (Math.abs(local.x) <= c.halfX - 0.05 && Math.abs(local.z) <= c.halfZ - 0.05) return true;
      }
    }
    return false;
  };

  for (let v = 0; v < vertexCount; v += 1) {
    const px = pos[v * 3];
    const py = pos[v * 3 + 1];
    const pz = pos[v * 3 + 2];
    const nx = nrm[v * 3];
    const ny = nrm[v * 3 + 1];
    const nz = nrm[v * 3 + 2];

    /* Hemisphere floor plus a moon term. Without this the world shader has no
     * ambient at all, because it reads the bake and nothing else. Cells under
     * open sky get the full sky and moon; interiors get a fraction of the sky as
     * bounce, which is what stops a room from going to absolute black. */
    const cell = grid.atWorld(px, pz);
    const openSky = !!(cell && cell.openSky);
    const upness = Math.max(0, ny) * 0.5 + 0.5;
    const skyAmount = (openSky ? 1 : BAKE.indoorSkyFraction) * upness;

    let r = sky.ambient.r + sky.sky.r * skyAmount;
    let g = sky.ambient.g + sky.sky.g * skyAmount;
    let b = sky.ambient.b + sky.sky.b * skyAmount;

    if (openSky) {
      const nDotL = nx * sky.moonDir.x + ny * sky.moonDir.y + nz * sky.moonDir.z;
      const moon = Math.max(0, nDotL) * 0.7 + 0.3;
      r += sky.moon.r * moon;
      g += sky.moon.g * moon;
      b += sky.moon.b * moon;
    }

    for (let li = 0; li < lightList.length; li += 1) {
      const L = lightList[li];
      if (!L.bake) continue;
      const dx = L.x - px;
      const dy = L.y - py;
      const dz = L.z - pz;
      const dist2 = dx * dx + dy * dy + dz * dz;
      const reach = L.radius * BAKE.radiusScale;
      if (dist2 > reach * reach) continue;
      const dist = Math.sqrt(dist2);
      const inv = 1 / Math.max(dist, 1e-4);
      let lambert = (dx * nx + dy * ny + dz * nz) * inv;
      lambert = lambert * 0.62 + 0.38;
      if (lambert <= 0.02) continue;
      if (occluded(px + nx * 0.14, py + ny * 0.14, pz + nz * 0.14, L.x, L.y, L.z)) continue;
      let atten = 1 - dist / reach;
      atten *= atten;
      const k = atten * lambert * L.intensity * BAKE.lightGain;
      r += L.color.r * k;
      g += L.color.g * k;
      b += L.color.b * k;
    }

    out[v * 3] = r;
    out[v * 3 + 1] = g;
    out[v * 3 + 2] = b;
  }
}

/* ================================================================== *
 * Public build
 * ================================================================== */

/**
 * @param {object} spec see src/world/levelData.js
 * @returns {object} the assembled world
 */
export function buildWorld(spec) {
  const grid = compositeGrid(spec.zones);
  const surf = new SurfaceBuilder();
  const index = new ColliderIndex(6);
  const doorCells = [];

  emitGeometry(grid, surf, index, doorCells);
  const props = emitProps(spec.props, surf, index);

  const skyBake = {
    ambient: new THREE.Color(BAKE.ambient).multiplyScalar(BAKE.ambientGain),
    sky: new THREE.Color(BAKE.sky).multiplyScalar(BAKE.skyGain),
    moon: new THREE.Color(BAKE.moon).multiplyScalar(BAKE.moonGain),
    moonDir: new THREE.Vector3(0.35, 0.55, -0.75).normalize(),
  };
  const lights = (spec.lights || []).map((l, i) => ({
    id: l.id || `light${i}`,
    x: l.pos[0], y: l.pos[1], z: l.pos[2],
    radius: l.radius === undefined ? 9 : l.radius,
    intensity: l.intensity === undefined ? 1 : l.intensity,
    color: new THREE.Color(l.color || PALETTE.highAmber),
    bake: l.bake !== false,
    dynamic: !!l.dynamic,
    flicker: l.flicker || 0,
    kind: l.kind || 'lamp',
  }));

  bakeLight(surf, lights, grid, index, skyBake);

  const material = createWorldMaterial();
  const mesh = surf.build(material, 'level');

  /* --- wire door definitions onto their cells --- */
  const doors = new Map();
  for (const d of spec.doors || []) {
    const cell = grid.get(d.col, d.row);
    if (!cell || !cell.door) {
      throw new Error(`door "${d.id}" at ${d.col},${d.row} does not sit on a door cell`);
    }
    cell.doorId = d.id;
    doors.set(d.id, {
      ...d,
      cell,
      open: false,
      progress: 0,
    });
  }
  // Any door cell without a definition is an unlocked pass-through.
  for (const cell of doorCells) {
    if (cell.doorId) continue;
    const id = `auto:${cell.col},${cell.row}`;
    cell.doorId = id;
    doors.set(id, { id, col: cell.col, row: cell.row, key: null, cell, open: false, progress: 0 });
  }

  let walkable = 0;
  grid.forEach((c) => { if (c.walk) walkable += 1; });

  return {
    spec,
    grid,
    mesh,
    material,
    colliders: index,
    lights,
    props,
    doors,
    faces: surf.faces,
    triangleCount: surf.count / 3,
    vertexCount: surf.pos.length / 3,
    walkableCells: walkable,
    bounds: {
      minX: 0, minZ: 0, maxX: grid.cols * CELL, maxZ: grid.rows * CELL,
    },
  };
}
