/* ============================================================
   court.js — 交叉询问（证言/逼供/举证）与调查模式
   ============================================================ */
(function (AA) {
  'use strict';
  var U = AA.U, PX = AA.PX, P = AA.PAL, F = AA.FONT, S = AA.SFX, M = AA.MUSIC;
  var SCN = AA.SCENES, RIG = AA.RIG, FX = AA.FX, TB = AA.TEXTBOX, HUD = AA.HUD, RC = AA.RECORD;
  var VM = AA.VM;
  var CT = AA.COURT = {};

  var W = 256, H = 192;

  /* ============================================================
     交叉询问
     ============================================================ */
  var T = null;          // 当前证言数据
  var stmts = [];        // 工作副本
  var idx = 0;
  var phase = 'idle';    // read | cross | busy
  var pressed = Object.create(null);
  var solved = false;
  var t = 0;

  function stmtLabel() {
    var def = RIG.get(T.who);
    return (def ? def.label : '证人');
  }

  function showStatement(instant) {
    var s = stmts[idx];
    if (!s) return;
    VM.addActor(T.who, s.pose || 'normal');
    VM.setPose(T.who, s.pose || 'normal');
    VM.G.focus = T.who;
    if (SCN.name() === 'court' && SCN.camName() !== 'witness') SCN.moveTo('witness', .3);
    TB.show(s.text, {
      label: stmtLabel(), style: 'testify',
      instant: instant, gender: (RIG.get(T.who) || {}).gender
    });
    HUD.pushLog(stmtLabel() + '（证言）', F.plain(s.text));
    crossButtons();
  }

  function crossButtons() {
    HUD.setButtons([
      { id: 'prev', label: '◀ 前', kind: 'dark', enabled: idx > 0 },
      { id: 'press', label: '逼 供', kind: 'normal' },
      { id: 'present', label: '举 证', kind: 'hot' },
      { id: 'next', label: idx < stmts.length - 1 ? '后 ▶' : '结 束', kind: 'dark' }
    ]);
    HUD.setHint('');
    HUD.setPhase('证言 ' + (idx + 1) + ' / ' + stmts.length);
  }

  CT.startTestimony = function (data) {
    T = data;
    stmts = data.statements.map(function (s) { return Object.assign({}, s); });
    idx = 0; solved = false; pressed = Object.create(null);
    phase = 'read'; t = 0;
    HUD.setTitle(data.hudTitle || undefined, '');
    if (data.bgm) M.play(data.bgm, { fadeIn: .4 });
    // 1) 引子 → 2) 朗读证言 → 3) 交叉询问
    var seq = [];
    if (data.intro) seq = seq.concat(data.intro);
    if (data.title) seq.push({ t: 'title', text: data.title });
    for (var i = 0; i < stmts.length; i++) {
      seq.push({
        t: 'fn', fn: (function (k) {
          return function () { idx = k; };
        })(i)
      });
      seq.push({
        t: 'say', who: data.who, pose: stmts[i].pose || 'normal',
        text: stmts[i].text, style: 'testify', label: stmtLabel()
      });
    }
    seq.push({
      t: 'fn', fn: function () {
        idx = 0; phase = 'cross';
        if (data.crossBgm) M.play(data.crossBgm, { fadeIn: .3 });
        FX.testimonyTitle(data.crossTitle || '交 叉 询 问', 1.3);
        showStatement(true);
        VM.setState('testimony');
      }
    });
    VM.callAndRun(seq, null);
  };

  CT.testifying = function () { return phase === 'cross'; };

  function press() {
    var s = stmts[idx];
    phase = 'busy';
    HUD.setButtons([]);
    pressed[idx] = true;
    var sub = (s.press || [{ t: 'say', who: T.who, text: '……这就是我看到的全部了。' }]).slice();
    // 逼供后追加新证言
    sub.push({
      t: 'fn', fn: function () {
        if (s.add && !s.added) {
          s.added = true;
          var ins = s.add.map(function (x) { return Object.assign({}, x); });
          stmts.splice.apply(stmts, [idx + 1, 0].concat(ins));
          S.ding();
          FX.testimonyTitle('证 言 已 追 加', 1.2);
        }
      }
    });
    sub.push({
      t: 'fn', fn: function () {
        phase = 'cross';
        VM.setState('testimony');
        showStatement(true);
      }
    });
    VM.callAndRun(sub, null);
  }

  var vmOnClose = null, presentPending = false;
  function hookClose(restore) {
    if (vmOnClose === null) vmOnClose = RC.onClose;
    presentPending = true;
    RC.onClose = function () {
      RC.onClose = vmOnClose; vmOnClose = null;
      RC.onPresent = null;
      if (presentPending) { presentPending = false; restore(); }
    };
  }
  function unhookClose() {
    presentPending = false;
    if (vmOnClose !== null) { RC.onClose = vmOnClose; vmOnClose = null; }
    RC.onPresent = null;
  }

  function openPresent() {
    phase = 'busy';
    HUD.setButtons([]);
    hookClose(function () {
      // 取消举证 → 回到交叉询问
      phase = 'cross';
      VM.setState('testimony');
      showStatement(true);
    });
    RC.open('present', { keepSel: true });
    VM.setState('record');
    RC.onPresent = function (item) {
      presentPending = false;
      RC.close();
      unhookClose();
      judgePresent(item);
    };
  }

  function judgePresent(item) {
    var s = stmts[idx];
    var rule = (s.present && s.present[item.id]) || null;
    var isCorrect = rule ? rule.correct !== false : false;
    unhookClose();
    if (rule && isCorrect) {
      phase = 'busy';
      HUD.setButtons([]);
      var sub = [
        { t: 'bubble', kind: 'takethat', who: 'naruhodo', pose: 'objection' },
        { t: 'fx', name: 'shockBg', args: [1.0] },
        { t: 'sfx', name: 'shock' }
      ].concat(rule.script || []);
      if (rule.next) {
        // 多阶段证言：证人改口，重新作证
        sub.push({
          t: 'fn', fn: function () {
            stmts = rule.next.map(function (x) { return Object.assign({}, x); });
            pressed = Object.create(null);
            idx = 0; phase = 'cross';
            if (T.crossBgm) M.play(T.crossBgm, { fadeIn: .3 });
            FX.testimonyTitle(rule.nextTitle || '新 的 证 言', 1.4);
            showStatement(true);
            VM.setState('testimony');
          }
        });
        VM.callAndRun(sub, null);
        return;
      }
      solved = true;
      sub.push({
        t: 'fn', fn: function () {
          phase = 'idle';
          HUD.setButtons([]); HUD.setPhase('');
          TB.hide();
        }
      });
      if (T.onSolved) sub = sub.concat(T.onSolved);
      VM.callAndRun(sub, null);
      return;
    }
    // 错误举证
    phase = 'busy';
    HUD.setButtons([]);
    var wrong = (rule && rule.script) || T.wrongPresent || [
      { t: 'say', who: 'mitsurugi', pose: 'smug', text: '……这算什么？这份证物和证词之间，[r]毫无矛盾[/]。' },
      { t: 'say', who: 'judge', pose: 'angry', text: '辩护人，请不要浪费法庭的时间。' }
    ];
    var sub2 = [
      { t: 'bubble', kind: 'takethat', who: 'naruhodo', pose: 'objection' }
    ].concat(wrong);
    sub2.push({ t: 'penalty', n: (rule && rule.penalty) || T.wrongPenalty || 1 });
    sub2.push({
      t: 'fn', fn: function () {
        if (VM.G.life > 0) { phase = 'cross'; VM.setState('testimony'); showStatement(true); }
      }
    });
    VM.callAndRun(sub2, null);
  }

  function move(d) {
    var n = idx + d;
    if (n < 0) { S.deny(); return; }
    if (n >= stmts.length) {
      // 走到最后 → 提示
      S.cursor();
      var hint = T.afterAll;
      if (hint) {
        phase = 'busy';
        var sub = hint.slice();
        sub.push({
          t: 'fn', fn: function () { phase = 'cross'; VM.setState('testimony'); idx = 0; showStatement(true); }
        });
        VM.callAndRun(sub, null);
      } else { idx = 0; showStatement(true); }
      return;
    }
    idx = n;
    S.cursor();
    showStatement(true);
  }

  CT.handleKey = function (k) {
    if (VM.state() === 'invest') return investKey(k);
    if (phase !== 'cross') {
      if (k === 'record') { VM.openRecord('view'); return; }
      if (k === 'confirm' && TB.isVisible()) VM.nextText();
      return;
    }
    if (k === 'left') move(-1);
    else if (k === 'right' || k === 'confirm') {
      if (TB.typing()) { TB.advance(); return; }
      move(1);
    }
    else if (k === 'up') press();
    else if (k === 'down' || k === 'objection') openPresent();
    else if (k === 'record') { VM.openRecord('view'); }
  };

  CT.handleTap = function (x, y, scr) {
    if (VM.state() === 'invest') return investTap(x, y, scr);
    if (phase !== 'cross') {
      if (scr === 0) { if (TB.isVisible()) VM.nextText(); return; }
      if (scr === 1) {
        var rr = HUD.handleTap(x, y);
        if (rr && rr.button === 'record') { VM.openRecord('view'); return; }
        if (!rr && TB.isVisible()) VM.nextText();
      }
      return;
    }
    if (scr === 0) { if (TB.typing()) TB.advance(); else move(1); return; }
    var r = HUD.handleTap(x, y);
    if (!r) return;
    if (r === '__log' || r === '__log_close') return;
    if (r.button === 'prev') move(-1);
    else if (r.button === 'next') move(1);
    else if (r.button === 'press') press();
    else if (r.button === 'present') openPresent();
    else if (r.button === 'record') { VM.openRecord('view'); }
  };

  CT.update = function (dt) { t += dt; };

  CT.drawTop = function (ctx) {
    if (phase !== 'cross') return;
    // 证言序号缎带
    var lab = '证 言　' + (idx + 1) + ' / ' + stmts.length;
    var w = F.width(lab, 'uiS') + 16;
    ctx.fillStyle = '#04120c'; ctx.fillRect(4, 4, w, 15);
    ctx.fillStyle = '#9ef0a8'; ctx.fillRect(4, 4, w, 1); ctx.fillRect(4, 18, w, 1);
    ctx.fillRect(4, 4, 1, 15); ctx.fillRect(4 + w - 1, 4, 1, 15);
    F.draw(ctx, lab, 12, 6, 'uiS', '#c8ffd4');
    // 已逼供标记
    for (var i = 0; i < stmts.length && i < 12; i++) {
      var x = 4 + i * 8, yy = 22;
      ctx.fillStyle = i === idx ? '#ffd964' : (pressed[i] ? '#4aa860' : '#2a3550');
      ctx.fillRect(x, yy, 6, 3);
    }
    // 左右提示箭头
    if (Math.sin(t * 5) > 0) {
      RC.arrow(ctx, 10, 100, -1, idx > 0);
      RC.arrow(ctx, 246, 100, 1, true);
    }
  };

  /* ============================================================
     调查模式
     ============================================================ */
  var IV = null, iphase = 'root', ilist = null, ititle = '';

  CT.startInvest = function (data) {
    IV = data;
    iphase = 'root';
    HUD.setTitle(data.title || '', '');
    HUD.showLife(false);
    if (data.location) SCN.load(data.location, data.cam || (SCN.hasCam('main') ? 'main' : undefined));
    if (data.bgm) M.play(data.bgm, { fadeIn: .5 });
    VM.clearActors();
    if (data.actors) for (var i = 0; i < data.actors.length; i++) VM.addActor(data.actors[i]);
    TB.hide();
    rootMenu();
  };

  function count(list) {
    if (!list) return 0;
    var n = 0;
    for (var i = 0; i < list.length; i++) if (!list[i].flag || !VM.G.flags[list[i].flag]) n++;
    return n;
  }

  function rootMenu() {
    iphase = 'root';
    HUD.setMenu(null);
    var btns = [];
    btns.push({ id: 'examine', label: '调 查', kind: 'normal', enabled: !!(IV.examine && IV.examine.length) });
    btns.push({ id: 'talk', label: '对 话', kind: 'normal', enabled: !!(IV.talk && IV.talk.length), sub: count(IV.talk) ? '还有 ' + count(IV.talk) : '' });
    if (IV.present) btns.push({ id: 'present', label: '出 示', kind: 'gold' });
    btns.push({ id: 'move', label: '移 动', kind: 'dark', enabled: !!(IV.move && IV.move.length) });
    HUD.setButtons(btns);
    HUD.setHint(IV.hint || '选择要进行的行动');
    HUD.setPhase('');
    if (IV.cam && SCN.camName() !== IV.cam) SCN.moveTo(IV.cam, .5);
  }

  function subMenu(kind) {
    iphase = kind;
    var src = IV[kind] || [];
    ilist = src.filter(function (e) { return !e.hide || !VM.G.flags[e.hide]; });
    ititle = kind === 'examine' ? '要调查哪里？' : (kind === 'talk' ? '要问些什么？' : '前往何处？');
    HUD.setMenu(ilist.map(function (e) {
      var en = e.enabled;
      if (typeof en === 'function') en = en(VM.G);
      return { label: e.name, done: e.flag ? !!VM.G.flags[e.flag] : false, enabled: en === undefined ? true : !!en };
    }), { title: ititle });
    HUD.setButtons([{ id: 'back', label: '返 回', kind: 'dark' }]);
    HUD.setHint('');
  }

  function runEntry(e) {
    iphase = 'busy';
    HUD.setMenu(null);
    HUD.setButtons([]);
    var sub = [];
    if (e.cam) sub.push({ t: 'cam', name: e.cam, dur: .55 });
    sub = sub.concat(e.script || []);
    if (e.flag) sub.push({ t: 'set', flag: e.flag });
    sub.push({
      t: 'fn', fn: function () {
        TB.hide();
        VM.setState('invest');
        if (e.exit) { return; }
        rootMenu();
      }
    });
    VM.callAndRun(sub, null);
  }

  function doMove(e) {
    iphase = 'busy';
    HUD.setMenu(null); HUD.setButtons([]);
    var sub = [{ t: 'fade', dur: .35 }];
    if (e.script) sub = sub.concat(e.script);
    sub.push({
      t: 'fn', fn: function () {
        HUD.showLife(true);
        IV = null;
        VM.setState('run');
      }
    });
    if (e.to) sub.push({ t: 'goto', label: e.to });
    VM.callAndRun(sub, null);
  }

  function investPresent() {
    iphase = 'busy';
    HUD.setButtons([]);
    hookClose(function () { VM.setState('invest'); rootMenu(); });
    RC.open('present', { keepSel: true });
    VM.setState('record');
    RC.onPresent = function (item) {
      presentPending = false;
      RC.close();
      unhookClose();
      var rule = IV.present && IV.present[item.id];
      var sub = (rule ? rule.script : null) || IV.presentWrong || [
        { t: 'say', who: 'naruhodo', pose: 'sweat', text: '（现在出示这个……好像没什么意义。）', style: 'thought' }
      ];
      sub = sub.slice();
      if (rule && rule.flag) sub.push({ t: 'set', flag: rule.flag });
      sub.push({
        t: 'fn', fn: function () { TB.hide(); VM.setState('invest'); rootMenu(); }
      });
      VM.callAndRun(sub, null);
    };
  }

  function investKey(k) {
    if (iphase === 'busy') { if (k === 'confirm') VM.nextText(); return; }
    if (iphase === 'root') {
      if (k === 'record') { VM.openRecord('view'); return; }
      // 键盘：用左右选择按钮
      var br = HUD.buttonRects();
      if (k === 'confirm') { pickRoot(br[HUD.state.rootSel || 0]); return; }
      if (k === 'left' || k === 'right') {
        var n = br.length;
        HUD.state.rootSel = U.mod((HUD.state.rootSel || 0) + (k === 'right' ? 1 : -1), n);
        S.cursor();
        return;
      }
      return;
    }
    var r = HUD.handleKey(k);
    if (r && r.menu !== undefined) { pickSub(r.menu); return; }
    if (k === 'cancel') { S.cancel(); rootMenu(); }
  }

  function pickRoot(rect) {
    if (!rect) return;
    var id = rect.b.id;
    if (rect.b.enabled === false) { S.deny(); return; }
    S.select();
    if (id === 'examine' || id === 'talk' || id === 'move') subMenu(id);
    else if (id === 'present') investPresent();
  }

  function pickSub(i) {
    var e = ilist[i];
    if (!e) return;
    var en = e.enabled;
    if (typeof en === 'function') en = en(VM.G);
    if (en === false) { S.deny(); return; }
    if (iphase === 'move') doMove(e);
    else runEntry(e);
  }

  function investTap(x, y, scr) {
    if (iphase === 'busy') { if (scr === 0) VM.nextText(); return; }
    if (scr !== 1) return;
    var r = HUD.handleTap(x, y);
    if (!r) return;
    if (r === '__log' || r === '__log_close') return;
    if (r.menu !== undefined) { pickSub(r.menu); return; }
    if (r.button === 'back') { S.cancel(); rootMenu(); return; }
    if (r.button) {
      var br = HUD.buttonRects();
      for (var i = 0; i < br.length; i++) if (br[i].b.id === r.button) { HUD.state.rootSel = i; pickRoot(br[i]); return; }
    }
  }

  CT.exitInvest = function () { IV = null; HUD.showLife(true); };

  /** 中断当前证言 / 调查（重来时调用） */
  CT.abort = function () {
    phase = 'idle'; iphase = 'root';
    T = null; stmts = []; idx = 0; solved = false;
    pressed = Object.create(null);
    IV = null; ilist = null;
    unhookClose();
    if (RC.isOpen()) RC.close();
    HUD.setPhase('');
  };

})(window.AA);
