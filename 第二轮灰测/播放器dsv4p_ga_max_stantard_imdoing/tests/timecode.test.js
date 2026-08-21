'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

require('../src/core/ns.js');
const TC = require('../src/core/timecode.js');

function near(actual, expected, eps = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= eps, `期望 ${actual} ≈ ${expected}（ε=${eps}）`);
}

describe('formatTime', () => {
  test('0 -> 00:00:00.000', () => {
    assert.equal(TC.formatTime(0), '00:00:00.000');
  });

  test('3661.5 -> 01:01:01.500', () => {
    assert.equal(TC.formatTime(3661.5), '01:01:01.500');
  });

  test('四舍五入不得出现 :60.000', () => {
    const s = TC.formatTime(59.9996, 3);
    assert.equal(s, '00:01:00.000');
    assert.ok(!s.includes(':60.'));
  });

  test('负数保留 - 号', () => {
    assert.equal(TC.formatTime(-3661.5), '-01:01:01.500');
  });

  test('非有限值 -> 占位符', () => {
    assert.equal(TC.formatTime(NaN), '--:--:--.---');
    assert.equal(TC.formatTime(Infinity), '--:--:--.---');
    assert.equal(TC.formatTime(null), '--:--:--.---');
  });
});

describe('formatShort / formatDuration', () => {
  test('formatShort 基本形态', () => {
    assert.equal(TC.formatShort(83), '1:23.00');
    assert.equal(TC.formatShort(3661), '1:01:01.00');
    assert.equal(TC.formatShort(0), '0:00.00');
  });

  test('formatDuration 基本形态', () => {
    assert.equal(TC.formatDuration(30), '30.00s');
    assert.equal(TC.formatDuration(90), '1:30.0');
    assert.equal(TC.formatDuration(NaN), '—');
  });
});

describe('snapFps', () => {
  test('常见帧率吸附', () => {
    assert.equal(TC.snapFps(29.97002997), 29.97);
    assert.equal(TC.snapFps(23.976023976), 23.976);
    assert.equal(TC.snapFps(30.0001), 30);
  });

  test('奇怪帧率不吸附', () => {
    assert.equal(TC.snapFps(17.3), 17.3);
  });
});

describe('isDropFrameRate', () => {
  test('29.97 / 59.94 为丢帧', () => {
    assert.equal(TC.isDropFrameRate(29.97), true);
    assert.equal(TC.isDropFrameRate(59.94), true);
  });

  test('25 / 30 非丢帧', () => {
    assert.equal(TC.isDropFrameRate(25), false);
    assert.equal(TC.isDropFrameRate(30), false);
  });
});

describe('非丢帧 SMPTE 往返', () => {
  for (const fps of [24, 25, 30, 60]) {
    test(`@${fps} 精确往返`, () => {
      for (const f of [0, 1, 23, 24, 1000, 7199, 86399]) {
        assert.equal(TC.smpteToFrame(TC.frameToSmpte(f, fps), fps), f);
      }
      // 分隔符为 ':'，非 ';'
      const s = TC.frameToSmpte(0, fps);
      assert.ok(s.includes(':'));
      assert.ok(!s.includes(';'));
    });
  }
});

describe('丢帧 SMPTE 往返', () => {
  for (const fps of [29.97, 59.94]) {
    test(`@${fps} 大范围精确往返`, () => {
      for (let f = 0; f <= 200000; f += 997) {
        assert.equal(TC.smpteToFrame(TC.frameToSmpte(f, fps), fps), f);
      }
    });

    test(`@${fps} 非整十分钟边界不存在 ;00 / ;01`, () => {
      // 全量扫描：分钟数非 10 的倍数时，秒=0 的帧号不得为 00 或 01（被丢弃）
      for (let f = 0; f <= 200000; f++) {
        const s = TC.frameToSmpte(f, fps);
        const m = /^(\d{1,2}):(\d{2}):(\d{2});(\d{2})$/.exec(s);
        if (m && +m[2] % 10 !== 0 && +m[3] === 0) {
          assert.ok(+m[4] >= 2, `帧 ${f} 输出了被丢弃的时间码 ${s}`);
        }
      }
    });

    test(`@${fps} 分隔符为 ';'`, () => {
      assert.ok(TC.frameToSmpte(0, fps).includes(';'));
    });
  }
});

describe('parseDetailed / parse', () => {
  test("'12' -> 12 秒", () => {
    const d = TC.parseDetailed('12');
    assert.equal(d.seconds, 12);
    assert.equal(d.kind, 'seconds');
    assert.equal(TC.parse('12'), 12);
  });

  test("'12.345'", () => {
    assert.equal(TC.parse('12.345'), 12.345);
  });

  test("'1:23' -> 83", () => {
    const d = TC.parseDetailed('1:23');
    assert.equal(d.seconds, 83);
    assert.equal(d.kind, 'clock');
  });

  test("'1:02:03.456'", () => {
    assert.equal(TC.parse('1:02:03.456'), 3723.456);
  });

  test("'00:00:12:07' @25 -> kind smpte, seconds ≈ 307/25", () => {
    const d = TC.parseDetailed('00:00:12:07', 25);
    assert.equal(d.kind, 'smpte');
    assert.equal(d.frame, 307);
    near(d.seconds, 307 / 25);
  });

  test("'#375' 与 '375f' -> kind frame", () => {
    const a = TC.parseDetailed('#375', 25);
    assert.equal(a.kind, 'frame');
    assert.equal(a.frame, 375);
    near(a.seconds, 375 / 25);

    const b = TC.parseDetailed('375f', 25);
    assert.equal(b.kind, 'frame');
    assert.equal(b.frame, 375);
  });

  test("'1500ms' -> 1.5", () => {
    const d = TC.parseDetailed('1500ms');
    assert.equal(d.kind, 'ms');
    assert.equal(d.seconds, 1.5);
  });

  test("垃圾 'abc' -> NaN + kind invalid", () => {
    const d = TC.parseDetailed('abc');
    assert.equal(d.kind, 'invalid');
    assert.ok(Number.isNaN(d.seconds));
  });

  test("空串 -> kind empty", () => {
    const d = TC.parseDetailed('');
    assert.equal(d.kind, 'empty');
    assert.ok(Number.isNaN(d.seconds));
  });

  test("前导 '-' 取负", () => {
    assert.equal(TC.parse('-1:23'), -83);
    assert.equal(TC.parse('-12'), -12);
  });
});
