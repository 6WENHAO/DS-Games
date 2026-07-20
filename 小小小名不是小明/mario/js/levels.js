// levels.js - 关卡数据（自行编排的致敬式布局）
(function () {
  "use strict";

  // 图块 ID
  var T = {
    EMPTY: 0,
    GROUND: 1,
    BRICK: 2,
    QUESTION: 3,   // 内容见 contents
    USED: 4,
    STAIR: 5,
    PIPE_TL: 6, PIPE_TR: 7, PIPE_BL: 8, PIPE_BR: 9,
    HIDDEN: 10,    // 隐形砖（顶出 1UP）
    COIN: 11,      // 场景金币
    POLE: 12,      // 旗杆
    POLE_TOP: 13
  };

  var SOLID = {};
  [T.GROUND, T.BRICK, T.QUESTION, T.USED, T.STAIR, T.PIPE_TL, T.PIPE_TR, T.PIPE_BL, T.PIPE_BR].forEach(function (t) { SOLID[t] = true; });

  var H = 15; // 世界高 15 格（240px）

  function Level(w) {
    this.w = w;
    this.h = H;
    this.tiles = new Uint8Array(w * H);
    this.contents = {};   // "x,y" -> {type:'coin'|'power'|'star'|'oneup'|'multi', count}
    this.enemies = [];    // {type:'goomba'|'koopa', x(px), y(px)}
    this.decor = [];      // {type:'cloud'|'hill'|'bush'|'castle', x, y}
    this.pipes = [];      // {tx, ty, h, warp:{...}|null}
    this.flagX = 0;
    this.castleX = 0;
    this.spawn = { x: 40, y: 192 };
    this.checkpoint = null;
    this.timeLimit = 400;
    this.bg = "#5c94fc";
    this.underground = false;
    this.exit = null;     // 地下房出口 {x(px), to:{x(px)}}
  }

  Level.prototype.get = function (x, y) {
    if (x < 0 || x >= this.w) return T.GROUND; // 世界边界视为墙
    if (y < 0) return T.EMPTY;
    if (y >= H) return T.EMPTY;
    return this.tiles[y * this.w + x];
  };
  Level.prototype.set = function (x, y, t) {
    if (x < 0 || x >= this.w || y < 0 || y >= H) return;
    this.tiles[y * this.w + x] = t;
  };
  Level.prototype.isSolid = function (x, y) {
    return !!SOLID[this.get(x, y)];
  };

  // ---- 搭建工具 ----
  function ground(lv, x0, x1) {
    for (var x = x0; x <= x1; x++) { lv.set(x, 13, T.GROUND); lv.set(x, 14, T.GROUND); }
  }
  function brick(lv, x, y) { lv.set(x, y, T.BRICK); }
  function q(lv, x, y, content) {
    lv.set(x, y, T.QUESTION);
    lv.contents[x + "," + y] = content || { type: "coin" };
  }
  function brickContent(lv, x, y, content) {
    lv.set(x, y, T.BRICK);
    lv.contents[x + "," + y] = content;
  }
  function hidden(lv, x, y, content) {
    lv.set(x, y, T.HIDDEN);
    lv.contents[x + "," + y] = content || { type: "oneup" };
  }
  function pipe(lv, tx, h, warp) {
    var top = 13 - h;
    lv.set(tx, top, T.PIPE_TL); lv.set(tx + 1, top, T.PIPE_TR);
    for (var y = top + 1; y <= 12; y++) { lv.set(tx, y, T.PIPE_BL); lv.set(tx + 1, y, T.PIPE_BR); }
    lv.pipes.push({ tx: tx, ty: top, h: h, warp: warp || null });
  }
  function stairUp(lv, x0, n) {
    for (var i = 0; i < n; i++)
      for (var k = 0; k <= i; k++) lv.set(x0 + i, 12 - k, T.STAIR);
  }
  function stairDown(lv, x0, n) {
    for (var i = 0; i < n; i++)
      for (var k = 0; k < n - i; k++) lv.set(x0 + i, 12 - k, T.STAIR);
  }
  function stairCol(lv, x, n) {
    for (var k = 0; k < n; k++) lv.set(x, 12 - k, T.STAIR);
  }
  function coinRow(lv, x0, x1, y) {
    for (var x = x0; x <= x1; x++) lv.set(x, y, T.COIN);
  }
  function flag(lv, tx) {
    lv.set(tx, 12, T.STAIR);
    for (var y = 3; y <= 11; y++) lv.set(tx, y, T.POLE);
    lv.set(tx, 2, T.POLE_TOP);
    lv.flagX = tx;
  }
  function goomba(lv, tx) { lv.enemies.push({ type: "goomba", x: tx * 16, y: 176 }); }
  function koopa(lv, tx) { lv.enemies.push({ type: "koopa", x: tx * 16, y: 168 }); }

  function decorate(lv) {
    // 周期性布置云、山、灌木
    for (var x = 0; x < lv.w; x += 48) {
      lv.decor.push({ type: "hill", x: x * 16, y: 172 });
      lv.decor.push({ type: "cloud", x: (x + 9) * 16, y: 40 + ((x / 48) % 2) * 16 });
      lv.decor.push({ type: "bush", x: (x + 23) * 16, y: 192 });
      lv.decor.push({ type: "cloud", x: (x + 28) * 16, y: 32 });
      lv.decor.push({ type: "bush", x: (x + 41) * 16, y: 192 });
      lv.decor.push({ type: "cloud", x: (x + 36) * 16, y: 56 });
    }
  }

  // ---------- 主关卡（致敬式原创布局） ----------
  function buildMain() {
    var lv = new Level(224);
    lv.timeLimit = 400;

    ground(lv, 0, 68);
    ground(lv, 71, 85);
    ground(lv, 89, 152);
    ground(lv, 155, 223);

    // 开场问号砖区
    q(lv, 16, 9, { type: "coin" });
    brick(lv, 20, 9);
    q(lv, 21, 9, { type: "power" });
    brick(lv, 22, 9);
    q(lv, 23, 9, { type: "coin" });
    brick(lv, 24, 9);
    q(lv, 22, 5, { type: "coin" });

    // 水管群（第四根可进入地下奖励房）
    pipe(lv, 28, 2);
    pipe(lv, 38, 3);
    pipe(lv, 46, 4);
    pipe(lv, 57, 4, { to: "bonus" });

    hidden(lv, 64, 9, { type: "oneup" });

    // 坑 69-70
    brick(lv, 77, 9);
    q(lv, 78, 9, { type: "power" });
    brick(lv, 79, 9);

    // 高处长砖列
    for (var x = 80; x <= 87; x++) brick(lv, x, 5);

    // 坑 86-88 上空，落回地面后
    for (x = 91; x <= 93; x++) brick(lv, x, 5);
    brickContent(lv, 94, 5, { type: "multi", count: 8 });
    brickContent(lv, 100, 9, { type: "star" });
    brick(lv, 101, 9);

    q(lv, 106, 9, { type: "coin" });
    q(lv, 109, 9, { type: "power" });
    q(lv, 112, 9, { type: "coin" });
    q(lv, 109, 5, { type: "coin" });

    brick(lv, 118, 5);
    brick(lv, 121, 9);
    brick(lv, 122, 9);
    for (x = 123; x <= 126; x++) brick(lv, x, 5);
    q(lv, 128, 5, { type: "coin" });
    q(lv, 129, 5, { type: "coin" });
    brick(lv, 130, 5);
    brick(lv, 128, 9);
    brick(lv, 131, 9);

    // 阶梯段
    stairUp(lv, 134, 4);
    stairDown(lv, 140, 4);
    stairUp(lv, 148, 4);
    stairCol(lv, 152, 4);
    // 坑 153-154
    stairCol(lv, 155, 4);
    stairDown(lv, 156, 3);

    pipe(lv, 163, 2);
    brick(lv, 168, 9);
    brick(lv, 169, 9);
    q(lv, 170, 9, { type: "coin" });
    brick(lv, 171, 9);
    pipe(lv, 179, 2);

    // 终点大阶梯
    stairUp(lv, 181, 8);
    stairCol(lv, 189, 8);

    flag(lv, 198);
    lv.castleX = 202 * 16;
    lv.decor.push({ type: "castle", x: 202 * 16, y: 128 });

    // 敌人（按推进节奏布置）
    goomba(lv, 22);
    goomba(lv, 40);
    goomba(lv, 51); goomba(lv, 52.5);
    goomba(lv, 80); goomba(lv, 82);
    goomba(lv, 97); goomba(lv, 98.5);
    koopa(lv, 107);
    goomba(lv, 110); goomba(lv, 111.5);
    goomba(lv, 114); goomba(lv, 115.5);
    goomba(lv, 127); goomba(lv, 128.5);
    goomba(lv, 174); goomba(lv, 175.5);

    lv.spawn = { x: 40, y: 192 };
    lv.checkpoint = { x: 96 * 16, y: 192 };
    decorate(lv);
    return lv;
  }

  // ---------- 地下奖励房 ----------
  function buildBonus() {
    var lv = new Level(20);
    lv.underground = true;
    lv.bg = "#000000";

    ground(lv, 0, 19);
    for (var y = 0; y < 13; y++) lv.set(0, y, T.BRICK);      // 左墙
    for (var x = 0; x < 20; x++) lv.set(x, 0, T.BRICK);      // 顶
    for (y = 1; y <= 12; y++) lv.set(19, y, T.BRICK);        // 右墙

    // 砖台与金币
    for (x = 4; x <= 12; x++) lv.set(x, 9, T.BRICK);
    coinRow(lv, 4, 12, 8);
    coinRow(lv, 4, 12, 12);
    coinRow(lv, 5, 11, 4);

    // 出口水管（贴右墙，走到跟前按下进入）
    pipe(lv, 16, 2, { to: "main-exit" });

    lv.spawn = { x: 34, y: 16 };
    lv.exit = { toX: 163 * 16 + 10 };
    return lv;
  }

  window.MarioLevels = {
    T: T,
    SOLID: SOLID,
    buildMain: buildMain,
    buildBonus: buildBonus
  };
})();
