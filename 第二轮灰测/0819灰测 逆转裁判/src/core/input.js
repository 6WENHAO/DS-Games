/* ============================================================
   input.js — 键盘 / 指针输入（映射到双屏坐标）
   ============================================================ */
(function (AA) {
  'use strict';
  var U = AA.U;
  var IN = AA.INPUT = {};

  var MAP = {
    confirm: [' ', 'Enter', 'z', 'Z'],
    cancel: ['x', 'X', 'Escape', 'Backspace'],
    up: ['ArrowUp', 'w', 'W'],
    down: ['ArrowDown', 's', 'S'],
    left: ['ArrowLeft', 'a', 'A'],
    right: ['ArrowRight', 'd', 'D'],
    objection: ['o', 'O'],
    record: ['c', 'C'],
    skip: ['Control'],
    log: ['l'],
    pause: ['p', 'P']
  };
  var keyToAct = {};
  for (var act in MAP) for (var i = 0; i < MAP[act].length; i++) keyToAct[MAP[act][i]] = act;

  var down = Object.create(null);
  var queue = [];
  var repeatTimer = Object.create(null);

  IN.keyDown = function (a) { return !!down[a]; };
  IN.anyDown = function () { for (var k in down) if (down[k]) return true; return false; };
  IN.skipping = function () { return !!down.skip; };

  IN.consume = function (a) {
    for (var i = 0; i < queue.length; i++) {
      if (queue[i] === a) { queue.splice(i, 1); return true; }
    }
    return false;
  };
  IN.injectKey = function (a) { queue.push(a); };
  IN.consumeAny = function () { return queue.length ? queue.shift() : null; };
  IN.peek = function () { return queue.length ? queue[0] : null; };
  IN.clearQueue = function () { queue.length = 0; };

  window.addEventListener('keydown', function (e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    var a = keyToAct[e.key];
    if (e.key === 'Control') a = 'skip';
    if (!a) return;
    e.preventDefault();
    if (!down[a]) queue.push(a);
    down[a] = true;
    // 方向键长按重复
    if (a === 'up' || a === 'down' || a === 'left' || a === 'right') {
      clearTimeout(repeatTimer[a]);
      (function rep(delay) {
        repeatTimer[a] = setTimeout(function () {
          if (down[a]) { queue.push(a); rep(85); }
        }, delay);
      })(330);
    }
  }, { passive: false });

  window.addEventListener('keyup', function (e) {
    var a = keyToAct[e.key];
    if (e.key === 'Control') a = 'skip';
    if (!a) return;
    down[a] = false;
    clearTimeout(repeatTimer[a]);
  });
  window.addEventListener('blur', function () {
    for (var k in down) down[k] = false;
    queue.length = 0;
  });

  /* ---------------- 指针 ---------------- */
  IN.pointer = { x: -999, y: -999, scr: -1, down: false, moved: false, inside: false };
  var taps = [];
  var releases = [];
  IN.consumeTap = function () { return taps.length ? taps.shift() : null; };
  IN.consumeRelease = function () { return releases.length ? releases.shift() : null; };
  IN.clearTaps = function () { taps.length = 0; releases.length = 0; };
  IN.hover = function () { return IN.pointer.inside ? IN.pointer : null; };

  var mapFn = null;
  IN.setMapper = function (fn) { mapFn = fn; };

  function locate(e, el) {
    var r = el.getBoundingClientRect();
    var px = (e.clientX - r.left) / r.width;
    var py = (e.clientY - r.top) / r.height;
    if (!mapFn) return null;
    return mapFn(px, py);
  }

  IN.attach = function (el) {
    function onDown(e) {
      if (e.button === 2) { queue.push('cancel'); return; }
      var p = locate(e, el);
      IN.pointer.down = true; IN.pointer.moved = false;
      if (p) {
        IN.pointer.x = p.x; IN.pointer.y = p.y; IN.pointer.scr = p.scr; IN.pointer.inside = true;
        taps.push({ x: p.x, y: p.y, scr: p.scr });
      } else IN.pointer.inside = false;
      el.setPointerCapture && e.pointerId != null && el.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
    function onMove(e) {
      var p = locate(e, el);
      if (p) {
        if (IN.pointer.down && (Math.abs(p.x - IN.pointer.x) > 2 || Math.abs(p.y - IN.pointer.y) > 2)) IN.pointer.moved = true;
        IN.pointer.x = p.x; IN.pointer.y = p.y; IN.pointer.scr = p.scr; IN.pointer.inside = true;
      } else { IN.pointer.inside = false; IN.pointer.scr = -1; }
    }
    function onUp(e) {
      var p = locate(e, el);
      if (p) releases.push({ x: p.x, y: p.y, scr: p.scr, moved: IN.pointer.moved });
      IN.pointer.down = false;
    }
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    el.addEventListener('pointerleave', function () { IN.pointer.inside = false; IN.pointer.scr = -1; });
  };

})(window.AA);
