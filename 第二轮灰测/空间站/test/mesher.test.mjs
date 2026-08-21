import test from 'node:test';
import assert from 'node:assert/strict';
import { VoxelVolume } from '../src/voxel/volume.js';
import { Brush } from '../src/voxel/builder.js';
import { meshVolume, VERTEX_BYTES, ATTRIB, FACE_NORMALS, UV_WRAP } from '../src/voxel/mesher.js';
import { MAT } from '../src/voxel/palette.js';

/** 解析交错顶点缓冲，便于断言 */
function readVertices(mesh) {
  const u8 = mesh.vertices;
  const u16 = new Uint16Array(u8.buffer, u8.byteOffset, u8.byteLength >> 1);
  const out = [];
  for (let i = 0; i < mesh.vertexCount; i++) {
    const b = i * VERTEX_BYTES, h = b >> 1;
    out.push({
      pos: [u16[h], u16[h + 1], u16[h + 2]],
      face: u8[b + 8], ao: u8[b + 9], code: u8[b + 10], variant: u8[b + 11],
      albedo: [u8[b + 12], u8[b + 13], u8[b + 14]], rough: u8[b + 15],
      emissive: [u8[b + 16], u8[b + 17], u8[b + 18]], metal: u8[b + 19],
      uv: [u16[h + 10], u16[h + 11]],
    });
  }
  return out;
}

const mesh1 = (setup, size = 8, min = [0, 0, 0]) => {
  const v = new VoxelVolume(min[0], min[1], min[2], size, size, size);
  setup(new Brush(v, 1), v);
  return { mesh: meshVolume(v.serialize()), vol: v };
};

test('顶点布局：步长与属性偏移自洽', () => {
  assert.equal(VERTEX_BYTES, 24);
  const locs = new Set();
  let maxEnd = 0;
  for (const a of Object.values(ATTRIB)) {
    assert.ok(!locs.has(a.loc), `属性 location 重复：${a.loc}`);
    locs.add(a.loc);
    const bytes = a.size * (a.type === 'u16' ? 2 : 1);
    assert.ok(a.offset + bytes <= VERTEX_BYTES, `属性越界：${JSON.stringify(a)}`);
    maxEnd = Math.max(maxEnd, a.offset + bytes);
  }
  assert.equal(maxEnd, VERTEX_BYTES);
  assert.deepEqual([...locs].sort(), [0, 1, 2, 3, 4]);
});

test('单体素 → 6 个面 / 24 顶点 / 12 三角', () => {
  const { mesh } = mesh1((b) => b.box(3, 3, 3, 3, 3, 3, MAT.HULL_WHITE));
  assert.equal(mesh.quadCount, 6);
  assert.equal(mesh.vertexCount, 24);
  assert.equal(mesh.indexCount, 36);
  const faces = new Set(readVertices(mesh).map((v) => v.face));
  assert.deepEqual([...faces].sort(), [0, 1, 2, 3, 4, 5], '六个朝向都应存在');
});

test('贪心合并：2×2×2 实心块每面合并为 1 个四边形', () => {
  const { mesh } = mesh1((b) => b.box(2, 2, 2, 3, 3, 3, MAT.HULL_WHITE));
  assert.equal(mesh.quadCount, 6, '同材质同 AO 的共面小块必须合并');
  assert.equal(mesh.vertexCount, 24);
});

test('贪心合并：8×8×1 薄板的大面合并为单个四边形', () => {
  const v = new VoxelVolume(0, 0, 0, 10, 3, 10);
  new Brush(v, 1).box(0, 1, 0, 9, 1, 9, MAT.RADIATOR);
  const mesh = meshVolume(v.serialize());
  // 上下两个 10×10 大面各 1 个四边形，四周侧面各 1 个
  assert.equal(mesh.quadCount, 6, `实际 ${mesh.quadCount}`);
});

