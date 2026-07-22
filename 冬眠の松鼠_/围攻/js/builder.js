/* ============ 围攻 Web —— 建造系统 ============ */
'use strict';

/*
 * Machine 数据模型：
 *   blocks: [{ id, type, anchor:{x,y,z}(整数格), quat:THREE.Quaternion, parentId,
 *              attachFace:THREE.Vector3(父块表面法向，世界格空间), settings:{...}, mesh }]
 * 建造空间以核心方块为原点的整数网格。y=0 平面是地面上方 (放置时整体抬升)。
 * 支持：放置(表面吸附)/删除(级联可选)/R旋转/撤销/序列化。
 */

const BUILD_Y0 = 2; // 核心方块的世界高度（格）

class Machine {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.blocks = [];
    this.occupied = {}; // cellKey -> blockId
    this.nextId = 1;
    this.undoStack = [];
  }

  /* ---------- 查询 ---------- */
  byId(id) { return this.blocks.find(b => b.id === id); }
  get core() { return this.blocks[0]; }
  count() { return this.blocks.length; }

  /* ---------- 放置 ---------- */
  // anchor: 整数格坐标 THREE.Vector3, quat: 朝向
  canPlace(type, anchor, quat) {
    const def = BLOCK_DEFS[type];
    return _cellsFree(def.cells, anchor, quat, this.occupied);
  }

  addBlock(type, anchor, quat, parentId, attachFace, settings, skipUndo, forceId) {
    const def = BLOCK_DEFS[type];
    if (!this.canPlace(type, anchor, quat)) return null;
    const b = {
      id: forceId != null ? forceId : this.nextId++,
      type,
      anchor: anchor.clone(),
      quat: quat.clone(),
      parentId: parentId != null ? parentId : null,
      attachFace: attachFace ? attachFace.clone() : new THREE.Vector3(0, 0, 1),
      settings: Object.assign(this.defaultSettings(type), settings || {}),
      mesh: null,
    };
    if (forceId != null) this.nextId = Math.max(this.nextId, forceId + 1);
    b.mesh = def.buildMesh();
    // 动力轮方向启发：使 ↑ 统一朝核心面(+Z)前进（±X 侧装）或统一朝 +X（±Z 侧装）
    if (type === 'poweredWheel' && (!settings || settings.reverse == null) && attachFace) {
      if (attachFace.x > 0.5) b.settings.reverse = true;
      else if (attachFace.x < -0.5) b.settings.reverse = false;
      else if (attachFace.z < -0.5) b.settings.reverse = true;
      else if (attachFace.z > 0.5) b.settings.reverse = false;
    }
    b.mesh.position.copy(anchor);
    b.mesh.quaternion.copy(quat);
    b.mesh.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    b.mesh.userData.blockId = b.id;
    this.group.add(b.mesh);
    _markCells(def.cells, anchor, quat, this.occupied, b.id);
    this.blocks.push(b);
    if (!skipUndo) this.undoStack.push({ op: 'add', id: b.id });
    return b;
  }

  defaultSettings(type) {
    const def = BLOCK_DEFS[type];
    const s = {};
    if (def.defaultKeys) s.keys = def.defaultKeys.slice();
    if (def.defaultSpeed != null) s.speed = def.defaultSpeed;
    if (def.defaultReverse != null) s.reverse = def.defaultReverse;
    if (def.defaultThrust != null) s.thrust = def.defaultThrust;
    return s;
  }

  removeBlock(id, skipUndo) {
    const idx = this.blocks.findIndex(b => b.id === id);
    if (idx <= 0) return false; // 0 = 核心不可删
    // 级联收集子树（后序：子先父后）
    const toRemove = [];
    const collect = pid => {
      for (const b of this.blocks) if (b.parentId === pid) collect(b.id);
      const blk = this.byId(pid);
      if (blk) toRemove.push(blk);
    };
    collect(id);
    const serialized = toRemove.slice().reverse().map(b => this.serializeBlock(b)); // 父先子后，便于恢复
    for (const b of toRemove) {
      const def = BLOCK_DEFS[b.type];
      _markCells(def.cells, b.anchor, b.quat, this.occupied, null);
      this.group.remove(b.mesh);
      const i = this.blocks.indexOf(b);
      if (i >= 0) this.blocks.splice(i, 1);
    }
    if (!skipUndo) this.undoStack.push({ op: 'removeTree', data: serialized });
    return true;
  }

  undo() {
    const act = this.undoStack.pop();
    if (!act) return;
    if (act.op === 'add') this.removeBlock(act.id, true);
    else if (act.op === 'removeTree') {
      for (const d of act.data) {
        this.addBlock(d.type, new THREE.Vector3(...d.a), new THREE.Quaternion(...d.q),
          d.p, new THREE.Vector3(...d.f), d.s, true, d.id);
      }
    }
    else if (act.op === 'clear') { for (const d of act.data) this.deserializeBlock(d, true); }
    SFX.click();
  }

  clearAll() {
    const saved = this.blocks.slice(1).map(b => this.serializeBlock(b));
    if (saved.length) this.undoStack.push({ op: 'clear', data: saved });
    while (this.blocks.length > 1) this.removeBlock(this.blocks[this.blocks.length - 1].id, true);
  }

  /* ---------- 序列化 ---------- */
  serializeBlock(b) {
    return {
      id: b.id, type: b.type,
      a: [b.anchor.x, b.anchor.y, b.anchor.z],
      q: [b.quat.x, b.quat.y, b.quat.z, b.quat.w],
      p: b.parentId,
      f: [b.attachFace.x, b.attachFace.y, b.attachFace.z],
      s: JSON.parse(JSON.stringify(b.settings)),
    };
  }
  deserializeBlock(d, skipUndo) {
    const b = this.addBlock(d.type,
      new THREE.Vector3(...d.a),
      new THREE.Quaternion(...d.q),
      d.p, new THREE.Vector3(...d.f), d.s, skipUndo, d.id);
    return b;
  }
  serialize() { return { v: 1, blocks: this.blocks.map(b => this.serializeBlock(b)) }; }
  loadFrom(data) {
    while (this.blocks.length > 1) this.removeBlock(this.blocks[this.blocks.length - 1].id, true);
    this.undoStack.length = 0;
    if (!data || !data.blocks) return;
    // 旧存档按键迁移（方向键 → WASD）
    const MIGRATE = { ArrowUp: 'KeyW', ArrowDown: 'KeyS', ArrowLeft: 'KeyA', ArrowRight: 'KeyD' };
    // 保序加载（跳过核心，核心已存在）
    const idMap = { };
    if (data.blocks.length) idMap[data.blocks[0].id] = this.core.id;
    for (let i = 1; i < data.blocks.length; i++) {
      const d = data.blocks[i];
      if (d.s && d.s.keys) d.s.keys = d.s.keys.map(k => MIGRATE[k] || k);
      const b = this.addBlock(d.type, new THREE.Vector3(...d.a), new THREE.Quaternion(...d.q),
        idMap[d.p] != null ? idMap[d.p] : null, new THREE.Vector3(...d.f), d.s, true);
      if (b) idMap[d.id] = b.id;
    }
  }

  setVisible(v) { this.group.visible = v; }
}

