/* ============================================================
   主程序：营建 → 网格化 → 渲染循环 → 交互（上帝视角 / 第一视角 / 导览）
   ============================================================ */
'use strict';

const APP = {
  mode: 'god',
  labelsOn: true, shadowOn: true, gridOn: true, mapOn: true,
  sunT: 0.32,
  tour: { on: false, idx: 0, t: 0, playing: true },
  input: { fwd: 0, back: 0, left: 0, right: 0, up: 0, down: 0, run: 0 },
  stats: { fps: 0, ft: 0 },
};

const $ = (id) => document.getElementById(id);
const frame = () => new Promise(r => requestAnimationFrame(() => r()));

/* ------------------------------------------------------------ 营建 */
async function boot() {
  const bar = $('bar').firstElementChild, ltxt = $('ltxt');
  const setP = (p, t) => { bar.style.width = (p * 100).toFixed(1) + '%'; if (t) ltxt.textContent = t; };
  try {
    if (!document.createElement('canvas').getContext('webgl2')) {
      throw new Error('当前浏览器不支持 WebGL2，请使用较新版本的 Chrome / Edge / Firefox。');
    }
    setP(0.02, '正在丈量宫城…');
    await frame();
    const vol = new Volume();
    const ground = new Ground(FC.X0, FC.Z0, FC.X1, FC.Z1, 2);
    const idmap = new IdMap(FC.X0, FC.Z0, FC.X1, FC.Z1);
    APP.vol = vol; APP.ground = ground; APP.idmap = idmap;

    // 分步营建（每步让出一帧以刷新进度）
    const A = new Arch(vol, ground, idmap);
    APP.arch = A;
    const steps = [
      ['铺设地面与护城河', () => CITY.terrain(A)],
      ['砌筑宫墙与四隅角楼', () => CITY.rampart(A)],
      ['营建午门·端门·天安门', () => CITY.southGates(A)],
      ['营建外朝三大殿', () => CITY.outerCourt(A)],
      ['营建内廷后三宫', () => CITY.innerCourt(A)],
      ['排布东西六宫', () => CITY.sixPalaces(A)],
      ['营建东路：文华殿·宁寿宫', () => CITY.eastRoute(A)],
      ['营建西路：武英殿·慈宁宫', () => CITY.westRoute(A)],
      ['叠山理水：御花园', () => CITY.garden(A)],
      ['堆筑景山·太庙·社稷坛', () => CITY.outskirts(A)],
      ['植树布陈', () => CITY.dressing(A)],
    ];
    for (let i = 0; i < steps.length; i++) {
      setP(0.03 + 0.34 * i / steps.length, steps[i][0] + '…');
      await frame();
      steps[i][1]();
    }
    APP.labels = A.labels;
    APP.labelById = new Map(A.labels.map(l => [l.id, l]));

    // 网格化（分批）
    setP(0.38, '雕琢体素表面…');
    await frame();
    const ms = new MeshSet(), water = new MeshSet();
    const mesher = new Mesher(vol);
    const keys = Array.from(vol.chunks.keys());
    const B = 90;
    for (let i = 0; i < keys.length; i += B) {
      for (let j = i; j < Math.min(keys.length, i + B); j++) {
        const key = keys[j];
        const cy = (key % 64) - 8;
        const rest = (key - (cy + 8)) / 64;
        const cz = (rest % 512) - 256;
        const cx = (rest - (cz + 256)) / 512 - 256;
        mesher.meshChunk(cx, cy, cz, ms);
      }
      setP(0.38 + 0.42 * Math.min(1, (i + B) / keys.length), '雕琢体素表面… ' +
        Math.round(100 * Math.min(1, (i + B) / keys.length)) + '%');
      await frame();
    }
    ground.build(ms, GROUND_MATS, water);
    APP.quadCount = ms.totalQuads() + water.totalQuads();

    setP(0.83, '装配 GPU 缓冲…');
    await frame();
    const canvas = $('view');
    const R = new Renderer(canvas, { shadowSize: 2048, cascadeSpan: [56, 250, 1120] });
    APP.R = R;
    R.upload(ms, water);
    R.setSun(APP.sunT);
    R.fogDensity = 0.00031;
    R.maxDPR = 1.75;

    setP(0.9, '绘制宫城平面图…');
    await frame();
    buildMinimap();
    buildIndex();
    APP.q = new WorldQuery(vol, ground, idmap);
    APP.god = new GodCamera();
    APP.walker = new Walker(APP.q);
    APP.walker.place(0, 900);
    APP.cam = { pos: V3.create(), target: V3.create(), up: V3.create(0, 1, 0), fovy: 0.8, near: 0.12, far: 4200 };
    bindUI();
    bindInput();
    setP(1, '宫门已启');
    await frame();
    await new Promise(r => setTimeout(r, 260));
    $('loading').classList.add('done');
    setTimeout(() => { $('loading').style.display = 'none'; }, 800);
    APP.god.flyTo(0, 8, 150, 640, Math.PI, 0.56);
    loop();
    showWhere('紫禁城 · 上帝视角');
  } catch (e) {
    console.error(e);
    $('lerr').textContent = '营建失败：' + e.message;
    $('ltxt').textContent = '';
  }
}

