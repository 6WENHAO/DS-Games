/* ============ 围攻 Web —— 主程序 ============ */
'use strict';

(function () {

/* ---------------- 渲染器 / 场景 ---------------- */
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9cc4e4);
scene.fog = new THREE.Fog(0x9cc4e4, 90, 240);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, .1, 600);

// 光照
const sun = new THREE.DirectionalLight(0xfff2dd, 1.05);
sun.position.set(40, 60, 25);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -45; sun.shadow.camera.right = 45;
sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45;
sun.shadow.camera.far = 160;
scene.add(sun);
scene.add(sun.target);
scene.add(new THREE.HemisphereLight(0xbdd8f0, 0x54683c, .75));

// 天空渐变 + 云
{
  const skyGeo = new THREE.SphereGeometry(380, 16, 12);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, fog: false, depthWrite: false,
    vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP;
      void main(){ float h = normalize(vP).y;
        vec3 top = vec3(.35,.56,.82), bot = vec3(.78,.85,.92);
        gl_FragColor = vec4(mix(bot, top, clamp(h*1.6,0.,1.)), 1.0); }`,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
  const cloudM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .85, fog: false });
  for (let i = 0; i < 16; i++) {
    const g = new THREE.Group();
    const n = U.randInt(3, 5);
    for (let j = 0; j < n; j++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(U.rand(4, 9), 8, 6), cloudM);
      s.position.set(j * U.rand(4, 7) - n * 2.5, U.rand(-1, 1.5), U.rand(-2, 2));
      s.scale.y = .5;
      g.add(s);
    }
    const a = U.rand(0, Math.PI * 2), r = U.rand(90, 220);
    g.position.set(Math.cos(a) * r, U.rand(45, 90), Math.sin(a) * r);
    scene.add(g);
  }
}

/* ---------------- 纹理 / 材质 ---------------- */
U.makeTextures();
U.makeMaterials();

/* ---------------- 物理世界 ---------------- */
const cworld = new CANNON.World();
cworld.gravity.set(0, -19, 0);
cworld.broadphase = new CANNON.SAPBroadphase(cworld);
cworld.allowSleep = true;
cworld.solver.iterations = 14;
cworld.defaultContactMaterial.friction = .45;
cworld.defaultContactMaterial.restitution = .05;
cworld.addContactMaterial(new CANNON.ContactMaterial(MAT_GROUND, MAT_WHEEL, { friction: 1.15, restitution: .02 }));
cworld.addContactMaterial(new CANNON.ContactMaterial(MAT_GROUND, MAT_BLOCK, { friction: .5, restitution: .05 }));
cworld.addContactMaterial(new CANNON.ContactMaterial(MAT_BLOCK, MAT_WHEEL, { friction: .9, restitution: .02 }));

/* ---------------- 游戏对象 ---------------- */
const particles = new U.ParticleSystem(scene);
SimRegistry.particles = particles;
SimRegistry.world = cworld;

const machine = new Machine(scene);
// 核心方块（放在建造网格原点，建造展示时整体抬高）
machine.addBlock('core', new THREE.Vector3(0, 0, 0), new THREE.Quaternion(), null, null, null, true);
machine.group.position.y = 2; // 建造模式悬浮展示高度

const world = new GameWorld(scene, cworld, particles);
const builder = new Builder(machine, scene, camera);
const sim = new Simulation(cworld, scene, machine, particles);

/* ---------------- 相机控制 ---------------- */
const cam = {
  target: new THREE.Vector3(0, 2.5, 0),
  yaw: Math.PI + .5, pitch: .38, dist: 14,
  follow: true,
};
function applyCamera() {
  cam.pitch = U.clamp(cam.pitch, .05, 1.45);
  cam.dist = U.clamp(cam.dist, 4, 90);
  const cp = new THREE.Vector3(
    cam.target.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist,
    cam.target.y + Math.sin(cam.pitch) * cam.dist,
    cam.target.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist);
  camera.position.copy(cp);
  camera.lookAt(cam.target);
}

/* ---------------- 输入 ---------------- */
const keys = {};
sim.keys = keys;
const mouse = { x: 0, y: 0, ndc: new THREE.Vector2(), down: {}, moved: 0 };

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

canvas.addEventListener('contextmenu', e => e.preventDefault());

canvas.addEventListener('mousedown', e => {
  SFX.init();
  mouse.down[e.button] = true;
  mouse.moved = 0;
  mouse.x = e.clientX; mouse.y = e.clientY;
});

window.addEventListener('mousemove', e => {
  const dx = e.clientX - mouse.x, dy = e.clientY - mouse.y;
  mouse.x = e.clientX; mouse.y = e.clientY;
  mouse.ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  mouse.moved += Math.abs(dx) + Math.abs(dy);
  const rotating = mouse.down[2] || (mouse.down[0] && (state.mode === 'sim' || mouse.dragEmpty));
  if (rotating) {
    cam.yaw -= dx * .0055;
    cam.pitch += dy * .004;
  } else if (mouse.down[1]) {
    // 平移
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
    const up = new THREE.Vector3(0, 1, 0);
    cam.target.addScaledVector(right, -dx * cam.dist * .0016);
    cam.target.addScaledVector(up, dy * cam.dist * .0016);
  }
});

window.addEventListener('mouseup', e => {
  const wasDrag = mouse.moved > 6;
  mouse.down[e.button] = false;
  if (e.target !== canvas) { mouse.dragEmpty = false; return; }
  if (state.mode === 'build' && !wasDrag) {
    if (e.button === 0) {
      const r = builder.click();
      if (r) {
        if (r.action === 'wrench') openWrench(r.block);
        updateBlockCount();
      }
    } else if (e.button === 2) {
      builder.rightClick(mouse.ndc);
      updateBlockCount();
    }
  }
  mouse.dragEmpty = false;
});

canvas.addEventListener('mousedown', e => {
  if (e.button === 0 && state.mode === 'build') {
    // 判断是否点在空处（供拖动旋转视角）
    builder.updateHover(new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1));
    mouse.dragEmpty = !builder.hover;
  }
});

canvas.addEventListener('wheel', e => {
  cam.dist *= (e.deltaY > 0 ? 1.1 : .9);
}, { passive: true });

window.addEventListener('keydown', e => {
  if (wrench.listening) { wrenchAssignKey(e.code); e.preventDefault(); return; }
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  keys[e.code] = true;
  const helpOpen = document.getElementById('help-overlay').style.display === 'flex';
  if (e.code === 'Space' && !helpOpen) { toggleSim(); e.preventDefault(); }
  if (state.mode === 'build') {
    if (e.code === 'KeyR') builder.rotate();
    if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) { machine.undo(); updateBlockCount(); e.preventDefault(); }
  }
  if (e.code === 'KeyT' && state.mode === 'sim') cam.follow = !cam.follow;
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

/* ---------------- UI：零件栏 ---------------- */
const state = { mode: 'build', currentCat: 'basic', win: false };

// 用离屏渲染器生成零件缩略图
function makeThumbnails() {
  const size = 104;
  const r2 = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r2.setSize(size, size);
  const sc = new THREE.Scene();
  const cm = new THREE.PerspectiveCamera(35, 1, .1, 50);
  cm.position.set(2.6, 2.1, 3.2); cm.lookAt(0, 0, .15);
  sc.add(new THREE.AmbientLight(0xffffff, .75));
  const dl = new THREE.DirectionalLight(0xffffff, .9);
  dl.position.set(3, 5, 4); sc.add(dl);
  const thumbs = {};
  for (const id in BLOCK_DEFS) {
    const mesh = BLOCK_DEFS[id].buildMesh();
    // 大零件缩小
    const bb = new THREE.Box3().setFromObject(mesh);
    const s = bb.getSize(new THREE.Vector3());
    const maxDim = Math.max(s.x, s.y, s.z);
    if (maxDim > 1.6) mesh.scale.multiplyScalar(1.6 / maxDim);
    const c = bb.getCenter(new THREE.Vector3()).multiplyScalar(mesh.scale.x);
    mesh.position.sub(c);
    sc.add(mesh);
    r2.render(sc, cm);
    thumbs[id] = r2.domElement.toDataURL();
    sc.remove(mesh);
  }
  r2.dispose();
  return thumbs;
}
const thumbs = makeThumbnails();

const catTabs = document.getElementById('cat-tabs');
const blockList = document.getElementById('block-list');

function renderCats() {
  catTabs.innerHTML = '';
  for (const cat of BLOCK_CATS) {
    const el = document.createElement('div');
    el.className = 'cat-tab' + (state.currentCat === cat.id ? ' active' : '');
    el.textContent = cat.name;
    el.onclick = () => { state.currentCat = cat.id; renderCats(); renderBlockList(); SFX.click(); };
    catTabs.appendChild(el);
  }
}

function renderBlockList() {
  blockList.innerHTML = '';
  if (state.currentCat === 'tool') {
    for (const t of TOOL_DEFS) {
      const el = document.createElement('div');
      el.className = 'block-btn tool' + (builder.currentTool === t.id ? ' selected' : '');
      el.innerHTML = `<div class="bicon">${t.icon}</div><div class="bname">${t.name}</div>`;
      el.onclick = () => { builder.setTool(t.id); renderBlockList(); showInfo(t.name, t.desc, null); SFX.click(); };
      blockList.appendChild(el);
    }
    return;
  }
  for (const id in BLOCK_DEFS) {
    const def = BLOCK_DEFS[id];
    if (def.cat !== state.currentCat || id === 'core') continue;
    const el = document.createElement('div');
    el.className = 'block-btn' + (!builder.currentTool && builder.currentType === id ? ' selected' : '');
    el.innerHTML = `<img src="${thumbs[id]}"><div class="bname">${def.name}</div>`;
    el.onclick = () => {
      builder.setType(id);
      renderBlockList();
      showInfo(def.name, def.desc, def);
      SFX.click();
    };
    blockList.appendChild(el);
  }
}

function showInfo(name, desc, def) {
  document.getElementById('info-name').textContent = name;
  document.getElementById('info-desc').textContent = desc || '';
  const keysEl = document.getElementById('info-keys');
  keysEl.innerHTML = '';
  if (def && def.defaultKeys && def.defaultKeys.length) {
    keysEl.innerHTML = '默认按键：' + def.defaultKeys.map(k => `<kbd>${U.keyName(k)}</kbd>`).join(' ');
  }
}
function updateBlockCount() {
  document.getElementById('block-count').textContent = machine.count();
}

renderCats();
renderBlockList();
showInfo(BLOCK_DEFS.smallBlock.name, BLOCK_DEFS.smallBlock.desc, BLOCK_DEFS.smallBlock);
updateBlockCount();

/* ---------------- 扳手面板 ---------------- */
const wrench = { block: null, listening: null };
const wrenchPanel = document.getElementById('wrench-panel');

function openWrench(block) {
  const def = BLOCK_DEFS[block.type];
  wrench.block = block;
  document.getElementById('wrench-title').textContent = `${def.name} 设置`;
  const body = document.getElementById('wrench-body');
  body.innerHTML = '';
  const s = block.settings;
  if (s.keys) {
    s.keys.forEach((k, i) => {
      const row = document.createElement('div');
      row.className = 'row';
      const label = s.keys.length > 1 ? (i === 0 ? '正转按键' : '反转按键') : '触发按键';
      row.innerHTML = `<span>${label}</span>`;
      const kb = document.createElement('span');
      kb.className = 'keybind';
      kb.textContent = U.keyName(k);
      kb.onclick = () => {
        document.querySelectorAll('.keybind').forEach(x => x.classList.remove('listening'));
        kb.classList.add('listening');
        kb.textContent = '按任意键…';
        wrench.listening = { index: i, el: kb };
      };
      row.appendChild(kb);
      body.appendChild(row);
    });
  }
  if (s.speed != null) {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<span>速度 <b id="wr-speed-val">${s.speed}</b></span>`;
    const input = document.createElement('input');
    input.type = 'range'; input.min = 1; input.max = 30; input.step = 1; input.value = s.speed;
    input.oninput = () => { s.speed = +input.value; document.getElementById('wr-speed-val').textContent = s.speed; };
    row.appendChild(input);
    body.appendChild(row);
  }
  if (s.reverse != null) {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<span>反转方向</span>`;
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = s.reverse;
    cb.onchange = () => { s.reverse = cb.checked; };
    row.appendChild(cb);
    body.appendChild(row);
  }
  if (s.thrust != null) {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<span>推力 <b id="wr-thrust-val">${s.thrust}</b></span>`;
    const input = document.createElement('input');
    input.type = 'range'; input.min = 10; input.max = 200; input.step = 5; input.value = s.thrust;
    input.oninput = () => { s.thrust = +input.value; document.getElementById('wr-thrust-val').textContent = s.thrust; };
    row.appendChild(input);
    body.appendChild(row);
  }
  if (!body.children.length) body.innerHTML = '<div style="color:#a89877">该零件没有可调参数。</div>';
  wrenchPanel.style.display = 'block';
  wrenchPanel.style.left = Math.min(mouse.x + 14, window.innerWidth - 245) + 'px';
  wrenchPanel.style.top = Math.min(mouse.y - 20, window.innerHeight - 300) + 'px';
}
function wrenchAssignKey(code) {
  if (!wrench.listening || !wrench.block) return;
  wrench.block.settings.keys[wrench.listening.index] = code;
  wrench.listening.el.textContent = U.keyName(code);
  wrench.listening.el.classList.remove('listening');
  wrench.listening = null;
  SFX.click();
}
document.getElementById('wrench-close').onclick = () => { wrenchPanel.style.display = 'none'; wrench.listening = null; };

