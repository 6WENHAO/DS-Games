/**
 * kinematics.js —— 四冲程柴油机运动学 / 简化热力学与工况模型
 * 所有角度以“曲轴转角”为基准，单位度；0° = 第 1 缸压缩上止点（着火上止点）
 */
import { P, VALVE_EVENTS, STROKES, CYL_PHASE } from './params.js';

const D2R = Math.PI / 180;
export const deg = (r) => r / D2R;
export const rad = (d) => d * D2R;

/** 循环角归一化到 [0,720) */
export function cycleAngle(crankAngle, cyl = 1) {
  const a = (crankAngle - CYL_PHASE[cyl]) % 720;
  return a < 0 ? a + 720 : a;
}

/** 该缸曲柄（连杆颈）相位：1、4 缸同向，2、3 缸反向 180° */
export function throwAngle(crankAngle, cyl = 1) {
  return crankAngle + (cyl === 2 || cyl === 3 ? 180 : 0);
}

/**
 * 活塞销中心到曲轴中心线的距离（mm）
 * s = r·cosθ + √(L² − r²sin²θ)
 */
export function pinCenterY(crankAngle, cyl = 1) {
  const th = rad(throwAngle(crankAngle, cyl));
  const r = P.crankR, L = P.rodLength;
  const sn = r * Math.sin(th);
  return r * Math.cos(th) + Math.sqrt(L * L - sn * sn);
}

/** 连杆摆角 β = asin(r·sinθ / L)（弧度，绕 X 轴） */
export function rodSwing(crankAngle, cyl = 1) {
  const th = rad(throwAngle(crankAngle, cyl));
  return Math.asin((P.crankR * Math.sin(th)) / P.rodLength);
}

/** 活塞顶面高度（mm，相对曲轴中心线） */
export function pistonCrownY(crankAngle, cyl = 1) {
  return pinCenterY(crankAngle, cyl) + P.piston.compHeight;
}

/** 活塞瞬时速度 mm/s */
export function pistonSpeed(crankAngle, rpm, cyl = 1) {
  const th = rad(throwAngle(crankAngle, cyl));
  const w = (rpm * 2 * Math.PI) / 60;
  const r = P.crankR, L = P.rodLength;
  const lam = r / L;
  return -r * w * (Math.sin(th) + (lam * Math.sin(2 * th)) / (2 * Math.sqrt(1 - lam * lam * Math.sin(th) ** 2)));
}

/** 活塞行程内位置比例：0 = 下止点, 1 = 上止点 */
export function pistonFraction(crankAngle, cyl = 1) {
  const y = pinCenterY(crankAngle, cyl);
  const top = P.crankR + P.rodLength;
  const bot = P.rodLength - P.crankR;
  return (y - bot) / (top - bot);
}

/** 单个气门升程曲线：无量纲丰满型 sin^n 型，符合柴油机凸轮特征 */
function liftProfile(u) {
  if (u <= 0 || u >= 1) return 0;
  const s = Math.sin(Math.PI * u);
  return Math.pow(s, 2.6 / P.valvetrain.camNoseSharp);
}

/** 进/排气门升程（mm），a = 循环角 [0,720) */
export function valveLift(a, which = 'intake') {
  const ev = VALVE_EVENTS[which];
  const span = ev.close - ev.open;
  // 处理跨 720° 的排气门（EVC 在 720 之后）
  let x = a;
  if (x < ev.open) x += 720;
  const u = (x - ev.open) / span;
  return liftProfile(u) * P.valvetrain.valveLift;
}

/** 凸轮升程（挺柱升程）= 气门升程 / 摇臂比 */
export function camLift(a, which = 'intake') {
  return valveLift(a, which) / P.valvetrain.rockerRatio;
}

/** 凸轮桃尖对应的“最大升程曲轴角” */
export function camPeakCycleAngle(which = 'intake') {
  const ev = VALVE_EVENTS[which];
  return (ev.open + ev.close) / 2;
}

/** 冲程判定 */
export function strokeOf(a) {
  for (const s of STROKES) if (a >= s.from && a < s.to) return s;
  return STROKES[0];
}

/** 冲程 + 运动方向的中文描述 */
export function strokeText(crankAngle, cyl = 1) {
  const a = cycleAngle(crankAngle, cyl);
  const s = strokeOf(a);
  const up = pistonSpeed(crankAngle, 1000, cyl) > 0 ? '上行' : '下行';
  return { stroke: s, text: `${s.cn}冲程 · 活塞${up}`, cycle: a };
}

