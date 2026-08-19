/* ============================================================
   vm.js — 剧本虚拟机 / 演出调度 / 场景与角色绘制
   剧本是一个命令数组，支持标签、跳转、条件、子脚本调用
   ============================================================ */
(function (AA) {
  'use strict';
  var U = AA.U, PX = AA.PX, P = AA.PAL, F = AA.FONT, S = AA.SFX, M = AA.MUSIC;
  var SCN = AA.SCENES, RIG = AA.RIG, FX = AA.FX, TB = AA.TEXTBOX, HUD = AA.HUD, RC = AA.RECORD;
  var VM = AA.VM = {};

  var W = 256, H = 192;

  /* ---------------- 状态 ---------------- */
  var G = VM.G = {
    flags: Object.create(null),
    actors: Object.create(null),   // who -> {pose, since}
    roles: Object.create(null),    // 站位 -> 角色名
    focus: null,
    life: 5, lifeMax: 5,
    animT: 0,
    checkpoint: null,
    chapterTitle: '', phase: '',
    ended: false
  };
  var DEFAULT_ROLES = {
    defense: 'naruhodo', assistant: 'mayoi',
    prosecutor: 'mitsurugi', judge: 'judge', witness: null
  };

  var script = [], pc = 0, stack = [], mainScript = [];
  var state = 'idle';    // idle|run|text|wait|choice|testimony|invest|record|over|done
  var waitT = 0, waitAfter = null;
  var pendingChoice = null;
  var labelMaps = new WeakMap();
  var autoAdvance = 0;

  VM.state = function () { return state; };
  VM.setState = function (s) { state = s; };
  VM.flag = function (k, v) { if (v === undefined) return G.flags[k]; G.flags[k] = v; };

  function labelsOf(s) {
    var m = labelMaps.get(s);
    if (m) return m;
    m = Object.create(null);
    for (var i = 0; i < s.length; i++) if (s[i] && s[i].t === 'label') m[s[i].name] = i;
    labelMaps.set(s, m);
    return m;
  }

  VM.start = function (sc, o) {
    o = o || {};
    script = mainScript = sc; pc = 0; stack.length = 0;
    G.flags = Object.create(null);
    G.actors = Object.create(null);
    G.roles = Object.assign(Object.create(null), DEFAULT_ROLES);
    G.focus = null;
    G.life = G.lifeMax = o.life || 5;
    G.ended = false;
    G.checkpoint = null;
    HUD.reset();
    HUD.setLife(G.life, G.lifeMax);
    RC.reset();
    FX.clear();
    TB.hide();
    state = 'run';
    if (o.flags) for (var fk in o.flags) G.flags[fk] = o.flags[fk];
    if (o.items && AA.CASE1) {
      for (var ii = 0; ii < o.items.length; ii++) {
        var def = AA.CASE1.items[o.items[ii]];
        if (def) RC.add(Object.assign({ id: o.items[ii] }, def));
      }
    }
    if (o.at) { G.checkpoint = { label: o.at }; VM.jump(o.at); }
    run();
  };

  VM.jump = function (label) {
    var m = labelsOf(script);
    if (m[label] === undefined) { U.dbg('missing label', label); return false; }
    pc = m[label] + 1;
    return true;
  };

  /** 调用子脚本；返回后继续原处 */
  VM.call = function (sub, onReturn) {
    if (!sub || !sub.length) { if (onReturn) onReturn(); return; }
    stack.push({ script: script, pc: pc, onReturn: onReturn });
    script = sub; pc = 0;
  };
  VM.callAndRun = function (sub, onReturn) {
    VM.call(sub, onReturn);
    state = 'run';
    run();
  };

  function popScript() {
    var fr = stack.pop();
    script = fr.script; pc = fr.pc;
    if (fr.onReturn) fr.onReturn();
  }

  /* ---------------- 角色 ---------------- */
  function actor(who) {
    if (!G.actors[who]) G.actors[who] = { pose: 'normal', since: 0, alpha: 1, dy: 0 };
    return G.actors[who];
  }
  VM.actor = actor;
  VM.setPose = function (who, pose) {
    var a = actor(who);
    if (a.pose !== pose) { a.pose = pose; a.since = G.animT; }
  };
  VM.addActor = function (who, pose) { var a = actor(who); a.pose = pose || a.pose; a.alpha = 1; };
  VM.removeActor = function (who) { delete G.actors[who]; };
  VM.clearActors = function () { G.actors = Object.create(null); };

  /* ---------------- 命令执行 ----------------
     相机槽位按「站位」命名（defense / assistant / prosecutor / witness / judge），
     由 G.roles 决定站位上是谁。换证人只需改 roles，
     也不会出现两个立绘挤在同一处或互相重叠。 */
  var ROLECAM = {
    defense: 'defense', assistant: 'defenseBoth',
    prosecutor: 'prosecution', witness: 'witness', judge: 'judge'
  };
  function roleOf(who) {
    for (var r in G.roles) if (G.roles[r] === who) return r;
    return null;
  }
  VM.roleOf = roleOf;

  function autoCam(who) {
    if (!SCN.scene()) return;
    if (SCN.name() !== 'court') return;
    var want = ROLECAM[roleOf(who)];
    if (!want || !SCN.hasCam(want)) return;
    if (SCN.camName() === want) return;
    if (want === 'defense' && SCN.camName() === 'defenseBoth') return;
    SCN.moveTo(want, 0.34, U.ease.inOutCubic);
    S.whoosh(want === 'prosecution' ? 1 : -1, .7);
  }

  function exec(c) {
    if (!c) return;
    switch (c.t) {
      case 'label': break;

      case 'say': {
        var who = c.who;
        if (who) {
          VM.addActor(who, c.pose || 'normal');
          if (c.pose) VM.setPose(who, c.pose);
          G.focus = who;
          if (c.cam) SCN.moveTo(c.cam, c.camDur == null ? .34 : c.camDur);
          else if (c.autoCam !== false) autoCam(who);
        }
        var def = who && RIG.get(who);
        var label = c.label !== undefined ? c.label : (def ? def.label : '');
        TB.show(c.text, {
          label: label, style: c.style || 'normal',
          speed: c.speed, instant: c.instant,
          gender: def ? def.gender : 'm'
        });
        HUD.pushLog(label, F.plain(c.text));
        state = 'text';
        break;
      }
      case 'nar':
        G.focus = null;
        TB.show(c.text, { label: '', style: 'narrate', speed: c.speed });
        HUD.pushLog('', F.plain(c.text));
        state = 'text';
        break;
      case 'think': {
        var w2 = c.who || 'naruhodo';
        if (c.pose) { VM.addActor(w2, c.pose); G.focus = w2; autoCam(w2); }
        var d2 = RIG.get(w2);
        TB.show(c.text, { label: (d2 ? d2.label : '') + '（心声）', style: 'thought', speed: c.speed });
        HUD.pushLog((d2 ? d2.label : '') + '（心）', F.plain(c.text));
        state = 'text';
        break;
      }

      case 'scene':
        SCN.load(c.name, c.cam);
        if (c.clear !== false) VM.clearActors();
        if (c.actors) for (var i = 0; i < c.actors.length; i++) VM.addActor(c.actors[i]);
        break;
      case 'cam':
        if (c.dur) SCN.moveTo(c.name, c.dur, c.ease ? U.ease[c.ease] : undefined);
        else SCN.setCam(c.name);
        if (c.sfx !== false && c.dur) S.whoosh(c.dir || -1, .7);
        break;
      case 'pose':
        VM.setPose(c.who, c.pose);
        if (c.focus) G.focus = c.who;
        break;
      case 'actors':
        VM.clearActors();
        for (var q = 0; q < (c.list || []).length; q++) VM.addActor(c.list[q]);
        break;
      case 'remove': VM.removeActor(c.who); break;
      case 'cast':
        for (var rk in c) {
          if (rk === 't') continue;
          G.roles[rk] = c[rk];
          if (c[rk]) VM.addActor(c[rk], 'normal');
        }
        break;

      case 'bgm':
        if (c.name) M.play(c.name, { fadeIn: c.fadeIn, xfade: c.xfade, restart: c.restart });
        break;
      case 'bgmStop': M.stop(c.fade == null ? .6 : c.fade); break;
      case 'duck': M.duck(c.amt == null ? .35 : c.amt, c.dur || .8); break;

      case 'sfx':
        if (S[c.name]) S[c.name].apply(S, c.args || []);
        break;

      case 'fx': {
        var d = 0;
        if (c.name === 'shake') d = FX.shake.apply(FX, c.args || [5, .4]);
        else if (c.name === 'flash') d = FX.flash.apply(FX, c.args || ['#ffffff', .2]);
        else if (FX[c.name]) d = FX[c.name].apply(FX, c.args || []);
        if (c.wait) { state = 'wait'; waitT = (c.waitDur || d || .3); }
        break;
      }
      case 'bubble': {
        var g = 'm';
        if (c.who) { var dd = RIG.get(c.who); if (dd) g = dd.gender; VM.addActor(c.who, c.pose || 'objection'); G.focus = c.who; }
        if (c.cam) SCN.setCam(c.cam); else if (c.who) autoCam(c.who);
        var dur = FX.bubble(c.kind || 'objection', { gender: g });
        state = 'wait'; waitT = dur * (c.hold == null ? .82 : c.hold);
        break;
      }
      case 'title':
        state = 'wait'; waitT = FX.testimonyTitle(c.text, c.dur) * .8;
        break;

      case 'wait': state = 'wait'; waitT = c.dur || .4; break;

      case 'fade':
        state = 'wait';
        waitT = c.dir === 'in' ? FX.fadeIn(c.dur, c.color) : FX.fadeOut(c.dur, c.color);
        break;
      case 'wipe': state = 'wait'; waitT = FX.wipe(c.dur, c.color, c.dirv) * .5; break;

      case 'evidence': {
        var it = AA.CASE1 && AA.CASE1.items[c.id];
        if (it) {
          if (RC.add(Object.assign({ id: c.id }, it))) {
            if (c.silent !== true) {
              S.ding();
              FX.flash('#ffffff', .3, .35);
            }
          }
        }
        break;
      }
      case 'set': G.flags[c.flag] = c.value === undefined ? true : c.value; break;
      case 'goto': VM.jump(c.label); break;
      case 'if':
        if (c.flag ? !!G.flags[c.flag] === (c.value === undefined ? true : c.value) : !!c.test(G)) VM.jump(c.label);
        break;
      case 'ifnot':
        if (!G.flags[c.flag]) VM.jump(c.label);
        break;
      case 'ifitem':
        if (RC.has(c.id)) VM.jump(c.label);
        break;

      case 'choice':
        pendingChoice = c;
        HUD.setMenu(c.options.map(function (o) {
          return { label: o.label, enabled: o.enabled === undefined ? true : (typeof o.enabled === 'function' ? o.enabled(G) : o.enabled), done: o.flag ? !!G.flags[o.flag] : false };
        }), { title: c.title || '' });
        state = 'choice';
        break;

      case 'fn': c.fn(G, VM); break;

      case 'life': HUD.setLife(G.life = c.n, G.lifeMax); break;
      case 'penalty': VM.penalty(c.n || 1); break;

      case 'phase': HUD.setTitle(c.title === undefined ? undefined : c.title, c.phase); break;
      case 'hint': HUD.setHint(c.text); break;
      case 'buttons': HUD.setButtons(c.list || []); break;

      case 'checkpoint':
        G.checkpoint = { label: c.label, scene: SCN.name(), cam: SCN.camName() };
        // 自动存档
        if (AA.SAVE) {
          var ids = [];
          var all = RC.all();
          for (var ai = 0; ai < all.length; ai++) ids.push(all[ai].id);
          AA.SAVE.saveSlot({
            label: c.label, life: G.life, items: ids,
            flags: Object.assign({}, G.flags), title: HUD.state.title
          });
        }
        break;

      case 'testimony':
        // startTestimony 内部会以子脚本方式播放引子与证言；
        // 状态交由它自己管理（引子期间应为 'text'，进入交叉询问时才变 'testimony'）
        AA.COURT.startTestimony(c.data);
        break;
      case 'invest':
        AA.COURT.startInvest(c.data);
        state = 'invest';
        break;

      case 'record':
        RC.open(c.mode || 'view');
        state = 'record';
        break;

      case 'memory': FX.memory(!!c.on); break;
      case 'bars': FX.bars(!!c.on); break;

      case 'end':
        G.ended = true;
        state = 'done';
        if (VM.onEnd) VM.onEnd(c.result || 'clear');
        break;

      default:
        U.dbg('unknown cmd', c.t);
    }
  }

  function run() {
    var guard = 0;
    while (state === 'run') {
      if (++guard > 4000) { U.dbg('runaway script'); break; }
      if (pc >= script.length) {
        if (stack.length) { popScript(); continue; }
        state = 'done';
        break;
      }
      exec(script[pc++]);
    }
  }
  VM.run = run;
  VM.resume = function () { if (state === 'wait' || state === 'text') { state = 'run'; run(); } };
  VM.continueRun = function () { state = 'run'; run(); };

  /* ---------------- 扣血 ---------------- */
  VM.penalty = function (n) {
    G.life = Math.max(0, G.life - (n || 1));
    HUD.setLife(G.life, G.lifeMax);
    var d = FX.penalty();
    if (G.life <= 0) {
      state = 'wait'; waitT = d + .2; waitAfter = function () { gameOver(); };
    } else {
      state = 'wait'; waitT = d * .8;
    }
  };

  function gameOver() {
    state = 'over';
    M.stop(.3);
    S.gameover();
    FX.clear();
    FX.cover('#000000');
    overT = 0;
  }
  var overT = 0;

  VM.retry = function () {
    FX.clear(); FX.uncover();
    G.life = G.lifeMax;
    HUD.setLife(G.life, G.lifeMax);
    HUD.setMenu(null); HUD.setButtons([]); HUD.showLife(true);
    if (AA.COURT && AA.COURT.abort) AA.COURT.abort();
    TB.hide();
    M.stop(0);
    var cp = G.checkpoint;
    // 关键：回到主剧本，否则仍停留在子脚本里
    stack.length = 0;
    script = mainScript; pc = 0;
    if (cp) {
      if (cp.scene) SCN.load(cp.scene, cp.cam);
      VM.jump(cp.label);
    }
    FX.fadeIn(.5);
    state = 'run';
    run();
  };

  /* ---------------- 更新 ---------------- */
  VM.update = function (dt) {
    G.animT += dt;
    SCN.update(dt);
    FX.update(dt);
    TB.update(dt);
    HUD.update(dt);
    RC.update(dt);

    if (state === 'wait') {
      waitT -= dt;
      if (waitT <= 0 && !FX.busy()) {
        var af = waitAfter; waitAfter = null;
        if (af) af();
        else { state = 'run'; run(); }
      }
    } else if (state === 'text') {
      if (AA.INPUT.skipping() && TB.complete()) {
        autoAdvance += dt;
        if (autoAdvance > .05) { autoAdvance = 0; nextText(); }
      }
    } else if (state === 'over') {
      overT += dt;
    } else if (state === 'testimony' || state === 'invest') {
      AA.COURT.update(dt);
    }
  };

  function nextText() {
    var r = TB.advance();
    if (r === 'end') {
      TB.hide();
      state = 'run';
      run();
    }
  }
  VM.nextText = nextText;

  /* ---------------- 输入 ---------------- */
  VM.handleKey = function (k) {
    if (state === 'over') {
      if (k === 'confirm') { S.select(); VM.retry(); }
      return;
    }
    if (RC.isOpen()) {
      RC.handleKey(k);
      return;
    }
    if (HUD.logOpen()) { HUD.handleKey(k); return; }
    if (k === 'log') { HUD.toggleLog(); return; }

    if (state === 'text') {
      if (k === 'confirm') nextText();
      else if (k === 'record') VM.openRecord('view');
      return;
    }
    if (state === 'choice') {
      var r = HUD.handleKey(k);
      if (r) pickChoice(r.menu);
      return;
    }
    if (state === 'testimony' || state === 'invest') {
      AA.COURT.handleKey(k);
      return;
    }
  };

  VM.handleTap = function (x, y, scr) {
    if (state === 'over') { if (scr >= 0) { S.select(); VM.retry(); } return; }
    if (RC.isOpen()) { if (scr === 1) RC.handleTap(x, y); return; }
    if (HUD.logOpen()) { if (scr === 1) HUD.handleTap(x, y); return; }

    if (scr === 0) {
      // 上屏点击 = 推进对话
      if (state === 'text') nextText();
      else if (state === 'testimony' || state === 'invest') AA.COURT.handleTap(x, y, scr);
      return;
    }
    if (scr !== 1) return;

    if (state === 'text') {
      var r0 = HUD.handleTap(x, y);
      if (r0 && r0.button === 'record') { VM.openRecord('view'); return; }
      if (r0 && r0.button) return;
      if (r0 === '__log' || r0 === '__log_close') return;
      nextText();
      return;
    }
    if (state === 'choice') {
      var r = HUD.handleTap(x, y);
      if (r && r.menu !== undefined) pickChoice(r.menu);
      return;
    }
    if (state === 'testimony' || state === 'invest') { AA.COURT.handleTap(x, y, scr); return; }
    if (state === 'wait') return;
  };

  function pickChoice(i) {
    var c = pendingChoice;
    if (!c) return;
    var o = c.options[i];
    if (!o) return;
    if (o.enabled === false) { S.deny(); return; }
    HUD.setMenu(null);
    pendingChoice = null;
    if (o.flag) G.flags[o.flag] = true;
    if (o.script) { VM.callAndRun(o.script); return; }
    if (o.goto) { VM.jump(o.goto); state = 'run'; run(); return; }
    state = 'run'; run();
  }

  /** 统一的「查看法庭记录」入口：记住返回后应恢复的状态 */
  var recordReturn = 'run';
  VM.openRecord = function (mode) {
    if (RC.isOpen()) return;
    recordReturn = (state === 'record') ? recordReturn : state;
    RC.open(mode || 'view');
    state = 'record';
  };

  RC.onClose = function () {
    if (state !== 'record') return;
    state = recordReturn || 'run';
    if (state === 'run') run();
  };

  /* ---------------- 绘制 ---------------- */
  function poseFrames(who, a) {
    var talking = TB.speaking() && G.focus === who;
    var n = RIG.frames(who, a.pose);
    var f;
    if (talking) f = Math.floor((G.animT - a.since) / 0.105) % n;
    else f = Math.floor((G.animT - a.since) / 0.52) % n;
    return { f: f, talk: talking };
  }

  VM.drawActors = function (ctx) {
    var slots = SCN.slots() || {};
    var order = [], seen = Object.create(null);
    for (var role in slots) {
      var s = slots[role];
      if (!s || s[2] <= 0.02) continue;
      // talk 槽位给「当前说话者」；其余槽位按站位查人
      var who = (role === 'talk') ? G.focus : G.roles[role];
      if (!who || !RIG.has(who) || seen[who]) continue;
      seen[who] = 1;
      order.push({ who: who, s: s });
    }
    // 缩放小的（远的）先画
    order.sort(function (a, b) { return a.s[2] - b.s[2]; });
    for (var i = 0; i < order.length; i++) {
      var o = order[i], a = actor(o.who);   // 站位上的人可能尚未登记过姿势，actor() 会补上
      var pf = poseFrames(o.who, a);
      var cv = RIG.sprite(o.who, a.pose, pf.f, pf.talk);
      if (!cv) continue;
      RIG.draw(ctx, cv, { x: o.s[0], y: o.s[1], s: o.s[2] }, { alpha: a.alpha, dy: a.dy });
    }
  };

  VM.drawTop = function (ctx, dt) {
    ctx.save();
    var sx = FX.shakeX(), sy = FX.shakeY();
    if (sx || sy) ctx.translate(sx, sy);
    ctx.drawImage(SCN.bg(), 0, 0);
    FX.draw(ctx, 'bg');
    VM.drawActors(ctx);
    var fg = SCN.fg();
    if (fg) ctx.drawImage(fg, 0, 0);
    FX.draw(ctx, 'over');
    ctx.restore();

    FX.drawMemory(ctx, dt);
    if (state === 'testimony' || state === 'invest') AA.COURT.drawTop(ctx);
    TB.draw(ctx);
    FX.drawBars(ctx, dt);
    FX.draw(ctx, 'top');
    FX.drawCover(ctx);

    if (state === 'over') drawGameOver(ctx);
  };

  VM.drawBot = function (ctx, dt) {
    if (RC.isOpen()) { RC.draw(ctx); return; }
    HUD.draw(ctx);
    if (state === 'over') drawGameOverBot(ctx);
  };

  /* ---------------- Game Over ---------------- */
  var goCv = null;
  function goArt() {
    if (goCv) return goCv;
    var text = '有 罪';
    var tw = F.width(text, 'logo');
    goCv = PX.make(tw + 16, 58, function (pen, ctx) {
      F.draw(ctx, text, 8, 2, 'logo', '#ffffff');
      ctx.globalCompositeOperation = 'source-atop';
      var ramp = ['#ffd0d0', '#ff8a8a', '#e04a52', '#a82030', '#701018'];
      for (var i = 0; i < ramp.length; i++) {
        pen.use(ramp[i]);
        ctx.fillStyle = ramp[i];
        var y0 = Math.round(3 + i * 48 / ramp.length), y1 = Math.round(3 + (i + 1) * 48 / ramp.length);
        ctx.fillRect(0, y0, ctx.canvas.width, y1 - y0);
      }
      ctx.globalCompositeOperation = 'source-over';
    }, { outline: '#1a0206', outlineW: 2, alphaThreshold: 128 });
    return goCv;
  }
  function drawGameOver(ctx) {
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, W, H);
    var a = U.sat(overT / 1.0);
    ctx.save(); ctx.globalAlpha = a;
    // 血红纹理
    for (var i = 0; i < 30; i++) {
      ctx.fillStyle = 'rgba(90,10,20,.5)';
      var x = U.hash2(i, 3) * W, w = 2 + U.hash2(i, 9) * 8;
      ctx.fillRect(Math.round(x), 0, Math.round(w), H);
    }
    ctx.restore();
    if (overT > .5) {
      var g = goArt();
      var s = U.sat((overT - .5) / .6);
      ctx.save(); ctx.globalAlpha = s;
      var sc = 1 + (1 - U.ease.outCubic(s)) * .8;
      ctx.translate(128, 78); ctx.scale(sc, sc); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(g, -g.width / 2 | 0, -29);
      ctx.restore();
    }
    if (overT > 1.6) {
      F.center(ctx, '被告人被判有罪 ——', 128, 122, 'bodyS', '#e8c0c0');
      F.center(ctx, '辩护人的战斗，就此结束了。', 128, 138, 'bodyS', '#b08890');
    }
  }
  function drawGameOverBot(ctx) {
    ctx.fillStyle = '#0a0206'; ctx.fillRect(0, 0, W, H);
    if (overT > 2.0) {
      F.center(ctx, '真相不会自己浮现。', 128, 60, 'body', '#c8b0b4');
      F.center(ctx, '再试一次吧。', 128, 80, 'body', '#c8b0b4');
      HUD.drawButton(ctx, 56, 120, 144, 32, '从 上 次 继 续', 'hot', true, false);
      if (Math.sin(overT * 4) > 0) F.center(ctx, '按 空格 / 点击', 128, 160, 'tiny', '#8a6a70');
    }
  }

})(window.AA);
