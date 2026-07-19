"use strict";
// ============================================================
//  方块星野 BlockWilds - 太阳系定义 / 轨道力学 / 星球地形采样
//  真·无缝宇宙：所有星球实时公转自转，全部在同一物理场景
// ============================================================
window.G = window.G || {};

(function() {
  var U = G.U;
  var CFG = G.CONF;

  // ---------------- 地形采样公共工具 ----------------
  function B(key) { return G.BLOCK_BY_KEY[key] ? G.BLOCK_BY_KEY[key].id : 0; }

  // ============================================================
  //  星球定义
  //  sample(x,y,z,r,ctx) 返回方块id；坐标为星球本地整数中心坐标
  // ============================================================
  var PLANETS = [];

  // ---------- 木炉星（起点：森林/村落/间歇泉） ----------
  PLANETS.push({
    key: 'timber', name: '木炉星', radius: 280,
    orbitR: 5200, orbitSpeed: 0.0055, orbitPhase: 0.6, spinSpeed: 0.006,
    gravity: 1.0, atmosphere: { h: 90, color: 0x7fb8e8, fog: 0xa8d4f0 },
    skyColor: 0x78b4e0, hasO2: true,
    themeColor: '#7fc86a',
    desc: '你的家园。松林、村落与温暖的营火。',
    sample: function(x, y, z, r, dir) {
      var R = this.radius;
      var h = U.fbm3(dir.x * 3.1, dir.y * 3.1, dir.z * 3.1, 101, 4) * 26
            + U.ridge3(dir.x * 1.6, dir.y * 1.6, dir.z * 1.6, 202, 3) * 18 - 14;
      // 陨石坑
      var cr = U.noise3(dir.x * 5.2, dir.y * 5.2, dir.z * 5.2, 303);
      if (cr > 0.78) h -= (cr - 0.78) * 90;
      // 村落平原化（出生点周围地形压平，避免出生/建筑埋进山体）
      var sd = dir.x * 0.3102 + dir.y * 0.7204 + dir.z * 0.6203;
      if (sd > 0.9898) {
        var vt = Math.min(1, (sd - 0.9898) / 0.0082);
        vt = vt * vt * (3 - 2 * vt);
        h = h * (1 - vt) + 6 * vt;
      }
      var surf = R + h;
      if (r > surf) return 0;
      var d = surf - r;
      // 洞穴（村落正下方浅层不挖洞）
      if (r < surf - 3 && r > R - 60 && !(sd > 0.9898 && d < 12)) {
        var cave = U.fbm3(x * 0.055, y * 0.055, z * 0.055, 404, 3);
        if (cave > 0.62 && cave < 0.70) return 0;
      }
      if (r < R - 80) return B('bedrock');
      if (d < 1) return h > 14 ? B('stone') : B('grass');
      if (d < 4) return B('dirt');
      // 矿石
      var o = U.hash3(x, y, z, 505);
      if (d > 6) {
        if (o > 0.988) return B('coal_ore');
        if (o > 0.981 && d > 14) return B('iron_ore');
        if (o > 0.976 && d > 10) return B('copper_ore');
      }
      return B('stone');
    },
    flora: function(x, y, z, hash) {
      // 村落范围内不长树草（避免长进营地和小屋）
      var rr = Math.sqrt(x * x + y * y + z * z) || 1;
      var sd = (x * 0.3102 + y * 0.7204 + z * 0.6203) / rr;
      if (sd > 0.992) return null;
      if (hash > 0.86) return { type: 'tree' };
      if (hash > 0.62) return { type: 'grass' };
      return null;
    },
    farR: function(dir) {
      var h = G.U.fbm3(dir.x * 3.1, dir.y * 3.1, dir.z * 3.1, 101, 4) * 26
            + G.U.ridge3(dir.x * 1.6, dir.y * 1.6, dir.z * 1.6, 202, 3) * 18 - 14;
      var cr = G.U.noise3(dir.x * 5.2, dir.y * 5.2, dir.z * 5.2, 303);
      if (cr > 0.78) h -= (cr - 0.78) * 90;
      var sd = dir.x * 0.3102 + dir.y * 0.7204 + dir.z * 0.6203;
      if (sd > 0.9898) {
        var vt = Math.min(1, (sd - 0.9898) / 0.0082);
        vt = vt * vt * (3 - 2 * vt);
        h = h * (1 - vt) + 6 * vt;
      }
      return this.radius + h;
    }
  });

  // ---------- 余烬双星A：余烬星（峡谷/洞穴/晶体） ----------
  PLANETS.push({
    key: 'ember', name: '余烬星', radius: 250,
    orbitR: 2600, orbitSpeed: 0.011, orbitPhase: 2.4, spinSpeed: 0.012,
    twin: 'ashen', twinSep: 900, twinSpin: 0.02,
    gravity: 0.85, atmosphere: { h: 50, color: 0xd8a060, fog: 0xd8b080 },
    skyColor: 0xc89058, hasO2: false,
    themeColor: '#d8a050',
    desc: '灰烬双星之一。烈日下的峡谷深处藏着挪麦人的城市。',
    sample: function(x, y, z, r, dir) {
      var R = this.radius;
      var h = U.fbm3(dir.x * 2.6, dir.y * 2.6, dir.z * 2.6, 111, 3) * 20 - 8;
      // 赤道大峡谷
      var lat = Math.abs(dir.y);
      var canyon = U.ridge3(dir.x * 2.0, dir.y * 2.0, dir.z * 2.0, 222, 2);
      if (lat < 0.3 && canyon > 0.62) h -= (canyon - 0.62) * 140 * (1 - lat / 0.3);
      var surf = R + h;
      if (r > surf) return 0;
      var d = surf - r;
      if (r < surf - 3 && r > R - 70) {
        var cave = U.fbm3(x * 0.06, y * 0.06, z * 0.06, 333, 3);
        if (cave > 0.60 && cave < 0.71) {
          return 0;
        }
        if (cave > 0.705 && cave < 0.715 && d > 8) return B('gravity_crystal');
      }
      if (r < R - 80) return B('bedrock');
      if (d < 2) return B('sand');
      if (d < 6) return B('sandstone');
      var o = U.hash3(x, y, z, 444);
      if (o > 0.985 && d > 8) return B('copper_ore');
      return B('sandstone');
    },
    flora: function() { return null; },
    farR: function(dir) {
      var h = G.U.fbm3(dir.x * 2.6, dir.y * 2.6, dir.z * 2.6, 111, 3) * 20 - 8;
      var lat = Math.abs(dir.y);
      var canyon = G.U.ridge3(dir.x * 2.0, dir.y * 2.0, dir.z * 2.0, 222, 2);
      if (lat < 0.3 && canyon > 0.62) h -= (canyon - 0.62) * 140 * (1 - lat / 0.3);
      return this.radius + h;
    }
  });

  // ---------- 余烬双星B：灰渣星（沙柱/跃迁塔） ----------
  PLANETS.push({
    key: 'ashen', name: '灰渣星', radius: 250,
    orbitR: 2600, orbitSpeed: 0.011, orbitPhase: 2.4, spinSpeed: 0.012,
    twin: 'ember', twinSep: 900, twinSpin: 0.02, twinB: true,
    gravity: 0.85, atmosphere: { h: 40, color: 0xc09068, fog: 0xc8a088 },
    skyColor: 0xb08058, hasO2: false,
    themeColor: '#b08858',
    desc: '灰烬双星之一。沙柱正把它的沙子搬向兄弟星球，露出了埋藏的遗迹。',
    sample: function(x, y, z, r, dir) {
      var R = this.radius;
      var h = U.fbm3(dir.x * 2.2, dir.y * 2.2, dir.z * 2.2, 555, 3) * 10 - 2;
      var surf = R + h;
      if (r > surf) return 0;
      var d = surf - r;
      if (r < R - 60) return B('bedrock');
      if (d < 3) return B('red_sand');
      if (d < 7) return B('sandstone');
      var o = U.hash3(x, y, z, 666);
      if (o > 0.987) return B('iron_ore');
      return B('basalt');
    },
    flora: function() { return null; },
    farR: function(dir) {
      return this.radius + G.U.fbm3(dir.x * 2.2, dir.y * 2.2, dir.z * 2.2, 555, 3) * 10 - 2;
    }
  });

  window.__PLANETS_TMP = PLANETS;
})();

