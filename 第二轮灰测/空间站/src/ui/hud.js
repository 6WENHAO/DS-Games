/**
 * ui/hud.js —— 任务控制台式界面层
 *
 * 纯 DOM/CSS 实现，与 WebGL 画面解耦：
 *  · 启动装配进度层（含逐舱段日志）
 *  · 舱段清单（点击聚焦、悬停与三维视图双向联动）
 *  · 舱段档案面板（规格表由蓝图元数据驱动）
 *  · 底部工具条（开关 + 滑块）与实时统计
 *  · 键盘快捷键与帮助层
 */

import { MODULES, STATION_INFO } from '../voxel/blueprint.js';
import { PerfGraph } from './perf.js';

const $ = (id) => /** @type {HTMLElement} */(document.getElementById(id));

/** 底部开关定义 */
const TOGGLES = [
  { key: 'animate', label: '运动学', hint: '居住环自转 / 太阳翼跟踪 / 机械臂' },
  { key: 'shadows', label: '阴影', hint: '方向光阴影贴图' },
  { key: 'ssaoOn', label: '遮蔽', hint: '屏幕空间环境光遮蔽' },
  { key: 'bloomOn', label: '辉光', hint: 'HDR 泛光' },
  { key: 'godraysOn', label: '体积光', hint: '太阳光束' },
  { key: 'flareOn', label: '光斑', hint: '镜头光斑与耀斑' },
  { key: 'earth', label: '地球', hint: '程序化地球与大气' },
  { key: 'fxaa', label: '抗锯齿', hint: 'FXAA' },
  { key: 'solo', label: '单独显示', hint: '只显示当前选中舱段' },
];

const MODES = [
  { value: 0, label: '实体', hint: 'PBR 着色' },
  { value: 1, label: '蓝图', hint: '结构线框式蓝图' },
  { value: 2, label: '透视', hint: '半透明结构透视' },
];

/** 滑块定义：[key, 标签, min, max, step, 显示格式] */
const SLIDERS = [
  { key: 'assembly', label: '装配进度', min: 0, max: 100, step: 1, fmt: (v) => `${v}%` },
  { key: 'explode', label: '爆炸视图', min: 0, max: 100, step: 1, fmt: (v) => `${v}%` },
  { key: 'exposure', label: '曝光', min: 30, max: 260, step: 1, fmt: (v) => (v / 100).toFixed(2) },
  { key: 'bloom', label: '辉光强度', min: 0, max: 200, step: 1, fmt: (v) => (v / 100).toFixed(2) },
  { key: 'detail', label: '表面细节', min: 0, max: 160, step: 1, fmt: (v) => (v / 100).toFixed(2) },
];

const HELP_ROWS = [
  ['拖拽', '旋转视角'], ['滚轮 / 捏合', '缩放'], ['右键拖拽 / Shift+拖拽', '平移'],
  ['单击舱段', '查看档案'], ['H', '显示 / 隐藏界面'], ['C', '影院巡游'],
  ['X', '爆炸视图'], ['B', '蓝图模式'], ['V', '结构透视'], ['O', '实体模式'],
  ['R', '重置视角 / 总览'], ['空格', '暂停 / 恢复运动学'], ['S', '单独显示选中舱段'],
  ['M', '环境音开关'], ['F', '全屏'], ['1 – 9', '快速聚焦舱段'], ['? 或 /', '本帮助'],
];

export class HUD {
  /**
   * @param {object} o
   * @param {object} o.state    渲染/交互状态对象（HUD 直接读写）
   * @param {object} o.actions  回调集合
   */
  constructor({ state, actions }) {
    this.state = state;
    this.actions = actions;
    this.visible = true;
    this.selected = null;
    this.hovered = null;
    this.hiddenIds = state.hiddenIds;

    this.el = {
      boot: $('boot'), bootBar: $('boot-bar'), bootPct: $('boot-pct'),
      bootStage: $('boot-stage'), bootLog: $('boot-log'),
      hud: $('hud'), telemetry: $('telemetry'), modlist: $('modlist'), modCount: $('module-count'),
      inspector: $('inspector'), insHint: $('ins-hint'), insBody: $('ins-body'),
      insName: $('ins-name'), insEn: $('ins-en'), insCat: $('ins-cat'), insCode: $('ins-code'),
      insDesc: $('ins-desc'), insSpecs: $('ins-specs'),
      dockToggles: $('dock-toggles'), dockSliders: $('dock-sliders'),
      statsGrid: $('stats-grid'), perf: $('perf'), hint: $('hint'),
      hoverLabel: $('hoverlabel'), help: $('help'), helpTable: $('help-table'),
      unsupported: $('unsupported'), unsupportedMsg: $('unsupported-msg'),
    };

    this.perf = new PerfGraph(/** @type {HTMLCanvasElement} */(this.el.perf));
    this._buildTelemetry();
    this._buildModuleList();
    this._buildToggles();
    this._buildSliders();
    this._buildHelp();
    this._buildStats();
    this._wire();
  }

