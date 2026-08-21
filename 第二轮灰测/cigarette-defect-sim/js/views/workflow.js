/**
 * workflow.js —— 七阶段工作流程（图2-11）+ PLC 槽位跟踪 + 剔除时序分析
 * 这里把论文 2.2.2「检测与剔除动作触发」的五个步骤做成可观测、可调参的动态模型：
 *   槽位标记 → 槽位队列前移 → 剔除时刻计算 → 阀响应/脉宽 → 命中/漏剔/误伤
 */
import { WORKFLOW_STAGES, DEFECT_CLASSES } from '../data/thesis-data.js';
import { STATIONS, TRUE_D2_TO_NOZZLE } from '../sim/engine.js';
import { fmt, pct, int, el, clamp } from '../core/store.js';
import { gantt } from '../ui/charts.js';

var STAGE_EVENT = {
  init: [], sync: ['sync', 'trigger'], infer: ['infer'], comm: ['modbus'],
  track: ['mark'], reject: ['do'], trace: ['trace'],
};

export function createWorkflow(host, store, engine) {
  host.innerHTML = '';
  var wrap = el('div', 'wf-wrap');
  host.appendChild(wrap);

  /* ---------- 1. 七阶段流水 ---------- */
  var flowCard = el('div', 'card');
  flowCard.appendChild(el('div', 'card-title', '整体工作流程 · 七阶段闭环（图2-11）'));
  var flow = el('div', 'wf-flow');
  flowCard.appendChild(flow);
  var stageEls = [];
  for (var i = 0; i < WORKFLOW_STAGES.length; i++) {
    var s = WORKFLOW_STAGES[i];
    var c = el('div', 'wf-stage');
    c.appendChild(el('div', 'wf-idx', String(s.idx)));
    c.appendChild(el('div', 'wf-name', s.name));
    c.appendChild(el('div', 'wf-chain', s.chain));
    var meter = el('div', 'wf-meter');
    var fill = el('div', 'wf-meter-fill');
    meter.appendChild(fill);
    c.appendChild(meter);
    c.appendChild(el('div', 'wf-count', '0'));
    (function (st, node) {
      node.addEventListener('click', function () { showStage(st.id); });
    })(s, c);
    flow.appendChild(c);
    stageEls.push({ def: s, node: c, fill: fill, count: c.querySelector('.wf-count'), act: 0 });
    if (i < WORKFLOW_STAGES.length - 1) flow.appendChild(el('div', 'wf-arrow', '›'));
  }
  wrap.appendChild(flowCard);

  var detailCard = el('div', 'card');
  detailCard.appendChild(el('div', 'card-title', '阶段说明'));
  var detailBody = el('div', 'card-body');
  detailCard.appendChild(detailBody);

  /* ---------- 2. 槽位跟踪可视化 ---------- */
  var slotCard = el('div', 'card');
  slotCard.appendChild(el('div', 'card-title', 'PLC 槽位跟踪 · 从检测工位到剔除工位（2.2.2 第三/四步）'));
  slotCard.appendChild(el('div', 'card-hint',
    '每个 MCP 脉冲槽位队列前移一次。机械真值 D2→喷嘴 = ' + TRUE_D2_TO_NOZZLE +
    ' 槽；若 PLC 参数「检测-剔除槽位差」或「视觉延迟补偿脉冲」与实际不符，标记就会落到相邻槽位 → 真缺陷漏剔 + 正常烟支误剔。'));
  var slotCanvasBox = el('div', 'slot-canvas-box');
  slotCard.appendChild(slotCanvasBox);
  var slotCv = document.createElement('canvas');
  slotCv.style.width = '100%'; slotCv.style.display = 'block';
  slotCanvasBox.appendChild(slotCv);
  var slotKpi = el('div', 'kpi-row');
  slotCard.appendChild(slotKpi);
  wrap.appendChild(slotCard);

  /* ---------- 3. 剔除时序分析 ---------- */
  var grid = el('div', 'wf-grid');
  wrap.appendChild(grid);

  var valveCard = el('div', 'card');
  valveCard.appendChild(el('div', 'card-title', '剔除动作时序 · 阀响应 / 脉宽 / 气流重叠'));
  valveCard.appendChild(el('div', 'card-hint',
    '脉冲过短 → 剔除力度不足（漏剔）；脉冲过长 → 阀未闭合而误伤相邻烟支。调气压与喷嘴间距会改变所需最小有效重叠。'));
  var valveBox = el('div', 'valve-box');
  valveCard.appendChild(valveBox);
  var valveCv = document.createElement('canvas');
  valveCv.style.width = '100%'; valveCv.style.display = 'block';
  valveBox.appendChild(valveCv);
  var valveVerdict = el('div', 'valve-verdict');
  valveCard.appendChild(valveVerdict);
  grid.appendChild(valveCard);

  var calCard = el('div', 'card');
  calCard.appendChild(el('div', 'card-title', '延迟补偿标定助手（2.2.2 检测延迟补偿）'));
  var calBody = el('div', 'card-body');
  calCard.appendChild(calBody);
  grid.appendChild(calCard);

  var ganttCard = el('div', 'card');
  ganttCard.appendChild(el('div', 'card-title', '单支烟支全链路时序（点击右侧记录可追踪）'));
  var ganttBox = el('div', 'gantt-box');
  ganttCard.appendChild(ganttBox);
  wrap.appendChild(ganttCard);
  var ganttChart = gantt(ganttBox, { rows: [], height: 220, empty: '启动仿真并等待第一支缺陷烟支通过剔除工位' });

  grid.appendChild(detailCard);

  function showStage(id) {
    var s = null;
    for (var k = 0; k < WORKFLOW_STAGES.length; k++) if (WORKFLOW_STAGES[k].id === id) s = WORKFLOW_STAGES[k];
    if (!s) return;
    for (k = 0; k < stageEls.length; k++) stageEls[k].node.classList.toggle('sel', stageEls[k].def.id === id);
    detailBody.innerHTML = '';
    detailBody.appendChild(el('div', 'info-name', '阶段 ' + s.idx + ' · ' + s.name));
    detailBody.appendChild(el('div', 'info-model', '闭环环节：' + s.chain));
    var tags = el('div', 'tag-row');
    for (k = 0; k < s.actors.length; k++) tags.appendChild(el('span', 'tag', s.actors[k]));
    detailBody.appendChild(tags);
    detailBody.appendChild(el('div', 'info-fn', s.detail));
  }
  showStage('track');

  /* ---------- 绘制：槽位条 ---------- */
  function drawSlots() {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = slotCanvasBox.clientWidth || 700;
    var h = 168;
    slotCv.width = Math.round(w * dpr); slotCv.height = Math.round(h * dpr);
    slotCv.style.height = h + 'px';
    var ctx = slotCv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var padL = 14, padR = 14;
    var iw = w - padL - padR;
    var N = STATIONS.EXIT;
    var sx = function (slot) { return padL + iw * (slot / N); };
    ctx.font = '11px "Segoe UI","Microsoft YaHei",system-ui';

    // 输送轨道
    var yTrack = 96;
    ctx.strokeStyle = 'rgba(255,255,255,.13)'; ctx.lineWidth = 16;
    ctx.beginPath(); ctx.moveTo(sx(0), yTrack); ctx.lineTo(sx(N), yTrack); ctx.stroke();
    // 鼓轮分段
    var segs = [[0, 12, '料斗鼓轮'], [12, 24, '接驳轮1 (下组)'], [24, 36, '接驳轮2 (上组)'], [36, 48, '剔除轮'], [48, N, '收集']];
    for (var i2 = 0; i2 < segs.length; i2++) {
      var g0 = sx(segs[i2][0]), g1 = sx(segs[i2][1]);
      ctx.fillStyle = i2 % 2 ? 'rgba(80,110,150,.16)' : 'rgba(80,110,150,.09)';
      ctx.fillRect(g0, yTrack - 8, g1 - g0, 16);
      ctx.fillStyle = 'rgba(148,163,184,.8)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(segs[i2][2], (g0 + g1) / 2, yTrack + 14);
      ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(g1, yTrack - 12); ctx.lineTo(g1, yTrack + 12); ctx.stroke();
    }
    // 工位
    var st = [[STATIONS.D1, 'D1', '#63f5c8'], [STATIONS.D2, 'D2', '#63f5c8'], [STATIONS.NOZZLE, '喷嘴', '#ff5b6e']];
    for (i2 = 0; i2 < st.length; i2++) {
      var x = sx(st[i2][0]);
      ctx.strokeStyle = st[i2][2]; ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(x, 34); ctx.lineTo(x, yTrack + 24); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = st[i2][2]; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(st[i2][1] + ' (slot ' + st[i2][0] + ')', x, 32);
    }
    // 烟支
    for (i2 = 0; i2 < engine.cigs.length; i2++) {
      var c = engine.cigs[i2];
      var cx2 = sx(c.slotPos);
      var col = '#cfd6e2';
      if (c.trueClass !== null) col = store.ui.showTruth ? '#ffb74d' : col;
      if (c.verdict === 'NG') col = '#ff5b6e';
      if (c.ejected) col = '#ff2d55';
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(cx2, yTrack + (c.ejected ? 22 : 0), c.ejected ? 3 : 4.2, 0, Math.PI * 2);
      ctx.fill();
      if (c.verdict === 'NG' && !c.ejected) {
        ctx.strokeStyle = 'rgba(255,91,110,.85)'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(cx2, yTrack, 7.5, 0, Math.PI * 2); ctx.stroke();
      }
    }
    // PLC 槽位队列（从 D2 到喷嘴的标记）
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var keys = Object.keys(engine.plcSlots);
    var yQ = 56;
    ctx.fillStyle = 'rgba(148,163,184,.85)';
    ctx.textAlign = 'left';
    ctx.fillText('PLC 待剔除标记（' + keys.length + '）', padL, yQ - 18);
    for (i2 = 0; i2 < keys.length; i2++) {
      var mk = engine.plcSlots[keys[i2]];
      var remain = mk.fireCounter - engine.counter;
      var slotPosApprox = STATIONS.NOZZLE - remain;
      var mx = sx(clamp(slotPosApprox, 0, N));
      var bad = mk.slotError !== 0;
      ctx.fillStyle = bad ? 'rgba(255,91,110,.9)' : 'rgba(77,184,255,.9)';
      ctx.beginPath();
      ctx.moveTo(mx, yQ + 8); ctx.lineTo(mx - 5, yQ - 2); ctx.lineTo(mx + 5, yQ - 2);
      ctx.closePath(); ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillStyle = bad ? 'rgba(255,140,150,.95)' : 'rgba(140,200,255,.95)';
      ctx.fillText('#' + mk.cig.id + (bad ? (' Δ' + (mk.slotError > 0 ? '+' : '') + mk.slotError) : ''), mx, yQ - 10);
    }
    // 计数器
    ctx.fillStyle = 'rgba(226,232,240,.9)';
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillText('MCP 计数 ' + int(engine.counter) + '   DCP ' + int(engine.dcpCount), w - padR, 2);
  }

  /* ---------- 绘制：阀时序 ---------- */
  function drawValve() {
    var d = engine.derive();
    var p = store.params;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = valveBox.clientWidth || 460;
    var h = 178;
    valveCv.width = Math.round(w * dpr); valveCv.height = Math.round(h * dpr);
    valveCv.style.height = h + 'px';
    var ctx = valveCv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var slotMs = d.slotPeriodMs;
    var passMs = slotMs * 0.6;
    var jetStart = p.valveResponseMs - p.valveLeadMs;
    var jetEnd = jetStart + p.valvePulseMs;
    // DO 输出时刻（t = 0）目标烟支中心正对喷嘴 → 通过窗口以 0 为中心
    var winA = -passMs / 2, winB = passMs / 2;
    var nbA = slotMs - passMs / 2, nbB = slotMs + passMs / 2;
    var tMin = Math.min(winA, jetStart) - slotMs * 0.12;
    var tMax = Math.max(jetEnd, nbB, slotMs * 1.25) + slotMs * 0.08;
    var padL = 100, padR = 48, padT = 20;
    var iw = w - padL - padR;
    var X = function (t) { return padL + iw * ((t - tMin) / (tMax - tMin)); };
    ctx.font = '11px "Segoe UI","Microsoft YaHei",system-ui';

    // 时间轴
    ctx.strokeStyle = 'rgba(255,255,255,.10)';
    for (var g = 0; g <= 6; g++) {
      var tv = tMin + (tMax - tMin) * g / 6;
      var x = X(tv);
      ctx.beginPath(); ctx.moveTo(x, padT - 6); ctx.lineTo(x, h - 20); ctx.stroke();
      ctx.fillStyle = 'rgba(148,163,184,.8)'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(fmt(tv, 1), x, padT - 8);
    }
    ctx.fillStyle = 'rgba(148,163,184,.8)'; ctx.textAlign = 'right';
    ctx.fillText('ms', padL - 6, padT - 8);
    // t = 0 基准线（DO 输出 = 烟支中心到位）
    ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(X(0), padT - 4); ctx.lineTo(X(0), h - 18); ctx.stroke();
    ctx.setLineDash([]);

    var rows = [
      { label: 'PLC DO 输出', from: 0, to: Math.max(0.4, slotMs * 0.03), color: '#ff5b6e' },
      { label: '阀开启（气流）', from: jetStart, to: jetEnd, color: '#7fe0ff' },
      { label: '目标烟支在喷嘴区', from: winA, to: winB, color: '#3ddc84' },
      { label: '相邻烟支进入', from: nbA, to: nbB, color: '#ffb74d' },
    ];
    var rh = 30;
    for (var i2 = 0; i2 < rows.length; i2++) {
      var r = rows[i2];
      var y = padT + 8 + i2 * rh;
      ctx.fillStyle = 'rgba(148,163,184,.9)'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(r.label, padL - 8, y + 9);
      ctx.fillStyle = 'rgba(255,255,255,.05)';
      ctx.fillRect(padL, y + 2, iw, 15);
      ctx.fillStyle = r.color;
      var x0 = X(Math.max(tMin, r.from)), x1 = X(Math.min(tMax, r.to));
      ctx.globalAlpha = 0.82;
      ctx.fillRect(x0, y + 2, Math.max(2, x1 - x0), 15);
      ctx.globalAlpha = 1;
    }
    // 重叠区
    var ov0 = Math.max(jetStart, winA), ov1 = Math.min(jetEnd, winB);
    var overlap = Math.max(0, ov1 - ov0);
    var need = 2.2 * (4.5 / Math.max(0.5, p.airPressureBar)) * (p.nozzleGapMm / 6.0);
    if (overlap > 0) {
      ctx.fillStyle = 'rgba(61,220,132,.22)';
      ctx.fillRect(X(ov0), padT + 8, X(ov1) - X(ov0), rh * 4 - 12);
      ctx.strokeStyle = 'rgba(61,220,132,.7)'; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(X(ov0), padT + 4); ctx.lineTo(X(ov0), h - 20); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X(ov1), padT + 4); ctx.lineTo(X(ov1), h - 20); ctx.stroke();
      ctx.setLineDash([]);
    }
    var ok = overlap >= need;
    var neighbor = jetEnd > nbA;
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = ok ? 'rgba(61,220,132,.95)' : 'rgba(255,91,110,.95)';
    ctx.fillText('有效重叠 ' + fmt(overlap, 2) + ' ms / 所需 ' + fmt(need, 2) + ' ms', padL, h - 4);

    valveVerdict.innerHTML = '';
    var v1 = el('span', 'verdict ' + (ok ? 'good' : 'bad'), ok ? '剔除可靠' : '剔除力度不足 → 漏剔');
    valveVerdict.appendChild(v1);
    var v2 = el('span', 'verdict ' + (neighbor ? 'bad' : 'good'),
      neighbor ? '脉宽过长 → 误伤相邻烟支' : '不影响相邻烟支');
    valveVerdict.appendChild(v2);
    var eCfg = p.detectToRejectSlots - TRUE_D2_TO_NOZZLE;
    var v3 = el('span', 'verdict ' + (eCfg === 0 ? 'good' : 'bad'),
      eCfg === 0 ? '槽位差匹配机械真值' : '槽位差偏差 ' + (eCfg > 0 ? '+' : '') + eCfg + ' 槽');
    valveVerdict.appendChild(v3);
  }

  /* ---------- 标定助手 ---------- */
  function drawCal() {
    var d = engine.derive();
    var p = store.params;
    var m = engine.measured();
    calBody.innerHTML = '';
    var rowsData = [
      ['槽位周期（60000 / 节拍）', fmt(d.slotPeriodMs, 3) + ' ms', ''],
      ['视觉链路名义延迟', fmt(d.visionNominalMs, 2) + ' ms', 'GigE + 预处理 + 推理 + 后处理'],
      ['实测平均视觉延迟', fmt(m.avgLatency, 2) + ' ms', '含批量排队等待'],
      ['Modbus TCP 往返', fmt(p.modbusMs, 2) + ' ms', ''],
      ['槽位对齐方式', p.trackMode === 'id' ? '按检测编号对齐' : '按补偿脉冲折算',
        p.trackMode === 'id' ? '对延迟抖动免疫（寄存器携带检测编号）' : '需现场标定，抖动会造成错位'],
      ['理论补偿脉冲数', String(d.idealCompensation) + ' 脉冲', 'round((视觉延迟 + Modbus) / 槽位周期)'],
      ['当前补偿脉冲数', String(p.compensationPulses) + ' 脉冲',
        p.trackMode === 'pulse'
          ? (p.compensationPulses === d.idealCompensation ? '匹配' : '偏差 ' + (p.compensationPulses - d.idealCompensation))
          : '（编号对齐模式下不生效）'],
      ['机械槽位差真值', TRUE_D2_TO_NOZZLE + ' 槽', 'D2 检测工位 → 剔除喷嘴'],
      ['PLC 槽位差参数', String(p.detectToRejectSlots) + ' 槽',
        p.detectToRejectSlots === TRUE_D2_TO_NOZZLE ? '匹配' : '偏差 ' + (p.detectToRejectSlots - TRUE_D2_TO_NOZZLE)],
      ['结果接收窗口', String(p.resultWindowSlots) + ' 槽',
        '超窗策略：' + ({ alarm: '报警', stop: '停机', reject: '按异常品剔除' })[p.timeoutPolicy]],
    ];
    var tb = el('table', 'mini-table');
    for (var i2 = 0; i2 < rowsData.length; i2++) {
      var tr = el('tr');
      tr.appendChild(el('td', 'k', rowsData[i2][0]));
      tr.appendChild(el('td', 'v', rowsData[i2][1]));
      tr.appendChild(el('td', 'n', rowsData[i2][2]));
      tb.appendChild(tr);
    }
    calBody.appendChild(tb);
    var btns = el('div', 'btn-row');
    var b1 = el('button', 'btn btn-primary', '一键标定补偿脉冲');
    b1.addEventListener('click', function () {
      var dd = engine.derive();
      var mm = engine.measured();
      var ideal = Math.round(((mm.avgLatency || dd.visionNominalMs) + store.params.modbusMs) / dd.slotPeriodMs);
      store.setParam('compensationPulses', ideal);
    });
    btns.appendChild(b1);
    var b2 = el('button', 'btn', '槽位差归零（= ' + TRUE_D2_TO_NOZZLE + '）');
    b2.addEventListener('click', function () { store.setParam('detectToRejectSlots', TRUE_D2_TO_NOZZLE); });
    btns.appendChild(b2);
    calBody.appendChild(btns);
  }

  /* ---------- KPI ---------- */
  function drawKpi() {
    var s = engine.stats;
    var m = engine.measured();
    var items = [
      ['剔除动作命中率', pct(m.rejectAcc, 1), m.rejectAcc > 0.98 ? 'good' : (m.rejectAcc > 0.9 ? 'warn' : 'bad')],
      ['缺陷逃逸率', pct(m.escapeRate, 2), m.escapeRate < 0.16 ? 'good' : 'bad'],
      ['正常品误剔率', pct(m.falseRejectRate, 3), m.falseRejectRate < 0.02 ? 'good' : 'bad'],
      ['气流命中', int(s.rejectOk), 'good'],
      ['漏剔（未吹中）', int(s.rejectMiss), s.rejectMiss ? 'bad' : 'good'],
      ['误吹（打错烟支）', int(s.rejectFalse), s.rejectFalse ? 'warn' : 'good'],
      ['误伤相邻', int(s.neighborHit), s.neighborHit ? 'bad' : 'good'],
      ['槽位错位', int(s.slotMismatch), s.slotMismatch ? 'bad' : 'good'],
      ['结果迟到', int(s.lateFire), s.lateFire ? 'bad' : 'good'],
      ['结果超窗', int(s.timeoutEvents), s.timeoutEvents ? 'bad' : 'good'],
      ['队列丢帧', int(s.droppedFrames), s.droppedFrames ? 'bad' : 'good'],
      ['图像队列峰值', int(s.queuePeak), s.queuePeak > store.params.queueCapacity * 2 ? 'bad' : 'good'],
    ];
    slotKpi.innerHTML = '';
    for (var i2 = 0; i2 < items.length; i2++) {
      var k = el('div', 'kpi ' + items[i2][2]);
      k.appendChild(el('div', 'kpi-v', items[i2][1]));
      k.appendChild(el('div', 'kpi-k', items[i2][0]));
      slotKpi.appendChild(k);
    }
  }

  /* ---------- 阶段活跃度 ---------- */
  var lastEvIdx = 0;
  var stageCounts = { init: 1, sync: 0, infer: 0, comm: 0, track: 0, reject: 0, trace: 0 };
  function tickStages(dtReal) {
    var evts = engine.events;
    if (evts.length < lastEvIdx) lastEvIdx = 0;
    for (var i2 = lastEvIdx; i2 < evts.length; i2++) {
      var kind = evts[i2].kind;
      for (var sid in STAGE_EVENT) {
        if (STAGE_EVENT[sid].indexOf(kind) >= 0) {
          stageCounts[sid]++;
          for (var q = 0; q < stageEls.length; q++) if (stageEls[q].def.id === sid) stageEls[q].act = 1;
        }
      }
    }
    lastEvIdx = evts.length;
    stageCounts.trace = engine.records.length;
    for (i2 = 0; i2 < stageEls.length; i2++) {
      var se = stageEls[i2];
      se.act = Math.max(0, se.act - dtReal * 2.2);
      se.fill.style.width = (se.act * 100).toFixed(0) + '%';
      se.node.classList.toggle('active', se.act > 0.05);
      var cv = stageCounts[se.def.id] || 0;
      if (se.count.textContent !== String(cv)) se.count.textContent = String(cv);
    }
  }

  /* ---------- Gantt ---------- */
  var lastGanttId = null;
  function tickGantt() {
    var rec = null;
    var followId = store.ui.followCigarette;
    if (followId) {
      for (var i2 = 0; i2 < engine.records.length; i2++) if (engine.records[i2].id === followId) rec = engine.records[i2];
    }
    if (!rec && engine.records.length) rec = engine.records[0];
    if (!rec) return;
    if (lastGanttId === rec.id) return;
    lastGanttId = rec.id;
    var p = store.params;
    var d = engine.derive();
    var t = 0;
    var rows = [];
    function push(label, dur, color) { rows.push({ label: label, start: t, end: t + dur, color: color }); t += dur; }
    push('硬件触发 + 曝光', d.exposureMs, '#63f5c8');
    push('GigE 图像传输', p.gigeTransferMs, '#ffe066');
    var queueWait = Math.max(0, (rec.latency || d.visionNominalMs) - (p.gigeTransferMs + p.preprocessMs + d.msPerImage * Math.max(1, p.camerasPerCigarette / 2) + p.postprocessMs));
    push('队列等待（批量聚合）', queueWait, '#8a93a8');
    push('预处理（尺寸/归一化）', p.preprocessMs, '#b083d6');
    push('YOLOv11 前向推理', d.msPerImage * Math.max(1, Math.round(p.camerasPerCigarette / 2)), '#4db8ff');
    push('后处理（筛选 + NMS）', p.postprocessMs, '#e8a33a');
    push('Modbus TCP 通信', p.modbusMs, '#2fbf71');
    push('PLC 槽位跟踪', Math.max(0, (p.detectToRejectSlots - p.compensationPulses)) * d.slotPeriodMs, '#6b7382');
    push('阀响应', p.valveResponseMs, '#ff8a3d');
    push('气流剔除', p.valvePulseMs, '#ff5b6e');
    ganttChart.setCfg({
      rows: rows,
      title: '烟支 #' + rec.id + ' · ' + (rec.cls !== null && rec.cls !== undefined ? DEFECT_CLASSES[rec.cls].name : '—')
        + ' · 结果 ' + ({ rejectOk: '剔除成功', rejectMiss: '漏剔', rejectFalse: '误剔', pass: '放行' })[rec.outcome || 'pass'],
    });
  }

  var accum = 0;
  function tick(dtReal) {
    tickStages(dtReal);
    accum += dtReal;
    drawSlots();
    if (accum > 0.2) {
      accum = 0;
      drawValve();
      drawCal();
      drawKpi();
      tickGantt();
    }
  }
  store.on('param', function () { drawValve(); drawCal(); });
  drawValve(); drawCal(); drawKpi();
  return { tick: tick, showStage: showStage };
}
