// ============================================================
// fx.js — 招式特效层 / 属性特效层 / 受击闪白 / 濒死消散 / 入场
// 所有特效为逐像素粒子，帧率量化：招式 12fps、属性待机 8fps。
// ============================================================
'use strict';

const FX = {
  init() {
    this.particles = [];
    this.ambient = [];
    this.tls = [];          // 时间轴脚本
    this.perSide = { 0: {}, 1: {} };  // 各侧动画状态
    this.shakeAmp = 0;
    this.shakeT0 = 0;
    this.shakeDur = 0;
    this.view = null;
    this.lastStep = -1;
    this.lastAmbStep = -1;
    // 消散抖动掩码（Bayer 阈值递增）
    this.masks = [];
    for (let level = 1; level <= 16; level++) {
      const c = document.createElement('canvas');
      c.width = 44; c.height = 44;
      const g = c.getContext('2d');
      g.fillStyle = '#fff';
      for (let y = 0; y < 44; y++) {
        for (let x = 0; x < 44; x++) {
          if (bayer4(x, y) < level / 16) g.fillRect(x, y, 1, 1);
        }
      }
      this.masks.push(c);
    }
    return this;
  },
  reset() {
    this.particles.length = 0;
    this.ambient.length = 0;
    this.tls.length = 0;
    this.perSide = { 0: {}, 1: {} };
    this.shakeAmp = 0;
  },
  setView(v) { this.view = v; },

  // ---------- 时间轴 ----------
  run(entries) {
    this.tls.push({ t0: performance.now(), entries: entries.slice().sort((a, b) => a.at - b.at) });
  },
  update(t) {
    const now = performance.now();
    for (const tl of this.tls) {
      for (const e of tl.entries) {
        if (!e.done && now - tl.t0 >= e.at) { e.done = true; e.fn(); }
      }
    }
    this.tls = this.tls.filter((tl) => now - tl.t0 < 2500);
    // 粒子（12fps）
    const step = quantStep(t, 12);
    if (step !== this.lastStep) {
      this.lastStep = step;
      for (const p of this.particles) {
        p.x += p.vx; p.y += p.vy;
        p.vy += p.g || 0;
        p.life--;
        if (p.kind === 'orbit') {
          const ang = now * 0.004 + p.phase;
          p.x = p.ox + Math.cos(ang) * p.radius;
          p.y = p.oy + Math.sin(ang) * p.radius;
        }
      }
      this.particles = this.particles.filter((p) => p.life > 0);
    }
    // 属性待机粒子（8fps）
    const ambStep = quantStep(t, 8);
    if (ambStep !== this.lastAmbStep) {
      this.lastAmbStep = ambStep;
      for (const p of this.ambient) {
        p.x += p.vx; p.y += p.vy; p.life--;
      }
      this.ambient = this.ambient.filter((p) => p.life > 0);
      this.spawnAmbient(now);
    }
  },

  // ---------- 基础发射 ----------
  emit(x, y, vx, vy, life, color, size, kind) {
    this.particles.push({ x, y, vx, vy, life, color, size: size || 1, kind: kind || 'px', g: 0 });
  },
  burst(x, y, colorIdx, n, speed) {
    const rng = Math.random;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + rng() * 0.6;
      const sp = (speed || 2) * (0.5 + rng() * 0.8);
      this.emit(x, y, Math.cos(ang) * sp, Math.sin(ang) * sp - 1, 8 + Math.floor(rng() * 6), colorIdx, 1, 'px');
    }
  },
  shake(amp, dur) {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
    this.shakeT0 = performance.now();
    this.shakeDur = dur;
  },
  shakeOffsets(now) {
    const el = now - this.shakeT0;
    if (el > this.shakeDur || this.shakeAmp <= 0) return { x: 0, y: 0 };
    const a = this.shakeAmp * (1 - el / this.shakeDur);
    const f = Math.floor(el / 40);
    return {
      x: Math.round((hash2(f, 3) * 2 - 1) * a),
      y: Math.round((hash2(f, 7) * 2 - 1) * a),
    };
  },

  // ---------- 属性待机特效层 ----------
  spawnAmbient(now) {
    const v = this.view;
    if (!v) return;
    const emitFor = (types, cx, cy) => {
      for (const t of types) {
        const r = Math.random;
        if (t === '火') {
          this.ambient.push({ x: cx + (r() * 20 - 10), y: cy + r() * 12, vx: 0, vy: -0.7 - r() * 0.6, life: 14, color: r() < 0.5 ? 20 : 22, size: 1 });
        } else if (t === '水') {
          this.ambient.push({ x: cx + (r() * 24 - 12), y: cy + 10, vx: 0, vy: -0.5 - r() * 0.4, life: 16, color: 25, size: 1 });
        } else if (t === '草') {
          this.ambient.push({ x: cx + (r() * 26 - 13), y: cy + 6, vx: r() * 0.8 - 0.4, vy: 0.5 + r() * 0.4, life: 12, color: r() < 0.5 ? 17 : 18, size: 1 });
        } else if (t === '电') {
          this.ambient.push({ x: cx + (r() * 30 - 15), y: cy + r() * 14 - 7, vx: 0, vy: 0, life: 6, color: 20, size: 1 });
        } else if (t === '超能') {
          this.ambient.push({ x: cx + (r() * 26 - 13), y: cy + r() * 10 - 5, vx: 0, vy: 0, life: 10, color: r() < 0.5 ? 27 : 30, size: 1 });
        } else if (t === '岩' || t === '地面') {
          this.ambient.push({ x: cx + (r() * 26 - 13), y: cy + 14, vx: r() * 0.6 - 0.3, vy: -0.4 - r() * 0.4, life: 9, color: 10, size: 1 });
        }
      }
    };
    emitFor(v.rivalTypes || [], v.rx, v.ry + 10);
    emitFor(v.playerTypes || [], v.px, v.py - 4);
  },

  // ---------- 招式特效（事件驱动）----------
  moveFXspec(moveId) {
    const spec = MOVE_FX[moveId] || { kind: 'strike' };
    const move = MOVES[moveId] || MOVES.struggle;
    if (!spec.color) spec.color = TYPE_FX_COLOR[move.type] || [30, 31];
    return spec;
  },

  playMove(side, moveId, move) {
    const v = this.view;
    if (!v) return;
    const spec = this.moveFXspec(moveId);
    const attacker = side === 0
      ? { mx: v.px + 6, my: v.py - 22, cx: v.px, cy: v.py - 12, feet: { x: v.px, y: v.py } }
      : { mx: v.rx - 6, my: v.ry - 18, cx: v.rx, cy: v.ry - 10, feet: { x: v.rx, y: v.ry } };
    const target = side === 0
      ? { cx: v.rx, cy: v.ry - 10, feet: { x: v.rx, y: v.ry } }
      : { cx: v.px, cy: v.py - 12, feet: { x: v.px, y: v.py } };
    const dir = side === 0 ? 1 : -1; // 玩家朝右，对手朝左
    const st = this.perSide[side];

    if (spec.kind === 'strike' || spec.kind === 'dash') {
      const dash = spec.kind === 'dash';
      st.lunge = { t0: performance.now(), dur: dash ? 260 : 300, dx: dir * (dash ? 14 : 7), dy: dash ? -3 : -2 };
      const contactAt = dash ? 160 : 200;
      this.run([
        { at: contactAt, fn: () => { this.impact(target, spec, 2); } },
        { at: 0, fn: () => {} },
      ]);
    } else if (spec.kind === 'proj') {
      this.run([
        { at: 0, fn: () => { this.projectile(attacker, target, spec); } },
        { at: 330, fn: () => { this.impact(target, spec, 2); } },
      ]);
    } else if (spec.kind === 'beam') {
      st.beam = { t0: performance.now(), dur: 320, from: { x: attacker.mx, y: attacker.my }, to: { x: target.cx, y: target.cy }, color: spec.color };
      this.run([{ at: 330, fn: () => { this.impact(target, spec, 3); } }]);
    } else if (spec.kind === 'wave') {
      for (let i = 0; i < 3; i++) {
        this.run([{ at: i * 110, fn: () => { this.wave(attacker, target, spec, i); } }]);
      }
      this.run([{ at: 340, fn: () => { this.impact(target, spec, 2); } }]);
    } else if (spec.kind === 'fall') {
      const n = 3;
      for (let i = 0; i < n; i++) {
        this.run([{ at: i * 100, fn: () => { this.rock(target, spec, i === n - 1); } }]);
      }
    } else if (spec.kind === 'ground') {
      this.shake(4, 460);
      this.run([
        { at: 0, fn: () => { this.cracks(target); } },
        { at: 240, fn: () => { this.impact(target, spec, 3); } },
      ]);
    } else if (spec.kind === 'pulse') {
      st.rings = { t0: performance.now(), dur: 420, cx: target.cx, cy: target.cy, color: spec.color };
      this.run([{ at: 280, fn: () => { this.impact(target, spec, 2); } }]);
    } else if (spec.kind === 'selfAura') {
      st.selfAura = { t0: performance.now(), dur: 480, cx: attacker.cx, cy: attacker.cy - 6, color: spec.color };
      Sfx.statUp();
    } else if (spec.kind === 'statusAura') {
      st.rings = { t0: performance.now(), dur: 460, cx: target.cx, cy: target.cy, color: spec.color };
      st.sparkles = { t0: performance.now(), dur: 460, from: attacker.mx, fromY: attacker.my, to: target.cx, toY: target.cy, color: spec.color };
    } else if (spec.kind === 'weatherFX') {
      st.weatherFX = { t0: performance.now(), dur: 700, color: spec.color };
      Sfx.weather();
    } else if (spec.kind === 'terrainFX') {
      st.terrainFX = { t0: performance.now(), dur: 700, color: spec.color };
      Sfx.statUp();
    }
  },

  projectile(a, t, spec) {
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      this.run([{
        at: k * 300,
        fn: (() => {
          const tt = k;
          return () => {
            const bx = a.mx + (t.cx - a.mx) * tt;
            const by = a.my + (t.cy - a.my) * tt - Math.sin(tt * Math.PI) * 26;
            this.burst(bx, by, spec.color[0], 3, 1.2);
            this.emit(bx, by, 0, 0, 3, spec.color[1] || spec.color[0], 2, 'px');
          };
        })(),
      }]);
    }
  },

  impact(t, spec, power) {
    this.burst(t.cx, t.cy, spec.color[0], 8 + power * 3, 2.6);
    if (spec.color[1]) this.burst(t.cx, t.cy, spec.color[1], 6, 1.8);
    this.shake(power + 1, 260);
    Sfx.hit();
  },

  wave(a, t, spec, i) {
    const color = spec.color[i % spec.color.length];
    for (let j = 0; j < 10; j++) {
      this.run([{
        at: j * 26,
        fn: () => {
          const k = (i * 0.33 + j * 0.09) % 1;
          const bx = a.mx + (t.cx - a.mx) * k;
          const by = a.my + (t.cy - a.my) * k + 6;
          this.emit(bx, by, 0, -0.5, 5, color, 1, 'px');
          this.emit(bx + 2, by + 2, 0, 0, 4, color, 1, 'px');
        },
      }]);
    }
  },

  rock(t, spec, big) {
    const n = 1;
    const x = t.cx + (Math.random() * 16 - 8);
    this.particles.push({ kind: 'fallrock', x, y: -10, vx: 0, vy: 3.2, life: 40, color: spec.color[0], size: big ? 2 : 1, g: 0.4 });
    this.run([{ at: 320, fn: () => {
      this.burst(x, t.cy - 4, spec.color[0], big ? 10 : 5, 2);
      this.shake(big ? 3 : 1, 200);
      if (big) Sfx.superHit();
    } }]);
  },

  cracks(t) {
    const g = this;
    for (let i = 0; i < 6; i++) {
      this.particles.push({ kind: 'crack', x: t.feet.x + (Math.random() * 30 - 15), y: t.feet.y + 2, vx: 0, vy: 0, life: 26, color: 13, size: 1 });
    }
  },

  // ---------- 受击 / 濒死 / 入场 ----------
  hitFlash(side, power) {
    this.perSide[side].flash = { t0: performance.now(), dur: 220 };
    this.perSide[side].recoil = {
      t0: performance.now(), dur: 260,
      dx: side === 0 ? -4 : 4, dy: side === 0 ? 2 : -2,
    };
    this.shake(power >= 2 ? 2 : 1, 200);
  },

  faint(side) {
    this.perSide[side].faint = { t0: performance.now(), dur: 950 };
    this.perSide[side].flash = { t0: performance.now(), dur: 260 };
    Sfx.faintEnemy();
  },

  entry(side) {
    this.perSide[side].entry = { t0: performance.now(), dur: 640 };
    const v = this.view;
    if (v) {
      const feet = side === 0 ? { x: v.px, y: v.py } : { x: v.rx, y: v.ry };
      for (let i = 0; i < 6; i++) {
        this.emit(feet.x + (Math.random() * 24 - 12), feet.y, Math.random() * 1.6 - 0.8, -0.8 - Math.random(), 10, 10, 1);
      }
    }
  },

  // 精灵变换查询（游戏绘制精灵时调用）
  spriteTransform(side, t, now) {
    const st = this.perSide[side];
    let dx = 0, dy = 0, white = false, mask = null, alpha = 1;
    if (st.entry) {
      const el = now - st.entry.t0;
      if (el < st.entry.dur) {
        const k = 1 - el / st.entry.dur;
        const kk = k * k;
        dx += side === 0 ? 0 : Math.round(70 * kk);
        dy += side === 0 ? Math.round(40 * kk) : 0;
      } else {
        st.entry = null;
      }
    }
    if (st.lunge) {
      const el = now - st.lunge.t0;
      if (el < st.lunge.dur) {
        const k = Math.sin((el / st.lunge.dur) * Math.PI);
        dx += Math.round(st.lunge.dx * k);
        dy += Math.round(st.lunge.dy * k);
      } else st.lunge = null;
    }
    if (st.recoil) {
      const el = now - st.recoil.t0;
      if (el < st.recoil.dur) {
        const k = Math.sin((el / st.recoil.dur) * Math.PI);
        dx += Math.round(st.recoil.dx * k);
        dy += Math.round(st.recoil.dy * k);
      } else st.recoil = null;
    }
    if (st.faint) {
      const el = now - st.faint.t0;
      if (el < st.faint.dur) {
        if (el > 220) {
          const k = (el - 220) / (st.faint.dur - 220);
          dy += Math.round(k * 26);
          const maskIdx = Math.min(15, Math.floor(k * 20));
          mask = this.masks[maskIdx];
        }
        white = true;
      } else {
        st.faint = null;
        return { hidden: true };
      }
    }
    if (st.flash) {
      const el = now - st.flash.t0;
      if (el < st.flash.dur) {
        white = true;
      } else st.flash = null;
    }
    return { dx, dy, white, mask, hidden: false };
  },

  // ---------- 绘制 ----------
  draw(ctx, t) {
    const now = performance.now();
    const v = this.view;
    // 光束
    for (const side of [0, 1]) {
      const st = this.perSide[side];
      if (st && st.beam) {
        const el = now - st.beam.t0;
        if (el < st.beam.dur) {
          const { from, to, color } = st.beam;
          const flick = Math.floor(el / 40) % 2;
          const col = color[flick];
          for (let k = 0; k <= 1; k += 0.06) {
            const bx = from.x + (to.x - from.x) * k;
            const by = from.y + (to.y - from.y) * k;
            const jx = Math.floor((hash2(Math.floor(bx), Math.floor(now / 30), 4) - 0.5) * 3);
            const jy = Math.floor((hash2(Math.floor(bx), Math.floor(now / 30), 9) - 0.5) * 3);
            px(ctx, bx + jx, by + jy, col);
            px(ctx, bx + jx + 1, by + jy, color[1] || col);
          }
        } else st.beam = null;
      }
      if (st && st.rings) {
        const el = now - st.rings.t0;
        if (el < st.rings.dur) {
          const k = el / st.rings.dur;
          for (let ring = 0; ring < 3; ring++) {
            const rk = (k * 3 - ring);
            if (rk >= 0 && rk < 1) {
              const r = 4 + rk * 20;
              const col = st.rings.color[ring % st.rings.color.length];
              for (let a = 0; a < Math.PI * 2; a += 0.5) {
                px(ctx, st.rings.cx + Math.cos(a) * r, st.rings.cy + Math.sin(a) * r * 0.8, col);
              }
            }
          }
        } else st.rings = null;
      }
      if (st && st.sparkles) {
        const el = now - st.sparkles.t0;
        if (el < st.sparkles.dur) {
          for (let i = 0; i < 5; i++) {
            const k = ((el / 80 + i * 0.23) % 1);
            const sx = st.sparkles.from + (st.sparkles.to - st.sparkles.from) * k;
            const sy = st.sparkles.fromY + (st.sparkles.toY - st.sparkles.fromY) * k;
            px(ctx, sx + Math.sin(k * 9) * 3, sy, st.sparkles.color[i % st.sparkles.color.length]);
          }
        } else st.sparkles = null;
      }
      if (st && st.selfAura) {
        const el = now - st.selfAura.t0;
        if (el < st.selfAura.dur) {
          for (let i = 0; i < 6; i++) {
            const k = ((el / 100 + i * 0.17) % 1);
            const sx = st.selfAura.cx + Math.sin(i * 2.1) * 10;
            const sy = st.selfAura.cy + 8 - k * 18;
            px(ctx, sx, sy, st.selfAura.color[i % st.selfAura.color.length]);
          }
        } else st.selfAura = null;
      }
      if (st && st.weatherFX) {
        const el = now - st.weatherFX.t0;
        if (el < st.weatherFX.dur) {
          const k = el / st.weatherFX.dur;
          const cx = 380, cy = 40;
          for (let ring = 0; ring < 4; ring++) {
            const rk = k * 4 - ring;
            if (rk >= 0 && rk < 1) {
              const r = 6 + rk * 34;
              const col = st.weatherFX.color[ring % st.weatherFX.color.length];
              for (let a = 0; a < Math.PI * 2; a += 0.4) {
                px(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r, col);
              }
            }
          }
        } else st.weatherFX = null;
      }
      if (st && st.terrainFX) {
        const el = now - st.terrainFX.t0;
        if (el < st.terrainFX.dur) {
          const k = el / st.terrainFX.dur;
          for (let i = 0; i < 8; i++) {
            const x = 30 + i * 50 + Math.sin(now / 100 + i) * 8;
            const y = HORIZON + 10 + ((now / 30 + i * 40) % 130);
            px(ctx, x, y, st.terrainFX.color[0]);
          }
        } else st.terrainFX = null;
      }
    }
    // 粒子
    for (const p of this.particles) {
      const x = Math.round(p.x), y = Math.round(p.y);
      if (p.kind === 'fallrock') {
        px(ctx, x, y, p.color);
        px(ctx, x + p.size, y, 13);
      } else if (p.kind === 'crack') {
        const len = 3 + (p.life % 4);
        hline(ctx, x, y, len, p.color);
      } else if (p.size > 1) {
        ctx.fillStyle = PAL[p.color];
        ctx.fillRect(x, y, p.size, p.size);
      } else {
        px(ctx, x, y, p.color);
      }
    }
    // 属性待机粒子
    for (const p of this.ambient) {
      px(ctx, Math.round(p.x), Math.round(p.y), p.color);
    }
    // 天气闪电弧（沙暴 / 雨天偶尔）
    if (v && v.weather === '沙暴' && Math.floor(now / 900) % 7 === 0) {
      const x = 60 + (now % 300);
      line(ctx, x, 10, x + 8, 26, 20);
    }
  },
};

