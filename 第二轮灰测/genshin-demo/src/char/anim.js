// Code-authored pose/animation system: keyframed euler poses, cross-fading,
// additive upper-body layer, root offset ("_p") and per-key easing.
// No glTF clips - every animation below is hand tuned data.
import * as THREE from 'three';
import { clamp, lerp, smoothstep } from '../core/utils.js';

const D = Math.PI / 180;

/** Bones a clip may drive (fixed order = accumulator layout). */
export const ANIM_BONES = [
  'hips', 'spine', 'chest', 'neck', 'head',
  'shoulderL', 'armL', 'foreArmL', 'handL',
  'shoulderR', 'armR', 'foreArmR', 'handR',
  'thighL', 'shinL', 'footL', 'toeL',
  'thighR', 'shinR', 'footR', 'toeR',
];
const GI = {};
ANIM_BONES.forEach((n, i) => { GI[n] = i; });
const NB = ANIM_BONES.length;

// ---------------------------------------------------------------- authoring helpers
/** Expand {arm:[x,y,z]} into L/R pairs with mirrored y/z. */
function sym(o) {
  const r = {};
  for (const k in o) { const v = o[k]; r[k + 'L'] = v; r[k + 'R'] = [v[0], -v[1], -v[2]]; }
  return r;
}
/** Full left/right mirror of a pose (used for the second half of gait cycles). */
function mir(p) {
  const r = {};
  for (const k in p) {
    if (k === '_p') { r._p = [-p._p[0], p._p[1], p._p[2]]; continue; }
    const v = p[k];
    let n = k;
    if (k.endsWith('L')) n = k.slice(0, -1) + 'R';
    else if (k.endsWith('R')) n = k.slice(0, -1) + 'L';
    r[n] = [v[0], -v[1], -v[2]];
  }
  return r;
}
const EASE = {
  linear: (t) => t,
  smooth: (t) => t * t * (3 - 2 * t),
  out: (t) => 1 - Math.pow(1 - t, 2.4),
  outHard: (t) => 1 - Math.pow(1 - t, 4),
  in: (t) => t * t,
  inOut: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
};

export const CLIPS = {};
function clip(name, dur, loop, keys, opts) {
  CLIPS[name] = Object.assign({ name, dur, loop, keys, grounded: true }, opts || {});
}

function compile(c) {
  if (c._c) return c._c;
  const set = {};
  for (const k of c.keys) for (const b in k[1]) if (b.charAt(0) !== '_') set[b] = 1;
  const list = Object.keys(set).filter((n) => GI[n] != null);
  const gi = list.map((n) => GI[n]);
  const n = c.keys.length;
  const times = new Float32Array(n);
  const vals = new Float32Array(n * list.length * 3);
  const pos = new Float32Array(n * 3);
  const feet = new Float32Array(n * 2);
  const hasPos = new Uint8Array(n);
  const eases = [];
  for (let i = 0; i < n; i++) {
    times[i] = c.keys[i][0];
    const pose = c.keys[i][1];
    for (let j = 0; j < list.length; j++) {
      const v = pose[list[j]];
      if (v) {
        vals[(i * list.length + j) * 3] = v[0] * D;
        vals[(i * list.length + j) * 3 + 1] = v[1] * D;
        vals[(i * list.length + j) * 3 + 2] = v[2] * D;
      }
    }
    if (pose._p) { pos[i * 3] = pose._p[0]; pos[i * 3 + 1] = pose._p[1]; pos[i * 3 + 2] = pose._p[2]; hasPos[i] = 1; }
    const f = pose._f || c.foot || (c.grounded === false ? [0, 0] : [1, 1]);
    feet[i * 2] = f[0]; feet[i * 2 + 1] = f[1];
    eases.push(EASE[c.keys[i][2] || 'smooth'] || EASE.smooth);
  }
  c._c = { list, gi, times, vals, pos, feet, hasPos, eases, nb: list.length, nk: n };
  return c._c;
}

const _tmpE = new Float32Array(NB * 3);
const _tmpP = new THREE.Vector3();

/** Sample a compiled clip at time t into the global euler buffer. */
function sampleClip(cc, t, dur, loop, outE, outP, outF) {
  for (let i = 0; i < NB * 3; i++) outE[i] = 0;
  outP.set(0, 0, 0);
  let time = loop ? ((t % dur) + dur) % dur : clamp(t, 0, dur);
  const T = cc.times, n = cc.nk;
  let i1 = 1;
  while (i1 < n - 1 && T[i1] < time) i1++;
  const i0 = i1 - 1;
  const span = Math.max(1e-5, T[i1] - T[i0]);
  let u = clamp((time - T[i0]) / span, 0, 1);
  u = cc.eases[i0](u);
  const nb = cc.nb;
  for (let j = 0; j < nb; j++) {
    const g = cc.gi[j] * 3;
    const a = (i0 * nb + j) * 3, b = (i1 * nb + j) * 3;
    outE[g] = lerp(cc.vals[a], cc.vals[b], u);
    outE[g + 1] = lerp(cc.vals[a + 1], cc.vals[b + 1], u);
    outE[g + 2] = lerp(cc.vals[a + 2], cc.vals[b + 2], u);
  }
  outP.set(
    lerp(cc.pos[i0 * 3], cc.pos[i1 * 3], u),
    lerp(cc.pos[i0 * 3 + 1], cc.pos[i1 * 3 + 1], u),
    lerp(cc.pos[i0 * 3 + 2], cc.pos[i1 * 3 + 2], u),
  );
  if (outF) {
    outF[0] = lerp(cc.feet[i0 * 2], cc.feet[i1 * 2], u);
    outF[1] = lerp(cc.feet[i0 * 2 + 1], cc.feet[i1 * 2 + 1], u);
  }
}

const ALIAS = {
  attack: 'attack1', dead: 'death', float: 'fly', hover: 'fly', fly_idle: 'fly',
  run_combat: 'run', walk_combat: 'walk', idle_sword: 'idle_combat', sprint_combat: 'sprint',
  jump_up: 'jump', falling: 'fall', glide_start: 'glide', swim_fast: 'swim',
};
const FLOAT_REMAP = { idle: 'fly', walk: 'fly', run: 'fly', sprint: 'fly', jump: 'fly', fall: 'fly', land: 'fly', dash: 'fly', climb: 'fly', climb_idle: 'fly', swim: 'fly', swim_idle: 'fly', sit: 'fly', glide: 'fly', idle_combat: 'fly' };

// ---------------------------------------------------------------- Animator
export class Animator {
  constructor(rig, def) {
    this.rig = rig;
    this.def = def || {};
    this.bones = ANIM_BONES.map((n) => rig.bones[n] || null);
    this.restPos = (rig.bones.hips ? rig.bones.hips.position.clone() : new THREE.Vector3());
    this.acc = [];
    for (let i = 0; i < NB; i++) this.acc.push(new THREE.Quaternion());
    this.accPos = new THREE.Vector3();
    this.tracks = [];
    this.time = 0;
    this.speed = 1;
    this.grounded = true;
    this.remap = this.def.floats ? FLOAT_REMAP : null;
    this._e = new THREE.Euler(0, 0, 0, 'YXZ');
    this._q = new THREE.Quaternion();
    this._buf = new Float32Array(NB * 3);
    this._pos = new THREE.Vector3();
    this._f = new Float32Array(2);
    this.footPlant = new Float32Array(2);
    this.current = 'idle';
    this.play('idle', { fade: 0 });
  }

  resolve(name) {
    let n = name;
    if (this.remap && this.remap[n]) n = this.remap[n];
    if (CLIPS[n]) return CLIPS[n];
    if (ALIAS[n] && CLIPS[ALIAS[n]]) return CLIPS[ALIAS[n]];
    return CLIPS.idle;
  }

  topOf(layer) {
    for (let i = this.tracks.length - 1; i >= 0; i--) {
      const t = this.tracks[i];
      if (t.layer === layer && !t.out) return t;
    }
    return null;
  }

