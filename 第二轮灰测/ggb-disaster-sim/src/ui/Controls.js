import { TIME_PRESETS } from '../config.js';

const CSS = `
.ggb-ui, .ggb-hud { font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: #dbe6ef; -webkit-user-select: none; user-select: none; }
.ggb-ui { position: fixed; top: 12px; left: 12px; width: 268px; padding: 12px 13px 14px;
  background: rgba(9, 14, 20, 0.82); backdrop-filter: blur(9px);
  border: 1px solid rgba(120, 170, 210, 0.22); border-radius: 10px; z-index: 20;
  max-height: calc(100vh - 24px); overflow-y: auto; }
.ggb-ui h1 { margin: 0 0 2px; font-size: 13px; letter-spacing: .04em; color: #ff8a5c; }
.ggb-ui .sub { margin: 0 0 10px; font-size: 10px; color: #7d8fa0; letter-spacing: .05em; }
.ggb-ui section { margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(120,170,210,.14); }
.ggb-ui section:first-of-type { border-top: 0; padding-top: 0; }
.ggb-ui .lbl { display: flex; justify-content: space-between; color: #8fa4b6;
  font-size: 10px; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 5px; }
.ggb-ui .lbl b { color: #ffb38a; font-weight: 600; }
.ggb-ui button { width: 100%; margin: 3px 0; padding: 7px 9px; text-align: left; cursor: pointer;
  background: rgba(38, 54, 70, .72); color: #dbe6ef; border: 1px solid rgba(120,170,210,.2);
  border-radius: 6px; font: inherit; transition: background .12s, border-color .12s; }
.ggb-ui button:hover { background: rgba(58, 84, 108, .9); border-color: rgba(160,210,250,.45); }
.ggb-ui button.danger { border-color: rgba(230, 110, 70, .45); color: #ffcbb4; }
.ggb-ui button.on { background: rgba(200, 84, 40, .78); border-color: #ff9160; color: #fff; }
.ggb-ui .row { display: flex; gap: 5px; }
.ggb-ui .row button { margin: 3px 0; text-align: center; }
.ggb-ui input[type=range] { width: 100%; margin: 2px 0 6px; accent-color: #ff7a3c; }
.ggb-ui .chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.ggb-ui .chips button { width: auto; flex: 1 1 auto; padding: 4px 7px; text-align: center; font-size: 10px; }
.ggb-ui .snaps { display: flex; gap: 6px; margin-top: 6px; }
.ggb-ui .snap { flex: 1; aspect-ratio: 16/9; border-radius: 5px; overflow: hidden; cursor: pointer;
  background: rgba(20,28,36,.9); border: 1px solid rgba(120,170,210,.2); position: relative; }
.ggb-ui .snap img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ggb-ui .snap span { position: absolute; left: 3px; top: 2px; font-size: 9px; color: #ffb38a;
  text-shadow: 0 1px 2px #000; }
.ggb-ui .hint { margin-top: 9px; font-size: 10px; color: #6f8496; line-height: 1.55; }
.ggb-ui kbd { background: rgba(120,170,210,.18); border-radius: 3px; padding: 0 3px; color: #cfe0ee; }
.ggb-hud { position: fixed; top: 12px; right: 12px; padding: 9px 11px; z-index: 20;
  background: rgba(9, 14, 20, 0.72); border: 1px solid rgba(120,170,210,.18);
  border-radius: 9px; text-align: right; min-width: 156px; }
.ggb-hud b { color: #9fe8b0; font-weight: 600; }
.ggb-hud .warn { color: #ffc46a; }
`;

/**
 * Controls — the whole operator interface, built in code so the project stays a
 * drop-in set of ES modules with no framework and no template files.
 *
 * Everything here is a thin view over systems that already own their state; the
 * UI never becomes a second source of truth.
 */
export class Controls {
  constructor(deps) {
    Object.assign(this, deps);

    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    this.root = document.createElement('div');
    this.root.className = 'ggb-ui';
    document.body.appendChild(this.root);

    this.hud = document.createElement('div');
    this.hud.className = 'ggb-hud';
    document.body.appendChild(this.hud);

    this._build();
    this._bindKeys();
    this._hudAcc = 0;
    this._fps = 60;
  }

  _section(title) {
    const s = document.createElement('section');
    if (title) {
      const l = document.createElement('div');
      l.className = 'lbl';
      l.innerHTML = `<span>${title}</span>`;
      s.appendChild(l);
    }
    this.root.appendChild(s);
    return s;
  }

