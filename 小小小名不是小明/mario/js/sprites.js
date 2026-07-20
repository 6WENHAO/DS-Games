// sprites.js - 程序生成的原创像素画与位图字体（风格致敬，非原版素材）
(function () {
  "use strict";

  var PAL = {
    sky: "#5c94fc",
    ground1: "#c84c0c", ground2: "#fc9838", ground3: "#000000",
    brick1: "#c84c0c", brick2: "#fc9838", brickDark: "#000000",
    qBlock1: "#fc9838", qBlock2: "#e45c10", qBlock3: "#ac7c00",
    pipe1: "#00a800", pipe2: "#80d010", pipe3: "#003000",
    cloud1: "#ffffff", cloud2: "#a4e0f8",
    bush1: "#00a800", bush2: "#80d010",
    hill1: "#00a800", hill2: "#80d010", hill3: "#003000",
    skin: "#fca044", red: "#d82800", brown: "#7c3000",
    green: "#00a800", dgreen: "#005400",
    shell1: "#00a800", shell2: "#80d010",
    goomba1: "#c84c0c", goomba2: "#fca044", goomba3: "#000000",
    coin1: "#fc9838", coin2: "#c84c0c", coin3: "#ffffff",
    white: "#ffffff", black: "#000000",
    flag1: "#00a800", flag2: "#80d010",
    castle1: "#c84c0c", castle2: "#7c3000",
    fire1: "#fc9838", fire2: "#d82800"
  };

  function makeCanvas(w, h) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  }

  // 用字符串网格绘制像素画：每字符映射一种颜色，"." 为透明
  function draw(grid, map, scale) {
    scale = scale || 1;
    var h = grid.length, w = grid[0].length;
    var c = makeCanvas(w * scale, h * scale);
    var g = c.getContext("2d");
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var ch = grid[y][x] || ".";
        if (ch === ".") continue;
        var col = map[ch];
        if (!col) continue;
        g.fillStyle = col;
        g.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    return c;
  }

  function flipH(src) {
    var c = makeCanvas(src.width, src.height);
    var g = c.getContext("2d");
    g.translate(src.width, 0);
    g.scale(-1, 1);
    g.drawImage(src, 0, 0);
    return c;
  }

  var S = {};

  // ---------- 地形图块 16x16 ----------
  S.ground = draw([
    "aaaaaaaaaaaaaaab",
    "abbbbbbbabbbbbbb",
    "abbbbbbbabbbbbbb",
    "abbbbbbbabbbbbbb",
    "abbbbbbbabbbbbbb",
    "abbbbbbbabbbbbbb",
    "abbbbbbbabbbbbbb",
    "cbbbbbbacbbbbbba",
    "aaaaaaacaaaaaaac",
    "bbbbabbbbbbbabbb",
    "bbbbabbbbbbbabbb",
    "bbbbabbbbbbbabbb",
    "bbbbabbbbbbbabbb",
    "bbbbabbbbbbbabbb",
    "bbbbabbbbbbbabbb",
    "bbbaacbbbbbaacbb"
  ].map(function (r) { return r; }), { a: PAL.ground2, b: PAL.ground1, c: PAL.ground3 });

  S.brick = draw([
    "bbbbbbbbbbbbbbbb",
    "abbbabbbbbbbabbb",
    "abbbabbbbbbbabbb",
    "abbbabbbbbbbabbb",
    "ccccacccccccaccc",
    "bbbbbbbbbbbbbbbb",
    "babbbbbbbabbbbbb",
    "babbbbbbbabbbbbb",
    "cacccccccacccccc",
    "bbbbbbbbbbbbbbbb",
    "abbbabbbbbbbabbb",
    "abbbabbbbbbbabbb",
    "abbbabbbbbbbabbb",
    "ccccacccccccaccc",
    "bbbbbbbbbbbbbbbb",
    "cccccccccccccccc"
  ], { a: PAL.brick2, b: PAL.brick1, c: PAL.brickDark });

  S.block = draw([
    "aaaaaaaaaaaaaaac",
    "abbbbbbbbbbbbbac",
    "abaaaaaaaaaaabac",
    "abaaaaaaaaaaabac",
    "abaaaaaaaaaaabac",
    "abaaaaaaaaaaabac",
    "abaaaaaaaaaaabac",
    "abaaaaaaaaaaabac",
    "abaaaaaaaaaaabac",
    "abaaaaaaaaaaabac",
    "abaaaaaaaaaaabac",
    "abaaaaaaaaaaabac",
    "abaaaaaaaaaaabac",
    "abbbbbbbbbbbbbac",
    "aaaaaaaaaaaaaaac",
    "cccccccccccccccc"
  ], { a: PAL.ground2, b: PAL.ground1, c: PAL.ground3 });

  function qFrame(shift) {
    var rows = [
      "cccccccccccccccc",
      "cabbbbbbbbbbbbac",
      "cbaaaaaaaaaaaabc",
      "cbaaabbbbbaaaabc",
      "cbaabbaaabbaaabc",
      "cbaabbaaabbaaabc",
      "cbaaaaaabbaaaabc",
      "cbaaaaabbaaaaabc",
      "cbaaaabbaaaaaabc",
      "cbaaaabbaaaaaabc",
      "cbaaaaaaaaaaaabc",
      "cbaaaabbaaaaaabc",
      "cbaaaabbaaaaaabc",
      "cbaaaaaaaaaaaabc",
      "cabbbbbbbbbbbbac",
      "cccccccccccccccc"
    ];
    var maps = [
      { a: PAL.qBlock1, b: PAL.qBlock3, c: PAL.black },
      { a: PAL.qBlock2, b: PAL.qBlock3, c: PAL.black },
      { a: PAL.qBlock3, b: PAL.qBlock2, c: PAL.black }
    ];
    return draw(rows, maps[shift]);
  }
  S.qBlock = [qFrame(0), qFrame(1), qFrame(2)];

  S.usedBlock = draw([
    "cccccccccccccccc",
    "cabbbbbbbbbbbbac",
    "cbaaaaaaaaaaaabc",
    "cbaaaaaaaaaaaabc",
    "cbaaaaaaaaaaaabc",
    "cbaaaaaaaaaaaabc",
    "cbaaaaaaaaaaaabc",
    "cbaaaaaaaaaaaabc",
    "cbaaaaaaaaaaaabc",
    "cbaaaaaaaaaaaabc",
    "cbaaaaaaaaaaaabc",
    "cbaaaaaaaaaaaabc",
    "cbaaaaaaaaaaaabc",
    "cbaaaaaaaaaaaabc",
    "cabbbbbbbbbbbbac",
    "cccccccccccccccc"
  ], { a: PAL.brown, b: PAL.ground3, c: PAL.black });

  // 硬质台阶块
  S.stair = draw([
    "aaaaaaaaaaaaaaac",
    "abbbbbbbbbbbbbbc",
    "abbbbbbbbbbbbbbc",
    "abbbbbbbbbbbbbbc",
    "abbbbbbbbbbbbbbc",
    "abbbbbbbbbbbbbbc",
    "abbbbbbbbbbbbbbc",
    "abbbbbbbbbbbbbbc",
    "abbbbbbbbbbbbbbc",
    "abbbbbbbbbbbbbbc",
    "abbbbbbbbbbbbbbc",
    "abbbbbbbbbbbbbbc",
    "abbbbbbbbbbbbbbc",
    "abbbbbbbbbbbbbbc",
    "accccccccccccccc",
    "cccccccccccccccc"
  ], { a: PAL.ground2, b: PAL.ground1, c: PAL.ground3 });

  // 水管：顶部(32x16)与管身(32x16)
  S.pipeTop = draw([
    "cbbbbbbbbbbbbbbbbbbbbbbbbbbbbbac",
    "cbaabbbbbabbbbbbbbbbbbbbbbbbbaac",
    "cbaabbbbbabbbbbbbbbbbbbbbbbbbaac",
    "cbaabbbbbabbbbbbbbbbbbbbbbbbbaac",
    "cbaabbbbbabbbbbbbbbbbbbbbbbbbaac",
    "cbaabbbbbabbbbbbbbbbbbbbbbbbbaac",
    "cbaabbbbbabbbbbbbbbbbbbbbbbbbaac",
    "cbaabbbbbabbbbbbbbbbbbbbbbbbbaac",
    "cbaabbbbbabbbbbbbbbbbbbbbbbbbaac",
    "cbaabbbbbabbbbbbbbbbbbbbbbbbbaac",
    "cbaabbbbbabbbbbbbbbbbbbbbbbbbaac",
    "cbaabbbbbabbbbbbbbbbbbbbbbbbbaac",
    "cbaabbbbbabbbbbbbbbbbbbbbbbbbaac",
    "cbaabbbbbabbbbbbbbbbbbbbbbbbbaac",
    "cbbbbbbbbbbbbbbbbbbbbbbbbbbbbac",
    "cccccccccccccccccccccccccccccccc"
  ].map(function (r) { return r.length === 32 ? r : (r + new Array(33 - r.length).join("c")); }),
    { a: PAL.pipe3, b: PAL.pipe1, c: PAL.pipe3, d: PAL.pipe2 });

  // 用程序方式重画 pipe（网格法太长，直接 canvas 绘制以保证干净）
  function paintPipeTop() {
    var c = makeCanvas(32, 16), g = c.getContext("2d");
    g.fillStyle = PAL.pipe3; g.fillRect(0, 0, 32, 16);
    g.fillStyle = PAL.pipe1; g.fillRect(1, 1, 30, 14);
    g.fillStyle = PAL.pipe2; g.fillRect(3, 1, 4, 14); g.fillRect(9, 1, 2, 14);
    g.fillStyle = PAL.pipe3; g.fillRect(0, 15, 32, 1);
    return c;
  }
  function paintPipeBody() {
    var c = makeCanvas(32, 16), g = c.getContext("2d");
    g.fillStyle = "rgba(0,0,0,0)"; g.clearRect(0, 0, 32, 16);
    g.fillStyle = PAL.pipe3; g.fillRect(2, 0, 28, 16);
    g.fillStyle = PAL.pipe1; g.fillRect(3, 0, 26, 16);
    g.fillStyle = PAL.pipe2; g.fillRect(5, 0, 4, 16); g.fillRect(11, 0, 2, 16);
    return c;
  }
  S.pipeTop = paintPipeTop();
  S.pipeBody = paintPipeBody();

  // 旗杆顶球与旗
  S.flagBall = draw([
    "..aaaa..",
    ".aabbaa.",
    "aabbbbaa",
    "aabbbbaa",
    ".aabbaa.",
    "..aaaa.."
  ], { a: PAL.hill3, b: PAL.hill2 });

  S.flag = draw([
    "aaaaaaaaaaaaaa..",
    ".aaaaaaaaaaaaaa.",
    "..aabbbbbbaaaaaa",
    "...aabbbbaaaaaa.",
    "....aabbaaaaaa..",
    ".....aaaaaaaa...",
    "......aaaaaa....",
    ".......aaaa.....",
    "........aa......"
  ], { a: PAL.flag1, b: PAL.white });

  // 云（32x24）
  S.cloud = (function () {
    var c = makeCanvas(48, 24), g = c.getContext("2d");
    function puff(cx, cy, r) {
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = PAL.cloud2;
    puff(12, 14, 9); puff(24, 10, 11); puff(36, 14, 9);
    g.fillStyle = PAL.cloud1;
    puff(12, 12, 8); puff(24, 8, 10); puff(36, 12, 8);
    g.fillStyle = PAL.cloud1;
    g.fillRect(6, 12, 36, 10);
    return c;
  })();

  // 山丘（80x35）
  S.hill = (function () {
    var c = makeCanvas(80, 36), g = c.getContext("2d");
    g.fillStyle = PAL.hill1;
    g.beginPath();
    g.moveTo(0, 36); g.lineTo(28, 4); g.lineTo(34, 0); g.lineTo(40, 0); g.lineTo(46, 4); g.lineTo(80, 36);
    g.closePath(); g.fill();
    g.fillStyle = PAL.hill3;
    g.fillRect(30, 12, 2, 2); g.fillRect(42, 12, 2, 2);
    g.fillRect(24, 20, 2, 2); g.fillRect(36, 20, 2, 2); g.fillRect(48, 20, 2, 2);
    return c;
  })();

  // 灌木（48x16）
  S.bush = (function () {
    var c = makeCanvas(48, 16), g = c.getContext("2d");
    function puff(cx, cy, r, col) { g.fillStyle = col; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); }
    puff(10, 12, 8, PAL.bush1); puff(24, 10, 10, PAL.bush1); puff(38, 12, 8, PAL.bush1);
    puff(10, 11, 6, PAL.bush2); puff(24, 9, 8, PAL.bush2); puff(38, 11, 6, PAL.bush2);
    g.fillStyle = PAL.bush1; g.fillRect(4, 12, 40, 4);
    return c;
  })();

  // 城堡（80x80）
  S.castle = (function () {
    var c = makeCanvas(80, 80), g = c.getContext("2d");
    g.fillStyle = PAL.castle1;
    g.fillRect(16, 32, 48, 48);
    g.fillRect(0, 48, 80, 32);
    g.fillStyle = PAL.castle2;
    for (var i = 0; i < 5; i++) g.fillRect(18 + i * 10, 24, 6, 8);
    for (i = 0; i < 9; i++) g.fillRect(1 + i * 9, 40, 6, 8);
    g.fillStyle = PAL.castle1;
    for (i = 0; i < 5; i++) g.fillRect(18 + i * 10, 16, 6, 8);
    g.fillStyle = PAL.black;
    g.fillRect(34, 56, 12, 24);
    g.beginPath(); g.arc(40, 56, 6, Math.PI, 0); g.fill();
    g.fillStyle = PAL.castle2;
    g.fillRect(24, 36, 8, 10); g.fillRect(48, 36, 8, 10);
    return c;
  })();

  // ---------- 金币 ----------
  function coinFrame(phase) {
    var widths = [10, 6, 2, 6];
    var w = widths[phase];
    var c = makeCanvas(16, 16), g = c.getContext("2d");
    var x = 8 - w / 2;
    g.fillStyle = PAL.coin2;
    g.fillRect(x, 2, w, 12);
    g.fillStyle = PAL.coin1;
    g.fillRect(x + 1, 3, Math.max(1, w - 2), 10);
    if (w >= 6) {
      g.fillStyle = PAL.coin3;
      g.fillRect(7, 4, 2, 2);
      g.fillStyle = PAL.coin2;
      g.fillRect(7, 7, 2, 5);
    }
    return c;
  }
  S.coin = [coinFrame(0), coinFrame(1), coinFrame(2), coinFrame(3)];

  // ---------- 小英雄（原创 16x16 像素小人，致敬水管工造型） ----------
  // r=帽/衣 s=肤 b=背带裤 k=黑 w=白
  var heroSmallStand = [
    "....rrrrr.......",
    "...rrrrrrrrr....",
    "...kkkssks......",
    "..ksskssbss.....",
    "..kskkssbsss....",
    "..kkssssbbbb....",
    "...sssssss......",
    "..rrbrrbr.......",
    ".rrrbrrbrrr.....",
    "ssrrbbbbrrss....",
    "sssbbrrbbsss....",
    "ssbbbbbbbbss....",
    "..bbb..bbb......",
    ".kkk....kkk.....",
    "kkkk....kkkk....",
    "................"
  ];
  var heroSmallWalk1 = [
    "....rrrrr.......",
    "...rrrrrrrrr....",
    "...kkkssks......",
    "..ksskssbss.....",
    "..kskkssbsss....",
    "..kkssssbbbb....",
    "...sssssss......",
    "..rrbrrbrr......",
    ".srrbrrbbrs.....",
    ".ssrbbbbbss.....",
    "..sbbrrbbs......",
    "...bbbbbb.......",
    "..bbb.bbb.......",
    "..kkkkkk........",
    "...kkkk.........",
    "................"
  ];
  var heroSmallWalk2 = [
    "................",
    "....rrrrr.......",
    "...rrrrrrrrr....",
    "...kkkssks......",
    "..ksskssbss.....",
    "..kskkssbsss....",
    "..kkssssbbbb....",
    "...sssssss......",
    "..rrbrrbr.......",
    ".rrrbrrbrr......",
    ".srrbbbbrs......",
    ".sbbrrbbbs......",
    "..bbbbbbkkk.....",
    ".bbb.kkkkkk.....",
    ".kkk............",
    "kkkk............"
  ];
  var heroSmallWalk3 = [
    "....rrrrr.......",
    "...rrrrrrrrr....",
    "...kkkssks......",
    "..ksskssbss.....",
    "..kskkssbsss....",
    "..kkssssbbbb....",
    "...sssssss......",
    "..rrbrrbr.......",
    ".rrrbrrbrrr.....",
    ".srrbbbbrrs.....",
    ".ssbbrrbbss.....",
    "..bbbbbbbb......",
    "..bbb.bbbb......",
    ".kkk...kkk......",
    "kkkk...kkkk.....",
    "................"
  ];
  var heroSmallJump = [
    "....rrrrr...s...",
    "...rrrrrrrrrss..",
    "...kkkssks..ss..",
    "..ksskssbss.....",
    "..kskkssbsssbb..",
    "..kkssssbbbbbb..",
    "...sssssssbb....",
    "..rrbrrbbrr.....",
    ".rrrbrrbbrr.....",
    "srrrbbbbbrr.....",
    "ssbbbbbbbb......",
    "ssbbbbbbkkk.....",
    ".bbbbbkkkkk.....",
    ".kkk..kkkk......",
    "kkkk............",
    "................"
  ];
  var heroSmallDie = [
    "................",
    "....rrrrr.......",
    "...rrrrrrrrr....",
    "...kkkssks......",
    "..ksskssbss.....",
    "..kkssssbbb.....",
    "...sssssss......",
    "..s.rrrr.s......",
    ".ssrrbbrrss.....",
    ".s.rbbbbr.s.....",
    "...bbrrbb.......",
    "..bbbbbbbb......",
    "..bb....bb......",
    "................",
    "................",
    "................"
  ];

  var heroMap = { r: PAL.red, s: PAL.skin, b: PAL.brown, k: PAL.black, w: PAL.white };
  var fireMap = { r: PAL.white, s: PAL.skin, b: PAL.red, k: PAL.black, w: PAL.white };

  function heroSet(map) {
    var stand = draw(heroSmallStand, map);
    var w1 = draw(heroSmallWalk1, map);
    var w2 = draw(heroSmallWalk2, map);
    var w3 = draw(heroSmallWalk3, map);
    var jump = draw(heroSmallJump, map);
    return {
      stand: [stand, flipH(stand)],
      walk: [[w1, w2, w3].map(function (f) { return f; }), [flipH(w1), flipH(w2), flipH(w3)]],
      jump: [jump, flipH(jump)],
      die: draw(heroSmallDie, map)
    };
  }

  // 大英雄 16x32：由小英雄放大重绘（原创网格）
  var heroBigStand = [
    "......rrrrrr....",
    ".....rrrrrrrrrr.",
    ".....rrrrrrrrrr.",
    "....kkkkssskks..",
    "...kssksssbsss..",
    "...kssksssbssss.",
    "...kkssssbbbbss.",
    "....kssssbbbb...",
    "....ssssssss....",
    "...rrrbrrbrr....",
    "..rrrrbrrbrrrr..",
    ".rrrrrbrrbrrrrr.",
    "ssrrrbbbbbbrrss.",
    "sssrbbrbbrbbsss.",
    "sssbbbrbbrbbbss.",
    "ssbbbbbbbbbbbbs.",
    "ssbbbbbbbbbbbbs.",
    "..bbbbb..bbbbb..",
    "..bbbb....bbbb..",
    "..bbbb....bbbb..",
    ".kkkkk....kkkkk.",
    "kkkkkk....kkkkkk",
    "kkkkkk....kkkkkk",
    "................"
  ];
  var heroBigWalk1 = [
    "......rrrrrr....",
    ".....rrrrrrrrrr.",
    ".....rrrrrrrrrr.",
    "....kkkkssskks..",
    "...kssksssbsss..",
    "...kssksssbssss.",
    "...kkssssbbbbss.",
    "....kssssbbbb...",
    "....ssssssss....",
    "...rrrbrrbrrr...",
    "..rrrrbrrbrrrr..",
    ".srrrrbbbbrrrs..",
    ".ssrrbbbbbbrss..",
    ".ssbbbrbbrbbss..",
    "..sbbbrbbrbbs...",
    "...bbbbbbbbb....",
    "...bbbbbbbbb....",
    "...bbbb.bbbb....",
    "...bbb...bbbk...",
    "..bbbb..kkkkkk..",
    "..kkkk..kkkkkk..",
    ".kkkkk..........",
    "kkkkk...........",
    "................"
  ];
  var heroBigWalk2 = [
    "................",
    "......rrrrrr....",
    ".....rrrrrrrrrr.",
    ".....rrrrrrrrrr.",
    "....kkkkssskks..",
    "...kssksssbsss..",
    "...kssksssbssss.",
    "...kkssssbbbbss.",
    "....kssssbbbb...",
    "....ssssssss....",
    "...rrrbrrbrr....",
    "..rrrrbrrbrrr...",
    ".srrrrbbbbrrs...",
    ".ssrrbbbbbbrs...",
    ".ssbbbrbbrbbs...",
    "..bbbbrbbrbbb...",
    "..bbbbbbbbbbb...",
    "..bbbbbbbbbb....",
    "...bbbbbbbb.....",
    "...bbb.bbbb.....",
    "..bbbb.bbbbk....",
    ".kkkkk.kkkkkk...",
    "kkkkkk.kkkkkk...",
    "................"
  ];
  var heroBigJump = [
    "......rrrrrr..ss",
    ".....rrrrrrrrrss",
    ".....rrrrrrrrrss",
    "....kkkkssskks..",
    "...kssksssbsss..",
    "...kssksssbssss.",
    "...kkssssbbbbss.",
    "....kssssbbbbbb.",
    "....ssssssssbb..",
    "...rrrbrrbrrbb..",
    "..rrrrbrrbrrrr..",
    ".rrrrrbbbbrrrrr.",
    "srrrrbbbbbbrrrs.",
    "ssrrbbrbbrbbrss.",
    "ssbbbbrbbrbbbss.",
    "ssbbbbbbbbbbbss.",
    "sbbbbbbbbbbbbb..",
    ".bbbbbbbbbbbb...",
    ".bbbbb..bbbbkk..",
    ".bbbb..kkkkkkk..",
    ".kkkk..kkkkkk...",
    "kkkkk...........",
    "kkkk............",
    "................"
  ];
  var heroBigCrouch = [
    "......rrrrrr....",
    ".....rrrrrrrrrr.",
    ".....rrrrrrrrrr.",
    "....kkkkssskks..",
    "...kssksssbsss..",
    "...kssksssbssss.",
    "...kkssssbbbbss.",
    "....kssssbbbb...",
    "....ssssssss....",
    "..rrrrbrrbrrrr..",
    ".srrrrbbbbrrrrs.",
    "ssbbbbrbbrbbbbss",
    "ssbbbbbbbbbbbbss",
    ".kkkkk....kkkkk.",
    "kkkkkk....kkkkkk",
    "................"
  ];

  function heroBigSet(map) {
    var stand = draw(heroBigStand, map);
    var w1 = draw(heroBigWalk1, map);
    var w2 = draw(heroBigWalk2, map);
    var w3 = draw(heroBigStand, map);
    var jump = draw(heroBigJump, map);
    var crouch = draw(heroBigCrouch, map);
    return {
      stand: [stand, flipH(stand)],
      walk: [[w1, w2, w3], [flipH(w1), flipH(w2), flipH(w3)]],
      jump: [jump, flipH(jump)],
      crouch: [crouch, flipH(crouch)]
    };
  }

  S.heroSmall = heroSet(heroMap);
  S.heroBig = heroBigSet(heroMap);
  S.heroFire = heroBigSet(fireMap);
  S.heroSmallFire = heroSet(fireMap);

  // ---------- 敌人：栗子怪（原创造型） ----------
  var goombaWalk = [
    "....aaaaaaaa....",
    "...aaaaaaaaaa...",
    "..aaaaaaaaaaaa..",
    ".aaawwkaakwwaaa.",
    ".aawwkkaakkwwaa.",
    "aaawwkkaakkwwaaa",
    "aaaaaaaaaaaaaaaa",
    "aaaaaaaaaaaaaaaa",
    ".aaaaaaaaaaaaaa.",
    "..ssssssssssss..",
    ".sskksssssskkss.",
    ".skkkksssskkkks.",
    ".kkkkk....kkkkk.",
    "..kkk......kkk..",
    "................",
    "................"
  ];
  var goombaFlat = [
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "....aaaaaaaa....",
    "..aaaaaaaaaaaa..",
    ".aawwkaaaakwwaa.",
    "aaaaaaaaaaaaaaaa",
    ".kkkkkkkkkkkkkk.",
    "................",
    "................"
  ];
  var goombaMap = { a: PAL.goomba1, s: PAL.goomba2, k: PAL.black, w: PAL.white };
  S.goomba = [draw(goombaWalk, goombaMap), flipH(draw(goombaWalk, goombaMap))];
  S.goombaFlat = draw(goombaFlat, goombaMap);

  // ---------- 敌人：绿龟（原创造型 16x24） ----------
  var koopaWalk1 = [
    "..........gg....",
    ".........gggg...",
    ".........gwgw...",
    ".........gggg...",
    "........ssgg....",
    "........ssss....",
    "....aaaassss....",
    "...aabbaaas.....",
    "..aabbbbaaa.....",
    "..abbaabbaa.....",
    ".aabbaabbaa.....",
    ".aabbbbbbaa.....",
    ".aaabbbbaaa.....",
    "..aaaaaaaa......",
    "..ssssssss......",
    "...ss..ss.......",
    "..sss..sss......",
    "................"
  ];
  var koopaWalk2 = [
    "..........gg....",
    ".........gggg...",
    ".........gwgw...",
    ".........gggg...",
    "........ssgg....",
    "........ssss....",
    "....aaaassss....",
    "...aabbaaas.....",
    "..aabbbbaaa.....",
    "..abbaabbaa.....",
    ".aabbaabbaa.....",
    ".aabbbbbbaa.....",
    ".aaabbbbaaa.....",
    "..aaaaaaaa......",
    "..ssssssss......",
    "..ss....ss......",
    ".sss....sss.....",
    "................"
  ];
  var koopaMap = { a: PAL.shell1, b: PAL.shell2, s: PAL.skin, g: PAL.green, w: PAL.white };
  S.koopa = [
    [draw(koopaWalk1, koopaMap), draw(koopaWalk2, koopaMap)],
    [flipH(draw(koopaWalk1, koopaMap)), flipH(draw(koopaWalk2, koopaMap))]
  ];

  var shellGrid = [
    "................",
    "................",
    "....aaaaaaaa....",
    "...aabbbbbbaa...",
    "..aabbaabbabaa..",
    ".aabbaabbaabbaa.",
    ".aabbaabbaabbaa.",
    ".aabbbbbbbbbbaa.",
    ".aaabbbbbbbbaaa.",
    "..aaaaaaaaaaaa..",
    "...ssssssssss...",
    "................",
    "................",
    "................",
    "................",
    "................"
  ];
  S.shell = draw(shellGrid, koopaMap);

  // ---------- 道具 ----------
  var mushroomGrid = [
    "....aaaaaaaa....",
    "..aaawwaawwaaa..",
    ".aawwwaaaawwwaa.",
    ".awwwaaaaaawwwa.",
    "aawwaaawwaaawwaa",
    "aawaaawwwwaaawaa",
    "aaaaaawwwwaaaaaa",
    "aaawaaawwaaawaaa",
    ".aawwaaaaaawwaa.",
    "..aawwaaaawwaa..",
    "...ssssssssss...",
    "...swwsswwsss...",
    "...swwsswwsss...",
    "...ssssssssss...",
    "....ssssssss....",
    "................"
  ];
  S.mushroom = draw(mushroomGrid, { a: PAL.red, w: PAL.white, s: PAL.skin });
  S.oneUpShroom = draw(mushroomGrid, { a: PAL.green, w: PAL.white, s: PAL.skin });

  var flowerGrid = [
    "....ff..ff......",
    "...fwwffwwf.....",
    "...fwwffwwf.....",
    "....ff..ff......",
    "....ffffff......",
    "...fwwwwwwf.....",
    "...fwwwwwwf.....",
    "....ffffff......",
    "......gg........",
    "..g...gg...g....",
    "..gg..gg..gg....",
    "...gg.gg.gg.....",
    "....ggggggg.....",
    "......gg........",
    "......gg........",
    "................"
  ];
  S.flower = [
    draw(flowerGrid, { f: PAL.fire2, w: PAL.white, g: PAL.green }),
    draw(flowerGrid, { f: PAL.fire1, w: PAL.white, g: PAL.green })
  ];

  var starGrid = [
    ".......aa.......",
    ".......aa.......",
    "......aaaa......",
    "......aaaa......",
    ".aaaaaaaaaaaaaa.",
    "aaaaaaaaaaaaaaaa",
    ".aaaaaaaaaaaaaa.",
    "..aaaaaaaaaaaa..",
    "...aaaaaaaaaa...",
    "...aaaaaaaaaa...",
    "..aaaaa..aaaaa..",
    "..aaaa....aaaa..",
    ".aaa........aaa.",
    "................",
    "................",
    "................"
  ];
  S.star = [
    draw(starGrid, { a: PAL.coin1 }),
    draw(starGrid, { a: PAL.white })
  ];

  // 火球 8x8
  S.fireball = (function () {
    var c = makeCanvas(8, 8), g = c.getContext("2d");
    g.fillStyle = PAL.fire2; g.fillRect(1, 1, 6, 6);
    g.fillStyle = PAL.fire1; g.fillRect(2, 2, 4, 4);
    g.fillStyle = PAL.white; g.fillRect(3, 3, 2, 2);
    return c;
  })();

  // 碎砖块 8x8
  S.brickBit = (function () {
    var c = makeCanvas(8, 8), g = c.getContext("2d");
    g.fillStyle = PAL.brick1; g.fillRect(0, 0, 8, 8);
    g.fillStyle = PAL.brick2; g.fillRect(1, 1, 6, 3);
    g.fillStyle = PAL.brickDark; g.fillRect(0, 7, 8, 1);
    return c;
  })();

  // ---------- 3x5 位图字体 ----------
  var FONT = {
    "0": ["111", "101", "101", "101", "111"],
    "1": ["010", "110", "010", "010", "111"],
    "2": ["111", "001", "111", "100", "111"],
    "3": ["111", "001", "111", "001", "111"],
    "4": ["101", "101", "111", "001", "001"],
    "5": ["111", "100", "111", "001", "111"],
    "6": ["111", "100", "111", "101", "111"],
    "7": ["111", "001", "001", "010", "010"],
    "8": ["111", "101", "111", "101", "111"],
    "9": ["111", "101", "111", "001", "111"],
    "A": ["010", "101", "111", "101", "101"],
    "B": ["110", "101", "110", "101", "110"],
    "C": ["011", "100", "100", "100", "011"],
    "D": ["110", "101", "101", "101", "110"],
    "E": ["111", "100", "110", "100", "111"],
    "F": ["111", "100", "110", "100", "100"],
    "G": ["011", "100", "101", "101", "011"],
    "H": ["101", "101", "111", "101", "101"],
    "I": ["111", "010", "010", "010", "111"],
    "J": ["001", "001", "001", "101", "010"],
    "K": ["101", "110", "100", "110", "101"],
    "L": ["100", "100", "100", "100", "111"],
    "M": ["101", "111", "111", "101", "101"],
    "N": ["101", "111", "111", "111", "101"],
    "O": ["010", "101", "101", "101", "010"],
    "P": ["110", "101", "110", "100", "100"],
    "Q": ["010", "101", "101", "011", "001"],
    "R": ["110", "101", "110", "110", "101"],
    "S": ["011", "100", "010", "001", "110"],
    "T": ["111", "010", "010", "010", "010"],
    "U": ["101", "101", "101", "101", "111"],
    "V": ["101", "101", "101", "010", "010"],
    "W": ["101", "101", "111", "111", "101"],
    "X": ["101", "010", "010", "010", "101"],
    "Y": ["101", "101", "010", "010", "010"],
    "Z": ["111", "001", "010", "100", "111"],
    "-": ["000", "000", "111", "000", "000"],
    "×": ["000", "101", "010", "101", "000"],
    "x": ["000", "101", "010", "101", "000"],
    "!": ["010", "010", "010", "000", "010"],
    "?": ["110", "001", "010", "000", "010"],
    ".": ["000", "000", "000", "000", "010"],
    ":": ["000", "010", "000", "010", "000"],
    "/": ["001", "001", "010", "100", "100"],
    "©": ["011", "100", "100", "100", "011"],
    " ": ["000", "000", "000", "000", "000"]
  };

  function drawText(g, text, x, y, color) {
    g.fillStyle = color || "#fff";
    var cx = x;
    text = String(text).toUpperCase();
    for (var i = 0; i < text.length; i++) {
      var glyph = FONT[text[i]] || FONT["?"];
      for (var r = 0; r < 5; r++) {
        for (var c2 = 0; c2 < 3; c2++) {
          if (glyph[r][c2] === "1") g.fillRect(cx + c2, y + r, 1, 1);
        }
      }
      cx += 4;
    }
  }

  window.MarioSprites = { S: S, PAL: PAL, drawText: drawText, flipH: flipH };
})();
