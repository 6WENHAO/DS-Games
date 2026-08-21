'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('../src/core/ns.js');
const Mp4Index = require('../src/core/mp4index.js');

const FIXTURES = path.join(__dirname, 'fixtures');

function near(actual, expected, eps = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= eps, `期望 ${actual} ≈ ${expected}（ε=${eps}）`);
}

function toArrayBuffer(buf) {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

async function load(name) {
  const buf = fs.readFileSync(path.join(FIXTURES, name + '.mp4'));
  return Mp4Index.fromArrayBuffer(toArrayBuffer(buf));
}

function hasFixture(name) {
  return fs.existsSync(path.join(FIXTURES, name + '.mp4'));
}

const CASES = [
  { name: 'cfr30', frameCount: 60, fps: 30, exactFps: true, structure: 'progressive', vfr: false },
  { name: 'cfr23976', frameCount: 48, fps: 24000 / 1001, exactFps: false, structure: 'progressive', vfr: false },
  { name: 'fragmented', frameCount: 60, fps: 30, exactFps: true, structure: 'fragmented', vfr: false },
  { name: 'vfr', frameCount: 42, fps: null, exactFps: false, structure: 'progressive', vfr: true }
];

describe('MP4 索引解析', () => {
  for (const c of CASES) {
    test(`${c.name} 解析`, async (t) => {
      if (!hasFixture(c.name)) {
        t.skip(`缺少 fixture：${c.name}.mp4`);
        return;
      }
      const r = await load(c.name);
      assert.ok(r, `${c.name}：结果应为非 null`);

      // times 严格递增且从 0 开始
      assert.equal(r.times[0], 0);
      for (let i = 1; i < r.times.length; i++) {
        assert.ok(r.times[i] > r.times[i - 1], `${c.name}：times[${i}] 未严格递增`);
      }

      assert.equal(r.frameCount, c.frameCount);
      assert.equal(r.codec, 'avc1');

      // 关键帧：非空、升序、首元素 0、均在范围内
      assert.ok(r.keyframes.length > 0, `${c.name}：关键帧为空`);
      for (let i = 1; i < r.keyframes.length; i++) {
        assert.ok(r.keyframes[i] > r.keyframes[i - 1], `${c.name}：关键帧未排序`);
      }
      assert.equal(r.keyframes[0], 0);
      for (const k of r.keyframes) {
        assert.ok(k >= 0 && k < r.frameCount, `${c.name}：关键帧 ${k} 越界`);
      }

      assert.ok(r.duration > 0);
      assert.ok(r.duration >= r.times[r.times.length - 1]);

      assert.equal(r.structure, c.structure);
      assert.equal(r.vfr, c.vfr);

      if (c.exactFps) {
        assert.equal(r.fps, c.fps);
      } else if (c.fps != null) {
        near(r.fps, c.fps);
      } else {
        assert.ok(r.fps > 0);
      }
    });
  }

  // 曾经的 bug：parseTkhd 的字段偏移算错（v0 应为 track_ID @ s+12、width @ s+76），
  // 导致宽高解析成 0x25956。已修复，这里锁定回归。
  test('宽高解析 width=128, height=72', async (t) => {
    if (!hasFixture('cfr30')) { t.skip('缺少 fixture'); return; }
    const r = await load('cfr30');
    assert.equal(r.width, 128);
    assert.equal(r.height, 72);
    assert.equal(r.codedWidth, 128);
    assert.equal(r.codedHeight, 72);
  });
});

describe('鲁棒性', () => {
  test('空 buffer -> null', async () => {
    const r = await Mp4Index.fromArrayBuffer(new ArrayBuffer(0));
    assert.equal(r, null);
  });

  test('随机字节 -> null', async () => {
    const bytes = new Uint8Array(4096);
    let s = 0x12345678;
    for (let i = 0; i < bytes.length; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      bytes[i] = s & 0xff;
    }
    const r = await Mp4Index.fromArrayBuffer(toArrayBuffer(bytes));
    assert.equal(r, null);
  });

  test('截断的真实文件（前 200 字节）-> null', async () => {
    const buf = fs.readFileSync(path.join(FIXTURES, 'cfr30.mp4'));
    const r = await Mp4Index.fromArrayBuffer(toArrayBuffer(buf.subarray(0, 200)));
    assert.equal(r, null);
  });
});
