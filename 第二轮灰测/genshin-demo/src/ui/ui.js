// UI module E entry — createUI(ctx) wires all subsystems and returns the §2.5 API.
// Every subsystem is constructed in isolation: if one fails it degrades to a no-op,
// the rest of the UI keeps working. All ctx reads are defensive (?. + defaults).
import { clamp } from '../core/utils.js';
import { IntroSystem } from './intro.js';
import { HudSystem } from './hud.js';
import { DialogueSystem } from './dialogue.js';
import { MenusSystem } from './menus.js';

function h(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

const TOAST_ICONS = { chest: ['箱', '#e8b24a'], pickup: ['获', '#74c8a8'], waypoint: ['传', '#4fc3f7'], quest: ['任', '#c88bfa'], talk: ['!', '#9adb4a'] };

function safe(fn, label) {
  try { return fn(); }
  catch (e) { console.error('[ui] ' + label + ' init failed:', e); return null; }
}

export function createUI(ctx) {
  const api = {};
  const root = (typeof document !== 'undefined' && document.getElementById('ui-root')) || document.body;

  // base overlay containers (browser context only)
  const bars = h('div'); bars.id = 'cinematic-bars';
  bars.appendChild(h('div', 'cb top')); bars.appendChild(h('div', 'cb bottom'));
  root.appendChild(bars);

  const toasts = h('div'); toasts.id = 'toasts'; root.appendChild(toasts);
  const subtitleEl = h('div'); subtitleEl.id = 'subtitle'; root.appendChild(subtitleEl);

  const prompt = h('div'); prompt.id = 'prompt';
  const pKey = h('span', 'p-key'); const pText = h('span');
  prompt.appendChild(pKey); prompt.appendChild(pText);
  root.appendChild(prompt);

  const fade = h('div'); fade.id = 'fade'; root.appendChild(fade);
  const credits = h('div'); credits.id = 'credits'; root.appendChild(credits);

  // subsystems — each isolated so one failure can't take the whole UI down
  const intro = safe(() => new IntroSystem(ctx), 'intro');
  const hud = safe(() => new HudSystem(ctx, api), 'hud');
  const dialogue = safe(() => new DialogueSystem(ctx, api), 'dialogue');
  const menus = safe(() => new MenusSystem(ctx, api), 'menus');

  // ---- toast --------------------------------------------------------
  function toast(text, opts) {
    opts = opts || {};
    const t = h('div', 'toast');
    const ico = h('span', 't-ico');
    const [glyph, color] = TOAST_ICONS[opts.icon] || ['✦', '#e8b24a'];
    ico.style.background = color;
    ico.textContent = glyph;
    const tx = h('span'); tx.textContent = text;
    t.appendChild(ico); t.appendChild(tx);
    toasts.appendChild(t);
    const ms = opts.ms || 2400;
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 330); }, ms);
  }
  api.toast = toast;

  // ---- subtitle -----------------------------------------------------
  let subTimer = null;
  function subtitle(text, ms) {
    subtitleEl.textContent = text;
    subtitleEl.classList.add('on');
    clearTimeout(subTimer);
    subTimer = setTimeout(() => subtitleEl.classList.remove('on'), ms || 2600);
  }
  api.subtitle = subtitle;

  // ---- prompt -------------------------------------------------------
  function promptFn(text, key) {
    pKey.textContent = key || '';
    pKey.style.display = key ? '' : 'none';
    pText.textContent = text || '';
    prompt.classList.add('on');
  }
  function hidePrompt() { prompt.classList.remove('on'); }
  api.prompt = promptFn;
  api.hidePrompt = hidePrompt;

  // ---- fade ---------------------------------------------------------
  function fadeFn(to, ms, color) {
    fade.style.background = color || '#000';
    fade.style.transitionDuration = ((ms || 500) / 1000) + 's';
    fade.style.opacity = String(clamp(to, 0, 1));
    return new Promise((res) => setTimeout(res, ms || 500));
  }
  api.fade = fadeFn;

  // ---- cinematic ----------------------------------------------------
  function cinematic(on) {
    const v = on === undefined ? !bars.classList.contains('on') : !!on;
    bars.classList.toggle('on', v);
    if (v) hud?.hide?.(); else hud?.show?.();
  }
  api.cinematic = cinematic;

  // ---- credits ------------------------------------------------------
  let crTimer = null;
  function creditsFn(lines, ms) {
    credits.innerHTML = '';
    const arr = Array.isArray(lines) ? lines : (lines ? [lines] : []);
    for (const ln of arr) {
      const d = h('div', 'cr-line' + (ln && ln.big ? ' big' : ''));
      d.textContent = (ln && ln.text) || ln || '';
      credits.appendChild(d);
    }
    credits.classList.add('on');
    const els = credits.querySelectorAll('.cr-line');
    els.forEach((el, i) => { el.style.transition = 'opacity .5s ease ' + (i * 0.18) + 's'; el.style.opacity = '1'; });
    clearTimeout(crTimer);
    const dur = ms || 4000;
    crTimer = setTimeout(() => { credits.classList.remove('on'); els.forEach(el => el.style.opacity = '0'); }, dur);
    return new Promise((res) => setTimeout(res, dur));
  }
  api.credits = creditsFn;

  // ---- composed APIs (optional chaining = graceful degradation) -----
  api.hud = {
    setHP: (c, m) => hud?.setHP?.(c, m),
    setStamina: (c, m) => hud?.setStamina?.(c, m),
    setSkill: (i, c, t) => hud?.setSkill?.(i, c, t),
    setEnergy: (f) => hud?.setEnergy?.(f),
    setParty: (l) => hud?.setParty?.(l),
    setActive: (i) => hud?.setActive?.(i),
    setBoss: (n, hp, m) => hud?.setBoss?.(n, hp, m),
    clearBoss: () => hud?.clearBoss?.(),
    setRegion: (n) => hud?.setRegion?.(n),
    setLockOn: (x, y, v) => hud?.setLockOn?.(x, y, v),
    setCold: (f) => hud?.setCold?.(f),
    show: () => hud?.show?.(),
    hide: () => hud?.hide?.(),
  };

  api.dialogue = { start: (node) => (dialogue ? dialogue.start(node) : Promise.resolve(0)) };

  api.quest = {
    set: (list) => { menus?.setQuest?.(list); hud?.setQuestTracker?.(list); },
    flash: (text) => toast(text, { icon: 'quest', ms: 2600 }),
  };

  api.map = {
    toggle: () => menus?.toggleMap?.(),
    get isOpen() { return !!menus?.isOpen; },
  };

  api.intro = { play: (opts) => (intro ? intro.play(opts) : Promise.resolve()) };

  api.update = (dt) => {
    intro?.update?.(dt);
    hud?.update?.(dt);
    dialogue?.update?.(dt);
    menus?.update?.(dt);
  };

  // internals for the self-test page
  api._intro = intro; api._hud = hud; api._dialogue = dialogue; api._menus = menus;

  return api;
}
