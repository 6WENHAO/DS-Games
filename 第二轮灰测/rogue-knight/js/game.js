/* game.js — 主循环 / 场景 / 房间流程 / 伤害结算 / 存档 */
(function (K) {
  'use strict';
  var M = K.M, FX = K.FX, S = K.Snd, B = K.B, TS = K.TS;

  var UPGRADES = [
    { id: 'hp', name: '体质', desc: '生命上限 +12', cost: [30, 55, 90, 140, 210], max: 5 },
    { id: 'armor', name: '护甲', desc: '初始护甲 +1', cost: [50, 100, 170], max: 3 },
    { id: 'dmg', name: '力量', desc: '全部伤害 +5%', cost: [40, 75, 120, 180, 260], max: 5 },
    { id: 'crit', name: '精准', desc: '暴击率 +2%', cost: [35, 65, 105, 160], max: 4 },
    { id: 'energy', name: '魔力', desc: '能量上限 +12', cost: [30, 60, 100], max: 3 },
    { id: 'speed', name: '轻盈', desc: '移动速度 +3%', cost: [40, 85, 150], max: 3 },
    { id: 'luck', name: '幸运', desc: '掉落品质与金币提升', cost: [60, 130, 220], max: 3 },
    { id: 'magnet', name: '磁力', desc: '拾取范围提升', cost: [25, 50], max: 2 }
  ];
  var MAXFLOOR = 5;

  var G = {
    W: 1280, H: 720, scene: 'title', t: 0, frame: 0, floor: 1, seed: 1,
    player: null, enemies: [], allies: [], props: [], curRoom: null, rng: null,
    autoAim: true, paused: false, debug: false, showHelp: false,
    cam: { x: 0, y: 0 }, camZ: 1.16, acc: 0, last: 0, slowAcc: 0,
    sel: 0, upSel: 0, UPGRADES: UPGRADES, MAXFLOOR: MAXFLOOR,
    meta: { gems: 0, up: {}, unlocked: ['knight', 'ranger', 'mage', 'rogue'], stats: { runs: 0, wins: 0, kills: 0, best: 1 } },

    init: function (cv) {
      this.cv = cv; this.ctx = cv ? cv.getContext('2d') : null;
      K.In.init(cv);
      this.loadMeta();
      this.rng = new M.RNG(12345);
      return this;
    },
    /* ---------- 存档 ---------- */
    loadMeta: function () {
      try {
        var s = window.localStorage.getItem('rk_save_v1');
        if (s) {
          var o = JSON.parse(s);
          if (o && o.up) {
            this.meta = o;
            if (!this.meta.stats) this.meta.stats = { runs: 0, wins: 0, kills: 0, best: 1 };
            if (!this.meta.unlocked) this.meta.unlocked = ['knight', 'ranger', 'mage', 'rogue'];
          }
        }
      } catch (e) { }
    },
    saveMeta: function () {
      try { window.localStorage.setItem('rk_save_v1', JSON.stringify(this.meta)); } catch (e) { }
    },
    /* ---------- 流程 ---------- */
    newRun: function (chId) {
      this.meta.stats.runs++;
      this.floor = 1;
      this.seed = (Date.now() % 100000) | 0;
      this.player = K.P.create(chId, this.meta);
      this.curRoom = null;
      this.genFloor();
      this.scene = 'play'; this.paused = false;
      S.init(); S.resume(); S.music(true, 'dungeon');
      K.HUD.say('第 1 层', K.D.theme.name + ' · 清空房间开门', 110, '#ffd15c');
      this.saveMeta();
    },
    genFloor: function () {
      FX.reset(); B.reset(); K.I.reset();
      this.enemies.length = 0; this.allies.length = 0;
      this.rng = new M.RNG(this.seed + this.floor * 7919);
      K.D.gen(this.floor, this.rng);
      this.props = K.D.props;
      var st = K.D.D.start;
      this.player.x = st.x; this.player.y = st.y;
      this.cam.x = st.x; this.cam.y = st.y;
      this.curRoom = K.D.roomAt(st.x, st.y);
      if (this.curRoom) this.curRoom.visited = 1;
      S.setMode('dungeon');
    },
    nextFloor: function () {
      if (this.floor >= MAXFLOOR) { this.win(); return; }
      this.floor++;
      S.play('portal', 1); FX.flash(.5, '#c06aff');
      this.genFloor();
      K.HUD.say('第 ' + this.floor + ' 层', K.D.theme.name, 110, '#ffd15c');
      if (this.floor > this.meta.stats.best) { this.meta.stats.best = this.floor; this.saveMeta(); }
    },
    win: function () {
      this.scene = 'win';
      this.meta.stats.wins++;
      this.cashOut();
      S.music(false); S.play('levelup', 1);
    },
    die: function () {
      if (this.scene !== 'play') return;
      this.player.alive = 0;
      this.scene = 'dead';
      this.cashOut();
      S.music(false); S.play('die', 1);
      FX.slow(60, .25); FX.flash(.4, '#ff2a3a');
    },
    cashOut: function () {
      var p = this.player;
      if (!p) return;
      this.meta.gems += p.gems;
      this.meta.stats.kills += p.kills;
      if (this.floor > this.meta.stats.best) this.meta.stats.best = this.floor;
      this.saveMeta();
    },
    /* ---------- 工具 ---------- */
    solid: function (tx, ty) { return K.D.solid(tx, ty); },
    view: function () {
      var c = this.cam, z = this.camZ + FX.zoomOff(), W = this.W, H = this.H;
      var sx = FX.shakeX, sy = FX.shakeY;
      var f = function (x) { return (x - c.x) * z + W / 2 + sx; };
      var g = function (y) { return (y - c.y) * z + H / 2 + sy; };
      return { z: z, tx: f, ty: g, sx: f, sy: g };
    },
    /* ---------- 伤害 ---------- */
    hurtEnemy: function (e, dmg, o) {
      if (!e || !e.alive) return;
      o = o || {};
      var p = this.player;
      var crit = o.crit ? (Math.random() * 100 < o.crit) : false;
      var d = dmg * (crit ? 2 : 1);
      if (o.elem === 'void') d *= 1.15;
      d = Math.max(1, d);
      e.hp -= d; e.flash = Math.max(e.flash, 5);
      if (p) { p.dmgDealt += d; if (p.mods.leech > 0 && p.hp < p.hpMax) { p.hp = Math.min(p.hpMax, p.hp + d * p.mods.leech); } }
      /* 元素 */
      if (o.elem === 'fire') e.burn = Math.max(e.burn, 170);
      else if (o.elem === 'ice') { e.slow = Math.max(e.slow, 130); }
      else if (o.elem === 'poison') e.poison = Math.max(e.poison, 220);
      else if (o.elem === 'shock') { e.stun = Math.max(e.stun, 16); }
      /* 击退 */
      if (!o.noKnock && o.knock) {
        var kf = e.boss ? .1 : (e.def.heavy ? .35 : 1);
        e.kx += (o.dirX || 0) * o.knock * kf; e.ky += (o.dirY || 0) * o.knock * kf;
      }
      /* 反馈 */
      if (!o.noFX) {
        var a = Math.atan2(o.dirY || 0, o.dirX || 1);
        FX.spark(e.x + (o.dirX || 0) * e.r * .4, e.y + (o.dirY || 0) * e.r * .4, a, crit ? 8 : (o.small ? 2 : 4), crit ? '#ffd15c' : '#fff3c0');
        if (!o.small) FX.blood(e.x, e.y, a, crit ? 6 : 3, e.def.id === 'slime' ? '#4aa03a' : '#a8203a');
      }
      var col = crit ? '#ffd15c' : (o.elem ? K.W.ELEM[o.elem].col2 : '#ffffff');
      if (!o.small || crit || d > 12) {
        FX.text(e.x + M.rnd(-6, 6), e.y - e.r - 6, (d >= 10 ? Math.round(d) : d.toFixed(1)) + (crit ? '!' : ''),
          { col: col, size: crit ? 19 : 13, life: crit ? 40 : 30, vy: -1.4 });
      }
      if (crit) { S.play('crit', .8, .04); FX.hitstop(2); FX.shake(3.4, 10); FX.ring(e.x, e.y, 6, 34, '#ffd15c', 12, 3); }
      else S.play('hit', .5, .02);
      if (e.hp <= 0) this.onEnemyDeath(e);
    },
    onEnemyDeath: function (e, quiet) {
      if (!e.alive) return;
      e.alive = 0;
      var p = this.player;
      if (p) p.kills++;
      K.I.spawnDrops(e);
      if (!quiet) {
        FX.burst(e.x, e.y, e.boss ? 46 : 14, { col: '#fff3c0', col2: e.col.b, speed: e.boss ? 9 : 5, size: e.boss ? 6 : 4, flareR: e.r * 1.4 });
        FX.blood(e.x, e.y, M.rnd(M.TAU), e.boss ? 22 : 8, e.def.id === 'slime' ? '#4aa03a' : '#a8203a');
        FX.ring(e.x, e.y, e.r * .4, e.r * 2.6, e.col.b, 18, 4);
        S.play('edie', e.boss ? 1 : .6, .03);
      }
      if (e.boss) {
        FX.slow(50, .25); FX.shake(20, 40); FX.flash(.3, '#fff');
        FX.text(e.x, e.y - 40, 'BOSS 击破!', { col: '#ffd15c', size: 26, life: 90 });
        S.play('levelup', 1); S.setMode('dungeon');
      } else if (e.def.split && !e.exploded) {
        for (var i = 0; i < 2; i++) {
          var s = K.E.spawn('slime', e.x + M.rnd(-16, 16), e.y + M.rnd(-16, 16), {});
          s.hpMax = Math.max(6, Math.round(s.hpMax * .35)); s.hp = s.hpMax;
          s.r *= .68; s.speed *= 1.25; s.coin = 1; s.def = Object.create(s.def); s.def.split = 0;
          s.room = e.room;
        }
      }
      if (e.elite) FX.text(e.x, e.y - 30, '精英击杀!', { col: '#ffc23a', size: 15, life: 50 });
    },
    hurtPlayer: function (dmg, o) {
      var p = this.player;
      if (!p || !p.alive || this.scene !== 'play') return;
      if (p.invT > 0 || p.dashT > 0) return;
      o = o || {};
      var d = dmg;
      if (p.armor > 0) {
        p.armor--;
        d = Math.max(0, d - 16);
        S.play('shield', .8);
        FX.ring(p.x, p.y, 14, 40, '#7fb0ff', 16, 3);
      }
      if (d > 0) p.hp -= d;
      p.noDmgT = 0;
      p.invT = Math.max(30, 30 + p.mods.reactInv);
      p.hitFlash = 6;
      FX.shake(7, 18, Math.atan2(o.dirY || 0, o.dirX || 1));
      FX.flash(.16, '#ff2a3a');
      FX.hitstop(3);
      FX.blood(p.x, p.y, Math.atan2(o.dirY || 0, o.dirX || 1), 8, '#c8203a');
      FX.text(p.x, p.y - 26, '-' + Math.round(d || dmg), { col: '#ff6a6a', size: 16, life: 34 });
      S.play('hurt', 1);
      K.In.rumble(.7, 140);
      if (o.knock) { p.vx = (o.dirX || 0) * o.knock; K.Col.moveBody(p, (o.dirX || 0) * o.knock, (o.dirY || 0) * o.knock, this.solid); }
      if (p.mods.thorns > 0) B.explode(p.x, p.y, 96, p.mods.thorns, 0, '#7ad04a');
      if (p.hp <= 0) { p.hp = 0; this.die(); }
    },
    hitProps: function (x, y, r, dmg, team) {
      for (var i = 0; i < this.props.length; i++) {
        var q = this.props[i];
        if (!q.alive || q.noHit) continue;
        if (M.len(q.x - x, q.y - y) < r + q.r) this.hurtProp(q, dmg);
      }
    },
    hurtProp: function (q, dmg) {
      q.hp -= dmg; q.shake = 6;
      if (q.hp > 0) { FX.spark(q.x, q.y, M.rnd(M.TAU), 3, '#c8b08a'); S.play('hitWall', .4, .04); return; }
      q.alive = 0;
      FX.burst(q.x, q.y, 12, { col: '#c8b08a', col2: '#8a6a3a', speed: 4, size: 4 });
      FX.smoke(q.x, q.y, 4, '#8a8272', 1.4);
      S.play('shatter', .7, .02);
      if (q.kind === 'barrel') {
        B.explode(q.x, q.y, 92, 26 + this.floor * 3, 0, '#ff9a2e');
        var p = this.player;
        if (p && p.alive && M.len(p.x - q.x, p.y - q.y) < 92 + p.r) this.hurtPlayer(16, { dirX: (p.x - q.x) / 92, dirY: (p.y - q.y) / 92, knock: 4 });
      } else if (q.kind === 'crate') {
        for (var i = 0; i < 4; i++) K.I.drop(q.x, q.y, 'coin', { amount: 2 });
        if (M.chance(.25)) K.I.drop(q.x, q.y, 'heart');
      } else {
        if (M.chance(.5)) K.I.drop(q.x, q.y, 'coin', { amount: 2 });
        if (M.chance(.18)) K.I.drop(q.x, q.y, 'energy');
      }
    },
    /* ---------- 房间 ---------- */
    startFight: function (r) {
      if (r.state !== 'idle' || !r.spawns.length) return;
      r.state = 'fighting';
      K.D.setDoors(r, 1);
      S.play('door', .8);
      for (var i = 0; i < r.spawns.length; i++) {
        var sp = r.spawns[i], e;
        if (sp.boss !== undefined) {
          e = K.E.spawnBoss(sp.boss, sp.x, sp.y);
          K.HUD.say(e.name, '击败它前往下一层', 130, '#ff5a4a');
          S.setMode('boss');
        } else e = K.E.spawn(sp.id, sp.x, sp.y, { elite: sp.elite });
        e.room = r.id;
      }
      if (r.type !== 'boss') K.HUD.say('房间封锁', '清空所有敌人', 70, '#ff8a4a');
    },
    clearRoom: function (r) {
      r.state = 'clear'; r.cleared = 1;
      K.D.setDoors(r, 0);
      S.play('clear', 1);
      FX.flash(.08, '#ffd15c');
      var p = this.player;
      for (var i = 0; i < 5; i++) K.I.drop(r.wx + M.rnd(-40, 40), r.wy + M.rnd(-40, 40), 'coin', { amount: 2 + this.floor });
      if (r.type === 'boss') {
        K.I.drop(r.wx, r.wy - 40, 'portal', { pop: 0 });
        K.I.drop(r.wx - 70, r.wy + 40, 'chest', { pop: 0, big: 1 });
        K.HUD.say('BOSS 已被击败！', '进入传送门前往下一层', 150, '#ffd15c');
      } else {
        if (M.chance(.4)) K.I.drop(r.wx, r.wy, 'chest', { pop: 0 });
        if (M.chance(.3)) K.I.drop(r.wx + 50, r.wy, 'heart');
        K.HUD.say('房间清空', '门已打开', 60, '#8ad06a');
      }
    },
    /* ---------- 更新 ---------- */
    step: function () {
      this.t++;
      this.keys();
      if (this.scene !== 'play') { this.menuInput(); K.In.endFrame(); return; }
      if (this.paused) { K.In.endFrame(); return; }
      this.frame++;
      var p = this.player, i, e;
      /* 玩家 */
      K.P.update(p);
      /* 房间 */
      var r = K.D.roomAt(p.x, p.y);
      if (r && r !== this.curRoom) {
        this.curRoom = r; r.visited = 1;
        if (r.state === 'idle' && r.spawns.length) this.startFight(r);
      }
      if (this.curRoom && this.curRoom.state === 'fighting') {
        var left = 0;
        for (i = 0; i < this.enemies.length; i++) if (this.enemies[i].alive && this.enemies[i].room === this.curRoom.id) left++;
        if (left === 0) this.clearRoom(this.curRoom);
      }
      /* 敌人：战斗房内的敌人不允许离开房间（防止死局） */
      if (this.curRoom && this.curRoom.state === 'fighting' && this.frame % 20 === 0) {
        var rr0 = this.curRoom, mx0 = (rr0.x0 - 1) * TS, my0 = (rr0.y0 - 1) * TS, mx1 = (rr0.x1 + 2) * TS, my1 = (rr0.y1 + 2) * TS;
        for (i = 0; i < this.enemies.length; i++) {
          e = this.enemies[i];
          if (!e.alive || e.room !== rr0.id) continue;
          if (e.x < mx0 || e.x > mx1 || e.y < my0 || e.y > my1) {
            e.x = M.lerp(e.x, rr0.wx, .5); e.y = M.lerp(e.y, rr0.wy, .5);
            e.kx = e.ky = 0;
            FX.burst(e.x, e.y, 6, { col: '#c06aff', col2: '#eaffff', speed: 3, size: 3, flare: 0 });
          }
        }
      }
      for (i = 0; i < this.enemies.length; i++) K.E.update(this.enemies[i]);
      K.E.separate(this.enemies);
      for (i = this.enemies.length - 1; i >= 0; i--) if (!this.enemies[i].alive) this.enemies.splice(i, 1);
      /* 友方（炮台） */
      for (i = this.allies.length - 1; i >= 0; i--) {
        var a = this.allies[i]; a.t++; a.life--;
        if (a.life <= 0) { this.allies.splice(i, 1); FX.burst(a.x, a.y, 10, { col: '#9adfff', col2: '#7fb0ff', speed: 3, size: 3 }); continue; }
        var tg = B.nearest(a.x, a.y, 0, 420);
        if (tg) {
          a.aim = Math.atan2(tg.y - a.y, tg.x - a.x);
          if (a.cd-- <= 0) {
            a.cd = 16;
            B.spawn({ x: a.x + Math.cos(a.aim) * 14, y: a.y + Math.sin(a.aim) * 14, vx: Math.cos(a.aim) * 13, vy: Math.sin(a.aim) * 13,
              r: 4, size: 4, dmg: a.dmg, team: 0, style: 'bullet', col: '#9adfff', life: 60, knock: 1.6, owner: p, crit: p.mods.crit });
            FX.muzzle(a.x + Math.cos(a.aim) * 16, a.y + Math.sin(a.aim) * 16, a.aim, 8, '#9adfff');
            S.play('smg', .35, .04);
          }
        }
      }
      /* 子弹 */
      B.update();
      /* 子弹 vs 物件 */
      for (i = 0; i < B.bullets.length; i++) {
        var b = B.bullets[i];
        if (b.style === 'blackhole') continue;
        for (var j = 0; j < this.props.length; j++) {
          var q = this.props[j];
          if (!q.alive || q.noHit) continue;
          if (M.len(q.x - b.x, q.y - b.y) < q.r + b.r) {
            this.hurtProp(q, b.dmg);
            if (b.explode) B.explode(b.x, b.y, b.explode.r, b.explode.dmg, b.team, b.col);
            if (!(b.pierce > 0)) { B.bullets.splice(i, 1); i--; }
            else b.pierce--;
            break;
          }
        }
      }
      /* 近战 vs 物件 */
      for (i = 0; i < B.swings.length; i++) {
        var sw = B.swings[i];
        if (sw.team !== 0 || sw.t > sw.frames * .8) continue;
        for (j = 0; j < this.props.length; j++) {
          var q2 = this.props[j];
          if (!q2.alive || q2.noHit || sw.hit.indexOf(q2) >= 0) continue;
          if (K.Col.arcHit(sw.x, sw.y, sw.r0, sw.r1, sw.cur || sw.ang, .5, q2.x, q2.y, q2.r)) { sw.hit.push(q2); this.hurtProp(q2, sw.dmg); }
        }
      }
      /* 物件 */
      for (i = 0; i < this.props.length; i++) {
        var q3 = this.props[i];
        q3.t++;
        if (q3.shake > 0) q3.shake--;
        if (q3.light && q3.t % 6 === 0) FX.light(q3.x, q3.y - 14, 130 + M.rnd(-10, 10), 'rgba(255,180,90,.5)', 8);
      }
      K.I.update();
      FX.update();
      /* 相机 */
      var tx = p.x + Math.cos(p.aim) * 44, ty = p.y + Math.sin(p.aim) * 44;
      this.cam.x = M.lerp(this.cam.x, tx, .1); this.cam.y = M.lerp(this.cam.y, ty, .1);
      var z = this.camZ, hw = this.W / 2 / z, hh = this.H / 2 / z;
      var mw = K.D.D.w * TS, mh = K.D.D.h * TS;
      this.cam.x = M.clamp(this.cam.x, hw, Math.max(hw, mw - hw));
      this.cam.y = M.clamp(this.cam.y, hh, Math.max(hh, mh - hh));
      K.In.endFrame();
    },
    keys: function () {
      var In = K.In;
      if (In.tap('F1')) this.debug = !this.debug;
      if (In.tap('KeyM')) { S.init(); S.music(!S.musicOn, this.enemies.some(function (e) { return e.boss; }) ? 'boss' : 'dungeon'); }
      if (this.scene === 'play') {
        if (In.tap('KeyP')) { this.paused = !this.paused; S.play('menu'); }
        if (In.tap('KeyR') && this.paused) { this.newRun(this.player.ch.id); }
        if (In.tap('Escape')) { if (this.paused) { this.cashOut(); this.scene = 'title'; S.music(false); } else this.paused = true; }
        if (In.tap('KeyR') && !this.paused) { this.autoAim = !this.autoAim; S.play('menu'); }
      }
    },
    menuInput: function () {
      var In = K.In, ok = In.tap('Enter') || In.tap('Space') || In.tap('NumpadEnter');
      var up = In.tap('KeyW') || In.tap('ArrowUp'), dn = In.tap('KeyS') || In.tap('ArrowDown');
      var lf = In.tap('KeyA') || In.tap('ArrowLeft'), rt = In.tap('KeyD') || In.tap('ArrowRight');
      var esc = In.tap('Escape');
      if (this.scene === 'title') {
        if (ok) { S.init(); S.resume(); S.play('ok'); this.scene = 'select'; }
        if (In.tap('KeyH')) this.scene = 'help';
        return;
      }
      if (this.scene === 'help') { if (ok || esc) { this.scene = 'title'; S.play('menu'); } return; }
      if (this.scene === 'select') {
        var n = K.P.CHARS.length;
        if (lf) { this.sel = (this.sel + n - 1) % n; S.play('menu'); }
        if (rt) { this.sel = (this.sel + 1) % n; S.play('menu'); }
        if (up) { this.sel = (this.sel + n - 4) % n; S.play('menu'); }
        if (dn) { this.sel = (this.sel + 4) % n; S.play('menu'); }
        if (In.tap('KeyU')) { this.scene = 'upgrade'; this.upSel = 0; S.play('ok'); }
        if (esc) { this.scene = 'title'; S.play('menu'); }
        if (ok) {
          var c = K.P.CHARS[this.sel];
          if (this.meta.unlocked.indexOf(c.id) < 0) {
            if (this.meta.gems >= c.unlock) {
              this.meta.gems -= c.unlock; this.meta.unlocked.push(c.id); this.saveMeta();
              S.play('levelup', 1); FX.flash(.2, '#ffd15c');
            } else S.play('no', .8);
          } else this.newRun(c.id);
        }
        return;
      }
      if (this.scene === 'upgrade') {
        var m = UPGRADES.length;
        if (up) { this.upSel = (this.upSel + m - 1) % m; S.play('menu'); }
        if (dn) { this.upSel = (this.upSel + 1) % m; S.play('menu'); }
        if (esc) { this.scene = 'select'; S.play('menu'); }
        if (ok) {
          var u = UPGRADES[this.upSel], lv = this.meta.up[u.id] || 0;
          if (lv < u.max && this.meta.gems >= u.cost[lv]) {
            this.meta.gems -= u.cost[lv]; this.meta.up[u.id] = lv + 1; this.saveMeta();
            S.play('levelup', .9); FX.flash(.1, '#ffd15c');
          } else S.play('no', .8);
        }
        return;
      }
      if (this.scene === 'dead' || this.scene === 'win') {
        if (In.tap('KeyR')) { this.newRun(this.player.ch.id); return; }
        if (ok || esc) { this.scene = 'title'; S.music(false); }
        return;
      }
    },
    /* ---------- 绘制 ---------- */
    render: function () {
      var ctx = this.ctx, W = this.W, H = this.H;
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (this.scene === 'title') { K.HUD.drawTitle(ctx, W, H, this.t, this.meta); return; }
      if (this.scene === 'help') { K.HUD.drawTitle(ctx, W, H, this.t, this.meta); K.HUD.drawHelp(ctx, W, H); return; }
      if (this.scene === 'select') { K.HUD.drawSelect(ctx, W, H, this.sel, this.meta, this.t); return; }
      if (this.scene === 'upgrade') { K.HUD.drawUpgrade(ctx, W, H, this, this.upSel); return; }
      if (!this.player) return;
      var V = this.view(), i;
      /* 地图 */
      K.D.draw(ctx, V, W, H);
      B.drawUnder(ctx, V);
      K.I.drawUnder(ctx, V);
      /* 实体按 y 排序 */
      var list = [];
      for (i = 0; i < this.props.length; i++) if (this.props[i].alive) list.push(this.props[i]);
      for (i = 0; i < this.enemies.length; i++) list.push(this.enemies[i]);
      for (i = 0; i < this.allies.length; i++) list.push(this.allies[i]);
      if (this.player.alive || this.scene === 'dead') list.push(this.player);
      list.sort(function (a, b) { return a.y - b.y; });
      K.I.draw(ctx, V);
      for (i = 0; i < list.length; i++) {
        var o = list[i];
        if (o === this.player) K.P.draw(o, ctx, V);
        else if (o.kind === 'turret') {
          K.Art.shadow(ctx, V.tx(o.x), V.ty(o.y) + 2 * V.z, 12 * V.z, 5 * V.z, .3);
          K.Art.item(ctx, V.tx(o.x), V.ty(o.y), V.z, 'turret', o.t, o);
          var lk = o.life / 720;
          ctx.fillStyle = 'rgba(10,10,18,.7)'; ctx.fillRect(V.tx(o.x) - 12 * V.z, V.ty(o.y) - 22 * V.z, 24 * V.z, 3.4 * V.z);
          ctx.fillStyle = '#9adfff'; ctx.fillRect(V.tx(o.x) - 12 * V.z, V.ty(o.y) - 22 * V.z, 24 * V.z * lk, 3.4 * V.z);
        } else if (o.def) K.E.draw(o, ctx, V);
        else {
          var sx = o.shake ? M.rnd(-2, 2) : 0;
          K.Art.shadow(ctx, V.tx(o.x), V.ty(o.y) + 4 * V.z, 14 * V.z, 5 * V.z, .28);
          K.Art.item(ctx, V.tx(o.x) + sx, V.ty(o.y), V.z, o.kind, o.t, o);
        }
      }
      B.draw(ctx, V);
      FX.drawParts(ctx, V, true);
      FX.drawBeams(ctx, V);
      FX.drawParts(ctx, V, false);
      FX.drawLights(ctx, V);
      FX.drawTexts(ctx, V);
      FX.drawFlash(ctx, W, H);
      K.HUD.drawGame(ctx, W, H, this);
      K.P.drawAim(ctx, V, this.player);
      if (this.debug) this.drawDebug(ctx, V);
      if (this.paused) K.HUD.drawPause(ctx, W, H, this);
      if (this.scene === 'dead') K.HUD.drawEnd(ctx, W, H, this, false);
      if (this.scene === 'win') K.HUD.drawEnd(ctx, W, H, this, true);
    },
    drawDebug: function (ctx, V) {
      var i, D = K.D.D;
      ctx.save();
      /* 房间 */
      for (i = 0; i < D.rooms.length; i++) {
        var r = D.rooms[i];
        ctx.strokeStyle = r.state === 'fighting' ? 'rgba(255,90,74,.8)' : 'rgba(120,255,160,.35)';
        ctx.lineWidth = 1.4;
        ctx.strokeRect(V.tx(r.x0 * TS), V.ty(r.y0 * TS), (r.x1 - r.x0 + 1) * TS * V.z, (r.y1 - r.y0 + 1) * TS * V.z);
        K.HUD.txt(ctx, r.type + (r.cleared ? '(清)' : ''), V.tx(r.wx), V.ty(r.y0 * TS) + 12, 11, '#8ad06a', 'center', K.HUD.CN(11, 700));
      }
      /* 门 */
      for (i = 0; i < D.doors.length; i++) {
        var d = D.doors[i];
        ctx.strokeStyle = d.closed ? '#ff5a4a' : '#6ad4ff';
        for (var j = 0; j < d.tiles.length; j++) ctx.strokeRect(V.tx(d.tiles[j][0] * TS) + 2, V.ty(d.tiles[j][1] * TS) + 2, TS * V.z - 4, TS * V.z - 4);
      }
      /* 实体碰撞圈 */
      ctx.strokeStyle = 'rgba(120,190,255,.9)'; ctx.lineWidth = 1.4;
      for (i = 0; i < this.enemies.length; i++) {
        var e = this.enemies[i];
        ctx.beginPath(); ctx.arc(V.tx(e.x), V.ty(e.y), e.r * V.z, 0, M.TAU); ctx.stroke();
        if (e.atk && e.atk.range) { ctx.strokeStyle = 'rgba(255,200,60,.22)'; ctx.beginPath(); ctx.arc(V.tx(e.x), V.ty(e.y), e.atk.range * V.z, 0, M.TAU); ctx.stroke(); ctx.strokeStyle = 'rgba(120,190,255,.9)'; }
      }
      var p = this.player;
      ctx.strokeStyle = 'rgba(120,255,140,1)';
      ctx.beginPath(); ctx.arc(V.tx(p.x), V.ty(p.y), p.r * V.z, 0, M.TAU); ctx.stroke();
      for (i = 0; i < this.props.length; i++) {
        var q = this.props[i]; if (!q.alive) continue;
        ctx.strokeStyle = q.noHit ? 'rgba(140,140,160,.5)' : 'rgba(255,180,90,.8)';
        ctx.beginPath(); ctx.arc(V.tx(q.x), V.ty(q.y), q.r * V.z, 0, M.TAU); ctx.stroke();
      }
      B.drawDebug(ctx, V);
      K.HUD.txt(ctx, '实体 ' + (this.enemies.length + this.props.length) + '  子弹 ' + B.count + '  粒子 ' + FX.count + '  帧 ' + this.frame,
        14, this.H - 100, 12, '#9adfff', 'left', K.HUD.CN(12, 700));
      ctx.restore();
    },
    /* ---------- 主循环 ---------- */
    simStep: function () {
      var ts = (this.scene === 'play' && !this.paused) ? FX.slowTick() : 1;
      this.slowAcc += ts;
      var n = 0;
      while (this.slowAcc >= 1 && n < 3) { this.slowAcc -= 1; K.In.update(); this.step(); n++; }
      if (n === 0) { K.In.update(); K.In.endFrame(); FX.update(); }
    },
    loop: function (now) {
      var self = this;
      if (!this.last) this.last = now;
      var dt = now - this.last; this.last = now;
      if (dt > 200) dt = 200;
      this.acc += dt;
      var steps = 0;
      while (this.acc >= 1000 / 60 && steps < 4) { this.acc -= 1000 / 60; this.simStep(); steps++; }
      this.render();
      if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(function (n) { self.loop(n); });
    }
  };
  K.Game = G;
})(window.K);
