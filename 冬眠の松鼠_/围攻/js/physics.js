/* ============ 围攻 Web —— 模拟引擎 ============ */
'use strict';

/*
 * 把机械按 "刚性连接" 合并成刚体岛(island)，
 * 关节零件(轮/铰链/悬挂等)与父岛之间用约束连接。
 * 支持：损伤/断裂(重建岛)、火焰蔓延、炸弹、加农炮、分离器、抓取器、气球浮力、螺旋桨。
 */

const JOINT_TYPES = { wheel: 1, freeWheel: 1, steering: 1, freeHinge: 1, rotor: 1, suspension: 1 };

const SimRegistry = {
  // 环境可互动对象：{ body, mesh, hp, flammable, burning, onDamage, onDestroy, kind }
  entities: [],
  enemies: [],   // 骑士
  particles: null,
  world: null,
  register(e) { this.entities.push(e); if (e.kind === 'knight') this.enemies.push(e); },
  clear() { this.entities.length = 0; this.enemies.length = 0; },
};

const MAT_GROUND = new CANNON.Material('ground');
const MAT_BLOCK = new CANNON.Material('block');
const MAT_WHEEL = new CANNON.Material('wheel');

class Simulation {
  constructor(cworld, scene, machine, particles) {
    this.cworld = cworld;
    this.scene = scene;
    this.machine = machine;
    this.particles = particles;
    this.running = false;
    this.islands = [];       // { body, blocks:[{block, relPos, relQuat}] }
    this.constraints = [];   // { c, type, meta }
    this.projectiles = [];
    this.burning = [];       // { target:'block'|'entity', ref, t, dps }
    this.brokenIds = new Set();
    this.decoupled = new Set();  // 已断开的 blockId
    this.grabJoints = [];
    this.keys = {};
    this.time = 0;
    this._meshRestore = [];
    this.pendingOps = [];    // 碰撞回调里的破坏操作延迟到 step 外执行
    this._collideHandler = e => this._onCollide(e);
  }

  _defer(fn) { this.pendingOps.push(fn); }
  _flushOps() {
    if (!this.pendingOps.length) return;
    const ops = this.pendingOps;
    this.pendingOps = [];
    for (const fn of ops) { try { fn(); } catch (e) { console.error(e); } }
  }

  /* ============ 启动 ============ */
  start() {
    if (this.running) return;
    this.running = true;
    this.time = 0;
    this.brokenIds.clear();
    this.decoupled.clear();
    this.machine.blocks.forEach(b => {
      b.hp = BLOCK_DEFS[b.type].health;
      b.burnT = 0; b.dead = false; b.burning = false;
      b.popped = false; b.grabbed = false; b.ext = 0; b.cool = 0;
    });
    // 计算抬升量：最低方块底面离地 0.05
    let minY = Infinity;
    for (const b of this.machine.blocks) minY = Math.min(minY, b.anchor.y);
    this.lift = -(minY) + 1.35;
    this._buildIslands(null);
    // 接管方块网格
    this._meshRestore = this.machine.blocks.map(b => ({
      b, pos: b.mesh.position.clone(), quat: b.mesh.quaternion.clone(),
    }));
    for (const b of this.machine.blocks) {
      this.machine.group.remove(b.mesh);
      this.scene.add(b.mesh);
    }
    this.cworld.addEventListener('postStep', this._postStep = () => this._afterStep());
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    for (const isl of this.islands) this.cworld.removeBody(isl.body);
    for (const c of this.constraints) this.cworld.removeConstraint(c.c);
    for (const g of this.grabJoints) this.cworld.removeConstraint(g);
    for (const p of this.projectiles) { this.cworld.removeBody(p.body); this.scene.remove(p.mesh); }
    this.islands = []; this.constraints = []; this.projectiles = []; this.burning = [];
    this.grabJoints = [];
    this.cworld.removeEventListener('postStep', this._postStep);
    // 归还网格
    for (const r of this._meshRestore) {
      this.scene.remove(r.b.mesh);
      if (!r.b.dead) {
        this.machine.group.add(r.b.mesh);
        r.b.mesh.position.copy(r.pos);
        r.b.mesh.quaternion.copy(r.quat);
        r.b.mesh.visible = true;
      } else {
        this.machine.group.add(r.b.mesh);
        r.b.mesh.position.copy(r.pos);
        r.b.mesh.quaternion.copy(r.quat);
        r.b.mesh.visible = true; // 建造模式恢复完整机械
      }
      r.b.mesh.traverse(o => { if (o.isMesh && o.material && o.material.transparent && o.material.opacity < 1 && o.name !== '') {} });
    }
    this._meshRestore = [];
  }

