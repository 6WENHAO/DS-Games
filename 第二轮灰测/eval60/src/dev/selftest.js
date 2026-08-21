/**
 * 浏览器内自检（仅在 ?selftest=1 时加载）。
 * 逐个视角渲染若干帧，回读帧缓冲，输出：
 *   - WebGL 渲染统计（draw call / 三角面 / 着色器程序数）
 *   - 亮度直方图与分区统计（判断画面是否为黑屏 / 过曝）
 *   - ASCII 亮度图（无需看图即可判断构图、飞船与黑洞是否成像）
 * 结果写入 #diag，配合 chrome --dump-dom 可完全自动化巡检。
 */
const RAMP = ' .:-=+*#%@';

function analyze(gl, w, h) {
  const buf = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  const COLS = 64, ROWS = 26;
  const grid = new Float64Array(COLS * ROWS);
  const gridN = new Float64Array(COLS * ROWS);
  let sum = 0, min = 1, max = 0, bright = 0, dark = 0, nan = 0;
  const hist = new Array(10).fill(0);

  for (let y = 0; y < h; y++) {
    const gy = Math.min(ROWS - 1, Math.floor(((h - 1 - y) / h) * ROWS));
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = buf[i] / 255, g = buf[i + 1] / 255, b = buf[i + 2] / 255;
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (!Number.isFinite(l)) { nan++; continue; }
      sum += l;
      if (l < min) min = l;
      if (l > max) max = l;
      if (l > 0.7) bright++;
      if (l < 0.02) dark++;
      hist[Math.min(9, Math.floor(l * 10))]++;
      const gx = Math.min(COLS - 1, Math.floor((x / w) * COLS));
      const gi = gy * COLS + gx;
      grid[gi] += l;
      gridN[gi]++;
    }
  }
  const n = w * h;
  // 中心区域（飞船所在）与四周背景对比
  let cSum = 0, cN = 0, bSum = 0, bN = 0, cMax = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const l = (0.2126 * buf[i] + 0.7152 * buf[i + 1] + 0.0722 * buf[i + 2]) / 255;
      const inCenter = Math.abs(x / w - 0.5) < 0.18 && Math.abs(y / h - 0.5) < 0.22;
      if (inCenter) { cSum += l; cN++; if (l > cMax) cMax = l; }
      else if (x < w * 0.12 || x > w * 0.88) { bSum += l; bN++; }
    }
  }
  let art = '';
  for (let r = 0; r < ROWS; r++) {
    let line = '';
    for (let c = 0; c < COLS; c++) {
      const gi = r * COLS + c;
      const v = gridN[gi] ? grid[gi] / gridN[gi] : 0;
      // 非线性映射，暗部细节更明显
      const k = Math.min(9, Math.max(0, Math.round(Math.pow(v, 0.45) * 9)));
      line += RAMP[k];
    }
    art += `|${line}|\n`;
  }
  return {
    mean: sum / n, min, max,
    brightPct: (bright / n) * 100,
    darkPct: (dark / n) * 100,
    nan,
    center: cSum / Math.max(1, cN),
    centerMax: cMax,
    border: bSum / Math.max(1, bN),
    hist: hist.map((v) => ((v / n) * 100).toFixed(1)),
    art,
  };
}

/** 过屏幕中心的亮度扫描线，用于精确判断黑洞剪影/光环的径向剖面 */
function scanline(gl, dir = 'h', samples = 32) {
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  const out = [];
  const px = new Uint8Array(4);
  for (let i = 0; i < samples; i++) {
    const t = (i + 0.5) / samples;
    const x = dir === 'h' ? Math.floor(t * (w - 1)) : Math.floor(w / 2);
    const y = dir === 'h' ? Math.floor(h / 2) : Math.floor(t * (h - 1));
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const l = (0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2]) / 255;
    out.push(l.toFixed(2).slice(1));
  }
  return out;
}

