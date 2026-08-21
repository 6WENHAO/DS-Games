/**
 * trace.js —— 数据追溯（阶段7）+ 仿真自校验 + 局限与展望
 *  · 检测记录表（可按结果/类别筛选）与 CSV / JSON 导出
 *  · 实测 P / R / F1 与论文表3-7 对照 —— 验证仿真是否收敛于论文实验结果
 *  · 缺陷成因关联（1.1 节成因描述 + 5.2 工艺闭环展望）
 */
import {
  DEFECT_CLASSES, MODELS, LIMITATIONS, OUTLOOK, modelByKey, DATASET, THESIS_META,
} from '../data/thesis-data.js';
import { fmt, pct, int, el, hhmmss } from '../core/store.js';
import { donut, barList, groupedBar } from '../ui/charts.js';

/* 缺陷成因关联表：依据 1.1 节"烟丝来料混入梗签、生产设备参数偏移、鼓轮积胶积垢、
   卷烟纸张力波动"等成因描述整理，用于 5.2 提出的"检测剔除 → 预警预防"闭环。 */
var CAUSE_MAP = [
  { cls: [5], cause: '烟丝来料混入梗签', param: '来料除杂 / 烟丝筛分', action: '加强梗签剔除与筛分频次' },
  { cls: [1], cause: '卷烟纸受潮或胶量偏多', param: '搭口胶量 / 环境湿度', action: '复核施胶量与车间湿度' },
  { cls: [6], cause: '鼓轮积胶积垢带入污渍', param: '鼓轮清洁周期', action: '缩短鼓轮清洗周期' },
  { cls: [0, 9, 10], cause: '接装工位对位偏差 / 缺胶', param: '接装温度 / 搭口胶量 / 水松纸张力', action: '校准搭口对位与胶枪流量' },
  { cls: [3, 7, 8, 2], cause: '水松纸张力波动或输送挤压', param: '水松纸张力 / 输送间隙', action: '重调张力闭环与输送间隙' },
  { cls: [4], cause: '设备布带压痕', param: '布带张紧 / 磨损', action: '更换磨损布带' },
  { cls: [11], cause: '输送冲击导致烟支弯折', param: '鼓轮转速 / 负压吸附', action: '降低转速冲击、检查负压' },
];

