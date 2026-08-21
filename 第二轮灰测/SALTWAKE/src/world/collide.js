/**
 * SALTWAKE — collision against the global grid.
 *
 * The player and every enemy are vertical cylinders. Grid cells are tested
 * analytically and resolved by per-axis clamping, which cannot tunnel at any
 * speed and handles inside corners correctly. Decorative props are oriented
 * boxes and are resolved by pushing out along the local axis of least
 * penetration.
 *
 * Vertical movement needs no sweep: the floor under a cylinder is the highest
 * walkable floor among the cells it overlaps, so stairs authored as a run of
 * height digits are climbed simply by walking into them.
 */
import { CELL } from './build.js';

const EPS = 1e-4;
const _local = { x: 0, z: 0 };
const _scratch = [];

/**
 * Can a cylinder standing at feetY occupy this cell?
 * @param {object} cell
 * @param {number} feetY
 * @param {number} height cylinder height
 * @param {number} stepHeight how far up it can climb in one move
 */
export function cellEnterable(cell, feetY, height, stepHeight) {
  if (!cell) return false;
  if (cell.info.name === 'void') return false;
  if (cell.solid) return false;
  if (cell.door && !cell.doorOpen) return false;
  if (cell.pit) return true;                          // you may fall into a pit
  if (cell.floorY - feetY > stepHeight + EPS) return false;
  // Headroom: measured from whichever floor the body would actually rest on.
  const rest = Math.max(cell.floorY, Math.min(feetY, cell.floorY + stepHeight));
  if (cell.ceilY - rest < height - 0.05) return false;
  return true;
}

/**
 * Highest walkable floor under a cylinder, and whether it is over a pit.
 * @returns {{floorY:number, ceilY:number, cell:object|null, overPit:boolean, water:boolean, hazard:boolean}}
 */
export function groundUnder(grid, x, z, radius, feetY, height, stepHeight) {
  const c0 = Math.floor((x - radius) / CELL);
  const c1 = Math.floor((x + radius) / CELL);
  const r0 = Math.floor((z - radius) / CELL);
  const r1 = Math.floor((z + radius) / CELL);
  let best = -Infinity;
  let bestCell = null;
  let ceil = Infinity;
  let overPit = true;
  let water = false;
  let hazard = false;

  for (let row = r0; row <= r1; row += 1) {
    for (let col = c0; col <= c1; col += 1) {
      const cell = grid.get(col, row);
      if (!cell || cell.info.name === 'void' || cell.solid) continue;
      if (cell.door && !cell.doorOpen) continue;
      if (!cell.pit) overPit = false;
      // Only floors at or below the body (plus one step) hold it up.
      if (cell.floorY <= feetY + stepHeight + 0.02 && cell.floorY > best) {
        best = cell.floorY;
        bestCell = cell;
      }
      if (cell.ceilY < ceil) ceil = cell.ceilY;
      if (cell.water) water = true;
      if (cell.hazard) hazard = true;
    }
  }
  if (!bestCell) {
    const centre = grid.atWorld(x, z);
    return {
      floorY: centre ? centre.floorY : 0,
      ceilY: centre ? centre.ceilY : 100,
      cell: centre,
      overPit: true,
      water: false,
      hazard: false,
    };
  }
  return { floorY: best, ceilY: ceil, cell: bestCell, overPit, water, hazard };
}

/**
 * Move a cylinder horizontally with per-axis clamping.
 * Mutates `body.x` / `body.z`. Returns which axes were blocked.
 * @param {object} grid
 * @param {object} body {x, z, y (feet), radius, height, stepHeight}
 * @param {number} dx
 * @param {number} dz
 */
export function moveHorizontal(grid, body, dx, dz) {
  const blocked = { x: false, z: false };
  const { radius, height, stepHeight } = body;

  const tryAxis = (axis, delta) => {
    if (delta === 0) return false;
    const target = body[axis] + delta;
    const other = axis === 'x' ? body.z : body.x;

    const oMin = Math.floor((other - radius) / CELL);
    const oMax = Math.floor((other + radius) / CELL);
    const edge = delta > 0 ? target + radius : target - radius;
    const cellIndex = Math.floor(edge / CELL);

    for (let o = oMin; o <= oMax; o += 1) {
      const cell = axis === 'x' ? grid.get(cellIndex, o) : grid.get(o, cellIndex);
      if (cellEnterable(cell, body.y, height, stepHeight)) continue;
      // Clamp so the cylinder rests exactly against the cell boundary.
      body[axis] = delta > 0
        ? cellIndex * CELL - radius - EPS
        : (cellIndex + 1) * CELL + radius + EPS;
      return true;
    }
    body[axis] = target;
    return false;
  };

  // Resolve the larger motion first: it gives better results sliding along walls.
  if (Math.abs(dx) >= Math.abs(dz)) {
    blocked.x = tryAxis('x', dx);
    blocked.z = tryAxis('z', dz);
  } else {
    blocked.z = tryAxis('z', dz);
    blocked.x = tryAxis('x', dx);
  }
  return blocked;
}