/* ================= Builder：交互控制 ================= */
class Builder {
  constructor(machine, scene, camera) {
    this.machine = machine;
    this.scene = scene;
    this.camera = camera;
    this.currentType = 'smallBlock';
    this.currentTool = null; // 'tool_wrench' | 'tool_erase' | null
    this.rotStep = 0;        // R 键旋转档位
    this.raycaster = new THREE.Raycaster();
    this.ghost = null;       // 幽灵预览
    this.ghostOk = false;
    this.hover = null;       // { block, faceNormal(世界), anchor, quat }
    this._buildGhost();
    // 地面吸附平面（供轮子等放在侧面判断用，这里仅零件面吸附，不吸附地面）
  }

  _buildGhost() {
    if (this.ghost) this.scene.remove(this.ghost);
    const def = BLOCK_DEFS[this.currentType];
    this.ghost = def.buildMesh();
    this.ghost.traverse(o => {
      if (o.isMesh) { o.material = U.mat.ghostOk; o.castShadow = false; }
    });
    this.ghost.visible = false;
    this.scene.add(this.ghost);
  }

  setType(type) {
    this.currentType = type;
    this.currentTool = null;
    this.rotStep = 0;
    this._buildGhost();
  }
  setTool(toolId) {
    this.currentTool = toolId;
    if (this.ghost) this.ghost.visible = false;
  }

