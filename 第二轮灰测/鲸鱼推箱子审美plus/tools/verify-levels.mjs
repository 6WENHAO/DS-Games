#!/usr/bin/env node
/**
 * tools/verify-levels.mjs
 *
 * Structural and solvability verifier for the level set in src/game/levels.js.
 * Self-contained ES module, zero dependencies.
 *
 *   node tools/verify-levels.mjs
 *
 * Per level it:
 *   1. parses the XSB grid (ragged rows are right-padded with spaces),
 *   2. checks structure: exactly one player, box count === goal count, and a
 *      playfield sealed by walls (a flood fill from the player must never be
 *      able to step outside the grid bounds — any such step is a leak),
 *   3. checks the footprint/box-count budget the level set is designed against,
 *   4. solves push-optimally with a breadth-first search over normalised states
 *      `(playerZoneRepresentative, sortedBoxPositions)`, where the player tile is
 *      normalised to the top-left-most tile of its reachable zone and only legal
 *      pushes are expanded,
 *   5. re-solves with a lexicographic Dijkstra (pushes first, then moves) over
 *      exact `(playerTile, sortedBoxPositions)` states to obtain the move-optimal
 *      walk for that push count, printed as a `uUdDlLrR` string (capital = push),
 *   6. replays that printed string on a fresh board as an independent audit.
 *
 * Deadlock filter (safe pruning only — it never removes a solvable branch):
 *   - static: a non-goal cell wedged in a 2x2 wall corner,
 *   - static: a non-goal cell no box can ever be pulled back to from a goal,
 *   - dynamic: a 2x2 square filled entirely by walls/boxes that holds at least one
 *     box off a goal (every box in such a square is immobile).
 *
 * Exit code 1 if any level fails structure/budget validation, is unsolvable, or
 * exceeds the search node cap. Exit code 0 when every level passes.
 */

import { pathToFileURL } from 'node:url';
import { LEVELS, LEVEL_CHARS } from '../src/game/levels.js';

const NODE_CAP = 3_000_000;
const PUSH_WEIGHT = 1_000_000; // lexicographic key: cost = pushes * W + moves

const DIRS = [
  { key: 'u', dr: -1, dc: 0 },
  { key: 'd', dr: 1, dc: 0 },
  { key: 'l', dr: 0, dc: -1 },
  { key: 'r', dr: 0, dc: 1 },
];

/** Footprint budget this level set is authored against. */
const BUDGET = {
  maxWidth: 9,
  maxHeight: 8,
  earlyLevels: 3, // levels 1..3
  earlyMaxWidth: 7,
  earlyMaxHeight: 6,
  maxBoxes: 4,
  firstLevelBoxes: 1,
};

// ---------------------------------------------------------------------------
// parsing
// ---------------------------------------------------------------------------

export function parseLevel(level) {
  const errors = [];
  const grid = Array.isArray(level?.grid) ? level.grid : [];
  if (!grid.length) errors.push('grid is empty or missing');
  for (const field of ['id', 'name', 'hint', 'concept']) {
    if (typeof level?.[field] !== 'string' || level[field].length === 0) {
      errors.push(`field "${field}" must be a non-empty string`);
    }
  }
  if (!grid.every((row) => typeof row === 'string')) errors.push('every grid row must be a string');

  const rawRows = grid.filter((row) => typeof row === 'string');
  const height = rawRows.length;
  const width = rawRows.reduce((m, row) => Math.max(m, row.length), 0);
  const rows = rawRows.map((row) => row.padEnd(width, LEVEL_CHARS.FLOOR));

  const size = width * height;
  const wall = new Uint8Array(size);
  const goal = new Uint8Array(size);
  const boxes = [];
  const players = [];

  for (let r = 0; r < height; r += 1) {
    for (let c = 0; c < width; c += 1) {
      const idx = r * width + c;
      const ch = rows[r][c];
      switch (ch) {
        case LEVEL_CHARS.WALL:
          wall[idx] = 1;
          break;
        case LEVEL_CHARS.FLOOR:
          break;
        case LEVEL_CHARS.GOAL:
          goal[idx] = 1;
          break;
        case LEVEL_CHARS.BOX:
          boxes.push(idx);
          break;
        case LEVEL_CHARS.BOX_ON_GOAL:
          boxes.push(idx);
          goal[idx] = 1;
          break;
        case LEVEL_CHARS.PLAYER:
          players.push(idx);
          break;
        case LEVEL_CHARS.PLAYER_ON_GOAL:
          players.push(idx);
          goal[idx] = 1;
          break;
        default:
          errors.push(`unknown character ${JSON.stringify(ch)} at row ${r + 1}, column ${c + 1}`);
      }
    }
  }

  boxes.sort((a, b) => a - b);
  const goalCount = goal.reduce((sum, v) => sum + v, 0);

  return {
    width,
    height,
    rows,
    wall,
    goal,
    boxes,
    goalCount,
    player: players.length === 1 ? players[0] : -1,
    playerCount: players.length,
    parseErrors: errors,
  };
}

