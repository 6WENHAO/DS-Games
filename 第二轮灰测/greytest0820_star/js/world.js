/* ==========================================================================
 * world.js — terrain, scenery, gunnery range and target vehicles.
 * ==========================================================================*/
(function (global) {
  'use strict';
  const M = global.M, C = global.C, MeshBuilder = global.MeshBuilder;

  const HALF = 384;            // world half extent
  /* two terrain detail levels: fine mesh close in, coarse mesh out to the fog */
  const LOD = {
    near: { cell: 8, span: 4 },    //  32 m chunks of 8 m quads
    far: { cell: 32, span: 3 }     //  96 m chunks of 32 m quads
  };

  class Terrain {
    constructor(seed) {
      this.seed = seed || 7;
      this.cache = { near: new Map(), far: new Map() };
      this.flatH = 2.0;
      this.LOD = LOD;
    }
    height(x, z) {
      const s = this.seed;
      let h = (M.fbm2(x * 0.0042, z * 0.0042, s, 4) - 0.5) * 34
        + (M.fbm2(x * 0.017, z * 0.017, s + 5, 3) - 0.5) * 4.6;
      const d = Math.hypot(x, z) / HALF;
      h += d * d * 22;                                     // rim of hills
      // the flat gunnery range stretches away to the north (+Z)
      const t = M.smooth(M.clamp01(1 - Math.hypot(x / 165, (z - 170) / 340)));
      h = M.lerp(h, this.flatH + (M.fbm2(x * 0.03, z * 0.03, s + 9, 2) - 0.5) * 2.4, t * 0.88);
      // motor pool pad
      const t2 = M.smooth(M.clamp01(1 - Math.hypot(x / 46, (z + 6) / 46)));
      h = M.lerp(h, this.flatH, t2);
      return h;
    }
    normal(x, z) {
      const e = 1.2;
      const hx = this.height(x + e, z) - this.height(x - e, z);
      const hz = this.height(x, z + e) - this.height(x, z - e);
      return M.norm([-hx, 2 * e, -hz]);
    }
    colorAt(x, z, h, slope) {
      const grass = [88, 100, 62], dry = [132, 124, 82], rock = [106, 102, 96], dirt = [118, 100, 76];
      const n = M.fbm2(x * 0.055, z * 0.055, this.seed + 31, 2);
      let col = C.mixc(grass, dry, M.clamp01(n * 1.35));
      if (slope > 0.30) col = C.mixc(col, rock, M.clamp01((slope - 0.30) * 2.6));
      // churned earth on the range and around the motor pool
      const near = M.clamp01(1 - Math.hypot(x / 130, (z - 150) / 300));
      const trail = M.fbm2(x * 0.02 + 4, z * 0.006, this.seed + 61, 2);
      if (near > 0.25 && trail > 0.56) col = C.mixc(col, dirt, M.clamp01((trail - 0.56) * 4) * 0.8);
      if (h < this.flatH + 0.35 && Math.hypot(x, z + 6) < 52) col = C.mixc(col, [116, 108, 92], 0.6);
      return C.jitter(col, (x * 7 + z * 13) | 0, 0.06);
    }
    chunkMesh(level, cx, cz) {
      const cache = this.cache[level];
      const key = cx + ',' + cz;
      let m = cache.get(key);
      if (m) return m;
      const L = LOD[level], CELL = L.cell, N = L.span;
      const mb = new MeshBuilder();
      const x0 = cx * N * CELL, z0 = cz * N * CELL;
      // one row of heights is shared with the next quad, so sample a grid once
      const H = [];
      for (let i = 0; i <= N; i++) {
        H.push([]);
        for (let j = 0; j <= N; j++) H[i].push(this.height(x0 + i * CELL, z0 + j * CELL));
      }
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const ax = x0 + i * CELL, az = z0 + j * CELL;
          const bx = ax + CELL, bz = az + CELL;
          const h00 = H[i][j], h10 = H[i + 1][j], h11 = H[i + 1][j + 1], h01 = H[i][j + 1];
          const hAvg = (h00 + h10 + h11 + h01) / 4;
          const slope = Math.max(Math.abs(h10 - h00), Math.abs(h01 - h00), Math.abs(h11 - h00)) / CELL;
          const col = this.colorAt(ax + CELL / 2, az + CELL / 2, hAvg, slope);
          mb.quad([ax, h00, az], [bx, h10, az], [bx, h11, bz], [ax, h01, bz], col);
        }
      }
      m = mb.build();
      cache.set(key, m);
      return m;
    }
  }

  /* ------------------------------------------------------------ scenery */
  function propMeshes() {
    const P = {};
    P.pine = global.buildMesh(mb => {
      mb.tube([0, 0, 0], [0, 1.6, 0], 0.20, 0.15, 6, [76, 60, 44]);
      for (let i = 0; i < 4; i++) {
        const y = 1.2 + i * 1.5, r = 2.1 - i * 0.42;
        mb.tube([0, y, 0], [0, y + 2.0, 0], r, r * 0.25, 8, C.tint([54, 76, 48], 0.9 + i * 0.06));
      }
    });
    P.oak = global.buildMesh(mb => {
      mb.tube([0, 0, 0], [0, 2.2, 0], 0.28, 0.22, 6, [84, 66, 48]);
      mb.dome([0, 2.0, 0], 2.4, 9, 3, [66, 86, 52]);
      mb.dome([0.9, 2.6, 0.5], 1.5, 8, 2, [72, 92, 56]);
      mb.dome([-0.8, 2.4, -0.6], 1.4, 8, 2, [60, 80, 48]);
    });
    P.bush = global.buildMesh(mb => {
      mb.dome([0, 0, 0], 1.0, 8, 2, [76, 84, 52]);
      mb.dome([0.5, 0.1, 0.3], 0.7, 7, 2, [68, 78, 48]);
    });
    P.rock = global.buildMesh(mb => {
      mb.dome([0, -0.3, 0], 1.5, 7, 2, [112, 108, 100]);
      mb.dome([0.8, -0.4, 0.6], 0.9, 6, 2, [100, 96, 92]);
    });
    P.hangar = global.buildMesh(mb => {
      const w = 9, l = 14, h = 4.4;
      mb.extrude([[0, -l / 2], [0, l / 2], [h, l / 2], [h, -l / 2]], 'x', -w, w, [122, 120, 110], { closed: true });
      // corrugated roof
      for (let i = 0; i < 12; i++) {
        mb.box(-w + (i + 0.5) * (2 * w / 12), h + 0.9, 0, (2 * w / 12) * 0.8, 0.12, l + 0.6,
          C.jitter([138, 134, 122], i, 0.06));
      }
      mb.tri([-w, h, l / 2], [w, h, l / 2], [0, h + 1.9, l / 2], [116, 114, 104]);
      mb.tri([-w, h, -l / 2], [w, h, -l / 2], [0, h + 1.9, -l / 2], [104, 102, 94]);
      // big open door on the +Z face
      mb.box(0, 1.9, l / 2 + 0.06, w * 1.1, 3.8, 0.12, [72, 76, 74]);
      mb.box(0, 1.9, l / 2 + 0.12, w * 0.5, 3.6, 0.1, [46, 48, 46]);
    });
    P.berm = global.buildMesh(mb => {
      for (let i = 0; i < 9; i++) {
        for (let r = 0; r < 3; r++) {
          mb.box(-3.2 + i * 0.8 + (r % 2) * 0.2, 0.16 + r * 0.3, 0, 0.74, 0.3, 0.7,
            C.jitter([132, 124, 96], i * 3 + r, 0.09));
        }
      }
    });
    P.crate = global.buildMesh(mb => {
      mb.box(0, 0.3, 0, 1.2, 0.6, 0.8, [104, 88, 62]);
      mb.box(0, 0.62, 0, 1.1, 0.06, 0.72, [118, 100, 70]);
      mb.box(0, 0.3, 0.41, 0.3, 0.2, 0.02, [70, 66, 58]);
    });
    P.drum = global.buildMesh(mb => {
      mb.tube([0, 0, 0], [0, 0.9, 0], 0.3, 0.3, 10, [92, 78, 52]);
      mb.ring([0, 0.3, 0], 'y', 0.32, 0.28, 10, [76, 64, 44]);
      mb.ring([0, 0.6, 0], 'y', 0.32, 0.28, 10, [76, 64, 44]);
      mb.disc([0, 0.91, 0], 'y', 0.3, 10, [104, 90, 60]);
    });
    P.tower = global.buildMesh(mb => {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        mb.tube([sx * 1.4, 0, sz * 1.4], [sx * 0.9, 6.0, sz * 0.9], 0.14, 0.12, 5, [96, 82, 60]);
      }
      mb.box(0, 6.2, 0, 3.0, 0.2, 3.0, [110, 98, 74]);
      for (const sz of [-1, 1]) mb.box(0, 6.7, sz * 1.4, 3.0, 0.9, 0.1, [104, 92, 70]);
      for (const sx of [-1, 1]) mb.box(sx * 1.4, 6.7, 0, 0.1, 0.9, 3.0, [104, 92, 70]);
      mb.box(0, 7.5, 0, 3.4, 0.14, 3.4, [86, 84, 78]);
    });
    P.flag = global.buildMesh(mb => {
      mb.tube([0, 0, 0], [0, 4.2, 0], 0.07, 0.05, 6, [180, 176, 168]);
      mb.quad([0, 4.2, 0], [0, 3.4, 0], [0, 3.5, 1.1], [0, 4.2, 1.0], [188, 62, 52], { flat: true });
    });
    P.panel = global.buildMesh(mb => {
      mb.box(0, 1.1, 0, 2.4, 2.2, 0.12, [176, 168, 146]);
      mb.box(0, 1.1, 0.08, 1.2, 1.2, 0.02, [92, 88, 84], { flat: true });
      mb.box(0, 1.1, 0.1, 0.5, 0.5, 0.02, [176, 168, 146], { flat: true });
      for (const s of [-1, 1]) mb.tube([s * 1.1, 0, 0.2], [s * 1.1, 0.9, 0], 0.07, 0.06, 5, [86, 74, 56]);
    });
    return P;
  }

  class World {
    constructor(seed) {
      this.terrain = new Terrain(seed);
      this.bound = HALF;
      this.props = [];
      this.targets = [];
      this.parked = [];
      this.shells = new global.Sim.Projectiles();
      this.fx = new global.Sim.Particles(1100);
      this.dustColor = [166, 152, 122];
      this.time = 0;
      this.sky = { top: C.hex('#5f86b8'), horizon: C.hex('#b9c6cf'), ground: C.hex('#7d8464') };
      this.light = { dir: M.norm([-0.42, -0.78, 0.30]), amb: 0.44, color: [255, 246, 224] };
      this.fog = { color: C.hex('#aebbc6'), near: 90, far: 620, density: 0.92, cut: 1500 };
      this.P = propMeshes();
      this.build(seed || 7);
    }

    addProp(mesh, pos, yaw, scale, tint) {
      const s = scale || 1;
      let mat = M.mul(M.translateV(pos), M.rotY(yaw || 0));
      if (s !== 1) mat = M.mul(mat, M.scaleM(s));
      this.props.push({
        mesh, mat, pos, r: mesh.r * s + 1, tint: tint || null,
        cull: 55 + mesh.r * s * 24        // big landmarks stay visible much further out
      });
    }

    build(seed) {
      const rnd = M.rng(seed * 977 + 13);
      const T = this.terrain, P = this.P;
      const put = (mesh, x, z, yaw, scale, tint) => {
        this.addProp(mesh, [x, T.height(x, z), z], yaw, scale, tint);
      };
      // ---- trees & rocks, avoiding the range and the motor pool ----
      for (let i = 0; i < 460; i++) {
        const x = (rnd() - 0.5) * 2 * (HALF - 20);
        const z = (rnd() - 0.5) * 2 * (HALF - 20);
        const onRange = Math.hypot(x / 150, (z - 170) / 320) < 1.02;
        const inPool = Math.hypot(x, z + 6) < 60;
        if (inPool) continue;
        if (onRange && rnd() < 0.93) continue;
        const h = T.height(x, z);
        const slope = 1 - T.normal(x, z)[1];
        if (slope > 0.35 && rnd() < 0.7) { put(P.rock, x, z, rnd() * 6, 0.7 + rnd() * 1.3); continue; }
        const r = rnd();
        if (r < 0.5) put(P.pine, x, z, rnd() * 6, 0.7 + rnd() * 0.7);
        else if (r < 0.78) put(P.oak, x, z, rnd() * 6, 0.7 + rnd() * 0.6);
        else if (r < 0.92) put(P.bush, x, z, rnd() * 6, 0.6 + rnd());
        else put(P.rock, x, z, rnd() * 6, 0.5 + rnd());
      }
      // ---- motor pool ----
      put(P.hangar, -30, -22, 0.06, 1);
      put(P.tower, 26, -26, 0.4, 1);
      put(P.flag, 4, -30, 0, 1);
      for (let i = 0; i < 7; i++) put(P.drum, -14 + i * 1.0, -30 - (i % 2) * 1.1, rnd() * 6, 1);
      for (let i = 0; i < 9; i++) put(P.crate, 10 + (i % 3) * 1.5, -34 - Math.floor(i / 3) * 1.1, rnd() * 0.4, 1);
      for (let i = 0; i < 6; i++) put(P.berm, -34 + i * 6.4, 14, 0, 1);
      for (let i = 0; i < 4; i++) put(P.berm, 20 + i * 6.4, 16, 0.1, 1);
      // range markers every 100 m
      for (let d = 100; d <= 900; d += 100) {
        put(P.flag, -26 - d * 0.02, d, 0, 0.8);
        put(P.flag, 26 + d * 0.02, d, 0, 0.8);
      }
      // close range panel targets
      for (let i = 0; i < 5; i++) put(P.panel, -18 + i * 9, 95 + (i % 2) * 8, 3.14 + (rnd() - 0.5) * 0.2, 1);

      // ---- parked vehicles you can walk the camera around ----
      const specs = global.TANKS;
      this.parked = [
        { spec: specs[1], pos: [-46, 0, -14], yaw: 1.1, turret: -0.3, gun: 0.05 },
        { spec: specs[2], pos: [-46, 0, -2], yaw: 1.1, turret: 0.2, gun: 0.02 },
        { spec: specs[4], pos: [-46, 0, 12], yaw: 1.05, turret: 0.0, gun: 0.0 }
      ];
      for (const p of this.parked) p.pos[1] = T.height(p.pos[0], p.pos[2]);

      // ---- targets on the range ----
      const layout = [
        { id: 't34', x: -38, z: 210, yaw: 2.4, hp: 260 },
        { id: 'tiger', x: 34, z: 305, yaw: 3.5, hp: 420 },
        { id: 't72', x: -96, z: 360, yaw: 2.0, hp: 520 },
        { id: 'sherman', x: 78, z: 455, yaw: 3.9, hp: 300 },
        { id: 't34', x: -24, z: 540, yaw: 3.2, hp: 260 },
        { id: 'abrams', x: 108, z: 640, yaw: 3.6, hp: 700 },
        { id: 'tiger', x: -120, z: 700, yaw: 2.6, hp: 420 }
      ];
      for (const L of layout) this.addTarget(L.id, [L.x, 0, L.z], L.yaw, L.hp);
      // one moving target to practise lead
      const mover = this.addTarget('t34', [-70, 0, 285], 1.57, 300);
      mover.patrol = { from: -110, to: 60, speed: 5.2, dir: 1 };
      mover.mobile = true;
    }

    addTarget(specId, pos, yaw, hp) {
      const spec = global.tankById(specId);
      const t = {
        spec, model: global.getTankModel(spec), pos: M.copy(pos), yaw,
        turretYaw: (Math.random() - 0.5) * 0.8, gunPitch: 0.02,
        hp: hp, maxHp: hp, radius: Math.max(spec.id === 'abrams' ? 2.4 : 2.1, 2.0),
        dead: false, deadT: 0, tilt: 0, armor: spec.armor.hull
      };
      t.pos[1] = this.terrain.height(pos[0], pos[2]);
      this.targets.push(t);
      return t;
    }

    update(dt) {
      this.time += dt;
      for (const t of this.targets) {
        if (t.patrol && !t.dead) {
          const p = t.patrol;
          t.pos[0] += p.speed * p.dir * dt;
          if (t.pos[0] > p.to) { t.pos[0] = p.to; p.dir = -1; t.yaw = -1.57; }
          if (t.pos[0] < p.from) { t.pos[0] = p.from; p.dir = 1; t.yaw = 1.57; }
          t.pos[1] = this.terrain.height(t.pos[0], t.pos[2]);
          if (Math.random() < dt * 6) {
            this.fx.spawn({
              pos: [t.pos[0] - Math.sign(p.dir) * 2.5, t.pos[1] + 0.3, t.pos[2] + (Math.random() - 0.5)],
              vel: [0, 0.6, 0], size: 0.5, life: 1.6, col: this.dustColor, alpha: 0.25, grow: 2.4
            });
          }
        }
        if (t.dead) {
          t.deadT += dt;
          t.tilt = M.damp(t.tilt, 0.09, 1.2, dt);
          if (t.deadT < 40 && Math.random() < dt * 12) {
            this.fx.spawn({
              pos: [t.pos[0] + (Math.random() - 0.5) * 2, t.pos[1] + 2.2, t.pos[2] + (Math.random() - 0.5) * 2],
              vel: [0.3, 2.6 + Math.random(), 0.2], size: 1.0, life: 4.5,
              col: [58, 56, 54], col2: [120, 118, 114], alpha: 0.5, grow: 3.4, gravity: 0.5
            });
          }
          if (t.deadT < 8 && Math.random() < dt * 10) {
            this.fx.spawn({
              pos: [t.pos[0], t.pos[1] + 1.6, t.pos[2]], vel: [0, 3, 0], size: 0.7, life: 0.6,
              col: [255, 160, 60], alpha: 0.8, glow: true, grow: 1.6
            });
          }
        }
      }
      this.fx.update(dt);
    }

    /** draw terrain, scenery and target vehicles */
    draw(r, cam, viewDist) {
      const T = this.terrain;
      const vd = viewDist || 480;
      const cpx = cam.pos[0], cpz = cam.pos[2];
      // ---- fine terrain close in ----
      const ns = LOD.near.cell * LOD.near.span;
      const nearR = Math.min(vd, 136);
      const nlim = Math.ceil(HALF / ns);
      let ni = Math.floor(cpx / ns), nj = Math.floor(cpz / ns);
      const nrad = Math.ceil(nearR / ns);
      for (let i = -nrad; i <= nrad; i++) {
        for (let j = -nrad; j <= nrad; j++) {
          const gx = ni + i, gz = nj + j;
          if (Math.abs(gx) > nlim || Math.abs(gz) > nlim) continue;
          const bx = (gx + 0.5) * ns, bz = (gz + 0.5) * ns;
          if (Math.hypot(bx - cpx, bz - cpz) > nearR + ns) continue;
          r.drawMesh(T.chunkMesh('near', gx, gz), null);
        }
      }
      // ---- coarse terrain out to the fog, skipping what the fine mesh covers --
      const fs = LOD.far.cell * LOD.far.span;
      const flim = Math.ceil(HALF / fs);
      const fi = Math.floor(cpx / fs), fj = Math.floor(cpz / fs);
      const frad = Math.ceil(vd / fs);
      for (let i = -frad; i <= frad; i++) {
        for (let j = -frad; j <= frad; j++) {
          const gx = fi + i, gz = fj + j;
          if (Math.abs(gx) > flim || Math.abs(gz) > flim) continue;
          const bx = (gx + 0.5) * fs, bz = (gz + 0.5) * fs;
          if (Math.hypot(bx - cpx, bz - cpz) > vd + fs) continue;
          if (Math.abs(bx - cpx) + fs / 2 < nearR && Math.abs(bz - cpz) + fs / 2 < nearR) continue;
          r.drawMesh(T.chunkMesh('far', gx, gz), null);
        }
      }
      // ---- scenery: small things vanish sooner than big ones ----
      for (const p of this.props) {
        const d2 = M.dist2(p.pos, cam.pos);
        const cull = Math.min(vd, p.cull);
        if (d2 > cull * cull) continue;
        r.drawMesh(p.mesh, p.mat, p.tint ? { tint: p.tint } : undefined);
      }
      // ---- vehicles, with a boxy proxy model past 240 m ----
      for (const t of this.targets) {
        const d = M.dist(t.pos, cam.pos);
        if (d > 1500) continue;
        drawVehicle(r, t.model, t.pos, t.yaw, t.tilt, 0, t.turretYaw, t.gunPitch,
          t.dead ? { tint: [78, 66, 58], lod: d > 240 } : { heat: 0.18, lod: d > 240 });
      }
      for (const p of this.parked) {
        const d = M.dist(p.pos, cam.pos);
        if (d > 700) continue;
        drawVehicle(r, global.getTankModel(p.spec), p.pos, p.yaw, 0, 0, p.turret, p.gun,
          { lod: d > 240 });
      }
    }
  }

  /** shared exterior draw used for targets, parked tanks and the player */
  function drawVehicle(r, model, pos, yaw, pitch, roll, turretYaw, gunPitch, opt) {
    const hull = M.body(pos, yaw, pitch, roll);
    const turret = M.mulAll(hull, M.translateV(model.turretPivot), M.rotY(turretYaw || 0));
    const gun = M.mulAll(turret, M.translateV(model.trunnion), M.rotX(-(gunPitch || 0)));
    const src = (opt && opt.lod && model.lod) ? model.lod : model;
    r.drawMesh(src.hull, hull, opt);
    r.drawMesh(src.turret, turret, opt);
    r.drawMesh(src.gun, gun, opt);
    return { hull, turret, gun };
  }

  global.World = World;
  global.Terrain = Terrain;
  global.drawVehicle = drawVehicle;
  if (typeof module !== 'undefined' && module.exports) module.exports = { World, Terrain, drawVehicle };
})(typeof window !== 'undefined' ? window : globalThis);
