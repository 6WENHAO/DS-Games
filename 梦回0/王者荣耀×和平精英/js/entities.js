/* ================================================================
   荣耀精英 — 实体系统
   士兵建模（和平精英风）/ 英雄技能 / 兵线 / 哨塔 / 水晶 / 野怪
   弹道与粒子特效
   ================================================================ */

/* ================= 粒子特效 ================= */
HE.FX = (function () {
  let scene = null;
  const parts = [];
  const Lam = (c, o = {}) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o));
  const Bas = (c, o = {}) => new THREE.MeshBasicMaterial(Object.assign({ color: c, transparent: true }, o));

  function init(sc) { scene = sc; parts.length = 0; }
  function push(mesh, opt) {
    scene.add(mesh);
    parts.push(Object.assign({ mesh, t: 0, life: 1, vel: null, grow: 0, spin: 0, gravity: 0 }, opt));
  }
  function burst(pos, color, n, speed, size, life, gravity = -9) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), Bas(color, { opacity: 1 }));
      m.position.copy(pos);
      const a = Math.random() * Math.PI * 2, up = Math.random() * speed;
      push(m, { life, vel: new THREE.Vector3(Math.cos(a) * speed * Math.random(), up, Math.sin(a) * speed * Math.random()), gravity, spin: Math.random() * 6 });
    }
  }
  function muzzle(pos, dir) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 5, 4), Bas(0xffdf8a, { opacity: 0.95 }));
    m.position.copy(pos).addScaledVector(dir, 0.3);
    push(m, { life: 0.06, grow: 9 });
  }
  function hitSpark(pos, color = 0xffcc66) { burst(pos, color, 5, 4, 0.14, 0.3); }
  function explosion(pos, radius, color = 0xff9944) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), Bas(color, { opacity: 0.85 }));
    s.position.copy(pos); s.position.y += 0.6;
    push(s, { life: 0.35, grow: radius * 5.2 });
    const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), Bas(0xfff2c0, { opacity: 0.9 }));
    s2.position.copy(s.position);
    push(s2, { life: 0.2, grow: radius * 3.2 });
    burst(pos, 0x333333, 8, 5, 0.35, 0.9, -3);
    burst(pos, color, 10, 7, 0.2, 0.5);
    ring(pos, radius, color, 0.4);
  }
  function ring(pos, radius, color, life = 0.5) {
    const r = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.62, 26), Bas(color, { opacity: 0.8, side: THREE.DoubleSide }));
    r.rotation.x = -Math.PI / 2; r.position.copy(pos); r.position.y = 0.15;
    push(r, { life, grow: radius * 4.5 });
  }
  function healGlow(pos) {
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.16), Bas(0x7fe8a8, { opacity: 0.9 }));
      m.position.set(pos.x + (Math.random() - 0.5) * 1.6, 0.4 + Math.random(), pos.z + (Math.random() - 0.5) * 1.6);
      push(m, { life: 0.9, vel: new THREE.Vector3(0, 2.6, 0), gravity: 0 });
    }
  }
  function levelUp(pos) {
    ring(pos, 3, 0xf5c542, 0.7);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 5, 10, 1, true), Bas(0xf5c542, { opacity: 0.5, side: THREE.DoubleSide }));
    pillar.position.copy(pos); pillar.position.y = 2.5;
    push(pillar, { life: 0.7, grow: 0.5 });
    burst(pos, 0xffe08a, 12, 5, 0.16, 0.8, 2);
  }
  function smokePuff(pos, r, life = 1.2) {
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r * (0.35 + Math.random() * 0.3), 6, 5), Bas(0x9aa0a2, { opacity: 0.4 }));
      m.position.set(pos.x + (Math.random() - 0.5) * r, 0.8 + Math.random() * 1.4, pos.z + (Math.random() - 0.5) * r);
      push(m, { life, grow: 1.6, vel: new THREE.Vector3(0, 0.7, 0) });
    }
  }
  function flame(pos, r) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.9 + Math.random() * 0.6, 5),
      Bas(Math.random() > 0.5 ? 0xff8a3c : 0xffc23c, { opacity: 0.85 }));
    m.position.set(pos.x + (Math.random() - 0.5) * r * 1.7, 0.4, pos.z + (Math.random() - 0.5) * r * 1.7);
    push(m, { life: 0.45, vel: new THREE.Vector3(0, 3, 0) });
  }
  function recallBeam(pos) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 7, 12, 1, true), Bas(0x6fc4ff, { opacity: 0.35, side: THREE.DoubleSide }));
    p.position.copy(pos); p.position.y = 3.5;
    push(p, { life: 0.5, spin: 2 });
  }
  function deathBurst(pos, teamColor) {
    burst(pos, teamColor, 14, 6, 0.22, 0.8);
    ring(pos, 2.5, teamColor, 0.5);
  }
  function bulletShell(pos) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.06), Bas(0xd8b34a, { opacity: 1 }));
    m.position.copy(pos);
    push(m, { life: 0.5, vel: new THREE.Vector3((Math.random() - 0.5) * 3, 2.5, (Math.random() - 0.5) * 3), gravity: -12, spin: 8 });
  }
  function update(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.t += dt;
      if (p.t >= p.life) { scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); parts.splice(i, 1); continue; }
      const k = p.t / p.life;
      if (p.vel) {
        p.vel.y += (p.gravity || 0) * dt;
        p.mesh.position.addScaledVector(p.vel, dt);
      }
      if (p.grow) { const s = 1 + p.grow * k; p.mesh.scale.setScalar(s); }
      if (p.spin) p.mesh.rotation.y += p.spin * dt;
      if (p.mesh.material.opacity !== undefined) p.mesh.material.opacity = (1 - k) * (p.mesh.material.userData?.o0 ?? 1) * 0.9;
    }
  }
  return { init, update, muzzle, hitSpark, explosion, ring, healGlow, levelUp, smokePuff, flame, recallBeam, deathBurst, burst, bulletShell, Lam, Bas };
})();

