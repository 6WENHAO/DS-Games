/**
 * Node 冒烟测试：在无 WebGL/DOM 的环境里构建整个世界，
 * 用来抓出几何、材质、物理与模块导入层面的错误。
 *   node tools/smoke.mjs
 */
import * as THREE from 'three';
import { Starship } from '../src/ship/starship.js';
import { SolarSystem } from '../src/world/solarSystem.js';
import { BlackHole } from '../src/world/blackhole.js';
import { AsteroidBelt, SpaceDust } from '../src/world/debris.js';
import { Skybox } from '../src/world/skybox.js';
import { FlightModel } from '../src/ship/flight.js';
import { CameraRig } from '../src/ship/cameraRig.js';
import { loft, hullProfile, airfoilProfile, mirroredX, bevelBox, mergeAll } from '../src/util/geom.js';
import { makeRng, formatDistance, formatSpeed } from '../src/util/math.js';

let failures = 0;
const ok = (name, cond, extra = '') => {
  const mark = cond ? 'PASS' : 'FAIL';
  if (!cond) failures++;
  console.log(`[${mark}] ${name}${extra ? ` — ${extra}` : ''}`);
};

const t0 = Date.now();

/* ---------------- 几何基础 ---------------- */
{
  const g = loft(hullProfile(20), [
    { z: 0, sx: 1, sy: 1 }, { z: 2, sx: 2, sy: 1.2 }, { z: 4, sx: 0.4, sy: 0.3 },
  ]);
  g.computeBoundingBox();
  ok('loft 生成有效几何', g.attributes.position.count > 0 && !!g.index);
  ok('loft 有 uv/normal', !!g.attributes.uv && !!g.attributes.normal);

  // 外向法线检查：顶点相对中心的方向应与法线同向
  const center = g.boundingBox.getCenter(new THREE.Vector3());
  const pos = g.attributes.position, nrm = g.attributes.normal;
  let outward = 0, total = 0;
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    v.fromBufferAttribute(pos, i).sub(center);
    n.fromBufferAttribute(nrm, i);
    if (v.lengthSq() < 1e-6) continue;
    total++;
    if (v.normalize().dot(n) > 0) outward++;
  }
  ok('放样法线朝外', outward / total > 0.82, `${((outward / total) * 100).toFixed(1)}% outward`);

  const af = airfoilProfile(20, 0.18, 0.02);
  let area = 0;
  for (let i = 0; i < af.length; i++) {
    const a = af[i], b = af[(i + 1) % af.length];
    area += a.x * b.y - b.x * a.y;
  }
  ok('翼型剖面为逆时针', area > 0, `signed area ${area.toFixed(4)}`);

  const bb = bevelBox(2, 1, 3, 0.1);
  ok('倒角盒有效', bb.attributes.position.count > 20);
  const merged = mergeAll([bb.clone(), mirroredX(bb).clone()]);
  ok('几何合并', merged.attributes.position.count === bb.attributes.position.count * 2);
}

/* ---------------- 战舰 ---------------- */
let ship;
{
  ship = new Starship({ quality: 'high' });
  let meshes = 0, tris = 0;
  ship.group.traverse((o) => {
    if (o.isMesh) {
      meshes++;
      const idx = o.geometry.index;
      tris += (idx ? idx.count : o.geometry.attributes.position.count) / 3;
    }
  });
  ok('战舰构建完成', meshes > 20, `${meshes} 个网格 / ${Math.round(tris)} 三角面`);
  ok('战舰细节量充足（精致度）', tris > 60000, `${Math.round(tris)} tris`);

  // 只统计实体外形（排除尾焰/护盾等加法混合特效）
  ship.group.updateMatrixWorld(true);
  const bbox = new THREE.Box3();
  ship.group.traverse((o) => {
    if (o.isMesh && o.material.blending !== THREE.AdditiveBlending) bbox.expandByObject(o);
  });
  const size = bbox.getSize(new THREE.Vector3());
  ok('舰体尺寸合理', size.z > 18 && size.z < 30 && size.x > 14,
    `L=${size.z.toFixed(1)} W=${size.x.toFixed(1)} H=${size.y.toFixed(1)}`);
  ok('前向为 -Z（机首朝前）', ship.model.rotation.y === Math.PI);
  ship.update(0.016, { throttle: 0.8, boost: 0.5, warp: 0, pitch: 0.2, yaw: -0.1 });
  ship.update(0.016, { throttle: 1, boost: 1, warp: 1 });
  ok('战舰动画更新无异常', true);
  ok('推进器数量', ship._nozzles.length === 4, `${ship._nozzles.length} 台`);
}

