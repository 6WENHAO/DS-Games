window.SCP = window.SCP || {};
(function (S) {
  const CELL = 8, H = 4, GAP = 2.6, WT = 0.4, INSET = 1.8;

  S.buildWorld = function (game) {
    const L = game.layout;
    const T = game.TEX;
    const scene = game.scene;
    const rng = S.makeRng(L.seed + ':deco');

    const mats = {
      lczWall: new THREE.MeshLambertMaterial({ map: T.lczWall }),
      lczFloor: new THREE.MeshLambertMaterial({ map: T.lczFloor }),
      hczWall: new THREE.MeshLambertMaterial({ map: T.hczWall }),
      hczFloor: new THREE.MeshLambertMaterial({ map: T.hczFloor }),
      ezWall: new THREE.MeshLambertMaterial({ map: T.ezWall }),
      ezFloor: new THREE.MeshLambertMaterial({ map: T.ezFloor }),
      ceil: new THREE.MeshLambertMaterial({ map: T.ceil }),
      dark: new THREE.MeshLambertMaterial({ color: 0x2a2d33 }),
      metal: new THREE.MeshLambertMaterial({ color: 0x565d66 }),
      white: new THREE.MeshLambertMaterial({ color: 0xcfd2d6 }),
      wood: new THREE.MeshLambertMaterial({ color: 0x6e5a41 }),
      copper: new THREE.MeshLambertMaterial({ color: 0x7d5a36 }),
      server: new THREE.MeshLambertMaterial({ map: T.server }),
      orange: new THREE.MeshLambertMaterial({ color: 0xb85c1e }),
      navy: new THREE.MeshLambertMaterial({ color: 0x2a3448 }),
      redDark: new THREE.MeshLambertMaterial({ color: 0x30100e }),
      pdFloor: new THREE.MeshLambertMaterial({ color: 0x1c0806 }),
      lightPanel: new THREE.MeshBasicMaterial({ color: 0xd8e2ea }),
      screen: new THREE.MeshBasicMaterial({ color: 0x9fe0b2 })
    };
    const buckets = new Map();
    function bucket(mat) {
      if (!buckets.has(mat)) buckets.set(mat, []);
      return buckets.get(mat);
    }

    const W = {
      colliders: new Map(),
      doors: L.doors,
      interact: [],
      pickups: [],
      gasCells: new Set(),
      decalY: 0.02,
      mats,
      dynamic: [],
      tesla: null,
      pd: null,
      outside: null,
      spawn: {}
    };

    function colList(c, r) {
      const k = S.key(c, r);
      if (!W.colliders.has(k)) W.colliders.set(k, []);
      return W.colliders.get(k);
    }
    function addBox(mat, w, h, d, x, y, z, ry, solid, cell) {
      bucket(mat).push({ geo: S.texturedBoxGeo(w, h, d, 4), matrix: S.boxAt(x, y, z, ry) });
      if (solid) {
        const hw = ry ? d / 2 : w / 2, hd = ry ? w / 2 : d / 2;
        const cc = cell || { c: S.colOf(x), r: S.rowOf(z) };
        colList(cc.c, cc.r).push(S.aabb(x, z, hw + 0.0, hd + 0.0, y - h / 2, y + h / 2));
      }
    }
    W.addBox = addBox;

    let decalCount = 0;
    function addDecal(texture, x, z, size, ry) {
      const g = new THREE.PlaneGeometry(size, size);
      const m = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
      const p = new THREE.Mesh(g, m);
      p.rotation.x = -Math.PI / 2;
      p.rotation.z = ry || rng.range(0, 6.28);
      p.position.set(x, 0.02 + (decalCount++ % 40) * 0.0015, z);
      scene.add(p);
      return p;
    }
    W.addDecal = addDecal;

    function addSign(texture, x, y, z, ry, w, h) {
      const g = new THREE.PlaneGeometry(w || 2.2, h || 0.55);
      const m = new THREE.MeshBasicMaterial({ map: texture });
      const p = new THREE.Mesh(g, m);
      p.position.set(x, y, z);
      p.rotation.y = ry;
      scene.add(p);
      return p;
    }
    W.addSign = addSign;

    function addPickup(id, x, y, z) {
      const mat = new THREE.SpriteMaterial({ map: game.ICONS[id + '_tex'] || game.ICONS['doc_tex'], transparent: true });
      const sp = new THREE.Sprite(mat);
      sp.scale.set(0.42, 0.42, 0.42);
      sp.position.set(x, y, z);
      scene.add(sp);
      const pk = { id, sprite: sp, x, y0: y, z, taken: false, t: rng.range(0, 6) };
      W.pickups.push(pk);
      return pk;
    }
    W.addPickup = addPickup;

    function addLight(color, intensity, dist, x, y, z) {
      const li = new THREE.PointLight(color, intensity, dist);
      li.position.set(x, y, z);
      scene.add(li);
      return li;
    }

    function corpse(x, z, mat, ry) {
      addBox(mat, 0.55, 0.3, 1.5, x, 0.15, z, ry, false);
      addBox(mats.white, 0.3, 0.26, 0.3, x + Math.sin(ry || 0) * 0.9, 0.14, z + Math.cos(ry || 0) * 0.9, 0, false);
      addDecal(T.blood, x, z, rng.range(1.6, 2.6));
    }

    const zoneMats = {
      LCZ: { wall: mats.lczWall, floor: mats.lczFloor },
      CPA: { wall: mats.hczWall, floor: mats.hczFloor },
      HCZ: { wall: mats.hczWall, floor: mats.hczFloor },
      CPB: { wall: mats.hczWall, floor: mats.hczFloor },
      EZ: { wall: mats.ezWall, floor: mats.ezFloor },
      GATE: { wall: mats.ezWall, floor: mats.ezFloor }
    };

    function buildWallSide(cell, d, wallMat) {
      const cx = S.worldX(cell.c), cz = S.worldZ(cell.r);
      const zc = d === 'n' ? cz - CELL / 2 : cz + CELL / 2;
      const xc = d === 'e' ? cx + CELL / 2 : cx - CELL / 2;
      const horiz = (d === 'n' || d === 's');
      if (!cell.open[d]) {
        if (horiz) addBox(wallMat, CELL + WT, H, WT, cx, H / 2, zc, 0, true, cell);
        else addBox(wallMat, WT, H, CELL + WT, xc, H / 2, cz, 0, true, cell);
      } else {
        const segLen = (CELL - GAP) / 2;
        const off = GAP / 2 + segLen / 2;
        if (horiz) {
          addBox(wallMat, segLen + WT, H, WT, cx - off, H / 2, zc, 0, true, cell);
          addBox(wallMat, segLen + WT, H, WT, cx + off, H / 2, zc, 0, true, cell);
          addBox(wallMat, GAP + 0.2, H - 3, WT, cx, 3 + (H - 3) / 2, zc, 0, false, cell);
        } else {
          addBox(wallMat, WT, H, segLen + WT, xc, H / 2, cz - off, 0, true, cell);
          addBox(wallMat, WT, H, segLen + WT, xc, H / 2, cz + off, 0, true, cell);
          addBox(wallMat, WT, H - 3, GAP + 0.2, xc, 3 + (H - 3) / 2, cz, 0, false, cell);
        }
      }
    }

    for (const cell of L.cells.values()) {
      const zm = zoneMats[cell.zone];
      const cx = S.worldX(cell.c), cz = S.worldZ(cell.r);
      addBox(zm.floor, CELL + WT, 0.3, CELL + WT, cx, -0.15, cz, 0, false, cell);
      addBox(mats.ceil, CELL + WT, 0.3, CELL + WT, cx, H + 0.15, cz, 0, false, cell);
      bucket(mats.lightPanel).push({ geo: new THREE.PlaneGeometry(1.5, 1.5).rotateX(Math.PI / 2), matrix: S.boxAt(cx, H - 0.02, cz) });

      for (const d of ['n', 'e']) {
        const dd = S.DIRS[d];
        buildWallSide(cell, d, zm.wall);
        const nb = L.get(cell.c + dd.dc, cell.r + dd.dr);
        if (nb && nb.zone !== cell.zone && cell.open[d]) { }
      }
      for (const d of ['s', 'w']) {
        const dd = S.DIRS[d];
        const nb = L.get(cell.c + dd.dc, cell.r + dd.dr);
        if (!nb) buildWallSide(cell, d, zm.wall);
      }

      let opens = 0;
      for (const d in S.DIRS) if (cell.open[d]) opens++;
      if (!cell.special && opens >= 2) {
        for (const d in S.DIRS) {
          if (cell.open[d]) continue;
          if (d === 'n') addBox(zm.wall, CELL, H, WT, cx, H / 2, cz - INSET - WT / 2, 0, true, cell);
          if (d === 's') addBox(zm.wall, CELL, H, WT, cx, H / 2, cz + INSET + WT / 2, 0, true, cell);
          if (d === 'e') addBox(zm.wall, WT, H, CELL, cx + INSET + WT / 2, H / 2, cz, 0, true, cell);
          if (d === 'w') addBox(zm.wall, WT, H, CELL, cx - INSET - WT / 2, H / 2, cz, 0, true, cell);
        }
        if (cell.zone === 'HCZ' && rng.chance(0.5))
          addBox(mats.metal, 0.25, 0.25, CELL, cx + rng.range(-1.2, 1.2), H - 0.4, cz, 0, false, cell);
        if (rng.chance(0.12))
          addBox(mats.dark, 0.9, 0.9, 0.9, cx + rng.range(-1, 1), 0.45, cz + rng.range(-1, 1), rng.range(0, 3), true, cell);
        if (rng.chance(0.1)) addDecal(T.blood, cx + rng.range(-1.5, 1.5), cz + rng.range(-1.5, 1.5), rng.range(0.8, 1.6));
      } else if (!cell.special && opens === 1 && rng.chance(0.7)) {
        addBox(mats.dark, 1.2, 1.0, 0.8, cx + rng.range(-2.4, 2.4), 0.5, cz + rng.range(-2.4, 2.4), rng.range(0, 3), true, cell);
        if (rng.chance(0.5)) addBox(mats.dark, 0.8, 0.7, 0.6, cx + rng.range(-2.4, 2.4), 0.35, cz + rng.range(-2.4, 2.4), rng.range(0, 3), true, cell);
      }
      if (!cell.special && rng.chance(0.1)) {
        const side = rng.pick(['n', 's', 'e', 'w']);
        if (!cell.open[side]) {
          const inn = (opens >= 2) ? INSET : CELL / 2 - 0.25;
          if (side === 'n') addSign(T.poster, cx + rng.range(-2, 2), 2, cz - inn + 0.03, 0, 1.6, 0.8);
          if (side === 's') addSign(T.poster, cx + rng.range(-2, 2), 2, cz + inn - 0.03, Math.PI, 1.6, 0.8);
          if (side === 'e') addSign(T.poster, cx + inn - 0.03, 2, cz + rng.range(-2, 2), -Math.PI / 2, 1.6, 0.8);
          if (side === 'w') addSign(T.poster, cx - inn + 0.03, 2, cz + rng.range(-2, 2), Math.PI / 2, 1.6, 0.8);
        }
      }
    }

    for (const door of L.doors) {
      const cell = L.get(door.c, door.r);
      const dd = S.DIRS[door.side];
      const cx = S.worldX(door.c), cz = S.worldZ(door.r);
      const horiz = (door.side === 'n' || door.side === 's');
      const x = horiz ? cx : (door.side === 'e' ? cx + CELL / 2 : cx - CELL / 2);
      const z = horiz ? (door.side === 'n' ? cz - CELL / 2 : cz + CELL / 2) : cz;
      const texMat = new THREE.MeshLambertMaterial({ map: door.big ? T.doorBig : T.door });
      const g1 = S.texturedBoxGeo(GAP / 2, 3, 0.18, GAP);
      const p1 = new THREE.Mesh(g1, texMat);
      const p2 = new THREE.Mesh(g1, texMat);
      const grp = new THREE.Group();
      grp.add(p1); grp.add(p2);
      grp.position.set(x, 1.5, z);
      if (!horiz) grp.rotation.y = Math.PI / 2;
      scene.add(grp);
      const fg = S.texturedBoxGeo(0.5, H, 0.6, 2);
      const fm = new THREE.Mesh(fg, mats.dark);
      fm.position.set(horiz ? x - GAP / 2 - 0.2 : x, H / 2, horiz ? z : z - GAP / 2 - 0.2);
      const fm2 = fm.clone();
      fm2.position.set(horiz ? x + GAP / 2 + 0.2 : x, H / 2, horiz ? z : z + GAP / 2 + 0.2);
      scene.add(fm); scene.add(fm2);
      door.grp = grp; door.p1 = p1; door.p2 = p2; door.horiz = horiz;
      door.x = x; door.z = z;
      door.aabb = horiz ? S.aabb(x, z, GAP / 2 + 0.2, 0.3, 0, 3) : S.aabb(x, z, 0.3, GAP / 2 + 0.2, 0, 3);
      W.interact.push({
        x, z, y: 1.4, r: 2.2,
        hint: () => {
          if (door.broken) return '门已损坏';
          if (door.locked) return '控制失效 · 无法开启';
          if (door.level > 0) return (door.open ? '[E] 关闭' : '[E] 需要 ' + door.level + ' 级钥匙卡');
          return door.open ? '[E] 关闭闸门' : '[E] 开启闸门';
        },
        action: () => game.tryDoor(door)
      });
    }
    W.updateDoor = function (door) {
      const slide = (GAP / 2) * door.amount + 0.02;
      door.p1.position.x = -GAP / 4 - slide * 0.98;
      door.p2.position.x = GAP / 4 + slide * 0.98;
    };
    for (const d of L.doors) W.updateDoor(d);

    const SB = {};
    SB.chamber173 = function (cell, cx, cz) {
      addBox(mats.dark, 1.1, H, 1.1, cx - 3.4, H / 2, cz - 3.4, 0, true, cell);
      addBox(mats.dark, 1.1, H, 1.1, cx + 3.4, H / 2, cz - 3.4, 0, true, cell);
      addBox(mats.dark, 1.1, H, 1.1, cx - 3.4, H / 2, cz + 3.4, 0, true, cell);
      addBox(mats.dark, 1.1, H, 1.1, cx + 3.4, H / 2, cz + 3.4, 0, true, cell);
      const wg = new THREE.PlaneGeometry(3.4, 1.1);
      const wm = new THREE.Mesh(wg, new THREE.MeshBasicMaterial({ color: 0x3c4854 }));
      wm.position.set(cx, 2.9, cz + CELL / 2 - 0.22);
      wm.rotation.y = Math.PI;
      scene.add(wm);
      addSign(S.makeSignTex('SCP-173', '收容间 · EUCLID', { border: '#c33' }), cx - 2.8, 2.5, cz + CELL / 2 - 0.22, Math.PI, 2, 0.5);
      addLight(0xfff2dd, 0.9, 11, cx, H - 0.6, cz);
      W.spawn.p173 = { x: cx, z: cz - 1.2 };
      W.spawn.chamber = { x: cx, z: cz + 2.6 };
    };
    SB.checkpoint = function (cell, cx, cz) {
      addBox(mats.metal, 0.8, H, 0.8, cx - 1.9, H / 2, cz - 2.6, 0, true, cell);
      addBox(mats.metal, 0.8, H, 0.8, cx + 1.9, H / 2, cz - 2.6, 0, true, cell);
      addBox(mats.metal, 0.8, H, 0.8, cx - 1.9, H / 2, cz + 2.6, 0, true, cell);
      addBox(mats.metal, 0.8, H, 0.8, cx + 1.9, H / 2, cz + 2.6, 0, true, cell);
      addBox(mats.dark, 3.2, 0.18, 0.18, cx, 3.5, cz, 0, false, cell);
      const isB = cell.special.label === 'B';
      const ahead = isB ? '入口区 ENTRANCE ZONE' : '重收容区 HEAVY CONT.';
      addSign(S.makeSignTex('检查点 ' + cell.special.label, '前方 ' + ahead), cx, 3.1, cz, 0, 3, 0.75);
      addSign(S.makeSignTex('检查点 ' + cell.special.label, '前方 ' + ahead), cx, 3.1, cz + 0.02, Math.PI, 3, 0.75);
      addLight(0xffffff, 0.8, 10, cx, H - 0.5, cz);
      if (cell.special.tesla) {
        addBox(mats.dark, 0.9, 3.4, 0.9, cx - 1.75, 1.7, cz, 0, true, cell);
        addBox(mats.dark, 0.9, 3.4, 0.9, cx + 1.75, 1.7, cz, 0, true, cell);
        addBox(mats.dark, 4.4, 0.5, 0.9, cx, 3.6, cz, 0, false, cell);
        const coilMat = new THREE.MeshBasicMaterial({ color: 0x3a4a55 });
        const c1 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.7, 8), coilMat);
        c1.position.set(cx - 1.2, 2.6, cz);
        c1.rotation.z = Math.PI / 2;
        const c2 = c1.clone(); c2.position.x = cx + 1.2;
        scene.add(c1); scene.add(c2);
        const sparkMat = new THREE.LineBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0 });
        const sparkGeo = new THREE.BufferGeometry();
        sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(60 * 3), 3));
        const sparks = new THREE.LineSegments(sparkGeo, sparkMat);
        scene.add(sparks);
        W.tesla = { x: cx, z: cz, coilMat, sparks, sparkMat, state: 'idle', t: 0 };
        addSign(S.makeSignTex('⚠ 特斯拉门', 'TESLA GATE — 高压', { border: '#c33', fg2: '#c33' }), cx - 2.9, 2.4, cz + 1.4, Math.PI, 1.8, 0.45);
      }
    };
    SB.storage = function (cell, cx, cz) {
      for (const sx of [-2.2, 2.2]) {
        addBox(mats.metal, 2.6, 2.0, 0.7, cx + sx, 1.0, cz - 2.6, 0, true, cell);
        addBox(mats.metal, 2.6, 2.0, 0.7, cx + sx, 1.0, cz + 2.6, 0, true, cell);
      }
      addBox(mats.dark, 1.4, 1.1, 0.9, cx, 0.55, cz, 0.4, true, cell);
      addPickup('keycard1', cx - 2.2, 2.25, cz - 2.6);
      addPickup('snav', cx + 2.2, 2.25, cz - 2.6);
      addPickup('gasmask', cx - 2.2, 2.25, cz + 2.6);
      addPickup('battery', cx + 2.2, 2.25, cz + 2.6);
      addPickup('doc173', cx + 0.3, 1.25, cz);
      addSign(S.makeSignTex('仓储间', 'STORAGE'), cx, 3.2, cz - CELL / 2 + 0.28, 0, 2, 0.5);
    };
    SB.room914 = function (cell, cx, cz) {
      addBox(mats.copper, 3.6, 2.8, 1.8, cx, 1.4, cz - 2.6, 0, true, cell);
      addBox(mats.copper, 0.5, H - 2.8, 0.5, cx - 1.2, 2.8 + (H - 2.8) / 2, cz - 2.6, 0, false, cell);
      addBox(mats.copper, 0.5, H - 2.8, 0.5, cx + 1.2, 2.8 + (H - 2.8) / 2, cz - 2.6, 0, false, cell);
      for (const bx of [-2.6, 2.6]) {
        addBox(mats.copper, 1.6, 2.4, 0.2, cx + bx, 1.2, cz - 3.1, 0, true, cell);
        addBox(mats.copper, 0.2, 2.4, 1.2, cx + bx - 0.8, 1.2, cz - 2.5, 0, true, cell);
        addBox(mats.copper, 0.2, 2.4, 1.2, cx + bx + 0.8, 1.2, cz - 2.5, 0, true, cell);
        addBox(mats.copper, 1.6, 0.2, 1.2, cx + bx, 2.5, cz - 2.5, 0, false, cell);
      }
      addBox(mats.dark, 1.2, 1.0, 0.7, cx, 0.5, cz - 1.4, 0, true, cell);
      addSign(S.makeSignTex('SCP-914', '发条装置 · SAFE', { border: '#7fbf6a' }), cx, 3.2, cz - CELL / 2 + 0.28, 0, 2.2, 0.55);
      addLight(0xffe8c8, 0.8, 10, cx, H - 0.8, cz);
      W.spawn.m914 = {
        intake: { x: cx - 2.6, z: cz - 2.3 },
        output: { x: cx + 2.6, z: cz - 2.3 },
        knob: { x: cx - 0.4, z: cz - 1.4 },
        lever: { x: cx + 0.4, z: cz - 1.4 }
      };
      W.interact.push({
        x: cx - 2.6, z: cz - 2.3, y: 1.2, r: 1.6,
        hint: () => game.s914.item ? ('输入舱：' + S.ITEMS[game.s914.item].name) : '[E] 放入物品',
        action: () => game.use914('intake')
      });
      W.interact.push({
        x: cx - 0.4, z: cz - 1.4, y: 1.1, r: 1.4,
        hint: () => '[E] 旋钮：< ' + S.SETTING_NAMES[game.s914.setting] + ' >',
        action: () => game.use914('knob')
      });
      W.interact.push({
        x: cx + 0.4, z: cz - 1.4, y: 1.1, r: 1.4,
        hint: () => game.s914.busy ? 'SCP-914 运转中……' : '[E] 拉动拉杆',
        action: () => game.use914('lever')
      });
    };
    SB.office2 = function (cell, cx, cz) {
      addBox(mats.wood, 2.4, 0.1, 1.2, cx - 1.5, 0.85, cz - 2, 0, true, cell);
      addBox(mats.metal, 0.15, 0.85, 1.1, cx - 2.5, 0.42, cz - 2, 0, false, cell);
      addBox(mats.metal, 0.15, 0.85, 1.1, cx - 0.5, 0.42, cz - 2, 0, false, cell);
      addBox(mats.wood, 2.4, 0.1, 1.2, cx + 1.8, 0.85, cz + 1.6, 0.6, true, cell);
      addBox(mats.dark, 0.6, 1.1, 0.6, cx - 1.2, 0.55, cz - 0.6, 0.3, true, cell);
      addPickup('keycard2', cx - 1.5, 1.1, cz - 2);
      addPickup('doc_brief', cx - 0.8, 1.1, cz - 2);
      addPickup('doc914', cx + 1.8, 1.1, cz + 1.6);
      addSign(T.poster, cx, 2.2, cz - CELL / 2 + 0.28, 0, 2.2, 1.1);
      addSign(S.makeSignTex('区域办公室', 'ZONE OFFICE'), cx, 3.2, cz - CELL / 2 + 0.28, 0, 2, 0.5);
    };
    SB.medbay = function (cell, cx, cz, tag) {
      addBox(mats.white, 2.2, 0.55, 1.1, cx - 1.8, 0.5, cz - 2.2, 0, true, cell);
      addBox(mats.white, 2.2, 0.55, 1.1, cx + 1.8, 0.5, cz - 2.2, 0, true, cell);
      addBox(mats.white, 1.4, 1.9, 0.6, cx + 2.6, 0.95, cz + 2.6, 0, true, cell);
      addPickup('firstaid', cx - 1.8, 1.0, cz - 2.2);
      addPickup(tag === 2 ? 'superdrops' : 'eyedrops', cx + 1.8, 1.0, cz - 2.2);
      addPickup('firstaid', cx + 2.6, 2.1, cz + 2.6);
      addDecal(T.blood, cx - 1, cz + 1, 2.2);
      addSign(S.makeSignTex('医务室', 'MEDICAL BAY', { border: '#c33' }), cx, 3.2, cz - CELL / 2 + 0.28, 0, 2, 0.5);
    };
    SB.medbay2 = function (cell, cx, cz) { SB.medbay(cell, cx, cz, 2); };
    SB.gasCorridor = function (cell, cx, cz) {
      W.gasCells.add(S.key(cell.c, cell.r));
      const vert = cell.open.n;
      for (let i = 0; i < 3; i++) {
        if (vert) addBox(mats.metal, 0.3, 0.3, CELL, cx - 1.5 + i * 0.4, 3.2 - i * 0.35, cz, 0, false, cell);
        else addBox(mats.metal, CELL, 0.3, 0.3, cx, 3.2 - i * 0.35, cz - 1.5 + i * 0.4, 0, false, cell);
      }
      const sm = new THREE.SpriteMaterial({ map: T.gas, transparent: true, opacity: 0.35, depthWrite: false });
      W.gasSprites = W.gasSprites || [];
      for (let i = 0; i < 7; i++) {
        const sp = new THREE.Sprite(sm.clone());
        sp.position.set(cx + rng.range(-2.5, 2.5), rng.range(0.5, 2.6), cz + rng.range(-2.5, 2.5));
        sp.scale.set(3, 3, 3);
        scene.add(sp);
        W.gasSprites.push({ sp, t: rng.range(0, 6) });
      }
      addSign(S.makeSignTex('⚠ 管道泄漏', 'TOXIC — 需要防毒面具', { border: '#c9a13b', fg2: '#c9a13b' }), vert ? cx - INSET + 0.25 : cx, 2.4, vert ? cz : cz - INSET + 0.25, vert ? Math.PI / 2 : 0, 2.4, 0.6);
    };
    SB.server = function (cell, cx, cz) {
      for (const sx of [-2.6, -0.9, 0.9, 2.6]) {
        addBox(mats.server, 1.3, 2.6, 0.8, cx + sx, 1.3, cz - 2.8, 0, true, cell);
        if (sx < 2) addBox(mats.server, 1.3, 2.6, 0.8, cx + sx + 0.85, 1.3, cz + 2.8, 0, true, cell);
      }
      addBox(mats.dark, 2.0, 0.9, 0.9, cx, 0.45, cz, 0, true, cell);
      addPickup('keycard3', cx, 1.2, cz);
      addPickup('battery', cx - 0.7, 1.2, cz);
      addPickup('doc106', cx + 0.7, 1.2, cz);
      addLight(0x88ffaa, 0.5, 9, cx, H - 1, cz);
      addSign(S.makeSignTex('服务器机房', 'SERVER ROOM'), cx, 3.2, cz - CELL / 2 + 0.28, 0, 2, 0.5);
    };
    SB.chamber106 = function (cell, cx, cz) {
      addBox(mats.redDark, 3.2, 3.6, 3.2, cx, 1.8, cz - 1.6, 0.78, true, cell);
      addBox(mats.metal, 4.2, 0.4, 4.2, cx, 3.8, cz - 1.6, 0.78, false, cell);
      addDecal(T.corrosion, cx, cz + 1.6, 3.4);
      addDecal(T.corrosion, cx - 2.4, cz + 0.4, 2.2);
      addPickup('doc_pd', cx + 2.4, 0.5, cz + 2.4);
      addSign(S.makeSignTex('SCP-106', '收容间 · KETER — 收容失效', { border: '#c33', fg2: '#c33' }), cx, 3.2, cz - CELL / 2 + 0.28, 0, 2.6, 0.65);
      corpse(cx - 2.2, cz + 2.2, mats.navy, 0.8);
    };
    SB.armory = function (cell, cx, cz) {
      for (let i = 0; i < 4; i++)
        addBox(mats.dark, 1.1, 0.9, 1.1, cx - 2.4 + i * 1.6, 0.45, cz - 2.6, 0, true, cell);
      addBox(mats.metal, 3.2, 2.0, 0.5, cx, 1.0, cz + 3.2, 0, true, cell);
      addPickup('radio', cx - 2.4, 1.15, cz - 2.6);
      addPickup('firstaid', cx - 0.8, 1.15, cz - 2.6);
      addPickup('battery', cx + 0.8, 1.15, cz - 2.6);
      addPickup('keycard2', cx + 2.4, 1.15, cz - 2.6);
      addPickup('doc096', cx, 2.25, cz + 3.2);
      corpse(cx + 1.8, cz + 1.2, mats.navy, 2.2);
      addSign(S.makeSignTex('安保军械库', 'ARMORY', { border: '#c33' }), cx, 3.2, cz - CELL / 2 + 0.28, 0, 2, 0.5);
    };
    SB.corridor096 = function (cell, cx, cz) {
      addDecal(T.blood, cx + 0.8, cz + 0.6, 2.8);
      addDecal(T.blood, cx - 1.2, cz - 1.4, 2.2);
      corpse(cx - 0.8, cz + 1.8, mats.navy, 1.2);
      corpse(cx + 1.4, cz - 2.0, mats.orange, 4.0);
      W.spawn.p096 = { x: cx, z: cz };
      W.light096 = addLight(0xffffff, 0.65, 9, cx, H - 0.6, cz);
    };
    SB.office4 = function (cell, cx, cz) {
      addBox(mats.wood, 2.6, 0.1, 1.3, cx, 0.85, cz - 2, 0, true, cell);
      addBox(mats.metal, 0.15, 0.85, 1.2, cx - 1.1, 0.42, cz - 2, 0, false, cell);
      addBox(mats.metal, 0.15, 0.85, 1.2, cx + 1.1, 0.42, cz - 2, 0, false, cell);
      addBox(mats.wood, 2.2, 0.1, 1.1, cx - 2.2, 0.85, cz + 2, 1.2, true, cell);
      addBox(mats.dark, 0.6, 1.1, 0.6, cx + 0.4, 0.55, cz - 0.7, 2.6, true, cell);
      addBox(mats.metal, 1.3, 2.1, 0.7, cx + 3.0, 1.05, cz + 2.8, 0, true, cell);
      addPickup('keycard4', cx, 1.1, cz - 2);
      addPickup('doc_ez', cx - 2.2, 1.1, cz + 2);
      addPickup('firstaid', cx + 3.0, 2.3, cz + 2.8);
      addSign(T.poster, cx, 2.3, cz - CELL / 2 + 0.28, 0, 2.4, 1.2);
      addSign(S.makeSignTex('行政办公室', 'ADMIN OFFICE'), cx, 3.25, cz - CELL / 2 + 0.28, 0, 2, 0.5);
    };
    SB.lobby = function (cell, cx, cz) {
      addBox(mats.metal, 2.6, 0.45, 0.8, cx - 2, 0.35, cz + 2.6, 0, true, cell);
      addBox(mats.metal, 2.6, 0.45, 0.8, cx + 2, 0.35, cz + 2.6, 0, true, cell);
      addBox(mats.dark, 1.3, 2.1, 0.8, cx + 3.0, 1.05, cz - 2.8, 0, true, cell);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.1), mats.screen);
      scr.position.set(cx + 3.0, 1.15, cz - 2.38);
      scene.add(scr);
      addPickup('firstaid', cx - 2, 0.75, cz + 2.6);
      addPickup('doc_ez', cx + 2, 0.75, cz + 2.6);
      addSign(T.poster, cx - 3.2, 2.2, cz, Math.PI / 2, 2.2, 1.1);
      addSign(S.makeSignTex('入口区大厅', 'ENTRANCE LOBBY'), cx, 3.2, cz - CELL / 2 + 0.28, 0, 2.2, 0.55);
    };
    SB.gateB = function (cell, cx, cz) {
      addBox(mats.metal, 3.4, H, 0.4, cx, H / 2, cz - 3.0, 0, true, cell);
      addBox(mats.metal, 0.4, H, 2.8, cx - 1.7, H / 2, cz - 1.8, 0, true, cell);
      addBox(mats.metal, 0.4, H, 2.8, cx + 1.7, H / 2, cz - 1.8, 0, true, cell);
      addLight(0xfff6dd, 1.0, 10, cx, H - 0.6, cz - 1);
      addSign(S.makeSignTex('B 大门', 'GATE B — 电梯平台', { border: '#7fbf6a' }), cx, 3.3, cz - 2.98 + 0.22, 0, 2.6, 0.65);
      W.interact.push({
        x: cx, z: cz - 1.9, y: 1.3, r: 2.0,
        hint: () => '[E] 启动电梯 — 顶层平台',
        action: () => game.startEnding()
      });
      W.spawn.gate = { x: cx, z: cz - 1.5 };
    };

    for (const cell of L.cells.values()) {
      if (!cell.special) continue;
      const fn = SB[cell.special.type];
      if (fn) fn(cell, S.worldX(cell.c), S.worldZ(cell.r));
    }

    for (const cell of L.cells.values()) {
      if (!cell.items.length) continue;
      let opens = 0;
      for (const d in S.DIRS) if (cell.open[d]) opens++;
      const lim = opens >= 2 ? 1.3 : 2.6;
      for (const it of cell.items) {
        const dx = S.clamp(it.dx, -lim, lim);
        const dz = S.clamp(it.dz, -lim, lim);
        addPickup(it.id, S.worldX(cell.c) + dx, 0.42, S.worldZ(cell.r) + dz);
      }
    }

    {
      const PD = { ox: 600, oz: 600 };
      const flo = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 0.4, 32), mats.pdFloor);
      flo.position.set(PD.ox, -0.2, PD.oz);
      scene.add(flo);
      const ceilPd = flo.clone();
      ceilPd.position.y = 5.4;
      scene.add(ceilPd);
      const pdCols = [];
      W.pdColliders = pdCols;
      const exits = [];
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        const dx = Math.cos(a), dz = Math.sin(a);
        const px = PD.ox + dx * 13, pz = PD.oz + dz * 13;
        const side = { x: -dz, z: dx };
        for (const s of [-1, 1]) {
          const wx = px + side.x * s * 1.05, wz = pz + side.z * s * 1.05;
          addBox(mats.redDark, 0.6, 4.6, 0.6, wx, 2.3, wz, -a, false);
          pdCols.push(S.aabb(wx, wz, 0.45, 0.45, 0, 4.6));
          for (let seg = 1; seg <= 3; seg++) {
            const sx = px + dx * seg * 1.4 + side.x * s * 1.05;
            const sz = pz + dz * seg * 1.4 + side.z * s * 1.05;
            addBox(mats.redDark, 0.6, 4.6, 0.6, sx, 2.3, sz, -a, false);
            pdCols.push(S.aabb(sx, sz, 0.45, 0.45, 0, 4.6));
          }
        }
        addBox(mats.redDark, 2.9, 0.6, 0.7, px, 4.3, pz, -a, false);
        exits.push({ x: PD.ox + dx * 18.6, z: PD.oz + dz * 18.6, i });
      }
      for (let i = 0; i < 14; i++) {
        const a = rng.range(0, 6.28), rr = rng.range(4, 10);
        const wx = PD.ox + Math.cos(a) * rr, wz = PD.oz + Math.sin(a) * rr;
        addBox(mats.redDark, 0.5, 5.4, 0.5, wx, 2.7, wz, a, false);
        pdCols.push(S.aabb(wx, wz, 0.4, 0.4, 0, 5.4));
      }
      const rim = [];
      for (let i = 0; i < 40; i++) {
        const a = i / 40 * Math.PI * 2;
        const wx = PD.ox + Math.cos(a) * 25, wz = PD.oz + Math.sin(a) * 25;
        rim.push(S.aabb(wx, wz, 1.2, 1.2, 0, 6));
      }
      W.pdRim = rim;
      W.pd = { center: { x: PD.ox, z: PD.oz }, exits };
      W.pdLight = addLight(0x661111, 0.9, 30, PD.ox, 4, PD.oz);
    }

    {
      const O = { ox: -600, oz: -600 };
      addBox(mats.hczFloor === undefined ? mats.metal : zoneMats.HCZ.floor, 34, 1, 20, O.ox, -0.5, O.oz, 0, false);
      const outCols = [];
      W.outsideColliders = outCols;
      addBox(mats.metal, 34, 1.0, 0.4, O.ox, 0.5, O.oz + 10, 0, false);
      outCols.push(S.aabb(O.ox, O.oz + 10, 17, 0.3, 0, 1.2));
      addBox(mats.metal, 0.4, 1.0, 20, O.ox - 17, 0.5, O.oz, 0, false);
      outCols.push(S.aabb(O.ox - 17, O.oz, 0.3, 10, 0, 1.2));
      addBox(mats.metal, 0.4, 1.0, 20, O.ox + 17, 0.5, O.oz, 0, false);
      outCols.push(S.aabb(O.ox + 17, O.oz, 0.3, 10, 0, 1.2));
      addBox(mats.dark, 10, 6, 4, O.ox, 3, O.oz + 12.5, 0, false);
      outCols.push(S.aabb(O.ox, O.oz + 12.5, 5, 2, 0, 6));
      for (const px of [-10, 10]) {
        addBox(mats.dark, 0.5, 6.5, 0.5, O.ox + px, 3.25, O.oz - 6, 0, false);
        outCols.push(S.aabb(O.ox + px, O.oz - 6, 0.4, 0.4, 0, 6.5));
        const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.6), new THREE.MeshBasicMaterial({ color: 0xfff2cc }));
        head.position.set(O.ox + px, 6.3, O.oz - 6);
        scene.add(head);
        addLight(0xfff2cc, 1.1, 26, O.ox + px, 6, O.oz - 6);
      }
      const ring = new THREE.Mesh(new THREE.RingGeometry(3.4, 3.8, 40), new THREE.MeshBasicMaterial({ color: 0xc9a13b, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(O.ox, 0.02, O.oz - 4);
      scene.add(ring);
      const hg = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ color: 0xc9a13b, transparent: true, opacity: 0.5 }));
      hg.rotation.x = -Math.PI / 2;
      hg.position.set(O.ox, 0.03, O.oz - 4);
      scene.add(hg);
      const starGeo = new THREE.BufferGeometry();
      const sp = new Float32Array(500 * 3);
      for (let i = 0; i < 500; i++) {
        const a = rng.range(0, 6.28), e = rng.range(0.05, 1.4);
        sp[i * 3] = O.ox + Math.cos(a) * Math.cos(e) * 180;
        sp[i * 3 + 1] = Math.sin(e) * 180 + 4;
        sp[i * 3 + 2] = O.oz + Math.sin(a) * Math.cos(e) * 180;
      }
      starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
      const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x9fb3cc, size: 0.7, sizeAttenuation: false }));
      scene.add(stars);
      W.outside = { x: O.ox, z: O.oz, pad: { x: O.ox, z: O.oz - 4 } };
      addSign(S.makeSignTex('GATE B — 顶层平台', '等待撤离 · LZ-B', { border: '#7fbf6a' }), O.ox, 4.2, O.oz + 12.4 - 2.01, Math.PI, 5, 1.25);
    }

    for (const [mat, list] of buckets) {
      if (!list.length) continue;
      const merged = S.mergeGeos(list);
      const mesh = new THREE.Mesh(merged, mat);
      mesh.frustumCulled = false;
      scene.add(mesh);
    }

    W.collidersNear = function (x, z, area) {
      if (area === 'pd') return W.pdColliders.concat(W.pdRim);
      if (area === 'outside') return W.outsideColliders;
      const c = S.colOf(x), r = S.rowOf(z);
      const out = [];
      for (let dc = -1; dc <= 1; dc++)
        for (let dr = -1; dr <= 1; dr++) {
          const li = W.colliders.get(S.key(c + dc, r + dr));
          if (li) for (const b of li) out.push(b);
        }
      for (const d of L.doors) {
        if (Math.abs(d.x - x) < 6 && Math.abs(d.z - z) < 6 && d.amount < 0.7 && !d.broken)
          out.push(d.aabb);
      }
      return out;
    };

    return W;
  };
})(window.SCP);