export function createTrace(host, store, engine) {
  host.innerHTML = '';
  var wrap = el('div', 'tr-wrap');
  host.appendChild(wrap);

  /* ---------- 自校验 ---------- */
  var valCard = el('div', 'card');
  valCard.appendChild(el('div', 'card-title', '仿真自校验 · 实测指标 vs 论文表3-7'));
  valCard.appendChild(el('div', 'card-hint',
    '仿真内核以表3-6 逐类 AP 作为各类缺陷的检出概率、以表3-7 Precision 反解正常烟支的误检率。'
    + '随着样本量增加，实时统计出的 P / R / F1 应收敛于当前部署模型在论文中的实验值 —— 这是本仿真"可验证"的依据。'));
  var valBody = el('div', 'card-body');
  valCard.appendChild(valBody);
  var valBox = el('div', 'chart-box');
  valCard.appendChild(valBox);
  wrap.appendChild(valCard);
  var valChart = groupedBar(valBox, {
    height: 210,
    labels: ['Precision', 'Recall', 'F1'],
    series: [
      { name: '论文实验值', key: 'paper', color: '#8a93a8', data: [0, 0, 0] },
      { name: '仿真实测值', key: 'sim', color: '#2fbf71', data: [0, 0, 0] },
    ],
    min: 0.8, max: 1.0, ticks: 4, yDigits: 3, maxBar: 34,
    fmtTip: function (v) { return fmt(v, 4); },
  });

  /* ---------- 记录表 ---------- */
  var recCard = el('div', 'card');
  var recHead = el('div', 'card-title-row');
  recHead.appendChild(el('div', 'card-title', '检测与剔除记录（阶段7 数据追溯）'));
  var toolRow = el('div', 'btn-row');
  var filters = [['all', '全部'], ['rejectOk', '剔除成功'], ['rejectMiss', '漏剔'], ['rejectFalse', '误剔']];
  var curFilter = 'all';
  var filterBtns = [];
  for (var i = 0; i < filters.length; i++) {
    var b = el('button', 'btn btn-sm', filters[i][1]);
    (function (k, node) {
      node.addEventListener('click', function () {
        curFilter = k;
        for (var q = 0; q < filterBtns.length; q++) filterBtns[q].node.classList.toggle('on', filterBtns[q].k === k);
        renderRecs(true);
      });
    })(filters[i][0], b);
    toolRow.appendChild(b);
    filterBtns.push({ k: filters[i][0], node: b });
  }
  filterBtns[0].node.classList.add('on');
  var csvBtn = el('button', 'btn btn-primary btn-sm', '导出 CSV');
  var jsonBtn = el('button', 'btn btn-sm', '导出 JSON');
  toolRow.appendChild(csvBtn); toolRow.appendChild(jsonBtn);
  recHead.appendChild(toolRow);
  recCard.appendChild(recHead);
  var recWrap = el('div', 'rec-wrap');
  recCard.appendChild(recWrap);
  wrap.appendChild(recCard);

  /* ---------- 分布 ---------- */
  var g = el('div', 'tr-grid-2');
  wrap.appendChild(g);
  var distCard = el('div', 'card');
  distCard.appendChild(el('div', 'card-title', '缺陷类别分布（按数量降序）'));
  var distBox = el('div', 'chart-box');
  distCard.appendChild(distBox);
  var distList = el('div', 'card-body');
  distCard.appendChild(distList);
  g.appendChild(distCard);
  var distChart = donut(distBox, { height: 200, centerLabel: '判 NG 支数', items: [] });

  var causeCard = el('div', 'card');
  causeCard.appendChild(el('div', 'card-title', '缺陷成因关联与工艺闭环建议（1.1 成因 + 5.2 展望）'));
  causeCard.appendChild(el('div', 'card-hint',
    '论文展望提出：将检测结果与鼓轮转速、供丝量、接装温度、水松纸张力等工艺参数关联，'
    + '建立缺陷类型与工艺参数的映射模型，当某类缺陷出现频率异常升高时自动追溯原因并向 MES 预警，'
    + '实现从"检测剔除"到"预警预防"的转变。下表按实时检出频次排序并给出建议。'));
  var causeBody = el('div', 'card-body');
  causeCard.appendChild(causeBody);
  g.appendChild(causeCard);

  /* ---------- 局限与展望 ---------- */
  var limCard = el('div', 'card');
  limCard.appendChild(el('div', 'card-title', '论文自述局限（5.1.2）与未来工作展望（5.2）'));
  var limGrid = el('div', 'lim-grid');
  for (i = 0; i < LIMITATIONS.length; i++) {
    var lc = el('div', 'lim-card bad');
    lc.appendChild(el('div', 'lim-t', '局限 ' + (i + 1) + ' · ' + LIMITATIONS[i].title));
    lc.appendChild(el('div', 'lim-d', LIMITATIONS[i].detail));
    limGrid.appendChild(lc);
  }
  for (i = 0; i < OUTLOOK.length; i++) {
    var oc = el('div', 'lim-card good');
    oc.appendChild(el('div', 'lim-t', '展望 ' + (i + 1) + ' · ' + OUTLOOK[i].title));
    oc.appendChild(el('div', 'lim-d', OUTLOOK[i].detail));
    limGrid.appendChild(oc);
  }
  limCard.appendChild(limGrid);
  wrap.appendChild(limCard);

  /* ---------- 论文信息 ---------- */
  var metaCard = el('div', 'card');
  metaCard.appendChild(el('div', 'card-title', '建模依据'));
  var metaBody = el('div', 'card-body');
  var rowsMeta = [
    ['课题名称', THESIS_META.title],
    ['英文题名', THESIS_META.titleEn],
    ['作者 / 指导老师', THESIS_META.author + ' / ' + THESIS_META.advisor],
    ['学院 / 专业 / 班级', THESIS_META.school + ' / ' + THESIS_META.major + ' / ' + THESIS_META.classId],
    ['技术路线', THESIS_META.route],
    ['闭环链路', THESIS_META.chain],
    ['关键词', THESIS_META.keywords.join(' · ')],
    ['数据集', DATASET.rawImages + ' 张原始（含 ' + DATASET.negativeSamples + ' 张负样本）→ 五种增强 → '
      + DATASET.augmented + ' 张，' + DATASET.ratio],
    ['本仿真覆盖', '第二章平台结构与工作逻辑、第三章消融实验数据、第四章三层架构与 GUI；'
      + '论文未给出的时序/几何量在参数面板中标注为可调假设'],
  ];
  var mt = el('table', 'mini-table wide');
  for (i = 0; i < rowsMeta.length; i++) {
    var tr = el('tr');
    tr.appendChild(el('td', 'k', rowsMeta[i][0]));
    tr.appendChild(el('td', 'v', rowsMeta[i][1]));
    mt.appendChild(tr);
  }
  metaBody.appendChild(mt);
  metaCard.appendChild(metaBody);
  wrap.appendChild(metaCard);

  /* ================= 渲染 ================= */
  var lastCount = -1, lastFilter = null;
  function renderRecs(force) {
    var recs = engine.records;
    if (!force && lastCount === recs.length && lastFilter === curFilter) return;
    lastCount = recs.length; lastFilter = curFilter;
    var list = curFilter === 'all' ? recs : recs.filter(function (r) { return r.outcome === curFilter; });
    recWrap.innerHTML = '';
    var tb = el('table', 'rec-table');
    var hr = el('tr');
    ['序号', '烟支#', '时间(ms)', '相机', '判定类别', '置信度', '框数', '边界框', '面积', '延迟(ms)', '槽位', '偏差', '结果', '真值']
      .forEach(function (h) { hr.appendChild(el('th', null, h)); });
    tb.appendChild(hr);
    var shown = list.slice(0, 120);
    for (var i2 = 0; i2 < shown.length; i2++) {
      var r = shown[i2];
      var dc = r.cls !== null && r.cls !== undefined ? DEFECT_CLASSES[r.cls] : null;
      var tr2 = el('tr', 'o-' + r.outcome);
      tr2.appendChild(el('td', null, String(r.seq)));
      tr2.appendChild(el('td', 'mono', '#' + r.id));
      tr2.appendChild(el('td', 'mono', fmt(r.t, 1)));
      tr2.appendChild(el('td', 'mono', 'CAM' + (r.cam + 1)));
      var tdc = el('td');
      if (dc) {
        var sw = el('i', 'sw'); sw.style.background = dc.color;
        tdc.appendChild(sw);
        tdc.appendChild(el('span', null, dc.name));
        if (r.wrongClass) tdc.appendChild(el('span', 'mini-warn', '类别混淆'));
      } else tdc.appendChild(el('span', 'muted', '—'));
      tr2.appendChild(tdc);
      tr2.appendChild(el('td', 'mono', fmt(r.conf, 3)));
      tr2.appendChild(el('td', 'mono', String(r.boxes)));
      tr2.appendChild(el('td', 'mono', r.box ? (r.box.x1 + ',' + r.box.y1 + ' → ' + (r.box.x1 + r.box.w) + ',' + (r.box.y1 + r.box.h)) : '—'));
      tr2.appendChild(el('td', 'mono', r.box ? int(r.box.w * r.box.h) : '—'));
      tr2.appendChild(el('td', 'mono', fmt(r.latency, 2)));
      tr2.appendChild(el('td', 'mono', String(r.slot)));
      tr2.appendChild(el('td', 'mono', (r.slotError > 0 ? '+' : '') + r.slotError));
      var oc2 = { rejectOk: '剔除成功', rejectMiss: '漏剔', rejectFalse: '误剔', pass: '放行' }[r.outcome] || '—';
      tr2.appendChild(el('td', 'oc', oc2));
      tr2.appendChild(el('td', 'mono muted', r.trueCls === null || r.trueCls === undefined ? '正常' : String(r.trueCls)));
      (function (id) { tr2.addEventListener('click', function () { store.setUI('followCigarette', id); }); })(r.id);
      tb.appendChild(tr2);
    }
    recWrap.appendChild(tb);
    if (!shown.length) recWrap.appendChild(el('div', 'muted pad', '暂无记录 —— 启动仿真后，每支被剔除的烟支都会在此留痕（含带标注框图像保存）'));
  }

  function renderDist() {
    var s = engine.stats;
    var items = [];
    for (var i2 = 0; i2 < DEFECT_CLASSES.length; i2++) {
      if (s.byClass[i2] > 0) {
        items.push({
          label: DEFECT_CLASSES[i2].name, value: s.byClass[i2],
          color: DEFECT_CLASSES[i2].color, id: i2,
          conf: s.byClassConf[i2] / s.byClass[i2],
        });
      }
    }
    items.sort(function (a, b) { return b.value - a.value; });
    distChart.setCfg({ items: items });
    barList(distList, items, {
      empty: '暂无检出记录',
      fmt: function (it) { return it.value + '  ·  平均 conf ' + fmt(it.conf, 3); },
    });
    // 成因
    var order = CAUSE_MAP.slice().map(function (c) {
      var n = 0;
      for (var k = 0; k < c.cls.length; k++) n += s.byClass[c.cls[k]];
      return { c: c, n: n };
    });
    order.sort(function (a, b) { return b.n - a.n; });
    causeBody.innerHTML = '';
    var tb = el('table', 'mini-table wide');
    var hr = el('tr');
    ['检出', '缺陷类别', '可能成因', '关联工艺参数', '建议动作'].forEach(function (h) { hr.appendChild(el('th', null, h)); });
    tb.appendChild(hr);
    for (i2 = 0; i2 < order.length; i2++) {
      var o = order[i2];
      var tr = el('tr', o.n > 0 && i2 === 0 ? 'sel-row' : null);
      tr.appendChild(el('td', 'mono', int(o.n)));
      var names = o.c.cls.map(function (x) { return DEFECT_CLASSES[x].name; }).join('、');
      tr.appendChild(el('td', null, names));
      tr.appendChild(el('td', null, o.c.cause));
      tr.appendChild(el('td', 'n', o.c.param));
      tr.appendChild(el('td', 'n', o.c.action));
      tb.appendChild(tr);
    }
    causeBody.appendChild(tb);
  }

  function renderVal() {
    var m = engine.measured();
    var mm = modelByKey(store.params.modelKey);
    var s = engine.stats;
    valChart.setCfg({
      series: [
        { name: '论文实验值 · ' + mm.short, key: 'paper', color: '#8a93a8', data: [mm.P, mm.R, mm.F1] },
        { name: '仿真实测值', key: 'sim', color: '#2fbf71', data: [m.P, m.R, m.F1] },
      ],
    });
    valBody.innerHTML = '';
    var rows = [
      ['部署模型', mm.name, '论文 mAP@0.5 = ' + fmt(mm.map50, 3) + '（' + (mm.gain > 0 ? '+' + fmt(mm.gain, 2) + '%' : '与基线持平') + '）'],
      ['样本量', int(s.inspected) + ' 支', '缺陷 ' + int(s.defectTrue) + ' 支 / 正常 ' + int(s.normalTrue) + ' 支'],
      ['混淆矩阵', 'TP ' + int(s.TP) + ' · FP ' + int(s.FP) + ' · FN ' + int(s.FN) + ' · TN ' + int(s.TN), ''],
      ['剔除结果', '缺陷剔除 ' + int(s.defectEjected) + ' · 正常误剔 ' + int(s.normalEjected)
        + ' · 漏剔 ' + int(s.rejectMiss),
        '缺陷逃逸率 ' + pct(m.escapeRate, 2) + ' · 正常品误剔率 ' + pct(m.falseRejectRate, 3)],
      ['Precision', fmt(m.P, 4), '论文 ' + fmt(mm.P, 4) + ' · 偏差 ' + fmt((m.P - mm.P) * 100, 2) + ' pp'],
      ['Recall', fmt(m.R, 4), '论文 ' + fmt(mm.R, 4) + ' · 偏差 ' + fmt((m.R - mm.R) * 100, 2) + ' pp'],
      ['F1', fmt(m.F1, 4), '论文 ' + fmt(mm.F1, 4) + ' · 偏差 ' + fmt((m.F1 - mm.F1) * 100, 2) + ' pp'],
      ['运行时长', hhmmss(engine.runMs), '推理帧 ' + int(engine.frameCount) + ' 张'],
    ];
    var tb = el('table', 'mini-table wide');
    for (var i2 = 0; i2 < rows.length; i2++) {
      var tr = el('tr');
      tr.appendChild(el('td', 'k', rows[i2][0]));
      tr.appendChild(el('td', 'v', rows[i2][1]));
      tr.appendChild(el('td', 'n', rows[i2][2]));
      tb.appendChild(tr);
    }
    valBody.appendChild(tb);
    if (s.inspected < 200) {
      valBody.appendChild(el('div', 'notice warn',
        '样本量偏小（' + int(s.inspected) + ' 支），统计尚未收敛。把"时间缩放"调到 20x 或提高生产节拍可快速积累样本。'));
    } else {
      var dev = Math.abs(m.P - mm.P) + Math.abs(m.R - mm.R);
      valBody.appendChild(el('div', 'notice ' + (dev < 0.035 ? 'good' : 'warn'),
        dev < 0.035
          ? '实测 P/R 已收敛于论文实验值（合计偏差 ' + fmt(dev * 100, 2) + ' pp）。'
          : '当前偏差 ' + fmt(dev * 100, 2) + ' pp —— 通常由置信度阈值偏离论文默认 0.20 或缺陷率设置导致，可复位参数验证。'));
    }
  }

  function download(text, name, type) {
    var blob = new Blob([type === 'csv' ? '\ufeff' + text : text], { type: type === 'csv' ? 'text/csv;charset=utf-8' : 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
  }
  csvBtn.addEventListener('click', function () {
    var recs = curFilter === 'all' ? engine.records : engine.records.filter(function (r) { return r.outcome === curFilter; });
    var lines = ['seq,cigarette_id,time_ms,camera,class_id,class_code,class_name,confidence,boxes,x1,y1,x2,y2,area,latency_ms,slot,slot_error,outcome,true_class'];
    for (var i2 = 0; i2 < recs.length; i2++) {
      var r = recs[i2];
      var dc = r.cls !== null && r.cls !== undefined ? DEFECT_CLASSES[r.cls] : null;
      var bx = r.box;
      lines.push([r.seq, r.id, fmt(r.t, 2), 'CAM' + (r.cam + 1), r.cls === null ? '' : r.cls,
        dc ? dc.code : '', dc ? dc.name : '', fmt(r.conf, 4), r.boxes,
        bx ? bx.x1 : '', bx ? bx.y1 : '', bx ? bx.x1 + bx.w : '', bx ? bx.y1 + bx.h : '',
        bx ? bx.w * bx.h : '', fmt(r.latency, 3), r.slot, r.slotError, r.outcome,
        r.trueCls === null || r.trueCls === undefined ? 'normal' : r.trueCls].join(','));
    }
    download(lines.join('\n'), 'trace_' + Date.now() + '.csv', 'csv');
  });
  jsonBtn.addEventListener('click', function () {
    download(JSON.stringify({
      meta: { model: modelByKey(store.params.modelKey), params: store.params, exported: new Date().toISOString() },
      stats: engine.stats, measured: engine.measured(), perf: engine.perf(),
      records: curFilter === 'all' ? engine.records : engine.records.filter(function (r) { return r.outcome === curFilter; }),
    }, null, 2), 'trace_' + Date.now() + '.json', 'json');
  });

  var acc = 0;
  function tick(dtReal) {
    acc += dtReal;
    if (acc < 0.5) return;
    acc = 0;
    renderRecs(false);
    renderDist();
    renderVal();
  }
  renderRecs(true); renderDist(); renderVal();
  return { tick: tick };
}