/* ------------------------------------------------------------ 小地图 */
function buildMinimap() {
  const vol = APP.vol, G = APP.ground;
  const x0 = -480, x1 = 480, z0 = -600, z1 = 660, S = 4;
  const w = (x1 - x0) / S, h = (z1 - z0) / S;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const pal = (c) => PALETTE[c - 1];
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const x = x0 + i * S + 2, z = z0 + j * S + 2;
      let col = null, shade = 1;
      for (let y = 62; y >= -3; y--) {
        const c = vol.get(x, y, z);
        if (c) { col = pal(c); shade = 0.55 + Math.min(1, y / 34) * 0.65; break; }
      }
      if (!col) {
        const m = G.matAt(x, z);
        col = m ? pal(GROUND_MATS[m].color) : [40, 38, 34, 0];
        shade = m === GM.water ? 1.05 : 0.72;
      }
      const k = (j * w + i) * 4;
      d[k] = Math.min(255, col[0] * shade);
      d[k + 1] = Math.min(255, col[1] * shade);
      d[k + 2] = Math.min(255, col[2] * shade);
      d[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  APP.map = { cv, x0, z0, x1, z1, S, w, h };
  const mm = $('minimap');
  mm.width = w; mm.height = h;
  mm.style.height = Math.round(176 * h / w) + 'px';
  APP.mapCtx = mm.getContext('2d');
}

function drawMinimap() {
  const m = APP.map, ctx = APP.mapCtx;
  if (!m || !APP.mapOn) return;
  ctx.drawImage(m.cv, 0, 0);
  const px = APP.mode === 'fps' ? APP.walker.pos : APP.god.target;
  const yaw = APP.mode === 'fps' ? APP.walker.yaw : APP.god.yaw;
  const mx = (px[0] - m.x0) / m.S, my = (px[2] - m.z0) / m.S;
  // 视野扇形
  ctx.save();
  ctx.translate(mx, my);
  ctx.rotate(-yaw + Math.PI);
  const R = APP.mode === 'fps' ? 26 : Math.min(60, APP.god.dist / m.S * 0.55);
  const fov = (APP.mode === 'fps' ? APP.walker.fovy : APP.god.fovy) * 0.9;
  ctx.beginPath(); ctx.moveTo(0, 0);
  ctx.arc(0, 0, R, -Math.PI / 2 - fov / 2, -Math.PI / 2 + fov / 2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(216,180,90,.26)'; ctx.fill();
  ctx.restore();
  ctx.beginPath(); ctx.arc(mx, my, 2.6, 0, 7);
  ctx.fillStyle = APP.mode === 'fps' ? '#ff6b4a' : '#f2d98a';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = .8; ctx.stroke();
}

/* ------------------------------------------------------------ 建筑索引 */
const CAT_ORDER = ['外朝三大殿', '外朝', '外朝正门', '内廷正门', '内廷后三宫', '内廷',
  '东六宫', '西六宫', '东路', '西路', '御花园', '花园', '皇子居所', '城防', '门', '皇城', '景山', '水系', '桥梁', '广场', '街巷'];
function buildIndex() {
  const list = $('list');
  const groups = new Map();
  for (const l of APP.labels) {
    const c = l.cat || '其他';
    if (!groups.has(c)) groups.set(c, []);
    groups.get(c).push(l);
  }
  const cats = Array.from(groups.keys()).sort((a, b) => {
    const ia = CAT_ORDER.indexOf(a), ib = CAT_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  let html = '';
  for (const c of cats) {
    const items = groups.get(c).filter(l => !/院落$/.test(l.name) || groups.get(c).length < 4);
    if (!items.length) continue;
    html += '<div class="cat">' + c + ' · ' + items.length + '</div>';
    for (const l of items) {
      html += '<div class="item" data-id="' + l.id + '"><span>' + l.name + '</span><i>' +
        (l.y > 26 ? '高' + Math.round(l.y) + 'm' : '') + '</i></div>';
    }
  }
  list.innerHTML = html;
  list.addEventListener('click', (e) => {
    const it = e.target.closest('.item');
    if (!it) return;
    const l = APP.labelById.get(+it.dataset.id);
    if (l) { showCard(l); flyTo(l); }
  });
  $('search').addEventListener('input', (e) => {
    const q = e.target.value.trim();
    for (const it of list.querySelectorAll('.item')) {
      const l = APP.labelById.get(+it.dataset.id);
      it.style.display = (!q || (l && (l.name.includes(q) || (l.desc || '').includes(q)))) ? '' : 'none';
    }
    for (const c of list.querySelectorAll('.cat')) c.style.display = q ? 'none' : '';
  });
}

/* ------------------------------------------------------------ 信息卡 / 定位 */
function showCard(l) {
  APP.sel = l;
  $('cardName').textContent = l.name;
  $('cardTag').textContent = (l.cat || '建筑') + ' · 屋脊高约 ' + Math.round(l.y) + ' 米 · ' +
    '占地 ' + Math.round((l.x1 - l.x0) * (l.z1 - l.z0)) + '㎡';
  $('cardDesc').textContent = l.desc || '紫禁城建筑群的一部分。';
  $('card').classList.add('show');
}
function flyTo(l) {
  const size = Math.max(l.x1 - l.x0, l.z1 - l.z0);
  const d = Math.max(60, Math.min(700, size * 3.4 + 42));
  if (APP.mode === 'fps') {
    walkTo(l);
  } else {
    APP.god.flyTo(l.x, Math.min(l.y * 0.55, 26), l.z, d, Math.PI, 0.52);
    APP.god.clamp();
  }
}
function walkTo(l) {
  setMode('fps');
  const w = APP.walker;
  const zOff = Math.max(14, (l.z1 - l.z0) * 0.62 + 10);
  w.place(l.x, l.z + zOff);
  w.yaw = Math.PI; w.pitch = -0.04;
  showWhere(l.name);
}

/* ------------------------------------------------------------ 模式 */
function setMode(m) {
  if (APP.mode === m) return;
  const prev = APP.mode;
  APP.mode = m;
  $('btnGod').classList.toggle('on', m === 'god');
  $('btnFps').classList.toggle('on', m === 'fps');
  $('btnTour').classList.toggle('on', APP.tour.on);
  $('cross').classList.toggle('show', m === 'fps');
  $('view').classList.toggle('locked', m === 'fps');
  if (m === 'fps') {
    if (prev === 'god') {
      const t = APP.god.target;
      APP.walker.place(t[0], t[2] + 26);
      APP.walker.yaw = APP.god.yaw + Math.PI;
      APP.walker.pitch = -0.05;
    }
    APP.walker.fovy = APP.fpsFov || Math.min(1.6, APP.god.fovy * 1.05);
  } else {
    APP.tour.on = false;
    $('tour').classList.remove('show');
    document.exitPointerLock && document.exitPointerLock();
    const p = APP.walker.pos;
    APP.god.flyTo(p[0], 6, p[2], 220, APP.walker.yaw - Math.PI, 0.5);
    APP.god.yaw = APP.walker.yaw - Math.PI;
    APP.god.clamp();
  }
  updateHint();
}

function updateHint() {
  const h = $('hint');
  if (APP.tour.on) h.innerHTML = '<b>空格</b> 暂停/继续 · <b>← →</b> 切换站点 · <b>Esc</b> 结束导览';
  else if (APP.mode === 'fps') h.innerHTML = '<b>点击画面</b> 锁定视角 · <b>WASD</b> 行走 · <b>Shift</b> 疾行 · <b>空格</b> 跳跃 · <b>F</b> 飞行 · <b>G</b> 回到上帝视角';
  else h.innerHTML = '<b>左键拖动</b> 旋转 · <b>右键拖动</b> 平移 · <b>滚轮</b> 缩放 · <b>点击建筑</b> 查看详情 · <b>V</b> 进入第一视角';
}
let whereTimer = 0;
function showWhere(t) {
  const el = $('where');
  el.textContent = t;
  el.classList.add('show');
  clearTimeout(whereTimer);
  whereTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ------------------------------------------------------------ UI 绑定 */
function bindUI() {
  $('btnGod').onclick = () => setMode('god');
  $('btnFps').onclick = () => { setMode('fps'); $('view').requestPointerLock && $('view').requestPointerLock(); };
  $('btnTour').onclick = () => startTour(0);
  $('close').onclick = () => $('card').classList.remove('show');
  $('btnFlyTo').onclick = () => { if (APP.sel) { setMode('god'); flyTo(APP.sel); } };
  $('btnWalkTo').onclick = () => { if (APP.sel) walkTo(APP.sel); };
  const sun = $('sunSlider');
  sun.oninput = () => {
    APP.sunT = +sun.value / 1000;
    const hh = 5 + APP.sunT * 15;
    $('sunOut').textContent = String(Math.floor(hh)).padStart(2, '0') + ':' +
      String(Math.floor((hh % 1) * 60)).padStart(2, '0');
    APP.R.setSun(APP.sunT);
  };
  sun.oninput();
  const fov = $('fovSlider');
  fov.oninput = () => {
    const v = +fov.value;
    $('fovOut').textContent = v + '°';
    APP.god.fovy = v * Math.PI / 180;
    APP.fpsFov = Math.min(1.35, v * 1.05 * Math.PI / 180);
    APP.walker.fovy = APP.fpsFov;
  };
  APP.fpsFov = Math.min(1.35, 46 * 1.05 * Math.PI / 180);
  const tg = (id, key, fn) => {
    $(id).onclick = () => {
      APP[key] = !APP[key];
      $(id).classList.toggle('on', APP[key]);
      if (fn) fn(APP[key]);
    };
  };
  tg('tgLabel', 'labelsOn', (v) => { if (!v) for (const l of APP.labels) if (l.el) l.el.style.display = 'none'; });
  tg('tgShadow', 'shadowOn');
  tg('tgGrid', 'gridOn', (v) => { APP.R.gridStrength = v ? 0.16 : 0; });
  tg('tgMap', 'mapOn', (v) => { $('mapwrap').classList.toggle('hide', !v); });
  $('tgWire').onclick = () => {
    const on = !$('tgWire').classList.contains('on');
    $('tgWire').classList.toggle('on', on);
    setMode('god');
    if (on) APP.god.flyTo(0, 0, 0, 1150, Math.PI, 1.44);
    else APP.god.flyTo(0, 8, 150, 620, Math.PI, 0.55);
  };
  for (const b of document.querySelectorAll('[data-goto]')) {
    b.onclick = () => {
      const n = b.dataset.goto, alt = b.dataset.alt;
      const l = APP.labels.find(x => x.name === n) || APP.labels.find(x => x.name === alt) ||
        APP.labels.find(x => x.name.includes(n));
      if (l) { showCard(l); setMode('god'); flyTo(l); }
    };
  }
  // 导览
  $('tourPrev').onclick = () => startTour(Math.max(0, APP.tour.idx - 1));
  $('tourNext').onclick = () => startTour(Math.min(TOUR.length - 1, APP.tour.idx + 1));
  $('tourExit').onclick = () => { APP.tour.on = false; $('tour').classList.remove('show'); $('btnTour').classList.remove('on'); updateHint(); };
  $('tourPlay').onclick = () => { APP.tour.playing = !APP.tour.playing; $('tourPlay').textContent = APP.tour.playing ? '暂停' : '继续'; };
  // 小地图点击定位
  $('minimap').onclick = (e) => {
    const m = APP.map, r = e.target.getBoundingClientRect();
    const x = m.x0 + (e.clientX - r.left) / r.width * (m.x1 - m.x0);
    const z = m.z0 + (e.clientY - r.top) / r.height * (m.z1 - m.z0);
    if (APP.mode === 'fps') APP.walker.place(x, z);
    else { APP.god.flyTo(x, 6, z, Math.max(120, APP.god.tDist * 0.85)); APP.god.clamp(); }
  };
  updateHint();
}

/* ------------------------------------------------------------ 输入 */
function bindInput() {
  const cv = $('view');
  let drag = null;
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', (e) => {
    if (APP.mode === 'fps') {
      if (!document.pointerLockElement) cv.requestPointerLock && cv.requestPointerLock();
      return;
    }
    cv.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, b: e.button, moved: 0, sx: e.clientX, sy: e.clientY };
    cv.classList.add('grabbing');
  });
  cv.addEventListener('pointermove', (e) => {
    if (APP.mode === 'fps') return;
    if (!drag) { hoverPick(e.clientX, e.clientY); return; }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    const g = APP.god;
    if (drag.b === 0) {
      g.tYaw -= dx * 0.0052;
      g.tPitch += dy * 0.0042;
    } else {
      const s = g.dist * 0.0016;
      const sinY = Math.sin(g.yaw), cosY = Math.cos(g.yaw);
      g.tTarget[0] += (-dx * cosY + dy * sinY) * s;
      g.tTarget[2] += (dx * sinY + dy * cosY) * s;
    }
    g.clamp();
  });
  const endDrag = (e) => {
    if (drag && drag.moved < 6 && drag.b === 0) clickPick(drag.sx, drag.sy);
    drag = null;
    cv.classList.remove('grabbing');
    void e;
  };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);
  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (APP.mode === 'fps') {
      APP.walker.fovy = Math.max(0.5, Math.min(1.9, APP.walker.fovy + e.deltaY * 0.0006));
      return;
    }
    const g = APP.god;
    const f = Math.exp(Math.max(-0.5, Math.min(0.5, e.deltaY * 0.0011)));
    const hit = screenRay(e.clientX, e.clientY);
    g.tDist *= f;
    if (hit && f < 1) {
      const k = (1 - f) * 0.75;
      g.tTarget[0] += (hit[0] - g.tTarget[0]) * k;
      g.tTarget[1] += (hit[1] - g.tTarget[1]) * k * 0.5;
      g.tTarget[2] += (hit[2] - g.tTarget[2]) * k;
    }
    g.clamp();
  }, { passive: false });

  // 指针锁定视角
  document.addEventListener('pointerlockchange', () => {
    $('view').classList.toggle('locked', !!document.pointerLockElement);
  });
  document.addEventListener('mousemove', (e) => {
    if (APP.mode !== 'fps' || !document.pointerLockElement) return;
    const w = APP.walker;
    w.yaw -= e.movementX * 0.0022;
    w.pitch -= e.movementY * 0.0022;
    w.pitch = Math.max(-1.52, Math.min(1.52, w.pitch));
    APP.tour.on = false; $('tour').classList.remove('show');
  });

  const KEY = {
    KeyW: 'fwd', KeyS: 'back', KeyA: 'left', KeyD: 'right',
    ArrowUp: 'fwd', ArrowDown: 'back', ArrowLeft: 'left', ArrowRight: 'right',
    Space: 'up', ShiftLeft: 'run', ShiftRight: 'run', ControlLeft: 'down', KeyC: 'down',
  };
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    const k = KEY[e.code];
    if (k) { APP.input[k] = 1; if (e.code === 'Space') e.preventDefault(); }
    if (e.code === 'KeyG') setMode('god');
    if (e.code === 'KeyV') { setMode('fps'); $('view').requestPointerLock && $('view').requestPointerLock(); }
    if (e.code === 'KeyT') startTour(0);
    if (e.code === 'KeyF' && APP.mode === 'fps') { APP.walker.fly = !APP.walker.fly; showWhere(APP.walker.fly ? '飞行模式' : '步行模式'); }
    if (e.code === 'KeyL') $('tgLabel').click();
    if (e.code === 'KeyM') $('tgMap').click();
    if (e.code === 'Escape') {
      if (APP.tour.on) $('tourExit').click();
      $('card').classList.remove('show');
    }
    if (APP.tour.on) {
      if (e.code === 'Space') $('tourPlay').click();
      if (e.code === 'ArrowRight') $('tourNext').click();
      if (e.code === 'ArrowLeft') $('tourPrev').click();
    }
  });
  window.addEventListener('keyup', (e) => {
    const k = KEY[e.code];
    if (k) APP.input[k] = 0;
  });
  window.addEventListener('blur', () => { for (const k in APP.input) APP.input[k] = 0; });
}

