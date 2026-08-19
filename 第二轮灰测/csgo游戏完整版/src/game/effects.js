// ---------------------------------------------------------------------------
// 特效系统：粒子、弹道曳光、弹孔贴花、烟雾云、火焰、爆炸
// 同时对外提供"烟雾是否遮挡视线"，供 Bot 视野与闪光判定使用
// ---------------------------------------------------------------------------

import {
  v3, vadd, vsub, vscale, vnorm, vdist, vlen, clamp, lerp, rnd, rndRange, rndSign,
  vaddScaled, pointSegDist2, vdot, vcross,
} from '../core/math.js';
import { surfaceInfo } from './world.js';

const MAX_PARTICLES = 900;
const MAX_DECALS = 220;

class Particle {
  constructor() { this.alive = false; this.pos = v3(); this.vel = v3(); }
}

export class Effects {
  constructor(world) {
    this.world = world;
    this.particles = [];
    for (let i = 0; i < MAX_PARTICLES; i++) this.particles.push(new Particle());
    this.pi = 0;
    this.decals = [];
    this.decalIdx = 0;
    this.tracers = [];
    this.smokes = [];
    this.fires = [];
    this.lights = [];   // 临时动态光（爆炸/枪焰）
    this.time = 0;
  }

  clear() {
    for (const p of this.particles) p.alive = false;
    this.decals.length = 0;
    this.tracers.length = 0;
    this.smokes.length = 0;
    this.fires.length = 0;
    this.lights.length = 0;
  }

  _alloc() {
    for (let k = 0; k < MAX_PARTICLES; k++) {
      const p = this.particles[this.pi];
      this.pi = (this.pi + 1) % MAX_PARTICLES;
      if (!p.alive) return p;
    }
    const p = this.particles[this.pi];
    this.pi = (this.pi + 1) % MAX_PARTICLES;
    return p;
  }

  /**
   * 通用粒子
   * o: { sprite, pos, vel, size0, size1, color, alpha0, alpha1, life, grav, drag, rot, rotVel, additive, fadeIn }
   */
  spawn(o) {
    const p = this._alloc();
    p.alive = true;
    p.sprite = o.sprite || 'spark';
    p.pos[0] = o.pos[0]; p.pos[1] = o.pos[1]; p.pos[2] = o.pos[2];
    const v = o.vel || [0, 0, 0];
    p.vel[0] = v[0]; p.vel[1] = v[1]; p.vel[2] = v[2];
    p.size0 = o.size0 !== undefined ? o.size0 : 0.1;
    p.size1 = o.size1 !== undefined ? o.size1 : p.size0;
    p.color = o.color || [1, 1, 1];
    p.alpha0 = o.alpha0 !== undefined ? o.alpha0 : 1;
    p.alpha1 = o.alpha1 !== undefined ? o.alpha1 : 0;
    p.life = o.life !== undefined ? o.life : 0.5;
    p.t = 0;
    p.grav = o.grav !== undefined ? o.grav : 0;
    p.drag = o.drag !== undefined ? o.drag : 0.6;
    p.rot = o.rot !== undefined ? o.rot : rnd() * 6.283;
    p.rotVel = o.rotVel !== undefined ? o.rotVel : 0;
    p.additive = !!o.additive;
    p.collide = !!o.collide;
    p.fadeIn = o.fadeIn || 0;
    return p;
  }

  // ------------------------- 具体特效 --------------------------------------

