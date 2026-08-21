/**
 * SALTWAKE — the global cell grid.
 *
 * Deliberately free of three.js so the headless tools can composite and analyse
 * a level without a renderer. src/world/build.js turns this grid into geometry;
 * tools/solve-level.mjs walks it to prove the level can be finished.
 *
 * ## Authoring format
 *
 * A level is a list of zones. Each zone contributes a rectangle of characters to
 * the global grid at an integer cell offset, so two zones placed side by side
 * share a wall automatically.
 *
 *   plan    required, an array of strings. One character per cell:
 *             '#' solid wall, full height
 *             '.' floor
 *             ' ' nothing: leaves the cell untouched, so zones can overlap
 *             '~' water floor (needs the zone's waterY)
 *             '^' hazard floor, damages anything standing on it
 *             '+' door cell, solid until opened
 *             'S' secret door, textured as the surrounding wall
 *             '=' catwalk floor
 *             'o' pit: no floor, fall through
 *   height  optional, hex digit per cell: floor rises by digit * STEP (0.4 m).
 *           A run of increasing digits is a staircase.
 *   ceil    optional, hex digit per cell: ceiling rises by digit * STEP.
 *
 * Cells are 3 m. Zones carry their own floorY, ceiling height, tile set, water
 * level, sky flag and district id.
 */

export const CELL = 3.0;
export const STEP = 0.4;
export const WALL_HEIGHT = 4.0;

/** Plan characters. `walk` means an actor can stand there. */
export const CELLS = {
  '#': { name: 'solid', walk: false, solid: true },
  '.': { name: 'floor', walk: true },
  ' ': { name: 'void', walk: false },
  '~': { name: 'water', walk: true, water: true },
  '^': { name: 'hazard', walk: true, hazard: true },
  '+': { name: 'door', walk: true, door: true },
  S: { name: 'secret', walk: true, door: true, secret: true },
  '=': { name: 'catwalk', walk: true, catwalk: true },
  o: { name: 'pit', walk: false, pit: true },
};

export function hexDigit(ch) {
  if (ch === undefined || ch === ' ') return 0;
  const v = parseInt(ch, 16);
  return Number.isFinite(v) ? v : 0;
}

export class WorldGrid {
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.cells = new Array(cols * rows).fill(null);
  }

  idx(col, row) { return row * this.cols + col; }

  get(col, row) {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return null;
    return this.cells[this.idx(col, row)];
  }

  set(col, row, cell) {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return;
    this.cells[this.idx(col, row)] = cell;
  }

  atWorld(x, z) {
    return this.get(Math.floor(x / CELL), Math.floor(z / CELL));
  }

  /** Walkable and not a closed door. */
  isOpen(col, row) {
    const c = this.get(col, row);
    return !!c && c.walk && !(c.door && !c.doorOpen);
  }

  centreOf(col, row) {
    const c = this.get(col, row);
    return { x: (col + 0.5) * CELL, y: c ? c.floorY : 0, z: (row + 0.5) * CELL };
  }

  forEach(fn) {
    for (let row = 0; row < this.rows; row += 1) {
      for (let col = 0; col < this.cols; col += 1) {
        const c = this.cells[this.idx(col, row)];
        if (c) fn(c, col, row);
      }
    }
  }

  /** Cells an actor of this radius overlaps, as [col,row] pairs. */
  overlapping(x, z, radius, out = []) {
    out.length = 0;
    const c0 = Math.floor((x - radius) / CELL);
    const c1 = Math.floor((x + radius) / CELL);
    const r0 = Math.floor((z - radius) / CELL);
    const r1 = Math.floor((z + radius) / CELL);
    for (let row = r0; row <= r1; row += 1) {
      for (let col = c0; col <= c1; col += 1) out.push(col, row);
    }
    return out;
  }
}

/**
 * Composite a level's zones into one grid.
 * @param {Array} zoneSpecs
 * @returns {WorldGrid}
 */
export function compositeGrid(zoneSpecs) {
  if (!Array.isArray(zoneSpecs) || zoneSpecs.length === 0) {
    throw new Error('compositeGrid: the level needs at least one zone');
  }
  let maxCol = 0;
  let maxRow = 0;
  for (const z of zoneSpecs) {
    if (!Array.isArray(z.plan) || z.plan.length === 0) {
      throw new Error(`zone "${z.id}" has no plan`);
    }
    const cols = Math.max(...z.plan.map((r) => r.length));
    maxCol = Math.max(maxCol, z.col + cols);
    maxRow = Math.max(maxRow, z.row + z.plan.length);
  }
  const grid = new WorldGrid(maxCol + 1, maxRow + 1);

  for (const z of zoneSpecs) {
    const floorY = z.floorY || 0;
    const ceilH = z.ceilY === undefined ? WALL_HEIGHT : z.ceilY;
    for (let r = 0; r < z.plan.length; r += 1) {
      const line = z.plan[r];
      for (let c = 0; c < line.length; c += 1) {
        const ch = line[c];
        if (ch === ' ') continue;
        const info = CELLS[ch];
        if (!info) throw new Error(`zone "${z.id}": unknown plan character "${ch}" at column ${c}, row ${r}`);
        const hStep = z.height && r < z.height.length ? hexDigit(z.height[r][c]) : 0;
        const cStep = z.ceil && r < z.ceil.length ? hexDigit(z.ceil[r][c]) : 0;
        grid.set(z.col + c, z.row + r, {
          ch,
          info,
          zone: z.id,
          label: z.label || z.id,
          district: z.district || z.id,
          col: z.col + c,
          row: z.row + r,
          walk: !!info.walk,
          solid: !!info.solid,
          water: !!info.water,
          hazard: !!info.hazard,
          door: !!info.door,
          secret: !!info.secret,
          catwalk: !!info.catwalk,
          pit: !!info.pit,
          doorOpen: false,
          doorId: null,
          floorY: floorY + hStep * STEP,
          ceilY: floorY + ceilH + cStep * STEP,
          waterY: z.waterY === undefined ? null : z.waterY,
          openSky: !!z.openSky,
          tiles: z.tiles,
        });
      }
    }
  }
  return grid;
}

/**
 * Whether an actor standing at feetY may occupy this cell.
 * Shared by the runtime collision and the headless solver so they never disagree.
 */
export function cellEnterable(cell, feetY, height, stepHeight, keys = null) {
  if (!cell) return false;
  if (cell.info.name === 'void') return false;
  if (cell.solid) return false;
  if (cell.door && !cell.doorOpen) {
    // The solver passes a key set; the runtime passes null and relies on doorOpen.
    if (!keys) return false;
    if (cell.requiredKey && !keys.has(cell.requiredKey)) return false;
  }
  if (cell.pit) return true;
  if (cell.floorY - feetY > stepHeight + 1e-4) return false;
  const rest = Math.max(cell.floorY, Math.min(feetY, cell.floorY + stepHeight));
  if (cell.ceilY - rest < height - 0.05) return false;
  return true;
}