export function createSelfTest(ctx) {
  const { renderer, flight, rig, pois, blackHole, hud, setTarget, ship, postfx } = ctx;
  const lines = [];
  const log = (s) => lines.push(s);
  // 借用已有向量实例的构造函数，避免额外 import
  const V3 = flight.position.constructor;

  const goto = (key, dist, mode) => {
    const poi = pois.find((p) => p.key === key);
    if (!poi) return;
    if (key === 'bh') {
      const dir = new V3(0.5, 0.22, 0.84).normalize();
      flight.setSpawn(poi.position.clone().addScaledVector(dir, dist), poi.position);
    } else {
      flight.setSpawnNear(poi, { dist, height: dist * 0.18 });
    }
    setTarget?.(key);
    rig.setMode(mode ?? 'chase');
    rig._init = false;
  };

  /** 纯净黑洞取景：隐藏本舰，机头直指黑洞，相机贴在舰位 */
  const bhView = (dist, { jets = true } = {}) => {
    goto('bh', dist, 'cockpit');
    ship.group.visible = false;
    blackHole.jets.visible = jets;
    flight.throttle = 0;
  };
  const restoreShip = () => {
    ship.group.visible = true;
    blackHole.jets.visible = true;
  };

  const steps = [
    {
      name: '出生点 · 地球 追尾视角',
      frames: 26,
      setup: () => { restoreShip(); rig.setMode('chase'); flight.throttle = 0.45; },
    },
    { name: '座舱视角', frames: 12, setup: () => { restoreShip(); rig.setMode('cockpit'); } },
    {
      name: '电影视角 · 战舰特写',
      frames: 14,
      setup: () => { restoreShip(); rig.setMode('cine'); flight.throttle = 0.85; },
    },
    {
      name: '黑洞 · 纯净视图 26 rs（隐藏本舰）',
      frames: 16,
      scan: true,
      setup: () => { bhView(blackHole.rs * 26); },
    },
    {
      name: '黑洞 · 纯净视图 11 rs（隐藏本舰）',
      frames: 14,
      scan: true,
      setup: () => { bhView(blackHole.rs * 11); },
    },
    {
      name: '黑洞 · 11 rs 且关闭喷流',
      frames: 12,
      scan: true,
      setup: () => { bhView(blackHole.rs * 11, { jets: false }); },
    },
    {
      name: '黑洞 · 16 rs 关闭泛光（验证纯净剪影）',
      frames: 12,
      scan: true,
      setup: () => {
        bhView(blackHole.rs * 16, { jets: false });
        if (postfx) postfx.bloom.enabled = false;
      },
    },
    {
      name: '黑洞 · 16 rs 开启泛光（成片效果）',
      frames: 10,
      scan: true,
      setup: () => {
        bhView(blackHole.rs * 16, { jets: true });
        if (postfx) postfx.bloom.enabled = true;
      },
    },
    {
      name: '土星 · 行星环',
      frames: 14,
      setup: () => { restoreShip(); goto('saturn', 3400, 'chase'); },
    },
    {
      name: '太阳 · 日冕',
      frames: 14,
      setup: () => { restoreShip(); goto('sun', 16000, 'chase'); },
    },
    {
      name: '恢复 · 追尾视角 + 加力',
      frames: 12,
      setup: () => {
        restoreShip();
        goto('earth', 1250, 'chase');
        flight.throttle = 1;
        flight.boost = 1;
      },
    },
  ];

  let stepIndex = 0;
  let frame = 0;
  let done = false;

  return {
    get done() { return done; },
    tick() {
      if (done) return;
      const step = steps[stepIndex];
      if (frame === 0) step.setup?.();
      frame++;
      if (frame < step.frames) return;

      const gl = renderer.getContext();
      const a = analyze(gl, gl.drawingBufferWidth, gl.drawingBufferHeight);
      const info = renderer.info;
      log(`\n=== [${stepIndex + 1}/${steps.length}] ${step.name} ===`);
      log(`draw calls=${info.render.calls} tris=${info.render.triangles} programs=${info.programs?.length ?? '?'} `
        + `geoms=${info.memory.geometries} tex=${info.memory.textures}`);
      log(`亮度 mean=${a.mean.toFixed(4)} min=${a.min.toFixed(3)} max=${a.max.toFixed(3)} `
        + `bright%=${a.brightPct.toFixed(2)} dark%=${a.darkPct.toFixed(2)} nan=${a.nan}`);
      log(`中心区 mean=${a.center.toFixed(4)} max=${a.centerMax.toFixed(3)} / 边缘 mean=${a.border.toFixed(4)}`);
      log(`直方图% ${a.hist.join(' ')}`);
      if (step.scan) {
        log(`水平扫描线(过屏幕中心, 32 采样) ${scanline(gl, 'h').join(' ')}`);
        log(`垂直扫描线(过屏幕中心, 32 采样) ${scanline(gl, 'v').join(' ')}`);
      }
      log(a.art.trimEnd());

      frame = 0;
      stepIndex++;
      if (stepIndex >= steps.length) {
        done = true;
        const glErr = gl.getError();
        log(`\nglGetError=${glErr} (0 = 正常)`);
        log(`__DIAG(${(window.__DIAG || []).length} 条): ${(window.__DIAG || []).slice(0, 24).join(' || ') || '无'}`);
        log('SELFTEST_COMPLETE');
        const el = document.getElementById('diag');
        if (el) el.textContent += `\n${lines.join('\n')}`;
        window.__SELFTEST = lines.join('\n');
        window.__SELFTEST_DONE = true;
        hud?.message?.('自检完成', 4000);
      }
    },
  };
}
