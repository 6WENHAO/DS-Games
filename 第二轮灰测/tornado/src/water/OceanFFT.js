/**
 * OceanFFT.js — GPU 快速傅里叶变换海面（Tessendorf 方法）。
 *
 * 频谱：Phillips / JONSWAP 混合，带 Hasselmann 方向扩散与短波抑制；
 *       h̃(k,t) = h̃₀(k)·e^{iωt} + h̃₀*(−k)·e^{−iωt}，ω = √(g·k)（深水色散）。
 * 位移：垂直 hy 与水平尖化 D = (−i k̂)·h̃。利用线性性把 Dx、Dz 打包成一个复数场
 *       (Dx + i·Dz)，于是一张 RGBA 纹理即可同时承载两个复数场，逆变换次数减半。
 * 变换：迭代 Cooley–Tukey（先做位反转置换 pass，再 log2N 级蝶形），
 *       用 GLSL ES 3.0 的整数位运算直接算索引，不需要蝶形查找表。
 * 输出：uDisp（hy, Dx, Dz）与 uNorm（法线 xz、雅可比/泡沫、高度），供水面材质采样。
 */
import * as THREE from 'three';
import { FullScreenPass } from '../core/Engine.js';

const G = 9.81;

const FFT_COMMON = /* glsl */`
vec2 cmul(vec2 a, vec2 b){ return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
uint revBits(uint v, uint bits){
  v = ((v & 0xaaaaaaaau) >> 1u) | ((v & 0x55555555u) << 1u);
  v = ((v & 0xccccccccu) >> 2u) | ((v & 0x33333333u) << 2u);
  v = ((v & 0xf0f0f0f0u) >> 4u) | ((v & 0x0f0f0f0fu) << 4u);
  v = ((v & 0xff00ff00u) >> 8u) | ((v & 0x00ff00ffu) << 8u);
  v = (v >> 16u) | (v << 16u);
  return v >> (32u - bits);
}
`;

