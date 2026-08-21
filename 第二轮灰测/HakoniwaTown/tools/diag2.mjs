/** 找出某个工厂产物里"跑飞"的子网格 */
import * as THREE from 'three';
import { makeChurch, makeWatermill, makeWindmill, makeClockTower, makeTownHall, makeStation, makeLighthouse, makeBarn } from '../src/world/buildings.js';
import { makeFerrisWheel, makeCarousel, makeSwing, makeCrane, makeWell } from '../src/world/props.js';
import { RNG } from '../src/lib/utils.js';

const rng = new RNG(5);
const items = {
  church: makeChurch(rng), watermill: makeWatermill(), windmill: makeWindmill(),
  clockTower: makeClockTower(), townHall: makeTownHall(), station: makeStation(),
  lighthouse: makeLighthouse(), barn: makeBarn(),
  ferris: makeFerrisWheel(), carousel: makeCarousel(), swing: makeSwing(), crane: makeCrane(), well: makeWell(),
};

const box = new THREE.Box3();
for (const [name, res] of Object.entries(items)) {
  const g = res.group ?? res;
  g.updateMatrixWorld(true);
  box.setFromObject(g);
  console.log(`\n== ${name}  bbox x[${box.min.x.toFixed(1)},${box.max.x.toFixed(1)}] y[${box.min.y.toFixed(1)},${box.max.y.toFixed(1)}] z[${box.min.z.toFixed(1)},${box.max.z.toFixed(1)}]`);
  const off = [];
  g.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const reach = Math.max(Math.abs(b.min.x), Math.abs(b.max.x), Math.abs(b.min.z), Math.abs(b.max.z));
    const low = b.min.y;
    if (reach > 9 || low < -1.2) off.push(`   ! reach=${reach.toFixed(1)} minY=${low.toFixed(2)} parent=${o.parent.name} geo=${o.geometry.type}`);
  });
  for (const l of off.slice(0, 8)) console.log(l);
}