  _button(parent, label, onClick, cls = '') {
    const b = document.createElement('button');
    b.textContent = label;
    if (cls) b.className = cls;
    b.addEventListener('click', onClick);
    parent.appendChild(b);
    return b;
  }

  _slider(parent, label, min, max, step, value, onInput, fmt = (v) => v.toFixed(2)) {
    const l = document.createElement('div');
    l.className = 'lbl';
    const val = document.createElement('b');
    val.textContent = fmt(value);
    l.innerHTML = `<span>${label}</span>`;
    l.appendChild(val);
    const i = document.createElement('input');
    i.type = 'range';
    i.min = min; i.max = max; i.step = step; i.value = value;
    i.addEventListener('input', () => {
      const v = parseFloat(i.value);
      val.textContent = fmt(v);
      onInput(v);
    });
    parent.appendChild(l);
    parent.appendChild(i);
    return { input: i, label: val };
  }

  _build() {
    const h = document.createElement('h1');
    h.textContent = 'GOLDEN GATE · DISASTER SIM';
    this.root.appendChild(h);
    const sub = document.createElement('p');
    sub.className = 'sub';
    sub.textContent = 'Three.js · Rapier3D · WebGL2 cinematic chain';
    this.root.appendChild(sub);

    // ---- disasters ----
    const dis = this._section('灾难模式 / Disaster');
    for (const { id, label } of this.director.list) {
      this._button(dis, label, () => {
        this.director.trigger(id);
        this._flash(id);
      }, 'danger');
    }
    this._button(dis, '↺ 重置桥体 / Reset', () => this.director.reset());

    // ---- time & weather ----
    const env = this._section('时间与天气 / Time & Weather');
    this.todSlider = this._slider(env, '时间轴 Time of day', 0, 0.999, 0.001,
      TIME_PRESETS.goldenHour,
      (v) => this.sky.setTimeOfDay(v),
      (v) => {
        const hh = Math.floor(((v * 24) + 6) % 24);
        const mm = Math.floor((((v * 24) + 6) % 1) * 60);
        return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      });
    const chips = document.createElement('div');
    chips.className = 'chips';
    env.appendChild(chips);
    const presets = [
      ['日出', TIME_PRESETS.dawn], ['正午', TIME_PRESETS.noon],
      ['黄金', TIME_PRESETS.goldenHour], ['黄昏', TIME_PRESETS.dusk],
      ['暴风夜', TIME_PRESETS.stormNight],
    ];
    for (const [name, t] of presets) {
      this._button(chips, name, () => {
        this.sky.setTimeOfDay(t);
        this.todSlider.input.value = t;
        this.todSlider.input.dispatchEvent(new Event('input'));
        if (name === '暴风夜') {
          this.stormSlider.input.value = 0.9;
          this.stormSlider.input.dispatchEvent(new Event('input'));
        }
      });
    }
    this.stormSlider = this._slider(env, '风暴强度 Storm', 0, 1, 0.01, 0,
      (v) => this.sky.setStorm(v));

    // ---- time control ----
    const tc = this._section('时间控制 / Time Control');
    this.scaleSlider = this._slider(tc, '时间缩放 Time scale', 0.02, 2, 0.01, 1,
      (v) => this.clock.setTimeScale(v), (v) => `${v.toFixed(2)}×`);
    const row = document.createElement('div');
    row.className = 'row';
    tc.appendChild(row);
    this.pauseBtn = this._button(row, '⏸ 暂停', () => {
      const p = this.clock.togglePause();
      this.pauseBtn.textContent = p ? '▶ 继续' : '⏸ 暂停';
      this.pauseBtn.classList.toggle('on', p);
    });
    this._button(row, '⏭ 单帧', () => this.clock.stepOnce());
    const row2 = document.createElement('div');
    row2.className = 'row';
    tc.appendChild(row2);
    this._button(row2, '0.15× 慢动作', () => {
      this.clock.setTimeScale(0.15);
      this.scaleSlider.input.value = 0.15;
      this.scaleSlider.input.dispatchEvent(new Event('input'));
    });
    this._button(row2, '1× 正常', () => {
      this.clock.setTimeScale(1);
      this.scaleSlider.input.value = 1;
      this.scaleSlider.input.dispatchEvent(new Event('input'));
    });

    // ---- camera ----
    const cams = this._section('镜头 / Camera');
    this._button(cams, '⛶ 全景取景 Frame all', () => this.cam.frameAll());
    this.dollyBtn = this._button(cams, '⟳ 自动环绕 Auto-dolly', () => {
      this.cam.autoDolly = !this.cam.autoDolly;
      this.dollyBtn.classList.toggle('on', this.cam.autoDolly);
    });

    // ---- snapshots ----
    const sn = this._section('快照对比 / Snapshot A-B');
    const srow = document.createElement('div');
    srow.className = 'row';
    sn.appendChild(srow);
    this._button(srow, '拍 A', () => this._snap('A'));
    this._button(srow, '拍 B', () => this._snap('B'));
    this.snaps = document.createElement('div');
    this.snaps.className = 'snaps';
    sn.appendChild(this.snaps);
    this.snapSlots = {};
    for (const slot of ['A', 'B']) {
      const d = document.createElement('div');
      d.className = 'snap';
      d.innerHTML = `<span>${slot}</span>`;
      d.addEventListener('click', () => {
        const s = this.clock.getSnapshot(slot);
        if (s && s.camera) this.onRestoreCamera(s.camera);
      });
      this.snaps.appendChild(d);
      this.snapSlots[slot] = d;
    }

    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.innerHTML = '<kbd>左键拖拽</kbd> 旋转 · <kbd>滚轮</kbd> 无级缩放 10–3000 m<br>'
      + '<kbd>单击</kbd> 设定聚焦中心 · <kbd>Shift+单击</kbd> 定点摧毁<br>'
      + '<kbd>1-4</kbd> 灾难 · <kbd>空格</kbd> 暂停 · <kbd>R</kbd> 重置 · <kbd>F</kbd> 全景';
    this.root.appendChild(hint);
  }

