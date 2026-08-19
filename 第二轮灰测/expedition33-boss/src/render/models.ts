/**
 * models.ts —— 程序化 3D 模型与场景（《光与影：33号远征队》风格 Boss 战原型）
 *
 * 约定：
 *  - 全部几何体现场生成，纹理由 ./textures 的 canvas 工厂产出；无外部资源、无网络请求、无 GLTF。
 *  - 所有模型朝向 +Z（"面朝观众/敌方"方向），调用方可自行旋转 group。
 *  - update(t, dt)：t = 累计秒，dt = 帧间隔秒；模块内部绝不使用 setTimeout / setInterval / rAF。
 *  - dispose()：集中释放 geometry / material / texture，避免热重启泄漏。
 *  - 动画为"骨架式"：嵌套 Object3D 关节 + 关键帧姿态插值（rest 姿态 + 偏移量叠加）。
 */

import * as THREE from 'three';
import {
  createBoneFlowerTexture,
  createClothTexture,
  createCrackGlowTexture,
  createCrackedGroundTexture,
  createFeatherTexture,
  createFleckTexture,
  createGroundRoughnessTexture,
  createInkAlphaTexture,
  createMaskTexture,
  createMetalTexture,
  createPaintShardTexture,
  createRadialGlowTexture,
  createRingTexture,
  createStreakTexture,
} from './textures';

/* ================================================================== *
 * 1. 通用工具
 * ================================================================== */

const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;
/** 平滑步（关键帧之间的缓入缓出） */
const smooth = (k: number): number => {
  const x = clamp(k, 0, 1);
  return x * x * (3 - 2 * x);
};
/** 指数趋近（帧率无关的阻尼插值） */
const approach = (cur: number, target: number, rate: number, dt: number): number =>
  cur + (target - cur) * (1 - Math.exp(-rate * dt));

/** 确定性随机（与 textures 同算法，避免布局每次不同） */
function rngFrom(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 资源池：所有 geometry/material/texture 登记在册，dispose 时一次性释放 */
class Pool {
  private geos = new Set<THREE.BufferGeometry>();
  private mats = new Set<THREE.Material>();
  private texs = new Set<THREE.Texture>();

  geo<T extends THREE.BufferGeometry>(g: T): T {
    this.geos.add(g);
    return g;
  }
  mat<T extends THREE.Material>(m: T): T {
    this.mats.add(m);
    return m;
  }
  tex<T extends THREE.Texture | null>(t: T): T {
    if (t) this.texs.add(t);
    return t;
  }
  /** 真正释放：几何 / 材质 / 纹理全部 dispose 并清表 */
  dispose(): void {
    this.geos.forEach((g) => g.dispose());
    this.mats.forEach((m) => m.dispose());
    this.texs.forEach((t) => t.dispose());
    this.geos.clear();
    this.mats.clear();
    this.texs.clear();
  }
}

/** 从场景图上摘掉并清空所有子节点（配合 Pool.dispose） */
function detachAll(root: THREE.Object3D): void {
  root.traverse((o) => {
    o.userData = {};
  });
  while (root.children.length) root.remove(root.children[0]);
  if (root.parent) root.parent.remove(root);
}

/* ------------------------------------------------------------------ *
 * 1.1 溶解 + 闪白：注入到 MeshStandardMaterial
 * ------------------------------------------------------------------ */

/** 溶解/闪白共享 uniform（一个模型共用一组，改一次全身生效） */
export interface DissolveUniforms {
  uDissolve: THREE.IUniform<number>;
  uFlash: THREE.IUniform<number>;
  uFlashColor: THREE.IUniform<THREE.Color>;
  uEdgeColor: THREE.IUniform<THREE.Color>;
  uTime: THREE.IUniform<number>;
}

function makeDissolveUniforms(edge: number, flash = 0xfff2dc): DissolveUniforms {
  return {
    uDissolve: { value: 0 },
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color(flash) },
    uEdgeColor: { value: new THREE.Color(edge) },
    uTime: { value: 0 },
  };
}

// 3D 值噪声（溶解阈值场）—— 以数组拼接书写，避免模板字符串转义问题
const NOISE_GLSL = [
  'float dsHash(vec3 p){',
  '  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));',
  '  p *= 17.0;',
  '  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));',
  '}',
  'float dsNoise(vec3 p){',
  '  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);',
  '  return mix(mix(mix(dsHash(i), dsHash(i + vec3(1,0,0)), f.x),',
  '                 mix(dsHash(i + vec3(0,1,0)), dsHash(i + vec3(1,1,0)), f.x), f.y),',
  '             mix(mix(dsHash(i + vec3(0,0,1)), dsHash(i + vec3(1,0,1)), f.x),',
  '                 mix(dsHash(i + vec3(0,1,1)), dsHash(i + vec3(1,1,1)), f.x), f.y), f.z);',
  '}',
].join('\n');

/**
 * 给标准材质注入"溶解边缘 + 局部闪白"：
 *  - uDissolve 提高 → 噪声低于阈值的像素被 discard（由下往上/由边缘向内瓦解）
 *  - 阈值附近一圈加 uEdgeColor 自发光 → 溶解裂口的灼烧边
 *  - uFlash → 漫反射拉向白 + 自发光叠加，做受击闪白
 */
function applyDissolve(mat: THREE.MeshStandardMaterial, u: DissolveUniforms, verticalBias = 1): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uDissolve = u.uDissolve;
    shader.uniforms.uFlash = u.uFlash;
    shader.uniforms.uFlashColor = u.uFlashColor;
    shader.uniforms.uEdgeColor = u.uEdgeColor;
    shader.uniforms.uTime = u.uTime;
    shader.uniforms.uVBias = { value: verticalBias };

    shader.vertexShader =
      'varying vec3 vDsPos;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n  vDsPos = position;',
      );

    shader.fragmentShader =
      'varying vec3 vDsPos;\n' +
      'uniform float uDissolve;\nuniform float uFlash;\nuniform vec3 uFlashColor;\n' +
      'uniform vec3 uEdgeColor;\nuniform float uTime;\nuniform float uVBias;\n' +
      NOISE_GLSL +
      '\n' +
      shader.fragmentShader
        .replace(
          '#include <clipping_planes_fragment>',
          [
            '#include <clipping_planes_fragment>',
            '  float dsField = dsNoise(vDsPos * 5.5 + vec3(0.0, uTime * 0.15, 0.0)) * 0.72',
            '               + dsNoise(vDsPos * 17.0) * 0.28;',
            '  dsField = clamp(dsField * 0.82 + (0.5 - vDsPos.y * 0.16 * uVBias) * 0.3, 0.0, 1.0);',
            '  float dsCut = uDissolve * 1.12;',
            '  if (dsField < dsCut - 0.015) discard;',
            '  float dsEdge = 1.0 - smoothstep(dsCut, dsCut + 0.14, dsField);',
          ].join('\n'),
        )
        .replace(
          '#include <color_fragment>',
          '#include <color_fragment>\n  diffuseColor.rgb = mix(diffuseColor.rgb, uFlashColor, clamp(uFlash, 0.0, 1.0) * 0.72);',
        )
        .replace(
          '#include <emissivemap_fragment>',
          [
            '#include <emissivemap_fragment>',
            '  totalEmissiveRadiance += uEdgeColor * dsEdge * step(0.001, uDissolve) * 3.4;',
            '  totalEmissiveRadiance += uFlashColor * clamp(uFlash, 0.0, 1.0) * 1.6;',
          ].join('\n'),
        );
  };
  mat.needsUpdate = true;
}

/* ------------------------------------------------------------------ *
 * 1.2 加法混合发光材质（剑光 / 裂缝反光 / 冲击环）
 * ------------------------------------------------------------------ */

export interface GlowHandle {
  mat: THREE.ShaderMaterial;
  uColor: THREE.IUniform<THREE.Color>;
  uPulse: THREE.IUniform<number>;
  uOpacity: THREE.IUniform<number>;
}

/**
 * 细长发光片/环用材质：加法混合 + 脉冲 uniform。
 * 有贴图时按贴图 r 通道取形状；无贴图时用 uv 生成"中间亮两侧收"的刃形。
 */
