// HUD + overlays controller. Reads/writes the DOM declared in index.html.
import { ITEMS, itemLabel } from '../data/items.js';
import { HAZARD_INFO } from '../data/planets.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

export class UI {
  constructor(game) {
    this.game = game;
    this.el = {
      hud: $('#hud'),
      vitals: {},
      planetName: $('#planet-plate .pp-name'),
      planetSub: $('#planet-plate .pp-sub'),
      hazardPlate: $('#hazard-plate'),
      units: $('#units-val'),
      nanites: $('#nanite-val'),
      clock: $('#clock-val'),
      clockIcon: $('#clock-icon'),
      compassStrip: $('#compass-strip'),
      compassMarkers: $('#compass-markers'),
      missionTitle: $('#mission-log .ml-title'),
      missionObj: $('#mission-log .ml-obj'),
      missionProg: $('#mission-log .ml-prog i'),
      missionLog: $('#mission-log'),
      hotbar: $('#hotbar-slots'),
      heldName: $('#held-name'),
      toasts: $('#toast-stack'),
      markers: $('#marker-layer'),
      interact: $('#interact-prompt'),
      interactTxt: $('#interact-prompt .txt'),
      interactKey: $('#interact-prompt .key'),
      subtitle: $('#subtitle'),
      crosshair: $('#crosshair'),
      mineProgress: $('#mine-progress'),
      mineFill: $('#mine-progress .fill'),
      beamHeat: $('#beam-heat'),
      beamHeatFill: $('#beam-heat .bh-bar i'),
      visor: $('#visor-ui'),
      visorTarget: $('#vs-readout .vs-r2'),
      visorHold: $('#vs-readout .vs-hold'),
      fxPlasma: $('#fx-plasma'),
      fxFlash: $('#fx-flash'),
      fxDamage: $('#fx-damage'),
      fxWarp: $('#fx-warp'),
      fxVisor: $('#fx-visor'),
      cine: $('#cine'),
      cineMain: $('#cine-text .ct-main'),
      cineSub: $('#cine-text .ct-sub'),
      loading: $('#loading'),
      loadingTitle: $('#loading .ld-title'),
      loadingSub: $('#loading .ld-sub'),
      loadingBar: $('#loading .ld-bar i'),
      loadingTip: $('#loading .ld-tip'),
      title: $('#title-screen'),
      titlePanel: $('#title-panel'),
      pause: $('#pause-screen'),
      panelLayer: $('#panel-layer'),
      shipHud: $('#ship-hud'),
      shipPrompt: $('#ship-center-prompt'),
      shipTarget: $('#ship-target'),
      rdVel: $('#rd-vel'), rdAlt: $('#rd-alt'), rdPulse: $('#rd-pulse'), rdLaunch: $('#rd-launch'),
      debug: $('#debug-overlay'),
    };
    for (const v of ['shield', 'health', 'life', 'hazard', 'jet']) {
      const root = document.querySelector('.vital[data-v="' + v + '"]');
      this.el.vitals[v] = { root, fill: root?.querySelector('.vi-bar i'), num: root?.querySelector('.vi-num') };
    }
    this.shakeAmt = 0;
    this.toastList = [];
    this.markerPool = [];
    this.compassPool = [];
    this._cineTimer = null;
    this._subTimer = null;
    this.panelOpen = null;
  }

  /* --------------- vitals & top plates --------------- */
  updateVitals(p) {
    const set = (name, val, max) => {
      const v = this.el.vitals[name];
      if (!v || !v.fill) return;
      const pc = Math.max(0, Math.min(1, val / max));
      v.fill.style.width = (pc * 100).toFixed(1) + '%';
      if (v.num) v.num.textContent = Math.round(val);
      v.root.classList.toggle('low', pc < 0.25);
    };
    set('shield', p.shield, p.maxShield);
    set('health', p.health, p.maxHealth);
    set('life', p.life, p.maxLife);
    set('jet', p.jet, p.maxJet);
    const haz = this.el.vitals.hazard;
    const showHaz = this.game.planet && this.game.planet.hazard !== 'none';
    if (haz.root) haz.root.classList.toggle('hidden', !showHaz);
    if (showHaz) set('hazard', p.hazard, p.maxHazard);
  }

