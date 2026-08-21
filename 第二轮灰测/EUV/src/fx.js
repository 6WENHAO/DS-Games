/**
 * fx.js — 物理过程可视化（等离子体 / EUV 光线 / 锡滴 / 曝光）
 * ==================================================================
 * 规格书 §1.2：不可见光与等离子体允许艺术化着色与夸张表现，
 * 但必须标注「示意 / Simulation」——本模块产生的所有发光元素
 * 在 HUD 中一律带常驻角标，且夸张倍率在 EXAGGERATION 中集中声明。
 *
 * 关键：EUV 收集光线不是美术曲线，而是对 layout.reflectOffCollector()
 * 的真实采样 —— 每条光线自等离子体出射、在椭球面反射、精确汇聚于
 * 中间焦点。几何正确性由 test/checks.js 断言。
 */

import * as THREE from 'three';
import {
  PLASMA, IF_POINT, COLLECTOR_APERTURE, COLLECTOR_VERTEX, DROPLET_NOZZLE, DROPLET_CATCHER,
  LASER_ORIGIN, MASK, WAFER, PURITY, CHAIN, CHAIN_BY_KEY, ELLIPSOID,
  reflectOffCollector, collectorPoint, patternScaleAt, mirrorRadius, mm, MM_PER_UNIT, vec,
} from './layout.js';
import { PARAMS } from './params.js';
import { BRAND } from './config.js';
import { glowSprite, srgb, chipLayout } from './materials.js';
import { V3, arcSlitShape } from './geom.js';

const C = BRAND.colors;
const { sub, add, scale, len, norm } = vec;

/**
 * 夸张倍率集中声明 —— HUD 会读取此表生成「示意」说明，
 * 保证观众不会把夸张表现误认为真实影像（§1.2）。
 */
/**
 * fx 控制量的默认值 —— 渲染与校验共用同一份，避免「代码默认 1 / 校验假设 0」这类误报。
 * 未在时间轴中声明的通道即取此表的值。
 */
export const FX_DEFAULTS = {
  // 机器状态（由 script.js 的 AMBIENT 包络接管）
  dropletFlow: 0, dropletSpeed: 1, laserUpstream: 0, plasma: 0, gas: 0,
  euvHead: 0, euvSteady: 0, spray: 0, spraySteady: 0, collected: 0,
  beamHead: 0, beamIntensity: 0, housing: 0, letterbox: 0,
  maskGlow: 0, slit: 0, field: 0,
  latent: 0, develop: 0, chips: 0, resist: 1,
  // 戏剧性瞬时量
  flash: 0, shake: 0, fade: 0, prePulse: 0, mainPulse: 0,
  heroPos: -1, heroVisible: 1, pancake: 0,
  scan: -1, scanPhase: 0,
  // HUD 图版
  incidenceCallout: 0, angleCallout: 0, demagCallout: 0, pathOverview: 0,
  debrisHighlight: 0, irReject: 0,
};

export const EXAGGERATION = {
  dropletRadius: { real: 13.5e-3, shown: 0.20, unitZh: 'mm 半径', factorZh: '锡滴直径放大约 490×' },
  timeScale: { factorZh: '时间放缓约 10⁶×（单次脉冲实际约 20 µs）' },
  collectorHole: { factorZh: '集光镜中心孔经放大以便观察' },
  euvColor: { factorZh: '13.5 nm 人眼不可见，颜色为艺术化着色' },
  irColor: { factorZh: '10.6 µm CO₂ 红外激光人眼不可见，颜色为艺术化着色' },
  machineScale: { factorZh: '整机纵向尺度经压缩，非等比' },
};

