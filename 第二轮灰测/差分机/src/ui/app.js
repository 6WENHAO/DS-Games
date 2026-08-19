/* =====================================================================
 * app.js —— 交互、渲染循环、页面读数与校验
 * 页面上显示的每一个数字都来自 machine.digit()，也就是齿轮转角本身。
 * ===================================================================== */
(function () {
  'use strict';
  var DE = window.DE, THREE = window.THREE, TAU = Math.PI * 2;
  var M = DE.Machine, MATH = DE.math;

  var app = {
    machine: null, model: null, sync: null,
    running: false, speed: 0.35,       // 圈/秒
    target: null, lastT: 0, lastHud: 0,
    nColumns: 4, nDigits: 6, x0: 0,
    L: null, Linv: null,
    ideal: null,                        // 理想差分向量（独立校验用）
    idealLog: [], jogLast: 0
  };
  window.DEapp = app;

  /* ================= 渲染基础设施 ================= */
  var renderer, scene, camera, controls;
  function initGL() {
    var host = document.getElementById('view');
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    host.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x14171c);
    scene.fog = new THREE.Fog(0x14171c, 26, 60);

    camera = new THREE.PerspectiveCamera(45, host.clientWidth / host.clientHeight, 0.1, 300);
    camera.position.set(2.5, 5.5, 15);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0.6, 0);
    controls.maxDistance = 60;
    controls.minDistance = 1.2;

    scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x2a2118, 0.55));
    var d1 = new THREE.DirectionalLight(0xfff1d8, 1.15); d1.position.set(9, 14, 11); scene.add(d1);
    var d2 = new THREE.DirectionalLight(0x9fc4ff, 0.5); d2.position.set(-11, 7, -9); scene.add(d2);
    var d3 = new THREE.DirectionalLight(0xffffff, 0.32); d3.position.set(0, -6, 6); scene.add(d3);
    scene.add(new THREE.AmbientLight(0x404652, 0.5));

    var grid = new THREE.GridHelper(60, 60, 0x2b3038, 0x1e2228);
    grid.position.y = -3.2; scene.add(grid);

    window.addEventListener('resize', function () {
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    });
  }

  /* ================= 建/重建机器 ================= */
  function rebuild() {
    if (app.model) { scene.remove(app.model.root); disposeTree(app.model.root); }
    var cfg = { nColumns: app.nColumns, nDigits: app.nDigits };
    app.machine = new M(cfg);
    app.machine.x0 = app.x0;
    var lm = MATH.loadingMatrix(app.nColumns);
    app.L = lm.L; app.Linv = lm.Linv;
    app.model = DE.scene.build(cfg);
    scene.add(app.model.root);
    app.sync = new DE.Sync(app.model, app.machine);
    buildInputs();
    applyLayerToggles();
    loadFromInputs();
    fitView('iso');
  }
  function disposeTree(o) {
    o.traverse(function (n) {
      if (n.geometry) n.geometry.dispose();
      if (n.material) { (Array.isArray(n.material) ? n.material : [n.material]).forEach(function (m) { m.dispose(); }); }
    });
  }

  /* ================= 输入区 ================= */
  function buildInputs() {
    var wrap = document.getElementById('coeffs');
    wrap.innerHTML = '';
    var n = app.nColumns;
    var mode = document.querySelector('input[name=inmode]:checked').value;
    for (var i = 0; i < n; i++) {
      var lab = document.createElement('label');
      lab.innerHTML = (mode === 'poly')
        ? '<span>a<sub>' + i + '</sub>·x<sup>' + i + '</sup></span>'
        : '<span>Δ<sup>' + i + '</sup></span>';
      var inp = document.createElement('input');
      inp.type = 'number'; inp.className = 'cf'; inp.dataset.i = i;
      inp.value = defaultCoeff(i, n, mode);
      lab.appendChild(inp);
      wrap.appendChild(lab);
    }
    // 「只看某一列」下拉
    var fs = document.getElementById('focus');
    fs.innerHTML = '<option value="-1">全部</option>';
    for (var c = 0; c < n; c++) {
      var o = document.createElement('option');
      o.value = c; o.textContent = 'D' + c + (c === 0 ? '（结果列）' : '（' + c + ' 阶差分）');
      fs.appendChild(o);
    }
  }
  function defaultCoeff(i, n, mode) {
    if (mode === 'poly') return (i === 2 ? 1 : (i === 0 ? 0 : 0));   // 默认 x^2
    var d = [0, 1, 2, 0, 0, 0, 0, 0];
    return d[i] || 0;
  }

  function readInputs() {
    var vals = [];
    document.querySelectorAll('#coeffs .cf').forEach(function (inp) {
      vals.push(parseInt(inp.value, 10) || 0);
    });
    return vals;
  }

  /* 由输入得到差分向量 d（Δ^0..Δ^n），并算出机械装载值 m = L·d */
  function computeLoad() {
    var mode = document.querySelector('input[name=inmode]:checked').value;
    var vals = readInputs(), n = app.nColumns, d;
    app.x0 = parseInt(document.getElementById('x0').value, 10) || 0;
    if (mode === 'poly') {
      var fv = [];
      for (var k = 0; k <= n; k++) fv.push(MATH.evalPoly(vals, app.x0 + k));
      d = MATH.differenceTable(fv).slice(0, n);
      app.poly = vals.slice();
    } else {
      d = vals.slice(0, n);
      app.poly = null;
    }
    var mm = MATH.applyMatrix(app.L, d).map(function (v) { return MATH.modWrap(v, app.nDigits); });
    return { d: d, m: mm };
  }

  function loadFromInputs() {
    var r = computeLoad();
    app.machine.x0 = app.x0;
    app.machine.loadAll(r.m);
    app.ideal = r.d.slice();
    app.idealLog = [];
    app.target = null; app.running = false;
    document.getElementById('btnRun').textContent = '连续运行';
    refreshHUD();
  }

  /* 理想差分递推（与机械完全独立，仅用于对照校验） */
  function idealStep() {
    var d = app.ideal, n = d.length;
    for (var j = 0; j < n - 1; j++) d[j] = d[j] + d[j + 1];
  }
  function idealValue() { return MATH.modWrap(app.ideal[0], app.nDigits); }

  /* ================= HUD ================= */
  function refreshHUD() {
    var mach = app.machine, nD = app.nDigits, nC = app.nColumns;
    var t = mach.phaseTime(), st = M.stageName(t);
    var phase = mach.phaseIndex();

    document.getElementById('hudCycle').textContent = mach.cycle;
    document.getElementById('hudX').textContent = (mach.x0 + mach.cycle);
    document.getElementById('hudPhase').textContent = (phase === 0 ? 'A（奇数列 → 偶数列）' : 'B（偶数列 → 奇数列）');
    document.getElementById('hudStage').textContent = st.cn + ' / ' + st.en;
    document.getElementById('hudAngle').textContent = (t * 360).toFixed(1) + '°';
    document.getElementById('hudRev').textContent = Math.floor(mach.crank / TAU + 1e-9);
    document.getElementById('hudCarry').textContent = mach.totalCarries;
    var ov = document.getElementById('hudOver');
    ov.textContent = mach.overflow ? '是（最高位进位丢失）' : '否';
    ov.className = mach.overflow ? 'bad' : 'ok';

    // 各列：机械读数（逐位）+ 反算 Δ + 角色
    var regs = mach.readAll();
    var dd = MATH.applyMatrix(app.Linv, regs).map(function (v) { return MATH.modWrap(v, nD); });
    var roles = mach.roles();
    var rows = '';
    for (var c = 0; c < nC; c++) {
      var digits = '';
      for (var k = nD - 1; k >= 0; k--) {
        var warn = mach.wheels[c][k].warn;
        digits += '<b class="' + (warn ? 'dg warn' : 'dg') + '">' + mach.digit(c, k) + '</b>';
      }
      var role = roles[c] === 1 ? '<i class="src">源</i>' : (roles[c] === 2 ? '<i class="dst">目标</i>' : '');
      rows += '<tr><td>D<sub>' + c + '</sub> ' + role + '</td><td class="dgs">' + digits + '</td>'
        + '<td class="num">' + regs[c] + '</td>'
        + '<td class="num">' + MATH.signedRead(dd[c], nD) + '</td></tr>';
    }
    document.getElementById('regBody').innerHTML = rows;

    // 结果日志
    var log = mach.log, out = '';
    for (var i = Math.max(0, log.length - 14); i < log.length; i++) {
      var e = log[i];
      var exp = app.idealLog[i];
      var okk = (exp === undefined) ? '' : (exp === e.value ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>');
      out += '<tr><td class="num">' + e.x + '</td><td class="num">' + e.value + '</td><td class="num">'
        + (exp === undefined ? '—' : exp) + '</td><td>' + okk + '</td></tr>';
    }
    document.getElementById('logBody').innerHTML = out;
    var last = log.length ? log[log.length - 1] : null;
    document.getElementById('hudResult').textContent = last ? last.value : mach.readRegister(0);
  }

  /* ================= 循环 ================= */
  function animate(now) {
    requestAnimationFrame(animate);
    var dt = Math.min(0.05, (now - app.lastT) / 1000 || 0);
    app.lastT = now;

    var step = 0;
    if (app.target !== null) {
      var remain = app.target - app.machine.crank;
      step = Math.min(remain, app.speed * TAU * dt);
      if (step <= 1e-9) { app.target = null; step = 0; }
    } else if (app.running) {
      step = app.speed * TAU * dt;
    }
    if (step > 0) {
      app.machine.advance(step);
      while (app.idealLog.length < app.machine.cycle) { idealStep(); app.idealLog.push(idealValue()); }
      // 读数刷新做节流（表格重绘不必每帧）
      if (now - app.lastHud > 55 || app.target === null) { app.lastHud = now; refreshHUD(); }
    }
    if (app.sync) app.sync.update();
    controls.update();
    renderer.render(scene, camera);
  }

  /* ================= 视角 ================= */
  function fitView(kind) {
    var w = app.model ? app.model.width : 8;
    var d = w * 0.9 + 9;
    var tx = 0.9;                      // 传动系偏向 +X，视点略作补偿
    if (kind === 'front') { camera.position.set(0, 1.2, d * 0.8); tx = 0; }
    else if (kind === 'top') camera.position.set(1.0, d * 0.8, 3.2);   // 高位斜俯视（正上方会导致视角退化）
    else if (kind === 'back') camera.position.set(0, 2.6, -d * 0.85);
    else if (kind === 'side') camera.position.set(d, 1.6, 0.5);
    else camera.position.set(w * 0.35 + 3, 5.2, d * 0.85);
    controls.target.set(tx, 0.4, 0);
    controls.update();
  }

  function applyLayerToggles() {
    document.querySelectorAll('.lyr').forEach(function (cb) {
      if (app.sync) app.sync.setLayer(cb.dataset.g, cb.checked);
    });
  }

  /* ================= 事件绑定 ================= */
  function bind() {
    document.getElementById('nCols').addEventListener('change', function () {
      app.nColumns = parseInt(this.value, 10); rebuild();
    });
    document.getElementById('nDigits').addEventListener('change', function () {
      app.nDigits = parseInt(this.value, 10); rebuild();
    });
    document.querySelectorAll('input[name=inmode]').forEach(function (r) {
      r.addEventListener('change', function () { buildInputs(); });
    });
    document.getElementById('btnLoad').addEventListener('click', loadFromInputs);

    document.getElementById('btnTurn').addEventListener('click', function () {
      var rev = Math.floor(app.machine.crank / TAU + 1e-9);
      app.target = (rev + 1) * TAU; app.running = false;
    });
    document.getElementById('btnCycle').addEventListener('click', function () {
      var rev = Math.floor(app.machine.crank / TAU + 1e-9);
      var need = (rev % 2 === 0) ? 2 : 1;
      app.target = (rev + need) * TAU; app.running = false;
    });
    document.getElementById('btnStage').addEventListener('click', function () {
      // 推进到下一个机构阶段的边界
      var t = app.machine.phaseTime();
      var edges = [];
      var W = M.windows;
      Object.keys(W).forEach(function (k) { edges.push(W[k][0], W[k][1]); });
      edges.push(1);
      edges.sort(function (a, b) { return a - b; });
      var nxt = edges.find(function (e) { return e > t + 1e-6; });
      var rev = Math.floor(app.machine.crank / TAU + 1e-9);
      app.target = (rev + (nxt === undefined ? 1 : nxt)) * TAU;
      app.running = false;
    });
    document.getElementById('btnRun').addEventListener('click', function () {
      app.running = !app.running; app.target = null;
      this.textContent = app.running ? '暂停' : '连续运行';
    });
    document.getElementById('speed').addEventListener('input', function () {
      app.speed = parseFloat(this.value);
      document.getElementById('speedLbl').textContent = app.speed.toFixed(2) + ' 圈/秒';
    });
    var jog = document.getElementById('jog');
    jog.addEventListener('input', function () {
      var v = parseFloat(this.value);
      var dv = v - app.jogLast;
      if (dv < 0) dv += 100;                     // 无级回绕：手柄只能正转
      app.jogLast = v;
      app.running = false; app.target = null;
      app.machine.advance(dv / 100 * TAU);
      while (app.idealLog.length < app.machine.cycle) { idealStep(); app.idealLog.push(idealValue()); }
      refreshHUD();
    });
    document.getElementById('btnReset').addEventListener('click', loadFromInputs);

    document.querySelectorAll('.view').forEach(function (b) {
      b.addEventListener('click', function () { fitView(this.dataset.v); });
    });
    document.querySelectorAll('.lyr').forEach(function (cb) {
      cb.addEventListener('change', applyLayerToggles);
    });
    document.getElementById('explode').addEventListener('input', function () {
      app.sync.explode = parseFloat(this.value);
    });
    document.getElementById('focus').addEventListener('change', function () {
      app.sync.focusColumn(parseInt(this.value, 10));
    });
    document.getElementById('hl').addEventListener('change', function () {
      app.sync.highlight = this.checked;
    });

    /* 快速校验：不画动画，直接把机构跑 N 个循环，逐个比对 */
    document.getElementById('btnVerify').addEventListener('click', function () {
      var n = parseInt(document.getElementById('vCount').value, 10) || 20;
      var r = computeLoad();
      var mach = new M({ nColumns: app.nColumns, nDigits: app.nDigits });
      mach.x0 = app.x0;
      mach.loadAll(r.m);
      var d = r.d.slice(), bad = 0, lines = [];
      for (var k = 1; k <= n; k++) {
        mach.runCycles(1);
        for (var j = 0; j < d.length - 1; j++) d[j] = d[j] + d[j + 1];
        var expect = MATH.modWrap(d[0], app.nDigits);
        var got = mach.readRegister(0);
        var pv = app.poly ? MATH.modWrap(MATH.evalPoly(app.poly, app.x0 + k), app.nDigits) : null;
        var okk = (got === expect) && (pv === null || pv === got);
        if (!okk) bad++;
        if (k <= 200) lines.push('x=' + (app.x0 + k) + '  齿轮读数=' + got + '  应为=' + expect
          + (pv !== null ? '  多项式=' + pv : '') + (okk ? '  ✓' : '  ✗'));
      }
      var box = document.getElementById('verifyOut');
      box.className = bad ? 'vout bad' : 'vout ok';
      box.textContent = (bad ? ('✗ ' + bad + ' / ' + n + ' 个循环不符\n') :
        ('✓ 全部 ' + n + ' 个循环：从齿轮转角读出的结果与差分表/多项式完全一致\n'))
        + '（机构累计进位 ' + mach.totalCarries + ' 次' + (mach.overflow ? '，发生过最高位溢出' : '') + '）\n'
        + lines.join('\n');
    });
  }

  /* ================= 启动 ================= */
  window.addEventListener('DOMContentLoaded', function () {
    initGL();
    bind();
    rebuild();
    document.getElementById('speedLbl').textContent = app.speed.toFixed(2) + ' 圈/秒';
    requestAnimationFrame(function (t) { app.lastT = t; animate(t); });
  });
})();