  setPlanet(planet) {
    if (!planet) return;
    this.el.planetName.textContent = planet.name;
    this.el.planetSub.textContent = planet.biomeCn + ' · ' + planet.desc + ' · 天气: ' + planet.weather;
    const hz = HAZARD_INFO[planet.hazard] || HAZARD_INFO.none;
    const plate = this.el.hazardPlate;
    if (planet.hazard === 'none') plate.classList.add('hidden');
    else {
      plate.classList.remove('hidden');
      plate.querySelector('.hz-icon').textContent = hz.icon;
      plate.querySelector('.hz-text').textContent = hz.cn + ' ' + hz.en;
      plate.querySelector('.hz-val').textContent = planet.hazardLevel;
      plate.style.setProperty('--hz-color', hz.color);
    }
  }

  setUnits(u, n) {
    this.el.units.textContent = Math.floor(u).toLocaleString('en-US');
    this.el.nanites.textContent = Math.floor(n).toLocaleString('en-US');
  }

  setClock(dayT, isSpace) {
    if (isSpace) { this.el.clock.textContent = '—'; this.el.clockIcon.textContent = '✧'; return; }
    const hours = ((dayT * 24) + 6) % 24;
    const h = Math.floor(hours), m = Math.floor((hours - h) * 60);
    this.el.clock.textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    this.el.clockIcon.textContent = (h >= 6 && h < 19) ? '☀' : '☾';
  }

  /* --------------- mission --------------- */
  setMission(m) {
    if (!m) { this.el.missionLog.classList.add('hidden'); return; }
    this.el.missionLog.classList.remove('hidden');
    this.el.missionTitle.textContent = m.title || '';
    this.el.missionObj.textContent = m.obj || '';
    this.el.missionProg.style.width = ((m.prog || 0) * 100).toFixed(0) + '%';
  }

  /* --------------- hotbar --------------- */
  updateHotbar() {
    const g = this.game;
    const p = g.player;
    const inv = g.inventory;
    const host = this.el.hotbar;
    if (!host) return;
    if (host.children.length !== 9) {
      host.innerHTML = '';
      for (let i = 0; i < 9; i++) {
        const d = document.createElement('div');
        d.className = 'hslot';
        d.innerHTML = '<span class="hkey">' + (i + 1) + '</span><img class="hicon" alt=""><span class="hcount"></span>';
        d.addEventListener('click', () => { p.selected = i; this.updateHotbar(); g.audio.uiClick(); });
        host.appendChild(d);
      }
    }
    for (let i = 0; i < 9; i++) {
      const slotEl = host.children[i];
      slotEl.classList.toggle('active', p.selected === i);
      const idx = p.hotbar[i];
      const stack = (idx !== null && idx !== undefined) ? inv.slots[idx] : null;
      const img = slotEl.querySelector('.hicon');
      const cnt = slotEl.querySelector('.hcount');
      if (stack) {
        img.src = g.icons.get(stack.key);
        img.style.visibility = 'visible';
        cnt.textContent = stack.count > 1 ? stack.count : '';
      } else {
        img.style.visibility = 'hidden';
        cnt.textContent = '';
      }
    }
    const cur = p.currentItem();
    if (cur) {
      this.el.heldName.textContent = itemLabel(cur.key) + '  ×' + cur.count;
      this.el.heldName.classList.add('show');
      clearTimeout(this._heldTimer);
      this._heldTimer = setTimeout(() => this.el.heldName.classList.remove('show'), 1800);
    } else {
      this.el.heldName.classList.remove('show');
    }
  }

  /* --------------- toasts --------------- */
  toast(o) {
    const host = this.el.toasts;
    if (!host) return;
    const d = document.createElement('div');
    d.className = 'toast ' + (o.kind || 'info');
    let icon = '';
    if (o.key && this.game.icons) icon = '<img class="ticon" src="' + this.game.icons.get(o.key) + '" alt="">';
    else if (o.icon) icon = '<span class="ticon glyph">' + o.icon + '</span>';
    const name = o.name || (o.key ? itemLabel(o.key) : '');
    d.innerHTML = icon + '<span class="tname">' + name + '</span>' + (o.amt ? '<span class="tamt">' + o.amt + '</span>' : '');
    host.appendChild(d);
    // merge duplicates of resource gains
    requestAnimationFrame(() => d.classList.add('in'));
    setTimeout(() => {
      d.classList.remove('in');
      setTimeout(() => d.remove(), 400);
    }, o.dur || 2600);
    while (host.children.length > 7) host.firstChild.remove();
  }

