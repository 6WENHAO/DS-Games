/**
 * PlainScene.js — 大平原（美国中西部农业带）。
 * 农舍 / 谷仓 / 筒仓 / 水塔 / 风车 / 教堂 / 谷物提升塔 / 加油站 / 拖车房 +
 * 防风林、玉米地、栅栏、高压线、拖拉机皮卡等，全部可被龙卷风逐件撕碎。
 */
import * as THREE from 'three';
import { LandScene } from './LandScene.js';
import { warpedFbm2, fbm2 } from '../core/Noise.js';
import * as BK from '../world/BuildingKit.js';
import * as PP from '../scenes/props/PlainProps.js';

export class PlainScene extends LandScene {
  constructor(ctx) {
    super(ctx);
    this.name = 'plain';
    this.label = '平原';
    this.seed = 20240519;
    this.groundAlbedo = 0x4c5230;
    this.dustColor = new THREE.Color(0.34, 0.28, 0.19);
    this.camStart = {
      pos: new THREE.Vector3(-430, 78, 430),
      target: new THREE.Vector3(60, 150, -110),
    };
    this.radius = 2200;
  }

  terrainConfig() {
    const heightFn = (x, z) => {
      /* 缓丘 + 长波起伏；一条浅河谷穿过 */
      let h = warpedFbm2(x * 0.00046, z * 0.00046, 0.75, 11) * 15;
      h += fbm2(x * 0.0023, z * 0.0023, 3, 2.1, 0.5, 71) * 3.4;
      const v = Math.abs(z * 0.00072 + Math.sin(x * 0.00085) * 0.6);
      h -= Math.exp(-v * v * 9) * 8.5;
      return h;
    };
    return {
      lighting: this.lighting, heightFn, extent: 8192, res: 1024, rMax: 13000,
      look: {
        colLow: new THREE.Color(0.155, 0.175, 0.075),
        colMid: new THREE.Color(0.295, 0.315, 0.135),
        colHigh: new THREE.Color(0.44, 0.42, 0.215),
        colRock: new THREE.Color(0.30, 0.26, 0.19),
        colScar: new THREE.Color(0.185, 0.135, 0.09),
        slopeRock: 0.40, detail: 0.55, detailScale: 0.03,
        ripple: 0.22, rippleScale: 1.1, macro: 0.6,
        roughness: 0.95, dustLift: 0.26,
      },
    };
  }

  grassConfig() {
    return {
      lighting: this.lighting, terrain: this.terrain, segments: 3,
      layers: [
        { tile: 74, count: 14000, size: 0.72, width: 0.055, far: 130, patchy: 0.34, curve: 0.22 },
        { tile: 230, count: 13000, size: 1.05, width: 0.085, far: 420, patchy: 0.40, curve: 0.26 },
        { tile: 900, count: 11000, size: 2.4, width: 0.24, far: 1600, patchy: 0.46, curve: 0.3 },
      ],
      look: {
        colBase: new THREE.Color(0.085, 0.115, 0.045),
        colTip: new THREE.Color(0.40, 0.44, 0.155),
        colDry: new THREE.Color(0.56, 0.47, 0.20),
        dry: 0.42, gust: 1.15,
      },
    };
  }

