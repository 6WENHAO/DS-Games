/**
 * main.js —— 应用外壳：视图路由、全局参数总线、工况预设、主循环
 */
import { store, el, fmt, pct, int, hhmmss, clamp } from './core/store.js';
import { SimEngine, TRUE_D2_TO_NOZZLE, STATIONS } from './sim/engine.js';
import { createPlatform3D, PART_META } from './views/platform3d.js';
import { createElectrical } from './views/electrical.js';
import { createWorkflow } from './views/workflow.js';
import { createAlgorithm } from './views/algorithm.js';
import { createDeploy } from './views/deploy.js';
import { createHMI } from './views/hmi.js';
import { createTrace } from './views/trace.js';
import { MODELS, HARDWARE, THESIS_META, DEFECT_CLASSES, modelByKey } from './data/thesis-data.js';

var engine = new SimEngine(store);
window.__sim = { store: store, engine: engine };
store.ui.showTruth = false;

/* =================================================================== */
/* 视图定义                                                            */
/* =================================================================== */
var VIEWS = [
  { key: 'platform', icon: '◧', name: '平台三维', sub: '可拆解模型 · 第二章 2.1' },
  { key: 'electrical', icon: '⚡', name: '电气原理', sub: '信号流 + 示波器 · 图2-10' },
  { key: 'workflow', icon: '⟳', name: '工作流程', sub: '七阶段 + 槽位跟踪 · 2.2' },
  { key: 'algorithm', icon: '◈', name: '检测算法', sub: 'YOLOv11 消融 · 第三章' },
  { key: 'deploy', icon: '⬢', name: '推理部署', sub: '三层架构 + FP16 · 4.1' },
  { key: 'hmi', icon: '▤', name: '人机界面', sub: 'PySide6 复刻 · 4.2' },
  { key: 'trace', icon: '⌸', name: '数据追溯', sub: '记录 + 自校验 · 阶段7' },
];

var stage = document.getElementById('stage');
var sections = {}, instances = {}, builders = {};
for (var i = 0; i < VIEWS.length; i++) {
  var sec = el('section', 'view');
  sec.dataset.view = VIEWS[i].key;
  stage.appendChild(sec);
  sections[VIEWS[i].key] = sec;
}

/* ---- 平台三维：左侧拆解面板 + 右侧画布 ---- */
(function buildPlatformShell() {
  var sec = sections.platform;
  var layout = el('div', 'p3d-layout');
  var side = el('div', 'p3d-side');
  var canvas = el('div', 'p3d-canvas');
  canvas.id = 'p3d-canvas';
  layout.appendChild(side);
  layout.appendChild(canvas);
  sec.appendChild(layout);
  builders.platform = function () {
    var api = createPlatform3D(canvas, store, engine);
    buildBOM(side, api);
    return { tick: function () { }, api: api };
  };
})();

builders.electrical = function () { return createElectrical(sections.electrical, store, engine); };
builders.workflow = function () { return createWorkflow(sections.workflow, store, engine); };
builders.algorithm = function () { return createAlgorithm(sections.algorithm, store, engine); };
builders.deploy = function () { return createDeploy(sections.deploy, store, engine); };
builders.hmi = function () { return createHMI(sections.hmi, store, engine); };
builders.trace = function () { return createTrace(sections.trace, store, engine); };

