/**
 * engine.js —— 离线烟支检测与剔除系统 · 仿真内核
 * ---------------------------------------------------------------------------
 * 严格按论文 2.2 节的控制逻辑建模，闭环链路：
 *   运动同步(MCP/DCP) → 图像采集(硬件触发) → 智能识别(YOLO+FP16)
 *   → 结果通信(Modbus TCP) → 位置跟踪(PLC 槽位队列) → 精确剔除(高速电磁阀)
 *   → 数据追溯(CSV/JSON)
 *
 * 坐标系：以 MCP 脉冲计数（= 槽位）为主坐标。烟支 slotPos 每个 slotPeriodMs 前进 1。
 *   料斗鼓轮  slot   0 → 12
 *   接驳轮1   slot  12 → 24   检测工位 D1（上组相机 CAM1/CAM2，90 度夹角）@ slot 18
 *   接驳轮2   slot  24 → 36   检测工位 D2（下组相机 CAM3/CAM4，90 度夹角）@ slot 30
 *   剔除轮    slot  36 → 48   剔除喷嘴（机械固定）@ slot 45
 *   收集      slot  52
 * 机械真值：D2 → 喷嘴 = 15 槽。PLC 参数 detectToRejectSlots 若≠15 即产生槽位错位。
 * ---------------------------------------------------------------------------
 */
import {
  DEFECT_CLASSES, DEFECT_OCCURRENCE_WEIGHTS, AP_TABLE, MODELS,
  PRECISION_BENCH, MODEL_COMPLEXITY, modelByKey,
} from '../data/thesis-data.js';
import { makeRng, clamp } from '../core/store.js';

export const STATIONS = {
  ENTRY: 0,
  D1: 18,
  D2: 30,
  NOZZLE: 45,
  EXIT: 52,
};
export const TRUE_D2_TO_NOZZLE = STATIONS.NOZZLE - STATIONS.D2; // 15 槽（机械真值）
export const PERF_WINDOW = 200;   // 算法5 滑动窗口长度 W
export const IDLE_THRESHOLD_MS = 1500;
export const MAX_RECORDS = 400;

var CIG_ID = 0;

export class SimEngine {
  constructor(store) {
    this.store = store;
    this.rng = makeRng(20260411);
    this.reset();
  }

  /* ------------------------------------------------------------------ */
  reset() {
    CIG_ID = 0;
    this.t = 0;                 // 仿真时间 ms
    this.counter = 0;           // MCP 脉冲计数（整数，= 当前进入槽位编号）
    this.counterFrac = 0;
    this.dcpCount = 0;          // DCP 初始同步（每转一圈）
    this.cigs = [];             // 在线烟支
    this.imgQueue = [];         // 相机 → 工作站 图像队列（四路合并，算法4-B）
    this.camQueues = [[], [], [], []];
    this.gpuBusyUntil = -1;
    this.gpuBatch = null;
    this.pendingModbus = [];    // 等待送达 PLC 的结果
    this.plcSlots = {};         // markId -> {cig, targetCounter, cls, conf}
    this.perfTimes = [];
    this.frameCount = 0;
    this.lastImageTime = 0;
    this.idle = false;
    this.runMs = 0;
    this.alarm = null;
    this.halted = false;
    this.records = [];
    this.events = [];           // 供视图消费的离散事件
    this.flashes = [];          // 相机曝光闪光
    this.jets = [];             // 气吹
    this.packets = [];          // Modbus / GigE 报文动画
    this.timeline = null;       // 被追踪烟支的阶段时间线
    this.lastFrames = [null, null, null, null];   // 各相机最近一帧（供 HMI 显示）
    this.stats = {
      inspected: 0, defectTrue: 0, normalTrue: 0,
      TP: 0, FP: 0, FN: 0, TN: 0,
      boxes: 0, confSum: 0,
      rejectOk: 0, rejectMiss: 0, rejectFalse: 0, neighborHit: 0,
      slotMismatch: 0, timeoutEvents: 0, queuePeak: 0, droppedFrames: 0, lateFire: 0,
      passed: 0, rejectedTotal: 0,
      defectEjected: 0, normalEjected: 0,
      byClass: new Array(DEFECT_CLASSES.length).fill(0),
      byClassConf: new Array(DEFECT_CLASSES.length).fill(0),
      camFrames: [0, 0, 0, 0],
      camSaved: [0, 0, 0, 0],
      latencySum: 0, latencyN: 0, latencyMax: 0,
    };
    this._spawnAcc = 0;
    this.store.emit('sim-reset', null);
  }

