/* =======================================================================
 *  camera.js  —  轨道相机：锁定天体、平滑切换、指数缩放、屏幕射线
 * ======================================================================= */
(function (global) {
  'use strict';
  const SS = (global.SS = global.SS || {});
  const M = SS.M, V = SS.M.v3, M4 = SS.M.m4;

  const Cam = {
    focus: null,          // Body
    yaw: 0.6, pitch: 0.35,
    dist: 30,             // units
    distTarget: 30,
    fov: 45 * Math.PI / 180,
    pos: [0, 0, 0],
    anchor: [0, 0, 0],    // 平滑跟随点
    anchorLerp: 1,
    right: [1, 0, 0], up: [0, 1, 0], back: [0, 0, 1],
    view: M4.identity(), proj: M4.identity(), viewProj: M4.identity(),
    invViewProj: M4.identity(),
    near: 0.001, far: 1e9,
    aspect: 1,
    transition: 0,
  };

  Cam.setFocus = function (body, instant) {
    const prev = Cam.focus;
    Cam.focus = body;
    Cam.distTarget = Math.max(body.radius * 3.4, 0.02);
    // 默认把相机放到太阳这一侧、留出约 35° 的相位角：
    // 既能看清被照亮的半球，又保留晨昏线的立体感（不是随机朝向）
    const sun = SS.World && SS.World.byId ? SS.World.byId.sun : null;
    if (sun && body !== sun) {
      const s = V.norm([sun.pos[0] - body.pos[0], sun.pos[1] - body.pos[1], sun.pos[2] - body.pos[2]]);
      Cam.yaw = Math.atan2(s[2], s[0]) + 0.62;
      Cam.pitch = M.clamp(Math.asin(M.clamp(s[1], -1, 1)) + 0.28, -1.2, 1.2);
    }
    if (instant || !prev) {
      Cam.dist = Cam.distTarget;
      Cam.anchor = V.clone(body.pos);
      Cam.anchorLerp = 1;
    } else {
      Cam.anchorLerp = 0;
      Cam.anchorFrom = V.clone(prev.pos);
      Cam.transition = 1;
    }
  };

  Cam.zoom = function (factor) {
    const b = Cam.focus;
    const minD = b ? b.radius * 1.02 : 0.01;
    const maxD = 2.2e7;
    Cam.distTarget = M.clamp(Cam.distTarget * factor, minD, maxD);
  };

  Cam.orbit = function (dx, dy) {
    Cam.yaw -= dx;
    Cam.pitch = M.clamp(Cam.pitch + dy, -1.5, 1.5);
  };

  Cam.update = function (dt) {
    const b = Cam.focus;
    if (!b) return;
    // 距离与跟随的平滑
    const k = 1 - Math.exp(-dt * 7.5);
    Cam.dist += (Cam.distTarget - Cam.dist) * k;
    if (Cam.anchorLerp < 1) {
      Cam.anchorLerp = Math.min(1, Cam.anchorLerp + dt * 0.9);
      const s = M.smoothstep(0, 1, Cam.anchorLerp);
      const from = Cam.anchorFrom || b.pos;
      Cam.anchor = [
        from[0] + (b.pos[0] - from[0]) * s,
        from[1] + (b.pos[1] - from[1]) * s,
        from[2] + (b.pos[2] - from[2]) * s,
      ];
    } else {
      Cam.anchor = V.clone(b.pos);
    }

    const cp = Math.cos(Cam.pitch), sp = Math.sin(Cam.pitch);
    const dir = [Math.cos(Cam.yaw) * cp, sp, Math.sin(Cam.yaw) * cp];
    Cam.pos = [
      Cam.anchor[0] + dir[0] * Cam.dist,
      Cam.anchor[1] + dir[1] * Cam.dist,
      Cam.anchor[2] + dir[2] * Cam.dist,
    ];

    // 相机基（相机位于原点的相对空间）
    const back = V.norm(dir);
    let right = V.cross([0, 1, 0], back);
    if (V.len2(right) < 1e-9) right = [1, 0, 0];
    V.norm(right, right);
    const up = V.cross(back, right);
    Cam.right = right; Cam.up = up; Cam.back = back;

    // 近远裁剪面：对数深度下可以取得很激进
    const nearRef = Math.max(Cam.dist - (b ? b.radius : 0), 1e-4);
    Cam.near = Math.max(1e-5, nearRef * 0.002);
    Cam.far = 1e9;
    M4.perspective(Cam.fov, Cam.aspect, Cam.near, Cam.far, Cam.proj);
    M4.viewFromBasis(right, up, back, [0, 0, 0], Cam.view);
    M4.mul(Cam.proj, Cam.view, Cam.viewProj);
    Cam.logFC = 2.0 / (Math.log(Cam.far + 1.0) / Math.LN2);
  };

  /** 屏幕坐标(0..1, y 向下) → 相机相对射线方向 */
  Cam.ray = function (sx, sy) {
    const ndcX = sx * 2 - 1;
    const ndcY = 1 - sy * 2;
    const th = Math.tan(Cam.fov / 2);
    const d = [
      Cam.right[0] * ndcX * th * Cam.aspect + Cam.up[0] * ndcY * th - Cam.back[0],
      Cam.right[1] * ndcX * th * Cam.aspect + Cam.up[1] * ndcY * th - Cam.back[1],
      Cam.right[2] * ndcX * th * Cam.aspect + Cam.up[2] * ndcY * th - Cam.back[2],
    ];
    return V.norm(d);
  };

  /** 世界坐标 → 屏幕(0..1)，返回 null 表示在相机背后 */
  Cam.project = function (worldRel) {
    const c = M4.xform4(Cam.viewProj, worldRel, 1);
    if (c[3] <= 1e-9) return null;
    return { x: (c[0] / c[3] * 0.5 + 0.5), y: (0.5 - c[1] / c[3] * 0.5), w: c[3] };
  };

  /** 某天体在屏幕上的半径（像素） */
  Cam.screenRadius = function (body, viewportH, sizeBoost) {
    const rel = [body.pos[0] - Cam.pos[0], body.pos[1] - Cam.pos[1], body.pos[2] - Cam.pos[2]];
    const d = Math.max(V.len(rel), 1e-9);
    const R = body.radius * (body.id === 'sun' ? 1 : (sizeBoost || 1));
    return (R / d) * (viewportH * 0.5) / Math.tan(Cam.fov / 2);
  };

  SS.Cam = Cam;
})(window);
