/* =====================================================================
 * machine.js —— 差分机的机械仿真内核 / mechanical kernel
 *
 * 设计原则（非常重要）：
 *   本文件里 **没有任何一处** 用算术直接算出"结果"。
 *   唯一的状态是每个数位轮的连续转角 wheel.a（弧度）。
 *   数字是从转角上"读"出来的： digit = round(a / 36°) mod 10。
 *   进位是靠"轮子转过零位"这个几何事件触发闩锁、再由进位轴上的
 *   螺旋排列棘爪按位序推动高位轮实现的。
 *
 * ---------------------------------------------------------------
 * 一次加法（源列 S 加到目标列 R）的真实机械过程：
 *
 *   1. 解锁：锁定爪梳（每列一根，带 nD 个锁定爪）径向退出，放开所有数位轮。
 *   2. 合上源列离合：源列的"驱动竖轴"上每个小齿轮通过狗牙离合器
 *      接到轴上；驱动竖轴由顶部横轴经端面齿轮带动，
 *      在曲柄转 90° 内 **正好转一整圈**。
 *      => 源列所有数位轮同步正转整整一圈，转完回到原值（轮是 mod 10 的）。
 *   3. 传动闩：每个数位位置在两列之间有一根惰轮竖轴，上下两个惰齿轮
 *      分别与左右两列的轮常啮合（永远啮合，不会穿模），中间一个
 *      狗牙离合套筒。套筒被闩锁托住；当源轮的"零位销"转过闩锁时，
 *      闩锁被撞开，套筒弹下 => 从这一刻起源轮的运动才传到目标轮。
 *      源轮从数字 d 出发，转过 (10-d) 步到零位，剩下 d 步被传出去。
 *      => 目标轮正好前进 d 步 = 加上 d。且源轮转满一圈自动复原。
 *      （单个惰轮组 = 1:1 同向传动，所以两列数字盘朝同一方向读数。）
 *   4. 进位警告：目标轮从 9 越过 0 时，轮上的零位销拨动"警告杆"，
 *      杆被闩住（这就是巴贝奇的 warning）。
 *   5. 进位行程：进位竖轴在曲柄 120° 内转一整圈；轴上 nD 个棘爪
 *      按 **螺旋** 排列，于是低位先动、高位后动。若某位的警告杆被闩住，
 *      对应棘爪被释放而伸出，钩住高一位轮的棘齿环推它一齿(36°)，
 *      随后把警告杆复位。级联进位因此在同一圈内自然完成。
 *   6. 重新锁定：锁定爪梳径向插入棘齿环齿隙 —— 这一步同时
 *      把浮点累积误差"咬"回精确的 36° 整数倍（真机的定位作用）。
 *
 * 一次曲柄整圈 = 一个"相"；两个相 = 一个完整循环 = 输出一个新表值。
 * 相的选择由半速凸轮轴（曲柄经 2:1 减速）机械地完成。
 * ===================================================================== */