  /* ------------------------------------------------------------------ */
  /** 由参数推导出的所有二级量（纯函数式，界面到处复用） */
  derive() {
    var p = this.store.params;
    var slotPeriodMs = 60000 / Math.max(1, p.throughputCPM);
    var m = modelByKey(p.modelKey);
    var bench = PRECISION_BENCH[p.precision] || PRECISION_BENCH.fp16;
    var cx = MODEL_COMPLEXITY[p.modelKey] || MODEL_COMPLEXITY.baseline;
    // 注意力方案参数量/计算量增加 → 推理耗时按 GFLOPs 比例外推（论文未直接给出，标注为推导值）
    var flopsRatio = cx.gflops / MODEL_COMPLEXITY.baseline.gflops;
    var batchFactor = 1 + 0.18 * (1 - Math.min(1, p.batchSize / 8));
    var msPerImage = bench.msPerImage * flopsRatio * batchFactor;
    var gpuFps = 1000 / msPerImage;
    var imgPerSec = (p.throughputCPM / 60) * p.camerasPerCigarette;
    var cigPerSec = p.throughputCPM / 60;
    var cameraLimitCPM = 450 * 60;                        // 单相机 450 fps，每支拍 1 张/相机
    var gpuLimitCPM = (gpuFps / p.camerasPerCigarette) * 60;
    var util = imgPerSec / gpuFps;
    var visionNominalMs = p.gigeTransferMs + p.preprocessMs
      + msPerImage * Math.min(p.batchSize, Math.max(1, p.camerasPerCigarette))
      + p.postprocessMs;
    var idealCompensation = Math.round((visionNominalMs + p.modbusMs) / slotPeriodMs);
    // 以表3-7 的 Recall 对逐类 AP（表3-6）做整体标定，使实测召回收敛于论文实验值，
    // 同时保留各类别之间的相对差异。
    var ap = AP_TABLE[p.modelKey] || AP_TABLE.baseline;
    var w = p.classWeights || DEFECT_OCCURRENCE_WEIGHTS;
    var wt = 0, wacc = 0;
    for (var ci = 0; ci < ap.length; ci++) { wt += w[ci]; wacc += w[ci] * ap[ci]; }
    var wMeanAP = wt > 0 ? wacc / wt : 0.9;
    var recallScale = clamp(m.R / Math.max(0.2, wMeanAP), 0.5, 1.6);
    return {
      slotPeriodMs: slotPeriodMs,
      model: m, bench: bench, complexity: cx,
      flopsRatio: flopsRatio,
      msPerImage: msPerImage,
      gpuFps: gpuFps,
      imgPerSec: imgPerSec,
      cigPerSec: cigPerSec,
      cameraLimitCPM: cameraLimitCPM,
      gpuLimitCPM: gpuLimitCPM,
      systemLimitCPM: Math.min(cameraLimitCPM, gpuLimitCPM),
      util: util,
      vramMB: bench.vramMB * (0.72 + 0.28 * Math.min(2, p.batchSize / 8)),
      visionNominalMs: visionNominalMs,
      idealCompensation: idealCompensation,
      slotErrorConfig: (p.detectToRejectSlots - TRUE_D2_TO_NOZZLE),
      exposureMs: p.exposureUs / 1000,
      wMeanAP: wMeanAP,
      recallScale: recallScale,
    };
  }

  /* ------------------------------------------------------------------ */
  update(realDtMs) {
    if (!this.store.ui.running || this.halted) return;
    var d = this.derive();
    var scale = this.store.ui.timeScale;
    var simDt = clamp(realDtMs, 0, 120) * scale;
    var dt = Math.min(1.0, d.slotPeriodMs / 8);
    var steps = Math.ceil(simDt / dt);
    if (steps > 3000) { dt = simDt / 3000; steps = 3000; }
    for (var i = 0; i < steps; i++) this._step(dt, d);
    this.runMs += simDt;
  }

