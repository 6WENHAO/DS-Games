/* ============================================================
   STARFORGE - factory.js
   工厂自动化：采矿机 / 熔炉 / 传送带 / 装配机 / 精炼厂 /
   太阳能 / 反应堆 / 储物箱 / 发射平台 + 电力网 + 动画
   ============================================================ */
'use strict';

const Factory = (() => {
  let machines = new Map();     // "x,y,z" -> mach
  let group = null;             // THREE.Group（机器可视）
  let itemGroup = null;         // 传送带上的物品
  let tickAcc = 0;
  const TICK = 0.1;
  let power = { gen: 0, use: 0, sat: 1 };

  const key = (x, y, z) => x + ',' + y + ',' + z;
  const DIRS = [[1,0],[0,1],[-1,0],[0,-1]];   // 0:+x 1:+z 2:-x 3:-z

  // ---------- 材质 ----------
  const M = {};
  function initMats(){
    if (M.metal) return;
    M.metal = new THREE.MeshLambertMaterial({ map: Tex.tileTexture('metal') });
    M.metalDark = new THREE.MeshLambertMaterial({ map: Tex.tileTexture('metal_dark') });
    M.vent = new THREE.MeshLambertMaterial({ map: Tex.tileTexture('vent') });
    M.stone = new THREE.MeshLambertMaterial({ map: Tex.tileTexture('stone') });
    M.furnaceFront = new THREE.MeshLambertMaterial({ map: Tex.tileTexture('furnace_front') });
    M.furnaceOn = new THREE.MeshLambertMaterial({ map: Tex.tileTexture('furnace_on'), emissive: 0xff6a00, emissiveIntensity: 0.5, emissiveMap: Tex.tileTexture('furnace_on') });
    M.minerTop = new THREE.MeshLambertMaterial({ map: Tex.tileTexture('miner_top') });
    M.assemblerTop = new THREE.MeshLambertMaterial({ map: Tex.tileTexture('assembler_top') });
    M.solar = new THREE.MeshLambertMaterial({ map: Tex.tileTexture('solar_top') });
    M.chest = new THREE.MeshLambertMaterial({ map: Tex.tileTexture('chest_side') });
    M.chestTop = new THREE.MeshLambertMaterial({ map: Tex.tileTexture('storage_top') });
    M.refinery = new THREE.MeshLambertMaterial({ map: Tex.tileTexture('refinery_side') });
    M.reactor = new THREE.MeshLambertMaterial({ map: Tex.tileTexture('reactor_side'), emissive: 0x33ff33, emissiveIntensity: 0.12 });
    M.launch = new THREE.MeshLambertMaterial({ map: Tex.tileTexture('launchpad_top') });
    M.drill = new THREE.MeshLambertMaterial({ color: 0x8a97a0 });
    M.drillTip = new THREE.MeshLambertMaterial({ color: 0xffcf4d, emissive: 0xaa7700, emissiveIntensity: 0.3 });
    M.glow = new THREE.MeshBasicMaterial({ color: 0x35e0e8 });
    M.glowAmber = new THREE.MeshBasicMaterial({ color: 0xffb347 });
    M.glowGreen = new THREE.MeshBasicMaterial({ color: 0x7dff8a });
    M.glowOff = new THREE.MeshBasicMaterial({ color: 0x1a2a33 });
    M.dark = new THREE.MeshLambertMaterial({ color: 0x2c353b });
  }
  function box(w, h, d, mat){ return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }

  // ---------- 机器网格 ----------
  const builders = {
    furnace(m){
      const g = new THREE.Group();
      const body = box(0.96, 0.96, 0.96, [M.stone, M.stone, M.stone, M.stone, M.furnaceFront, M.stone]);
      body.position.y = 0.48; g.add(body);
      const chimney = box(0.22, 0.4, 0.22, M.metalDark); chimney.position.set(0.25, 1.1, -0.25); g.add(chimney);
      m.animParts = { body };
      // 火光
      const light = new THREE.PointLight(0xff7722, 0, 3); light.position.set(0, 0.5, 0.6); g.add(light);
      m.animParts.light = light;
      return g;
    },
    miner(m){
      const g = new THREE.Group();
      const base = box(0.9, 0.34, 0.9, M.metalDark); base.position.y = 0.17; g.add(base);
      const frame = box(0.7, 0.9, 0.7, [M.metal, M.metal, M.minerTop, M.metal, M.vent, M.vent]); frame.position.y = 0.75; g.add(frame);
      const drill = new THREE.Group();
      const bit = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 6), M.drillTip); bit.rotation.x = Math.PI; bit.position.y = -0.25; drill.add(bit);
      const shaft = box(0.12, 0.5, 0.12, M.drill); shaft.position.y = 0.2; drill.add(shaft);
      drill.position.y = 0.45; g.add(drill);
      const lamp = box(0.1, 0.1, 0.1, M.glowOff); lamp.position.set(0.31, 1.25, 0.31); g.add(lamp);
      m.animParts = { drill, lamp };
      return g;
    },
    belt(m){
      const g = new THREE.Group();
      m.animParts = {};
      rebuildBeltVisual(m, g);
      return g;
    },
    wind(m){
      const g = new THREE.Group();
      const poleMat = new THREE.MeshLambertMaterial({ map: Tex.tileTexture('wind_pole') });
      const base = box(0.7, 0.25, 0.7, M.metalDark); base.position.y = 0.12; g.add(base);
      const pole = box(0.22, 2.3, 0.22, poleMat); pole.position.y = 1.35; g.add(pole);
      const nacelle = box(0.34, 0.3, 0.62, M.metal); nacelle.position.set(0, 2.55, 0.08); g.add(nacelle);
      const hub = box(0.14, 0.14, 0.14, M.glowAmber); hub.position.set(0, 2.55, -0.28); g.add(hub);
      const rotor = new THREE.Group();
      const bladeMat = new THREE.MeshLambertMaterial({ color: 0xdde6ec });
      for (let i = 0; i < 3; i++){
        const pivot = new THREE.Group();
        pivot.rotation.z = i * Math.PI * 2 / 3;
        const blade = box(0.1, 1.05, 0.04, bladeMat);
        blade.position.y = 0.55;
        pivot.add(blade);
        rotor.add(pivot);
      }
      rotor.position.set(0, 2.55, -0.32);
      g.add(rotor);
      m.animParts = { rotor };
      return g;
    },
    burner(m){
      const g = new THREE.Group();
      const body = box(0.94, 0.9, 0.94, [M.metalDark, M.metalDark, M.vent, M.metalDark, M.furnaceFront, M.metalDark]);
      body.position.y = 0.45; g.add(body);
      const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.7, 8), M.metalDark);
      chimney.position.set(-0.25, 1.2, -0.25); g.add(chimney);
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 6, 12), M.glowOff);
      coil.rotation.x = Math.PI / 2; coil.position.set(0.25, 0.95, 0.25); g.add(coil);
      const light = new THREE.PointLight(0xff7722, 0, 3); light.position.set(0, 0.5, 0.6); g.add(light);
      m.animParts = { body, coil, light, smokeT: 0 };
      return g;
    },
    beacon(m){
      const g = new THREE.Group();
      // 基座 + 天线 + 顶灯 + 垂直光柱
      const base = box(0.62, 0.3, 0.62, M.metalDark); base.position.y = 0.15; g.add(base);
      const pole = box(0.12, 0.7, 0.12, M.metal); pole.position.y = 0.62; g.add(pole);
      const lamp = box(0.24, 0.24, 0.24, M.glowAmber); lamp.position.y = 1.05; g.add(lamp);
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xffcf4d, transparent: true, opacity: 0.28,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
      });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.16, 26, 8, 1, true), beamMat);
      beam.position.y = 13.5; g.add(beam);
      const light = new THREE.PointLight(0xffcf4d, 0.6, 7); light.position.y = 1.2; g.add(light);
      m.animParts = { lamp, beam, beamMat, light };
      return g;
    },
    collector(m){
      const g = new THREE.Group();
      // 储箱主体 + 顶部收料漏斗 + 信号灯天线
      const body = box(0.94, 0.55, 0.94, [M.chest, M.chest, M.chestTop, M.chest, M.chest, M.chest]);
      body.position.y = 0.28; g.add(body);
      const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.24, 0.3, 4, 1, true), M.metalDark);
      funnel.rotation.y = Math.PI / 4;
      funnel.position.y = 0.72; g.add(funnel);
      const pole = box(0.06, 0.5, 0.06, M.metal); pole.position.set(-0.36, 1.0, -0.36); g.add(pole);
      const lamp = box(0.13, 0.13, 0.13, M.glowOff); lamp.position.set(-0.36, 1.3, -0.36); g.add(lamp);
      // 输出方向箭头
      const arrow = box(0.3, 0.04, 0.16, M.glowAmber); arrow.position.set(0, 0.58, -0.3); g.add(arrow);
      m.animParts = { lamp };
      return g;
    },
    lumberbot(m){
      const g = new THREE.Group();
      // 充电桩：底座 + 悬浮环 + 能量柱
      const base = box(0.9, 0.18, 0.9, M.metalDark); base.position.y = 0.09; g.add(base);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.045, 8, 18), M.glow);
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.24; g.add(ring);
      const pillar = box(0.1, 0.55, 0.1, M.metal); pillar.position.set(0.34, 0.45, 0.34); g.add(pillar);
      const lamp = box(0.12, 0.12, 0.12, M.glowGreen); lamp.position.set(0.34, 0.79, 0.34); g.add(lamp);
      m.animParts = { ring, lamp };
      return g;
    },
    assembler(m){
      const g = new THREE.Group();
      const body = box(0.94, 0.72, 0.94, [M.metal, M.metal, M.assemblerTop, M.metal, M.metal, M.metal]); body.position.y = 0.36; g.add(body);
      const domeMat = new THREE.MeshLambertMaterial({ color: 0x1a3d55, transparent: true, opacity: 0.75, emissive: 0x0a3a44, emissiveIntensity: 0.4 });
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
      dome.position.y = 0.72; g.add(dome);
      const rotor = new THREE.Group();
      for (let i = 0; i < 3; i++){
        const arm = box(0.34, 0.05, 0.07, M.glow);
        arm.position.x = 0.14; arm.rotation.y = i * Math.PI * 2 / 3;
        const pivot = new THREE.Group(); pivot.rotation.y = i * Math.PI * 2 / 3; pivot.add(arm);
        arm.position.set(0.15, 0, 0);
        rotor.add(pivot);
      }
      rotor.position.y = 0.8; g.add(rotor);
      const lamp = box(0.09, 0.09, 0.09, M.glowOff); lamp.position.set(0.35, 0.76, 0.35); g.add(lamp);
      m.animParts = { rotor, lamp, dome: domeMat };
      return g;
    },
    solar(m){
      const g = new THREE.Group();
      const pole = box(0.14, 0.36, 0.14, M.metalDark); pole.position.y = 0.18; g.add(pole);
      const panel = box(0.96, 0.08, 0.96, [M.metalDark, M.metalDark, M.solar, M.metalDark, M.metalDark, M.metalDark]);
      panel.position.y = 0.42; panel.rotation.z = 0.18; g.add(panel);
      m.animParts = { panel };
      return g;
    },
    refinery(m){
      const g = new THREE.Group();
      const body = box(0.94, 0.9, 0.94, M.refinery); body.position.y = 0.45; g.add(body);
      const tank1 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.5, 8), M.metal); tank1.position.set(-0.24, 1.1, -0.2); g.add(tank1);
      const tank2 = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.4, 8), M.metalDark); tank2.position.set(0.24, 1.05, 0.2); g.add(tank2);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 6, 12), M.glowAmber); ring.rotation.x = Math.PI / 2; ring.position.set(-0.24, 1.2, -0.2); g.add(ring);
      const lamp = box(0.09, 0.09, 0.09, M.glowOff); lamp.position.set(0.35, 0.9, 0.35); g.add(lamp);
      m.animParts = { ring, lamp };
      return g;
    },
    chest(m){
      const g = new THREE.Group();
      const body = box(0.88, 0.8, 0.88, [M.chest, M.chest, M.chestTop, M.chest, M.chest, M.chest]); body.position.y = 0.4; g.add(body);
      m.animParts = { body };
      return g;
    },
    reactor(m){
      const g = new THREE.Group();
      const body = box(0.94, 1.0, 0.94, M.reactor); body.position.y = 0.5; g.add(body);
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), M.glowGreen); core.position.y = 1.15; g.add(core);
      const ringA = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 16), M.metal); ringA.position.y = 1.15; g.add(ringA);
      const ringB = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.025, 6, 16), M.metalDark); ringB.position.y = 1.15; ringB.rotation.x = Math.PI / 3; g.add(ringB);
      const light = new THREE.PointLight(0x66ff66, 0.7, 6); light.position.y = 1.2; g.add(light);
      m.animParts = { core, ringA, ringB, light };
      return g;
    },
    launchpad(m){
      const g = new THREE.Group();
      const pad = box(0.98, 0.16, 0.98, [M.metalDark, M.metalDark, M.launch, M.metalDark, M.metalDark, M.metalDark]); pad.position.y = 0.08; g.add(pad);
      const beacons = [];
      for (const [bx, bz] of [[-0.42,-0.42],[0.42,-0.42],[-0.42,0.42],[0.42,0.42]]){
        const b = box(0.08, 0.14, 0.08, M.glowAmber); b.position.set(bx, 0.23, bz); g.add(b); beacons.push(b);
      }
      m.animParts = { beacons };
      return g;
    },
  };

  // ---------- 传送带形状（类似轨道自动转弯/坡道）----------
  // shape: {turn: 0直行|-1左弯|1右弯, slope: 0平|1升向出口|-1从入口降下, inDir: 输入侧方向}
  function computeBeltShape(m){
    const d = m.dir;
    const bIdx = (d + 2) % 4, lIdx = (d + 3) % 4, rIdx = (d + 1) % 4;
    const nb = (idx, dy = 0) => at(m.x + DIRS[idx][0], m.y + dy, m.z + DIRS[idx][1]);
    // 谁在喂我：邻居的输出方向指向本格
    const feedsMe = (n, needDir) => n && n.type === 'belt' && n.dir === needDir;
    const behindFeeds = feedsMe(nb(bIdx), d) || (nb(bIdx) && nb(bIdx).type !== 'belt');   // 机器直喂视为直行
    const leftFeeds = feedsMe(nb(lIdx), rIdx);
    const rightFeeds = feedsMe(nb(rIdx), lIdx);
    let turn = 0, inDir = bIdx;
    if (!behindFeeds && leftFeeds && !rightFeeds){ turn = -1; inDir = lIdx; }
    else if (!behindFeeds && rightFeeds && !leftFeeds){ turn = 1; inDir = rIdx; }
    // 坡道（斜面永远渲染在低的那格，类 MC 轨道）
    let slope = 0;
    if (turn === 0){
      const [dx, dz] = DIRS[d];
      // 升坡：出口方向上方一格是传送带
      const upFwd = at(m.x + dx, m.y + 1, m.z + dz);
      if (upFwd && upFwd.type === 'belt' && !(nb(d) && nb(d).type === 'belt')) slope = 1;
      // 降坡：入口侧上方一格的传送带朝向本格（物品从上面下来）
      const [ix, iz] = DIRS[inDir];
      const upBack = at(m.x + ix, m.y + 1, m.z + iz);
      if (!slope && upBack && upBack.type === 'belt' && upBack.dir === d && !(nb(inDir) && nb(inDir).type === 'belt')) slope = -1;
    }
    return { turn, slope, inDir };
  }
  function beltTexMat(){
    const tex = Tex.tileTexture('belt').clone();
    tex.needsUpdate = true;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return new THREE.MeshLambertMaterial({ map: tex });
  }
  function rebuildBeltVisual(m, g){
    g = g || m.mesh;
    if (!g) return;
    while (g.children.length) g.remove(g.children[0]);
    m.shape = computeBeltShape(m);
    const { turn, slope, inDir } = m.shape;
    const railMat = M.metalDark;
    // 前进方向 → 本地 -Z 的水平旋转角
    const yawFor = d => -d * Math.PI / 2 - Math.PI / 2;

    if (turn !== 0){
      // ---- 弯道：入口半段 + 出口半段拼成 L 形（本地 -Z 为行进方向）----
      const beltIn = beltTexMat(), beltOut = beltTexMat();
      const outDir = m.dir;
      // 入口半段：从入口边缘(local z=+0.5) → 格心(0)，中心 z=+0.25
      const hIn = new THREE.Group();
      const segIn = box(0.98, 0.14, 0.52, [railMat, railMat, beltIn, railMat, railMat, railMat]);
      segIn.position.set(0, 0.07, 0.25);
      hIn.add(segIn);
      hIn.rotation.y = yawFor((inDir + 2) % 4);   // 行进方向 = 从入口边指向格心
      g.add(hIn);
      // 出口半段：从格心(0) → 出口边缘(local z=-0.5)，中心 z=-0.25
      const hOut = new THREE.Group();
      const segOut = box(0.98, 0.145, 0.52, [railMat, railMat, beltOut, railMat, railMat, railMat]);
      segOut.position.set(0, 0.072, -0.25);
      hOut.add(segOut);
      hOut.rotation.y = yawFor(outDir);
      g.add(hOut);
      // 外侧拐角护柱 + 中心指示灯
      const [dx, dz] = DIRS[outDir], [ix, iz] = DIRS[inDir];
      const post = box(0.12, 0.26, 0.12, railMat);
      post.position.set(-(ix + dx) * 0.42, 0.13, -(iz + dz) * 0.42);
      g.add(post);
      const lamp = box(0.1, 0.04, 0.1, M.glowAmber);
      lamp.position.set(0, 0.165, 0);
      g.add(lamp);
      m.animParts = { beltMat: beltIn, beltMat2: beltOut };
      return;
    }
    const beltMat = beltTexMat();
    if (slope === 0){
      const holder = new THREE.Group();
      const body = box(0.98, 0.14, 0.98, [railMat, railMat, beltMat, railMat, railMat, railMat]);
      body.position.y = 0.07;
      const railL = box(0.08, 0.2, 0.98, railMat); railL.position.set(-0.455, 0.1, 0);
      const railR = box(0.08, 0.2, 0.98, railMat); railR.position.set(0.455, 0.1, 0);
      holder.add(body); holder.add(railL); holder.add(railR);
      holder.rotation.y = yawFor(m.dir);
      g.add(holder);
    } else {
      // ---- 坡道（在低格内渲染 45° 斜面）----
      // slope=1：从入口边(低,0.07) 升至出口边(高,1.07)
      // slope=-1：从入口边(高,1.07) 降至出口边(低,0.07)
      const len = Math.sqrt(2) * 1.02;
      const holder = new THREE.Group();
      const body = box(0.98, 0.14, len, [railMat, railMat, beltMat, railMat, railMat, railMat]);
      body.rotation.x = slope === 1 ? Math.PI / 4 : -Math.PI / 4;
      body.position.y = 0.57;
      const railL = box(0.08, 0.18, len, railMat);
      railL.rotation.x = body.rotation.x;
      railL.position.set(-0.455, 0.6, 0);
      const railR = railL.clone(); railR.position.x = 0.455;
      // 高端支撑柱（在高的那一侧）
      const hiZ = slope === 1 ? -0.42 : 0.42;
      const legA = box(0.1, 1.0, 0.1, railMat); legA.position.set(-0.4, 0.5, hiZ);
      const legB = box(0.1, 1.0, 0.1, railMat); legB.position.set(0.4, 0.5, hiZ);
      holder.add(body); holder.add(railL); holder.add(railR); holder.add(legA); holder.add(legB);
      holder.rotation.y = yawFor(m.dir);
      g.add(holder);
    }
    m.animParts = { beltMat };
  }
  function refreshBeltsAround(x, y, z){
    for (let dy = -1; dy <= 1; dy++)
      for (const [ox, oz] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]){
        const n = at(x + ox, y + dy, z + oz);
        if (n && n.type === 'belt') rebuildBeltVisual(n);
      }
  }

  // ---------- 机器数据初始化 ----------
  function machineData(type){
    switch (type){
      case 'furnace':  return { in: null, fuel: null, out: null, prog: 0, burn: 0, burnMax: 0, recipe: null };
      case 'miner':    return { out: null, prog: 0, deposit: 0 };
      case 'belt':     return { items: [] };  // {item, t}
      case 'assembler':return { recipe: null, in: {}, out: null, prog: 0 };
      case 'refinery': return { recipe: null, in: {}, out: null, prog: 0 };
      case 'chest':    return { slots: new Array(24).fill(null) };
      case 'reactor':  return { fuel: 0 };
      case 'solar':    return {};
      case 'wind':     return {};
      case 'burner':   return { fuel: null, burn: 0, burnMax: 0 };
      case 'beacon':   return { label: '标记点' };
      case 'lumberbot':return { cargo: 0 };
      case 'collector':return { slots: new Array(12).fill(null) };
      case 'launchpad':return {};
      default: return {};
    }
  }
  const POWER_USE = { miner: 8, assembler: 12, refinery: 20 };
  const POWER_GEN = { solar: 10, reactor: 100, burner: 25 };

  // ---------- 放置 / 拆除 ----------
  function place(x, y, z, blockKey, dir){
    initMats();
    const def = BLOCKS[blockKey];
    const m = {
      x, y, z, type: def.machine, dir: dir || 0,
      data: machineData(def.machine), mesh: null, animParts: null, active: false
    };
    const builder = builders[m.type];
    if (builder){
      m.mesh = builder(m);
      m.mesh.position.set(x + 0.5, y, z + 0.5);
      if (m.type !== 'belt') m.mesh.rotation.y = -m.dir * Math.PI / 2 + Math.PI / 2;
      group.add(m.mesh);
      // 出生动画：从小弹出
      m.mesh.scale.set(0.01, 0.01, 0.01);
      m.spawnT = 0;
    }
    machines.set(key(x, y, z), m);
    World.set(x, y, z, def.id);
    refreshBeltsAround(x, y, z);
    return m;
  }
  function remove(x, y, z){
    const k = key(x, y, z);
    const m = machines.get(k);
    if (!m) return null;
    if (m.mesh) group.remove(m.mesh);
    if (m.bot && m.bot.mesh) group.remove(m.bot.mesh);   // 伐木机器人实体随桩拆除
    machines.delete(k);
    World.set(x, y, z, 0);
    refreshBeltsAround(x, y, z);
    return m;
  }
  function at(x, y, z){ return machines.get(key(x, y, z)); }

  // ---------- 物品插入 ----------
  function canMachineAccept(m, item){
    switch (m.type){
      case 'furnace': {
        if (FUEL_VALUE[item] && (!m.data.fuel || (m.data.fuel.item === item && m.data.fuel.n < 50))) return true;
        const r = RECIPES.find(r => r.where === 'furnace' && r.in[item]);
        if (!r) return false;
        if (m.data.in && m.data.in.item !== item) return false;
        if (m.data.in && m.data.in.n >= 50) return false;
        return true;
      }
      case 'chest': case 'collector':
        return m.data.slots.some(s => !s || (s.item === item && s.n < ITEMS[item].stack));
      case 'assembler': case 'refinery': {
        const r = m.data.recipe ? RECIPE_BY_ID[m.data.recipe] : null;
        if (!r || !r.in[item]) return false;
        return (m.data.in[item] || 0) < r.in[item] * 3;
      }
      case 'belt': return beltCanAccept(m, 0);
      case 'reactor': return item === 'uranium' && m.data.fuel < 300;
      case 'burner': return !!FUEL_VALUE[item] && (!m.data.fuel || (m.data.fuel.item === item && m.data.fuel.n < 50));
      default: return false;
    }
  }
  function machineInsert(m, item){
    switch (m.type){
      case 'furnace': {
        if (FUEL_VALUE[item] && (!m.data.fuel || m.data.fuel.item === item)){
          const rc = RECIPES.find(r => r.where === 'furnace' && r.in[item]);
          // 煤等既是燃料又可能是原料：优先按需分配——若当前配方原料匹配则进原料
          if (!(m.data.in && m.data.in.item === item) || (m.data.fuel && m.data.fuel.n < 8)){
            if (!m.data.fuel) m.data.fuel = { item, n: 0 };
            m.data.fuel.n++;
            return true;
          }
          if (rc){ if (!m.data.in) m.data.in = { item, n: 0 }; m.data.in.n++; return true; }
          if (!m.data.fuel) m.data.fuel = { item, n: 0 };
          m.data.fuel.n++;
          return true;
        }
        if (!m.data.in) m.data.in = { item, n: 0 };
        m.data.in.n++;
        return true;
      }
      case 'chest': case 'collector': {
        for (const s of m.data.slots){ if (s && s.item === item && s.n < ITEMS[item].stack){ s.n++; return true; } }
        for (let i = 0; i < m.data.slots.length; i++){ if (!m.data.slots[i]){ m.data.slots[i] = { item, n: 1 }; return true; } }
        return false;
      }
      case 'assembler': case 'refinery':
        m.data.in[item] = (m.data.in[item] || 0) + 1;
        return true;
      case 'belt': return beltInsert(m, item, 0);
      case 'reactor': m.data.fuel += 60; return true;
      case 'burner':
        if (!m.data.fuel) m.data.fuel = { item, n: 0 };
        m.data.fuel.n++;
        return true;
    }
    return false;
  }
  // 检测邻格是否为装配机/精炼厂的输入侧（皮带流向指向机器）
  function isInputFace(m, d){
    const [dx, dz] = DIRS[d];
    const nb = at(m.x + dx, m.y, m.z + dz) || at(m.x + dx, m.y - 1, m.z + dz);
    if (!nb || nb.type !== 'belt') return false;
    // 皮带终点指向机器所在格 → 输入侧
    const [bdx, bdz] = DIRS[nb.dir];
    return (m.x + dx + bdx === m.x && m.z + dz + bdz === m.z);
  }
  // 从机器任意邻格输出物品到 belt/chest/machine——装配/精炼防回流，其余机型不受限
  // 有方向的机器（所有正面朝外的机器都应遵守输入/输出分离）
  function hasDirection(m){ return m.type && m.dir !== undefined; }
  function tryOutput(m, item){
    const crafter = hasDirection(m);
    // 正面皮带输出（装配/精炼仅在不是输入面时才放行；其余机型无条件输出）
    const [fdx, fdz] = DIRS[m.dir];
    if (!crafter || !isInputFace(m, m.dir)){
      const fx = m.x + fdx, fz = m.z + fdz;
      let bt = at(fx, m.y, fz) || at(fx, m.y - 1, fz);
      if (bt && bt.type === 'belt' && beltInsert(bt, item, 0.1)) return true;
      if (bt && canMachineAccept(bt, item) && machineInsert(bt, item)) return true;
    }
    // 其余三面：仅入机器（装配/精炼检测输入面跳过；其余机型无条件尝试）
    for (let d = 0; d < 4; d++){
      if (d === m.dir) continue;
      if (crafter && isInputFace(m, d)) continue;
      const [dx, dz] = DIRS[d];
      const tx = m.x + dx, tz = m.z + dz;
      const t = at(tx, m.y, tz) || at(tx, m.y - 1, tz);
      if (!t) continue;
      if (t.type === 'belt' && !crafter && beltInsert(t, item, 0.1)) return true;   // 非装配/精炼：侧面也能接皮带
      if (canMachineAccept(t, item) && machineInsert(t, item)) return true;
    }
    return false;
  }
  // 正面输入侧也禁止皮带往机器推（beltTick 内调用）——输入归输入，不混进输出通道
  // beltDir = 皮带方向（物品流向）；next = 目标机器
  function isInputFaceForBelt(next, beltDir){
    if (!hasDirection(next)) return false;
    // 从皮带视角：beltDir 指向机器所在格（即机器从 non-dir 侧接收物品）
    const [bdx, bdz] = DIRS[beltDir];
    const mx = next.x, mz = next.z;
    // 反推皮带位置
    const bx = mx - bdx, bz = mz - bdz;
    // 机器的哪个面与皮带相邻？
    for (let d = 0; d < 4; d++){
      const [fdx, fdz] = DIRS[d];
      if (mx + fdx === bx && mz + fdz === bz) return d === next.dir;   // 正是正面 → 阻塞
    }
    return false;
  }
  // 禁止向正面输入侧的装配/精炼推入物品（beltTick 调用）
  function beltPushBlocked(next, beltDir){
    return isInputFaceForBelt(next, beltDir);
  }

  // ---------- 传送带 ----------
  const BELT_SPEED = 1.2, GAP = 0.28;
  function beltCanAccept(b, tStart){
    return !b.data.items.some(it => Math.abs(it.t - tStart) < GAP);
  }
  function beltInsert(b, item, tStart = 0){
    if (!beltCanAccept(b, tStart)) return false;
    b.data.items.push({ item, t: tStart });
    return true;
  }
  function beltTick(b, dt){
    const items = b.data.items;
    items.sort((a, c) => c.t - a.t);
    for (let i = 0; i < items.length; i++){
      const it = items[i];
      let maxT = i === 0 ? 1.0 : items[i - 1].t - GAP;
      it.t = Math.min(it.t + BELT_SPEED * dt, Math.max(maxT, it.t));
          if (it.t >= 0.999){
        // 传给下一个（跳过装配机/精炼厂的正面输出侧：防止刚输出的成品被皮带推回去）
        const [dx, dz] = DIRS[b.dir];
        const nx = b.x + dx, nz = b.z + dz;
        const next = at(nx, b.y, nz) || at(nx, b.y - 1, nz) || at(nx, b.y + 1, nz);
        if (next){
          if (next.type === 'belt'){
            // 直线或转弯
            if (beltInsert(next, it.item, 0)) { items.splice(i, 1); i--; continue; }
          } else if (canMachineAccept(next, it.item)){
            // 禁止向正面输入侧的装配/精炼推入（belt→machine 回流防护）
            if (!beltPushBlocked(next, b.dir)){
              machineInsert(next, it.item);
              items.splice(i, 1); i--; continue;
            }
          }
        }
      }
    }
  }

  // ---------- 机器 tick ----------
  function furnaceTick(m, dt){
    const d = m.data;
    // 燃烧
    if (d.burn <= 0 && d.fuel && d.fuel.n > 0 && d.in && d.in.n > 0){
      const r = RECIPES.find(r => r.where === 'furnace' && r.in[d.in.item]);
      if (r){
        d.burn = FUEL_VALUE[d.fuel.item] || 4;
        d.burnMax = d.burn;
        d.fuel.n--;
        if (d.fuel.n <= 0) d.fuel = null;
      }
    }
    m.active = false;
    if (d.burn > 0){
      d.burn -= dt;
      if (d.in && d.in.n > 0){
        const r = RECIPES.find(r => r.where === 'furnace' && r.in[d.in.item]);
        if (r){
          m.active = true;
          d.prog += dt / r.time;
          if (d.prog >= 1){
            d.prog = 0;
            const outItem = Object.keys(r.out)[0];
            const need = r.in[d.in.item];
            if (d.in.n >= need){
              d.in.n -= need;
              if (d.in.n <= 0) d.in = null;
              if (!d.out) d.out = { item: outItem, n: 0 };
              if (d.out.item === outItem) d.out.n += r.out[outItem];
            }
          }
        }
      } else d.prog = 0;
    } else d.prog = Math.max(0, d.prog - dt * 0.3);
    // 输出
    if (d.out && d.out.n > 0 && tryOutput(m, d.out.item)){
      d.out.n--;
      if (d.out.n <= 0) d.out = null;
    }
  }
  // ---------- 伐木机器人：SVG 建模悬浮机器人，自动巡林伐木 → 收集点卸货 ----------
  const BOT_SVG = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 80">',
    // 头盔+躯干一体（暗金属，圆润科幻轮廓）
    '<path fill="#2c333f" d="M20,6 Q32,-2 44,6 L46,20 Q48,28 43,32 L44,52 Q32,58 20,52 L21,32 Q16,28 18,20 Z"/>',
    // 目视传感器（青色发光条）
    '<path fill="#35e0e8" d="M23,12 L41,12 Q43,15.5 41,19 L23,19 Q21,15.5 23,12 Z"/>',
    // 胸部能量核心（橙色圆）
    '<path fill="#ff7a2a" d="M32,31.4 A4.6,4.6 0 1,1 31.9,40.6 A4.6,4.6 0 1,1 32,31.4 Z"/>',
    // 双肩甲
    '<path fill="#5c6a7a" d="M14,22 L21,20 L21,30 L15,30 Q13,26 14,22 Z"/>',
    '<path fill="#5c6a7a" d="M50,22 L43,20 L43,30 L49,30 Q51,26 50,22 Z"/>',
    // 腰部推进器基座
    '<path fill="#5c6a7a" d="M22,52 L42,52 L40,60 L24,60 Z"/>',
    // 喷口
    '<path fill="#ff7a2a" d="M26,60 L38,60 L34,70 Q32,72 30,70 Z"/>',
    '</svg>',
  ].join('');
  let _botTpl = null;
  function buildBotTemplate(){
    const g = new THREE.Group();
    let ok = false;
    if (typeof THREE.SVGLoader === 'function'){
      try {
        const data = new THREE.SVGLoader().parse(BOT_SVG);
        const mats = {
          '#2c333f': new THREE.MeshLambertMaterial({ color: 0x2c333f }),
          '#5c6a7a': new THREE.MeshLambertMaterial({ color: 0x5c6a7a }),
          '#35e0e8': new THREE.MeshBasicMaterial({ color: 0x35e0e8 }),
          '#ff7a2a': new THREE.MeshBasicMaterial({ color: 0xff7a2a }),
        };
        const depths = { '#2c333f': 18, '#5c6a7a': 20, '#35e0e8': 21, '#ff7a2a': 22 };
        const s = 0.0135;
        const wrap = new THREE.Group();
        for (const path of data.paths){
          const fill = path.userData.style.fill;
          const shapes = THREE.SVGLoader.createShapes(path);
          if (!shapes.length) continue;
          const depth = depths[fill] || 16;
          const geo = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false, curveSegments: 8 });
          geo.translate(-32, 0, -depth / 2);
          wrap.add(new THREE.Mesh(geo, mats[fill] || mats['#5c6a7a']));
        }
        wrap.scale.set(s, -s, s);       // SVG y 向下 → 世界 y 向上
        wrap.position.y = 1.02;
        g.add(wrap);
        ok = wrap.children.length > 0;
      } catch(e){ console.warn('[bot svg]', e); }
    }
    if (!ok){
      const body = box(0.42, 0.7, 0.3, M.metalDark); body.position.y = 0.62; g.add(body);
      const visor = box(0.3, 0.09, 0.32, M.glow); visor.position.y = 0.88; g.add(visor);
    }
    // 右臂旋转锯
    const arm = box(0.26, 0.07, 0.07, M.metal);
    arm.position.set(0.42, 0.55, 0); g.add(arm);
    const saw = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.04, 14), M.drillTip);
    saw.rotation.z = Math.PI / 2;
    saw.position.set(0.58, 0.55, 0);
    saw.name = 'saw';
    g.add(saw);
    // 悬浮喷焰
    const jet = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.34, 6),
      new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.75, depthWrite: false }));
    jet.rotation.x = Math.PI;
    jet.position.y = -0.12;
    jet.name = 'jet';
    g.add(jet);
    return g;
  }
  function buildBotMesh(){
    if (!_botTpl) _botTpl = buildBotTemplate();
    return _botTpl.clone();
  }
  // 扫描偏移表：由近及远的圆盘列坐标（工作半径 32 格）
  const BOT_RANGE = 32;
  const SCAN_OFFS = (() => {
    const a = [];
    for (let dx = -BOT_RANGE; dx <= BOT_RANGE; dx++)
      for (let dz = -BOT_RANGE; dz <= BOT_RANGE; dz++)
        if (dx * dx + dz * dz <= BOT_RANGE * BOT_RANGE) a.push([dx, dz]);
    a.sort((p, q) => (p[0] * p[0] + p[1] * p[1]) - (q[0] * q[0] + q[1] * q[1]));
    return a;
  })();
  function findLogInColumn(x, z){
    const gy = World.topAt(x, z);
    for (let y = gy; y > Math.max(1, gy - 12); y--){
      if (World.getDef(x, y, z).id === BLOCKS.log.id){
        let yy = y;
        while (yy > 1 && World.getDef(x, yy - 1, z).id === BLOCKS.log.id) yy--;
        return yy;   // 树干最底段
      }
    }
    return -1;
  }
  const _botV = new THREE.Vector3();
  const BOT_CARGO_FULL = 40;
  function lumberbotFrame(m, dt){
    const A = m.animParts;
    A.ring.rotation.z += dt * 1.6;
    if (!m.bot){
      m.bot = {
        pos: new THREE.Vector3(m.x + 0.5, m.y + 1.6, m.z + 0.5),
        state: 'scan', tx: 0, ty: 0, tz: 0,
        chopT: 0, scanIdx: 0, wait: 0, yaw: 0, bob: Math.random() * 9,
        mesh: buildBotMesh(),
      };
      group.add(m.bot.mesh);
      m.bot.saw = m.bot.mesh.getObjectByName('saw');
      m.bot.jet = m.bot.mesh.getObjectByName('jet');
    }
    const b = m.bot, d = m.data;
    b.bob += dt;
    const moveTo = (x, z) => {
      _botV.set(x - b.pos.x, 0, z - b.pos.z);
      const dist = _botV.length();
      if (dist > 0.05){
        b.yaw = Math.atan2(_botV.x, _botV.z);
        const step = Math.min(dist, 4.2 * dt);
        b.pos.x += _botV.x / dist * step;
        b.pos.z += _botV.z / dist * step;
      }
      const hover = World.topAt(Math.floor(b.pos.x), Math.floor(b.pos.z)) + 2.2;
      b.pos.y += (hover - b.pos.y) * Math.min(1, dt * 3.5);
      return dist;
    };
    const nearestCollector = () => {
      let best = null, bestD = 1e9;
      for (const c of machines.values()){
        if (c.type !== 'collector') continue;
        const dd = (c.x - m.x) * (c.x - m.x) + (c.z - m.z) * (c.z - m.z);
        if (dd < bestD){ bestD = dd; best = c; }
      }
      return best;
    };
    let sawSpin = 2.5;
    m.active = b.state === 'move' || b.state === 'chop' || b.state === 'deliver';
    switch (b.state){
      case 'scan': {
        moveTo(m.x + 0.5, m.z + 0.5);   // 悬停回桩
        for (let i = 0; i < 24 && b.scanIdx < SCAN_OFFS.length; i++, b.scanIdx++){
          const [dx, dz] = SCAN_OFFS[b.scanIdx];
          const y = findLogInColumn(m.x + dx, m.z + dz);
          if (y >= 0){
            b.tx = m.x + dx; b.ty = y; b.tz = m.z + dz;
            b.state = 'move';
            break;
          }
        }
        if (b.state === 'scan' && b.scanIdx >= SCAN_OFFS.length){
          b.scanIdx = 0;
          b.state = 'wait';
          b.wait = 5;   // 周围没有树：歇 5 秒再巡
        }
        break;
      }
      case 'move': {
        if (World.getDef(b.tx, b.ty, b.tz).id !== BLOCKS.log.id){ b.state = 'scan'; b.scanIdx = 0; break; }
        if (moveTo(b.tx + 0.5, b.tz + 0.5) < 1.5){ b.state = 'chop'; b.chopT = 0; }
        break;
      }
      case 'chop': {
        sawSpin = 26;
        if (World.getDef(b.tx, b.ty, b.tz).id !== BLOCKS.log.id){ b.state = 'scan'; b.scanIdx = 0; break; }
        b.yaw = Math.atan2(b.tx + 0.5 - b.pos.x, b.tz + 0.5 - b.pos.z);
        b.chopT += dt;
        if (Math.random() < dt * 6 && window.Player)
          Player.spawnParticles(b.tx + 0.25, b.ty + 0.4, b.tz + 0.25, 0x8a6b3f, 1);
        if (b.chopT >= 1.1){
          b.chopT = 0;
          World.set(b.tx, b.ty, b.tz, 0);
          d.cargo += 4;   // 碳素木每段 → 碳×4
          if (World.getDef(b.tx, b.ty + 1, b.tz).id === BLOCKS.log.id){
            b.ty++;   // 继续往上锯
          } else {
            // 树干锯完：整树奖励 + 清理树冠叶片（半数掉碳）
            d.cargo += 6;
            for (let dy = -1; dy <= 3; dy++)
              for (let ox = -2; ox <= 2; ox++)
                for (let oz = -2; oz <= 2; oz++){
                  if (World.getDef(b.tx + ox, b.ty + dy, b.tz + oz).id === BLOCKS.leaves.id){
                    World.set(b.tx + ox, b.ty + dy, b.tz + oz, 0);
                    if (Math.random() < 0.5) d.cargo++;
                  }
                }
            b.state = d.cargo >= BOT_CARGO_FULL ? 'deliver' : 'scan';
            b.scanIdx = 0;
          }
        }
        break;
      }
      case 'deliver': {
        const c = nearestCollector();
        if (!c){ b.state = 'wait'; b.wait = 3; break; }
        if (moveTo(c.x + 0.5, c.z + 0.5) < 1.6){
          let moved = false;
          while (d.cargo > 0 && machineInsert(c, 'carbon')){ d.cargo--; moved = true; }
          if (moved && window.Player) Player.spawnParticles(c.x + 0.25, c.y + 0.9, c.z + 0.25, 0x35e0e8, 4);
          b.state = d.cargo > 0 ? 'wait' : 'scan';   // 收集点满：等待重试
          b.wait = 2.5;
          b.scanIdx = 0;
        }
        break;
      }
      case 'wait': {
        moveTo(m.x + 0.5, m.z + 0.5);
        b.wait -= dt;
        if (b.wait <= 0) b.state = d.cargo >= BOT_CARGO_FULL ? 'deliver' : 'scan';
        break;
      }
    }
    // 满载优先卸货
    if (d.cargo >= BOT_CARGO_FULL && b.state === 'scan') b.state = 'deliver';
    // 可视更新：悬浮呼吸 + 朝向 + 锯片 + 喷焰
    b.mesh.position.copy(b.pos);
    b.mesh.position.y += Math.sin(b.bob * 2.4) * 0.08;
    b.mesh.rotation.y = b.yaw;
    if (b.saw) b.saw.rotation.x += dt * sawSpin;
    if (b.jet){
      b.jet.scale.set(1, 0.85 + Math.sin(b.bob * 14) * 0.25, 1);
    }
    // 桩状态灯：工作=绿 · 无收集点等待=琥珀闪
    A.lamp.material = (b.state === 'wait' && d.cargo >= BOT_CARGO_FULL)
      ? (Math.sin(b.bob * 6) > 0 ? M.glowAmber : M.glowOff) : M.glowGreen;
  }
  function collectorTick(m){
    const d = m.data;
    for (let i = 0; i < d.slots.length; i++){
      const s = d.slots[i];
      if (!s) continue;
      if (tryOutput(m, s.item)){
        s.n--;
        if (s.n <= 0) d.slots[i] = null;
      }
      break;   // 每 tick 最多输出 1 个
    }
  }

  function minerTick(m, dt, sat){
    const d = m.data;
    const below = World.getDef(m.x, m.y - 1, m.z);
    m.active = false;
    if (!below.ore) return;    // 无电力时以 35% 低速运行（应急手摇模式），有电则全速
    const eff = Math.max(sat, 0.35);
    m.active = true;
    d.prog += dt * 0.5 * eff;   // 2秒/矿 @满电
    if (d.prog >= 1){
      d.prog = 0;
      const drop = below.drops[0];
      if (!d.out) d.out = { item: drop.item, n: 0 };
      if (d.out.item !== drop.item) return;
      d.out.n++;
      d.deposit++;
      if (d.deposit >= 300){ World.set(m.x, m.y - 1, m.z, BLOCKS.stone.id); d.deposit = 0; }
    }
    if (d.out && d.out.n > 0 && tryOutput(m, d.out.item)){
      d.out.n--;
      if (d.out.n <= 0) d.out = null;
    }
  }
  function crafterTick(m, dt, sat, where){
    const d = m.data;
    m.active = false;
    const r = d.recipe ? RECIPE_BY_ID[d.recipe] : null;
    if (!r) return;
    const hasAll = Object.keys(r.in).every(k => (d.in[k] || 0) >= r.in[k]);
    // 断电（满足率过低）时不开工：材料留在格子里，不预先扣除
    if (d.prog > 0 || (hasAll && sat > 0.05)){
      if (d.prog === 0){
        for (const k in r.in) d.in[k] -= r.in[k];
      }
      m.active = sat > 0.05;
      d.prog += dt / r.time * sat;
      if (d.prog >= 1){
        d.prog = 0;
        const outItem = Object.keys(r.out)[0];
        if (!d.out) d.out = { item: outItem, n: 0 };
        if (d.out.item === outItem) d.out.n += r.out[outItem];
      }
    }
    if (d.out && d.out.n > 0 && tryOutput(m, d.out.item)){
      d.out.n--;
      if (d.out.n <= 0) d.out = null;
    }
  }

  // ---------- 主 tick ----------
  let windT = 0;
  function windPower(m){
    // 海拔越高风越大 + 阵风波动
    const alt = Math.max(0, m.y - World.SEA) * 0.18;
    const gust = Math.sin(windT * 0.5 + m.x * 0.7 + m.z * 1.3) * 3 + Math.sin(windT * 0.13) * 2;
    return THREE.MathUtils.clamp(6 + alt + gust, 2, 16);
  }
  function tick(dt, dayFactor){
    windT += dt;
    // 电力统计
    let gen = 0, use = 0;
    for (const m of machines.values()){
      if (m.type === 'solar') gen += POWER_GEN.solar * Math.max(0, dayFactor);
      if (m.type === 'wind'){ m.data.out = windPower(m); gen += m.data.out; m.active = true; }
      if (m.type === 'burner'){
        const d = m.data;
        if (d.burn <= 0 && d.fuel && d.fuel.n > 0){
          d.burn = (FUEL_VALUE[d.fuel.item] || 4) * 1.5;
          d.burnMax = d.burn;
          d.fuel.n--;
          if (d.fuel.n <= 0) d.fuel = null;
        }
        if (d.burn > 0){ d.burn -= dt; gen += POWER_GEN.burner; m.active = true; }
        else m.active = false;
      }
      if (m.type === 'reactor' && m.data.fuel > 0){ gen += POWER_GEN.reactor; m.data.fuel -= dt; m.active = true; }
      else if (m.type === 'reactor') m.active = false;
      if (POWER_USE[m.type]) use += POWER_USE[m.type];
    }
    const sat = use > 0 ? Math.min(1, gen / use) : 1;
    power = { gen: Math.round(gen), use, sat };

    for (const m of machines.values()){
      switch (m.type){
        case 'furnace': furnaceTick(m, dt); break;
        case 'miner': minerTick(m, dt, sat); break;
        case 'belt': beltTick(m, dt); break;
        case 'assembler': crafterTick(m, dt, sat, 'assembler'); break;
        case 'refinery': crafterTick(m, dt, sat, 'refinery'); break;
        case 'collector': collectorTick(m); break;
      }
    }
  }

  // ---------- 动画 ----------
  let animT = 0;
  const beltItemMeshes = [];
  const beltItemMatCache = {};
  function beltItemMat(item){
    if (beltItemMatCache[item]) return beltItemMatCache[item];
    const c = document.createElement('canvas'); c.width = 32; c.height = 32;
    c.getContext('2d').drawImage(Icons.get(item), 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
    const m = new THREE.SpriteMaterial({ map: t });
    beltItemMatCache[item] = m;
    return m;
  }
  function animate(dt){
    animT += dt;
    let itemIdx = 0;
    for (const m of machines.values()){
      if (!m.mesh) continue;
      // 出生弹出动画
      if (m.spawnT !== undefined){
        m.spawnT += dt * 3;
        const s = m.spawnT >= 1 ? 1 : 1 - Math.pow(1 - m.spawnT, 3);
        const over = m.spawnT < 1 ? 1 + Math.sin(m.spawnT * Math.PI) * 0.12 : 1;
        m.mesh.scale.setScalar(s * over);
        if (m.spawnT >= 1){ m.mesh.scale.setScalar(1); delete m.spawnT; }
      }
      const A = m.animParts;
      if (!A) continue;
      switch (m.type){
        case 'miner':
          if (m.active){
            A.drill.rotation.y += dt * 9;
            A.drill.position.y = 0.45 + Math.sin(animT * 8) * 0.06;
            A.lamp.material = M.glowGreen;
          } else {
            A.drill.rotation.y += dt * 0.4;
            A.lamp.material = World.getDef(m.x, m.y - 1, m.z).ore ? M.glowAmber : M.glowOff;
          }
          break;
        case 'furnace': {
          const on = m.active || m.data.burn > 0;
          A.body.material[4] = on ? M.furnaceOn : M.furnaceFront;
          A.light.intensity = on ? 0.8 + Math.sin(animT * 12) * 0.25 : 0;
          break;
        }
        case 'assembler':
          if (m.active){
            A.rotor.rotation.y += dt * 6;
            A.rotor.position.y = 0.8 + Math.sin(animT * 5) * 0.04;
            A.lamp.material = M.glowGreen;
            A.dome.emissiveIntensity = 0.7 + Math.sin(animT * 10) * 0.3;
          } else {
            A.rotor.rotation.y += dt * 0.5;
            A.lamp.material = m.data.recipe ? M.glowAmber : M.glowOff;
            A.dome.emissiveIntensity = 0.3;
          }
          break;
        case 'refinery':
          A.ring.rotation.z += dt * (m.active ? 4 : 0.3);
          A.lamp.material = m.active ? M.glowGreen : (m.data.recipe ? M.glowAmber : M.glowOff);
          break;
        case 'reactor':
          A.ringA.rotation.x += dt * (m.active ? 2 : 0.2);
          A.ringB.rotation.z += dt * (m.active ? 1.6 : 0.15);
          A.core.scale.setScalar(1 + Math.sin(animT * 6) * (m.active ? 0.15 : 0.03));
          A.light.intensity = m.active ? 0.9 + Math.sin(animT * 6) * 0.3 : 0.15;
          break;
        case 'solar':
          A.panel.rotation.z = 0.18 + Math.sin(animT * 0.5) * 0.04;
          break;
        case 'launchpad':
          A.beacons.forEach((b, i) => {
            b.material = (Math.sin(animT * 4 + i * Math.PI / 2) > 0) ? M.glowAmber : M.glowOff;
          });
          break;
        case 'wind': {
          const spd = 0.6 + (m.data.out || 6) * 0.28;
          A.rotor.rotation.z += dt * spd;
          break;
        }
        case 'burner': {
          const on = m.active;
          A.body.material[4] = on ? M.furnaceOn : M.furnaceFront;
          A.coil.material = on ? M.glowAmber : M.glowOff;
          A.light.intensity = on ? 0.7 + Math.sin(animT * 10) * 0.2 : 0;
          if (on){
            A.smokeT += dt;
            if (A.smokeT > 0.5){
              A.smokeT = 0;
              if (window.Player) Player.spawnParticles(m.x - 0.35, m.y + 1.5, m.z - 0.35, 0x555a60, 1);
            }
          }
          break;
        }
        case 'beacon': {
          // 顶灯脉冲 + 光柱呼吸
          const pulse = 0.5 + Math.sin(animT * 3 + m.x * 0.7) * 0.5;
          A.lamp.material = pulse > 0.5 ? M.glowAmber : M.glowOff;
          A.beamMat.opacity = 0.16 + pulse * 0.2;
          A.beam.scale.x = A.beam.scale.z = 0.9 + pulse * 0.25;
          A.light.intensity = 0.35 + pulse * 0.5;
          break;
        }
        case 'lumberbot':
          lumberbotFrame(m, dt);
          break;
        case 'collector':
          A.lamp.material = m.data.slots.some(s => s) ? M.glowGreen : M.glowOff;
          break;
        case 'belt': {
          if (A.beltMat) A.beltMat.map.offset.y = (A.beltMat.map.offset.y - dt * BELT_SPEED) % 1;          if (A.beltMat2) A.beltMat2.map.offset.y = (A.beltMat2.map.offset.y - dt * BELT_SPEED) % 1;
          const sh = m.shape || { turn: 0, slope: 0, inDir: (m.dir + 2) % 4 };
          const [dx, dz] = DIRS[m.dir];
          const [ix, iz] = DIRS[sh.inDir];   // 输入方向的“来向”偏移
          for (const it of m.data.items){
            let spr = beltItemMeshes[itemIdx];
            if (!spr){
              spr = new THREE.Sprite(beltItemMat(it.item));
              spr.scale.set(0.42, 0.42, 0.42);
              itemGroup.add(spr);
              beltItemMeshes.push(spr);
            }
            spr.material = beltItemMat(it.item);
            spr.visible = true;
            let px, py = m.y + 0.42, pz;
            if (sh.turn !== 0){
              // 四分之一圆弧：入口边中点 → 出口边中点
              const th = it.t * Math.PI / 2;
              const cxn = m.x + 0.5 + ix * 0.5 + dx * 0.5;   // 圆心（拐角）
              const czn = m.z + 0.5 + iz * 0.5 + dz * 0.5;
              px = cxn - dx * 0.5 * Math.cos(th) - ix * 0.5 * Math.sin(th);
              pz = czn - dz * 0.5 * Math.cos(th) - iz * 0.5 * Math.sin(th);
            } else {
              px = m.x + 0.5 + dx * (it.t - 0.5) * 0.96;
              pz = m.z + 0.5 + dz * (it.t - 0.5) * 0.96;
              if (sh.slope === 1) py += it.t;             // 低→高
              else if (sh.slope === -1) py += 1 - it.t;   // 高→低
            }
            spr.position.set(px, py, pz);
            itemIdx++;
          }
          break;
        }
      }
    }
    for (let i = itemIdx; i < beltItemMeshes.length; i++) beltItemMeshes[i].visible = false;
  }

  function update(dt, dayFactor){
    tickAcc += dt;
    while (tickAcc >= TICK){ tick(TICK, dayFactor); tickAcc -= TICK; }
    animate(dt);
  }

  // ---------- 存档 ----------
  function serialize(){
    const arr = [];
    for (const m of machines.values()){
      arr.push({ x: m.x, y: m.y, z: m.z, type: m.type, dir: m.dir, data: m.data });
    }
    return arr;
  }
  function deserialize(arr){
    reset();
    for (const s of arr){
      const blockKey = Object.keys(BLOCKS).find(k => BLOCKS[k].machine === s.type);
      const m = place(s.x, s.y, s.z, blockKey, s.dir);
      m.data = s.data;
      delete m.spawnT;
      if (m.mesh) m.mesh.scale.setScalar(1);
    }
  }
  function reset(){
    machines = new Map();
    if (group){ group.clear(); }
    if (itemGroup){ itemGroup.clear(); }
    beltItemMeshes.length = 0;
  }
  function init(scene){
    initMats();
    group = new THREE.Group();
    itemGroup = new THREE.Group();
    scene.add(group);
    scene.add(itemGroup);
  }

  return { init, place, remove, at, update, serialize, deserialize, reset,
    canMachineAccept, machineInsert,
    get power(){ return power; }, get machines(){ return machines; }, DIRS };
})();
window.Factory = Factory;
