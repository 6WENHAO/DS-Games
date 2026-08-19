/**
 * RippleSim.js — CPU 端二维波动方程，龙卷风与水面的**真正物理耦合**。
 *
 *   ∂²h/∂t² = c²∇²h − 2γ ∂h/∂t + F
 *
 * 显式中心差分推进（满足 CFL：c·dt/dx < 0.7）。
 * 驱动源 F：
 *   · 龙卷风核心的低压抽吸（Rankine 涡的压强亏损 Δp = ½ρ_air·v_θ(r)²）
 *     → 平衡水位抬升 η = −Δp/(ρ_w·g)，让水面追赶这个移动的"压强坑"，
 *       于是移动的涡自然辐射出尾迹波（与真实移动低压系统同理）
 *   · 船体排水与航行尾迹
 *
 * 因为模拟在 CPU 上，浮力查询可以直接读同一份数组 —— 船只与涟漪严格一致；
 * 同时每帧把高度/泡沫编码成 RG16F 纹理供水面着色器采样。
 */
import * as THREE from 'three';
import { toHalf } from '../core/Half.js';
import { clamp } from '../core/Random.js';

const G = 9.81;
const RHO_AIR = 1.225;
const RHO_W = 1025;

export class RippleSim {
  /**
   * @param {object} o
   * @param {number} o.res     网格分辨率
   * @param {number} o.extent  覆盖范围（米，以原点为中心）
   * @param {number} o.speed   波速 c（m/s，等效浅水 sqrt(g·depth)）
   */
  constructor({ res = 192, extent = 2600, speed = 22 } = {}) {
    this.res = res;
    this.extent = extent;
    this.dx = extent / (res - 1);
    this.c = speed;
    const n = res * res;
    this.h = new Float32Array(n);
    this.hPrev = new Float32Array(n);
    this.vel = new Float32Array(n);
    this.foam = new Float32Array(n);
    this.tex = new THREE.DataTexture(new Uint16Array(n * 2), res, res, THREE.RGFormat, THREE.HalfFloatType);
    this.tex.magFilter = THREE.LinearFilter;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.wrapS = this.tex.wrapT = THREE.ClampToEdgeWrapping;
    this.tex.needsUpdate = true;
    this._acc = 0;
    this._uploadAcc = 0;
    this.enabled = true;
    this.maxAmp = 0;
  }

  /** 世界坐标 → 网格浮点索引 */
  _toGrid(wx, wz) {
    const half = this.extent * 0.5;
    return [
      ((wx + half) / this.extent) * (this.res - 1),
      ((wz + half) / this.extent) * (this.res - 1),
    ];
  }

  /** 双线性采样高度（浮力查询用） */
  sample(wx, wz) {
    const [u, v] = this._toGrid(wx, wz);
    if (u < 1 || v < 1 || u > this.res - 2 || v > this.res - 2) return 0;
    const i0 = u | 0, j0 = v | 0;
    const fu = u - i0, fv = v - j0;
    const r = this.res, h = this.h;
    const a = h[j0 * r + i0], b = h[j0 * r + i0 + 1];
    const c = h[(j0 + 1) * r + i0], d = h[(j0 + 1) * r + i0 + 1];
    return (a + (b - a) * fu) * (1 - fv) + (c + (d - c) * fu) * fv;
  }

  sampleFoam(wx, wz) {
    const [u, v] = this._toGrid(wx, wz);
    if (u < 1 || v < 1 || u > this.res - 2 || v > this.res - 2) return 0;
    return this.foam[(v | 0) * this.res + (u | 0)];
  }

