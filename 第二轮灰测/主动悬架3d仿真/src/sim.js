/**
 * sim.js — 双车对比仿真引擎
 *
 * 同一条路面、同一车速、同一时刻，两台参数完全相同的车：
 *   unit A（上）：传统被动悬架 —— 无魔毯系统
 *   unit B（下）：主动悬架     —— 可选控制算法
 * 严格锁步积分，保证对比公平。
 */

import { Road } from './road.js';
import { makeParams, Integrator, makeDiag, deriv } from './vehicle.js';
import { SuspensionController, buildLQR } from './controllers.js';
import { ISO2631Wk, comfortRating } from './iso2631.js';

const DT_PHYS = 0.001;          // 1 kHz 物理步长（RK4）
const SAMPLE_DT = 0.004;        // 250 Hz 曲线采样
const METRIC_WARMUP = 0.8;      // 指标统计前的稳定时间 s（含加权滤波器建立）
const BUF = 2600;               // 环形缓冲（≈10.4 s）

function makeMetrics() {
  return {
    n: 0, t: 0,
    aSum: 0, aPeak: 0, a4Sum: 0,          // 座椅垂向加速度（未加权）
    awSum: 0, awPeak: 0, aw4Sum: 0,       // ISO 2631 Wk 加权
    zSum: 0, zPeak: 0,                     // 座椅垂向位移
    phiSum: 0, phiPeak: 0,
    thetaSum: 0, thetaPeak: 0,
    travSum: 0, travPeak: 0,
    loadSum: 0, loadPeak: 0,               // 轮胎动载荷（相对静载 %）
    airTime: 0, airEvents: 0, _wasAir: false,
    energy: 0, powerPeak: 0,
  };
}

function ring(len) { return { d: new Float32Array(len), i: 0, n: 0, len }; }
function push(r, v) { r.d[r.i] = v; r.i = (r.i + 1) % r.len; if (r.n < r.len) r.n++; }

class Unit {
  constructor(p, mode, lqr, label, color) {
    this.p = p; this.mode = mode; this.label = label; this.color = color;
    this.x = new Float64Array(14);
    this.integ = new Integrator(p);
    this.diag = makeDiag();
    this.ctrl = new SuspensionController(p, mode, lqr);
    this.wk = new ISO2631Wk(1 / 0.001);
    this.awNow = 0;
    this.m = makeMetrics();
    this.sig = {
      aSeat: ring(BUF), awSeat: ring(BUF), zSeat: ring(BUF), theta: ring(BUF), phi: ring(BUF),
      trav: ring(BUF), force: ring(BUF), load: ring(BUF),
    };
    // 冻结当前诊断（初始平衡）
    const zr = new Float64Array(4), zrd = new Float64Array(4), dx = new Float64Array(14);
    deriv(p, this.x, zr, zrd, null, dx, this.diag);
  }
  reset() {
    this.x.fill(0);
    this.ctrl.reset();
    this.wk.reset();
    this.awNow = 0;
    this.m = makeMetrics();
    for (const k in this.sig) { this.sig[k].i = 0; this.sig[k].n = 0; this.sig[k].d.fill(0); }
  }
  seatZ() { const p = this.p, x = this.x; return x[0] + p.seat.lz * x[2] + p.seat.lx * x[1]; }
}

export class Sim {
  constructor(opts = {}) {
    this.p = makeParams(opts.params);
    this.road = new Road(opts.course || 'pothole');
    this.speed = (opts.speedKmh ?? 50) / 3.6;
    this.s = 0; this.t = 0;
    this.running = true;
    this.lqrInfo = null;

    const lqr = buildLQR(this.p, opts.lqrWeights || undefined, opts.lqrDt || undefined);
    this.lqrInfo = lqr.info;
    this.lqr = lqr;

    this.A = new Unit(this.p, 'passive', lqr, '传统被动悬架', '#ff8a3d');
    this.B = new Unit(this.p, 'active', lqr, '主动魔毯悬架', '#3ddcff');
    if (opts.gains) Object.assign(this.B.ctrl.gains, opts.gains);
    if (opts.algo) this.B.ctrl.setAlgo(opts.algo);
    this.units = [this.A, this.B];

    this.sampleAcc = 0;
    this.sampleT = 0;
    this.sampleTimes = ring(BUF);
    this.roadSig = ring(BUF);
    this.stats = { substeps: 0 };
  }