const rc = (idx, width) => [Math.floor(idx / width), idx % width];
const inBounds = (r, c, width, height) => r >= 0 && c >= 0 && r < height && c < width;

// ---------------------------------------------------------------------------
// structure validation
// ---------------------------------------------------------------------------

/**
 * Flood fill from the player across every non-wall cell (boxes do not block the
 * enclosure test). Reports any cell from which a step leaves the grid.
 */
export function floodFromPlayer(p) {
  const { width, height, wall, player } = p;
  const seen = new Uint8Array(width * height);
  const leaks = [];
  if (player < 0) return { seen, leaks, count: 0 };

  const stack = [player];
  seen[player] = 1;
  let count = 1;
  while (stack.length) {
    const cur = stack.pop();
    const [r, c] = rc(cur, width);
    for (const d of DIRS) {
      const nr = r + d.dr;
      const nc = c + d.dc;
      if (!inBounds(nr, nc, width, height)) {
        leaks.push(`row ${r + 1}, column ${c + 1} (open ${d.key} through the grid edge)`);
        continue;
      }
      const n = nr * width + nc;
      if (seen[n] || wall[n]) continue;
      seen[n] = 1;
      count += 1;
      stack.push(n);
    }
  }
  return { seen, leaks, count };
}

export function validateStructure(p, levelNumber) {
  const errors = [...p.parseErrors];

  if (p.playerCount !== 1) {
    errors.push(`expected exactly 1 player, found ${p.playerCount}`);
  }
  if (p.boxes.length !== p.goalCount) {
    errors.push(`box count ${p.boxes.length} !== goal count ${p.goalCount}`);
  }
  if (p.boxes.length === 0) {
    errors.push('level has no boxes');
  }

  let reachableFloor = 0;
  if (p.playerCount === 1) {
    const { seen, leaks, count } = floodFromPlayer(p);
    reachableFloor = count;
    for (const leak of new Set(leaks)) {
      errors.push(`wall leak: flood fill escapes the grid at ${leak}`);
    }
    for (const b of p.boxes) {
      const [r, c] = rc(b, p.width);
      if (!seen[b]) errors.push(`box at row ${r + 1}, column ${c + 1} is not reachable from the player`);
    }
    for (let idx = 0; idx < p.goal.length; idx += 1) {
      if (!p.goal[idx] || seen[idx]) continue;
      const [r, c] = rc(idx, p.width);
      errors.push(`goal at row ${r + 1}, column ${c + 1} is not reachable from the player`);
    }
    // Open cells outside the player's region are padding around the plot (ragged
    // rows are padded with spaces), so only the player's own region is sealed.
  }

  const budget = [];
  const early = levelNumber <= BUDGET.earlyLevels;
  const maxW = early ? BUDGET.earlyMaxWidth : BUDGET.maxWidth;
  const maxH = early ? BUDGET.earlyMaxHeight : BUDGET.maxHeight;
  if (p.width > maxW || p.height > maxH) {
    budget.push(`footprint ${p.width}x${p.height} exceeds ${maxW}x${maxH}`);
  }
  if (p.boxes.length > BUDGET.maxBoxes) {
    budget.push(`box count ${p.boxes.length} exceeds ${BUDGET.maxBoxes}`);
  }
  if (levelNumber === 1 && p.boxes.length !== BUDGET.firstLevelBoxes) {
    budget.push(`level 1 must hold exactly ${BUDGET.firstLevelBoxes} box, found ${p.boxes.length}`);
  }

  return { errors, budget, reachableFloor };
}