  /* ════════════════ 启动层 ════════════════ */

  setProgress(done, total, stage) {
    const pct = total ? Math.round((done / total) * 100) : 0;
    this.el.bootBar.style.width = `${pct}%`;
    this.el.bootPct.textContent = `${pct}%`;
    if (stage) this.el.bootStage.textContent = stage;
  }

  log(msg, level = '') {
    const li = document.createElement('li');
    li.textContent = msg;
    if (level) li.className = level;
    this.el.bootLog.appendChild(li);
    while (this.el.bootLog.childElementCount > 9) this.el.bootLog.removeChild(this.el.bootLog.firstChild);
    this.el.bootLog.scrollTop = this.el.bootLog.scrollHeight;
  }

  bootDone() {
    this.el.boot.classList.add('boot--done');
    this.el.hud.hidden = false;
    setTimeout(() => { this.el.boot.style.display = 'none'; }, 900);
  }

  fatal(msg) {
    this.el.boot.style.display = 'none';
    this.el.unsupportedMsg.textContent = msg;
    this.el.unsupported.hidden = false;
  }

  /* ════════════════ 构建 ════════════════ */

  _buildTelemetry() {
    this.el.telemetry.innerHTML = '';
    this._telemetryVals = new Map();
    for (const [k, v] of STATION_INFO.telemetry) {
      const d = document.createElement('div');
      d.className = 'telemetry__item';
      const ks = document.createElement('span'); ks.className = 'k'; ks.textContent = k;
      const vs = document.createElement('span'); vs.className = 'v'; vs.textContent = v;
      d.append(ks, vs);
      this.el.telemetry.appendChild(d);
      this._telemetryVals.set(k, vs);
    }
  }

  _buildModuleList() {
    const list = this.el.modlist;
    list.innerHTML = '';
    this._items = new Map();
    const listed = MODULES.filter((m) => m.listed !== false);
    for (const def of listed) {
      const li = document.createElement('li');
      li.className = 'modlist__item';
      li.dataset.id = def.id;
      li.title = `${def.en}\n${def.category}`;
      const dot = document.createElement('span'); dot.className = 'modlist__dot';
      const name = document.createElement('span'); name.className = 'modlist__name'; name.textContent = def.name;
      const code = document.createElement('span'); code.className = 'modlist__code';
      code.textContent = def.code.replace(/^CS-/, '');
      li.append(dot, name, code);
      li.addEventListener('click', (e) => {
        if (e.altKey) { this.actions.toggleHidden(def.id); return; }
        this.actions.select(def.id, true);
      });
      li.addEventListener('pointerenter', () => this.actions.hover(def.id));
      li.addEventListener('pointerleave', () => this.actions.hover(null));
      list.appendChild(li);
      this._items.set(def.id, li);
    }
    this.el.modCount.textContent = `${listed.length} 项`;
  }