export class OceanFFT {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {number} size 2 的幂（64/128/256/512）
   */
  constructor(renderer, size = 256) {
    this.renderer = renderer;
    this.size = size;
    this.logN = Math.round(Math.log2(size));
    this.patch = 240;
    this.time = 0;
    this._ready = false;

    const rtOpt = {
      type: THREE.FloatType, format: THREE.RGBAFormat,
      magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter,
      depthBuffer: false, stencilBuffer: false, generateMipmaps: false,
      colorSpace: THREE.NoColorSpace,
    };
    this.h0 = new THREE.DataTexture(new Float32Array(size * size * 4), size, size, THREE.RGBAFormat, THREE.FloatType);
    this.h0.magFilter = this.h0.minFilter = THREE.NearestFilter;
    this.h0.needsUpdate = true;

    this.pingA = new THREE.WebGLRenderTarget(size, size, rtOpt);
    this.pingB = new THREE.WebGLRenderTarget(size, size, rtOpt);
    this.dispRT = new THREE.WebGLRenderTarget(size, size, {
      type: THREE.HalfFloatType, format: THREE.RGBAFormat,
      magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter,
      depthBuffer: false, stencilBuffer: false, colorSpace: THREE.NoColorSpace,
    });
    this.dispRT.texture.wrapS = this.dispRT.texture.wrapT = THREE.RepeatWrapping;
    this.normRT = new THREE.WebGLRenderTarget(size, size, {
      type: THREE.HalfFloatType, format: THREE.RGBAFormat,
      magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter,
      depthBuffer: false, stencilBuffer: false, colorSpace: THREE.NoColorSpace,
    });
    this.normRT.texture.wrapS = this.normRT.texture.wrapT = THREE.RepeatWrapping;

    /* ---------- pass 1：时间演化频谱 ---------- */
    this.pSpectrum = new FullScreenPass(/* glsl */`
      uniform sampler2D tH0;
      uniform float uTime, uPatch, uN, uChoppy;
      ${FFT_COMMON}
      void main(){
        ivec2 px = ivec2(gl_FragCoord.xy);
        vec4 h0 = texelFetch(tH0, px, 0);
        float N = uN;
        vec2 kv = 2.0*3.14159265359*(vec2(px) - N*0.5)/uPatch;
        float kl = length(kv);
        if(kl < 1e-6){ fragColor = vec4(0.0); return; }
        float w = sqrt(9.81*kl);
        float c = cos(w*uTime), s = sin(w*uTime);
        /* h = h0·e^{iwt} + conj(h0(-k))·e^{-iwt} */
        vec2 e0 = vec2(c, s), e1 = vec2(c, -s);
        vec2 h = cmul(h0.xy, e0) + cmul(h0.zw, e1);
        /* 水平尖化：D = -i·k̂·h，把 Dx、Dz 合并成一个复数场 (Dx + i·Dz) */
        vec2 kn = kv/kl;
        vec2 idx = vec2(h.y, -h.x);            // -i*h
        vec2 dx = idx * kn.x * uChoppy;
        vec2 dz = idx * kn.y * uChoppy;
        /* (Dx + i Dz) 的频谱 = Sx + i·Sz */
        vec2 dcombo = vec2(dx.x - dz.y, dx.y + dz.x);
        fragColor = vec4(h, dcombo);
      }`, {
      tH0: { value: this.h0 }, uTime: { value: 0 }, uPatch: { value: 240 },
      uN: { value: size }, uChoppy: { value: 1.0 },
    });

    /* ---------- pass 2：位反转置换 ---------- */
    this.pPermute = new FullScreenPass(/* glsl */`
      uniform sampler2D tSrc; uniform uint uBits; uniform int uAxis;
      ${FFT_COMMON}
      void main(){
        ivec2 px = ivec2(gl_FragCoord.xy);
        ivec2 sp = px;
        if(uAxis == 0) sp.x = int(revBits(uint(px.x), uBits));
        else           sp.y = int(revBits(uint(px.y), uBits));
        fragColor = texelFetch(tSrc, sp, 0);
      }`, { tSrc: { value: null }, uBits: { value: this.logN }, uAxis: { value: 0 } });

    /* ---------- pass 3：蝶形（每级一次） ---------- */
    this.pButterfly = new FullScreenPass(/* glsl */`
      uniform sampler2D tSrc; uniform uint uLen; uniform int uAxis; uniform float uSign;
      ${FFT_COMMON}
      void main(){
        ivec2 px = ivec2(gl_FragCoord.xy);
        uint x = uint(uAxis == 0 ? px.x : px.y);
        uint half_ = uLen >> 1u;
        uint blk = x & (~(uLen - 1u));
        uint j   = x & (half_ - 1u);
        bool top = (x & half_) == 0u;
        ivec2 pa = px, pb = px;
        if(uAxis == 0){ pa.x = int(blk + j); pb.x = int(blk + j + half_); }
        else          { pa.y = int(blk + j); pb.y = int(blk + j + half_); }
        vec4 a = texelFetch(tSrc, pa, 0);
        vec4 b = texelFetch(tSrc, pb, 0);
        float ang = uSign * 6.28318530718 * float(j) / float(uLen);
        vec2 tw = vec2(cos(ang), sin(ang));
        vec2 t0 = cmul(tw, b.xy);
        vec2 t1 = cmul(tw, b.zw);
        fragColor = top ? vec4(a.xy + t0, a.zw + t1) : vec4(a.xy - t0, a.zw - t1);
      }`, { tSrc: { value: null }, uLen: { value: 2 }, uAxis: { value: 0 }, uSign: { value: 1 } });

    /* ---------- pass 4：符号修正 + 打包位移 ---------- */
    this.pInvert = new FullScreenPass(/* glsl */`
      uniform sampler2D tSrc; uniform float uScale;
      void main(){
        ivec2 px = ivec2(gl_FragCoord.xy);
        vec4 v = texelFetch(tSrc, px, 0);
        /* 频谱以 N/2 为中心 → 空间域乘 (-1)^(x+y) */
        float sgn = ((px.x + px.y) % 2 == 0) ? 1.0 : -1.0;
        fragColor = vec4(v.x*sgn*uScale, v.z*sgn*uScale, v.w*sgn*uScale, 1.0);
      }`, { tSrc: { value: null }, uScale: { value: 1 } });

    /* ---------- pass 5：法线 + 雅可比（泡沫） ---------- */
    this.pNormal = new FullScreenPass(/* glsl */`
      uniform sampler2D tDisp; uniform float uN, uPatch, uFoamBias;
      void main(){
        ivec2 px = ivec2(gl_FragCoord.xy);
        int N = int(uN);
        ivec2 xp = ivec2((px.x+1)%N, px.y), xm = ivec2((px.x+N-1)%N, px.y);
        ivec2 zp = ivec2(px.x, (px.y+1)%N), zm = ivec2(px.x, (px.y+N-1)%N);
        vec3 dxp = texelFetch(tDisp, xp, 0).xyz, dxm = texelFetch(tDisp, xm, 0).xyz;
        vec3 dzp = texelFetch(tDisp, zp, 0).xyz, dzm = texelFetch(tDisp, zm, 0).xyz;
        float d = 2.0*uPatch/uN;
        float dhdx = (dxp.x - dxm.x)/d;
        float dhdz = (dzp.x - dzm.x)/d;
        vec3 n = normalize(vec3(-dhdx, 1.0, -dhdz));
        /* 折叠判定：J = (1+∂Dx/∂x)(1+∂Dz/∂z) − (∂Dx/∂z)(∂Dz/∂x) */
        float jxx = 1.0 + (dxp.y - dxm.y)/d;
        float jzz = 1.0 + (dzp.z - dzm.z)/d;
        float jxz = (dzp.y - dzm.y)/d;
        float jzx = (dxp.z - dxm.z)/d;
        float J = jxx*jzz - jxz*jzx;
        float foam = clamp(uFoamBias - J, 0.0, 2.0);
        fragColor = vec4(n.x, n.z, foam, texelFetch(tDisp, px, 0).x);
      }`, {
      tDisp: { value: null }, uN: { value: size }, uPatch: { value: 240 }, uFoamBias: { value: 0.62 },
    });

    this.setSpectrum(12, 45, 240, 1.0);
  }

