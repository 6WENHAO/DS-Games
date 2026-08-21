/**
 * hmi.js —— 第四章 4.2：人机交互界面复刻（图4-4）
 * 严格按论文描述：Material Design 浅色主题，"左显示—右控制"双栏布局，
 * 顶部状态栏（标题/模型文件名/GPU-CPU/显存/时钟），左侧四标签页
 * （图像显示 / 文件列表 / 检测类型 / 实时统计），右侧三分组
 * （控制面板 / 性能统计 / 检测结果）。
 * 图像显示区按 DrawDetections 的逻辑实时合成烟支画面与检测框。
 */
import { DEFECT_CLASSES, GUI_MODES, MODELS, PRECISION_BENCH, modelByKey } from '../data/thesis-data.js';
import { fmt, pct, int, el, hhmmss, clamp } from '../core/store.js';
import { barList } from '../ui/charts.js';

var IMG_W = 720, IMG_H = 540;   // 相机原生分辨率（汇川 VC21-0045C-450-X）

/* ---------------- 烟支画面合成（模拟采集图像 + 检测框绘制） ---------------- */
function drawFrame(ctx, w, h, frame, opts) {
  var o = opts || {};
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  // 采集背景：纯白背景 + 室内白光（3.2.1）
  var bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#fbfbfb');
  bg.addColorStop(1, '#eeeff1');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  if (!frame) {
    ctx.fillStyle = '#9aa3b2';
    ctx.font = '13px "Segoe UI","Microsoft YaHei",system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('等待图像…（启动仿真后自动刷新）', w / 2, h / 2);
    ctx.restore();
    return;
  }
  var sx = w / IMG_W, sy = h / IMG_H;
  // 条形光源造成的轴向亮带
  var lg = ctx.createLinearGradient(0, h * 0.28, 0, h * 0.72);
  lg.addColorStop(0, 'rgba(255,255,255,0)');
  lg.addColorStop(0.5, 'rgba(255,255,255,.55)');
  lg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lg;
  ctx.fillRect(0, h * 0.28, w, h * 0.44);

  // 烟支：卷烟纸段（白，前端）+ 水松纸段（深色）+ 搭口
  var cy = h * 0.5;
  var cigH = h * 0.20;
  var x0 = w * 0.06, x1 = w * 0.94;
  var seam = x0 + (x1 - x0) * 0.66;    // 卷烟纸 57 : 水松纸 27
  var top = cy - cigH / 2;
  // 卷烟纸
  var rodG = ctx.createLinearGradient(0, top, 0, top + cigH);
  rodG.addColorStop(0, '#e8e6e0'); rodG.addColorStop(0.35, '#fdfdfb');
  rodG.addColorStop(0.75, '#f2f0ea'); rodG.addColorStop(1, '#d9d6ce');
  ctx.fillStyle = rodG;
  ctx.fillRect(x0, top, seam - x0, cigH);
  // 水松纸
  var tipG = ctx.createLinearGradient(0, top, 0, top + cigH);
  tipG.addColorStop(0, '#9c6b32'); tipG.addColorStop(0.35, '#c99456');
  tipG.addColorStop(0.75, '#b07f42'); tipG.addColorStop(1, '#8a5c28');
  ctx.fillStyle = tipG;
  ctx.fillRect(seam, top, x1 - seam, cigH);
  // 水松纸压花纹理
  ctx.strokeStyle = 'rgba(120,80,35,.30)';
  ctx.lineWidth = 0.8;
  for (var q = seam + 4; q < x1; q += 7) {
    ctx.beginPath(); ctx.moveTo(q, top + 2); ctx.lineTo(q + 3, top + cigH - 2); ctx.stroke();
  }
  // 搭口线
  ctx.strokeStyle = 'rgba(90,60,25,.55)';
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(seam, top); ctx.lineTo(seam, top + cigH); ctx.stroke();
  // 端面
  ctx.fillStyle = '#cdb98f';
  ctx.fillRect(x1 - 3, top, 3, cigH);
  ctx.fillStyle = '#d9cbb0';
  ctx.fillRect(x0, top, 3, cigH);

  // 缺陷形态绘制
  var cls = frame.trueClass;
  if (cls !== null && cls !== undefined) {
    ctx.save();
    var inTip = DEFECT_CLASSES[cls].zone !== '卷烟纸';
    var dx = inTip ? seam + (x1 - seam) * (0.25 + 0.5 * ((frame.id % 7) / 7))
      : x0 + (seam - x0) * (0.2 + 0.6 * ((frame.id % 5) / 5));
    var dy = cy + (cigH * 0.22) * (((frame.id % 3) - 1));
    ctx.globalAlpha = 0.92;
    if (cls === 1) { // 卷烟纸黄斑
      var gr = ctx.createRadialGradient(dx, dy, 1, dx, dy, cigH * 0.42);
      gr.addColorStop(0, 'rgba(226,196,86,.95)'); gr.addColorStop(1, 'rgba(226,196,86,0)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.ellipse(dx, dy, cigH * 0.42, cigH * 0.3, 0.3, 0, Math.PI * 2); ctx.fill();
    } else if (cls === 6) { // 黑点
      ctx.fillStyle = 'rgba(46,44,44,.92)';
      for (q = 0; q < 4; q++) {
        ctx.beginPath();
        ctx.arc(dx + (q % 2) * 6 - 3, dy + Math.floor(q / 2) * 5 - 2, 1.6 + (q % 2), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (cls === 5) { // 刺破
      ctx.fillStyle = 'rgba(60,50,40,.95)';
      ctx.beginPath();
      ctx.ellipse(dx, dy, 4.2, 2.6, 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(150,120,90,.8)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(dx, dy, 6, 4, 0.6, 0, Math.PI * 2); ctx.stroke();
    } else if (cls === 4) { // 布带印
      ctx.strokeStyle = 'rgba(150,152,160,.75)'; ctx.lineWidth = 1.4;
      for (q = 0; q < 5; q++) {
        ctx.beginPath();
        ctx.moveTo(dx - 14 + q * 7, top + 2);
        ctx.lineTo(dx - 10 + q * 7, top + cigH - 2);
        ctx.stroke();
      }
    } else if (cls === 3) { // 翘边
      ctx.fillStyle = 'rgba(245,244,240,.95)';
      ctx.beginPath();
      ctx.moveTo(dx - 16, top + cigH);
      ctx.quadraticCurveTo(dx, top + cigH + cigH * 0.42, dx + 16, top + cigH);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(120,90,50,.7)'; ctx.lineWidth = 1.2; ctx.stroke();
    } else if (cls === 2) { // 翻白
      ctx.fillStyle = 'rgba(250,250,248,.97)';
      ctx.beginPath();
      ctx.moveTo(x1 - 2, top + 2); ctx.lineTo(x1 - 16, top + 4);
      ctx.lineTo(x1 - 12, top + cigH - 4); ctx.lineTo(x1 - 2, top + cigH - 2);
      ctx.closePath(); ctx.fill();
    } else if (cls === 7) { // 水松纸皱
      ctx.strokeStyle = 'rgba(96,64,26,.85)'; ctx.lineWidth = 1.5;
      for (q = 0; q < 6; q++) {
        ctx.beginPath();
        var bx = dx - 18 + q * 6;
        ctx.moveTo(bx, top + 3);
        ctx.bezierCurveTo(bx + 5, top + cigH * 0.35, bx - 4, top + cigH * 0.7, bx + 3, top + cigH - 3);
        ctx.stroke();
      }
    } else if (cls === 8) { // 水松纸破
      ctx.fillStyle = 'rgba(240,238,232,.96)';
      ctx.beginPath();
      ctx.moveTo(dx - 9, dy - 6); ctx.lineTo(dx - 2, dy - 9); ctx.lineTo(dx + 6, dy - 3);
      ctx.lineTo(dx + 9, dy + 5); ctx.lineTo(dx + 1, dy + 8); ctx.lineTo(dx - 7, dy + 3);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(80,50,20,.85)'; ctx.lineWidth = 1.1; ctx.stroke();
    } else if (cls === 0) { // 搭口夹杂
      ctx.fillStyle = 'rgba(140,104,52,.95)';
      for (q = 0; q < 5; q++) {
        ctx.save();
        ctx.translate(seam + 2 + (q % 3) * 2, cy - cigH * 0.3 + q * 4);
        ctx.rotate(q * 0.7);
        ctx.fillRect(0, 0, 6, 1.6);
        ctx.restore();
      }
    } else if (cls === 9) { // 错牙
      ctx.fillStyle = 'rgba(205,166,110,.95)';
      ctx.fillRect(seam - 3, top, 6, cigH * 0.45);
      ctx.strokeStyle = 'rgba(85,55,20,.9)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(seam + 3, top); ctx.lineTo(seam + 3, top + cigH * 0.45);
      ctx.lineTo(seam - 3, top + cigH * 0.45); ctx.lineTo(seam - 3, top + cigH); ctx.stroke();
    } else if (cls === 10) { // 无胶开胶
      ctx.strokeStyle = 'rgba(70,45,18,.9)'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(seam + 3, top + 1);
      ctx.quadraticCurveTo(seam + 12, top + cigH * 0.5, seam + 4, top + cigH - 1);
      ctx.stroke();
      ctx.fillStyle = 'rgba(250,248,244,.9)';
      ctx.beginPath();
      ctx.moveTo(seam + 3, top + 1); ctx.quadraticCurveTo(seam + 14, top + cigH * 0.5, seam + 4, top + cigH - 1);
      ctx.lineTo(seam + 3, top + 1); ctx.fill();
    } else if (cls === 11) { // 烟支翻折
      ctx.fillStyle = bg;
      ctx.fillRect(x0, top - 4, seam - x0, cigH + 8);
      ctx.save();
      ctx.translate(x0, cy);
      var seg = (seam - x0) / 2;
      ctx.fillStyle = rodG;
      ctx.fillRect(0, -cigH / 2, seg, cigH);
      ctx.translate(seg, 0);
      ctx.rotate(0.42);
      ctx.fillRect(0, -cigH / 2, seg, cigH);
      ctx.strokeStyle = 'rgba(120,110,95,.8)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(0, -cigH / 2); ctx.lineTo(0, cigH / 2); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // 检测框（DrawDetections）
  var boxes = frame.boxes || [];
  ctx.lineWidth = 2;
  ctx.font = 'bold 11px "Segoe UI","Microsoft YaHei",system-ui';
  for (var b = 0; b < boxes.length; b++) {
    var bx = boxes[b];
    var col = DEFECT_CLASSES[bx.cls].color;
    var rx = bx.x1 * sx, ry = bx.y1 * sy, rw = bx.w * sx, rh = bx.h * sy;
    ctx.strokeStyle = col;
    ctx.strokeRect(rx, ry, rw, rh);
    var lbl = DEFECT_CLASSES[bx.cls].name + ' ' + fmt(bx.conf, 2);
    var tw = ctx.measureText(lbl).width + 8;
    ctx.fillStyle = col;
    ctx.fillRect(rx, Math.max(0, ry - 15), tw, 15);
    ctx.fillStyle = '#101318';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(lbl, rx + 4, Math.max(7, ry - 7.5));
  }
  // 角标
  ctx.fillStyle = 'rgba(20,24,30,.62)';
  ctx.fillRect(0, 0, 176, 19);
  ctx.fillStyle = '#e9eef5';
  ctx.font = '11px "Consolas",monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('CAM' + ((o.cam || 0) + 1) + '  #' + frame.id + '  ' + IMG_W + 'x' + IMG_H + '  ' + fmt(frame.ms, 2) + 'ms', 6, 10);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
export function createHMI(host, store, engine) {
  host.innerHTML = '';
  var root = el('div', 'hmi-root');
  host.appendChild(root);

  /* ---------- 顶部状态栏 ---------- */
  var bar = el('div', 'hmi-bar');
  var title = el('div', 'hmi-title', '烟支外观缺陷检测系统  ·  Cigarette Defect Detection');
  bar.appendChild(title);
  var spacer = el('div', 'hmi-spacer');
  bar.appendChild(spacer);
  var mdl = el('div', 'hmi-chip', '模型：—');
  var dev = el('div', 'hmi-chip dev', 'GPU');
  var vram = el('div', 'hmi-chip', '显存 —');
  var clock = el('div', 'hmi-chip clock', '--:--:--');
  bar.appendChild(mdl); bar.appendChild(dev); bar.appendChild(vram); bar.appendChild(clock);
  root.appendChild(bar);

  var body = el('div', 'hmi-body');
  root.appendChild(body);

  /* ================= 左侧显示区 ================= */
  var leftCol = el('div', 'hmi-left');
  body.appendChild(leftCol);
  var tabs = el('div', 'hmi-tabs');
  var TABS = [['image', '图像显示'], ['files', '文件列表'], ['classes', '检测类型'], ['stats', '实时统计']];
  var tabEls = {}, paneEls = {};
  for (var i = 0; i < TABS.length; i++) {
    var tb = el('div', 'hmi-tab', TABS[i][1]);
    (function (k) { tb.addEventListener('click', function () { setTab(k); }); })(TABS[i][0]);
    tabs.appendChild(tb);
    tabEls[TABS[i][0]] = tb;
  }
  leftCol.appendChild(tabs);
  var paneWrap = el('div', 'hmi-panes');
  leftCol.appendChild(paneWrap);
  for (i = 0; i < TABS.length; i++) {
    var pn = el('div', 'hmi-pane');
    paneWrap.appendChild(pn);
    paneEls[TABS[i][0]] = pn;
  }
  function setTab(k) {
    for (var t in tabEls) tabEls[t].classList.toggle('on', t === k);
    for (t in paneEls) paneEls[t].classList.toggle('on', t === k);
  }

  /* --- 图像显示：堆叠控件（单图视图 / 四相机 2x2） --- */
  var imgPane = paneEls.image;
  var stack = el('div', 'hmi-stack');
  imgPane.appendChild(stack);
  var singleView = el('div', 'hmi-single');
  var singleCv = document.createElement('canvas');
  singleView.appendChild(singleCv);
  stack.appendChild(singleView);
  var quadView = el('div', 'hmi-quad');
  var quadCvs = [];
  for (i = 0; i < 4; i++) {
    var cell = el('div', 'hmi-quad-cell');
    var cvq = document.createElement('canvas');
    cell.appendChild(cvq);
    var cap = el('div', 'hmi-quad-cap', 'CAM' + (i + 1) + ' · ' + (i < 2 ? '下组/接驳轮1' : '上组/接驳轮2'));
    cell.appendChild(cap);
    (function (idx) { cell.addEventListener('click', function () { activeCam = idx; }); })(i);
    quadView.appendChild(cell);
    quadCvs.push({ cv: cvq, cell: cell, cap: cap });
  }
  stack.appendChild(quadView);
  var infoBar = el('div', 'hmi-infobar');
  var ibModel = el('span', 'ib', '模型：—');
  var ibDev = el('span', 'ib', '设备：—');
  var ibPrec = el('span', 'ib', '精度：—');
  infoBar.appendChild(ibModel); infoBar.appendChild(ibDev); infoBar.appendChild(ibPrec);
  var nav = el('div', 'hmi-nav');
  var prevBtn = el('button', 'hbtn', '‹ 上一张');
  var idxLab = el('span', 'hmi-navidx', '0 / 0');
  var nextBtn = el('button', 'hbtn', '下一张 ›');
  nav.appendChild(prevBtn); nav.appendChild(idxLab); nav.appendChild(nextBtn);
  infoBar.appendChild(nav);
  imgPane.appendChild(infoBar);

  var activeCam = 0;
  var browseIdx = 0;
  prevBtn.addEventListener('click', function () { browseIdx = Math.max(0, browseIdx - 1); renderSingle(); });
  nextBtn.addEventListener('click', function () { browseIdx = Math.min(Math.max(0, engine.records.length - 1), browseIdx + 1); renderSingle(); });

  /* --- 文件列表 --- */
  var filesPane = paneEls.files;
  var fileList = el('div', 'hmi-filelist');
  filesPane.appendChild(fileList);

  /* --- 检测类型 --- */
  var clsPane = paneEls.classes;
  var clsTable = el('table', 'hmi-table');
  var hr = el('tr');
  ['数值标识', '英文代码 ClassName', '缺陷名称', '产生部位', '特征描述'].forEach(function (h) { hr.appendChild(el('th', null, h)); });
  clsTable.appendChild(hr);
  for (i = 0; i < DEFECT_CLASSES.length; i++) {
    var dc = DEFECT_CLASSES[i];
    var tr = el('tr');
    var td0 = el('td', 'cid');
    var sw = el('i', 'sw');
    sw.style.background = dc.color;
    td0.appendChild(sw);
    td0.appendChild(el('span', null, String(dc.id)));
    tr.appendChild(td0);
    tr.appendChild(el('td', 'mono', dc.code));
    tr.appendChild(el('td', null, dc.name));
    tr.appendChild(el('td', null, dc.zone));
    tr.appendChild(el('td', 'desc', dc.desc));
    clsTable.appendChild(tr);
  }
  clsPane.appendChild(clsTable);

  /* --- 实时统计 --- */
  var statsPane = paneEls.stats;
  var statKpi = el('div', 'hmi-kpis');
  statsPane.appendChild(statKpi);
  var statBars = el('div', 'hmi-bars');
  statsPane.appendChild(statBars);
  var statBtns = el('div', 'hmi-btnrow');
  var resetBtn = el('button', 'hbtn', '重置统计');
  var expJson = el('button', 'hbtn', '导出 JSON');
  var expCsv = el('button', 'hbtn', '导出 CSV');
  statBtns.appendChild(resetBtn); statBtns.appendChild(expJson); statBtns.appendChild(expCsv);
  statsPane.appendChild(statBtns);
  resetBtn.addEventListener('click', function () { engine.reset(); });
  expJson.addEventListener('click', function () { exportData('json'); });
  expCsv.addEventListener('click', function () { exportData('csv'); });

  /* ================= 右侧控制区 ================= */
  var rightCol = el('div', 'hmi-right');
  body.appendChild(rightCol);

  /* --- 控制面板 --- */
  var ctrlG = el('div', 'hmi-group');
  ctrlG.appendChild(el('div', 'hmi-group-title', '控制面板'));
  var modeBox = el('div', 'hmi-sub');
  modeBox.appendChild(el('div', 'hmi-sub-title', '模式选择'));
  var radios = [];
  for (i = 0; i < GUI_MODES.length; i++) {
    var lab = el('label', 'hmi-radio');
    var rd = document.createElement('input');
    rd.type = 'radio'; rd.name = 'hmimode';
    lab.appendChild(rd);
    lab.appendChild(el('span', null, GUI_MODES[i].name));
    (function (k) { rd.addEventListener('change', function () { store.setUI('hmiMode', k); }); })(GUI_MODES[i].key);
    modeBox.appendChild(lab);
    radios.push({ key: GUI_MODES[i].key, input: rd });
  }
  ctrlG.appendChild(modeBox);

  var paramBox = el('div', 'hmi-sub');
  paramBox.appendChild(el('div', 'hmi-sub-title', '参数调节'));
  function slider(parent, label, key, min, max, step, fmtFn) {
    var row = el('div', 'hmi-slider');
    var top = el('div', 'hmi-slider-top');
    top.appendChild(el('span', null, label));
    var val = el('span', 'hmi-slider-val');
    top.appendChild(val);
    row.appendChild(top);
    var inp = document.createElement('input');
    inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step;
    inp.value = store.params[key];
    row.appendChild(inp);
    parent.appendChild(row);
    function sync() {
      inp.value = store.params[key];
      val.textContent = fmtFn ? fmtFn(store.params[key]) : String(store.params[key]);
    }
    inp.addEventListener('input', function () { store.setParam(key, parseFloat(inp.value)); });
    store.on('param', sync);
    sync();
    return { sync: sync };
  }
  slider(paramBox, '置信度阈值 conf', 'confThreshold', 0.05, 0.9, 0.01, function (v) { return fmt(v, 2); });
  slider(paramBox, 'IoU 阈值（NMS）', 'iouThreshold', 0.3, 0.95, 0.05, function (v) { return fmt(v, 2); });
  ctrlG.appendChild(paramBox);

  var runBox = el('div', 'hmi-sub');
  runBox.appendChild(el('div', 'hmi-sub-title', '检测控制'));
  var btnRow1 = el('div', 'hmi-btnrow');
  var loadBtn = el('button', 'hbtn', '加载模型');
  var inputBtn = el('button', 'hbtn', '选择输入');
  btnRow1.appendChild(loadBtn); btnRow1.appendChild(inputBtn);
  runBox.appendChild(btnRow1);
  var btnRow2 = el('div', 'hmi-btnrow');
  var startBtn = el('button', 'hbtn primary', '启动检测');
  var pauseBtn = el('button', 'hbtn', '暂停');
  btnRow2.appendChild(startBtn); btnRow2.appendChild(pauseBtn);
  runBox.appendChild(btnRow2);
  var prog = el('div', 'hmi-prog');
  var progFill = el('div', 'hmi-prog-fill');
  prog.appendChild(progFill);
  runBox.appendChild(prog);
  var statusLab = el('div', 'hmi-status', '就绪 · 模型未加载');
  runBox.appendChild(statusLab);
  ctrlG.appendChild(runBox);

  var dataBox = el('div', 'hmi-sub');
  dataBox.appendChild(el('div', 'hmi-sub-title', '数据管理'));
  var autoLab = el('label', 'hmi-check');
  var autoChk = document.createElement('input');
  autoChk.type = 'checkbox'; autoChk.checked = true;
  autoLab.appendChild(autoChk);
  autoLab.appendChild(el('span', null, '自动保存带标注框图像'));
  dataBox.appendChild(autoLab);
  var dRow = el('div', 'hmi-btnrow');
  var manualExp = el('button', 'hbtn', '手动导出');
  var openDir = el('button', 'hbtn', '打开输出目录');
  dRow.appendChild(manualExp); dRow.appendChild(openDir);
  dataBox.appendChild(dRow);
  var outPath = el('div', 'hmi-path', 'output/  ·  runs/detect/offline/');
  dataBox.appendChild(outPath);
  ctrlG.appendChild(dataBox);
  rightCol.appendChild(ctrlG);

  var modelLoaded = false;
  loadBtn.addEventListener('click', function () {
    modelLoaded = true;
    statusLab.textContent = '模型加载完成 · 预热推理 (WARMUP x 3 + 批量 x4) · CUDA 已同步';
    statusLab.className = 'hmi-status ok';
  });
  inputBtn.addEventListener('click', function () {
    statusLab.textContent = store.ui.hmiMode === 'workstation'
      ? '已绑定 4 个相机监听目录：cam1..cam4/'
      : (store.ui.hmiMode === 'folder' ? '已选择文件夹：dataset/test/images （498 张）' : '已选择图像：cig_00473.bmp');
    statusLab.className = 'hmi-status ok';
  });
  startBtn.addEventListener('click', function () {
    if (!modelLoaded) { modelLoaded = true; }
    store.setUI('running', !store.ui.running);
  });
  pauseBtn.addEventListener('click', function () { store.setUI('running', false); });
  manualExp.addEventListener('click', function () { exportData('csv'); });
  openDir.addEventListener('click', function () {
    statusLab.textContent = '输出目录：output/  （浏览器沙箱内为模拟操作）';
  });

  /* --- 性能统计面板 --- */
  var perfG = el('div', 'hmi-group');
  perfG.appendChild(el('div', 'hmi-group-title', '性能统计（滑动窗口 · 每秒刷新）'));
  var perfGrid = el('div', 'hmi-perf');
  var perfCells = {};
  var PERF_KEYS = [['avg', '平均耗时'], ['min', '最快耗时'], ['max', '最慢耗时'], ['fps', '等效帧率'], ['frames', '已处理帧'], ['total', '总运行时间']];
  for (i = 0; i < PERF_KEYS.length; i++) {
    var pc = el('div', 'hmi-perf-cell');
    var pv = el('div', 'hmi-perf-v', '—');
    pc.appendChild(pv);
    pc.appendChild(el('div', 'hmi-perf-k', PERF_KEYS[i][1]));
    perfGrid.appendChild(pc);
    perfCells[PERF_KEYS[i][0]] = pv;
  }
  perfG.appendChild(perfGrid);
  rightCol.appendChild(perfG);

  /* --- 检测结果面板 --- */
  var resG = el('div', 'hmi-group grow');
  var resTitle = el('div', 'hmi-group-title', '检测结果');
  resG.appendChild(resTitle);
  var resSummary = el('div', 'hmi-res-sum', '等待检测…');
  resG.appendChild(resSummary);
  var resWrap = el('div', 'hmi-res-wrap');
  resG.appendChild(resWrap);
  var resTable = el('table', 'hmi-table res');
  var rh2 = el('tr');
  ['序号', '类别名', '置信度', 'x1', 'y1', 'x2', 'y2', '面积'].forEach(function (h) { rh2.appendChild(el('th', null, h)); });
  resTable.appendChild(rh2);
  var resBody = el('tbody');
  resTable.appendChild(resBody);
  resWrap.appendChild(resTable);
  var camPanels = el('div', 'hmi-campanels');
  var camPanelEls = [];
  for (i = 0; i < 4; i++) {
    var cp = el('div', 'hmi-campanel');
    cp.appendChild(el('div', 'hmi-cp-title', 'CAM' + (i + 1) + ' 通道'));
    var cpb = el('div', 'hmi-cp-body');
    cp.appendChild(cpb);
    camPanels.appendChild(cp);
    camPanelEls.push(cpb);
  }
  resG.appendChild(camPanels);
  rightCol.appendChild(resG);

  /* ================= 导出 ================= */
  function exportData(kind) {
    var recs = engine.records;
    var name = 'cigarette_detect_' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    var blob, text;
    if (kind === 'csv') {
      var lines = ['seq,cigarette_id,time_ms,class_id,class_code,class_name,confidence,camera,boxes,x1,y1,x2,y2,area,latency_ms,slot,slot_error,outcome'];
      for (var i2 = 0; i2 < recs.length; i2++) {
        var r = recs[i2];
        var dc2 = r.cls !== null && r.cls !== undefined ? DEFECT_CLASSES[r.cls] : null;
        var bx = r.box;
        lines.push([
          r.seq, r.id, fmt(r.t, 2), r.cls === null ? '' : r.cls,
          dc2 ? dc2.code : '', dc2 ? dc2.name : '', fmt(r.conf, 4),
          'CAM' + (r.cam + 1), r.boxes,
          bx ? bx.x1 : '', bx ? bx.y1 : '', bx ? bx.x1 + bx.w : '', bx ? bx.y1 + bx.h : '',
          bx ? bx.w * bx.h : '', fmt(r.latency, 3), r.slot, r.slotError, r.outcome,
        ].join(','));
      }
      text = lines.join('\n');
      blob = new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' });
      name += '.csv';
    } else {
      var payload = {
        meta: {
          exportedAt: new Date().toISOString(),
          model: modelByKey(store.params.modelKey).name,
          precision: store.params.precision,
          conf: store.params.confThreshold, iou: store.params.iouThreshold,
          throughputCPM: store.params.throughputCPM,
        },
        stats: engine.stats,
        measured: engine.measured(),
        perf: engine.perf(),
        records: recs,
      };
      text = JSON.stringify(payload, null, 2);
      blob = new Blob([text], { type: 'application/json' });
      name += '.json';
    }
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
    statusLab.textContent = '已导出 ' + name + '（' + recs.length + ' 条记录）';
    statusLab.className = 'hmi-status ok';
  }

  /* ================= 渲染 ================= */
  function fitCanvas(cv, box) {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return null;
    var ar = IMG_W / IMG_H;
    var cw = w, chh = w / ar;
    if (chh > h) { chh = h; cw = h * ar; }
    cv.style.width = Math.floor(cw) + 'px';
    cv.style.height = Math.floor(chh) + 'px';
    cv.width = Math.round(cw * dpr);
    cv.height = Math.round(chh * dpr);
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: cw, h: chh };
  }

  function frameFromRecord(rec) {
    if (!rec) return null;
    return {
      id: rec.id, trueClass: rec.trueCls,
      boxes: rec.box ? [rec.box] : [], ms: rec.latency || 0,
    };
  }

  function renderSingle() {
    var f = fitCanvas(singleCv, singleView);
    if (!f) return;
    var mode = store.ui.hmiMode;
    var frame;
    if (mode === 'workstation') {
      frame = engine.lastFrames[activeCam];
      drawFrame(f.ctx, f.w, f.h, frame, { cam: activeCam });
    } else if (mode === 'folder') {
      var rec = engine.records[Math.min(browseIdx, Math.max(0, engine.records.length - 1))];
      drawFrame(f.ctx, f.w, f.h, frameFromRecord(rec), { cam: rec ? rec.cam : 0 });
      idxLab.textContent = (engine.records.length ? (browseIdx + 1) : 0) + ' / ' + engine.records.length;
    } else {
      var rec2 = engine.records[0];
      drawFrame(f.ctx, f.w, f.h, frameFromRecord(rec2), { cam: rec2 ? rec2.cam : 0 });
      idxLab.textContent = engine.records.length ? '1 / 1' : '0 / 0';
    }
  }

  function renderQuad() {
    for (var i2 = 0; i2 < 4; i2++) {
      var f = fitCanvas(quadCvs[i2].cv, quadCvs[i2].cell);
      if (!f) continue;
      drawFrame(f.ctx, f.w, f.h, engine.lastFrames[i2], { cam: i2 });
      quadCvs[i2].cell.classList.toggle('active', activeCam === i2);
      var s = engine.stats;
      quadCvs[i2].cap.textContent = 'CAM' + (i2 + 1) + ' · ' + (i2 < 2 ? '下组/接驳轮1' : '上组/接驳轮2')
        + ' · 帧 ' + int(s.camFrames[i2]) + ' · 存 ' + int(s.camSaved[i2]);
    }
  }

  var lastRecCount = -1;
  var lastMode = null;
  function renderResults() {
    var mode = store.ui.hmiMode;
    var s = engine.stats;
    if (mode === 'workstation') {
      resWrap.style.display = 'none';
      camPanels.style.display = '';
      resTitle.textContent = '检测结果 · 四相机通道';
      for (var i2 = 0; i2 < 4; i2++) {
        var f = engine.lastFrames[i2];
        var b = camPanelEls[i2];
        var txt = '帧 ' + int(s.camFrames[i2]) + ' · 已保存 ' + int(s.camSaved[i2]);
        var cls = f && f.boxes.length ? DEFECT_CLASSES[f.boxes[0].cls] : null;
        b.innerHTML = '';
        b.appendChild(el('div', 'cp-line', txt));
        var d2 = el('div', 'cp-line');
        if (cls) {
          var sw2 = el('i', 'sw');
          sw2.style.background = cls.color;
          d2.appendChild(sw2);
          d2.appendChild(el('span', null, cls.name + '  ' + fmt(f.boxes[0].conf, 3)));
        } else {
          d2.appendChild(el('span', 'muted', f ? '未检出缺陷' : '等待图像'));
        }
        b.appendChild(d2);
      }
    } else {
      resWrap.style.display = '';
      camPanels.style.display = 'none';
      resTitle.textContent = '检测结果 · 详情';
      if (lastRecCount === engine.records.length && lastMode === mode) return;
      lastRecCount = engine.records.length;
      lastMode = mode;
      resBody.innerHTML = '';
      var recs = engine.records.slice(0, 60);
      for (i2 = 0; i2 < recs.length; i2++) {
        var r = recs[i2];
        if (!r.box) continue;
        var dc3 = DEFECT_CLASSES[r.cls];
        var tr2 = el('tr');
        if (r.outcome === 'rejectFalse') tr2.className = 'warn-row';
        if (r.outcome === 'rejectMiss') tr2.className = 'bad-row';
        tr2.appendChild(el('td', null, String(r.seq)));
        var tdc = el('td');
        var sw3 = el('i', 'sw');
        sw3.style.background = dc3.color;
        tdc.appendChild(sw3);
        tdc.appendChild(el('span', null, dc3.name));
        tr2.appendChild(tdc);
        tr2.appendChild(el('td', 'mono', fmt(r.conf, 3)));
        tr2.appendChild(el('td', 'mono', String(r.box.x1)));
        tr2.appendChild(el('td', 'mono', String(r.box.y1)));
        tr2.appendChild(el('td', 'mono', String(r.box.x1 + r.box.w)));
        tr2.appendChild(el('td', 'mono', String(r.box.y1 + r.box.h)));
        tr2.appendChild(el('td', 'mono', int(r.box.w * r.box.h)));
        (function (id) { tr2.addEventListener('click', function () { store.setUI('followCigarette', id); }); })(r.id);
        resBody.appendChild(tr2);
      }
    }
    var m = engine.measured();
    resSummary.textContent = '总检测 ' + int(s.inspected) + ' 支 · 判 NG ' + int(s.TP + s.FP)
      + ' 支 · 已剔除 ' + int(s.rejectedTotal) + ' 支 · 平均置信度 ' + fmt(m.avgConf, 3)
      + ' · 实测 P ' + fmt(m.P, 4) + ' / R ' + fmt(m.R, 4) + ' / F1 ' + fmt(m.F1, 4);
  }

  function renderStats() {
    var s = engine.stats;
    var m = engine.measured();
    var perf = engine.perf();
    var kinds = 0;
    for (var i2 = 0; i2 < s.byClass.length; i2++) if (s.byClass[i2] > 0) kinds++;
    var items = [
      ['总检测数', int(s.inspected)],
      ['类别种数', String(kinds) + ' / 12'],
      ['平均置信度', fmt(m.avgConf, 3)],
      ['检测速度', fmt(perf.fps, 1) + ' FPS'],
    ];
    statKpi.innerHTML = '';
    for (i2 = 0; i2 < items.length; i2++) {
      var k = el('div', 'hmi-kpi');
      k.appendChild(el('div', 'hmi-kpi-v', items[i2][1]));
      k.appendChild(el('div', 'hmi-kpi-k', items[i2][0]));
      statKpi.appendChild(k);
    }
    var list = [];
    for (i2 = 0; i2 < DEFECT_CLASSES.length; i2++) {
      if (s.byClass[i2] > 0) {
        list.push({
          label: DEFECT_CLASSES[i2].name, value: s.byClass[i2], color: DEFECT_CLASSES[i2].color,
          conf: s.byClassConf[i2] / s.byClass[i2],
        });
      }
    }
    list.sort(function (a, b) { return b.value - a.value; });
    barList(statBars, list, {
      empty: '暂无检出记录 —— 启动仿真后按数量降序展示类别分布',
      fmt: function (it) { return it.value + '  (' + pct(it.value / Math.max(1, s.TP + s.FP), 1) + ')  conf ' + fmt(it.conf, 3); },
    });
  }

  function renderFiles() {
    var recs = engine.records.slice(0, 80);
    if (fileList.childElementCount === recs.length + 1) return;
    fileList.innerHTML = '';
    fileList.appendChild(el('div', 'hmi-file-head',
      '文件列表 · 批量模式下罗列全部图像文件，支持点击跳转查看（缺陷复查与样本追溯）'));
    for (var i2 = 0; i2 < recs.length; i2++) {
      var r = recs[i2];
      var row = el('div', 'hmi-file');
      var nm = 'cig_' + String(r.id).padStart(6, '0') + '_cam' + (r.cam + 1) + '.bmp';
      row.appendChild(el('span', 'hf-n', nm));
      var dc4 = r.cls !== null && r.cls !== undefined ? DEFECT_CLASSES[r.cls] : null;
      var tag = el('span', 'hf-tag');
      if (dc4) { tag.textContent = dc4.name; tag.style.color = dc4.color; }
      else tag.textContent = 'OK';
      row.appendChild(tag);
      row.appendChild(el('span', 'hf-c', fmt(r.conf, 3)));
      (function (idx, id) {
        row.addEventListener('click', function () {
          browseIdx = idx;
          store.setUI('followCigarette', id);
          setTab('image');
          renderSingle();
        });
      })(i2, r.id);
      fileList.appendChild(row);
    }
  }

  var acc = 0, accSlow = 0;
  function tick(dtReal) {
    var mode = store.ui.hmiMode;
    for (var i2 = 0; i2 < radios.length; i2++) radios[i2].input.checked = radios[i2].key === mode;
    quadView.style.display = mode === 'workstation' ? '' : 'none';
    singleView.style.display = mode === 'workstation' ? 'none' : '';
    nav.style.display = mode === 'folder' ? '' : 'none';

    var m = modelByKey(store.params.modelKey);
    var fileName = 'yolo11n_' + m.key + '_best.pt';
    if (mdl.textContent !== '模型：' + fileName) mdl.textContent = '模型：' + fileName;
    var d = engine.derive();
    dev.textContent = 'GPU · CUDA 11.8';
    var vr = d.vramMB;
    vram.textContent = '显存 ' + fmt(vr, 0) + ' MB / 8192 MB (' + pct(vr / 8192, 1) + ')';
    ibModel.textContent = '模型：' + fileName;
    ibDev.textContent = '设备：cuda:0 · RTX 3070 Ti';
    ibPrec.textContent = '精度：' + (store.params.precision === 'fp16' ? 'FP16 半精度' : 'FP32 全精度');
    startBtn.textContent = store.ui.running ? (mode === 'workstation' ? '停止' : '暂停检测') : '启动检测';
    startBtn.classList.toggle('danger', store.ui.running);
    if (store.ui.running) {
      statusLab.className = 'hmi-status run';
      statusLab.textContent = engine.idle ? '空闲检测生效 · GPU 已暂停' :
        ('运行中 · ' + ({ image: '单图检测线程', folder: '批量预读流水线', workstation: '四相机生产者-消费者' })[mode]);
    }
    var s = engine.stats;
    progFill.style.width = mode === 'folder'
      ? clamp(engine.records.length / 498, 0, 1) * 100 + '%'
      : (store.ui.running ? '100%' : '0%');

    var perf = engine.perf();
    perfCells.avg.textContent = fmt(perf.avg, 2) + ' ms';
    perfCells.min.textContent = fmt(perf.min, 2) + ' ms';
    perfCells.max.textContent = fmt(perf.max, 2) + ' ms';
    perfCells.fps.textContent = fmt(perf.fps, 1);
    perfCells.frames.textContent = int(perf.frames);
    perfCells.total.textContent = hhmmss(perf.totalMs);

    var now = new Date();
    clock.textContent = now.toTimeString().slice(0, 8);

    acc += dtReal;
    if (acc > 0.1) {
      acc = 0;
      if (mode === 'workstation') renderQuad(); else renderSingle();
    }
    accSlow += dtReal;
    if (accSlow > 0.45) {
      accSlow = 0;
      renderResults();
      renderStats();
      renderFiles();
    }
  }

  setTab('image');
  store.setUI('hmiMode', store.ui.hmiMode || 'workstation');
  setTimeout(function () { renderQuad(); renderSingle(); }, 60);
  return { tick: tick, setTab: setTab, exportData: exportData };
}
