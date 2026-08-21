/* ==========================================================================
 * renderer.js — software 3D renderer on a 2D canvas.
 *
 * Flat shaded convex polygons, painter's algorithm (far -> near), near plane
 * clipping, directional light + ambient, distance fog, and three "vision"
 * palettes (day / thermal / night) used by the gunner sights.
 *
 * No WebGL, no shaders, no external libraries: works straight from file://
 * ==========================================================================*/
(function (global) {
  'use strict';
  const M = global.M, C = global.C;

  const NEAR = 0.06;

  class Renderer {
    constructor(canvas) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });
      this.w = canvas.width || 960;
      this.h = canvas.height || 540;
      this.dpr = 1;
      this.queue = [];
      this.qn = 0;
      this.colorCache = new Map();
      this.tx = new Float64Array(4096);
      this.ty = new Float64Array(4096);
      this.tz = new Float64Array(4096);
      this.seamFix = true;
      this.stats = { faces: 0, culled: 0, meshes: 0 };
      this.cam = null;
      this.frame = 0;
    }

    setSize(w, h, dpr) {
      this.dpr = dpr || 1;
      this.w = Math.max(2, Math.floor(w));
      this.h = Math.max(2, Math.floor(h));
      this.cv.width = Math.floor(this.w * this.dpr);
      this.cv.height = Math.floor(this.h * this.dpr);
      if (this.cv.style) {
        this.cv.style.width = this.w + 'px';
        this.cv.style.height = this.h + 'px';
      }
    }

    /* -------------------------------------------------- frame setup ---- */
    begin(cam) {
      this.frame++;
      this.cam = cam;
      this.view = M.view(cam.pos, cam.yaw, cam.pitch || 0, cam.roll || 0);
      const fov = M.rad(cam.fov || 62);
      this.cx = this.w / 2;
      this.cy = this.h / 2;
      this.f = (this.h / 2) / Math.tan(fov / 2);
      this.tanY = Math.tan(fov / 2);
      this.tanX = this.tanY * (this.w / this.h);
      const L = M.norm(cam.light && cam.light.dir ? cam.light.dir : [-0.4, -0.75, 0.32]);
      // direction *towards* the light, in camera space
      this.lightCam = M.norm(M.xformDir(this.view, [-L[0], -L[1], -L[2]]));
      this.amb = cam.light && cam.light.amb !== undefined ? cam.light.amb : 0.42;
      this.lightCol = (cam.light && cam.light.color) || [255, 246, 226];
      this.vision = cam.vision || 'day';
      this.fog = cam.fog || null;
      this.qn = 0;
      this.stats.faces = 0; this.stats.culled = 0; this.stats.meshes = 0;

      const ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      if (cam.sky) this._sky(cam);
      else {
        ctx.fillStyle = C.css(cam.clear || [8, 9, 11]);
        ctx.fillRect(0, 0, this.w, this.h);
      }
    }

    _sky(cam) {
      const ctx = this.ctx, w = this.w, h = this.h;
      const sky = cam.sky;
      const horizon = this.cy + this.f * Math.tan(cam.pitch || 0);
      ctx.save();
      if (cam.roll) {
        ctx.translate(this.cx, this.cy);
        ctx.rotate(-cam.roll);
        ctx.translate(-this.cx, -this.cy);
      }
      const pad = Math.hypot(w, h);
      let top = sky.top, mid = sky.horizon, gnd = sky.ground;
      if (this.vision === 'thermal') { top = [30, 30, 34]; mid = [58, 58, 62]; gnd = [40, 40, 44]; }
      else if (this.vision === 'night') { top = [6, 26, 10]; mid = [16, 54, 20]; gnd = [10, 34, 14]; }
      const yTop = horizon - pad, yBot = horizon + pad;
      let g = ctx.createLinearGradient(0, yTop, 0, horizon);
      g.addColorStop(0, C.css(top));
      g.addColorStop(1, C.css(mid));
      ctx.fillStyle = g;
      ctx.fillRect(-pad, yTop, w + pad * 2, pad);
      g = ctx.createLinearGradient(0, horizon, 0, yBot);
      g.addColorStop(0, C.css(C.mixc(mid, gnd, 0.6)));
      g.addColorStop(0.25, C.css(gnd));
      g.addColorStop(1, C.css(C.tint(gnd, 0.7)));
      ctx.fillStyle = g;
      ctx.fillRect(-pad, horizon, w + pad * 2, pad);
      // sun / haze bloom
      if (this.vision === 'day' && cam.light && cam.light.dir) {
        const s = this.project(M.addScaled(cam.pos, M.mulv(M.norm(cam.light.dir), -900), 1));
        if (s.on) {
          const rg = ctx.createRadialGradient(s.x, s.y, 4, s.x, s.y, 260);
          rg.addColorStop(0, 'rgba(255,250,225,0.85)');
          rg.addColorStop(0.25, 'rgba(255,240,200,0.25)');
          rg.addColorStop(1, 'rgba(255,240,200,0)');
          ctx.fillStyle = rg;
          ctx.fillRect(s.x - 260, s.y - 260, 520, 520);
        }
      }
      ctx.restore();
    }

    /* -------------------------------------------------- projection ----- */
    project(p) {
      const v = this.view;
      const x = v[0] * p[0] + v[1] * p[1] + v[2] * p[2] + v[3];
      const y = v[4] * p[0] + v[5] * p[1] + v[6] * p[2] + v[7];
      const z = v[8] * p[0] + v[9] * p[1] + v[10] * p[2] + v[11];
      if (z < NEAR) return { x: 0, y: 0, z: z, on: false };
      const sx = this.cx + this.f * x / z;
      const sy = this.cy - this.f * y / z;
      return {
        x: sx, y: sy, z: z,
        on: sx > -400 && sx < this.w + 400 && sy > -400 && sy < this.h + 400
      };
    }

    /* -------------------------------------------------- colour --------- */
    _shade(col, dif, depth, glow, heat, jitter) {
      let k = this.amb + (1 - this.amb) * dif;
      let r, g, b;
      if (this.vision === 'thermal') {
        const v = M.clamp01(0.10 + 0.20 * dif + (heat || 0) * 0.95 + (glow || 0) * 0.9);
        const q = 255 * v;
        r = q; g = q * 0.99; b = q * 0.94 + 12;
      } else if (this.vision === 'night') {
        let v = M.clamp01((C.lum(col) / 255) * k * 1.5 + (glow || 0) + (heat || 0) * 0.25);
        v = Math.pow(v, 0.75);
        r = v * 90; g = 40 + v * 215; b = v * 80;
      } else {
        const lc = this.lightCol;
        r = col[0] * k * (lc[0] / 255);
        g = col[1] * k * (lc[1] / 255);
        b = col[2] * k * (lc[2] / 255);
        if (glow) {
          r = M.lerp(r, 255, glow * 0.85);
          g = M.lerp(g, 240, glow * 0.8);
          b = M.lerp(b, 190, glow * 0.7);
        }
        if (heat) {
          r = M.lerp(r, 255, heat * 0.30);
          g = M.lerp(g, 120, heat * 0.20);
        }
      }
      if (jitter) { r *= jitter; g *= jitter; b *= jitter; }
      if (this.fog) {
        const t = M.clamp01((depth - this.fog.near) / Math.max(1, this.fog.far - this.fog.near)) *
          (this.fog.density === undefined ? 1 : this.fog.density);
        if (t > 0.002) {
          let fc = this.fog.color;
          if (this.vision === 'thermal') fc = [52, 52, 56];
          else if (this.vision === 'night') fc = [12, 44, 16];
          r = r + (fc[0] - r) * t;
          g = g + (fc[1] - g) * t;
          b = b + (fc[2] - b) * t;
        }
      }
      const ri = r < 0 ? 0 : r > 255 ? 255 : r | 0;
      const gi = g < 0 ? 0 : g > 255 ? 255 : g | 0;
      const bi = b < 0 ? 0 : b > 255 ? 255 : b | 0;
      const key = ((ri >> 2) << 12) | ((gi >> 2) << 6) | (bi >> 2);
      let s = this.colorCache.get(key);
      if (s === undefined) {
        s = 'rgb(' + (ri & 252) + ',' + (gi & 252) + ',' + (bi & 252) + ')';
        if (this.colorCache.size > 20000) this.colorCache.clear();
        this.colorCache.set(key, s);
      }
      return s;
    }

    /* -------------------------------------------------- meshes --------- */
    /**
     * @param mesh  built mesh
     * @param model model matrix (or null for identity)
     * @param opt   {heat, glow, alpha, bias, tint, jitter}
     */
    drawMesh(mesh, model, opt) {
      if (!mesh || !mesh.faces.length) return;
      opt = opt || {};
      const view = this.view;
      const mv = model ? M.mul(view, model) : view;
      // sphere cull
      const c = mesh.c;
      const cz = mv[8] * c[0] + mv[9] * c[1] + mv[10] * c[2] + mv[11];
      const rad = mesh.r * (opt.radiusScale || 1) + 0.001;
      if (cz + rad < NEAR) { this.stats.culled++; return; }
      const ccx = mv[0] * c[0] + mv[1] * c[1] + mv[2] * c[2] + mv[3];
      const ccy = mv[4] * c[0] + mv[5] * c[1] + mv[6] * c[2] + mv[7];
      if (Math.abs(ccx) - rad > (cz + rad) * this.tanX * 1.15 ||
        Math.abs(ccy) - rad > (cz + rad) * this.tanY * 1.15) { this.stats.culled++; return; }
      if (this.fog && this.fog.cut && cz - rad > this.fog.cut) { this.stats.culled++; return; }

      const n = mesh.verts.length;
      if (this.tx.length < n) {
        this.tx = new Float64Array(n * 2);
        this.ty = new Float64Array(n * 2);
        this.tz = new Float64Array(n * 2);
      }
      const tx = this.tx, ty = this.ty, tz = this.tz, verts = mesh.verts;
      for (let i = 0; i < n; i++) {
        const p = verts[i], px = p[0], py = p[1], pz = p[2];
        tx[i] = mv[0] * px + mv[1] * py + mv[2] * pz + mv[3];
        ty[i] = mv[4] * px + mv[5] * py + mv[6] * pz + mv[7];
        tz[i] = mv[8] * px + mv[9] * py + mv[10] * pz + mv[11];
      }
      const faces = mesh.faces;
      const bias = opt.bias || 0;
      const heatBase = opt.heat || 0;
      const alpha = opt.alpha === undefined ? 1 : opt.alpha;
      this.stats.meshes++;
      const px = [], py = [], pz = [];
      for (let fi = 0; fi < faces.length; fi++) {
        const face = faces[fi], idx = face.i, m = idx.length;
        px.length = 0; py.length = 0; pz.length = 0;
        let zmax = -1e9, zsum = 0, need = false;
        for (let k = 0; k < m; k++) {
          const i = idx[k];
          const z = tz[i];
          px.push(tx[i]); py.push(ty[i]); pz.push(z);
          if (z > zmax) zmax = z;
          if (z < NEAR) need = true;
          zsum += z;
        }
        if (zmax < NEAR) continue;
        // flat normal from first non degenerate triple
        const ax = px[1] - px[0], ay = py[1] - py[0], az = pz[1] - pz[0];
        const bx = px[2] - px[0], by = py[2] - py[0], bz = pz[2] - pz[0];
        let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;
        // flip to face the camera
        if (nx * px[0] + ny * py[0] + nz * pz[0] > 0) { nx = -nx; ny = -ny; nz = -nz; }
        let dif = face.flat ? 0.85 :
          Math.max(0, nx * this.lightCam[0] + ny * this.lightCam[1] + nz * this.lightCam[2]);
        if (!face.flat) dif = 0.15 + 0.85 * dif; // wrap light a touch
        let X, Y, Z;
        if (need) {
          X = []; Y = []; Z = [];
          for (let k = 0; k < m; k++) {
            const j = (k + 1) % m;
            const z0 = pz[k], z1 = pz[j];
            if (z0 >= NEAR) { X.push(px[k]); Y.push(py[k]); Z.push(z0); }
            if ((z0 < NEAR) !== (z1 < NEAR)) {
              const t = (NEAR - z0) / (z1 - z0);
              X.push(px[k] + (px[j] - px[k]) * t);
              Y.push(py[k] + (py[j] - py[k]) * t);
              Z.push(NEAR);
            }
          }
          if (X.length < 3) continue;
        } else { X = px; Y = py; Z = pz; }
        const cnt = X.length;
        const pts = new Array(cnt * 2);
        let sx0 = 1e9, sy0 = 1e9, sx1 = -1e9, sy1 = -1e9, dsum = 0;
        for (let k = 0; k < cnt; k++) {
          const z = Z[k];
          const sx = this.cx + this.f * X[k] / z;
          const sy = this.cy - this.f * Y[k] / z;
          pts[k * 2] = sx; pts[k * 2 + 1] = sy;
          if (sx < sx0) sx0 = sx; if (sx > sx1) sx1 = sx;
          if (sy < sy0) sy0 = sy; if (sy > sy1) sy1 = sy;
          dsum += z;
        }
        if (sx1 < 0 || sy1 < 0 || sx0 > this.w || sy0 > this.h) continue;
        if ((sx1 - sx0) < 0.35 && (sy1 - sy0) < 0.35) continue;
        const depth = (need ? dsum / cnt : zsum / m) + bias;
        const fill = this._shade(opt.tint ? C.mixc(face.c, opt.tint, 0.5) : face.c,
          dif, depth, face.glow || opt.glow || 0, face.heat || heatBase, opt.jitter);
        this._push({ t: 0, d: depth, p: pts, f: fill, a: alpha });
        this.stats.faces++;
      }
    }

    _push(e) {
      if (this.qn < this.queue.length) this.queue[this.qn] = e;
      else this.queue.push(e);
      this.qn++;
    }

    /* -------------------------------------------------- sprites -------- */
    /** camera facing soft disc (smoke, flash, dust) */
    billboard(pos, size, color, alpha, glow) {
      const v = this.view;
      const x = v[0] * pos[0] + v[1] * pos[1] + v[2] * pos[2] + v[3];
      const y = v[4] * pos[0] + v[5] * pos[1] + v[6] * pos[2] + v[7];
      const z = v[8] * pos[0] + v[9] * pos[1] + v[10] * pos[2] + v[11];
      if (z < NEAR) return;
      const r = this.f * size / z;
      if (r < 0.4) return;
      const sx = this.cx + this.f * x / z, sy = this.cy - this.f * y / z;
      if (sx + r < 0 || sy + r < 0 || sx - r > this.w || sy - r > this.h) return;
      let col = color;
      if (this.vision === 'thermal') col = [255, 250, 240];
      else if (this.vision === 'night') col = [140, 255, 150];
      this._push({ t: 1, d: z - 0.05, x: sx, y: sy, r: r, f: C.rgba(col, alpha), g: glow ? 1 : 0 });
    }

    /**
     * 3D line segment (tracers, wires, gauge needles).
     * Clipped in camera space in one pass: doing it by re-projecting a lerped
     * world point used to recurse forever when the clipped end landed a hair
     * behind the near plane again — which threw out of the frame callback and
     * left the last flat background frozen on screen.
     */
    line(a, b, color, width, glow) {
      const v = this.view;
      let ax = v[0] * a[0] + v[1] * a[1] + v[2] * a[2] + v[3];
      let ay = v[4] * a[0] + v[5] * a[1] + v[6] * a[2] + v[7];
      let az = v[8] * a[0] + v[9] * a[1] + v[10] * a[2] + v[11];
      let bx = v[0] * b[0] + v[1] * b[1] + v[2] * b[2] + v[3];
      let by = v[4] * b[0] + v[5] * b[1] + v[6] * b[2] + v[7];
      let bz = v[8] * b[0] + v[9] * b[1] + v[10] * b[2] + v[11];
      if (!(az === az) || !(bz === bz)) return;              // NaN guard
      if (az < NEAR && bz < NEAR) return;
      if (az < NEAR) {
        const t = (NEAR - az) / (bz - az);
        ax += (bx - ax) * t; ay += (by - ay) * t; az = NEAR;
      } else if (bz < NEAR) {
        const t = (NEAR - bz) / (az - bz);
        bx += (ax - bx) * t; by += (ay - by) * t; bz = NEAR;
      }
      const x1 = this.cx + this.f * ax / az, y1 = this.cy - this.f * ay / az;
      const x2 = this.cx + this.f * bx / bz, y2 = this.cy - this.f * by / bz;
      if ((x1 < 0 && x2 < 0) || (y1 < 0 && y2 < 0) ||
        (x1 > this.w && x2 > this.w) || (y1 > this.h && y2 > this.h)) return;
      this._push({
        t: 2, d: Math.min(az, bz) - 0.02, x: x1, y: y1, x2: x2, y2: y2,
        f: C.css(this.vision === 'night' ? [120, 255, 130] : color), w: width || 1.5, g: glow ? 1 : 0
      });
    }

    /* -------------------------------------------------- flush ---------- */
    flush() {
      const q = this.queue, n = this.qn;
      const arr = q.length === n ? q : q.slice(0, n);
      arr.sort((a, b) => b.d - a.d);
      const ctx = this.ctx;
      ctx.lineJoin = 'round';
      let lastFill = null, lastAlpha = 1;
      ctx.globalAlpha = 1;
      for (let i = 0; i < n; i++) {
        const e = arr[i];
        if (e.t === 0) {
          if (e.a !== lastAlpha) { ctx.globalAlpha = e.a; lastAlpha = e.a; }
          if (e.f !== lastFill) { ctx.fillStyle = e.f; lastFill = e.f; }
          const p = e.p;
          ctx.beginPath();
          ctx.moveTo(p[0], p[1]);
          for (let k = 2; k < p.length; k += 2) ctx.lineTo(p[k], p[k + 1]);
          ctx.closePath();
          ctx.fill();
          if (this.seamFix) {
            ctx.strokeStyle = e.f;
            ctx.lineWidth = 0.9;
            ctx.stroke();
          }
        } else if (e.t === 1) {
          if (lastAlpha !== 1) { ctx.globalAlpha = 1; lastAlpha = 1; }
          const grd = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r);
          grd.addColorStop(0, e.f);
          grd.addColorStop(e.g ? 0.45 : 0.62, e.f);
          grd.addColorStop(1, e.f.replace(/,[^,]+\)$/, ',0)'));
          ctx.fillStyle = grd;
          lastFill = null;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r, 0, M.TAU);
          ctx.fill();
        } else {
          if (lastAlpha !== 1) { ctx.globalAlpha = 1; lastAlpha = 1; }
          ctx.strokeStyle = e.f;
          ctx.lineWidth = e.w;
          if (e.g) { ctx.shadowColor = e.f; ctx.shadowBlur = 8; }
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(e.x2, e.y2);
          ctx.stroke();
          if (e.g) ctx.shadowBlur = 0;
          lastFill = null;
        }
      }
      ctx.globalAlpha = 1;
      this.qn = 0;
      if (arr !== q) { this.queue = q; }
    }
  }

  Renderer.NEAR = NEAR;
  global.Renderer = Renderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = { Renderer };
})(typeof window !== 'undefined' ? window : globalThis);