// ---------------------------------------------------------------------------
// static deadlock analysis
// ---------------------------------------------------------------------------

/**
 * Cells a box can never be moved out of again (or never move to a goal from).
 * Both tests are one-sided: they only ever mark cells from which no solution
 * exists, so pruning them keeps the search optimal.
 */
export function deadSquares(p) {
  const { width, height, wall, goal } = p;
  const size = width * height;
  const corner = new Uint8Array(size);
  for (let r = 0; r < height; r += 1) {
    for (let c = 0; c < width; c += 1) {
      const idx = r * width + c;
      if (wall[idx] || goal[idx]) continue;
      const up = !inBounds(r - 1, c, width, height) || wall[(r - 1) * width + c];
      const down = !inBounds(r + 1, c, width, height) || wall[(r + 1) * width + c];
      const left = !inBounds(r, c - 1, width, height) || wall[r * width + c - 1];
      const right = !inBounds(r, c + 1, width, height) || wall[r * width + c + 1];
      if ((up || down) && (left || right)) corner[idx] = 1;
    }
  }

  // Reverse (pull) reachability from the goals, boxes ignored: a box at cell `b`
  // can be pulled to `b + d` when `b + d` and `b + 2d` are both open.
  const pullable = new Uint8Array(size);
  const queue = [];
  for (let idx = 0; idx < size; idx += 1) {
    if (goal[idx] && !wall[idx]) {
      pullable[idx] = 1;
      queue.push(idx);
    }
  }
  for (let head = 0; head < queue.length; head += 1) {
    const cur = queue[head];
    const [r, c] = rc(cur, width);
    for (const d of DIRS) {
      const nr = r + d.dr;
      const nc = c + d.dc;
      const fr = r + 2 * d.dr;
      const fc = c + 2 * d.dc;
      if (!inBounds(nr, nc, width, height) || !inBounds(fr, fc, width, height)) continue;
      const n = nr * width + nc;
      const f = fr * width + fc;
      if (wall[n] || wall[f] || pullable[n]) continue;
      pullable[n] = 1;
      queue.push(n);
    }
  }

  const dead = new Uint8Array(size);
  for (let idx = 0; idx < size; idx += 1) {
    if (wall[idx] || goal[idx]) continue;
    if (corner[idx] || !pullable[idx]) dead[idx] = 1;
  }
  return { dead, corner, pullable };
}

