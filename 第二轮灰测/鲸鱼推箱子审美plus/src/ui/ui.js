/**
 * DOM layer. Owns every panel, the level list, the shader lab controls, the
 * language switch and the touch pad; knows nothing about three.js.
 *
 * All copy comes from src/ui/i18n.js. Static strings are marked up with
 * data-i18n in index.html; anything this file builds at runtime keeps its
 * descriptor so it can be rebuilt when the locale changes.
 */
import { initLocale, setLocale, getLocale, t, levelText, applyTo } from './i18n.js';

const $ = (sel) => document.querySelector(sel);

const SCREENS = {
  boot: '#boot',
  title: '#title',
  hud: '#hud',
  solved: '#solved',
  levels: '#levels',
  lab: '#lab',
  credits: '#credits',
};

export class UI {
  constructor({ onAction, onLocale }) {
    this.onAction = onAction;
    this.onLocale = onLocale;
    this.el = {};
    for (const [key, sel] of Object.entries(SCREENS)) this.el[key] = $(sel);

    this.bootStep = $('#boot-step');
    this.bootFill = $('#boot-fill');
    this.hudIndex = $('#hud-index');
    this.hudName = $('#hud-name');
    this.hudConcept = $('#hud-concept');
    this.hudHint = $('#hud-hint');
    this.hudSeated = $('#hud-seated');
    this.hudPushes = $('#hud-pushes');
    this.hudMoves = $('#hud-moves');
    this.lockWarning = $('#lock-warning');
    this.solvedTitle = $('#solved-title');
    this.solvedPushes = $('#solved-pushes');
    this.solvedMoves = $('#solved-moves');
    this.levelGrid = $('#level-grid');
    this.labGroupsEl = $('#lab-groups');
    this.stat = {
      blades: $('#stat-blades'),
      calls: $('#stat-calls'),
      tris: $('#stat-tris'),
      res: $('#stat-res'),
      fps: $('#stat-fps'),
    };

    // Remembered so a locale switch can redraw everything from source.
    this.state = {
      bootKey: 'boot.step.start',
      bootProgress: 0,
      hud: null,
      solved: null,
      levels: null,
      labGroups: null,
    };

    document.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-action]');
      if (!btn) return;
      event.preventDefault();
      if (btn.dataset.action === 'lang') {
        this.setLocale(btn.dataset.lang);
        return;
      }
      this.onAction(btn.dataset.action, btn);
    });

    this.buildTouchpad();
    this.overlay = null;

    initLocale();
    applyTo(document);
  }

  /* ------------------------------------------------------------ locale */

  get locale() {
    return getLocale();
  }

  setLocale(next) {
    if (next === getLocale()) return;
    setLocale(next);
    this.redraw();
    if (this.onLocale) this.onLocale(next);
  }

  /** Repaints everything this file generated, in the new language. */
  redraw() {
    const s = this.state;
    this.setBoot(s.bootKey, s.bootProgress);
    if (s.levels) this.buildLevelList(s.levels.levels, s.levels.pars, s.levels.completed);
    if (s.labGroups) this.buildLab(s.labGroups);
    if (s.hud) this.setHudState(s.hud);
    if (s.solved) this.paintSolved(s.solved);
  }

  /* ------------------------------------------------------------ screens */

  show(name, visible) {
    const el = this.el[name];
    if (el) el.hidden = !visible;
  }

  /** @param {string} key an i18n key such as 'boot.step.sky' */
  setBoot(key, progress) {
    this.state.bootKey = key;
    this.state.bootProgress = progress;
    if (this.bootStep) this.bootStep.textContent = t(key);
    if (this.bootFill) this.bootFill.style.width = `${Math.round(progress * 100)}%`;
  }

  finishBoot() {
    this.setBoot('boot.step.ready', 1);
    setTimeout(() => this.show('boot', false), 280);
  }

  closeOverlays() {
    this.show('levels', false);
    this.show('lab', false);
    this.show('credits', false);
    this.show('solved', false);
    this.overlay = null;
    this.state.solved = null;
  }

  openOverlay(name) {
    const wasOpen = this.overlay === name;
    this.closeOverlays();
    if (!wasOpen) {
      this.show(name, true);
      this.overlay = name;
    }
  }

  toTitle() {
    this.closeOverlays();
    this.show('title', true);
    this.show('hud', false);
    this.setTouchpad(false);
  }

  toGame() {
    this.closeOverlays();
    this.show('title', false);
    this.show('hud', true);
    this.setTouchpad(true);
  }

  /* ------------------------------------------------------------ hud */

  setHudState(info) {
    this.state.hud = info;
    const text = levelText(info);
    this.hudIndex.textContent = t('hud.index', { n: info.index + 1, total: info.count });
    this.hudName.textContent = text.name;
    this.hudConcept.textContent = text.concept;
    this.hudHint.textContent = text.hint;
    this.hudSeated.textContent = `${info.seated} / ${info.goals}`;
    this.hudPushes.textContent = String(info.pushes);
    this.hudMoves.textContent = String(info.moves);
    this.lockWarning.hidden = !(info.locked && !info.solved);
  }

  showSolved(info) {
    this.paintSolved(info);
    this.show('solved', true);
    this.overlay = 'solved';
  }

  paintSolved(info) {
    this.state.solved = info;
    this.solvedTitle.textContent = levelText(info).name;
    this.solvedPushes.textContent = String(info.pushes);
    this.solvedMoves.textContent = String(info.moves);
    const next = this.el.solved.querySelector('[data-action="next"]');
    if (next) next.textContent = t(info.last ? 'solved.nextLast' : 'solved.next');
  }

  /* ------------------------------------------------------------ level list */

  buildLevelList(levels, pars, completed) {
    this.state.levels = { levels, pars, completed };
    this.levelGrid.innerHTML = '';
    levels.forEach((level, i) => {
      const text = levelText(level);
      const li = document.createElement('li');
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'levelcard';
      if (completed.has(level.id)) card.classList.add('is-done');
      card.dataset.action = 'pick-level';
      card.dataset.index = String(i);
      const par = pars[i] ? t('levels.pushes', { n: pars[i] }) : t('levels.unrated');
      card.innerHTML = `
        <span class="levelcard__no"></span>
        <span class="levelcard__name"></span>
        <span class="levelcard__meta"></span>`;
      card.querySelector('.levelcard__no').textContent = t('levels.card', { n: String(i + 1).padStart(2, '0') });
      card.querySelector('.levelcard__name').textContent = text.name;
      card.querySelector('.levelcard__meta').textContent = `${text.concept} · ${par}`;
      li.appendChild(card);
      this.levelGrid.appendChild(li);
    });
  }

  markCompleted(levels, completed) {
    if (this.state.levels) this.state.levels.completed = completed;
    this.levelGrid.querySelectorAll('.levelcard').forEach((card, i) => {
      card.classList.toggle('is-done', completed.has(levels[i].id));
    });
  }

  /* ------------------------------------------------------------ shader lab */

  /**
   * @param {{key:string, rows:Array}[]} groups row labels are looked up as
   *   `lab.<row.id>`, group titles as `lab.group.<group.key>`
   */
  buildLab(groups) {
    this.state.labGroups = groups;
    this.labGroupsEl.innerHTML = '';
    for (const group of groups) {
      const section = document.createElement('section');
      section.className = 'labgroup';
      const h = document.createElement('h3');
      h.textContent = t(`lab.group.${group.key}`);
      section.appendChild(h);

      for (const row of group.rows) {
        if (row.type === 'range') section.appendChild(this.makeRange(row));
        else if (row.type === 'toggle') section.appendChild(this.makeToggle(row));
        else if (row.type === 'segment') section.appendChild(this.makeSegment(row));
      }
      this.labGroupsEl.appendChild(section);
    }
  }

  makeRange(row) {
    const wrap = document.createElement('div');
    wrap.className = 'labrow';
    const id = `lab-${row.id}`;
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = t(`lab.${row.id}`);
    const out = document.createElement('output');
    const input = document.createElement('input');
    input.type = 'range';
    input.id = id;
    input.min = String(row.min);
    input.max = String(row.max);
    input.step = String(row.step ?? 0.01);
    input.value = String(row.value);
    const fmt = row.format || ((v) => v.toFixed(2));
    out.textContent = fmt(row.value);
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      out.textContent = fmt(v);
      row.value = v;              // remembered across a locale rebuild
      row.onInput(v);
    });
    wrap.append(label, out, input);
    return wrap;
  }

  makeToggle(row) {
    const wrap = document.createElement('div');
    wrap.className = 'labtoggle';
    const label = document.createElement('span');
    label.textContent = t(`lab.${row.id}`);
    const btn = document.createElement('button');
    btn.type = 'button';
    const paint = () => {
      btn.setAttribute('aria-pressed', String(row.value));
      btn.textContent = t(`lab.${row.id}.${row.value ? 'on' : 'off'}`);
    };
    paint();
    btn.addEventListener('click', () => {
      row.value = !row.value;
      paint();
      row.onChange(row.value);
    });
    wrap.append(label, btn);
    return wrap;
  }

  makeSegment(row) {
    const wrap = document.createElement('div');
    wrap.className = 'labtoggle';
    const label = document.createElement('span');
    label.textContent = t(`lab.${row.id}`);
    const seg = document.createElement('div');
    seg.className = 'labsegment';
    const buttons = row.options.map((opt) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = opt.label;
      b.addEventListener('click', () => {
        row.value = opt.value;
        buttons.forEach((other, i) => other.setAttribute('aria-pressed', String(row.options[i].value === row.value)));
        row.onChange(row.value);
      });
      seg.appendChild(b);
      return b;
    });
    buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(row.options[i].value === row.value)));
    wrap.append(label, seg);
    return wrap;
  }

  setStats({ blades, calls, tris, res, fps }) {
    const num = (v) => v.toLocaleString(getLocale() === 'zh' ? 'zh-CN' : 'en-US');
    if (blades !== undefined) this.stat.blades.textContent = num(blades);
    if (calls !== undefined) this.stat.calls.textContent = String(calls);
    if (tris !== undefined) this.stat.tris.textContent = num(tris);
    if (res !== undefined) this.stat.res.textContent = res;
    if (fps !== undefined) this.stat.fps.textContent = String(Math.round(fps));
  }

  /* ------------------------------------------------------------ touch */

  buildTouchpad() {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    if (coarse) document.body.classList.add('is-touch');
    const pad = document.createElement('div');
    pad.className = 'touchpad';
    const dirs = [
      ['up', 'pad-up', '\u25B2'],
      ['left', 'pad-left', '\u25C0'],
      ['right', 'pad-right', '\u25B6'],
      ['down', 'pad-down', '\u25BC'],
    ];
    for (const [dir, cls, glyph] of dirs) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = cls;
      b.dataset.action = 'move';
      b.dataset.dir = dir;
      b.textContent = glyph;
      b.dataset.i18nLabel = `hud.dir.${dir}`;
      b.setAttribute('aria-label', t(`hud.dir.${dir}`));
      pad.appendChild(b);
    }
    document.body.appendChild(pad);
    this.touchpad = pad;
  }

  setTouchpad(active) {
    if (this.touchpad) this.touchpad.classList.toggle('is-active', active);
  }
}
