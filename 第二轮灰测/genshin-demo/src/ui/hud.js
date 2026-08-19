// Battle HUD: party avatars, HP bar, skill/burst icons, stamina ring, minimap, boss bar, quest tracker, lock-on, region banner.
import { clamp, damp } from '../core/utils.js';
import { regionAt, WORLD } from '../world/heightfield.js';
import { worldMapCanvas, drawPlayerArrow } from './menus.js';

const TAU = Math.PI * 2;
const ELEMENT_COLORS = { anemo: '#74c8a8', pyro: '#ff7a55', hydro: '#4fc3f7', electro: '#c88bfa', cryo: '#93e0ef', geo: '#f0b93c', dendro: '#9adb4a' };

const DEFAULT_PARTY = [
  { name: '荧', element: 'anemo', hair: '#e8c46a' },
  { name: '安柏', element: 'pyro', hair: '#a8542e' },
  { name: '丽莎', element: 'electro', hair: '#7f57a8' },
  { name: '芭芭拉', element: 'hydro', hair: '#e3cf94' },
];

function h(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

function drawAvatar(cv, member) {
  const ctx = cv.getContext('2d');
  const S = cv.width, cx = S / 2, cy = S / 2;
  const el = ELEMENT_COLORS[member.element] || '#e8d5a8';
  ctx.clearRect(0, 0, S, S);
  const bg = ctx.createLinearGradient(0, 0, 0, S);
  bg.addColorStop(0, 'rgba(46,54,80,.92)'); bg.addColorStop(1, 'rgba(16,20,34,.92)');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S);
  // element halo
  ctx.globalAlpha = 0.16; ctx.fillStyle = el; ctx.beginPath(); ctx.arc(cx, cy, S * 0.46, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  // head
  const R = S * 0.30;
  ctx.fillStyle = '#ffdcc2';
  ctx.beginPath(); ctx.arc(cx, cy + S * 0.05, R, 0, TAU); ctx.fill();
  // hair cap
  ctx.fillStyle = member.hair;
  ctx.beginPath(); ctx.arc(cx, cy + S * 0.03, R + 1.5, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill();
  // bangs
  ctx.beginPath();
  ctx.arc(cx, cy - S * 0.04, R * 0.96, Math.PI * 1.05, Math.PI * 1.95);
  ctx.fill();
  // eyes
  const ey = cy + S * 0.06;
  ctx.fillStyle = '#3a2a20';
  ctx.beginPath(); ctx.ellipse(cx - S * 0.11, ey, S * 0.036, S * 0.05, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + S * 0.11, ey, S * 0.036, S * 0.05, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(cx - S * 0.10, ey - S * 0.02, S * 0.014, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + S * 0.12, ey - S * 0.02, S * 0.014, 0, TAU); ctx.fill();
  // mouth
  ctx.strokeStyle = '#c97a72'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.arc(cx, cy + S * 0.14, S * 0.06, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  // element ring border
  ctx.strokeStyle = el; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.arc(cx, cy, S * 0.46, 0, TAU); ctx.stroke();
}

function drawSkillIcon(cv, element, isBurst) {
  const ctx = cv.getContext('2d');
  const S = cv.width, cx = S / 2, cy = S / 2;
  const el = ELEMENT_COLORS[element] || '#e8d5a8';
  ctx.clearRect(0, 0, S, S);
  const bg = ctx.createLinearGradient(0, 0, 0, S);
  bg.addColorStop(0, 'rgba(40,48,72,.9)'); bg.addColorStop(1, 'rgba(14,18,30,.9)');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S);
  ctx.translate(cx, cy);
  if (isBurst) {
    // radiating burst
    ctx.fillStyle = el; ctx.globalAlpha = 0.9;
    for (let i = 0; i < 10; i++) {
      ctx.rotate(TAU / 10);
      ctx.beginPath(); ctx.moveTo(0, -S * 0.28); ctx.lineTo(S * 0.07, 0); ctx.lineTo(0, S * 0.3); ctx.lineTo(-S * 0.07, 0); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, S * 0.12, 0, TAU); ctx.fill();
  } else {
    // 3-petal elemental swirl
    ctx.fillStyle = el;
    for (let i = 0; i < 3; i++) {
      ctx.rotate(TAU / 3);
      ctx.beginPath();
      ctx.moveTo(0, -S * 0.32);
      ctx.bezierCurveTo(S * 0.15, -S * 0.13, S * 0.15, 0.02, 0, S * 0.1);
      ctx.bezierCurveTo(-S * 0.15, 0.02, -S * 0.15, -S * 0.13, 0, -S * 0.32);
      ctx.fill();
    }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, S * 0.08, 0, TAU); ctx.fill();
  }
}

export class HudSystem {
  constructor(ctx, api) {
    this.ctx = ctx; this.api = api;
    this.active = 0;
    this.party = DEFAULT_PARTY.map(d => ({ ...d, hp: 1000, maxHp: 1000 }));
    this.hp = { cur: 1000, max: 1000, ghost: 1, hurt: 0 };
    this.stamina = { cur: 200, max: 200 };
    this.skills = [{ cd: 0, total: 0 }, { cd: 0, total: 0 }];
    this.boss = null;
    this._cold = 0;
    this._build();
  }

  _build() {
    const root = h('div'); root.id = 'hud';
    this.root = root;

    // party
    const party = h('div'); party.id = 'party';
    this._cards = [];
    for (let i = 0; i < 4; i++) {
      const card = h('div', 'party-card' + (i === 0 ? ' active' : ''));
      const cv = h('canvas'); cv.width = cv.height = 96;
      const hp = h('div', 'pc-hp'); const hpf = h('i'); hp.appendChild(hpf);
      const key = h('div', 'pc-key'); key.textContent = String(i + 1);
      card.appendChild(cv); card.appendChild(hp); card.appendChild(key);
      party.appendChild(card);
      this._cards.push({ card, cv, hpf });
    }
    // HP bar
    const hpbar = h('div'); hpbar.id = 'hpbar';
    const hpName = h('div', 'hp-name');
    this._hpNameEl = h('span'); const hpLv = h('span', 'hp-lv'); hpLv.textContent = 'Lv.20';
    hpName.appendChild(this._hpNameEl); hpName.appendChild(hpLv);
    const hpTrack = h('div', 'hp-track');
    this._hpGhost = h('div', 'hp-ghost');
    this._hpFill = h('div', 'hp-fill');
    hpTrack.appendChild(this._hpGhost); hpTrack.appendChild(this._hpFill);
    this._hpNum = h('div', 'hp-num');
    hpbar.appendChild(hpName); hpbar.appendChild(hpTrack); hpbar.appendChild(this._hpNum);
    this._hpbar = hpbar;
    // cold bar (Dragonspine sheer cold)
    const coldbar = h('div'); coldbar.id = 'coldbar';
    this._coldFill = h('div', 'cold-fill');
    coldbar.appendChild(this._coldFill);
    this._coldbar = coldbar;
    // frost vignette
    const frost = h('div'); frost.id = 'frost';
    this._frost = frost;

    // skills
    const skills = h('div'); skills.id = 'skills';
    const skE = h('div', 'skill skill-e');
    this._skEcv = h('canvas'); this._skEcv.width = this._skEcv.height = 96;
    this._skEcd = h('canvas', 'sk-cd'); this._skEcd.width = this._skEcd.height = 96;
    const eKey = h('div', 'sk-key'); eKey.textContent = 'E';
    skE.appendChild(this._skEcv); skE.appendChild(this._skEcd); skE.appendChild(eKey);
    const skQ = h('div', 'skill skill-q');
    this._skQcv = h('canvas'); this._skQcv.width = this._skQcv.height = 120;
    this._skQcd = h('canvas', 'sk-cd'); this._skQcd.width = this._skQcd.height = 120;
    this._skQen = h('canvas', 'sk-energy'); this._skQen.width = this._skQen.height = 120;
    const qKey = h('div', 'sk-key'); qKey.textContent = 'Q';
    skQ.appendChild(this._skQcv); skQ.appendChild(this._skQen); skQ.appendChild(this._skQcd); skQ.appendChild(qKey);
    skills.appendChild(skE); skills.appendChild(skQ);
    this._skillE = skE; this._skillQ = skQ;

    // stamina
    const stamina = h('div'); stamina.id = 'stamina';
    this._stamCv = h('canvas'); this._stamCv.width = this._stamCv.height = 100;
    stamina.appendChild(this._stamCv);
    this._stamina = stamina;

    // crosshair + lockon
    const cross = h('div'); cross.id = 'crosshair';
    cross.appendChild(h('div', 'ch-dot'));
    const lockon = h('div'); lockon.id = 'lockon';
    for (let i = 0; i < 4; i++) lockon.appendChild(h('i'));
    this._lockon = lockon;

    // minimap
    const mm = h('div'); mm.id = 'minimap';
    this._mmCv = h('canvas'); this._mmCv.width = this._mmCv.height = 200;
    mm.appendChild(this._mmCv);
    const compass = h('div', 'mm-compass'); compass.textContent = '北';
    this._mmName = h('div', 'mm-name');
    this._mmWeather = h('div', 'mm-weather');
    mm.appendChild(compass); mm.appendChild(this._mmWeather); mm.appendChild(this._mmName);

    // boss bar
    const boss = h('div'); boss.id = 'bossbar';
    const bName = h('div', 'boss-name'); this._bossName = bName;
    const bTrack = h('div', 'boss-track');
    this._bossFill = h('div', 'boss-fill');
    const bTicks = h('div', 'boss-ticks');
    for (let i = 0; i < 10; i++) bTicks.appendChild(h('i'));
    bTrack.appendChild(this._bossFill); bTrack.appendChild(bTicks);
    boss.appendChild(bName); boss.appendChild(bTrack);
    this._boss = boss;

    // quest tracker
    const qp = h('div'); qp.id = 'questpanel';
    const qpInner = h('div', 'qp-inner');
    const qpHead = h('div', 'qp-head'); qpHead.textContent = '当前任务';
    this._qpTitle = h('div', 'qp-title');
    this._qpSteps = h('div');
    qpInner.appendChild(qpHead); qpInner.appendChild(this._qpTitle); qpInner.appendChild(this._qpSteps);
    qp.appendChild(qpInner);
    this._questpanel = qp;

    // region banner
    const rb = h('div'); rb.id = 'regionbanner';
    this._rbName = h('div', 'rb-name');
    const rbLine = h('div', 'rb-line');
    rb.appendChild(this._rbName); rb.appendChild(rbLine);
    this._regionBanner = rb;

    root.appendChild(party); root.appendChild(hpbar); root.appendChild(coldbar); root.appendChild(skills); root.appendChild(stamina);
    root.appendChild(cross); root.appendChild(lockon); root.appendChild(mm); root.appendChild(boss); root.appendChild(qp); root.appendChild(rb); root.appendChild(frost);

    const host = document.getElementById('ui-root') || document.body;
    host.appendChild(root);

    this._mmCtx = this._mmCv.getContext('2d');
    this._stamCtx = this._stamCv.getContext('2d');
    this._refreshParty();
    this.setHP(1000, 1000);
  }

  _playerPos() {
    const p = this.ctx.player;
    const pos = (p && p.position) || (p && p.root && p.root.position);
    if (pos && typeof pos.x === 'number') return { x: pos.x, z: pos.z };
    return { x: 0, z: 0 };
  }

  // ---- public -------------------------------------------------------
  show() { this.root.classList.add('on'); }
  hide() { this.root.classList.remove('on'); }

  setHP(cur, max) {
    if (typeof max === 'number') this.hp.max = max;
    const prev = this.hp.cur;
    this.hp.cur = cur;
    if (cur < prev) this.hp.hurt = 0.4;
    const f = clamp(this.hp.cur / this.hp.max, 0, 1);
    this._hpFill.style.width = (f * 100).toFixed(2) + '%';
    this._hpNum.textContent = Math.max(0, Math.ceil(this.hp.cur)) + ' / ' + Math.ceil(this.hp.max);
  }

  setStamina(cur, max) { this.stamina.cur = clamp(cur, 0, max); this.stamina.max = max; }

  setSkill(idx, cd, total) {
    this.skills[idx] = { cd: Math.max(0, cd), total: total || 0 };
    const sk = idx === 0 ? this._skillE : this._skillQ;
    if (cd <= 0) sk.classList.add('ready'); else sk.classList.remove('ready');
  }

  setEnergy(f) { this._energy = clamp(f, 0, 1); }

  setParty(list) {
    if (!list || !list.length) return;
    for (let i = 0; i < 4; i++) {
      const src = list[i] || this.party[i];
      this.party[i] = { name: src.name, element: src.element, hair: src.hair || DEFAULT_PARTY[i].hair, icon: src.icon, hp: src.hp ?? src.maxHp ?? 1000, maxHp: src.maxHp ?? 1000 };
    }
    this._refreshParty();
  }

  setActive(idx) {
    this.active = clamp(idx | 0, 0, 3);
    this._refreshParty();
  }

  setBoss(name, hp, maxHp) {
    this.boss = { name, hp, maxHp };
    this._bossName.textContent = name;
    this._bossFill.style.width = (clamp(hp / maxHp, 0, 1) * 100).toFixed(2) + '%';
    this._boss.classList.add('on');
  }
  clearBoss() { this._boss.classList.remove('on'); this.boss = null; }

  setRegion(name) {
    this._rbName.textContent = name;
    const b = this._regionBanner;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
  }

  setLockOn(x, y, visible) {
    this._lockon.style.left = x + 'px';
    this._lockon.style.top = y + 'px';
    this._lockon.classList.toggle('on', !!visible);
  }

  setCold(f) {
    this._cold = clamp(f || 0, 0, 1);
    this._coldbar.classList.toggle('on', this._cold > 0.02);
    this._coldFill.style.width = (this._cold * 100).toFixed(1) + '%';
    this._coldFill.classList.toggle('danger', this._cold >= 0.9);
    this._frost.classList.toggle('on', this._cold > 0.5);
    this._frost.style.opacity = String(clamp((this._cold - 0.5) * 1.3, 0, 0.6));
  }

  setQuestTracker(list) {
    if (!Array.isArray(list)) { this._questpanel.classList.remove('on'); return; }
    const q = list.find(x => x.active) || list[0];
    if (!q) { this._questpanel.classList.remove('on'); return; }
    this._questpanel.classList.add('on');
    this._qpTitle.textContent = q.title;
    this._qpSteps.innerHTML = '';
    for (const st of (q.steps || [])) {
      const row = h('div', 'qp-step' + (st.done ? ' done' : ''));
      const chk = h('i', 'chk');
      const txt = h('span'); txt.textContent = st.text;
      row.appendChild(chk); row.appendChild(txt);
      this._qpSteps.appendChild(row);
    }
  }

  // ---- internal -----------------------------------------------------
  _refreshParty() {
    for (let i = 0; i < 4; i++) {
      const c = this._cards[i];
      const m = this.party[i];
      c.card.classList.toggle('active', i === this.active);
      c.hpf.style.width = (clamp(m.hp / m.maxHp, 0, 1) * 100).toFixed(1) + '%';
      if (m.icon && m.icon.nodeName === 'CANVAS') {
        const ctx = c.cv.getContext('2d');
        ctx.clearRect(0, 0, c.cv.width, c.cv.height);
        ctx.drawImage(m.icon, 0, 0, c.cv.width, c.cv.height);
      } else {
        drawAvatar(c.cv, m);
      }
    }
    const active = this.party[this.active];
    if (active) this._hpNameEl.textContent = active.name;
    drawSkillIcon(this._skEcv, active.element, false);
    drawSkillIcon(this._skQcv, active.element, true);
  }

  _drawStamina() {
    const ctx = this._stamCtx, S = this._stamCv.width, R = S / 2;
    ctx.clearRect(0, 0, S, S);
    const f = clamp(this.stamina.cur / this.stamina.max, 0, 1);
    const col = f < 0.25 ? '#ff6a5a' : (f < 0.55 ? '#ffc44a' : '#74c8a8');
    ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,.16)';
    ctx.beginPath(); ctx.arc(R, R, R - 8, 0, TAU); ctx.stroke();
    ctx.strokeStyle = col;
    ctx.beginPath(); ctx.arc(R, R, R - 8, -Math.PI / 2, -Math.PI / 2 + f * TAU); ctx.stroke();
    this._stamina.classList.toggle('exhausted', f <= 0.01);
  }

  _drawSkillCd(cv, sk) {
    const ctx = cv.getContext('2d');
    const S = cv.width;
    ctx.clearRect(0, 0, S, S);
    if (sk.cd > 0 && sk.total > 0) {
      const frac = clamp(sk.cd / sk.total, 0, 1);
      ctx.fillStyle = 'rgba(8,12,24,.76)';
      ctx.beginPath(); ctx.moveTo(S / 2, S / 2); ctx.arc(S / 2, S / 2, S / 2, -Math.PI / 2, -Math.PI / 2 + frac * TAU); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold ' + (S * 0.2) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(Math.ceil(sk.cd)), S / 2, S / 2);
    }
  }

  _drawBurstEnergy(cv, fill, elem, t) {
    const ctx = cv.getContext('2d');
    const S = cv.width, R = S / 2;
    ctx.clearRect(0, 0, S, S);
    ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.beginPath(); ctx.arc(R, R, R - 6, 0, TAU); ctx.stroke();
    const col = ELEMENT_COLORS[elem] || '#e8d5a8';
    ctx.strokeStyle = col;
    ctx.beginPath(); ctx.arc(R, R, R - 6, -Math.PI / 2, -Math.PI / 2 + fill * TAU); ctx.stroke();
    if (fill >= 0.999) {
      const a = (t * 1.6) % TAU;
      ctx.strokeStyle = 'rgba(255,255,255,.9)';
      ctx.beginPath(); ctx.arc(R, R, R - 6, a, a + 0.55); ctx.stroke();
    }
  }

  _drawMinimap() {
    const ctx = this._mmCtx, S = this._mmCv.width, R = S / 2;
    const mapCv = worldMapCanvas(this.ctx);
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath(); ctx.arc(R, R, R, 0, TAU); ctx.clip();
    const bg = ctx.createLinearGradient(0, 0, 0, S);
    bg.addColorStop(0, '#16233d'); bg.addColorStop(1, '#0a1424');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S);
    if (mapCv) {
      const pos = this._playerPos();
      const half = WORLD.size / 2;
      const viewM = 170;
      const scale = (S / 2) / viewM;
      const dx = R + (-half - pos.x) * scale;
      const dy = R + (-half - pos.z) * scale;
      const dw = WORLD.size * scale;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(mapCv, dx, dy, dw, dw);
      if (this.ctx.enemies && this.ctx.enemies.enemies) {
        for (const e of this.ctx.enemies.enemies) {
          const p = e.root && e.root.position;
          if (!p) continue;
          const ex = R + (p.x - pos.x) * scale, ey = R + (p.z - pos.z) * scale;
          if (ex < 2 || ex > S - 2 || ey < 2 || ey > S - 2) continue;
          ctx.fillStyle = '#ff5a5a'; ctx.beginPath(); ctx.arc(ex, ey, 2.6, 0, TAU); ctx.fill();
        }
      }
    }
    drawPlayerArrow(ctx, R, R, 8, '#ffd76a');
    ctx.restore();
    ctx.strokeStyle = 'rgba(232,213,168,.75)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(R, R, R - 1, 0, TAU); ctx.stroke();
    const pos = this._playerPos();
    const r = regionAt(pos.x, pos.z);
    this._mmName.textContent = r ? r.name : '提瓦特';
    let weather = '';
    try { weather = (this.ctx.weather && this.ctx.weather.cur && this.ctx.weather.cur.name) || (this.ctx.weather && this.ctx.weather.name) || ''; } catch (e) {}
    this._mmWeather.textContent = weather || '';
    this._mmWeather.style.display = weather ? '' : 'none';
  }

  update(dt) {
    // HP ghost catch-up
    const target = clamp(this.hp.cur / this.hp.max, 0, 1);
    this.hp.ghost = damp(this.hp.ghost, target, 2.6, dt);
    this._hpGhost.style.width = (this.hp.ghost * 100).toFixed(2) + '%';
    if (this.hp.hurt > 0) { this.hp.hurt -= dt; this._hpbar.classList.toggle('hurt', this.hp.hurt > 0); }
    // stamina
    this._drawStamina();
    // skills
    this._drawSkillCd(this._skEcd, this.skills[0]);
    this._drawSkillCd(this._skQcd, this.skills[1]);
    const energy = this._energy !== undefined ? this._energy : (this.skills[1].cd <= 0 ? 1 : clamp((this.skills[1].total - this.skills[1].cd) / this.skills[1].total, 0, 1));
    this._drawBurstEnergy(this._skQen, energy, this.party[this.active].element, this.ctx.time ? this.ctx.time.elapsed : performance.now() / 1000);
    // minimap
    this._drawMinimap();
  }
}
