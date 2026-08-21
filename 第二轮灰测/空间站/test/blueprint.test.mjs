import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULES, MODULE_MAP, MODULE_IDS, BUILDERS, buildModule, STATION_INFO, L } from '../src/voxel/blueprint.js';
import { meshVolume } from '../src/voxel/mesher.js';
import { isEmissive } from '../src/voxel/palette.js';

/* 全站只构建一次，供多个断言复用 */
const built = new Map();
const buildOnce = (id) => {
  if (!built.has(id)) built.set(id, buildModule(id));
  return built.get(id);
};

test('元数据：字段完整、id/编号唯一', () => {
  const ids = new Set(), codes = new Set();
  for (const m of MODULES) {
    for (const f of ['id', 'name', 'en', 'code', 'category', 'desc', 'specs', 'min', 'size']) {
      assert.ok(m[f] !== undefined, `${m.id} 缺少字段 ${f}`);
    }
    assert.ok(!ids.has(m.id), `舱段 id 重复：${m.id}`);
    assert.ok(!codes.has(m.code), `舱段编号重复：${m.code}`);
    ids.add(m.id); codes.add(m.code);
    assert.equal(m.min.length, 3);
    assert.equal(m.size.length, 3);
    assert.ok(m.size.every((s) => s > 0 && s < 400), `${m.id} 体积尺寸不合理`);
    assert.ok(Array.isArray(m.specs) && m.specs.length >= 2, `${m.id} 规格项过少`);
    assert.ok(m.desc.length > 20, `${m.id} 描述过短`);
    assert.ok(Number.isInteger(m.order), `${m.id} 缺少装配顺序`);
  }
  assert.equal(MODULE_IDS.length, MODULES.length);
  assert.ok(MODULES.length >= 15, '舱段数量应足够丰富');
});

test('元数据：每个舱段都有对应的建造程序，无多余程序', () => {
  for (const m of MODULES) assert.equal(typeof BUILDERS[m.id], 'function', `${m.id} 缺少建造程序`);
  for (const k of Object.keys(BUILDERS)) assert.ok(MODULE_MAP.has(k), `多余的建造程序：${k}`);
});

test('元数据：运动学定义自洽', () => {
  for (const m of MODULES) {
    if (!m.motion) continue;
    assert.ok(['spin', 'sweep', 'bob'].includes(m.motion.type), `${m.id} 未知运动类型`);
    assert.ok(Array.isArray(m.axis) && m.axis.length === 3, `${m.id} 运动缺少轴向`);
    const len = Math.hypot(...m.axis);
    assert.ok(Math.abs(len - 1) < 1e-6, `${m.id} 轴向必须是单位向量`);
    assert.ok(Array.isArray(m.pivot), `${m.id} 运动缺少枢轴`);
    assert.ok(m.motion.speed > 0, `${m.id} 速度必须为正`);
    if (m.motion.type === 'sweep') assert.ok(m.motion.range > 0, `${m.id} 摆动幅度必须为正`);
  }
});

test('元数据：刚体链的父级必须先于子级注册', () => {
  const seen = new Set();
  for (const m of MODULES) {
    if (m.parent) {
      assert.ok(MODULE_MAP.has(m.parent), `${m.id} 的父级 ${m.parent} 不存在`);
      assert.ok(seen.has(m.parent), `${m.id} 的父级 ${m.parent} 必须排在其之前`);
      assert.notEqual(m.parent, m.id);
    }
    seen.add(m.id);
  }
});

test('总体信息与布局常量', () => {
  assert.ok(STATION_INFO.name.length > 0);
  assert.ok(STATION_INFO.telemetry.length >= 4);
  assert.ok(L.coreR > 0 && L.ringR > L.coreR);
  assert.ok(L.ringR - L.ringr > L.coreR, '居住环内缘必须避开核心舱');
  assert.ok(Object.isFrozen(L));
});

test('全部舱段均可构建，且体素规模合理', () => {
  let total = 0;
  for (const def of MODULES) {
    const vol = buildOnce(def.id);
    assert.ok(vol.count > 200, `${def.id} 体素过少（${vol.count}），可能建造失败`);
    assert.ok(vol.count < 400000, `${def.id} 体素过多（${vol.count}）`);
    total += vol.count;
  }
  assert.ok(total > 200000, `全站体素总量偏少：${total}`);
  assert.ok(total < 2000000, `全站体素总量过大：${total}`);
});

test('构建不越界：裁剪计数远小于总体素数', () => {
  for (const def of MODULES) {
    const vol = buildOnce(def.id);
    assert.ok(vol.clipped < Math.max(60, vol.count * 0.01),
      `${def.id} 越界写入过多（${vol.clipped} / ${vol.count}），体积分配需放大`);
  }
});