  /** 子弹命中环境：火花 + 碎屑 + 弹孔 */
  impact(point, normal, mat, strong = 1) {
    const info = surfaceInfo(mat);
    const off = vaddScaled(v3(), point, normal, 0.012);
    this.addDecal(info.decal, off, normal, rndRange(0.13, 0.2) * (0.8 + strong * 0.3));
    const n = Math.round(3 + strong * 4);
    const metallic = info.impact === 'hit_metal';
    for (let i = 0; i < n; i++) {
      const dir = vnorm(v3(), [
        normal[0] + rndRange(-0.9, 0.9),
        normal[1] + rndRange(-0.9, 0.9),
        normal[2] + rndRange(-0.9, 0.9),
      ]);
      this.spawn({
        sprite: 'spark', pos: off, vel: vscale(v3(), dir, rndRange(1.5, 6)),
        size0: rndRange(0.02, 0.055), size1: 0.004,
        color: metallic ? [1.6, 1.25, 0.6] : [1.1, 0.85, 0.5],
        alpha0: 1, alpha1: 0, life: rndRange(0.12, 0.3), grav: -9, drag: 1.2, additive: true,
      });
    }
    // 灰尘
    for (let i = 0; i < 3; i++) {
      this.spawn({
        sprite: 'dust', pos: off,
        vel: vscale(v3(), vnorm(v3(), [normal[0] + rndRange(-0.5, 0.5), normal[1] + rndRange(-0.2, 0.6), normal[2] + rndRange(-0.5, 0.5)]), rndRange(0.5, 1.6)),
        size0: rndRange(0.10, 0.2), size1: rndRange(0.35, 0.6),
        color: [0.62, 0.58, 0.5], alpha0: 0.5, alpha1: 0, life: rndRange(0.4, 0.85), grav: -0.6, drag: 2.4,
        rotVel: rndSign() * 1.2,
      });
    }
    this.flashLight(off, [1.0, 0.8, 0.45], 2.2, 0.06);
  }

  /** 命中人体 */
  blood(point, dir, amount = 1) {
    const n = Math.round(4 + amount * 6);
    for (let i = 0; i < n; i++) {
      const d = vnorm(v3(), [dir[0] + rndRange(-0.6, 0.6), dir[1] + rndRange(-0.3, 0.7), dir[2] + rndRange(-0.6, 0.6)]);
      this.spawn({
        sprite: 'blood', pos: point, vel: vscale(v3(), d, rndRange(1.0, 4.5)),
        size0: rndRange(0.05, 0.14), size1: rndRange(0.1, 0.22),
        color: [0.55, 0.045, 0.045], alpha0: 0.95, alpha1: 0, life: rndRange(0.3, 0.7),
        grav: -7, drag: 1.6, rotVel: rndSign() * 3,
      });
    }
    // 地面血迹
    const g = this.world.groundHeight(point[0], point[1] + 0.2, point[2]);
    if (g !== -Infinity && point[1] - g < 2.2) {
      this.addDecal('blood', [point[0] + rndRange(-0.25, 0.25), g + 0.014, point[2] + rndRange(-0.25, 0.25)],
        [0, 1, 0], rndRange(0.35, 0.7), [0.45, 0.04, 0.04, 0.85]);
    }
  }

  /** 枪口焰 */
  muzzle(pos, dir, scale = 1) {
    this.spawn({
      sprite: 'flash', pos, size0: 0.42 * scale, size1: 0.3 * scale,
      color: [2.4, 1.7, 0.85], alpha0: 1, alpha1: 0, life: 0.05, additive: true,
      rot: rnd() * 6.283,
    });
    for (let i = 0; i < 2; i++) {
      this.spawn({
        sprite: 'smoke', pos: vaddScaled(v3(), pos, dir, 0.15),
        vel: vscale(v3(), dir, rndRange(1.5, 3.2)),
        size0: 0.08 * scale, size1: 0.5 * scale, color: [0.5, 0.48, 0.45],
        alpha0: 0.25, alpha1: 0, life: rndRange(0.25, 0.5), grav: 0.4, drag: 3,
        rotVel: rndSign() * 1.5,
      });
    }
    this.flashLight(pos, [1.5, 1.1, 0.6], 5.5, 0.05);
  }

  /** 曳光弹 */
  tracer(from, to, width = 0.02, color = [1.5, 1.1, 0.55]) {
    if (this.tracers.length > 80) this.tracers.shift();
    this.tracers.push({ from: from.slice(), to: to.slice(), t: 0, life: 0.09, width, color });
  }

  /** 弹壳 */
  shell(pos, dir) {
    this.spawn({
      sprite: 'spark', pos, vel: [dir[0] * 2 + rndRange(-1, 1), rndRange(1.4, 2.6), dir[2] * 2 + rndRange(-1, 1)],
      size0: 0.035, size1: 0.03, color: [0.9, 0.72, 0.28], alpha0: 1, alpha1: 0.9,
      life: 0.9, grav: -14, drag: 0.1, rotVel: rndSign() * 14, additive: false,
    });
  }

