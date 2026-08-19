/* ============================================================================
 *  90 · 总装 / 交互 / 动画主循环
 * ==========================================================================*/

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ---------------------------------------------------------------- 总装 */
function buildHelicopter() {
  const heli = group('AH-64D-APACHE-LONGBOW');
  const fuse = buildFuselage();
  const canopy = buildCanopy();
  const interior = buildCockpitInterior();
  const nose = buildNoseSensors();
  const nacR = buildNacelle(1), nacL = buildNacelle(-1);
  const fin = buildFin();
  const stab = buildStabilator();
  const rotor = buildMainRotor();
  const trotor = buildTailRotor();
  const gun = buildGun();
  const wings = buildWings();
  const gear = buildGear();
  const det = buildDetails();

  heli.add(fuse, canopy, interior, nose.g, nacR, nacL, fin.g, stab.g,
    rotor.root, trotor.g, gun.g, wings, gear, det.g);

  /* 尾桨虚化盘 */
  const tdiscMat = MATS.disc.clone();
  tdiscMat.map = makeRotorDisc(2);
  tdiscMat.opacity = 0;
  const tdisc = mesh(new THREE.CircleGeometry(TAILROT.r * 1.01, 64), tdiscMat,
    { pos: [TAILROT.x, TAILROT.y, TAILROT.z - 0.02], shadow: false });
  tdisc.visible = false;
  tdisc.renderOrder = 5;
  heli.add(tdisc);

  const parts = {
    fuse, canopy, interior, nose, nacR, nacL, fin, stab, rotor, trotor, gun, wings, gear, det, tdisc,
  };
  /* 分解视图方向 */
  const explode = [
    [canopy, [0, 1, 0], 1.6], [interior, [0, 0.4, 0], 0.6],
    [nose.g, [1, 0, 0], 1.8],
    [nacR, [0, 0.55, 1], 1.4], [nacL, [0, 0.55, -1], 1.4],
    [rotor.root, [0, 1, 0], 2.6],
    [fin.g, [-1, 0.15, 0], 2.0], [trotor.g, [-1, 0.15, -0.35], 2.6], [stab.g, [-1, -0.1, 0], 1.4],
    [gun.g, [0.15, -1, 0], 1.5], [gear, [0, -1, 0], 1.1],
    [wings, [0, -0.15, 0], 0.9], [det.g, [0, 0.6, 0], 0.8],
  ].map(([o, d, a]) => ({ o, base: o.position.clone(), dir: new THREE.Vector3(...d).normalize(), amt: a }));

  return { heli, parts, explode };
}