  _step(dt, d) {
    this.t += dt;
    // ---- 运动同步：MCP 脉冲 ----
    var before = this.counter;
    this.counterFrac += dt / d.slotPeriodMs;
    var mcp = false;
    while (this.counterFrac >= 1) {
      this.counterFrac -= 1;
      this.counter += 1;
      mcp = true;
    }
    if (Math.floor(before / this.store.params.drumSlots) !==
        Math.floor(this.counter / this.store.params.drumSlots)) {
      this.dcpCount++;
      this._push('sync', 'DCP 初始同步信号 #' + this.dcpCount + '（鼓轮整转）');
    }
    // ---- 烟支运动：位置一律由主时钟 A 派生，保证与 PLC 脉冲计数严格同相 ----
    // A = counter + counterFrac 即"已通过的槽位数"；slotPos = A − enterA。
    var A = this.counter + this.counterFrac;
    for (var i = this.cigs.length - 1; i >= 0; i--) {
      var c = this.cigs[i];
      if (c.ejected) {
        c.ejectT += dt;
        c.slotPos = c.ejectSlot + (A - c.ejectA) * 0.35;
        if (c.ejectT > 260) this.cigs.splice(i, 1);
        continue;
      }
      var prev = c.slotPos;
      c.slotPos = A - c.enterA;
      if (prev < STATIONS.D1 && c.slotPos >= STATIONS.D1) this._capture(c, 0, d);
      if (prev < STATIONS.D2 && c.slotPos >= STATIONS.D2) this._capture(c, 1, d);
      if (c.slotPos >= STATIONS.EXIT) {
        this.stats.passed++;
        this.cigs.splice(i, 1);
      }
    }
    // ---- MCP 脉冲事件：上料 + PLC 槽位队列前移（位置已对齐到当前 A）----
    if (mcp) this._onMCP(d);
    this._gpu(dt, d);
    this._modbus(dt, d);
    this._decay(dt);
  }

  /** 每个 MCP 脉冲：新烟支进入 + PLC 槽位队列前移 */
  _onMCP(d) {
    var p = this.store.params;
    // 新烟支上料（料斗鼓轮）
    var c = this._makeCigarette();
    c.slotEnter = this.counter;
    c.enterA = this.counter + this.counterFrac;
    this.cigs.push(c);
    // PLC 槽位跟踪：检查是否有标记槽位到达剔除工位
    var keys = Object.keys(this.plcSlots);
    for (var i = 0; i < keys.length; i++) {
      var mk = this.plcSlots[keys[i]];
      if (this.counter >= mk.fireCounter) {
        this._fire(mk, d);
        delete this.plcSlots[keys[i]];
      }
    }
  }

  _makeCigarette() {
    var p = this.store.params;
    var r = this.rng;
    var cls = null;
    if (r() < p.defectRate) {
      var w = p.classWeights || DEFECT_OCCURRENCE_WEIGHTS;
      var tot = 0, k;
      for (k = 0; k < w.length; k++) tot += w[k];
      var x = r() * tot, acc = 0;
      for (k = 0; k < w.length; k++) { acc += w[k]; if (x <= acc) { cls = k; break; } }
      if (cls === null) cls = w.length - 1;
    }
    return {
      id: ++CIG_ID,
      slotPos: 0,
      enterA: this.counter + this.counterFrac,
      ejectA: 0, ejectSlot: 0,
      slotEnter: this.counter,
      trueClass: cls,
      images: [],
      imgDone: 0,
      imgNeed: 0,
      detected: false,
      detClass: null,
      detConf: 0,
      boxes: [],
      side: this.rng() < 0.5 ? 0 : 1,   // 缺陷所在侧面 → 由 D1 上组或 D2 下组拍到
      captureCounter: null,
      captureTime: null,
      fusedTime: null,
      latency: null,
      marked: false,
      verdict: null,      // 'OK' | 'NG'
      outcome: null,      // 'rejectOk' | 'rejectMiss' | 'rejectFalse' | 'pass'
      ejected: false,
      ejectT: 0,
      timeline: {},
      wrongClass: false,
    };
  }

