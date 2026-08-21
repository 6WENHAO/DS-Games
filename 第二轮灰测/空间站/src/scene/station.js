/**
 * scene/station.js —— 空间站装配体与运动学
 *
 * 负责：
 *  · 把 Worker 产出的网格挂到 GPU，建立舱段运行时对象
 *  · 每帧求解运动学：自转（居住环）、对日跟踪（太阳翼）、扫描（天线）、
 *    悬停漂移（摆渡飞船）、多级刚体链（机械臂）
 *  · 爆炸视图、在轨装配进度、单独显示、选中/悬停高亮的状态混合
 */

import { VoxelMesh } from '../gfx/mesh.js';
import { mat4, vec3, clamp, damp, lerp, easeOutCubic } from '../core/math.js';

const UP_X = vec3.create(1, 0, 0);

export class Station {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    /** @type {Array<object>} */
    this.modules = [];
    this.byId = new Map();
    this.radius = 260;
    this.totalTriangles = 0;
    this.totalVoxels = 0;
    this.totalBytes = 0;
    this.maxOrder = 1;

    this.sun = {
      dir: vec3.create(0.42, 0.55, 0.72),
      color: vec3.create(1.0, 0.97, 0.92),
    };
    this.env = {
      skyColor: vec3.create(0.030, 0.048, 0.085),
      groundColor: vec3.create(0.012, 0.020, 0.038),
      earthColor: vec3.create(0.055, 0.105, 0.185),
      earthDir: vec3.create(0, -1, 0),
      fillColor: vec3.create(0.020, 0.030, 0.055),
      earthCenter: vec3.create(0, -6900, 0),
      earthRadius: 6000,
      galaxyAxis: vec3.create(0.26, 0.93, -0.26),
    };
  }

  /**
   * 注册一个舱段。
   * @param {object} def   蓝图元数据
   * @param {object} meshData Worker 产出的网格
   * @param {object} info  { voxelCount, bounds }
   */
  add(def, meshData, info) {
    const mesh = new VoxelMesh(this.gl, meshData);
    const b = info.bounds;
    const restCenter = vec3.create(b.center[0], b.center[1], b.center[2]);
    const radius = Math.hypot(b.size[0], b.size[1], b.size[2]) / 2 + 2;

    // 爆炸方向：由站体中心指向舱段质心；中心舱段沿主轴微移
    const d = vec3.create(restCenter[0], restCenter[1], restCenter[2]);
    const len = vec3.len(d);
    const explode = vec3.create();
    if (len > 6) vec3.scale(explode, d, 1 / len);
    else vec3.set(explode, 0.35, 0.1, 0);

    const m = {
      def, mesh, index: this.modules.length,
      id: def.id,
      matrix: mat4.create(),
      localMatrix: mat4.create(),
      parent: def.parent ? this.byId.get(def.parent) : null,
      visible: true,
      opacity: 1,
      highlight: 0,
      highlightTarget: 0,
      dim: 1,
      dimTarget: 1,
      restCenter,
      worldCenter: vec3.create(restCenter[0], restCenter[1], restCenter[2]),
      boundsRadius: radius,
      explodeDir: explode,
      voxelCount: info.voxelCount,
      triangleCount: mesh.triangleCount,
      quadCount: info.quadCount || 0,
      bounds: b,
      angle: 0,
      motionPhase: Math.random() * 6.28,
      hidden: false,
    };
    if (def.parent && !this.byId.has(def.parent)) {
      console.warn(`[Station] 舱段 ${def.id} 的父级 ${def.parent} 尚未注册，已退化为独立刚体`);
    }
    this.modules.push(m);
    this.byId.set(def.id, m);
    this.totalTriangles += mesh.triangleCount;
    this.totalVoxels += info.voxelCount;
    this.totalBytes += mesh.byteSize;
    this.maxOrder = Math.max(this.maxOrder, def.order || 0);
    return m;
  }

  /** 全站包围球半径（用于阴影拟合与总览取景） */
  computeBounds() {
    let r = 0;
    for (const m of this.modules) {
      r = Math.max(r, vec3.len(m.restCenter) + m.boundsRadius);
    }
    this.radius = Math.max(80, r);
    return this.radius;
  }

  /* ═══════════════ 每帧运动学 ═══════════════ */

  /**
   * @param {number} dt
   * @param {number} time
   * @param {object} st 交互状态
   *   { animate, explode(0..1), assembly(0..1), selected, hovered, solo, hiddenIds:Set }
   */
  update(dt, time, st) {
    const t = st.animate ? time : 0;
    const explodeAmount = st.explode * 130;

    for (const m of this.modules) {
      const def = m.def;
      const motion = def.motion;
      let angle = 0;
      const trans = _t1;
      vec3.set(trans, 0, 0, 0);

      if (motion && st.animate) {
        switch (motion.type) {
          case 'spin':
            angle = t * (motion.speed || 0.1) * Math.PI * 2;
            break;
          case 'sweep':
            angle = (motion.bias || 0) + (motion.range || 0.3) *
              Math.sin(t * (motion.speed || 0.1) * Math.PI * 2 + (motion.phase || 0));
            break;
          case 'bob': {
            const s = Math.sin(t * (motion.speed || 0.4) * Math.PI * 2 + (motion.phase || 0));
            const ax = def.axis || [0, 1, 0];
            const amp = (motion.range || 0.02) * 60;
            vec3.set(trans, ax[0] * s * amp, ax[1] * s * amp, ax[2] * s * amp);
            angle = s * 0.012;
            break;
          }
          default: break;
        }
      } else if (motion && motion.type === 'sweep') {
        angle = motion.bias || 0;
      }

      /* 在轨装配进度：按 order 依次"飞入" */
      let assemble = 1;
      if (st.assembly < 0.999) {
        const p = st.assembly * (this.maxOrder + 1.8);
        assemble = clamp(p - (def.order || 0), 0, 1);
        assemble = easeOutCubic(assemble);
      }

      /* 爆炸视图 + 装配飞入共用位移方向 */
      const off = explodeAmount + (1 - assemble) * 150;
      if (off > 0.001) {
        trans[0] += m.explodeDir[0] * off;
        trans[1] += m.explodeDir[1] * off;
        trans[2] += m.explodeDir[2] * off;
      }

      m.angle = angle;
      const axis = def.axis || UP_X;
      const pivot = def.pivot || _zero;
      mat4.compose(m.localMatrix, trans, axis, angle, 1, pivot);

      if (m.parent) mat4.multiply(m.matrix, m.parent.matrix, m.localMatrix);
      else mat4.copy(m.matrix, m.localMatrix);

      vec3.transformMat4(m.worldCenter, m.restCenter, m.matrix);

      /* 可见性与强调状态 */
      const hidden = st.hiddenIds.has(def.id) ||
        (st.solo && st.selected && def.id !== st.selected && !this._isDescendantOf(m, st.selected));
      m.hidden = hidden;
      m.visible = !hidden && assemble > 0.02;
      m.opacity = clamp(assemble, 0, 1) * (hidden ? 0 : 1);

      m.highlightTarget = def.id === st.selected ? 1 : (def.id === st.hovered ? 0.55 : 0);
      m.highlight = damp(m.highlight, m.highlightTarget, 12, dt);
      m.dimTarget = (st.selected && !st.solo && def.id !== st.selected && !this._isDescendantOf(m, st.selected)) ? 0.62 : 1;
      m.dim = damp(m.dim, m.dimTarget, 8, dt);
    }
  }

  _isDescendantOf(m, ancestorId) {
    let p = m.parent;
    while (p) { if (p.def.id === ancestorId) return true; p = p.parent; }
    return false;
  }

  /** 太阳缓慢绕站运动（模拟 92 分钟轨道周期的昼夜交替） */
  updateSun(time, speed = 1) {
    const a = time * 0.021 * speed;
    const el = 0.42 + Math.sin(time * 0.013 * speed) * 0.30;
    const ce = Math.cos(el);
    vec3.set(this.sun.dir, ce * Math.sin(a), Math.sin(el), ce * Math.cos(a));
    vec3.normalize(this.sun.dir, this.sun.dir);
    // 地球方向随之变化很小（地球固定在 -Y），这里给出单位方向
    vec3.set(this.env.earthDir, 0, -1, 0);
    // 日照强度随"是否被地球遮挡"轻微变化，制造进出阴影的呼吸感
    const k = clamp(0.55 + this.sun.dir[1] * 0.9, 0.25, 1.6);
    vec3.set(this.sun.color, 1.02 * k, 0.985 * k, 0.94 * k);
    const amb = lerp(0.6, 1.35, clamp(this.sun.dir[1] * 0.5 + 0.5, 0, 1));
    vec3.set(this.env.skyColor, 0.030 * amb, 0.048 * amb, 0.088 * amb);
    vec3.set(this.env.earthColor, 0.052 * amb, 0.100 * amb, 0.178 * amb);
  }

  /** 世界坐标下的舱段中心（用于相机聚焦） */
  centerOf(id) {
    const m = this.byId.get(id);
    return m ? m.worldCenter : vec3.create();
  }

  dispose() {
    for (const m of this.modules) m.mesh.dispose();
    this.modules = [];
    this.byId.clear();
  }
}

const _t1 = vec3.create();
const _zero = vec3.create(0, 0, 0);
