/* DEEP SPACE CRAFT · ui.js —— HUD / 菜单 / 通知 / 星系图 / 背包（严格遵循 SPEC §11 约定） */
(function () {
  'use strict';
  var DSC = (window.DSC = window.DSC || {});
  var U = DSC.Util, B = DSC.Blocks, M4 = DSC.M4;
  var A = function () { return DSC.Audio; };

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  }
  function show(e, on) { if (e) e.classList[on ? 'remove' : 'add']('hidden'); }
  function cls(e, name, on) { if (e) e.classList[on ? 'add' : 'remove'](name); }
  function setV(e, v) { if (e) e.style.setProperty('--v', U.clamp(v, 0, 1)); }

  var iconCache = {};
  function icon(key) {
    if (iconCache[key]) return iconCache[key];
    var it = B.item(key);
    var tile = it && it.tile ? it.tile : 'stone';
    var url = '';
    try { url = DSC.Textures.icon(tile, 3); } catch (e) { url = ''; }
    iconCache[key] = url;
    return url;
  }

  var UI = {
    hooks: {},
    screen: null,
    D: {},
    hotbarEls: [], invEls: [],
    markerPool: [], blipPool: [],
    _txt: 0, _lastSel: -1, _hotSig: '', _invOpen: false,
    settings: { master: 80, sfx: 90, music: 55, fov: 78, dist: 8, sens: 100, bloom: true, scan: true, shake: true },
    invSel: -1, galaxySel: -1,
    notifyN: 0,

    /* ============================================================ 初始化 */
    init: function () {
      var D = UI.D;
      [
        'boot-overlay', 'boot-log', 'boot-bar', 'boot-hint', 'title-screen', 'guide-screen',
        'hud', 'compass', 'compass-strip', 'compass-needle', 'planet-card', 'pc-name', 'pc-tag',
        'pc-biome', 'pc-weather', 'pc-sentinels', 'pc-flora', 'pc-fauna', 'pc-res', 'pc-clock', 'pc-clock-fill', 'pc-clock-txt',
        'vitals', 'v-health', 'v-shield', 'v-oxygen', 'v-hazard', 'crosshair', 'mine-ring',
        'target-info', 'ti-name', 'ti-sub', 'hotbar', 'hotbar-label', 'currency', 'cur-units', 'cur-nanites',
        'markers', 'scan-pulse', 'notify-stack', 'discovery-banner', 'db-name', 'db-desc',
        'interact-prompt', 'ip-key', 'ip-text', 'ip-ring', 'ship-hud', 'sh-reticle', 'sh-ladder',
        'sh-throttle', 'sh-throttle-txt', 'sh-pulse', 'sh-pulse-txt', 'sh-hull', 'sh-hull-txt',
        'sh-shield', 'sh-shield-txt', 'sh-speed-num', 'sh-radar', 'sh-radar-blips', 'sh-target',
        'sht-name', 'sht-dist', 'sht-note', 'entry-warning', 'ew-bar', 'landing-prompt',
        'subtitle', 'debug-readout', 'inventory-screen', 'inv-grid', 'inv-detail', 'refiner-list', 'craft-list',
        'galaxy-screen', 'galaxy-canvas', 'galaxy-nodes', 'galaxy-map', 'galaxy-head', 'galaxy-sys', 'gs-name', 'gs-tag', 'gs-info', 'gs-cost',
        'btn-warp', 'btn-scan-system', 'log-screen', 'log-list', 'pause-screen', 'pause-panel', 'options-panel',
        'death-screen', 'death-note', 'fx-vignette', 'fx-scanlines', 'fx-damage', 'fx-warp', 'fx-entry',
        'fx-flash', 'fx-fade', 'toast', 'lock-hint', 'fatal', 'tip-text', 'save-info', 'seed-input',
        'title-version', 'sh-left', 'sh-right'
      ].forEach(function (id) { D[id] = $(id); });

      UI.buildHotbar();
      UI.buildInvGrid();
      UI.buildCompass();
      UI.buildLadder();
      UI.bindButtons();
      UI.bindOptions();
      cls(D['fx-scanlines'], 'on', true);
      D['fx-scanlines'].style.opacity = UI.settings.scan ? '0.5' : '0';
      D['fx-vignette'].style.opacity = '1';
      return UI;
    },

    /* ============================================================ 开机序列 */
    boot: function (onDone) {
      var D = UI.D, lines = (DSC.Lore && DSC.Lore.bootLog) ? DSC.Lore.bootLog() : ['[  OK  ] SYSTEM ONLINE'];
      var i = 0, log = D['boot-log'], clicked = false, finished = false;
      log.textContent = '';
      var timer = setInterval(function () {
        if (i < lines.length) {
          log.textContent += lines[i] + '\n';
          log.scrollTop = log.scrollHeight;
          setV(D['boot-bar'], (i + 1) / lines.length);
          if (A() && A().ready) A().play('ui_type', { volume: 0.22, rate: 0.9 + Math.random() * 0.3 });
          i++;
        } else {
          clearInterval(timer);
          finished = true;
          if (clicked) done();
        }
      }, 82);

      function done() {
        if (!finished) { /* 允许提前点击：加速播完 */ }
        clearInterval(timer);
        while (i < lines.length) { log.textContent += lines[i] + '\n'; i++; }
        setV(D['boot-bar'], 1);
        setTimeout(function () {
          show(D['boot-overlay'], false);
          UI.showScreen('title');
          if (onDone) onDone();
        }, 260);
      }
      function onClick() {
        if (clicked) return;
        clicked = true;
        try { if (A()) { A().init(); A().setVolumes({ master: UI.settings.master / 100, sfx: UI.settings.sfx / 100, music: UI.settings.music / 100 }); A().setMusic('title'); A().play('ui_click'); } } catch (e) { console.warn(e); }
        D['boot-hint'].textContent = '音频核心已联机 · AUDIO CORE ONLINE';
        setTimeout(done, 420);
      }
      window.addEventListener('mousedown', onClick, { once: true });
      window.addEventListener('keydown', onClick, { once: true });
    },

    /* ============================================================ 屏幕切换 */
    showScreen: function (name) {
      var D = UI.D;
      var map = {
        title: 'title-screen', guide: 'guide-screen', inventory: 'inventory-screen',
        galaxy: 'galaxy-screen', log: 'log-screen', pause: 'pause-screen', death: 'death-screen'
      };
      for (var k in map) show(D[map[k]], false);
      show(D['boot-overlay'], false);
      UI.screen = name;
      if (name && map[name]) {
        show(D[map[name]], true);
        if (name === 'inventory') UI.refreshInventory();
        if (name === 'galaxy') UI.refreshGalaxy();
        if (name === 'log') UI.refreshLog();
        A() && A().play(name === 'inventory' ? 'inv_open' : 'ui_tab', { volume: 0.6 });
      }
      show(D['hud'], !name || name === 'none');
      if (name === 'title' && DSC.Lore) D['tip-text'].textContent = DSC.Lore.tip();
    },
    closeScreen: function () {
      if (UI.screen === 'inventory') A() && A().play('inv_close', { volume: 0.55 });
      else if (UI.screen) A() && A().play('ui_back', { volume: 0.5 });
      UI.showScreen(null);
    },

    /* ============================================================ 构建 */
    buildHotbar: function () {
      var h = UI.D['hotbar'];
      h.innerHTML = '';
      UI.hotbarEls = [];
      for (var i = 0; i < 9; i++) {
        var s = el('div', 'slot empty');
        var im = el('img', 'slot-ico'); im.alt = '';
        var n = el('b', 'slot-n', String(i + 1));
        var c = el('span', 'slot-c', '');
        s.appendChild(im); s.appendChild(n); s.appendChild(c);
        (function (idx) {
          s.addEventListener('mousedown', function (e) { e.stopPropagation(); DSC.Player.sel = idx; A() && A().play('ui_click', { volume: 0.4 }); });
        })(i);
        h.appendChild(s);
        UI.hotbarEls.push({ root: s, img: im, cnt: c });
      }
    },
    buildInvGrid: function () {
      var g = UI.D['inv-grid'];
      g.innerHTML = '';
      UI.invEls = [];
      for (var i = 0; i < DSC.Player.SLOTS; i++) {
        var s = el('div', 'inv-slot empty');
        var im = el('img', 'is-ico'); im.alt = '';
        var c = el('span', 'is-c', '');
        var n = el('b', 'is-n', i < 9 ? String(i + 1) : '');
        s.appendChild(im); s.appendChild(c); s.appendChild(n);
        (function (idx) {
          s.addEventListener('click', function () { UI.invSel = idx; UI.refreshInventory(); A() && A().play('ui_hover', { volume: 0.4 }); });
          s.addEventListener('contextmenu', function (e) {
            e.preventDefault();
            var P = DSC.Player;
            if (idx < 9) return;
            var tmp = P.slots[P.sel]; P.slots[P.sel] = P.slots[idx]; P.slots[idx] = tmp;
            UI.refreshInventory(); A() && A().play('ui_click', { volume: 0.5 });
          });
        })(i);
        g.appendChild(s);
        UI.invEls.push({ root: s, img: im, cnt: c });
      }
    },
    buildCompass: function () {
      var s = UI.D['compass-strip'];
      s.innerHTML = '';
      UI._ticks = [];
      for (var i = 0; i < 24; i++) {
        var t = el('span', 'c-tick' + (i % 6 ? ' minor' : ''));
        var b = el('b', null, '');
        t.appendChild(b);
        s.appendChild(t);
        UI._ticks.push({ root: t, label: b, deg: i * 15 });
      }
    },
    buildLadder: function () {
      var l = UI.D['sh-ladder'];
      l.innerHTML = '';
      UI._rungs = [];
      for (var d = -60; d <= 60; d += 10) {
        var r = el('i', 'rung' + (d === 0 ? ' zero' : ''));
        var b = el('b', null, d === 0 ? '—' : String(Math.abs(d)));
        r.appendChild(b);
        l.appendChild(r);
        UI._rungs.push({ root: r, deg: d });
      }
    },

    bindButtons: function () {
      var D = UI.D;
      function bind(id, fn) {
        var e = $(id); if (!e) return;
        e.addEventListener('mouseenter', function () { A() && A().play('ui_hover', { volume: 0.3 }); });
        e.addEventListener('click', function (ev) { ev.stopPropagation(); A() && A().play('ui_click', { volume: 0.6 }); fn(ev); });
      }
      bind('btn-new', function () { UI.hooks.onNewGame && UI.hooks.onNewGame(D['seed-input'].value); });
      bind('btn-continue', function () { UI.hooks.onContinue && UI.hooks.onContinue(); });
      bind('btn-guide', function () { UI.showScreen('guide'); });
      bind('guide-close', function () { UI.showScreen('title'); });
      bind('btn-settings', function () { UI.showScreen('pause'); show(D['pause-panel'], false); show(D['options-panel'], true); UI._optsFromTitle = true; });
      bind('btn-seed-rand', function () { D['seed-input'].value = UI.randSeed(); });
      bind('btn-resume', function () { UI.hooks.onResume && UI.hooks.onResume(); });
      bind('btn-save', function () { UI.hooks.onSave && UI.hooks.onSave(); });
      bind('btn-opts', function () { show(D['pause-panel'], false); show(D['options-panel'], true); });
      bind('btn-opts-close', function () {
        show(D['options-panel'], false);
        if (UI._optsFromTitle) { UI._optsFromTitle = false; UI.showScreen('title'); }
        else show(D['pause-panel'], true);
      });
      bind('btn-title', function () { UI.hooks.onQuit && UI.hooks.onQuit(); });
      bind('btn-respawn', function () { UI.hooks.onRespawn && UI.hooks.onRespawn(); });
      bind('btn-warp', function () { UI.hooks.onWarp && UI.hooks.onWarp(UI.galaxySel); });
      bind('btn-scan-system', function () { UI.hooks.onScanSystem && UI.hooks.onScanSystem(); });
      D['seed-input'].value = UI.randSeed();
    },
    randSeed: function () {
      var s = '', c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      for (var i = 0; i < 8; i++) s += c[(Math.random() * c.length) | 0];
      return s;
    },

    bindOptions: function () {
      var ids = ['master', 'sfx', 'music', 'fov', 'dist', 'sens'];
      ids.forEach(function (k) {
        var e = $('opt-' + k); if (!e) return;
        e.value = UI.settings[k];
        var lab = e.parentNode.querySelector('.opt-val');
        if (lab) lab.textContent = e.value;
        e.addEventListener('input', function () {
          UI.settings[k] = parseFloat(e.value);
          if (lab) lab.textContent = e.value;
          UI.applySettings();
        });
      });
      [['opt-bloom', 'bloom'], ['opt-scan', 'scan'], ['opt-shake', 'shake']].forEach(function (p) {
        var e = $(p[0]); if (!e) return;
        e.checked = UI.settings[p[1]];
        e.addEventListener('change', function () { UI.settings[p[1]] = e.checked; UI.applySettings(); });
      });
    },
    applySettings: function () {
      var s = UI.settings;
      if (A()) A().setVolumes({ master: s.master / 100, sfx: s.sfx / 100, music: s.music / 100 });
      if (DSC.World) DSC.World.renderDist = s.dist | 0;
      if (DSC.Render) DSC.Render.bloomOn = !!s.bloom;
      UI.D['fx-scanlines'].style.opacity = s.scan ? '0.5' : '0';
      if (DSC.Game) DSC.Game.fov = s.fov;
    },

    /* ============================================================ HUD 更新 */
    update: function (dt, ctx) {
      var D = UI.D, P = DSC.Player;
      UI._txt += dt;
      var slow = UI._txt > 0.12;
      if (slow) UI._txt = 0;

      /* 生存四表 */
      setV(D['v-health'], P.health / P.healthMax);
      setV(D['v-shield'], P.shield / P.shieldMax);
      setV(D['v-oxygen'], P.oxygen / P.oxygenMax);
      setV(D['v-hazard'], P.protection / P.protectionMax);
      cls(D['v-health'], 'crit', P.health < 30);
      cls(D['v-oxygen'], 'warn', P.oxygen < 45);
      cls(D['v-hazard'], 'crit', P.protection < 18);
      if (slow) {
        UI.num(D['v-health'], Math.ceil(P.health));
        UI.num(D['v-shield'], Math.ceil(P.shield));
        UI.num(D['v-oxygen'], Math.ceil(P.oxygen));
        UI.num(D['v-hazard'], Math.ceil(P.protection));
        D['cur-units'].querySelector('b').textContent = U.fmtNum(P.units);
        D['cur-nanites'].querySelector('b').textContent = U.fmtNum(P.nanites);
      }

      /* 快捷栏 */
      var sig = '';
      for (var i = 0; i < 9; i++) { var s = P.slots[i]; sig += (s ? s.k + s.n : '-') + '|'; }
      sig += P.sel;
      if (sig !== UI._hotSig) {
        UI._hotSig = sig;
        for (i = 0; i < 9; i++) {
          var sl = P.slots[i], h = UI.hotbarEls[i];
          cls(h.root, 'active', i === P.sel);
          cls(h.root, 'empty', !sl);
          if (sl) {
            var src = icon(sl.k);
            if (h.img.getAttribute('src') !== src) h.img.src = src;
            h.img.style.display = '';
            h.cnt.textContent = sl.n > 1 ? sl.n : '';
          } else { h.img.style.display = 'none'; h.cnt.textContent = ''; }
        }
        if (P.sel !== UI._lastSel) {
          UI._lastSel = P.sel;
          var cur = P.slots[P.sel];
          var lab = D['hotbar-label'];
          if (cur) { var nm = B.itemName(cur.k); lab.innerHTML = '<span>' + nm.zh + '</span><em>' + nm.en + '</em>'; }
          else lab.innerHTML = '<span>空</span><em>EMPTY</em>';
          cls(lab, 'show', true);
          clearTimeout(UI._labT);
          UI._labT = setTimeout(function () { cls(lab, 'show', false); }, 1600);
        }
      }

      /* 准星 / 挖掘环 / 目标信息 */
      var m = P.mine;
      setV(D['mine-ring'], m.progress);
      cls(D['crosshair'], 'active', m.valid);
      if (slow) {
        if (m.valid && m.id) {
          var nm2 = B.name(m.id);
          D['ti-name'].textContent = nm2.zh;
          var hard = B.hardness(m.id);
          D['ti-sub'].textContent = nm2.en + ' · ' + (isFinite(hard) ? ('硬度 ' + hard.toFixed(1)) : '不可破坏');
          cls(D['target-info'], 'show', true);
        } else cls(D['target-info'], 'show', false);
      }

      /* 罗盘 */
      UI.updateCompass(ctx.yaw);

      /* 行星卡时钟 */
      if (ctx.dayT !== undefined) {
        setV(D['pc-clock'], ctx.dayT);
        if (slow) D['pc-clock-txt'].textContent = ctx.dayT > 0.25 && ctx.dayT < 0.72 ? '昼 DAY' : '夜 NIGHT';
      }

      /* 世界标记 */
      UI.updateMarkers(ctx);

      /* 伤害闪红 */
      D['fx-damage'].style.opacity = String(U.clamp(P.hurtT * 1.4, 0, 0.85));

      /* 调试 */
      if (!D['debug-readout'].classList.contains('hidden') && slow) {
        var W = DSC.World;
        var gl = DSC.GL.gl;
        if (!UI._diag) {
          var dbg = gl.getExtension('WEBGL_debug_renderer_info');
          UI._diag = 'GL ' + gl.getParameter(gl.VERSION) +
            ' | ' + (dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'renderer?') +
            ' | atlas ' + (DSC.Render.atlas ? DSC.Render.atlas.canvas.width + 'x' + DSC.Render.atlas.canvas.height : '-') +
            ' | audio ' + (DSC.Audio && DSC.Audio.ready ? 'on' : 'off');
        }
        var e0 = gl.getError();
        if (e0) UI._glErr = '0x' + e0.toString(16);
        D['debug-readout'].textContent =
          'FPS ' + ctx.fps.toFixed(0) + '  |  XYZ ' + P.pos[0].toFixed(1) + ' ' + P.pos[1].toFixed(1) + ' ' + P.pos[2].toFixed(1) +
          '\nchunks ' + W.stats.chunks + '  draws ' + DSC.GL.stats.draws + '  quads ' + (W.stats.quads | 0) +
          '\nparticles ' + DSC.Particles.n + '  queue ' + W.meshQueue.length + '  glerr ' + (UI._glErr || 'none') +
          '\nplanet ' + (ctx.planet ? ctx.planet.name + ' / ' + ctx.planet.biome : '-') +
          '\nstate ' + ctx.state + '\n' + UI._diag;
      }
    },

    num: function (root, v) {
      var e = root.querySelector('.num');
      if (e) e.textContent = v;
    },

    updateCompass: function (yaw) {
      /* yaw=0 面向 -Z(北)。刻度沿 ±90° 视野展开 */
      var deg = ((-yaw * 180 / Math.PI) % 360 + 360) % 360;
      var names = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
      for (var i = 0; i < UI._ticks.length; i++) {
        var t = UI._ticks[i];
        var d = ((t.deg - deg + 540) % 360) - 180;
        if (Math.abs(d) > 62) { t.root.style.opacity = '0'; continue; }
        t.root.style.opacity = String(1 - Math.abs(d) / 74);
        t.root.style.left = (50 + d / 62 * 50) + '%';
        var nm = names[t.deg];
        if (t.label.textContent !== (nm || '')) t.label.textContent = nm || '';
        cls(t.root, 'card', !!nm);
      }
    },

    /* 世界坐标 → 屏幕坐标 */
    project: function (p) {
      var Cam = DSC.Cam;
      var v = M4.mulVec(Cam.viewProj, [p[0], p[1], p[2], 1]);
      if (v[3] <= 0.0001) return null;
      var x = (v[0] / v[3] * 0.5 + 0.5) * window.innerWidth;
      var y = (-v[1] / v[3] * 0.5 + 0.5) * window.innerHeight;
      return { x: x, y: y, w: v[3] };
    },

    updateMarkers: function (ctx) {
      var list = ctx.markers || [];
      var host = UI.D['markers'];
      while (UI.markerPool.length < list.length) {
        var mk = el('div', 'marker');
        mk.appendChild(el('i', 'm-ico'));
        mk.appendChild(el('span', 'm-name'));
        mk.appendChild(el('span', 'm-dist'));
        host.appendChild(mk);
        UI.markerPool.push(mk);
      }
      for (var i = 0; i < UI.markerPool.length; i++) {
        var e = UI.markerPool[i], d = list[i];
        if (!d) { e.style.display = 'none'; continue; }
        var pr = UI.project(d.pos);
        if (!pr) { e.style.display = 'none'; continue; }
        var ox = U.clamp(pr.x, 40, window.innerWidth - 40), oy = U.clamp(pr.y, 60, window.innerHeight - 90);
        var edge = (ox !== pr.x || oy !== pr.y);
        e.style.display = '';
        e.className = 'marker ' + (d.kind || 'poi') + (edge ? ' edge' : '');
        e.style.left = ox + 'px';
        e.style.top = oy + 'px';
        var nmEl = e.querySelector('.m-name'), dsEl = e.querySelector('.m-dist');
        if (nmEl.textContent !== d.name) nmEl.textContent = d.name;
        var ds = U.fmtDist(d.dist);
        if (dsEl.textContent !== ds) dsEl.textContent = ds;
      }
    },

    /* ============================================================ 飞行 HUD */
    updateShip: function (dt, ctx) {
      var D = UI.D, sh = DSC.Space.ship;
      show(D['ship-hud'], true);
      setV(D['sh-throttle'], sh.throttle);
      setV(D['sh-pulse'], sh.pulse);
      setV(D['sh-hull'], sh.hull / 100);
      setV(D['sh-shield'], sh.shield / 100);
      cls(D['sh-pulse'], 'charging', sh.pulse > 0.02 && sh.pulse < 0.98);
      cls(D['sh-pulse'], 'full', sh.pulse > 0.98);
      UI._txt += dt;
      if (UI._txt > 0.1) {
        UI._txt = 0;
        D['sh-throttle-txt'].textContent = Math.round(sh.throttle * 100) + '%';
        D['sh-pulse-txt'].textContent = sh.pulse > 0.98 ? '已启动' : (sh.pulse > 0.02 ? '充能中' : '就绪');
        D['sh-hull-txt'].textContent = Math.round(sh.hull) + '%';
        D['sh-shield-txt'].textContent = Math.round(sh.shield) + '%';
        D['sh-speed-num'].textContent = U.fmtNum(DSC.Space.speed || 0);
        var t = DSC.Space.target;
        if (t) {
          var nm = t.kind === 'planet' ? (t.obj.customName || t.obj.name) : t.obj.name;
          D['sht-name'].textContent = nm;
          D['sht-dist'].textContent = U.fmtDist(t.dist);
          D['sht-note'].textContent = t.kind === 'planet'
            ? (t.obj.labels.biome.zh + ' · ' + t.obj.labels.biome.en)
            : '空间站 · SPACE STATION';
          cls(D['sh-target'], 'show', true);
        } else cls(D['sh-target'], 'show', false);
      }
      /* 俯仰梯 */
      var pitchDeg = sh.pitch * 180 / Math.PI;
      for (var i = 0; i < UI._rungs.length; i++) {
        var r = UI._rungs[i];
        var off = (r.deg - pitchDeg);
        if (Math.abs(off) > 32) { r.root.style.opacity = '0'; continue; }
        r.root.style.opacity = String(1 - Math.abs(off) / 40);
        r.root.style.top = (50 + off * 1.35) + '%';
        r.root.style.transform = 'translate(-50%,-50%) rotate(' + (-sh.roll * 30) + 'deg)';
      }
      D['sh-ladder'].style.transform = 'rotate(' + (sh.roll * 22) + 'deg)';
      /* 雷达 */
      UI.updateRadar();
      /* 降落提示 */
      cls(D['landing-prompt'], 'show', !!ctx.canLand);
      if (ctx.hint) UI.subtitle(ctx.hint, 0.4);
    },

    updateRadar: function () {
      var S = DSC.Space.system, sh = DSC.Space.ship;
      var host = UI.D['sh-radar-blips'];
      var items = [];
      for (var i = 0; i < S.planets.length; i++) items.push({ pos: S.planets[i].pos, cls: 'planet' });
      items.push({ pos: S.station.pos, cls: 'ship' });
      items.push({ pos: [0, 0, 0], cls: 'star' });
      while (UI.blipPool.length < items.length) {
        var b = el('i', 'blip');
        host.appendChild(b);
        UI.blipPool.push(b);
      }
      var cy = Math.cos(-sh.yaw), sy = Math.sin(-sh.yaw);
      for (i = 0; i < UI.blipPool.length; i++) {
        var e = UI.blipPool[i], it = items[i];
        if (!it) { e.style.display = 'none'; continue; }
        var dx = it.pos[0] - sh.pos[0], dz = it.pos[2] - sh.pos[2];
        var d = Math.sqrt(dx * dx + dz * dz);
        var scale = 46 / Math.max(1, Math.log10(1 + d / 200) * 22);
        var rx = (dx * cy - dz * sy), rz = (dx * sy + dz * cy);
        var mag = Math.min(46, Math.log10(1 + d / 120) * 20);
        var ang = Math.atan2(rx, -rz);
        e.style.display = '';
        e.className = 'blip ' + it.cls;
        e.style.left = (50 + Math.sin(ang) * mag) + '%';
        e.style.top = (50 - Math.cos(ang) * mag) + '%';
      }
    },
    hideShipHud: function () { show(UI.D['ship-hud'], false); },

    /* ============================================================ 提示与通知 */
    toast: function (msg) {
      var t = UI.D['toast'];
      t.textContent = msg;
      cls(t, 'show', true);
      clearTimeout(UI._toastT);
      UI._toastT = setTimeout(function () { cls(t, 'show', false); }, 1800);
    },
    subtitle: function (msg, dur) {
      var s = UI.D['subtitle'];
      if (s.textContent !== msg) s.textContent = msg;
      cls(s, 'show', true);
      clearTimeout(UI._subT);
      UI._subT = setTimeout(function () { cls(s, 'show', false); }, (dur || 3) * 1000);
    },
    notify: function (title, body, kind) {
      var host = UI.D['notify-stack'];
      var n = el('div', 'notify' + (kind ? ' ' + kind : ''));
      n.appendChild(el('b', null, title));
      n.appendChild(el('span', null, body || ''));
      host.appendChild(n);
      if (kind === 'good') A() && A().play('milestone', { volume: 0.55 });
      else if (kind === 'bad') A() && A().play('ui_error', { volume: 0.5 });
      setTimeout(function () {
        cls(n, 'out', true);
        setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 400);
      }, 4000);
      while (host.children.length > 5) host.removeChild(host.firstChild);
    },
    resourceGain: function (k, n) {
      var nm = B.itemName(k);
      var host = UI.D['notify-stack'];
      /* 合并同资源的连续获取 */
      var last = host.lastElementChild;
      if (last && last._resKey === k && !last.classList.contains('out')) {
        last._resN += n;
        last.querySelector('span').textContent = '+' + last._resN;
        return;
      }
      var e = el('div', 'notify');
      e._resKey = k; e._resN = n;
      e.appendChild(el('b', null, nm.zh));
      e.appendChild(el('span', null, '+' + n));
      host.appendChild(e);
      setTimeout(function () {
        cls(e, 'out', true);
        setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, 400);
      }, 2600);
      while (host.children.length > 5) host.removeChild(host.firstChild);
    },
    discovery: function (name, desc) {
      var D = UI.D;
      D['db-name'].textContent = name;
      D['db-desc'].textContent = desc || '';
      cls(D['discovery-banner'], 'show', true);
      A() && A().play('discovery', { volume: 0.85 });
      clearTimeout(UI._dbT);
      UI._dbT = setTimeout(function () { cls(D['discovery-banner'], 'show', false); }, 4200);
    },
    systemArrival: function (sys) {
      UI.discovery(sys.name, '恒星类型 ' + sys.starClass.zh + ' · ' + sys.planets.length + ' 颗行星 · 经济 ' + sys.economy.zh);
      UI.D['galaxy-sys'].textContent = sys.name;
    },

    /* 行星信息卡（着陆后打字机展开） */
    planetCard: function (p, animate) {
      var D = UI.D, L = p.labels;
      var rows = [
        [D['pc-biome'], L.biome.zh + ' · ' + L.biome.en],
        [D['pc-weather'], L.weather.zh + ' · ' + L.weather.en],
        [D['pc-sentinels'], L.sentinels.zh + ' · ' + L.sentinels.en],
        [D['pc-flora'], L.flora.zh + ' · ' + L.flora.en],
        [D['pc-fauna'], L.fauna.zh + ' · ' + L.fauna.en],
        [D['pc-res'], p.resources.map(function (r) { var n = B.itemName(r); return n.zh; }).join(' · ')]
      ];
      D['pc-name'].textContent = p.customName || p.name;
      D['pc-tag'].textContent = p.discovered ? 'DISCOVERED' : 'UNCHARTED';
      cls(D['planet-card'], 'show', true);
      if (!animate) { rows.forEach(function (r) { r[0].textContent = r[1]; }); return; }
      rows.forEach(function (r) { r[0].textContent = ''; });
      var ri = 0;
      (function next() {
        if (ri >= rows.length) return;
        var row = rows[ri++], txt = row[1], ci = 0;
        var iv = setInterval(function () {
          row[0].textContent = txt.slice(0, ++ci);
          if (ci % 3 === 0) A() && A().play('ui_type', { volume: 0.14, rate: 1 + Math.random() * 0.3 });
          if (ci >= txt.length) { clearInterval(iv); setTimeout(next, 90); }
        }, 16);
      })();
      if (L.blurb) UI.subtitle(L.blurb, 6);
    },

    entryWarning: function (on, p) {
      var D = UI.D;
      cls(D['entry-warning'], 'show', !!on);
      if (p !== undefined) setV(D['ew-bar'], p);
    },
    interact: function (on, key, text, hold) {
      var D = UI.D;
      cls(D['interact-prompt'], 'show', !!on);
      if (on) {
        if (D['ip-key'].textContent !== key) D['ip-key'].textContent = key;
        if (D['ip-text'].textContent !== text) D['ip-text'].textContent = text;
        setV(D['ip-ring'], hold || 0);
      }
    },
    fx: function (name, v) {
      var e = UI.D['fx-' + name];
      if (e) e.style.opacity = String(U.clamp(v, 0, 1));
    },
    setLockHint: function (on) { cls(UI.D['lock-hint'], 'show', !!on); },

    onScan: function (hits, planet) {
      var D = UI.D;
      D['scan-pulse'].classList.remove('play');
      void D['scan-pulse'].offsetWidth;
      D['scan-pulse'].classList.add('play');
      if (hits && hits.length) {
        var kinds = {};
        hits.forEach(function (h) { kinds[h.k] = (kinds[h.k] || 0) + 1; });
        var txt = Object.keys(kinds).map(function (k) { return B.itemName(k).zh + '×' + kinds[k]; }).join('  ');
        UI.notify('扫描完成 SCAN COMPLETE', txt || '未发现有价值资源');
      } else UI.notify('扫描完成 SCAN COMPLETE', '附近无显著资源信号');
    },

    /* ============================================================ 背包 / 精炼 / 合成 */
    refreshInventory: function () {
      var P = DSC.Player, i;
      for (i = 0; i < UI.invEls.length; i++) {
        var s = P.slots[i], e = UI.invEls[i];
        cls(e.root, 'empty', !s);
        cls(e.root, 'sel', i === UI.invSel);
        if (s) {
          var src = icon(s.k);
          if (e.img.getAttribute('src') !== src) e.img.src = src;
          e.img.style.display = '';
          e.cnt.textContent = s.n;
        } else { e.img.style.display = 'none'; e.cnt.textContent = ''; }
      }
      /* 详情 */
      var det = UI.D['inv-detail'];
      var sel = UI.invSel >= 0 ? P.slots[UI.invSel] : null;
      if (!sel) det.innerHTML = '<p class="dim">选择一个物品以查看分析数据。</p>';
      else {
        var it = B.item(sel.k) || {}, nm = B.itemName(sel.k);
        var d = (DSC.Lore && DSC.Lore.resourceName) ? DSC.Lore.resourceName(sel.k) : null;
        det.innerHTML = '';
        var im = el('img', 'detail-ico'); im.src = icon(sel.k); det.appendChild(im);
        det.appendChild(el('h3', null, nm.zh));
        det.appendChild(el('h4', null, nm.en));
        det.appendChild(el('p', 'dim', (d && d.desc) ? d.desc : (it.type === 'block' ? '可放置的建造材料。' : '可精炼的原料。')));
        var rows = el('div', 'detail-rows');
        rows.appendChild(UI._kv('数量 AMOUNT', String(sel.n)));
        rows.appendChild(UI._kv('类型 TYPE', it.type === 'block' ? '建材 BUILDING' : it.type === 'tech' ? '科技 TECH' : '资源 RESOURCE'));
        rows.appendChild(UI._kv('估值 VALUE', U.fmtNum((it.value || 0) * sel.n) + ' u'));
        det.appendChild(rows);
        if (B.placeable(sel.k)) {
          var btn = el('button', 'menu-btn small');
          btn.innerHTML = '<span>放入快捷栏</span><em>TO HOTBAR</em>';
          btn.addEventListener('click', function () {
            var tmp = P.slots[P.sel]; P.slots[P.sel] = P.slots[UI.invSel]; P.slots[UI.invSel] = tmp;
            A() && A().play('ui_click'); UI.refreshInventory();
          });
          det.appendChild(btn);
        }
        if (sel.k === 'med_kit' || sel.k === 'o2_canister' || sel.k === 'sodium' || sel.k === 'oxygen') {
          var use = el('button', 'menu-btn small');
          use.innerHTML = '<span>使用</span><em>CONSUME</em>';
          use.addEventListener('click', function () {
            if (P.consume(sel.k)) { UI.refreshInventory(); UI.toast('已使用 ' + B.itemName(sel.k).zh); }
            else A() && A().play('ui_error');
          });
          det.appendChild(use);
        }
      }
      UI.refreshRecipes();
    },
    _kv: function (k, v) {
      var r = el('div', 'kv');
      r.appendChild(el('b', null, k));
      r.appendChild(el('span', null, v));
      return r;
    },
    refreshRecipes: function () {
      var P = DSC.Player;
      function build(host, list, verb) {
        host.innerHTML = '';
        list.forEach(function (rc) {
          var can = rc.in.every(function (x) { return P.count(x.k) >= x.n; });
          var row = el('div', 'recipe' + (can ? '' : ' disabled'));
          row.appendChild(el('span', 'r-name', rc.label));
          var io = rc.in.map(function (x) { return B.itemName(x.k).zh + '×' + x.n; }).join(' + ') +
            ' → ' + B.itemName(rc.out.k).zh + '×' + rc.out.n;
          row.appendChild(el('span', 'r-io', io));
          var btn = el('button', 'r-go', verb);
          btn.addEventListener('click', function () {
            if (!rc.in.every(function (x) { return P.count(x.k) >= x.n; })) { A() && A().play('ui_error'); return; }
            rc.in.forEach(function (x) { P.removeItem(x.k, x.n); });
            var left = P.addItem(rc.out.k, rc.out.n);
            A() && A().play(verb === '精炼' ? 'item_refine' : 'item_craft', { volume: 0.75 });
            UI.notify(rc.label + ' 完成', B.itemName(rc.out.k).zh + ' ×' + rc.out.n, 'good');
            if (left > 0) UI.toast('背包已满，部分产出丢失');
            UI.refreshInventory();
          });
          row.appendChild(btn);
          host.appendChild(row);
        });
      }
      build(UI.D['refiner-list'], B.REFINER, '精炼');
      build(UI.D['craft-list'], B.CRAFT, '合成');
    },

    /* ============================================================ 星系图 */
    refreshGalaxy: function () {
      var G = DSC.Game.galaxy, cur = G.systems[G.current];
      UI.D['galaxy-sys'].textContent = cur.name;
      var host = UI.D['galaxy-nodes'];
      host.innerHTML = '';
      var cv = UI.D['galaxy-canvas'];
      var rect = UI.D['galaxy-map'].getBoundingClientRect();
      cv.width = Math.max(400, rect.width | 0); cv.height = Math.max(300, rect.height | 0);
      var g = cv.getContext('2d');
      g.clearRect(0, 0, cv.width, cv.height);
      /* 星云背景 */
      var grd = g.createRadialGradient(cv.width * 0.5, cv.height * 0.5, 10, cv.width * 0.5, cv.height * 0.5, cv.width * 0.55);
      grd.addColorStop(0, 'rgba(90,140,255,0.16)');
      grd.addColorStop(0.55, 'rgba(60,40,120,0.10)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd; g.fillRect(0, 0, cv.width, cv.height);
      /* 随机星点 */
      var rng = U.makeRng(G.seed);
      for (var i = 0; i < 320; i++) {
        var x = rng() * cv.width, y = rng() * cv.height, a = 0.15 + rng() * 0.5;
        g.fillStyle = 'rgba(200,225,255,' + a.toFixed(2) + ')';
        g.fillRect(x, y, 1, 1);
      }
      /* 连线：当前星系 → 其他 */
      G.systems.forEach(function (s) {
        var x1 = cur.mapPos[0] * cv.width, y1 = cur.mapPos[1] * cv.height;
        var x2 = s.mapPos[0] * cv.width, y2 = s.mapPos[1] * cv.height;
        if (s === cur) return;
        var d = DSC.Universe.warpDistance(cur, s);
        g.strokeStyle = d < 400 ? 'rgba(255,160,60,0.35)' : 'rgba(70,224,255,0.10)';
        g.lineWidth = 1;
        g.setLineDash([3, 5]);
        g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      });
      g.setLineDash([]);
      /* 节点 */
      G.systems.forEach(function (s, idx) {
        var n = el('div', 'gnode' + (idx === G.current ? ' current' : '') + (s.visited ? ' visited' : '') + (idx === UI.galaxySel ? ' sel' : ''));
        n.style.left = (s.mapPos[0] * 100) + '%';
        n.style.top = (s.mapPos[1] * 100) + '%';
        var dot = el('i');
        dot.style.background = s.starClass.color;
        n.appendChild(dot);
        n.appendChild(el('span', null, s.name));
        n.addEventListener('click', function () {
          UI.galaxySel = idx;
          A() && A().play('ui_click', { volume: 0.5 });
          UI.refreshGalaxy();
        });
        n.addEventListener('mouseenter', function () { A() && A().play('ui_hover', { volume: 0.25 }); });
        host.appendChild(n);
      });
      /* 侧栏 */
      var sel = G.systems[UI.galaxySel >= 0 ? UI.galaxySel : G.current];
      UI.D['gs-name'].textContent = sel.name;
      UI.D['gs-tag'].textContent = sel.starClass.en + ' · ' + sel.economy.en;
      var info = UI.D['gs-info'];
      info.innerHTML = '';
      info.appendChild(UI._kv('恒星 STAR', sel.starClass.zh));
      info.appendChild(UI._kv('经济 ECONOMY', sel.economy.zh));
      info.appendChild(UI._kv('行星 PLANETS', String(sel.planets.length)));
      info.appendChild(UI._kv('状态 STATUS', sel === cur ? '当前所在' : (sel.visited ? '已探访' : '未探访')));
      sel.planets.forEach(function (p) {
        info.appendChild(UI._kv(p.customName || p.name, p.labels.biome.zh + (p.discovered ? ' · 已发现' : '')));
      });
      var cost = DSC.Universe.warpCost(cur, sel);
      var cells = DSC.Player.count('warp_cell');
      UI.D['gs-cost'].innerHTML = sel === cur ? '<em>当前星系</em>'
        : ('曲速距离 ' + DSC.Universe.warpDistance(cur, sel).toFixed(0) + ' 光年 · 需要曲速电池 1（持有 ' + cells + '）');
      cls(UI.D['btn-warp'], 'disabled', sel === cur || cells < 1);
    },

    /* ============================================================ 发现日志 */
    refreshLog: function () {
      var host = UI.D['log-list'];
      host.innerHTML = '';
      var list = DSC.Game.discoveries || [];
      if (!list.length) {
        host.appendChild(el('p', 'dim', '尚无记录。使用 C 扫描，或降落到未探访的星球。'));
        return;
      }
      list.slice().reverse().forEach(function (d) {
        var row = el('div', 'log-item');
        row.appendChild(el('b', null, d.name));
        row.appendChild(el('span', null, d.desc));
        row.appendChild(el('em', null, d.kind));
        host.appendChild(row);
      });
    },

    death: function (cause) {
      UI.D['death-note'].textContent = '死因：' + cause + '。外套已在最近的飞船处备份意识。';
      UI.showScreen('death');
    },
    saveInfo: function (txt) { UI.D['save-info'].textContent = txt; },
    fatal: function (msg) {
      var f = UI.D['fatal'];
      show(f, true);
      f.textContent = '致命错误 / FATAL\n\n' + msg;
    }
  };

  DSC.UI = UI;
})();