/* 屏幕射线 → 命中点（世界坐标） */
function screenRay(sx, sy, out) {
  const R = APP.R, cam = APP.cam;
  const rect = R.canvas.getBoundingClientRect();
  const ndcx = (sx - rect.left) / rect.width * 2 - 1;
  const ndcy = 1 - (sy - rect.top) / rect.height * 2;
  const inv = M4.invert(M4.create(), R.tmp.vp);
  if (!inv) return null;
  const p = new Float32Array(4);
  M4.xformPoint(p, inv, [ndcx, ndcy, 1]);
  const dir = V3.norm(V3.create(), V3.create(p[0] / p[3] - cam.pos[0], p[1] / p[3] - cam.pos[1], p[2] / p[3] - cam.pos[2]));
  const hit = APP.q.ray(cam.pos[0], cam.pos[1], cam.pos[2], dir[0], dir[1], dir[2], 2600);
  if (hit) {
    const r = out || V3.create();
    V3.set(r, hit.x + .5, hit.y + .5, hit.z + .5);
    r.id = hit.id;
    return r;
  }
  // 与 y=0 平面求交
  if (dir[1] < -1e-4) {
    const t = -cam.pos[1] / dir[1];
    const r = out || V3.create();
    V3.set(r, cam.pos[0] + dir[0] * t, 0, cam.pos[2] + dir[2] * t);
    r.id = APP.idmap.at(r[0], r[2]);
    return r;
  }
  return null;
}
let hoverT = 0, hoverId = 0;
function hoverPick(sx, sy) {
  const now = performance.now();
  APP.mouse = [sx, sy];
  if (now - hoverT < 90) return;
  hoverT = now;
  const hit = screenRay(sx, sy);
  const tip = $('tip');
  const id = hit ? hit.id : 0;
  if (!id) { tip.style.display = 'none'; hoverId = 0; return; }
  if (id !== hoverId) {
    hoverId = id;
    const l = APP.labelById.get(id);
    tip.textContent = l ? l.name : '';
    tip.style.display = l ? 'block' : 'none';
  }
  tip.style.left = sx + 'px';
  tip.style.top = sy + 'px';
}
function clickPick(sx, sy) {
  const hit = screenRay(sx, sy);
  if (!hit || !hit.id) { $('card').classList.remove('show'); return; }
  const l = APP.labelById.get(hit.id);
  if (l) showCard(l);
}

