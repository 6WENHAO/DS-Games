/**
 * 小镇装配：把建筑 / 设施 / 自然要素按街区摆到台地上，
 * 静态件合批以控制 draw call，动态件（转轮、钟表指针、灯塔）单独保留。
 */
import * as THREE from 'three';
import {
  Batch, mat, glowMat, mesh, group, box, roundedBox, cyl, cone, sphere, lathe,
  RNG, TAU, clamp, lerp, mergeGeometries,
} from '../lib/utils.js';
import { foliageMat, addSway } from '../lib/wind.js';
import {
  PAL, LANTERN, GLASS, makeHouse, makeChurch, makeClockTower, makeTownHall, makeStation,
  makeWindmill, makeWatermill, makeLighthouse, makeBarn, makeGreenhouse, makeWaterTower,
  makeGazebo, makeTunnelPortal, makeViaductPier,
} from './buildings.js';
import {
  makeStreetLamp, makeBench, makeCafeSet, makePlanter, makeFountain, makeStall, makeCrate,
  makeBarrel, makeSacks, makeFence, makeClothesline, makeBunting, makeFlagPole, makePier,
  makeBuoy, makeCrane, makeStoneBridge, makeWoodBridge, buildRailway, makeFerrisWheel,
  makeCarousel, makeWell, makeStatue, makeTelescope, makeSwing, makeSignpost, makeHaystack,
  makeScarecrow, makeTractor,
} from './props.js';
import {
  makeBroadleaf, makeConifer, makeBirch, makeWillow, makeFruitTree, makeGreatOak,
  makeBush, makeFlowerPatch, makeGrassTuft, makeRock, makeWheatField, makeVeggiePatch,
  makeSheep, makeCat, makeScatterHelper,
} from './nature.js';
import {
  baseHeight, groundHeight, onBase, onGround, slopeAt, BRIDGES, TUNNEL, RAIL_PTS,
  makeRailCurve, riverDist,
} from './layout.js';

const SPIN_AXIS = { rotor: 'z', wheel: 'z', ferrisRotor: 'z', carRotor: 'y', vane: 'y' };

