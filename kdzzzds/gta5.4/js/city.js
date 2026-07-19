/* city.js — 城市生成:规则铺设路网/街区/人行道/路灯/红绿灯(③),
   地标建筑(AXIOM 塔 / 漩涡酒店 / PIER7 仓库 / OCTAN 加油站)为高精资产,
   其余建筑拟真低模;所有静态几何按材质合并,道具用 InstancedMesh */
window.G = window.G || {};
(function () {
  const U = G.U;
  const C = {};
  G.CITY = C;

  C.CELL = 64; C.NROAD = 8; C.OFF = -224;
  const RH = 6, SW = 3, CURB = 0.10;      // 路半宽 / 人行道宽 / 路缘高
  const ISL = { x0: -238, z0: -238, x1: 238, z1: 276 };   // 岛屿范围
  C.ISL = ISL;
  const ZONES = [
    ['res', 'res', 'shop', 'park', 'res', 'res', 'res'],
    ['res', 'shop', 'off', 'shop', 'shop', 'res', 'res'],
    ['shop', 'off', 'dt', 'dt', 'dt', 'off', 'res'],
    ['off', 'dt', 'AXIOM', 'plaza', 'HOTEL', 'dt', 'shop'],
    ['shop', 'dt', 'dt', 'dt', 'off', 'off', 'res'],
    ['GAS', 'shop', 'shop', 'shop', 'shop', 'res', 'res'],
    ['ind', 'ind', 'ind', 'ind', 'ind', 'ind', 'ind']
  ];
  C.ZONES = ZONES;
  const roadAt = i => C.OFF + i * C.CELL;
  C.roadAt = roadAt;
  C.blockCenter = (i, j) => [roadAt(i) + 32, roadAt(j) + 32];

  C.heightAt = function (x, z) {
    if (x < ISL.x0 || x > ISL.x1 || z < ISL.z0 || z > ISL.z1) return -1.2;
    if (z > 230) return 0;                       // 码头
    const u = ((x - C.OFF) % C.CELL + C.CELL) % C.CELL;
    const v = ((z - C.OFF) % C.CELL + C.CELL) % C.CELL;
    const du = Math.min(u, C.CELL - u), dv = Math.min(v, C.CELL - v);
    const d = Math.min(du, dv);
    if (x < -230 || x > 230 || z < -230) return 0.0;
    if (d <= RH + 0.15) return 0;
    if (d <= RH + 0.7) return U.lerp(0, CURB, (d - RH - 0.15) / 0.55);
    return CURB;
  };
  C.isWater = (x, z) => x < ISL.x0 || x > ISL.x1 || z < ISL.z0 || z > ISL.z1;

  /* ---------- 工具 ---------- */
  function planeUV(w, h, tu, tv, ry) {
    const g = new THREE.PlaneGeometry(w, h);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / tu), uv.getY(i) * (h / tv));
    g.rotateX(-Math.PI / 2);
    if (ry) g.rotateY(ry);
    return g;
  }
  function wallUV(w, h, tu, tv, voff) {
    const g = new THREE.PlaneGeometry(w, h);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / tu), uv.getY(i) * (h / tv) + (voff || 0));
    return g;
  }
  function roundedRectPath(x0, z0, x1, z1, r, y) {
    const p = [];
    const seg = 3;
    const cs = [[x1 - r, z1 - r, 0], [x0 + r, z1 - r, Math.PI / 2], [x0 + r, z0 + r, Math.PI], [x1 - r, z0 + r, Math.PI * 1.5]];
    for (const [cx, cz, a0] of cs)
      for (let k = 0; k <= seg; k++) {
        const a = a0 + k / seg * Math.PI / 2;
        p.push(new THREE.Vector3(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r));
      }
    return p;
  }

  /* ================= 构建 ================= */
  C.build = function (scene) {
    const t = G.TEX.t;
    const rng = U.rng(20260719);
    const group = new THREE.Group(); group.name = 'city';
    C.group = group;
    C.hash = new U.SpatialHash(16);
    C.emsMats = [];        // {mat, base}
    C.lampPos = [];
    C.trees = [];
    C.parkedDefs = [];
    C.markers = {};
    const std = (o) => new THREE.MeshStandardMaterial(o);
    const ems = (m, base) => { C.emsMats.push({ mat: m, base }); m.emissiveIntensity = 0; return m; };
    const dummy = new THREE.Object3D();

    /* ---------- 材质库 ---------- */
    const M = {
      road: std({ map: t.road.map, normalMap: t.road.nrm, roughnessMap: t.road.rgh, roughness: 1 }),
      inter: std({ map: t.inter.map, normalMap: t.inter.nrm, roughness: 0.96 }),
      side: std({ map: t.sidewalk.map, normalMap: t.sidewalk.nrm, roughness: 0.95 }),
      conc: std({ map: t.concrete.map, normalMap: t.concrete.nrm, roughness: 0.92 }),
      grass: std({ map: t.grass.map, roughness: 1 }),
      path: std({ map: t.path.map, roughness: 1 }),
      roof: std({ map: t.roof.map, roughness: 0.95 }),
      facRes: ems(std({ map: t.facRes.map, emissiveMap: t.facRes.ems, emissive: 0xffc98a, roughness: 0.9 }), 1.5),
      facRes2: ems(std({ map: t.facRes2.map, emissiveMap: t.facRes2.ems, emissive: 0xffc98a, roughness: 0.9 }), 1.5),
      facOff: ems(std({ map: t.facOff.map, emissiveMap: t.facOff.ems, emissive: 0xcfe0ff, roughness: 0.7 }), 1.35),
      facGlass: ems(std({ map: t.facGlass.map, emissiveMap: t.facGlass.ems, emissive: 0xd8e8ff, roughnessMap: t.facGlass.rgh, roughness: 1, metalness: 0.55 }), 1.4),
      facShop: ems(std({ map: t.facShop.map, emissiveMap: t.facShop.ems, emissive: 0xffffff, roughness: 0.8 }), 1.7),
      facShop2: ems(std({ map: t.facShop2.map, emissiveMap: t.facShop2.ems, emissive: 0xffffff, roughness: 0.8 }), 1.7),
      metal: std({ color: 0x777d84, roughness: 0.55, metalness: 0.8 }),
      metalDark: std({ color: 0x2c3034, roughness: 0.7, metalness: 0.6 }),
      wood: std({ color: 0x7a5c38, roughness: 0.9 }),
      hydrant: std({ color: 0xa32c22, roughness: 0.6, metalness: 0.3 }),
      bin: std({ color: 0x2f4438, roughness: 0.85 }),
      lampLens: ems(std({ color: 0xfff4d8, emissive: 0xffe8b0, roughness: 0.4 }), 3.4),
      pool: new THREE.MeshBasicMaterial({ map: t.flare.map, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd9a0 }),
      cross: std({ map: t.cross.map, transparent: true, alphaTest: 0.1, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2 }),
      manhole: std({ map: t.manhole.map, transparent: true, alphaTest: 0.4, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 })
    };
    for (let i = 0; i < 4; i++) M['cont' + i] = std({ map: t.cont[i].map, normalMap: t.cont[i].nrm, roughnessMap: t.cont[i].rgh, roughness: 1, metalness: 0.35 });
    for (let i = 0; i < 4; i++) M['sign' + i] = ems(std({ map: t.signs[i].map, emissiveMap: t.signs[i].ems, emissive: 0xffffff, roughness: 0.7 }), 2.6);
    for (let i = 0; i < 3; i++) M['bill' + i] = ems(std({ map: t.bill[i].map, emissiveMap: t.bill[i].map, emissive: 0xffffff, roughness: 0.85 }), 0.32);
    C.mats = M;

    /* ---------- 合并桶 ---------- */
    const buckets = new Map();
    function put(matName, geo) {
      if (!buckets.has(matName)) buckets.set(matName, []);
      buckets.get(matName).push(geo);
    }
    function col(x0, z0, x1, z1, y1, tag) { C.hash.add(x0, z0, x1, z1, 0, y1 == null ? 10 : y1, tag); }

    /* ---------- 道路 ---------- */
    for (let i = 0; i < C.NROAD; i++) {
      for (let k = 0; k < C.NROAD - 1; k++) {
        const g1 = planeUV(2 * RH, C.CELL - 2 * RH, 12, 12);
        g1.translate(roadAt(i), 0.001, roadAt(k) + C.CELL / 2);
        put('road', g1);
        const g2 = planeUV(2 * RH, C.CELL - 2 * RH, 12, 12, Math.PI / 2);
        g2.translate(roadAt(k) + C.CELL / 2, 0.001, roadAt(i));
        put('road', g2);
      }
      for (let j = 0; j < C.NROAD; j++) {
        const g = planeUV(2 * RH, 2 * RH, 6, 6);
        g.translate(roadAt(i), 0.001, roadAt(j));
        put('inter', g);
      }
    }
    /* 斑马线 + 井盖 */
    for (let i = 0; i < C.NROAD; i++) for (let j = 0; j < C.NROAD; j++) {
      const x = roadAt(i), z = roadAt(j);
      const dirs = [[0, -1, 0], [0, 1, 0], [-1, 0, Math.PI / 2], [1, 0, Math.PI / 2]];
      for (const [dx, dz, ry] of dirs) {
        if (i === 0 && dx < 0 || i === 7 && dx > 0 || j === 0 && dz < 0 || j === 7 && dz > 0) continue;
        const g = planeUV(11.4, 2.6, 11.4, 2.6, ry);
        g.translate(x + dx * 7.6, 0.012, z + dz * 7.6);
        put('cross', g);
      }
    }
    for (let k = 0; k < 70; k++) {
      const i = U.randi(rng, 0, 7), horiz = rng() < 0.5;
      const along = U.rand(rng, -215, 215), lat = U.pick(rng, [-3.2, -1.6, 1.6, 3.2]);
      const g = new THREE.CircleGeometry(0.5, 12);
      g.rotateX(-Math.PI / 2); g.rotateY(rng() * 6.28);
      if (horiz) g.translate(along, 0.013, roadAt(i) + lat);
      else g.translate(roadAt(i) + lat, 0.013, along);
      put('manhole', g);
    }

    /* ---------- 人行道 + 路缘 + 街区地面 ---------- */
    const curbProfile = [[0, 0], [0.12, 0], [0.15, 0.06], [0.15, CURB + 0.02], [0, CURB + 0.02]];
    for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
      const x0 = roadAt(i) + RH, z0 = roadAt(j) + RH;      // 含人行道的块 52×52
      const cx = x0 + 26, cz = z0 + 26;
      const zone = ZONES[j][i];
      /* 人行道环 */
      const ring = [
        [52, SW, cx, z0 + SW / 2], [52, SW, cx, z0 + 52 - SW / 2]
      ];
      for (const [w, d, px, pz] of ring) {
        const g = planeUV(w, d, 3, 3);
        g.translate(px, CURB + 0.001, pz);
        put('side', g);
      }
      for (const px of [x0 + SW / 2, x0 + 52 - SW / 2]) {
        const g = planeUV(SW, 46, 3, 3, Math.PI / 2);
        g.translate(px, CURB + 0.001, cz);
        put('side', g);
      }
      /* 路缘石(沿路径扫掠) */
      const path = roundedRectPath(x0 + 0.1, z0 + 0.1, x0 + 51.9, z0 + 51.9, 1.4, 0);
      const curbG = U.sweep(curbProfile, path, { closed: true, stepLen: 3 });
      put('conc', curbG);
      /* 内部地面 */
      const inner = planeUV(46, 46, zone === 'park' ? 5 : 8, zone === 'park' ? 5 : 8);
      inner.translate(cx, CURB + 0.002, cz);
      put(zone === 'park' ? 'grass' : (zone === 'plaza' ? 'side' : 'conc'), inner);
    }

    /* ---------- 街区内容 ---------- */
    const sighPositions = [];
    for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) {
      const zone = ZONES[j][i];
      const [cx, cz] = C.blockCenter(i, j);
      const brng = U.rng(9000 + j * 17 + i);
      if (zone === 'park') buildPark(cx, cz, brng);
      else if (zone === 'plaza') buildPlaza(cx, cz, brng);
      else if (zone === 'AXIOM') buildAxiom(cx, cz);
      else if (zone === 'HOTEL') buildHotel(cx, cz);
      else if (zone === 'GAS') buildGas(cx, cz, brng);
      else buildBlock(i, j, cx, cz, zone, brng);
    }

    /* ---------- 普通街区(低模) ---------- */
    function buildBlock(i, j, cx, cz, zone, brng) {
      const lots = [];
      const half = 21.5;
      if (zone === 'ind') {
        lots.push({ x: cx, z: cz, w: 40, d: 40 });
      } else {
        const split = brng() < 0.7;
        if (split) {
          for (const sx of [-1, 1]) for (const sz of [-1, 1])
            lots.push({ x: cx + sx * 11.2, z: cz + sz * 11.2, w: 20.5, d: 20.5 });
        } else {
          lots.push({ x: cx - 11.2, z: cz, w: 20.5, d: 43 });
          lots.push({ x: cx + 11.2, z: cz, w: 20.5, d: 43 });
        }
      }
      for (const lot of lots) {
        if (zone !== 'ind' && brng() < 0.12) { scatterLot(lot, brng); continue; }   // 空地/停车场
        let floors, fmat, tile, groundShop = false;
        if (zone === 'res') { floors = U.randi(brng, 3, 5); fmat = brng() < 0.5 ? 'facRes' : 'facRes2'; tile = [6, 3.2]; }
        else if (zone === 'shop') { floors = U.randi(brng, 2, 4); fmat = brng() < 0.5 ? 'facRes2' : 'facOff'; tile = fmat === 'facOff' ? [8, 3.5] : [6, 3.2]; groundShop = true; }
        else if (zone === 'off') { floors = U.randi(brng, 5, 9); fmat = 'facOff'; tile = [8, 3.5]; groundShop = brng() < 0.5; }
        else if (zone === 'dt') { floors = U.randi(brng, 8, 16); fmat = brng() < 0.6 ? 'facGlass' : 'facOff'; tile = fmat === 'facGlass' ? [8, 4] : [8, 3.5]; groundShop = brng() < 0.4; }
        else { floors = 0; }
        let h;
        if (zone === 'ind') {
          h = U.rand(brng, 9, 13);
          buildIndHall(lot, h, brng);
          continue;
        }
        const fh = zone === 'dt' && fmat === 'facGlass' ? 4 : 3.2;
        h = floors * fh + (groundShop ? 4 - fh : 0);
        const gh = groundShop ? 4 : 0;
        const w = lot.w, d = lot.d;
        for (const [nx, nz, ww] of [[0, 1, w], [0, -1, w], [1, 0, d], [-1, 0, d]]) {
          const wx = lot.x + nx * w / 2, wz = lot.z + nz * d / 2;
          if (gh > 0) {
            const g = wallUV(ww, gh, 16, 4);
            g.rotateY(Math.atan2(nx, nz));
            g.translate(wx, CURB + gh / 2, wz);
            put(brng() < 0.5 ? 'facShop' : 'facShop2', g);
          }
          const g2 = wallUV(ww, h - gh, tile[0], tile[1]);
          g2.rotateY(Math.atan2(nx, nz));
          g2.translate(wx, CURB + gh + (h - gh) / 2, wz);
          put(fmat, g2);
        }
        /* 屋顶 + 女儿墙 + 屋顶设备 */
        const rg = planeUV(w, d, 8, 8);
        rg.translate(lot.x, CURB + h, lot.z);
        put('roof', rg);
        for (const [px, pz, pw, pd] of [[0, d / 2, w + 0.3, 0.3], [0, -d / 2, w + 0.3, 0.3], [w / 2, 0, 0.3, d], [-w / 2, 0, 0.3, d]]) {
          const p = new THREE.BoxGeometry(pw, 0.7, pd);
          p.translate(lot.x + px, CURB + h + 0.35, lot.z + pz);
          put(fmat === 'facGlass' ? 'metalDark' : 'conc', p);
        }
        if (brng() < 0.7) {
          const ac = new THREE.BoxGeometry(1.6, 1.0, 1.2);
          ac.translate(lot.x + U.rand(brng, -w / 4, w / 4), CURB + h + 0.5, lot.z + U.rand(brng, -d / 4, d / 4));
          put('metal', ac);
        }
        if (brng() < 0.4) {
          const tank = new THREE.CylinderGeometry(1.1, 1.1, 2.2, 10);
          tank.translate(lot.x + U.rand(brng, -w / 4, w / 4), CURB + h + 1.4, lot.z + U.rand(brng, -d / 4, d / 4));
          put('wood', tank);
          const legs = new THREE.BoxGeometry(2.0, 0.5, 2.0);
          legs.translate(lot.x, CURB + h + 0.25, lot.z);
          put('metalDark', legs);
        }
        if (brng() < 0.25 && floors > 4) {
          const ant = new THREE.CylinderGeometry(0.05, 0.09, 5, 6);
          ant.translate(lot.x, CURB + h + 2.5, lot.z);
          put('metalDark', ant);
        }
        col(lot.x - w / 2, lot.z - d / 2, lot.x + w / 2, lot.z + d / 2, h + 1);
        /* 竖招牌 */
        if ((zone === 'shop' || zone === 'dt' || zone === 'off') && brng() < 0.75) {
          const side = U.pick(brng, [[0, 1], [0, -1], [1, 0], [-1, 0]]);
          const sx = lot.x + side[0] * (w / 2 + 0.65), sz = lot.z + side[1] * (d / 2 + 0.65);
          const sy = U.rand(brng, 5, Math.max(6, h - 4));
          const si = U.randi(brng, 0, 3);
          const face = new THREE.PlaneGeometry(1.15, 3.4);
          const face2 = face.clone();
          const ry = Math.atan2(side[0], side[1]) + Math.PI / 2;
          face.rotateY(ry); face2.rotateY(ry + Math.PI);
          face.translate(sx + 0.06 * side[1], CURB + sy, sz + 0.06 * side[0]);
          face2.translate(sx - 0.06 * side[1], CURB + sy, sz - 0.06 * side[0]);
          put('sign' + si, face); put('sign' + si, face2);
          const fr = new THREE.BoxGeometry(Math.abs(side[1]) * 1.25 + 0.1, 3.5, Math.abs(side[0]) * 1.25 + 0.1);
          fr.translate(sx, CURB + sy, sz);
          put('metalDark', fr);
          const br = new THREE.BoxGeometry(Math.abs(side[0]) * 0.7 + 0.08, 0.08, Math.abs(side[1]) * 0.7 + 0.08);
          br.translate(lot.x + side[0] * (w / 2 + 0.32), CURB + sy + 1.5, lot.z + side[1] * (d / 2 + 0.32));
          put('metalDark', br);
        }
        /* 屋顶广告牌(选 2 处) */
        if (sighPositions.length < 2 && zone === 'dt' && h > 40 && brng() < 0.5) {
          sighPositions.push(1);
          const bi = sighPositions.length % 3;
          const bg = new THREE.PlaneGeometry(14, 7);
          bg.rotateY(brng() < 0.5 ? 0 : Math.PI / 2);
          bg.translate(lot.x, CURB + h + 4.4, lot.z);
          put('bill' + bi, bg);
          for (const ox of [-5, 0, 5]) {
            const post = new THREE.BoxGeometry(0.18, 4.5, 0.18);
            post.translate(lot.x + ox, CURB + h + 2.2, lot.z);
            put('metalDark', post);
          }
        }
      }
    }
    function scatterLot(lot, brng) {
      /* 小停车场 + 杂物 */
      for (let k = 0; k < 3; k++) {
        if (brng() < 0.6) C.parkedDefs.push({ type: U.pick(brng, ['sedan', 'sedan', 'van']), x: lot.x + U.rand(brng, -6, 6), z: lot.z + U.rand(brng, -6, 6), heading: U.pick(brng, [0, Math.PI / 2]) });
      }
      const dump = new THREE.BoxGeometry(2.2, 1.3, 1.2);
      dump.translate(lot.x + 7, CURB + 0.65, lot.z + 7);
      put('bin', dump);
      col(lot.x + 5.9, lot.z + 6.4, lot.x + 8.1, lot.z + 7.6, 1.5);
    }
    function buildIndHall(lot, h, brng) {
      const w = lot.w, d = lot.d;
      for (const [nx, nz, ww] of [[0, 1, w], [0, -1, w], [1, 0, d], [-1, 0, d]]) {
        const g = wallUV(ww, h, 10, h);
        g.rotateY(Math.atan2(nx, nz));
        g.translate(lot.x + nx * w / 2, CURB + h / 2, lot.z + nz * d / 2);
        put('conc', g);
      }
      const rg = planeUV(w, d, 6, 6);
      rg.translate(lot.x, CURB + h, lot.z);
      put('roof', rg);
      /* 大门 + 高窗 */
      const door = new THREE.PlaneGeometry(6, 5);
      door.translate(lot.x, CURB + 2.5, lot.z - d / 2 - 0.02);
      door.rotateY(Math.PI);
      put('metalDark', door);
      for (let k = 0; k < 3; k++) {
        const vent = new THREE.CylinderGeometry(0.5, 0.6, 1.2, 8);
        vent.translate(lot.x - w / 4 + k * w / 4, CURB + h + 0.6, lot.z);
        put('metal', vent);
      }
      col(lot.x - w / 2, lot.z - d / 2, lot.x + w / 2, lot.z + d / 2, h);
    }

    /* ---------- 公园 ---------- */
    function buildPark(cx, cz, brng) {
      for (const ry of [0, Math.PI / 2]) {
        const g = planeUV(46, 3.4, 4, 3.4, ry);
        g.translate(cx, CURB + 0.005, cz);
        put('path', g);
      }
      for (let k = 0; k < 22; k++) {
        const a = U.rand(brng, 0, U.TAU), r = U.rand(brng, 5, 21);
        const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
        if (Math.abs(x - cx) < 2.6 || Math.abs(z - cz) < 2.6) continue;
        C.trees.push({ kind: brng() < 0.5 ? 'plane' : 'ginkgo', x, z, seed: (brng() * 1e9) | 0 });
      }
      for (let k = 0; k < 4; k++) benchAt(cx + [4.5, -4.5, 4.5, -4.5][k], cz + [4.5, 4.5, -4.5, -4.5][k], k * Math.PI / 2);
      C.markers.park = [cx, cz];
    }
    /* ---------- 中央广场 ---------- */
    function buildPlaza(cx, cz, brng) {
      /* 喷泉 */
      const basin = new THREE.LatheGeometry([[4.2, 0], [4.2, 0.55], [3.9, 0.6], [3.8, 0.25], [0.6, 0.2], [0.5, 1.1], [0.75, 1.15], [0.85, 0.7]].map(p => new THREE.Vector2(p[0], p[1])), 24);
      basin.translate(cx, CURB, cz);
      put('conc', basin);
      col(cx - 4.3, cz - 4.3, cx + 4.3, cz + 4.3, 1.2, 'round');
      C.fountain = { x: cx, y: CURB + 0.5, z: cz, r: 3.6 };
      for (let k = 0; k < 8; k++) {
        const a = k / 8 * U.TAU;
        benchAt(cx + Math.cos(a) * 9, cz + Math.sin(a) * 9, a + Math.PI / 2);
        C.trees.push({ kind: 'ginkgo', x: cx + Math.cos(a + 0.4) * 15, z: cz + Math.sin(a + 0.4) * 15, seed: 600 + k });
      }
      C.markers.plaza = [cx, cz];
      C.spawn = [cx + 2, cz + 12];
    }
    /* ---------- 地标:AXIOM 玻璃塔 ---------- */
    function buildAxiom(cx, cz) {
      const g2 = new THREE.Group();
      const W = 26, D = 26, H = 84;
      const podium = 34;
      for (const [nx, nz, ww] of [[0, 1, podium], [0, -1, podium], [1, 0, podium], [-1, 0, podium]]) {
        const g = wallUV(ww, 7, 8, 4);
        g.rotateY(Math.atan2(nx, nz));
        g.translate(cx + nx * podium / 2, CURB + 3.5, cz + nz * podium / 2);
        put('facGlass', g);
      }
      const prg = planeUV(podium, podium, 8, 8);
      prg.translate(cx, CURB + 7, cz);
      put('roof', prg);
      const tex = G.TEX.t;
      const twMat = ems(std({ map: tex.tower.map, emissiveMap: tex.tower.ems, emissive: 0xd8e8ff, roughnessMap: tex.tower.rgh, roughness: 1, metalness: 0.6 }), 1.5);
      for (const [nx, nz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const g = wallUV(W, H, W, H);
        g.rotateY(Math.atan2(nx, nz));
        g.translate(cx + nx * W / 2, CURB + 7 + H / 2, cz + nz * D / 2);
        const mesh = new THREE.Mesh(g, twMat);
        mesh.castShadow = mesh.receiveShadow = true;
        g2.add(mesh);
      }
      /* 竖向遮阳鳍片(高精细节) */
      const finG = [];
      for (let k = 0; k <= 8; k++) {
        const f = new THREE.BoxGeometry(0.28, H - 4, 0.8);
        f.translate(cx - W / 2 + k * W / 8, CURB + 7 + H / 2, cz + D / 2 + 0.45);
        finG.push(f);
      }
      put('metalDark', U.mergeGeos(finG));
      const roofT = planeUV(W, D, 8, 8);
      roofT.translate(cx, CURB + 7 + H, cz);
      put('roof', roofT);
      const mech = new THREE.BoxGeometry(10, 3, 8);
      mech.translate(cx, CURB + 7 + H + 1.5, cz);
      put('metalDark', mech);
      const mast = new THREE.CylinderGeometry(0.12, 0.3, 12, 8);
      mast.translate(cx, CURB + 7 + H + 3 + 6, cz);
      put('metalDark', mast);
      C.beacon = new THREE.Vector3(cx, CURB + 7 + H + 3 + 12, cz);
      /* 大堂招牌 */
      const logoM = ems(std({ map: tex.axiomLogo.map, emissiveMap: tex.axiomLogo.map, emissive: 0xffffff, roughness: 0.5 }), 0.9);
      const logo = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), logoM);
      logo.position.set(cx, CURB + 5.4, cz + podium / 2 + 0.06);
      g2.add(logo);
      /* 入口雨棚 */
      const can = new THREE.BoxGeometry(12, 0.3, 5);
      can.translate(cx, CURB + 4.2, cz + podium / 2 + 2.5);
      put('metalDark', can);
      for (const ox of [-5, 5]) {
        const c2 = new THREE.CylinderGeometry(0.12, 0.12, 4.2, 8);
        c2.translate(cx + ox, CURB + 2.1, cz + podium / 2 + 4.3);
        put('metal', c2);
        col(cx + ox - 0.2, cz + podium / 2 + 4.1, cx + ox + 0.2, cz + podium / 2 + 4.5, 4.4);
      }
      group.add(g2);
      col(cx - podium / 2, cz - podium / 2, cx + podium / 2, cz + podium / 2, 7 + H);
      C.markers.axiom = [cx, cz + podium / 2 + 8];
    }
    /* ---------- 地标:漩涡酒店 ---------- */
    function buildHotel(cx, cz) {
      const g2 = new THREE.Group();
      const tex = G.TEX.t;
      const W = 24, D = 18, H = 39;
      const front = ems(std({ map: tex.hotel.map, emissiveMap: tex.hotel.ems, emissive: 0xffd9a8, roughness: 0.85 }), 1.7);
      const sideM = ems(std({ map: tex.hotelSide.map, emissiveMap: tex.hotelSide.ems, emissive: 0xffc98a, roughness: 0.9 }), 1.5);
      const faces = [[0, 1, W, front], [0, -1, W, sideM], [1, 0, D, sideM], [-1, 0, D, sideM]];
      for (const [nx, nz, ww, mat] of faces) {
        const g = wallUV(ww, H, mat === front ? W : ww, mat === front ? H : H);
        g.rotateY(Math.atan2(nx, nz));
        g.translate(nx !== 0 ? cx + nx * W / 2 : cx, CURB + H / 2, nz !== 0 ? cz + nz * D / 2 : cz);
        const mesh = new THREE.Mesh(g, mat);
        mesh.castShadow = mesh.receiveShadow = true;
        g2.add(mesh);
      }
      const rg = planeUV(W, D, 8, 8);
      rg.translate(cx, CURB + H, cz);
      put('roof', rg);
      /* 阳台栏杆(前立面 3 列 × 11 层) */
      const rails = [];
      const fz = cz + D / 2;
      for (let f = 0; f < 11; f++) {
        const y = CURB + 5.3 + f * 3.09;
        for (let c2 = 1; c2 <= 3; c2++) {
          const bx = cx - W / 2 + W * 0.06 + (c2) * W * 0.184 + W * 0.064;
          const rail = new THREE.BoxGeometry(3.4, 0.06, 0.06);
          rail.translate(bx, y + 3.44 * 0 + 1.02, fz + 0.5);
          rails.push(rail);
          const rail2 = new THREE.BoxGeometry(3.4, 0.05, 0.05);
          rail2.translate(bx, y + 0.55, fz + 0.5);
          rails.push(rail2);
          const slab = new THREE.BoxGeometry(3.6, 0.14, 1.05);
          slab.translate(bx, y, fz + 0.42);
          rails.push(slab);
          for (let b = 0; b <= 6; b++) {
            const bar = new THREE.BoxGeometry(0.035, 1.0, 0.035);
            bar.translate(bx - 1.7 + b * (3.4 / 6), y + 0.52, fz + 0.5);
            rails.push(bar);
          }
        }
      }
      put('metalDark', U.mergeGeos(rails));
      /* 入口雨棚 + 金柱 */
      const can = new THREE.BoxGeometry(9, 0.35, 4.4);
      can.translate(cx, CURB + 4.4, fz + 2.2);
      put('metalDark', can);
      const gold = std({ color: 0xb89a55, roughness: 0.35, metalness: 0.85 });
      C.mats.gold = gold;
      for (const ox of [-3.6, 3.6]) {
        const c2 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 4.3, 10), gold);
        c2.position.set(cx + ox, CURB + 2.15, fz + 3.9);
        c2.castShadow = true;
        g2.add(c2);
        col(cx + ox - 0.25, fz + 3.65, cx + ox + 0.25, fz + 4.15, 4.5);
      }
      /* 屋顶霓虹 VORTEX */
      const neonM = new THREE.MeshStandardMaterial({ map: tex.neon.map, emissiveMap: tex.neon.ems, emissive: 0xffffff, transparent: true, alphaTest: 0.06, side: THREE.DoubleSide, roughness: 0.6 });
      C.neonMat = neonM;
      C.emsMats.push({ mat: neonM, base: 3.6, flicker: true });
      const neon = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), neonM);
      neon.position.set(cx, CURB + H + 4.6, cz);
      neon.rotation.y = 0;
      g2.add(neon);
      const neonB = neon.clone(); neonB.rotation.y = Math.PI;
      g2.add(neonB);
      const frame = [];
      for (const ox of [-6.5, 0, 6.5]) {
        const p = new THREE.BoxGeometry(0.16, 4.8, 0.16);
        p.translate(cx + ox, CURB + H + 1.6, cz);
        frame.push(p);
      }
      put('metalDark', U.mergeGeos(frame));
      /* 侧面消防梯(高精细节) */
      const fes = [];
      const fx = cx - W / 2 - 0.45;
      for (let f = 0; f < 9; f++) {
        const y = CURB + 5 + f * 3.4;
        const plat = new THREE.BoxGeometry(0.9, 0.08, 4.4);
        plat.translate(fx, y, cz);
        fes.push(plat);
        const lad = new THREE.BoxGeometry(0.06, 3.4, 0.5);
        lad.translate(fx, y + 1.7, cz - 1.4 + (f % 2) * 2.8);
        fes.push(lad);
        for (const rz of [-2.2, 2.2]) {
          const r2 = new THREE.BoxGeometry(0.05, 1.0, 0.05);
          r2.translate(fx - 0.4, y + 0.5, cz + rz);
          fes.push(r2);
        }
        const rr = new THREE.BoxGeometry(0.05, 0.05, 4.4);
        rr.translate(fx - 0.4, y + 1.0, cz);
        fes.push(rr);
      }
      put('metalDark', U.mergeGeos(fes));
      group.add(g2);
      col(cx - W / 2, cz - D / 2, cx + W / 2, cz + D / 2, H);
      C.markers.hotel = [cx, fz + 8];
      C.hotelFront = [cx, fz + 6];
    }
    /* ---------- 地标:OCTAN 加油站 ---------- */
    function buildGas(cx, cz, brng) {
      const tex = G.TEX.t;
      /* 铺装 */
      const pav = planeUV(40, 40, 8, 8);
      pav.translate(cx, CURB + 0.003, cz);
      put('conc', pav);
      /* 雨棚 */
      const canY = 5.6;
      const canopyM = ems(std({ map: tex.canopy.map, emissiveMap: tex.canopy.ems, emissive: 0xffffff, roughness: 0.6 }), 2.0);
      C.mats.canopy = canopyM;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(20, 0.5, 10), std({ color: 0xd8d5cc, roughness: 0.8 }));
      slab.position.set(cx, CURB + canY + 0.6, cz);
      slab.castShadow = true;
      group.add(slab);
      for (const [fw, fd, frot] of [[20, 0.9, 0], [20, 0.9, Math.PI]]) {
        const band = new THREE.Mesh(new THREE.PlaneGeometry(20, 1.1), canopyM);
        band.position.set(cx, CURB + canY + 0.55, cz + (frot === 0 ? 5.05 : -5.05));
        band.rotation.y = frot;
        group.add(band);
      }
      const under = new THREE.Mesh(planeUV(19.6, 9.6, 4, 4), ems(std({ color: 0xf4f2ea, emissive: 0xfff6e0, roughness: 0.6 }), 1.2));
      under.position.set(cx, CURB + canY + 0.34, cz);
      under.rotateX(Math.PI);
      group.add(under);
      for (const ox of [-7, 7]) for (const oz of [-3, 3]) {
        const c2 = new THREE.CylinderGeometry(0.22, 0.22, canY, 10);
        c2.translate(cx + ox, CURB + canY / 2, cz + oz);
        put('metal', c2);
        col(cx + ox - 0.3, cz + oz - 0.3, cx + ox + 0.3, cz + oz + 0.3, canY);
      }
      /* 油泵 ×4 */
      const pumpM = ems(std({ map: tex.pump.map, emissiveMap: tex.pump.ems, emissive: 0x9fff9f, roughness: 0.6 }), 1.8);
      for (let k = 0; k < 4; k++) {
        const px = cx - 6 + k * 4, pz = cz;
        const island = new THREE.BoxGeometry(2.4, 0.18, 1.4);
        island.translate(px, CURB + 0.09, pz);
        put('conc', island);
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.9, 0.6), pumpM);
        body.position.set(px, CURB + 1.13, pz);
        body.castShadow = true;
        group.add(body);
        const hose = U.sweep([[-0.025, 0], [0.025, 0], [0.025, 0.05], [-0.025, 0.05]],
          [U.v3(px + 0.5, CURB + 1.6, pz), U.v3(px + 0.75, CURB + 1.1, pz + 0.1), U.v3(px + 0.68, CURB + 0.72, pz)], { stepLen: 0.3 });
        put('metalDark', hose);
        col(px - 0.7, pz - 0.5, px + 0.7, pz + 0.5, 2.1);
      }
      /* 便利店 */
      const shop = { x: cx - 8, z: cz + 13.5, w: 14, d: 8 };
      for (const [nx, nz, ww] of [[0, 1, shop.w], [0, -1, shop.w], [1, 0, shop.d], [-1, 0, shop.d]]) {
        const g = wallUV(ww, 4, 16, 4);
        g.rotateY(Math.atan2(nx, nz));
        g.translate(shop.x + nx * shop.w / 2, CURB + 2, shop.z + nz * shop.d / 2);
        put(nz === -1 ? 'facShop' : 'conc', g);
      }
      const sr = planeUV(shop.w, shop.d, 8, 8);
      sr.translate(shop.x, CURB + 4, shop.z);
      put('roof', sr);
      col(shop.x - shop.w / 2, shop.z - shop.d / 2, shop.x + shop.w / 2, shop.z + shop.d / 2, 4.2);
      /* 价目招牌 */
      const signM = ems(std({ map: tex.gasSign.map, emissiveMap: tex.gasSign.ems, emissive: 0xffffff, roughness: 0.6 }), 2.2);
      const sign = new THREE.Mesh(new THREE.BoxGeometry(2.6, 5.2, 0.5), [std({ color: 0x20304a }), std({ color: 0x20304a }), std({ color: 0x20304a }), std({ color: 0x20304a }), signM, signM]);
      sign.position.set(cx + 14, CURB + 4.6, cz + 12);
      sign.castShadow = true;
      group.add(sign);
      const spole = new THREE.CylinderGeometry(0.18, 0.18, 2, 8);
      spole.translate(cx + 14, CURB + 1, cz + 12);
      put('metal', spole);
      col(cx + 13.6, cz + 11.7, cx + 14.4, cz + 12.3, 7.4);
      C.markers.gas = [cx, cz - 8];
    }
    /* ---------- 长椅 ---------- */
    function benchAt(x, z, ry) {
      const parts = [];
      for (let k = 0; k < 3; k++) {
        const slat = new THREE.BoxGeometry(1.6, 0.045, 0.11);
        slat.translate(0, 0.46, -0.12 + k * 0.13);
        parts.push({ g: slat, m: 'wood' });
      }
      for (let k = 0; k < 2; k++) {
        const slat = new THREE.BoxGeometry(1.6, 0.045, 0.11);
        U.applyT(slat, { p: [0, 0.72 + k * 0.14, 0.24], r: [-0.28, 0, 0] });
        parts.push({ g: slat, m: 'wood' });
      }
      for (const ox of [-0.7, 0.7]) {
        const leg = new THREE.BoxGeometry(0.07, 0.46, 0.5);
        leg.translate(ox, 0.23, 0);
        parts.push({ g: leg, m: 'metalDark' });
        const back = new THREE.BoxGeometry(0.06, 0.5, 0.06);
        U.applyT(back, { p: [ox, 0.7, 0.26], r: [-0.28, 0, 0] });
        parts.push({ g: back, m: 'metalDark' });
      }
      for (const p of parts) {
        U.applyT(p.g, { p: [0, 0, 0], r: [0, ry, 0] });
        p.g.translate(x, CURB, z);
        put(p.m, p.g);
      }
      col(x - 0.9, z - 0.4, x + 0.9, z + 0.4, 1.0);
    }

    /* ---------- 码头区(z 230..276) ---------- */
    (function harbor() {
      const tex = G.TEX.t;
      /* 码头地面 */
      const quay = planeUV(476, 46, 8, 8);
      quay.translate(0, 0.001, 253);
      put('conc', quay);
      /* PIER 7 仓库(地标) */
      const wx = 0, wz = 252, WW = 64, WD = 20, WH = 13;
      const whM = ems(std({ map: tex.wh.map, emissiveMap: tex.wh.ems, emissive: 0xffd9a0, roughness: 0.85, metalness: 0.25 }), 2.2);
      const g2 = new THREE.Group();
      for (const [nx, nz, ww] of [[0, 1, WW], [0, -1, WW], [1, 0, WD], [-1, 0, WD]]) {
        const g = wallUV(ww, WH, nx === 0 ? WW / 2 : WD, WH);
        g.rotateY(Math.atan2(nx, nz));
        g.translate(wx + nx * WW / 2, WH / 2, wz + nz * WD / 2);
        const mesh = new THREE.Mesh(g, whM);
        mesh.castShadow = mesh.receiveShadow = true;
        g2.add(mesh);
      }
      /* 山形屋顶 */
      const roofM = std({ map: tex.whRoof.map, roughness: 0.9, metalness: 0.3 });
      for (const s of [-1, 1]) {
        const rr = new THREE.Mesh(wallUV(WW + 1, 10.7, 16, 10), roofM);
        rr.position.set(wx, WH + 1.75, wz + s * 5);
        rr.rotation.x = s > 0 ? -(Math.PI / 2 - 0.34) : (Math.PI / 2 - 0.34);
        rr.castShadow = true;
        g2.add(rr);
      }
      /* 大门 + 立柱 + 屋顶通风 */
      for (const ox of [-18, 0, 18]) {
        const door = new THREE.Mesh(new THREE.PlaneGeometry(8, 8.6), std({ color: 0x3c464c, roughness: 0.8, metalness: 0.4 }));
        door.position.set(wx + ox, 4.3, wz + WD / 2 + 0.06);
        g2.add(door);
      }
      const pil = [];
      for (let k = 0; k <= 8; k++) {
        const p = new THREE.BoxGeometry(0.5, WH, 0.5);
        p.translate(wx - WW / 2 + k * WW / 8, WH / 2, wz + WD / 2 + 0.2);
        pil.push(p);
      }
      for (let k = 0; k < 4; k++) {
        const v = new THREE.CylinderGeometry(0.55, 0.65, 1.4, 8);
        v.translate(wx - 24 + k * 16, WH + 3.4 - k % 2, wz);
        pil.push(v);
      }
      put('metalDark', U.mergeGeos(pil));
      group.add(g2);
      col(wx - WW / 2, wz - WD / 2, wx + WW / 2, wz + WD / 2, WH + 5);
      C.markers.pier = [wx, wz + WD / 2 + 6];
      /* 集装箱堆场(InstancedMesh ×4 色) */
      const contGeo = new THREE.BoxGeometry(6.06, 2.6, 2.44);
      { const uv = contGeo.attributes.uv; for (let i2 = 0; i2 < uv.count; i2++) { uv.setXY(i2, uv.getX(i2), uv.getY(i2)); } }
      const stacks = [];
      const crng = U.rng(4242);
      for (let sx = -3; sx <= 3; sx++) for (let lay = 0; lay < 3; lay++) {
        if (crng() < 0.3) continue;
        const rot = crng() < 0.2 ? 0.06 : 0;
        stacks.push({ x: -160 + sx * 7 + U.rand(crng, -0.4, 0.4), z: 250 + (lay % 2) * 3.1, y: 1.3 + Math.floor(lay / 2) * 2.6, ry: rot, c: U.randi(crng, 0, 3) });
      }
      for (let sx = 0; sx < 6; sx++) for (let hh = 0; hh < 2; hh++) {
        if (crng() < 0.25) continue;
        stacks.push({ x: 120 + sx * 7, z: 246 + (sx % 2) * 3.2, y: 1.3 + hh * 2.6, ry: 0, c: U.randi(crng, 0, 3) });
      }
      const byColor = [[], [], [], []];
      stacks.forEach(s => byColor[s.c].push(s));
      const dummy = new THREE.Object3D();
      byColor.forEach((list, ci) => {
        if (!list.length) return;
        const im = new THREE.InstancedMesh(contGeo, M['cont' + ci], list.length);
        list.forEach((s, k) => {
          dummy.position.set(s.x, s.y, s.z);
          dummy.rotation.set(0, s.ry, 0);
          dummy.updateMatrix();
          im.setMatrixAt(k, dummy.matrix);
          if (s.y < 2) col(s.x - 3.1, s.z - 1.3, s.x + 3.1, s.z + 1.3, s.y + 1.3);
        });
        im.castShadow = im.receiveShadow = true;
        group.add(im);
      });
      /* 龙门吊(半高精) */
      (function crane() {
        const cx2 = 60, cz2 = 252;
        const cm = std({ color: 0xc4531f, roughness: 0.7, metalness: 0.5 });
        C.mats.crane = cm;
        const parts = [];
        for (const ox of [-14, 14]) for (const oz of [-6, 6]) {
          const leg = new THREE.BoxGeometry(1.0, 21, 1.0);
          leg.translate(cx2 + ox, 10.5, cz2 + oz);
          parts.push(leg);
          col(cx2 + ox - 0.6, cz2 + oz - 0.6, cx2 + ox + 0.6, cz2 + oz + 0.6, 21);
        }
        for (const ox of [-14, 14]) {
          const brace = new THREE.BoxGeometry(0.6, 0.6, 12.6);
          brace.translate(cx2 + ox, 15, cz2);
          parts.push(brace);
        }
        const beam = new THREE.BoxGeometry(31, 1.6, 2.2);
        beam.translate(cx2, 21.5, cz2 - 6);
        parts.push(beam);
        const beam2 = beam.clone(); beam2.translate(0, 0, 12);
        parts.push(beam2);
        const trolley = new THREE.BoxGeometry(2.4, 1.2, 13);
        trolley.translate(cx2 - 5, 20.4, cz2);
        parts.push(trolley);
        const cable = new THREE.CylinderGeometry(0.05, 0.05, 6, 6);
        cable.translate(cx2 - 5, 17, cz2);
        parts.push(cable);
        const spreader = new THREE.BoxGeometry(6.1, 0.5, 2.5);
        spreader.translate(cx2 - 5, 13.8, cz2);
        parts.push(spreader);
        const cab = new THREE.BoxGeometry(2.2, 2, 2.2);
        cab.translate(cx2 + 8, 19.4, cz2 - 4.5);
        parts.push(cab);
        const merged = U.mergeGeos(parts);
        const mesh = new THREE.Mesh(merged, cm);
        mesh.castShadow = true;
        group.add(mesh);
      })();
      /* 泛光灯塔(近景两座朝城市 + 远景两座) + 仓库壁灯 + PIER7 霓虹板 */
      const pnM = ems(std({ map: tex.pierNeon.map, emissiveMap: tex.pierNeon.ems, emissive: 0xffffff, roughness: 0.6 }), 3.2);
      const pneon = new THREE.Mesh(new THREE.PlaneGeometry(18, 4.5), pnM);
      pneon.position.set(wx, WH + 3.4, wz - WD / 2 - 0.4);
      pneon.rotation.y = Math.PI;
      group.add(pneon);
      const pframe = [];
      for (const ox of [-7.5, 0, 7.5]) {
        const p2 = new THREE.BoxGeometry(0.14, 4.2, 0.14);
        p2.translate(wx + ox, WH + 2.0, wz - WD / 2 - 0.3);
        pframe.push(p2);
      }
      put('metalDark', U.mergeGeos(pframe));
      for (const [mx, mz] of [[-150, 238], [120, 237], [-42, 234.5], [44, 234.5]]) {
        const pole = new THREE.CylinderGeometry(0.16, 0.26, 15, 10);
        pole.translate(mx, 7.5, mz);
        put('metal', pole);
        const bar = new THREE.BoxGeometry(3.4, 0.3, 0.4);
        bar.translate(mx, 14.7, mz);
        put('metalDark', bar);
        for (let k = 0; k < 4; k++) {
          const lens = new THREE.PlaneGeometry(0.62, 0.4);
          lens.rotateX(-Math.PI / 2 - 0.5);
          lens.translate(mx - 1.2 + k * 0.8, 14.35, mz + 0.25);
          put('lampLens', lens);
        }
        const pool = new THREE.PlaneGeometry(30, 30);
        pool.rotateX(-Math.PI / 2);
        pool.translate(mx, 0.04, mz + 3);
        group.add(new THREE.Mesh(pool, M.pool));
        col(mx - 0.35, mz - 0.35, mx + 0.35, mz + 0.35, 15, 'mast');
        C.lampPos.push(new THREE.Vector3(mx, 13.5, mz + 2));
      }
      for (const side of [1, -1]) for (const ox of [-24, -8, 8, 24]) {
        const lens = new THREE.PlaneGeometry(0.5, 0.32);
        lens.rotateX(-Math.PI / 2 - 0.9 * side);
        if (side < 0) lens.rotateY(Math.PI);
        lens.translate(wx + ox, 10.2, wz + side * (WD / 2 + 0.3));
        put('lampLens', lens);
        const pool = new THREE.PlaneGeometry(12, 9);
        pool.rotateX(-Math.PI / 2);
        pool.translate(wx + ox, 0.05, wz + side * (WD / 2 + 3.4));
        group.add(new THREE.Mesh(pool, M.pool));
      }
      /* 系船柱 + 码头边缘 */      const bolG = new THREE.LatheGeometry([[0.001, 0], [0.14, 0], [0.15, 0.28], [0.10, 0.34], [0.16, 0.44], [0.12, 0.5], [0.001, 0.52]].map(p => new THREE.Vector2(p[0], p[1])), 10);
      const bols = [];
      for (let x = -220; x <= 220; x += 18) bols.push([x, 274]);
      const bolIM = new THREE.InstancedMesh(bolG, M.metalDark, bols.length);
      bols.forEach((b, k) => { dummy.position.set(b[0], 0, b[1]); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); bolIM.setMatrixAt(k, dummy.matrix); });
      bolIM.castShadow = true;
      group.add(bolIM);
      const edge = new THREE.BoxGeometry(476, 1.7, 1.2);
      edge.translate(0, -0.55, 275.6);
      put('conc', edge);
      /* 棕榈树带 */
      for (let x = -200; x <= 220; x += 24) C.trees.push({ kind: 'palm', x: x + U.rand(crng, -3, 3), z: 235 + U.rand(crng, -1.5, 1.5), seed: (x + 999) | 0 });
    })();

    /* ---------- 海堤(岛缘) ---------- */
    (function seawall() {
      const walls = [
        [ISL.x0, ISL.z0, ISL.x1, ISL.z0 + 2],
        [ISL.x0, ISL.z0, ISL.x0 + 2, ISL.z1],
        [ISL.x1 - 2, ISL.z0, ISL.x1, ISL.z1]
      ];
      for (const [x0, z0, x1, z1] of walls) {
        const g = new THREE.BoxGeometry(x1 - x0, 2.2, z1 - z0);
        g.translate((x0 + x1) / 2, -0.9, (z0 + z1) / 2);
        put('conc', g);
      }
      /* 北/东/西 岛缘护栏(沿路径扫掠) */
      const railProfile = [[0, 0.42], [0.05, 0.40], [0.02, 0.34], [0.05, 0.27], [0.02, 0.21], [0, 0.19]];
      const railPaths = [
        [U.v3(ISL.x0 + 1, 0, ISL.z0 + 1), U.v3(ISL.x1 - 1, 0, ISL.z0 + 1)],
        [U.v3(ISL.x0 + 1, 0, ISL.z0 + 1), U.v3(ISL.x0 + 1, 0, 228)],
        [U.v3(ISL.x1 - 1, 0, ISL.z0 + 1), U.v3(ISL.x1 - 1, 0, 228)]
      ];
      for (const p of railPaths) {
        put('metal', U.sweep(railProfile, p, { stepLen: 6 }));
        const n = Math.floor(p[0].distanceTo(p[1]) / 4);
        const posts = [];
        for (let k = 0; k <= n; k++) {
          const pt = p[0].clone().lerp(p[1], k / n);
          const post = new THREE.BoxGeometry(0.08, 0.42, 0.08);
          post.translate(pt.x, 0.21, pt.z);
          posts.push(post);
        }
        put('metal', U.mergeGeos(posts));
        C.hash.add(Math.min(p[0].x, p[1].x) - 0.3, Math.min(p[0].z, p[1].z) - 0.3, Math.max(p[0].x, p[1].x) + 0.3, Math.max(p[0].z, p[1].z) + 0.3, 0, 1.0, 'rail');
      }
    })();

    /* ---------- 行道树 ---------- */
    for (let i = 0; i < C.NROAD; i++) for (let k = 0; k < 7; k++) {
      const along = roadAt(k) + 14 + (k % 2) * 18;
      if (rng() < 0.5) C.trees.push({ kind: 'plane', x: roadAt(i) + (i < 4 ? 7.6 : -7.6), z: along + U.rand(rng, -3, 3), seed: (i * 100 + k) | 0 });
      if (rng() < 0.5) C.trees.push({ kind: rng() < 0.7 ? 'plane' : 'ginkgo', x: along + U.rand(rng, -3, 3), z: roadAt(i) + (i < 4 ? 7.6 : -7.6), seed: (i * 131 + k * 7) | 0 });
    }

    /* ---------- 路灯(InstancedMesh) ---------- */
    (function lamps() {
      const poleG = [];
      const pole = new THREE.CylinderGeometry(0.05, 0.075, 5.4, 8);
      pole.translate(0, 2.7, 0);
      poleG.push(pole);
      const arm = U.sweep([[-0.035, -0.035], [0.035, -0.035], [0.035, 0.035], [-0.035, 0.035]],
        [U.v3(0, 5.3, 0), U.v3(0, 5.75, 0.7), U.v3(0, 5.8, 1.5)], { stepLen: 0.4 });
      poleG.push(arm);
      const head = new THREE.BoxGeometry(0.24, 0.12, 0.62);
      head.translate(0, 5.82, 1.7);
      poleG.push(head);
      const lampGeo = U.mergeGeos(poleG);
      const lensGeo = new THREE.PlaneGeometry(0.18, 0.5);
      lensGeo.rotateX(-Math.PI / 2 - Math.PI);
      lensGeo.translate(0, 5.75, 1.7);
      const poolGeo = new THREE.PlaneGeometry(9, 9);
      poolGeo.rotateX(-Math.PI / 2);
      const defs = [];
      for (let i = 0; i < C.NROAD; i++) for (let k = 0; k < 7; k++) {
        for (const [alt, side] of [[0, 1], [12, -1]]) {
          const along = roadAt(k) + 20 + alt + ((i * 13) % 8);
          defs.push({ x: roadAt(i) + side * 7.2, z: along, ry: side > 0 ? Math.PI : 0, rot: 'z' });
          defs.push({ x: along, z: roadAt(i) + side * 7.2, ry: side > 0 ? -Math.PI / 2 : Math.PI / 2, rot: 'x' });
        }
      }
      /* 码头灯 */
      for (let x = -200; x <= 220; x += 40) defs.push({ x, z: 268, ry: Math.PI });
      const im = new THREE.InstancedMesh(lampGeo, M.metalDark, defs.length);
      const imL = new THREE.InstancedMesh(lensGeo, M.lampLens, defs.length);
      const imP = new THREE.InstancedMesh(poolGeo, M.pool, defs.length);
      defs.forEach((d2, k) => {
        dummy.position.set(d2.x, CURB, d2.z);
        dummy.rotation.set(0, d2.ry, 0);
        dummy.updateMatrix();
        im.setMatrixAt(k, dummy.matrix);
        imL.setMatrixAt(k, dummy.matrix);
        const off = new THREE.Vector3(0, 0, 1.7).applyEuler(new THREE.Euler(0, d2.ry, 0));
        dummy.position.set(d2.x + off.x, 0.03, d2.z + off.z);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        imP.setMatrixAt(k, dummy.matrix);
        C.lampPos.push(new THREE.Vector3(d2.x + off.x, 5.6, d2.z + off.z));
        col(d2.x - 0.14, d2.z - 0.14, d2.x + 0.14, d2.z + 0.14, 5.4, 'lamp');
      });
      im.castShadow = true;
      group.add(im, imL, imP);
      C.poolMesh = imP;
    })();

    /* ---------- 红绿灯 ---------- */
    (function signals() {
      const metal = [];
      C.sigMats = {
        nsR: ems(std({ color: 0x391010, emissive: 0xff3020, roughness: 0.5 }), 0),
        nsY: ems(std({ color: 0x3a3010, emissive: 0xffc020, roughness: 0.5 }), 0),
        nsG: ems(std({ color: 0x103a18, emissive: 0x20e860, roughness: 0.5 }), 0),
        ewR: ems(std({ color: 0x391010, emissive: 0xff3020, roughness: 0.5 }), 0),
        ewY: ems(std({ color: 0x3a3010, emissive: 0xffc020, roughness: 0.5 }), 0),
        ewG: ems(std({ color: 0x103a18, emissive: 0x20e860, roughness: 0.5 }), 0)
      };
      C.emsMats = C.emsMats.filter(e => !Object.values(C.sigMats).includes(e.mat));  // 信号灯独立控制
      const lens = { nsR: [], nsY: [], nsG: [], ewR: [], ewY: [], ewG: [] };
      for (let i = 2; i <= 5; i++) for (let j = 2; j <= 5; j++) {
        const x = roadAt(i), z = roadAt(j);
        for (const [cxs, czs, facing] of [[1, 1, 'ns'], [-1, -1, 'ns'], [1, -1, 'ew'], [-1, 1, 'ew']]) {
          const px = x + cxs * 6.8, pz = z + czs * 6.8;
          const pole = new THREE.CylinderGeometry(0.06, 0.08, 4.6, 8);
          pole.translate(px, CURB + 2.3, pz);
          metal.push(pole);
          const ry = facing === 'ns' ? (czs > 0 ? Math.PI : 0) : (cxs > 0 ? Math.PI / 2 : -Math.PI / 2);
          const armDir = new THREE.Vector3(facing === 'ew' ? -cxs : 0, 0, facing === 'ns' ? -czs : 0);
          const arm = new THREE.CylinderGeometry(0.045, 0.05, 3.4, 6);
          U.applyT(arm, { p: [0, 0, 0], r: [facing === 'ns' ? Math.PI / 2 * -czs : 0, 0, facing === 'ew' ? Math.PI / 2 * cxs : 0] });
          arm.translate(px + armDir.x * 1.7, CURB + 4.45, pz + armDir.z * 1.7);
          metal.push(arm);
          const hx = px + armDir.x * 3.2, hz = pz + armDir.z * 3.2;
          const headB = new THREE.BoxGeometry(0.34, 1.0, 0.34);
          headB.translate(hx, CURB + 4.0, hz);
          metal.push(headB);
          const cols2 = facing === 'ns' ? ['nsR', 'nsY', 'nsG'] : ['ewR', 'ewY', 'ewG'];
          cols2.forEach((cn, k) => {
            const l2 = new THREE.CircleGeometry(0.11, 10);
            l2.rotateY(ry + Math.PI);
            const fo = new THREE.Vector3(0, 0, 0.18).applyEuler(new THREE.Euler(0, ry + Math.PI, 0));
            l2.translate(hx + fo.x, CURB + 4.3 - k * 0.3, hz + fo.z);
            lens[cn].push(l2);
          });
          col(px - 0.15, pz - 0.15, px + 0.15, pz + 0.15, 4.6, 'pole');
        }
      }
      put('metalDark', U.mergeGeos(metal));
      for (const key of Object.keys(lens)) {
        if (!lens[key].length) continue;
        const mesh = new THREE.Mesh(U.mergeGeos(lens[key]), C.sigMats[key]);
        group.add(mesh);
      }
      C.signalT = 0;
    })();

    /* ---------- 消防栓 / 垃圾桶 ---------- */
    (function props() {
      const hydG = new THREE.LatheGeometry([[0.001, 0], [0.10, 0], [0.115, 0.05], [0.10, 0.30], [0.065, 0.36], [0.08, 0.43], [0.05, 0.5], [0.001, 0.54]].map(p => new THREE.Vector2(p[0], p[1])), 10);
      const hyds = [];
      for (let k = 0; k < 22; k++) {
        const i = U.randi(rng, 0, 6), j = U.randi(rng, 0, 6);
        const [cx, cz] = C.blockCenter(i, j);
        const a = U.rand(rng, 0, U.TAU);
        hyds.push([cx + (Math.abs(Math.cos(a)) > 0.5 ? Math.sign(Math.cos(a)) * 24.5 : U.rand(rng, -20, 20)), cz + (Math.abs(Math.cos(a)) > 0.5 ? U.rand(rng, -20, 20) : Math.sign(Math.sin(a)) * 24.5)]);
      }
      const him = new THREE.InstancedMesh(hydG, M.hydrant, hyds.length);
      hyds.forEach((h, k) => { dummy.position.set(h[0], CURB, h[1]); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); him.setMatrixAt(k, dummy.matrix); col(h[0] - 0.16, h[1] - 0.16, h[0] + 0.16, h[1] + 0.16, 0.6, 'hyd'); });
      him.castShadow = true;
      group.add(him);
      const binG = new THREE.CylinderGeometry(0.30, 0.26, 0.78, 10);
      const bins = [];
      for (let k = 0; k < 30; k++) {
        const i = U.randi(rng, 0, 7), j = U.randi(rng, 0, 6);
        bins.push([roadAt(i) + U.pick(rng, [-7.6, 7.6]), roadAt(j) + U.rand(rng, 12, 52)]);
      }
      const bim = new THREE.InstancedMesh(binG, M.bin, bins.length);
      bins.forEach((b, k) => { dummy.position.set(b[0], CURB + 0.39, b[1]); dummy.updateMatrix(); bim.setMatrixAt(k, dummy.matrix); col(b[0] - 0.33, b[1] - 0.33, b[0] + 0.33, b[1] + 0.33, 1.0, 'bin'); });
      bim.castShadow = true;
      group.add(bim);
    })();

    /* ---------- 停车位车辆定义 ---------- */
    for (let k = 0; k < 14; k++) {
      const i = U.randi(rng, 0, 7), j = U.randi(rng, 0, 6);
      const horiz = rng() < 0.5;
      const along = roadAt(j) + U.rand(rng, 12, 52);
      const side = U.pick(rng, [-4.8, 4.8]);
      const type = U.pick(rng, ['sedan', 'sedan', 'sedan', 'sports', 'van', 'taxi']);
      if (horiz) C.parkedDefs.push({ type, x: along, z: roadAt(i) + side, heading: side > 0 ? -Math.PI / 2 : Math.PI / 2 });
      else C.parkedDefs.push({ type, x: roadAt(i) + side, z: along, heading: side > 0 ? Math.PI : 0 });
    }
    /* 玩家初始座驾(广场旁) */
    C.parkedDefs.push({ type: 'sedan', x: roadAt(3) + 4.8, z: roadAt(3) + 26, heading: Math.PI, hero: true, color: 0x27436e });

    /* ---------- 树木实例化 ---------- */
    G.TREE.init();
    for (const td of C.trees) {
      const tr = G.TREE.build(td.kind, td.seed);
      tr.group.position.set(td.x, C.heightAt(td.x, td.z), td.z);
      group.add(tr.group);
      col(td.x - 0.3, td.z - 0.3, td.x + 0.3, td.z + 0.3, 2.5, 'tree');
    }

    /* ---------- 合并桶 → 网格 ---------- */
    for (const [name, list] of buckets) {
      const merged = U.mergeGeos(list);
      const mesh = new THREE.Mesh(merged, M[name]);
      mesh.castShadow = !['road', 'inter', 'side', 'cross', 'manhole', 'grass', 'path', 'pool'].includes(name);
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    scene.add(group);

    /* ---------- 信号灯控制 ---------- */
    C.updateSignals = function (dt) {
      C.signalT = (C.signalT + dt) % 20;
      const t2 = C.signalT;
      const S = C.sigMats;
      const set = (m, on) => { m.emissiveIntensity = on ? 2.2 : 0.0; };
      set(S.nsG, t2 < 8); set(S.nsY, t2 >= 8 && t2 < 10); set(S.nsR, t2 >= 10);
      set(S.ewG, t2 >= 10 && t2 < 18); set(S.ewY, t2 >= 18); set(S.ewR, t2 < 10);
    };
    /* ---------- 夜晚强度 ---------- */
    C.setNight = function (n, time) {
      for (const e of C.emsMats) {
        let v = e.base * n;
        if (e.flicker) v *= (0.82 + 0.18 * Math.sin(time * 13.7) * Math.sin(time * 7.3) + (Math.sin(time * 31) > 0.965 ? -0.5 : 0));
        e.mat.emissiveIntensity = v;
      }
      M.pool.opacity = 0.42 * n;
    };
    return group;
  };

  /* ---------- 路网图(GPS/交通) ---------- */
  C.nodeId = (i, j) => j * C.NROAD + i;
  C.nodePos = (i, j) => new THREE.Vector2(roadAt(i), roadAt(j));
  C.route = function (fromX, fromZ, toX, toZ) {
    const ni = x => U.clamp(Math.round((x - C.OFF) / C.CELL), 0, 7);
    const s = [ni(fromX), ni(fromZ)], e = [ni(toX), ni(toZ)];
    const prev = new Map();
    const q = [s]; prev.set(s[0] + ',' + s[1], null);
    while (q.length) {
      const cur = q.shift();
      if (cur[0] === e[0] && cur[1] === e[1]) break;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cur[0] + dx, nz = cur[1] + dz;
        if (nx < 0 || nx > 7 || nz < 0 || nz > 7) continue;
        const key = nx + ',' + nz;
        if (prev.has(key)) continue;
        prev.set(key, cur);
        q.push([nx, nz]);
      }
    }
    const pts = [];
    let cur = e;
    while (cur) { pts.unshift([roadAt(cur[0]), roadAt(cur[1])]); cur = prev.get(cur[0] + ',' + cur[1]); }
    pts.push([toX, toZ]);
    pts.unshift([fromX, fromZ]);
    return pts;
  };
})();
