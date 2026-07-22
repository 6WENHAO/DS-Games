/* ============ 围攻 Web —— 零件库 ============ */
'use strict';

// ---- 约定 ----
// 每个零件的 local 空间里 +Z 为 "安装面方向"（即该面用来贴合父方块的表面）
// 零件占据的网格单元以整数坐标描述（安装锚点为原点）
// physicsShapes 返回 CANNON.Shape 数组，每个 shape 带 blockShapeOffset + blockShapeQuat
// buildMesh 返回 THREE.Group

const BLOCK_DEFS = {};
const BLOCK_CATS = [
  { id: 'basic', name: '基础' },
  { id: 'mech', name: '机械' },
  { id: 'weapon', name: '武器' },
  { id: 'flight', name: '飞行' },
  { id: 'armor', name: '装甲' },
  { id: 'tool', name: '工具' },
];

const S = 1; // 单元尺寸 = 1 米

// ================== 内部辅助 ==================
function _boxGeo(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
function _cylGeo(r, h, seg) { return new THREE.CylinderGeometry(r, r, h, seg || 16); }

function _cellKey(x, y, z) { return x + ',' + y + ',' + z; }

// 检查一组 cell 是否会被现有方块阻挡
function _cellsFree(cells, anchor, quat, occupied) {
  for (const [cx, cy, cz] of cells) {
    const w = new THREE.Vector3(cx, cy, cz).applyQuaternion(quat);
    const k = _cellKey(anchor.x + Math.round(w.x), anchor.y + Math.round(w.y), anchor.z + Math.round(w.z));
    if (occupied[k]) return false;
  }
  return true;
}

// 标记 / 移除 占据单元
function _markCells(cells, anchor, quat, occupied, val) {
  for (const [cx, cy, cz] of cells) {
    const w = new THREE.Vector3(cx, cy, cz).applyQuaternion(quat);
    const k = _cellKey(anchor.x + Math.round(w.x), anchor.y + Math.round(w.y), anchor.z + Math.round(w.z));
    if (val) occupied[k] = val; else delete occupied[k];
  }
}

function _boxShape(w, h, d, offX, offY, offZ) {
  const shape = new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2));
  shape.blockShapeOffset = new CANNON.Vec3(offX || 0, offY || 0, offZ || 0);
  shape.blockShapeQuat = new CANNON.Quaternion();
  return shape;
}

function _cylShape(r, h, offY) {
  const shape = new CANNON.Cylinder(r, r, h, 12);
  shape.blockShapeOffset = new CANNON.Vec3(0, offY || 0, 0);
  shape.blockShapeQuat = new CANNON.Quaternion();
  return shape;
}

// ================== 零件定义 ==================

BLOCK_DEFS.core = {
  id: 'core', name: '核心方块', cat: 'basic',
  desc: '机械的心脏，不可摧毁不可删除。保护好它！',
  mass: 2.5, health: 400,
  buildMesh() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(_boxGeo(S, S, S), U.mat.core));
    const faceM = new THREE.MeshBasicMaterial({ map: U.tex.coreFace, transparent: true });
    const f = new THREE.Mesh(new THREE.PlaneGeometry(S * .85, S * .85), faceM);
    f.position.z = S / 2 + .005; g.add(f);
    const topM = new THREE.MeshBasicMaterial({ map: U.tex.coreTop, transparent: true });
    const t = new THREE.Mesh(new THREE.PlaneGeometry(S * .85, S * .85), topM);
    t.position.y = S / 2 + .005; t.rotation.x = -Math.PI / 2; g.add(t);
    return g;
  },
  physicsShapes() { return [_boxShape(S, S, S)]; },
  cells: [[0, 0, 0]],
  orientationSteps: 1,
};

BLOCK_DEFS.smallBlock = {
  id: 'smallBlock', name: '小木块', cat: 'basic',
  desc: '1x1 基础木块，机械的骨架。',
  mass: 0.8, health: 150,
  buildMesh() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(_boxGeo(S, S, S), U.mat.wood));
    return g;
  },
  physicsShapes() { return [_boxShape(S, S, S)]; },
  cells: [[0, 0, 0]],
  orientationSteps: 1,
};