  /** play(clip, { fade, loop, speed, weight, layer, restart }) */
  play(name, opts) {
    const o = opts || {};
    const c = this.resolve(name);
    const layer = o.layer || 0;
    const fade = o.fade != null ? o.fade : 0.18;
    const loop = o.loop != null ? o.loop : c.loop;
    const top = this.topOf(layer);
    if (top && top.clip === c && o.restart !== true) {
      if (o.speed != null) top.speed = o.speed;
      if (o.weight != null) top.weight = o.weight;
      if (loop || top.time < c.dur) { if (layer === 0) this.current = c.name; return this; }
    }
    for (const tr of this.tracks) if (tr.layer === layer && !tr.out) { tr.out = true; tr.fade = Math.max(0.03, fade); }
    this.tracks.push({
      clip: c, cc: compile(c), time: 0,
      speed: o.speed != null ? o.speed : 1,
      loop, layer,
      weight: o.weight != null ? o.weight : 1,
      w: fade > 0.001 ? 0 : (o.weight != null ? o.weight : 1),
      fade: Math.max(0.001, fade), out: false,
    });
    if (layer === 0) this.current = c.name;
    return this;
  }

  stopLayer(layer, fade) {
    for (const tr of this.tracks) if (tr.layer === layer && !tr.out) { tr.out = true; tr.fade = Math.max(0.03, fade != null ? fade : 0.2); }
  }

  isPlaying(name) {
    const c = this.resolve(name);
    for (const tr of this.tracks) {
      if (tr.clip === c && !tr.out) return tr.loop ? true : tr.time < c.dur;
    }
    return false;
  }

  setSpeed(s) { this.speed = s; return this; }

  update(dt) {
    const d = dt * this.speed;
    for (let i = this.tracks.length - 1; i >= 0; i--) {
      const tr = this.tracks[i];
      tr.time += d * tr.speed;
      if (tr.out) { tr.w -= dt / tr.fade; if (tr.w <= 0) { this.tracks.splice(i, 1); continue; } }
      else if (tr.w < tr.weight) tr.w = Math.min(tr.weight, tr.w + dt / tr.fade);
    }
    if (!this.tracks.length) this.play('idle', { fade: 0.1 });

    for (let i = 0; i < NB; i++) this.acc[i].set(0, 0, 0, 1);
    this.accPos.set(0, 0, 0);
    this.footPlant[0] = 0; this.footPlant[1] = 0;
    let tw = 0;
    for (const tr of this.tracks) {
      if (tr.layer !== 0 || tr.w <= 0.0001) continue;
      sampleClip(tr.cc, tr.time, tr.clip.dur, tr.loop, this._buf, this._pos, this._f);
      tw += tr.w;
      const f = tr.w / tw;
      this.footPlant[0] = lerp(this.footPlant[0], this._f[0], f);
      this.footPlant[1] = lerp(this.footPlant[1], this._f[1], f);
      for (let i = 0; i < NB; i++) {
        this._e.set(this._buf[i * 3], this._buf[i * 3 + 1], this._buf[i * 3 + 2]);
        this._q.setFromEuler(this._e);
        this.acc[i].slerp(this._q, f);
      }
      this.accPos.lerp(this._pos, f);
    }
    for (const tr of this.tracks) {
      if (tr.layer === 0 || tr.w <= 0.0001) continue;
      sampleClip(tr.cc, tr.time, tr.clip.dur, tr.loop, this._buf, this._pos);
      const w = Math.min(1, tr.w);
      for (let k = 0; k < tr.cc.gi.length; k++) {
        const i = tr.cc.gi[k];
        this._e.set(this._buf[i * 3], this._buf[i * 3 + 1], this._buf[i * 3 + 2]);
        this._q.setFromEuler(this._e);
        this.acc[i].slerp(this._q, w);
      }
    }
    for (let i = 0; i < NB; i++) { const b = this.bones[i]; if (b) b.quaternion.copy(this.acc[i]); }
    const hips = this.bones[0];
    if (hips) hips.position.set(
      this.restPos.x + this.accPos.x, this.restPos.y + this.accPos.y, this.restPos.z + this.accPos.z);
    const top = this.topOf(0);
    this.time = top ? top.time : 0;
    this.grounded = top ? top.clip.grounded !== false : true;
    this.plant = top ? top.clip.plant !== false : true;
    this.dominant = top ? top.clip.name : 'idle';
  }
}

// ================================================================ clip library
// Angle conventions (degrees):
//   limb bones point down  -> -rx swings the tip FORWARD (+Z), +rx backward
//   +rz moves a limb tip towards +X (the character's LEFT); sym() mirrors for R
//   spine/neck/head point up -> +rx leans forward, +ry turns left, +rz tilts left
//   foot: +rx points the toe down
//   "_p" offsets the hips in normalised units (1.0 = body height)

// ---------------- idle
const idleA = Object.assign({
  spine: [1.6, 0, 0], chest: [1, 0, 0.6], neck: [-2, 0, -0.6], head: [1, 2, 0.5], _p: [0.002, -0.002, 0],
}, sym({ arm: [3, 0, -7], foreArm: [-15, 5, -4], hand: [0, 0, -4], thigh: [-1, 0, 1], shin: [2, 0, 0], foot: [-1, 0, 0] }));
const idleB = Object.assign({
  spine: [0.4, 0, 0], chest: [-1.4, 0, 0.4], neck: [0, 0, -0.4], head: [-1, 1, 0], _p: [0.002, 0.004, 0],
}, sym({ arm: [1, 0, -4.5], foreArm: [-12, 5, -4], hand: [0, 0, -3], thigh: [-1, 0, 1], shin: [1, 0, 0], foot: [0, 0, 0] }));
const idleC = Object.assign({
  hips: [0, 3, -2.5], spine: [1.5, -2, 2], chest: [1, 1, 1.4], neck: [-2, 1, -1], head: [1.5, -5, 1.5], _p: [0.010, -0.005, 0],
}, sym({ arm: [2, 0, -6], foreArm: [-16, 6, -5], hand: [0, 0, -4] }), {
  thighL: [-3, 0, 2.5], shinL: [5, 0, 0], footL: [-2, 0, 0],
  thighR: [1, 0, -1], shinR: [1, 0, 0], footR: [0, 0, 0],
});
clip('idle', 4.0, true, [[0, idleA], [1.35, idleB], [2.6, idleC], [4.0, idleA]]);

// ---------------- combat idle (sword ready, weight on the back foot)
const cbA = {
  hips: [0, -12, 0], spine: [4, -8, 0], chest: [3, -9, 1], neck: [-1, 22, 0], head: [0, 15, 0],
  armR: [-14, 0, -26], foreArmR: [-64, 16, 4], handR: [-6, 0, 10],
  armL: [8, 0, -16], foreArmL: [-46, -22, -6], handL: [0, 0, -6],
  thighL: [-8, 0, 4], shinL: [13, 0, 0], footL: [-5, 0, 0],
  thighR: [6, 0, -8], shinR: [8, 0, 0], footR: [-2, 0, 0],
  _p: [0.004, -0.016, 0.004],
};
const cbB = {
  hips: [0, -12, 0], spine: [3, -8, 0], chest: [2, -9, 1], neck: [0, 22, 0], head: [1, 15, 0],
  armR: [-11, 0, -24], foreArmR: [-60, 16, 4], handR: [-6, 0, 10],
  armL: [7, 0, -14], foreArmL: [-42, -22, -6], handL: [0, 0, -6],
  thighL: [-7, 0, 4], shinL: [11, 0, 0], footL: [-4, 0, 0],
  thighR: [5, 0, -8], shinR: [7, 0, 0], footR: [-2, 0, 0],
  _p: [0.004, -0.012, 0.004],
};
clip('idle_combat', 2.6, true, [[0, cbA], [1.3, cbB], [2.6, cbA]]);

