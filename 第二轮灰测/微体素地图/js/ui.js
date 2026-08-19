/* =====================================================================
   微体素地图 · 界面层（视角预设 / 晨昏时段 / 显示选项 / 标签 / 小地图）
   ===================================================================== */
(function (root) {
  'use strict';
  var VX = root.VX, M = VX.M, LAY = VX.LAY;

  function el(id) { return document.getElementById(id); }
  function mk(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function UI(app) {
    this.app = app;
    this.labelEls = [];
    this.showLabels = true;
    this.labelTier = 2;
    this._pv = [0, 0, 0];
    this.build();
  }
  var U = UI.prototype;

  U.build = function () {
    var self = this, app = this.app, i;

    /* -------- 视角预设 -------- */
    var vb = el('viewBtns');
    var views = LAY.views;
    for (i = 0; i < views.length; i++) {
      (function (v, idx) {
        var b = mk('button', idx === 0 ? 'on' : '', v.name);
        b.onclick = function () {
          var all = vb.querySelectorAll('button');
          for (var k = 0; k < all.length; k++) all[k].classList.remove('on');
          b.classList.add('on');
          app.cam.flyTo({ target: v.target.slice(), dist: v.dist, yaw: v.yaw, pitch: v.pitch }, 1100);
        };
        vb.appendChild(b);
      })(views[i], i);
    }

    /* -------- 时段 -------- */
    var tb = el('timeBtns');
    var presets = [['黎明', 0.16], ['晨光', 0.32], ['正午', 0.50], ['黄昏', 0.68], ['暮色', 0.84], ['夜幕', 0.98]];
    for (i = 0; i < presets.length; i++) {
      (function (p) {
        var b = mk('button', Math.abs(p[1] - 0.68) < 0.01 ? 'on' : '', p[0]);
        b.onclick = function () {
          var all = tb.querySelectorAll('button');
          for (var k = 0; k < all.length; k++) all[k].classList.remove('on');
          b.classList.add('on');
          app.setTime(p[1]);
          el('timeSlider').value = String(Math.round(p[1] * 1000));
        };
        tb.appendChild(b);
      })(presets[i]);
    }
    var ts = el('timeSlider');
    ts.value = String(Math.round(app.rnd.time * 1000));
    ts.oninput = function () {
      app.setTime(parseInt(ts.value, 10) / 1000);
      var all = tb.querySelectorAll('button');
      for (var k = 0; k < all.length; k++) all[k].classList.remove('on');
    };
    el('autoTime').onchange = function () { app.autoTime = this.checked; };

    /* -------- 显示选项 -------- */
    function slider(id, key, scale) {
      var s = el(id);
      s.oninput = function () { app.rnd.opts[key] = parseInt(s.value, 10) / scale; };
    }
    slider('sBloom', 'bloom', 100);
    slider('sFog', 'fog', 100);
    slider('sNeon', 'neon', 100);
    slider('sVig', 'vignette', 100);
    slider('sSat', 'sat', 100);
    el('cGlass').onchange = function () { app.rnd.opts.glass = this.checked; };
    el('cWater').onchange = function () { app.rnd.opts.water = this.checked; };
    el('cLabels').onchange = function () { self.showLabels = this.checked; self.syncLabels(); };
    el('cGrain').onchange = function () { app.rnd.opts.grain = this.checked ? 0.020 : 0; };
    el('labelTier').onchange = function () { self.labelTier = parseInt(this.value, 10); self.syncLabels(); };

    el('btnShot').onclick = function () {
      app.rnd.render(app.cam, 0);
      var url = app.canvas.toDataURL('image/png');
      var a = document.createElement('a');
      a.href = url; a.download = '微体素地图-' + Date.now() + '.png';
      a.click();
    };
    el('btnPanel').onclick = function () {
      var p = el('panel');
      p.classList.toggle('hide');
      el('btnPanel').textContent = p.classList.contains('hide') ? '‹ 面板' : '面板 ›';
    };

    /* -------- 标签 -------- */
    this.buildLabels();
    /* -------- 小地图 -------- */
    this.buildMinimap();
  };

  U.buildLabels = function () {
    var host = el('labels'), labels = this.app.data.world.labels, i;
    host.innerHTML = '';
    this.labelEls = [];
    for (i = 0; i < labels.length; i++) {
      var L = labels[i];
      var e = mk('div', 'lbl ' + L.kind);
      e.innerHTML = '<b>' + L.text + '</b>' + (L.sub ? '<i>' + L.sub + '</i>' : '');
      host.appendChild(e);
      this.labelEls.push({ e: e, L: L, on: false });
    }
    this.syncLabels();
  };

  U.syncLabels = function () {
    for (var i = 0; i < this.labelEls.length; i++) {
      var it = this.labelEls[i];
      var tier = it.L.kind === 'site' ? 0 : (it.L.kind === 'poi' ? 1 : 2);
      it.allowed = this.showLabels && tier <= this.labelTier;
      if (!it.allowed) it.e.style.display = 'none';
    }
  };

  U.updateLabels = function (cam) {
    if (!this.showLabels) return;
    var p = this._pv, i;
    for (i = 0; i < this.labelEls.length; i++) {
      var it = this.labelEls[i];
      if (!it.allowed) continue;
      var ok = cam.project(it.L.x, it.L.y, it.L.z, p);
      var maxD = it.L.kind === 'site' ? 2400 : (it.L.kind === 'poi' ? 620 : 240);
      if (!ok || p[2] > maxD || p[0] < -120 || p[1] < -40 ||
          p[0] > cam.canvas.clientWidth + 120 || p[1] > cam.canvas.clientHeight + 40) {
        if (it.on) { it.e.style.display = 'none'; it.on = false; }
        continue;
      }
      it.e.style.transform = 'translate(-50%,-100%) translate(' + p[0].toFixed(1) + 'px,' + p[1].toFixed(1) + 'px)';
      var fade = M.clamp(1 - (p[2] / maxD) * 0.85, 0.18, 1);
      it.e.style.opacity = fade.toFixed(2);
      if (!it.on) { it.e.style.display = 'block'; it.on = true; }
    }
  };

  U.buildMinimap = function () {
    var cv = el('minimap');
    var W = 200, S = VX.SX / W;
    cv.width = W; cv.height = W;
    var ctx = cv.getContext('2d');
    var alb = this.app.data.terrain.albedo, sun = this.app.data.terrain.sun;
    var sunW = this.app.data.terrain.sunW || VX.SX;
    var sunH = this.app.data.terrain.sunH || VX.SZ;
    var img = ctx.createImageData(W, W);
    for (var py = 0; py < W; py++) {
      for (var px = 0; px < W; px++) {
        var sx = (px * S) | 0, sz = (py * S) | 0;
        var si = sz * VX.SX + sx, o = (py * W + px) * 4;
        var sui = Math.min(sunH - 1, (sz * sunH / VX.SZ) | 0) * sunW + Math.min(sunW - 1, (sx * sunW / VX.SX) | 0);
        var a = alb[si * 4 + 3];
        if (a === 0 && alb[si * 4] === 0 && alb[si * 4 + 1] === 0) {
          img.data[o] = 8; img.data[o + 1] = 10; img.data[o + 2] = 16; img.data[o + 3] = 255;
        } else {
          var k = 0.45 + 0.55 * (sun[sui] / 255);
          img.data[o] = alb[si * 4] * k;
          img.data[o + 1] = alb[si * 4 + 1] * k;
          img.data[o + 2] = alb[si * 4 + 2] * k;
          img.data[o + 3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    this.mmBase = ctx.getImageData(0, 0, W, W);
    this.mmCtx = ctx; this.mmW = W; this.mmS = S;

    var self = this;
    cv.onclick = function (e) {
      var r = cv.getBoundingClientRect();
      var wx = (e.clientX - r.left) / r.width * VX.SX;
      var wz = (e.clientY - r.top) / r.height * VX.SZ;
      self.app.cam.flyTo({ target: [wx, 30, wz], dist: Math.min(self.app.cam.dist, 380) }, 800);
    };
  };

  U.updateMinimap = function (cam) {
    if (!this.mmCtx) return;
    var ctx = this.mmCtx, W = this.mmW, S = this.mmS;
    ctx.putImageData(this.mmBase, 0, 0);
    var tx = cam.target[0] / S, tz = cam.target[2] / S;
    var ex = cam.eye[0] / S, ez = cam.eye[2] / S;
    ctx.strokeStyle = 'rgba(120,240,255,.85)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(ex, ez); ctx.lineTo(tx, tz); ctx.stroke();
    ctx.fillStyle = '#5af6ff';
    ctx.beginPath(); ctx.arc(tx, tz, 3.2, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,120,200,.8)';
    ctx.beginPath(); ctx.arc(ex, ez, 2.2, 0, 7); ctx.stroke();
  };

  U.updateStats = function (app, fps) {
    var info = app.data.info, r = app.rnd;
    var tp = VX.sampleTime(r.time);
    el('stats').innerHTML =
      '<div><span>时段</span><b>' + tp.name + ' · ' + (r.time * 24).toFixed(1) + 'h</b></div>' +
      '<div><span>帧率</span><b>' + fps.toFixed(0) + ' FPS</b></div>' +
      '<div><span>体素</span><b>' + info.voxels.toLocaleString() + '</b></div>' +
      '<div><span>体素面</span><b>' + info.faces.toLocaleString() + '</b></div>' +
      '<div><span>地形面</span><b>' + info.terrainQuads.toLocaleString() + '</b></div>' +
      '<div><span>光源</span><b>' + info.lights.toLocaleString() + '</b></div>' +
      '<div><span>本帧批次</span><b>' + r.stats.drawn + ' / ' + info.sectors + '</b></div>' +
      '<div><span>相机</span><b>' + app.cam.target.map(function (v) { return v.toFixed(0); }).join(', ') +
      ' · d' + app.cam.dist.toFixed(0) + '</b></div>';
  };

  VX.UI = UI;
})(window);