  setSpeedKmh(v) { this.speed = v / 3.6; }
  get speedKmh() { return this.speed * 3.6; }

  setCourse(k) { this.road.setCourse(k); this.reset(); }

  reset(keepS = false) {
    if (!keepS) this.s = 0;
    this.t = 0;
    this.sampleAcc = 0; this.sampleT = 0;
    this.sampleTimes.i = 0; this.sampleTimes.n = 0;
    this.roadSig.i = 0; this.roadSig.n = 0;
    for (const u of this.units) u.reset();
  }

  /** 推进 dtWall 秒（真实时间），内部固定步长积分 */
  advance(dtWall) {
    if (!this.running) return;
    const dt = DT_PHYS;
    let n = Math.round(Math.min(dtWall, 0.1) / dt);
    if (n < 1) n = 1;
    this.stats.substeps = n;
    const v = this.speed, road = this.road, p = this.p;

    for (let k = 0; k < n; k++) {
      for (const u of this.units) {
        const Fa = u.ctrl.compute(u.x, dt, this.s, v, road, u.diag.defl, u.diag.deflv);
        u.integ.step(u.x, dt, this.s, v, road, Fa, u.diag);
      }
      this.s += v * dt;
      this.t += dt;
      this._accumulate(dt);

      this.sampleAcc += dt;
      if (this.sampleAcc >= SAMPLE_DT) {
        this.sampleAcc -= SAMPLE_DT;
        this._sample();
      }
    }
  }

  _accumulate(dt) {
    const warm = this.t > METRIC_WARMUP;
    for (const u of this.units) {
      const d = u.diag, m = u.m, p = this.p;
      const a = d.aseat;
      const aw = u.wk.filter(a);          // ISO 2631 Wk 加权（滤波器需持续运行以建立状态）
      u.awNow = aw;
      const z = u.seatZ();
      let travMax = 0, loadDev = 0, air = false;
      for (let i = 0; i < 4; i++) {
        travMax = Math.max(travMax, Math.abs(d.defl[i]));
        loadDev += (d.Ftire[i] / p.Wtire[i]) ** 2;
        if (d.contact[i] < 0.5) air = true;
      }
      loadDev = Math.sqrt(loadDev / 4) * 100;   // 动载荷占静载 %
      const pw = u.ctrl.powerW;
      m.energy += pw * dt;
      m.powerPeak = Math.max(m.powerPeak, pw);
      if (!warm) continue;
      m.n++; m.t += dt;
      m.aSum += a * a; m.a4Sum += a ** 4; m.aPeak = Math.max(m.aPeak, Math.abs(a));
      m.awSum += aw * aw; m.aw4Sum += aw ** 4; m.awPeak = Math.max(m.awPeak, Math.abs(aw));
      m.zSum += z * z; m.zPeak = Math.max(m.zPeak, Math.abs(z));
      m.phiSum += u.x[1] ** 2; m.phiPeak = Math.max(m.phiPeak, Math.abs(u.x[1]));
      m.thetaSum += u.x[2] ** 2; m.thetaPeak = Math.max(m.thetaPeak, Math.abs(u.x[2]));
      m.travSum += travMax * travMax; m.travPeak = Math.max(m.travPeak, travMax);
      m.loadSum += loadDev * loadDev; m.loadPeak = Math.max(m.loadPeak, loadDev);
      if (air) { m.airTime += dt; if (!m._wasAir) { m.airEvents++; m._wasAir = true; } }
      else m._wasAir = false;
    }
    if (this.onStep) this.onStep(dt);
  }

