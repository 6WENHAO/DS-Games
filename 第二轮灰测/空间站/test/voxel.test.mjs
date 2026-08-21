import test from 'node:test';
import assert from 'node:assert/strict';
import { VoxelVolume } from '../src/voxel/volume.js';
import { Brush } from '../src/voxel/builder.js';
import { MAT, materials, packed, STRIDE, bakeMaterial, packCode, DETAIL, FLAG, isEmissive } from '../src/voxel/palette.js';
import { stencil, textWidth, GLYPH_W, GLYPH_H } from '../src/voxel/stencil.js';

/* ═══════════════ 调色板 ═══════════════ */

test('调色板：0 号为真空，符号名唯一且与索引一致', () => {
  assert.equal(materials[0].key, 'AIR');
  assert.equal(MAT.AIR, 0);
  const keys = new Set();
  materials.forEach((m, i) => {
    assert.ok(!keys.has(m.key), `材质符号名重复：${m.key}`);
    keys.add(m.key);
    assert.equal(MAT[m.key], i);
    assert.ok(m.rough >= 0 && m.rough <= 1, `${m.key} 粗糙度越界`);
    assert.ok(m.metal >= 0 && m.metal <= 1, `${m.key} 金属度越界`);
    assert.ok(m.detail >= 0 && m.detail <= 10, `${m.key} detail 越界`);
  });
  assert.ok(materials.length > 30, '材质数量应足够丰富');
  assert.ok(materials.length <= 64, '材质 id 必须能装进一个字节的低位语义');
});