  _buildToggles() {
    const wrap = this.el.dockToggles;
    wrap.innerHTML = '';
    this._toggleEls = new Map();
    // 显示模式（互斥）
    for (const m of MODES) {
      const b = document.createElement('button');
      b.className = 'toggle';
      b.dataset.key = `mode${m.value}`;
      b.title = m.hint;
      const led = document.createElement('span'); led.className = 'toggle__led';
      b.append(led, document.createTextNode(m.label));
      b.addEventListener('click', () => this.actions.setMode(m.value));
      wrap.appendChild(b);
      this._toggleEls.set(`mode${m.value}`, b);
    }
    const sep = document.createElement('span');
    sep.className = 'dock__sep';
    wrap.appendChild(sep);

    for (const t of TOGGLES) {
      const b = document.createElement('button');
      b.className = 'toggle';
      b.dataset.key = t.key;
      b.title = t.hint;
      const led = document.createElement('span'); led.className = 'toggle__led';
      b.append(led, document.createTextNode(t.label));
      b.addEventListener('click', () => this.actions.toggle(t.key));
      wrap.appendChild(b);
      this._toggleEls.set(t.key, b);
    }
    // 影院模式与音频单独一组
    for (const [key, label, hint] of [['cinema', '影院巡游', '沿预设航点自动巡游'], ['audio', '环境音', '程序化合成的站内环境音']]) {
      const b = document.createElement('button');
      b.className = 'toggle';
      b.dataset.key = key;
      b.title = hint;
      const led = document.createElement('span'); led.className = 'toggle__led';
      b.append(led, document.createTextNode(label));
      b.addEventListener('click', () => this.actions.toggle(key));
      wrap.appendChild(b);
      this._toggleEls.set(key, b);
    }
    this.refreshToggles();
  }

  _buildSliders() {
    const wrap = this.el.dockSliders;
    wrap.innerHTML = '';
    this._sliderEls = new Map();
    for (const s of SLIDERS) {
      const label = document.createElement('label');
      label.className = 'slider';
      const k = document.createElement('span'); k.className = 'slider__k'; k.textContent = s.label;
      const input = document.createElement('input');
      input.type = 'range'; input.min = String(s.min); input.max = String(s.max); input.step = String(s.step);
      input.value = String(this.actions.getSlider(s.key));
      const v = document.createElement('span'); v.className = 'slider__v'; v.textContent = s.fmt(+input.value);
      input.addEventListener('input', () => {
        v.textContent = s.fmt(+input.value);
        this.actions.setSlider(s.key, +input.value);
      });
      label.append(k, input, v);
      wrap.appendChild(label);
      this._sliderEls.set(s.key, { input, v, fmt: s.fmt });
    }
  }

  _buildHelp() {
    this.el.helpTable.innerHTML = '';
    for (const [key, desc] of HELP_ROWS) {
      const tr = document.createElement('tr');
      const th = document.createElement('th'); th.textContent = key;
      const td = document.createElement('td'); td.textContent = desc;
      tr.append(th, td);
      this.el.helpTable.appendChild(tr);
    }
  }

  _buildStats() {
    this._statKeys = ['体素', '三角面', '绘制批次', '视锥剔除', 'CPU 帧耗时', '显存', '内部分辨率'];
    this.el.statsGrid.innerHTML = '';
    this._statEls = new Map();
    for (const k of this._statKeys) {
      const ks = document.createElement('span'); ks.className = 'k'; ks.textContent = k;
      const vs = document.createElement('span'); vs.className = 'v'; vs.textContent = '—';
      this.el.statsGrid.append(ks, vs);
      this._statEls.set(k, vs);
    }
  }

  _wire() {
    $('inspector-close').addEventListener('click', () => this.actions.select(null));
    $('btn-focus-all').addEventListener('click', () => this.actions.focusAll());
    $('btn-tour').addEventListener('click', () => this.actions.toggle('cinema'));
    $('btn-ins-focus').addEventListener('click', () => this.selected && this.actions.focus(this.selected));
    $('btn-ins-solo').addEventListener('click', () => this.actions.toggle('solo'));
    $('help-close').addEventListener('click', () => { this.el.help.hidden = true; });
    this.el.help.addEventListener('click', (e) => { if (e.target === this.el.help) this.el.help.hidden = true; });
    window.addEventListener('resize', () => this.perf._resize());
  }

  /* ════════════════ 状态同步 ════════════════ */

  refreshToggles() {
    const S = this.state;
    const on = {
      animate: S.animate, shadows: S.shadows, ssaoOn: S.ssaoOn, bloomOn: S.bloomOn,
      godraysOn: S.godraysOn, flareOn: S.flareOn, earth: S.earth, fxaa: S.fxaa,
      solo: S.solo, cinema: S.cinema, audio: S.audio,
    };
    for (const [k, el] of this._toggleEls) {
      if (k.startsWith('mode')) el.classList.toggle('is-on', S.mode === +k.slice(4));
      else el.classList.toggle('is-on', !!on[k]);
    }
  }

  refreshSlider(key, value) {
    const s = this._sliderEls.get(key);
    if (!s) return;
    s.input.value = String(value);
    s.v.textContent = s.fmt(value);
  }