/* ------------------------------------------------------------ 导览 */
function startTour(i) {
  APP.tour.on = true; APP.tour.idx = i; APP.tour.t = 0; APP.tour.playing = true;
  setMode('fps');
  $('tour').classList.add('show');
  $('btnTour').classList.add('on');
  $('tourPlay').textContent = '暂停';
  const s = TOUR[i];
  const w = APP.walker;
  w.fly = false;
  w.place(s.x, s.z, s.y);
  w.yaw = s.yaw; w.pitch = s.pitch || -0.02;
  $('tourCap').textContent = s.cap;
  $('tourTxt').textContent = s.text;
  $('tourNo').textContent = (i + 1) + ' / ' + TOUR.length;
  updateHint();
}
function updateTour(dt) {
  const T = APP.tour;
  if (!T.on || !T.playing) return;
  const cur = TOUR[T.idx], nxt = TOUR[T.idx + 1];
  if (!nxt) { T.playing = false; $('tourPlay').textContent = '继续'; return; }
  const w = APP.walker;
  const dist = Math.hypot(nxt.x - w.pos[0], nxt.z - w.pos[2]);
  const dur = Math.max(2.4, dist / 11);
  T.t += dt / dur;
  const t = Math.min(1, T.t);
  const e = t < .5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
  const x = cur.x + (nxt.x - cur.x) * e, z = cur.z + (nxt.z - cur.z) * e;
  // 贴地跟随
  const q = APP.q;
  let y = (cur.y || 0) + ((nxt.y || 0) - (cur.y || 0)) * e;
  let gy = Math.max(y, q.groundTop(x, z));
  for (let s = 0; s < 26; s++) { if (!q.solid(x, gy, z) && !q.solid(x, gy + 1, z)) break; gy++; }
  V3.set(w.pos, x, gy, z);
  V3.set(w.vel, 0, 0, 0);
  // 朝向插值
  let dy = nxt.yaw - cur.yaw;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  w.yaw = cur.yaw + dy * e;
  w.pitch = (cur.pitch || -0.02) + ((nxt.pitch || -0.02) - (cur.pitch || -0.02)) * e;
  if (t >= 1) {
    T.idx++; T.t = 0;
    const s = TOUR[T.idx];
    $('tourCap').textContent = s.cap;
    $('tourTxt').textContent = s.text;
    $('tourNo').textContent = (T.idx + 1) + ' / ' + TOUR.length;
  }
}