test('贪心合并：不同材质不会被合并', () => {
  const { mesh } = mesh1((b) => {
    b.box(2, 2, 2, 3, 3, 3, MAT.HULL_WHITE);
    b.box(4, 2, 2, 5, 3, 3, MAT.FOIL_GOLD);
  });
  // 两块相邻但材质不同：接触面被消除，其余面不跨材质合并
  const verts = readVertices(mesh);
  const albedos = new Set(verts.map((v) => v.albedo.join(',')));
  assert.ok(albedos.size >= 2, '应保留两种以上的烘焙色');
  assert.ok(mesh.quadCount >= 10, `合并过度：${mesh.quadCount}`);
});

test('内部体素不产生面（实心块只有外壳）', () => {
  const v = new VoxelVolume(0, 0, 0, 12, 12, 12);
  new Brush(v, 1).box(2, 2, 2, 9, 9, 9, MAT.HULL_GREY);
  const mesh = meshVolume(v.serialize());
  assert.equal(mesh.quadCount, 6, '8³ 实心块应只剩 6 个合并面');
  assert.equal(v.count, 512);
});

test('封闭空腔的内表面朝向正确（法线指向空腔）', () => {
  const v = new VoxelVolume(0, 0, 0, 12, 12, 12);
  const b = new Brush(v, 1);
  b.box(2, 2, 2, 9, 9, 9, MAT.HULL_GREY);
  b.carve(4, 4, 4, 7, 7, 7);
  const mesh = meshVolume(v.serialize());
  const verts = readVertices(mesh);
  // 空腔 +X 侧的内壁位于 x=8 平面，朝向 -X（faceId=1）
  const inner = verts.filter((q) => q.pos[0] === 8 && q.face === 1);
  assert.ok(inner.length >= 4, '空腔内壁法线方向错误');
  // 外壳 6 个大面必然合并；内壁受凹角 AO 影响会被拆分，因此总数远多于 12
  assert.ok(mesh.quadCount > 12, `内壁应因 AO 变化而细分，实际 ${mesh.quadCount}`);
  const outerFaces = verts.filter((q) => q.pos[0] === 10 && q.face === 0);
  assert.equal(outerFaces.length, 4, '开阔外壳面应合并为单个四边形');
});

test('顶点 AO：凹角变暗、开阔面全亮', () => {
  // 开阔的单薄板：所有 AO 应为满值
  const v1 = new VoxelVolume(0, 0, 0, 8, 8, 8);
  new Brush(v1, 1).box(1, 1, 1, 6, 1, 6, MAT.HULL_WHITE);
  const flat = readVertices(meshVolume(v1.serialize()));
  const top = flat.filter((q) => q.face === 2);
  assert.ok(top.length > 0);
  assert.ok(top.every((q) => q.ao === 255), '开阔顶面 AO 应为满值');

  // L 形凹角：靠内的顶点应变暗
  const v2 = new VoxelVolume(0, 0, 0, 10, 10, 10);
  const b2 = new Brush(v2, 1);
  b2.box(1, 1, 1, 8, 1, 8, MAT.HULL_WHITE);   // 地板
  b2.box(1, 2, 1, 8, 5, 1, MAT.HULL_WHITE);   // 沿 z=1 的墙
  const verts = readVertices(meshVolume(v2.serialize()));
  const floorTop = verts.filter((q) => q.face === 2 && q.pos[1] === 2);
  assert.ok(floorTop.some((q) => q.ao < 255), '墙脚处应出现 AO 变暗');
  assert.ok(floorTop.some((q) => q.ao === 255), '远离墙体处应保持全亮');
});

test('AO 差异会阻止贪心合并（保留接触阴影细节）', () => {
  const v = new VoxelVolume(0, 0, 0, 14, 6, 14);
  const b = new Brush(v, 1);
  b.box(1, 1, 1, 12, 1, 12, MAT.HULL_WHITE);
  b.box(6, 2, 6, 6, 3, 6, MAT.HULL_WHITE);    // 中央立柱造成局部 AO
  const mesh = meshVolume(v.serialize());
  assert.ok(mesh.quadCount > 8, `AO 变化应打断合并，实际 ${mesh.quadCount}`);
});

