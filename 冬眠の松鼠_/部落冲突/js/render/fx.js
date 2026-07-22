/* ============ 特效系统：图集动画/粒子/飘字/装饰 ============ */
COC.FX = (function () {
  'use strict';
  var U = COC.U, CFG = COC.CFG;

  var anims = [];     /* 图集动画 {sheet,x,y,w,fps,frame,loop,layer} */
  var parts = [];     /* 粒子 */
  var texts = [];     /* 飘字 */
  var decals = [];    /* 地面焦痕 */
  var screenFx = [];  /* 屏幕空间特效 */
  var bolts = [];     /* 雷电 */

  function clear() { anims = []; parts = []; texts = []; decals = []; screenFx = []; bolts = []; }

  /* ---------- 生成器 ---------- */
  function explosion(gx, gy, sizeTiles, kind) {
    anims.push({
      sheet: 'expl_' + (kind || 'a'), x: gx, y: gy,
      w: sizeTiles * CFG.TILE_W * 2.2, fps: 30, frame: 0, loop: false, layer: 'world', dy: -10
    });
    for (var i = 0; i < 6; i++) {
      spawnPart('p_smoke_0' + U.randInt(1, 5), gx + U.randF(-0.5, 0.5) * sizeTiles, gy + U.randF(-0.5, 0.5) * sizeTiles, {
        vz: U.randF(18, 40), life: U.randF(0.8, 1.6), scale: U.randF(0.28, 0.5) * sizeTiles, alpha: 0.55, grow: 1.4
      });
    }
  }

  function smallBlast(gx, gy, color) {
    for (var i = 0; i < 7; i++) {
      spawnPart('p_spark_0' + U.randInt(1, 7), gx, gy, {
        vx: U.randF(-1.6, 1.6), vy: U.randF(-1.6, 1.6), vz: U.randF(10, 55),
        life: U.randF(0.25, 0.55), scale: U.randF(0.07, 0.15), tint: color, additive: true
      });
    }
    spawnPart('p_muzzle_0' + U.randInt(1, 3), gx, gy, {
      life: 0.14, scale: 0.4, additive: true, z: 12
    });
  }

  function hitSpark(gx, gy) {
    for (var i = 0; i < 3; i++) {
      spawnPart('p_spark_0' + U.randInt(1, 7), gx, gy, {
        vx: U.randF(-1, 1), vy: U.randF(-1, 1), vz: U.randF(15, 40),
        life: U.randF(0.18, 0.36), scale: U.randF(0.05, 0.1), additive: true, z: 14
      });
    }
  }

  function muzzle(gx, gy, z) {
    spawnPart('p_muzzle_0' + U.randInt(1, 3), gx, gy, { life: 0.12, scale: 0.5, additive: true, z: z || 20 });
    spawnPart('p_smoke_0' + U.randInt(1, 5), gx, gy, { vz: 22, life: 0.6, scale: 0.22, alpha: 0.45, z: z || 20, grow: 1.5 });
  }

  function poof(gx, gy, size) {
    anims.push({ sheet: 'poof', x: gx, y: gy, w: (size || 0.5) * CFG.TILE_W * 2.4, fps: 34, frame: 0, loop: false, layer: 'world', dy: -6 });
  }

  function scorch(gx, gy, sizeTiles) {
    decals.push({ img: 'p_scorch_0' + U.randInt(1, 3), x: gx, y: gy, w: sizeTiles * CFG.TILE_W * 0.9, alpha: 0.75, rot: U.randF(0, 6.28) });
  }

  function lightning(gx, gy) {
    bolts.push({ x: gx, y: gy, t: 0, life: 0.45, segs: buildBolt() });
    spawnPart('p_flare_01', gx, gy, { life: 0.3, scale: 0.9, additive: true, z: 6 });
    anims.push({ sheet: 'expl_b', x: gx, y: gy, w: CFG.TILE_W * 2.4, fps: 34, frame: 0, loop: false, layer: 'world', dy: -8 });
  }

  function buildBolt() {
    var segs = [], x = 0;
    var h = 320;
    for (var y = -h; y < 0; y += 26) {
      segs.push({ x: x, y: y });
      x += U.randF(-16, 16);
    }
    segs.push({ x: 0, y: 0 });
    return segs;
  }

  function badSpot(gx, gy) {
    texts.push({ str: '✕ 无法部署', x: gx, y: gy, color: '#ff5544', life: 0.9, t: 0, size: 15 });
  }

  function collectBurst(b, res, amount) {
    var def = COC.BuildingDefs.get(b.type);
    var cx = b.x + def.size / 2, cy = b.y + def.size / 2;
    texts.push({ str: '+' + U.fmt(amount), x: cx, y: cy - 0.5, color: res === 'gold' ? '#ffd763' : '#f06ae4', life: 1.3, t: 0, size: 17, icon: 'ic_' + res });
    for (var i = 0; i < 5; i++) {
      spawnPart(res === 'gold' ? 'p_star_08' : 'p_star_07', cx, cy, {
        vx: U.randF(-1.4, 1.4), vy: U.randF(-1.4, 1.4), vz: U.randF(30, 70),
        life: U.randF(0.4, 0.7), scale: 0.1, additive: true, tint: res === 'gold' ? '#ffd763' : '#f06ae4'
      });
    }
  }

  function floatText(gx, gy, str, color, size) {
    texts.push({ str: str, x: gx, y: gy, color: color || '#fff', life: 1.2, t: 0, size: size || 15 });
  }

  function buildDone(b) {
    var def = COC.BuildingDefs.get(b.type);
    var cx = b.x + def.size / 2, cy = b.y + def.size / 2;
    poof(cx, cy, def.size * 0.4);
    for (var i = 0; i < 8; i++) {
      spawnPart('p_star_0' + U.randInt(4, 9), cx + U.randF(-0.8, 0.8), cy + U.randF(-0.8, 0.8), {
        vz: U.randF(25, 60), life: U.randF(0.5, 0.9), scale: U.randF(0.1, 0.18), additive: true, tint: '#ffe08a'
      });
    }
  }

  function starBurst() {
    screenFx.push({ sheet: 'starfx', t: 0, fps: 30, frame: 0, x: 0.5, y: 0.32, w: 340 });
  }

  function fireworks() {
    for (var i = 0; i < 5; i++) {
      screenFx.push({
        sheet: 'firework', t: -i * 0.35, fps: 26, frame: 0,
        x: U.randF(0.2, 0.8), y: U.randF(0.15, 0.45), w: U.randF(260, 420)
      });
    }
  }

  function spawnPart(img, gx, gy, o) {
    parts.push({
      img: img, x: gx, y: gy,
      vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0,
      z: o.z || 0, g: o.g !== undefined ? o.g : (o.vz ? -80 : 0),
      life: o.life || 0.5, t: 0,
      scale: o.scale || 0.2, grow: o.grow || 1,
      alpha: o.alpha !== undefined ? o.alpha : 1,
      rot: o.rot || U.randF(0, 6.28), vr: o.vr || U.randF(-2, 2),
      additive: !!o.additive, tint: o.tint || null
    });
  }

  /* ---------- 更新 ---------- */
  function update(dt) {
    var i;
    for (i = anims.length - 1; i >= 0; i--) {
      var a = anims[i];
      a.frame += dt * a.fps;
      var total = COC.Assets.sheet(a.sheet).frames;
      if (a.frame >= total) { if (a.loop) a.frame = 0; else anims.splice(i, 1); }
    }
    for (i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.t += dt;
      if (p.t >= p.life) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.z += p.vz * dt; p.vz += p.g * dt;
      p.rot += p.vr * dt;
    }
    for (i = texts.length - 1; i >= 0; i--) {
      var tx = texts[i];
      tx.t += dt;
      if (tx.t >= tx.life) texts.splice(i, 1);
    }
    for (i = bolts.length - 1; i >= 0; i--) {
      bolts[i].t += dt;
      if (bolts[i].t >= bolts[i].life) bolts.splice(i, 1);
    }
    for (i = screenFx.length - 1; i >= 0; i--) {
      var s = screenFx[i];
      s.t += dt;
      if (s.t > 0) {
        s.frame += dt * s.fps;
        if (s.frame >= COC.Assets.sheet(s.sheet).frames) screenFx.splice(i, 1);
      }
    }
    for (i = decals.length - 1; i >= 0; i--) {
      /* 战斗焦痕淡出 */
      if (COC.Mode === 'home') { decals.splice(i, 1); }
    }
  }

  /* ---------- 绘制（由 renderer 调用） ---------- */
  function drawGround(ctx) {
    var cam = COC.Camera;
    for (var i = 0; i < decals.length; i++) {
      var d = decals[i];
      var img = COC.Assets.img(d.img);
      if (!img) continue;
      var p = cam.toScreen(d.x, d.y);
      var w = d.w * cam.zoom();
      ctx.save();
      ctx.globalAlpha = d.alpha;
      ctx.translate(p.x, p.y);
      ctx.scale(1, 0.55);
      ctx.rotate(d.rot);
      ctx.drawImage(img, -w / 2, -w / 2, w, w);
      ctx.restore();
    }
  }

  function drawWorld(ctx) {
    var cam = COC.Camera, z = cam.zoom(), i;

    /* 图集动画 */
    for (i = 0; i < anims.length; i++) {
      var a = anims[i];
      var sh = COC.Assets.sheet(a.sheet);
      var img = COC.Assets.img(a.sheet);
      if (!img || !img.naturalWidth) continue;
      var fw = img.naturalWidth / sh.cols, fh = img.naturalHeight / sh.rows;
      var f = Math.min(sh.frames - 1, Math.floor(a.frame));
      var sx = (f % sh.cols) * fw, sy = Math.floor(f / sh.cols) * fh;
      var p = cam.toScreen(a.x, a.y);
      var w = a.w * z, h = w * fh / fw;
      ctx.drawImage(img, sx, sy, fw, fh, p.x - w / 2, p.y - h * 0.72 + (a.dy || 0) * z, w, h);
    }

    /* 粒子 */
    for (i = 0; i < parts.length; i++) {
      var pt = parts[i];
      var pimg = COC.Assets.img(pt.img);
      if (!pimg || !pimg.naturalWidth) continue;
      var pp = cam.toScreen(pt.x, pt.y);
      var lifeK = 1 - pt.t / pt.life;
      var w2 = pt.scale * CFG.TILE_W * 2 * z * (1 + (pt.grow - 1) * (pt.t / pt.life));
      ctx.save();
      ctx.globalAlpha = pt.alpha * lifeK;
      if (pt.additive) ctx.globalCompositeOperation = 'lighter';
      ctx.translate(pp.x, pp.y - pt.z * z * 0.5);
      ctx.rotate(pt.rot);
      ctx.drawImage(pimg, -w2 / 2, -w2 / 2, w2, w2);
      ctx.restore();
    }

    /* 雷电 */
    for (i = 0; i < bolts.length; i++) {
      var b = bolts[i];
      var bp = cam.toScreen(b.x, b.y);
      var k = 1 - b.t / b.life;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(190,230,255,' + (0.9 * k) + ')';
      ctx.lineWidth = 4 * z * k + 1;
      ctx.beginPath();
      for (var s = 0; s < b.segs.length; s++) {
        var seg = b.segs[s];
        var x = bp.x + seg.x * z, y = bp.y + seg.y * z;
        if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.9 * k) + ')';
      ctx.lineWidth = 1.6 * z;
      ctx.stroke();
      ctx.restore();
    }

    /* 飘字 */
    for (i = 0; i < texts.length; i++) {
      var t = texts[i];
      var tp = cam.toScreen(t.x, t.y);
      var kk = t.t / t.life;
      ctx.save();
      ctx.globalAlpha = kk < 0.7 ? 1 : 1 - (kk - 0.7) / 0.3;
      var fs = t.size * Math.max(0.8, z);
      ctx.font = 'bold ' + fs + 'px KenneyFutureNarrow, "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      var yy = tp.y - kk * 46 - 20;
      var xx = tp.x;
      if (t.icon) {
        var ic = COC.Assets.img(t.icon);
        if (ic) ctx.drawImage(ic, xx - ctx.measureText(t.str).width / 2 - fs * 1.15, yy - fs * 0.85, fs, fs);
      }
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,.65)';
      ctx.strokeText(t.str, xx, yy);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, xx, yy);
      ctx.restore();
    }
  }

  function drawScreen(ctx, vw, vh) {
    for (var i = 0; i < screenFx.length; i++) {
      var s = screenFx[i];
      if (s.t <= 0) continue;
      var sh = COC.Assets.sheet(s.sheet);
      var img = COC.Assets.img(s.sheet);
      if (!img || !img.naturalWidth) continue;
      var fw = img.naturalWidth / sh.cols, fh = img.naturalHeight / sh.rows;
      var f = Math.min(sh.frames - 1, Math.floor(s.frame));
      var sx = (f % sh.cols) * fw, sy = Math.floor(f / sh.cols) * fh;
      ctx.drawImage(img, sx, sy, fw, fh, s.x * vw - s.w / 2, s.y * vh - s.w / 2, s.w, s.w);
    }
  }

  return {
    clear: clear, update: update,
    drawGround: drawGround, drawWorld: drawWorld, drawScreen: drawScreen,
    explosion: explosion, smallBlast: smallBlast, hitSpark: hitSpark, muzzle: muzzle,
    poof: poof, scorch: scorch, lightning: lightning, badSpot: badSpot,
    collectBurst: collectBurst, floatText: floatText, buildDone: buildDone,
    starBurst: starBurst, fireworks: fireworks
  };
})();