// ---------------- walk
const walkA = {
  spine: [3, 4, 0], chest: [1.5, -5, 0], neck: [-2.5, 1, 0], head: [0, 0, 0],
  hips: [0, 4, -1],
  thighL: [-19, 1, 2], shinL: [6, 0, 0], footL: [-7, 0, 0], toeL: [2, 0, 0],
  thighR: [14, -1, -2], shinR: [16, 0, 0], footR: [18, 0, 0], toeR: [14, 0, 0],
  armL: [15, 0, -6], foreArmL: [-16, 4, -3], handL: [0, 0, -4],
  armR: [-15, 0, 6], foreArmR: [-25, -4, 3], handR: [0, 0, 4],
  _p: [0.004, -0.006, 0], _f: [1, 1],
};
const walkB = {
  spine: [3, 0, 0], chest: [1.5, 0, 0], neck: [-2.5, 0, 0], head: [0, 0, 0], hips: [0, 0, 0],
  thighL: [-4, 0, 1], shinL: [4, 0, 0], footL: [2, 0, 0],
  thighR: [-9, 0, -1], shinR: [40, 0, 0], footR: [-8, 0, 0], toeR: [0, 0, 0],
  armL: [7, 0, -6], foreArmL: [-14, 4, -3], handL: [0, 0, -4],
  armR: [-7, 0, 6], foreArmR: [-20, -4, 3], handR: [0, 0, 4],
  _p: [0, 0.008, 0], _f: [1, 0],
};
// Measured: the authored stride moved the foot only ~0.40 m per step, while running at
// 4.9 m/s needs ~1.15 m — that mismatch is what read as skating / "kicking backwards".
// stride() scales the fore/aft swing (thigh + upper arm) and the knee/elbow bend that
// goes with it, keeping every sign convention intact.
function stride(p, k, ka = k) {
  const q = {};
  for (const key in p) {
    const v = p[key];
    if (!Array.isArray(v)) { q[key] = v; continue; }
    if (key === 'thighL' || key === 'thighR') q[key] = [v[0] * k, v[1], v[2]];
    else if (key === 'shinL' || key === 'shinR') q[key] = [v[0] * (1 + (k - 1) * 0.55), v[1], v[2]];
    else if (key === 'armL' || key === 'armR') q[key] = [v[0] * ka, v[1], v[2]];
    else if (key === 'foreArmL' || key === 'foreArmR') q[key] = [v[0] * (1 + (ka - 1) * 0.35), v[1], v[2]];
    else q[key] = v;
  }
  return q;
}
const walkA_ = stride(walkA, 2.05, 1.7), walkB_ = stride(walkB, 2.05, 1.7);
clip('walk', 1.04, true, [[0, walkA_], [0.26, walkB_], [0.52, mir(walkA_)], [0.78, mir(walkB_)], [1.04, walkA_]]);

// ---------------- run
const runA = {
  spine: [15, 5, 0], chest: [9, -9, 0], neck: [-16, 2, 0], head: [-8, 0, 0], hips: [7, 6, -2],
  thighL: [-28, 2, 3], shinL: [7, 0, 0], footL: [-5, 0, 0], toeL: [3, 0, 0],
  thighR: [20, -2, -3], shinR: [56, 0, 0], footR: [16, 0, 0], toeR: [14, 0, 0],
  armL: [40, 0, -9], foreArmL: [-74, 10, -4], handL: [-6, 0, -6],
  armR: [-48, 0, 9], foreArmR: [-82, -10, 4], handR: [-6, 0, 6],
  _p: [0.006, -0.012, 0.008], _f: [1, 0],
};
const runB = {
  spine: [14, 0, 0], chest: [9, 0, 0], neck: [-15, 0, 0], head: [-7, 0, 0], hips: [7, 0, 0],
  thighL: [-30, 0, 2], shinL: [30, 0, 0], footL: [-6, 0, 0],
  thighR: [20, 0, -2], shinR: [86, 0, 0], footR: [10, 0, 0],
  armL: [16, 0, -8], foreArmL: [-80, 10, -4], handL: [-6, 0, -6],
  armR: [-22, 0, 8], foreArmR: [-84, -10, 4], handR: [-6, 0, 6],
  _p: [0.003, 0.014, 0.008], _f: [0, 0],
};
const runA_ = stride(runA, 2.10, 1.45), runB_ = stride(runB, 2.10, 1.45);
clip('run', 0.70, true, [[0, runA_], [0.175, runB_], [0.35, mir(runA_)], [0.525, mir(runB_)], [0.70, runA_]]);

const sprA = {
  spine: [20, 6, 0], chest: [12, -11, 0], neck: [-22, 2, 0], head: [-10, 0, 0], hips: [11, 7, -2],
  thighL: [-33, 2, 3], shinL: [8, 0, 0], footL: [-6, 0, 0], toeL: [4, 0, 0],
  thighR: [24, -2, -3], shinR: [68, 0, 0], footR: [20, 0, 0], toeR: [18, 0, 0],
  armL: [52, 0, -10], foreArmL: [-86, 12, -4], handL: [-10, 0, -8],
  armR: [-60, 0, 10], foreArmR: [-92, -12, 4], handR: [-10, 0, 8],
  _p: [0.006, -0.016, 0.016], _f: [1, 0],
};
const sprB = {
  spine: [19, 0, 0], chest: [12, 0, 0], neck: [-21, 0, 0], head: [-9, 0, 0], hips: [11, 0, 0],
  thighL: [-38, 0, 2], shinL: [36, 0, 0], footL: [-8, 0, 0],
  thighR: [26, 0, -2], shinR: [100, 0, 0], footR: [12, 0, 0],
  armL: [18, 0, -9], foreArmL: [-92, 12, -4], handL: [-10, 0, -8],
  armR: [-26, 0, 9], foreArmR: [-96, -12, 4], handR: [-10, 0, 8],
  _p: [0.003, 0.018, 0.016], _f: [0, 0],
};
const sprA_ = stride(sprA, 2.45, 1.5), sprB_ = stride(sprB, 2.45, 1.5);
clip('sprint', 0.56, true, [[0, sprA_], [0.14, sprB_], [0.28, mir(sprA_)], [0.42, mir(sprB_)], [0.56, sprA_]]);

// ---------------- air / traversal
clip('jump', 0.52, false, [
  [0, Object.assign({ spine: [12, 0, 0], chest: [6, 0, 0], neck: [-10, 0, 0], head: [-4, 0, 0], _p: [0, -0.075, 0.01] },
    sym({ arm: [34, 0, -10], foreArm: [-30, 0, -6], thigh: [-46, 0, 4], shin: [62, 0, 0], foot: [-16, 0, 0] })), 'outHard'],
  [0.15, Object.assign({ spine: [-4, 0, 0], chest: [-3, 0, 0], neck: [4, 0, 0], head: [2, 0, 0], _p: [0, 0.020, 0] },
    sym({ arm: [-96, 0, -6], foreArm: [-26, 0, -4], thigh: [-4, 0, 2], shin: [5, 0, 0], foot: [26, 0, 0] })), 'out'],
  [0.52, Object.assign({ spine: [2, 0, 0], chest: [2, 0, 0], neck: [-2, 0, 0], head: [-4, 0, 0], _p: [0, 0.004, 0] },
    sym({ arm: [-52, 0, -18], foreArm: [-40, 10, -6], thigh: [-22, 0, 5], shin: [34, 0, 0], foot: [12, 0, 0] }))],
], { grounded: false });

