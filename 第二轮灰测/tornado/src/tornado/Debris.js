/**
 * Debris.js — 两级碎片系统。
 *
 *  DebrisPool  ：参与物理的实体碎片（木板/砖块/铁皮/圆木），InstancedMesh 批量渲染，
 *                由建筑破坏、船只解体产生，被风场吸入涡旋并抛出。
 *  DebrisSwarm ：纯 GPU 的细小碎屑/尘粒（数千个），顶点着色器里用与体积着色器
 *                完全相同的 Rankine 涡旋公式做轨迹，零 CPU 开销，负责"密度感"。
 */
import * as THREE from 'three';
import { P } from '../core/Params.js';
import { Body } from '../core/MiniPhysics.js';

const _m = new THREE.Matrix4();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

export class DebrisPool {
  /** @param {import('../core/MiniPhysics.js').PhysicsWorld} world */
  constructor(world, lighting, max = 900) {
    this.world = world;
    this.max = max;

    const matBox = new THREE.MeshStandardMaterial({
      roughness: 0.82, metalness: 0.04, vertexColors: false, flatShading: true,
    });
    const matCyl = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0.06, flatShading: true });
    lighting.patchFog(matBox); lighting.patchFog(matCyl);

    this.imBox = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), matBox, max);
    const cylMax = Math.max(16, Math.floor(max / 3));
    this.imCyl = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 7, 1), matCyl, cylMax);
    for (const [im, n] of [[this.imBox, max], [this.imCyl, cylMax]]) {
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(0.5), 3);
      im.instanceColor.setUsage(THREE.DynamicDrawUsage);
      im.frustumCulled = false;
      im.castShadow = true;
      im.receiveShadow = true;
      im.count = 0;
    }
    this.group = new THREE.Group();
    this.group.name = 'debris';
    this.group.add(this.imBox, this.imCyl);
  }

  /** 生成一块碎片 */
  spawn(pos, size, opts = {}) {
    const b = new Body({
      pos, size,
      vel: opts.vel,
      quat: opts.quat,
      density: opts.density ?? 420,
      cd: opts.cd ?? 1.3,
      kind: opts.kind ?? 0,
      color: opts.color ?? new THREE.Color(0.55, 0.48, 0.4),
      life: opts.life ?? 0,
      buoyant: opts.buoyant ?? false,
    });
    this.world.add(b);
    return b;
  }

  update() {
    let nb = 0, nc = 0;
    const maxB = this.imBox.instanceMatrix.count;
    const maxC = this.imCyl.instanceMatrix.count;
    for (const b of this.world.bodies) {
      if (b.external) continue;      // 建筑零件由 DestructionSystem 自己渲染
      const cyl = b.kind === 1;
      if (cyl ? nc >= maxC : nb >= maxB) continue;
      _s.set(b.size.x * 2, b.size.y * 2, b.size.z * 2);
      _m.compose(b.pos, b.quat, _s);
      if (cyl) {
        this.imCyl.setMatrixAt(nc, _m);
        this.imCyl.instanceColor.setXYZ(nc, b.color.r, b.color.g, b.color.b);
        nc++;
      } else {
        this.imBox.setMatrixAt(nb, _m);
        this.imBox.instanceColor.setXYZ(nb, b.color.r, b.color.g, b.color.b);
        nb++;
      }
    }
    this.imBox.count = nb;
    this.imCyl.count = nc;
    if (nb) { this.imBox.instanceMatrix.needsUpdate = true; this.imBox.instanceColor.needsUpdate = true; }
    if (nc) { this.imCyl.instanceMatrix.needsUpdate = true; this.imCyl.instanceColor.needsUpdate = true; }
  }

  dispose() {
    this.imBox.geometry.dispose(); this.imBox.material.dispose();
    this.imCyl.geometry.dispose(); this.imCyl.material.dispose();
  }
}

/* ============================================================ */