BLOCK_DEFS.woodBlock = {
  id: 'woodBlock', name: '长木块', cat: 'basic',
  desc: '1x2 长木块，快速延伸结构。',
  mass: 1.4, health: 220,
  buildMesh() {
    const g = new THREE.Group();
    const m = new THREE.Mesh(_boxGeo(S, S, S * 2), U.mat.wood);
    m.position.z = S / 2;
    g.add(m);
    return g;
  },
  physicsShapes() { return [_boxShape(S, S, S * 2, 0, 0, S / 2)]; },
  cells: [[0, 0, 0], [0, 0, 1]],
  orientationSteps: 1,
};

BLOCK_DEFS.woodPole = {
  id: 'woodPole', name: '木杆', cat: 'basic',
  desc: '细长轻质木杆，1x3，适合做长臂。',
  mass: 1.0, health: 130,
  buildMesh() {
    const g = new THREE.Group();
    const m = new THREE.Mesh(_cylGeo(S * .22, S * 3, 10), U.mat.darkwood);
    m.rotation.x = Math.PI / 2; m.position.z = S;
    g.add(m);
    return g;
  },
  physicsShapes() { return [_boxShape(S * .44, S * .44, S * 3, 0, 0, S)]; },
  cells: [[0, 0, 0], [0, 0, 1], [0, 0, 2]],
  orientationSteps: 1,
};

BLOCK_DEFS.woodPlate = {
  id: 'woodPlate', name: '木板', cat: 'armor',
  desc: '2x2 薄木板，用于铺面和防护。按 R 换方向。',
  mass: 1.0, health: 160,
  buildMesh() {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(S * 2, S * 2, S * .25), U.mat.wood);
    m.position.set(S / 2, S / 2, -S * .375);
    g.add(m);
    return g;
  },
  physicsShapes() { return [_boxShape(S * 2, S * 2, S * .25, S / 2, S / 2, -S * .375)]; },
  cells: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]],
  orientationSteps: 4,
};

BLOCK_DEFS.poweredWheel = {
  id: 'poweredWheel', name: '动力轮', cat: 'mech',
  desc: '带马达的大轮子。默认 W 前进 S 后退，可用扳手改键。',
  mass: 1.6, health: 200, isJoint: true, jointType: 'wheel',
  defaultKeys: ['KeyW', 'KeyS'],
  defaultSpeed: 14, defaultMaxForce: 220, defaultReverse: false,
  buildMesh() {
    const g = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.TorusGeometry(S * .85, S * .2, 8, 18), U.mat.tire);
    g.add(tire);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(S * .5, S * .45, S * .5, 12), U.mat.hub);
    hub.rotation.x = Math.PI / 2;
    g.add(hub);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(S * .16, S * .16, S * .6, 8), U.mat.darkmetal);
    axle.rotation.x = Math.PI / 2; axle.position.z = -S * .25;
    g.add(axle);
    for (let i = 0; i < 4; i++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(S * 1.5, S * .1, S * .07), U.mat.darkwood);
      sp.rotation.z = i * Math.PI / 4;
      g.add(sp);
    }
    return g;
  },
  physicsShapes() {
    const c = _cylShape(S * .95, S * .5, 0);
    c.blockShapeQuat.setFromEuler(Math.PI / 2, 0, 0);
    return [c];
  },
  cells: [[0, 0, 0]],
  orientationSteps: 1,
  wheelRadius: S * .95,
  standoff: 0.55, // 轮心距安装面距离
};

BLOCK_DEFS.wheel = {
  id: 'wheel', name: '自由轮', cat: 'mech',
  desc: '无动力小轮，自由旋转，适合做从动轮。',
  mass: 1.2, health: 180, isJoint: true, jointType: 'freeWheel',
  buildMesh() {
    const g = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.TorusGeometry(S * .7, S * .18, 8, 18), U.mat.tire);
    g.add(tire);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(S * .4, S * .35, S * .45, 12), U.mat.hub);
    hub.rotation.x = Math.PI / 2;
    g.add(hub);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(S * .13, S * .13, S * .6, 8), U.mat.darkmetal);
    axle.rotation.x = Math.PI / 2; axle.position.z = -S * .25;
    g.add(axle);
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(S * 1.2, S * .09, S * .06), U.mat.darkwood);
      sp.rotation.z = i * Math.PI / 3;
      g.add(sp);
    }
    return g;
  },
  physicsShapes() {
    const c = _cylShape(S * .8, S * .45, 0);
    c.blockShapeQuat.setFromEuler(Math.PI / 2, 0, 0);
    return [c];
  },
  cells: [[0, 0, 0]],
  orientationSteps: 1,
  wheelRadius: S * .8,
  standoff: 0.5,
};