/* ---------------- 存档 ---------------- */
const savePanel = document.getElementById('save-panel');
const SAVE_PREFIX = 'besiege_web_slot_';

function renderSaveSlots() {
  const wrap = document.getElementById('save-slots');
  wrap.innerHTML = '';
  for (let i = 1; i <= 4; i++) {
    const key = SAVE_PREFIX + i;
    const data = localStorage.getItem(key);
    const row = document.createElement('div');
    row.className = 'slot';
    const name = document.createElement('span');
    name.className = 'name';
    if (data) {
      try { name.textContent = `存档 ${i}（${JSON.parse(data).blocks.length} 零件）`; }
      catch (e) { name.textContent = `存档 ${i}（损坏）`; }
    } else name.textContent = `存档 ${i}（空）`;
    row.appendChild(name);
    const bs = document.createElement('button');
    bs.className = 'btn'; bs.textContent = '保存';
    bs.onclick = () => { localStorage.setItem(key, JSON.stringify(machine.serialize())); renderSaveSlots(); SFX.place(); };
    row.appendChild(bs);
    const bl = document.createElement('button');
    bl.className = 'btn'; bl.textContent = '读取';
    bl.disabled = !data;
    if (data) bl.onclick = () => {
      try { machine.loadFrom(JSON.parse(localStorage.getItem(key))); updateBlockCount(); SFX.place(); }
      catch (e) { alert('存档损坏'); }
      savePanel.style.display = 'none';
    };
    row.appendChild(bl);
    wrap.appendChild(row);
  }
}
document.getElementById('btn-save').onclick = () => {
  renderSaveSlots();
  savePanel.style.display = savePanel.style.display === 'block' ? 'none' : 'block';
};
document.getElementById('save-close').onclick = () => { savePanel.style.display = 'none'; };

