/**
 * electrical.js —— 电气原理交互图（论文图2-10）+ 实时信号时序示波器
 * 节点可点选，连线按论文描述标注协议/信号类型，运行时信号沿连线流动。
 */
import { HARDWARE, THESIS_META } from '../data/thesis-data.js';
import { fmt, el, clamp } from '../core/store.js';

var NS = 'http://www.w3.org/2000/svg';
function sv(tag, attrs, parent) {
  var e = document.createElementNS(NS, tag);
  if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

/* 节点：id, 标签, 型号, 坐标, 所属区域 */
var NODES = [
  { id: 'gear',  t: '同步齿轮 + 光电传感器', m: '与输送机构机械同步', x: 30,  y: 250, w: 150, h: 62, zone: '检测区域', hw: 'syncsensor' },
  { id: 'sync',  t: '同步处理板', m: 'NI sbRIO-9607 · Zynq-7020', x: 232, y: 172, w: 150, h: 62, zone: '控制区域', hw: 'syncboard' },
  { id: 'cam',   t: '面阵相机 x4', m: '汇川 VC21-0045C-450-X', x: 232, y: 52,  w: 150, h: 62, zone: '检测区域', hw: 'camera' },
  { id: 'light', t: '条形光源 x2', m: '汇川 IL-LI23728G · 绿光 12W', x: 232, y: 300, w: 150, h: 62, zone: '检测区域', hw: 'light' },
  { id: 'sw',    t: '千兆交换机', m: '华为 S1730S-L8P1T-A', x: 448, y: 52,  w: 150, h: 62, zone: '控制区域', hw: 'switch' },
  { id: 'ws',    t: '视觉工作站', m: 'GPU+CPU · YOLOv11 + FP16', x: 660, y: 52,  w: 160, h: 62, zone: '控制区域', hw: 'workstation' },
  { id: 'hmi',   t: '工业触摸屏', m: '汇川 IT7150E · 15" 1024x600', x: 872, y: 52,  w: 150, h: 62, zone: '控制区域', hw: 'hmi' },
  { id: 'plc',   t: 'PLC', m: '汇川 H5U-1614MTD-A8', x: 660, y: 300, w: 160, h: 62, zone: '控制区域', hw: 'plc' },
  { id: 'valve', t: '高速电磁阀', m: 'MAC 52A-11-D08-DM-DDFA-1BA', x: 448, y: 420, w: 160, h: 62, zone: '执行区域', hw: 'valve' },
  { id: 'noz',   t: '剔除喷嘴 + 气路', m: '压缩空气定向气吹', x: 232, y: 420, w: 150, h: 62, zone: '执行区域', hw: null },
  { id: 'cig',   t: '烟支（输送机构）', m: '料斗鼓轮 → 接驳轮1/2 → 剔除轮', x: 30,  y: 420, w: 150, h: 62, zone: '输送机构', hw: null },
];

/* 连线：from, to, 标签, 信号事件类型（与 engine 的 event.kind 对应） */
var EDGES = [
  { f: 'gear',  t: 'sync',  label: '同步脉冲（齿槽计数）', evt: 'sync',    color: '#ffc14d', side: 'v' },
  { f: 'gear',  t: 'plc',   label: 'DCP / MCP 同步信号', evt: 'sync',    color: '#ffa03d', route: 'bottomBus' },
  { f: 'sync',  t: 'cam',   label: '相机触发（硬件）', evt: 'trigger',  color: '#63f5c8', side: 'v' },
  { f: 'sync',  t: 'light', label: '光源触发 / 提前量', evt: 'trigger',  color: '#8bff9c', side: 'v' },
  { f: 'cam',   t: 'sw',    label: 'GigE Vision 图像', evt: 'gige',     color: '#ffe066', side: 'h' },
  { f: 'sw',    t: 'ws',    label: '千兆以太网', evt: 'gige',     color: '#ffe066', side: 'h' },
  { f: 'ws',    t: 'hmi',   label: '界面显示 / 远程桌面', evt: null,       color: '#8fa3bf', side: 'h' },
  { f: 'ws',    t: 'plc',   label: 'Modbus TCP 检测结果', evt: 'modbus',   color: '#4db8ff', side: 'v' },
  { f: 'plc',   t: 'valve', label: '数字量输出 DO', evt: 'do',       color: '#ff5b6e', side: 'diag' },
  { f: 'valve', t: 'noz',   label: '压缩空气', evt: 'do',       color: '#7fe0ff', side: 'h' },
  { f: 'noz',   t: 'cig',   label: '气吹剔除', evt: 'do',       color: '#7fe0ff', side: 'h' },
  { f: 'light', t: 'cig',   label: '定向照明', evt: 'trigger',  color: '#8bff9c', route: 'leftDown' },
];

/* 时序通道定义 */
var CHANNELS = [
  { key: 'mcp',    label: 'MCP 同步脉冲',  color: '#ffc14d' },
  { key: 'trig',   label: '相机触发',      color: '#63f5c8' },
  { key: 'expo',   label: '曝光窗口',      color: '#a8f0ff' },
  { key: 'light',  label: '光源点亮',      color: '#8bff9c' },
  { key: 'gpu',    label: 'GPU 推理占用',  color: '#b083d6' },
  { key: 'modbus', label: 'Modbus TCP',    color: '#4db8ff' },
  { key: 'do',     label: 'PLC DO 剔除',   color: '#ff5b6e' },
  { key: 'jet',    label: '气流有效',      color: '#7fe0ff' },
];

export function createElectrical(host, store, engine) {
  host.innerHTML = '';
  var wrap = el('div', 'elec-wrap');
  host.appendChild(wrap);

  var left = el('div', 'elec-main');
  wrap.appendChild(left);
  var right = el('div', 'elec-side');
  wrap.appendChild(right);

  /* ------------------- SVG 原理图 ------------------- */
  var card = el('div', 'card');
  card.appendChild(el('div', 'card-title', '电气原理与信号流（图2-10）· 点击节点查看选型说明'));
  var svgBox = el('div', 'svg-box');
  card.appendChild(svgBox);
  left.appendChild(card);

  var svg = sv('svg', { viewBox: '0 0 1040 510', preserveAspectRatio: 'xMidYMid meet' }, svgBox);
  var defs = sv('defs', null, svg);
  // 箭头
  var colors = {};
  for (var i = 0; i < EDGES.length; i++) colors[EDGES[i].color] = 1;
  Object.keys(colors).forEach(function (c) {
    var mk = sv('marker', {
      id: 'ar' + c.replace('#', ''), viewBox: '0 0 10 10', refX: '9', refY: '5',
      markerWidth: '6', markerHeight: '6', orient: 'auto-start-reverse',
    }, defs);
    sv('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: c }, mk);
  });

  var gEdges = sv('g', { class: 'edges' }, svg);
  var gNodes = sv('g', { class: 'nodes' }, svg);

  var nodeMap = {};
  for (i = 0; i < NODES.length; i++) nodeMap[NODES[i].id] = NODES[i];

  function anchor(n, sideKey) {
    var cx = n.x + n.w / 2, cy = n.y + n.h / 2;
    if (sideKey === 'top') return [cx, n.y];
    if (sideKey === 'bottom') return [cx, n.y + n.h];
    if (sideKey === 'left') return [n.x, cy];
    if (sideKey === 'right') return [n.x + n.w, cy];
    return [cx, cy];
  }

  function pathFor(e) {
    var a = nodeMap[e.f], b = nodeMap[e.t];
    if (e.route === 'bottomBus') {
      var p1 = anchor(a, 'bottom'), p2 = anchor(b, 'left');
      return 'M ' + p1[0] + ' ' + p1[1] + ' L ' + p1[0] + ' 392 L ' + (b.x - 26) + ' 392 L ' + (b.x - 26) + ' ' + p2[1] + ' L ' + p2[0] + ' ' + p2[1];
    }
    if (e.route === 'leftDown') {
      var q1 = anchor(a, 'left'), q2 = anchor(b, 'top');
      return 'M ' + q1[0] + ' ' + q1[1] + ' L ' + (a.x - 22) + ' ' + q1[1] + ' L ' + (a.x - 22) + ' ' + (q2[1] - 18) + ' L ' + q2[0] + ' ' + (q2[1] - 18) + ' L ' + q2[0] + ' ' + q2[1];
    }
    var ax, ay, bx, by;
    if (e.side === 'h') {
      if (a.x < b.x) { var s1 = anchor(a, 'right'); var s2 = anchor(b, 'left'); ax = s1[0]; ay = s1[1]; bx = s2[0]; by = s2[1]; }
      else { var s3 = anchor(a, 'left'); var s4 = anchor(b, 'right'); ax = s3[0]; ay = s3[1]; bx = s4[0]; by = s4[1]; }
      var mx = (ax + bx) / 2;
      return 'M ' + ax + ' ' + ay + ' C ' + mx + ' ' + ay + ' ' + mx + ' ' + by + ' ' + bx + ' ' + by;
    }
    if (e.side === 'diag') {
      var d1 = anchor(a, 'bottom'), d2 = anchor(b, 'right');
      return 'M ' + d1[0] + ' ' + d1[1] + ' L ' + d1[0] + ' ' + (d2[1] - 0) + ' L ' + d2[0] + ' ' + d2[1];
    }
    // vertical
    if (a.y < b.y) { var v1 = anchor(a, 'bottom'); var v2 = anchor(b, 'top'); ax = v1[0]; ay = v1[1]; bx = v2[0]; by = v2[1]; }
    else { var v3 = anchor(a, 'top'); var v4 = anchor(b, 'bottom'); ax = v3[0]; ay = v3[1]; bx = v4[0]; by = v4[1]; }
    var my = (ay + by) / 2;
    return 'M ' + ax + ' ' + ay + ' C ' + ax + ' ' + my + ' ' + bx + ' ' + my + ' ' + bx + ' ' + by;
  }

  var edgeObjs = [];
  for (i = 0; i < EDGES.length; i++) {
    var e = EDGES[i];
    var d = pathFor(e);
    sv('path', { d: d, fill: 'none', stroke: 'rgba(255,255,255,.08)', 'stroke-width': '7' }, gEdges);
    var p = sv('path', {
      d: d, fill: 'none', stroke: e.color, 'stroke-width': '1.7',
      'stroke-dasharray': '5 5', opacity: '.5',
      'marker-end': 'url(#ar' + e.color.replace('#', '') + ')',
    }, gEdges);
    var dot = sv('circle', { r: '4.2', fill: e.color, opacity: '0' }, gEdges);
    var lab = sv('text', { class: 'edge-label', fill: e.color, 'font-size': '10.5' }, gEdges);
    lab.textContent = e.label;
    var len = 1;
    try { len = p.getTotalLength() || 1; } catch (err) { len = 1; }
    edgeObjs.push({ def: e, path: p, dot: dot, label: lab, len: len, pulses: [] });
  }
  // 标签定位（沿路径中点）
  function layoutLabels() {
    for (var k = 0; k < edgeObjs.length; k++) {
      var eo = edgeObjs[k];
      try {
        eo.len = eo.path.getTotalLength() || 1;
        var pt = eo.path.getPointAtLength(eo.len * (eo.def.route ? 0.42 : 0.5));
        eo.label.setAttribute('x', pt.x);
        eo.label.setAttribute('y', pt.y - 6);
        eo.label.setAttribute('text-anchor', 'middle');
      } catch (err) { /* layout 时 svg 未挂载 */ }
    }
  }

  var nodeEls = {};
  for (i = 0; i < NODES.length; i++) {
    var n = NODES[i];
    var g = sv('g', { class: 'enode zone-' + zoneClass(n.zone), 'data-id': n.id }, gNodes);
    sv('rect', { x: n.x, y: n.y, width: n.w, height: n.h, rx: 9, class: 'enode-bg' }, g);
    var t1 = sv('text', { x: n.x + n.w / 2, y: n.y + 24, 'text-anchor': 'middle', class: 'enode-t' }, g);
    t1.textContent = n.t;
    var t2 = sv('text', { x: n.x + n.w / 2, y: n.y + 42, 'text-anchor': 'middle', class: 'enode-m' }, g);
    t2.textContent = n.m;
    var badge = sv('text', { x: n.x + 8, y: n.y + n.h - 6, class: 'enode-z' }, g);
    badge.textContent = n.zone;
    g.addEventListener('click', function (id) {
      return function () { showNode(id); };
    }(n.id));
    nodeEls[n.id] = g;
  }
  function zoneClass(z) {
    if (z === '检测区域') return 'detect';
    if (z === '控制区域') return 'control';
    if (z === '执行区域') return 'exec';
    return 'trans';
  }

  /* ------------------- 示波器 ------------------- */
  var scopeCard = el('div', 'card');
  scopeCard.appendChild(el('div', 'card-title', '信号时序示波器 · 硬件触发与剔除时序（2.2.1 / 2.2.2）'));
  var scopeHint = el('div', 'card-hint',
    '硬件触发相比软件定时具有更高实时性与确定性；调整"时间缩放"到 0.05x 可清晰观察曝光、推理占用与阀开启的相对时序。');
  scopeCard.appendChild(scopeHint);
  var scopeBox = el('div', 'scope-box');
  scopeCard.appendChild(scopeBox);
  left.appendChild(scopeCard);
  var scope = document.createElement('canvas');
  scope.style.width = '100%';
  scope.style.display = 'block';
  scopeBox.appendChild(scope);

  var SAMPLES = 600;
  var buf = {};
  for (i = 0; i < CHANNELS.length; i++) buf[CHANNELS[i].key] = new Float32Array(SAMPLES);
  var head = 0;
  var lastT = 0;

  /* ------------------- 侧栏 ------------------- */
  var infoCard = el('div', 'card');
  infoCard.appendChild(el('div', 'card-title', '节点详情'));
  var infoBody = el('div', 'card-body');
  infoCard.appendChild(infoBody);
  right.appendChild(infoCard);

  var chainCard = el('div', 'card');
  chainCard.appendChild(el('div', 'card-title', '闭环链路'));
  var chainBody = el('div', 'card-body chain-body');
  var chainParts = THESIS_META.chain.split(' — ');
  for (i = 0; i < chainParts.length; i++) {
    var row = el('div', 'chain-item');
    row.appendChild(el('span', 'chain-idx', String(i + 1)));
    row.appendChild(el('span', 'chain-txt', chainParts[i]));
    chainBody.appendChild(row);
  }
  chainCard.appendChild(chainBody);
  right.appendChild(chainCard);

  var logCard = el('div', 'card grow');
  logCard.appendChild(el('div', 'card-title', '实时信号事件'));
  var logBody = el('div', 'card-body log-body');
  logCard.appendChild(logBody);
  right.appendChild(logCard);

  function showNode(id) {
    var n = nodeMap[id];
    infoBody.innerHTML = '';
    var keys = Object.keys(nodeEls);
    for (var k = 0; k < keys.length; k++) nodeEls[keys[k]].classList.toggle('sel', keys[k] === id);
    infoBody.appendChild(el('div', 'info-name', n.t));
    infoBody.appendChild(el('div', 'info-model', n.m));
    var hw = null;
    for (k = 0; k < HARDWARE.length; k++) if (HARDWARE[k].key === n.hw) hw = HARDWARE[k];
    if (hw) {
      infoBody.appendChild(el('div', 'info-fn', hw.fn));
      var ul = el('ul', 'info-specs');
      for (k = 0; k < hw.specs.length; k++) ul.appendChild(el('li', null, hw.specs[k]));
      infoBody.appendChild(ul);
      infoBody.appendChild(el('div', 'info-why', '选型依据：' + hw.why));
      infoBody.appendChild(el('div', 'info-src', '来源：' + hw.src));
    } else {
      infoBody.appendChild(el('div', 'info-fn', '该节点为输送/执行环节，详见"平台三维"视图中的对应零件。'));
    }
    var ins = [], outs = [];
    for (k = 0; k < EDGES.length; k++) {
      if (EDGES[k].t === id) ins.push(nodeMap[EDGES[k].f].t + ' → ' + EDGES[k].label);
      if (EDGES[k].f === id) outs.push(EDGES[k].label + ' → ' + nodeMap[EDGES[k].t].t);
    }
    if (ins.length) {
      infoBody.appendChild(el('div', 'info-sub', '输入信号'));
      var u1 = el('ul', 'info-specs');
      for (k = 0; k < ins.length; k++) u1.appendChild(el('li', null, ins[k]));
      infoBody.appendChild(u1);
    }
    if (outs.length) {
      infoBody.appendChild(el('div', 'info-sub', '输出信号'));
      var u2 = el('ul', 'info-specs');
      for (k = 0; k < outs.length; k++) u2.appendChild(el('li', null, outs[k]));
      infoBody.appendChild(u2);
    }
  }
  showNode('sync');

  /* ------------------- 动画 ------------------- */
  var lastEvIdx = 0;
  var lastLogLen = -1;

  function pulseEdges(kind) {
    for (var k = 0; k < edgeObjs.length; k++)
      if (edgeObjs[k].def.evt === kind) edgeObjs[k].pulses.push(0);
  }

  function drawScope() {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = scopeBox.clientWidth || 600;
    var chH = 26;
    var h = CHANNELS.length * chH + 26;
    scope.width = Math.round(w * dpr);
    scope.height = Math.round(h * dpr);
    scope.style.height = h + 'px';
    var ctx = scope.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var padL = 108, padR = 8;
    var iw = w - padL - padR;
    ctx.font = '11px "Segoe UI","Microsoft YaHei",system-ui';
    for (var c = 0; c < CHANNELS.length; c++) {
      var ch = CHANNELS[c];
      var y0 = 16 + c * chH;
      ctx.fillStyle = 'rgba(148,163,184,.9)';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(ch.label, padL - 8, y0 + chH / 2 - 2);
      ctx.strokeStyle = 'rgba(255,255,255,.06)';
      ctx.beginPath(); ctx.moveTo(padL, y0 + chH - 4); ctx.lineTo(w - padR, y0 + chH - 4); ctx.stroke();
      ctx.strokeStyle = ch.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      var arr = buf[ch.key];
      var prevY = null;
      for (var i2 = 0; i2 < SAMPLES; i2++) {
        var idx = (head + i2) % SAMPLES;
        var x = padL + iw * (i2 / (SAMPLES - 1));
        var yv = y0 + chH - 4 - (chH - 9) * arr[idx];
        if (i2 === 0) ctx.moveTo(x, yv);
        else {
          if (prevY !== null && Math.abs(prevY - yv) > 0.5) ctx.lineTo(x, prevY);
          ctx.lineTo(x, yv);
        }
        prevY = yv;
      }
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(226,232,240,.75)';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    var d = engine.derive();
    ctx.fillText('槽位周期 ' + fmt(d.slotPeriodMs, 2) + ' ms  ·  窗口 ' +
      fmt(SAMPLES * (d.slotPeriodMs / 24), 0) + ' ms  ·  时间缩放 ' + store.ui.timeScale + 'x', padL, 1);
  }

  function sample() {
    var d = engine.derive();
    var p = store.params;
    var frac = engine.counterFrac;
    var vals = {};
    vals.mcp = frac < 0.28 ? 1 : 0;
    var trig = 0, expo = 0;
    for (var i2 = 0; i2 < engine.flashes.length; i2++) {
      if (engine.flashes[i2].life > 0.55) trig = 1;
      if (engine.flashes[i2].life > 0.2) expo = 1;
    }
    vals.trig = trig;
    vals.expo = expo;
    vals.light = store.ui.running ? (expo ? 1 : 0.55) : 0;
    vals.gpu = engine.gpuBatch ? 1 : 0;
    var mb = 0;
    for (i2 = 0; i2 < engine.packets.length; i2++) if (engine.packets[i2].kind === 'modbus' && engine.packets[i2].life > 0.6) mb = 1;
    vals.modbus = mb;
    var doo = 0, jet = 0;
    for (i2 = 0; i2 < engine.jets.length; i2++) {
      var j = engine.jets[i2];
      if (j.life > 0.9) doo = 1;
      var age = (1 - j.life) * 90;
      if (age >= p.valveResponseMs - p.valveLeadMs && age <= p.valveResponseMs - p.valveLeadMs + p.valvePulseMs) jet = 1;
    }
    vals.do = doo;
    vals.jet = jet;
    for (var c = 0; c < CHANNELS.length; c++) buf[CHANNELS[c].key][head] = vals[CHANNELS[c].key] || 0;
    head = (head + 1) % SAMPLES;
  }

  function tick(dtReal) {
    // 事件 → 连线脉冲
    var evts = engine.events;
    if (evts.length < lastEvIdx) lastEvIdx = 0;
    for (var i2 = lastEvIdx; i2 < evts.length; i2++) pulseEdges(evts[i2].kind);
    lastEvIdx = evts.length;
    for (i2 = 0; i2 < engine.packets.length; i2++)
      if (engine.packets[i2].life > 0.985) pulseEdges(engine.packets[i2].kind);

    for (var k = 0; k < edgeObjs.length; k++) {
      var eo = edgeObjs[k];
      var maxP = -1;
      for (var q = eo.pulses.length - 1; q >= 0; q--) {
        eo.pulses[q] += dtReal * 1.5;
        if (eo.pulses[q] > 1) eo.pulses.splice(q, 1);
        else if (eo.pulses[q] > maxP) maxP = eo.pulses[q];
      }
      if (maxP >= 0) {
        try {
          var pt = eo.path.getPointAtLength(eo.len * clamp(maxP, 0, 1));
          eo.dot.setAttribute('cx', pt.x); eo.dot.setAttribute('cy', pt.y);
          eo.dot.setAttribute('opacity', '1');
        } catch (err) { }
        eo.path.setAttribute('opacity', '1');
        eo.path.setAttribute('stroke-width', '2.4');
      } else {
        eo.dot.setAttribute('opacity', '0');
        eo.path.setAttribute('opacity', '.42');
        eo.path.setAttribute('stroke-width', '1.7');
      }
    }
    if (store.ui.running) sample();
    drawScope();

    if (engine.events.length !== lastLogLen) {
      lastLogLen = engine.events.length;
      var list = engine.drainEvents(26);
      logBody.innerHTML = '';
      for (i2 = 0; i2 < list.length; i2++) {
        var ev = list[i2];
        var r = el('div', 'log-row k-' + ev.kind);
        r.appendChild(el('span', 'log-t', fmt(ev.t, 1) + 'ms'));
        r.appendChild(el('span', 'log-x', ev.text));
        logBody.appendChild(r);
      }
    }
  }

  setTimeout(layoutLabels, 30);
  window.addEventListener('resize', function () { setTimeout(layoutLabels, 20); });
  return { tick: tick, layout: layoutLabels, showNode: showNode };
}
