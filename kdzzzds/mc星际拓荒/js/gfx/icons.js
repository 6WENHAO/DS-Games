"use strict";
// ============================================================
//  方块星野 BlockWilds - 物品像素图标 / UI 材质 / 等距方块图标
//  全部 16x16 手绘点阵（字符画定义），禁止占位符
// ============================================================
window.G = window.G || {};

(function() {
  var S = 16;

  // 字符画 -> canvas。pal: {字符: "rrggbb" 或 "rrggbbaa"}
  function sprite(rows, pal) {
    var c = document.createElement('canvas');
    c.width = S; c.height = S;
    var ctx = c.getContext('2d');
    var id = ctx.createImageData(S, S);
    var d = id.data;
    for (var y = 0; y < S; y++) {
      var row = rows[y] || '';
      for (var x = 0; x < S; x++) {
        var ch = row[x] || '.';
        if (ch === '.' || ch === ' ') continue;
        var hx = pal[ch]; if (!hx) continue;
        var n = parseInt(hx.substring(0, 6), 16);
        var a = hx.length >= 8 ? parseInt(hx.substring(6, 8), 16) : 255;
        var i = (y * S + x) * 4;
        d[i] = (n >> 16) & 255; d[i + 1] = (n >> 8) & 255; d[i + 2] = n & 255; d[i + 3] = a;
      }
    }
    ctx.putImageData(id, 0, 0);
    return c;
  }

  var ICONS = {};

  // ---------------- 挪麦翻译机：双叉探针 + 青绿辉光屏 ----------------
  ICONS.translator = sprite([
    ".dd..........dd.",
    "dccd........dccd",
    "dccd........dccd",
    ".dd..........dd.",
    "..m..........m..",
    "..mm........mm..",
    "...mmmmmmmmmm...",
    "..mssssssssssm..",
    "..msccbbbbccsm..",
    "..msbccccccbsm..",
    "..mssssssssssm..",
    "...mmmmmmmmmm...",
    ".......mm.......",
    "......mhhm......",
    "......mhhm......",
    ".......mm......."
  ], { d: "1a4a44", c: "55e6c8", b: "1d7a68", m: "8d9494", s: "23313a", h: "6b4a2e" });

  // ---------------- 信号镜：斜置镜筒 + 镜片高光 ----------------
  ICONS.signalscope = sprite([
    "............ddd.",
    "...........dllcd",
    "..........dlccd.",
    ".........dmccd..",
    "........dmmcd...",
    ".......dmmcd....",
    "......dmmcd.....",
    ".....dmmcd......",
    "....dmmcd.......",
    "...dmmcd........",
    "..dggcd.........",
    ".dggcd..........",
    ".dhgd...........",
    "dhhd............",
    "dhd.............",
    ".d.............."
  ], { d: "23272e", l: "bfe9ff", c: "5b6570", m: "8d9494", g: "6f7880", h: "6b4a2e" });

  // ---------------- 小侦察兵发射器：短筒 + 侦察兵指示灯 ----------------
  ICONS.scout = sprite([
    "....dddddd......",
    "...dmmmmmmd.....",
    "..dmsssssmd.....",
    ".dmsbccbssmdddd.",
    ".dmsbccbssmmmmd.",
    ".dmsssssssssssd.",
    "..dmmmmmmmmmmd..",
    "....ddddddhhd...",
    "..........dhhd..",
    "..........dhhd..",
    "...........dd...",
    "......e.........",
    ".....eee........",
    "......e.........",
    "................",
    "................"
  ], { d: "23272e", m: "9aa2a2", s: "394450", b: "0e5a50", c: "55e6c8", h: "6b4a2e", e: "ffd24d" });

  // ---------------- 棉花糖（生/烤/焦） ----------------
  function mallow(body, hi, lo) {
    return sprite([
      "................",
      "....wwwwww......",
      "...whhhhhhw.....",
      "..whhbbbbhhw....",
      "..whbbbbbbhw....",
      "..whbbbbbbhw....",
      "..whhbbbbhhw....",
      "...wwhhhhww.....",
      "....wwwwww......",
      "........s.......",
      ".........s......",
      "..........s.....",
      "...........s....",
      "............s...",
      ".............s..",
      "................"
    ], { w: lo, h: hi, b: body, s: "8a5a30" });
  }
  ICONS.marshmallow = mallow("fffdf5", "f2ecd8", "d9d2bd");
  ICONS.marshmallow_roasted = mallow("e8a84d", "d98f35", "a05f1d");
  ICONS.marshmallow_burnt = mallow("3a3230", "554741", "241e1c");

  window.__ICONS_PART1 = ICONS;
  window.__spriteFn = sprite;
})();

