// ---------------------------------------------------------------------------
// HUD：血量/护甲/金钱/弹药/比分/计时/击杀提示/雷达/准星/受伤指示
// ---------------------------------------------------------------------------

import { activeId, activeDef, ammoText, currentSpread, totalGrenades } from '../game/weapons.js';
import { WEAPONS, GRENADES } from '../game/weapondata.js';
import { clamp, lerp, DEG, vdistXZ } from '../core/math.js';
import { PHASE } from '../game/match.js';

const $ = (id) => document.getElementById(id);

const GRENADE_ICON = { he: '✹', flash: '✦', smoke: '☁', molotov: '🔥', incgrenade: '🔥', decoy: '◈' };

export class Radar {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mapImg = null;
    this.span = 62;         // 雷达可见范围（米）
    this.rotate = true;
  }

  /** 预渲染地图俯视图 */
  build(map) {
    const b = map.bounds;
    const w = b.max[0] - b.min[0], h = b.max[2] - b.min[2];
    const px = 1024;
    const scale = px / Math.max(w, h);
    const cv = document.createElement('canvas');
    cv.width = Math.round(w * scale);
    cv.height = Math.round(h * scale);
    const c = cv.getContext('2d');
    const X = (x) => (x - b.min[0]) * scale;
    const Z = (z) => (z - b.min[2]) * scale;

    // 地面
    c.fillStyle = 'rgba(120, 132, 145, 0.30)';
    for (const br of map.brushes) {
      if (br.max[1] > 1.0 || br.max[1] < -1.5) continue;
      c.fillRect(X(br.min[0]), Z(br.min[2]), (br.max[0] - br.min[0]) * scale, (br.max[2] - br.min[2]) * scale);
    }
    // 墙（在玩家高度处遮挡视线的实体）
    c.fillStyle = 'rgba(16, 22, 28, 0.92)';
    for (const br of map.brushes) {
      if (br.max[1] < 1.1 || br.min[1] > 2.2) continue;
      c.fillRect(X(br.min[0]), Z(br.min[2]), (br.max[0] - br.min[0]) * scale, (br.max[2] - br.min[2]) * scale);
    }
    // 台阶/平台（半高）
    c.fillStyle = 'rgba(150, 160, 172, 0.22)';
    for (const br of map.brushes) {
      if (br.max[1] <= 1.0 || br.max[1] > 2.4 || br.min[1] < -0.5) continue;
      c.fillRect(X(br.min[0]), Z(br.min[2]), (br.max[0] - br.min[0]) * scale, (br.max[2] - br.min[2]) * scale);
    }
    // 包点
    c.font = 'bold 44px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const s of map.bombsites || []) {
      const cx = X((s.min[0] + s.max[0]) / 2), cz = Z((s.min[2] + s.max[2]) / 2);
      c.strokeStyle = 'rgba(233, 161, 59, 0.65)';
      c.lineWidth = 3;
      c.strokeRect(X(s.min[0]), Z(s.min[2]), (s.max[0] - s.min[0]) * scale, (s.max[2] - s.min[2]) * scale);
      c.fillStyle = 'rgba(233, 161, 59, 0.85)';
      c.fillText(s.name, cx, cz);
    }
    this.mapImg = cv;
    this.mapScale = scale;
    this.mapMin = [b.min[0], b.min[2]];
  }

  draw(game) {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    const me = game.viewPlayer || game.localPlayer;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    // 圆形裁剪
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(8, 12, 16, 0.62)';
    ctx.fillRect(0, 0, W, H);

    const ppm = W / this.span;    // 每米像素
    ctx.translate(W / 2, H / 2);
    const theta = this.rotate ? -(me.yaw + Math.PI / 2) : 0;
    ctx.rotate(theta);
    ctx.scale(ppm, ppm);
    ctx.translate(-me.pos[0], -me.pos[2]);

    if (this.mapImg) {
      const s = 1 / this.mapScale;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.mapImg, this.mapMin[0], this.mapMin[1], this.mapImg.width * s, this.mapImg.height * s);
    }

    // 烟雾
    for (const sm of game.effects.smokes) {
      const d = game.effects._smokeDensity(sm);
      if (d <= 0.05) continue;
      ctx.fillStyle = `rgba(215, 220, 226, ${0.30 * d})`;
      ctx.beginPath();
      ctx.arc(sm.pos[0], sm.pos[2], sm.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    // 火
    for (const f of game.effects.fires) {
      ctx.fillStyle = 'rgba(230, 110, 40, 0.35)';
      ctx.beginPath();
      ctx.arc(f.pos[0], f.pos[2], f.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // 玩家
    const drawDot = (p, color, size, showDir) => {
      ctx.save();
      ctx.translate(p.pos[0], p.pos[2]);
      ctx.rotate(p.yaw);
      ctx.fillStyle = color;
      if (showDir) {
        ctx.beginPath();
        ctx.moveTo(size * 1.7, 0);
        ctx.lineTo(-size, size * 0.95);
        ctx.lineTo(-size * 0.4, 0);
        ctx.lineTo(-size, -size * 0.95);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    for (const p of game.players) {
      if (!p.alive) continue;
      const mine = p.team === me.team;
      if (!mine && !game.isSpotted(p)) continue;
      const color = mine ? (p === me ? '#ffffff' : (p.team === 't' ? '#e9a13b' : '#5fa8e8')) : '#e05d4a';
      const dy = p.pos[1] - me.pos[1];
      const size = 0.85 * (Math.abs(dy) > 2.5 ? 0.65 : 1);
      drawDot(p, color, size, true);
      if (mine && p !== me) {
        ctx.save();
        ctx.translate(p.pos[0], p.pos[2]);
        ctx.rotate(-theta);
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.font = '1.5px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(game.players.indexOf(p) + 1), 0, -1.4);
        ctx.restore();
      }
    }

    // 炸弹
    const m = game.match;
    if (m.bombPlanted && m.bombPos) {
      const blink = (game.time * 3) % 1 > 0.45;
      ctx.fillStyle = blink ? '#ff4530' : '#7a1b12';
      ctx.beginPath();
      ctx.arc(m.bombPos[0], m.bombPos[2], 1.15, 0, Math.PI * 2);
      ctx.fill();
    } else if (m.bombDropped) {
      ctx.fillStyle = '#e9a13b';
      ctx.fillRect(m.bombDropped.pos[0] - 0.5, m.bombDropped.pos[2] - 0.35, 1.0, 0.7);
    } else {
      const carrier = game.players.find((p) => p.alive && p.inv.c4);
      if (carrier && carrier.team === me.team) {
        ctx.strokeStyle = '#e9a13b';
        ctx.lineWidth = 0.22;
        ctx.beginPath();
        ctx.arc(carrier.pos[0], carrier.pos[2], 1.4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();

    // 外框
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
    // 视野扇形
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
    ctx.beginPath();
    ctx.moveTo(W / 2, H / 2);
    ctx.arc(W / 2, H / 2, W * 0.34, -Math.PI / 2 - 0.62, -Math.PI / 2 + 0.62);
    ctx.closePath();
    ctx.stroke();
  }
}

export class HUD {
  constructor(game) {
    this.game = game;
    this.radar = new Radar($('radar'));
    this.el = {
      health: $('health'), armor: $('armor'), helmet: $('helmet-ico'),
      money: $('money-val'), moneyDelta: $('money-delta'),
      ammoMag: $('ammo-mag'), ammoRes: $('ammo-res'), ammo: $('ammo'),
      weaponName: $('weapon-name'), inventory: $('inventory'), grenades: $('grenade-row'),
      scoreT: $('score-t'), scoreCT: $('score-ct'), aliveT: $('alive-t'), aliveCT: $('alive-ct'),
      timer: $('timer'), roundInfo: $('round-info'), location: $('location'),
      killfeed: $('killfeed'), notify: $('notify-wrap'), center: $('center-msg'),
      progress: $('progress-wrap'), progressLabel: $('progress-label'),
      progressBar: $('progress-bar').firstElementChild,
      hint: $('hint'), bomb: $('bomb-status'), spectate: $('spectate'),
      crosshair: $('crosshair'), hitmarker: $('hitmarker'), flash: $('flash-overlay'),
      hurt: $('hurt-vignette'), scope: $('scope'), banner: $('round-banner'),
      dirs: $('damage-dirs'), perf: $('perf'), objective: $('objective'),
      hudRoot: $('hud'),
    };
    this.hitTimer = 0;
    this.hurtTimer = 0;
    this.notifications = [];
    this.dmgDirs = [];
    this.lastMoney = 0;
    this.bannerTimer = 0;
  }

  buildRadar(map) { this.radar.build(map); }

  // --------------------------- 事件 ---------------------------------------

  killFeed(attackerName, attackerTeam, victimName, victimTeam, weaponName, headshot, involvesMe) {
    const div = document.createElement('div');
    div.className = 'kf' + (involvesMe ? ' me' : '');
    const a = attackerName
      ? `<span class="${attackerTeam}">${escapeHtml(attackerName)}</span>`
      : '<span style="opacity:.7">世界</span>';
    div.innerHTML = `${a}<span class="w">${escapeHtml(weaponName)}${headshot ? ' <span class="hs">✖</span>' : ''}</span><span class="${victimTeam}">${escapeHtml(victimName)}</span>`;
    this.el.killfeed.appendChild(div);
    setTimeout(() => div.remove(), 7000);
    while (this.el.killfeed.children.length > 6) this.el.killfeed.firstChild.remove();
  }

  notify(text, dur = 2.6, team) {
    const div = document.createElement('div');
    div.className = 'nt' + (team ? ' ' + team : '');
    div.textContent = text;
    this.el.notify.appendChild(div);
    setTimeout(() => {
      div.style.transition = 'opacity .4s';
      div.style.opacity = '0';
      setTimeout(() => div.remove(), 400);
    }, dur * 1000);
    while (this.el.notify.children.length > 5) this.el.notify.firstChild.remove();
  }

  center(text, dur = 1.6) {
    this.el.center.textContent = text;
    this.el.center.classList.add('show');
    clearTimeout(this._centerT);
    this._centerT = setTimeout(() => this.el.center.classList.remove('show'), dur * 1000);
  }

  banner(text, sub, color) {
    const el = this.el.banner;
    el.innerHTML = `<div style="color:${color || '#fff'}">${escapeHtml(text)}</div>` +
      (sub ? `<div class="sub">${escapeHtml(sub)}</div>` : '');
    el.classList.remove('hidden');
    this.bannerTimer = 4.2;
  }
  hideBanner() { this.el.banner.classList.add('hidden'); }

  hit(kill) {
    this.el.hitmarker.classList.add('show');
    this.el.hitmarker.classList.toggle('kill', !!kill);
    this.hitTimer = kill ? 0.4 : 0.16;
  }

  hurt(amount, worldAngleFromMe) {
    this.hurtTimer = Math.max(this.hurtTimer, clamp(amount / 60, 0.18, 1));
    if (worldAngleFromMe !== undefined && worldAngleFromMe !== null) {
      const div = document.createElement('div');
      div.className = 'dd';
      div.style.transform = `rotate(${worldAngleFromMe * 180 / Math.PI}deg) translateY(-130px)`;
      this.el.dirs.appendChild(div);
      this.dmgDirs.push({ el: div, t: 1.1 });
    }
  }

  showProgress(label, frac) {
    this.el.progress.classList.remove('hidden');
    this.el.progressLabel.textContent = label;
    this.el.progressBar.style.width = (clamp(frac, 0, 1) * 100).toFixed(1) + '%';
  }
  hideProgress() { this.el.progress.classList.add('hidden'); }

  setHint(text) {
    if (!text) { this.el.hint.classList.add('hidden'); return; }
    this.el.hint.classList.remove('hidden');
    this.el.hint.innerHTML = text;
  }

  // --------------------------- 每帧 ---------------------------------------

  update(dt) {
    const g = this.game;
    const me = g.viewPlayer || g.localPlayer;
    const m = g.match;
    const el = this.el;

    // 血量护甲
    el.health.textContent = Math.max(0, Math.ceil(me.health));
    el.health.parentElement.classList.toggle('low', me.health <= 35);
    el.armor.textContent = Math.max(0, Math.round(me.armor));
    el.helmet.classList.toggle('on', !!me.helmet);

    // 金钱
    const money = Math.round(me.money);
    if (money !== this.lastMoney) {
      const d = money - this.lastMoney;
      if (this.lastMoney !== 0) {
        el.moneyDelta.textContent = (d > 0 ? '+' : '') + d;
        el.moneyDelta.classList.toggle('neg', d < 0);
        el.moneyDelta.classList.add('show');
        clearTimeout(this._moneyT);
        this._moneyT = setTimeout(() => el.moneyDelta.classList.remove('show'), 1400);
      }
      this.lastMoney = money;
      el.money.textContent = money;
      const bm = $('buy-money');
      if (bm) bm.textContent = money;
    }

    // 武器
    const def = activeDef(me);
    const id = activeId(me);
    el.weaponName.textContent = def ? (def.nameCN || def.name || '') : '';
    const a = me.ammo[id];
    if (def && def.class === 'grenade') {
      el.ammoMag.textContent = String(me.inv.grenades[id] || 0);
      el.ammoRes.textContent = '';
      el.ammo.querySelector('.sep').style.opacity = '0';
    } else if (a) {
      el.ammoMag.textContent = a.mag;
      el.ammoRes.textContent = a.reserve;
      el.ammo.querySelector('.sep').style.opacity = '';
      el.ammo.classList.toggle('empty', a.mag === 0);
    } else {
      el.ammoMag.textContent = '';
      el.ammoRes.textContent = '';
      el.ammo.querySelector('.sep').style.opacity = '0';
    }

    // 槽位
    const slots = [];
    if (me.inv.primary) slots.push(['1', WEAPONS[me.inv.primary].nameCN, 'primary']);
    if (me.inv.secondary) slots.push(['2', WEAPONS[me.inv.secondary].nameCN, 'secondary']);
    slots.push(['3', '刀', 'melee']);
    if (totalGrenades(me)) slots.push(['4', '手雷', 'grenade']);
    if (me.inv.c4) slots.push(['5', 'C4', 'c4']);
    if (me.inv.zeus) slots.push(['X', '电枪', 'zeus']);
    const sig = slots.map((s) => s[0] + s[1]).join('|') + '#' + me.active;
    if (sig !== this._slotSig) {
      this._slotSig = sig;
      el.inventory.innerHTML = slots.map((s) => {
        const active = me.active === s[2] || (s[2] === 'grenade' && me.active.startsWith('grenade:'));
        return `<div class="slot${active ? ' active' : ''}">${s[0]} ${escapeHtml(s[1])}</div>`;
      }).join('');
      // 手雷图标
      const gs = Object.keys(me.inv.grenades).filter((k) => me.inv.grenades[k] > 0);
      el.grenades.innerHTML = gs.map((k) => {
        const act = me.active === 'grenade:' + k;
        return `<div class="gr${act ? ' active' : ''}" title="${escapeHtml(GRENADES[k].nameCN)}">${GRENADE_ICON[k] || '●'}<b>${me.inv.grenades[k]}</b></div>`;
      }).join('');
    }

    // 比分与计时
    el.scoreT.textContent = m.score.t;
    el.scoreCT.textContent = m.score.ct;
    const aliveT = g.players.filter((p) => p.team === 't' && p.alive).length;
    const aliveCT = g.players.filter((p) => p.team === 'ct' && p.alive).length;
    const totT = g.players.filter((p) => p.team === 't').length;
    const totCT = g.players.filter((p) => p.team === 'ct').length;
    el.aliveT.innerHTML = dots(aliveT, totT, 'var(--t)');
    el.aliveCT.innerHTML = dots(aliveCT, totCT, 'var(--ct)');

    const tSec = Math.max(0, m.displayTime);
    el.timer.textContent = `${Math.floor(tSec / 60)}:${String(Math.floor(tSec % 60)).padStart(2, '0')}`;
    el.timer.classList.toggle('urgent', tSec < 11 && m.phase === PHASE.LIVE && !m.bombPlanted);
    el.timer.classList.toggle('bomb', m.bombPlanted);
    let phaseText = '';
    if (m.phase === PHASE.WARMUP) phaseText = '热身';
    else if (m.phase === PHASE.FREEZE) phaseText = '准备阶段 · 可购买';
    else if (m.phase === PHASE.OVER) phaseText = '回合结束';
    else if (m.inBuyTime) phaseText = '可购买';
    el.roundInfo.textContent = g.mode === 'dm'
      ? `死斗 · 击杀 ${me.kills}`
      : `第 ${m.round} 回合${phaseText ? ' · ' + phaseText : ''}`;

    // 位置
    el.location.textContent = g.world.areaName(me.pos) || '';

    // 炸弹状态
    el.bomb.classList.toggle('hidden', !m.bombPlanted);

    // 目标提示
    let obj = '';
    if (g.mode === 'bomb') {
      if (m.bombPlanted) obj = me.team === 'ct' ? '拆除炸弹！' : '守住炸弹！';
      else if (me.team === 't') obj = me.inv.c4 ? '把 C4 带到包点安放' : '协助队友安放 C4';
      else obj = '阻止 T 安放炸弹';
    }
    el.objective.textContent = obj;

    // 准星散布（物理换算）
    const spread = currentSpread(me);
    const fovY = g.camera.fov * DEG;
    const px = Math.tan(spread) / Math.tan(fovY / 2) * (g.renderer.height / g.renderer.dpr) / 2;
    const gap = clamp(px * 0.85 + g.settings.crosshairGap, 2, 90);
    el.crosshair.style.setProperty('--gap', gap.toFixed(1) + 'px');
    el.crosshair.style.setProperty('--len', g.settings.crosshairSize + 'px');
    el.crosshair.style.setProperty('--thick', g.settings.crosshairThick + 'px');
    el.crosshair.style.opacity = (me.alive && !g.paused && me.wpn.zoom === 0) ? '1' : '0';
    el.crosshair.classList.toggle('dot', g.settings.crosshairDot);
    for (const e of el.crosshair.children) {
      if (e.classList.contains('ch') || e.classList.contains('ch-dot')) e.style.background = g.settings.crosshairColor;
    }

    // 狙击镜
    el.scope.classList.toggle('on', me.wpn.zoom > 0 && me.alive);

    // 闪光
    const f = me.flash;
    el.flash.style.opacity = f > 0 ? String(Math.pow(f, 0.75)) : '0';

    // 受伤
    if (this.hurtTimer > 0) {
      this.hurtTimer -= dt;
      el.hurt.style.opacity = String(clamp(this.hurtTimer, 0, 1) * 0.9);
    } else el.hurt.style.opacity = '0';

    // 命中标记
    if (this.hitTimer > 0) {
      this.hitTimer -= dt;
      if (this.hitTimer <= 0) el.hitmarker.classList.remove('show');
    }

    // 伤害方向
    for (let i = this.dmgDirs.length - 1; i >= 0; i--) {
      const d = this.dmgDirs[i];
      d.t -= dt;
      d.el.style.opacity = String(clamp(d.t, 0, 1));
      if (d.t <= 0) { d.el.remove(); this.dmgDirs.splice(i, 1); }
    }

    // 横幅
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.hideBanner();
    }

    // 观战提示
    const local = g.localPlayer;
    if (!local.alive && m.phase !== PHASE.GAMEOVER) {
      el.spectate.classList.remove('hidden');
      const target = g.viewPlayer && g.viewPlayer !== local ? g.viewPlayer.name : null;
      el.spectate.innerHTML = target
        ? `<div class="big">正在观战：${escapeHtml(target)}</div><div style="font-size:12px;opacity:.75">鼠标左键 / 右键切换视角 · 空格切换自由视角</div>`
        : `<div class="big">你已阵亡</div><div style="font-size:12px;opacity:.75">等待回合结束…</div>`;
    } else el.spectate.classList.add('hidden');

    // 雷达
    this.radar.rotate = g.settings.radarRotate;
    this.radar.span = g.settings.radarZoom;
    this.radar.draw(g);

    // 性能
    if (g.settings.showPerf) {
      el.perf.classList.add('on');
      const s = g.renderer.stats;
      el.perf.textContent =
        `${g.fps.toFixed(0)} FPS  ${(g.frameMs).toFixed(1)}ms\n` +
        `绘制 ${s.drawCalls}  三角 ${(s.tris / 1000).toFixed(1)}k\n` +
        `实体 ${g.players.filter((p) => p.alive).length}  粒子 ${g.effects.particles.filter((p) => p.alive).length}\n` +
        `导航 ${g.nav.nodes.length} 节点`;
    } else el.perf.classList.remove('on');
  }
}

function dots(alive, total, color) {
  let s = '';
  for (let i = 0; i < total; i++) {
    s += `<span style="color:${i < alive ? color : 'rgba(255,255,255,.18)'}">▮</span>`;
  }
  return s;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
