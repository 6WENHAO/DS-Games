/**
 * Terrain.js — 沙漠 / 平原共用的地形。
 *
 * · 高度来自 CPU 生成的 HeightField，同一份数据既上传成半浮点高度图（顶点位移）
 *   也供物体摆放与物理查询，绝不会出现浮空或陷地。
 * · 放射状网格随相机移动 → 天然 LOD。
 * · 材质用 MeshStandardMaterial + onBeforeCompile 注入：地表混合（3 层 splat）、
 *   程序化细节法线、龙卷风破坏刮痕图、被吸起的浮尘。这样能直接白拿 three 的
 *   PBR / 阴影 / IBL，再叠加统一的高度雾。
 * · DamageMap：龙卷风走过的路径实时"刮地"，同时被草地系统读取用于清除植被。
 */
import * as THREE from 'three';
import { makeRadialGrid } from './RadialGrid.js';
import { HeightField } from '../core/Noise.js';
import { clamp } from '../core/Random.js';
import { GLSL_HASH, GLSL_NOISE2 } from '../core/GlslLib.js';

/** float32 → float16 位模式 */
const _f32 = new Float32Array(1);
const _i32 = new Int32Array(_f32.buffer);
function toHalf(val) {
  _f32[0] = val;
  const x = _i32[0];
  let bits = (x >> 16) & 0x8000;
  let m = (x >> 12) & 0x07ff;
  const e = (x >> 23) & 0xff;
  if (e < 103) return bits;
  if (e > 142) { bits |= 0x7c00; bits |= (e === 255 && (x & 0x007fffff)) ? 0x0200 : 0; return bits; }
  if (e < 113) { m |= 0x0800; bits |= (m >> (114 - e)) + ((m >> (113 - e)) & 1); return bits; }
  bits |= ((e - 112) << 10) | (m >> 1);
  bits += m & 1;
  return bits;
}

export class DamageMap {
  /** @param {number} res @param {number} extent 世界覆盖范围（米） */
  constructor(res = 512, extent = 4096) {
    this.res = res;
    this.extent = extent;
    this.data = new Uint8Array(res * res);
    this.texture = new THREE.DataTexture(this.data, res, res, THREE.RedFormat, THREE.UnsignedByteType);
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.wrapS = this.texture.wrapT = THREE.ClampToEdgeWrapping;
    this.texture.needsUpdate = true;
    this._dirty = false;
    this._acc = 0;
  }
  /** 在世界坐标画一笔破坏 */
  paint(wx, wz, radius, strength = 1) {
    const res = this.res, ext = this.extent;
    const px = ((wx + ext * 0.5) / ext) * res;
    const pz = ((wz + ext * 0.5) / ext) * res;
    const pr = Math.max(1, (radius / ext) * res);
    const x0 = Math.max(0, Math.floor(px - pr)), x1 = Math.min(res - 1, Math.ceil(px + pr));
    const z0 = Math.max(0, Math.floor(pz - pr)), z1 = Math.min(res - 1, Math.ceil(pz + pr));
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - px, z - pz) / pr;
        if (d > 1) continue;
        const v = (1 - d * d) * strength * 255;
        const i = z * res + x;
        if (this.data[i] < v) { this.data[i] = Math.min(255, this.data[i] + v * 0.5 + 8); this._dirty = true; }
      }
    }
  }
  sample(wx, wz) {
    const res = this.res, ext = this.extent;
    const x = Math.round(((wx + ext * 0.5) / ext) * res);
    const z = Math.round(((wz + ext * 0.5) / ext) * res);
    if (x < 0 || z < 0 || x >= res || z >= res) return 0;
    return this.data[z * res + x] / 255;
  }
  clear() { this.data.fill(0); this.texture.needsUpdate = true; }
  flush(dt) {
    this._acc += dt;
    if (this._dirty && this._acc > 0.1) { this.texture.needsUpdate = true; this._dirty = false; this._acc = 0; }
  }
}

