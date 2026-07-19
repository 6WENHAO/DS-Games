/* ============================================================
   POOLROOMS · world.js
   无限分块生成:泳池 / 柱厅 / 平台 / 楼梯 / 天窗 / 隔墙
   每格 16m,水面统一 y=0.22,基底地面 y=0,深池 -2.3
   ============================================================ */
(function () {
  'use strict';
  const CELL = 16, WATER_Y = 0.22, POOL_D = -2.3, PLAT_H = 0.55, LEDGE_H = 1.1;
  PR.CELL = CELL; PR.WATER_Y = WATER_Y;

  /* ---------- 哈希 ---------- */
  const SEED = 20260719;
  function hash(cx, cz, salt) {
    let h = SEED ^ Math.imul(cx, 374761393) ^ Math.imul(cz, 668265263) ^ Math.imul(salt, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function vnoise(x, z, salt) {
    const xi = Math.floor(x), zi = Math.floor(z);
    const fx = x - xi, fz = z - zi;
    const sm = t => t * t * (3 - 2 * t);
    const a = hash(xi, zi, salt), b = hash(xi + 1, zi, salt);
    const c = hash(xi, zi + 1, salt), d = hash(xi + 1, zi + 1, salt);
    const u = sm(fx), v = sm(fz);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  function ceilH(cx, cz) {
    const v = vnoise(cx * 0.33 + 3.7, cz * 0.33 - 1.2, 11);
    if (v < 0.3) return 3.3;
    if (v < 0.82) return 5.4;
    return 7.4;
  }

  /* ---------- 矩形挖洞 ---------- */
  function subtractRect(rects, hole) {
    const out = [];
    for (const r of rects) {
      const ix0 = Math.max(r.x0, hole.x0), iz0 = Math.max(r.z0, hole.z0);
      const ix1 = Math.min(r.x1, hole.x1), iz1 = Math.min(r.z1, hole.z1);
      if (ix0 >= ix1 || iz0 >= iz1) { out.push(r); continue; }
      if (r.z0 < iz0) out.push({ x0: r.x0, z0: r.z0, x1: r.x1, z1: iz0 });
      if (iz1 < r.z1) out.push({ x0: r.x0, z0: iz1, x1: r.x1, z1: r.z1 });
      if (r.x0 < ix0) out.push({ x0: r.x0, z0: iz0, x1: ix0, z1: iz1 });
      if (ix1 < r.x1) out.push({ x0: ix1, z0: iz0, x1: r.x1, z1: iz1 });
    }
    return out;
  }

  /* ---------- 几何收集器 ---------- */
  function Sink() {
    return { pos: [], nor: [], uv: [], idx: [] };
  }
  function quad(s, p0, p1, p2, p3, n, uvs) {
    const b = s.pos.length / 3;
    [p0, p1, p2, p3].forEach(p => { s.pos.push(p[0], p[1], p[2]); s.nor.push(n[0], n[1], n[2]); });
    uvs.forEach(t => s.uv.push(t[0], t[1]));
    s.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  function hquad(s, x0, z0, x1, z1, y, up, uvScale) {
    const k = uvScale;
    if (up) quad(s, [x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 1, 0],
      [[x0 * k, z1 * k], [x1 * k, z1 * k], [x1 * k, z0 * k], [x0 * k, z0 * k]]);
    else quad(s, [x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, -1, 0],
      [[x0 * k, z0 * k], [x1 * k, z0 * k], [x1 * k, z1 * k], [x0 * k, z1 * k]]);
  }
  function vquadX(s, x0, x1, y0, y1, z, nz, uvScale) {
    const k = uvScale;
    if (nz > 0) quad(s, [x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [0, 0, 1],
      [[x0 * k, y0 * k], [x1 * k, y0 * k], [x1 * k, y1 * k], [x0 * k, y1 * k]]);
    else quad(s, [x1, y0, z], [x0, y0, z], [x0, y1, z], [x1, y1, z], [0, 0, -1],
      [[x1 * k, y0 * k], [x0 * k, y0 * k], [x0 * k, y1 * k], [x1 * k, y1 * k]]);
  }
  function vquadZ(s, z0, z1, y0, y1, x, nx, uvScale) {
    const k = uvScale;
    if (nx > 0) quad(s, [x, y0, z1], [x, y0, z0], [x, y1, z0], [x, y1, z1], [1, 0, 0],
      [[z1 * k, y0 * k], [z0 * k, y0 * k], [z0 * k, y1 * k], [z1 * k, y1 * k]]);
    else quad(s, [x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0], [-1, 0, 0],
      [[z0 * k, y0 * k], [z1 * k, y0 * k], [z1 * k, y1 * k], [z0 * k, y1 * k]]);
  }
  function box(s, x0, y0, z0, x1, y1, z1, uvScale, faces) {
    faces = faces || {};
    if (faces.py !== false) hquad(s, x0, z0, x1, z1, y1, true, uvScale);
    if (faces.ny) hquad(s, x0, z0, x1, z1, y0, false, uvScale);
    if (faces.pz !== false) vquadX(s, x0, x1, y0, y1, z1, 1, uvScale);
    if (faces.nz !== false) vquadX(s, x0, x1, y0, y1, z0, -1, uvScale);
    if (faces.px !== false) vquadZ(s, z0, z1, y0, y1, x1, 1, uvScale);
    if (faces.nx !== false) vquadZ(s, z0, z1, y0, y1, x0, -1, uvScale);
  }

  const UV_TILE = 1 / 1.6;
  const UV_MOS = 1 / 0.8;
  const UV_CON = 1 / 3.2;

  /* ================= 单元生成 ================= */
  function genCell(cx, cz) {
    const ox = cx * CELL, oz = cz * CELL;
    const H = ceilH(cx, cz);
    const isSpawn = (cx === 0 && cz === 0);
    const r = s => hash(cx, cz, s);

    const hasPool = !isSpawn && r(1) < 0.55;
    const hasPillars = isSpawn ? true : r(2) < 0.62;
    let hasPlat = !isSpawn && !hasPool && r(3) < 0.34;
    const hasWalls = !isSpawn && r(4) < 0.3;
    const tallStair = hasPlat && r(5) < 0.45 && H > 4;
    let skyCount = 0;
    if (H > 4) skyCount = 1 + (r(6) < 0.45 ? 1 : 0);
    else if (r(6) < 0.18) skyCount = 1;
    if (isSpawn) skyCount = 2;

    const sinks = { tile: Sink(), mosaic: Sink(), concrete: Sink() };
    const floors = [], solids = [], skylights = [], shafts = [];
    const flo = (x0, z0, x1, z1, y) => floors.push({ x0, z0, x1, z1, y });
    const sol = (x0, z0, x1, z1, y0, y1) => solids.push({ x0, z0, x1, z1, y0, y1 });

    /* ---- 泳池 ---- */
    let pool = null;
    if (hasPool) {
      const pw = 6 + r(10) * 5, pd = 5 + r(11) * 4;
      const px = ox + 2.4 + r(12) * (CELL - pw - 4.8);
      const pz = oz + 2.4 + r(13) * (CELL - pd - 4.8);
      pool = { x0: px, z0: pz, x1: px + pw, z1: pz + pd };
    }

    /* ---- 地面(挖去泳池) ---- */
    let floorRects = [{ x0: ox, z0: oz, x1: ox + CELL, z1: oz + CELL }];
    if (pool) floorRects = subtractRect(floorRects, pool);
    for (const fr of floorRects) {
      hquad(sinks.tile, fr.x0, fr.z0, fr.x1, fr.z1, 0, true, UV_TILE);
      flo(fr.x0, fr.z0, fr.x1, fr.z1, 0);
    }

    /* ---- 泳池内部(马赛克) ---- */
    if (pool) {
      const p = pool;
      hquad(sinks.mosaic, p.x0, p.z0, p.x1, p.z1, POOL_D, true, UV_MOS);
      flo(p.x0, p.z0, p.x1, p.z1, POOL_D);
      vquadX(sinks.mosaic, p.x0, p.x1, POOL_D, 0, p.z0, 1, UV_MOS);
      vquadX(sinks.mosaic, p.x0, p.x1, POOL_D, 0, p.z1, -1, UV_MOS);
      vquadZ(sinks.mosaic, p.z0, p.z1, POOL_D, 0, p.x0, 1, UV_MOS);
      vquadZ(sinks.mosaic, p.z0, p.z1, POOL_D, 0, p.x1, -1, UV_MOS);
      const bw = 0.24;
      hquad(sinks.mosaic, p.x0 - bw, p.z0 - bw, p.x1 + bw, p.z0, 0.005, true, UV_MOS);
      hquad(sinks.mosaic, p.x0 - bw, p.z1, p.x1 + bw, p.z1 + bw, 0.005, true, UV_MOS);
      hquad(sinks.mosaic, p.x0 - bw, p.z0, p.x0, p.z1, 0.005, true, UV_MOS);
      hquad(sinks.mosaic, p.x1, p.z0, p.x1 + bw, p.z1, 0.005, true, UV_MOS);
      const sw = Math.min(2.6, (p.x1 - p.x0) - 1);
      const sx0 = p.x0 + ((p.x1 - p.x0) - sw) / 2;
      for (let i = 0; i < 4; i++) {
        const sy = -0.55 * (i + 1) + 0.12;
        const sz1 = p.z1 - i * 0.55;
        box(sinks.mosaic, sx0, POOL_D, sz1 - 0.55, sx0 + sw, sy, sz1, UV_MOS, { pz: false, ny: false });
        flo(sx0, sz1 - 0.55, sx0 + sw, sz1, sy);
      }
    }

    /* ---- 天花板(挖天窗) ---- */
    let ceilRects = [{ x0: ox, z0: oz, x1: ox + CELL, z1: oz + CELL }];
    for (let i = 0; i < skyCount; i++) {
      const hw = 1.1 + r(20 + i) * 0.9, hd = 1.6 + r(24 + i) * 1.2;
      const hx = ox + 2.5 + r(21 + i) * (CELL - hw * 2 - 5);
      const hz = oz + 2.5 + r(22 + i) * (CELL - hd * 2 - 5);
      const hole = { x0: hx, z0: hz, x1: hx + hw * 2, z1: hz + hd * 2 };
      ceilRects = subtractRect(ceilRects, hole);
      skylights.push(hole);
      const s2 = sinks.concrete;
      vquadX(s2, hole.x0, hole.x1, H, H + 0.9, hole.z0, 1, UV_CON);
      vquadX(s2, hole.x0, hole.x1, H, H + 0.9, hole.z1, -1, UV_CON);
      vquadZ(s2, hole.z0, hole.z1, H, H + 0.9, hole.x0, 1, UV_CON);
      vquadZ(s2, hole.z0, hole.z1, H, H + 0.9, hole.x1, -1, UV_CON);
      shafts.push({ hole, top: H });
    }
    for (const cr of ceilRects) hquad(sinks.concrete, cr.x0, cr.z0, cr.x1, cr.z1, H, false, UV_CON);

    /* ---- 天花板边梁(东/南边,含底面) ---- */
    const BW = 0.55, BD = 0.6;
    box(sinks.concrete, ox, H - BD, oz + CELL - BW / 2, ox + CELL, H, oz + CELL + BW / 2, UV_CON, { py: false, ny: true });
    box(sinks.concrete, ox + CELL - BW / 2, H - BD, oz, ox + CELL + BW / 2, H, oz + CELL, UV_CON, { py: false, ny: true });

    /* ---- 相邻天花高差围板 ---- */
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const d of dirs) {
      const nH = ceilH(cx + d[0], cz + d[1]);
      if (nH < H - 0.01) {
        if (d[0] === 1) { vquadZ(sinks.tile, oz, oz + CELL, nH, H, ox + CELL, -1, UV_TILE); vquadZ(sinks.tile, oz, oz + CELL, nH, H, ox + CELL, 1, UV_TILE); }
        if (d[0] === -1) { vquadZ(sinks.tile, oz, oz + CELL, nH, H, ox, 1, UV_TILE); vquadZ(sinks.tile, oz, oz + CELL, nH, H, ox, -1, UV_TILE); }
        if (d[1] === 1) { vquadX(sinks.tile, ox, ox + CELL, nH, H, oz + CELL, -1, UV_TILE); vquadX(sinks.tile, ox, ox + CELL, nH, H, oz + CELL, 1, UV_TILE); }
        if (d[1] === -1) { vquadX(sinks.tile, ox, ox + CELL, nH, H, oz, 1, UV_TILE); vquadX(sinks.tile, ox, ox + CELL, nH, H, oz, -1, UV_TILE); }
      }
    }

    /* ---- 角落结构柱(每格仅发射自身 min 角,避免重叠) ---- */
    const PIER = 0.42;
    box(sinks.tile, ox - PIER, 0, oz - PIER, ox + PIER, H, oz + PIER, UV_TILE, { py: false, ny: false });
    sol(ox - PIER, oz - PIER, ox + PIER, oz + PIER, 0, H);

    /* ---- 柱阵 ---- */
    if (hasPillars) {
      const pitch = 4, half = 0.26;
      for (let ix = 1; ix < 4; ix++) for (let iz = 1; iz < 4; iz++) {
        if (hash(cx * 4 + ix, cz * 4 + iz, 30) < 0.22) continue;
        const px = ox + ix * pitch, pz = oz + iz * pitch;
        if (pool && px > pool.x0 - 0.6 && px < pool.x1 + 0.6 && pz > pool.z0 - 0.6 && pz < pool.z1 + 0.6) continue;
        box(sinks.tile, px - half, 0, pz - half, px + half, H, pz + half, UV_TILE, { py: false, ny: false });
        sol(px - half, pz - half, px + half, pz + half, 0, H);
      }
    }

    /* ---- 平台 + 楼梯 ---- */
    if (hasPlat) {
      const pw = 4.5 + r(40) * 3, pd = 3.5 + r(41) * 2.5;
      const corner = (r(42) * 4) | 0;
      const px0 = (corner & 1) ? ox + CELL - 1.2 - pw : ox + 1.2;
      const pz0 = (corner & 2) ? oz + CELL - 1.2 - pd : oz + 1.2;
      const topY = tallStair ? LEDGE_H : PLAT_H;
      const p = { x0: px0, z0: pz0, x1: px0 + pw, z1: pz0 + pd };
      box(sinks.tile, p.x0, 0, p.z0, p.x1, topY, p.z1, UV_TILE, { ny: false });
      flo(p.x0, p.z0, p.x1, p.z1, topY);
      const stairsOnX = (corner & 1) ? -1 : 1;
      const steps = Math.ceil(topY / 0.18);
      const sw = Math.min(3, pd - 1);
      const swz0 = pz0 + (pd - sw) / 2;
      const sx = (corner & 1) ? p.x0 : p.x1;
      for (let i = 0; i < steps; i++) {
        const sy = topY - i * 0.18;
        const tx0 = sx + stairsOnX * (i * 0.3), tx1 = sx + stairsOnX * ((i + 1) * 0.3);
        const bx0 = Math.min(tx0, tx1), bx1 = Math.max(tx0, tx1);
        box(sinks.tile, bx0, 0, swz0, bx1, sy, swz0 + sw, UV_TILE, { ny: false });
        flo(bx0, swz0, bx1, swz0 + sw, sy);
      }
      const side = (x0, z0, x1, z1) => sol(x0, z0, x1, z1, 0, topY);
      if ((corner & 1)) {
        side(p.x1 - 0.1, p.z0, p.x1, p.z1);
        side(p.x0, p.z0, p.x0 + 0.1, swz0);
        side(p.x0, swz0 + sw, p.x0 + 0.1, p.z1);
      } else {
        side(p.x0, p.z0, p.x0 + 0.1, p.z1);
        side(p.x1 - 0.1, p.z0, p.x1, swz0);
        side(p.x1 - 0.1, swz0 + sw, p.x1, p.z1);
      }
      side(p.x0, p.z0, p.x1, p.z0 + 0.1);
      side(p.x0, p.z1 - 0.1, p.x1, p.z1);
    }

    /* ---- 内部隔墙(带门洞,门楣含底面) ---- */
    if (hasWalls) {
      const nW = 1 + (r(50) < 0.5 ? 1 : 0);
      for (let i = 0; i < nW; i++) {
        const alongX = r(51 + i) < 0.5;
        const t = 0.35;
        const len = 6 + r(52 + i) * 7;
        const doorW = 2.1, doorH = Math.min(2.6, H - 0.5);
        if (alongX) {
          const wz = oz + 3 + r(53 + i) * (CELL - 6);
          const wx0 = ox + 1.5 + r(54 + i) * (CELL - len - 3);
          const dx0 = wx0 + (len - doorW) * (0.25 + r(55 + i) * 0.5);
          if (pool && wz > pool.z0 - 1 && wz < pool.z1 + 1) continue;
          box(sinks.tile, wx0, 0, wz - t / 2, dx0, H, wz + t / 2, UV_TILE, { ny: false });
          box(sinks.tile, dx0 + doorW, 0, wz - t / 2, wx0 + len, H, wz + t / 2, UV_TILE, { ny: false });
          box(sinks.tile, dx0, doorH, wz - t / 2, dx0 + doorW, H, wz + t / 2, UV_TILE, { ny: true });
          sol(wx0, wz - t / 2, dx0, wz + t / 2, 0, H);
          sol(dx0 + doorW, wz - t / 2, wx0 + len, wz + t / 2, 0, H);
          sol(dx0, wz - t / 2, dx0 + doorW, wz + t / 2, doorH, H);
        } else {
          const wx = ox + 3 + r(53 + i) * (CELL - 6);
          const wz0 = oz + 1.5 + r(54 + i) * (CELL - len - 3);
          const dz0 = wz0 + (len - doorW) * (0.25 + r(55 + i) * 0.5);
          if (pool && wx > pool.x0 - 1 && wx < pool.x1 + 1) continue;
          box(sinks.tile, wx - t / 2, 0, wz0, wx + t / 2, H, dz0, UV_TILE, { ny: false });
          box(sinks.tile, wx - t / 2, 0, dz0 + doorW, wx + t / 2, H, wz0 + len, UV_TILE, { ny: false });
          box(sinks.tile, wx - t / 2, doorH, dz0, wx + t / 2, H, dz0 + doorW, UV_TILE, { ny: true });
          sol(wx - t / 2, wz0, wx + t / 2, dz0, 0, H);
          sol(wx - t / 2, dz0 + doorW, wx + t / 2, wz0 + len, 0, H);
          sol(wx - t / 2, dz0, wx + t / 2, dz0 + doorW, doorH, H);
        }
      }
    }

    /* ---- 水面网格 ---- */
    const water = buildWaterGeom(ox, oz, pool);

    return { cx, cz, H, sinks, floors, solids, skylights, shafts, water, pool };
  }

  function buildWaterGeom(ox, oz, pool) {
    const SEG = 24;
    const pos = [], uv = [], dep = [], idx = [];
    const st = CELL / SEG;
    for (let iz = 0; iz <= SEG; iz++) for (let ix = 0; ix <= SEG; ix++) {
      const x = ox + ix * st, z = oz + iz * st;
      pos.push(x, WATER_Y, z);
      uv.push(x, z);
      let d = 0 - WATER_Y;
      if (pool && x > pool.x0 + 0.01 && x < pool.x1 - 0.01 && z > pool.z0 + 0.01 && z < pool.z1 - 0.01) d = POOL_D - WATER_Y;
      dep.push(-d);
    }
    for (let iz = 0; iz < SEG; iz++) for (let ix = 0; ix < SEG; ix++) {
      const a = iz * (SEG + 1) + ix, b = a + 1, c = a + SEG + 1, d2 = c + 1;
      idx.push(a, c, b, b, c, d2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aUv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('aDepth', new THREE.Float32BufferAttribute(dep, 1));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  }

  /* ================= 世界管理 ================= */
  const World = PR.world = {
    cells: new Map(),
    group: null, waterGroup: null,
    mats: null, R: 2,

    init(scene, waterScene, mats) {
      this.group = new THREE.Group();
      scene.add(this.group);
      this.waterGroup = new THREE.Group();
      waterScene.add(this.waterGroup);
      this.mats = mats;
    },

    key: (cx, cz) => cx + ',' + cz,

    ensure(cx, cz) {
      const k = this.key(cx, cz);
      if (this.cells.has(k)) return this.cells.get(k);
      const data = genCell(cx, cz);
      const cellGroup = new THREE.Group();
      const mk = (sink, mat) => {
        if (!sink.idx.length) return null;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(sink.pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(sink.nor, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(sink.uv, 2));
        g.setAttribute('uv2', new THREE.Float32BufferAttribute(sink.uv.slice(), 2));
        g.setIndex(sink.idx);
        g.computeBoundingSphere();
        const m = new THREE.Mesh(g, mat);
        m.castShadow = true; m.receiveShadow = true;
        m.matrixAutoUpdate = false;
        cellGroup.add(m);
        return m;
      };
      mk(data.sinks.tile, this.mats.tile);
      mk(data.sinks.mosaic, this.mats.mosaic);
      mk(data.sinks.concrete, this.mats.concrete);
      for (const sh of data.shafts) {
        const h = sh.hole;
        const sky = new THREE.Mesh(new THREE.PlaneGeometry(h.x1 - h.x0, h.z1 - h.z0), this.mats.sky);
        sky.rotation.x = Math.PI / 2;
        sky.position.set((h.x0 + h.x1) / 2, sh.top + 0.88, (h.z0 + h.z1) / 2);
        cellGroup.add(sky);
        const shaft = PR.makeShaft(h, sh.top);
        if (shaft) cellGroup.add(shaft);
        const dust = PR.makeDust(h, sh.top);
        if (dust) cellGroup.add(dust);
      }
      const water = new THREE.Mesh(data.water, PR.waterMat);
      water.frustumCulled = true;
      water.matrixAutoUpdate = false;
      this.waterGroup.add(water);
      data.waterMesh = water;
      this.group.add(cellGroup);
      data.group = cellGroup;
      this.cells.set(k, data);
      return data;
    },

    update(px, pz) {
      const cx = Math.floor(px / CELL), cz = Math.floor(pz / CELL);
      const R = this.R;
      for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) this.ensure(cx + dx, cz + dz);
      for (const [k, c] of this.cells) {
        if (Math.abs(c.cx - cx) > R + 1 || Math.abs(c.cz - cz) > R + 1) {
          c.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
          this.group.remove(c.group);
          this.waterGroup.remove(c.waterMesh);
          c.waterMesh.geometry.dispose();
          this.cells.delete(k);
        }
      }
    },

    /* ---------- 物理查询 ---------- */
    _cellsAround(x, z) {
      const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
      const out = [];
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        const c = this.cells.get(this.key(cx + dx, cz + dz));
        if (c) out.push(c);
      }
      return out;
    },
    groundAt(x, z, feetY, stepMax) {
      let best = -100;
      for (const c of this._cellsAround(x, z)) {
        for (const f of c.floors) {
          if (x >= f.x0 && x <= f.x1 && z >= f.z0 && z <= f.z1) {
            if (f.y <= feetY + (stepMax != null ? stepMax : 0.5) && f.y > best) best = f.y;
          }
        }
      }
      return best;
    },
    collide(x, z, rad, feetY, height) {
      let nx = x, nz = z;
      for (let iter = 0; iter < 2; iter++) {
        for (const c of this._cellsAround(nx, nz)) {
          for (const s of c.solids) {
            if (feetY + height < s.y0 + 0.05 || feetY > s.y1 - 0.05) continue;
            const clx = Math.max(s.x0, Math.min(nx, s.x1));
            const clz = Math.max(s.z0, Math.min(nz, s.z1));
            const dx = nx - clx, dz = nz - clz;
            const d2 = dx * dx + dz * dz;
            if (d2 < rad * rad) {
              const d = Math.sqrt(Math.max(d2, 1e-9));
              if (d > 1e-4) { nx = clx + dx / d * rad; nz = clz + dz / d * rad; }
              else {
                const pushL = nx - s.x0, pushR = s.x1 - nx, pushB = nz - s.z0, pushF = s.z1 - nz;
                const m = Math.min(pushL, pushR, pushB, pushF);
                if (m === pushL) nx = s.x0 - rad;
                else if (m === pushR) nx = s.x1 + rad;
                else if (m === pushB) nz = s.z0 - rad;
                else nz = s.z1 + rad;
              }
            }
          }
        }
      }
      return { x: nx, z: nz };
    }
  };
})();