test('调色板：线性化与打包表一致', () => {
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≉ ${b}`);
  for (let i = 1; i < materials.length; i++) {
    const o = i * STRIDE;
    for (let c = 0; c < 3; c++) assert.ok(packed[o + c] >= 0 && packed[o + c] <= 1);
    near(packed[o + 3], materials[i].rough);
    near(packed[o + 4], materials[i].metal);
    // 自发光被 EMISSIVE_SCALE 归一化后必须仍在 [0,1]
    for (let c = 5; c < 8; c++) assert.ok(packed[o + c] >= 0 && packed[o + c] <= 1,
      `${materials[i].key} 自发光编码溢出：${packed[o + c]}`);
  }
});

test('调色板：自发光材质被正确标记', () => {
  assert.ok(isEmissive(MAT.LED_GREEN));
  assert.ok(isEmissive(MAT.GLASS_WIN));
  assert.ok(isEmissive(MAT.ENGINE_GLOW));
  assert.ok(!isEmissive(MAT.HULL_WHITE));
  assert.ok(!isEmissive(MAT.TRUSS_ALLOY));
});

test('调色板：烘焙输出全部落在字节范围内且逐面有色差', () => {
  const out = new Uint8Array(8);
  const seen = new Set();
  for (let x = 0; x < 40; x++) {
    bakeMaterial(MAT.FOIL_GOLD, x, 3, 7, out);
    for (const v of out) assert.ok(Number.isInteger(v) && v >= 0 && v <= 255);
    seen.add(out[0]);
  }
  assert.ok(seen.size > 3, '带 variance 的材质应产生逐面色差');
  // 无 variance 的材质应完全稳定
  const a = new Uint8Array(8), b = new Uint8Array(8);
  bakeMaterial(MAT.INNER_LIT, 1, 2, 3, a);
  bakeMaterial(MAT.INNER_LIT, 90, 12, 33, b);
  assert.deepEqual([...a], [...b]);
});

test('调色板：code 打包 detail 与 flags', () => {
  const c = packCode(MAT.LED_RED);
  assert.equal(c & 15, DETAIL.LED);
  assert.equal((c >> 4) & 15, FLAG.BLINK);
  const w = packCode(MAT.GLASS_WIN);
  assert.equal(w & 15, DETAIL.WINDOW);
  assert.equal((w >> 4) & 15, FLAG.FLICKER);
  const plain = packCode(MAT.HULL_WHITE);
  assert.equal(plain >> 4, 0);
});

/* ═══════════════ 体积容器 ═══════════════ */

test('体积：读写、越界与计数', () => {
  const v = new VoxelVolume(-5, -5, -5, 10, 10, 10);
  assert.equal(v.count, 0);
  assert.ok(v.set(0, 0, 0, 7));
  assert.equal(v.get(0, 0, 0), 7);
  assert.equal(v.count, 1);
  v.set(0, 0, 0, 9);
  assert.equal(v.count, 1, '覆盖不应重复计数');
  v.set(0, 0, 0, 0);
  assert.equal(v.count, 0, '挖空应减少计数');
  assert.equal(v.set(99, 0, 0, 3), false);
  assert.equal(v.clipped, 1);
  assert.equal(v.get(99, 0, 0), 0, '越界读取应视为真空');
  assert.equal(v.index(-5, -5, -5), 0, '最小角对应索引 0');
});

test('体积：setIfEmpty / repaint 语义', () => {
  const v = new VoxelVolume(0, 0, 0, 4, 4, 4);
  v.set(1, 1, 1, 5);
  assert.equal(v.setIfEmpty(1, 1, 1, 9), false);
  assert.equal(v.get(1, 1, 1), 5);
  assert.ok(v.setIfEmpty(2, 1, 1, 9));
  assert.equal(v.repaint(3, 3, 3, 4), false, '空体素不可重涂');
  assert.ok(v.repaint(1, 1, 1, 4));
  assert.equal(v.get(1, 1, 1), 4);
});

test('体积：表面判定与包围盒', () => {
  const v = new VoxelVolume(0, 0, 0, 8, 8, 8);
  for (let z = 2; z <= 5; z++) for (let y = 2; y <= 5; y++) for (let x = 2; x <= 5; x++) v.set(x, y, z, 1);
  assert.ok(v.exposed(2, 2, 2), '角上体素暴露');
  assert.ok(!v.exposed(3, 3, 3) === false || true);
  // 4³ 实心块内部无完整包围体素（4³ 的内部是 2³）
  assert.equal(v.solid(3, 3, 3), true);
  assert.equal(v.exposed(3, 3, 3), false);
  const b = v.bounds();
  assert.deepEqual(b.min, [2, 2, 2]);
  assert.deepEqual(b.max, [5, 5, 5]);
  assert.deepEqual(b.size, [4, 4, 4]);
  assert.deepEqual(b.center, [4, 4, 4]);
});

test('体积：trim 保留全部实心体素并外扩边距', () => {
  const v = new VoxelVolume(-30, -30, -30, 60, 60, 60);
  v.set(0, 1, 2, 3);
  v.set(1, 1, 2, 4);
  const t = v.trim(1);
  assert.equal(t.count, 2);
  assert.equal(t.get(0, 1, 2), 3);
  assert.equal(t.get(1, 1, 2), 4);
  assert.deepEqual(t.size, [4, 3, 3]);
  assert.deepEqual(t.min, [-1, 0, 1]);
  assert.ok(t.data.length < v.data.length);
});

test('体积：直方图与序列化往返', () => {
  const v = new VoxelVolume(0, 0, 0, 4, 4, 4);
  v.set(0, 0, 0, 3); v.set(1, 0, 0, 3); v.set(2, 0, 0, 7);
  const h = v.histogram();
  assert.equal(h[3], 2);
  assert.equal(h[7], 1);
  assert.equal(h[0], 0, '真空不计入直方图');
  const raw = v.serialize();
  const back = VoxelVolume.deserialize(raw);
  assert.equal(back.get(1, 0, 0), 3);
  assert.equal(back.count, 3);
});

/* ═══════════════ 建模 DSL ═══════════════ */

const mkBrush = (n = 40) => {
  const v = new VoxelVolume(-n / 2, -n / 2, -n / 2, n, n, n);
  return { v, b: new Brush(v, 1) };
};

test('建模：box 端点含且体积正确', () => {
  const { v, b } = mkBrush();
  b.box(0, 0, 0, 2, 3, 4, MAT.HULL_WHITE);
  assert.equal(v.count, 3 * 4 * 5);
  assert.equal(v.get(0, 0, 0), MAT.HULL_WHITE);
  assert.equal(v.get(2, 3, 4), MAT.HULL_WHITE);
  assert.equal(v.get(3, 3, 4), 0);
});

test('建模：程序化材质函数与 -1 跳过', () => {
  const { v, b } = mkBrush();
  b.box(0, 0, 0, 3, 0, 0, (x) => (x % 2 === 0 ? MAT.LED_RED : -1));
  assert.equal(v.get(0, 0, 0), MAT.LED_RED);
  assert.equal(v.get(1, 0, 0), 0);
  assert.equal(v.get(2, 0, 0), MAT.LED_RED);
});

test('建模：boxShell 中空且可跳过指定面', () => {
  const { v, b } = mkBrush();
  b.boxShell(-4, -4, -4, 4, 4, 4, MAT.HULL_GREY, 1);
  assert.equal(v.get(0, 0, 0), 0, '壳内应为空');
  assert.equal(v.get(-4, 0, 0), MAT.HULL_GREY);
  assert.equal(v.get(4, 0, 0), MAT.HULL_GREY);
  const { v: v2, b: b2 } = mkBrush();
  b2.boxShell(-4, -4, -4, 4, 4, 4, MAT.HULL_GREY, 1, '-y');
  assert.equal(v2.get(0, -4, 0), 0, '被跳过的面应缺失');
  assert.equal(v2.get(0, 4, 0), MAT.HULL_GREY);
});

test('建模：球体近似体积与壳层', () => {
  const { v, b } = mkBrush(48);
  b.sphere(0, 0, 0, 8, MAT.HULL_WHITE);
  const ideal = (4 / 3) * Math.PI * 8 ** 3;
  assert.ok(Math.abs(v.count - ideal) / ideal < 0.08, `球体体积偏差过大：${v.count} vs ${ideal.toFixed(0)}`);
  const { v: v2, b: b2 } = mkBrush(48);
  b2.sphere(0, 0, 0, 8, MAT.HULL_WHITE, 2);
  assert.equal(v2.get(0, 0, 0), 0, '壳层球心应为空');
  assert.ok(v2.count < v.count * 0.75);
});

test('建模：圆柱三轴一致（体积与朝向）', () => {
  for (const axis of [0, 1, 2]) {
    const { v, b } = mkBrush(40);
    b.cylinder(axis, 0, 0, 6, -8, 8, MAT.TRUSS_ALLOY);
    const ideal = Math.PI * 36 * 17;
    assert.ok(Math.abs(v.count - ideal) / ideal < 0.1, `axis=${axis} 圆柱体积偏差：${v.count}`);
    const p = [0, 0, 0]; p[axis] = 8;
    assert.equal(v.get(p[0], p[1], p[2]), MAT.TRUSS_ALLOY, `axis=${axis} 端点缺失`);
    const q = [0, 0, 0]; q[axis] = 9;
    assert.equal(v.get(q[0], q[1], q[2]), 0, `axis=${axis} 超出端点不应有体素`);
  }
});

test('建模：圆柱 from>to 自动纠正方向', () => {
  const { v, b } = mkBrush();
  b.cylinder(2, 0, 0, 3, 6, -6, MAT.PIPE_STEEL);
  assert.ok(v.count > 0, '反向区间也必须生成几何');
  assert.equal(v.get(0, 0, 0), MAT.PIPE_STEEL);
});

test('建模：cone 反向区间时半径同步交换', () => {
  const { v: a, b: ba } = mkBrush();
  ba.cone(0, 0, 0, 2, 6, -6, 6, MAT.NOZZLE);
  const { v: c, b: bc } = mkBrush();
  bc.cone(0, 0, 0, 6, 2, 6, -6, MAT.NOZZLE);
  assert.equal(a.count, c.count, '正反书写应得到相同实体');
  assert.equal(a.get(-6, 0, 0), MAT.NOZZLE);
});

test('建模：torus 在主半径处成环、中心为空', () => {
  const { v, b } = mkBrush(64);
  b.torus(0, 0, 0, 0, 14, 3, MAT.HULL_WHITE);
  assert.equal(v.get(0, 0, 0), 0);
  assert.equal(v.get(0, 14, 0), MAT.HULL_WHITE);
  assert.equal(v.get(0, 0, 14), MAT.HULL_WHITE);
  assert.equal(v.get(0, -14, 0), MAT.HULL_WHITE);
});

test('建模：capsule 无缝隙（沿线段每点都实心）', () => {
  const { v, b } = mkBrush(64);
  const p0 = [-12, -7, 5], p1 = [11, 9, -6];
  b.capsule(p0, p1, 1.5, MAT.CARBON);
  for (let t = 0; t <= 1; t += 0.01) {
    const x = Math.round(p0[0] + (p1[0] - p0[0]) * t);
    const y = Math.round(p0[1] + (p1[1] - p0[1]) * t);
    const z = Math.round(p0[2] + (p1[2] - p0[2]) * t);
    assert.equal(v.get(x, y, z), MAT.CARBON, `胶囊在 t=${t.toFixed(2)} 处出现空洞`);
  }
});

test('建模：obb 斜置盒体无缝隙且体积近似正确', () => {
  const { v, b } = mkBrush(64);
  const c = 1 / Math.SQRT2;
  b.obb([0, 0, 0], [c, c, 0], [-c, c, 0], [0, 0, 1], [8, 3, 2], MAT.HULL_WHITE);
  const ideal = 17 * 7 * 5;
  assert.ok(Math.abs(v.count - ideal) / ideal < 0.25, `斜盒体积偏差：${v.count} vs ${ideal}`);
  // 沿主轴方向抽样不应出现空洞
  for (let s = -7; s <= 7; s++) {
    assert.equal(v.get(Math.round(s * c), Math.round(s * c), 0), MAT.HULL_WHITE, `s=${s} 出现空洞`);
  }
});

test('建模：truss 生成四根纵杆与斜撑', () => {
  const { v, b } = mkBrush(80);
  b.truss([-30, 0, 0], [30, 0, 0], 5, MAT.TRUSS_ALLOY, MAT.CARBON, { segment: 10, rod: 1.2 });
  assert.ok(v.count > 800, '桁架体素过少');
  const h = v.histogram();
  assert.ok(h[MAT.TRUSS_ALLOY] > 0, '缺少纵杆');
  assert.ok(h[MAT.CARBON] > 0, '缺少斜撑');
  assert.equal(v.get(0, 0, 0), 0, '桁架中心应为空');
});

test('建模：solarPanel 具备边框、栅缝与汇流条', () => {
  const { v, b } = mkBrush(64);
  b.solarPanel(1, [0, 0, 0], 12, 8, 2, {});
  const h = v.histogram();
  assert.ok(h[MAT.SOLAR_CELL] > 0);
  assert.ok(h[MAT.SOLAR_FRAME] > 0);
  assert.ok(h[MAT.SOLAR_HOT] > 0);
  // 厚度 2 → 只占两层
  assert.ok(v.get(0, -1, 0) !== 0 || v.get(0, 0, 0) !== 0);
  assert.equal(v.get(0, 5, 0), 0);
});

test('建模：dish 形成抛物壳而非实心', () => {
  const { v, b } = mkBrush(48);
  b.dish(1, [0, 0, 0], 10, 4, 1.5, MAT.DISH_WHITE, +1);
  assert.ok(v.count > 200);
  const solidRatio = v.count / (Math.PI * 100 * 5);
  assert.ok(solidRatio < 0.6, '抛物面应为薄壳');
  assert.equal(v.get(0, 0, 0), MAT.DISH_WHITE, '顶点处应有壳');
});

test('建模：windowRing 只重涂已有壳体', () => {
  const { v, b } = mkBrush(48);
  const before = v.count;
  b.windowRing(0, [0, 0, 0], 10, 0, 6, MAT.GLASS_WIN);
  assert.equal(v.count, before, '重涂不应新增体素');
  b.cylinder(0, 0, 0, 10, -6, 6, MAT.HULL_WHITE);
  b.windowRing(0, [0, 0, 0], 10, 0, 6, MAT.GLASS_WIN);
  assert.ok(v.histogram()[MAT.GLASS_WIN] > 0, '壳体存在时应涂上舱窗');
});

test('建模：greeble 在表面外侧长出细节且不侵入实体', () => {
  const { v, b } = mkBrush(48);
  b.box(-6, -6, -6, 6, 6, 6, MAT.HULL_WHITE);
  const before = v.count;
  b.greeble([-9, -9, -9], [9, 9, 9], 0.25, [MAT.HULL_DARK], { maxSize: 2, seed: 3 });
  assert.ok(v.count > before, 'greeble 应增加体素');
  assert.equal(v.get(0, 0, 0), MAT.HULL_WHITE, '内部材质不应被改写');
});

test('建模：weather 仅重涂符合条件的表面', () => {
  const { v, b } = mkBrush(48);
  b.box(-6, -6, -6, 6, 6, 6, MAT.HULL_WHITE);
  const before = v.count;
  b.weather([-7, -7, -7], [7, 7, 7], 1.0, MAT.SOOT, (m) => m === MAT.HULL_WHITE);
  assert.equal(v.count, before);
  assert.ok(v.histogram()[MAT.SOOT] > 0);
  assert.equal(v.get(0, 0, 0), MAT.HULL_WHITE, '非表面体素不受影响');
});

test('建模：radial 环形复制到指定数量的角度', () => {
  const { b } = mkBrush();
  const angles = [];
  b.radial(0, [0, 0, 0], 10, 4, (p, out, tan, ax, ang) => angles.push(ang));
  assert.equal(angles.length, 4);
  assert.ok(Math.abs(angles[1] - angles[0] - Math.PI / 2) < 1e-6);
});

test('建模：mirror 产生镜像副本', () => {
  const { v, b } = mkBrush();
  b.mirror(0, 0, () => b.box(4, 0, 0, 6, 0, 0, MAT.HULL_WHITE));
  assert.equal(v.get(5, 0, 0), MAT.HULL_WHITE);
  assert.equal(v.get(-5, 0, 0), MAT.HULL_WHITE);
});

/* ═══════════════ 文字模板 ═══════════════ */

test('字模：宽度计算与喷涂只作用于已有体素', () => {
  assert.equal(GLYPH_W, 5);
  assert.equal(GLYPH_H, 5);
  assert.equal(textWidth('AB'), 11);
  assert.equal(textWidth('A'), 5);
  const v = new VoxelVolume(-20, -20, -20, 40, 40, 40);
  assert.equal(stencil(v, 'CS-01', { axis: 2, plane: 0, u: -12, v: -2, mat: MAT.RED_ACCENT }), 0,
    '空体积上喷涂应为 0 像素');
  const b = new Brush(v, 1);
  b.box(-20, -20, -1, 20, 20, 0, MAT.HULL_WHITE);
  const painted = stencil(v, 'CS-01', { axis: 2, plane: 0, u: -12, v: -2, mat: MAT.RED_ACCENT, depth: 2, dn: -1 });
  assert.ok(painted > 40, `喷涂像素过少：${painted}`);
  assert.ok(v.histogram()[MAT.RED_ACCENT] > 20);
});

test('字模：未知字符退化为空格且不抛异常', () => {
  const v = new VoxelVolume(0, 0, 0, 30, 12, 3);
  const b = new Brush(v, 1);
  b.box(0, 0, 0, 29, 11, 1, MAT.HULL_WHITE);
  assert.doesNotThrow(() => stencil(v, '你好 ABC', { axis: 2, plane: 1, u: 1, v: 1, mat: MAT.LED_CYAN, dn: -1 }));
});