  /* --------------- markers --------------- */
  setMarkers(list) {
    const host = this.el.markers;
    if (!host) return;
    while (this.markerPool.length < list.length) {
      const d = document.createElement('div');
      d.className = 'wmarker';
      d.innerHTML = '<span class="wm-icon"></span><span class="wm-label"></span><span class="wm-dist"></span>';
      host.appendChild(d);
      this.markerPool.push(d);
    }
    for (let i = 0; i < this.markerPool.length; i++) {
      const el = this.markerPool[i];
      const m = list[i];
      if (!m) { el.style.display = 'none'; continue; }
      el.style.display = '';
      el.className = 'wmarker ' + (m.cls || '') + (m.dist > 200 ? ' far' : '');
      el.style.left = m.x.toFixed(1) + 'px';
      el.style.top = m.y.toFixed(1) + 'px';
      el.style.opacity = m.opacity ?? 1;
      el.querySelector('.wm-icon').textContent = m.icon || '◈';
      el.querySelector('.wm-label').textContent = m.label || '';
      el.querySelector('.wm-dist').textContent = m.dist !== undefined ? Math.round(m.dist) + 'u' : '';
    }
  }

  setCompass(list, yaw) {
    const host = this.el.compassMarkers;
    if (!host) return;
    while (this.compassPool.length < list.length) {
      const d = document.createElement('div');
      d.className = 'cmarker';
      d.innerHTML = '<span class="ci"></span><span class="cl"></span>';
      host.appendChild(d);
      this.compassPool.push(d);
    }
    const W = host.clientWidth || 420;
    for (let i = 0; i < this.compassPool.length; i++) {
      const el = this.compassPool[i];
      const m = list[i];
      if (!m) { el.style.display = 'none'; continue; }
      let rel = m.bearing - yaw;
      while (rel > Math.PI) rel -= Math.PI * 2;
      while (rel < -Math.PI) rel += Math.PI * 2;
      const fov = Math.PI * 0.95;
      if (Math.abs(rel) > fov / 2) { el.style.display = 'none'; continue; }
      el.style.display = '';
      el.className = 'cmarker ' + (m.cls || '');
      el.style.left = (W / 2 + (rel / fov) * W).toFixed(1) + 'px';
      el.querySelector('.ci').textContent = m.icon || '◆';
      el.querySelector('.cl').textContent = m.label || '';
    }
  }

  /* --------------- reticle / mining --------------- */
  setMineProgress(p) {
    const el = this.el.mineProgress;
    if (!el) return;
    if (p <= 0.001) { el.classList.remove('on'); this.el.crosshair.classList.remove('wide'); return; }
    el.classList.add('on');
    this.el.crosshair.classList.add('wide');
    this.el.mineFill.style.setProperty('--p', p.toFixed(3));
  }

  setBeamHeat(h, overheated) {
    const el = this.el.beamHeat;
    if (!el) return;
    el.classList.toggle('hidden', h < 0.02 && !overheated);
    el.classList.toggle('hot', h > 0.7 || overheated);
    this.el.beamHeatFill.style.width = (h * 100).toFixed(0) + '%';
  }

  setInteract(text, keyLabel) {
    const el = this.el.interact;
    if (!el) return;
    if (!text) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    this.el.interactTxt.textContent = text;
    this.el.interactKey.textContent = keyLabel || 'E';
  }

  subtitle(text, dur = 4200) {
    const el = this.el.subtitle;
    if (!el) return;
    clearTimeout(this._subTimer);
    if (!text) { el.classList.add('hidden'); return; }
    el.textContent = text;
    el.classList.remove('hidden');
    this._subTimer = setTimeout(() => el.classList.add('hidden'), dur);
  }

  /* --------------- visor --------------- */
  setVisor(on) {
    this.el.visor.classList.toggle('hidden', !on);
    this.el.fxVisor.classList.toggle('on', !!on);
  }

  setVisorTarget(t, progress) {
    if (!t) {
      this.el.visorTarget.textContent = '目标: 无 · 移动准星寻找目标';
      this.el.visorHold.classList.add('hidden');
      return;
    }
    this.el.visorTarget.textContent = '目标: ' + t.label + '  [' + t.typeLabel + ']  ' + Math.round(t.dist) + 'u';
    this.el.visorHold.classList.toggle('hidden', !!t.known);
    if (progress > 0) this.el.visorHold.textContent = '分析中 ' + Math.round(progress * 100) + '%';
    else this.el.visorHold.innerHTML = '按住 <b>左键</b> 分析';
  }

