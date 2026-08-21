'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

require('../src/core/ns.js');
require('../src/core/timecode.js');
const FrameClock = require('../src/core/frameclock.js');

function near(actual, expected, eps = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= eps, `期望 ${actual} ≈ ${expected}（ε=${eps}）`);
}

describe('CFR 模式', () => {
  test('setCfr(25, 10) 基础', () => {
    const c = new FrameClock();
    c.setCfr(25, 10);
    assert.equal(c.mode, 'cfr');
    assert.equal(c.fps, 25);
    assert.equal(c.frameCount, 250);
  });

  test('timeOfFrame / frameAtTime / seekTarget 逐帧', () => {
    const c = new FrameClock();
    c.setCfr(25, 10);
    for (let i = 0; i < 250; i++) {
      assert.equal(c.timeOfFrame(i), i / 25);
      assert.equal(c.frameAtTime(i / 25), i);
      const a = c.timeOfFrame(i);
      const b = c.endOfFrame(i);
      const t = c.seekTargetForFrame(i);
      assert.ok(t >= a && t < b, `帧 ${i}：seekTarget ${t} 不在 [${a}, ${b})`);
    }
  });

  test('clampFrame 边界', () => {
    const c = new FrameClock();
    c.setCfr(25, 10);
    assert.equal(c.clampFrame(-1), 0);
    assert.equal(c.clampFrame(0), 0);
    assert.equal(c.clampFrame(249), 249);
    assert.equal(c.clampFrame(250), 249);
    assert.equal(c.clampFrame(NaN), 0);
  });
});

function makeIndex() {
  const N = 25;
  const d = 1001 / 24000;
  const times = new Float64Array(N);
  for (let i = 0; i < N; i++) times[i] = i * d;
  return {
    times,
    keyframes: new Int32Array([0, 12, 24]),
    frameCount: N,
    fps: 24000 / 1001,
    vfr: false,
    duration: N * d,
    timescale: 24000,
    structure: 'progressive'
  };
}

describe('index 模式', () => {
  test('frameAtTime / seekTarget 逐帧往返', () => {
    const c = new FrameClock();
    c.setIndex(makeIndex());
    const N = c.frameCount;
    for (let i = 0; i < N; i++) {
      assert.equal(c.frameAtTime(c.times[i]), i);
      assert.equal(c.frameAtTime(c.times[i] + 0.5 * c.frameDuration(i)), i);
      const a = c.timeOfFrame(i);
      const b = c.endOfFrame(i);
      const t = c.seekTargetForFrame(i);
      assert.ok(t >= a && t < b, `帧 ${i}：seekTarget ${t} 不在 [${a}, ${b})`);
    }
  });

  test('关键帧行为', () => {
    const c = new FrameClock();
    c.setIndex(makeIndex());
    assert.equal(c.isKeyframe(0), true);
    assert.equal(c.isKeyframe(12), true);
    assert.equal(c.isKeyframe(24), true);
    assert.equal(c.isKeyframe(5), false);
    assert.equal(c.prevKeyframe(5), 0);
    assert.equal(c.prevKeyframe(13), 12);
    assert.equal(c.prevKeyframe(24), 24);
    assert.equal(c.nextKeyframe(0), 12);
    assert.equal(c.nextKeyframe(12), 24);
    assert.equal(c.nextKeyframe(24), null);
  });

  test('keyframeTimes 匹配', () => {
    const c = new FrameClock();
    c.setIndex(makeIndex());
    const kt = c.keyframeTimes();
    assert.equal(kt.length, 3);
    near(kt[0], 0);
    near(kt[1], 12 * 1001 / 24000);
    near(kt[2], 24 * 1001 / 24000);
  });

  test('overrideFps 只改 nominalFps（times 不动）', () => {
    const c = new FrameClock();
    c.setIndex(makeIndex());
    const timesBefore = Array.from(c.times);
    const fpsBefore = c.fps;
    c.overrideFps(30);
    assert.equal(c.nominalFps, 30);
    assert.equal(c.fps, fpsBefore);
    assert.deepEqual(Array.from(c.times), timesBefore);
  });
});

describe('VFR 模式', () => {
  test('混合 1/30 与 1/12 间距的 frameAtTime 往返', () => {
    const times = new Float64Array([0, 1 / 30, 2 / 30, 3 / 30, 3 / 30 + 1 / 12]);
    const c = new FrameClock();
    c.setIndex({
      times,
      keyframes: new Int32Array([0]),
      frameCount: 5,
      fps: 30,
      vfr: true,
      duration: times[4] + 1 / 12,
      timescale: 30,
      structure: 'progressive'
    });
    assert.equal(c.vfr, true);
    for (let i = 0; i < 5; i++) {
      assert.equal(c.frameAtTime(times[i]), i);
      assert.equal(c.frameAtTime(times[i] + 0.5 * c.frameDuration(i)), i);
    }
  });
});

describe('observe 帧率学习', () => {
  test('错误初始帧率收敛到 30 并重算帧数', () => {
    const c = new FrameClock();
    c.setCfr(25, 10, 'assumed');
    let seed = 0x12345678;
    const nextJitter = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return (seed / 0x100000000 - 0.5) * 0.0006; // ±0.3ms
    };
    let updated = false;
    for (let k = 0; k < 60; k++) {
      if (c.observe(k / 30 + nextJitter())) updated = true;
    }
    assert.equal(updated, true);
    assert.equal(c.fps, 30);
    assert.ok(c.confidence > 0.5);
    assert.equal(c.frameCount, 300);
  });

  test('index 模式 observe 返回 false 且不动', () => {
    const c = new FrameClock();
    c.setIndex(makeIndex());
    const fpsBefore = c.fps;
    assert.equal(c.observe(1.0), false);
    assert.equal(c.fps, fpsBefore);
  });
});
