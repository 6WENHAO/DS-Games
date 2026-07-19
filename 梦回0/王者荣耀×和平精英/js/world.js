/* ================================================================
   荣耀精英 — 3D 战场（王者峡谷布局 × 和平精英军事写实画风）
   ================================================================ */
HE.World = (function () {
  const W = {};
  let scene, sunLight, waterMesh, clouds = [], time = 0;

  /* ---------- 工具：点到兵线的最近距离 ---------- */
  function distToSeg(px, pz, ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
    const cx = ax + dx * t, cz = az + dz * t;
    return Math.hypot(px - cx, pz - cz);
  }
  function distToLanes(x, z) {
    let m = 1e9;
    for (const key in HE.LANES) {
      const pts = HE.LANES[key];
      for (let i = 0; i < pts.length - 1; i++)
        m = Math.min(m, distToSeg(x, z, pts[i].x, pts[i].z, pts[i + 1].x, pts[i + 1].z));
    }
    return m;
  }
  W.distToLanes = distToLanes;
  const distToRiver = (x, z) => Math.abs(x + z) / Math.SQRT2;

  /* ---------- 地表纹理（canvas 手绘） ---------- */
  function makeGroundTexture() {
    const S = 1024, half = HE.CFG.MAP_HALF;
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d');
    const w2c = (x, z) => [ (x + half) / (half * 2) * S, (z + half) / (half * 2) * S ];

    // 基底草地（和平精英 黄绿草原色）
    g.fillStyle = '#59653e'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 5200; i++) {
      const x = Math.random() * S, y = Math.random() * S, r = 2 + Math.random() * 9;
      const shades = ['#51603c', '#616c41', '#4c5a38', '#6a7448', '#57634a'];
      g.fillStyle = shades[(Math.random() * shades.length) | 0];
      g.globalAlpha = 0.25 + Math.random() * 0.3;
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    g.globalAlpha = 1;

    // 野区深色植被
    for (let i = 0; i < 700; i++) {
      const x = Math.random() * 200 - 100, z = Math.random() * 200 - 100;
      if (distToLanes(x, z) > 10 && distToRiver(x, z) > 9) {
        const [cx, cy] = w2c(x, z);
        g.fillStyle = '#425032'; g.globalAlpha = 0.35;
        g.beginPath(); g.arc(cx, cy, 6 + Math.random() * 14, 0, 7); g.fill();
      }
    }
    g.globalAlpha = 1;

    // 河道（对角线）
    g.save();
    g.translate(S / 2, S / 2); g.rotate(-Math.PI / 4);
    const rg = g.createLinearGradient(0, -46, 0, 46);
    rg.addColorStop(0, 'rgba(90,110,105,0)');
    rg.addColorStop(0.25, '#5e7a80');
    rg.addColorStop(0.5, '#688e96');
    rg.addColorStop(0.75, '#5e7a80');
    rg.addColorStop(1, 'rgba(90,110,105,0)');
    g.fillStyle = rg; g.fillRect(-S, -46, S * 2, 92);
    // 沙岸
    g.fillStyle = 'rgba(140,130,95,.45)';
    g.fillRect(-S, -52, S * 2, 8); g.fillRect(-S, 44, S * 2, 8);
    g.restore();

    // 三路泥土大道
    const paintLane = pts => {
      g.strokeStyle = '#8d7f58'; g.lineWidth = 42; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath();
      pts.forEach((p, i) => { const [cx, cy] = w2c(p.x, p.z); i ? g.lineTo(cx, cy) : g.moveTo(cx, cy); });
      g.stroke();
      g.strokeStyle = '#9c8d64'; g.lineWidth = 30; g.stroke();
      // 车辙
      g.strokeStyle = 'rgba(110,96,64,.5)'; g.lineWidth = 4; g.stroke();
    };
    Object.values(HE.LANES).forEach(paintLane);
    // 大道磨损噪点
    for (let i = 0; i < 1600; i++) {
      const x = Math.random() * 200 - 100, z = Math.random() * 200 - 100;
      if (distToLanes(x, z) < 4.5) {
        const [cx, cy] = w2c(x, z);
        g.fillStyle = Math.random() > 0.5 ? 'rgba(140,124,84,.4)' : 'rgba(110,98,66,.4)';
        g.beginPath(); g.arc(cx, cy, 1 + Math.random() * 4, 0, 7); g.fill();
      }
    }

    // 基地混凝土停机坪
    [[HE.CFG.BLUE_BASE, '#3d6a8f'], [HE.CFG.RED_BASE, '#8f4a3d']].forEach(([b, edge]) => {
      const [cx, cy] = w2c(b.x, b.z);
      g.fillStyle = '#7c7f80'; g.beginPath(); g.arc(cx, cy, 88, 0, 7); g.fill();
      g.fillStyle = '#8a8d8c'; g.beginPath(); g.arc(cx, cy, 74, 0, 7); g.fill();
      g.strokeStyle = edge; g.lineWidth = 6;
      g.beginPath(); g.arc(cx, cy, 62, 0, 7); g.stroke();
      // H 停机坪标志
      g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 9;
      g.beginPath();
      g.moveTo(cx - 20, cy - 24); g.lineTo(cx - 20, cy + 24);
      g.moveTo(cx + 20, cy - 24); g.lineTo(cx + 20, cy + 24);
      g.moveTo(cx - 20, cy); g.lineTo(cx + 20, cy);
      g.stroke();
    });

    // 边界警戒带
    g.strokeStyle = 'rgba(30,34,28,.9)'; g.lineWidth = 26; g.strokeRect(4, 4, S - 8, S - 8);
    g.strokeStyle = 'rgba(245,197,66,.28)'; g.lineWidth = 3; g.strokeRect(16, 16, S - 32, S - 32);

    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 4;
    return tex;
  }

  /* ---------- 天空 ---------- */
  function makeSky() {
    const cv = document.createElement('canvas'); cv.width = 32; cv.height = 256;
    const g = cv.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#7fa8c9');
    gr.addColorStop(0.5, '#a8c2cf');
    gr.addColorStop(0.78, '#cfd8cf');
    gr.addColorStop(1, '#d8d2b8');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 256);
    const tex = new THREE.CanvasTexture(cv);
    const geo = new THREE.SphereGeometry(420, 24, 12);
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false });
    return new THREE.Mesh(geo, mat);
  }

  /* ---------- 植被 / 军事道具 ---------- */
  const M = (c, opts = {}) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, opts));

  function makePine(scale) {
    const gp = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 2.2, 6), M(0x6b4f33));
    trunk.position.y = 1.1; gp.add(trunk);
    const shades = [0x3d5230, 0x46603a, 0x38492c];
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(2.2 - i * 0.55, 2.4, 7), M(shades[i]));
      cone.position.y = 2.4 + i * 1.5;
      gp.add(cone);
    }
    gp.scale.setScalar(scale);
    return gp;
  }
  function makeBroadTree(scale) {
    const gp = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.6, 6), M(0x71563a));
    trunk.position.y = 1.3; gp.add(trunk);
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(1.6 + Math.random() * 0.7, 7, 5), M(0x4c6338));
      s.position.set((Math.random() - 0.5) * 1.6, 3.2 + Math.random() * 1.2, (Math.random() - 0.5) * 1.6);
      s.scale.y = 0.8; gp.add(s);
    }
    gp.scale.setScalar(scale);
    return gp;
  }
  function makeBush() {
    const gp = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(1.1 + Math.random() * 0.6, 6, 4),
        M(0x33512e, { transparent: true, opacity: 0.92 }));
      s.position.set((Math.random() - 0.5) * 2.4, 0.55, (Math.random() - 0.5) * 2.4);
      s.scale.y = 0.62; gp.add(s);
    }
    return gp;
  }
  function makeRock(scale) {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), M(0x7d7f79));
    r.scale.set(scale, scale * 0.7, scale);
    r.rotation.set(Math.random(), Math.random() * 3, Math.random());
    r.position.y = scale * 0.35;
    return r;
  }
  function makeContainer(color) {
    const gp = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(6, 2.8, 2.6), M(color));
    box.position.y = 1.4; gp.add(box);
    // 瓦楞
    for (let i = -2; i <= 2; i++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.8, 2.7), M(color, {}));
      rib.material.color.multiplyScalar(0.82);
      rib.position.set(i * 1.15, 1.4, 0); gp.add(rib);
    }
    return gp;
  }
  function makeSandbags(radius) {
    const gp = new THREE.Group();
    const n = Math.round(radius * 4);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const bag = new THREE.Mesh(new THREE.SphereGeometry(0.55, 6, 4), M(0x9a8a62));
      bag.scale.set(1.25, 0.55, 0.8);
      bag.position.set(Math.cos(a) * radius, 0.28, Math.sin(a) * radius);
      bag.rotation.y = -a;
      gp.add(bag);
      if (i % 2 === 0) {
        const bag2 = bag.clone();
        bag2.position.y = 0.75; bag2.scale.multiplyScalar(0.92);
        bag2.rotation.y += 0.4; gp.add(bag2);
      }
    }
    return gp;
  }
  function makeTent(color) {
    const gp = new THREE.Group();
    const tent = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2.2, 4), M(color));
    tent.position.y = 1.1; tent.rotation.y = Math.PI / 4;
    gp.add(tent);
    return gp;
  }
  function makeCrate() {
    const c = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), M(0x8a7648));
    c.position.y = 0.7; c.rotation.y = Math.random() * 3;
    return c;
  }
  function makeFlag(teamColor) {
    const gp = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 9, 6), M(0xb9bdc2));
    pole.position.y = 4.5; gp.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.8), M(teamColor, { side: THREE.DoubleSide }));
    flag.position.set(1.5, 7.9, 0); gp.add(flag);
    gp.userData.flag = flag;
    return gp;
  }

  /* ---------- 云 ---------- */
  function makeCloud() {
    const gp = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, fog: false });
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(6 + Math.random() * 7, 7, 5), mat);
      s.position.set(i * 8 - 16 + Math.random() * 5, Math.random() * 3, (Math.random() - 0.5) * 10);
      s.scale.y = 0.4; gp.add(s);
    }
    return gp;
  }

  /* ---------- 主构建 ---------- */
  W.build = function (sc) {
    scene = sc; clouds = [];
    scene.background = null;
    scene.fog = new THREE.Fog(0xb6c2ba, 110, 320);

    scene.add(makeSky());

    // 光照
    const hemi = new THREE.HemisphereLight(0xcfe0ec, 0x55604a, 0.85);
    scene.add(hemi);
    sunLight = new THREE.DirectionalLight(0xfff1d8, 1.25);
    sunLight.position.set(70, 110, 40);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    const sc2 = sunLight.shadow.camera;
    sc2.left = -130; sc2.right = 130; sc2.top = 130; sc2.bottom = -130;
    sc2.near = 20; sc2.far = 300;
    sc2.updateProjectionMatrix();
    sunLight.shadow.bias = -0.0008;
    scene.add(sunLight);
    W.sun = sunLight;

    // 地面
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(HE.CFG.MAP_HALF * 2 + 30, HE.CFG.MAP_HALF * 2 + 30),
      new THREE.MeshLambertMaterial({ map: makeGroundTexture() })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // 河面水体
    waterMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(250, 15),
      new THREE.MeshLambertMaterial({ color: 0x6fa8b8, transparent: true, opacity: 0.45 })
    );
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.rotation.z = Math.PI / 4;
    waterMesh.position.y = 0.05;
    scene.add(waterMesh);

    // 外围山体遮挡
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const r = 150 + Math.random() * 40;
      const h = 18 + Math.random() * 26;
      const hill = new THREE.Mesh(new THREE.ConeGeometry(24 + Math.random() * 18, h, 6), M(0x4a5844));
      hill.position.set(Math.cos(a) * r, h / 2 - 6, Math.sin(a) * r);
      scene.add(hill);
    }

    // 树木（避开兵线/河道/基地/野怪营地）
    const rng = mulberry(20260716);
    let treeShadowBudget = 46;
    for (let i = 0; i < 240; i++) {
      const x = rng() * 196 - 98, z = rng() * 196 - 98;
      if (distToLanes(x, z) < 9.5) continue;
      if (distToRiver(x, z) < 9) continue;
      if (Math.hypot(x - HE.CFG.BLUE_BASE.x, z - HE.CFG.BLUE_BASE.z) < 22) continue;
      if (Math.hypot(x - HE.CFG.RED_BASE.x, z - HE.CFG.RED_BASE.z) < 22) continue;
      if (HE.JUNGLE.some(c => Math.hypot(x - c.x, z - c.z) < 8)) continue;
      const t = rng() > 0.35 ? makePine(0.8 + rng() * 0.9) : makeBroadTree(0.8 + rng() * 0.7);
      t.position.set(x, 0, z);
      t.rotation.y = rng() * Math.PI * 2;
      if (treeShadowBudget > 0) { t.traverse(o => { if (o.isMesh) o.castShadow = true; }); treeShadowBudget--; }
      scene.add(t);
    }

    // 草丛（沿河道与野区入口）
    const bushSpots = [
      [14, -6], [-14, 6], [30, -22], [-30, 22], [52, -46], [-52, 46],
      [-44, -8], [44, 8], [-8, -44], [8, 44],
      [-62, 10], [62, -10], [10, -62], [-10, 62],
      [22, 30], [-22, -30], [30, 58], [-30, -58],
    ];
    bushSpots.forEach(([x, z]) => {
      const b = makeBush(); b.position.set(x, 0, z); scene.add(b);
    });

    // 岩石
    for (let i = 0; i < 26; i++) {
      const x = rng() * 190 - 95, z = rng() * 190 - 95;
      if (distToLanes(x, z) < 8 || distToRiver(x, z) < 5) continue;
      const r = makeRock(0.7 + rng() * 1.6);
      r.position.x = x; r.position.z = z;
      scene.add(r);
    }

    // 军事道具：集装箱 / 帐篷 / 弹药箱
    const containers = [
      [10, 10, 0x8a4a3a, 0.4], [-12, 8, 0x3a6a8a, -0.8], [8, -14, 0x6a7a4a, 1.9],
      [46, 30, 0x8a4a3a, 0.9], [-46, -30, 0x4a5a6a, -0.4],
      [64, -18, 0x7a6a3a, 2.4], [-64, 18, 0x8a4a3a, 0.2],
    ];
    containers.forEach(([x, z, c, ry]) => {
      const box = makeContainer(c); box.position.set(x, 0, z); box.rotation.y = ry;
      box.traverse(o => { if (o.isMesh) o.castShadow = true; });
      scene.add(box);
    });
    [[HE.CFG.BLUE_BASE, 0x2c5a7a], [HE.CFG.RED_BASE, 0x7a3a2c]].forEach(([b, c]) => {
      for (let i = 0; i < 3; i++) {
        const t = makeTent(c);
        const a = i * 2.1 + 0.6;
        t.position.set(b.x + Math.cos(a) * 10, 0, b.z + Math.sin(a) * 10);
        scene.add(t);
      }
      const flag = makeFlag(c === 0x2c5a7a ? 0x3da9fc : 0xff5c5c);
      flag.position.set(b.x, 0, b.z - (b.z > 0 ? -8 : 8) * 0); // 旗杆立于基地边
      flag.position.x += b.x > 0 ? -7 : 7;
      scene.add(flag);
      clouds.push({ flagWave: flag.userData.flag });
    });
    for (let i = 0; i < 14; i++) {
      const x = rng() * 170 - 85, z = rng() * 170 - 85;
      if (distToLanes(x, z) < 6) continue;
      const c = makeCrate(); c.position.x = x; c.position.z = z; scene.add(c);
    }

    // 野怪营地标记（碎石圈）
    HE.JUNGLE.forEach(c => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(3.4, 4.0, 24),
        new THREE.MeshBasicMaterial({ color: c.type === 'tyrant' || c.type === 'overlord' ? 0xc9762f : 0x8a8a72, transparent: true, opacity: 0.4 }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(c.x, 0.06, c.z);
      scene.add(ring);
    });

    // 天上的云
    for (let i = 0; i < 7; i++) {
      const cl = makeCloud();
      cl.position.set(Math.random() * 300 - 150, 70 + Math.random() * 30, Math.random() * 300 - 150);
      cl.userData.speed = 0.6 + Math.random();
      scene.add(cl);
      clouds.push(cl);
    }
  };

  W.tick = function (dt) {
    time += dt;
    if (waterMesh) waterMesh.material.opacity = 0.4 + Math.sin(time * 1.4) * 0.07;
    clouds.forEach(c => {
      if (c.flagWave) { c.flagWave.rotation.y = Math.sin(time * 3) * 0.25; return; }
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 180) c.position.x = -180;
    });
  };

  function mulberry(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  return W;
})();
