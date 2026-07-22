/* ============ 音频管理（HTMLAudio 池） ============ */
COC.Audio = (function () {
  'use strict';

  var BASE = 'assets/audio/';
  var enabled = true;
  var cache = {};      // name -> Audio 原型
  var lastPlay = {};   // 节流

  /* 声音表：逻辑名 -> [文件名(不带路径), 音量, 最小间隔ms] */
  var SOUNDS = {
    click:        [['click_002.ogg', 'click_003.ogg'], 0.5, 40],
    open:         [['open_001.ogg', 'bookflip2.ogg'], 0.55, 60],
    close:        [['close_002.ogg'], 0.55, 60],
    confirm:      [['confirmation_001.ogg'], 0.6, 80],
    error:        [['error_004.ogg', 'error_005.ogg'], 0.55, 150],
    place:        [['drop_002.ogg', 'drop_003.ogg'], 0.7, 80],
    build:        [['chop.ogg'], 0.7, 100],
    upgrade:      [['confirmation_002.ogg'], 0.65, 100],
    coins:        [['handlecoins.ogg', 'handlecoins2.ogg'], 0.75, 90],
    elixir:       [['glass_002.ogg', 'glass_003.ogg', 'glass_005.ogg'], 0.6, 90],
    gem:          [['glass_006.ogg', 'glass_004.ogg'], 0.8, 120],
    train:        [['click_005.ogg', 'switch_006.ogg'], 0.6, 60],
    deploy:       [['cloth1.ogg', 'cloth2.ogg'], 0.85, 50],
    swordHit:     [['impactgeneric_light_000.ogg', 'impactgeneric_light_001.ogg', 'impactgeneric_light_002.ogg', 'impactgeneric_light_003.ogg', 'impactgeneric_light_004.ogg'], 0.4, 60],
    arrowShot:    [['knifeslice.ogg', 'knifeslice2.ogg'], 0.32, 70],
    cannonShot:   [['impactplank_medium_000.ogg', 'impactplank_medium_002.ogg'], 0.55, 90],
    mortarShot:   [['impactsoft_medium_000.ogg', 'impactsoft_medium_003.ogg'], 0.6, 200],
    wizardShot:   [['lasersmall_000.ogg', 'lasersmall_001.ogg'], 0.35, 90],
    explode:      [['explosioncrunch_000.ogg', 'explosioncrunch_001.ogg', 'explosioncrunch_002.ogg', 'explosioncrunch_003.ogg'], 0.55, 120],
    bigExplode:   [['lowfrequency_explosion_000.ogg', 'lowfrequency_explosion_001.ogg'], 0.7, 200],
    crumble:      [['impactmining_000.ogg', 'impactmining_002.ogg', 'impactmining_003.ogg'], 0.6, 100],
    wallHit:      [['impactwood_medium_000.ogg', 'impactwood_medium_002.ogg', 'impactwood_medium_004.ogg'], 0.4, 80],
    magic:        [['forcefield_000.ogg'], 0.6, 150],
    lightning:    [['explosioncrunch_004.ogg'], 0.7, 150],
    victory:      [['jingles_hit16.ogg'], 0.85, 500],
    defeat:       [['jingles_nes09.ogg'], 0.8, 500],
    star:         [['jingles_pizzi07.ogg'], 0.7, 300],
    battleStart:  [['jingles_nes02.ogg'], 0.7, 500],
    levelup:      [['jingles_hit13.ogg'], 0.8, 400],
    bell:         [['bong_001.ogg'], 0.6, 200],
    steps:        [['footstep_grass_000.ogg', 'footstep_grass_002.ogg', 'footstep_grass_004.ogg'], 0.3, 220]
  };

  function preload() {
    for (var key in SOUNDS) {
      var files = SOUNDS[key][0];
      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        if (!cache[f]) {
          var a = new window.Audio(BASE + f);
          a.preload = 'auto';
          cache[f] = a;
        }
      }
    }
  }

  function play(name, volMul) {
    if (!enabled) return;
    var def = SOUNDS[name];
    if (!def) return;
    var t = performance.now();
    if (lastPlay[name] && t - lastPlay[name] < def[2]) return;
    lastPlay[name] = t;
    var file = def[0][Math.floor(Math.random() * def[0].length)];
    var proto = cache[file];
    if (!proto) { proto = new window.Audio(BASE + file); cache[file] = proto; }
    try {
      var node = proto.cloneNode();
      node.volume = Math.min(1, def[1] * (volMul === undefined ? 1 : volMul));
      var p = node.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) { /* 忽略自动播放限制 */ }
  }

  function setEnabled(v) { enabled = v; }
  function isEnabled() { return enabled; }

  return { preload: preload, play: play, setEnabled: setEnabled, isEnabled: isEnabled };
})();
