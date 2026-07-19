/* =========================================================
   ship.js — 飞船驾驶 / 太阳系空间场景 / 体素球状星球
   ========================================================= */
const Ship = (() => {

  const S = {
    x: 0, y: 0, z: 0,
    vx: 0, vy: 0, vz: 0,
    yaw: 0, pitch: 0,
    active: false,
    fuel: 100,
    nearPlanet: null,
  };

  let scene = null, sunMesh = null, sunCore = null;
  let planetMeshes = {}; // id -> {mesh, def}
  let starPoints = null;
  let novaSphere = null;

  /* ---------- 体素球状星球（太空视角） ---------- */
  function voxelSphereGeo(radius, colors, seed) {
    const pos = [], col = [], idx = [];
    const D = Math.ceil(radius) + 1;
    const c1 = new THREE.Color(colors[0]), c2 = new THREE.Color(colors[1]), c3 = new THREE.Color(colors[2]);
    const cell = new Set();
    const key = (x, y, z) => x + '|' + y + '|' + z;
    for (let z = -D; z <= D; z++) for (let y = -D; y <= D; y++) for (let x = -D; x <= D; x++) {
      const d = Math.sqrt(x * x + y * y + z * z);
      const n = World.hash2(x * 13 + z * 7, y * 11 + z * 3, seed) * 1.6 - 0.8;
      if (d <= radius + n * 0.8 && d > radius - 2.2 + n * 0.5) cell.add(key(x, y, z));
    }
    const has = (x, y, z) => cell.has(key(x, y, z));
    const FACE = [
      [[1,0,0], [[1,0,1],[1,0,0],[1,1,0],[1,1,1]], 0.62],
      [[-1,0,0], [[0,0,0],[0,0,1],[0,1,1],[0,1,0]], 0.62],
      [[0,1,0], [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], 1.0],
      [[0,-1,0], [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], 0.5],
      [[0,0,1], [[0,0,1],[1,0,1],[1,1,1],[0,1,1]], 0.8],
      [[0,0,-1], [[1,0,0],[0,0,0],[0,1,0],[1,1,0]], 0.8],
    ];
    for (const k of cell) {
      const [x, y, z] = k.split('|').map(Number);
      const h = World.hash2(x * 5 + y * 3, z * 9 + y, seed + 1);
      const base = h < 0.55 ? c1 : (h < 0.9 ? c2 : c3);
      for (const [dir, verts, shade] of FACE) {
        if (has(x + dir[0], y + dir[1], z + dir[2])) continue;
        const b = pos.length / 3;
        for (const v of verts) {
          pos.push(x + v[0] - 0.5, y + v[1] - 0.5, z + v[2] - 0.5);
          col.push(base.r * shade, base.g * shade, base.b * shade);
        }
        idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    return g;
  }

  /* ---------- 太空场景 ---------- */
  function buildScene(game) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020208);

    // 星幕
    const starGeo = new THREE.BufferGeometry();
    const sp = [];
    for (let i = 0; i < 1600; i++) {
      const t = Math.random() * Math.PI * 2, p = Math.acos(Math.random() * 2 - 1);
      const r = 9000;
      sp.push(r * Math.sin(p) * Math.cos(t), r * Math.cos(p), r * Math.sin(p) * Math.sin(t));
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    starPoints = new THREE.Points(starGeo, new THREE.PointsMaterial({
      map: game.starTex, size: 26, sizeAttenuation: true, transparent: true, depthWrite: false, color: 0xffffff,
    }));
    scene.add(starPoints);

    // 太阳（方形像素太阳 + 体素球核心）
    const sunGeo = voxelSphereGeo(26, ['#ffdf8a', '#ffb84a', '#fff6d8'], 99);
    sunCore = new THREE.Mesh(sunGeo, new THREE.MeshBasicMaterial({ vertexColors: true }));
    scene.add(sunCore);
    const spriteMat = new THREE.SpriteMaterial({ map: game.sunTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    sunMesh = new THREE.Sprite(spriteMat);
    sunMesh.scale.set(160, 160, 1);
    scene.add(sunMesh);

    // 超新星冲击波
    novaSphere = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0xfff2e0, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
    );
    novaSphere.visible = false;
    scene.add(novaSphere);

    // 星球
    planetMeshes = {};
    for (const def of Object.values(World.PLANETS)) {
      const r = def.N / 8;
      const geo = voxelSphereGeo(r, def.spaceColors, def.N);
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
      scene.add(mesh);
      // 信标光晕（便于远距离发现）
      const beacon = new THREE.Sprite(new THREE.SpriteMaterial({
        map: game.starTex, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, color: new THREE.Color(def.spaceColors[2]), opacity: 0.85,
      }));
      beacon.scale.set(r * 5, r * 5, 1);
      mesh.add(beacon);
      planetMeshes[def.id] = { mesh, def, r };
      if (def.hidden) mesh.visible = false;
    }
    return scene;
  }

  function planetPos(def, loopTime) {
    const a = def.orbitPhase + loopTime * def.orbitSpeed;
    return [Math.cos(a) * def.orbit, 0, Math.sin(a) * def.orbit];
  }

  /* ---------- 起飞 ---------- */
  function launch(fromPlanetDef, loopTime) {
    S.active = true;
    const [px, , pz] = planetPos(fromPlanetDef, loopTime);
    const r = planetMeshes[fromPlanetDef.id].r;
    S.x = px; S.y = r + 30; S.z = pz;
    S.vx = 0; S.vy = 6; S.vz = 0;
    S.yaw = Math.PI; S.pitch = 0;
    S.nearPlanet = null;
  }

  function lookVec() {
    const cp = Math.cos(S.pitch);
    return [Math.sin(S.yaw) * cp * -1, Math.sin(S.pitch), Math.cos(S.yaw) * cp * -1];
  }

  /* ---------- 飞行更新 ---------- */
  function update(dt, game, loopTime) {
    if (!S.active) return;
    const keys = Player.keys;
    const [fx, fy, fz] = lookVec();
    const sy = Math.sin(S.yaw), cy = Math.cos(S.yaw);
    const rx = cy, rz = -sy;

    let thrust = 0;
    let ax = 0, ay = 0, az = 0;
    const power = 42;
    if (keys.KeyW) { ax += fx * power; ay += fy * power; az += fz * power; thrust = 1; }
    if (keys.KeyS) { ax -= fx * power * 0.6; ay -= fy * power * 0.6; az -= fz * power * 0.6; thrust = Math.max(thrust, 0.5); }
    if (keys.KeyA) { ax -= rx * power * 0.5; az -= rz * power * 0.5; thrust = Math.max(thrust, 0.4); }
    if (keys.KeyD) { ax += rx * power * 0.5; az += rz * power * 0.5; thrust = Math.max(thrust, 0.4); }
    if (keys.Space) { ay += power * 0.5; thrust = Math.max(thrust, 0.4); }
    if (keys.ControlLeft || keys.KeyC) { ay -= power * 0.5; thrust = Math.max(thrust, 0.4); }
    if (keys.KeyX) { // 刹车
      ax -= S.vx * 2; ay -= S.vy * 2; az -= S.vz * 2;
      thrust = Math.max(thrust, Math.min(1, Math.hypot(S.vx, S.vy, S.vz) / 30));
    }

    S.vx += ax * dt; S.vy += ay * dt; S.vz += az * dt;
    const spd = Math.hypot(S.vx, S.vy, S.vz);
    const maxSpd = 120;
    if (spd > maxSpd) { S.vx *= maxSpd / spd; S.vy *= maxSpd / spd; S.vz *= maxSpd / spd; }
    S.x += S.vx * dt; S.y += S.vy * dt; S.z += S.vz * dt;

    Audio2.engine(true, thrust);

    // 更新星球轨道位置
    S.nearPlanet = null;
    let nearest = null, nearestD = 1e9;
    for (const pm of Object.values(planetMeshes)) {
      const [px, py, pz] = planetPos(pm.def, loopTime);
      pm.mesh.position.set(px, py, pz);
      pm.mesh.rotation.y += dt * 0.02;
      if (pm.def.hidden && !game.eyeUnlocked()) { pm.mesh.visible = false; continue; }
      pm.mesh.visible = true;
      const d = Math.hypot(S.x - px, S.y - py, S.z - pz);
      if (d < nearestD) { nearestD = d; nearest = pm; }
      if (d < pm.r + 60) S.nearPlanet = pm.def;
    }
    S.nearestInfo = nearest ? { def: nearest.def, dist: nearestD } : null;

    // 太阳碰撞
    const sunDist = Math.hypot(S.x, S.y, S.z);
    const sunR = game.novaRadius ? game.novaRadius() : 30;
    if (sunDist < sunR + 26) game.onDeath('你坠入了太阳……');

    sunMesh.position.set(0, 0, 0);
    starPoints.position.set(S.x, S.y, S.z);
  }

  function updateSun(novaProgress, redness) {
    if (!sunCore) return;
    const s = 1 + redness * 1.6;
    sunCore.scale.set(s, s, s);
    sunMesh.scale.set(160 * (1 + redness * 2.2), 160 * (1 + redness * 2.2), 1);
    if (novaProgress > 0) {
      novaSphere.visible = true;
      const r = 30 + novaProgress * 6000;
      novaSphere.scale.set(r, r, r);
      novaSphere.material.opacity = Math.max(0, 0.95 - novaProgress * 0.55);
    } else novaSphere.visible = false;
  }

  function applyCamera(camera) {
    camera.position.set(S.x, S.y, S.z);
    camera.rotation.set(0, 0, 0);
    camera.rotateY(S.yaw);
    camera.rotateX(S.pitch);
  }

  function onMouseMove(dx, dy) {
    S.yaw -= dx * 0.0022;
    S.pitch -= dy * 0.0022;
    S.pitch = Math.max(-1.5, Math.min(1.5, S.pitch));
  }

  /* ---------- 地面飞船外观（由弯曲材质盒子组成） ---------- */
  function buildSurfaceShip(world, atlasTex) {
    const g = new THREE.Group();
    const mat = World.makeCurvedMaterial(atlasTex, world.uniforms, { cutoff: 0.5 });
    const add = (w, h, d, tiles, x, y, z) => {
      const m = new THREE.Mesh(World.makeBoxGeo(w, h, d, tiles), mat);
      m.position.set(x, y, z);
      m.frustumCulled = false;
      g.add(m);
    };
    const p = world.shipPos;
    const bx = p.x + 0.5, by = p.y, bz = p.z + 0.5;
    // 舱体
    add(3, 2.2, 3, 'hull', bx, by + 2.1, bz);
    // 驾驶舱玻璃
    add(2.2, 1.4, 0.3, 'glass', bx, by + 2.4, bz - 1.6);
    // 鼻锥
    add(2, 1.4, 1, 'metal', bx, by + 1.8, bz - 2);
    // 尾部引擎
    add(2.4, 1.6, 1.2, { px: 'metal_dark', nx: 'metal_dark', py: 'metal_dark', ny: 'engine', pz: 'engine', nz: 'metal_dark' }, bx, by + 1.4, bz + 2);
    // 起落架
    add(0.4, 1.2, 0.4, 'metal_dark', bx - 1.2, by + 0.6, bz - 1.2);
    add(0.4, 1.2, 0.4, 'metal_dark', bx + 1.2, by + 0.6, bz - 1.2);
    add(0.4, 1.2, 0.4, 'metal_dark', bx - 1.2, by + 0.6, bz + 1.2);
    add(0.4, 1.2, 0.4, 'metal_dark', bx + 1.2, by + 0.6, bz + 1.2);
    // 舱门灯
    add(0.6, 0.6, 0.6, 'glowlamp', bx - 1.8, by + 1.6, bz);
    g.userData.mat = mat;
    return g;
  }

  return { S, buildScene, launch, update, updateSun, applyCamera, onMouseMove, buildSurfaceShip, planetPos, voxelSphereGeo,
    get planetMeshes() { return planetMeshes; } };
})();
