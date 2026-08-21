import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mat4, vec3, clamp, lerp, smoothstep, damp, shortAngle, mulberry32, hash3,
  extractFrustum, sphereInFrustum, srgbToLinear, parseColor, hsl, easeInOutCubic,
} from '../src/core/math.js';

const near = (a, b, eps = 1e-4) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const nearArr = (a, b, eps = 1e-4) => {
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) assert.ok(Math.abs(a[i] - b[i]) < eps, `[${i}] ${a[i]} ≉ ${b[i]}`);
};

test('标量工具', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  near(lerp(2, 4, 0.25), 2.5);
  near(smoothstep(0, 1, 0.5), 0.5);
  assert.equal(smoothstep(0, 1, -3), 0);
  assert.equal(smoothstep(0, 1, 9), 1);
  near(easeInOutCubic(0), 0);
  near(easeInOutCubic(1), 1);
  near(easeInOutCubic(0.5), 0.5);
});

test('阻尼与最短角差', () => {
  // 阻尼应单调趋近目标且永不越过
  let v = 0;
  for (let i = 0; i < 200; i++) v = damp(v, 10, 6, 1 / 60);
  near(v, 10, 0.01);
  near(shortAngle(0.1, 6.2), -0.183, 0.01);
  near(shortAngle(6.2, 0.1), 0.183, 0.01);
  assert.ok(Math.abs(shortAngle(0, Math.PI * 1.9)) <= Math.PI + 1e-6);
});

test('确定性 PRNG 与散列', () => {
  const a = mulberry32(42), b = mulberry32(42);
  for (let i = 0; i < 20; i++) assert.equal(a(), b());
  const r = mulberry32(7);
  for (let i = 0; i < 500; i++) { const v = r(); assert.ok(v >= 0 && v < 1); }
  // hash3 稳定且落在 [0,1)
  assert.equal(hash3(3, -4, 12), hash3(3, -4, 12));
  assert.notEqual(hash3(3, -4, 12), hash3(3, -4, 13));
  for (let i = -20; i < 20; i++) { const v = hash3(i, i * 3, i * 7); assert.ok(v >= 0 && v < 1); }
});

test('mat4 单位元与乘法', () => {
  const I = mat4.create();
  nearArr(I, new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]));
  const a = mat4.fromTranslation(mat4.create(), 1, 2, 3);
  const out = mat4.multiply(mat4.create(), a, I);
  nearArr(out, a);
});

test('mat4 求逆', () => {
  const m = mat4.create();
  mat4.fromAxisAngle(m, 0, 1, 0, 0.7);
  m[12] = 12; m[13] = -4; m[14] = 6;
  const inv = mat4.invert(mat4.create(), m);
  const prod = mat4.multiply(mat4.create(), m, inv);
  nearArr(prod, mat4.create(), 1e-4);
});

test('lookAt 把注视点映射到视空间 -Z 轴', () => {
  const v = mat4.lookAt(mat4.create(), [0, 0, 10], [0, 0, 0], [0, 1, 0]);
  const p = vec3.transformMat4(vec3.create(), [0, 0, 0], v);
  nearArr(p, [0, 0, -10]);
  const q = vec3.transformMat4(vec3.create(), [1, 0, 0], v);
  near(q[0], 1);
});

test('perspective 把近/远平面映射到 -1/1', () => {
  const p = mat4.perspective(mat4.create(), 1.0, 1.5, 1, 100);
  const proj = (z) => {
    const w = -z;
    return (p[10] * z + p[14]) / w;
  };
  near(proj(-1), -1, 1e-3);
  near(proj(-100), 1, 1e-3);
});

test('ortho 映射正确', () => {
  const o = mat4.ortho(mat4.create(), -2, 2, -2, 2, 1, 5);
  const a = vec3.transformMat4(vec3.create(), [2, 2, -1], o);
  nearArr(a, [1, 1, -1], 1e-4);
  const b = vec3.transformMat4(vec3.create(), [-2, -2, -5], o);
  nearArr(b, [-1, -1, 1], 1e-4);
});

test('compose：绕枢轴旋转保持枢轴不动', () => {
  const pivot = [10, 5, -3];
  const m = mat4.compose(mat4.create(), [0, 0, 0], [1, 0, 0], 1.234, 1, pivot);
  const p = vec3.transformMat4(vec3.create(), pivot, m);
  nearArr(p, pivot, 1e-3);
  // 平移分量叠加
  const m2 = mat4.compose(mat4.create(), [4, 0, 0], [1, 0, 0], 0, 1, pivot);
  const p2 = vec3.transformMat4(vec3.create(), [0, 0, 0], m2);
  nearArr(p2, [4, 0, 0], 1e-4);
});

test('compose：均匀缩放', () => {
  const m = mat4.compose(mat4.create(), [0, 0, 0], [0, 1, 0], 0, 2, [0, 0, 0]);
  const p = vec3.transformMat4(vec3.create(), [3, -1, 2], m);
  nearArr(p, [6, -2, 4], 1e-4);
});

test('vec3 基本运算', () => {
  near(vec3.len([3, 4, 0]), 5);
  near(vec3.dot([1, 2, 3], [4, -5, 6]), 12);
  nearArr(vec3.cross(vec3.create(), [1, 0, 0], [0, 1, 0]), [0, 0, 1]);
  nearArr(vec3.normalize(vec3.create(), [0, 0, 0]), [0, 0, 0]);   // 零向量不产生 NaN
  nearArr(vec3.addScaled(vec3.create(), [1, 1, 1], [2, 0, 0], 3), [7, 1, 1]);
});

test('视锥体裁剪', () => {
  const view = mat4.lookAt(mat4.create(), [0, 0, 60], [0, 0, 0], [0, 1, 0]);
  const proj = mat4.perspective(mat4.create(), 0.8, 1, 1, 500);
  const vp = mat4.multiply(mat4.create(), proj, view);
  const planes = extractFrustum(new Float32Array(24), vp);
  assert.ok(sphereInFrustum(planes, 0, 0, 0, 5), '原点应在视锥内');
  assert.ok(!sphereInFrustum(planes, 0, 0, 400, 5), '相机后方应被剔除');
  assert.ok(!sphereInFrustum(planes, 900, 0, 0, 5), '远离侧向应被剔除');
  assert.ok(sphereInFrustum(planes, 0, 0, 400, 500), '足够大的球即使中心在后方也应保留');
});

test('颜色工具', () => {
  near(srgbToLinear(0), 0);
  near(srgbToLinear(255), 1, 1e-6);
  assert.ok(srgbToLinear(128) < 0.25);
  assert.deepEqual(parseColor('#ff8000'), [255, 128, 0]);
  assert.deepEqual(parseColor([1, 2, 3]), [1, 2, 3]);
  const [r, g, b] = hsl(0, 1, 0.5);
  assert.deepEqual([r, g, b], [255, 0, 0]);
  const grey = hsl(200, 0, 0.5);
  assert.equal(grey[0], grey[1]);
  assert.equal(grey[1], grey[2]);
});
