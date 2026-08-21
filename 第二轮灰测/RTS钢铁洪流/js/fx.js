/* ===================================================================
   fx.js — 特效与贴花系统（爆炸 / 曳光 / 烟 / 残骸 / 弹坑 / 飘字）

   两类东西分开管：
     · 贴花 decals —— 弹坑、履带印、残骸、尸体。生命期很长（或永久），
       画在地形层之上、单位层之下，数量到上限就顶掉最旧的。
     · 粒子 parts —— 火花、烟、碎片、曳光。短命、每帧更新。
   都用**定长环形数组**，避免战斗高峰期频繁分配导致 GC 卡顿。
   =================================================================== */
(function () {
  'use strict';
  const R = window.R;
  const U = R.U;

  const CAP = {
    parts: 1400,
    decals: 900,
    texts: 90,
    tracers: 260,
  };

  /* 粒子类型 */
  const P_SPARK = 0, P_SMOKE = 1, P_FIRE = 2, P_DEBRIS = 3, P_RING = 4, P_FLASH = 5, P_DUST = 6;
  /* 贴花类型 */
  const D_CRATER = 0, D_SCORCH = 1, D_WRECK = 2, D_CORPSE = 3, D_RUBBLE = 4;

  R.FXTYPE = { P_SPARK, P_SMOKE, P_FIRE, P_DEBRIS, P_RING, P_FLASH, P_DUST, D_CRATER, D_SCORCH, D_WRECK, D_CORPSE, D_RUBBLE };

  R.FX = class FX {
    constructor(seed) {
      this.rnd = R.rng(seed || 777);
      this.parts = [];
      this.decals = [];
      this.texts = [];
      this.tracers = [];
      this.quality = 1;          // 0.5 / 1 / 1.5 —— 性能不足时下调
      this.shake = 0;            // 屏幕震动强度（像素）
      this.shakeT = 0;
      this.flash = 0;            // 全屏白闪 0..1
      for (let i = 0; i < CAP.parts; i++) this.parts.push({ live: false });
      this._pi = 0;
      for (let i = 0; i < CAP.tracers; i++) this.tracers.push({ live: false });
      this._ti = 0;
    }

    clear() {
      for (const p of this.parts) p.live = false;
      for (const t of this.tracers) t.live = false;
      this.decals.length = 0;
      this.texts.length = 0;
      this.shake = 0; this.shakeT = 0; this.flash = 0;
    }

    /* ---------------- 底层分配 ---------------- */
    _part() {
      // 环形复用：宁可顶掉最老的粒子，也不新分配
      for (let k = 0; k < CAP.parts; k++) {
        this._pi = (this._pi + 1) % CAP.parts;
        const p = this.parts[this._pi];
        if (!p.live) return p;
      }
      this._pi = (this._pi + 1) % CAP.parts;
      return this.parts[this._pi];
    }
    _tracer() {
      for (let k = 0; k < CAP.tracers; k++) {
        this._ti = (this._ti + 1) % CAP.tracers;
        const t = this.tracers[this._ti];
        if (!t.live) return t;
      }
      this._ti = (this._ti + 1) % CAP.tracers;
      return this.tracers[this._ti];
    }

    /* ---------------- 生成接口 ---------------- */

    /** 通用粒子 */
    emit(type, x, y, vx, vy, life, size, color, opt) {
      const p = this._part();
      p.live = true; p.type = type;
      p.x = x; p.y = y; p.vx = vx; p.vy = vy;
      p.t = 0; p.life = life;
      p.size = size; p.color = color;
      p.drag = (opt && opt.drag !== undefined) ? opt.drag : 2.2;
      p.grow = (opt && opt.grow) || 0;
      p.spin = (opt && opt.spin) || 0;
      p.rot = (opt && opt.rot) || 0;
      p.gz = (opt && opt.gz) || 0;      // 伪高度（碎片抛物线）
      p.vz = (opt && opt.vz) || 0;
      p.fade = (opt && opt.fade !== undefined) ? opt.fade : 1;
      return p;
    }

    /** 枪口焰 */
    muzzle(x, y, ang, scale, color) {
      const q = this.quality;
      this.emit(P_FLASH, x, y, 0, 0, 0.075, 5 * (scale || 1), color || '#ffe9a8', { rot: ang, drag: 0 });
      const n = Math.round(3 * q * (scale || 1));
      for (let i = 0; i < n; i++) {
        const a = ang + this.rnd.range(-0.28, 0.28);
        const s = this.rnd.range(50, 190) * (scale || 1);
        this.emit(P_SPARK, x, y, Math.cos(a) * s, Math.sin(a) * s,
          this.rnd.range(0.07, 0.2), this.rnd.range(1, 2.2), '#ffd98a', { drag: 5 });
      }
      // 少量枪口烟
      if (this.rnd.bool(0.5 * q)) {
        this.emit(P_SMOKE, x, y, Math.cos(ang) * 22, Math.sin(ang) * 22,
          this.rnd.range(0.4, 0.8), this.rnd.range(3, 5), '#b9b3aa', { drag: 1.2, grow: 14, fade: 0.55 });
      }
    }

    /** 曳光弹（画一条会飞的短线） */
    tracer(x0, y0, x1, y1, color, width) {
      const t = this._tracer();
      t.live = true;
      t.x0 = x0; t.y0 = y0; t.x1 = x1; t.y1 = y1;
      t.t = 0; t.life = 0.075;
      t.color = color || '#ffe9a0';
      t.w = width || 1.4;
      return t;
    }

    /** 光束（狙击 / 离子炮），life 更长、更粗 */
    beam(x0, y0, x1, y1, color, width, life) {
      const t = this._tracer();
      t.live = true;
      t.x0 = x0; t.y0 = y0; t.x1 = x1; t.y1 = y1;
      t.t = 0; t.life = life || 0.16;
      t.color = color || '#cfe9ff';
      t.w = width || 3;
      return t;
    }

    /** 爆炸。size: 'small'|'medium'|'large'|'building'|'fire' */
    explosion(x, y, size) {
      const q = this.quality;
      const S = {
        small: { r: 16, sp: 130, n: 7, deb: 3, shake: 1.4, scorch: 7 },
        medium: { r: 26, sp: 190, n: 12, deb: 6, shake: 3.0, scorch: 12 },
        large: { r: 40, sp: 250, n: 18, deb: 10, shake: 5.5, scorch: 20 },
        building: { r: 62, sp: 300, n: 30, deb: 18, shake: 10, scorch: 34 },
        fire: { r: 12, sp: 90, n: 5, deb: 0, shake: 0.5, scorch: 0 },
      }[size] || { r: 20, sp: 150, n: 8, deb: 3, shake: 2, scorch: 8 };

      // 冲击环
      this.emit(P_RING, x, y, 0, 0, 0.34, S.r * 0.4, '#ffd08a', { grow: S.r * 3.4, drag: 0, fade: 0.9 });
      // 核心闪光
      this.emit(P_FLASH, x, y, 0, 0, 0.1, S.r * 0.75, '#fff3cc', { drag: 0 });

      const n = Math.max(2, Math.round(S.n * q));
      for (let i = 0; i < n; i++) {
        const a = this.rnd.range(0, U.TAU);
        const sp = this.rnd.range(S.sp * 0.25, S.sp);
        this.emit(P_FIRE, x, y, Math.cos(a) * sp, Math.sin(a) * sp,
          this.rnd.range(0.22, 0.55), this.rnd.range(S.r * 0.25, S.r * 0.6),
          this.rnd.pick(['#ffdc7a', '#ff9b3c', '#ff6a20', '#e8431a']),
          { drag: 3.2, grow: S.r * 0.5, fade: 0.8 });
      }
      // 黑烟
      const ns = Math.max(2, Math.round(S.n * 0.7 * q));
      for (let i = 0; i < ns; i++) {
        const a = this.rnd.range(0, U.TAU);
        const sp = this.rnd.range(12, S.sp * 0.42);
        this.emit(P_SMOKE, x, y, Math.cos(a) * sp, Math.sin(a) * sp,
          this.rnd.range(0.7, 1.8), this.rnd.range(S.r * 0.3, S.r * 0.7),
          this.rnd.pick(['#4a453f', '#5d574f', '#38332e']),
          { drag: 1.1, grow: S.r * 1.5, fade: 0.5 });
      }
      // 碎片
      const nd = Math.round(S.deb * q);
      for (let i = 0; i < nd; i++) {
        const a = this.rnd.range(0, U.TAU);
        const sp = this.rnd.range(S.sp * 0.5, S.sp * 1.4);
        this.emit(P_DEBRIS, x, y, Math.cos(a) * sp, Math.sin(a) * sp,
          this.rnd.range(0.5, 1.1), this.rnd.range(1.4, 3.2), '#2e2a26',
          { drag: 0.7, spin: this.rnd.range(-14, 14), vz: this.rnd.range(60, 150), gz: 1 });
      }
      if (S.scorch > 0) this.decal(D_SCORCH, x, y, S.scorch, this.rnd.range(0, U.TAU));
      this.addShake(S.shake);
      if (size === 'building') this.flash = Math.min(1, this.flash + 0.16);
      return this;
    }

    /** 命中火花（打在装甲上） */
    impact(x, y, ang, color) {
      const q = this.quality;
      const n = Math.max(2, Math.round(5 * q));
      for (let i = 0; i < n; i++) {
        const a = ang + U.PI + this.rnd.range(-1.0, 1.0);
        const s = this.rnd.range(60, 210);
        this.emit(P_SPARK, x, y, Math.cos(a) * s, Math.sin(a) * s,
          this.rnd.range(0.1, 0.3), this.rnd.range(1, 2), color || '#ffe08a', { drag: 4.5 });
      }
      this.emit(P_FLASH, x, y, 0, 0, 0.06, 4, '#fff6d8', { drag: 0 });
    }

    /** 血 / 肉（打中步兵） */
    blood(x, y, ang) {
      const q = this.quality;
      const n = Math.max(2, Math.round(6 * q));
      for (let i = 0; i < n; i++) {
        const a = ang + this.rnd.range(-0.9, 0.9);
        const s = this.rnd.range(30, 140);
        this.emit(P_DEBRIS, x, y, Math.cos(a) * s, Math.sin(a) * s,
          this.rnd.range(0.25, 0.6), this.rnd.range(1, 2.2), '#8e1f18',
          { drag: 3, vz: this.rnd.range(20, 70), gz: 1 });
      }
    }

    /** 持续冒烟（残骸 / 半血建筑），由渲染层每帧按概率调用 */
    smokePuff(x, y, size, dark) {
      this.emit(P_SMOKE, x, y + 2, this.rnd.range(-8, 8), this.rnd.range(-26, -12),
        this.rnd.range(0.9, 2.0), size || 4,
        dark ? '#3b3631' : '#6f6860', { drag: 0.9, grow: (size || 4) * 3.2, fade: 0.45 });
    }

    /** 尘土（车辆行进 / 建筑落成） */
    dust(x, y, n, spread, size) {
      n = Math.max(1, Math.round((n || 3) * this.quality));
      for (let i = 0; i < n; i++) {
        const a = this.rnd.range(0, U.TAU);
        const s = this.rnd.range(6, (spread || 34));
        this.emit(P_DUST, x, y, Math.cos(a) * s, Math.sin(a) * s,
          this.rnd.range(0.35, 0.95), this.rnd.range(2, size || 5), '#a49578',
          { drag: 2.4, grow: 9, fade: 0.5 });
      }
    }

    /** 喷火锥的火苗 */
    flame(x, y, ang, spread) {
      const n = Math.max(1, Math.round(3 * this.quality));
      for (let i = 0; i < n; i++) {
        const a = ang + this.rnd.range(-(spread || 0.22), (spread || 0.22));
        const s = this.rnd.range(90, 240);
        this.emit(P_FIRE, x, y, Math.cos(a) * s, Math.sin(a) * s,
          this.rnd.range(0.16, 0.36), this.rnd.range(3, 6),
          this.rnd.pick(['#ffe07a', '#ffa53c', '#ff6a24']),
          { drag: 2.6, grow: 12, fade: 0.7 });
      }
    }

    /* ---------------- 贴花 ---------------- */
    decal(type, x, y, size, rot, extra) {
      if (this.decals.length >= CAP.decals) this.decals.shift();
      const d = { type, x, y, size, rot: rot || 0, t: 0, life: extra && extra.life ? extra.life : 0 };
      if (extra) { d.art = extra.art; d.color = extra.color; d.w = extra.w; d.h = extra.h; d.smoke = extra.smoke; }
      this.decals.push(d);
      return d;
    }
    /** 载具残骸（会冒烟一段时间） */
    wreck(x, y, artKey, rot) {
      return this.decal(D_WRECK, x, y, 0, rot, { art: artKey, smoke: 9 });
    }
    /** 步兵尸体 */
    corpse(x, y, color, rot) {
      return this.decal(D_CORPSE, x, y, 4, rot, { color });
    }
    /** 建筑废墟 */
    rubble(x, y, w, h) {
      return this.decal(D_RUBBLE, x, y, 0, 0, { w, h, smoke: 16 });
    }

    /* ---------------- 飘字 ---------------- */
    text(x, y, str, color, size) {
      if (this.texts.length >= CAP.texts) this.texts.shift();
      this.texts.push({ x, y, str, color: color || '#ffffff', size: size || 12, t: 0, life: 1.35 });
    }

    /* ---------------- 震屏 ---------------- */
    addShake(v) {
      this.shake = Math.min(14, this.shake + v);
      this.shakeT = 0.42;
    }

    /* ---------------- 每帧更新 ---------------- */
    update(dt) {
      const parts = this.parts;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (!p.live) continue;
        p.t += dt;
        if (p.t >= p.life) { p.live = false; continue; }
        const dr = Math.exp(-p.drag * dt);
        p.vx *= dr; p.vy *= dr;
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.gz) {
          p.vz -= 420 * dt;
          p.gz += p.vz * dt * 0.1;
          if (p.gz < 0) { p.gz = 0; p.vz = -p.vz * 0.32; if (Math.abs(p.vz) < 20) p.vz = 0; }
        }
        if (p.spin) p.rot += p.spin * dt;
        if (p.type === P_SMOKE) p.vy -= 6 * dt;   // 烟往上飘一点
      }
      const tr = this.tracers;
      for (let i = 0; i < tr.length; i++) {
        const t = tr[i];
        if (!t.live) continue;
        t.t += dt;
        if (t.t >= t.life) t.live = false;
      }
      for (let i = this.texts.length - 1; i >= 0; i--) {
        const x = this.texts[i];
        x.t += dt; x.y -= 22 * dt;
        if (x.t >= x.life) this.texts.splice(i, 1);
      }
      // 残骸/废墟冒烟 + 到期消失
      for (let i = this.decals.length - 1; i >= 0; i--) {
        const d = this.decals[i];
        d.t += dt;
        if (d.smoke > 0) {
          d.smoke -= dt;
          if (this.rnd.bool(dt * 2.4 * this.quality)) {
            this.smokePuff(d.x + this.rnd.range(-4, 4), d.y + this.rnd.range(-4, 4),
              d.type === D_RUBBLE ? 7 : 4, true);
          }
        }
        if (d.life > 0 && d.t >= d.life) this.decals.splice(i, 1);
      }
      if (this.shakeT > 0) {
        this.shakeT -= dt;
        this.shake = Math.max(0, this.shake - dt * 26);
        if (this.shakeT <= 0) this.shake = 0;
      }
      if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.6);
    }

    /** 统计（调试 HUD 用） */
    countLive() {
      let n = 0;
      for (const p of this.parts) if (p.live) n++;
      return n;
    }
  };

})();
