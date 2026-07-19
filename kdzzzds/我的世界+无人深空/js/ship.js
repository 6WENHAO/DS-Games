// ============ 体素星舰 ============
const Ship = (() => {
  let group = null;          // 飞船整体
  let thrusterGlows = [];    // 引擎光
  let landingGear = [];
  let camera = null;

  // 飞行状态
  const state = {
    mode: 'landed',          // landed | takeoff | atmo | landing | space
    pos: new THREE.Vector3(),
    yaw: 0, pitch: 0, roll: 0,
    speed: 0, throttle: 0,
    pulseCharge: 1,
    pulsing: false,
  };

  // 修复状态
  const repairs = [
    { key: 'thruster', name: '起飞推进器', icon: 'metalplate', req: [['metalplate', 1], ['dihygel', 1]], fixed: false },
    { key: 'pulse', name: '脉冲引擎', icon: 'nanotube', req: [['nanotube', 1], ['metalplate', 1]], fixed: false },
  ];
  function allRepaired() { return repairs.every(r => r.fixed); }

  // ---------- 体素建模工具 ----------
  function vox(parent, x, y, z, w, h, d, color, emissive = 0) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshLambertMaterial({ color, emissive: emissive ? color : 0x000000, emissiveIntensity: emissive });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  // ---------- 建造飞船 (MC 体素风战机) ----------
  function build(scene) {
    group = new THREE.Group();
    thrusterGlows = [];
    landingGear = [];

    const HULL = 0xc8cdd4, HULL_D = 0x8a929c, ACCENT = 0xe8842a, DARK = 0x3a4048, GLASS = 0x7fd8f0;

    // 机身主体 (细长, 前尖)
    vox(group, 0, 0.55, 0.3, 1.4, 1.0, 3.6, HULL);           // 中央机身
    vox(group, 0, 0.5, -2.0, 1.0, 0.75, 1.4, HULL);          // 机鼻中段
    vox(group, 0, 0.45, -3.0, 0.62, 0.5, 0.9, HULL_D);       // 机鼻尖
    vox(group, 0, 0.42, -3.62, 0.3, 0.28, 0.5, ACCENT);      // 鼻锥
    vox(group, 0, 1.28, 0.9, 1.0, 0.5, 1.8, HULL_D);         // 背脊
    vox(group, 0, 0.1, 0.3, 1.7, 0.28, 3.0, HULL_D);         // 腹板

    // 驾驶舱
    vox(group, 0, 1.3, -0.9, 0.85, 0.62, 1.2, GLASS, 0.35);
    vox(group, 0, 1.62, -0.5, 0.7, 0.18, 0.9, HULL_D);

    // 机翼 (后掠式)
    [-1, 1].forEach(s => {
      vox(group, s * 1.6, 0.45, 0.7, 1.9, 0.22, 1.7, HULL);
      vox(group, s * 2.8, 0.45, 1.1, 0.6, 0.22, 1.1, HULL_D);
      vox(group, s * 3.25, 0.45, 1.15, 0.28, 0.6, 0.9, ACCENT);   // 翼尖立板
      vox(group, s * 1.5, 0.48, 1.75, 1.4, 0.3, 0.4, ACCENT);     // 翼后缘条
      // 翼下挂架小灯
      vox(group, s * 2.2, 0.2, 0.9, 0.18, 0.18, 0.4, 0xffd080, 0.8);
    });

    // 垂尾
    vox(group, 0, 1.9, 1.9, 0.22, 1.1, 1.0, HULL_D);
    vox(group, 0, 2.45, 2.1, 0.24, 0.3, 0.6, ACCENT);

    // 引擎舱 ×2
    [-1, 1].forEach(s => {
      vox(group, s * 0.95, 0.55, 2.1, 0.8, 0.8, 1.3, DARK);
      vox(group, s * 0.95, 0.55, 2.6, 0.66, 0.66, 0.3, 0x222629);
      const glow = vox(group, s * 0.95, 0.55, 2.82, 0.5, 0.5, 0.14, 0x66d9ff, 1.0);
      glow.material.transparent = true;
      thrusterGlows.push(glow);
    });
    // 底部升力口
    [[-0.6, 0.9], [0.6, 0.9], [-0.6, -1.0], [0.6, -1.0]].forEach(([x, z]) => {
      const g = vox(group, x, 0.06, z, 0.34, 0.1, 0.34, 0x66d9ff, 1.0);
      g.material.transparent = true;
      thrusterGlows.push(g);
    });

    // 起落架
    [[-0.9, 0.9], [0.9, 0.9], [0, -1.6]].forEach(([x, z]) => {
      const leg = vox(group, x, -0.35, z, 0.16, 0.7, 0.16, DARK);
      vox(group, x, -0.72, z, 0.4, 0.12, 0.5, 0x2a2e33);
      landingGear.push(leg);
    });

    // 细节: 舷灯
    vox(group, -3.25, 0.85, 1.15, 0.12, 0.12, 0.12, 0xff4040, 1.0);
    vox(group, 3.25, 0.85, 1.15, 0.12, 0.12, 0.12, 0x40ff60, 1.0);

    group.scale.setScalar(1.15);
    scene.add(group);
    return group;
  }

  function setCamera(cam) { camera = cam; }

  function placeLanded(x, z, crashed = false) {
    const y = World.flattenPad(x, z, 4);
    state.pos.set(x, y + 0.85, z);
    state.yaw = crashed ? 0.5 : 0;
    state.pitch = 0; state.roll = crashed ? 0.12 : 0;
    state.mode = 'landed';
    state.speed = 0; state.throttle = 0;
    if (group) {
      group.position.copy(state.pos);
      group.rotation.set(state.pitch, state.yaw, state.roll, 'YXZ');
      group.visible = true;
    }
    setThrusterIntensity(0);
  }

  function setThrusterIntensity(v) {
    thrusterGlows.forEach(g => {
      g.material.emissiveIntensity = v * (0.8 + Math.random() * 0.4);
      g.material.opacity = 0.3 + v * 0.7;
      const s = 1 + v * 0.25 * Math.random();
      g.scale.set(s, s, 1 + v * 2.2);
    });
  }

  // ---------- 起飞动画 ----------
  let anim = null;
  function takeoff(onDone) {
    state.mode = 'takeoff';
    Sfx.launch();
    anim = { t: 0, dur: 3.2, startPos: state.pos.clone(), onDone };
  }

  // ---------- 降落 ----------
  function land(onDone) {
    state.mode = 'landing';
    const gx = state.pos.x, gz = state.pos.z;
    const gy = World.flattenPad(gx, gz, 4) + 0.85;
    anim = { t: 0, dur: 2.6, startPos: state.pos.clone(), endPos: new THREE.Vector3(gx, gy, gz), startYaw: state.yaw, startPitch: state.pitch, onDone };
    Sfx.shipThrottle(0.25);
  }

  // ---------- 飞行控制 ----------
  const flightKeys = {};
  function setKey(code, down) { flightKeys[code] = down; }
  let mouseX = 0, mouseY = 0;
  function onMouseMove(dx, dy) {
    mouseX = THREE.MathUtils.clamp(mouseX + dx * 0.0016, -1, 1);
    mouseY = THREE.MathUtils.clamp(mouseY + dy * 0.0016, -1, 1);
  }

  function updateFlight(dt, inSpace) {
    // 转向 (鼠标偏移 = 角速度)
    const turnRate = state.pulsing ? 0.25 : 1.4;
    state.yaw -= mouseX * dt * turnRate;
    state.pitch -= mouseY * dt * turnRate * 0.85;
    state.pitch = THREE.MathUtils.clamp(state.pitch, -1.2, 1.2);
    const targetRoll = -mouseX * 0.7;
    state.roll += (targetRoll - state.roll) * Math.min(1, dt * 4);
    mouseX *= Math.pow(0.05, dt); mouseY *= Math.pow(0.05, dt);

    // 油门
    const maxSpeed = inSpace ? (state.pulsing ? 900 : 80) : 55;
    const minSpeed = inSpace ? 0 : 14;
    if (flightKeys['KeyW']) state.throttle = Math.min(1, state.throttle + dt * 0.8);
    if (flightKeys['KeyS']) state.throttle = Math.max(0, state.throttle - dt * 1.2);
    let target = minSpeed + (maxSpeed - minSpeed) * state.throttle;
    if (state.pulsing) target = maxSpeed;
    state.speed += (target - state.speed) * Math.min(1, dt * (state.pulsing ? 0.8 : 2.2));

    // 方向
    const dir = new THREE.Vector3(
      -Math.sin(state.yaw) * Math.cos(state.pitch),
      Math.sin(state.pitch),
      -Math.cos(state.yaw) * Math.cos(state.pitch)
    );
    state.pos.add(dir.multiplyScalar(state.speed * dt));

    // 大气内不许钻地
    if (!inSpace) {
      const ground = World.surfaceHeight(state.pos.x, state.pos.z);
      if (state.pos.y < ground + 3) { state.pos.y = ground + 3; state.pitch = Math.max(0, state.pitch); }
      if (state.pos.y > 260) state.pos.y = 260;
    }

    Sfx.shipThrottle(state.pulsing ? 1 : state.throttle * 0.7 + state.speed / maxSpeed * 0.3);
    setThrusterIntensity(0.4 + state.throttle * 0.6 + (state.pulsing ? 1 : 0));

    // 脉冲能量
    if (state.pulsing) {
      state.pulseCharge -= dt * 0.06;
      if (state.pulseCharge <= 0) { state.pulseCharge = 0; setPulse(false); }
    } else {
      state.pulseCharge = Math.min(1, state.pulseCharge + dt * 0.02);
    }

    applyTransform();
  }

  function setPulse(on) {
    if (on && (state.pulseCharge < 0.15 || !repairs[1].fixed)) { Sfx.error(); return; }
    if (on === state.pulsing) return;
    state.pulsing = on;
    if (on) { Sfx.pulseEngage(); UI.warpLines(true); }
    else { Sfx.pulseDisengage(); UI.warpLines(false); }
  }

  function applyTransform() {
    group.position.copy(state.pos);
    group.rotation.set(state.pitch, state.yaw, state.roll, 'YXZ');
  }

  // 追尾相机
  const camOffset = new THREE.Vector3();
  function updateChaseCamera(dt, shake = 0) {
    const behind = new THREE.Vector3(
      Math.sin(state.yaw) * Math.cos(state.pitch * 0.5),
      0.32 - Math.sin(state.pitch) * 0.4,
      Math.cos(state.yaw) * Math.cos(state.pitch * 0.5)
    ).normalize().multiplyScalar(13);
    const targetPos = state.pos.clone().add(behind).add(new THREE.Vector3(0, 3.2, 0));
    camOffset.lerp(targetPos, Math.min(1, dt * 5));
    camera.position.copy(camOffset);
    if (shake > 0) {
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake;
      camera.position.z += (Math.random() - 0.5) * shake;
    }
    const lookAt = state.pos.clone().add(new THREE.Vector3(
      -Math.sin(state.yaw) * 8, Math.sin(state.pitch) * 8 + 1, -Math.cos(state.yaw) * 8
    ));
    camera.lookAt(lookAt);
  }
  function snapCamera() { camOffset.copy(camera.position); }

  // ---------- 动画更新 ----------
  function updateAnim(dt) {
    if (!anim) return false;
    anim.t += dt;
    const k = Math.min(1, anim.t / anim.dur);

    if (state.mode === 'takeoff') {
      const ease = k * k * (3 - 2 * k);
      // 先垂直升起, 再前倾加速
      state.pos.copy(anim.startPos);
      state.pos.y += ease * 30 + Math.max(0, k - 0.55) * 60;
      const fwd = Math.max(0, k - 0.5) * 2;
      state.pos.x += -Math.sin(state.yaw) * fwd * 22;
      state.pos.z += -Math.cos(state.yaw) * fwd * 22;
      state.pitch = Math.max(0, k - 0.5) * 0.5;
      state.roll *= (1 - k);
      setThrusterIntensity(0.5 + k);
      applyTransform();
      updateChaseCamera(dt, k * 0.25);
      if (k >= 1) {
        state.mode = 'atmo'; state.speed = 30; state.throttle = 0.5;
        const cb = anim.onDone; anim = null;
        if (cb) cb();
      }
      return true;
    }

    if (state.mode === 'landing') {
      const ease = k * k * (3 - 2 * k);
      state.pos.lerpVectors(anim.startPos, anim.endPos, ease);
      state.pitch = anim.startPitch * (1 - ease);
      state.roll *= (1 - ease * 0.1);
      state.yaw = anim.startYaw;
      setThrusterIntensity(1 - ease * 0.7);
      applyTransform();
      updateChaseCamera(dt, (1 - k) * 0.1);
      if (k >= 1) {
        state.mode = 'landed';
        Sfx.landingThud();
        Sfx.stopLoop('ship');
        setThrusterIntensity(0);
        const cb = anim.onDone; anim = null;
        if (cb) cb();
      }
      return true;
    }
    return false;
  }

  return {
    build, setCamera, placeLanded, takeoff, land, updateFlight, updateAnim, updateChaseCamera, snapCamera,
    setKey, onMouseMove, setPulse, setThrusterIntensity, applyTransform,
    state, repairs, allRepaired,
    get group() { return group; },
  };
})();