  /** 局部脉冲（船体排水、碎片落水） */
  splash(wx, wz, radiusM, amp) {
    const [u, v] = this._toGrid(wx, wz);
    const pr = Math.max(1, radiusM / this.dx);
    const x0 = Math.max(1, Math.floor(u - pr)), x1 = Math.min(this.res - 2, Math.ceil(u + pr));
    const z0 = Math.max(1, Math.floor(v - pr)), z1 = Math.min(this.res - 2, Math.ceil(v + pr));
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - u, z - v) / pr;
        if (d > 1) continue;
        const w = (1 - d * d);
        this.vel[z * this.res + x] += amp * w;
      }
    }
  }

  /**
   * @param {number} dt
   * @param {import('../tornado/Tornado.js').Tornado} tornado
   * @param {number} pull  参数 w_ripple（耦合强度）
   */
  step(dt, tornado, pull = 1) {
    if (!this.enabled || dt <= 0) return;
    /* CFL 安全的子步 */
    const dtMax = 0.62 * this.dx / (this.c * Math.SQRT2);
    let steps = Math.min(4, Math.max(1, Math.ceil(dt / dtMax)));
    const h = dt / steps;
    for (let s = 0; s < steps; s++) this._sub(h, tornado, pull);
    this._upload(dt);
  }

  _sub(dt, tornado, pull) {
    const r = this.res, dx = this.dx, c2 = this.c * this.c;
    const H = this.h, V = this.vel, F = this.foam;
    const k = c2 / (dx * dx);
    const damp = 0.55;                    // 粘性衰减，避免能量堆积
    /* ---- 龙卷风压强坑：平衡水位 ---- */
    let tx = 0, tz = 0, rc = 1, vmax = 0, act = false;
    if (tornado && tornado.strength > 0.01 && pull > 0.001) {
      tx = tornado.position.x; tz = tornado.position.z;
      rc = Math.max(tornado.rc, 2); vmax = tornado.vmax; act = true;
    }
    const [gu, gv] = act ? this._toGrid(tx, tz) : [0, 0];
    const gr = act ? Math.max(3, (rc * 7) / dx) : 0;

    let maxA = 0;
    for (let j = 1; j < r - 1; j++) {
      const row = j * r;
      for (let i = 1; i < r - 1; i++) {
        const idx = row + i;
        const lap = H[idx - 1] + H[idx + 1] + H[idx - r] + H[idx + r] - 4 * H[idx];
        let acc = k * lap - damp * V[idx];
        /* 压强坑驱动：让水面追赶目标位形，移动时自然拖出尾迹 */
        if (act) {
          const du = i - gu, dv = j - gv;
          const d2 = du * du + dv * dv;
          if (d2 < gr * gr) {
            const rr = Math.sqrt(d2) * dx;
            /* Rankine 切向风速 → 压强亏损 → 平衡抬升 */
            const vt = rr <= rc ? vmax * (rr / rc) : vmax * Math.pow(rc / rr, 0.72);
            const dp = 0.5 * RHO_AIR * (vmax * vmax - vt * vt) + 0.5 * RHO_AIR * vmax * vmax * 0.35;
            const eta = (dp / (RHO_W * G)) * pull * 2.4;
            acc += (eta - H[idx]) * 6.5;
          }
        }
        V[idx] += acc * dt;
        const a = Math.abs(H[idx]);
        if (a > maxA) maxA = a;
      }
    }
    /* 位置推进 + 泡沫（由曲率与速度生成，缓慢消散） */
    for (let j = 1; j < r - 1; j++) {
      const row = j * r;
      for (let i = 1; i < r - 1; i++) {
        const idx = row + i;
        H[idx] += V[idx] * dt;
        const curv = Math.abs(H[idx - 1] + H[idx + 1] + H[idx - r] + H[idx + r] - 4 * H[idx]);
        const gen = clamp(curv * 2.6 + Math.abs(V[idx]) * 0.16 - 0.02, 0, 1);
        F[idx] = Math.max(F[idx] * (1 - 0.55 * dt), gen);
      }
    }
    /* 边界：吸收（简单一阶外推，避免反射回来） */
    for (let i = 0; i < r; i++) {
      H[i] = H[r + i] * 0.72; H[(r - 1) * r + i] = H[(r - 2) * r + i] * 0.72;
      H[i * r] = H[i * r + 1] * 0.72; H[i * r + r - 1] = H[i * r + r - 2] * 0.72;
    }
    this.maxAmp = maxA;
  }

  _upload(dt) {
    this._uploadAcc += dt;
    if (this._uploadAcc < 1 / 40) return;
    this._uploadAcc = 0;
    const d = this.tex.image.data;
    const n = this.res * this.res;
    for (let i = 0; i < n; i++) {
      d[i * 2] = toHalf(this.h[i]);
      d[i * 2 + 1] = toHalf(this.foam[i]);
    }
    this.tex.needsUpdate = true;
  }

  reset() {
    this.h.fill(0); this.hPrev.fill(0); this.vel.fill(0); this.foam.fill(0);
    this.tex.needsUpdate = true;
  }

  dispose() { this.tex.dispose(); }
}
