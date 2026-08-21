/**
 * 相机运镜
 *
 * 视角切换不是直线插值，而是在"以目标为中心的球坐标"里插值：
 * 半径、方位角（取最短弧）、极角分别平滑过渡，得到自然的环绕式运镜。
 */
import * as THREE from 'three';

const DEG = Math.PI / 180;

function smootherstep(x) {
  return x * x * x * (x * (x * 6 - 15) + 10);
}

export class CameraRig {
  constructor(camera, controls) {
    this.camera = camera;
    this.controls = controls;
    this.anim = null;
    this.box = new THREE.Box3();
    this._v = new THREE.Vector3();
  }

  /** 由 az/el（度）与距离求相机位置 */
  static posFor(center, az, el, dist) {
    const a = az * DEG;
    const e = el * DEG;
    return new THREE.Vector3(
      center.x + Math.sin(a) * Math.cos(e) * dist,
      center.y + Math.sin(e) * dist,
      center.z + Math.cos(a) * Math.cos(e) * dist,
    );
  }

  /** 计算一组物体的世界包围盒（跳过不可见与不可导出的辅助物） */
  boundsOf(objects) {
    this.box.makeEmpty();
    for (const o of objects) {
      if (!o.geometry) continue;
      o.updateWorldMatrix(true, false);
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      this.box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
    }
    return this.box;
  }

  /** 飞向一组物体 */
  frame(objects, view = {}, duration = 0.95) {
    if (!objects || !objects.length) return;
    const b = this.boundsOf(objects);
    if (b.isEmpty()) return;
    const center = b.getCenter(new THREE.Vector3());
    const size = b.getSize(this._v);
    const radius = Math.max(0.25, size.length() * 0.5);
    const az = view.az ?? 40;
    const el = view.el ?? 20;
    const pad = view.pad ?? 2.2;
    // 距离同时考虑相机 FOV，保证目标完整入画
    const fov = this.camera.fov * DEG;
    const fit = radius / Math.tan(fov / 2);
    const dist = Math.max(1.4, Math.max(radius * pad, fit * 1.05));
    const pos = CameraRig.posFor(center, az, el, dist);
    if (pos.y < 0.35) pos.y = 0.35;
    this.flyTo(pos, center, duration);
  }

  flyTo(pos, target, duration = 0.95) {
    const T0 = this.controls.target.clone();
    const P0 = this.camera.position.clone();
    const s0 = new THREE.Spherical().setFromVector3(P0.clone().sub(T0));
    const s1 = new THREE.Spherical().setFromVector3(pos.clone().sub(target));
    // 方位角取最短弧
    let dTheta = s1.theta - s0.theta;
    while (dTheta > Math.PI) dTheta -= Math.PI * 2;
    while (dTheta < -Math.PI) dTheta += Math.PI * 2;
    this.anim = { t: 0, dur: Math.max(0.12, duration), T0, T1: target.clone(), s0, s1, dTheta };
  }

  get flying() {
    return !!this.anim;
  }

  cancel() {
    this.anim = null;
  }

  update(dt) {
    if (!this.anim) return false;
    const a = this.anim;
    a.t += dt;
    const k = smootherstep(Math.min(1, a.t / a.dur));
    const target = a.T0.clone().lerp(a.T1, k);
    const s = new THREE.Spherical(
      a.s0.radius + (a.s1.radius - a.s0.radius) * k,
      a.s0.phi + (a.s1.phi - a.s0.phi) * k,
      a.s0.theta + a.dTheta * k,
    );
    s.makeSafe();
    const pos = new THREE.Vector3().setFromSpherical(s).add(target);
    this.camera.position.copy(pos);
    this.controls.target.copy(target);
    this.controls.update();
    if (a.t >= a.dur) this.anim = null;
    return true;
  }
}