  /* ---------------- 图像采集触发（2.2.1） ---------------- */
  _capture(c, group, d) {
    var p = this.store.params;
    var nPerGroup = Math.max(1, Math.round(p.camerasPerCigarette / 2));
    var baseCam = group * nPerGroup;
    for (var k = 0; k < nPerGroup; k++) {
      var camId = (baseCam + k) % 4;
      // 算法4-A：队列满则阻塞 —— 此处建模为该视角图像丢失（全局配置模块队列容量）
      if (this.camQueues[camId].length >= p.queueCapacity) {
        this.stats.droppedFrames++;
        this._push('err', 'CAM' + (camId + 1) + ' 队列已满（容量 ' + p.queueCapacity
          + '）→ 丢帧，烟支 #' + c.id + ' 该视角信息缺失');
        continue;
      }
      c.imgNeed++;
      var job = {
        cig: c, camId: camId, group: group,
        tCapture: this.t,
        tAvailable: this.t + p.gigeTransferMs,   // GigE 传输后进入队列
      };
      this.camQueues[camId].push(job);
      this.stats.camFrames[camId]++;
      this.flashes.push({ cam: camId, group: group, t: this.t, life: 1 });
      this.packets.push({ kind: 'gige', from: 'cam' + camId, t: this.t, life: 1 });
    }
    c.timeline['capture' + group] = this.t;
    if (group === 1) {
      c.captureCounter = this.counter;
      c.captureTime = this.t;
      // 全部视角均丢帧 → 无结果可用，立即以"未检出"结论收口（漏检）
      if (c.imgDone >= c.imgNeed) { this._fuse(c, d); return; }
    }
    this._push('trigger', '同步处理板输出相机触发 → ' + (group === 0 ? 'D1 上组' : 'D2 下组')
      + '（曝光 ' + p.exposureUs + ' us，光源提前 ' + p.lightLeadUs + ' us）· 烟支 #' + c.id);
  }

  /* ---------------- 视觉推理（算法4-B 公平轮询 + 批量） ---------------- */
  _gpu(dt, d) {
    var p = this.store.params;
    // 完成当前批
    if (this.gpuBatch && this.t >= this.gpuBusyUntil) {
      var batch = this.gpuBatch;
      this.gpuBatch = null;
      var perMs = batch.dur / batch.jobs.length;
      for (var i = 0; i < batch.jobs.length; i++) {
        this.perfTimes.push(perMs);
        if (this.perfTimes.length > PERF_WINDOW) this.perfTimes.shift();
        this.frameCount++;
        var job = batch.jobs[i];
        this._inferOne(job, perMs, d);
      }
    }
    if (this.gpuBatch) return;
    // 公平轮询取批（每队列取 B/4）
    var B = p.batchSize;
    var per = Math.max(1, Math.floor(B / 4));
    var jobs = [];
    for (var q = 0; q < 4; q++) {
      for (var k = 0; k < per && jobs.length < B; k++) {
        var head = this.camQueues[q][0];
        if (head && head.tAvailable <= this.t) jobs.push(this.camQueues[q].shift());
        else break;
      }
    }
    var qlen = this.camQueues[0].length + this.camQueues[1].length
      + this.camQueues[2].length + this.camQueues[3].length;
    if (qlen > this.stats.queuePeak) this.stats.queuePeak = qlen;
    if (jobs.length === 0) {
      if (!this.idle && this.t - this.lastImageTime > IDLE_THRESHOLD_MS) {
        this.idle = true;
        this._push('idle', '消费者空闲检测：超时无新图像，自动暂停 GPU 计算以节省算力');
      }
      return;
    }
    if (this.idle) {
      this.idle = false;
      this._push('idle', '检测到新图像，PerfStats.Resume() 排除空闲时段，恢复 GPU 计算');
    }
    this.lastImageTime = this.t;
    var jitter = 0.92 + 0.22 * Math.pow(this.rng(), 2);
    if (this.rng() < 0.01) jitter *= 1.6;          // 偶发抖动（对应表4-1 最慢值）
    var dur = p.preprocessMs + d.msPerImage * jobs.length * jitter + p.postprocessMs;
    this.gpuBatch = { jobs: jobs, dur: dur };
    this.gpuBusyUntil = this.t + dur;
    this.packets.push({ kind: 'infer', t: this.t, life: 1, n: jobs.length });
  }

