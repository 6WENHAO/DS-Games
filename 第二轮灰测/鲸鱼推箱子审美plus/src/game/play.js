/**
 * Puzzle staging.
 *
 * A level is laid out on the garden plot in the plot's own rotated frame, so grid
 * x runs screen-right and grid y runs screen-down. Wall tiles become hedge blocks
 * built from the grass shader — the level boundary and its silhouette are the
 * same object — while floor tiles keep the mown turf the ground shader already
 * paints there.
 *
 * Movement is animated: the whale hops between tiles and crates slide with a
 * rocking tilt. Input is queued so held keys chain smoothly, and every hop is
 * committed to the rules layer before the animation starts.
 */
import * as THREE from 'three';
import { LEVELS } from './levels.js';
import { Sokoban, DIRS } from './sokoban.js';
import { Whale } from './whale.js';
import { Crate, GoalMark } from './crate.js';
import { PLOT, gridToBoard } from '../world/plot.js';
import { createHedgeField } from '../world/grass.js';
import { clamp } from '../world/noise.js';
import { CAMERAS } from '../core/config.js';

const HOP_TIME = 0.22;
const PUSH_TIME = 0.28;

export class PuzzleStage {
  /**
   * @param {THREE.Scene} scene
   * @param {object} terrain
   * @param {object} hooks { onState(info), onSolved(info) }
   */
  constructor(scene, terrain, hooks = {}) {
    this.scene = scene;
    this.terrain = terrain;
    this.hooks = hooks;
    this.group = new THREE.Group();
    this.group.name = 'puzzle';
    this.group.visible = false;
    this.scene.add(this.group);

    this.levelIndex = 0;
    this.rules = null;
    this.crates = [];
    this.marks = [];
    this.hedge = null;
    this.whale = new Whale({ tileSize: PLOT.tile });
    this.group.add(this.whale.root);

    this.anim = null;
    this.queue = [];
    this.solved = false;
    this.solveTimer = 0;
    this.active = false;
    this._v = new THREE.Vector3();
    this._dir = new THREE.Vector3();
  }

  get level() {
    return LEVELS[this.levelIndex];
  }

  get levelCount() {
    return LEVELS.length;
  }

  /** World position of a grid cell's ground surface. */
  cellToWorld(gx, gy, out = new THREE.Vector3()) {
    const { width, height } = this.rules.level;
    const { u, v } = gridToBoard(gx, gy, width, height);
    PLOT.toWorld(u, v, out);
    out.y = this.terrain.sampleHeight(out.x, out.z);
    return out;
  }

  load(index) {
    this.levelIndex = ((index % LEVELS.length) + LEVELS.length) % LEVELS.length;
    this.clear();
    this.rules = new Sokoban(this.level);
    this.solved = false;
    this.solveTimer = 0;
    this.queue.length = 0;
    this.anim = null;

    const { width, height, walls, goals, floor } = this.rules.level;

    /* --- hedge walls, one blade cluster per wall tile that touches floor --- */
    const cells = [];
    for (let gy = 0; gy < height; gy += 1) {
      for (let gx = 0; gx < width; gx += 1) {
        const i = gy * width + gx;
        if (!walls[i] && floor[i]) continue;
        // Only build the hedge where it is visible: a wall tile adjacent to
        // reachable floor. Deep exterior tiles are left to the meadow.
        let touchesFloor = false;
        for (let dy = -1; dy <= 1 && !touchesFloor; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const nx = gx + dx;
            const ny = gy + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const j = ny * width + nx;
            if (floor[j] && !walls[j]) { touchesFloor = true; break; }
          }
        }
        if (!touchesFloor) continue;
        const p = this.cellToWorld(gx, gy, new THREE.Vector3());
        cells.push({ x: p.x, z: p.z, size: PLOT.tile });
      }
    }
    this.hedge = createHedgeField(cells, this.terrain, {
      seed: 9001 + this.levelIndex * 37,
      heightRange: [1.12, 1.72],
      density: 24,
    });
    if (this.hedge) this.group.add(this.hedge);