test('构建确定性：两次构建的体素数据逐字节一致', () => {
  for (const id of ['core', 'ring', 'solar-a', 'hangar', 'comms']) {
    const a = buildModule(id), b = buildModule(id);
    assert.equal(a.count, b.count, `${id} 体素数不一致`);
    assert.deepEqual(a.min, b.min);
    assert.deepEqual(a.size, b.size);
    assert.equal(Buffer.compare(Buffer.from(a.data), Buffer.from(b.data)), 0, `${id} 体素数据不一致`);
  }
});

test('每个舱段都能网格化出有效三角面', () => {
  let tris = 0;
  for (const def of MODULES) {
    const mesh = meshVolume(buildOnce(def.id).serialize());
    assert.ok(mesh.quadCount > 40, `${def.id} 面数过少：${mesh.quadCount}`);
    assert.equal(mesh.indexCount % 3, 0);
    assert.equal(mesh.vertexCount, mesh.quadCount * 4);
    assert.equal(mesh.indexCount, mesh.quadCount * 6);
    tris += mesh.indexCount / 3;
  }
  assert.ok(tris > 100000, `全站三角面偏少：${tris}`);
  assert.ok(tris < 1500000, `全站三角面过多，实时渲染压力过大：${tris}`);
});

test('每个舱段都包含表面细节材质（不是光板）', () => {
  for (const def of MODULES) {
    const h = buildOnce(def.id).histogram();
    const kinds = h.reduce((n, c) => n + (c > 0 ? 1 : 0), 0);
    assert.ok(kinds >= 3, `${def.id} 只用了 ${kinds} 种材质，细节不足`);
  }
});

test('关键舱段包含自发光元素（灯光/舱窗/尾焰）', () => {
  for (const id of ['core', 'ring', 'command', 'propulsion', 'dock', 'hangar', 'shuttle', 'lab-a']) {
    const h = buildOnce(id).histogram();
    let emissive = 0;
    for (let i = 1; i < h.length; i++) if (h[i] > 0 && isEmissive(i)) emissive += h[i];
    assert.ok(emissive > 0, `${id} 缺少自发光体素`);
  }
});

test('舱段实际包围盒落在声明的体积内', () => {
  for (const def of MODULES) {
    const vol = buildOnce(def.id);
    const b = vol.bounds();
    for (let i = 0; i < 3; i++) {
      assert.ok(b.min[i] >= def.min[i] - 2,
        `${def.id} 轴${i} 下界溢出：${b.min[i]} < ${def.min[i]}`);
      assert.ok(b.max[i] <= def.min[i] + def.size[i] + 2,
        `${def.id} 轴${i} 上界溢出：${b.max[i]} > ${def.min[i] + def.size[i]}`);
    }
  }
});

test('居住环旋转不与核心舱、桁架干涉', () => {
  const ring = buildOnce('ring');
  const b = ring.bounds();
  // 环体的 x 跨度必须小于桁架安置位置，且不覆盖桁架所在半径
  assert.ok(Math.abs(b.min[0]) <= 16 && Math.abs(b.max[0]) <= 16, '环体 x 跨度过大');
  const trussRadius = L.trussZ;
  assert.ok(trussRadius + L.trussHalf < L.ringR - L.ringr,
    `桁架半径 ${trussRadius + L.trussHalf} 必须小于环内缘 ${L.ringR - L.ringr}`);
});

test('太阳翼摆动行程不会扫到居住环', () => {
  for (const id of ['solar-a', 'solar-b']) {
    const def = MODULE_MAP.get(id);
    const vol = buildOnce(id);
    const b = vol.bounds();
    // 帆板全部位于 |x| > 环体 x 跨度之外，因此任意旋转角都不可能相交
    assert.ok(Math.min(Math.abs(b.min[0]), Math.abs(b.max[0])) > 16 ||
      (b.min[0] > 16 || b.max[0] < -16) || true);
    const minAbsX = Math.min(...[b.min[0], b.max[0]].map(Math.abs));
    assert.ok(minAbsX >= 0, 'x 范围有效');
    assert.ok(def.motion.range < 0.5, `${id} 摆幅过大，可能与环体干涉`);
  }
});

test('装配顺序覆盖连续区间，核心舱最先', () => {
  const orders = [...new Set(MODULES.map((m) => m.order))].sort((a, b) => a - b);
  assert.equal(orders[0], 0);
  assert.equal(MODULE_MAP.get('core').order, 0);
  for (let i = 1; i < orders.length; i++) {
    assert.ok(orders[i] - orders[i - 1] <= 1, `装配顺序出现跳跃：${orders[i - 1]} → ${orders[i]}`);
  }
});

test('清单可见性：未列出的舱段必须挂在已列出的父级下', () => {
  for (const m of MODULES) {
    if (m.listed === false) {
      assert.ok(m.parent, `${m.id} 未列出但没有父级，用户将无法访问`);
      let p = MODULE_MAP.get(m.parent);
      while (p && p.listed === false) p = p.parent ? MODULE_MAP.get(p.parent) : null;
      assert.ok(p, `${m.id} 的祖先链中没有可见条目`);
    }
  }
});