  /* ============ 岛构建 ============ */
  // carryState: Map blockId -> {pos,quat,vel,angVel} 用于断裂后重建
  _buildIslands(carryState) {
    // 清理旧的
    for (const isl of this.islands) this.cworld.removeBody(isl.body);
    for (const c of this.constraints) this.cworld.removeConstraint(c.c);
    this.islands = []; this.constraints = [];

    const blocks = this.machine.blocks.filter(b => !b.dead);
    const byId = {}; blocks.forEach(b => byId[b.id] = b);

    // 并查集：刚性边 = parent-child 且 child 不是关节 且 未被分离/断裂
    const uf = {}; blocks.forEach(b => uf[b.id] = b.id);
    const find = i => { while (uf[i] !== i) { uf[i] = uf[uf[i]]; i = uf[i]; } return i; };
    const union = (a, b2) => { uf[find(a)] = find(b2); };
    const jointEdges = [];
    for (const b of blocks) {
      if (b.parentId == null || !byId[b.parentId]) continue;
      if (this.decoupled.has(b.id)) continue;
      const def = BLOCK_DEFS[b.type];
      if (def.isJoint && JOINT_TYPES[def.jointType]) jointEdges.push(b);
      else union(b.id, b.parentId);
    }
    // 分组
    const groups = {};
    for (const b of blocks) {
      const root = find(b.id);
      (groups[root] = groups[root] || []).push(b);
    }
    // 世界坐标获取
    const worldPos = b => {
      if (carryState && carryState.has(b.id)) return carryState.get(b.id).pos.clone();
      return new THREE.Vector3(b.anchor.x, b.anchor.y + this.lift, b.anchor.z);
    };
    const worldQuat = b => {
      if (carryState && carryState.has(b.id)) return carryState.get(b.id).quat.clone();
      return b.quat.clone();
    };

    const islandOf = {};
    for (const root in groups) {
      const gBlocks = groups[root];
      let mass = 0; const com = new THREE.Vector3();
      for (const b of gBlocks) {
        const m = BLOCK_DEFS[b.type].mass;
        mass += m;
        com.addScaledVector(worldPos(b), m);
      }
      com.divideScalar(mass);
      const body = new CANNON.Body({ mass, material: MAT_BLOCK });
      body.position.set(com.x, com.y, com.z);
      body.linearDamping = 0.05;
      body.angularDamping = 0.1;
      body.allowSleep = false;
      const isl = { body, blocks: [], root };
      for (const b of gBlocks) {
        const def = BLOCK_DEFS[b.type];
        const wp = worldPos(b), wq = worldQuat(b);
        const rel = wp.clone().sub(com);
        for (const shape of def.physicsShapes()) {
          const localOff = U.toT(shape.blockShapeOffset).applyQuaternion(wq);
          const off = rel.clone().add(localOff);
          const sq = wq.clone().multiply(U.toTQ(shape.blockShapeQuat));
          shape.blockOwnerId = b.id;
          if (def.jointType === 'wheel' || def.jointType === 'freeWheel') shape.material = MAT_WHEEL;
          body.addShape(shape, U.toC(off), U.toCQ(sq));
        }
        isl.blocks.push({ block: b, relPos: rel.clone(), relQuat: wq.clone() });
        islandOf[b.id] = isl;
        b.island = isl;
      }
      body.simIsland = isl;
      // 携带速度
      if (carryState) {
        // 用组内第一块的旧速度
        for (const b of gBlocks) {
          const st = carryState.get(b.id);
          if (st && st.vel) { body.velocity.copy(st.vel); body.angularVelocity.copy(st.angVel); break; }
        }
      }
      this.cworld.addBody(body);
      body.addEventListener('collide', this._collideHandler);
      this.islands.push(isl);
    }

    // 关节约束
    for (const b of jointEdges) {
      const def = BLOCK_DEFS[b.type];
      const parent = byId[b.parentId];
      if (!parent) continue;
      const islA = islandOf[parent.id], islB = islandOf[b.id];
      if (!islA || !islB || islA === islB) continue;
      const wp = worldPos(b), wq = worldQuat(b);
      const bodyA = islA.body, bodyB = islB.body;
      const pivotWorld = wp.clone();
      const pivotA = U.toC(pivotWorld.clone().sub(U.toT(bodyA.position)));
      const pivotB = U.toC(pivotWorld.clone().sub(U.toT(bodyB.position)));
      let axisWorld;
      if (def.jointType === 'steering' || def.jointType === 'freeHinge')
        axisWorld = new THREE.Vector3(0, 1, 0).applyQuaternion(wq);
      else
        axisWorld = new THREE.Vector3(0, 0, 1).applyQuaternion(wq);
      const axisC = U.toC(axisWorld);
      if (def.jointType === 'suspension') {
        const c = new CANNON.LockConstraint(bodyA, bodyB, { maxForce: 1e5 });
        this.cworld.addConstraint(c);
        const stiff = BLOCK_DEFS.suspension.defaultStiffness * 30;
        c.equations.forEach(eq => { eq.setSpookParams(stiff * 100, 3, 1 / 60); });
        this.constraints.push({ c, type: 'suspension', block: b });
      } else {
        const c = new CANNON.HingeConstraint(bodyA, bodyB, {
          pivotA, pivotB, axisA: axisC, axisB: axisC, maxForce: 1e6,
        });
        this.cworld.addConstraint(c);
        const rec = { c, type: def.jointType, block: b, axisWorld: axisWorld.clone(),
          bodyA, bodyB, q0: bodyA.quaternion.mult(bodyB.quaternion.inverse()) };
        if (def.jointType === 'wheel' || def.jointType === 'rotor' || def.jointType === 'steering') {
          c.enableMotor();
          c.setMotorMaxForce(b.settings.speed != null ? (BLOCK_DEFS[b.type].defaultMaxForce || 200) : 200);
          c.setMotorSpeed(0);
        }
        this.constraints.push(rec);
      }
    }
    // 分离器约束（可被 V 断开）
    for (const b of blocks) {
      if (b.type !== 'decoupler' || this.decoupled.has(b.id)) continue;
    }
  }

