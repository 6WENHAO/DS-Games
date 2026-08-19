// ---------------------------------------------------------------------------
// 界面：主菜单 / 设置 / 购买菜单 / 记分板 / 结算
// ---------------------------------------------------------------------------

import { MAP_LIST } from '../game/maps/index.js';
import { BUY_MENU, WEAPONS, GRENADES, GEAR } from '../game/weapondata.js';
import { DIFFICULTY } from '../game/bots.js';
import { escapeHtml } from './hud.js';

const $ = (id) => document.getElementById(id);

export const DEFAULT_SETTINGS = {
  sensitivity: 2.2,
  invertY: false,
  rawInput: true,
  fov: 90,
  viewmodelFov: 68,
  masterVolume: 0.8,
  sfxVolume: 1.0,
  shadows: true,
  shadowStrength: 0.78,
  radarRotate: true,
  radarZoom: 62,
  crosshairColor: '#35ff6a',
  crosshairSize: 7,
  crosshairGap: 3,
  crosshairThick: 2,
  crosshairDot: false,
  showPerf: false,
  viewmodel: true,
  autoBuy: false,
  bloodEnabled: true,
};

export function loadSettings() {
  const s = Object.assign({}, DEFAULT_SETTINGS);
  try {
    const raw = localStorage.getItem('csgoweb.settings');
    if (raw) Object.assign(s, JSON.parse(raw));
  } catch (e) { /* 忽略 */ }
  return s;
}
export function saveSettings(s) {
  try { localStorage.setItem('csgoweb.settings', JSON.stringify(s)); } catch (e) { /* 忽略 */ }
}

export class Menus {
  constructor(game) {
    this.game = game;
    this.config = {
      map: 'dust2', mode: 'competitive', bots: 4, difficulty: 'normal', team: 't',
    };
    try {
      const raw = localStorage.getItem('csgoweb.config');
      if (raw) Object.assign(this.config, JSON.parse(raw));
    } catch (e) { /* 忽略 */ }
    this.buyCat = 0;
    this.buyOpen = false;
    this._buyLevel = 'cats';
    this.buildMain();
    this.buildSettings();
  }

  saveConfig() {
    try { localStorage.setItem('csgoweb.config', JSON.stringify(this.config)); } catch (e) {}
  }

  // ======================= 主菜单 =========================================