export function buildTown(scene, ctx) {
  const rng = new RNG(31415);
  const root = group('town');
  const live = group('townLive');
  scene.add(root);
  scene.add(live);

  const batch = new Batch('town');
  const occupied = [];
  const chimneys = [];
  const lampSpots = [];
  const jets = [];
  const spinners = [];
  const clocks = [];
  const beacons = [];
  const misc = [];
  const placements = [];
  const _box = new THREE.Box3();

  /** 把工厂产物摆到地面上并合批 */
  function put(res, x, z, ry = 0, o = {}) {
    const grp = res.group ?? res;
    const gh = groundHeight(x, z);
    const base = o.useGround ? gh : Math.min(onBase(x, z), gh + 0.35);
    const y = (o.y !== undefined ? o.y : base) - (o.sink ?? 0.14);
    const keeps = batch.addObject(grp, { x, y, z, ry });
    if (!o.nocheck) {
      _box.setFromObject(grp);
      if (Number.isFinite(_box.min.x)) {
        placements.push({
          name: grp.name || 'obj', x, z, y,
          minX: _box.min.x, maxX: _box.max.x, minZ: _box.min.z, maxZ: _box.max.z,
          minY: _box.min.y, maxY: _box.max.y,
        });
      }
    }
    for (const k of keeps) {
      k.updateMatrixWorld(true);
      const m = k.matrixWorld.clone();
      live.add(k);
      m.decompose(k.position, k.quaternion, k.scale);
      k.userData.axis = SPIN_AXIS[k.name] ?? 'z';
      if (k.userData.spin !== undefined) spinners.push(k);
      if (k.userData.clock) clocks.push(k);
      if (k.userData.beacon) beacons.push(k);
      if (k.userData.scan || k.userData.swing) misc.push(k);
    }
    const c = Math.cos(ry), s = Math.sin(ry);
    if (res.chimneys) {
      for (const ch of res.chimneys) {
        chimneys.push({ x: x + ch.x * c + ch.z * s, y: y + ch.y, z: z - ch.x * s + ch.z * c });
      }
    }
    if (grp.userData && grp.userData.jets) {
      for (const j of grp.userData.jets) {
        jets.push({ x: x + j.x * c + j.z * s, y: y + j.y, z: z - j.x * s + j.z * c, dir: j.dir });
      }
    }
    if (o.occupy) occupied.push({ x, z, r: o.occupy });
    if (o.lamp) lampSpots.push({ x: x + (o.lamp.x ?? 0), y: y + o.lamp.y, z: z + (o.lamp.z ?? 0), scale: o.lamp.scale ?? 1 });
    return y;
  }

  /** 房屋快捷方式 */
  function house(x, z, ry, opts = {}) {
    const res = makeHouse({ rng, ...opts });
    put(res, x, z, ry, { occupy: opts.occupy ?? Math.max(res.group.userData.height ? 2.4 : 2.4, ((opts.w ?? 4) + (opts.d ?? 3.6)) * 0.36), sink: opts.sink ?? 0.16 });
    return res;
  }

  /* ============================================================ 港口区 */
  {
    const y = 1.95;
    house(-6.8, 20.8, 0, {
      w: 7.6, d: 2.8, floors: 2, floorH: 2.4, roofKind: 'gambrel', roofH: 2.5,
      wall: '#dcc9a4', roof: '#5f6b74', chimneys: 1, dormers: 0, shutters: false, name: 'warehouse',
    });
    house(0.6, 20.8, 0, { w: 4.6, d: 2.8, floors: 1, floorH: 2.9, shop: true, roofKind: 'hip', roof: '#8c4636', wall: '#f2ddc4' });
    house(5.6, 20.8, 0, { w: 4.2, d: 2.8, floors: 2, floorH: 2.4, roofKind: 'hip', balcony: true, wall: '#dfe4d7', roof: '#57707a' });
    house(9.8, 20.6, 0, { w: 4.6, d: 2.8, floors: 2, floorH: 2.5, shop: true, timber: true, jetty: 0.3, wall: '#f4e7d3', roof: '#a8483a' });

    // 栈桥与船
    for (const [px, len] of [[-3.5, 4.6], [5.5, 5.4], [11.6, 3.6]]) {
      put(makePier(len, 2.6, 1, px, 28.4), px, 28.4, 0, { y: 0, sink: 0, nocheck: true });
    }
    put(makeCrane(), -8.4, 26.6, 0.6, { occupy: 2 });
    // 货箱、木桶、麻袋
    const hOcc = [[-8.4, 26.6, 2.6], [-9.0, 27.6, 1.0], [-2.5, 27.6, 1.0], [4.0, 27.6, 1.0], [10.5, 27.6, 1.0], [-6.0, 27.0, 1.2], [1.5, 27.0, 1.2], [8.0, 27.0, 1.2], [13.6, 26.4, 1.2]];
    for (let i = 0; i < 16; i++) {
      const x = rng.range(-12, 13), z = rng.range(26.7, 27.9);
      if (hOcc.some(([ox, oz, orr]) => Math.hypot(x - ox, z - oz) < orr)) continue;
      hOcc.push([x, z, 0.95]);
      const pick = rng.next();
      if (pick < 0.45) put(makeCrate(rng, rng.range(0.8, 1.15)), x, z, rng.range(0, TAU), { sink: 0.05 });
      else if (pick < 0.8) put(makeBarrel(rng), x, z, rng.range(0, TAU), { sink: 0.05 });
      else put(makeSacks(rng), x, z, rng.range(0, TAU), { sink: 0.05 });
    }
    // 路灯（海港式）
    for (const x of [-10.8, -2.5, 4, 10.5]) {
      put(makeStreetLamp('harbor'), x, 27.5, x > 3 ? -0.2 : 0.2, { lamp: { y: 3.0, x: 0.6, scale: 1.1 } });
    }
    // 长椅面向大海
    for (const x of [-6, 1.5, 8]) put(makeBench(), x, 27.0, Math.PI);
    // 浮标
    put(makeBuoy(rng), -1.5, 33.4, 0, { y: 0, sink: 0, nocheck: true });
    put(makeBuoy(rng), 11.8, 32.6, 0, { y: 0, sink: 0, nocheck: true });
    put(makeBuoy(rng), 17.5, 30.4, 0, { y: 0, sink: 0, nocheck: true });
    // 旗杆
    put(makeFlagPole(5.4, '#3f6f9f'), 13.6, 26.4, 0, { occupy: 1 });
  }

  /* ============================================================ 灯塔与海角 */
  {
    // 岩基（补足海角边缘的空隙）
    const lhBase = group('lhPodium');
    lhBase.add(mesh(new THREE.CylinderGeometry(3.4, 4.8, 4.4, 16), mat('#8a8272', { rough: 0.97, flat: true }), { y: -2.8 }));
    lhBase.add(mesh(new THREE.CylinderGeometry(3.0, 3.4, 0.4, 16), mat('#a49a86', { rough: 0.95 }), { y: 0.05 }));
    put(lhBase, -27.0, 22.0, 0, { sink: 0.35, nocheck: true });
    put(makeLighthouse(), -27.0, 22.0, 0.4, { occupy: 4, nocheck: true, y: onBase(-27, 22) + 0.06 });
    for (let i = 0; i < 16; i++) {
      const a = rng.range(0, TAU), r = rng.range(3.2, 7.5);
      const x = -27 + Math.cos(a) * r, z = 22 + Math.sin(a) * r * 0.9;
      if (groundHeight(x, z) < -1.6) continue;
      put(makeRock(rng, rng.range(0.8, 1.9)), x, z, rng.range(0, TAU), { sink: 0.3, useGround: true, nocheck: true });
    }
    put(makeFence([[-24.6, 19.4], [-23.4, 21.6], [-24.0, 24.2]], { h: 0.9 }), 0, 0, 0, { y: 0, sink: 0, nocheck: true });
  }

  /* ============================================================ 下城主街 */
  {
    const northRow = [
      { x: -2.4, w: 3.5, floors: 2, shop: true, timber: false },
      { x: 1.0, w: 3.4, floors: 3, shop: true, jetty: 0.34, timber: true },
      { x: 4.4, w: 3.5, floors: 2, shop: true },
      { x: 7.8, w: 3.4, floors: 3, shop: true, timber: true, jetty: 0.28 },
      { x: 11.2, w: 3.4, floors: 2, shop: true, bakery: true },
    ];
    for (const b of northRow) {
      house(b.x, 11.4, 0, {
        w: b.w, d: 2.8, floors: b.floors, floorH: 2.45, shop: b.shop, timber: b.timber,
        jetty: b.jetty ?? 0, roofKind: rng.pick(['gable', 'gable', 'hip']), ridgeAlongZ: false,
        chimneys: b.bakery ? 2 : 1, dormers: b.floors > 2 ? 1 : 0,
      });
    }
    const southRow = [
      { x: -5.4, w: 3.5, floors: 2, shop: false },
      { x: -1.6, w: 3.6, floors: 3, shop: false, timber: true, jetty: 0.3 },
      { x: 2.2, w: 3.5, floors: 2, shop: false, balcony: true },
      { x: 6.0, w: 3.6, floors: 2, shop: false, balcony: true },
      { x: 9.8, w: 3.5, floors: 3, shop: false, timber: true },
      { x: 13.1, w: 3.4, floors: 2, shop: false },
    ];
    for (const b of southRow) {
      house(b.x, 17.9, Math.PI, {
        w: b.w, d: 2.8, floors: b.floors, floorH: 2.45, shop: b.shop, timber: b.timber,
        jetty: b.jetty ?? 0, balcony: b.balcony, roofKind: rng.pick(['gable', 'hip', 'gable']),
        chimneys: 1, dormers: b.floors > 2 ? 1 : 0,
      });
    }
    // 街道设施
    for (const [x, z] of [[1.0, 15.2], [10.4, 15.2]]) {
      put(makeStreetLamp('town'), x, z, 0, { lamp: { y: 4.1 } });
    }
    for (const [x, z, r] of [[3.4, 15.3, 0.2], [12.6, 15.3, 0.4]]) put(makeBench(), x, z, r + Math.PI);
    for (const [x, z] of [[5.6, 15.2], [11.8, 15.2]]) put(makePlanter(rng), x, z, rng.range(0, TAU));
    put(makeCafeSet(rng), 8.0, 15.2, 0.3, { occupy: 1.2 });
    put(makeWell(), 14.0, 12.8, 0.2, { occupy: 1.4 });
    put(makeSignpost(rng), -4.2, 15.2, 0.4);
    put(makeStall(rng), -1.8, 15.2, Math.PI + 0.1, { occupy: 1.6 });
    // 横跨街道的彩旗
    const yb = 3.5;
    root.add(makeBunting([[1.0, yb + 5.9, 13.4], [2.2, yb + 5.6, 16.0]], rng));
    root.add(makeBunting([[7.8, yb + 5.7, 13.4], [9.8, yb + 5.4, 16.0]], rng));
    root.add(makeBunting([[-2.4, yb + 5.4, 13.4], [-1.6, yb + 5.2, 16.0]], rng));
    // 晾衣绳
    root.add(makeClothesline(4.4, yb + 4.8, 13.4, 6.0, yb + 4.6, 16.0, rng));
    root.add(makeClothesline(11.2, yb + 4.9, 13.4, 13.1, yb + 4.7, 16.0, rng));
  }

  /* ============================================================ 水磨与磨坊潭 */
  {
    const y = onBase(-7.6, 13.4);
    put(makeWatermill(), -7.6, 13.4, -0.12, { occupy: 3.4, sink: 0.5 });
    // 石砌基座补地
    const stone = mat('#9c9280', { rough: 0.95 });
    batch.add(box(3.6, 2.6, 3.2), stone, { x: -9.9, y: y - 2.6, z: 13.4, ry: -0.12 });
    batch.add(box(2.2, 1.8, 2.0), stone, { x: -10.6, y: y - 1.9, z: 15.2, ry: 0.2 });
    for (let i = 0; i < 7; i++) {
      const a = rng.range(0, TAU);
      put(makeRock(rng, rng.range(0.5, 1.0)), -10.6 + Math.cos(a) * rng.range(1.6, 3.4), 14.6 + Math.sin(a) * rng.range(1.6, 3.2), a, { sink: 0.25, useGround: true, nocheck: true });
    }
    put(makeWillow(rng, 1.1), -12.6, 17.6, 0.3, { occupy: 2, useGround: true, nocheck: true });
    put(makeWillow(rng, 0.95), -8.2, 18.6, 1.2, { occupy: 2, useGround: true, nocheck: true });
    put(makeFence([[-12.9, 12.6], [-12.4, 15.6], [-12.9, 18.2]], { h: 0.9 }), 0, 0, 0, { y: 0, sink: 0, nocheck: true });
  }

  /* ============================================================ 中央广场 */
  {
    put(makeTownHall(), -3.5, -3.4, 0, { occupy: 6.5 });
    put(makeFountain(), 6.6, -0.6, 0, { occupy: 3.4 });
    // 市集摊位
    for (const [x, z, r] of [[4.2, -5.4, 0.05]]) {
      put(makeStall(rng), x, z, r, { occupy: 1.8 });
    }
    // 咖啡座 / 长椅 / 花池 / 路灯
    put(makeCafeSet(rng), 3.0, 2.6, 0.2, { occupy: 1.2 });
    put(makeCafeSet(rng), 10.2, 2.4, -0.3, { occupy: 1.2 });
    put(makeCafeSet(rng), -9.6, 1.6, 0.5, { occupy: 1.2 });
    for (const [x, z, r] of [[5.8, 2.9, 0], [12.4, 2.2, -0.5], [-10.4, -2.4, 0.3], [-6.2, 2.9, 0]]) put(makeBench(), x, z, r);
    for (const [x, z] of [[2.8, -1.4], [7.4, 3.0], [-10.4, -6.2]]) put(makePlanter(rng), x, z, rng.range(0, TAU));
    for (const [x, z] of [[0.6, 3.0], [6.8, -6.2], [-10.4, 3.2], [-7.0, 3.2]]) {
      put(makeStreetLamp('town'), x, z, 0, { lamp: { y: 4.1 } });
    }
    put(makeStatue(), -10.6, -4.2, 0.4, { occupy: 1.6 });
    // 广场树
    put(makeBroadleaf(rng, 1.05), 1.6, 4.2, 0, { occupy: 2, nocheck: true });
    put(makeBroadleaf(rng, 0.95), -7.4, 4.4, 0, { occupy: 2, nocheck: true });
    put(makeBroadleaf(rng, 1.0), 10.6, 3.4, 0, { occupy: 2, nocheck: true });
    // 石桥（运河）
    const b0 = BRIDGES[0];
    put(makeStoneBridge(b0.len, b0.w), b0.x, b0.z, b0.ry, { y: onBase(b0.x, b0.z) + 0.02, sink: 0, nocheck: true });
    const b1 = BRIDGES[1];
    put(makeWoodBridge(b1.len, b1.w), b1.x, b1.z, b1.ry, { y: onBase(b1.x, b1.z) + 0.02, sink: 0, nocheck: true });
  }

  /* ============================================================ 集市巷 + 钟楼 */
  {
    put(makeClockTower(), 8.6, -4.4, 0.12, { occupy: 3.4 });
    house(12.8, -0.4, Math.PI / 2, { w: 3.0, d: 3.2, floors: 3, floorH: 2.4, shop: false, timber: true, jetty: 0.3, sink: 0.3 });
    house(12.8, -3.6, Math.PI / 2, { w: 3.0, d: 3.0, floors: 2, floorH: 2.45, shop: false, timber: true, sink: 0.3 });
    house(17.6, -0.4, -Math.PI / 2, { w: 3.0, d: 3.0, floors: 3, floorH: 2.4, shop: false, timber: true, jetty: 0.26, sink: 0.3 });
    house(17.6, -3.6, -Math.PI / 2, { w: 3.0, d: 3.0, floors: 2, floorH: 2.5, shop: false, sink: 0.3 });
    for (const [x, z] of [[15.2, 2.0], [15.3, -1.8]]) put(makeStreetLamp('town'), x, z, 0, { lamp: { y: 4.1 } });
    put(makeStall(rng), 15.2, 1.2, Math.PI / 2 + 0.2, { occupy: 1.6 });
    put(makePlanter(rng), 15.4, 0.6, 0.5);
    put(makeBench(), 15.8, -2.6, -Math.PI / 2);
    root.add(makeClothesline(13.6, 5.3 + 5.0, -0.4, 16.8, 5.3 + 4.8, -0.4, rng));
    root.add(makeBunting([[13.6, 5.3 + 5.4, -3.6], [16.8, 5.3 + 5.2, -3.6]], rng));
  }

  /* ============================================================ 车站 */
  {
    put(makeStation(), 22.6, 6.5, -Math.PI / 2, { occupy: 5 });
    for (const [x, z] of [[21.4, 2.6], [21.4, 11.0]]) put(makeStreetLamp('town'), x, z, 0, { lamp: { y: 4.1 } });
    put(makeBench(), 26.0, 3.4, Math.PI / 2);
    put(makeBench(), 26.0, 9.6, Math.PI / 2);
    for (let i = 0; i < 4; i++) put(makeCrate(rng, 0.9), 25.4 + rng.jitter(0.6), 11.6 + rng.jitter(0.8), rng.range(0, TAU), { sink: 0.05 });
    put(makeFlagPole(4.6, '#c9553f'), 21.6, 6.6, 0, { occupy: 1 });
  }

  /* ============================================================ 游乐场 */
  {
    put(makeFerrisWheel(), 23.5, 17.5, -0.45, { occupy: 5, nocheck: true });
    put(makeCarousel(), 21.8, 23.4, 0.2, { occupy: 4.2 });
    // 帐篷
    for (const [x, z, c] of [[26.6, 19.6, '#c9553f'], [26.0, 23.4, '#4f8b5a'], [18.8, 24.6, '#3f6f8f']]) {
      const t = group('tent');
      t.add(mesh(cone(2.1, 2.6, 8), mat(c, { rough: 0.9 }), { y: 0.4 }));
      t.add(mesh(cyl(1.9, 2.0, 0.45, 8), mat('#f6ecd8', { rough: 0.9 }), {}));
      t.add(mesh(cyl(0.06, 0.06, 0.7, 6), mat(PAL.woodDark, { rough: 0.9 }), { y: 3.0 }));
      const fg = new THREE.PlaneGeometry(0.6, 0.3, 4, 2);
      fg.translate(0.3, 0, 0);
      t.add(mesh(fg, mat('#f0e6d2', { rough: 0.9, side: THREE.DoubleSide }), { y: 3.6, cast: false }));
      put(t, x, z, rng.range(0, TAU), { occupy: 2.2 });
    }
    for (const [x, z] of [[19.6, 17.0], [20.2, 25.4], [27.2, 16.6]]) {
      put(makeStreetLamp('town'), x, z, 0, { lamp: { y: 4.1 } });
    }
    for (const [x, z] of [[19.8, 19.8], [26.0, 14.4]]) put(makeBench(), x, z, rng.range(0, TAU));
    for (const [x, z] of [[21.0, 13.6], [25.0, 12.8]]) put(makePlanter(rng), x, z, rng.range(0, TAU));
    root.add(makeBunting([[19.6, 2.7 + 3.4, 22.6], [22.5, 2.7 + 4.4, 24.0], [26.4, 2.7 + 3.2, 24.4]], rng));
  }

  /* ============================================================ 上城（教堂与住宅） */
  {
    put(makeChurch(rng), -4.0, -16.0, 0, { occupy: 7 });
    const cottages = [
      { x: 1.8, z: -11.0, ry: 0.15, w: 4.0, d: 3.4, floors: 2 },
      { x: 1.9, z: -15.6, ry: -0.1, w: 4.2, d: 3.6, floors: 2, balcony: true },
      { x: 1.7, z: -20.2, ry: 0.08, w: 4.4, d: 3.6, floors: 1 },
      { x: -9.8, z: -16.2, ry: 0.2, w: 4.0, d: 3.4, floors: 2 },
      { x: -8.8, z: -19.8, ry: -0.15, w: 4.2, d: 3.4, floors: 2, balcony: true },
    ];
    for (const c of cottages) {
      house(c.x, c.z, c.ry, {
        w: c.w, d: c.d, floors: c.floors, floorH: 2.4, roofKind: rng.pick(['gable', 'hip', 'gable']),
        timber: rng.chance(0.45), balcony: c.balcony, chimneys: rng.int(1, 2),
        dormers: c.floors > 1 && rng.chance(0.5) ? 1 : 0, shutters: true,
      });
    }
    put(makeWaterTower(), -7.0, -21.4, 0.3, { occupy: 2.6 });
    put(makeVeggiePatch(3.6, 2.6, rng), 0.4, -22.2, 0.1, { occupy: 2.2, sink: 0, useGround: true });
    // 庭院围栏、花丛、晾衣绳
    put(makeFence([[-4.6, -21.6], [0.0, -22.2], [4.0, -22.4]], { h: 0.95 }), 0, 0, 0, { y: 0, sink: 0, nocheck: true });
    put(makeFence([[-6.4, -10.2], [-6.6, -13.4]], { h: 0.9 }), 0, 0, 0, { y: 0, sink: 0, nocheck: true });
    root.add(makeClothesline(-9.6, 10.6 + 2.6, -18.4, -6.4, 10.6 + 2.4, -19.0, rng));
    root.add(makeClothesline(1.9, 10.6 + 2.8, -17.8, 4.4, 10.6 + 2.5, -17.2, rng));
    for (const [x, z] of [[-6.4, -9.6], [-1.0, -9.8], [4.2, -13.4], [-8.0, -12.6], [-6.0, -21.8]]) {
      put(makeStreetLamp('town'), x, z, 0, { lamp: { y: 4.1 } });
    }
    for (const [x, z] of [[-8.4, -9.6], [-2.0, -9.4], [4.4, -18.0], [-12.4, -19.2], [-1.4, -21.0]]) {
      put(makeFlowerPatch(rng), x, z, rng.range(0, TAU), { sink: 0, useGround: true, nocheck: true });
    }
    for (const [x, z] of [[-11.0, -10.0], [-6.6, -20.0], [4.6, -21.0]]) put(makeBush(rng), x, z, rng.range(0, TAU), { useGround: true, nocheck: true });
    put(makeBench(), -6.0, -9.2, Math.PI);
    put(makeBench(), -1.4, -9.2, Math.PI);
    put(makeCat(rng), -7.6, -12.4, 0.6, { sink: 0, useGround: true, nocheck: true });
    // 教堂前广场树
    put(makeConifer(rng, 0.95), -12.0, -12.6, 0, { occupy: 1.8, nocheck: true });
    put(makeConifer(rng, 0.85), 2.6, -22.0, 0, { occupy: 1.8, useGround: true, nocheck: true });
    put(makeBroadleaf(rng, 1.0), -3.0, -9.2, 0, { occupy: 2.2, useGround: true, nocheck: true });
  }

  /* ============================================================ 山顶（风车与眺望台） */
  {
    // 风车石台
    const podium = group('podium');
    podium.add(mesh(new THREE.CylinderGeometry(4.0, 4.4, 1.6, 20), mat('#9c9280', { rough: 0.95 }), { y: -1.0 }));
    podium.add(mesh(new THREE.CylinderGeometry(3.8, 3.8, 0.24, 20), mat('#b7ac95', { rough: 0.9 }), { y: 0.5 }));
    put(podium, -22.0, -24.4, 0, { sink: 0.5, nocheck: true });
    put(makeWindmill(), -22.0, -24.4, 0.6, { occupy: 4.6, y: onBase(-22, -24.4) + 0.62, nocheck: true });
    put(makeTelescope(), -17.6, -20.2, -0.6, { occupy: 1, useGround: true, nocheck: true });
    put(makeGreatOak(rng), -13.2, -16.6, 0.2, { occupy: 3.4, useGround: true, nocheck: true });
    put(makeSwing(), -12.4, -18.6, 0.5, { occupy: 1.6 });
    for (const [x, z, r] of [[-16.8, -24.0, 0.2], [-12.2, -15.4, -0.6]]) put(makeBench(), x, z, r, { useGround: true, nocheck: true });
    put(makeStreetLamp('town'), -17.0, -26.0, 0, { lamp: { y: 4.1 }, useGround: true, nocheck: true });
    for (let i = 0; i < 12; i++) {
      const a = rng.range(0, TAU), r = rng.range(4.6, 9);
      put(makeRock(rng, rng.range(0.6, 1.4)), -21 + Math.cos(a) * r, -24 + Math.sin(a) * r * 0.8, a, { sink: 0.25, useGround: true, nocheck: true });
    }
    for (let i = 0; i < 10; i++) {
      put(makeFlowerPatch(rng), -20 + rng.jitter(7), -21 + rng.jitter(6), rng.range(0, TAU), { sink: 0, useGround: true, nocheck: true });
    }
    // 泉眼
    for (let i = 0; i < 8; i++) {
      const a = rng.range(0, TAU);
      put(makeRock(rng, rng.range(0.5, 1.1)), -17.6 + Math.cos(a) * rng.range(1.2, 2.6), -20.6 + Math.sin(a) * rng.range(1.2, 2.6), a, { sink: 0.3, useGround: true, nocheck: true });
    }
  }

  /* ============================================================ 农场 */
  {
    put(makeBarn(), 12.4, -13.2, 0.2, { occupy: 6 });
    put(makeWheatField(7.5, 5.5, rng), 14.6, -18.6, 0.1, { occupy: 4.6, sink: 0 });
    put(makeWheatField(5.5, 4.5, rng), 20.4, -12.0, -0.15, { occupy: 3.6, sink: 0 });
    put(makeVeggiePatch(5.0, 3.4, rng), 8.6, -14.0, 0.1, { occupy: 3, sink: 0 });
    put(makeVeggiePatch(4.0, 2.6, rng), 16.4, -9.6, 0, { occupy: 2.4, sink: 0 });
    put(makeScarecrow(), 12.6, -15.6, 0.5, { occupy: 1 });
    put(makeTractor(), 15.6, -10.6, 2.2, { occupy: 2 });
    for (const [x, z] of [[17.4, -11.2], [18.6, -14.6], [23.0, -9.0]]) put(makeHaystack(rng), x, z, rng.range(0, TAU), { occupy: 1.6, useGround: true });
    // 果园
    for (let i = 0; i < 10; i++) {
      const col = i % 5, row = Math.floor(i / 5);
      put(makeFruitTree(rng, rng.range(0.9, 1.15)), 20.2 + row * 3.2, -8.6 - col * 2.4, rng.range(0, TAU), { occupy: 1.4, useGround: true, nocheck: true });
    }
    // 羊圈
    const paddock = [[7.4, -16.4], [11.4, -16.8], [11.6, -21.6], [7.6, -21.2], [7.4, -16.4]];
    put(makeFence(paddock, { h: 1.0, rails: [0.4, 0.78] }), 0, 0, 0, { y: 0, sink: 0, nocheck: true });
    const sheep = [];
    for (let i = 0; i < 6; i++) {
      const x = rng.range(7.9, 11.1), z = rng.range(-21.1, -16.9);
      const s = makeSheep(rng);
      s.position.set(x, groundHeight(x, z), z);
      s.rotation.y = rng.range(0, TAU);
      s.userData.wander = { x, z, phase: rng.range(0, TAU), speed: rng.range(0.2, 0.5) };
      live.add(s);
      sheep.push(s);
    }
    // 田埂围栏
    put(makeFence([[14.6, -16.6], [24.6, -16.2]], { h: 0.85 }), 0, 0, 0, { y: 0, sink: 0, nocheck: true });
    put(makeFence([[6.6, -12.6], [6.8, -8.6]], { h: 0.85 }), 0, 0, 0, { y: 0, sink: 0, nocheck: true });
    put(makeSignpost(rng), 8.0, -10.6, 0.8);
    misc.push(...sheep.map((s) => (s.userData.sheep = true, s)));
  }

  /* ============================================================ 铁路 */
  {
    const railCurve = ctx.railCurve;
    const rw = buildRailway(railCurve);
    root.add(rw.group);
    for (const p of rw.piers) {
      put(makeViaductPier(p.h, p.h > 4 ? 2.8 : 2.2, 3.6), p.x, p.z, p.ry, { y: p.y - 0.2, sink: 0, nocheck: true });
    }
    put(makeTunnelPortal(), TUNNEL.x, TUNNEL.z, TUNNEL.ry, { y: TUNNEL.y - 1.9, sink: 0, occupy: 6, nocheck: true });
  }

  /* ============================================================ 自然散布 */
  {
    const helper = makeScatterHelper(occupied);
    // 林地（山肩、北岭、西坡）
    const forests = [
      { x: -20, z: -28, r: 8, n: 16, kinds: ['conifer', 'conifer', 'birch'] },
      { x: 6, z: -30, r: 11, n: 20, kinds: ['conifer', 'conifer', 'broadleaf'] },
      { x: -25, z: -6, r: 7, n: 12, kinds: ['conifer', 'broadleaf'] },
      { x: -24, z: 8, r: 6, n: 10, kinds: ['broadleaf', 'birch'] },
      { x: 24, z: -24, r: 7, n: 12, kinds: ['conifer', 'birch'] },
      { x: -6, z: -26, r: 6, n: 10, kinds: ['broadleaf', 'conifer'] },
      { x: 26, z: -2, r: 5, n: 6, kinds: ['broadleaf'] },
      { x: 20, z: 8, r: 4, n: 5, kinds: ['broadleaf', 'birch'] },
    ];
    for (const f of forests) {
      for (let i = 0; i < f.n * 3 && f.n > 0; i++) {
        const a = rng.range(0, TAU), r = Math.sqrt(rng.next()) * f.r;
        const x = f.x + Math.cos(a) * r, z = f.z + Math.sin(a) * r;
        if (!helper.free(x, z, 1.6, { maxSlope: 0.8, minY: 1.2 })) continue;
        const kind = rng.pick(f.kinds);
        const scale = rng.range(0.8, 1.25);
        const tree = kind === 'conifer' ? makeConifer(rng, scale) : kind === 'birch' ? makeBirch(rng, scale) : makeBroadleaf(rng, scale);
        put(tree, x, z, rng.range(0, TAU), { occupy: 1.5 * scale, sink: 0.2, useGround: true, nocheck: true });
        if (--f.n <= 0) break;
      }
    }
    // 河畔柳树
    for (let i = 0; i < 7; i++) {
      const t = rng.range(0.15, 0.9);
      const idx = Math.floor(t * 12) + 1;
      const p = [-15.8, -15.2, -14.4, -13.9, -13.4, -12.6, -12.2, -11.6, -10.9, -10.4, -10.2, -10.9];
      const zs = [-15, -12, -9, -6.4, -3, 1, 5, 9, 12, 15.2, 19, 23];
      const side = rng.chance(0.5) ? 1 : -1;
      const x = p[idx % p.length] + side * rng.range(3.2, 4.6);
      const z = zs[idx % zs.length] + rng.jitter(1.4);
      if (!helper.free(x, z, 1.8, { riverClear: 2.6, maxSlope: 0.9 })) continue;
      put(makeWillow(rng, rng.range(0.85, 1.1)), x, z, rng.range(0, TAU), { occupy: 2, sink: 0.2, useGround: true, nocheck: true });
    }
    // 灌木与花丛
    for (let i = 0; i < 90; i++) {
      const x = rng.range(-30, 30), z = rng.range(-32, 30);
      if (!helper.free(x, z, 0.9, { maxSlope: 0.9, roadClear: 2.0 })) continue;
      if (rng.chance(0.55)) put(makeBush(rng), x, z, rng.range(0, TAU), { sink: 0.15, useGround: true, nocheck: true });
      else put(makeFlowerPatch(rng), x, z, rng.range(0, TAU), { sink: 0, useGround: true, nocheck: true });
    }
    // 岩石
    for (let i = 0; i < 60; i++) {
      const x = rng.range(-32, 32), z = rng.range(-34, 34);
      const y = groundHeight(x, z);
      if (y < -0.8 || y > 20) continue;
      if (!helper.free(x, z, 1.0, { maxSlope: 1.0, minY: -0.8, roadClear: 2.0, riverClear: 1.2 })) continue;
      put(makeRock(rng, rng.range(0.5, 1.5)), x, z, rng.range(0, TAU), { sink: 0.3, useGround: true, nocheck: true });
    }
    // 草簇
    let tufts = 0;
    for (let i = 0; i < 900 && tufts < 320; i++) {
      const x = rng.range(-31, 31), z = rng.range(-33, 31);
      if (!helper.free(x, z, 0.35, { maxSlope: 1.0, roadClear: 1.6, riverClear: 1.0 })) continue;
      put(makeGrassTuft(rng), x, z, rng.range(0, TAU), { sink: 0.05, useGround: true, nocheck: true });
      tufts++;
    }
  }

  /* ============================================================ 合批输出 */
  const meshes = batch.build(root, { cast: true, receive: true });

  /* 灯光光晕点 & 夜间点光源候选 */
  const nightLightSpots = [
    { x: 6.6, y: 8.4, z: -0.6, intensity: 7, dist: 18, color: '#ffcf90' },
    { x: 1.0, y: 5.6, z: 15.2, intensity: 6, dist: 16, color: '#ffc880' },
    { x: -2.0, y: 4.0, z: 25.0, intensity: 6, dist: 18, color: '#ffcf90' },
    { x: 17.0, y: 7.4, z: 1.0, intensity: 5, dist: 14, color: '#ffc880' },
    { x: 22.5, y: 5.4, z: 20.0, intensity: 6, dist: 18, color: '#ffd0a0' },
    { x: -4.0, y: 12.8, z: -12.0, intensity: 5, dist: 16, color: '#ffc880' },
    { x: -21.0, y: 21.0, z: -23.0, intensity: 4, dist: 14, color: '#ffd8a8' },
    { x: -27.0, y: 18.0, z: 22.0, intensity: 5, dist: 20, color: '#fff2c8' },
  ];

  const fireflySpots = [
    { x: -8, y: 11.2, z: -18.4, r: 5 },
    { x: 12, y: 9.0, z: -20.0, r: 6 },
    { x: -15, y: 14.4, z: -24.0, r: 5 },
    { x: -12.5, y: 4.2, z: 16.0, r: 4 },
    { x: 4, y: 11.2, z: -10.0, r: 5 },
    { x: 22, y: 9.0, z: -12.0, r: 5 },
  ];

  /* ---------------- 动画驱动 ---------------- */
  const sheepList = misc.filter((m) => m.userData.sheep);
  function update(dt, elapsed, night, hours) {
    for (const s of spinners) {
      const d = s.userData.spin * dt;
      s.userData.angle = (s.userData.angle || 0) + d;
      if (s.userData.axis === 'y') s.rotateY(d); else s.rotateZ(d);
      // 摩天轮吊舱保持水平
      if (s.userData.cabins) {
        for (const cab of s.userData.cabins) cab.rotation.z = -s.userData.angle;
      }
      // 旋转木马的木马上下起伏
      if (s.name === 'carRotor') {
        for (const ch of s.children) {
          if (ch.name === 'horse') ch.position.y = 1.5 + Math.sin(elapsed * 2.4 + (ch.userData.bob || 0)) * 0.32;
        }
      }
    }
    // 钟楼指针跟随当前时刻
    for (const c of clocks) {
      const h = c.userData.clock;
      if (!h) continue;
      h.hour.rotation.z = -((hours % 12) / 12) * TAU;
      h.minute.rotation.z = -(hours % 1) * TAU;
    }
    // 灯塔光束
    for (const b of beacons) {
      b.rotateY(dt * 0.55);
      const beam = b.getObjectByName('beam');
      const core = b.getObjectByName('beaconCore');
      if (beam) beam.material.opacity = night * 0.2;
      if (core) core.visible = night > 0.15;
    }
    for (const m of misc) {
      if (m.userData.scan) {
        m.rotation.y = Math.sin(elapsed * 0.18) * 1.1;
        m.children.forEach((ch) => { ch.rotation.x = Math.sin(elapsed * 0.22) * 0.2; });
      }
      if (m.userData.swing) m.rotation.x = Math.sin(elapsed * 1.6) * 0.42;
    }
    // 羊群漫步
    for (const s of sheepList) {
      const w = s.userData.wander;
      const x = w.x + Math.sin(elapsed * w.speed * 0.35 + w.phase) * 1.3;
      const z = w.z + Math.cos(elapsed * w.speed * 0.28 + w.phase * 1.7) * 1.1;
      s.position.set(x, groundHeight(x, z), z);
      s.rotation.y = Math.atan2(
        Math.cos(elapsed * w.speed * 0.35 + w.phase),
        -Math.sin(elapsed * w.speed * 0.28 + w.phase * 1.7)
      );
      const head = s.children.find((c) => c.name === 'head');
      if (head) head.rotation.z = -0.25 + Math.abs(Math.sin(elapsed * 0.8 + w.phase)) * 0.45;
    }
  }

  return {
    root, live, meshes, chimneys, jets, lampSpots, nightLightSpots, fireflySpots,
    occupied, update, spinners, clocks, placements,
  };
}
