/* =============================================================================
 * main.js - application layer: fixed-step loop, telemetry, controls, benchmark
 *           orchestration. No dependencies.
 * ========================================================================== */
(function (global) {
  'use strict';
  var CFD = global.CFD;
  var SIM_DT = 1 / 60;            /* fixed timestep: one sim frame per render frame */
  var SPARK_MAX_MS = 40;

  /* canonical, comparable benchmark workload */
  var CANON = {
    count: 3000, gravity: 9.81, viscosity: 0.20, restitution: 0.25, friction: 0.08,
    iterations: 3, substeps: 1, velocityScale: 3.0,
    renderW: 1280, renderH: 720,
    cam: { az: 0.75, el: 0.28, dist: 2.20, target: [0, 0.42, 0], fov: 42 }
  };

  function dom(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function f2(v) { return v.toFixed(2); }

  /* ---- diagnostics panel (always dismissible) and non-blocking alert bar ---- */
  var diagText = '';

  function showDiag(title, body) {
    var box = dom('fatal');
    if (!box) return;
    diagText = String(body);
    dom('fatal-title').textContent = title;
    dom('fatal-msg').textContent = diagText;
    box.hidden = false;
  }

  function hideDiag() { var b = dom('fatal'); if (b) b.hidden = true; }

  var recentErrors = [];
  function noteError(msg) {
    recentErrors.push(new Date().toISOString().slice(11, 19) + '  ' + msg);
    if (recentErrors.length > 6) recentErrors.shift();
  }

  var alertsShown = 0;
  function notify(msg) {
    var bar = dom('alert');
    if (!bar) return;
    if (alertsShown >= 4) return;               /* never spam, never block */
    alertsShown++;
    dom('alert-msg').textContent = String(msg).slice(0, 180);
    bar.hidden = false;
  }

  function copyText(text, btn) {
    var done = function () {
      var old = btn.textContent;
      btn.textContent = 'COPIED';
      setTimeout(function () { btn.textContent = old; }, 1400);
    };
    if (global.navigator && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { legacy(); });
    } else { legacy(); }
    function legacy() {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        done();
      } catch (e) { btn.textContent = 'SELECT AND COPY ABOVE'; }
    }
  }

  function webglProbe() {
    var out = { webgl2: false, webgl1: false, error: null };
    try {
      var c = document.createElement('canvas');
      out.webgl2 = !!c.getContext('webgl2');
      out.webgl1 = !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
    } catch (e) { out.error = e && e.message ? e.message : String(e); }
    return out;
  }

  function buildDiag(app, err) {
    var nav = global.navigator, scr = global.screen, L = [];
    L.push('CFD-SPH-BENCH 1.0.0 DIAGNOSTICS');
    L.push('time            ' + new Date().toISOString());
    L.push('url             ' + global.location.href);
    L.push('protocol        ' + global.location.protocol +
      (global.location.protocol === 'file:'
        ? '   (local file mode: some browsers restrict file:// pages as unique origins; if anything misbehaves, serve the folder over http, e.g. python -m http.server 8000)'
        : ''));
    L.push('userAgent       ' + nav.userAgent);
    L.push('platform        ' + (nav.platform || '-') + '   cores ' +
      (nav.hardwareConcurrency || '-') + '   memory ' + (nav.deviceMemory || '-') + ' GB');
    L.push('viewport        ' + global.innerWidth + 'x' + global.innerHeight +
      '   dpr ' + (global.devicePixelRatio || 1) +
      (scr ? '   screen ' + scr.width + 'x' + scr.height : ''));
    var p = webglProbe();
    L.push('webgl2 / webgl1 ' + p.webgl2 + ' / ' + p.webgl1 + (p.error ? '   probe error: ' + p.error : ''));
    if (app && app.renderer) {
      var i = app.renderer.info();
      L.push('gl renderer     ' + (i.unmaskedRenderer || i.renderer));
      L.push('gl vendor       ' + (i.unmaskedVendor || i.vendor));
      L.push('gl version      ' + i.glVersion);
      L.push('glsl            ' + i.glslVersion);
      L.push('samples         ' + i.antialiasSamples + '   maxPointSize ' + i.maxPointSize);
      L.push('context attempt ' + i.contextAttempt + '   depthCorrected ' + i.impostorDepthCorrection);
      if (i.shaderNote) L.push('shader note     ' + i.shaderNote);
      L.push('backbuffer      ' + app.renderer.w + 'x' + app.renderer.h);
    } else {
      L.push('gl renderer     NONE - running without a renderer');
    }
    if (app && app.solver) {
      var s = app.solver;
      L.push('solver          ' + s.n + ' particles   d ' + (s.spacing * 1000).toFixed(2) +
        ' mm   h ' + (s.h * 1000).toFixed(2) + ' mm   step ' + s.stepIndex);
      L.push('anomalies       nan ' + s.stats.nan + '  escaped ' + s.stats.escaped +
        '  overflow ' + s.stats.overflow);
    }
    if (err) {
      L.push('');
      L.push('ERROR           ' + (err.message || err));
      if (err.stack) L.push(String(err.stack).split('\n').slice(0, 6).join('\n'));
    }
    if (recentErrors.length) {
      L.push('');
      L.push('RECENT ERRORS');
      L.push(recentErrors.join('\n'));
    }
    return L.join('\n');
  }

  function probeTimerResolution() {
    var p = global.performance;
    if (!p || !p.now) return null;
    var t0 = p.now(), prev = t0, min = Infinity, c = 0, t, d;
    while (c < 200000) {
      t = p.now();
      d = t - prev;
      if (d > 0 && d < min) min = d;
      prev = t;
      c++;
      if (t - t0 > 3) break;
    }
    return isFinite(min) ? Math.round(min * 1e6) / 1e6 : null;
  }

  function stamp() {
    var d = new Date(), p = function (v) { return (v < 10 ? '0' : '') + v; };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' +
      p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  var app = {
    paused: false,
    stepOnce: false,
    shading: 0,
    particleScale: 1.0,
    resScale: 1.0,
    glass: true,
    grid: true,
    gpuSync: false,
    pumpMode: 'raf',
    lock: null,
    tPrev: 0,
    tStart: 0,
    hist: new Float32Array(512),
    histHead: 0,
    histCount: 0,
    lastHud: 0,
    benchUi: 0,
    c: {},

    init: function () {
      var self = this;
      this.canvas = dom('gl');
      this.bindDiagUi();
      try {
        this.renderer = new CFD.Renderer(this.canvas, CFD.CONTAINER);
      } catch (e) {
        /* Degrade instead of dying: the solver and the telemetry still run, so
           the tool remains usable and the operator gets a copyable diagnosis. */
        this.renderer = null;
        this.headless = true;
        showDiag('RENDERER UNAVAILABLE', 'The 3D view could not start, so the fluid is running\n' +
          'without display. Physics and telemetry below are live.\n\n' +
          (e && e.message ? e.message : e) + '\n\n' + buildDiag(this, e));
        notify('NO 3D VIEW: WEBGL2 UNAVAILABLE. PHYSICS AND TELEMETRY STILL RUNNING.');
      }
      this.timerResolution = probeTimerResolution();
      var params = new URLSearchParams(global.location.search);
      var count = clamp(parseInt(params.get('count') || '3000', 10) || 3000, 2500, 4000);
      this.solver = new CFD.FluidSolver({ count: count });
      this.bench = new CFD.Benchmark();
      dom('c-count').value = String(Math.round(count / 50) * 50);

      this.bindControls();
      this.bindPointer();
      this.bindKeys();
      this.setupPump();
      this.drawLegend();
      this.applyAll();

      global.addEventListener('resize', function () { self.applyResize(); self.sizeSpark(); });
      this.sizeSpark();

      if (this.renderer) {
        var info = this.renderer.info();
        var name = String(info.unmaskedRenderer || info.renderer || 'UNKNOWN');
        if (name.length > 52) name = name.slice(0, 52) + '...';
        dom('tb-gpu').textContent = 'GPU: ' + name.toUpperCase();
        if (info.shaderNote) notify('REDUCED SHADER PATH: ' + info.shaderNote);
      } else {
        dom('tb-gpu').textContent = 'GPU: UNAVAILABLE';
        dom('tb-mode').textContent = 'PHYSICS ONLY';
        dom('b-bench').disabled = true;
      }

      /* Optional pre-roll for deterministic screenshots / offline verification:
         index.html?warm=90, or window.__CFD_SHOT__ = {warm:90, frames:2} set by
         test/screenshot-harness.html (which also stops the pump so the page
         becomes static and can be captured headlessly). */
      var shot = global.__CFD_SHOT__ || null;
      var warm = clamp(parseInt(params.get('warm') || '0', 10) || 0, 0, 5000);
      if (shot && shot.warm) warm = clamp(shot.warm | 0, 0, 5000);
      for (var i = 0; i < warm; i++) this.solver.step(SIM_DT);
      if (shot) { this.shotBudget = Math.max(1, shot.frames | 0 || 2); this.paused = !!shot.freeze; }

      this.tStart = performance.now();
      this._loop = function () {
        self.frame();
        if (self.shotBudget !== undefined && --self.shotBudget <= 0) {
          document.title = 'CFD-SPH-BENCH / STATIC CAPTURE';
          return;                                  /* stop pumping: page goes idle */
        }
        self.request(self._loop);
      };
      this.request(this._loop);
    },

    bindDiagUi: function () {
      var self = this;
      dom('fatal-x').addEventListener('click', hideDiag);
      dom('fatal-close').addEventListener('click', hideDiag);
      dom('fatal-copy').addEventListener('click', function () { copyText(diagText, this); });
      dom('fatal').addEventListener('click', function (e) { if (e.target === this) hideDiag(); });
      dom('alert-x').addEventListener('click', function () { dom('alert').hidden = true; });
      dom('b-diag').addEventListener('click', function () {
        showDiag('DIAGNOSTICS', buildDiag(self, null));
      });
      global.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { hideDiag(); dom('alert').hidden = true; }
      });
    },

    /* ---- controls ------------------------------------------------------- */
    range: function (id, fmt, apply, mode) {
      var el = dom('c-' + id), out = dom('o-' + id), self = this;
      var show = function () { if (out) out.textContent = fmt(parseFloat(el.value)); };
      var run = function () { show(); apply(parseFloat(el.value)); };
      if (mode === 'change') {
        el.addEventListener('input', show);
        el.addEventListener('change', run);
      } else {
        el.addEventListener('input', run);
      }
      show();
      this.c[id] = { el: el, out: out, run: run, show: show };
      return this.c[id];
    },

    bindControls: function () {
      var self = this, s = function () { return self.solver; };
      this.range('count', function (v) { return v.toFixed(0); }, function (v) {
        self.solver.setCount(v | 0); self.updateDisc();
      }, 'change');
      this.range('gravity', function (v) { return v.toFixed(2) + ' m/s2'; }, function (v) { s().gravity = v; });
      this.range('visc', function (v) { return v.toFixed(2); }, function (v) { s().viscosity = v; });
      this.range('rest', function (v) { return v.toFixed(2); }, function (v) { s().restitution = v; });
      this.range('fric', function (v) { return v.toFixed(2); }, function (v) { s().friction = v; });
      this.range('iter', function (v) { return v.toFixed(0); }, function (v) { s().iterations = v | 0; });
      this.range('sub', function (v) { return v.toFixed(0); }, function (v) {
        s().substeps = v | 0; self.updateDisc();
      });
      this.range('vscale', function (v) { return v.toFixed(1) + ' m/s'; }, function (v) {
        s().velocityScale = v; self.updateLegend();
      });
      this.range('pscale', function (v) { return v.toFixed(2); }, function (v) { self.particleScale = v; });
      this.range('res', function (v) { return v.toFixed(2); }, function (v) {
        self.resScale = v; self.applyResize();
      });

      dom('c-cmap').addEventListener('change', function () {
        self.solver.colorMode = parseInt(this.value, 10) | 0;
        self.updateLegend();
      });
      dom('c-shade').addEventListener('change', function () {
        self.shading = parseInt(this.value, 10) | 0;
      });
      dom('c-glass').addEventListener('change', function () { self.glass = this.checked; });
      dom('c-grid').addEventListener('change', function () { self.grid = this.checked; });

      dom('b-reset').addEventListener('click', function () { self.resetFluid(); });
      dom('b-pause').addEventListener('click', function () { self.togglePause(); });
      dom('b-step').addEventListener('click', function () { self.stepOnce = true; });
      dom('b-view').addEventListener('click', function () { if (self.renderer) self.renderer.resetView(); });
      dom('b-bench').addEventListener('click', function () { self.startBench(); });
      dom('b-abort').addEventListener('click', function () { self.abortBench(); });
      dom('b-json').addEventListener('click', function () {
        CFD.download('cfd-sph-bench-' + stamp() + '.json', self.bench.toJSON(), 'application/json');
      });
      dom('b-csv').addEventListener('click', function () {
        CFD.download('cfd-sph-bench-' + stamp() + '-frames.csv', self.bench.toCSV(), 'text/csv');
      });
    },

    applyAll: function () {
      var s = this.solver;
      var want = parseInt(this.c.count.el.value, 10) | 0;
      if (want !== s.n) s.setCount(want);
      s.gravity = parseFloat(this.c.gravity.el.value);
      s.viscosity = parseFloat(this.c.visc.el.value);
      s.restitution = parseFloat(this.c.rest.el.value);
      s.friction = parseFloat(this.c.fric.el.value);
      s.iterations = parseInt(this.c.iter.el.value, 10) | 0;
      s.substeps = parseInt(this.c.sub.el.value, 10) | 0;
      s.velocityScale = parseFloat(this.c.vscale.el.value);
      s.colorMode = parseInt(dom('c-cmap').value, 10) | 0;
      this.shading = parseInt(dom('c-shade').value, 10) | 0;
      this.particleScale = parseFloat(this.c.pscale.el.value);
      this.resScale = parseFloat(this.c.res.el.value);
      this.glass = dom('c-glass').checked;
      this.grid = dom('c-grid').checked;
      this.applyResize();
      this.updateDisc();
      this.updateLegend();
    },

    resetFluid: function () {
      this.solver.reset();
      this.histCount = 0; this.histHead = 0;
    },

    togglePause: function () {
      this.paused = !this.paused;
      dom('b-pause').textContent = this.paused ? 'RESUME' : 'PAUSE';
      dom('b-step').disabled = !this.paused;
    },

    /* ---- viewport ------------------------------------------------------- */
    applyResize: function () {
      if (!this.renderer) return;
      if (this.lock) {
        var vw = global.innerWidth, vh = global.innerHeight;
        var sc = Math.min(vw / this.lock.w, (vh - 40) / this.lock.h, 1);
        this.canvas.style.width = Math.round(this.lock.w * sc) + 'px';
        this.canvas.style.height = Math.round(this.lock.h * sc) + 'px';
        this.renderer.resize(this.lock.w, this.lock.h);
      } else {
        var w = this.canvas.clientWidth || global.innerWidth;
        var h = this.canvas.clientHeight || global.innerHeight;
        this.renderer.resize(Math.round(w * this.resScale), Math.round(h * this.resScale));
      }
    },

    sizeSpark: function () {
      var c = dom('spark');
      var w = c.clientWidth || 248;
      if (c.width !== w) c.width = w;
      var r = dom('ramp');
      var w2 = r.clientWidth || 248;
      if (r.width !== w2) { r.width = w2; this.drawLegend(); }
    },

    bindPointer: function () {
      var self = this, drag = false, lx = 0, ly = 0;
      this.canvas.addEventListener('pointerdown', function (e) {
        if (self.bench.state !== 'idle' || !self.renderer) return;
        drag = true; lx = e.clientX; ly = e.clientY;
        self.canvas.setPointerCapture && self.canvas.setPointerCapture(e.pointerId);
      });
      this.canvas.addEventListener('pointermove', function (e) {
        if (!drag) return;
        self.renderer.orbit(e.clientX - lx, e.clientY - ly);
        lx = e.clientX; ly = e.clientY;
      });
      this.canvas.addEventListener('pointerup', function () { drag = false; });
      this.canvas.addEventListener('pointercancel', function () { drag = false; });
      this.canvas.addEventListener('wheel', function (e) {
        if (self.bench.state !== 'idle' || !self.renderer) return;
        e.preventDefault();
        self.renderer.zoom(e.deltaY);
      }, { passive: false });
    },

    bindKeys: function () {
      var self = this;
      global.addEventListener('keydown', function (e) {
        var t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
        var k = e.key.toLowerCase();
        if (k === 'r') { self.resetFluid(); }
        else if (k === ' ') { e.preventDefault(); self.togglePause(); }
        else if (k === 'n') { self.stepOnce = true; }
        else if (k === 'b') { self.startBench(); }
        else if (k === 'v') { if (self.renderer) self.renderer.resetView(); }
      });
    },

    /* ---- frame pump ----------------------------------------------------- */
    setupPump: function () {
      var self = this;
      var ch = new MessageChannel();
      ch.port1.onmessage = function () {
        var cb = self._pending;
        self._pending = null;
        if (cb) cb();
      };
      this._port = ch.port2;
    },

    request: function (cb) {
      if (this.pumpMode === 'raf') { global.requestAnimationFrame(cb); }
      else { this._pending = cb; this._port.postMessage(0); }
    },

    /* ---- the loop ------------------------------------------------------- */
    frame: function () {
      var perf = global.performance, s = this.solver, r = this.renderer;
      var t0 = perf.now();
      var dtWall = this.tPrev ? (t0 - this.tPrev) : (SIM_DT * 1000);
      this.tPrev = t0;

      var phys = 0, nbr = 0, solve = 0, vel = 0;
      if (!this.paused || this.stepOnce) {
        s.step(SIM_DT);
        phys = s.timing.total; nbr = s.timing.neighbor;
        solve = s.timing.solve; vel = s.timing.velocity;
        this.stepOnce = false;
      }
      var t1 = perf.now();

      if (r) {
        if (r.timerExt) r.beginGpuTimer();
        r.render(s, {
          glass: this.glass, grid: this.grid,
          shading: this.shading, particleScale: this.particleScale
        });
        if (r.timerExt) r.endGpuTimer();
        if (this.gpuSync) r.gl.finish();
      }
      var t2 = perf.now();

      this.hist[this.histHead] = dtWall;
      this.histHead = (this.histHead + 1) % this.hist.length;
      if (this.histCount < this.hist.length) this.histCount++;

      var st = s.stats;
      var rec = {
        elapsed: t0 - this.tStart,
        frameMs: dtWall, cpuMs: t2 - t0, physicsMs: phys,
        nbrMs: nbr, solveMs: solve, velMs: vel, renderMs: t2 - t1,
        gpuMs: r ? r.lastGpuMs : null, maxSpeed: st.maxSpeed,
        densErrPct: st.densityError * 100, nbrAvg: st.avgNeighbors,
        anomalies: st.frameAnomalies
      };
      this.lastRec = rec;

      if (this.bench.state !== 'idle') this.benchTick(rec, t2);

      if (t0 - this.lastHud > 150) { this.lastHud = t0; this.updateHud(rec); }
    },

    meanFrameMs: function (k) {
      var n = Math.min(k, this.histCount);
      if (!n) return SIM_DT * 1000;
      var sum = 0, len = this.hist.length;
      for (var i = 1; i <= n; i++) sum += this.hist[(this.histHead - i + len) % len];
      return sum / n;
    },

    /* ---- telemetry ------------------------------------------------------ */
    updateHud: function (rec) {
      var s = this.solver, st = s.stats;
      var mfm = this.meanFrameMs(45);
      dom('v-fps').textContent = (1000 / mfm).toFixed(1);
      dom('v-frame').textContent = mfm.toFixed(2) + ' ms';
      dom('v-phys').textContent = rec.physicsMs.toFixed(2) + ' ms';
      dom('v-nbr').textContent = rec.nbrMs.toFixed(2) + ' ms';
      dom('v-solve').textContent = rec.solveMs.toFixed(2) + ' ms';
      dom('v-vel').textContent = rec.velMs.toFixed(2) + ' ms';
      dom('v-render').textContent = rec.renderMs.toFixed(2) + ' ms';
      dom('v-gpu').textContent = (typeof rec.gpuMs === 'number') ? rec.gpuMs.toFixed(2) + ' ms' : 'N/A';
      dom('v-count').textContent = String(s.n);
      dom('v-nbravg').textContent = st.avgNeighbors.toFixed(1);
      dom('v-maxv').textContent = st.maxSpeed.toFixed(2) + ' m/s';
      dom('v-derr').textContent = (st.densityError * 100).toFixed(2) + ' %';
      dom('v-anom').textContent = String(s.anomalies());
      dom('v-simt').textContent = s.simTime.toFixed(2) + ' s / ' + s.stepIndex;
      dom('v-sparknote').textContent = 'P95 ' + this.p95Frame().toFixed(1) + ' MS';
      this.drawSpark();
    },

    p95Frame: function () {
      var n = Math.min(120, this.histCount);
      if (!n) return 0;
      var a = new Float64Array(n), len = this.hist.length;
      for (var i = 0; i < n; i++) a[i] = this.hist[(this.histHead - 1 - i + len) % len];
      a.sort();
      return a[Math.min(n - 1, Math.ceil(0.95 * n) - 1)];
    },

    drawSpark: function () {
      var c = dom('spark'), g = c.getContext('2d');
      var W = c.width, H = c.height;
      g.fillStyle = '#0f0f0f';
      g.fillRect(0, 0, W, H);
      var refs = [8.333, 16.667, 33.333], i, y;
      g.strokeStyle = '#242424';
      g.lineWidth = 1;
      for (i = 0; i < refs.length; i++) {
        y = Math.round(H - (refs[i] / SPARK_MAX_MS) * H) + 0.5;
        g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
      }
      var n = Math.min(W, this.histCount);
      if (n < 2) return;
      var len = this.hist.length;
      g.strokeStyle = '#3fc1d3';
      g.beginPath();
      for (i = 0; i < n; i++) {
        var v = this.hist[(this.histHead - n + i + len) % len];
        var yy = H - Math.min(1, v / SPARK_MAX_MS) * H;
        if (i === 0) g.moveTo(i + 0.5, yy); else g.lineTo(i + 0.5, yy);
      }
      g.stroke();
    },

    drawLegend: function () {
      var c = dom('ramp'), g = c.getContext('2d');
      var stops = CFD.Renderer.STOPS, i;
      var grad = g.createLinearGradient(0, 0, c.width, 0);
      for (i = 0; i < stops.length; i++) {
        var s = stops[i];
        grad.addColorStop(i / (stops.length - 1), 'rgb(' + Math.round(s[0] * 255) + ',' +
          Math.round(s[1] * 255) + ',' + Math.round(s[2] * 255) + ')');
      }
      g.fillStyle = grad;
      g.fillRect(0, 0, c.width, c.height);
    },

    updateLegend: function () {
      var s = this.solver;
      if (s.colorMode === 0) {
        dom('legend-hd').textContent = 'COLOR MAP / VELOCITY MAGNITUDE';
        dom('lg-min').textContent = '0.0 m/s';
        dom('lg-mid').textContent = (s.velocityScale * 0.5).toFixed(1);
        dom('lg-max').textContent = s.velocityScale.toFixed(1) + ' m/s';
      } else {
        dom('legend-hd').textContent = 'COLOR MAP / LOCAL DENSITY';
        dom('lg-min').textContent = '0.60 rho0';
        dom('lg-mid').textContent = '0.88';
        dom('lg-max').textContent = '1.15 rho0';
      }
    },

    updateDisc: function () {
      var s = this.solver, C = CFD.CONTAINER;
      dom('v-box').textContent = (2 * C.hx).toFixed(2) + ' x ' + C.hy.toFixed(2) + ' x ' + (2 * C.hz).toFixed(2) + ' m';
      dom('v-spacing').textContent = (s.spacing * 1000).toFixed(2) + ' mm';
      dom('v-h').textContent = (s.h * 1000).toFixed(2) + ' mm';
      dom('v-mass').textContent = (s.mass * 1000).toFixed(3) + ' g';
      dom('v-dt').textContent = (SIM_DT * 1000).toFixed(2) + ' ms / ' + s.substeps + ' sub';
      dom('v-grid').textContent = s.gnx + 'x' + s.gny + 'x' + s.gnz + ' @ ' + (s.cellSize * 1000).toFixed(1) + ' mm';
    },

    /* ---- benchmark ------------------------------------------------------ */
    startBench: function () {
      if (this.bench.state !== 'idle' || !this.renderer) return;
      var warm = clamp(parseInt(dom('c-warm').value, 10) || 120, 10, 600);
      var samp = clamp(parseInt(dom('c-sample').value, 10) || 600, 30, 3000);
      var pump = dom('c-pump').value === 'raf' ? 'raf' : 'uncapped';
      this.gpuSync = dom('c-gpusync').checked;

      var s = this.solver;
      s.setCount(CANON.count);
      s.gravity = CANON.gravity;
      s.viscosity = CANON.viscosity;
      s.restitution = CANON.restitution;
      s.friction = CANON.friction;
      s.iterations = CANON.iterations;
      s.substeps = CANON.substeps;
      s.colorMode = 0;
      s.velocityScale = CANON.velocityScale;
      this.shading = 0;
      this.particleScale = 1.0;
      this.glass = true;
      this.grid = true;
      this.paused = false;
      this.renderer.setCamera(CANON.cam);
      this.lock = { w: CANON.renderW, h: CANON.renderH };
      this.canvas.classList.add('locked');
      this.applyResize();
      s.reset();
      this.histCount = 0; this.histHead = 0;
      this.updateDisc();

      this.pumpMode = pump;
      this.bench.begin({ warmupFrames: warm, sampleFrames: samp, pump: pump, gpuSync: this.gpuSync });
      dom('right').classList.add('busy');
      dom('b-bench').disabled = true;
      dom('b-abort').disabled = false;
      dom('b-json').disabled = true;
      dom('b-csv').disabled = true;
      dom('b-res').querySelector('tbody').innerHTML = '';
      dom('b-status').className = 'status run';
      dom('b-status').textContent = 'WARMUP 0 / ' + warm;
      dom('tb-mode').textContent = 'BENCHMARK / ' + pump.toUpperCase();
      this.benchUi = 0;
      this.tPrev = 0;
    },

    benchTick: function (rec, now) {
      var b = this.bench, s = this.solver;
      var snap = { nan: s.stats.nan, escaped: s.stats.escaped, overflow: s.stats.overflow };
      var st = b.sample(rec, now, snap);
      if ((this.benchUi++ % 12) === 0 || st === 'done') {
        var p = b.progress();
        dom('b-bar').style.width = (p * 100).toFixed(1) + '%';
        if (st === 'warmup') {
          dom('b-status').textContent = 'WARMUP ' + b.warmupDone + ' / ' + b.cfg.warmupFrames;
        } else if (st === 'sampling') {
          dom('b-status').textContent = 'SAMPLING ' + b.rows.length + ' / ' + b.cfg.sampleFrames;
        }
      }
      if (st === 'done') this.finishBench();
    },

    abortBench: function () {
      if (this.bench.state === 'idle') return;
      this.bench.abort();
      this.restoreAfterBench();
      dom('b-status').className = 'status err';
      dom('b-status').textContent = 'ABORTED BY OPERATOR';
      dom('b-bar').style.width = '0%';
    },

    finishBench: function () {
      var s = this.solver;
      var rep = this.bench.build(this.environment(), this.workload(), {
        nan: s.stats.nan, escaped: s.stats.escaped, overflow: s.stats.overflow
      });
      this.bench.state = 'idle';
      this.showResults(rep);
      this.restoreAfterBench();
      dom('b-json').disabled = false;
      dom('b-csv').disabled = false;
      dom('b-status').className = 'status';
      dom('b-status').textContent = 'COMPLETE / ' + rep.sampling.sampleFrames + ' FRAMES / ' +
        (rep.sampling.durationMs / 1000).toFixed(2) + ' S';
      dom('b-bar').style.width = '100%';
    },

    restoreAfterBench: function () {
      this.lock = null;
      this.canvas.classList.remove('locked');
      this.canvas.style.width = '';
      this.canvas.style.height = '';
      this.pumpMode = 'raf';
      this.gpuSync = false;
      dom('right').classList.remove('busy');
      dom('b-bench').disabled = false;
      dom('b-abort').disabled = true;
      dom('tb-mode').textContent = 'INTERACTIVE';
      if (this.renderer) this.renderer.resetView();
      this.applyAll();
      this.solver.reset();
      this.histCount = 0; this.histHead = 0;
      this.tPrev = 0;
    },

    showResults: function (rep) {
      var r = rep.results;
      var rows = [
        ['FPS MEAN', r.fps.mean.toFixed(1), 1],
        ['FPS MEDIAN', r.fps.median.toFixed(1), 0],
        ['FPS 1% LOW', r.fps.low1Percent.toFixed(1), 0],
        ['FRAME MEAN', f2(r.frameMs.mean) + ' ms', 0],
        ['FRAME MEDIAN', f2(r.frameMs.median) + ' ms', 0],
        ['FRAME P95', f2(r.frameMs.p95) + ' ms', 0],
        ['FRAME P99', f2(r.frameMs.p99) + ' ms', 0],
        ['FRAME MIN / MAX', f2(r.frameMs.min) + ' / ' + f2(r.frameMs.max), 0],
        ['FRAME STDDEV', f2(r.frameMs.stddev) + ' ms', 0],
        ['PHYSICS MEAN', f2(r.physicsMs.mean) + ' ms', 1],
        ['PHYSICS MEDIAN', f2(r.physicsMs.median) + ' ms', 0],
        ['PHYSICS P95', f2(r.physicsMs.p95) + ' ms', 0],
        ['NEIGHBOR MEAN', f2(r.physicsBreakdownMs.neighborSearch.mean) + ' ms', 0],
        ['SOLVER MEAN', f2(r.physicsBreakdownMs.densitySolver.mean) + ' ms', 0],
        ['VELOCITY MEAN', f2(r.physicsBreakdownMs.velocityViscosityBoundary.mean) + ' ms', 0],
        ['RENDER CPU MEAN', f2(r.renderCpuMs.mean) + ' ms', 0],
        ['GPU TIMER MEAN', r.gpuTimerMs ? f2(r.gpuTimerMs.mean) + ' ms' : 'N/A', 0],
        ['PHYSICS BUDGET', r.score.physicsBudgetPercent.toFixed(1) + ' %', 0],
        ['DENSITY ERR MEAN', r.fluid.densityErrorMeanPct.toFixed(2) + ' %', 0],
        ['NEIGHBORS AVG', r.fluid.neighborsAvg.toFixed(1), 0],
        ['MAX SPEED', r.fluid.maxSpeedMps.toFixed(2) + ' m/s', 0],
        ['ANOMALIES', String(r.anomalies.total), 0],
        ['STUTTER FRAMES', String(r.anomalies.stutterFrames), 0],
        ['PARTICLE UPD/S', (r.score.particleUpdatesPerSecond / 1e6).toFixed(2) + ' M', 0],
        ['INTERACTIONS/S', (r.score.neighborInteractionsPerSecond / 1e6).toFixed(1) + ' M', 0],
        ['FPI SCORE', String(r.score.fluidPerformanceIndex), 1]
      ];
      var html = '', i;
      for (i = 0; i < rows.length; i++) {
        html += '<tr' + (rows[i][2] ? ' class="hi"' : '') + '><td>' + rows[i][0] +
          '</td><td>' + rows[i][1] + '</td></tr>';
      }
      dom('b-res').querySelector('tbody').innerHTML = html;
    },

    workload: function () {
      var s = this.solver, C = CFD.CONTAINER, cam = this.renderer.cam;
      return {
        preset: 'CANONICAL-' + CANON.count,
        particleCount: s.n,
        containerMetres: { x: 2 * C.hx, y: C.hy, z: 2 * C.hz },
        fluidVolumeM3: CFD.FLUID_VOLUME,
        initialState: 'DAM-BREAK COLUMN AGAINST -X WALL',
        seed: s.seed,
        restDensityKgM3: s.rho0,
        particleSpacingM: Math.round(s.spacing * 1e7) / 1e7,
        smoothingRadiusM: Math.round(s.h * 1e7) / 1e7,
        particleMassKg: Math.round(s.mass * 1e9) / 1e9,
        timestepS: SIM_DT,
        substeps: s.substeps,
        solverIterations: s.iterations,
        gravityMs2: s.gravity,
        viscosityXsph: s.viscosity,
        wallRestitution: s.restitution,
        wallFriction: s.friction,
        maxNeighborsPerParticle: s.maxNeighbors,
        hashGrid: { nx: s.gnx, ny: s.gny, nz: s.gnz, cellSizeM: Math.round(s.cellSize * 1e7) / 1e7 },
        render: {
          backbuffer: { width: this.renderer.w, height: this.renderer.h },
          shading: 'SPHERE_IMPOSTOR',
          particleRadiusM: Math.round(s.spacing * 0.55 * 1e7) / 1e7,
          colorSource: 'VELOCITY_MAGNITUDE',
          glassShell: true,
          camera: { azimuth: cam.az, elevation: cam.el, distance: cam.dist, fovDeg: cam.fov }
        }
      };
    },

    environment: function () {
      var nav = global.navigator, scr = global.screen;
      return {
        userAgent: nav.userAgent,
        platform: nav.platform || null,
        language: nav.language || null,
        hardwareConcurrency: nav.hardwareConcurrency || null,
        deviceMemoryGB: nav.deviceMemory || null,
        devicePixelRatio: global.devicePixelRatio || 1,
        screen: scr ? { width: scr.width, height: scr.height, colorDepth: scr.colorDepth } : null,
        viewport: { width: global.innerWidth, height: global.innerHeight },
        timeZone: (function () {
          try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return null; }
        })(),
        performanceNowResolutionMs: this.timerResolution,
        gpu: this.renderer.info()
      };
    }
  };

  /* A stray error - including one thrown by a browser extension - must never
     take the instrument down. Report it, keep running, stay dismissible. */
  global.addEventListener('error', function (e) {
    var f = e.filename || '';
    var msg = e.message || '';
    /* An opaque cross-origin report - "Script error." with no file, line or error
       object - carries no actionable information and does not come from this
       tool. Browser extensions and file:// origin restrictions produce these.
       Record them for the diagnostics, never present them as a fault here. */
    var opaque = !f && (!msg || msg === 'Script error.' || msg === 'Script error' ||
      (!e.error && !e.lineno));
    if (opaque) {
      noteError('opaque cross-origin error report, ignored (foreign script, extension, ' +
        'or file:// origin restriction)');
      return;
    }
    var mine = !f || f === global.location.href ||
      /\/js\/(mat4|sph|renderer|benchmark|main)\.js/.test(f);
    var where = f ? f.replace(/^.*\//, '') + ':' + e.lineno + ':' + e.colno : 'inline';
    noteError(msg + '  [' + where + ']' + (mine ? '' : ' (foreign script)'));
    if (mine) notify('ERROR: ' + msg + ' - PRESS DIAG FOR DETAILS');
  });
  global.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    noteError('unhandled rejection: ' + ((r && r.message) ? r.message : String(r)));
  });

  function boot() {
    try { app.init(); }
    catch (e) {
      noteError((e && e.message ? e.message : String(e)));
      showDiag('STARTUP FAILED', 'The tool could not finish starting up.\n\n' + buildDiag(app, e));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  global.CFD.app = app;
})(typeof window !== 'undefined' ? window : globalThis);