(function() {
  var sprite = window.__spriteFn;
  var ICONS = window.__ICONS_PART1;

  // ---------------- 木棍 ----------------
  ICONS.stick = sprite([
    "................",
    "............bb..",
    "...........bhb..",
    "..........bhb...",
    ".........bhb....",
    "........bhb.....",
    ".......bhb......",
    "......bhb.......",
    ".....bhb........",
    "....bhb.........",
    "...bhb..........",
    "..bhb...........",
    "..bb............",
    "................",
    "................",
    "................"
  ], { b: "5a3d1e", h: "8a5f30" });

  // ---------------- 煤炭 ----------------
  ICONS.coal = sprite([
    "................",
    "................",
    ".....dddd.......",
    "....dkkkdd......",
    "...dkhkkkkd.....",
    "..dkkkkhkkd.....",
    "..dkhkkkkkdd....",
    "..dkkkkkhkkd....",
    "...dkkhkkkkd....",
    "...dkkkkkhd.....",
    "....ddkkkd......",
    "......ddd.......",
    "................",
    "................",
    "................",
    "................"
  ], { d: "141414", k: "2e2e2e", h: "4b4b4b" });

  // ---------------- 锭（铁/铜共用形状） ----------------
  function ingot(hi, mid, lo) {
    return sprite([
      "................",
      "................",
      "................",
      "....hhhhhhhh....",
      "...hmmmmmmmmh...",
      "..hmmhhhhhmmmh..",
      ".hmmmmmmmmmmmlh.",
      ".hmllllllllmllh.",
      "..hlllllllllll..",
      "...llllllllll...",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................"
    ], { h: hi, m: mid, l: lo });
  }
  ICONS.iron_ingot = ingot("e8e8e8", "c8c8c8", "8f8f8f");
  ICONS.copper_ingot = ingot("f0a070", "d07850", "9a5030");

  // ---------------- 氧气罐（蓝）/ 燃料罐（橙渐变=燃料家族） ----------------
  function tank(top, body, dark, label) {
    return sprite([
      "......mm........",
      ".....mssm.......",
      "......dd........",
      ".....tttt.......",
      "....tbbbbt......",
      "....tbbbbt......",
      "....bblbbb......",
      "....bllllb......",
      "....blaalb......",
      "....blaalb......",
      "....bllllb......",
      "....bblbbb......",
      "....dbbbbd......",
      "....dbbbbd......",
      ".....dddd.......",
      "................"
    ], { m: "9aa2a2", s: "394450", d: dark, t: top, b: body, l: "ffffff40", a: label });
  }
  ICONS.oxygen_tank = tank("9fd8ff", "3a78c8", "1d3c6e", "0e5a50");
  ICONS.fuel_tank = tank("ffd24d", "e07818", "7a3a08", "b02818");

  // ---------------- 维修工具（扳手） ----------------
  ICONS.repair_kit = sprite([
    "....hh...hh.....",
    "....hmh.hmh.....",
    "....hmmhmmh.....",
    ".....hmmmh......",
    "......hmh.......",
    "......hmh.......",
    "......hmh.......",
    "......hmh.......",
    "......hmh.......",
    "......hmh.......",
    "......hmh.......",
    ".....hmmmh......",
    "....hmmmmmh.....",
    "....hmmhmmh.....",
    ".....hh.hh......",
    "................"
  ], { h: "3c4248", m: "aab2b8" });

  // ---------------- 提灯 ----------------
  ICONS.lantern = sprite([
    "......dd........",
    ".....d..d.......",
    "......dd........",
    ".....dddd.......",
    "....dmmmmd......",
    "...dmgggggd.....",
    "...dmgfffgd.....",
    "...dmgfffgd.....",
    "...dmgffagd.....",
    "...dmgfaagd.....",
    "...dmgggggd.....",
    "....dmmmmd......",
    ".....dddd.......",
    "................",
    "................",
    "................"
  ], { d: "2c2c30", m: "5a5a60", g: "1c1a14", f: "ffcf6e", a: "ff8a2a" });

  // ---------------- 挪麦卷轴 ----------------
  ICONS.nomai_scroll = sprite([
    "................",
    "...mm......mm...",
    "..mppm....mppm..",
    "..mppmmmmmmppm..",
    "..mpppppppppm...",
    "...mpwwwwwwpm...",
    "...mpwsswswpm...",
    "...mpwswwswpm...",
    "...mpwsswswpm...",
    "...mpwwwswwpm...",
    "...mpwsssswpm...",
    "...mpwwwwwwpm...",
    "..mpppppppppm...",
    "..mppm....mppm..",
    "...mm......mm...",
    "................"
  ], { m: "3a2a4e", p: "8a5fc8", w: "d8c8a0", s: "6a4a9e" });

  // ---------------- 先进跃迁核心 ----------------
  ICONS.warp_core = sprite([
    "......dd........",
    ".....dmmd.......",
    "....dmppmd......",
    "...dmpccpmd.....",
    "...dmpcwcpmd....",
    "..dmpcwwwcpmd...",
    "..dmpcwwwcpmd...",
    "..dmpcwwwcpmd...",
    "...dmpcwcpmd....",
    "...dmpccpmd.....",
    "....dmppmd......",
    ".....dmmd.......",
    "......dd........",
    ".....d..d.......",
    "....d....d......",
    "................"
  ], { d: "1a1024", m: "4a3a6e", p: "8a5fc8", c: "c8a0ff", w: "ffffff" });

  window.__ICONS_PART1 = ICONS;
})();

