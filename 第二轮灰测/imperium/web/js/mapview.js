// 地图渲染：等距圆柱投影、离屏缓存、索引栅格精确拾取、10 种地图模式。
import { timelineAt, devAt } from './engine.js';

const BASE_S = 6;          // 基础缩放：每度 6 像素 → 2160x1080 世界底图
const ID_S = 4;            // 拾取栅格：每度 4 像素 → 1440x720
const SEA = '#12233d';
const SEA_DEEP = '#0d1a2e';

export class MapView {
  constructor(canvas, world) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.world = world;
    this.mode = 'political';
    this.view = { x: 0, y: 0, zoom: 1 };
    this.selected = null;
    this.hover = null;
    this.dirty = true;
    this.showBorders = true;
    this.labels = true;
    this.paths = new Map();     // id -> Path2D (world pixel space)
    this.centroids = new Map(); // id -> [wx, wy]
    this.buildPaths();
    this.base = document.createElement('canvas');
    this.base.width = 360 * BASE_S; this.base.height = 180 * BASE_S;
    this.bctx = this.base.getContext('2d');
    this.buildIdRaster();
    this.fitWorld();
    this.bindEvents();
  }

  /* ---- 几何 ---- */
  buildPaths() {
    const P = this.world.map.provinces;
    for (const id of Object.keys(P)) {
      const p = new Path2D();
      let cx = 0, cy = 0, n = 0;
      for (const ring of P[id].poly) {
        for (let i = 0; i < ring.length; i++) {
          const wx = (ring[i][0] + 180) * BASE_S, wy = (90 - ring[i][1]) * BASE_S;
          if (i === 0) p.moveTo(wx, wy); else p.lineTo(wx, wy);
          cx += wx; cy += wy; n++;
        }
        p.closePath();
      }
      this.paths.set(id, p);
      const d = P[id];
      this.centroids.set(id, [(d.lon + 180) * BASE_S, (90 - d.lat) * BASE_S]);
    }
    this.seaPaths = new Map();
    for (const id of Object.keys(this.world.map.seas || {})) {
      const p = new Path2D();
      for (const ring of this.world.map.seas[id].poly) {
        for (let i = 0; i < ring.length; i++) {
          const wx = (ring[i][0] + 180) * BASE_S, wy = (90 - ring[i][1]) * BASE_S;
          if (i === 0) p.moveTo(wx, wy); else p.lineTo(wx, wy);
        }
        p.closePath();
      }
      this.seaPaths.set(id, p);
    }
  }

  buildIdRaster() {
    const W = 360 * ID_S, H = 180 * ID_S;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#000000'; g.fillRect(0, 0, W, H);
    this.idList = Object.keys(this.world.map.provinces);
    const k = ID_S / BASE_S;
    g.save(); g.scale(k, k);
    for (let i = 0; i < this.idList.length; i++) {
      const v = i + 1;
      g.fillStyle = `rgb(${v & 255},${(v >> 8) & 255},${(v >> 16) & 255})`;
      g.fill(this.paths.get(this.idList[i]));
    }
    g.restore();
    const img = g.getImageData(0, 0, W, H).data;
    this.idRaster = new Int32Array(W * H);
    const n = this.idList.length;
    for (let i = 0, j = 0; i < W * H; i++, j += 4) {
      const v = (img[j] | (img[j + 1] << 8) | (img[j + 2] << 16)) - 1;
      // 边界抗锯齿会混出无效编号，越界一律视为海面
      this.idRaster[i] = v >= 0 && v < n ? v : -1;
    }
    this.idW = W; this.idH = H;
  }

  provAt(lon, lat) {
    const x = Math.floor((lon + 180) * ID_S), y = Math.floor((90 - lat) * ID_S);
    if (x < 0 || y < 0 || x >= this.idW || y >= this.idH) return null;
    const v = this.idRaster[y * this.idW + x];
    if (v >= 0) return this.idList[v];
    // 落在边界抗锯齿像素上时，就近搜索 2 格
    for (let r = 1; r <= 2; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= this.idW || ny >= this.idH) continue;
        const w = this.idRaster[ny * this.idW + nx];
        if (w >= 0) return this.idList[w];
      }
    }
    return null;
  }

  /* ---- 视图变换 ---- */
  rect() {
    const r = this.cv.getBoundingClientRect();
    // 防御：若此刻还没有布局（宽高为 0），退回窗口尺寸，避免地图一片空白
    const w = r.width || window.innerWidth || 1280;
    const h = r.height || Math.max(320, (window.innerHeight || 800) - 120);
    return { left: r.left || 0, top: r.top || 0, width: w, height: h };
  }
  fitWorld() {
    const r = this.rect();
    this.view.zoom = Math.max(r.width / this.base.width, 0.25);
    this.view.x = 0; this.view.y = Math.max(0, (this.base.height - r.height / this.view.zoom) / 2);
    this.clampView();
  }
  screenToWorld(sx, sy) { return [this.view.x + sx / this.view.zoom, this.view.y + sy / this.view.zoom]; }
  worldToLonLat(wx, wy) { return [wx / BASE_S - 180, 90 - wy / BASE_S]; }
  screenToLonLat(sx, sy) { const [wx, wy] = this.screenToWorld(sx, sy); return this.worldToLonLat(wx, wy); }
  clampView() {
    const r = this.rect();
    const vw = r.width / this.view.zoom, vh = r.height / this.view.zoom;
    this.view.zoom = Math.min(Math.max(this.view.zoom, r.width / this.base.width * 0.9), 14);
    if (vh >= this.base.height) this.view.y = (this.base.height - vh) / 2;
    else this.view.y = Math.min(Math.max(this.view.y, 0), this.base.height - vh);
    // 经度环绕
    if (this.view.x < -this.base.width) this.view.x += this.base.width;
    if (this.view.x > this.base.width) this.view.x -= this.base.width;
  }

  bindEvents() {
    const cv = this.cv;
    let drag = null;
    cv.addEventListener('mousedown', e => {
      drag = { sx: e.clientX, sy: e.clientY, vx: this.view.x, vy: this.view.y, moved: false };
    });
    window.addEventListener('mousemove', e => {
      const r = cv.getBoundingClientRect();
      if (drag) {
        const dx = (e.clientX - drag.sx) / this.view.zoom, dy = (e.clientY - drag.sy) / this.view.zoom;
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
        this.view.x = drag.vx - dx; this.view.y = drag.vy - dy;
        this.clampView();
      } else if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        const [lon, lat] = this.screenToLonLat(e.clientX - r.left, e.clientY - r.top);
        const id = this.provAt(lon, lat);
        if (id !== this.hover) { this.hover = id; this.onHover?.(id, e.clientX, e.clientY); }
      }
    });
    window.addEventListener('mouseup', e => {
      if (drag && !drag.moved) {
        const r = cv.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
          const [lon, lat] = this.screenToLonLat(e.clientX - r.left, e.clientY - r.top);
          const id = this.provAt(lon, lat);
          this.selected = id;
          this.onSelect?.(id);
        }
      }
      drag = null;
    });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      const [wx, wy] = this.screenToWorld(e.clientX - r.left, e.clientY - r.top);
      const f = e.deltaY < 0 ? 1.2 : 1 / 1.2;
      this.view.zoom *= f;
      this.clampView();
      const [nwx, nwy] = this.screenToWorld(e.clientX - r.left, e.clientY - r.top);
      this.view.x += wx - nwx; this.view.y += wy - nwy;
      this.clampView();
    }, { passive: false });
  }

  centerOn(id) {
    const c = this.centroids.get(id); if (!c) return;
    const r = this.rect();
    this.view.zoom = Math.max(this.view.zoom, 2.2);
    this.view.x = c[0] - r.width / this.view.zoom / 2;
    this.view.y = c[1] - r.height / this.view.zoom / 2;
    this.clampView();
  }

  /* ---- 配色 ---- */
  provColor(id) {
    const w = this.world, st = w.prov.get(id), d = w.map.provinces[id];
    if (!st) return '#444';
    switch (this.mode) {
      case 'political': {
        if (!st.owner) return '#3a3f45';
        const pol = w.pol.get(st.owner);
        return pol ? pol.color : '#3a3f45';
      }
      case 'controller': {
        if (!st.controller) return '#3a3f45';
        const pol = w.pol.get(st.controller);
        return pol ? pol.color : '#3a3f45';
      }
      case 'religion': return RELIGION_COLORS[st.religion] || GROUP_COLORS[w.religionGroup(st.religion)] || '#555';
      case 'culture': return groupColor(w.cultureGroup(st.culture));
      case 'terrain': return TERRAIN_COLORS[d.terrain] || '#666';
      case 'dev': return ramp(st.dev / 30, '#26324a', '#f2d27a');
      case 'unrest': return ramp(st.unrest / 14, '#26403a', '#d2452f');
      case 'tech': {
        const pol = st.owner ? w.pol.get(st.owner) : null;
        return pol ? ramp((pol.adm + pol.dip + pol.mil) / 66, '#2a2540', '#7ee0ff') : '#333';
      }
      case 'gov': {
        const pol = st.owner ? w.pol.get(st.owner) : null;
        return pol ? (GOV_COLORS[pol.gov] || '#666') : '#333';
      }
      case 'dynasty': {
        const pol = st.owner ? w.pol.get(st.owner) : null;
        if (!pol) return '#333';
        return hashColor(pol.dynasty || pol.tag);
      }
      case 'region': return hashColor(w.regionOf(id) || 'x');
      case 'area': return hashColor(d.area || 'x');
      default: return '#555';
    }
  }

  /* ---- 底图重绘 ---- */
  redrawBase() {
    const g = this.bctx, w = this.world;
    g.save();
    g.fillStyle = SEA_DEEP;
    g.fillRect(0, 0, this.base.width, this.base.height);
    // 海域轻纹理
    g.fillStyle = SEA;
    for (const [, p] of this.seaPaths) g.fill(p);
    // 省份
    for (const id of this.idList) {
      const path = this.paths.get(id);
      g.fillStyle = this.provColor(id);
      g.fill(path);
    }
    // 省界
    if (this.showBorders) {
      g.lineWidth = 0.6; g.strokeStyle = 'rgba(0,0,0,0.30)';
      for (const id of this.idList) g.stroke(this.paths.get(id));
      // 国界：对与「不同归属」邻省接壤的省份，在其内侧描粗线（裁剪保证不越界），
      // 视觉上形成清晰的国境线，且不会把每个省都描成粗边。
      if (this.mode === 'political' || this.mode === 'controller' || this.mode === 'dynasty') {
        const ownerOf = id => {
          const st = w.prov.get(id);
          if (!st) return null;
          if (this.mode === 'controller') return st.controller;
          if (this.mode === 'dynasty') { const p = st.owner ? w.pol.get(st.owner) : null; return p ? (p.dynasty || p.tag) : null; }
          return st.owner;
        };
        g.lineWidth = 3.2; g.strokeStyle = 'rgba(10,12,18,0.85)';
        for (const id of this.idList) {
          const mine = ownerOf(id);
          const d = w.map.provinces[id];
          let border = false;
          for (const nb of d.neigh || []) { if (ownerOf(nb) !== mine) { border = true; break; } }
          if (!border) continue;
          const path = this.paths.get(id);
          g.save(); g.clip(path); g.stroke(path); g.restore();
        }
      }
    }
    g.restore();
    this.dirty = false;
    this.builtVersion = w.mapVersion;
  }

  markDirty() { this.dirty = true; }
  /** 归属变化时才需要重绘底图（大幅降低快进时的开销） */
  syncOwnership() {
    if (this.world.mapVersion !== this.builtVersion) this.dirty = true;
  }

  /* ---- 每帧绘制 ---- */
  draw() {
    const cv = this.cv, ctx = this.ctx;
    const r = this.rect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) {
      cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
      this.clampView();
    }
    if (this.dirty) this.redrawBase();
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = SEA_DEEP;
    ctx.fillRect(0, 0, r.width, r.height);
    ctx.imageSmoothingEnabled = this.view.zoom < 3;
    const z = this.view.zoom;
    const sw = r.width / z, sh = r.height / z;
    // 环绕绘制 3 次以支持跨反经线平移
    for (let k = -1; k <= 1; k++) {
      const sx = this.view.x + k * this.base.width;
      if (sx + sw < 0 || sx > this.base.width) continue;
      ctx.drawImage(this.base, sx, this.view.y, sw, sh, 0, 0, r.width, r.height);
    }
    // 选中/悬停描边
    ctx.save();
    ctx.scale(z, z);
    ctx.translate(-this.view.x, -this.view.y);
    if (this.hover && this.hover !== this.selected) {
      ctx.lineWidth = 1.6 / z; ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.stroke(this.paths.get(this.hover));
    }
    if (this.selected) {
      ctx.lineWidth = 2.6 / z; ctx.strokeStyle = '#ffe9a8';
      ctx.stroke(this.paths.get(this.selected));
    }
    // 玩家国界高亮
    const w = this.world;
    if (w.player) {
      const pol = w.pol.get(w.player);
      if (pol) {
        ctx.lineWidth = 2.2 / z; ctx.strokeStyle = 'rgba(255,235,160,0.85)';
        ctx.beginPath();
        for (const pid of pol.provs) { const p = this.paths.get(pid); if (p) ctx.stroke(p); }
      }
    }
    ctx.restore();
    // 标签
    if (this.labels) this.drawLabels(ctx, r);
    ctx.restore();
  }

  drawLabels(ctx, r) {
    const w = this.world, z = this.view.zoom;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const showProv = z > 3.2;
    const drawn = [];
    const fits = (x, y, pad) => {
      for (const d of drawn) if (Math.abs(d[0] - x) < pad * 2.2 && Math.abs(d[1] - y) < pad) return false;
      return true;
    };
    if (showProv) {
      ctx.font = `${Math.min(15, 8 + z * 0.5)}px "Noto Serif SC", serif`;
      for (const id of this.idList) {
        const c = this.centroids.get(id);
        const sx = (c[0] - this.view.x) * z, sy = (c[1] - this.view.y) * z;
        if (sx < -40 || sy < -20 || sx > r.width + 40 || sy > r.height + 20) continue;
        if (!fits(sx, sy, 14)) continue;
        drawn.push([sx, sy]);
        const st = w.prov.get(id);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillText(w.map.provinces[id].zh, sx + 1, sy + 1);
        ctx.fillStyle = st?.owner === w.player ? '#fff6d5' : 'rgba(255,255,255,0.88)';
        ctx.fillText(w.map.provinces[id].zh, sx, sy);
      }
    } else {
      // 国名（按发展度排序，取前 N）
      const list = [...w.pol.values()].filter(p => p.alive && p.provs.size)
        .sort((a, b) => b.devSum - a.devSum).slice(0, 150);
      for (const pol of list) {
        const c = this.centroids.get(pol.cap) || this.centroids.get([...pol.provs][0]);
        if (!c) continue;
        const sx = (c[0] - this.view.x) * z, sy = (c[1] - this.view.y) * z;
        if (sx < 0 || sy < 0 || sx > r.width || sy > r.height) continue;
        const size = Math.min(20, Math.max(9, Math.sqrt(pol.devSum) * 0.9 + z));
        if (!fits(sx, sy, size)) continue;
        drawn.push([sx, sy]);
        ctx.font = `${size}px "Noto Serif SC", serif`;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillText(pol.zh, sx + 1, sy + 1);
        ctx.fillStyle = pol.tag === w.player ? '#ffe9a8' : 'rgba(255,255,255,0.9)';
        ctx.fillText(pol.zh, sx, sy);
      }
    }
    ctx.restore();
  }
}