BLOCK_DEFS.steeringHinge = {
  id: 'steeringHinge', name: '转向铰链', cat: 'mech',
  desc: '受控左右摆动 ±45°，默认 A/D 控制，用于转向。',
  mass: 1.2, health: 200, isJoint: true, jointType: 'steering',
  defaultKeys: ['KeyA', 'KeyD'],
  defaultSpeed: 4, defaultMaxForce: 260, defaultLimit: Math.PI / 4, defaultReverse: false,
  buildMesh() {
    const g = new THREE.Group();
    const base = new THREE.Mesh(_boxGeo(S * .85, S * .85, S * .38), U.mat.metal);
    base.position.z = -S * .31;
    g.add(base);
    const top = new THREE.Mesh(_boxGeo(S * .7, S * .7, S * .38), U.mat.darkmetal);
    top.position.z = S * .18; top.name = 'hingeTop';
    g.add(top);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(S * .16, S * .16, S * .95, 8), U.mat.darkmetal);
    g.add(pin);
    return g;
  },
  physicsShapes() { return [_boxShape(S * .85, S * .85, S * .9)]; },
  cells: [[0, 0, 0]],
  orientationSteps: 4,
};

BLOCK_DEFS.hinge = {
  id: 'hinge', name: '铰链', cat: 'mech',
  desc: '自由摆动的被动铰链，像门轴一样。按 R 换轴向。',
  mass: 0.9, health: 170, isJoint: true, jointType: 'freeHinge',
  buildMesh() {
    const g = new THREE.Group();
    const base = new THREE.Mesh(_boxGeo(S * .85, S * .85, S * .38), U.mat.wood);
    base.position.z = -S * .31;
    g.add(base);
    const top = new THREE.Mesh(_boxGeo(S * .7, S * .7, S * .38), U.mat.darkwood);
    top.position.z = S * .18;
    g.add(top);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(S * .13, S * .13, S * .95, 8), U.mat.metal);
    g.add(pin);
    return g;
  },
  physicsShapes() { return [_boxShape(S * .85, S * .85, S * .9)]; },
  cells: [[0, 0, 0]],
  orientationSteps: 4,
};

BLOCK_DEFS.steeringBlock = {
  id: 'steeringBlock', name: '转向方块', cat: 'mech',
  desc: '绕安装轴连续旋转的马达方块，A/D 控制。',
  mass: 1.0, health: 180, isJoint: true, jointType: 'rotor',
  defaultKeys: ['KeyA', 'KeyD'],
  defaultSpeed: 5, defaultMaxForce: 260, defaultReverse: false,
  buildMesh() {
    const g = new THREE.Group();
    const base = new THREE.Mesh(_cylGeo(S * .45, S * .3, 14), U.mat.metal);
    base.rotation.x = Math.PI / 2; base.position.z = -S * .35;
    g.add(base);
    const top = new THREE.Mesh(_boxGeo(S * .8, S * .8, S * .55), U.mat.wood);
    top.position.z = S * .1;
    g.add(top);
    return g;
  },
  physicsShapes() { return [_boxShape(S * .8, S * .8, S * .9)]; },
  cells: [[0, 0, 0]],
  orientationSteps: 1,
};

