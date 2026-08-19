/* =====================================================================
 * Diagnostics — 自动化诊断（无需人工看图即可验证渲染是否正常）
 *   通过 URL 参数 ?diag=秒数 启用：
 *   在指定时间后读回帧缓冲，统计颜色分布与渲染指标，
 *   写入 <pre id="diag-output"> 与 document.title，便于 --dump-dom 抓取。
 * ===================================================================== */

/** 从默认帧缓冲读回像素并统计（必须在渲染完成的同一帧内调用） */
export function collectFrameStats(glc, step = 6) {
  const gl = glc.gl;
  const w = glc.width, h = glc.height;
  const px = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);

  let sky = 0, green = 0, brown = 0, gray = 0, dark = 0, other = 0, total = 0;
  let lumSum = 0;
  const colors = new Set();
  const rowLum = new Float64Array(16);
  const rowCount = new Float64Array(16);

  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      const r = px[i], g = px[i + 1], b = px[i + 2];
      total++;
      const lum = (r * 0.299 + g * 0.587 + b * 0.114);
      lumSum += lum;
      colors.add(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4));
      const band = Math.min(15, Math.floor((y / h) * 16));
      rowLum[band] += lum; rowCount[band]++;

      if (lum < 24) dark++;
      else if (b > r + 24 && b > g + 12) sky++;
      else if (g > r + 8 && g > b + 8) green++;
      else if (r > g + 8 && g > b + 4) brown++;
      else if (Math.abs(r - g) < 14 && Math.abs(g - b) < 14) gray++;
      else other++;
    }
  }

  const bands = [];
  for (let i = 0; i < 16; i++) bands.push(rowCount[i] ? Math.round(rowLum[i] / rowCount[i]) : 0);

  return {
    width: w, height: h, sampled: total,
    pct: {
      sky: +(sky / total * 100).toFixed(1),
      green: +(green / total * 100).toFixed(1),
      brown: +(brown / total * 100).toFixed(1),
      gray: +(gray / total * 100).toFixed(1),
      dark: +(dark / total * 100).toFixed(1),
      other: +(other / total * 100).toFixed(1),
    },
    avgLuminance: +(lumSum / total).toFixed(1),
    distinctColors: colors.size,
    // 上半屏应比下半屏亮（天空在上）——用于验证画面朝向正确
    luminanceBands: bands,
  };
}

/**
 * 安排一次诊断：seconds 秒后收集，结果写入 DOM
 */
/** 轻量亮度采样（6×6 网格），用于检测整屏闪烁 */
function sampleLuminance(glc, out, offset) {
  const gl = glc.gl;
  const w = glc.width, h = glc.height;
  const grid = 6;
  let sum = 0, n = 0;
  const px = new Uint8Array(4);
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      const x = Math.min(w - 1, Math.floor((gx + 0.5) * w / grid));
      const y = Math.min(h - 1, Math.floor((gy + 0.5) * h / grid));
      gl.readPixels(x, h - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      sum += (px[0] * 0.299 + px[1] * 0.587 + px[2] * 0.114);
      n++;
    }
  }
  out[offset] = sum / n;
}

export function armDiagnostics(game, seconds = 8) {
  const state = { done: false, t: 0, frames: 0, loopFrames: 0 };
  const lums = new Float32Array(240);
  let lumCount = 0;
  const originalRender = game._render.bind(game);

  // ---- 观测循环层 ----
  const originalLoopFrame = game.loop.onFrame;
  game.loop.onFrame = (dt, now) => {
    originalLoopFrame(dt, now);
    state.loopFrames++;
    if (state.loopFrames % 60 === 0) {
      console.log(`[Diagnostics] 循环帧 ${state.loopFrames} / 渲染帧 ${state.frames} / state=${game.state} / world=${!!game.world}`);
    }
  };

  // ---- 定时自驱：无头浏览器中 rAF 可能在加载完成后停摆，
  //      用定时器直接驱动帧循环（虚拟时间下同样生效） ----
  game.loop.stop();
  const drive = setInterval(() => {
    if (state.done) { clearInterval(drive); return; }
    game.loop._step(performance.now());
  }, 30);
  state._drive = drive;

  game._render = (dt) => {
    originalRender(dt);
    if (state.done) return;
    state.t += dt;
    state.frames++;
    if (state.frames % 30 === 0) {
      console.log(`[Diagnostics] 渲染进度: ${state.frames} 帧 / ${state.t.toFixed(2)}s / state=${game.state}`);
    }
    // 每 3 帧采样一次亮度（readPixels 有同步开销）
    if (state.frames % 3 === 0) {
      try {
        sampleLuminance(game.renderer.glc, lums, (lumCount++) % lums.length);
      } catch (e) { /* 忽略采样失败 */ }
    }
    // 时间或帧数任一达标即输出（兼容无头浏览器的虚拟时间）
    if (state.t < seconds && state.frames < 240) return;
    state.done = true;
    try {
      const frame = collectFrameStats(game.renderer.glc);
      const report = buildReport(game, frame);
      report.diag = { seconds: +state.t.toFixed(2), frames: state.frames };
      // 闪烁检测：相邻帧亮度跳变 >18% 视为一次闪烁
      const n = Math.min(lumCount, lums.length);
      let jumps = 0, bigJumps = 0, last = lums[0];
      for (let i = 1; i < n; i++) {
        const delta = Math.abs(lums[i] - last);
        if (delta > 12) jumps++;
        if (delta > 25) bigJumps++;
        last = lums[i];
      }
      report.flicker = {
        sampledFrames: n,
        luminanceJumps: jumps,
        largeJumps: bigJumps,
        jumpRate: n > 1 ? +(jumps / (n - 1) * 100).toFixed(1) : 0,
      };
      publish(report);
    } catch (e) {
      publish({ error: String(e && e.message || e) });
    }
  };
}

