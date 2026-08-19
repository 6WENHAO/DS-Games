/* =============================================================================
 * benchmark.js - fixed-workload benchmark harness: warmup, sampling, statistics,
 *                JSON and per-frame CSV export. No dependencies.
 * ========================================================================== */
(function (global) {
  'use strict';
  var NS = global.CFD = global.CFD || {};

  function pick(rows, key) {
    var a = new Float64Array(rows.length);
    for (var i = 0; i < rows.length; i++) a[i] = rows[i][key];
    return a;
  }

  function percentile(sorted, p) {
    if (!sorted.length) return null;
    var idx = Math.ceil((p / 100) * sorted.length) - 1;
    if (idx < 0) idx = 0;
    if (idx >= sorted.length) idx = sorted.length - 1;
    return sorted[idx];
  }

  function describe(values) {
    var n = values.length;
    if (!n) return null;
    var sorted = Float64Array.from(values);
    sorted.sort();
    var sum = 0, i;
    for (i = 0; i < n; i++) sum += values[i];
    var mean = sum / n;
    var v = 0;
    for (i = 0; i < n; i++) { var d = values[i] - mean; v += d * d; }
    return {
      mean: mean,
      median: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      min: sorted[0],
      max: sorted[n - 1],
      stddev: Math.sqrt(v / n)
    };
  }

  function round(o, k) {
    if (o === null || o === undefined) return null;
    var out = {}, f = Math.pow(10, k === undefined ? 4 : k);
    for (var key in o) {
      if (!Object.prototype.hasOwnProperty.call(o, key)) continue;
      out[key] = (typeof o[key] === 'number') ? Math.round(o[key] * f) / f : o[key];
    }
    return out;
  }

  var COLUMNS = [
    'frame', 'elapsed_ms', 'frame_ms', 'cpu_ms', 'physics_ms', 'neighbor_ms',
    'solver_ms', 'velocity_ms', 'render_cpu_ms', 'gpu_ms', 'fps_inst',
    'max_speed_mps', 'density_error_pct', 'neighbors_avg', 'anomalies'
  ];

  function Benchmark() {
    this.state = 'idle';     /* idle | warmup | sampling | done */
    this.rows = [];
    this.report = null;
    this.cfg = null;
    this.warmupLeft = 0;
    this.warmupDone = 0;
    this.t0 = 0;
    this.t1 = 0;
    this.baseAnom = null;
  }

  Benchmark.prototype.begin = function (cfg) {
    this.cfg = cfg;
    this.state = 'warmup';
    this.warmupLeft = cfg.warmupFrames;
    this.warmupDone = 0;
    this.rows.length = 0;
    this.report = null;
    this.t0 = 0;
    this.t1 = 0;
    this.baseAnom = null;
  };

  Benchmark.prototype.abort = function () {
    this.state = 'idle';
    this.rows.length = 0;
  };

  /* returns the state after consuming this frame */
  Benchmark.prototype.sample = function (rec, now, anomSnapshot) {
    if (this.state === 'warmup') {
      this.warmupDone++;
      if (--this.warmupLeft <= 0) {
        this.state = 'sampling';
        this.t0 = now;
        this.baseAnom = anomSnapshot;
      }
      return this.state;
    }
    if (this.state === 'sampling') {
      this.rows.push(rec);
      if (this.rows.length >= this.cfg.sampleFrames) {
        this.state = 'done';
        this.t1 = now;
      }
    }
    return this.state;
  };

  Benchmark.prototype.progress = function () {
    if (this.state === 'warmup') return this.warmupDone / this.cfg.warmupFrames * 0.25;
    if (this.state === 'sampling') return 0.25 + 0.75 * (this.rows.length / this.cfg.sampleFrames);
    return this.state === 'done' ? 1 : 0;
  };

  Benchmark.prototype.build = function (environment, workload, finalAnom) {
    var rows = this.rows;
    var frameMs = describe(pick(rows, 'frameMs'));
    var cpuMs = describe(pick(rows, 'cpuMs'));
    var physMs = describe(pick(rows, 'physicsMs'));
    var nbrMs = describe(pick(rows, 'nbrMs'));
    var solveMs = describe(pick(rows, 'solveMs'));
    var velMs = describe(pick(rows, 'velMs'));
    var rendMs = describe(pick(rows, 'renderMs'));
    var derr = describe(pick(rows, 'densErrPct'));
    var maxSpeed = describe(pick(rows, 'maxSpeed'));
    var nbrAvg = describe(pick(rows, 'nbrAvg'));

    var gpuVals = [], i;
    for (i = 0; i < rows.length; i++) if (typeof rows[i].gpuMs === 'number') gpuVals.push(rows[i].gpuMs);
    var gpuMs = gpuVals.length >= 8 ? describe(Float64Array.from(gpuVals)) : null;

    var med = frameMs.median;
    var stutter = 0;
    for (i = 0; i < rows.length; i++) if (rows[i].frameMs > 2 * med) stutter++;

    var fpsMean = 1000 / frameMs.mean;
    var fpsMedian = 1000 / frameMs.median;
    var fpsLow1 = 1000 / frameMs.p99;
    var fpsLow5 = 1000 / frameMs.p95;

    var anom = {
      nonFinite: finalAnom.nan - (this.baseAnom ? this.baseAnom.nan : 0),
      escaped: finalAnom.escaped - (this.baseAnom ? this.baseAnom.escaped : 0),
      neighborListOverflow: finalAnom.overflow - (this.baseAnom ? this.baseAnom.overflow : 0),
      stutterFrames: stutter
    };
    anom.total = anom.nonFinite + anom.escaped + anom.neighborListOverflow;

    var n = workload.particleCount;
    var pairsPerFrame = n * nbrAvg.mean * (2 * workload.solverIterations + 2) * workload.substeps;

    var series = [];
    for (i = 0; i < rows.length; i++) {
      var r = rows[i];
      series.push([
        i, Math.round(r.elapsed * 1000) / 1000, Math.round(r.frameMs * 1000) / 1000,
        Math.round(r.cpuMs * 1000) / 1000, Math.round(r.physicsMs * 1000) / 1000,
        Math.round(r.nbrMs * 1000) / 1000, Math.round(r.solveMs * 1000) / 1000,
        Math.round(r.velMs * 1000) / 1000, Math.round(r.renderMs * 1000) / 1000,
        (typeof r.gpuMs === 'number') ? Math.round(r.gpuMs * 1000) / 1000 : null,
        Math.round(1000 / r.frameMs * 100) / 100,
        Math.round(r.maxSpeed * 1000) / 1000,
        Math.round(r.densErrPct * 1000) / 1000,
        Math.round(r.nbrAvg * 100) / 100,
        r.anomalies
      ]);
    }

    this.report = {
      tool: 'CFD-SPH-BENCH',
      version: '1.0.0',
      algorithm: 'SPH density constraints solved position-based (PBF), hand written, no physics engine',
      generatedAt: new Date().toISOString(),
      environment: environment,
      workload: workload,
      sampling: {
        warmupFrames: this.cfg.warmupFrames,
        sampleFrames: rows.length,
        durationMs: Math.round((this.t1 - this.t0) * 1000) / 1000,
        framePump: this.cfg.pump,
        gpuSyncPerFrame: this.cfg.gpuSync
      },
      results: {
        frameMs: round(frameMs, 4),
        cpuMs: round(cpuMs, 4),
        fps: {
          mean: Math.round(fpsMean * 100) / 100,
          median: Math.round(fpsMedian * 100) / 100,
          low5Percent: Math.round(fpsLow5 * 100) / 100,
          low1Percent: Math.round(fpsLow1 * 100) / 100
        },
        physicsMs: round(physMs, 4),
        physicsBreakdownMs: {
          neighborSearch: round(nbrMs, 4),
          densitySolver: round(solveMs, 4),
          velocityViscosityBoundary: round(velMs, 4)
        },
        renderCpuMs: round(rendMs, 4),
        gpuTimerMs: gpuMs ? round(gpuMs, 4) : null,
        fluid: {
          neighborsAvg: Math.round(nbrAvg.mean * 100) / 100,
          maxSpeedMps: Math.round(maxSpeed.max * 1000) / 1000,
          densityErrorMeanPct: Math.round(derr.mean * 1000) / 1000,
          densityErrorMaxPct: Math.round(derr.max * 1000) / 1000
        },
        anomalies: anom,
        score: {
          fluidPerformanceIndex: Math.round(n * fpsMean / 1000),
          particleUpdatesPerSecond: Math.round(n * workload.substeps * fpsMean),
          neighborInteractionsPerSecond: Math.round(pairsPerFrame * fpsMean),
          physicsBudgetPercent: Math.round(physMs.mean / frameMs.mean * 10000) / 100
        }
      },
      frameSeries: { columns: COLUMNS, rows: series }
    };
    return this.report;
  };

  Benchmark.prototype.toCSV = function () {
    if (!this.report) return '';
    var s = this.report.frameSeries;
    var out = [s.columns.join(',')];
    for (var i = 0; i < s.rows.length; i++) {
      var r = s.rows[i], line = new Array(r.length);
      for (var k = 0; k < r.length; k++) line[k] = (r[k] === null || r[k] === undefined) ? '' : r[k];
      out.push(line.join(','));
    }
    return out.join('\n') + '\n';
  };

  Benchmark.prototype.toJSON = function () {
    return this.report ? JSON.stringify(this.report, null, 2) : '';
  };

  function download(name, text, mime) {
    var blob = new Blob([text], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 4000);
  }

  NS.Benchmark = Benchmark;
  NS.describe = describe;
  NS.download = download;
})(typeof window !== 'undefined' ? window : globalThis);