test('索引全部落在顶点范围内，且三角形无退化', () => {
  const { mesh } = mesh1((b) => {
    b.sphere(8, 8, 8, 6, MAT.HULL_WHITE);
    b.capsule([2, 2, 2], [14, 13, 11], 2, MAT.CARBON);
  }, 18);
  assert.ok(mesh.indexCount > 0);
  assert.equal(mesh.indexCount % 3, 0);
  for (let i = 0; i < mesh.indexCount; i++) {
    assert.ok(mesh.indices[i] < mesh.vertexCount, `索引越界：${mesh.indices[i]}`);
  }
  for (let i = 0; i < mesh.indexCount; i += 3) {
    const [a, b2, c] = [mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]];
    assert.ok(a !== b2 && b2 !== c && a !== c, '退化三角形');
  }
});

test('三角形绕序：与面法线构成右手系（CCW 朝外）', () => {
  const { mesh } = mesh1((b) => b.box(3, 3, 3, 4, 4, 4, MAT.HULL_WHITE));
  const verts = readVertices(mesh);
  let checked = 0;
  for (let i = 0; i < mesh.indexCount; i += 3) {
    const a = verts[mesh.indices[i]], b2 = verts[mesh.indices[i + 1]], c = verts[mesh.indices[i + 2]];
    const e1 = [b2.pos[0] - a.pos[0], b2.pos[1] - a.pos[1], b2.pos[2] - a.pos[2]];
    const e2 = [c.pos[0] - a.pos[0], c.pos[1] - a.pos[1], c.pos[2] - a.pos[2]];
    const n = [
      e1[1] * e2[2] - e1[2] * e2[1],
      e1[2] * e2[0] - e1[0] * e2[2],
      e1[0] * e2[1] - e1[1] * e2[0],
    ];
    const fn = FACE_NORMALS[a.face];
    const d = n[0] * fn[0] + n[1] * fn[1] + n[2] * fn[2];
    assert.ok(d > 0, `面 ${a.face} 的三角形绕序与法线不一致（dot=${d}）`);
    checked++;
  }
  assert.equal(checked, 12);
});

test('uv 为全局连续的体素坐标，且负坐标模块不会跨 u16 回绕', () => {
  const v = new VoxelVolume(-4, -4, -4, 16, 16, 16);
  new Brush(v, 1).box(-2, -2, -2, 5, -2, 5, MAT.HULL_WHITE);
  const mesh = meshVolume(v.serialize());
  const verts = readVertices(mesh);
  const top = verts.filter((q) => q.face === 2);
  const us = top.map((q) => q.uv[0]).sort((a, b) => a - b);
  const vs = top.map((q) => q.uv[1]).sort((a, b) => a - b);
  // 面在 u/v 方向跨度应等于几何跨度（8 体素），不得出现回绕造成的巨大跨度
  assert.equal(us[us.length - 1] - us[0], 8);
  assert.equal(vs[vs.length - 1] - vs[0], 8);

  // 极端负坐标（真实蓝图里桁架 min 为 -92）同样不得回绕
  const far = new VoxelVolume(-200, -14, -120, 40, 20, 40);
  new Brush(far, 1).box(-190, -6, -110, -170, -6, -90, MAT.HULL_WHITE);
  const m2 = meshVolume(far.serialize());
  for (const q of readVertices(m2)) {
    assert.ok(q.uv[0] < UV_WRAP + 64 && q.uv[1] < UV_WRAP + 64,
      `uv 偏置越界：${q.uv}`);
  }
  const t2 = readVertices(m2).filter((q) => q.face === 2);
  const u2 = t2.map((q) => q.uv[0]).sort((a, b) => a - b);
  assert.ok(u2[u2.length - 1] - u2[0] <= 21, `uv 跨度异常（疑似回绕）：${u2[u2.length - 1] - u2[0]}`);
});