  rotate() {
    const def = BLOCK_DEFS[this.currentType];
    this.rotStep = (this.rotStep + 1) % Math.max(def.orientationSteps, 4);
    SFX.click();
  }

  // 计算鼠标指向的放置位置
  updateHover(mouseNDC) {
    this.hover = null;
    if (this.currentTool) { this.ghost.visible = false; return this._hoverToolTarget(mouseNDC); }
    this.raycaster.setFromCamera(mouseNDC, this.camera);
    const hits = this.raycaster.intersectObjects(this.machine.group.children, true);
    if (!hits.length) { this.ghost.visible = false; return null; }
    const hit = hits[0];
    // 找 blockId
    let obj = hit.object, blockId = null;
    while (obj) { if (obj.userData && obj.userData.blockId) { blockId = obj.userData.blockId; break; } obj = obj.parent; }
    if (!blockId) { this.ghost.visible = false; return null; }
    const parent = this.machine.byId(blockId);
    // 世界法向 → 吸附到轴
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    const axis = U.snapAxis(n);
    // 关键修正：从"命中方块实际占据的格"中找离命中点最近的格，
    // 避免点到轮胎/炮管等超出格子的几何体时放置位置偏移
    const pDef = BLOCK_DEFS[parent.type];
    const probe = hit.point.clone().addScaledVector(axis, -0.45);
    let hitCell = null, bestD = Infinity;
    for (const [cx, cy, cz] of pDef.cells) {
      const w = new THREE.Vector3(cx, cy, cz).applyQuaternion(parent.quat);
      const cell = new THREE.Vector3(
        parent.anchor.x + Math.round(w.x),
        parent.anchor.y + Math.round(w.y),
        parent.anchor.z + Math.round(w.z));
      const d = cell.distanceToSquared(probe);
      if (d < bestD) { bestD = d; hitCell = cell; }
    }
    const anchor = hitCell.clone().add(axis);
    // 朝向：+Z 对齐 -axis（安装面朝向父块）→ 视觉上零件"长"在表面外侧
    // 我们让零件 +Z 从表面向外：+Z 对齐 axis
    let quat = U.alignZTo(axis);
    // R 旋转：绕安装轴转 rotStep*90°
    if (this.rotStep) {
      const rq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), this.rotStep * Math.PI / 2);
      quat = quat.multiply(rq);
    }
    const ok = this.machine.canPlace(this.currentType, anchor, quat);
    this.hover = { parent, axis, anchor, quat, ok };
    // 更新 ghost
    this.ghost.visible = true;
    this.ghost.position.copy(anchor);
    this.ghost.quaternion.copy(quat);
    const mat = ok ? U.mat.ghostOk : U.mat.ghostBad;
    this.ghost.traverse(o => { if (o.isMesh) o.material = mat; });
    return this.hover;
  }

  _hoverToolTarget(mouseNDC) {
    this.raycaster.setFromCamera(mouseNDC, this.camera);
    const hits = this.raycaster.intersectObjects(this.machine.group.children, true);
    if (!hits.length) return null;
    let obj = hits[0].object, blockId = null;
    while (obj) { if (obj.userData && obj.userData.blockId) { blockId = obj.userData.blockId; break; } obj = obj.parent; }
    if (!blockId) return null;
    this.hover = { toolTarget: this.machine.byId(blockId) };
    return this.hover;
  }

  // 左键
  click() {
    if (this.currentTool === 'tool_erase') {
      if (this.hover && this.hover.toolTarget) {
        if (this.machine.removeBlock(this.hover.toolTarget.id)) SFX.remove();
        return { action: 'remove' };
      }
      return null;
    }
    if (this.currentTool === 'tool_wrench') {
      if (this.hover && this.hover.toolTarget) return { action: 'wrench', block: this.hover.toolTarget };
      return null;
    }
    if (this.hover && this.hover.ok) {
      const b = this.machine.addBlock(this.currentType, this.hover.anchor, this.hover.quat,
        this.hover.parent.id, this.hover.axis);
      if (b) { SFX.place(); return { action: 'add', block: b }; }
    }
    return null;
  }

  // 右键删除
  rightClick(mouseNDC) {
    this.raycaster.setFromCamera(mouseNDC, this.camera);
    const hits = this.raycaster.intersectObjects(this.machine.group.children, true);
    if (!hits.length) return false;
    let obj = hits[0].object, blockId = null;
    while (obj) { if (obj.userData && obj.userData.blockId) { blockId = obj.userData.blockId; break; } obj = obj.parent; }
    if (blockId && this.machine.removeBlock(blockId)) { SFX.remove(); return true; }
    return false;
  }

  hideGhost() { if (this.ghost) this.ghost.visible = false; }
}

