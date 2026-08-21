/* =============================================================
 * orbit.js —— 轻量轨道相机控制器（阻尼 / 缩放 / 平移 / 触摸 / 自动旋转）
 * 不依赖 three 的 addons，可在 file:// 下直接运行
 * ============================================================= */
(function (global) {
  'use strict';
  const T = global.THREE;

  function Orbit(camera, dom, opts) {
    opts = opts || {};
    const api = {
      enabled: true,
      autoRotate: false,
      autoRotateSpeed: 0.055,
      minPhi: 0.10,
      maxPhi: 1.50,
      minRadius: 0.85,
      maxRadius: 7.5,
      damping: 7.5,
      panSpeed: 1.0,
    };

    const target = new T.Vector3(0, 0.78, -0.55);
    const targetD = target.clone();
    let theta = 0.62, phi = 1.06, radius = 3.35;
    let thetaD = theta, phiD = phi, radiusD = radius;

    let dragging = 0;           // 0 无 / 1 旋转 / 2 平移
    let lastX = 0, lastY = 0;
    const pointers = new Map();
    let pinchDist = 0;

    const tmp = new T.Vector3();
    const right = new T.Vector3();
    const up = new T.Vector3();

    function onDown(e) {
      if (!api.enabled) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        dragging = (e.button === 2 || e.shiftKey || e.ctrlKey) ? 2 : 1;
        lastX = e.clientX; lastY = e.clientY;
      } else if (pointers.size === 2) {
        const p = Array.from(pointers.values());
        pinchDist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        dragging = 2;
      }
      if (dom.setPointerCapture) { try { dom.setPointerCapture(e.pointerId); } catch (err) {} }
    }

    function onMove(e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const w = dom.clientWidth || 1, h = dom.clientHeight || 1;

      if (pointers.size === 2) {
        const p = Array.from(pointers.values());
        const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        if (pinchDist > 0) radiusD = clamp(radiusD * (pinchDist / Math.max(1, d)), api.minRadius, api.maxRadius);
        pinchDist = d;
        return;
      }
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;

      if (dragging === 1) {
        thetaD -= (dx / w) * Math.PI * 2.0;
        phiD = clamp(phiD - (dy / h) * Math.PI * 1.1, api.minPhi, api.maxPhi);
      } else {
        // 沿相机平面平移
        camera.getWorldDirection(tmp);
        right.crossVectors(camera.up, tmp).normalize();
        up.crossVectors(tmp, right).normalize();
        const k = radius * 0.0016 * api.panSpeed;
        targetD.addScaledVector(right, dx * k);
        targetD.addScaledVector(up, -dy * k);
        targetD.y = clamp(targetD.y, 0.05, 2.2);
      }
    }

    function onUp(e) {
      pointers.delete(e.pointerId);
      if (pointers.size === 0) dragging = 0;
      else if (pointers.size === 1) {
        const p = Array.from(pointers.values())[0];
        lastX = p.x; lastY = p.y; dragging = 1; pinchDist = 0;
      }
    }

    function onWheel(e) {
      if (!api.enabled) return;
      e.preventDefault();
      const s = Math.exp((e.deltaY > 0 ? 1 : -1) * Math.min(0.28, Math.abs(e.deltaY) / 420 + 0.06));
      radiusD = clamp(radiusD * s, api.minRadius, api.maxRadius);
    }

    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

    dom.addEventListener('pointerdown', onDown);
    global.addEventListener('pointermove', onMove);
    global.addEventListener('pointerup', onUp);
    global.addEventListener('pointercancel', onUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('contextmenu', (e) => e.preventDefault());

    api.update = function (dt) {
      if (api.autoRotate && !dragging) thetaD += api.autoRotateSpeed * dt;
      const k = 1 - Math.exp(-api.damping * Math.min(0.1, dt));
      theta += (thetaD - theta) * k;
      phi += (phiD - phi) * k;
      radius += (radiusD - radius) * k;
      target.lerp(targetD, k);

      const sp = Math.sin(phi), cp = Math.cos(phi);
      camera.position.set(
        target.x + radius * sp * Math.sin(theta),
        target.y + radius * cp,
        target.z + radius * sp * Math.cos(theta)
      );
      camera.lookAt(target);
    };

    api.setView = function (v, instant) {
      if (v.theta !== undefined) thetaD = v.theta;
      if (v.phi !== undefined) phiD = clamp(v.phi, api.minPhi, api.maxPhi);
      if (v.radius !== undefined) radiusD = clamp(v.radius, api.minRadius, api.maxRadius);
      if (v.target) targetD.copy(v.target);
      if (instant) { theta = thetaD; phi = phiD; radius = radiusD; target.copy(targetD); }
    };

    api.getState = function () { return { theta, phi, radius, target: target.clone() }; };
    api.target = target;
    api.dispose = function () {
      dom.removeEventListener('pointerdown', onDown);
      global.removeEventListener('pointermove', onMove);
      global.removeEventListener('pointerup', onUp);
      dom.removeEventListener('wheel', onWheel);
    };
    return api;
  }

  global.Orbit = Orbit;
})(typeof window !== 'undefined' ? window : globalThis);