  /** 生成初始频谱 h̃₀（CPU，参数变化时才重算） */
  setSpectrum(windSpeed, windDirDeg, patchSize, ampScale = 1, shortCut = 1.0) {
    const N = this.size, data = this.h0.image.data;
    const L = patchSize;
    this.patch = L;
    const dir = windDirDeg * Math.PI / 180;
    const wx = Math.cos(dir), wz = Math.sin(dir);
    const Lw = (windSpeed * windSpeed) / G;          // 风区特征长度
    const A = 0.000042 * ampScale * ampScale;        // 总体幅度（配合无归一化的逆变换）
    const lMin = 0.9 * shortCut;                     // 短波抑制尺度（米）
    /** 只保留短波段：长波交给 GerstnerSwell（CPU/GPU 严格一致，供浮力使用） */
    const lamMaxKeep = 90;

    const phillips = (kx, kz) => {
      const k2 = kx * kx + kz * kz;
      if (k2 < 1e-12) return 0;
      const k = Math.sqrt(k2);
      const lam = (2 * Math.PI) / k;
      let p = A * Math.exp(-1 / (k2 * Lw * Lw)) / (k2 * k2);
      const dk = (kx * wx + kz * wz) / k;
      p *= Math.pow(Math.abs(dk), 4);                // 方向扩散（顺风为主）
      if (dk < 0) p *= 0.12;                          // 逆风分量很弱
      p *= Math.exp(-k2 * lMin * lMin);               // 抑制过短波
      /* 高通：长波留给解析涌浪，避免两套波叠加导致浪高翻倍 */
      p *= 1 - Math.exp(-Math.pow(lamMaxKeep / lam, 2.2));
      return p;
    };

    /* 确定性高斯：必须能由 (i,j) 重算，才能构造严格的 Hermite 对称
       —— 否则 Dx / Dz 打包成同一复数场时会互相污染。 */
    const gauss2 = (i, j, out) => {
      let h = (i * 73856093) ^ (j * 19349663) ^ 0x7ed55d16;
      h = Math.imul(h ^ (h >>> 15), 2246822519); h ^= h >>> 13;
      h = Math.imul(h, 3266489917); h ^= h >>> 16;
      let h2 = Math.imul(h ^ 0x9e3779b9, 668265263); h2 ^= h2 >>> 15;
      h2 = Math.imul(h2, 2654435761); h2 ^= h2 >>> 13;
      const u = ((h >>> 0) / 4294967296) * 0.9999998 + 1e-7;
      const v = ((h2 >>> 0) / 4294967296);
      const r = Math.sqrt(-2 * Math.log(u));
      out[0] = r * Math.cos(2 * Math.PI * v);
      out[1] = r * Math.sin(2 * Math.PI * v);
    };

    const g = [0, 0], gm = [0, 0];
    const inv = 1 / Math.SQRT2;
    for (let j = 0; j < N; j++) {
      const jm = (N - j) % N;
      for (let i = 0; i < N; i++) {
        const im = (N - i) % N;
        const kx = (2 * Math.PI * (i - N / 2)) / L;
        const kz = (2 * Math.PI * (j - N / 2)) / L;
        const p = Math.sqrt(phillips(kx, kz)) * inv;
        const pm = Math.sqrt(phillips(-kx, -kz)) * inv;
        gauss2(i, j, g);
        gauss2(im, jm, gm);
        const o = (j * N + i) * 4;
        /* h̃₀(k) */
        data[o + 0] = g[0] * p;
        data[o + 1] = g[1] * p;
        /* conj(h̃₀(−k))：用 (-k) 处同一组随机数，保证 h̃(−k) = conj(h̃(k)) */
        data[o + 2] = gm[0] * pm;
        data[o + 3] = -gm[1] * pm;
      }
    }
    this.h0.needsUpdate = true;
    this.pSpectrum.uniforms.uPatch.value = L;
    this.pNormal.uniforms.uPatch.value = L;
    this._ready = true;
  }

