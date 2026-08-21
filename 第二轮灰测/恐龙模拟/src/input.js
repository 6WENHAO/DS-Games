/* ============ 输入：键盘 + 触屏虚拟摇杆 ============ */
(function (D) {
  "use strict";
  var U = D.util;

  var I = {
    keys: {},
    axis: { x: 0, y: 0 },
    btn: { attack: false, sprint: false, act: false, roar: false, nest: false, breath: false },
    edge: {},
    touchMode: false,
    hand: "left",
    stickId: null,
    stickOx: 0, stickOy: 0,
    radius: 58,
    onTouchDetect: null,
    onPause: null
  };

  var KEYMAP = {
    KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down",
    KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right",
    KeyJ: "attack", Space: "attack", KeyZ: "attack",
    ShiftLeft: "sprint", ShiftRight: "sprint",
    KeyE: "act", KeyF: "act",
    KeyR: "roar", KeyN: "nest",
    KeyQ: "breath", Digit1: "breath"
  };

  function stop(e) { if (e.cancelable) e.preventDefault(); }

  I.press = function (name) { this.edge[name] = true; };
  I.consume = function (name) {
    if (this.edge[name]) { this.edge[name] = false; return true; }
    return false;
  };

  I.bindButton = function (el, name, tap) {
    if (!el) return;
    var self = this;
    var down = function (e) {
      stop(e);
      self.detectTouch(e);
      self.btn[name] = true;
      if (tap) self.press(name);
      el.classList.add("down");
      try { if (e.pointerId != null && el.setPointerCapture) el.setPointerCapture(e.pointerId); } catch (err) {}
    };
    var up = function (e) {
      stop(e);
      self.btn[name] = false;
      el.classList.remove("down");
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("lostpointercapture", up);
    el.addEventListener("contextmenu", stop);
  };

  I.detectTouch = function (e) {
    if (e && e.pointerType && e.pointerType !== "mouse" && !this.touchMode) {
      this.touchMode = true;
      if (this.onTouchDetect) this.onTouchDetect();
    }
  };

  I.init = function (dom) {
    var self = this;
    this.dom = dom;

    window.addEventListener("keydown", function (e) {
      var k = KEYMAP[e.code];
      if (e.code === "Escape") { if (self.onPause) self.onPause(); return; }
      if (!k) return;
      if (e.cancelable) e.preventDefault();
      if (!self.keys[k]) {
        self.press(k);
        if (k === "act" || k === "roar" || k === "nest") self.press(k);
      }
      self.keys[k] = true;
      if (self.btn[k] !== undefined) self.btn[k] = true;
    });
    window.addEventListener("keyup", function (e) {
      var k = KEYMAP[e.code];
      if (!k) return;
      self.keys[k] = false;
      if (self.btn[k] !== undefined) self.btn[k] = false;
    });
    window.addEventListener("blur", function () {
      self.keys = {};
      self.btn.attack = self.btn.sprint = self.btn.act = false;
      self.btn.roar = self.btn.nest = self.btn.breath = false;
      self.axis.x = self.axis.y = 0;
      self.stickId = null;
      if (dom.stick) dom.stick.classList.remove("on");
    });

    // 虚拟摇杆：左（或右）半屏任意位置按下
    var zone = dom.stickzone;
    if (zone) {
      var place = function (x, y) {
        self.stickOx = x; self.stickOy = y;
        if (dom.stick) {
          dom.stick.style.left = x + "px";
          dom.stick.style.top = y + "px";
          dom.stick.classList.add("on");
        }
      };
      var knob = function (dx, dy) {
        if (dom.knob) {
          dom.knob.style.transform = "translate(" + dx + "px," + dy + "px)";
        }
      };
      zone.addEventListener("pointerdown", function (e) {
        stop(e);
        self.detectTouch(e);
        if (self.stickId !== null) return;
        self.stickId = e.pointerId;
        var r = zone.getBoundingClientRect ? zone.getBoundingClientRect() : { left: 0, top: 0 };
        place(e.clientX - r.left, e.clientY - r.top);
        knob(0, 0);
        try { if (zone.setPointerCapture) zone.setPointerCapture(e.pointerId); } catch (err) {}
      });
      zone.addEventListener("pointermove", function (e) {
        if (self.stickId !== e.pointerId) return;
        stop(e);
        var r = zone.getBoundingClientRect ? zone.getBoundingClientRect() : { left: 0, top: 0 };
        var dx = (e.clientX - r.left) - self.stickOx;
        var dy = (e.clientY - r.top) - self.stickOy;
        var m = U.len(dx, dy);
        var lim = self.radius;
        if (m > lim) { dx = dx / m * lim; dy = dy / m * lim; }
        knob(dx, dy);
        self.axis.x = dx / lim;
        self.axis.y = dy / lim;
      });
      var end = function (e) {
        if (self.stickId !== e.pointerId) return;
        self.stickId = null;
        self.axis.x = 0; self.axis.y = 0;
        knob(0, 0);
        if (dom.stick) dom.stick.classList.remove("on");
      };
      zone.addEventListener("pointerup", end);
      zone.addEventListener("pointercancel", end);
      zone.addEventListener("lostpointercapture", end);
      zone.addEventListener("contextmenu", stop);
    }

    this.bindButton(dom.btnBreath, "breath", true);
    this.bindButton(dom.btnAttack, "attack", false);
    this.bindButton(dom.btnSprint, "sprint", false);
    this.bindButton(dom.btnAct, "act", true);
    this.bindButton(dom.btnRoar, "roar", true);
    this.bindButton(dom.btnNest, "nest", true);

    // 桌面端：鼠标在画布上按下也可攻击
    if (dom.canvas) {
      dom.canvas.addEventListener("pointerdown", function (e) {
        self.detectTouch(e);
        if (e.pointerType === "mouse") { self.btn.attack = true; self.press("attack"); }
      });
      window.addEventListener("pointerup", function (e) {
        if (e.pointerType === "mouse") self.btn.attack = false;
      });
      dom.canvas.addEventListener("contextmenu", stop);
    }
  };

  I.setHand = function (h) {
    this.hand = h;
    if (this.dom && this.dom.touch) {
      if (h === "right") this.dom.touch.classList.add("right");
      else this.dom.touch.classList.remove("right");
    }
  };

  // 键盘方向合成
  I.update = function () {
    if (this.stickId !== null) return;
    var x = 0, y = 0;
    if (this.keys.left) x -= 1;
    if (this.keys.right) x += 1;
    if (this.keys.up) y -= 1;
    if (this.keys.down) y += 1;
    var m = U.len(x, y);
    if (m > 1) { x /= m; y /= m; }
    this.axis.x = x; this.axis.y = y;
  };

  D.Input = I;
})(window.DINO);