const fallA = Object.assign({ spine: [-4, 0, 0], chest: [-2, 0, 0], neck: [8, 0, 0], head: [6, 0, 0], _p: [0, 0.004, -0.006] },
  sym({ arm: [-74, 0, -30], foreArm: [-52, 16, -8], hand: [-10, 0, -8] }), {
  thighL: [-26, 0, 7], shinL: [40, 0, 0], footL: [16, 0, 0],
  thighR: [-6, 0, -5], shinR: [18, 0, 0], footR: [22, 0, 0],
});
const fallB = Object.assign({ spine: [-2, 0, 2], chest: [-1, 3, 0], neck: [7, -2, 0], head: [5, -2, 0], _p: [0, 0.006, -0.004] },
  sym({ arm: [-68, 0, -36], foreArm: [-46, 16, -8], hand: [-10, 0, -8] }), {
  thighL: [-18, 0, 6], shinL: [30, 0, 0], footL: [14, 0, 0],
  thighR: [-12, 0, -6], shinR: [26, 0, 0], footR: [20, 0, 0],
});
clip('fall', 1.1, true, [[0, fallA], [0.55, fallB], [1.1, fallA]], { grounded: false });

clip('land', 0.46, false, [
  [0, Object.assign({ spine: [10, 0, 0], chest: [5, 0, 0], neck: [-8, 0, 0], _p: [0, -0.02, 0] },
    sym({ arm: [-24, 0, -22], foreArm: [-40, 8, -6], thigh: [-24, 0, 4], shin: [34, 0, 0], foot: [6, 0, 0] })), 'outHard'],
  [0.10, Object.assign({ spine: [20, 0, 0], chest: [10, 0, 0], neck: [-16, 0, 0], head: [-6, 0, 0], _p: [0, -0.085, 0.012] },
    sym({ arm: [30, 0, -16], foreArm: [-52, 12, -8], thigh: [-52, 0, 6], shin: [72, 0, 0], foot: [-18, 0, 0] })), 'out'],
  [0.46, Object.assign({ spine: [2, 0, 0], chest: [1, 0, 0], neck: [-2, 0, 0], _p: [0, -0.004, 0] },
    sym({ arm: [4, 0, -8], foreArm: [-16, 5, -4], thigh: [-2, 0, 1], shin: [3, 0, 0], foot: [-1, 0, 0] }))],
]);

const glideA = Object.assign({ spine: [16, 0, 0], chest: [8, 0, 0], neck: [-20, 0, 0], head: [-8, 0, 0], _p: [0, 0.006, 0.01] },
  sym({ arm: [-14, -6, 62], foreArm: [-8, 0, 10], hand: [0, 0, 12], thigh: [16, 0, 8], shin: [16, 0, 0], foot: [24, 0, 0] }));
const glideB = Object.assign({ spine: [15, 2, 0], chest: [8, -2, 1], neck: [-19, 2, 0], head: [-7, 3, 0], _p: [0.004, 0.010, 0.01] },
  sym({ arm: [-10, -6, 66], foreArm: [-6, 0, 8], hand: [0, 0, 10] }), {
  thighL: [12, 0, 9], shinL: [20, 0, 0], footL: [26, 0, 0],
  thighR: [20, 0, -7], shinR: [12, 0, 0], footR: [22, 0, 0],
});
clip('glide', 3.0, true, [[0, glideA], [1.5, glideB], [3.0, glideA]], { grounded: false });

const climbA = {
  hips: [4, 0, 0], spine: [2, -4, 0], chest: [2, 4, 0], neck: [-6, 0, 0], head: [-4, 0, 0],
  armL: [-156, 0, -14], foreArmL: [-24, 0, -10], handL: [0, 0, -10],
  armR: [-96, 0, 16], foreArmR: [-58, 0, 12], handR: [0, 0, 10],
  thighL: [-14, 0, 8], shinL: [26, 0, 0], footL: [22, 0, 0],
  thighR: [-44, 0, -6], shinR: [58, 0, 0], footR: [10, 0, 0],
  _p: [0.004, 0.004, 0.02],
};
clip('climb', 1.6, true, [[0, climbA], [0.8, mir(climbA)], [1.6, climbA]], { grounded: false });
clip('climb_idle', 2.6, true, [
  [0, {
    hips: [3, 0, 0], spine: [2, 0, 0], chest: [2, 0, 0], neck: [-6, 0, 0], head: [-4, 0, 0],
    armL: [-142, 0, -18], foreArmL: [-34, 0, -10], armR: [-142, 0, 18], foreArmR: [-34, 0, 10],
    thighL: [-22, 0, 8], shinL: [40, 0, 0], footL: [18, 0, 0],
    thighR: [-22, 0, -8], shinR: [40, 0, 0], footR: [18, 0, 0], _p: [0, 0, 0.02],
  }],
  [1.3, {
    hips: [3, 0, 0], spine: [3, 0, 0], chest: [2, 0, 0], neck: [-6, 0, 0], head: [-3, 0, 0],
    armL: [-138, 0, -16], foreArmL: [-40, 0, -10], armR: [-138, 0, 16], foreArmR: [-40, 0, 10],
    thighL: [-18, 0, 7], shinL: [36, 0, 0], footL: [16, 0, 0],
    thighR: [-18, 0, -7], shinR: [36, 0, 0], footR: [16, 0, 0], _p: [0, -0.008, 0.02],
  }],
  [2.6, {
    hips: [3, 0, 0], spine: [2, 0, 0], chest: [2, 0, 0], neck: [-6, 0, 0], head: [-4, 0, 0],
    armL: [-142, 0, -18], foreArmL: [-34, 0, -10], armR: [-142, 0, 18], foreArmR: [-34, 0, 10],
    thighL: [-22, 0, 8], shinL: [40, 0, 0], footL: [18, 0, 0],
    thighR: [-22, 0, -8], shinR: [40, 0, 0], footR: [18, 0, 0], _p: [0, 0, 0.02],
  }],
], { grounded: false });

const swimA = {
  hips: [66, 0, 0], spine: [6, 0, 0], chest: [4, 0, 0], neck: [-46, 0, 0], head: [-22, 0, 0],
  armL: [-118, -20, 26], foreArmL: [-30, 0, 10], armR: [-26, 20, 30], foreArmR: [-42, 0, 10],
  thighL: [-16, 0, 6], shinL: [26, 0, 0], footL: [30, 0, 0],
  thighR: [14, 0, -6], shinR: [10, 0, 0], footR: [34, 0, 0],
  _p: [0, -0.14, 0.03],
};
clip('swim', 1.8, true, [[0, swimA], [0.9, mir(swimA)], [1.8, swimA]], { grounded: false });
clip('swim_idle', 3.0, true, [
  [0, Object.assign({ hips: [10, 0, 0], spine: [2, 0, 0], neck: [-6, 0, 0], head: [-2, 0, 0], _p: [0, -0.07, 0] },
    sym({ arm: [-30, 0, 34], foreArm: [-54, 20, 10], hand: [0, 0, 8], thigh: [-30, 0, 10], shin: [50, 0, 0], foot: [20, 0, 0] }))],
  [1.5, Object.assign({ hips: [8, 0, 0], spine: [3, 0, 0], neck: [-5, 0, 0], head: [-3, 0, 0], _p: [0, -0.05, 0] },
    sym({ arm: [-24, 0, 42], foreArm: [-44, 20, 10], hand: [0, 0, 8], thigh: [-20, 0, 12], shin: [36, 0, 0], foot: [24, 0, 0] }))],
  [3.0, Object.assign({ hips: [10, 0, 0], spine: [2, 0, 0], neck: [-6, 0, 0], head: [-2, 0, 0], _p: [0, -0.07, 0] },
    sym({ arm: [-30, 0, 34], foreArm: [-54, 20, 10], hand: [0, 0, 8], thigh: [-30, 0, 10], shin: [50, 0, 0], foot: [20, 0, 0] }))],
], { grounded: false });

