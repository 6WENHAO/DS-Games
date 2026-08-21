/* ==========================================================================
 * main.js — glue: input, cameras, rendering of the interior/exterior views,
 * hotspot picking, gunnery resolution and the frame loop.
 * ==========================================================================*/
(function (global) {
  'use strict';
  const M = global.M, C = global.C;
  const L = global.L || { m: (en) => en, s: (s) => s, shell: (s) => s, lang: 'en' };
  const TUT = global.Tutorial;

  const VIEWS = ['interior', 'sight', 'periscope', 'unbutton', 'exterior'];
  const VIEW_LABEL = {
    interior: 'INTERIOR', sight: 'GUNNER SIGHT', periscope: 'PERISCOPE',
    unbutton: 'HEAD OUT', exterior: 'EXTERNAL'
  };

  /* cached bits of geometry used by the interior renderer */
  let SKY_PATCH = null, HOT_RING = null;
  function ensureCommon() {
    if (SKY_PATCH) return;
    SKY_PATCH = global.buildMesh(mb => {
      mb.disc([0, 0, 0], 'y', 0.36, 12, [225, 236, 250], { glow: 0.95, flat: true });
      mb.disc([0, -0.02, 0], 'y', 0.30, 12, [255, 255, 255], { glow: 1, flat: true });
    });
    HOT_RING = global.buildMesh(mb => {
      mb.ring([0, 0, 0.05], 'z', 0.115, 0.09, 14, [255, 236, 160], { glow: 0.9, flat: true });
    });
  }

  class Game {
    constructor() {
      this.canvas = document.getElementById('view');
      this.r = new global.Renderer(this.canvas);
      this.sfx = new global.Sfx();
      this.world = new global.World(11);
      this.mode = 'garage';
      this.selected = 'sherman';
      this.player = null;
      this.station = 'driver';
      this.view = 'interior';
      this.look = { yaw: 0, pitch: 0 };
      this.orbit = { yaw: 2.5, pitch: 0.26, dist: 15 };
      this.preview = { yaw: 0.9, pitch: 0.2, dist: 13 };
      this.labels = true;
      this.keys = {};
      this.mouse = { x: 0, y: 0, down: 0, drag: false, dx: 0, dy: 0, hot: null };
      this.projected = [];
      this.shake = 0;
      this.lastRange = 0;
      this.viewDist = 520;
      this.frameAvg = 16;
      this.time = 0;
      this.mapOpen = false;
      ensureCommon();
    }

    /* ================================================================ init */
    start() {
      global.UI.init(this);
      this.selectTank('sherman');
      this.bindInput();
      this.resize();
      global.UI.showGarage(true);
      global.UI.boot(true);
      this.loop = this.loop.bind(this);
      this.last = performance.now();
      requestAnimationFrame(this.loop);
    }

    selectTank(id) {
      this.selected = id;
      global.UI.selectCard(id);
      // touch the model + interior now so the first frame after deploy is smooth
      const spec = global.tankById(id);
      global.getTankModel(spec);
      global.Interiors.get(spec);
    }

    deploy() {
      const spec = global.tankById(this.selected);
      const T = this.world.terrain;
      const pos = [6, 0, -4];
      pos[1] = T.height(pos[0], pos[2]);
      this.player = new global.Sim.TankSim(spec, this.world, { pos, yaw: 0.05 });
      this.player.onEvent = (kind, arg) => this.onTankEvent(kind, arg);
      this.station = spec.stations[0];
      this.view = 'interior';
      this.look.yaw = 0; this.look.pitch = 0;
      this.mode = 'play';
      global.UI.showGarage(false);
      global.UI.buildStationBar(this.player, this.station, (id) => this.setStation(id));
      this.sfx.resume();
      this.msg(L.m('You climb into the ' + spec.short + '. ' + spec.crew +
        ' crew stations — press 1-4 to move around.',
        '你钻进了' + L.s(spec.short) + '。共有 ' + spec.crew + ' 个乘员位置——按 1-4 键换位。'));
      if (this.wantTutorial || (global.UI.autoTutorial() && TUT && !TUT.seen())) {
        this.wantTutorial = false;
        this.startTutorial(false);
      } else {
        this.msg(L.m('Driver: master switch (M), fuel cock (N), starter (I). Or just click the switches.',
          '驾驶员：总电源（M）、燃油阀（N）、起动机（I）。也可以直接点这些开关。'));
      }
    }

    startTutorial(fromGarage) {
      if (!TUT) return;
      if (fromGarage && this.mode !== 'play') {
        // the garage button deploys straight into the tutorial
        this.wantTutorial = true;
        this.deploy();
        return;
      }
      TUT.start(this);
      this.msg(L.m('Tutorial started — follow the panel on the left.', '教程已开始——按左侧面板提示操作。'));
    }
    stopTutorial() {
      if (!TUT) return;
      TUT.stop(this);
      global.UI.tutorial(this);
      this.msg(L.m('Tutorial closed. Press F2 to bring it back.', '教程已关闭。按 F2 可以重新打开。'));
    }

    returnToGarage() {
      this.mode = 'garage';
      global.UI.showGarage(true);
      global.UI.tooltip(null);
      global.UI.hint(null);
    }

    /* =============================================================== input */
    bindInput() {
      const cv = this.canvas;
      window.addEventListener('resize', () => this.resize());
      window.addEventListener('keydown', (e) => this.onKey(e, true));
      window.addEventListener('keyup', (e) => this.onKey(e, false));
      cv.addEventListener('contextmenu', e => e.preventDefault());
      cv.addEventListener('mousedown', (e) => {
        this.sfx.resume();
        this.mouse.down = e.button === 2 ? 2 : 1;
        this.mouse.drag = false;
        this.mouse.sx = e.clientX; this.mouse.sy = e.clientY;
      });
      window.addEventListener('mouseup', (e) => {
        if (this.mouse.down && !this.mouse.drag) this.click(e.button === 2 ? 2 : 1);
        this.mouse.down = 0;
        this.mouse.drag = false;
      });
      window.addEventListener('mousemove', (e) => {
        const rect = cv.getBoundingClientRect();
        this.mouse.x = e.clientX - rect.left;
        this.mouse.y = e.clientY - rect.top;
        if (this.mouse.down) {
          const dx = e.clientX - (this.mouse.px === undefined ? e.clientX : this.mouse.px);
          const dy = e.clientY - (this.mouse.py === undefined ? e.clientY : this.mouse.py);
          if (Math.abs(e.clientX - this.mouse.sx) + Math.abs(e.clientY - this.mouse.sy) > 5) this.mouse.drag = true;
          if (this.mouse.drag) { this.mouse.dx += dx; this.mouse.dy += dy; }
        }
        this.mouse.px = e.clientX; this.mouse.py = e.clientY;
      });
      cv.addEventListener('wheel', (e) => {
        e.preventDefault();
        const s = Math.sign(e.deltaY);
        if (this.mode === 'garage') this.preview.dist = M.clamp(this.preview.dist + s * 1.2, 6, 34);
        else if (this.view === 'exterior') this.orbit.dist = M.clamp(this.orbit.dist + s * 1.6, 6, 46);
        else if (this.view === 'sight' && this.player) this.msg(this.player.cycleZoom());
      }, { passive: false });
    }

    onKey(e, down) {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (down && (k === 'F1' || k === '?')) {
        global.UI.showHelp(!global.UI.helpVisible());
        e.preventDefault();
        return;
      }
      if (down && k === 'F2') {
        e.preventDefault();
        if (TUT && TUT.active) this.stopTutorial();
        else this.startTutorial(this.mode !== 'play');
        return;
      }
      if (down && k === 'Tab') {
        e.preventDefault();
        if (this.mode === 'play') this.returnToGarage();
        else if (this.player) { this.mode = 'play'; global.UI.showGarage(false); }
        return;
      }
      if (down && k === 'Escape') {
        global.UI.showHelp(false);
        if (this.mode === 'play') this.returnToGarage();
        return;
      }
      if (this.mode !== 'play' || !this.player) return;
      this.keys[k] = down;
      if (!down) return;
      const t = this.player;
      switch (k) {
        case 'v': this.cycleView(); break;
        case '1': case '2': case '3': case '4': {
          const st = t.spec.stations[parseInt(k, 10) - 1];
          if (st) this.setStation(st);
          break;
        }
        case 'm': this.msg(t.toggleMaster(), 'switch'); break;
        case 'n': this.msg(t.toggleFuel(), 'switch'); break;
        case 'i': this.msg(t.pressStarter(), 'button'); break;
        case 'p': this.msg(t.toggleBrake(), 'clank'); break;
        case 'Shift': this.msg(t.shiftUp(), 'clank'); break;
        case 'Control': this.msg(t.shiftDown(), 'clank'); break;
        case 'b': this.msg(t.toggleBreech(), 'breech'); break;
        case 'g': this.msg(t.loadRound(), t.spec.autoloader ? 'autoload' : 'load'); break;
        case 'k': this.msg(t.toggleSafety(), 'switch'); break;
        case 'z': this.msg(t.cycleShell(), 'switch'); break;
        case 'l': this.msg(t.lase(), 'lase'); break;
        case 'y': this.msg(t.cycleZoom(), 'switch'); break;
        case 't': this.msg(t.cycleVision(), 'switch'); break;
        case 'x': this.msg(t.fireSmoke(), 'smoke'); break;
        case 'c': this.msg(t.fireCoax()); break;
        case 'h': {
          const st = t.interior.stations[this.station];
          const id = (st && t.sys.hatches[this.station] !== undefined) ? this.station : 'commander';
          this.msg(t.toggleHatch(id), 'hatch');
          break;
        }
        case 'o': this.labels = !this.labels;
          this.msg(L.m('Control labels ' + (this.labels ? 'on.' : 'off.'),
            '控件标签已' + (this.labels ? '显示。' : '隐藏。'))); break;
        case '[': this.msg(t.adjustRange(-100), 'switch'); break;
        case ']': this.msg(t.adjustRange(100), 'switch'); break;
        case ' ':
          e.preventDefault();
          this.msg(t.fire());
          break;
        case 'r': case 'f': case 'q': case 'e': case 'w': case 'a': case 's': case 'd': break;
        default: break;
      }
    }

    setStation(id) {
      if (!this.player.interior.stations[id]) return;
      this.station = id;
      this.look.yaw = 0; this.look.pitch = 0;
      if (this.view === 'sight' && id !== 'gunner') this.view = 'interior';
      global.UI.markStation(id);
      const st = this.player.interior.stations[id];
      this.msg(L.m('You slide into the ' + st.name + "'s seat. " + st.role,
        '你坐进了' + L.s(st.name) + '的位置。' + L.s(st.role)));
      this.sfx.play('clank');
    }

    cycleView() {
      let i = VIEWS.indexOf(this.view);
      for (let n = 0; n < VIEWS.length; n++) {
        i = (i + 1) % VIEWS.length;
        const v = VIEWS[i];
        if (v === 'sight' && this.station !== 'gunner') continue;
        if (v === 'unbutton' && this.player.sys.hatches[this.station] < 0.5 &&
          this.player.sys.hatches.commander < 0.5) continue;
        this.setView(v);
        return;
      }
    }

    setView(v) {
      this.view = v;
      this.look.yaw = 0; this.look.pitch = 0;
      this.sfx.setInterior(v === 'interior' || v === 'sight' || v === 'periscope',
        this.player && this.player.sys.hatches[this.station] > 0.5);
    }

    /** called by interior hotspots (sights and periscopes) */
    useOptic(kind, station) {
      if (kind === 'sight') {
        if (this.station !== 'gunner') this.setStation('gunner');
        this.setView('sight');
        return L.m('Eye to the sight. ' + this.player.sys.sight.mode.toUpperCase() +
          ' channel, x' + this.player.zoomText() + '.',
          '眼睛贴上瞄准镜。' + L.s(this.player.sys.sight.mode.toUpperCase()) +
          '通道，' + this.player.zoomText() + ' 倍。');
      }
      if (station && station !== this.station && this.player.interior.stations[station]) this.setStation(station);
      this.setView('periscope');
      return L.m('Looking through the periscope.', '正在通过潜望镜观察。');
    }

    toggleMap() {
      this.mapOpen = !this.mapOpen;
      return L.m('Map board: you are at grid ' + this.gridRef() + ', range fan bears north.',
        '地图板：你位于坐标 ' + this.gridRef() + '，靶道朝北展开。');
    }
    gridRef() {
      const p = this.player ? this.player.pos : [0, 0, 0];
      const ex = String.fromCharCode(65 + M.clamp(Math.floor((p[0] + 384) / 77), 0, 9));
      const nz = 1 + M.clamp(Math.floor((p[2] + 384) / 77), 0, 9);
      return ex + nz + '-' + (Math.abs(Math.round(p[0])) % 100).toString().padStart(2, '0');
    }

    msg(text, sound) {
      if (text) global.UI.log(text);
      if (sound) this.sfx.play(sound);
      else if (text) this.sfx.play('switch');
    }

    onTankEvent(kind, arg) {
      const t = this.player;
      switch (kind) {
        case 'fire': {
          this.sfx.play('fire');
          this.shake = 1;
          // fumes in the fighting compartment when the breech opens
          const bm = t.turretMatrix();
          const b = t.interior.breech;
          const p = M.xformPoint(bm, [0, b.y + 0.1, b.z - 0.3]);
          this.world.fx.burst('fume', p, 7, {
            speed: 0.7, col: [140, 138, 132], col2: [90, 90, 88], size: 0.22,
            life: 2.4, alpha: 0.34, grow: 2.6, gravity: 0.12, up: 1.1
          });
          break;
        }
        case 'starter': this.sfx.play('starter'); break;
        case 'ram': this.sfx.play('load'); break;
        case 'autoload': this.sfx.play('autoload'); break;
        case 'loaded': this.sfx.play('ready');
          global.UI.log(L.m('Loader: "UP!" — ' + arg + ' loaded.',
            '装填手：“好！”——' + L.shell(arg) + '已入膛。'));
          break;
        case 'breech': this.sfx.play('breech'); break;
        case 'mg': this.sfx.play('mg'); break;
        case 'smoke': this.sfx.play('smoke'); break;
        case 'slew': this.sfx.play('clank'); break;
      }
    }

    /* ============================================================== update */
    resize() {
      const w = window.innerWidth, h = window.innerHeight;
      // full device pixels on modest windows, 1:1 on very large ones — this is a
      // software rasteriser and fill rate is the whole budget
      const cap = (w * h) > 2100000 ? 1 : 2;
      const dpr = Math.min(cap, global.devicePixelRatio || 1);
      this.r.setSize(w, h, dpr);
    }

    loop(ts) {
      const dtRaw = (ts - this.last) / 1000;
      this.last = ts;
      const dt = M.clamp(dtRaw, 0.0005, 0.05);
      this.frameAvg = this.frameAvg * 0.92 + dtRaw * 1000 * 0.08;
      // adaptive quality so weak machines still get a smooth picture
      if (this.frameAvg > 26) {
        if (this.viewDist > 260) this.viewDist -= 4;
        else this.r.seamFix = false;
      } else if (this.frameAvg < 15) {
        this.r.seamFix = true;
        if (this.viewDist < 560) this.viewDist += 2;
      }
      this.time += dt;
      // A frame must never be allowed to escape: if update or render throws, the
      // loop would stop re-scheduling and the flat background painted by
      // begin() would sit frozen on screen looking like a single colour.
      try {
        this.update(dt);
        this.render();
        this.frameErrors = 0;
      } catch (e) {
        this.errTotal = (this.errTotal || 0) + 1;
        this.frameErrors = (this.frameErrors || 0) + 1;
        if (this.errTotal <= 3) {
          if (global.console) console.error('[armour] frame error', e);
          if (global.UI) global.UI.log(L.m('frame error caught: ', '已捕获渲染错误：') + (e && e.message ? e.message : e));
        }
        // if a view keeps failing, fall back to the one that always works
        if (this.frameErrors === 4 && this.view !== 'exterior') {
          this.view = 'exterior';
          this.look.yaw = 0; this.look.pitch = 0;
          if (global.UI) global.UI.log(L.m('Recovered to the external view.', '已自动切回车外视角。'));
        }
        try { this.r.flush(); } catch (e2) { /* nothing more we can do this frame */ }
      }
      requestAnimationFrame(this.loop);
    }

    update(dt) {
      const mouse = this.mouse;
      // ---- mouse look / drag ----
      let dragTraverse = 0, dragElev = 0;
      if (mouse.drag && mouse.down) {
        const gain = 0.0032;
        if (this.mode === 'garage') {
          this.preview.yaw -= mouse.dx * gain * 1.6;
          this.preview.pitch = M.clamp(this.preview.pitch + mouse.dy * gain * 1.2, -0.2, 1.2);
        } else if (this.view === 'exterior') {
          this.orbit.yaw -= mouse.dx * gain * 1.6;
          this.orbit.pitch = M.clamp(this.orbit.pitch + mouse.dy * gain * 1.2, -0.25, 1.25);
        } else if (this.view === 'sight') {
          dragTraverse = M.clamp(mouse.dx * 0.06, -1, 1);
          dragElev = M.clamp(-mouse.dy * 0.06, -1, 1);
        } else {
          this.look.yaw -= mouse.dx * gain * 1.5;
          this.look.pitch = M.clamp(this.look.pitch + mouse.dy * gain * 1.5, -1.1, 1.1);
          const st = this.player && this.player.interior.stations[this.station];
          const lim = st ? st.yawRange : 2.2;
          this.look.yaw = M.clamp(this.look.yaw, -lim, lim);
        }
      }
      mouse.dx = 0; mouse.dy = 0;

      this.world.update(dt);

      if (this.mode !== 'play' || !this.player) return;
      const t = this.player, k = this.keys;
      const input = {
        throttle: (k['w'] ? 1 : 0),
        brakePedal: (k['s'] ? 1 : 0),
        steer: (k['d'] ? 1 : 0) - (k['a'] ? 1 : 0),
        traverse: M.clamp((k['e'] ? 1 : 0) - (k['q'] ? 1 : 0) + dragTraverse, -1, 1),
        elevate: M.clamp((k['r'] ? 1 : 0) - (k['f'] ? 1 : 0) + dragElev, -1, 1)
      };
      t.update(dt, input);
      this.shake = Math.max(0, this.shake - dt * 3.2);
      if (TUT) TUT.update(this, dt);

      // ---- ballistics ----
      this.world.shells.update(dt, this.world, (s, hit) => this.resolveHit(s, hit));

      // ---- engine sound + cabin muffling ----
      const inside = this.view === 'interior' || this.view === 'sight' || this.view === 'periscope';
      this.sfx.engine(t.sys.engineOn, t.sys.rpm, t.ctrl.throttle,
        t.spec.id === 'abrams', t.speed);
      this.sfx.setInterior(inside, t.sys.hatches[this.station] > 0.5);

      // ---- hotspot picking from the previous frame's projection ----
      mouse.hot = null;
      if (this.view === 'interior') {
        const eye = t.stationEye(this.station);
        let best = 1e9;
        for (const p of this.projected) {
          const dx = p.x - mouse.x, dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > p.r * p.r) continue;
          const reach = M.dist(eye, p.world);
          if (reach > 2.3) continue;
          if (d2 < best) { best = d2; mouse.hot = p; }
        }
      }

      global.UI.update(this);
      this.updateHints();
    }

    resolveHit(s, hit) {
      const world = this.world, t = this.player;
      const isPlayer = s.owner === t;
      if (hit.kind === 'ground') {
        const p = [s.p[0], hit.y, s.p[2]];
        const dist = M.dist(p, t.pos);
        if (s.mg) {
          world.fx.burst('dust', p, 3, { speed: 2.2, col: world.dustColor, size: 0.22, life: 0.7, alpha: 0.5, grow: 2, up: 1.4 });
          return;
        }
        world.fx.burst('dust', p, 22, {
          speed: 9, col: world.dustColor, col2: [120, 112, 98], size: 1.0,
          life: 2.8, alpha: 0.55, grow: 3.2, up: 1.6
        });
        world.fx.burst('flash', p, 6, {
          speed: 5, col: [255, 190, 110], size: 0.7, life: 0.35, alpha: 0.8, glow: true, up: 1.2
        });
        this.sfx.play('explode', { dist });
        if (isPlayer) {
          const r = Math.round(M.dist(t.pos, p));
          this.lastRange = r;
          global.UI.log(L.m('Splash — short/over at ' + r + ' m. Adjust and re-engage.',
            '落点：' + r + ' 米处偏离。修正后再打。'));
        }
        return;
      }
      // vehicle hit
      const tgt = hit.target;
      const p = M.copy(s.p);
      const dist = M.dist(p, t.pos);
      if (s.mg) {
        world.fx.burst('spark', p, 4, { speed: 4, col: [255, 220, 160], size: 0.16, life: 0.4, alpha: 0.9, glow: true });
        this.sfx.play('ricochet', { dist });
        return;
      }
      const range = M.dist(s.owner ? s.owner.pos : t.pos, tgt.pos);
      const shell = s.shell;
      const kinetic = !!(shell.pen && s.type !== 'HE');
      const pen = shell.pen * (kinetic ? Math.max(0.45, 1 - range * 0.00022) : 1);
      const through = pen > tgt.armor;
      let dmg = through ? shell.dmg : shell.dmg * 0.22;
      if (s.type === 'HE') dmg = shell.dmg * (tgt.armor > 120 ? 0.35 : 0.8);
      tgt.hp -= dmg;
      if (isPlayer) {
        t.sys.hits++;
        this.lastRange = Math.round(range);
      }
      world.fx.burst('flash', p, 10, {
        speed: 7, col: through ? [255, 220, 150] : [255, 170, 90], size: 0.7,
        life: 0.4, alpha: 0.95, glow: true, up: 1.2
      });
      world.fx.burst('smoke', p, 10, {
        speed: 4, col: [90, 86, 82], col2: [150, 148, 144], size: 0.7, life: 2.2, alpha: 0.5, grow: 2.6, up: 1.1
      });
      this.sfx.play(through ? 'hit' : 'ricochet', { dist });
      if (tgt.hp <= 0 && !tgt.dead) {
        tgt.dead = true;
        tgt.deadT = 0;
        if (isPlayer) t.sys.kills++;
        world.fx.burst('kill', M.add(tgt.pos, [0, 1.6, 0]), 26, {
          speed: 11, col: [255, 190, 90], col2: [70, 68, 66], size: 1.3, life: 2.6,
          alpha: 0.9, glow: true, grow: 3, up: 1.5
        });
        this.sfx.play('explode', { dist });
        global.UI.log(L.m('TARGET DESTROYED at ' + Math.round(range) + ' m — ' + tgt.spec.short +
          ' knocked out with ' + s.type + '.',
          '目标被击毁：' + Math.round(range) + ' 米处的' + L.s(tgt.spec.short) +
          '被' + L.shell(s.type) + '击穿。'));
      } else {
        global.UI.log(L.m(
          (through ? 'HIT — penetration' : 'HIT — no penetration (' + Math.round(pen) +
            ' mm vs ' + tgt.armor + ' mm)') + ' at ' + Math.round(range) + ' m.',
          (through ? '命中——已击穿' : '命中——未击穿（' + Math.round(pen) +
            ' 毫米 对 ' + tgt.armor + ' 毫米）') + '，距离 ' + Math.round(range) + ' 米。'));
      }
    }

    updateHints() {
      const t = this.player, s = t.sys;
      // the tutorial owns the hint line while it is running
      if (TUT && TUT.active) { global.UI.hint(null); return; }
      let h = null;
      if (!s.master) {
        h = L.m('Driver: throw the MASTER BATTERY switch (M) — the red toggle on the dash.',
          '驾驶员：合上主蓄电池开关（M）——仪表板上那个红色拨杆。');
      } else if (!s.fuelCock) {
        h = L.m('Driver: open the FUEL COCK (N) before cranking.', '驾驶员：起动前先打开燃油阀（N）。');
      } else if (!s.engineOn && s.starting <= 0) {
        h = L.m('Driver: press the STARTER (I).', '驾驶员：按下起动按钮（I）。');
      } else if (s.parkBrake) {
        h = L.m('Driver: release the PARKING BRAKE (P).', '驾驶员：松开驻车制动（P）。');
      } else if (s.gear === 0) {
        h = L.m('Driver: select a gear (Shift up / Ctrl down), then throttle with W.',
          '驾驶员：挂档（Shift 升档 / Ctrl 降档），然后用 W 加油门。');
      } else if (!s.loaded && s.loadT <= 0) {
        h = t.spec.autoloader
          ? L.m('Gunner: press the AUTOLOADER (G) to cycle a round.', '炮长：按 G 让自动装弹机上弹。')
          : (s.breechOpen
            ? L.m('Loader: RAM A ROUND (G).', '装填手：推弹入膛（G）。')
            : L.m('Loader: open the BREECH (B), then load (G).', '装填手：先打开炮闩（B），再装填（G）。'));
      } else if (s.safety) {
        h = L.m('Gunner: ARM the firing circuit (K), then Space to fire.',
          '炮长：解除击发保险（K），然后按空格击发。');
      } else if (this.view === 'interior' && this.station === 'gunner') {
        h = L.m('Click the sight (or V) to look through it. Q/E traverse, R/F elevate.',
          '点击瞄准镜（或按 V）从镜内观察。Q/E 转塔，R/F 俯仰。');
      }
      global.UI.hint(h);
    }

    /* ============================================================== camera */
    interiorAmbient(t) {
      const itr = t.interior;
      let amb = itr.ambient;
      if (t.sys.lights.interior && t.sys.master) amb += 0.30;
      let open = 0;
      for (const k in t.sys.hatches) open = Math.max(open, t.sys.hatches[k]);
      amb += open * 0.26;
      return M.clamp(amb, 0.12, 0.95);
    }

    buildCamera() {
      const r = this.r, world = this.world;
      const cam = {
        pos: [0, 2, 0], yaw: 0, pitch: 0, roll: 0, fov: 64,
        sky: world.sky, light: world.light, fog: world.fog, vision: 'day'
      };
      if (this.mode === 'garage') {
        const T = world.terrain;
        const c = [-8, T.height(-8, -18) + 1.3, -18];
        const p = this.preview;
        cam.pos = [
          c[0] - Math.sin(p.yaw) * Math.cos(p.pitch) * p.dist,
          c[1] + Math.sin(p.pitch) * p.dist,
          c[2] - Math.cos(p.yaw) * Math.cos(p.pitch) * p.dist
        ];
        cam.yaw = p.yaw; cam.pitch = -p.pitch; cam.fov = 46;
        return cam;
      }
      const t = this.player;
      const shake = this.shake * this.shake;
      const vib = (t.sys.engineOn ? 0.0016 + t.ctrl.throttle * 0.0035 : 0) +
        Math.min(0.004, Math.abs(t.speed) * 0.0009);
      const jx = (Math.random() - 0.5), jy = (Math.random() - 0.5);
      switch (this.view) {
        case 'interior': {
          const st = t.interior.stations[this.station];
          const pm = t.parentMatrix(st.parent);
          cam.pos = M.xformPoint(pm, st.eye);
          cam.pos[1] += (jy * vib * 9 + shake * 0.05 * jy);
          cam.pos[0] += jx * vib * 4;
          cam.yaw = t.stationYaw(this.station) + this.look.yaw + jx * vib * 2 + shake * 0.02 * jx;
          cam.pitch = (st.pitch || 0) + this.look.pitch + t.pitch * 0.9 + jy * vib * 2 - shake * 0.03;
          cam.roll = t.roll * 0.85 + jx * vib;
          cam.fov = st.fov;
          cam.sky = null;
          cam.clear = C.tint(t.interior.wall, 0.10);
          cam.fog = null;
          cam.light = {
            dir: M.norm([-0.25, -0.92, 0.3]), amb: this.interiorAmbient(t),
            color: t.sys.lights.interior && t.sys.master ? [255, 226, 176] : [226, 234, 246]
          };
          break;
        }
        case 'sight': {
          const gm = t.gunMatrix();
          const off = t.spec.id === 'abrams' || t.spec.id === 't72' ? [0.4, 0.35, 0.9] : [0.22, 0.28, 0.7];
          cam.pos = M.xformPoint(gm, off);
          cam.yaw = t.yaw + t.sys.turretYaw + jx * vib * 0.6;
          cam.pitch = t.sys.gunPitch + t.pitch * 0.9 + jy * vib * 0.6 - shake * 0.05;
          cam.roll = t.roll * 0.9;
          cam.fov = 52 / t.zoom();
          cam.vision = t.sys.sight.mode;
          cam.fog = Object.assign({}, world.fog, { density: 0.6 });
          break;
        }
        case 'periscope': {
          const st = t.interior.stations[this.station];
          const pm = t.parentMatrix(st.parent);
          const e = M.copy(st.eye);
          e[1] += 0.34;
          cam.pos = M.xformPoint(pm, e);
          cam.yaw = t.stationYaw(this.station) + this.look.yaw * 0.6;
          cam.pitch = M.clamp((st.pitch || 0) + this.look.pitch * 0.5 + t.pitch * 0.9, -0.4, 0.4);
          cam.roll = t.roll * 0.9;
          cam.fov = 38;
          break;
        }
        case 'unbutton': {
          const st = t.interior.stations[this.station];
          const pm = t.parentMatrix(st.parent);
          const e = M.copy(st.eye);
          e[1] += 0.95;
          cam.pos = M.xformPoint(pm, e);
          cam.pos[1] += jy * vib * 5;
          cam.yaw = t.stationYaw(this.station) + this.look.yaw;
          cam.pitch = M.clamp(this.look.pitch + t.pitch * 0.8, -0.9, 0.7);
          cam.roll = t.roll * 0.6;
          cam.fov = 70;
          break;
        }
        default: {
          const o = this.orbit;
          const c = [t.pos[0], t.pos[1] + 1.6, t.pos[2]];
          cam.pos = [
            c[0] - Math.sin(o.yaw + t.yaw) * Math.cos(o.pitch) * o.dist,
            c[1] + Math.sin(o.pitch) * o.dist,
            c[2] - Math.cos(o.yaw + t.yaw) * Math.cos(o.pitch) * o.dist
          ];
          const gh = world.terrain.height(cam.pos[0], cam.pos[2]) + 0.8;
          if (cam.pos[1] < gh) cam.pos[1] = gh;
          cam.yaw = o.yaw + t.yaw;
          cam.pitch = -o.pitch;
          cam.fov = 62;
          break;
        }
      }
      return cam;
    }

    viewLabel() { return VIEW_LABEL[this.view] || this.view.toUpperCase(); }

    /* ============================================================== render */
    render() {
      const r = this.r, world = this.world;
      const cam = this.buildCamera();
      this.viewYaw = cam.yaw;
      this.viewPitch = cam.pitch;
      r.begin(cam);

      if (this.mode === 'garage') {
        world.draw(r, cam, 420);
        const spec = global.tankById(this.selected);
        const T = world.terrain;
        const p = [-8, T.height(-8, -18), -18];
        global.drawVehicle(r, global.getTankModel(spec), p, this.time * 0.06, 0, 0,
          Math.sin(this.time * 0.25) * 0.5, 0.04);
        world.fx.draw(r);
        r.flush();
        this.drawGaragePlate(spec);
        return;
      }

      const t = this.player;
      if (this.view === 'interior') {
        this.drawInterior(cam);
        world.fx.draw(r);
        r.flush();
        this.drawInteriorOverlay(cam);
        return;
      }

      world.draw(r, cam, this.viewDist);
      if (this.view !== 'sight') this.drawExterior(t);
      else this.drawGunOnly(t);
      world.shells.draw(r);
      world.fx.draw(r);
      r.flush();

      if (this.view === 'sight') this.drawSightOverlay(cam);
      else if (this.view === 'periscope') this.drawPeriscopeOverlay(cam);
      else this.drawExteriorOverlay(cam);
    }

    /** the player's own tank, with animated hatches and moving track cleats */
    drawExterior(t) {
      const r = this.r, model = t.model;
      const hull = t.hullMatrix(), turret = t.turretMatrix(), gun = t.gunMatrix();
      r.drawMesh(model.hull, hull);
      r.drawMesh(model.turret, turret);
      r.drawMesh(model.gun, gun);
      for (const h of model.hatches) {
        const open = t.sys.hatches[h.id] || 0;
        const local = h.parent === 'turret' ? M.sub(h.at, model.turretPivot) : h.at;
        const base = h.parent === 'turret' ? turret : hull;
        const ang = M.lerp(h.range[0], h.range[1], open);
        const m = M.mulAll(base, M.translateV(local),
          h.axis === 'z' ? M.rotZ(ang) : h.axis === 'x' ? M.rotX(ang) : M.rotY(ang));
        r.drawMesh(h.mesh, m);
      }
      // muzzle glow just after firing
      if (t.sys.recoil > 0.02) {
        r.billboard(t.muzzle(), 1.2 * t.sys.recoil * 6, [255, 220, 150], 0.7, true);
      }
    }

    /** in the gunner's sight only the barrel should intrude on the picture */
    drawGunOnly(t) {
      if (t.sys.recoil > 0.02) {
        this.r.billboard(t.muzzle(), 1.4 * t.sys.recoil * 6, [255, 226, 160], 0.8, true);
      }
    }

    drawInterior(cam) {
      const r = this.r, t = this.player, itr = t.interior;
      const hullM = t.hullMatrix(), turM = t.turretMatrix();
      r.drawMesh(itr.hull, hullM);
      r.drawMesh(itr.turret, turM);
      const b = itr.breech;
      const drop = t.sys.breechOpen ? -0.26 : 0;
      r.drawMesh(b.block, M.mul(turM, M.translate(0, drop, -t.sys.recoil)));
      // daylight through open hatches
      for (const h of t.model.hatches) {
        const open = t.sys.hatches[h.id] || 0;
        if (open < 0.35) continue;
        const local = h.parent === 'turret' ? M.sub(h.at, t.model.turretPivot) : h.at;
        const base = h.parent === 'turret' ? turM : hullM;
        const m = M.mul(base, M.translateV([local[0], local[1] - 0.04, local[2]]));
        r.drawMesh(SKY_PATCH, m, { glow: 0.9 * open, alpha: open });
      }
      // controls
      this.projected.length = 0;
      const curStation = this.station;
      for (const id in itr.stations) {
        const st = itr.stations[id];
        for (const hs of st.hotspots) this.drawWidget(hs, t, id === curStation);
      }
    }

    widgetMatrix(hs, parentM) {
      let m = M.mulAll(parentM, M.translateV(hs.pos), M.rotY(hs.face.yaw), M.rotX(-hs.face.pitch));
      if (hs.size !== 1) m = M.mul(m, M.scaleM(hs.size));
      return m;
    }

    drawWidget(hs, t, active) {
      const r = this.r;
      const pm = t.parentMatrix(hs.parent);
      const mat = this.widgetMatrix(hs, pm);
      const w = global.Interiors.getWidget(hs.kind, hs.color);
      const hovered = this.mouse.hot && this.mouse.hot.hs === hs;
      const wanted = TUT && TUT.isHighlighted(hs);
      // Controls are small objects mounted on big flat plates. Painter's
      // algorithm sorts by centroid depth, so bias them towards the camera or a
      // wide wall panel can end up painted over the switch bolted to it.
      const opt = { bias: -0.22, glow: hovered ? 0.45 : (wanted ? TUT.glow() : 0) };
      r.drawMesh(w.base, mat, opt);
      const v = hs.val ? hs.val(t) : 0;
      if (w.moving) {
        let mm = mat;
        if (w.slide) {
          const f = M.clamp01(v);
          mm = M.mul(mat, M.translate(w.slide[0] * f, w.slide[1] * f, w.slide[2] * f));
        } else if (hs.kind === 'wheel' || hs.kind === 'valve') {
          mm = M.mul(mat, M.rotZ(v));
        } else {
          const ang = M.lerp(w.range[0], w.range[1], M.clamp01(v));
          mm = M.mul(mat, w.axis === 'z' ? M.rotZ(ang) : w.axis === 'y' ? M.rotY(ang) : M.rotX(ang));
        }
        r.drawMesh(w.moving, mm, opt);
      }
      if (w.needle) {
        const f = M.clamp01(v);
        const a = M.rad(225 - f * 270);
        const p0 = M.xformPoint(mat, [0, 0, 0.022]);
        const p1 = M.xformPoint(mat, [Math.cos(a) * w.needle, Math.sin(a) * w.needle, 0.026]);
        r.line(p0, p1, [232, 96, 64], 2.2, false);
      }
      if (hs.kind === 'rack' && hs.slots) {
        const spec = t.spec;
        const cap = hs.capacity || hs.slots.length;
        const frac = spec.shells[hs.shellType] ? t.sys.ammo[hs.shellType] / spec.shells[hs.shellType].n : 0;
        const n = Math.round(M.clamp01(frac) * cap);
        for (let i = 0; i < n && i < hs.slots.length; i++) {
          const s = hs.slots[i];
          const m = M.mulAll(mat, M.translate(s[0], s[1], -0.18), M.scaleM(0.8));
          r.drawMesh(global.Interiors.SHELL_MESH, m, { bias: -0.24, glow: hovered ? 0.2 : 0 });
        }
      }
      if (hovered) r.drawMesh(HOT_RING, mat, { glow: 0.8, bias: -0.3 });
      else if (wanted) r.drawMesh(HOT_RING, mat, { glow: TUT.glow(), bias: -0.3, tint: [255, 240, 150] });
      // project for picking / labels
      const world = M.xformPoint(pm, hs.pos);
      const p = r.project(world);
      if (p.on && p.z > 0.1 && p.z < 4) {
        const rad = M.clamp(r.f * 0.085 * hs.size / p.z, 10, 90);
        this.projected.push({ hs, x: p.x, y: p.y, z: p.z, r: rad, world, active });
      }
    }

    click(button) {
      if (this.mode !== 'play') return;
      const hot = this.mouse.hot;
      if (!hot) return;
      const hs = hot.hs, t = this.player;
      if (hs.station && hs.station !== this.station && t.interior.stations[hs.station]) {
        // reaching a control that belongs to another crewman: move there first
        this.setStation(hs.station);
        return;
      }
      const fn = button === 2 ? (hs.act2 || hs.act) : hs.act;
      if (!fn) {
        this.msg(L.s(hs.label) + ': ' +
          (hs.text ? L.s(hs.text(t, this)) : L.m('nothing to do here.', '这里没什么可操作的。')), 'clank');
        return;
      }
      const res = fn(t, this);
      const sound = hs.kind === 'button' ? 'button' : hs.kind === 'lever' ? 'clank' :
        hs.kind === 'wheel' || hs.kind === 'valve' ? 'clank' : hs.kind === 'radio' ? 'radio' : 'switch';
      this.msg(res, sound);
    }

    /* ============================================================ overlays */
    drawGaragePlate(spec) {
      const ctx = this.r.ctx, w = this.r.w, h = this.r.h;
      ctx.save();
      ctx.font = '600 11px Consolas, "Microsoft YaHei", "PingFang SC", "Noto Sans SC", monospace';
      ctx.fillStyle = 'rgba(232,238,220,0.85)';
      ctx.textAlign = 'right';
      ctx.fillText(L.s(spec.name).toUpperCase() + '   ·   ' + L.s(spec.gun.name) + '   ·   ' + spec.crew +
        L.m(' CREW', ' 名乘员'), w - 24, h - 22);
      ctx.restore();
    }

    drawInteriorOverlay(cam) {
      const r = this.r, ctx = r.ctx, t = this.player;
      ctx.save();
      // labels for the controls the current crewman can reach
      if (this.labels) {
        ctx.font = '10px Consolas, "Microsoft YaHei", "PingFang SC", "Noto Sans SC", monospace';
        ctx.textAlign = 'center';
        const eye = t.stationEye(this.station);
        const hotHs = this.mouse.hot ? this.mouse.hot.hs : null;
        for (const p of this.projected) {
          if (!p.active) continue;
          if (M.dist(eye, p.world) > 2.0) continue;
          if (p.hs === hotHs) continue;
          const lab = L.s(p.hs.label);
          const wanted = TUT && TUT.isHighlighted(p.hs);
          ctx.fillStyle = wanted ? 'rgba(255,238,150,0.95)' : 'rgba(214,226,190,0.42)';
          ctx.fillText(lab.length > 26 ? lab.slice(0, 25) + '…' : lab, p.x, p.y - p.r * 0.55);
        }
      }
      // tutorial: pulse a ring on the wanted control, or point at it off screen
      if (TUT && TUT.active) this.drawTutorialPointer();
      // hovered control: ring + tooltip
      const hot = this.mouse.hot;
      if (hot) {
        ctx.beginPath();
        ctx.arc(hot.x, hot.y, hot.r * 0.8, 0, M.TAU);
        ctx.strokeStyle = 'rgba(240,246,200,0.85)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
        const hs = hot.hs;
        let status = hs.text ? L.s(hs.text(t, this)) : '';
        let hint = hs.hint ? L.s(hs.hint) : (hs.act2
          ? L.m('left click / right click for the alternate action', '左键操作，右键为备用动作')
          : hs.act ? L.m('click to operate', '点击操作') : null);
        if (hs.station !== this.station) {
          const other = t.interior.stations[hs.station];
          hint = L.m('that is the ' + (other ? other.name : hs.station) +
            "'s control — click to swap seats",
            '这是' + L.s(other ? other.name : hs.station) + '的控件——点击可换到那个位置');
        }
        global.UI.tooltip(this.mouse.x, this.mouse.y, L.s(hs.label), status, hint);
      } else {
        global.UI.tooltip(null);
      }
      // compass strip + turret azimuth, bottom centre
      this.drawAzimuth(r.w / 2, r.h - 46, 44);
      ctx.restore();
    }

    /** ring the control the tutorial is asking for; arrow to it when off screen */
    drawTutorialPointer() {
      const ids = TUT.highlightIds();
      if (!ids || !ids.length) return;
      const r = this.r, ctx = r.ctx;
      let onScreen = 0, target = null;
      for (const p of this.projected) {
        if (ids.indexOf(p.hs.id) < 0) continue;
        target = p;
        if (p.x > 8 && p.x < r.w - 8 && p.y > 8 && p.y < r.h - 8) {
          onScreen++;
          const pulse = 1 + 0.18 * Math.sin(TUT.pulse * 5);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 0.95 * pulse, 0, M.TAU);
          ctx.strokeStyle = 'rgba(255,232,120,0.95)';
          ctx.lineWidth = 2.2;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 1.5 * pulse, 0, M.TAU);
          ctx.strokeStyle = 'rgba(255,232,120,0.3)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
      if (onScreen) return;
      // find the wanted hotspot in camera space and put a chevron at the rim
      const t = this.player;
      let world = null;
      for (const sid in t.interior.stations) {
        for (const hs of t.interior.stations[sid].hotspots) {
          if (ids.indexOf(hs.id) >= 0) { world = M.xformPoint(t.parentMatrix(hs.parent), hs.pos); break; }
        }
        if (world) break;
      }
      if (!world) return;
      const cs = M.xformPoint(r.view, world);
      const ang = Math.atan2(-cs[1], cs[0]);
      const rad = Math.min(r.w, r.h) * 0.33;
      const x = r.w / 2 + Math.cos(ang) * rad, y = r.h / 2 + Math.sin(ang) * rad;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.fillStyle = 'rgba(255,232,120,' + (0.55 + 0.35 * Math.sin(TUT.pulse * 5)).toFixed(2) + ')';
      ctx.beginPath();
      ctx.moveTo(14, 0); ctx.lineTo(-8, 9); ctx.lineTo(-8, -9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.font = '10px Consolas, "Microsoft YaHei", "PingFang SC", "Noto Sans SC", monospace';
      ctx.fillStyle = 'rgba(255,232,120,0.9)';
      ctx.textAlign = 'center';
      ctx.fillText(L.m('look this way', '往这边看'), x, y + 22);
    }

    drawExteriorOverlay(cam) {
      const r = this.r, ctx = r.ctx;
      ctx.save();
      ctx.strokeStyle = 'rgba(230,238,210,0.5)';
      ctx.lineWidth = 1;
      const cx = r.w / 2, cy = r.h / 2;
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy); ctx.lineTo(cx - 3, cy);
      ctx.moveTo(cx + 3, cy); ctx.lineTo(cx + 10, cy);
      ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy - 3);
      ctx.moveTo(cx, cy + 3); ctx.lineTo(cx, cy + 10);
      ctx.stroke();
      this.drawAzimuth(r.w / 2, r.h - 46, 44);
      ctx.restore();
      global.UI.tooltip(null);
    }

    drawPeriscopeOverlay(cam) {
      const r = this.r, ctx = r.ctx, w = r.w, h = r.h;
      const halfW = Math.min(w * 0.42, 520), halfH = Math.min(h * 0.22, 190);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      const x0 = w / 2 - halfW, y0 = h / 2 - halfH;
      const rr = 26;
      ctx.moveTo(x0 + rr, y0);
      ctx.arcTo(x0 + halfW * 2, y0, x0 + halfW * 2, y0 + halfH * 2, rr);
      ctx.arcTo(x0 + halfW * 2, y0 + halfH * 2, x0, y0 + halfH * 2, rr);
      ctx.arcTo(x0, y0 + halfH * 2, x0, y0, rr);
      ctx.arcTo(x0, y0, x0 + halfW * 2, y0, rr);
      ctx.closePath();
      ctx.fillStyle = 'rgba(6,7,8,0.96)';
      ctx.fill('evenodd');
      ctx.strokeStyle = 'rgba(0,0,0,0.9)';
      ctx.lineWidth = 4;
      ctx.stroke();
      // graticule
      ctx.strokeStyle = 'rgba(20,24,20,0.75)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(w / 2 - 60, h / 2); ctx.lineTo(w / 2 + 60, h / 2);
      ctx.moveTo(w / 2, h / 2 - 26); ctx.lineTo(w / 2, h / 2 + 26);
      ctx.stroke();
      for (let i = -5; i <= 5; i++) {
        if (!i) continue;
        const x = w / 2 + i * 34;
        ctx.beginPath();
        ctx.moveTo(x, h / 2 - 7); ctx.lineTo(x, h / 2 + 7);
        ctx.stroke();
      }
      ctx.font = '10px Consolas, "Microsoft YaHei", "PingFang SC", "Noto Sans SC", monospace';
      ctx.fillStyle = 'rgba(200,214,180,0.7)';
      ctx.textAlign = 'left';
      const stName = L.s(((this.player.interior.stations[this.station] || {}).name) || '');
      ctx.fillText(L.m(stName + ' PERISCOPE  ·  drag to scan  ·  V to change view',
        stName + '潜望镜  ·  拖动搜索  ·  V 切换视角'),
        x0 + 14, y0 + halfH * 2 - 12);
      ctx.restore();
      this.drawAzimuth(r.w / 2, r.h - 46, 44);
      global.UI.tooltip(null);
    }

    drawSightOverlay(cam) {
      const r = this.r, ctx = r.ctx, t = this.player, s = t.sys;
      const w = r.w, h = r.h, cx = w / 2, cy = h / 2;
      const rad = Math.min(w, h) * 0.44;
      ctx.save();
      // aperture mask
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.arc(cx, cy, rad, 0, M.TAU);
      ctx.fillStyle = 'rgba(4,5,6,0.97)';
      ctx.fill('evenodd');
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, M.TAU);
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.stroke();

      const modern = t.spec.optics.fcs;
      const ink = s.sight.mode === 'thermal' ? 'rgba(10,10,10,0.92)' :
        s.sight.mode === 'night' ? 'rgba(8,30,10,0.95)' : 'rgba(12,16,12,0.9)';
      ctx.strokeStyle = ink;
      ctx.fillStyle = ink;
      ctx.lineWidth = 1.6;
      const milPx = rad / 12;           // ~ visual mil spacing

      if (modern) {
        // digital style: box reticle with ballistic marks
        ctx.beginPath();
        ctx.moveTo(cx - rad * 0.5, cy); ctx.lineTo(cx - 12, cy);
        ctx.moveTo(cx + 12, cy); ctx.lineTo(cx + rad * 0.5, cy);
        ctx.moveTo(cx, cy - rad * 0.4); ctx.lineTo(cx, cy - 12);
        ctx.moveTo(cx, cy + 12); ctx.lineTo(cx, cy + rad * 0.4);
        ctx.stroke();
        ctx.strokeRect(cx - 11, cy - 11, 22, 22);
        for (let i = 1; i <= 5; i++) {
          const y = cy + i * milPx * 0.6;
          ctx.beginPath();
          ctx.moveTo(cx - 8, y); ctx.lineTo(cx + 8, y);
          ctx.stroke();
        }
      } else {
        // WWII style: chevron / stadia plate
        ctx.beginPath();
        ctx.moveTo(cx - rad * 0.62, cy); ctx.lineTo(cx - 16, cy);
        ctx.moveTo(cx + 16, cy); ctx.lineTo(cx + rad * 0.62, cy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy - 16); ctx.lineTo(cx - 11, cy + 4); ctx.lineTo(cx + 11, cy + 4);
        ctx.closePath();
        ctx.fill();
        for (let i = 1; i <= 6; i++) {
          const x = cx + i * milPx * 0.5, x2 = cx - i * milPx * 0.5;
          const len = i % 2 ? 5 : 9;
          ctx.beginPath();
          ctx.moveTo(x, cy - len); ctx.lineTo(x, cy + len);
          ctx.moveTo(x2, cy - len); ctx.lineTo(x2, cy + len);
          ctx.stroke();
        }
      }

      // super elevation aiming mark for the set / lased range
      const drop = t.superElevation(s.sight.range) * r.f;
      if (drop > 6 && drop < rad) {
        ctx.beginPath();
        ctx.arc(cx, cy + drop, 5, 0, M.TAU);
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 14, cy + drop); ctx.lineTo(cx - 6, cy + drop);
        ctx.moveTo(cx + 6, cy + drop); ctx.lineTo(cx + 14, cy + drop);
        ctx.stroke();
        ctx.font = '10px Consolas, "Microsoft YaHei", "PingFang SC", "Noto Sans SC", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(s.sight.range + (s.sight.lased ? 'm ✱' : 'm'), cx + 18, cy + drop + 3);
      }

      // data block
      ctx.font = '600 12px Consolas, "Microsoft YaHei", "PingFang SC", "Noto Sans SC", monospace';
      ctx.textAlign = 'left';
      const zh = L.lang === 'zh';
      const lines = [
        t.spec.gun.name,
        (zh ? '弹 ' : 'RND ') +
        (s.loaded ? L.shell(s.loaded) : (s.loadT > 0 ? L.m('LOADING', '装填中') : L.s('EMPTY'))) +
        (zh ? '  /  选 ' : '  /  SEL ') + L.shell(s.shell),
        (zh ? '距离 ' : 'RNG ') + s.sight.range + (zh ? ' 米' : ' m') +
        (s.sight.lased ? (zh ? '  已测距' : '  LASED') : ''),
        (zh ? '倍率 x' : 'MAG x') + t.zoomText() + '   ' + L.s(s.sight.mode.toUpperCase()),
        (s.safety ? L.m('CIRCUIT SAFE', '击发保险') : L.s('ARMED')) + (s.stab ? L.m('   STAB ON', '   稳定器开') : ''),
        (zh ? '方位 ' : 'AZ ') + (M.deg(M.wrapPi(s.turretYaw)) | 0) +
        (zh ? '   俯仰 ' : '   EL ') + M.deg(s.gunPitch).toFixed(1)
      ];
      ctx.fillStyle = s.sight.mode === 'day' ? 'rgba(206,220,180,0.9)' : 'rgba(120,255,150,0.85)';
      lines.forEach((L, i) => ctx.fillText(L, 22, 40 + i * 15));
      if (!s.loaded && s.loadT <= 0) {
        ctx.fillStyle = 'rgba(255,120,90,0.9)';
        ctx.textAlign = 'center';
        ctx.fillText(L.m('EMPTY — LOAD (G)', '空膛 — 装填（G）'), cx, cy + rad * 0.72);
      } else if (s.safety) {
        ctx.fillStyle = 'rgba(255,190,90,0.9)';
        ctx.textAlign = 'center';
        ctx.fillText(L.m('SAFE — ARM CIRCUIT (K)', '保险中 — 解除保险（K）'), cx, cy + rad * 0.72);
      }
      ctx.restore();
      this.drawAzimuth(r.w / 2, r.h - 46, 44);
      global.UI.tooltip(null);
    }

    /** little hull + turret azimuth dial */
    drawAzimuth(x, y, rad) {
      const ctx = this.r.ctx, t = this.player;
      if (!t) return;
      ctx.save();
      ctx.translate(x, y);
      ctx.beginPath();
      ctx.arc(0, 0, rad * 0.5, 0, M.TAU);
      ctx.fillStyle = 'rgba(10,14,12,0.62)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(150,170,130,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // hull outline
      ctx.rotate(0);
      ctx.strokeStyle = 'rgba(180,196,160,0.75)';
      ctx.beginPath();
      ctx.rect(-rad * 0.16, -rad * 0.3, rad * 0.32, rad * 0.6);
      ctx.stroke();
      // turret needle
      ctx.rotate(t.sys.turretYaw);
      ctx.strokeStyle = 'rgba(255,214,120,0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0, -rad * 0.46);
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.font = '9px Consolas, "Microsoft YaHei", "PingFang SC", "Noto Sans SC", monospace';
      ctx.fillStyle = 'rgba(190,206,170,0.8)';
      ctx.textAlign = 'center';
      ctx.fillText(L.m('TURRET ', '炮塔 ') + (M.deg(M.wrapPi(t.sys.turretYaw)) | 0) + '°', x, y + rad * 0.5 + 12);
      ctx.restore();
    }
  }

  global.Game = Game;
  if (typeof document !== 'undefined') {
    const boot = () => {
      const g = new Game();
      global.game = g;
      g.start();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
