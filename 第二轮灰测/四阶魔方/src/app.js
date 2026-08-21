/* ============================================================================
 * app.js —— 交互、动画、求解演示控制
 * ==========================================================================*/
(function () {
  'use strict';
  const C = window.CUBE4;
  const R = window.RENDER;

  /* ------------------------------ DOM ------------------------------ */
  const $ = id => document.getElementById(id);
  const canvas = $('cv');
  const stepsEl = $('steps'), toastEl = $('toast'), metaEl = $('solMeta');
  const btnScramble = $('btnScramble'), btnSolve = $('btnSolve'), btnReset = $('btnReset');
  const btnFirst = $('btnFirst'), btnPrev = $('btnPrev'), btnPlay = $('btnPlay'), btnNext = $('btnNext'), btnLast = $('btnLast');
  const progress = $('progress'), moveCounter = $('moveCounter'), speedSel = $('speed');
  const curStepEl = $('curStep'), playbar = $('playbar'), statusEl = $('status'), panel = $('panel');

  const PALETTE = ['#e7ecf5', '#f0302a', '#1cb556', '#f5c81c', '#f76d10', '#2a5ceb'];
  let renderer;
  try {
    renderer = R.createRenderer(canvas, PALETTE);
  } catch (e) {
    document.body.innerHTML = '<div class="fatal">无法初始化 WebGL2：' + e.message + '</div>';
    return;
  }

  /* ------------------------------ 状态 ------------------------------ */
  const S = {
    cube: C.solvedState(),
    anim: null,              // {move, axis, mask, from, to, t0, dur, onDone}
    queue: [],               // 待播放的招式
    drag: null,              // 拖拽转层状态
    orbit: null,
    solution: null,          // {method, steps, flat:[{name,step}], base:Uint8Array}
    playIdx: 0,
    playing: false,
    solving: false,
    scrambling: false,
    moveCount: 0
  };
  const MOVE_BY_LAYER = new Map();          // axis*100+layer*10+q -> move
  for (const m of C.SINGLE_MOVES) MOVE_BY_LAYER.set(m.axis * 100 + m.layers[0] * 10 + m.q, m);
  const maskOf = layers => layers.reduce((a, l) => a | (1 << l), 0);
  const rad = deg => deg * Math.PI / 180;

  renderer.setState(S.cube);

  /* ------------------------------ 提示条 ------------------------------ */
  let toastTimer = null;
  function toast(msg, ms) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms || 2200);
  }
  function status(msg, kind) {
    statusEl.textContent = msg || '';
    statusEl.className = 'status' + (kind ? ' ' + kind : '');
  }

  /* ------------------------------ 动画循环 ------------------------------ */
  const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  function startMove(move, dur, onDone) {
    S.anim = {
      move, axis: move.axis, mask: maskOf(move.layers),
      from: 0, to: rad(move.angle), t0: performance.now(), dur: dur, onDone
    };
  }
  function commitAnim() {
    const a = S.anim;
    S.anim = null;
    renderer.setAnim(null);
    if (a.move) {
      S.cube = C.applyMove(S.cube, a.move);
      renderer.setState(S.cube);
      S.moveCount++;
    }
    if (a.onDone) a.onDone();
  }
  function frame(now) {
    if (S.anim) {
      const a = S.anim;
      const p = Math.min(1, (now - a.t0) / a.dur);
      const e = easeInOut(p);
      renderer.setAnim({ axis: a.axis, mask: a.mask, angle: a.from + (a.to - a.from) * e });
      if (p >= 1) commitAnim();
    } else if (S.drag && S.drag.locked) {
      renderer.setAnim({ axis: S.drag.axis, mask: 1 << S.drag.layer, angle: S.drag.angle });
    } else if (!S.queue.length) {
      renderer.setAnim(null);
    }
    if (!S.anim && !(S.drag && S.drag.locked) && S.queue.length) {
      const item = S.queue.shift();
      startMove(item.move, item.dur, item.onDone);
    }
    renderer.draw(now);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // 把正在播放/排队的招式立即结算（无动画），保证状态快照一致
  function flushQueue() {
    if (S.anim) {
      const a = S.anim; S.anim = null; renderer.setAnim(null);
      if (a.move) { S.cube = C.applyMove(S.cube, a.move); S.moveCount++; }
    }
    while (S.queue.length) {
      const it = S.queue.shift();
      if (it.move) { S.cube = C.applyMove(S.cube, it.move); S.moveCount++; }
    }
    renderer.setState(S.cube);
  }

  function enqueue(moves, dur, onAll) {
    moves.forEach((m, i) => S.queue.push({ move: m, dur, onDone: i === moves.length - 1 ? onAll : null }));
  }
  const busy = () => S.solving || S.scrambling;

  /* ------------------------------ 手势：转层 / 转视角 ------------------------------ */
  const AXES = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  function localPos(ev) {
    const r = canvas.getBoundingClientRect();
    return [ev.clientX - r.left, ev.clientY - r.top];
  }
  function onDown(ev) {
    if (ev.button !== undefined && ev.button !== 0 && ev.pointerType === 'mouse') {
      // 右键：始终转视角
      S.orbit = { x: ev.clientX, y: ev.clientY };
      canvas.setPointerCapture && canvas.setPointerCapture(ev.pointerId);
      return;
    }
    const [px, py] = localPos(ev);
    const hit = renderer.pick(px, py);
    canvas.setPointerCapture && canvas.setPointerCapture(ev.pointerId);
    if (hit && !busy() && !S.anim) {
      S.drag = { hit, sx: px, sy: py, locked: false, angle: 0 };
    } else {
      S.orbit = { x: ev.clientX, y: ev.clientY };
    }
  }
  function lockDrag(dx, dy) {
    const hit = S.drag.hit;
    const ax = hit.axis, s = hit.sign;
    const a = AXES[(ax + 1) % 3], b = AXES[(ax + 2) % 3];
    const u = s > 0 ? a : b, v = s > 0 ? b : a;      // u × v = 面法向
    const su = renderer.screenDir(hit.point, u), sv = renderer.screenDir(hit.point, v);
    // 解 2×2 方程 d ≈ α·su + β·sv
    const det = su[0] * sv[1] - su[1] * sv[0];
    let alpha, beta;
    if (Math.abs(det) > 1e-6) {
      alpha = (dx * sv[1] - dy * sv[0]) / det;
      beta = (su[0] * dy - su[1] * dx) / det;
    } else { alpha = dx; beta = dy; }
    // 沿 u 拖动 → 绕 v 旋转；沿 v 拖动 → 绕 -u 旋转
    let omega = Math.abs(alpha) >= Math.abs(beta)
      ? scale(v, Math.sign(alpha)) : scale(u, -Math.sign(beta));
    const axIdx = omega[0] !== 0 ? 0 : omega[1] !== 0 ? 1 : 2;
    const sgn = Math.sign(omega[axIdx]);
    const layer = hit.cell[axIdx];
    const tangent = norm(cross(norm(omega), hit.point));
    const tscr = renderer.screenDir(hit.point, tangent);
    const tl = Math.hypot(tscr[0], tscr[1]) || 1;
    S.drag.locked = true;
    S.drag.axis = axIdx;
    S.drag.sgn = sgn;
    S.drag.layer = layer;
    S.drag.tdir = [tscr[0] / tl, tscr[1] / tl];
    S.drag.angle = 0;
    S.drag.pxPer90 = Math.max(70, Math.min(150, (renderer.size()[1] || 700) * 0.17));
  }
  function onMove(ev) {
    if (S.orbit) {
      const dx = ev.clientX - S.orbit.x, dy = ev.clientY - S.orbit.y;
      S.orbit.x = ev.clientX; S.orbit.y = ev.clientY;
      renderer.cam.yaw -= dx * 0.0065;
      renderer.cam.pitch = Math.max(-1.45, Math.min(1.45, renderer.cam.pitch + dy * 0.0065));
      return;
    }
    if (!S.drag) return;
    const [px, py] = localPos(ev);
    const dx = px - S.drag.sx, dy = py - S.drag.sy;
    if (!S.drag.locked) {
      if (Math.hypot(dx, dy) < 7) return;
      lockDrag(dx, dy);
    }
    const proj = dx * S.drag.tdir[0] + dy * S.drag.tdir[1];
    S.drag.angle = S.drag.sgn * (proj / S.drag.pxPer90) * (Math.PI / 2);
  }
  function onUp() {
    if (S.orbit) { S.orbit = null; return; }
    if (!S.drag) return;
    const d = S.drag;
    S.drag = null;
    if (!d.locked) return;
    // 吸附到最近的 90°：d.angle 已是"绕 +axis 的右手转角"，直接换算成招式
    const q = Math.round(d.angle / (Math.PI / 2));
    const target = q * (Math.PI / 2);
    const qq = ((q % 4) + 4) % 4;
    const move = qq === 0 ? null : MOVE_BY_LAYER.get(d.axis * 100 + d.layer * 10 + qq);
    // 用动画从当前角度平滑吸附
    S.anim = {
      move: null, axis: d.axis, mask: 1 << d.layer, from: d.angle, to: target,
      t0: performance.now(), dur: 110 + Math.abs(target - d.angle) * 40,
      onDone: () => {
        if (move) {
          S.cube = C.applyMove(S.cube, move);
          renderer.setState(S.cube);
          S.moveCount++;
          S.lastTurn = { axis: d.axis, layer: d.layer, move: move.name };
          onManualMove();
        }
      }
    };
  }
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    renderer.cam.dist = Math.max(6.2, Math.min(18, renderer.cam.dist + Math.sign(e.deltaY) * 0.55));
  }, { passive: false });
  // 触摸双指缩放
  let pinch = null;
  canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      S.drag = null; S.orbit = null;
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', e => {
    if (e.touches.length === 2 && pinch) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      renderer.cam.dist = Math.max(6.2, Math.min(18, renderer.cam.dist * (pinch / d)));
      pinch = d;
      e.preventDefault();
    }
  }, { passive: false });
  canvas.addEventListener('touchend', () => { pinch = null; }, { passive: true });

  function onManualMove() {
    if (S.solution) {
      S.solution = null; S.playing = false; S.playIdx = 0;
      renderStepList();
      status('手动转动已接管，之前的解法已失效，请重新点击「求解」', 'warn');
      toast('手动转动 · 解法已重置');
    }
    checkSolved();
  }
  function checkSolved() {
    if (C.isSolved(S.cube)) {
      document.body.classList.add('solved');
      setTimeout(() => document.body.classList.remove('solved'), 1600);
      status('已复原 ✓', 'ok');
    }
  }

  /* ------------------------------ 求解 Worker ------------------------------ */
  let worker = null, workerBroken = false;
  function workerSource() {
    const el = document.getElementById('solverWorker');
    return el ? el.textContent : '';
  }
  function ensureWorker() {
    if (worker || workerBroken) return worker;
    try {
      const blob = new Blob([workerSource()], { type: 'application/javascript' });
      worker = new Worker(URL.createObjectURL(blob));
      worker.onerror = () => { workerBroken = true; worker = null; };
      return worker;
    } catch (e) { workerBroken = true; return null; }
  }
  let mainSolver = null;
  function solveOnMainThread(state, method, cb) {
    if (!mainSolver) {
      try {
        new Function(workerSource() + '\n;window.__SOLVER__ = self.SOLVER;')();
        mainSolver = window.__SOLVER__;
      } catch (e) { cb({ type: 'error', message: '求解器加载失败: ' + e.message }); return; }
    }
    setTimeout(() => {
      try {
        const res = mainSolver.solve(Uint8Array.from(state), method);
        cb({ type: 'done', res });
      } catch (e) { cb({ type: 'error', message: e.message }); }
    }, 60);
  }

  function currentMethod() {
    const el = document.querySelector('input[name="method"]:checked');
    return el ? el.value : 'cfop';
  }

  function doSolve() {
    if (busy()) return;
    S.playing = false;
    flushQueue();
    if (C.isSolved(S.cube)) { toast('魔方已经是复原状态'); return; }
    S.solving = true;
    btnSolve.classList.add('loading');
    status('求解中… 正在归约 / 搜索', 'busy');
    const base = Uint8Array.from(S.cube);
    const method = currentMethod();
    const onMsg = msg => {
      if (msg.type === 'progress') { status('求解中… ' + msg.label, 'busy'); return; }
      S.solving = false;
      btnSolve.classList.remove('loading');
      if (msg.type === 'error') { status('求解失败：' + msg.message, 'warn'); toast('求解失败：' + msg.message, 3600); return; }
      const res = msg.res;
      const flat = [];
      res.steps.forEach((s, si) => s.moves.forEach(n => flat.push({ name: n, step: si })));
      S.solution = { method: res.method, steps: res.steps, flat, base };
      S.playIdx = 0;
      S.cube = Uint8Array.from(base);
      renderer.setState(S.cube);
      renderStepList();
      updatePlayUI();
      const mm = res.method === 'roux' ? '桥式 Roux' : 'CFOP';
      status(`${mm} 解法就绪：${flat.length} 步 / ${res.steps.length} 个阶段（耗时 ${res.ms}ms）`, 'ok');
      toast(`已生成 ${mm} 解法：${flat.length} 步，点击 ▶ 播放`);
      document.body.classList.add('has-solution');
      setPlaying(true);
    };
    const w = ensureWorker();
    if (w) {
      w.onmessage = e => onMsg(e.data);
      w.postMessage({ state: Array.from(base), method });
    } else {
      status('求解中…（主线程计算，界面可能短暂无响应）', 'busy');
      solveOnMainThread(base, method, onMsg);
    }
  }

  /* ------------------------------ 打乱 / 重置 ------------------------------ */
  function doScramble() {
    if (busy()) return;
    S.playing = false; flushQueue();
    S.solution = null; S.playIdx = 0;
    document.body.classList.remove('has-solution');
    renderStepList();
    const seq = C.randomScramble(32);
    S.scrambling = true;
    status('打乱中…', 'busy');
    enqueue(seq, 62, () => {
      S.scrambling = false;
      status('已打乱 ' + seq.length + ' 步，可拖拽转层，或选择解法后点击「求解」', '');
      toast('打乱完成：' + seq.length + ' 步');
    });
  }
  function doReset() {
    if (busy()) return;
    S.queue.length = 0;
    S.anim = null; renderer.setAnim(null);
    S.solution = null; S.playing = false; S.playIdx = 0;
    document.body.classList.remove('has-solution');
    S.cube = C.solvedState();
    renderer.setState(S.cube);
    renderStepList();
    status('已回到复原状态', '');
  }

  /* ------------------------------ 分步演示控制 ------------------------------ */
  function setPlaying(v) {
    S.playing = v && !!S.solution && S.playIdx < S.solution.flat.length;
    btnPlay.textContent = S.playing ? '⏸' : '▶';
    btnPlay.title = S.playing ? '暂停' : '播放';
    if (S.playing) pump();
  }
  function stepDuration() {
    const sp = parseFloat(speedSel.value) || 1;
    return Math.max(70, 300 / sp);
  }
  function pump() {
    if (!S.playing || !S.solution) return;
    if (S.anim || S.queue.length) return;
    if (S.playIdx >= S.solution.flat.length) { setPlaying(false); checkSolved(); return; }
    const mv = C.moveByName(S.solution.flat[S.playIdx].name);
    S.playIdx++;
    enqueue([mv], stepDuration(), () => { updatePlayUI(); pump(); });
    updatePlayUI();
  }
  function stepOnce(dir) {
    if (!S.solution || S.anim || S.queue.length) return;
    setPlaying(false);
    if (dir > 0) {
      if (S.playIdx >= S.solution.flat.length) return;
      const mv = C.moveByName(S.solution.flat[S.playIdx].name);
      S.playIdx++;
      enqueue([mv], 190, () => { updatePlayUI(); checkSolved(); });
    } else {
      if (S.playIdx <= 0) return;
      S.playIdx--;
      const mv = C.moveByName(S.solution.flat[S.playIdx].name);
      const inv = C.invertSeq([mv])[0];
      enqueue([inv], 190, updatePlayUI);
    }
    updatePlayUI();
  }
  function gotoIndex(k) {
    if (!S.solution) return;
    setPlaying(false);
    S.queue.length = 0; S.anim = null; renderer.setAnim(null);
    k = Math.max(0, Math.min(S.solution.flat.length, k));
    let st = Uint8Array.from(S.solution.base);
    for (let i = 0; i < k; i++) st = C.applyMove(st, C.moveByName(S.solution.flat[i].name));
    S.cube = st; renderer.setState(st); S.playIdx = k;
    updatePlayUI();
    if (k === S.solution.flat.length) checkSolved();
  }

  function renderStepList() {
    stepsEl.innerHTML = '';
    if (!S.solution) {
      stepsEl.innerHTML = '<div class="empty">还没有解法。<br>① 点「打乱」或直接拖动魔方<br>② 选择 CFOP / 桥式 Roux<br>③ 点「求解」生成分步演示</div>';
      metaEl.textContent = '';
      updatePlayUI();
      return;
    }
    const sol = S.solution;
    metaEl.textContent = (sol.method === 'roux' ? '桥式 Roux' : 'CFOP') + ' · ' + sol.flat.length + ' 步';
    let acc = 0;
    sol.steps.forEach((s, si) => {
      const start = acc; acc += s.moves.length;
      const d = document.createElement('div');
      d.className = 'step';
      d.dataset.si = si; d.dataset.start = start;
      const chips = s.moves.map((m, mi) => `<span class="mv" data-idx="${start + mi}">${m}</span>`).join('');
      d.innerHTML =
        `<div class="step-head"><span class="ph ph-${s.phase}">${s.phase}</span>` +
        `<span class="nm">${s.name}</span><span class="cnt">${s.moves.length}</span></div>` +
        `<div class="desc">${s.desc || ''}</div><div class="mvs">${chips}</div>`;
      d.addEventListener('click', ev => {
        const chip = ev.target.closest('.mv');
        gotoIndex(chip ? parseInt(chip.dataset.idx, 10) + 1 : parseInt(d.dataset.start, 10));
      });
      stepsEl.appendChild(d);
    });
    updatePlayUI();
  }

  function updatePlayUI() {
    const sol = S.solution;
    const total = sol ? sol.flat.length : 0;
    progress.max = String(total);
    progress.value = String(S.playIdx);
    moveCounter.textContent = total ? `${S.playIdx} / ${total}` : '0 / 0';
    playbar.classList.toggle('disabled', !sol);
    if (!sol) { curStepEl.textContent = '—'; return; }
    const si = S.playIdx < total ? sol.flat[S.playIdx].step
      : (total ? sol.flat[total - 1].step : 0);
    const s = sol.steps[si];
    const nextMv = S.playIdx < total ? sol.flat[S.playIdx].name : '完成';
    curStepEl.innerHTML = `<span class="ph ph-${s.phase}">${s.phase}</span> ${s.name}` +
      `　<span class="nextmv">下一步：<b>${nextMv}</b></span>`;
    stepsEl.querySelectorAll('.step').forEach(el => {
      el.classList.toggle('active', parseInt(el.dataset.si, 10) === si);
    });
    stepsEl.querySelectorAll('.mv').forEach(el => {
      const i = parseInt(el.dataset.idx, 10);
      el.classList.toggle('done', i < S.playIdx);
      el.classList.toggle('now', i === S.playIdx);
    });
    const act = stepsEl.querySelector('.step.active');
    if (act) {
      const pr = panel.getBoundingClientRect(), ar = act.getBoundingClientRect();
      if (ar.top < pr.top + 40 || ar.bottom > pr.bottom - 10) act.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  /* ------------------------------ 绑定 ------------------------------ */
  btnScramble.addEventListener('click', doScramble);
  btnSolve.addEventListener('click', doSolve);
  btnReset.addEventListener('click', doReset);
  btnPlay.addEventListener('click', () => setPlaying(!S.playing));
  btnNext.addEventListener('click', () => stepOnce(1));
  btnPrev.addEventListener('click', () => stepOnce(-1));
  btnFirst.addEventListener('click', () => gotoIndex(0));
  btnLast.addEventListener('click', () => gotoIndex(S.solution ? S.solution.flat.length : 0));
  progress.addEventListener('input', () => gotoIndex(parseInt(progress.value, 10)));
  document.querySelectorAll('input[name="method"]').forEach(el => el.addEventListener('change', () => {
    if (S.solution) {
      S.solution = null; S.playIdx = 0; renderStepList();
      document.body.classList.remove('has-solution');
      status('已切换解法，请重新点击「求解」', '');
    }
  }));
  $('btnPanel').addEventListener('click', () => document.body.classList.toggle('panel-open'));
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
    if (e.code === 'Space') { e.preventDefault(); setPlaying(!S.playing); }
    else if (e.code === 'ArrowRight') { e.preventDefault(); stepOnce(1); }
    else if (e.code === 'ArrowLeft') { e.preventDefault(); stepOnce(-1); }
    else if (e.key === 's' || e.key === 'S') doScramble();
    else if (e.key === 'r' || e.key === 'R') doReset();
    else if (e.key === 'Enter') doSolve();
  });
  window.addEventListener('resize', () => renderer.resize());

  // 调试 / 自动化测试挂钩
  window.__APP__ = {
    S, C, renderer, doSolve, doScramble, doReset, gotoIndex, stepOnce, setPlaying,
    currentMethod, isSolved: () => C.isSolved(S.cube),
    setMethod(m) { const el = document.querySelector('input[name="method"][value="' + m + '"]'); if (el) { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); } },
    ready: true
  };

  renderStepList();
  status('拖拽魔方表面转层 · 拖拽背景转视角 · 滚轮缩放', '');
  // 预热求解器（后台创建 Worker，避免首次求解卡顿）
  setTimeout(ensureWorker, 400);
})();
