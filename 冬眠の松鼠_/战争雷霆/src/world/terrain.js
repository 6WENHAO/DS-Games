import * as THREE from 'three';
import { makeNoise2D, fbm, clamp, lerp } from '../core/utils.js';

/**
 * 地形系统：程序化高度场 + 道路压平 + PBR 多层混合贴图（草/干草地/泥路/岩石/砾石）
 */
export class Terrain {
  /**
   * @param {object} assets  资源
   * @param {object} layout  地图布局（提供道路样条用于压平与泥土遮罩）
   */
  constructor(assets, layout) {
    this.size = layout.worldSize;        // 世界尺寸（米）
    this.segments = 220;
    this.maxHeight = 26;
    this.layout = layout;
    this.noise = makeNoise2D(layout.seed);

    this._buildHeightField();
    this._buildControlTexture();
    this._buildMesh(assets);
  }

  /* ---------------- 高度场 ---------------- */
  _rawHeight(x, z) {
    const s = this.size;
    const n = this.noise;
    let h = fbm(n, x / s * 3.1 + 10, z / s * 3.1 + 10, 5) * this.maxHeight;
    h += fbm(n, x / s * 9 + 40, z / s * 9 + 40, 3) * 3.2;
    // 边缘抬升成谷地包围感
    const edge = Math.max(Math.abs(x), Math.abs(z)) / (s * 0.5);
    h += Math.pow(clamp((edge - 0.75) / 0.25, 0, 1), 2) * 26;
    return h;
  }

  _roadDist(x, z) {
    let best = 1e9;
    for (const road of this.layout.roads) {
      for (let i = 0; i < road.length - 1; i++) {
        const ax = road[i][0], az = road[i][1];
        const bx = road[i + 1][0], bz = road[i + 1][1];
        const abx = bx - ax, abz = bz - az;
        const t = clamp(((x - ax) * abx + (z - az) * abz) / (abx * abx + abz * abz), 0, 1);
        const dx = x - (ax + abx * t), dz = z - (az + abz * t);
        const d = Math.sqrt(dx * dx + dz * dz);
        if (d < best) best = d;
      }
    }
    return best;
  }

  _buildHeightField() {
    const res = this.segments + 1;
    this.res = res;
    this.heights = new Float32Array(res * res);
    const half = this.size / 2;
    // 预采样村庄/压平区
    const flats = this.layout.flatAreas; // {x,z,r,h?}
    for (let iz = 0; iz < res; iz++) {
      for (let ix = 0; ix < res; ix++) {
        const x = -half + (ix / this.segments) * this.size;
        const z = -half + (iz / this.segments) * this.size;
        let h = this._rawHeight(x, z);
        // 平整区域（村庄、据点、出生点）
        for (const f of flats) {
          const d = Math.hypot(x - f.x, z - f.z);
          if (d < f.r * 1.6) {
            const target = f.h !== undefined ? f.h : this._rawHeight(f.x, f.z);
            const w = 1 - clamp((d - f.r * 0.55) / (f.r * 1.05), 0, 1);
            h = lerp(h, target, w * w * (3 - 2 * w));
          }
        }
        // 道路压平
        const rd = this._roadDist(x, z);
        if (rd < 26) {
          const along = this._roadHeightNear(x, z);
          const w = 1 - clamp((rd - 5) / 21, 0, 1);
          h = lerp(h, along, w * 0.85);
        }
        this.heights[iz * res + ix] = h;
      }
    }
  }

  /** 道路附近参考高度：取道路走廊粗采样 */
  _roadHeightNear(x, z) {
    return this._rawHeight(x, z) * 0.35 + this._roadBase(x, z) * 0.65;
  }
  _roadBase(x, z) {
    // 用低频噪声当作道路缓起伏
    return fbm(this.noise, x / this.size * 1.4 + 3, z / this.size * 1.4 + 3, 3) * this.maxHeight * 0.55;
  }

  heightAt(x, z) {
    const half = this.size / 2;
    const fx = clamp((x + half) / this.size, 0, 0.99999) * this.segments;
    const fz = clamp((z + half) / this.size, 0, 0.99999) * this.segments;
    const ix = Math.floor(fx), iz = Math.floor(fz);
    const tx = fx - ix, tz = fz - iz;
    const res = this.res;
    const h00 = this.heights[iz * res + ix];
    const h10 = this.heights[iz * res + ix + 1];
    const h01 = this.heights[(iz + 1) * res + ix];
    const h11 = this.heights[(iz + 1) * res + ix + 1];
    return lerp(lerp(h00, h10, tx), lerp(h01, h11, tx), tz);
  }