/**
 * Push a cylinder out of any oriented prop box it overlaps.
 * @returns {boolean} true when a push happened
 */
export function resolveProps(index, body, iterations = 3) {
  let pushed = false;
  const { radius, height } = body;
  for (let it = 0; it < iterations; it += 1) {
    index.query(body.x - radius, body.z - radius, body.x + radius, body.z + radius, _scratch);
    let moved = false;
    for (let i = 0; i < _scratch.length; i += 1) {
      const c = _scratch[i];
      // Vertical overlap: the body's span against the box's span.
      if (body.y + height <= c.y0 + 0.02 || body.y >= c.y1 - 0.02) continue;
      c.toLocal(body.x, body.z, _local);
      const overlapX = c.halfX + radius - Math.abs(_local.x);
      const overlapZ = c.halfZ + radius - Math.abs(_local.z);
      if (overlapX <= 0 || overlapZ <= 0) continue;
      // Push along whichever local axis needs the least correction.
      if (overlapX < overlapZ) {
        const dir = _local.x >= 0 ? 1 : -1;
        c.toWorldDir(overlapX * dir, 0, _local);
      } else {
        const dir = _local.z >= 0 ? 1 : -1;
        c.toWorldDir(0, overlapZ * dir, _local);
      }
      body.x += _local.x;
      body.z += _local.z;
      moved = true;
      pushed = true;
    }
    if (!moved) break;
  }
  return pushed;
}

/**
 * Line of sight between two points, stepped through the grid. Used by enemy
 * senses and by the sanity system to decide whether a horror is visible.
 */
export function lineOfSight(grid, ax, ay, az, bx, by, bz, maxDist = 60) {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const dist = Math.hypot(dx, dy, dz);
  if (dist > maxDist) return false;
  const steps = Math.max(2, Math.ceil(dist / (CELL * 0.4)));
  for (let s = 1; s < steps; s += 1) {
    const t = s / steps;
    const px = ax + dx * t;
    const py = ay + dy * t;
    const pz = az + dz * t;
    const cell = grid.atWorld(px, pz);
    if (!cell || cell.info.name === 'void' || cell.solid) return false;
    if (cell.door && !cell.doorOpen) return false;
    if (py < cell.floorY - 0.1 || py > cell.ceilY + 0.1) return false;
  }
  return true;
}

/**
 * Hitscan against the world only. Returns the impact point and normal, or null
 * when the ray leaves the level.
 */
export function raycastWorld(grid, ox, oy, oz, dx, dy, dz, maxDist) {
  const step = CELL * 0.22;
  const steps = Math.ceil(maxDist / step);
  let px = ox; let py = oy; let pz = oz;
  for (let s = 1; s <= steps; s += 1) {
    const nx = ox + dx * step * s;
    const ny = oy + dy * step * s;
    const nz = oz + dz * step * s;
    const cell = grid.atWorld(nx, nz);
    const blocked = !cell || cell.info.name === 'void' || cell.solid
      || (cell.door && !cell.doorOpen)
      || ny < cell.floorY || ny > cell.ceilY;
    if (blocked) {
      // Normal from whichever component crossed a boundary.
      let n = [0, 1, 0];
      if (cell && ny < cell.floorY) n = [0, 1, 0];
      else if (cell && ny > cell.ceilY) n = [0, -1, 0];
      else {
        const prevCell = grid.atWorld(px, pz);
        if (prevCell && cell) {
          if (cell.col !== prevCell.col) n = [cell.col > prevCell.col ? -1 : 1, 0, 0];
          else if (cell.row !== prevCell.row) n = [0, 0, cell.row > prevCell.row ? -1 : 1];
        } else {
          n = [-dx, -dy, -dz];
        }
      }
      return { x: px, y: py, z: pz, nx: n[0], ny: n[1], nz: n[2], dist: step * (s - 1) };
    }
    px = nx; py = ny; pz = nz;
  }
  return null;
}