  _sample() {
    push(this.sampleTimes, this.t);
    push(this.roadSig, this.road.height(this.s + this.p.lf, -1) * 1000);
    for (const u of this.units) {
      const d = u.diag;
      push(u.sig.aSeat, d.aseat);
      push(u.sig.awSeat, u.awNow);
      push(u.sig.zSeat, u.seatZ() * 1000);
      push(u.sig.theta, u.x[2] * 180 / Math.PI);
      push(u.sig.phi, u.x[1] * 180 / Math.PI);
      let tv = 0; for (let i = 0; i < 4; i++) tv = Math.abs(d.defl[i]) > Math.abs(tv) ? d.defl[i] : tv;
      push(u.sig.trav, tv * 1000);
      let fmax = 0; for (let i = 0; i < 4; i++) if (Math.abs(u.ctrl.force[i]) > Math.abs(fmax)) fmax = u.ctrl.force[i];
      push(u.sig.force, fmax);
      let ld = 0; for (let i = 0; i < 4; i++) ld += (d.Ftire[i] / this.p.Wtire[i]) ** 2;
      push(u.sig.load, Math.sqrt(ld / 4) * 100);
    }
  }

  /** 归一化指标 */
  report() {
    const out = {};
    for (const [key, u] of [['passive', this.A], ['active', this.B]]) {
      const m = u.m, n = Math.max(1, m.n);
      const awRms = Math.sqrt(m.awSum / n);
      out[key] = {
        awRms,
        awPeak: m.awPeak,
        awVdv: Math.pow(m.aw4Sum * (m.t / n), 0.25),
        comfort: comfortRating(awRms),
        aRms: Math.sqrt(m.aSum / n),
        aPeak: m.aPeak,
        vdv: Math.pow(m.a4Sum * (m.t / n), 0.25),
        zRms: Math.sqrt(m.zSum / n) * 1000,
        zPeak: m.zPeak * 1000,
        phiRms: Math.sqrt(m.phiSum / n) * 180 / Math.PI,
        phiPeak: m.phiPeak * 180 / Math.PI,
        thetaRms: Math.sqrt(m.thetaSum / n) * 180 / Math.PI,
        thetaPeak: m.thetaPeak * 180 / Math.PI,
        travRms: Math.sqrt(m.travSum / n) * 1000,
        travPeak: m.travPeak * 1000,
        loadRms: Math.sqrt(m.loadSum / n),
        loadPeak: m.loadPeak,
        airPct: (m.airTime / Math.max(1e-6, m.t)) * 100,
        airEvents: m.airEvents,
        energyKJ: m.energy / 1000,
        avgPowerW: m.energy / Math.max(1e-6, this.t),
        powerPeak: m.powerPeak,
        time: m.t,
      };
    }
    const imp = (a, b) => (Math.abs(a) < 1e-12 ? 0 : ((a - b) / a) * 100);
    out.improve = {
      awRms: imp(out.passive.awRms, out.active.awRms),
      awPeak: imp(out.passive.awPeak, out.active.awPeak),
      awVdv: imp(out.passive.awVdv, out.active.awVdv),
      aRms: imp(out.passive.aRms, out.active.aRms),
      aPeak: imp(out.passive.aPeak, out.active.aPeak),
      vdv: imp(out.passive.vdv, out.active.vdv),
      zRms: imp(out.passive.zRms, out.active.zRms),
      zPeak: imp(out.passive.zPeak, out.active.zPeak),
      phiRms: imp(out.passive.phiRms, out.active.phiRms),
      thetaRms: imp(out.passive.thetaRms, out.active.thetaRms),
      loadRms: imp(out.passive.loadRms, out.active.loadRms),
      airPct: imp(out.passive.airPct, out.active.airPct),
    };
    return out;
  }
}

export { DT_PHYS, SAMPLE_DT, BUF };