/* ---------------- 太阳系 ---------------- */
let solar;
{
  solar = new SolarSystem({ quality: 'medium' });
  for (const s of solar.buildSteps()) s.fn();
  ok('太阳系天体数', solar.bodies.length >= 13, `${solar.bodies.length} 个天体`);
  solar.update(0.5, new THREE.PerspectiveCamera());
  const earth = solar.getBody('earth');
  ok('地球已就位', earth && earth.position.length() > 1000,
    `r=${earth.position.length().toFixed(0)}`);
  const saturn = solar.getBody('saturn');
  ok('土星有环', !!saturn && saturn.object.parent.children.length > 1);
}

/* ---------------- 黑洞 ---------------- */
let bh;
{
  bh = new BlackHole({ position: new THREE.Vector3(-52000, 15000, 88000), rs: 900, steps: 90 });
  ok('黑洞构建', !!bh.lens && !!bh.jets);
  const cam = new THREE.PerspectiveCamera();
  cam.position.set(-52000 + 9000, 15000, 88000);
  bh.update(0.016, cam);
  ok('黑洞透镜相机变换', bh.uniforms.uRo.value.length() > 0.5,
    `ro=${bh.uniforms.uRo.value.length().toFixed(2)} rs`);
  const g = new THREE.Vector3();
  bh.addGravity(new THREE.Vector3(-52000 + 6000, 15000, 88000), g);
  ok('黑洞引力', g.length() > 100, `a=${g.length().toFixed(0)} u/s²`);
  ok('危险等级', bh.dangerLevel(new THREE.Vector3(-52000 + 2000, 15000, 88000)) > 0.5);
  const m = bh.l2w.clone().multiply(bh.w2l);
  const e = m.elements;
  const identity = Math.abs(e[0] - 1) + Math.abs(e[4] - 1) + Math.abs(e[8] - 1)
    + Math.abs(e[1]) + Math.abs(e[2]);
  ok('盘面基底正交', identity < 1e-6, `err=${identity.toExponential(2)}`);
}

/* ---------------- 碎屑 ---------------- */
{
  const belt = new AsteroidBelt({ count: 200 });
  belt.update(0.016, new THREE.Vector3(34000, 0, 0));
  ok('小行星带', belt.meshes.length === 3);
  const dust = new SpaceDust({ count: 128, box: 900 });
  dust.update(0.016, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -500));
  ok('尘埃拉丝', dust.material.uniforms.uStreak.value.length() > 1);
  const sky = new Skybox({ radius: 200000 });
  sky.update(new THREE.Vector3(1, 2, 3));
  ok('天空球跟随相机', sky.mesh.position.x === 1);
}

