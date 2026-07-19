// ============ 玩家控制器 (第一人称) ============
const Player = (() => {
  let camera = null, scene = null;
  const pos = new THREE.Vector3(0, 0, 0);
  let yaw = Math.PI, pitch = 0;
  const keys = {};
  const EYE = 1.58;
  let bobT = 0, bobAmp = 0;
  let breathT = 0;

  // 手电筒
  let torch = null, torchTarget = null, torchOn = false;
  let hasTorch = false;
  let battery = 1;
  let torchFlickT = 0;

  // 恐惧值 (影响视觉/音频)
  let fear = 0;
  let inputEnabled = true;
  let frozen = false;

  const _dir = new THREE.Vector3();

  function init(cam, sc) {
    camera = cam;
    scene = sc;
    // 手电筒 (SpotLight 挂相机)
    torch = new THREE.SpotLight(0xd8e2cf, 0, 18, 0.46, 0.5, 1.3);
    torch.castShadow = true;
    torch.shadow.mapSize.set(512, 512);
    torch.shadow.camera.near = 0.2;
    torch.shadow.camera.far = 16;
    torchTarget = new THREE.Object3D();
    scene.add(torch);
    scene.add(torchTarget);
    torch.target = torchTarget;
  }

  function spawn(x, z, yw) {
    pos.set(x, 0, z);
    yaw = yw;
    pitch = 0;
  }

  function setKey(code, down) { keys[code] = down; }

  function onMouseMove(mx, my) {
    if (!inputEnabled) return;
    yaw -= mx * 0.0021;
    pitch -= my * 0.0021;
    pitch = Math.max(-1.35, Math.min(1.35, pitch));
  }

  function giveTorch() {
    hasTorch = true;
    toggleTorch(true);
  }
  function toggleTorch(force) {
    if (!hasTorch) return;
    torchOn = force !== undefined ? force : !torchOn;
    Sfx.torchClick(torchOn);
    torch.intensity = torchOn ? 1.75 : 0;
  }
  function torchFlicker(dur = 1.2) {
    // 事件驱动的手电闪烁
    torchFlickT = dur;
  }

  function lookDir() {
    _dir.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    return _dir;
  }

  function update(dt) {
    // 移动
    let fx = 0, fz = 0;
    if (inputEnabled && !frozen) {
      if (keys['KeyW']) { fx -= Math.sin(yaw); fz -= Math.cos(yaw); }
      if (keys['KeyS']) { fx += Math.sin(yaw); fz += Math.cos(yaw); }
      if (keys['KeyA']) { fx -= Math.cos(yaw); fz += Math.sin(yaw); }
      if (keys['KeyD']) { fx += Math.cos(yaw); fz -= Math.sin(yaw); }
    }
    const len = Math.hypot(fx, fz);
    const running = keys['ShiftLeft'] && len > 0;
    const speed = running ? 3.1 : 1.65;
    if (len > 0) {
      fx /= len; fz /= len;
      // 分轴碰撞
      const nx = pos.x + fx * speed * dt;
      if (!World.collides(nx, pos.z)) pos.x = nx;
      const nz = pos.z + fz * speed * dt;
      if (!World.collides(pos.x, nz)) pos.z = nz;
      Sfx.footstep(running);
      bobAmp = Math.min(1, bobAmp + dt * 4);
    } else {
      bobAmp = Math.max(0, bobAmp - dt * 5);
    }
    bobT += dt * (running ? 11 : 7.2);
    breathT += dt;

    // 相机
    const bobY = Math.sin(bobT) * 0.028 * bobAmp;
    const bobX = Math.cos(bobT * 0.5) * 0.014 * bobAmp;
    const breath = Math.sin(breathT * 1.4) * 0.006 * (1 + fear);
    camera.position.set(pos.x + bobX, EYE + bobY + breath, pos.z);
    camera.rotation.set(0, 0, 0, 'YXZ');
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
    // 恐惧时轻微倾斜抖动
    if (fear > 0.3) {
      camera.rotation.z = Math.sin(breathT * 13) * 0.004 * fear;
    }

    // 手电筒跟随 (滞后摆动)
    const d = lookDir();
    torch.position.copy(camera.position);
    torch.position.y -= 0.12;
    const targetPos = camera.position.clone().addScaledVector(d, 6);
    torchTarget.position.lerp(targetPos, Math.min(1, dt * 9));
    // 手电闪烁事件
    if (torchFlickT > 0) {
      torchFlickT -= dt;
      torch.intensity = torchOn ? (Math.random() < 0.4 ? 0.1 : 1.5 + Math.random() * 0.4) : 0;
      if (torchFlickT <= 0 && torchOn) torch.intensity = 1.75;
    }
  }

  return {
    init, spawn, setKey, onMouseMove, update, lookDir,
    giveTorch, toggleTorch, torchFlicker,
    pos,
    get yaw() { return yaw; }, set yaw(v) { yaw = v; },
    get pitch() { return pitch; }, set pitch(v) { pitch = v; },
    get fear() { return fear; }, set fear(v) { fear = Math.max(0, Math.min(1, v)); },
    get hasTorch() { return hasTorch; },
    get torchOn() { return torchOn; },
    get inputEnabled() { return inputEnabled; }, set inputEnabled(v) { inputEnabled = v; },
    get frozen() { return frozen; }, set frozen(v) { frozen = v; },
    get battery() { return battery; },
  };
})();
