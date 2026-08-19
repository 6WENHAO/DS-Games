/* ==========================================================================
   RAFT SURVIVAL · raft.js
   木筏网格 / 建造与拆除 / 结构耐久 / 机械设施（净水器·烤架·收集网·帆·舵·锚…）
   ========================================================================== */
RS.Raft = function (game) {
  const U = RS.U, T = RS.Tex, DB = RS.DB;
  const self = this;
  const CELL = 2.0;          // 一格地基 2m
  const TOP = 0.14;          // 地基表面局部高度
  const UPPER = 2.55;        // 上层地板表面高度

  const root = new THREE.Group();
  game.scene.add(root);
  this.root = root;
  this.CELL = CELL;
  this.pos = new THREE.Vector3(0, 0, 0);
  this.yaw = 0;
  this.vel = new THREE.Vector3();
  this.sailUp = false;
  this.anchorDown = false;
  this.steer = 0;            // -1..1 玩家转向输入
  this.desiredYaw = null;

  const cells = new Map();
  this.cells = cells;
  const stations = [];       // 所有带 station 的对象
  this.stations = stations;

  /* --------------------------------------------------------------- 材质库 */
  const M = {
    plank: new THREE.MeshStandardMaterial({ map: T.plank(1, 1), roughness: .82, metalness: 0 }),
    plankD: new THREE.MeshStandardMaterial({ map: T.plankDark(1, 1), roughness: .88 }),
    plankL: new THREE.MeshStandardMaterial({ map: T.plankLight(1, 1), roughness: .8 }),
    thatch: new THREE.MeshStandardMaterial({ map: T.thatch(2, 2), roughness: .95 }),
    sail: new THREE.MeshStandardMaterial({ map: T.sail(1, 1), roughness: .9, side: THREE.DoubleSide }),
    metal: new THREE.MeshStandardMaterial({ map: T.metal(1, 1), roughness: .45, metalness: .8 }),
    rope: new THREE.MeshStandardMaterial({ color: 0xc9a86a, roughness: 1 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xbfe9f5, roughness: .1, metalness: .1, transparent: true, opacity: .38 }),
    water: new THREE.MeshStandardMaterial({ color: 0x53c8e0, roughness: .2, transparent: true, opacity: .8 }),
    soil: new THREE.MeshStandardMaterial({ color: 0x5a4530, roughness: 1 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x4f9d3a, roughness: .9 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: .9 }),
    ember: new THREE.MeshBasicMaterial({ color: 0xff7d2a }),
    lampGlass: new THREE.MeshBasicMaterial({ color: 0xffd98a })
  };
  this.M = M;

  function mesh(geo, mat, x, y, z) {
    const m = new THREE.Mesh(geo, mat);
    if (x !== undefined) m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (r1, r2, h, s) => new THREE.CylinderGeometry(r1, r2, h, s || 10);

  /* ---------------------------------------------------------------- 网格 */
  const key = (i, j) => i + ',' + j;
  function get(i, j) { return cells.get(key(i, j)); }
  this.get = get;
  function ensure(i, j) {
    let c = cells.get(key(i, j));
    if (!c) { c = { i, j, base: null, edges: [null, null, null, null], roof: null, obj: null, upper: null }; cells.set(key(i, j), c); }
    return c;
  }
  this.countFoundations = function () { let n = 0; cells.forEach(c => { if (c.base) n++; }); return n; };
  this.forEachCell = function (f) { cells.forEach(f); };

  /* 边方向：0=-Z(北) 1=+X(东) 2=+Z(南) 3=-X(西) */
  const EDGE_OFF = [[0, -1], [1, 0], [0, 1], [-1, 0]];

  /* ------------------------------------------------------------ 地基网格构建 */
  function buildFoundation(c, armored) {
    const g = new THREE.Group();
    const slab = mesh(box(CELL, .22, CELL), armored ? M.metal : M.plank, 0, 0, 0);
    g.add(slab);
    // 底部横梁
    g.add(mesh(box(CELL * .96, .16, .22), M.plankD, 0, -.19, -.55));
    g.add(mesh(box(CELL * .96, .16, .22), M.plankD, 0, -.19, .55));
    g.add(mesh(box(.22, .16, CELL * .96), M.plankD, -.55, -.19, 0));
    g.add(mesh(box(.22, .16, CELL * .96), M.plankD, .55, -.19, 0));
    if (armored) {
      [[-.7, -.7], [.7, -.7], [-.7, .7], [.7, .7]].forEach(p => {
        const b = mesh(cyl(.055, .055, .18, 6), M.metal, p[0], .12, p[1]); g.add(b);
      });
    }
    g.position.set(c.i * CELL, 0, c.j * CELL);
    g.userData = { type: 'base', cell: c };
    return g;
  }
  /* 外缘浮桶 + 护木（只在没有邻居的边） */
  function refreshTrim(c) {
    if (!c.base) return;
    if (c.trim) { root.remove(c.trim); disposeTree(c.trim); }
    const g = new THREE.Group();
    let any = false;
    for (let d = 0; d < 4; d++) {
      const n = get(c.i + EDGE_OFF[d][0], c.j + EDGE_OFF[d][1]);
      if (n && n.base) continue;
      any = true;
      const log = mesh(cyl(.1, .1, CELL, 8), M.plankD);
      log.rotation.z = Math.PI / 2;
      if (d === 0) log.position.set(0, .13, -CELL / 2);
      if (d === 2) log.position.set(0, .13, CELL / 2);
      if (d === 1) { log.position.set(CELL / 2, .13, 0); log.rotation.y = Math.PI / 2; }
      if (d === 3) { log.position.set(-CELL / 2, .13, 0); log.rotation.y = Math.PI / 2; }
      g.add(log);
      // 浮桶
      const bar = mesh(cyl(.26, .26, .7, 10), new THREE.MeshStandardMaterial({ map: T.barrel(1, 1), roughness: .55 }));
      bar.rotation.z = Math.PI / 2;
      const o = EDGE_OFF[d];
      bar.position.set(o[0] * (CELL / 2 - .1), -.28, o[1] * (CELL / 2 - .1));
      if (Math.abs(o[1]) > 0) bar.rotation.y = Math.PI / 2;
      g.add(bar);
    }
    if (!any) { c.trim = null; return; }
    g.position.set(c.i * CELL, 0, c.j * CELL);
    c.trim = g; root.add(g);
  }
  function refreshTrimAround(i, j) {
    refreshTrim(ensure(i, j));
    for (let d = 0; d < 4; d++) { const c = get(i + EDGE_OFF[d][0], j + EDGE_OFF[d][1]); if (c) refreshTrim(c); }
  }

  function buildEdge(c, d, id) {
    const def = DB.BUILD_MAP[id];
    const g = new THREE.Group();
    const h = def.half ? 1.0 : 2.3;
    if (id === 'wall_window') {
      g.add(mesh(box(CELL, .5, .14), M.plank, 0, .25, 0));
      g.add(mesh(box(CELL, .5, .14), M.plank, 0, 2.05, 0));
      g.add(mesh(box(.16, 1.35, .14), M.plank, -CELL / 2 + .08, 1.17, 0));
      g.add(mesh(box(.16, 1.35, .14), M.plank, CELL / 2 - .08, 1.17, 0));
      g.add(mesh(box(CELL - .3, 1.3, .05), M.glass, 0, 1.17, 0));
    } else if (def.half) {
      g.add(mesh(box(CELL, .12, .14), M.plankL, 0, 1.0, 0));
      g.add(mesh(box(CELL, .1, .12), M.plankL, 0, .6, 0));
      g.add(mesh(box(.14, 1.0, .14), M.plank, -CELL / 2 + .07, .5, 0));
      g.add(mesh(box(.14, 1.0, .14), M.plank, CELL / 2 - .07, .5, 0));
    } else {
      for (let k = 0; k < 5; k++) g.add(mesh(box(CELL, .44, .13), k % 2 ? M.plankL : M.plank, 0, .24 + k * .46, 0));
      g.add(mesh(box(.16, h, .17), M.plankD, -CELL / 2 + .08, h / 2, 0));
      g.add(mesh(box(.16, h, .17), M.plankD, CELL / 2 - .08, h / 2, 0));
    }
    // 摆到格子边
    const o = EDGE_OFF[d];
    g.position.set(c.i * CELL + o[0] * CELL / 2, TOP, c.j * CELL + o[1] * CELL / 2);
    g.rotation.y = (d === 1 || d === 3) ? Math.PI / 2 : 0;
    g.userData = { type: 'edge', cell: c, dir: d };
    return g;
  }

  function buildRoof(c) {
    const g = new THREE.Group();
    const p = mesh(box(CELL + .1, .1, CELL + .1), M.thatch, 0, 0, 0);
    g.add(p);
    // 茅草层次
    for (let k = 0; k < 3; k++) {
      const s = mesh(box(CELL + .16 - k * .06, .07, CELL * .3), M.thatch, 0, .06 + k * .05, -CELL / 2 + .3 + k * .55);
      s.rotation.x = -.06; g.add(s);
    }
    g.add(mesh(cyl(.07, .07, CELL + .2, 6), M.plankD, 0, -.08, 0).rotateZ(Math.PI / 2));
    g.position.set(c.i * CELL, 2.42, c.j * CELL);
    g.rotation.x = -.05;
    g.userData = { type: 'roof', cell: c };
    return g;
  }
  function buildUpper(c) {
    const g = new THREE.Group();
    g.add(mesh(box(CELL, .18, CELL), M.plankL, 0, 0, 0));
    g.add(mesh(box(CELL, .1, .16), M.plankD, 0, -.13, -CELL / 2 + .1));
    g.add(mesh(box(CELL, .1, .16), M.plankD, 0, -.13, CELL / 2 - .1));
    g.position.set(c.i * CELL, UPPER, c.j * CELL);
    g.userData = { type: 'upper', cell: c };
    return g;
  }

  /* ------------------------------------------------------- 家具/机械 建模 */
  function buildObject(c, id) {
    const g = new THREE.Group();
    const st = {};
    switch (id) {
      case 'pillar': {
        g.add(mesh(box(.19, 2.4, .19), M.plankD, 0, 1.2, 0));
        g.add(mesh(box(.3, .1, .3), M.plank, 0, .05, 0));
        g.add(mesh(box(.3, .1, .3), M.plank, 0, 2.36, 0));
        break;
      }
      case 'simple_purifier': {
        g.add(mesh(box(.85, .18, .85), M.plankD, 0, .09, 0));
        [[-.34, -.34], [.34, -.34], [-.34, .34], [.34, .34]].forEach(p => g.add(mesh(box(.1, .55, .1), M.plank, p[0], .45, p[1])));
        g.add(mesh(box(.8, .12, .8), M.plank, 0, .78, 0));
        const pot = mesh(cyl(.26, .22, .34, 12), M.metal, 0, .98, 0); g.add(pot);
        const cone = mesh(cyl(.05, .3, .3, 12), M.glass, 0, 1.3, 0); g.add(cone);
        g.add(mesh(cyl(.03, .03, .34, 6), M.metal, .28, 1.05, 0).rotateZ(-.5));
        st.cup = mesh(cyl(.09, .07, .16, 8), M.plankL, .42, .88, 0); g.add(st.cup); st.cup.visible = false;
        st.fire = mesh(box(.4, .14, .4), M.ember, 0, .3, 0); st.fire.visible = false; g.add(st.fire);
        st.light = new THREE.PointLight(0xff7a2a, 0, 4); st.light.position.set(0, .4, 0); g.add(st.light);
        break;
      }
      case 'simple_grill': {
        [[-.3, -.3], [.3, -.3], [-.3, .3], [.3, .3]].forEach(p => g.add(mesh(cyl(.05, .05, .55, 6), M.plankD, p[0], .27, p[1])));
        g.add(mesh(box(.85, .1, .85), M.plankD, 0, .55, 0));
        const pan = mesh(cyl(.36, .3, .16, 14), M.metal, 0, .68, 0); g.add(pan);
        for (let k = -2; k <= 2; k++) g.add(mesh(box(.66, .035, .035), M.metal, 0, .8, k * .12));
        st.stones = new THREE.Group();
        for (let k = 0; k < 6; k++) {
          const s = mesh(new THREE.DodecahedronGeometry(.07, 0), new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 1 }),
            Math.cos(k) * .2, .64, Math.sin(k) * .2);
          st.stones.add(s);
        }
        g.add(st.stones);
        st.fire = new THREE.Group();
        for (let k = 0; k < 5; k++) {
          const f = mesh(cyl(.001, .05, .18, 5), M.ember, U.rand(-.15, .15), .72, U.rand(-.15, .15));
          st.fire.add(f);
        }
        st.fire.visible = false; g.add(st.fire);
        st.light = new THREE.PointLight(0xff7020, 0, 6); st.light.position.set(0, .9, 0); g.add(st.light);
        st.food = new THREE.Group(); st.food.position.y = .84; g.add(st.food);
        break;
      }
      case 'collection_net': {
        g.add(mesh(box(.18, 1.7, .18), M.plankD, -.75, .85, 0));
        g.add(mesh(box(.18, 1.7, .18), M.plankD, .75, .85, 0));
        g.add(mesh(box(1.7, .14, .14), M.plank, 0, 1.66, 0));
        for (let k = 0; k <= 8; k++) g.add(mesh(box(.03, 1.35, .03), M.rope, -.72 + k * .18, .82, 0));
        for (let k = 0; k <= 6; k++) g.add(mesh(box(1.46, .03, .03), M.rope, 0, .2 + k * .22, 0));
        st.bag = mesh(cyl(.34, .12, .45, 10), M.rope, 0, .34, .3); g.add(st.bag);
        break;
      }
      case 'water_collector': {
        g.add(mesh(cyl(.42, .34, .7, 12), M.plankD, 0, .35, 0));
        for (let k = 0; k < 3; k++) g.add(mesh(cyl(.44, .44, .05, 14), M.metal, 0, .12 + k * .26, 0));
        const funnel = mesh(cyl(.62, .12, .34, 14, 1), M.thatch, 0, .9, 0); g.add(funnel);
        st.water = mesh(cyl(.33, .33, .5, 12), M.water, 0, .3, 0); st.water.scale.y = .02; g.add(st.water);
        break;
      }
      case 'storage_box': {
        g.add(mesh(box(1.0, .55, .72), M.plank, 0, .28, 0));
        st.lid = new THREE.Group();
        const lid = mesh(box(1.04, .12, .76), M.plankL, 0, .06, 0); st.lid.add(lid);
        st.lid.position.set(0, .55, -.36); g.add(st.lid);
        g.add(mesh(box(1.02, .07, .07), M.rope, 0, .3, -.36));
        g.add(mesh(box(1.02, .07, .07), M.rope, 0, .3, .36));
        break;
      }
      case 'research_table': {
        [[-.45, -.28], [.45, -.28], [-.45, .28], [.45, .28]].forEach(p => g.add(mesh(box(.1, .8, .1), M.plankD, p[0], .4, p[1])));
        g.add(mesh(box(1.15, .1, .8), M.plankL, 0, .82, 0));
        const brd = mesh(box(1.05, .55, .06), M.plank, 0, 1.05, -.3); brd.rotation.x = -.32; g.add(brd);
        g.add(mesh(cyl(.13, .13, .03, 14), M.glass, .3, .92, .1));
        g.add(mesh(cyl(.02, .02, .3, 6), M.plankD, .3, .96, .28).rotateX(1.2));
        st.sample = new THREE.Group(); st.sample.position.set(-.3, .92, .05); g.add(st.sample);
        break;
      }
      case 'sail': {
        g.add(mesh(cyl(.14, .11, 5.2, 10), M.plankD, 0, 2.6, 0));
        g.add(mesh(box(.5, .12, .5), M.plank, 0, .06, 0));
        const boomT = mesh(cyl(.07, .07, 2.6, 8), M.plankD, 0, 4.4, 0); boomT.rotation.z = Math.PI / 2; g.add(boomT);
        const boomB = mesh(cyl(.07, .07, 2.6, 8), M.plankD, 0, 1.6, 0); boomB.rotation.z = Math.PI / 2; g.add(boomB);
        const sg = new THREE.PlaneGeometry(2.5, 2.75, 10, 6);
        const sp = sg.attributes.position;
        for (let k = 0; k < sp.count; k++) {
          const x = sp.getX(k);
          sp.setZ(k, Math.cos(x / 1.25 * Math.PI / 2) * .45);
        }
        sg.computeVertexNormals();
        st.cloth = new THREE.Mesh(sg, M.sail);
        st.cloth.castShadow = true;
        st.cloth.position.set(0, 3.0, 0);
        g.add(st.cloth);
        st.cloth.scale.y = .04; st.cloth.visible = true;
        st.rope = mesh(box(.04, 1.4, .04), M.rope, .45, 1.0, .2); g.add(st.rope);
        break;
      }
      case 'steering_wheel': {
        g.add(mesh(box(.36, 1.0, .36), M.plankD, 0, .5, 0));
        g.add(mesh(box(.6, .12, .6), M.plank, 0, .05, 0));
        st.wheel = new THREE.Group();
        st.wheel.add(mesh(new THREE.TorusGeometry(.38, .05, 8, 20), M.plankL));
        for (let k = 0; k < 8; k++) {
          const s = mesh(box(.06, .74, .06), M.plankD);
          s.rotation.z = k * Math.PI / 8; st.wheel.add(s);
        }
        st.wheel.add(mesh(cyl(.08, .08, .16, 10), M.metal).rotateX(Math.PI / 2));
        st.wheel.position.set(0, 1.15, .1);
        g.add(st.wheel);
        break;
      }
      case 'anchor': {
        g.add(mesh(box(.5, 1.1, .5), M.plankD, 0, .55, 0));
        g.add(mesh(new THREE.TorusGeometry(.2, .05, 8, 16), M.metal, 0, 1.2, 0).rotateY(Math.PI / 2));
        st.anchor = new THREE.Group();
        st.anchor.add(mesh(box(.1, .8, .1), M.metal, 0, -.4, 0));
        st.anchor.add(mesh(box(.7, .1, .1), M.metal, 0, -.15, 0));
        const arc = mesh(new THREE.TorusGeometry(.32, .06, 8, 16, Math.PI), M.metal, 0, -.78, 0);
        arc.rotation.z = Math.PI; st.anchor.add(arc);
        st.chain = new THREE.Group();
        for (let k = 0; k < 6; k++) st.chain.add(mesh(new THREE.TorusGeometry(.055, .018, 6, 10), M.metal, 0, -k * .1, 0).rotateX(k % 2 ? 0 : Math.PI / 2));
        st.anchor.add(st.chain);
        st.anchor.position.set(0, 1.05, .3);
        g.add(st.anchor);
        break;
      }
      case 'crop_plot': {
        g.add(mesh(box(1.1, .1, 1.1), M.plankD, 0, .05, 0));
        [[0, -.5], [0, .5]].forEach(p => g.add(mesh(box(1.1, .28, .1), M.plank, p[0], .22, p[1])));
        [[-.5, 0], [.5, 0]].forEach(p => g.add(mesh(box(.1, .28, 1.1), M.plank, p[0], .22, p[1])));
        g.add(mesh(box(.94, .18, .94), M.soil, 0, .18, 0));
        st.plant = new THREE.Group(); st.plant.position.y = .26; g.add(st.plant);
        break;
      }
      case 'bed': {
        g.add(mesh(box(.16, 1.5, .16), M.plankD, -.9, .75, 0));
        g.add(mesh(box(.16, 1.5, .16), M.plankD, .9, .75, 0));
        const hg = new THREE.PlaneGeometry(1.7, .85, 10, 4);
        const hp = hg.attributes.position;
        for (let k = 0; k < hp.count; k++) {
          const x = hp.getX(k);
          hp.setZ(k, -.22 * Math.cos(x / .85 * Math.PI / 2));
        }
        hg.computeVertexNormals();
        const ham = new THREE.Mesh(hg, new THREE.MeshStandardMaterial({ map: T.sail(1, 1), color: 0xdfe8ea, side: THREE.DoubleSide, roughness: .9 }));
        ham.rotation.x = -Math.PI / 2; ham.position.y = 1.05; ham.castShadow = true;
        g.add(ham);
        g.add(mesh(box(.4, .16, .5), new THREE.MeshStandardMaterial({ color: 0xe8d9b8, roughness: 1 }), -.5, 1.14, 0));
        break;
      }
      case 'lamp': {
        g.add(mesh(box(.14, 1.6, .14), M.plankD, 0, .8, 0));
        g.add(mesh(box(.34, .1, .34), M.plank, 0, .05, 0));
        g.add(mesh(cyl(.02, .02, .34, 6), M.metal, .16, 1.6, 0).rotateZ(-1));
        st.glass = mesh(cyl(.13, .16, .28, 10), M.lampGlass, .32, 1.5, 0); g.add(st.glass);
        g.add(mesh(cyl(.17, .1, .1, 10), M.metal, .32, 1.68, 0));
        st.light = new THREE.PointLight(0xffc266, 0, 9); st.light.position.set(.32, 1.5, 0); g.add(st.light);
        break;
      }
      case 'shark_trophy': {
        g.add(mesh(box(.9, .5, .1), M.plankD, 0, .9, 0));
        const head = mesh(cyl(.02, .3, .8, 8), new THREE.MeshStandardMaterial({ color: 0x7d93a3, roughness: .7 }), 0, .95, .3);
        head.rotation.x = Math.PI / 2; g.add(head);
        for (let k = 0; k < 10; k++) {
          const a = k / 10 * Math.PI * 2;
          g.add(mesh(cyl(.001, .03, .1, 4), new THREE.MeshStandardMaterial({ color: 0xf5f0e0 }), Math.cos(a) * .2, .95 + Math.sin(a) * .2, .68).rotateX(-Math.PI / 2));
        }
        break;
      }
    }
    g.position.set(c.i * CELL, TOP, c.j * CELL);
    g.userData = { type: 'object', cell: c, id };
    g.userData.st = st;
    return g;
  }

  function disposeTree(o) {
    o.traverse(n => {
      if (n.geometry) n.geometry.dispose();
      if (n.isPointLight) n.intensity = 0;
    });
  }

  /* ---------------------------------------------------------------- 放置 */
  this.canPlace = function (id, i, j, dir) {
    const def = DB.BUILD_MAP[id]; if (!def) return { ok: false, why: '未知建筑' };
    if (def.lock && !game.unlocked[def.lock]) return { ok: false, why: '需要研究：' + (DB.RESEARCH_MAP[def.lock] ? DB.RESEARCH_MAP[def.lock].name : def.lock) };
    const c = get(i, j);
    if (def.kind === 'base') {
      if (c && c.base) return { ok: false, why: '这里已经有地基' };
      // 必须与已有地基相邻
      let adj = false;
      for (let d = 0; d < 4; d++) { const n = get(i + EDGE_OFF[d][0], j + EDGE_OFF[d][1]); if (n && n.base) adj = true; }
      if (!adj && cells.size > 0 && self.countFoundations() > 0) return { ok: false, why: '地基必须与木筏相连' };
      return { ok: true };
    }
    if (!c || !c.base) return { ok: false, why: '必须建在地基上' };
    if (def.kind === 'edge') {
      if (dir == null) return { ok: false, why: '没有可用的边' };
      if (c.edges[dir]) return { ok: false, why: '这条边已经有墙了' };
      return { ok: true };
    }
    if (def.kind === 'roof') { if (c.roof) return { ok: false, why: '已经有屋顶' }; return { ok: true }; }
    if (def.kind === 'upper') { if (c.upper) return { ok: false, why: '已经有上层地板' }; return { ok: true }; }
    if (c.obj) return { ok: false, why: '这格已经有东西了' };
    return { ok: true };
  };

  this.place = function (id, i, j, dir, free) {
    const def = DB.BUILD_MAP[id];
    const chk = self.canPlace(id, i, j, dir);
    if (!chk.ok) return chk;
    if (!free && !game.inv.canAfford(def.cost)) return { ok: false, why: '材料不足' };
    if (!free) game.inv.pay(def.cost);
    const c = ensure(i, j);
    if (def.kind === 'base') {
      const m = buildFoundation(c, id === 'foundation_armored');
      root.add(m);
      c.base = { id, mesh: m, hp: def.hp, maxHp: def.hp };
      refreshTrimAround(i, j);
    } else if (def.kind === 'edge') {
      const m = buildEdge(c, dir, id); root.add(m);
      c.edges[dir] = { id, mesh: m };
    } else if (def.kind === 'roof') {
      const m = buildRoof(c); root.add(m); c.roof = { id, mesh: m };
    } else if (def.kind === 'upper') {
      const m = buildUpper(c); root.add(m); c.upper = { id, mesh: m };
    } else {
      const m = buildObject(c, id); root.add(m);
      const o = { id, mesh: m, st: m.userData.st, cell: c, station: def.station || null, data: {} };
      c.obj = o;
      initStation(o);
      if (o.station) stations.push(o);
      if (o.station === 'bed') game.spawnBed = o;
    }
    game.bus.emit('built', id);
    RS.Audio.play(def.kind === 'base' ? 'hammer' : 'place');
    return { ok: true };
  };

  this.removeAt = function (c, what, dir) {
    const refund = (id) => {
      const def = DB.BUILD_MAP[id];
      if (!def) return;
      for (const k in def.cost) game.inv.add(k, Math.max(1, Math.floor(def.cost[k] * .6)));
    };
    if (what === 'edge' && c.edges[dir]) { refund(c.edges[dir].id); root.remove(c.edges[dir].mesh); disposeTree(c.edges[dir].mesh); c.edges[dir] = null; }
    else if (what === 'roof' && c.roof) { refund(c.roof.id); root.remove(c.roof.mesh); disposeTree(c.roof.mesh); c.roof = null; }
    else if (what === 'upper' && c.upper) { refund(c.upper.id); root.remove(c.upper.mesh); disposeTree(c.upper.mesh); c.upper = null; }
    else if (what === 'object' && c.obj) {
      refund(c.obj.id);
      if (c.obj.station === 'storage' && c.obj.data.items) c.obj.data.items.forEach(s => { if (s) game.inv.add(s.id, s.n); });
      const idx = stations.indexOf(c.obj); if (idx >= 0) stations.splice(idx, 1);
      if (game.spawnBed === c.obj) game.spawnBed = null;
      root.remove(c.obj.mesh); disposeTree(c.obj.mesh); c.obj = null;
    }
    else if (what === 'base' && c.base) {
      if (c.obj) self.removeAt(c, 'object');
      if (c.roof) self.removeAt(c, 'roof');
      if (c.upper) self.removeAt(c, 'upper');
      for (let d = 0; d < 4; d++) if (c.edges[d]) self.removeAt(c, 'edge', d);
      refund(c.base.id);
      root.remove(c.base.mesh); disposeTree(c.base.mesh); c.base = null;
      if (c.trim) { root.remove(c.trim); disposeTree(c.trim); c.trim = null; }
      refreshTrimAround(c.i, c.j);
    }
    RS.Audio.play('remove');
  };

  /* 鲨鱼咬地基 */
  this.damageCell = function (c, dmg) {
    if (!c || !c.base) return false;
    c.base.hp -= dmg;
    if (!c.base.crack) {
      const g = new THREE.Group();
      for (let k = 0; k < 5; k++) {
        const p = mesh(box(U.rand(.1, .5), .03, .05), M.dark, U.rand(-.7, .7), .12, U.rand(-.7, .7));
        p.rotation.y = U.rand(0, 3); g.add(p);
      }
      g.visible = false; c.base.mesh.add(g); c.base.crack = g;
    }
    c.base.crack.visible = c.base.hp < c.base.maxHp * .8;
    if (c.base.hp <= 0) {
      // 地基被咬穿：掉落一些木板
      game.debris.spawnWreck(self.cellWorld(c));
      self.removeAt(c, 'base');
      game.ui.toast('💥 一块地基被咬碎了！', 'bad');
      return true;
    }
    return false;
  };
  this.repairCell = function (c, amt) {
    if (!c || !c.base || c.base.hp >= c.base.maxHp) return false;
    c.base.hp = Math.min(c.base.maxHp, c.base.hp + amt);
    if (c.base.crack) c.base.crack.visible = c.base.hp < c.base.maxHp * .8;
    return true;
  };

  this.cellWorld = function (c) {
    return root.localToWorld(new THREE.Vector3(c.i * CELL, TOP, c.j * CELL));
  };
  this.worldToCellIdx = function (v) {
    const l = root.worldToLocal(v.clone());
    return { i: Math.round(l.x / CELL), j: Math.round(l.z / CELL), lx: l.x, lz: l.z, ly: l.y };
  };
  /* 由局部偏移判断朝哪条边 */
  this.edgeFromLocal = function (lx, lz, i, j) {
    const dx = lx - i * CELL, dz = lz - j * CELL;
    if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? 1 : 3;
    return dz > 0 ? 2 : 0;
  };

  /* 玩家站立面 */
  this.surfaceAt = function (wp) {
    const l = root.worldToLocal(wp.clone());
    const i = Math.round(l.x / CELL), j = Math.round(l.z / CELL);
    if (Math.abs(l.x - i * CELL) > CELL / 2 || Math.abs(l.z - j * CELL) > CELL / 2) return null;
    const c = get(i, j);
    if (!c || !c.base) return null;
    const low = root.localToWorld(new THREE.Vector3(l.x, TOP, l.z)).y;
    if (c.upper) {
      const up = root.localToWorld(new THREE.Vector3(l.x, UPPER + .09, l.z)).y;
      if (wp.y > up - .5) return { y: up, cell: c, upper: true };
    }
    return { y: low, cell: c, upper: false };
  };
  /* 墙体碰撞：返回是否被墙阻挡 */
  this.blocked = function (wp, radius) {
    const l = root.worldToLocal(wp.clone());
    const i = Math.round(l.x / CELL), j = Math.round(l.z / CELL);
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      const c = get(i + di, j + dj); if (!c) continue;
      for (let d = 0; d < 4; d++) {
        const e = c.edges[d]; if (!e) continue;
        if (DB.BUILD_MAP[e.id] && DB.BUILD_MAP[e.id].half) continue;
        const o = EDGE_OFF[d];
        const ex = (c.i + di * 0) * CELL + o[0] * CELL / 2, ez = c.j * CELL + o[1] * CELL / 2;
        const hx = Math.abs(o[0]) > 0 ? .18 : CELL / 2, hz = Math.abs(o[1]) > 0 ? .18 : CELL / 2;
        if (Math.abs(l.x - ex) < hx + radius && Math.abs(l.z - ez) < hz + radius) {
          if (l.y < UPPER - .4) return { nx: o[0], nz: o[1] };
        }
      }
      if (c.obj && ['storage_box', 'research_table', 'simple_purifier', 'simple_grill', 'crop_plot', 'water_collector', 'sail', 'steering_wheel', 'anchor', 'pillar'].indexOf(c.obj.id) >= 0) {
        const ox = c.i * CELL, oz = c.j * CELL, r = c.obj.id === 'pillar' ? .16 : .5;
        const dx = l.x - ox, dz = l.z - oz;
        if (Math.abs(dx) < r + radius && Math.abs(dz) < r + radius && l.y < UPPER - .4) {
          return { nx: Math.abs(dx) > Math.abs(dz) ? Math.sign(dx) : 0, nz: Math.abs(dz) >= Math.abs(dx) ? Math.sign(dz) : 0 };
        }
      }
    }
    return null;
  };

  /* ------------------------------------------------------------- 设施逻辑 */
  function initStation(o) {
    switch (o.station) {
      case 'purifier': o.data = { salt: 0, fuel: 0, prog: 0, out: 0, burn: 0 }; break;
      case 'grill': o.data = { slots: [null, null, null, null], fuel: 0, burn: 0 }; break;
      case 'net': o.data = { items: {}, count: 0 }; break;
      case 'collector': o.data = { water: 0, max: 4 }; break;
      case 'storage': o.data = { items: new Array(DB.BUILD_MAP.storage_box.slots).fill(null) }; break;
      case 'research': o.data = {}; break;
      case 'sail': o.data = { up: false, anim: 0 }; break;
      case 'wheel': o.data = {}; break;
      case 'anchor': o.data = { down: false, anim: 0 }; break;
      case 'crop': o.data = { seed: null, t: 0, water: 0, ready: false }; break;
      case 'bed': o.data = {}; break;
      case 'lamp': o.data = { on: true }; break;
    }
  }
  this.initStation = initStation;

  /* 作物模型 */
  function updateCropMesh(o) {
    const st = o.st, d = o.data;
    while (st.plant.children.length) { const c = st.plant.children.pop(); if (c.geometry) c.geometry.dispose(); }
    if (!d.seed) return;
    const def = DB.CROPS[d.seed];
    const g = U.clamp(d.t / def.grow, 0, 1);
    const h = .18 + g * .85;
    const stem = mesh(cyl(.035, .05, h, 6), new THREE.MeshStandardMaterial({ color: 0x4a8f34, roughness: .9 }), 0, h / 2, 0);
    st.plant.add(stem);
    const nl = 2 + Math.floor(g * 5);
    for (let k = 0; k < nl; k++) {
      const a = k / nl * U.TAU + g;
      const lf = mesh(box(.3 + g * .3, .02, .12 + g * .12), M.leaf, Math.cos(a) * (.12 + g * .16), h * (.35 + .5 * (k / nl)), Math.sin(a) * (.12 + g * .16));
      lf.rotation.y = -a; lf.rotation.z = -.3; st.plant.add(lf);
    }
    if (d.ready) {
      const fr = mesh(new THREE.SphereGeometry(.11, 10, 8), new THREE.MeshStandardMaterial({ color: d.seed === 'watermelon' ? 0x2f7f3a : d.seed === 'mango' ? 0xf0a02a : d.seed === 'pineapple' ? 0xe0c040 : d.seed === 'potato' ? 0xc8a86a : 0xc03040, roughness: .7 }), 0, h + .04, 0);
      st.plant.add(fr);
    }
  }
  this.updateCropMesh = updateCropMesh;

  /* --------------------------------------------------------------- 更新 */
  let bobT = 0;
  this.update = function (dt) {
    const W = game.world;
    bobT += dt;

    /* 驱动力 */
    const sailStation = stations.find(s => s.station === 'sail' && s.data.up);
    self.sailUp = !!sailStation;
    const anchorSt = stations.find(s => s.station === 'anchor' && s.data.down);
    self.anchorDown = !!anchorSt;
    const wheel = stations.find(s => s.station === 'wheel');

    const mass = 1 + self.countFoundations() * 0.012;
    let want = new THREE.Vector3();
    if (self.sailUp && !self.anchorDown) {
      const wind = W.windVec();
      let dir = wind.clone();
      if (wheel && self.desiredYaw != null) {
        const d = new THREE.Vector3(Math.sin(self.desiredYaw), 0, Math.cos(self.desiredYaw));
        // 帆只能借风：航向与风向夹角越大越慢
        const align = U.clamp(d.dot(wind) * .5 + .5, .12, 1);
        dir = d.multiplyScalar(align);
      }
      want.copy(dir).multiplyScalar(W.windSpeed * 2.2 / mass);
    }
    if (self.anchorDown) want.set(0, 0, 0);
    self.vel.lerp(want, 1 - Math.exp(-(self.anchorDown ? 1.4 : .65) * dt));
    // 岛屿阻挡：靠太近就停
    if (game.islands) {
      game.islands.list.forEach(isl => {
        const d = Math.hypot(self.pos.x - isl.x, self.pos.z - isl.z);
        const rr = isl.r + 5;
        if (d < rr) {
          const n = new THREE.Vector3(self.pos.x - isl.x, 0, self.pos.z - isl.z).normalize();
          if (self.vel.dot(n) < 0) self.vel.addScaledVector(n, -self.vel.dot(n));
          self.pos.addScaledVector(n, (rr - d) * dt * 2);
        }
      });
    }
    self.pos.addScaledVector(self.vel, dt);

    /* 转向 */
    if (wheel && self.desiredYaw != null) {
      let diff = ((self.desiredYaw - self.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      self.yaw += U.clamp(diff, -.5 * dt, .5 * dt);
      if (wheel.st.wheel) wheel.st.wheel.rotation.z = U.damp(wheel.st.wheel.rotation.z, -diff * 1.6, 4, dt);
    } else if (self.sailUp) {
      // 无舵：缓慢随风摆动
      const wd = Math.atan2(W.windVec().x, W.windVec().z);
      let diff = ((wd - self.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      self.yaw += U.clamp(diff, -.08 * dt, .08 * dt);
    }

    /* 浮力姿态 */
    const y = W.waterY(self.pos.x, self.pos.z);
    const n = W.waterNormal(self.pos.x, self.pos.z);
    root.position.set(self.pos.x, y - .04, self.pos.z);
    const tilt = .55 / (1 + self.countFoundations() * .02);
    root.rotation.set(0, self.yaw, 0);
    root.rotation.x = U.damp(root.rotation.x, Math.atan2(-n.z, n.y) * tilt, 3, dt);
    root.rotation.z = U.damp(root.rotation.z, Math.atan2(n.x, n.y) * tilt, 3, dt);
    root.updateMatrixWorld();

    /* 设施 tick */
    const night = W.isNight();
    for (let s = 0; s < stations.length; s++) {
      const o = stations[s], d = o.data, st = o.st;
      switch (o.station) {
        case 'purifier': {
          if (d.burn > 0) d.burn -= dt;
          if (d.salt > 0 && (d.burn > 0 || d.fuel > 0)) {
            if (d.burn <= 0 && d.fuel > 0) { d.fuel--; d.burn = 22; }
            d.prog += dt;
            if (d.prog >= 12) { d.prog = 0; d.salt--; d.out++; RS.Audio.play('steam', .5); }
          }
          const active = d.salt > 0 && d.burn > 0;
          if (st.fire) { st.fire.visible = active; st.fire.material = M.ember; }
          if (st.light) st.light.intensity = active ? 1.6 + Math.sin(bobT * 12) * .4 : 0;
          if (st.cup) st.cup.visible = d.out > 0;
          break;
        }
        case 'grill': {
          if (d.burn > 0) d.burn -= dt;
          const hasWork = d.slots.some(x => x && !x.done);
          if (hasWork && d.burn <= 0 && d.fuel > 0) { d.fuel--; d.burn = 26; }
          const active = d.burn > 0;
          if (active) {
            d.slots.forEach(x => {
              if (!x || x.done) return;
              x.prog += dt;
              if (x.prog >= x.time) { x.done = true; RS.Audio.play('craft', .4); }
            });
          }
          if (st.fire) {
            st.fire.visible = active;
            st.fire.children.forEach((f, k) => { f.scale.y = .7 + Math.sin(bobT * 9 + k) * .3; });
          }
          if (st.light) st.light.intensity = active ? 2.4 + Math.sin(bobT * 14) * .6 : 0;
          if (st.food) {
            while (st.food.children.length > d.slots.filter(Boolean).length) { const c = st.food.children.pop(); c.geometry.dispose(); }
            const items = d.slots.filter(Boolean);
            items.forEach((x, k) => {
              let m = st.food.children[k];
              if (!m) { m = mesh(box(.22, .07, .1), new THREE.MeshStandardMaterial({ color: 0xd08a5a, roughness: .7 })); st.food.add(m); }
              m.position.set(-.24 + (k % 2) * .48, 0, -.14 + Math.floor(k / 2) * .28);
              m.material.color.setHex(x.done ? 0x8a5230 : 0xd8a070);
            });
          }
          break;
        }
        case 'net': {
          if (st.bag) st.bag.scale.setScalar(1 + U.clamp(d.count / 20, 0, .5));
          break;
        }
        case 'collector': {
          if (W.rainAmount > .15 && d.water < d.max) {
            d.acc = (d.acc || 0) + dt * W.rainAmount * .12;
            if (d.acc >= 1) { d.acc = 0; d.water++; }
          }
          if (st.water) { st.water.scale.y = Math.max(.02, d.water / d.max); st.water.position.y = .06 + .25 * (d.water / d.max); }
          break;
        }
        case 'sail': {
          d.anim = U.damp(d.anim, d.up ? 1 : 0, 4, dt);
          if (st.cloth) {
            st.cloth.scale.y = Math.max(.04, d.anim);
            st.cloth.position.y = 1.65 + 1.35 * d.anim;
            const wd = Math.atan2(W.windVec().x, W.windVec().z);
            st.cloth.rotation.y = U.damp(st.cloth.rotation.y, (wd - self.yaw) * .35, 2, dt) + Math.sin(bobT * 1.6) * .04 * d.anim;
          }
          break;
        }
        case 'anchor': {
          d.anim = U.damp(d.anim, d.down ? 1 : 0, 3, dt);
          if (st.anchor) st.anchor.position.y = 1.05 - d.anim * 2.2;
          if (st.chain) st.chain.scale.y = 1 + d.anim * 6;
          break;
        }
        case 'crop': {
          if (d.seed) {
            if (d.water > 0) {
              d.t += dt * 1.0;
              d.water -= dt * .06;
            } else d.t += dt * .25;
            const def = DB.CROPS[d.seed];
            const wasReady = d.ready;
            d.ready = d.t >= def.grow;
            d.mt = (d.mt || 0) + dt;
            if (d.mt > 1.2) { d.mt = 0; updateCropMesh(o); }
            if (d.ready && !wasReady) game.ui.toast('🌱 ' + def.name + ' 成熟了', 'good');
          }
          break;
        }
        case 'lamp': {
          if (st.light) st.light.intensity = U.damp(st.light.intensity, night && d.on ? 3.2 : 0, 3, dt);
          if (st.glass) st.glass.material = night && d.on ? M.lampGlass : M.glass;
          break;
        }
      }
    }
  };

  /* ------------------------------------------------------------- 初始木筏 */
  this.buildStarter = function () {
    for (let i = -1; i <= 0; i++) for (let j = -1; j <= 0; j++) self.place('foundation', i, j, null, true);
    // 起步就有一个小小的箱子和一面栏杆，像原作被冲散后的残骸
    self.place('wall_half', -1, -1, 0, true);
    self.place('wall_half', 0, -1, 0, true);
  };

  /* -------------------------------------------------------------- 存档 */
  this.serialize = function () {
    const out = { pos: [self.pos.x, self.pos.z], yaw: self.yaw, cells: [] };
    cells.forEach(c => {
      if (!c.base && !c.obj && !c.roof && !c.upper && !c.edges.some(Boolean)) return;
      const e = { i: c.i, j: c.j };
      if (c.base) e.base = [c.base.id, Math.round(c.base.hp)];
      if (c.roof) e.roof = c.roof.id;
      if (c.upper) e.upper = c.upper.id;
      const eg = [];
      for (let d = 0; d < 4; d++) eg.push(c.edges[d] ? c.edges[d].id : 0);
      if (eg.some(x => x)) e.edges = eg;
      if (c.obj) {
        e.obj = c.obj.id;
        const d = c.obj.data;
        e.data = JSON.parse(JSON.stringify({
          salt: d.salt, fuel: d.fuel, prog: d.prog, out: d.out, burn: d.burn,
          slots: d.slots, water: d.water, items: d.items, count: d.count,
          up: d.up, down: d.down, seed: d.seed, t: d.t, ready: d.ready, on: d.on
        }));
      }
      out.cells.push(e);
    });
    return out;
  };
  this.deserialize = function (s) {
    cells.forEach(c => { if (c.base) self.removeAt(c, 'base'); });
    cells.clear(); stations.length = 0;
    self.pos.set(s.pos[0], 0, s.pos[1]); self.yaw = s.yaw || 0;
    s.cells.forEach(e => {
      if (e.base) { self.place(e.base[0], e.i, e.j, null, true); const c = get(e.i, e.j); if (c && c.base) c.base.hp = e.base[1]; }
    });
    s.cells.forEach(e => {
      if (e.edges) for (let d = 0; d < 4; d++) if (e.edges[d]) self.place(e.edges[d], e.i, e.j, d, true);
      if (e.roof) self.place(e.roof, e.i, e.j, null, true);
      if (e.upper) self.place(e.upper, e.i, e.j, null, true);
      if (e.obj) {
        self.place(e.obj, e.i, e.j, null, true);
        const c = get(e.i, e.j);
        if (c && c.obj && e.data) {
          for (const k in e.data) if (e.data[k] !== undefined && e.data[k] !== null) c.obj.data[k] = e.data[k];
          if (c.obj.station === 'crop') updateCropMesh(c.obj);
        }
      }
    });
  };

  /* 找一个安全的出生点（第一块地基上方） */
  this.spawnPoint = function () {
    let best = null;
    cells.forEach(c => { if (c.base && !best) best = c; });
    if (!best) return new THREE.Vector3(0, 2, 0);
    return self.cellWorld(best).add(new THREE.Vector3(0, 1.7, 0));
  };
};
