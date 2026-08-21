/**
 * transformer.js —— 变形控制器
 *
 * 单一进度量 progress∈[0,1] 驱动全身：0=机器人，1=卡车。
 * 每个关节有自己的时间窗口 phase=[a,b]，于是各部位错峰启动/收尾 —— 这是"变形"而不是"整体插值"的关键。
 * GUI 编辑的就是这里的 r0/p0（机器人态）与 r1/p1（载具态），因此参数面板与动画共用同一份数据。
 */
import * as THREE from 'three';
import { ROBOT_POSE, VEHICLE_POSE, PRESETS } from './poses.js';

const RAD = Math.PI / 180;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export const EASINGS = {
  linear: (t) => t,
  cubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  quint: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
  back: (t) => {
    const c = 1.70158, c2 = c * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  },
  bounce: (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
  snap: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
};

export class Transformer {
  constructor(rig, M) {
    this.rig = rig;
    this.M = M;
    this.progress = 0;
    this.target = 0;
    this.speed = 0.55;          // 每秒进度
    this.easing = 'cubic';
    this.phaseSpread = 1.0;     // 0=全身同步，1=完整错峰
    this.flourish = 1.0;        // 腾空/抖动特效强度
    this.auto = false;
    this.autoHold = 1.4;
    this._hold = 0;
    this._tw = null;
    this.onModeChange = null;
    this._mode = 'robot';
    this.slots = [];
    this.map = {};
    this.build();
    this.apply();
  }

  /* ---------- 由「注册表 + 姿势数据」编出运行期姿势表 ---------- */
  build() {
    this.slots = [];
    this.map = {};
    for (const name of Object.keys(this.rig.joints)) {
      const j = this.rig.joints[name];
      const R = ROBOT_POSE[name] || {};
      const V = VEHICLE_POSE[name] || {};
      const p0 = (R.p || j.base.toArray()).slice();
      const r0 = (R.r || [0, 0, 0]).slice();
      const s0 = R.s ?? 1;
      const g0 = R.g ?? 0;
      const slot = {
        name, label: j.label, group: j.group, obj: j.obj,
        base: j.base.toArray(),
        p0, r0, s0, g0,
        p1: (V.p || p0).slice(), r1: (V.r || r0).slice(), s1: V.s ?? s0, g1: V.g ?? g0,
        phase: (V.phase || [0, 1]).slice(),
        hasGrip: !!j.obj.userData.fingers,
        _pa: new THREE.Vector3(), _pb: new THREE.Vector3(),
        _ea: new THREE.Euler(), _eb: new THREE.Euler(),
        _qa: new THREE.Quaternion(), _qb: new THREE.Quaternion(),
      };
      this.slots.push(slot);
      this.map[name] = slot;
    }
    return this;
  }

  get ease() { return EASINGS[this.easing] || EASINGS.cubic; }

  /** 关节局部时间（含错峰压缩） */
  localT(slot) {
    const k = this.phaseSpread;
    const a = slot.phase[0] * k;
    const b = 1 - (1 - slot.phase[1]) * k;
    if (b - a < 1e-5) return this.progress >= b ? 1 : 0;
    return this.ease(clamp01((this.progress - a) / (b - a)));
  }

  /* ---------- 把姿势写进 Object3D ---------- */
  apply() {
    for (const s of this.slots) {
      const t = this.localT(s);
      const o = s.obj;
      if (t <= 0) {
        o.position.fromArray(s.p0);
        s._ea.set(s.r0[0] * RAD, s.r0[1] * RAD, s.r0[2] * RAD);
        o.quaternion.setFromEuler(s._ea);
        o.scale.setScalar(s.s0);
        if (s.hasGrip) setGrip(o, s.g0);
      } else if (t >= 1) {
        o.position.fromArray(s.p1);
        s._eb.set(s.r1[0] * RAD, s.r1[1] * RAD, s.r1[2] * RAD);
        o.quaternion.setFromEuler(s._eb);
        o.scale.setScalar(s.s1);
        if (s.hasGrip) setGrip(o, s.g1);
      } else {
        o.position.lerpVectors(s._pa.fromArray(s.p0), s._pb.fromArray(s.p1), t);
        s._ea.set(s.r0[0] * RAD, s.r0[1] * RAD, s.r0[2] * RAD);
        s._eb.set(s.r1[0] * RAD, s.r1[1] * RAD, s.r1[2] * RAD);
        o.quaternion.slerpQuaternions(s._qa.setFromEuler(s._ea), s._qb.setFromEuler(s._eb), t);
        o.scale.setScalar(s.s0 + (s.s1 - s.s0) * t);
        if (s.hasGrip) setGrip(o, s.g0 + (s.g1 - s.g0) * t);
      }
    }
    /* 变形腾空 + 机械抖动 */
    const m = Math.sin(Math.PI * clamp01(this.progress));
    const f = this.flourish;
    const lift = this.rig.lift;
    lift.position.y = m * 0.42 * f;
    lift.position.x = (Math.random() - 0.5) * 0.02 * m * f;
    lift.position.z = (Math.random() - 0.5) * 0.02 * m * f;
    lift.rotation.y = Math.sin(this.progress * Math.PI * 2) * 0.06 * f;
    lift.rotation.z = 0;

    /* 眼睛/能量脉冲 */
    const veh = clamp01(this.progress);
    this.M.glow.emissiveIntensity = 2.6 * (1 - veh) + 0.25 + m * 3.2;
    const pulse = m * m * 0.5;
    for (const mat of this.M.paint) mat.emissive.copy(this.M.glow.emissive).multiplyScalar(pulse * 0.5);
    this.M.metal.emissive.copy(this.M.glow.emissive).multiplyScalar(pulse * 0.35);
    return this;
  }

  /* ---------- 时间推进 ---------- */
  update(dt) {
    const prev = this.progress;
    if (this.auto) {
      if (Math.abs(this.progress - this.target) < 1e-4) {
        this._hold += dt;
        if (this._hold > this.autoHold) { this._hold = 0; this.target = this.target > 0.5 ? 0 : 1; }
      } else this._hold = 0;
    }
    const d = this.target - this.progress;
    if (Math.abs(d) > 1e-5) {
      const step = this.speed * dt;
      this.progress = Math.abs(d) <= step ? this.target : this.progress + Math.sign(d) * step;
    }
    if (this._tw) this._tickTween(dt);
    this.apply();

    const mode = this.progress <= 0.001 ? 'robot' : this.progress >= 0.999 ? 'vehicle' : 'morph';
    if (mode !== this._mode) {
      this._mode = mode;
      this.onModeChange?.(mode, prev);
    }
    return this;
  }

  get mode() { return this._mode; }
  get vehicleW() { return clamp01(this.progress); }
  get robotW() { return 1 - clamp01(this.progress); }
  toggle() { this.target = this.target > 0.5 ? 0 : 1; return this.target; }
  setTarget(v) { this.target = clamp01(v); }
  setProgress(v) { this.progress = this.target = clamp01(v); this.apply(); }

  /* ---------- 预设姿势（带补间） ---------- */
  applyPreset(id, dur = 0.5) {
    const preset = PRESETS.find((p) => p.id === id) || PRESETS[0];
    const from = [], to = [];
    for (const s of this.slots) {
      const R = ROBOT_POSE[s.name] || {};
      const P = preset.pose[s.name] || {};
      from.push({ p: s.p0.slice(), r: s.r0.slice(), s: s.s0, g: s.g0 });
      to.push({
        p: (P.p || R.p || s.base).slice(),
        r: (P.r || R.r || [0, 0, 0]).slice(),
        s: P.s ?? R.s ?? 1,
        g: P.g ?? R.g ?? 0,
      });
    }
    this._tw = { t: 0, dur: Math.max(0.001, dur), from, to };
    this.presetId = preset.id;
    return preset;
  }

  _tickTween(dt) {
    const tw = this._tw;
    tw.t = Math.min(1, tw.t + dt / tw.dur);
    const e = EASINGS.cubic(tw.t);
    this.slots.forEach((s, i) => {
      const a = tw.from[i], b = tw.to[i];
      for (let k = 0; k < 3; k++) {
        s.p0[k] = a.p[k] + (b.p[k] - a.p[k]) * e;
        s.r0[k] = a.r[k] + (b.r[k] - a.r[k]) * e;
      }
      s.s0 = a.s + (b.s - a.s) * e;
      s.g0 = a.g + (b.g - a.g) * e;
    });
    if (tw.t >= 1) { this._tw = null; this.onPoseTweenEnd?.(); }
  }

  /** 左右镜像（把左侧关节参数镜像到右侧） */
  mirrorLR(fromLeft = true) {
    const src = fromLeft ? 'L' : 'R';
    const dst = fromLeft ? 'R' : 'L';
    for (const s of this.slots) {
      if (!s.name.endsWith(src) && !/[LR][12]?$/.test(s.name)) continue;
      const other = this.map[s.name.replace(new RegExp(src + '(\\d?)$'), dst + '$1')];
      if (!other || other === s) continue;
      other.r0 = [s.r0[0], -s.r0[1], -s.r0[2]];
      other.p0 = [-s.p0[0], s.p0[1], s.p0[2]];
      other.g0 = s.g0;
    }
    this.apply();
  }

  /** 随机姿势（在合理范围内扰动，保证不至于自穿模到离谱） */
  randomPose(amount = 1) {
    const rnd = (a) => (Math.random() * 2 - 1) * a * amount;
    const set = (n, r) => { const s = this.map[n]; if (s) s.r0 = r; };
    set('waist', [0, rnd(22), 0]);
    set('chest', [rnd(10), rnd(8), rnd(6)]);
    set('neck', [0, 0, 0]);
    set('head', [rnd(16), rnd(30), rnd(8)]);
    for (const t of ['L', 'R']) {
      const sgn = t === 'L' ? -1 : 1;
      set(`shoulder${t}`, [rnd(70) - 20, rnd(20), sgn * (8 + Math.random() * 45)]);
      set(`elbow${t}`, [-Math.random() * 105, 0, 0]);
      set(`wrist${t}`, [rnd(18), rnd(18), rnd(18)]);
      set(`hip${t}`, [rnd(26), rnd(12), sgn * (2 + Math.random() * 8)]);
      set(`knee${t}`, [Math.random() * 42, 0, 0]);
      set(`ankle${t}`, [-Math.random() * 22, 0, sgn * -4]);
      const h = this.map[`hand${t}`]; if (h) h.g0 = Math.random();
    }
    const c = this.map.core;
    if (c) c.p0 = [0, this.rig.D.coreY - Math.random() * 0.22, 0];
    this.apply();
  }

  /* ---------- 序列化 ---------- */
  toJSON() {
    const o = { format: 'optimus-rig-pose@1', progress: this.progress, joints: {} };
    for (const s of this.slots) {
      o.joints[s.name] = {
        r0: s.r0.map(r3), p0: s.p0.map(r3), s0: r3(s.s0), g0: r3(s.g0),
        r1: s.r1.map(r3), p1: s.p1.map(r3), s1: r3(s.s1), g1: r3(s.g1),
        phase: s.phase.map(r3),
      };
    }
    return o;
  }

  fromJSON(data) {
    if (!data || !data.joints) throw new Error('姿势文件格式不正确');
    for (const [name, v] of Object.entries(data.joints)) {
      const s = this.map[name];
      if (!s) continue;
      if (v.r0) s.r0 = v.r0.slice(0, 3);
      if (v.p0) s.p0 = v.p0.slice(0, 3);
      if (v.s0 != null) s.s0 = v.s0;
      if (v.g0 != null) s.g0 = v.g0;
      if (v.r1) s.r1 = v.r1.slice(0, 3);
      if (v.p1) s.p1 = v.p1.slice(0, 3);
      if (v.s1 != null) s.s1 = v.s1;
      if (v.g1 != null) s.g1 = v.g1;
      if (v.phase) s.phase = v.phase.slice(0, 2);
    }
    if (typeof data.progress === 'number') this.setProgress(data.progress);
    this.apply();
    return this;
  }

  resetJoint(name, which = 0) {
    const s = this.map[name];
    if (!s) return;
    const R = ROBOT_POSE[name] || {};
    const V = VEHICLE_POSE[name] || {};
    if (which === 0) {
      s.r0 = (R.r || [0, 0, 0]).slice();
      s.p0 = (R.p || s.base).slice();
      s.s0 = R.s ?? 1; s.g0 = R.g ?? 0;
    } else {
      s.r1 = (V.r || s.r0).slice();
      s.p1 = (V.p || s.p0).slice();
      s.s1 = V.s ?? s.s0; s.g1 = V.g ?? s.g0;
      s.phase = (V.phase || [0, 1]).slice();
    }
    this.apply();
  }

  resetAll() {
    this.build();
    this.presetId = 'stand';
    this.apply();
  }
}

const r3 = (v) => Math.round(v * 1000) / 1000;

/** 手指握拳 */
function setGrip(hand, g) {
  const { fingers, thumb, side } = hand.userData;
  if (!fingers) return;
  for (let i = 0; i < fingers.length; i++) {
    const f = fingers[i];
    f.rotation.x = -g * (1.15 + i * 0.06);
    if (f.userData.tip) f.userData.tip.rotation.x = -g * 1.5;
  }
  if (thumb) {
    thumb.rotation.x = -g * 0.55;
    thumb.rotation.z = -side * g * 0.85;
  }
}