  _snap(slot) {
    const s = this.onSnapshot(slot);
    const el = this.snapSlots[slot];
    if (s && s.url) {
      el.innerHTML = `<span>${slot} · ${s.simTime.toFixed(2)}s</span><img alt="snapshot ${slot}">`;
      el.querySelector('img').src = s.url;
    }
  }

  _flash(id) {
    for (const b of this.root.querySelectorAll('button.danger')) b.classList.remove('on');
    const idx = this.director.list.findIndex((m) => m.id === id);
    const btns = this.root.querySelectorAll('button.danger');
    if (btns[idx]) btns[idx].classList.add('on');
  }

  _bindKeys() {
    window.addEventListener('keydown', (e) => {
      if (e.target && /input|textarea/i.test(e.target.tagName)) return;
      const ids = ['earthquake', 'tsunami', 'meteor', 'monster'];
      if (e.key >= '1' && e.key <= '4') {
        const id = ids[parseInt(e.key, 10) - 1];
        this.director.trigger(id);
        this._flash(id);
      } else if (e.code === 'Space') {
        e.preventDefault();
        this.pauseBtn.click();
      } else if (e.key === 'r' || e.key === 'R') {
        this.director.reset();
      } else if (e.key === 'f' || e.key === 'F') {
        this.cam.frameAll();
      } else if (e.key === '.') {
        this.clock.stepOnce();
      }
    });
  }

  update(realDt) {
    this._hudAcc += realDt;
    if (realDt > 0) this._fps += (1 / realDt - this._fps) * 0.12;
    if (this._hudAcc < 0.25) return;
    this._hudAcc = 0;

    const s = this.engine.stats;
    const p = this.physics.stats;
    const st = this.director.status;
    const scale = this.engine._renderScale ?? 1;
    const fpsCls = this._fps < 40 ? 'warn' : '';

    this.hud.innerHTML = [
      `FPS <b class="${fpsCls}">${this._fps.toFixed(0)}</b>`,
      `draw calls <b>${s.drawCalls}</b>`,
      `tris <b>${(s.triangles / 1000).toFixed(0)}k</b>`,
      `render scale <b>${(scale * 100).toFixed(0)}%</b>`,
      `bodies <b>${p.total}</b>`,
      `active <b class="${p.dynamic > 700 ? 'warn' : ''}">${p.dynamic}</b>`,
      `retired <b>${p.frozen + p.sunk}</b>`,
      st.active.length ? `event <b>${st.active.join('+')}</b> ${(st.progress * 100).toFixed(0)}%` : 'event <b>—</b>',
      `sim t <b>${this.clock.simTime.toFixed(1)}s</b>${this.clock.paused ? ' <span class="warn">PAUSED</span>' : ''}`,
    ].join('<br>');
  }
}
