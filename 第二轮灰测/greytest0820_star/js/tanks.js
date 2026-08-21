/* ==========================================================================
 * tanks.js — vehicle specifications + exterior model construction.
 *
 * Local model space:  origin on the ground between the tracks,
 *                     +X starboard, +Y up, +Z forward.
 * A model is:
 *   { hull, turret, gun, hatches[], turretPivot, trunnion, muzzleZ, ... }
 *   hull   : mesh in hull space
 *   turret : mesh in turret space (origin = turret ring centre)
 *   gun    : mesh in gun space   (origin = trunnion, barrel along +Z)
 * ==========================================================================*/
(function (global) {
  'use strict';
  const M = global.M, C = global.C, MeshBuilder = global.MeshBuilder;

  /* ======================================================= art helpers == */
  const Art = {};

  /** build a sub-part whose author coordinates are hull space but whose
   *  local origin must sit at `pivot` */
  Art.part = function (pivot, fn) {
    const mb = new MeshBuilder();
    mb.move(-pivot[0], -pivot[1], -pivot[2]);
    fn(mb);
    return mb.build();
  };

  /**
   * Track band as a loop of surface strips (hollow, so road wheels show).
   * outline: array of [z,y] traced counter clockwise (bottom run first).
   */
  Art.trackBand = function (mb, o) {
    const out = o.outline, n = out.length, th = o.thickness || 0.085;
    const x0 = o.x0, x1 = o.x1;
    const cOut = o.color, cSide = o.sideColor || C.tint(o.color, 0.86);
    let path = 0;
    for (let i = 0; i < n; i++) {
      const a = out[i], b = out[(i + 1) % n];
      const dz = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dz, dy) || 1e-6;
      const nz = dy / len, ny = -dz / len;      // outward normal (CCW outline)
      const ao = [a[0] + nz * th, a[1] + ny * th], bo = [b[0] + nz * th, b[1] + ny * th];
      const shade = 0.82 + 0.3 * Math.abs(ny);
      // outer surface
      mb.quad([x0, ao[1], ao[0]], [x1, ao[1], ao[0]], [x1, bo[1], bo[0]], [x0, bo[1], bo[0]],
        C.tint(cOut, shade));
      // inner surface
      mb.quad([x0, a[1], a[0]], [x0, b[1], b[0]], [x1, b[1], b[0]], [x1, a[1], a[0]],
        C.tint(cOut, 0.6));
      // side rims (this is what you actually see from outside)
      mb.quad([x0, a[1], a[0]], [x0, ao[1], ao[0]], [x0, bo[1], bo[0]], [x0, b[1], b[0]],
        C.jitter(cSide, i, 0.09));
      mb.quad([x1, a[1], a[0]], [x1, b[1], b[0]], [x1, bo[1], bo[0]], [x1, ao[1], ao[0]],
        C.jitter(cSide, i + 7, 0.09));
      // cleats
      if (o.cleats) {
        const step = o.cleatStep || 0.26;
        let t = step / 2;
        while (t < len) {
          const u = t / len;
          const cz = a[0] + dz * u + nz * (th + 0.02), cy = a[1] + dy * u + ny * (th + 0.02);
          mb.box((x0 + x1) / 2, cy, cz, Math.abs(x1 - x0) * 0.94, 0.05, 0.075,
            C.tint(cSide, 0.75));
          t += step;
        }
      }
      path += len;
    }
    return path;
  };

  /** standard "sprocket front / idler rear" (or reversed) band outline */
  Art.bandOutline = function (o) {
    const seg = o.seg || 7;
    const pts = [];
    pts.push([o.zRear, 0]);
    pts.push([o.zFront, 0]);
    for (let i = 0; i <= seg; i++) {                 // around the front wheel
      const a = -Math.PI / 2 + (i / seg) * Math.PI;
      pts.push([o.zFront + Math.cos(a) * o.rFront, o.yFront + Math.sin(a) * o.rFront]);
    }
    for (let i = 0; i <= seg; i++) {                 // around the rear wheel
      const a = Math.PI / 2 + (i / seg) * Math.PI;
      pts.push([o.zRear + Math.cos(a) * o.rRear, o.yRear + Math.sin(a) * o.rRear]);
    }
    return pts;
  };

  Art.roadWheels = function (mb, o) {
    const n = o.count, r = o.r, y = o.y;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      let z = M.lerp(o.zA, o.zB, t);
      let xo = 0;
      if (o.interleave) xo = (i % 2 ? 0.055 : -0.055);
      mb.tube([o.x0 + xo, y, z], [o.x1 + xo, y, z], r, r, o.seg || 11, o.tire || [38, 38, 38]);
      mb.tube([o.x1 + xo - 0.005, y, z], [o.x1 + xo + 0.02, y, z], r * 0.62, r * 0.62,
        o.seg || 11, o.rim || [92, 92, 84]);
      mb.tube([o.x1 + xo + 0.015, y, z], [o.x1 + xo + 0.05, y, z], r * 0.17, r * 0.17, 6,
        C.tint(o.rim || [92, 92, 84], 0.8));
    }
  };

  Art.sprocket = function (mb, o) {
    mb.tube([o.x0, o.y, o.z], [o.x1, o.y, o.z], o.r * 0.78, o.r * 0.78, 12, o.color);
    mb.tube([o.x1 - 0.01, o.y, o.z], [o.x1 + 0.03, o.y, o.z], o.r * 0.5, o.r * 0.5, 12,
      C.tint(o.color, 1.12));
    const teeth = o.teeth || 14;
    for (let i = 0; i < teeth; i++) {
      const a = i / teeth * M.TAU;
      const cz = o.z + Math.cos(a) * o.r * 0.9, cy = o.y + Math.sin(a) * o.r * 0.9;
      mb.box((o.x0 + o.x1) / 2, cy, cz, Math.abs(o.x1 - o.x0) * 0.5, 0.07, 0.07,
        C.tint(o.color, 0.85));
    }
  };

  Art.grill = function (mb, cx, cy, cz, sx, sz, color, bars) {
    mb.box(cx, cy, cz, sx, 0.04, sz, C.tint(color, 0.6));
    const n = bars || 7;
    for (let i = 0; i < n; i++) {
      const z = cz - sz / 2 + sz * (i + 0.5) / n;
      mb.box(cx, cy + 0.035, z, sx * 0.96, 0.035, sz / n * 0.55, C.tint(color, 1.1));
    }
  };

  Art.stowage = function (mb, cx, cy, cz, sx, sy, sz, color) {
    mb.box(cx, cy, cz, sx, sy, sz, color);
    mb.box(cx, cy + sy / 2 + 0.012, cz, sx * 0.9, 0.025, sz * 0.9, C.tint(color, 1.15));
    mb.box(cx, cy, cz + sz / 2 + 0.01, sx * 0.2, sy * 0.35, 0.02, C.tint(color, 0.7));
  };

  Art.mg = function (mb, p, dir, len, color) {
    const to = [p[0] + dir[0] * len, p[1] + dir[1] * len, p[2] + dir[2] * len];
    mb.tube(p, to, 0.035, 0.028, 7, color);
    mb.box(p[0], p[1] + 0.03, p[2], 0.09, 0.11, 0.3, C.tint(color, 0.9));
  };

  Art.antenna = function (mb, x, y, z, h, color) {
    mb.tube([x, y, z], [x + h * 0.08, y + h, z - h * 0.05], 0.022, 0.008, 5, color);
    mb.box(x, y - 0.02, z, 0.08, 0.06, 0.08, C.tint(color, 0.8));
  };

  Art.toolClutter = function (mb, x, y, z, color, seed) {
    const rnd = M.rng(seed || 3);
    mb.tube([x, y, z - 0.5], [x, y, z + 0.5], 0.035, 0.035, 6, [72, 60, 44]); // crow bar
    mb.box(x, y + 0.04, z - 0.75, 0.1, 0.06, 0.42, [60, 52, 40]);            // axe
    mb.box(x, y + 0.05, z + 0.85, 0.12, 0.1, 0.3, C.tint(color, 0.8));       // small box
    if (rnd() > 0.5) mb.tube([x, y + 0.14, z + 1.3], [x, y + 0.14, z + 1.7], 0.05, 0.05, 7, [58, 58, 54]);
  };

  /** hemispherical / cylindrical commander cupola with vision blocks */
  Art.cupola = function (mb, o) {
    const r = o.r, y = o.y;
    mb.tube([o.x, y, o.z], [o.x, y + o.h, o.z], r, r, 12, o.color);
    const blocks = o.blocks || 0;
    for (let i = 0; i < blocks; i++) {
      const a = i / blocks * M.TAU + 0.3;
      mb.box(o.x + Math.sin(a) * r * 0.98, y + o.h * 0.55, o.z + Math.cos(a) * r * 0.98,
        0.12, o.h * 0.42, 0.12, [30, 34, 38]);
    }
    mb.ring([o.x, y + o.h, o.z], 'y', r * 1.06, r * 0.55, 12, C.tint(o.color, 1.1));
  };

  /** gun tube with optional muzzle brake / thermal sleeve / fume extractor */
  Art.barrel = function (mb, o) {
    const len = o.len, r = o.r, color = o.color;
    mb.tube([0, 0, 0], [0, 0, len * 0.28], r * 1.25, r * 1.08, 12, color);       // breech end / cradle
    mb.tube([0, 0, len * 0.28], [0, 0, len], r * 1.02, r * 0.96, 12, color);
    if (o.sleeve) {   // thermal shroud (modern)
      mb.tube([0, 0, len * 0.16], [0, 0, len * 0.62], r * 1.5, r * 1.45, 10, C.tint(color, 0.9));
      for (let i = 0; i < 4; i++) {
        const z = len * (0.2 + i * 0.11);
        mb.ring([0, 0, z], 'z', r * 1.62, r * 1.5, 10, C.tint(color, 1.1));
      }
    }
    if (o.fume) {     // bore evacuator
      mb.tube([0, 0, len * 0.42], [0, 0, len * 0.56], r * 1.85, r * 1.85, 10, C.tint(color, 0.95));
    }
    if (o.brake === 'double') {
      mb.tube([0, 0, len], [0, 0, len + 0.30], r * 1.75, r * 1.7, 10, C.tint(color, 1.05));
      mb.box(0, 0, len + 0.10, r * 4.0, r * 2.1, 0.07, C.tint(color, 0.8));
      mb.box(0, 0, len + 0.24, r * 4.0, r * 2.1, 0.07, C.tint(color, 0.8));
      mb.disc([0, 0, len + 0.305], 'z', r * 1.7, 10, [22, 22, 22]);
    } else if (o.brake === 'pepperpot') {
      mb.tube([0, 0, len], [0, 0, len + 0.26], r * 1.6, r * 1.6, 10, C.tint(color, 1.02));
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * M.TAU;
        mb.box(Math.cos(a) * r * 1.55, Math.sin(a) * r * 1.55, len + 0.13, 0.05, 0.05, 0.16, [26, 26, 26]);
      }
      mb.disc([0, 0, len + 0.262], 'z', r * 1.6, 10, [20, 20, 20]);
    } else {
      mb.disc([0, 0, len + 0.001], 'z', r * 0.96, 10, [18, 18, 18]);
    }
    mb.disc([0, 0, len + (o.brake ? 0.31 : 0.002)], 'z', r * 0.55, 8, [10, 10, 10]);
  };

  /**
   * Hinged hatch lid. `center` is the lid centre in HULL space (absolute),
   * `hingeDir` points from the centre towards the hinge ([-1,0,0] = hinge on
   * the left, so the lid swings up to the right).
   * Returns a hatch record consumed by the renderer:
   *   { id, parent, at, axis, range:[closed, open], mesh }
   */
  Art.lid = function (id, parent, center, r, hingeDir, color, opts) {
    opts = opts || {};
    const hinge = [center[0] + hingeDir[0] * r, center[1], center[2] + hingeDir[2] * r];
    const th = opts.th || 0.06;
    const mesh = Art.part(hinge, mb => {
      if (opts.rect) {
        mb.box(center[0], center[1] + th / 2, center[2], opts.rect[0], th, opts.rect[1], color);
      } else {
        mb.tube([center[0], center[1], center[2]], [center[0], center[1] + th, center[2]],
          r, r, 12, color);
      }
      // grab handle + periscope stub so an open hatch still reads as a hatch
      mb.box(center[0] - hingeDir[0] * r * 0.55, center[1] + th + 0.05, center[2] - hingeDir[2] * r * 0.55,
        0.1, 0.1, 0.24, C.tint(color, 0.75));
      if (opts.scope) {
        mb.box(center[0], center[1] + th + 0.06, center[2] + r * 0.4, 0.18, 0.1, 0.12, [38, 44, 48]);
      }
    });
    let axis, open;
    if (Math.abs(hingeDir[0]) >= Math.abs(hingeDir[2])) {
      axis = 'z'; open = hingeDir[0] < 0 ? 1.95 : -1.95;
    } else {
      axis = 'x'; open = hingeDir[2] < 0 ? -1.95 : 1.95;
    }
    return { id, parent, at: hinge, axis, range: [0, open * (opts.openScale || 1)], mesh };
  };

  Art.star = function (mb, center, right, up, r, color) {
    // 5 point US star, drawn as a fan of triangles slightly proud of the plate
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i / 10 * M.TAU;
      const rr = i % 2 ? r * 0.42 : r;
      pts.push(M.add(M.add(center, M.mulv(right, Math.cos(a) * rr)), M.mulv(up, Math.sin(a) * rr)));
    }
    for (let i = 0; i < 10; i += 2) {
      mb.tri(center, pts[i], pts[(i + 1) % 10], color, { flat: true });
      mb.tri(center, pts[(i + 1) % 10], pts[(i + 2) % 10], color, { flat: true });
    }
  };

  /* ======================================================= tank models == */

  /* ---------------------------------------------------- M4A3 Sherman --- */
  function buildSherman(col) {
    const hullPivot = [0, 0, 0];
    const deck = 1.72, floor = 0.44, zF = 2.92, zR = -2.98;
    const hw = 1.30;
    const hull = Art.part(hullPivot, mb => {
      // side profile (y,z)
      const prof = [
        [floor, zR], [floor, zF - 0.15],
        [0.92, zF + 0.10], [1.40, zF + 0.02], [deck, zF - 0.75],
        [deck, -1.05], [1.58, -1.9], [1.52, zR + 0.12], [0.95, zR]
      ];
      mb.extrude(prof, 'x', -hw, hw, col.hull, { closed: true });
      // transmission housing / final drives
      mb.tube([-1.32, 0.66, zF - 0.02], [1.32, 0.66, zF - 0.02], 0.36, 0.36, 12, C.tint(col.hull, 0.94), { cap0: true, cap1: true });
      // bow MG + driver hoods
      Art.mg(mb, [0.55, 1.02, zF + 0.28], [0, 0.06, 1], 0.55, col.metal);
      mb.box(-0.62, deck + 0.10, zF - 0.62, 0.62, 0.22, 0.62, C.tint(col.hull, 1.05));
      mb.box(0.62, deck + 0.10, zF - 0.62, 0.62, 0.22, 0.62, C.tint(col.hull, 1.05));
      // engine deck grills and rear plate details
      Art.grill(mb, 0, deck + 0.02, -1.55, 1.5, 0.9, col.hull, 8);
      mb.box(0, 1.30, zR - 0.06, 1.9, 0.5, 0.12, C.tint(col.hull, 0.9));
      mb.box(-0.75, 1.12, zR - 0.16, 0.3, 0.3, 0.16, [40, 34, 30]);
      mb.box(0.75, 1.12, zR - 0.16, 0.3, 0.3, 0.16, [40, 34, 30]);
      // sponson stowage & fenders
      Art.stowage(mb, 0, deck + 0.14, -2.55, 1.5, 0.28, 0.6, C.tint(col.hull, 0.92));
      for (const s of [-1, 1]) {
        mb.box(s * (hw + 0.02), deck - 0.06, 0.7, 0.06, 0.1, 3.2, C.tint(col.hull, 0.88));
        Art.toolClutter(mb, s * (hw - 0.14), deck + 0.06, -0.4, col.hull, s > 0 ? 5 : 9);
      }
      // running gear: VVSS bogies
      for (const s of [-1, 1]) {
        const x0 = s > 0 ? 0.86 : -1.26, x1 = s > 0 ? 1.26 : -0.86;
        for (let b = 0; b < 3; b++) {
          const bz = -1.7 + b * 1.7;
          mb.box(s * 1.06, 0.62, bz, 0.44, 0.5, 0.85, C.tint(col.hull, 0.85));
          mb.box(s * 1.06, 1.06, bz, 0.3, 0.42, 0.3, C.tint(col.hull, 0.8)); // volute spring tower
          Art.roadWheels(mb, {
            count: 2, r: 0.28, y: 0.30, zA: bz - 0.34, zB: bz + 0.34,
            x0: x0, x1: x1, tire: col.tire, rim: col.rim
          });
          mb.tube([x0, 0.95, bz], [x1, 0.95, bz], 0.13, 0.13, 8, col.rim); // return roller
        }
        Art.sprocket(mb, { x0: x0, x1: x1, y: 0.66, z: zF - 0.02, r: 0.4, color: col.rim, teeth: 15 });
        Art.roadWheels(mb, { count: 1, r: 0.33, y: 0.35, zA: zR + 0.35, zB: zR + 0.35, x0: x0, x1: x1, tire: col.tire, rim: col.rim });
        Art.trackBand(mb, {
          outline: Art.bandOutline({ zFront: zF - 0.02, zRear: zR + 0.35, yFront: 0.66, yRear: 0.35, rFront: 0.44, rRear: 0.37 }),
          x0: x0 - 0.02, x1: x1 + 0.02, color: col.track, cleats: true, cleatStep: 0.3
        });
      }
      Art.star(mb, [0, deck + 0.005, 1.35], [0.42, 0, 0], [0, 0, 0.42], 1, [220, 216, 200]);
    });

    const tp = [0, deck, 0.35];
    const turret = Art.part(tp, mb => {
      const plan = [];
      for (let i = 0; i < 14; i++) {
        const a = i / 14 * M.TAU;
        let r = 0.88;
        if (Math.cos(a) > 0.4) r = 0.78;                       // front narrows
        plan.push([Math.sin(a) * r + 0.02, Math.cos(a) * r + 0.42]);
      }
      mb.extrude(plan, 'y', deck + 0.03, deck + 0.72, col.turret, { closed: true });
      mb.extrude(plan.map(p => [p[0] * 0.92, p[1] * 0.92 + 0.03]), 'y', deck + 0.72, deck + 0.84, C.tint(col.turret, 1.04), { closed: true });
      // mantlet & rotor shield
      mb.box(0, deck + 0.40, 1.20, 0.72, 0.55, 0.30, C.tint(col.turret, 1.02));
      mb.tube([0, deck + 0.40, 1.18], [0, deck + 0.40, 1.40], 0.30, 0.24, 12, C.tint(col.turret, 0.98));
      // commander cupola (right rear) and loader hatch ring (left)
      Art.cupola(mb, { x: 0.36, y: deck + 0.84, z: -0.10, r: 0.42, h: 0.16, color: C.tint(col.turret, 1.02), blocks: 6 });
      mb.ring([-0.40, deck + 0.85, 0.0], 'y', 0.36, 0.28, 12, C.tint(col.turret, 0.95));
      // AA MG on the roof
      Art.mg(mb, [0.62, deck + 1.06, 0.05], [0, 0.15, 1], 0.7, col.metal);
      mb.box(0.62, deck + 0.96, -0.05, 0.14, 0.12, 0.5, C.tint(col.turret, 0.9));
      // pistol port, lift rings, radio bustle, spare track links
      mb.box(-0.86, deck + 0.40, -0.15, 0.06, 0.22, 0.22, C.tint(col.turret, 0.85));
      Art.stowage(mb, 0, deck + 0.55, -1.02, 0.7, 0.3, 0.26, C.tint(col.turret, 0.9));
      Art.antenna(mb, -0.62, deck + 0.84, -0.55, 1.5, col.metal);
      Art.star(mb, [0.90, deck + 0.42, 0.1], [0, 0, 0.3], [0, 0.3, 0], 1, [214, 210, 196]);
    });

    const trunnion = [0, 0.40, 1.28];
    const gun = Art.part([0, 0, 0], mb => {
      Art.barrel(mb, { len: 2.60, r: 0.048, color: col.turret, brake: null });
      mb.tube([0, 0, -0.18], [0, 0, 0.12], 0.10, 0.10, 10, C.tint(col.turret, 0.9));
    });

    return {
      hull, turret, gun,
      turretPivot: tp, trunnion: trunnion, muzzleZ: 2.62,
      hatches: [
        Art.lid('commander', 'turret', [0.36, deck + 1.02, -0.10], 0.40, [0, 0, -1], C.tint(col.turret, 1.08), { scope: true }),
        Art.lid('loader', 'turret', [-0.40, deck + 0.88, 0.0], 0.31, [-1, 0, 0], C.tint(col.turret, 1.06)),
        Art.lid('driver', 'hull', [-0.62, deck + 0.23, zF - 0.62], 0.28, [0, 0, 1], C.tint(col.hull, 1.12), { rect: [0.56, 0.56], scope: true })
      ],
      shadow: [[-hw, zR], [hw, zR], [hw, zF], [-hw, zF]],
      hit: { y0: 0.1, y1: 2.9, halfW: 1.34, halfL: 3.0 },
      cleats: null
    };
  }

  /* -------------------------------------------------------- T-34-85 --- */
  function buildT34(col) {
    const deck = 1.42, floor = 0.42, zF = 3.05, zR = -3.05, hw = 1.48;
    const hull = Art.part([0, 0, 0], mb => {
      const prof = [
        [floor, zR], [floor, zF - 0.6],
        [1.20, zF], [deck, zF - 0.55],           // 60 degree glacis
        [deck, -1.3], [1.32, -2.1], [1.22, zR + 0.05], [0.9, zR]
      ];
      mb.extrude(prof, 'x', -hw, hw, col.hull, { closed: true });
      // driver hatch face + MG ball
      mb.box(-0.58, 1.62, zF - 0.30, 0.66, 0.5, 0.1, C.tint(col.hull, 1.06));
      Art.mg(mb, [0.60, 1.42, zF - 0.10], [0, 0.1, 1], 0.4, col.metal);
      // rear engine deck & exhausts
      Art.grill(mb, 0, deck + 0.02, -1.85, 1.7, 0.8, col.hull, 6);
      for (const s of [-1, 1]) {
        mb.tube([s * 0.65, 1.05, zR - 0.02], [s * 0.65, 1.05, zR - 0.18], 0.14, 0.16, 9, [46, 40, 34]);
        // external fuel drums (very T-34)
        mb.tube([s * (hw + 0.10), 1.02, -2.2], [s * (hw + 0.10), 1.02, -1.35], 0.24, 0.24, 12, col.drum);
        mb.box(s * (hw + 0.02), 1.02, -1.78, 0.06, 0.5, 0.9, C.tint(col.hull, 0.85));
      }
      for (const s of [-1, 1]) {
        mb.box(s * (hw + 0.03), deck - 0.05, 1.0, 0.08, 0.09, 3.0, C.tint(col.hull, 0.9));
        Art.toolClutter(mb, s * (hw - 0.2), deck + 0.06, 0.1, col.hull, s > 0 ? 11 : 4);
      }
      // running gear: big Christie wheels, drive sprocket at the REAR
      for (const s of [-1, 1]) {
        const x0 = s > 0 ? 1.02 : -1.46, x1 = s > 0 ? 1.46 : -1.02;
        Art.roadWheels(mb, {
          count: 5, r: 0.42, y: 0.45, zA: -1.95, zB: 2.15, x0: x0, x1: x1,
          tire: col.tire, rim: col.rim
        });
        Art.sprocket(mb, { x0: x0, x1: x1, y: 0.62, z: zR + 0.55, r: 0.38, color: col.rim, teeth: 14 });
        Art.roadWheels(mb, { count: 1, r: 0.40, y: 0.44, zA: zF - 0.45, zB: zF - 0.45, x0: x0, x1: x1, tire: col.tire, rim: col.rim });
        Art.trackBand(mb, {
          outline: Art.bandOutline({ zFront: zF - 0.45, zRear: zR + 0.55, yFront: 0.44, yRear: 0.62, rFront: 0.46, rRear: 0.44 }),
          x0: x0 - 0.02, x1: x1 + 0.02, color: col.track, cleats: true, cleatStep: 0.34
        });
      }
    });

    const tp = [0, deck, -0.30];
    const turret = Art.part(tp, mb => {
      // hexagonal "sardine can" plan with sloped sides
      const mkPlan = (s, zo) => [
        [-0.60 * s, 1.22 * s + zo], [0.60 * s, 1.22 * s + zo],
        [1.02 * s, 0.10 * s + zo], [0.80 * s, -1.28 * s + zo],
        [-0.80 * s, -1.28 * s + zo], [-1.02 * s, 0.10 * s + zo]
      ];
      const lo = mkPlan(1.0, 0), hi = mkPlan(0.86, 0.03);
      const y0 = deck + 0.02, y1 = deck + 0.78;
      for (let i = 0; i < lo.length; i++) {
        const j = (i + 1) % lo.length;
        mb.quad([lo[i][0], y0, lo[i][1]], [lo[j][0], y0, lo[j][1]],
          [hi[j][0], y1, hi[j][1]], [hi[i][0], y1, hi[i][1]],
          C.jitter(col.turret, i, 0.06));
      }
      mb.poly(hi.map(p => [p[0], y1, p[1]]), C.tint(col.turret, 1.07));
      mb.poly(lo.map(p => [p[0], y0, p[1]]).reverse(), C.tint(col.turret, 0.8));
      // mantlet
      mb.box(0, deck + 0.36, 1.28, 0.62, 0.46, 0.34, C.tint(col.turret, 1.0));
      mb.tube([0, deck + 0.36, 1.30], [0, deck + 0.36, 1.46], 0.26, 0.22, 12, C.tint(col.turret, 0.96));
      // two roof hatches, commander cupola, periscopes
      Art.cupola(mb, { x: -0.34, y: deck + 0.78, z: -0.42, r: 0.38, h: 0.20, color: C.tint(col.turret, 1.03), blocks: 5 });
      mb.ring([0.40, deck + 0.79, -0.30], 'y', 0.32, 0.25, 12, C.tint(col.turret, 0.95));
      mb.box(-0.30, deck + 0.86, 0.32, 0.2, 0.1, 0.16, [34, 38, 40]);
      mb.box(0.55, deck + 0.60, 0.55, 0.18, 0.14, 0.1, [34, 38, 40]);
      // rear stowage + antenna
      Art.stowage(mb, 0, deck + 0.5, -1.42, 0.6, 0.26, 0.22, C.tint(col.turret, 0.92));
      Art.antenna(mb, -0.9, deck + 0.5, -1.0, 1.4, col.metal);
      // turret number
      mb.box(0.95, deck + 0.42, -0.2, 0.02, 0.22, 0.5, [200, 60, 55], { flat: true });
    });

    const trunnion = [0, 0.36, 1.32];
    const gun = Art.part([0, 0, 0], mb => {
      Art.barrel(mb, { len: 3.30, r: 0.052, color: col.turret, brake: null });
      mb.tube([0, 0, -0.2], [0, 0, 0.14], 0.11, 0.11, 10, C.tint(col.turret, 0.9));
    });

    return {
      hull, turret, gun, turretPivot: tp, trunnion, muzzleZ: 3.32,
      hatches: [
        Art.lid('commander', 'turret', [-0.34, deck + 1.00, -0.42], 0.37, [0, 0, -1], C.tint(col.turret, 1.09), { scope: true }),
        Art.lid('loader', 'turret', [0.40, deck + 0.82, -0.30], 0.30, [0, 0, -1], C.tint(col.turret, 1.05)),
        Art.lid('driver', 'hull', [-0.58, 1.62, zF - 0.30], 0.30, [0, 0, 1], C.tint(col.hull, 1.14), { rect: [0.6, 0.5], scope: true, openScale: 0.65 })
      ],
      shadow: [[-hw, zR], [hw, zR], [hw, zF], [-hw, zF]],
      hit: { y0: 0.1, y1: 2.6, halfW: 1.5, halfL: 3.1 }
    };
  }

  /* --------------------------------------------------------- Tiger I --- */
  function buildTiger(col) {
    const deck = 1.52, floor = 0.47, zF = 3.05, zR = -3.05, hw = 1.72;
    const hull = Art.part([0, 0, 0], mb => {
      const prof = [
        [floor, zR], [floor, zF - 0.2],
        [1.02, zF + 0.10], [1.55, zF + 0.05],       // near vertical 100mm nose
        [deck, zF - 0.55], [deck, -1.0], [1.42, -1.9], [1.30, zR + 0.05], [0.95, zR]
      ];
      mb.extrude(prof, 'x', -hw, hw, col.hull, { closed: true });
      // hull front: driver visor + MG
      mb.box(-0.62, 1.34, zF + 0.11, 0.5, 0.16, 0.06, [40, 42, 42]);
      Art.mg(mb, [0.62, 1.28, zF + 0.12], [0, 0.05, 1], 0.5, col.metal);
      // wide superstructure over the tracks with the classic flat top
      mb.box(0, deck + 0.06, 0.2, hw * 2 - 0.04, 0.12, 4.2, C.tint(col.hull, 1.03));
      Art.grill(mb, 0, deck + 0.14, -2.1, 2.6, 1.3, col.hull, 8);
      for (const s of [-1, 1]) {
        mb.tube([s * 0.9, 1.05, zR - 0.06], [s * 0.9, 1.70, zR - 0.06], 0.13, 0.11, 9, [44, 38, 32]);
        mb.box(s * 0.9, 1.15, zR - 0.06, 0.3, 0.5, 0.3, C.tint(col.hull, 0.86));
        // spare track links on the hull side
        for (let i = 0; i < 4; i++) {
          mb.box(s * (hw + 0.05), 1.05, -0.3 + i * 0.28, 0.1, 0.24, 0.22, C.tint(col.track, 1.05));
        }
        Art.toolClutter(mb, s * (hw - 0.3), deck + 0.14, 1.2, col.hull, s > 0 ? 21 : 8);
      }
      Art.stowage(mb, 0, deck + 0.24, -2.85, 1.2, 0.24, 0.34, C.tint(col.hull, 0.92));
      // running gear: interleaved wheels, wide tracks
      for (const s of [-1, 1]) {
        const x0 = s > 0 ? 1.02 : -1.70, x1 = s > 0 ? 1.70 : -1.02;
        Art.roadWheels(mb, {
          count: 8, r: 0.40, y: 0.43, zA: -2.2, zB: 2.3, x0: x0, x1: x1,
          tire: col.tire, rim: col.rim, interleave: true
        });
        Art.sprocket(mb, { x0: x0, x1: x1, y: 0.72, z: zF - 0.25, r: 0.42, color: col.rim, teeth: 16 });
        Art.roadWheels(mb, { count: 1, r: 0.38, y: 0.55, zA: zR + 0.4, zB: zR + 0.4, x0: x0, x1: x1, tire: col.tire, rim: col.rim });
        Art.trackBand(mb, {
          outline: Art.bandOutline({ zFront: zF - 0.25, zRear: zR + 0.4, yFront: 0.72, yRear: 0.55, rFront: 0.5, rRear: 0.44 }),
          x0: x0 - 0.03, x1: x1 + 0.03, color: col.track, cleats: true, cleatStep: 0.3, thickness: 0.1
        });
      }
    });

    const tp = [0, deck + 0.12, -0.05];
    const turret = Art.part(tp, mb => {
      const plan = [];
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * M.TAU;
        let r = 0.96;
        if (Math.cos(a) > 0.55) r = 0.86;
        if (Math.cos(a) < -0.6) r = 0.92;
        plan.push([Math.sin(a) * r, Math.cos(a) * r * 1.06]);
      }
      const y0 = deck + 0.14, y1 = deck + 0.92;
      mb.extrude(plan, 'y', y0, y1, col.turret, { closed: true });
      mb.extrude(plan.map(p => [p[0] * 0.97, p[1] * 0.97]), 'y', y1, y1 + 0.04, C.tint(col.turret, 1.06), { closed: true });
      // big flat mantlet with binocular sight ports
      mb.box(0, deck + 0.50, 1.02, 1.0, 0.62, 0.22, C.tint(col.turret, 1.0));
      mb.box(-0.20, deck + 0.60, 1.14, 0.1, 0.08, 0.05, [26, 30, 32]);
      mb.box(-0.34, deck + 0.60, 1.14, 0.1, 0.08, 0.05, [26, 30, 32]);
      // commander cupola (left), loader hatch (right), pistol port, escape hatch
      Art.cupola(mb, { x: -0.42, y: y1 + 0.04, z: -0.55, r: 0.34, h: 0.30, color: C.tint(col.turret, 1.02), blocks: 5 });
      mb.ring([0.34, y1 + 0.05, -0.35], 'y', 0.30, 0.23, 12, C.tint(col.turret, 0.95));
      mb.box(0.95, deck + 0.5, -0.55, 0.06, 0.5, 0.55, C.tint(col.turret, 0.92));   // side escape hatch
      // smoke dischargers + spare track links on turret side
      for (let i = 0; i < 3; i++) {
        mb.tube([-0.75 + i * 0.02, deck + 0.95, 0.55 - i * 0.16], [-0.82, deck + 1.18, 0.5 - i * 0.16], 0.05, 0.05, 7, [58, 56, 52]);
      }
      for (let i = 0; i < 3; i++) mb.box(-0.98, deck + 0.45, -0.1 + i * 0.28, 0.08, 0.22, 0.22, C.tint(col.track, 1.05));
      Art.antenna(mb, 0.72, y1 + 0.02, -0.85, 1.6, col.metal);
    });

    const trunnion = [0, 0.50, 1.10];
    const gun = Art.part([0, 0, 0], mb => {
      Art.barrel(mb, { len: 4.60, r: 0.058, color: col.turret, brake: 'double' });
      mb.tube([0, 0, -0.25], [0, 0, 0.16], 0.13, 0.13, 10, C.tint(col.turret, 0.9));
    });

    return {
      hull, turret, gun, turretPivot: tp, trunnion, muzzleZ: 4.9,
      hatches: [
        Art.lid('commander', 'turret', [-0.42, deck + 0.98, -0.55], 0.33, [0, 0, -1], C.tint(col.turret, 1.1), { scope: true }),
        Art.lid('loader', 'turret', [0.34, deck + 1.00, -0.35], 0.29, [1, 0, 0], C.tint(col.turret, 1.05)),
        Art.lid('driver', 'hull', [-0.62, deck + 0.14, zF - 0.9], 0.30, [0, 0, -1], C.tint(col.hull, 1.12), { scope: true })
      ],
      shadow: [[-hw, zR], [hw, zR], [hw, zF], [-hw, zF]],
      hit: { y0: 0.1, y1: 3.0, halfW: 1.74, halfL: 3.1 }
    };
  }

  /* ---------------------------------------------------------- T-72B3 --- */
  function buildT72(col) {
    const deck = 1.30, floor = 0.42, zF = 3.40, zR = -3.15, hw = 1.62;
    const hull = Art.part([0, 0, 0], mb => {
      const prof = [
        [floor, zR], [floor, zF - 1.4],
        [1.16, zF], [deck, zF - 1.05],                 // long 68 degree glacis
        [deck, -1.4], [1.26, -2.2], [1.20, zR + 0.05], [0.85, zR]
      ];
      mb.extrude(prof, 'x', -hw, hw, col.hull, { closed: true });
      // ERA bricks on the glacis
      for (let r = 0; r < 3; r++) {
        for (let i = -3; i <= 3; i++) {
          mb.box(i * 0.42, 1.18 + r * 0.05, zF - 0.30 - r * 0.34, 0.36, 0.12, 0.3,
            C.jitter(col.era, i + r * 5, 0.07));
        }
      }
      mb.box(0, 1.22, zF - 0.05, 1.2, 0.1, 0.4, C.tint(col.hull, 0.95));  // splash guard
      mb.box(-0.05, deck + 0.06, zF - 1.35, 0.7, 0.08, 0.6, C.tint(col.hull, 1.06)); // driver hatch pan
      Art.grill(mb, 0, deck + 0.02, -2.15, 1.9, 1.0, col.hull, 7);
      // unditching log, snorkel and fuel drums at the back
      mb.tube([-0.9, deck + 0.2, zR - 0.05], [0.9, deck + 0.2, zR - 0.05], 0.14, 0.14, 9, [72, 58, 42]);
      for (const s of [-1, 1]) {
        mb.tube([s * 0.5, deck + 0.22, -2.75], [s * 0.5, deck + 0.22, -2.0], 0.2, 0.2, 12, col.drum);
      }
      // side skirts + rubber flaps
      for (const s of [-1, 1]) {
        mb.box(s * (hw + 0.04), 1.02, 0.6, 0.05, 0.44, 4.4, C.tint(col.hull, 0.92));
        for (let i = 0; i < 4; i++) {
          mb.box(s * (hw + 0.08), 0.86, zF - 0.9 - i * 0.55, 0.05, 0.5, 0.5, col.skirt);
        }
      }
      // running gear
      for (const s of [-1, 1]) {
        const x0 = s > 0 ? 1.06 : -1.58, x1 = s > 0 ? 1.58 : -1.06;
        Art.roadWheels(mb, { count: 6, r: 0.36, y: 0.39, zA: -2.15, zB: 2.15, x0: x0, x1: x1, tire: col.tire, rim: col.rim });
        for (let i = 0; i < 3; i++) {
          mb.tube([x0, 0.92, -1.4 + i * 1.4], [x1 - 0.1, 0.92, -1.4 + i * 1.4], 0.11, 0.11, 8, col.rim);
        }
        Art.sprocket(mb, { x0: x0, x1: x1, y: 0.6, z: zR + 0.55, r: 0.36, color: col.rim, teeth: 14 });
        Art.roadWheels(mb, { count: 1, r: 0.34, y: 0.42, zA: zF - 0.85, zB: zF - 0.85, x0: x0, x1: x1, tire: col.tire, rim: col.rim });
        Art.trackBand(mb, {
          outline: Art.bandOutline({ zFront: zF - 0.85, zRear: zR + 0.55, yFront: 0.42, yRear: 0.6, rFront: 0.42, rRear: 0.42 }),
          x0: x0 - 0.02, x1: x1 + 0.02, color: col.track, cleats: true, cleatStep: 0.28
        });
      }
    });

    const tp = [0, deck, 0.2];
    const turret = Art.part(tp, mb => {
      // squat dome turret
      mb.dome([0, deck - 0.30, 0], 1.30, 16, 4, col.turret);
      mb.extrude([[-1.28, -0.9], [1.28, -0.9], [1.28, 0.9], [-1.28, 0.9]], 'y', deck - 0.02, deck + 0.20, C.tint(col.turret, 0.98), { closed: true });
      // ERA on the turret cheeks
      for (let i = 0; i < 5; i++) {
        for (const s of [-1, 1]) {
          mb.box(s * (0.55 + i * 0.11), deck + 0.32 - i * 0.03, 0.95 - i * 0.14, 0.3, 0.2, 0.22,
            C.jitter(col.era, i * 3 + (s > 0 ? 1 : 9), 0.07));
        }
      }
      // gunner sight, commander cupola, IR searchlight, snorkel, ammo boxes
      mb.box(-0.42, deck + 0.62, 0.55, 0.44, 0.26, 0.4, [46, 50, 46]);            // Sosna-U sight
      mb.box(-0.42, deck + 0.66, 0.75, 0.3, 0.16, 0.05, [24, 32, 36], { glow: 0.15 });
      Art.cupola(mb, { x: 0.5, y: deck + 0.52, z: -0.25, r: 0.42, h: 0.26, color: C.tint(col.turret, 1.02), blocks: 6 });
      mb.box(0.5, deck + 0.84, -0.25, 0.5, 0.1, 0.5, C.tint(col.turret, 1.08));
      Art.mg(mb, [0.5, deck + 0.96, 0.05], [0, 0.12, 1], 0.7, col.metal);          // NSVT
      mb.tube([-0.95, deck + 0.5, 0.2], [-0.95, deck + 0.5, 0.4], 0.22, 0.22, 12, [60, 64, 60]); // searchlight
      mb.disc([-0.95, deck + 0.5, 0.41], 'z', 0.2, 12, [190, 200, 210], { glow: 0.25 });
      for (let i = 0; i < 3; i++) mb.box(0.85 - i * 0.3, deck + 0.42, -1.05, 0.26, 0.3, 0.2, C.tint(col.turret, 0.9));
      // smoke grenade launchers
      for (let i = 0; i < 6; i++) {
        mb.tube([-0.75 + i * 0.16, deck + 0.42, 0.85], [-0.75 + i * 0.16, deck + 0.5, 1.0], 0.06, 0.06, 7, [52, 56, 52]);
      }
      Art.antenna(mb, 0.95, deck + 0.3, -0.85, 1.7, col.metal);
    });

    const trunnion = [0, 0.32, 0.9];
    const gun = Art.part([0, 0, 0], mb => {
      Art.barrel(mb, { len: 5.30, r: 0.066, color: col.turret, sleeve: true, brake: null });
      mb.tube([0, 0, -0.3], [0, 0, 0.2], 0.16, 0.16, 10, C.tint(col.turret, 0.9));
    });

    return {
      hull, turret, gun, turretPivot: tp, trunnion, muzzleZ: 5.32,
      hatches: [
        Art.lid('commander', 'turret', [0.5, deck + 0.92, -0.25], 0.40, [0, 0, -1], C.tint(col.turret, 1.1), { scope: true }),
        Art.lid('gunner', 'turret', [-0.55, deck + 0.70, -0.2], 0.32, [-1, 0, 0], C.tint(col.turret, 1.06)),
        Art.lid('driver', 'hull', [-0.05, deck + 0.12, zF - 1.35], 0.30, [0, 0, 1], C.tint(col.hull, 1.12), { scope: true })
      ],
      shadow: [[-hw, zR], [hw, zR], [hw, zF], [-hw, zF]],
      hit: { y0: 0.1, y1: 2.5, halfW: 1.66, halfL: 3.3 }
    };
  }

  /* --------------------------------------------------------- M1A2 ------ */
  function buildAbrams(col) {
    const deck = 1.42, floor = 0.45, zF = 3.85, zR = -3.75, hw = 1.82;
    const hull = Art.part([0, 0, 0], mb => {
      const prof = [
        [floor, zR], [floor, zF - 1.9],
        [0.98, zF], [deck, zF - 1.55],                 // very long shallow glacis
        [deck, -1.9], [1.36, -2.9], [1.30, zR + 0.05], [0.9, zR]
      ];
      mb.extrude(prof, 'x', -hw, hw, col.hull, { closed: true });
      mb.box(-0.02, deck + 0.06, zF - 2.0, 0.8, 0.08, 0.8, C.tint(col.hull, 1.05)); // driver hatch pan
      mb.box(0, 1.06, zF - 0.05, 1.4, 0.1, 0.3, C.tint(col.hull, 0.95));
      // rear grille / NBC / APU
      Art.grill(mb, 0, deck + 0.02, -2.6, 2.4, 1.4, col.hull, 9);
      mb.box(0, 1.20, zR - 0.04, 2.6, 0.7, 0.1, C.tint(col.hull, 0.9));
      for (let i = 0; i < 6; i++) mb.box(-1.1 + i * 0.44, 1.2, zR - 0.11, 0.32, 0.5, 0.06, [56, 54, 48]);
      // skirts with the classic 7 armour panels
      for (const s of [-1, 1]) {
        for (let i = 0; i < 7; i++) {
          mb.box(s * (hw + 0.05), 0.92, zF - 1.0 - i * 0.85, 0.09, 0.75, 0.8,
            C.jitter(col.skirt, i * 3 + (s > 0 ? 2 : 7), 0.05));
        }
        mb.box(s * (hw + 0.02), 1.34, 0.4, 0.06, 0.14, 5.4, C.tint(col.hull, 0.92));
      }
      // running gear
      for (const s of [-1, 1]) {
        const x0 = s > 0 ? 1.16 : -1.74, x1 = s > 0 ? 1.74 : -1.16;
        Art.roadWheels(mb, { count: 7, r: 0.34, y: 0.37, zA: -2.6, zB: 2.5, x0: x0, x1: x1, tire: col.tire, rim: col.rim });
        for (let i = 0; i < 3; i++) mb.tube([x0, 0.86, -1.6 + i * 1.6], [x1 - 0.1, 0.86, -1.6 + i * 1.6], 0.1, 0.1, 8, col.rim);
        Art.sprocket(mb, { x0: x0, x1: x1, y: 0.62, z: zR + 0.62, r: 0.36, color: col.rim, teeth: 15 });
        Art.roadWheels(mb, { count: 1, r: 0.33, y: 0.40, zA: zF - 1.05, zB: zF - 1.05, x0: x0, x1: x1, tire: col.tire, rim: col.rim });
        Art.trackBand(mb, {
          outline: Art.bandOutline({ zFront: zF - 1.05, zRear: zR + 0.62, yFront: 0.40, yRear: 0.62, rFront: 0.42, rRear: 0.42 }),
          x0: x0 - 0.02, x1: x1 + 0.02, color: col.track, cleats: true, cleatStep: 0.3, thickness: 0.09
        });
      }
    });

    const tp = [0, deck, -0.35];
    const turret = Art.part(tp, mb => {
      // faceted wedge turret: front cheeks, flat roof, big bustle
      const y0 = deck + 0.02, y1 = deck + 0.86;
      const plan = [
        [-1.55, -1.75], [1.55, -1.75], [1.55, 0.55], [0.72, 1.55],
        [0.34, 1.62], [-0.34, 1.62], [-0.72, 1.55], [-1.55, 0.55]
      ];
      const planTop = plan.map(p => [p[0] * 0.97, p[1] * 0.97]);
      for (let i = 0; i < plan.length; i++) {
        const j = (i + 1) % plan.length;
        mb.quad([plan[i][0], y0, plan[i][1]], [plan[j][0], y0, plan[j][1]],
          [planTop[j][0], y1, planTop[j][1]], [planTop[i][0], y1, planTop[i][1]],
          C.jitter(col.turret, i, 0.05));
      }
      mb.poly(planTop.map(p => [p[0], y1, p[1]]), C.tint(col.turret, 1.06));
      mb.poly(plan.map(p => [p[0], y0, p[1]]).reverse(), C.tint(col.turret, 0.78));
      // gun shield
      mb.box(0, deck + 0.42, 1.60, 0.85, 0.7, 0.22, C.tint(col.turret, 1.0));
      // GPS (gunner primary sight) housing on the right, CITV on the left
      mb.box(0.58, deck + 0.96, 0.85, 0.5, 0.34, 0.55, C.tint(col.turret, 1.04));
      mb.box(0.58, deck + 0.98, 1.13, 0.36, 0.22, 0.04, [30, 44, 50], { glow: 0.2 });
      mb.tube([-0.5, deck + 1.02, 0.55], [-0.5, deck + 1.32, 0.55], 0.2, 0.2, 10, C.tint(col.turret, 1.02));
      mb.box(-0.5, deck + 1.24, 0.72, 0.28, 0.2, 0.05, [30, 46, 52], { glow: 0.2 });
      // commander cupola + loader hatch + machine guns
      Art.cupola(mb, { x: 0.62, y: deck + 0.86, z: -0.35, r: 0.46, h: 0.28, color: C.tint(col.turret, 1.02), blocks: 6 });
      Art.mg(mb, [0.62, deck + 1.24, -0.05], [0, 0.1, 1], 0.8, col.metal);
      mb.ring([-0.66, deck + 0.87, -0.42], 'y', 0.4, 0.31, 12, C.tint(col.turret, 0.95));
      Art.mg(mb, [-0.66, deck + 1.02, -0.1], [0, 0.12, 1], 0.6, col.metal);
      // bustle rack full of kit
      mb.box(0, deck + 0.55, -2.25, 2.9, 0.9, 1.0, C.tint(col.turret, 0.86));
      for (let i = 0; i < 5; i++) {
        mb.box(-1.1 + i * 0.55, deck + 0.9, -2.3, 0.44, 0.3, 0.7, C.jitter([74, 72, 58], i * 4, 0.12));
      }
      // wind sensor, smoke launchers, antennas
      mb.tube([-1.3, deck + 0.86, -1.5], [-1.3, deck + 1.3, -1.5], 0.04, 0.04, 6, [60, 60, 56]);
      for (const s of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          mb.tube([s * (1.3 + i * 0.02), deck + 0.5, 0.6 - i * 0.18], [s * 1.5, deck + 0.7, 0.6 - i * 0.18], 0.07, 0.07, 7, [52, 52, 48]);
        }
      }
      Art.antenna(mb, 1.35, deck + 0.86, -1.9, 1.9, col.metal);
      Art.antenna(mb, -1.35, deck + 0.86, -1.9, 1.9, col.metal);
    });

    const trunnion = [0, 0.42, 1.62];
    const gun = Art.part([0, 0, 0], mb => {
      Art.barrel(mb, { len: 5.10, r: 0.068, color: col.turret, sleeve: true, brake: null });
      mb.tube([0, 0, -0.35], [0, 0, 0.2], 0.17, 0.17, 10, C.tint(col.turret, 0.92));
    });

    return {
      hull, turret, gun, turretPivot: tp, trunnion, muzzleZ: 5.12,
      hatches: [
        Art.lid('commander', 'turret', [0.62, deck + 1.16, -0.35], 0.44, [0, 0, -1], C.tint(col.turret, 1.1), { scope: true }),
        Art.lid('loader', 'turret', [-0.66, deck + 0.90, -0.42], 0.38, [-1, 0, 0], C.tint(col.turret, 1.06)),
        Art.lid('driver', 'hull', [-0.02, deck + 0.12, zF - 2.0], 0.34, [0, 0, 1], C.tint(col.hull, 1.12), { rect: [0.74, 0.74], scope: true, openScale: 0.8 })
      ],
      shadow: [[-hw, zR], [hw, zR], [hw, zF], [-hw, zF]],
      hit: { y0: 0.1, y1: 2.7, halfW: 1.86, halfL: 3.8 }
    };
  }

  /* ======================================================= tank specs == */
  const TANKS = [
    {
      id: 'sherman', name: 'M4A3(75) Sherman', short: 'Sherman', nation: 'United States', flag: 'US',
      year: 1943, cls: 'Medium Tank', crew: 5, autoloader: false,
      stations: ['driver', 'gunner', 'loader', 'commander'],
      mass: 30.3, powerHp: 500, maxSpeed: 38, revSpeed: 8, accel: 2.1, turnRate: 32, pivot: false,
      hp: 900, armor: { hull: 51, turret: 76 },
      gun: {
        name: '75 mm M3', cal: 75, mv: 618, reload: 6.0, elevMin: -10, elevMax: 25,
        traverse: 24, manualTraverse: 4, disp: 0.055
      },
      shells: { AP: { n: 40, pen: 100, dmg: 240, name: 'M61 APCBC' }, HE: { n: 40, pen: 20, dmg: 170, splash: 6, name: 'M48 HE' }, SMOKE: { n: 6, pen: 0, dmg: 0, smoke: true, name: 'M89 Smoke' } },
      optics: { zoom: [1, 3], thermal: false, night: false, lrf: false, fcs: false },
      colors: {
        hull: C.hex('#4c5440'), turret: C.hex('#4f5743'), track: C.hex('#3b3b39'),
        tire: C.hex('#262524'), rim: C.hex('#5c5c52'), metal: C.hex('#3f423f'), drum: C.hex('#55503f'),
        skirt: C.hex('#3a3a34'), era: C.hex('#4c5440')
      },
      build: buildSherman,
      desc: 'Reliable, roomy and mass produced. A wet stowage 75 mm gun tank with a five man crew, hydraulic turret traverse and the best crew ergonomics of its generation.',
      notes: ['Bow gunner position included', 'Hydraulic + manual traverse', 'Wide, comfortable fighting compartment']
    },
    {
      id: 't34', name: 'T-34-85', short: 'T-34-85', nation: 'Soviet Union', flag: 'SU',
      year: 1944, cls: 'Medium Tank', crew: 5, autoloader: false,
      stations: ['driver', 'gunner', 'loader', 'commander'],
      mass: 32.2, powerHp: 500, maxSpeed: 40, revSpeed: 9, accel: 2.3, turnRate: 30, pivot: false,
      hp: 880, armor: { hull: 45, turret: 90 },
      gun: {
        name: '85 mm ZiS-S-53', cal: 85, mv: 792, reload: 7.4, elevMin: -5, elevMax: 22,
        traverse: 20, manualTraverse: 3.5, disp: 0.062
      },
      shells: { AP: { n: 36, pen: 138, dmg: 280, name: 'BR-365 APHE' }, HE: { n: 20, pen: 25, dmg: 210, splash: 7, name: 'O-365 HE' }, SMOKE: { n: 4, pen: 0, dmg: 0, smoke: true, name: 'D-367 Smoke' } },
      optics: { zoom: [1, 4], thermal: false, night: false, lrf: false, fcs: false },
      colors: {
        hull: C.hex('#4a5334'), turret: C.hex('#4c5537'), track: C.hex('#39393a'),
        tire: C.hex('#3f452c'), rim: C.hex('#565b40'), metal: C.hex('#3b3e38'), drum: C.hex('#585335'),
        skirt: C.hex('#33342f'), era: C.hex('#4a5334')
      },
      build: buildT34,
      desc: 'Sloped armour, a big diesel and a hard hitting 85 mm gun in a cramped three man turret. Fast, crude, and produced in enormous numbers.',
      notes: ['Cramped turret: slow reload', 'Manual traverse handwheel is the backup', 'Loader works from floor ammo bins']
    },
    {
      id: 'tiger', name: 'Panzerkampfwagen VI Tiger I', short: 'Tiger I', nation: 'Germany', flag: 'DE',
      year: 1942, cls: 'Heavy Tank', crew: 5, autoloader: false,
      stations: ['driver', 'gunner', 'loader', 'commander'],
      mass: 57, powerHp: 700, maxSpeed: 30, revSpeed: 7, accel: 1.3, turnRate: 20, pivot: true,
      hp: 1350, armor: { hull: 100, turret: 120 },
      gun: {
        name: '8.8 cm KwK 36 L/56', cal: 88, mv: 773, reload: 7.6, elevMin: -8, elevMax: 17,
        traverse: 9, manualTraverse: 3, disp: 0.045
      },
      shells: { AP: { n: 50, pen: 165, dmg: 320, name: 'PzGr 39' }, HE: { n: 42, pen: 30, dmg: 240, splash: 8, name: 'SprGr 39' }, HEAT: { n: 8, pen: 110, dmg: 260, name: 'Gr 39 HL' } },
      optics: { zoom: [1, 2.5], thermal: false, night: false, lrf: false, fcs: false },
      colors: {
        hull: C.hex('#8a7b4e'), turret: C.hex('#8d7e51'), track: C.hex('#46443e'),
        tire: C.hex('#2b2b28'), rim: C.hex('#6b6a5c'), metal: C.hex('#4a4a44'), drum: C.hex('#77704c'),
        skirt: C.hex('#4a4740'), era: C.hex('#8a7b4e')
      },
      build: buildTiger,
      desc: 'Overengineered, superbly optical and terrifyingly heavy. Excellent gun and armour, glacial hydraulic turret traverse and a hungry gasoline engine.',
      notes: ['Foot pedal hydraulic traverse', 'Binocular TZF 9b sight', 'Interleaved suspension, 57 tonnes']
    },
    {
      id: 't72', name: 'T-72B3', short: 'T-72B3', nation: 'Russia', flag: 'RU',
      year: 2013, cls: 'Main Battle Tank', crew: 3, autoloader: true,
      stations: ['driver', 'gunner', 'commander'],
      mass: 46, powerHp: 1130, maxSpeed: 60, revSpeed: 12, accel: 3.1, turnRate: 36, pivot: true,
      hp: 1700, armor: { hull: 520, turret: 560 },
      gun: {
        name: '125 mm 2A46M-5', cal: 125, mv: 1700, reload: 7.1, elevMin: -6, elevMax: 14,
        traverse: 30, manualTraverse: 2.5, disp: 0.03, autoloaderCycle: 7.1
      },
      shells: {
        APFSDS: { n: 20, pen: 600, dmg: 620, name: '3BM42 Mango' },
        HEAT: { n: 12, pen: 500, dmg: 560, name: '3BK29' },
        HE: { n: 10, pen: 60, dmg: 420, splash: 11, name: '3OF26 HE-Frag' }
      },
      optics: { zoom: [1, 4, 12], thermal: true, night: true, lrf: true, fcs: true },
      colors: {
        hull: C.hex('#4b5438'), turret: C.hex('#4e573b'), track: C.hex('#3a3b38'),
        tire: C.hex('#2f322c'), rim: C.hex('#565c46'), metal: C.hex('#42463f'), drum: C.hex('#5a5c40'),
        skirt: C.hex('#2f322f'), era: C.hex('#525c3c')
      },
      build: buildT72,
      desc: 'Low, cramped and dangerous. Three man crew with a carousel autoloader under the turret floor, Sosna-U thermal sight and Kontakt-5 explosive reactive armour.',
      notes: ['22 round carousel autoloader', 'No loader: commander doubles up', 'Thermal sight + laser rangefinder']
    },
    {
      id: 'abrams', name: 'M1A2 SEP Abrams', short: 'M1A2', nation: 'United States', flag: 'US',
      year: 1999, cls: 'Main Battle Tank', crew: 4, autoloader: false,
      stations: ['driver', 'gunner', 'loader', 'commander'],
      mass: 62, powerHp: 1500, maxSpeed: 67, revSpeed: 30, accel: 3.4, turnRate: 40, pivot: true,
      hp: 2100, armor: { hull: 600, turret: 900 },
      gun: {
        name: '120 mm M256 L/44', cal: 120, mv: 1670, reload: 5.4, elevMin: -10, elevMax: 20,
        traverse: 42, manualTraverse: 3, disp: 0.022
      },
      shells: {
        APFSDS: { n: 24, pen: 700, dmg: 680, name: 'M829A3 SABOT' },
        HEAT: { n: 14, pen: 600, dmg: 600, name: 'M830A1 MPAT' },
        HE: { n: 4, pen: 40, dmg: 500, splash: 12, name: 'M1028 Canister' }
      },
      optics: { zoom: [1, 3, 10, 25], thermal: true, night: true, lrf: true, fcs: true },
      colors: {
        hull: C.hex('#8a8266'), turret: C.hex('#8d8569'), track: C.hex('#4b4b46'),
        tire: C.hex('#31312e'), rim: C.hex('#6e6c5c'), metal: C.hex('#4c4c46'), drum: C.hex('#7d7660'),
        skirt: C.hex('#7d7660'), era: C.hex('#8a8266')
      },
      build: buildAbrams,
      desc: 'Gas turbine powered, digitally sighted, and fast for 62 tonnes. Hunter killer optics, blow out ammunition doors and a fully stabilised 120 mm smoothbore.',
      notes: ['Fire control computer + laser rangefinder', 'CITV gives the commander an independent thermal', 'Semi-ready ammo behind blast doors']
    }
  ];

  /** boxy stand-in drawn instead of the full model past a few hundred metres */
  function buildLod(model, spec) {
    const col = spec.colors, hit = model.hit;
    const deck = model.turretPivot[1];
    const mk = fn => { const mb = new MeshBuilder(); fn(mb); return mb.build(); };
    return {
      hull: mk(mb => {
        mb.box(0, (0.3 + deck) / 2, 0, hit.halfW * 1.85, Math.max(0.5, deck - 0.3), hit.halfL * 1.9, col.hull);
        for (const s of [-1, 1]) {
          mb.box(s * hit.halfW * 0.8, 0.34, 0, hit.halfW * 0.36, 0.68, hit.halfL * 1.82, col.track);
        }
      }),
      turret: mk(mb => {
        mb.box(0, 0.36, 0, hit.halfW * 1.15, 0.72, hit.halfL * 0.95, col.turret);
      }),
      gun: mk(mb => {
        mb.tube([0, 0, 0], [0, 0, model.muzzleZ], 0.1, 0.08, 5, col.turret);
      })
    };
  }

  const modelCache = {};
  function getModel(spec) {
    if (!modelCache[spec.id]) {
      const m = spec.build(spec.colors);
      m.lod = buildLod(m, spec);
      modelCache[spec.id] = m;
    }
    return modelCache[spec.id];
  }
  function byId(id) { return TANKS.find(t => t.id === id) || TANKS[0]; }
  function shellTypes(spec) { return Object.keys(spec.shells); }

  global.TankArt = Art;
  global.TANKS = TANKS;
  global.getTankModel = getModel;
  global.tankById = byId;
  global.shellTypes = shellTypes;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TANKS, getModel, byId, Art, shellTypes };
  }
})(typeof window !== 'undefined' ? window : globalThis);
