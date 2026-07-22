/* ============ 渲染器 ============ */
COC.Renderer = (function () {
  'use strict';
  var U = COC.U, CFG = COC.CFG;

  var canvas, ctx;
  var vw = 0, vh = 0, dpr = 1;
  var groundCan = null, groundKey = '';
  var forbidCan = null, forbidKey = '';
  var gridCan = null;
  var tintCache = {};
  var time = 0;
  var GROUND_SCALE = 1.4;

  /* 环境装饰（村庄外圈的树木） */
  var borderTrees = [];

  function init(cv) {
    canvas = cv;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    buildBorderTrees();
  }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    vw = window.innerWidth; vh = window.innerHeight;
    canvas.width = vw * dpr;
    canvas.height = vh * dpr;
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    COC.Camera.resize(vw, vh);
  }

  function buildBorderTrees() {
    borderTrees = [];
    var N = CFG.MAP;
    var rng = 777;
    function rnd() { rng = (rng * 9301 + 49297) % 233280; return rng / 233280; }
    /* 沿地图菱形外圈布置树 */
    for (var i = 0; i < 90; i++) {
      var edge = i % 4;
      var tpos = rnd() * N;
      var off = 1.2 + rnd() * 3.2;
      var gx, gy;
      if (edge === 0) { gx = tpos; gy = -off; }
      else if (edge === 1) { gx = tpos; gy = N + off; }
      else if (edge === 2) { gx = -off; gy = tpos; }
      else { gx = N + off; gy = tpos; }
      borderTrees.push({
        x: gx, y: gy, img: 'tree' + (1 + Math.floor(rnd() * 4)),
        s: 0.75 + rnd() * 0.5
      });
    }
    borderTrees.sort(function (a, b) { return (a.x + a.y) - (b.x + b.y); });
  }

  /* ---------- 地面缓存 ---------- */
  function ensureGround(key, seed) {
    if (groundKey === key && groundCan) return;
    groundKey = key;
    var N = CFG.MAP;
    var W = N * CFG.TILE_W * GROUND_SCALE;
    var H = N * CFG.TILE_H * GROUND_SCALE + 60 * GROUND_SCALE;
    groundCan = document.createElement('canvas');
    groundCan.width = W; groundCan.height = H;
    var g = groundCan.getContext('2d');

    var rng = seed || 12345;
    function rnd() { rng = (rng * 9301 + 49297) % 233280; return rng / 233280; }

    var HW = CFG.TILE_W / 2 * GROUND_SCALE, HH = CFG.TILE_H / 2 * GROUND_SCALE;
    var ox = W / 2, oy = 20 * GROUND_SCALE;

    /* 崖边（伪高度差） */
    g.fillStyle = '#253f1e';
    g.beginPath();
    g.moveTo(ox, oy - 8 * GROUND_SCALE + 18 * GROUND_SCALE);
    g.lineTo(ox + N * HW + 10, oy + N * HH + 18 * GROUND_SCALE);
    g.lineTo(ox, oy + 2 * N * HH + 26 * GROUND_SCALE);
    g.lineTo(ox - N * HW - 10, oy + N * HH + 18 * GROUND_SCALE);
    g.closePath();
    g.fill();

    /* 草地瓦片：把方形贴图变换成菱形 */
    var s2 = Math.SQRT1_2; /* cos45 */
    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        var r = rnd();
        var img;
        if (r < 0.055) img = COC.Assets.img('grassdeco' + (1 + Math.floor(rnd() * 8)));
        else if (r < 0.09) img = COC.Assets.img('grasspath' + (1 + Math.floor(rnd() * 2)));
        else img = COC.Assets.img(rnd() < 0.5 ? 'grass1' : 'grass2');
        if (!img || !img.naturalWidth) continue;
        var cx = ox + (x - y) * HW;
        var cy = oy + (x + y) * HH + HH;
        /* 菱形变换：旋转45° + 垂直压扁 */
        g.setTransform(s2 * GROUND_SCALE, s2 * 0.5 * GROUND_SCALE, -s2 * GROUND_SCALE, s2 * 0.5 * GROUND_SCALE, cx, cy);
        var half = CFG.TILE_W / Math.SQRT2 / 2;
        g.drawImage(img, -half - 0.7, -half - 0.7, half * 2 + 1.4, half * 2 + 1.4);
      }
    }
    g.setTransform(1, 0, 0, 1, 0, 0);

    /* 边缘描边 */
    g.strokeStyle = 'rgba(30,50,20,0.85)';
    g.lineWidth = 3 * GROUND_SCALE;
    g.beginPath();
    g.moveTo(ox, oy);
    g.lineTo(ox + N * HW, oy + N * HH);
    g.lineTo(ox, oy + 2 * N * HH);
    g.lineTo(ox - N * HW, oy + N * HH);
    g.closePath();
    g.stroke();
  }

  function drawGroundImage() {
    var cam = COC.Camera, z = cam.zoom();
    var N = CFG.MAP;
    var topLeft = cam.toScreen(0, 0);
    var W = groundCan.width / GROUND_SCALE * z;
    var H = groundCan.height / GROUND_SCALE * z;
    var x = topLeft.x - W / 2;
    var y = topLeft.y - 20 * z;
    ctx.drawImage(groundCan, x, y, W, H);
  }

  /* ---------- 禁区遮罩（战斗部署） ---------- */
  function ensureForbid(bt) {
    var key = bt ? bt.uid : '';
    if (forbidKey === key && forbidCan) return;
    forbidKey = key;
    var N = CFG.MAP;
    forbidCan = document.createElement('canvas');
    forbidCan.width = N * CFG.TILE_W;
    forbidCan.height = N * CFG.TILE_H + 40;
    var g = forbidCan.getContext('2d');
    var HW = CFG.TILE_W / 2, HH = CFG.TILE_H / 2;
    var ox = forbidCan.width / 2, oy = 20;
    g.fillStyle = 'rgba(255,60,40,0.16)';
    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        if (!bt.forbid[y * N + x]) continue;
        var cx = ox + (x - y) * HW, cy = oy + (x + y) * HH;
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + HW, cy + HH);
        g.lineTo(cx, cy + 2 * HH);
        g.lineTo(cx - HW, cy + HH);
        g.closePath();
        g.fill();
      }
    }
  }

  function ensureGridOverlay() {
    if (gridCan) return;
    var N = CFG.MAP, B = CFG.BORDER;
    gridCan = document.createElement('canvas');
    gridCan.width = N * CFG.TILE_W;
    gridCan.height = N * CFG.TILE_H + 40;
    var g = gridCan.getContext('2d');
    var HW = CFG.TILE_W / 2, HH = CFG.TILE_H / 2;
    var ox = gridCan.width / 2, oy = 20;
    g.strokeStyle = 'rgba(255,255,255,0.14)';
    g.lineWidth = 1;
    for (var i = B; i <= N - B; i++) {
      g.beginPath();
      g.moveTo(ox + (i - B) * HW, oy + (i + B) * HH);
      g.lineTo(ox + (i - (N - B)) * HW, oy + (i + N - B) * HH);
      g.stroke();
      g.beginPath();
      g.moveTo(ox + (B - i) * HW, oy + (B + i) * HH);
      g.lineTo(ox + ((N - B) - i) * HW, oy + (N - B + i) * HH);
      g.stroke();
    }
  }

  function drawOverlayCanvas(cv) {
    var cam = COC.Camera, z = cam.zoom();
    var topLeft = cam.toScreen(0, 0);
    var W = cv.width * z, H = cv.height * z;
    ctx.drawImage(cv, topLeft.x - W / 2, topLeft.y - 20 * z, W, H);
  }

  /* ---------- 着色精灵缓存 ---------- */
  function tinted(key, color, alpha) {
    var ck = key + '|' + color + '|' + alpha;
    if (tintCache[ck]) return tintCache[ck];
    var img = COC.Assets.img(key);
    if (!img || !img.naturalWidth) return null;
    var cv = document.createElement('canvas');
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    var g = cv.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.fillRect(0, 0, cv.width, cv.height);
    tintCache[ck] = cv;
    return cv;
  }

  /* ---------- 建筑绘制 ---------- */
  function spriteKeyFor(b, def, spr) {
    if (b.type === 'goldmine') {
      if (b.busy || (COC.Mode === 'battle' && b.hp <= 0)) return 'goldmine_0';
      return 'goldmine_' + (Math.floor(time * 10 + (b.anim || 0)) % 17);
    }
    if (b.type === 'archertower') {
      var angle = 2, frame = 0;
      if (COC.Mode === 'battle' && b.weapon) {
        /* aim: 屏幕角度 -> 8 方向精灵。等距空间角度转屏幕角度 */
        var sdx = (Math.cos(b.aim) - Math.sin(b.aim));
        var sdy = (Math.cos(b.aim) + Math.sin(b.aim)) * 0.5;
        var deg = Math.atan2(sdy, sdx) * 180 / Math.PI;
        var oct = Math.round(((deg + 360) % 360) / 45) % 8;
        var map = [3, 4, 5, 6, 7, 8, 1, 2];
        angle = map[oct];
        if (b.fireT > 0) frame = Math.min(4, Math.floor((0.45 - b.fireT) / 0.45 * 5));
      }
      return 'atower_a' + angle + '_' + frame;
    }
    return spr.key;
  }

  function drawBuilding(b, opts) {
    opts = opts || {};
    var cam = COC.Camera, z = cam.zoom();
    var def = COC.BuildingDefs.get(b.type);
    var size = def.size;
    var inBattle = COC.Mode === 'battle';

    if (b.type === 'wall') { drawWall(b, opts); return; }

    if (inBattle && b.hp <= 0) { drawRubble(b); return; }

    var spr = COC.BuildingDefs.spriteFor(b.type, b.lv);
    var key = spriteKeyFor(b, def, spr);
    var img = opts.tint ? tinted(key, opts.tint, 0.45) : COC.Assets.img(key);
    if (!img || !img.width && !img.naturalWidth) return;
    var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;

    var center = cam.toScreen(b.x + size / 2, b.y + size / 2);
    var bottom = cam.toScreen(b.x + size, b.y + size);
    var w = size * CFG.TILE_W * spr.k * z;
    var h = w * ih / iw;
    var x = center.x - w / 2;
    var y = bottom.y - h + h * (spr.oy || 0) - CFG.TILE_H * 0.1 * z;

    /* 受击抖动 */
    if (b.hitT && b.hitT > 0) {
      x += U.randF(-2, 2) * z;
      y += U.randF(-1.5, 1.5) * z;
    }

    ctx.save();
    if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
    /* 施工中：半透明 */
    var busy = b.busy;
    if (busy) ctx.globalAlpha = 0.62;
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();

    /* 施工脚手架效果 & 工人 */
    if (busy && !opts.ghost) {
      drawConstruction(b, center, bottom, w, h, y);
    }

    /* 大本营烟囱烟 */
    if (b.type === 'townhall' && !busy) {
      var sf = Math.floor(time * 9 + (b.anim || 0)) % 8;
      var simg = COC.Assets.img('smoke_' + sf);
      if (simg) {
        var sw = w * 0.16;
        ctx.globalAlpha = 0.85;
        ctx.drawImage(simg, center.x + w * 0.18, y - sw * 0.9, sw, sw * 1.67);
        ctx.globalAlpha = 1;
      }
    }

    /* 法术工厂魔法环粒子感（轻微悬浮标记） */
    if (b.type === 'spellfactory' && !busy && Math.random() < 0.02) {
      COC.FX.hitSpark(b.x + size / 2 + U.randF(-0.6, 0.6), b.y + size / 2 + U.randF(-0.6, 0.6));
    }

    /* 收集气泡 */
    if (!inBattle && def.produces && !busy) {
      var lvd = COC.BuildingDefs.lvl(b.type, b.lv);
      if (b.stored >= Math.max(15, lvd.cap * 0.1)) {
        var bob = Math.sin(time * 3 + b.id) * 4 * z;
        var ic = COC.Assets.img(def.produces === 'gold' ? 'ic_gold' : 'ic_elixir');
        var bw = 30 * z;
        ctx.save();
        ctx.globalAlpha = 0.92;
        ctx.beginPath();
        ctx.arc(center.x, y - 8 * z + bob, bw * 0.72, 0, 6.29);
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(90,70,30,0.5)';
        ctx.lineWidth = 2 * z;
        ctx.stroke();
        if (ic) ctx.drawImage(ic, center.x - bw / 2, y - 8 * z + bob - bw / 2, bw, bw);
        ctx.restore();
      }
    }

    /* 战斗血条 */
    if (inBattle && b.hpShowT > 0 && b.hp < b.maxHp && b.hp > 0) {
      drawBar(center.x, y - 8 * z, 54 * z, 7 * z, b.hp / b.maxHp, '#7ce34c', true);
    }
  }

  function drawConstruction(b, center, bottom, w, h, y) {
    var cam = COC.Camera, z = cam.zoom();
    var busy = b.busy;
    var pct = U.clamp((U.now() - busy.start) / (busy.end - busy.start), 0, 1);
    /* 工人 */
    var bimg = COC.Assets.img('u_builder');
    if (bimg) {
      var t = time * 1.4 + b.id;
      var wx = center.x + Math.sin(t) * w * 0.3;
      var wobble = Math.abs(Math.sin(t * 6)) * 4 * z;
      var uw = 60 * z;
      ctx.save();
      if (Math.cos(t) < 0) { ctx.translate(wx, 0); ctx.scale(-1, 1); ctx.translate(-wx, 0); }
      ctx.drawImage(bimg, wx - uw / 2, bottom.y - uw + 6 * z - wobble, uw, uw);
      ctx.restore();
      /* 敲击火花 */
      if (Math.random() < 0.03) COC.FX.hitSpark(b.x + COC.BuildingDefs.get(b.type).size / 2, b.y + COC.BuildingDefs.get(b.type).size / 2);
    }
    /* 进度条 + 时间 */
    drawBar(center.x, y - 12 * z, 66 * z, 9 * z, pct, '#59c1ff', true);
    var remain = Math.max(0, (busy.end - U.now()) / 1000);
    ctx.font = 'bold ' + Math.max(11, 12 * z) + 'px KenneyFutureNarrow, "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,.6)';
    ctx.strokeText(U.fmtTime(remain), center.x, y - 18 * z);
    ctx.fillStyle = '#fff';
    ctx.fillText(U.fmtTime(remain), center.x, y - 18 * z);
  }

  function drawRubble(b) {
    var cam = COC.Camera, z = cam.zoom();
    var img = COC.Assets.img('rock2');
    if (!img) return;
    var size = b.size;
    var center = cam.toScreen(b.x + size / 2, b.y + size / 2);
    var w = size * CFG.TILE_W * 0.62 * z;
    var h = w * 0.62;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.filter = 'grayscale(60%) brightness(0.75)';
    ctx.drawImage(img, center.x - w / 2, center.y - h * 0.62, w, h);
    ctx.filter = 'none';
    ctx.restore();
  }

  /* ---------- 城墙 ---------- */
  function wallTier(lv) { return lv >= 5 ? 'gold' : (lv >= 3 ? 'stone' : 'wood'); }

  function drawWall(b, opts) {
    var cam = COC.Camera, z = cam.zoom();
    var tier = wallTier(b.lv);
    var inBattle = COC.Mode === 'battle';
    if (inBattle && b.hp <= 0) return;

    var hasE = wallNeighbor(b, 1, 0), hasS = wallNeighbor(b, 0, 1);
    var bottom = cam.toScreen(b.x + 1, b.y + 1);
    var center = cam.toScreen(b.x + 0.5, b.y + 0.5);

    var drawn = false;
    if (hasE) { drawWallPiece(tier, center, bottom, z, false, opts); drawn = true; }
    if (hasS) { drawWallPiece(tier, center, bottom, z, true, opts); drawn = true; }
    if (!drawn) {
      /* 孤立墙桩 */
      var img = tier === 'wood' ? COC.Assets.img('wall_wood_corner2') : tinted('wall_wood_corner2', tier === 'gold' ? '#e8b923' : '#9aa7b5', 0.5);
      if (img) {
        var w = CFG.TILE_W * 0.72 * z;
        var h = w * ((img.naturalHeight || img.height) / (img.naturalWidth || img.width));
        ctx.save();
        if (opts && opts.alpha) ctx.globalAlpha = opts.alpha;
        ctx.drawImage(img, center.x - w / 2, bottom.y - h + h * 0.06, w, h);
        ctx.restore();
      }
    }
    if (inBattle && b.hpShowT > 0 && b.hp < b.maxHp) {
      drawBar(center.x, bottom.y - 40 * z, 30 * z, 5 * z, b.hp / b.maxHp, '#7ce34c', true);
    }
  }

  function wallNeighbor(b, dx, dy) {
    if (COC.Mode === 'battle') {
      var bt = COC.Battle.state();
      if (!bt) return false;
      var N = CFG.MAP;
      var idx = (b.y + dy) * N + (b.x + dx);
      var w = bt.wallByCell[idx];
      return w && w.hp > 0;
    }
    var nb = COC.Village.buildingAt(b.x + dx, b.y + dy);
    return nb && nb.type === 'wall';
  }

  function drawWallPiece(tier, center, bottom, z, mirror, opts) {
    var key = 'wall_' + tier + '_straight';
    var img = COC.Assets.img(key);
    if (!img || !img.naturalWidth) return;
    var w = CFG.TILE_W * 1.06 * z;
    var h = w * img.naturalHeight / img.naturalWidth;
    /* 素材过高时压制高度 */
    var maxH = CFG.TILE_H * 2.6 * z;
    if (h > maxH) h = maxH;
    ctx.save();
    if (opts && opts.alpha) ctx.globalAlpha = opts.alpha;
    var cx = center.x + (mirror ? -CFG.TILE_W * 0.25 : CFG.TILE_W * 0.25) * z;
    var cy = bottom.y + (CFG.TILE_H * 0.0) * z;
    ctx.translate(cx, cy);
    if (mirror) ctx.scale(-1, 1);
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
  }

  /* ---------- 通用血条 ---------- */
  function drawBar(cx, cy, w, h, pct, color, outline) {
    ctx.save();
    ctx.fillStyle = 'rgba(20,14,8,0.8)';
    roundRect(cx - w / 2, cy - h / 2, w, h, h / 2);
    ctx.fill();
    var p = U.clamp(pct, 0, 1);
    if (p > 0.001) {
      ctx.fillStyle = p > 0.5 ? color : (p > 0.25 ? '#ffcf3e' : '#ff5340');
      roundRect(cx - w / 2 + 1.5, cy - h / 2 + 1.5, (w - 3) * p, h - 3, (h - 3) / 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    if (r < 0) r = 0;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------- 障碍物 ---------- */
  function drawObstacle(o) {
    var cam = COC.Camera, z = cam.zoom();
    var def = COC.BuildingDefs.OBSTACLES[o.kind];
    var img = COC.Assets.img(def.key);
    if (!img) return;
    var size = def.size;
    var center = cam.toScreen(o.x + size / 2, o.y + size / 2);
    var bottom = cam.toScreen(o.x + size, o.y + size);
    var w = size * CFG.TILE_W * def.k * z;
    var h = w * img.naturalHeight / img.naturalWidth;
    var sway = o.kind.indexOf('tree') === 0 ? Math.sin(time * 1.5 + o.id) * 0.02 : 0;
    ctx.save();
    ctx.translate(center.x, bottom.y);
    ctx.rotate(sway);
    ctx.drawImage(img, -w / 2, -h + h * (def.oy || 0) - CFG.TILE_H * 0.15 * z, w, h);
    ctx.restore();
    if (o.clearing) {
      var pct = U.clamp((U.now() - o.clearing.start) / (o.clearing.end - o.clearing.start), 0, 1);
      drawBar(center.x, bottom.y - h - 8 * z, 50 * z, 8 * z, pct, '#59c1ff', true);
      var bimg = COC.Assets.img('u_builder');
      if (bimg) {
        var uw = 56 * z;
        var wob = Math.abs(Math.sin(time * 8)) * 3 * z;
        ctx.drawImage(bimg, center.x + w * 0.3, bottom.y - uw - wob, uw, uw);
      }
    }
  }

  /* ---------- 部队 ---------- */
  function drawTroop(t) {
    var cam = COC.Camera, z = cam.zoom();
    var p = cam.toScreen(t.x, t.y);
    var alpha = 1;
    if (t.dead) {
      alpha = Math.max(0, 1 - t.deathT * 1.8);
      if (alpha <= 0) return;
    }
    var img = COC.Assets.img('u_' + t.type);
    if (!img) return;
    var w = 84 * z * (t.scale || 1);
    var bob = t.moving ? Math.abs(Math.sin(t.bob)) * 4 * z : 0;

    ctx.save();
    ctx.globalAlpha = alpha * 0.35;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, w * 0.18, w * 0.09, 0, 0, 6.29);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.globalAlpha = alpha;
    if (t.hitT && t.hitT > 0) { ctx.translate(U.randF(-1.5, 1.5) * z, 0); t.hitT -= 0.016; }
    ctx.translate(p.x, p.y - bob);
    if (t.facing < 0) ctx.scale(-1, 1);
    ctx.drawImage(img, -w / 2, -w * 0.86, w, w);
    ctx.restore();

    if (!t.dead && t.hp < t.maxHp) {
      drawBar(p.x, p.y - w * 0.92, 30 * z, 4.5 * z, t.hp / t.maxHp, '#7ce34c', false);
    }
  }

  /* ---------- 投射物 ---------- */
  var PROJ_IMG = {
    cannonball: { key: 'p_circle_05', w: 15, spin: false, dark: true },
    bolt: { key: 'p_trace_06', w: 34, rot: true },
    arrow: { key: 'p_trace_02', w: 26, rot: true },
    shell: { key: 'p_circle_05', w: 18, dark: true, trail: true },
    orb: { key: 'p_magic_01', w: 30, spin: true },
    fireball: { key: 'p_flame_05', w: 26, rot: true }
  };

  function drawProjectile(p) {
    var cam = COC.Camera, z = cam.zoom();
    var def = PROJ_IMG[p.kind] || PROJ_IMG.cannonball;
    var img = COC.Assets.img(def.key);
    if (!img) return;
    var sp = cam.toScreen(p.x, p.y);
    var y = sp.y - (p.z || 0) * z * 0.6;
    var w = def.w * z;
    ctx.save();
    /* 影子 */
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.ellipse(sp.x, sp.y, w * 0.3, w * 0.14, 0, 0, 6.29);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.translate(sp.x, y);
    if (def.rot) {
      /* 等距空间方向 -> 屏幕方向 */
      var sdx = Math.cos(p.dir) - Math.sin(p.dir);
      var sdy = (Math.cos(p.dir) + Math.sin(p.dir)) * 0.5;
      ctx.rotate(Math.atan2(sdy, sdx));
    } else if (def.spin) {
      ctx.rotate(time * 8);
    }
    if (def.dark) ctx.filter = 'brightness(0.28)';
    ctx.drawImage(img, -w / 2, -w / 2, w, w);
    ctx.restore();
    if (def.trail && Math.random() < 0.5) {
      COC.FX.hitSpark(p.x, p.y);
    }
  }

  /* ---------- 选中效果 ---------- */
  function drawSelection(b, valid) {
    var cam = COC.Camera, z = cam.zoom();
    var size = COC.BuildingDefs.get(b.type).size;
    var pulse = 0.75 + Math.sin(time * 5) * 0.25;
    outlineDiamond(b.x, b.y, size, valid === false ? 'rgba(255,80,60,' + pulse + ')' : 'rgba(255,255,255,' + pulse + ')', 3 * z);
  }

  function outlineDiamond(gx, gy, size, style, lw) {
    var cam = COC.Camera;
    var p1 = cam.toScreen(gx, gy), p2 = cam.toScreen(gx + size, gy),
        p3 = cam.toScreen(gx + size, gy + size), p4 = cam.toScreen(gx, gy + size);
    ctx.save();
    ctx.strokeStyle = style;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  function fillCells(gx, gy, size, okFn) {
    var cam = COC.Camera;
    for (var dy = 0; dy < size; dy++) {
      for (var dx = 0; dx < size; dx++) {
        var ok = okFn(gx + dx, gy + dy);
        var p1 = cam.toScreen(gx + dx, gy + dy), p2 = cam.toScreen(gx + dx + 1, gy + dy),
            p3 = cam.toScreen(gx + dx + 1, gy + dy + 1), p4 = cam.toScreen(gx + dx, gy + dy + 1);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y);
        ctx.closePath();
        ctx.fillStyle = ok ? 'rgba(110,230,90,0.4)' : 'rgba(255,70,50,0.45)';
        ctx.fill();
      }
    }
  }

  function drawRange(b) {
    var cam = COC.Camera, z = cam.zoom();
    var def = COC.BuildingDefs.get(b.type);
    if (!def.weapon) return;
    var lvd = COC.BuildingDefs.lvl(b.type, b.lv);
    var c = cam.toScreen(b.x + def.size / 2, b.y + def.size / 2);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, lvd.range * CFG.TILE_W / 2 * z, lvd.range * CFG.TILE_H / 2 * z, 0, 0, 6.29);
    ctx.fill();
    ctx.stroke();
    if (lvd.minRange) {
      ctx.strokeStyle = 'rgba(255,90,60,0.6)';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, lvd.minRange * CFG.TILE_W / 2 * z, lvd.minRange * CFG.TILE_H / 2 * z, 0, 0, 6.29);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- 环境树 ---------- */
  function drawBorderTrees() {
    var cam = COC.Camera, z = cam.zoom();
    for (var i = 0; i < borderTrees.length; i++) {
      var t = borderTrees[i];
      var img = COC.Assets.img(t.img);
      if (!img) continue;
      var p = cam.toScreen(t.x, t.y);
      if (p.x < -120 || p.x > vw + 120 || p.y < -160 || p.y > vh + 120) continue;
      var w = CFG.TILE_W * 1.15 * t.s * z;
      var h = w * img.naturalHeight / img.naturalWidth;
      var sway = Math.sin(time * 1.2 + i) * 0.02;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(sway);
      ctx.drawImage(img, -w / 2, -h, w, h);
      ctx.restore();
    }
  }

  /* ---------- 村庄氛围：驻地部队 & 闲逛村民 ---------- */
  var ambient = [];
  var ambientInit = false;

  function drawSimpleUnit(key, gx, gy, scaleMul, bob, flip) {
    var cam = COC.Camera, z = cam.zoom();
    var img = COC.Assets.img(key);
    if (!img) return;
    var p = cam.toScreen(gx, gy);
    var w = 76 * z * (scaleMul || 1);
    ctx.save();
    ctx.globalAlpha = 0.32;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, w * 0.17, w * 0.085, 0, 0, 6.29);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.translate(p.x, p.y - (bob || 0) * z);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(img, -w / 2, -w * 0.86, w, w);
    ctx.restore();
  }

  function initAmbient(S) {
    ambient = [];
    var th = null;
    for (var i = 0; i < S.buildings.length; i++) if (S.buildings[i].type === 'townhall') th = S.buildings[i];
    var ax = th ? th.x + 2 : CFG.MAP / 2, ay = th ? th.y + 2 : CFG.MAP / 2;
    for (var k = 0; k < 3; k++) {
      ambient.push({
        img: k === 0 ? 'u_villager' : (k === 1 ? 'u_knight' : 'u_villager'),
        ax: ax, ay: ay, x: ax + U.randF(-6, 6), y: ay + U.randF(-6, 6),
        tx: ax, ty: ay, wait: U.randF(0, 3)
      });
    }
    ambientInit = true;
  }

  function updateAmbient(dt, S) {
    if (!ambientInit) initAmbient(S);
    for (var i = 0; i < ambient.length; i++) {
      var a = ambient[i];
      if (a.wait > 0) { a.wait -= dt; continue; }
      var dx = a.tx - a.x, dy = a.ty - a.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < 0.15) {
        /* 找新目标（必须是空地） */
        for (var tr = 0; tr < 8; tr++) {
          var nx = a.ax + U.randF(-8, 8), ny = a.ay + U.randF(-8, 8);
          var gx = Math.floor(nx), gy = Math.floor(ny);
          if (gx > CFG.BORDER && gy > CFG.BORDER && gx < CFG.MAP - CFG.BORDER && gy < CFG.MAP - CFG.BORDER &&
              !COC.Village.occupiedBy(gx, gy)) {
            a.tx = nx; a.ty = ny;
            break;
          }
        }
        a.wait = U.randF(1, 4);
      } else {
        var sp = 0.8 * dt;
        a.x += dx / d * sp;
        a.y += dy / d * sp;
        a.flip = (dx - dy) < 0;
        a.moving = true;
      }
    }
  }

  function pushAmbient(drawList) {
    for (var i = 0; i < ambient.length; i++) {
      var a = ambient[i];
      (function (aa) {
        drawList.push({
          d: aa.x + aa.y + 0.2,
          fn: function () {
            var bob = aa.wait <= 0 ? Math.abs(Math.sin(time * 9 + aa.x)) * 3 : 0;
            drawSimpleUnit(aa.img, aa.x, aa.y, 0.9, bob, aa.flip);
          }
        });
      })(a);
    }
  }

  var CAMP_OFFS = [[-0.95, -0.35], [0.75, -0.7], [-0.35, 0.85], [0.95, 0.65], [0.1, -1.0], [-1.0, 0.3]];
  function pushCampTroops(drawList, S) {
    var entries = [];
    for (var t in S.army) {
      var n = Math.min(S.army[t], 3);
      for (var k = 0; k < n && entries.length < 6; k++) entries.push(t);
    }
    if (!entries.length) return;
    var ei = 0;
    for (var i = 0; i < S.buildings.length; i++) {
      var b = S.buildings[i];
      if (b.type !== 'armycamp' || b.busy) continue;
      var cx = b.x + 2, cy = b.y + 2;
      for (var j = 0; j < CAMP_OFFS.length && ei < entries.length; j++, ei++) {
        (function (tid, gx, gy, seed) {
          var def = COC.TroopDefs.get(tid);
          drawList.push({
            d: gx + gy + 0.25,
            fn: function () {
              var bob = Math.abs(Math.sin(time * 2.2 + seed)) * 1.6;
              drawSimpleUnit(def.icon, gx, gy, (def.scale || 1) * 0.92, bob, seed % 2 === 0);
            }
          });
        })(entries[ei], cx + CAMP_OFFS[j][0], cy + CAMP_OFFS[j][1], i * 7 + j);
      }
      if (ei >= entries.length) break;
    }
  }

  /* ---------- 主渲染 ---------- */
  function render(dt) {
    time += dt;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    /* 背景 */
    ctx.fillStyle = COC.Mode === 'battle' ? '#31441f' : '#33511f';
    ctx.fillRect(0, 0, vw, vh);

    var UIS = COC.UIState;
    var inBattle = COC.Mode === 'battle';
    var bt = COC.Battle.state();

    if (inBattle && bt) ensureGround('battle_' + bt.uid, bt.seed);
    else ensureGround('home', 424242);
    drawGroundImage();

    /* 部署禁区 */
    if (inBattle && bt && !bt.ended && (bt.selectedTroop || bt.phase === 'scout')) {
      ensureForbid(bt);
      drawOverlayCanvas(forbidCan);
    }

    /* 放置网格 */
    if (!inBattle && (UIS.placing || UIS.dragging)) {
      ensureGridOverlay();
      drawOverlayCanvas(gridCan);
    }

    COC.FX.drawGround(ctx);

    /* ---- 深度排序绘制 ---- */
    var drawList = [];
    var i, b;

    if (inBattle && bt) {
      for (i = 0; i < bt.buildings.length; i++) {
        b = bt.buildings[i];
        if (b.hpShowT > 0) b.hpShowT -= dt;
        drawList.push({ d: (b.x + b.size + b.y + b.size), fn: drawBuilding.bind(null, b, null) });
      }
      for (i = 0; i < bt.troops.length; i++) {
        var t = bt.troops[i];
        if (t.dead && t.deathT > 0.8) continue;
        drawList.push({ d: t.x + t.y + 0.3, fn: drawTroop.bind(null, t) });
      }
      for (i = 0; i < bt.projectiles.length; i++) {
        drawList.push({ d: bt.projectiles[i].x + bt.projectiles[i].y + 6, fn: drawProjectile.bind(null, bt.projectiles[i]) });
      }
    } else {
      var S = COC.State.get();
      updateAmbient(dt, S);
      for (i = 0; i < S.buildings.length; i++) {
        b = S.buildings[i];
        if (UIS.dragging && UIS.dragging.b === b) continue;
        var size = COC.BuildingDefs.get(b.type).size;
        drawList.push({ d: b.x + b.y + size * 2, fn: drawBuilding.bind(null, b, null) });
      }
      for (i = 0; i < S.obstacles.length; i++) {
        var o = S.obstacles[i];
        var osz = COC.BuildingDefs.OBSTACLES[o.kind].size;
        drawList.push({ d: o.x + o.y + osz * 2, fn: drawObstacle.bind(null, o) });
      }
      pushCampTroops(drawList, S);
      pushAmbient(drawList);
    }

    drawList.sort(function (a, c) { return a.d - c.d; });

    /* 选中建筑的范围圈（画在建筑下面） */
    if (!inBattle && UIS.selected && !UIS.dragging) drawRange(UIS.selected);

    for (i = 0; i < drawList.length; i++) drawList[i].fn();

    /* 边界树 */
    drawBorderTrees();

    /* 选中高亮 */
    if (!inBattle && UIS.selected && !UIS.dragging) drawSelection(UIS.selected);

    /* 拖动中的建筑 */
    if (!inBattle && UIS.dragging) {
      var d = UIS.dragging;
      var ok = COC.Village.canPlace(d.x, d.y, COC.BuildingDefs.get(d.b.type).size, d.b.id);
      fillCells(d.x, d.y, COC.BuildingDefs.get(d.b.type).size, function (gx, gy) {
        return !COC.Village.occupiedBy(gx, gy, d.b.id) && COC.Village.inBuildArea(gx, gy, 1);
      });
      var ghost = { type: d.b.type, lv: d.b.lv, x: d.x, y: d.y, id: d.b.id, busy: d.b.busy, stored: 0, anim: 0 };
      drawBuilding(ghost, { alpha: 0.75, ghost: true, tint: ok ? null : '#ff5040' });
      outlineDiamond(d.x, d.y, COC.BuildingDefs.get(d.b.type).size, ok ? 'rgba(120,255,120,0.9)' : 'rgba(255,60,40,0.9)', 3);
    }

    /* 新建放置 */
    if (!inBattle && UIS.placing) {
      var pl = UIS.placing;
      var psize = COC.BuildingDefs.get(pl.type).size;
      var pok = COC.Village.canPlace(pl.x, pl.y, psize);
      fillCells(pl.x, pl.y, psize, function (gx, gy) {
        return !COC.Village.occupiedBy(gx, gy) && COC.Village.inBuildArea(gx, gy, 1);
      });
      var pghost = { type: pl.type, lv: 1, x: pl.x, y: pl.y, id: -1, busy: null, stored: 0, anim: 0 };
      drawBuilding(pghost, { alpha: 0.75, ghost: true, tint: pok ? null : '#ff5040' });
      outlineDiamond(pl.x, pl.y, psize, pok ? 'rgba(120,255,120,0.9)' : 'rgba(255,60,40,0.9)', 3);
    }

    /* 战斗部署预览 */
    if (inBattle && bt && !bt.ended && bt.selectedTroop && UIS.pointer) {
      var g = COC.Camera.toGrid(UIS.pointer.x, UIS.pointer.y);
      var gx2 = Math.floor(g.x), gy2 = Math.floor(g.y);
      if (gx2 >= 0 && gy2 >= 0 && gx2 < CFG.MAP && gy2 < CFG.MAP) {
        var can = COC.Battle.canDeployAt(gx2, gy2);
        outlineDiamond(gx2, gy2, 1, can ? 'rgba(120,255,120,0.85)' : 'rgba(255,60,40,0.85)', 2);
      }
    }

    /* 世界特效 & 屏幕特效 */
    COC.FX.drawWorld(ctx);
    COC.FX.drawScreen(ctx, vw, vh);
  }

  return {
    init: init, render: render, resize: resize,
    invalidateGround: function () { groundKey = ''; forbidKey = ''; },
    viewSize: function () { return { w: vw, h: vh }; }
  };
})();