test('uv 偏置保持跨模块的图案周期对齐', () => {
  // 任意两个模块的 uv 偏置差必须是 2 的幂周期的整数倍
  const mk = (min) => {
    const v = new VoxelVolume(min, 0, 0, 8, 4, 8);
    new Brush(v, 1).box(min + 2, 1, 2, min + 5, 1, 5, MAT.HULL_WHITE);
    return readVertices(meshVolume(v.serialize())).find((q) => q.face === 2);
  };
  const a = mk(-96), b = mk(64);
  for (const period of [1, 2, 4, 8, 16, 32]) {
    const d = Math.abs((a.uv[0] - (-96 + 2)) - (b.uv[0] - (64 + 2)));
    assert.equal(d % period, 0, `偏置差 ${d} 破坏了周期 ${period} 的对齐`);
  }
});

test('顶点携带的材质参数与调色板一致', () => {
  const { mesh } = mesh1((b) => b.box(3, 3, 3, 3, 3, 3, MAT.LED_GREEN));
  const verts = readVertices(mesh);
  assert.ok(verts.every((q) => q.emissive[1] > 0), 'LED 应有自发光分量');
  const { mesh: m2 } = mesh1((b) => b.box(3, 3, 3, 3, 3, 3, MAT.TITANIUM));
  const v2 = readVertices(m2);
  assert.ok(v2.every((q) => q.metal > 200), '钛合金应为高金属度');
  assert.ok(v2.every((q) => q.emissive.every((c) => c === 0)), '非发光材质自发光应为 0');
});

test('空体积产生空网格', () => {
  const v = new VoxelVolume(0, 0, 0, 6, 6, 6);
  const mesh = meshVolume(v.serialize());
  assert.equal(mesh.quadCount, 0);
  assert.equal(mesh.vertexCount, 0);
  assert.equal(mesh.indexCount, 0);
});

test('网格化确定性：同输入两次结果完全一致', () => {
  const build = () => {
    const v = new VoxelVolume(-8, -8, -8, 20, 20, 20);
    const b = new Brush(v, 99);
    b.sphere(0, 0, 0, 6, MAT.FOIL_GOLD);
    b.greeble([-8, -8, -8], [8, 8, 8], 0.3, [MAT.HULL_DARK], { seed: 5 });
    return meshVolume(v.serialize());
  };
  const a = build(), c = build();
  assert.equal(a.vertexCount, c.vertexCount);
  assert.equal(a.indexCount, c.indexCount);
  assert.deepEqual([...a.indices], [...c.indices]);
  assert.deepEqual([...a.vertices], [...c.vertices]);
});

test('坐标偏移：origin 与局部坐标之和等于世界坐标', () => {
  const min = [-13, 7, -40];
  const { mesh } = mesh1((b) => b.box(-10, 9, -38, -10, 9, -38, MAT.HULL_WHITE), 8, min);
  assert.deepEqual(mesh.origin, min);
  const verts = readVertices(mesh);
  // 体素 (-10,9,-38) 的面顶点局部坐标应落在 [3..4, 2..3, 2..3]
  for (const q of verts) {
    assert.ok(q.pos[0] >= 3 && q.pos[0] <= 4, `局部 x 越界：${q.pos[0]}`);
    assert.ok(q.pos[1] >= 2 && q.pos[1] <= 3);
    assert.ok(q.pos[2] >= 2 && q.pos[2] <= 3);
  }
});

test('大体积压力测试：性能与内存在合理范围', () => {
  const v = new VoxelVolume(0, 0, 0, 64, 64, 64);
  const b = new Brush(v, 7);
  for (let i = 0; i < 40; i++) {
    b.sphere(8 + (i * 13) % 48, 8 + (i * 29) % 48, 8 + (i * 7) % 48, 4 + (i % 4), MAT.HULL_WHITE);
  }
  const t0 = performance.now();
  const mesh = meshVolume(v.serialize());
  const ms = performance.now() - t0;
  assert.ok(mesh.quadCount > 500);
  assert.ok(ms < 3000, `网格化耗时过长：${ms.toFixed(0)}ms`);
  assert.equal(mesh.vertices.byteLength, mesh.vertexCount * VERTEX_BYTES);
});
