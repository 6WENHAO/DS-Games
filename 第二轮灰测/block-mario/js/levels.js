/* =========================================================
   levels.js — 关卡数据
   约定：统一 16 行高；第 13 行为地表，14~15 行为填充/基岩；
        实体与地刺放在第 12 行（站在地表上），木平台放在 8~10 行。
   地面几何用「段落规格」生成，避免手工数字符出错。
   图例:
     .空气  G草  D泥土  S石头  C圆石  P木板  L原木  E树叶  B砖  X基岩
     Y沙  N地狱岩  U灵魂沙  W萤石  O黑曜石  Z末地石  R紫珀
     ?奖励块  =木平台(可穿过)  H梯子  w水  ~岩浆  ^地刺  T仙人掌
     o绿宝石  d钻石  a苹果  h红心  t火把(存档点)
     z僵尸  k骷髅  c苦力怕  s史莱姆  b烈焰人
     F旗帜(终点)  p末地传送门(终点)
   ========================================================= */
(function () {
  'use strict';
  var G = (window.G = window.G || {});

  function rep(n, c) { var s = ''; for (var i = 0; i < n; i++) s += c; return s; }
  function segs(list) { var s = ''; for (var i = 0; i < list.length; i++) s += rep(list[i][0], list[i][1]); return s; }
  function put(row, x, str) { return row.slice(0, x) + str + row.slice(x + str.length); }
  function padAll(rows) {
    var w = 0, i;
    for (i = 0; i < rows.length; i++) w = Math.max(w, rows[i].length);
    for (i = 0; i < rows.length; i++) {
      if (rows[i].length < w) rows[i] += rep(w - rows[i].length, '.');
      else if (rows[i].length > w) rows[i] = rows[i].slice(0, w);
    }
    return rows;
  }

  /* ==================== 第一关：青翠平原（116 宽） ==================== */
  var W1 = 116;
  var g1 = segs([[15, 'G'], [3, '.'], [32, 'G'], [4, '.'], [15, 'G'], [2, '.'], [24, 'G'], [3, '.'], [18, 'G']]);
  var d1 = g1.replace(/G/g, 'D');
  var L1 = padAll([
    rep(W1, '.'),
    rep(W1, '.'),
    put(rep(W1, '.'), 42, 'EEE') ,
    put(put(rep(W1, '.'), 41, 'EEEEE'), 84, 'EEEEE'),
    put(put(put(rep(W1, '.'), 26, 'o.o'), 41, 'EEEEE'), 84, 'EEEEE'),
    put(put(put(rep(W1, '.'), 43, 'L'), 62, 'o.o'), 86, 'L'),
    put(put(put(put(rep(W1, '.'), 14, '?'), 43, 'L'), 53, '?...?'), 86, 'L'),
    put(put(rep(W1, '.'), 43, 'L'), 86, 'L'),
    put(put(put(put(rep(W1, '.'), 31, 'o.o'), 43, 'L'), 78, 'd'), 86, 'L'),
    put(put(put(put(rep(W1, '.'), 26, '==='), 54, '==='), 70, '==='), 95, '==='),
    rep(W1, '.'),
    put(put(put(put(rep(W1, '.'), 10, 'o'), 17, '?'), 85, 'a'), 99, '?'),
    // 怪物一律放在第 12 行（站在地表上），避免开局从半空坠落
    put(put(put(put(put(put(rep(W1, '.'), 30, 's'), 37, 'z'), 58, 'T'), 72, 's'), 105, 'z'), 112, 'F'),
    g1, d1, rep(W1, 'X')
  ]);

  /* ==================== 第二关：地下洞穴（116 宽） ==================== */
  var W2 = 116;
  var g2 = segs([[35, 'G'], [3, '.'], [17, 'C'], [2, '.'], [59, 'C']]);
  var d2 = g2.replace(/G/g, 'D').replace(/C/g, 'C');
  var L2 = padAll([
    rep(W2, '.'),
    put(put(rep(W2, '.'), 42, rep(12, 'S')), 84, rep(18, 'S')),
    put(put(put(rep(W2, '.'), 33, rep(10, 'S')), 43, rep(10, 'C')), 84, rep(18, 'C')),
    put(put(put(put(put(rep(W2, '.'), 27, rep(7, 'S')), 34, rep(11, 'C')), 86, rep(16, 'C')), 46, 'W'), 92, 'W'),
    put(put(put(put(rep(W2, '.'), 20, rep(7, 'S')), 50, 'o.o'), 22, 'W'), 46, 'W'),
    put(put(rep(W2, '.'), 10, 'o.o'), 19, 'SC'),
    put(put(put(put(rep(W2, '.'), 16, '?'), 19, 'SC'), 42, '==='), 58, '==='),
    put(rep(W2, '.'), 19, 'SC'),
    put(put(put(rep(W2, '.'), 10, '==='), 19, 'SC'), 54, 'd'),
    put(put(put(put(rep(W2, '.'), 19, 'SC'), 44, '==='), 62, '==='), 78, '==='),
    put(rep(W2, '.'), 27, 'HH'),
    put(put(put(rep(W2, '.'), 27, 'HH'), 68, 'w.w'), 100, 'a'),
    // 怪物统一放第 12 行
    put(put(put(put(put(put(put(put(rep(W2, '.'), 7, 's'), 31, 'k'), 39, 's'), 47, '^^^'), 55, 'a'), 70, 'k'), 92, 'k'), 112, 'F'),
    g2, d2, rep(W2, 'X')
  ]);

  /* ==================== 第三关：下界烈焰（116 宽） ==================== */
  var W3 = 116;
  // 岩浆缺口全部 ≤ 4 格，且上方有木平台可选路线
  var g3 = segs([
    [16, 'N'], [4, '~'], [8, 'N'], [4, '~'], [10, 'N'], [4, '~'],
    [12, 'N'], [4, '~'], [11, 'N'], [4, '~'], [13, 'N'], [4, '~'], [22, 'N']
  ]);
  var L3 = padAll([
    rep(W3, '.'),
    put(rep(W3, '.'), 23, rep(6, 'N')),
    put(put(rep(W3, '.'), 16, rep(18, 'N')), 54, rep(20, 'N')),
    put(put(rep(W3, '.'), 10, rep(26, 'N')), 50, rep(26, 'N')),
    put(put(rep(W3, '.'), 11, rep(23, 'N')), 50, rep(24, 'N')),
    put(put(put(put(rep(W3, '.'), 11, 'W'), 22, 'o.o'), 50, 'W'), 74, 'W'),
    put(put(put(rep(W3, '.'), 26, '?'), 41, 'b'), 79, 'b'),
    put(put(rep(W3, '.'), 60, 'd'), 100, '?'),
    put(put(put(put(put(rep(W3, '.'), 18, '==='), 36, '==='), 52, '==='), 68, '==='), 84, '==='),
    rep(W3, '.'),
    rep(W3, '.'),
    // 苦力怕放在地狱岩上（避开岩浆缺口），旗帜在最后一段
    put(put(put(put(put(rep(W3, '.'), 10, 'UUU'), 34, 'c'), 64, 'c'), 96, 'c'), 112, 'F'),
    put(put(put(rep(W3, '.'), 24, 'o.o'), 66, 'o.o'), 100, 'a'),
    g3, g3, rep(W3, 'X')
  ]);

  /* ==================== 第四关：末地终点（90 宽） ==================== */
  var W4 = 90;
  // 悬浮末地石平台，缺口 ≤ 4 格；末地传送门在最后一块岛上
  var g4 = segs([
    [4, '.'], [8, 'Z'], [4, '.'], [7, 'Z'], [4, '.'], [8, 'Z'], [4, '.'],
    [7, 'Z'], [4, '.'], [7, 'Z'], [4, '.'], [11, 'Z'], [4, '.'], [10, 'Z'], [4, '.']
  ]);
  var L4 = padAll([
    rep(W4, '.'),
    rep(W4, '.'),
    put(put(rep(W4, '.'), 18, 'RRRR'), 48, 'RRRR'),
    put(put(rep(W4, '.'), 17, 'RZZZZR'), 47, 'RZZZZR'),
    put(put(put(rep(W4, '.'), 10, 'o.o'), 18, 'ZZZZ'), 48, 'ZZZZ'),
    put(rep(W4, '.'), 32, 'o.o'),
    put(put(put(rep(W4, '.'), 10, '?'), 38, '?'), 70, '?'),
    put(rep(W4, '.'), 56, 'd'),
    put(put(put(put(rep(W4, '.'), 12, '==='), 28, '==='), 44, '==='), 60, '==='),
    put(rep(W4, '.'), 78, 'ppp'),
    put(rep(W4, '.'), 66, 'a'),
    // 史莱姆放在末地石平台上
    put(put(put(rep(W4, '.'), 20, 's'), 52, 's'), 78, 'ppp'),
    put(put(rep(W4, '.'), 30, 'o.o'), 78, 'ppp'),
    g4, g4, rep(W4, '.')
  ]);

  G.LEVELS = [
    { name: '第一关 · 青翠平原', theme: 'plains', rows: L1, spawn: { x: 3, y: 11 }, goal: 'flag', hint: '方向键/AD 移动，空格跳跃。踩在怪物头上就能消灭它！' },
    { name: '第二关 · 地下洞穴', theme: 'cave', rows: L2, spawn: { x: 3, y: 11 }, goal: 'flag', hint: '梯子可以上下攀爬；地刺与深水都要小心。' },
    { name: '第三关 · 下界烈焰', theme: 'nether', rows: L3, spawn: { x: 3, y: 11 }, goal: 'flag', hint: '岩浆碰到就没命！木平台是更安全的路线。' },
    { name: '第四关 · 末地终点', theme: 'end', rows: L4, spawn: { x: 6, y: 11 }, goal: 'portal', hint: '跳进末地传送门通关。掉出世界会摔死！' }
  ];

  /* ---------- 字符 → 方块/实体 ---------- */
  G.TILE_CHARS = {
    'G': 'grass', 'D': 'dirt', 'S': 'stone', 'C': 'cobble', 'P': 'planks', 'L': 'log',
    'E': 'leaves', 'B': 'brick', 'X': 'bedrock', 'Y': 'sand', 'N': 'netherrack',
    'U': 'soulsand', 'W': 'glowstone', 'O': 'obsidian', 'Z': 'endstone', 'R': 'purpur',
    '?': 'bonus', '=': 'platform', 'H': 'ladder', 'w': 'water', '~': 'lava',
    '^': 'spike', 'T': 'cactus', 'p': 'portal'
  };
  G.ITEM_CHARS = { 'o': 'emerald', 'd': 'diamond', 'a': 'apple', 'h': 'heart', 't': 'torch' };
  G.MOB_CHARS = { 'z': 'zombie', 'k': 'skeleton', 'c': 'creeper', 's': 'slime', 'b': 'blaze' };
})();
