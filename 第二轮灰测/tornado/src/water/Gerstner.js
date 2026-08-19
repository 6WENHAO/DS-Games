/**
 * Gerstner.js — 长波涌浪。
 *
 * 关键点：波列数据在 JS 里按风速/风向确定性生成，然后**同一份数组**既上传给顶点着色器
 * 也用于 CPU 求值。因此"看到的浪高"和"船受到的浪高"逐点严格一致，船不会浮在浪外。
 *
 * 深水色散：ω = sqrt(g·k)，k = 2π/λ。水平位移用 Gerstner 尖化（choppiness）。
 */
import * as THREE from 'three';
import { Rng } from '../core/Random.js';

const G = 9.81;

export class GerstnerSwell {
  constructor(count = 10) {
    this.count = count;
    /** vec4: dir.x, dir.z, amplitude, k(=2π/λ) */
    this.dataA = new Array(count).fill(0).map(() => new THREE.Vector4());
    /** vec4: omega, steepness, phase0, 0 */
    this.dataB = new Array(count).fill(0).map(() => new THREE.Vector4());
    this._wind = -1;
    this._dir = -999;
    this._amp = -1;
    this._chop = -1;
  }

  /**
   * 依据风速/风向重建波列（JONSWAP 峰值波长附近做几何级数分布）
   * @param {number} windSpeed m/s
   * @param {number} windDirDeg
   * @param {number} ampScale
   * @param {number} choppy
   */
  configure(windSpeed, windDirDeg, ampScale, choppy) {
    if (windSpeed === this._wind && windDirDeg === this._dir && ampScale === this._amp && choppy === this._chop) return false;
    this._wind = windSpeed; this._dir = windDirDeg; this._amp = ampScale; this._chop = choppy;

    const rng = new Rng(20240519);
    const dirRad = windDirDeg * Math.PI / 180;
    /* 充分发展风浪的峰值波长 λp ≈ 2π·U²/(g·0.877²) 的简化 */
    const lamPeak = Math.max(24, 0.62 * windSpeed * windSpeed + 26);
    /* 有效波高 Hs ≈ 0.021·U²（经验式），振幅 = Hs/2 分摊到各波 */
    const Hs = 0.021 * windSpeed * windSpeed * ampScale;

    let totalW = 0;
    const weights = [];
    for (let i = 0; i < this.count; i++) {
      /* 波长从 0.45λp 到 2.6λp 几何分布，长波占能量主体 */
      const t = i / (this.count - 1);
      const lam = lamPeak * (0.45 * Math.pow(5.8, t));
      /* JONSWAP 形状的粗略能量权重 */
      const r = lam / lamPeak;
      const w = Math.exp(-1.25 / (r * r * r * r)) / Math.pow(r, 1.2);
      weights.push({ lam, w });
      totalW += w;
    }
    /* 幅度标定：让合成波面的有效波高 4σ = Hs（σ² = Σaᵢ²/2）。
       直接按权重分配会让 Σaᵢ 远大于 Hs，浪高翻好几倍。 */
    let sumSq = 0;
    for (const it of weights) sumSq += Math.pow(it.w / totalW, 2);
    const kAmp = (Hs / 4) * Math.sqrt(2 / Math.max(sumSq, 1e-9));

    let varSum = 0;
    for (let i = 0; i < this.count; i++) {
      const { lam, w } = weights[i];
      const k = (2 * Math.PI) / lam;
      const omega = Math.sqrt(G * k);
      /* 方向扩散：±38° 余弦分布 */
      const spread = (rng.next() * 2 - 1) * 0.66 + (rng.next() * 2 - 1) * 0.18;
      const ang = dirRad + spread;
      const amp = kAmp * (w / totalW);
      /* Gerstner 不自交条件：Σ(Qᵢ·kᵢ·Aᵢ) ≤ 1，于是每条波分摊 choppy·0.72/count */
      const steep = Math.min(choppy * 0.72 / Math.max(k * amp * this.count, 1e-4), 2.0);
      this.dataA[i].set(Math.cos(ang), Math.sin(ang), amp, k);
      this.dataB[i].set(omega, steep, rng.next() * Math.PI * 2, 0);
      varSum += amp * amp * 0.5;
    }
    /** 有效波高（4σ），仅用于显示 */
    this.hs = 4 * Math.sqrt(varSum);
    return true;
  }