clip('dash', 0.44, false, [
  [0, {
    hips: [8, -10, 0], spine: [10, 6, 0], chest: [6, 6, 0], neck: [-12, -6, 0], head: [-6, -6, 0],
    armL: [40, 0, -14], foreArmL: [-40, 0, -6], armR: [-30, 0, 20], foreArmR: [-70, 0, 6],
    thighL: [-34, 0, 6], shinL: [30, 0, 0], footL: [-6, 0, 0],
    thighR: [22, 0, -6], shinR: [56, 0, 0], footR: [22, 0, 0], _p: [0, -0.03, 0.03],
  }, 'outHard'],
  [0.18, {
    hips: [14, -6, 0], spine: [14, 4, 0], chest: [8, 4, 0], neck: [-16, -4, 0], head: [-8, -4, 0],
    armL: [58, 0, -16], foreArmL: [-56, 0, -8], armR: [-14, 0, 24], foreArmR: [-84, 0, 8],
    thighL: [-14, 0, 6], shinL: [22, 0, 0], footL: [10, 0, 0],
    thighR: [-30, 0, -6], shinR: [78, 0, 0], footR: [-4, 0, 0], _p: [0, 0.006, 0.05],
  }, 'out'],
  [0.44, Object.assign({ spine: [4, 0, 0], chest: [2, 0, 0], neck: [-4, 0, 0], _p: [0, -0.008, 0.006] },
    sym({ arm: [4, 0, -8], foreArm: [-20, 6, -4], thigh: [-6, 0, 2], shin: [10, 0, 0], foot: [-2, 0, 0] }))],
]);

// ---------------- sword combo (right hand). Coherent 5 hit chain: R->L, L->R,
// overhead chop, rising diagonal, spin finisher. Each ends near the combat guard.
const guard = {
  hips: [0, -10, 0], spine: [4, -7, 0], chest: [3, -8, 0], neck: [-1, 20, 0], head: [0, 14, 0],
  armR: [-16, 0, -24], foreArmR: [-58, 14, 4], handR: [-6, 0, 8],
  armL: [8, 0, -16], foreArmL: [-44, -20, -6], handL: [0, 0, -6],
  thighL: [-7, 0, 4], shinL: [11, 0, 0], footL: [-4, 0, 0],
  thighR: [5, 0, -8], shinR: [8, 0, 0], footR: [-2, 0, 0], _p: [0.004, -0.014, 0.004],
};
clip('attack1', 0.46, false, [
  [0, {
    hips: [0, -20, 0], spine: [6, -14, -4], chest: [4, -16, -6], neck: [4, 26, 0], head: [0, 22, 0],
    armR: [-24, -14, -48], foreArmR: [-86, 20, 6], handR: [-10, 0, 14],
    armL: [16, 0, -24], foreArmL: [-58, -30, -8], handL: [0, 0, -8],
    thighL: [-10, 0, 5], shinL: [16, 0, 0], footL: [-6, 0, 0],
    thighR: [8, 0, -10], shinR: [10, 0, 0], footR: [-2, 0, 0], _p: [0.006, -0.022, -0.01],
  }, 'outHard'],
  [0.15, {
    hips: [2, 20, 0], spine: [10, 16, 4], chest: [6, 18, 6], neck: [-6, -26, 0], head: [-2, -20, 0],
    armR: [-66, -22, 44], foreArmR: [-14, 6, 0], handR: [-4, 0, -6],
    armL: [4, 0, -18], foreArmL: [-46, -30, -6], handL: [0, 0, -6],
    thighL: [-24, 0, 5], shinL: [22, 0, 0], footL: [-8, 0, 0],
    thighR: [16, 0, -8], shinR: [26, 0, 0], footR: [12, 0, 0], _p: [0.004, -0.018, 0.038],
  }, 'out'],
  [0.46, guard],
], { grounded: true });

clip('attack2', 0.44, false, [
  [0, {
    hips: [0, 18, 0], spine: [8, 14, 3], chest: [5, 16, 5], neck: [-5, -24, 0], head: [-1, -18, 0],
    armR: [-60, -20, 40], foreArmR: [-22, 6, 0], handR: [-4, 0, -6],
    armL: [10, 0, -40], foreArmL: [-36, -20, -6], handL: [0, 0, -6],
    thighL: [-20, 0, 5], shinL: [20, 0, 0], footL: [-6, 0, 0],
    thighR: [12, 0, -8], shinR: [22, 0, 0], footR: [10, 0, 0], _p: [0.004, -0.018, 0.01],
  }, 'outHard'],
  [0.14, {
    hips: [2, -22, 0], spine: [10, -16, -5], chest: [6, -18, -7], neck: [-6, 28, 0], head: [-2, 22, 0],
    armR: [-34, 16, -58], foreArmR: [-26, -10, 0], handR: [-8, 0, 12],
    armL: [22, 0, -14], foreArmL: [-64, -34, -8], handL: [0, 0, -8],
    thighL: [-16, 0, 6], shinL: [18, 0, 0], footL: [-4, 0, 0],
    thighR: [10, 0, -12], shinR: [16, 0, 0], footR: [6, 0, 0], _p: [0.008, -0.020, 0.032],
  }, 'out'],
  [0.44, guard],
]);

clip('attack3', 0.54, false, [
  [0, {
    hips: [-6, -10, 0], spine: [-12, 6, 0], chest: [-8, 6, 0], neck: [8, -6, 0], head: [6, -4, 0],
    armR: [-148, -10, -20], foreArmR: [-52, 14, 6], handR: [-14, 0, 10],
    armL: [-124, 12, 22], foreArmL: [-60, -18, -6], handL: [-10, 0, -8],
    thighL: [-6, 0, 4], shinL: [10, 0, 0], footL: [-4, 0, 0],
    thighR: [4, 0, -6], shinR: [8, 0, 0], footR: [-2, 0, 0], _p: [0, -0.006, -0.014],
  }, 'outHard'],
  [0.18, {
    hips: [10, -4, 0], spine: [22, 2, 0], chest: [12, 2, 0], neck: [-18, -2, 0], head: [-10, 0, 0],
    armR: [-38, -6, -8], foreArmR: [-8, 4, 2], handR: [4, 0, 4],
    armL: [-30, 6, 10], foreArmL: [-16, -10, -4], handL: [2, 0, -4],
    thighL: [-30, 0, 5], shinL: [40, 0, 0], footL: [-10, 0, 0],
    thighR: [20, 0, -8], shinR: [34, 0, 0], footR: [16, 0, 0], _p: [0, -0.042, 0.040],
  }, 'out'],
  [0.54, guard],
]);

clip('attack4', 0.50, false, [
  [0, {
    hips: [12, 12, 0], spine: [16, 12, 4], chest: [10, 14, 6], neck: [-14, -22, 0], head: [-6, -16, 0],
    armR: [26, -14, -34], foreArmR: [-52, 16, 6], handR: [-8, 0, 12],
    armL: [16, 0, -30], foreArmL: [-48, -24, -6], handL: [0, 0, -8],
    thighL: [-38, 0, 6], shinL: [50, 0, 0], footL: [-10, 0, 0],
    thighR: [16, 0, -10], shinR: [40, 0, 0], footR: [14, 0, 0], _p: [0.006, -0.060, 0.010],
  }, 'outHard'],
  [0.17, {
    hips: [-8, -14, 0], spine: [-14, -14, -4], chest: [-8, -16, -6], neck: [8, 26, 0], head: [4, 20, 0],
    armR: [-132, -26, 26], foreArmR: [-20, 8, 0], handR: [-6, 0, -4],
    armL: [-40, 0, -16], foreArmL: [-40, -18, -6], handL: [0, 0, -6],
    thighL: [-8, 0, 5], shinL: [12, 0, 0], footL: [-4, 0, 0],
    thighR: [6, 0, -8], shinR: [8, 0, 0], footR: [16, 0, 0], _p: [0.004, 0.014, 0.028],
  }, 'out'],
  [0.50, guard],
]);