/* ---------------- 顶栏按钮 ---------------- */
document.getElementById('btn-undo').onclick = () => { machine.undo(); updateBlockCount(); };
document.getElementById('btn-clear').onclick = () => {
  if (state.mode !== 'build') return;
  machine.clearAll(); updateBlockCount(); SFX.remove();
};
document.getElementById('btn-example').onclick = () => {
  if (state.mode !== 'build') return;
  buildExampleMachine(machine);
  updateBlockCount(); SFX.place();
};
document.getElementById('btn-help').onclick = () => {
  document.getElementById('help-overlay').style.display = 'flex';
};
document.getElementById('help-close').onclick = () => {
  document.getElementById('help-overlay').style.display = 'none';
  SFX.init(); SFX.click();
};

/* ---------------- 新手教程 ---------------- */
const tutorial = new Tutorial({
  machine, builder, sim, world, cam,
  getMode: () => state.mode,
});
document.getElementById('btn-tutorial').onclick = () => {
  SFX.init();
  document.getElementById('help-overlay').style.display = 'none';
  if (state.mode === 'sim') toggleSim();
  machine.loadFrom(null);
  updateBlockCount();
  tutorial.start();
};
// 首次进入自动开始教程；老玩家显示帮助入口即可
if (!Tutorial.isDone()) tutorial.start();

