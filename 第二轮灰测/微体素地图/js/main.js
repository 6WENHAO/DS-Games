/* =====================================================================
   微体素地图 · 引导
   ===================================================================== */
(function (root) {
  'use strict';
  var VX = root.VX;
  root.__errors = root.__errors || [];
  root.addEventListener('error', function (e) {
    root.__errors.push(String(e.message || e));
    var ov = document.getElementById('overlay');
    if (ov && ov.style.display !== 'none') {
      document.getElementById('ovNote').innerHTML =
        '<span style="color:#ff7a7a">运行出错：' + String(e.message || e) + '</span>';
    }
  });

  function App() {
    this.canvas = document.getElementById('gl');
    this.autoTime = false;
    this.data = null;
    this.cam = null;
    this.rnd = null;
  }

  App.prototype.setTime = function (t) { this.rnd.time = t; };

  App.prototype.boot = function () {
    var self = this;
    var bar = document.getElementById('ovBar');
    var note = document.getElementById('ovNote');
    var pct = document.getElementById('ovPct');

    function report(text, p) {
      note.textContent = text;
      bar.style.width = (p * 100).toFixed(1) + '%';
      pct.textContent = (p * 100).toFixed(0) + '%';
    }

    var gen = VX.buildAll(report);
    var t0 = performance.now();

    function step() {
      var budget = performance.now() + 26;
      var r;
      try {
        do { r = gen.next(); } while (!r.done && performance.now() < budget);
      } catch (e) {
        console.error(e);
        note.innerHTML = '<span style="color:#ff7a7a">构建失败：' + e.message + '</span>';
        root.__errors.push('build: ' + e.message);
        return;
      }
      if (r.done) { self.data = r.value; self.start(); return; }
      requestAnimationFrame(step);
    }
    report('初始化…', 0);
    requestAnimationFrame(step);
    this._t0 = t0;
  };

  App.prototype.start = function () {
    var self = this;
    try {
      this.rnd = new VX.Renderer(this.canvas);
    } catch (e) {
      document.getElementById('ovNote').innerHTML =
        '<span style="color:#ff7a7a">' + e.message + '</span>';
      root.__errors.push('gl: ' + e.message);
      return;
    }
    this.rnd.resize();
    this.rnd.upload(this.data);
    this.cam = new VX.Camera(this.canvas);
    var v = VX.LAY.views[0];
    this.cam.target = v.target.slice();
    this.cam._t.target = v.target.slice();
    this.cam.dist = this.cam._t.dist = v.dist;
    this.cam.yaw = this.cam._t.yaw = v.yaw;
    this.cam.pitch = this.cam._t.pitch = v.pitch;
    this.ui = new VX.UI(this);

    document.getElementById('overlay').classList.add('gone');
    setTimeout(function () { document.getElementById('overlay').style.display = 'none'; }, 700);

    var last = performance.now(), fps = 60, acc = 0, frames = 0;
    function loop(now) {
      var dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      acc += dt; frames++;
      if (acc > 0.4) { fps = frames / acc; acc = 0; frames = 0; }
      if (self.autoTime) {
        self.rnd.time = (self.rnd.time + dt * 0.012) % 1;
        document.getElementById('timeSlider').value = String(Math.round(self.rnd.time * 1000));
      }
      self.cam.update(dt);
      self.rnd.render(self.cam, dt);
      self.ui.updateLabels(self.cam);
      self.ui.updateMinimap(self.cam);
      if (frames === 0) { self.ui.updateStats(self, fps); }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    /* ---- 无头截图/自动化钩子 ---- */
    root.__debug = {
      ready: true,
      info: this.data.info,
      stats: function () {
        return { drawn: self.rnd.stats.drawn, faces: self.data.info.faces,
          quads: self.data.info.terrainQuads, lights: self.data.info.lights,
          voxels: self.data.info.voxels, labels: self.data.info.labels,
          buildMs: self.data.info.ms, errors: root.__errors.length };
      },
      setTime: function (t) { self.rnd.time = t; },
      setView: function (id) {
        var vs = VX.LAY.views, k;
        for (k = 0; k < vs.length; k++) if (vs[k].id === id) {
          self.cam.anim = null;
          self.cam.target = vs[k].target.slice();
          self.cam._t.target = vs[k].target.slice();
          self.cam.dist = self.cam._t.dist = vs[k].dist;
          self.cam.yaw = self.cam._t.yaw = vs[k].yaw;
          self.cam.pitch = self.cam._t.pitch = vs[k].pitch;
          return true;
        }
        return false;
      },
      setPos: function (tx, ty, tz, dist, yaw, pitch) {
        self.cam.anim = null;
        self.cam.target = [tx, ty, tz]; self.cam._t.target = [tx, ty, tz];
        self.cam.dist = self.cam._t.dist = dist;
        self.cam.yaw = self.cam._t.yaw = yaw;
        self.cam.pitch = self.cam._t.pitch = pitch;
      },
      hideUI: function () {
        document.getElementById('hud').style.display = 'none';
        document.getElementById('labels').style.display = 'none';
      },
      showUI: function () {
        document.getElementById('hud').style.display = '';
        document.getElementById('labels').style.display = '';
      },
      labels: function () {
        return self.data.world.labels.map(function (L) { return L.kind + '|' + L.text; });
      }
    };
  };

  root.addEventListener('DOMContentLoaded', function () { new App().boot(); });
})(window);
