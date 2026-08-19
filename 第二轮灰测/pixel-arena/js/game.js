// ============================================================
// game.js — 主循环 / 战斗流程编排 / 输入 / 像素放大 / 后处理 / 自检
// 低分辨率 427×240 缓冲 → nearest-neighbor 整数放大到窗口
// URL 模式：#selftest 无头自检；#demo 自动对战演示
// ============================================================
'use strict';

const Game = {
  boot() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.buffer = document.createElement('canvas');
    this.buffer.width = VIEW_W;
    this.buffer.height = VIEW_H;
    this.bctx = this.buffer.getContext('2d');
    this.bctx.imageSmoothingEnabled = false;

    UI.init();
    UI.game = this;
    UI.cursorImg = bakeMap(CURSOR);
    bakeSprites();
    Scene.init();
    FX.init();

    this.state = 'teamSelect';
    this.battle = null;
    this.menu = { mode: 'none', sel: 0, forced: false };
    this.chosen = [];
    this.teamSel = 0;
    this.mouse = { x: 0, y: 0, active: false };
    this.dispHP = [1, 1];
    this.dispHPNum = [0, 0];
    this.post = { crt: false, grid: false, noise: false };
    this.camX = 42;
    this.camNudge = 0;
    this.t = 0;
    this.last = 0;
    this.evQueue = [];
    this.evIdx = -1;
    this.evTimer = 0;
    this.evBusy = false;
    this.demo = location.hash === '#demo';
    this.selftest = location.hash === '#selftest';
    this.selftestRan = false;

    this.buildPostPatterns();
    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.__gameErrors = [];
    window.addEventListener('error', (e) => {
      window.__gameErrors.push(String(e.message) + ' @' + (e.filename || '?') + ':' + (e.lineno || '?'));
    });

    if (this.demo) {
      this.chosen = Object.keys(SPECIES).slice(0, 3);
      this.startBattle();
    }
    if (location.hash === '#pick') {
      this.chosen = ['firefox', 'waveturtle', 'rockrhino'];
      this.teamSel = 6;
    }
    if (location.hash === '#menu' || location.hash === '#menumove') {
      this.chosen = ['firefox', 'waveturtle', 'rockrhino'];
      this.menuHash = location.hash.slice(1);
      this.startBattle();
    }
    Fonts.load(() => {});
    requestAnimationFrame((t) => this.frame(t));
  },

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = w;
    this.canvas.height = h;
    // 优先取能完整容纳的最大整数倍；宽度允许 1px 溢出裁剪以获得更大画面
    let s = Math.max(1, Math.min(Math.ceil(w / VIEW_W), Math.floor(h / VIEW_H)));
    if (s * VIEW_W > w + 2) s = Math.floor(w / VIEW_W);
    if (s < 1) s = 1;
    this.scale = s;
    this.offX = Math.floor((w - VIEW_W * s) / 2);
    this.offY = Math.floor((h - VIEW_H * s) / 2);
  },

  buildPostPatterns() {
    const c1 = document.createElement('canvas');
    c1.width = 1; c1.height = 2;
    const g1 = c1.getContext('2d');
    g1.fillStyle = 'rgba(0,0,0,0.30)';
    g1.fillRect(0, 1, 1, 1);
    this.crtPat = g1.createPattern(c1, 'repeat');
    const c2 = document.createElement('canvas');
    c2.width = 4; c2.height = 4;
    const g2 = c2.getContext('2d');
    g2.fillStyle = 'rgba(0,0,0,0.16)';
    g2.fillRect(0, 0, 1, 1);
    this.gridPat = g2.createPattern(c2, 'repeat');
  },

  // ---------- 战斗流程 ----------
  startBattle() {
    this.battle = createBattle({
      playerSpecies: this.chosen.slice(),
      rng: mulberry32((Date.now() & 0xffffff) ^ 0xbeef),
    });
    this.state = 'battle';
    this.menu = { mode: 'none', sel: 0, forced: false };
    this.dispHP = [1, 1];
    this.dispHPNum = [this.battle.active[0].stats.hp, this.battle.active[1].stats.hp];
    Scene.setWeather('晴天');
    Scene.setTerrain('none');
    FX.reset();
    Sfx.unlock();
    const intro = [
      { type: 'msg', msg: '训练家 ' + RIVAL_NAME + ' 发起了挑战！', dur: 1000 },
      { type: 'switch', side: 1, name: this.battle.active[1].name, dur: 1000 },
      { type: 'msg', msg: '就决定是你了！', dur: 800 },
      { type: 'switch', side: 0, name: this.battle.active[0].name, dur: 900 },
    ];
    this.startEvents(intro);
  },

  resetToTeamSelect() {
    this.state = 'teamSelect';
    this.battle = null;
    this.menu = { mode: 'none', sel: 0, forced: false };
    this.chosen = [];
    this.teamSel = 0;
    this.evQueue = [];
    this.evIdx = -1;
    this.evBusy = false;
    TextBox.clear();
    Scene.setWeather('晴天');
    Scene.setTerrain('none');
    FX.reset();
  },

  startEvents(events) {
    this.evQueue = events;
    this.evIdx = -1;
    this.evTimer = 0;
    this.evBusy = true;
    this.advanceEvent();
  },

  advanceEvent() {
    this.evIdx++;
    if (this.evIdx >= this.evQueue.length) {
      this.evBusy = false;
      this.evQueue = [];
      this.afterEvents();
      return;
    }
    const ev = this.evQueue[this.evIdx];
    this.evTimer = 0;
    if (ev.msg) TextBox.show(ev.msg, this.bctx);
    this.playEventFX(ev);
  },

  playEventFX(ev) {
    const b = this.battle;
    switch (ev.type) {
      case 'moveUse':
        FX.playMove(ev.side, ev.moveId, ev.move);
        break;
      case 'damage': {
        FX.hitFlash(ev.side, ev.eff >= 2 ? 2 : 1);
        this.syncHP(ev.side, ev.to, ev.dur);
        if (ev.eff >= 2) Sfx.superHit(); else Sfx.hit();
        if (ev.crit) this.camNudge = ev.side === 1 ? 3 : -3;
        break;
      }
      case 'confuseSelf': {
        FX.hitFlash(ev.side, 1);
        this.syncHP(ev.side, ev.to, ev.dur);
        Sfx.hit();
        break;
      }
      case 'recoil': {
        FX.hitFlash(ev.side, 1);
        this.syncHP(ev.side, ev.to, ev.dur);
        Sfx.weakHit();
        break;
      }
      case 'heal':
        this.syncHP(ev.side, ev.to || this.battle.active[ev.side].curHP, ev.dur);
        Sfx.heal();
        break;
      case 'statusApply':
        FX.perSide[ev.side].rings = {
          t0: performance.now(), dur: 500,
          cx: ev.side === 0 ? 150 - this.camX : 305 - this.camX,
          cy: ev.side === 0 ? 176 : 116,
          color: (TYPE_FX_COLOR[ev.status === '烧伤' ? '火' : ev.status === '麻痹' ? '电' : ev.status === '冰冻' ? '冰' : ev.status === '睡眠' ? '超能' : '毒'] || [28, 29]),
        };
        Sfx.weakHit();
        break;
      case 'statusCure':
        Sfx.heal();
        break;
      case 'faint':
        FX.faint(ev.side);
        this.syncHP(ev.side, 0, ev.dur);
        Sfx.faint();
        break;
      case 'switch':
        FX.entry(ev.side);
        this.syncHP(ev.side, this.battle.active[ev.side].curHP, 300);
        this.camNudge = ev.side === 1 ? 4 : -4;
        break;
      case 'weather':
        Scene.setWeather(ev.kind);
        break;
      case 'weatherEnd':
        Scene.setWeather('晴天');
        break;
      case 'terrain':
        Scene.setTerrain(ev.kind);
        break;
      case 'terrainEnd':
        Scene.setTerrain('none');
        break;
      case 'statChange':
        if (ev.stages > 0) Sfx.statUp(); else Sfx.statDown();
        break;
      case 'miss':
      case 'immune':
      case 'paraSkip':
      case 'sleepSkip':
      case 'freezeSkip':
        Sfx.weakHit();
        break;
      case 'victory':
        Sfx.victory();
        this.camNudge = -4;
        break;
      case 'defeat':
        Sfx.defeat();
        break;
      case 'chip':
      case 'drain':
        this.syncHP(ev.side, ev.to, ev.dur);
        Sfx.weakHit();
        break;
      case 'item':
        this.syncHP(ev.side, this.battle.active[ev.side].curHP, ev.dur);
        Sfx.heal();
        break;
      default:
        break;
    }
  },

  afterEvents() {
    const b = this.battle;
    if (!b || this.state !== 'battle') return;
    if (b.active[1]) b.active[1].scouted = true; // 打过照面即可见属性提示
    if (b.phase === 'forcedSwitch') {
      this.menu = { mode: 'switch', sel: this.firstSwitchable(), forced: true };
    } else if (b.phase === 'over') {
      this.menu = { mode: 'end', sel: 0, forced: false };
    } else {
      this.menu = { mode: 'action', sel: 0, forced: false };
    }
  },

  firstSwitchable() {
    const b = this.battle;
    for (let i = 0; i < b.playerTeam.length; i++) {
      if (b.playerTeam[i].curHP > 0 && b.playerTeam[i] !== b.active[0]) return i;
    }
    return 0;
  },

  syncHP(side, to, dur) {
    const mon = this.battle.active[side];
    this.hpAnim = this.hpAnim || {};
    const key = side === 0 ? 0 : 1;
    const from = this.dispHPNum[key];
    this.hpAnim[key] = { from, to, t0: performance.now(), dur: Math.max(120, dur || 500) };
    void mon;
  },

  updateHPAnims(now) {
    for (const key of [0, 1]) {
      const a = this.hpAnim && this.hpAnim[key];
      const mon = this.battle && this.battle.active[key];
      if (!mon) continue;
      if (a) {
        const el = now - a.t0;
        const k = Math.min(1, el / a.dur);
        const eased = k < 1 ? Math.floor(a.from + (a.to - a.from) * k) : a.to;
        this.dispHPNum[key] = Math.max(0, eased);
        this.dispHP[key] = this.dispHPNum[key] / mon.stats.hp;
        if (k >= 1) delete this.hpAnim[key];
      } else {
        this.dispHPNum[key] = mon.curHP;
        this.dispHP[key] = mon.curHP / mon.stats.hp;
      }
    }
  },

  // ---------- 玩家操作 ----------
  playerAction(kind, payload) {
    if (!this.battle || this.evBusy || this.state !== 'battle') return;
    const b = this.battle;
    if (b.phase !== 'playerAction' && b.phase !== 'forcedSwitch') return;
    this.menu = { mode: 'none', sel: 0, forced: false };
    TextBox.clear();
    let action;
    if (kind === 'move') action = { kind: 'move', moveId: payload };
    else if (kind === 'switch') action = { kind: 'switch', to: payload };
    else if (kind === 'item') action = { kind: 'item', itemId: payload };
    else if (kind === 'forfeit') action = { kind: 'forfeit' };
    else return;
    const r = resolveTurn(b, action);
    if (r.events.length === 0 && b.phase !== 'over') {
      this.menu = { mode: 'action', sel: 0, forced: false };
      return;
    }
    this.startEvents(r.events);
  },

  playerReplace(to) {
    if (!this.battle || this.evBusy) return;
    const r = chooseReplacementPlayer(this.battle, to);
    this.menu = { mode: 'none', sel: 0, forced: false };
    TextBox.clear();
    if (r.events.length === 0) {
      this.menu = { mode: 'switch', sel: this.firstSwitchable(), forced: true };
      return;
    }
    this.startEvents(r.events);
  },

  // ---------- 输入 ----------
  bindInput() {
    const self = this;
    window.addEventListener('keydown', (e) => {
      Sfx.unlock();
      const k = e.key;
      const low = k.toLowerCase();
      if (low === 'm') { Sfx.muted = !Sfx.muted; e.preventDefault(); return; }
      if (low === 'c') { self.post.crt = !self.post.crt; e.preventDefault(); return; }
      if (low === 'g') { self.post.grid = !self.post.grid; e.preventDefault(); return; }
      if (low === 'n') { self.post.noise = !self.post.noise; e.preventDefault(); return; }
      if (low === 'r' && self.state === 'battle') { self.resetToTeamSelect(); e.preventDefault(); return; }
      self.mouse.active = false;
      self.onKey(low);
      e.preventDefault();
    });
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = self.canvas.getBoundingClientRect();
      const bx = Math.floor((e.clientX - rect.left - self.offX) / self.scale);
      const by = Math.floor((e.clientY - rect.top - self.offY) / self.scale);
      self.mouse.x = bx;
      self.mouse.y = by;
      self.mouse.active = true;
      self.onHover(bx, by);
    });
    this.canvas.addEventListener('mousedown', (e) => {
      Sfx.unlock();
      const rect = self.canvas.getBoundingClientRect();
      const bx = Math.floor((e.clientX - rect.left - self.offX) / self.scale);
      const by = Math.floor((e.clientY - rect.top - self.offY) / self.scale);
      self.mouse.x = bx; self.mouse.y = by; self.mouse.active = true;
      self.pressAnim = { t: performance.now() };
      self.onClick(bx, by);
      e.preventDefault();
    });
  },

  hitTest(rects, x, y) {
    if (!rects) return -1;
    for (const r of rects) {
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r.idx;
    }
    return -1;
  },

  onHover(x, y) {
    const m = this.menu;
    if (this.state === 'teamSelect') {
      const idx = this.hitTest(UI.teamRects, x, y);
      if (idx >= 0) this.teamSel = idx;
    } else if (this.state === 'battle') {
      if (m.mode === 'action') {
        const idx = this.hitTest(UI.actionRects, x, y);
        if (idx >= 0) m.sel = idx;
      } else if (m.mode === 'move') {
        const idx = this.hitTest(UI.moveRects, x, y);
        if (idx >= 0) m.sel = idx;
      } else if (m.mode === 'bag') {
        const idx = this.hitTest(UI.bagRects, x, y);
        if (idx >= 0) m.sel = idx;
      } else if (m.mode === 'switch') {
        const idx = this.hitTest(UI.switchRects, x, y);
        if (idx >= 0 && !this.switchDisabled(idx)) m.sel = idx;
      } else if (m.mode === 'confirm') {
        const idx = this.hitTest(UI.confirmRects, x, y);
        if (idx >= 0) m.sel = idx;
      } else if (m.mode === 'end') {
        const idx = this.hitTest([UI.endRect], x, y);
        if (idx === 0) m.sel = 0;
      }
    }
  },

  onClick(x, y) {
    const m = this.menu;
    if (this.state === 'teamSelect') {
      const idx = this.hitTest(UI.teamRects, x, y);
      if (idx >= 0) {
        this.teamSel = idx;
        this.confirmTeam(idx);
      }
      return;
    }
    if (this.state !== 'battle') return;
    if (m.mode === 'action') {
      const idx = this.hitTest(UI.actionRects, x, y);
      if (idx >= 0) { m.sel = idx; this.confirmAction(idx); }
    } else if (m.mode === 'move') {
      const idx = this.hitTest(UI.moveRects, x, y);
      if (idx >= 0) {
        m.sel = idx;
        this.confirmMove(idx);
      }
    } else if (m.mode === 'bag') {
      const idx = this.hitTest(UI.bagRects, x, y);
      if (idx >= 0) { m.sel = idx; this.confirmBag(idx); }
    } else if (m.mode === 'switch') {
      const idx = this.hitTest(UI.switchRects, x, y);
      if (idx >= 0 && !this.switchDisabled(idx)) {
        m.sel = idx;
        if (m.forced) this.playerReplace(idx); else this.playerAction('switch', idx);
      }
    } else if (m.mode === 'confirm') {
      const idx = this.hitTest(UI.confirmRects, x, y);
      if (idx === 0) this.playerAction('forfeit');
      else if (idx === 1) this.menu = { mode: 'action', sel: 2, forced: false };
    } else if (m.mode === 'end') {
      this.resetToTeamSelect();
    }
  },

  switchDisabled(idx) {
    const b = this.battle;
    if (!b) return true;
    const mon = b.playerTeam[idx];
    return !mon || mon.curHP <= 0 || mon === b.active[0];
  },

  onKey(low) {
    const m = this.menu;
    // 事件播放中：Z 跳过
    if (this.state === 'battle' && this.evBusy) {
      if (low === 'z' || low === 'enter' || low === ' ') {
        if (!TextBox.done) {
          TextBox.skip();
        } else {
          this.evTimer = 1e9; // 快进当前事件
        }
      }
      return;
    }
    if (this.state === 'teamSelect') {
      this.keyTeam(low);
      return;
    }
    if (this.state !== 'battle') return;
    if (m.mode === 'end') {
      if (low === 'z' || low === 'enter' || low === ' ') this.resetToTeamSelect();
      return;
    }
    const left = low === 'arrowleft' || low === 'a';
    const right = low === 'arrowright' || low === 'd';
    const up = low === 'arrowup' || low === 'w';
    const down = low === 'arrowdown' || low === 's';
    const z = low === 'z' || low === 'enter' || low === ' ';
    const x = low === 'x' || low === 'escape' || low === 'backspace';
    if (m.mode === 'action') {
      if (left) m.sel = m.sel % 2 === 1 ? m.sel - 1 : m.sel;
      if (right) m.sel = m.sel % 2 === 0 ? m.sel + 1 : m.sel;
      if (up) m.sel = m.sel >= 2 ? m.sel - 2 : m.sel;
      if (down) m.sel = m.sel < 2 ? m.sel + 2 : m.sel;
      if (m.sel === 1 && UI.noSwitch.call(UI)) m.sel = 0;
      if (z) this.confirmAction(m.sel);
    } else if (m.mode === 'move') {
      if (up) m.sel = m.sel >= 2 ? m.sel - 2 : m.sel;
      if (down) m.sel = m.sel < 2 ? m.sel + 2 : m.sel;
      if (left) m.sel = m.sel % 2 === 1 ? m.sel - 1 : m.sel;
      if (right) m.sel = m.sel % 2 === 0 ? m.sel + 1 : m.sel;
      if (z) this.confirmMove(m.sel);
      if (x) { this.menu = { mode: 'action', sel: 0, forced: false }; Sfx.cancel(); }
    } else if (m.mode === 'bag') {
      const n = Object.keys(ITEMS).length;
      if (up) m.sel = (m.sel + n - 1) % n;
      if (down) m.sel = (m.sel + 1) % n;
      if (z) this.confirmBag(m.sel);
      if (x) { this.menu = { mode: 'action', sel: 2, forced: false }; Sfx.cancel(); }
    } else if (m.mode === 'switch') {
      if (up) m.sel = (m.sel + 2) % 3;
      if (down) m.sel = (m.sel + 1) % 3;
      while (this.switchDisabled(m.sel)) m.sel = (m.sel + 1) % 3;
      if (z) {
        if (m.forced) this.playerReplace(m.sel);
        else this.playerAction('switch', m.sel);
      }
      if (x && !m.forced) { this.menu = { mode: 'action', sel: 1, forced: false }; Sfx.cancel(); }
    } else if (m.mode === 'confirm') {
      if (left || right) m.sel = 1 - m.sel;
      if (z) {
        if (m.sel === 0) this.playerAction('forfeit');
        else this.menu = { mode: 'action', sel: 3, forced: false };
      }
      if (x) this.menu = { mode: 'action', sel: 3, forced: false };
    }
  },

  keyTeam(low) {
    const left = low === 'arrowleft' || low === 'a';
    const right = low === 'arrowright' || low === 'd';
    const up = low === 'arrowup' || low === 'w';
    const down = low === 'arrowdown' || low === 's';
    const z = low === 'z' || low === 'enter' || low === ' ';
    const x = low === 'x' || low === 'escape' || low === 'backspace';
    const n = 6;
    if (this.teamSel === 6) {
      if (up) this.teamSel = 4;
      else if (left) this.teamSel = 4;
      else if (right) this.teamSel = 5;
    } else {
      const col = this.teamSel % 3, row = Math.floor(this.teamSel / 3);
      if (left) this.teamSel = row * 3 + (col + 2) % 3;
      if (right) this.teamSel = row * 3 + (col + 1) % 3;
      if (up && row > 0) this.teamSel = (row - 1) * 3 + col;
      if (down) this.teamSel = row < 1 ? 3 + col : 6;
    }
    if (z) {
      Sfx.confirm();
      this.confirmTeam(this.teamSel);
    }
    if (x) {
      const idx = this.chosen.indexOf(Object.keys(SPECIES)[this.teamSel]);
      if (this.teamSel < 6 && idx >= 0) {
        this.chosen.splice(idx, 1);
        Sfx.cancel();
      }
    }
    void n;
  },

  confirmTeam(idx) {
    if (idx === 6) {
      if (this.chosen.length === 3) this.startBattle();
      return;
    }
    const id = Object.keys(SPECIES)[idx];
    const i = this.chosen.indexOf(id);
    if (i >= 0) this.chosen.splice(i, 1);
    else if (this.chosen.length < 3) this.chosen.push(id);
  },

  confirmAction(idx) {
    const b = this.battle;
    if (idx === 0) {
      this.menu = { mode: 'move', sel: 0, forced: false };
      Sfx.move();
    } else if (idx === 1) {
      if (UI.noSwitch.call(UI)) { Sfx.cancel(); return; }
      this.menu = { mode: 'switch', sel: this.firstSwitchable(), forced: false };
      Sfx.move();
    } else if (idx === 2) {
      this.menu = { mode: 'bag', sel: 0, forced: false };
      Sfx.move();
    } else if (idx === 3) {
      this.menu = { mode: 'confirm', sel: 1, forced: false };
      Sfx.move();
    }
    void b;
  },

  confirmMove(idx) {
    const mon = this.battle.active[0];
    const moveId = mon.moves[idx].id;
    Sfx.confirm();
    this.playerAction('move', moveId);
  },

  confirmBag(idx) {
    const key = Object.keys(ITEMS)[idx];
    if (this.battle.bag[key] <= 0) { Sfx.cancel(); return; }
    Sfx.confirm();
    this.playerAction('item', key);
  },

  // ---------- 主循环 ----------
  frame(t) {
    const dt = Math.min(100, t - this.last);
    this.last = t;
    this.t = t;
    this.dt = dt;
    this.update(dt, t);
    this.render(t);
    if (this.selftest && !this.selftestRan) {
      this.selftestRan = true;
      setTimeout(() => runSelfTest(), 300);
    }
    requestAnimationFrame((tt) => this.frame(tt));
  },

  update(dt, t) {
    // 摄像机漂移 + 事件推挤
    const camTarget = 42 + 38 * Math.sin(t * 0.00022);
    this.camX += (camTarget - this.camX) * Math.min(1, dt * 0.0012) + this.camNudge * dt * 0.01;
    this.camX = Math.max(0, Math.min(85, this.camX));
    this.camNudge *= Math.max(0, 1 - dt * 0.004);
    TextBox.update(dt);
    FX.update(t);
    this.updateHPAnims(performance.now());
    // 事件队列推进
    if (this.evBusy) {
      this.evTimer += dt;
      const ev = this.evQueue[this.evIdx];
      if (ev && this.evTimer >= (ev.dur || 600) && TextBox.done) {
        this.advanceEvent();
      }
    }
    // 菜单演示模式（#menu / #menumove）：菜单一打开就固定为对应面板
    if (this.menuHash && !this.evBusy && this.state === 'battle' &&
        (this.menu.mode === 'action' || this.menu.mode === 'move')) {
      const want = this.menuHash === 'menumove' ? 'move' : 'action';
      if (this.menu.mode !== want) {
        this.menu = { mode: want, sel: want === 'move' ? 1 : 0, forced: false };
      }
    }
    // 演示模式：自动决策
    if (this.demo && this.state === 'battle' && this.battle && !this.evBusy) {
      if (this.battle.phase === 'over') {
        if (!this.demoResetAt) this.demoResetAt = t;
        if (t - this.demoResetAt > 5000) { this.demoResetAt = 0; this.resetToTeamSelect(); this.chosen = Object.keys(SPECIES).slice(0, 3); this.startBattle(); }
      } else if (this.battle.phase === 'forcedSwitch') {
        if (this.demoDelay === undefined || t - this.demoDelay > 700) {
          this.demoDelay = t;
          this.playerReplace(this.firstSwitchable());
        }
      } else if (this.menu.mode === 'action') {
        if (this.demoDelay === undefined || t - this.demoDelay > 900) {
          this.demoDelay = t;
          const act = chooseAction(this.battle, 0);
          if (act.kind === 'switch' && act.to >= 0) this.playerAction('switch', act.to);
          else this.playerAction('move', act.moveId);
        }
      }
    }
  },

  // ---------- 渲染 ----------
  render(t) {
    const ctx = this.ctx;
    const g = this.bctx;
    ctx.fillStyle = '#0d1420';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    g.clearRect(0, 0, VIEW_W, VIEW_H);

    const now = performance.now();
    const shake = FX.shakeOffsets(now);
    const shakeX = shake.x, shakeY = shake.y;

    Scene.render(g, { camX: this.camX, shakeX, shakeY });

    // 精灵层（影子 → 本体 → 闪白 → 消散）
    if (this.battle && this.state === 'battle') {
      this.drawMon(g, 1, t, now, shakeX, shakeY);
      this.drawMon(g, 0, t, now, shakeX, shakeY);
      // 招式特效视图
      FX.setView({
        px: 150 - this.camX + shakeX, py: 194 + shakeY,
        rx: 305 - this.camX + shakeX, ry: 138 + shakeY,
        rivalTypes: this.battle.active[1] ? this.battle.active[1].types : [],
        playerTypes: this.battle.active[0] ? this.battle.active[0].types : [],
        weather: this.battle.weather.kind,
      });
      FX.draw(g, t);
    }

    Scene.renderFore(g, this.camX, shakeX, shakeY, t, this.dt || 16);

    // UI
    UI.dispHP = this.dispHP;
    UI.dispHPNum = this.dispHPNum;
    if (this.state === 'teamSelect') {
      UI.drawTeamSelect(g, this.chosen, this.teamSel, this.chosen.length === 3, t);
    } else if (this.battle) {
      UI.drawOppBox(g, this.battle);
      UI.drawPlayerBox(g, this.battle);
      UI.drawTopStatus(g, this.battle, t);
      TextBox.draw(g, t);
      const m = this.menu;
      if (!this.evBusy) {
        if (m.mode === 'action') UI.drawActionMenu(g, m.sel);
        else if (m.mode === 'move') UI.drawMovePanel(g, this.battle, m.sel, this.battle.active[1].scouted);
        else if (m.mode === 'bag') UI.drawBagPanel(g, this.battle.bag, m.sel);
        else if (m.mode === 'switch') UI.drawSwitchPanel(g, this.battle, m.sel, m.forced);
        else if (m.mode === 'confirm') UI.drawConfirm(g, m.sel);
        else if (m.mode === 'end') UI.drawEnd(g, this.battle.winner, this.battle.turn);
      }
    }
    UI.drawCursor(g, this.mouse);

    // 后处理（可选，默认关闭）
    if (this.post.crt) { g.fillStyle = this.crtPat; g.fillRect(0, 0, VIEW_W, VIEW_H); }
    if (this.post.grid) { g.fillStyle = this.gridPat; g.fillRect(0, 0, VIEW_W, VIEW_H); }
    if (this.post.noise) {
      for (let i = 0; i < 120; i++) {
        g.fillStyle = Math.random() < 0.6 ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.12)';
        g.fillRect((Math.random() * VIEW_W) | 0, (Math.random() * VIEW_H) | 0, 1, 1);
      }
    }

    // nearest-neighbor 整数放大
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.buffer, 0, 0, VIEW_W, VIEW_H, this.offX, this.offY, VIEW_W * this.scale, VIEW_H * this.scale);
  },

  drawMon(g, side, t, now, shakeX, shakeY) {
    const b = this.battle;
    const mon = b.active[side];
    if (!mon || mon.curHP <= 0) return;
    const tr = FX.spriteTransform(side, t, now);
    if (tr.hidden) return;
    const idle = idleFrame(t);
    const shScale = idleShadowScale(t);
    const feetX = (side === 0 ? 150 : 305) - this.camX + shakeX;
    const feetY = (side === 0 ? 194 : 138) + shakeY;
    // 椭圆阴影（Bayer 抖动）
    const sw = (side === 0 ? 30 : 27) * shScale;
    const sh = (side === 0 ? 6 : 5.5) * shScale;
    ditherEllipse(g, feetX, feetY + 1, sw, sh, 2, 9);
    ditherEllipse(g, feetX, feetY + 1, Math.max(1, sw - 4), Math.max(1, sh - 2), 1, 10);
    // 本体
    const spr = side === 0 ? SPRITES.back[mon.id] : SPRITES.front[mon.id];
    let dx = feetX - Math.floor(spr.width / 2) + (tr.dx || 0) + idle.x;
    let dy = feetY - spr.height + (tr.dy || 0) + idle.y;
    dx = Math.round(dx); dy = Math.round(dy);
    if (tr.mask) {
      // 先画正常再打孔（消散）
      g.drawImage(spr, dx, dy);
      g.save();
      g.globalCompositeOperation = 'destination-out';
      g.drawImage(tr.mask, dx - 2, dy - 2, spr.width + 4, spr.height + 4);
      g.restore();
    } else {
      g.drawImage(spr, dx, dy);
    }
    if (tr.white) {
      g.drawImage(side === 0 ? SPRITES.whiteBack[mon.id] : SPRITES.white[mon.id], dx, dy);
    }
  },
};

