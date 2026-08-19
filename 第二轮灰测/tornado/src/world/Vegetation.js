/**
 * Vegetation.js — 实例化植被（草 / 作物 / 灌丛）。
 *
 * 关键技巧：
 *  · 环绕实例化（wrapped instancing）—— 实例只在一个 S×S 的小块里随机分布，顶点着色器把它
 *    平移到离相机最近的那个副本上，于是有限实例数产生"无限草原"，且永远绕着相机最密。
 *  · 高度直接采样地形高度图（与 CPU 查询同一份数据）→ 永远贴地。
 *  · 采样龙卷风破坏图：走过的地方草被连根拔起（缩放到 0）。
 *  · 风：基础风 + 阵风噪声 + 龙卷风 Rankine 切向/径向风场，靠近涡心时被压平并绕着涡心倒伏。
 *  · 三层不同尺度（近密、中、远大）叠加，远处自动稀疏 —— 天然 LOD。
 */
import * as THREE from 'three';
import { P } from '../core/Params.js';
import { GLSL_HASH, GLSL_NOISE2, GLSL_AERIAL } from '../core/GlslLib.js';

/** 一片叶片：竖直细长四边形，3 段（6 三角），顶端收窄 */
function bladeGeometry(segments = 3, curve = 0.18) {
  const pos = [], uvs = [], idx = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const w = (1 - t) * (1 - t) * 0.5 + 0.02;
    const bend = curve * t * t;
    pos.push(-w, t, bend, w, t, bend);
    uvs.push(0, t, 1, t);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const VEG_VERT = /* glsl */`
precision highp float;
attribute vec3 position;
attribute vec2 uv;
attribute vec4 aInst;     // x,z 块内偏移, y 朝向, w 高度倍率
attribute vec4 aVar;      // x 宽度, y 颜色变化, z 相位, w 类型
uniform mat4 projectionMatrix, viewMatrix;
uniform vec3 uCamPos;
uniform sampler2D uHeightMap, uDamageMap;
uniform float uExtent, uTile, uSize, uWidth, uDetail, uFar;
uniform float uTime, uWindSpeed, uWindDir, uGust;
uniform vec3 uTorPos;
uniform float uTorRc, uTorVmax, uTorHeight, uTorOn, uPatchy;
varying vec3 vWorld;
varying float vT;
varying float vShade;
varying float vVar;
varying float vFlat;

${GLSL_HASH}
${GLSL_NOISE2}

float sampleH(vec2 w){
  vec2 uv2 = clamp(w/uExtent + 0.5, vec2(0.0015), vec2(0.9985));
  return texture2D(uHeightMap, uv2).r;
}
float sampleDmg(vec2 w){
  vec2 uv2 = w/uExtent + 0.5;
  if(any(lessThan(uv2, vec2(0.0))) || any(greaterThan(uv2, vec2(1.0)))) return 0.0;
  return texture2D(uDamageMap, uv2).r;
}

void main(){
  /* --- 环绕到离相机最近的副本 --- */
  vec2 base = aInst.xz;
  vec2 cam = uCamPos.xz;
  vec2 w = base + uTile * floor((cam - base)/uTile + 0.5);
  /* 用"世界位置"再哈希一次：同一个实例在不同副本里位置/高度/朝向都不同，
     彻底打散环绕实例化固有的平铺重复感 */
  vec2 cellHash = hash22(floor(w*0.037) + aInst.xz*0.013);
  w += cellHash * (uTile * 0.085);
  float worldVar = hash12(floor(w*0.21));

  float dist = length(w - cam);
  float h = sampleH(w);
  vec3 root = vec3(w.x, h, w.y);

  /* --- 成片分布 + 破坏剔除 + 距离剔除 --- */
  float patch = fbm2(w*0.011, 3);
  float alive = step(uPatchy, patch + aVar.y*0.28 + worldVar*0.16);
  alive *= 1.0 - smoothstep(uFar*0.82, uFar, dist);
  alive *= 1.0 - smoothstep(0.12, 0.42, sampleDmg(w));
  if(alive < 0.5 || uDetail < 0.01){
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vT = 0.0; vShade = 0.0; vWorld = root; vVar = 0.0; vFlat = 0.0;
    return;
  }

  /* --- 尺寸：远处稍大以维持视觉覆盖 --- */
  float hgt = uSize * aInst.w * (0.72 + 0.7*worldVar) * (1.0 + smoothstep(60.0, uFar, dist)*0.85);
  float wid = uWidth * aVar.x * (1.0 + smoothstep(60.0, uFar, dist)*0.7);

  /* --- 朝向（世界哈希再扰动一次） --- */
  float ang = aInst.y + worldVar*6.2831;
  float ca = cos(ang), sa = sin(ang);
  vec3 p = position;
  p.x *= wid; p.z *= wid;
  p.y *= hgt;
  vec3 local = vec3(ca*p.x - sa*p.z, p.y, sa*p.x + ca*p.z);

  /* --- 风：基础 + 阵风 --- */
  float t = clamp(position.y, 0.0, 1.0);
  float stiff = t*t;
  vec2 wd = vec2(cos(uWindDir), sin(uWindDir));
  float gust = (fbm2(w*0.006 - wd*uTime*0.09, 3) - 0.45) * uGust;
  float amp = (uWindSpeed*0.028 + gust*0.5) * hgt;
  vec2 bend = wd * amp;
  bend += wd.yx*vec2(-1.0,1.0) * sin(uTime*2.2 + aVar.z*6.28 + w.x*0.08)*0.13*amp;

  /* --- 龙卷风风场（与体积着色器同一套 Rankine 公式） --- */
  float flat_ = 0.0;
  if(uTorOn > 0.5){
    vec2 rel = w - uTorPos.xz;
    float r = max(length(rel), 0.4);
    float rc = max(uTorRc, 1.2);
    float vt = r <= rc ? uTorVmax*(r/rc) : uTorVmax*pow(rc/r, 0.72);
    /* 只有近地面的风对草有意义，随距离衰减 */
    float k = exp(-r/(rc*9.0));
    vec2 tang = vec2(rel.y, -rel.x)/r;
    vec2 rad = -rel/r;
    vec2 tw = (tang*vt + rad*vt*0.45) * k;
    bend += tw * 0.016 * hgt;
    flat_ = clamp(length(tw)*0.02, 0.0, 1.0);
  }

  /* 弯曲：越靠顶端位移越大，同时压低高度（保持长度感） */
  local.xz += bend * stiff;
  local.y -= (length(bend)*stiff)*0.35 + flat_*hgt*0.55*stiff;

  vec3 wp = root + local;
  vWorld = wp;
  vT = t;
  vVar = aVar.y;
  vFlat = flat_;
  /* 简易法线照度：叶片朝向 + 顶端更亮 */
  vShade = 0.35 + 0.65*t;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;

const VEG_FRAG = /* glsl */`
precision highp float;
uniform vec3 uColBase, uColTip, uColDry;
uniform vec3 uSunDir, uSunColor, uAmbient;
uniform float uSunIntensity, uFlash, uDry;
uniform vec3 uCamPos;
varying vec3 vWorld;
varying float vT;
varying float vShade;
varying float vVar;
varying float vFlat;
float sat(float v){ return clamp(v,0.0,1.0); }
${GLSL_AERIAL}
void main(){
  vec3 col = mix(uColBase, uColTip, vT*0.9 + vVar*0.1);
  col = mix(col, uColDry, sat(uDry*(0.35 + vVar*0.65)));
  /* 被龙卷风压过的草偏枯黄 */
  col = mix(col, uColDry*0.9, vFlat*0.45);
  float ndl = sat(dot(normalize(uSunDir), vec3(0.0,1.0,0.0))*0.55 + 0.45);
  vec3 lit = col * (uAmbient*0.85 + uSunColor*uSunIntensity*ndl*0.55) * vShade;
  lit += vec3(0.45,0.5,0.7)*uFlash*0.12;
  lit = applyAerial(lit, uCamPos, vWorld, normalize(uSunDir), uSunColor);
  gl_FragColor = vec4(lit, 1.0);
}
`;

export class GrassField {
  /**
   * @param {object} o
   * @param {import('../core/Lighting.js').Lighting} o.lighting
   * @param {import('./Terrain.js').Terrain} o.terrain
   * @param {Array<{tile:number,count:number,size:number,width:number,far:number,patchy:number}>} o.layers
   * @param {object} o.look
   */
  constructor({ lighting, terrain, layers, look = {}, segments = 3 }) {
    this.lighting = lighting;
    this.terrain = terrain;
    this.group = new THREE.Group();
    this.group.name = 'vegetation';
    this.meshes = [];
    const L = lighting.uniforms;
    this.look = Object.assign({
      colBase: new THREE.Color(0.12, 0.16, 0.06),
      colTip: new THREE.Color(0.42, 0.46, 0.16),
      colDry: new THREE.Color(0.55, 0.46, 0.20),
      dry: 0.35,
      gust: 1.0,
    }, look);

    for (const cfg of layers) {
      const geo = bladeGeometry(segments, cfg.curve ?? 0.2);
      const n = Math.max(16, Math.round(cfg.count));
      const inst = new Float32Array(n * 4);
      const vari = new Float32Array(n * 4);
      /* 分层错开随机种子，避免各层重叠成条纹 */
      let seed = cfg.tile * 7.13 + 1.7;
      const rnd = () => {
        seed = (seed * 16807.0) % 2147483647;
        return (seed / 2147483647 + 1) % 1;
      };
      for (let i = 0; i < n; i++) {
        inst[i * 4 + 0] = (rnd() - 0.5) * cfg.tile;
        inst[i * 4 + 1] = rnd() * Math.PI * 2;
        inst[i * 4 + 2] = (rnd() - 0.5) * cfg.tile;
        inst[i * 4 + 3] = 0.55 + rnd() * 0.9;
        vari[i * 4 + 0] = 0.7 + rnd() * 0.8;
        vari[i * 4 + 1] = rnd();
        vari[i * 4 + 2] = rnd();
        vari[i * 4 + 3] = rnd();
      }
      const g = new THREE.InstancedBufferGeometry();
      g.index = geo.index;
      g.attributes.position = geo.attributes.position;
      g.attributes.uv = geo.attributes.uv;
      g.setAttribute('aInst', new THREE.InstancedBufferAttribute(inst, 4));
      g.setAttribute('aVar', new THREE.InstancedBufferAttribute(vari, 4));
      g.instanceCount = n;
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

      const mat = new THREE.RawShaderMaterial({
        vertexShader: VEG_VERT,
        fragmentShader: VEG_FRAG,
        side: THREE.DoubleSide,
        uniforms: {
          uCamPos: { value: new THREE.Vector3() },
          uHeightMap: { value: terrain.heightTex },
          uDamageMap: { value: terrain.damage.texture },
          uExtent: { value: terrain.extent },
          uTile: { value: cfg.tile },
          uSize: { value: cfg.size },
          uWidth: { value: cfg.width },
          uFar: { value: cfg.far },
          uPatchy: { value: cfg.patchy ?? 0.42 },
          uDetail: { value: 1 },
          uTime: { value: 0 },
          uWindSpeed: { value: 8 },
          uWindDir: { value: 0.6 },
          uGust: { value: this.look.gust },
          uTorPos: { value: new THREE.Vector3() },
          uTorRc: { value: 20 }, uTorVmax: { value: 0 }, uTorHeight: { value: 700 }, uTorOn: { value: 0 },
          uColBase: { value: this.look.colBase },
          uColTip: { value: this.look.colTip },
          uColDry: { value: this.look.colDry },
          uDry: { value: this.look.dry },
          uSunDir: L.uSunDir, uSunColor: L.uSunColor, uAmbient: L.uAmbient,
          uSunIntensity: L.uSunIntensity, uFlash: L.uFlash,
          uFogColor: L.uFogColor, uFogDensity: L.uFogDensity,
          uFogHeightFalloff: L.uFogHeightFalloff, uFogSunAmount: L.uFogSunAmount,
        },
      });
      const mesh = new THREE.Mesh(g, mat);
      mesh.frustumCulled = false;
      mesh.name = 'grass-' + cfg.tile;
      this.meshes.push({ mesh, mat, cfg, baseCount: n });
      this.group.add(mesh);
    }
  }

  update(dt, camera, tornado) {
    const dens = P.get('q_density');
    for (const m of this.meshes) {
      const u = m.mat.uniforms;
      u.uCamPos.value.copy(camera.position);
      u.uTime.value += dt;
      u.uWindSpeed.value = P.get('w_windSpeed');
      u.uWindDir.value = P.get('w_windDir') * Math.PI / 180;
      if (tornado) {
        u.uTorPos.value.copy(tornado.position);
        u.uTorRc.value = tornado.rc;
        u.uTorVmax.value = tornado.vmax;
        u.uTorHeight.value = tornado.height;
        u.uTorOn.value = tornado.strength > 0.02 ? 1 : 0;
      }
      /* 密度参数直接改实例数（省 GPU） */
      m.mesh.geometry.instanceCount = Math.max(8, Math.round(m.baseCount * Math.min(dens, 1.6)));
    }
  }

  dispose() {
    for (const m of this.meshes) { m.mesh.geometry.dispose(); m.mat.dispose(); }
  }
}