  addDecal(sprite, pos, normal, size, color) {
    const d = {
      sprite: sprite || 'hole', pos: pos.slice(), normal: normal.slice(),
      size, rot: rnd() * 6.283, color: color || null, t: 0,
    };
    // 用光照近似给贴花预乘亮度，避免在暗处发光
    if (!d.color) {
      const l = clamp(0.35 + 0.65 * Math.max(0, normal[1] * 0.5 + 0.5), 0.25, 1);
      d.color = [l, l, l, 1];
    }
    if (this.decals.length < MAX_DECALS) this.decals.push(d);
    else { this.decals[this.decalIdx] = d; this.decalIdx = (this.decalIdx + 1) % MAX_DECALS; }
  }

  /** 高爆手雷 / C4 爆炸 */
  explosion(pos, radius = 5, power = 1) {
    for (let i = 0; i < Math.round(26 * power); i++) {
      const d = vnorm(v3(), [rndRange(-1, 1), rndRange(-0.2, 1), rndRange(-1, 1)]);
      this.spawn({
        sprite: 'fire', pos: vaddScaled(v3(), pos, d, rndRange(0, radius * 0.35)),
        vel: vscale(v3(), d, rndRange(2, 9) * power),
        size0: rndRange(0.5, 1.4) * power, size1: rndRange(0.1, 0.4),
        color: [2.6, 1.3, 0.35], alpha0: 1, alpha1: 0, life: rndRange(0.2, 0.45),
        grav: 2, drag: 3.5, additive: true, rotVel: rndSign() * 2,
      });
    }
    for (let i = 0; i < Math.round(20 * power); i++) {
      const d = vnorm(v3(), [rndRange(-1, 1), rndRange(-0.1, 1), rndRange(-1, 1)]);
      this.spawn({
        sprite: 'smoke', pos: vaddScaled(v3(), pos, d, rndRange(0, radius * 0.5)),
        vel: vscale(v3(), d, rndRange(1, 5)),
        size0: rndRange(0.6, 1.6), size1: rndRange(2.5, 4.5) * power,
        color: [0.28, 0.26, 0.25], alpha0: 0.75, alpha1: 0, life: rndRange(0.9, 1.9),
        grav: 0.9, drag: 1.8, rotVel: rndSign() * 0.7,
      });
    }
    this.spawn({
      sprite: 'ring', pos, size0: 0.5, size1: radius * 2.1, color: [1.6, 1.2, 0.7],
      alpha0: 0.85, alpha1: 0, life: 0.32, additive: true,
    });
    this.spawn({
      sprite: 'glow', pos, size0: radius * 1.6, size1: 0.4, color: [3, 2, 0.8],
      alpha0: 1, alpha1: 0, life: 0.16, additive: true,
    });
    // 地面焦痕
    const g = this.world.groundHeight(pos[0], pos[1] + 0.5, pos[2]);
    if (g !== -Infinity) this.addDecal('hole', [pos[0], g + 0.015, pos[2]], [0, 1, 0], radius * 0.6, [0.12, 0.10, 0.09, 0.9]);
    this.flashLight(pos, [3, 1.8, 0.7], radius * 3, 0.35);
  }

  /** 闪光弹爆炸的视觉部分 */
  flashbang(pos) {
    this.spawn({ sprite: 'glow', pos, size0: 1, size1: 14, color: [4, 4, 4.4], alpha0: 1, alpha1: 0, life: 0.35, additive: true });
    this.spawn({ sprite: 'ring', pos, size0: 0.5, size1: 9, color: [3, 3, 3.6], alpha0: 1, alpha1: 0, life: 0.3, additive: true });
    for (let i = 0; i < 14; i++) {
      const d = vnorm(v3(), [rndRange(-1, 1), rndRange(-1, 1), rndRange(-1, 1)]);
      this.spawn({
        sprite: 'spark', pos, vel: vscale(v3(), d, rndRange(4, 14)),
        size0: 0.09, size1: 0.01, color: [3, 3, 3.4], alpha0: 1, alpha1: 0, life: 0.22, additive: true, grav: 0,
      });
    }
    this.flashLight(pos, [8, 8, 9], 22, 0.3);
  }