/* ---------------- 模拟切换 ---------------- */
const btnSim = document.getElementById('btn-sim');
const banner = document.getElementById('banner');

function toggleSim() {
  if (state.mode === 'build') {
    state.mode = 'sim';
    state.win = false;
    machine.group.position.y = 0; // 模拟由 sim.lift 控制高度
    sim.start();
    builder.hideGhost();
    wrenchPanel.style.display = 'none';
    savePanel.style.display = 'none';
    btnSim.innerHTML = '■ 停止模拟 <kbd>空格</kbd>';
    btnSim.classList.remove('primary');
    btnSim.classList.add('danger');
    document.getElementById('sim-hud').style.display = 'block';
    document.getElementById('hint').style.display = 'none';
    document.getElementById('toolbar').style.display = 'none';
    updateObjective();
    cam.follow = true;
  } else {
    state.mode = 'build';
    sim.stop();
    world.reset();
    machine.group.position.y = 2;
    btnSim.innerHTML = '▶ 开始模拟 <kbd>空格</kbd>';
    btnSim.classList.add('primary');
    btnSim.classList.remove('danger');
    document.getElementById('sim-hud').style.display = 'none';
    document.getElementById('hint').style.display = 'block';
    document.getElementById('toolbar').style.display = 'block';
    banner.style.display = 'none';
    cam.target.set(0, 2.5, 0);
    cam.dist = Math.max(cam.dist, 10);
  }
}
btnSim.onclick = toggleSim;

