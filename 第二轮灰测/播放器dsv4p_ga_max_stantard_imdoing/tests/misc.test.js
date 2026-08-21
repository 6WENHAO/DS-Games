'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

require('../src/core/ns.js');
// 滤镜文件使用 window.DSV4P —— 在 Node 下先挂上 window 别名再 require
global.window = global;
const R = require('../src/gl/resources.js');
const MarkerList = require('../src/core/markers.js');
require('../src/gl/filters/color.js');
require('../src/gl/filters/custom.js');
require('../src/gl/filters/optics.js');
require('../src/gl/filters/pixel.js');
require('../src/gl/filters/style.js');

const D = global.DSV4P;
const U = D.util;

function near(actual, expected, eps = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= eps, `期望 ${actual} ≈ ${expected}（ε=${eps}）`);
}

describe('resources', () => {
  test('bayerMatrix 递归性质与置换', () => {
    assert.deepEqual(R.bayerMatrix(2), [[0, 2], [3, 1]]);
    for (const n of [2, 4, 8]) {
      const m = R.bayerMatrix(n);
      const flat = m.flat();
      const set = new Set(flat);
      assert.equal(flat.length, n * n);
      assert.equal(set.size, n * n);
      assert.equal(Math.min(...flat), 0);
      assert.equal(Math.max(...flat), n * n - 1);
    }
  });

  test('bayerBytes(8)', () => {
    const b = R.bayerBytes(8);
    assert.equal(b.length, 8 * 8 * 4);
    const thr = new Set();
    for (let i = 0; i < 64; i++) {
      assert.equal(b[i * 4 + 3], 255);
      assert.equal(b[i * 4], b[i * 4 + 1]);
      assert.equal(b[i * 4 + 1], b[i * 4 + 2]);
      thr.add(b[i * 4]);
    }
    assert.equal(thr.size, 64);
  });

  test('mulberry32 确定性与范围', () => {
    const a = R.mulberry32(42);
    const b = R.mulberry32(42);
    const c = R.mulberry32(43);
    const a1 = [], a2 = [], a3 = [];
    for (let i = 0; i < 5; i++) { a1.push(a()); a2.push(b()); a3.push(c()); }
    assert.deepEqual(a1, a2);
    assert.notDeepEqual(a1, a3);
    for (const x of a1) assert.ok(x >= 0 && x < 1);
  });

  test('noiseBytes(64) 长度与确定性', () => {
    const a = R.noiseBytes(64);
    const b = R.noiseBytes(64);
    assert.equal(a.length, 64 * 64 * 4);
    assert.deepEqual(a, b);
  });

  test('paletteById', () => {
    assert.equal(R.paletteById('gb-dmg').colors.length, 4);
    assert.equal(R.paletteById('nope'), R.palettes[0]);
  });

  test('paletteFloats 基本', () => {
    const p = R.paletteFloats(['#ff0000', '#00ff00']);
    assert.equal(p.count, 2);
    assert.equal(p.data.length, 96);
    near(p.data[0], 1); near(p.data[1], 0); near(p.data[2], 0);
    near(p.data[3], 0); near(p.data[4], 1); near(p.data[5], 0);
    // 剩余槽位重复最后一色 #00ff00
    near(p.data[90], 0); near(p.data[91], 1); near(p.data[92], 0);
  });

  test('paletteFloats 40 色 clamp 到 32', () => {
    const colors = Array.from({ length: 40 }, () => '#010203');
    assert.equal(R.paletteFloats(colors).count, 32);
  });
});

describe('util', () => {
  test('clamp', () => {
    assert.equal(U.clamp(5, 0, 10), 5);
    assert.equal(U.clamp(-1, 0, 10), 0);
    assert.equal(U.clamp(11, 0, 10), 10);
  });

  test('lerp', () => {
    assert.equal(U.lerp(0, 10, 0.5), 5);
    assert.equal(U.lerp(2, 4, 0.25), 2.5);
  });

  test('round', () => {
    assert.equal(U.round(1.2345, 2), 1.23);
    assert.equal(U.round(2.5, 0), 3);
    assert.equal(U.round(1234, -2), 1200);
  });

  test('pad', () => {
    assert.equal(U.pad(5, 3), '005');
    assert.equal(U.pad(12, 3), '012');
    assert.equal(U.pad(123, 2), '123');
  });

  test('median（不改入参）', () => {
    assert.equal(U.median([1, 2, 3]), 2);
    assert.equal(U.median([1, 2, 3, 4]), 2.5);
    assert.equal(U.median([5]), 5);
    assert.ok(Number.isNaN(U.median([])));
    const arr = [3, 1, 2];
    U.median(arr);
    assert.deepEqual(arr, [3, 1, 2]);
  });

  test('lowerIndex 边界', () => {
    assert.equal(U.lowerIndex([], 5), -1);
    assert.equal(U.lowerIndex([1, 2, 3], 0), -1);
    assert.equal(U.lowerIndex([1, 2, 3], 2), 1);
    assert.equal(U.lowerIndex([1, 2, 3], 2.5), 1);
    assert.equal(U.lowerIndex([1, 3, 5, 7, 9], 4, 3), 1);
  });

  test('hexToRgb / rgbToHex', () => {
    assert.deepEqual(U.hexToRgb('#ff0000'), [1, 0, 0]);
    assert.equal(U.rgbToHex([1, 0, 0]), '#ff0000');
    assert.equal(U.rgbToHex(U.hexToRgb('#abc')), '#aabbcc');
    assert.deepEqual(U.hexToRgb('nonsense'), [0, 0, 0]);
    assert.deepEqual(U.hexToRgb(''), [0, 0, 0]);
    assert.deepEqual(U.hexToRgb('#12'), [0, 0, 0]);
  });

  test('bytes 格式化', () => {
    assert.equal(U.bytes(0), '0 B');
    assert.equal(U.bytes(512), '512 B');
    assert.equal(U.bytes(1024), '1.00 KB');
    assert.equal(U.bytes(1024 * 1024), '1.00 MB');
    assert.equal(U.bytes(null), '—');
    assert.equal(U.bytes(Infinity), '—');
  });
});