function dt0() {
  return 16;
}

// ---------- 自检 ----------
function runSelfTest() {
  const reportEl = document.getElementById('selftest-report');
  reportEl.style.display = 'block';
  const lines = [];
  const fail = [];
  const addLine = (s) => lines.push(s);
  window.__testErrors = [];
  window.onerror = function (msg, src, l, c) {
    window.__testErrors.push(String(msg) + ' @' + (src || '?') + ':' + l);
  };

  try {
    // 引擎逻辑测试
    const r = RUN_TESTS({
      render: (rep) => addRenderTests(rep),
    });
    for (const res of r.results) {
      addLine((res.pass ? '[PASS] ' : '[FAIL] ') + res.name + (res.pass ? '' : ' -> ' + res.err));
      if (!res.pass) fail.push(res.name);
    }
  } catch (e) {
    fail.push('RUN_TESTS threw: ' + e.message);
  }

  // 渲染管线测试
  try {
    addRenderTests(null);
  } catch (e) {
    fail.push('render tests threw: ' + e.message);
  }

  if (window.__testErrors.length) {
    fail.push('window.onerror: ' + window.__testErrors.join(' | '));
  }
  const pass = fail.length === 0;
  const title = pass ? 'SELFTEST PASS' : 'SELFTEST FAIL (' + fail.length + ')';
  addLine('==== ' + title + ' ====');
  document.title = title;
  reportEl.textContent = lines.join('\n');
}