  normalAt(x, z, out = new THREE.Vector3()) {
    const e = 2.2;
    const hL = this.heightAt(x - e, z), hR = this.heightAt(x + e, z);
    const hD = this.heightAt(x, z - e), hU = this.heightAt(x, z + e);
    out.set(hL - hR, 2 * e, hD - hU).normalize();
    return out;
  }

  /** 射线与地形求交（自适应步进+二分，保证短线段也被检测） */
  raycast(origin, dir, maxDist = 3000, step = null) {
    const st = step || Math.max(0.6, Math.min(6, maxDist / 4));
    let prevT = 0;
    const prevAbove = origin.y - this.heightAt(origin.x, origin.z) > 0;
    if (!prevAbove) return { point: origin.clone(), dist: 0 };
    const p = new THREE.Vector3();
    const half = this.size / 2 + 200;
    let t = 0;
    while (t < maxDist) {
      t = Math.min(t + st, maxDist);
      p.copy(origin).addScaledVector(dir, t);
      if (Math.abs(p.x) > half || Math.abs(p.z) > half) return null;
      const above = p.y - this.heightAt(p.x, p.z) > 0;
      if (!above) {
        // 二分精化
        let lo = prevT, hi = t;
        for (let i = 0; i < 12; i++) {
          const mid = (lo + hi) / 2;
          p.copy(origin).addScaledVector(dir, mid);
          if (p.y - this.heightAt(p.x, p.z) > 0) lo = mid; else hi = mid;
        }
        p.copy(origin).addScaledVector(dir, hi);
        return { point: p.clone(), dist: hi };
      }
      prevT = t;
      if (p.y > 400 && dir.y > 0) return null;
    }
    return null;
  }