function makeGlow(pool: Pool, color: number, map: THREE.Texture | null, opacity = 1): GlowHandle {
  const uColor: THREE.IUniform<THREE.Color> = { value: new THREE.Color(color) };
  const uPulse: THREE.IUniform<number> = { value: 0.5 };
  const uOpacity: THREE.IUniform<number> = { value: opacity };
  const uniforms: Record<string, THREE.IUniform> = { uColor, uPulse, uOpacity };
  if (map) uniforms.uMap = { value: map };

  const frag = [
    'uniform vec3 uColor;',
    'uniform float uPulse;',
    'uniform float uOpacity;',
    map ? 'uniform sampler2D uMap;' : '',
    'varying vec2 vUv;',
    'void main(){',
    map
      ? '  float shape = texture2D(uMap, vUv).r;'
      : '  float shape = pow(max(0.0, 1.0 - abs(vUv.x - 0.5) * 2.0), 2.0) * sin(clamp(vUv.y, 0.0, 1.0) * 3.14159);',
    '  float p = clamp(uPulse, 0.0, 3.0);',
    '  vec3 c = uColor * (0.55 + p * 1.25);',
    '  float a = shape * uOpacity * (0.45 + 0.55 * p);',
    '  if (a < 0.004) discard;',
    '  gl_FragColor = vec4(c, a);',
    '}',
  ]
    .filter((s) => s.length > 0)
    .join('\n');

  const mat = pool.mat(
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: [
        'varying vec2 vUv;',
        'void main(){',
        '  vUv = uv;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}',
      ].join('\n'),
      fragmentShader: frag,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
  return { mat, uColor, uPulse, uOpacity };
}

/* ------------------------------------------------------------------ *
 * 1.3 菲涅尔轮廓光材质（角色姿态轮廓光 / Boss 气场）
 * ------------------------------------------------------------------ */

export interface RimHandle {
  mat: THREE.ShaderMaterial;
  uColor: THREE.IUniform<THREE.Color>;
  uIntensity: THREE.IUniform<number>;
  uPower: THREE.IUniform<number>;
}

function makeRim(pool: Pool, color: number, intensity = 0, power = 2.6): RimHandle {
  const uColor: THREE.IUniform<THREE.Color> = { value: new THREE.Color(color) };
  const uIntensity: THREE.IUniform<number> = { value: intensity };
  const uPower: THREE.IUniform<number> = { value: power };
  const mat = pool.mat(
    new THREE.ShaderMaterial({
      uniforms: { uColor, uIntensity, uPower },
      vertexShader: [
        'varying vec3 vN;',
        'varying vec3 vV;',
        'void main(){',
        '  vN = normalize(normalMatrix * normal);',
        '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
        '  vV = normalize(-mv.xyz);',
        '  gl_Position = projectionMatrix * mv;',
        '}',
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor;',
        'uniform float uIntensity;',
        'uniform float uPower;',
        'varying vec3 vN;',
        'varying vec3 vV;',
        'void main(){',
        '  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPower);',
        '  float a = f * uIntensity;',
        '  if (a < 0.004) discard;',
        '  gl_FragColor = vec4(uColor * (0.6 + uIntensity), a);',
        '}',
      ].join('\n'),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  return { mat, uColor, uIntensity, uPower };
}

/* ------------------------------------------------------------------ *
 * 1.4 骨架关节工具
 * ------------------------------------------------------------------ */

interface Rig {
  joints: Record<string, THREE.Object3D>;
  /** 关节静止姿态（rest）：位置 + 欧拉角 */
  rest: Record<string, { p: [number, number, number]; r: [number, number, number] }>;
  add(name: string, parent: THREE.Object3D, p: [number, number, number], r?: [number, number, number]): THREE.Object3D;
  /** 复位到 rest（每帧动画开始时调用，随后叠加 idle / clip 偏移） */
  reset(): void;
}

function makeRig(): Rig {
  const joints: Record<string, THREE.Object3D> = {};
  const rest: Record<string, { p: [number, number, number]; r: [number, number, number] }> = {};
  return {
    joints,
    rest,
    add(name, parent, p, r = [0, 0, 0]) {
      const o = new THREE.Object3D();
      o.name = name;
      o.position.set(p[0], p[1], p[2]);
      o.rotation.set(r[0], r[1], r[2]);
      parent.add(o);
      joints[name] = o;
      rest[name] = { p: [p[0], p[1], p[2]], r: [r[0], r[1], r[2]] };
      return o;
    },
    reset() {
      for (const k in joints) {
        const j = joints[k];
        const b = rest[k];
        j.position.set(b.p[0], b.p[1], b.p[2]);
        j.rotation.set(b.r[0], b.r[1], b.r[2]);
      }
    },
  };
}

/** 关键帧：rot/pos 都是相对 rest 的偏移量（未列出的关节偏移为 0） */
interface Key {
  t: number;
  rot?: Record<string, [number, number, number]>;
  pos?: Record<string, [number, number, number]>;
}
interface Clip {
  keys: Key[];
  /** 这些关节不受权重包络影响（例如整圈旋转，末态与 rest 同余） */
  full?: string[];
}

/** 采样片段：把插值后的偏移量按权重叠加到 rig 上 */
function applyClip(rig: Rig, clip: Clip, t: number, weight: number): void {
  const keys = clip.keys;
  let i = 0;
  while (i < keys.length - 2 && keys[i + 1].t < t) i++;
  const a = keys[i];
  const b = keys[Math.min(i + 1, keys.length - 1)];
  const span = Math.max(1e-4, b.t - a.t);
  const k = smooth((t - a.t) / span);

  const bump = (
    joint: THREE.Object3D,
    name: string,
    mapA: Record<string, [number, number, number]> | undefined,
    mapB: Record<string, [number, number, number]> | undefined,
    isPos: boolean,
    w: number,
  ): void => {
    const va = mapA && mapA[name];
    const vb = mapB && mapB[name];
    const x = lerp(va ? va[0] : 0, vb ? vb[0] : 0, k) * w;
    const y = lerp(va ? va[1] : 0, vb ? vb[1] : 0, k) * w;
    const z = lerp(va ? va[2] : 0, vb ? vb[2] : 0, k) * w;
    if (isPos) {
      joint.position.x += x;
      joint.position.y += y;
      joint.position.z += z;
    } else {
      joint.rotation.x += x;
      joint.rotation.y += y;
      joint.rotation.z += z;
    }
  };

  const names = new Set<string>();
  for (const key of keys) {
    if (key.rot) for (const n in key.rot) names.add(n);
  }
  names.forEach((n) => {
    const j = rig.joints[n];
    if (!j) return;
    const w = clip.full && clip.full.indexOf(n) >= 0 ? 1 : weight;
    bump(j, n, a.rot, b.rot, false, w);
  });

  const pnames = new Set<string>();
  for (const key of keys) {
    if (key.pos) for (const n in key.pos) pnames.add(n);
  }
  pnames.forEach((n) => {
    const j = rig.joints[n];
    if (!j) return;
    const w = clip.full && clip.full.indexOf(n) >= 0 ? 1 : weight;
    bump(j, n, a.pos, b.pos, true, w);
  });
}

/** 动作权重包络：起手 8% 淡入，收尾 14% 淡出 */
function envelope(t: number): number {
  if (t <= 0 || t >= 1) return 0;
  if (t < 0.08) return smooth(t / 0.08);
  if (t > 0.86) return smooth((1 - t) / 0.14);
  return 1;
}

/* ================================================================== *
 * 2. 竞技场
 * ================================================================== */

export function createArena(): {
  group: THREE.Group;
  update(t: number, dt: number): void;
  setPhase(phase: number): void;
  dispose(): void;
} {
  const pool = new Pool();
  const group = new THREE.Group();
  group.name = 'arena';
  const rng = rngFrom(9931);

  // ---- 主地面：圆形开裂黑岩 / 干涸颜料，半径 10m ----
  const groundTex = pool.tex(createCrackedGroundTexture(1024));
  const roughTex = pool.tex(createGroundRoughnessTexture(512));
  const glowTex = pool.tex(createCrackGlowTexture(512));

  const groundMat = pool.mat(
    new THREE.MeshStandardMaterial({ color: groundTex ? 0xffffff : 0x2a2019, roughness: 0.94, metalness: 0.06 }),
  );
  if (groundTex) groundMat.map = groundTex;
  if (roughTex) groundMat.roughnessMap = roughTex;
  if (glowTex) {
    groundMat.emissiveMap = glowTex;
    groundMat.emissive = new THREE.Color(0x8e2412);
    groundMat.emissiveIntensity = 0.55;
  } else {
    groundMat.emissive = new THREE.Color(0x2a0b06);
    groundMat.emissiveIntensity = 0.35;
  }
  const ground = new THREE.Mesh(pool.geo(new THREE.CircleGeometry(10, 72)), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // ---- 裂缝加法反光层：暗红呼吸，阶段越高越亮 ----
  const crackGlow = makeGlow(pool, 0xd63a2a, glowTex, 0.5);
  const crackMesh = new THREE.Mesh(pool.geo(new THREE.CircleGeometry(9.98, 72)), crackGlow.mat);
  crackMesh.rotation.x = -Math.PI / 2;
  crackMesh.position.y = 0.012;
  group.add(crackMesh);

  // ---- 外圈：更暗的干土延伸 + 场地边缘石环 ----
  const outerMat = pool.mat(new THREE.MeshStandardMaterial({ color: 0x1b1410, roughness: 1, metalness: 0 }));
  const outer = new THREE.Mesh(pool.geo(new THREE.RingGeometry(9.9, 34, 56, 1)), outerMat);
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.02;
  group.add(outer);

  const rimMat = pool.mat(new THREE.MeshStandardMaterial({ color: 0x0d0b09, roughness: 0.85, metalness: 0.1 }));
  const rim = new THREE.Mesh(pool.geo(new THREE.TorusGeometry(10.05, 0.16, 6, 64)), rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.02;
  group.add(rim);

  // ---- 远景：倾斜巨石 / 独石柱 ----
  const rockTex = pool.tex(createMetalTexture(256, 4141, '#3a2f26'));
  const rockMat = pool.mat(new THREE.MeshStandardMaterial({ color: 0x2c231c, roughness: 0.95, metalness: 0.05, flatShading: true }));
  if (rockTex) rockMat.map = rockTex;
  const rockGeoA = pool.geo(new THREE.IcosahedronGeometry(1, 0));
  const rockGeoB = pool.geo(new THREE.DodecahedronGeometry(1, 0));
  const monoGeo = pool.geo(new THREE.BoxGeometry(1, 1, 1));
  const rocks: THREE.Mesh[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rng() * 0.3;
    const r = 12 + rng() * 14;
    const kind = rng();
    const m = new THREE.Mesh(kind < 0.4 ? rockGeoA : kind < 0.75 ? rockGeoB : monoGeo, rockMat);
    const s = 0.9 + rng() * 2.6;
    m.scale.set(s * (0.7 + rng() * 0.8), s * (kind > 0.75 ? 2.6 + rng() * 3.4 : 1 + rng()), s * (0.7 + rng() * 0.8));
    m.position.set(Math.cos(a) * r, m.scale.y * 0.28 - 0.1, Math.sin(a) * r);
    m.rotation.set((rng() - 0.5) * 0.55, rng() * Math.PI, (rng() - 0.5) * 0.5);
    rocks.push(m);
    group.add(m);
  }

  // ---- 远景：骨白花簇（面片，双面 + alphaTest） ----
  const flowerTex = pool.tex(createBoneFlowerTexture(128));
  const flowerMat = pool.mat(
    new THREE.MeshStandardMaterial({
      color: flowerTex ? 0xffffff : 0xd8ccb0,
      roughness: 0.8,
      transparent: true,
      alphaTest: 0.35,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(0x4a4335),
      emissiveIntensity: 0.5,
    }),
  );
  if (flowerTex) {
    flowerMat.map = flowerTex;
    flowerMat.alphaMap = flowerTex;
  }
  const flowerGeo = pool.geo(new THREE.PlaneGeometry(1, 1));
  const flowers: THREE.Mesh[] = [];
  for (let i = 0; i < 26; i++) {
    const a = rng() * Math.PI * 2;
    const r = 10.6 + rng() * 12;
    const m = new THREE.Mesh(flowerGeo, flowerMat);
    const s = 0.5 + rng() * 0.85;
    m.scale.set(s, s, s);
    m.position.set(Math.cos(a) * r, s * 0.5 - 0.05, Math.sin(a) * r);
    m.rotation.y = rng() * Math.PI;
    flowers.push(m);
    group.add(m);
  }

  // ---- 颜料残片：地面散落 + 低空缓慢漂浮 ----
  const shardTex = pool.tex(createPaintShardTexture(128));
  const shardMat = pool.mat(
    new THREE.MeshStandardMaterial({
      color: shardTex ? 0xffffff : 0x9a5a3a,
      roughness: 0.6,
      transparent: true,
      alphaTest: 0.2,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(0x3a2412),
      emissiveIntensity: 0.6,
    }),
  );
  if (shardTex) {
    shardMat.map = shardTex;
    shardMat.alphaMap = shardTex;
  }
  const shardGeo = pool.geo(new THREE.PlaneGeometry(1, 1));
  interface Floater {
    mesh: THREE.Mesh;
    baseY: number;
    spin: number;
    phase: number;
  }
  const floaters: Floater[] = [];
  for (let i = 0; i < 30; i++) {
    const a = rng() * Math.PI * 2;
    const r = 3 + rng() * 16;
    const m = new THREE.Mesh(shardGeo, shardMat);
    const s = 0.12 + rng() * 0.42;
    m.scale.set(s, s, s);
    const floating = rng() < 0.45;
    const y = floating ? 0.5 + rng() * 3.4 : 0.02;
    m.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    m.rotation.set(floating ? rng() * Math.PI : -Math.PI / 2, rng() * Math.PI, rng() * Math.PI);
    group.add(m);
    if (floating) floaters.push({ mesh: m, baseY: y, spin: (rng() - 0.5) * 0.5, phase: rng() * 6.283 });
  }

  let phase = 1;
  let pulseBoost = 0;

  return {
    group,
    update(t: number, dt: number): void {
      // 裂缝呼吸：基础脉冲 + 阶段加成
      pulseBoost = approach(pulseBoost, phase === 3 ? 1 : phase === 2 ? 0.55 : 0.25, 2.5, dt);
      const pulse = 0.35 + 0.25 * Math.sin(t * 1.35) + 0.14 * Math.sin(t * 4.1 + 1.7) + pulseBoost * 0.7;
      crackGlow.uPulse.value = pulse;
      groundMat.emissiveIntensity = 0.32 + pulse * 0.55;
      // 漂浮颜料残片：缓慢升沉 + 自转
      for (let i = 0; i < floaters.length; i++) {
        const f = floaters[i];
        f.mesh.position.y = f.baseY + Math.sin(t * 0.45 + f.phase) * 0.22;
        f.mesh.rotation.y += f.spin * dt;
        f.mesh.rotation.z += f.spin * 0.4 * dt;
      }
    },
    setPhase(p: number): void {
      phase = clamp(Math.round(p), 1, 3);
      // 阶段推进：裂缝由暗红 → 橙金 → 紫红，石头略微反光更强
      const col = phase === 1 ? 0xb02a18 : phase === 2 ? 0xe07a22 : 0xc0308a;
      crackGlow.uColor.value.setHex(col);
      groundMat.emissive.setHex(phase === 3 ? 0xa01840 : phase === 2 ? 0xa64a12 : 0x8e2412);
      rockMat.emissive = new THREE.Color(phase === 3 ? 0x2a1030 : 0x120c08);
      rockMat.emissiveIntensity = phase === 3 ? 0.5 : 0.2;
      flowerMat.emissiveIntensity = phase === 3 ? 0.9 : 0.5;
    },
    dispose(): void {
      detachAll(group);
      pool.dispose();
      rocks.length = 0;
      flowers.length = 0;
      floaters.length = 0;
    },
  };
}

/* ================================================================== *
 * 3. 环境粒子（黑色碎屑 / 画笔微粒）
 * ================================================================== */

/** 落屑 Points 材质：位置在 vertex shader 内按 uTime 循环下落，CPU 每帧只更新 uniform */
function makeFallMaterial(
  pool: Pool,
  map: THREE.Texture | null,
  colorA: number,
  colorB: number,
  additive: boolean,
  size: number,
  height: number,
): { mat: THREE.ShaderMaterial; uTime: THREE.IUniform<number>; uOpacity: THREE.IUniform<number>; uSize: THREE.IUniform<number> } {
  const uTime: THREE.IUniform<number> = { value: 0 };
  const uOpacity: THREE.IUniform<number> = { value: 1 };
  const uSize: THREE.IUniform<number> = { value: size };
  const uniforms: Record<string, THREE.IUniform> = {
    uTime,
    uOpacity,
    uSize,
    uColorA: { value: new THREE.Color(colorA) },
    uColorB: { value: new THREE.Color(colorB) },
    uHeight: { value: height },
  };
  if (map) uniforms.uMap = { value: map };

  const mat = pool.mat(
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: [
        'attribute float aSeed;',
        'attribute float aSpeed;',
        'attribute float aScale;',
        'uniform float uTime;',
        'uniform float uSize;',
        'uniform float uHeight;',
        'varying float vSeed;',
        'void main(){',
        '  vSeed = aSeed;',
        '  float ph = aSeed * 6.28318;',
        // 垂直循环下落 + 水平飘摆（画笔微粒的漂浮感）
        '  float y = mod(position.y - uTime * aSpeed, uHeight);',
        '  vec3 p = vec3(',
        '    position.x + sin(uTime * 0.5 + ph) * 0.5 + sin(uTime * 1.7 + ph * 2.1) * 0.12,',
        '    y,',
        '    position.z + cos(uTime * 0.43 + ph) * 0.5 + cos(uTime * 1.9 + ph * 1.7) * 0.12);',
        '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
        // 透视缩放：uSize 为"参考距离处的像素直径系数"，实测 2.4 使碎屑在 5~10m 处约 2~6px
        '  gl_PointSize = clamp(uSize * aScale * (2.4 / max(0.6, -mv.z)), 1.0, 14.0);',
        '  gl_Position = projectionMatrix * mv;',
        '}',
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColorA;',
        'uniform vec3 uColorB;',
        'uniform float uOpacity;',
        map ? 'uniform sampler2D uMap;' : '',
        'varying float vSeed;',
        'void main(){',
        map
          ? '  float a = texture2D(uMap, gl_PointCoord).r;'
          : '  float a = max(0.0, 1.0 - length(gl_PointCoord - vec2(0.5)) * 2.0);',
        '  if (a < 0.05) discard;',
        '  vec3 c = mix(uColorA, uColorB, fract(vSeed * 7.13));',
        '  gl_FragColor = vec4(c, a * uOpacity);',
        '}',
      ]
        .filter((s) => s.length > 0)
        .join('\n'),
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      toneMapped: false,
    }),
  );
  return { mat, uTime, uOpacity, uSize };
}

function makeFallGeometry(pool: Pool, count: number, radius: number, height: number, seed: number): THREE.BufferGeometry {
  const rng = rngFrom(seed);
  const pos = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const speeds = new Float32Array(count);
  const scales = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * radius;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = rng() * height;
    pos[i * 3 + 2] = Math.sin(a) * r;
    seeds[i] = rng();
    speeds[i] = 0.35 + rng() * 1.15;
    scales[i] = 0.45 + rng() * 1.2;
  }
  const geo = pool.geo(new THREE.BufferGeometry());
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
  geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, height * 0.5, 0), radius * 1.8);
  return geo;
}

export function createAmbientParticles(): {
  group: THREE.Group;
  update(t: number, dt: number): void;
  setIntensity(v: number): void;
  dispose(): void;
} {
  const pool = new Pool();
  const group = new THREE.Group();
  group.name = 'ambient-particles';

  const fleck = pool.tex(createFleckTexture(64));
  const glow = pool.tex(createRadialGlowTexture(64, 2.4));

  // 黑色碎屑（普通混合，压暗背景）
  const debris = makeFallMaterial(pool, fleck, 0x0b0908, 0x241c15, false, 9, 13);
  const debrisPts = new THREE.Points(makeFallGeometry(pool, 900, 15, 13, 3313), debris.mat);
  debrisPts.frustumCulled = false;
  group.add(debrisPts);

  // 画笔微粒（加法混合，金/紫/骨白闪点）
  const motes = makeFallMaterial(pool, glow, 0xe8a828, 0x9a6cff, true, 7, 13);
  const motePts = new THREE.Points(makeFallGeometry(pool, 420, 13, 13, 7717), motes.mat);
  motePts.frustumCulled = false;
  group.add(motePts);

  let intensity = 1;
  let shown = 1;

  return {
    group,
    update(t: number, dt: number): void {
      shown = approach(shown, intensity, 3, dt);
      debris.uTime.value = t;
      motes.uTime.value = t;
      debris.uOpacity.value = 0.55 * shown;
      motes.uOpacity.value = 0.75 * shown * (0.8 + 0.2 * Math.sin(t * 2.3));
      debris.uSize.value = 9 * (0.75 + 0.35 * shown);
      motes.uSize.value = 7 * (0.7 + 0.5 * shown);
    },
    setIntensity(v: number): void {
      intensity = clamp(v, 0, 3);
    },
    dispose(): void {
      detachAll(group);
      pool.dispose();
    },
  };
}

/* ================================================================== *
 * 4. Boss —— 四手剑客（约 3.2m，普通角色 1.8m 的 1.8 倍）
 * ================================================================== */

export interface BossModel {
  group: THREE.Group;
  /** 每帧调用：呼吸、布料摆动、剑光脉冲 */
  update(t: number, dt: number): void;
  setPhase(phase: number): void;
  /** 受击：局部闪白 + 材质溶解边缘，intensity 0..1 */
  hitFlash(intensity: number): void;
  /** 播放攻击动作：kind 见下，durationMs 为整套动作时长 */
  playAttack(kind: 'combo' | 'sweep' | 'thrust' | 'array' | 'charge' | 'execution' | 'storm', durationMs: number): void;
  /** 某一段命中的瞬间（用于挥剑到位） */
  strike(index: number): void;
  /** 弱点被破坏后外观必须改变（核心变暗、碎裂） */
  breakWeakPoint(id: 'gold_core' | 'violet_core'): void;
  /** 世界坐标锚点，供 UI 投影与镜头对准 */
  anchors: {
    head: THREE.Object3D;
    chest: THREE.Object3D;
    goldTip: THREE.Object3D;
    violetTip: THREE.Object3D;
    gold_core: THREE.Object3D;
    violet_core: THREE.Object3D;
  };
  /** 死亡解体演出，progress 0..1 */
  dissolve(progress: number): void;
  dispose(): void;
}

/** Boss 攻击动作库：关键帧全部是"相对 rest 的偏移量（弧度 / 米）" */
const BOSS_CLIPS: Record<string, Clip> = {
  // 三段连斩：右（金）→ 左（紫）→ 双剑交叉下劈
  combo: {
    keys: [
      { t: 0 },
      { t: 0.1, rot: { aUpR: [-1.5, 0.1, -0.35], aLoR: [-0.85, 0, 0], chest: [-0.05, 0.34, 0], spine: [0, 0.16, 0], head: [0, 0.2, 0] } },
      { t: 0.24, rot: { aUpR: [0.72, -0.1, 0.5], aLoR: [-0.14, 0, 0], chest: [0.16, -0.38, 0], spine: [0.06, -0.16, 0], head: [0.1, -0.16, 0] } },
      { t: 0.38, rot: { aUpL: [-1.45, -0.1, 0.35], aLoL: [-0.9, 0, 0], chest: [-0.05, -0.34, 0], spine: [0, -0.16, 0], head: [0, -0.2, 0] } },
      { t: 0.54, rot: { aUpL: [0.68, 0.1, -0.5], aLoL: [-0.12, 0, 0], chest: [0.14, 0.36, 0], spine: [0.05, 0.16, 0], head: [0.1, 0.16, 0] } },
      { t: 0.7, rot: { aUpR: [-1.85, 0, -0.5], aUpL: [-1.85, 0, 0.5], aLoR: [-0.5, 0, 0], aLoL: [-0.5, 0, 0], chest: [-0.2, 0, 0], spine: [-0.12, 0, 0], head: [-0.24, 0, 0] }, pos: { root: [0, 0.12, 0] } },
      { t: 0.85, rot: { aUpR: [1.0, 0, 0.62], aUpL: [1.0, 0, -0.62], aLoR: [-0.1, 0, 0], aLoL: [-0.1, 0, 0], chest: [0.3, 0, 0], spine: [0.16, 0, 0], pelvis: [0.12, 0, 0], head: [0.28, 0, 0] }, pos: { root: [0, -0.1, 0.14] } },
      { t: 1 },
    ],
  },
  // 横扫：躯干大幅扭转，双主剑贴地平扫
  sweep: {
    keys: [
      { t: 0 },
      { t: 0.16, rot: { chest: [0, 1.15, 0], spine: [0, 0.5, 0], aUpR: [-0.6, 0.2, -1.15], aLoR: [-0.45, 0, 0], aUpL: [0.3, 0, 0.5], head: [0, 0.5, 0] }, pos: { root: [0.12, -0.06, -0.1] } },
      { t: 0.46, rot: { chest: [0, -1.2, 0], spine: [0, -0.55, 0], aUpR: [-0.25, -0.3, -1.5], aLoR: [-0.1, 0, 0], aUpL: [-0.2, 0, 0.9], head: [0, -0.5, 0] }, pos: { root: [-0.12, -0.02, 0.12] } },
      { t: 0.72, rot: { chest: [0, 0.9, 0], spine: [0, 0.4, 0], aUpL: [-0.3, 0.3, 1.45], aLoL: [-0.15, 0, 0], aUpR: [-0.2, 0, -0.7], head: [0, 0.4, 0] }, pos: { root: [0.1, -0.02, 0.06] } },
      { t: 1 },
    ],
  },
  // 突刺：先收臂蓄力，再整体前冲、右臂完全伸直
  thrust: {
    keys: [
      { t: 0 },
      { t: 0.22, rot: { aUpR: [-0.55, 0.35, -0.25], aLoR: [-1.75, 0, 0], chest: [0, 0.45, 0], spine: [0.08, 0.2, 0], thighR: [0.25, 0, 0], thighL: [-0.15, 0, 0], head: [0.05, 0.28, 0] }, pos: { root: [0, -0.14, -0.22] } },
      { t: 0.4, rot: { aUpR: [-1.35, 0.05, -0.1], aLoR: [-0.05, 0, 0], chest: [0.04, -0.12, 0], spine: [-0.06, -0.06, 0], thighR: [-0.1, 0, 0], head: [-0.05, -0.06, 0] }, pos: { root: [0, 0.04, 0.82] } },
      { t: 0.58, rot: { aUpR: [-1.3, 0.05, -0.1], aLoR: [-0.08, 0, 0], chest: [0.06, -0.1, 0] }, pos: { root: [0, 0.02, 0.74] } },
      { t: 0.8, rot: { aUpR: [-0.4, 0, -0.1], aLoR: [-0.6, 0, 0], chest: [0.1, 0.1, 0] }, pos: { root: [0, -0.05, 0.2] } },
      { t: 1 },
    ],
  },
  // 剑阵：四臂张开、短刃抽出、身体上浮
  array: {
    keys: [
      { t: 0 },
      { t: 0.26, rot: { aUpR: [-2.0, 0, -0.95], aUpL: [-2.0, 0, 0.95], aLoR: [-0.35, 0, 0], aLoL: [-0.35, 0, 0], bUpR: [-0.9, 0, -1.5], bUpL: [-0.9, 0, 1.5], bLoR: [-0.7, 0, 0], bLoL: [-0.7, 0, 0], head: [-0.32, 0, 0], chest: [-0.14, 0, 0], wingL: [0, 0.5, -0.5], wingR: [0, -0.5, 0.5] }, pos: { root: [0, 0.3, 0] } },
      { t: 0.62, rot: { aUpR: [-2.05, 0, -1.05], aUpL: [-2.05, 0, 1.05], bUpR: [-1.0, 0, -1.55], bUpL: [-1.0, 0, 1.55], chest: [-0.14, 0.28, 0], head: [-0.3, 0.2, 0], wingL: [0, 0.6, -0.6], wingR: [0, -0.6, 0.6] }, pos: { root: [0, 0.34, 0] } },
      { t: 0.86, rot: { aUpR: [-0.5, 0, -0.3], aUpL: [-0.5, 0, 0.3], bUpR: [-0.2, 0, -0.4], bUpL: [-0.2, 0, 0.4], chest: [0.16, 0, 0] }, pos: { root: [0, -0.08, 0] } },
      { t: 1 },
    ],
  },
  // 蓄势：深蹲、四臂内收，末段炸开
  charge: {
    keys: [
      { t: 0 },
      { t: 0.3, rot: { thighR: [0.55, 0, 0.12], thighL: [0.55, 0, -0.12], shinR: [-0.85, 0, 0], shinL: [-0.85, 0, 0], spine: [0.35, 0, 0], chest: [0.28, 0, 0], head: [0.4, 0, 0], aUpR: [-0.9, 0.6, -0.1], aLoR: [-1.5, 0, 0], aUpL: [-0.9, -0.6, 0.1], aLoL: [-1.5, 0, 0], bUpR: [-0.4, 0.3, -0.2], bUpL: [-0.4, -0.3, 0.2], cloak0: [-0.3, 0, 0] }, pos: { root: [0, -0.42, -0.08] } },
      { t: 0.72, rot: { thighR: [0.6, 0, 0.12], thighL: [0.6, 0, -0.12], shinR: [-0.9, 0, 0], shinL: [-0.9, 0, 0], spine: [0.38, 0, 0], chest: [0.3, 0, 0], head: [0.44, 0, 0], aUpR: [-0.95, 0.65, -0.1], aLoR: [-1.6, 0, 0], aUpL: [-0.95, -0.65, 0.1], aLoL: [-1.6, 0, 0], cloak0: [-0.34, 0, 0] }, pos: { root: [0, -0.46, -0.08] } },
      { t: 0.9, rot: { spine: [-0.3, 0, 0], chest: [-0.25, 0, 0], head: [-0.4, 0, 0], aUpR: [-1.7, 0, -1.2], aUpL: [-1.7, 0, 1.2], bUpR: [-1.2, 0, -1.4], bUpL: [-1.2, 0, 1.4], cloak0: [0.4, 0, 0], wingL: [0, 0.7, -0.7], wingR: [0, -0.7, 0.7] }, pos: { root: [0, 0.18, 0] } },
      { t: 1 },
    ],
  },
  // 处刑：整体后仰举剑过头，然后砸落
  execution: {
    keys: [
      { t: 0 },
      { t: 0.28, rot: { aUpR: [-2.5, 0.15, -0.2], aLoR: [-0.55, 0, 0], spine: [-0.4, 0, 0], chest: [-0.34, 0, 0], head: [-0.45, 0, 0], pelvis: [-0.12, 0, 0], aUpL: [-0.6, 0, 0.7], wingL: [0, 0.55, -0.55], wingR: [0, -0.55, 0.55] }, pos: { root: [0, 0.32, -0.12] } },
      { t: 0.5, rot: { aUpR: [-2.6, 0.1, -0.15], aLoR: [-0.5, 0, 0], spine: [-0.44, 0, 0], chest: [-0.36, 0, 0], head: [-0.5, 0, 0], aUpL: [-0.65, 0, 0.75] }, pos: { root: [0, 0.36, -0.12] } },
      { t: 0.62, rot: { aUpR: [1.15, 0, 0.2], aLoR: [-0.05, 0, 0], spine: [0.46, 0, 0], chest: [0.34, 0, 0], head: [0.5, 0, 0], pelvis: [0.2, 0, 0], thighR: [0.3, 0, 0], thighL: [0.3, 0, 0], shinR: [-0.5, 0, 0], shinL: [-0.5, 0, 0] }, pos: { root: [0, -0.24, 0.3] } },
      { t: 0.82, rot: { aUpR: [0.4, 0, 0.15], aLoR: [-0.4, 0, 0], spine: [0.2, 0, 0], chest: [0.16, 0, 0], head: [0.2, 0, 0] }, pos: { root: [0, -0.12, 0.12] } },
      { t: 1 },
    ],
  },
  // 剑风暴：四臂平举，整体自转两整圈（root 用全权重，末态与 rest 同余 2π）
  storm: {
    full: ['root'],
    keys: [
      { t: 0, rot: { root: [0, 0, 0] } },
      { t: 0.14, rot: { root: [0, 0.6, 0], aUpR: [-0.15, 0, -1.5], aUpL: [-0.15, 0, 1.5], aLoR: [-0.1, 0, 0], aLoL: [-0.1, 0, 0], bUpR: [-0.1, 0, -1.35], bUpL: [-0.1, 0, 1.35], chest: [-0.08, 0, 0] }, pos: { root: [0, 0.12, 0] } },
      { t: 0.86, rot: { root: [0, 11.6, 0], aUpR: [-0.2, 0, -1.58], aUpL: [-0.2, 0, 1.58], aLoR: [-0.05, 0, 0], aLoL: [-0.05, 0, 0], bUpR: [-0.15, 0, -1.4], bUpL: [-0.15, 0, 1.4], chest: [-0.1, 0, 0] }, pos: { root: [0, 0.16, 0] } },
      { t: 1, rot: { root: [0, 12.566, 0] } },
    ],
  },
};

/** 造一把主剑：柄 + 护手 + 刃 + 十字加法混合剑光 + 剑尖锚点 */
function buildSword(
  pool: Pool,
  parent: THREE.Object3D,
  opts: {
    bladeLen: number;
    bladeWidth: number;
    color: number;
    metalMat: THREE.MeshStandardMaterial;
    hiltMat: THREE.MeshStandardMaterial;
    streak: THREE.Texture | null;
    curved: boolean;
  },
): { root: THREE.Object3D; tip: THREE.Object3D; glows: GlowHandle[]; blade: THREE.Mesh } {
  const root = new THREE.Object3D();
  root.name = 'sword';
  parent.add(root);

  // 握柄（在手的下方）
  const grip = new THREE.Mesh(pool.geo(new THREE.CylinderGeometry(0.028, 0.034, 0.3, 6)), opts.hiltMat);
  grip.position.y = -0.1;
  root.add(grip);
  const pommel = new THREE.Mesh(pool.geo(new THREE.IcosahedronGeometry(0.045, 0)), opts.hiltMat);
  pommel.position.y = -0.27;
  root.add(pommel);

  // 护手：细长十字
  const guard = new THREE.Mesh(pool.geo(new THREE.BoxGeometry(0.36, 0.045, 0.1)), opts.metalMat);
  guard.position.y = 0.06;
  root.add(guard);

  // 刃：四棱（顶端收细），curved 时略微弯折成暗影刃
  const bladeGeo = pool.geo(new THREE.CylinderGeometry(opts.bladeWidth * 0.28, opts.bladeWidth, opts.bladeLen, 4, 1));
  const blade = new THREE.Mesh(bladeGeo, opts.metalMat);
  blade.position.y = 0.06 + opts.bladeLen * 0.5;
  blade.rotation.y = Math.PI * 0.25;
  if (opts.curved) blade.rotation.z = 0.06;
  blade.scale.set(1, 1, 0.42);
  root.add(blade);

  // 剑光：两片十字交叉的加法混合发光面片，脉冲由 uPulse 驱动
  const glows: GlowHandle[] = [];
  const glowGeo = pool.geo(new THREE.PlaneGeometry(opts.bladeWidth * 9, opts.bladeLen * 1.16));
  for (let i = 0; i < 2; i++) {
    const g = makeGlow(pool, opts.color, opts.streak, 1);
    const m = new THREE.Mesh(glowGeo, g.mat);
    m.position.y = 0.06 + opts.bladeLen * 0.52;
    m.rotation.y = i === 0 ? 0 : Math.PI / 2;
    if (opts.curved) m.rotation.z = 0.06;
    root.add(m);
    glows.push(g);
  }
  // 刃根一小团核心光
  const coreGlow = makeGlow(pool, opts.color, null, 0.9);
  const coreMesh = new THREE.Mesh(pool.geo(new THREE.PlaneGeometry(0.3, 0.3)), coreGlow.mat);
  coreMesh.position.y = 0.08;
  root.add(coreMesh);
  glows.push(coreGlow);

  const tip = new THREE.Object3D();
  tip.name = 'tip';
  tip.position.y = 0.06 + opts.bladeLen * 1.02;
  root.add(tip);

  return { root, tip, glows, blade };
}

export function createBossModel(): BossModel {
  const pool = new Pool();
  const group = new THREE.Group();
  group.name = 'boss';
  const rig = makeRig();
  const rng = rngFrom(31337);

  // ---- 共享 uniform：溶解 / 闪白（全身材质共用一组，一处改动全身生效） ----
  const uni = makeDissolveUniforms(0xff8a2a, 0xfff4e2);

  // ---- 纹理 ----
  const clothTex = pool.tex(createClothTexture(512, 4404));
  const inkTex = pool.tex(createInkAlphaTexture(512, 9182));
  const maskTex = pool.tex(createMaskTexture(512));
  const metalTex = pool.tex(createMetalTexture(256, 616, '#4a4238'));
  const featherTex = pool.tex(createFeatherTexture(256));
  const streakTex = pool.tex(createStreakTexture(64, 256));
  const haloTex = pool.tex(createRadialGlowTexture(128, 2.0));

  // ---- 材质（标准材质全部注入溶解/闪白） ----
  const bodyMat = pool.mat(new THREE.MeshStandardMaterial({ color: 0x1a1614, roughness: 0.72, metalness: 0.18 }));
  const robeMat = pool.mat(
    new THREE.MeshStandardMaterial({
      color: clothTex ? 0xffffff : 0xb8ae95,
      roughness: 0.88,
      metalness: 0.04,
      side: THREE.DoubleSide,
      transparent: true,
      alphaTest: 0.28,
    }),
  );
  if (clothTex) robeMat.map = clothTex;
  if (inkTex) robeMat.alphaMap = inkTex;
  const maskMat = pool.mat(new THREE.MeshStandardMaterial({ color: maskTex ? 0xffffff : 0xe6dcc6, roughness: 0.55, metalness: 0.12 }));
  if (maskTex) maskMat.map = maskTex;
  const metalMat = pool.mat(new THREE.MeshStandardMaterial({ color: metalTex ? 0xffffff : 0x5a5348, roughness: 0.34, metalness: 0.85 }));
  if (metalTex) metalMat.map = metalTex;
  const hiltMat = pool.mat(new THREE.MeshStandardMaterial({ color: 0x2a211a, roughness: 0.65, metalness: 0.4 }));
  const featherMat = pool.mat(
    new THREE.MeshStandardMaterial({
      color: 0x14110f,
      roughness: 0.95,
      side: THREE.DoubleSide,
      transparent: true,
      alphaTest: 0.3,
      emissive: new THREE.Color(0x2a1220),
      emissiveIntensity: 0.4,
    }),
  );
  if (featherTex) featherMat.alphaMap = featherTex;
  const goldCoreMat = pool.mat(
    new THREE.MeshStandardMaterial({ color: 0x3a2a08, roughness: 0.3, metalness: 0.6, emissive: new THREE.Color(0xffb02a), emissiveIntensity: 2.4 }),
  );
  const violetCoreMat = pool.mat(
    new THREE.MeshStandardMaterial({ color: 0x180a2a, roughness: 0.3, metalness: 0.6, emissive: new THREE.Color(0x9a4cff), emissiveIntensity: 2.2 }),
  );
  for (const m of [bodyMat, robeMat, maskMat, metalMat, hiltMat, featherMat, goldCoreMat, violetCoreMat]) applyDissolve(m, uni);

  // ---- 骨架：root → pelvis → spine → chest → (neck/head, 四臂, 披风, 羽翼) ----
  const root = rig.add('root', group, [0, 0, 0]);
  const pelvis = rig.add('pelvis', root, [0, 1.7, 0]);
  const spine = rig.add('spine', pelvis, [0, 0.16, -0.01]);
  const chest = rig.add('chest', spine, [0, 0.34, 0]);
  const neck = rig.add('neck', chest, [0, 0.42, -0.02]);
  const head = rig.add('head', neck, [0, 0.18, 0.03]);

  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, p: [number, number, number], r?: [number, number, number], s?: [number, number, number]): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(p[0], p[1], p[2]);
    if (r) m.rotation.set(r[0], r[1], r[2]);
    if (s) m.scale.set(s[0], s[1], s[2]);
    parent.add(m);
    return m;
  };

  // 躯干
  mesh(pool.geo(new THREE.CapsuleGeometry(0.17, 0.14, 3, 10)), bodyMat, pelvis, [0, 0, 0], undefined, [1, 1, 0.82]);
  mesh(pool.geo(new THREE.CapsuleGeometry(0.185, 0.24, 3, 10)), bodyMat, spine, [0, 0.14, 0], undefined, [1, 1, 0.78]);
  mesh(pool.geo(new THREE.CapsuleGeometry(0.215, 0.3, 4, 10)), bodyMat, chest, [0, 0.14, 0], undefined, [1.05, 1, 0.76]);
  // 胸甲 / 肩甲（金属）
  mesh(pool.geo(new THREE.BoxGeometry(0.34, 0.4, 0.14)), metalMat, chest, [0, 0.14, 0.15], [0.06, 0, 0]);
  mesh(pool.geo(new THREE.CapsuleGeometry(0.115, 0.14, 2, 8)), metalMat, chest, [0.34, 0.32, 0], [0, 0, 1.35]);
  mesh(pool.geo(new THREE.CapsuleGeometry(0.115, 0.14, 2, 8)), metalMat, chest, [-0.34, 0.32, 0], [0, 0, -1.35]);
  // 腰裙（袍）
  mesh(pool.geo(new THREE.CylinderGeometry(0.22, 0.4, 0.62, 12, 1, true)), robeMat, pelvis, [0, -0.28, 0]);

  // 颈 / 头 / 面具 / 冠角
  mesh(pool.geo(new THREE.CylinderGeometry(0.062, 0.075, 0.18, 8)), bodyMat, neck, [0, 0.08, 0]);
  mesh(pool.geo(new THREE.SphereGeometry(0.17, 14, 12)), maskMat, head, [0, 0, 0], undefined, [0.88, 1.08, 0.95]);
  mesh(pool.geo(new THREE.TorusGeometry(0.16, 0.028, 5, 14)), metalMat, head, [0, -0.03, 0], [1.45, 0, 0]);
  const hornGeo = pool.geo(new THREE.ConeGeometry(0.042, 0.44, 6));
  mesh(hornGeo, metalMat, head, [0.11, 0.14, -0.05], [-0.55, 0, 0.34]);
  mesh(hornGeo, metalMat, head, [-0.11, 0.14, -0.05], [-0.55, 0, -0.34]);
  mesh(pool.geo(new THREE.ConeGeometry(0.03, 0.3, 5)), metalMat, head, [0, 0.2, -0.02], [-0.2, 0, 0]);

  // ---- 四臂：A = 主臂（持主剑），B = 副臂（可抽短刃） ----
  const armGeoU = pool.geo(new THREE.CapsuleGeometry(0.072, 0.46, 3, 8));
  const armGeoL = pool.geo(new THREE.CapsuleGeometry(0.06, 0.4, 3, 8));
  const handGeo = pool.geo(new THREE.BoxGeometry(0.09, 0.14, 0.07));
  const armGeoU2 = pool.geo(new THREE.CapsuleGeometry(0.058, 0.38, 3, 8));
  const armGeoL2 = pool.geo(new THREE.CapsuleGeometry(0.05, 0.32, 3, 8));
  const pauldronGeo = pool.geo(new THREE.SphereGeometry(0.1, 8, 6));

  const buildArm = (
    up: string,
    lo: string,
    hand: string,
    anchorPos: [number, number, number],
    anchorRot: [number, number, number],
    primary: boolean,
  ): THREE.Object3D => {
    const u = rig.add(up, chest, anchorPos, anchorRot);
    const l = rig.add(lo, u, [0, primary ? -0.56 : -0.46, 0], [-0.22, 0, 0]);
    const h = rig.add(hand, l, [0, primary ? -0.48 : -0.4, 0]);
    mesh(primary ? armGeoU : armGeoU2, bodyMat, u, [0, primary ? -0.27 : -0.22, 0]);
    mesh(primary ? armGeoL : armGeoL2, bodyMat, l, [0, primary ? -0.23 : -0.19, 0]);
    mesh(handGeo, bodyMat, h, [0, -0.06, 0]);
    if (primary) mesh(pauldronGeo, metalMat, u, [0, -0.02, 0], undefined, [1, 0.8, 1]);
    return h;
  };

  // 主臂（+x 侧持金橙剑，-x 侧持紫暗影剑）
  const handR = buildArm('aUpR', 'aLoR', 'handR', [0.34, 0.28, 0.02], [0.12, 0, -0.2], true);
  const handL = buildArm('aUpL', 'aLoL', 'handL', [-0.34, 0.28, 0.02], [0.12, 0, 0.2], true);
  // 副臂（略低、略后，可抽出短刃）
  const handBR = buildArm('bUpR', 'bLoR', 'handBR', [0.3, 0.04, -0.12], [0.05, 0, -0.55], false);
  const handBL = buildArm('bUpL', 'bLoL', 'handBL', [-0.3, 0.04, -0.12], [0.05, 0, 0.55], false);

  // ---- 主剑 ----
  const goldSword = buildSword(pool, handR, {
    bladeLen: 1.62,
    bladeWidth: 0.062,
    color: 0xffa428,
    metalMat,
    hiltMat,
    streak: streakTex,
    curved: false,
  });
  goldSword.root.rotation.set(-2.0, 0, 0.1);
  const violetSword = buildSword(pool, handL, {
    bladeLen: 1.74,
    bladeWidth: 0.05,
    color: 0x9a5cff,
    metalMat,
    hiltMat,
    streak: streakTex,
    curved: true,
  });
  violetSword.root.rotation.set(-2.08, 0, -0.1);

  // ---- 副臂短刃：收在腕内，抽出时沿刃向伸展（scale 驱动） ----
  const daggerGeo = pool.geo(new THREE.CylinderGeometry(0.012, 0.03, 0.62, 4));
  const buildDagger = (parent: THREE.Object3D, color: number, flip: number): { root: THREE.Object3D; glow: GlowHandle } => {
    const r0 = new THREE.Object3D();
    r0.rotation.set(-1.5, 0, flip * 0.2);
    parent.add(r0);
    const b = new THREE.Mesh(daggerGeo, metalMat);
    b.position.y = 0.34;
    b.rotation.y = Math.PI * 0.25;
    b.scale.set(1, 1, 0.5);
    r0.add(b);
    const g = makeGlow(pool, color, streakTex, 0.85);
    const gm = new THREE.Mesh(pool.geo(new THREE.PlaneGeometry(0.24, 0.78)), g.mat);
    gm.position.y = 0.36;
    r0.add(gm);
    r0.scale.setScalar(0.001);
    return { root: r0, glow: g };
  };
  const daggerR = buildDagger(handBR, 0xff7a2a, -1);
  const daggerL = buildDagger(handBL, 0xb06cff, 1);

  // ---- 弱点核心：金 / 紫，破坏后变暗碎裂 ----
  const coreGeo = pool.geo(new THREE.IcosahedronGeometry(0.082, 1));
  const shardGeo = pool.geo(new THREE.TetrahedronGeometry(0.045, 0));
  const buildCore = (mat: THREE.MeshStandardMaterial, color: number, p: [number, number, number]) => {
    const holder = new THREE.Object3D();
    holder.position.set(p[0], p[1], p[2]);
    chest.add(holder);
    const core = new THREE.Mesh(coreGeo, mat);
    holder.add(core);
    // 光晕（加法混合面片，破坏后关掉）
    const halo = makeGlow(pool, color, haloTex, 0.9);
    const haloMesh = new THREE.Mesh(pool.geo(new THREE.PlaneGeometry(0.5, 0.5)), halo.mat);
    haloMesh.position.z = 0.04;
    holder.add(haloMesh);
    // 碎裂后露出的碎片（初始隐藏）
    const shards: THREE.Mesh[] = [];
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(shardGeo, metalMat);
      const a = (i / 5) * Math.PI * 2;
      s.position.set(Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0.02 + rng() * 0.03);
      s.rotation.set(rng() * 3, rng() * 3, rng() * 3);
      s.visible = false;
      holder.add(s);
      shards.push(s);
    }
    return { holder, core, halo, shards };
  };
  const goldCore = buildCore(goldCoreMat, 0xffb02a, [0.17, 0.2, 0.2]);
  const violetCore = buildCore(violetCoreMat, 0x9a4cff, [-0.17, 0.05, 0.2]);

  // ---- 背后垂落的羽翼状布片 ----
  const featherGeo = pool.geo(new THREE.PlaneGeometry(0.34, 1.25, 1, 3));
  const buildWing = (name: string, side: number): THREE.Object3D => {
    const w = rig.add(name, chest, [side * 0.26, 0.3, -0.19], [0.22, side * -0.35, side * 0.2]);
    for (let i = 0; i < 5; i++) {
      const f = mesh(featherGeo, featherMat, w, [side * (0.06 + i * 0.09), -0.55 - i * 0.06, -0.02 - i * 0.04], [0.1 + i * 0.05, side * (0.12 + i * 0.14), side * (0.12 + i * 0.18)], [1 - i * 0.1, 1 - i * 0.08, 1]);
      f.name = name + '-f' + i;
    }
    return w;
  };
  const wingL = buildWing('wingL', -1);
  const wingR = buildWing('wingR', 1);

  // ---- 披风：三段嵌套关节，末端更破 ----
  const cloak0 = rig.add('cloak0', chest, [0, 0.36, -0.17], [0.14, 0, 0]);
  const cloak1 = rig.add('cloak1', cloak0, [0, -0.56, -0.02], [0.06, 0, 0]);
  const cloak2 = rig.add('cloak2', cloak1, [0, -0.56, -0.02], [0.05, 0, 0]);
  const cloakGeoA = pool.geo(new THREE.PlaneGeometry(0.96, 0.6, 3, 2));
  const cloakGeoB = pool.geo(new THREE.PlaneGeometry(0.86, 0.6, 3, 2));
  const cloakGeoC = pool.geo(new THREE.PlaneGeometry(0.7, 0.62, 3, 2));
  mesh(cloakGeoA, robeMat, cloak0, [0, -0.28, 0]);
  mesh(cloakGeoB, robeMat, cloak1, [0, -0.28, 0]);
  mesh(cloakGeoC, robeMat, cloak2, [0, -0.3, 0]);

  // ---- 腿 ----
  const thighGeo = pool.geo(new THREE.CapsuleGeometry(0.1, 0.58, 3, 8));
  const shinGeo = pool.geo(new THREE.CapsuleGeometry(0.082, 0.6, 3, 8));
  const footGeo = pool.geo(new THREE.BoxGeometry(0.14, 0.09, 0.3));
  const buildLeg = (th: string, sh: string, ft: string, side: number): void => {
    const t0 = rig.add(th, pelvis, [side * 0.16, -0.1, 0], [0.04, 0, side * 0.05]);
    const s0 = rig.add(sh, t0, [0, -0.78, 0], [-0.06, 0, 0]);
    const f0 = rig.add(ft, s0, [0, -0.76, 0], [0.02, 0, 0]);
    mesh(thighGeo, bodyMat, t0, [0, -0.39, 0]);
    mesh(shinGeo, bodyMat, s0, [0, -0.38, 0]);
    mesh(footGeo, metalMat, f0, [0, -0.04, 0.06]);
    mesh(pool.geo(new THREE.CapsuleGeometry(0.09, 0.06, 2, 8)), metalMat, s0, [0, 0.02, 0.02]);
  };
  buildLeg('thighR', 'shinR', 'footR', 1);
  buildLeg('thighL', 'shinL', 'footL', -1);

  // ---- 气场轮廓光（阶段推进时变色） ----
  const aura = makeRim(pool, 0xff7a2a, 0.18, 2.4);
  const auraMesh = new THREE.Mesh(pool.geo(new THREE.CapsuleGeometry(0.32, 0.62, 4, 12)), aura.mat);
  auraMesh.position.y = 0.12;
  auraMesh.scale.set(1.16, 1.12, 1.0);
  chest.add(auraMesh);

  // ---- 锚点 ----
  const headAnchor = new THREE.Object3D();
  headAnchor.position.set(0, 0.26, 0);
  head.add(headAnchor);
  const chestAnchor = new THREE.Object3D();
  chestAnchor.position.set(0, 0.16, 0.16);
  chest.add(chestAnchor);

  const anchors = {
    head: headAnchor,
    chest: chestAnchor,
    goldTip: goldSword.tip,
    violetTip: violetSword.tip,
    gold_core: goldCore.core,
    violet_core: violetCore.core,
  };

  // ---- 状态 ----
  let phase = 1;
  let clip: Clip | null = null;
  let clipT = 0;
  let clipDur = 1;
  let flash = 0;
  let hitDiss = 0;
  let deathDiss = 0;
  let shake = 0;
  let strikeGold = 0;
  let strikeViolet = 0;
  let bladeOut = 0;
  let bladeTarget = 0;
  let goldBroken = false;
  let violetBroken = false;
  let hover = 0;

  const setGlows = (gs: GlowHandle[], pulse: number, opacity: number): void => {
    for (let i = 0; i < gs.length; i++) {
      gs[i].uPulse.value = pulse;
      gs[i].uOpacity.value = opacity;
    }
  };

  return {
    group,
    anchors,

    update(t: number, dt: number): void {
      const d = clamp(dt, 0, 0.1);
      uni.uTime.value = t;

      // 衰减：闪白 / 受击溶解 / 抖动 / 剑光冲击
      flash *= Math.exp(-d * 7.5);
      hitDiss *= Math.exp(-d * 4.5);
      shake *= Math.exp(-d * 9);
      strikeGold *= Math.exp(-d * 5.5);
      strikeViolet *= Math.exp(-d * 5.5);
      uni.uFlash.value = flash;
      uni.uDissolve.value = clamp(Math.max(deathDiss, hitDiss * 0.28), 0, 1);

      // 动作片段推进
      let w = 0;
      if (clip) {
        clipT += d / clipDur;
        if (clipT >= 1) {
          clip = null;
          clipT = 0;
        } else {
          w = envelope(clipT);
        }
      }

      // 1) 回到 rest
      rig.reset();

      // 2) 待机层：呼吸 / 悬浮 / 摆臂 / 头部微动（动作播放时按权重压低）
      const idle = 1 - 0.74 * w;
      const breath = Math.sin(t * 1.15);
      const hunch = phase >= 3 ? 0.16 : phase >= 2 ? 0.08 : 0;
      const J = rig.joints;
      J.spine.rotation.x += (breath * 0.028 + hunch * 0.5) * idle + hunch * 0.5;
      J.chest.rotation.x += (breath * 0.034 + hunch) * idle;
      J.chest.rotation.y += Math.sin(t * 0.47) * 0.05 * idle;
      J.neck.rotation.x += -breath * 0.02 * idle;
      J.head.rotation.x += (Math.sin(t * 0.9 + 1.1) * 0.03 - hunch * 0.6) * idle;
      J.head.rotation.y += Math.sin(t * 0.33) * 0.12 * idle;
      J.pelvis.rotation.y += Math.sin(t * 0.52) * 0.04 * idle;
      // 四臂各自不同相位的自然摆动
      J.aUpR.rotation.x += (Math.sin(t * 0.83) * 0.05 - 0.05) * idle;
      J.aUpR.rotation.z += Math.sin(t * 0.61 + 0.7) * 0.04 * idle;
      J.aUpL.rotation.x += (Math.sin(t * 0.79 + 2.1) * 0.05 - 0.05) * idle;
      J.aUpL.rotation.z += -Math.sin(t * 0.58 + 1.3) * 0.04 * idle;
      J.aLoR.rotation.x += Math.sin(t * 0.9 + 0.4) * 0.06 * idle;
      J.aLoL.rotation.x += Math.sin(t * 0.87 + 2.6) * 0.06 * idle;
      J.bUpR.rotation.z += Math.sin(t * 0.7 + 1.9) * 0.06 * idle;
      J.bUpL.rotation.z += -Math.sin(t * 0.73 + 0.5) * 0.06 * idle;
      // 阶段 3 微微离地悬浮
      hover = approach(hover, phase >= 3 ? 1 : 0, 1.6, d);
      J.root.position.y += (Math.sin(t * 1.6) * 0.03 + 0.06) * hover + breath * 0.012 * idle;

      // 3) 动作层
      if (clip) applyClip(rig, clip, clipT, w);

      // 4) 命中抖动（短促高频）
      if (shake > 0.001) {
        const s = shake;
        J.chest.rotation.x += Math.sin(t * 62) * 0.05 * s;
        J.chest.rotation.z += Math.sin(t * 71 + 1.3) * 0.05 * s;
        J.head.rotation.z += Math.sin(t * 83) * 0.06 * s;
        J.root.position.x += Math.sin(t * 77) * 0.02 * s;
      }

      // 5) 布料层：披风 / 羽翼 摆动（叠加在动作之上，带相位滞后）
      const swing = Math.sin(t * 1.25);
      const swing2 = Math.sin(t * 1.25 - 0.7);
      const swing3 = Math.sin(t * 1.25 - 1.4);
      const gust = 1 + w * 1.8 + shake * 2;
      J.cloak0.rotation.x += swing * 0.05 * gust;
      J.cloak0.rotation.z += Math.sin(t * 0.9) * 0.04 * gust;
      J.cloak1.rotation.x += swing2 * 0.09 * gust;
      J.cloak1.rotation.z += Math.sin(t * 0.95 + 1) * 0.06 * gust;
      J.cloak2.rotation.x += swing3 * 0.13 * gust;
      J.cloak2.rotation.z += Math.sin(t * 1.05 + 2) * 0.08 * gust;
      J.wingL.rotation.z += (Math.sin(t * 0.85) * 0.07 - 0.03) * gust;
      J.wingR.rotation.z += (-Math.sin(t * 0.85 + 0.4) * 0.07 + 0.03) * gust;
      J.wingL.rotation.x += Math.sin(t * 0.6) * 0.05 * gust;
      J.wingR.rotation.x += Math.sin(t * 0.62 + 1.7) * 0.05 * gust;

      // 6) 剑光脉冲：基础呼吸 + 阶段加成 + 命中冲击
      const base = 0.3 + phase * 0.14 + 0.12 * Math.sin(t * 2.6);
      const fade = 1 - deathDiss;
      setGlows(goldSword.glows, (base + strikeGold * 1.7) * (goldBroken ? 0.35 : 1), fade * (goldBroken ? 0.5 : 1));
      setGlows(violetSword.glows, (base * 0.9 + strikeViolet * 1.7) * (violetBroken ? 0.35 : 1), fade * (violetBroken ? 0.5 : 1));

      // 7) 短刃抽出 / 收回
      bladeOut = approach(bladeOut, bladeTarget, 6, d);
      const bo = Math.max(0.001, bladeOut);
      daggerR.root.scale.setScalar(bo);
      daggerL.root.scale.setScalar(bo);
      daggerR.glow.uPulse.value = base * bladeOut;
      daggerL.glow.uPulse.value = base * bladeOut;
      daggerR.glow.uOpacity.value = 0.85 * bladeOut * fade;
      daggerL.glow.uOpacity.value = 0.85 * bladeOut * fade;

      // 8) 弱点核心：呼吸发光 / 光晕；已破坏则保持黯淡
      const corePulse = 0.55 + 0.45 * Math.sin(t * 3.1);
      if (!goldBroken) {
        goldCoreMat.emissiveIntensity = (1.6 + corePulse * 1.4) * fade;
        goldCore.halo.uPulse.value = 0.5 + corePulse * 0.7;
        goldCore.halo.uOpacity.value = 0.85 * fade;
        goldCore.core.rotation.y += d * 0.8;
        goldCore.core.rotation.x += d * 0.4;
      }
      if (!violetBroken) {
        violetCoreMat.emissiveIntensity = (1.4 + corePulse * 1.3) * fade;
        violetCore.halo.uPulse.value = 0.45 + corePulse * 0.65;
        violetCore.halo.uOpacity.value = 0.85 * fade;
        violetCore.core.rotation.y -= d * 0.7;
        violetCore.core.rotation.z += d * 0.35;
      }

      // 9) 气场
      aura.uIntensity.value = (0.1 + phase * 0.06 + flash * 0.5 + w * 0.12) * fade;

      // 10) 死亡解体：整体下沉、前倾、布料松垂
      if (deathDiss > 0.001) {
        const k = deathDiss;
        J.root.position.y -= k * 0.42;
        J.spine.rotation.x += k * 0.5;
        J.chest.rotation.x += k * 0.4;
        J.head.rotation.x += k * 0.55;
        J.aUpR.rotation.x += k * 0.4;
        J.aUpL.rotation.x += k * 0.4;
        J.thighR.rotation.x += k * 0.5;
        J.thighL.rotation.x += k * 0.5;
        J.shinR.rotation.x -= k * 0.7;
        J.shinL.rotation.x -= k * 0.7;
        J.cloak2.rotation.x += k * 0.5;
        featherMat.opacity = 1 - k;
        featherMat.transparent = true;
      }
    },

    setPhase(p: number): void {
      phase = clamp(Math.round(p), 1, 3);
      // 阶段推进：气场变色、副臂短刃抽出、核心更亮、袍色更沉
      const auraCol = phase === 1 ? 0xff7a2a : phase === 2 ? 0xb055ff : 0xd6203a;
      aura.uColor.value.setHex(auraCol);
      bladeTarget = phase >= 2 ? 1 : 0;
      robeMat.color.setHex(phase >= 3 ? 0x9a8f78 : 0xffffff);
      uni.uEdgeColor.value.setHex(phase >= 3 ? 0xff3a2a : 0xff8a2a);
      goldCoreMat.emissive.setHex(phase >= 3 ? 0xffd06a : 0xffb02a);
      violetCoreMat.emissive.setHex(phase >= 3 ? 0xc86cff : 0x9a4cff);
    },

    hitFlash(intensity: number): void {
      const i = clamp(intensity, 0, 1);
      flash = Math.max(flash, i);
      hitDiss = Math.max(hitDiss, i * 0.5);
      shake = Math.max(shake, i * 0.55);
    },

    playAttack(kind, durationMs: number): void {
      const c = BOSS_CLIPS[kind];
      if (!c) return;
      clip = c;
      clipT = 0;
      clipDur = Math.max(0.2, durationMs / 1000);
      if (kind === 'array' || kind === 'storm') bladeTarget = 1;
      else if (phase < 2) bladeTarget = 0;
    },

    strike(index: number): void {
      shake = Math.max(shake, 0.7);
      if (index % 2 === 0) strikeGold = 1.6;
      else strikeViolet = 1.6;
      // 双剑同出的段数（第 3 段起）两把一起亮
      if (index >= 2) {
        strikeGold = Math.max(strikeGold, 1.2);
        strikeViolet = Math.max(strikeViolet, 1.2);
      }
    },

    breakWeakPoint(id: 'gold_core' | 'violet_core'): void {
      const target = id === 'gold_core' ? goldCore : violetCore;
      const mat = id === 'gold_core' ? goldCoreMat : violetCoreMat;
      if (id === 'gold_core') goldBroken = true;
      else violetBroken = true;
      // 核心变暗 + 缩小 + 碎片外露 + 光晕熄灭
      mat.emissive.setHex(0x140f0c);
      mat.emissiveIntensity = 0.12;
      mat.color.setHex(0x100c0a);
      mat.roughness = 0.95;
      mat.metalness = 0.15;
      target.core.scale.setScalar(0.62);
      target.core.rotation.set(0.6, 0.4, 0.9);
      target.halo.uOpacity.value = 0;
      target.halo.uPulse.value = 0;
      for (let i = 0; i < target.shards.length; i++) {
        const s = target.shards[i];
        s.visible = true;
        s.position.multiplyScalar(1.35);
      }
    },

    dissolve(progress: number): void {
      deathDiss = clamp(progress, 0, 1);
    },

    dispose(): void {
      detachAll(group);
      pool.dispose();
    },
  };
}