// ═══════════════════════════════════════════════════════════════════
// 共享着色器片段
// ═══════════════════════════════════════════════════════════════════
const BEAM_VERT = /* glsl */`
  attribute float aArc;      // 该顶点沿光路的归一化弧长
  attribute float aEdge;     // 0 = 轴心, 1 = 束边缘
  varying float vArc;
  varying float vEdge;
  varying vec3 vView;
  void main() {
    vArc = aArc; vEdge = aEdge;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const BEAM_FRAG = /* glsl */`
  uniform vec3  uColor;
  uniform vec3  uCoreColor;
  uniform float uTime;
  uniform float uHead;       // 光波前已推进到的弧长位置 (0..1)
  uniform float uSoft;       // 波前软边宽度
  uniform float uIntensity;
  uniform float uFlicker;
  varying float vArc;
  varying float vEdge;
  varying vec3  vView;

  void main() {
    // 插值后的属性可能微越界（1.0000001），必须钳制：
    // GLSL 的 pow(负数, 非整数) 为未定义 → NaN，而 NaN 会经 Bloom 模糊扩散到整帧变黑。
    // 这是本项目实测到的真实缺陷，此处为其修复点。
    float edge = clamp(vEdge, 0.0, 1.0);
    float arc  = clamp(vArc, 0.0, 1.0);

    // 波前：只显示已被光走过的部分
    float lead = smoothstep(uHead + uSoft, uHead - uSoft * 0.15, arc);
    if (lead <= 0.001) discard;

    // 径向能量分布（高斯芯 + 柔边）
    float radial = exp(-edge * edge * 3.4);
    float rim    = pow(max(0.0, 1.0 - edge), 1.6);

    // 沿轴向的能量脉动（脉冲式光源的可视化表达）
    float pulse = 0.62 + 0.38 * sin((arc * 46.0) - uTime * 7.0);
    float shimmer = 0.90 + 0.10 * sin(arc * 180.0 + uTime * 23.0);

    vec3 col = mix(uColor, uCoreColor, radial * radial);
    float a = lead * uIntensity * uFlicker * (radial * 0.85 + rim * 0.35) * pulse * shimmer;
    a = clamp(a, 0.0, 8.0);
    if (!(a == a)) discard;                       // NaN 兜底
    gl_FragColor = vec4(col * a, a);
  }
