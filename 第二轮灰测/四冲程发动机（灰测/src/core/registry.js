/**
 * registry.js —— 零件注册表 / 构建上下文 / 每帧更新调度
 *
 * 所有零件模块通过 build(world) 构建，并用 world.reg() 注册，
 * 注册后即可被鼠标拾取、显示信息卡、参与分层显隐与拆解动画。
 */
import * as THREE from 'three';

export const LAYERS = [
  { key: 'housing', cn: '固定件（缸体/缸盖/壳体）', en: 'Static housings' },
  { key: 'crankTrain', cn: '运动件（活塞/连杆/曲轴）', en: 'Crank train' },
  { key: 'valvetrain', cn: '配气机构', en: 'Valvetrain' },
  { key: 'timing', cn: '正时齿轮室', en: 'Timing gears' },
  { key: 'fuel', cn: '燃油系统', en: 'Fuel system' },
  { key: 'lube', cn: '润滑系统', en: 'Lubrication' },
  { key: 'cooling', cn: '冷却系统', en: 'Cooling system' },
  { key: 'air', cn: '进排气/增压', en: 'Air & boost' },
  { key: 'fasteners', cn: '螺栓/密封/垫片', en: 'Fasteners & seals' },
  { key: 'fluidVol', cn: '油道/水套/气道（示意腔）', en: 'Fluid volumes' },
  { key: 'flow', cn: '流动粒子/流线', en: 'Flow particles' },
];

export class World {
  constructor(scene, mats, P, K) {
    this.scene = scene;
    this.mats = mats;
    this.P = P;
    this.K = K;
    this.root = new THREE.Group();
    this.root.name = 'engine';
    scene.add(this.root);
    this.groups = {};
    for (const l of LAYERS) {
      const g = new THREE.Group();
      g.name = 'layer:' + l.key;
      this.root.add(g);
      this.groups[l.key] = g;
    }
    this.parts = new Map();     // id -> entry
    this.updaters = [];
    this.explodables = [];
    this.pickables = [];
  }

  group(key) {
    if (!this.groups[key]) throw new Error('unknown layer ' + key);
    return this.groups[key];
  }

  /**
   * 注册零件
   * @param {THREE.Object3D|THREE.Object3D[]} obj
   * @param {string} id 唯一 id（与 partsInfo 数据 key 对应）
   * @param {object} opts {state:(st)=>string, explode:[x,y,z], pick:boolean}
   */
  reg(obj, id, opts = {}) {
    const objs = Array.isArray(obj) ? obj : [obj];
    let entry = this.parts.get(id);
    if (!entry) {
      entry = { id, objects: [], state: opts.state || null, info: null };
      this.parts.set(id, entry);
    }
    if (opts.state) entry.state = opts.state;
    for (const o of objs) {
      entry.objects.push(o);
      o.traverse((c) => {
        if (c.isMesh || c.isInstancedMesh) {
          c.userData.partId = id;
          if (opts.pick !== false) this.pickables.push(c);
        }
      });
      if (opts.explode) {
        this.explodables.push({
          obj: o,
          base: o.position.clone(),
          dir: new THREE.Vector3(...opts.explode),
        });
      }
    }
    return objs[0];
  }

  /** 注册每帧更新回调 */
  addUpdater(fn) { this.updaters.push(fn); }

  update(st) {
    for (const u of this.updaters) u(st);
  }

  setExplode(k) {
    for (const e of this.explodables) {
      e.obj.position.copy(e.base).addScaledVector(e.dir, k);
    }
  }

  attachInfo(infoMap) {
    this.infoMap = infoMap;
    for (const [id, entry] of this.parts) {
      entry.info = infoMap[id] || null;
    }
    // 反向检查：数据里有、但场景中没有的 id（便于开发期发现遗漏）
    this.missingInfo = [...this.parts.keys()].filter((id) => !infoMap[id]);
    this.orphanInfo = Object.keys(infoMap).filter((id) => !this.parts.has(id));
  }

  get(id) { return this.parts.get(id); }

  setLayerVisible(key, v) { this.groups[key].visible = v; }
}
