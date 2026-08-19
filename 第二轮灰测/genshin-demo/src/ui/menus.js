// Menus: world map (M), quest panel (J), inventory (B), pause/settings (Esc).
// Also owns the shared procedural world-map canvas used by both the big map and the minimap.
import { clamp } from '../core/utils.js';
import { height, moistureAt, WORLD, REGIONS } from '../world/heightfield.js';

const MAP_SIZE = 208;
const ELEMENT_COLORS = { anemo:'#74c8a8', pyro:'#ff7a55', hydro:'#4fc3f7', electro:'#c88bfa', cryo:'#93e0ef', geo:'#f0b93c', dendro:'#9adb4a' };
const KIND_SHAPE = { currency:'mora', material:'crystal', food:'shroom', ore:'crystal', drop:'seed', quest:'star', exp:'star' };

let _worldMap = null;
let _building = false;

function biomeColor(wx, wz) {
  const h = height(wx, wz);
  const d = Math.hypot(wx, wz);
  if (h < WORLD.waterLevel - 0.15) {
    if (d < WORLD.landRadius + 60) return [88, 172, 188];           // inland lake
    const depth = clamp((-h) / 46, 0, 1);
    return [30 - 12 * depth, 84 - 20 * depth, 150 - 26 * depth];    // ocean
  }
  if (h > 128) return [238, 243, 250];                              // snow
  if (h < 3.4) return [224, 204, 150];                              // sand
  const m = moistureAt(wx, wz);
  let r, g, b;
  if (m < 0.22) { r = 180; g = 154; b = 104; }                       // dirt
  else {
    const gm = m;                                                   // grass
    r = 96 - 30 * gm; g = 150 - 24 * gm; b = 74 - 26 * gm;
  }
  if (h > 55) { const t = clamp((h - 55) / 70, 0, 1) * 0.5; r += (150 - r) * t; g += (136 - g) * t; b += (110 - b) * t; }
  return [r, g, b];
}

function schedule(ctx, fn, priority = 1) {
  if (ctx && ctx.tasks && typeof ctx.tasks.push === 'function') ctx.tasks.push(fn, priority);
  else fn();
}

/** Shared world map canvas (built once, chunked across frames). Returns null until ready. */
export function worldMapCanvas(ctx) {
  if (_worldMap) return _worldMap;
  if (!_building) {
    _building = true;
    const S = MAP_SIZE;
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const c2d = cv.getContext('2d');
    const img = c2d.createImageData(S, S);
    const half = WORLD.size / 2, scale = WORLD.size / S;
    let y = 0;
    const step = () => {
      for (let i = 0; i < 16 && y < S; i++, y++) {
        const wz = (y - S / 2) * scale;
        for (let x = 0; x < S; x++) {
          const c = biomeColor((x - S / 2) * scale, wz);
          const p = (y * S + x) * 4;
          img.data[p] = c[0]; img.data[p + 1] = c[1]; img.data[p + 2] = c[2]; img.data[p + 3] = 255;
        }
      }
      if (y >= S) { c2d.putImageData(img, 0, 0); _worldMap = cv; _building = false; }
      else schedule(ctx, step, 1);
    };
    schedule(ctx, step, 1);
  }
  return null;
}

export function drawPlayerArrow(ctx, x, y, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.72, size * 0.6);
  ctx.lineTo(0, size * 0.24);
  ctx.lineTo(-size * 0.72, size * 0.6);
  ctx.closePath();
  ctx.fillStyle = color || '#ffd76a';
  ctx.fill();
  ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(60,40,8,.85)'; ctx.stroke();
  ctx.restore();
}

