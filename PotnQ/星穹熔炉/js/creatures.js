/* ============================================================
   STARFORGE - creatures.js
   简单体素生物：生成 / 漫游 / 跟随地形 / 跳跃
   ============================================================ */
'use strict';

const Creatures = (() => {
  let group = null, list = [];
  let vGroup = null, villagers = [];        // 村民（独立分组：不参与刷新清理，不可被攻击）
  const spawnedVillages = new Set();
  let lastSpawnPos = null, spawnDist = 80;

  // 外部精模映射（CC0）：类型 → 模型名/朝向修正（使模型前方 = -Z）
  const GLB_MAP = {
    crab:    { name: 'crab', yaw: Math.PI },
    strider: { name: 'strider', yaw: Math.PI },
    blob:    { name: 'blob', yaw: 0 },
  };
  function buildCreature(typeDef, colors, typeKey){
    // 优先使用外部模型（按生态色染色），失败回退程序化体素生物
    const mm = GLB_MAP[typeKey];
    if (mm && window.ModelLib){
      const size = Math.max(typeDef.w, typeDef.h, typeDef.d) * 2.2;
      const glb = ModelLib.get(mm.name, size, { tint: colors.body, yaw: mm.yaw });
      if (glb){
        glb.userData.isGlb = true;
        return glb;
      }
    }
    const g = new THREE.Group();
    const { w, h, d } = typeDef;
    const bodyM = new THREE.MeshLambertMaterial({ color: colors.body });
    const legM = new THREE.MeshLambertMaterial({ color: colors.legs });
    const eyeM = new THREE.MeshBasicMaterial({ color: colors.eye });
    // 躯干
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyM);
    g.add(body);
    // 腿
    for (const [lx, lz] of [[-w * 0.35, -d * 0.4], [w * 0.35, -d * 0.4], [-w * 0.35, d * 0.4], [w * 0.35, d * 0.4]]){
      const leg = new THREE.Mesh(new THREE.BoxGeometry(w * 0.14, h * 0.45, w * 0.14), legM);
      leg.position.set(lx, -h / 2, lz);
      g.add(leg);
    }
    // 头/眼
    if (typeDef.headW > 0){
      const head = new THREE.Mesh(new THREE.BoxGeometry(typeDef.headW, h * 0.4, typeDef.headW), bodyM);
      head.position.set(0, h * 0.3, -d / 2);
      g.add(head);
      // 双眼
      for (const ex of [-typeDef.headW * 0.2, typeDef.headW * 0.2]){
        const eye = new THREE.Mesh(new THREE.SphereGeometry(typeDef.headW * 0.15, 4, 4), eyeM);
        eye.position.set(ex, h * 0.38, -d / 2 - typeDef.headW * 0.2);
        g.add(eye);
      }
    }
    return g;
  }

  function init(scene){
    group = new THREE.Group();
    scene.add(group);
    list = [];
    vGroup = new THREE.Group();
    scene.add(vGroup);
    villagers = [];
    spawnedVillages.clear();
    lastSpawnPos = null;
  }

  // ---------- 村民（SVG 建模·人形比例）：宜居星球村庄居民，可对话 ----------
  const VILLAGER_SVG = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 104">',
    // 头发
    '<path fill="#4a3018" d="M15,4 Q24,-2 33,4 L34,9 L14,9 Z"/>',
    // 脸 + 颈
    '<path fill="#e8c49a" d="M15,6 Q24,2 33,6 L33,15 Q24,19 15,15 Z"/>',
    '<path fill="#e8c49a" d="M21,15 L27,15 L27,20 L21,20 Z"/>',
    // 后脑头发（只贴在脑后，避免前后两张脸）
    '<path fill="#3e2814" d="M15,6 Q24,2 33,6 L33,15 Q24,19 15,15 Z"/>',
    // 眼睛（只在前脸）
    '<path fill="#2e2018" d="M19,9.5 L21.4,9.5 L21.4,12.4 L19,12.4 Z"/>',
    '<path fill="#2e2018" d="M26.6,9.5 L29,9.5 L29,12.4 L26.6,12.4 Z"/>',
    // 上衣（主色可换）
    '<path fill="#8a6b4a" d="M13,19 L35,19 Q38,20 38,26 L36,52 L12,52 L10,26 Q10,20 13,19 Z"/>',
    // 双臂（同主色）+ 双手
    '<path fill="#8a6b4a" d="M7,21 L13,20 L12,46 L6,45 Z"/>',
    '<path fill="#8a6b4a" d="M35,20 L41,21 L42,45 L36,46 Z"/>',
    '<path fill="#e8c49a" d="M6,45 L12,46 L11.5,52 L5.8,51 Z"/>',
    '<path fill="#e8c49a" d="M36,46 L42,45 L42.2,51 L36.5,52 Z"/>',
    // 腰带
    '<path fill="#c9963f" d="M12,52 L36,52 L36,56 L12,56 Z"/>',
    // 双腿（裤）
    '<path fill="#4a3c2e" d="M13,56 L22.4,56 L21.4,92 L14,92 Z"/>',
    '<path fill="#4a3c2e" d="M25.6,56 L35,56 L34,92 L26.6,92 Z"/>',
    // 靴
    '<path fill="#2e2620" d="M13.4,92 L21.6,92 L22,100 L12.4,100 Z"/>',
    '<path fill="#2e2620" d="M26.4,92 L34.6,92 L35.6,100 L26,100 Z"/>',
    '</svg>',
  ].join('');
  let _vilTpl = null;
  function buildVillagerTemplate(){
    const g = new THREE.Group();
    let ok = false;
    if (typeof THREE.SVGLoader === 'function'){
      try {
        const data = new THREE.SVGLoader().parse(VILLAGER_SVG);
        const mats = {};
        const depths = {
          '#4a3018': 13.5, '#e8c49a': 13, '#2e2018': 2.5, '#3e2814': 2.5,
          '#8a6b4a': 12, '#c9963f': 13, '#4a3c2e': 11, '#2e2620': 12,
        };
        // Z 向摆放：默认居中；眼睛只贴前脸(-Z)，后脑发只贴脑后(+Z)——不再前后两张脸
        const zOff = { '#2e2018': -7.3, '#3e2814': 5.0 };
        const s = 0.0172;   // 全高约 1.75 格：真人身形
        const wrap = new THREE.Group();
        for (const path of data.paths){
          const fill = path.userData.style.fill;
          const shapes = THREE.SVGLoader.createShapes(path);
          if (!shapes.length) continue;
          const depth = depths[fill] || 12;
          const geo = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false, curveSegments: 8 });
          geo.translate(-24, 0, zOff[fill] !== undefined ? zOff[fill] : -depth / 2);
          if (!mats[fill]) mats[fill] = fill === '#2e2018'
            ? new THREE.MeshBasicMaterial({ color: 0x2e2018 })
            : new THREE.MeshLambertMaterial({ color: new THREE.Color(fill) });
          wrap.add(new THREE.Mesh(geo, mats[fill]));
        }
        wrap.scale.set(s, -s, s);
        wrap.position.y = 100 * s;
        g.add(wrap);
        ok = wrap.children.length > 0;
      } catch(e){ console.warn('[villager svg]', e); }
    }
    if (!ok){
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 0.3), new THREE.MeshLambertMaterial({ color: 0x8a6b4a }));
      body.position.y = 0.9; g.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), new THREE.MeshLambertMaterial({ color: 0xe8c49a }));
      head.position.y = 1.68; g.add(head);
    }
    return g;
  }
  const VILLAGER_NAMES = ['老农全叔', '铁匠芒果', '采药人芸', '守望者白', '小豆豆', '织工兰', '猎户岩', '酿蜜人蓬', '陶匠小满', '游方商乌拉'];
  const ROBE_TINTS = [0x8a6b4a, 0x6a7a8a, 0x7a8a5a, 0x9a6a5a, 0x6a5a8a];
  function buildVillager(idx){
    if (!_vilTpl) _vilTpl = buildVillagerTemplate();
    const g = _vilTpl.clone();
    // 上衣+双臂整体换色（同色部件共享一份克隆材质，模板不受影响）
    let tintMat = null;
    g.traverse(o => {
      if (o.isMesh && o.material && o.material.color && o.material.color.getHex() === 0x8a6b4a){
        if (!tintMat){
          tintMat = o.material.clone();
          tintMat.color.setHex(ROBE_TINTS[idx % ROBE_TINTS.length]);
        }
        o.material = tintMat;
      }
    });
    return g;
  }
  function spawnVillages(plyPos){
    if (!vGroup || !World.structures) return;
    for (const st of World.structures){
      if (st.type !== 'village') continue;
      const key = st.x + ',' + st.z;
      if (spawnedVillages.has(key)) continue;
      const dx = plyPos.x - st.x, dz = plyPos.z - st.z;
      if (dx * dx + dz * dz > 150 * 150) continue;
      spawnedVillages.add(key);
      const rnd = mulberry32((st.x * 31 + st.z * 131) >>> 0);
      const n = 3 + ((rnd() * 3) | 0);
      for (let i = 0; i < n; i++){
        const g = buildVillager((rnd() * 10) | 0);
        const vx = st.x + (rnd() - 0.5) * 16, vz = st.z + (rnd() - 0.5) * 16;
        const foot = footOffset(g, { h: 1.4 });
        g.position.set(vx, World.topAt(Math.floor(vx), Math.floor(vz)) + 1 + foot, vz);
        g.userData = {
          villager: true, isGlb: true,
          name: VILLAGER_NAMES[(rnd() * VILLAGER_NAMES.length) | 0],
          home: { x: st.x, z: st.z },
          speed: 0.7 + rnd() * 0.5,
          dir: rnd() * Math.PI * 2,
          state: 'idle', timer: 1 + rnd() * 4,
          jumpVel: 0, onGround: true,
          typeDef: { speed: 0.8, jump: false }, animT: rnd() * 10, foot,
        };
        vGroup.add(g);
        villagers.push(g);
      }
    }
  }
  function nearestVillager(pos, maxD){
    let best = null, bestD = maxD || 3.6;
    for (const g of villagers){
      const d = g.position.distanceTo(pos);
      if (d < bestD){ bestD = d; best = g; }
    }
    return best ? { g: best, dist: bestD } : null;
  }

  // plyPos: Vector3, biome: 星球生态对象
  function update(dt, plyPos, biome){
    if (!group) return;
    spawnVillages(plyPos);   // 靠近村庄时生成村民（每村一次）
    const info = biome.animal;
    if (!info) return;

    // 只在玩家附近生成（太远则清理后重新生）
    const p = plyPos;
    if (lastSpawnPos && plyPos.distanceToSquared(lastSpawnPos) < 1600) return; // ~40m 内不刷新

    lastSpawnPos = plyPos.clone();
    // 清理旧生物
    group.clear();
    list = [];

    const typeDef = CREATURE_TYPES[info.type] || CREATURE_TYPES.strider;
    for (let i = 0; i < Math.min(info.count, 22); i++){
      const g = buildCreature(typeDef, { body: info.body, legs: info.legs, eye: info.eye }, info.type);
      // 贴地偏移：模型原点(躯干中心)到最低点（腿底）的距离，站在方块顶面(gy+1)上
      const foot = footOffset(g, typeDef);
      const ang = Math.random() * Math.PI * 2;
      const dist = 12 + Math.random() * spawnDist;
      const wx = p.x + Math.cos(ang) * dist, wz = p.z + Math.sin(ang) * dist;
      const gy = World.topAt(Math.floor(wx), Math.floor(wz));
      g.position.set(wx, gy + 1 + foot, wz);
      g.userData = {
        speed: typeDef.speed * (0.5 + Math.random()),
        dir: Math.random() * Math.PI * 2,
        state: 'idle', timer: 1 + Math.random() * 3,
        jumpVel: 0, onGround: true,
        typeDef, animT: Math.random() * 10, foot,
        hp: 4,
        radius: Math.max(0.55, Math.max(typeDef.w, typeDef.h, typeDef.d) * 1.3),
      };
      group.add(g);
      list.push(g);
    }
  }
  // 模型原点到最低点的距离（含微小离地悬浮，避免脚底穿插）
  const _fBox = new THREE.Box3();
  function footOffset(g, typeDef){
    _fBox.setFromObject(g);
    if (isFinite(_fBox.min.y)) return -_fBox.min.y + 0.06;
    return typeDef.h * 0.75;
  }

  // 每帧更新：AI 漫游 + 贴地 + 腿动画（野生生物 + 村民共用；村民漫游锚定村庄）
  function tick(dt, plyPos){
    for (const g of list) tickOne(g, dt, plyPos);
    for (const g of villagers) tickOne(g, dt, plyPos);
  }
  function tickOne(g, dt, plyPos){
    {
      const u = g.userData;
      u.animT += dt;
      u.timer -= dt;
      if (u.timer <= 0){
        if (u.state === 'idle'){
          u.state = 'walk';
          u.dir += (Math.random() - 0.5) * 1.5;
          u.timer = 2 + Math.random() * 5;
        } else {
          u.state = 'idle';
          u.timer = 1.5 + Math.random() * 3;
        }
      }
      // 移动
      if (u.state === 'walk'){
        const wx = g.position.x + Math.cos(u.dir) * u.speed * dt;
        const wz = g.position.z + Math.sin(u.dir) * u.speed * dt;
        if (u.villager){
          // 村民：漫游锚定村庄（离村心 14 格外折返）
          const hx = u.home.x - g.position.x, hz = u.home.z - g.position.z;
          if (hx * hx + hz * hz > 14 * 14) u.dir = Math.atan2(hz, hx);
        } else {
          // 野生生物：远处转向玩家
          const dx = plyPos.x - g.position.x, dz = plyPos.z - g.position.z;
          if (Math.sqrt(dx * dx + dz * dz) > 40){
            u.dir = Math.atan2(dz, dx);
          }
        }
        // 贴地
        const gy = World.topAt(Math.floor(wx), Math.floor(wz));
        const targetY = gy + 1 + u.foot;
        g.position.set(wx, THREE.MathUtils.lerp(g.position.y, targetY, dt * 6), wz);
        // 朝向：模型前方(-Z)对齐移动方向
        g.rotation.y = -u.dir - Math.PI / 2;
        // 跳跃
        if (u.typeDef.jump && u.onGround && Math.random() < 0.003){
          u.jumpVel = 6;
          u.onGround = false;
        }
      }
      // 重力
      if (!u.onGround || u.state === 'walk'){
        const below = World.topAt(Math.floor(g.position.x), Math.floor(g.position.z));
        if (g.position.y < below + 1 + u.foot){
          g.position.y = below + 1 + u.foot;
          u.onGround = true;
          u.jumpVel = 0;
        }
      }
      if (u.jumpVel > 0){
        u.jumpVel -= 20 * dt;
        g.position.y += u.jumpVel * dt;
      }
      if (g.userData.isGlb){
        // 精模：行走时轻微摇摆 + 步伐起伏
        const pivot = g.children[0];
        if (pivot){
          pivot.rotation.z = u.state === 'walk' ? Math.sin(u.animT * (4 + u.speed * 3)) * 0.07 : pivot.rotation.z * 0.9;
          pivot.rotation.x = u.state === 'walk' ? Math.sin(u.animT * (8 + u.speed * 3)) * 0.03 : 0;
        }
      } else {
        // 腿摆动（children: 0=躯干, 1..4=腿）
        const legBob = u.state === 'walk' ? Math.sin(u.animT * (2 + u.speed * 3)) * 0.35 : 0;
        for (let i = 1; i <= 4 && i < g.children.length; i++){
          const leg = g.children[i];
          if (leg && leg.geometry) leg.rotation.x = (i % 2 ? 1 : -1) * legBob;
        }
        // 待机呼吸
        if (u.state === 'idle' && g.children[0]){
          g.children[0].scale.y = 1 + Math.sin(u.animT * 2) * 0.03;
        }
      }
    }
  }

  function reset(){
    if (group) group.clear();
    list = [];
    if (vGroup) vGroup.clear();
    villagers = [];
    spawnedVillages.clear();
    lastSpawnPos = null;
  }

  // ---------- 激光武器交互：射线命中 / 受击逃窜 / 死亡掉落 ----------
  const _rv = new THREE.Vector3();
  function rayHit(origin, dir, maxDist){
    let best = null, bestT = maxDist;
    for (const g of list){
      _rv.copy(g.position).sub(origin);
      _rv.y -= (g.userData.radius || 0.8) * 0.4;   // 命中判定中心略高于脚底
      const t = _rv.dot(dir);
      if (t < 0.6 || t > bestT) continue;
      const r = g.userData.radius || 0.8;
      if (_rv.lengthSq() - t * t < r * r){ best = g; bestT = t; }
    }
    return best ? { g: best, dist: bestT } : null;
  }
  function damage(g, dmg, fromPos){
    const u = g.userData;
    if (u.hp === undefined) u.hp = 4;
    u.hp -= dmg;
    // 受击逃窜：背向攻击者加速跑
    u.state = 'walk';
    u.timer = 2.5 + Math.random() * 2;
    if (fromPos) u.dir = Math.atan2(g.position.z - fromPos.z, g.position.x - fromPos.x);
    u.speed = Math.max(u.speed, (u.typeDef.speed || 1) * 2.4);
    if (u.hp <= 0){ kill(g); return true; }
    return false;
  }
  function kill(g){
    const i = list.indexOf(g);
    if (i >= 0) list.splice(i, 1);
    group.remove(g);
    if (window.Player){
      Player.spawnParticles(g.position.x, g.position.y + 0.3, g.position.z, 0xd4544a, 14);
      Player.spawnDrop(g.position.x, g.position.y + 0.6, g.position.z, 'carbon', 1 + (Math.random() * 2 | 0));
    }
    Sound.play('breakBlk', 0.55);
  }

  return { init, update, tick, reset, rayHit, damage, nearestVillager };
})();
window.Creatures = Creatures;