/** 地表材质注入片段：3 层混合 + 细节法线 + 刮痕 */
const TERRAIN_COMMON = /* glsl */`
uniform sampler2D uHeightMap, uDamageMap;
uniform vec2  uCenter;
uniform float uExtent, uHeightScale, uDetail, uDetailScale;
${GLSL_HASH}
${GLSL_NOISE2}
vec2 worldToUv(vec2 w){ return (w / uExtent) + 0.5; }
float sampleH(vec2 w){
  vec2 uv = clamp(worldToUv(w), vec2(0.0015), vec2(0.9985));
  float h = texture2D(uHeightMap, uv).r;
  /* 细节起伏（不进 CPU 查询，只影响视觉与法线） */
  h += uDetail * (gnoise2(w * uDetailScale) * 0.55 + gnoise2(w * uDetailScale * 3.7) * 0.18);
  return h;
}
float sampleDamage(vec2 w){
  vec2 uv = worldToUv(w);
  if(any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 0.0;
  return texture2D(uDamageMap, uv).r;
}
`;

export class Terrain {
  /**
   * @param {object} o
   * @param {import('../core/Lighting.js').Lighting} o.lighting
   * @param {(x:number,z:number)=>number} o.heightFn
   * @param {number} o.extent  高度图覆盖范围（米）
   * @param {number} o.res     高度图分辨率
   * @param {object} o.look    外观参数
   */
  constructor({ lighting, heightFn, extent = 6144, res = 1024, look = {}, rMax = 13000 }) {
    this.extent = extent;
    this.field = new HeightField(res, extent, heightFn);
    this.damage = new DamageMap(512, extent);

    /* 高度图 → 半浮点纹理 */
    const half = new Uint16Array(res * res);
    for (let i = 0; i < half.length; i++) half[i] = toHalf(this.field.data[i]);
    this.heightTex = new THREE.DataTexture(half, res, res, THREE.RedFormat, THREE.HalfFloatType);
    this.heightTex.magFilter = THREE.LinearFilter;
    this.heightTex.minFilter = THREE.LinearFilter;
    this.heightTex.wrapS = this.heightTex.wrapT = THREE.ClampToEdgeWrapping;
    this.heightTex.needsUpdate = true;

    this.look = Object.assign({
      colLow: new THREE.Color(0.30, 0.26, 0.19),
      colMid: new THREE.Color(0.45, 0.39, 0.27),
      colHigh: new THREE.Color(0.58, 0.53, 0.41),
      colRock: new THREE.Color(0.30, 0.29, 0.28),
      colScar: new THREE.Color(0.20, 0.17, 0.13),
      slopeRock: 0.55,
      detail: 0.35,
      detailScale: 0.055,
      ripple: 0.0,          // 沙纹强度
      rippleScale: 0.35,
      macro: 0.5,           // 大尺度色斑
      roughness: 0.92,
      dustLift: 0.0,        // 近龙卷风区域地表被吸起的浮尘
    }, look);

    this.uniforms = {
      uHeightMap: { value: this.heightTex },
      uDamageMap: { value: this.damage.texture },
      uCenter: { value: new THREE.Vector2() },
      uExtent: { value: extent },
      uHeightScale: { value: 1 },
      uDetail: { value: this.look.detail },
      uDetailScale: { value: this.look.detailScale },
      uColLow: { value: this.look.colLow },
      uColMid: { value: this.look.colMid },
      uColHigh: { value: this.look.colHigh },
      uColRock: { value: this.look.colRock },
      uColScar: { value: this.look.colScar },
      uSlopeRock: { value: this.look.slopeRock },
      uRipple: { value: this.look.ripple },
      uRippleScale: { value: this.look.rippleScale },
      uMacro: { value: this.look.macro },
      uTornadoPos: lighting.uniforms.uTornadoPos,
      uTornadoRadius: lighting.uniforms.uTornadoRadius,
      uDustLift: { value: this.look.dustLift },
      uTime: lighting.uniforms.uTime,
    };

    this.material = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: this.look.roughness, metalness: 0.0, dithering: true,
    });
    this._patch(this.material, false);
    lighting.patchFog(this.material);

    /* 阴影用的深度材质需要同样的顶点位移（depthPacking 必须与 three 内置一致） */
    this.depthMaterial = new THREE.MeshDepthMaterial();
    this._patch(this.depthMaterial, true);

    this.geometry = makeRadialGrid({ rings: 210, segs: 208, r0: 1.1, rMax });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.customDepthMaterial = this.depthMaterial;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.name = 'terrain';
    this.mesh.matrixAutoUpdate = false;
  }

  _patch(material, depthOnly) {
    const U = this.uniforms;
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, U);

      if (depthOnly) {
        /* 深度材质里 <beginnormal_vertex> 被包在 #ifdef USE_DISPLACEMENTMAP 内，
           所以位移只能在 begin_vertex 处完成，且不需要法线。 */
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', `#include <common>\n${TERRAIN_COMMON}`)
          .replace('#include <begin_vertex>', `
            vec3 transformed = vec3(position.x, sampleH(position.xz + uCenter), position.z);`);
      } else {
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', `#include <common>
            varying vec3 vTerrWorld;
            varying vec3 vTerrNormal;
            varying float vTerrRadius;
            ${TERRAIN_COMMON}`)
          .replace('#include <beginnormal_vertex>', `
            vec2 wxz = position.xz + uCenter;
            float H = sampleH(wxz);
            /* 法线由高度图梯度求得，步长随距离放大以避免远处噪点 */
            float e = max(2.0, aRadius * 0.02);
            float hl = sampleH(wxz - vec2(e, 0.0)), hr = sampleH(wxz + vec2(e, 0.0));
            float hd = sampleH(wxz - vec2(0.0, e)), hu = sampleH(wxz + vec2(0.0, e));
            vec3 objectNormal = normalize(vec3(hl - hr, 2.0*e, hd - hu));
            vTerrWorld = vec3(wxz.x, H, wxz.y);
            vTerrNormal = objectNormal;
            vTerrRadius = aRadius;`)
          .replace('#include <begin_vertex>', `
            vec3 transformed = vec3(position.x, H, position.z);`);

        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', `#include <common>
            varying vec3 vTerrWorld;
            varying vec3 vTerrNormal;
            varying float vTerrRadius;
            uniform vec3 uColLow, uColMid, uColHigh, uColRock, uColScar, uTornadoPos;
            uniform float uSlopeRock, uRipple, uRippleScale, uMacro, uTornadoRadius, uDustLift, uTime;
            ${TERRAIN_COMMON}`)
          /* 注意：必须放在 roughnessmap/normal_fragment 之后，此时 roughnessFactor 与 normal 才存在 */
          .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
            vec2 w = vTerrWorld.xz;
            float slope = 1.0 - clamp(vTerrNormal.y, 0.0, 1.0);
            float hN = clamp(vTerrWorld.y / 40.0, -1.0, 3.0);
            /* 大尺度色斑 + 中尺度斑驳 */
            float m1 = fbm2(w * 0.0016, 4);
            float m2 = fbm2(w * 0.019 + 31.0, 3);
            vec3 terrBase = mix(uColLow, uColMid, smoothstep(0.25, 0.75, m1*0.6 + hN*0.35 + 0.2));
            terrBase = mix(terrBase, uColHigh, smoothstep(0.45, 0.95, m2*0.7 + hN*0.4));
            terrBase = mix(terrBase, uColRock, smoothstep(uSlopeRock*0.55, uSlopeRock, slope) * (0.65 + 0.35*m2));
            terrBase *= 0.88 + 0.24*m2 * uMacro*2.0;
            /* 沙纹 / 草茬细节：方向与幅度都被低频噪声调制，避免出现规则条纹 */
            if(uRipple > 0.001){
              float dirN = fbm2(w*0.0021 + 17.0, 2) * 6.2831;
              vec2 rd = vec2(cos(dirN), sin(dirN));
              float patchA = smoothstep(0.35, 0.75, fbm2(w*0.0065 + 5.0, 3));
              float rip = sin(dot(w, rd)*uRippleScale + fbm2(w*0.02, 3)*9.0) * 0.5 + 0.5;
              rip = pow(rip, 2.2);
              terrBase *= 1.0 - uRipple*0.2*patchA + uRipple*0.34*rip*patchA;
            }
            /* 破坏刮痕：翻起深色土 + 变粗糙 */
            float dmg = sampleDamage(w);
            terrBase = mix(terrBase, uColScar * (0.8 + 0.5*m2), smoothstep(0.05, 0.75, dmg));
            diffuseColor.rgb *= terrBase;
            roughnessFactor = mix(roughnessFactor, 0.99, dmg*0.6);
            roughnessFactor = mix(roughnessFactor, 0.98, smoothstep(1200.0, 6000.0, vTerrRadius));
            /* 龙卷风附近扬尘（贴地的一层浮尘） */
            float dT = length(w - uTornadoPos.xz);
            float lift = uDustLift * exp(-dT / max(uTornadoRadius*7.0, 60.0));
            diffuseColor.rgb = mix(diffuseColor.rgb, uColMid*1.25, clamp(lift, 0.0, 0.55));`);
      }
      /* 供顶点着色器使用的属性声明 */
      shader.vertexShader = 'attribute float aRadius;\nattribute float aRing;\n' + shader.vertexShader;
    };
    material.needsUpdate = true;
  }

  /** CPU 高度查询（物体摆放 / 物理 / 相机） */
  heightAt(x, z) { return this.field.height(x, z); }
  normalAt(x, z, out) { return this.field.normal(x, z, out); }
  slopeAt(x, z) { return this.field.slope(x, z); }

  /**
   * 压平一块地基（建筑不会一半悬空）。会同时修改 CPU 高度场与 GPU 高度图。
   * @returns {number} 该地基的目标高度
   */
  flatten(x, z, radius, feather = 1.6) {
    const n = this.size = this.field.size;
    const ext = this.extent;
    const step = ext / (n - 1);
    const half = ext * 0.5;
    const target = this.field.height(x, z);
    const rOut = radius * feather;
    const i0 = Math.max(0, Math.floor((x - rOut + half) / step));
    const i1 = Math.min(n - 1, Math.ceil((x + rOut + half) / step));
    const j0 = Math.max(0, Math.floor((z - rOut + half) / step));
    const j1 = Math.min(n - 1, Math.ceil((z + rOut + half) / step));
    const d = this.field.data;
    for (let j = j0; j <= j1; j++) {
      const wz = -half + j * step;
      for (let i = i0; i <= i1; i++) {
        const wx = -half + i * step;
        const dist = Math.hypot(wx - x, wz - z);
        if (dist > rOut) continue;
        const t = dist <= radius ? 1 : 1 - (dist - radius) / Math.max(rOut - radius, 1e-3);
        const k = t * t * (3 - 2 * t);
        const idx = j * n + i;
        d[idx] = d[idx] * (1 - k) + target * k;
      }
    }
    this._heightDirty = true;
    return target;
  }

  /** 压平后统一重新上传高度图 */
  commitHeights() {
    if (!this._heightDirty) return;
    const half16 = this.heightTex.image.data;
    const d = this.field.data;
    for (let i = 0; i < d.length; i++) half16[i] = toHalf(d[i]);
    this.heightTex.needsUpdate = true;
    this._heightDirty = false;
  }

  /** 网格跟随相机 */
  update(camera, dt, tornado) {
    const cx = camera.position.x, cz = camera.position.z;
    this.mesh.position.set(cx, 0, cz);
    this.mesh.updateMatrix();
    this.mesh.updateMatrixWorld(true);
    this.uniforms.uCenter.value.set(cx, cz);
    if (tornado && tornado.strength > 0.01) {
      this.damage.paint(tornado.position.x, tornado.position.z, tornado.baseRadius * 1.5, 0.85);
    }
    this.damage.flush(dt);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.depthMaterial.dispose();
    this.heightTex.dispose();
    this.damage.texture.dispose();
  }
}