  async layout(rng) {
    /* ---------------- 农庄 A：主景（正对相机起始方向） ---------------- */
    this._farmstead(rng, -170, 150, 0.35, 1.0);
    /* ---------------- 农庄 B：远处第二个聚落 ---------------- */
    this._farmstead(rng, 470, -330, -1.1, 0.92);

    /* ---------------- 教堂小聚落 ---------------- */
    const cx = -560, cz = -470;
    this.placeBuilding(BK.buildChurch(rng), cx, cz, 0.5);
    this.placeBuilding(BK.buildShed(rng), cx + 26, cz + 14, 1.1);
    for (let i = 0; i < 14; i++) {
      this.placeProp(PP.buildGravestone(rng), cx + rng.range(-26, -10), cz + rng.range(-24, 24), rng.range(0, 0.4), rng.range(0.85, 1.15));
    }
    this.placeProp(PP.buildTree(rng, { scale: 1.3 }), cx - 34, cz + 30, 0, 1.3);

    /* ---------------- 谷物提升塔（地标，验证远景 LOD） ---------------- */
    this.placeBuilding(BK.buildGrainElevator(rng), -60, -820, 0.2, 1.05);
    this.placeBuilding(BK.buildSilo(rng), -18, -840, 0, 1.0);

    /* ---------------- 加油站 + 拖车房 ---------------- */
    this.placeBuilding(BK.buildGasStation(rng), 190, 540, -0.9);
    this.placeBuilding(BK.buildTrailer(rng), 250, 500, 0.4);
    this.placeBuilding(BK.buildTrailer(rng), 268, 524, 0.6);
    this.placeProp(PP.buildPickup(rng), 206, 520, 0.7);

    /* ---------------- 高压线穿场 ---------------- */
    this.powerLine(-900, 640, 900, 470, 11, (r) => BK.buildPowerPole(r));

    /* ---------------- 栅栏围出田块 ---------------- */
    for (const [fx, fz, fa, len] of [
      [-330, 40, 0, 10], [-330, 40, Math.PI / 2, 8],
      [330, -120, 0.15, 12], [120, 300, Math.PI / 2, 9],
    ]) {
      for (let i = 0; i < len; i++) {
        const x = fx + Math.cos(fa) * i * 12, z = fz + Math.sin(fa) * i * 12;
        this.placeBuilding(BK.buildFenceRun(rng, { length: 12 }), x, z, fa);
      }
    }

    /* ---------------- 玉米地 ---------------- */
    for (let f = 0; f < 3; f++) {
      const bx = [-120, 380, -420][f], bz = [-260, 180, 350][f];
      const rot = [0.2, -0.8, 1.2][f];
      for (let r2 = 0; r2 < 16; r2++) {
        const ox = Math.cos(rot + Math.PI / 2) * r2 * 5.5;
        const oz = Math.sin(rot + Math.PI / 2) * r2 * 5.5;
        this.placeProp(PP.buildCropRow(rng, { length: 46 }), bx + ox, bz + oz, rot, 1, 900);
      }
    }

    /* ---------------- 防风林 ---------------- */
    for (let i = 0; i < 26; i++) {
      const t = i / 25;
      this.placeProp(PP.buildTree(rng), -700 + t * 260, 250 - t * 620 + rng.range(-8, 8),
        rng.range(0, 6.28), rng.range(0.85, 1.35), 2600);
    }
    for (let i = 0; i < 18; i++) {
      this.placeProp(PP.buildTree(rng), 620 + rng.range(-40, 40), 120 + i * 26 + rng.range(-10, 10),
        rng.range(0, 6.28), rng.range(0.8, 1.25), 2600);
    }

    /* ---------------- 上一场龙卷风留下的废墟与旧路径 ---------------- */
    this.placeBuilding(BK.buildFarmhouse(rng, { broken: true }), -830, -160, 1.15);
    this.placeBuilding(BK.buildBarn(rng, { broken: true }), -772, -218, 0.62);
    this.placeBuilding(BK.buildShed(rng, { broken: true }), -868, -206, 2.1);
    this.placeProp(PP.buildTractor(rng), -805, -196, 2.6);
    this.oldTrack(-1320, -330, 260, -60, 74, 30);

    /* ---------------- 散布道具 ---------------- */
    this.scatter((r) => PP.buildHayBale(r), { count: 34, rMin: 90, rMax: 900, scale: [0.9, 1.2] });
    this.scatter((r) => PP.buildBush(r), { count: 90, rMin: 40, rMax: 1500, scale: [0.7, 1.5], maxDist: 700 });
    this.scatter((r) => PP.buildDeadTree(r), { count: 12, rMin: 200, rMax: 1600, scale: [0.9, 1.4] });
    this.scatter((r) => PP.buildTire(r), { count: 10, rMin: 60, rMax: 500, maxDist: 300 });
    this.scatter((r) => PP.buildOilDrum(r), { count: 14, rMin: 60, rMax: 700, maxDist: 420 });
    this.scatter((r) => PP.buildMailbox(r), { count: 8, rMin: 120, rMax: 700, maxDist: 400 });
    this.scatter((r) => PP.buildCornStack(r), { count: 16, rMin: 100, rMax: 800, maxDist: 600 });
    this.scatter((r) => PP.buildWagon(r), { count: 6, rMin: 100, rMax: 600 });
    this.scatter((r) => PP.buildPicnicTable(r), { count: 5, rMin: 80, rMax: 400, maxDist: 320 });
    this.scatter((r) => PP.buildSignpost(r), { count: 7, rMin: 150, rMax: 900, maxDist: 500 });
  }

  /** 一个完整农庄：住宅 + 谷仓 + 筒仓 + 水塔 + 风车 + 农机 */
  _farmstead(rng, cx, cz, rot, scale) {
    const R = (ax, az) => [
      cx + Math.cos(rot) * ax - Math.sin(rot) * az,
      cz + Math.sin(rot) * ax + Math.cos(rot) * az,
    ];
    let p = R(0, 0);
    this.placeBuilding(BK.buildFarmhouse(rng), p[0], p[1], rot, scale);
    p = R(48, -30);
    this.placeBuilding(BK.buildBarn(rng), p[0], p[1], rot + 0.12, scale);
    p = R(76, -4);
    this.placeBuilding(BK.buildSilo(rng), p[0], p[1], 0, scale);
    p = R(88, 6);
    this.placeBuilding(BK.buildSilo(rng, { palette: 1 }), p[0], p[1], 0, scale * 0.9);
    p = R(20, 34);
    this.placeBuilding(BK.buildWaterTower(rng), p[0], p[1], rot, scale);
    p = R(-26, 26);
    this.placeBuilding(BK.buildWindmill(rng), p[0], p[1], rot, scale);
    p = R(-22, -20);
    this.placeBuilding(BK.buildShed(rng), p[0], p[1], rot + 0.3, scale);

    p = R(30, 12);
    this.placeProp(PP.buildTractor(rng), p[0], p[1], rot + 0.6);
    p = R(12, 20);
    this.placeProp(PP.buildPickup(rng), p[0], p[1], rot - 0.4);
    p = R(-8, 30);
    this.placeProp(PP.buildWaterTrough(rng), p[0], p[1], rot);
    p = R(-14, -34);
    this.placeProp(PP.buildWindPump(rng), p[0], p[1], rot);
    p = R(54, 22);
    this.placeProp(PP.buildHayBale(rng), p[0], p[1], rot, 1.1);
    p = R(58, 26);
    this.placeProp(PP.buildHayBale(rng), p[0], p[1], rot + 0.4, 1.05);
    p = R(-4, 44);
    this.placeProp(PP.buildBirdhouse(rng), p[0], p[1], rot);
    /* 院子四周的树 */
    for (let i = 0; i < 5; i++) {
      const a = rot + i * 1.25;
      p = R(Math.cos(a) * 58, Math.sin(a) * 58);
      this.placeProp(PP.buildTree(rng), p[0], p[1], rng.range(0, 6.28), rng.range(0.9, 1.3), 2600);
    }
  }
}