/* ---- 调色 ---- */
const RELIGION_COLORS = {
  catholic: '#e8d9a0', orthodox: '#c8a2c8', chalcedonian: '#d9c27a', miaphysite: '#b58a5a',
  nestorian: '#9fb6c9', arian: '#8fa87c', protestant: '#7fb0e0',
  sunni: '#3f8f5a', shia: '#2f6f8f', ismaili: '#4faf9f', ibadi: '#6f9f4f',
  jewish: '#8f8fd0', zoroastrian: '#d07f3f', manichean: '#c06fa0',
  hindu: '#e08f3f', buddhist: '#e0b040', theravada: '#e8c060', vajrayana: '#c08030', jain: '#b0d060', sikh: '#d0a020',
  confucian: '#c0504d', taoist: '#8f6f9f', shinto: '#d06f6f', bon: '#8f5f3f',
  hellenic: '#9f7fbf', kemetic: '#bfa030', punic: '#7f6f5f',
  celtic: '#5f8f5f', germanic: '#6f7f9f', norse: '#5f7fa0', slavic: '#7f6f5f', baltic: '#6f8f7f', finnic: '#5f9f8f',
  berber_pagan: '#a08f5f', tengri: '#9f8f4f', shamanist: '#7f9f9f',
  west_african: '#8f7f3f', east_african: '#7f8f4f', bantu_pagan: '#6f8f3f',
  mesoamerican: '#bf5f3f', andean: '#9f5f7f', north_american: '#7f6f4f', amazonian: '#5f7f4f',
  polynesian: '#4f8f9f', aboriginal: '#8f6f4f', animist: '#6f7f6f',
};
const GROUP_COLORS = { christian: '#d9c27a', islamic: '#3f8f5a', jewish: '#8f8fd0', iranian: '#d07f3f', dharmic: '#e0a040', eastern: '#c0504d', pagan: '#6f7f6f', shamanic: '#8f9f8f', classical: '#9f7fbf' };
const TERRAIN_COLORS = {
  farmland: '#8fa85f', grassland: '#a8bf6f', hills: '#9f8f5f', mountains: '#8f8f8f', plateau: '#af9f6f',
  forest: '#4f7f4f', taiga: '#3f6f5f', marsh: '#5f7f6f', jungle: '#2f6f3f', drylands: '#bfa060',
  desert: '#e0cf90', oasis: '#7fbf7f', steppe: '#cfc07f', savanna: '#c0af5f', tundra: '#9fb0b0', arctic: '#e8f0f5',
};
const GOV_COLORS = {
  tribal: '#8a7b5a', clan: '#7a8b5a', nomadic: '#b09040', feudal: '#5a6f9a', administrative: '#9a5a5a',
  imperial: '#b04040', republic: '#4a9a8a', merchant_republic: '#40a0b0', theocracy: '#a0a040',
  monastic: '#8f7fa0', city_state: '#50b090', caliphate: '#3f8f5a', sultanate: '#5f9f4f',
  khanate: '#a08030', shogunate: '#9f5040', satrapy: '#7f5f9f', confederation: '#6f9f7f', elective: '#6f7fbf',
};
function ramp(t, c0, c1) {
  t = Math.max(0, Math.min(1, t));
  const a = parseInt(c0.slice(1), 16), b = parseInt(c1.slice(1), 16);
  const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
  const g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
  const bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
  return `rgb(${r},${g},${bl})`;
}
function hashColor(s) {
  let h = 0; for (let i = 0; i < (s || '').length; i++) h = (h * 33 + s.charCodeAt(i)) | 0;
  h = Math.abs(h);
  return `hsl(${h % 360} ${40 + (h >> 7) % 30}% ${35 + (h >> 13) % 25}%)`;
}
function groupColor(g) { return hashColor('cg_' + g); }
export const MAP_MODES = [
  { id: 'political', zh: '政治' }, { id: 'controller', zh: '占领' }, { id: 'religion', zh: '宗教' },
  { id: 'culture', zh: '文化' }, { id: 'terrain', zh: '地形' }, { id: 'dev', zh: '发展度' },
  { id: 'tech', zh: '科技' }, { id: 'gov', zh: '政体' }, { id: 'dynasty', zh: '王朝' },
  { id: 'unrest', zh: '动乱' }, { id: 'region', zh: '大区' }, { id: 'area', zh: '地区' },
];
