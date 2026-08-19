/* ==========================================================================
   RAFT SURVIVAL · island.js
   程序化岛屿（地形/棕榈树/岩石/灌木/水下矿脉） + 采集节点与重生
   ========================================================================== */
RS.Islands = function (game) {
  const U = RS.U, T = RS.Tex, DB = RS.DB;
  const self = this;
  const group = new THREE.Group();
  game.scene.add(group);
  this.group = group;

  const CELLSZ = 380;
  const loaded = new Map();     // key -> island
  this.list = [];
  const colliders = [];
  this.nodes = [];

  const M = {
    bark: new THREE.MeshStandardMaterial({ map: T.bark(1, 3), roughness: .95 }),
    leaf: new THREE.MeshStandardMaterial({ map: T.leaf(), transparent: true, alphaTest: .35, side: THREE.DoubleSide, roughness: .8 }),
    canopy: new THREE.MeshStandardMaterial({ color: 0x3e8f36, roughness: .9 }),
    rock: new THREE.MeshStandardMaterial({ map: T.rock(1, 1), roughness: .95 }),
    copper: new THREE.MeshStandardMaterial({ color: 0xd88a3a, roughness: .5, metalness: .5, emissive: 0x3a1c00 }),
    clay: new THREE.MeshStandardMaterial({ color: 0x8f6f4a, roughness: 1 }),
    sand: new THREE.MeshStandardMaterial({ map: T.sand(4, 4), roughness: 1 }),
    berry: new THREE.MeshStandardMaterial({ color: 0x2f7a34, roughness: .9 }),
    berryF: new THREE.MeshStandardMaterial({ color: 0xc02840, roughness: .6 }),
    vine: new THREE.MeshStandardMaterial({ color: 0x3f7a34, roughness: .9 }),
    seaweed: new THREE.MeshStandardMaterial({ color: 0x2a6b48, roughness: .9, side: THREE.DoubleSide, transparent: true, opacity: .92 }),
    plank: new THREE.MeshStandardMaterial({ map: T.plank(1, 1), roughness: .9 }),
    fruitO: new THREE.MeshStandardMaterial({ color: 0xf09a2a, roughness: .6 }),
    fruitY: new THREE.MeshStandardMaterial({ color: 0xe0c040, roughness: .7 }),
    fruitG: new THREE.MeshStandardMaterial({ color: 0x2f7f3a, roughness: .7 }),
    coco: new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: .9 }),
    grass: new THREE.MeshStandardMaterial({ map: grassTexture(), color: 0xffffff, side: THREE.DoubleSide, roughness: .9, transparent: true, alphaTest: .38 })
  };

  /* 草叶贴图（带 alpha 的几根草叶） */
  function grassTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    x.clearRect(0, 0, 64, 64);
    for (let i = 0; i < 8; i++) {
      const bx = 6 + Math.random() * 52;
      x.strokeStyle = 'hsl(' + (92 + Math.random() * 34) + ',' + (44 + Math.random() * 26) + '%,' + (28 + Math.random() * 24) + '%)';
      x.lineWidth = 3 + Math.random() * 3.5;
      x.lineCap = 'round';
      x.beginPath(); x.moveTo(bx, 64);
      x.quadraticCurveTo(bx + (Math.random() - .5) * 16, 34, bx + (Math.random() - .5) * 24, 4 + Math.random() * 16);
      x.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    if (THREE.sRGBEncoding !== undefined) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  /* --------------------------------------------------------- 岛屿定义 */
  function hash(a, b) { let h = (a * 73856093) ^ (b * 19349663); h = h >>> 0; return h; }
  function islandDef(cx, cz) {
    if (cx === 0 && cz === 0) {
      // 出生点附近保证有一座岛，方向随机
      const rng = U.Rng(12345);
      return { cx, cz, x: 210, z: 150, r: 34, h: 6.4, seed: 12345, rng };
    }
    const seed = hash(cx + 5000, cz + 5000);
    const rng = U.Rng(seed);
    if (rng.next() > .46) return null;
    return {
      cx, cz, seed, rng,
      x: cx * CELLSZ + rng.range(-90, 90),
      z: cz * CELLSZ + rng.range(-90, 90),
      r: rng.range(20, 46),
      h: rng.range(4.2, 9.5)
    };
  }

  function islandHeight(isl, x, z) {
    const dx = x - isl.x, dz = z - isl.z;
    const d = Math.hypot(dx, dz) / isl.r;
    if (d > 1.75) return -9;
    const fall = 1 - U.smooth(U.clamp((d - .22) / .95, 0, 1));
    const n = U.fbm(isl.noise, x * .028, z * .028, 4, 2.1, .5);
    const ridge = U.fbm(isl.noise, x * .012 + 40, z * .012 - 20, 2, 2, .5);
    let h = fall * isl.h * (.72 + ridge * .5) + n * 2.3 * fall - 1.15;
    return h;
  }
  this.islandHeight = islandHeight;

  /* --------------------------------------------------------- 地形网格 */
  function buildTerrain(isl) {
    const size = isl.r * 3.4;
    const seg = Math.round(U.clamp(isl.r * 1.9, 46, 92));
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    const colors = new Float32Array(p.count * 3);
    const cSand = new THREE.Color(0xe8d5a5), cGrass = new THREE.Color(0x69a844), cRock = new THREE.Color(0x8a8a86), cWet = new THREE.Color(0xb8a878);
    const tmp = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + isl.x, z = p.getZ(i) + isl.z;
      let h = islandHeight(isl, x, z);
      if (h < -9) h = -9;
      p.setY(i, h);
      // 颜色分层
      if (h < -.3) tmp.copy(cWet).lerp(cSand, U.clamp(h + 1.4, 0, 1) * .5);
      else if (h < 1.0) tmp.copy(cSand);
      else if (h < 2.4) tmp.copy(cSand).lerp(cGrass, U.smooth(U.clamp((h - 1.0) / 1.4, 0, 1)));
      else tmp.copy(cGrass).lerp(cRock, U.clamp((h - 3.4) / 4, 0, 1) * .75);
      tmp.offsetHSL(0, 0, U.rand(-.03, .03));
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ map: T.sand(Math.round(isl.r / 3), Math.round(isl.r / 3)), vertexColors: true, roughness: .95 });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(isl.x, 0, isl.z);
    m.receiveShadow = true; m.castShadow = false;
    m.userData = { type: 'terrain', island: isl };
    return m;
  }

  /* --------------------------------------------------------- 资源模型 */
  function palmTree(rng) {
    const g = new THREE.Group();
    const H = rng.range(5.5, 9);
    const segs = 6;
    let px = 0, pz = 0;
    const lean = rng.range(-.16, .16), leanZ = rng.range(-.16, .16);
    for (let k = 0; k < segs; k++) {
      const t = k / segs;
      const r = U.lerp(.26, .15, t);
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(r * .92, r, H / segs + .05, 8), M.bark);
      px += lean * (H / segs) * (t + .3); pz += leanZ * (H / segs) * (t + .3);
      seg.position.set(px, H * t + H / segs / 2, pz);
      seg.castShadow = true;
      g.add(seg);
    }
    const top = new THREE.Group();
    top.position.set(px, H, pz);
    const nl = 7;
    for (let k = 0; k < nl; k++) {
      const a = k / nl * U.TAU + rng.range(0, 1);
      const lf = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.5), M.leaf);
      lf.position.set(Math.cos(a) * 1.5, rng.range(-.15, .35), Math.sin(a) * 1.5);
      lf.rotation.y = -a;
      lf.rotation.z = -.36 + rng.range(-.12, .12);
      lf.castShadow = true;
      top.add(lf);
    }
    for (let k = 0; k < 3; k++) {
      const a = k / 3 * U.TAU;
      const co = new THREE.Mesh(new THREE.SphereGeometry(.19, 8, 6), M.coco);
      co.position.set(Math.cos(a) * .34, -.28, Math.sin(a) * .34);
      top.add(co);
    }
    g.add(top);
    g.userData.h = H;
    return { g, r: .5 };
  }
  function mangoTree(rng) {
    const g = new THREE.Group();
    const H = rng.range(4, 6);
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(.22, .32, H, 8), M.bark);
    tr.position.y = H / 2; tr.castShadow = true; g.add(tr);
    for (let k = 0; k < 4; k++) {
      const a = k / 4 * U.TAU;
      const b = new THREE.Mesh(new THREE.CylinderGeometry(.08, .12, 1.6, 6), M.bark);
      b.position.set(Math.cos(a) * .5, H - .5, Math.sin(a) * .5);
      b.rotation.z = Math.cos(a) * -.7; b.rotation.x = Math.sin(a) * .7;
      g.add(b);
    }
    for (let k = 0; k < 5; k++) {
      const cl = new THREE.Mesh(new THREE.SphereGeometry(rng.range(1.1, 1.7), 8, 6), M.canopy);
      cl.position.set(rng.range(-1.1, 1.1), H + rng.range(-.2, .8), rng.range(-1.1, 1.1));
      cl.castShadow = true;
      g.add(cl);
    }
    for (let k = 0; k < 4; k++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(.16, 7, 6), M.fruitO);
      f.scale.y = 1.3;
      f.position.set(rng.range(-1.4, 1.4), H + rng.range(-.6, .2), rng.range(-1.4, 1.4));
      g.add(f);
    }
    return { g, r: .45 };
  }
  function rockCluster(rng, scale) {
    const g = new THREE.Group();
    const n = rng.int(3, 6);
    let maxR = .5;
    for (let k = 0; k < n; k++) {
      const r = rng.range(.55, 1.5) * (scale || 1);
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), M.rock);
      m.position.set(rng.range(-1, 1) * scale, r * .35, rng.range(-1, 1) * scale);
      m.rotation.set(rng.range(0, 3), rng.range(0, 3), rng.range(0, 3));
      m.scale.y = rng.range(.6, 1);
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
      maxR = Math.max(maxR, r);
    }
    return { g, r: maxR * .9 };
  }
  function copperVein(rng) {
    const b = rockCluster(rng, .9);
    for (let k = 0; k < 7; k++) {
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(rng.range(.13, .28), 0), M.copper);
      c.position.set(rng.range(-1.1, 1.1), rng.range(.2, .9), rng.range(-1.1, 1.1));
      c.rotation.set(rng.range(0, 3), rng.range(0, 3), 0);
      b.g.add(c);
    }
    return b;
  }
  function berryBush(rng) {
    const g = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(rng.range(.4, .7), 7, 6), M.berry);
      m.position.set(rng.range(-.4, .4), rng.range(.3, .7), rng.range(-.4, .4));
      m.castShadow = true; g.add(m);
    }
    for (let k = 0; k < 8; k++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(.075, 6, 5), M.berryF);
      f.position.set(rng.range(-.6, .6), rng.range(.3, .9), rng.range(-.6, .6));
      g.add(f);
    }
    return { g, r: 0 };
  }
  function vinePlant(rng) {
    const g = new THREE.Group();
    for (let k = 0; k < 5; k++) {
      const h = rng.range(1.2, 2.6);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(.05, .04, h, 5), M.vine);
      m.position.set(rng.range(-.4, .4), h / 2, rng.range(-.4, .4));
      m.rotation.z = rng.range(-.4, .4);
      g.add(m);
      for (let j = 0; j < 3; j++) {
        const lf = new THREE.Mesh(new THREE.PlaneGeometry(.55, .3), M.grass);
        lf.position.set(m.position.x + rng.range(-.2, .2), h * (.3 + j * .25), m.position.z);
        lf.rotation.set(-.4, rng.range(0, 3), 0);
        g.add(lf);
      }
    }
    return { g, r: 0 };
  }
  function clayBank(rng) {
    const g = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(rng.range(.7, 1.3), 8, 5), M.clay);
      m.scale.y = .35;
      m.position.set(rng.range(-.7, .7), .1, rng.range(-.7, .7));
      m.receiveShadow = true; g.add(m);
    }
    return { g, r: 0 };
  }
  function sandPile(rng) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.ConeGeometry(rng.range(.7, 1.1), rng.range(.4, .8), 9), M.sand);
    m.position.y = .25; g.add(m);
    return { g, r: 0 };
  }
  function seaweedBed(rng) {
    const g = new THREE.Group();
    for (let k = 0; k < 9; k++) {
      const h = rng.range(1.2, 3);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(.34, h), M.seaweed);
      m.position.set(rng.range(-1, 1), h / 2, rng.range(-1, 1));
      m.rotation.y = rng.range(0, 3);
      m.userData.sway = rng.range(0, 6);
      g.add(m);
    }
    g.userData.sway = true;
    return { g, r: 0 };
  }
  function pineapplePlant(rng) {
    const g = new THREE.Group();
    for (let k = 0; k < 9; k++) {
      const a = k / 9 * U.TAU;
      const lf = new THREE.Mesh(new THREE.PlaneGeometry(.22, 1.1), M.grass);
      lf.position.set(Math.cos(a) * .2, .5, Math.sin(a) * .2);
      lf.rotation.set(.35, -a, Math.cos(a) * .3);
      g.add(lf);
    }
    const f = new THREE.Mesh(new THREE.CylinderGeometry(.22, .18, .5, 9), M.fruitY);
    f.position.y = .3; g.add(f);
    return { g, r: 0 };
  }
  function melonPatch(rng) {
    const g = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(rng.range(.3, .45), 9, 7), M.fruitG);
      m.scale.set(1, .8, 1.25);
      m.position.set(rng.range(-.8, .8), .3, rng.range(-.8, .8));
      m.castShadow = true; g.add(m);
    }
    for (let k = 0; k < 6; k++) {
      const lf = new THREE.Mesh(new THREE.PlaneGeometry(.5, .5), M.grass);
      lf.position.set(rng.range(-1.1, 1.1), .06, rng.range(-1.1, 1.1));
      lf.rotation.x = -Math.PI / 2 + .1; lf.rotation.z = rng.range(0, 3);
      g.add(lf);
    }
    return { g, r: 0 };
  }
  function wreckCrate(rng) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.1, .8, .9), M.plank);
    m.position.y = .4; m.rotation.y = rng.range(0, 3); m.castShadow = true; g.add(m);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.2, .1, 1.0), M.plank);
    lid.position.set(.3, .85, 0); lid.rotation.set(.2, m.rotation.y, .3); g.add(lid);
    return { g, r: .5 };
  }
  /* 草丛：整座岛合并成一个 BufferGeometry（原来每丛 4 个 Mesh，几百个 draw call） */
  function buildGrassField(isl, rng) {
    const verts = [], uvs = [], norms = [];
    const push = (x, y, z, u, v) => { verts.push(x, y, z); uvs.push(u, v); norms.push(0, 1, 0); };
    const N = Math.round(isl.r * 2.4);
    for (let k = 0; k < N; k++) {
      const a = rng.range(0, U.TAU), rr = Math.sqrt(rng.next()) * isl.r * 1.12;
      const x = isl.x + Math.cos(a) * rr, z = isl.z + Math.sin(a) * rr;
      const h = islandHeight(isl, x, z);
      if (h < 1.1) continue;
      for (let b = 0; b < 3; b++) {
        const ang = rng.range(0, Math.PI), w = rng.range(.24, .46), ht = rng.range(.38, .78);
        const dx = Math.cos(ang) * w, dz = Math.sin(ang) * w;
        push(x - dx, h, z - dz, 0, 0); push(x + dx, h, z + dz, 1, 0); push(x + dx, h + ht, z + dz, 1, 1);
        push(x - dx, h, z - dz, 0, 0); push(x + dx, h + ht, z + dz, 1, 1); push(x - dx, h + ht, z - dz, 0, 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, M.grass);
    m.receiveShadow = true;
    return m;
  }

  const BUILDERS = {
    palm: palmTree, mango_tree: mangoTree, rock: (r) => rockCluster(r, 1.1),
    copper_vein: copperVein, berry_bush: berryBush, vine: vinePlant,
    clay_bank: clayBank, sand_pile: sandPile, seaweed_bed: seaweedBed,
    pineapple_plant: pineapplePlant, watermelon_patch: melonPatch, wreck_crate: wreckCrate
  };

  /* --------------------------------------------------------- 岛屿装配 */
  function populate(isl) {
    const rng = U.Rng(isl.seed ^ 0x9e3779b9);
    const nodes = [];
    function tryPlace(type, count, minH, maxH, tag) {
      for (let k = 0; k < count * 6 && nodes.filter(n => n.type === type).length < count; k++) {
        const a = rng.range(0, U.TAU), rr = Math.sqrt(rng.next()) * isl.r * 1.32;
        const x = isl.x + Math.cos(a) * rr, z = isl.z + Math.sin(a) * rr;
        const h = islandHeight(isl, x, z);
        if (h < minH || h > maxH) continue;
        let tooClose = false;
        for (const n of nodes) if (Math.hypot(n.pos.x - x, n.pos.z - z) < (n.type === type ? 3.2 : 1.7)) { tooClose = true; break; }
        if (tooClose) continue;
        const b = BUILDERS[type](rng);
        b.g.position.set(x, h, z);
        b.g.rotation.y = rng.range(0, U.TAU);
        const def = DB.NODES[type];
        const node = {
          type, mesh: b.g, pos: b.g.position, hp: def.hits, max: def.hits,
          respawn: 0, island: isl, radius: b.r, tag: tag || null
        };
        b.g.userData = { type: 'node', node };
        b.g.traverse(o => { if (o !== b.g && !o.userData.type) o.userData.type = undefined; });
        group.add(b.g);
        nodes.push(node);
        if (b.r > 0) colliders.push({ x, z, r: b.r, node });
      }
    }
    tryPlace('palm', Math.round(isl.r / 5), .8, 20);
    tryPlace('rock', Math.round(isl.r / 7), 1.2, 20);
    tryPlace('mango_tree', Math.max(1, Math.round(isl.r / 18)), 1.6, 20);
    tryPlace('berry_bush', Math.round(isl.r / 9), 1.0, 20);
    tryPlace('vine', Math.round(isl.r / 12), 1.4, 20);
    tryPlace('pineapple_plant', Math.round(isl.r / 14), 1.2, 20);
    tryPlace('watermelon_patch', Math.max(1, Math.round(isl.r / 20)), 1.2, 20);
    tryPlace('clay_bank', Math.round(isl.r / 10), -1.2, .7);
    tryPlace('sand_pile', Math.round(isl.r / 11), -.4, 1.0);
    tryPlace('wreck_crate', Math.max(1, Math.round(isl.r / 22)), -.5, 3);
    tryPlace('seaweed_bed', Math.round(isl.r / 6), -6.5, -1.0);
    tryPlace('copper_vein', Math.max(2, Math.round(isl.r / 9)), -7.5, -1.2);

    // 装饰草丛（单个合并 mesh）
    const deco = buildGrassField(isl, rng);
    group.add(deco);
    isl.deco = deco;
    isl.nodes = nodes;
    self.nodes = self.nodes.concat(nodes);
  }

  function loadIsland(cx, cz) {
    const k = cx + ',' + cz;
    if (loaded.has(k)) return;
    const isl = islandDef(cx, cz);
    if (!isl) { loaded.set(k, null); return; }
    isl.noise = U.makeNoise2D(isl.seed);
    isl.terrain = buildTerrain(isl);
    group.add(isl.terrain);
    populate(isl);
    loaded.set(k, isl);
    self.list.push(isl);
  }
  function unloadIsland(isl) {
    const k = isl.cx + ',' + isl.cz;
    group.remove(isl.terrain);
    isl.terrain.geometry.dispose();
    group.remove(isl.deco);
    if (isl.deco.geometry) isl.deco.geometry.dispose();
    isl.nodes.forEach(n => {
      group.remove(n.mesh);
      n.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      const ci = colliders.findIndex(c => c.node === n);
      if (ci >= 0) colliders.splice(ci, 1);
      const ni = self.nodes.indexOf(n); if (ni >= 0) self.nodes.splice(ni, 1);
    });
    const li = self.list.indexOf(isl); if (li >= 0) self.list.splice(li, 1);
    loaded.delete(k);
  }

  /* --------------------------------------------------------- 查询 */
  this.heightAt = function (x, z) {
    let best = null;
    for (const isl of self.list) {
      const d = Math.hypot(x - isl.x, z - isl.z);
      if (d > isl.r * 1.72) continue;
      const h = islandHeight(isl, x, z);
      if (h > .06 && (best === null || h > best)) best = h;
    }
    return best;
  };
  this.seabedAt = function (x, z) {
    let best = null;
    for (const isl of self.list) {
      const d = Math.hypot(x - isl.x, z - isl.z);
      if (d > isl.r * 1.72) continue;
      const h = islandHeight(isl, x, z);
      if (best === null || h > best) best = h;
    }
    return best;
  };
  this.blocked = function (pos, radius) {
    for (const c of colliders) {
      if (c.node.hp <= 0) continue;
      const d = Math.hypot(pos.x - c.x, pos.z - c.z);
      if (d < c.r + radius) {
        const ny = self.heightAt(c.x, c.z);
        if (ny == null || pos.y < ny + 6) return true;
      }
    }
    return false;
  };
  this.nearest = function (p) {
    let best = null, bd = 1e9;
    for (const isl of self.list) {
      const d = Math.hypot(p.x - isl.x, p.z - isl.z) - isl.r;
      if (d < bd) { bd = d; best = isl; }
    }
    return best ? { island: best, dist: bd } : null;
  };

  /* --------------------------------------------------------- 采集 */
  this.hitNode = function (node, toolId, dmg) {
    if (!node || node.hp <= 0) return;
    const def = DB.NODES[node.type];
    const tool = toolId ? DB.item(toolId) : null;
    if (def.tool === 'axe' && (!tool || tool.tool !== 'axe' && tool.tool !== 'spear')) {
      game.ui.toast('需要斧头才能采集 ' + def.name, 'bad');
      RS.Audio.play('ui_deny');
      return;
    }
    const isTree = node.type === 'palm' || node.type === 'mango_tree';
    const isRock = node.type === 'rock' || node.type === 'copper_vein';
    node.hp -= Math.max(1, Math.round(dmg / 8));
    RS.Audio.play(isRock ? 'mine' : isTree ? 'chop' : 'step_sand');
    game.debris.spawnChips(node.pos.clone().add(new THREE.Vector3(0, isTree ? 1.4 : .5, 0)),
      isRock ? 0x8a8a86 : isTree ? 0xa9773d : 0x6a9a4a);
    game.ui.shakeCam(.12);
    // 摇晃反馈
    node.shake = .35;
    if (node.hp <= 0) {
      const give = (tbl) => { for (const k in tbl) { const r = tbl[k]; const n = U.randi(r[0], r[1]); if (n > 0) game.inv.add(k, n); } };
      give(def.loot);
      if (def.extra) give(def.extra);
      if (isTree) RS.Audio.play('treefall');
      else RS.Audio.play('pickup');
      node.mesh.visible = false;
      node.respawn = def.respawn;
      if (def.respawn < 0) {
        // 永久消失（沉船箱）
        const ci = colliders.findIndex(c => c.node === node);
        if (ci >= 0) colliders.splice(ci, 1);
      }
    }
  };

  /* --------------------------------------------------------- 更新 */
  let lastVisit = null;
  this.update = function (dt) {
    const p = game.raft.pos;
    const ccx = Math.round(p.x / CELLSZ), ccz = Math.round(p.z / CELLSZ);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) loadIsland(ccx + dx, ccz + dz);
    self.list.slice().forEach(isl => {
      if (Math.hypot(isl.x - p.x, isl.z - p.z) > CELLSZ * 1.75) unloadIsland(isl);
    });

    // 浅水信息给海洋着色器
    const near = self.list.slice().sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z)).slice(0, 4);
    game.world.setIslands(near.map(i => ({ x: i.x, z: i.z, r: i.r })));

    // 节点重生 / 摇晃动画
    for (const n of self.nodes) {
      if (n.hp <= 0 && n.respawn > 0) {
        n.respawn -= dt;
        if (n.respawn <= 0) {
          n.hp = n.max; n.mesh.visible = true;
          if (n.radius > 0 && !colliders.find(c => c.node === n)) colliders.push({ x: n.pos.x, z: n.pos.z, r: n.radius, node: n });
        }
      }
      if (n.shake > 0) {
        n.shake -= dt;
        n.mesh.rotation.z = Math.sin(game.time * 40) * n.shake * .06;
      } else if (n.mesh.rotation.z !== 0) n.mesh.rotation.z = 0;
      // 海草摆动
      if (n.type === 'seaweed_bed') {
        n.mesh.children.forEach((c, i) => { c.rotation.z = Math.sin(game.time * 1.2 + i) * .18; });
      }
      // 棕榈叶随风
      if (n.type === 'palm' && n.mesh.visible) {
        const top = n.mesh.children[n.mesh.children.length - 1];
        if (top) top.rotation.z = Math.sin(game.time * .8 + n.pos.x) * .035 * (1 + game.world.stormFactor * 3);
      }
    }

    // 抵达岛屿事件
    const nr = self.nearest(game.player.eye());
    if (nr && nr.dist < 4 && game.player.onIsland) {
      if (lastVisit !== nr.island) {
        lastVisit = nr.island;
        game.bus.emit('island_visit', nr.island);
        RS.Audio.play('island');
        game.ui.toast('🏝 你登上了一座岛屿', 'good');
      }
    }
  };

  this.serialize = function () {
    const out = [];
    self.list.forEach(isl => {
      isl.nodes.forEach((n, idx) => {
        if (n.hp < n.max) out.push([isl.cx, isl.cz, idx, n.hp, Math.round(n.respawn)]);
      });
    });
    return out;
  };
  this.deserialize = function (arr) {
    (arr || []).forEach(e => {
      const isl = loaded.get(e[0] + ',' + e[1]);
      if (!isl || !isl.nodes[e[2]]) return;
      const n = isl.nodes[e[2]];
      n.hp = e[3]; n.respawn = e[4];
      n.mesh.visible = n.hp > 0;
    });
  };
};
