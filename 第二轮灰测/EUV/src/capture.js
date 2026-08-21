/**
 * capture.js — 母版逐帧捕获 / 字幕导出 / 静态资产导出
 * ==================================================================
 * 规格书 §2 交付物：母版 4K 30fps、字幕 SRT/ASS、静态资产、封面图。
 *
 * 设计要点：
 *  · 捕获是「按帧号」而非「按时间流」驱动：frame → time = frame/fps，
 *    调用 app.setTime(time) + app.renderFrame()，因此结果确定性、可重跑、
 *    可断点续跑，且不会出现未渲染帧或帧间闪烁（§1.3）。
 *  · 帧通过 POST /__save 直接落盘（serve.py 提供），不走浏览器下载，
 *    否则 5400 帧无法交付。
 *  · master 档启用 SSAA 单帧内 2^level 次抖动采样，每帧渲染耗时高但无闪烁。
 *
 * 本模块运行在捕获工具页中，通过 iframe 驱动播放器页面的 window.__EUV__。
 */

const enc = (s) => encodeURIComponent(s);

/** 落盘（二进制） */
export async function saveBinary(relPath, blob) {
  const r = await fetch(`/__save?path=${enc(relPath)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: blob,
  });
  const j = await r.json().catch(() => ({ ok: false, error: 'bad json' }));
  if (!j.ok) throw new Error(`落盘失败 ${relPath}: ${j.error}`);
  return j;
}

/** 落盘（UTF-8 文本） */
export async function saveText(relPath, text) {
  return saveBinary(relPath, new Blob([text], { type: 'text/plain; charset=utf-8' }));
}

/**
 * canvas → Blob，带超时保护。
 * WebGL 上下文丢失时 toBlob 的回调可能永不触发，若不加超时，
 * 捕获循环会静默挂死（实测过的真实故障模式）。
 */
function toBlobWithTimeout(canvas, type, quality, ms = 45000) {
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error(`toBlob 超时 ${ms} ms（可能是 WebGL 上下文丢失，请重载播放器）`));
    }, ms);
    try {
      canvas.toBlob((b) => {
        if (done) return;
        done = true; clearTimeout(timer);
        b ? resolve(b) : reject(new Error('toBlob 返回空'));
      }, type, quality);
    } catch (e) {
      if (!done) { done = true; clearTimeout(timer); reject(e); }
    }
  });
}

/** canvas → PNG Blob */
export function canvasToPng(canvas) {
  return toBlobWithTimeout(canvas, 'image/png', undefined);
}

/** canvas → JPEG Blob（缩略图 / 封面用） */
export function canvasToJpeg(canvas, q = 0.94) {
  return toBlobWithTimeout(canvas, 'image/jpeg', q);
}

/** 把 WebGL 画布内容复制到 2D 画布（便于缩放导出与像素分析） */
export function copyCanvas(src, w = src.width, h = src.height) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.drawImage(src, 0, 0, w, h);
  return c;
}

// ═══════════════════════════════════════════════════════════════════
// 帧序列捕获
// ═══════════════════════════════════════════════════════════════════
/**
 * @param app      iframe 内的 window.__EUV__
 * @param opts     { width, height, fps, from, to, dir, prefix, onProgress, aspectCrop }
 */
export async function captureSequence(app, opts) {
  const {
    width = 3840, height = 2160, fps = 30,
    from = 0, to = null, dir = 'frames/master', prefix = 'EUV_master',
    onProgress = () => {}, stopFlag = { stop: false },
    digits = 6,
  } = opts;

  const total = app.TIMELINE.frames;
  const last = to === null ? total - 1 : to;

  app.P.captureMode = true;
  app.pause();
  app.setRenderSize(width, height);

  const stats = [];
  let prevSmall = null;
  const t0 = performance.now();

  for (let f = from; f <= last; f++) {
    if (stopFlag.stop) break;
    const time = f / fps;
    app.setTime(time);
    app.renderFrame();

    const png = await canvasToPng(app.canvas);
    const name = `${prefix}_${String(f).padStart(digits, '0')}.png`;
    const saved = await saveBinary(`${dir}/${name}`, png);

    // 逐帧质量统计（用于未渲染帧 / 闪烁检测）
    const small = copyCanvas(app.canvas, 160, Math.max(1, Math.round(160 * height / width)));
    const d = small.getContext('2d').getImageData(0, 0, small.width, small.height).data;
    let sum = 0, mx = 0;
    for (let i = 0; i < d.length; i += 4) {
      const L = (d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722) / 255;
      sum += L; if (L > mx) mx = L;
    }
    const n = d.length / 4;
    const mean = sum / n;
    let delta = 0;
    if (prevSmall) {
      const p = prevSmall;
      let acc = 0;
      for (let i = 0; i < d.length; i += 4) {
        acc += Math.abs(d[i] - p[i]) + Math.abs(d[i + 1] - p[i + 1]) + Math.abs(d[i + 2] - p[i + 2]);
      }
      delta = acc / (n * 3 * 255);
    }
    prevSmall = d;
    stats.push({ frame: f, bytes: saved.bytes, mean: +mean.toFixed(4), max: +mx.toFixed(3), delta: +delta.toFixed(4) });

    if (f % 5 === 0 || f === last) {
      const done = f - from + 1, all = last - from + 1;
      const el = (performance.now() - t0) / 1000;
      onProgress({
        frame: f, done, all, pct: done / all,
        fps: done / Math.max(0.001, el),
        etaSec: (all - done) / Math.max(0.001, done / el),
        mean, delta,
      });
    }
  }

  app.P.captureMode = false;
  app.restoreRenderSize();
  return stats;
}

// ═══════════════════════════════════════════════════════════════════
// 字幕导出（SRT / ASS，中文 / 英文 / 双语）
// ═══════════════════════════════════════════════════════════════════
const srtTime = (s) => {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000);
  const sec = Math.floor(ms % 60000 / 1000), r = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(r).padStart(3, '0')}`;
};
const assTime = (s) => {
  const cs = Math.round(s * 100);
  const h = Math.floor(cs / 360000), m = Math.floor(cs % 360000 / 6000);
  const sec = Math.floor(cs % 6000 / 100), r = cs % 100;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(r).padStart(2, '0')}`;
};

/** @param lang 'zh' | 'en' | 'bi' */
export function buildSrt(captions, lang) {
  const lines = [];
  captions.forEach((c, i) => {
    const body = lang === 'zh' ? c.zh : lang === 'en' ? c.en : `${c.zh}\n${c.en}`;
    lines.push(String(i + 1));
    lines.push(`${srtTime(c.start)} --> ${srtTime(c.end)}`);
    lines.push(body);
    lines.push('');
  });
  return lines.join('\n');
}

export function buildAss(captions, lang, { width = 3840, height = 2160 } = {}) {
  const fsMain = Math.round(height * 0.031);
  const fsSub = Math.round(height * 0.022);
  const head = `[Script Info]
; EUV 光刻原理 3D 演示动画 — 字幕（${lang === 'bi' ? '双语' : lang === 'zh' ? '中文' : 'English'}）
; 由 src/capture.js 从 src/script.js 的同一真源生成，不存在与画面不同步的可能
ScriptType: v4.00+
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: ${width}
PlayResY: ${height}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: ZH,Source Han Sans SC,${fsMain},&H00FAF2EA,&H00FFFFFF,&H00110B04,&H64000000,0,0,0,0,100,100,0,0,1,${Math.round(height * 0.0045)},0,2,${Math.round(width * 0.08)},${Math.round(width * 0.08)},${Math.round(height * 0.085)},1
Style: EN,Source Han Sans SC,${fsSub},&H00DAC9B6,&H00FFFFFF,&H00110B04,&H64000000,0,0,0,0,100,100,0,0,1,${Math.round(height * 0.0038)},0,2,${Math.round(width * 0.08)},${Math.round(width * 0.08)},${Math.round(height * 0.052)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const ev = [];
  for (const c of captions) {
    const a = assTime(c.start), b = assTime(c.end);
    if (lang !== 'en') ev.push(`Dialogue: 0,${a},${b},ZH,,0,0,0,,${c.zh}`);
    if (lang !== 'zh') ev.push(`Dialogue: 0,${a},${b},EN,,0,0,0,,${c.en}`);
  }
  return head + ev.join('\n') + '\n';
}

// ═══════════════════════════════════════════════════════════════════
// 静态资产（关键帧 / 封面 / 缩略图）
// ═══════════════════════════════════════════════════════════════════
/**
 * 每个工艺步骤取一张代表帧 + 片头/片尾定版，作为关键帧与封面图交付。
 */
export async function captureStills(app, {
  onProgress = () => {}, width = 3840, height = 2160, thumbW = 640, thumbH = 360,
  stopFlag = { stop: false }, tag = '',
} = {}) {
  const out = [];
  const shots = app.TIMELINE.shots;
  const picks = [];
  for (const s of shots) picks.push({ id: s.id, step: s.step, time: s.start + s.dur * 0.62, name: s.name });
  const sub = tag ? `${tag}/` : '';

  app.P.captureMode = true;
  app.pause();
  app.setRenderSize(width, height);
  const t0 = performance.now();
  for (const p of picks) {
    if (stopFlag.stop) break;
    app.setTime(p.time);
    app.renderFrame();
    const png = await canvasToPng(app.canvas);
    const file = `stills/${sub}EUV_still_${p.id}${p.step ? '_' + p.step : ''}_${width}x${height}.png`;
    const saved = await saveBinary(file, png);
    const th = copyCanvas(app.canvas, thumbW, thumbH);
    await saveBinary(`stills/${sub}thumbs/EUV_thumb_${p.id}.jpg`, await canvasToJpeg(th, 0.9));
    out.push({ ...p, file, bytes: saved.bytes });
    onProgress({
      id: p.id, done: out.length, all: picks.length,
      secPerFrame: (performance.now() - t0) / 1000 / out.length,
    });
  }

  // 封面图：横版 16:9 与竖版 9:16（竖版走独立取景，非裁切）
  if (!stopFlag.stop) {
    const coverTime = shots.find((s) => s.id === 'S06').start + 3.2;
    app.setRenderSize(width, height);
    app.setTime(coverTime); app.renderFrame();
    await saveBinary(`stills/${sub}EUV_cover_16x9_${width}x${height}.png`, await canvasToPng(app.canvas));
    const vw = Math.round(height * 9 / 16), vh = height;
    app.setRenderSize(vw, vh);
    app.setTime(coverTime); app.renderFrame();
    await saveBinary(`stills/${sub}EUV_cover_9x16_${vw}x${vh}.png`, await canvasToPng(app.canvas));
  }

  app.P.captureMode = false;
  app.restoreRenderSize();
  return out;
}

// ═══════════════════════════════════════════════════════════════════
// 逐帧质量报告（对应验收清单「无未渲染帧 / 无闪烁」）
// ═══════════════════════════════════════════════════════════════════
export function analyseFrameStats(stats, { fps = 30 } = {}) {
  const issues = [];
  if (!stats.length) return { ok: false, issues: ['无帧数据'], summary: {} };

  // ① 帧号连续
  for (let i = 1; i < stats.length; i++) {
    if (stats[i].frame !== stats[i - 1].frame + 1) {
      issues.push(`帧号不连续：${stats[i - 1].frame} → ${stats[i].frame}`);
    }
  }
  // ② 未渲染帧：全黑或文件异常小
  const bytes = stats.map((s) => s.bytes).sort((a, b) => a - b);
  const medBytes = bytes[Math.floor(bytes.length / 2)];
  for (const s of stats) {
    if (s.mean < 0.004 && s.max < 0.05) issues.push(`帧 ${s.frame} 近乎全黑（mean=${s.mean}）`);
    if (s.bytes < medBytes * 0.12) issues.push(`帧 ${s.frame} 文件异常小（${s.bytes} B，中位数 ${medBytes} B）`);
  }
  // ③ 闪烁：相邻帧差分离群（排除设计上的白闪/转场）
  const deltas = stats.slice(1).map((s) => s.delta);
  const sorted = deltas.slice().sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)] || 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  const spikeLimit = Math.max(0.12, med * 9 + 0.02);
  let spikes = 0;
  for (let i = 1; i < stats.length; i++) {
    if (stats[i].delta > spikeLimit) {
      spikes++;
      if (spikes <= 12) issues.push(`帧 ${stats[i].frame} 帧间差分突变 ${stats[i].delta}（阈值 ${spikeLimit.toFixed(3)}）`);
    }
  }
  const summary = {
    frames: stats.length,
    meanLum: +(stats.reduce((a, s) => a + s.mean, 0) / stats.length).toFixed(4),
    minLum: +Math.min(...stats.map((s) => s.mean)).toFixed(4),
    maxLum: +Math.max(...stats.map((s) => s.mean)).toFixed(4),
    medBytes,
    deltaMedian: +med.toFixed(4),
    deltaP95: +p95.toFixed(4),
    spikeCount: spikes,
    spikeLimit: +spikeLimit.toFixed(4),
  };
  return { ok: issues.length === 0, issues, summary };
}