  /** 烟雾弹：一团持续 duration 秒的烟 */
  smokeCloud(pos, radius, duration) {
    const g = this.world.groundHeight(pos[0], pos[1] + 0.4, pos[2]);
    const base = g === -Infinity ? pos[1] : g;
    const s = {
      pos: [pos[0], base + radius * 0.42, pos[2]], radius, duration, t: 0,
      grow: 0.9, puffs: [],
    };
    for (let i = 0; i < 26; i++) {
      const dir = vnorm(v3(), [rndRange(-1, 1), rndRange(-0.55, 0.55), rndRange(-1, 1)]);
      const r = Math.pow(rnd(), 0.55);
      s.puffs.push({
        off: vscale(v3(), dir, r * radius * 0.82),
        size: rndRange(0.55, 1.0) * radius,
        rot: rnd() * 6.283, rotVel: rndSign() * rndRange(0.05, 0.25),
        phase: rnd() * 6.283, delay: rnd() * 0.55,
      });
    }
    this.smokes.push(s);
    return s;
  }

  /** 燃烧弹：一片火 */
  fireArea(pos, radius, duration) {
    const g = this.world.groundHeight(pos[0], pos[1] + 0.6, pos[2]);
    const base = g === -Infinity ? pos[1] : g;
    const f = { pos: [pos[0], base, pos[2]], radius, duration, t: 0, flames: [] };
    for (let i = 0; i < 16; i++) {
      const ang = rnd() * 6.283, r = Math.pow(rnd(), 0.5) * radius * 0.9;
      const px = pos[0] + Math.cos(ang) * r, pz = pos[2] + Math.sin(ang) * r;
      const gy = this.world.groundHeight(px, base + 1.2, pz);
      f.flames.push({
        pos: [px, gy === -Infinity ? base : gy, pz],
        size: rndRange(0.5, 1.1), phase: rnd() * 6.283, speed: rndRange(2.4, 4.2),
      });
    }
    this.fires.push(f);
    return f;
  }

  flashLight(pos, color, radius, life) {
    if (this.lights.length > 6) this.lights.shift();
    this.lights.push({ pos: pos.slice(), color, radius, life, t: 0 });
  }

  // ------------------------- 查询 ------------------------------------------

  /** 线段被烟雾遮挡的程度 0..1 */
  smokeOcclusion(a, b) {
    let occ = 0;
    for (const s of this.smokes) {
      const fade = this._smokeDensity(s);
      if (fade <= 0.02) continue;
      const r = s.radius * Math.min(1, s.t / s.grow) * 0.92;
      const d2 = pointSegDist2(s.pos, a, b);
      if (d2 > r * r) continue;
      // 穿过烟团的弦长近似
      const d = Math.sqrt(d2);
      const chord = 2 * Math.sqrt(Math.max(0, r * r - d * d));
      occ += clamp(chord / (r * 1.2), 0, 1) * fade;
    }
    return clamp(occ, 0, 1);
  }

  _smokeDensity(s) {
    if (s.t < s.grow * 0.35) return clamp(s.t / (s.grow * 0.35), 0, 1);
    const remain = s.duration - s.t;
    if (remain < 1.6) return clamp(remain / 1.6, 0, 1);
    return 1;
  }

  /** 点是否在火里（返回 dps 倍率） */
  fireAt(pos) {
    let d = 0;
    for (const f of this.fires) {
      if (f.t > f.duration) continue;
      const dx = pos[0] - f.pos[0], dz = pos[2] - f.pos[2];
      const dy = pos[1] - f.pos[1];
      if (dy < -0.6 || dy > 1.9) continue;
      const dist = Math.hypot(dx, dz);
      if (dist < f.radius) d = Math.max(d, 1 - dist / f.radius * 0.35);
    }
    return d;
  }

  // ------------------------- 更新与渲染 ------------------------------------