/* ================================================================== *
 * 5. 角色（熙艾尔 / 吕涅 / 玛埃尔），身高约 1.8m
 * ================================================================== */

export interface CharacterSpec {
  id: 'sciel' | 'lune' | 'maelle';
  color: string;
  rimColor: string;
}

export interface CharacterModel {
  group: THREE.Group;
  update(t: number, dt: number): void;
  hitFlash(intensity: number): void;
  playAttack(kind: 'slash' | 'cast' | 'thrust' | 'counter' | 'item', durationMs: number): void;
  /** 玛埃尔姿态轮廓光：none/offensive/defensive/virtuose；其它角色可忽略 */
  setStance(stance: 'none' | 'offensive' | 'defensive' | 'virtuose'): void;
  /** 前进半步（当前行动者）/ 归位 */
  setActive(active: boolean): void;
  setDead(dead: boolean): void;
  anchors: { chest: THREE.Object3D; weaponTip: THREE.Object3D; head: THREE.Object3D };
  dispose(): void;
}

/** 角色动作库（相对 rest 的偏移量） */
const CHAR_CLIPS: Record<string, Clip> = {
  // 斜斩：上步 + 右臂由上而下
  slash: {
    keys: [
      { t: 0 },
      { t: 0.18, rot: { aUpR: [-1.7, 0.2, -0.5], aLoR: [-0.7, 0, 0], chest: [-0.1, 0.42, 0], spine: [0, 0.2, 0], head: [-0.05, 0.3, 0], thighR: [-0.15, 0, 0] }, pos: { root: [0, 0.02, -0.1] } },
      { t: 0.42, rot: { aUpR: [0.62, -0.2, 0.45], aLoR: [-0.1, 0, 0], chest: [0.2, -0.45, 0], spine: [0.1, -0.2, 0], head: [0.14, -0.24, 0], thighR: [0.28, 0, 0], shinR: [-0.3, 0, 0] }, pos: { root: [0, -0.04, 0.4] } },
      { t: 0.66, rot: { aUpR: [0.2, -0.1, 0.2], aLoR: [-0.5, 0, 0], chest: [0.08, -0.2, 0] }, pos: { root: [0, -0.02, 0.22] } },
      { t: 1 },
    ],
  },
  // 施法：双臂抬起画符，后仰再前推
  cast: {
    keys: [
      { t: 0 },
      { t: 0.24, rot: { aUpR: [-1.25, -0.35, -0.7], aLoR: [-1.1, 0, 0], aUpL: [-1.25, 0.35, 0.7], aLoL: [-1.1, 0, 0], spine: [-0.16, 0, 0], chest: [-0.14, 0, 0], head: [-0.28, 0, 0] }, pos: { root: [0, 0.04, -0.06] } },
      { t: 0.56, rot: { aUpR: [-1.5, -0.15, -0.35], aLoR: [-0.6, 0, 0], aUpL: [-1.5, 0.15, 0.35], aLoL: [-0.6, 0, 0], spine: [-0.2, 0, 0], chest: [-0.18, 0, 0], head: [-0.34, 0, 0] }, pos: { root: [0, 0.06, -0.04] } },
      { t: 0.76, rot: { aUpR: [-1.62, 0.1, 0], aLoR: [-0.12, 0, 0], aUpL: [-1.62, -0.1, 0], aLoL: [-0.12, 0, 0], spine: [0.18, 0, 0], chest: [0.14, 0, 0], head: [0.1, 0, 0] }, pos: { root: [0, -0.02, 0.16] } },
      { t: 1 },
    ],
  },
  // 突刺：单臂直线突出 + 前踏
  thrust: {
    keys: [
      { t: 0 },
      { t: 0.2, rot: { aUpR: [-0.45, 0.4, -0.2], aLoR: [-1.7, 0, 0], chest: [0, 0.4, 0], thighR: [0.2, 0, 0] }, pos: { root: [0, -0.06, -0.14] } },
      { t: 0.4, rot: { aUpR: [-1.4, 0.05, -0.08], aLoR: [-0.06, 0, 0], chest: [0.05, -0.14, 0], thighL: [-0.3, 0, 0], shinL: [0.2, 0, 0] }, pos: { root: [0, 0, 0.52] } },
      { t: 0.64, rot: { aUpR: [-1.35, 0.05, -0.08], aLoR: [-0.1, 0, 0] }, pos: { root: [0, 0, 0.46] } },
      { t: 1 },
    ],
  },
  // 反击/格挡：侧闪 + 上撩挡格 + 顺势回刺
  counter: {
    keys: [
      { t: 0 },
      { t: 0.14, rot: { aUpR: [-0.9, 0, -1.1], aLoR: [-1.4, 0, 0], chest: [0, -0.35, 0], spine: [0.1, -0.15, 0], head: [0, -0.3, 0] }, pos: { root: [-0.2, -0.05, 0.05] } },
      { t: 0.34, rot: { aUpR: [-2.0, 0.2, -0.4], aLoR: [-0.5, 0, 0], chest: [-0.12, 0.2, 0], head: [-0.16, 0.2, 0] }, pos: { root: [-0.1, 0.03, 0] } },
      { t: 0.58, rot: { aUpR: [-1.2, 0.1, 0.1], aLoR: [-0.2, 0, 0], chest: [0.12, -0.3, 0], spine: [0.06, -0.14, 0] }, pos: { root: [0, -0.02, 0.34] } },
      { t: 1 },
    ],
  },
  // 使用道具：低头取物 → 抬手举起
  item: {
    keys: [
      { t: 0 },
      { t: 0.26, rot: { aUpR: [0.35, 0.5, -0.3], aLoR: [-1.5, 0, 0], spine: [0.22, 0, 0], chest: [0.16, 0, 0], head: [0.34, 0, 0] } },
      { t: 0.58, rot: { aUpR: [-1.15, 0.15, -0.15], aLoR: [-1.9, 0, 0], spine: [-0.1, 0, 0], chest: [-0.08, 0, 0], head: [-0.2, 0, 0] } },
      { t: 0.8, rot: { aUpR: [-0.8, 0.1, -0.1], aLoR: [-1.5, 0, 0], head: [-0.1, 0, 0] } },
      { t: 1 },
    ],
  },
};