`;

const RAY_VERT = /* glsl */`
  attribute float aArc;
  attribute float aSeed;
  varying float vArc;
  varying float vSeed;
  void main() {
    vArc = aArc; vSeed = aSeed;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const RAY_FRAG = /* glsl */`
  uniform vec3  uColor;
  uniform float uTime;
  uniform float uHead;
  uniform float uWidth;     // 行进波包宽度
  uniform float uIntensity;
  uniform float uSteady;    // 稳态亮度（0 = 仅波包, 1 = 全程点亮）
  varying float vArc;
  varying float vSeed;
  void main() {
    float head = uHead + vSeed * 0.06;
    float arc = clamp(vArc, 0.0, 1.0);
    float d = head - arc;
    float q = max(0.0, d) / max(1e-4, uWidth);
    float packet = exp(-min(64.0, q * q)) * step(0.0, d);
    float steady = uSteady * step(arc, head);
    float a = clamp(packet + steady * 0.20, 0.0, 1.0) * uIntensity;
    a *= 0.55 + 0.45 * sin(vSeed * 37.0 + uTime * 11.0);
    a = clamp(a, 0.0, 8.0);
    if (!(a == a) || a < 0.004) discard;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

const PLASMA_FRAG = /* glsl */`
  uniform vec3  uCore;
  uniform vec3  uEdge;
  uniform float uTime;
  uniform float uIntensity;
  varying vec3 vNormalV;
  varying vec3 vViewV;
  void main() {
    float f = clamp(1.0 - abs(dot(normalize(vNormalV), normalize(vViewV))), 0.0, 1.0);
    float shell = pow(max(0.0, f), 2.1);
    float boil = 0.86 + 0.14 * sin(uTime * 41.0 + vNormalV.x * 9.0 + vNormalV.y * 7.0);
    vec3 col = mix(uCore, uEdge, shell);
    float a = clamp((shell * 0.92 + 0.16) * uIntensity * boil, 0.0, 8.0);
    if (!(a == a)) discard;
    gl_FragColor = vec4(col * a, a);
  }
`;
const PLASMA_VERT = /* glsl */`
  varying vec3 vNormalV;
  varying vec3 vViewV;
  void main() {
    vNormalV = normalMatrix * normal;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewV = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

function addMat(uniforms, vs, fs, { depthWrite = false } = {}) {
  return new THREE.ShaderMaterial({
    uniforms, vertexShader: vs, fragmentShader: fs,
    transparent: true, blending: THREE.AdditiveBlending,
    depthWrite, depthTest: true, side: THREE.DoubleSide, toneMapped: true,
  });
}

/** 锥形/柱形光束几何：沿 from→to 生成带 aArc / aEdge 属性的管 */
function taperedTube(from, to, r0, r1, radial = 28, arc0 = 0, arc1 = 1, lengthSeg = 8) {
  const a = V3(from), b = V3(to);
  const axis = b.clone().sub(a);
  const L = axis.length();
  const dir = axis.clone().normalize();
  const up = Math.abs(dir.y) > 0.94 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const ex = new THREE.Vector3().crossVectors(up, dir).normalize();
  const ey = new THREE.Vector3().crossVectors(dir, ex).normalize();
  const pos = [], arcA = [], edgeA = [], idx = [];
  for (let i = 0; i <= lengthSeg; i++) {
    const t = i / lengthSeg;
    const c = a.clone().addScaledVector(dir, L * t);
    const r = r0 + (r1 - r0) * t;
    const arc = arc0 + (arc1 - arc0) * t;
    for (let j = 0; j <= radial; j++) {
      const ang = (j / radial) * Math.PI * 2;
      const p = c.clone().addScaledVector(ex, Math.cos(ang) * r).addScaledVector(ey, Math.sin(ang) * r);
      pos.push(p.x, p.y, p.z); arcA.push(arc); edgeA.push(1);
    }
    // 轴心顶点（用于中心高亮）
    pos.push(c.x, c.y, c.z); arcA.push(arc); edgeA.push(0);
  }
  const stride = radial + 2;
  for (let i = 0; i < lengthSeg; i++) {
    for (let j = 0; j < radial; j++) {
      const A = i * stride + j, B = A + 1, D = A + stride, E = D + 1;
      idx.push(A, D, B, B, D, E);
      // 中心扇面（让束芯更亮）
      const cA = i * stride + radial + 1, cB = (i + 1) * stride + radial + 1;
      idx.push(A, cA, B, D, E, cB);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aArc', new THREE.Float32BufferAttribute(arcA, 1));
  g.setAttribute('aEdge', new THREE.Float32BufferAttribute(edgeA, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

// ═══════════════════════════════════════════════════════════════════
// 1. 光源模块 FX：锡滴流 / 预脉冲压扁 / 主脉冲等离子体 / CO₂ 激光 / 氢气
// ═══════════════════════════════════════════════════════════════════
export function buildSourceFX(scene, quality) {
  const g = new THREE.Group(); g.name = 'FX_SOURCE'; scene.add(g);
  const R = EXAGGERATION.dropletRadius.shown;
  const jetLen = DROPLET_NOZZLE.y - DROPLET_CATCHER.y;

  // —— 锡滴流（InstancedMesh，等间距高频序列）——
  const N = Math.max(24, Math.round(quality.dropletCount / 12));
  const dropGeo = new THREE.SphereGeometry(R, 20, 14);
  const dropMat = new THREE.MeshPhysicalMaterial({
    color: srgb(C.tin), metalness: 1.0, roughness: 0.08, envMapIntensity: 1.6,
  });
  const stream = new THREE.InstancedMesh(dropGeo, dropMat, N);
  stream.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  stream.frustumCulled = false;
  g.add(stream);

  // —— 主角锡滴（可形变：球 → 圆盘）——
  const heroGeo = new THREE.SphereGeometry(R, 48, 32);
  const hero = new THREE.Mesh(heroGeo, dropMat.clone());
  hero.position.set(PLASMA.x, PLASMA.y, PLASMA.z);
  g.add(hero);

  // —— 等离子体：核心 + 外壳 + 辉光 ——
  const plasmaU = {
    uCore: { value: srgb(C.plasma) }, uEdge: { value: srgb(C.accent) },
    uTime: { value: 0 }, uIntensity: { value: 0 },
  };
  const plasmaShell = new THREE.Mesh(new THREE.SphereGeometry(R * 3.4, 48, 32),
    addMat(plasmaU, PLASMA_VERT, PLASMA_FRAG));
  plasmaShell.position.copy(V3(PLASMA));
  const plasmaCore = new THREE.Mesh(new THREE.SphereGeometry(R * 1.15, 32, 24),
    new THREE.MeshBasicMaterial({ color: srgb('#ffffff'), transparent: true, opacity: 0 }));
  plasmaCore.position.copy(V3(PLASMA));
  const plasmaGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowSprite(256, 2.2), color: srgb(C.plasma), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
  }));
  plasmaGlow.position.copy(V3(PLASMA));
  plasmaGlow.scale.setScalar(R * 26);
  const plasmaLight = new THREE.PointLight(srgb(C.plasma), 0, 52, 2);
  plasmaLight.position.copy(V3(PLASMA));
  g.add(plasmaShell, plasmaCore, plasmaGlow, plasmaLight);

  // —— CO₂ 驱动激光（预脉冲 / 主脉冲各一束）——
  const mkLaser = (rEnd, color) => {
    const start = { x: COLLECTOR_VERTEX.x - 2.4, y: 0, z: 0 };
    const u = {
      uColor: { value: srgb(color) }, uCoreColor: { value: srgb('#fff3e0') },
      uTime: { value: 0 }, uHead: { value: 0 }, uSoft: { value: 0.05 },
      uIntensity: { value: 0 }, uFlicker: { value: 1 },
    };
    const mesh = new THREE.Mesh(taperedTube(start, PLASMA, 0.55, rEnd, 24, 0, 1, 10),
      addMat(u, BEAM_VERT, BEAM_FRAG));
    mesh.frustumCulled = false;
    g.add(mesh);
    return { mesh, u };
  };
  const prePulse = mkLaser(R * 0.9, '#ffb066');
  const mainPulse = mkLaser(R * 1.5, '#ff8a3c');

  // 激光链上游段（放大器 → 集光镜背后）
  const upstreamU = {
    uColor: { value: srgb('#ff9a4d') }, uCoreColor: { value: srgb('#fff1dc') },
    uTime: { value: 0 }, uHead: { value: 1 }, uSoft: { value: 0.02 },
    uIntensity: { value: 0 }, uFlicker: { value: 1 },
  };
  const upstream = new THREE.Mesh(
    taperedTube({ x: LASER_ORIGIN.x + 3, y: 0, z: 0 }, { x: COLLECTOR_VERTEX.x - 2.4, y: 0, z: 0 }, 0.42, 0.5, 16, 0, 1, 6),
    addMat(upstreamU, BEAM_VERT, BEAM_FRAG));
  upstream.frustumCulled = false;
  g.add(upstream);

  // —— 等离子体 4π 辐射（未被收集的部分）——
  const sprayCount = quality.plasmaRayCount;
  {
    const pos = [], arcA = [], seedA = [];
    for (let i = 0; i < sprayCount; i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const d = new THREE.Vector3(s * Math.cos(th), s * Math.sin(th), u);
      const L = 6 + Math.random() * 7;
      const p0 = V3(PLASMA), p1 = p0.clone().addScaledVector(d, L);
      pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
      arcA.push(0, 1); const sd = Math.random(); seedA.push(sd, sd);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aArc', new THREE.Float32BufferAttribute(arcA, 1));
    geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seedA, 1));
    var sprayU = {
      uColor: { value: srgb(C.accent) }, uTime: { value: 0 }, uHead: { value: 0 },
      uWidth: { value: 0.26 }, uIntensity: { value: 0 }, uSteady: { value: 0 },
    };
    var spray = new THREE.LineSegments(geo, addMat(sprayU, RAY_VERT, RAY_FRAG));
    spray.frustumCulled = false;
    g.add(spray);
  }

  // —— ★ 被集光镜收集的 EUV 光线：真实椭球反射，精确汇聚中间焦点 ——
  const collectedU = {
    uColor: { value: srgb(C.primary) }, uTime: { value: 0 }, uHead: { value: 0 },
    uWidth: { value: 0.20 }, uIntensity: { value: 0 }, uSteady: { value: 0 },
  };
  let collectedRayCount = 0;
  {
    const pos = [], arcA = [], seedA = [];
    const nPhi = Math.max(10, Math.round(quality.plasmaRayCount / 9));
    const nTheta = Math.max(14, Math.round(quality.plasmaRayCount / 6));
    for (let i = 0; i < nPhi; i++) {
      const phi = COLLECTOR_APERTURE.phiMin + (COLLECTOR_APERTURE.phiMax - COLLECTOR_APERTURE.phiMin) * ((i + 0.5) / nPhi);
      for (let j = 0; j < nTheta; j++) {
        const theta = ((j + 0.5) / nTheta) * Math.PI * 2;
        const r = reflectOffCollector(phi, theta);
        const p0 = V3(PLASMA), p1 = V3(r.hit), p2 = V3(IF_POINT);
        const l1 = p0.distanceTo(p1), l2 = p1.distanceTo(p2), tot = l1 + l2;
        const m = l1 / tot;
        // 段1：等离子体 → 镜面
        pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
        arcA.push(0, m);
        // 段2：镜面 → 中间焦点（几何精确）
        pos.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
        arcA.push(m, 1);
        const sd = Math.random();
        seedA.push(sd, sd, sd, sd);
        collectedRayCount++;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aArc', new THREE.Float32BufferAttribute(arcA, 1));
    geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seedA, 1));
    var collected = new THREE.LineSegments(geo, addMat(collectedU, RAY_VERT, RAY_FRAG));
    collected.frustumCulled = false;
    g.add(collected);
  }

  // —— 氢气流 + 锡碎屑粒子 ——
  const gasCount = 900;
  const gasGeo = new THREE.BufferGeometry();
  const gasPos = new Float32Array(gasCount * 3);
  const gasSeed = new Float32Array(gasCount);
  const gasState = [];
  for (let i = 0; i < gasCount; i++) {
    const isDebris = i % 5 === 0;
    const a = Math.random() * Math.PI * 2;
    const rr = (isDebris ? 0.25 : 0.55 + Math.random() * 0.45) * PURITY.gasCurtain.radius;
    gasState.push({
      x: PURITY.gasCurtain.from.x - 4 + Math.random() * 12,
      a, r: rr, vx: 0.9 + Math.random() * 1.4, isDebris,
      spin: (Math.random() - 0.5) * 1.6,
    });
    gasSeed[i] = Math.random();
  }
  gasGeo.setAttribute('position', new THREE.BufferAttribute(gasPos, 3));
  gasGeo.setAttribute('aSeed', new THREE.BufferAttribute(gasSeed, 1));
  const gasMat = new THREE.PointsMaterial({
    size: 0.125, map: glowSprite(64, 2.4), color: srgb('#8ac4ea'),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    opacity: 0, sizeAttenuation: true,
  });
  const gas = new THREE.Points(gasGeo, gasMat);
  gas.frustumCulled = false;
  g.add(gas);

  // —— 状态 ——
  const state = {
    dropletPhase: 0, plasmaFlash: 0, pancake: 0, heroT: 0,
  };

  return {
    group: g,
    collectedRayCount,
    /**
     * @param t       全片时间（秒）
     * @param ctl     控制量（由 script.js 的时间轴给出）
     *   ctl.dropletFlow   锡滴流可见度 0..1
     *   ctl.dropletSpeed  锡滴流速（示意）
     *   ctl.heroPos       主角锡滴沿射流的位置 0..1（0=喷嘴, 0.5=等离子体点）
     *   ctl.pancake       压扁程度 0..1（预脉冲）
     *   ctl.plasma        等离子体强度 0..1
     *   ctl.euvHead       EUV 波前推进 0..1
     *   ctl.euvSteady     EUV 稳态亮度 0..1
     *   ctl.spray         4π 未收集辐射强度 0..1
     *   ctl.prePulse      预脉冲强度 0..1
     *   ctl.mainPulse     主脉冲强度 0..1
     *   ctl.laserUpstream 上游激光链强度 0..1
     *   ctl.gas           氢气/碎屑可见度 0..1
     */
    update(t, ctl) {
      // 锡滴流
      const mtx = new THREE.Matrix4();
      const flow = ctl.dropletFlow ?? 0;
      const spacing = jetLen / N;
      const phase = (t * (ctl.dropletSpeed ?? 1) * 5.5) % 1;
      for (let i = 0; i < N; i++) {
        const yy = DROPLET_NOZZLE.y - ((i + phase) * spacing);
        const alive = flow > 0.01 && yy > DROPLET_CATCHER.y + 0.4;
        // 接近等离子体点的锡滴被消耗（不与 hero 重叠，避免穿模）
        const nearPlasma = Math.abs(yy - PLASMA.y) < 1.15;
        const s = alive && !nearPlasma ? flow : 0.0001;
        mtx.makeScale(s, s, s);
        mtx.setPosition(DROPLET_NOZZLE.x, yy, 0);
        stream.setMatrixAt(i, mtx);
      }
      stream.instanceMatrix.needsUpdate = true;
      stream.visible = flow > 0.01;

      // 主角锡滴：位置 + 预脉冲压扁
      const hp = ctl.heroPos ?? -1;
      if (hp >= 0) {
        hero.visible = true;
        hero.position.set(DROPLET_NOZZLE.x, DROPLET_NOZZLE.y + (DROPLET_CATCHER.y - DROPLET_NOZZLE.y) * hp, 0);
        const pk = ctl.pancake ?? 0;
        // 球 → 圆盘：轴向压扁、径向展开（体积近似守恒）
        const sx = 1 + pk * 2.35, sy = 1 / (1 + pk * 5.2), sz = 1 + pk * 2.35;
        hero.scale.set(sx, sy, sz);
        // 圆盘法线朝激光来向（+X），故压扁轴为 X
        hero.rotation.set(0, 0, 0);
        hero.scale.set(sy, sx, sz);
        hero.rotation.z = Math.PI / 2;
        hero.material.opacity = 1;
        hero.material.transparent = false;
        const consumed = ctl.plasma ?? 0;
        hero.visible = consumed < 0.45 && (ctl.heroVisible ?? 1) > 0.5;
      } else {
        hero.visible = false;
      }

      // 等离子体
      const pl = ctl.plasma ?? 0;
      plasmaU.uTime.value = t;
      plasmaU.uIntensity.value = pl * 0.60;
      plasmaShell.visible = pl > 0.002;
      plasmaShell.scale.setScalar(0.55 + pl * 0.85 + Math.sin(t * 33) * 0.02 * pl);
      plasmaCore.material.opacity = Math.min(1, pl * 0.55);
      plasmaCore.visible = pl > 0.002;
      plasmaCore.scale.setScalar(0.7 + pl * 0.6);
      plasmaGlow.material.opacity = pl * 0.26;
      plasmaGlow.scale.setScalar(R * (12 + pl * 15));
      plasmaLight.intensity = pl * 34;

      // CO₂ 激光
      for (const [p, amt] of [[prePulse, ctl.prePulse ?? 0], [mainPulse, ctl.mainPulse ?? 0]]) {
        p.u.uTime.value = t;
        p.u.uIntensity.value = amt * 0.52;
        p.u.uHead.value = amt > 0 ? 1 : 0;
        p.mesh.visible = amt > 0.004;
      }
      upstreamU.uTime.value = t;
      upstreamU.uIntensity.value = (ctl.laserUpstream ?? 0) * 0.28;
      upstream.visible = (ctl.laserUpstream ?? 0) > 0.004;

      // 4π 辐射与被收集光线
      sprayU.uTime.value = t;
      sprayU.uHead.value = ctl.euvHead ?? 0;
      sprayU.uIntensity.value = (ctl.spray ?? 0) * 0.34;
      sprayU.uSteady.value = ctl.spraySteady ?? 0;
      spray.visible = (ctl.spray ?? 0) > 0.004;

      collectedU.uTime.value = t;
      collectedU.uHead.value = ctl.euvHead ?? 0;
      collectedU.uIntensity.value = (ctl.collected ?? 0) * 0.38;
      collectedU.uSteady.value = ctl.euvSteady ?? 0;
      collected.visible = (ctl.collected ?? 0) > 0.004;

      // 氢气 / 碎屑
      const gv = ctl.gas ?? 0;
      gasMat.opacity = gv * 0.42;
      gas.visible = gv > 0.004;
      if (gas.visible) {
        const arr = gasGeo.getAttribute('position');
        const dt = 1 / 60;
        for (let i = 0; i < gasCount; i++) {
          const s = gasState[i];
          s.x += s.vx * dt * 6.5;
          s.a += s.spin * dt;
          if (s.x > IF_POINT.x + 2) s.x = PURITY.gasCurtain.from.x - 5 - Math.random() * 3;
          // 气帘向轴心收束
          const tt = Math.max(0, Math.min(1, (s.x - PURITY.gasCurtain.from.x) / 8));
          const rr = s.r * (1 - 0.72 * tt);
          arr.setXYZ(i, s.x, Math.sin(s.a) * rr, Math.cos(s.a) * rr);
        }
        arr.needsUpdate = true;
      }
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// 2. 下游光路 FX：IF → 照明 → 掩模 → 投影 → 晶圆
//    每段光束半径按 4:1 缩比在投影段单调收缩。
// ═══════════════════════════════════════════════════════════════════
export function buildBeamFX(scene, quality) {
  const g = new THREE.Group(); g.name = 'FX_BEAM'; scene.add(g);
  const nodes = CHAIN.nodes;
  const iIF = nodes.findIndex((n) => n.key === 'IF');
  const segments = [];

  // 各节点处的光束半径：IF 处极细（焦点），照明段展宽，投影段按 4:1 收缩
  const radiusAt = (key) => {
    if (key === 'IF') return 0.10;
    if (key === 'PLASMA' || key === 'COLLECTOR') return 0.4;
    const scaleF = patternScaleAt(key);          // MASK=4 → WAFER=1
    if (key === 'WAFER') return mm(26) * 0.5 * 0.62;
    if (key.startsWith('POB') || key === 'MASK') {
      return mm(26) * 0.5 * 0.62 * scaleF;
    }
    // 照明段：由细焦点逐步展宽到掩模场
    const order = ['IF', 'ILL_FIELD', 'ILL_PUPIL', 'ILL_LAST'];
    const i = order.indexOf(key);
    if (i >= 0) return 0.10 + (mm(104) * 0.5 * 0.62 - 0.10) * (i / (order.length - 1 + 1));
    return 0.5;
  };

  // 累计弧长（自 IF 起算），用于波前推进
  let total = 0;
  for (let i = iIF; i < nodes.length - 1; i++) total += nodes[i + 1].segLength;
  let acc = 0;
  for (let i = iIF; i < nodes.length - 1; i++) {
    const a = nodes[i], b = nodes[i + 1];
    const arc0 = acc / total; acc += b.segLength; const arc1 = acc / total;
    const u = {
      uColor: { value: srgb(C.primary) }, uCoreColor: { value: srgb(C.accent) },
      uTime: { value: 0 }, uHead: { value: 0 }, uSoft: { value: 0.035 },
      uIntensity: { value: 0 }, uFlicker: { value: 1 },
    };
    const seg = new THREE.Mesh(
      taperedTube(a.pos, b.pos, radiusAt(a.key), radiusAt(b.key),
        quality.taaLevel >= 2 ? 32 : 22, arc0, arc1, Math.max(4, Math.round(b.segLength / 3))),
      addMat(u, BEAM_VERT, BEAM_FRAG));
    seg.frustumCulled = false;
    seg.name = `BEAM_${a.key}_${b.key}`;
    g.add(seg);
    segments.push({ from: a.key, to: b.key, mesh: seg, u, arc0, arc1, step: b.step });
  }

  // —— 弧形照明狭缝（环形场光学）：掩模与晶圆各一片 ——
  const mkSlit = (node, widthMM, heightMM, colorHex) => {
    const shape = arcSlitShape(heightMM * 0.9, 0.52, widthMM);
    const geo = new THREE.ShapeGeometry(shape, 24);
    const mat = new THREE.MeshBasicMaterial({
      color: srgb(colorHex), transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(geo, mat);
    return m;
  };
  const maskSlit = mkSlit(MASK, mm(104) * 0.22, mm(132) * 0.5, C.accent);
  const waferSlit = mkSlit(WAFER, mm(26) * 0.22, mm(33) * 0.5, C.accent);
  g.add(maskSlit, waferSlit);

  // —— 4:1 缩比指示：掩模场与晶圆场的对照方框 ——
  const fieldFrame = (w, h, colorHex) => {
    const geo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, h));
    const mat = new THREE.LineBasicMaterial({ color: srgb(colorHex), transparent: true, opacity: 0 });
    return new THREE.LineSegments(geo, mat);
  };
  const maskField = fieldFrame(MASK.field.w, MASK.field.h, C.accent);
  const waferField = fieldFrame(WAFER.field.w, WAFER.field.h, C.accent);
  g.add(maskField, waferField);

  return {
    group: g, segments, total,
    maskSlit, waferSlit, maskField, waferField,
    /**
     * ctl.head      波前推进 0..1（自 IF 起算的归一化弧长）
     * ctl.intensity 全局强度
     * ctl.stepMask  仅点亮某些步骤对应的段（可选 Set）
     * ctl.slit      弧形狭缝可见度
     * ctl.field     缩比对照方框可见度
     * ctl.scanPhase 扫描相位 -1..1
     */
    update(t, ctl) {
      const head = ctl.head ?? 0;
      const inten = ctl.intensity ?? 0;
      for (const s of segments) {
        const on = !ctl.stepMask || ctl.stepMask.has(s.step);
        s.u.uTime.value = t;
        s.u.uHead.value = head;
        s.u.uIntensity.value = on ? inten * 0.40 : 0;
        s.u.uFlicker.value = 0.94 + 0.06 * Math.sin(t * 26 + s.arc0 * 30);
        s.mesh.visible = on && inten > 0.004 && head > s.arc0 - 0.02;
      }
      const slit = ctl.slit ?? 0;
      const ph = ctl.scanPhase ?? 0;
      maskSlit.material.opacity = slit * 0.9;
      waferSlit.material.opacity = slit * 0.9;
      maskSlit.visible = waferSlit.visible = slit > 0.004;
      // 掩模台以晶圆台 4 倍速反向扫描（PARAMS.scanRatio）
      maskSlit.position.set(0, 0, 0);
      maskSlit.userData.scan = ph * 4;
      waferSlit.userData.scan = -ph;
      const f = ctl.field ?? 0;
      maskField.material.opacity = f * 0.85;
      waferField.material.opacity = f * 0.85;
      maskField.visible = waferField.visible = f > 0.004;
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// 3. 曝光 FX：光刻胶潜影 → 显影 → 芯片图形
// ═══════════════════════════════════════════════════════════════════
export function buildExposureFX(scene, stageRefs, quality) {
  const g = new THREE.Group(); g.name = 'FX_EXPOSURE'; scene.add(g);

  // —— 潜影层：叠在光刻胶上，显示"曝光但尚未显影"的不可见图形 ——
  const latentU = {
    uMap: { value: chipLayout(1024, 'mask') },
    uTime: { value: 0 },
    uLatent: { value: 0 },     // 潜影显现度（化学状态差异，视觉上极弱）
    uDevelop: { value: 0 },    // 显影推进 0..1（沿 Y 方向擦除）
    uColor: { value: srgb(C.accent) },
    uScan: { value: 0 },
  };
  const latentMat = new THREE.ShaderMaterial({
    uniforms: latentU,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap;
      uniform float uTime, uLatent, uDevelop, uScan;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float p = texture2D(uMap, vUv).r;
        // 潜影：仅化学状态改变，视觉上是极低对比的折射率差
        float latent = uLatent * (0.10 + 0.24 * p);
        // 显影波前自下而上推进
        float dev = smoothstep(uDevelop - 0.06, uDevelop + 0.06, vUv.y);
        float developed = (1.0 - dev) * p * uDevelop;
        // 扫描曝光的弧形狭缝亮线
        float sq = (vUv.y - uScan) / 0.035; float slit = exp(-min(64.0, sq * sq)) * uLatent;
        float a = clamp(latent * 0.55 + developed * 0.9 + slit * 0.8, 0.0, 4.0);
        vec3 col = mix(uColor, vec3(1.0), clamp(developed * 0.6 + slit * 0.9, 0.0, 1.0));
        if (!(a == a) || a < 0.004) discard;
        gl_FragColor = vec4(col * a, a);
      }
    `,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    side: THREE.DoubleSide, toneMapped: true,
  });

  const fieldMesh = new THREE.Mesh(new THREE.PlaneGeometry(WAFER.field.w, WAFER.field.h), latentMat);
  // 挂在晶圆持有器下，随晶圆台一起运动
  if (stageRefs.moving.waferHolder) {
    fieldMesh.position.set(0, 0, mm(0.775) / 2 + 0.02);
    stageRefs.moving.waferHolder.add(fieldMesh);
  } else {
    fieldMesh.position.copy(V3(WAFER.pos));
    g.add(fieldMesh);
  }

  // —— 掩模侧同步高亮（同一版图，4× 尺寸）——
  const maskFieldMesh = new THREE.Mesh(new THREE.PlaneGeometry(MASK.field.w, MASK.field.h), latentMat.clone());
  maskFieldMesh.material.uniforms = {
    ...latentU,
    uLatent: { value: 0 }, uDevelop: { value: 0 }, uScan: { value: 0 },
    uTime: latentU.uTime, uMap: latentU.uMap, uColor: latentU.uColor,
  };
  if (stageRefs.moving.maskHolder) {
    maskFieldMesh.position.set(0, 0, 0.03);
    stageRefs.moving.maskHolder.add(maskFieldMesh);
  }

  return {
    group: g, fieldMesh, maskFieldMesh, latentU,
    maskU: maskFieldMesh.material.uniforms,
    /**
     * ctl.latent   潜影显现 0..1
     * ctl.develop  显影推进 0..1
     * ctl.scan     扫描狭缝位置 0..1
     * ctl.chips    已完成芯片阵列显现 0..1
     * ctl.resist   光刻胶膜可见度 0..1
     */
    update(t, ctl) {
      latentU.uTime.value = t;
      latentU.uLatent.value = ctl.latent ?? 0;
      latentU.uDevelop.value = ctl.develop ?? 0;
      latentU.uScan.value = ctl.scan ?? -1;
      const mu = maskFieldMesh.material.uniforms;
      mu.uLatent.value = (ctl.maskGlow ?? 0);
      mu.uDevelop.value = 0;
      mu.uScan.value = ctl.scan ?? -1;
      fieldMesh.visible = (ctl.latent ?? 0) > 0.004 || (ctl.develop ?? 0) > 0.004;
      maskFieldMesh.visible = (ctl.maskGlow ?? 0) > 0.004;

      if (stageRefs.moving.chipMat) {
        stageRefs.moving.chipMat.opacity = ctl.chips ?? 0;
        stageRefs.moving.chips.visible = (ctl.chips ?? 0) > 0.004;
      }
      if (stageRefs.moving.resistFilm) {
        const rv = ctl.resist ?? 1;
        stageRefs.moving.resistFilm.material.opacity = 0.62 * rv;
        stageRefs.moving.resistFilm.visible = rv > 0.01;
      }
    },
  };
}