function updateObjective() {
  const alive = world.aliveKnights();
  document.getElementById('objective').textContent =
    alive > 0 ? `目标：消灭所有骑士（剩余 ${alive} / ${world.totalKnights}）` : '目标完成！';
}

function checkWin() {
  if (state.win || state.mode !== 'sim') return;
  if (world.aliveKnights() === 0) {
    state.win = true;
    document.getElementById('banner-big').textContent = '胜 利';
    document.getElementById('banner-small').textContent = '所有骑士已被消灭！按 空格 返回建造模式';
    banner.style.display = 'block';
    SFX.win();
  }
  // 核心被摧毁 → 失败提示
  const core = machine.core;
  if (core.dead && !state.win) {
    state.win = true;
    document.getElementById('banner-big').textContent = '机 毁';
    document.getElementById('banner-small').textContent = '核心方块被摧毁了…… 按 空格 返回重造';
    banner.style.display = 'block';
  }
}

/* ---------------- 建造模式 WASD 平移 ---------------- */
function buildModeCamKeys(dt) {
  const sp = cam.dist * .9 * dt;
  const fwd = new THREE.Vector3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  if (keys['KeyW']) cam.target.addScaledVector(fwd, sp);
  if (keys['KeyS']) cam.target.addScaledVector(fwd, -sp);
  if (keys['KeyA']) cam.target.addScaledVector(right, -sp);
  if (keys['KeyD']) cam.target.addScaledVector(right, sp);
}