  /** 单张图像的模拟检测结果（基于表3-6 逐类 AP 与表3-7 P/R 标定） */
  _inferOne(job, perMs, d) {
    var p = this.store.params;
    var c = job.cig;
    var ap = AP_TABLE[p.modelKey] || AP_TABLE.baseline;
    var r = this.rng;
    var nCams = p.camerasPerCigarette;
    var refCover = 2;   // 论文方案：一个侧面由 2 台相机同时拍摄（90 度夹角）
    // 置信度阈值对召回/精度的影响（以论文默认 0.2 为标定点）
    var recallAdj = clamp(1 - 1.15 * (p.confThreshold - 0.20), 0.35, 1.06);
    var precAdj = Math.exp(-3.0 * (p.confThreshold - 0.20));

    var hit = false, conf = 0;
    if (c.trueClass !== null) {
      var apc = clamp(ap[c.trueClass] * recallAdj * d.recallScale, 0.02, 0.999);
      var pView = 1 - Math.pow(1 - apc, 1 / refCover);
      // 该相机是否覆盖缺陷所在侧面
      // 缺陷只在其所在侧面可见：整支翻折(11)例外，任何视角均可见
      var covers = (c.trueClass === 11) || (job.group === c.side);
      if (covers && r() < pView) {
        hit = true;
        conf = clamp(p.confThreshold + (1 - p.confThreshold) * (0.55 + 0.42 * apc * r()), p.confThreshold + 0.01, 0.995);
      }
    } else {
      // 误检（FP）：由表3-7 Precision 反解每图误检率
      var m = modelByKey(p.modelKey);
      var Rbar = m.R;
      var dRate = Math.max(1e-4, p.defectRate);
      var fCig = dRate * Rbar * (1 - m.P) / (m.P * Math.max(1e-4, 1 - dRate));
      var fImg = 1 - Math.pow(1 - clamp(fCig, 0, 0.9), 1 / Math.max(1, nCams));
      fImg = clamp(fImg * precAdj, 0, 0.5);
      if (r() < fImg) {
        hit = true;
        conf = clamp(p.confThreshold + (1 - p.confThreshold) * (0.05 + 0.35 * r()), p.confThreshold + 0.005, 0.9);
      }
    }
    if (hit) {
      var reported = c.trueClass;
      if (reported === null) {
        // 误检类别：偏向形态相似、AP 较低的类别
        var cand = [0, 3, 7, 8, 9, 6];
        reported = cand[Math.floor(r() * cand.length)];
      } else if (r() < 0.06) {
        // 形态相似类别混淆（3.2.1：部分缺陷形态相似、边界模糊）
        var same = [];
        for (var q = 0; q < DEFECT_CLASSES.length; q++)
          if (q !== reported && DEFECT_CLASSES[q].zone === DEFECT_CLASSES[reported].zone) same.push(q);
        if (same.length) { reported = same[Math.floor(r() * same.length)]; c.wrongClass = true; }
      }
      // NMS 交并比阈值 → 重复框数量（表3-4：0.5 可减少小目标重复框）
      var dupP = clamp((p.iouThreshold - 0.5) * 1.6, 0, 0.9);
      var nBox = 1 + (r() < dupP ? 1 : 0) + (r() < dupP * dupP ? 1 : 0);
      for (var b = 0; b < nBox; b++) {
        c.boxes.push({
          cam: job.camId, cls: reported,
          conf: clamp(conf - b * 0.06 * r(), 0.01, 0.999),
          x1: Math.round(80 + r() * 520), y1: Math.round(60 + r() * 380),
          w: Math.round(18 + r() * 90), h: Math.round(14 + r() * 70),
        });
      }
      if (conf > c.detConf) { c.detConf = conf; c.detClass = reported; }
      c.detected = true;
    }
    // 供 HMI 图像显示：本次调用新增的检测框
    var myBoxes = [];
    for (var bb = 0; bb < c.boxes.length; bb++) if (c.boxes[bb].cam === job.camId) myBoxes.push(c.boxes[bb]);
    this.lastFrames[job.camId] = {
      id: c.id, trueClass: c.trueClass, group: job.group, side: c.side,
      boxes: myBoxes, t: this.t, ms: perMs, seq: this.frameCount,
    };
    c.imgDone++;
    if (c.imgDone >= c.imgNeed && c.captureTime !== null) this._fuse(c, d);
  }