clip('attack5', 0.68, false, [
  [0, {
    hips: [0, 22, 0], spine: [6, 16, 4], chest: [4, 18, 6], neck: [-4, -28, 0], head: [-2, -20, 0],
    armR: [-58, -22, 46], foreArmR: [-30, 8, 0], handR: [-6, 0, -6],
    armL: [12, 0, -44], foreArmL: [-40, -22, -6], handL: [0, 0, -6],
    thighL: [-18, 0, 5], shinL: [18, 0, 0], footL: [-6, 0, 0],
    thighR: [12, 0, -8], shinR: [20, 0, 0], footR: [8, 0, 0], _p: [0.004, -0.020, 0],
  }, 'outHard'],
  [0.20, {
    hips: [4, -132, 0], spine: [10, 8, 0], chest: [6, 10, 0], neck: [-10, -8, 0], head: [-4, -8, 0],
    armR: [-74, -8, -30], foreArmR: [-18, 0, 0], handR: [-4, 0, 6],
    armL: [-30, 0, 40], foreArmL: [-24, 0, -6], handL: [0, 0, 8],
    thighL: [-24, 0, 8], shinL: [30, 0, 0], footL: [-6, 0, 0],
    thighR: [18, 0, -10], shinR: [40, 0, 0], footR: [16, 0, 0], _p: [0, -0.024, 0.030],
  }, 'linear'],
  [0.40, {
    hips: [2, -296, 0], spine: [8, 4, 0], chest: [5, 6, 0], neck: [-8, -4, 0], head: [-3, -4, 0],
    armR: [-56, 10, -46], foreArmR: [-26, 0, 0], handR: [-6, 0, 10],
    armL: [-14, 0, 24], foreArmL: [-34, 0, -6], handL: [0, 0, 6],
    thighL: [-14, 0, 6], shinL: [22, 0, 0], footL: [-4, 0, 0],
    thighR: [10, 0, -8], shinR: [26, 0, 0], footR: [12, 0, 0], _p: [0, -0.018, 0.046],
  }, 'out'],
  [0.68, Object.assign({}, guard, { hips: [0, -368, 0] })],
]);

clip('charge_loop', 1.0, true, [
  [0, {
    hips: [2, -18, 0], spine: [8, -12, -3], chest: [5, -14, -5], neck: [4, 24, 0], head: [0, 20, 0],
    armR: [-20, -12, -44], foreArmR: [-92, 22, 8], handR: [-12, 0, 16],
    armL: [18, 0, -22], foreArmL: [-62, -30, -8], handL: [0, 0, -8],
    thighL: [-14, 0, 6], shinL: [22, 0, 0], footL: [-6, 0, 0],
    thighR: [10, 0, -10], shinR: [14, 0, 0], footR: [-2, 0, 0], _p: [0.006, -0.030, -0.008],
  }],
  [0.5, {
    hips: [2, -16, 0], spine: [9, -11, -3], chest: [6, -13, -5], neck: [5, 22, 0], head: [1, 18, 0],
    armR: [-24, -12, -42], foreArmR: [-96, 22, 8], handR: [-12, 0, 16],
    armL: [20, 0, -20], foreArmL: [-64, -30, -8], handL: [0, 0, -8],
    thighL: [-15, 0, 6], shinL: [24, 0, 0], footL: [-6, 0, 0],
    thighR: [11, 0, -10], shinR: [15, 0, 0], footR: [-2, 0, 0], _p: [0.006, -0.034, -0.008],
  }],
  [1.0, {
    hips: [2, -18, 0], spine: [8, -12, -3], chest: [5, -14, -5], neck: [4, 24, 0], head: [0, 20, 0],
    armR: [-20, -12, -44], foreArmR: [-92, 22, 8], handR: [-12, 0, 16],
    armL: [18, 0, -22], foreArmL: [-62, -30, -8], handL: [0, 0, -8],
    thighL: [-14, 0, 6], shinL: [22, 0, 0], footL: [-6, 0, 0],
    thighR: [10, 0, -10], shinR: [14, 0, 0], footR: [-2, 0, 0], _p: [0.006, -0.030, -0.008],
  }],
]);
clip('charge_release', 0.52, false, [
  [0, {
    hips: [0, -20, 0], spine: [6, -14, -4], chest: [4, -16, -6], neck: [4, 26, 0], head: [0, 20, 0],
    armR: [-22, -14, -46], foreArmR: [-90, 20, 6], handR: [-10, 0, 14],
    armL: [18, 0, -22], foreArmL: [-60, -30, -8], _p: [0.006, -0.028, -0.01],
  }, 'outHard'],
  [0.16, {
    hips: [4, 24, 0], spine: [14, 18, 5], chest: [8, 20, 7], neck: [-8, -30, 0], head: [-4, -22, 0],
    armR: [-78, -26, 52], foreArmR: [-10, 6, 0], handR: [-2, 0, -8],
    armL: [2, 0, -22], foreArmL: [-42, -26, -6],
    thighL: [-32, 0, 6], shinL: [26, 0, 0], footL: [-10, 0, 0],
    thighR: [22, 0, -8], shinR: [32, 0, 0], footR: [16, 0, 0], _p: [0.004, -0.024, 0.060],
  }, 'out'],
  [0.52, guard],
]);

clip('plunge', 0.9, true, [
  [0, {
    hips: [22, 0, 0], spine: [10, 0, 0], chest: [6, 0, 0], neck: [-24, 0, 0], head: [-14, 0, 0],
    armR: [-26, -8, -14], foreArmR: [-16, 0, 4], handR: [34, 0, 6],
    armL: [-22, 8, 18], foreArmL: [-22, 0, -4], handL: [30, 0, -6],
    thighL: [34, 0, 8], shinL: [46, 0, 0], footL: [26, 0, 0],
    thighR: [34, 0, -8], shinR: [46, 0, 0], footR: [26, 0, 0], _p: [0, 0.006, 0.006],
  }],
  [0.45, {
    hips: [24, 0, 0], spine: [11, 0, 0], chest: [7, 0, 0], neck: [-25, 0, 0], head: [-15, 0, 0],
    armR: [-22, -8, -16], foreArmR: [-14, 0, 4], handR: [34, 0, 6],
    armL: [-18, 8, 20], foreArmL: [-20, 0, -4], handL: [30, 0, -6],
    thighL: [40, 0, 9], shinL: [40, 0, 0], footL: [28, 0, 0],
    thighR: [40, 0, -9], shinR: [40, 0, 0], footR: [28, 0, 0], _p: [0, 0.010, 0.006],
  }],
  [0.9, {
    hips: [22, 0, 0], spine: [10, 0, 0], chest: [6, 0, 0], neck: [-24, 0, 0], head: [-14, 0, 0],
    armR: [-26, -8, -14], foreArmR: [-16, 0, 4], handR: [34, 0, 6],
    armL: [-22, 8, 18], foreArmL: [-22, 0, -4], handL: [30, 0, -6],
    thighL: [34, 0, 8], shinL: [46, 0, 0], footL: [26, 0, 0],
    thighR: [34, 0, -8], shinR: [46, 0, 0], footR: [26, 0, 0], _p: [0, 0.006, 0.006],
  }],
], { grounded: false });

clip('plunge_land', 0.7, false, [
  [0, {
    hips: [14, 0, 0], spine: [16, 0, 0], chest: [8, 0, 0], neck: [-18, 0, 0], head: [-8, 0, 0],
    armR: [-16, 0, -10], foreArmR: [-14, 0, 4], handR: [30, 0, 6],
    armL: [-12, 0, 14], foreArmL: [-18, 0, -4],
    thighL: [-56, 0, 10], shinL: [76, 0, 0], footL: [-14, 0, 0],
    thighR: [22, 0, -12], shinR: [104, 0, 0], footR: [40, 0, 0], _p: [0, -0.11, 0.02],
  }, 'outHard'],
  [0.30, {
    hips: [10, 0, 0], spine: [12, 0, 0], chest: [6, 0, 0], neck: [-14, 0, 0], head: [-6, 0, 0],
    armR: [-14, 0, -12], foreArmR: [-20, 0, 4], handR: [24, 0, 6],
    armL: [-8, 0, 16], foreArmL: [-24, 0, -4],
    thighL: [-46, 0, 9], shinL: [66, 0, 0], footL: [-12, 0, 0],
    thighR: [18, 0, -11], shinR: [96, 0, 0], footR: [36, 0, 0], _p: [0, -0.095, 0.018],
  }, 'smooth'],
  [0.7, guard],
]);