/* ---------------- 主循环 ---------------- */
let last = performance.now(), fpsT = 0, fpsN = 0;
const FIXED = 1 / 60;
let acc = 0;

function loop(now) {
  requestAnimationFrame(loop);
  let dt = Math.min((now - last) / 1000, .05);
  last = now;

  // 物理
  acc += dt;
  let steps = 0;
  while (acc >= FIXED && steps < 4) {
    if (state.mode === 'sim') sim.update(FIXED);
    cworld.step(FIXED);
    acc -= FIXED; steps++;
  }

  // 世界 AI / 动画
  const corePos = state.mode === 'sim' ? sim.corePosition() : null;
  world.update(dt, state.mode === 'sim', corePos);
  particles.update(dt);

  // 相机
  if (state.mode === 'sim' && cam.follow && corePos) {
    cam.target.lerp(corePos, Math.min(1, dt * 6));
    sun.position.set(corePos.x + 40, 60, corePos.z + 25);
    sun.target.position.copy(corePos);
  } else if (state.mode === 'build') {
    buildModeCamKeys(dt);
  }
  applyCamera();

  // 建造模式 hover
  if (state.mode === 'build' && !mouse.down[0] && !mouse.down[2]) {
    builder.updateHover(mouse.ndc);
  }

  // 目标
  if (state.mode === 'sim') { updateObjective(); checkWin(); }

  // 教程
  tutorial.update();

  renderer.render(scene, camera);

  // FPS
  fpsN++; fpsT += dt;
  if (fpsT >= .5) {
    document.getElementById('fps').textContent = Math.round(fpsN / fpsT) + ' FPS';
    fpsN = 0; fpsT = 0;
  }
}
applyCamera();
requestAnimationFrame(loop);

/* ---------------- 自检（供无头测试） ---------------- */
window.__dbg = { sim, machine, cworld, world, state, toggleSim, tutorial, builder, cam, camera };
window.__selftest = function () {
  const report = { errors: [] };
  try {
    report.blockDefs = Object.keys(BLOCK_DEFS).length;
    report.machineBlocks = machine.count();
    buildExampleMachine(machine);
    report.exampleBlocks = machine.count();
    toggleSim();
    report.simRunning = sim.running;
    report.islands = sim.islands.length;
    report.constraints = sim.constraints.length;
    for (let i = 0; i < 120; i++) { sim.update(FIXED); cworld.step(FIXED); }
    const cp = sim.corePosition();
    report.corePosAfter2s = cp ? [+cp.x.toFixed(2), +cp.y.toFixed(2), +cp.z.toFixed(2)] : null;
    // 模拟按键前进
    sim.keys['KeyW'] = true;
    for (let i = 0; i < 240; i++) { sim.update(FIXED); cworld.step(FIXED); }
    sim.keys['KeyW'] = false;
    const cp2 = sim.corePosition();
    report.corePosAfterDrive = cp2 ? [+cp2.x.toFixed(2), +cp2.y.toFixed(2), +cp2.z.toFixed(2)] : null;
    report.droveDistance = cp && cp2 ? +cp.distanceTo(cp2).toFixed(2) : 0;
    // 开炮
    sim.keys['KeyC'] = true;
    sim.update(FIXED); cworld.step(FIXED);
    sim.keys['KeyC'] = false;
    report.projectiles = sim.projectiles.length;
    report.knightsAlive = world.aliveKnights();
    toggleSim();
    report.backToBuild = state.mode === 'build';
    report.blocksAfterRestore = machine.count();
  } catch (e) {
    report.errors.push(e.message + '\n' + e.stack);
  }
  return report;
};

})();
