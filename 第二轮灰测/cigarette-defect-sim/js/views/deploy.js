/**
 * deploy.js —— 第四章 4.1：推理框架与部署引擎
 *  · 三层架构（图4-1）
 *  · FP16 半精度轻量化（表4-1）实时对比 + 显存
 *  · 吞吐瓶颈计算器（由论文数据推导：相机上限 vs GPU 上限 vs 生产节拍需求）
 *  · 生产者—消费者四相机调度（图4-3）实时队列
 */
import {
  DEPLOY_STACK, PRECISION_BENCH, GUI_MODES, MODEL_COMPLEXITY, modelByKey,
} from '../data/thesis-data.js';
import { fmt, pct, int, el, clamp } from '../core/store.js';
import { groupedBar, gauge, lineChart } from '../ui/charts.js';

export function createDeploy(host, store, engine) {
  host.innerHTML = '';
  var wrap = el('div', 'dep-wrap');
  host.appendChild(wrap);

  /* ================= A. 三层架构 ================= */
  var stackCard = el('div', 'card');
  stackCard.appendChild(el('div', 'card-title', '三层部署架构（图4-1）· PyTorch 计算引擎 — Ultralytics 推理框架 — 系统部署引擎'));
  var stack = el('div', 'stack');
  for (var i = 0; i < DEPLOY_STACK.length; i++) {
    var L = DEPLOY_STACK[i];
    var layer = el('div', 'stack-layer l' + i);
    var lh = el('div', 'stack-head');
    lh.appendChild(el('span', 'stack-idx', String(DEPLOY_STACK.length - i)));
    lh.appendChild(el('span', 'stack-layer-name', L.layer));
    lh.appendChild(el('span', 'stack-title', L.title));
    layer.appendChild(lh);
    var ul = el('ul', 'stack-points');
    for (var k = 0; k < L.points.length; k++) ul.appendChild(el('li', null, L.points[k]));
    layer.appendChild(ul);
    stack.appendChild(layer);
    if (i < DEPLOY_STACK.length - 1) stack.appendChild(el('div', 'stack-arrow', '▼'));
  }
  stackCard.appendChild(stack);
  wrap.appendChild(stackCard);

  /* ================= B. FP16 + 瓶颈 ================= */
  var g1 = el('div', 'dep-grid-2');
  wrap.appendChild(g1);

  var fpCard = el('div', 'card');
  fpCard.appendChild(el('div', 'card-title', 'FP16 半精度推理轻量化（表4-1 实测）'));
  var fpToggle = el('div', 'seg-row');
  var segFp32 = el('button', 'seg', 'FP32 全精度');
  var segFp16 = el('button', 'seg', 'FP16 半精度');
  segFp32.addEventListener('click', function () { store.setParam('precision', 'fp32'); });
  segFp16.addEventListener('click', function () { store.setParam('precision', 'fp16'); });
  fpToggle.appendChild(segFp32); fpToggle.appendChild(segFp16);
  fpCard.appendChild(fpToggle);
  var fpTable = el('div', 'card-body');
  fpCard.appendChild(fpTable);
  var fpBox = el('div', 'chart-box');
  fpCard.appendChild(fpBox);
  fpCard.appendChild(el('div', 'card-hint',
    'FP16 每值 2 字节（FP32 为 4 字节），Volta 起的 Tensor Core 对 FP16 矩阵乘加提供硬件加速。'
    + '实测速度提升约 1.32 倍、总峰值显存降低约 40.1%，精度基本不变（mAP@0.5 +0.0004）。'
    + '注意：显存不会严格减半——还包含输入张量、中间特征图、CUDA 缓存、临时缓冲与后处理开销。'));
  g1.appendChild(fpCard);

  var benchChart = groupedBar(fpBox, {
    height: 210,
    labels: ['单张耗时(ms)', '等效FPS/10', '最快(ms)', '最慢(ms)', '峰值显存/10(MB)'],
    series: [
      { name: 'FP32', key: 'fp32', color: '#8a93a8', data: [4.00, 25.02, 3.39, 8.16, 40.81] },
      { name: 'FP16', key: 'fp16', color: '#2fbf71', data: [3.02, 33.15, 2.71, 4.08, 24.44] },
    ],
    min: 0, max: 45, ticks: 5, yDigits: 0, maxBar: 20,
    fmtTip: function (v) { return fmt(v, 2); },
  });

  var neckCard = el('div', 'card');
  neckCard.appendChild(el('div', 'card-title', '吞吐瓶颈计算器 · 生产节拍能否被检测系统跟上'));
  neckCard.appendChild(el('div', 'card-hint',
    '每支烟支被 N 台相机各拍 1 张 → 图像速率 = 节拍 x N。相机上限 = 450 fps；'
    + 'GPU 上限 = (1000 / 单张耗时) / N。两者取小即系统上限。这一推导直接解释了 FP16 为何是"部署性价比最高"的优化。'));
  var neckBody = el('div', 'card-body');
  neckCard.appendChild(neckBody);
  var gaugeBox = el('div', 'gauge-row');
  neckCard.appendChild(gaugeBox);
  g1.appendChild(neckCard);

  var gUtil = el('div', 'gauge-cell'); gaugeBox.appendChild(gUtil);
  var gVram = el('div', 'gauge-cell'); gaugeBox.appendChild(gVram);
  var gFps = el('div', 'gauge-cell'); gaugeBox.appendChild(gFps);
  var utilGauge = gauge(gUtil, { value: 0, min: 0, max: 1.4, label: 'GPU 利用率', text: '0%', zones: [{ from: 0, color: '#2fbf71' }, { from: 0.72, color: '#e8a33a' }, { from: 0.98, color: '#e2554f' }] });
  var vramGauge = gauge(gVram, { value: 0, min: 0, max: 8192, label: '显存占用 / 8 GB', text: '0 MB', color: '#b083d6' });
  var fpsGauge = gauge(gFps, { value: 0, min: 0, max: 400, label: '实测等效 FPS', text: '0', color: '#4db8ff' });

  var throughBox = el('div', 'chart-box');
  neckCard.appendChild(throughBox);
  var throughChart = groupedBar(throughBox, {
    height: 190,
    labels: ['当前节拍需求', 'GPU 推理上限', '相机采集上限', '主流卷接机组'],
    series: [{ name: '支/分钟', key: 'cpm', color: '#4db8ff', data: [0, 0, 27000, 12000] }],
    min: 0, max: 28000, ticks: 4, yDigits: 0, maxBar: 46,
    fmtY: function (v) { return int(v); },
    fmtTip: function (v) { return int(v) + ' 支/分钟'; },
  });

  /* ================= C. 生产者—消费者 ================= */
  var pcCard = el('div', 'card');
  pcCard.appendChild(el('div', 'card-title', '四相机工作站 · 生产者—消费者调度（图4-3 / 算法4-A、4-B）'));
  pcCard.appendChild(el('div', 'card-hint',
    '4 个生产者线程各自扫描对应相机目录入队；1 个消费者线程公平轮询四路队列（每队列取 B/4 张）聚合后提交 GPU 批量推理，'
    + '结果按相机标识分别更新界面；内置空闲检测，超时无新图自动暂停 GPU 计算。模型管理器为单例（类级+实例级互斥锁），'
    + '牺牲并发换取显存与推理状态稳定。'));
  var pcBox = el('div', 'pc-box');
  pcCard.appendChild(pcBox);
  wrap.appendChild(pcCard);

  var camRows = [];
  for (i = 0; i < 4; i++) {
    var row = el('div', 'pc-row');
    row.appendChild(el('div', 'pc-cam', 'CAM' + (i + 1)));
    row.appendChild(el('div', 'pc-tag', i < 2 ? '下组 · 接驳轮1' : '上组 · 接驳轮2'));
    var q = el('div', 'pc-queue');
    var cells = [];
    for (var c = 0; c < 24; c++) {
      var cell = el('div', 'pc-cell');
      q.appendChild(cell);
      cells.push(cell);
    }
    row.appendChild(q);
    var meta = el('div', 'pc-meta', '0');
    row.appendChild(meta);
    pcBox.appendChild(row);
    camRows.push({ cells: cells, meta: meta });
  }
  var consumer = el('div', 'pc-consumer');
  var cLeft = el('div', 'pc-consumer-l');
  cLeft.appendChild(el('div', 'pc-c-title', '消费者线程 · GPU 批量推理'));
  var cBar = el('div', 'pc-c-bar');
  var cFill = el('div', 'pc-c-fill');
  cBar.appendChild(cFill);
  cLeft.appendChild(cBar);
  var cInfo = el('div', 'pc-c-info', '空闲');
  cLeft.appendChild(cInfo);
  consumer.appendChild(cLeft);
  var savePool = el('div', 'pc-save');
  savePool.appendChild(el('div', 'pc-c-title', '异步保存线程池'));
  var saveGrid = el('div', 'pc-save-grid');
  var saveCells = [];
  for (i = 0; i < 4; i++) {
    var sc = el('div', 'pc-save-cell', 'W' + (i + 1));
    saveGrid.appendChild(sc);
    saveCells.push(sc);
  }
  savePool.appendChild(saveGrid);
  var saveInfo = el('div', 'pc-c-info', '已保存 0');
  savePool.appendChild(saveInfo);
  consumer.appendChild(savePool);
  pcBox.appendChild(consumer);

  /* ================= D. 三种工作模式 ================= */
  var modeCard = el('div', 'card');
  modeCard.appendChild(el('div', 'card-title', '三种工作模式与线程模型（4.1.4 / 附录算法 2-6）'));
  var modeGrid = el('div', 'mode-grid');
  for (i = 0; i < GUI_MODES.length; i++) {
    var gm = GUI_MODES[i];
    var mc = el('div', 'mode-card');
    mc.appendChild(el('div', 'mode-name', gm.name));
    mc.appendChild(el('div', 'mode-algo', gm.algo));
    mc.appendChild(el('div', 'mode-detail', gm.detail));
    var btn = el('button', 'btn btn-sm', '切换到该模式');
    (function (key) { btn.addEventListener('click', function () { store.setUI('hmiMode', key); store.setUI('view', 'hmi'); }); })(gm.key);
    mc.appendChild(btn);
    modeGrid.appendChild(mc);
  }
  modeCard.appendChild(modeGrid);
  wrap.appendChild(modeCard);

  /* ================= E. 实时刷新 ================= */
  var fpsHist = [];
  var latHist = [];
  var histCard = el('div', 'card');
  histCard.appendChild(el('div', 'card-title', '实时推理性能（滑动窗口 W = 200，算法5）'));
  var histBox = el('div', 'chart-box');
  histCard.appendChild(histBox);
  wrap.appendChild(histCard);
  var histChart = lineChart(histBox, {
    height: 200, yDigits: 1, n: 160,
    series: [
      { name: '等效 FPS', color: '#4db8ff', data: fpsHist, fill: true },
      { name: '视觉链路延迟 ms', color: '#e8a33a', data: latHist, fill: false },
    ],
  });
  var histLegend = el('div', 'legend-row');
  [['等效 FPS', '#4db8ff'], ['视觉链路延迟 (ms)', '#e8a33a']].forEach(function (p) {
    var it = el('span', 'lg');
    var sw = el('i'); sw.style.background = p[1];
    it.appendChild(sw); it.appendChild(el('span', null, p[0]));
    histLegend.appendChild(it);
  });
  histCard.appendChild(histLegend);

  function renderFp() {
    var p = store.params;
    segFp32.classList.toggle('on', p.precision === 'fp32');
    segFp16.classList.toggle('on', p.precision === 'fp16');
    benchChart.setCfg({ highlight: p.precision });
    var a = PRECISION_BENCH.fp32, b = PRECISION_BENCH.fp16;
    var rows = [
      ['mAP@0.5', fmt(a.map50, 4), fmt(b.map50, 4), '+0.0004'],
      ['mAP@0.5:0.95', fmt(a.map5095, 4), fmt(b.map5095, 4), '-0.0005'],
      ['单张耗时 (ms)', fmt(a.msPerImage, 2), fmt(b.msPerImage, 2), '1.32x'],
      ['等效 FPS', fmt(a.fps, 1), fmt(b.fps, 1), '+81.3'],
      ['最快 (ms)', fmt(a.msMin, 2), fmt(b.msMin, 2), '—'],
      ['最慢 (ms)', fmt(a.msMax, 2), fmt(b.msMax, 2), '—'],
      ['总峰值显存 (MB)', fmt(a.vramMB, 1), fmt(b.vramMB, 1), '-40.1%'],
    ];
    fpTable.innerHTML = '';
    var tb = el('table', 'mini-table wide');
    var hr = el('tr');
    ['指标', 'FP32', 'FP16', '变化'].forEach(function (h) { hr.appendChild(el('th', null, h)); });
    tb.appendChild(hr);
    for (var k = 0; k < rows.length; k++) {
      var tr = el('tr');
      tr.appendChild(el('td', 'k', rows[k][0]));
      tr.appendChild(el('td', p.precision === 'fp32' ? 'v on' : 'v', rows[k][1]));
      tr.appendChild(el('td', p.precision === 'fp16' ? 'v on' : 'v', rows[k][2]));
      tr.appendChild(el('td', 'n', rows[k][3]));
      tb.appendChild(tr);
    }
    fpTable.appendChild(tb);
  }

  function renderNeck() {
    var d = engine.derive();
    var p = store.params;
    neckBody.innerHTML = '';
    var m = modelByKey(p.modelKey);
    var rows = [
      ['部署模型', m.name + '（' + m.loss + (m.attn === 'Outlook' ? ' + Outlook' : '') + '）'],
      ['推理精度', p.precision === 'fp16' ? 'FP16 半精度' : 'FP32 全精度'],
      ['GFLOPs / 基线比', fmt(d.complexity.gflops, 1) + ' / x' + fmt(d.flopsRatio, 3)],
      ['单张耗时（推导）', fmt(d.msPerImage, 2) + ' ms'],
      ['批处理尺寸 B', String(p.batchSize)],
      ['每支相机数 N', String(p.camerasPerCigarette)],
      ['图像速率需求', fmt(d.imgPerSec, 1) + ' img/s'],
      ['GPU 图像吞吐上限', fmt(d.gpuFps, 1) + ' img/s'],
      ['系统节拍上限', int(d.systemLimitCPM) + ' 支/分钟'],
      ['瓶颈环节', d.gpuLimitCPM < d.cameraLimitCPM ? 'GPU 推理' : '相机采集'],
    ];
    var tb = el('table', 'mini-table');
    for (var k = 0; k < rows.length; k++) {
      var tr = el('tr');
      tr.appendChild(el('td', 'k', rows[k][0]));
      tr.appendChild(el('td', 'v', rows[k][1]));
      tb.appendChild(tr);
    }
    neckBody.appendChild(tb);
    var warn = el('div', 'notice ' + (d.util > 1 ? 'bad' : (d.util > 0.75 ? 'warn' : 'good')));
    warn.textContent = d.util > 1
      ? ('过载：图像速率超出 GPU 吞吐 ' + pct(d.util - 1, 1) + '，队列将持续增长直至结果超窗（当前策略：'
        + ({ alarm: '报警', stop: '停机', reject: '按异常品剔除' })[p.timeoutPolicy] + '）。'
        + '建议降低节拍至 ' + int(d.systemLimitCPM * 0.9) + ' 支/分钟以下，或启用 FP16 / 改用不含注意力的方案。')
      : (d.util > 0.75
        ? ('接近饱和：GPU 利用率 ' + pct(d.util, 1) + '，视觉延迟将出现明显排队抖动，需增大结果接收窗口或补偿脉冲。')
        : ('余量充足：GPU 利用率 ' + pct(d.util, 1) + '，视觉链路延迟稳定，槽位跟踪补偿量可保持固定值。'));
    neckBody.appendChild(warn);
    throughChart.setCfg({
      series: [{
        name: '支/分钟', key: 'cpm', color: '#4db8ff',
        data: [p.throughputCPM, d.gpuLimitCPM, d.cameraLimitCPM, 12000],
      }],
      max: Math.max(28000, p.throughputCPM * 1.15),
    });
  }

  var acc = 0;
  var histAcc = 0;
  function tick(dtReal) {
    var d = engine.derive();
    var perf = engine.perf();
    var m = engine.measured();
    // 队列
    for (var q = 0; q < 4; q++) {
      var len = engine.camQueues[q].length;
      var cells = camRows[q].cells;
      for (var c = 0; c < cells.length; c++) {
        var on = c < Math.min(cells.length, len);
        if (cells[c].classList.contains('on') !== on) cells[c].classList.toggle('on', on);
      }
      var txt = len + (len >= cells.length ? '+' : '');
      if (camRows[q].meta.textContent !== txt) camRows[q].meta.textContent = txt;
    }
    var busy = !!engine.gpuBatch;
    cFill.style.width = busy ? '100%' : '0%';
    var info = engine.idle ? '空闲检测生效 → GPU 已暂停'
      : (busy ? ('批量推理中：' + engine.gpuBatch.jobs.length + ' 张 · ' + fmt(engine.gpuBatch.dur, 2) + ' ms')
        : '等待队列聚合（每队列取 B/4）');
    if (cInfo.textContent !== info) cInfo.textContent = info;
    cInfo.className = 'pc-c-info' + (engine.idle ? ' idle' : (busy ? ' busy' : ''));
    var totalSaved = 0;
    for (q = 0; q < 4; q++) totalSaved += engine.stats.camSaved[q];
    var st = '已保存标注图像 ' + int(totalSaved) + ' 张';
    if (saveInfo.textContent !== st) saveInfo.textContent = st;
    for (q = 0; q < 4; q++) saveCells[q].classList.toggle('on', busy && q < 2);

    acc += dtReal;
    if (acc > 0.25) {
      acc = 0;
      utilGauge.setCfg({ value: d.util, text: pct(d.util, 1) });
      vramGauge.setCfg({ value: d.vramMB, text: fmt(d.vramMB, 0) + ' MB' });
      fpsGauge.setCfg({ value: perf.fps, text: fmt(perf.fps, 1) });
      renderNeck();
    }
    histAcc += dtReal;
    if (histAcc > 0.5 && store.ui.running) {
      histAcc = 0;
      fpsHist.push(perf.fps || 0);
      latHist.push(m.avgLatency || 0);
      if (fpsHist.length > 160) fpsHist.shift();
      if (latHist.length > 160) latHist.shift();
      histChart.redraw();
    }
  }

  store.on('param', function (e) {
    if (e.key === 'precision' || e.key === '*') renderFp();
    renderNeck();
  });
  renderFp();
  renderNeck();
  return { tick: tick };
}