/* ---------------- 飞行模型 ---------------- */
{
  const flight = new FlightModel(ship, {
    bodies: solar.bodies, blackHole: bh, sunRadius: solar.sunRadius,
  });
  const earth = solar.getBody('earth');
  flight.setSpawnNear(earth, { dist: 1250, height: 240 });
  const input = {
    pitch: 0, yaw: 0, roll: 0, throttleDelta: 1,
    boost: true, brake: false, warp: false, align: false,
  };
  for (let i = 0; i < 240; i++) flight.update(1 / 60, input);
  ok('加速有效', flight.speed > 1200, `v=${formatSpeed(flight.speed)}`);
  ok('出生姿态不会撞向星球',
    !flight.warnings.some((w) => w.key === 'impact' || w.key === 'graze'),
    `d=${flight.position.distanceTo(earth.position).toFixed(0)}`);
  ok('油门推满', flight.throttle > 0.95, `${(flight.throttle * 100).toFixed(0)}%`);
  ok('能量被加力消耗', flight.energy < 100, `E=${flight.energy.toFixed(1)}`);

  // 转向
  const fwd0 = flight.forward.clone();
  input.pitch = 1; input.throttleDelta = 0;
  for (let i = 0; i < 60; i++) flight.update(1 / 60, input);
  ok('俯仰改变朝向', flight.forward.angleTo(fwd0) > 0.3,
    `Δ=${(flight.forward.angleTo(fwd0) * 57.3).toFixed(1)}°`);

  // 曲速
  flight.energy = 100;
  input.pitch = 0; input.throttleDelta = 1; input.warp = true; input.boost = false;
  for (let i = 0; i < 240; i++) flight.update(1 / 60, input);
  ok('曲速可达行星际速度', flight.speed > 4000, `v=${formatSpeed(flight.speed)}`);
  ok('曲速续航够横穿太阳系', flight.energy > 20, `E=${flight.energy.toFixed(0)}`);
  input.warp = false;

  // 落入视界 → 紧急跃迁
  flight.position.copy(bh.position).add(new THREE.Vector3(bh.rs * 1.0, 0, 0));
  flight.update(1 / 60, input);
  ok('落入视界后紧急跃迁',
    flight.events.length > 0 || flight.position.distanceTo(bh.position) > bh.rs * 2);

  // 引力捕获：无推力时应被吸向黑洞
  flight.velocity.set(0, 0, 0);
  flight.position.copy(bh.position).add(new THREE.Vector3(bh.rs * 12, 0, 0));
  const d0 = flight.position.distanceTo(bh.position);
  const noThrust = {
    pitch: 0, yaw: 0, roll: 0, throttleDelta: -1,
    boost: false, brake: true, warp: false, align: false,
  };
  for (let i = 0; i < 120; i++) flight.update(1 / 60, noThrust);
  ok('黑洞会把飞船拉过去', flight.position.distanceTo(bh.position) < d0,
    `${d0.toFixed(0)} → ${flight.position.distanceTo(bh.position).toFixed(0)}`);

  // 行星软碰撞
  flight.position.copy(earth.position).add(new THREE.Vector3(1, 0, 0));
  flight.velocity.set(-200, 0, 0);
  flight.update(1 / 60, input);
  const d = flight.position.distanceTo(earth.position);
  ok('行星软碰撞把飞船推到表面外', d > earth.radius, `d=${d.toFixed(0)} vs r=${earth.radius}`);

  const cam = new THREE.PerspectiveCamera(62, 1.8, 0.6, 420000);
  const rig = new CameraRig(cam);
  for (const mode of ['chase', 'cockpit', 'cine']) {
    rig.setMode(mode);
    for (let i = 0; i < 12; i++) rig.update(1 / 60, flight, ship, { bhDanger: 0.2, impact: 0.1 });
    const dist = cam.position.distanceTo(flight.position);
    ok(`相机模式 ${mode}`, Number.isFinite(dist) && dist < 200, `d=${dist.toFixed(1)}`);
  }
  ok('相机视场有效', cam.fov > 30 && cam.fov < 130, `fov=${cam.fov.toFixed(1)}`);
}

/* ---------------- 工具 ---------------- */
{
  const rng = makeRng(42);
  const vals = Array.from({ length: 2000 }, () => rng());
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  ok('随机数均匀', Math.abs(mean - 0.5) < 0.03, `mean=${mean.toFixed(4)}`);
  ok('距离格式化', formatDistance(100000).includes('km'), formatDistance(100000));
  ok('速度格式化', formatSpeed(620).includes('km/s') && formatSpeed(50).includes('m/s'),
    `${formatSpeed(620)} / ${formatSpeed(50)}`);
}

console.log(`\n耗时 ${Date.now() - t0} ms`);
if (failures) {
  console.error(`\n✗ ${failures} 项检查未通过`);
  process.exit(1);
}
console.log('\n✓ 全部冒烟测试通过');