  buildMain() {
    const c = this.config;
    const modeOpts = [
      ['competitive', '竞技 MR12'],
      ['casual', '休闲 MR8'],
      ['deathmatch', '死斗'],
    ];
    $('menu-body').innerHTML = `
      <div class="card">
        <h3>选择地图</h3>
        <div class="map-grid" id="map-grid">
          ${MAP_LIST.map((m) => `
            <div class="map-card${c.map === m.id ? ' sel' : ''}" data-map="${m.id}">
              <div class="mn">${escapeHtml(m.map.nameCN)}</div>
              <div class="mid2">${escapeHtml(m.map.id)}</div>
              <div class="md">${escapeHtml(m.desc)}</div>
            </div>`).join('')}
        </div>
        <div style="margin-top:14px" class="help">
          <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 移动 · <kbd>空格</kbd> 跳 · <kbd>Ctrl</kbd> 蹲 · <kbd>Shift</kbd> 静步<br>
          <kbd>鼠标左键</kbd> 射击 · <kbd>右键</kbd> 开镜/连发 · <kbd>R</kbd> 换弹 · <kbd>1</kbd>~<kbd>5</kbd> 切换武器<br>
          <kbd>B</kbd> 购买菜单 · <kbd>E</kbd> 长按下包/拆包 · <kbd>G</kbd> 丢弃武器 · <kbd>Tab</kbd> 记分板<br>
          <kbd>Q</kbd> 上一把武器 · <kbd>4</kbd> 循环手雷 · <kbd>X</kbd> 电枪 · <kbd>Esc</kbd> 菜单
        </div>
      </div>
      <div class="card">
        <h3>比赛设置</h3>
        <div class="opt-row"><span class="lbl">模式</span>
          <div class="seg" id="seg-mode">
            ${modeOpts.map(([v, t]) => `<button data-v="${v}" class="${c.mode === v ? 'on' : ''}">${t}</button>`).join('')}
          </div>
        </div>
        <div class="opt-row"><span class="lbl">每队 Bot 数</span>
          <div class="seg" id="seg-bots">
            ${[1, 2, 3, 4, 5, 7].map((n) => `<button data-v="${n}" class="${c.bots === n ? 'on' : ''}">${n}</button>`).join('')}
          </div>
        </div>
        <div class="opt-row"><span class="lbl">Bot 难度</span>
          <div class="seg" id="seg-diff">
            ${Object.entries(DIFFICULTY).map(([k, v]) => `<button data-v="${k}" class="${c.difficulty === k ? 'on' : ''}">${v.name}</button>`).join('')}
          </div>
        </div>
        <div class="opt-row"><span class="lbl">我的阵营</span>
          <div class="seg" id="seg-team">
            <button data-v="t" class="${c.team === 't' ? 'on' : ''}">恐怖分子</button>
            <button data-v="ct" class="${c.team === 'ct' ? 'on' : ''}">反恐精英</button>
            <button data-v="random" class="${c.team === 'random' ? 'on' : ''}">随机</button>
          </div>
        </div>
        <div class="btn-row" style="margin-top:18px">
          <button class="big" id="btn-start">开始游戏</button>
          <button class="ghost" id="btn-settings">设置</button>
        </div>
        <div class="credit" style="margin-top:16px">
          纯前端实现：自研 WebGL2 渲染 · 程序化贴图与音效 · 自动导航网格 Bot AI<br>
          共 ${Object.keys(WEAPONS).length} 把武器 · ${MAP_LIST.length} 张地图
        </div>
      </div>`;

    $('map-grid').addEventListener('click', (e) => {
      const card = e.target.closest('.map-card');
      if (!card) return;
      this.config.map = card.dataset.map;
      for (const el of $('map-grid').children) el.classList.toggle('sel', el === card);
      this.game.audio.play('ui_click', { bus: 'ui' });
      const m = MAP_LIST.find((x) => x.id === this.config.map);
      if (m && !m.bomb && this.config.mode !== 'deathmatch') this.setSeg('seg-mode', 'mode', 'deathmatch');
      this.saveConfig();
    });
    const segs = [['seg-mode', 'mode'], ['seg-bots', 'bots'], ['seg-diff', 'difficulty'], ['seg-team', 'team']];
    for (const [id, key] of segs) {
      $(id).addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        const v = key === 'bots' ? parseInt(b.dataset.v, 10) : b.dataset.v;
        this.config[key] = v;
        for (const el of $(id).children) el.classList.toggle('on', el === b);
        this.game.audio.play('ui_click', { bus: 'ui' });
        this.saveConfig();
      });
    }
    $('btn-start').addEventListener('click', () => {
      this.game.audio.play('ui_click', { bus: 'ui' });
      this.game.startMatch(this.config);
    });
    $('btn-settings').addEventListener('click', () => {
      this.game.audio.play('ui_click', { bus: 'ui' });
      this.showSettings(true);
    });
  }

  setSeg(id, key, v) {
    this.config[key] = v;
    const el = $(id);
    if (!el) return;
    for (const b of el.children) b.classList.toggle('on', b.dataset.v === String(v));
    this.saveConfig();
  }

  showMain(show) {
    $('menu').classList.toggle('hidden', !show);
    if (show) $('settings').classList.add('hidden');
  }
  get mainOpen() { return !$('menu').classList.contains('hidden'); }

  // ======================= 设置 ===========================================

  buildSettings() {
    const s = this.game.settings;
    const row = (label, ctrl) => `<div class="opt-row"><span class="lbl">${label}</span><span style="display:flex;align-items:center;gap:8px">${ctrl}</span></div>`;
    const range = (id, min, max, step, val, unit = '') =>
      `<input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}">
       <span class="val" id="${id}-v">${val}${unit}</span>`;
    const toggle = (id, val) => `<span class="seg" id="${id}">
        <button data-v="1" class="${val ? 'on' : ''}">开</button>
        <button data-v="0" class="${!val ? 'on' : ''}">关</button></span>`;

    $('settings-body').innerHTML = `
      <div class="group"><h3>鼠标</h3>
        ${row('灵敏度', range('set-sens', 0.3, 8, 0.1, s.sensitivity))}
        ${row('垂直反转', toggle('set-invert', s.invertY))}
        ${row('原始输入（关闭系统加速）', toggle('set-raw', s.rawInput))}
      </div>
      <div class="group"><h3>画面</h3>
        ${row('视野 FOV', range('set-fov', 70, 110, 1, s.fov, '°'))}
        ${row('第一人称模型 FOV', range('set-vmfov', 54, 90, 1, s.viewmodelFov, '°'))}
        ${row('显示第一人称模型', toggle('set-vm', s.viewmodel))}
        ${row('阴影', toggle('set-shadow', s.shadows))}
        ${row('阴影强度', range('set-shadowstr', 0, 1, 0.02, s.shadowStrength))}
        ${row('血液特效', toggle('set-blood', s.bloodEnabled))}
        ${row('显示性能信息', toggle('set-perf', s.showPerf))}
      </div>
      <div class="group"><h3>声音</h3>
        ${row('主音量', range('set-master', 0, 1, 0.02, s.masterVolume))}
        ${row('音效音量', range('set-sfx', 0, 1, 0.02, s.sfxVolume))}
      </div>
      <div class="group"><h3>准星</h3>
        ${row('颜色', `<input type="color" id="set-chcolor" value="${s.crosshairColor}">`)}
        ${row('长度', range('set-chsize', 2, 16, 1, s.crosshairSize))}
        ${row('间隙', range('set-chgap', 0, 14, 1, s.crosshairGap))}
        ${row('粗细', range('set-chthick', 1, 5, 1, s.crosshairThick))}
        ${row('中心点', toggle('set-chdot', s.crosshairDot))}
      </div>
      <div class="group"><h3>雷达</h3>
        ${row('随视角旋转', toggle('set-radarrot', s.radarRotate))}
        ${row('缩放范围', range('set-radarzoom', 30, 120, 2, s.radarZoom, 'm'))}
      </div>
      <div class="btn-row" style="justify-content:center">
        <button class="ghost" id="set-close">返回</button>
        <button class="ghost" id="set-reset">恢复默认</button>
      </div>`;

    const bindRange = (id, key, fmt) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener('input', () => {
        const v = parseFloat(el.value);
        this.game.settings[key] = v;
        $(id + '-v').textContent = fmt ? fmt(v) : v;
        this.game.applySettings();
      });
    };
    bindRange('set-sens', 'sensitivity');
    bindRange('set-fov', 'fov', (v) => v + '°');
    bindRange('set-vmfov', 'viewmodelFov', (v) => v + '°');
    bindRange('set-shadowstr', 'shadowStrength');
    bindRange('set-master', 'masterVolume');
    bindRange('set-sfx', 'sfxVolume');
    bindRange('set-chsize', 'crosshairSize');
    bindRange('set-chgap', 'crosshairGap');
    bindRange('set-chthick', 'crosshairThick');
    bindRange('set-radarzoom', 'radarZoom', (v) => v + 'm');

    const bindToggle = (id, key) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        this.game.settings[key] = b.dataset.v === '1';
        for (const x of el.children) x.classList.toggle('on', x === b);
        this.game.applySettings();
      });
    };
    bindToggle('set-invert', 'invertY');
    bindToggle('set-raw', 'rawInput');
    bindToggle('set-shadow', 'shadows');
    bindToggle('set-vm', 'viewmodel');
    bindToggle('set-perf', 'showPerf');
    bindToggle('set-chdot', 'crosshairDot');
    bindToggle('set-radarrot', 'radarRotate');
    bindToggle('set-blood', 'bloodEnabled');
    $('set-chcolor').addEventListener('input', (e) => {
      this.game.settings.crosshairColor = e.target.value;
      this.game.applySettings();
    });
    $('set-close').addEventListener('click', () => this.showSettings(false));
    $('set-reset').addEventListener('click', () => {
      Object.assign(this.game.settings, DEFAULT_SETTINGS);
      this.game.applySettings();
      this.buildSettings();
    });
  }

  showSettings(show) {
    $('settings').classList.toggle('hidden', !show);
    if (show) {
      $('menu').classList.add('hidden');
      this.buildSettings();
    } else if (!this.game.running) {
      $('menu').classList.remove('hidden');
    }
  }
  get settingsOpen() { return !$('settings').classList.contains('hidden'); }

  // ======================= 购买菜单 =======================================

  toggleBuy(force) {
    const open = force === undefined ? !this.buyOpen : force;
    this.buyOpen = open;
    $('buymenu').classList.toggle('hidden', !open);
    if (open) { this._buyLevel = 'cats'; this.renderBuy(); }
    return open;
  }

  renderBuy() {
    const g = this.game;
    const p = g.localPlayer;
    const cats = BUY_MENU;
    $('buy-money').textContent = Math.round(p.money);
    const catHtml = cats.map((c, i) =>
      `<div class="cat${i === this.buyCat ? ' active' : ''}" data-i="${i}"><kbd>${c.key}</kbd>${escapeHtml(c.nameCN)}</div>`).join('');
    const cat = cats[this.buyCat];
    const items = cat.items.filter((id) => {
      const d = WEAPONS[id] || GRENADES[id] || GEAR[id];
      if (!d) return false;
      const team = d.team || 'both';
      return team === 'both' || team === p.team;
    });
    const itemHtml = items.map((id, i) => {
      const d = WEAPONS[id] || GRENADES[id] || GEAR[id];
      const price = d.price || 0;
      const can = g.canBuy(p, id);
      const owned = g.alreadyOwns(p, id);
      const w = WEAPONS[id];
      const stats = w
        ? `<span>伤害 ${w.damage}</span><span>${w.rpm} 发/分</span><span>穿甲 ${Math.round((w.armorPen || 0) * 100)}%</span>`
        : (GRENADES[id]
          ? `<span>${GRENADES[id].damage ? '伤害 ' + GRENADES[id].damage : (GRENADES[id].duration ? '持续 ' + GRENADES[id].duration + ' 秒' : '战术道具')}</span>`
          : (GEAR[id] ? `<span>${GEAR[id].helmet ? '含头盔' : (GEAR[id].armor ? '护甲 100' : '拆弹更快')}</span>` : ''));
      return `<div class="buy-item${can ? '' : ' cant'}${owned ? ' owned' : ''}" data-id="${id}">
        <div class="n">${escapeHtml(d.name)}</div>
        <div class="cn">${escapeHtml(d.nameCN || '')}</div>
        <div class="p">$${price}</div>
        <div class="stats">${stats}</div>
        ${i < 9 ? `<kbd>${i + 1}</kbd>` : ''}
      </div>`;
    }).join('');
    $('buy-body').innerHTML = `<div id="buy-cats">${catHtml}</div><div id="buy-items">${itemHtml}</div>`;
    this.currentBuyItems = items;

    $('buy-cats').addEventListener('click', (e) => {
      const c = e.target.closest('.cat');
      if (!c) return;
      this.buyCat = parseInt(c.dataset.i, 10);
      this._buyLevel = 'items';
      this.game.audio.play('ui_hover', { bus: 'ui' });
      this.renderBuy();
    });
    $('buy-items').addEventListener('click', (e) => {
      const it = e.target.closest('.buy-item');
      if (!it) return;
      this.game.buy(this.game.localPlayer, it.dataset.id);
      this.renderBuy();
    });
  }

  /** 数字键：先选类别，再选物品 */
  buyKey(n) {
    if (this._buyLevel !== 'items') {
      if (n <= BUY_MENU.length) {
        this.buyCat = n - 1;
        this._buyLevel = 'items';
        this.game.audio.play('ui_hover', { bus: 'ui' });
        this.renderBuy();
      }
      return;
    }
    const id = (this.currentBuyItems || [])[n - 1];
    if (id) {
      this.game.buy(this.game.localPlayer, id);
      this.renderBuy();
    }
  }
  backBuyLevel() {
    if (this._buyLevel === 'items') { this._buyLevel = 'cats'; return true; }
    return false;
  }

  // ======================= 记分板 =========================================

  showScoreboard(show) {
    $('scoreboard').classList.toggle('hidden', !show);
    if (show) this.renderScoreboard();
  }

  renderScoreboard() {
    const g = this.game;
    const m = g.match;
    $('sb-title').textContent = `${g.map.nameCN} · ${m.score.t} : ${m.score.ct}` +
      (m.overtimeNum ? `  (加时 ${m.overtimeNum})` : '');
    const team = (id, label) => {
      const list = g.players.filter((p) => p.team === id)
        .sort((a, b) => (b.score - a.score) || (b.kills - a.kills) || (a.deaths - b.deaths));
      return `<div class="sb-team ${id}">
        <div class="title">${label} <span class="tag">${m.score[id]} 分 · 存活 ${list.filter((p) => p.alive).length}/${list.length}</span></div>
        <div class="head"><span>玩家</span><span>击杀</span><span>助攻</span><span>死亡</span><span>金钱</span><span>MVP</span></div>
        ${list.map((p) => `<div class="row${p.isLocal ? ' me' : ''}${p.alive ? '' : ' dead'}">
          <span>${escapeHtml(p.name)}${p.isBot ? '<span class="tag">BOT</span>' : ''}${p.inv.c4 ? '<span class="tag" style="color:var(--t)">C4</span>' : ''}</span>
          <span class="num">${p.kills}</span><span class="num">${p.assists}</span><span class="num">${p.deaths}</span>
          <span class="num">$${Math.round(p.money)}</span><span class="num">${p.mvps || ''}</span>
        </div>`).join('')}
      </div>`;
    };
    $('sb-body').innerHTML = team('t', '恐怖分子') + team('ct', '反恐精英');
  }

  // ======================= 结算 ===========================================

  showGameOver(winner) {
    const g = this.game;
    const names = { t: '恐怖分子胜利', ct: '反恐精英胜利', draw: '平局' };
    const color = winner === 't' ? 'var(--t)' : winner === 'ct' ? 'var(--ct)' : '#fff';
    const top = [...g.players].sort((a, b) => (b.kills - a.kills) || (b.score - a.score)).slice(0, 6);
    $('menu-body').innerHTML = `
      <div class="card" style="grid-column:1/-1;text-align:center">
        <div style="font-size:34px;font-weight:800;letter-spacing:3px;color:${color}">${names[winner] || '比赛结束'}</div>
        <div style="font-family:var(--mono);font-size:44px;margin:10px 0">${g.match.score.t} : ${g.match.score.ct}</div>
        <div class="help" style="margin:14px auto;max-width:560px;text-align:left">
          ${top.map((p, i) => `${i + 1}. <b style="color:${p.team === 't' ? 'var(--t)' : 'var(--ct)'}">${escapeHtml(p.name)}</b>
            — ${p.kills} 击杀 / ${p.deaths} 死亡 / ${p.mvps || 0} MVP${p.isLocal ? '（你）' : ''}`).join('<br>')}
        </div>
        <div class="btn-row" style="justify-content:center">
          <button class="big" id="btn-again">再来一局</button>
          <button class="ghost" id="btn-menu">返回主菜单</button>
        </div>
      </div>`;
    $('menu').classList.remove('hidden');
    $('btn-again').addEventListener('click', () => this.game.startMatch(this.config));
    $('btn-menu').addEventListener('click', () => { this.buildMain(); this.showMain(true); });
  }
}