function addRenderTests(rep) {
  const lines = [];
  const fail = [];
  const t = (name, fn) => {
    try {
      const v = fn();
      if (v === false) throw new Error('assert false');
      lines.push('[PASS] ' + name);
    } catch (e) {
      fail.push(name + ' -> ' + e.message);
      lines.push('[FAIL] ' + name + ' -> ' + e.message);
    }
  };
  const report = () => {
    const el = document.getElementById('selftest-report');
    el.style.display = 'block';
    el.textContent += (el.textContent ? '\n' : '') + lines.join('\n');
    if (rep) {
      for (const l of lines) rep.results.push({ name: l.slice(7), pass: l.startsWith('[PASS]') });
      if (rep.failures !== undefined) rep.failures += fail.length;
    } else {
      document.title = fail.length ? 'SELFTEST FAIL (' + fail.length + ')' : document.title;
    }
  };

  t('精灵地图尺寸合法', () => validateMaps().length === 0);
  t('精灵烘焙非空', () => {
    const S = SPRITES;
    for (const id in S.front) {
      if (S.front[id].width <= 0 || S.back[id].width <= 0) return false;
    }
    return true;
  });
  t('各图层画布均为硬像素（无抗锯齿/半透明）', () => {
    const names = ['sky', 'clouds', 'mountF', 'mountN', 'hills', 'grass', 'props', 'fringe', 'fog', 'vignette'];
    for (const n of names) {
      const lc = Scene.layers[n].c;
      const data = lc.getContext('2d').getImageData(0, 0, lc.width, lc.height).data;
      for (let p = 0; p < data.length; p += 4) {
        const a = data[p + 3];
        if (a === 0) continue;
        if (a !== 255) {
          const idx = p / 4;
          throw new Error('layer=' + n + ' pixel(' + (idx % lc.width) + ',' + Math.floor(idx / lc.width) + ') alpha=' + a);
        }
        if (!isPaletteColor(data[p], data[p + 1], data[p + 2])) {
          const idx = p / 4;
          throw new Error('layer=' + n + ' pixel(' + (idx % lc.width) + ',' + Math.floor(idx / lc.width) + ') rgb=' + data[p] + ',' + data[p + 1] + ',' + data[p + 2]);
        }
      }
    }
    return true;
  });
  t('渲染缓冲全部像素符合调色板', () => {
    const g = Game.bctx;
    for (const w of ['晴天', '雨天', '大晴天', '沙暴']) {
      Scene.setWeather(w);
      Scene.setTerrain(w === '沙暴' ? 'none' : '电气场地');
      for (let i = 0; i < 3; i++) {
        g.clearRect(0, 0, VIEW_W, VIEW_H);
        Scene.updateParticles(16, i * 120);
        Scene.updateShadows(16);
        Scene.render(g, { camX: 42, shakeX: 0, shakeY: 0 });
        Scene.renderFore(g, 42, 0, 0, i * 120, 16);
        const img = g.getImageData(0, 0, VIEW_W, VIEW_H).data;
        for (let p = 0; p < img.length; p += 28) {
          if (img[p + 3] === 0) continue;
          if (!isPaletteColor(img[p], img[p + 1], img[p + 2])) {
            const pxIdx = p / 4;
            const x = pxIdx % VIEW_W, y = Math.floor(pxIdx / VIEW_W);
            // 邻域转储：判断形状来源
            let patch = '';
            for (let yy = y - 2; yy <= y + 2; yy++) {
              for (let xx = x - 4; xx <= x + 4; xx++) {
                const q = (yy * VIEW_W + xx) * 4;
                patch += img[q + 3] > 0 ? isPaletteColor(img[q], img[q + 1], img[q + 2]) ? '#' : '?' : '.';
              }
              patch += '|';
            }
            throw new Error('weather=' + w + ' pixel(' + x + ',' + y + ') = rgb(' +
              img[p] + ',' + img[p + 1] + ',' + img[p + 2] + ') a=' + img[p + 3] + ' patch=' + patch);
          }
        }
      }
    }
    Scene.setWeather('晴天');
    Scene.setTerrain('none');
    return true;
  });
  t('场景覆盖率 > 40%', () => {
    const g = Game.bctx;
    g.clearRect(0, 0, VIEW_W, VIEW_H);
    Scene.render(g, { camX: 42, shakeX: 0, shakeY: 0 });
    Scene.renderFore(g, 42, 0, 0, 1000, 16);
    const img = g.getImageData(0, 0, VIEW_W, VIEW_H).data;
    let n = 0;
    for (let p = 0; p < img.length; p += 16) {
      if (img[p + 3] > 0) n++;
    }
    return n > img.length / 16 * 0.4;
  });
  t('云影带随噪声产生非零像素', () => {
    Scene.updateShadows(200);
    Scene.updateShadows(200);
    const d = Scene.shadowImg.data;
    let n = 0;
    for (let p = 3; p < d.length; p += 4) if (d[p] > 0) n++;
    return n > 500;
  });
  t('天气粒子步进帧率量化(8/12fps)', () => {
    Scene.setWeather('雨天');
    const s1 = quantStep(120, 12), s2 = quantStep(130, 12);
    Scene.setWeather('晴天');
    return s1 === 1 && s2 === 1 && quantStep(500, 8) === 4;
  });
  t('精灵渲染 + 特效帧无异常', () => {
    const g = Game.bctx;
    Game.battle = createBattle({ playerSpecies: ['firefox', 'waveturtle', 'voltmouse'], rng: mulberry32(99) });
    Game.dispHPNum = [Game.battle.active[0].stats.hp, Game.battle.active[1].stats.hp];
    Game.dispHP = [1, 1];
    Game.drawMon(g, 1, 0, 0, 0, 0);
    Game.drawMon(g, 0, 0, 0, 0, 0);
    for (const mid of Object.keys(MOVES)) {
      FX.playMove(0, mid, MOVES[mid]);
      FX.playMove(1, mid, MOVES[mid]);
    }
    FX.update(1000);
    FX.draw(g, 1000);
    FX.hitFlash(1, 2);
    FX.faint(1);
    const tr = FX.spriteTransform(1, 1000, performance.now());
    FX.reset();
    return tr !== null;
  });
  t('UI 各面板绘制无异常', () => {
    const g = Game.bctx;
    const b = Game.battle;
    b.active[0].curHP = Math.floor(b.active[0].stats.hp / 2);
    b.active[0].status = '烧伤';
    b.active[1].status = '麻痹';
    UI.drawOppBox(g, b);
    UI.drawPlayerBox(g, b);
    UI.drawTopStatus(g, b, 0);
    UI.drawActionMenu(g, 0);
    UI.drawMovePanel(g, b, 0, true);
    UI.drawBagPanel(g, b.bag, 0);
    UI.drawSwitchPanel(g, b, 0, false);
    UI.drawConfirm(g, 0);
    UI.drawTeamSelect(g, ['firefox'], 0, false, 0);
    UI.drawEnd(g, 'player', 12);
    return true;
  });
  t('HP 条填充像素颜色正确（绿/暗槽）', () => {
    const g = Game.bctx;
    const b = Game.battle;
    UI.dispHP = [0.7, 0.7];
    UI.dispHPNum = [Math.floor(b.active[0].stats.hp * 0.7), Math.floor(b.active[1].stats.hp * 0.7)];
    g.clearRect(0, 0, VIEW_W, VIEW_H);
    UI.drawOppBox(g, b);
    UI.drawPlayerBox(g, b);
    const img = g.getImageData(0, 0, VIEW_W, VIEW_H).data;
    const at = (x, y) => {
      const p = (y * VIEW_W + x) * 4;
      return [img[p], img[p + 1], img[p + 2], img[p + 3]];
    };
    const isGreen = (x, y) => {
      const q = at(x, y);
      return q[3] === 255 && (q[0] === 0x3f || q[0] === 0x62 || q[0] === 0x2a || q[0] === 0x1e);
    };
    const isDark = (x, y) => {
      const q = at(x, y);
      return q[3] === 255 && q[0] === 0x1c && q[1] === 0x2c && q[2] === 0x44;
    };
    // 对手条 (x 14..118, y 32..38)：中心应为绿色系
    if (!isGreen(60, 35)) throw new Error('opponent HP bar fill missing');
    // 玩家条 (x 240..348, y 212..218)：中心绿色、右侧为暗槽
    if (!isGreen(270, 215)) throw new Error('player HP bar fill missing');
    if (!isDark(330, 215)) throw new Error('player HP bar dark slot missing');
    return true;
  });
  t('文本框自动换行', () => {
    const g = Game.bctx;
    const lines = Fonts.wrap(g, '这是一条很长很长的战斗消息用来测试自动换行是否正确工作', 200, 12);
    return lines.length >= 2;
  });
  t('后处理开关渲染无异常', () => {
    const g = Game.bctx;
    Game.post.crt = true; Game.post.grid = true; Game.post.noise = true;
    g.fillStyle = Game.crtPat; g.fillRect(0, 0, VIEW_W, VIEW_H);
    g.fillStyle = Game.gridPat; g.fillRect(0, 0, VIEW_W, VIEW_H);
    Game.post.crt = false; Game.post.grid = false; Game.post.noise = false;
    return true;
  });
  t('菜单交互：键盘与鼠标路径可走通', () => {
    Game.battle = createBattle({ playerSpecies: ['firefox', 'waveturtle', 'voltmouse'], rng: mulberry32(7) });
    Game.state = 'battle';
    Game.evBusy = false;
    Game.menu = { mode: 'action', sel: 0, forced: false };
    // 键盘：战斗 → 招式面板 → 返回
    Game.onKey('z');
    if (Game.menu.mode !== 'move') throw new Error('Z 应进入招式面板, got ' + Game.menu.mode);
    Game.onKey('arrowdown');
    if (Game.menu.sel !== 2) throw new Error('下方向应选中第3招');
    Game.onKey('x');
    if (Game.menu.mode !== 'action') throw new Error('X 应返回主菜单');
    // 键盘：换人菜单（应选中可换精灵）
    Game.menu.sel = 1;
    Game.onKey('z');
    if (Game.menu.mode !== 'switch') throw new Error('应进入换人面板');
    if (Game.switchDisabled(Game.menu.sel)) throw new Error('换人面板初始选中项应可用');
    Game.onKey('x');
    // 鼠标：道具菜单 → 返回
    const br = UI.bagRects || [];
    void br;
    Game.menu = { mode: 'action', sel: 2, forced: false };
    Game.onClick(UI.actionRects[2].x + 2, UI.actionRects[2].y + 2);
    if (Game.menu.mode !== 'bag') throw new Error('点击道具应进入背包');
    Game.onKey('x');
    if (Game.menu.mode !== 'action') throw new Error('X 应从背包返回');
    // 认输确认
    Game.menu = { mode: 'action', sel: 3, forced: false };
    Game.onClick(UI.actionRects[3].x + 2, UI.actionRects[3].y + 2);
    if (Game.menu.mode !== 'confirm') throw new Error('点击认输应弹确认框');
    Game.onKey('x');
    // 选队：点两张卡 + 开始
    Game.state = 'teamSelect';
    Game.chosen = [];
    Game.onClick(UI.teamRects[0].x + 2, UI.teamRects[0].y + 2);
    Game.onClick(UI.teamRects[2].x + 2, UI.teamRects[2].y + 2);
    Game.onClick(UI.teamRects[5].x + 2, UI.teamRects[5].y + 2);
    if (Game.chosen.length !== 3) throw new Error('应已选 3 只, got ' + Game.chosen.length);
    if (Game.state !== 'teamSelect') throw new Error('未点开始时不应开战');
    Game.onClick(UI.teamRects[6].x + 2, UI.teamRects[6].y + 2);
    if (Game.state !== 'battle' || !Game.battle) throw new Error('点击开始应进入战斗');
    // 演示结束画面
    Game.battle.phase = 'over';
    Game.battle.winner = 'player';
    Game.menu = { mode: 'end', sel: 0, forced: false };
    Game.onClick(UI.endRect.x + 2, UI.endRect.y + 2);
    if (Game.state !== 'teamSelect') throw new Error('点击重新开始应回到选队');
    return true;
  });
  t('字体加载状态（非强制）', () => {
    return typeof Fonts.cjk.loaded === 'boolean' && typeof Fonts.title.loaded === 'boolean';
  });
  report();
}

window.addEventListener('DOMContentLoaded', () => Game.boot());