BLOCK_DEFS.suspension = {
  id: 'suspension', name: '悬挂', cat: 'mech',
  desc: '弹簧减震连接，让底盘过颠簸时更稳。',
  mass: 1.1, health: 200, isJoint: true, jointType: 'suspension',
  defaultStiffness: 320, defaultDamping: 18,
  buildMesh() {
    const g = new THREE.Group();
    const bot = new THREE.Mesh(_boxGeo(S * .6, S * .6, S * .18), U.mat.metal);
    bot.position.z = -S * .41;
    g.add(bot);
    const top = new THREE.Mesh(_boxGeo(S * .6, S * .6, S * .18), U.mat.metal);
    top.position.z = S * .38;
    g.add(top);
    // 弹簧螺旋（用多个环模拟）
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(S * .26, S * .05, 6, 12), U.mat.red);
      ring.position.z = -S * .25 + i * S * .17;
      g.add(ring);
    }
    return g;
  },
  physicsShapes() { return [_boxShape(S * .6, S * .6, S * .9)]; },
  cells: [[0, 0, 0]],
  orientationSteps: 1,
};

BLOCK_DEFS.piston = {
  id: 'piston', name: '活塞', cat: 'mech',
  desc: '按住 P 伸出约 1 格，松开缩回。可推动物体。',
  mass: 1.3, health: 220, isJoint: true, jointType: 'piston',
  defaultKeys: ['KeyP'], defaultSpeed: 6, defaultRange: 1.0,
  buildMesh() {
    const g = new THREE.Group();
    const base = new THREE.Mesh(_boxGeo(S * .6, S * .6, S * .4), U.mat.metal);
    base.position.z = -S * .3;
    g.add(base);
    const rod = new THREE.Mesh(_cylGeo(S * .22, S * .8, 10), U.mat.darkmetal);
    rod.rotation.x = Math.PI / 2; rod.position.z = S * .2;
    rod.name = 'pistonRod';
    g.add(rod);
    const head = new THREE.Mesh(_boxGeo(S * .55, S * .55, S * .18), U.mat.metal);
    head.position.z = S * .72;
    head.name = 'pistonHead';
    g.add(head);
    return g;
  },
  physicsShapes() { return [_boxShape(S * .6, S * .6, S * .9)]; },
  cells: [[0, 0, 0]],
  orientationSteps: 1,
};

BLOCK_DEFS.decoupler = {
  id: 'decoupler', name: '分离器', cat: 'mech',
  desc: '按 V 断开连接并弹开，用来投放炸弹或抛弃部件。',
  mass: 0.7, health: 140,
  defaultKeys: ['KeyV'],
  buildMesh() {
    const g = new THREE.Group();
    const m = new THREE.Mesh(_boxGeo(S * .7, S * .7, S * 1.0), U.mat.metal);
    g.add(m);
    const stripe = new THREE.Mesh(_boxGeo(S * .72, S * .72, S * .12), U.mat.red);
    g.add(stripe);
    return g;
  },
  physicsShapes() { return [_boxShape(S * .7, S * .7, S * .9)]; },
  cells: [[0, 0, 0]],
  orientationSteps: 1,
};

BLOCK_DEFS.grabber = {
  id: 'grabber', name: '抓取器', cat: 'mech',
  desc: '碰到什么抓什么（物体或敌人），按 G 松开。',
  mass: 1.4, health: 240,
  defaultKeys: ['KeyG'],
  buildMesh() {
    const g = new THREE.Group();
    const base = new THREE.Mesh(_boxGeo(S * .6, S * .6, S * .5), U.mat.metal);
    base.position.z = -S * .25;
    g.add(base);
    for (let dx = -1; dx <= 1; dx += 2) {
      const claw = new THREE.Mesh(new THREE.BoxGeometry(S * .14, S * .5, S * .5), U.mat.darkmetal);
      claw.position.set(dx * S * .28, 0, S * .22);
      claw.rotation.y = -dx * 0.3;
      g.add(claw);
    }
    return g;
  },
  physicsShapes() { return [_boxShape(S * .7, S * .7, S * .9)]; },
  cells: [[0, 0, 0]],
  orientationSteps: 1,
};