/** True when `idx` sits in a 2x2 square of walls/boxes holding a box off a goal. */
function frozenBlock(occ, wall, goal, width, height, idx) {
  const [r, c] = rc(idx, width);
  for (const [r0, c0] of [
    [r - 1, c - 1],
    [r - 1, c],
    [r, c - 1],
    [r, c],
  ]) {
    if (r0 < 0 || c0 < 0 || r0 + 1 >= height || c0 + 1 >= width) continue;
    let filled = true;
    let boxOffGoal = false;
    for (const [rr, cc] of [
      [r0, c0],
      [r0, c0 + 1],
      [r0 + 1, c0],
      [r0 + 1, c0 + 1],
    ]) {
      const i = rr * width + cc;
      const isBox = occ[i] === 1;
      if (!isBox && !wall[i]) {
        filled = false;
        break;
      }
      if (isBox && !goal[i]) boxOffGoal = true;
    }
    if (filled && boxOffGoal) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// search helpers
// ---------------------------------------------------------------------------

/** Flood the player's zone; fills `zone` and returns its top-left-most cell. */
function playerZone(start, wall, occ, width, height, zone) {
  zone.fill(0);
  zone[start] = 1;
  let min = start;
  const stack = [start];
  while (stack.length) {
    const cur = stack.pop();
    if (cur < min) min = cur;
    const [r, c] = rc(cur, width);
    for (const d of DIRS) {
      const nr = r + d.dr;
      const nc = c + d.dc;
      if (!inBounds(nr, nc, width, height)) continue;
      const n = nr * width + nc;
      if (zone[n] || wall[n] || occ[n]) continue;
      zone[n] = 1;
      stack.push(n);
    }
  }
  return min;
}

const solved = (boxes, goal) => boxes.every((b) => goal[b] === 1);

class MinHeap {
  constructor() {
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  push(item) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (a[parent].cost <= a[i].cost) break;
      const tmp = a[parent];
      a[parent] = a[i];
      a[i] = tmp;
      i = parent;
    }
  }

  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].cost < a[m].cost) m = l;
        if (r < a.length && a[r].cost < a[m].cost) m = r;
        if (m === i) break;
        const tmp = a[m];
        a[m] = a[i];
        a[i] = tmp;
        i = m;
      }
    }
    return top;
  }
}

// ---------------------------------------------------------------------------
// search 1: push-optimal BFS over normalised states
// ---------------------------------------------------------------------------

/**
 * Breadth-first search over `(normalisedPlayerTile, sortedBoxPositions)`.
 * Every edge is one legal push, so the first layer that reaches a solved board
 * is the minimum push count.
 */
export function solveMinPushes(p, dead, nodeCap = NODE_CAP) {
  const { width, height, wall, goal, boxes, player } = p;
  const size = width * height;
  const occ = new Uint8Array(size);
  const childOcc = new Uint8Array(size);
  const zone = new Uint8Array(size);
  const childZone = new Uint8Array(size);

  const loadOcc = (target, list) => {
    target.fill(0);
    for (const b of list) target[b] = 1;
  };

  if (solved(boxes, goal)) return { status: 'solved', pushes: 0, states: 1 };

  loadOcc(occ, boxes);
  const startNorm = playerZone(player, wall, occ, width, height, zone);
  const seen = new Set([`${startNorm}|${boxes.join(',')}`]);
  let frontier = [{ norm: startNorm, boxes }];
  let states = 1;
  let pushes = 0;

  while (frontier.length) {
    pushes += 1;
    const next = [];
    for (const state of frontier) {
      loadOcc(occ, state.boxes);
      playerZone(state.norm, wall, occ, width, height, zone);
      for (let bi = 0; bi < state.boxes.length; bi += 1) {
        const b = state.boxes[bi];
        const [br, bc] = rc(b, width);
        for (const d of DIRS) {
          const sr = br - d.dr;
          const sc = bc - d.dc;
          const tr = br + d.dr;
          const tc = bc + d.dc;
          if (!inBounds(sr, sc, width, height) || !inBounds(tr, tc, width, height)) continue;
          const stand = sr * width + sc;
          const target = tr * width + tc;
          if (!zone[stand]) continue; // player cannot get behind the box
          if (wall[target] || occ[target]) continue;
          if (dead[target]) continue;

          const nextBoxes = state.boxes.slice();
          nextBoxes[bi] = target;
          nextBoxes.sort((x, y) => x - y);
          loadOcc(childOcc, nextBoxes);
          if (frozenBlock(childOcc, wall, goal, width, height, target)) continue;

          if (solved(nextBoxes, goal)) {
            return { status: 'solved', pushes, states: states + 1 };
          }
          const norm = playerZone(b, wall, childOcc, width, height, childZone);
          const key = `${norm}|${nextBoxes.join(',')}`;
          if (seen.has(key)) continue;
          seen.add(key);
          states += 1;
          if (states > nodeCap) return { status: 'cap', states, cap: nodeCap };
          next.push({ norm, boxes: nextBoxes });
        }
      }
    }
    frontier = next;
  }
  return { status: 'unsolvable', states };
}

