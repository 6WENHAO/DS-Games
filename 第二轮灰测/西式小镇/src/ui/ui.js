// ---------------------------------------------------------------------------
// 界面：片区导览面板 / 控制台 / 小地图 / 状态栏
// ---------------------------------------------------------------------------
import { ROADS, riverCenter, RIVER, RAILS } from '../world/terrain.js';

const R = 272; // 小地图覆盖的世界半径

export function initUI(opts) {
  const { state, districts, focusDistrict, overview, onToggleShadows, onToggleLabels, stats } = opts;

  /* ---------------------------- 片区列表 ---------------------------- */
  const panel = document.getElementById('panel');
  const cards = new Map();
  districts.forEach((d, i) => {
    const el = document.createElement('button');
    el.className = 'card';
    el.style.setProperty('--accent', d.color);
    el.innerHTML = `
      <span class="card-key">${i + 1}</span>
      <span class="card-icon">${d.icon}</span>
      <span class="card-main">
        <span class="card-name">${d.name}</span>
        <span class="card-en">${d.en}</span>
      </span>`;
    el.addEventListener('click', () => focusDistrict(d.id));
    el.addEventListener('mouseenter', () => {
      detailTitle.textContent = `${d.icon} ${d.name} · ${d.en}`;
      detailDesc.textContent = d.desc;
      detailList.innerHTML = d.features.map((f) => `<li>${f}</li>`).join('');
      detail.classList.add('show');
    });
    panel.appendChild(el);
    cards.set(d.id, el);
  });

  const detail = document.getElementById('detail');
  const detailTitle = document.getElementById('detail-title');
  const detailDesc = document.getElementById('detail-desc');
  const detailList = document.getElementById('detail-list');
  panel.addEventListener('mouseleave', () => detail.classList.remove('show'));

  /* ---------------------------- 控制台 ------------------------------ */
  const dock = document.getElementById('dock');
  dock.innerHTML = `
    <div class="row">
      <label class="lbl">时刻</label>
      <input id="c-time" type="range" min="0" max="24" step="0.05">
      <span id="c-clock" class="val">09:36</span>
    </div>
    <div class="row wrap">
      <label class="chk"><input id="c-auto" type="checkbox"> 昼夜循环</label>
      <select id="c-speed" title="循环速度">
        <option value="0.12">慢</option>
        <option value="0.32">中</option>
        <option value="0.9">快</option>
      </select>
      <label class="chk"><input id="c-labels" type="checkbox"> 名牌</label>
      <label class="chk"><input id="c-shadow" type="checkbox"> 阴影</label>
      <label class="chk"><input id="c-smoke" type="checkbox"> 炊烟</label>
    </div>
    <div class="row btns">
      <button id="c-overview">全景</button>
      <button id="c-prev">◀ 上一区</button>
      <button id="c-next">下一区 ▶</button>
      <button id="c-tour">自动巡游</button>
    </div>`;

  const $ = (id) => document.getElementById(id);
  const timeEl = $('c-time');
  const clockEl = $('c-clock');
  const autoEl = $('c-auto');
  const speedEl = $('c-speed');
  const labelsEl = $('c-labels');
  const shadowEl = $('c-shadow');
  const smokeEl = $('c-smoke');
  const tourBtn = $('c-tour');

  timeEl.addEventListener('input', () => {
    state.tod = parseFloat(timeEl.value);
    state.auto = false;
    autoEl.checked = false;
  });
  autoEl.addEventListener('change', () => {
    state.auto = autoEl.checked;
  });
  speedEl.addEventListener('change', () => {
    state.speed = parseFloat(speedEl.value);
  });
  labelsEl.addEventListener('change', () => {
    state.labels = labelsEl.checked;
    onToggleLabels(state.labels);
  });
  shadowEl.addEventListener('change', () => {
    state.shadows = shadowEl.checked;
    onToggleShadows(state.shadows);
  });
  smokeEl.addEventListener('change', () => {
    state.smoke = smokeEl.checked;
  });
  $('c-overview').addEventListener('click', () => {
    tour.on = false;
    tourBtn.classList.remove('on');
    overview();
  });
  $('c-prev').addEventListener('click', () => cycle(-1));
  $('c-next').addEventListener('click', () => cycle(1));
  tourBtn.addEventListener('click', () => {
    tour.on = !tour.on;
    tour.t = 1e9;
    tourBtn.classList.toggle('on', tour.on);
  });

  let activeIdx = -1;
  function cycle(dir) {
    activeIdx = (activeIdx + dir + districts.length) % districts.length;
    focusDistrict(districts[activeIdx].id);
  }
  const tour = { on: false, t: 0, period: 10 };

  /* ---------------------------- 小地图 ------------------------------ */
  const mini = document.getElementById('minimap-canvas');
  const SZ = 250;
  mini.width = SZ;
  mini.height = SZ;
  const mctx = mini.getContext('2d');
  const base = document.createElement('canvas');
  base.width = SZ;
  base.height = SZ;
  const bctx = base.getContext('2d');

  const mx = (x) => ((x + R) / (2 * R)) * SZ;
  const mz = (z) => ((z + R) / (2 * R)) * SZ;

  function drawBase() {
    bctx.clearRect(0, 0, SZ, SZ);
    // 底色
    bctx.fillStyle = '#243024';
    bctx.fillRect(0, 0, SZ, SZ);
    bctx.fillStyle = 'rgba(120,150,90,0.16)';
    for (let i = 0; i < 240; i++) {
      bctx.fillRect(Math.random() * SZ, Math.random() * SZ, 1.6, 1.6);
    }
    // 河
    bctx.strokeStyle = '#2f6f96';
    bctx.lineWidth = (RIVER.width / (2 * R)) * SZ;
    bctx.lineCap = 'round';
    bctx.beginPath();
    for (let x = -R; x <= R; x += 8) {
      const px = mx(x);
      const pz = mz(riverCenter(x));
      if (x === -R) bctx.moveTo(px, pz);
      else bctx.lineTo(px, pz);
    }
    bctx.stroke();
    // 街道
    for (const r of ROADS) {
      bctx.strokeStyle = r.mat === 'dirt' || r.mat === 'gravel' ? '#8a7757' : '#a8a292';
      bctx.lineWidth = Math.max(1, (r.w / (2 * R)) * SZ);
      bctx.beginPath();
      r.pts.forEach(([x, z], i) => {
        if (i === 0) bctx.moveTo(mx(x), mz(z));
        else bctx.lineTo(mx(x), mz(z));
      });
      bctx.stroke();
    }
    // 铁路
    bctx.strokeStyle = '#5a5a66';
    bctx.lineWidth = 2.4;
    bctx.setLineDash([5, 3]);
    bctx.beginPath();
    bctx.moveTo(mx(RAILS[0][0]), mz(RAILS[0][1]));
    bctx.lineTo(mx(RAILS[1][0]), mz(RAILS[1][1]));
    bctx.stroke();
    bctx.setLineDash([]);
    // 片区
    const roundRect = (c, x, y, w, h, r) => {
      if (c.roundRect) {
        c.beginPath();
        c.roundRect(x, y, w, h, r);
      } else {
        c.beginPath();
        c.rect(x, y, w, h);
      }
    };
    districts.forEach((d, i) => {
      const [x0, z0, x1, z1] = d.bounds;
      bctx.fillStyle = d.color + '30';
      bctx.strokeStyle = d.color + 'cc';
      bctx.lineWidth = 1.2;
      roundRect(bctx, mx(x0), mz(z0), mx(x1) - mx(x0), mz(z1) - mz(z0), 4);
      bctx.fill();
      bctx.stroke();
      bctx.fillStyle = '#f6f0e2';
      bctx.font = 'bold 11px "Segoe UI", sans-serif';
      bctx.textAlign = 'center';
      bctx.fillText(String(i + 1), mx(d.center[0]), mz(d.center[1]) + 4);
    });
    // 指北针
    bctx.strokeStyle = '#f0e6cc';
    bctx.fillStyle = '#f0e6cc';
    bctx.lineWidth = 1.4;
    bctx.beginPath();
    bctx.moveTo(SZ - 16, 26);
    bctx.lineTo(SZ - 16, 8);
    bctx.stroke();
    bctx.beginPath();
    bctx.moveTo(SZ - 16, 5);
    bctx.lineTo(SZ - 20, 13);
    bctx.lineTo(SZ - 12, 13);
    bctx.closePath();
    bctx.fill();
    bctx.font = '10px serif';
    bctx.fillText('N', SZ - 16, 36);
  }
  drawBase();

  function drawMini(camera, controls) {
    mctx.clearRect(0, 0, SZ, SZ);
    mctx.drawImage(base, 0, 0);
    // 视锥
    const cx = mx(camera.position.x);
    const cz = mz(camera.position.z);
    const tx = mx(controls.target.x);
    const tz = mz(controls.target.z);
    const a = Math.atan2(tz - cz, tx - cx);
    const spread = 0.42;
    const len = 46;
    const grad = mctx.createRadialGradient(cx, cz, 2, cx, cz, len);
    grad.addColorStop(0, 'rgba(255,235,180,0.55)');
    grad.addColorStop(1, 'rgba(255,235,180,0)');
    mctx.fillStyle = grad;
    mctx.beginPath();
    mctx.moveTo(cx, cz);
    mctx.arc(cx, cz, len, a - spread, a + spread);
    mctx.closePath();
    mctx.fill();
    // 相机点
    mctx.fillStyle = '#ffe9a8';
    mctx.beginPath();
    mctx.arc(cx, cz, 3.4, 0, Math.PI * 2);
    mctx.fill();
    // 焦点
    mctx.strokeStyle = 'rgba(255,255,255,0.7)';
    mctx.lineWidth = 1;
    mctx.beginPath();
    mctx.moveTo(tx - 4, tz);
    mctx.lineTo(tx + 4, tz);
    mctx.moveTo(tx, tz - 4);
    mctx.lineTo(tx, tz + 4);
    mctx.stroke();
  }

  /* ---------------------------- 状态栏 ------------------------------ */
  const statEl = document.getElementById('stats');
  function fmtClock(tod) {
    const h = Math.floor(tod) % 24;
    const m = Math.floor((tod - Math.floor(tod)) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function sync() {
    timeEl.value = String(state.tod);
    autoEl.checked = state.auto;
    speedEl.value = String(state.speed);
    labelsEl.checked = state.labels;
    shadowEl.checked = state.shadows;
    smokeEl.checked = state.smoke;
  }
  sync();

  function setActive(id) {
    cards.forEach((el, key) => el.classList.toggle('active', key === id));
    activeIdx = districts.findIndex((d) => d.id === id);
    const d = districts.find((x) => x.id === id);
    if (d) {
      detailTitle.textContent = `${d.icon} ${d.name} · ${d.en}`;
      detailDesc.textContent = d.desc;
      detailList.innerHTML = d.features.map((f) => `<li>${f}</li>`).join('');
    }
  }

  let last = performance.now();
  function tick(st, camera, controls) {
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;
    clockEl.textContent = fmtClock(st.tod);
    if (st.auto) timeEl.value = String(st.tod);
    const phase =
      st.nightK > 0.75 ? '夜' : st.nightK > 0.3 ? '晨昏' : st.tod < 12 ? '上午' : '午后';
    statEl.innerHTML = `
      <span><b>${st.fps}</b> FPS</span>
      <span>构件 <b>${stats.pieces.toLocaleString()}</b></span>
      <span>网格 <b>${stats.meshes}</b></span>
      <span>活动 <b>${(stats.walkers ?? 0) + (stats.vehicles ?? 0)}</b></span>
      <span>${phase} <b>${fmtClock(st.tod)}</b></span>`;
    drawMini(camera, controls);
    if (tour.on) {
      tour.t += dt;
      if (tour.t > tour.period) {
        tour.t = 0;
        cycle(1);
      }
    }
  }

  return { tick, sync, setActive };
}
