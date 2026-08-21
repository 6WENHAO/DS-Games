/* =============================================================
 * app.js —— 场景、灯光、交互、动画与演示曲
 * ============================================================= */
(function (global) {
  'use strict';
  const T = global.THREE;
  const G = global.Geom;

  let renderer, scene, camera, controls, clock;
  let piano, keyByMidi = new Map();
  let raycaster, pointerNDC = new T.Vector2();
  let ground, blobs = [];
  const state = {
    lid: 0, lidT: 1,            // 0 关 / 1 全开（0.55 半开）
    fall: 1, fallT: 1,          // 键盘盖 0 关 / 1 开
    desk: 1, deskT: 1,
    pedal: [0, 0, 0], pedalT: [0, 0, 0],
    sustain: false,
    contrast: false,
    demo: null,
    fps: 60, frames: 0, fpsTime: 0,
  };
  const MAX_KEY_ANGLE = 0.0465;
  const HAMMER_STRIKE = 0.44;

  /* ---------------- 初始化 ---------------- */
  function init() {
    const host = document.getElementById('stage');
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.setClearAlpha(0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = T.SRGBColorSpace;
    else if ('outputEncoding' in renderer) renderer.outputEncoding = T.sRGBEncoding;
    if ('useLegacyLights' in renderer) renderer.useLegacyLights = false;
    host.appendChild(renderer.domElement);

    scene = new T.Scene();
    scene.fog = new T.Fog(0xe9ecf1, 7.0, 20);

    camera = new T.PerspectiveCamera(38, host.clientWidth / host.clientHeight, 0.05, 60);
    controls = global.Orbit(camera, renderer.domElement);
    controls.setView({ theta: 0.70, phi: 0.98, radius: 4.15, target: new T.Vector3(0, 0.88, -0.62) }, true);

    clock = new T.Clock();
    raycaster = new T.Raycaster();

    buildEnvironment();
    buildLights();
    buildGround();

    piano = global.Piano.build();
    scene.add(piano.root);
    piano.keys.forEach((k) => keyByMidi.set(k.midi, k));

    // 初始姿态：琴盖全开、键盘盖打开
    applyLid(1, true);
    applyFallboard(1, true);

    bindUI();
    bindPointer();
    bindKeyboard();
    global.addEventListener('resize', onResize);
    onResize();

    const loading = document.getElementById('loading');
    if (loading) { loading.classList.add('hide'); setTimeout(() => loading.remove(), 700); }
    animate();
  }

  /* ---------------- 程序化环境贴图（白色摄影棚） ---------------- */
  function buildEnvironment() {
    const envScene = new T.Scene();
    const panel = (w, h, color, pos, rot) => {
      const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ side: T.DoubleSide }));
      m.material.color.copy(color);
      m.position.set(pos[0], pos[1], pos[2]);
      if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
      envScene.add(m);
      return m;
    };
    const C = (v) => new T.Color(v, v, v);
    // 房间六面（微冷白）
    // 房间六面整体压暗，只留顶部与右上柔光箱明亮：
    // 白漆表面才会出现明确的明暗过渡，而不是被均匀白光糊成一片
    panel(30, 30, C(0.20), [0, 0, -12], [0, 0, 0]);
    panel(30, 30, C(0.15), [0, 0, 12], [0, Math.PI, 0]);
    panel(24, 24, C(0.09), [-12, 0, 0], [0, Math.PI / 2, 0]);
    panel(24, 24, C(0.26), [12, 0, 0], [0, -Math.PI / 2, 0]);
    panel(30, 30, C(0.12), [0, -6, 0], [-Math.PI / 2, 0, 0]);
    panel(30, 30, C(0.60), [0, 9, 0], [Math.PI / 2, 0, 0]);
    // 主柔光箱 + 侧光 + 顶部长条灯（HDR 亮度 > 1）
    panel(9, 6, C(5.4), [3.5, 6.2, 2.2], [Math.PI / 2 - 0.35, 0, 0]);
    panel(6, 5, C(1.3), [-7, 3.4, 1.5], [0, Math.PI / 2, 0]);
    panel(14, 1.1, C(3.4), [0, 7.4, -3.2], [Math.PI / 2, 0, 0]);
    panel(3.4, 3.4, C(1.0), [1.0, 1.2, 7.5], [0, Math.PI, 0]);

    const pmrem = new T.PMREMGenerator(renderer);
    const rt = pmrem.fromScene(envScene, 0.025);
    scene.environment = rt.texture;
    pmrem.dispose();
    envScene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  }

  /* ---------------- 灯光 ---------------- */
  function buildLights() {
    const hemi = new T.HemisphereLight(0xffffff, 0xb4bcc9, 0.30);
    scene.add(hemi);

    const key = new T.DirectionalLight(0xffffff, 3.10);
    key.position.set(2.15, 4.75, 1.55);
    key.target.position.set(0, 0.72, -0.75);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const s = key.shadow.camera;
    s.left = -2.0; s.right = 2.0; s.top = 2.4; s.bottom = -2.4; s.near = 0.6; s.far = 9.5;
    key.shadow.bias = -0.00035;
    key.shadow.normalBias = 0.012;
    key.shadow.radius = 2.2;
    scene.add(key, key.target);

    const fill = new T.DirectionalLight(0xeef3ff, 0.34);
    fill.position.set(-3.2, 2.2, -1.4);
    scene.add(fill);

    const rim = new T.DirectionalLight(0xffffff, 0.42);
    rim.position.set(-0.6, 1.4, -4.2);
    scene.add(rim);
  }

  /* ---------------- 地面与接地阴影 ---------------- */
  function buildGround() {
    const mat = new T.MeshPhysicalMaterial({
      color: 0xdfe3ea, roughness: 0.44, metalness: 0.0,
      clearcoat: 0.30, clearcoatRoughness: 0.45, envMapIntensity: 0.45,
    });
    ground = new T.Mesh(new T.CircleGeometry(16, 72), mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const tex = G.contactShadow(256);
    const blobMat = new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.55, depthWrite: false });
    const add = (x, z, sx, sz, op) => {
      const m = new T.Mesh(new T.PlaneGeometry(sx, sz), blobMat.clone());
      m.material.opacity = op;
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.0015, z);
      m.renderOrder = 1;
      scene.add(m);
      blobs.push(m);
    };
    // 接地阴影：让纯白琴体与浅色地面之间有明确的"落地感"
    add(0.02, -1.02, 3.1, 4.1, 0.60);
    add(0, -0.17, 1.95, 0.95, 0.52);
    add(-0.655, -0.215, 0.52, 0.52, 0.75);
    add(0.655, -0.215, 0.52, 0.52, 0.75);
    add(-0.045, -1.90, 0.52, 0.52, 0.75);
    add(0, -0.12, 0.62, 0.50, 0.45);
  }

  /* ---------------- 开合动作 ---------------- */
  function applyLid(v, instant) {
    state.lidT = v;
    if (instant) state.lid = v;
  }
  function applyFallboard(v, instant) {
    state.fallT = v; state.deskT = v;
    if (instant) { state.fall = v; state.desk = v; }
  }

  const LID_FULL = 0.80;      // 全开角度（弧度，约 46°）
  const FOLD = Math.PI;       // 前折翻转
  const IDENT_Q = new T.Quaternion();
  const ONE_V = new T.Vector3(1, 1, 1);

  function updateOpenables(dt) {
    const k = 1 - Math.exp(-3.2 * dt);
    state.lid += (state.lidT - state.lid) * k;
    state.fall += (state.fallT - state.fall) * k;
    state.desk += (state.deskT - state.desk) * k;

    const p = piano.parts;
    const lidAngle = state.lid * LID_FULL;
    p.lid.rotation.z = lidAngle;
    // 前折：琴盖开启前先翻折到主盖背上
    const fold = Math.min(1, state.lid / 0.42);
    p.frontLid.rotation.x = -FOLD * fold;

    // 键盘盖（两折）与谱架
    p.fallboard.rotation.x = -Math.PI * state.fall;
    p.fallboardFold.rotation.x = Math.PI * state.fall;
    p.desk.rotation.x = 1.40 - 1.72 * state.desk;

    // 支撑杆：在侧板插座与琴盖内侧之间求解位置
    const st = p.stick;
    if (state.lid > 0.08) {
      st.group.visible = true;
      const a = p.stickAnchorCase.clone();
      const b = p.lid.localToWorld(p.stickAnchorLid.clone());
      st.rod.matrixAutoUpdate = false;
      st.foot.matrixAutoUpdate = false;
      piano.cylBetween(st.rod.matrix, a, b, 1);
      st.foot.matrix.compose(a, IDENT_Q, ONE_V);
    } else {
      st.group.visible = false;
    }
  }

  /* ---------------- 琴键 / 弦槌 / 制音器动画 ---------------- */
  function pressKey(midi, vel, fromUser) {
    const k = keyByMidi.get(midi);
    if (!k) return;
    k.target = 1;
    k.held = true;
    const h = piano.hammers.info[midi - 21];
    if (h) { h.t = 0; h.active = true; h.power = Math.max(0.35, Math.min(1, vel)); }
    global.PianoAudio.noteOn(midi, vel);
    showNote(k.name, vel);
    if (fromUser) flashHint();
  }
  function releaseKey(midi) {
    const k = keyByMidi.get(midi);
    if (!k) return;
    k.target = 0;
    k.held = false;
    global.PianoAudio.noteOff(midi);
  }

  function updateKeys(dt) {
    const kk = 1 - Math.exp(-26 * dt);
    const ku = 1 - Math.exp(-15 * dt);
    piano.keys.forEach((k) => {
      const t = k.target;
      k.angle += (t - k.angle) * (t > k.angle ? kk : ku);
      k.mesh.rotation.x = k.angle * MAX_KEY_ANGLE;
    });

    // 弦槌：击弦上扬 + 回落
    let dirty = false;
    const info = piano.hammers.info;
    for (let i = 0; i < info.length; i++) {
      const h = info[i];
      if (!h.active) {
        if (h.angle > 0.0002) { h.angle *= Math.exp(-14 * dt); dirty = true; }
        else if (h.angle !== 0) { h.angle = 0; dirty = true; }
        continue;
      }
      h.t += dt;
      const rise = 0.062, fall = 0.11;
      if (h.t < rise) h.angle = HAMMER_STRIKE * h.power * Math.sin((h.t / rise) * Math.PI / 2);
      else {
        const u = (h.t - rise) / fall;
        h.angle = HAMMER_STRIKE * h.power * Math.max(0, Math.cos(Math.min(1, u) * Math.PI / 2));
        if (h.t > rise + fall) { h.active = false; h.angle = 0; }
      }
      dirty = true;
    }
    if (dirty) piano.hammers.write();

    // 制音器：按键或延音踏板时抬起
    let dDirty = false;
    const dinfo = piano.dampers.info;
    for (let i = 0; i < dinfo.length; i++) {
      const d = dinfo[i];
      const key = keyByMidi.get(21 + i);
      const want = (state.sustain || (key && key.held)) ? 0.017 : 0;
      if (Math.abs(d.lift - want) > 0.00005) {
        d.lift += (want - d.lift) * (1 - Math.exp(-18 * dt));
        dDirty = true;
      }
    }
    if (dDirty) piano.dampers.write();

    // 踏板
    const pk = 1 - Math.exp(-18 * dt);
    piano.parts.pedals.forEach((p, i) => {
      state.pedal[i] += (state.pedalT[i] - state.pedal[i]) * pk;
      p.pivot.rotation.x = -0.085 * state.pedal[i];
    });
  }

  /* ---------------- 交互：鼠标 / 触摸弹奏 ---------------- */
  let activePointerKey = null;
  function hitKey(ev) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNDC.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObjects(piano.keysGroup.children, false);
    if (!hits.length) return null;
    const midi = hits[0].object.userData.midi;
    return { midi, point: hits[0].point };
  }

  function bindPointer() {
    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', (e) => {
      global.PianoAudio.init();
      const hit = hitKey(e);
      if (hit) {
        e.stopPropagation();
        controls.enabled = false;
        activePointerKey = hit.midi;
        pressKey(hit.midi, 0.72 + Math.random() * 0.2, true);
      }
    }, true);
    global.addEventListener('pointermove', (e) => {
      if (activePointerKey === null) return;
      const hit = hitKey(e);
      if (hit && hit.midi !== activePointerKey) {
        releaseKey(activePointerKey);
        activePointerKey = hit.midi;
        pressKey(hit.midi, 0.62 + Math.random() * 0.18, false);
      }
    });
    const up = () => {
      if (activePointerKey !== null) { releaseKey(activePointerKey); activePointerKey = null; }
      controls.enabled = true;
    };
    global.addEventListener('pointerup', up);
    global.addEventListener('pointercancel', up);
  }

  /* ---------------- 交互：电脑键盘 ---------------- */
  const KEYMAP = {
    KeyZ: 0, KeyS: 1, KeyX: 2, KeyD: 3, KeyC: 4, KeyV: 5, KeyG: 6, KeyB: 7,
    KeyH: 8, KeyN: 9, KeyJ: 10, KeyM: 11, Comma: 12, KeyL: 13, Period: 14, Semicolon: 15, Slash: 16,
    KeyQ: 12, Digit2: 13, KeyW: 14, Digit3: 15, KeyE: 16, KeyR: 17, Digit5: 18, KeyT: 19,
    Digit6: 20, KeyY: 21, Digit7: 22, KeyU: 23, KeyI: 24, Digit9: 25, KeyO: 26, Digit0: 27, KeyP: 28,
  };
  let baseMidi = 48;
  const down = new Set();

  function bindKeyboard() {
    global.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setSustain(true);
        return;
      }
      if (e.code === 'ArrowLeft') { baseMidi = Math.max(21, baseMidi - 12); toast('八度 −  (基准 ' + noteName(baseMidi) + ')'); return; }
      if (e.code === 'ArrowRight') { baseMidi = Math.min(84, baseMidi + 12); toast('八度 +  (基准 ' + noteName(baseMidi) + ')'); return; }
      const off = KEYMAP[e.code];
      if (off === undefined) return;
      const midi = baseMidi + off;
      if (midi < 21 || midi > 108 || down.has(midi)) return;
      down.add(midi);
      global.PianoAudio.init();
      pressKey(midi, 0.8, true);
    });
    global.addEventListener('keyup', (e) => {
      if (e.code === 'Space') { setSustain(false); return; }
      const off = KEYMAP[e.code];
      if (off === undefined) return;
      const midi = baseMidi + off;
      if (!down.has(midi)) return;
      down.delete(midi);
      releaseKey(midi);
    });
    global.addEventListener('blur', () => {
      down.forEach((m) => releaseKey(m));
      down.clear();
      setSustain(false);
    });
  }

  function setSustain(on) {
    state.sustain = on;
    state.pedalT[2] = on ? 1 : 0;
    global.PianoAudio.setSustain(on);
    const el = document.getElementById('pedal-ind');
    if (el) el.classList.toggle('on', on);
  }

  /* ---------------- 演示曲：《致爱丽丝》主题 ---------------- */
  const NOTE_BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function nm(s) {
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(s);
    if (!m) return 60;
    let v = NOTE_BASE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return v + (parseInt(m[3], 10) + 1) * 12;
  }
  function noteName(midi) {
    return global.Piano.NOTE_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
  }

  const THEME = [
    ['E5', 1], ['D#5', 1], ['E5', 1], ['D#5', 1], ['E5', 1], ['B4', 1], ['D5', 1], ['C5', 1],
    ['A4', 3], ['C4', 1], ['E4', 1], ['A4', 1],
    ['B4', 3], ['E4', 1], ['G#4', 1], ['B4', 1],
    ['C5', 3], ['E4', 1],
  ];
  const CODA = [
    ['E5', 1], ['D#5', 1], ['E5', 1], ['D#5', 1], ['E5', 1], ['B4', 1], ['D5', 1], ['C5', 1],
    ['A4', 3], ['C4', 1], ['E4', 1], ['A4', 1],
    ['B4', 3], ['E4', 1], ['C5', 1], ['B4', 1],
    ['A4', 6],
  ];
  const BASS_BLOCK = [
    [null, 8], ['A2', 1], ['E3', 1], ['A3', 1], [null, 3],
    ['E2', 1], ['E3', 1], ['G#3', 1], [null, 3],
    ['A2', 1], ['E3', 1], ['A3', 1], [null, 1],
  ];
  const UNIT = 0.188;

  function buildDemo() {
    const ev = [];
    const mel = THEME.concat(CODA);
    let t = 0;
    mel.forEach((n) => {
      const midi = nm(n[0]);
      const dur = n[1] * UNIT;
      ev.push({ t, type: 'on', midi, vel: 0.62 + Math.random() * 0.16 });
      ev.push({ t: t + dur * 0.94, type: 'off', midi });
      t += dur;
    });
    const total = t;
    t = 0;
    const bass = BASS_BLOCK.concat(BASS_BLOCK);
    bass.forEach((n) => {
      const dur = n[1] * UNIT;
      if (n[0]) {
        const midi = nm(n[0]);
        ev.push({ t, type: 'on', midi, vel: 0.42 + Math.random() * 0.1 });
        ev.push({ t: t + dur * 2.4, type: 'off', midi });
      }
      t += dur;
    });
    // 结尾的 A 小三和弦
    ['A2', 'E3', 'A3'].forEach((n, i) => {
      const tt = total - UNIT * 6 + i * UNIT;
      ev.push({ t: tt, type: 'on', midi: nm(n), vel: 0.44 });
      ev.push({ t: tt + UNIT * 6, type: 'off', midi: nm(n) });
    });
    // 踏板：每个左手琶音处踩下
    [[8, 11.6], [14, 17.6], [20, 23.6], [32, 35.6], [38, 41.6], [44, 47.6], [47.5, 54]].forEach((p) => {
      ev.push({ t: p[0] * UNIT, type: 'pedal', on: true });
      ev.push({ t: p[1] * UNIT, type: 'pedal', on: false });
    });
    ev.sort((a, b) => a.t - b.t);
    return { events: ev, duration: total + 2.4 };
  }

  function startDemo() {
    stopDemo();
    global.PianoAudio.init();
    const d = buildDemo();
    state.demo = { ...d, i: 0, t0: performance.now() / 1000, active: [] };
    setButton('btn-demo', true, '停止演奏');
    if (state.fallT < 1) applyFallboard(1);
    if (state.lidT < 0.5) applyLid(1);
  }
  function stopDemo() {
    if (!state.demo) return;
    state.demo.active.forEach((m) => releaseKey(m));
    state.demo = null;
    setSustain(false);
    setButton('btn-demo', false, '演奏《致爱丽丝》');
  }
  function updateDemo() {
    const d = state.demo;
    if (!d) return;
    const now = performance.now() / 1000 - d.t0;
    while (d.i < d.events.length && d.events[d.i].t <= now) {
      const e = d.events[d.i++];
      if (e.type === 'on') { pressKey(e.midi, e.vel, false); d.active.push(e.midi); }
      else if (e.type === 'off') {
        releaseKey(e.midi);
        const idx = d.active.indexOf(e.midi);
        if (idx >= 0) d.active.splice(idx, 1);
      } else if (e.type === 'pedal') setSustain(e.on);
    }
    if (now > d.duration) { stopDemo(); }
  }

  /* ---------------- UI ---------------- */
  const VIEWS = {
    front: { theta: 0.0, phi: 1.00, radius: 3.95, target: new T.Vector3(0, 0.88, -0.62) },
    player: { theta: 0.0, phi: 0.72, radius: 1.62, target: new T.Vector3(0, 0.76, -0.12) },
    top: { theta: 0.22, phi: 0.21, radius: 5.00, target: new T.Vector3(0, 0.80, -1.18) },
    side: { theta: 1.45, phi: 0.96, radius: 4.05, target: new T.Vector3(0, 0.88, -0.85) },
    tail: { theta: 3.05, phi: 0.90, radius: 3.85, target: new T.Vector3(0, 0.92, -1.15) },
    detail: { theta: 0.50, phi: 0.80, radius: 1.10, target: new T.Vector3(-0.08, 0.76, -0.16) },
  };

  function setButton(id, on, label) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('on', !!on);
    if (label) el.textContent = label;
  }

  function bindUI() {
    document.querySelectorAll('[data-view]').forEach((b) => {
      b.addEventListener('click', () => {
        controls.setView(VIEWS[b.dataset.view]);
        document.querySelectorAll('[data-view]').forEach((o) => o.classList.remove('on'));
        b.classList.add('on');
      });
    });

    const lidBtn = document.getElementById('btn-lid');
    lidBtn.addEventListener('click', () => {
      const next = state.lidT > 0.75 ? 0.52 : state.lidT > 0.1 ? 0 : 1;
      applyLid(next);
      lidBtn.textContent = next > 0.75 ? '琴盖：全开' : next > 0.1 ? '琴盖：半开' : '琴盖：关闭';
      lidBtn.classList.toggle('on', next > 0.1);
    });

    const fbBtn = document.getElementById('btn-fallboard');
    fbBtn.addEventListener('click', () => {
      const next = state.fallT > 0.5 ? 0 : 1;
      applyFallboard(next);
      fbBtn.textContent = next ? '键盘盖：打开' : '键盘盖：合上';
      fbBtn.classList.toggle('on', !!next);
    });

    const rotBtn = document.getElementById('btn-rotate');
    rotBtn.addEventListener('click', () => {
      controls.autoRotate = !controls.autoRotate;
      rotBtn.classList.toggle('on', controls.autoRotate);
      rotBtn.textContent = controls.autoRotate ? '自动旋转：开' : '自动旋转：关';
    });

    document.getElementById('btn-demo').addEventListener('click', () => {
      if (state.demo) stopDemo(); else startDemo();
    });

    const ctBtn = document.getElementById('btn-contrast');
    ctBtn.addEventListener('click', () => {
      state.contrast = !state.contrast;
      const M = piano.materials;
      piano.keys.forEach((k) => {
        if (!k.white) k.mesh.material = state.contrast ? M.blackKeyContrast : M.blackKey;
      });
      ctBtn.classList.toggle('on', state.contrast);
      ctBtn.textContent = state.contrast ? '半音键：浅灰' : '半音键：纯白';
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
      controls.setView(VIEWS.front);
      controls.autoRotate = false;
      setButton('btn-rotate', false, '自动旋转：关');
      global.PianoAudio.panic();
      piano.keys.forEach((k) => { k.target = 0; k.held = false; });
      stopDemo();
      setSustain(false);
    });

    const vol = document.getElementById('vol');
    vol.addEventListener('input', () => global.PianoAudio.setVolume(parseFloat(vol.value)));
    const rev = document.getElementById('rev');
    rev.addEventListener('input', () => global.PianoAudio.setReverb(parseFloat(rev.value)));

    const panel = document.getElementById('panel');
    document.getElementById('btn-collapse').addEventListener('click', () => {
      panel.classList.toggle('collapsed');
    });

    // 屏幕上的三个踏板热区
    document.querySelectorAll('[data-pedal]').forEach((el) => {
      const idx = parseInt(el.dataset.pedal, 10);
      const on = (v) => {
        state.pedalT[idx] = v ? 1 : 0;
        el.classList.toggle('on', !!v);
        if (idx === 2) setSustain(!!v);
        if (idx === 0) global.PianoAudio.setSoft(!!v);
      };
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); global.PianoAudio.init(); on(true); });
      global.addEventListener('pointerup', () => on(false));
    });
  }

  let noteTimer = 0;
  function showNote(name, vel) {
    const el = document.getElementById('note-read');
    if (!el) return;
    el.textContent = name;
    el.style.opacity = String(0.55 + vel * 0.45);
    el.classList.add('pop');
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => el.classList.remove('pop'), 140);
  }
  let hintDone = false;
  function flashHint() {
    if (hintDone) return;
    hintDone = true;
    const h = document.getElementById('hint');
    if (h) h.classList.add('fade');
  }
  let toastTimer = 0;
  function toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1400);
  }

  /* ---------------- 主循环 ---------------- */
  function onResize() {
    const host = document.getElementById('stage');
    const w = host.clientWidth, h = host.clientHeight;
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, clock.getDelta());
    updateDemo();
    updateOpenables(dt);
    updateKeys(dt);
    controls.update(dt);
    renderer.render(scene, camera);

    state.frames++;
    state.fpsTime += dt;
    if (state.fpsTime > 0.5) {
      state.fps = Math.round(state.frames / state.fpsTime);
      state.frames = 0; state.fpsTime = 0;
      const el = document.getElementById('stat');
      if (el) {
        el.textContent = state.fps + ' FPS · 三角面 ' +
          (renderer.info.render.triangles / 1000).toFixed(0) + 'k · 发声 ' + global.PianoAudio.activeVoices;
      }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  global.PianoApp = {
    get piano() { return piano; },
    get state() { return state; },
    get renderer() { return renderer; },
    get scene() { return scene; },
    get camera() { return camera; },
    get controls() { return controls; },
    startDemo, stopDemo,
  };
})(typeof window !== 'undefined' ? window : globalThis);
