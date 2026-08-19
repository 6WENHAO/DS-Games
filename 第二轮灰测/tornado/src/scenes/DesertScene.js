/**
 * DesertScene.js — 沙漠（西南部干旱小镇）。
 * 沙丘地形 + 土坯房小镇主街 + 采油塔 + 铁皮水塔 + 台地地标 + 巨柱仙人掌，
 * 龙卷风过境时把屋顶、招牌、废车、风滚草一起卷走。
 */
import * as THREE from 'three';
import { LandScene } from './LandScene.js';
import { warpedFbm2, ridged2, fbm2 } from '../core/Noise.js';
import * as BK from '../world/BuildingKit.js';
import * as DP from '../scenes/props/DesertProps.js';

export class DesertScene extends LandScene {
  constructor(ctx) {
    super(ctx);
    this.name = 'desert';
    this.label = '沙漠';
    this.seed = 77213;
    this.groundAlbedo = 0x8a6a44;
    this.dustColor = new THREE.Color(0.62, 0.48, 0.31);
    this.camStart = {
      pos: new THREE.Vector3(-390, 96, 470),
      target: new THREE.Vector3(70, 160, -90),
    };
    this.radius = 2400;
  }

  terrainConfig() {
    const heightFn = (x, z) => {
      /* 沙丘：山脊噪声沿主风向拉伸 + 大尺度起伏 */
      const ang = 0.6;
      const rx = Math.cos(ang) * x + Math.sin(ang) * z;
      const rz = -Math.sin(ang) * x + Math.cos(ang) * z;
      let h = ridged2(rx * 0.0012, rz * 0.0042, 4, 2.05, 0.5, 33) * 22;
      h += warpedFbm2(x * 0.00035, z * 0.00035, 0.8, 5) * 26;
      h += fbm2(x * 0.004, z * 0.004, 3, 2.1, 0.5, 9) * 1.6;
      /* 干河床（wash） */
      const v = Math.abs(x * 0.00062 + Math.sin(z * 0.0011) * 0.7);
      h -= Math.exp(-v * v * 12) * 9;
      return h;
    };
    return {
      lighting: this.lighting, heightFn, extent: 9216, res: 1024, rMax: 14000,
      look: {
        colLow: new THREE.Color(0.44, 0.33, 0.20),
        colMid: new THREE.Color(0.62, 0.48, 0.30),
        colHigh: new THREE.Color(0.76, 0.63, 0.43),
        colRock: new THREE.Color(0.40, 0.28, 0.21),
        colScar: new THREE.Color(0.34, 0.24, 0.15),
        slopeRock: 0.34, detail: 0.42, detailScale: 0.05,
        ripple: 0.85, rippleScale: 0.55, macro: 0.45,
        roughness: 0.9, dustLift: 0.42,
      },
    };
  }

  grassConfig() {
    /* 沙漠只有稀疏枯草丛 */
    return {
      lighting: this.lighting, terrain: this.terrain, segments: 2,
      layers: [
        { tile: 130, count: 5200, size: 0.5, width: 0.05, far: 150, patchy: 0.66, curve: 0.3 },
        { tile: 520, count: 5200, size: 1.15, width: 0.13, far: 620, patchy: 0.70, curve: 0.34 },
      ],
      look: {
        colBase: new THREE.Color(0.24, 0.19, 0.09),
        colTip: new THREE.Color(0.62, 0.53, 0.26),
        colDry: new THREE.Color(0.68, 0.57, 0.30),
        dry: 0.85, gust: 1.35,
      },
    };
  }