  /* ---------------- 控制纹理（道路/植被变化） ---------------- */
  _buildControlTexture() {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgb(0,0,0)';
    ctx.fillRect(0, 0, size, size);
    const half = this.size / 2;
    const toPx = (x) => (x + half) / this.size * size;

    // G通道：草地色相变化 (大块噪声)
    const img = ctx.getImageData(0, 0, size, size);
    const n = this.noise;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const wx = (x / size - 0.5) * this.size;
        const wz = (y / size - 0.5) * this.size;
        const g = fbm(n, wx / 130 + 99, wz / 130 + 99, 3) * 0.5 + 0.5;
        const b = fbm(n, wx / 60 - 50, wz / 60 - 50, 3) * 0.5 + 0.5;
        const i = (y * size + x) * 4;
        img.data[i + 1] = clamp(g, 0, 1) * 255;
        img.data[i + 2] = clamp(b, 0, 1) * 255;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // R通道：道路（描线+光晕）
    ctx.globalCompositeOperation = 'lighter';
    for (const pass of [{ w: 30, c: 60 }, { w: 18, c: 110 }, { w: 9, c: 235 }]) {
      ctx.strokeStyle = `rgb(${pass.c},0,0)`;
      ctx.lineWidth = pass.w * size / this.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const road of this.layout.roads) {
        ctx.beginPath();
        ctx.moveTo(toPx(road[0][0]), toPx(road[0][1]));
        for (let i = 1; i < road.length; i++) ctx.lineTo(toPx(road[i][0]), toPx(road[i][1]));
        ctx.stroke();
      }
    }
    // 据点附近碾压泥地
    for (const f of this.layout.dirtPatches || []) {
      const grad = ctx.createRadialGradient(toPx(f.x), toPx(f.z), 0, toPx(f.x), toPx(f.z), f.r * size / this.size);
      grad.addColorStop(0, 'rgba(190,0,0,0.9)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(toPx(f.x), toPx(f.z), f.r * size / this.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    this.controlCanvas = canvas;
    this.controlTex = new THREE.CanvasTexture(canvas);
    this.controlTex.wrapS = this.controlTex.wrapT = THREE.ClampToEdgeWrapping;
    this.controlTex.needsUpdate = true;
  }

  /** 道路强度采样（供AI/摆放判断） */
  roadMaskAt(x, z) {
    return this._roadDist(x, z) < 9 ? 1 : 0;
  }

  /* ---------------- 网格与材质 ---------------- */
  _buildMesh(assets) {
    const geo = new THREE.PlaneGeometry(this.size, this.size, this.segments, this.segments);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const res = this.res;
    for (let iz = 0; iz < res; iz++) {
      for (let ix = 0; ix < res; ix++) {
        const i = iz * res + ix;
        pos.setY(i, this.heights[i]);
      }
    }
    geo.computeVertexNormals();

    const t = assets.terrain;
    const mat = new THREE.MeshStandardMaterial({
      map: t.grass.color,
      normalMap: t.grass.normal,
      roughnessMap: t.grass.rough,
      roughness: 1,
      metalness: 0,
    });

    const uniforms = {
      tGrass2C: { value: t.grass2.color },
      tDirtC: { value: t.dirt.color },
      tDirtN: { value: t.dirt.normal },
      tDirtR: { value: t.dirt.rough },
      tRockC: { value: t.rock.color },
      tRockN: { value: t.rock.normal },
      tRockR: { value: t.rock.rough },
      tGravelC: { value: t.gravel.color },
      tControl: { value: this.controlTex },
      uWorldSize: { value: this.size },
      uRepeat: { value: 1 / 13.5 },
    };

    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          varying vec3 vTPos;
          varying vec3 vTNormal;`)
        .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
          vTPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vTNormal = normalize(mat3(modelMatrix) * objectNormal);`);

      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform sampler2D tGrass2C;
          uniform sampler2D tDirtC; uniform sampler2D tDirtN; uniform sampler2D tDirtR;
          uniform sampler2D tRockC; uniform sampler2D tRockN; uniform sampler2D tRockR;
          uniform sampler2D tGravelC;
          uniform sampler2D tControl;
          uniform float uWorldSize;
          uniform float uRepeat;
          varying vec3 vTPos;
          varying vec3 vTNormal;
          vec4 terrWeights() {
            vec3 ctrl = texture2D(tControl, vTPos.xz / uWorldSize + 0.5).rgb;
            float slope = 1.0 - normalize(vTNormal).y;
            float wRock = smoothstep(0.30, 0.52, slope);
            float wDirt = ctrl.r * (1.0 - wRock);
            float wG2 = smoothstep(0.45, 0.8, ctrl.g) * (1.0 - wRock) * (1.0 - wDirt);
            float wGrass = max(0.0, 1.0 - wRock - wDirt - wG2);
            return vec4(wGrass, wG2, wDirt, wRock);
          }`)
        .replace('#include <map_fragment>', `{
          vec2 tuv = vTPos.xz * uRepeat;
          vec4 w = terrWeights();
          vec3 ctrl = texture2D(tControl, vTPos.xz / uWorldSize + 0.5).rgb;
          vec3 cGrass = texture2D(map, tuv).rgb;
          vec3 cGrass2 = texture2D(tGrass2C, tuv * 1.13).rgb;
          vec3 cDirt = texture2D(tDirtC, tuv * 1.31).rgb;
          vec3 cGravel = texture2D(tGravelC, tuv * 1.7).rgb;
          cDirt = mix(cDirt, cGravel, smoothstep(0.7, 1.0, ctrl.r) * 0.55);
          vec3 cRock = texture2D(tRockC, tuv * 0.61).rgb;
          vec3 col = cGrass * w.x + cGrass2 * w.y + cDirt * w.z + cRock * w.w;
          // 大尺度色斑，削弱平铺感
          float macro = texture2D(tControl, vTPos.xz / uWorldSize * 0.35 + 0.5).b;
          col *= 0.86 + macro * 0.26;
          diffuseColor.rgb *= col;
        }`)
        .replace('#include <normal_fragment_maps>', `{
          vec2 tuv = vTPos.xz * uRepeat;
          vec4 w = terrWeights();
          vec3 nG = texture2D(normalMap, tuv).xyz * 2.0 - 1.0;
          vec3 nD = texture2D(tDirtN, tuv * 1.31).xyz * 2.0 - 1.0;
          vec3 nR = texture2D(tRockN, tuv * 0.61).xyz * 2.0 - 1.0;
          vec3 mapN = normalize(nG * (w.x + w.y) + nD * w.z + nR * w.w);
          mapN.xy *= normalScale;
          normal = normalize( tbn * mapN );
        }`)
        .replace('#include <roughnessmap_fragment>', `
        float roughnessFactor = roughness;
        {
          vec2 tuv = vTPos.xz * uRepeat;
          vec4 w = terrWeights();
          float rG = texture2D(roughnessMap, tuv).g;
          float rD = texture2D(tDirtR, tuv * 1.31).g;
          float rR = texture2D(tRockR, tuv * 0.61).g;
          roughnessFactor *= rG * (w.x + w.y) + rD * w.z + rR * w.w;
        }`);
      // 注：tbn 已由 normal_fragment_begin 在 USE_NORMALMAP_TANGENTSPACE 下自动计算
    };

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    this.mesh.name = 'terrain';
  }
}
