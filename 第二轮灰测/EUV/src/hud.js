/**
 * hud.js — HUD 标注、字幕与图版（叠加层）
 * ==================================================================
 * 实现要点：HUD 与字幕不是 DOM，而是绘制在一张与渲染分辨率等大的 2D 画布上，
 * 再作为正交投影全屏四边形合成到画面之上。因此：
 *   · 4K 逐帧捕获时 HUD 与字幕一起精确入帧（DOM 覆盖层做不到）
 *   · 文字在任意分辨率下都是矢量级清晰
 *   · 竖版 9:16 可独立排版
 *
 * 规格书 §1.2 强制项：
 *   · 常驻「示意 / Simulation」角标
 *   · 不可见光 / 夸张尺度的固定免责文案
 *   · 参数标注全部取自 params.js（PV），不在此处硬编码任何数值
 */

import * as THREE from 'three';
import { BRAND, FILM } from './config.js';
import { PARAMS, PV, PROCESS_STEPS, STEP_COUNT, SIM_TAG, needsSimTag } from './params.js';
import { EXAGGERATION } from './fx.js';
import { incidenceReport, MASK, MASK_INCIDENCE_DEG, CHAIN_BY_KEY, POB, WAFER, mm } from './layout.js';
import { TIMELINE, stepSpans, captionAt } from './script.js';

const C = BRAND.colors;
const SPANS = stepSpans();