(function() {
  var sprite = window.__spriteFn;
  var ICONS = window.__ICONS_PART1;
  var U = G.U;

  // ---------------- HUD 分段小图标（心/氧气泡/燃料焰） ----------------
  var HUD = {};
  HUD.heart_full = sprite([
    "................",
    "................",
    "..dd.....dd.....",
    ".drrd...drrd....",
    "drhrrd.drrrrd...",
    "drrrrrdrrrrrd...",
    "drrrrrrrrrrrd...",
    ".drrrrrrrrrd....",
    "..drrrrrrrd.....",
    "...drrrrrd......",
    "....drrrd.......",
    ".....drd........",
    "......d.........",
    "................",
    "................",
    "................"
  ], { d: "1c0000", r: "e02020", h: "ff8080" });
  HUD.heart_empty = sprite([
    "................",
    "................",
    "..dd.....dd.....",
    ".dkkd...dkkd....",
    "dkkkkd.dkkkkd...",
    "dkkkkkdkkkkkd...",
    "dkkkkkkkkkkkd...",
    ".dkkkkkkkkkd....",
    "..dkkkkkkkd.....",
    "...dkkkkkd......",
    "....dkkkd.......",
    ".....dkd........",
    "......d.........",
    "................",
    "................",
    "................"
  ], { d: "000000", k: "3a3a3a" });
  HUD.bubble_full = sprite([
    "................",
    "................",
    "....dddddd......",
    "...dbbbbbbd.....",
    "..dbwwbbbbbd....",
    "..dbwbbbbbbd....",
    "..dbbbbbbbbd....",
    "..dbbbbbbbbd....",
    "..dbbbbbbwbd....",
    "..dbbbbbbbbd....",
    "...dbbbbbbd.....",
    "....dddddd......",
    "................",
    "................",
    "................",
    "................"
  ], { d: "10284a", b: "4da0e8", w: "cfeaff" });
  HUD.bubble_empty = sprite([
    "................",
    "................",
    "....dddddd......",
    "...d......d.....",
    "..d........d....",
    "..d........d....",
    "..d........d....",
    "..d........d....",
    "..d........d....",
    "..d........d....",
    "...d......d.....",
    "....dddddd......",
    "................",
    "................",
    "................",
    "................"
  ], { d: "1a2a3a80" });
  HUD.flame_full = sprite([
    "................",
    ".......d........",
    "......dfd.......",
    "......dfd.......",
    ".....dffd.......",
    "....dffffd......",
    "....dfoffd......",
    "...dfoofffd.....",
    "...dfoooffd.....",
    "...dfowoffd.....",
    "...dfowoofd.....",
    "....dfoofd......",
    ".....dffd.......",
    "......dd........",
    "................",
    "................"
  ], { d: "3a1200", f: "ff9a1a", o: "ffd24d", w: "fff0b0" });
  HUD.flame_empty = sprite([
    "................",
    ".......d........",
    "......dkd.......",
    "......dkd.......",
    ".....dkkd.......",
    "....dkkkkd......",
    "....dkkkkd......",
    "...dkkkkkkd.....",
    "...dkkkkkkd.....",
    "...dkkkkkkd.....",
    "...dkkkkkkd.....",
    "....dkkkkd......",
    ".....dkkd.......",
    "......dd........",
    "................",
    "................"
  ], { d: "000000", k: "3a3028" });

  // ---------------- 等距 3D 方块图标（物品栏里的方块） ----------------
  function isoBlockIcon(topTile, sideTile, side2Tile) {
    var c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    var x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    var w = 14, hh = 7;
    // 顶面（菱形）
    x.save();
    x.translate(16, 2);
    x.transform(1, 0.5, -1, 0.5, 0, 0);
    x.drawImage(topTile, 0, 0, 16, 16, 0, 0, w, w);
    x.restore();
    // 左面
    x.save();
    x.translate(16 - w, 2 + hh);
    x.transform(1, 0.5, 0, 1, 0, 0);
    x.filter = 'brightness(0.72)';
    x.drawImage(sideTile, 0, 0, 16, 16, 0, 0, w, w);
    x.restore();
    // 右面
    x.save();
    x.translate(16, 2 + hh + w * 0.5);
    x.transform(1, -0.5, 0, 1, 0, 0);
    x.filter = 'brightness(0.55)';
    x.drawImage(side2Tile || sideTile, 0, 0, 16, 16, 0, 0, w, w);
    x.restore();
    return c;
  }

  // 平面物品图（cross 渲染方块：火把、草等直接用瓦片图）
  function flatIcon(tile) {
    var c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    var x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(tile, 0, 0, 16, 16, 0, 0, 32, 32);
    return c;
  }

  window.__ICONS_HUD = HUD;
  window.__isoBlockIcon = isoBlockIcon;
  window.__flatIcon = flatIcon;
})();