  async layout(rng) {
    /* ---------------- 小镇主街 ---------------- */
    const sx = -60, sz = 90, sa = 0.42;
    const along = (t, off) => [
      sx + Math.cos(sa) * t - Math.sin(sa) * off,
      sz + Math.sin(sa) * t + Math.cos(sa) * off,
    ];
    for (let i = 0; i < 5; i++) {
      let p = along(-90 + i * 44, -16);
      this.placeBuilding(BK.buildDesertStore(rng, { palette: i % 3 }), p[0], p[1], sa + Math.PI, 1);
      p = along(-80 + i * 44, 18);
      this.placeBuilding(i % 2 ? BK.buildAdobeHouse(rng, { palette: i % 3 }) : BK.buildDesertStore(rng, { palette: (i + 1) % 3 }), p[0], p[1], sa, 1);
    }
    let p = along(120, 0);
    this.placeBuilding(BK.buildWaterTower(rng), p[0], p[1], sa, 1.1);
    p = along(-140, 24);
    this.placeBuilding(BK.buildGasStation(rng), p[0], p[1], sa - 0.2);
    p = along(-150, -30);
    this.placeBuilding(BK.buildTrailer(rng), p[0], p[1], sa + 0.5);
    p = along(150, 40);
    this.placeBuilding(BK.buildShed(rng), p[0], p[1], sa + 0.9);

    /* 主街上的道具 */
    for (let i = 0; i < 6; i++) {
      p = along(-100 + i * 40, rng.range(-6, 6));
      this.placeProp(DP.buildFuelPump(rng), p[0], p[1], sa, 1, 320);
    }
    for (let i = 0; i < 4; i++) {
      p = along(-70 + i * 55, rng.range(-24, 26));
      this.placeProp(DP.buildAbandonedCar(rng), p[0], p[1], rng.range(0, 6.28));
    }
    p = along(70, 26);
    this.placeProp(DP.buildSatelliteDish(rng), p[0], p[1], sa);
    p = along(-30, -28);
    this.placeProp(DP.buildWaterTank(rng), p[0], p[1], 0);

    /* ---------------- 外围土坯农舍 ---------------- */
    for (const [ax, az, ar] of [[420, -280, 1.1], [-520, -360, -0.4], [300, 420, 2.3]]) {
      this.placeBuilding(BK.buildAdobeHouse(rng), ax, az, ar);
      this.placeBuilding(BK.buildShed(rng), ax + 22, az + 12, ar + 0.6);
      this.placeProp(DP.buildCactusFence(rng, { length: 14 }), ax - 16, az + 16, ar);
      this.placeProp(DP.buildWaterTank(rng), ax + 14, az - 14, 0);
      for (let i = 0; i < 3; i++) {
        this.placeProp(DP.buildCrate(rng), ax + rng.range(-18, 18), az + rng.range(-18, 18), rng.range(0, 6.28), 1, 260);
      }
    }

    /* ---------------- 采油区 ---------------- */
    for (let i = 0; i < 5; i++) {
      const a = 0.7 + i * 0.42;
      const d = 620 + i * 55;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      this.placeProp(DP.buildOilDerrick(rng), x, z, rng.range(0, 6.28), 1, 4200);
      this.placeProp(DP.buildCrate(rng), x + 12, z + 8, rng.range(0, 6.28), 1, 300);
    }
    this.placeBuilding(BK.buildGrainElevator(rng), -760, 520, 0.6, 0.9);

    /* ---------------- 台地地标（远景 LOD） ---------------- */
    for (const [mx, mz, ms] of [[-1500, -1250, 1.5], [1750, -980, 1.15], [-1350, 1500, 1.0], [2100, 900, 1.35]]) {
      this.placeProp(DP.buildMesa(rng), mx, mz, rng.range(0, 6.28), ms, 20000);
    }
    this.placeProp(DP.buildWindmillMetal(rng), 240, -160, 0.4, 1, 3000);
    this.placeProp(DP.buildWindmillMetal(rng), -430, 260, 1.4, 1, 3000);

    /* ---------------- 高压线 ---------------- */
    this.powerLine(-1000, -560, 1000, -420, 10, (r) => BK.buildPowerPole(r));

    /* ---------------- 上一场龙卷风留下的废墟与旧路径 ---------------- */
    p = along(-215, -8);
    this.placeBuilding(BK.buildDesertStore(rng, { broken: true }), p[0], p[1], sa + Math.PI, 1);
    p = along(-205, 30);
    this.placeBuilding(BK.buildAdobeHouse(rng, { broken: true }), p[0], p[1], sa, 1);
    p = along(-240, 16);
    this.placeProp(DP.buildAbandonedCar(rng), p[0], p[1], sa + 1.2);
    this.oldTrack(-1500, 460, -120, -180, 80, 34);

    /* ---------------- 植被与岩石 ---------------- */
    this.scatter((r) => DP.buildSaguaro(r), { count: 90, rMin: 70, rMax: 1900, slopeMax: 0.34, scale: [0.8, 1.5], maxDist: 2400 });
    this.scatter((r) => DP.buildBarrelCactus(r), { count: 70, rMin: 40, rMax: 1200, maxDist: 400 });
    this.scatter((r) => DP.buildPrickly(r), { count: 60, rMin: 40, rMax: 1300, maxDist: 520 });
    this.scatter((r) => DP.buildYucca(r), { count: 80, rMin: 40, rMax: 1500, maxDist: 600 });
    this.scatter((r) => DP.buildJoshuaTree(r), { count: 34, rMin: 120, rMax: 1800, scale: [0.9, 1.6], maxDist: 2200 });
    this.scatter((r) => DP.buildDeadBush(r), { count: 110, rMin: 30, rMax: 1600, maxDist: 480 });
    this.scatter((r) => DP.buildTumbleweed(r), { count: 46, rMin: 40, rMax: 1200, maxDist: 520 });
    this.scatter((r) => DP.buildRockSmall(r), { count: 130, rMin: 30, rMax: 2000, scale: [0.7, 1.8], maxDist: 700 });
    this.scatter((r) => DP.buildRockLarge(r), { count: 40, rMin: 100, rMax: 2200, scale: [0.8, 2.0], maxDist: 3000 });
    this.scatter((r) => DP.buildCattleSkull(r), { count: 8, rMin: 60, rMax: 700, maxDist: 200 });
    this.scatter((r) => DP.buildSandRipplePatch(r), { count: 40, rMin: 30, rMax: 500, maxDist: 260 });
  }
}