function h(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function decorate(panel) {
  for (const c of ['tl', 'tr', 'bl', 'br']) { const d = h('i', 'ui-corner ' + c); panel.appendChild(d); }
}

export class MenusSystem {
  constructor(ctx, api) {
    this.ctx = ctx; this.api = api;
    this.mapOpen = false;
    this._quests = [];
    this._open = null;                 // 'map' | 'quests' | 'inventory' | 'pause'
    this._mapCenter = { x: 0, z: 0 };
    this._mapZoom = 1;
    this._wpEls = [];
    this._dragging = false; this._dragLast = { x: 0, y: 0 };
    this._build();
    this._bindKeys();
    this._bindMapInput();
  }

  _build() {
    const root = h('div'); root.id = 'menus';
    this.root = root;

    // map panel
    const map = h('div', 'menu-panel ui-panel'); map.id = 'panel-map';
    const mTitle = h('div', 'ui-title'); mTitle.textContent = '大 地 图';
    const mCanvas = h('div'); mCanvas.id = 'map-canvas';
    this._mapCv = h('canvas');
    this._mapCtx = this._mapCv.getContext('2d');
    mCanvas.appendChild(this._mapCv);
    const mHint = h('div', 'map-hint'); mHint.textContent = '拖动平移 · 滚轮缩放 · 点击传送点传送';
    map.appendChild(mTitle); map.appendChild(mCanvas); map.appendChild(mHint);
    decorate(map);

    // quest panel
    const quests = h('div', 'menu-panel ui-panel'); quests.id = 'panel-quests';
    const qTitle = h('div', 'ui-title'); qTitle.textContent = '任 务';
    this._questList = h('div', 'menu-list');
    quests.appendChild(qTitle); quests.appendChild(this._questList);
    decorate(quests);

    // inventory panel
    const inv = h('div', 'menu-panel ui-panel'); inv.id = 'panel-inventory';
    const iTitle = h('div', 'ui-title'); iTitle.textContent = '背 包';
    this._invGrid = h('div', 'inv-grid');
    inv.appendChild(iTitle); inv.appendChild(this._invGrid);
    decorate(inv);

    // pause panel
    const pause = h('div', 'menu-panel ui-panel'); pause.id = 'panel-pause';
    const pTitle = h('div', 'ui-title'); pTitle.textContent = '暂 停 · 设 置';
    this._pauseBody = h('div');
    pause.appendChild(pTitle); pause.appendChild(this._pauseBody);
    decorate(pause);

    root.appendChild(map); root.appendChild(quests); root.appendChild(inv); root.appendChild(pause);

    const host = document.getElementById('ui-root') || document.body;
    host.appendChild(root);

    // waypoint markers
    for (const r of REGIONS) {
      const wp = h('div', 'map-wp');
      wp._region = r;
      const ic = h('div', 'wp-icon');
      const nm = h('div', 'wp-name'); nm.textContent = r.name;
      wp.appendChild(ic); wp.appendChild(nm);
      wp.addEventListener('click', (e) => { e.stopPropagation(); this._teleport(r); });
      mCanvas.appendChild(wp);
      this._wpEls.push(wp);
    }

    this._renderPause();
    this._renderInventory();
  }

  _bindKeys() {
    this._onKey = (e) => {
      if (e.code === 'KeyM') this.toggleMap();
      else if (e.code === 'KeyJ') this.toggleQuests();
      else if (e.code === 'KeyB') this.toggleInventory();
      else if (e.code === 'Escape') this._esc();
    };
    addEventListener('keydown', this._onKey);
  }

  _bindMapInput() {
    const cv = this._mapCv;
    cv.addEventListener('mousedown', (e) => {
      if (!this.mapOpen) return;
      this._dragging = true; this._dragLast = { x: e.clientX, y: e.clientY };
      cv.classList.add('dragging');
    });
    addEventListener('mouseup', () => { this._dragging = false; cv.classList.remove('dragging'); });
    addEventListener('mousemove', (e) => {
      if (!this._dragging || !this.mapOpen) return;
      const W = cv.clientWidth, H = cv.clientHeight;
      const s = (Math.min(W, H) / 3400) * this._mapZoom;
      this._mapCenter.x -= (e.clientX - this._dragLast.x) / s;
      this._mapCenter.z -= (e.clientY - this._dragLast.y) / s;
      this._dragLast = { x: e.clientX, y: e.clientY };
    });
    cv.addEventListener('wheel', (e) => {
      if (!this.mapOpen) return;
      e.preventDefault();
      const f = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      this._mapZoom = clamp(this._mapZoom * f, 1, 5);
    }, { passive: false });
  }

  _teleport(r) {
    const p = this.ctx.player;
    if (p && typeof p.teleport === 'function') p.teleport(r.x, r.z);
    if (this.api && this.api.toast) this.api.toast('已传送至 · ' + r.name, { icon: 'waypoint', ms: 1800 });
  }

  // ---- public: map ------------------------------------------------
  toggleMap() { this.mapOpen ? this._close('map') : this._openPanel('map'); }
  get isOpen() { return this.mapOpen; }

  toggleQuests() { this._open === 'quests' ? this._close('quests') : this._openPanel('quests'); }
  toggleInventory() { this._open === 'inventory' ? this._close('inventory') : this._openPanel('inventory'); }

  _esc() {
    if (this._open) { this._close(this._open); return; }
    this._openPanel('pause');
  }

  _openPanel(name) {
    this._close(this._open);
    this._open = name;
    this.mapOpen = name === 'map';
    this._panel(name).classList.add('open');
    if (name === 'map') { this._centerMap(); this._sizeMapCanvas(); }
    this._setPaused(true);
  }
  _close(name) {
    if (!name) return;
    const el = this._panel(name);
    if (el) el.classList.remove('open');
    if (this._open === name) this._open = null;
    this.mapOpen = false;
    this._setPaused(false);
  }
  _panel(name) {
    return { map: this.root.querySelector('#panel-map'), quests: this.root.querySelector('#panel-quests'), inventory: this.root.querySelector('#panel-inventory'), pause: this.root.querySelector('#panel-pause') }[name];
  }
  _setPaused(v) {
    this.ctx.paused = v;
    if (v && this.ctx.input && typeof this.ctx.input.releaseLock === 'function') this.ctx.input.releaseLock();
  }

  _centerMap() {
    const p = this.ctx.player;
    const pos = (p && p.position) || (p && p.root && p.root.position);
    if (pos && typeof pos.x === 'number') { this._mapCenter.x = pos.x; this._mapCenter.z = pos.z; }
    else { this._mapCenter.x = 0; this._mapCenter.z = 0; }
  }

  _sizeMapCanvas() {
    const box = this._mapCv.parentElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(80, box.clientWidth), hgt = Math.max(80, box.clientHeight);
    this._mapCv.width = Math.floor(w * dpr); this._mapCv.height = Math.floor(hgt * dpr);
    this._mapCv.style.width = w + 'px'; this._mapCv.style.height = hgt + 'px';
    this._mapCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _drawMap() {
    const ctx = this._mapCtx;
    const W = this._mapCv.width / (Math.min(window.devicePixelRatio || 1, 1.5));
    const H = this._mapCv.height / (Math.min(window.devicePixelRatio || 1, 1.5));
    const mapCv = worldMapCanvas(this.ctx);
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
    bg.addColorStop(0, '#16223c'); bg.addColorStop(1, '#0a1322');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    if (!mapCv) { ctx.fillStyle = '#b9c8dd'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('正在绘制地图…', W / 2, H / 2); return; }
    const s = (Math.min(W, H) / 3400) * this._mapZoom;
    const C = this._mapCenter, half = WORLD.size / 2;
    const dx = W / 2 + (-half - C.x) * s, dy = H / 2 + (-half - C.z) * s, dw = WORLD.size * s;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(mapCv, dx, dy, dw, dw);
    // subtle land vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.66);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(6,10,18,.45)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    drawPlayerArrow(ctx, W / 2, H / 2, 11, '#ffd76a');
  }

  _layoutWaypoints() {
    const box = this._mapCv.parentElement;
    const W = box.clientWidth, H = box.clientHeight;
    const s = (Math.min(W, H) / 3400) * this._mapZoom;
    const C = this._mapCenter;
    for (const wp of this._wpEls) {
      const r = wp._region;
      const x = W / 2 + (r.x - C.x) * s, y = H / 2 + (r.z - C.z) * s;
      wp.style.left = x + 'px'; wp.style.top = y + 'px';
      wp.style.display = (x < -24 || x > W + 24 || y < -24 || y > H + 24) ? 'none' : 'block';
    }
  }

  // ---- quests ------------------------------------------------------
  setQuest(list) {
    this._quests = Array.isArray(list) ? list : [];
    this._renderQuestList();
  }
  setInventory(list) { this._inv = list || []; this._renderInventory(); }

  _renderQuestList() {
    this._questList.innerHTML = '';
    for (const q of this._quests) {
      const item = h('div', 'quest-item' + (q.active ? ' active' : ''));
      const t = h('div', 'q-title'); t.textContent = q.title;
      item.appendChild(t);
      for (const st of (Array.isArray(q.steps) ? q.steps : [])) {
        const row = h('div', 'q-step' + (st.done ? ' done' : ''));
        const chk = h('i', 'chk');
        const txt = h('span'); txt.textContent = st.text;
        row.appendChild(chk); row.appendChild(txt);
        item.appendChild(row);
      }
      this._questList.appendChild(item);
    }
  }

  _renderInventory() {
    let list = [];
    try {
      if (Array.isArray(this._inv)) list = this._inv;
      else if (this.ctx && this.ctx.inventory && typeof this.ctx.inventory.list === 'function') list = this.ctx.inventory.list();
      else if (this.ctx && Array.isArray(this.ctx.inventory)) list = this.ctx.inventory;
      else list = [];
    } catch (e) { list = []; }
    if (!Array.isArray(list) || !list.length) list = this._placeholderItems();
    this._invGrid.innerHTML = '';
    for (const it of list) {
      if (!it) continue;
      const count = it.n ?? it.count ?? 1;
      const slot = h('div', 'inv-slot r' + (it.rarity || 1));
      const cv = h('canvas'); cv.width = cv.height = 48;
      drawItemIcon(cv, it);
      slot.appendChild(cv);
      if (count > 1) { const n = h('span', 'inv-num'); n.textContent = count; slot.appendChild(n); }
      slot.title = it.name || it.id || '';
      this._invGrid.appendChild(slot);
    }
    // fill with empty slots to a full grid
    const cols = 7, rows = 4, total = cols * rows;
    for (let i = list.length; i < total; i++) this._invGrid.appendChild(h('div', 'inv-slot empty'));
  }

  _placeholderItems() {
    return [
      { name: '摩拉', rarity: 3, shape: 'mora', count: 99999 },
      { name: '风之印', rarity: 2, shape: 'star', count: 42 },
      { name: '蒲公英籽', rarity: 1, shape: 'seed', count: 12 },
      { name: '松茸', rarity: 1, shape: 'shroom', count: 7 },
      { name: '精锻用魔矿', rarity: 3, shape: 'crystal', count: 60 },
      { name: '原石', rarity: 4, shape: 'gem', count: 1600 },
      { name: '四星圣遗物·羽', rarity: 4, shape: 'feather', count: 1 },
      { name: '单手剑·试作斩岩', rarity: 4, shape: 'sword', count: 1 },
      { name: '北风之环', rarity: 5, shape: 'flower', count: 2 },
      { name: '龙牙', rarity: 3, shape: 'crystal', count: 8 },
    ];
  }

  _renderPause() {
    this._pauseBody.innerHTML = '';
    // quality
    const rowQ = h('div', 'settings-row');
    const qL = h('div'); const qT = h('div', 's-label'); qT.textContent = '画质'; const qS = h('div', 's-sub'); qS.textContent = '切换后需刷新页面生效'; qL.appendChild(qT); qL.appendChild(qS);
    const qV = h('div', 's-val');
    const tier = this.ctx.tier || 'high';
    for (const t of ['low', 'med', 'high']) {
      const b = h('button', 's-opt' + (tier === t ? ' sel' : ''));
      b.textContent = { low: '低', med: '中', high: '高' }[t];
      b.addEventListener('click', () => this._setTier(t, b));
      qV.appendChild(b);
    }
    rowQ.appendChild(qL); rowQ.appendChild(qV);

    // volume
    const rowV = h('div', 'settings-row');
    const vL = h('div'); const vT = h('div', 's-label'); vT.textContent = '音量'; vL.appendChild(vT);
    const vV = h('div', 's-val');
    const rng = h('input'); rng.type = 'range'; rng.min = 0; rng.max = 100; rng.value = 80;
    rng.addEventListener('input', () => { if (this.ctx.audio && this.ctx.audio.setVolume) this.ctx.audio.setVolume(rng.value / 100); });
    vV.appendChild(rng);
    rowV.appendChild(vL); rowV.appendChild(vV);

    // controls
    const cGrid = h('div', 'ctrl-grid');
    const rows = [
      ['移动', 'W A S D'], ['冲刺 / 滑翔', 'Shift'], ['跳跃', '空格'], ['普通攻击', '鼠标左键'],
      ['元素战技', 'E'], ['元素爆发', 'Q'], ['交互 / 调查', 'F'], ['锁定', 'R'],
      ['大地图', 'M'], ['背包', 'B'], ['任务', 'J'], ['暂停', 'Esc'],
    ];
    for (const [k, v] of rows) { const kk = h('div', 'k'); kk.textContent = k; const vv = h('div'); vv.textContent = v; cGrid.appendChild(kk); cGrid.appendChild(vv); }

    this._pauseBody.appendChild(rowQ); this._pauseBody.appendChild(rowV); this._pauseBody.appendChild(cGrid);
  }

  _setTier(t, btn) {
    this.ctx.tier = t;
    const opts = btn.parentElement.querySelectorAll('.s-opt');
    for (const o of opts) o.classList.remove('sel');
    btn.classList.add('sel');
    if (this.api && this.api.toast) this.api.toast('画质已切换为「' + { low: '低', med: '中', high: '高' }[t] + '」，刷新后生效', { ms: 2200 });
  }

  update(dt) {
    if (this.mapOpen) {
      this._drawMap();
      this._layoutWaypoints();
      // center follows player when map first opens only; keep static otherwise
    }
  }
}

function drawItemIcon(cv, it) {
  const ctx = cv.getContext('2d');
  const S = cv.width, cx = S / 2, cy = S / 2;
  const rarity = it.rarity || 1;
  const cols = { 1: '#9aa2b0', 2: '#5fc06f', 3: '#5aa8e8', 4: '#c06fe0', 5: '#e8b24a' };
  const c = cols[rarity] || cols[1];
  ctx.clearRect(0, 0, S, S);
  // rarity tinted soft background
  const bg = ctx.createRadialGradient(cx, cy, 2, cx, cy, S / 2);
  bg.addColorStop(0, 'rgba(255,255,255,.85)'); bg.addColorStop(1, 'rgba(120,110,90,.18)');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S);
  if (it.icon && it.icon.nodeName === 'CANVAS') { ctx.drawImage(it.icon, 0, 0, S, S); return; }
  const shape = it.shape || KIND_SHAPE[it.kind] || 'gem';
  ctx.save();
  ctx.translate(cx, cy);
  if (shape === 'mora') {
    const g = ctx.createRadialGradient(0, -4, 1, 0, 0, S * 0.34);
    g.addColorStop(0, '#ffe9a8'); g.addColorStop(1, '#c9972f');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, S * 0.3, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = '#8a651d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, S * 0.22, 0, 6.2832); ctx.stroke();
    ctx.fillStyle = '#8a651d'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('M', 0, 1);
  } else if (shape === 'gem' || shape === 'crystal') {
    const g = ctx.createLinearGradient(0, -S * 0.34, 0, S * 0.34); g.addColorStop(0, '#fff'); g.addColorStop(1, c);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, -S * 0.34); ctx.lineTo(S * 0.24, -S * 0.06); ctx.lineTo(S * 0.18, S * 0.3); ctx.lineTo(-S * 0.18, S * 0.3); ctx.lineTo(-S * 0.24, -S * 0.06); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(40,30,10,.5)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(-S * 0.06, -S * 0.1, S * 0.05, 0, 6.2832); ctx.fill();
  } else if (shape === 'flower') {
    for (let i = 0; i < 5; i++) { ctx.rotate(6.2832 / 5); ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, -S * 0.2, S * 0.1, S * 0.2, 0, 0, 6.2832); ctx.fill(); }
    ctx.fillStyle = '#fff8d8'; ctx.beginPath(); ctx.arc(0, 0, S * 0.1, 0, 6.2832); ctx.fill();
  } else if (shape === 'feather') {
    ctx.strokeStyle = c; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-S * 0.24, S * 0.3); ctx.quadraticCurveTo(0, -S * 0.24, S * 0.28, -S * 0.3); ctx.stroke();
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-S * 0.12 + i * 7, -S * 0.05 + i * -1); ctx.lineTo(-S * 0.3 + i * 6, S * 0.05 + i * 3); ctx.stroke(); }
  } else if (shape === 'sword') {
    ctx.rotate(-0.6); ctx.fillStyle = '#dbe4f0';
    ctx.fillRect(-2.4, -S * 0.32, 4.8, S * 0.44);
    ctx.beginPath(); ctx.moveTo(-2.4, -S * 0.32); ctx.lineTo(0, -S * 0.42); ctx.lineTo(2.4, -S * 0.32); ctx.closePath(); ctx.fill();
    ctx.fillStyle = c; ctx.fillRect(-7, S * 0.12, 14, S * 0.06); ctx.fillRect(-7, S * 0.22, 14, S * 0.06);
    ctx.fillStyle = '#6a4a16'; ctx.fillRect(-2, S * 0.28, 4, S * 0.14);
  } else if (shape === 'star') {
    ctx.fillStyle = c;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) { const a = -6.2832 / 4 + i * 6.2832 / 5; const a2 = a + 6.2832 / 10; const R = S * 0.32, r = S * 0.14; const x0 = Math.cos(a) * R, y0 = Math.sin(a) * R, x1 = Math.cos(a2) * r, y1 = Math.sin(a2) * r; i === 0 ? ctx.moveTo(x0, y0) : ctx.lineTo(x0, y0); ctx.lineTo(x1, y1); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(40,30,10,.5)'; ctx.lineWidth = 1; ctx.stroke();
  } else if (shape === 'seed') {
    ctx.strokeStyle = '#e9dcc0'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(0, S * 0.3); ctx.lineTo(0, -S * 0.1); ctx.stroke();
    for (let i = 0; i < 4; i++) { const a = -6.2832 / 2 + (i - 1.5) * 0.6; ctx.beginPath(); ctx.moveTo(0, -S * 0.1); ctx.lineTo(Math.cos(a) * S * 0.2, -S * 0.1 + Math.sin(a) * S * 0.2); ctx.stroke(); }
    ctx.fillStyle = '#f6f0e2'; ctx.beginPath(); ctx.arc(0, -S * 0.1, S * 0.05, 0, 6.2832); ctx.fill();
  } else if (shape === 'shroom') {
    ctx.fillStyle = '#e9dcc0'; ctx.fillRect(-2, -S * 0.05, 4, S * 0.3);
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, -S * 0.08, S * 0.22, 6.2832 / 2, 6.2832 * 1.5); ctx.closePath(); ctx.fill();
  } else {
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, S * 0.24, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = 'rgba(40,30,10,.5)'; ctx.stroke();
  }
  ctx.restore();
}