BLOCK_DEFS.cannon = {
  id: 'cannon', name: '加农炮', cat: 'weapon',
  desc: '按 C 发射铁弹，有强烈后座力！注意冷却。',
  mass: 2.5, health: 250,
  defaultKeys: ['KeyC'], defaultCooldown: 1.6,
  buildMesh() {
    const g = new THREE.Group();
    const mount = new THREE.Mesh(_boxGeo(S * .8, S * .5, S * .55), U.mat.darkwood);
    mount.position.z = -S * .22;
    g.add(mount);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(S * .17, S * .23, S * 1.1, 12), U.mat.darkmetal);
    barrel.rotation.x = -Math.PI / 2; barrel.position.z = S * .3;
    g.add(barrel);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(S * .2, S * .045, 6, 14), U.mat.metal);
    ring.position.z = S * .68;
    g.add(ring);
    return g;
  },
  physicsShapes() { return [_boxShape(S * .6, S * .6, S * .95, 0, 0, S * .05)]; },
  cells: [[0, 0, 0]],
  orientationSteps: 1,
  muzzleOffset: S * .9, projectileSpeed: 36, recoil: 110,
};

BLOCK_DEFS.flamethrower = {
  id: 'flamethrower', name: '火焰喷射器', cat: 'weapon',
  desc: '按住 F 喷火，点燃木质结构、绵羊和骑士。',
  mass: 2.0, health: 200,
  defaultKeys: ['KeyF'],
  buildMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(_boxGeo(S * .5, S * .5, S * .6), U.mat.metal);
    body.position.z = -S * .2;
    g.add(body);
    const tank = new THREE.Mesh(_cylGeo(S * .18, S * .45, 10), U.mat.red);
    tank.position.set(0, S * .32, -S * .2);
    tank.rotation.z = Math.PI / 2;
    g.add(tank);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(S * .09, S * .17, S * .5, 8), U.mat.darkmetal);
    nozzle.rotation.x = -Math.PI / 2; nozzle.position.z = S * .38;
    g.add(nozzle);
    return g;
  },
  physicsShapes() { return [_boxShape(S * .5, S * .6, S * .9)]; },
  cells: [[0, 0, 0]],
  orientationSteps: 1,
  flameRange: S * 5,
};

BLOCK_DEFS.spike = {
  id: 'spike', name: '金属尖刺', cat: 'weapon',
  desc: '接触伤害极高，冲撞用。对骑士一击致命。',
  mass: 1.2, health: 260,
  buildMesh() {
    const g = new THREE.Group();
    const base = new THREE.Mesh(_boxGeo(S * .5, S * .5, S * .2), U.mat.metal);
    base.position.z = -S * .4;
    g.add(base);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(S * .22, S * .95, 10), U.mat.darkmetal);
    cone.rotation.x = Math.PI / 2; cone.position.z = S * .15;
    g.add(cone);
    return g;
  },
  physicsShapes() { return [_boxShape(S * .44, S * .44, S * .9)]; },
  cells: [[0, 0, 0]],
  orientationSteps: 1,
  contactDamage: 90,
};

BLOCK_DEFS.bomb = {
  id: 'bomb', name: '炸弹', cat: 'weapon',
  desc: '受猛烈撞击或火烧即爆炸。配合分离器投放。',
  mass: 3.0, health: 60,
  buildMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(S * .48, 16, 12), U.mat.darkmetal);
    g.add(body);
    const fuse = new THREE.Mesh(_cylGeo(S * .05, S * .22, 6), U.mat.red);
    fuse.position.y = S * .55;
    g.add(fuse);
    return g;
  },
  physicsShapes() {
    const s = new CANNON.Sphere(S * .48);
    s.blockShapeOffset = new CANNON.Vec3(0, 0, 0);
    s.blockShapeQuat = new CANNON.Quaternion();
    return [s];
  },
  cells: [[0, 0, 0]],
  orientationSteps: 1,
  explosive: true, explosionRadius: 6, explosionForce: 900, explosionDamage: 320,
};

BLOCK_DEFS.ballast = {
  id: 'ballast', name: '配重石块', cat: 'armor',
  desc: '很重很硬。压低重心或作攻城锤头。',
  mass: 6.0, health: 500,
  buildMesh() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(_boxGeo(S * .98, S * .98, S * .98), U.mat.stone));
    return g;
  },
  physicsShapes() { return [_boxShape(S, S, S)]; },
  cells: [[0, 0, 0]],
  orientationSteps: 1,
};

