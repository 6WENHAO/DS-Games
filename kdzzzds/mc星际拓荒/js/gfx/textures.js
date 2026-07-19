"use strict";
// ============================================================
//  方块星野 BlockWilds - 程序化方块贴图图集
//  48个16x16瓦片，全部手工算法设计，Canvas 2D
//  致敬Minecraft纹理语言：3-5色阶噪点、斑块簇、清晰轮廓
// ============================================================
window.G = window.G || {};

(function() {
  var TILE = 16, COLS = 8, COUNT = G.TILE_NAMES.length;
  var ROWS = Math.ceil(COUNT / COLS);

  // ===================== 确定性工具 =====================

  function hashU(x, y, seed) {
    var h = ((seed * 2654435761) >>> 0) + x * 0xCC9E2D51 + y * 0x1B873593;
    h = ((h ^ (h >>> 13)) * 0x85EBCA77) >>> 0;
    h = h ^ (h >>> 16);
    return h;
  }

  function hash(x, y, seed) { return (hashU(x, y, seed) >>> 0) / 4294967296; }

  function fbm(x, y, seed, oct) {
    oct = oct || 3; var v = 0, a = 0.5, f = 1;
    for (var i = 0; i < oct; i++) {
      v += hash(Math.floor(x * f), Math.floor(y * f), seed + i * 197) * a;
      a *= 0.5; f *= 2.2;
    }
    return Math.max(0, Math.min(1, v));
  }

  function rngFromSeed(s) {
    var st = s | 0;
    return function() {
      st |= 0; st = st + 0x6D2B79F5 | 0;
      var t = Math.imul(st ^ st >>> 15, 1 | st);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ===================== 颜色工具 =====================
  function hex(h) { var n = parseInt(h, 16); return [(n>>16)&255,(n>>8)&255,n&255]; }
  function pal(arr) { return arr.map(hex); }
  function to255(v) { return Math.max(0, Math.min(255, v|0)); }
  function mix(c1, c2, t) { return [to255(c1[0]+(c2[0]-c1[0])*t), to255(c1[1]+(c2[1]-c1[1])*t), to255(c1[2]+(c2[2]-c1[2])*t)]; }
  function bright(c, v) { return [to255(c[0]*v), to255(c[1]*v), to255(c[2]*v)]; }

  function makeImg() { return new Uint8ClampedArray(TILE * TILE * 4); }
  function setPx(d, x, y, r, g, b, a) {
    if (x<0||x>=TILE||y<0||y>=TILE) return;
    var i = (y*TILE+x)*4; d[i]=r; d[i+1]=g; d[i+2]=b; d[i+3]=a===undefined?255:a;
  }
  function getPx(d, x, y) {
    if (x<0||x>=TILE||y<0||y>=TILE) return [0,0,0,0];
    var i = (y*TILE+x)*4; return [d[i],d[i+1],d[i+2],d[i+3]];
  }
  function fillAll(d, r, g, b, a) { a=a===undefined?255:a; for(var i=0;i<TILE*TILE*4;i+=4){d[i]=r;d[i+1]=g;d[i+2]=b;d[i+3]=a;} }

  function imgToCanvas(d) {
    var c = document.createElement('canvas'); c.width = TILE; c.height = TILE;
    var id = c.getContext('2d').createImageData(TILE, TILE);
    id.data.set(d); c.getContext('2d').putImageData(id, 0, 0); return c;
  }

  // ===================== 绘制模板 =====================

  // 基础噪点瓦片：以 fbm 值从调色板中选择颜色
  function drawNoise(img, emi, seed, colors, oct) {
    oct = oct || 3;
    for (var y = 0; y < TILE; y++) {
      for (var x = 0; x < TILE; x++) {
        var v = fbm(x, y, seed, oct);
        var ci = Math.min(colors.length - 1, Math.floor(v * colors.length));
        var c = colors[ci];
        setPx(img, x, y, c[0], c[1], c[2], c[3]||255);
      }
    }
  }

  // 带权重偏好的噪点：base色大面积 + accent色斑块
  function drawNoiseBlotch(img, emi, seed, base, accent, density) {
    density = density || 0.3;
    for (var y = 0; y < TILE; y++) {
      for (var x = 0; x < TILE; x++) {
        var v = fbm(x, y, seed, 2);
        var c = base.length > 1 ? base[Math.floor(v * base.length)] : base[0];
        if (v > 1 - density) {
          c = accent[Math.floor(hash(x, y, seed + 500) * accent.length)];
        }
        setPx(img, x, y, c[0], c[1], c[2], c[3]||255);
      }
    }
  }

  // 矿石瓦片：石头底 + 矿斑簇
  function drawOre(img, emi, seed, orePalette, spotCount, spotSize) {
    spotCount = spotCount || 4; spotSize = spotSize || 3;
    var stonePal = pal(["7f7f7f","8b8b8b","6e6e6e","969696","5c5c5c"]);
    // 先画石头底
    drawNoise(img, emi, seed, stonePal, 3);
    // 再画矿斑
    var rng = rngFromSeed(seed + 9999);
    for (var s = 0; s < spotCount; s++) {
      var cx = Math.floor(rng() * (TILE - 4)) + 2;
      var cy = Math.floor(rng() * (TILE - 4)) + 2;
      var sz = spotSize - 1 + Math.floor(rng() * 3);
      for (var dy = -sz; dy <= sz; dy++) {
        for (var dx = -sz; dx <= sz; dx++) {
          if (dx*dx + dy*dy <= sz*sz + 1) {
            var px = cx + dx, py = cy + dy;
            var dist = Math.sqrt(dx*dx + dy*dy);
            var edge = hash(px, py, seed + s) * 0.6 + 0.2;
            if (dist < sz * 0.7 || hash(px, py, seed + s + 300) > 0.3) {
              var oc = orePalette[Math.floor(hash(px, py, seed + s + 600) * orePalette.length)];
              setPx(img, px, py, oc[0], oc[1], oc[2], 255);
            }
          }
        }
      }
    }
  }

  // 砖格瓦片
  function drawBrick(img, emi, seed, brickColors, mortarColor) {
    var BW = 4, BH = 4;
    fillAll(img, mortarColor[0], mortarColor[1], mortarColor[2], 255);
    for (var y = 0; y < TILE; y++) {
      for (var x = 0; x < TILE; x++) {
        var bx = Math.floor(x / BW), by = Math.floor(y / BH);
        var lx = x % BW, ly = y % BH;
        var isMortar = (lx === 0 || ly === 0 || lx === BW-1 || ly === BH-1);
        if (!isMortar) {
          var v = fbm(x, y, seed + bx * 17 + by * 31, 2);
          var ci = Math.floor(v * brickColors.length);
          var c = brickColors[ci];
          setPx(img, x, y, c[0], c[1], c[2], 255);
        }
      }
    }
  }

  // 石砖2x2格+裂纹
  function drawStoneBrick(img, emi, seed) {
    var brickP = pal(["8b8b8b","969696","7e7e7e","a1a1a1"]);
    var mortar = hex("555555");
    fillAll(img, mortar[0], mortar[1], mortar[2], 255);
    var rng = rngFromSeed(seed);
    // 裂纹线
    var crackLines = [{x1:2,y1:4,x2:6,y2:12},{x1:9,y1:0,x2:13,y2:8},{x1:4,y1:13,x2:12,y2:10}];
    for (var y = 0; y < TILE; y++) {
      for (var x = 0; x < TILE; x++) {
        var bx = Math.floor(x / 8), by = Math.floor(y / 8);
        var lx = x % 8, ly = y % 8;
        var isMortar = (lx === 0 || ly === 0);
        if (!isMortar) {
          var v = fbm(x, y, seed + bx * 7 + by * 19, 2);
          var ci = Math.floor(v * brickP.length);
          var c = brickP[ci];
          // 裂纹检测
          var onCrack = false;
          for (var k = 0; k < crackLines.length; k++) {
            var cl = crackLines[k];
            var dx = x - cl.x1, dy = y - cl.y1;
            var len = Math.sqrt((cl.x2-cl.x1)*(cl.x2-cl.x1)+(cl.y2-cl.y1)*(cl.y2-cl.y1));
            var nx = (cl.x2-cl.x1)/len, ny = (cl.y2-cl.y1)/len;
            var proj = dx*nx + dy*ny;
            var perp = Math.abs(dx*ny - dy*nx);
            if (proj >= -1 && proj <= len + 1 && perp < 0.8) { onCrack = true; }
          }
          if (onCrack) { c = hex("4a4a4a"); }
          setPx(img, x, y, c[0], c[1], c[2], 255);
        }
      }
    }
  }

  // cross精灵：在透明背景上绘制形状
  function drawCrossSprite(img, emi, seed, shapeFn) {
    fillAll(img, 0, 0, 0, 0);
    for (var y = 0; y < TILE; y++) {
      for (var x = 0; x < TILE; x++) {
        shapeFn(img, x, y, seed);
      }
    }
  }

  // 直线
  function line(img, x0, y0, x1, y1, r, g, b, thick) {
    thick = thick || 1;
    var dx = Math.abs(x1-x0), dy = Math.abs(y1-y0);
    var sx = x0<x1?1:-1, sy = y0<y1?1:-1, err = dx-dy;
    while (true) {
      for (var t = -Math.floor(thick/2); t <= Math.floor(thick/2); t++) {
        if (dx > dy) setPx(img, x0, y0+t, r, g, b, 255);
        else setPx(img, x0+t, y0, r, g, b, 255);
      }
      if (x0===x1 && y0===y1) break;
      var e2 = 2*err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }

  // 圆
  function circle(img, cx, cy, radius, r, g, b, fill) {
    for (var y = -radius; y <= radius; y++) {
      for (var x = -radius; x <= radius; x++) {
        var d = x*x + y*y;
        if (fill) {
          if (d <= radius*radius) setPx(img, cx+x, cy+y, r, g, b, 255);
        } else {
          if (d <= radius*radius && d >= (radius-1)*(radius-1)) setPx(img, cx+x, cy+y, r, g, b, 255);
        }
      }
    }
  }

  // ===================== 48个瓦片绘制函数 =====================

  var TILES = {};
  var SEEDS = {};
  // 为每个瓦片分配唯一种子
  G.TILE_NAMES.forEach(function(name, i) { SEEDS[name] = 10000 + i * 137; });

  function draw_grass_top(img, emi, seed) {
    var grassP = pal(["5a8f3c","6da544","4f7e34","7cba50","8ec960"]);
    drawNoise(img, emi, seed, grassP, 4);
    // 点缀亮草叶像素
    for (var i = 0; i < 12; i++) {
      var x = Math.floor(hash(i, 0, seed + 300) * 16);
      var y = Math.floor(hash(i, 1, seed + 300) * 16);
      var g = grassP[4]; setPx(img, x, y, g[0], g[1], g[2], 255);
      // 旁边一个小像素
      if (x < 15) setPx(img, x+1, y, g[0], g[1], g[2], 255);
    }
  }

  function draw_grass_side(img, emi, seed) {
    var dirtP = pal(["8b6b4a","7d5f3e","9e7c56","6d5234"]);
    var grassP = pal(["5a8f3c","6da544","4f7e34","7cba50","3d6628"]);
    // 泥土底层
    drawNoise(img, emi, seed, dirtP, 3);
    // 顶部3-5px不规则草皮垂边
    var rng = rngFromSeed(seed + 100);
    for (var y = 0; y < TILE; y++) {
      for (var x = 0; x < TILE; x++) {
        var h = 3 + Math.floor(hash(x, 0, seed + 200) * 3);
        var grassEdge = h + Math.floor(hash(x, 1, seed + 201) * 2);
        if (y <= grassEdge) {
          var gi = Math.floor(fbm(x, y, seed + 400, 2) * grassP.length);
          var c = grassP[gi];
          setPx(img, x, y, c[0], c[1], c[2], 255);
        }
        // 深绿描边在草地和泥土交界
        if (y === grassEdge || y === grassEdge + 1) {
          var gp = getPx(img, x, y);
          if (gp[3] > 0) {
            setPx(img, x, y, 61, 102, 40, 255);
          }
        }
      }
    }
  }

  function draw_dirt(img, emi, seed) {
    var dirtP = pal(["8b6b4a","7d5f3e","9e7c56","6d5234","a88a62"]);
    drawNoise(img, emi, seed, dirtP, 3);
    // 零星小石粒
    for (var i = 0; i < 8; i++) {
      var x = Math.floor(hash(i, 0, seed + 500) * 16);
      var y = Math.floor(hash(i, 1, seed + 500) * 16);
      var sc = hex("c4a87a"); setPx(img, x, y, sc[0], sc[1], sc[2], 255);
    }
  }

  function draw_stone(img, emi, seed) {
    var stoneP = pal(["7f7f7f","8b8b8b","6e6e6e","969696","5c5c5c"]);
    drawNoise(img, emi, seed, stoneP, 3);
    // 暗色斑块簇
    var rng = rngFromSeed(seed + 700);
    for (var b = 0; b < 3; b++) {
      var bx = Math.floor(rng() * 12) + 2;
      var by = Math.floor(rng() * 12) + 2;
      for (var dy = -2; dy <= 2; dy++) {
        for (var dx = -2; dx <= 2; dx++) {
          if (dx*dx + dy*dy <= 5 && hash(bx+dx, by+dy, seed + b) > 0.4) {
            setPx(img, bx+dx, by+dy, 85, 85, 85, 255);
          }
        }
      }
    }
  }

  function draw_cobble(img, emi, seed) {
    var mort = hex("4a4a4a"), cobP = pal(["8b8b8b","969696","7e7e7e","a1a1a1","6d6d6d"]);
    fillAll(img, mort[0], mort[1], mort[2], 255);
    var rng = rngFromSeed(seed);
    // 4x4圆石子格
    var cells = [];
    for (var cy = 0; cy < 4; cy++) {
      for (var cx = 0; cx < 4; cx++) {
        cells.push({
          px: cx * 4 + 2 + Math.floor(rng() * 1),
          py: cy * 4 + 2 + Math.floor(rng() * 1),
          r: 1.6 + rng() * 0.8
        });
      }
    }
    for (var y = 0; y < TILE; y++) {
      for (var x = 0; x < TILE; x++) {
        var onCell = false;
        for (var c = 0; c < cells.length; c++) {
          var dx = x - cells[c].px, dy = y - cells[c].py;
          if (dx*dx + dy*dy < cells[c].r * cells[c].r) { onCell = true; break; }
        }
        if (onCell) {
          var v = fbm(x, y, seed + 777, 2);
          var ci = Math.floor(v * cobP.length);
          var col = cobP[ci];
          setPx(img, x, y, col[0], col[1], col[2], 255);
        }
      }
    }
  }

  function draw_stone_brick(img, emi, seed) { drawStoneBrick(img, emi, seed); }

  function draw_bedrock(img, emi, seed) {
    var bp = pal(["1a1a1a","2a2a2a","111111","353535","050505","404040"]);
    drawNoise(img, emi, seed, bp, 4);
    // 加强高对比混沌
    for (var y = 0; y < TILE; y++) {
      for (var x = 0; x < TILE; x++) {
        var v = fbm(x, y, seed + 900, 3);
        if (v < 0.2) setPx(img, x, y, 5, 5, 5, 255);
        else if (v > 0.8) setPx(img, x, y, 55, 55, 55, 255);
      }
    }
  }

  function draw_sand(img, emi, seed) {
    var sp = pal(["d4c89a","c9bc8a","ddcf9f","bfb07e","e8d9aa"]);
    drawNoise(img, emi, seed, sp, 4);
  }

  function draw_sandstone_top(img, emi, seed) {
    var sstP = pal(["c9bc8a","d4c89a","bfb07e","ddcf9f"]);
    // 分层地层纹
    for (var y = 0; y < TILE; y++) {
      var layerV = fbm(0, y * 2, seed + 200, 1);
      var cp = Math.floor(layerV * sstP.length);
      var base = sstP[cp];
      for (var x = 0; x < TILE; x++) {
        var v = hash(x, y, seed + 300) * 0.3;
        var col = mix(base, sstP[(cp+1)%sstP.length], v);
        // 层间暗线
        if ((y === 4 || y === 8 || y === 12) && hash(x, 0, seed+400) > 0.6) {
          col = hex("b0a070");
        }
        setPx(img, x, y, col[0], col[1], col[2], 255);
      }
    }
  }

  function draw_sandstone_side(img, emi, seed) {
    var sstP = pal(["c5b585","b8a878","cfbf90","ada068"]);
    // 竖向地层纹
    for (var x = 0; x < TILE; x++) {
      var layerV = fbm(x * 2, 0, seed + 500, 1);
      var cp = Math.floor(layerV * sstP.length);
      var base = sstP[cp];
      for (var y = 0; y < TILE; y++) {
        var v = hash(x, y, seed + 600) * 0.35;
        var col = mix(base, sstP[(cp+1)%sstP.length], v);
        setPx(img, x, y, col[0], col[1], col[2], 255);
      }
    }
  }

  function draw_red_sand(img, emi, seed) {
    var rsp = pal(["d4864a","c4783e","dd9050","b86c32","e89a5c"]);
    drawNoise(img, emi, seed, rsp, 4);
  }

  function draw_gravel(img, emi, seed) {
    var gp = pal(["7a7a7a","8e8e8e","6c5c4c","9a8a6a","5e5e5e"]);
    drawNoise(img, emi, seed, gp, 3);
    // 卵石形状点
    for (var i = 0; i < 20; i++) {
      var x = Math.floor(hash(i, 0, seed + 700) * 16);
      var y = Math.floor(hash(i, 1, seed + 700) * 16);
      var col = gp[Math.floor(hash(i, 2, seed + 700) * gp.length)];
      setPx(img, x, y, col[0], col[1], col[2], 255);
      // 旁边像素（卵石形状）
      if (x < 15 && hash(i, 3, seed) > 0.5) setPx(img, x+1, y, col[0], col[1], col[2], 255);
      if (y < 15 && hash(i, 4, seed) > 0.5) setPx(img, x, y+1, col[0], col[1], col[2], 255);
    }
  }

  function draw_log_side(img, emi, seed) {
    var barkP = pal(["5c3a1e","4d2e14","6b4628","3d2210","7a5232"]);
    // 竖向树皮棱
    for (var y = 0; y < TILE; y++) {
      for (var x = 0; x < TILE; x++) {
        // 竖向波动纹理
        var ridge = Math.sin(x * 1.2 + fbm(0, y, seed, 2) * 2) * 1.5;
        var v = fbm(x + ridge * 0.3, y * 0.5, seed, 3);
        // 深色竖纹
        if (Math.abs((x + ridge) % 4 - 2) < 1.2) {
          v = v * 0.5;
        } else {
          v = 0.3 + v * 0.7;
        }
        var ci = Math.floor(v * barkP.length);
        var c = barkP[Math.min(ci, barkP.length - 1)];
        setPx(img, x, y, c[0], c[1], c[2], 255);
      }
    }
  }

  function draw_log_top(img, emi, seed) {
    var wp = pal(["c8a060","b89850","d4b070","a88840"]);
    // 年轮
    for (var y = 0; y < TILE; y++) {
      for (var x = 0; x < TILE; x++) {
        var dx = x - 7.5, dy = y - 7.5;
        var dist = Math.sqrt(dx*dx + dy*dy);
        var ring = Math.floor(dist / 1.6) % 2;
        var v = fbm(x, y, seed, 2);
        var ci = ring === 0 ? Math.floor(v * 2) : 2 + Math.floor(v * 2);
        var c = wp[Math.min(ci, wp.length - 1)];
        setPx(img, x, y, c[0], c[1], c[2], 255);
        // 年轮深线
        if (Math.abs(dist % 1.6 - 0.8) < 0.15) {
          setPx(img, x, y, 140, 110, 60, 255);
        }
        // 树皮边
        if (dist > 6.5) {
          var bc = hex("4d2e14");
          setPx(img, x, y, bc[0], bc[1], bc[2], 255);
        }
      }
    }
  }

  function draw_planks(img, emi, seed) {
    var plP = pal(["c8a060","b89850","d4b070","a88840","dcbc78"]);
    // 横向木板 + 板缝
    var plankH = 4;
    for (var y = 0; y < TILE; y++) {
      var seam = (y % plankH === 0);
      for (var x = 0; x < TILE; x++) {
        if (seam) {
          setPx(img, x, y, 80, 60, 30, 255);
        } else {
          var v = fbm(x, y, seed, 2);
          var ci = Math.floor(v * plP.length);
          var c = plP[ci];
          setPx(img, x, y, c[0], c[1], c[2], 255);
        }
      }
    }
    // 钉点
    var rng = rngFromSeed(seed + 300);
    for (var i = 0; i < 6; i++) {
      var px = Math.floor(rng() * 14) + 1;
      var py = Math.floor(rng() * 14) + 1;
      setPx(img, px, py, 50, 35, 20, 255);
    }
  }

  function draw_leaves(img, emi, seed) {
    var leafP = pal(["2d6b1e","3a8028","1f5a12","4a9038"]);
    drawNoise(img, emi, seed, leafP, 3);
    // 透明孔洞簇
    for (var y = 0; y < TILE; y++) {
      for (var x = 0; x < TILE; x++) {
        var hole = fbm(x, y, seed + 800, 3);
        if (hole > 0.7) {
          setPx(img, x, y, 0, 0, 0, 0);
        }
      }
    }
  }

  function draw_fir_leaves(img, emi, seed) {
    var fp = pal(["1a4a38","235a44","123828","306a50"]);
    drawNoise(img, emi, seed, fp, 3);
    // 顶部积雪像素
    for (var y = 0; y < 5; y++) {
      for (var x = 0; x < TILE; x++) {
        var snowChance = (5 - y) / 5 * 0.8;
        if (hash(x, y, seed + 900) < snowChance) {
          var sp = hex("e8f0f8");
          setPx(img, x, y, sp[0], sp[1], sp[2], 255);
        }
      }
    }
    // 针叶圆孔
    for (var y = 0; y < TILE; y++) {
      for (var x = 0; x < TILE; x++) {
        if (fbm(x, y, seed + 1000, 3) > 0.75) {
          setPx(img, x, y, 0, 0, 0, 0);
        }
      }
    }
  }

  function draw_glass(img, emi, seed) {
    fillAll(img, 255, 255, 255, 20); // 透明底
    // 白色边框
    for (var i = 0; i < TILE; i++) {
      setPx(img, i, 0, 200, 200, 200, 180);
      setPx(img, i, 15, 200, 200, 200, 180);
      setPx(img, 0, i, 200, 200, 200, 180);
      setPx(img, 15, i, 200, 200, 200, 180);
    }
    // 对角高光条
    for (var i = 2; i < 14; i++) {
      setPx(img, i, i, 255, 255, 255, 100);
      if (i > 2 && i < 13) setPx(img, i, i-1, 255, 255, 255, 70);
    }
  }

  function draw_water(img, emi, seed) {
    var wp = pal(["3355aa","4466bb","224499","5588cc"]);
    // 半透明蓝底带波纹抖动
    for (var y = 0; y < TILE; y++) {
      for (var x = 0; x < TILE; x++) {
        var wave = Math.sin(x * 0.8 + y * 0.6 + fbm(x, y, seed + 1100, 2) * 3) * 0.3;
        var v = fbm(x + wave, y + wave * 0.7, seed + 1200, 2);
        var ci = Math.floor(v * wp.length);
        var c = wp[ci];
        setPx(img, x, y, c[0], c[1], c[2], 180 + Math.floor(wave * 30));
      }
    }
  }

  function draw_ice(img, emi, seed) {
    fillAll(img, 180, 210, 240, 230);
    // 淡蓝噪点
    for (var y = 0; y < TILE; y++) {
      for (var x = 0; x < TILE; x++) {
        var v = fbm(x, y, seed, 3);
        var r = 170 + Math.floor(v * 40);
        var g = 200 + Math.floor(v * 35);
        var b = 235 + Math.floor(v * 20);
        setPx(img, x, y, r, g, b, 230);
      }
    }
    // 裂纹
    var rng = rngFromSeed(seed + 1300);
    for (var c = 0; c < 3; c++) {
      var sx = Math.floor(rng() * 12) + 2;
      var sy = Math.floor(rng() * 12) + 2;
      for (var s = 0; s < 6; s++) {
        sx += Math.floor(rng() * 3) - 1;
        sy += Math.floor(rng() * 3) - 1;
        setPx(img, sx, sy, 230, 240, 250, 255);
        if (sx < 15) setPx(img, sx+1, sy, 230, 240, 250, 255);
      }
    }
  }

  function draw_snow(img, emi, seed) {
    var sp = pal(["f0f0f8","e8ecf4","f4f4fc","dfe4ee","f8f8ff"]);
    drawNoise(img, emi, seed, sp, 4);
  }

  function draw_coal_ore(img, emi, seed) {
    drawOre(img, emi, seed, pal(["1a1a1a","2a2a2a","0a0a0a","333333"]), 5, 4);
  }

  function draw_iron_ore(img, emi, seed) {
    drawOre(img, emi, seed, pal(["c4a070","d4b080","b89060","e0c090"]), 4, 3);
  }

  function draw_copper_ore(img, emi, seed) {
    drawOre(img, emi, seed, pal(["5a9070","4a8060","6aa080","3a7050","7ab090"]), 5, 4);
  }

  function draw_torch(img, emi, seed) {
    fillAll(img, 0, 0, 0, 0);
    // 木棍
    var stickC = hex("8b5e3c");
    for (var y = 8; y < 16; y++) {
      setPx(img, 7, y, stickC[0], stickC[1], stickC[2], 255);
      setPx(img, 8, y, stickC[0], stickC[1], stickC[2], 255);
    }
    // 火焰头部
    var flameP = pal(["ff8800","ffaa00","ffcc00","ff6600","ff4400","ffff44"]);
    for (var y = 0; y < 9; y++) {
      for (var x = 2; x < 14; x++) {
        var dx = x - 7.5, dy = y - 2;
        var flameShape = dy*0.6 - Math.abs(dx)*0.8;
        if (flameShape < 2 && flameShape > -1) {
          var v = fbm(x, y, seed + 1400, 2);
          var ci = Math.floor(v * flameP.length);
          var fc = flameP[Math.min(ci, flameP.length - 1)];
          setPx(img, x, y, fc[0], fc[1], fc[2], 255);
          // 发光层
          if (emi) setPx(emi, x, y, fc[0], fc[1], fc[2], 255);
        }
      }
    }
  }

  function draw_tallgrass(img, emi, seed) {
    fillAll(img, 0, 0, 0, 0);
    var grP = pal(["4a8c30","5a9c40","3a7c20","6aac50"]);
    for (var y = 1; y < 15; y++) {
      var sway = Math.sin(y * 0.5) * 1.2;
      for (var x = 0; x < TILE; x++) {
        var dx = x - (7.5 + sway), dy = y;
        // 几根草叶丛
        for (var b = 0; b < 3; b++) {
          var bx0 = 5 + b * 3 + Math.sin(y * 0.7 + b) * 2;
          var bw = 2;
          if (Math.abs(x - bx0) < bw && y < 14 - b) {
            var gr = grP[Math.floor(fbm(x, y, seed + b * 100, 2) * grP.length)];
            setPx(img, x, y, gr[0], gr[1], gr[2], 255);
          }
        }
      }
    }
  }

  function draw_crafting_top(img, emi, seed) {
    var topP = pal(["c8a060","b89850","d4b070","a88840"]);
    drawNoise(img, emi, seed, topP, 2);
    // 格子纹
    for (var gy = 0; gy < 4; gy++) {
      for (var gx = 0; gx < 4; gx++) {
        var l = gx * 4, t = gy * 4;
        // 格子内偏移
        for (var y = t+1; y < t+3; y++) {
          for (var x = l+1; x < l+3; x++) {
            setPx(img, x, y, 140, 110, 60, 255);
          }
        }
      }
    }
    // 工具刻印
    var toolP = hex("444444");
    // 中心十字
    for (var i = 0; i < 16; i++) {
      setPx(img, i, 7, toolP[0], toolP[1], toolP[2], 255);
      setPx(img, 7, i, toolP[0], toolP[1], toolP[2], 255);
    }
    // 角落标记
    setPx(img, 2, 2, toolP[0], toolP[1], toolP[2], 255);
    setPx(img, 13, 2, toolP[0], toolP[1], toolP[2], 255);
    setPx(img, 2, 13, toolP[0], toolP[1], toolP[2], 255);
    setPx(img, 13, 13, toolP[0], toolP[1], toolP[2], 255);
  }

  function draw_crafting_side(img, emi, seed) {
    draw_planks(img, emi, seed + 10000);
    // 工具挂饰
    var toolC = hex("666666");
    // 挂扳手
    for (var y = 3; y < 6; y++) { setPx(img, 8, y, toolC[0], toolC[1], toolC[2], 255); }
    setPx(img, 6, 5, toolC[0], toolC[1], toolC[2], 255);
    setPx(img, 10, 5, toolC[0], toolC[1], toolC[2], 255);
    setPx(img, 8, 6, toolC[0], toolC[1], toolC[2], 255);
  }

  function draw_basalt(img, emi, seed) {
    var bp = pal(["3a3a3a","2e2e2e","444444","262626","505050"]);
    // 竖向柱状纹
    for (var y = 0; y < TILE; y++) {
      for (var x = 0; x < TILE; x++) {
        var colX = Math.floor(x / 3);
        var shift = hash(colX, 0, seed) * 2 - 1;
        var v = fbm(x + shift, y * 1.5, seed + colX * 50, 2);
        var ci = Math.floor(v * bp.length);
        var c = bp[Math.min(ci, bp.length - 1)];
        setPx(img, x, y, c[0], c[1], c[2], 255);
      }
    }
  }

  function draw_obsidian(img, emi, seed) {
    var op = pal(["1a1020","220c28","0e0818","2a1430","181020"]);
    drawNoise(img, emi, seed, op, 4);
    // 紫色光泽碎片
    for (var i = 0; i < 10; i++) {
      var x = Math.floor(hash(i, 0, seed + 1500) * 16);
      var y = Math.floor(hash(i, 1, seed + 1500) * 16);
      setPx(img, x, y, 80, 30, 100, 255);
    }
  }

  function draw_ash(img, emi, seed) {
    var ap = pal(["5c5048","4a4038","6e6058","3e3430","7a6c60"]);
    drawNoise(img, emi, seed, ap, 4);
  }

  // ===== 挪麦系列 =====
  var NOMAI_CYAN = [62, 230, 196]; // #3ee6c4

  function draw_nomai_brick(img, emi, seed) {
    var nbP = pal(["c4b898","b8ac8c","d0c4a4","a89878"]);
    drawBrick(img, emi, seed, nbP, hex("8a7a60"));
  }

  function draw_nomai_carved(img, emi, seed) {
    var ncP = pal(["c4b898","b8ac8c","d0c4a4","a89878"]);
    drawBrick(img, emi, seed, ncP, hex("8a7a60"));
    // 青色螺旋凹槽（发光）
    var cx = 7.5, cy = 7.5;
    for (var a = 0; a < Math.PI * 6; a += 0.15) {
      var r = 1 + a * 0.25;
      var px = Math.floor(cx + Math.cos(a) * r);
      var py = Math.floor(cy + Math.sin(a) * r);
      setPx(img, px, py, 62, 230, 196, 255);
      if (emi) setPx(emi, px, py, 62, 230, 196, 255);
    }
  }

  function draw_nomai_text(img, emi, seed) {
    var ntP = pal(["2a2830","1e1c24","323038","18161c"]);
    drawNoise(img, emi, seed, ntP, 3);
    // 发光青色螺旋文字卷曲笔画
    var rng = rngFromSeed(seed + 1600);
    for (var branch = 0; branch < 5; branch++) {
      var sx = 3 + Math.floor(rng() * 10);
      var sy = 3 + Math.floor(rng() * 10);
      var cx = sx, cy = sy;
      var angle = rng() * Math.PI * 2;
      var curve = 0.3 + rng() * 0.5;
      for (var t = 0; t < 20; t++) {
        angle += curve * (rng() - 0.5) * 0.4;
        cx += Math.cos(angle) * 0.8;
        cy += Math.sin(angle) * 0.8;
        var ppx = Math.floor(cx), ppy = Math.floor(cy);
        if (ppx >= 0 && ppx < 16 && ppy >= 0 && ppy < 16) {
          var glow = 200 + Math.floor(rng() * 55);
          setPx(img, ppx, ppy, 62, glow, 196, 255);
          if (emi) setPx(emi, ppx, ppy, 62, glow, 196, 255);
        }
      }
    }
  }

  function draw_nomai_metal(img, emi, seed) {
    var nmP = pal(["4a5a60","3a4a50","5a6a70","304048","66767c"]);
    drawNoise(img, emi, seed, nmP, 3);
    // 铆钉
    var rivP = hex("8898a0");
    for (var ry = 0; ry < 4; ry++) {
      for (var rx = 0; rx < 4; rx++) {
        var px = rx * 4 + 2, py = ry * 4 + 2;
        setPx(img, px, py, rivP[0], rivP[1], rivP[2], 255);
        setPx(img, px+1, py, rivP[0], rivP[1], rivP[2], 255);
        setPx(img, px, py+1, rivP[0], rivP[1], rivP[2], 255);
      }
    }
  }

  function draw_nomai_lamp(img, emi, seed) {
    var nmP = pal(["4a5a60","3a4a50","5a6a70","304048"]);
    drawNoise(img, emi, seed, nmP, 2);
    // 金属环框
    circle(img, 7, 7, 5, 80, 100, 110, false);
    circle(img, 7, 7, 6, 60, 80, 90, false);
    // 暖白青光球 + 均发光
    for (var y = 2; y < 13; y++) {
      for (var x = 2; x < 13; x++) {
        var dx = x - 7.5, dy = y - 7.5;
        var d = Math.sqrt(dx*dx + dy*dy);
        if (d < 4.5) {
          var brightness = 1 - d / 4.5;
          var r = to255(180 + brightness * 75);
          var g = to255(220 + brightness * 35);
          var b = to255(200 + brightness * 55);
          setPx(img, x, y, r, g, b, 255);
          if (emi) setPx(emi, x, y, r, g, b, 255);
        }
      }
    }
  }

  function draw_gravity_crystal(img, emi, seed) {
    fillAll(img, 0, 0, 0, 0);
    // 半透明紫蓝晶体切面
    var cp = pal(["6a40c0","7a50d0","5a30b0","8a60e0","4a2090"]);
    for (var y = 0; y < TILE; y++) {
      for (var x = 0; x < TILE; x++) {
        var cx = 7.5, cy = 7.5;
        var dx = x - cx, dy = y - cy;
        var dist = Math.sqrt(dx*dx + dy*dy);
        var angle = Math.atan2(dy, dx);
        // 六边形切面感
        var facet = Math.cos(angle * 3) * 0.3 + 0.7;
        var edgeDist = dist / 7;
        if (edgeDist < 1) {
          var v = fbm(x, y, seed, 2);
          var ci = Math.floor((v * facet) * cp.length);
          var c = cp[Math.min(ci, cp.length - 1)];
          var alpha = to255((1 - edgeDist) * 180);
          setPx(img, x, y, c[0], c[1], c[2], alpha);
          // 核心发光
          if (dist < 2.5 && emi) {
            setPx(emi, x, y, 180, 100, 255, 255);
          }
        }
      }
    }
    // 明亮核心
    circle(img, 7, 7, 1, 200, 150, 255, true);
    if (emi) circle(emi, 7, 7, 1, 200, 150, 255, true);
  }

  function draw_quantum_stone(img, emi, seed) {
    var qp = pal(["6a6e7a","5a5e6a","7a7e8a","505460","848890"]);
    drawNoise(img, emi, seed, qp, 3);
    // 微闪淡紫噪纹星点
    for (var y = 0; y < TILE; y++) {
      for (var x = 0; x < TILE; x++) {
        var sparkle = fbm(x, y, seed + 1700, 3);
        if (sparkle > 0.85) {
          setPx(img, x, y, 140, 120, 180, 255);
          if (emi) setPx(emi, x, y, 80, 50, 120, 128);
        }
      }
    }
  }

  function draw_ghost_matter(img, emi, seed) {
    fillAll(img, 0, 0, 0, 0);
    // 幽绿雾丝卷曲
    var rng = rngFromSeed(seed + 1800);
    for (var s = 0; s < 4; s++) {
      var sx = 2 + Math.floor(rng() * 12);
      var sy = 2 + Math.floor(rng() * 12);
      var x = sx, y = sy;
      for (var t = 0; t < 15; t++) {
        x += (rng() - 0.5) * 2;
        y += (rng() - 0.5) * 2;
        var px = Math.floor(x), py = Math.floor(y);
        if (px >= 0 && px < 16 && py >= 0 && py < 16) {
          setPx(img, px, py, 80, 230, 120, 60 + Math.floor(rng() * 100));
          if (emi) setPx(emi, px, py, 50, 180, 80, 80);
          // 扩散
          if (rng() > 0.6) {
            var ex = px + Math.floor(rng() * 3 - 1);
            var ey = py + Math.floor(rng() * 3 - 1);
            if (ex >= 0 && ex < 16 && ey >= 0 && ey < 16) {
              setPx(img, ex, ey, 80, 230, 120, 30 + Math.floor(rng() * 50));
            }
          }
        }
      }
    }
  }

  function draw_bramble(img, emi, seed) {
    var bp = pal(["6a5a4a","5a4a3a","7a6a5a","4a3a2a","8a7a6a"]);
    drawNoise(img, emi, seed, bp, 3);
    // 扭曲纹理
    for (var y = 0; y < TILE; y++) {
      for (var x = 0; x < TILE; x++) {
        var twist = Math.sin(y * 0.8 + x * 0.4) * 0.3;
        if (fbm(x + twist * 3, y + twist * 2, seed + 1900, 2) > 0.65) {
          setPx(img, x, y, 40, 30, 20, 255);
        }
      }
    }
    // 刺瘤
    var rng = rngFromSeed(seed + 2000);
    for (var b = 0; b < 3; b++) {
      var bx = 2 + Math.floor(rng() * 12);
      var by = 2 + Math.floor(rng() * 12);
      setPx(img, bx, by, 80, 60, 40, 255);
      circle(img, bx, by, 1, 80, 60, 40, true);
    }
  }

  function draw_bramble_thorn(img, emi, seed) {
    fillAll(img, 0, 0, 0, 0);
    var tnP = pal(["8a7a6a","7a6a5a","9a8a7a"]);
    // cross尖刺
    for (var y = 0; y < 16; y++) {
      var w = Math.max(0, 1 - y * 0.1);
      for (var x = 6; x <= 9; x++) {
        if (Math.abs(x - 7.5) <= w + 0.5) {
          setPx(img, x, y, tnP[0][0], tnP[0][1], tnP[0][2], 255);
        }
      }
    }
    // 侧刺
    setPx(img, 5, 8, tnP[1][0], tnP[1][1], tnP[1][2], 255);
    setPx(img, 10, 8, tnP[1][0], tnP[1][1], tnP[1][2], 255);
    setPx(img, 4, 7, tnP[2][0], tnP[2][1], tnP[2][2], 255);
    setPx(img, 11, 7, tnP[2][0], tnP[2][1], tnP[2][2], 255);
  }

  function draw_vine_glow(img, emi, seed) {
    fillAll(img, 0, 0, 0, 0);
    var vnP = pal(["3a6040","4a7050","2a5030"]);
    // cross藤蔓
    for (var y = 0; y < 16; y++) {
      var sway = Math.sin(y * 0.3) * 1.5;
      var cx = 7.5 + sway;
      for (var x = 0; x < 16; x++) {
        if (Math.abs(x - cx) < 1.5) {
          if (x >= 0 && x < 16) {
            setPx(img, x, y, vnP[0][0], vnP[0][1], vnP[0][2], 255);
          }
        }
      }
    }
    // 青绿发光浆果
    var rng = rngFromSeed(seed + 2100);
    for (var b = 0; b < 5; b++) {
      var bx = 6 + Math.floor(rng() * 4);
      var by = 2 + Math.floor(rng() * 12);
      setPx(img, bx, by, 62, 255, 140, 255);
      if (emi) setPx(emi, bx, by, 62, 255, 140, 255);
      // 光晕
      if (bx > 0 && emi) setPx(emi, bx-1, by, 30, 200, 100, 100);
      if (bx < 15 && emi) setPx(emi, bx+1, by, 30, 200, 100, 100);
    }
  }

  function draw_lava(img, emi, seed) {
    var lavaP = pal(["ff6600","ff8800","ffaa00","ff4400","ffcc00","ff3300","ffff44"]);
    var crustP = pal(["331100","441100","220000"]);
    // 亮橙黄流动胞格 + 深色壳
    for (var y = 0; y < TILE; y++) {
      for (var x = 0; x < TILE; x++) {
        var v = fbm(x, y, seed + 2200, 3);
        var crust = fbm(x, y, seed + 2300, 2);
        if (crust > 0.6) {
          var cc = crustP[Math.floor(crust * 2 * crustP.length) % crustP.length];
          setPx(img, x, y, cc[0], cc[1], cc[2], 255);
        } else {
          var lc = lavaP[Math.floor(v * lavaP.length)];
          setPx(img, x, y, lc[0], lc[1], lc[2], 255);
          if (emi) setPx(emi, x, y, lc[0], lc[1], lc[2], 255);
        }
      }
    }
    // 少量壳也弱发光
    for (var y = 0; y < TILE; y++) {
      for (var x = 0; x < TILE; x++) {
        if (emi) {
          var p = getPx(emi, x, y);
          if (p[3] === 0) {
            var p2 = getPx(img, x, y);
            if (p2[0] > 30) setPx(emi, x, y, to255(p2[0]*0.4), to255(p2[1]*0.2), 0, 128);
          }
        }
      }
    }
  }

  function draw_launch_pad(img, emi, seed) {
    var metP = pal(["6a6a6a","7a7a7a","5a5a5a","8a8a8a"]);
    drawNoise(img, emi, seed, metP, 2);
    // 黄黑警示角条
    var yel = hex("ffcc00"), blk = hex("1a1a1a");
    for (var x = 0; x < 16; x++) {
      for (var y = 0; y < 16; y++) {
        if ((x < 3 && y < 10) || (x > 12 && y < 10)) {
          var stripe = (Math.floor((x + y) / 2) % 2 === 0);
          var sc = stripe ? yel : blk;
          if ((x < 2 && y < 8) || (x > 13 && y < 8)) {
            setPx(img, x, y, sc[0], sc[1], sc[2], 255);
          }
        }
      }
    }
  }

  function draw_metal(img, emi, seed) {
    var metP = pal(["7a7a7a","8a8a8a","6a6a6a","9a9a9a","5a5a5a"]);
    drawNoise(img, emi, seed, metP, 3);
    // 铆钉
    var riv = hex("aaaaaa");
    for (var ry = 0; ry < 4; ry++) {
      for (var rx = 0; rx < 4; rx++) {
        setPx(img, rx * 4 + 2, ry * 4 + 2, riv[0], riv[1], riv[2], 255);
      }
    }
  }

  function draw_lamp(img, emi, seed) {
    // 暖光纸灯笼
    var lp = pal(["ddd5a0","e8e0b0","d0c890","f0e8c0"]);
    drawNoise(img, emi, seed, lp, 3);
    // 框架线
    var fram = hex("8a8040");
    for (var i = 0; i < 16; i++) {
      setPx(img, i, 0, fram[0], fram[1], fram[2], 255);
      setPx(img, i, 15, fram[0], fram[1], fram[2], 255);
      setPx(img, 0, i, fram[0], fram[1], fram[2], 255);
      setPx(img, 15, i, fram[0], fram[1], fram[2], 255);
    }
    // 发光网格
    for (var y = 0; y < TILE; y++) {
      for (var x = 0; x < TILE; x++) {
        if (emi) {
          var v = fbm(x, y, seed + 2400, 1);
          var br = 150 + Math.floor(v * 105);
          setPx(emi, x, y, br, br * 0.9, br * 0.6, 200);
        }
      }
    }
  }

  function draw_campfire(img, emi, seed) {
    fillAll(img, 0, 0, 0, 0);
    // 俯视交叉圆木
    var logC = hex("6b4628");
    for (var i = 0; i < 16; i++) {
      // 横木
      setPx(img, i, 6, logC[0], logC[1], logC[2], 255);
      setPx(img, i, 7, logC[0], logC[1], logC[2], 255);
      setPx(img, i, 8, logC[0], logC[1], logC[2], 255);
      // 竖木
      setPx(img, 6, i, logC[0]+10, logC[1], logC[2], 255);
      setPx(img, 7, i, logC[0]+10, logC[1], logC[2], 255);
      setPx(img, 8, i, logC[0]+10, logC[1], logC[2], 255);
    }
    // 中心余烬
    var emberP = pal(["ff4400","ff6600","ff8800","ffaa00","ffcc00"]);
    for (var y = 5; y < 10; y++) {
      for (var x = 5; x < 10; x++) {
        var dx = x - 7.5, dy = y - 7.5;
        var d = Math.sqrt(dx*dx + dy*dy);
        if (d < 2.5) {
          var ec = emberP[Math.floor(fbm(x, y, seed + 2500, 2) * emberP.length)];
          setPx(img, x, y, ec[0], ec[1], ec[2], 255);
          if (emi) setPx(emi, x, y, ec[0], ec[1], ec[2], 255);
        }
      }
    }
  }

  function draw_chest(img, emi, seed) {
    var chP = pal(["c8a060","b89850","d4b070","a88840"]);
    drawNoise(img, emi, seed, chP, 2);
    // 箱子正面细节
    var dark = hex("8a6030");
    // 锁扣
    var gold = hex("e0c040");
    setPx(img, 7, 7, gold[0], gold[1], gold[2], 255);
    setPx(img, 8, 7, gold[0], gold[1], gold[2], 255);
    setPx(img, 7, 8, gold[0], gold[1], gold[2], 255);
    setPx(img, 8, 8, gold[0], gold[1], gold[2], 255);
    // 金属边框
    for (var i = 3; i < 13; i++) {
      setPx(img, i, 5, dark[0], dark[1], dark[2], 255);
      setPx(img, i, 10, dark[0], dark[1], dark[2], 255);
    }
    for (var i = 4; i < 11; i++) {
      setPx(img, 3, i, dark[0], dark[1], dark[2], 255);
      setPx(img, 12, i, dark[0], dark[1], dark[2], 255);
    }
  }

  // 注册全部绘制函数
  TILES.grass_top = draw_grass_top;
  TILES.grass_side = draw_grass_side;
  TILES.dirt = draw_dirt;
  TILES.stone = draw_stone;
  TILES.cobble = draw_cobble;
  TILES.stone_brick = draw_stone_brick;
  TILES.bedrock = draw_bedrock;
  TILES.sand = draw_sand;
  TILES.sandstone_top = draw_sandstone_top;
  TILES.sandstone_side = draw_sandstone_side;
  TILES.red_sand = draw_red_sand;
  TILES.gravel = draw_gravel;
  TILES.log_side = draw_log_side;
  TILES.log_top = draw_log_top;
  TILES.planks = draw_planks;
  TILES.leaves = draw_leaves;
  TILES.fir_leaves = draw_fir_leaves;
  TILES.glass = draw_glass;
  TILES.water = draw_water;
  TILES.ice = draw_ice;
  TILES.snow = draw_snow;
  TILES.coal_ore = draw_coal_ore;
  TILES.iron_ore = draw_iron_ore;
  TILES.copper_ore = draw_copper_ore;
  TILES.torch = draw_torch;
  TILES.tallgrass = draw_tallgrass;
  TILES.crafting_top = draw_crafting_top;
  TILES.crafting_side = draw_crafting_side;
  TILES.basalt = draw_basalt;
  TILES.obsidian = draw_obsidian;
  TILES.ash = draw_ash;
  TILES.nomai_brick = draw_nomai_brick;
  TILES.nomai_carved = draw_nomai_carved;
  TILES.nomai_text = draw_nomai_text;
  TILES.nomai_metal = draw_nomai_metal;
  TILES.nomai_lamp = draw_nomai_lamp;
  TILES.gravity_crystal = draw_gravity_crystal;
  TILES.quantum_stone = draw_quantum_stone;
  TILES.ghost_matter = draw_ghost_matter;
  TILES.bramble = draw_bramble;
  TILES.bramble_thorn = draw_bramble_thorn;
  TILES.vine_glow = draw_vine_glow;
  TILES.lava = draw_lava;
  TILES.launch_pad = draw_launch_pad;
  TILES.metal = draw_metal;
  TILES.lamp = draw_lamp;
  TILES.campfire = draw_campfire;
  TILES.chest = draw_chest;

  // ===================== G.Textures 公开API =====================
  var _atlasCanvas = null;
  var _emissiveCanvas = null;
  var _nameToIndex = {};
  var _tileCanvases = {};
  var _inited = false;

  G.Textures = {
    init: function() {
      if (_inited) return;
      _inited = true;
      var i;
      for (i = 0; i < COUNT; i++) { _nameToIndex[G.TILE_NAMES[i]] = i; }

      // 创建图集画布
      _atlasCanvas = document.createElement('canvas');
      _atlasCanvas.width = COLS * TILE;
      _atlasCanvas.height = ROWS * TILE;
      var actx = _atlasCanvas.getContext('2d');

      _emissiveCanvas = document.createElement('canvas');
      _emissiveCanvas.width = COLS * TILE;
      _emissiveCanvas.height = ROWS * TILE;
      var ectx = _emissiveCanvas.getContext('2d');

      // 逐瓦片绘制
      for (i = 0; i < COUNT; i++) {
        var name = G.TILE_NAMES[i];
        var col = i % COLS, row = Math.floor(i / COLS);
        var ox = col * TILE, oy = row * TILE;
        var seed = SEEDS[name];

        var imgData = makeImg();
        var emiData = makeImg();
        fillAll(emiData, 0, 0, 0, 0);

        TILES[name](imgData, emiData, seed);

        // 画到图集
        var canvasImg = imgToCanvas(imgData);
        actx.drawImage(canvasImg, ox, oy);
        // 缓存独立瓦片
        _tileCanvases[name] = canvasImg;

        // 自发光图集
        var canvasEmi = imgToCanvas(emiData);
        ectx.drawImage(canvasEmi, ox, oy);
      }
    },

    get atlasCanvas() { return _atlasCanvas; },
    get emissiveCanvas() { return _emissiveCanvas; },

    index: function(name) {
      return _nameToIndex[name] !== undefined ? _nameToIndex[name] : -1;
    },

    tileCanvas: function(name) {
      return _tileCanvases[name] || null;
    }
  };

})();
