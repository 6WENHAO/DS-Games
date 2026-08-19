/* ==========================================================================
   SPORE · ui.js
   HUD 外壳 / 目标与进度 / 资源条 / 阶段自定义 HUD / 技能条 /
   通知与飘字 / 对话框 / 阶段过渡 / 暂停 / 加载 / 徽章
   ========================================================================== */
SP.UI = function (game) {
  const U = SP.U, DB = SP.DB;
  const self = this;
  const $ = (s) => document.querySelector(s);
  const E = {
    loader: $('#loader'), lfill: $('#ldr-fill'), ltext: $('#ldr-text'),
    menu: $('#menu'), guide: $('#guide'), skipbox: $('#skipbox'),
    hud: $('#hud'), crosshair: $('#crosshair'),
    stageIco: $('#stage-ico'), stageName: $('#stage-name'),
    dna: $('#dna-num'), moneyBox: $('#res-money'), money: $('#money-num'),
    progFill: $('#prog-fill'), progLabel: $('#prog-label'),
    obj: $('#obj-body'), bars: $('#bars'), stageHud: $('#stage-hud'),
    actions: $('#actions'), toasts: $('#toasts'), floaters: $('#floaters'),
    dlg: $('#panel-dialog'), dlgT: $('#dlg-title'), dlgB: $('#dlg-body'), dlgBtn: $('#dlg-btns'),
    stg: $('#panel-stage'), stgIco: $('#stg-ico'), stgName: $('#stg-name'), stgDesc: $('#stg-desc'), stgGo: $('#stg-go'),
    pause: $('#panel-pause'), pauseStats: $('#pause-stats'),
    dead: $('#panel-dead'), deadT: $('#dead-t'), deadB: $('#dead-b'),
    flash: $('#fx-flash'), scan: $('#fx-scan'), editor: $('#panel-editor')
  };
  this.E = E;

  /* ==================================================== 载入 / 菜单 */
  this.setLoading = function (p, text) {
    E.lfill.style.width = U.clamp(p, 0, 100) + '%';
    if (text) E.ltext.textContent = text;
  };
  this.hideLoader = function () {
    E.loader.classList.add('out');
    setTimeout(() => E.loader.classList.add('hidden'), 800);
  };
  this.showMenu = function (on) { E.menu.classList.toggle('hidden', !on); };
  this.showHud = function (on) { E.hud.classList.toggle('hidden', !on); };
  this.setCrosshair = function (on) { E.crosshair.classList.toggle('hide', !on); };

  /* ==================================================== 顶栏 */
  this.setStage = function (key) {
    const s = DB.STAGES[key];
    if (!s) return;
    E.stageIco.textContent = s.ico;
    E.stageName.textContent = s.name;
    E.moneyBox.classList.toggle('hidden', key !== 'civ' && key !== 'space');
  };
  this.setDNA = function (n) { E.dna.textContent = U.fmt(n); };
  this.setMoney = function (n) { E.money.textContent = U.fmt(n); };
  this.setProgress = function (p, label) {
    E.progFill.style.width = U.clamp(p * 100, 0, 100) + '%';
    if (label) E.progLabel.textContent = label;
  };
  this.setObjective = function (html) { E.obj.innerHTML = html; };

  /* ==================================================== 资源条 */
  let barSig = '';
  this.setBars = function (list) {
    list = list || [];
    const sig = list.map(b => b.label + '|' + Math.round(b.v) + '/' + Math.round(b.max) + '|' + (b.color || '')).join(';');
    if (sig === barSig) return;
    barSig = sig;
    E.bars.innerHTML = list.map(b => {
      const pct = U.clamp((b.v / (b.max || 1)) * 100, 0, 100);
      const col = b.color || 'linear-gradient(90deg,#3fe8ff,#8cf05a)';
      return '<div class="barrow"><span class="bl">' + b.label + '</span>' +
        '<span class="bb"><i style="width:' + pct.toFixed(1) + '%;background:' + col + '"></i></span>' +
        '<span class="bn">' + Math.round(b.v) + (b.max ? '/' + Math.round(b.max) : '') + '</span></div>';
    }).join('');
  };

  /* ==================================================== 阶段自定义 HUD */
  let hudSig = '', hudHandlers = {};
  this.setHud = function (html, handlers) {
    html = html || '';
    if (handlers) hudHandlers = handlers;
    if (html === hudSig) return;
    hudSig = html;
    E.stageHud.innerHTML = html;
    E.stageHud.querySelectorAll('[data-cmd]').forEach(b => {
      b.addEventListener('click', (ev) => {
        const c = b.dataset.cmd;
        SP.Audio.play('ui_click');
        if (hudHandlers[c]) hudHandlers[c](b, ev);
        else game.bus.emit('hud:' + c, b, ev);
      });
    });
  };
  this.setHudHandlers = function (map) { hudHandlers = map || {}; };
  this.refreshHud = function () { hudSig = '__force__'; };

  /* ==================================================== 技能 / 命令条 */
  let actions = [];
  this.setActions = function (list) {
    actions = list || [];
    E.actions.innerHTML = actions.map((a, i) =>
      '<div class="act' + (a.on ? ' on' : '') + (a.off ? ' off' : '') + '" data-i="' + i + '">' +
      '<span class="k">' + (a.key || (i + 1)) + '</span>' +
      '<div class="ico">' + (a.ico || '•') + '</div>' +
      '<div class="lb">' + a.label + '</div>' +
      (a.desc ? '<div class="ds">' + a.desc + '</div>' : '') +
      '</div>').join('');
    E.actions.querySelectorAll('.act').forEach(d => {
      d.addEventListener('click', () => trigger(+d.dataset.i));
      d.addEventListener('mouseenter', () => SP.Audio.play('ui_hover'));
    });
  };
  function trigger(i) {
    const a = actions[i];
    if (!a || a.off) { SP.Audio.play('deny'); return; }
    SP.Audio.play('ui_click');
    if (a.cb) a.cb();
  }
  this.triggerActionKey = function (code) {
    for (let i = 0; i < actions.length; i++) {
      const k = String(actions[i].key || (i + 1));
      if (code === 'Digit' + k || code === 'Key' + k.toUpperCase() || code === k) { trigger(i); return true; }
    }
    return false;
  };
  this.setActionState = function (key, on, off) {
    const idx = actions.findIndex(a => String(a.key) === String(key));
    if (idx < 0) return;
    actions[idx].on = on; actions[idx].off = off;
    const d = E.actions.querySelector('[data-i="' + idx + '"]');
    if (d) { d.classList.toggle('on', !!on); d.classList.toggle('off', !!off); }
  };

  /* ==================================================== 通知 / 飘字 */
  this.toast = function (text, kind) {
    const d = document.createElement('div');
    d.className = 'toast ' + (kind || '');
    d.innerHTML = text;
    E.toasts.appendChild(d);
    setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 320); }, 3600);
    while (E.toasts.children.length > 6) E.toasts.firstChild.remove();
  };
  this.float = function (x, y, text, cls) {
    const d = document.createElement('div');
    d.className = 'float ' + (cls || '');
    d.textContent = text;
    d.style.left = x + 'px'; d.style.top = y + 'px';
    E.floaters.appendChild(d);
    setTimeout(() => d.remove(), 1200);
  };
  const _v = new THREE.Vector3();
  this.float3 = function (v3, text, cls) {
    _v.copy(v3).project(game.camera);
    if (_v.z > 1) return;
    const x = (_v.x * .5 + .5) * window.innerWidth;
    const y = (-_v.y * .5 + .5) * window.innerHeight;
    self.float(x, y, text, cls);
  };
  this.flash = function (cls) {
    E.flash.className = ''; E.flash.classList.add('on');
    if (cls) E.flash.classList.add(cls);
    setTimeout(() => E.flash.classList.remove('on'), 70);
  };
  this.scan = function (on) { E.scan.classList.toggle('on', !!on); };

  /* ==================================================== 对话框 */
  let dlgOpen = false;
  this.dialog = function (o) {
    E.dlgT.innerHTML = o.title || '';
    E.dlgB.innerHTML = o.body || '';
    E.dlgBtn.innerHTML = '';
    (o.buttons || [{ label: '关闭' }]).forEach((b, i) => {
      const btn = document.createElement('button');
      btn.className = 'btn' + (i === 0 ? ' primary' : '') + ' small';
      btn.innerHTML = b.label;
      btn.addEventListener('click', () => {
        SP.Audio.play('ui_click');
        if (b.keep !== true) self.closeDialog();
        if (b.cb) b.cb();
      });
      E.dlgBtn.appendChild(btn);
    });
    E.dlg.classList.remove('hidden');
    dlgOpen = true;
    game.lockPointer(false);
    SP.Audio.play('ui_open');
  };
  this.closeDialog = function () {
    if (!dlgOpen) return;
    dlgOpen = false;
    E.dlg.classList.add('hidden');
    SP.Audio.play('ui_close');
    if (game.wantsPointer) game.lockPointer(true);
  };
  this.dialogOpen = function () { return dlgOpen; };

  /* ==================================================== 阶段过渡 */
  this.stageSplash = function (key, cb) {
    const s = DB.STAGES[key];
    E.stgIco.textContent = s.ico;
    E.stgName.textContent = s.name;
    E.stgDesc.innerHTML = s.desc;
    E.stg.classList.remove('hidden');
    SP.Audio.play('stage_up');
    const go = () => { E.stg.classList.add('hidden'); E.stgGo.removeEventListener('click', go); if (cb) cb(); };
    E.stgGo.addEventListener('click', go);
  };

  /* ==================================================== 暂停 / 死亡 */
  this.showPause = function (on) {
    E.pause.classList.toggle('hidden', !on);
    if (on) {
      const b = game.badges || {};
      E.pauseStats.innerHTML = '<div class="statgrid">' +
        '<div>当前阶段 <b>' + (DB.STAGES[game.stage] ? DB.STAGES[game.stage].name : '-') + '</b></div>' +
        '<div>DNA <b>' + U.fmt(game.dna) + '</b></div>' +
        '<div>金钱 <b>' + U.fmt(game.money) + '</b></div>' +
        '<div>徽章 <b>' + Object.keys(b).length + '/' + DB.BADGES.length + '</b></div>' +
        '<div>物种 <b>' + (game.genome && game.genome.name || '-') + '</b></div>' +
        '<div>游戏时间 <b>' + Math.floor(game.time / 60) + ' 分</b></div>' +
        '</div>';
    }
  };
  this.showDead = function (title, body, cb) {
    E.deadT.textContent = title || '你 死 了';
    E.deadB.innerHTML = body || '';
    E.dead.classList.remove('hidden');
    self._revive = cb;
    SP.Audio.play('die');
  };
  this.hideDead = function () { E.dead.classList.add('hidden'); };

  /* ==================================================== 徽章 */
  this.badge = function (id) {
    if (!game.badges) game.badges = {};
    if (game.badges[id]) return;
    const b = DB.BADGES.find(x => x.id === id);
    if (!b) return;
    game.badges[id] = 1;
    SP.Audio.play('unlock');
    self.toast('<b style="color:#ffc94d">🏅 获得徽章：' + b.ico + ' ' + b.name + '</b><br><span style="font-size:11.5px;opacity:.8">' + b.desc + '</span>', 'good');
  };

  /* ==================================================== 编辑器代理 */
  this.openEditor = function (kind, onDone) {
    if (!SP.Editor) { self.toast('编辑器未载入', 'bad'); return; }
    SP.Editor.open(kind, onDone);
  };
  this.editorOpen = function () { return SP.Editor ? SP.Editor.isOpen() : false; };

  /* ==================================================== 键盘：技能快捷键 */
  window.addEventListener('keydown', (e) => {
    if (game.state !== 'play' || game.paused) return;
    if (dlgOpen || self.editorOpen()) return;
    if (/^Digit[1-9]$/.test(e.code)) self.triggerActionKey(e.code);
  });
};