clip('skill', 0.72, false, [
  [0, {
    hips: [0, 16, 0], spine: [4, 12, 3], chest: [2, 14, 5], neck: [-4, -20, 0], head: [-1, -14, 0],
    armR: [-40, -16, 34], foreArmR: [-70, 14, 0], handR: [-8, 0, -6],
    armL: [10, 0, -30], foreArmL: [-50, -24, -6], _p: [0.004, -0.014, 0],
  }, 'outHard'],
  [0.24, {
    hips: [0, -26, 0], spine: [-6, -20, -4], chest: [-4, -22, -6], neck: [6, 34, 0], head: [4, 26, 0],
    armR: [-118, -20, -34], foreArmR: [-24, 6, 4], handR: [-12, 0, 10],
    armL: [-26, 0, 30], foreArmL: [-30, 0, -6], _p: [0.004, 0.012, 0.008],
  }, 'out'],
  [0.72, guard],
]);

clip('burst', 1.9, false, [
  [0, guard, 'out'],
  [0.42, {
    hips: [-4, 0, 0], spine: [-14, 0, 0], chest: [-8, 0, 0], neck: [12, 0, 0], head: [10, 0, 0],
    armR: [-166, -6, -14], foreArmR: [-26, 10, 4], handR: [-10, 0, 8],
    armL: [-160, 6, 16], foreArmL: [-28, -10, -4], handL: [-10, 0, -8],
    thighL: [-8, 0, 5], shinL: [12, 0, 0], footL: [-4, 0, 0],
    thighR: [-8, 0, -5], shinR: [12, 0, 0], footR: [-4, 0, 0], _p: [0, 0.014, -0.014],
  }, 'smooth'],
  [1.05, {
    hips: [-6, 0, 0], spine: [-16, 0, 0], chest: [-9, 0, 0], neck: [14, 0, 0], head: [11, 0, 0],
    armR: [-172, -6, -12], foreArmR: [-18, 10, 4], handR: [-10, 0, 8],
    armL: [-166, 6, 14], foreArmL: [-20, -10, -4], handL: [-10, 0, -8],
    thighL: [-10, 0, 5], shinL: [14, 0, 0], footL: [-4, 0, 0],
    thighR: [-10, 0, -5], shinR: [14, 0, 0], footR: [-4, 0, 0], _p: [0, 0.020, -0.016],
  }, 'outHard'],
  [1.30, {
    hips: [12, 0, 0], spine: [26, 0, 0], chest: [14, 0, 0], neck: [-22, 0, 0], head: [-12, 0, 0],
    armR: [-30, -4, -6], foreArmR: [-6, 4, 2], handR: [6, 0, 4],
    armL: [-26, 4, 8], foreArmL: [-8, -4, -2], handL: [6, 0, -4],
    thighL: [-40, 0, 7], shinL: [56, 0, 0], footL: [-12, 0, 0],
    thighR: [-36, 0, -7], shinR: [52, 0, 0], footR: [-10, 0, 0], _p: [0, -0.070, 0.024],
  }, 'out'],
  [1.9, guard],
]);

clip('hit', 0.38, false, [
  [0, {
    hips: [-8, 4, 0], spine: [-14, -6, 0], chest: [-8, -4, 0], neck: [16, 6, 0], head: [12, 4, 0],
    armR: [16, 0, -34], foreArmR: [-56, 20, 8], armL: [14, 0, -30], foreArmL: [-52, -20, -8],
    thighL: [10, 0, 5], shinL: [16, 0, 0], footL: [-6, 0, 0],
    thighR: [-14, 0, -6], shinR: [24, 0, 0], footR: [8, 0, 0], _p: [0, -0.020, -0.030],
  }, 'outHard'],
  [0.38, Object.assign({ spine: [1, 0, 0], chest: [1, 0, 0], neck: [-1, 0, 0], _p: [0, -0.004, 0] },
    sym({ arm: [4, 0, -8], foreArm: [-18, 6, -4], thigh: [-2, 0, 1], shin: [4, 0, 0], foot: [-1, 0, 0] }))],
]);

clip('death', 1.5, false, [
  [0, {
    hips: [-6, 0, 0], spine: [-10, 0, 0], chest: [-6, 0, 0], neck: [14, 0, 0], head: [10, 0, 0],
    armR: [10, 0, -30], foreArmR: [-40, 16, 8], armL: [10, 0, -26], foreArmL: [-38, -16, -8],
    thighL: [-6, 0, 4], shinL: [14, 0, 0], _p: [0, -0.02, -0.02],
  }, 'out'],
  [0.45, {
    hips: [-26, 6, 0], spine: [-6, 0, 0], chest: [-4, 0, 0], neck: [22, 0, 0], head: [16, 0, 0],
    armR: [26, 0, -46], foreArmR: [-30, 10, 10], armL: [24, 0, -42], foreArmL: [-28, -10, -10],
    thighL: [-40, 0, 10], shinL: [58, 0, 0], thighR: [-20, 0, -8], shinR: [34, 0, 0],
    _p: [0, -0.20, -0.06],
  }, 'in'],
  [1.5, {
    hips: [-84, 8, 0], spine: [-4, 0, 0], chest: [-2, 0, 0], neck: [26, 0, 0], head: [18, 0, 0],
    armR: [30, 0, -58], foreArmR: [-16, 6, 12], armL: [28, 0, -54], foreArmL: [-14, -6, -12],
    thighL: [-16, 0, 12], shinL: [26, 0, 0], footL: [10, 0, 0],
    thighR: [-8, 0, -10], shinR: [16, 0, 0], footR: [12, 0, 0],
    _p: [0, -0.415, -0.10],
  }, 'out'],
], { grounded: false, plant: false });

// ---------------- social / misc (upper-body only clips also work on layer 1)
clip('sit', 3.2, true, [
  [0, {
    hips: [6, 0, 0], spine: [4, 0, 0], chest: [3, 0, 0], neck: [-6, 0, 0], head: [-2, 4, 0],
    armR: [14, 0, -18], foreArmR: [-58, 26, 10], handR: [0, 0, 8],
    armL: [14, 0, -14], foreArmL: [-54, -26, -10], handL: [0, 0, -8],
    thighL: [-78, 26, 34], shinL: [104, 0, 0], footL: [16, 0, 0],
    thighR: [-74, -26, -30], shinR: [110, 0, 0], footR: [14, 0, 0],
    _p: [0, -0.312, 0.014],
  }],
  [1.6, {
    hips: [7, 0, 0], spine: [3, 0, 0], chest: [2, 0, 0], neck: [-5, 0, 0], head: [-1, -3, 0],
    armR: [13, 0, -17], foreArmR: [-56, 26, 10], handR: [0, 0, 8],
    armL: [13, 0, -13], foreArmL: [-52, -26, -10], handL: [0, 0, -8],
    thighL: [-77, 26, 34], shinL: [103, 0, 0], footL: [16, 0, 0],
    thighR: [-73, -26, -30], shinR: [109, 0, 0], footR: [14, 0, 0],
    _p: [0, -0.306, 0.014],
  }],
  [3.2, {
    hips: [6, 0, 0], spine: [4, 0, 0], chest: [3, 0, 0], neck: [-6, 0, 0], head: [-2, 4, 0],
    armR: [14, 0, -18], foreArmR: [-58, 26, 10], handR: [0, 0, 8],
    armL: [14, 0, -14], foreArmL: [-54, -26, -10], handL: [0, 0, -8],
    thighL: [-78, 26, 34], shinL: [104, 0, 0], footL: [16, 0, 0],
    thighR: [-74, -26, -30], shinR: [110, 0, 0], footR: [14, 0, 0],
    _p: [0, -0.312, 0.014],
  }],
], { plant: false });