  /** 每帧执行全部 pass */
  update(time, choppy = 1, foamBias = 0.62, ampScale = 1) {
    if (!this._ready) return;
    const r = this.renderer;
    const prevTarget = r.getRenderTarget();
    this.pSpectrum.uniforms.uTime.value = time;
    this.pSpectrum.uniforms.uChoppy.value = choppy;
    this.pSpectrum.render(r, this.pingA);

    let src = this.pingA, dst = this.pingB;
    for (let axis = 0; axis < 2; axis++) {
      this.pPermute.uniforms.tSrc.value = src.texture;
      this.pPermute.uniforms.uBits.value = this.logN;
      this.pPermute.uniforms.uAxis.value = axis;
      this.pPermute.render(r, dst);
      [src, dst] = [dst, src];
      for (let s = 1; s <= this.logN; s++) {
        this.pButterfly.uniforms.tSrc.value = src.texture;
        this.pButterfly.uniforms.uLen.value = 1 << s;
        this.pButterfly.uniforms.uAxis.value = axis;
        this.pButterfly.uniforms.uSign.value = 1;       // 逆变换用 e^{+i...}
        this.pButterfly.render(r, dst);
        [src, dst] = [dst, src];
      }
    }
    this.pInvert.uniforms.tSrc.value = src.texture;
    this.pInvert.uniforms.uScale.value = ampScale;
    this.pInvert.render(r, this.dispRT);

    this.pNormal.uniforms.tDisp.value = this.dispRT.texture;
    this.pNormal.uniforms.uFoamBias.value = foamBias;
    this.pNormal.render(r, this.normRT);
    r.setRenderTarget(prevTarget);
  }

  get dispTex() { return this.dispRT.texture; }
  get normTex() { return this.normRT.texture; }

  dispose() {
    this.pingA.dispose(); this.pingB.dispose();
    this.dispRT.dispose(); this.normRT.dispose();
    this.h0.dispose();
    for (const p of [this.pSpectrum, this.pPermute, this.pButterfly, this.pInvert, this.pNormal]) p.dispose();
  }
}