/* =================================================================== */
/* 拆解面板（BOM 树 / 爆炸 / 分区 / 视角 / 零件详情）                    */
/* =================================================================== */
var ZONES = ['输送机构', '检测区域', '控制区域', '执行区域'];
function buildBOM(side, api) {
  side.innerHTML = '';

  // 爆炸滑块
  var exCard = el('div', 'card tight');
  exCard.appendChild(el('div', 'card-title', '拆解 / 爆炸视图'));
  var exRow = el('div', 'range-row');
  var exTop = el('div', 'range-top');
  exTop.appendChild(el('span', null, '爆炸程度'));
  var exVal = el('span', 'range-val', '0%');
  exTop.appendChild(exVal);
  exRow.appendChild(exTop);
  var exInp = document.createElement('input');
  exInp.type = 'range'; exInp.min = 0; exInp.max = 1; exInp.step = 0.01; exInp.value = 0;
  exInp.addEventListener('input', function () {
    store.setUI('explode', parseFloat(exInp.value));
    exVal.textContent = Math.round(exInp.value * 100) + '%';
  });
  exRow.appendChild(exInp);
  exCard.appendChild(exRow);
  var exBtns = el('div', 'btn-row');
  [['合拢', 0], ['半拆', 0.45], ['全拆', 1]].forEach(function (p) {
    var b = el('button', 'btn btn-sm', p[0]);
    b.addEventListener('click', function () {
      exInp.value = p[1];
      store.setUI('explode', p[1]);
      exVal.textContent = Math.round(p[1] * 100) + '%';
    });
    exBtns.appendChild(b);
  });
  exCard.appendChild(exBtns);
  var toggles = el('div', 'chk-row');
  [['labels', '零件标签'], ['wireframe', '线框模式'], ['showTruth', '显示来料真值']].forEach(function (t) {
    var lab = el('label', 'chk');
    var c = document.createElement('input');
    c.type = 'checkbox';
    c.checked = !!store.ui[t[0]];
    c.addEventListener('change', function () { store.setUI(t[0], c.checked); });
    lab.appendChild(c);
    lab.appendChild(el('span', null, t[1]));
    toggles.appendChild(lab);
  });
  exCard.appendChild(toggles);
  side.appendChild(exCard);

  // 视角预设
  var vCard = el('div', 'card tight');
  vCard.appendChild(el('div', 'card-title', '视角'));
  var vRow = el('div', 'btn-grid');
  [['overview', '总览'], ['detect', '检测区'], ['reject', '剔除工位'], ['control', '控制箱'],
   ['sync', '同步传感器'], ['top', '俯视'], ['front', '正视']].forEach(function (v) {
    var b = el('button', 'btn btn-sm', v[1]);
    b.addEventListener('click', function () { api.flyTo(v[0]); });
    vRow.appendChild(b);
  });
  vCard.appendChild(vRow);
  side.appendChild(vCard);

  // BOM 树
  var bCard = el('div', 'card tight grow');
  bCard.appendChild(el('div', 'card-title', 'BOM 结构树 · 点击定位 / 复选框隐藏'));
  var tree = el('div', 'bom-tree');
  var partRows = {};
  for (var z = 0; z < ZONES.length; z++) {
    var zone = ZONES[z];
    var zg = el('div', 'bom-zone');
    var zh = el('div', 'bom-zone-head');
    var zchk = document.createElement('input');
    zchk.type = 'checkbox'; zchk.checked = true;
    (function (zn, cb) {
      cb.addEventListener('change', function () {
        var zz = Object.assign({}, store.ui.zones);
        zz[zn] = cb.checked;
        store.setUI('zones', zz);
      });
    })(zone, zchk);
    zh.appendChild(zchk);
    zh.appendChild(el('span', 'bom-zone-name', zone));
    var cnt = 0;
    for (var k in PART_META) if (PART_META[k].zone === zone) cnt++;
    zh.appendChild(el('span', 'bom-count', String(cnt)));
    zg.appendChild(zh);
    for (k in PART_META) {
      if (PART_META[k].zone !== zone) continue;
      var pm = PART_META[k];
      var row = el('div', 'bom-part');
      var chk = document.createElement('input');
      chk.type = 'checkbox'; chk.checked = true;
      (function (key, cb) {
        cb.addEventListener('click', function (ev) { ev.stopPropagation(); });
        cb.addEventListener('change', function () { api.setVisible(key, cb.checked); });
      })(k, chk);
      row.appendChild(chk);
      var txt = el('div', 'bom-part-txt');
      txt.appendChild(el('div', 'bom-part-name', pm.name));
      txt.appendChild(el('div', 'bom-part-model', pm.model));
      row.appendChild(txt);
      (function (key) {
        row.addEventListener('click', function () { store.setUI('selected', key); api.focus(key); });
      })(k);
      zg.appendChild(row);
      partRows[k] = row;
    }
    tree.appendChild(zg);
  }
  bCard.appendChild(tree);
  side.appendChild(bCard);

  // 零件详情
  var dCard = el('div', 'card tight');
  dCard.appendChild(el('div', 'card-title', '零件详情'));
  var dBody = el('div', 'card-body');
  dCard.appendChild(dBody);
  side.appendChild(dCard);

  function renderDetail(key) {
    dBody.innerHTML = '';
    if (!key || !PART_META[key]) {
      dBody.appendChild(el('div', 'muted small', '在三维视图中点击任意零件，或在上方 BOM 树中选择。'));
      return;
    }
    var pm = PART_META[key];
    dBody.appendChild(el('div', 'info-name', pm.name));
    dBody.appendChild(el('div', 'info-model', pm.model));
    var zt = el('span', 'tag zone-' + ZONES.indexOf(pm.zone), pm.zone);
    dBody.appendChild(zt);
    dBody.appendChild(el('div', 'info-fn', pm.fn));
    var hw = null;
    for (var q = 0; q < HARDWARE.length; q++) {
      if (HARDWARE[q].model === pm.model || (pm.model && HARDWARE[q].model.indexOf(pm.model.split(' ')[0]) === 0 && HARDWARE[q].name === pm.name.split('（')[0])) hw = HARDWARE[q];
    }
    if (hw) {
      var ul = el('ul', 'info-specs');
      for (q = 0; q < hw.specs.length; q++) ul.appendChild(el('li', null, hw.specs[q]));
      dBody.appendChild(ul);
      dBody.appendChild(el('div', 'info-why', '选型依据：' + hw.why));
    }
    dBody.appendChild(el('div', 'info-src', '论文出处：' + pm.src));
  }
  store.on('ui', function (e) {
    if (e.key === 'selected') {
      renderDetail(e.value);
      for (var k2 in partRows) partRows[k2].classList.toggle('sel', k2 === e.value);
    }
    if (e.key === 'explode') {
      exInp.value = store.ui.explode;
      exVal.textContent = Math.round(store.ui.explode * 100) + '%';
    }
  });
  store.on('p3d-hover', function (k) {
    for (var k2 in partRows) partRows[k2].classList.toggle('hover', k2 === k);
  });
  renderDetail(null);
}

