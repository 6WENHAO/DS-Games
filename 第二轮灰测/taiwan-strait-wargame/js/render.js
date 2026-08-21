/* ============================================================================
 * render.js — 战场可视化渲染器 (Canvas Battlefield Renderer)
 * ----------------------------------------------------------------------------
 * 图层: 栅格瓦片高清底图(卫星/海图/地形) → 水深与作战区 → 真实矢量海岸线
 *        → 设施 → 射程包线 → 情报航迹 → 装备矢量建模 → 飞行体与弹道
 *        → 毁伤特效 → HUD
 * 装备建模: 按平台真实长度/舰型/机型逐类绘制俯视轮廓（非通用圆点）
 * ==========================================================================*/
(function (root) {
  'use strict';
  var TWG = root.TWG = root.TWG || {};
  var TAU = Math.PI * 2, D2R = Math.PI / 180;

  /* ======================= 投影 (Web Mercator) ========================= */
  function lon2x(lon) { return (lon + 180) / 360; }
  function lat2y(lat) {
    var s = Math.sin(lat * D2R);
    return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
  }
  function x2lon(x) { return x * 360 - 180; }
  function y2lat(y) {
    var n = Math.PI * (1 - 2 * y);
    return Math.atan(Math.sinh(n)) / D2R;
  }

  /* ======================= GCJ-02 偏移 (高德/腾讯底图) ================== */
  var GCJ_A = 6378245.0, GCJ_EE = 0.00669342162296594323;
  function outOfChina(lat, lon) { return !(lon > 73.66 && lon < 135.05 && lat > 3.86 && lat < 53.55); }
  function tLat(x, y) {
    var r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    r += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
    r += (20 * Math.sin(y * Math.PI) + 40 * Math.sin(y / 3 * Math.PI)) * 2 / 3;
    r += (160 * Math.sin(y / 12 * Math.PI) + 320 * Math.sin(y * Math.PI / 30)) * 2 / 3;
    return r;
  }
  function tLon(x, y) {
    var r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    r += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
    r += (20 * Math.sin(x * Math.PI) + 40 * Math.sin(x / 3 * Math.PI)) * 2 / 3;
    r += (150 * Math.sin(x / 12 * Math.PI) + 300 * Math.sin(x / 30 * Math.PI)) * 2 / 3;
    return r;
  }
  function wgs2gcj(lat, lon) {
    if (outOfChina(lat, lon)) return [lat, lon];
    var dLat = tLat(lon - 105, lat - 35), dLon = tLon(lon - 105, lat - 35);
    var rl = lat / 180 * Math.PI, m = Math.sin(rl); m = 1 - GCJ_EE * m * m;
    var sm = Math.sqrt(m);
    dLat = (dLat * 180) / ((GCJ_A * (1 - GCJ_EE)) / (m * sm) * Math.PI);
    dLon = (dLon * 180) / (GCJ_A / sm * Math.cos(rl) * Math.PI);
    return [lat + dLat, lon + dLon];
  }
  function gcj2wgs(lat, lon) {
    if (outOfChina(lat, lon)) return [lat, lon];
    var g = wgs2gcj(lat, lon);
    return [lat * 2 - g[0], lon * 2 - g[1]];
  }

  /* ======================= 底图源 ====================================== */
  var SOURCES = {
    esriSat: { name: '卫星影像 (ESRI World Imagery)', max: 17,
      url: function (z, x, y) { return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/' + z + '/' + y + '/' + x; } },
    esriOcean: { name: '海图/水深 (ESRI Ocean Base)', max: 13,
      url: function (z, x, y) { return 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/' + z + '/' + y + '/' + x; } },
    esriTerrain: { name: '地形晕渲 (ESRI Terrain)', max: 13,
      url: function (z, x, y) { return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/' + z + '/' + y + '/' + x; } },
    gaodeSat: { name: '高德卫星 (GCJ-02 已纠偏)', max: 18, gcj: 1,
      url: function (z, x, y) { return 'https://webst0' + (1 + (x + y) % 4) + '.is.autonavi.com/appmaptile?style=6&x=' + x + '&y=' + y + '&z=' + z; } },
    gaodeVec: { name: '高德矢量路网 (GCJ-02 已纠偏)', max: 18, gcj: 1,
      url: function (z, x, y) { return 'https://webrd0' + (1 + (x + y) % 4) + '.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x=' + x + '&y=' + y + '&z=' + z; } },
    osm: { name: 'OpenStreetMap', max: 18,
      url: function (z, x, y) { return 'https://tile.openstreetmap.org/' + z + '/' + x + '/' + y + '.png'; } },
    none: { name: '纯矢量离线底图', max: 18, offline: 1, url: null }
  };

  /* ======================= 配色 ======================================== */
  var COL = {
    PLA: '#ff4d4f', PLAd: '#a8071a', PLAf: 'rgba(255,77,79,0.16)',
    ROC: '#40a9ff', ROCd: '#0050b3', ROCf: 'rgba(64,169,255,0.16)',
    US: '#b37feb', USd: '#531dab', JP: '#d9d9d9', JPd: '#8c8c8c',
    land: '#1d2b26', landHi: '#243a31', coast: '#5fd3a3', border: 'rgba(120,200,170,0.30)',
    sea: '#050d16', seaDeep: '#03060d', shallow: 'rgba(30,90,120,0.35)',
    grid: 'rgba(90,160,190,0.10)', median: '#ffd666',
    text: '#d8e6e2', dim: 'rgba(200,220,215,0.55)'
  };
  function sideCol(s, dark) { return COL[s + (dark ? 'd' : '')] || (dark ? '#666' : '#aaa'); }

  /* ======================= 渲染器 ====================================== */
  function Renderer(canvas, engine, opts) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.E = engine;
    this.opts = Object.assign({
      source: 'esriSat', tileOpacity: 0.72, tint: 1, modelScale: 'exagg',
      showRange: true, showTracks: true, showLabels: true, showZones: true,
      showTrails: true, showGrid: true, showBeach: true, showNames: 1,
      unitStyle: '3d', quality: 'mid', bakeBudget: 1, glow: true
    }, opts || {});
    this.center = { lat: 23.9, lon: 120.6 };
    this.zoom = 7.2;
    this.tiles = new Map();
    this.tileQueue = [];
    this.loading = 0;
    this.effects = [];
    this.trails = new Map();
    this.selected = null;
    this.hover = null;
    this.dpr = Math.min(root.devicePixelRatio || 1, 2);
    this.initBank();
    this.resize();
  }

  /* 三维精灵库：可用则启用三维实体呈现，否则自动回退二维矢量 */
  Renderer.prototype.initBank = function () {
    if (this.opts.unitStyle === '3d' && TWG.SpriteBank && TWG.haveGL && TWG.haveGL()) {
      try { this.bank = new TWG.SpriteBank(this.opts.quality); } catch (e) { this.bank = null; }
      if (this.bank && this.bank.dead) this.bank = null;
    }
    if (!this.bank) this.opts.unitStyle = 'vector';
    return this.bank;
  };
  Renderer.prototype.setUnitStyle = function (s) {
    this.opts.unitStyle = s;
    if (s === '3d' && !this.bank) this.initBank();
  };
  Renderer.prototype.setQuality = function (q) {
    this.opts.quality = q;
    if (this.bank) this.bank.setQuality(q);
  };

  Renderer.prototype.resize = function () {
    var r = this.cv.getBoundingClientRect();
    this.W = Math.max(320, Math.round(r.width));
    this.H = Math.max(240, Math.round(r.height));
    this.cv.width = Math.round(this.W * this.dpr);
    this.cv.height = Math.round(this.H * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  };

  /* --- 坐标变换 --- */
  Renderer.prototype.scale = function () { return 256 * Math.pow(2, this.zoom); };
  Renderer.prototype.toScreen = function (lat, lon) {
    var s = this.scale();
    return {
      x: (lon2x(lon) - lon2x(this.center.lon)) * s + this.W / 2,
      y: (lat2y(lat) - lat2y(this.center.lat)) * s + this.H / 2
    };
  };
  Renderer.prototype.toLatLon = function (px, py) {
    var s = this.scale();
    return {
      lon: x2lon(lon2x(this.center.lon) + (px - this.W / 2) / s),
      lat: y2lat(lat2y(this.center.lat) + (py - this.H / 2) / s)
    };
  };
  Renderer.prototype.mpp = function () {  // meters per pixel
    return 156543.03392 * Math.cos(this.center.lat * D2R) / Math.pow(2, this.zoom);
  };
  Renderer.prototype.kmToPx = function (km) { return km * 1000 / this.mpp(); };

  Renderer.prototype.pan = function (dx, dy) {
    var s = this.scale();
    this.center.lon = x2lon(lon2x(this.center.lon) - dx / s);
    var ny = lat2y(this.center.lat) - dy / s;
    this.center.lat = y2lat(Math.min(0.9, Math.max(0.1, ny)));
  };
  Renderer.prototype.zoomAt = function (px, py, dz) {
    var before = this.toLatLon(px, py);
    this.zoom = Math.min(14, Math.max(5, this.zoom + dz));
    var after = this.toLatLon(px, py);
    this.center.lon += before.lon - after.lon;
    this.center.lat += before.lat - after.lat;
  };
  Renderer.prototype.flyTo = function (lat, lon, z) {
    this.center = { lat: lat, lon: lon };
    if (z) this.zoom = z;
  };

  /* ======================= 瓦片 ======================================== */
  Renderer.prototype.tileZ = function () {
    var src = SOURCES[this.opts.source];
    return Math.max(3, Math.min(src.max, Math.round(this.zoom)));
  };
  Renderer.prototype.getTile = function (z, x, y) {
    var src = SOURCES[this.opts.source];
    var key = this.opts.source + '/' + z + '/' + x + '/' + y;
    var t = this.tiles.get(key);
    if (t) return t;
    if (this.loading > 10) return null;
    var img = new root.Image();
    img.crossOrigin = 'anonymous';
    var rec = { img: img, ok: false, bad: false };
    this.tiles.set(key, rec);
    this.loading++;
    var self = this;
    img.onload = function () { rec.ok = true; self.loading--; self.dirty = true; };
    img.onerror = function () { rec.bad = true; self.loading--; };
    img.src = src.url(z, x, y);
    if (this.tiles.size > 900) {
      var it = this.tiles.keys();
      for (var i = 0; i < 300; i++) { var k = it.next().value; if (k) this.tiles.delete(k); }
    }
    return rec;
  };
  Renderer.prototype.drawTiles = function () {
    var src = SOURCES[this.opts.source];
    var ctx = this.ctx;
    if (src.offline || !src.url) return;
    var z = this.tileZ(), n = Math.pow(2, z);
    var tl = this.toLatLon(0, 0), br = this.toLatLon(this.W, this.H);
    var lat0 = tl.lat, lat1 = br.lat, lon0 = tl.lon, lon1 = br.lon;
    if (src.gcj) {
      var a = wgs2gcj(lat0, lon0), b = wgs2gcj(lat1, lon1);
      lat0 = a[0]; lon0 = a[1]; lat1 = b[0]; lon1 = b[1];
    }
    var x0 = Math.floor(lon2x(lon0) * n), x1 = Math.ceil(lon2x(lon1) * n);
    var y0 = Math.floor(lat2y(lat0) * n), y1 = Math.ceil(lat2y(lat1) * n);
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(n, x1); y1 = Math.min(n, y1);
    if ((x1 - x0) * (y1 - y0) > 400) return;
    ctx.save();
    ctx.globalAlpha = this.opts.tileOpacity;
    for (var tx = x0; tx < x1; tx++) {
      for (var ty = y0; ty < y1; ty++) {
        var rec = this.getTile(z, tx, ty);
        if (!rec || !rec.ok) continue;
        var tLat0 = y2lat(ty / n), tLon0 = x2lon(tx / n);
        var tLat1 = y2lat((ty + 1) / n), tLon1 = x2lon((tx + 1) / n);
        if (src.gcj) {
          var w0 = gcj2wgs(tLat0, tLon0), w1 = gcj2wgs(tLat1, tLon1);
          tLat0 = w0[0]; tLon0 = w0[1]; tLat1 = w1[0]; tLon1 = w1[1];
        }
        var p0 = this.toScreen(tLat0, tLon0), p1 = this.toScreen(tLat1, tLon1);
        var w = p1.x - p0.x, h = p1.y - p0.y;
        try { ctx.drawImage(rec.img, p0.x, p0.y, w + 0.6, h + 0.6); } catch (e) { }
      }
    }
    ctx.restore();
    if (this.opts.tint) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgba(70,120,150,0.42)';
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }
  };

  /* ======================= 矢量底图 ==================================== */
  Renderer.prototype.polyPath = function (poly) {
    var ctx = this.ctx, s = this.scale();
    var cx = lon2x(this.center.lon), cy = lat2y(this.center.lat);
    ctx.beginPath();
    for (var i = 0; i < poly.length; i++) {
      var p = poly[i];
      var x = (lon2x(p[0]) - cx) * s + this.W / 2;
      var y = (lat2y(p[1]) - cy) * s + this.H / 2;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
  Renderer.prototype.drawVectorBase = function () {
    var ctx = this.ctx, G = TWG.GEO;
    var offline = SOURCES[this.opts.source].offline;
    // 海洋底色
    ctx.fillStyle = COL.sea;
    ctx.fillRect(0, 0, this.W, this.H);
    if (offline) {
      // 深水区渐变
      var g = ctx.createLinearGradient(0, 0, this.W, 0);
      g.addColorStop(0, 'rgba(6,20,32,0.9)'); g.addColorStop(0.55, 'rgba(8,30,45,0.6)');
      g.addColorStop(1, 'rgba(2,8,16,1)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, this.W, this.H);
      // 台湾浅滩/海峡浅水标示
      this.shallowHint();
    }
    var groups = [
      { p: G.inland, fill: offline ? '#16211d' : null, line: 'rgba(110,180,150,0.18)' },
      { p: G.guangdong, fill: offline ? '#1a2620' : null, line: 'rgba(110,180,150,0.22)' },
      { p: G.zhejiang, fill: offline ? '#1a2620' : null, line: 'rgba(110,180,150,0.22)' },
      { p: G.fujian, fill: offline ? '#1e2c25' : null, line: 'rgba(255,120,120,0.30)' },
      { p: G.taiwan, fill: offline ? '#22352c' : null, line: 'rgba(120,220,255,0.42)' }
    ];
    for (var gi = 0; gi < groups.length; gi++) {
      var grp = groups[gi];
      if (!grp.p) continue;
      ctx.lineWidth = gi === 4 ? 1.15 : 0.7;
      ctx.strokeStyle = grp.line;
      for (var i = 0; i < grp.p.length; i++) {
        this.polyPath(grp.p[i]);
        if (grp.fill) { ctx.fillStyle = grp.fill; ctx.fill(); }
        ctx.stroke();
      }
    }
    // 外围岛屿
    ctx.lineWidth = 0.9; ctx.strokeStyle = 'rgba(220,220,220,0.5)';
    TWG.THEATER.ISLANDS_EXTRA.forEach(function (o) {
      this.polyPath(o.poly);
      if (offline) { ctx.fillStyle = '#26302c'; ctx.fill(); }
      ctx.stroke();
    }, this);
  };
  Renderer.prototype.shallowHint = function () {
    var ctx = this.ctx;
    var zones = [
      { lat: 22.9, lon: 118.0, r: 60, a: 0.16 },   // 台湾浅滩
      { lat: 24.3, lon: 119.9, r: 95, a: 0.10 },   // 海峡主体浅水
      { lat: 23.6, lon: 119.95, r: 35, a: 0.06 }
    ];
    zones.forEach(function (z) {
      var p = this.toScreen(z.lat, z.lon), r = this.kmToPx(z.r);
      var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, 'rgba(60,140,170,' + z.a + ')');
      g.addColorStop(1, 'rgba(60,140,170,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
    }, this);
  };

  /* ======================= 作战区 / 中线 / 网格 ========================= */
  Renderer.prototype.drawZones = function () {
    var ctx = this.ctx, TH = TWG.THEATER, E = this.E;
    if (this.opts.showGrid) {
      ctx.strokeStyle = COL.grid; ctx.lineWidth = 0.6;
      ctx.font = '9px ui-monospace,monospace'; ctx.fillStyle = 'rgba(120,190,210,0.35)';
      for (var lon = 112; lon <= 128; lon++) {
        var a = this.toScreen(10, lon), b = this.toScreen(35, lon);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        if (a.x > 20 && a.x < this.W - 20) ctx.fillText(lon + '°E', a.x + 2, this.H - 4);
      }
      for (var lat = 18; lat <= 33; lat++) {
        var c = this.toScreen(lat, 110), d = this.toScreen(lat, 130);
        ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
        if (c.y > 20 && c.y < this.H - 20) ctx.fillText(lat + '°N', 3, c.y - 2);
      }
    }
    if (!this.opts.showZones) return;
    // 海峡中线
    var ml = TH.CHANNELS[0];
    ctx.strokeStyle = COL.median; ctx.lineWidth = 1.4; ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ml.pts.forEach(function (p, i) {
      var s = this.toScreen(p[1], p[0]);
      if (i === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
    }, this);
    ctx.stroke(); ctx.setLineDash([]);
    var mid = this.toScreen(ml.pts[2][1], ml.pts[2][0]);
    ctx.fillStyle = COL.median; ctx.font = '10px sans-serif';
    ctx.fillText('海峡中线', mid.x + 6, mid.y);
    // 封控区 (封锁剧本)
    if (E && (E.blockade || E.scenario.id === 'blockade')) {
      ctx.strokeStyle = 'rgba(255,77,79,0.75)'; ctx.fillStyle = 'rgba(255,77,79,0.07)';
      ctx.lineWidth = 1.2;
      TH.CLOSURE_ZONES.forEach(function (z) {
        ctx.beginPath();
        z.pts.forEach(function (p, i) {
          var s = this.toScreen(p[1], p[0]);
          if (i === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
        }, this);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        var c0 = this.toScreen(z.pts[3][1], z.pts[3][0]);
        ctx.fillStyle = 'rgba(255,150,150,0.9)'; ctx.font = '10px sans-serif';
        ctx.fillText(z.name, c0.x + 4, c0.y + 12);
        ctx.fillStyle = 'rgba(255,77,79,0.07)';
      }, this);
    }
    // 登陆滩头
    if (this.opts.showBeach) {
      var plan = (E && E.scenario.landingPlan) || [];
      var planned = {}; plan.forEach(function (p) { planned[p.beach] = p; });
      TH.BEACHES.forEach(function (b) {
        var p = this.toScreen(b.lat, b.lon);
        if (p.x < -50 || p.x > this.W + 50 || p.y < -50 || p.y > this.H + 50) return;
        var w = Math.max(6, this.kmToPx(b.width));
        var isPlan = !!planned[b.id];
        var bh = E && E.beachheads[b.id];
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.strokeStyle = bh && bh.active ? '#ff4d4f' : isPlan ? 'rgba(255,169,64,0.9)' : 'rgba(255,255,255,0.28)';
        ctx.lineWidth = bh && bh.active ? 3 : 1.6;
        ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); ctx.stroke();
        // 潮间带滩涂标示
        if (b.flat > 1) {
          ctx.strokeStyle = 'rgba(200,180,120,0.5)'; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
          var fp = this.kmToPx(b.flat);
          ctx.beginPath(); ctx.moveTo(-w / 2, -fp); ctx.lineTo(w / 2, -fp); ctx.stroke();
          ctx.setLineDash([]);
        }
        if (this.opts.showLabels && this.zoom > 6.4) {
          ctx.fillStyle = bh && bh.active ? '#ff9c9e' : 'rgba(255,220,170,0.85)';
          ctx.font = '9px sans-serif';
          ctx.fillText(b.name.replace(/—.*/, '') + (bh && bh.active ? ' ▲登陆场' : ''), w / 2 + 3, 3);
        }
        ctx.restore();
      }, this);
      // 剧本自定义滩头(外岛)
      plan.forEach(function (pl) {
        var bb = TWG.THEATER.idx.beach[pl.beach];
        if (!bb || !bb.custom) return;
        var p = this.toScreen(bb.lat, bb.lon);
        var bh = E.beachheads[pl.beach];
        ctx.strokeStyle = bh && bh.active ? '#ff4d4f' : 'rgba(255,169,64,0.9)';
        ctx.lineWidth = bh && bh.active ? 3 : 1.6;
        var w = Math.max(6, this.kmToPx(bb.width));
        ctx.beginPath(); ctx.moveTo(p.x - w / 2, p.y); ctx.lineTo(p.x + w / 2, p.y); ctx.stroke();
      }, this);
    }
    // 水雷区
    if (E && E.mines) {
      E.mines.forEach(function (m) {
        if (m.density <= 0.02) return;
        var p = this.toScreen(m.lat, m.lon), r = this.kmToPx(m.r);
        ctx.strokeStyle = 'rgba(255,214,102,' + (0.25 + m.density * 0.5) + ')';
        ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        if (r > 14) {
          ctx.fillStyle = 'rgba(255,214,102,0.8)'; ctx.font = '8px sans-serif';
          ctx.fillText('雷区', p.x - 8, p.y + 3);
        }
      }, this);
    }
    // 登陆场推进弧
    if (E) {
      Object.keys(E.beachheads).forEach(function (k) {
        var bh = E.beachheads[k];
        if (!bh.active || !(bh.advance > 1)) return;
        var b = TWG.THEATER.idx.beach[k]; if (!b) return;
        var p = this.toScreen(b.lat, b.lon), r = this.kmToPx(bh.advance);
        ctx.fillStyle = 'rgba(255,77,79,0.10)';
        ctx.strokeStyle = 'rgba(255,77,79,0.55)'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill(); ctx.stroke();
      }, this);
    }
  };

  /* ======================= 设施 ======================================== */
  function airbaseIcon(ctx, b, sz, col, ops) {
    ctx.save();
    ctx.strokeStyle = col; ctx.lineWidth = 1.4;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.arc(0, 0, sz, 0, TAU); ctx.fill(); ctx.stroke();
    // 跑道符号
    ctx.strokeStyle = ops > 0.5 ? col : ops > 0.15 ? '#ffd666' : '#ff4d4f';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-sz * 0.75, sz * 0.45); ctx.lineTo(sz * 0.75, -sz * 0.45); ctx.stroke();
    if (ops <= 0.15) {   // 跑道被切断
      ctx.strokeStyle = '#ff4d4f'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(-sz * 0.5, -sz * 0.5); ctx.lineTo(sz * 0.5, sz * 0.5); ctx.stroke();
    }
    if (b.cave > 0) {  // 洞库标示
      ctx.strokeStyle = '#95de64'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(0, 0, sz * 0.45, Math.PI, 0); ctx.stroke();
    }
    ctx.restore();
  }
  Renderer.prototype.drawFacilities = function () {
    var ctx = this.ctx, E = this.E;
    var z = this.zoom;
    // 机场
    Object.keys(E.bases).forEach(function (k) {
      var b = E.bases[k];
      if (!b.active && b.side !== 'US' && b.side !== 'JP') { }
      var p = this.toScreen(b.lat, b.lon);
      if (p.x < -30 || p.x > this.W + 30 || p.y < -30 || p.y > this.H + 30) return;
      var col = sideCol(b.side);
      var sz = b.hwy ? 4.5 : Math.min(11, 6 + b.rw * 1.4);
      ctx.save(); ctx.translate(p.x, p.y);
      airbaseIcon(ctx, b, sz, col, b.ops);
      if (b.captured) {
        ctx.fillStyle = '#ff4d4f'; ctx.font = 'bold 9px sans-serif'; ctx.fillText('★占', sz + 1, -sz);
      }
      var alive = 0; Object.keys(b.inv).forEach(function (c) { alive += b.inv[c]; });
      if (this.opts.showLabels && z > 6.2) {
        ctx.fillStyle = COL.text; ctx.font = (z > 8 ? 10 : 9) + 'px sans-serif';
        var nm = b.name.replace(/\s*\(.*?\)/, '');
        ctx.fillText(nm, sz + 3, 3);
        if (z > 7.4) {
          ctx.fillStyle = COL.dim; ctx.font = '8px ui-monospace,monospace';
          ctx.fillText('机 ' + alive + ' / 可用 ' + Math.round(b.ops * 100) + '%' + (b.cuts ? ' / 弹坑' + b.cuts : ''), sz + 3, 13);
        }
      }
      ctx.restore();
    }, this);
    // 港口与关键节点
    Object.keys(E.sites).forEach(function (k) {
      var s = E.sites[k];
      var p = this.toScreen(s.lat, s.lon);
      if (p.x < -30 || p.x > this.W + 30 || p.y < -30 || p.y > this.H + 30) return;
      var col = sideCol(s.owner);
      ctx.save(); ctx.translate(p.x, p.y);
      var sz = s.kind === 'navalbase' ? 6 : s.kind === 'port' ? 5.5 : 4.5;
      ctx.lineWidth = 1.3; ctx.strokeStyle = col; ctx.fillStyle = 'rgba(0,0,0,0.5)';
      if (s.kind === 'navalbase' || s.kind === 'port') {
        // 锚形
        ctx.beginPath(); ctx.rect(-sz, -sz, sz * 2, sz * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -sz * 0.7); ctx.lineTo(0, sz * 0.7);
        ctx.moveTo(-sz * 0.6, sz * 0.2); ctx.quadraticCurveTo(0, sz * 0.95, sz * 0.6, sz * 0.2);
        ctx.moveTo(-sz * 0.45, -sz * 0.45); ctx.lineTo(sz * 0.45, -sz * 0.45);
        ctx.strokeStyle = s.kind === 'navalbase' ? col : '#ffd666'; ctx.stroke();
      } else if (s.kind === 'radar') {
        ctx.beginPath(); ctx.arc(0, 0, sz, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#95de64';
        for (var w = 1; w <= 3; w++) { ctx.beginPath(); ctx.arc(0, sz * 0.3, sz * 0.35 * w, -2.4, -0.75); ctx.stroke(); }
      } else if (s.kind === 'c2') {
        ctx.beginPath(); ctx.moveTo(0, -sz * 1.2); ctx.lineTo(sz, 0); ctx.lineTo(0, sz * 1.2); ctx.lineTo(-sz, 0);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = col; ctx.font = 'bold 7px sans-serif'; ctx.fillText('C2', -6, 3);
      } else if (s.kind === 'power' || s.kind === 'fuel') {
        ctx.beginPath(); ctx.rect(-sz, -sz, sz * 2, sz * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#ffd666'; ctx.beginPath();
        ctx.moveTo(-2, -sz * 0.7); ctx.lineTo(1, 0); ctx.lineTo(-1, 0); ctx.lineTo(2, sz * 0.7); ctx.stroke();
      } else if (s.kind === 'cable') {
        ctx.beginPath(); ctx.arc(0, 0, sz * 0.8, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#69c0ff'; ctx.beginPath();
        ctx.moveTo(-sz, 0); ctx.bezierCurveTo(-sz * 0.3, -sz, sz * 0.3, sz, sz, 0); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(0, 0, sz * 0.8, 0, TAU); ctx.fill(); ctx.stroke();
      }
      if (s.ops < 0.99) {
        ctx.strokeStyle = s.ops < 0.3 ? '#ff4d4f' : '#ffd666'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, sz + 3, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - s.ops)); ctx.stroke();
      }
      if (s.owner === 'PLA' && TWG.THEATER.idx.port[k] && TWG.THEATER.idx.port[k].side === 'ROC') {
        ctx.fillStyle = '#ff4d4f'; ctx.font = 'bold 9px sans-serif'; ctx.fillText('★', sz, -sz);
      }
      if (this.opts.showLabels && z > 6.8) {
        ctx.fillStyle = COL.dim; ctx.font = '9px sans-serif';
        ctx.fillText(s.name.replace(/\s*\(.*?\)/, ''), sz + 3, 3);
      }
      ctx.restore();
    }, this);
    // 城市
    if (z > 6.0) {
      TWG.THEATER.CITIES.forEach(function (c) {
        var p = this.toScreen(c.lat, c.lon);
        if (p.x < 0 || p.x > this.W || p.y < 0 || p.y > this.H) return;
        var r = Math.max(2, Math.min(7, Math.sqrt(c.pop) * 0.35));
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU);
        ctx.fillStyle = c.taken ? 'rgba(255,77,79,0.85)' : c.side === 'ROC' ? 'rgba(160,220,255,0.7)' : 'rgba(255,180,180,0.55)';
        ctx.fill();
        if (c.capital) {
          ctx.strokeStyle = c.taken ? '#ff4d4f' : '#ffd666'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.arc(p.x, p.y, r + 3.5, 0, TAU); ctx.stroke();
        }
        if (this.opts.showLabels) {
          ctx.fillStyle = c.taken ? '#ff9c9e' : 'rgba(225,240,250,0.9)';
          ctx.font = (c.capital ? 'bold ' : '') + (z > 7.5 ? 11 : 9) + 'px sans-serif';
          ctx.fillText(c.name + (c.taken ? '(陷落)' : ''), p.x + r + 3, p.y + 4);
        }
      }, this);
    }
  };

  /* ======================= 装备矢量建模 ================================ */
  /* 所有模型以"舰首/机头朝上(-y)"绘制，长度 L(px)，宽度 B(px) */

  function hull(ctx, L, B, bowSharp) {
    var h = L / 2, w = B / 2;
    ctx.beginPath();
    ctx.moveTo(0, -h);
    ctx.quadraticCurveTo(w * (bowSharp ? 0.55 : 0.85), -h * (bowSharp ? 0.62 : 0.5), w, -h * 0.18);
    ctx.lineTo(w, h * 0.72);
    ctx.quadraticCurveTo(w * 0.92, h, w * 0.55, h);
    ctx.lineTo(-w * 0.55, h);
    ctx.quadraticCurveTo(-w * 0.92, h, -w, h * 0.72);
    ctx.lineTo(-w, -h * 0.18);
    ctx.quadraticCurveTo(-w * (bowSharp ? 0.55 : 0.85), -h * (bowSharp ? 0.62 : 0.5), 0, -h);
    ctx.closePath();
  }
  function box(ctx, x, y, w, h) { ctx.beginPath(); ctx.rect(x - w / 2, y - h / 2, w, h); }

  var MODELS = {
    /* ---------- 航空母舰 ---------- */
    cv: function (ctx, L, B, u, col, dark) {
      var h = L / 2, w = B / 2;
      // 飞行甲板 (含斜角甲板)
      ctx.fillStyle = dark; ctx.strokeStyle = col; ctx.lineWidth = 1;
      hull(ctx, L, B * 0.72, true); ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-w * 0.05, -h * 0.98); ctx.lineTo(w * 0.52, -h * 0.4);
      ctx.lineTo(w * 0.52, h * 0.9); ctx.lineTo(-w, h * 0.9); ctx.lineTo(-w, -h * 0.2);
      ctx.closePath();
      ctx.fillStyle = 'rgba(35,45,50,0.92)'; ctx.fill(); ctx.strokeStyle = col; ctx.stroke();
      // 斜角甲板
      ctx.beginPath();
      ctx.moveTo(-w * 0.15, -h * 0.9); ctx.lineTo(-w * 0.95, h * 0.35);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = Math.max(0.6, L * 0.012); ctx.stroke();
      // 中线跑道
      ctx.beginPath(); ctx.moveTo(-w * 0.1, -h * 0.9); ctx.lineTo(-w * 0.1, h * 0.8);
      ctx.setLineDash([L * 0.05, L * 0.04]); ctx.stroke(); ctx.setLineDash([]);
      // 舰岛 (右舷)
      ctx.fillStyle = 'rgba(90,100,110,0.95)';
      box(ctx, w * 0.62, -h * 0.02, B * 0.2, L * 0.2); ctx.fill(); ctx.strokeStyle = col; ctx.stroke();
      // 桅杆/雷达
      ctx.strokeStyle = '#9ae6b4'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(w * 0.62, -h * 0.12); ctx.lineTo(w * 0.62, -h * 0.24); ctx.stroke();
      // 舰载机
      var wing = Math.max(2.2, L * 0.055);
      ctx.fillStyle = 'rgba(230,240,255,0.85)';
      var spots = [[-w * 0.55, -h * 0.55], [-w * 0.62, -h * 0.3], [w * 0.2, h * 0.55], [w * 0.05, h * 0.3], [-w * 0.35, h * 0.65]];
      var n = 0; if (u && u.airWing) Object.keys(u.airWing).forEach(function (k) { n += u.airWing[k]; });
      for (var i = 0; i < spots.length && i < Math.ceil(n / 8); i++) {
        ctx.save(); ctx.translate(spots[i][0], spots[i][1]); ctx.rotate(0.5);
        ctx.beginPath(); ctx.moveTo(0, -wing); ctx.lineTo(wing * 0.8, wing * 0.7);
        ctx.lineTo(0, wing * 0.35); ctx.lineTo(-wing * 0.8, wing * 0.7); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      // 弹射器 (福建舰)
      if (u && u.cls === 'CV-Fujian') {
        ctx.strokeStyle = '#ffd666'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-w * 0.45, -h * 0.85); ctx.lineTo(-w * 0.45, -h * 0.35);
        ctx.moveTo(w * 0.1, -h * 0.75); ctx.lineTo(w * 0.25, -h * 0.3); ctx.stroke();
      } else if (u && (u.cls === 'CV-Shandong' || u.cls === 'CV-Liaoning')) {
        ctx.strokeStyle = '#ffd666'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(-w * 0.1, -h * 0.85, L * 0.09, 0.4, 2.7); ctx.stroke();  // 滑跃甲板
      }
    },
    /* ---------- 两栖攻击舰 ---------- */
    lhd: function (ctx, L, B, u, col, dark) {
      var h = L / 2, w = B / 2;
      hull(ctx, L, B, true); ctx.fillStyle = dark; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.rect(-w * 0.9, -h * 0.86, w * 1.8, h * 1.7);
      ctx.fillStyle = 'rgba(40,50,45,0.9)'; ctx.fill(); ctx.strokeStyle = col; ctx.stroke();
      // 直升机起降点
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.7;
      for (var i = 0; i < 4; i++) {
        var yy = -h * 0.6 + i * h * 0.42;
        ctx.beginPath(); ctx.arc(-w * 0.25, yy, Math.max(1.6, L * 0.035), 0, TAU); ctx.stroke();
      }
      // 舰岛
      ctx.fillStyle = 'rgba(95,105,115,0.95)';
      box(ctx, w * 0.6, -h * 0.1, B * 0.22, L * 0.3); ctx.fill(); ctx.strokeStyle = col; ctx.stroke();
      ctx.strokeStyle = '#9ae6b4'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(w * 0.6, -h * 0.26); ctx.lineTo(w * 0.6, -h * 0.4); ctx.stroke();
    },
    /* ---------- 船坞登陆舰 ---------- */
    lpd: function (ctx, L, B, u, col, dark) {
      var h = L / 2, w = B / 2;
      hull(ctx, L, B, true); ctx.fillStyle = dark; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(75,85,95,0.9)';
      box(ctx, 0, -h * 0.35, B * 0.72, L * 0.42); ctx.fill(); ctx.strokeStyle = col; ctx.stroke();
      // 后部飞行甲板 + 坞舱
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.arc(0, h * 0.45, Math.max(1.8, L * 0.055), 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#69c0ff';
      ctx.beginPath(); ctx.rect(-w * 0.45, h * 0.72, w * 0.9, h * 0.2); ctx.stroke();
    },
    /* ---------- 坦克登陆舰 ---------- */
    lst: function (ctx, L, B, u, col, dark) {
      var h = L / 2, w = B / 2;
      ctx.beginPath();
      ctx.moveTo(-w * 0.7, -h); ctx.lineTo(w * 0.7, -h); ctx.lineTo(w, -h * 0.6);
      ctx.lineTo(w, h * 0.8); ctx.lineTo(w * 0.6, h); ctx.lineTo(-w * 0.6, h);
      ctx.lineTo(-w, h * 0.8); ctx.lineTo(-w, -h * 0.6); ctx.closePath();
      ctx.fillStyle = dark; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke();
      // 首门跳板
      ctx.strokeStyle = '#ffd666'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-w * 0.65, -h * 0.98); ctx.lineTo(w * 0.65, -h * 0.98); ctx.stroke();
      // 上层建筑(尾部)
      ctx.fillStyle = 'rgba(85,95,105,0.95)';
      box(ctx, 0, h * 0.55, B * 0.6, L * 0.22); ctx.fill(); ctx.strokeStyle = col; ctx.stroke();
      // 车辆甲板
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 0.6;
      for (var i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(-w * 0.6, -h * 0.6 + i * h * 0.35); ctx.lineTo(w * 0.6, -h * 0.6 + i * h * 0.35); ctx.stroke();
      }
    },
    /* ---------- 登陆驳船(水桥) ---------- */
    barge: function (ctx, L, B, u, col, dark) {
      var h = L / 2, w = B / 2;
      ctx.beginPath(); ctx.rect(-w, -h, w * 2, h * 2);
      ctx.fillStyle = dark; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke();
      // 自升式支腿
      ctx.fillStyle = '#ffd666';
      [[-w * 0.8, -h * 0.75], [w * 0.8, -h * 0.75], [-w * 0.8, h * 0.75], [w * 0.8, h * 0.75]].forEach(function (p) {
        ctx.beginPath(); ctx.arc(p[0], p[1], Math.max(1.2, L * 0.035), 0, TAU); ctx.fill();
      });
      // 栈桥
      ctx.strokeStyle = '#ffa940'; ctx.lineWidth = Math.max(1, L * 0.03);
      ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(0, -h * 1.6); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 0.6;
      for (var i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-w, -h + i * h * 0.5); ctx.lineTo(w, -h + i * h * 0.5); ctx.stroke(); }
    },
    /* ---------- 滚装/民船 ---------- */
    sealift: function (ctx, L, B, u, col, dark) {
      var h = L / 2, w = B / 2;
      hull(ctx, L, B, false); ctx.fillStyle = dark; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(110,120,130,0.9)';
      box(ctx, 0, h * 0.62, B * 0.8, L * 0.2); ctx.fill(); ctx.strokeStyle = col; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.6;
      for (var i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-w * 0.85, -h * 0.85 + i * h * 0.32); ctx.lineTo(w * 0.85, -h * 0.85 + i * h * 0.32); ctx.stroke(); }
      ctx.strokeStyle = '#ffd666'; ctx.beginPath(); ctx.moveTo(-w * 0.5, h * 0.95); ctx.lineTo(w * 0.5, h * 0.95); ctx.stroke();
    },
    /* ---------- 驱逐舰 / 巡防舰 ---------- */
    ddg: function (ctx, L, B, u, col, dark) {
      var h = L / 2, w = B / 2;
      hull(ctx, L, B, true); ctx.fillStyle = dark; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke();
      // 主炮
      ctx.fillStyle = 'rgba(150,160,170,0.95)';
      ctx.beginPath(); ctx.arc(0, -h * 0.62, Math.max(1.1, B * 0.16), 0, TAU); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.6, B * 0.05);
      ctx.beginPath(); ctx.moveTo(0, -h * 0.62); ctx.lineTo(0, -h * 0.86); ctx.stroke();
      // 前后垂发单元
      var vls = u && (u.P.vlsTotal || 0);
      ctx.fillStyle = 'rgba(60,70,80,0.95)';
      box(ctx, 0, -h * 0.42, B * 0.5, L * 0.1); ctx.fill(); ctx.strokeStyle = '#ffd666'; ctx.lineWidth = 0.7; ctx.stroke();
      if (vls > 48) { box(ctx, 0, h * 0.3, B * 0.55, L * 0.13); ctx.fillStyle = 'rgba(60,70,80,0.95)'; ctx.fill(); ctx.stroke(); }
      // 上层建筑 + 相控阵板
      ctx.fillStyle = 'rgba(95,105,115,0.95)';
      box(ctx, 0, -h * 0.14, B * 0.66, L * 0.3); ctx.fill(); ctx.strokeStyle = col; ctx.stroke();
      ctx.fillStyle = '#9ae6b4';
      box(ctx, -w * 0.3, -h * 0.2, B * 0.14, L * 0.05); ctx.fill();
      box(ctx, w * 0.3, -h * 0.2, B * 0.14, L * 0.05); ctx.fill();
      // 桅杆
      ctx.strokeStyle = '#9ae6b4'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(0, -h * 0.2); ctx.lineTo(0, -h * 0.05); ctx.stroke();
      // 烟囱
      ctx.fillStyle = 'rgba(70,78,86,0.95)';
      box(ctx, 0, h * 0.02, B * 0.3, L * 0.07); ctx.fill();
      // 机库/直升机甲板
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.arc(0, h * 0.72, Math.max(1.5, B * 0.28), 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-B * 0.2, h * 0.72); ctx.lineTo(B * 0.2, h * 0.72); ctx.stroke();
    },
    ffg: function (ctx, L, B, u, col, dark) {
      MODELS.ddg(ctx, L, B, u, col, dark);
      // 反舰导弹发射箱 (中部两舷)
      ctx.fillStyle = '#ffa940';
      box(ctx, -B * 0.28, L * 0.06, B * 0.12, L * 0.09); ctx.fill();
      box(ctx, B * 0.28, L * 0.06, B * 0.12, L * 0.09); ctx.fill();
    },
    corvette: function (ctx, L, B, u, col, dark) {
      var h = L / 2, w = B / 2;
      // 双体/穿浪构型
      if (u && (u.cls === 'PGG-TuoChiang')) {
        ctx.fillStyle = dark; ctx.strokeStyle = col; ctx.lineWidth = 1;
        [[-w * 0.62, 1], [w * 0.62, 1]].forEach(function (o) {
          ctx.save(); ctx.translate(o[0], 0);
          hull(ctx, L, B * 0.42, true); ctx.fill(); ctx.stroke(); ctx.restore();
        });
        ctx.fillStyle = 'rgba(90,100,110,0.95)';
        box(ctx, 0, 0, B * 0.85, L * 0.5); ctx.fill(); ctx.strokeStyle = col; ctx.stroke();
        ctx.fillStyle = '#ffa940';
        box(ctx, -B * 0.22, h * 0.42, B * 0.16, L * 0.12); ctx.fill();
        box(ctx, B * 0.22, h * 0.42, B * 0.16, L * 0.12); ctx.fill();
      } else {
        hull(ctx, L, B, true); ctx.fillStyle = dark; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = 'rgba(95,105,115,0.95)';
        box(ctx, 0, -h * 0.1, B * 0.6, L * 0.34); ctx.fill(); ctx.strokeStyle = col; ctx.stroke();
        ctx.fillStyle = '#ffa940';
        box(ctx, -B * 0.25, h * 0.35, B * 0.14, L * 0.1); ctx.fill();
        box(ctx, B * 0.25, h * 0.35, B * 0.14, L * 0.1); ctx.fill();
      }
      ctx.strokeStyle = '#9ae6b4'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(0, -h * 0.2); ctx.lineTo(0, -h * 0.02); ctx.stroke();
    },
    fac: function (ctx, L, B, u, col, dark) {
      var h = L / 2, w = B / 2;
      // 022 型穿浪双体
      if (u && u.cls === 'PGG-022') {
        ctx.fillStyle = dark; ctx.strokeStyle = col; ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(0, -h); ctx.lineTo(w, h * 0.55); ctx.lineTo(w * 0.5, h); ctx.lineTo(-w * 0.5, h);
        ctx.lineTo(-w, h * 0.55); ctx.closePath(); ctx.fill(); ctx.stroke();
      } else {
        hull(ctx, L, B, true); ctx.fillStyle = dark; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 0.9; ctx.stroke();
      }
      ctx.fillStyle = '#ffa940';
      box(ctx, -B * 0.26, h * 0.25, B * 0.16, L * 0.16); ctx.fill();
      box(ctx, B * 0.26, h * 0.25, B * 0.16, L * 0.16); ctx.fill();
      ctx.fillStyle = 'rgba(95,105,115,0.95)';
      box(ctx, 0, -h * 0.25, B * 0.45, L * 0.25); ctx.fill();
    },
    /* ---------- 潜艇 ---------- */
    ssk: function (ctx, L, B, u, col, dark) {
      var h = L / 2, w = B / 2;
      ctx.beginPath();
      ctx.moveTo(0, -h);
      ctx.bezierCurveTo(w, -h * 0.75, w, h * 0.55, w * 0.28, h);
      ctx.lineTo(-w * 0.28, h);
      ctx.bezierCurveTo(-w, h * 0.55, -w, -h * 0.75, 0, -h);
      ctx.closePath();
      ctx.fillStyle = dark; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke();
      // 指挥台围壳
      ctx.fillStyle = 'rgba(60,70,80,0.95)';
      box(ctx, 0, -h * 0.28, B * 0.55, L * 0.16); ctx.fill(); ctx.strokeStyle = col; ctx.stroke();
      // 尾舵 / X 舵
      ctx.strokeStyle = col; ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(-w * 0.85, h * 0.86); ctx.lineTo(w * 0.85, h * 0.86);
      ctx.moveTo(0, h * 0.72); ctx.lineTo(0, h * 1.05); ctx.stroke();
      // 潜望镜
      ctx.strokeStyle = '#9ae6b4'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(0, -h * 0.36); ctx.lineTo(0, -h * 0.5); ctx.stroke();
    },
    ccg: function (ctx, L, B, u, col, dark) {
      var h = L / 2, w = B / 2;
      hull(ctx, L, B, true); ctx.fillStyle = dark; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(240,240,240,0.9)';
      box(ctx, 0, -h * 0.1, B * 0.62, L * 0.36); ctx.fill(); ctx.strokeStyle = col; ctx.stroke();
      // 白色船体 + 红蓝斜纹
      ctx.strokeStyle = '#ff4d4f'; ctx.lineWidth = Math.max(0.8, B * 0.1);
      ctx.beginPath(); ctx.moveTo(-w * 0.9, -h * 0.05); ctx.lineTo(-w * 0.2, -h * 0.3); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.arc(0, h * 0.68, Math.max(1.4, B * 0.26), 0, TAU); ctx.stroke();
    },
    militia: function (ctx, L, B, u, col, dark) {
      var h = L / 2, w = B / 2;
      hull(ctx, L, B, false); ctx.fillStyle = dark; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.fillStyle = 'rgba(120,110,90,0.9)';
      box(ctx, 0, h * 0.2, B * 0.55, L * 0.25); ctx.fill();
      ctx.strokeStyle = '#ffd666'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(0, h * 0.05); ctx.lineTo(0, -h * 0.5); ctx.stroke();
    },
    /* ---------- 飞机: 三角翼鸭式 (歼-20) ---------- */
    delta_canard: function (ctx, L, B, col) {
      var h = L / 2, w = B / 2;
      ctx.fillStyle = 'rgba(30,38,45,0.92)'; ctx.strokeStyle = col; ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(0, -h);                        // 机头
      ctx.lineTo(w * 0.16, -h * 0.45);
      ctx.lineTo(w, h * 0.55);                  // 主翼后掠
      ctx.lineTo(w * 0.3, h * 0.62);
      ctx.lineTo(w * 0.34, h);                  // 尾喷
      ctx.lineTo(-w * 0.34, h);
      ctx.lineTo(-w * 0.3, h * 0.62);
      ctx.lineTo(-w, h * 0.55);
      ctx.lineTo(-w * 0.16, -h * 0.45);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // 鸭翼
      ctx.beginPath();
      ctx.moveTo(w * 0.14, -h * 0.42); ctx.lineTo(w * 0.55, -h * 0.12); ctx.lineTo(w * 0.16, -h * 0.16); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-w * 0.14, -h * 0.42); ctx.lineTo(-w * 0.55, -h * 0.12); ctx.lineTo(-w * 0.16, -h * 0.16); ctx.closePath();
      ctx.fill(); ctx.stroke();
      // 双垂尾 (外倾)
      ctx.beginPath();
      ctx.moveTo(w * 0.24, h * 0.5); ctx.lineTo(w * 0.5, h * 0.95); ctx.lineTo(w * 0.28, h * 0.92); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-w * 0.24, h * 0.5); ctx.lineTo(-w * 0.5, h * 0.95); ctx.lineTo(-w * 0.28, h * 0.92); ctx.closePath(); ctx.fill();
    },
    /* ---------- 双发后掠翼双垂尾 (歼-16/苏-35/F-15) ---------- */
    twin_swept: function (ctx, L, B, col) {
      var h = L / 2, w = B / 2;
      ctx.fillStyle = 'rgba(34,42,50,0.92)'; ctx.strokeStyle = col; ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(0, -h);
      ctx.lineTo(w * 0.13, -h * 0.5);
      ctx.lineTo(w * 0.3, -h * 0.2);
      ctx.lineTo(w, h * 0.35);                 // 翼尖
      ctx.lineTo(w * 0.95, h * 0.5);
      ctx.lineTo(w * 0.3, h * 0.32);
      ctx.lineTo(w * 0.4, h);
      ctx.lineTo(-w * 0.4, h);
      ctx.lineTo(-w * 0.3, h * 0.32);
      ctx.lineTo(-w * 0.95, h * 0.5);
      ctx.lineTo(-w, h * 0.35);
      ctx.lineTo(-w * 0.3, -h * 0.2);
      ctx.lineTo(-w * 0.13, -h * 0.5);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // 平尾
      ctx.beginPath();
      ctx.moveTo(w * 0.25, h * 0.62); ctx.lineTo(w * 0.62, h * 0.92); ctx.lineTo(w * 0.25, h * 0.86); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-w * 0.25, h * 0.62); ctx.lineTo(-w * 0.62, h * 0.92); ctx.lineTo(-w * 0.25, h * 0.86); ctx.closePath(); ctx.fill();
      // 双垂尾
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(w * 0.15, h * 0.45); ctx.lineTo(w * 0.2, h * 0.95); ctx.lineTo(w * 0.09, h * 0.9); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-w * 0.15, h * 0.45); ctx.lineTo(-w * 0.2, h * 0.95); ctx.lineTo(-w * 0.09, h * 0.9); ctx.closePath(); ctx.fill();
    },
    /* ---------- 单发单垂尾 (F-16/歼-10/IDF/幻象) ---------- */
    single_fighter: function (ctx, L, B, col) {
      var h = L / 2, w = B / 2;
      ctx.fillStyle = 'rgba(36,46,56,0.92)'; ctx.strokeStyle = col; ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(0, -h);
      ctx.lineTo(w * 0.12, -h * 0.35);
      ctx.lineTo(w, h * 0.42);
      ctx.lineTo(w * 0.22, h * 0.5);
      ctx.lineTo(w * 0.26, h);
      ctx.lineTo(-w * 0.26, h);
      ctx.lineTo(-w * 0.22, h * 0.5);
      ctx.lineTo(-w, h * 0.42);
      ctx.lineTo(-w * 0.12, -h * 0.35);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(0, h * 0.35); ctx.lineTo(w * 0.07, h * 0.98); ctx.lineTo(-w * 0.07, h * 0.98); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(w * 0.2, h * 0.68); ctx.lineTo(w * 0.5, h * 0.92); ctx.lineTo(w * 0.2, h * 0.88); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-w * 0.2, h * 0.68); ctx.lineTo(-w * 0.5, h * 0.92); ctx.lineTo(-w * 0.2, h * 0.88); ctx.closePath(); ctx.fill();
    },
    /* ---------- 轰炸机 (轰-6/B-1B) ---------- */
    bomber: function (ctx, L, B, col) {
      var h = L / 2, w = B / 2;
      ctx.fillStyle = 'rgba(30,36,44,0.92)'; ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -h);
      ctx.bezierCurveTo(w * 0.18, -h * 0.85, w * 0.2, -h * 0.3, w * 0.2, -h * 0.15);
      ctx.lineTo(w, h * 0.3);
      ctx.lineTo(w * 0.96, h * 0.46);
      ctx.lineTo(w * 0.2, h * 0.25);
      ctx.lineTo(w * 0.2, h * 0.85);
      ctx.lineTo(-w * 0.2, h * 0.85);
      ctx.lineTo(-w * 0.2, h * 0.25);
      ctx.lineTo(-w * 0.96, h * 0.46);
      ctx.lineTo(-w, h * 0.3);
      ctx.lineTo(-w * 0.2, -h * 0.15);
      ctx.bezierCurveTo(-w * 0.2, -h * 0.3, -w * 0.18, -h * 0.85, 0, -h);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(0, h * 0.5); ctx.lineTo(w * 0.08, h); ctx.lineTo(-w * 0.08, h); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(w * 0.15, h * 0.72); ctx.lineTo(w * 0.55, h * 0.95); ctx.lineTo(w * 0.15, h * 0.9); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-w * 0.15, h * 0.72); ctx.lineTo(-w * 0.55, h * 0.95); ctx.lineTo(-w * 0.15, h * 0.9); ctx.closePath(); ctx.fill();
      // 挂载导弹
      ctx.strokeStyle = '#ffa940'; ctx.lineWidth = Math.max(0.7, w * 0.05);
      [-0.55, -0.35, 0.35, 0.55].forEach(function (fx) {
        ctx.beginPath(); ctx.moveTo(w * fx, h * 0.1); ctx.lineTo(w * fx, h * 0.42); ctx.stroke();
      });
    },
    /* ---------- 预警机 (空警-500/E-2K) ---------- */
    aew: function (ctx, L, B, col) {
      var h = L / 2, w = B / 2;
      ctx.fillStyle = 'rgba(32,42,50,0.92)'; ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.13, h * 0.95, 0, 0, TAU); ctx.fill(); ctx.stroke();
      // 直机翼 + 4 发
      ctx.beginPath(); ctx.rect(-w, -h * 0.12, w * 2, h * 0.16); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(70,80,90,0.95)';
      [-0.72, -0.42, 0.42, 0.72].forEach(function (fx) {
        ctx.beginPath(); ctx.rect(w * fx - w * 0.05, -h * 0.2, w * 0.1, h * 0.2); ctx.fill();
      });
      // 雷达罩 (背负式圆盘)
      ctx.fillStyle = 'rgba(150,220,255,0.55)'; ctx.strokeStyle = '#69c0ff'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(0, h * 0.1, w * 0.5, h * 0.16, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(0, h * 0.55); ctx.lineTo(w * 0.1, h * 0.98); ctx.lineTo(-w * 0.1, h * 0.98); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.rect(-w * 0.45, h * 0.82, w * 0.9, h * 0.1); ctx.fill();
    },
    /* ---------- 运输/巡逻机 ---------- */
    transport: function (ctx, L, B, col) {
      var h = L / 2, w = B / 2;
      ctx.fillStyle = 'rgba(34,44,52,0.92)'; ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(0, 0, w * 0.14, h * 0.95, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-w, -h * 0.02); ctx.lineTo(w, -h * 0.02);
      ctx.lineTo(w * 0.9, h * 0.14); ctx.lineTo(-w * 0.9, h * 0.14); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(75,85,95,0.95)';
      [-0.68, -0.38, 0.38, 0.68].forEach(function (fx) {
        ctx.beginPath(); ctx.rect(w * fx - w * 0.05, -h * 0.22, w * 0.1, h * 0.22); ctx.fill();
      });
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(0, h * 0.5); ctx.lineTo(w * 0.12, h * 0.98); ctx.lineTo(-w * 0.12, h * 0.98); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.rect(-w * 0.42, h * 0.8, w * 0.84, h * 0.1); ctx.fill();
    },
    /* ---------- 直升机 ---------- */
    helo: function (ctx, L, B, col) {
      var h = L / 2, w = B / 2;
      ctx.fillStyle = 'rgba(36,46,54,0.92)'; ctx.strokeStyle = col; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.ellipse(0, -h * 0.15, w * 0.26, h * 0.55, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.rect(-w * 0.06, h * 0.3, w * 0.12, h * 0.62); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-w * 0.22, h * 0.9); ctx.lineTo(w * 0.22, h * 0.9); ctx.stroke();
      // 旋翼
      ctx.strokeStyle = 'rgba(180,220,230,0.55)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, -h * 0.15, w * 0.95, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(180,220,230,0.8)'; ctx.lineWidth = 0.8;
      for (var i = 0; i < 4; i++) {
        var a = i * Math.PI / 2 + 0.4;
        ctx.beginPath(); ctx.moveTo(0, -h * 0.15);
        ctx.lineTo(Math.cos(a) * w * 0.95, -h * 0.15 + Math.sin(a) * w * 0.95); ctx.stroke();
      }
      // 短翼挂架
      ctx.strokeStyle = '#ffa940'; ctx.lineWidth = Math.max(0.8, w * 0.08);
      ctx.beginPath(); ctx.moveTo(-w * 0.55, 0); ctx.lineTo(w * 0.55, 0); ctx.stroke();
    },
    /* ---------- 无人机 ---------- */
    uav: function (ctx, L, B, col) {
      var h = L / 2, w = B / 2;
      ctx.fillStyle = 'rgba(40,50,58,0.9)'; ctx.strokeStyle = col; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.ellipse(0, 0, w * 0.09, h * 0.9, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-w, h * 0.1); ctx.lineTo(w, h * 0.1);
      ctx.lineTo(w * 0.95, h * 0.2); ctx.lineTo(-w * 0.95, h * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(w * 0.1, h * 0.6); ctx.lineTo(w * 0.3, h); ctx.lineTo(w * 0.05, h * 0.95); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-w * 0.1, h * 0.6); ctx.lineTo(-w * 0.3, h); ctx.lineTo(-w * 0.05, h * 0.95); ctx.closePath(); ctx.fill();
    },
    /* ---------- 隐身无人机 (攻击-11) ---------- */
    ucav_stealth: function (ctx, L, B, col) {
      var h = L / 2, w = B / 2;
      ctx.fillStyle = 'rgba(28,34,40,0.94)'; ctx.strokeStyle = col; ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(0, -h); ctx.lineTo(w, h * 0.55); ctx.lineTo(w * 0.35, h * 0.75);
      ctx.lineTo(0, h * 0.35); ctx.lineTo(-w * 0.35, h * 0.75); ctx.lineTo(-w, h * 0.55);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  };

  /* 平台 → 模型 映射 */
  function modelFor(u) {
    var P = u.P, r = P.role;
    if (u.domain === 'surface') {
      if (r === 'cv') return 'cv';
      if (r === 'lhd' || r === 'lha') return 'lhd';
      if (r === 'lpd') return 'lpd';
      if (r === 'lst' || r === 'lsm') return 'lst';
      if (r === 'barge') return 'barge';
      if (r === 'sealift') return 'sealift';
      if (r === 'militia') return 'militia';
      if (r === 'ccg') return 'ccg';
      if (r === 'ddg') return 'ddg';
      if (r === 'ffg') return 'ffg';
      if (r === 'corvette' || r === 'patrol' || r === 'minelayer') return 'corvette';
      if (r === 'fac') return 'fac';
      return 'ddg';
    }
    if (u.domain === 'sub') return 'ssk';
    if (u.domain === 'air') {
      if (P.helo) return 'helo';
      if (P.uav) return (u.cls === 'GJ-11') ? 'ucav_stealth' : 'uav';
      if (r === 'aew') return 'aew';
      if (r === 'bomber') return 'bomber';
      if (r === 'transport' || r === 'asw' || r === 'elint') return 'transport';
      if (P.gen >= 5) return 'delta_canard';
      if (P.crew >= 2 || u.cls === 'Su-35S' || u.cls === 'J-11B' || u.cls === 'J-16') return 'twin_swept';
      return 'single_fighter';
    }
    return null;
  }
  /* 平台真实尺寸 (m) — 统一由 equipment.js 的尺寸表提供 */
  function platformLen(u) { return TWG.platformLen(u.cls); }
  function platformSpan(u) { return TWG.platformSpan(u.cls); }

  /* 地面部队符号 (北约式) */
  function groundSymbol(ctx, u, sz, col) {
    var r = u.role;
    ctx.lineWidth = 1.3; ctx.strokeStyle = col;
    ctx.fillStyle = 'rgba(10,16,20,0.78)';
    ctx.beginPath(); ctx.rect(-sz, -sz * 0.66, sz * 2, sz * 1.32); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.rect(-sz, -sz * 0.66, sz * 2, sz * 1.32); ctx.clip();
    ctx.strokeStyle = col; ctx.lineWidth = 1.1;
    if (r === 'armor_bde' || r === 'heavy_bde') {
      ctx.beginPath(); ctx.ellipse(0, 0, sz * 0.62, sz * 0.38, 0, 0, TAU); ctx.stroke();
    } else if (r === 'mech_bde' || r === 'amph_bde' || r === 'marine_bde') {
      ctx.beginPath(); ctx.moveTo(-sz * 0.8, -sz * 0.55); ctx.lineTo(sz * 0.8, sz * 0.55);
      ctx.moveTo(sz * 0.8, -sz * 0.55); ctx.lineTo(-sz * 0.8, sz * 0.55); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, sz * 0.5, sz * 0.3, 0, 0, TAU); ctx.stroke();
    } else if (r === 'inf_bde' || r === 'reserve_bde' || r === 'airborne_bde' || r === 'beachhead') {
      ctx.beginPath(); ctx.moveTo(-sz * 0.8, -sz * 0.55); ctx.lineTo(sz * 0.8, sz * 0.55);
      ctx.moveTo(sz * 0.8, -sz * 0.55); ctx.lineTo(-sz * 0.8, sz * 0.55); ctx.stroke();
      if (r === 'airborne_bde') { ctx.beginPath(); ctx.arc(0, -sz * 0.2, sz * 0.35, Math.PI, 0); ctx.stroke(); }
    } else if (r === 'arty_bn') {
      ctx.beginPath(); ctx.arc(0, 0, sz * 0.28, 0, TAU); ctx.fillStyle = col; ctx.fill();
    } else if (r === 'mlrs_bn' || r === 'mlrs_bde') {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(-sz * 0.4, 0, sz * 0.2, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(sz * 0.4, 0, sz * 0.2, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, sz * 0.45); ctx.lineTo(0, -sz * 0.5); ctx.lineTo(sz * 0.22, -sz * 0.2);
      ctx.moveTo(0, -sz * 0.5); ctx.lineTo(-sz * 0.22, -sz * 0.2); ctx.stroke();
    } else if (r === 'srbm_bde' || r === 'hgv_bde' || r === 'lacm_bde' || r === 'lacm_bn' || r === 'asbm_bde') {
      ctx.beginPath(); ctx.moveTo(0, sz * 0.5); ctx.lineTo(0, -sz * 0.5);
      ctx.lineTo(sz * 0.25, -sz * 0.15); ctx.moveTo(0, -sz * 0.5); ctx.lineTo(-sz * 0.25, -sz * 0.15);
      ctx.moveTo(-sz * 0.3, sz * 0.5); ctx.lineTo(sz * 0.3, sz * 0.5); ctx.stroke();
    } else if (r === 'ashm_bn') {
      ctx.beginPath(); ctx.moveTo(-sz * 0.6, sz * 0.35); ctx.lineTo(sz * 0.6, sz * 0.35);
      ctx.moveTo(0, sz * 0.35); ctx.lineTo(0, -sz * 0.45); ctx.lineTo(sz * 0.28, -sz * 0.1);
      ctx.moveTo(0, -sz * 0.45); ctx.lineTo(-sz * 0.28, -sz * 0.1); ctx.stroke();
      ctx.fillStyle = '#69c0ff';
      ctx.beginPath(); ctx.arc(sz * 0.62, -sz * 0.4, sz * 0.14, 0, TAU); ctx.fill();
    } else if (r === 'sof') {
      ctx.beginPath(); ctx.moveTo(-sz * 0.7, sz * 0.5); ctx.lineTo(0, -sz * 0.5); ctx.lineTo(sz * 0.7, sz * 0.5); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(0, 0, sz * 0.35, 0, TAU); ctx.stroke();
    }
    ctx.restore();
    // 旅/营级标识
    ctx.strokeStyle = col; ctx.lineWidth = 1;
    var lvl = /_bde$/.test(r) || r === 'beachhead' ? 3 : /_bn$/.test(r) ? 2 : 1;
    for (var i = 0; i < lvl; i++) {
      var x = (i - (lvl - 1) / 2) * sz * 0.34;
      ctx.beginPath(); ctx.moveTo(x, -sz * 0.72); ctx.lineTo(x, -sz * 0.95); ctx.stroke();
    }
  }
  function samSymbol(ctx, u, sz, col) {
    ctx.lineWidth = 1.3; ctx.strokeStyle = col; ctx.fillStyle = 'rgba(10,16,20,0.78)';
    ctx.beginPath(); ctx.moveTo(-sz, sz * 0.6); ctx.lineTo(0, -sz * 0.85); ctx.lineTo(sz, sz * 0.6);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, sz * 0.35); ctx.lineTo(0, -sz * 0.45);
    ctx.lineTo(sz * 0.2, -sz * 0.15); ctx.moveTo(0, -sz * 0.45); ctx.lineTo(-sz * 0.2, -sz * 0.15); ctx.stroke();
  }
  function radarSymbol(ctx, u, sz, col) {
    ctx.lineWidth = 1.3; ctx.strokeStyle = col; ctx.fillStyle = 'rgba(10,16,20,0.78)';
    ctx.beginPath(); ctx.arc(0, 0, sz * 0.85, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = u.P.ew && u.P.ew.jam ? '#ffd666' : '#95de64'; ctx.lineWidth = 1;
    for (var i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(0, sz * 0.35, sz * 0.3 * i, -2.4, -0.75); ctx.stroke(); }
  }

  /* ======================= 单位绘制 ==================================== */
  Renderer.prototype.unitPx = function (u) {
    // 返回本单位绘制长度(px)
    var L = platformLen(u);
    var mpp = this.mpp();
    var real = L / mpp;
    var mode = this.opts.modelScale;
    if (mode === 'real') return Math.max(2, real);
    if (mode === '1x') return Math.max(6, real);
    // exagg: 保证可辨识的最小尺寸，并按平台大小分级
    var base = u.domain === 'air' ? 15 : u.domain === 'sub' ? 17 : 20;
    if (u.role === 'cv' || u.role === 'lhd' || u.role === 'lha') base = 34;
    else if (u.role === 'lpd' || u.role === 'sealift' || u.role === 'barge') base = 26;
    else if (u.role === 'ddg') base = 24;
    else if (u.role === 'bomber' || u.role === 'aew' || u.role === 'transport') base = 22;
    else if (u.role === 'fac' || u.role === 'militia') base = 14;
    var k = Math.pow(2, this.zoom - 7.2);
    return Math.max(base * 0.55, Math.min(base * k, Math.max(base, real)));
  };
  Renderer.prototype.drawUnits = function () {
    var ctx = this.ctx, E = this.E, self = this;
    var order = { ground: 0, sam: 1, radar: 2, sub: 3, surface: 4, air: 5 };
    var fogSide = (this.opts.fog && this.viewSide) ? this.viewSide : null;
    var known = fogSide ? E.sides[fogSide].tracks : null;
    var list = E.units.filter(function (u) {
      if (u.dead) return false;
      if (u.state === 'mobilizing') return false;
      if (fogSide && u.side !== fogSide) {
        // 战场迷雾：只显示本方已建立航迹的敌方目标
        if (!known[u.uid] && !(u.domain === 'ground' && known['S' + u.uid])) return false;
      }
      var p = self.toScreen(u.lat, u.lon);
      u._sx = p.x; u._sy = p.y;
      return p.x > -60 && p.x < self.W + 60 && p.y > -60 && p.y < self.H + 60;
    });
    list.sort(function (a, b) { return (order[a.domain] || 0) - (order[b.domain] || 0); });

    for (var i = 0; i < list.length; i++) {
      var u = list[i];
      var col = sideCol(u.side), dark = 'rgba(20,28,34,0.9)';
      var sel = this.selected === u;
      ctx.save();
      ctx.translate(u._sx, u._sy);
      // 航迹尾线
      if (this.opts.showTrails && (u.domain === 'air' || u.domain === 'surface' || u.domain === 'sub')) {
        var tr = this.trails.get(u.uid);
        if (tr && tr.length > 1) {
          ctx.save(); ctx.translate(-u._sx, -u._sy);
          ctx.beginPath();
          for (var t = 0; t < tr.length; t++) {
            var sp = this.toScreen(tr[t][0], tr[t][1]);
            if (t === 0) ctx.moveTo(sp.x, sp.y); else ctx.lineTo(sp.x, sp.y);
          }
          ctx.strokeStyle = u.side === 'PLA' ? 'rgba(255,77,79,0.28)' : u.side === 'ROC' ? 'rgba(64,169,255,0.28)' : 'rgba(179,127,235,0.28)';
          ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
        }
      }
      if (u.domain === 'ground' || u.domain === 'sam' || u.domain === 'radar') {
        var sz = u.role === 'beachhead' ? 11 : (u.domain === 'ground' ? 8.5 : 7.5);
        // 放大到一定比例后改用三维实体呈现，低倍率保留北约战术符号(可读性优先)
        var g3 = (this.opts.unitStyle === '3d' && this.bank && this.zoom >= 9.6) ?
          this.drawSprite(u, Math.max(16, this.unitPx(u) * 1.5), true) : false;
        if (!g3) {
          if (u.domain === 'sam') samSymbol(ctx, u, sz, col);
          else if (u.domain === 'radar') radarSymbol(ctx, u, sz, col);
          else groundSymbol(ctx, u, sz, col);
        }
        // 战斗力条
        var frac = u.cp0 > 0 ? Math.max(0, u.cp / u.cp0) : Math.max(0, u.hp / u.hp0);
        if (frac < 0.995) {
          ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-sz, sz + 2, sz * 2, 2.6);
          ctx.fillStyle = frac > 0.6 ? '#95de64' : frac > 0.3 ? '#ffd666' : '#ff4d4f';
          ctx.fillRect(-sz, sz + 2, sz * 2 * frac, 2.6);
        }
        if (u.lastFire > 0 && E.t - u.lastFire < 240) {
          ctx.strokeStyle = '#ffd666'; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.arc(0, 0, sz + 5 + ((E.t - u.lastFire) / 240) * 5, 0, TAU); ctx.stroke();
        }
      } else {
        var Lpx = this.unitPx(u);
        var span = platformSpan(u) / platformLen(u) * Lpx;
        var used3d = false;
        if (this.opts.unitStyle === '3d' && this.bank) used3d = this.drawSprite(u, Lpx, false);
        if (!used3d) {
          ctx.rotate(u.hdg * D2R);
          var mk = modelFor(u), fn = MODELS[mk];
          if (u.domain === 'sub') ctx.globalAlpha = 0.72;
          if (fn) {
            if (u.domain === 'air') fn(ctx, Lpx, Math.max(span, Lpx * 0.5), col);
            else fn(ctx, Lpx, Math.max(span, Lpx * 0.12), u, col, dark);
          } else {
            ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill();
          }
          ctx.globalAlpha = 1;
          ctx.rotate(-u.hdg * D2R);
        }
        // 编队机数 / 受损
        if (u.domain === 'air' && u.n > 1) {
          ctx.fillStyle = col; ctx.font = 'bold 9px ui-monospace,monospace';
          ctx.fillText('×' + u.n, Lpx * 0.45, -Lpx * 0.35);
        }
        var hf = Math.max(0, u.hp / u.hp0);
        if (hf < 0.995) {
          var bw = Math.max(14, Lpx * 0.8);
          ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-bw / 2, Lpx * 0.6 + 3, bw, 2.6);
          ctx.fillStyle = hf > 0.6 ? '#95de64' : hf > 0.3 ? '#ffd666' : '#ff4d4f';
          ctx.fillRect(-bw / 2, Lpx * 0.6 + 3, bw * hf, 2.6);
        }
        if (u.embarked) {   // 载运登陆兵
          ctx.fillStyle = '#ffa940'; ctx.font = 'bold 9px sans-serif';
          ctx.fillText('◼', -Lpx * 0.55, -Lpx * 0.5);
        }
        if (u.lastFire > 0 && E.t - u.lastFire < 120) {
          var pulse = (E.t - u.lastFire) / 120;
          ctx.strokeStyle = 'rgba(255,214,102,' + (1 - pulse) + ')'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.arc(0, 0, Lpx * 0.7 + pulse * 14, 0, TAU); ctx.stroke();
        }
      }
      if (sel) {
        // 选中: 旋转虚线环 + 四角瞄准括号
        var rr = this.unitPx(u) * 0.8 + 10;
        var sa = (Date.now() % 6000) / 6000 * TAU;
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.3;
        ctx.setLineDash([5, 5]); ctx.lineDashOffset = -sa * rr;
        ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = COL.median; ctx.lineWidth = 1.6;
        var b = rr + 4, k = rr * 0.34;
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (q) {
          ctx.beginPath();
          ctx.moveTo(q[0] * b, q[1] * (b - k)); ctx.lineTo(q[0] * b, q[1] * b); ctx.lineTo(q[0] * (b - k), q[1] * b);
          ctx.stroke();
        });
        // 航向指示
        ctx.strokeStyle = 'rgba(255,214,102,0.75)'; ctx.lineWidth = 1;
        var hp = { x: Math.sin(u.hdg * D2R) * (rr + 12), y: -Math.cos(u.hdg * D2R) * (rr + 12) };
        ctx.beginPath(); ctx.moveTo(hp.x * 0.75, hp.y * 0.75); ctx.lineTo(hp.x, hp.y); ctx.stroke();
      }
      // 名称
      if (this.opts.showLabels && (this.zoom > 8 || sel || u.role === 'cv' || u.role === 'lhd' || u.role === 'beachhead')) {
        ctx.fillStyle = 'rgba(240,248,255,0.9)'; ctx.font = '9px sans-serif';
        var nm = u.name.length > 22 ? u.name.slice(0, 21) + '…' : u.name;
        ctx.fillText(nm, 9, -8);
      }
      ctx.restore();
    }
    // 更新航迹历史
    if (this.opts.showTrails && (!this._lastTrail || E.t - this._lastTrail > 240)) {
      this._lastTrail = E.t;
      for (var j = 0; j < E.units.length; j++) {
        var uu = E.units[j];
        if (uu.dead) { this.trails.delete(uu.uid); continue; }
        if (uu.domain !== 'air' && uu.domain !== 'surface' && uu.domain !== 'sub') continue;
        var arr = this.trails.get(uu.uid) || [];
        arr.push([uu.lat, uu.lon]);
        if (arr.length > 26) arr.shift();
        this.trails.set(uu.uid, arr);
      }
    }
  };

  /* ---- 三维精灵绘制 (ctx 已平移到单位位置，未旋转) ---- */
  Renderer.prototype.drawSprite = function (u, Lpx, isGround) {
    var sp = this.bank.get(u.cls, u.hdg);
    if (!sp) return false;
    var ds = Lpx * (sp.pad || 1.14);
    if (ds > sp.px * 2.4) return false;         // 过度放大会模糊 → 回退矢量绘制
    if (ds < 7) return false;                   // 过小 → 用符号
    var ctx = this.ctx, col = sideCol(u.side);
    // 阵营识别底环 + 柔和投影，保证在卫星底图上可辨识
    ctx.save();
    if (this.opts.glow) {
      var r = ds * 0.42;
      var g = ctx.createRadialGradient(0, ds * 0.1, 0, 0, ds * 0.1, r * 1.35);
      g.addColorStop(0, u.side === 'PLA' ? 'rgba(255,77,79,0.30)' : u.side === 'ROC' ? 'rgba(64,169,255,0.30)' : 'rgba(179,127,235,0.28)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(0, ds * 0.1, r * 1.35, r * 0.8, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      ctx.beginPath(); ctx.ellipse(ds * 0.06, ds * 0.13, r * 0.72, r * 0.32, 0, 0, TAU); ctx.fill();
    }
    ctx.imageSmoothingEnabled = true;
    try { ctx.drawImage(sp.img, -ds / 2, -ds / 2, ds, ds); } catch (e) { ctx.restore(); return false; }
    // 阵营色描边(细环)
    ctx.strokeStyle = col; ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, ds * 0.46, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
    if (isGround) {  // 地面单位补一个小兵种标记
      ctx.fillStyle = col; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(-ds * 0.42, -ds * 0.42, 2.6, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    return true;
  };

  /* ======================= 射程包线 ==================================== */
  Renderer.prototype.drawRanges = function () {
    if (!this.opts.showRange) return;
    var ctx = this.ctx, u = this.selected;
    if (!u || u.dead) return;
    var p = this.toScreen(u.lat, u.lon);
    var rings = [];
    if (u.P.radar) rings.push({ r: u.P.radar.range, c: 'rgba(149,222,100,0.5)', t: '雷达 ' + u.P.radar.range + 'km', dash: [4, 4] });
    if (u.P.esm) rings.push({ r: u.P.esm, c: 'rgba(105,192,255,0.4)', t: 'ESM ' + u.P.esm + 'km', dash: [2, 5] });
    if (u.P.sonar) rings.push({ r: u.P.sonar.passive || u.P.sonar.range, c: 'rgba(64,169,255,0.4)', t: '声呐', dash: [1, 4] });
    var seen = {};
    Object.keys(u.ammo).forEach(function (k) {
      var W = TWG.WEAPONS[k];
      if (!W || u.ammo[k] <= 0 || W.type === 'ciws' || seen[W.type + W.range]) return;
      seen[W.type + W.range] = 1;
      var c = W.type === 'sam' ? 'rgba(255,214,102,0.55)' :
        (W.type === 'ashm' || W.type === 'asbm') ? 'rgba(255,77,79,0.55)' :
        W.type === 'aam' ? 'rgba(255,169,64,0.55)' : 'rgba(255,120,200,0.5)';
      rings.push({ r: W.range, c: c, t: W.name + ' ' + W.range + 'km (' + u.ammo[k] + ')', dash: [] });
    });
    rings.sort(function (a, b) { return b.r - a.r; });
    ctx.save();
    rings.forEach(function (g, i) {
      var r = this.kmToPx(g.r);
      if (r < 4 || r > 6000) return;
      ctx.strokeStyle = g.c; ctx.lineWidth = 1.1; ctx.setLineDash(g.dash);
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = g.c; ctx.font = '9px ui-monospace,monospace';
      var ang = -Math.PI / 2 + i * 0.28;
      ctx.fillText(g.t, p.x + Math.cos(ang) * r + 3, p.y + Math.sin(ang) * r);
    }, this);
    // 航路
    if (u.wp && u.wp.length) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(p.x, p.y);
      u.wp.forEach(function (w) { var s = this.toScreen(w.lat, w.lon); ctx.lineTo(s.x, s.y); }, this);
      ctx.stroke(); ctx.setLineDash([]);
      u.wp.forEach(function (w) {
        var s = this.toScreen(w.lat, w.lon);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath(); ctx.arc(s.x, s.y, 2.6, 0, TAU); ctx.fill();
      }, this);
    }
    ctx.restore();
  };

  /* ======================= 情报航迹 ==================================== */
  Renderer.prototype.drawTracks = function (side) {
    if (!this.opts.showTracks) return;
    var ctx = this.ctx, E = this.E;
    var T = E.sides[side].tracks;
    ctx.save();
    Object.keys(T).forEach(function (k) {
      var tr = T[k];
      if (tr.fixed) return;
      var p = this.toScreen(tr.lat, tr.lon);
      if (p.x < 0 || p.x > this.W || p.y < 0 || p.y > this.H) return;
      var col = sideCol(tr.side);
      var sz = 6;
      ctx.strokeStyle = col; ctx.globalAlpha = 0.42 + tr.q * 0.4; ctx.lineWidth = 1;
      ctx.beginPath();
      if (tr.dom === 'air') { ctx.arc(p.x, p.y, sz, Math.PI, 0); }
      else if (tr.dom === 'surface') { ctx.rect(p.x - sz, p.y - sz * 0.7, sz * 2, sz * 1.4); }
      else if (tr.dom === 'sub') { ctx.arc(p.x, p.y, sz, 0, Math.PI); }
      else { ctx.rect(p.x - sz * 0.8, p.y - sz * 0.8, sz * 1.6, sz * 1.6); }
      ctx.stroke();
      // 定位误差椭圆
      if (tr.err > 3) {
        ctx.setLineDash([2, 3]); ctx.globalAlpha = 0.22;
        ctx.beginPath(); ctx.arc(p.x, p.y, this.kmToPx(tr.err), 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.globalAlpha = 1;
    }, this);
    ctx.restore();
  };

  /* ======================= 飞行体 ====================================== */
  Renderer.prototype.drawProjectiles = function () {
    var ctx = this.ctx, E = this.E;
    for (var i = 0; i < E.proj.length; i++) {
      var p = E.proj[i];
      var s = this.toScreen(p.lat, p.lon);
      if (s.x < -40 || s.x > this.W + 40 || s.y < -40 || s.y > this.H + 40) continue;
      var W = p.w;
      var ballistic = W.ballistic || W.type === 'srbm' || W.type === 'mrbm' || W.type === 'irbm' || W.type === 'asbm' || W.type === 'hgv';
      var col = p.side === 'PLA' ? '#ff7875' : p.side === 'ROC' ? '#69c0ff' : '#d3adf7';
      // 弹道轨迹线
      var from = this.toScreen(p.tlat, p.tlon);
      ctx.save();
      if (ballistic) {
        ctx.strokeStyle = 'rgba(255,120,120,0.30)'; ctx.lineWidth = 1;
        ctx.setLineDash([3, 6]);
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(from.x, from.y); ctx.stroke();
        ctx.setLineDash([]);
        // 高空标记
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - 5); ctx.lineTo(s.x + 2.6, s.y + 3); ctx.lineTo(s.x - 2.6, s.y + 3);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.arc(s.x, s.y, 7, 0, TAU); ctx.stroke();
      } else if (W.type === 'torp') {
        ctx.strokeStyle = 'rgba(120,220,255,0.55)'; ctx.lineWidth = 1.2; ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(from.x, from.y); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#69c0ff'; ctx.beginPath(); ctx.arc(s.x, s.y, 2.4, 0, TAU); ctx.fill();
      } else {
        // 巡航/反舰/空空: 掠海细线 + 弹头
        var ang = Math.atan2(from.y - s.y, from.x - s.x);
        ctx.strokeStyle = col; ctx.globalAlpha = 0.55; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - Math.cos(ang) * 13, s.y - Math.sin(ang) * 13); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(ang);
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(4.5, 0); ctx.lineTo(-2.5, 1.8); ctx.lineTo(-2.5, -1.8); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      // 齐射数量
      if (p.n > 1) {
        ctx.fillStyle = col; ctx.font = 'bold 8px ui-monospace,monospace';
        ctx.fillText('×' + p.n, s.x + 6, s.y - 5);
      }
      ctx.restore();
    }
  };

  /* ======================= 毁伤特效 ==================================== */
  Renderer.prototype.addEffect = function (lat, lon, kind) {
    this.effects.push({ lat: lat, lon: lon, kind: kind, t: 0 });
    if (this.effects.length > 220) this.effects.shift();
  };
  Renderer.prototype.drawEffects = function (dtReal) {
    var ctx = this.ctx, keep = [];
    for (var i = 0; i < this.effects.length; i++) {
      var e = this.effects[i];
      e.t += dtReal;
      var life = e.kind === 'kill' ? 1.6 : e.kind === 'intercept' ? 0.9 : 1.2;
      if (e.t > life) continue;
      keep.push(e);
      var p = this.toScreen(e.lat, e.lon);
      var f = e.t / life;
      ctx.save();
      if (e.kind === 'kill' || e.kind === 'hit') {
        var r = 4 + f * (e.kind === 'kill' ? 30 : 18);
        var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, 'rgba(255,240,180,' + (1 - f) * 0.95 + ')');
        g.addColorStop(0.4, 'rgba(255,140,40,' + (1 - f) * 0.7 + ')');
        g.addColorStop(1, 'rgba(120,20,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,200,120,' + (1 - f) * 0.8 + ')'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.15, 0, TAU); ctx.stroke();
      } else if (e.kind === 'intercept') {
        ctx.strokeStyle = 'rgba(150,255,220,' + (1 - f) + ')'; ctx.lineWidth = 1.6;
        for (var k = 0; k < 6; k++) {
          var a = k * Math.PI / 3 + f * 2;
          ctx.beginPath();
          ctx.moveTo(p.x + Math.cos(a) * 3, p.y + Math.sin(a) * 3);
          ctx.lineTo(p.x + Math.cos(a) * (4 + f * 14), p.y + Math.sin(a) * (4 + f * 14));
          ctx.stroke();
        }
      } else if (e.kind === 'strike') {
        ctx.strokeStyle = 'rgba(255,90,60,' + (1 - f) * 0.9 + ')'; ctx.lineWidth = 2;
        var rr = 6 + f * 26;
        ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, TAU); ctx.stroke();
        ctx.fillStyle = 'rgba(255,140,60,' + (1 - f) * 0.25 + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    this.effects = keep;
  };

  /* ======================= HUD ========================================= */
  Renderer.prototype.drawHUD = function () {
    var ctx = this.ctx, E = this.E;
    // 比例尺
    var target = 120, mpp = this.mpp();
    var km = target * mpp / 1000;
    var nice = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
    var pick = nice.reduce(function (a, b) { return Math.abs(b - km) < Math.abs(a - km) ? b : a; }, 1000);
    var px = this.kmToPx(pick);
    ctx.save();
    ctx.strokeStyle = 'rgba(230,240,240,0.85)'; ctx.lineWidth = 1.6;
    var bx = 16, by = this.H - 22;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + px, by);
    ctx.moveTo(bx, by - 4); ctx.lineTo(bx, by + 4);
    ctx.moveTo(bx + px, by - 4); ctx.lineTo(bx + px, by + 4); ctx.stroke();
    ctx.fillStyle = 'rgba(230,240,240,0.9)'; ctx.font = '10px ui-monospace,monospace';
    ctx.fillText(pick + ' km', bx + px / 2 - 14, by - 7);
    // 指北 + 缩放
    ctx.fillText('Z' + this.zoom.toFixed(1) + '  ' + Math.round(mpp) + ' m/px', bx, this.H - 6);
    var nx = this.W - 26, ny = 30;
    ctx.strokeStyle = 'rgba(230,240,240,0.7)';
    ctx.beginPath(); ctx.moveTo(nx, ny + 12); ctx.lineTo(nx, ny - 12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(nx, ny - 14); ctx.lineTo(nx - 4, ny - 6); ctx.lineTo(nx + 4, ny - 6); ctx.closePath();
    ctx.fillStyle = 'rgba(230,240,240,0.85)'; ctx.fill();
    ctx.fillText('N', nx - 3, ny + 24);
    // 昼夜
    if (E.env.night) {
      ctx.fillStyle = 'rgba(10,20,50,0.22)'; ctx.fillRect(0, 0, this.W, this.H);
    }
    // 指挥屏暗角，提升中心区可读性
    if (this.opts.glow) {
      if (!this._vig || this._vigW !== this.W || this._vigH !== this.H) {
        this._vigW = this.W; this._vigH = this.H;
        var g2 = ctx.createRadialGradient(this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.42,
          this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.78);
        g2.addColorStop(0, 'rgba(0,0,0,0)');
        g2.addColorStop(1, 'rgba(0,0,0,0.46)');
        this._vig = g2;
      }
      ctx.fillStyle = this._vig;
      ctx.fillRect(0, 0, this.W, this.H);
    }
    ctx.restore();
  };

  /* ======================= 主绘制 ====================================== */
  Renderer.prototype.draw = function (dtReal) {
    var ctx = this.ctx;
    if (this.bank) this.bank.pump(this.opts.bakeBudget);
    ctx.clearRect(0, 0, this.W, this.H);
    this.drawVectorBase();
    this.drawTiles();
    if (!SOURCES[this.opts.source].offline) {
      // 在栅格底图上叠加海岸线增强
      var G = TWG.GEO;
      ctx.lineWidth = 1.0; ctx.strokeStyle = 'rgba(120,220,255,0.35)';
      for (var i = 0; i < G.taiwan.length; i++) { this.polyPath(G.taiwan[i]); ctx.stroke(); }
      ctx.lineWidth = 0.7; ctx.strokeStyle = 'rgba(255,130,130,0.25)';
      for (var j = 0; j < G.fujian.length; j++) { this.polyPath(G.fujian[j]); ctx.stroke(); }
    }
    this.drawZones();
    this.drawFacilities();
    this.drawRanges();
    if (this.viewSide) this.drawTracks(this.viewSide);
    this.drawUnits();
    this.drawProjectiles();
    this.drawEffects(dtReal || 0.016);
    this.drawHUD();
    this.dirty = false;
  };

  /* ======================= 拾取 ======================================== */
  Renderer.prototype.pick = function (px, py) {
    var E = this.E, best = null, bd = 26;
    for (var i = 0; i < E.units.length; i++) {
      var u = E.units[i];
      if (u.dead || u.state === 'mobilizing') continue;
      var p = this.toScreen(u.lat, u.lon);
      var d = Math.hypot(p.x - px, p.y - py);
      if (d < bd) { bd = d; best = u; }
    }
    if (best) return { kind: 'unit', o: best };
    var bd2 = 16, b2 = null;
    var self = this;
    Object.keys(E.bases).forEach(function (k) {
      var b = E.bases[k], p = self.toScreen(b.lat, b.lon);
      var d = Math.hypot(p.x - px, p.y - py);
      if (d < bd2) { bd2 = d; b2 = { kind: 'base', o: b }; }
    });
    Object.keys(E.sites).forEach(function (k) {
      var s = E.sites[k], p = self.toScreen(s.lat, s.lon);
      var d = Math.hypot(p.x - px, p.y - py);
      if (d < bd2) { bd2 = d; b2 = { kind: 'site', o: s }; }
    });
    return b2;
  };

  Renderer.SOURCES = SOURCES;
  Renderer.COL = COL;
  Renderer.MODELS = MODELS;
  Renderer.SYMBOLS = { ground: groundSymbol, sam: samSymbol, radar: radarSymbol };
  TWG.Renderer = Renderer;
  TWG.modelFor = modelFor;
})(typeof window !== 'undefined' ? window : globalThis);
