/* 铁幕1994 — 地图生成器与战场定义 */
(function () {
  'use strict';
  var IC = window.IC;
  var U = IC.Util, Hex = IC.Hex;

  var PROFILES = {
    fulda: {
      name: '富尔达缺口', base: ['field', 'plain', 'field', 'grove'],
      forest: 0.20, hill: 0.14, town: 5, city: 0, marsh: 0.01,
      river: { count: 1, orient: 'v', bridges: 2 }, roads: 2, radiation: 2,
      places: ['富尔达', '阿尔斯费尔德', '许恩费尔德', '劳特巴赫', '格罗森吕德', '海尔斯费尔德']
    },
    thuringia: {
      name: '图林根走廊', base: ['plain', 'field', 'grove', 'plain'],
      forest: 0.26, hill: 0.20, town: 4, city: 1, marsh: 0.01,
      river: { count: 1, orient: 'v', bridges: 2 }, roads: 2, radiation: 3,
      places: ['爱森纳赫', '哥达', '爱尔福特', '苏尔', '米尔豪森', '魏玛']
    },
    elbe: {
      name: '易北河防线', base: ['field', 'plain', 'field'],
      forest: 0.16, hill: 0.10, town: 4, city: 1, marsh: 0.04,
      river: { count: 1, orient: 'v', bridges: 3, wide: true }, roads: 3, radiation: 3,
      places: ['德累斯顿', '迈森', '里萨', '皮尔纳', '弗赖塔尔', '拉德博伊尔']
    },
    poland: {
      name: '西里西亚平原', base: ['field', 'plain', 'steppe', 'field'],
      forest: 0.14, hill: 0.07, town: 5, city: 1, marsh: 0.03,
      river: { count: 2, orient: 'v', bridges: 3 }, roads: 3, radiation: 4,
      places: ['弗罗茨瓦夫', '奥波莱', '莱格尼察', '卡利什', '琴斯托霍瓦', '凯尔采']
    },
    belarus: {
      name: '白俄罗斯走廊', base: ['plain', 'field', 'grove', 'plain'],
      forest: 0.32, hill: 0.06, town: 4, city: 1, marsh: 0.12,
      river: { count: 2, orient: 'v', bridges: 2 }, roads: 2, radiation: 4,
      places: ['明斯克', '鲍里索夫', '奥尔沙', '莫吉廖夫', '维捷布斯克', '斯摩棱斯克']
    },
    volga: {
      name: '伏尔加河渡口', base: ['steppe', 'plain', 'steppe', 'field'],
      forest: 0.10, hill: 0.12, town: 4, city: 1, marsh: 0.05,
      river: { count: 1, orient: 'v', bridges: 2, wide: true, huge: true }, roads: 2, radiation: 4,
      places: ['乌里扬诺夫斯克', '梅列克斯', '瑟兹兰', '喀山', '季米特洛夫格拉德', '新乌里扬诺夫斯克']
    },
    samara: {
      name: '萨马拉', base: ['steppe', 'plain', 'field'],
      forest: 0.10, hill: 0.14, town: 6, city: 4, marsh: 0.02,
      river: { count: 1, orient: 'v', bridges: 3, wide: true }, roads: 3, radiation: 5,
      places: ['萨马拉市中心', '别兹米扬卡工业区', '库比雪夫机械厂', '沃尔加河码头', '基涅利枢纽', '新古比雪夫斯克'],
      finale: true
    },
    ruhr: {
      name: '鲁尔与莱茵', base: ['field', 'plain', 'town'],
      forest: 0.12, hill: 0.08, town: 7, city: 3, marsh: 0.03,
      river: { count: 1, orient: 'v', bridges: 3, wide: true }, roads: 4, radiation: 4,
      places: ['杜伊斯堡', '埃森', '杜塞尔多夫', '科隆', '韦塞尔', '雷姆沙伊德']
    },
    hannover: {
      name: '下萨克森平原', base: ['field', 'plain', 'field', 'grove'],
      forest: 0.18, hill: 0.09, town: 5, city: 1, marsh: 0.05,
      river: { count: 1, orient: 'v', bridges: 2 }, roads: 3, radiation: 3,
      places: ['汉诺威', '策勒', '希尔德斯海姆', '佩内', '沃尔夫斯堡', '吉夫霍恩']
    },
    lowlands: {
      name: '低地国家', base: ['field', 'plain', 'marsh', 'field'],
      forest: 0.08, hill: 0.02, town: 6, city: 2, marsh: 0.18,
      river: { count: 3, orient: 'v', bridges: 4 }, roads: 3, radiation: 3,
      places: ['安特卫普港', '鹿特丹', '布雷达', '蒂尔堡', '斯海尔德河口', '艾恩德霍芬']
    },
    channel: {
      name: '英吉利海峡', base: ['coast', 'field', 'plain'],
      forest: 0.06, hill: 0.06, town: 3, city: 1, marsh: 0.02,
      river: { count: 0 }, roads: 2, radiation: 2,
      sea: { edge: 'west', width: 5 },
      places: ['加来登船场', '敦刻尔克', '奥斯坦德', '布洛涅', '海峡雷达站', '格拉沃利讷']
    },
    anglia: {
      name: '东盎格利亚登陆场', base: ['field', 'plain', 'field'],
      forest: 0.12, hill: 0.05, town: 5, city: 1, marsh: 0.08,
      river: { count: 1, orient: 'v', bridges: 2 }, roads: 3, radiation: 2,
      sea: { edge: 'east', width: 4 },
      places: ['费利克斯托', '哈里奇', '伊普斯威奇', '科尔切斯特', '克拉克顿', '沃尔顿']
    },
    thames: {
      name: '泰晤士走廊', base: ['field', 'town', 'plain'],
      forest: 0.10, hill: 0.08, town: 7, city: 2, marsh: 0.06,
      river: { count: 1, orient: 'h', bridges: 4, wide: true }, roads: 4, radiation: 3,
      places: ['切姆斯福德', '蒂尔伯里', '罗姆福德', '格雷夫森德', '巴斯尔登', '达特福德']
    },
    london: {
      name: '大伦敦', base: ['town', 'field', 'town'],
      forest: 0.06, hill: 0.05, town: 8, city: 5, marsh: 0.02,
      river: { count: 1, orient: 'h', bridges: 4, wide: true }, roads: 5, radiation: 5,
      places: ['白厅', '威斯敏斯特', '伦敦城', '东区码头', '希思罗', '格林尼治'],
      finale: true
    },
    /* 遭遇战通用 */
    skirmish_plain: {
      name: '中欧平原', base: ['field', 'plain', 'grove'],
      forest: 0.18, hill: 0.12, town: 5, city: 1, marsh: 0.03,
      river: { count: 1, orient: 'v', bridges: 2 }, roads: 3, radiation: 2,
      places: ['A 村', 'B 镇', '十字路口', '铁路枢纽', '化工厂', '林场']
    },
    skirmish_urban: {
      name: '工业城区', base: ['town', 'field', 'town'],
      forest: 0.06, hill: 0.05, town: 8, city: 4, marsh: 0.01,
      river: { count: 1, orient: 'v', bridges: 3 }, roads: 4, radiation: 3,
      places: ['市政厅', '火车站', '钢铁厂', '河港', '住宅区', '发电站']
    },
    skirmish_forest: {
      name: '森林与沼泽', base: ['plain', 'grove', 'field'],
      forest: 0.38, hill: 0.10, town: 3, city: 0, marsh: 0.16,
      river: { count: 2, orient: 'v', bridges: 2 }, roads: 2, radiation: 3,
      places: ['林务站', '伐木村', '泥沼渡口', '猎人小屋', '防火道', '沙石坑']
    }
  };
  IC.MapProfiles = PROFILES;

  var MapGen = IC.MapGen = {};

  MapGen.qStart = function (r) { return -Math.floor(r / 2); };

  MapGen.generate = function (def) {
    var prof = PROFILES[def.profile] || PROFILES.skirmish_plain;
    var rng = new IC.RNG(def.seed || 12345);
    var w = def.w || 22, h = def.h || 15;
    var hexes = {}, list = [];

    function put(q, r, t) {
      var k = Hex.key(q, r);
      var hx = { q: q, r: r, t: t, road: 0, rad: 0, entrench: 0, smoke: 0, fire: 0, col: q - MapGen.qStart(r), row: r };
      hexes[k] = hx; list.push(hx); return hx;
    }
    function at(q, r) { return hexes[Hex.key(q, r)]; }
    function atCol(col, row) {
      if (row < 0 || row >= h || col < 0 || col >= w) return null;
      return at(MapGen.qStart(row) + col, row);
    }

    /* 基础地形 + 平滑噪声 */
    var noise = [];
    for (var r0 = 0; r0 < h; r0++) {
      noise[r0] = [];
      for (var c0 = 0; c0 < w; c0++) noise[r0][c0] = rng.next();
    }
    function smooth(times) {
      for (var t = 0; t < times; t++) {
        var nn = [];
        for (var y = 0; y < h; y++) {
          nn[y] = [];
          for (var x = 0; x < w; x++) {
            var s = 0, n = 0;
            for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
              var yy = y + dy, xx = x + dx;
              if (yy < 0 || yy >= h || xx < 0 || xx >= w) continue;
              s += noise[yy][xx]; n++;
            }
            nn[y][x] = s / n;
          }
        }
        noise = nn;
      }
    }
    smooth(2);

    for (var r = 0; r < h; r++) {
      for (var c = 0; c < w; c++) {
        var q = MapGen.qStart(r) + c;
        var v = noise[r][c];
        var t = prof.base[Math.floor(rng.next() * prof.base.length)];
        if (v > 1 - prof.forest) t = (rng.next() < 0.35 ? 'grove' : 'forest');
        else if (v < prof.hill) t = (rng.next() < 0.25 ? 'ridge' : 'hill');
        else if (v > 0.52 && v < 0.52 + prof.marsh) t = 'marsh';
        put(q, r, t);
      }
    }

    /* 海洋 */
    if (prof.sea) {
      for (var rr = 0; rr < h; rr++) {
        for (var i = 0; i < prof.sea.width; i++) {
          var col = prof.sea.edge === 'west' ? i : w - 1 - i;
          var hx = atCol(col, rr);
          if (!hx) continue;
          var edgeDist = i + (rng.next() < 0.35 ? 1 : 0);
          hx.t = edgeDist < prof.sea.width - 1 ? 'sea' : 'coast';
        }
      }
    }

    /* 河流 */
    var bridgeCols = [];
    if (prof.river && prof.river.count) {
      for (var ri = 0; ri < prof.river.count; ri++) {
        var vertical = (prof.river.orient !== 'h');
        var width = prof.river.huge ? 3 : (prof.river.wide ? 2 : 1);
        if (vertical) {
          var col = Math.floor(w * (0.32 + 0.34 * ri / Math.max(1, prof.river.count - 1 || 1)) + rng.range(-2, 2));
          col = U.clamp(col, 3, w - 4);
          for (var y2 = 0; y2 < h; y2++) {
            col += rng.next() < 0.35 ? (rng.next() < 0.5 ? -1 : 1) : 0;
            col = U.clamp(col, 2, w - 3);
            for (var ww = 0; ww < width; ww++) {
              var hh = atCol(col + ww, y2);
              if (hh && hh.t !== 'sea') hh.t = 'river';
            }
          }
          bridgeCols.push(col);
        } else {
          var row = Math.floor(h * 0.5 + rng.range(-2, 2));
          row = U.clamp(row, 2, h - 3);
          for (var x2 = 0; x2 < w; x2++) {
            row += rng.next() < 0.3 ? (rng.next() < 0.5 ? -1 : 1) : 0;
            row = U.clamp(row, 1, h - 2);
            for (var w2 = 0; w2 < width; w2++) {
              var h2 = atCol(x2, row + w2);
              if (h2 && h2.t !== 'sea') h2.t = 'river';
            }
          }
        }
      }
      /* 桥梁/浅滩 */
      var nB = prof.river.bridges || 2;
      for (var b = 0; b < nB; b++) {
        var targetRow = Math.floor((b + 0.5) * h / nB + rng.range(-1, 1));
        targetRow = U.clamp(targetRow, 0, h - 1);
        var made = false;
        for (var cx = 0; cx < w && !made; cx++) {
          var cell = atCol(cx, targetRow);
          if (cell && cell.t === 'river') {
            var kind = rng.next() < 0.7 ? 'bridge' : 'ford';
            for (var span = 0; span < 4; span++) {
              var cc = atCol(cx + span, targetRow);
              if (!cc || cc.t !== 'river') break;
              cc.t = kind; cc.road = kind === 'bridge' ? 1 : 0;
            }
            made = true;
          }
        }
        if (!made) {
          for (var cy = 0; cy < h; cy++) {
            for (var cxx = 0; cxx < w; cxx++) {
              var cl = atCol(cxx, cy);
              if (cl && cl.t === 'river' && rng.next() < 0.05) { cl.t = 'bridge'; cl.road = 1; }
            }
          }
        }
      }
    }

    /* 城镇与城市（成簇） */
    var settlements = [];
    var wantTowns = prof.town || 4, wantCity = prof.city || 0;
    var tries = 0;
    while (settlements.length < wantTowns + wantCity && tries < 400) {
      tries++;
      var sc = Math.floor(rng.range(prof.sea ? prof.sea.width + 1 : 1, w - 1));
      var sr = Math.floor(rng.range(1, h - 1));
      var center = atCol(sc, sr);
      if (!center || center.t === 'river' || center.t === 'sea') continue;
      var tooClose = settlements.some(function (s) { return Math.abs(s.col - sc) + Math.abs(s.row - sr) < 4; });
      if (tooClose) continue;
      var isCity = settlements.length < wantCity;
      var size = isCity ? 3 : (rng.next() < 0.5 ? 1 : 2);
      var cells = Hex.spiral(center.q, center.r, size <= 1 ? 1 : (isCity ? 2 : 1));
      cells.forEach(function (p, idx) {
        var cell2 = at(p.q, p.r);
        if (!cell2 || cell2.t === 'river' || cell2.t === 'sea' || cell2.t === 'bridge') return;
        if (isCity) cell2.t = idx === 0 || rng.next() < 0.6 ? 'city' : 'town';
        else cell2.t = rng.next() < 0.75 ? 'town' : 'field';
      });
      settlements.push({ col: sc, row: sr, q: center.q, r: center.r, city: isCity,
        name: prof.places[settlements.length % prof.places.length] });
    }

    /* 道路：横贯东西的主干 + 连接城镇 */
    for (var road = 0; road < (prof.roads || 2); road++) {
      var ry = Math.floor((road + 0.5) * h / (prof.roads || 2) + rng.range(-1, 1));
      ry = U.clamp(ry, 0, h - 1);
      for (var rx = 0; rx < w; rx++) {
        ry += rng.next() < 0.25 ? (rng.next() < 0.5 ? -1 : 1) : 0;
        ry = U.clamp(ry, 0, h - 1);
        var rh = atCol(rx, ry);
        if (rh && rh.t !== 'sea') { if (rh.t === 'river') { rh.t = 'bridge'; } rh.road = 1; }
      }
    }
    settlements.forEach(function (s) {
      var cur = { q: s.q, r: s.r };
      var target = settlements[Math.floor(rng.next() * settlements.length)];
      var guard = 0;
      while ((cur.q !== target.q || cur.r !== target.r) && guard++ < 40) {
        var d = Hex.dirTo(cur, { q: target.q, r: target.r });
        var nx = Hex.neighbor(cur.q, cur.r, d);
        var nh = at(nx.q, nx.r);
        if (!nh) break;
        if (nh.t === 'river') nh.t = 'bridge';
        if (nh.t !== 'sea') nh.road = 1;
        cur = nx;
      }
    });

    /* 核污染区（架空1994：开战 72 小时的战术核突击残留） */
    var radPatches = def.radiation != null ? def.radiation : (prof.radiation || 0);
    for (var rp = 0; rp < radPatches; rp++) {
      var pc = Math.floor(rng.range(1, w - 1)), pr = Math.floor(rng.range(1, h - 1));
      var pcen = atCol(pc, pr);
      if (!pcen) continue;
      var rad = rng.int(1, 2);
      Hex.spiral(pcen.q, pcen.r, rad).forEach(function (p) {
        var cell3 = at(p.q, p.r);
        if (!cell3) return;
        var d2 = Hex.dist(p, { q: pcen.q, r: pcen.r });
        var lvl = U.clamp(3 - d2, 1, 3);
        cell3.rad = Math.max(cell3.rad, lvl);
        if (d2 === 0 && (cell3.t === 'town' || cell3.t === 'city')) cell3.t = 'ruins';
        if (d2 <= 1 && cell3.t === 'forest') cell3.t = 'grove';
      });
    }

    /* 目标点 */
    var objectives = [];
    var objCount = def.objectives || 5;
    var pool = settlements.slice();
    // 目标点按东西均匀分布
    pool.sort(function (a, b) { return a.col - b.col; });
    for (var oi = 0; oi < objCount; oi++) {
      var pick;
      if (pool.length) {
        var idx2 = Math.floor(oi * pool.length / objCount);
        pick = pool[U.clamp(idx2, 0, pool.length - 1)];
        pool.splice(pool.indexOf(pick), 1);
      }
      if (!pick) {
        var fc = Math.floor(rng.range(3, w - 3)), fr = Math.floor(rng.range(1, h - 1));
        var fh = atCol(fc, fr);
        if (!fh) continue;
        pick = { q: fh.q, r: fh.r, col: fc, row: fr, name: (prof.places[oi % prof.places.length] || ('目标 ' + (oi + 1))) };
      }
      var vp = pick.city ? 4 : 3;
      objectives.push({
        id: 'obj' + (oi + 1), q: pick.q, r: pick.r, name: pick.name || ('目标点 ' + (oi + 1)),
        vp: vp, owner: null, label: String.fromCharCode(65 + oi)
      });
    }

    /* 部署区：西侧 / 东侧若干列 */
    var dz = def.deployWidth || 3;
    var west = [], east = [];
    for (var dr = 0; dr < h; dr++) {
      for (var dc = 0; dc < dz; dc++) {
        var wl = atCol((prof.sea && prof.sea.edge === 'west' ? prof.sea.width : 0) + dc, dr);
        var el = atCol(w - 1 - dc - (prof.sea && prof.sea.edge === 'east' ? prof.sea.width : 0), dr);
        if (wl && !IC.Rules.terrain(wl.t).water) west.push(Hex.key(wl.q, wl.r));
        if (el && !IC.Rules.terrain(el.t).water) east.push(Hex.key(el.q, el.r));
      }
    }

    var map = {
      id: def.id, name: def.name || prof.name, profile: def.profile,
      w: w, h: h, hexes: hexes, list: list, objectives: objectives,
      settlements: settlements,
      deploy: {}, seed: def.seed
    };
    var westSide = def.westSide || 'NATO';
    var eastSide = westSide === 'NATO' ? 'WP' : 'NATO';
    map.deploy[westSide] = west;
    map.deploy[eastSide] = east;
    map.sides = { west: westSide, east: eastSide };
    map.at = function (q, r) { return this.hexes[Hex.key(q, r)]; };
    map.atKey = function (k) { return this.hexes[k]; };
    return map;
  };

  /* 遭遇战地图菜单 */
  IC.SkirmishMaps = [
    { id: 'sk1', name: '中欧平原 · 遭遇战', profile: 'skirmish_plain', w: 22, h: 15, seed: 90210, objectives: 5 },
    { id: 'sk2', name: '工业城区 · 巷战', profile: 'skirmish_urban', w: 20, h: 14, seed: 77321, objectives: 5 },
    { id: 'sk3', name: '森林沼泽 · 迟滞', profile: 'skirmish_forest', w: 23, h: 16, seed: 44119, objectives: 5 },
    { id: 'sk4', name: '易北河 · 渡河战', profile: 'elbe', w: 24, h: 15, seed: 10281, objectives: 5 },
    { id: 'sk5', name: '伏尔加河 · 草原追击', profile: 'volga', w: 25, h: 16, seed: 60712, objectives: 6 }
  ];
})();