/* =================================================================== */
/* 顶栏                                                                */
/* =================================================================== */
var topEls = {};
(function buildTop() {
  var top = document.getElementById('top');
  var brand = el('div', 'brand');
  brand.appendChild(el('div', 'brand-mark', 'CDD'));
  var bt = el('div', 'brand-txt');
  bt.appendChild(el('div', 'brand-t', '可移动烟支外观缺陷离线检测与剔除系统 · 网页建模与仿真'));
  bt.appendChild(el('div', 'brand-s', THESIS_META.chain + '　|　基于改进的 YOLOv11（' + THESIS_META.author + '，指导：' + THESIS_META.advisor + '）'));
  brand.appendChild(bt);
  top.appendChild(brand);

  var stats = el('div', 'top-stats');
  var keys = [
    ['cpm', '节拍 支/min'], ['inspected', '已检'], ['rejected', '已剔除'],
    ['escape', '逃逸率'], ['util', 'GPU'], ['fps', 'FPS'], ['lat', '视觉延迟'],
  ];
  for (var i2 = 0; i2 < keys.length; i2++) {
    var c = el('div', 'tstat');
    var v = el('div', 'tstat-v', '—');
    c.appendChild(v);
    c.appendChild(el('div', 'tstat-k', keys[i2][1]));
    stats.appendChild(c);
    topEls[keys[i2][0]] = { v: v, c: c };
  }
  top.appendChild(stats);

  var ctrl = el('div', 'top-ctrl');
  var runBtn = el('button', 'btn btn-run', '▶ 启动');
  runBtn.addEventListener('click', function () { store.setUI('running', !store.ui.running); });
  ctrl.appendChild(runBtn);
  topEls.runBtn = runBtn;
  var resetBtn = el('button', 'btn', '↺ 复位');
  resetBtn.addEventListener('click', function () {
    engine.reset();
    toast('仿真已复位（参数保留）');
  });
  ctrl.appendChild(resetBtn);
  var segs = el('div', 'seg-row');
  [[0.05, '0.05x'], [0.2, '0.2x'], [1, '1x'], [5, '5x'], [20, '20x']].forEach(function (s) {
    var b = el('button', 'seg', s[1]);
    b.addEventListener('click', function () { store.setUI('timeScale', s[0]); });
    b.dataset.scale = s[0];
    segs.appendChild(b);
  });
  ctrl.appendChild(segs);
  topEls.segs = segs;
  top.appendChild(ctrl);
})();