  /* ============ 每帧控制 ============ */
  update(dt) {
    if (!this.running) return;
    this._flushOps();
    this.time += dt;
    const keys = this.keys;
    const held = code => !!keys[code];

    for (const b of this.machine.blocks) {
      if (b.dead) continue;
      const def = BLOCK_DEFS[b.type];
      const s = b.settings || {};
      // ---- 动力轮 / 转子 ----
      const rec = this.constraints.find(r => r.block === b);
      if (rec && (rec.type === 'wheel' || rec.type === 'rotor')) {
        let sp = 0;
        if (s.keys) {
          if (held(s.keys[0])) sp = 1;
          if (s.keys[1] && held(s.keys[1])) sp = -1;
        }
        if (s.reverse) sp = -sp;
        rec.c.setMotorSpeed(sp * (s.speed || 10));
        rec.c.setMotorMaxForce(sp !== 0 ? (BLOCK_DEFS[b.type].defaultMaxForce || 220) : 8);
      }
      // ---- 转向铰链（伺服）----
      if (rec && rec.type === 'steering') {
        let target = 0;
        const lim = BLOCK_DEFS.steeringHinge.defaultLimit;
        if (s.keys) {
          if (held(s.keys[0])) target = lim;
          if (s.keys[1] && held(s.keys[1])) target = -lim;
        }
        if (s.reverse) target = -target;
        // 当前角 = bodyA/bodyB 相对角在轴上的扭转
        const qa = U.toTQ(rec.bodyA.quaternion), qb = U.toTQ(rec.bodyB.quaternion);
        const qRel = qa.clone().invert().multiply(qb);
        const axisLocalA = rec.axisWorld.clone(); // 初始时 bodyA 未旋转
        const cur = U.twistAngle(qRel, axisLocalA);
        const err = target - cur;
        // 注意：cannon 铰链马达正速度对应本测量的负方向
        rec.c.setMotorSpeed(-U.clamp(err * 8, -(s.speed || 4), s.speed || 4));
        rec.c.setMotorMaxForce(500);
      }
      // ---- 螺旋桨 ----
      if (b.type === 'propeller' && b.island) {
        const blades = b.mesh.getObjectByName('propBlades');
        if (s.keys && held(s.keys[0])) {
          const wq = this._blockWorldQuat(b);
          const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(wq);
          const pos = this._blockWorldPos(b);
          b.island.body.applyForce(U.toC(dir.multiplyScalar(s.thrust || 60)), U.toC(pos));
          if (blades) blades.rotation.z += dt * 40;
          if (Math.random() < .3) this.particles.smokePuff(pos.x, pos.y, pos.z, 1, .4);
        } else if (blades) blades.rotation.z += dt * 2;
      }
      // ---- 气球浮力 ----
      if (b.type === 'balloon' && b.island && !b.popped) {
        const pos = this._blockWorldPos(b);
        const wq = this._blockWorldQuat(b);
        const off = new THREE.Vector3(0, 0, 1.9).applyQuaternion(wq).add(pos);
        b.island.body.applyForce(U.cv3(0, BLOCK_DEFS.balloon.buoyancy, 0), U.toC(off));
      }
      // ---- 加农炮 ----
      if (b.type === 'cannon' && b.island) {
        b.cool = Math.max(0, (b.cool || 0) - dt);
        if (s.keys && held(s.keys[0]) && b.cool <= 0) {
          b.cool = BLOCK_DEFS.cannon.defaultCooldown;
          this._fireCannon(b);
        }
      }
      // ---- 火焰喷射器 ----
      if (b.type === 'flamethrower' && b.island && s.keys && held(s.keys[0])) {
        this._sprayFlame(b, dt);
      }
      // ---- 活塞 ----
      if (b.type === 'piston' && b.island) {
        const want = s.keys && held(s.keys[0]) ? 1 : 0;
        b.ext = U.lerp(b.ext || 0, want, dt * 8);
        const rod = b.mesh.getObjectByName('pistonRod');
        const head = b.mesh.getObjectByName('pistonHead');
        if (rod) { rod.position.z = .2 + b.ext * .5; rod.scale.z = 1 + b.ext * 1.2; }
        if (head) head.position.z = .72 + b.ext * 1.0;
        if (want && b.ext > .2) this._pistonPush(b, dt);
      }
      // ---- 分离器 ----
      if (b.type === 'decoupler' && s.keys && held(s.keys[0]) && !this.decoupled.has(b.id)) {
        this._decouple(b);
      }
      // ---- 抓取器松开 ----
      if (b.type === 'grabber' && s.keys && held(s.keys[0]) && this.grabJoints.length) {
        for (const g of this.grabJoints) this.cworld.removeConstraint(g);
        this.grabJoints = [];
        this.machine.blocks.forEach(x => { if (x.type === 'grabber') x.grabbed = false; });
        SFX.click();
      }
    }

    this._updateProjectiles(dt);
    this._updateBurning(dt);
  }

