/* =====================================================================
 * Camera — 透视相机（第一/第三人称 + 视锥 + 屏幕射线）
 * ===================================================================== */
import * as Mat4 from '../math/Mat4.js';
import * as Vec3 from '../math/Vec3.js';
import { Frustum } from '../math/Frustum.js';
import { DEG2RAD, clamp, damp } from '../math/MathUtils.js';

export class Camera {
  constructor() {
    this.position = new Float32Array(3);
    this.yaw = 0;                    // 绕 Y，0 = 朝 -Z
    this.pitch = 0;                  // 抬头为正
    this.roll = 0;
    this.fov = 75;
    this.near = 0.05;
    this.far = 512;
    this.aspect = 16 / 9;

    this.view = Mat4.create();
    this.proj = Mat4.create();
    this.viewProj = Mat4.create();
    this.invViewProj = Mat4.create();
    this.frustum = new Frustum();

    this.forward = new Float32Array([0, 0, -1]);
    this.right = new Float32Array([1, 0, 0]);
    this.up = new Float32Array([0, 1, 0]);

    // 视角特效
    this.fovModifier = 1;            // 疾跑拉伸
    this.zoomFactor = 1;             // C 键望远
    this.bobPhase = 0;
    this.bobAmount = 0;
    this.shake = 0;
    this._fovSmooth = 75;
  }

  setPerspective(fov, aspect, near, far) {
    this.fov = fov; this.aspect = aspect; this.near = near; this.far = far;
  }

  /** 更新矩阵。extra 提供摇晃等偏移 */
  update(dt = 0.016) {
    const targetFov = this.fov * this.fovModifier / this.zoomFactor;
    this._fovSmooth = damp(this._fovSmooth, targetFov, 14, dt);

    Mat4.perspective(this.proj, this._fovSmooth * DEG2RAD, this.aspect, this.near, this.far);

    let px = this.position[0], py = this.position[1], pz = this.position[2];
    let roll = this.roll;

    // 走路摇晃（第一人称）
    if (this.bobAmount > 0.001) {
      const b = this.bobAmount;
      px += Math.cos(this.bobPhase) * 0.055 * b * Math.cos(this.yaw);
      py += Math.abs(Math.sin(this.bobPhase)) * 0.06 * b;
      pz += Math.cos(this.bobPhase) * 0.055 * b * -Math.sin(this.yaw);
      roll += Math.sin(this.bobPhase) * 0.013 * b;
    }
    if (this.shake > 0.001) {
      px += (Math.random() - 0.5) * this.shake * 0.14;
      py += (Math.random() - 0.5) * this.shake * 0.14;
      roll += (Math.random() - 0.5) * this.shake * 0.05;
    }

    Mat4.viewFromEuler(this.view, px, py, pz, this.yaw, this.pitch, roll);
    Mat4.multiply(this.viewProj, this.proj, this.view);
    Mat4.invert(this.invViewProj, this.viewProj);
    this.frustum.setFromMatrix(this.viewProj);

    // 基向量
    Vec3.fromYawPitch(this.forward, this.yaw, this.pitch);
    this.right[0] = Math.cos(this.yaw); this.right[1] = 0; this.right[2] = -Math.sin(this.yaw);
    Vec3.cross(this.up, this.right, this.forward);
    Vec3.normalize(this.up, this.up);

    this.eye = [px, py, pz];
    return this;
  }

  /** 水平前向（忽略俯仰），用于移动 */
  getMoveBasis(outForward, outRight) {
    outForward[0] = -Math.sin(this.yaw); outForward[1] = 0; outForward[2] = -Math.cos(this.yaw);
    outRight[0] = Math.cos(this.yaw); outRight[1] = 0; outRight[2] = -Math.sin(this.yaw);
    return this;
  }

  rotate(dx, dy) {
    this.yaw += dx;
    this.pitch = clamp(this.pitch - dy, -Math.PI / 2 + 0.001, Math.PI / 2 - 0.001);
    if (this.yaw > Math.PI) this.yaw -= Math.PI * 2;
    if (this.yaw < -Math.PI) this.yaw += Math.PI * 2;
  }

  /** 屏幕像素 → 世界射线方向（未归一化的方向 + 起点） */
  screenRay(nx, ny) {
    // nx, ny ∈ [-1,1]
    const p = [nx, ny, 1];
    const world = Vec3.transformMat4([0, 0, 0], p, this.invViewProj);
    const dir = Vec3.normalize([0, 0, 0], Vec3.sub([0, 0, 0], world, this.eye));
    return { origin: this.eye.slice(), dir };
  }

  get fovDeg() { return this._fovSmooth; }
}