/* =================================================================== */
/* 左侧导航                                                            */
/* =================================================================== */
(function buildRail() {
  var rail = document.getElementById('rail');
  for (var i2 = 0; i2 < VIEWS.length; i2++) {
    var v = VIEWS[i2];
    var b = el('button', 'rail-btn');
    b.appendChild(el('span', 'rail-icon', v.icon));
    var t = el('span', 'rail-txt');
    t.appendChild(el('span', 'rail-name', v.name));
    t.appendChild(el('span', 'rail-sub', v.sub));
    b.appendChild(t);
    b.dataset.view = v.key;
    (function (k) { b.addEventListener('click', function () { store.setUI('view', k); }); })(v.key);
    rail.appendChild(b);
  }
})();

/* =================================================================== */
/* 右侧参数坞                                                          */
/* =================================================================== */
function rangeRow(parent, label, key, min, max, step, fmtFn, hint) {
  var row = el('div', 'range-row');
  var top = el('div', 'range-top');
  top.appendChild(el('span', null, label));
  var val = el('span', 'range-val');
  top.appendChild(val);
  row.appendChild(top);
  var inp = document.createElement('input');
  inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step;
  row.appendChild(inp);
  if (hint) row.appendChild(el('div', 'range-hint', hint));
  parent.appendChild(row);
  function sync() {
    inp.value = store.params[key];
    val.textContent = fmtFn ? fmtFn(store.params[key]) : String(store.params[key]);
  }
  inp.addEventListener('input', function () { store.setParam(key, parseFloat(inp.value)); });
  store.on('param', sync);
  sync();
  return row;
}
function selectRow(parent, label, key, options, hint) {
  var row = el('div', 'sel-row');
  row.appendChild(el('span', 'sel-label', label));
  var sel = document.createElement('select');
  for (var i2 = 0; i2 < options.length; i2++) {
    var o = document.createElement('option');
    o.value = options[i2][0];
    o.textContent = options[i2][1];
    sel.appendChild(o);
  }
  row.appendChild(sel);
  if (hint) row.appendChild(el('div', 'range-hint', hint));
  parent.appendChild(row);
  function sync() { sel.value = String(store.params[key]); }
  sel.addEventListener('change', function () {
    var v = sel.value;
    var n = parseFloat(v);
    store.setParam(key, (!isNaN(n) && String(n) === v) ? n : v);
  });
  store.on('param', sync);
  sync();
  return row;
}
function group(parent, title, hint) {
  var g = el('div', 'dock-group');
  var h = el('div', 'dock-group-head');
  h.appendChild(el('span', 'dock-group-t', title));
  var caret = el('span', 'dock-caret', '▾');
  h.appendChild(caret);
  g.appendChild(h);
  var body = el('div', 'dock-group-body');
  if (hint) body.appendChild(el('div', 'dock-hint', hint));
  g.appendChild(body);
  h.addEventListener('click', function () {
    g.classList.toggle('collapsed');
    caret.textContent = g.classList.contains('collapsed') ? '▸' : '▾';
  });
  parent.appendChild(g);
  return body;
}

