/* ============================================================
   fx.js — 2D 叠加层：速度线 / 降水 / 等离子近场 / 面罩污染 / 雷电 / 雷达 / 世界标记 / 水下
   ============================================================ */
(function (glob) {
  'use strict';

  const PRECIP = {
    rain: { n: 340, vy: -9.0, size: 0.9, len: 1.0, col: 'rgba(200,225,240,', alpha: 0.55, add: false, jit: 0.4 },
    snow: { n: 300, vy: -1.3, size: 1.5, len: 0.35, col: 'rgba(240,248,255,', alpha: 0.85, add: false, jit: 2.2 },
    ash: { n: 420, vy: -2.2, size: 1.1, len: 0.5, col: 'rgba(120,110,105,', alpha: 0.75, add: false, jit: 1.6 },
    dust: { n: 400, vy: -1.0, size: 1.0, len: 0.8, col: 'rgba(215,175,120,', alpha: 0.45, add: false, jit: 3.0 },
    ammonia: { n: 320, vy: -4.0, size: 1.2, len: 0.7, col: 'rgba(250,244,225,', alpha: 0.6, add: false, jit: 1.2 },
    drizzle: { n: 220, vy: -1.6, size: 2.1, len: 0.45, col: 'rgba(235,205,160,', alpha: 0.5, add: false, jit: 0.8 },
    none: { n: 0, vy: 0, size: 1, len: 1, col: 'rgba(255,255,255,', alpha: 0.3, add: false, jit: 0 }
  };

  function FX(canvas) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.W = 1; this.H = 1; this.dpr = 1;
    this.visor = document.createElement('canvas');
    this.vg = this.visor.getContext('2d');
    this.parts = [];
    this.embers = [];
    this.drops = [];
    this.bubbles = [];
    this.streaks = [];
    this.flash = 0; this.flashDir = [0, 0, 1];
    this.bolt = null; this.boltT = 0;
    this.hitFlash = 0; this.whiteout = 0;
    this.cfg = PRECIP.none;
    this.emberRate = 0;
    this.frost = 0; this.wet = 0; this.soot = 0;
    this.rnd = u.rng(20260501);
    this.time = 0;
  }
  const F = FX.prototype;

  F.resize = function () {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(this.c.clientWidth * dpr), h = Math.round(this.c.clientHeight * dpr);
    if (w !== this.W || h !== this.H) {
      this.W = this.c.width = w; this.H = this.c.height = h; this.dpr = dpr;
      this.visor.width = w; this.visor.height = h;
      this.vg.clearRect(0, 0, w, h);
    }
  };

  F.setPlanet = function (p) {
    this.cfg = PRECIP[p.precip] || PRECIP.none;
    this.precipAlt = p.precipAlt * 1000;
    this.emberRate = p.embers || 0;
    this.parts.length = 0; this.embers.length = 0; this.drops.length = 0; this.bubbles.length = 0;
    this.flash = 0; this.hitFlash = 0; this.whiteout = 0;
    this.frost = 0; this.wet = 0; this.soot = 0; this.bolt = null;
    if (this.vg) this.vg.clearRect(0, 0, this.W, this.H);
  };

  /* 世界方向 -> 屏幕像素 */
  F.projDir = function (st, dx, dy, dz) {
    const z = dx * st.fwd[0] + dy * st.fwd[1] + dz * st.fwd[2];
    if (z <= 0.0001) return null;
    const x = dx * st.right[0] + dy * st.right[1] + dz * st.right[2];
    const y = dx * st.up[0] + dy * st.up[1] + dz * st.up[2];
    const ppx = x / (z * st.tanF), ppy = y / (z * st.tanF);
    return [(ppx * this.H + this.W) * 0.5, this.H * (1 - ppy) * 0.5, z];
  };

  F.spawnPart = function (st) {
    const r = this.rnd;
    const R = 26 + r() * 40;
    const a = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1);
    return {
      x: R * Math.sin(ph) * Math.cos(a),
      y: R * Math.cos(ph) * 0.8 + 6,
      z: R * Math.sin(ph) * Math.sin(a),
      s: 0.6 + r() * 0.9,
      p: r() * 6.28
    };
  };

  F.render = function (st, dt) {
    this.resize();
    const g = this.g, W = this.W, H = this.H, dpr = this.dpr;
    this.time += dt;
    g.clearRect(0, 0, W, H);
    g.save();

    /* ---- 速度方向屏幕点（向下 = 相对气流来向） ---- */
    const vlen = Math.max(1e-3, Math.hypot(st.vx, st.vy, st.vz));
    const vd = [-st.vx / vlen, -st.vy / vlen, -st.vz / vlen];   // 气流来向
    const vp = this.projDir(st, vd[0], vd[1], vd[2]);
    const cx = vp ? vp[0] : W * 0.5, cy = vp ? vp[1] : H * 1.2;
    const behind = !vp;

    /* ---- 1. 高速气流线 ---- */
    const spd = st.speed;
    const sAmt = u.clamp((spd - 28) / 320, 0, 1) * (st.under ? 0.25 : 1);
    if (sAmt > 0.01 && !behind) {
      const n = Math.floor(26 + sAmt * 120);
      g.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        const a = this.rnd() * Math.PI * 2;
        const r0 = (0.10 + this.rnd() * 1.35) * H * (0.55 + sAmt * 0.9);
        const ln = (24 + this.rnd() * 210 * sAmt) * dpr * (0.4 + st.turb * 0.9 + 0.6);
        const ca = Math.cos(a), sa = Math.sin(a);
        const alpha = (0.035 + 0.14 * sAmt) * (0.4 + this.rnd() * 0.6);
        g.strokeStyle = st.heat > 0.25
          ? 'rgba(255,' + Math.round(190 - 90 * st.heat) + ',150,' + alpha.toFixed(3) + ')'
          : 'rgba(215,238,255,' + alpha.toFixed(3) + ')';
        g.lineWidth = (0.7 + this.rnd() * 1.5) * dpr;
        g.beginPath();
        g.moveTo(cx + ca * r0, cy + sa * r0);
        g.lineTo(cx + ca * (r0 + ln), cy + sa * (r0 + ln));
        g.stroke();
      }
    }

    /* ---- 2. 降水 / 灰 / 尘 ---- */
    const cfg = this.cfg;
    const inPrecip = !st.under && st.alt < this.precipAlt && cfg.n > 0 && st.rhoRel > 0.02;
    const want = inPrecip ? Math.floor(cfg.n * (0.35 + 0.65 * u.clamp(st.rhoRel * 1.6, 0, 1))) : 0;
    while (this.parts.length < want) this.parts.push(this.spawnPart(st));
    if (this.parts.length > want) this.parts.length = want;
    if (want > 0) {
      const wx = st.windX, wz = st.windZ;
      const relY = cfg.vy - st.vy;      // 相对垂直速度（正 = 相对上升）
      const dtc = Math.min(dt, 0.05);
      g.lineCap = 'round';
      for (let i = 0; i < this.parts.length; i++) {
        const p = this.parts[i];
        const jx = Math.sin(this.time * 2.3 + p.p) * cfg.jit;
        const jz = Math.cos(this.time * 1.9 + p.p * 1.7) * cfg.jit;
        const rvx = wx - st.vx + jx, rvz = wz - st.vz + jz;
        p.x += rvx * dt; p.y += relY * dt; p.z += rvz * dt;
        const d2 = p.x * p.x + p.y * p.y + p.z * p.z;
        if (d2 > 110 * 110 || d2 < 0.6) { this.parts[i] = this.spawnPart(st); continue; }
        const a = this.projDir(st, p.x, p.y, p.z);
        if (!a) continue;
        const b = this.projDir(st, p.x - rvx * dtc * cfg.len, p.y - relY * dtc * cfg.len, p.z - rvz * dtc * cfg.len);
        const dist = Math.sqrt(d2);
        const fade = u.clamp(1 - dist / 100, 0, 1) * cfg.alpha;
        const wpx = Math.max(0.6, cfg.size * p.s * (26 / dist)) * dpr;
        g.strokeStyle = cfg.col + (fade * 0.9).toFixed(3) + ')';
        g.lineWidth = wpx;
        g.beginPath();
        g.moveTo(a[0], a[1]);
        if (b) g.lineTo(b[0], b[1]); else g.lineTo(a[0], a[1] + 1);
        g.stroke();
      }
    }

    /* ---- 3. 火山余烬（加色） ---- */
    if (this.emberRate > 0 && !st.under && st.alt < 26000) {
      const want2 = Math.floor(120 * this.emberRate * u.clamp(1 - st.alt / 26000, 0, 1));
      while (this.embers.length < want2) { const e = this.spawnPart(st); e.life = 1; this.embers.push(e); }
      if (this.embers.length > want2) this.embers.length = want2;
      g.globalCompositeOperation = 'lighter';
      const dtc = Math.min(dt, 0.05);
      for (let i = 0; i < this.embers.length; i++) {
        const p = this.embers[i];
        const rvx = st.windX * 1.4 - st.vx, rvz = st.windZ * 1.4 - st.vz;
        const relY = 4.5 - st.vy;
        p.x += rvx * dt; p.y += relY * dt; p.z += rvz * dt;
        p.life -= dt * 0.25;
        if (p.life <= 0 || p.x * p.x + p.y * p.y + p.z * p.z > 90 * 90) { const e = this.spawnPart(st); e.life = 1; this.embers[i] = e; continue; }
        const a = this.projDir(st, p.x, p.y, p.z);
        if (!a) continue;
        const b = this.projDir(st, p.x - rvx * dtc, p.y - relY * dtc, p.z - rvz * dtc);
        const fl = 0.55 + 0.45 * Math.sin(this.time * 9 + p.p * 5);
        g.strokeStyle = 'rgba(255,' + Math.round(90 + 90 * fl) + ',40,' + (0.55 * p.life * fl).toFixed(3) + ')';
        g.lineWidth = (1.1 + p.s) * dpr;
        g.beginPath(); g.moveTo(a[0], a[1]); if (b) g.lineTo(b[0], b[1]); g.stroke();
      }
      g.globalCompositeOperation = 'source-over';
    }

    /* ---- 4. 等离子近场 ---- */
    if (st.heat > 0.03 && !behind) {
      g.globalCompositeOperation = 'lighter';
      const hr = (0.30 + 0.85 * st.heat) * H;
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, hr);
      const fl = 0.82 + 0.18 * Math.sin(this.time * 31) * Math.sin(this.time * 17.3);
      const i0 = st.heat * st.heat * fl;
      gr.addColorStop(0, 'rgba(255,' + Math.round(190 + 60 * st.heat) + ',' + Math.round(120 + 120 * st.heat) + ',' + (0.30 * i0).toFixed(3) + ')');
      gr.addColorStop(0.35, 'rgba(255,120,40,' + (0.16 * i0).toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(140,20,0,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
      // 冲击波纹丝
      const nn = Math.floor(10 + 40 * st.heat);
      for (let i = 0; i < nn; i++) {
        const a = this.rnd() * 6.283, r0 = (0.1 + this.rnd() * 0.5) * H;
        g.strokeStyle = 'rgba(255,' + Math.round(160 + 80 * this.rnd()) + ',90,' + (0.10 * i0).toFixed(3) + ')';
        g.lineWidth = (0.6 + this.rnd() * 1.6) * dpr;
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        for (let k = 1; k <= 3; k++) {
          const rr = r0 + k * 40 * dpr * (0.5 + this.rnd());
          const aa = a + (this.rnd() - 0.5) * 0.25;
          g.lineTo(cx + Math.cos(aa) * rr, cy + Math.sin(aa) * rr);
        }
        g.stroke();
      }
      g.globalCompositeOperation = 'source-over';
    }

    /* ---- 5. 水下 ---- */
    if (st.under) {
      // 悬浮颗粒
      const want3 = 180;
      while (this.bubbles.length < want3) {
        this.bubbles.push({ x: (this.rnd() - .5) * 30, y: (this.rnd() - .5) * 30, z: (this.rnd() - .5) * 30, s: this.rnd(), r: this.rnd() < 0.25 });
      }
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < this.bubbles.length; i++) {
        const p = this.bubbles[i];
        const rise = p.r ? 1.6 + p.s * 2.4 : 0.12;
        p.y += (rise - st.vy) * dt;
        p.x += Math.sin(this.time * 0.8 + p.s * 9) * 0.15 * dt;
        if (p.y > 26 || p.y < -26) { p.y = p.y > 0 ? -26 : 26; p.x = (this.rnd() - .5) * 30; p.z = (this.rnd() - .5) * 30; }
        const a = this.projDir(st, p.x, p.y, p.z);
        if (!a) continue;
        const d = Math.hypot(p.x, p.y, p.z);
        const al = u.clamp(1 - d / 28, 0, 1) * (p.r ? 0.5 : 0.22);
        g.fillStyle = 'rgba(200,235,245,' + al.toFixed(3) + ')';
        const rr = (p.r ? 1.4 + p.s * 2.6 : 0.9 + p.s) * dpr * (10 / Math.max(3, d));
        g.beginPath(); g.arc(a[0], a[1], rr, 0, 6.283); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
      // 深蓝渐暗
      const dg = g.createLinearGradient(0, 0, 0, H);
      const dk = u.clamp(st.depth / 90, 0, 1);
      dg.addColorStop(0, 'rgba(4,16,26,' + (0.15 + 0.5 * dk).toFixed(3) + ')');
      dg.addColorStop(1, 'rgba(1,6,12,' + (0.45 + 0.5 * dk).toFixed(3) + ')');
      g.fillStyle = dg; g.fillRect(0, 0, W, H);
    }

    /* ---- 6. 面罩污染层（持久累积） ---- */
    this.updateVisor(st, dt);
    if (this.frost > 0.01 || this.wet > 0.01 || this.soot > 0.01) {
      g.globalAlpha = 1;
      g.drawImage(this.visor, 0, 0);
    }

    /* ---- 7. 闪电 ---- */
    if (this.flash > 0.001) {
      const fp = this.projDir(st, this.flashDir[0], this.flashDir[1], this.flashDir[2]);
      g.globalCompositeOperation = 'lighter';
      if (fp) {
        const gr = g.createRadialGradient(fp[0], fp[1], 0, fp[0], fp[1], H * 1.2);
        gr.addColorStop(0, 'rgba(225,240,255,' + (0.85 * this.flash).toFixed(3) + ')');
        gr.addColorStop(0.4, 'rgba(150,190,255,' + (0.30 * this.flash).toFixed(3) + ')');
        gr.addColorStop(1, 'rgba(60,90,160,0)');
        g.fillStyle = gr;
      } else {
        g.fillStyle = 'rgba(180,205,255,' + (0.25 * this.flash).toFixed(3) + ')';
      }
      g.fillRect(0, 0, W, H);
      if (this.bolt && this.boltT > 0) {
        g.strokeStyle = 'rgba(240,248,255,' + u.clamp(this.boltT * 2.5, 0, 1).toFixed(3) + ')';
        g.lineWidth = 2.2 * dpr; g.beginPath();
        g.moveTo(this.bolt[0][0], this.bolt[0][1]);
        for (let i = 1; i < this.bolt.length; i++) g.lineTo(this.bolt[i][0], this.bolt[i][1]);
        g.stroke();
        g.lineWidth = 6 * dpr;
        g.strokeStyle = 'rgba(150,190,255,' + (0.25 * u.clamp(this.boltT * 2.5, 0, 1)).toFixed(3) + ')';
        g.stroke();
      }
      g.globalCompositeOperation = 'source-over';
      this.flash = Math.max(0, this.flash - dt * (2.2 + this.rnd() * 3));
      this.boltT = Math.max(0, this.boltT - dt * 3.4);
    }

    /* ---- 8. 世界标记 + 雷达 ---- */
    this.drawMarkers(st);
    this.drawRadar(st);

    /* ---- 9. 过载 / 受击 / 白化 ---- */
    if (st.gloc > 0.01) {
      const r = (1.05 - 0.72 * st.gloc) * Math.max(W, H) * 0.62;
      const gr = g.createRadialGradient(W / 2, H / 2, r * 0.25, W / 2, H / 2, r);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(1, 'rgba(2,0,0,' + (0.5 + 0.5 * st.gloc).toFixed(3) + ')');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(70,0,0,' + (0.22 * st.gloc).toFixed(3) + ')'; g.fillRect(0, 0, W, H);
    }
    if (this.hitFlash > 0.001) {
      g.fillStyle = 'rgba(255,60,30,' + (0.35 * this.hitFlash).toFixed(3) + ')';
      g.fillRect(0, 0, W, H);
      this.hitFlash = Math.max(0, this.hitFlash - dt * 3.2);
    }
    if (st.crack > 0.01) this.drawCracks(st.crack);
    g.restore();
  };

  /* ---- 面罩：结霜 / 水痕 / 积灰 ---- */
  F.updateVisor = function (st, dt) {
    const vg = this.vg, W = this.W, H = this.H, dpr = this.dpr;
    const hot = st.heat > 0.12 || st.shellT > 480;
    // 目标值
    let tf = 0, tw = 0, ts = 0;
    if (!st.under) {
      if (st.precip === 'snow' && st.alt < 6000) tf = 0.8;
      if (st.shellT < 240) tf = Math.max(tf, 0.5);
      if (st.precip === 'rain' && st.alt < 7000) tw = 0.9;
      if (st.precip === 'drizzle' && st.alt < 12000) tw = 0.7;
      if (st.precip === 'ash' && st.alt < 22000) ts = 0.8;
      if (st.precip === 'dust' && st.alt < 16000) ts = 0.55;
    }
    if (hot) { tf = 0; tw *= 0.15; ts *= 0.25; }   /* 高温除霜 / 除雾 / 除灰 */
    const k = dt * 0.55;
    const nf = u.lerp(this.frost, tf, k), nw = u.lerp(this.wet, tw, k), ns = u.lerp(this.soot, ts, k * 0.6);
    // 新增沉积
    const addF = Math.max(0, nf - this.frost), addW = Math.max(0, nw - this.wet), addS = Math.max(0, ns - this.soot);
    this.frost = nf; this.wet = nw; this.soot = ns;
    if (addF > 0.0004) {
      const n = Math.ceil(addF * 900);
      for (let i = 0; i < n; i++) {
        const x = this.rnd() * W, y = this.rnd() * H;
        const edge = u.clamp(Math.hypot((x - W / 2) / (W / 2), (y - H / 2) / (H / 2)), 0, 1.4);
        if (this.rnd() > edge * 0.85) continue;
        vg.fillStyle = 'rgba(225,242,255,' + (0.05 + 0.10 * this.rnd()).toFixed(3) + ')';
        vg.beginPath();
        const r = (1 + this.rnd() * 5) * dpr;
        for (let k2 = 0; k2 < 6; k2++) {
          const a = k2 / 6 * 6.283;
          vg.lineTo(x + Math.cos(a) * r * (0.5 + this.rnd()), y + Math.sin(a) * r * (0.5 + this.rnd()));
        }
        vg.fill();
      }
    }
    if (addS > 0.0004) {
      const n = Math.ceil(addS * 700);
      for (let i = 0; i < n; i++) {
        const x = this.rnd() * W, y = this.rnd() * H;
        const edge = u.clamp(Math.hypot((x - W / 2) / (W / 2), (y - H / 2) / (H / 2)), 0, 1.4);
        if (this.rnd() > edge * 0.8) continue;
        vg.fillStyle = 'rgba(60,52,48,' + (0.05 + 0.12 * this.rnd()).toFixed(3) + ')';
        vg.beginPath(); vg.arc(x, y, (1 + this.rnd() * 4) * dpr, 0, 6.283); vg.fill();
      }
    }
    // 水滴：生成 + 被气流抹开
    if (nw > 0.05 && this.rnd() < nw * 0.9) {
      this.drops.push({ x: this.rnd() * W, y: this.rnd() * H, r: (2 + this.rnd() * 7) * dpr, l: 1 });
      if (this.drops.length > 90) this.drops.shift();
    }
    if (this.drops.length) {
      const push = u.clamp(st.speed / 90, 0, 3);
      for (let i = this.drops.length - 1; i >= 0; i--) {
        const d = this.drops[i];
        const ny = d.y - (10 + 90 * push) * dt * this.dpr * 0.5;
        vg.strokeStyle = 'rgba(210,235,250,0.10)';
        vg.lineWidth = d.r * 0.8;
        vg.beginPath(); vg.moveTo(d.x, d.y); vg.lineTo(d.x + (this.rnd() - .5) * 3, ny); vg.stroke();
        d.y = ny; d.l -= dt * 0.5;
        if (d.l <= 0 || d.y < -20) this.drops.splice(i, 1);
      }
    }
    // 自清洁：离开沉积条件后，霜/水痕/灰会在数秒内逐渐蒸发消失
    const clean = (hot ? 0.80 : 0.14) + u.clamp(st.speed / 320, 0, 0.35);
    if (clean > 0.001) {
      vg.globalCompositeOperation = 'destination-out';
      vg.fillStyle = 'rgba(0,0,0,' + (clean * dt).toFixed(4) + ')';
      vg.fillRect(0, 0, W, H);
      vg.globalCompositeOperation = 'source-over';
    }
  };

  F.drawCracks = function (amt) {
    const g = this.g, W = this.W, H = this.H;
    const r = u.rng(777);
    g.strokeStyle = 'rgba(230,245,255,' + (0.35 * amt).toFixed(3) + ')';
    g.lineWidth = 1.4 * this.dpr;
    const cx = W * 0.5, cy = H * 0.52;
    for (let i = 0; i < 14; i++) {
      let a = r() * 6.283, x = cx, y = cy;
      g.beginPath(); g.moveTo(x, y);
      const steps = 4 + Math.floor(r() * 5);
      for (let k = 0; k < steps; k++) {
        const l = (30 + r() * 130) * this.dpr * amt;
        a += (r() - 0.5) * 0.9;
        x += Math.cos(a) * l; y += Math.sin(a) * l;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,' + (0.05 * amt).toFixed(3) + ')';
    g.beginPath(); g.arc(cx, cy, 26 * this.dpr * amt, 0, 6.283); g.fill();
  };

  /* ---- 世界标记（信标 / 危险） ---- */
  F.drawMarkers = function (st) {
    const g = this.g, dpr = this.dpr;
    g.font = (10 * dpr) + 'px Consolas,monospace';
    g.textAlign = 'center';
    for (let i = 0; i < st.marks.length; i++) {
      const m = st.marks[i];
      const p = this.projDir(st, m.dx, m.dy, m.dz);
      if (!p) continue;
      if (p[0] < -60 || p[0] > this.W + 60 || p[1] < -60 || p[1] > this.H + 60) continue;
      const d = Math.hypot(m.dx, m.dy, m.dz);
      const s = u.clamp(700 / d, 6, 46) * dpr;
      if (m.kind === 'beacon') {
        const pulse = 0.6 + 0.4 * Math.sin(this.time * 4 + i);
        g.strokeStyle = 'rgba(255,214,120,' + (0.35 + 0.5 * pulse).toFixed(3) + ')';
        g.lineWidth = 1.4 * dpr;
        g.beginPath();
        g.moveTo(p[0], p[1] - s); g.lineTo(p[0] + s, p[1]); g.lineTo(p[0], p[1] + s); g.lineTo(p[0] - s, p[1]); g.closePath();
        g.stroke();
        g.fillStyle = 'rgba(255,224,150,' + (0.10 + 0.25 * pulse).toFixed(3) + ')'; g.fill();
        g.fillStyle = 'rgba(255,224,150,.75)';
        g.fillText((d / 1000).toFixed(1) + 'km', p[0], p[1] + s + 12 * dpr);
      } else {
        const bad = 0.55 + 0.45 * Math.sin(this.time * 7 + i * 2);
        g.strokeStyle = 'rgba(255,90,60,' + (0.25 + 0.45 * bad).toFixed(3) + ')';
        g.lineWidth = 1.3 * dpr;
        g.beginPath(); g.arc(p[0], p[1], s * 1.1, 0, 6.283); g.stroke();
        g.beginPath(); g.moveTo(p[0] - s * .5, p[1] - s * .5); g.lineTo(p[0] + s * .5, p[1] + s * .5);
        g.moveTo(p[0] + s * .5, p[1] - s * .5); g.lineTo(p[0] - s * .5, p[1] + s * .5); g.stroke();
      }
    }
    g.textAlign = 'left';
  };

  /* ---- 雷达 ---- */
  F.drawRadar = function (st) {
    const g = this.g, dpr = this.dpr;
    const R = 64 * dpr, cx = 26 * dpr + R + 42 * dpr, cy = 26 * dpr + R + 58 * dpr;
    const range = st.radarRange;
    g.save();
    g.translate(cx, cy);
    /* 底板，保证在亮背景前也清晰 */
    const bg = g.createRadialGradient(0, 0, R * 0.2, 0, 0, R);
    bg.addColorStop(0, 'rgba(4,16,26,.58)');
    bg.addColorStop(1, 'rgba(3,10,18,.34)');
    g.fillStyle = bg;
    g.beginPath(); g.arc(0, 0, R, 0, 6.283); g.fill();
    g.strokeStyle = 'rgba(130,230,255,.38)'; g.lineWidth = 1 * dpr;
    g.beginPath(); g.arc(0, 0, R, 0, 6.283); g.stroke();
    g.strokeStyle = 'rgba(130,230,255,.18)';
    g.beginPath(); g.arc(0, 0, R * 0.62, 0, 6.283); g.stroke();
    g.beginPath(); g.arc(0, 0, R * 0.3, 0, 6.283); g.stroke();
    g.beginPath(); g.moveTo(-R, 0); g.lineTo(R, 0); g.moveTo(0, -R); g.lineTo(0, R); g.stroke();
    // 扫描线
    const sweep = (this.time * 1.35) % 6.283;
    const sg = g.createLinearGradient(0, 0, Math.cos(sweep) * R, Math.sin(sweep) * R);
    sg.addColorStop(0, 'rgba(140,240,255,.35)'); sg.addColorStop(1, 'rgba(140,240,255,0)');
    g.strokeStyle = sg; g.lineWidth = 2 * dpr;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(sweep) * R, Math.sin(sweep) * R); g.stroke();
    // 目标（以航向为上）：先投影到机身坐标 x=右、z=前
    const cyaw = Math.cos(st.yaw), syaw = Math.sin(st.yaw);
    for (let i = 0; i < st.blips.length; i++) {
      const b = st.blips[i];
      let rx = b.x, rz = b.z;
      const right = rx * cyaw - rz * syaw;
      const fwd = rx * syaw + rz * cyaw;
      const d = Math.hypot(right, fwd);
      if (d > range) continue;
      const px = (right / range) * R, py = -(fwd / range) * R;
      if (b.kind === 'beacon') {
        g.fillStyle = 'rgba(255,214,120,' + (0.55 + 0.45 * Math.sin(this.time * 5 + i)).toFixed(2) + ')';
        g.beginPath(); g.arc(px, py, 3 * dpr, 0, 6.283); g.fill();
      } else {
        const rr = u.clamp(b.r / range * R, 3 * dpr, R);
        g.fillStyle = 'rgba(255,70,45,' + (b.active ? 0.30 : 0.16) + ')';
        g.beginPath(); g.arc(px, py, rr, 0, 6.283); g.fill();
        g.strokeStyle = 'rgba(255,110,80,.55)'; g.lineWidth = 1 * dpr; g.stroke();
      }
    }
    // 自己
    g.fillStyle = 'rgba(220,250,255,.95)';
    g.beginPath(); g.moveTo(0, -5 * dpr); g.lineTo(3.4 * dpr, 4 * dpr); g.lineTo(-3.4 * dpr, 4 * dpr); g.closePath(); g.fill();
    g.restore();
    /* 底部标签底板 */
    const label = 'RADAR  ' + (range / 1000).toFixed(1) + ' km';
    g.font = (9.5 * dpr) + 'px Consolas,monospace';
    const lw = g.measureText(label).width + 12 * dpr;
    g.fillStyle = 'rgba(4,16,26,.55)';
    g.fillRect(cx - R, cy + R + 7 * dpr, lw, 13 * dpr);
    g.fillStyle = 'rgba(150,235,255,.65)';
    g.fillText(label, cx - R + 6 * dpr, cy + R + 17 * dpr);
  };

  /* ---- 外部事件 ---- */
  F.lightning = function (dir, str) {
    this.flash = Math.max(this.flash, str);
    this.flashDir = dir;
    if (str > 0.6) {
      const n = 7 + Math.floor(this.rnd() * 6);
      const bolt = [];
      let x = this.rnd() * this.W, y = -20;
      for (let i = 0; i < n; i++) {
        bolt.push([x, y]);
        x += (this.rnd() - 0.5) * 130 * this.dpr;
        y += (this.H / n) * (0.6 + this.rnd() * 0.8);
      }
      this.bolt = bolt; this.boltT = 1;
    }
  };
  F.hit = function (s) { this.hitFlash = Math.min(1.4, this.hitFlash + s); };

  glob.FX = FX;
})(window);