/** 相对气缸容积 V/Vc（1 = 上止点余隙容积，eps = 下止点） */
export function relVolume(a) {
  const f = pistonFraction(a);
  return 1 + (P.compressionRatio - 1) * (1 - f);
}

/**
 * 缸内压力（bar 绝对压力）—— 简化 Seiliger（混合加热）循环
 * 压缩/膨胀取多变过程，换气行程取近似定值，用于状态面板与气流强度调制。
 */
export function cylinderPressure(a, rpm, load, boostMPa = 0) {
  const pin = (0.1 + boostMPa) * 10;          // 进气管绝对压力 bar
  const nc = 1.36, ne = 1.28;                 // 压缩/膨胀多变指数
  const eps = P.compressionRatio;
  const v = relVolume(a);
  if (a >= 540) {                             // 压缩行程
    return pin * Math.pow(eps / v, nc) * 0.94;
  }
  if (a < 180) {                              // 做功行程
    const pc = pin * Math.pow(eps, nc) * 0.94;
    const pmax = pc * (1.5 + 0.9 * load);     // 爆发压力（≈120~160 bar）
    const aPeak = 9;
    if (a < aPeak) return pc + (pmax - pc) * (a / aPeak);
    const vPeak = relVolume(aPeak);
    return Math.max(pin * 1.1, pmax * Math.pow(vPeak / v, ne));
  }
  if (a < 360) return pin * 1.12;             // 排气行程（排气背压）
  return pin * 0.94;                          // 进气行程
}

/** 工况模型：转速/负荷 → 增压压力、油压、水温、扭矩、功率 */
export class OperatingModel {
  constructor() {
    this.rpm = P.meta.idleSpeed;
    this.load = 0.15;
    this.coolantTemp = 22;
    this.oilTemp = 22;
    this.boost = 0;
    this.oilPressure = 0.1;
    this.egt = 120;
    this.turboRpm = 0;
    this.ambient = 22;
    this.fuelRate = 0;
  }
  step(dt) {
    const { rpm, load } = this;
    const nr = rpm / P.meta.ratedSpeed;
    // 增压压力：转速与负荷的乘积特性
    const boostTarget = P.air.maxBoost * Math.pow(Math.max(0, nr - 0.18) / 0.82, 1.6) * (0.35 + 0.65 * load);
    this.boost += (Math.max(0, boostTarget) - this.boost) * Math.min(1, dt * 2.2); // 涡轮迟滞
    this.turboRpm = 12000 + 105000 * (this.boost / P.air.maxBoost);
    // 机油压力：泵为容积泵，限压阀 0.45MPa
    const pTarget = Math.min(0.48, 0.06 + 0.52 * nr * (1 - 0.25 * (this.oilTemp - 40) / 80));
    this.oilPressure += (pTarget - this.oilPressure) * Math.min(1, dt * 3);
    // 水温：热平衡 + 节温器调节
    const heat = (0.10 + 0.9 * load) * (0.35 + 0.65 * nr);
    const tStat = this.coolantTemp < P.cooling.openTemp ? 0
      : Math.min(1, (this.coolantTemp - P.cooling.openTemp) / (P.cooling.fullOpenTemp - P.cooling.openTemp));
    const cool = (0.06 + 1.25 * tStat) * (this.coolantTemp - this.ambient) / 70;
    this.coolantTemp += (heat * 3.1 - cool * 3.0) * dt * 1.6;
    this.coolantTemp = Math.min(112, Math.max(this.ambient, this.coolantTemp));
    this.oilTemp += ((this.coolantTemp + 14 * load - this.oilTemp)) * dt * 0.25;
    // 扭矩 / 功率（外特性近似）
    const tqFull = P.meta.peakTorqueNm * (1.02 - 0.55 * Math.pow((rpm - P.meta.peakTorqueSpeed) / 1400, 2));
    this.torque = Math.max(0, tqFull * load);
    this.power = (this.torque * rpm * 2 * Math.PI) / 60 / 1000;
    this.egt = 110 + 620 * load * (0.5 + 0.5 * nr) + 40 * nr;
    this.fuelRate = this.power * 0.215; // kg/h ≈ Pe · be
    return this;
  }
  get thermostatOpen() {
    return this.coolantTemp < P.cooling.openTemp ? 0
      : Math.min(1, (this.coolantTemp - P.cooling.openTemp) / (P.cooling.fullOpenTemp - P.cooling.openTemp));
  }
}
