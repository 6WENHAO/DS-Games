/* ============================================================================
 * app.js —— 交互：轨道相机 / 视角预设与补间 / 剖切 / 标签 / 部件点选 / 昼夜
 * ==========================================================================*/
(function () {
  'use strict';
  const RVM = window.RVMODEL, R = window.RENDER;
  const $ = id => document.getElementById(id);
  const canvas = $('view');

  /* ---------------------------- 构建几何 ---------------------------- */
  let geo, rd;
  try {
    const t0 = performance.now();
    geo = RVM.build();
    rd = R.createRenderer(canvas, geo);
    console.log('build ms', (performance.now() - t0).toFixed(0));
  } catch (e) {
    document.body.innerHTML = '<div class="fatal">初始化失败：' + e.message + '</div>';
    return;
  }

  const S = {
    cutaway: false, autoRotate: true, labels: true, tween: null,
    hovered: null, selected: null, fps: 0, frames: 0, lastT: performance.now()
  };
  const HOT = geo.parts.filter(p => RVM.LABELS[p.name]);
  const partCenter = p => [(p.bbox[0] + p.bbox[3]) / 2, (p.bbox[1] + p.bbox[4]) / 2, (p.bbox[2] + p.bbox[5]) / 2];
  const partSize = p => [p.bbox[3] - p.bbox[0], p.bbox[4] - p.bbox[1], p.bbox[5] - p.bbox[2]];

  /* ---------------------------- 视角预设 ---------------------------- */
  const VIEWS = {
    outside: { name: '整车外观', cam: { yaw: 0.95, pitch: 0.24, dist: 15.0, tx: 0, ty: 1.5, tz: 0, fov: 0.72 }, cut: false },
    cutaway: { name: '剖切透视', cam: { yaw: 1.05, pitch: 0.38, dist: 12.0, tx: -0.2, ty: 1.6, tz: 0, fov: 0.72 }, cut: true },
    lab: { name: '实验台特写', cam: { yaw: 1.85, pitch: 0.16, dist: 2.6, tx: -0.35, ty: 1.86, tz: -0.35, fov: 0.85 }, cut: true },
    cab: { name: '驾驶室', cam: { yaw: 1.15, pitch: 0.10, dist: 3.1, tx: 2.85, ty: 1.62, tz: 0.15, fov: 0.9 }, cut: true },
    rear: { name: '车尾与桶区', cam: { yaw: 4.05, pitch: 0.22, dist: 4.6, tx: -2.9, ty: 1.5, tz: 0.1, fov: 0.8 }, cut: true },
    top: { name: '车顶俯视', cam: { yaw: 0.6, pitch: 1.16, dist: 12.5, tx: -0.3, ty: 1.6, tz: 0, fov: 0.72 }, cut: false },
    front: { name: '车头正面', cam: { yaw: 1.57, pitch: 0.12, dist: 9.0, tx: 1.2, ty: 1.5, tz: 0, fov: 0.7 }, cut: false },
    wheel: { name: '底盘与车轮', cam: { yaw: 0.75, pitch: -0.06, dist: 4.4, tx: 2.2, ty: 0.55, tz: 0.4, fov: 0.8 }, cut: false }
  };
  function applyCutaway(on) {
    S.cutaway = on;
    rd.setVisible('shellNear', !on);
    rd.setVisible('roof', !on);
    $('btnCut').classList.toggle('on', on);
    // 剖切时隐藏近侧玻璃会更通透：用分组细粒度控制
    renderGroupList();
  }
  function tweenTo(target, cut, ms) {
    if (cut !== undefined) applyCutaway(cut);
    const from = Object.assign({}, rd.cam);
    // 角度取最近路径
    let dy = target.yaw - from.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    S.tween = { from, to: Object.assign({}, target, { yaw: from.yaw + dy }), t0: performance.now(), dur: ms || 850 };
  }
  function focusPart(p, extra) {
    const c = partCenter(p), s = partSize(p);
    const d = Math.max(0.9, Math.hypot(s[0], s[1], s[2]) * (extra || 2.1));
    const inside = c[0] > -4.1 && c[0] < 4.1 && c[1] > 0.7 && c[1] < 2.7 && Math.abs(c[2]) < 1.3;
    // 车内部件从"被剖开的右侧"看进去，保证视线不被家具挡住
    tweenTo({ yaw: inside ? 0.18 : 0.95, pitch: inside ? 0.22 : 0.28, dist: d, tx: c[0], ty: c[1], tz: c[2], fov: 0.85 },
      inside ? true : S.cutaway);
    S.selected = p;
    renderInfo(p);
  }

  /* ---------------------------- 面板渲染 ---------------------------- */
  const GROUP_CN = {
    ground: '环境地面', chassis: '底盘与车轮', shellNear: '右侧车身（可剖切）', shellFar: '左侧车身',
    roof: '车顶设备（可剖切）', front: '车头', rear: '车尾', glass: '玻璃',
    interior: '车厢内壁与顶灯', lab: '实验台与厨房', cab: '驾驶室', props: '桶与杂物', default: '其它'
  };
  function renderGroupList() {
    const box = $('groups');
    box.innerHTML = rd.groups.map(g => {
      const tris = geo.groupRanges[g].count / 3;
      return `<label class="grp${rd.visible[g] ? ' on' : ''}"><input type="checkbox" data-g="${g}" ${rd.visible[g] ? 'checked' : ''}>
        <span class="gn">${GROUP_CN[g] || g}</span><span class="gt">${(tris / 1000).toFixed(1)}k</span></label>`;
    }).join('');
    box.querySelectorAll('input').forEach(inp => inp.addEventListener('change', () => {
      rd.setVisible(inp.dataset.g, inp.checked);
      inp.parentElement.classList.toggle('on', inp.checked);
    }));
  }
  function renderPartList() {
    const byGroup = {};
    geo.parts.forEach(p => { (byGroup[p.group] = byGroup[p.group] || []).push(p); });
    $('parts').innerHTML = Object.keys(byGroup).map(g => {
      const items = byGroup[g].sort((a, b) => b.tris - a.tris).map(p =>
        `<div class="pi${RVM.LABELS[p.name] ? ' hot' : ''}" data-p="${p.name}">
           <span class="pn">${RVM.LABELS[p.name] || p.name}</span><span class="pt">${p.tris}</span></div>`).join('');
      return `<div class="pg"><div class="pgh">${GROUP_CN[g] || g}<i>${byGroup[g].length} 件</i></div>${items}</div>`;
    }).join('');
    $('parts').querySelectorAll('.pi').forEach(el => el.addEventListener('click', () => {
      const p = geo.parts.find(x => x.name === el.dataset.p);
      if (p) focusPart(p);
    }));
  }
  function renderInfo(p) {
    if (!p) { $('info').classList.remove('show'); return; }
    const s = partSize(p), c = partCenter(p);
    $('info').classList.add('show');
    $('info').innerHTML = `<b>${RVM.LABELS[p.name] || p.name}</b>
      <div class="ir">分组：${GROUP_CN[p.group] || p.group}　三角形：${p.tris}</div>
      <div class="ir">尺寸：${s[0].toFixed(2)} × ${s[1].toFixed(2)} × ${s[2].toFixed(2)} m</div>
      <div class="ir">中心：(${c[0].toFixed(2)}, ${c[1].toFixed(2)}, ${c[2].toFixed(2)})</div>`;
  }

  /* ---------------------------- 标签层 ---------------------------- */
  const labelEls = new Map();
  (function buildLabels() {
    const layer = $('labels');
    HOT.forEach(p => {
      const d = document.createElement('div');
      d.className = 'lb';
      d.innerHTML = `<i></i><span>${RVM.LABELS[p.name]}</span>`;
      d.addEventListener('click', () => focusPart(p));
      layer.appendChild(d);
      labelEls.set(p.name, d);
    });
  })();
  function syncLabels() {
    const eye = rd.eyePos();
    HOT.forEach(p => {
      const el = labelEls.get(p.name);
      if (!S.labels || !rd.visible[p.group]) { el.style.display = 'none'; return; }
      const c = partCenter(p);
      const sp = rd.project([c[0], c[1] + partSize(p)[1] * 0.5 + 0.06, c[2]]);
      if (!sp || sp[2] < 0.2) { el.style.display = 'none'; return; }
      const dist = Math.hypot(eye[0] - c[0], eye[1] - c[1], eye[2] - c[2]);
      if (dist > 26) { el.style.display = 'none'; return; }
      el.style.display = '';
      el.style.transform = `translate(-50%,-100%) translate(${sp[0].toFixed(1)}px,${sp[1].toFixed(1)}px)`;
      el.style.opacity = String(Math.max(0.25, Math.min(1, 1.35 - dist / 22)));
      el.classList.toggle('sel', S.selected && S.selected.name === p.name);
    });
  }

  /* ---------------------------- 交互 ---------------------------- */
  let drag = null;
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, moved: 0, btn: e.button };
    S.autoRotate = false; $('btnRot').classList.remove('on');
  });
  window.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
    S.tween = null;
    if (drag.btn === 2 || e.shiftKey) {
      const s = rd.cam.dist * 0.0018;
      const cy = Math.cos(rd.cam.yaw), sy = Math.sin(rd.cam.yaw);
      rd.cam.tx -= (dx * cy - dy * sy * 0.4) * s;
      rd.cam.tz -= (-dx * sy - dy * cy * 0.4) * s;
      rd.cam.ty = Math.max(0.1, rd.cam.ty + dy * s * 0.7);
    } else {
      rd.cam.yaw -= dx * 0.006;
      rd.cam.pitch = Math.max(-0.35, Math.min(1.45, rd.cam.pitch + dy * 0.005));
    }
  });
  window.addEventListener('pointerup', e => {
    if (!drag) return;
    const click = drag.moved < 6 && drag.btn === 0;
    drag = null;
    if (!click) return;
    const r = canvas.getBoundingClientRect();
    const p = rd.pickPart(e.clientX - r.left, e.clientY - r.top);
    S.selected = p;
    renderInfo(p);
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => {
    e.preventDefault(); S.tween = null;
    rd.cam.dist = Math.max(1.0, Math.min(40, rd.cam.dist * (1 + Math.sign(e.deltaY) * 0.1)));
  }, { passive: false });
  let pinch = null;
  canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 2) pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  }, { passive: true });
  canvas.addEventListener('touchmove', e => {
    if (e.touches.length === 2 && pinch) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      rd.cam.dist = Math.max(1.0, Math.min(40, rd.cam.dist * (pinch / d)));
      pinch = d; e.preventDefault();
    }
  }, { passive: false });
  canvas.addEventListener('touchend', () => { pinch = null; }, { passive: true });

  /* ---------------------------- 控件 ---------------------------- */
  const viewBar = $('views');
  Object.keys(VIEWS).forEach(k => {
    const b = document.createElement('button');
    b.className = 'vb'; b.textContent = VIEWS[k].name; b.dataset.v = k;
    b.addEventListener('click', () => {
      viewBar.querySelectorAll('.vb').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      tweenTo(VIEWS[k].cam, VIEWS[k].cut);
    });
    viewBar.appendChild(b);
  });
  viewBar.querySelector('.vb').classList.add('on');
  $('btnCut').addEventListener('click', () => applyCutaway(!S.cutaway));
  $('btnRot').addEventListener('click', () => { S.autoRotate = !S.autoRotate; $('btnRot').classList.toggle('on', S.autoRotate); });
  $('btnLbl').addEventListener('click', () => { S.labels = !S.labels; $('btnLbl').classList.toggle('on', S.labels); });
  $('btnWire').addEventListener('click', () => { rd.opt.wire = rd.opt.wire ? 0 : 1; $('btnWire').classList.toggle('on', !!rd.opt.wire); });
  $('btnFlat').addEventListener('click', () => { rd.opt.flat = rd.opt.flat ? 0 : 1; $('btnFlat').classList.toggle('on', !!rd.opt.flat); });
  $('btnShadow').addEventListener('click', () => {
    if (!rd.shadowOK) return;
    rd.opt.shadows = !rd.opt.shadows; $('btnShadow').classList.toggle('on', rd.opt.shadows);
  });
  $('btnDust').addEventListener('click', () => { rd.opt.dust = rd.opt.dust > 0.5 ? 0 : 1; $('btnDust').classList.toggle('on', rd.opt.dust > 0.5); });
  $('night').addEventListener('input', e => { rd.opt.night = parseFloat(e.target.value); $('nightVal').textContent = Math.round(rd.opt.night * 100) + '%'; });
  $('btnPanel').addEventListener('click', () => document.body.classList.toggle('panel-open'));
  $('btnHelp').addEventListener('click', () => $('modal').classList.toggle('show'));
  $('modal').addEventListener('click', e => { if (e.target.id === 'modal' || e.target.id === 'modalOk') $('modal').classList.remove('show'); });
  window.addEventListener('keydown', e => {
    const keys = Object.keys(VIEWS);
    if (e.key >= '1' && e.key <= String(Math.min(9, keys.length))) {
      const k = keys[parseInt(e.key, 10) - 1];
      viewBar.querySelectorAll('.vb').forEach(x => x.classList.toggle('on', x.dataset.v === k));
      tweenTo(VIEWS[k].cam, VIEWS[k].cut);
    } else if (e.key === 'c' || e.key === 'C') applyCutaway(!S.cutaway);
    else if (e.key === 'l' || e.key === 'L') $('btnLbl').click();
    else if (e.key === 'r' || e.key === 'R') $('btnRot').click();
    else if (e.key === 'w' || e.key === 'W') $('btnWire').click();
    else if (e.key === 'n' || e.key === 'N') { $('night').value = rd.opt.night > 0.5 ? '0' : '0.85'; $('night').dispatchEvent(new Event('input')); }
    else if (e.key === 'h' || e.key === 'H') $('btnHelp').click();
  });
  window.addEventListener('resize', () => rd.resize());

  /* ---------------------------- 主循环 ---------------------------- */
  function frame(now) {
    // 补间
    if (S.tween) {
      const t = Math.min(1, (now - S.tween.t0) / S.tween.dur);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      for (const k of ['yaw', 'pitch', 'dist', 'tx', 'ty', 'tz', 'fov']) {
        if (S.tween.to[k] !== undefined) rd.cam[k] = S.tween.from[k] + (S.tween.to[k] - S.tween.from[k]) * e;
      }
      if (t >= 1) S.tween = null;
    } else if (S.autoRotate) {
      rd.cam.yaw += 0.0022;
    }
    rd.draw(now);
    syncLabels();
    S.frames++;
    if (now - S.lastT > 500) {
      S.fps = Math.round(S.frames * 1000 / (now - S.lastT));
      S.frames = 0; S.lastT = now;
      $('hud').innerHTML = `${S.fps} FPS　·　三角形 ${(geo.triCount / 1000).toFixed(1)}k　·　部件 ${geo.parts.length}　·　` +
        `曲面占比 ${(geo.stats.curvedRatio * 100).toFixed(0)}%${rd.opt.shadows ? '　·　阴影 开' : ''}`;
    }
    requestAnimationFrame(frame);
  }

  renderGroupList(); renderPartList();
  $('meta').innerHTML = `车长 ${geo.meta.dims.length.toFixed(2)}m · 车宽 ${geo.meta.dims.width.toFixed(2)}m · 车高 ${geo.meta.dims.height.toFixed(2)}m`;
  $('btnRot').classList.add('on'); $('btnLbl').classList.add('on');
  if (rd.opt.shadows) $('btnShadow').classList.add('on');
  $('btnDust').classList.add('on');
  $('loading').style.display = 'none';
  requestAnimationFrame(frame);

  /* 自动化测试挂钩 */
  window.__RV__ = {
    geo, rd, S, VIEWS, focusPart, tweenTo, applyCutaway, syncLabels,
    setView: k => { tweenTo(VIEWS[k].cam, VIEWS[k].cut, 1); },
    setNight: v => { rd.opt.night = v; },
    labelCount: () => [...labelEls.values()].filter(e => e.style.display !== 'none').length,
    pick: (x, y) => rd.pickPart(x, y),
    ready: true
  };
})();