  /* --------------- fx --------------- */
  damageFlash() {
    const el = this.el.fxDamage;
    el.classList.remove('on');
    void el.offsetWidth;
    el.classList.add('on');
  }
  shake(a) { this.shakeAmt = Math.min(1.2, this.shakeAmt + a); }
  flash(a) { this.el.fxFlash.style.opacity = String(Math.max(0, Math.min(1, a))); }
  plasma(i) { this.el.fxPlasma.style.setProperty('--i', String(Math.max(0, Math.min(1, i)))); }
  warp(on) { this.el.fxWarp.classList.toggle('on', !!on); }

  cinematic(o) {
    const el = this.el.cine;
    if (!o) { el.classList.remove('on'); this.el.cineMain.textContent = ''; this.el.cineSub.textContent = ''; return; }
    el.classList.add('on');
    this.el.cineMain.textContent = o.main || '';
    this.el.cineSub.textContent = o.sub || '';
    this.el.cineMain.classList.remove('anim'); void this.el.cineMain.offsetWidth; this.el.cineMain.classList.add('anim');
    clearTimeout(this._cineTimer);
    if (o.dur) this._cineTimer = setTimeout(() => this.cinematic(null), o.dur);
  }

  cineBarsOnly(on) {
    this.el.cine.classList.toggle('on', !!on);
    if (on) { this.el.cineMain.textContent = ''; this.el.cineSub.textContent = ''; }
  }

  /* --------------- loading --------------- */
  loading(show, o = {}) {
    const el = this.el.loading;
    el.classList.toggle('hidden', !show);
    if (o.title) this.el.loadingTitle.textContent = o.title;
    if (o.sub) this.el.loadingSub.textContent = o.sub;
    if (o.tip !== undefined) this.el.loadingTip.textContent = o.tip;
    if (o.progress !== undefined) this.el.loadingBar.style.width = (Math.max(0, Math.min(1, o.progress)) * 100).toFixed(0) + '%';
  }

  showHud(v) { this.el.hud.classList.toggle('hidden', !v); }

  /* --------------- ship hud --------------- */
  shipHud(show) { this.el.shipHud.classList.toggle('hidden', !show); }
  updateShipHud(d) {
    const set = (g, v) => {
      const el = document.querySelector('.sh-gauge[data-g="' + g + '"] .g-bar i');
      if (el) el.style.width = (Math.max(0, Math.min(1, v)) * 100).toFixed(0) + '%';
    };
    set('throttle', d.throttle);
    set('shield', d.shield);
    set('hull', d.hull);
    this.el.rdVel.textContent = Math.round(d.vel);
    this.el.rdAlt.textContent = d.alt === null ? '—' : Math.round(d.alt);
    this.el.rdPulse.textContent = Math.round(d.pulse * 100);
    this.el.rdLaunch.textContent = Math.round(d.launch * 100);
  }
  shipPrompt(html) {
    const el = this.el.shipPrompt;
    if (!html) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.innerHTML = html;
  }
  shipTarget(name, dist) {
    const el = this.el.shipTarget;
    if (!name) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.querySelector('.st-name').textContent = name;
    el.querySelector('.st-dist').textContent = dist;
  }

  /* --------------- panels --------------- */
  openPanel(name, html, onMount) {
    const layer = this.el.panelLayer;
    const el = document.querySelector('#panel-' + name);
    if (!el) return;
    this.closePanel(true);
    layer.classList.remove('hidden');
    $$('#panel-layer .panel').forEach((p) => p.classList.add('hidden'));
    el.classList.remove('hidden');
    el.innerHTML = html;
    this.panelOpen = name;
    this.game.audio.uiOpen();
    if (onMount) onMount(el);
    this._bindHover(el);
  }

  closePanel(silent = false) {
    if (!this.panelOpen) return;
    const el = document.querySelector('#panel-' + this.panelOpen);
    if (el) el.classList.add('hidden');
    this.el.panelLayer.classList.add('hidden');
    this.panelOpen = null;
    if (!silent) this.game.audio.uiClose();
  }

  _bindHover(root) {
    root.querySelectorAll('button, .slot, .recipe, .bitem, .bcat, .trade-row, .star-node, .tbtn').forEach((b) => {
      b.addEventListener('mouseenter', () => this.game.audio.uiHover());
    });
  }

  setDebug(on) { this.el.debug.classList.toggle('hidden', !on); }
  updateDebug(lines) {
    if (!this.el.debug || this.el.debug.classList.contains('hidden')) return;
    this.el.debug.innerHTML = lines.map((l) => '<div>' + l + '</div>').join('');
  }

  /* --------------- frame --------------- */
  update(dt) {
    this.shakeAmt *= Math.pow(0.02, dt);
  }
}