    /* --- goal marks --- */
    for (let gy = 0; gy < height; gy += 1) {
      for (let gx = 0; gx < width; gx += 1) {
        if (!goals[gy * width + gx]) continue;
        const mark = new GoalMark({ tileSize: PLOT.tile });
        mark.place(this.cellToWorld(gx, gy, this._v));
        this.marks.push(mark);
        this.group.add(mark.mesh);
      }
    }

    /* --- crates --- */
    for (const box of this.rules.boxes) {
      const crate = new Crate({ tileSize: PLOT.tile });
      crate.place(this.cellToWorld(box.x, box.y, this._v));
      this.crates.push(crate);
      this.group.add(crate.root);
    }
    this.syncCrateGoals();

    /* --- whale --- */
    this.whale.targetHeading = PLOT.rotation;
    this.whale.heading = PLOT.rotation;
    this.whale.update(0, this.cellToWorld(this.rules.player.x, this.rules.player.y, this._v), null);

    this.emitState();
    return this.cameraFraming();
  }

  /** Zoom to fit the board with a comfortable margin. */
  cameraFraming() {
    const { width, height } = this.rules.level;
    const boardW = (width + 1.6) * PLOT.tile;
    const boardH = (height + 1.9) * PLOT.tile;
    // The board is screen-aligned, so its screen height is the depth extent
    // foreshortened by the camera pitch plus the hedge height.
    const pitch = CAMERAS.play.pitch * Math.PI / 180;
    const screenH = boardH * Math.sin(pitch) + 3.4;
    const needed = Math.max(screenH, boardW / Math.max(1.2, this.aspect || 1.7778));
    return {
      target: PLOT.center.clone().setY(PLOT.height + 1.0),
      yaw: CAMERAS.play.yaw,
      pitch: CAMERAS.play.pitch,
      distance: CAMERAS.play.distance,
      frustumHeight: clamp(needed * 1.16, 18, 34),
    };
  }

  setAspect(aspect) {
    this.aspect = aspect;
  }

  clear() {
    for (const c of this.crates) { this.group.remove(c.root); c.dispose(); }
    this.crates.length = 0;
    for (const m of this.marks) { this.group.remove(m.mesh); m.dispose(); }
    this.marks.length = 0;
    if (this.hedge) {
      this.group.remove(this.hedge);
      this.hedge.geometry.dispose();
      this.hedge = null;
    }
  }

  dispose() {
    this.clear();
    this.group.remove(this.whale.root);
    this.whale.dispose();
    this.scene.remove(this.group);
  }

  syncCrateGoals() {
    this.rules.boxes.forEach((b, i) => {
      const crate = this.crates[i];
      if (crate) crate.setOnGoal(this.rules.isGoal(b.x, b.y));
    });
  }

  emitState() {
    if (!this.hooks.onState) return;
    this.hooks.onState({
      id: this.level.id,
      index: this.levelIndex,
      count: LEVELS.length,
      name: this.level.name,
      hint: this.level.hint,
      concept: this.level.concept,
      moves: this.rules.moves,
      pushes: this.rules.pushes,
      seated: this.rules.seatedCount,
      goals: this.rules.goalCount,
      solved: this.solved,
      locked: this.rules.anyLocked,
    });
  }

  /** Queue a move. Directions are grid-space, which is screen-space here. */
  input(dirKey) {
    if (!this.active || this.solved) return;
    if (!DIRS[dirKey]) return;
    if (this.queue.length < 2) this.queue.push(dirKey);
  }

  undo() {
    if (!this.active || this.anim) return;
    const record = this.rules.undo();
    if (!record) return;
    this.syncCrateGoals();
    this.solved = false;
    this.placeAll();
    this.emitState();
  }

  restart() {
    if (!this.active) return;
    this.rules.reset();
    this.solved = false;
    this.solveTimer = 0;
    this.queue.length = 0;
    this.anim = null;
    this.syncCrateGoals();
    this.placeAll();
    this.emitState();
  }

  placeAll() {
    this.rules.boxes.forEach((b, i) => {
      const crate = this.crates[i];
      if (crate) crate.place(this.cellToWorld(b.x, b.y, this._v));
    });
    this.whale.update(0, this.cellToWorld(this.rules.player.x, this.rules.player.y, this._v), null);
  }

  beginMove(dirKey) {
    const result = this.rules.move(dirKey);
    if (!result) {
      // Bumping a hedge still turns the whale to face it: the refusal reads.
      const dir = DIRS[dirKey];
      const from = this.cellToWorld(this.rules.player.x, this.rules.player.y, new THREE.Vector3());
      const to = this.cellToWorld(this.rules.player.x + dir.dx, this.rules.player.y + dir.dy, new THREE.Vector3());
      this._dir.subVectors(to, from);
      this.whale.setHeadingFromDelta(this._dir.x, this._dir.z);
      return false;
    }
    const dir = DIRS[dirKey];
    const from = this.cellToWorld(result.from.x, result.from.y, new THREE.Vector3());
    const to = this.cellToWorld(result.to.x, result.to.y, new THREE.Vector3());
    this._dir.subVectors(to, from);
    this.whale.setHeadingFromDelta(this._dir.x, this._dir.z);
    this.whale.startHop();

    const pushed = result.pushed >= 0;
    this.anim = {
      time: 0,
      duration: pushed ? PUSH_TIME : HOP_TIME,
      from,
      to,
      dir: this._dir.clone().normalize(),
      crateIndex: pushed ? result.pushed : -1,
      crateFrom: pushed ? this.cellToWorld(result.boxFrom.x, result.boxFrom.y, new THREE.Vector3()) : null,
      crateTo: pushed ? this.cellToWorld(result.boxTo.x, result.boxTo.y, new THREE.Vector3()) : null,
    };
    return true;
  }

  update(dt, cameraRig) {
    if (!this.rules) return;

    if (this.anim) {
      this.anim.time += dt;
      const t = clamp(this.anim.time / this.anim.duration, 0, 1);
      const eased = t * t * (3 - 2 * t);
      this._v.lerpVectors(this.anim.from, this.anim.to, eased);
      this.whale.update(dt, this._v, t);

      if (this.anim.crateIndex >= 0) {
        const crate = this.crates[this.anim.crateIndex];
        const p = new THREE.Vector3().lerpVectors(this.anim.crateFrom, this.anim.crateTo, eased);
        crate.place(p, t, this.anim.dir);
      }

      if (t >= 1) {
        const finished = this.anim;
        this.anim = null;
        this.syncCrateGoals();
        if (finished.crateIndex >= 0) {
          const crate = this.crates[finished.crateIndex];
          crate.place(finished.crateTo);
          if (crate.onGoal && cameraRig) cameraRig.pulse(0.22);
        }
        this.emitState();
        if (this.rules.solved && !this.solved) {
          this.solved = true;
          this.solveTimer = 0;
          this.whale.cheer(3.0);
          if (cameraRig) cameraRig.pulse(0.55);
          this.emitState();
          if (this.hooks.onSolved) {
            this.hooks.onSolved({
              id: this.level.id,
              index: this.levelIndex,
              name: this.level.name,
              moves: this.rules.moves,
              pushes: this.rules.pushes,
              last: this.levelIndex === LEVELS.length - 1,
            });
          }
        }
      }
    } else {
      const pos = this.cellToWorld(this.rules.player.x, this.rules.player.y, this._v);
      this.whale.update(dt, pos, null);
      if (this.queue.length && !this.solved) this.beginMove(this.queue.shift());
    }

    if (this.solved) this.solveTimer += dt;
  }
}