  update(dt) {
    this.time += dt;
    const w = this.world;
    for (const p of this.particles) {
      if (!p.alive) continue;
      p.t += dt;
      if (p.t >= p.life) { p.alive = false; continue; }
      if (p.grav) p.vel[1] += p.grav * dt;
      if (p.drag) {
        const f = Math.exp(-p.drag * dt);
        p.vel[0] *= f; p.vel[1] *= f; p.vel[2] *= f;
      }
      p.pos[0] += p.vel[0] * dt;
      p.pos[1] += p.vel[1] * dt;
      p.pos[2] += p.vel[2] * dt;
      p.rot += p.rotVel * dt;
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.t += dt;
      if (t.t >= t.life) this.tracers.splice(i, 1);
    }
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i];
      s.t += dt;
      if (s.t > s.duration + 1.2) this.smokes.splice(i, 1);
    }
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i];
      f.t += dt;
      if (f.t > f.duration + 0.8) this.fires.splice(i, 1);
    }
    for (let i = this.lights.length - 1; i >= 0; i--) {
      const l = this.lights[i];
      l.t += dt;
      if (l.t >= l.life) this.lights.splice(i, 1);
    }
  }

  render(renderer) {
    // 贴花
    for (const d of this.decals) {
      renderer.drawDecal(d.sprite, d.pos, d.normal, d.size, d.rot, d.color);
    }
    // 粒子
    for (const p of this.particles) {
      if (!p.alive) continue;
      const t = p.t / p.life;
      let a = lerp(p.alpha0, p.alpha1, t);
      if (p.fadeIn && p.t < p.fadeIn) a *= p.t / p.fadeIn;
      const size = lerp(p.size0, p.size1, t);
      renderer.drawSprite(p.sprite, p.pos, size, [p.color[0], p.color[1], p.color[2], a],
        { rot: p.rot, additive: p.additive });
    }
    // 曳光：用两个细长精灵近似（正面 + 侧面）
    for (const tr of this.tracers) {
      const a = 1 - tr.t / tr.life;
      renderer.drawLine(tr.from, tr.to, [tr.color[0], tr.color[1], tr.color[2], a * 0.9]);
      const mid = [(tr.from[0] + tr.to[0]) / 2, (tr.from[1] + tr.to[1]) / 2, (tr.from[2] + tr.to[2]) / 2];
      renderer.drawSprite('glow', mid, 0.10 + a * 0.05, [1.4, 1.0, 0.5, a * 0.55], { additive: true });
    }
    // 烟雾
    for (const s of this.smokes) {
      const dens = this._smokeDensity(s);
      if (dens <= 0.01) continue;
      const grow = Math.min(1, s.t / s.grow);
      for (const p of s.puffs) {
        const local = Math.min(1, Math.max(0, (s.t - p.delay) / s.grow));
        if (local <= 0) continue;
        const wob = Math.sin(this.time * 0.7 + p.phase) * 0.06;
        renderer.drawSprite('smoke', [
          s.pos[0] + p.off[0] * grow, s.pos[1] + p.off[1] * grow + wob, s.pos[2] + p.off[2] * grow,
        ], p.size * (0.35 + 0.75 * local), [0.93, 0.93, 0.95, dens * 0.62],
        { rot: p.rot + this.time * p.rotVel, additive: false });
      }
    }
    // 火焰
    for (const f of this.fires) {
      const fade = f.t > f.duration ? clamp(1 - (f.t - f.duration) / 0.8, 0, 1) : clamp(f.t / 0.4, 0, 1);
      for (const fl of f.flames) {
        const s = fl.size * (0.75 + 0.35 * Math.sin(this.time * fl.speed + fl.phase)) * fade;
        renderer.drawSprite('fire', [fl.pos[0], fl.pos[1] + s * 0.45, fl.pos[2]], s,
          [2.2, 1.0, 0.35, 0.9 * fade], { additive: true });
        renderer.drawSprite('smoke', [fl.pos[0], fl.pos[1] + s * 1.5, fl.pos[2]], s * 1.5,
          [0.2, 0.19, 0.18, 0.35 * fade], { additive: false });
      }
      renderer.drawSprite('glow', [f.pos[0], f.pos[1] + 0.3, f.pos[2]], f.radius * 2.2,
        [1.6, 0.7, 0.25, 0.35 * fade], { additive: true });
    }
  }

  /** 收集给渲染器的动态点光源 */
  collectLights(out) {
    for (const l of this.lights) {
      const k = 1 - l.t / l.life;
      out.push({ pos: l.pos, color: [l.color[0] * k, l.color[1] * k, l.color[2] * k], radius: l.radius, intensity: 1 });
    }
    for (const f of this.fires) {
      if (f.t > f.duration + 0.8) continue;
      const fade = f.t > f.duration ? clamp(1 - (f.t - f.duration) / 0.8, 0, 1) : 1;
      const flick = 0.8 + 0.2 * Math.sin(this.time * 9);
      out.push({ pos: [f.pos[0], f.pos[1] + 0.6, f.pos[2]], color: [1.5, 0.6, 0.2], radius: f.radius * 3.5, intensity: fade * flick });
    }
    return out;
  }
}
