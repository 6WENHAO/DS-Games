/* 冒烟测试:Node 中以桩验证 世界生成 / 碰撞 / 玩家物理 / 贴图生成 */
'use strict';
const path = require('path');
const fs = require('fs');

global.window = global;
global.innerWidth = 1280; global.innerHeight = 720;
global.devicePixelRatio = 1;
window.addEventListener = () => {};
function makeCtx(cv) {
  const noop = () => {};
  return {
    canvas: cv, fillStyle: '', imageSmoothingEnabled: false,
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: noop, getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4).fill(128) }),
    createRadialGradient: () => ({ addColorStop: noop }),
    fillRect: noop, clearRect: noop
  };
}
global.document = {
  createElement(tag) {
    if (tag === 'canvas') { const cv = { width: 0, height: 0, getContext: () => makeCtx(cv) }; return cv; }
    return { style: {}, addEventListener: () => {}, classList: { add() {} } };
  },
  addEventListener: () => {},
  getElementById: () => ({ style: {}, addEventListener: () => {}, classList: { add() {} }, innerHTML: '' })
};

const dir = path.join(__dirname, '..', 'js');
global.THREE = require(path.join(dir, 'three.min.js'));
const load = f => { new Function(fs.readFileSync(path.join(dir, f), 'utf8'))(); };
['textures.js', 'world.js', 'water.js', 'post.js', 'player.js', 'audio.js'].forEach(load);

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) { pass++; console.log('  OK ' + n); } else { fail++; console.log('  FAIL ' + n); } };

console.log('== 贴图 ==');
{
  const T = PR.buildTextures();
  ok(T.tile.map && T.tile.normalMap && T.tile.roughnessMap && T.tile.aoMap, 'tile PBR set');
  ok(T.mosaic.map && T.concrete.map && T.waterN1 && T.waterN2, 'all texture sets');
}

console.log('== 世界生成 ==');
{
  // 桩:水材质与光束
  PR.waterMat = new THREE.MeshBasicMaterial();
  PR.makeShaft = () => null;
  PR.makeDust = () => null;
  const scene = new THREE.Scene(), waterScene = new THREE.Scene();
  const mats = {
    tile: new THREE.MeshBasicMaterial(), mosaic: new THREE.MeshBasicMaterial(),
    concrete: new THREE.MeshBasicMaterial(), sky: new THREE.MeshBasicMaterial()
  };
  PR.world.init(scene, waterScene, mats);
  PR.world.update(8, 8);
  ok(PR.world.cells.size === 25, '5x5 cells built: ' + PR.world.cells.size);
  const c00 = PR.world.cells.get('0,0');
  ok(!!c00 && c00.floors.length > 0, 'spawn cell floors: ' + c00.floors.length);
  ok(c00.solids.length > 0, 'spawn cell solids: ' + c00.solids.length);
  ok(!c00.pool, 'spawn cell has no pool');
  ok(c00.skylights.length === 2, 'spawn skylights = 2');
  // 确定性
  const cA = PR.world.cells.get('1,1');
  const sig = JSON.stringify([cA.floors.length, cA.solids.length, !!cA.pool, cA.H]);
  PR.world.update(200 / 16 * 16 + 8, 8); // 移动很远,卸载
  PR.world.update(8, 8); // 回来重建
  const cB = PR.world.cells.get('1,1');
  ok(JSON.stringify([cB.floors.length, cB.solids.length, !!cB.pool, cB.H]) === sig, 'deterministic regen');
  // 地面查询
  const g = PR.world.groundAt(8, 8, 1, 0.5);
  ok(Math.abs(g - 0) < 0.001, 'ground at spawn = 0');
  // 深水池存在于某处
  let foundPool = null;
  for (const [, c] of PR.world.cells) if (c.pool) { foundPool = c; break; }
  ok(!!foundPool, 'some cell has pool');
  if (foundPool) {
    const p = foundPool.pool;
    const mx = (p.x0 + p.x1) / 2, mz = (p.z0 + p.z1) / 2;
    const gp = PR.world.groundAt(mx, mz, 1, 0.5);
    ok(gp < -2, 'pool floor deep: ' + gp.toFixed(2));
  }
  // 碰撞:推离角柱
  const r = PR.world.collide(0.1, 0.1, 0.32, 0, 1.8);
  const dist = Math.hypot(Math.max(0, 0.42 - Math.abs(r.x)), 0);
  ok(Math.abs(r.x) >= 0.42 - 0.001 + 0.32 - 0.05 || Math.abs(r.z) >= 0.42 + 0.32 - 0.05, 'pushed out of pier: ' + r.x.toFixed(2) + ',' + r.z.toFixed(2));
  // 水面几何
  ok(c00.water.getAttribute('position').count === 25 * 25, 'water grid verts');
  ok(c00.water.getAttribute('aDepth') !== undefined, 'water depth attr');
}

console.log('== 玩家物理 ==');
{
  const cam = new THREE.PerspectiveCamera(72, 16 / 9, 0.08, 160);
  PR.player.init(cam);
  PR.player.locked = true;
  PR.player.keys = { KeyW: true };
  PR.player.pos.set(8, 0.5, 8);
  PR.player.yaw = 2.4;
  let minY = 99, maxY = -99;
  for (let i = 0; i < 400; i++) {
    PR.player.update(1 / 60);
    PR.world.update(PR.player.pos.x, PR.player.pos.z);
    minY = Math.min(minY, PR.player.pos.y);
    maxY = Math.max(maxY, PR.player.pos.y);
  }
  const p = PR.player.pos;
  const moved = Math.hypot(p.x - 8, p.z - 8);
  ok(moved > 5, 'walked ' + moved.toFixed(1) + 'm');
  ok(p.y > -3 && p.y < 3, 'y sane: ' + p.y.toFixed(2) + ' (min ' + minY.toFixed(2) + ' max ' + maxY.toFixed(2) + ')');
  ok(!isNaN(p.x) && !isNaN(p.y) && !isNaN(p.z), 'no NaN');
  // 长途游走多个方向
  const dirs = [0, 1.57, 3.14, 4.71, 0.8];
  let sane = true;
  for (const d of dirs) {
    PR.player.yaw = d;
    for (let i = 0; i < 600; i++) {
      PR.player.update(1 / 60);
      PR.world.update(PR.player.pos.x, PR.player.pos.z);
      const y = PR.player.pos.y;
      if (isNaN(y) || y < -5 || y > 10) { sane = false; break; }
    }
  }
  ok(sane, 'long walk stable, ended at ' + PR.player.pos.x.toFixed(0) + ',' + PR.player.pos.z.toFixed(0) + ' cells=' + PR.world.cells.size);
  ok(PR.world.cells.size <= 49, 'far cells disposed: ' + PR.world.cells.size);
}

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
