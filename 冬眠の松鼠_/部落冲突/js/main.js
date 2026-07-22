/* ============ 主入口 & 游戏循环 ============ */
(function () {
  'use strict';
  var U = COC.U, CFG = COC.CFG;

  var lastT = 0;
  var secAcc = 0;
  var obstacleTimer = 0;

  function boot() {
    var bar = document.getElementById('loading-bar');
    var txt = document.getElementById('loading-text');

    COC.Assets.loadAll(
      function (p) {
        bar.style.width = Math.round(p * 100) + '%';
        txt.textContent = '正在加载资源… ' + Math.round(p * 100) + '%';
      },
      function () {
        txt.textContent = '正在建设村庄…';
        setTimeout(start, 60);
      }
    );
  }

  function start() {
    COC.Audio.preload();
    COC.State.init();
    COC.Village.rebuild();

    var canvas = document.getElementById('game-canvas');
    COC.Renderer.init(canvas);
    COC.Input.init(canvas);

    COC.UI.init();
    COC.ShopUI.init();
    COC.PanelsUI.init();
    COC.ArmyUI.init();
    COC.BattleUI.init();

    /* 输入路由 */
    COC.Input.on('tap', function (x, y) {
      if (COC.Mode === 'battle') COC.BattleUI.onTap(x, y);
      else COC.PanelsUI.onTap(x, y);
    });
    COC.Input.on('dragStart', function (x, y) {
      if (COC.Mode === 'home') return COC.PanelsUI.onDragStart(x, y);
      return false;
    });
    COC.Input.on('dragMove', function (x, y) { COC.PanelsUI.onDragMove(x, y); });
    COC.Input.on('dragEnd', function (x, y) { COC.PanelsUI.onDragEnd(x, y); });
    COC.Input.on('move', function (x, y) { COC.UIState.pointer = { x: x, y: y }; });

    /* F9 重置存档 */
    window.addEventListener('keydown', function (e) {
      if (e.key === 'F9') {
        if (window.confirm('确定要删除存档并重新开始吗？')) {
          COC.State.reset();
          window.location.reload();
        }
      }
    });

    COC.Camera.centerOn(CFG.MAP / 2, CFG.MAP / 2 - 2);
    /* 根据屏幕宽度调整初始缩放 */
    var wantZ = Math.min(1.15, Math.max(0.6, window.innerWidth / 1700));
    COC.Camera.zoomAt(window.innerWidth / 2, window.innerHeight / 2, wantZ / COC.Camera.zoom());
    COC.UI.showLoaded();
    U.emit('mode');
    U.emit('hud');

    var S = COC.State.get();
    if (S.created && U.now() - S.created < 8000) {
      COC.UI.toast('欢迎来到你的村庄，酋长！', 3200);
      setTimeout(function () { COC.UI.toast('点击金矿收集资源，打开商店建造更多建筑', 4000); }, 1600);
      setTimeout(function () { COC.UI.toast('训练部队后就可以外出掠夺啦！', 4000); }, 4200);
    } else {
      COC.UI.toast('欢迎回来，酋长！');
    }

    requestAnimationFrame(loop);

    /* ---- 调试：#demo 自动进入战斗并部署 ---- */
    if (window.location.hash === '#demo') {
      setTimeout(function () {
        var SS = COC.State.get();
        SS.army = { barbarian: 20, archer: 10, giant: 4, wizard: 4, wallbreaker: 4 };
        SS.spells = { lightning: 1 };
        COC.BattleUI.enter();
        setTimeout(function () {
          var bt = COC.Battle.state();
          if (!bt) return;
          var spots = [[4, 4], [4, 18], [18, 4], [4, 30], [30, 4], [39, 20], [20, 39], [39, 39]];
          var idx = 0;
          var iv = setInterval(function () {
            var S3 = COC.State.get();
            var keys = Object.keys(S3.army);
            if (!keys.length || !COC.Battle.state() || COC.Battle.state().ended) { clearInterval(iv); return; }
            var sp = spots[idx++ % spots.length];
            COC.Battle.deploy(keys[0], sp[0] + (idx % 4) * 0.5, sp[1] + (idx % 3) * 0.5);
          }, 120);
        }, 1000);
      }, 700);
    }
  }

  function loop(t) {
    requestAnimationFrame(loop);
    if (!lastT) lastT = t;
    var dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;

    /* 每秒逻辑 */
    secAcc += dt;
    if (secAcc >= 1) {
      secAcc -= 1;
      COC.Economy.tick();
      COC.Training.tick();
      obstacleTimer++;
      if (obstacleTimer > 150) {
        obstacleTimer = 0;
        if (COC.Mode === 'home') COC.Village.maybeGrowObstacle();
      }
      if (COC.Mode === 'home') COC.UI.update();
    }

    /* 战斗 */
    if (COC.Mode === 'battle') {
      COC.Battle.tick(dt);
      COC.BattleUI.tick();
    }

    COC.FX.update(dt);
    COC.Renderer.render(dt);
    COC.PanelsUI.tick();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
