/**
 * algorithm.js —— 第三章：改进的 YOLOv11 烟支缺陷检测算法
 *  · 基线选型对比（表3-1）
 *  · YOLOv11n 网络结构交互图（图3-1 ~ 3-8）+ Outlook Attention 集成开关（图3-14）
 *  · 数据集构建（3.2）
 *  · 六模型消融实验（表3-5/3-6/3-7）+ 损失函数原理（3.3.3）
 *  · 选定的模型直接作用于仿真内核（改变逐类检出率与推理耗时）
 */
import {
  YOLO_COMPARISON, YOLO_MODULES, YOLO_GRAPH, DATASET, DEFECT_CLASSES,
  MODELS, AP_TABLE, MODEL_COMPLEXITY, LOSS_FUNCTIONS, HYPER_PARAMS, TRAIN_ENV,
  DEFECT_OCCURRENCE_WEIGHTS, modelByKey,
} from '../data/thesis-data.js';
import { fmt, pct, int, el } from '../core/store.js';
import { groupedBar, lineChart, radar, heatTable, donut } from '../ui/charts.js';

export function createAlgorithm(host, store, engine) {
  host.innerHTML = '';
  var wrap = el('div', 'alg-wrap');
  host.appendChild(wrap);

  /* ================= A. 模型部署选择器 ================= */
  var pickCard = el('div', 'card');
  pickCard.appendChild(el('div', 'card-title', '消融方案选择 · 选中的模型即为系统部署模型（直接作用于仿真）'));
  var pickRow = el('div', 'model-pick');
  pickCard.appendChild(pickRow);
  var pickEls = [];
  for (var i = 0; i < MODELS.length; i++) {
    var m = MODELS[i];
    var c = el('div', 'mp');
    c.style.setProperty('--mc', m.color);
    var head = el('div', 'mp-head');
    head.appendChild(el('span', 'mp-name', m.name));
    if (m.recommended) head.appendChild(el('span', 'mp-badge', '论文推荐'));
    c.appendChild(head);
    var kv = el('div', 'mp-kv');
    kv.appendChild(el('span', 'mp-map', fmt(m.map50, 3)));
    kv.appendChild(el('span', 'mp-lab', 'mAP@0.5'));
    c.appendChild(kv);
    var meta = el('div', 'mp-meta');
    meta.appendChild(el('span', null, '损失 ' + m.loss));
    meta.appendChild(el('span', null, '注意力 ' + m.attn));
    c.appendChild(meta);
    var cx = MODEL_COMPLEXITY[m.key];
    c.appendChild(el('div', 'mp-cx', int(cx.params) + ' params · ' + cx.gflops + ' GFLOPs · ' + cx.epochTime + 's/epoch'));
    c.appendChild(el('div', 'mp-note', m.note));
    (function (key) {
      c.addEventListener('click', function () { store.setParam('modelKey', key); });
    })(m.key);
    pickRow.appendChild(c);
    pickEls.push({ key: m.key, node: c });
  }
  wrap.appendChild(pickCard);

  /* ================= B. 消融结果 ================= */
  var g1 = el('div', 'alg-grid-2');
  wrap.appendChild(g1);

  var mapCard = el('div', 'card');
  mapCard.appendChild(el('div', 'card-title', '综合精度对比 mAP@0.5（表3-6 All 行）'));
  var mapBox = el('div', 'chart-box');
  mapCard.appendChild(mapBox);
  g1.appendChild(mapCard);
  var mapChart = groupedBar(mapBox, {
    height: 240,
    labels: MODELS.map(function (x) { return x.short; }),
    series: [{ name: 'mAP@0.5', key: 'map', color: '#4db8ff', data: MODELS.map(function (x) { return x.map50; }) }],
    min: 0.88, max: 0.925, ticks: 5, yDigits: 3, maxBar: 40,
    refLine: 0.905, refLabel: '基线 0.905',
    fmtTip: function (v) { return fmt(v, 3); },
  });

  var radarCard = el('div', 'card');
  radarCard.appendChild(el('div', 'card-title', '多指标雷达（表3-7）· 当前部署模型高亮'));
  var radarBox = el('div', 'chart-box');
  radarCard.appendChild(radarBox);
  g1.appendChild(radarCard);
  var radarChart = radar(radarBox, {
    height: 260,
    axes: ['Precision', 'Recall', 'F1', 'mAP@.5', 'mAP@.5:.95'],
    axisMin: [0.915, 0.870, 0.893, 0.902, 0.584],
    axisMax: [0.927, 0.900, 0.912, 0.918, 0.599],
    series: [],
  });

  var apCard = el('div', 'card');
  apCard.appendChild(el('div', 'card-title', '逐类 AP@0.5 热力矩阵（表3-6）· 行内最优加粗'));
  apCard.appendChild(el('div', 'card-hint',
    'AP 值同时被仿真内核用作各类缺陷的检出概率基准：类别 3（水松纸翘边）与类别 7（水松纸皱）AP 最低，正是最易漏检的形态。'));
  var apBox = el('div', 'table-box');
  apCard.appendChild(apBox);
  wrap.appendChild(apCard);
  (function () {
    var rows = [], data = [];
    for (var k = 0; k < DEFECT_CLASSES.length; k++) {
      var dc = DEFECT_CLASSES[k];
      rows.push('<b>' + k + '</b> ' + dc.name + '<span class="cw">' + dc.code + '</span>');
      var r = [];
      for (var mi = 0; mi < MODELS.length; mi++) r.push(AP_TABLE[MODELS[mi].key][k]);
      data.push(r);
    }
    rows.push('<b>All</b> 综合 mAP@0.5');
    var rAll = [];
    for (mi = 0; mi < MODELS.length; mi++) rAll.push(MODELS[mi].map50);
    data.push(rAll);
    heatTable(apBox, {
      corner: '类别 \\ 模型',
      cols: MODELS.map(function (x) { return x.short; }),
      rows: rows, data: data, min: 0.70, max: 1.0, bestPerRow: true,
      fmt: function (v) { return fmt(v, 3); },
    });
  })();

  /* ================= C. 网络结构 ================= */
  var netCard = el('div', 'card');
  var netHead = el('div', 'card-title', 'YOLOv11n 网络结构（图3-1）· 点击模块查看原理');
  netCard.appendChild(netHead);
  var oaRow = el('div', 'card-hint');
  var oaLabel = el('label', 'switch-row');
  var oaChk = document.createElement('input');
  oaChk.type = 'checkbox';
  oaLabel.appendChild(oaChk);
  oaLabel.appendChild(el('span', null, '在所有 C3k2 模块中集成 Outlook Attention（图3-14 改进后结构）'));
  oaRow.appendChild(oaLabel);
  netCard.appendChild(oaRow);
  var netBox = el('div', 'net-box');
  netCard.appendChild(netBox);
  var modBox = el('div', 'card-body mod-detail');
  netCard.appendChild(modBox);
  wrap.appendChild(netCard);

  function moduleInfo(key) {
    modBox.innerHTML = '';
    var mm = null;
    for (var k = 0; k < YOLO_MODULES.length; k++) if (YOLO_MODULES[k].key === key) mm = YOLO_MODULES[k];
    if (!mm) return;
    modBox.appendChild(el('div', 'info-name', mm.name));
    modBox.appendChild(el('div', 'info-fn', mm.role));
    if (key === 'C3k2' && oaChk.checked) {
      modBox.appendChild(el('div', 'info-why',
        'Outlook Attention（VOLO，参考文献[26]）：放弃粗粒度全局依赖，在每个空间位置的局部邻域窗口内高效编码细粒度特征与上下文，'
        + '增强对烟支表面微小缺陷（水松纸皱 +9.8%、水松纸破 +9.0%）的局部细节感知；代价是参数量由 2,592,200 增至 3,055,628、'
        + 'GFLOPs 由 6.4 增至 7.9、每轮训练时间由 47s 增至 68s。'));
    }
  }

  function buildNet() {
    netBox.innerHTML = '';
    var cols = [
      { title: 'Backbone 主干', items: YOLO_GRAPH.backbone },
      { title: 'Neck 颈部（多尺度融合）', items: YOLO_GRAPH.neck },
      { title: 'Head 检测头', items: YOLO_GRAPH.heads },
    ];
    for (var ci = 0; ci < cols.length; ci++) {
      var col = el('div', 'net-col');
      col.appendChild(el('div', 'net-col-title', cols[ci].title));
      for (var k = 0; k < cols[ci].items.length; k++) {
        var it = cols[ci].items[k];
        var node = el('div', 'net-node m-' + it.m);
        var nm = el('div', 'net-node-name', it.m);
        node.appendChild(nm);
        var sub = [];
        if (it.out) sub.push(it.out);
        if (it.ch) sub.push(it.ch + ' ch');
        if (it.scale) sub.push(it.scale);
        if (Array.isArray(it.from) && it.from.length) sub.push('← ' + it.from.join(' + '));
        else if (typeof it.from === 'string') sub.push('← ' + it.from);
        if (sub.length) node.appendChild(el('div', 'net-node-sub', sub.join(' · ')));
        if (it.tap) node.appendChild(el('span', 'net-tap', it.tap));
        if (it.m === 'C3k2' && oaChk.checked) node.appendChild(el('span', 'net-oa', 'OA'));
        (function (mk) { node.addEventListener('click', function () { moduleInfo(mk); }); })(it.m);
        col.appendChild(node);
      }
      netBox.appendChild(col);
      if (ci < cols.length - 1) netBox.appendChild(el('div', 'net-sep', '→'));
    }
  }
  oaChk.addEventListener('change', function () {
    buildNet();
    var cur = modelByKey(store.params.modelKey);
    // 勾选/取消 → 在同一损失函数下切换到对应的注意力方案
    var lossKey = cur.loss === 'EIoU' ? 'eiou' : (cur.loss === 'WIoU v1' ? 'wiou' : 'baseline');
    var target = oaChk.checked
      ? (lossKey === 'eiou' ? 'eiou_ol' : (lossKey === 'wiou' ? 'wiou_ol' : 'outlook'))
      : lossKey;
    store.setParam('modelKey', target);
  });
  buildNet();
  moduleInfo('C3k2');

  /* ================= D. 损失函数 ================= */
  var lossCard = el('div', 'card');
  lossCard.appendChild(el('div', 'card-title', '边界框回归损失函数改进（3.3.3）'));
  var lossGrid = el('div', 'loss-grid');
  for (i = 0; i < LOSS_FUNCTIONS.length; i++) {
    var lf = LOSS_FUNCTIONS[i];
    var lc = el('div', 'loss-card');
    lc.appendChild(el('div', 'loss-name', lf.name));
    lc.appendChild(el('div', 'loss-formula', lf.formula));
    var ul = el('ul', 'loss-terms');
    for (var t = 0; t < lf.terms.length; t++) ul.appendChild(el('li', null, lf.terms[t]));
    lc.appendChild(ul);
    lc.appendChild(el('div', 'loss-issue', lf.issue));
    lossGrid.appendChild(lc);
  }
  lossCard.appendChild(lossGrid);
  var lossBox = el('div', 'chart-box');
  lossCard.appendChild(lossBox);
  lossCard.appendChild(el('div', 'card-hint',
    '训练损失曲线 train/box_loss 示意重构：按 3.3.4 描述的相对关系绘制（WIoU 收敛最低，EIoU 略优于 CIoU）。'
    + '论文强调损失值低并不必然对应最终精度最高——不同损失函数的数值尺度与优化目标不同。'));
  wrap.appendChild(lossCard);
  (function () {
    var N = 180;
    function curve(a, b, tau, seed) {
      var out = [], s = seed;
      for (var k = 0; k < N; k++) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        var noise = ((s / 0x7fffffff) - 0.5) * 0.035 * Math.exp(-k / 90);
        out.push(a + b * Math.exp(-k / tau) + noise);
      }
      return out;
    }
    lineChart(lossBox, {
      height: 220, title: 'train/box_loss（图3-15）', yDigits: 2, n: N,
      xLabels: ['1', '45', '90', '135', '180'],
      series: [
        { name: 'CIoU（基线）', color: '#8a93a8', data: curve(1.06, 1.62, 38, 7), fill: false },
        { name: 'EIoU', color: '#2fbf71', data: curve(1.00, 1.58, 34, 13), fill: false },
        { name: 'WIoU v1', color: '#48a0e8', data: curve(0.72, 1.44, 30, 29), fill: false },
      ],
    });
    var lg = el('div', 'legend-row');
    var names = [['CIoU（基线）', '#8a93a8'], ['EIoU', '#2fbf71'], ['WIoU v1', '#48a0e8']];
    for (var k = 0; k < names.length; k++) {
      var it = el('span', 'lg');
      var sw = el('i');
      sw.style.background = names[k][1];
      it.appendChild(sw);
      it.appendChild(el('span', null, names[k][0]));
      lg.appendChild(it);
    }
    lossBox.appendChild(lg);
  })();

  /* ================= E. 基线选型 + 数据集 + 环境 ================= */
  var g2 = el('div', 'alg-grid-2');
  wrap.appendChild(g2);

  var baseCard = el('div', 'card');
  baseCard.appendChild(el('div', 'card-title', '基线模型选型对比（表3-1 · COCO 数据集）'));
  var baseBox = el('div', 'chart-box');
  baseCard.appendChild(baseBox);
  g2.appendChild(baseCard);
  groupedBar(baseBox, {
    height: 250, rotate: false,
    labels: YOLO_COMPARISON.map(function (x) { return x.model.replace('YOLOv', 'v'); }),
    series: [
      { name: 'mAP@0.5 (%)', key: 'm', color: '#4db8ff', data: YOLO_COMPARISON.map(function (x) { return x.map50; }) },
      { name: 'FPS/5', key: 'f', color: '#2fbf71', data: YOLO_COMPARISON.map(function (x) { return x.fps / 5; }) },
      { name: 'FLOPs x5', key: 'g', color: '#e8a33a', data: YOLO_COMPARISON.map(function (x) { return x.flops * 5; }) },
    ],
    min: 0, max: 100, ticks: 5, yDigits: 0, maxBar: 14,
    fmtTip: function (v) { return fmt(v, 1); },
  });
  var bl = el('div', 'card-hint',
    'YOLOv11n：参数量 2.58 M、模型 6.3 MB、6.3 GFLOPs、~303 FPS，C3k2 + C2PSA 模块，速度最快模型最小 → 选为基线；直接采用 COCO 官方预训练权重微调。');
  baseCard.appendChild(bl);
  var btb = el('table', 'mini-table wide');
  var hdr = el('tr');
  ['模型', '参数量(M)', '大小(MB)', 'FLOPs(G)', 'mAP@0.5(%)', 'FPS', '核心特点'].forEach(function (h) {
    hdr.appendChild(el('th', null, h));
  });
  btb.appendChild(hdr);
  for (i = 0; i < YOLO_COMPARISON.length; i++) {
    var yc = YOLO_COMPARISON[i];
    var tr = el('tr', yc.selected ? 'sel-row' : null);
    [yc.model, yc.params, yc.size, yc.flops, yc.map50, yc.fps, yc.note].forEach(function (v, idx) {
      tr.appendChild(el('td', idx === 6 ? 'n' : null, String(v)));
    });
    btb.appendChild(tr);
  }
  baseCard.appendChild(btb);

  var dsCard = el('div', 'card');
  dsCard.appendChild(el('div', 'card-title', '专用数据集构建（3.2）'));
  var dsBody = el('div', 'card-body');
  dsCard.appendChild(dsBody);
  g2.appendChild(dsCard);
  (function () {
    var kpi = el('div', 'kpi-row');
    var items = [
      ['原始图像', int(DATASET.rawImages)], ['负样本', int(DATASET.negativeSamples)],
      ['增强后', int(DATASET.augmented)], ['类别数', String(DATASET.classes)],
      ['训练集', int(DATASET.split.train)], ['验证集', int(DATASET.split.val)], ['测试集', int(DATASET.split.test)],
    ];
    for (var k = 0; k < items.length; k++) {
      var kk = el('div', 'kpi');
      kk.appendChild(el('div', 'kpi-v', items[k][1]));
      kk.appendChild(el('div', 'kpi-k', items[k][0]));
      kpi.appendChild(kk);
    }
    dsBody.appendChild(kpi);
    dsBody.appendChild(el('div', 'info-sub', '五种数据增强策略（' + DATASET.ratio + '）'));
    var chips = el('div', 'tag-row');
    for (k = 0; k < DATASET.augmentations.length; k++) chips.appendChild(el('span', 'tag', DATASET.augmentations[k]));
    dsBody.appendChild(chips);
    dsBody.appendChild(el('div', 'info-fn', '采集：' + DATASET.acquisition));
    dsBody.appendChild(el('div', 'info-fn', '标注：' + DATASET.labelTool));
    var dBox = el('div', 'chart-box');
    dsBody.appendChild(dBox);
    donut(dBox, {
      height: 170, centerLabel: '张（增强后）',
      items: [
        { label: '训练集 3438', value: DATASET.split.train, color: '#4db8ff' },
        { label: '验证集 978', value: DATASET.split.val, color: '#2fbf71' },
        { label: '测试集 498', value: DATASET.split.test, color: '#e8a33a' },
      ],
    });
    dsBody.appendChild(el('div', 'info-sub', '12 类缺陷 · 来料出现权重（仿真可调假设）'));
    var clsWrap = el('div', 'cls-grid');
    for (k = 0; k < DEFECT_CLASSES.length; k++) {
      var dc = DEFECT_CLASSES[k];
      var ci2 = el('div', 'cls-item');
      var dot = el('i');
      dot.style.background = dc.color;
      ci2.appendChild(dot);
      ci2.appendChild(el('span', 'cls-id', String(dc.id)));
      ci2.appendChild(el('span', 'cls-nm', dc.name));
      ci2.appendChild(el('span', 'cls-zone', dc.zone));
      ci2.appendChild(el('span', 'cls-ap', 'AP ' + fmt(AP_TABLE[store.params.modelKey][k], 3)));
      ci2.title = dc.code + ' — ' + dc.desc;
      clsWrap.appendChild(ci2);
    }
    dsBody.appendChild(clsWrap);
  })();

  var envCard = el('div', 'card');
  envCard.appendChild(el('div', 'card-title', '训练环境（表3-2）与超参数（表3-4）'));
  var envGrid = el('div', 'alg-grid-2 tight');
  var t1 = el('table', 'mini-table');
  for (i = 0; i < TRAIN_ENV.length; i++) {
    var r1 = el('tr');
    r1.appendChild(el('td', 'k', TRAIN_ENV[i][0]));
    r1.appendChild(el('td', 'v', TRAIN_ENV[i][1]));
    t1.appendChild(r1);
  }
  envGrid.appendChild(t1);
  var t2 = el('table', 'mini-table');
  for (i = 0; i < HYPER_PARAMS.length; i++) {
    var r2 = el('tr');
    r2.appendChild(el('td', 'k', HYPER_PARAMS[i][0]));
    r2.appendChild(el('td', 'v', HYPER_PARAMS[i][1]));
    r2.appendChild(el('td', 'n', HYPER_PARAMS[i][2]));
    t2.appendChild(r2);
  }
  envGrid.appendChild(t2);
  envCard.appendChild(envGrid);
  envCard.appendChild(el('div', 'card-hint',
    '烟支缺陷背景大、目标小、单图目标稀少：NMS IoU 由 0.7 降至 0.5 以减少小目标重复框；置信度由 0.25 降至 0.2 避免小目标预测框被过早过滤；'
    + '余弦退火 + AdamW；早停 patience = 90。这两个阈值在右侧控制面板中可实时调整并观察对仿真检出/误检的影响。'));
  wrap.appendChild(envCard);

  /* ================= 状态同步 ================= */
  function syncModel() {
    var key = store.params.modelKey;
    for (var k = 0; k < pickEls.length; k++) pickEls[k].node.classList.toggle('sel', pickEls[k].key === key);
    mapChart.setCfg({ highlight: null });
    var cur = modelByKey(key);
    var series = [];
    for (k = 0; k < MODELS.length; k++) {
      var mm = MODELS[k];
      series.push({
        name: mm.short, color: mm.color, dim: mm.key !== key,
        data: [mm.P, mm.R, mm.F1, mm.map50, mm.map5095],
      });
    }
    // 当前模型置于最后绘制（在最上层）
    series.sort(function (a, b) { return (a.dim ? 0 : 1) - (b.dim ? 0 : 1); });
    radarChart.setCfg({ series: series });
    var oaOn = cur.attn === 'Outlook';
    if (oaChk.checked !== oaOn) { oaChk.checked = oaOn; buildNet(); }
  }
  store.on('param', function (e) {
    if (e.key === 'modelKey' || e.key === '*') syncModel();
  });
  syncModel();

  return { tick: function () { } };
}