(function (root) {
  'use strict';

  var DE = root.DE || (root.DE = {});
  var TAU = Math.PI * 2;
  var STEP = TAU / 10;          // 一个数字 = 36°

  /* ------------------------------------------------------------------
   * 定时表：以"曲柄一整圈"为 1.0 的归一化时间
   * 凸轮轮廓函数同时用于：驱动机构 + 生成凸轮的实际几何外形
   * ------------------------------------------------------------------ */
  var W = {
    unlock:      [0.000, 0.060],   // 锁定爪梳退出
    driveIn:     [0.060, 0.100],   // 源列离合合上
    add:         [0.100, 0.350],   // 加法行程：90° 曲柄 -> 驱动竖轴整 1 圈
    transferOut: [0.350, 0.390],   // 传动套筒被复位梳抬起
    driveOut:    [0.360, 0.400],   // 源列离合断开
    carry:       [0.43333333, 0.76666667],   // 进位行程：整 120° 曲柄 -> 进位轴整 1 圈
                                             // (起点 13/30 圈：使 30 齿残齿轮在啮入瞬间正好整齿对位)
    warnReset:   [0.780, 0.820],   // 警告杆总复位梳
    relock:      [0.900, 0.960]    // 锁定爪梳插入 / 定位
  };

  function clamp01(x) { return x <= 0 ? 0 : (x >= 1 ? 1 : x); }
  function ramp(t, w) { return clamp01((t - w[0]) / (w[1] - w[0])); }
  function smooth(x) { return x * x * (3 - 2 * x); }

  /* 凸轮/传动轮廓：t ∈ [0,1) 为曲柄相位 */
  var profile = {
    // 锁定爪梳位移：1 = 完全退出（轮子自由）
    lockOut: function (t) {
      return smooth(ramp(t, W.unlock)) * (1 - smooth(ramp(t, W.relock)));
    },
    // 源列驱动离合：1 = 合上
    driveClutch: function (t) {
      return smooth(ramp(t, W.driveIn)) * (1 - smooth(ramp(t, W.driveOut)));
    },
    // 传动复位梳：1 = 梳下降（允许套筒被闩锁释放后落下）
    transferBail: function (t) {
      return smooth(ramp(t, W.driveIn)) * (1 - smooth(ramp(t, W.transferOut)));
    },
    // 警告杆复位梳：1 = 复位动作中
    warnBail: function (t) {
      var x = ramp(t, W.warnReset);
      return Math.sin(Math.PI * x);
    },
    // 加法驱动（残齿轮恒速传动，故为线性）：源列驱动竖轴的转角
    addRot: function (t) { return TAU * ramp(t, W.add); },
    // 进位驱动（残齿轮恒速传动）：进位竖轴的转角
    carryRot: function (t) { return TAU * ramp(t, W.carry); }
  };

  function stageName(t) {
    if (t < W.unlock[1]) return { key: 'unlock', cn: '解锁', en: 'UNLOCK' };
    if (t < W.driveIn[1]) return { key: 'engage', cn: '合离合器', en: 'ENGAGE' };
    if (t < W.add[1]) return { key: 'add', cn: '加法行程', en: 'ADD' };
    if (t < W.driveOut[1]) return { key: 'release', cn: '断开传动', en: 'RELEASE' };
    if (t < W.carry[0]) return { key: 'idle1', cn: '过渡', en: 'IDLE' };
    if (t < W.carry[1]) return { key: 'carry', cn: '进位行程', en: 'CARRY' };
    if (t < W.warnReset[1]) return { key: 'warnreset', cn: '警告杆复位', en: 'WARN RESET' };
    if (t < W.relock[0]) return { key: 'idle2', cn: '过渡', en: 'IDLE' };
    if (t < W.relock[1]) return { key: 'relock', cn: '锁定定位', en: 'LOCK' };
    return { key: 'settle', cn: '相结束', en: 'SETTLE' };
  }

  /* ------------------------------------------------------------------
   * Machine
   * ------------------------------------------------------------------ */
  function Machine(cfg) {
    this.nCols = cfg.nColumns;
    this.nD = cfg.nDigits;
    this.plan = DE.math.phasePlan(this.nCols);

    this.wheels = [];                       // [列][位] = {a, warn}
    for (var c = 0; c < this.nCols; c++) {
      var col = [];
      for (var k = 0; k < this.nD; k++) col.push({ a: 0, warn: false });
      this.wheels.push(col);
    }
    // 传动套筒状态：[相][操作序号][位]
    this.open = [[], []];
    // 传动闩锁被撞开时记下的精确传动起点角（-1 = 尚未撞开）
    this.trip = [[], []];
    for (var p = 0; p < 2; p++) {
      for (var oi = 0; oi < this.plan[p].length; oi++) {
        this.open[p].push(new Array(this.nD).fill(false));
        this.trip[p].push(new Array(this.nD).fill(-1));
      }
    }
    // 惰轮竖轴累计转角（只在套筒合上时随源轮转，脱开则冻结）
    this.idler = [];
    for (var g = 0; g < Math.max(0, this.nCols - 1); g++) {
      this.idler.push(new Array(this.nD).fill(0));
    }

    this.crank = 0;            // 曲柄累计转角（弧度）
    this.cycle = 0;            // 已完成的完整循环数
    this.overflow = false;     // 最高位溢出（进位丢失）
    this.carryCount = 0;       // 本相实际发生的进位次数
    this.totalCarries = 0;
    this.log = [];             // 每完成一个循环记录一次输出
    this.x0 = 0;
    this.onCycle = null;       // 回调(cycleIndex, valueReadFromWheels)
  }

  Machine.STEP = STEP;
  Machine.TAU = TAU;
  Machine.windows = W;
  Machine.profile = profile;
  Machine.stageName = stageName;

  /* ---------------- 读数：全部来自转角，绝不来自影子变量 ---------------- */

  Machine.prototype.digit = function (c, k) {
    var n = Math.round(this.wheels[c][k].a / STEP) % 10;
    return (n + 10) % 10;
  };

  Machine.prototype.readRegister = function (c) {
    var v = 0, pow = 1;
    for (var k = 0; k < this.nD; k++) { v += this.digit(c, k) * pow; pow *= 10; }
    return v;
  };

  Machine.prototype.readAll = function () {
    var out = [];
    for (var c = 0; c < this.nCols; c++) out.push(this.readRegister(c));
    return out;
  };

  /* ---------------- 手工装载（相当于人用手把数位轮拨到位） ---------------- */

  Machine.prototype.loadRegister = function (c, value) {
    var v = DE.math.modWrap(Math.round(value), this.nD);
    for (var k = 0; k < this.nD; k++) {
      this.wheels[c][k].a = (v % 10) * STEP;
      this.wheels[c][k].warn = false;
      v = Math.floor(v / 10);
    }
  };

  Machine.prototype.loadAll = function (values) {
    for (var c = 0; c < this.nCols; c++) this.loadRegister(c, values[c] || 0);
    this.crank = 0; this.cycle = 0; this.overflow = false;
    this.carryCount = 0; this.totalCarries = 0; this.log.length = 0;
    for (var p = 0; p < 2; p++) for (var oi = 0; oi < this.open[p].length; oi++) { this.open[p][oi].fill(false); this.trip[p][oi].fill(-1); }
    for (var g = 0; g < this.idler.length; g++) this.idler[g].fill(0);
  };

  /* ---------------- 相位/时序 ---------------- */

  Machine.prototype.phaseIndex = function () {
    return Math.floor(this.crank / TAU + 1e-12) % 2;
  };
  Machine.prototype.phaseTime = function () {
    var r = this.crank / TAU;
    return r - Math.floor(r + 1e-12);
  };
  Machine.prototype.currentOps = function () {
    return this.plan[this.phaseIndex()];
  };
  Machine.prototype.stage = function () { return stageName(this.phaseTime()); };

  /* 当前相中每列的角色： 0=空闲 1=源 2=目标 */
  Machine.prototype.roles = function () {
    var r = new Array(this.nCols).fill(0);
    this.currentOps().forEach(function (op) { r[op.src] = 1; r[op.dst] = 2; });
    return r;
  };

  /* ---------------- 几何事件：数位轮的"零位刻痕"经过探测器 ----------------
   * 判据必须与读数完全一致，且对浮点绝对安全：
   *   revIndex(a) = floor( round(a/STEP) / 10 )
   * 即以"最近的定位齿位置"来判断整圈数（半步 = 18° 的死区）。
   * 于是 "轮子读数由 9 翻到 0"  <=>  "revIndex 增加"，两者永不矛盾。
   * 真正的传动起点仍取精确的 n·TAU，故传出的步数精确等于源轮原读数。
   */
  function revIndex(a) { return Math.floor(Math.round(a / STEP) / 10); }

  /* ---------------- 主推进：advance(dCrank) ---------------- */

  var MAXH = TAU * 0.0015;   // 子步 ≈ 0.54° 曲柄

  Machine.prototype.advance = function (dCrank) {
    if (!(dCrank > 0)) return;
    var left = dCrank;
    var guard = 0;
    while (left > 1e-12 && guard++ < 200000) {
      var rev = Math.floor(this.crank / TAU + 1e-12);
      var toBoundary = (rev + 1) * TAU - this.crank;
      var h = Math.min(left, MAXH);
      if (h > toBoundary) h = toBoundary;
      if (h <= 1e-15) h = Math.min(left, 1e-12);
      this._sub(h, rev);
      left -= h;
    }
  };

  Machine.prototype._sub = function (h, rev) {
    var t0 = this.crank / TAU - rev;
    var t1 = t0 + h / TAU;
    var phase = rev % 2;
    var ops = this.plan[phase];
    var nD = this.nD, self = this;

    /* ---- 1) 加法行程 ---- */
    var r0 = profile.addRot(t0), r1 = profile.addRot(t1);
    if (r1 > r0) {
      var d = r1 - r0;
      for (var oi = 0; oi < ops.length; oi++) {
        var op = ops[oi];
        var srcCol = this.wheels[op.src], dstCol = this.wheels[op.dst];
        var openArr = this.open[phase][oi];
        var tripArr = this.trip[phase][oi];
        var idlerArr = this.idler[op.gap];
        for (var k = 0; k < nD; k++) {
          var sw = srcCol[k];
          var a0 = sw.a, a1 = a0 + d, transfer = 0;
          // 源轮零位销撞开传动闩锁（几何事件，不是算术）
          if (tripArr[k] < 0 && revIndex(a1) > revIndex(a0)) {
            tripArr[k] = revIndex(a1) * TAU;      // 精确的传动起点
          }
          if (tripArr[k] >= 0) {
            var from = a0 > tripArr[k] ? a0 : tripArr[k];
            if (a1 > from) transfer = a1 - from;
          }
          sw.a = a1;
          openArr[k] = tripArr[k] >= 0 && a1 >= tripArr[k];
          if (this.trace) this.trace({ t0: t0, t1: t1, k: k, a0: a0 / STEP, a1: a1 / STEP, open: openArr[k], transfer: transfer / STEP });
          if (transfer > 0) {
            // 惰轮竖轴随源轮转（视图层按半径换算成真实齿数比）
            idlerArr[k] += transfer;
            var dw = dstCol[k];
            var b0 = dw.a, b1 = b0 + transfer;
            dw.a = b1;
            if (revIndex(b1) > revIndex(b0)) {     // 目标轮 9->0：拨起警告杆
              if (k === nD - 1) this.overflow = true;
              else dw.warn = true;
            }
          }
        }
      }
    }

    /* ---- 2) 进位行程（螺旋棘爪，低位在前） ---- */
    var c0 = profile.carryRot(t0), c1 = profile.carryRot(t1);
    if (c1 > c0) {
      var slot = TAU / nD;              // 每位一个扇区
      var dur = slot * 0.55;            // 棘爪有效弧段
      for (var oi2 = 0; oi2 < ops.length; oi2++) {
        var dcol = this.wheels[ops[oi2].dst];
        for (var kk = 0; kk < nD; kk++) {
          var s = kk * slot, e = s + dur;
          var o0 = Math.max(c0, s), o1 = Math.min(c1, e);
          if (o1 > o0 && dcol[kk].warn) {
            var adv = STEP * (o1 - o0) / dur;
            if (kk + 1 < nD) {
              var w2 = dcol[kk + 1];
              var p0 = w2.a, p1 = p0 + adv;
              w2.a = p1;
              if (revIndex(p1) > revIndex(p0)) {
                if (kk + 1 === nD - 1) this.overflow = true;
                else w2.warn = true;
              }
            } else {
              this.overflow = true;
            }
          }
          // 棘爪离开扇区时把警告杆复位
          if (c0 < e && c1 >= e && dcol[kk].warn) {
            dcol[kk].warn = false;
            this.carryCount++; this.totalCarries++;
          }
        }
      }
    }

    /* ---- 3) 传动套筒复位（复位梳抬起） ---- */
    if (t0 < W.transferOut[1] && t1 >= W.transferOut[1]) {
      for (var oi3 = 0; oi3 < ops.length; oi3++) {
        this.open[phase][oi3].fill(false);
        this.trip[phase][oi3].fill(-1);
      }
    }

    /* ---- 4) 警告杆总复位梳（安全动作） ---- */
    if (t0 < W.warnReset[1] && t1 >= W.warnReset[1]) {
      for (var c = 0; c < this.nCols; c++)
        for (var k2 = 0; k2 < nD; k2++) this.wheels[c][k2].warn = false;
    }

    /* ---- 5) 锁定定位：锁定爪把轮咬回精确的 36° 整数倍 ---- */
    if (t0 < W.relock[1] && t1 >= W.relock[1]) this._detent();

    this.crank += h;

    /* ---- 6) 相结束 ---- */
    if (t1 >= 1 - 1e-12) {
      this.crank = (rev + 1) * TAU;
      this.carryCount = 0;
      if (phase === 1) {
        this.cycle++;
        var val = this.readRegister(0);
        this.log.push({ k: this.cycle, x: this.x0 + this.cycle, value: val });
        if (this.onCycle) this.onCycle(this.cycle, val);
      }
    }
  };

  Machine.prototype._detent = function () {
    for (var c = 0; c < this.nCols; c++) {
      for (var k = 0; k < this.nD; k++) {
        var w = this.wheels[c][k];
        var n = Math.round(w.a / STEP);
        var a = ((n % 10) + 10) % 10 * STEP;
        w.a = a;
      }
    }
  };

  /* ---------------- 快速运行（无动画，用于校验） ---------------- */
  Machine.prototype.runPhases = function (nPhases) {
    for (var i = 0; i < nPhases; i++) this.advance(TAU);
  };
  Machine.prototype.runCycles = function (n) { this.runPhases(n * 2); };

  DE.Machine = Machine;
})(typeof window !== 'undefined' ? window : globalThis);