  _blockWorldPos(b) {
    const isl = b.island;
    const e = isl.blocks.find(x => x.block === b);
    return U.toT(isl.body.position).add(e.relPos.clone().applyQuaternion(U.toTQ(isl.body.quaternion)));
  }
  _blockWorldQuat(b) {
    const isl = b.island;
    const e = isl.blocks.find(x => x.block === b);
    return U.toTQ(isl.body.quaternion).multiply(e.relQuat);
  }

  /* ============ 武器 ============ */
  _fireCannon(b) {
    const wq = this._blockWorldQuat(b);
    const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(wq);
    const pos = this._blockWorldPos(b).add(dir.clone().multiplyScalar(BLOCK_DEFS.cannon.muzzleOffset));
    const body = new CANNON.Body({ mass: 5, material: MAT_BLOCK });
    body.addShape(new CANNON.Sphere(.3));
    body.position.set(pos.x, pos.y, pos.z);
    const v = dir.clone().multiplyScalar(BLOCK_DEFS.cannon.projectileSpeed);
    body.velocity.set(v.x, v.y, v.z);
    body.isProjectile = true;
    this.cworld.addBody(body);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(.3, 10, 8), U.mat.darkmetal);
    mesh.castShadow = true;
    this.scene.add(mesh);
    const proj = { body, mesh, ttl: 8, damage: 160 };
    body.addEventListener('collide', ev => this._projectileHit(proj, ev));
    this.projectiles.push(proj);
    // 后座力
    b.island.body.applyImpulse(U.toC(dir.clone().multiplyScalar(-BLOCK_DEFS.cannon.recoil)), U.toC(pos));
    this.particles.muzzleFlash(pos.x, pos.y, pos.z, dir);
    SFX.cannon();
  }

  _projectileHit(proj, ev) {
    if (proj.hitDone) return;
    const other = ev.body;
    const rv = ev.contact.getImpactVelocityAlongNormal();
    if (Math.abs(rv) < 2) return;
    proj.hitDone = true;
    const shape = ev.contact.si.body === other ? ev.contact.si : ev.contact.sj;
    const shapeOwnerId = shape.blockOwnerId;
    this._defer(() => {
      const p = U.toT(proj.body.position);
      if (other.entityRef) this._hurtEntity(other.entityRef, proj.damage, p);
      else if (other.simIsland && shapeOwnerId) {
        const block = this.machine.blocks.find(b => b.id === shapeOwnerId);
        if (block) this._damageBlock(block, proj.damage, p);
      }
      this.particles.smokePuff(p.x, p.y, p.z, 5, .8);
      SFX.crack();
    });
    proj.ttl = Math.min(proj.ttl, 1.5);
  }

  _updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.ttl -= dt;
      p.mesh.position.copy(p.body.position);
      p.mesh.quaternion.copy(p.body.quaternion);
      if (p.ttl <= 0) {
        this.cworld.removeBody(p.body); this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  _sprayFlame(b, dt) {
    const wq = this._blockWorldQuat(b);
    const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(wq);
    const pos = this._blockWorldPos(b).add(dir.clone().multiplyScalar(.6));
    this.particles.flame(pos.x, pos.y, pos.z, dir);
    // 范围检测：点燃 / 伤害
    const range = BLOCK_DEFS.flamethrower.flameRange;
    const end = pos.clone().add(dir.clone().multiplyScalar(range));
    for (const e of SimRegistry.entities) {
      if (e.dead || !e.body) continue;
      const d = this._distToSegment(U.toT(e.body.position), pos, end);
      if (d < 1.6) {
        this._hurtEntity(e, 45 * dt, U.toT(e.body.position));
        if (e.flammable && !e.burning) this._igniteEntity(e);
      }
    }
    // 点燃自己机器以外的岛 & 其他方块
    for (const isl of this.islands) {
      if (isl === b.island) continue;
      for (const eb of isl.blocks) {
        const bp = this._blockWorldPos(eb.block);
        if (this._distToSegment(bp, pos, end) < 1.4) this._igniteBlock(eb.block);
      }
    }
  }

  _distToSegment(p, a, b) {
    const ab = b.clone().sub(a), t = U.clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1);
    return p.distanceTo(a.clone().addScaledVector(ab, t));
  }

  _pistonPush(b, dt) {
    const wq = this._blockWorldQuat(b);
    const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(wq);
    const pos = this._blockWorldPos(b);
    const tip = pos.clone().add(dir.clone().multiplyScalar(1.2 + (b.ext || 0)));
    for (const e of SimRegistry.entities) {
      if (e.dead || !e.body || e.body.mass === 0) continue;
      if (U.toT(e.body.position).distanceTo(tip) < 1.5) {
        e.body.wakeUp && e.body.wakeUp();
        e.body.applyImpulse(U.toC(dir.clone().multiplyScalar(30 * dt * 60 * 0.15)), e.body.position);
      }
    }
  }

  _decouple(b) {
    this.decoupled.add(b.id);
    SFX.click();
    // 记录当前状态并重建
    this._rebuildWithState();
    // 分离方向小冲量
    const child = this.machine.blocks.find(x => x.id === b.id);
    if (child && child.island) {
      const wq = this._blockWorldQuat(child);
      const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(wq);
      child.island.body.applyImpulse(U.toC(dir.multiplyScalar(8)), child.island.body.position);
    }
  }

  _rebuildWithState() {
    const carry = new Map();
    for (const isl of this.islands) {
      const bq = U.toTQ(isl.body.quaternion), bp = U.toT(isl.body.position);
      for (const e of isl.blocks) {
        carry.set(e.block.id, {
          pos: e.relPos.clone().applyQuaternion(bq).add(bp),
          quat: bq.clone().multiply(e.relQuat),
          vel: isl.body.velocity.clone(),
          angVel: isl.body.angularVelocity.clone(),
        });
      }
    }
    this._buildIslands(carry);
  }

  /* ============ 碰撞 / 伤害 ============ */
  _onCollide(ev) {
    if (!this.running) return;
    const impact = Math.abs(ev.contact.getImpactVelocityAlongNormal());
    const target = ev.target, other = ev.body;
    // 找到被撞的 shape 对应方块（contact 数据是池化的，必须立刻取出）
    const shape = ev.contact.si.body === target ? ev.contact.si : ev.contact.sj;
    const blockId = shape.blockOwnerId;
    const targetMass = target.mass || 1;
    const otherEnt = other.entityRef || null;
    const otherPos = U.toT(other.position);

    this._defer(() => {
      const block = blockId ? this.machine.blocks.find(b => b.id === blockId && !b.dead) : null;
      // 我方尖刺对外伤害
      if (block && block.type === 'spike' && otherEnt) {
        this._hurtEntity(otherEnt, BLOCK_DEFS.spike.contactDamage, otherPos);
      }
      // 抓取器：碰到就抓
      if (block && block.type === 'grabber' && block.island && other !== block.island.body && !block.grabbed) {
        block.grabbed = true;
        this.tryGrab(block, other);
      }
      // 炸弹引爆
      if (block && block.type === 'bomb' && impact > 7) {
        this._explodeBlock(block);
        return;
      }
      if (impact < 6) return;
      // 撞击伤害到我方方块
      if (block) {
        const dmg = (impact - 6) * 14;
        this._damageBlock(block, dmg, block.island ? this._blockWorldPos(block) : null);
      }
      // 对环境实体伤害（撞击方为机器岛）
      if (otherEnt) {
        const dmg = (impact - 5) * (4 + Math.min(targetMass, 30) * 0.9);
        if (dmg > 0) this._hurtEntity(otherEnt, dmg, otherPos);
      }
    });
  }

  _damageBlock(block, dmg, point) {
    if (block.dead || block.type === 'core') { // 核心也可受伤但更硬
      if (block.type === 'core') {
        block.hp -= dmg * .5;
        if (block.hp <= 0 && !block.dead) this._breakBlock(block);
      }
      return;
    }
    block.hp -= dmg;
    if (point && dmg > 20) this.particles.splinters(point.x, point.y, point.z, [.55, .38, .18], 5);
    if (block.hp <= 0) this._breakBlock(block);
  }

  _breakBlock(block) {
    if (block.dead) return;
    block.dead = true;
    const p = this._blockWorldPos ? (block.island ? this._blockWorldPos(block) : block.anchor) : block.anchor;
    this.particles.splinters(p.x, p.y, p.z, [.5, .35, .15], 14);
    SFX.crack();
    if (block.type === 'bomb') { this._explodeAt(p, BLOCK_DEFS.bomb); }
    if (block.type === 'balloon') block.popped = true;
    block.mesh.visible = false;
    this._rebuildWithState();
  }

  _explodeBlock(block) {
    if (block.dead) return;
    block.dead = true;
    const p = this._blockWorldPos(block);
    block.mesh.visible = false;
    this._explodeAt(p, BLOCK_DEFS.bomb);
    this._rebuildWithState();
  }

  _explodeAt(p, def) {
    const R = def.explosionRadius, F = def.explosionForce, D = def.explosionDamage;
    this.particles.explosion(p.x, p.y, p.z, R * .8);
    SFX.explosion();
    const pc = U.toC(p);
    const hit = body => {
      const d = body.position.distanceTo(pc);
      if (d > R || body.mass === 0) return 0;
      const fall = 1 - d / R;
      const dir = body.position.vsub(pc); dir.y += 1.2; dir.normalize();
      body.wakeUp && body.wakeUp();
      body.applyImpulse(dir.scale(F * fall * .02 * Math.min(body.mass, 40)), body.position);
      return fall;
    };
    for (const e of SimRegistry.entities) {
      if (e.dead || !e.body) continue;
      const fall = hit(e.body);
      if (fall > 0) { this._hurtEntity(e, D * fall, U.toT(e.body.position)); if (e.flammable && fall > .4) this._igniteEntity(e); }
    }
    for (const isl of this.islands) {
      const fall = hit(isl.body);
      if (fall > 0) {
        for (const eb of isl.blocks) {
          const bp = this._blockWorldPos(eb.block);
          const d = bp.distanceTo(p);
          if (d < R) this._damageBlock(eb.block, D * (1 - d / R), bp);
        }
      }
    }
  }

  /* ============ 火焰 ============ */
  _igniteBlock(block) {
    if (block.dead || block.burning) return;
    const def = BLOCK_DEFS[block.type];
    // 金属不可燃
    if (['ballast', 'metalPlate', 'cannon', 'spike'].includes(block.type)) return;
    block.burning = true;
    this.burning.push({ target: 'block', ref: block, t: 0 });
  }
  _igniteEntity(e) {
    if (e.dead || e.burning) return;
    e.burning = true;
    this.burning.push({ target: 'entity', ref: e, t: 0 });
  }
  _updateBurning(dt) {
    for (let i = this.burning.length - 1; i >= 0; i--) {
      const f = this.burning[i];
      f.t += dt;
      if (f.target === 'block') {
        const b = f.ref;
        if (b.dead) { this.burning.splice(i, 1); continue; }
        const p = b.island ? this._blockWorldPos(b) : U.toT(b.anchor);
        this.particles.fire(p.x, p.y, p.z, .8);
        this._damageBlock(b, 26 * dt, null);
        // 蔓延
        if (Math.random() < dt * .9 && b.island) {
          for (const eb of b.island.blocks) {
            if (eb.block !== b && !eb.block.burning && this._blockWorldPos(eb.block).distanceTo(p) < 2.1) {
              this._igniteBlock(eb.block); break;
            }
          }
        }
        if (b.type === 'bomb') this._explodeBlock(b);
      } else {
        const e = f.ref;
        if (e.dead || !e.body) { this.burning.splice(i, 1); continue; }
        const p = U.toT(e.body.position);
        this.particles.fire(p.x, p.y + .5, p.z, .9);
        this._hurtEntity(e, 22 * dt, p);
        if (f.t > 8) { e.burning = false; this.burning.splice(i, 1); }
      }
    }
  }

  _hurtEntity(e, dmg, point) {
    if (e.dead) return;
    e.hp -= dmg;
    if (e.onDamage) e.onDamage(dmg, point);
    if (e.hp <= 0) {
      e.dead = true;
      if (e.onDestroy) e.onDestroy();
    }
  }

  /* ============ 抓取器（碰撞时挂接） ============ */
  tryGrab(grabberBlock, otherBody) {
    if (this.grabJoints.length > 6) return;
    const islBody = grabberBlock.island.body;
    if (otherBody.mass === 0) return; // 不抓地面
    const c = new CANNON.LockConstraint(islBody, otherBody, { maxForce: 1e5 });
    this.cworld.addConstraint(c);
    this.grabJoints.push(c);
    SFX.click();
  }

  /* ============ 每步后同步网格 ============ */
  _afterStep() {
    for (const isl of this.islands) {
      const bq = U.toTQ(isl.body.quaternion), bp = U.toT(isl.body.position);
      for (const e of isl.blocks) {
        if (e.block.dead) continue;
        e.block.mesh.position.copy(e.relPos.clone().applyQuaternion(bq).add(bp));
        e.block.mesh.quaternion.copy(bq.clone().multiply(e.relQuat));
      }
    }
  }

  corePosition() {
    const core = this.machine.core;
    if (this.running && core.island) return this._blockWorldPos(core);
    return null;
  }
}

window.Simulation = Simulation;
window.SimRegistry = SimRegistry;
window.MAT_GROUND = MAT_GROUND;
window.MAT_BLOCK = MAT_BLOCK;
window.MAT_WHEEL = MAT_WHEEL;