BLOCK_DEFS.metalPlate = {
  id: 'metalPlate', name: '铁甲板', cat: 'armor',
  desc: '2x2 装甲板，耐撞耐炸，但较重。',
  mass: 2.6, health: 420,
  buildMesh() {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(S * 2, S * 2, S * .3), U.mat.metal);
    m.position.set(S / 2, S / 2, -S * .35);
    g.add(m);
    const rivets = [[-.35, -.35], [1.35, -.35], [-.35, 1.35], [1.35, 1.35]];
    for (const [x, y] of rivets) {
      const r = new THREE.Mesh(new THREE.SphereGeometry(S * .06, 6, 6), U.mat.darkmetal);
      r.position.set(x, y, -S * .19);
      g.add(r);
    }
    return g;
  },
  physicsShapes() { return [_boxShape(S * 2, S * 2, S * .3, S / 2, S / 2, -S * .35)]; },
  cells: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]],
  orientationSteps: 4,
};

BLOCK_DEFS.propeller = {
  id: 'propeller', name: '螺旋桨', cat: 'flight',
  desc: '按住 H 沿安装方向产生推力，扇叶会转。',
  mass: 1.0, health: 160,
  defaultKeys: ['KeyH'], defaultThrust: 60,
  buildMesh() {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(_cylGeo(S * .1, S * .6, 8), U.mat.darkmetal);
    shaft.rotation.x = Math.PI / 2; shaft.position.z = -S * .2;
    g.add(shaft);
    const hub = new THREE.Mesh(_cylGeo(S * .14, S * .3, 8), U.mat.metal);
    hub.rotation.x = Math.PI / 2; hub.position.z = S * .1;
    g.add(hub);
    const blades = new THREE.Group();
    blades.name = 'propBlades';
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(S * 1.05, S * .2, S * .04), U.mat.wood);
      blade.position.set(Math.cos(i * Math.PI * 2 / 3) * S * .55, Math.sin(i * Math.PI * 2 / 3) * S * .55, 0);
      blade.rotation.z = i * Math.PI * 2 / 3;
      blade.rotation.y = 0.35;
      blades.add(blade);
    }
    blades.position.z = S * .22;
    g.add(blades);
    return g;
  },
  physicsShapes() { return [_boxShape(S * .4, S * .4, S * .5)]; },
  cells: [[0, 0, 0]],
  orientationSteps: 1,
};

BLOCK_DEFS.balloon = {
  id: 'balloon', name: '气球', cat: 'flight',
  desc: '提供持续升力，被火烧或戳破会失效。',
  mass: 0.4, health: 40,
  buildMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(S * 1.05, 16, 12), U.mat.balloon);
    body.scale.y = 1.2;
    body.position.z = S * 1.9; body.name = 'balloonBody';
    g.add(body);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(S * .04, S * .04, S * 1.4, 6), U.mat.rope);
    rope.rotation.x = Math.PI / 2; rope.position.z = S * .2;
    g.add(rope);
    return g;
  },
  physicsShapes() {
    const s = new CANNON.Sphere(S * 1.05);
    s.blockShapeOffset = new CANNON.Vec3(0, 0, S * 1.9);
    s.blockShapeQuat = new CANNON.Quaternion();
    return [s];
  },
  cells: [[0, 0, 0], [0, 0, 1], [0, 0, 2]],
  orientationSteps: 1,
  buoyancy: 30,
};

// ================== 工具（非零件） ==================
const TOOL_DEFS = [
  { id: 'tool_wrench', name: '扳手', icon: '🔧', desc: '点击已放置零件修改按键与参数。' },
  { id: 'tool_erase', name: '拆除锤', icon: '🔨', desc: '点击零件删除（或直接右键）。' },
];

// ================== 暴露 API ==================
window.BLOCK_DEFS = BLOCK_DEFS;
window.BLOCK_CATS = BLOCK_CATS;
window.TOOL_DEFS = TOOL_DEFS;
window.BLOCK_S = S;
window._cellKey = _cellKey;
window._cellsFree = _cellsFree;
window._markCells = _markCells;