// 招式 -> 特效类型
const MOVE_FX = {
  tackle: { kind: 'strike' },
  quickattack: { kind: 'dash' },
  ember: { kind: 'proj', color: [20, 22] },
  firepunch: { kind: 'strike', color: [22, 23] },
  flamethrower: { kind: 'beam', color: [20, 22, 23] },
  sunnyday: { kind: 'weatherFX', color: [20, 21] },
  watergun: { kind: 'proj', color: [25, 26] },
  icebeam: { kind: 'beam', color: [6, 7, 30] },
  surf: { kind: 'wave', color: [25, 26, 7] },
  raindance: { kind: 'weatherFX', color: [25, 26] },
  razorleaf: { kind: 'proj', color: [17, 18] },
  energyball: { kind: 'proj', color: [17, 19] },
  leechseed: { kind: 'statusAura', color: [17, 18] },
  toxic: { kind: 'statusAura', color: [28, 29] },
  thundershock: { kind: 'proj', color: [20] },
  thunderbolt: { kind: 'beam', color: [20, 30] },
  thunderwave: { kind: 'statusAura', color: [20, 30] },
  eterrain: { kind: 'terrainFX', color: [20] },
  psychic: { kind: 'pulse', color: [27, 28, 30] },
  shadowball: { kind: 'proj', color: [28, 29] },
  hypnosis: { kind: 'statusAura', color: [27, 28, 30] },
  calmind: { kind: 'selfAura', color: [27, 28, 30] },
  rockslide: { kind: 'fall', color: [11, 12] },
  earthquake: { kind: 'ground', color: [11, 12] },
  swordsdance: { kind: 'selfAura', color: [31, 30] },
  sandstorm: { kind: 'weatherFX', color: [10, 11] },
  struggle: { kind: 'strike' },
};

// 属性 -> 粒子颜色
const TYPE_FX_COLOR = {
  '一般': [30, 31], '火': [22, 23], '水': [25, 26], '草': [17, 18], '电': [20, 30],
  '冰': [6, 7], '格斗': [22, 30], '毒': [28, 29], '地面': [11, 12], '飞行': [7, 30],
  '超能': [27, 28], '虫': [18, 19], '岩': [11, 12], '幽灵': [28, 29], '龙': [24, 21],
  '恶': [2, 29], '钢': [31, 30], '妖精': [27, 30],
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FX, MOVE_FX, TYPE_FX_COLOR };
}