/* ================= 示例机械：四轮攻城战车 ================= */
function buildExampleMachine(machine) {
  machine.loadFrom(null);
  const Q = () => new THREE.Quaternion();
  const qz = U.alignZTo(new THREE.Vector3(0, 0, 1));
  const qzm = U.alignZTo(new THREE.Vector3(0, 0, -1));
  const qx = U.alignZTo(new THREE.Vector3(1, 0, 0));
  const qxm = U.alignZTo(new THREE.Vector3(-1, 0, 0));
  const qy = U.alignZTo(new THREE.Vector3(0, 1, 0));
  const add = (type, x, y, z, quat, parentId, face, settings) =>
    machine.addBlock(type, new THREE.Vector3(x, y, z), quat || Q(), parentId, face, settings, true);

  const coreId = machine.core.id;
  // 底盘：核心(0,0,0)向前后延伸
  const b1 = add('woodBlock', 0, 0, 1, qz, coreId, new THREE.Vector3(0, 0, 1));
  const b2 = add('woodBlock', 0, 0, -1, qzm, coreId, new THREE.Vector3(0, 0, -1));
  // 左右横梁
  const l1 = add('smallBlock', 1, 0, 2, qx, b1.id, new THREE.Vector3(1, 0, 0));
  const r1 = add('smallBlock', -1, 0, 2, qxm, b1.id, new THREE.Vector3(-1, 0, 0));
  const l2 = add('smallBlock', 1, 0, -2, qx, b2.id, new THREE.Vector3(1, 0, 0));
  const r2 = add('smallBlock', -1, 0, -2, qxm, b2.id, new THREE.Vector3(-1, 0, 0));
  // 四个动力轮（驱动方向由启发式自动配置：↑ = 朝核心面 +Z 前进）
  add('poweredWheel', 2, 0, 2, qx, l1.id, new THREE.Vector3(1, 0, 0));
  add('poweredWheel', -2, 0, 2, qxm, r1.id, new THREE.Vector3(-1, 0, 0));
  add('poweredWheel', 2, 0, -2, qx, l2.id, new THREE.Vector3(1, 0, 0));
  add('poweredWheel', -2, 0, -2, qxm, r2.id, new THREE.Vector3(-1, 0, 0));
  // 车头尖刺 + 加农炮
  add('spike', 0, 0, 3, qz, b1.id, new THREE.Vector3(0, 0, 1));
  const top = add('smallBlock', 0, 1, 0, qy, coreId, new THREE.Vector3(0, 1, 0));
  add('cannon', 0, 1, 1, qz, top.id, new THREE.Vector3(0, 0, 1));
  add('flamethrower', 0, 1, -1, qzm, top.id, new THREE.Vector3(0, 0, -1));
  machine.undoStack.length = 0;
}

window.Machine = Machine;
window.Builder = Builder;
window.buildExampleMachine = buildExampleMachine;
window.BUILD_Y0 = BUILD_Y0;
