/* =====================================================================
   微体素地图 · 世界装配
   顺序：地形路网 → 13号种植园 → 废弃城市 → 大裂缝 → Cosmos → 海床 → 荒野残骸
   然后：光源聚合 → 光照体积烘焙 → 体素网格化 → 地形网格化 → 水面
   ===================================================================== */
(function (root) {
  'use strict';
  var VX = root.VX, M = VX.M;

  VX.SUNDIR = M.norm3([0.60, 0.50, 0.62]);

  VX.buildAll = function* (report) {
    var t0 = performance.now();
    var w = new VX.World();

    var stages = [
      ['构建沙盘地形与中轴路网', 'buildTerrain'],
      ['建造第13号种植园（主体）', 'buildP13'],
      ['建造废弃城市废墟', 'buildRuins'],
      ['开挖大裂缝与星实体', 'buildCrevasse'],
      ['建造 Cosmos 宇宙都市', 'buildCosmos'],
      ['铺展干涸海床', 'buildSeabed'],
      ['散布荒野残骸与轨道桥', 'buildWilds']
    ];
    var i, span = 0.30 / stages.length;
    var timings = {};
    for (i = 0; i < stages.length; i++) {
      report(stages[i][0], 0.01 + i * span);
      yield;
      var fn = VX[stages[i][1]];
      var st = performance.now();
      if (typeof fn === 'function') {
        try { fn(w); }
        catch (e) {
          console.error('站点构建失败: ' + stages[i][1], e);
          if (root.__errors) root.__errors.push(stages[i][1] + ': ' + e.message);
        }
      } else {
        console.warn('缺少站点模块: ' + stages[i][1]);
      }
      timings[stages[i][1]] = Math.round(performance.now() - st);
      yield;
    }

    report('汇总光源与加速结构', 0.32);
    yield;
    var tA = performance.now();
    var nLights = w.finalizeLights();
    w.buildTileMax();
    timings.lightsPrep = Math.round(performance.now() - tA);

    report('烘焙霓虹光照体积（' + nLights + ' 光源）', 0.36);
    yield;
    tA = performance.now();
    var lightVol = yield* VX.bakeLightVolume(w, function (p) {
      report('烘焙霓虹光照体积 ' + ((p * 100) | 0) + '%', 0.36 + p * 0.08);
    });
    timings.lightVol = Math.round(performance.now() - tA);

    report('体素网格化与日照烘焙', 0.45);
    yield;
    tA = performance.now();
    var voxels = yield* VX.meshVoxels(w, VX.SUNDIR, function (p, faces) {
      report('体素网格化 ' + ((p * 100) | 0) + '% · ' + faces.toLocaleString() + ' 面', 0.45 + p * 0.34);
    });
    timings.meshVoxels = Math.round(performance.now() - tA);

    report('地形网格化与光照贴图', 0.80);
    yield;
    tA = performance.now();
    var terrain = yield* VX.meshTerrain(w, VX.SUNDIR, function (p) {
      report('地形网格化 ' + ((p * 100) | 0) + '%', 0.80 + p * 0.16);
    });
    timings.meshTerrain = Math.round(performance.now() - tA);

    report('生成水面', 0.97);
    yield;
    tA = performance.now();
    var water = VX.meshWater(w);
    timings.meshWater = Math.round(performance.now() - tA);

    var ms = Math.round(performance.now() - t0);
    var info = {
      ms: ms, voxels: w.stats.voxels, emissive: w.stats.emissive, lights: nLights,
      faces: voxels.faces, terrainQuads: terrain.quads, waterQuads: water ? water.quads : 0,
      labels: w.labels.length, chunks: w.chunks.size,
      sectors: voxels.meshes.length + terrain.meshes.length, timings: timings
    };
    console.log('[微体素地图] 构建完成', info);
    report('完成', 1.0);
    return { world: w, voxels: voxels, terrain: terrain, water: water, lightVol: lightVol, info: info };
  };
})(window);