  /** 多相机结果融合 → 生成检测结论并发起 Modbus 通信 */
  _fuse(c, d) {
    if (c.fusedTime !== null) return;
    c.fusedTime = this.t;
    c.latency = this.t - c.captureTime;
    c.verdict = c.detected ? 'NG' : 'OK';
    c.timeline.fuse = this.t;
    var s = this.stats;
    s.inspected++;
    s.latencySum += c.latency; s.latencyN++;
    if (c.latency > s.latencyMax) s.latencyMax = c.latency;
    if (c.trueClass !== null) s.defectTrue++; else s.normalTrue++;
    if (c.trueClass !== null && c.detected) s.TP++;
    else if (c.trueClass === null && c.detected) s.FP++;
    else if (c.trueClass !== null && !c.detected) s.FN++;
    else s.TN++;
    if (c.detected) {
      s.boxes += c.boxes.length;
      s.confSum += c.detConf;
      s.byClass[c.detClass]++;
      s.byClassConf[c.detClass] += c.detConf;
      var cam = c.boxes.length ? c.boxes[0].cam : 0;
      s.camSaved[cam]++;
    }
    this.pendingModbus.push({ cig: c, deliverAt: this.t + this.store.params.modbusMs });
    this.packets.push({ kind: 'modbus', t: this.t, life: 1, ng: c.detected });
    this._push('infer', '烟支 #' + c.id + ' 推理完成：' + (c.detected
      ? ('NG · ' + DEFECT_CLASSES[c.detClass].name + ' conf=' + c.detConf.toFixed(3) + ' · ' + c.boxes.length + ' 框')
      : 'OK') + ' · 视觉链路延迟 ' + c.latency.toFixed(2) + ' ms');
    if (this.store.ui.followCigarette === c.id) this.timeline = { id: c.id, stages: c.timeline, cig: c };
  }

  /* ---------------- 结果通信 + 槽位标记（2.2.2 / 4 阶段） ---------------- */
  _modbus(dt, d) {
    var p = this.store.params;
    for (var i = this.pendingModbus.length - 1; i >= 0; i--) {
      var m = this.pendingModbus[i];
      if (this.t < m.deliverAt) continue;
      this.pendingModbus.splice(i, 1);
      var c = m.cig;
      c.timeline.plc = this.t;
      var elapsed = this.counter - c.captureCounter;
      // PLC 结果接收窗口校验
      if (elapsed > p.resultWindowSlots) {
        this.stats.timeoutEvents++;
        this._push('timeout', '结果超窗！烟支 #' + c.id + ' 延迟 ' + elapsed
          + ' 槽 > 窗口 ' + p.resultWindowSlots + ' 槽 · 安全策略 = ' + p.timeoutPolicy);
        if (p.timeoutPolicy === 'stop') {
          this.halted = true;
          this.alarm = '结果接收超窗 → 停机（烟支 #' + c.id + '）';
          this.store.emit('sim-halt', this.alarm);
          continue;
        }
        if (p.timeoutPolicy === 'alarm') {
          this.alarm = '结果接收超窗 → 报警（烟支 #' + c.id + '）';
          if (!c.detected) { c.outcome = 'pass'; continue; }
        }
        // 'reject' = 按异常品处理，继续走剔除流程
        if (p.timeoutPolicy === 'reject' && !c.detected) c.verdict = 'NG';
      }
      if (c.verdict !== 'NG') { c.outcome = 'pass'; continue; }
      // 槽位标记（2.2.2 第三步）：
      //   trackMode = 'id'    → 用工作站随结果写入的"检测编号"直接对齐槽位（论文第二步所述寄存器内容）
      //   trackMode = 'pulse' → 用"视觉延迟折算的同步脉冲数"补偿（论文"检测延迟补偿"）
      var markId = (p.trackMode === 'pulse')
        ? (this.counter - p.compensationPulses)
        : c.captureCounter;
      var fireCounter = markId + p.detectToRejectSlots;
      var idealFire = c.captureCounter + TRUE_D2_TO_NOZZLE;
      var slotError = fireCounter - idealFire;
      c.marked = true;
      c.slotError = slotError;
      this.plcSlots[markId + ':' + c.id] = {
        cig: c, markId: markId, fireCounter: fireCounter,
        slotError: slotError, cls: c.detClass, conf: c.detConf,
      };
      this._push('mark', 'PLC 槽位标记：烟支 #' + c.id + ' → 槽 ' + markId
        + '，将于计数 ' + fireCounter + ' 输出剔除（槽位偏差 ' + (slotError >= 0 ? '+' : '') + slotError + '）');
    }
  }

