/* ===================================================================
   ui.js — DOM 界面层（中文）：HUD、面板、遗物卡、提示
   =================================================================== */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const U = G.U;

  const $ = id => document.getElementById(id);
  const SCREENS = ['scr-title', 'scr-help', 'scr-creed', 'scr-brief', 'scr-upgrade', 'scr-dead', 'scr-win', 'scr-pause'];

  const UI = {
    game: null,
    el: {},
    current: null,
    prevScreen: null,
    _lastHud: {},
    hintEl: null,
  };

  UI.init = function (game) {
    UI.game = game;
    const e = UI.el;
    ['hud', 'loading', 'click-lock', 'crosshair', 'floor-label', 'objective-label',
      'kill-count', 'soul-count', 'hp-fill', 'hp-text', 'rage-fill', 'rage-text',
      'stam-fill', 'combo-box', 'combo-n', 'relic-list', 'toast-wrap', 'berserk-vig',
      'boss-bar', 'boss-name', 'boss-fill', 'card-row', 'reroll-cost', 'upgrade-souls',
      'btn-reroll', 'brief-depth', 'brief-name', 'brief-desc', 'brief-obj',
      'dead-stats', 'dead-epitaph', 'win-stats', 'pause-relics', 'creed-list',
      'meta-depth', 'meta-kills', 'meta-wins', 'hitmark', 'app'].forEach(id => {
        e[id] = $(id);
      });
    SCREENS.forEach(s => e[s] = $(s));

    // 交互提示
    const h = document.createElement('div');
    h.id = 'interact-hint';
    h.style.cssText = 'position:absolute;left:50%;top:58%;transform:translateX(-50%);' +
      'font-size:13px;color:#e0d2b8;letter-spacing:2px;text-shadow:0 2px 0 #000,0 0 12px #000;' +
      'background:rgba(8,6,9,.6);padding:5px 12px;border-left:3px solid #8e1218;display:none;';
    (e.hud || document.body).appendChild(h);
    UI.hintEl = h;

    // 按钮
    document.querySelectorAll('[data-act]').forEach(btn => {
      btn.addEventListener('click', ev => {
        ev.stopPropagation();
        G.Audio.play('ui');
        game.act(btn.getAttribute('data-act'));
      });
      btn.addEventListener('mouseenter', () => G.Audio.play('ui'));
    });
    if (e['btn-reroll']) e['btn-reroll'].addEventListener('click', ev => {
      ev.stopPropagation(); game.act('reroll');
    });

    // 选项
    const bind = (id, key, isRange) => {
      const el = $(id); if (!el) return;
      el.addEventListener('input', () => {
        game.opts[key] = isRange ? parseFloat(el.value) : el.checked;
        if (key === 'pix') G.GL.setPixelScale(parseInt(el.value, 10));
        game.saveOpts();
      });
    };
    bind('opt-shake', 'shake'); bind('opt-blood', 'blood'); bind('opt-hitstop', 'hitstop');
    bind('opt-sens', 'sens', true); bind('opt-pix', 'pix', true);

    UI.buildCreed();
  };

  UI.applyOpts = function (opts) {
    const set = (id, v, chk) => { const el = $(id); if (el) { if (chk) el.checked = !!v; else el.value = v; } };
    set('opt-shake', opts.shake, true);
    set('opt-blood', opts.blood, true);
    set('opt-hitstop', opts.hitstop, true);
    set('opt-sens', opts.sens);
    set('opt-pix', opts.pix);
  };

  /* --------------------------- 面板切换 --------------------------- */
  UI.show = function (name) {
    SCREENS.forEach(s => { const el = UI.el[s]; if (el) el.classList.add('hidden'); });
    if (name) {
      const el = UI.el['scr-' + name];
      if (el) el.classList.remove('hidden');
    }
    UI.current = name || null;
    UI.setHud(!name || name === 'pause' ? true : false);
  };
  UI.setHud = function (on) {
    if (UI.el.hud) UI.el.hud.classList.toggle('hidden', !on);
  };
  UI.hideLoading = function () { if (UI.el.loading) UI.el.loading.style.display = 'none'; };
  UI.setLoading = function (txt) { if (UI.el.loading) { UI.el.loading.style.display = 'flex'; UI.el.loading.textContent = txt; } };
  UI.showClickLock = function (on) {
    if (UI.el['click-lock']) UI.el['click-lock'].classList.toggle('hidden', !on);
  };

  /* --------------------------- HUD --------------------------- */
  UI.updateHud = function (st) {
    const P = G.Player, e = UI.el;
    const hpF = U.clamp01(P.hp / P.maxHp);
    if (e['hp-fill']) e['hp-fill'].style.width = (hpF * 100).toFixed(1) + '%';
    if (e['hp-text']) e['hp-text'].textContent = Math.ceil(P.hp) + '/' + Math.round(P.maxHp);
    const hpBar = e['hp-fill'] && e['hp-fill'].parentElement;
    if (hpBar) hpBar.classList.toggle('low', hpF < 0.3);

    if (e['rage-fill']) e['rage-fill'].style.width = (U.clamp01(P.rage / P.maxRage) * 100).toFixed(1) + '%';
    if (e['rage-text']) {
      e['rage-text'].textContent = P.berserk > 0
        ? ('狂气 ' + P.berserk.toFixed(1) + 's')
        : (P.rage >= P.maxRage ? '狂气就绪 · 按 F' : '狂气');
    }
    if (e['stam-fill']) e['stam-fill'].style.width = (U.clamp01(P.stamina / P.maxStamina) * 100).toFixed(1) + '%';

    if (e['kill-count']) e['kill-count'].textContent = P.kills;
    if (e['soul-count']) e['soul-count'].textContent = P.souls;
    if (e['floor-label']) e['floor-label'].textContent = '深度 ' + U.roman(st.depth) + ' · ' + st.themeName;
    if (e['objective-label']) e['objective-label'].textContent = st.objectiveText;

    // 连斩
    if (e['combo-box']) {
      const on = P.combo >= 2;
      e['combo-box'].classList.toggle('hidden', !on);
      if (on && e['combo-n']) {
        if (e['combo-n'].textContent !== String(P.combo)) {
          e['combo-n'].textContent = P.combo;
          e['combo-box'].classList.remove('bump');
          void e['combo-box'].offsetWidth;
          e['combo-box'].classList.add('bump');
        }
      }
    }
    if (e['berserk-vig']) e['berserk-vig'].classList.toggle('hidden', P.berserk <= 0);
    if (e.app) e.app.classList.toggle('hurt', P.hp / P.maxHp < 0.25);
    if (e.crosshair) e.crosshair.classList.toggle('hot', !!st.aimHot);
  };

  UI.updateRelics = function () {
    const el = UI.el['relic-list']; if (!el) return;
    const P = G.Player;
    const key = P.relics.map(r => r.id + (r.stacks || 1)).join(',');
    if (UI._relicKey === key) return;
    UI._relicKey = key;
    el.innerHTML = '';
    P.relics.slice(-9).forEach(r => {
      const d = document.createElement('div');
      d.className = 'relic-chip ' + r.tier;
      d.textContent = r.sigil + ' ' + r.name + ((r.stacks || 1) > 1 ? ' ×' + r.stacks : '');
      el.appendChild(d);
    });
  };

  UI.bossBar = function (ent) {
    const e = UI.el;
    if (!e['boss-bar']) return;
    if (!ent) { e['boss-bar'].classList.add('hidden'); return; }
    e['boss-bar'].classList.remove('hidden');
    e['boss-name'].textContent = ent.name + ' · 第 ' + U.roman(ent.phase) + ' 相';
    e['boss-fill'].style.width = (U.clamp01(ent.hp / ent.maxHp) * 100).toFixed(1) + '%';
  };

  UI.toast = function (text, kind) {
    const wrap = UI.el['toast-wrap']; if (!wrap) return;
    const d = document.createElement('div');
    d.className = 'toast' + (kind === 'big' ? ' big' : (kind === 'gold' ? ' gold' : ''));
    d.textContent = text;
    wrap.appendChild(d);
    setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 2200);
    while (wrap.children.length > 5) wrap.removeChild(wrap.firstChild);
  };

  UI.hint = function (text) {
    if (!UI.hintEl) return;
    if (text) { UI.hintEl.textContent = text; UI.hintEl.style.display = 'block'; }
    else UI.hintEl.style.display = 'none';
  };

  UI.hitmark = function () {
    const m = UI.el.hitmark; if (!m) return;
    m.classList.remove('hidden');
    clearTimeout(UI._hmT);
    UI._hmT = setTimeout(() => m.classList.add('hidden'), 90);
  };

  /* --------------------------- 层间简报 --------------------------- */
  UI.showBrief = function (depth, theme, objText, isBoss) {
    const e = UI.el;
    if (e['brief-depth']) e['brief-depth'].textContent = '深 度 ' + U.roman(depth) + (isBoss ? ' · 巢' : '');
    if (e['brief-name']) e['brief-name'].textContent = theme.name;
    if (e['brief-desc']) e['brief-desc'].textContent = theme.desc;
    if (e['brief-obj']) e['brief-obj'].textContent = '目标：' + objText;
    UI.show('brief');
  };

  /* --------------------------- 遗物选择 --------------------------- */
  UI.showUpgrade = function (cards, souls, rerollCost, onPick) {
    const e = UI.el;
    const row = e['card-row'];
    if (!row) return;
    row.innerHTML = '';
    cards.forEach(r => {
      const d = document.createElement('div');
      d.className = 'card ' + r.tier;
      const tierName = r.tier === 'rare' ? '稀 有' : (r.tier === 'curse' ? '诅 咒' : '常 见');
      d.innerHTML =
        '<div class="sigil">' + r.sigil + '</div>' +
        '<h4>' + r.name + '</h4>' +
        '<div class="tier">' + tierName + (r.owned ? ' · 已持有 ×' + r.owned : '') + '</div>' +
        '<p>' + r.desc + '</p>' +
        (r.tier === 'curse' ? '<div class="cost">代价已写在描述里</div>' : '<div class="cost">&nbsp;</div>');
      d.addEventListener('click', () => { G.Audio.play('relic'); onPick(r); });
      d.addEventListener('mouseenter', () => G.Audio.play('ui'));
      row.appendChild(d);
    });
    if (e['upgrade-souls']) e['upgrade-souls'].textContent = souls;
    if (e['reroll-cost']) e['reroll-cost'].textContent = rerollCost;
    if (e['btn-reroll']) e['btn-reroll'].disabled = souls < rerollCost;
    UI.show('upgrade');
  };

  /* --------------------------- 结局面板 --------------------------- */
  function statBlock(el, rows) {
    if (!el) return;
    el.innerHTML = rows.map(r => '<span>' + r[0] + '</span><b>' + r[1] + '</b>').join('');
  }

  const EPITAPHS = [
    '铁块躺在血泊里，仍然朝着前方。',
    '被献祭的东西，从来不止一个。',
    '他挥了很多刀。最后一刀没挥完。',
    '日蚀之下没有英雄，只有还在动的和不动的。',
    '你倒下的地方，很快会长出新的墙。',
    '狂气用尽的那一刻，身体就只是块肉。',
  ];

  UI.showDead = function (info) {
    statBlock(UI.el['dead-stats'], [
      ['抵达深度', U.roman(info.depth) + ' · ' + info.themeName],
      ['屠戮总数', info.kills],
      ['最高连斩', info.bestCombo],
      ['造成伤害', Math.round(info.damage)],
      ['肢块产出', info.gibs],
      ['持有遗物', info.relics],
      ['本轮时长', info.time],
    ]);
    if (UI.el['dead-epitaph'])
      UI.el['dead-epitaph'].textContent = EPITAPHS[(Math.random() * EPITAPHS.length) | 0];
    UI.show('dead');
  };

  UI.showWin = function (info) {
    statBlock(UI.el['win-stats'], [
      ['屠戮总数', info.kills],
      ['最高连斩', info.bestCombo],
      ['造成伤害', Math.round(info.damage)],
      ['肢块产出', info.gibs],
      ['持有遗物', info.relics],
      ['通关时长', info.time],
    ]);
    UI.show('win');
  };

  UI.showPause = function () {
    const el = UI.el['pause-relics'];
    if (el) {
      el.innerHTML = '';
      G.Player.relics.forEach(r => {
        const d = document.createElement('div');
        d.className = 'relic-chip ' + r.tier;
        d.textContent = r.sigil + ' ' + r.name + ((r.stacks || 1) > 1 ? ' ×' + r.stacks : '');
        d.title = r.desc;
        el.appendChild(d);
      });
      if (!G.Player.relics.length) el.innerHTML = '<div class="relic-chip">尚无遗物</div>';
    }
    UI.show('pause');
  };

  UI.updateMeta = function (meta) {
    const e = UI.el;
    if (e['meta-depth']) e['meta-depth'].textContent = meta.bestDepth ? ('深度 ' + U.roman(meta.bestDepth)) : '—';
    if (e['meta-kills']) e['meta-kills'].textContent = meta.totalKills || 0;
    if (e['meta-wins']) e['meta-wins'].textContent = meta.wins || 0;
  };

  UI.buildCreed = function () {
    const el = UI.el['creed-list']; if (!el) return;
    el.innerHTML = '';
    G.Relics.ALL.forEach(r => {
      const d = document.createElement('div');
      d.className = 'creed-item ' + r.tier;
      d.innerHTML = '<h5>' + r.sigil + ' ' + r.name + '</h5><p>' + r.desc + '</p>';
      el.appendChild(d);
    });
  };

  G.UI = UI;
})();