(function() {
  var U = G.U;
  var PLANETS = window.__PLANETS_TMP;
  function B(key) { return G.BLOCK_BY_KEY[key] ? G.BLOCK_BY_KEY[key].id : 0; }

  // ---------- 碎空星（外壳+空洞+中心黑洞） ----------
  PLANETS.push({
    key: 'brittle', name: '碎空星', radius: 270,
    orbitR: 7800, orbitSpeed: 0.0038, orbitPhase: 4.2, spinSpeed: 0.008,
    gravity: 0.9, atmosphere: { h: 60, color: 0x8090b8, fog: 0x707898 },
    skyColor: 0x50587a, hasO2: false, blackHole: 60,
    themeColor: '#8088c0',
    desc: '地壳正在崩塌，中心是一个饥饿的黑洞。挪麦人曾在壳下筑城。',
    sample: function(x, y, z, r, dir) {
      var R = this.radius;
      if (r < 130) return 0; // 黑洞腹地
      var h = U.fbm3(dir.x * 2.8, dir.y * 2.8, dir.z * 2.8, 777, 3) * 16 - 6;
      var surf = R + h;
      if (r > surf) return 0;
      // 壳厚约55；空洞由低频噪声挖穿
      var hole = U.fbm3(dir.x * 2.1, dir.y * 2.1, dir.z * 2.1, 888, 3);
      if (hole > 0.635) return 0;
      if (r < surf - 55) return 0; // 壳内空腔
      var d = surf - r;
      var lat = Math.abs(dir.y);
      if (d < 1.5) {
        if (lat > 0.72) return B('snow');
        return hole > 0.55 ? B('obsidian') : B('basalt');
      }
      if (d < 4 && lat > 0.72) return B('ice');
      var o = U.hash3(x, y, z, 999);
      if (o > 0.986) return B('iron_ore');
      if (d > 48) return B('obsidian');
      return B('basalt');
    },
    flora: function() { return null; },
    farR: function(dir) {
      var hole = G.U.fbm3(dir.x * 2.1, dir.y * 2.1, dir.z * 2.1, 888, 3);
      if (hole > 0.635) return this.radius - 56;
      return this.radius + G.U.fbm3(dir.x * 2.8, dir.y * 2.8, dir.z * 2.8, 777, 3) * 16 - 6;
    }
  });

  // ---------- 深巨星（海洋+岛屿+龙卷风） ----------
  PLANETS.push({
    key: 'giant', name: '深巨星', radius: 300,
    orbitR: 10600, orbitSpeed: 0.0026, orbitPhase: 1.1, spinSpeed: 0.010,
    gravity: 1.15, atmosphere: { h: 110, color: 0x3a7868, fog: 0x4a8878 },
    skyColor: 0x387060, hasO2: true, seaLevel: 288,
    themeColor: '#3aa088',
    desc: '被无尽海洋覆盖的巨行星，龙卷风把岛屿抛向天空。',
    sample: function(x, y, z, r, dir) {
      var R = this.radius, SEA = this.seaLevel;
      // 岛屿：低频噪声挑选出若干岛
      var isl = U.fbm3(dir.x * 2.4, dir.y * 2.4, dir.z * 2.4, 1212, 3);
      var core = 240;
      if (r <= core) {
        if (r < core - 40) return B('bedrock');
        var cave = U.fbm3(x * 0.05, y * 0.05, z * 0.05, 1313, 3);
        if (cave > 0.63 && cave < 0.70 && r > core - 30) return 0;
        return B('stone');
      }
      if (isl > 0.615) {
        var t = (isl - 0.615) * 22;
        var h = SEA - 282 + t * 20 + U.fbm3(dir.x * 7, dir.y * 7, dir.z * 7, 1414, 2) * 8;
        var surf = 282 + Math.min(h, 34);
        if (r <= surf) {
          var d = surf - r;
          if (d < 1.2) return surf > SEA + 1.5 ? B('grass') : B('sand');
          if (d < 4) return B('dirt');
          return B('stone');
        }
      }
      if (r <= SEA) return B('water');
      return 0;
    },
    flora: function(x, y, z, hash) {
      if (hash > 0.90) return { type: 'tree' };
      if (hash > 0.75) return { type: 'grass' };
      return null;
    },
    farR: function(dir) {
      var isl = G.U.fbm3(dir.x * 2.4, dir.y * 2.4, dir.z * 2.4, 1212, 3);
      if (isl > 0.615) {
        var t = (isl - 0.615) * 22;
        var h = this.seaLevel - 282 + t * 20 + G.U.fbm3(dir.x * 7, dir.y * 7, dir.z * 7, 1414, 2) * 8;
        var surf = 282 + Math.min(h, 34);
        if (surf > this.seaLevel) return surf;
      }
      return this.seaLevel - 1;
    }
  });

  // ---------- 黑棘星（迷雾+棘藤+鮟鱇鱼） ----------
  PLANETS.push({
    key: 'bramble', name: '黑棘星', radius: 260,
    orbitR: 13600, orbitSpeed: 0.0018, orbitPhase: 5.3, spinSpeed: 0.004,
    gravity: 0.7, atmosphere: { h: 120, color: 0x60707a, fog: 0x9aa8ae, fogDense: true },
    skyColor: 0x5a6a72, hasO2: false, foggy: true,
    themeColor: '#7a8a90',
    desc: '一颗被荆棘撑破的行星，白雾深处传来低沉的呼吸。',
    sample: function(x, y, z, r, dir) {
      var R = this.radius;
      // 薄壳大空腔
      var h = U.fbm3(dir.x * 2.5, dir.y * 2.5, dir.z * 2.5, 1515, 3) * 14 - 4;
      var surf = R + h;
      var hole = U.fbm3(dir.x * 1.8, dir.y * 1.8, dir.z * 1.8, 1616, 2);
      // 巨型棘藤：内部管状 ridge
      var vine = U.ridge3(x * 0.016, y * 0.016, z * 0.016, 1717, 2);
      if (r < surf - 24) {
        if (r < 60) return B('bedrock');
        if (vine > 0.78) {
          var vd = vine - 0.78;
          if (vd > 0.05) return B('bramble');
          var g = U.hash3(x, y, z, 1818);
          if (g > 0.93) return B('vine_glow');
          return B('bramble');
        }
        return 0;
      }
      if (r > surf) return 0;
      if (hole > 0.60) return 0; // 壳上破洞
      var d = surf - r;
      if (d < 2) return B('bramble');
      var o = U.hash3(x, y, z, 1919);
      if (o > 0.96) return B('bramble_thorn');
      return B('bramble');
    },
    flora: function(x, y, z, hash) {
      if (hash > 0.9) return { type: 'thorn' };
      return null;
    },
    farR: function(dir) {
      var hole = G.U.fbm3(dir.x * 1.8, dir.y * 1.8, dir.z * 1.8, 1616, 2);
      if (hole > 0.60) return this.radius - 22;
      return this.radius + G.U.fbm3(dir.x * 2.5, dir.y * 2.5, dir.z * 2.5, 1515, 3) * 14 - 4;
    }
  });

  // ---------- 量子月（不被观测时移动） ----------
  PLANETS.push({
    key: 'quantum', name: '量子月', radius: 60, small: true,
    orbitR: 5200, orbitSpeed: 0.0055, orbitPhase: 0.6, spinSpeed: 0.02,
    quantum: true, quantumHosts: ['timber', 'ember', 'brittle', 'giant', 'bramble'],
    gravity: 0.5, atmosphere: { h: 30, color: 0xb8a8d8, fog: 0xcabcE8 },
    skyColor: 0x9a88c0, hasO2: false,
    themeColor: '#b090e0',
    desc: '不被观测时，它会移动。',
    sample: function(x, y, z, r, dir) {
      var R = this.radius;
      var h = U.fbm3(dir.x * 3.5, dir.y * 3.5, dir.z * 3.5, 2020, 3) * 10 - 3;
      var surf = R + h;
      if (r > surf) return 0;
      var d = surf - r;
      if (r < 20) return B('bedrock');
      if (d < 2) {
        var q = U.hash3(x, y, z, 2121);
        return q > 0.6 ? B('quantum_stone') : B('stone');
      }
      return B('stone');
    },
    flora: function() { return null; },
    farR: function(dir) {
      return this.radius + G.U.fbm3(dir.x * 3.5, dir.y * 3.5, dir.z * 3.5, 2020, 3) * 10 - 3;
    }
  });

  window.__PLANETS_TMP = PLANETS;
})();