  /* ---------------- 剔除执行（2.2.2 第五步） ---------------- */
  _fire(mk, d) {
    var p = this.store.params;
    var c = mk.cig;
    var doTime = this.t;
    this.jets.push({ t: doTime, life: 1, ok: true });
    this._push('do', 'PLC 输出数字量 → 高速电磁阀（响应 ' + p.valveResponseMs
      + ' ms，脉宽 ' + p.valvePulseMs + ' ms，气压 ' + p.airPressureBar + ' bar）');

    // 实际处于喷嘴工位的烟支 —— 槽位错配、结果迟到都会导致它不是目标烟支
    var atNozzle = this._cigNearNozzle(0);
    if (atNozzle !== c) {
      if (mk.slotError !== 0) this.stats.slotMismatch++; else this.stats.lateFire++;
      this.stats.rejectMiss++;
      c.outcome = 'rejectMiss';
      this._push('err', (mk.slotError !== 0
          ? ('槽位错位 ' + (mk.slotError > 0 ? '+' : '') + mk.slotError + ' 槽：')
          : '结果迟到，缺陷烟支已越过喷嘴：')
        + '真缺陷 #' + c.id + ' 漏剔'
        + (atNozzle ? '，误吹烟支 #' + atNozzle.id : '，气流打空'));
      if (atNozzle) {
        this.stats.rejectFalse++;
        atNozzle.outcome = 'rejectFalse';
        this._eject(atNozzle);
      }
      return;
    }

    // 阀时序：气流窗口与烟支通过窗口的重叠
    // DO 输出时刻烟支中心正对喷嘴 → 通过窗口以 doTime 为中心
    var slotMs = d.slotPeriodMs;
    var passMs = slotMs * 0.6;                          // 烟支处于喷嘴有效区的时长
    var jetStart = doTime + p.valveResponseMs - p.valveLeadMs;
    var jetEnd = jetStart + p.valvePulseMs;
    var t0 = doTime - passMs / 2, t1 = doTime + passMs / 2;
    var neighborStart = doTime + slotMs - passMs / 2;   // 下一支进入喷嘴区的时刻
    var overlap = Math.max(0, Math.min(jetEnd, t1) - Math.max(jetStart, t0));
    var need = 2.2 * (4.5 / Math.max(0.5, p.airPressureBar)) * (p.nozzleGapMm / 6.0);
    var ok = overlap >= need;
    if (ok) {
      this.stats.rejectOk++;
      c.outcome = 'rejectOk';
      this._eject(c);
    } else {
      this.stats.rejectMiss++;
      c.outcome = 'rejectMiss';
      this._push('err', '剔除失败：气流有效重叠 ' + overlap.toFixed(2) + ' ms < 所需 '
        + need.toFixed(2) + ' ms（脉宽不足 / 阀响应偏移 / 气压不足）');
    }
    // 误伤相邻烟支：阀仍开启时下一支已进入喷嘴区
    if (jetEnd > neighborStart) {
      var nb = this._cigNearNozzle(1);
      this.stats.neighborHit++;
      this._push('err', '脉宽过长（' + p.valvePulseMs + ' ms）：阀未闭合，误伤相邻烟支'
        + (nb ? ' #' + nb.id : ''));
      if (nb) { nb.outcome = 'rejectFalse'; this._eject(nb); this.stats.rejectFalse++; }
    }
  }

  _cigNearNozzle(offset) {
    var want = STATIONS.NOZZLE - offset;
    var best = null, bd = 1e9;
    for (var i = 0; i < this.cigs.length; i++) {
      var c = this.cigs[i];
      if (c.ejected) continue;
      var dd = Math.abs(c.slotPos - want);
      if (dd < bd) { bd = dd; best = c; }
    }
    return bd < 0.75 ? best : null;
  }

