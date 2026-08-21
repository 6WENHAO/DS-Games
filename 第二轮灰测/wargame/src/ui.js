/* ============================================================================
 * ui.js —— 兵棋界面：指令下达、回合结算动画、指标仪表盘、战报日志
 * ==========================================================================*/
(function () {
  'use strict';
  const SCEN = window.SCENARIO, ENGINE = window.ENGINE, R3D = window.RENDER3D;
  const $ = id => document.getElementById(id);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

  const canvas = $('map');
  let renderer;
  try { renderer = R3D.createRenderer(canvas, ENGINE, SCEN); }
  catch (e) { document.body.innerHTML = '<div class="fatal">无法初始化 WebGL2：' + e.message + '</div>'; return; }

  /* ------------------------------------------------------------ 全局状态 */
  const G = {
    st: null, side: 'blue', sel: null, pending: null, hover: null,
    anim: null, skip: false, labels: new Map(), floats: []
  };
  const isMine = u => u.side === G.side;
  const foeSide = () => G.side === 'blue' ? 'red' : 'blue';
  const SIDE_NAME = { blue: '蓝方（美国 + 以色列）', red: '红方（伊朗 + 抵抗之弧）' };
  const ACTOR = { US: '美军', IL: '以军', IR: '伊朗', HZ: '真主党', IQ: '伊拉克民兵', HU: '胡塞', HM: '哈马斯' };
  const TYPE = { air: '航空兵', bmb: '战略轰炸', msl: '导弹', uav: '无人机', ad: '防空反导', nav: '海军', grd: '地面', cyb: '网络/特战' };
  const STATUS = { ready: '', pressure: '解武压力', integrating: '整合中', ceasefire: '停火中' };

  /* ------------------------------------------------------------ 新对局 */
  function newGame(side, seed) {
    G.side = side || 'blue';
    G.st = ENGINE.createGame({ seed: seed, playerSide: G.side });
    G.sel = null; G.pending = null; G.anim = null;
    renderer.clearFx();
    renderer.rebuildDynamic(G.st);
    rebuildLabels();
    renderAll();
    $('sideTag').textContent = SIDE_NAME[G.side];
    document.body.classList.toggle('side-red', G.side === 'red');
  }

  /* ------------------------------------------------------------ 标签层 */
  function rebuildLabels() {
    const layer = $('labels');
    layer.innerHTML = '';
    G.labels.clear();
    G.st.sites.forEach(s => {
      const d = el('div', 'lb lb-site' + (s.side === 'blue' ? ' b' : s.side === 'red' ? ' r' : ''));
      d.innerHTML = `<b>${s.name}</b>`;
      d.addEventListener('click', () => selectHex(s.c, s.r));
      layer.appendChild(d);
      G.labels.set('site:' + s.id, d);
    });
    G.st.units.forEach(u => {
      const d = el('div', 'lb lb-unit ' + (u.side === 'blue' ? 'b' : 'r'));
      d.addEventListener('click', ev => { ev.stopPropagation(); selectUnit(u.id); });
      layer.appendChild(d);
      G.labels.set('unit:' + u.id, d);
    });
  }
  function syncLabels() {
    const pos = renderer.labelPositions();
    const seen = new Set();
    pos.forEach(p => {
      const key = p.kind + ':' + p.id;
      const d = G.labels.get(key);
      if (!d) return;
      seen.add(key);
      if (!p.screen) { d.style.display = 'none'; return; }
      d.style.display = '';
      d.style.transform = `translate(-50%,-100%) translate(${p.screen[0].toFixed(1)}px,${p.screen[1].toFixed(1)}px)`;
      if (p.kind === 'unit') {
        const u = G.st.byId(p.id);
        if (!u || !ENGINE.unitActive(u)) { d.style.display = 'none'; return; }
        const hpPct = Math.round(100 * u.hp / u.maxHp);
        d.className = 'lb lb-unit ' + (u.side === 'blue' ? 'b' : 'r') +
          (G.sel && G.sel.type === 'unit' && G.sel.id === u.id ? ' sel' : '') +
          (u.order ? ' ordered' : '');
        d.innerHTML = `<span class="nm">${u.short}</span><span class="bar"><i style="width:${hpPct}%"></i></span>` +
          (u.order ? `<span class="ord">${ENGINE.ORDER_DEF[u.order.key].name}</span>` : '');
      } else {
        const s = G.st.siteById(p.id);
        d.className = 'lb lb-site' + (s.side === 'blue' ? ' b' : s.side === 'red' ? ' r' : '') + (s.dmg > 45 ? ' hurt' : '');
        d.innerHTML = `<b>${s.name}</b>` + (s.dmg > 4 ? `<i>损${Math.round(s.dmg)}</i>` : '');
      }
    });
    G.labels.forEach((d, k) => { if (!seen.has(k)) d.style.display = 'none'; });
  }

  /* ------------------------------------------------------------ 选择逻辑 */
  function selectUnit(id) {
    const u = G.st.byId(id);
    if (!u || !ENGINE.unitActive(u)) return;
    G.sel = { type: 'unit', id }; G.pending = null;
    renderPanels(); updateHighlight();
  }
  function selectHex(c, r) {
    G.sel = { type: 'hex', key: c + ',' + r, c, r };
    const own = G.st.units.filter(u => u.c === c && u.r === r && isMine(u) && ENGINE.unitActive(u));
    if (own.length) { G.sel = { type: 'unit', id: own[0].id }; }
    G.pending = null;
    renderPanels(); updateHighlight();
  }
  function updateHighlight() {
    let selKey = null, list = [];
    if (G.sel && G.sel.type === 'unit') {
      const u = G.st.byId(G.sel.id);
      if (u) {
        selKey = u.c + ',' + u.r;
        if (G.pending) list = ENGINE.targetsFor(G.st, u, G.pending).map(t => t.c + ',' + t.r);
      }
    } else if (G.sel && G.sel.type === 'hex') selKey = G.sel.key;
    renderer.setHighlight(selKey, list);
  }

  /* ------------------------------------------------------------ 面板渲染 */
  function meterBar(label, key, val, min, max, fmt, tip, danger) {
    const pct = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
    return `<div class="mt${danger ? ' danger' : ''}" title="${tip || ''}">
      <div class="mt-h"><span>${label}</span><b>${fmt ? fmt(val) : val}</b></div>
      <div class="mt-b"><i style="width:${pct.toFixed(1)}%"></i></div></div>`;
  }
  function renderMeters() {
    const M = G.st.meters, cap = ENGINE.talksCap(G.st);
    const f1 = v => v.toFixed(0);
    $('meters').innerHTML =
      meterBar('升级阶梯', 'esc', M.esc, 0, 9, v => v + ' / 9', '9 = 全面战争边缘；跨过门槛需显式决策', M.esc >= 8) +
      meterBar('伊朗核指数', 'heu', M.heu, 0, 100, f1, '高浓铀库存与浓缩能力（≥95 视为突破）', M.heu > 80) +
      meterBar('红方导弹存量', 'redMissiles', M.redMissiles, 0, 100, f1, '公开评估：伊朗仍保有约 70% 导弹库存', false) +
      meterBar('蓝方拦截弹库存', 'intercept', M.intercept, 0, 100, f1, '报道称为保卫以色列已消耗约一半', M.intercept < 30) +
      meterBar('谈判进度', 'talks', M.talks, 0, 100, v => `${f1(v)}（上限 ${cap}）`, '上限被双方红线锁死：蓝方停止深度打击 / 红方接受高浓铀移交机制', false) +
      meterBar('美国国内支持', 'usWill', M.usWill, 0, 100, f1, '≤30 红方政治胜利', M.usWill < 40) +
      meterBar('伊朗政权凝聚力', 'irCohesion', M.irCohesion, 0, 100, f1, '≤15 且核指数≤40 蓝方施压胜利', M.irCohesion < 25) +
      meterBar('以色列社会承受力', 'ilMorale', M.ilMorale, 0, 100, f1, '≤25 红方军事胜利', M.ilMorale < 35) +
      meterBar('霍尔木兹通航', 'hormuz', M.hormuz, 0, 100, v => f1(v) + '%', '公开报道：航运持续受限', M.hormuz < 40) +
      meterBar('曼德海峡通航', 'mandab', M.mandab, 0, 100, v => f1(v) + '%', '也门港口遇袭后作业暂停', M.mandab < 40) +
      meterBar('布伦特油价', 'oil', M.oil, 60, 200, v => '$' + f1(v), '由两处咽喉通航率推导', M.oil > 130) +
      meterBar('阿拉伯国家立场', 'arabTilt', M.arabTilt, -100, 100, v => (v > 0 ? '+' : '') + f1(v), '正=偏美以 / 负=偏伊', M.arabTilt < -20) +
      meterBar('人道压力', 'civ', M.civ, 0, 100, f1, '民用损失累积，影响正当性', M.civ > 70);
    const fl = [];
    if (G.st.flags.blueHalt) fl.push('蓝方已承诺停止深度打击（' + G.st.flags.blueHalt + ' 回合）');
    if (G.st.flags.blueSurge) fl.push('蓝方深度打击授权生效');
    if (G.st.flags.redHeuDeal) fl.push('红方已接受高浓铀移交机制');
    $('flags').innerHTML = fl.length ? fl.map(f => `<span class="fl">${f}</span>`).join('') : '<span class="fl dim">暂无生效的政治承诺</span>';
  }

  function renderForce() {
    const box = $('force');
    box.innerHTML = '';
    ['blue', 'red'].forEach(side => {
      const mine = side === G.side;
      const list = G.st.units.filter(u => u.side === side);
      const alive = list.filter(u => ENGINE.unitActive(u));
      const head = el('div', 'fh' + (side === 'blue' ? ' b' : ' r'),
        `${side === 'blue' ? '蓝方' : '红方'} · ${alive.length}/${list.length} 可用` + (mine ? '（我方）' : ''));
      box.appendChild(head);
      list.forEach(u => {
        const dead = !ENGINE.unitActive(u);
        const d = el('div', 'fu' + (side === 'blue' ? ' b' : ' r') + (dead ? ' dead' : '') +
          (G.sel && G.sel.type === 'unit' && G.sel.id === u.id ? ' sel' : '') + (u.order ? ' ordered' : ''));
        const hp = Math.round(100 * u.hp / u.maxHp);
        d.innerHTML = `<div class="fu-top"><span class="tag">${ACTOR[u.actor]}</span><span class="nm">${u.name}</span></div>
          <div class="fu-sub">${TYPE[u.type]} · 战力 ${hp}% · 弹药 ${u.ammo}/${u.maxAmmo} · 战备 ${Math.round(u.readiness)}
          ${u.status !== 'ready' ? '· <em>' + STATUS[u.status] + '</em>' : ''}</div>
          ${u.order ? `<div class="fu-ord">指令：${ENGINE.ORDER_DEF[u.order.key].name}${u.order.target ? ' → ' + (u.order.target.label || '') : ''}</div>` : ''}`;
        if (!dead) d.addEventListener('click', () => { if (mine) selectUnit(u.id); else selectHex(u.c, u.r); });
        box.appendChild(d);
      });
    });
  }

  function renderOrders() {
    const box = $('orders');
    box.innerHTML = '';
    if (G.st.over) { box.innerHTML = '<div class="hint">推演已结束，可点击「再来一局」。</div>'; return; }
    if (G.st.phase === 'politics') { renderPolitics(box); return; }
    if (!G.sel || G.sel.type !== 'unit') {
      const un = G.st.units.filter(u => isMine(u) && ENGINE.unitActive(u) && !u.order).length;
      box.innerHTML = `<div class="hint">点击地图上的棋子或右侧兵力表选择单位。<br>本回合尚有 <b>${un}</b> 个单位未下达指令。</div>`;
      return;
    }
    const u = G.st.byId(G.sel.id);
    if (!u) return;
    if (!isMine(u)) { box.innerHTML = `<div class="hint">${u.name} 属于对方，无法下达指令。</div>`; return; }
    const opts = ENGINE.orderTypesFor(G.st, u);
    const head = el('div', 'osel', `<b>${u.name}</b><span>${TYPE[u.type]} · 射程 ${u.rng} · 弹药 ${u.ammo}</span>` +
      (u.status !== 'ready' ? `<em class="warn">${STATUS[u.status]}：投入作战有政治代价</em>` : ''));
    box.appendChild(head);
    const grid = el('div', 'ogrid');
    opts.forEach(o => {
      const b = el('button', 'obtn' + (G.pending === o.key ? ' on' : '') + (u.order && u.order.key === o.key ? ' cur' : ''), o.name);
      b.title = o.desc || '';
      b.addEventListener('click', () => {
        if (!o.needTarget) { ENGINE.setOrder(G.st, u.id, o.key, null); G.pending = null; renderAll(); return; }
        G.pending = (G.pending === o.key ? null : o.key);
        renderPanels(); updateHighlight();
      });
      grid.appendChild(b);
    });
    box.appendChild(grid);
    if (u.order) {
      const c = el('button', 'obtn clear', '取消当前指令');
      c.addEventListener('click', () => { ENGINE.setOrder(G.st, u.id, null); renderAll(); });
      box.appendChild(c);
    }
    if (G.pending) {
      const tl = ENGINE.targetsFor(G.st, u, G.pending);
      const wrap = el('div', 'tlist');
      wrap.appendChild(el('div', 'tl-h', `选择目标（${ENGINE.ORDER_DEF[G.pending].name}，共 ${tl.length} 个可选）`));
      if (!tl.length) wrap.appendChild(el('div', 'hint', '射程内没有合法目标，可先「转场/机动」。'));
      tl.slice(0, 40).forEach(t => {
        const b = el('div', 'trow');
        const extra = t.kind === 'unit' ? (G.st.byId(t.id) ? `战力 ${Math.round(100 * G.st.byId(t.id).hp / G.st.byId(t.id).maxHp)}%` : '')
          : t.kind === 'site' ? (G.st.siteById(t.id) ? `价值 ${G.st.siteById(t.id).value} · 损伤 ${Math.round(G.st.siteById(t.id).dmg)}` : '') : '';
        b.innerHTML = `<span class="tn">${t.label}</span><span class="td">${t.dist} 格 · ${extra}</span>`;
        b.addEventListener('mouseenter', () => renderer.setHighlight(t.c + ',' + t.r, [t.c + ',' + t.r]));
        b.addEventListener('mouseleave', updateHighlight);
        b.addEventListener('click', () => {
          ENGINE.setOrder(G.st, u.id, G.pending, t);
          G.pending = null; renderAll();
        });
        wrap.appendChild(b);
      });
      box.appendChild(wrap);
    }
  }

  function renderPolitics(box) {
    box.innerHTML = '';
    box.appendChild(el('div', 'osel', '<b>政治阶段</b><span>选择 1 项政治行动，然后进入下一回合</span>'));
    const opts = ENGINE.politicalOptions(G.st, G.side);
    opts.forEach(o => {
      const b = el('button', 'pbtn' + (o.id.indexOf('total') >= 0 ? ' doom' : ''), `<b>${o.name}</b><span>${o.desc}</span>`);
      b.addEventListener('click', () => {
        ENGINE.applyPolitical(G.st, G.side, o.id);
        const aiCard = ENGINE.aiPolitics(G.st, foeSide());
        toast(`对方政治行动：${aiCard ? aiCard.name : '（无）'}`);
        const over = ENGINE.endTurn(G.st);
        renderer.rebuildDynamic(G.st);
        renderAll();
        if (over) showEnd(over);
      });
      box.appendChild(b);
    });
  }

  function renderLog() {
    const box = $('log');
    box.innerHTML = G.st.log.slice(-90).reverse().map(l =>
      `<div class="lg ${l.tone}"><span class="t">T${l.turn}</span>${l.text}</div>`).join('');
  }
  function renderHeader() {
    const st = G.st, M = st.meta || SCEN.meta;
    const day = SCEN.meta.warDay + (st.turn - 1) * SCEN.meta.turnDays;
    const d = new Date(Date.UTC(2026, 7, 20) + (st.turn - 1) * SCEN.meta.turnDays * 86400000);
    $('turnInfo').innerHTML = `第 <b>${st.turn}</b> / ${SCEN.meta.maxTurns} 回合　·　${d.toISOString().slice(0, 10)}　·　战争第 ${day} 天` +
      `　·　阶段：<b>${st.phase === 'orders' ? '下达指令' : st.phase === 'politics' ? '政治决策' : '已结束'}</b>`;
    const un = st.units.filter(u => isMine(u) && ENGINE.unitActive(u) && !u.order).length;
    $('btnResolve').disabled = st.phase !== 'orders' || !!st.over;
    $('btnResolve').textContent = st.phase === 'orders' ? `结算回合${un ? `（${un} 个单位待命）` : ''}` : '本回合已结算';
    void M;
  }
  function renderPanels() { renderOrders(); renderForce(); }
  function renderAll() { renderHeader(); renderMeters(); renderPanels(); renderLog(); updateHighlight(); }

  /* ------------------------------------------------------------ 回合结算动画 */
  function resolve() {
    if (G.st.phase !== 'orders' || G.st.over) return;
    const aiPlan = ENGINE.aiApply(G.st, foeSide());
    toast(`对方姿态：${{ press: '强攻', attrit: '消耗', defend: '固守', negotiate: '谈判倾向' }[aiPlan.posture]}`);
    const tl = ENGINE.resolveTurn(G.st);
    renderer.rebuildDynamic(G.st);
    renderAll();
    playTimeline(tl);
  }
  function playTimeline(tl) {
    const strikes = tl.filter(e => ['strike', 'raid', 'mine', 'escort', 'cyber', 'sead', 'repair', 'move'].indexOf(e.t) >= 0);
    G.anim = { i: 0, list: strikes, t0: performance.now() };
    $('btnSkip').style.display = strikes.length ? '' : 'none';
    const step = () => {
      if (!G.anim) return;
      const a = G.anim;
      if (G.skip) { a.i = a.list.length; }
      while (a.i < a.list.length) {
        const e = a.list[a.i++];
        if (!e.from || !e.to) continue;
        renderer.addArc(e.from, e.to, e.side, {});
        const col = e.t === 'strike' ? (e.dmg > 0 ? [1, 0.55, 0.25] : [0.5, 0.8, 1]) :
          e.t === 'mine' ? [1, 0.4, 0.4] : e.t === 'escort' ? [0.5, 1, 0.8] : [0.8, 0.8, 1];
        renderer.addFlash(e.to, col, e.t === 'strike' ? (e.dmg > 12 ? 2.1 : 1.3) : 1.1, 700);
        if (e.t === 'strike') {
          floatText(e.to, e.dmg > 0 ? `-${e.dmg}` : '拦截', e.dmg > 0 ? (e.side === 'blue' ? 'b' : 'r') : 'i', 760);
        }
        if (!G.skip && a.i % 3 === 0) { setTimeout(step, 320); return; }
      }
      if (a.i >= a.list.length) {
        setTimeout(() => {
          G.anim = null; G.skip = false;
          $('btnSkip').style.display = 'none';
          const ev = G.st.timeline.find(x => x.t === 'event');
          if (ev) toast(`态势事件：${ev.title}`, 3400);
          renderAll();
        }, G.skip ? 60 : 900);
      }
    };
    step();
  }
  function floatText(hex, text, cls, delay) {
    G.floats.push({ hex, text, cls, t0: performance.now() + (delay || 0), dur: 1200 });
  }
  function syncFloats() {
    const layer = $('floats');
    const now = performance.now();
    G.floats = G.floats.filter(f => now - f.t0 < f.dur);
    const html = [];
    G.floats.forEach(f => {
      const p = (now - f.t0) / f.dur;
      if (p < 0) return;
      const w = renderer.hexWorld(f.hex[0], f.hex[1]);
      const s = renderer.project([w[0], 0.9 + p * 1.4, w[2]]);
      if (!s) return;
      html.push(`<div class="ft ${f.cls}" style="transform:translate(-50%,-50%) translate(${s[0].toFixed(1)}px,${s[1].toFixed(1)}px);opacity:${(1 - p).toFixed(2)}">${f.text}</div>`);
    });
    layer.innerHTML = html.join('');
  }

  /* ------------------------------------------------------------ 交互 */
  let drag = null;
  canvas.addEventListener('pointerdown', ev => {
    canvas.setPointerCapture && canvas.setPointerCapture(ev.pointerId);
    drag = { x: ev.clientX, y: ev.clientY, moved: 0, button: ev.button, sx: ev.clientX, sy: ev.clientY };
  });
  window.addEventListener('pointermove', ev => {
    if (!drag) return;
    const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    drag.x = ev.clientX; drag.y = ev.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    if (drag.button === 2 || ev.shiftKey) {          // 平移
      const s = renderer.cam.dist * 0.0016;
      const cy = Math.cos(renderer.cam.yaw), sy = Math.sin(renderer.cam.yaw);
      renderer.cam.cx -= (dx * cy - dy * sy) * s;
      renderer.cam.cz -= (dx * -sy - dy * cy) * s * 0.9;
    } else {                                          // 旋转
      renderer.cam.yaw -= dx * 0.006;
      renderer.cam.pitch = Math.max(0.25, Math.min(1.45, renderer.cam.pitch + dy * 0.005));
    }
  });
  window.addEventListener('pointerup', ev => {
    if (!drag) return;
    const wasClick = drag.moved < 6;
    const b = drag.button; drag = null;
    if (!wasClick || b === 2) return;
    const rect = canvas.getBoundingClientRect();
    const hit = renderer.pickHex(ev.clientX - rect.left, ev.clientY - rect.top);
    if (!hit) { G.sel = null; G.pending = null; renderAll(); return; }
    // 若正在选目标：优先在该格挑选价值最高的目标
    if (G.pending && G.sel && G.sel.type === 'unit') {
      const u = G.st.byId(G.sel.id);
      const t = ENGINE.targetsFor(G.st, u, G.pending).find(x => x.c === hit.c && x.r === hit.r);
      if (t) { ENGINE.setOrder(G.st, u.id, G.pending, t); G.pending = null; renderAll(); return; }
    }
    selectHex(hit.c, hit.r);
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    renderer.cam.dist = Math.max(9, Math.min(70, renderer.cam.dist * (1 + Math.sign(e.deltaY) * 0.12)));
  }, { passive: false });

  $('btnResolve').addEventListener('click', resolve);
  $('btnSkip').addEventListener('click', () => { G.skip = true; });
  $('btnAuto').addEventListener('click', () => {
    const p = ENGINE.aiPlan(G.st, G.side);
    let n = 0;
    p.plans.forEach(x => { const u = G.st.byId(x.unitId); if (u && !u.order) { ENGINE.setOrder(G.st, x.unitId, x.order, x.target); n++; } });
    toast(`参谋部已为 ${n} 个未下令单位拟定指令（姿态：${p.posture}）`);
    renderAll();
  });
  $('btnClear').addEventListener('click', () => {
    G.st.units.forEach(u => { if (isMine(u)) ENGINE.setOrder(G.st, u.id, null); });
    renderAll();
  });
  $('btnBrief').addEventListener('click', () => showBrief());
  $('btnNew').addEventListener('click', () => showStart());
  $('btnLog').addEventListener('click', () => document.body.classList.toggle('log-open'));

  /* ------------------------------------------------------------ 弹窗 */
  let toastT = null;
  function toast(msg, ms) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms || 2400);
  }
  function modal(html, cls) {
    const m = $('modal');
    m.className = 'modal show' + (cls ? ' ' + cls : '');
    m.innerHTML = `<div class="mbox">${html}</div>`;
    return m;
  }
  const closeModal = () => { $('modal').className = 'modal'; };
  function showStart() {
    modal(`<h2>抵抗之弧 2026 · 三维兵棋推演</h2>
      <p class="sub">数据基准日 <b>2026-08-20</b>（美以伊冲突第 ${SCEN.meta.warDay} 天）。全部态势设定取自公开报道，数值为推演抽象。</p>
      <div class="pick">
        <button data-side="blue"><b>执掌蓝方</b><span>美国 + 以色列<br>目标：压制核计划与导弹力量，或以谈判锁定移交机制</span></button>
        <button data-side="red"><b>执掌红方</b><span>伊朗 + 抵抗之弧<br>目标：耗尽对手拦截弹与政治意志，或换取"彻底结束战争"</span></button>
      </div>
      <div class="mrow"><label>随机种子 <input id="seedIn" type="number" value="${(Math.random() * 99999) | 0}"></label>
      <button id="btnBrief2" class="ghost">先看情报简报</button></div>`);
    $('modal').querySelectorAll('.pick button').forEach(b => b.addEventListener('click', () => {
      const seed = parseInt($('seedIn').value, 10) || 1;
      closeModal(); newGame(b.dataset.side, seed);
    }));
    $('btnBrief2').addEventListener('click', () => showBrief(true));
  }
  function showBrief(back) {
    const items = SCEN.BRIEFING.map(b => {
      const srcs = (b.src || []).map(id => {
        const s = SCEN.SRC(id);
        return s ? `<a href="${s.url}" target="_blank" rel="noreferrer">${s.label}</a>` : '';
      }).join('');
      return `<div class="bi"><h4>${b.title}</h4><p>${b.text}</p><div class="src">${srcs}</div></div>`;
    }).join('');
    modal(`<h2>情报简报 · 2026-08-20</h2><div class="brief">${items}</div>
      <div class="rules"><h4>规则要点</h4>
      <p>① 每回合 = 7 天，分「下达指令 → 结算 → 政治决策」。每个单位每回合 1 条指令。<br>
      ② <b>饱和齐射</b>消耗对方拦截弹；拦截弹见底会传导为社会承受力与国内支持下滑。<br>
      ③ <b>深埋目标</b>（福尔多）只有具备钻地弹的 B-2 编队能造成有效破坏。<br>
      ④ <b>谈判上限被红线锁死</b>：蓝方须"承诺停止深度打击"、红方须"接受高浓铀移交机制"，两者齐备才可能达成停战协议。<br>
      ⑤ 代理人有政治状态：真主党处于解武压力、伊拉克民兵在整合、哈马斯在停火，动用它们要付政治代价。<br>
      ⑥ 升级阶梯 9 为全面战争边缘，只有显式选择"跨过门槛"才会触发灾难结局。</p></div>
      <div class="mrow"><button id="briefOk">${back ? '返回选择阵营' : '关闭'}</button></div>`, 'wide');
    $('briefOk').addEventListener('click', () => { closeModal(); if (back) showStart(); });
  }
  function showEnd(over) {
    const sc = ENGINE.scoreSides(G.st);
    const title = over.winner === 'blue' ? '蓝方达成目标' : over.winner === 'red' ? '红方达成目标'
      : over.winner === 'draw' ? '达成停战协议 / 平局' : '灾难结局：全面战争';
    modal(`<h2 class="end ${over.winner}">${title}</h2>
      <p class="sub">${over.reason}</p>
      <div class="scoreline">终局计分　蓝方 <b>${sc.blue}</b> ： 红方 <b>${sc.red}</b>　·　共 ${G.st.turn} 回合　·　种子 ${G.st.seed}</div>
      <div class="mrow"><button id="endNew">再来一局</button><button id="endClose" class="ghost">查看战报</button></div>`);
    $('endNew').addEventListener('click', () => { closeModal(); showStart(); });
    $('endClose').addEventListener('click', () => { closeModal(); document.body.classList.add('log-open'); });
  }

  /* ------------------------------------------------------------ 主循环 */
  function frame(now) {
    renderer.draw(now);
    syncLabels(); syncFloats();
    requestAnimationFrame(frame);
  }
  window.addEventListener('resize', () => renderer.resize());
  newGame('blue', (Math.random() * 99999) | 0);
  requestAnimationFrame(frame);
  showStart();

  /* 自动化测试挂钩 */
  window.__WG__ = {
    G, ENGINE, SCEN, renderer, newGame, resolve, selectUnit, selectHex,
    setOrder: (id, key, t) => { const r = ENGINE.setOrder(G.st, id, key, t); renderAll(); return r; },
    autoOrders: () => $('btnAuto').click(),
    politics: id => {
      ENGINE.applyPolitical(G.st, G.side, id);
      ENGINE.aiPolitics(G.st, foeSide());
      const over = ENGINE.endTurn(G.st);
      renderer.rebuildDynamic(G.st); renderAll();
      if (over) showEnd(over);
      return over;
    },
    skipAnim: () => { G.skip = true; },
    closeModal, showBrief, ready: true
  };
})();