// ============================================================
//  太阳系运转 / 结构注入 / 公开 API
// ============================================================
(function() {
  var U = G.U;
  var PLANETS = window.__PLANETS_TMP;
  delete window.__PLANETS_TMP;
  function B(key) { return G.BLOCK_BY_KEY[key] ? G.BLOCK_BY_KEY[key].id : 0; }

  var SUN = {
    key: 'sun', name: '恒星', radius: 420, isSun: true,
    themeColor: '#ffcf5a',
    desc: '这颗恒星已经走到了生命的尽头。'
  };

  var byKey = {};
  PLANETS.forEach(function(p) { byKey[p.key] = p; });

  // ---------------- 每颗星球的运行时状态 ----------------
  PLANETS.forEach(function(p) {
    p.pos = new THREE.Vector3();
    p.prevPos = new THREE.Vector3();
    p.vel = new THREE.Vector3();
    p.spin = 0;
    p.prevSpin = 0;
    p.quat = new THREE.Quaternion();
    p.edits = {};           // "x,y,z" -> blockId 玩家修改
    p.structures = {};      // chunkKey -> [[x,y,z,id],...]
    p.group = null;         // three.js 组（由渲染端建立）
    p.influence = p.radius * 3.2;
    if (p.quantum) p.quantumHostKey = 'giant';
  });
  SUN.pos = new THREE.Vector3(0, 0, 0);
  SUN.vel = new THREE.Vector3();
  SUN.radiusNow = SUN.radius;

  // ---------------- 轨道更新 ----------------
  function updateOrbits(t, dt) {
    for (var i = 0; i < PLANETS.length; i++) {
      var p = PLANETS[i];
      p.prevPos.copy(p.pos);
      p.prevSpin = p.spin;
      if (p.quantum && p.quantumHostKey) {
        var host = byKey[p.quantumHostKey];
        var ang = t * 0.05 + i;
        p.pos.set(
          host.pos.x + Math.cos(ang) * (host.radius + 420),
          host.pos.y + Math.sin(ang * 0.7) * 160,
          host.pos.z + Math.sin(ang) * (host.radius + 420)
        );
      } else {
        var a = p.orbitPhase + t * p.orbitSpeed;
        var cx = Math.cos(a) * p.orbitR, cz = Math.sin(a) * p.orbitR;
        var incl = (i % 2 ? 0.03 : -0.02);
        var cy = Math.sin(a * 1.3) * p.orbitR * incl;
        if (p.twin) {
          var ta = t * p.twinSpin + (p.twinB ? Math.PI : 0);
          cx += Math.cos(ta) * p.twinSep * 0.5;
          cz += Math.sin(ta) * p.twinSep * 0.5;
        }
        p.pos.set(cx, cy, cz);
      }
      p.spin = t * p.spinSpeed;
      p.quat.setFromAxisAngle(U.tmpV[9].set(0, 1, 0), p.spin);
      if (dt > 0) p.vel.copy(p.pos).sub(p.prevPos).multiplyScalar(1 / dt);
    }
  }

  // ---------------- 世界坐标 <-> 星球本地坐标 ----------------
  var _q = new THREE.Quaternion();
  function worldToLocal(p, wpos, out) {
    out = out || new THREE.Vector3();
    out.copy(wpos).sub(p.pos);
    _q.copy(p.quat).invert();
    out.applyQuaternion(_q);
    return out;
  }
  function localToWorld(p, lpos, out) {
    out = out || new THREE.Vector3();
    out.copy(lpos).applyQuaternion(p.quat).add(p.pos);
    return out;
  }
  function localDirToWorld(p, ldir, out) {
    out = out || new THREE.Vector3();
    out.copy(ldir).applyQuaternion(p.quat);
    return out;
  }
  function worldDirToLocal(p, wdir, out) {
    out = out || new THREE.Vector3();
    _q.copy(p.quat).invert();
    out.copy(wdir).applyQuaternion(_q);
    return out;
  }

  // ---------------- 方块读取（edits > structures > terrain） ----------------
  var _dir = new THREE.Vector3();
  function getBlock(p, x, y, z) {
    var k = x + ',' + y + ',' + z;
    var e = p.edits[k];
    if (e !== undefined) return e;
    var ck = (x >> 4) + ',' + (y >> 4) + ',' + (z >> 4);
    var st = p.structures[ck];
    if (st) {
      for (var i = 0; i < st.length; i++) {
        var s = st[i];
        if (s[0] === x && s[1] === y && s[2] === z) return s[3];
      }
    }
    var r = Math.sqrt(x * x + y * y + z * z);
    if (r < 0.001) return B('bedrock');
    _dir.set(x / r, y / r, z / r);
    var id = p.sample(x, y, z, r, _dir);
    return id;
  }

  function setBlock(p, x, y, z, id) {
    p.edits[x + ',' + y + ',' + z] = id;
  }

  // 结构写入工具
  function stampBlock(p, x, y, z, id) {
    var ck = (x >> 4) + ',' + (y >> 4) + ',' + (z >> 4);
    (p.structures[ck] = p.structures[ck] || []).push([x, y, z, id]);
  }

  // 求某方向上的地表半径（粗步进+细化，兼顾性能）
  function surfaceR(p, dir) {
    var hi = p.radius + 60, lo = p.radius - 80;
    var r, found = -1;
    for (r = hi; r > lo; r -= 4) {
      var x = Math.round(dir.x * r), y = Math.round(dir.y * r), z = Math.round(dir.z * r);
      var rr = Math.sqrt(x * x + y * y + z * z);
      if (rr < 1) break;
      _dir.set(x / rr, y / rr, z / rr);
      if (p.sample(x, y, z, rr, _dir) !== 0) { found = r; break; }
    }
    if (found < 0) return p.radius;
    for (r = Math.min(hi, found + 4); r >= found; r--) {
      var x2 = Math.round(dir.x * r), y2 = Math.round(dir.y * r), z2 = Math.round(dir.z * r);
      var rr2 = Math.sqrt(x2 * x2 + y2 * y2 + z2 * z2);
      if (rr2 < 1) break;
      _dir.set(x2 / rr2, y2 / rr2, z2 / rr2);
      if (p.sample(x2, y2, z2, rr2, _dir) !== 0) return r;
    }
    return found;
  }

  G.Solar = {
    PLANETS: PLANETS, SUN: SUN, byKey: byKey,
    updateOrbits: updateOrbits,
    worldToLocal: worldToLocal, localToWorld: localToWorld,
    localDirToWorld: localDirToWorld, worldDirToLocal: worldDirToLocal,
    getBlock: getBlock, setBlock: setBlock,
    stampBlock: stampBlock, surfaceR: surfaceR,

    // 最近的星球与影响者
    nearestPlanet: function(wpos) {
      var best = null, bd = Infinity;
      for (var i = 0; i < PLANETS.length; i++) {
        var p = PLANETS[i];
        var d = wpos.distanceTo(p.pos) - p.radius;
        if (d < bd) { bd = d; best = p; }
      }
      return { planet: best, surfDist: bd };
    },

    // 世界坐标处的重力（含所有星球+恒星）
    gravityAt: function(wpos, out) {
      out.set(0, 0, 0);
      var tmp = U.tmpV[8];
      for (var i = 0; i < PLANETS.length; i++) {
        var p = PLANETS[i];
        tmp.copy(p.pos).sub(wpos);
        var d = tmp.length();
        if (d > p.influence || d < 0.5) continue;
        var gs = G.CONF.GRAVITY * p.gravity;
        var R = p.radius;
        var mag = d > R ? gs * (R * R) / (d * d) : gs * (d / R);
        out.add(tmp.multiplyScalar(mag / d));
      }
      // 恒星引力（弱，太空中有感知即可）
      tmp.copy(SUN.pos).sub(wpos);
      var ds = tmp.length();
      if (ds > SUN.radiusNow && ds < 30000) {
        var m = G.CONF.GRAVITY * 3.2 * (SUN.radius * SUN.radius) / (ds * ds);
        out.add(tmp.multiplyScalar(m / ds));
      }
      return out;
    }
  };
})();

