/* ============ 选中信息面板 / 放置与拖拽 ============ */
COC.PanelsUI = (function () {
  'use strict';
  var U = COC.U, CFG = COC.CFG;
  var UIS = COC.UIState;
  var infoTimer = null;

  function $(id) { return document.getElementById(id); }

  function init() {
    $('info-close').onclick = function () { deselect(); COC.Audio.play('close'); };
    $('btn-info-upgrade').onclick = onUpgrade;
    $('btn-info-collect').onclick = onCollect;
    $('btn-info-finish').onclick = onFinish;
    $('btn-info-remove').onclick = onRemove;
    $('btn-info-train').onclick = onTrainBtn;
    $('btn-place-ok').onclick = confirmPlace;
    $('btn-place-cancel').onclick = cancelPlace;

    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (UIS.placing) cancelPlace();
        else deselect();
        var modals = document.querySelectorAll('.modal');
        for (var i = 0; i < modals.length; i++) modals[i].classList.add('hidden');
      }
    });
  }

  /* ---------- 点击选择 ---------- */
  function onTap(sx, sy) {
    if (UIS.placing) {
      /* 放置模式下点击 = 移动幽灵到该处 */
      var g = COC.Camera.toGrid(sx, sy);
      var def = COC.BuildingDefs.get(UIS.placing.type);
      UIS.placing.x = U.clamp(Math.round(g.x - def.size / 2), 0, CFG.MAP - def.size);
      UIS.placing.y = U.clamp(Math.round(g.y - def.size / 2), 0, CFG.MAP - def.size);
      return;
    }
    var gpt = COC.Camera.toGrid(sx, sy);
    var gx = Math.floor(gpt.x), gy = Math.floor(gpt.y);
    var b = COC.Village.buildingAt(gx, gy);
    if (b) {
      /* 收集器直接收 */
      var def = COC.BuildingDefs.get(b.type);
      if (def.produces && b.stored >= 1 && !b.busy) COC.Economy.collect(b);
      select(b);
      return;
    }
    var o = COC.Village.obstacleAt(gx, gy);
    if (o) { selectObstacle(o); return; }
    deselect();
  }

  function select(b) {
    UIS.selected = b;
    UIS.selObstacle = null;
    COC.Audio.play('click');
    showInfo();
    if (infoTimer) clearInterval(infoTimer);
    infoTimer = setInterval(showInfo, 500);
  }

  function selectObstacle(o) {
    UIS.selected = null;
    UIS.selObstacle = o;
    COC.Audio.play('click');
    showObstacleInfo(o);
    if (infoTimer) clearInterval(infoTimer);
    infoTimer = setInterval(function () { showObstacleInfo(o); }, 500);
  }

  function deselect() {
    UIS.selected = null;
    UIS.selObstacle = null;
    $('info-panel').classList.add('hidden');
    if (infoTimer) { clearInterval(infoTimer); infoTimer = null; }
  }

  /* ---------- 信息面板 ---------- */
  function showInfo() {
    var b = UIS.selected;
    if (!b) return;
    var def = COC.BuildingDefs.get(b.type);
    var lvd = COC.BuildingDefs.lvl(b.type, b.lv);
    $('btn-info-upgrade').onclick = onUpgrade; /* 防止障碍面板覆盖 */
    $('info-panel').classList.remove('hidden');
    $('info-title').textContent = def.name;
    $('info-level').textContent = 'Lv.' + b.lv;
    $('info-desc').textContent = def.desc;

    var stats = [];
    stats.push('<span>❤️ 生命 <b>' + U.fmt(lvd.hp) + '</b></span>');
    if (lvd.prodHour) {
      stats.push('<span>⏱ 产量 <b>' + U.fmt(lvd.prodHour) + '/时</b></span>');
      stats.push('<span>📦 已存 <b>' + U.fmt(Math.floor(b.stored || 0)) + '/' + U.fmt(lvd.cap) + '</b></span>');
    }
    if (lvd.store) stats.push('<span>📦 容量 <b>' + U.fmt(lvd.store) + '</b></span>');
    if (lvd.dmg) {
      stats.push('<span>⚔️ 伤害 <b>' + lvd.dmg + '</b></span>');
      stats.push('<span>🎯 射程 <b>' + lvd.range + '</b></span>');
      stats.push('<span>⚡ 攻速 <b>' + lvd.rate + 's</b></span>');
    }
    if (lvd.camp) stats.push('<span>🏕 容纳 <b>' + lvd.camp + '</b></span>');
    if (lvd.spellCap) stats.push('<span>⚗️ 法术位 <b>' + lvd.spellCap + '</b></span>');
    if (b.busy) {
      var remain = Math.max(0, (b.busy.end - U.now()) / 1000);
      stats.push('<span>🔨 ' + (b.busy.kind === 'build' ? '建造中' : '升级中') + ' <b>' + U.fmtTime(remain) + '</b></span>');
    }
    $('info-stats').innerHTML = stats.join('');

    /* 按钮状态 */
    var up = $('btn-info-upgrade'), col = $('btn-info-collect'),
        fin = $('btn-info-finish'), rem = $('btn-info-remove'), tr = $('btn-info-train');

    /* 收集 */
    col.classList.toggle('hidden', !(def.produces && (b.stored || 0) >= 1 && !b.busy));

    /* 升级 */
    var info = COC.Economy.upgradeInfo(b);
    if (info.maxed || b.busy) {
      up.classList.add('hidden');
    } else {
      up.classList.remove('hidden');
      var ct = COC.Economy.costText(info.cost);
      var icon = ct.res === 'gold' ? 'gold' : (ct.res === 'elixir' ? 'elixir' : 'gem');
      up.innerHTML = '升级 <img class="mini" src="assets/img/icons/' + icon + '.png"> ' + U.fmt(ct.n) +
        (info.time > 0 ? ' · ' + U.fmtTime(info.time) : '');
      var can = COC.Economy.canUpgrade(b);
      up.disabled = !can.ok;
      up.title = can.ok ? '' : can.why;
    }

    /* 立即完成 */
    if (b.busy) {
      fin.classList.remove('hidden');
      fin.innerHTML = '立即完成 <img class="mini" src="assets/img/icons/gem.png"> ' + COC.Economy.gemSkipCost(b);
    } else fin.classList.add('hidden');

    /* 移除（装饰） */
    rem.classList.toggle('hidden', !def.isDeco);

    /* 训练按钮 */
    var showTrain = (b.type === 'barracks' || b.type === 'armycamp' || b.type === 'spellfactory' || b.type === 'laboratory') && !COC.State.isUnderConstruction(b);
    tr.classList.toggle('hidden', !showTrain);
    tr.textContent = b.type === 'laboratory' ? '研究' : '训练';
  }

  function showObstacleInfo(o) {
    if (!UIS.selObstacle) return;
    var def = COC.BuildingDefs.OBSTACLES[o.kind];
    $('info-panel').classList.remove('hidden');
    $('info-title').textContent = def.name;
    $('info-level').textContent = '障碍';
    $('info-desc').textContent = o.clearing ? '正在清理中…' : '清理障碍可以腾出建造空间，还有机会发现宝石！';
    var ct = COC.Economy.costText(def.cost);
    var stats = ['<span>清理花费 <b>' + U.fmt(ct.n) + ' ' + (ct.res === 'gold' ? '金币' : '圣水') + '</b></span>',
      '<span>耗时 <b>' + U.fmtTime(def.time) + '</b></span>'];
    if (o.clearing) {
      var remain = Math.max(0, (o.clearing.end - U.now()) / 1000);
      stats.push('<span>剩余 <b>' + U.fmtTime(remain) + '</b></span>');
    }
    $('info-stats').innerHTML = stats.join('');

    $('btn-info-collect').classList.add('hidden');
    $('btn-info-finish').classList.add('hidden');
    $('btn-info-remove').classList.add('hidden');
    $('btn-info-train').classList.add('hidden');
    var up = $('btn-info-upgrade');
    up.classList.toggle('hidden', !!o.clearing);
    up.disabled = false;
    up.innerHTML = '清理 <img class="mini" src="assets/img/icons/' + (ct.res === 'gold' ? 'gold' : 'elixir') + '.png"> ' + U.fmt(ct.n);
    up.onclick = function () {
      if (COC.Economy.startClearObstacle(o)) {
        COC.Audio.play('confirm');
        showObstacleInfo(o);
      }
      up.onclick = onUpgrade; /* 恢复 */
    };
  }

  function onUpgrade() {
    var b = UIS.selected;
    if (!b) return;
    if (COC.Economy.upgrade(b)) showInfo();
  }

  function onCollect() {
    var b = UIS.selected;
    if (b) { COC.Economy.collect(b); showInfo(); }
  }

  function onFinish() {
    var b = UIS.selected;
    if (b && b.busy) { COC.Economy.gemFinish(b); showInfo(); }
  }

  function onRemove() {
    var b = UIS.selected;
    if (b && COC.Economy.removeDeco(b)) deselect();
  }

  function onTrainBtn() {
    var b = UIS.selected;
    if (!b) return;
    COC.Audio.play('open');
    if (b.type === 'laboratory') COC.ArmyUI.openLab();
    else COC.ArmyUI.open();
  }

  /* ---------- 新建放置 ---------- */
  function startPlacing(type) {
    deselect();
    var def = COC.BuildingDefs.get(type);
    var center = COC.Camera.toGrid(window.innerWidth / 2, window.innerHeight / 2);
    var spot = { x: U.clamp(Math.round(center.x - def.size / 2), CFG.BORDER, CFG.MAP - CFG.BORDER - def.size), y: U.clamp(Math.round(center.y - def.size / 2), CFG.BORDER, CFG.MAP - CFG.BORDER - def.size) };
    if (!COC.Village.canPlace(spot.x, spot.y, def.size)) {
      var alt = COC.Village.findFreeSpot(def.size);
      if (alt) spot = alt;
    }
    UIS.placing = { type: type, x: spot.x, y: spot.y };
    $('place-confirm').classList.remove('hidden');
  }

  function confirmPlace() {
    var pl = UIS.placing;
    if (!pl) return;
    var b = COC.Economy.placeNew(pl.type, pl.x, pl.y);
    if (b) {
      var def = COC.BuildingDefs.get(pl.type);
      if (pl.type === 'wall') {
        /* 城墙连放：留在放置模式 */
        var chk = COC.Economy.canBuild('wall');
        if (chk.ok) {
          UIS.placing = { type: 'wall', x: U.clamp(pl.x + 1, CFG.BORDER, CFG.MAP - CFG.BORDER - 1), y: pl.y };
          return;
        }
      }
      cancelPlaceOnly();
    }
  }

  function cancelPlace() {
    COC.Audio.play('close');
    cancelPlaceOnly();
  }
  function cancelPlaceOnly() {
    UIS.placing = null;
    $('place-confirm').classList.add('hidden');
  }

  /* ---------- 拖拽移动 ---------- */
  function onDragStart(sx, sy) {
    if (COC.Mode !== 'home') return false;
    if (UIS.placing) {
      /* 拖动幽灵 */
      UIS.draggingGhost = true;
      return true;
    }
    if (!UIS.selected) return false;
    var g = COC.Camera.toGrid(sx, sy);
    var gx = Math.floor(g.x), gy = Math.floor(g.y);
    var b = UIS.selected;
    var size = COC.BuildingDefs.get(b.type).size;
    if (gx >= b.x && gx < b.x + size && gy >= b.y && gy < b.y + size) {
      UIS.dragging = { b: b, x: b.x, y: b.y, ox: b.x, oy: b.y };
      $('info-panel').classList.add('hidden');
      return true;
    }
    return false;
  }

  function onDragMove(sx, sy) {
    var g = COC.Camera.toGrid(sx, sy);
    if (UIS.draggingGhost && UIS.placing) {
      var def = COC.BuildingDefs.get(UIS.placing.type);
      UIS.placing.x = U.clamp(Math.round(g.x - def.size / 2), 0, CFG.MAP - def.size);
      UIS.placing.y = U.clamp(Math.round(g.y - def.size / 2), 0, CFG.MAP - def.size);
      return;
    }
    var d = UIS.dragging;
    if (!d) return;
    var size = COC.BuildingDefs.get(d.b.type).size;
    d.x = U.clamp(Math.round(g.x - size / 2), 0, CFG.MAP - size);
    d.y = U.clamp(Math.round(g.y - size / 2), 0, CFG.MAP - size);
  }

  function onDragEnd() {
    if (UIS.draggingGhost) { UIS.draggingGhost = false; return; }
    var d = UIS.dragging;
    if (!d) return;
    UIS.dragging = null;
    if (COC.Economy.moveBuilding(d.b, d.x, d.y)) {
      showInfo();
    } else {
      COC.Audio.play('error');
      showInfo();
    }
  }

  /* 每帧：放置确认按钮跟随幽灵 */
  function tick() {
    var pl = UIS.placing;
    var pc = $('place-confirm');
    if (!pl) { if (!pc.classList.contains('hidden')) pc.classList.add('hidden'); return; }
    pc.classList.remove('hidden');
    var def = COC.BuildingDefs.get(pl.type);
    var p = COC.Camera.toScreen(pl.x + def.size / 2, pl.y + def.size + 0.6);
    pc.style.left = (p.x - 66) + 'px';
    pc.style.top = Math.min(window.innerHeight - 80, p.y + 8) + 'px';
  }

  return {
    init: init, onTap: onTap, select: select, deselect: deselect,
    startPlacing: startPlacing,
    onDragStart: onDragStart, onDragMove: onDragMove, onDragEnd: onDragEnd,
    tick: tick
  };
})();
