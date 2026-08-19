// Opening cinematic: studio logo -> title screen -> 2D exit (resolve) -> (integrator plays 3D white flash).
// Pure DOM + Canvas2D. Two backdrop modes:
//   - backdrop3d=true  (real game): transparent background, only vignette + particles + logo + HUD text + spinner.
//   - backdrop3d=false (fallback / dev): procedural canvas sky + cloud sea + mountains.
import { ease } from '../core/utils.js';
import { fbm2 } from '../core/noise.js';

const TAU = Math.PI * 2;

function h(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

export class IntroSystem {
  constructor(ctx) {
    this.ctx = ctx;
    this.root = null;
    this.state = 'idle';          // idle | logo | title | enter | done
    this.t = 0;
    this.backdrop3d = false;
    this._built = false;
    this._resolve = null;
    this._particles = [];
    this._sparks = [];
    this._linePool = [];
    this._cloudsFar = [];
    this._cloudsNear = [];
    this._ridgesFar = [];
    this._ridgesNear = [];
    this._glow = null;
    this._farStrip = null;
    this._nearStrip = null;
    this._cloudOffFar = 0;
    this._cloudOffNear = 0;
    this._stripW = 0;
    this._spinner = null;
    this.w = 0; this.h = 0;
  }

  _ensureBuilt() { if (!this._built) this._build(); }

  _build() {
    this._built = true;
    const root = h('div'); root.id = 'intro';
    this.root = root;

    this.bg = h('canvas', 'intro-bg');
    this.parts = h('canvas', 'intro-particles');
    const vig = h('div', 'intro-vignette');

    const actLogo = h('div', 'intro-act'); actLogo.id = 'intro-act-logo';
    const l1 = h('div', 'logo-line1'); l1.textContent = 'DeepSeek Harness Presents';
    const l2 = h('div', 'logo-line2'); l2.textContent = '提瓦特计划';
    actLogo.appendChild(l1); actLogo.appendChild(l2);

    const actTitle = h('div', 'intro-act'); actTitle.id = 'intro-act-title';
    const chars = h('div', 'title-chars');
    const c1 = h('span', 'char c1'); c1.textContent = '原';
    const c2 = h('span', 'char c2'); c2.textContent = '神';
    chars.appendChild(c1); chars.appendChild(c2);
    const sweep = h('div', 'title-sweep');
    const sub = h('div', 'title-sub'); sub.textContent = 'GENSHIN-LIKE · OPEN WORLD DEMO';
    actTitle.appendChild(chars); actTitle.appendChild(sweep); actTitle.appendChild(sub);

    const click = h('div', 'intro-click');
    const ring = h('div', 'click-ring');
    const clabel = h('div', 'click-label'); clabel.textContent = '点击进入';
    const ver = h('div', 'intro-ver'); ver.textContent = 'v0.1.0 · 提瓦特计划';
    click.appendChild(ring); click.appendChild(clabel); click.appendChild(ver);

    // 2D exit: radial glow burst + speed lines (no full-screen white — integrator does that)
    const actEnter = h('div', 'intro-act'); actEnter.id = 'intro-act-enter';
    const burst = h('div', 'enter-burst');
    actEnter.appendChild(burst);

    // bottom-right loading anemo spinner (visible while title waits for input)
    const spinner = h('div', 'intro-spinner');
    this._spinner = h('canvas'); this._spinner.width = this._spinner.height = 56;
    spinner.appendChild(this._spinner);

    root.appendChild(this.bg);
    root.appendChild(this.parts);
    root.appendChild(vig);
    root.appendChild(actLogo);
    root.appendChild(actTitle);
    root.appendChild(click);
    root.appendChild(actEnter);
    root.appendChild(spinner);

    const host = document.getElementById('ui-root') || document.body;
    host.appendChild(root);

    this.bgCtx = this.bg.getContext('2d');
    this.partCtx = this.parts.getContext('2d');
    this._glow = this._makeGlow();
    this._drawAnemo(this._spinner, 56, '#74c8a8');

    addEventListener('resize', () => this._resize());
    this._resize();

    this._onKey = (e) => { if (this.state === 'title' && this.t > 0.25) this._beginEnter(); };
    this._onClick = () => { if (this.state === 'title' && this.t > 0.25) this._beginEnter(); };
    addEventListener('keydown', this._onKey);
    root.addEventListener('click', this._onClick);
  }

  _makeGlow() {
    const s = 64, c = document.createElement('canvas'); c.width = c.height = s;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,246,214,1)');
    g.addColorStop(0.35, 'rgba(255,224,150,.85)');
    g.addColorStop(0.7, 'rgba(255,210,120,.25)');
    g.addColorStop(1, 'rgba(255,210,120,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    return c;
  }

  _drawAnemo(cv, size, color) {
    const ctx = cv.getContext('2d');
    const cx = size / 2, cy = size / 2;
    ctx.clearRect(0, 0, size, size);
    ctx.translate(cx, cy);
    for (let i = 0; i < 3; i++) {
      ctx.rotate(TAU / 3);
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.40);
      ctx.bezierCurveTo(size * 0.17, -size * 0.16, size * 0.17, 0.02, 0, size * 0.12);
      ctx.bezierCurveTo(-size * 0.17, 0.02, -size * 0.17, -size * 0.16, 0, -size * 0.40);
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.beginPath(); ctx.arc(0, 0, size * 0.085, 0, TAU); ctx.fillStyle = '#eafaf4'; ctx.fill();
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.w = window.innerWidth; this.h = window.innerHeight;
    for (const cv of [this.bg, this.parts]) {
      cv.width = Math.floor(this.w * dpr); cv.height = Math.floor(this.h * dpr);
      cv.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    this._genRidges();
    this._genClouds();
    this._genStrips();
  }

  _makeRidge(seed, baseFrac, ampFrac, freq) {
    const pts = []; const N = 72;
    const baseY = this.h * baseFrac, amp = this.h * ampFrac;
    for (let i = 0; i <= N; i++) {
      const u = i / N, x = u * this.w;
      const y = baseY - Math.abs(fbm2(u * freq + seed, seed * 0.71, 3)) * amp;
      pts.push([x, y]);
    }
    return pts;
  }
  _genRidges() {
    this._ridgesFar = this._makeRidge(3.7, 0.66, 0.12, 5.2);
    this._ridgesNear = this._makeRidge(11.2, 0.82, 0.13, 6.8);
  }
  _genClouds() {
    let s = 99; const rng = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    this._cloudsFar = []; this._cloudsNear = [];
    for (let i = 0; i < 14; i++) this._cloudsFar.push(this._mkCloud(rng, 0.12, 0.34, 0.05, 0.42, 0.5));
    for (let i = 0; i < 9; i++) this._cloudsNear.push(this._mkCloud(rng, 0.22, 0.46, 0.09, 0.5, 0.68));
  }
  _mkCloud(rng, yMin, yMax, rMin, rMax, aMax) {
    return { x: rng(), y: yMin + rng() * (yMax - yMin), r: rMin + rng() * (rMax - rMin), alpha: 0.35 + rng() * aMax };
  }
  _renderCloudStrip(layer, stripW) {
    const c = document.createElement('canvas'); c.width = stripW; c.height = this.h;
    const ctx = c.getContext('2d');
    const base = Math.min(this.w, 760);
    for (const cl of layer) this._drawCloud(ctx, cl.x * stripW, cl.y * this.h, cl.r * base, cl.alpha);
    return c;
  }
  _drawCloud(ctx, cx, cy, r, alpha) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(255,255,255,' + alpha + ')');
    g.addColorStop(0.6, 'rgba(255,255,255,' + (alpha * 0.7) + ')');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.arc(cx - r * 0.72, cy + r * 0.14, r * 0.76, 0, TAU);
    ctx.arc(cx + r * 0.72, cy + r * 0.12, r * 0.72, 0, TAU);
    ctx.arc(cx - r * 0.3, cy - r * 0.52, r * 0.6, 0, TAU);
    ctx.arc(cx + r * 0.34, cy - r * 0.46, r * 0.55, 0, TAU);
    ctx.fill();
  }
  _genStrips() {
    this._stripW = Math.max(640, Math.floor(this.w * 1.5));
    this._farStrip = this._renderCloudStrip(this._cloudsFar, this._stripW);
    this._nearStrip = this._renderCloudStrip(this._cloudsNear, this._stripW);
    this._cloudOffFar = 0; this._cloudOffNear = 0;
  }

  // ---- state machine -------------------------------------------------
  _setAct(name) { this.root.className = name + (this.backdrop3d ? ' b3d' : ''); this.state = name; this.t = 0; }

  _resetFx() {
    const fx = this.ctx && this.ctx.fx;
    if (!fx) return;
    if (fx.uRadial) fx.uRadial.value = 0;
    if (fx.uFade) fx.uFade.value = 0;
  }

  play(opts) {
    this._ensureBuilt();
    this.backdrop3d = !!(opts && opts.backdrop3d);
    this.root.classList.toggle('b3d', this.backdrop3d);
    this.bg.style.display = this.backdrop3d ? 'none' : 'block';
    return new Promise((res) => {
      this._resolve = res;
      if (this.ctx.shotMode === true) {
        this.state = 'done';
        this.root.className = 'done';
        this.root.style.display = 'none';
        this._settle();
        return;
      }
      this.root.style.display = 'block';
      this._setAct('logo');
    });
  }

  skip() {
    this._resetFx();
    this.state = 'done';
    if (this.root) { this.root.className = 'done'; this.root.style.display = 'none'; }
    this._settle();
  }

  _settle() { if (this._resolve) { const r = this._resolve; this._resolve = null; r(); } }

  _beginEnter() {
    if (this.state !== 'title') return;
    this._setAct('enter');
    this._spawnLines();
    // resolve immediately: this is the "enter game" trigger; integrator then plays the 3D white flash.
    this._settle();
  }

  _spawnLines() {
    this._linePool = [];
    for (let i = 0; i < 46; i++) {
      this._linePool.push({
        a: Math.random() * TAU,
        len: (0.4 + Math.random() * 0.9) * Math.max(this.w, this.h),
        speed: 1.4 + Math.random() * 1.8,
        off: Math.random() * 0.35,
        wdt: 1 + Math.random() * 2.2,
      });
    }
  }

  update(dt) {
    if (!this._built) return;
    if (this.state === 'idle' || this.state === 'done') return;
    this.t += dt;
    this._drawBackground(dt);
    this._drawParticles(dt);
    switch (this.state) {
      case 'logo':
        if (this.t >= 2.0) { this._setAct('title'); this._spawnSparks(); }
        break;
      case 'title':
        break; // waits for input
      case 'enter':
        if (this.t >= 1.15) this._finish();
        break;
    }
  }

  _finish() {
    this._resetFx();
    this._setAct('done');
    setTimeout(() => { if (this.root && this.root.parentNode) this.root.style.display = 'none'; }, 700);
  }

  // ---- drawing -------------------------------------------------------
  _fillRidge(ctx, pts, topColor, bottomColor) {
    if (!pts.length) return;
    const g = ctx.createLinearGradient(0, this.h * 0.5, 0, this.h);
    g.addColorStop(0, topColor); g.addColorStop(1, bottomColor);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts) ctx.lineTo(p[0], p[1]);
    ctx.lineTo(this.w, this.h); ctx.lineTo(0, this.h);
    ctx.closePath(); ctx.fill();
  }

  _drawBackground(dt) {
    const ctx = this.bgCtx, w = this.w, h = this.h;
    if (this.backdrop3d) { ctx.clearRect(0, 0, w, h); return; }  // transparent — 3D world shows through
    // sky
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#244a86');
    g.addColorStop(0.42, '#5687b8');
    g.addColorStop(0.68, '#96c0d6');
    g.addColorStop(0.80, '#e9d6aa');
    g.addColorStop(1, '#e2c189');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // darken the upper sky so the gold logo pops
    const tg = ctx.createLinearGradient(0, 0, 0, h * 0.62);
    tg.addColorStop(0, 'rgba(10,16,36,.40)');
    tg.addColorStop(0.55, 'rgba(10,16,36,.16)');
    tg.addColorStop(1, 'rgba(10,16,36,0)');
    ctx.fillStyle = tg; ctx.fillRect(0, 0, w, h * 0.62);
    // soft backdrop darkening behind the title for logo contrast
    const dg = ctx.createRadialGradient(w * 0.5, h * 0.40, 0, w * 0.5, h * 0.40, Math.max(w, h) * 0.46);
    dg.addColorStop(0, 'rgba(14,30,60,.46)');
    dg.addColorStop(0.55, 'rgba(14,30,60,.16)');
    dg.addColorStop(1, 'rgba(14,30,60,0)');
    ctx.fillStyle = dg; ctx.fillRect(0, 0, w, h);
    // sun glow (dimmer, lower, off to the right)
    const sg = ctx.createRadialGradient(w * 0.72, h * 0.64, 0, w * 0.72, h * 0.64, w * 0.42);
    sg.addColorStop(0, 'rgba(255,250,225,.72)');
    sg.addColorStop(0.3, 'rgba(255,240,200,.34)');
    sg.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h);
    // clouds + mountains
    this._cloudOffFar = (this._cloudOffFar + dt * 8) % this._stripW;
    this._cloudOffNear = (this._cloudOffNear + dt * 16) % this._stripW;
    if (this._farStrip) { ctx.drawImage(this._farStrip, -this._cloudOffFar, 0); ctx.drawImage(this._farStrip, this._stripW - this._cloudOffFar, 0); }
    this._fillRidge(ctx, this._ridgesFar, '#9db8d8', '#6c8fb6');
    if (this._nearStrip) { ctx.drawImage(this._nearStrip, -this._cloudOffNear, 0); ctx.drawImage(this._nearStrip, this._stripW - this._cloudOffNear, 0); }
    this._fillRidge(ctx, this._ridgesNear, '#6c8fb6', '#3f5f88');
    // slow camera push (scale 1.0 -> 1.08, 40s loop)
    const k = 0.5 - 0.5 * Math.cos((this.ctx.time && this.ctx.time.elapsed ? this.ctx.time.elapsed : performance.now() / 1000) * (TAU / 40));
    this.bg.style.transform = 'scale(' + (1 + 0.08 * k).toFixed(4) + ')';
  }

  _drawParticles(dt) {
    const ctx = this.partCtx;
    ctx.clearRect(0, 0, this.w, this.h);
    if (this.state === 'enter') { this._drawLines(ctx, dt); return; }
    if (this.state === 'title' && this._sparks.length) this._drawSparks(ctx, dt);
    this._updateDrawAmbient(ctx, dt);
  }

  _makeParticle(fromBottom) {
    const t = Math.random();
    return {
      x: Math.random() * this.w,
      y: fromBottom ? this.h + 20 + Math.random() * 40 : Math.random() * this.h,
      vx: (Math.random() - 0.5) * 8,
      vy: -(10 + Math.random() * 34),
      size: 0.8 + Math.random() * 2.0,
      rot: Math.random() * TAU,
      spin: (Math.random() - 0.5) * 1.6,
      phase: Math.random() * TAU,
      alpha: 0.22 + Math.random() * 0.4,
      life: Math.random() * 6,
      maxLife: 8 + Math.random() * 9,
      type: t < 0.55 ? 'dot' : (t < 0.8 ? 'seed' : 'feather'),
    };
  }
  _ensureParticles() { if (!this._particles.length) for (let i = 0; i < 150; i++) this._particles.push(this._makeParticle(true)); }

  _updateDrawAmbient(ctx, dt) {
    this._ensureParticles();
    for (const p of this._particles) {
      p.life += dt;
      p.y += p.vy * dt;
      p.x += (p.vx + Math.sin(p.life * 0.9 + p.phase) * 8) * dt;
      p.rot += p.spin * dt;
      if (p.y < -30 || p.life > p.maxLife) Object.assign(p, this._makeParticle(false));
      let fade = p.life < 1 ? p.life : 1;
      if (p.maxLife - p.life < 1) fade = Math.max(0, p.maxLife - p.life);
      this._drawParticle(ctx, p, p.alpha * fade);
    }
  }
  _drawParticle(ctx, p, a) {
    if (p.type === 'dot') {
      const s = p.size * 5.5;
      ctx.globalAlpha = a;
      ctx.drawImage(this._glow, p.x - s / 2, p.y - s / 2, s, s);
    } else if (p.type === 'seed') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = a * 0.9;
      ctx.strokeStyle = 'rgba(255,240,210,.9)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, p.size * 4); ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const ang = -Math.PI / 2 + (i - 1) * 0.7;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang) * p.size * 3, Math.sin(ang) * p.size * 3); ctx.stroke();
      }
      ctx.restore();
    } else {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = a * 0.85;
      ctx.strokeStyle = 'rgba(255,246,220,.85)'; ctx.lineWidth = p.size * 0.5;
      ctx.beginPath(); ctx.moveTo(-p.size * 2, 0); ctx.quadraticCurveTo(0, p.size * 2.2, p.size * 2, 0); ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  _spawnSparks() {
    const cx = this.w / 2, cy = this.h * 0.42;
    this._sparks = [];
    for (let i = 0; i < 44; i++) {
      const a = Math.random() * TAU;
      const rad = Math.max(this.w, this.h) * 0.55;
      this._sparks.push({
        x0: cx + Math.cos(a) * rad, y0: cy + Math.sin(a) * rad,
        x1: cx + (Math.random() - 0.5) * this.w * 0.28, y1: cy + (Math.random() - 0.5) * 44,
        t: 0, dur: 0.5 + Math.random() * 0.5, size: 1.5 + Math.random() * 2.5,
      });
    }
  }
  _drawSparks(ctx, dt) {
    let done = true;
    for (const s of this._sparks) {
      s.t += dt;
      if (s.t >= s.dur) continue;
      done = false;
      const k = ease.outCubic(Math.min(1, s.t / s.dur));
      const x = s.x0 + (s.x1 - s.x0) * k, y = s.y0 + (s.y1 - s.y0) * k;
      const a = Math.sin(Math.PI * Math.min(1, s.t / s.dur));
      const sz = s.size * 7 * (1 - k * 0.4);
      ctx.globalAlpha = a * 0.9;
      ctx.drawImage(this._glow, x - sz / 2, y - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
    if (done) this._sparks = [];
  }

  _drawLines(ctx, dt) {
    const w = this.w, h = this.h, cx = w / 2, cy = h / 2;
    const k = Math.min(1, this.t / 0.9);
    for (const L of this._linePool) {
      L.off += L.speed * dt * (0.4 + k);
      const d = L.off * Math.max(w, h);
      const x0 = cx + Math.cos(L.a) * d * 0.3, y0 = cy + Math.sin(L.a) * d * 0.3;
      const x1 = cx + Math.cos(L.a) * (d + L.len * 0.16), y1 = cy + Math.sin(L.a) * (d + L.len * 0.16);
      const a = Math.max(0, 1 - L.off) * 0.7 * k;
      ctx.globalAlpha = a;
      ctx.strokeStyle = 'rgba(255,255,255,.92)';
      ctx.lineWidth = L.wdt;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  dispose() {
    removeEventListener('keydown', this._onKey);
    if (this.root) { this.root.remove(); this.root = null; }
    this.state = 'done';
  }
}