// ============================================================
//  结构生成：村落 / 挪麦遗迹 / 跃迁塔 / 逃生舱 / 量子碎片
// ============================================================
(function() {
  var U = G.U;
  function B(key) { return G.BLOCK_BY_KEY[key] ? G.BLOCK_BY_KEY[key].id : 0; }

  // 以地表某点为原点建立局部坐标系（up=径向, fwd/right 切向）
  function frameAt(p, dir) {
    var up = dir.clone().normalize();
    var ref = Math.abs(up.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    var right = new THREE.Vector3().crossVectors(ref, up).normalize();
    var fwd = new THREE.Vector3().crossVectors(up, right).normalize();
    var baseR = G.Solar.surfaceR(p, up);
    var origin = up.clone().multiplyScalar(baseR);
    return {
      put: function(rx, ry, rz, id) {
        var v = origin.clone()
          .addScaledVector(right, rx)
          .addScaledVector(up, ry)
          .addScaledVector(fwd, rz);
        G.Solar.stampBlock(p, Math.round(v.x), Math.round(v.y), Math.round(v.z), id);
      },
      world: function(rx, ry, rz) {
        return origin.clone()
          .addScaledVector(right, rx)
          .addScaledVector(up, ry)
          .addScaledVector(fwd, rz);
      },
      up: up, baseR: baseR, origin: origin
    };
  }

  // 小木屋
  function cabin(f, w, h, d) {
    var x, y, z;
    for (x = -w; x <= w; x++) for (z = -d; z <= d; z++) {
      f.put(x, 0, z, B('planks'));
      for (y = 1; y <= h; y++) {
        var wall = (Math.abs(x) === w || Math.abs(z) === d);
        if (wall) {
          var isDoor = (z === d && Math.abs(x) <= 0 && y <= 2);
          var isWin = (y === 2 && ((Math.abs(x) === w && Math.abs(z) <= 1) || (Math.abs(z) === d && Math.abs(x) === 2)));
          f.put(x, y, z, isDoor ? 0 : (isWin ? B('glass') : (Math.abs(x) === w && Math.abs(z) === d ? B('log') : B('planks'))));
        }
      }
      f.put(x, h + 1, z, B('planks'));
    }
    f.put(0, 1, 0, B('crafting'));
    f.put(w - 1, 1, -d + 1, B('chest'));
    f.put(-w + 1, 1, -d + 1, B('lamp'));
  }

  // 挪麦小遗迹：拱形石砖 + 文字墙
  function nomaiRuin(f, size) {
    var x, y, z;
    for (x = -size; x <= size; x++) for (z = -size; z <= size; z++) {
      var edge = Math.max(Math.abs(x), Math.abs(z));
      if (edge === size) {
        var hh = 3 + ((x + z) % 2 === 0 ? 1 : 0);
        for (y = 0; y <= hh; y++) f.put(x, y, z, (y === hh) ? B('nomai_carved') : B('nomai_brick'));
      } else if (edge === 0) {
        f.put(0, 0, 0, B('nomai_lamp'));
      } else {
        f.put(x, 0, z, ((x * 3 + z * 5) % 7 === 0) ? B('nomai_carved') : B('nomai_brick'));
      }
    }
    // 文字碑
    f.put(0, 1, -size + 1, B('nomai_text'));
    f.put(0, 2, -size + 1, B('nomai_text'));
    f.put(-2, 1, -size + 1, B('nomai_brick'));
    f.put(2, 1, -size + 1, B('nomai_brick'));
  }

  // 高塔（跃迁塔/灯塔）
  function tower(f, hgt, mat, topMat) {
    var x, z, y;
    for (y = 0; y < hgt; y++) {
      for (x = -2; x <= 2; x++) for (z = -2; z <= 2; z++) {
        var edge = Math.max(Math.abs(x), Math.abs(z));
        if (edge === 2) {
          var isDoor = (y <= 2 && z === 2 && x === 0);
          var isWin = (y % 5 === 3 && edge === 2 && (x === 0 || z === 0));
          if (!isDoor) f.put(x, y, z, isWin ? 0 : mat);
        } else if (y === 0) f.put(x, y, z, mat);
      }
    }
    for (x = -2; x <= 2; x++) for (z = -2; z <= 2; z++) f.put(x, hgt, z, topMat);
    f.put(0, hgt + 1, 0, B('nomai_lamp'));
  }

  // 逃生舱（黑棘星坠毁舱体）
  function escapePod(f) {
    var x, y, z;
    for (y = 0; y <= 4; y++) for (x = -2; x <= 2; x++) for (z = -2; z <= 2; z++) {
      var rr = Math.abs(x) + Math.abs(z) + Math.abs(y - 2) * 0.6;
      if (rr < 3.4 && rr > 2.0) f.put(x, y, z + 1, B('metal'));
    }
    f.put(0, 1, -1, B('nomai_text'));
    f.put(0, 0, 1, B('lamp'));
  }

  var _built = false;
  G.Structures = {
    // main.js 在 BLOCKS 就绪后调用一次
    buildAll: function() {
      if (_built) return; _built = true;
      var S = G.Solar, byKey = S.byKey;

      // ---- 木炉星：村落（出生点） ----
      var timber = byKey.timber;
      var spawnDir = new THREE.Vector3(0.31, 0.72, 0.62).normalize();
      timber.spawnDir = spawnDir;
      var f0 = frameAt(timber, spawnDir);
      timber.spawnFrame = f0;
      // 营火
      f0.put(0, 1, 0, B('campfire'));
      for (var i = 0; i < 8; i++) {
        var a = i / 8 * Math.PI * 2;
        f0.put(Math.round(Math.cos(a) * 2.2), 1, Math.round(Math.sin(a) * 2.2), B('cobble'));
      }
      // 木屋×2
      var f1 = frameAt(timber, spawnDir.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), 0.045).normalize());
      cabin(f1, 3, 3, 4);
      var f2 = frameAt(timber, spawnDir.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), 0.05).normalize());
      cabin(f2, 4, 3, 3);
      // 发射塔 + 停机坪（飞船初始点）
      var padDir = spawnDir.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), -0.06).normalize();
      var fPad = frameAt(timber, padDir);
      for (var x = -4; x <= 4; x++) for (var z = -4; z <= 4; z++) fPad.put(x, 0, z, B('launch_pad'));
      timber.shipPadFrame = fPad;
      // 村中挪麦石碑（教学文本+发射密码）
      var fN = frameAt(timber, spawnDir.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), -0.04).normalize());
      nomaiRuin(fN, 3);
      timber.museumFrame = fN;
      // 量子碎片
      var fQ = frameAt(timber, spawnDir.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), 0.35).normalize());
      timber.quantumShardFrame = fQ;

      // ---- 灰渣星：跃迁塔（藏跃迁核心） ----
      var ashen = byKey.ashen;
      var atDir = new THREE.Vector3(0.2, 0.95, 0.24).normalize();
      var fA = frameAt(ashen, atDir);
      tower(fA, 12, B('nomai_brick'), B('nomai_carved'));
      fA.put(0, 1, 0, B('nomai_text'));
      ashen.warpTowerFrame = fA;

      // ---- 余烬星：峡谷城遗迹 ----
      var ember = byKey.ember;
      var ecDir = new THREE.Vector3(0.9, 0.05, 0.42).normalize();
      var fE = frameAt(ember, ecDir);
      nomaiRuin(fE, 4);
      ember.cityFrame = fE;

      // ---- 碎空星：南极遗迹 ----
      var brittle = byKey.brittle;
      var bDir = new THREE.Vector3(0.12, -0.98, 0.1).normalize();
      var fB = frameAt(brittle, bDir);
      nomaiRuin(fB, 4);
      tower(fB, 8, B('nomai_brick'), B('nomai_carved'));
      brittle.ruinFrame = fB;

      // ---- 深巨星：岛上信标塔 ----
      var giant = byKey.giant;
      var gDir = new THREE.Vector3(0.62, 0.5, 0.6).normalize();
      // 找一座岛：沿着几个方向试探
      for (var t = 0; t < 40; t++) {
        var d2 = gDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), t * 0.31).normalize();
        if (G.Solar.surfaceR(giant, d2) > giant.seaLevel + 1) { gDir = d2; break; }
      }
      var fG = frameAt(giant, gDir);
      tower(fG, 7, B('stone_brick') || B('cobble'), B('lamp'));
      fG.put(0, 1, 0, B('nomai_text'));
      giant.islandFrame = fG;

      // ---- 黑棘星：逃生舱 ----
      var bramble = byKey.bramble;
      var pDir = new THREE.Vector3(-0.5, 0.6, -0.62).normalize();
      var fP = frameAt(bramble, pDir);
      escapePod(fP);
      bramble.podFrame = fP;

      // ---- 量子月：顶部圣坛 ----
      var quantum = byKey.quantum;
      var fQm = frameAt(quantum, new THREE.Vector3(0, 1, 0));
      nomaiRuin(fQm, 3);
      quantum.shrineFrame = fQm;
    },
    frameAt: frameAt
  };
})();