/* ================= 实体 ================= */
HE.Entities = (function () {
  const E = {};
  const Lam = (c, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
  const TEAM_COLOR = { blue: 0x3da9fc, red: 0xff5c5c };
  const G = () => HE.Game.G;

  /* ---------------- 枪械建模 ---------------- */
  function buildGun(type) {
    const g = new THREE.Group();
    const dark = Lam(0x23262a), wood = Lam(0x5a4632), metal = Lam(0x3a3f45);
    function box(w, h, d, mat, x, y, z) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z); g.add(m); return m;
    }
    let tip = 0.9;
    if (type === 'rifle') {          // M416
      box(0.09, 0.13, 1.0, dark, 0, 0, 0.25);
      box(0.07, 0.07, 0.5, metal, 0, 0.02, 0.85);
      box(0.08, 0.22, 0.16, dark, 0, -0.16, 0.18);        // 弹匣
      box(0.09, 0.12, 0.3, wood, 0, -0.01, -0.32);        // 枪托
      box(0.05, 0.06, 0.18, metal, 0, 0.1, 0.3);          // 瞄具
      tip = 1.12;
    } else if (type === 'shotgun') { // S686
      box(0.16, 0.14, 0.95, metal, 0, 0.01, 0.28);
      box(0.16, 0.1, 0.35, wood, 0, -0.04, -0.3);
      box(0.1, 0.1, 0.4, dark, 0, -0.09, 0.35);
      tip = 0.78;
    } else if (type === 'smg') {     // UZI / Vector
      box(0.09, 0.14, 0.6, dark, 0, 0, 0.12);
      box(0.07, 0.3, 0.12, dark, 0, -0.2, 0.06);
      box(0.05, 0.05, 0.25, metal, 0, 0.02, 0.48);
      tip = 0.62;
    } else if (type === 'launcher') {// 榴弹发射器
      box(0.2, 0.2, 0.85, Lam(0x4a5240), 0, 0, 0.2);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.5, 8), metal);
      tube.rotation.x = Math.PI / 2; tube.position.set(0, 0, 0.6); g.add(tube);
      box(0.1, 0.16, 0.3, dark, 0, -0.05, -0.3);
      tip = 0.9;
    } else if (type === 'sniper') {  // AWM
      box(0.09, 0.13, 1.3, Lam(0x5a6248), 0, 0, 0.3);
      box(0.06, 0.09, 0.4, metal, 0, 0.11, 0.25);
      box(0.09, 0.14, 0.34, Lam(0x5a6248), 0, -0.02, -0.4);
      tip = 1.3;
    } else if (type === 'mg') {      // 哨塔机枪
      box(0.22, 0.26, 1.5, metal, 0, 0, 0.3);
      box(0.1, 0.1, 0.9, dark, 0, -0.0, 1.0);
      box(0.3, 0.4, 0.4, dark, 0, -0.1, -0.5);
      tip = 1.5;
    }
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.01, tip);
    g.add(muzzle); g.userData.muzzle = muzzle;
    return g;
  }
  E.buildGun = buildGun;

  /* ---------------- 士兵建模（和平精英风格） ---------------- */
  function buildSoldier(def, team, scale = 1.15) {
    const gp = new THREE.Group();
    const uniform = Lam(def.color), uniformD = Lam(new THREE.Color(def.color).multiplyScalar(0.75).getHex());
    const skin = Lam(def.skin || 0xd0aa82), accent = Lam(def.accent || 0x888888);
    const parts = {};
    const body = new THREE.Group(); gp.add(body); parts.body = body;

    // 腿（髋部为轴心）
    function limb(w, h, d, mat, x, y) {
      const pivot = new THREE.Group(); pivot.position.set(x, y, 0);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.y = -h / 2; pivot.add(m); body.add(pivot);
      return pivot;
    }
    parts.legL = limb(0.34, 0.95, 0.36, uniformD, -0.24, 0.95);
    parts.legR = limb(0.34, 0.95, 0.36, uniformD, 0.24, 0.95);
    // 靴子
    [parts.legL, parts.legR].forEach(l => {
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.18, 0.48), Lam(0x2a2622));
      boot.position.set(0, -0.9, 0.05); l.add(boot);
    });
    // 躯干 + 防弹衣
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.15, 0.6), uniform);
    torso.position.y = 1.55; body.add(torso); parts.torso = torso;
    const vest = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.72, 0.68), Lam(0x3a3d33));
    vest.position.y = 1.5; body.add(vest);
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.12), accent);
    pouch.position.set(-0.2, 1.38, 0.38); body.add(pouch);
    // 背包
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.85, 0.34), uniformD);
    pack.position.set(0, 1.6, -0.48); body.add(pack);
    // 头 + 头盔
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.5, 0.5), skin);
    head.position.y = 2.42; body.add(head); parts.head = head;
    const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.34, 0.62), Lam(0x424a38));
    helmet.position.y = 2.62; body.add(helmet);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.2), Lam(0x424a38));
    brim.position.set(0, 2.48, 0.36); body.add(brim);
    // 手臂
    parts.armL = limb(0.26, 0.85, 0.28, uniform, -0.68, 2.05);
    parts.armR = limb(0.26, 0.85, 0.28, uniform, 0.68, 2.05);
    // 持枪（挂在右臂前）
    const gun = buildGun(def.gun || 'rifle');
    gun.position.set(0.32, 1.72, 0.52);
    body.add(gun); parts.gun = gun; parts.muzzle = gun.userData.muzzle;
    // 端枪姿势
    parts.armL.rotation.x = -0.9; parts.armL.rotation.y = 0.5;
    parts.armR.rotation.x = -1.05;
    // 队伍标识环
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.05, 24),
      new THREE.MeshBasicMaterial({ color: TEAM_COLOR[team] || 0xffffff, transparent: true, opacity: 0.75, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06;
    gp.add(ring); parts.ring = ring;
    // 队伍臂章
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.05), Lam(TEAM_COLOR[team] || 0xffffff));
    badge.position.set(-0.68, 2.0, 0.16); body.add(badge);

    gp.scale.setScalar(scale);
    gp.userData.parts = parts;
    gp.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return gp;
  }
  E.buildSoldier = buildSoldier;

  /* ---------------- 哨塔（防御塔） ---------------- */
  function buildTower(team) {
    const gp = new THREE.Group();
    const c = TEAM_COLOR[team];
    const conc = Lam(0x7f8382), metal = Lam(0x4a4f55);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.1, 1.2, 10), conc);
    base.position.y = 0.6; gp.add(base);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 5.2, 0.35), metal);
      leg.position.set(Math.cos(a) * 1.7, 3.4, Math.sin(a) * 1.7);
      leg.rotation.z = Math.cos(a) * 0.12; leg.rotation.x = -Math.sin(a) * 0.12;
      gp.add(leg);
    }
    const platform = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.35, 3.6), metal);
    platform.position.y = 6; gp.add(platform);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 2.6), Lam(0x5c6355));
    cabin.position.y = 7; gp.add(cabin);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.3, 1.1, 4), Lam(0x3f4a3a));
    roof.position.y = 8.4; roof.rotation.y = Math.PI / 4; gp.add(roof);
    // 旋转炮台
    const turret = new THREE.Group(); turret.position.y = 6.4;
    const gun = buildGun('mg'); gun.position.set(0, 0.6, 0.9);
    turret.add(gun); gp.add(turret);
    // 团队警示灯
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6),
      new THREE.MeshBasicMaterial({ color: c }));
    lamp.position.y = 9.2; gp.add(lamp);
    const ring = new THREE.Mesh(new THREE.RingGeometry(15.7, 16, 48),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.12, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; gp.add(ring);
    gp.add(HE.World && makeSandbagRing ? makeSandbagRing() : new THREE.Group());
    gp.userData = { turret, muzzle: gun.userData.muzzle, lamp };
    gp.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return gp;
  }
  function makeSandbagRing() {
    const gp = new THREE.Group();
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const bag = new THREE.Mesh(new THREE.SphereGeometry(0.5, 6, 4), Lam(0x9a8a62));
      bag.scale.set(1.3, 0.55, 0.85);
      bag.position.set(Math.cos(a) * 3.6, 0.26, Math.sin(a) * 3.6);
      bag.rotation.y = -a; gp.add(bag);
    }
    return gp;
  }

  /* ---------------- 水晶（能源核心） ---------------- */
  function buildCrystal(team) {
    const gp = new THREE.Group();
    const c = TEAM_COLOR[team];
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.8, 0.9, 12), Lam(0x74787a));
    pad.position.y = 0.45; gp.add(pad);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      const py = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.4, 0.5), Lam(0x4a4f55));
      py.position.set(Math.cos(a) * 3.2, 2.6, Math.sin(a) * 3.2);
      gp.add(py);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 5), new THREE.MeshBasicMaterial({ color: c }));
      tip.position.set(Math.cos(a) * 3.2, 4.95, Math.sin(a) * 3.2);
      gp.add(tip);
    }
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7, 0),
      new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.55 }));
    core.position.y = 3.4; gp.add(core);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(2.3, 10, 8),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.14 }));
    glow.position.y = 3.4; gp.add(glow);
    gp.userData = { core, glow };
    gp.traverse(o => { if (o.isMesh && o !== glow) o.castShadow = true; });
    return gp;
  }

  /* ---------------- 野怪（机械兽） ---------------- */
  function buildMonster(type) {
    const gp = new THREE.Group();
    const conf = {
      redbuff:  { c: 0x8a3428, e: 0xff5c3c, s: 1.0 },
      bluebuff: { c: 0x2c4a6a, e: 0x3da9fc, s: 1.0 },
      tyrant:   { c: 0x6a4a28, e: 0xff9a2c, s: 2.0 },
      overlord: { c: 0x3c2c5a, e: 0xb06aff, s: 2.4 },
    }[type];
    const bodyMat = Lam(conf.c);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 2.6), bodyMat);
    body.position.y = 1.3; gp.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.9, 1.0), bodyMat);
    head.position.set(0, 1.6, 1.6); gp.add(head);
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), new THREE.MeshBasicMaterial({ color: conf.e }));
    eyeL.position.set(-0.24, 1.7, 2.1); gp.add(eyeL);
    const eyeR = eyeL.clone(); eyeR.position.x = 0.24; gp.add(eyeR);
    const legs = [];
    for (let i = 0; i < 4; i++) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.3, 0.3), Lam(0x33363a));
      leg.position.set(i < 2 ? -0.75 : 0.75, 0.65, i % 2 ? 0.9 : -0.9);
      gp.add(leg); legs.push(leg);
    }
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 5), new THREE.MeshBasicMaterial({ color: conf.e }));
    spike.position.set(0, 2.3, 0); gp.add(spike);
    gp.scale.setScalar(conf.s);
    gp.userData = { legs, eye: conf.e };
    gp.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return gp;
  }

  /* ---------------- 空投箱 / 降落伞 ---------------- */
  function buildParachute(color = 0xe8e2d0) {
    const gp = new THREE.Group();
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(2.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.4),
      Lam(color, { side: THREE.DoubleSide })
    );
    canopy.position.y = 4.6; gp.add(canopy);
    const strMat = new THREE.LineBasicMaterial({ color: 0x9a9a8a });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(Math.cos(a) * 1.9, 4.2, Math.sin(a) * 1.9),
        new THREE.Vector3(0, 1.2, 0),
      ]);
      gp.add(new THREE.Line(geo, strMat));
    }
    return gp;
  }
  E.buildParachute = buildParachute;
  function buildAirdropCrate() {
    const gp = new THREE.Group();
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 1.8), Lam(0x4a5d3f));
    crate.position.y = 0.7; gp.add(crate);
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.3, 1.86), Lam(0xd8d2c0));
    band.position.y = 0.7; gp.add(band);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff4433 }));
    lamp.position.y = 1.55; gp.add(lamp);
    const chute = buildParachute(0xd85c3c);
    gp.add(chute);
    gp.userData = { chute, lamp };
    gp.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return gp;
  }

  /* ================= 单位基类 ================= */
  let UID = 1;
  class Unit {
    constructor(team, x, z) {
      this.id = UID++;
      this.team = team;
      this.pos = new THREE.Vector3(x, 0, z);
      this.group = new THREE.Group();
      this.group.position.copy(this.pos);
      this.alive = true; this.dead = false;
      this.kind = 'unit'; this.isHero = false; this.isBuilding = false;
      this.radius = 1;
      this.maxHp = 100; this.hp = 100;
      this.atk = 50; this.def = 30;
      this.atkSpd = 1; this.range = 8; this.speed = 8;
      this.crit = 0; this.gunType = 'rifle';
      this.atkTimer = 0;
      this.target = null;
      this.stunT = 0; this.slowT = 0; this.slowPct = 0;
      this.dots = [];
      this.shield = 0; this.shieldT = 0;
      this.walkPhase = 0; this.moving = false;
      this.recentDamagers = [];
      this.name = '';
      this.aggroT = 0;
    }
    get x() { return this.pos.x; } get z() { return this.pos.z; }
    get speedNow() {
      let s = this.speed;
      if (this.slowT > 0) s *= (1 - this.slowPct);
      return s;
    }
    get atkSpdNow() { return this.atkSpd; }
    distTo(u) { return Math.hypot(u.x - this.x, u.z - this.z); }
    faceTo(x, z) {
      this.facing = Math.atan2(x - this.x, z - this.z);
      this.group.rotation.y = this.facing;
    }
    moveToward(x, z, dt) {
      if (this.stunT > 0) return false;
      const dx = x - this.x, dz = z - this.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.15) return false;
      const step = Math.min(d, this.speedNow * dt);
      this.pos.x += dx / d * step; this.pos.z += dz / d * step;
      const H = HE.CFG.MAP_HALF - 2;
      this.pos.x = Math.max(-H, Math.min(H, this.pos.x));
      this.pos.z = Math.max(-H, Math.min(H, this.pos.z));
      this.faceTo(x, z);
      this.moving = true;
      this.walkPhase += dt * this.speedNow * 1.35;
      return true;
    }
    applySlow(pct, t) { if (pct >= this.slowPct || this.slowT <= 0) { this.slowPct = pct; this.slowT = Math.max(this.slowT, t); } }
    applyStun(t) { this.stunT = Math.max(this.stunT, t); }
    applyDot(dps, t, src, type) { this.dots.push({ dps, t, src, type }); }
    addShield(v, t) { this.shield += v; this.shieldT = Math.max(this.shieldT, t); }
    takeDamage(amount, src, opts = {}) {
      if (!this.alive) return 0;
      let dmg = amount * 100 / (100 + Math.max(0, this.def));
      if (opts.trueDmg) dmg = amount;
      if (this.dmgReduction) dmg *= (1 - this.dmgReduction);
      if (this.shield > 0) {
        const absorbed = Math.min(this.shield, dmg);
        this.shield -= absorbed; dmg -= absorbed;
      }
      dmg = Math.max(0, dmg);
      this.hp -= dmg;
      if (src && src.isHero) {
        this.recentDamagers = this.recentDamagers.filter(r => r.hero !== src);
        this.recentDamagers.push({ hero: src, t: HE.Game.G.time });
        if (src.isPlayer) src.dmgDealt += dmg;
      }
      if (this.onDamaged) this.onDamaged(src, dmg, opts);
      if (this.hp <= 0) { this.hp = 0; this.die(src); }
      return dmg;
    }
    heal(v) {
      if (!this.alive) return;
      const before = this.hp;
      this.hp = Math.min(this.maxHp, this.hp + v);
      return this.hp - before;
    }
    die(src) {
      this.alive = false; this.hp = 0;
      HE.Game.onUnitDeath(this, src);
    }
    updateStatus(dt) {
      if (this.stunT > 0) this.stunT -= dt;
      if (this.slowT > 0) { this.slowT -= dt; if (this.slowT <= 0) this.slowPct = 0; }
      if (this.shieldT > 0) { this.shieldT -= dt; if (this.shieldT <= 0) this.shield = 0; }
      for (let i = this.dots.length - 1; i >= 0; i--) {
        const d = this.dots[i];
        d.t -= dt;
        this.takeDamage(d.dps * dt, d.src, { trueDmg: false, silent: true });
        if (d.t <= 0) this.dots.splice(i, 1);
        if (!this.alive) return;
      }
      const now = HE.Game.G.time;
      this.recentDamagers = this.recentDamagers.filter(r => now - r.t < 8);
    }
    syncMesh() {
      this.group.position.set(this.pos.x, this.pos.y || 0, this.pos.z);
    }
    animate(dt) {
      const p = this.group.userData.parts;
      if (!p) return;
      if (this.moving) {
        const s = Math.sin(this.walkPhase);
        p.legL.rotation.x = s * 0.75;
        p.legR.rotation.x = -s * 0.75;
      } else {
        p.legL.rotation.x *= 0.8; p.legR.rotation.x *= 0.8;
      }
      if (this.recoilT > 0) {
        this.recoilT -= dt;
        p.gun.position.z = 0.52 - this.recoilT * 0.8;
      }
      this.moving = false;
    }
    // 发射普攻弹道
    shoot(target, dmgMult = 1, opts = {}) {
      const start = new THREE.Vector3(this.x, 1.9 * (this.modelScale || 1.15) / 1.15, this.z);
      const p = this.group.userData.parts;
      if (p && p.muzzle) p.muzzle.getWorldPosition(start);
      this.faceTo(target.x, target.z);
      this.recoilT = 0.12;
      const dir = new THREE.Vector3(target.x - this.x, 0, target.z - this.z).normalize();
      HE.FX.muzzle(start, dir);
      if (this.isHero) HE.FX.bulletShell(start);
      const gun = this.gunType;
      const sMap = { rifle: 'shot_rifle', smg: 'shot_smg', shotgun: 'shot_shotgun', launcher: 'shot_launcher', sniper: 'shot_sniper', mg: 'tower_shot' };
      HE.Audio.sfx(sMap[gun] || 'shot_rifle', { at: this.pos });
      let isCrit = Math.random() < (this.crit || 0);
      if (this.nextCrit) { isCrit = true; this.nextCrit = false; }
      let dmg = this.atk * dmgMult * (isCrit ? 1.75 : 1);
      const pellets = gun === 'shotgun' ? 3 : 1;
      for (let i = 0; i < pellets; i++) {
        new Projectile({
          src: this, start: start.clone(), target,
          speed: gun === 'launcher' ? 24 : 70,
          arc: gun === 'launcher',
          color: gun === 'launcher' ? 0xffaa44 : 0xffe0a0,
          spread: pellets > 1 ? 1.2 : 0,
          onHit: (t) => {
            const dealt = t.takeDamage(dmg / pellets, this, { isCrit });
            HE.FX.hitSpark(new THREE.Vector3(t.x, 1.4, t.z));
            HE.Audio.sfx(t.isBuilding ? 'hit' : 'hit_flesh', { at: t.pos, vol: 0.8 });
            if (gun === 'launcher') { HE.FX.explosion(new THREE.Vector3(t.x, 0.4, t.z), 1.6); }
            if (this.isPlayer || (t.isHero && t.isPlayer)) HE.UI.floatDmg(t, dealt, isCrit, t.isPlayer);
            if (this.buffs && this.buffs.red) t.applyDot(40, 2, this, 'burn'), t.applySlow(0.25, 1);
            if (this.poisonShots > 0) { this.poisonShots--; t.applyDot(this.poisonDps || 60, 3, this, 'poison'); t.applySlow(0.2, 1.5); HE.Audio.sfx('poison', { at: t.pos, vol: 0.5 }); }
            if (opts.onHit) opts.onHit(t, dealt);
          },
        });
      }
    }
  }
  E.Unit = Unit;

  /* ================= 弹道 ================= */
  class Projectile {
    constructor(o) {
      this.src = o.src; this.target = o.target; this.point = o.point;
      this.speed = o.speed || 60; this.onHit = o.onHit; this.onLand = o.onLand;
      this.arc = o.arc; this.t = 0; this.dead = false;
      this.pos = o.start.clone();
      this.startPos = o.start.clone();
      const len = o.arc ? 0.3 : 0.9;
      this.mesh = new THREE.Mesh(
        o.arc ? new THREE.SphereGeometry(0.18, 6, 5) : new THREE.BoxGeometry(0.07, 0.07, len),
        new THREE.MeshBasicMaterial({ color: o.color || 0xffe0a0 })
      );
      this.mesh.position.copy(this.pos);
      if (o.spread && this.target) {
        this.spreadOff = { x: (Math.random() - 0.5) * o.spread, z: (Math.random() - 0.5) * o.spread };
      }
      if (this.arc) {
        const dst = this.target ? new THREE.Vector3(this.target.x, 0, this.target.z) : this.point.clone();
        this.arcDur = Math.max(0.35, this.startPos.distanceTo(dst) / this.speed);
        this.dst = dst;
      }
      HE.Game.G.scene.add(this.mesh);
      HE.Game.G.projectiles.push(this);
    }
    kill() { this.dead = true; HE.Game.G.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
    update(dt) {
      if (this.dead) return;
      this.t += dt;
      if (this.arc) {
        // 抛物线（榴弹/医疗包）
        if (this.target && this.target.alive) this.dst.set(this.target.x, 0, this.target.z);
        const k = Math.min(1, this.t / this.arcDur);
        this.pos.lerpVectors(this.startPos, this.dst, k);
        this.pos.y = 1.2 + Math.sin(k * Math.PI) * (4 + this.arcDur * 3);
        this.mesh.position.copy(this.pos);
        if (k >= 1) {
          if (this.onLand) this.onLand(this.dst);
          if (this.target && this.target.alive && this.onHit) this.onHit(this.target);
          this.kill();
        }
        return;
      }
      // 追踪弹
      if (!this.target || !this.target.alive) { this.kill(); return; }
      const ty = 1.2 + (this.target.isBuilding ? 2.5 : 0);
      const tp = new THREE.Vector3(this.target.x + (this.spreadOff?.x || 0), ty, this.target.z + (this.spreadOff?.z || 0));
      const dir = tp.clone().sub(this.pos);
      const d = dir.length();
      const step = this.speed * dt;
      if (d <= step + this.target.radius * 0.4) {
        if (this.onHit) this.onHit(this.target);
        this.kill(); return;
      }
      dir.normalize();
      this.pos.addScaledVector(dir, step);
      this.mesh.position.copy(this.pos);
      this.mesh.lookAt(tp);
    }
  }
  E.Projectile = Projectile;

  /* ================= 英雄 ================= */
  class Hero extends Unit {
    constructor(def, team, isPlayer, botName) {
      super(team, 0, 0);
      this.kind = 'hero'; this.isHero = true;
      this.def = 0;
      this.heroDef = def;
      this.name = botName || def.name;
      this.isPlayer = !!isPlayer;
      this.gunType = def.gun;
      this.radius = 1.2;
      this.level = 1; this.xp = 0; this.gold = HE.CFG.START_GOLD;
      this.items = [];
      this.kda = { k: 0, d: 0, a: 0 }; this.cs = 0; this.dmgDealt = 0;
      this.streak = 0; this.multiKill = 0; this.multiKillT = 0;
      this.skills = def.skills.map(() => ({ lv: 0, cd: 0 }));
      this.skillPoints = 1;
      this.flashCd = 0; this.healCd = 0;
      this.buffs = {};
      this.mp = 0;
      this.respawnT = 0;
      this.recallT = -1;
      this.dropping = 0;   // 跳伞中
      this.channel = null; this.mortar = null;
      this.poisonShots = 0;
      this.group = buildSoldier(def, team, def.id === 'thunder' ? 1.3 : 1.15);
      this.modelScale = def.id === 'thunder' ? 1.3 : 1.15;
      this.autoLevelSkill();
      this.computeStats(true);
      this.hp = this.maxHp; this.mp = this.maxMp;
    }
    computeStats(init) {
      const s = this.heroDef.stats, lv = this.level - 1;
      let hp = s.hp + s.hpG * lv, mp = s.mp + s.mpG * lv;
      let atk = s.atk + s.atkG * lv, def = s.def + s.defG * lv;
      let atkSpd = s.atkSpd * (1 + 0.02 * lv), speed = s.speed;
      let crit = 0, cdr = 0, regen = s.regen + lv * 1.5, regenMp = s.regenMp + lv * 0.5, ms = 0;
      this.items.forEach(it => {
        atk += it.atk || 0; hp += it.hp || 0; def += it.def || 0;
        atkSpd += (it.spd || 0) * s.atkSpd; crit += it.crit || 0; cdr += it.cdr || 0;
        regen += it.regen || 0; ms += it.ms || 0;
      });
      if (this.buffs.blue) { cdr += 0.2; regenMp += 12; }
      if (this.buffs.awm) atk *= 1.5;
      if (this.buffs.ammo) atkSpd *= 1.6;
      if (this.buffs.adrenaline) ms += 0.3;
      if (this.buffs.overlord) atk *= 1.1;
      this.dmgReduction = (this.buffs.suit3 ? 0.4 : 0) + (this.buffs.rescue ? 0.25 : 0);
      const oldMax = this.maxHp || hp;
      this.maxHp = hp; this.maxMp = mp;
      if (!init && hp > oldMax) this.hp += hp - oldMax;
      this.atk = atk; this.def = def;
      this.atkSpd = atkSpd; this.crit = Math.min(0.8, crit);
      this.cdr = Math.min(0.4, cdr);
      this.speed = s.speed * (1 + ms);
      this.regen = regen; this.regenMp = regenMp;
    }
    gainXp(v) {
      if (this.level >= HE.CFG.MAX_LEVEL) return;
      this.xp += v;
      let need = HE.CFG.XP_LEVEL(this.level);
      while (this.xp >= need && this.level < HE.CFG.MAX_LEVEL) {
        this.xp -= need; this.level++;
        this.skillPoints++;
        this.autoLevelSkill();
        this.computeStats();
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.18);
        HE.FX.levelUp(this.pos);
        if (this.isPlayer) { HE.Audio.sfx('levelup'); HE.UI.floatText(this.pos, `Lv.${this.level}`, 'float-xp'); }
        need = HE.CFG.XP_LEVEL(this.level);
      }
    }
    autoLevelSkill() {
      // 4/8/12 级升大招，其余交替升 1/2 技能
      while (this.skillPoints > 0) {
        let idx;
        const ult = this.skills[2];
        if ((this.level >= 4 && ult.lv < 1) || (this.level >= 8 && ult.lv < 2) || (this.level >= 12 && ult.lv < 3)) idx = 2;
        else idx = this.skills[0].lv <= this.skills[1].lv ? 0 : 1;
        const sk = this.skills[idx];
        const cap = idx === 2 ? 3 : 6;
        if (sk.lv >= cap) { idx = idx === 0 ? 1 : 0; if (this.skills[idx].lv >= 6) { this.skillPoints = 0; break; } }
        this.skills[idx].lv++;
        this.skillPoints--;
        if (this.isPlayer && HE.UI.skillUpFlash) HE.UI.skillUpFlash(idx);
      }
    }
    gainGold(v, showFloat) {
      this.gold += v;
      if (this.isPlayer) {
        HE.Audio.sfx('coin', { vol: 0.7 });
        if (showFloat) HE.UI.floatText(this.pos, `+${Math.round(v)}`, 'float-gold');
      }
    }
    buyItem(item) {
      if (this.items.length >= 6 || this.gold < item.price) return false;
      if (this.items.some(i => i.id === item.id)) return false;
      this.gold -= item.price;
      this.items.push(item);
      this.computeStats();
      if (this.isPlayer) HE.Audio.sfx('buy');
      return true;
    }
    addBuff(key, dur) {
      this.buffs[key] = dur;
      this.computeStats();
    }
    /* ---------- 普攻 ---------- */
    tryBasicAttack(target, dt) {
      if (this.stunT > 0 || this.dropping > 0 || !this.alive) return;
      if (this.atkTimer > 0) return;
      if (!target || !target.alive || this.distTo(target) > this.range) return;
      this.atkTimer = 1 / this.atkSpdNow;
      this.cancelRecall();
      this.shoot(target);
    }
    autoTarget(preferHero) {
      const Gm = G();
      let best = null, bd = 1e9;
      for (const u of Gm.units) {
        if (!u.alive || u.team === this.team || u.untargetable) continue;
        const d = this.distTo(u);
        if (d > this.range) continue;
        let score = d - (u.isHero ? 6 : 0) - (u.kind === 'crystal' ? 3 : 0);
        if (score < bd) { bd = score; best = u; }
      }
      return best;
    }
    nearestEnemyHero(r) {
      const Gm = G();
      let best = null, bd = r;
      for (const h of Gm.heroes) {
        if (!h.alive || h.team === this.team || h.untargetable) continue;
        const d = this.distTo(h);
        if (d < bd) { bd = d; best = h; }
      }
      return best;
    }
    nearestEnemy(r) {
      const Gm = G();
      let best = null, bd = r;
      for (const u of Gm.units) {
        if (!u.alive || u.team === this.team || u.isBuilding || u.untargetable) continue;
        const d = this.distTo(u);
        if (d < bd) { bd = d; best = u; }
      }
      return best;
    }
    aimDir() {
      // 技能默认朝向：移动输入方向 → 面朝方向
      return new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
    }
    /* ---------- 技能 ---------- */
    castSkill(i) {
      const sk = this.skills[i];
      const conf = this.heroDef.skills[i];
      if (!this.alive || this.dropping > 0 || this.stunT > 0) return false;
      if (sk.lv <= 0 || sk.cd > 0) return false;
      if (this.mp < conf.mana) { if (this.isPlayer) HE.UI.notEnoughMana(i); return false; }
      const ok = this.doSkill(i, sk.lv);
      if (ok === false) return false;
      this.mp -= conf.mana;
      sk.cd = conf.cd * (1 - (this.cdr || 0));
      this.cancelRecall();
      return true;
    }
    doSkill(i, lv) {
      const id = this.heroDef.id;
      const P = this.pos;
      const dir = this.aimDir();
      const Gm = G();
      /* ===== 雷霆 ===== */
      if (id === 'thunder') {
        if (i === 0) {
          this.dash = { dir, t: 0.35, speed: 46, hit: new Set(), dmg: 180 + 60 * lv + this.atk * 0.5 };
          HE.Audio.sfx('dash', { at: P });
        } else if (i === 1) {
          this.addShield(220 + 120 * lv + this.atk * 0.8, 3.5); this.shieldT = 3.5;
          Gm.zones.push({ type: 'smoke', team: this.team, x: P.x, z: P.z, r: 6, t: 4 });
          HE.FX.smokePuff(P, 5, 2.2);
          HE.Audio.sfx('smoke', { at: P });
        } else {
          const tgt = this.nearestEnemyHero(15);
          const dst = tgt ? new THREE.Vector3(tgt.x, 0, tgt.z) : P.clone().addScaledVector(dir, 10);
          this.leap = { from: P.clone(), to: dst, t: 0, dur: 0.55, dmg: 320 + 160 * lv + this.atk * 0.9, r: 5, stun: 1.2 };
          HE.Audio.sfx('dash', { at: P });
        }
      }
      /* ===== 孤狼 ===== */
      else if (id === 'wolf') {
        if (i === 0) {
          this.addTimedBuff('rapidfire', 4, () => { });
          this.rapidT = 4;
          HE.Audio.sfx('ui_confirm', { at: P }); HE.Audio.sfx('shot_smg', { at: P, delay: 0.1, vol: 0.5 });
        } else if (i === 1) {
          this.dash = { dir, t: 0.25, speed: 40, hit: new Set(), dmg: 0 };
          this.nextCrit = true;
          HE.Audio.sfx('dash', { at: P });
        } else {
          const tgt = this.nearestEnemyHero(18) || this.nearestEnemy(18);
          if (!tgt) return false;
          this.channel = { type: 'barrage', target: tgt, shots: 8, t: 0, interval: 0.18, dmgMult: 0.55 + 0.15 * lv };
        }
      }
      /* ===== 夜刺 ===== */
      else if (id === 'viper') {
        if (i === 0) {
          const tgt = this.nearestEnemyHero(16) || this.nearestEnemy(12);
          if (!tgt) return false;
          HE.FX.deathBurst(P.clone(), 0x9c4dd6);
          const behind = new THREE.Vector3(tgt.x, 0, tgt.z).addScaledVector(
            new THREE.Vector3(tgt.x - P.x, 0, tgt.z - P.z).normalize(), 1.6);
          this.pos.copy(behind); this.syncMesh();
          this.faceTo(tgt.x, tgt.z);
          const dmg = 230 + 90 * lv + this.atk * 0.6;
          const dealt = tgt.takeDamage(dmg, this);
          if (this.isPlayer) HE.UI.floatDmg(tgt, dealt, true, false);
          HE.FX.deathBurst(behind.clone(), 0x9c4dd6);
          HE.Audio.sfx('flash', { at: P });
        } else if (i === 1) {
          this.poisonShots = 3;
          this.poisonDps = 55 + 25 * lv;
          HE.Audio.sfx('poison', { at: P });
        } else {
          const tgt = this.nearestEnemyHero(10) || this.nearestEnemy(9);
          if (!tgt) return false;
          let dmg = 380 + 180 * lv + this.atk * 1.0;
          if (tgt.hp / tgt.maxHp < 0.3) dmg *= 2;
          this.faceTo(tgt.x, tgt.z);
          const dealt = tgt.takeDamage(dmg, this);
          HE.FX.explosion(new THREE.Vector3(tgt.x, 0.8, tgt.z), 1.6, 0xb06aff);
          if (this.isPlayer) HE.UI.floatDmg(tgt, dealt, true, false);
          HE.Audio.sfx('kill_hero', { at: tgt.pos });
        }
      }
      /* ===== 火药桶 ===== */
      else if (id === 'boom') {
        const throwTo = (r) => {
          const tgt = this.nearestEnemyHero(13) || this.nearestEnemy(13);
          return tgt ? new THREE.Vector3(tgt.x, 0, tgt.z) : P.clone().addScaledVector(dir, 9);
        };
        if (i === 0) {
          const dst = throwTo();
          HE.Audio.sfx('shot_launcher', { at: P });
          new Projectile({
            src: this, start: new THREE.Vector3(P.x, 1.8, P.z), point: dst, speed: 22, arc: true, color: 0x8a9a4a,
            onLand: (at) => {
              HE.FX.explosion(at.clone(), 4, 0xff8a3c);
              HE.Audio.sfx('explosion', { at });
              Gm.aoeDamage(at, 4, 280 + 120 * lv + this.atk * 0.7, this);
            },
          });
        } else if (i === 1) {
          const dst = throwTo();
          HE.Audio.sfx('shot_launcher', { at: P, vol: 0.7 });
          new Projectile({
            src: this, start: new THREE.Vector3(P.x, 1.8, P.z), point: dst, speed: 22, arc: true, color: 0xff6a2c,
            onLand: (at) => {
              HE.Audio.sfx('explosion', { at, vol: 0.6 });
              Gm.zones.push({ type: 'fire', team: this.team, x: at.x, z: at.z, r: 4.5, t: 3.5, dps: 85 + 35 * lv, src: this });
            },
          });
        } else {
          const tgt = this.nearestEnemyHero(20);
          const dst = tgt ? new THREE.Vector3(tgt.x, 0, tgt.z) : P.clone().addScaledVector(dir, 14);
          this.mortar = { pos: dst, shots: 5, t: 0, interval: 0.4, dmg: 240 + 110 * lv + this.atk * 0.5, lv };
          HE.Audio.sfx('shot_launcher', { at: P });
        }
      }
      /* ===== 白鸽（军医） ===== */
      else if (id === 'medic') {
        const lowAlly = (r) => {
          let best = this, ratio = this.hp / this.maxHp;
          for (const h of Gm.heroes) {
            if (h.team !== this.team || !h.alive || h === this) continue;
            if (this.distTo(h) > r) continue;
            const rr = h.hp / h.maxHp;
            if (rr < ratio) { ratio = rr; best = h; }
          }
          return best;
        };
        if (i === 0) {
          const tgt = lowAlly(14);
          const heal = 260 + 130 * lv + this.atk * 0.8;
          new Projectile({
            src: this, start: new THREE.Vector3(P.x, 1.8, P.z), point: new THREE.Vector3(tgt.x, 0, tgt.z),
            speed: 26, arc: true, color: 0x7fe8a8,
            onLand: (at) => {
              HE.Audio.sfx('heal', { at });
              for (const h of Gm.heroes) {
                if (h.team !== this.team || !h.alive) continue;
                if (Math.hypot(h.x - at.x, h.z - at.z) < 5) {
                  const v = h.heal(heal);
                  HE.FX.healGlow(h.pos);
                  if (h.isPlayer && v > 0) HE.UI.floatText(h.pos, `+${Math.round(v)}`, 'float-heal');
                }
              }
            },
          });
        } else if (i === 1) {
          HE.Audio.sfx('heal', { at: P });
          for (const h of Gm.heroes) {
            if (h.team !== this.team || !h.alive) continue;
            if (this.distTo(h) < 8) {
              h.addShield(180 + 90 * lv, 3);
              h.addBuff('adrenaline', 3);
              HE.FX.ring(h.pos, 2, 0x7fd8c8, 0.5);
            }
          }
        } else {
          const tgt = lowAlly(16);
          Gm.zones.push({ type: 'rescue', team: this.team, x: tgt.x, z: tgt.z, r: 7, t: 4, hps: (85 + 45 * lv) * 2, src: this });
          HE.FX.ring(tgt.pos, 7, 0x7fe8a8, 1);
          HE.Audio.sfx('heal', { at: tgt.pos });
          HE.Audio.sfx('airdrop_land', { at: tgt.pos, vol: 0.5 });
        }
      }
      return true;
    }
    addTimedBuff(key, dur) { this.buffs[key] = dur; this.computeStats(); }
    get atkSpdNow() { return this.atkSpd * (this.rapidT > 0 ? 1.8 : 1); }
    /* ---------- 召唤师技能 ---------- */
    castFlash(dir) {
      if (this.flashCd > 0 || !this.alive || this.dropping > 0) return false;
      this.flashCd = HE.CFG.FLASH_CD;
      const d = dir && dir.lengthSq() > 0 ? dir.clone().normalize() : this.aimDir();
      HE.FX.deathBurst(this.pos.clone(), 0xf5c542);
      this.pos.addScaledVector(d, HE.CFG.FLASH_DIST);
      const H = HE.CFG.MAP_HALF - 2;
      this.pos.x = Math.max(-H, Math.min(H, this.pos.x));
      this.pos.z = Math.max(-H, Math.min(H, this.pos.z));
      this.syncMesh();
      HE.FX.deathBurst(this.pos.clone(), 0xf5c542);
      HE.Audio.sfx('flash', { at: this.pos });
      this.cancelRecall();
      return true;
    }
    castHeal() {
      if (this.healCd > 0 || !this.alive) return false;
      this.healCd = HE.CFG.HEAL_CD;
      const Gm = G();
      for (const h of Gm.heroes) {
        if (h.team !== this.team || !h.alive) continue;
        if (this.distTo(h) < 8) {
          const v = h.heal(h.maxHp * 0.22);
          HE.FX.healGlow(h.pos);
          if (h.isPlayer) HE.UI.floatText(h.pos, `+${Math.round(v)}`, 'float-heal');
        }
      }
      HE.Audio.sfx('heal', { at: this.pos });
      return true;
    }
    /* ---------- 回城 ---------- */
    startRecall() {
      if (this.recallT >= 0 || !this.alive) return;
      this.recallT = 0;
      HE.Audio.sfx('recall', { vol: this.isPlayer ? 1 : 0 });
    }
    cancelRecall() {
      if (this.recallT >= 0) { this.recallT = -1; if (this.isPlayer) HE.UI.hideRecall(); }
    }
    onDamaged(src, dmg, opts) {
      this.cancelRecall();
      if (this.isPlayer && !opts.silent) HE.UI.damageFlash();
    }
    die(src) {
      if (!this.alive) return;
      // 先记录连杀数据，供击杀播报使用
      this.deadStreak = this.streak; this.streak = 0; this.multiKill = 0;
      this.kda.d++;
      super.die(src);
      this.respawnT = HE.CFG.RESPAWN_BASE + this.level * HE.CFG.RESPAWN_PER_LV;
      this.cancelRecall();
      this.channel = null; this.mortar = null; this.dash = null; this.leap = null;
      this.group.visible = false;
      HE.FX.deathBurst(this.pos.clone(), TEAM_COLOR[this.team]);
      HE.Audio.sfx('death', { at: this.pos, vol: this.isPlayer ? 1 : 0.6 });
    }
    respawn() {
      const base = this.team === 'blue' ? HE.CFG.BLUE_BASE : HE.CFG.RED_BASE;
      this.pos.set(base.x + (Math.random() - 0.5) * 6, 0, base.z + (Math.random() - 0.5) * 6);
      this.alive = true;
      this.hp = this.maxHp; this.mp = this.maxMp;
      this.group.visible = true;
      this.startDrop(26);
      if (this.isPlayer) { HE.Audio.sfx('respawn'); HE.Audio.announce(HE.VOICE.respawn, { interrupt: false }); }
    }
    startDrop(height) {
      this.dropping = 1;
      this.dropH = height;
      this.untargetable = true;
      if (!this.chute) { this.chute = buildParachute(this.team === 'blue' ? 0x9ec4e8 : 0xe8a49e); this.group.add(this.chute); }
      this.chute.visible = true;
      HE.Audio.sfx('parachute', { at: this.pos, vol: this.isPlayer ? 0.8 : 0.2 });
    }
    update(dt) {
      if (!this.alive) {
        this.respawnT -= dt;
        if (this.respawnT <= 0) this.respawn();
        return;
      }
      this.updateStatus(dt);
      if (!this.alive) return;
      // 跳伞降落
      if (this.dropping > 0) {
        this.dropH -= dt * 12;
        this.pos.y = Math.max(0, this.dropH);
        if (this.dropH <= 0) {
          this.dropping = 0; this.pos.y = 0; this.untargetable = false;
          if (this.chute) this.chute.visible = false;
          HE.FX.ring(this.pos, 3, TEAM_COLOR[this.team], 0.5);
          HE.Audio.sfx('airdrop_land', { at: this.pos, vol: 0.4 });
        }
        this.syncMesh();
        return;
      }
      // 计时器
      if (this.atkTimer > 0) this.atkTimer -= dt;
      this.skills.forEach(s => { if (s.cd > 0) s.cd -= dt; });
      if (this.flashCd > 0) this.flashCd -= dt;
      if (this.healCd > 0) this.healCd -= dt;
      if (this.rapidT > 0) this.rapidT -= dt;
      if (this.multiKillT > 0) { this.multiKillT -= dt; if (this.multiKillT <= 0) this.multiKill = 0; }
      // buff 计时
      let dirty = false;
      for (const k in this.buffs) {
        this.buffs[k] -= dt;
        if (this.buffs[k] <= 0) { delete this.buffs[k]; dirty = true; }
      }
      if (dirty) this.computeStats();
      // 回复
      this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);
      this.mp = Math.min(this.maxMp, this.mp + this.regenMp * dt);
      // 泉水
      const base = this.team === 'blue' ? HE.CFG.BLUE_BASE : HE.CFG.RED_BASE;
      if (Math.hypot(this.x - base.x, this.z - base.z) < HE.CFG.FOUNTAIN_RADIUS) {
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * HE.CFG.FOUNTAIN_HEAL * dt);
        this.mp = Math.min(this.maxMp, this.mp + this.maxMp * 0.1 * dt);
      }
      // 冲刺 / 跳跃 / 引导 / 迫击炮
      this.updateActions(dt);
      // 回城读条
      if (this.recallT >= 0) {
        this.recallT += dt;
        if (Math.random() < dt * 8) HE.FX.recallBeam(this.pos);
        if (this.isPlayer) HE.UI.showRecall(this.recallT / HE.CFG.RECALL_TIME);
        if (this.recallT >= HE.CFG.RECALL_TIME) {
          this.recallT = -1;
          this.pos.set(base.x, 0, base.z);
          HE.FX.recallBeam(this.pos);
          if (this.isPlayer) HE.UI.hideRecall();
        }
      }
      this.syncMesh();
      this.animate(dt);
    }
    updateActions(dt) {
      const Gm = G();
      if (this.dash) {
        const d = this.dash;
        d.t -= dt;
        this.pos.addScaledVector(d.dir, d.speed * dt);
        const H = HE.CFG.MAP_HALF - 2;
        this.pos.x = Math.max(-H, Math.min(H, this.pos.x));
        this.pos.z = Math.max(-H, Math.min(H, this.pos.z));
        this.moving = true; this.walkPhase += dt * 20;
        if (d.dmg > 0) {
          for (const u of Gm.units) {
            if (u.team === this.team || !u.alive || u.isBuilding || d.hit.has(u.id)) continue;
            if (this.distTo(u) < 2.6) {
              d.hit.add(u.id);
              const dealt = u.takeDamage(d.dmg, this);
              u.applySlow(0.4, 1.5);
              HE.FX.hitSpark(new THREE.Vector3(u.x, 1.2, u.z));
              if (this.isPlayer) HE.UI.floatDmg(u, dealt, false, false);
            }
          }
        }
        if (d.t <= 0) this.dash = null;
      }
      if (this.leap) {
        const L = this.leap;
        L.t += dt;
        const k = Math.min(1, L.t / L.dur);
        this.pos.lerpVectors(L.from, L.to, k);
        this.pos.y = Math.sin(k * Math.PI) * 5;
        if (k >= 1) {
          this.pos.y = 0;
          HE.FX.explosion(this.pos.clone(), L.r, 0xffc23c);
          HE.Audio.sfx('explosion', { at: this.pos });
          HE.Audio.sfx('stun', { at: this.pos });
          for (const u of Gm.units) {
            if (u.team === this.team || !u.alive || u.isBuilding) continue;
            if (this.distTo(u) < L.r) {
              const dealt = u.takeDamage(L.dmg, this);
              u.applyStun(L.stun);
              if (this.isPlayer) HE.UI.floatDmg(u, dealt, false, false);
            }
          }
          this.leap = null;
        }
      }
      if (this.channel) {
        const C = this.channel;
        C.t -= dt;
        if (C.t <= 0 && C.shots > 0) {
          C.t = C.interval; C.shots--;
          if (C.target.alive && this.distTo(C.target) < 24) {
            this.shoot(C.target, C.dmgMult);
          } else C.shots = 0;
        }
        if (C.shots <= 0) this.channel = null;
      }
      if (this.mortar) {
        const M2 = this.mortar;
        M2.t -= dt;
        if (M2.t <= 0 && M2.shots > 0) {
          M2.t = M2.interval; M2.shots--;
          const at = new THREE.Vector3(M2.pos.x + (Math.random() - 0.5) * 8, 0, M2.pos.z + (Math.random() - 0.5) * 8);
          new Projectile({
            src: this, start: new THREE.Vector3(at.x, 26, at.z), point: at, speed: 60, arc: true, color: 0xff6a2c,
            onLand: (p) => {
              HE.FX.explosion(p.clone(), 3.5, 0xff8a3c);
              HE.Audio.sfx('explosion', { at: p });
              G().aoeDamage(p, 3.5, M2.dmg, this);
            },
          });
          HE.Audio.sfx('shot_sniper', { at: this.pos, vol: 0.3, delay: 0.1 });
        }
        if (M2.shots <= 0) this.mortar = null;
      }
    }
  }
  E.Hero = Hero;

  /* ================= 小兵 ================= */
  const MINION_DEF = {
    melee:  { hp: 640, atk: 52, def: 30, range: 2.2, spd: 6.4, atkSpd: 1.0, gold: () => HE.CFG.GOLD_MELEE, xp: 52, gun: null },
    ranged: { hp: 430, atk: 66, def: 18, range: 9,   spd: 6.4, atkSpd: 0.9, gold: () => HE.CFG.GOLD_RANGED, xp: 44, gun: 'rifle' },
    cannon: { hp: 1650, atk: 96, def: 55, range: 10, spd: 5.8, atkSpd: 0.7, gold: () => HE.CFG.GOLD_CANNON, xp: 90, gun: 'launcher' },
  };
  class Minion extends Unit {
    constructor(team, lane, type, scaleFactor) {
      const path = HE.LANES[lane].map(p => team === 'blue' ? p : { x: -p.x, z: -p.z });
      super(team, path[0].x + (Math.random() - 0.5) * 3, path[0].z + (Math.random() - 0.5) * 3);
      this.kind = 'minion'; this.minionType = type; this.lane = lane;
      const d = MINION_DEF[type];
      this.maxHp = this.hp = d.hp * scaleFactor;
      this.atk = d.atk * scaleFactor; this.def = d.def;
      this.range = d.range; this.speed = d.spd; this.atkSpd = d.atkSpd;
      this.goldValue = d.gold(); this.xpValue = d.xp;
      this.gunType = d.gun || 'smg';
      this.radius = type === 'cannon' ? 1.3 : 0.85;
      this.path = path; this.wpIdx = 1;
      this.group = buildSoldier(
        { color: team === 'blue' ? 0x3a5a74 : 0x8a4438, accent: 0x666666, skin: 0xc9a97e, gun: d.gun || 'smg' },
        team, type === 'cannon' ? 1.05 : 0.72
      );
      this.group.traverse(o => { o.castShadow = false; });
      this.scanT = Math.random() * 0.3;
    }
    update(dt) {
      if (!this.alive) return;
      this.updateStatus(dt);
      if (!this.alive) return;
      if (this.atkTimer > 0) this.atkTimer -= dt;
      this.scanT -= dt;
      if (this.scanT <= 0) {
        this.scanT = 0.35;
        // 索敌：塔/英雄/兵，取最近
        let best = null, bd = 10.5;
        for (const u of G().units) {
          if (u.team === this.team || !u.alive || u.untargetable) continue;
          const d = this.distTo(u);
          const lim = u.isBuilding ? Math.max(10.5, this.range + u.radius + 1) : 10.5;
          if (d < Math.min(bd, lim)) { bd = d; best = u; }
        }
        this.target = best;
      }
      if (this.target && this.target.alive) {
        const d = this.distTo(this.target);
        const reach = this.range + (this.target.isBuilding ? this.target.radius : 0);
        if (d > reach) this.moveToward(this.target.x, this.target.z, dt);
        else if (this.atkTimer <= 0) {
          this.atkTimer = 1 / this.atkSpd;
          if (this.minionType === 'melee') {
            this.faceTo(this.target.x, this.target.z);
            this.recoilT = 0.1;
            const dealt = this.target.takeDamage(this.atk, this);
            HE.FX.hitSpark(new THREE.Vector3(this.target.x, 1, this.target.z), 0xffffff);
            if (this.target.isPlayer) HE.UI.floatDmg(this.target, dealt, false, true);
            HE.Audio.sfx('hit', { at: this.pos, vol: 0.5 });
          } else {
            this.shoot(this.target);
          }
        }
      } else {
        // 沿路推进
        const wp = this.path[Math.min(this.wpIdx, this.path.length - 1)];
        if (Math.hypot(wp.x - this.x, wp.z - this.z) < 3 && this.wpIdx < this.path.length - 1) this.wpIdx++;
        this.moveToward(wp.x, wp.z, dt);
      }
      this.syncMesh();
      this.animate(dt);
    }
  }
  E.Minion = Minion;

  /* ================= 哨塔 ================= */
  class Tower extends Unit {
    constructor(team, conf) {
      const x = team === 'blue' ? conf.x : -conf.x;
      const z = team === 'blue' ? conf.z : -conf.z;
      super(team, x, z);
      this.kind = 'tower'; this.isBuilding = true;
      this.lane = conf.lane; this.tier = conf.tier;
      this.name = `${team === 'blue' ? '我方' : '敌方'}哨塔`;
      this.maxHp = this.hp = conf.tier === 1 ? 4300 : conf.tier === 2 ? 5300 : 6400;
      this.atk = 380 + conf.tier * 60; this.def = 120;
      this.range = 16; this.radius = 2.4;
      this.gunType = 'mg';
      this.group = buildTower(team);
      this.scanT = 0; this.warnT = 0;
    }
    update(dt) {
      if (!this.alive) return;
      this.updateStatus(dt);
      if (this.atkTimer > 0) this.atkTimer -= dt;
      this.scanT -= dt;
      if (this.scanT <= 0) {
        this.scanT = 0.4;
        if (!this.target || !this.target.alive || this.distTo(this.target) > this.range) {
          this.target = null;
          let bd = this.range, bestMinion = null, bestHero = null;
          for (const u of G().units) {
            if (u.team === this.team || !u.alive || u.isBuilding || u.untargetable) continue;
            const d = this.distTo(u);
            if (d > this.range) continue;
            if (u.isHero) { if (!bestHero || d < this.distTo(bestHero)) bestHero = u; }
            else if (!bestMinion || d < this.distTo(bestMinion)) bestMinion = u;
          }
          this.target = bestMinion || bestHero;
          if (this.target && this.target.isPlayer) {
            HE.UI.towerWarn();
            HE.Audio.sfx('tower_alert', { vol: 0.7 });
          }
        }
      }
      if (this.target && this.target.alive && this.atkTimer <= 0) {
        this.atkTimer = 1.6;
        const ud = this.group.userData;
        if (ud.turret) ud.turret.rotation.y = Math.atan2(this.target.x - this.x, this.target.z - this.z);
        const start = new THREE.Vector3();
        ud.muzzle.getWorldPosition(start);
        HE.FX.muzzle(start, new THREE.Vector3(this.target.x - this.x, 0, this.target.z - this.z).normalize());
        HE.Audio.sfx('tower_shot', { at: this.pos });
        const tgt = this.target;
        new Projectile({
          src: this, start, target: tgt, speed: 55, color: 0xff8888,
          onHit: (t) => {
            const dealt = t.takeDamage(this.atk, this);
            HE.FX.explosion(new THREE.Vector3(t.x, 1, t.z), 1.2, 0xff6a4a);
            if (t.isPlayer) HE.UI.floatDmg(t, dealt, false, true);
          },
        });
      }
      // 受击警示灯闪烁
      const lamp = this.group.userData.lamp;
      if (lamp) lamp.material.color.setHex(this.hp < this.maxHp * 0.35 ? 0xffaa00 : TEAM_COLOR[this.team]);
    }
  }
  E.Tower = Tower;

  /* ================= 水晶 ================= */
  class Crystal extends Unit {
    constructor(team) {
      const b = team === 'blue' ? HE.CFG.BLUE_BASE : HE.CFG.RED_BASE;
      super(team, b.x, b.z);
      this.kind = 'crystal'; this.isBuilding = true;
      this.name = `${team === 'blue' ? '我方' : '敌方'}水晶`;
      this.maxHp = this.hp = 6800;
      this.def = 150; this.radius = 3.4;
      this.group = buildCrystal(team);
      this.invulnerable = true;
      this.warnCd = 0;
    }
    takeDamage(amount, src, opts) {
      if (this.invulnerable) {
        if (src && src.isPlayer && Math.random() < 0.1) HE.UI.floatText(this.pos, '无敌', 'float-dmg');
        return 0;
      }
      if (this.team === HE.Game.G.playerTeam && this.warnCd <= 0) {
        this.warnCd = 8;
        HE.Audio.announce(HE.VOICE.crystalDanger);
        HE.Audio.sfx('crystal_alert');
        HE.UI.banner('水晶告急！', 'red', 1400);
      }
      return super.takeDamage(amount, src, opts);
    }
    update(dt) {
      if (!this.alive) return;
      if (this.warnCd > 0) this.warnCd -= dt;
      const ud = this.group.userData;
      ud.core.rotation.y += dt * 1.2;
      ud.core.position.y = 3.4 + Math.sin(HE.Game.G.time * 2) * 0.25;
      ud.glow.position.y = ud.core.position.y;
      const ratio = this.hp / this.maxHp;
      ud.core.material.emissiveIntensity = 0.3 + ratio * 0.4;
    }
  }
  E.Crystal = Crystal;

  /* ================= 野怪 ================= */
  const MONSTER_DEF = {
    redbuff:  { hp: 2400, atk: 110, name: '烈焰机甲', xp: 120 },
    bluebuff: { hp: 2400, atk: 110, name: '寒冰机甲', xp: 120 },
    tyrant:   { hp: 7500, atk: 220, name: '暴君', xp: 300 },
    overlord: { hp: 10500, atk: 280, name: '主宰', xp: 400 },
  };
  class Monster extends Unit {
    constructor(camp) {
      super('neutral', camp.x, camp.z);
      this.kind = 'monster'; this.camp = camp;
      const d = MONSTER_DEF[camp.type];
      this.name = d.name;
      this.maxHp = this.hp = d.hp; this.atk = d.atk;
      this.def = 80; this.range = 2.8; this.speed = 7; this.atkSpd = 0.8;
      this.radius = camp.type === 'tyrant' || camp.type === 'overlord' ? 2.6 : 1.4;
      this.group = buildMonster(camp.type);
      this.home = new THREE.Vector3(camp.x, 0, camp.z);
      this.walkT = 0;
    }
    onDamaged(src) {
      if (src && src.isHero && (!this.target || !this.target.alive)) {
        this.target = src;
        HE.Audio.sfx('monster', { at: this.pos });
      }
    }
    update(dt) {
      if (!this.alive) return;
      this.updateStatus(dt);
      if (!this.alive) return;
      if (this.atkTimer > 0) this.atkTimer -= dt;
      const distHome = this.pos.distanceTo(this.home);
      if (this.target && (!this.target.alive || distHome > 16 || this.target.distTo(this) > 18)) {
        this.target = null;
      }
      if (this.target) {
        const d = this.distTo(this.target);
        if (d > this.range) this.moveToward(this.target.x, this.target.z, dt);
        else if (this.atkTimer <= 0) {
          this.atkTimer = 1 / this.atkSpd;
          this.faceTo(this.target.x, this.target.z);
          const dealt = this.target.takeDamage(this.atk, this);
          HE.FX.hitSpark(new THREE.Vector3(this.target.x, 1.2, this.target.z), 0xff8844);
          HE.Audio.sfx('hit_flesh', { at: this.pos, vol: 0.7 });
          if (this.target.isPlayer) HE.UI.floatDmg(this.target, dealt, false, true);
        }
      } else if (distHome > 1.5) {
        this.moveToward(this.home.x, this.home.z, dt);
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.3 * dt);
      } else {
        // 原地踱步动画
        this.walkT += dt;
        this.group.rotation.y += Math.sin(this.walkT * 0.7) * dt * 0.3;
      }
      const legs = this.group.userData.legs;
      if (legs && this.moving) {
        const s = Math.sin(this.walkPhase * 1.4);
        legs[0].rotation.x = s * 0.5; legs[3].rotation.x = s * 0.5;
        legs[1].rotation.x = -s * 0.5; legs[2].rotation.x = -s * 0.5;
      }
      this.moving = false;
      this.syncMesh();
    }
  }
  E.Monster = Monster;

  /* ================= 空投箱 ================= */
  class AirdropCrate extends Unit {
    constructor(x, z, loot) {
      super('neutral', x, z);
      this.kind = 'airdrop';
      this.loot = loot;
      this.name = '空投补给';
      this.maxHp = this.hp = 1;
      this.untargetable = true;
      this.group = buildAirdropCrate();
      this.pos.y = 45;
      this.landed = false;
      this.lifeT = 60;
      this.blinkT = 0;
    }
    update(dt) {
      if (!this.alive) return;
      if (!this.landed) {
        this.pos.y -= dt * 7;
        this.group.rotation.y += dt * 0.5;
        if (this.pos.y <= 0) {
          this.pos.y = 0; this.landed = true;
          this.group.userData.chute.visible = false;
          HE.FX.smokePuff(this.pos, 3, 2);
          HE.FX.ring(this.pos, 4, 0xf5c542, 1);
          HE.Audio.sfx('airdrop_land', { at: this.pos });
        }
      } else {
        this.lifeT -= dt;
        this.blinkT += dt;
        this.group.userData.lamp.material.color.setHex(Math.sin(this.blinkT * 8) > 0 ? 0xff4433 : 0x662211);
        if (Math.random() < dt * 2) HE.FX.flame(new THREE.Vector3(this.x, 0.2, this.z), 0.6);
        if (this.lifeT <= 0) { this.alive = false; HE.Game.removeUnit(this); return; }
        // 拾取判定
        for (const h of G().heroes) {
          if (!h.alive || h.dropping > 0) continue;
          if (this.distTo(h) < 3) { this.pickup(h); break; }
        }
      }
      this.syncMesh();
    }
    pickup(hero) {
      this.alive = false;
      HE.Game.removeUnit(this);
      const l = this.loot;
      HE.Audio.sfx('pickup', { at: this.pos });
      if (l.id === 'meds') hero.heal(hero.maxHp);
      else hero.addBuff(l.id, l.dur);
      HE.FX.levelUp(hero.pos);
      if (hero.isPlayer) {
        HE.UI.banner(`获得空投：${l.name}`, '', 1600);
        HE.UI.floatText(hero.pos, l.name, 'float-gold');
      } else if (hero.team === G().playerTeam) {
        HE.UI.killfeedText(`${hero.name} 拾取了空投 ${l.icon}`);
      } else {
        HE.UI.killfeedText(`敌方拾取了空投 ${l.icon}`);
      }
    }
  }
  E.AirdropCrate = AirdropCrate;

  return E;
})();