export function createCharacterModel(spec: CharacterSpec): CharacterModel {
  const pool = new Pool();
  const group = new THREE.Group();
  group.name = 'char-' + spec.id;
  const rig = makeRig();
  const uni = makeDissolveUniforms(0xffd08a, 0xffffff);

  const main = new THREE.Color(spec.color);
  const rimCol = new THREE.Color(spec.rimColor);

  // 每个角色的差异化配置：发色 / 外衣 / 武器形态
  const isSciel = spec.id === 'sciel';
  const isLune = spec.id === 'lune';
  const isMaelle = spec.id === 'maelle';
  const hairColor = isSciel ? 0x33231a : isLune ? 0x131015 : 0x7c3a18;

  const clothTex = pool.tex(createClothTexture(256, isSciel ? 1201 : isLune ? 1301 : 1401, '#cfc4ab', '#191518'));
  const metalTex = pool.tex(createMetalTexture(128, 909, '#6a6355'));
  const streakTex = pool.tex(createStreakTexture(32, 128));
  const haloTex = pool.tex(createRadialGlowTexture(64, 2.2));

  const skinMat = pool.mat(new THREE.MeshStandardMaterial({ color: 0xb08a6a, roughness: 0.78, metalness: 0.05 }));
  const clothMat = pool.mat(new THREE.MeshStandardMaterial({ color: main.clone().multiplyScalar(0.85), roughness: 0.86, metalness: 0.06 }));
  if (clothTex) clothMat.map = clothTex;
  const coatMat = pool.mat(
    new THREE.MeshStandardMaterial({
      color: main.clone().multiplyScalar(isSciel ? 0.45 : 0.7),
      roughness: 0.9,
      metalness: 0.05,
      side: THREE.DoubleSide,
    }),
  );
  const darkMat = pool.mat(new THREE.MeshStandardMaterial({ color: 0x1c1719, roughness: 0.8, metalness: 0.1 }));
  const armorMat = pool.mat(new THREE.MeshStandardMaterial({ color: metalTex ? 0xd8d2c4 : 0x9a9384, roughness: 0.36, metalness: 0.82 }));
  if (metalTex) armorMat.map = metalTex;
  const hairMat = pool.mat(new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.72, metalness: 0.08 }));
  for (const m of [skinMat, clothMat, coatMat, darkMat, armorMat, hairMat]) applyDissolve(m, uni);

  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, p: [number, number, number], r?: [number, number, number], s?: [number, number, number]): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(p[0], p[1], p[2]);
    if (r) m.rotation.set(r[0], r[1], r[2]);
    if (s) m.scale.set(s[0], s[1], s[2]);
    parent.add(m);
    return m;
  };

  // ---- 骨架 ----
  const root = rig.add('root', group, [0, 0, 0]);
  const pelvis = rig.add('pelvis', root, [0, 1.0, 0]);
  const spine = rig.add('spine', pelvis, [0, 0.1, 0]);
  const chest = rig.add('chest', spine, [0, 0.24, 0]);
  const neck = rig.add('neck', chest, [0, 0.24, -0.01]);
  const head = rig.add('head', neck, [0, 0.13, 0.02]);

  mesh(pool.geo(new THREE.CapsuleGeometry(0.12, 0.1, 3, 8)), clothMat, pelvis, [0, 0, 0], undefined, [1, 1, 0.8]);
  mesh(pool.geo(new THREE.CapsuleGeometry(0.13, 0.16, 3, 8)), clothMat, spine, [0, 0.1, 0], undefined, [1, 1, 0.76]);
  mesh(pool.geo(new THREE.CapsuleGeometry(0.145, 0.2, 3, 10)), clothMat, chest, [0, 0.1, 0], undefined, [1.04, 1, 0.74]);
  mesh(pool.geo(new THREE.CylinderGeometry(0.045, 0.055, 0.12, 7)), skinMat, neck, [0, 0.05, 0]);
  mesh(pool.geo(new THREE.SphereGeometry(0.115, 12, 10)), skinMat, head, [0, 0, 0], undefined, [0.9, 1.05, 0.94]);
  // 头发（不同角色不同轮廓）
  mesh(pool.geo(new THREE.SphereGeometry(0.125, 12, 10)), hairMat, head, [0, 0.018, -0.012], undefined, isLune ? [0.96, 1.0, 1.0] : [1.0, 0.98, 1.02]);
  if (isSciel) mesh(pool.geo(new THREE.CapsuleGeometry(0.055, 0.28, 3, 7)), hairMat, head, [0, -0.16, -0.1], [0.3, 0, 0]);
  if (isLune) mesh(pool.geo(new THREE.CapsuleGeometry(0.05, 0.34, 3, 7)), hairMat, head, [0, -0.2, -0.09], [0.2, 0, 0]);
  if (isMaelle) mesh(pool.geo(new THREE.CapsuleGeometry(0.048, 0.16, 3, 7)), hairMat, head, [0, -0.1, -0.11], [0.45, 0, 0]);

  // 外衣 / 轻甲
  if (isSciel) {
    // 暗色长外套：两段下摆
    const coat0 = rig.add('coat0', chest, [0, 0.02, -0.02], [0.05, 0, 0]);
    const coat1 = rig.add('coat1', coat0, [0, -0.42, -0.01], [0.04, 0, 0]);
    mesh(pool.geo(new THREE.PlaneGeometry(0.5, 0.46, 2, 2)), coatMat, coat0, [0, -0.22, -0.1]);
    mesh(pool.geo(new THREE.PlaneGeometry(0.44, 0.48, 2, 2)), coatMat, coat1, [0, -0.24, -0.1]);
    mesh(pool.geo(new THREE.CylinderGeometry(0.16, 0.24, 0.5, 10, 1, true)), coatMat, pelvis, [0, -0.2, 0]);
  } else if (isLune) {
    // 施法者长袍
    mesh(pool.geo(new THREE.CylinderGeometry(0.15, 0.3, 0.66, 12, 1, true)), coatMat, pelvis, [0, -0.26, 0]);
    const coat0 = rig.add('coat0', chest, [0, 0.04, -0.03], [0.06, 0, 0]);
    mesh(pool.geo(new THREE.PlaneGeometry(0.42, 0.6, 2, 2)), coatMat, coat0, [0, -0.3, -0.08]);
  } else {
    // 轻甲：胸甲 + 腰甲 + 护肩
    mesh(pool.geo(new THREE.BoxGeometry(0.26, 0.28, 0.14)), armorMat, chest, [0, 0.1, 0.09], [0.05, 0, 0]);
    mesh(pool.geo(new THREE.CylinderGeometry(0.15, 0.19, 0.2, 10)), armorMat, pelvis, [0, -0.04, 0]);
    const coat0 = rig.add('coat0', pelvis, [0, -0.1, -0.04], [0.04, 0, 0]);
    mesh(pool.geo(new THREE.PlaneGeometry(0.34, 0.36, 2, 2)), coatMat, coat0, [0, -0.18, -0.06]);
  }

  // ---- 双臂 ----
  const upGeo = pool.geo(new THREE.CapsuleGeometry(0.048, 0.22, 3, 7));
  const loGeo = pool.geo(new THREE.CapsuleGeometry(0.04, 0.2, 3, 7));
  const handGeo = pool.geo(new THREE.BoxGeometry(0.062, 0.1, 0.05));
  const buildArm = (up: string, lo: string, hd: string, side: number): THREE.Object3D => {
    const u = rig.add(up, chest, [side * 0.175, 0.17, 0], [0.08, 0, side * -0.14]);
    const l = rig.add(lo, u, [0, -0.3, 0], [-0.2, 0, 0]);
    const h = rig.add(hd, l, [0, -0.28, 0]);
    mesh(upGeo, clothMat, u, [0, -0.14, 0]);
    mesh(loGeo, isMaelle ? armorMat : clothMat, l, [0, -0.13, 0]);
    mesh(handGeo, skinMat, h, [0, -0.05, 0]);
    if (isMaelle) mesh(pool.geo(new THREE.SphereGeometry(0.062, 8, 6)), armorMat, u, [0, -0.01, 0], undefined, [1, 0.75, 1]);
    return h;
  };
  const handR = buildArm('aUpR', 'aLoR', 'handR', 1);
  const handL = buildArm('aUpL', 'aLoL', 'handL', -1);

  // ---- 腿 ----
  const thighGeo = pool.geo(new THREE.CapsuleGeometry(0.062, 0.3, 3, 7));
  const shinGeo = pool.geo(new THREE.CapsuleGeometry(0.05, 0.3, 3, 7));
  const footGeo = pool.geo(new THREE.BoxGeometry(0.085, 0.06, 0.2));
  const buildLeg = (th: string, sh: string, ft: string, side: number): void => {
    const t0 = rig.add(th, pelvis, [side * 0.095, -0.08, 0], [0.03, 0, side * 0.03]);
    const s0 = rig.add(sh, t0, [0, -0.44, 0], [-0.05, 0, 0]);
    const f0 = rig.add(ft, s0, [0, -0.42, 0], [0.02, 0, 0]);
    mesh(thighGeo, isLune ? coatMat : darkMat, t0, [0, -0.21, 0]);
    mesh(shinGeo, isMaelle ? armorMat : darkMat, s0, [0, -0.2, 0]);
    mesh(footGeo, darkMat, f0, [0, -0.03, 0.04]);
  };
  buildLeg('thighR', 'shinR', 'footR', 1);
  buildLeg('thighL', 'shinL', 'footL', -1);

  // ---- 武器 ----
  const weapon = new THREE.Object3D();
  handR.add(weapon);
  const weaponTip = new THREE.Object3D();
  const weaponGlow = makeGlow(pool, main.getHex(), streakTex, 0.85);
  const orbits: THREE.Object3D[] = [];
  let orbCore: THREE.Mesh | null = null;

  if (isSciel) {
    // 镰刃 / 弯刃：长柄 + 圆弧刃
    weapon.rotation.set(-1.85, 0, 0.12);
    mesh(pool.geo(new THREE.CylinderGeometry(0.022, 0.026, 1.16, 6)), darkMat, weapon, [0, 0.42, 0]);
    const bladeArc = mesh(pool.geo(new THREE.TorusGeometry(0.34, 0.022, 4, 14, 2.1)), armorMat, weapon, [0, 0.96, 0], [Math.PI / 2, 0, -0.6]);
    bladeArc.scale.set(1, 1, 2.6);
    const gm = new THREE.Mesh(pool.geo(new THREE.PlaneGeometry(0.22, 0.86)), weaponGlow.mat);
    gm.position.set(0.16, 0.98, 0);
    gm.rotation.set(0, Math.PI / 2, 0.5);
    weapon.add(gm);
    weaponTip.position.set(0.3, 1.24, 0);
  } else if (isLune) {
    // 法杖 + 悬浮法器（两枚环 + 中心核心，update 中自转）
    weapon.rotation.set(-0.32, 0, 0.08);
    mesh(pool.geo(new THREE.CylinderGeometry(0.02, 0.024, 1.5, 6)), darkMat, weapon, [0, 0.6, 0]);
    mesh(pool.geo(new THREE.TorusGeometry(0.1, 0.018, 4, 12)), armorMat, weapon, [0, 1.36, 0], [Math.PI / 2, 0, 0]);
    const coreMat = pool.mat(
      new THREE.MeshStandardMaterial({ color: main.clone().multiplyScalar(0.3), roughness: 0.2, metalness: 0.4, emissive: main.clone(), emissiveIntensity: 2.2 }),
    );
    applyDissolve(coreMat, uni);
    orbCore = mesh(pool.geo(new THREE.IcosahedronGeometry(0.06, 1)), coreMat, weapon, [0, 1.36, 0]);
    const halo = new THREE.Mesh(pool.geo(new THREE.PlaneGeometry(0.34, 0.34)), weaponGlow.mat);
    halo.position.set(0, 1.36, 0);
    weapon.add(halo);
    // 悬浮法器：两枚绕核心公转的小环
    for (let i = 0; i < 2; i++) {
      const o = new THREE.Object3D();
      o.position.set(0, 1.36, 0);
      weapon.add(o);
      const ring = mesh(pool.geo(new THREE.TorusGeometry(0.075, 0.01, 3, 10)), armorMat, o, [0.17, 0, 0], [i === 0 ? 0.6 : -0.8, 0.4, 0]);
      ring.name = 'orbit' + i;
      orbits.push(o);
    }
    weaponTip.position.set(0, 1.46, 0);
  } else {
    // 轻甲长剑
    weapon.rotation.set(-1.95, 0, 0.08);
    mesh(pool.geo(new THREE.CylinderGeometry(0.018, 0.022, 0.22, 6)), darkMat, weapon, [0, -0.06, 0]);
    mesh(pool.geo(new THREE.BoxGeometry(0.2, 0.03, 0.05)), armorMat, weapon, [0, 0.06, 0]);
    const blade = mesh(pool.geo(new THREE.CylinderGeometry(0.014, 0.036, 1.0, 4)), armorMat, weapon, [0, 0.57, 0], [0, Math.PI / 4, 0]);
    blade.scale.set(1, 1, 0.4);
    const gm = new THREE.Mesh(pool.geo(new THREE.PlaneGeometry(0.2, 1.1)), weaponGlow.mat);
    gm.position.set(0, 0.58, 0);
    weapon.add(gm);
    const gm2 = new THREE.Mesh(pool.geo(new THREE.PlaneGeometry(0.2, 1.1)), weaponGlow.mat);
    gm2.position.set(0, 0.58, 0);
    gm2.rotation.y = Math.PI / 2;
    weapon.add(gm2);
    weaponTip.position.set(0, 1.1, 0);
  }
  weapon.add(weaponTip);

  // ---- 姿态轮廓光：躯干 + 头部两片菲涅尔外壳（加法混合） ----
  const rim = makeRim(pool, rimCol.getHex(), 0, 2.6);
  const rimTorso = new THREE.Mesh(pool.geo(new THREE.CapsuleGeometry(0.17, 0.34, 4, 12)), rim.mat);
  rimTorso.position.y = 0.06;
  rimTorso.scale.set(1.1, 1.1, 0.95);
  chest.add(rimTorso);
  const rimHead = new THREE.Mesh(pool.geo(new THREE.SphereGeometry(0.14, 12, 10)), rim.mat);
  rimHead.scale.set(0.98, 1.06, 1.0);
  head.add(rimHead);
  // 脚下光斑（当前行动者提示）
  const footGlow = makeGlow(pool, rimCol.getHex(), haloTex, 0);
  const footGlowMesh = new THREE.Mesh(pool.geo(new THREE.PlaneGeometry(1.1, 1.1)), footGlow.mat);
  footGlowMesh.rotation.x = -Math.PI / 2;
  footGlowMesh.position.y = 0.02;
  root.add(footGlowMesh);

  // ---- 锚点 ----
  const headAnchor = new THREE.Object3D();
  headAnchor.position.set(0, 0.16, 0);
  head.add(headAnchor);
  const chestAnchor = new THREE.Object3D();
  chestAnchor.position.set(0, 0.1, 0.12);
  chest.add(chestAnchor);

  // ---- 状态 ----
  let clip: Clip | null = null;
  let clipT = 0;
  let clipDur = 1;
  let flash = 0;
  let stance: 'none' | 'offensive' | 'defensive' | 'virtuose' = 'none';
  let stanceTargetInt = 0;
  let stanceInt = 0;
  let active = false;
  let step = 0;
  let dead = false;
  let deadK = 0;

  const STANCE_COLOR: Record<string, number> = {
    none: rimCol.getHex(),
    offensive: 0xff6a28,
    defensive: 0x58a6ff,
    virtuose: 0xffd24a,
  };

  return {
    group,
    anchors: { chest: chestAnchor, weaponTip, head: headAnchor },

    update(t: number, dt: number): void {
      const d = clamp(dt, 0, 0.1);
      uni.uTime.value = t;
      flash *= Math.exp(-d * 8);
      uni.uFlash.value = flash;

      let w = 0;
      if (clip) {
        clipT += d / clipDur;
        if (clipT >= 1) {
          clip = null;
          clipT = 0;
        } else {
          w = envelope(clipT);
        }
      }

      rig.reset();

      // 待机：呼吸 + 重心微摆（死亡时全部停掉）
      const alive = 1 - deadK;
      const idle = (1 - 0.72 * w) * alive;
      const breath = Math.sin(t * 1.5 + (isLune ? 1.2 : isSciel ? 0.4 : 2.3));
      const J = rig.joints;
      J.spine.rotation.x += breath * 0.03 * idle;
      J.chest.rotation.x += breath * 0.035 * idle;
      J.chest.rotation.y += Math.sin(t * 0.6) * 0.05 * idle;
      J.head.rotation.y += Math.sin(t * 0.42 + 1) * 0.14 * idle;
      J.head.rotation.x += Math.sin(t * 1.1) * 0.025 * idle;
      J.aUpR.rotation.x += Math.sin(t * 1.0) * 0.05 * idle;
      J.aUpR.rotation.z += Math.sin(t * 0.7) * 0.03 * idle;
      J.aUpL.rotation.x += Math.sin(t * 1.0 + 2.2) * 0.05 * idle;
      J.aUpL.rotation.z += -Math.sin(t * 0.72 + 1) * 0.03 * idle;
      J.pelvis.rotation.y += Math.sin(t * 0.55) * 0.04 * idle;
      J.root.position.y += breath * 0.008 * idle;

      if (clip && !dead) applyClip(rig, clip, clipT, w);

      // 外衣/袍摆
      if (J.coat0) {
        J.coat0.rotation.x += Math.sin(t * 1.3) * 0.05 * (1 + w * 1.6);
        J.coat0.rotation.z += Math.sin(t * 0.95) * 0.03;
      }
      if (J.coat1) {
        J.coat1.rotation.x += Math.sin(t * 1.3 - 0.8) * 0.08 * (1 + w * 1.6);
        J.coat1.rotation.z += Math.sin(t * 1.0 + 1.2) * 0.05;
      }

      // 前进半步 / 归位（沿自身 +Z）
      step = approach(step, active && !dead ? 1 : 0, 5, d);
      J.root.position.z += step * 0.45;
      J.pelvis.rotation.x += step * 0.06;

      // 死亡：向后倒伏
      deadK = approach(deadK, dead ? 1 : 0, dead ? 3.2 : 5, d);
      if (deadK > 0.001) {
        J.root.rotation.x -= deadK * 1.42;
        J.root.position.y -= deadK * 0.1;
        J.spine.rotation.x += deadK * 0.28;
        J.head.rotation.x += deadK * 0.4;
        J.aUpR.rotation.z += deadK * 0.5;
        J.aUpL.rotation.z -= deadK * 0.5;
        J.thighR.rotation.x += deadK * 0.35;
        J.thighL.rotation.x += deadK * 0.2;
      }

      // 姿态轮廓光：virtuose 额外脉动
      stanceInt = approach(stanceInt, stanceTargetInt * alive, 5, d);
      const pulse = stance === 'virtuose' ? 0.28 * (0.5 + 0.5 * Math.sin(t * 5.2)) : stance === 'offensive' ? 0.08 * Math.sin(t * 3.4) : 0;
      rim.uIntensity.value = Math.max(0, stanceInt + pulse + flash * 0.6);
      rim.uPower.value = stance === 'defensive' ? 3.4 : stance === 'virtuose' ? 2.0 : 2.6;

      // 武器光 + 行动者脚下光斑
      weaponGlow.uPulse.value = (0.3 + 0.2 * Math.sin(t * 2.4) + w * 0.9) * alive;
      weaponGlow.uOpacity.value = 0.85 * alive;
      footGlow.uOpacity.value = step * 0.5 * alive;
      footGlow.uPulse.value = 0.4 + 0.3 * Math.sin(t * 2.2);
      footGlowMesh.scale.setScalar(0.9 + 0.1 * Math.sin(t * 2.2));

      // 吕涅：悬浮法器公转 + 核心自转
      for (let i = 0; i < orbits.length; i++) {
        orbits[i].rotation.y = t * (i === 0 ? 1.6 : -1.15) + i * 2.1;
        orbits[i].rotation.z = Math.sin(t * 0.8 + i) * 0.4;
      }
      if (orbCore) {
        orbCore.rotation.y += d * 1.2;
        orbCore.rotation.x += d * 0.6;
      }
    },

    hitFlash(intensity: number): void {
      flash = Math.max(flash, clamp(intensity, 0, 1));
    },

    playAttack(kind, durationMs: number): void {
      if (dead) return;
      const c = CHAR_CLIPS[kind];
      if (!c) return;
      clip = c;
      clipT = 0;
      clipDur = Math.max(0.2, durationMs / 1000);
    },

    setStance(s: 'none' | 'offensive' | 'defensive' | 'virtuose'): void {
      stance = s;
      rim.uColor.value.setHex(STANCE_COLOR[s] ?? rimCol.getHex());
      stanceTargetInt = s === 'none' ? 0.1 : s === 'defensive' ? 0.42 : s === 'offensive' ? 0.55 : 0.75;
    },

    setActive(a: boolean): void {
      active = a;
    },

    setDead(d: boolean): void {
      dead = d;
      if (d) {
        clip = null;
        clipT = 0;
      }
    },

    dispose(): void {
      detachAll(group);
      pool.dispose();
      orbits.length = 0;
    },
  };
}

