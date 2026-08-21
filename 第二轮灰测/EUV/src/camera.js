/**
 * camera.js — 电影摄影机机架
 * ==================================================================
 * 关键设计：摄影机姿态是「时间的纯函数」——
 *   pose(t) 不依赖任何累积状态、不依赖 deltaTime、不使用随机数。
 * 因此：
 *   · 母版逐帧捕获可在任意顺序、任意次数重复渲染同一帧而结果一致
 *   · 不会出现帧间抖动或闪烁（§1.3）
 *   · 拖动时间条与正常播放画面完全一致
 *
 * 手持微动与撞击晃动均由确定性正弦叠加生成（伪随机但可重复）。
 */

import * as THREE from 'three';
import { shotAt, sampleFX, EASE, TIMELINE } from './script.js';
import { vec } from './layout.js';

const V3 = (v) => new THREE.Vector3(v.x, v.y, v.z);

/** 确定性伪噪声：同一 t 必得同一值 */
function dnoise(t, seed = 0) {
  return (
    Math.sin(t * 1.113 + seed * 12.9898) * 0.5 +
    Math.sin(t * 2.371 + seed * 78.233) * 0.3 +
    Math.sin(t * 4.717 + seed * 43.758) * 0.2
  ) * 0.5;
}

export function createCameraRig(aspect) {
  const camera = new THREE.PerspectiveCamera(34, aspect, 0.08, 900);
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();

  /**
   * 计算 t 时刻的机位。
   * @returns { position, target, fov, focus, aperture, shake }
   */
  function pose(t) {
    const { shot, local } = shotAt(t);
    const cam = shot.camera;
    const ease = cam.ease || EASE.inOut;
    const u = ease(Math.max(0, Math.min(1, local)));

    const from = V3(cam.from), to = V3(cam.to);
    const pos = new THREE.Vector3();

    if (cam.orbit) {
      // 环绕运镜：在目标周围沿圆弧插值，避免直线穿过物体
      const lookMid = V3(cam.lookFrom).lerp(V3(cam.lookTo), 0.5);
      const a = from.clone().sub(lookMid), b = to.clone().sub(lookMid);
      const ra = a.length(), rb = b.length();
      const qa = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), a.clone().normalize());
      const qb = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), b.clone().normalize());
      const q = qa.clone().slerp(qb, u);
      pos.set(0, 0, 1).applyQuaternion(q).multiplyScalar(ra + (rb - ra) * u).add(lookMid);
    } else {
      pos.copy(from).lerp(to, u);
    }

    const target = V3(cam.lookFrom).lerp(V3(cam.lookTo), u);

    // 视场角
    const fov = Array.isArray(cam.fov) ? cam.fov[0] + (cam.fov[1] - cam.fov[0]) * u : (cam.fov ?? 34);

    // 手持微动：随镜头距离缩放，近景更明显（模拟真实机架）
    const dist = pos.distanceTo(target);
    const hand = Math.min(1, 3.2 / Math.max(0.6, dist)) * 0.055;
    const wob = new THREE.Vector3(
      dnoise(t * 0.42, 1) * hand,
      dnoise(t * 0.37, 2) * hand * 0.8,
      dnoise(t * 0.31, 3) * hand * 0.6,
    );
    pos.add(wob);
    target.add(wob.clone().multiplyScalar(0.35));

    // 撞击晃动（主脉冲命中时）
    const fx = sampleFX(shot, local);
    const shake = fx.shake ?? 0;
    if (shake > 0.001) {
      const s = shake * 0.5;
      pos.add(new THREE.Vector3(
        dnoise(t * 21.3, 7) * s, dnoise(t * 19.7, 8) * s, dnoise(t * 24.1, 9) * s));
    }

    // 焦点距离：镜头声明的 focus 若给出则用之，否则自动对准视线中心
    let focus = cam.focus;
    if (Array.isArray(focus)) focus = focus[0] + (focus[1] - focus[0]) * u;
    if (focus === undefined) focus = pos.distanceTo(target);
    const aperture = cam.aperture;

    return { position: pos, target, fov, focus, aperture, shake, shot, local, fx };
  }

  /** 应用到 three 摄影机 */
  function apply(t) {
    const p = pose(t);
    camera.position.copy(p.position);
    camera.lookAt(p.target);
    if (Math.abs(camera.fov - p.fov) > 1e-6) { camera.fov = p.fov; camera.updateProjectionMatrix(); }
    return p;
  }

  function setAspect(a) {
    camera.aspect = a;
    camera.updateProjectionMatrix();
  }

  return { camera, pose, apply, setAspect };
}

/**
 * 自由观察摄影机（评审用，不参与母版渲染）：
 * 便于客户在评审会上任意角度检查穿模与光路方向。
 */
export function createInspectCamera(aspect, domElement, OrbitControls, center) {
  const camera = new THREE.PerspectiveCamera(38, aspect, 0.08, 900);
  camera.position.set(center.x + 60, center.y + 30, center.z + 110);
  const controls = new OrbitControls(camera, domElement);
  controls.target.set(center.x, center.y, center.z);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxDistance = 460;
  controls.minDistance = 1.5;
  controls.update();
  return { camera, controls };
}