  _eject(c) {
    c.ejected = true;
    c.ejectT = 0;
    c.ejectA = this.counter + this.counterFrac;
    c.ejectSlot = c.slotPos;
    if (c.trueClass === null) this.stats.normalEjected++; else this.stats.defectEjected++;
    c.timeline.eject = this.t;
    this.stats.rejectedTotal++;
    this.records.unshift({
      seq: this.records.length ? this.records[0].seq + 1 : 1,
      id: c.id,
      t: this.t,
      cls: c.detClass,
      conf: c.detConf,
      trueCls: c.trueClass,
      cam: c.boxes.length ? c.boxes[0].cam : 0,
      boxes: c.boxes.length,
      box: c.boxes.length ? c.boxes[0] : null,
      latency: c.latency,
      slot: c.captureCounter,
      slotError: c.slotError || 0,
      outcome: c.outcome,
      wrongClass: c.wrongClass,
    });
    if (this.records.length > MAX_RECORDS) this.records.pop();
  }

  /* ---------------- 辅助 ---------------- */
  _push(kind, text) {
    this.events.push({ kind: kind, text: text, t: this.t, counter: this.counter });
    if (this.events.length > 600) this.events.splice(0, this.events.length - 600);
  }
  _decay(dt) {
    var i;
    for (i = this.flashes.length - 1; i >= 0; i--) { this.flashes[i].life -= dt / 26; if (this.flashes[i].life <= 0) this.flashes.splice(i, 1); }
    for (i = this.jets.length - 1; i >= 0; i--) { this.jets[i].life -= dt / 90; if (this.jets[i].life <= 0) this.jets.splice(i, 1); }
    for (i = this.packets.length - 1; i >= 0; i--) { this.packets[i].life -= dt / 140; if (this.packets[i].life <= 0) this.packets.splice(i, 1); }
  }

  /** 算法5 PerformanceStats.GetStats() */
  perf() {
    var ts = this.perfTimes;
    if (!ts.length) return { avg: 0, min: 0, max: 0, fps: 0, frames: this.frameCount, totalMs: this.runMs };
    var sum = 0, mn = 1e9, mx = 0;
    for (var i = 0; i < ts.length; i++) { sum += ts[i]; if (ts[i] < mn) mn = ts[i]; if (ts[i] > mx) mx = ts[i]; }
    var avg = sum / ts.length;
    return { avg: avg, min: mn, max: mx, fps: 1000 / avg, frames: this.frameCount, totalMs: this.runMs };
  }

  /** 实测 P / R / F1（应收敛于表3-7） */
  measured() {
    var s = this.stats;
    var P = s.TP + s.FP > 0 ? s.TP / (s.TP + s.FP) : 0;
    var R = s.TP + s.FN > 0 ? s.TP / (s.TP + s.FN) : 0;
    var F1 = P + R > 0 ? 2 * P * R / (P + R) : 0;
    var totalRej = s.rejectOk + s.rejectMiss;
    return {
      P: P, R: R, F1: F1,
      // 剔除动作命中率：被判 NG 并输出 DO 的烟支中，气流真正吹中目标的比例
      rejectAcc: totalRej > 0 ? s.rejectOk / totalRej : 0,
      // 缺陷逃逸率：来料缺陷中最终未被剔除的比例（= 漏检 + 漏剔）
      escapeRate: s.defectTrue > 0 ? (s.defectTrue - s.defectEjected) / s.defectTrue : 0,
      // 正常品误剔率：正常烟支被吹掉的比例（= 误检剔除 + 打错烟支）
      falseRejectRate: s.normalTrue > 0 ? s.normalEjected / s.normalTrue : 0,
      avgConf: s.byClass.reduce(function (a, b) { return a + b; }, 0) > 0
        ? s.confSum / Math.max(1, s.TP + s.FP) : 0,
      avgLatency: s.latencyN ? s.latencySum / s.latencyN : 0,
    };
  }

  drainEvents(n) {
    return this.events.slice(-(n || 60)).reverse();
  }
}