var PRESETS = [
  {
    name: '标称工况', desc: '论文推荐配置：EIoU + FP16，补偿脉冲与槽位差均已标定',
    apply: function () {
      store.reset();
      store.setParam('modelKey', 'eiou');
      store.setParam('precision', 'fp16');
      store.setParam('detectToRejectSlots', TRUE_D2_TO_NOZZLE);
      var d = engine.derive();
      store.setParam('compensationPulses', d.idealCompensation);
      engine.reset();
    },
    watch: '观察：剔除准确率应接近 100%，实测 P/R 收敛于表3-7 的 0.9255 / 0.8891。',
  },
  {
    name: 'GPU 过载', desc: '节拍拉到 8000 支/分钟，图像速率超出 FP16 吞吐上限',
    apply: function () { store.setParam('throughputCPM', 8000); },
    watch: '观察：图像队列涨满并开始丢帧 → 视觉延迟上升 → PLC 结果超窗触发安全策略（推理部署页可看利用率>100%）。',
  },
  {
    name: '脉冲折算抖动', desc: '槽位对齐改为"补偿脉冲折算"，暴露延迟抖动敏感性',
    apply: function () { store.setParam('trackMode', 'pulse'); },
    watch: '观察：视觉延迟在一个槽位周期附近抖动时，固定补偿脉冲无法总是命中 → 槽位错位次数上升。'
      + '这正是论文强调"该延迟通常较为固定、可通过现场标定补偿"的前提条件。',
  },
  {
    name: '槽位差错配', desc: 'PLC 槽位差设为 18（机械真值 15），标记落到下游第 3 槽',
    apply: function () { store.setParam('detectToRejectSlots', 18); },
    watch: '观察：工作流程页"槽位错位"计数上升，真缺陷漏剔同时误吹相邻正常烟支。',
  },
  {
    name: '阀脉宽不足', desc: '剔除脉宽压到 2 ms，气流有效重叠小于所需',
    apply: function () { store.setParam('valvePulseMs', 2); },
    watch: '观察：剔除时序图重叠区变红 → 剔除力度不足 → 漏剔率上升。',
  },
  {
    name: '脉宽过长误伤', desc: '剔除脉宽拉到 26 ms，阀未闭合时下一支已进入喷嘴区',
    apply: function () { store.setParam('valvePulseMs', 26); },
    watch: '观察："误伤相邻"计数上升；论文 2.2.2 第五步正是要求折中脉宽。',
  },
  {
    name: '高置信度阈值', desc: '置信度阈值 0.20 → 0.55',
    apply: function () { store.setParam('confThreshold', 0.55); },
    watch: '观察：误检减少但漏检明显上升（Recall 下降）—— 论文将阈值降到 0.2 正是为小目标保留预测框。',
  },
  {
    name: 'FP32 对比', desc: '切回全精度推理',
    apply: function () { store.setParam('precision', 'fp32'); },
    watch: '观察：单张耗时 3.02 → 4.00 ms、显存 244.4 → 408.1 MB，节拍上限下降约 24%。',
  },
  {
    name: '注意力方案', desc: '切到 Outlook Attention（参数量 +17.9%，GFLOPs 6.4 → 7.9）',
    apply: function () { store.setParam('modelKey', 'outlook'); },
    watch: '观察：水松纸破/皱两类 AP 显著提高，但推理耗时按 GFLOPs 比例上升，节拍上限下降。',
  },
  {
    name: '双相机（单侧）', desc: '每支烟支仅 2 台相机拍摄一个侧面',
    apply: function () { store.setParam('camerasPerCigarette', 2); },
    watch: '观察：另一侧面的缺陷完全漏检 → 逃逸率翻倍，验证"上下各组相机避免侧边信息遗漏"的必要性。',
  },
];