  /** CPU 求值：返回位移（水平 + 垂直），与着色器同公式 */
  displace(x, z, t, out = new THREE.Vector3()) {
    let dx = 0, dy = 0, dz = 0;
    for (let i = 0; i < this.count; i++) {
      const a = this.dataA[i], b = this.dataB[i];
      const ph = a.w * (a.x * x + a.y * z) - b.x * t + b.z;
      const s = Math.sin(ph), c = Math.cos(ph);
      dy += a.z * s;
      const q = b.y * a.z * c;
      dx += a.x * q;
      dz += a.y * q;
    }
    return out.set(dx, dy, dz);
  }

  /** 只要高度（浮力用得最多，省掉水平项开销） */
  height(x, z, t) {
    let dy = 0;
    for (let i = 0; i < this.count; i++) {
      const a = this.dataA[i], b = this.dataB[i];
      dy += a.z * Math.sin(a.w * (a.x * x + a.y * z) - b.x * t + b.z);
    }
    return dy;
  }

  /** 水质点轨道速度（近水面），用于船体水阻与漂流 */
  velocity(x, z, t, out = new THREE.Vector3()) {
    let vx = 0, vy = 0, vz = 0;
    for (let i = 0; i < this.count; i++) {
      const a = this.dataA[i], b = this.dataB[i];
      const ph = a.w * (a.x * x + a.y * z) - b.x * t + b.z;
      const s = Math.sin(ph), c = Math.cos(ph);
      const aw = a.z * b.x;
      vy += aw * c;
      vx += a.x * aw * s;
      vz += a.y * aw * s;
    }
    return out.set(vx, vy, vz);
  }

  /** 供着色器使用的 uniform 定义 */
  makeUniforms() {
    return {
      uSwellA: { value: this.dataA },
      uSwellB: { value: this.dataB },
      uSwellCount: { value: this.count },
    };
  }
}

/** 顶点着色器里的同名求值函数（必须与 displace() 完全一致） */
export const GLSL_GERSTNER = /* glsl */`
uniform vec4 uSwellA[SWELL_COUNT];    // dir.x, dir.z, amp, k
uniform vec4 uSwellB[SWELL_COUNT];    // omega, steepness, phase0, -
uniform int  uSwellCount;

vec3 swellDisplace(vec2 p, float t){
  vec3 d = vec3(0.0);
  for(int i=0;i<SWELL_COUNT;i++){
    if(i >= uSwellCount) break;
    vec4 a = uSwellA[i]; vec4 b = uSwellB[i];
    float ph = a.w*(a.x*p.x + a.y*p.y) - b.x*t + b.z;
    float s = sin(ph), c = cos(ph);
    d.y += a.z*s;
    float q = b.y*a.z*c;
    d.x += a.x*q;
    d.z += a.y*q;
  }
  return d;
}
/* 解析梯度（用于法线，比差分更干净） */
void swellNormal(vec2 p, float t, out vec3 n, out float jac){
  vec2 dhdx = vec2(0.0);       // (∂y/∂x, ∂y/∂z)
  vec2 ddx = vec2(0.0);        // ∂Dx/∂x, ∂Dz/∂z
  float dxz = 0.0, dzx = 0.0;
  for(int i=0;i<SWELL_COUNT;i++){
    if(i >= uSwellCount) break;
    vec4 a = uSwellA[i]; vec4 b = uSwellB[i];
    float ph = a.w*(a.x*p.x + a.y*p.y) - b.x*t + b.z;
    float s = sin(ph), c = cos(ph);
    float ak = a.z*a.w;
    dhdx += vec2(a.x, a.y) * (ak*c);
    float qk = b.y*a.z*a.w*(-s);
    ddx += vec2(a.x*a.x, a.y*a.y) * qk;
    dxz += a.x*a.y*qk;
    dzx += a.y*a.x*qk;
  }
  n = normalize(vec3(-dhdx.x, 1.0, -dhdx.y));
  jac = (1.0 + ddx.x)*(1.0 + ddx.y) - dxz*dzx;
}
`;