// ---------------------------------------------------------------------------
// search 2: move-optimal walk among push-optimal solutions
// ---------------------------------------------------------------------------

/**
 * Dijkstra over exact `(playerTile, sortedBoxPositions)` states with
 * cost = pushes * PUSH_WEIGHT + moves, i.e. lexicographic (pushes, moves).
 * Returns the fewest-moves walk among all push-optimal solutions, as uUdDlLrR.
 */
export function solveMinPushesThenMoves(p, dead, nodeCap = NODE_CAP) {
  const { width, height, wall, goal, boxes, player } = p;
  const size = width * height;
  const occ = new Uint8Array(size);

  const startKey = `${player}|${boxes.join(',')}`;
  const dist = new Map([[startKey, 0]]);
  const parent = new Map();
  const heap = new MinHeap();
  heap.push({ cost: 0, player, boxes });
  let states = 1;

  const rebuild = (key) => {
    const out = [];
    let cur = key;
    while (parent.has(cur)) {
      const [prev, move] = parent.get(cur);
      out.push(move);
      cur = prev;
    }
    return out.reverse().join('');
  };

  if (solved(boxes, goal)) return { status: 'solved', pushes: 0, moves: 0, solution: '', states };

  while (heap.size) {
    const node = heap.pop();
    const key = `${node.player}|${node.boxes.join(',')}`;
    if (dist.get(key) !== node.cost) continue; // stale heap entry
    if (solved(node.boxes, goal)) {
      return {
        status: 'solved',
        pushes: Math.floor(node.cost / PUSH_WEIGHT),
        moves: node.cost % PUSH_WEIGHT,
        solution: rebuild(key),
        states,
      };
    }

    occ.fill(0);
    for (const b of node.boxes) occ[b] = 1;
    const [pr, pc] = rc(node.player, width);

    for (const d of DIRS) {
      const nr = pr + d.dr;
      const nc = pc + d.dc;
      if (!inBounds(nr, nc, width, height)) continue;
      const step = nr * width + nc;
      if (wall[step]) continue;

      let nextBoxes = node.boxes;
      let cost = node.cost + 1;
      let move = d.key;

      if (occ[step]) {
        const br = nr + d.dr;
        const bc = nc + d.dc;
        if (!inBounds(br, bc, width, height)) continue;
        const target = br * width + bc;
        if (wall[target] || occ[target]) continue;
        if (dead[target]) continue;
        nextBoxes = node.boxes.filter((b) => b !== step).concat(target).sort((x, y) => x - y);
        const childOcc = new Uint8Array(size);
        for (const b of nextBoxes) childOcc[b] = 1;
        if (frozenBlock(childOcc, wall, goal, width, height, target)) continue;
        cost = node.cost + PUSH_WEIGHT + 1;
        move = d.key.toUpperCase();
      }

      const nextKey = `${step}|${nextBoxes.join(',')}`;
      const known = dist.get(nextKey);
      if (known !== undefined && known <= cost) continue;
      if (known === undefined) {
        states += 1;
        if (states > nodeCap) return { status: 'cap', states, cap: nodeCap };
      }
      dist.set(nextKey, cost);
      parent.set(nextKey, [key, move]);
      heap.push({ cost, player: step, boxes: nextBoxes });
    }
  }
  return { status: 'unsolvable', states };
}

// ---------------------------------------------------------------------------
// independent replay audit
// ---------------------------------------------------------------------------