/* ------------------------------------------------------------- 启动流程 */
async function boot() {
  const canvas = $('#gl');
  const loadTxt = $('#load-txt'), loadBar = $('#load-bar');
  let stepI = 0;
  const STEPS = 6;
  const DBG = /[?&]dbg/.test(location.search);
  const TIMES = [];
  const step = async (txt, fn) => {
    loadTxt.textContent = txt;
    loadBar.style.width = (stepI / STEPS * 100).toFixed(1) + '%';
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const t0 = performance.now();
    const out = fn ? fn() : null;
    stepI++;
    const ms = performance.now() - t0;
    TIMES.push([txt.slice(0, 22), Math.round(ms)]);
    if (DBG) console.warn('[step] ' + txt + ' : ' + ms.toFixed(0) + 'ms');
    return out;
  };
  window.__TIMES = TIMES;

  /* --- 渲染器 --- */
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: false, alpha: false, powerPreference: 'high-performance',
    stencil: false, depth: true, preserveDrawingBuffer: false,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.autoClear = false;
  renderer.toneMapping = THREE.NoToneMapping;       // 由后处理统一做 ACES
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  MAXANISO = renderer.capabilities.getMaxAnisotropy();

  await step('生成 PBR 贴图：军绿蒙皮 · 面板缝 · 铆钉 · 做旧', () => buildMaterials());
  const S = await step('烘焙程序化 HDR 环境 · 光照 · 停机坪', () => buildScene(renderer, canvas));
  const { scene, camera } = S;

  /* 分步装配（每步让出一帧以刷新进度条） */
  const model = await step('放样机身 · 座舱 · 旋翼 · 武器 · 起落架', () => buildHelicopter());
  scene.add(model.heli);
  await step('统计几何体与材质', () => countScene(model.heli));

  const composer = await step('编译后处理链（Bloom / ACES / 颗粒）', () => new Composer(renderer, scene, camera));
  const orbit = await step('初始化控制器与交互', () => new Orbit(camera, canvas));

  /* --- 状态 --- */
  const ST = {
    running: false, rpm: 0, rpmTarget: 0, manual: false, manualRpm: 0.6,
    mainAngle: 0, tailAngle: 0, time: 0, disc: true, scan: true,
    labels: true, explode: 0, wire: false, quality: 1, shot: false,
    stabAngle: 0, autoRotate: false,
  };
  const MAIN_RPM = 289 / 60 * TAU;          // 主旋翼角速度 rad/s
  const TAIL_RATIO = 1403 / 289;

  /* --- 标注 --- */
  const labelLayer = $('#labels');
  const labels = HOTSPOTS.map(h => {
    const el = document.createElement('div');
    el.className = 'hot';
    el.innerHTML = `<span class="dot"></span><span class="line"></span><div class="card"><b>${h.title}</b><i>${h.sub}</i></div>`;
    labelLayer.appendChild(el);
    return { el, pos: new THREE.Vector3(...h.pos) };
  });

  /* --- UI 绑定 --- */
  const setPreset = k => {
    const P = applyPreset(S, k);
    composer.exposure = P.exposure * parseFloat($('#exposure').value);
    composer.bloomStrength = P.bloom * parseFloat($('#bloom').value);
    $$('#env-row .seg').forEach(b => b.classList.toggle('on', b.dataset.env === k));
  };
  $$('#env-row .seg').forEach(b => b.onclick = () => setPreset(b.dataset.env));
  $('#exposure').oninput = e => { composer.exposure = ENV_PRESETS[S.preset].exposure * parseFloat(e.target.value); $('#exposure-v').textContent = (+e.target.value).toFixed(2); };
  $('#bloom').oninput = e => { composer.bloomStrength = ENV_PRESETS[S.preset].bloom * parseFloat(e.target.value); $('#bloom-v').textContent = (+e.target.value).toFixed(2); };

  const btnStart = $('#btn-start');
  const setRun = v => {
    ST.running = v; ST.manual = false;
    ST.rpmTarget = v ? 1 : 0;
    btnStart.classList.toggle('on', v);
    $('#btn-start-txt').textContent = v ? '停 车' : '启 动';
    $('#rpm').value = v ? 1 : 0;
  };
  btnStart.onclick = () => setRun(!ST.running);
  $('#rpm').oninput = e => {
    ST.manual = true; ST.rpmTarget = parseFloat(e.target.value);
    ST.running = ST.rpmTarget > 0.02;
    btnStart.classList.toggle('on', ST.running);
    $('#btn-start-txt').textContent = ST.running ? '停 车' : '启 动';
  };
  $('#chk-disc').onchange = e => { ST.disc = e.target.checked; };
  $('#chk-scan').onchange = e => { ST.scan = e.target.checked; };
  $('#chk-auto').onchange = e => { orbit.autoRotate = e.target.checked; };
  $('#chk-labels').onchange = e => { ST.labels = e.target.checked; labelLayer.style.display = e.target.checked ? '' : 'none'; };
  $('#chk-shadow').onchange = e => {
    renderer.shadowMap.enabled = e.target.checked;
    scene.traverse(o => { if (o.isMesh && o.material) o.material.needsUpdate = true; });
  };
  $('#chk-wire').onchange = e => {
    ST.wire = e.target.checked;
    for (const m of Object.values(MATS)) if (m && m.isMaterial) m.wireframe = ST.wire;
  };
  $('#chk-hellfire').onchange = e => model.parts.wings.traverse(o => { if (o.userData.kind === 'hellfire') o.visible = e.target.checked; });
  $('#chk-rocket').onchange = e => model.parts.wings.traverse(o => { if (o.userData.kind === 'rocket') o.visible = e.target.checked; });
  $('#chk-radar').onchange = e => { model.parts.rotor.radar.visible = e.target.checked; };
  $('#explode').oninput = e => { ST.explode = parseFloat(e.target.value); $('#explode-v').textContent = Math.round(ST.explode * 100) + '%'; };
  $('#sel-quality').onchange = e => { ST.quality = parseFloat(e.target.value); resize(); };
  $('#btn-shot').onclick = () => { ST.shot = true; };
  $('#btn-panel').onclick = () => $('#panel').classList.toggle('collapsed');
  $('#btn-help').onclick = () => $('#specs').classList.toggle('show');

  const viewRow = $('#view-row');
  for (const [k, v] of Object.entries(VIEWS)) {
    const b = document.createElement('button');
    b.className = 'seg'; b.textContent = v.label; b.dataset.view = k;
    b.onclick = () => {
      orbit.flyTo(v, 1.35);
      $$('#view-row .seg').forEach(x => x.classList.toggle('on', x === b));
    };
    viewRow.appendChild(b);
  }
  $$('#view-row .seg')[0].classList.add('on');

  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); setRun(!ST.running); }
    else if (k === 'r') { $('#chk-auto').checked = !$('#chk-auto').checked; orbit.autoRotate = $('#chk-auto').checked; }
    else if (k === 'l') { $('#chk-labels').checked = !ST.labels; ST.labels = !ST.labels; labelLayer.style.display = ST.labels ? '' : 'none'; }
    else if (k === 'w') { $('#chk-wire').checked = !ST.wire; ST.wire = !ST.wire; for (const m of Object.values(MATS)) if (m && m.isMaterial) m.wireframe = ST.wire; }
    else if (k === 'h') $('#panel').classList.toggle('collapsed');
    else if (k === 'p') ST.shot = true;
    else if (k >= '1' && k <= '9') {
      const b = $$('#view-row .seg')[+k - 1];
      if (b) b.click();
    }
  });

  /* --- 尺寸 --- */
  function resize() {
    const w = innerWidth, h = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2) * ST.quality;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    composer.setSize(w, h, dpr);
  }
  addEventListener('resize', resize);
  resize();

  /* --- 主循环 --- */
  const clock = new THREE.Clock();
  let fpsEMA = 60, statT = 0;
  const v3 = new THREE.Vector3();

  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, clock.getDelta());
    ST.time += dt;

    /* 转速 */
    const accel = ST.rpmTarget > ST.rpm ? 0.135 : 0.10;
    ST.rpm += clamp(ST.rpmTarget - ST.rpm, -accel * dt * 3.2, accel * dt * 3.2);
    ST.rpm = clamp(ST.rpm, 0, 1);
    const w = MAIN_RPM * ST.rpm;
    ST.mainAngle = (ST.mainAngle + w * dt) % TAU;
    ST.tailAngle = (ST.tailAngle - w * TAIL_RATIO * dt) % TAU;

    const R = model.parts.rotor;
    R.spin.rotation.y = ST.mainAngle;
    model.parts.trotor.spin.rotation.z = ST.tailAngle;

    /* 桨叶锥度 / 挥舞 */
    const cone = lerp(-4.4 * DEG, 2.3 * DEG, smoothstep(0, 0.85, ST.rpm));
    R.blades.forEach((b, i) => {
      const az = ST.mainAngle + i / 4 * TAU;
      b.rotation.x = -(cone + Math.sin(az) * 0.55 * DEG * ST.rpm + Math.sin(ST.time * 1.7 + i) * 0.12 * DEG);
      b.rotation.y = Math.sin(az * 1.0) * 0.35 * DEG * ST.rpm;
    });
    /* 桨盘虚化 */
    const dOp = ST.disc ? smoothstep(0.35, 0.95, ST.rpm) : 0;
    R.disc.visible = dOp > 0.01;
    R.disc.material.opacity = dOp * 0.92;
    model.parts.tdisc.visible = dOp > 0.01;
    model.parts.tdisc.material.opacity = dOp * 0.8;

    /* 传感器扫描 + 机炮随动 */
    const t = ST.time;
    const N = model.parts.nose;
    const scanA = ST.scan ? Math.sin(t * 0.32) * 0.42 + Math.sin(t * 0.11) * 0.18 : 0;
    const scanE = ST.scan ? Math.sin(t * 0.23 + 1.3) * 0.10 - 0.04 : 0;
    N.tadsYaw.rotation.y = scanA;
    N.tadsPitch.rotation.z = scanE;
    N.pnvsYaw.rotation.y = scanA * 0.35 + Math.sin(t * 0.5) * 0.10;
    N.pnvsHead.rotation.z = -0.06 + Math.sin(t * 0.4) * 0.05;
    model.parts.gun.yaw.rotation.y = scanA * 0.92;
    model.parts.gun.pitch.rotation.z = -2.5 * DEG + scanE * 0.9;

    /* 平尾配平 + 机体振动 */
    model.parts.stab.pivot.rotation.z = lerp(6 * DEG, -2 * DEG, smoothstep(0.2, 1, ST.rpm)) + Math.sin(t * 0.7) * 0.6 * DEG;
    const vib = ST.rpm * ST.rpm * 0.0045;
    model.heli.position.set(
      Math.sin(t * 61.0) * vib * 0.35,
      Math.sin(t * 47.0) * vib,
      Math.sin(t * 53.0) * vib * 0.5);
    model.heli.rotation.z = Math.sin(t * 43.0) * vib * 0.03;

    /* 防撞灯闪 */
    const blink = (ST.time % 1.15) < 0.075 ? 1 : 0;
    MATS.strobe.emissiveIntensity = blink * 4.2;
    MATS.navRed.emissiveIntensity = 2.0 + blink * 0.3;
    MATS.navGreen.emissiveIntensity = 2.0 + blink * 0.3;
    MATS.formation.emissiveIntensity = S.preset === 'night' ? 1.6 : 0.55;

    /* 分解视图 */
    for (const e of model.explode) {
      e.o.position.copy(e.base).addScaledVector(e.dir, ST.explode * e.amt);
    }

    orbit.update(dt);

    /* 标注投影（近处优先 + 防重叠 + 靠右自动翻转） */
    if (ST.labels) {
      const w2 = innerWidth / 2, h2 = innerHeight / 2;
      const arr = labels.map(l => {
        v3.copy(l.pos).project(camera);
        return { l, x: v3.x * w2 + w2, y: -v3.y * h2 + h2, z: v3.z };
      }).sort((a, b) => a.z - b.z);
      const shown = [];
      const panelW = $('#panel').classList.contains('collapsed') ? 24 : 316;
      for (const it of arr) {
        let ok = it.z > -1 && it.z < 1 && it.x > 26 && it.x < innerWidth - 26 && it.y > 76 && it.y < innerHeight - 46;
        const flip = it.x > innerWidth - panelW - 200;
        if (ok && it.x > innerWidth - panelW + 40) ok = false;
        if (ok) for (const s of shown) {
          if (Math.abs(s.x - it.x) < 205 && Math.abs(s.y - it.y) < 36) { ok = false; break; }
        }
        if (ok) shown.push(it);
        it.l.el.classList.toggle('flip', flip);
        it.l.el.style.opacity = ok ? '1' : '0';
        it.l.el.style.transform = `translate(${it.x.toFixed(1)}px, ${it.y.toFixed(1)}px)`;
      }
    }

    composer.render(ST.time);

    if (ST.shot) {
      ST.shot = false;
      try {
        const a = document.createElement('a');
        a.download = `AH-64D-Apache-${Date.now()}.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
      } catch (err) { console.warn(err); }
    }

    /* HUD 数据 */
    fpsEMA = fpsEMA * 0.92 + (1 / Math.max(dt, 1e-4)) * 0.08;
    statT += dt;
    if (statT > 0.2) {
      statT = 0;
      $('#hud-fps').textContent = fpsEMA.toFixed(0);
      $('#hud-rpm').textContent = Math.round(ST.rpm * 289);
      $('#hud-tri').textContent = (STATS.tris / 1000).toFixed(1) + 'K';
      $('#hud-mesh').textContent = STATS.meshes;
      $('#hud-draw').textContent = composer.calls || renderer.info.render.calls;
      $('#rotor-pct').textContent = Math.round(ST.rpm * 100) + '%';
      $('#rotor-bar').style.width = (ST.rpm * 100).toFixed(1) + '%';
    }
  }

  /* --- 完成 --- */
  loadBar.style.width = '100%';
  loadTxt.textContent = '就绪';
  $('#hud-tri').textContent = (STATS.tris / 1000).toFixed(1) + 'K';
  $('#hud-mesh').textContent = STATS.meshes;
  setTimeout(() => {
    $('#loading').classList.add('hide');
    $('#ui').classList.add('show');
  }, 260);
  /* 调试/进阶接口 */
  window.__APP = {
    THREE, S, model, orbit, composer, renderer, ST, VIEWS, MATS, HOTSPOTS, ENV_PRESETS,
    setPreset, setRun, resize,
    view: k => { orbit.flyTo(VIEWS[k], 0.001); },
    ui: v => { $('#ui').style.display = v ? '' : 'none'; },
  };
  window.__READY_MS = Math.round(performance.now());
  frame();
  /* 开场：镜头缓推 + 自动启动 */
  orbit.theta = VIEWS.hero.theta - 0.55;
  orbit.phi = 0.72;
  orbit.dist = 34;
  orbit.target.set(0.35, 2.6, 0);
  orbit.tTarget.copy(orbit.target);
  orbit.flyTo(VIEWS.hero, 3.4);
  setTimeout(() => { setRun(true); }, 1400);
}

if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot);
else boot();
