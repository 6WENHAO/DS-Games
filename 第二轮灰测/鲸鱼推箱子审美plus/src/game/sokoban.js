/**
 * Sokoban rules. Pure data, no rendering: the 3D layer reads this state and
 * animates towards it.
 */
import { LEVEL_CHARS } from './levels.js';

export const DIRS = {
  up: { dx: 0, dy: -1, key: 'up' },
  down: { dx: 0, dy: 1, key: 'down' },
  left: { dx: -1, dy: 0, key: 'left' },
  right: { dx: 1, dy: 0, key: 'right' },
};

/**
 * @typedef {object} SokobanState
 * @property {number} width
 * @property {number} height
 * @property {Uint8Array} walls  1 = wall
 * @property {Uint8Array} goals  1 = goal
 * @property {Uint8Array} floor  1 = reachable floor
 * @property {{x:number,y:number}} player
 * @property {{x:number,y:number}[]} boxes
 */

export function parseLevel(level) {
  const rows = level.grid;
  const width = Math.max(...rows.map((r) => r.length));
  const height = rows.length;
  const walls = new Uint8Array(width * height);
  const goals = new Uint8Array(width * height);
  const floor = new Uint8Array(width * height);
  let player = null;
  const boxes = [];

  for (let y = 0; y < height; y += 1) {
    const row = rows[y].padEnd(width, ' ');
    for (let x = 0; x < width; x += 1) {
      const c = row[x];
      const i = y * width + x;
      if (c === LEVEL_CHARS.WALL) { walls[i] = 1; continue; }
      if (c === ' ') continue;
      floor[i] = 1;
      if (c === LEVEL_CHARS.GOAL || c === LEVEL_CHARS.BOX_ON_GOAL || c === LEVEL_CHARS.PLAYER_ON_GOAL) goals[i] = 1;
      if (c === LEVEL_CHARS.BOX || c === LEVEL_CHARS.BOX_ON_GOAL) boxes.push({ x, y });
      if (c === LEVEL_CHARS.PLAYER || c === LEVEL_CHARS.PLAYER_ON_GOAL) player = { x, y };
    }
  }

  // Flood fill from the player so we know the true interior of the plot: those
  // are the tiles that get mown grass, everything else stays as hedge.
  const inside = new Uint8Array(width * height);
  if (player) {
    const stack = [player.y * width + player.x];
    inside[stack[0]] = 1;
    while (stack.length) {
      const i = stack.pop();
      const x = i % width;
      const y = (i - x) / width;
      const step = (nx, ny) => {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
        const j = ny * width + nx;
        if (inside[j] || walls[j]) return;
        inside[j] = 1;
        stack.push(j);
      };
      step(x + 1, y); step(x - 1, y); step(x, y + 1); step(x, y - 1);
    }
  }
  for (let i = 0; i < inside.length; i += 1) if (inside[i]) floor[i] = 1;

  return {
    id: level.id,
    name: level.name,
    hint: level.hint,
    concept: level.concept,
    width,
    height,
    walls,
    goals,
    floor,
    player,
    boxes,
  };
}

export class Sokoban {
  constructor(level) {
    this.level = parseLevel(level);
    this.reset();
  }

  reset() {
    const l = this.level;
    this.player = { x: l.player.x, y: l.player.y };
    this.boxes = l.boxes.map((b) => ({ x: b.x, y: b.y }));
    this.history = [];
    this.moves = 0;
    this.pushes = 0;
  }

  index(x, y) {
    return y * this.level.width + x;
  }

  isWall(x, y) {
    const l = this.level;
    if (x < 0 || y < 0 || x >= l.width || y >= l.height) return true;
    return l.walls[this.index(x, y)] === 1 || l.floor[this.index(x, y)] === 0;
  }

  isGoal(x, y) {
    if (x < 0 || y < 0 || x >= this.level.width || y >= this.level.height) return false;
    return this.level.goals[this.index(x, y)] === 1;
  }

  boxAt(x, y) {
    return this.boxes.findIndex((b) => b.x === x && b.y === y);
  }

  /**
   * Attempts a move.
   * @returns {null|{dir:object, pushed:number, from:{x,y}, to:{x,y}, boxFrom:{x,y}|null, boxTo:{x,y}|null}}
   */
  move(dirKey) {
    const dir = DIRS[dirKey];
    if (!dir) return null;
    const nx = this.player.x + dir.dx;
    const ny = this.player.y + dir.dy;
    if (this.isWall(nx, ny)) return null;

    const bi = this.boxAt(nx, ny);
    let boxFrom = null;
    let boxTo = null;
    if (bi >= 0) {
      const bx = nx + dir.dx;
      const by = ny + dir.dy;
      if (this.isWall(bx, by)) return null;
      if (this.boxAt(bx, by) >= 0) return null;
      boxFrom = { x: nx, y: ny };
      boxTo = { x: bx, y: by };
      this.boxes[bi] = { x: bx, y: by };
      this.pushes += 1;
    }

    const from = { x: this.player.x, y: this.player.y };
    this.player = { x: nx, y: ny };
    this.moves += 1;
    const record = { dirKey, boxIndex: bi, from, to: { x: nx, y: ny }, boxFrom, boxTo };
    this.history.push(record);
    return { dir, pushed: bi, ...record };
  }

  undo() {
    const last = this.history.pop();
    if (!last) return null;
    this.player = { x: last.from.x, y: last.from.y };
    if (last.boxIndex >= 0) {
      this.boxes[last.boxIndex] = { x: last.boxFrom.x, y: last.boxFrom.y };
      this.pushes -= 1;
    }
    this.moves -= 1;
    return last;
  }

  get solved() {
    return this.boxes.every((b) => this.isGoal(b.x, b.y));
  }

  get goalCount() {
    let n = 0;
    for (let i = 0; i < this.level.goals.length; i += 1) if (this.level.goals[i]) n += 1;
    return n;
  }

  get seatedCount() {
    return this.boxes.reduce((n, b) => n + (this.isGoal(b.x, b.y) ? 1 : 0), 0);
  }

  /**
   * True when the crate at (x,y) can no longer be moved to any goal because it
   * is wedged in a corner off-mark. Used only to offer a hint, never to block
   * input.
   */
  isCornerLocked(x, y) {
    if (this.isGoal(x, y)) return false;
    const up = this.isWall(x, y - 1);
    const down = this.isWall(x, y + 1);
    const left = this.isWall(x - 1, y);
    const right = this.isWall(x + 1, y);
    return (up && left) || (up && right) || (down && left) || (down && right);
  }

  get anyLocked() {
    return this.boxes.some((b) => this.isCornerLocked(b.x, b.y));
  }
}