export function replay(p, solution) {
  const { width, height, wall, goal } = p;
  const occ = new Uint8Array(width * height);
  for (const b of p.boxes) occ[b] = 1;
  let player = p.player;
  let pushes = 0;
  let moves = 0;

  for (const ch of solution) {
    const lower = ch.toLowerCase();
    const d = DIRS.find((entry) => entry.key === lower);
    if (!d) return { ok: false, reason: `unknown move character ${JSON.stringify(ch)}` };
    const [r, c] = rc(player, width);
    const nr = r + d.dr;
    const nc = c + d.dc;
    if (!inBounds(nr, nc, width, height)) return { ok: false, reason: `move ${ch} leaves the grid` };
    const step = nr * width + nc;
    if (wall[step]) return { ok: false, reason: `move ${ch} walks into a wall` };
    const isPush = ch === ch.toUpperCase();
    if (isPush !== (occ[step] === 1)) {
      return { ok: false, reason: `move ${ch} disagrees with the board about a box` };
    }
    if (isPush) {
      const br = nr + d.dr;
      const bc = nc + d.dc;
      if (!inBounds(br, bc, width, height)) return { ok: false, reason: `push ${ch} leaves the grid` };
      const target = br * width + bc;
      if (wall[target] || occ[target]) return { ok: false, reason: `push ${ch} is blocked` };
      occ[step] = 0;
      occ[target] = 1;
      pushes += 1;
    }
    player = step;
    moves += 1;
  }

  let placed = 0;
  let boxCount = 0;
  for (let idx = 0; idx < occ.length; idx += 1) {
    if (!occ[idx]) continue;
    boxCount += 1;
    if (goal[idx]) placed += 1;
  }
  return { ok: placed === boxCount, reason: placed === boxCount ? '' : `${boxCount - placed} box(es) off goal`, pushes, moves };
}

// ---------------------------------------------------------------------------
// per-level driver
// ---------------------------------------------------------------------------

export function verifyLevel(level, levelNumber) {
  const parsed = parseLevel(level);
  const structure = validateStructure(parsed, levelNumber);
  const result = {
    number: levelNumber,
    id: level?.id ?? '(missing id)',
    name: level?.name ?? '(missing name)',
    concept: level?.concept ?? '(missing concept)',
    hint: level?.hint ?? '',
    width: parsed.width,
    height: parsed.height,
    boxes: parsed.boxes.length,
    goals: parsed.goalCount,
    floor: structure.reachableFloor,
    errors: structure.errors,
    budget: structure.budget,
    pushes: null,
    moves: null,
    solution: '',
    pushStates: 0,
    moveStates: 0,
    pass: false,
  };

  if (structure.errors.length) return result;

  const { dead } = deadSquares(parsed);
  const pushSearch = solveMinPushes(parsed, dead);
  result.pushStates = pushSearch.states;
  if (pushSearch.status === 'cap') {
    result.errors.push(`push search exceeded the node cap of ${pushSearch.cap} states`);
    return result;
  }
  if (pushSearch.status !== 'solved') {
    result.errors.push('unsolvable: no push sequence places every box on a goal');
    return result;
  }

  const walkSearch = solveMinPushesThenMoves(parsed, dead);
  result.moveStates = walkSearch.states;
  if (walkSearch.status === 'cap') {
    result.errors.push(`move search exceeded the node cap of ${walkSearch.cap} states`);
    return result;
  }
  if (walkSearch.status !== 'solved') {
    result.errors.push('unsolvable: move-level search found no solution');
    return result;
  }
  if (walkSearch.pushes !== pushSearch.pushes) {
    result.errors.push(
      `search disagreement: normalised BFS says ${pushSearch.pushes} pushes, Dijkstra says ${walkSearch.pushes}`,
    );
    return result;
  }

  const audit = replay(parsed, walkSearch.solution);
  if (!audit.ok) {
    result.errors.push(`replay of the printed solution failed: ${audit.reason}`);
    return result;
  }
  if (audit.pushes !== walkSearch.pushes || audit.moves !== walkSearch.moves) {
    result.errors.push(
      `replay counted ${audit.pushes} pushes / ${audit.moves} moves, search reported ${walkSearch.pushes} / ${walkSearch.moves}`,
    );
    return result;
  }

  result.pushes = walkSearch.pushes;
  result.moves = walkSearch.moves;
  result.solution = walkSearch.solution;
  result.pass = result.budget.length === 0;
  return result;
}

