/* ============ 围攻 Web —— 战场环境 ============ */
'use strict';

/*
 * 场景：青翠平原 + 石头城堡 + 巡逻骑士 + 绵羊 + 风车（致敬第一关 "南木峪"）
 * 所有可破坏物注册到 SimRegistry，供武器/撞击系统结算。
 * 环境有初始快照，模拟结束时 reset。
 */

class GameWorld {
  constructor(scene, cworld, particles) {
    this.scene = scene;
    this.cworld = cworld;
    this.particles = particles;
    this.envGroup = new THREE.Group();
    scene.add(this.envGroup);
    this.resetables = []; // { body, mesh, pos0, quat0, entity }
    this.knights = [];
    this.sheep = [];
    this.windmills = [];
    this.totalKnights = 0;
    this._buildTerrain();
    this._buildScenery();
    this._buildCastle(0, 32);
    this._spawnKnights();
    this._spawnSheep();
  }

  /* ---------------- 地形 ---------------- */
  _buildTerrain() {
    const geo = new THREE.PlaneGeometry(400, 400, 64, 64);
    // 轻微起伏（远处),中心保持平整
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const d = Math.sqrt(x * x + y * y);
      const h = d > 60 ? (Math.sin(x * .05) + Math.cos(y * .045)) * (d - 60) * .06 : 0;
      pos.setZ(i, h);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ map: U.tex.grass });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.envGroup.add(ground);
    // 物理地面（平面，起伏只在远处装饰）
    const gBody = new CANNON.Body({ mass: 0, material: MAT_GROUND });
    gBody.addShape(new CANNON.Plane());
    gBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.cworld.addBody(gBody);
    // 边界感：远山
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = U.rand(150, 185);
      const h = U.rand(18, 42);
      const mtn = new THREE.Mesh(
        new THREE.ConeGeometry(U.rand(22, 42), h, 7),
        new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(.28, .25, U.rand(.22, .3)) }));
      mtn.position.set(Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r);
      this.envGroup.add(mtn);
    }
  }

  /* ---------------- 装饰 ---------------- */
  _buildScenery() {
    // 树
    for (let i = 0; i < 26; i++) {
      const a = U.rand(0, Math.PI * 2), r = U.rand(28, 110);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.abs(x) < 20 && z < 45 && z > -10) continue; // 让开主战场
      this._tree(x, z);
    }
    // 石头
    for (let i = 0; i < 14; i++) {
      const a = U.rand(0, Math.PI * 2), r = U.rand(20, 100);
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(U.rand(.5, 1.6)), U.mat.stone);
      rock.position.set(Math.cos(a) * r, U.rand(0, .3), Math.sin(a) * r);
      rock.rotation.set(U.rand(0, 3), U.rand(0, 3), U.rand(0, 3));
      rock.castShadow = true;
      this.envGroup.add(rock);
    }
    // 风车
    this._windmill(34, 14);
    // 小路（贴地长条）
    const road = new THREE.Mesh(new THREE.PlaneGeometry(6, 70),
      new THREE.MeshLambertMaterial({ color: 0x9a8a64, transparent: true, opacity: .75 }));
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, .02, 18);
    this.envGroup.add(road);
  }

  _tree(x, z) {
    const g = new THREE.Group();
    const h = U.rand(2.2, 4);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.22, .34, h, 7), U.mat.darkwood);
    trunk.position.y = h / 2;
    trunk.castShadow = true;
    g.add(trunk);
    const layers = U.randInt(2, 3);
    for (let i = 0; i < layers; i++) {
      const r = U.rand(1.4, 2.2) * (1 - i * .22);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, r * 1.4, 8),
        new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(.3, .4, U.rand(.25, .35)) }));
      cone.position.y = h * .7 + i * r * .8;
      cone.castShadow = true;
      g.add(cone);
    }
    g.position.set(x, 0, z);
    this.envGroup.add(g);
    // 树干物理（静态圆柱）
    const body = new CANNON.Body({ mass: 0, material: MAT_GROUND });
    body.addShape(new CANNON.Cylinder(.3, .38, h, 8));
    body.position.set(x, h / 2, z);
    this.cworld.addBody(body);
  }

  _windmill(x, z) {
    const g = new THREE.Group();
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.2, 12, 10), U.mat.stone);
    tower.position.y = 6; tower.castShadow = true;
    g.add(tower);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 2.6, 10), U.mat.darkwood);
    roof.position.y = 13.2; roof.castShadow = true;
    g.add(roof);
    const hub = new THREE.Group();
    hub.position.set(0, 11, -3.0);
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(1.6, 7.5, .12), U.mat.wood);
      blade.position.y = 4.2;
      const arm = new THREE.Group();
      arm.add(blade);
      arm.rotation.z = i * Math.PI / 2;
      hub.add(arm);
    }
    g.add(hub);
    g.position.set(x, 0, z);
    this.envGroup.add(g);
    this.windmills.push(hub);
    const body = new CANNON.Body({ mass: 0, material: MAT_GROUND });
    body.addShape(new CANNON.Cylinder(2.4, 3.3, 12, 8));
    body.position.set(x, 6, z);
    this.cworld.addBody(body);
  }

  /* ---------------- 城堡 ---------------- */
  _castleStone(x, y, z, sx, sy, sz, mat) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat || U.mat.stone);
    mesh.position.set(x, y, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.envGroup.add(mesh);
    const body = new CANNON.Body({ mass: sx * sy * sz * 1.6, material: MAT_BLOCK });
    body.addShape(new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)));
    body.position.set(x, y, z);
    body.sleepSpeedLimit = .4; body.sleepTimeLimit = .6;
    body.allowSleep = true;
    body.sleep();
    this.cworld.addBody(body);
    const ent = {
      kind: 'stone', body, mesh, hp: 90 + sx * sy * sz * 18, dead: false,      flammable: mat === U.mat.darkwood || mat === U.mat.wood,
      onDamage: (dmg, p) => { if (p && dmg > 15) this.particles.splinters(p.x, p.y, p.z, [.62, .6, .55], 6); },
      onDestroy: () => this._crumble(ent),
    };
    ent.hp0 = ent.hp;
    body.entityRef = ent;
    SimRegistry.register(ent);
    this.resetables.push({ body, mesh, pos0: mesh.position.clone(), quat0: new THREE.Quaternion(), entity: ent });
    return ent;
  }

  _crumble(ent) {
    const p = U.toT(ent.body.position);
    this.particles.splinters(p.x, p.y, p.z, [.6, .58, .52], 16);
    this.particles.smokePuff(p.x, p.y, p.z, 6, 1.2);
    SFX.crack();
    ent.mesh.visible = false;
    this.cworld.removeBody(ent.body);
  }

  _buildCastle(cx, cz) {
    // 城墙：两段 + 中央塔楼 + 木门
    const wallY = 1.2;
    // 左右城墙（石砖堆叠，可被撞塌）
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 4; i++) {          // 横向 4 块
        for (let j = 0; j < 3; j++) {        // 纵向 3 层
          const x = cx + side * (4.5 + i * 3.05);
          this._castleStone(x, wallY + j * 2.45, cz, 3, 2.4, 2);
        }
        // 垛口
        const x = cx + side * (4.5 + i * 3.05);
        this._castleStone(x - .9, wallY + 3 * 2.45, cz, 1, .9, 1.9);
        this._castleStone(x + .9, wallY + 3 * 2.45, cz, 1, .9, 1.9);
      }
    }
    // 门楼两侧塔柱
    for (let side = -1; side <= 1; side += 2) {
      const x = cx + side * 3;
      for (let j = 0; j < 5; j++) this._castleStone(x, wallY + j * 2.45, cz, 2.2, 2.4, 3);
      this._castleStone(x, wallY + 5 * 2.45, cz, 2.8, 1, 3.4);
    }
    // 门梁 + 木门
    this._castleStone(cx, wallY + 3 * 2.45 + .6, cz, 4, 1.6, 2.6);
    for (let j = 0; j < 3; j++) {
      for (let k = -1; k <= 1; k += 2) {
        this._castleStone(cx + k * .95, wallY + j * 2.2 - .1, cz, 1.8, 2.2, .5, U.mat.darkwood);
      }
    }
    // 旗帜
    for (let side = -1; side <= 1; side += 2) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 3.4, 6), U.mat.darkwood);
      pole.position.set(cx + side * 3, wallY + 5 * 2.45 + 2, cz);
      this.envGroup.add(pole);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, .95),
        new THREE.MeshLambertMaterial({ map: U.tex.flag, side: THREE.DoubleSide }));
      flag.position.set(cx + side * 3 + .85, wallY + 5 * 2.45 + 3.1, cz);
      this.envGroup.add(flag);
      this.flags = this.flags || [];
      this.flags.push(flag);
    }
  }

  /* ---------------- 骑士 ---------------- */
  _knightMesh() {
    const g = new THREE.Group();
    const armor = new THREE.MeshLambertMaterial({ color: 0x8a8f9a });
    const cloth = new THREE.MeshLambertMaterial({ color: 0x903030 });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd8b090 });
    // 身体
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(.32, .38, .85, 8), armor);
    torso.position.y = 1.0; g.add(torso);
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(.38, .45, .35, 8), cloth);
    skirt.position.y = .5; g.add(skirt);
    // 头 + 头盔
    const head = new THREE.Mesh(new THREE.SphereGeometry(.24, 10, 8), skin);
    head.position.y = 1.65; g.add(head);
    const helm = new THREE.Mesh(new THREE.CylinderGeometry(.27, .29, .3, 8), armor);
    helm.position.y = 1.78; g.add(helm);
    const plume = new THREE.Mesh(new THREE.ConeGeometry(.08, .35, 6), cloth);
    plume.position.y = 2.05; g.add(plume);
    // 腿
    for (let s = -1; s <= 1; s += 2) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(.1, .12, .6, 6), armor);
      leg.position.set(s * .15, .3, 0); leg.name = s < 0 ? 'legL' : 'legR';
      g.add(leg);
    }
    // 手臂 + 剑/盾
    const armR = new THREE.Mesh(new THREE.CylinderGeometry(.08, .09, .55, 6), armor);
    armR.position.set(.42, 1.15, 0); armR.rotation.z = -.5; g.add(armR);
    const armL = new THREE.Mesh(new THREE.CylinderGeometry(.08, .09, .55, 6), armor);
    armL.position.set(-.42, 1.15, 0); armL.rotation.z = .5; g.add(armL);
    const sword = new THREE.Mesh(new THREE.BoxGeometry(.06, .8, .12), U.mat.metal);
    sword.position.set(.58, 1.55, .1); g.add(sword);
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, .08, 10), cloth);
    shield.rotation.z = Math.PI / 2;
    shield.position.set(-.55, 1.1, 0); g.add(shield);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  _spawnKnight(x, z, patrol) {
    const mesh = this._knightMesh();
    mesh.position.set(x, 0, z);
    this.envGroup.add(mesh);
    const body = new CANNON.Body({ mass: 5, material: MAT_BLOCK });
    body.addShape(new CANNON.Box(new CANNON.Vec3(.32, .95, .28)), new CANNON.Vec3(0, .95, 0));
    body.position.set(x, 0.01, z);
    body.fixedRotation = true;
    body.updateMassProperties();
    body.linearDamping = .85;
    body.allowSleep = false;
    this.cworld.addBody(body);
    const ent = {
      kind: 'knight', body, mesh, hp: 70, dead: false, flammable: true,
      patrol, patrolT: U.rand(0, 10), walkT: 0, home: new THREE.Vector3(x, 0, z),
      onDamage: (dmg, p) => {
        if (p && dmg > 8) this.particles.splinters(p.x, p.y + 1, p.z, [.7, .2, .15], 5);
      },
      onDestroy: () => this._killKnight(ent),
    };
    body.entityRef = ent;
    SimRegistry.register(ent);
    this.knights.push(ent);
    this.resetables.push({ body, mesh, pos0: new THREE.Vector3(x, 0.01, z), quat0: new THREE.Quaternion(), entity: ent });
    this.totalKnights++;
  }

  _spawnKnights() {
    // 城门口卫兵
    this._spawnKnight(-6, 26, { type: 'line', a: new THREE.Vector3(-8, 0, 26), b: new THREE.Vector3(-3, 0, 26) });
    this._spawnKnight(6, 26, { type: 'line', a: new THREE.Vector3(3, 0, 26), b: new THREE.Vector3(8, 0, 26) });
    // 平原巡逻队
    this._spawnKnight(-14, 8, { type: 'circle', c: new THREE.Vector3(-14, 0, 8), r: 4 });
    this._spawnKnight(15, 12, { type: 'circle', c: new THREE.Vector3(15, 0, 12), r: 5 });
    this._spawnKnight(2, -14, { type: 'circle', c: new THREE.Vector3(2, 0, -14), r: 3.5 });
    this._spawnKnight(24, -6, { type: 'line', a: new THREE.Vector3(20, 0, -6), b: new THREE.Vector3(28, 0, -6) });
  }

  _killKnight(ent) {
    const p = U.toT(ent.body.position);
    this.particles.splinters(p.x, p.y + 1, p.z, [.72, .18, .12], 12);
    this.particles.smokePuff(p.x, p.y + .6, p.z, 4, .7);
    SFX.crack();
    // 倒地：解除固定旋转，横躺
    ent.body.fixedRotation = false;
    ent.body.updateMassProperties();
    ent.body.angularVelocity.set(U.rand(-4, 4), 0, U.rand(-4, 4));
    ent.mesh.traverse(o => { if (o.isMesh && o.material.color) o.material = o.material.clone(); });
    setTimeout(() => { // 淡出
      ent.mesh.traverse(o => {
        if (o.isMesh) { o.material.transparent = true; o.material.opacity = .55; }
      });
    }, 1200);
  }

  /* ---------------- 绵羊 ---------------- */
  _sheepMesh() {
    const g = new THREE.Group();
    const woolM = new THREE.MeshLambertMaterial({ color: 0xe8e4da });
    const skinM = new THREE.MeshLambertMaterial({ color: 0x4a4038 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(.42, 10, 8), woolM);
    body.scale.set(1.25, 1, 1); body.position.y = .55; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(.26, .26, .3), skinM);
    head.position.set(0, .68, .5); g.add(head);
    for (let sx = -1; sx <= 1; sx += 2) for (let sz = -1; sz <= 1; sz += 2) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .35, 5), skinM);
      leg.position.set(sx * .2, .18, sz * .22); g.add(leg);
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  _spawnSheep() {
    for (let i = 0; i < 7; i++) {
      const a = U.rand(0, Math.PI * 2), r = U.rand(8, 30);
      const x = Math.cos(a) * r, z = Math.sin(a) * r * .6 + 8;
      const mesh = this._sheepMesh();
      mesh.position.set(x, 0, z);
      this.envGroup.add(mesh);
      const body = new CANNON.Body({ mass: 1.2, material: MAT_BLOCK });
      body.addShape(new CANNON.Box(new CANNON.Vec3(.4, .35, .45)), new CANNON.Vec3(0, .5, 0));
      body.position.set(x, .01, z);
      body.fixedRotation = true; body.updateMassProperties();
      body.linearDamping = .9;
      body.allowSleep = false;
      this.cworld.addBody(body);
      const ent = {
        kind: 'sheep', body, mesh, hp: 20, dead: false, flammable: true,
        wanderT: U.rand(0, 4), dir: U.rand(0, Math.PI * 2), walkT: 0,
        onDestroy: () => {
          const p = U.toT(body.position);
          this.particles.smokePuff(p.x, p.y + .4, p.z, 5, .6);
          body.fixedRotation = false; body.updateMassProperties();
          body.angularVelocity.set(U.rand(-6, 6), 0, U.rand(-6, 6));
          SFX.baa();
        },
      };
      body.entityRef = ent;
      SimRegistry.register(ent);
      this.sheep.push(ent);
      this.resetables.push({ body, mesh, pos0: new THREE.Vector3(x, .01, z), quat0: new THREE.Quaternion(), entity: ent });
    }
  }

  /* ---------------- 更新（AI 与动画） ---------------- */
  update(dt, simRunning, machinePos) {
    // 风车常转
    for (const hub of this.windmills) hub.rotation.z += dt * .6;
    // 旗帜飘动
    if (this.flags) for (const f of this.flags) f.rotation.y = Math.sin(performance.now() * .002) * .25;

    // 骑士
    for (const k of this.knights) {
      if (k.dead) { k.mesh.position.copy(k.body.position); k.mesh.quaternion.copy(k.body.quaternion); continue; }
      k.patrolT += dt; k.walkT += dt;
      let tgt = null;
      // 机器靠近时冲向机器
      if (simRunning && machinePos && machinePos.distanceTo(U.toT(k.body.position)) < 18) {
        tgt = machinePos;
      } else if (k.patrol.type === 'line') {
        const t = (Math.sin(k.patrolT * .35) + 1) / 2;
        tgt = k.patrol.a.clone().lerp(k.patrol.b, t);
      } else {
        const a = k.patrolT * .3;
        tgt = k.patrol.c.clone().add(new THREE.Vector3(Math.cos(a) * k.patrol.r, 0, Math.sin(a) * k.patrol.r));
      }
      const p = U.toT(k.body.position);
      const to = tgt.clone().sub(p); to.y = 0;
      const d = to.length();
      if (d > .6) {
        to.normalize();
        const speed = (simRunning && tgt === machinePos) ? 2.6 : 1.0;
        k.body.velocity.x = to.x * speed;
        k.body.velocity.z = to.z * speed;
        k.mesh.rotation.y = Math.atan2(to.x, to.z);
        // 走路摆腿
        const lg1 = k.mesh.getObjectByName('legL'), lg2 = k.mesh.getObjectByName('legR');
        if (lg1) lg1.rotation.x = Math.sin(k.walkT * 8) * .5;
        if (lg2) lg2.rotation.x = -Math.sin(k.walkT * 8) * .5;
      }
      k.mesh.position.set(k.body.position.x, k.body.position.y, k.body.position.z);
    }

    // 绵羊闲逛
    for (const s of this.sheep) {
      if (s.dead) { s.mesh.position.copy(s.body.position); s.mesh.quaternion.copy(s.body.quaternion); continue; }
      s.wanderT -= dt; s.walkT += dt;
      if (s.wanderT <= 0) {
        s.wanderT = U.rand(2, 6);
        s.dir = U.rand(0, Math.PI * 2);
        s.moving = Math.random() < .6;
        if (Math.random() < .15) SFX.baa();
      }
      if (s.moving) {
        s.body.velocity.x = Math.sin(s.dir) * .7;
        s.body.velocity.z = Math.cos(s.dir) * .7;
        s.mesh.rotation.y = s.dir;
      }
      s.mesh.position.set(s.body.position.x, s.body.position.y, s.body.position.z);
    }

    // 城堡石块同步（只同步醒着的）
    for (const r of this.resetables) {
      if (r.entity.kind !== 'stone' || r.entity.dead) continue;
      if (r.body.sleepState !== CANNON.Body.SLEEPING) {
        r.mesh.position.copy(r.body.position);
        r.mesh.quaternion.copy(r.body.quaternion);
      }
    }
  }

  aliveKnights() { return this.knights.filter(k => !k.dead).length; }

  /* ---------------- 复位 ---------------- */
  reset() {
    for (const r of this.resetables) {
      const e = r.entity;
      if (e.dead || e.kind === 'stone') {
        if (!this.cworld.bodies.includes(r.body)) this.cworld.addBody(r.body);
      }
      e.dead = false;
      e.burning = false;
      e.hp = e.kind === 'knight' ? 70 : e.kind === 'sheep' ? 20 : (e.hp0 || 300);
      r.body.position.set(r.pos0.x, r.pos0.y, r.pos0.z);
      r.body.quaternion.set(0, 0, 0, 1);
      r.body.velocity.setZero();
      r.body.angularVelocity.setZero();
      if (e.kind === 'knight' || e.kind === 'sheep') {
        r.body.fixedRotation = true; r.body.updateMassProperties();
      }
      if (e.kind === 'stone') r.body.sleep();
      r.mesh.visible = true;
      r.mesh.position.copy(r.pos0);
      r.mesh.quaternion.set(0, 0, 0, 1);
      r.mesh.traverse(o => {
        if (o.isMesh && o.material.transparent && o.material.opacity < 1) {
          o.material.opacity = 1; o.material.transparent = false;
        }
      });
    }
  }
}

window.GameWorld = GameWorld;
