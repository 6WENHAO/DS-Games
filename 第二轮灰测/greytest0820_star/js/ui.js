/* ==========================================================================
 * ui.js — DOM side of the interface: garage, HUD readouts, log, tooltip,
 * help, the tutorial panel and the language switch.
 * ==========================================================================*/
(function (global) {
  'use strict';
  const M = global.M;
  const L = global.L;
  const T = global.Tutorial;

  const $ = id => document.getElementById(id);
  const up = s => (L.lang === 'en' ? String(s).toUpperCase() : s);

  /* static markup: element id -> the English literal that lives in index.html */
  const STATIC = {
    titleDrive: 'DRIVETRAIN', titleGun: 'ARMAMENT', titleScore: 'RANGE CONTROL',
    lblMaster: 'Master', lblFuelCock: 'Fuel cock', lblEngine: 'Engine', lblRpm: 'RPM',
    lblGear: 'Gear', lblSpeed: 'Speed', lblFuel: 'Fuel', lblBrake: 'Brake',
    lblGun: 'Gun', lblBreech: 'Breech', lblLoaded: 'Loaded', lblSelected: 'Selected',
    lblCircuit: 'Circuit', lblTraverse: 'Traverse', lblSight: 'Sight', lblRange: 'Range',
    lblShots: 'Rounds fired', lblHits: 'Hits', lblKills: 'Kills', lblLastRange: 'Last range',
    gTitle: 'ARMOUR',
    gSub: 'multi-tank simulator · walk-in crew compartments · every switch does something',
    deployBtn: 'DEPLOY TO THE RANGE',
    gTiny: 'Mouse drag orbits the preview · scroll to zoom',
    helpTitle: 'Controls', helpClose: 'CLOSE', boot: 'building tanks…'
  };

  const HELP = [
    {
      h: ['Crew & views', '乘员与视角'],
      lines: [
        ['<b>1 2 3 4</b> take the driver / gunner / loader / commander station',
          '<b>1 2 3 4</b> 进入驾驶员 / 炮长 / 装填手 / 车长位置'],
        ['<b>V</b> cycle view: interior → sight → periscope → head out → external',
          '<b>V</b> 切换视角：车内 → 炮长镜 → 潜望镜 → 探出舱盖 → 车外'],
        ['<b>Left drag</b> look around &middot; <b>Left click</b> operate a control',
          '<b>按住左键拖动</b> 环视 &middot; <b>左键单击</b> 操作控件'],
        ['<b>Right click</b> a control for its alternate action',
          '<b>右键单击</b> 控件执行备用动作'],
        ['<b>O</b> labels &middot; <b>Tab</b> garage &middot; <b>F1</b> help &middot; <b>F2</b> tutorial',
          '<b>O</b> 控件标签 &middot; <b>Tab</b> 车库 &middot; <b>F1</b> 帮助 &middot; <b>F2</b> 教程']
      ]
    },
    {
      h: ['Driving', '驾驶'],
      lines: [
        ['<b>M</b> master switch &middot; <b>N</b> fuel cock &middot; <b>I</b> starter',
          '<b>M</b> 总电源 &middot; <b>N</b> 燃油阀 &middot; <b>I</b> 起动机'],
        ['<b>Shift / Ctrl</b> gear up / down &middot; <b>P</b> parking brake',
          '<b>Shift / Ctrl</b> 升档 / 降档 &middot; <b>P</b> 驻车制动'],
        ['<b>W S</b> throttle &amp; brake &middot; <b>A D</b> steer',
          '<b>W S</b> 油门与制动 &middot; <b>A D</b> 转向']
      ]
    },
    {
      h: ['Gunnery', '射击'],
      lines: [
        ['<b>Q E</b> traverse &middot; <b>R F</b> elevate &middot; <b>Space</b> fire',
          '<b>Q E</b> 转动炮塔 &middot; <b>R F</b> 高低机 &middot; <b>空格</b> 击发'],
        ['<b>Z</b> select round &middot; <b>B</b> breech &middot; <b>G</b> load &middot; <b>K</b> arm circuit',
          '<b>Z</b> 选择弹种 &middot; <b>B</b> 炮闩 &middot; <b>G</b> 装填 &middot; <b>K</b> 解除击发保险'],
        ['<b>L</b> lase &middot; <b>[ ]</b> range drum &middot; <b>Y</b> magnification &middot; <b>T</b> thermal/night',
          '<b>L</b> 激光测距 &middot; <b>[ ]</b> 表尺鼓轮 &middot; <b>Y</b> 倍率 &middot; <b>T</b> 热像/微光'],
        ['<b>C</b> coax MG &middot; <b>X</b> smoke &middot; <b>H</b> hatch at this station',
          '<b>C</b> 并列机枪 &middot; <b>X</b> 烟幕弹 &middot; <b>H</b> 当前位置的舱盖']
      ]
    }
  ];

  const UI = {
    el: {},
    cache: {},

    init(game) {
      this.game = game;
      const ids = ['hud', 'garage', 'help', 'boot', 'tankName', 'tankMeta', 'viewName', 'stationName',
        'stationBar', 'pMaster', 'pFuelCock', 'pEngine', 'pRpm', 'pRpmBar', 'pGear', 'pSpeed',
        'pFuel', 'pFuelBar', 'pBrake', 'gName', 'gBreech', 'gLoaded', 'gShell', 'gSafety',
        'gTrav', 'gSight', 'gRange', 'ammoList', 'sShots', 'sHits', 'sKills', 'sRange',
        'log', 'tooltip', 'hint', 'garageList', 'giName', 'giMeta', 'giDesc', 'giStats',
        'giNotes', 'giCrew', 'deployBtn', 'helpClose', 'tutBtn', 'tutAuto', 'tutAutoLbl',
        'tutorial', 'tutStepNo', 'tutTitle', 'tutText', 'tutHint', 'tutPrev', 'tutNext', 'tutClose',
        'langEn', 'langZh', 'langBtnHud', 'helpBtnHud', 'titleDrive', 'titleGun', 'titleScore',
        'gTitle', 'gSub', 'gTiny', 'helpTitle', 'helpBody',
        'lblMaster', 'lblFuelCock', 'lblEngine', 'lblRpm', 'lblGear', 'lblSpeed', 'lblFuel',
        'lblBrake', 'lblGun', 'lblBreech', 'lblLoaded', 'lblSelected', 'lblCircuit',
        'lblTraverse', 'lblSight', 'lblRange', 'lblShots', 'lblHits', 'lblKills', 'lblLastRange'];
      for (const id of ids) this.el[id] = $(id);

      this.el.deployBtn.addEventListener('click', () => game.deploy());
      this.el.helpClose.addEventListener('click', () => this.showHelp(false));
      this.el.helpBtnHud.addEventListener('click', () => this.showHelp(true));
      this.el.langEn.addEventListener('click', () => L.set('en'));
      this.el.langZh.addEventListener('click', () => L.set('zh'));
      this.el.langBtnHud.addEventListener('click', () => L.toggle());
      this.el.tutBtn.addEventListener('click', () => game.startTutorial(true));
      this.el.tutClose.addEventListener('click', () => game.stopTutorial());
      this.el.tutNext.addEventListener('click', () => T.next(game));
      this.el.tutPrev.addEventListener('click', () => T.prev(game));

      L.on(() => this.applyLang());
      this.buildGarage();
      this.applyLang();
    },

    /* ------------------------------------------------------- language */
    applyLang() {
      for (const id in STATIC) {
        const el = this.el[id];
        if (el) el.textContent = L.s(STATIC[id]);
      }
      this.el.langEn.className = 'lang' + (L.lang === 'en' ? ' on' : '');
      this.el.langZh.className = 'lang' + (L.lang === 'zh' ? ' on' : '');
      this.el.langBtnHud.textContent = L.lang === 'en' ? '中文' : 'EN';
      this.el.tutBtn.textContent = L.m('TUTORIAL', '教程');
      this.el.tutAutoLbl.textContent = L.m('start the tutorial after deploying', '部署后自动开始教程');
      // help
      this.el.helpBody.innerHTML = HELP.map(sec =>
        '<div><h3>' + L.m(sec.h[0], sec.h[1]) + '</h3>' +
        sec.lines.map(l => '<p>' + L.m(l[0], l[1]) + '</p>').join('') + '</div>').join('');
      this.buildGarage();
      if (this.game && this.game.selected) this.selectCard(this.game.selected);
      if (this.game && this.game.player) {
        this.buildStationBar(this.game.player, this.game.station, (id) => this.game.setStation(id));
      }
      this.cache = {};            // force every readout to repaint in the new language
    },

    /* ------------------------------------------------------------ garage */
    buildGarage() {
      const list = this.el.garageList;
      list.innerHTML = '';
      global.TANKS.forEach((spec) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.id = spec.id;
        card.innerHTML = '<h3>' + L.s(spec.short) + '</h3>' +
          '<div class="cmeta"><span class="cflag">' + spec.flag + '</span>' +
          '<span>' + spec.year + '</span><span>' + L.s(spec.cls) + '</span>' +
          '<span>' + spec.crew + ' ' + L.m('crew', '名乘员') + '</span></div>';
        card.addEventListener('click', () => this.game.selectTank(spec.id));
        list.appendChild(card);
      });
    },

    showGarage(show) {
      this.el.garage.classList.toggle('hidden', !show);
      this.el.hud.classList.toggle('hidden', show);
    },

    selectCard(id) {
      const spec = global.tankById(id);
      for (const c of this.el.garageList.children) c.classList.toggle('on', c.dataset.id === id);
      this.el.giName.textContent = L.s(spec.name);
      this.el.giMeta.textContent = L.s(spec.nation) + ' · ' + spec.year + ' · ' + L.s(spec.cls) +
        ' · ' + spec.mass + ' t · ' + spec.powerHp + ' hp';
      this.el.giDesc.textContent = L.s(spec.desc);
      const stat = (label, v, max, text) =>
        '<div class="stat"><span>' + L.s(label) + '</span><div class="sbar"><i style="width:' +
        Math.round(M.clamp01(v / max) * 100) + '%"></i></div><b>' + text + '</b></div>';
      this.el.giStats.innerHTML =
        stat('Top speed', spec.maxSpeed, 70, spec.maxSpeed + ' km/h') +
        stat('Power', spec.powerHp, 1500, spec.powerHp + ' hp') +
        stat('Gun calibre', spec.gun.cal, 125, spec.gun.cal + ' mm') +
        stat('Muzzle vel.', spec.gun.mv, 1700, spec.gun.mv + ' m/s') +
        stat('Reload', 10 - spec.gun.reload, 10, spec.gun.reload.toFixed(1) + ' s') +
        stat('Traverse', spec.gun.traverse, 45, spec.gun.traverse + ' °/s') +
        stat('Hull armour', spec.armor.hull, 900, spec.armor.hull + ' mm') +
        stat('Turret armour', spec.armor.turret, 900, spec.armor.turret + ' mm');
      this.el.giNotes.innerHTML = spec.notes.map(n => '<li>' + L.s(n) + '</li>').join('');
      const roles = { driver: 'DRIVER', gunner: 'GUNNER', loader: 'LOADER', commander: 'COMMANDER' };
      this.el.giCrew.innerHTML = spec.stations.map(s => '<span>' + L.s(roles[s] || s) + '</span>').join('') +
        (spec.autoloader ? '<span>' + L.s('AUTOLOADER') + '</span>' : '');
    },

    showHelp(show) { this.el.help.classList.toggle('hidden', !show); },
    helpVisible() { return !this.el.help.classList.contains('hidden'); },
    boot(done) { this.el.boot.classList.toggle('hidden', !!done); },
    autoTutorial() { return !!(this.el.tutAuto && this.el.tutAuto.checked); },

    /* ------------------------------------------------------ station bar */
    buildStationBar(tank, current, onPick) {
      const bar = this.el.stationBar;
      bar.innerHTML = '';
      tank.spec.stations.forEach((id, i) => {
        const st = tank.interior.stations[id];
        const b = document.createElement('button');
        b.textContent = (i + 1) + ' ' + up(L.s(st ? st.name : id));
        b.className = id === current ? 'on' : '';
        b.addEventListener('click', () => onPick(id));
        bar.appendChild(b);
      });
    },
    markStation(current) {
      const bar = this.el.stationBar;
      const ids = this.game.player.spec.stations;
      for (let i = 0; i < bar.children.length; i++) {
        bar.children[i].classList.toggle('on', ids[i] === current);
      }
    },

    /* --------------------------------------------------------------- log */
    log(msg) {
      if (!msg) return;
      const d = document.createElement('div');
      d.textContent = msg;
      this.el.log.appendChild(d);
      setTimeout(() => { d.remove(); }, 8000);
      while (this.el.log.children.length > 5) this.el.log.firstChild.remove();
    },

    tooltip(x, y, title, status, hint) {
      const t = this.el.tooltip;
      if (!title) { t.classList.add('hidden'); return; }
      t.classList.remove('hidden');
      t.innerHTML = '<b>' + title + '</b><span>' + (status || '') + '</span>' +
        (hint ? '<i>' + hint + '</i>' : '');
      const w = t.offsetWidth || 200, h = t.offsetHeight || 40;
      t.style.left = Math.min(global.innerWidth - w - 8, x + 16) + 'px';
      t.style.top = Math.min(global.innerHeight - h - 8, y + 14) + 'px';
    },

    hint(text) {
      const h = this.el.hint;
      if (!text) { h.classList.add('hidden'); return; }
      h.classList.remove('hidden');
      h.textContent = text;
    },

    set(id, text, cls) {
      const el = this.el[id];
      if (!el) return;
      if (this.cache[id] !== text) { el.textContent = text; this.cache[id] = text; }
      if (cls !== undefined) {
        const k = id + '_c';
        if (this.cache[k] !== cls) { el.className = 'v' + (cls ? ' ' + cls : ''); this.cache[k] = cls; }
      }
    },
    bar(id, frac, hot) {
      const el = this.el[id];
      if (!el) return;
      const w = Math.round(M.clamp01(frac) * 100);
      if (this.cache[id] !== w) { el.style.width = w + '%'; this.cache[id] = w; }
      const cls = hot ? 'hot' : '';
      if (this.cache[id + '_c'] !== cls) { el.className = cls; this.cache[id + '_c'] = cls; }
    },

    /* ----------------------------------------------------- tutorial panel */
    tutorial(game) {
      const el = this.el.tutorial;
      if (!T || !T.active) { el.classList.add('hidden'); return; }
      el.classList.remove('hidden');
      el.className = T.flash > 0 ? 'flash' : '';
      this.set2('tutStepNo', T.stepLabel());
      this.set2('tutTitle', T.title());
      this.set2('tutText', T.text(game));
      this.set2('tutHint', T.hint());
      const last = T.idx >= T.steps.length - 1;
      this.set2('tutNext', last ? L.m('FINISH', '完成') : L.m('SKIP ▶', '跳过 ▶'));
      this.set2('tutPrev', L.m('◀ BACK', '◀ 上一步'));
    },
    set2(id, text) {
      const el = this.el[id];
      if (!el) return;
      if (this.cache['t_' + id] !== text) { el.textContent = text; this.cache['t_' + id] = text; }
    },

    /* --------------------------------------------------------- HUD tick */
    update(game) {
      const t = game.player, s = t.sys, spec = t.spec;
      this.set('tankName', L.s(spec.name));
      this.set('tankMeta', L.s(spec.nation) + ' · ' + spec.year + ' · ' + L.s(spec.gun.name));
      this.set('viewName', L.s(game.viewLabel()));
      this.el.viewName.className = 'tag';
      const st = t.interior.stations[game.station];
      this.set('stationName', up(L.s(st ? st.name : '—')));
      this.el.stationName.className = 'tag amber';

      this.set('pMaster', L.s(s.master ? 'ON' : 'OFF'), s.master ? 'good' : 'bad');
      this.set('pFuelCock', L.s(s.fuelCock ? 'OPEN' : 'SHUT'), s.fuelCock ? 'good' : 'bad');
      this.set('pEngine', L.s(s.engineOn ? 'RUNNING' : (s.starting > 0 ? 'CRANKING' : 'STOPPED')),
        s.engineOn ? 'good' : s.starting > 0 ? 'warn' : 'bad');
      this.set('pRpm', String(Math.round(s.rpm)));
      this.bar('pRpmBar', t.rpmFrac(), t.rpmFrac() > 0.85);
      this.set('pGear', L.s(t.gearName()), s.gear === 0 ? '' : 'good');
      this.set('pSpeed', Math.abs(t.speedKmh()).toFixed(0) + ' km/h');
      this.set('pFuel', Math.round(s.fuel * 100) + '%');
      this.bar('pFuelBar', s.fuel, s.fuel < 0.2);
      this.set('pBrake', L.s(s.parkBrake ? 'SET' : 'OFF'), s.parkBrake ? 'warn' : '');

      this.set('gName', L.s(spec.gun.name));
      this.set('gBreech', L.s(s.breechOpen ? 'OPEN' : 'CLOSED'), s.breechOpen ? 'warn' : '');
      this.set('gLoaded', s.loaded ? L.shell(s.loaded)
        : (s.loadT > 0 ? L.m('LOADING ', '装填中 ') + s.loadT.toFixed(1) + 's' : L.s('EMPTY')),
        s.loaded ? 'good' : s.loadT > 0 ? 'warn' : 'bad');
      this.set('gShell', L.shell(s.shell));
      this.set('gSafety', L.s(s.safety ? 'SAFE' : 'ARMED'), s.safety ? 'warn' : 'good');
      this.set('gTrav', L.s(s.traverseMode === 'power' ? 'POWER' : 'MANUAL') +
        (s.turretPower ? '' : ' / ' + L.m('NO PWR', '无电')),
        s.turretPower && s.traverseMode === 'power' ? 'good' : 'warn');
      this.set('gSight', L.s(s.sight.mode.toUpperCase()) + ' x' + t.zoomText());
      this.set('gRange', s.sight.range + ' m' + (s.sight.lased ? ' ✱' : ''));

      let html = '';
      for (const k in s.ammo) {
        html += '<div class="' + (k === s.shell ? 'sel' : '') + '"><span>' + L.shell(k) +
          '</span><b>' + s.ammo[k] + '</b></div>';
      }
      html += '<div><span>' + L.s('MG belt') + '</span><b>' + s.mgAmmo + '</b></div>';
      if (this.cache.ammo !== html) { this.el.ammoList.innerHTML = html; this.cache.ammo = html; }

      this.set('sShots', String(s.shots));
      this.set('sHits', String(s.hits));
      this.set('sKills', String(s.kills));
      this.set('sRange', game.lastRange ? game.lastRange + ' m' : '—');

      this.tutorial(game);
    }
  };

  global.UI = UI;
})(typeof window !== 'undefined' ? window : globalThis);
