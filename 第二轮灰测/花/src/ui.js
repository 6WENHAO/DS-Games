// HUD + settings panel wiring.

import { PRESETS } from './weather.js';
import { QUALITY, DEFAULTS } from './config.js';

const LS_KEY = 'petal-drift-settings-v1';

const SLIDERS = [
  ['s-res', 'resScale', (v) => v.toFixed(2)],
  ['s-grass', 'grassDensity', (v) => v.toFixed(2)],
  ['s-cloud', 'cloudSteps', (v) => String(Math.round(v))],
  ['s-dof', 'dof', (v) => v.toFixed(2)],
  ['s-bloom', 'bloom', (v) => v.toFixed(2)],
  ['s-fog', 'fog', (v) => v.toFixed(2)],
  ['s-exp', 'exposure', (v) => v.toFixed(2)],
  ['s-sat', 'saturation', (v) => v.toFixed(2)],
  ['s-grain', 'grain', (v) => v.toFixed(2)],
  ['s-wind', 'wind', (v) => v.toFixed(2)],
  ['s-volume', 'volume', (v) => v.toFixed(2)],
  ['s-music', 'music', (v) => v.toFixed(2)],
  ['s-amb', 'ambience', (v) => v.toFixed(2)],
  ['s-petals', 'petals', (v) => String(Math.round(v))],
  ['s-spread', 'spread', (v) => v.toFixed(1)],
];

const TOGGLES = [
  ['tog-auto', 'autoWeather'],
  ['tog-adapt', 'adaptive'],
  ['tog-bars', 'cinematicBars'],
  ['tog-shaft', 'godrays'],
  ['tog-free', 'freeCam'],
  ['tog-mute', 'muted'],
];

export class UI {
  constructor(settings, hooks) {
    this.s = settings;
    this.hooks = hooks;
    this.el = {
      panel: document.getElementById('panel'),
      cog: document.getElementById('cog'),
      bars: document.getElementById('bars'),
      title: document.getElementById('title'),
      hint: document.getElementById('hint'),
      weather: document.querySelector('#weather .w-name'),
      weatherSub: document.querySelector('#weather .w-sub'),
      count: document.querySelector('#bloomct b'),
      stats: document.getElementById('stats'),
      boot: document.getElementById('boot'),
      wchips: document.getElementById('wchips'),
      qchips: document.getElementById('qchips'),
      clear: document.getElementById('btn-clear'),
      snd: document.getElementById('snd'),
    };

    this.buildChips();
    this.buildSliders();
    this.buildToggles();

    this.el.cog.addEventListener('click', () => this.togglePanel());
    this.el.clear.addEventListener('click', () => this.hooks.onClear?.());
    this.applyBars();
    this.introTimer = 0;
    this.introDone = false;
  }

  static load() {
    const s = Object.assign({
      quality: DEFAULTS.quality,
      resScale: QUALITY[DEFAULTS.quality].resScale,
      grassDensity: QUALITY[DEFAULTS.quality].grass,
      cloudSteps: QUALITY[DEFAULTS.quality].cloudSteps,
    }, DEFAULTS);
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) Object.assign(s, JSON.parse(raw));
    } catch (e) { /* ignore */ }
    return s;
  }

  save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(this.s)); } catch (e) { /* ignore */ }
  }

  buildChips() {
    this.wchips = [];
    for (const p of PRESETS) {
      const b = document.createElement('div');
      b.className = 'chip';
      b.textContent = p.name;
      b.title = p.sub;
      b.addEventListener('click', () => {
        this.hooks.onWeather?.(p.key);
        this.setWeatherActive(p.key);
      });
      this.el.wchips.appendChild(b);
      this.wchips.push({ key: p.key, el: b });
    }

    this.qchips = [];
    for (const key of Object.keys(QUALITY)) {
      const b = document.createElement('div');
      b.className = 'chip' + (key === this.s.quality ? ' on' : '');
      b.textContent = QUALITY[key].label;
      b.addEventListener('click', () => {
        this.s.quality = key;
        for (const c of this.qchips) c.el.classList.toggle('on', c.key === key);
        this.hooks.onQuality?.(key);
        this.syncSliders();
        this.save();
      });
      this.el.qchips.appendChild(b);
      this.qchips.push({ key, el: b });
    }
  }

  buildSliders() {
    this.sliders = [];
    for (const [id, key, fmt] of SLIDERS) {
      const el = document.getElementById(id);
      const out = document.getElementById(id.replace('s-', 'v-'));
      if (!el) continue;
      el.value = String(this.s[key]);
      if (out) out.textContent = fmt(Number(this.s[key]));
      el.addEventListener('input', () => {
        const v = Number(el.value);
        this.s[key] = v;
        if (out) out.textContent = fmt(v);
        this.hooks.onSetting?.(key, v);
        this.save();
      });
      this.sliders.push({ el, key, out, fmt });
    }
  }

  syncSliders() {
    for (const s of this.sliders) {
      s.el.value = String(this.s[s.key]);
      if (s.out) s.out.textContent = s.fmt(Number(this.s[s.key]));
    }
  }

  buildToggles() {
    this.toggles = [];
    for (const [id, key] of TOGGLES) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.classList.toggle('on', !!this.s[key]);
      el.addEventListener('click', () => {
        this.s[key] = !this.s[key];
        el.classList.toggle('on', !!this.s[key]);
        this.hooks.onSetting?.(key, this.s[key]);
        if (key === 'cinematicBars') this.applyBars();
        this.save();
      });
      this.toggles.push({ el, key });
    }
  }

  syncToggles() {
    for (const t of this.toggles) t.el.classList.toggle('on', !!this.s[t.key]);
    this.applyBars();
  }

  applyBars() {
    this.el.bars.classList.toggle('on', !!this.s.cinematicBars);
  }

  togglePanel() {
    this.el.panel.classList.toggle('on');
  }

  setWeatherActive(key) {
    for (const c of this.wchips) c.el.classList.toggle('on', c.key === key);
  }

  setWeather(name, sub) {
    if (this.el.weather.textContent !== name) this.el.weather.textContent = name;
    if (this.el.weatherSub.textContent !== sub) this.el.weatherSub.textContent = sub;
  }

  setFlowers(n) {
    const t = String(n);
    if (this.el.count.textContent !== t) this.el.count.textContent = t;
  }

  setStats(html) {
    this.el.stats.innerHTML = html;
  }

  soundStarted() {
    if (this.el.snd) this.el.snd.classList.add('gone');
  }

  bootDone() {
    this.el.boot.classList.add('gone');
    setTimeout(() => { this.el.boot.style.display = 'none'; }, 1800);
  }

  update(dt, interacted) {
    if (this.introDone) return;
    this.introTimer += dt;
    if (this.introTimer > (interacted ? 1.2 : 7.5)) {
      this.el.title.classList.add('fade0');
      this.el.hint.classList.add('fade0');
      this.introDone = true;
    }
  }
}