// ---------------------------------------------------------------------------
// report
// ---------------------------------------------------------------------------

function pad(value, len) {
  return String(value).padEnd(len, ' ');
}

function padStart(value, len) {
  return String(value).padStart(len, ' ');
}

export function main() {
  const lines = [];
  const say = (line = '') => {
    lines.push(line);
    console.log(line);
  };

  say(`Sokoban level verification  —  ${LEVELS.length} level(s)`);
  say(`node ${process.version}   node cap ${NODE_CAP.toLocaleString('en-US')} states per search`);
  say();

  const results = LEVELS.map((level, i) => verifyLevel(level, i + 1));

  for (const r of results) {
    const verdict = r.errors.length ? 'FAIL' : r.budget.length ? 'FAIL (budget)' : 'PASS';
    say(`[${padStart(r.number, 2)}] ${pad(r.id, 10)} ${pad(r.name, 22)} ${verdict}`);
    say(`     concept    ${r.concept}`);
    say(`     size       ${r.width}x${r.height} (w x h), ${r.floor} floor cells reachable`);
    say(`     contents   ${r.boxes} box(es), ${r.goals} goal(s), 1 player`);
    say(`     structure  ${r.errors.length ? 'FAIL' : 'PASS'} — one player, boxes == goals, sealed by walls`);
    for (const e of r.errors) say(`                - ${e}`);
    say(`     budget     ${r.budget.length ? 'FAIL' : 'PASS'} — footprint and box-count limits`);
    for (const e of r.budget) say(`                - ${e}`);
    if (r.pushes !== null) {
      say(`     optimum    ${r.pushes} pushes, ${r.moves} moves (push-optimal, then move-optimal)`);
      say(`     searched   ${r.pushStates.toLocaleString('en-US')} normalised states, ${r.moveStates.toLocaleString('en-US')} move states`);
      say(`     solution   ${r.solution}`);
    }
    say();
  }

  say('summary');
  say(`  ${pad('#', 3)} ${pad('id', 10)} ${pad('name', 22)} ${pad('size', 6)} ${pad('boxes', 5)} ${padStart('pushes', 6)} ${padStart('moves', 6)}  result`);
  for (const r of results) {
    say(
      `  ${pad(r.number, 3)} ${pad(r.id, 10)} ${pad(r.name, 22)} ${pad(`${r.width}x${r.height}`, 6)} ${pad(r.boxes, 5)} ${padStart(r.pushes ?? '-', 6)} ${padStart(r.moves ?? '-', 6)}  ${r.errors.length || r.budget.length ? 'FAIL' : 'PASS'}`,
    );
  }
  say();

  const pushSeries = results.map((r) => r.pushes);
  if (pushSeries.every((v) => typeof v === 'number')) {
    const drops = [];
    for (let i = 1; i < pushSeries.length; i += 1) {
      if (pushSeries[i] < pushSeries[i - 1]) drops.push(`${i} -> ${i + 1} (${pushSeries[i - 1]} -> ${pushSeries[i]})`);
    }
    say(`push curve   ${pushSeries.join(' -> ')}`);
    say(drops.length ? `             note: push count drops at ${drops.join(', ')}` : '             push count rises monotonically across the set');
    say();
  }

  const failed = results.filter((r) => r.errors.length || r.budget.length);
  if (failed.length) {
    say(`RESULT: FAIL — ${failed.length} of ${results.length} level(s) failed: ${failed.map((r) => r.id).join(', ')}`);
    return 1;
  }
  say(`RESULT: PASS — all ${results.length} levels are enclosed, well formed and solvable.`);
  return 0;
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (entry === import.meta.url) {
  process.exit(main());
}
