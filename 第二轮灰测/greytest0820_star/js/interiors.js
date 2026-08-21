/* ==========================================================================
 * interiors.js — interactive crew compartments.
 *
 * Every tank gets an interior built in the SAME local space as its exterior
 * model, split into two groups:
 *   hull   parts  -> stay fixed to the hull      (driver's station, bins)
 *   turret parts  -> rotate with the turret ring (gunner / loader / commander)
 * so traversing the turret really does swing the fighting compartment around
 * the driver.
 *
 * Controls are "hotspots": a 3D position + a procedural widget + a state
 * getter + an action. main.js projects them, highlights whatever is under the
 * cursor and calls act().
 * ==========================================================================*/
(function (global) {
  'use strict';
  const M = global.M, C = global.C, MeshBuilder = global.MeshBuilder;
  const L = global.L || { m: (en) => en, s: (s) => s, shell: (s) => s, lang: 'en' };

  const STEEL = C.hex('#6d7075');
  const DARK = C.hex('#33363a');
  const BRASS = C.hex('#b08d4a');
  const RED = C.hex('#8e3830');
  const BLACK = C.hex('#26282b');
  const GLASS = C.hex('#3f5a63');
  const LEATHER = C.hex('#4a3d31');

  /* =================================================== widget geometry == */
  const WCACHE = new Map();

  function makeWidget(kind, color) {
    const b = new MeshBuilder();          // static base
    const mv = new MeshBuilder();         // moving part
    let pivot = [0, 0, 0], axis = 'x', range = [0, 0], slide = null, needle = 0;
    switch (kind) {
      case 'button':
        b.box(0, 0, -0.012, 0.085, 0.085, 0.024, DARK);
        b.ring([0, 0, 0.002], 'z', 0.038, 0.03, 10, C.tint(STEEL, 0.9));
        mv.tube([0, 0, 0], [0, 0, 0.028], 0.03, 0.03, 10, color);
        mv.disc([0, 0, 0.029], 'z', 0.03, 10, C.tint(color, 1.25));
        slide = [0, 0, -0.02];
        break;
      case 'lever':
        b.box(0, -0.03, -0.02, 0.07, 0.14, 0.05, DARK);
        b.ring([0, 0, 0.01], 'x', 0.05, 0.03, 8, C.tint(STEEL, 0.8));
        mv.tube([0, 0, 0.01], [0, 0.26, 0.06], 0.017, 0.014, 7, STEEL);
        mv.dome([0, 0.27, 0.07], 0.045, 8, 2, color);
        pivot = [0, 0, 0.01]; axis = 'x'; range = [0.55, -0.45];
        break;
      case 'wheel':
        b.tube([0, 0, -0.03], [0, 0, 0.03], 0.035, 0.03, 8, DARK);
        mv.ring([0, 0, 0.04], 'z', 0.15, 0.125, 14, color);
        for (let i = 0; i < 3; i++) {
          const a = i / 3 * M.TAU;
          mv.box(Math.cos(a) * 0.07, Math.sin(a) * 0.07, 0.04, 0.02, 0.14, 0.02, C.tint(color, 0.9));
        }
        mv.tube([0.14, 0, 0.04], [0.14, 0, 0.10], 0.02, 0.02, 7, C.tint(BLACK, 1.2));
        axis = 'z'; range = [0, 26];
        break;
      case 'valve':
        b.tube([0, 0, -0.03], [0, 0, 0.02], 0.03, 0.025, 8, DARK);
        mv.ring([0, 0, 0.03], 'z', 0.085, 0.065, 10, color);
        for (let i = 0; i < 4; i++) {
          const a = i / 4 * M.TAU;
          mv.box(Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0.03, 0.016, 0.08, 0.016, C.tint(color, 0.92));
        }
        axis = 'z'; range = [0, 5];
        break;
      case 'gauge':
        b.tube([0, 0, -0.02], [0, 0, 0.012], 0.085, 0.085, 14, C.tint(STEEL, 0.75));
        b.disc([0, 0, 0.013], 'z', 0.078, 14, C.hex('#1d2024'), { flat: true });
        for (let i = 0; i <= 10; i++) {
          const a = M.rad(225 - i * 27);
          const r0 = 0.058, r1 = i % 5 === 0 ? 0.072 : 0.066;
          b.quad(
            [Math.cos(a) * r0 - 0.003, Math.sin(a) * r0, 0.015], [Math.cos(a) * r0 + 0.003, Math.sin(a) * r0, 0.015],
            [Math.cos(a) * r1 + 0.003, Math.sin(a) * r1, 0.015], [Math.cos(a) * r1 - 0.003, Math.sin(a) * r1, 0.015],
            i > 7 ? C.hex('#c8503c') : C.hex('#cfd2c8'), { flat: true });
        }
        b.ring([0, 0, 0.016], 'z', 0.088, 0.078, 14, C.tint(STEEL, 1.1));
        needle = 0.06;
        break;
      case 'screen':
        b.box(0, 0, -0.02, 0.34, 0.26, 0.04, BLACK);
        b.plate([0, 0, 0.006], [0.15, 0, 0], [0, 0.11, 0], C.mixc(color, [10, 20, 16], 0.35), { flat: true, glow: 0.25 });
        for (let i = 0; i < 5; i++) {
          b.plate([-0.02, 0.07 - i * 0.035, 0.009], [0.09 - i * 0.012, 0, 0], [0, 0.006, 0],
            C.tint(color, 1.5), { flat: true, glow: 0.5 });
        }
        b.ring([0.12, -0.09, 0.01], 'z', 0.02, 0.012, 8, C.tint(STEEL, 0.9));
        break;
      case 'pedal':
        b.box(0, -0.04, -0.04, 0.13, 0.06, 0.1, DARK);
        mv.box(0, 0.09, 0.02, 0.12, 0.2, 0.025, color);
        for (let i = 0; i < 4; i++) mv.box(0, 0.03 + i * 0.045, 0.036, 0.1, 0.014, 0.01, C.tint(color, 0.7));
        pivot = [0, 0, 0]; axis = 'x'; range = [0, -0.42];
        break;
      case 'sight':
      case 'periscope': {
        const long = kind === 'sight' ? 0.42 : 0.22;
        b.tube([0, 0, 0.02], [0, 0, -long], 0.055, 0.07, 10, C.tint(DARK, 1.1));
        b.ring([0, 0, 0.022], 'z', 0.075, 0.045, 12, BLACK);         // rubber brow pad
        b.disc([0, 0, 0.019], 'z', 0.044, 12, GLASS, { glow: 0.22 });
        b.box(0, 0.055, -long * 0.6, 0.14, 0.05, 0.1, C.tint(DARK, 0.9));
        if (kind === 'sight') {
          b.box(0.09, -0.02, -0.1, 0.05, 0.05, 0.12, STEEL);
          b.tube([-0.09, -0.03, -0.06], [-0.09, -0.03, 0.0], 0.02, 0.02, 7, C.tint(BRASS, 0.9));
        }
        break;
      }
      case 'trigger':
        b.box(0, -0.06, 0, 0.06, 0.16, 0.07, BLACK);                 // pistol grip
        b.box(0, 0.04, 0.01, 0.07, 0.08, 0.09, C.tint(BLACK, 1.3));
        mv.box(0, -0.02, 0.055, 0.025, 0.05, 0.02, color);
        pivot = [0, 0.01, 0.05]; axis = 'x'; range = [0, -0.5];
        break;
      case 'knob':
        b.box(0, 0, -0.01, 0.09, 0.09, 0.02, DARK);
        mv.tube([0, 0, 0], [0, 0, 0.035], 0.03, 0.026, 9, color);
        mv.box(0, 0.022, 0.037, 0.008, 0.03, 0.008, C.hex('#e8e2d0'));
        axis = 'z'; range = [1.3, -1.3];
        break;
      case 'rack':
        b.box(0, -0.16, -0.04, 0.62, 0.06, 0.2, C.tint(color, 0.8));
        b.box(0, 0.16, -0.04, 0.62, 0.06, 0.2, C.tint(color, 0.8));
        for (let i = 0; i < 5; i++) b.box(-0.26 + i * 0.13, 0, -0.09, 0.02, 0.34, 0.09, C.tint(color, 0.95));
        break;
      case 'extinguisher':
        b.tube([0, -0.16, 0], [0, 0.16, 0], 0.075, 0.075, 12, RED);
        b.tube([0, 0.16, 0], [0, 0.24, 0], 0.035, 0.03, 8, C.tint(STEEL, 0.9));
        b.box(0, 0.26, 0.03, 0.03, 0.02, 0.11, STEEL);
        b.ring([0, -0.05, 0], 'y', 0.09, 0.075, 10, C.tint(STEEL, 0.7));
        break;
      case 'radio':
        b.box(0, 0, -0.09, 0.44, 0.3, 0.18, C.tint(color, 0.9));
        b.plate([0, 0.03, 0.002], [0.2, 0, 0], [0, 0.11, 0], C.tint(color, 1.1));
        b.tube([-0.12, -0.06, 0], [-0.12, -0.06, 0.03], 0.045, 0.04, 10, BLACK);
        b.tube([0.12, -0.06, 0], [0.12, -0.06, 0.03], 0.045, 0.04, 10, BLACK);
        b.plate([0, 0.06, 0.004], [0.14, 0, 0], [0, 0.035, 0], C.hex('#243028'), { flat: true, glow: 0.3 });
        for (let i = 0; i < 6; i++) b.box(-0.12 + i * 0.048, 0.06, 0.008, 0.004, 0.03, 0.004, C.hex('#d8e2c0'), { flat: true });
        break;
      case 'plate':
        b.plate([0, 0, 0], [0.16, 0, 0], [0, 0.11, 0], color, { flat: true });
        b.box(0, 0, -0.012, 0.33, 0.23, 0.02, C.tint(color, 0.7));
        break;
      case 'grip':
        b.tube([-0.11, 0, 0], [0.11, 0, 0], 0.026, 0.026, 8, color);
        b.box(-0.13, 0, -0.03, 0.04, 0.05, 0.07, DARK);
        b.box(0.13, 0, -0.03, 0.04, 0.05, 0.07, DARK);
        break;
      case 'switch':
      default:
        b.box(0, 0, -0.01, 0.085, 0.085, 0.022, DARK);
        b.box(0, -0.035, 0.002, 0.05, 0.012, 0.006, C.tint(STEEL, 1.1));
        mv.tube([0, 0, 0.006], [0, 0.05, 0.034], 0.013, 0.01, 6, STEEL);
        mv.dome([0, 0.052, 0.036], 0.022, 7, 2, color);
        pivot = [0, 0, 0.006]; axis = 'x'; range = [0.5, -0.5];
        break;
    }
    return {
      base: b.build(),
      moving: mv.faces.length ? mv.build() : null,
      pivot, axis, range, slide, needle
    };
  }

  function getWidget(kind, color) {
    const key = kind + '|' + (color[0] | 0) + ',' + (color[1] | 0) + ',' + (color[2] | 0);
    let w = WCACHE.get(key);
    if (!w) { w = makeWidget(kind, color); WCACHE.set(key, w); }
    return w;
  }

  /** one 12 cm brass shell, used by racks / carousels / the loader's hands */
  const SHELL_MESH = (function () {
    const mb = new MeshBuilder();
    mb.tube([0, 0, -0.34], [0, 0, 0.12], 0.062, 0.062, 10, BRASS);
    mb.tube([0, 0, 0.12], [0, 0, 0.30], 0.062, 0.05, 10, C.hex('#4a4f42'));
    mb.tube([0, 0, 0.30], [0, 0, 0.42], 0.05, 0.012, 10, C.hex('#3d4238'));
    mb.ring([0, 0, -0.33], 'z', 0.062, 0.03, 10, C.tint(BRASS, 0.8));
    return mb.build();
  })();

  /* ================================================= geometry helpers == */
  const Int = {};

  Int.rivets = function (mb, from, to, n, r, color) {
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const p = M.lerpv(from, to, t);
      mb.dome(p, r, 6, 1, color);
    }
  };

  Int.conduit = function (mb, pts, r, color) {
    for (let i = 0; i < pts.length - 1; i++) mb.tube(pts[i], pts[i + 1], r, r, 6, color);
    for (let i = 1; i < pts.length - 1; i++) mb.dome(pts[i], r * 1.2, 6, 1, C.tint(color, 0.9));
  };

  Int.seat = function (mb, pos, yaw, o) {
    o = o || {};
    const w = o.w || 0.42, d = o.d || 0.4, back = o.back === undefined ? 0.4 : o.back;
    mb.save();
    mb.move(pos[0], pos[1], pos[2]).rotY(yaw);
    mb.box(0, 0, 0, w, 0.07, d, o.color || LEATHER);
    mb.box(0, 0.03, 0, w * 0.92, 0.05, d * 0.9, C.tint(o.color || LEATHER, 1.12));
    if (back > 0) {
      mb.save(); mb.move(0, back / 2, -d / 2).rotX(-0.18);
      mb.box(0, 0, 0, w * 0.9, back, 0.07, o.color || LEATHER);
      mb.restore();
    }
    mb.box(0, -0.16, 0, 0.1, 0.3, 0.1, C.tint(STEEL, 0.7));    // pedestal
    mb.ring([0, -0.3, 0], 'y', 0.18, 0.1, 10, C.tint(STEEL, 0.6));
    mb.restore();
  };

  Int.lamp = function (mb, pos, color) {
    mb.tube([pos[0], pos[1], pos[2]], [pos[0], pos[1] - 0.06, pos[2]], 0.05, 0.06, 8, C.tint(STEEL, 0.8));
    mb.disc([pos[0], pos[1] - 0.062, pos[2]], 'y', 0.055, 8, color, { glow: 0.85, flat: true });
  };

  Int.ammoBin = function (mb, pos, size, color, rows) {
    mb.box(pos[0], pos[1], pos[2], size[0], size[1], size[2], C.tint(color, 0.9));
    mb.box(pos[0], pos[1] + size[1] / 2 + 0.01, pos[2], size[0] * 0.9, 0.02, size[2] * 0.9, C.tint(color, 1.1));
    const n = rows || 4;
    for (let i = 0; i < n; i++) {
      mb.ring([pos[0] - size[0] / 2 + size[0] * (i + 0.5) / n, pos[1] + size[1] / 2 + 0.02, pos[2]],
        'y', 0.062, 0.05, 8, C.tint(BRASS, 0.85));
    }
  };

  /** subdivide a quad into nu x nv plates, each slightly different — armour
   *  plate never looks like one flat colour in real life */
  Int.panels = function (mb, p00, p10, p11, p01, nu, nv, color, seed, jit, skip) {
    const P = (u, v) => M.lerpv(M.lerpv(p00, p10, u), M.lerpv(p01, p11, u), v);
    for (let i = 0; i < nu; i++) {
      for (let j = 0; j < nv; j++) {
        const u0 = i / nu, u1 = (i + 1) / nu, v0 = j / nv, v1 = (j + 1) / nv;
        if (skip && skip(P((u0 + u1) / 2, (v0 + v1) / 2))) continue;
        mb.quad(P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1),
          C.jitter(color, seed + i * 7 + j * 13, jit === undefined ? 0.075 : jit));
      }
    }
  };

  /**
   * Compartment shell. Authored in the parent group's own space.
   * o: {w, zF, zR, floorY, roofY, glacisZ, wall, floor, roof, ribs}
   */
  Int.hullShell = function (mb, o) {
    const w = o.w, zF = o.zF, zR = o.zR, fy = o.floorY, ry = o.roofY;
    const wall = o.wall, floor = o.floor || C.tint(o.wall, 0.55), roof = o.roof || C.tint(o.wall, 1.08);
    const L = Math.abs(zF - zR);
    // floor with anti slip ribs
    Int.panels(mb, [-w, fy, zR], [w, fy, zR], [w, fy, zF], [-w, fy, zF],
      3, Math.max(3, Math.round(L / 0.9)), floor, 3, 0.09);
    for (let z = zR + 0.2; z < zF; z += 0.34) {
      mb.box(0, fy + 0.012, z, w * 1.9, 0.02, 0.06, C.tint(floor, 1.18));
    }
    // side walls (slightly inclined inwards at the top)
    for (const s of [-1, 1]) {
      Int.panels(mb,
        [s * w, fy, zR], [s * w, fy, zF],
        [s * (w - 0.06), ry, zF], [s * (w - 0.06), ry, zR],
        Math.max(3, Math.round(L / 1.0)), 3, wall, s > 0 ? 11 : 29, 0.07);
      Int.rivets(mb, [s * (w - 0.02), fy + 0.14, zR + 0.2], [s * (w - 0.02), fy + 0.14, zF - 0.2], 9, 0.022, C.tint(wall, 0.8));
      Int.rivets(mb, [s * (w - 0.05), ry - 0.1, zR + 0.2], [s * (w - 0.05), ry - 0.1, zF - 0.2], 9, 0.022, C.tint(wall, 0.8));
      Int.conduit(mb, [[s * (w - 0.1), ry - 0.16, zR + 0.1], [s * (w - 0.1), ry - 0.16, zF - 0.6],
      [s * (w - 0.3), ry - 0.2, zF - 0.3]], 0.022, C.hex('#2f3336'));
      // vertical stiffeners
      for (let k = 0; k < 3; k++) {
        const z = zR + L * (0.25 + k * 0.25);
        mb.box(s * (w - 0.04), (fy + ry) / 2, z, 0.05, (ry - fy) * 0.86, 0.07, C.tint(wall, 0.86));
      }
      // sponson boxes
      mb.box(s * (w - 0.16), fy + 0.28, (zF + zR) / 2, 0.28, 0.5, L * 0.42, C.tint(wall, 0.86));
      // grab handle
      mb.tube([s * (w - 0.24), ry - 0.08, o.glacisZ - 0.35], [s * (w - 0.24), ry - 0.08, o.glacisZ + 0.05],
        0.022, 0.022, 6, C.tint(STEEL, 0.95));
    }
    // roof — with the turret ring left open so the fighting compartment and the
    // driver's compartment are actually one space
    const ringR = o.ringR || 0, ringZ = o.ringZ || 0;
    const holed = ringR > 0
      ? (p) => Math.hypot(p[0], p[2] - ringZ) < ringR
      : null;
    Int.panels(mb, [-w + 0.06, ry, zR], [w - 0.06, ry, zR], [w - 0.06, ry, zF], [-w + 0.06, ry, zF],
      Math.max(4, Math.round(w * 3)), Math.max(4, Math.round(L / 0.7)), roof, 47, 0.055, holed);
    if (ringR > 0) mb.ring([0, ry - 0.01, ringZ], 'y', ringR * 1.12, ringR * 0.98, 16, C.tint(STEEL, 0.7));
    // glacis interior
    Int.panels(mb, [-w, fy, zF], [w, fy, zF], [w - 0.06, ry, o.glacisZ], [-w + 0.06, ry, o.glacisZ],
      4, 2, C.tint(wall, 0.95), 61, 0.06);
    Int.rivets(mb, [-w + 0.2, fy + 0.4, zF - 0.25], [w - 0.2, fy + 0.4, zF - 0.25], 8, 0.024, C.tint(wall, 0.78));
    // rear engine bulkhead with inspection plate and louvers
    Int.panels(mb, [-w, fy, zR], [w, fy, zR], [w - 0.06, ry, zR], [-w + 0.06, ry, zR],
      3, 2, C.tint(wall, 0.88), 83, 0.06);
    mb.box(0, fy + 0.45, zR + 0.05, w * 1.2, 0.7, 0.08, C.tint(wall, 0.78));
    for (let i = 0; i < 5; i++) mb.box(0, fy + 0.2 + i * 0.12, zR + 0.1, w * 1.0, 0.05, 0.03, C.tint(DARK, 1.1));
    // odds and ends: stowed helmet, ration box, first aid tin
    mb.dome([w * 0.5, fy + 0.56, zR + 0.35], 0.14, 8, 2, C.hex('#4a4e42'));
    mb.box(-w * 0.55, fy + 0.62, zR + 0.4, 0.26, 0.18, 0.3, C.hex('#5d5442'));
    mb.box(w * 0.72, ry - 0.24, (zF + zR) / 2 + 0.4, 0.16, 0.2, 0.1, C.hex('#8d3f38'));
    if (o.lamp !== false) Int.lamp(mb, [0, ry - 0.02, (zF + zR) / 2 + 0.3], C.hex('#ffe6b0'));
    if (o.lamp !== false) Int.lamp(mb, [-w * 0.5, ry - 0.02, o.glacisZ - 0.2], C.hex('#ffe6b0'));
  };

  /** turret basket / ring interior, authored in TURRET space */
  Int.turretShell = function (mb, o) {
    const r = o.r, y0 = o.y0, y1 = o.y1, seg = o.seg || 16;
    const wall = o.wall, roof = o.roof || C.tint(o.wall, 1.1);
    const taper = o.taper || 0.92;
    const ym = M.lerp(y0, y1, 0.55);
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * M.TAU, a1 = (i + 1) / seg * M.TAU;
      const at = (a, rr) => [Math.sin(a) * rr, 0, Math.cos(a) * rr];
      const rMid = r * M.lerp(1, taper, 0.55);
      const p0 = at(a0, r), p1 = at(a1, r);
      const m0 = at(a0, rMid), m1 = at(a1, rMid);
      const q0 = at(a0, r * taper), q1 = at(a1, r * taper);
      // lower course
      mb.quad([p0[0], y0, p0[2]], [p1[0], y0, p1[2]], [m1[0], ym, m1[2]], [m0[0], ym, m0[2]],
        C.jitter(wall, i * 3 + 1, 0.075));
      // upper course
      mb.quad([m0[0], ym, m0[2]], [m1[0], ym, m1[2]], [q1[0], y1, q1[2]], [q0[0], y1, q0[2]],
        C.jitter(wall, i * 5 + 7, 0.075));
      // weld band between courses
      mb.quad([m0[0] * 1.005, ym - 0.012, m0[2] * 1.005], [m1[0] * 1.005, ym - 0.012, m1[2] * 1.005],
        [m1[0] * 1.005, ym + 0.012, m1[2] * 1.005], [m0[0] * 1.005, ym + 0.012, m0[2] * 1.005],
        C.tint(wall, 0.82));
      if (i % 2 === 0) {
        mb.box(Math.sin(a0) * (r - 0.03), (y0 + y1) / 2, Math.cos(a0) * (r - 0.03), 0.05, (y1 - y0) * 0.9, 0.05,
          C.tint(wall, 0.84));
      }
      // padded head guard just under the roof
      if (i % 4 === 0) {
        mb.box(Math.sin(a0 + 0.4) * (r - 0.08), y1 - 0.1, Math.cos(a0 + 0.4) * (r - 0.08),
          0.16, 0.09, 0.16, LEATHER);
      }
    }
    // roof plate as a fan so it is not one flat disc
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * M.TAU, a1 = (i + 1) / seg * M.TAU;
      const rr = r * taper;
      mb.tri([0, y1, 0], [Math.sin(a0) * rr, y1, Math.cos(a0) * rr], [Math.sin(a1) * rr, y1, Math.cos(a1) * rr],
        C.jitter(roof, i * 9 + 3, 0.06));
    }
    mb.ring([0, y0, 0], 'y', r * 1.04, r * 0.86, seg, C.tint(STEEL, 0.65));
    // ventilator + wiring loom on the roof
    mb.tube([0.0, y1 - 0.12, o.ventZ === undefined ? 0.45 : o.ventZ], [0, y1, o.ventZ === undefined ? 0.45 : o.ventZ],
      0.12, 0.12, 10, C.tint(STEEL, 0.9));
    Int.conduit(mb, [
      [r * 0.7, y1 - 0.14, -r * 0.5], [r * 0.5, y1 - 0.14, r * 0.4], [0, y1 - 0.16, r * 0.6]
    ], 0.022, C.hex('#2e3235'));
    // basket floor (if any)
    if (o.basketY !== undefined) {
      for (let i = 0; i < seg; i++) {
        const a0 = i / seg * M.TAU, a1 = (i + 1) / seg * M.TAU;
        const rr = r * 0.9;
        mb.tri([0, o.basketY, 0], [Math.sin(a1) * rr, o.basketY, Math.cos(a1) * rr],
          [Math.sin(a0) * rr, o.basketY, Math.cos(a0) * rr],
          C.jitter(o.floor || STEEL, i * 4, 0.09));
      }
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * M.TAU;
        mb.box(Math.sin(a) * r * 0.6, o.basketY + 0.01, Math.cos(a) * r * 0.6, 0.5, 0.02, 0.06, C.tint(STEEL, 1.1));
      }
    }
    if (o.lamp !== false) Int.lamp(mb, [o.lampX || 0.3, y1 - 0.02, o.lampZ || -0.3], C.hex('#ffe0a8'));
  };

  /**
   * Gun breech furniture in TURRET space.
   * Returns the moving breech block mesh so it can recoil / drop open.
   */
  Int.breech = function (mb, o) {
    const y = o.y, z = o.z, col = o.color || STEEL;
    // cradle + trunnions
    mb.box(0, y, z + 0.35, 0.34, 0.34, 0.7, C.tint(col, 0.9));
    for (const s of [-1, 1]) mb.tube([s * 0.22, y, z + 0.5], [s * 0.34, y, z + 0.5], 0.07, 0.07, 8, C.tint(col, 0.8));
    // recoil guard cage
    for (const s of [-1, 1]) {
      mb.box(s * 0.30, y - 0.05, z - 0.1, 0.04, 0.5, 0.9, C.tint(col, 0.75));
      mb.tube([s * 0.30, y + 0.22, z - 0.55], [s * 0.30, y + 0.22, z + 0.3], 0.02, 0.02, 6, C.tint(col, 1.1));
    }
    mb.box(0, y + 0.25, z - 0.55, 0.64, 0.05, 0.06, C.tint(col, 1.05));
    mb.box(0, y - 0.3, z - 0.3, 0.6, 0.05, 0.5, C.tint(col, 0.7));       // deflector tray
    // elevation gear arc + hydraulic buffer
    mb.ring([0.3, y, z + 0.45], 'x', 0.26, 0.2, 12, C.tint(col, 0.85));
    mb.tube([-0.28, y - 0.18, z + 0.2], [-0.28, y - 0.18, z + 0.66], 0.05, 0.05, 8, C.tint(col, 0.95));
    // spent case bag
    mb.box(0, y - 0.42, z - 0.42, 0.4, 0.32, 0.34, C.hex('#4b4034'));
    mb.ring([0, y - 0.26, z - 0.42], 'y', 0.2, 0.16, 10, C.tint(STEEL, 0.7));
    // coaxial machine gun
    if (o.coax) {
      mb.box(o.coaxX, y + 0.02, z + 0.3, 0.14, 0.16, 0.9, C.tint(DARK, 1.15));
      mb.box(o.coaxX, y + 0.14, z - 0.05, 0.12, 0.1, 0.3, C.tint(DARK, 1.3));
      mb.tube([o.coaxX, y + 0.02, z + 0.75], [o.coaxX, y + 0.02, z + 1.1], 0.03, 0.028, 7, BLACK);
    }
    const bb = new MeshBuilder();
    bb.box(0, y, z, 0.36, 0.42, 0.3, C.tint(col, 1.05));
    bb.box(0, y - 0.05, z - 0.16, 0.3, 0.3, 0.04, C.tint(col, 1.2));          // breech face
    bb.tube([0, y - 0.05, z - 0.18], [0, y - 0.05, z - 0.13], 0.075, 0.075, 10, C.hex('#20242a'));
    bb.box(0.19, y + 0.1, z - 0.05, 0.06, 0.1, 0.22, C.tint(col, 0.8));       // opening lever
    bb.box(0, y + 0.24, z, 0.2, 0.06, 0.24, C.tint(col, 0.9));
    return { block: bb.build(), y, z };
  };

  /* ==================================================== control factory */
  function face(f) {
    if (f === undefined) return { yaw: 0, pitch: 0 };
    if (typeof f === 'number') return { yaw: f, pitch: 0 };
    return { yaw: f.yaw || 0, pitch: f.pitch || 0 };
  }
  function hs(o) {
    o.face = face(o.face);
    if (!o.kind) o.kind = 'switch';
    if (!o.color) o.color = C.hex('#b8b2a4');
    if (o.size === undefined) o.size = 1;
    return o;
  }
  const onoff = (v) => L.s(v ? 'ON' : 'OFF');

  const Ctrl = {
    master: (pos, f) => hs({
      id: 'master', label: 'Master Battery Switch', kind: 'switch', pos, face: f, color: C.hex('#c8443a'),
      key: 'm', text: t => onoff(t.sys.master), val: t => t.sys.master ? 1 : 0,
      act: (t) => t.toggleMaster()
    }),
    fuelCock: (pos, f) => hs({
      id: 'fuelcock', label: 'Fuel Shut-off Cock', kind: 'valve', pos, face: f, color: C.hex('#c0a03c'),
      text: t => L.s(t.sys.fuelCock ? 'OPEN' : 'CLOSED'), val: t => t.sys.fuelCock ? 1 : 0,
      act: (t) => t.toggleFuel()
    }),
    starter: (pos, f) => hs({
      id: 'starter', label: 'Starter Button', kind: 'button', pos, face: f, color: C.hex('#3fae5a'),
      key: 'i',
      text: t => t.sys.engineOn ? L.s('RUNNING') : (t.sys.starting > 0 ? L.s('CRANKING') : L.s('press to crank')),
      val: t => t.sys.starting > 0 ? 1 : 0, act: (t) => t.pressStarter()
    }),
    killEngine: (pos, f) => hs({
      id: 'kill', label: 'Engine Stop', kind: 'button', pos, face: f, color: C.hex('#b03428'),
      text: t => L.m(t.sys.engineOn ? 'running' : 'stopped', t.sys.engineOn ? '运转中' : '已停车'),
      val: () => 0, act: (t) => t.stopEngine()
    }),
    gear: (pos, f, label) => hs({
      id: 'gear', label: label || 'Gear Selector', kind: 'lever', pos, face: f, color: C.hex('#2f3236'),
      text: t => L.s(t.gearName()), val: t => M.clamp01((t.sys.gear + 1) / (t.sys.gears + 1)),
      act: (t) => t.shiftUp(), act2: (t) => t.shiftDown(),
      hint: 'click = up a gear, right click = down'
    }),
    brake: (pos, f) => hs({
      id: 'parkbrake', label: 'Parking Brake', kind: 'lever', pos, face: f, color: C.hex('#8e3830'),
      key: 'p', text: t => L.s(t.sys.parkBrake ? 'SET' : 'released'), val: t => t.sys.parkBrake ? 0 : 1,
      act: (t) => t.toggleBrake()
    }),
    tiller: (side, pos, f) => hs({
      id: 'tiller' + side, label: (side < 0 ? 'Left' : 'Right') + ' Steering Tiller', kind: 'lever', pos, face: f,
      color: C.hex('#3a3d41'),
      text: t => L.s((side < 0 ? (t.ctrl.steer < -0.05 ? 'PULLED' : 'centred')
        : (t.ctrl.steer > 0.05 ? 'PULLED' : 'centred'))),
      val: t => M.clamp01(0.5 + (side < 0 ? -t.ctrl.steer : t.ctrl.steer) * 0.5),
      passive: true, hint: 'A / D steer'
    }),
    yoke: (pos, f) => hs({
      id: 'yoke', label: 'Steering Yoke (T-bar)', kind: 'grip', pos, face: f, color: C.hex('#33363a'),
      text: t => L.s(t.ctrl.steer < -0.05 ? 'LEFT' : t.ctrl.steer > 0.05 ? 'RIGHT' : 'centred'),
      val: t => M.clamp01(0.5 + t.ctrl.steer * 0.5), passive: true, hint: 'A / D steer, W / S throttle'
    }),
    pedalThrottle: (pos, f) => hs({
      id: 'throttle', label: 'Accelerator Pedal', kind: 'pedal', pos, face: f, color: C.hex('#3c3f43'),
      text: t => Math.round(t.ctrl.throttle * 100) + '%', val: t => t.ctrl.throttle, passive: true, hint: 'W'
    }),
    pedalBrake: (pos, f) => hs({
      id: 'brakeped', label: 'Brake Pedal', kind: 'pedal', pos, face: f, color: C.hex('#4a3a38'),
      text: t => L.s(t.ctrl.brake > 0.05 ? 'braking' : 'up'), val: t => t.ctrl.brake, passive: true, hint: 'S'
    }),
    gauge: (id, label, pos, f, valFn, textFn) => hs({
      id, label, kind: 'gauge', pos, face: f, color: C.hex('#cfd2c8'),
      val: valFn, text: textFn, passive: true
    }),
    hatch: (id, label, pos, f) => hs({
      id: 'hatch_' + id, label: label, kind: 'lever', pos, face: f, color: C.hex('#7d8085'), hatch: id,
      key: id === 'commander' ? 'h' : null,
      text: t => L.s(t.sys.hatches[id] > 0.5 ? 'OPEN' : 'CLOSED'), val: t => t.sys.hatches[id],
      act: (t) => t.toggleHatch(id)
    }),
    periscope: (id, label, pos, f) => hs({
      id: 'peri_' + id, label: label, kind: 'periscope', pos, face: f, color: GLASS,
      text: () => L.s('click to look through'), val: () => 0,
      act: (t, g) => g.useOptic('periscope', id)
    }),
    sight: (label, pos, f, opts) => hs({
      id: 'gunsight', label: label, kind: 'sight', pos, face: f, color: GLASS, key: 'z',
      text: t => L.s(t.sys.sight.mode.toUpperCase()) + ' x' + t.zoomText(),
      val: () => 0, act: (t, g) => g.useOptic('sight', 'gunner'), size: (opts && opts.size) || 1
    }),
    lights: (which, label, pos, f) => hs({
      id: 'light_' + which, label: label, kind: 'switch', pos, face: f, color: C.hex('#d8c98a'),
      text: t => onoff(t.sys.lights[which]), val: t => t.sys.lights[which] ? 1 : 0,
      act: (t) => t.toggleLight(which)
    }),
    extinguisher: (pos, f) => hs({
      id: 'fireext', label: 'Fire Extinguisher', kind: 'extinguisher', pos, face: f, color: RED,
      text: t => t.sys.fires > 0 ? L.m('FIRE! pull now', '起火！立即喷放')
        : L.s(t.sys.extUsed ? 'discharged' : 'charged'),
      val: () => 0, act: (t) => t.useExtinguisher()
    }),
    intercom: (pos, f) => hs({
      id: 'intercom', label: 'Crew Intercom', kind: 'switch', pos, face: f, color: C.hex('#8fa8b8'),
      text: t => onoff(t.sys.intercom), val: t => t.sys.intercom ? 1 : 0, act: (t) => t.toggleIntercom()
    }),
    bilge: (pos, f) => hs({
      id: 'bilge', label: 'Bilge Pump', kind: 'button', pos, face: f, color: C.hex('#4a8fb0'),
      text: () => L.s('press'), val: () => 0, act: (t) => t.pumpBilge()
    }),
    /* --- gunnery --- */
    turretPower: (pos, f) => hs({
      id: 'turretpower', label: 'Turret Power', kind: 'switch', pos, face: f, color: C.hex('#e0a83c'),
      text: t => onoff(t.sys.turretPower), val: t => t.sys.turretPower ? 1 : 0, act: (t) => t.toggleTurretPower()
    }),
    traverseMode: (pos, f) => hs({
      id: 'travmode', label: 'Traverse Mode', kind: 'knob', pos, face: f, color: C.hex('#b8b2a4'),
      text: t => L.s(t.sys.traverseMode === 'power' ? 'POWER' : 'MANUAL'),
      val: t => t.sys.traverseMode === 'power' ? 1 : 0,
      act: (t) => t.toggleTraverseMode()
    }),
    traverseGrip: (pos, f) => hs({
      id: 'travgrip', label: 'Traverse Control Handle', kind: 'trigger', pos, face: f, color: C.hex('#c04034'),
      text: t => L.m('trigger: FIRE  (' + (t.sys.loaded ? 'loaded ' + t.sys.loaded : 'EMPTY') + ')',
        '扳机：击发（' + (t.sys.loaded ? '已装填 ' + L.shell(t.sys.loaded) : '空膛') + '）'),
      val: t => t.sys.fireHold > 0 ? 1 : 0, act: (t) => t.fire(), hint: 'Q / E traverse, Space fire'
    }),
    elevWheel: (pos, f) => hs({
      id: 'elevwheel', label: 'Elevation Handwheel', kind: 'wheel', pos, face: f, color: C.hex('#4a4d52'),
      text: t => M.deg(t.sys.gunPitch).toFixed(1) + (L.lang === 'zh' ? '°' : ' deg'),
      val: t => (t.sys.gunPitch * 12 + 6) % 26,
      passive: true, hint: 'R / F elevate'
    }),
    traverseWheel: (pos, f) => hs({
      id: 'travwheel', label: 'Manual Traverse Handwheel', kind: 'wheel', pos, face: f, color: C.hex('#4a4d52'),
      text: t => M.deg(M.wrapPi(t.sys.turretYaw)).toFixed(0) + (L.lang === 'zh' ? '°' : ' deg'),
      val: t => (t.sys.turretYaw * 4 + 26) % 26,
      passive: true, hint: 'Q / E traverse'
    }),
    safety: (pos, f) => hs({
      id: 'safety', label: 'Firing Circuit Safety', kind: 'switch', pos, face: f, color: C.hex('#d84f3c'),
      key: 'k', text: t => L.s(t.sys.safety ? 'SAFE' : 'ARMED'), val: t => t.sys.safety ? 0 : 1,
      act: (t) => t.toggleSafety()
    }),
    rangeDial: (pos, f) => hs({
      id: 'rangedial', label: 'Range Drum', kind: 'knob', pos, face: f, color: C.hex('#c8c2b0'),
      text: t => t.sys.sight.range + (L.lang === 'zh' ? ' 米' : ' m'),
      val: t => M.clamp01(t.sys.sight.range / 3000),
      act: (t) => t.adjustRange(200), act2: (t) => t.adjustRange(-200), hint: '[ / ] adjust range'
    }),
    azimuth: (pos, f) => Ctrl.gauge('azimuth', 'Azimuth Indicator', pos, f,
      t => (M.wrapPi(t.sys.turretYaw) / M.TAU + 0.5),
      t => (M.deg(M.wrapPi(t.sys.turretYaw)) | 0) + (L.lang === 'zh' ? '°' : ' deg')),
    zoomLever: (pos, f) => hs({
      id: 'zoom', label: 'Sight Magnification', kind: 'lever', pos, face: f, color: C.hex('#5c6068'),
      text: t => 'x' + t.zoomText(), val: t => t.sys.sight.zoomIdx / Math.max(1, t.spec.optics.zoom.length - 1),
      act: (t) => t.cycleZoom()
    }),
    thermal: (pos, f) => hs({
      id: 'thermal', label: 'Thermal / Night Channel', kind: 'knob', pos, face: f, color: C.hex('#7ac0a0'),
      text: t => L.s(t.sys.sight.mode.toUpperCase()),
      val: t => t.sys.sight.mode === 'day' ? 0 : t.sys.sight.mode === 'night' ? 0.5 : 1,
      act: (t) => t.cycleVision()
    }),
    lrf: (pos, f) => hs({
      id: 'lrf', label: 'Laser Rangefinder', kind: 'button', pos, face: f, color: C.hex('#40b0d0'),
      key: 'l',
      text: t => t.sys.sight.lased
        ? L.m(t.sys.sight.range + ' m LASED', '已测距 ' + t.sys.sight.range + ' 米')
        : L.s('press to lase'),
      val: t => t.sys.sight.laseFlash > 0 ? 1 : 0, act: (t) => t.lase()
    }),
    fcs: (pos, f) => hs({
      id: 'fcs', label: 'Fire Control Computer', kind: 'screen', pos, face: f, color: C.hex('#5ce08c'),
      text: t => L.s(t.sys.fcs ? 'ONLINE  lead/drift solved' : 'OFFLINE — manual holdoff'),
      val: t => t.sys.fcs ? 1 : 0, act: (t) => t.toggleFcs()
    }),
    stab: (pos, f) => hs({
      id: 'stab', label: 'Gun Stabiliser', kind: 'switch', pos, face: f, color: C.hex('#63c0e8'),
      text: t => onoff(t.sys.stab), val: t => t.sys.stab ? 1 : 0, act: (t) => t.toggleStab()
    }),
    coax: (pos, f) => hs({
      id: 'coax', label: 'Coaxial Machine Gun', kind: 'trigger', pos, face: f, color: C.hex('#3a3d41'),
      key: 'c', text: t => t.sys.mgAmmo + L.m(' rds', ' 发'),
      val: t => t.sys.mgFlash > 0 ? 1 : 0, act: (t) => t.fireCoax()
    }),
    /* --- loading --- */
    breechLever: (pos, f) => hs({
      id: 'breech', label: 'Breech Operating Lever', kind: 'lever', pos, face: f, color: C.hex('#8a8d92'),
      key: 'b', text: t => L.s(t.sys.breechOpen ? 'OPEN' : 'CLOSED'), val: t => t.sys.breechOpen ? 1 : 0,
      act: (t) => t.toggleBreech()
    }),
    rammer: (pos, f) => hs({
      id: 'ram', label: 'Ram Round Home', kind: 'button', pos, face: f, color: C.hex('#d0a83c'),
      key: 'r',
      text: t => t.sys.loaded ? L.m('gun loaded: ' + t.sys.loaded, '已装填：' + L.shell(t.sys.loaded))
        : (t.sys.loadT > 0 ? L.m('loading…', '装填中…')
          : L.m('press to load ' + t.sys.shell, '按下装填' + L.shell(t.sys.shell))),
      val: t => t.sys.loadT > 0 ? 1 : 0, act: (t) => t.loadRound()
    }),
    rack: (type, pos, f, o) => {
      o = o || {};
      const slots = [];
      const n = o.slots || 6;
      for (let i = 0; i < n; i++) slots.push([-0.26 + (i % 6) * 0.104, Math.floor(i / 6) * -0.14, 0]);
      return hs({
        id: 'rack_' + type, label: type + ' Ammunition Rack', kind: 'rack', pos, face: f,
        color: o.color || C.hex('#5b5f52'), shellType: type, slots, capacity: n,
        parent: o.parent || null,
        text: t => t.sys.ammo[type] + ' × ' + (t.spec.shells[type] ? t.spec.shells[type].name : type) +
          (t.sys.shell === type ? L.m('  [SELECTED]', '  【已选定】') : ''),
        val: t => M.clamp01(t.sys.ammo[type] / Math.max(1, t.spec.shells[type].n)),
        act: (t) => t.selectShell(type)
      });
    },
    caseBag: (pos, f) => hs({
      id: 'casebag', label: 'Spent Case Bag', kind: 'plate', pos, face: f, color: C.hex('#4b4034'),
      text: t => L.m(t.sys.cases + ' cases', t.sys.cases + ' 个弹壳'), val: () => 0, act: (t) => t.dumpCases()
    }),
    autoloader: (pos, f) => hs({
      id: 'autoloader', label: 'Autoloader Control Panel', kind: 'screen', pos, face: f, color: C.hex('#e8d060'),
      key: 'r',
      text: t => t.sys.loaded ? L.m('READY: ' + t.sys.loaded, '待发：' + L.shell(t.sys.loaded))
        : (t.sys.loadT > 0
          ? L.m('CYCLING ' + Math.round((1 - t.sys.loadT / t.spec.gun.reload) * 100) + '%',
            '上弹中 ' + Math.round((1 - t.sys.loadT / t.spec.gun.reload) * 100) + '%')
          : L.m('press to load ' + t.sys.shell, '按下装填' + L.shell(t.sys.shell))),
      val: t => t.sys.loadT > 0 ? 1 : 0, act: (t) => t.loadRound()
    }),
    carousel: (pos, f) => hs({
      id: 'carousel', label: 'Carousel Type Selector', kind: 'knob', pos, face: f, color: C.hex('#c8c2a8'),
      text: t => L.m('selected: ' + t.sys.shell + '  (' + t.sys.ammo[t.sys.shell] + ' left)',
        '已选：' + L.shell(t.sys.shell) + '（剩 ' + t.sys.ammo[t.sys.shell] + ' 发）'),
      val: t => Object.keys(t.spec.shells).indexOf(t.sys.shell) / Math.max(1, Object.keys(t.spec.shells).length - 1),
      act: (t) => t.cycleShell()
    }),
    /* --- command --- */
    radio: (pos, f, name) => hs({
      id: 'radio', label: name || 'Radio Set', kind: 'radio', pos, face: f, color: C.hex('#4a5148'),
      text: t => t.sys.radio.on
        ? L.m('CH ' + t.sys.radio.chan + '  vol ' + Math.round(t.sys.radio.vol * 10),
          '频道 ' + t.sys.radio.chan + '  音量 ' + Math.round(t.sys.radio.vol * 10))
        : L.s('OFF'),
      val: t => t.sys.radio.on ? 1 : 0, act: (t) => t.toggleRadio(), act2: (t) => t.radioChannel(1)
    }),
    override: (pos, f) => hs({
      id: 'override', label: "Commander's Traverse Override", kind: 'grip', pos, face: f, color: C.hex('#b09040'),
      text: t => L.s(t.sys.override ? 'ENGAGED' : 'released'), val: t => t.sys.override ? 1 : 0,
      act: (t) => t.toggleOverride()
    }),
    designate: (pos, f) => hs({
      id: 'designate', label: 'Designate Target (hunter-killer)', kind: 'button', pos, face: f, color: C.hex('#d05a40'),
      key: 't', text: () => L.m('slew gun to my line of sight', '把火炮转到我的视线方向'),
      val: () => 0, act: (t, g) => t.designate(g)
    }),
    smoke: (pos, f) => hs({
      id: 'smoke', label: 'Smoke Grenade Launchers', kind: 'button', pos, face: f, color: C.hex('#9aa0a8'),
      key: 'x', text: t => L.m(t.sys.smokeLeft + ' salvos', t.sys.smokeLeft + ' 组'),
      val: () => 0, act: (t) => t.fireSmoke()
    }),
    cupolaMG: (pos, f, name) => hs({
      id: 'cupolamg', label: name || 'Cupola Machine Gun', kind: 'trigger', pos, face: f, color: C.hex('#42454a'),
      text: t => t.sys.hatches.commander > 0.5 ? t.sys.mgAmmo + L.m(' rds', ' 发') : L.s('hatch closed'),
      val: () => 0, act: (t) => t.fireCupolaMG()
    }),
    hullMG: (pos, f) => hs({
      id: 'hullmg', label: 'Bow Machine Gun', kind: 'trigger', pos, face: f, color: C.hex('#42454a'),
      text: t => t.sys.mgAmmo + L.m(' rds', ' 发'), val: () => 0, act: (t) => t.fireCoax()
    }),
    mapBoard: (pos, f) => hs({
      id: 'map', label: 'Map Board', kind: 'plate', pos, face: f, color: C.hex('#b8ac86'),
      text: (t, g) => g ? L.m('grid ' + g.gridRef(), '坐标 ' + g.gridRef()) : L.s('map'),
      val: () => 0, act: (t, g) => g.toggleMap()
    }),
    visionBlocks: (pos, f) => hs({
      id: 'vision', label: 'Cupola Vision Blocks', kind: 'periscope', pos, face: f, color: GLASS,
      text: () => L.s('all round view'), val: () => 0, act: (t, g) => g.useOptic('periscope', 'commander')
    })
  };

  /* ================================================= interior assembly = */
  /* ---- line of sight: keep every control visible from its own seat ---- */
  function triSoup(builder, offset) {
    const tris = [];
    const V = offset ? builder.verts.map(v => M.add(v, offset)) : builder.verts;
    for (const f of builder.faces) {
      for (let k = 1; k + 1 < f.i.length; k++) {
        tris.push([V[f.i[0]], V[f.i[k]], V[f.i[k + 1]]]);
      }
    }
    return tris;
  }
  /** Möller–Trumbore, returns distance along d or -1 */
  function rayTri(o, d, a, b, c) {
    const e1 = M.sub(b, a), e2 = M.sub(c, a);
    const p = M.cross(d, e2);
    const det = M.dot(e1, p);
    if (det > -1e-9 && det < 1e-9) return -1;
    const inv = 1 / det;
    const s = M.sub(o, a);
    const u = M.dot(s, p) * inv;
    if (u < 0 || u > 1) return -1;
    const q = M.cross(s, e1);
    const v = M.dot(d, q) * inv;
    if (v < 0 || u + v > 1) return -1;
    const t = M.dot(e2, q) * inv;
    return t > 0.02 ? t : -1;
  }
  /**
   * A hand-authored switch can easily end up behind a gearbox tunnel, a recoil
   * guard or the glacis plate. Rather than hand-tuning hundreds of coordinates,
   * slide each control along the line from its operator's eye until it clears
   * whatever is in the way: the result reads as a control mounted on the
   * nearest surface facing that crewman.
   */
  function deocclude(pos, eye, tris) {
    const d = M.sub(pos, eye);
    const dist = M.len(d);
    if (dist < 0.05) return pos;
    const dir = M.mulv(d, 1 / dist);
    let best = -1;
    for (let i = 0; i < tris.length; i++) {
      const t = tris[i];
      const h = rayTri(eye, dir, t[0], t[1], t[2]);
      if (h > 0.05 && h < dist - 0.04 && (best < 0 || h < best)) best = h;
    }
    if (best < 0) return pos;
    const at = Math.max(0.22, best * 0.86);
    return M.addScaled(eye, dir, Math.min(at, dist));
  }

  /**
   * cfg: {
   *   hull:{...Int.hullShell opts}, turret:{...Int.turretShell opts},
   *   breech:{y,z,coax,coaxX}, extrasHull(mb,spec), extrasTurret(mb,spec),
   *   stations:{ id:{name, parent, eye, yaw, pitch, role, hotspots:[]} }
   * }
   */
  function assemble(spec, cfg) {
    const hullMB = new MeshBuilder(), turMB = new MeshBuilder();
    const tp = global.getTankModel(spec).turretPivot;
    // the hull roof opens onto the turret ring
    cfg.hull.ringR = (cfg.turret.r || 0.85) * 1.02;
    cfg.hull.ringZ = tp[2];
    Int.hullShell(hullMB, cfg.hull);
    Int.turretShell(turMB, cfg.turret);
    const breech = Int.breech(turMB, cfg.breech);
    if (cfg.extrasHull) cfg.extrasHull(hullMB, spec);
    if (cfg.extrasTurret) cfg.extrasTurret(turMB, spec);

    // ---- lay the controls out against the geometry built so far (no seats
    //      yet: a crewman can always reach past his own seat) ----
    const ntp = [-tp[0], -tp[1], -tp[2]];
    const soup = {
      hull: null, turret: null,
      get(space) {
        if (this[space]) return this[space];
        this[space] = space === 'hull'
          ? triSoup(hullMB, null).concat(triSoup(turMB, tp))
          : triSoup(turMB, null).concat(triSoup(hullMB, ntp));
        return this[space];
      }
    };
    const stations = {};
    for (const id in cfg.stations) {
      const st = cfg.stations[id];
      const list = (st.hotspots || []).filter(Boolean);
      for (const h of list) {
        h.station = id;
        if (!h.parent) h.parent = st.parent;
        // the operator's eye, expressed in the hotspot's own space
        let eye = st.eye;
        if (h.parent !== st.parent) {
          eye = h.parent === 'hull' ? M.add(st.eye, tp) : M.add(st.eye, ntp);
        }
        if (!h.fixedPos) h.pos = deocclude(h.pos, eye, soup.get(h.parent));
        // Every control is turned to face the crewman who works it. The `face`
        // written at the call site is only a fallback for hotspots that ask to
        // keep a fixed orientation (fixedFace) — this stops widgets pointing
        // their business end into the armour.
        if (!h.fixedFace) {
          const d = M.sub(eye, h.pos);
          const len = M.len(d);
          if (len > 0.02) {
            const dir = [d[0] / len, d[1] / len, d[2] / len];
            h.face = { yaw: Math.atan2(dir[0], dir[2]), pitch: Math.asin(M.clamp(dir[1], -1, 1)) };
          }
        }
      }
      stations[id] = {
        id, name: st.name, parent: st.parent, eye: st.eye,
        yaw: st.yaw || 0, pitch: st.pitch || 0, fov: st.fov || 72,
        role: st.role || '', hotspots: list, yawRange: st.yawRange || 2.4, pitchRange: st.pitchRange || 1.0,
        optic: st.optic || null
      };
    }

    // seats last, so they never block the controls we just placed
    for (const id in cfg.stations) {
      const st = cfg.stations[id];
      if (st.seat === false) continue;
      const mb = st.parent === 'turret' ? turMB : hullMB;
      Int.seat(mb, [st.eye[0], st.eye[1] - 0.62, st.eye[2] - 0.1], st.yaw || 0, st.seatOpts);
    }
    return {
      hull: hullMB.build(), turret: turMB.build(), breech: breech,
      stations, order: Object.keys(stations),
      ambient: cfg.ambient || 0.30, wall: cfg.hull.wall
    };
  }

  /* ------------------------------------------------------------ Sherman */
  function shermanInterior(spec) {
    const ivory = C.hex('#cfcdc2'), olive = C.hex('#4d5341');
    const deck = 1.72;
    return assemble(spec, {
      ambient: 0.34,
      hull: {
        w: 1.14, zF: 2.6, zR: -1.15, floorY: 0.5, roofY: deck - 0.04, glacisZ: 1.95,
        wall: ivory, floor: C.hex('#4c4f47'), roof: C.tint(ivory, 1.05)
      },
      turret: { r: 0.82, y0: -0.62, y1: 0.68, taper: 0.9, wall: ivory, basketY: -0.62, lampX: -0.3, lampZ: -0.4 },
      breech: { y: -0.02, z: 0.62, color: STEEL, coax: true, coaxX: 0.28 },
      extrasHull(mb) {
        // transmission tunnel and final drive housing between the drivers
        mb.box(0, 0.72, 2.0, 0.62, 0.44, 1.1, C.tint(olive, 1.05));
        mb.tube([-0.5, 0.66, 2.45], [0.5, 0.66, 2.45], 0.24, 0.24, 12, C.tint(olive, 0.95));
        // sponson ammunition bins (wet stowage)
        Int.ammoBin(mb, [-0.92, 0.78, 0.55], [0.36, 0.5, 1.5], olive, 5);
        Int.ammoBin(mb, [0.92, 0.78, 0.55], [0.36, 0.5, 1.5], olive, 5);
        // driver / bow gunner instrument shelf
        mb.box(-0.62, 1.12, 2.44, 0.7, 0.28, 0.1, C.tint(olive, 0.9));
        mb.box(0.6, 1.06, 2.5, 0.5, 0.4, 0.12, C.tint(olive, 0.92));
        Int.conduit(mb, [[-0.95, 1.5, 2.4], [-0.95, 1.5, 1.0], [-0.3, 1.55, 0.6]], 0.03, C.hex('#33373a'));
      },
      extrasTurret(mb) {
        mb.ring([0, -0.62, 0], 'y', 0.86, 0.7, 16, C.tint(STEEL, 0.7));
        // turret basket ready rounds
        for (let i = 0; i < 5; i++) {
          mb.save(); mb.move(-0.62, -0.30 + i * 0.001, -0.5 + i * 0.13).rotX(1.57);
          mb.merge(SHELL_MESH, 0.95); mb.restore();
        }
        mb.box(-0.62, -0.34, -0.2, 0.16, 0.52, 0.8, C.tint(olive, 0.85));
        // gunner's foot rest, azimuth indicator bracket, hydraulic pump
        mb.box(0.5, -0.58, 0.35, 0.34, 0.06, 0.3, C.tint(STEEL, 0.8));
        mb.box(0.62, -0.3, -0.2, 0.22, 0.3, 0.3, C.tint(olive, 0.9));
        mb.tube([0.5, -0.5, -0.4], [0.5, -0.2, -0.4], 0.08, 0.08, 8, C.tint(STEEL, 0.85));
      },
      stations: {
        driver: {
          name: 'Driver', parent: 'hull', role: 'Drives the tank, watches the gauges.',
          eye: [-0.62, 1.24, 1.9], yaw: 0, pitch: -0.24, seatOpts: { color: LEATHER },
          hotspots: [
            // the dash rides on the inside face of the glacis plate:
            // plate height y = 0.5 + (2.6 - z) * 1.815, so everything here stays under it
            Ctrl.gauge('tach', 'Tachometer', [-0.86, 1.00, 2.28], 0, t => t.rpmFrac(), t => Math.round(t.sys.rpm) + ' rpm'),
            Ctrl.gauge('speedo', 'Speedometer', [-0.68, 1.00, 2.28], 0, t => M.clamp01(Math.abs(t.speedKmh()) / spec.maxSpeed), t => Math.abs(t.speedKmh()).toFixed(0) + ' km/h'),
            Ctrl.gauge('fuel', 'Fuel', [-0.50, 1.00, 2.28], 0, t => t.sys.fuel, t => Math.round(t.sys.fuel * 100) + '%'),
            Ctrl.gauge('temp', 'Coolant Temperature', [-0.34, 1.00, 2.28], 0, t => t.sys.coolant, t => Math.round(60 + t.sys.coolant * 60) + ' °C'),
            Ctrl.master([-0.94, 0.74, 2.42]),
            Ctrl.starter([-0.80, 0.74, 2.42]),
            Ctrl.fuelCock([-0.66, 0.74, 2.42]),
            Ctrl.killEngine([-0.52, 0.74, 2.42]),
            Ctrl.lights('interior', 'Compartment Lamp', [-0.38, 0.74, 2.42]),
            Ctrl.lights('exterior', 'Headlamps', [-0.24, 0.74, 2.42]),
            Ctrl.tiller(-1, [-0.92, 0.86, 2.06]),
            Ctrl.tiller(1, [-0.34, 0.86, 2.06]),
            Ctrl.gear([-0.16, 0.80, 1.86], 0, 'Gear Lever (5 speed)'),
            Ctrl.brake([-0.22, 0.72, 2.16]),
            Ctrl.pedalThrottle([-0.44, 0.54, 2.50]),
            Ctrl.pedalBrake([-0.80, 0.54, 2.50]),
            Ctrl.periscope('driver', "Driver's Periscope", [-0.62, 1.50, 1.92]),
            Ctrl.hatch('driver', "Driver's Hatch", [-0.62, 1.58, 1.80]),
            Ctrl.extinguisher([-1.02, 0.86, 1.35]),
            Ctrl.intercom([-1.04, 1.26, 1.75]),
            Ctrl.bilge([-1.02, 0.62, 1.05]),
            Ctrl.hullMG([0.58, 1.02, 2.10])
          ]
        },
        gunner: {
          name: 'Gunner', parent: 'turret', role: 'Lays the gun, fires on command.',
          eye: [0.38, -0.30, 0.08], yaw: 0.02, pitch: -0.04,
          hotspots: [
            Ctrl.sight('M55 Telescopic Sight', [0.30, -0.20, 0.36], { yaw: 0.05 }),
            Ctrl.periscope('gunner', 'M4 Gunner Periscope', [0.46, 0.02, 0.40], { pitch: -0.2 }),
            Ctrl.traverseGrip([0.52, -0.40, 0.30], { yaw: -0.4 }),
            Ctrl.elevWheel([0.64, -0.34, 0.06], { yaw: -1.3 }),
            Ctrl.traverseWheel([0.60, -0.46, -0.12], { yaw: -1.2 }),
            Ctrl.turretPower([0.66, -0.14, 0.26], { yaw: -1.2 }),
            Ctrl.traverseMode([0.68, -0.24, 0.02], { yaw: -1.2 }),
            Ctrl.safety([0.34, -0.36, 0.24], { yaw: 0.2, pitch: 0.4 }),
            Ctrl.rangeDial([0.22, -0.12, 0.42], { yaw: 0.4 }),
            Ctrl.azimuth([0.14, 0.02, 0.40], { yaw: 0.5 }),
            Ctrl.coax([0.30, -0.28, 0.52], { yaw: -0.1 }),
            Ctrl.zoomLever([0.24, -0.26, 0.30], { yaw: 0.5 })
          ]
        },
        loader: {
          name: 'Loader', parent: 'turret', role: 'Feeds the gun, calls "up!".',
          eye: [-0.44, -0.28, -0.06], yaw: 0.55, pitch: -0.15, seat: false,
          hotspots: [
            Ctrl.breechLever([-0.24, -0.06, 0.44], { yaw: 0.4 }),
            Ctrl.rammer([-0.30, -0.20, 0.30], { yaw: 0.5 }),
            Ctrl.rack('AP', [-0.62, -0.26, -0.24], { yaw: 1.4 }, { slots: 8 }),
            Ctrl.rack('HE', [-0.94, 0.86, 0.7], { yaw: 1.5 }, { slots: 6, color: C.hex('#54584a'), parent: 'hull' }),
            Ctrl.rack('SMOKE', [-0.94, 0.86, -0.1], { yaw: 1.5 }, { slots: 4, color: C.hex('#4e5250'), parent: 'hull' }),
            Ctrl.caseBag([-0.06, -0.42, 0.18], { yaw: 0.2, pitch: 0.6 }),
            Ctrl.hatch('loader', "Loader's Hatch", [-0.40, 0.56, -0.16], { pitch: 0.9 }),
            Ctrl.extinguisher([-0.74, -0.24, 0.34], { yaw: 0.9 }),
            Ctrl.lights('interior', 'Compartment Lamp', [-0.68, 0.34, -0.5], { yaw: 1.2 }),
            Ctrl.intercom([-0.70, 0.10, -0.62], { yaw: 1.2 })
          ]
        },
        commander: {
          name: 'Commander', parent: 'turret', role: 'Finds targets, works the radio, runs the crew.',
          eye: [0.34, -0.04, -0.42], yaw: 0, pitch: -0.20,
          hotspots: [
            Ctrl.visionBlocks([0.34, 0.16, -0.10], { pitch: -0.35 }),
            Ctrl.override([0.30, -0.20, -0.06], { yaw: 0.15, pitch: 0.35 }),
            Ctrl.designate([0.52, -0.16, -0.14], { yaw: -0.5, pitch: 0.3 }),
            Ctrl.intercom([0.14, -0.18, -0.12], { yaw: 0.5, pitch: 0.3 }),
            Ctrl.smoke([0.46, -0.28, -0.22], { yaw: -0.35, pitch: 0.5 }),
            Ctrl.hatch('commander', 'Cupola Hatch', [0.34, 0.52, -0.60], { pitch: 0.8 }),
            Ctrl.radio([0.06, -0.02, -0.82], { yaw: 0.1 }, 'SCR 508 Radio'),
            Ctrl.mapBoard([-0.12, -0.24, -0.78], { yaw: 0.4, pitch: 0.4 }),
            Ctrl.cupolaMG([0.60, 0.46, -0.20], { yaw: -0.5 }, 'M2 .50 cal on Cupola')
          ]
        }
      }
    });
  }

  /* ------------------------------------------------------------- T-34-85 */
  function t34Interior(spec) {
    const white = C.hex('#c8c6b6'), green = C.hex('#4a5334');
    const deck = 1.42;
    return assemble(spec, {
      ambient: 0.26,
      hull: {
        w: 1.24, zF: 2.85, zR: -1.55, floorY: 0.46, roofY: deck - 0.05, glacisZ: 2.2,
        wall: white, floor: C.hex('#43473c'), roof: C.tint(white, 1.04)
      },
      turret: { r: 0.86, y0: -0.44, y1: 0.72, taper: 0.86, wall: white, basketY: undefined, lampX: 0.3, lampZ: -0.5 },
      breech: { y: -0.04, z: 0.66, color: C.hex('#63666b'), coax: true, coaxX: -0.26 },
      extrasHull(mb) {
        // driver on the LEFT, hull gunner on the right, transmission at the rear
        mb.box(-0.55, 0.9, 2.6, 0.7, 0.5, 0.16, C.tint(green, 0.95));
        mb.box(0.55, 0.86, 2.62, 0.6, 0.42, 0.14, C.tint(green, 0.92));
        // floor ammunition bins (the famous "sitting on the ammo" layout)
        for (let i = 0; i < 4; i++) {
          Int.ammoBin(mb, [-0.6 + i * 0.42, 0.56, 0.4], [0.4, 0.2, 1.3], green, 3);
        }
        // compressed air bottles + battery
        for (let i = 0; i < 2; i++) mb.tube([-1.08, 0.62 + i * 0.2, 1.6], [-1.08, 0.62 + i * 0.2, 2.3], 0.09, 0.09, 9, C.hex('#5a6b74'));
        mb.box(1.02, 0.66, 1.4, 0.24, 0.3, 0.5, C.hex('#3f4238'));
        Int.conduit(mb, [[1.1, 1.28, 2.5], [1.1, 1.28, 0.4], [0.4, 1.3, -1.4]], 0.028, C.hex('#2f3336'));
      },
      extrasTurret(mb) {
        mb.ring([0, -0.44, 0], 'y', 0.9, 0.74, 16, C.tint(STEEL, 0.65));
        // turret side ready racks (vertical clips)
        for (const s of [-1, 1]) {
          for (let i = 0; i < 4; i++) {
            mb.save(); mb.move(s * 0.7, -0.2 + i * 0.18, -0.35).rotY(s * 1.57).rotX(0.2);
            mb.merge(SHELL_MESH, 0.9); mb.restore();
          }
          mb.box(s * 0.78, -0.05, -0.35, 0.1, 0.8, 0.3, C.tint(green, 0.9));
        }
        mb.box(0.5, -0.36, 0.3, 0.3, 0.06, 0.28, C.tint(STEEL, 0.8));
        // electric traverse motor + turret basket-less floor grating
        mb.box(-0.5, -0.3, 0.42, 0.24, 0.24, 0.3, C.hex('#4d5148'));
      },
      stations: {
        driver: {
          name: 'Driver-Mechanic', parent: 'hull', role: 'Fights the levers and the clutch.',
          eye: [-0.55, 1.12, 2.05], yaw: 0, pitch: -0.24,
          hotspots: [
            // glacis inner face: y = 0.46 + (2.85 - z) * 1.4
            Ctrl.gauge('tach', 'Tachometer', [-0.78, 0.76, 2.58], 0, t => t.rpmFrac(), t => Math.round(t.sys.rpm) + ' rpm'),
            Ctrl.gauge('speedo', 'Speedometer', [-0.60, 0.76, 2.58], 0, t => M.clamp01(Math.abs(t.speedKmh()) / spec.maxSpeed), t => Math.abs(t.speedKmh()).toFixed(0) + ' km/h'),
            Ctrl.gauge('oil', 'Oil Pressure', [-0.42, 0.76, 2.58], 0, t => t.sys.oil, t => (t.sys.oil * 8).toFixed(1) + ' atm'),
            Ctrl.gauge('fuel', 'Fuel', [-0.26, 0.76, 2.58], 0, t => t.sys.fuel, t => Math.round(t.sys.fuel * 100) + '%'),
            Ctrl.master([-0.86, 0.62, 2.68]),
            Ctrl.starter([-0.72, 0.62, 2.68]),
            Ctrl.fuelCock([-0.58, 0.62, 2.68]),
            Ctrl.lights('interior', 'Dome Lamp', [-0.44, 0.62, 2.68]),
            Ctrl.lights('exterior', 'Driving Lamp', [-0.30, 0.62, 2.68]),
            Ctrl.tiller(-1, [-0.90, 0.80, 2.30]),
            Ctrl.tiller(1, [-0.22, 0.80, 2.30]),
            Ctrl.gear([-0.10, 0.74, 2.05], 0, 'Gear Lever (4 speed, no synchro)'),
            Ctrl.pedalThrottle([-0.40, 0.52, 2.72]),
            Ctrl.pedalBrake([-0.72, 0.52, 2.72]),
            Ctrl.periscope('driver', 'Driver Vision Block', [-0.55, 1.20, 2.10]),
            Ctrl.hatch('driver', 'Driver Hatch', [-0.55, 1.28, 2.02]),
            Ctrl.extinguisher([-1.10, 0.76, 1.30]),
            Ctrl.intercom([-1.10, 1.14, 1.80]),
            Ctrl.hullMG([0.55, 0.95, 2.30])
          ]
        },
        gunner: {
          name: 'Gunner', parent: 'turret', role: 'Cramped left side of the turret.',
          eye: [-0.36, -0.16, 0.10], yaw: -0.05, pitch: -0.05,
          hotspots: [
            Ctrl.sight('TSh-16 Telescopic Sight', [-0.28, -0.08, 0.40], { yaw: -0.05 }),
            Ctrl.periscope('gunner', 'MK-4 Periscope', [-0.44, 0.16, 0.34], { pitch: -0.2 }),
            Ctrl.traverseGrip([-0.50, -0.26, 0.26], { yaw: 0.4 }),
            Ctrl.elevWheel([-0.60, -0.22, 0.02], { yaw: 1.3 }),
            Ctrl.traverseWheel([-0.58, -0.34, -0.16], { yaw: 1.2 }),
            Ctrl.turretPower([-0.64, -0.02, 0.22], { yaw: 1.2 }),
            Ctrl.traverseMode([-0.66, -0.12, -0.02], { yaw: 1.2 }),
            Ctrl.safety([-0.30, -0.24, 0.22], { yaw: -0.2, pitch: 0.4 }),
            Ctrl.rangeDial([-0.20, -0.02, 0.44], { yaw: -0.4 }),
            Ctrl.azimuth([-0.12, 0.12, 0.42], { yaw: -0.5 }),
            Ctrl.coax([-0.28, -0.16, 0.54], { yaw: 0.1 }),
            Ctrl.zoomLever([-0.22, -0.16, 0.32], { yaw: -0.5 })
          ]
        },
        loader: {
          name: 'Loader', parent: 'turret', role: 'Right of the gun, working blind and fast.',
          eye: [0.44, -0.14, -0.02], yaw: -0.6, pitch: -0.2, seat: false,
          hotspots: [
            Ctrl.breechLever([0.24, 0.04, 0.44], { yaw: -0.4 }),
            Ctrl.rammer([0.30, -0.08, 0.30], { yaw: -0.5 }),
            Ctrl.rack('AP', [0.70, -0.06, -0.34], { yaw: -1.5 }, { slots: 8 }),
            Ctrl.rack('HE', [0.60, 0.72, 0.9], { yaw: -1.5 }, { slots: 6, color: C.hex('#4f5346'), parent: 'hull' }),
            Ctrl.rack('SMOKE', [-0.60, 0.72, 0.9], { yaw: 1.5 }, { slots: 4, color: C.hex('#4a4e4c'), parent: 'hull' }),
            Ctrl.caseBag([0.06, -0.30, 0.18], { yaw: -0.2, pitch: 0.6 }),
            Ctrl.hatch('loader', 'Loader Hatch', [0.40, 0.60, -0.10], { pitch: 0.9 }),
            Ctrl.extinguisher([0.76, -0.10, 0.30], { yaw: -0.9 }),
            Ctrl.intercom([0.68, 0.22, -0.56], { yaw: -1.2 })
          ]
        },
        commander: {
          name: 'Commander', parent: 'turret', role: 'Cupola on the left rear, doubles as gunner\'s boss.',
          eye: [-0.34, 0.06, -0.40], yaw: 0, pitch: -0.20,
          hotspots: [
            Ctrl.visionBlocks([-0.34, 0.26, -0.10], { pitch: -0.35 }),
            Ctrl.override([-0.30, -0.10, -0.06], { yaw: -0.15, pitch: 0.35 }),
            Ctrl.designate([-0.52, -0.06, -0.14], { yaw: 0.5, pitch: 0.3 }),
            Ctrl.intercom([-0.14, -0.08, -0.12], { yaw: -0.5, pitch: 0.3 }),
            Ctrl.smoke([-0.46, -0.18, -0.22], { yaw: 0.35, pitch: 0.5 }),
            Ctrl.hatch('commander', 'Cupola Hatch', [-0.34, 0.58, -0.58], { pitch: 0.8 }),
            Ctrl.radio([-0.02, 0.10, -0.80], { yaw: -0.1 }, '9-RS Radio Set'),
            Ctrl.mapBoard([0.14, -0.10, -0.76], { yaw: -0.4, pitch: 0.4 })
          ]
        }
      }
    });
  }

  /* -------------------------------------------------------------- Tiger */
  function tigerInterior(spec) {
    const ivory = C.hex('#d2cfc0'), grey = C.hex('#6c6f68'), yellow = C.hex('#8a7b4e');
    const deck = 1.52;
    return assemble(spec, {
      ambient: 0.30,
      hull: {
        w: 1.42, zF: 2.9, zR: -1.6, floorY: 0.52, roofY: deck + 0.02, glacisZ: 2.35,
        wall: ivory, floor: C.hex('#4a4c46'), roof: C.tint(ivory, 1.03)
      },
      turret: { r: 0.94, y0: -0.5, y1: 0.78, taper: 0.94, wall: ivory, basketY: -0.5, lampX: -0.34, lampZ: -0.44 },
      breech: { y: 0.0, z: 0.6, color: grey, coax: true, coaxX: 0.3 },
      extrasHull(mb) {
        // Maybach transmission tunnel, driver left with a real steering wheel
        mb.box(0, 0.8, 1.9, 0.8, 0.56, 1.6, C.tint(grey, 1.02));
        mb.box(0, 1.1, 2.66, 1.0, 0.5, 0.2, C.tint(grey, 0.94));
        mb.tube([-0.4, 0.9, 2.7], [0.4, 0.9, 2.7], 0.16, 0.16, 10, C.tint(grey, 0.9));
        // radio operator's set on the right, ammo bins under the sponsons
        mb.box(0.9, 1.0, 2.1, 0.5, 0.44, 0.6, C.hex('#4c5148'));
        Int.ammoBin(mb, [-1.14, 0.82, 0.6], [0.3, 0.55, 1.7], yellow, 6);
        Int.ammoBin(mb, [1.14, 0.82, 0.6], [0.3, 0.55, 1.7], yellow, 6);
        Int.conduit(mb, [[-1.2, 1.42, 2.6], [-1.2, 1.42, 0.2], [-0.5, 1.46, -1.4]], 0.03, C.hex('#31353a'));
        mb.box(0, 0.66, -1.35, 1.4, 0.35, 0.3, C.tint(grey, 0.85));   // firewall shelf
      },
      extrasTurret(mb) {
        mb.ring([0, -0.5, 0], 'y', 0.98, 0.8, 16, C.tint(STEEL, 0.68));
        // turret ready rounds around the ring
        for (let i = 0; i < 6; i++) {
          const a = -0.9 + i * 0.3;
          mb.save(); mb.move(Math.sin(a) * 0.82, -0.26, Math.cos(a) * 0.82 - 0.2).rotY(a).rotX(1.4);
          mb.merge(SHELL_MESH, 0.95); mb.restore();
        }
        // hydraulic traverse motor + gunner foot pedal plate + turntable
        mb.box(0.44, -0.42, 0.3, 0.3, 0.24, 0.34, C.tint(grey, 0.95));
        mb.disc([0, -0.49, 0], 'y', 0.86, 16, C.hex('#585c54'));
        mb.box(-0.5, -0.3, -0.6, 0.4, 0.4, 0.24, C.hex('#4a4e46'));   // radio repeater
      },
      stations: {
        driver: {
          name: 'Driver', parent: 'hull', role: 'Steering wheel, pre-selector gearbox, 57 tonnes.',
          eye: [-0.62, 1.22, 2.0], yaw: 0, pitch: -0.24,
          hotspots: [
            // glacis inner face: y = 0.52 + (2.9 - z) * 1.855
            Ctrl.gauge('tach', 'Drehzahlmesser', [-0.92, 0.78, 2.72], 0, t => t.rpmFrac(), t => Math.round(t.sys.rpm) + ' U/min'),
            Ctrl.gauge('speedo', 'Tachometer', [-0.74, 0.78, 2.72], 0, t => M.clamp01(Math.abs(t.speedKmh()) / spec.maxSpeed), t => Math.abs(t.speedKmh()).toFixed(0) + ' km/h'),
            Ctrl.gauge('temp', 'Kühlwasser', [-0.56, 0.78, 2.72], 0, t => t.sys.coolant, t => Math.round(60 + t.sys.coolant * 60) + ' °C'),
            Ctrl.gauge('oil', 'Öldruck', [-0.38, 0.78, 2.72], 0, t => t.sys.oil, t => (t.sys.oil * 8).toFixed(1) + ' atü'),
            Ctrl.master([-1.00, 0.62, 2.80]),
            Ctrl.starter([-0.86, 0.62, 2.80]),
            Ctrl.fuelCock([-0.72, 0.62, 2.80]),
            Ctrl.killEngine([-0.58, 0.62, 2.80]),
            Ctrl.lights('interior', 'Innenlampe', [-0.44, 0.62, 2.80]),
            Ctrl.lights('exterior', 'Notek Lamp', [-0.30, 0.62, 2.80]),
            hs({
              id: 'wheel', label: 'Steering Wheel', kind: 'wheel', pos: [-0.62, 1.00, 2.50],
              color: C.hex('#2f3236'), passive: true, hint: 'A / D steer',
              text: t => t.ctrl.steer < -0.05 ? 'LEFT' : t.ctrl.steer > 0.05 ? 'RIGHT' : 'centred',
              val: t => 13 + t.ctrl.steer * 6
            }),
            Ctrl.gear([-0.18, 0.86, 2.10], 0, 'Maybach Olvar Pre-selector'),
            Ctrl.brake([-0.30, 0.76, 2.34]),
            Ctrl.pedalThrottle([-0.46, 0.56, 2.78]),
            Ctrl.pedalBrake([-0.84, 0.56, 2.78]),
            Ctrl.periscope('driver', 'Fahrersehklappe (visor)', [-0.62, 1.34, 2.30]),
            Ctrl.hatch('driver', 'Driver Hatch', [-0.62, 1.44, 2.16]),
            Ctrl.extinguisher([-1.28, 0.86, 1.30]),
            Ctrl.intercom([-1.28, 1.22, 1.80]),
            Ctrl.hullMG([0.72, 1.04, 2.40]),
            Ctrl.radio([0.92, 1.06, 2.24], 0, 'Fu 5 Radio (operator)')
          ]
        },
        gunner: {
          name: 'Gunner', parent: 'turret', role: 'Binocular sight, foot pedal hydraulic traverse.',
          eye: [-0.36, -0.14, 0.12], yaw: -0.04, pitch: -0.05,
          hotspots: [
            Ctrl.sight('TZF 9b Binocular Sight', [-0.28, -0.06, 0.42], { yaw: -0.04 }, { size: 1.15 }),
            Ctrl.traverseGrip([-0.52, -0.24, 0.28], { yaw: 0.4 }),
            Ctrl.elevWheel([-0.62, -0.20, 0.04], { yaw: 1.3 }),
            Ctrl.traverseWheel([-0.60, -0.34, -0.14], { yaw: 1.2 }),
            hs({
              id: 'travpedal', label: 'Hydraulic Traverse Pedal', kind: 'pedal', pos: [-0.34, -0.46, 0.42],
              face: { pitch: 0.85 }, color: C.hex('#3e4146'), passive: true, hint: 'Q / E traverse',
              text: t => t.sys.traverseMode === 'power' ? 'live' : 'no hydraulics', val: t => Math.abs(t.ctrl.traverse)
            }),
            Ctrl.turretPower([-0.66, 0.00, 0.24], { yaw: 1.2 }),
            Ctrl.traverseMode([-0.68, -0.10, 0.00], { yaw: 1.2 }),
            Ctrl.safety([-0.30, -0.22, 0.24], { yaw: -0.2, pitch: 0.4 }),
            Ctrl.rangeDial([-0.20, 0.00, 0.46], { yaw: -0.4 }),
            Ctrl.azimuth([-0.12, 0.14, 0.44], { yaw: -0.5 }),
            Ctrl.coax([-0.26, -0.14, 0.56], { yaw: 0.1 }),
            Ctrl.zoomLever([-0.22, -0.14, 0.34], { yaw: -0.5 })
          ]
        },
        loader: {
          name: 'Loader', parent: 'turret', role: '88 mm rounds weigh 22 kg. Lift with the legs.',
          eye: [0.46, -0.12, 0.0], yaw: -0.6, pitch: -0.2, seat: false,
          hotspots: [
            Ctrl.breechLever([0.26, 0.06, 0.42], { yaw: -0.4 }),
            Ctrl.rammer([0.32, -0.06, 0.28], { yaw: -0.5 }),
            Ctrl.rack('AP', [0.78, -0.04, -0.36], { yaw: -1.5 }, { slots: 8 }),
            Ctrl.rack('HE', [1.16, 0.86, 0.6], { yaw: -1.5 }, { slots: 6, color: C.hex('#7d7148'), parent: 'hull' }),
            Ctrl.rack('HEAT', [1.16, 0.86, -0.4], { yaw: -1.5 }, { slots: 4, color: C.hex('#6f6a48'), parent: 'hull' }),
            Ctrl.caseBag([0.08, -0.28, 0.16], { yaw: -0.2, pitch: 0.6 }),
            Ctrl.hatch('loader', 'Loader Hatch', [0.34, 0.62, -0.16], { pitch: 0.9 }),
            Ctrl.extinguisher([0.84, -0.08, 0.30], { yaw: -0.9 }),
            Ctrl.intercom([0.74, 0.24, -0.54], { yaw: -1.2 }),
            hs({
              id: 'escape', label: 'Turret Escape Hatch', kind: 'lever', pos: [0.86, -0.02, -0.5],
              face: { yaw: -1.5 }, color: C.hex('#8d8f92'),
              text: () => 'dogged shut', val: () => 0, act: () => 'Escape hatch dogged shut — combat locked.'
            })
          ]
        },
        commander: {
          name: 'Commander', parent: 'turret', role: 'Cupola left rear, five vision slits.',
          eye: [-0.40, 0.10, -0.46], yaw: 0, pitch: -0.20,
          hotspots: [
            Ctrl.visionBlocks([-0.40, 0.30, -0.16], { pitch: -0.35 }),
            Ctrl.override([-0.36, -0.06, -0.12], { yaw: -0.15, pitch: 0.35 }),
            Ctrl.designate([-0.58, -0.02, -0.20], { yaw: 0.5, pitch: 0.3 }),
            Ctrl.intercom([-0.20, -0.04, -0.18], { yaw: -0.5, pitch: 0.3 }),
            Ctrl.smoke([-0.52, -0.14, -0.26], { yaw: 0.35, pitch: 0.5 }),
            Ctrl.hatch('commander', 'Cupola Hatch', [-0.40, 0.62, -0.64], { pitch: 0.8 }),
            Ctrl.radio([-0.06, 0.14, -0.86], { yaw: -0.1 }, 'Fu 5 Turret Repeater'),
            Ctrl.mapBoard([0.10, -0.06, -0.82], { yaw: -0.4, pitch: 0.4 })
          ]
        }
      }
    });
  }

  /* -------------------------------------------------------------- T-72B3 */
  function t72Interior(spec) {
    const white = C.hex('#b9bfa8'), black = C.hex('#2c2f31'), green = C.hex('#4b5438');
    const deck = 1.30;
    return assemble(spec, {
      ambient: 0.24,
      hull: {
        w: 1.16, zF: 3.0, zR: -1.9, floorY: 0.46, roofY: deck - 0.02, glacisZ: 2.1,
        wall: white, floor: C.hex('#3f423c'), roof: C.tint(white, 1.04)
      },
      turret: { r: 0.92, y0: -0.62, y1: 0.60, taper: 0.8, wall: white, basketY: -0.62, lampX: 0.34, lampZ: -0.4 },
      breech: { y: -0.06, z: 0.5, color: C.hex('#5e6165'), coax: true, coaxX: 0.22 },
      extrasHull(mb) {
        // driver sits on the centreline, knees under the glacis
        mb.box(0, 0.9, 2.7, 0.9, 0.45, 0.14, C.tint(black, 1.2));
        mb.box(0, 0.62, 2.4, 0.5, 0.2, 0.5, C.tint(green, 0.95));
        // fuel cells and the carousel well
        for (const s of [-1, 1]) mb.box(s * 0.95, 0.72, 1.6, 0.34, 0.5, 1.4, C.tint(green, 0.92));
        mb.tube([0, 0.5, -0.2], [0, 0.52, -0.2], 1.02, 1.02, 20, C.hex('#4a4d47'));
        Int.conduit(mb, [[-1.0, 1.2, 2.6], [-1.0, 1.2, 0.6], [-0.4, 1.24, -1.6]], 0.03, C.hex('#2b2e31'));
        mb.box(0, 0.66, -1.8, 1.6, 0.4, 0.2, C.tint(green, 0.88));
      },
      extrasTurret(mb) {
        // the carousel: 22 rounds lying flat under the turret floor
        mb.ring([0, -0.66, 0], 'y', 1.0, 0.42, 22, C.hex('#54584e'));
        for (let i = 0; i < 22; i++) {
          const a = i / 22 * M.TAU;
          mb.save();
          mb.move(Math.sin(a) * 0.72, -0.6, Math.cos(a) * 0.72).rotY(a + 1.57).rotX(1.57);
          mb.merge(SHELL_MESH, 0.85);
          mb.restore();
        }
        // autoloader hoist arm and the ejection port
        mb.box(0.0, -0.4, -0.5, 0.3, 0.5, 0.3, C.tint(black, 1.3));
        mb.box(0, 0.2, -0.86, 0.34, 0.34, 0.12, C.tint(black, 1.1));
        // gunner boxes: Sosna-U head, ballistic computer, stabiliser amp
        mb.box(-0.5, 0.06, 0.5, 0.42, 0.4, 0.4, C.tint(black, 1.25));
        mb.box(-0.72, -0.2, 0.1, 0.28, 0.5, 0.44, C.tint(black, 1.15));
        mb.box(0.78, -0.16, -0.50, 0.20, 0.40, 0.40, C.tint(black, 1.1));
        mb.disc([0, -0.63, 0], 'y', 0.4, 12, C.hex('#4f534a'));
      },
      stations: {
        driver: {
          name: 'Driver', parameters: null, parent: 'hull', role: 'Reclined on the centreline, tillers in both hands.',
          eye: [0, 1.06, 2.15], yaw: 0, pitch: -0.26,
          hotspots: [
            // glacis inner face: y = 0.46 + (3.0 - z) * 0.911
            Ctrl.gauge('tach', 'Tachometer', [-0.28, 0.74, 2.60], 0, t => t.rpmFrac(), t => Math.round(t.sys.rpm) + ' rpm'),
            Ctrl.gauge('speedo', 'Speedometer', [-0.10, 0.74, 2.60], 0, t => M.clamp01(Math.abs(t.speedKmh()) / spec.maxSpeed), t => Math.abs(t.speedKmh()).toFixed(0) + ' km/h'),
            Ctrl.gauge('fuel', 'Fuel', [0.08, 0.74, 2.60], 0, t => t.sys.fuel, t => Math.round(t.sys.fuel * 100) + '%'),
            Ctrl.gauge('temp', 'Coolant', [0.26, 0.74, 2.60], 0, t => t.sys.coolant, t => Math.round(60 + t.sys.coolant * 60) + ' °C'),
            Ctrl.master([-0.40, 0.62, 2.72]),
            Ctrl.starter([-0.26, 0.62, 2.72]),
            Ctrl.fuelCock([-0.12, 0.62, 2.72]),
            Ctrl.lights('interior', 'Dome Lamp', [0.02, 0.62, 2.72]),
            Ctrl.lights('exterior', 'Driving Lamps', [0.16, 0.62, 2.72]),
            Ctrl.tiller(-1, [-0.52, 0.78, 2.40]),
            Ctrl.tiller(1, [0.52, 0.78, 2.40]),
            Ctrl.gear([0.30, 0.72, 2.16], 0, 'Gear Lever (7 speed)'),
            Ctrl.pedalThrottle([0.22, 0.52, 2.80]),
            Ctrl.pedalBrake([-0.22, 0.52, 2.80]),
            Ctrl.periscope('driver', 'TNPO-168 Vision Block', [0, 1.16, 2.02]),
            Ctrl.hatch('driver', 'Driver Hatch', [0, 1.20, 1.92]),
            Ctrl.extinguisher([-1.02, 0.74, 1.30]),
            Ctrl.intercom([-1.02, 1.08, 1.80]),
            hs({
              id: 'ppo', label: 'PPO Automatic Fire Suppression', kind: 'button', pos: [0.9, 1.00, 2.20],
              color: C.hex('#c85030'),
              text: t => t.sys.fires > 0 ? 'FIRE DETECTED' : 'armed', val: () => 0, act: (t) => t.useExtinguisher()
            }),
            hs({
              id: 'snorkel', label: 'OPVT Snorkel Prep', kind: 'switch', pos: [0.9, 0.86, 2.00],
              color: C.hex('#7fa8c8'),
              text: t => t.sys.snorkel ? 'RIGGED' : 'stowed', val: t => t.sys.snorkel ? 1 : 0,
              act: (t) => { t.sys.snorkel = !t.sys.snorkel; return 'Snorkel ' + (t.sys.snorkel ? 'rigged for deep fording.' : 'stowed.'); }
            })
          ]
        },
        gunner: {
          name: 'Gunner', parent: 'turret', role: 'Sosna-U thermal, 2E42 stabiliser, autoloader trigger.',
          eye: [-0.40, -0.20, 0.06], yaw: -0.04, pitch: -0.05,
          hotspots: [
            Ctrl.sight('1A40-4 / Sosna-U Sight', [-0.34, -0.10, 0.34], { yaw: -0.04 }, { size: 1.1 }),
            Ctrl.thermal([-0.20, -0.06, 0.42], { yaw: -0.4 }),
            Ctrl.lrf([-0.24, -0.18, 0.40], { yaw: -0.4 }),
            Ctrl.traverseGrip([-0.54, -0.30, 0.24], { yaw: 0.4 }),
            Ctrl.elevWheel([-0.64, -0.26, 0.02], { yaw: 1.3 }),
            Ctrl.stab([-0.66, -0.04, 0.22], { yaw: 1.2 }),
            Ctrl.turretPower([-0.66, 0.06, 0.22], { yaw: 1.2 }),
            Ctrl.traverseMode([-0.68, -0.14, -0.02], { yaw: 1.2 }),
            Ctrl.safety([-0.32, -0.28, 0.22], { yaw: -0.2, pitch: 0.4 }),
            Ctrl.autoloader([-0.14, -0.02, 0.36], { yaw: -0.5 }),
            Ctrl.carousel([-0.10, -0.20, 0.34], { yaw: -0.5 }),
            Ctrl.fcs([0.16, 0.02, 0.30], { yaw: -0.8 }),
            Ctrl.coax([-0.28, -0.22, 0.50], { yaw: 0.1 }),
            Ctrl.azimuth([-0.06, 0.10, 0.36], { yaw: -0.6 }),
            Ctrl.hatch('gunner', 'Gunner Hatch', [-0.54, 0.44, -0.18], { pitch: 0.9 })
          ]
        },
        commander: {
          name: 'Commander', parent: 'turret', role: 'Also the loader-of-last-resort if the carousel jams.',
          eye: [0.42, -0.10, -0.24], yaw: 0, pitch: -0.26,
          hotspots: [
            Ctrl.visionBlocks([0.46, 0.08, 0.06], { pitch: -0.35 }),
            Ctrl.override([0.42, -0.28, 0.04], { yaw: 0.15, pitch: 0.35 }),
            Ctrl.designate([0.58, -0.26, 0.02], { yaw: -0.5, pitch: 0.3 }),
            Ctrl.intercom([0.24, -0.26, 0.0], { yaw: 0.5, pitch: 0.3 }),
            Ctrl.smoke([0.30, -0.32, -0.10], { yaw: 0.35, pitch: 0.5 }),
            hs({
              id: 'carouselload', label: 'Manual Carousel Reload', kind: 'lever', pos: [0.52, -0.36, -0.06],
              face: { yaw: -0.3, pitch: 0.4 }, color: C.hex('#a08840'),
              text: t => L.m('restock carousel (' + t.sys.ammo[t.sys.shell] + ' ' + t.sys.shell + ')',
                '补充转盘（' + t.sys.ammo[t.sys.shell] + ' 发' + L.shell(t.sys.shell) + '）'),
              val: () => 0, act: (t) => t.loadRound()
            }),
            Ctrl.hatch('commander', 'Cupola Hatch', [0.46, 0.44, -0.44], { pitch: 0.8 }),
            Ctrl.cupolaMG([0.62, 0.34, 0.06], { yaw: -0.5 }, 'NSVT 12.7 mm'),
            Ctrl.radio([0.24, 0.02, -0.72], { yaw: 0.3 }, 'R-168 Akveduk Radio'),
            Ctrl.mapBoard([0.06, -0.20, -0.66], { yaw: 0.5, pitch: 0.4 })
          ]
        }
      }
    });
  }

  /* -------------------------------------------------------------- M1A2 */
  function abramsInterior(spec) {
    const grey = C.hex('#b0b0a6'), black = C.hex('#2a2c2e'), tan = C.hex('#8a8266');
    const deck = 1.42;
    return assemble(spec, {
      ambient: 0.28,
      hull: {
        w: 1.4, zF: 3.3, zR: -2.4, floorY: 0.5, roofY: deck - 0.02, glacisZ: 1.9,
        wall: grey, floor: C.hex('#3d3f3c'), roof: C.tint(grey, 1.04)
      },
      turret: { r: 1.15, y0: -0.7, y1: 0.72, taper: 0.9, wall: grey, basketY: -0.7, lampX: -0.4, lampZ: -0.5 },
      breech: { y: -0.02, z: 0.55, color: C.hex('#5a5c5e'), coax: true, coaxX: 0.34 },
      extrasHull(mb) {
        // reclined driver's tub on the centreline
        mb.box(0, 0.82, 2.9, 1.0, 0.4, 0.2, C.tint(black, 1.2));
        mb.box(0, 0.6, 2.55, 0.7, 0.16, 0.6, C.tint(grey, 0.9));
        // hull ammunition compartment behind blast doors + fuel cells
        for (const s of [-1, 1]) {
          mb.box(s * 1.16, 0.86, 0.4, 0.34, 0.7, 2.0, C.tint(tan, 0.92));
          mb.box(s * 0.98, 0.86, 0.4, 0.05, 0.62, 1.9, C.hex('#6e6f66'));
          for (let i = 0; i < 3; i++) mb.box(s * 0.95, 0.86, -0.3 + i * 0.6, 0.03, 0.5, 0.4, C.hex('#8a8b80'));
        }
        // turbine firewall with its NBC ducting
        mb.box(0, 0.9, -2.3, 2.4, 0.9, 0.2, C.tint(grey, 0.86));
        Int.conduit(mb, [[-1.2, 1.3, 2.4], [-1.2, 1.3, -2.1], [0, 1.34, -2.2]], 0.05, C.hex('#5c5f58'));
        mb.box(0.9, 1.1, -1.6, 0.5, 0.4, 0.5, C.hex('#43464a'));
      },
      extrasTurret(mb) {
        mb.ring([0, -0.7, 0], 'y', 1.2, 1.0, 20, C.tint(STEEL, 0.7));
        // semi ready ammo behind sliding blast doors (bustle)
        mb.box(0, -0.12, -1.0, 1.5, 0.75, 0.4, C.tint(tan, 0.9));
        for (let i = 0; i < 2; i++) mb.box(-0.35 + i * 0.7, -0.12, -0.78, 0.62, 0.66, 0.06, C.hex('#71736a'));
        for (let i = 0; i < 8; i++) {
          mb.save();
          mb.move(-0.55 + (i % 4) * 0.36, -0.34 + Math.floor(i / 4) * 0.34, -1.0).rotX(1.57);
          mb.merge(SHELL_MESH, 0.9);
          mb.restore();
        }
        // digital boxes everywhere: GPS head, CITV, computer, hydraulics
        mb.box(0.52, 0.16, 0.6, 0.5, 0.5, 0.5, C.tint(black, 1.2));
        mb.box(-0.5, 0.3, 0.3, 0.4, 0.4, 0.4, C.tint(black, 1.15));
        mb.box(-0.9, -0.2, -0.2, 0.3, 0.6, 0.7, C.tint(black, 1.1));
        mb.box(0.95, -0.25, -0.3, 0.28, 0.55, 0.6, C.tint(black, 1.05));
        mb.disc([0, -0.71, 0], 'y', 1.0, 20, C.hex('#4a4c48'));
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * M.TAU;
          mb.box(Math.sin(a) * 0.8, -0.69, Math.cos(a) * 0.8, 0.5, 0.02, 0.08, C.hex('#5e625c'));
        }
      },
      stations: {
        driver: {
          name: 'Driver', parent: 'hull', role: 'Lying back on the centreline behind a T-bar.',
          eye: [0, 1.02, 2.45], yaw: 0, pitch: -0.26,
          hotspots: [
            // glacis inner face: y = 0.5 + (3.3 - z) * 0.643
            Ctrl.gauge('tach', 'Turbine RPM', [-0.34, 0.68, 2.90], 0, t => t.rpmFrac(), t => Math.round(t.sys.rpm) + ' rpm'),
            Ctrl.gauge('speedo', 'Speedometer', [-0.14, 0.68, 2.90], 0, t => M.clamp01(Math.abs(t.speedKmh()) / spec.maxSpeed), t => Math.abs(t.speedKmh()).toFixed(0) + ' km/h'),
            Ctrl.gauge('fuel', 'Fuel (JP-8)', [0.06, 0.68, 2.90], 0, t => t.sys.fuel, t => Math.round(t.sys.fuel * 100) + '%'),
            Ctrl.gauge('temp', 'Turbine Temp', [0.26, 0.68, 2.90], 0, t => t.sys.coolant, t => Math.round(200 + t.sys.coolant * 600) + ' °C'),
            Ctrl.master([-0.44, 0.58, 3.00]),
            Ctrl.starter([-0.30, 0.58, 3.00]),
            Ctrl.fuelCock([-0.16, 0.58, 3.00]),
            Ctrl.killEngine([-0.02, 0.58, 3.00]),
            Ctrl.lights('interior', 'Dome Lamp', [0.12, 0.58, 3.00]),
            Ctrl.lights('exterior', 'Blackout Drive Lamps', [0.26, 0.58, 3.00]),
            Ctrl.yoke([0, 0.76, 2.75]),
            Ctrl.gear([0.38, 0.72, 2.50], 0, 'Range Selector (D / N / R / PIVOT)'),
            Ctrl.pedalThrottle([0.2, 0.54, 3.05]),
            Ctrl.pedalBrake([-0.2, 0.54, 3.05]),
            Ctrl.periscope('driver', 'Driver Vision Blocks', [0, 1.24, 1.86]),
            Ctrl.hatch('driver', 'Driver Hatch', [0, 1.30, 1.78]),
            Ctrl.extinguisher([-1.24, 0.78, 1.5]),
            Ctrl.intercom([-1.24, 1.1, 2.0]),
            hs({
              id: 'ddu', label: 'Driver Display Unit', kind: 'screen', pos: [0.44, 0.80, 2.60],
              color: C.hex('#68e0a0'),
              text: t => L.m('gear ' + t.gearName() + '  fuel ' + Math.round(t.sys.fuel * 100) + '%  ' +
                (t.sys.engineOn ? 'AGT-1500 running' : 'turbine off'),
                '档位 ' + L.s(t.gearName()) + '  燃油 ' + Math.round(t.sys.fuel * 100) + '%  ' +
                (t.sys.engineOn ? 'AGT-1500 运转中' : '燃气轮机停车')),
              val: t => t.sys.master ? 1 : 0, act: (t) => t.pumpBilge()
            }),
            hs({
              id: 'apu', label: 'Auxiliary Power Unit', kind: 'switch', pos: [0.62, 0.86, 2.40],
              color: C.hex('#7fc8e8'),
              text: t => t.sys.apu ? 'RUNNING (silent watch)' : 'off', val: t => t.sys.apu ? 1 : 0,
              act: (t) => { t.sys.apu = !t.sys.apu; return 'APU ' + (t.sys.apu ? 'online — silent watch power.' : 'shut down.'); }
            })
          ]
        },
        gunner: {
          name: 'Gunner', parent: 'turret', role: 'GPS thermal sight, ballistic computer, cadillacs.',
          eye: [0.44, -0.24, 0.14], yaw: 0.03, pitch: -0.05,
          hotspots: [
            Ctrl.sight('M1A2 GPS (Gunner Primary Sight)', [0.4, -0.12, 0.42], { yaw: 0.03 }, { size: 1.2 }),
            Ctrl.thermal([0.22, -0.06, 0.46], { yaw: 0.4 }),
            Ctrl.zoomLever([0.24, -0.2, 0.44], { yaw: 0.4 }),
            Ctrl.lrf([0.16, -0.14, 0.44], { yaw: 0.5 }),
            Ctrl.traverseGrip([0.6, -0.32, 0.26], { yaw: -0.4 }),
            hs({
              id: 'cadillac2', label: "Gunner's Left Cadillac Grip", kind: 'grip', pos: [0.26, -0.34, 0.26],
              face: { yaw: 0.3 }, color: C.hex('#3a3d41'), passive: true, hint: 'Q / E traverse, R / F elevate',
              text: t => L.m(t.sys.stab ? 'stabilised' : 'unstabilised', t.sys.stab ? '已稳定' : '未稳定'), val: () => 0
            }),
            Ctrl.stab([0.72, -0.06, 0.24], { yaw: -1.2 }),
            Ctrl.turretPower([0.72, 0.04, 0.24], { yaw: -1.2 }),
            Ctrl.traverseMode([0.74, -0.16, 0.0], { yaw: -1.2 }),
            Ctrl.safety([0.36, -0.3, 0.24], { yaw: 0.2, pitch: 0.4 }),
            Ctrl.fcs([0.62, 0.12, 0.44], { yaw: -0.7 }),
            Ctrl.rangeDial([0.14, -0.26, 0.4], { yaw: 0.5 }),
            Ctrl.coax([0.34, -0.26, 0.56], { yaw: -0.1 }),
            Ctrl.elevWheel([0.7, -0.28, 0.02], { yaw: -1.3 }),
            Ctrl.azimuth([0.06, -0.02, 0.4], { yaw: 0.6 })
          ]
        },
        loader: {
          name: 'Loader', parent: 'turret', role: 'Knee switch, blast doors, 22 kg of sabot at a time.',
          eye: [-0.5, -0.2, -0.1], yaw: 0.6, pitch: -0.2, seat: false,
          hotspots: [
            hs({
              id: 'kneeswitch', label: 'Knee Switch (open blast door)', kind: 'button', pos: [-0.34, -0.36, -0.6],
              face: { yaw: 0.5 }, color: C.hex('#d0b040'),
              text: t => t.sys.blastDoor ? 'DOOR OPEN' : 'door closed', val: t => t.sys.blastDoor ? 1 : 0,
              act: (t) => { t.sys.blastDoor = !t.sys.blastDoor; return 'Ammunition blast door ' + (t.sys.blastDoor ? 'OPEN — round accessible.' : 'closed.'); }
            }),
            Ctrl.breechLever([-0.28, -0.02, 0.42], { yaw: 0.4 }),
            Ctrl.rammer([-0.34, -0.16, 0.28], { yaw: 0.5 }),
            Ctrl.rack('APFSDS', [-0.34, -0.16, -0.78], { yaw: 0.1 }, { slots: 8, color: C.hex('#6d6f64') }),
            Ctrl.rack('HEAT', [0.34, -0.16, -0.78], { yaw: -0.1 }, { slots: 6, color: C.hex('#6a6c60') }),
            Ctrl.rack('HE', [-1.16, 0.86, 0.4], { yaw: 1.5 }, { slots: 4, color: C.hex('#7d7660'), parent: 'hull' }),
            Ctrl.caseBag([-0.1, -0.34, 0.16], { yaw: 0.2, pitch: 0.6 }),
            Ctrl.hatch('loader', 'Loader Hatch', [-0.62, 0.5, -0.3], { pitch: 0.9 }),
            Ctrl.extinguisher([-0.92, -0.16, 0.3], { yaw: 0.9 }),
            Ctrl.intercom([-0.86, 0.2, -0.5], { yaw: 1.1 }),
            hs({
              id: 'loaderMG', label: 'M240 on Loader Hatch', kind: 'trigger', pos: [-0.62, 0.34, -0.06],
              face: { yaw: 0.5 }, color: C.hex('#42454a'),
              text: t => t.sys.hatches.loader > 0.5 ? t.sys.mgAmmo + L.m(' rds', ' 发') : L.s('hatch closed'),
              val: () => 0, act: (t) => t.fireCupolaMG()
            })
          ]
        },
        commander: {
          name: 'Commander', parent: 'turret', role: 'CITV hunter-killer, radios, and the whole picture.',
          eye: [0.6, -0.02, -0.4], yaw: 0, pitch: -0.22,
          hotspots: [
            Ctrl.visionBlocks([0.6, 0.18, -0.12], { pitch: -0.35 }),
            hs({
              id: 'citv', label: 'CITV Independent Thermal', kind: 'screen', pos: [0.38, 0.04, -0.10],
              face: { yaw: 0.45, pitch: 0.15 }, color: C.hex('#7ce0c0'),
              text: t => L.m('independent thermal — ', '独立热像仪 — ') + L.s(t.sys.citv ? 'SCANNING' : 'slaved to gun'),
              val: t => t.sys.citv ? 1 : 0,
              act: (t) => { t.sys.citv = !t.sys.citv; return 'CITV ' + (t.sys.citv ? 'scanning independently.' : 'slaved to the gun.'); }
            }),
            Ctrl.override([0.56, -0.20, -0.08], { yaw: 0.15, pitch: 0.35 }),
            Ctrl.designate([0.80, -0.16, -0.16], { yaw: -0.5, pitch: 0.3 }),
            Ctrl.intercom([0.40, -0.22, -0.14], { yaw: 0.5, pitch: 0.3 }),
            Ctrl.smoke([0.66, -0.26, -0.24], { yaw: -0.35, pitch: 0.5 }),
            Ctrl.hatch('commander', 'Cupola Hatch', [0.6, 0.5, -0.62], { pitch: 0.8 }),
            Ctrl.cupolaMG([0.82, 0.42, -0.10], { yaw: -0.5 }, 'M2 .50 cal (CROWS-less)'),
            Ctrl.radio([0.3, 0.06, -0.9], { yaw: 0.3 }, 'SINCGARS + FBCB2'),
            Ctrl.mapBoard([0.1, -0.2, -0.84], { yaw: 0.5, pitch: 0.4 })
          ]
        }
      }
    });
  }

  const BUILDERS = {
    sherman: shermanInterior, t34: t34Interior, tiger: tigerInterior,
    t72: t72Interior, abrams: abramsInterior
  };
  const cache = {};
  function getInterior(spec) {
    if (!cache[spec.id]) cache[spec.id] = (BUILDERS[spec.id] || shermanInterior)(spec);
    return cache[spec.id];
  }

  global.Interiors = { get: getInterior, getWidget, SHELL_MESH, Int, Ctrl, hs };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getInterior, getWidget, SHELL_MESH, Int, Ctrl };
  }
})(typeof window !== 'undefined' ? window : globalThis);