describe('markers', () => {
  test('add 保持按帧排序并返回条目', () => {
    const m = new MarkerList();
    assert.equal(m.add(10, 'a').frame, 10);
    assert.equal(m.add(5, 'b').frame, 5);
    assert.equal(m.add(20, 'c').frame, 20);
    assert.deepEqual(m.items.map(x => x.frame), [5, 10, 20]);
  });

  test('同帧 add 更新 label 不重复', () => {
    const m = new MarkerList();
    m.add(10, 'a');
    m.add(10, 'b');
    assert.equal(m.items.length, 1);
    assert.equal(m.items[0].label, 'b');
  });

  test('toggle 删除后重新添加', () => {
    const m = new MarkerList();
    assert.ok(m.toggle(10));
    assert.equal(m.toggle(10), null);
    assert.equal(m.toggle(10).frame, 10);
  });

  test('next/prev/nearest 边界', () => {
    const m = new MarkerList();
    for (const f of [5, 10, 20]) m.add(f);
    assert.equal(m.next(10).frame, 20);
    assert.equal(m.next(20), null);
    assert.equal(m.prev(10).frame, 5);
    assert.equal(m.prev(5), null);
    assert.equal(m.nearest(12).frame, 10);
    assert.equal(m.nearest(17).frame, 20);
    assert.equal(new MarkerList().nearest(5), null);
  });

  test('spanAround 0/1/2+ 标记', () => {
    assert.equal(new MarkerList().spanAround(5), null);

    const one = new MarkerList(); one.add(10);
    assert.deepEqual(one.spanAround(5), { inFrame: 0, outFrame: 9 });
    assert.deepEqual(one.spanAround(15), { inFrame: 10, outFrame: 10 });

    const two = new MarkerList(); two.add(10); two.add(20);
    assert.deepEqual(two.spanAround(5), { inFrame: 0, outFrame: 9 });
    assert.deepEqual(two.spanAround(15), { inFrame: 10, outFrame: 19 });
    assert.deepEqual(two.spanAround(25), { inFrame: 20, outFrame: 20 });
  });

  test('serialize/load 往返', () => {
    const m = new MarkerList(); m.add(10, 'a'); m.add(20, 'b');
    const s = m.serialize();
    const m2 = new MarkerList(); m2.load(s);
    assert.deepEqual(m2.serialize(), s);
  });

  test('load 拒绝无效条目并 clamp 负帧', () => {
    const m = new MarkerList();
    m.load([{ label: 'no-frame' }, { frame: 5, label: 'ok' }, { frame: -3, label: 'neg' }]);
    assert.deepEqual(m.items.map(x => x.frame), [0, 5]);
    assert.equal(m.items[0].label, 'neg');
  });

  test('change 事件触发', () => {
    const m = new MarkerList();
    let n = 0;
    m.on('change', () => n++);
    m.add(1);
    m.add(2);
    m.remove(2);
    assert.equal(n, 3);
  });
});

describe('filter registry', () => {
  test('至少 25 个且 id 唯一', () => {
    assert.ok(D.filters.length >= 25, `filters=${D.filters.length}`);
    const ids = D.filters.map(f => f.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test('passes 含非空 fs', () => {
    for (const f of D.filters) {
      assert.ok(Array.isArray(f.passes) && f.passes.length > 0, `${f.id} 缺少 passes`);
      for (const p of f.passes) {
        assert.ok(typeof p.fs === 'string' && p.fs.trim().length > 0, `${f.id} 的 pass fs 为空`);
      }
    }
  });

  test('param 类型合法', () => {
    const valid = new Set(['float', 'color', 'enum', 'bool']);
    for (const f of D.filters) {
      for (const p of (f.params || [])) {
        assert.ok(p.key, `${f.id} 参数缺少 key`);
        assert.ok(valid.has(p.type), `${f.id}.${p.key} 非法类型 ${p.type}`);
      }
    }
  });

  test('重复 id 抛错', () => {
    assert.throws(() => D.registerFilter({ id: 'grade' }), /重复/);
  });
});
