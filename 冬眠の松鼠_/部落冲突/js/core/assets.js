/* ============ 资源加载器 ============ */
COC.Assets = (function () {
  'use strict';

  var IMG_BASE = 'assets/img/';
  var images = {};   // key -> Image
  var loaded = 0, total = 0, failed = [];

  /* ---- 图片清单 ---- */
  var MANIFEST = {};

  function add(key, path) { MANIFEST[key] = IMG_BASE + path; }

  (function build() {
    /* 建筑 */
    add('townhall_1', 'buildings/townhall_1.png');
    add('townhall_2', 'buildings/townhall_2.png');
    add('barracks_1', 'buildings/barracks_1.png');
    add('barracks_2', 'buildings/barracks_2.png');
    add('armycamp', 'buildings/armycamp.png');
    add('stable', 'buildings/stable.png');
    add('blacksmith', 'buildings/blacksmith.png');
    add('house_a', 'buildings/house_a.png');
    add('house_c', 'buildings/house_c.png');
    add('farmhouse', 'buildings/farmhouse.png');
    add('builderhut', 'buildings/builderhut.png');
    add('laboratory', 'buildings/laboratory.png');
    add('spellfactory', 'buildings/spellfactory.png');
    add('elixirstorage', 'buildings/elixirstorage.png');
    add('goldstorage', 'buildings/goldstorage.png');
    add('wizardtower', 'buildings/wizardtower.png');
    add('xbow', 'buildings/xbow.png');
    add('cannon', 'buildings/cannon.png');
    add('clancastle', 'buildings/clancastle.png');
    add('elixirpump', 'buildings/elixirpump.png');
    add('mortar', 'buildings/mortar.png');
    add('mortar_b', 'buildings/mortar_b.png');
    var i;
    for (i = 0; i < 17; i++) add('goldmine_' + i, 'buildings/goldmine_' + pad2(i) + '.png');
    for (i = 0; i < 8; i++) add('smoke_' + i, 'buildings/smoke_' + pad2(i) + '.png');
    var a, f;
    for (a = 1; a <= 8; a++) for (f = 0; f < 5; f++) add('atower_a' + a + '_' + f, 'buildings/atower_a' + a + '_' + pad2(f) + '.png');
    add('wall_wood_straight', 'buildings/wall_wood_straight.png');
    add('wall_wood_straight2', 'buildings/wall_wood_straight2.png');
    add('wall_wood_corner2', 'buildings/wall_wood_corner2.png');
    add('wall_wood_corner4', 'buildings/wall_wood_corner4.png');
    add('wall_stone_straight', 'buildings/wall_stone_straight.png');
    add('wall_gold_straight', 'buildings/wall_gold_straight.png');

    /* 地形 */
    add('grass1', 'terrain/grass1.png');
    add('grass2', 'terrain/grass2.png');
    for (i = 1; i <= 8; i++) add('grassdeco' + i, 'terrain/grassdeco' + i + '.png');
    add('grasspath1', 'terrain/grasspath1.png');
    add('grasspath2', 'terrain/grasspath2.png');
    add('dirt1', 'terrain/dirt1.png');
    add('water1', 'terrain/water1.png');
    add('water2', 'terrain/water2.png');

    /* 环境 */
    for (i = 1; i <= 4; i++) add('tree' + i, 'env/tree' + i + '.png');
    add('bush1', 'env/bush1.png');
    add('bush2', 'env/bush2.png');
    add('rock1', 'env/rock1.png');
    add('rock2', 'env/rock2.png');
    add('rock3', 'env/rock3.png');
    add('goldnugget', 'env/goldnugget.png');
    add('goldpile', 'env/goldpile.png');
    add('windmill', 'env/windmill.png');

    /* 单位 */
    var units = ['barbarian', 'archer', 'giant', 'goblin', 'wallbreaker', 'wizard', 'builder', 'knight', 'enemy1', 'enemy2', 'villager'];
    for (i = 0; i < units.length; i++) add('u_' + units[i], 'units/' + units[i] + '.png');

    /* 特效图集 & 粒子 */
    add('expl_a', 'fx/expl_a.png');
    add('expl_b', 'fx/expl_b.png');
    add('expl_c', 'fx/expl_c.png');
    add('poof', 'fx/poof.png');
    add('starfx', 'fx/starfx.png');
    add('firework', 'fx/firework.png');
    var parts = ['flame_01', 'flame_02', 'flame_03', 'flame_04', 'flame_05', 'smoke_01', 'smoke_02', 'smoke_03', 'smoke_04', 'smoke_05',
      'spark_01', 'spark_02', 'spark_03', 'spark_04', 'spark_05', 'spark_06', 'spark_07',
      'magic_01', 'magic_02', 'magic_03', 'magic_04', 'magic_05',
      'trace_01', 'trace_02', 'trace_03', 'trace_05', 'trace_06', 'trace_07',
      'circle_01', 'circle_02', 'circle_03', 'circle_05',
      'star_04', 'star_05', 'star_06', 'star_07', 'star_08', 'star_09',
      'twirl_01', 'twirl_02', 'scorch_01', 'scorch_02', 'scorch_03',
      'muzzle_01', 'muzzle_02', 'muzzle_03', 'slash_02', 'slash_03',
      'dirt_01', 'dirt_02', 'light_01', 'light_02', 'flare_01', 'symbol_01', 'symbol_02'];
    for (i = 0; i < parts.length; i++) add('p_' + parts[i], 'fx/p_' + parts[i] + '.png');

    /* 图标 */
    add('ic_gold', 'icons/gold.png');
    add('ic_elixir', 'icons/elixir.png');
    add('ic_gem', 'icons/gem.png');
    add('ic_star', 'icons/star.png');
  })();

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  /* ---- 图集帧定义 ---- */
  var SHEETS = {
    expl_a:  { cols: 8, rows: 8, frames: 64 },
    expl_b:  { cols: 8, rows: 8, frames: 64 },
    expl_c:  { cols: 8, rows: 8, frames: 64 },
    poof:    { cols: 6, rows: 5, frames: 30 },
    starfx:  { cols: 6, rows: 5, frames: 30 },
    firework:{ cols: 6, rows: 5, frames: 30 }
  };

  function loadAll(onProgress, onDone) {
    var keys = Object.keys(MANIFEST);
    total = keys.length;
    loaded = 0;
    keys.forEach(function (k) {
      var img = new Image();
      img.onload = function () { step(); };
      img.onerror = function () { failed.push(k); step(); };
      img.src = MANIFEST[k];
      images[k] = img;
    });
    function step() {
      loaded++;
      if (onProgress) onProgress(loaded / total);
      if (loaded >= total) {
        if (failed.length) console.warn('资源加载失败:', failed);
        onDone();
      }
    }
  }

  function img(key) { return images[key]; }
  function has(key) { var im = images[key]; return im && im.complete && im.naturalWidth > 0; }
  function sheet(key) { return SHEETS[key]; }

  return { loadAll: loadAll, img: img, has: has, sheet: sheet };
})();
