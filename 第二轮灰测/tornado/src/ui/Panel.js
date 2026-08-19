/**
 * Panel.js — 由 Params SCHEMA 自动生成的参数面板 + HUD（场景切换 / 统计 / 提示条）。
 * 零依赖，直接操作 DOM。
 */
import { P, SCHEMA, PRESETS, FLAGS } from '../core/Params.js';

export class Panel {
  constructor(app) {
    this.app = app;
    this.el = document.getElementById('panel');
    this.statsEl = document.getElementById('stats');
    this.rows = new Map();
    this._build();
    this._buildTop();
    this._toast = document.createElement('div');
    this._toast.id = 'toast';
    document.body.appendChild(this._toast);
    this._statAcc = 0;
    if (FLAGS.noui) {
      this.el.classList.add('hide');
      document.getElementById('topbar').style.display = 'none';
      document.getElementById('hint').style.display = 'none';
      this.statsEl.style.display = 'none';
      this._toast.style.display = 'none';
    }
  }

  _build() {
    const frag = document.createDocumentFragment();
    SCHEMA.forEach((g, gi) => {
      const d = document.createElement('details');
      d.className = 'pg';
      if (gi < 2) d.open = true;
      const s = document.createElement('summary');
      s.textContent = g.group;
      d.appendChild(s);
      const body = document.createElement('div');
      body.className = 'pg-body';
      for (const it of g.items) body.appendChild(this._row(it));
      d.appendChild(body);
      frag.appendChild(d);
    });
    this.el.appendChild(frag);
  }

  _row(it) {
    const row = document.createElement('div');
    row.className = 'row';
    const lab = document.createElement('label');
    lab.textContent = it.label;
    row.appendChild(lab);
    const kind = it.kind || 'range';

    if (kind === 'bool') {
      const sw = document.createElement('div');
      sw.className = 'sw' + (P.get(it.key) ? ' on' : '');
      sw.onclick = () => {
        const v = !P.get(it.key);
        P.set(it.key, v);
        sw.classList.toggle('on', v);
      };
      row.appendChild(sw);
      this.rows.set(it.key, { sync: () => sw.classList.toggle('on', !!P.get(it.key)) });
    } else if (kind === 'select') {
      const sel = document.createElement('select');
      for (const [v, t] of it.options) {
        const o = document.createElement('option');
        o.value = String(v); o.textContent = t;
        sel.appendChild(o);
      }
      sel.value = String(P.get(it.key));
      sel.onchange = () => {
        const v = typeof it.value === 'number' ? Number(sel.value) : sel.value;
        P.set(it.key, v);
      };
      row.appendChild(sel);
      this.rows.set(it.key, { sync: () => { sel.value = String(P.get(it.key)); } });
    } else {
      const val = document.createElement('span');
      val.className = 'val';
      const inp = document.createElement('input');
      inp.type = 'range';
      inp.min = it.min; inp.max = it.max; inp.step = it.step;
      inp.value = P.get(it.key);
      const fmt = (v) => (it.step >= 1 ? String(Math.round(v)) : v.toFixed(String(it.step).split('.')[1]?.length || 2));
      const paint = () => {
        const v = Number(inp.value);
        val.textContent = fmt(v);
        inp.style.setProperty('--p', ((v - it.min) / (it.max - it.min) * 100).toFixed(1) + '%');
      };
      inp.oninput = () => { P.set(it.key, Number(inp.value)); paint(); };
      paint();
      row.appendChild(val);
      row.appendChild(inp);
      this.rows.set(it.key, { sync: () => { inp.value = P.get(it.key); paint(); } });
    }
    return row;
  }

  _buildTop() {
    const tabs = document.getElementById('sceneTabs');
    this.tabBtns = [...tabs.querySelectorAll('button')];
    for (const b of this.tabBtns) b.onclick = () => this.app.switchScene(b.dataset.scene);

    const sel = document.getElementById('presetSel');
    const ph = document.createElement('option');
    ph.textContent = '预设…'; ph.value = '';
    sel.appendChild(ph);
    for (const k of Object.keys(PRESETS)) {
      const o = document.createElement('option');
      o.value = k; o.textContent = k;
      sel.appendChild(o);
    }
    sel.onchange = () => {
      if (!sel.value) return;
      P.applyPreset(sel.value);
      this.syncAll();
      this.toast('已应用预设：' + sel.value);
      sel.value = '';
    };

    document.getElementById('btnStrike').onclick = () => this.app.strike();
    document.getElementById('btnRebuild').onclick = () => this.app.rebuild();
    document.getElementById('btnPanel').onclick = () => this.el.classList.toggle('hide');
  }

  setScene(name) {
    for (const b of this.tabBtns) b.classList.toggle('on', b.dataset.scene === name);
  }

  syncAll() { for (const r of this.rows.values()) r.sync(); }

  toast(msg) {
    const d = document.createElement('div');
    d.className = 'toast-item';
    d.textContent = msg;
    this._toast.appendChild(d);
    setTimeout(() => d.remove(), 2700);
    while (this._toast.children.length > 5) this._toast.firstChild.remove();
  }

  updateStats(dt, info) {
    this._statAcc += dt;
    if (this._statAcc < 0.25) return;
    this._statAcc = 0;
    const f = info.fps;
    const cls = f < 24 ? 'bad' : f < 45 ? 'hi' : '';
    this.statsEl.innerHTML =
      `<b>${info.scene}</b>  <span class="${cls}">${f.toFixed(0)} fps</span> · ${info.ms.toFixed(1)} ms\n` +
      `draw ${info.calls}  tri ${(info.tris / 1000).toFixed(0)}k  prog ${info.programs}\n` +
      `体积步数 ×${info.volScale.toFixed(2)}  碎片 ${info.debris}(睡${info.sleeping})\n` +
      `风速 <span class="hi">${info.vmax.toFixed(0)} m/s</span>  涡心 ${info.dist.toFixed(0)} m  ${info.extra || ''}`;
  }
}