(function buildDock() {
  var dock = document.getElementById('dock');
  var head = el('div', 'dock-head');
  head.appendChild(el('div', 'dock-title', '参数与工况'));
  var collapse = el('button', 'btn btn-sm', '⟩');
  collapse.addEventListener('click', function () {
    document.body.classList.toggle('dock-collapsed');
    collapse.textContent = document.body.classList.contains('dock-collapsed') ? '⟨' : '⟩';
  });
  head.appendChild(collapse);
  dock.appendChild(head);
  var scroll = el('div', 'dock-scroll');
  dock.appendChild(scroll);

  var gp = group(scroll, '工况预设 / 故障注入',
    '一键载入典型工况，右侧提示说明应观察什么。故障注入用于验证论文 2.2.2 提出的时序与补偿约束。');
  var pgrid = el('div', 'preset-grid');
  for (var i2 = 0; i2 < PRESETS.length; i2++) {
    var p = PRESETS[i2];
    var b = el('button', 'preset');
    b.appendChild(el('span', 'preset-n', p.name));
    b.appendChild(el('span', 'preset-d', p.desc));
    (function (pp) {
      b.addEventListener('click', function () {
        pp.apply();
        toast(pp.name + ' —— ' + pp.watch, 6200);
      });
    })(p);
    pgrid.appendChild(b);
  }
  gp.appendChild(pgrid);

  var g1 = group(scroll, '生产节拍与采集',
    '论文 1.3：主流卷接机组已达 12000 支/分钟。离线检测的节拍上限由相机帧率与 GPU 吞吐共同决定。');
  rangeRow(g1, '生产节拍（支/分钟）', 'throughputCPM', 300, 12000, 100, function (v) { return int(v); },
    '每个 MCP 脉冲对应一支烟支进入槽位');
  selectRow(g1, '每支相机数 N', 'camerasPerCigarette', [[2, '2 台（单侧）'], [4, '4 台（论文方案：上下各组，组内 90°）'], [8, '8 台（全周向加密）']]);
  rangeRow(g1, '来料缺陷率', 'defectRate', 0.005, 0.4, 0.005, function (v) { return pct(v, 1); });
  rangeRow(g1, '曝光时间（us）', 'exposureUs', 30, 900, 10, function (v) { return int(v) + ' us'; },
    '过长运动模糊，过短亮度不足（2.2.1 第二条）');
  rangeRow(g1, '光源提前量（us）', 'lightLeadUs', 0, 400, 10, function (v) { return int(v) + ' us'; },
    '避免曝光时光源未达稳定亮度（2.2.1 第三条）');

  var g2 = group(scroll, '模型与推理精度',
    '选中的消融方案与精度直接改变逐类检出率、单张耗时与显存占用。');
  selectRow(g2, '部署模型', 'modelKey', MODELS.map(function (m) { return [m.key, m.name + '（mAP ' + fmt(m.map50, 3) + '）']; }));
  selectRow(g2, '推理精度', 'precision', [['fp16', 'FP16 半精度（论文方案）'], ['fp32', 'FP32 全精度']]);
  selectRow(g2, '批处理尺寸 B', 'batchSize', [[1, '1'], [2, '2'], [4, '4'], [8, '8（默认）'], [16, '16']]);
  rangeRow(g2, '每相机队列容量', 'queueCapacity', 4, 256, 4, function (v) { return v + ' 张'; },
    '全局配置模块参数；满则丢帧，该视角信息缺失');
  rangeRow(g2, '置信度阈值 conf', 'confThreshold', 0.05, 0.9, 0.01, function (v) { return fmt(v, 2); },
    '论文表3-4：由默认 0.25 降至 0.2');
  rangeRow(g2, 'IoU 阈值（NMS）', 'iouThreshold', 0.3, 0.95, 0.05, function (v) { return fmt(v, 2); },
    '论文表3-4：由默认 0.7 降至 0.5，减少小目标重复框');

  var g3 = group(scroll, '视觉链路延迟',
    '论文 2.2.2：视觉延迟包含相机传输、预处理、推理、后处理与网络通信，需折算为同步脉冲补偿。');
  rangeRow(g3, 'GigE 图像传输（ms）', 'gigeTransferMs', 0.2, 8, 0.1, function (v) { return fmt(v, 1) + ' ms'; });
  rangeRow(g3, '预处理（ms）', 'preprocessMs', 0.1, 4, 0.1, function (v) { return fmt(v, 1) + ' ms'; });
  rangeRow(g3, '后处理 NMS（ms）', 'postprocessMs', 0.1, 4, 0.1, function (v) { return fmt(v, 1) + ' ms'; });
  rangeRow(g3, 'Modbus TCP 往返（ms）', 'modbusMs', 0.3, 16, 0.1, function (v) { return fmt(v, 1) + ' ms'; });

  var g4 = group(scroll, '槽位跟踪与剔除',
    '机械真值：D2 检测工位 → 剔除喷嘴 = ' + TRUE_D2_TO_NOZZLE + ' 槽。PLC 参数与之不符即产生槽位错位。');
  selectRow(g4, '槽位对齐方式', 'trackMode',
    [['id', '按检测编号对齐（论文第二步寄存器含检测编号）'], ['pulse', '按补偿脉冲折算（检测延迟补偿）']],
    '编号对齐对延迟抖动免疫；脉冲折算需现场标定，抖动会造成错位');
  rangeRow(g4, 'PLC 检测-剔除槽位差', 'detectToRejectSlots', 8, 26, 1, function (v) { return v + ' 槽'; },
    '真值 ' + TRUE_D2_TO_NOZZLE + ' 槽');
  rangeRow(g4, '视觉延迟补偿脉冲', 'compensationPulses', 0, 24, 1, function (v) { return v + ' 脉冲'; },
    '仅在"按补偿脉冲折算"下生效：markId = 当前计数 − 补偿脉冲');
  rangeRow(g4, 'PLC 结果接收窗口', 'resultWindowSlots', 3, 34, 1, function (v) { return v + ' 槽'; });
  selectRow(g4, '超窗安全策略', 'timeoutPolicy',
    [['alarm', '报警（放行）'], ['stop', '停机'], ['reject', '按异常品剔除']]);
  rangeRow(g4, '电磁阀响应（ms）', 'valveResponseMs', 0.3, 14, 0.1, function (v) { return fmt(v, 1) + ' ms'; });
  rangeRow(g4, 'PLC 提前输出量（ms）', 'valveLeadMs', 0, 12, 0.1, function (v) { return fmt(v, 1) + ' ms'; },
    '用于抵消阀响应滞后');
  rangeRow(g4, '剔除脉冲宽度（ms）', 'valvePulseMs', 0.5, 34, 0.5, function (v) { return fmt(v, 1) + ' ms'; },
    '过短漏剔，过长误伤相邻');
  rangeRow(g4, '气压（bar）', 'airPressureBar', 1, 8, 0.1, function (v) { return fmt(v, 1) + ' bar'; });
  rangeRow(g4, '喷嘴间距（mm）', 'nozzleGapMm', 2, 20, 0.5, function (v) { return fmt(v, 1) + ' mm'; });

  var g5 = group(scroll, '说明');
  g5.appendChild(el('div', 'dock-note',
    '数据来源：论文表2-1（硬件选型）、表3-1/3-2/3-3/3-4/3-5/3-6/3-7（模型与消融）、表4-1（FP16 实测）、'
    + '图2-1/2-10/2-11/3-1/4-1/4-3/4-4（结构与流程）。论文未逐项给出的时序与几何量（曝光、GigE 传输、'
    + 'Modbus 往返、槽位数、阀响应/脉宽、气压、喷嘴间距、缺陷类别权重）取工程合理值作为仿真默认，全部可在本坞调节。'));
})();

