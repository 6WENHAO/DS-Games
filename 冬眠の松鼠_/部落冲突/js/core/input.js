/* ============ 输入（指针：平移/缩放/点击/拖拽） ============ */
COC.Input = (function () {
  'use strict';

  var canvas = null;
  var handlers = { tap: [], dragStart: [], dragMove: [], dragEnd: [], move: [] };
  var pointers = {};       // pointerId -> {x,y,sx,sy}
  var pCount = 0;
  var panning = false;
  var pinchDist = 0;
  var downX = 0, downY = 0, downT = 0;
  var moved = false;
  var dragging = false;    // 业务层拖拽（如移动建筑）
  var dragConsumer = null;

  var TAP_PX = 9, TAP_MS = 400;

  function init(cv) {
    canvas = cv;
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  function ptrs() {
    var arr = [];
    for (var id in pointers) arr.push(pointers[id]);
    return arr;
  }

  function onDown(e) {
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    pCount++;
    if (pCount === 1) {
      downX = e.clientX; downY = e.clientY; downT = performance.now();
      moved = false;
      /* 询问业务层是否要开始拖拽（例如按在选中的建筑上） */
      dragging = false;
      for (var i = 0; i < handlers.dragStart.length; i++) {
        if (handlers.dragStart[i](e.clientX, e.clientY)) { dragging = true; break; }
      }
      if (!dragging) panning = true;
    } else if (pCount === 2) {
      panning = false;
      var p = ptrs();
      pinchDist = COC.U.dist(p[0].x, p[0].y, p[1].x, p[1].y);
    }
  }

  function onMove(e) {
    var p = pointers[e.pointerId];
    emitAll('move', e.clientX, e.clientY);
    if (!p) return;
    var dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;

    if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > TAP_PX) moved = true;

    if (pCount === 1) {
      if (dragging) {
        emitAll('dragMove', e.clientX, e.clientY);
      } else if (panning) {
        COC.Camera.pan(dx, dy);
      }
    } else if (pCount === 2) {
      var arr = ptrs();
      if (arr.length >= 2) {
        var nd = COC.U.dist(arr[0].x, arr[0].y, arr[1].x, arr[1].y);
        var cx = (arr[0].x + arr[1].x) / 2, cy = (arr[0].y + arr[1].y) / 2;
        if (pinchDist > 0) COC.Camera.zoomAt(cx, cy, nd / pinchDist);
        pinchDist = nd;
      }
    }
  }

  function onUp(e) {
    if (!pointers[e.pointerId]) return;
    delete pointers[e.pointerId];
    pCount = Math.max(0, pCount - 1);
    if (pCount < 2) pinchDist = 0;
    if (pCount === 0) {
      if (dragging) {
        emitAll('dragEnd', e.clientX, e.clientY);
        dragging = false;
      } else if (!moved && performance.now() - downT < TAP_MS) {
        emitAll('tap', e.clientX, e.clientY);
      }
      panning = false;
    }
  }

  function onWheel(e) {
    e.preventDefault();
    var factor = e.deltaY < 0 ? 1.12 : 0.89;
    COC.Camera.zoomAt(e.clientX, e.clientY, factor);
  }

  function emitAll(ev, x, y) {
    for (var i = 0; i < handlers[ev].length; i++) handlers[ev][i](x, y);
  }

  function on(ev, fn) { handlers[ev].push(fn); }

  return { init: init, on: on };
})();