/* ================================================================== *
 * 6. 元素特效层（对象池，全部 THREE.Points / 加法混合面片）
 * ================================================================== */

export interface FxLayer {
  group: THREE.Group;
  update(t: number, dt: number): void;
  burst(pos: THREE.Vector3, element: 'physical' | 'fire' | 'ice' | 'lightning' | 'earth' | 'light' | 'dark', scale: number): void;
  ring(pos: THREE.Vector3, color: number, scale: number): void;
  /** 金色完美格挡环 */
  perfectRing(pos: THREE.Vector3): void;
  dispose(): void;
}

/** 元素 → [主色, 副色, 形态编号, 时长秒] */
const ELEMENTS: Record<string, [number, number, number, number]> = {
  physical: [0xffe6c0, 0xc08a50, 0, 0.42],
  fire: [0xffb02a, 0xd62a12, 1, 0.62],
  ice: [0x9adcff, 0x4a7ad6, 2, 0.7],
  lightning: [0xfff2a0, 0x8a6cff, 3, 0.34],
  earth: [0xc8a06a, 0x5a3a22, 4, 0.72],
  light: [0xfff6d8, 0xffc24a, 5, 0.6],
  dark: [0xb06cff, 0x2a1040, 6, 0.68],
};

export function createFxLayer(): FxLayer {
  const pool = new Pool();
  const group = new THREE.Group();
  group.name = 'fx';
  const glowTex = pool.tex(createRadialGlowTexture(64, 2.0));
  const fleckTex = pool.tex(createFleckTexture(64, 2024));
  const ringTex = pool.tex(createRingTexture(256, 0.14));

  // ---- 爆发粒子槽 ----
  const SLOTS = 14;
  const COUNT = 56;
  // 三套随机方向几何体轮换使用，避免每次 burst 都新建
  const geos: THREE.BufferGeometry[] = [];
  for (let g = 0; g < 3; g++) {
    const rng = rngFrom(5000 + g * 37);
    const dir = new Float32Array(COUNT * 3);
    const pos = new Float32Array(COUNT * 3);
    const seed = new Float32Array(COUNT);
    const scale = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      const th = rng() * Math.PI * 2;
      const ph = Math.acos(2 * rng() - 1);
      dir[i * 3] = Math.sin(ph) * Math.cos(th);
      dir[i * 3 + 1] = Math.cos(ph);
      dir[i * 3 + 2] = Math.sin(ph) * Math.sin(th);
      seed[i] = rng();
      scale[i] = 0.5 + rng() * 1.3;
    }
    const geo = pool.geo(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 6);
    geos.push(geo);
  }

  const burstVert = [
    'attribute vec3 aDir;',
    'attribute float aSeed;',
    'attribute float aScale;',
    'uniform float uProgress;',
    'uniform float uScale;',
    'uniform float uForm;',
    'uniform float uSize;',
    'varying float vSeed;',
    'varying float vFade;',
    'void main(){',
    '  vSeed = aSeed;',
    '  float p = clamp(uProgress, 0.0, 1.0);',
    '  float ease = 1.0 - pow(1.0 - p, 2.6);',
    '  vec3 dir = aDir;',
    '  float r = uScale * ease * mix(0.7, 1.5, aSeed);',
    '  vec3 q = dir * r;',
    '  float sz = 1.0;',
    // 0 物理：短促火星 + 重力下坠
    '  if (uForm < 0.5) {',
    '    q = dir * r * 0.6; q.y -= p * p * uScale * 0.9; sz = 1.0 - p * 0.4;',
    // 1 火：上升蘑菇云，越高越收
    '  } else if (uForm < 1.5) {',
    '    q = dir * r * vec3(0.75, 0.4, 0.75); q.y += ease * uScale * 1.5 * mix(0.6, 1.4, aSeed);',
    '    q.xz *= 1.0 - p * 0.35; sz = 1.2 - p * 0.5;',
    // 2 冰：沿方向拉长的棱刺，缓慢外张
    '  } else if (uForm < 2.5) {',
    '    float sp = pow(p, 0.7);',
    '    q = dir * uScale * sp * mix(0.8, 1.8, aSeed);',
    '    q.y += sp * uScale * 0.35; sz = 1.1 - p * 0.75;',
    // 3 雷：瞬间炸开 + 高频抖动
    '  } else if (uForm < 3.5) {',
    '    float sp = pow(p, 0.35);',
    '    q = dir * uScale * sp * 1.4;',
    '    q += dir.zxy * sin(p * 60.0 + aSeed * 30.0) * uScale * 0.14;',
    '    sz = 1.3 - p * 0.9;',
    // 4 土：低矮宽铺 + 抛物线落石
    '  } else if (uForm < 4.5) {',
    '    q = dir * r * vec3(1.35, 0.25, 1.35);',
    '    q.y += (p * 1.6 - p * p * 3.2) * uScale * 0.55 + 0.05;',
    '    sz = 1.2 - p * 0.4;',
    // 5 光：球面扩张 + 向上光柱
    '  } else if (uForm < 5.5) {',
    '    q = dir * r * 1.15;',
    '    q.y += ease * uScale * 0.9 * step(0.55, aSeed);',
    '    sz = 1.15 - p * 0.65;',
    // 6 暗：由外向内塌缩 + 旋涡
    '  } else {',
    '    float inv = 1.0 - ease;',
    '    float a = p * 6.0 + aSeed * 6.28;',
    '    q = vec3(dir.x * cos(a) - dir.z * sin(a), dir.y, dir.x * sin(a) + dir.z * cos(a)) * uScale * (0.25 + inv * 1.25);',
    '    sz = 0.9 + p * 0.5;',
    '  }',
    '  vFade = sz;',
    '  vec4 mv = modelViewMatrix * vec4(q, 1.0);',
    // 透视缩放系数 1.8：使爆发粒子在 4~10m 处约 4~12px（原 200.0 会让单颗粒子铺满半屏）
    '  gl_PointSize = clamp(uSize * aScale * max(0.1, sz) * (1.8 / max(0.6, -mv.z)), 1.0, 22.0);',
    '  gl_Position = projectionMatrix * mv;',
    '}',
  ].join('\n');

  const burstFrag = [
    'uniform vec3 uColorA;',
    'uniform vec3 uColorB;',
    'uniform float uOpacity;',
    'uniform float uProgress;',
    'uniform sampler2D uMap;',
    'varying float vSeed;',
    'varying float vFade;',
    'void main(){',
    '  float a = texture2D(uMap, gl_PointCoord).r;',
    '  float life = pow(1.0 - clamp(uProgress, 0.0, 1.0), 1.4);',
    '  float al = a * life * uOpacity * max(0.0, vFade);',
    '  if (al < 0.01) discard;',
    '  vec3 c = mix(uColorA, uColorB, fract(vSeed * 5.31));',
    '  gl_FragColor = vec4(c * (1.0 + life * 0.8), al);',
    '}',
  ].join('\n');

  interface BurstSlot {
    points: THREE.Points;
    u: {
      uProgress: THREE.IUniform<number>;
      uScale: THREE.IUniform<number>;
      uForm: THREE.IUniform<number>;
      uSize: THREE.IUniform<number>;
      uOpacity: THREE.IUniform<number>;
      uColorA: THREE.IUniform<THREE.Color>;
      uColorB: THREE.IUniform<THREE.Color>;
    };
    active: boolean;
    life: number;
    dur: number;
  }

  const bursts: BurstSlot[] = [];
  for (let i = 0; i < SLOTS; i++) {
    const u = {
      uProgress: { value: 0 } as THREE.IUniform<number>,
      uScale: { value: 1 } as THREE.IUniform<number>,
      uForm: { value: 0 } as THREE.IUniform<number>,
      uSize: { value: 26 } as THREE.IUniform<number>,
      uOpacity: { value: 1 } as THREE.IUniform<number>,
      uColorA: { value: new THREE.Color(0xffffff) } as THREE.IUniform<THREE.Color>,
      uColorB: { value: new THREE.Color(0xffaa44) } as THREE.IUniform<THREE.Color>,
    };
    const uniforms: Record<string, THREE.IUniform> = {
      uProgress: u.uProgress,
      uScale: u.uScale,
      uForm: u.uForm,
      uSize: u.uSize,
      uOpacity: u.uOpacity,
      uColorA: u.uColorA,
      uColorB: u.uColorB,
      uMap: { value: i % 2 === 0 ? glowTex : fleckTex },
    };
    const mat = pool.mat(
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: burstVert,
        fragmentShader: burstFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    const pts = new THREE.Points(geos[i % geos.length], mat);
    pts.frustumCulled = false;
    pts.visible = false;
    group.add(pts);
    bursts.push({ points: pts, u, active: false, life: 0, dur: 0.5 });
  }

  // ---- 冲击环槽（加法混合面片 + 环形贴图） ----
  interface RingSlot {
    mesh: THREE.Mesh;
    glow: GlowHandle;
    active: boolean;
    life: number;
    dur: number;
    from: number;
    to: number;
    tilt: boolean;
  }
  const RINGS = 10;
  const ringGeo = pool.geo(new THREE.PlaneGeometry(1, 1));
  const rings: RingSlot[] = [];
  for (let i = 0; i < RINGS; i++) {
    const glow = makeGlow(pool, 0xffffff, ringTex, 0);
    const m = new THREE.Mesh(ringGeo, glow.mat);
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    group.add(m);
    rings.push({ mesh: m, glow, active: false, life: 0, dur: 0.5, from: 0.2, to: 3, tilt: false });
  }

  const takeBurst = (): BurstSlot => {
    for (let i = 0; i < bursts.length; i++) if (!bursts[i].active) return bursts[i];
    // 全忙时抢占进度最深的那个
    let best = bursts[0];
    for (let i = 1; i < bursts.length; i++) if (bursts[i].life / bursts[i].dur > best.life / best.dur) best = bursts[i];
    return best;
  };
  const takeRing = (): RingSlot => {
    for (let i = 0; i < rings.length; i++) if (!rings[i].active) return rings[i];
    let best = rings[0];
    for (let i = 1; i < rings.length; i++) if (rings[i].life / rings[i].dur > best.life / best.dur) best = rings[i];
    return best;
  };

  const spawnRing = (pos: THREE.Vector3, color: number, scale: number, dur: number, tilt: boolean): void => {
    const s = takeRing();
    s.active = true;
    s.life = 0;
    s.dur = dur;
    s.from = scale * 0.25;
    s.to = scale * 2.4;
    s.tilt = tilt;
    s.mesh.visible = true;
    s.mesh.position.copy(pos);
    s.mesh.position.y += 0.03;
    s.mesh.rotation.set(tilt ? -Math.PI / 2 + 0.35 : -Math.PI / 2, 0, 0);
    s.mesh.scale.setScalar(s.from);
    s.glow.uColor.value.setHex(color);
    s.glow.uOpacity.value = 1;
    s.glow.uPulse.value = 1.4;
  };

  return {
    group,

    update(t: number, dt: number): void {
      const d = clamp(dt, 0, 0.1);
      for (let i = 0; i < bursts.length; i++) {
        const b = bursts[i];
        if (!b.active) continue;
        b.life += d;
        const p = b.life / b.dur;
        if (p >= 1) {
          b.active = false;
          b.points.visible = false;
          b.u.uProgress.value = 0;
          continue;
        }
        b.u.uProgress.value = p;
      }
      for (let i = 0; i < rings.length; i++) {
        const r = rings[i];
        if (!r.active) continue;
        r.life += d;
        const p = r.life / r.dur;
        if (p >= 1) {
          r.active = false;
          r.mesh.visible = false;
          r.glow.uOpacity.value = 0;
          continue;
        }
        const e = 1 - Math.pow(1 - p, 2.4);
        r.mesh.scale.setScalar(lerp(r.from, r.to, e));
        r.glow.uOpacity.value = Math.pow(1 - p, 1.5);
        r.glow.uPulse.value = 0.5 + 1.2 * (1 - p);
      }
    },

    burst(pos: THREE.Vector3, element, scale: number): void {
      const e = ELEMENTS[element] ?? ELEMENTS.physical;
      const s = takeBurst();
      s.active = true;
      s.life = 0;
      s.dur = e[3];
      s.points.visible = true;
      s.points.position.copy(pos);
      s.points.rotation.y = (pos.x * 7.13 + pos.z * 3.71) % 6.283;
      s.u.uProgress.value = 0;
      s.u.uScale.value = Math.max(0.05, scale);
      s.u.uForm.value = e[2];
      s.u.uOpacity.value = 1;
      s.u.uSize.value = element === 'ice' ? 20 : element === 'earth' ? 30 : 26;
      s.u.uColorA.value.setHex(e[0]);
      s.u.uColorB.value.setHex(e[1]);
      // 火/土/光额外补一圈地面冲击环
      if (element === 'fire' || element === 'earth' || element === 'light') {
        spawnRing(pos, e[0], scale * 0.9, 0.5, false);
      }
    },

    ring(pos: THREE.Vector3, color: number, scale: number): void {
      spawnRing(pos, color, scale, 0.55, false);
    },

    perfectRing(pos: THREE.Vector3): void {
      // 金色双环 + 一小簇金色光粒
      spawnRing(pos, 0xffd24a, 1.25, 0.42, false);
      spawnRing(pos, 0xfff2c0, 0.8, 0.6, true);
      const s = takeBurst();
      s.active = true;
      s.life = 0;
      s.dur = 0.45;
      s.points.visible = true;
      s.points.position.copy(pos);
      s.u.uProgress.value = 0;
      s.u.uScale.value = 0.9;
      s.u.uForm.value = 5;
      s.u.uOpacity.value = 1;
      s.u.uSize.value = 22;
      s.u.uColorA.value.setHex(0xfff8dc);
      s.u.uColorB.value.setHex(0xffc24a);
    },

    dispose(): void {
      detachAll(group);
      pool.dispose();
      bursts.length = 0;
      rings.length = 0;
    },
  };
}