/* =================================================================== */
/* 提示条                                                              */
/* =================================================================== */
var toastBox = document.getElementById('toast');
var toastTimer = null;
function toast(msg, ms) {
  toastBox.textContent = msg;
  toastBox.classList.add('on');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toastBox.classList.remove('on'); }, ms || 3600);
}

/* =================================================================== */
/* 视图切换                                                            */
/* =================================================================== */
function activate(key) {
  for (var k in sections) sections[k].classList.toggle('on', k === key);
  var btns = document.querySelectorAll('.rail-btn');
  for (var i2 = 0; i2 < btns.length; i2++) btns[i2].classList.toggle('on', btns[i2].dataset.view === key);
  if (!instances[key] && builders[key]) {
    try {
      instances[key] = builders[key]();
    } catch (err) {
      console.error('[view ' + key + '] build failed', err);
      sections[key].appendChild(el('div', 'notice bad', '视图构建失败：' + err.message));
      instances[key] = { tick: function () { } };
    }
  }
  if (instances[key] && instances[key].api && instances[key].api.resize) setTimeout(instances[key].api.resize, 30);
  window.dispatchEvent(new Event('resize'));
}
store.on('ui', function (e) {
  if (e.key === 'view') activate(e.value);
  if (e.key === 'running') {
    topEls.runBtn.textContent = store.ui.running ? '⏸ 暂停' : '▶ 启动';
    topEls.runBtn.classList.toggle('on', store.ui.running);
  }
  if (e.key === 'timeScale') {
    var bs = topEls.segs.querySelectorAll('.seg');
    for (var i2 = 0; i2 < bs.length; i2++)
      bs[i2].classList.toggle('on', parseFloat(bs[i2].dataset.scale) === store.ui.timeScale);
  }
});
store.on('sim-halt', function (msg) {
  toast('⛔ ' + msg + ' —— 已停机，点击"复位"或改用其他超窗策略', 8000);
  store.setUI('running', false);
  var banner = document.getElementById('alarm');
  banner.textContent = '⛔ ' + msg;
  banner.classList.add('on');
});
store.on('sim-reset', function () {
  var banner = document.getElementById('alarm');
  if (banner) banner.classList.remove('on');
});