export function createHUD(width, height, lang = 'bi') {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false }),
  );
  scene.add(quad);

  const state = { width, height, lang, S: 1 };

  function resize(w, h) {
    canvas.width = w; canvas.height = h;
    state.width = w; state.height = h;
    texture.dispose?.();
  }

  // ─── 绘图基元 ─────────────────────────────────────────────────
  const S = () => state.height / 1080;              // 统一缩放：以 1080 高为基准
  const isVertical = () => state.width < state.height;

  const font = (size, weight = 400, mono = false) =>
    `${weight} ${Math.round(size * S())}px ${mono ? BRAND.fontStackMono : BRAND.fontStack}`;

  function alpha(a) { ctx.globalAlpha = Math.max(0, Math.min(1, a)); }

  function text(str, x, y, { size = 22, weight = 400, color = C.paper, align = 'left', mono = false, a = 1, shadow = 0, maxWidth } = {}) {
    if (!str) return 0;
    ctx.save();
    alpha(a);
    ctx.font = font(size, weight, mono);
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    if (shadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = shadow * S();
      ctx.shadowOffsetY = 1 * S();
    }
    ctx.fillStyle = color;
    if (maxWidth) ctx.fillText(str, x, y, maxWidth);
    else ctx.fillText(str, x, y);
    const w = ctx.measureText(str).width;
    ctx.restore();
    return w;
  }

  function measure(str, size, weight = 400, mono = false) {
    ctx.font = font(size, weight, mono);
    return ctx.measureText(str).width;
  }

  function line(x1, y1, x2, y2, { color = C.primary, w = 1, a = 1, dash } = {}) {
    ctx.save(); alpha(a);
    ctx.strokeStyle = color; ctx.lineWidth = w * S();
    if (dash) ctx.setLineDash(dash.map((d) => d * S()));
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.restore();
  }

  function rect(x, y, w, h, { fill, stroke, lw = 1, a = 1, radius = 0 } = {}) {
    ctx.save(); alpha(a);
    ctx.beginPath();
    if (radius > 0) ctx.roundRect(x, y, w, h, radius * S());
    else ctx.rect(x, y, w, h);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw * S(); ctx.stroke(); }
    ctx.restore();
  }

  function circle(x, y, r, { fill, stroke, lw = 1, a = 1 } = {}) {
    ctx.save(); alpha(a);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw * S(); ctx.stroke(); }
    ctx.restore();
  }

  /** 3D 世界坐标 → 屏幕像素 */
  const _p = new THREE.Vector3();
  function project(worldPos, camera) {
    _p.set(worldPos.x, worldPos.y, worldPos.z).project(camera);
    return {
      x: (_p.x * 0.5 + 0.5) * state.width,
      y: (-_p.y * 0.5 + 0.5) * state.height,
      visible: _p.z < 1 && _p.z > -1,
      depth: _p.z,
    };
  }

  // ─── 组件绘制 ─────────────────────────────────────────────────

  /** 常驻「示意 / Simulation」角标（§1.2 强制） */
  function drawSimBadge(a = 1, note = '') {
    const s = S();
    const padX = 18 * s, padY = 11 * s;
    const label = SIM_TAG.both;
    const w = measure(label, 19, 700) + padX * 2;
    const h = 40 * s;
    const x = state.width - w - 42 * s, y = 34 * s;
    rect(x, y, w, h, { fill: 'rgba(10,14,20,0.62)', stroke: C.accent, lw: 1.2, a: a * 0.95, radius: 3 });
    text(label, x + padX, y + h - padY - 2 * s, { size: 19, weight: 700, color: C.accent, a });
    if (note) {
      const nw = measure(note, 15, 400);
      text(note, state.width - 42 * s, y + h + 26 * s, { size: 15, color: '#9FB4C8', align: 'right', a: a * 0.9, shadow: 4 });
    }
  }

  /** 品牌字标（无 Logo 文件时的矢量回退，不会出现空占位） */
  function drawBrand(a = 1) {
    const s = S(), x = 42 * s, y = 46 * s;
    // 标识块
    rect(x, y - 20 * s, 5 * s, 26 * s, { fill: C.primary, a });
    text(BRAND.nameEn, x + 15 * s, y, { size: 21, weight: 700, color: C.paper, a, shadow: 5 });
    text(BRAND.nameZh, x + 15 * s + measure(BRAND.nameEn, 21, 700) + 12 * s, y, { size: 17, weight: 400, color: '#8FA6BC', a: a * 0.9 });
  }

  /** 章节条：10 个工艺步骤刻度 + 当前进度 */
  function drawChapterBar(time, a = 1) {
    if (a <= 0.01) return;
    const s = S();
    const y = state.height - 30 * s;
    const x0 = 42 * s, x1 = state.width - 42 * s;
    const W = x1 - x0;
    line(x0, y, x1, y, { color: C.grid, w: 2, a: a * 0.75 });
    const p = Math.max(0, Math.min(1, time / TIMELINE.duration));
    line(x0, y, x0 + W * p, y, { color: C.primary, w: 2.4, a });
    for (const sp of SPANS) {
      const px = x0 + W * (sp.start / TIMELINE.duration);
      const done = time >= sp.start;
      const step = PROCESS_STEPS.find((k) => k.key === sp.step);
      line(px, y - 7 * s, px, y + 7 * s, { color: done ? C.accent : C.grid, w: 1.6, a: a * (done ? 1 : 0.6) });
      text(String(step.order).padStart(2, '0'), px, y - 13 * s,
        { size: 13, weight: 700, mono: true, color: done ? C.accent : '#54677A', align: 'center', a: a * 0.95 });
    }
    circle(x0 + W * p, y, 4.2 * s, { fill: C.accent, a });
  }

  /** 步骤指示（左下） */
  function drawStepIndicator(shot, a = 1) {
    if (!shot.step || a <= 0.01) return;
    const step = PROCESS_STEPS.find((k) => k.key === shot.step);
    if (!step) return;
    const s = S();
    const x = 42 * s;
    const y = state.height - (isVertical() ? 300 : 92) * s;
    const idx = `${String(step.order).padStart(2, '0')} / ${STEP_COUNT}`;
    text('STEP', x, y - 30 * s, { size: 14, weight: 700, color: '#6B8299', a, mono: true });
    text(idx, x + measure('STEP', 14, 700, true) + 10 * s, y - 30 * s,
      { size: 14, weight: 700, color: C.accent, a, mono: true });
    if (state.lang !== 'en') text(step.zh, x, y, { size: 30, weight: 700, color: C.paper, a, shadow: 7 });
    if (state.lang !== 'zh') {
      const yy = state.lang === 'en' ? y : y + 26 * s;
      text(step.en, x, yy, { size: state.lang === 'en' ? 26 : 18, weight: 400, color: '#9FB4C8', a: a * 0.92, shadow: 5 });
    }
    line(x, y - 22 * s, x + 3 * s, y - 22 * s, { color: C.primary, w: 3, a });
  }

  /** 参数标注卡（右侧堆叠，逐条淡入；示意值自动加标注） */
  function drawParams(shot, local, a = 1) {
    const list = shot.hud?.params || shot.hud?.stats;
    if (!list || a <= 0.01) return;
    const s = S();
    const right = state.width - 42 * s;
    let y = (isVertical() ? 260 : 190) * s;
    for (const [id, appearAt] of list) {
      const p = PARAMS[id];
      if (!p) continue;
      const fadeIn = Math.max(0, Math.min(1, (local - appearAt) / 0.06));
      if (fadeIn <= 0.001) continue;
      const aa = a * fadeIn;
      const slide = (1 - fadeIn) * 22 * s;
      const val = typeof p.value === 'number'
        ? (Number.isInteger(p.value) && Math.abs(p.value) >= 10000 ? p.value.toLocaleString('en-US') : String(p.value))
        : String(p.value);
      const nameZh = p.zh, nameEn = p.en;
      const unit = p.unit || '';
      const sim = needsSimTag(id);

      const vw = measure(val, 32, 700, true);
      const uw = unit ? measure(' ' + unit, 17, 400, true) : 0;
      const nw = Math.max(measure(nameZh, 16, 400), measure(nameEn, 13, 400));
      const boxW = Math.max(vw + uw, nw) + 34 * s + (sim ? 62 * s : 0);
      const boxH = 68 * s;
      const x = right - boxW + slide;

      rect(x, y, boxW, boxH, { fill: 'rgba(8,12,18,0.50)', a: aa * 0.9, radius: 2 });
      line(x, y, x, y + boxH, { color: sim ? C.warn : C.primary, w: 2.6, a: aa });
      text(val, x + 14 * s, y + 36 * s, { size: 32, weight: 700, color: C.paper, mono: true, a: aa, shadow: 5 });
      if (unit) text(' ' + unit, x + 14 * s + vw, y + 36 * s, { size: 17, color: C.accent, mono: true, a: aa * 0.95 });
      if (state.lang !== 'en') text(nameZh, x + 14 * s, y + 58 * s, { size: 16, color: '#9FB4C8', a: aa * 0.92 });
      if (state.lang === 'en') text(nameEn, x + 14 * s, y + 58 * s, { size: 15, color: '#9FB4C8', a: aa * 0.92 });
      else if (state.lang === 'bi') text(nameEn, x + 14 * s + measure(nameZh, 16) + 10 * s, y + 58 * s,
        { size: 12, color: '#6B8299', a: aa * 0.85 });
      if (sim) {
        const bx = x + boxW - 58 * s;
        rect(bx, y + 10 * s, 48 * s, 20 * s, { stroke: C.warn, lw: 1, a: aa * 0.9, radius: 2 });
        text(SIM_TAG.zh, bx + 8 * s, y + 25 * s, { size: 13, weight: 700, color: C.warn, a: aa });
      }
      y += boxH + 10 * s;
    }
  }

  /** 3D 锚定标签（引线 + 文字） */
  function drawAnchors(anchors, camera, a = 1) {
    if (!anchors || !anchors.length || a <= 0.01) return;
    const s = S();
    for (const an of anchors) {
      const p = project(an.pos, camera);
      if (!p.visible) continue;
      if (p.x < -200 || p.x > state.width + 200 || p.y < -200 || p.y > state.height + 200) continue;
      const aa = a * (an.a ?? 1);
      if (aa <= 0.01) continue;
      const dx = (an.dx ?? 90) * s, dy = (an.dy ?? -62) * s;
      const ex = p.x + dx, ey = p.y + dy;
      circle(p.x, p.y, 3.4 * s, { stroke: C.accent, lw: 1.4, a: aa });
      circle(p.x, p.y, 1.2 * s, { fill: C.accent, a: aa });
      line(p.x, p.y, ex - Math.sign(dx) * 6 * s, ey, { color: C.accent, w: 1, a: aa * 0.8 });
      const tw = Math.max(measure(an.zh || '', 18, 700), measure(an.en || '', 14, 400));
      const tx = dx > 0 ? ex : ex - tw;
      line(tx, ey, tx + tw, ey, { color: C.accent, w: 1, a: aa * 0.7 });
      if (state.lang !== 'en' && an.zh) text(an.zh, tx, ey - 8 * s, { size: 18, weight: 700, color: C.paper, a: aa, shadow: 6 });
      if (state.lang !== 'zh' && an.en) {
        const yy = state.lang === 'en' ? ey - 8 * s : ey + 17 * s;
        text(an.en, tx, yy, { size: state.lang === 'en' ? 17 : 14, color: '#A8BDD0', a: aa * 0.9, shadow: 5 });
      }
    }
  }

  /** 字幕（中英双语，带描边与安全区） */
  function drawCaption(capt, shot, local, a = 1) {
    if (!capt || a <= 0.01) return;
    const s = S();
    // 进出场淡入淡出（0.22 s 等效）
    const dur = (capt.t1 - capt.t0) * shot.dur;
    const tin = Math.min(0.35, dur * 0.22), tout = Math.min(0.35, dur * 0.22);
    const tl = (local - capt.t0) * shot.dur;
    const fade = Math.min(1, tl / tin) * Math.min(1, (dur - tl) / tout);
    const aa = a * Math.max(0, Math.min(1, fade));
    if (aa <= 0.01) return;

    const bottom = state.height - (isVertical() ? 420 : 118) * s;
    const cx = state.width / 2;
    const maxW = state.width * (isVertical() ? 0.88 : 0.74);

    const drawLine = (str, y, size, weight, color, op) => {
      // 自动断行
      const words = /[\u4e00-\u9fff]/.test(str) ? str.split('') : str.split(' ');
      const lines = []; let cur = '';
      for (const w of words) {
        const test = cur + (cur && !/[\u4e00-\u9fff]/.test(str) ? ' ' : '') + w;
        if (measure(test, size, weight) > maxW && cur) { lines.push(cur); cur = w; }
        else cur = test;
      }
      if (cur) lines.push(cur);
      let yy = y - (lines.length - 1) * size * 1.34 * S();
      for (const ln of lines) {
        ctx.save();
        alpha(op);
        ctx.font = font(size, weight);
        ctx.textAlign = 'center';
        ctx.lineWidth = 4.6 * S();
        ctx.strokeStyle = 'rgba(4,7,11,0.92)';
        ctx.lineJoin = 'round';
        ctx.strokeText(ln, cx, yy);
        ctx.fillStyle = color;
        ctx.fillText(ln, cx, yy);
        ctx.restore();
        yy += size * 1.34 * S();
      }
      return lines.length;
    };

    if (state.lang === 'zh') drawLine(capt.zh, bottom, 34, 500, C.paper, aa);
    else if (state.lang === 'en') drawLine(capt.en, bottom, 30, 400, C.paper, aa);
    else {
      const nEn = drawLine(capt.en, bottom, 23, 400, '#B6C9DA', aa * 0.94);
      drawLine(capt.zh, bottom - (23 * 1.34 * nEn + 12) * s, 33, 500, C.paper, aa);
    }
  }

  /** 片头标题卡 */
  function drawTitle(local, a = 1) {
    const s = S();
    const cx = state.width / 2, cy = state.height * (isVertical() ? 0.42 : 0.46);
    const t1 = Math.max(0, Math.min(1, (local - 0.16) / 0.18));
    const t2 = Math.max(0, Math.min(1, (local - 0.30) / 0.18));
    const t3 = Math.max(0, Math.min(1, (local - 0.44) / 0.16));
    const out = Math.max(0, Math.min(1, (local - 0.84) / 0.14));
    const aa = a * (1 - out);
    if (aa <= 0.01) return;

    // 品牌标识块
    if (t1 > 0) {
      const bw = 68 * s;
      rect(cx - bw / 2, cy - 118 * s, bw, 3.4 * s, { fill: C.primary, a: aa * t1 });
    }
    if (t2 > 0) {
      ctx.save(); alpha(aa * t2);
      ctx.font = font(isVertical() ? 62 : 76, 700);
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 22 * s;
      ctx.fillStyle = C.paper;
      ctx.fillText(BRAND.titleZh, cx, cy - 34 * s);
      ctx.restore();
      // 字距展开的英文标题
      const en = BRAND.titleEn.toUpperCase();
      ctx.save(); alpha(aa * t2 * 0.92);
      ctx.font = font(isVertical() ? 20 : 24, 400);
      ctx.textAlign = 'center';
      const spacing = 5.5 * s * (0.4 + 0.6 * t2);
      const chars = en.split('');
      const total = chars.reduce((w, ch) => w + ctx.measureText(ch).width + spacing, -spacing);
      let x = cx - total / 2;
      ctx.fillStyle = C.accent;
      for (const ch of chars) { ctx.textAlign = 'left'; ctx.fillText(ch, x, cy + 8 * s); x += ctx.measureText(ch).width + spacing; }
      ctx.restore();
    }
    if (t3 > 0) {
      line(cx - 150 * s, cy + 36 * s, cx + 150 * s, cy + 36 * s, { color: C.grid, w: 1, a: aa * t3 });
      text(BRAND.subtitleZh, cx, cy + 70 * s, { size: 20, color: '#9FB4C8', align: 'center', a: aa * t3, shadow: 6 });
      text(BRAND.subtitleEn, cx, cy + 98 * s, { size: 15, color: '#6B8299', align: 'center', a: aa * t3 * 0.9 });
    }
  }

  /** 片尾定版 */
  function drawEndCard(local, a = 1) {
    const s = S();
    const cx = state.width / 2, cy = state.height * 0.46;
    const t1 = Math.max(0, Math.min(1, local / 0.2));
    const aa = a * t1;
    rect(cx - 34 * s, cy - 96 * s, 68 * s, 3.4 * s, { fill: C.primary, a: aa });
    text(BRAND.nameZh, cx, cy - 40 * s, { size: 44, weight: 700, color: C.paper, align: 'center', a: aa, shadow: 14 });
    text(BRAND.nameEn, cx, cy - 4 * s, { size: 18, color: C.accent, align: 'center', a: aa * 0.9 });
    line(cx - 170 * s, cy + 26 * s, cx + 170 * s, cy + 26 * s, { color: C.grid, w: 1, a: aa * 0.8 });
    text(BRAND.taglineZh, cx, cy + 62 * s, { size: 22, color: '#B6C9DA', align: 'center', a: aa, shadow: 6 });
    text(BRAND.taglineEn, cx, cy + 90 * s, { size: 15, color: '#6B8299', align: 'center', a: aa * 0.9 });
    // 免责声明（全片示意性表述的统一落款）
    const disc = `${SIM_TAG.both} · ${SIM_TAG.scaleZh} · ${SIM_TAG.invisibleZh}`;
    text(disc, cx, state.height - 60 * s, { size: 13, color: '#54677A', align: 'center', a: aa * 0.85 });
  }

  /** 掩模 6° 入射角图版 */
  function drawMaskAngle(camera, amt, a = 1) {
    if (amt <= 0.01) return;
    const s = S(); const aa = a * amt;
    const p = project(MASK.pos, camera);
    if (!p.visible) return;
    const R = 78 * s;
    // 法线与入射/反射方向投影
    const nEnd = project({ x: MASK.pos.x + MASK.normal.x * 6, y: MASK.pos.y + MASK.normal.y * 6, z: 0 }, camera);
    const iEnd = project({ x: MASK.pos.x - MASK.incidentDir.x * 6, y: MASK.pos.y - MASK.incidentDir.y * 6, z: 0 }, camera);
    const rEnd = project({ x: MASK.pos.x + MASK.reflectedDir.x * 6, y: MASK.pos.y + MASK.reflectedDir.y * 6, z: 0 }, camera);
    line(p.x, p.y, nEnd.x, nEnd.y, { color: '#7A8FA6', w: 1.2, a: aa * 0.9, dash: [6, 5] });
    line(p.x, p.y, iEnd.x, iEnd.y, { color: C.accent, w: 1.6, a: aa });
    line(p.x, p.y, rEnd.x, rEnd.y, { color: C.primary, w: 1.6, a: aa });
    // 角度弧
    const a1 = Math.atan2(nEnd.y - p.y, nEnd.x - p.x);
    const a2 = Math.atan2(iEnd.y - p.y, iEnd.x - p.x);
    ctx.save(); alpha(aa * 0.95);
    ctx.strokeStyle = C.accent; ctx.lineWidth = 1.5 * S();
    ctx.beginPath(); ctx.arc(p.x, p.y, R * 0.42, Math.min(a1, a2), Math.max(a1, a2)); ctx.stroke();
    ctx.restore();
    const mid = (a1 + a2) / 2;
    text(`${MASK_INCIDENCE_DEG.toFixed(1)}°`, p.x + Math.cos(mid) * R * 0.62, p.y + Math.sin(mid) * R * 0.62,
      { size: 24, weight: 700, mono: true, color: C.accent, align: 'center', a: aa, shadow: 6 });
    text(state.lang === 'en' ? 'off-axis incidence' : '离轴入射角', p.x + Math.cos(mid) * R * 0.62, p.y + Math.sin(mid) * R * 0.62 + 22 * s,
      { size: 13, color: '#9FB4C8', align: 'center', a: aa * 0.9, shadow: 4 });
    text(state.lang === 'en' ? 'normal' : '法线', nEnd.x, nEnd.y - 8 * s, { size: 13, color: '#7A8FA6', align: 'center', a: aa * 0.85 });
  }

  /** 4:1 缩比图版：掩模场 vs 晶圆场 */
  function drawDemag(amt, a = 1) {
    if (amt <= 0.01) return;
    const s = S(); const aa = a * amt;
    const x = 42 * s, y = (isVertical() ? 150 : 210) * s;
    const boxW = 250 * s;
    rect(x, y, boxW, 176 * s, { fill: 'rgba(8,12,18,0.52)', a: aa * 0.92, radius: 2 });
    line(x, y, x, y + 176 * s, { color: C.primary, w: 2.6, a: aa });
    text(state.lang === 'en' ? 'REDUCTION' : '投影缩比', x + 14 * s, y + 26 * s, { size: 14, weight: 700, mono: true, color: '#6B8299', a: aa });
    text(PARAMS.demagnification.value, x + 14 * s, y + 62 * s, { size: 40, weight: 700, mono: true, color: C.accent, a: aa, shadow: 6 });
    // 场尺寸对照方框
    const bx = x + 20 * s, by = y + 84 * s;
    const k = 62 * s / 132;
    rect(bx, by, 104 * k, 132 * k, { stroke: C.accent, lw: 1.4, a: aa * 0.95 });
    text(PARAMS.exposureFieldMask.value + ' mm', bx + 104 * k + 8 * s, by + 16 * s, { size: 13, mono: true, color: '#9FB4C8', a: aa * 0.9 });
    text(state.lang === 'en' ? 'on mask' : '掩模场', bx + 104 * k + 8 * s, by + 32 * s, { size: 12, color: '#6B8299', a: aa * 0.85 });
    rect(bx + 104 * k + 90 * s, by + 132 * k - 33 * k, 26 * k, 33 * k, { stroke: C.primary, lw: 1.4, fill: 'rgba(63,169,245,0.18)', a: aa * 0.95 });
    text(PARAMS.exposureFieldWafer.value + ' mm', bx + 20 * s, by + 132 * k + 20 * s, { size: 13, mono: true, color: '#9FB4C8', a: aa * 0.9 });
    text(state.lang === 'en' ? 'on wafer' : '晶圆场', bx + 20 * s + 92 * s, by + 132 * k + 20 * s, { size: 12, color: '#6B8299', a: aa * 0.85 });
  }

  /** 入射角表：证明全部为近法向入射（折返式光路的物理依据） */
  function drawIncidence(amt, a = 1) {
    if (amt <= 0.01) return;
    const s = S(); const aa = a * amt;
    const rep = incidenceReport();
    const x = 42 * s, y = (isVertical() ? 150 : 200) * s;
    const rowH = 25 * s;
    const boxW = 320 * s, boxH = 56 * s + rep.length * rowH;
    rect(x, y, boxW, boxH, { fill: 'rgba(8,12,18,0.55)', a: aa * 0.92, radius: 2 });
    line(x, y, x, y + boxH, { color: C.primary, w: 2.6, a: aa });
    text(state.lang === 'en' ? 'ANGLE OF INCIDENCE θ' : '各镜面入射角 θ', x + 14 * s, y + 26 * s,
      { size: 14, weight: 700, mono: true, color: '#6B8299', a: aa });
    text(state.lang === 'en' ? 'multilayers reflect only near normal' : '多层膜仅在近法向入射有效 → 光路必须折返',
      x + 14 * s, y + 44 * s, { size: 12, color: C.warn, a: aa * 0.95 });
    let yy = y + 70 * s;
    for (const m of rep) {
      const label = state.lang === 'en' ? m.en : m.zh;
      text(label, x + 14 * s, yy, { size: 14, color: '#A8BDD0', a: aa * 0.92 });
      text(`${m.incidenceDeg.toFixed(1)}°`, x + boxW - 14 * s, yy,
        { size: 15, weight: 700, mono: true, color: m.incidenceDeg <= 24 ? C.accent : C.warn, align: 'right', a: aa });
      yy += rowH;
    }
  }

  /** 光路总览：11 次反射清单 */
  function drawPathSummary(amt, a = 1) {
    if (amt <= 0.01) return;
    const s = S(); const aa = a * amt;
    const items = [
      ['等离子体', 'Plasma'], ['集光镜', 'Collector'], ['中间焦点', 'Intermediate Focus'],
      ['场面镜', 'Field Facet'], ['光瞳面镜', 'Pupil Facet'], ['照明末镜', 'Relay'],
      ['反射式掩模', 'Reflective Mask'],
      ...POB.map((m) => [`投影 ${m.label}`, `Projection ${m.label}`]),
      ['晶圆', 'Wafer'],
    ];
    const x = 42 * s, y = (isVertical() ? 160 : 176) * s;
    const rowH = 23 * s;
    const boxW = 260 * s, boxH = 44 * s + items.length * rowH;
    rect(x, y, boxW, boxH, { fill: 'rgba(8,12,18,0.52)', a: aa * 0.9, radius: 2 });
    line(x, y, x, y + boxH, { color: C.primary, w: 2.6, a: aa });
    text(state.lang === 'en' ? 'LIGHT PATH' : '完整光路', x + 14 * s, y + 26 * s,
      { size: 14, weight: 700, mono: true, color: '#6B8299', a: aa });
    let yy = y + 52 * s;
    items.forEach((it, i) => {
      const fadeIn = Math.max(0, Math.min(1, (amt - i / items.length * 0.55) * 5));
      circle(x + 20 * s, yy - 5 * s, 2.6 * s, { fill: C.accent, a: aa * fadeIn });
      if (i < items.length - 1) line(x + 20 * s, yy - 2 * s, x + 20 * s, yy + rowH - 8 * s, { color: C.grid, w: 1, a: aa * fadeIn * 0.8 });
      text(state.lang === 'en' ? it[1] : it[0], x + 34 * s, yy, { size: 14, color: '#A8BDD0', a: aa * fadeIn * 0.95 });
      yy += rowH;
    });
  }

  /** 十步回顾（收束镜头） */
  function drawStepsRecap(amt, a = 1) {
    if (amt <= 0.01) return;
    const s = S(); const aa = a * amt;
    const right = state.width - 42 * s;
    let y = (isVertical() ? 200 : 168) * s;
    const rowH = 30 * s;
    text(state.lang === 'en' ? 'TEN PROCESS STEPS' : '十个工艺步骤', right, y, { size: 14, weight: 700, mono: true, color: '#6B8299', align: 'right', a: aa });
    y += 26 * s;
    for (const st of PROCESS_STEPS) {
      const fadeIn = Math.max(0, Math.min(1, (amt - (st.order - 1) / 10 * 0.6) * 4));
      const label = state.lang === 'en' ? st.en : st.zh;
      text(String(st.order).padStart(2, '0'), right - measure(label, 17, 500) - 14 * s, y,
        { size: 14, weight: 700, mono: true, color: C.accent, align: 'right', a: aa * fadeIn });
      text(label, right, y, { size: 17, weight: 500, color: '#C4D6E6', align: 'right', a: aa * fadeIn, shadow: 4 });
      y += rowH;
    }
  }

  /** 模块名（整机建立镜头） */
  function drawModules(camera, a = 1) {
    const anchors = [
      { pos: { x: -46, y: 6, z: 0 }, zh: '驱动激光模块', en: 'Drive Laser', dx: -110, dy: -70 },
      { pos: { x: -26, y: 10, z: 0 }, zh: '光源腔（超高真空）', en: 'Source Vessel (UHV)', dx: 90, dy: -96 },
      { pos: { x: 8, y: 24, z: 0 }, zh: '扫描机（照明 + 投影）', en: 'Scanner (Illuminator + POB)', dx: 110, dy: -60 },
    ];
    drawAnchors(anchors.map((x) => ({ ...x, a })), camera, a);
  }

  /** 中间焦点标注 */
  function drawIFCallout(camera, amt, a = 1) {
    if (amt <= 0.01) return;
    drawAnchors([{
      pos: CHAIN_BY_KEY.IF.pos, zh: `中间焦点 IF · ${PV('euvPowerAtIF')}`,
      en: `Intermediate Focus · ${PV('euvPowerAtIF')}`, dx: 96, dy: -78, a: amt,
    }], camera, a);
  }

  // ─── 主绘制入口 ───────────────────────────────────────────────
  /**
   * @param frameState {
   *   time, frame, shot, local, camera, fx, anchors, caption
   * }
   */
  function render(fs) {
    const { shot, local, camera, fx } = fs;
    ctx.clearRect(0, 0, state.width, state.height);
    const s = S();

    // 全局 HUD 淡入淡出：片头/片尾不显示技术 HUD
    const hudA = shot.hud?.title ? 0 : (shot.hud?.endCard ? 0 : 1);
    const chromeA = shot.hud?.title ? Math.max(0, 1 - local / 0.2) * 0.0 + 1 : 1;

    // 品牌字标（全片常驻，低调）
    drawBrand(shot.hud?.title ? Math.max(0, Math.min(1, (local - 0.06) / 0.14)) * 0.0 + (shot.hud?.title ? 0 : 0.72) : 0.72);

    // 「示意 / Simulation」常驻角标（技术段落强制）
    if (shot.step || shot.hud?.simNote) {
      const noteKey = shot.hud?.simNote;
      const note = noteKey && EXAGGERATION[noteKey]
        ? (state.lang === 'en' ? '' : EXAGGERATION[noteKey].factorZh)
        : '';
      drawSimBadge(1, note);
    } else if (!shot.hud?.title && !shot.hud?.endCard) {
      drawSimBadge(0.8, '');
    }

    // 不可见光横幅（EUV 辐射镜头强制）
    if (shot.hud?.simBanner) {
      const bh = 44 * s;
      const by = 118 * s;
      rect(0, by, state.width, bh, { fill: 'rgba(255,159,69,0.10)', a: 0.95 });
      line(0, by, state.width, by, { color: C.warn, w: 1, a: 0.7 });
      line(0, by + bh, state.width, by + bh, { color: C.warn, w: 1, a: 0.7 });
      const t = state.lang === 'en' ? SIM_TAG.invisibleEn : `${SIM_TAG.invisibleZh}  ·  ${SIM_TAG.invisibleEn}`;
      text(t, state.width / 2, by + bh * 0.66, { size: 17, weight: 500, color: '#FFCE9A', align: 'center', a: 1, shadow: 5 });
    }

    if (hudA > 0) {
      drawStepIndicator(shot, hudA);
      drawParams(shot, local, hudA);
      drawChapterBar(fs.time, hudA * 0.95);
      if (shot.hud?.modules) drawModules(camera, 0.95);
      if (shot.hud?.maskAngle) drawMaskAngle(camera, fx.angleCallout ?? 0, 1);
      if (shot.hud?.demag) drawDemag(fx.demagCallout ?? 0, 1);
      if (shot.hud?.incidence) drawIncidence(fx.incidenceCallout ?? 0, 1);
      if (shot.hud?.ifCallout) drawIFCallout(camera, 1, 1);
      if (shot.hud?.pathSummary) drawPathSummary(fx.pathOverview ?? 0, 1);
      if (shot.hud?.stepsRecap) drawStepsRecap(fx.pathOverview ?? 0, 1);
      if (fs.anchors) drawAnchors(fs.anchors, camera, hudA);
    }

    if (shot.hud?.title) drawTitle(local, 1);
    if (shot.hud?.endCard) drawEndCard(local, 1);

    // 字幕
    const capt = captionAt(shot, local);
    if (capt) drawCaption(capt, shot, local, 1);

    texture.needsUpdate = true;
  }

  function setLang(l) { state.lang = l; }

  return { canvas, ctx, texture, scene, camera: cam, render, resize, setLang, state, project };
}