/* ================================================================== *
 * 7. 灯光：Boss 后上方暖金逆光 + 角色冷色轮廓光 + 环境暖棕雾
 * ================================================================== */

export function createLighting(scene: THREE.Scene): {
  update(t: number, dt: number): void;
  setPhase(phase: number): void;
  dispose(): void;
} {
  const prevFog = scene.fog;
  const prevBg = scene.background;

  // 环境底光（暖棕）
  const ambient = new THREE.AmbientLight(0x4a3524, 0.55);
  const hemi = new THREE.HemisphereLight(0x6b5038, 0x120e0a, 0.6);
  // Boss 后上方暖金逆光（主光）
  const keyLight = new THREE.DirectionalLight(0xffc878, 2.5);
  keyLight.position.set(2.2, 7.2, -7.0);
  keyLight.target.position.set(0, 1.4, 0);
  // 角色侧冷色轮廓光
  const coolRim = new THREE.DirectionalLight(0x8ab4ff, 0.95);
  coolRim.position.set(-5.5, 3.2, 5.5);
  coolRim.target.position.set(0, 1.0, 1.5);
  // 紫色副光（多色调）
  const violetRim = new THREE.DirectionalLight(0xa066ff, 0.6);
  violetRim.position.set(6.0, 2.6, 2.0);
  violetRim.target.position.set(0, 1.2, 0);
  // 地面裂缝的血红补光
  const bloodFill = new THREE.PointLight(0xd6203a, 5.5, 16, 2);
  bloodFill.position.set(0, 0.5, -2.2);

  scene.add(ambient, hemi, keyLight, keyLight.target, coolRim, coolRim.target, violetRim, violetRim.target, bloodFill);

  // 环境暖棕雾
  const fog = new THREE.FogExp2(0x3a2a1c, 0.028);
  scene.fog = fog;
  if (!scene.background) scene.background = new THREE.Color(0x1c1410);

  let phase = 1;
  let keyBase = 2.5;
  let violetBase = 0.6;
  let bloodBase = 5.5;
  let fogBase = 0.028;

  return {
    update(t: number, dt: number): void {
      // 逆光轻微摇曳（像被烟尘遮挡），血红补光随裂缝呼吸
      const flick = 0.92 + 0.08 * Math.sin(t * 2.3) + 0.05 * Math.sin(t * 7.7 + 1.1);
      keyLight.intensity = keyBase * flick;
      bloodFill.intensity = bloodBase * (0.8 + 0.35 * Math.sin(t * 1.4) + 0.12 * Math.sin(t * 5.1));
      violetRim.intensity = violetBase * (0.85 + 0.15 * Math.sin(t * 0.9 + 2));
      // 紫光缓慢绕场，制造多色调流动
      const a = t * 0.18;
      violetRim.position.set(Math.cos(a) * 6.5, 2.6 + Math.sin(a * 1.3) * 0.8, Math.sin(a) * 4.5);
      fog.density = fogBase * (0.96 + 0.06 * Math.sin(t * 0.6));
    },
    setPhase(p: number): void {
      phase = clamp(Math.round(p), 1, 3);
      if (phase === 1) {
        keyBase = 2.5;
        keyLight.color.setHex(0xffc878);
        violetBase = 0.55;
        bloodBase = 5.0;
        fogBase = 0.028;
        ambient.intensity = 0.55;
        hemi.color.setHex(0x6b5038);
        coolRim.intensity = 0.95;
      } else if (phase === 2) {
        keyBase = 2.2;
        keyLight.color.setHex(0xffb45a);
        violetBase = 1.15;
        bloodBase = 7.0;
        fogBase = 0.033;
        ambient.intensity = 0.45;
        hemi.color.setHex(0x5a3a52);
        coolRim.intensity = 0.8;
      } else {
        keyBase = 1.9;
        keyLight.color.setHex(0xff8a48);
        violetBase = 1.5;
        bloodBase = 10.0;
        fogBase = 0.04;
        ambient.intensity = 0.35;
        hemi.color.setHex(0x5a2030);
        coolRim.intensity = 0.6;
      }
      scene.background = new THREE.Color(phase === 3 ? 0x2a0e12 : phase === 2 ? 0x22141c : 0x1c1410);
    },
    dispose(): void {
      for (const o of [ambient, hemi, keyLight, keyLight.target, coolRim, coolRim.target, violetRim, violetRim.target, bloodFill]) {
        if (o.parent) o.parent.remove(o);
      }
      ambient.dispose();
      hemi.dispose();
      keyLight.dispose();
      coolRim.dispose();
      violetRim.dispose();
      bloodFill.dispose();
      scene.fog = prevFog;
      scene.background = prevBg;
    },
  };
}