/* ------------------------------------------------------------ 标注 */
function updateLabels() {
  const box = $('labels');
  if (!APP.labelsOn) return;
  const R = APP.R, cam = APP.cam;
  const vp = R.tmp.vp;
  const o = new Float32Array(4);
  const w = R.canvas.clientWidth, h = R.canvas.clientHeight;
  const cands = [];
  for (const l of APP.labels) {
    if (/院落$|广场$/.test(l.name) && APP.mode === 'fps') continue;
    const area = (l.x1 - l.x0) * (l.z1 - l.z0);
    const d = Math.hypot(l.x - cam.pos[0], l.z - cam.pos[2], (l.y - cam.pos[1]) * 0.5);
    const maxD = 160 + Math.sqrt(area) * (APP.mode === 'fps' ? 14 : 26);
    if (d > maxD) { if (l.el) l.el.style.display = 'none'; continue; }
    M4.xformPoint(o, vp, [l.x, l.y + 3, l.z]);
    if (o[3] <= 0.1) { if (l.el) l.el.style.display = 'none'; continue; }
    const sx = (o[0] / o[3] * 0.5 + 0.5) * w, sy = (1 - (o[1] / o[3] * 0.5 + 0.5)) * h;
    if (sx < -80 || sy < -20 || sx > w + 80 || sy > h + 20) { if (l.el) l.el.style.display = 'none'; continue; }
    cands.push({ l, sx, sy, d, score: area / (d + 40) });
  }
  cands.sort((a, b) => b.score - a.score);
  const max = APP.mode === 'fps' ? 16 : 34;
  const rows = [];
  let shown = 0;
  for (const c of cands) {
    let hide = shown >= max;
    if (!hide) {
      for (const r of rows) {          // 简易避让
        if (Math.abs(r[0] - c.sx) < 78 && Math.abs(r[1] - c.sy) < 15) { hide = true; break; }
      }
    }
    const l = c.l;
    if (hide) { if (l.el) l.el.style.display = 'none'; continue; }
    rows.push([c.sx, c.sy]);
    shown++;
    if (!l.el) {
      const el = document.createElement('div');
      el.className = 'lab';
      el.textContent = l.name;
      el.onclick = () => { showCard(l); if (APP.mode === 'god') flyTo(l); };
      box.appendChild(el);
      l.el = el;
    }
    const big = (l.x1 - l.x0) * (l.z1 - l.z0) > 1400;
    l.el.className = 'lab' + (big ? ' big' : '');
    l.el.style.display = 'block';
    l.el.style.left = c.sx.toFixed(0) + 'px';
    l.el.style.top = c.sy.toFixed(0) + 'px';
    l.el.style.opacity = Math.max(0.25, Math.min(1, 1.35 - c.d / 900)).toFixed(2);
  }
}

