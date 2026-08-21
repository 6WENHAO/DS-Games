/* =============================================================================
   fx.js - pooled particle system: dust, smoke, fire, sparks, debris, muzzle
   flash, ground scorch decals, plus the dynamic point lights they emit.
   ========================================================================== */
(function (global) {
  'use strict';
  var TS = global.TS = global.TS || {};
  var G = TS.G, M4 = TS.M4, V3 = TS.V3, MU = TS.MU;

  var MAX = 520, MAX_DECALS = 40;

  function FX(R, A) {
    this.R = R; this.A = A;
    this.rng = MU.rng(90210);
    this.list = [];
    this.free = [];
    for (var i = 0; i < MAX; i++) {
      var p = { alive: false };
      this.list.push(p); this.free.push(p);
    }
    this.decals = [];
    this.decalHead = 0;
    this.flashes = [];   /* transient lights */
    this.quad = R.mesh(G.quad(1, 1));
    this.cube = R.mesh(G.box(1, 1, 1, { col: [1, 1, 1] }));
    this.texSoft = A.get('radialSoft');
    this.texHard = A.get('radial');
  }

  FX.prototype._get = function () {
    if (!this.free.length) {
      /* recycle the oldest */
      var oldest = null, best = 1e9;
      for (var i = 0; i < this.list.length; i++) {
        var q = this.list[i];
        if (q.alive && q.born < best) { best = q.born; oldest = q; }
      }
      if (!oldest) return null;
      oldest.alive = false;
      return oldest;
    }
    return this.free.pop();
  };

  FX.prototype.spawn = function (o) {
    var p = this._get();
    if (!p) return null;
    p.alive = true;
    p.born = performance.now ? performance.now() : Date.now();
    p.kind = o.kind || 'smoke';
    p.p = [o.p[0], o.p[1], o.p[2]];
    p.v = o.v ? [o.v[0], o.v[1], o.v[2]] : [0, 0, 0];
    p.life = 0;
    p.max = o.max || 1;
    p.s0 = o.s0 || 0.4;
    p.s1 = o.s1 === undefined ? p.s0 * 3 : o.s1;
    p.c0 = o.c0 || [1, 1, 1];
    p.c1 = o.c1 || p.c0;
    p.a0 = o.a0 === undefined ? 0.7 : o.a0;
    p.a1 = o.a1 === undefined ? 0 : o.a1;
    p.grav = o.grav === undefined ? 0 : o.grav;
    p.drag = o.drag === undefined ? 1.4 : o.drag;
    p.additive = !!o.additive;
    p.rot = o.rot === undefined ? this.rng() * 6.28 : o.rot;
    p.spin = o.spin === undefined ? (this.rng() - 0.5) * 1.5 : o.spin;
    p.bounce = !!o.bounce;
    return p;
  };

  /* ---------------------------------------------------------- emitters ---- */
  FX.prototype.dust = function (pos, amount, vel) {
    var n = Math.max(1, Math.round(amount));
    for (var i = 0; i < n; i++) {
      var r = this.rng;
      this.spawn({
        kind: 'dust', p: [pos[0] + (r() - 0.5) * 0.8, pos[1] + r() * 0.3, pos[2] + (r() - 0.5) * 0.8],
        v: [(vel ? vel[0] : 0) + (r() - 0.5) * 1.2, 0.5 + r() * 1.1, (vel ? vel[2] : 0) + (r() - 0.5) * 1.2],
        max: 1.4 + r() * 1.6, s0: 0.5 + r() * 0.6, s1: 2.6 + r() * 2.4,
        c0: [0.62, 0.55, 0.42], c1: [0.55, 0.51, 0.44], a0: 0.34, drag: 1.1
      });
    }
  };

  FX.prototype.smoke = function (pos, amount, opt) {
    opt = opt || {};
    for (var i = 0; i < amount; i++) {
      var r = this.rng;
      this.spawn({
        kind: 'smoke',
        p: [pos[0] + (r() - 0.5) * (opt.spread || 0.5), pos[1] + (r() - 0.5) * 0.3, pos[2] + (r() - 0.5) * (opt.spread || 0.5)],
        v: [(r() - 0.5) * 0.7, (opt.rise === undefined ? 1.8 : opt.rise) + r() * 1.2, (r() - 0.5) * 0.7],
        max: opt.max || (2.5 + r() * 3.5),
        s0: opt.s0 || (0.7 + r() * 0.7), s1: opt.s1 || (4 + r() * 4),
        c0: opt.c0 || [0.20, 0.19, 0.18], c1: opt.c1 || [0.42, 0.41, 0.40],
        a0: opt.a0 === undefined ? 0.55 : opt.a0, drag: 0.7
      });
    }
  };

  FX.prototype.fire = function (pos, amount, scale) {
    scale = scale || 1;
    for (var i = 0; i < amount; i++) {
      var r = this.rng;
      this.spawn({
        kind: 'fire', additive: true,
        p: [pos[0] + (r() - 0.5) * 0.5 * scale, pos[1] + r() * 0.3 * scale, pos[2] + (r() - 0.5) * 0.5 * scale],
        v: [(r() - 0.5) * 1.4, 2.2 + r() * 3.4, (r() - 0.5) * 1.4],
        max: 0.35 + r() * 0.5, s0: (0.5 + r() * 0.7) * scale, s1: (0.15) * scale,
        c0: [1.4, 0.75, 0.22], c1: [0.6, 0.16, 0.03], a0: 0.9, drag: 1.6
      });
    }
  };

  FX.prototype.sparks = function (pos, amount, power) {
    power = power || 6;
    for (var i = 0; i < amount; i++) {
      var r = this.rng;
      var dir = V3.normalize([r() - 0.5, r() * 0.9 + 0.1, r() - 0.5]);
      this.spawn({
        kind: 'spark', additive: true,
        p: [pos[0], pos[1], pos[2]],
        v: V3.scale(dir, power * (0.4 + r())),
        max: 0.5 + r() * 0.8, s0: 0.12, s1: 0.02,
        c0: [1.8, 1.2, 0.5], c1: [1.0, 0.3, 0.05], a0: 1, grav: -9, drag: 0.4, bounce: true
      });
    }
  };

  FX.prototype.debris = function (pos, amount, power, col) {
    for (var i = 0; i < amount; i++) {
      var r = this.rng;
      var dir = V3.normalize([r() - 0.5, r() * 0.8 + 0.25, r() - 0.5]);
      this.spawn({
        kind: 'debris', p: [pos[0], pos[1] + 0.2, pos[2]],
        v: V3.scale(dir, power * (0.5 + r())),
        max: 1.6 + r() * 1.8, s0: 0.08 + r() * 0.22, s1: 0.08 + r() * 0.22,
        c0: col || [0.30, 0.26, 0.20], c1: col || [0.24, 0.21, 0.16],
        a0: 1, a1: 1, grav: -14, drag: 0.15, bounce: true, spin: (r() - 0.5) * 12
      });
    }
  };

  FX.prototype.fireball = function (pos, scale) {
    scale = scale || 1;
    this.fire(pos, Math.round(14 * scale), 1.5 * scale);
    this.smoke(pos, Math.round(10 * scale), { s0: 1.2 * scale, s1: 7 * scale, rise: 3.2, max: 4 + scale });
    this.dust(pos, Math.round(8 * scale));
    this.sparks(pos, Math.round(16 * scale), 9 * scale);
    this.debris(pos, Math.round(9 * scale), 8 * scale);
    this.flash(pos, 2.6 * scale, 0.28, [1.6, 0.85, 0.35]);
  };

  FX.prototype.muzzle = function (pos, dir, scale) {
    scale = scale || 1;
    var i, r = this.rng;
    for (i = 0; i < 12; i++) {
      var sp = V3.addScaled(V3.scale(dir, 3 + r() * 16), [r() - 0.5, r() - 0.5, r() - 0.5], 3);
      this.spawn({
        kind: 'fire', additive: true, p: V3.addScaled(pos, dir, r() * 1.6),
        v: sp, max: 0.16 + r() * 0.2, s0: (0.8 + r() * 1.1) * scale, s1: 0.3 * scale,
        c0: [2.0, 1.35, 0.5], c1: [0.9, 0.35, 0.08], a0: 1, drag: 3
      });
    }
    this.smoke(V3.addScaled(pos, dir, 1.2), 9, {
      s0: 1.0, s1: 6.5, rise: 0.7, max: 3.4, c0: [0.42, 0.40, 0.36], c1: [0.55, 0.54, 0.52], a0: 0.5
    });
    for (i = 0; i < 10; i++) {
      var d2 = V3.normalize([r() - 0.5, (r() - 0.5) * 0.4, r() - 0.5]);
      this.spawn({
        kind: 'dust', p: V3.addScaled(pos, dir, 0.5), v: V3.scale(d2, 7 + r() * 9),
        max: 1.1 + r(), s0: 0.7, s1: 4.4, c0: [0.60, 0.55, 0.45], c1: [0.55, 0.53, 0.48], a0: 0.4, drag: 2.2
      });
    }
    this.flash(V3.addScaled(pos, dir, 1.0), 5.0, 0.10, [1.7, 1.1, 0.6]);
  };

  FX.prototype.flash = function (pos, rad, dur, col) {
    this.flashes.push({ p: [pos[0], pos[1], pos[2]], rad: rad, t: 0, dur: dur || 0.12, col: col || [1.6, 1.2, 0.7] });
  };

  FX.prototype.scorch = function (pos, normal, size) {
    var d = this.decals[this.decalHead % MAX_DECALS];
    if (!d) { d = {}; this.decals[this.decalHead % MAX_DECALS] = d; }
    this.decalHead++;
    var n = normal || [0, 1, 0];
    var up = Math.abs(n[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
    var right = V3.normalize(V3.cross(up, n));
    var fwd = V3.cross(n, right);
    /* quad lies in XY, so we need its +Z along the surface normal */
    d.xf = M4.multiply(M4.fromBasis(right, fwd, n, V3.addScaled(pos, n, 0.06)), M4.scaling(size, size, 1));
    d.age = 0;
  };

  /* ----------------------------------------------------------- simulate --- */
  FX.prototype.update = function (dt, world) {
    var i, p;
    for (i = 0; i < this.list.length; i++) {
      p = this.list[i];
      if (!p.alive) continue;
      p.life += dt;
      if (p.life >= p.max) {
        p.alive = false;
        this.free.push(p);
        continue;
      }
      p.v[1] += p.grav * dt;
      var d = Math.exp(-p.drag * dt);
      p.v[0] *= d; p.v[2] *= d;
      if (p.kind !== 'debris' && p.kind !== 'spark') p.v[1] *= d;
      p.p[0] += p.v[0] * dt;
      p.p[1] += p.v[1] * dt;
      p.p[2] += p.v[2] * dt;
      p.rot += p.spin * dt;
      if (p.bounce && world) {
        var gy = world.heightAt(p.p[0], p.p[2]);
        if (p.p[1] < gy + 0.05) {
          p.p[1] = gy + 0.05;
          p.v[1] = Math.abs(p.v[1]) * 0.32;
          p.v[0] *= 0.55; p.v[2] *= 0.55;
          if (Math.abs(p.v[1]) < 0.4) { p.v[1] = 0; p.grav = 0; p.bounce = false; }
        }
      }
    }
    for (i = this.flashes.length - 1; i >= 0; i--) {
      this.flashes[i].t += dt;
      if (this.flashes[i].t > this.flashes[i].dur) this.flashes.splice(i, 1);
    }
    for (i = 0; i < this.decals.length; i++) if (this.decals[i]) this.decals[i].age += dt;
  };

  /* dynamic point lights contributed by explosions / muzzle flashes */
  FX.prototype.lights = function (out) {
    out = out || [];
    for (var i = 0; i < this.flashes.length && out.length < 3; i++) {
      var f = this.flashes[i];
      var k = 1 - (f.t / f.dur);
      k = k * k;
      out.push({ pos: f.p, col: [f.col[0] * k, f.col[1] * k, f.col[2] * k], rad: f.rad });
    }
    return out;
  };

  /* --------------------------------------------------------------- draw --- */
  FX.prototype.draw = function (R, camRight, camUp, camPos) {
    var i, p;
    /* decals first (they are close to opaque and lie on the ground) */
    for (i = 0; i < this.decals.length; i++) {
      var d = this.decals[i];
      if (!d || !d.xf) continue;
      var a = MU.clamp(0.72 - d.age * 0.006, 0, 0.72);
      if (a <= 0.01) continue;
      R.draw(this.quad, d.xf, {
        color: [0.06, 0.05, 0.04], tex: this.texSoft, alpha: a,
        unlit: true, depthWrite: false, doubleSided: true
      });
    }
    for (i = 0; i < this.list.length; i++) {
      p = this.list[i];
      if (!p.alive) continue;
      var t = p.life / p.max;
      var s = p.s0 + (p.s1 - p.s0) * t;
      var al = p.a0 + (p.a1 - p.a0) * t;
      if (al <= 0.004) continue;
      var col = [
        p.c0[0] + (p.c1[0] - p.c0[0]) * t,
        p.c0[1] + (p.c1[1] - p.c0[1]) * t,
        p.c0[2] + (p.c1[2] - p.c0[2]) * t
      ];
      var m;
      if (p.kind === 'debris') {
        m = M4.mulAll(M4.translation(p.p[0], p.p[1], p.p[2]),
          M4.rotationY(p.rot), M4.rotationX(p.rot * 0.7), M4.scaling(s, s, s));
        R.draw(this.cube, m, { color: col, spec: 0.05 });
        continue;
      }
      /* billboard: rotate the camera basis around the view axis by p.rot */
      var cr = Math.cos(p.rot), sr = Math.sin(p.rot);
      var rx = [camRight[0] * cr + camUp[0] * sr, camRight[1] * cr + camUp[1] * sr, camRight[2] * cr + camUp[2] * sr];
      var uy = [-camRight[0] * sr + camUp[0] * cr, -camRight[1] * sr + camUp[1] * cr, -camRight[2] * sr + camUp[2] * cr];
      var fz = V3.cross(rx, uy);
      m = M4.fromBasis(V3.scale(rx, s), V3.scale(uy, s), fz, p.p);
      R.draw(this.quad, m, {
        color: col, tex: p.kind === 'spark' ? this.texHard : this.texSoft,
        alpha: al, unlit: true, additive: p.additive, depthWrite: false, doubleSided: true
      });
    }
  };

  FX.prototype.count = function () {
    var n = 0;
    for (var i = 0; i < this.list.length; i++) if (this.list[i].alive) n++;
    return n;
  };

  TS.FX = FX;
})(typeof window !== 'undefined' ? window : this);