const SWARM_VERT = /* glsl */`
attribute vec4 aSeed;      // x: 半径系数 y: 初始高度 z: 相位 w: 尺寸
attribute float aKind;     // 0..1 尘粒/叶片/亮碎屑
uniform float uTime, uHeight, uBaseR, uTopR, uProfile, uOmega, uDiff, uHelix;
uniform vec3  uPos;
uniform vec2  uTiltDir;
uniform float uTilt, uWobble, uWobSpeed, uRise, uCount, uAmount, uPixelScale, uDustHeight;
varying float vFade;
varying float vKind;
varying float vSpeed;

vec2 spineOffset(float t){
  vec2 o = uTiltDir * (uTilt * uHeight * t);
  float w = uWobble;
  o += vec2(sin(uTime*uWobSpeed*1.00 + t*3.4), cos(uTime*uWobSpeed*0.83 + t*2.7)) * (w * 26.0 * t*t);
  o += vec2(sin(uTime*uWobSpeed*0.41 + t*1.3), cos(uTime*uWobSpeed*0.37 - t*1.1)) * (w * 44.0 * t);
  return o;
}
float radiusAt(float t){
  float neck = 1.0 - 0.22*exp(-t*26.0);
  float r = uBaseR*neck + (uTopR - uBaseR) * pow(clamp(t,0.0,1.0), uProfile);
  r *= 1.0 + 0.06*sin(uTime*0.37 + t*5.1) + 0.04*sin(uTime*0.19 - t*2.3);
  return max(r, 0.6);
}
float angVel(float r, float rc){
  float x = max(r, 0.05)/max(rc, 0.6);
  float w = (x < 1.0) ? 1.0 : 1.0/(x*x);
  return uOmega * mix(1.0, w, uDiff);
}

void main(){
  vKind = aKind;
  /* 生命周期：沿高度循环上升，越高越靠近轴心 */
  float speed = uRise * (0.35 + 0.9*aSeed.x);
  float t = fract(aSeed.y + uTime * speed * 0.028);
  /* 只显示 uAmount 比例的粒子 */
  float idx = aSeed.z;
  if(idx > uAmount){ gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vFade = 0.0; return; }

  float R = radiusAt(t);
  /* 起始在尘裙外侧，被吸入后贴着涡壁上升 */
  float conv = smoothstep(0.0, 0.28, t);
  float r = mix(R*(1.6 + 2.6*aSeed.x), R*(0.82 + 0.5*aSeed.x), conv);
  float rc = R*0.92;
  float ang = aSeed.z*6.2831853 + angVel(r, rc)*uTime - t*uHeight*uHelix;
  vec2 sp = spineOffset(t);
  vec3 wp = vec3(uPos.x + sp.x + cos(ang)*r, uPos.y + t*uHeight, uPos.z + sp.y + sin(ang)*r);

  /* 淡入淡出 */
  vFade = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.78, 1.0, t));
  vSpeed = angVel(r, rc) * r;

  vec4 mv = viewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mv;
  float sz = aSeed.w * (0.7 + 1.5*aKind);
  gl_PointSize = clamp(sz * uPixelScale / max(-mv.z, 1.0) * 60.0, 1.0, 22.0);
}
`;

const SWARM_FRAG = /* glsl */`
uniform vec3 uDustColor, uSunColor, uAmbient;
uniform float uFlash, uOpacity;
varying float vFade;
varying float vKind;
varying float vSpeed;
void main(){
  vec2 q = gl_PointCoord*2.0 - 1.0;
  float d = dot(q,q);
  if(d > 1.0) discard;
  float a = (1.0 - d) * vFade * uOpacity;
  vec3 col = mix(uDustColor, vec3(0.72,0.68,0.6), vKind*0.75);
  col = col * (uAmbient*0.9 + uSunColor*0.55) + vec3(0.5,0.55,0.7)*uFlash*0.5;
  /* 高速碎屑略微拉亮，读出"被甩出去"的速度感 */
  col *= 1.0 + clamp(vSpeed*0.004, 0.0, 0.8);
  gl_FragColor = vec4(col, a * (0.35 + 0.65*vKind));
}
`;

export class DebrisSwarm {
  constructor(lighting, count = 9000) {
    this.count = count;
    const seed = new Float32Array(count * 4);
    const kind = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      seed[i * 4 + 0] = Math.random();
      seed[i * 4 + 1] = Math.random();
      seed[i * 4 + 2] = Math.random();
      seed[i * 4 + 3] = 0.28 + Math.random() * 1.5;
      kind[i] = Math.random() < 0.18 ? Math.random() : Math.random() * 0.25;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    g.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    const L = lighting.uniforms;
    this.material = new THREE.ShaderMaterial({
      vertexShader: SWARM_VERT,
      fragmentShader: SWARM_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uTime: { value: 0 }, uHeight: { value: 780 }, uBaseR: { value: 24 }, uTopR: { value: 170 },
        uProfile: { value: 1.75 }, uOmega: { value: 3.5 }, uDiff: { value: 0.95 }, uHelix: { value: 0.004 },
        uPos: { value: new THREE.Vector3() }, uTiltDir: { value: new THREE.Vector2(1, 0) },
        uTilt: { value: 0.12 }, uWobble: { value: 0.42 }, uWobSpeed: { value: 0.45 },
        uRise: { value: 1.0 }, uCount: { value: count }, uAmount: { value: 1 },
        uPixelScale: { value: 1 }, uDustHeight: { value: 70 },
        uDustColor: { value: new THREE.Color(0.44, 0.36, 0.27) },
        uOpacity: { value: 0.85 },
        uSunColor: L.uSunColor, uAmbient: L.uAmbient, uFlash: L.uFlash,
      },
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.name = 'debrisSwarm';
    this.points.renderOrder = 5;
  }

  update(tornado, engine) {
    const u = this.material.uniforms;
    u.uTime.value = engine.time;
    u.uHeight.value = tornado.height;
    u.uBaseR.value = tornado.baseRadius;
    u.uTopR.value = tornado.topRadius;
    u.uProfile.value = tornado.profile;
    u.uOmega.value = tornado.omega;
    u.uDiff.value = P.get('t_diff');
    u.uHelix.value = 0.0035 + 0.004 * P.get('t_diff');
    u.uPos.value.copy(tornado.position);
    u.uTiltDir.value.copy(tornado.tiltDir);
    u.uTilt.value = tornado.tiltTan;
    u.uWobble.value = tornado.wobble;
    u.uWobSpeed.value = tornado.wobSpeed;
    u.uRise.value = 0.5 + P.get('t_updraft') * 1.4;
    u.uAmount.value = Math.min(1, P.get('t_debris') * 0.62) * (P.get('t_visible') ? 1 : 0);
    u.uDustColor.value.copy(tornado.dustColor);
    u.uPixelScale.value = engine.size.y / 900;
    u.uDustHeight.value = tornado.dustHeight;
  }

  dispose() { this.points.geometry.dispose(); this.material.dispose(); }
}