/* ------------------------------------------------------------ 主循环 */
let last = 0, fpsAcc = 0, fpsN = 0, frameNo = 0;
function loop(now) {
  requestAnimationFrame(loop);
  if (APP.freeze) return;
  now = now || performance.now();
  let dt = (now - last) / 1000;
  last = now;
  if (!(dt > 0) || dt > 0.25) dt = 1 / 60;
  frameNo++;

  const cam = APP.cam;
  if (APP.mode === 'fps') {
    updateTour(dt);
    if (!APP.tour.on || !APP.tour.playing) APP.walker.move(dt, APP.input);
    APP.walker.camera(cam);
    cam.shadowFocus = APP.walker.pos;
  } else {
    // 键盘平移
    const g = APP.god, I = APP.input;
    const sp = (I.run ? 3.2 : 1) * g.dist * dt * 0.55;
    if (I.fwd || I.back || I.left || I.right) {
      const s = Math.sin(g.yaw), c = Math.cos(g.yaw);
      const fx = (I.back - I.fwd) * s + (I.right - I.left) * c;
      const fz = (I.back - I.fwd) * c - (I.right - I.left) * s;
      g.tTarget[0] += fx * sp; g.tTarget[2] += fz * sp;
      g.clamp();
    }
    if (I.up) { g.tDist *= 1 - dt * 0.9; g.clamp(); }
    if (I.down) { g.tDist *= 1 + dt * 0.9; g.clamp(); }
    g.update(dt);
    V3.copy(cam.pos, g.pos); V3.copy(cam.target, g.target);
    cam.fovy = g.fovy;
    cam.shadowFocus = g.target;
  }
  APP.R.shadowOn = APP.shadowOn;
  APP.R.render(cam, dt);
  updateLabels();
  if (frameNo % 3 === 0) drawMinimap();

  // 状态
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) {
    const fps = fpsN / fpsAcc;
    APP.stats.fps = fps;
    fpsAcc = 0; fpsN = 0;
    $('stats').innerHTML = Math.round(fps) + ' FPS<br>' +
      (APP.R.stats.drawn) + ' 批次<br>' +
      (APP.R.stats.quads / 1000).toFixed(0) + 'k 面<br>' +
      (APP.quadCount / 1000).toFixed(0) + 'k 总面<br>' +
      (APP.vol.total / 10000).toFixed(0) + '万 体素';
    // 自适应画质
    if (fps < 26 && APP.R.maxDPR > 1) APP.R.maxDPR = 1;
    else if (fps < 18 && APP.R.shadowSize > 1024) { APP.R.shadowSize = 1024; APP.R._initShadow(); }
  }
  if (window.__onFrame) window.__onFrame(APP);
  // 位置提示
  if (frameNo % 20 === 0) {
    const p = APP.mode === 'fps' ? APP.walker.pos : APP.god.target;
    const id = APP.idmap.at(p[0], p[2]);
    if (id && id !== APP.lastWhere) {
      APP.lastWhere = id;
      const l = APP.labelById.get(id);
      if (l && APP.mode === 'fps') showWhere(l.name);
    }
  }
}

window.APP = APP;
window.addEventListener('load', boot);