  setSelected(id) {
    this.selected = id;
    for (const [mid, li] of this._items) li.classList.toggle('is-active', mid === id);
    const def = MODULES.find((m) => m.id === id);
    if (!def) {
      this.el.inspector.dataset.state = 'empty';
      this.el.insHint.hidden = false;
      this.el.insBody.hidden = true;
      return;
    }
    this.el.inspector.dataset.state = 'filled';
    this.el.insHint.hidden = true;
    this.el.insBody.hidden = false;
    this.el.insName.textContent = def.name;
    this.el.insEn.textContent = def.en;
    this.el.insCat.textContent = def.category;
    this.el.insCode.textContent = def.code;
    this.el.insDesc.textContent = def.desc;
    this._renderSpecs(def, this.actions.getRuntime(id));
  }

  _renderSpecs(def, rt) {
    const dl = this.el.insSpecs;
    dl.innerHTML = '';
    const rows = [...def.specs];
    if (rt) {
      rows.push(['体素数量', rt.voxelCount.toLocaleString('zh-CN')]);
      rows.push(['三角面数', rt.triangleCount.toLocaleString('zh-CN')]);
      rows.push(['包围盒', rt.bounds.size.map((v) => `${(v * 0.6).toFixed(1)}`).join(' × ') + ' m']);
      if (def.motion) {
        const kind = { spin: '连续自转', sweep: '往复摆动', bob: '悬停漂移' }[def.motion.type] || '静止';
        rows.push(['运动形式', kind]);
      }
    }
    for (const [k, v] of rows) {
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = v;
      dl.append(dt, dd);
    }
  }

  setHovered(id, x = 0, y = 0) {
    if (this.hovered !== id) {
      this.hovered = id;
      for (const [mid, li] of this._items) li.classList.toggle('is-hover', mid === id);
    }
    const def = MODULES.find((m) => m.id === id);
    const lbl = this.el.hoverLabel;
    if (!def) { lbl.hidden = true; return; }
    lbl.hidden = false;
    lbl.textContent = `${def.name} · ${def.code}`;
    lbl.style.left = `${x}px`;
    lbl.style.top = `${y}px`;
  }

  markHidden(ids) {
    for (const [mid, li] of this._items) li.classList.toggle('is-off', ids.has(mid));
  }

  toggleVisibility() {
    this.visible = !this.visible;
    this.el.hud.classList.toggle('hud--hidden', !this.visible);
  }

  toggleHelp() { this.el.help.hidden = !this.el.help.hidden; }

  /** 每帧统计更新（内部做节流） */
  updateStats(frameMs, cpuMs, stats, station, res) {
    this.perf.push(frameMs, cpuMs);
    this.perf.draw();
    this._statAcc = (this._statAcc || 0) + 1;
    if (this._statAcc % 12 !== 0) return;
    const set = (k, v) => { const e = this._statEls.get(k); if (e) e.textContent = v; };
    set('体素', station.totalVoxels.toLocaleString('zh-CN'));
    set('三角面', stats.triangles.toLocaleString('zh-CN'));
    set('绘制批次', String(stats.drawCalls));
    set('视锥剔除', String(stats.culled));
    set('CPU 帧耗时', `${cpuMs.toFixed(2)} ms`);
    set('显存', `${(station.totalBytes / 1048576).toFixed(1)} MB`);
    set('内部分辨率', `${res[0]} × ${res[1]}`);
  }

  /** 遥测数值随时间轻微变化，制造"在轨"的实时感 */
  updateTelemetry(time, station) {
    if ((this._telAcc = (this._telAcc || 0) + 1) % 20 !== 0) return;
    const set = (k, v) => { const e = this._telemetryVals.get(k); if (e) e.textContent = v; };
    const alt = 412.6 + Math.sin(time * 0.05) * 1.4;
    set('轨道高度', `${alt.toFixed(1)} km`);
    const vel = 7.664 + Math.sin(time * 0.05 + 1.2) * 0.004;
    set('轨道速度', `${vel.toFixed(3)} km/s`);
    const sunUp = station.sun.dir[1];
    const lit = sunUp > -0.1;
    const pw = lit ? 226 + Math.sin(time * 0.4) * 14 : 74 + Math.sin(time * 0.6) * 6;
    set('母线功率', `${pw.toFixed(0)} kW${lit ? '' : '（阴影期）'}`);
  }
}