clip('talk', 3.0, true, [
  [0, { chest: [1, -4, 0], neck: [-2, 4, 0], head: [1, 5, 1], armR: [-16, 0, -22], foreArmR: [-72, 18, 6], handR: [-6, 0, 12], armL: [4, 0, -8], foreArmL: [-22, 6, -4] }],
  [0.9, { chest: [2, 3, 0], neck: [-3, -3, 0], head: [-2, -4, -2], armR: [-34, 0, -14], foreArmR: [-52, 24, 2], handR: [-14, 0, 6], armL: [4, 0, -10], foreArmL: [-26, 6, -4] }],
  [1.8, { chest: [1, -2, 0], neck: [-2, 2, 0], head: [2, 2, 2], armR: [-10, 0, -26], foreArmR: [-80, 14, 8], handR: [-2, 0, 14], armL: [4, 0, -8], foreArmL: [-20, 6, -4] }],
  [3.0, { chest: [1, -4, 0], neck: [-2, 4, 0], head: [1, 5, 1], armR: [-16, 0, -22], foreArmR: [-72, 18, 6], handR: [-6, 0, 12], armL: [4, 0, -8], foreArmL: [-22, 6, -4] }],
]);

clip('wave', 1.5, true, [
  [0, { chest: [0, -7, 0], neck: [0, 7, 0], head: [-2, 8, 5], armR: [-116, -6, -30], foreArmR: [-26, 0, -34], handR: [0, 0, -18], armL: [6, 0, -8], foreArmL: [-24, 6, -4] }],
  [0.38, { chest: [0, -7, 0], neck: [0, 7, 0], head: [-2, 8, 5], armR: [-120, -6, -26], foreArmR: [-30, 0, 22], handR: [0, 0, 16], armL: [6, 0, -8], foreArmL: [-24, 6, -4] }],
  [0.76, { chest: [0, -7, 0], neck: [0, 7, 0], head: [-2, 8, 5], armR: [-116, -6, -30], foreArmR: [-26, 0, -34], handR: [0, 0, -18], armL: [6, 0, -8], foreArmL: [-24, 6, -4] }],
  [1.14, { chest: [0, -7, 0], neck: [0, 7, 0], head: [-2, 8, 5], armR: [-120, -6, -26], foreArmR: [-30, 0, 22], handR: [0, 0, 16], armL: [6, 0, -8], foreArmL: [-24, 6, -4] }],
  [1.5, { chest: [0, -7, 0], neck: [0, 7, 0], head: [-2, 8, 5], armR: [-116, -6, -30], foreArmR: [-26, 0, -34], handR: [0, 0, -18], armL: [6, 0, -8], foreArmL: [-24, 6, -4] }],
]);

clip('point', 1.4, false, [
  [0, { chest: [2, -6, 0], neck: [-2, 6, 0], head: [0, 6, 0], armR: [-16, 0, -20], foreArmR: [-60, 16, 6], armL: [6, 0, -8], foreArmL: [-22, 6, -4] }, 'outHard'],
  [0.22, { chest: [3, -10, 0], neck: [-3, 10, 0], head: [-1, 10, 0], armR: [-82, -10, -6], foreArmR: [-6, 0, 2], handR: [-4, 0, 0], armL: [6, 0, -10], foreArmL: [-26, 6, -4] }, 'out'],
  [1.4, { chest: [3, -9, 0], neck: [-3, 9, 0], head: [-1, 9, 0], armR: [-78, -10, -8], foreArmR: [-8, 0, 2], handR: [-4, 0, 0], armL: [6, 0, -10], foreArmL: [-26, 6, -4] }],
]);

clip('victory', 2.8, true, [
  [0, {
    hips: [-2, 0, 0], spine: [-6, 0, 0], chest: [-4, 0, 0], neck: [8, 0, 0], head: [6, 0, 0],
    armR: [-150, -8, -18], foreArmR: [-30, 12, 6], handR: [-8, 0, 10],
    armL: [-144, 8, 20], foreArmL: [-34, -12, -6], handL: [-8, 0, -10],
    thighL: [-10, 0, 6], shinL: [14, 0, 0], footL: [-6, 0, 0],
    thighR: [8, 0, -8], shinR: [10, 0, 0], footR: [12, 0, 0], _p: [0, 0.006, -0.008],
  }],
  [1.4, {
    hips: [-1, 3, 0], spine: [-5, -2, 0], chest: [-3, -2, 0], neck: [7, 2, 0], head: [5, 4, -2],
    armR: [-158, -8, -12], foreArmR: [-24, 12, 6], handR: [-8, 0, 10],
    armL: [-152, 8, 14], foreArmL: [-28, -12, -6], handL: [-8, 0, -10],
    thighL: [-8, 0, 6], shinL: [12, 0, 0], footL: [-5, 0, 0],
    thighR: [6, 0, -8], shinR: [8, 0, 0], footR: [10, 0, 0], _p: [0.004, 0.012, -0.008],
  }],
  [2.8, {
    hips: [-2, 0, 0], spine: [-6, 0, 0], chest: [-4, 0, 0], neck: [8, 0, 0], head: [6, 0, 0],
    armR: [-150, -8, -18], foreArmR: [-30, 12, 6], handR: [-8, 0, 10],
    armL: [-144, 8, 20], foreArmL: [-34, -12, -6], handL: [-8, 0, -10],
    thighL: [-10, 0, 6], shinL: [14, 0, 0], footL: [-6, 0, 0],
    thighR: [8, 0, -8], shinR: [10, 0, 0], footR: [12, 0, 0], _p: [0, 0.006, -0.008],
  }],
]);

// floating idle (Paimon and other flyers)
clip('fly', 3.4, true, [
  [0, Object.assign({ spine: [3, 0, 0], chest: [2, 0, 1], neck: [-4, 0, 0], head: [-1, 3, 0], _p: [0, 0.010, 0] },
    sym({ arm: [-6, 0, -18], foreArm: [-34, 14, -8], hand: [0, 0, -6], thigh: [-18, 0, 8], shin: [30, 0, 0], foot: [18, 0, 0] }))],
  [0.85, Object.assign({ spine: [1, 2, 0], chest: [1, -1, 1], neck: [-2, 1, 0], head: [1, -2, 1], _p: [0.004, 0.030, 0.004] },
    sym({ arm: [-2, 0, -24], foreArm: [-28, 14, -8], hand: [0, 0, -6], thigh: [-10, 0, 10], shin: [22, 0, 0], foot: [22, 0, 0] }))],
  [1.7, Object.assign({ spine: [3, 0, 0], chest: [2, 0, -1], neck: [-4, 0, 0], head: [-1, 2, -1], _p: [0, 0.048, 0] },
    sym({ arm: [-8, 0, -16], foreArm: [-38, 14, -8], hand: [0, 0, -6], thigh: [-22, 0, 7], shin: [34, 0, 0], foot: [16, 0, 0] }))],
  [2.55, Object.assign({ spine: [1, -2, 0], chest: [1, 1, -1], neck: [-2, -1, 0], head: [1, 2, -1], _p: [-0.004, 0.030, -0.004] },
    sym({ arm: [-2, 0, -22], foreArm: [-30, 14, -8], hand: [0, 0, -6], thigh: [-12, 0, 10], shin: [24, 0, 0], foot: [20, 0, 0] }))],
  [3.4, Object.assign({ spine: [3, 0, 0], chest: [2, 0, 1], neck: [-4, 0, 0], head: [-1, 3, 0], _p: [0, 0.010, 0] },
    sym({ arm: [-6, 0, -18], foreArm: [-34, 14, -8], hand: [0, 0, -6], thigh: [-18, 0, 8], shin: [30, 0, 0], foot: [18, 0, 0] }))],
], { grounded: false });

export const CLIP_NAMES = Object.keys(CLIPS);
export function hasClip(name) { return !!(CLIPS[name] || (ALIAS[name] && CLIPS[ALIAS[name]])); }