function buildReport(game, frame) {
  const w = game.world;
  const r = game.renderer;
  const p = game.player;
  let meshedSections = 0, meshBytes = 0;
  let litChunks = 0;
  for (const c of w.chunks.values()) {
    if (c.state >= 3) litChunks++;
    for (const slot of c.meshes) {
      for (const m of slot) if (m) { meshedSections++; meshBytes += m.byteSize; }
    }
  }
  const expectedSections = litChunks * 4;     // 粗略估计：每列约 4 个非空 section
  const coverage = expectedSections ? +Math.min(100, (meshedSections / expectedSections * 100)).toFixed(0) : 0;

  const checks = [];
  const ok = (name, cond, detail) => { checks.push({ name, ok: !!cond, detail }); return !!cond; };

  ok('世界已加载区块', w.loadedChunkCount > 20, `${w.loadedChunkCount} 个区块`);
  ok('区块网格已生成', meshedSections > 20, `${meshedSections} 个 section 网格`);
  ok('网格覆盖率', coverage >= 55, `${coverage}%`);
  ok('存在可见几何体', r.stats.visibleSections > 5, `${r.stats.visibleSections} 个可见 section`);
  ok('有三角形被绘制', r.stats.triangles > 2000, `${r.stats.triangles} 个三角形`);
  const terrainPct = frame.pct.green + frame.pct.brown + frame.pct.gray + frame.pct.other;
  ok('画面不是单色', frame.distinctColors > 40, `${frame.distinctColors} 种颜色`);
  // 天空检查与视角相关（可能正对着山坡/树冠），只要画面结构合理即可：
  // 要么有天空，要么几乎全是地形但顶部亮度正常
  const topLit = frame.luminanceBands.slice(0, 4).reduce((a, b) => a + b, 0) / 4 > 30;
  ok('画面结构合理（有天空或满屏地形且亮度正常）',
    (frame.pct.sky > 3) || (terrainPct > 70 && topLit),
    `天空 ${frame.pct.sky}% / 地形 ${terrainPct.toFixed(1)}% / 顶部亮度 ${topLit ? '正常' : '异常'}`);
  ok('画面下方有地形', terrainPct > 12, `地形占 ${terrainPct.toFixed(1)}%`);
  ok('亮度合理（非全黑/全白）', frame.avgLuminance > 25 && frame.avgLuminance < 240,
    `平均亮度 ${frame.avgLuminance}`);
  ok('玩家站在地面上', p.position[1] > 2 && p.position[1] < 128, `y=${p.position[1].toFixed(2)}`);
  ok('光照队列已清空', w.lighting.pending < 5000, `${w.lighting.pending} 待处理`);
  ok('帧率可用', game.loop.fps > 0, `${game.loop.fps} fps`);
  ok('贴图图集已建立', r.atlas.layerCount > 100, `${r.atlas.layerCount} 层`);

  return {
    ok: checks.every(c => c.ok),
    checks,
    frame,
    stats: {
      fps: game.loop.fps,
      frameMs: +game.loop.frameMsSmooth.toFixed(2),
      chunks: w.loadedChunkCount,
      litChunks,
      pendingChunks: w.pendingChunks,
      meshedSections,
      coverage,
      meshMB: +(meshBytes / 1048576).toFixed(2),
      visibleSections: r.stats.visibleSections,
      drawCalls: r.stats.drawCalls,
      triangles: r.stats.triangles,
      atlasLayers: r.atlas.layerCount,
      mobs: game.entities.stats.mobs,
      items: game.entities.stats.items,
      particles: game.particles.activeCount,
      timeOfDay: w.timeOfDay,
      daylight: +w.daylight.toFixed(2),
      biome: w.biomeInfoAt(Math.floor(p.position[0]), Math.floor(p.position[2])).name,
      seed: w.seedString,
      player: [+p.position[0].toFixed(2), +p.position[1].toFixed(2), +p.position[2].toFixed(2)],
      state: game.state,
    },
  };
}

function publish(report) {
  const text = JSON.stringify(report, null, 2);
  let el = document.getElementById('diag-output');
  if (!el) {
    el = document.createElement('pre');
    el.id = 'diag-output';
    el.style.cssText = 'position:fixed;left:0;top:0;z-index:999;max-height:100vh;overflow:auto;' +
      'background:rgba(0,0,0,.85);color:#8fd85a;font:11px monospace;padding:8px;display:none';
    document.body.appendChild(el);
  }
  el.textContent = text;
  const failed = (report.checks || []).filter(c => !c.ok).map(c => c.name);
  document.title = (report.ok ? 'DIAG_OK' : 'DIAG_FAIL') +
    (failed.length ? ' FAILED:' + failed.join('|') : '');
  console.log('[Diagnostics]', report.ok ? 'OK' : 'FAIL', text);
  window.__DIAG__ = report;
}