/* =================================================================== */
/* 主循环                                                              */
/* =================================================================== */
var lastTs = performance.now();
var statAcc = 0;
function loop(ts) {
  var dtMs = Math.min(120, ts - lastTs);
  lastTs = ts;
  requestAnimationFrame(loop);
  engine.update(dtMs);
  var cur = store.ui.view;
  var inst = instances[cur];
  if (inst && inst.tick) {
    try { inst.tick(dtMs / 1000); } catch (err) { console.error('[tick ' + cur + ']', err); }
  }
  statAcc += dtMs;
  if (statAcc > 260) {
    statAcc = 0;
    var d = engine.derive();
    var m = engine.measured();
    var perf = engine.perf();
    topEls.cpm.v.textContent = int(store.params.throughputCPM);
    topEls.inspected.v.textContent = int(engine.stats.inspected);
    topEls.rejected.v.textContent = int(engine.stats.rejectedTotal);
    topEls.escape.v.textContent = pct(m.escapeRate, 2);
    topEls.escape.c.className = 'tstat ' + (m.escapeRate < 0.12 ? 'good' : 'bad');
    topEls.util.v.textContent = pct(d.util, 0);
    topEls.util.c.className = 'tstat ' + (d.util > 1 ? 'bad' : (d.util > 0.75 ? 'warn' : 'good'));
    topEls.fps.v.textContent = fmt(perf.fps, 0);
    topEls.lat.v.textContent = fmt(m.avgLatency, 1) + ' ms';
    topEls.lat.c.className = 'tstat ' + (m.avgLatency > d.slotPeriodMs * store.params.resultWindowSlots ? 'bad' : 'good');
  }
}

/* 启动 */
store.setUI('timeScale', 1);
activate('platform');
requestAnimationFrame(loop);
setTimeout(function () {
  var d = engine.derive();
  store.setParam('compensationPulses', d.idealCompensation);
  store.setParam('detectToRejectSlots', TRUE_D2_TO_NOZZLE);
  store.setUI('running', true);
  toast('已按论文标称工况启动：EIoU + FP16，' + int(store.params.throughputCPM)
    + ' 支/分钟。左侧切换视图，右侧调参或注入故障。', 7000);
}, 500);

/* 键盘快捷键 */
window.addEventListener('keydown', function (e) {
  if (e.target && /input|select|textarea/i.test(e.target.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); store.setUI('running', !store.ui.running); }
  if (e.key >= '1' && e.key <= '7') store.setUI('view', VIEWS[parseInt(e.key, 10) - 1].key);
  if (e.key === 'r' || e.key === 'R') engine.reset();
});