(function() {
  var U = G.U;

  // ---------------- UI 面板材质（程序化：木板/石头/羊皮纸/挪麦石板） ----------------
  function makePanelTex(kind, size) {
    size = size || 64;
    var c = document.createElement('canvas');
    c.width = size; c.height = size;
    var x = c.getContext('2d');
    var id = x.createImageData(size, size);
    var d = id.data;
    function px(i, r, g, b) { d[i] = r; d[i+1] = g; d[i+2] = b; d[i+3] = 255; }
    for (var yy = 0; yy < size; yy++) {
      for (var xx = 0; xx < size; xx++) {
        var i = (yy * size + xx) * 4;
        var n = U.hash3(xx, yy, 0, kind === 'wood' ? 11 : kind === 'stone' ? 22 : kind === 'paper' ? 33 : 44);
        var n2 = U.noise3(xx * 0.12, yy * 0.12, 0, 77);
        if (kind === 'wood') {
          var band = Math.floor(yy / 16) % 2;
          var grain = Math.sin(xx * 0.45 + n2 * 6) * 0.5 + 0.5;
          var base = 128 + band * 8 + grain * 18 + n * 14 - 18;
          if (yy % 16 === 0) base *= 0.55;
          px(i, base * 0.86, base * 0.62, base * 0.36);
        } else if (kind === 'stone') {
          var v = 116 + n2 * 42 + n * 22 - 20;
          if (n > 0.93) v *= 0.8;
          px(i, v, v, v * 1.02);
        } else if (kind === 'paper') {
          var p = 216 + n2 * 20 + n * 12 - 10;
          px(i, p, p * 0.92, p * 0.72);
        } else { // nomai
          var q = 92 + n2 * 30 + n * 16 - 12;
          px(i, q * 0.9, q * 0.98, q * 1.05);
        }
      }
    }
    x.putImageData(id, 0, 0);
    return c;
  }

  // 面板角落装饰：挪麦螺旋 × 方格纹融合
  function makeCornerTex() {
    var c = document.createElement('canvas');
    c.width = 14; c.height = 14;
    var x = c.getContext('2d');
    x.fillStyle = 'rgba(40,30,16,0.85)';
    var spiral = [
      [1,1],[2,1],[3,1],[4,1],[5,1],[6,1],
      [1,2],[1,3],[1,4],[1,5],[1,6],
      [6,2],[6,3],[3,3],[4,3],[5,3],
      [3,4],[3,5],[5,5],[4,5],[6,5]
    ];
    for (var k = 0; k < spiral.length; k++) x.fillRect(spiral[k][0]*2, spiral[k][1]*2, 2, 2);
    return c;
  }

  // ---------------- 公开 API ----------------
  var _icons = window.__ICONS_PART1;
  var _hud = window.__ICONS_HUD;
  var _blockIconCache = {};
  var _urls = {};

  G.Icons = {
    init: function() {
      // 面板材质 -> CSS 变量
      var wood = makePanelTex('wood').toDataURL();
      var stone = makePanelTex('stone').toDataURL();
      var paper = makePanelTex('paper').toDataURL();
      var nomai = makePanelTex('nomai').toDataURL();
      var corner = makeCornerTex().toDataURL();
      var st = document.documentElement.style;
      st.setProperty('--tex-wood', 'url(' + wood + ')');
      st.setProperty('--tex-stone', 'url(' + stone + ')');
      st.setProperty('--tex-paper', 'url(' + paper + ')');
      st.setProperty('--tex-nomai', 'url(' + nomai + ')');
      st.setProperty('--tex-corner', 'url(' + corner + ')');
      st.setProperty('--btn-tex', 'url(' + stone + ')');
      this.texURL = { wood: wood, stone: stone, paper: paper, nomai: nomai, corner: corner };
    },

    // 物品图标 URL（自动缓存）
    itemURL: function(key) {
      if (_urls['i:' + key]) return _urls['i:' + key];
      var cv = _icons[key];
      if (!cv) return '';
      var url = cv.toDataURL();
      _urls['i:' + key] = url;
      return url;
    },

    // 方块图标 URL
    blockURL: function(blockId) {
      var k = 'b:' + blockId;
      if (_urls[k]) return _urls[k];
      var def = G.BLOCKS[blockId];
      if (!def) return '';
      var cv;
      if (_blockIconCache[blockId]) cv = _blockIconCache[blockId];
      else {
        var tiles = def.tiles;
        var top, side, bottom;
        if (typeof tiles === 'string') { top = side = bottom = tiles; }
        else { top = tiles[0]; side = tiles[1]; bottom = tiles[2] || tiles[1]; }
        var tc = G.Textures.tileCanvas(top), sc = G.Textures.tileCanvas(side);
        if (def.render === 'cross' || def.render === 'liquid') {
          cv = window.__flatIcon(sc || tc);
        } else {
          cv = window.__isoBlockIcon(tc, sc, sc);
        }
        _blockIconCache[blockId] = cv;
      }
      var url = cv.toDataURL();
      _urls[k] = url;
      return url;
    },

    hudURL: function(name) {
      var k = 'h:' + name;
      if (_urls[k]) return _urls[k];
      var cv = _hud[name];
      if (!cv) return '';
      var url = cv.toDataURL();
      _urls[k] = url;
      return url;
    },

    hasItemIcon: function(key) { return !!_icons[key]; }
  };
})();
