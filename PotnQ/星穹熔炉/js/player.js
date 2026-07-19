/* ============================================================
   STARFORGE - player.js
   第一人称控制 / 体素碰撞 / 采矿激光 / 放置 / 生存数值 / 背包
   ============================================================ */
'use strict';

const Player = (() => {
  // ---------- 状态 ----------
  const pos = new THREE.Vector3(96, 40, 96);
  const vel = new THREE.Vector3();
  let yaw = 0, pitch = 0;
  let onGround = false;
  const W = 0.3, H = 1.8, EYE = 1.62;

  // 生存
  const stats = {
    hp: 8, hpMax: 8,               // 生命（段）
    shield: 6, shieldMax: 6,       // 护盾（段）
    o2: 100, o2Max: 100,
    haz: 100, hazMax: 100,         // 危险防护
    jet: 100, jetMax: 100,
    laser: 100, laserMax: 100,     // 采矿激光能量
  };
  let credits = 0;
  let dead = false;

  // 背包：36 格（前9=快捷栏）；hotIdx=-1 表示选中固定栏位「采矿激光」
  const inv = new Array(36).fill(null);
  let hotIdx = -1;

  // 挖掘
  let mining = null;              // {x,y,z,prog}
  let breakMesh = null, hiliteMesh = null;
  let beamGroup = null, beamCore = null, beamOuter = null, impactGlow = null;
  let tool = null, toolMuzzle = null, muzzleGlow = null, toolScreen = null;
  let bobT = 0;
  let particles = [];
  let particleGroup = null;
  let lastStepT = 0, hazBeepT = 0;

  const isCreative = () => !!(window.Game && Game.creative);

  const keys = {};

  // ---------- 背包操作 ----------
  function countItem(item){
    let n = 0;
    for (const s of inv) if (s && s.item === item) n += s.n;
    return n;
  }
  function addItem(item, n = 1, silent){
    let left = n;
    const max = ITEMS[item].stack;
    for (const s of inv){
      if (s && s.item === item && s.n < max){
        const add = Math.min(left, max - s.n); s.n += add; left -= add;
        if (!left) break;
      }
    }
    if (left) for (let i = 0; i < inv.length; i++){
      if (!inv[i]){
        const add = Math.min(left, max);
        inv[i] = { item, n: add }; left -= add;
        if (!left) break;
      }
    }
    const added = n - left;
    if (added > 0 && !silent){
      UI.pickupToast(item, added);
      Sound.play('pickup');
    }
    if (added > 0) UI.refreshAll();
    return added;
  }
  function removeItem(item, n = 1){
    if (countItem(item) < n) return false;
    let left = n;
    for (let i = inv.length - 1; i >= 0; i--){
      const s = inv[i];
      if (s && s.item === item){
        const take = Math.min(left, s.n);
        s.n -= take; left -= take;
        if (s.n <= 0) inv[i] = null;
        if (!left) break;
      }
    }
    UI.refreshAll();
    return true;
  }
  function hasItems(costs){ return Object.keys(costs).every(k => countItem(k) >= costs[k]); }
  function payItems(costs){
    if (!hasItems(costs)) return false;
    for (const k in costs) removeItem(k, costs[k]);
    return true;
  }

  // ---------- 物品掉落实体（MC 式：落地悬浮旋转，靠近磁吸拾取）----------
  let dropGroup = null;
  let worldDrops = [];          // {item, n, mesh, baseY, vel, age, pickDelay}
  const dropMatCache = {};
  const dropGeo = new THREE.PlaneGeometry(0.46, 0.46);
  const _dTmp = new THREE.Vector3();
  function dropMat(item){
    if (!dropMatCache[item]){
      const t = new THREE.CanvasTexture(Icons.get(item));
      t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
      dropMatCache[item] = new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
    }
    return dropMatCache[item];
  }
  function solidAt(x, y, z){
    const def = World.getDef(Math.floor(x), Math.floor(y), Math.floor(z));
    return def && def.id !== 0 && !def.cross && !def.liquid;
  }
  function spawnDrop(x, y, z, item, n, vel, pickDelay){
    if (!dropGroup || n <= 0){ if (n > 0) addItem(item, n, true); return; }
    // 合并附近同类掉落
    for (const d of worldDrops){
      if (d.item === item && d.mesh.position.distanceToSquared(_dTmp.set(x, y, z)) < 1.2){
        d.n += n; d.age = 0;
        return;
      }
    }
    // 上限保护：超量时最旧的直接入包
    if (worldDrops.length >= 90){
      const old = worldDrops.shift();
      addItem(old.item, old.n, true);
      dropGroup.remove(old.mesh);
    }
    const mesh = new THREE.Mesh(dropGeo, dropMat(item));
    mesh.position.set(x, y, z);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    dropGroup.add(mesh);
    worldDrops.push({
      item, n, mesh, baseY: y,
      vel: vel || new THREE.Vector3((Math.random() - 0.5) * 2.2, 2.6, (Math.random() - 0.5) * 2.2),
      age: 0, pickDelay: pickDelay || 0.4,
    });
  }
  function canAccept(item){
    const max = ITEMS[item].stack;
    return inv.some(s => !s || (s.item === item && s.n < max));
  }
  function updateDrops(dt){
    for (let i = worldDrops.length - 1; i >= 0; i--){
      const d = worldDrops[i], p = d.mesh.position;
      d.age += dt;
      // 物理：重力 + 地面支撑
      if (d.vel.lengthSq() > 0.0001){
        d.vel.y -= 16 * dt;
        p.addScaledVector(d.vel, dt);
        if (d.vel.y < 0 && solidAt(p.x, p.y - 0.28, p.z)){
          p.y = Math.floor(p.y - 0.28) + 1 + 0.3;
          d.vel.set(0, 0, 0);
        }
        if (p.y < -8){ p.y = World.topAt(Math.floor(p.x), Math.floor(p.z)) + 0.4; d.vel.set(0, 0, 0); }
        d.baseY = p.y;
      } else {
        // 脚下被挖空 → 继续下落
        if (!solidAt(p.x, d.baseY - 0.4, p.z)) d.vel.y = -0.01;
        p.y = d.baseY + Math.sin(d.age * 2.2) * 0.06 + 0.06;   // 悬浮呼吸
      }
      d.mesh.rotation.y += dt * 1.6;
      // 磁吸 + 拾取（背包满则留在地上，隔 1.5s 后再试）
      if (d.noSpace){
        d.noSpaceT = (d.noSpaceT || 0) + dt;
        if (d.noSpaceT > 1.5) d.noSpace = false;
      } else if (d.age > d.pickDelay){
        const dist = _dTmp.copy(p).sub(pos).sub(_dTmp2.set(0, 1.0, 0)).length();
        if (dist < 6.5 && canAccept(d.item)){
          if (dist > 1.05){
            // 磁吸：飞向玩家胸口，越近越快（8~26 u/s），不会过冲
            const spd = Math.min(26, 8 + (6.5 - dist) * 4);
            p.addScaledVector(_dTmp, -Math.min(1, spd * dt / dist));
            d.vel.set(0, 0, 0);
            d.baseY = p.y;
          } else {
            const added = addItem(d.item, d.n);
            if (added >= d.n){
              dropGroup.remove(d.mesh);
              worldDrops.splice(i, 1);
              continue;
            } else if (added > 0) d.n -= added;
            else { d.noSpace = true; d.noSpaceT = 0; }
          }
        }
      }
      // 超时消散（4分钟）
      if (d.age > 240){
        dropGroup.remove(d.mesh);
        worldDrops.splice(i, 1);
      }
    }
  }
  const _dTmp2 = new THREE.Vector3();
  // G 键丢出：手持物品沿视线抛出（count 未定带 Shift 丢整组）
  function throwHeld(count){
    const s = inv[hotIdx];
    if (!s || !dropGroup) return;
    const n = Math.min(s.n, count || (keys['ShiftLeft'] ? s.n : 1));
    const dir = new THREE.Vector3(
      -Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    spawnDrop(
      pos.x + dir.x * 0.7, pos.y - 0.15 + dir.y * 0.5, pos.z + dir.z * 0.7,
      s.item, n,
      new THREE.Vector3(dir.x * 6, dir.y * 6 + 2.2, dir.z * 6),
      1.2);
    s.n -= n;
    if (s.n <= 0) inv[hotIdx] = null;
    Sound.play('uiClick');
    UI.refreshAll();
  }

  // ---------- 初始化视觉辅助 ----------
  function makeGlowTexture(inner, outer){
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, inner);
    g.addColorStop(0.35, outer);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    return t;
  }
  // 手持采矿多功能工具：SVG 建模（矢量轮廓挤出的能量步枪），SVGLoader 缺失时回退体素风
  const TOOL_SVG = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60">',
    // 枪口能量环（橙）
    '<path fill="#ff7a2a" d="M0,17 L6,16 L7,21.5 L7,24.5 L6,28 L0,27 Q-1,22 0,17 Z"/>',
    // 枪管（亮金属）+ 下导轨
    '<path fill="#9aa7b8" d="M5,19 L36,16.5 Q38,22 36,27.5 L5,25 Q4,22 5,19 Z"/>',
    '<path fill="#5c6a7a" d="M8,26 L32,28 L32,33 Q22,34 14,31.5 Q10,29.5 8,26 Z"/>',
    // 主机体（暗金属，斜切科幻轮廓）
    '<path fill="#2c333f" d="M30,13 L74,9 Q88,8 92,15 L95,26 Q95,31 89,33.5 L38,32 Q30,30 29,24 Q28.5,18 30,13 Z"/>',
    // 顶部散热鳍片
    '<path fill="#5c6a7a" d="M40,4.5 L46,4 L46,10.5 L40,11 Z"/>',
    '<path fill="#5c6a7a" d="M50,3.5 L56,3 L56,10 L50,10.5 Z"/>',
    '<path fill="#5c6a7a" d="M60,3 L66,3 L66,9.5 L60,9.7 Z"/>',
    '<path fill="#ff7a2a" d="M70,3.5 L75,4 L75,9.3 L70,9.2 Z"/>',
    // 能量导管（青，从核心通向枪管）
    '<path fill="#35e0e8" d="M12,20.4 L52,19 L52,23.4 L12,24 Z"/>',
    // 能量核心（青色圆，射击时变橙红）
    '<path fill="#35e0e8" d="M58,14 A8.2,8.2 0 1,1 57.9,30.4 A8.2,8.2 0 1,1 58,14 Z"/>',
    // 尾部电池组（橙饰）
    '<path fill="#ff7a2a" d="M92,13 L104,15.5 Q106,21 104,27 L94,29.5 Q96,21 92,13 Z"/>',
    // 握把（斜向后）
    '<path fill="#232830" d="M70,31 L85,32.5 L80.5,55 Q80,57.5 76.5,57.5 L70,56 Q67.5,43 70,31 Z"/>',
    // 扳机护圈
    '<path fill="#5c6a7a" d="M56,31.5 L69,32.3 L69,35.6 L59,35 Q57,33.5 56,31.5 Z"/>',
    '</svg>',
  ].join('');
  function buildToolSVG(g){
    if (typeof THREE.SVGLoader !== 'function') return false;
    const data = new THREE.SVGLoader().parse(TOOL_SVG);
    if (!data.paths.length) return false;
    const mats = {
      '#2c333f': new THREE.MeshLambertMaterial({ color: 0x2c333f }),
      '#232830': new THREE.MeshLambertMaterial({ color: 0x232830 }),
      '#5c6a7a': new THREE.MeshLambertMaterial({ color: 0x5c6a7a }),
      '#9aa7b8': new THREE.MeshLambertMaterial({ color: 0x9aa7b8 }),
      '#ff7a2a': new THREE.MeshLambertMaterial({ color: 0xff7a2a, emissive: 0x662200 }),
      '#35e0e8': new THREE.MeshBasicMaterial({ color: 0x35e0e8 }),
    };
    const depths = { '#2c333f': 15, '#232830': 12, '#5c6a7a': 9, '#9aa7b8': 11, '#ff7a2a': 10, '#35e0e8': 17 };
    const wrap = new THREE.Group();
    let core = null;
    for (const path of data.paths){
      const fill = path.userData.style.fill;
      const shapes = THREE.SVGLoader.createShapes(path);
      if (!shapes.length) continue;
      const depth = depths[fill] || 10;
      const geo = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: false, curveSegments: 10 });
      geo.translate(0, 0, -depth / 2);
      const mesh = new THREE.Mesh(geo, mats[fill] || mats['#5c6a7a']);
      if (fill === '#35e0e8') core = mesh;   // 能量核心/导管 = 状态屏（射击时变色）
      wrap.add(mesh);
    }
    if (core) toolScreen = core;
    const s = 0.0052;
    wrap.scale.set(s, -s, s);        // SVG y 向下 → 世界 y 向上
    wrap.rotation.y = -Math.PI / 2;  // 轮廓长轴对齐 -Z（枪口朝前）
    wrap.position.set(0, 0.115, -0.30);
    g.add(wrap);
    // 枪口
    toolMuzzle = new THREE.Object3D();
    toolMuzzle.position.set(0, 0.005, -0.34);
    g.add(toolMuzzle);
    return true;
  }
  function buildTool(){
    const g = new THREE.Group();
    let ok = false;
    try { ok = buildToolSVG(g); } catch(e){ console.warn('[tool svg]', e); }
    if (!ok){
      const metal = new THREE.MeshLambertMaterial({ map: Tex.tileTexture('metal_dark') });
      const metal2 = new THREE.MeshLambertMaterial({ map: Tex.tileTexture('metal') });
      const accent = new THREE.MeshLambertMaterial({ color: 0xc9641a });
      const B = (w, h, d, m, x, y, z) => {
        const mm = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
        mm.position.set(x, y, z); g.add(mm); return mm;
      };
      B(0.14, 0.16, 0.42, metal2, 0, 0, 0);                 // 主体
      B(0.10, 0.10, 0.34, metal, 0, 0.10, -0.06);           // 上部散热
      B(0.06, 0.06, 0.30, metal, 0, 0.01, -0.36);           // 枪管
      B(0.09, 0.09, 0.06, accent, 0, 0.01, -0.50);          // 枪口环
      B(0.05, 0.14, 0.10, metal, 0, -0.14, 0.10);           // 握把
      B(0.12, 0.04, 0.10, accent, 0, 0.10, 0.14);           // 尾部橙饰
      toolScreen = B(0.145, 0.06, 0.12, new THREE.MeshBasicMaterial({ color: 0x35e0e8 }), 0, 0.02, 0.08);
      toolMuzzle = new THREE.Object3D();
      toolMuzzle.position.set(0, 0.01, -0.54);
      g.add(toolMuzzle);
    }
    muzzleGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture('rgba(255,240,220,1)', 'rgba(255,90,60,0.8)'),
      blending: THREE.AdditiveBlending, depthTest: false, transparent: true
    }));
    muzzleGlow.scale.set(0.16, 0.16, 1);
    muzzleGlow.visible = false;
    toolMuzzle.add(muzzleGlow);
    return g;
  }
  function initVisuals(scene){
    particles = [];
    // 方块高亮框
    const hg = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    const edges = new THREE.EdgesGeometry(hg);
    hiliteMesh = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
    hiliteMesh.visible = false;
    scene.add(hiliteMesh);
    // 挖掘裂纹（黑色渐显盒）
    breakMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.004, 1.004, 1.004),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false })
    );
    breakMesh.visible = false;
    scene.add(breakMesh);
    // 激光束：外层辉光 + 白色核心
    beamGroup = new THREE.Group();
    beamGroup.visible = false;
    const coreGeo = new THREE.CylinderGeometry(0.016, 0.016, 1, 6, 1, true);
    const outerGeo = new THREE.CylinderGeometry(0.055, 0.035, 1, 6, 1, true);
    beamCore = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({
      color: 0xfff0e0, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.95, depthWrite: false
    }));
    beamOuter = new THREE.Mesh(outerGeo, new THREE.MeshBasicMaterial({
      color: 0xff4422, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.55, depthWrite: false
    }));
    beamGroup.add(beamCore); beamGroup.add(beamOuter);
    scene.add(beamGroup);
    // 命中点辉光
    impactGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture('rgba(255,255,240,1)', 'rgba(255,120,50,0.9)'),
      blending: THREE.AdditiveBlending, depthTest: false, transparent: true
    }));
    impactGlow.scale.set(0.55, 0.55, 1);
    impactGlow.visible = false;
    scene.add(impactGlow);
    // 手持工具挂到相机
    if (!tool){ tool = buildTool(); }
    if (!heldGroup){ heldGroup = new THREE.Group(); }
    initGhost(scene);
    particleGroup = new THREE.Group();
    scene.add(particleGroup);
    // 掉落物容器（换场景重建，旧掉落随场景废弃）
    worldDrops = [];
    dropGroup = new THREE.Group();
    scene.add(dropGroup);
  }
  function attachToolTo(camera){
    if (tool && tool.parent !== camera){
      camera.add(tool);
      tool.position.set(0.34, -0.32, -0.55);
      tool.rotation.set(0, 0.06, 0);
    }
    if (heldGroup && heldGroup.parent !== camera){
      camera.add(heldGroup);
      heldGroup.position.set(0.36, -0.34, -0.58);
      heldGroup.rotation.set(0.1, -0.5, 0);
    }
  }
  let viewModelVisible = true;
  function setToolVisible(v){
    viewModelVisible = v;
    if (tool) tool.visible = v;
    if (heldGroup) heldGroup.visible = v;
  }

  // ---------- 手持物品模型（MC 风格） ----------
  let heldGroup = null, heldKey = null, heldSwing = 0;
  const heldMeshCache = {};
  function buildHeldMesh(itemId){
    if (heldMeshCache[itemId]) return heldMeshCache[itemId];
    const item = ITEMS[itemId];
    let mesh;
    if (item && item.block && !BLOCKS[item.block].cross){
      // 方块：迷你立方体（按面贴图）
      const b = BLOCKS[item.block];
      const t = b.tiles;
      const face = name => new THREE.MeshLambertMaterial({ map: Tex.tileTexture(name) });
      const side = t.side || t.all || t.top;
      const mats = [
        face(side), face(side),
        face(t.top || t.all || side), face(t.bottom || t.all || side),
        face(t.front || side), face(side),
      ];
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), mats);
    } else {
      // 材料/植物：平面像素图（双面）
      const c = document.createElement('canvas'); c.width = 32; c.height = 32;
      c.getContext('2d').drawImage(Icons.get(itemId), 0, 0);
      const texI = new THREE.CanvasTexture(c);
      texI.magFilter = THREE.NearestFilter; texI.minFilter = THREE.NearestFilter;
      mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.4, 0.4),
        new THREE.MeshLambertMaterial({ map: texI, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide })
      );
    }
    heldMeshCache[itemId] = mesh;
    return mesh;
  }
  function refreshHeld(){
    if (!heldGroup) return;
    const sel = hotIdx >= 0 ? inv[hotIdx] : null;
    const key = sel ? sel.item : null;
    if (key === heldKey) return;
    heldKey = key;
    while (heldGroup.children.length) heldGroup.remove(heldGroup.children[0]);
    if (key) heldGroup.add(buildHeldMesh(key));
  }
  function swingHeld(){ heldSwing = 1; }

  // ---------- 放置虚影与转向（DSP/Factorio 风格）----------
  let ghostGroup = null, ghostBox = null, ghostEdge = null, ghostArrow = null;
  let placeDirOverride = null;      // null = 视线自动方向；R 键手动旋转
  function initGhost(scene){
    ghostGroup = new THREE.Group();
    ghostGroup.visible = false;
    ghostBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 1.0, 1.0),
      new THREE.MeshBasicMaterial({ color: 0x35e0e8, transparent: true, opacity: 0.22, depthWrite: false })
    );
    ghostGroup.add(ghostBox);
    ghostEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.0, 1.0, 1.0)),
      new THREE.LineBasicMaterial({ color: 0x35e0e8, transparent: true, opacity: 0.9 })
    );
    ghostGroup.add(ghostEdge);
    // 方向箭头（机器用）
    ghostArrow = new THREE.Group();
    const coneMat = new THREE.MeshBasicMaterial({ color: 0xffcf4d, transparent: true, opacity: 0.95, depthWrite: false });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 4), coneMat);
    cone.rotation.z = -Math.PI / 2;        // 指向 +X
    cone.position.x = 0.32;
    ghostArrow.add(cone);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.07), coneMat);
    tail.position.x = 0;
    ghostArrow.add(tail);
    ghostArrow.position.y = 0.75;
    ghostGroup.add(ghostArrow);
    scene.add(ghostGroup);
  }
  function autoDir(){
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    if (Math.abs(fx) > Math.abs(fz)) return fx > 0 ? 0 : 2;
    return fz > 0 ? 1 : 3;
  }
  function effectiveDir(){ return placeDirOverride === null ? autoDir() : placeDirOverride; }
  function cycleRot(){
    placeDirOverride = (effectiveDir() + 1) % 4;
    Sound.play('uiClick');
    UI.bigMessage('放置朝向', ['东 +X','南 +Z','西 -X','北 -Z'][placeDirOverride] + '（R 继续旋转 · 视线切换会保持）', 1200);
  }
  function placeTarget(camera){
    const sel = inv[hotIdx];
    const item = sel && ITEMS[sel.item];
    if (!item || !item.block) return null;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const hit = World.raycast(camera.position.clone(), dir, 6);
    if (!hit) return null;
    const px = hit.x + hit.face[0], py = hit.y + hit.face[1], pz = hit.z + hit.face[2];
    if (!World.inBounds(px, py, pz)) return null;
    let ok = World.getDef(px, py, pz).id === 0;
    if (px === Math.floor(pos.x) && pz === Math.floor(pos.z) && (py === Math.floor(pos.y) || py === Math.floor(pos.y + 1))) ok = false;
    return { px, py, pz, ok, item };
  }
  function updateGhostPreview(camera){
    if (!ghostGroup) return;
    if (Game.state !== 'planet' || UI.anyPanelOpen()){ ghostGroup.visible = false; return; }
    const t = placeTarget(camera);
    if (!t){ ghostGroup.visible = false; return; }
    ghostGroup.visible = true;
    const bDef = BLOCKS[t.item.block];
    const low = !!bDef.lowbox || bDef.machine === 'belt';
    ghostBox.scale.set(1, low ? 0.25 : 1, 1);
    ghostBox.position.y = low ? -0.375 : 0;
    ghostEdge.scale.copy(ghostBox.scale);
    ghostEdge.position.copy(ghostBox.position);
    ghostGroup.position.set(t.px + 0.5, t.py + 0.5, t.pz + 0.5);
    const col = t.ok ? 0x35e0e8 : 0xff4444;
    ghostBox.material.color.setHex(col);
    ghostEdge.material.color.setHex(col);
    // 呼吸闪烁
    ghostBox.material.opacity = 0.16 + Math.sin(performance.now() * 0.006) * 0.07;
    // 机器显示朝向箭头
    // 机器显示朝向箭头（全部机器）
    if (bDef.machine){
      ghostArrow.visible = true;
      const d = effectiveDir();
      ghostArrow.rotation.y = d === 0 ? 0 : d === 1 ? -Math.PI / 2 : d === 2 ? Math.PI : Math.PI / 2;
      ghostArrow.position.y = low ? -0.2 : 0.75;
    } else ghostArrow.visible = false;
  }

  // ---------- 粒子 ----------
  const particleMat = {};
  function spawnParticles(x, y, z, color, n = 10){
    if (!particleMat[color]) particleMat[color] = new THREE.MeshBasicMaterial({ color });
    for (let i = 0; i < n; i++){
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), particleMat[color]);
      p.position.set(x + Math.random(), y + Math.random(), z + Math.random());
      p.userData.vel = new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 4, (Math.random() - 0.5) * 4);
      p.userData.life = 0.5 + Math.random() * 0.4;
      particleGroup.add(p);
      particles.push(p);
    }
  }
  function updateParticles(dt){
    for (let i = particles.length - 1; i >= 0; i--){
      const p = particles[i];
      p.userData.life -= dt;
      if (p.userData.life <= 0){ particleGroup.remove(p); p.geometry.dispose(); particles.splice(i, 1); continue; }
      p.userData.vel.y -= 12 * dt;
      p.position.addScaledVector(p.userData.vel, dt);
      p.scale.setScalar(Math.max(0.1, p.userData.life));
    }
  }

  // ---------- 碰撞 ----------
  function collides(px, py, pz){
    const x0 = Math.floor(px - W), x1 = Math.floor(px + W);
    const y0 = Math.floor(py), y1 = Math.floor(py + H);
    const z0 = Math.floor(pz - W), z1 = Math.floor(pz + W);
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++){
          const d = World.getDef(x, y, z);
          if (!d.solid) continue;
          if (d.lowbox && py > y + 0.2) continue;   // 低矮机器：可站上
          return true;
        }
    return false;
  }

  // ---------- 每帧更新 ----------
  function update(dt, camera){
    if (dead) return;
    const biome = World.biome;
    updateDrops(dt);   // 掉落物：物理/磁吸/拾取

    // --- 移动 ---
    const speed = keys['ShiftLeft'] ? 7.2 : 4.5;
    const f = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const r = new THREE.Vector3(-f.z, 0, f.x);
    const wish = new THREE.Vector3();
    if (keys['KeyW']) wish.add(f);
    if (keys['KeyS']) wish.sub(f);
    if (keys['KeyD']) wish.add(r);
    if (keys['KeyA']) wish.sub(r);
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);
    const accel = onGround ? 12 : 5;
    vel.x += (wish.x - vel.x) * Math.min(1, accel * dt);
    vel.z += (wish.z - vel.z) * Math.min(1, accel * dt);

    // 跳跃 / 喷气背包
    if (isCreative()) stats.jet = stats.jetMax;
    if (keys['Space']){
      if (onGround){
        vel.y = 7.4;
        onGround = false;
        Sound.play('jump');
      } else if (stats.jet > 0){
        vel.y = Math.min(vel.y + 22 * dt, 6);
        stats.jet -= 28 * dt;
        Sound.loops.jet.start();
      }
    }
    if (!keys['Space'] || onGround || stats.jet <= 0) Sound.loops.jet.stop();
    if (onGround) stats.jet = Math.min(stats.jetMax, stats.jet + 40 * dt);

    vel.y -= 22 * dt;
    vel.y = Math.max(vel.y, -40);

    // 轴分离碰撞
    const wasGround = onGround;
    let np = pos.clone();
    np.x += vel.x * dt;
    if (collides(np.x, pos.y, pos.z)){ np.x = pos.x; vel.x = 0; }
    np.z += vel.z * dt;
    if (collides(np.x, pos.y, np.z)){ np.z = pos.z; vel.z = 0; }
    np.y = pos.y + vel.y * dt;
    onGround = false;
    if (collides(np.x, np.y, np.z)){
      if (vel.y < 0){
        onGround = true;
        // 坠落伤害
        if (vel.y < -14){ damage(Math.floor((-vel.y - 12) / 4)); }
        if (!wasGround && vel.y < -6) Sound.play('land');
      }
      np.y = pos.y;
      vel.y = 0;
      // 贴地校正
      while (collides(np.x, np.y, np.z)) np.y += 0.05;
    }
    pos.copy(np);
    // 无限世界：仅限制高度
    if (pos.y < -10){ pos.y = 80; damage(2); }

    // 脚步声
    if (onGround && wish.lengthSq() > 0){
      lastStepT += dt * (keys['ShiftLeft'] ? 1.6 : 1);
      if (lastStepT > 0.38){ lastStepT = 0; Sound.play('step', 0.8 + Math.random() * 0.4); }
    }

    // --- 生存消耗 ---
    if (!isCreative()){
      stats.o2 -= dt * 0.35;
      if (biome && biome.haz){
        stats.haz -= dt * biome.hazRate;
        if (stats.haz < 25){
          hazBeepT += dt;
          if (hazBeepT > 3){ hazBeepT = 0; Sound.play('hazBeep'); }
        }
      } else {
        stats.haz = Math.min(stats.hazMax, stats.haz + dt * 2);
      }
      if (stats.o2 <= 0){ stats.o2 = 0; damageTick(dt, 0.5); }
      if (stats.haz <= 0){ stats.haz = 0; damageTick(dt, 0.4); }
      // 护盾缓慢回复
      if (stats.o2 > 20 && stats.haz > 10) stats.shield = Math.min(stats.shieldMax, stats.shield + dt * 0.15);
    } else {
      stats.o2 = stats.o2Max; stats.haz = stats.hazMax;
      stats.shield = stats.shieldMax; stats.hp = stats.hpMax;
      stats.laser = stats.laserMax;
    }

    // --- 相机 ---
    camera.position.set(pos.x, pos.y + EYE, pos.z);
    camera.rotation.set(0, 0, 0);
    camera.rotateY(yaw);
    camera.rotateX(pitch);

    // --- 手持工具/物品动画 ---
    attachToolTo(camera);
    refreshHeld();
    const laserSelected = hotIdx === -1;
    if (tool) tool.visible = viewModelVisible && laserSelected;
    if (heldGroup) heldGroup.visible = viewModelVisible && !laserSelected && !!heldKey;
    const activeModel = laserSelected ? tool : heldGroup;
    if (activeModel && activeModel.visible){
      const moving = onGround && wish.lengthSq() > 0.5;
      bobT += dt * (moving ? (keys['ShiftLeft'] ? 11 : 8.5) : 1.6);
      const bobAmp = moving ? 0.014 : 0.004;
      const baseX = laserSelected ? 0.34 : 0.36;
      const baseY = laserSelected ? -0.32 : -0.34;
      let tx = baseX + Math.cos(bobT * 0.5) * bobAmp * 0.6;
      let ty = baseY + Math.abs(Math.sin(bobT * 0.5)) * bobAmp * 1.4;
      if (laserSelected && mineHeld && mining){
        tx += (Math.random() - 0.5) * 0.008;          // 开火震动
        ty += (Math.random() - 0.5) * 0.008;
        activeModel.rotation.x = -0.03 + (Math.random() - 0.5) * 0.02;
      } else if (!laserSelected){
        // 放置挥动动画
        heldSwing = Math.max(0, heldSwing - dt * 5);
        activeModel.rotation.x = 0.1 - Math.sin(heldSwing * Math.PI) * 0.7;
      } else {
        activeModel.rotation.x *= 0.9;
      }
      activeModel.position.x += (tx - activeModel.position.x) * Math.min(1, dt * 12);
      activeModel.position.y += (ty - activeModel.position.y) * Math.min(1, dt * 12);
      // 能量屏颜色：挖掘中橙红 / 待机青色呼吸
      if (laserSelected && toolScreen){
        if (mineHeld && mining) toolScreen.material.color.setHex(0xff6a33);
        else {
          const b = 0.7 + Math.sin(bobT * 0.8) * 0.3;
          toolScreen.material.color.setRGB(0.2 * b, 0.88 * b, 0.91 * b);
        }
      }
    }

    // --- 挖掘 ---
    updateMining(dt, camera);
    updateGhostPreview(camera);
    updateParticles(dt);
  }

  let dmgAcc = 0;
  function damageTick(dt, rate){
    dmgAcc += dt * rate;
    if (dmgAcc >= 1){ dmgAcc = 0; damage(1); }
  }
  function damage(n){
    if (dead || n <= 0 || isCreative()) return;
    Sound.play('hurt');
    const df = document.getElementById('damageFlash');
    df.classList.add('hit');
    setTimeout(() => df.classList.remove('hit'), 150);
    while (n > 0){
      if (stats.shield > 0){ stats.shield--; }
      else stats.hp--;
      n--;
    }
    if (stats.hp <= 0){ die(); }
  }
  function die(){
    dead = true;
    Sound.play('alarm');
    UI.bigMessage('信号丢失', '外骨骼将在重生点重建…物资保留');
    document.getElementById('fader').classList.add('show');
    setTimeout(() => {
      const sp = World.findSpawn();
      pos.copy(sp);
      vel.set(0, 0, 0);
      stats.hp = stats.hpMax; stats.shield = stats.shieldMax;
      stats.o2 = stats.o2Max; stats.haz = stats.hazMax;
      dead = false;
      document.getElementById('fader').classList.remove('show');
    }, 1800);
  }

  // ---------- 挖掘与放置 ----------
  let mineHeld = false, noLaserHintT = 0;
  const _beamDir = new THREE.Vector3(), _beamFrom = new THREE.Vector3(), _beamTo = new THREE.Vector3();
  const _yAxis = new THREE.Vector3(0, 1, 0);
  function updateMining(dt, camera){
    const laserSelected = hotIdx === -1;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const origin = camera.position.clone();
    const far = World.raycast(origin, dir, 22);              // 远程射线：光束在墙面截断
    const hit = far && far.dist <= 6 ? far : null;           // 6 格内才可挖掘

    // 高亮
    if (hit && Game.state === 'planet'){
      hiliteMesh.visible = true;
      hiliteMesh.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    } else hiliteMesh.visible = false;

    // 未选中激光却按着左键对方块：提示
    if (mineHeld && !laserSelected && hit && hit.def.hard !== Infinity && !UI.anyPanelOpen()){
      noLaserHintT += dt;
      if (noLaserHintT > 1.0){
        noLaserHintT = -1.5;
        Sound.play('uiError');
        UI.bigMessage('需要采矿激光', '按 0 或滚轮切换到固定栏位的激光枪', 1600);
      }
      mining = null; breakMesh.visible = false; beamGroup.visible = false; impactGlow.visible = false;
      if (muzzleGlow) muzzleGlow.visible = false;
      Sound.loops.laser.stop();
      return;
    }

    // 自由射击：选中激光按住左键即发射（可挖方块 / 攻击生物 / 对空放射）
    if (mineHeld && laserSelected && !UI.anyPanelOpen()){
      noLaserHintT = 0;
      // 生物命中：在方块之前则优先
      const cHit = (window.Creatures && Creatures.rayHit)
        ? Creatures.rayHit(origin, dir, far ? Math.min(far.dist, 22) : 22) : null;
      Sound.loops.laser.start();
      // ---- 光束终点 ----
      camera.updateMatrixWorld();
      if (toolMuzzle) toolMuzzle.getWorldPosition(_beamFrom);
      else _beamFrom.copy(origin).addScaledVector(dir, 0.5);
      if (cHit) _beamTo.copy(cHit.g.position).add(_dTmp2.set(0, cHit.g.userData.radius * 0.5 || 0.3, 0));
      else if (hit && hit.def.hard !== Infinity) _beamTo.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      else if (far) _beamTo.copy(origin).addScaledVector(dir, far.dist);
      else _beamTo.copy(origin).addScaledVector(dir, 22);
      _beamDir.copy(_beamTo).sub(_beamFrom);
      const len = Math.max(0.1, _beamDir.length());
      _beamDir.normalize();
      beamGroup.visible = true;
      beamGroup.position.copy(_beamFrom).addScaledVector(_beamDir, len / 2);
      beamGroup.quaternion.setFromUnitVectors(_yAxis, _beamDir);
      beamGroup.scale.set(1 + Math.random() * 0.3, len, 1 + Math.random() * 0.3);
      beamOuter.material.opacity = 0.4 + Math.random() * 0.3;
      beamCore.material.opacity = 0.8 + Math.random() * 0.2;
      // 枪口 & 命中点辉光
      if (muzzleGlow){
        muzzleGlow.visible = true;
        muzzleGlow.scale.setScalar(0.13 + Math.random() * 0.07);
      }
      impactGlow.visible = !!(cHit || hit || far);
      impactGlow.position.copy(_beamTo).addScaledVector(_beamDir, -0.32);
      impactGlow.scale.setScalar(0.4 + Math.random() * 0.3);
      // 激光能量：耗尽后效率大减
      let laserMul = 1;
      if (!isCreative()){
        stats.laser = Math.max(0, stats.laser - dt * (cHit || hit ? 1.8 : 0.9));
        if (stats.laser <= 0) laserMul = 0.25;
      }

      if (cHit){
        // ---- 攻击生物 ----
        mining = null;
        breakMesh.visible = false;
        shootT += dt;
        if (shootT > 0.28){
          shootT = 0;
          Sound.play('dig', 1.4 + Math.random() * 0.4);
          spawnParticles(_beamTo.x - 0.25, _beamTo.y, _beamTo.z - 0.25, 0xff6a55, 3);
          Creatures.damage(cHit.g, isCreative() ? 4 : laserMul < 1 ? 0.5 : 1, pos);
        }
      } else if (hit && hit.def.hard !== Infinity){
        // ---- 挖掘方块 ----
        if (!mining || mining.x !== hit.x || mining.y !== hit.y || mining.z !== hit.z){
          mining = { x: hit.x, y: hit.y, z: hit.z, prog: 0, sndT: 0, pT: 0 };
        }
        mining.prog += dt / hit.def.hard * (isCreative() ? 6 : laserMul);
        mining.sndT += dt;
        mining.pT += dt;
        if (mining.sndT > 0.22){ mining.sndT = 0; Sound.play('dig', 0.8 + Math.random() * 0.5); }
        // 挖掘中持续飞溅火花
        if (mining.pT > 0.12){
          mining.pT = 0;
          spawnParticles(hit.x + 0.25, hit.y + 0.25, hit.z + 0.25, 0xffaa55, 2);
        }
        breakMesh.visible = true;
        breakMesh.position.copy(hiliteMesh.position);
        breakMesh.material.opacity = mining.prog * 0.55;
        breakMesh.scale.setScalar(1 + Math.sin(mining.prog * 40) * 0.01);
        if (mining.prog >= 1){
          breakBlock(hit);
          mining = null;
        }
      } else {
        // ---- 对空/墙面自由放射 ----
        mining = null;
        breakMesh.visible = false;
        if (far && Math.random() < 0.4)
          spawnParticles(_beamTo.x - 0.25, _beamTo.y, _beamTo.z - 0.25, 0xffaa55, 1);
      }
    } else {
      mining = null;
      breakMesh.visible = false;
      beamGroup.visible = false;
      impactGlow.visible = false;
      if (muzzleGlow) muzzleGlow.visible = false;
      Sound.loops.laser.stop();
    }
  }
  let shootT = 0;
  function breakBlock(hit){
    const def = hit.def;
    Sound.play('breakBlk', def.ore ? 0.7 : 1);
    // 粒子颜色取贴图均色（简化：按类别）
    const colMap = { grass: 0x69b23f, dirt: 0x8a5f3c, stone: 0x8c8c8c, sand: 0xe0d29a, log: 0x6b502f, leaves: 0x3f7d2c };
    spawnParticles(hit.x, hit.y, hit.z, colMap[def.key] || 0x999999, 12);
    const cx = hit.x + 0.5, cy = hit.y + 0.5, cz = hit.z + 0.5;
    if (def.machine){
      const m = Factory.remove(hit.x, hit.y, hit.z);
      // 返还机器内部物品（掉落实体）
      if (m){
        const d = m.data;
        const give = (s) => { if (s && s.n > 0) spawnDrop(cx, cy, cz, s.item, s.n); };
        give(d.in); give(d.fuel); give(d.out);
        if (d.slots) d.slots.forEach(give);
        if (typeof d.cargo === 'number' && d.cargo > 0) spawnDrop(cx, cy, cz, 'carbon', d.cargo);
        if (d.in && typeof d.in === 'object' && !d.in.item)
          for (const k in d.in) if (typeof d.in[k] === 'number' && d.in[k] > 0) spawnDrop(cx, cy, cz, k, d.in[k]);
        if (d.items) d.items.forEach(it => spawnDrop(cx, cy, cz, it.item, 1));
      }
    } else {
      World.set(hit.x, hit.y, hit.z, 0);
      // 上方十字植物一并掉落
      const above = World.getDef(hit.x, hit.y + 1, hit.z);
      if (above.cross){
        dropsOf(above).forEach(d => spawnDrop(cx, cy + 1, cz, d.item, d.n * Game.dropMult));
        World.set(hit.x, hit.y + 1, hit.z, 0);
      }
    }
    dropsOf(def).forEach(d => spawnDrop(cx, cy, cz, d.item, d.n * Game.dropMult));
    Game.onBlockMined(def);
  }
  function dropsOf(def){
    const out = [];
    if (!def.drops) return out;
    for (const d of def.drops){
      if (d.chance && Math.random() > d.chance) continue;
      out.push(d);
    }
    return out;
  }

  function tryPlace(camera){
    const sel = inv[hotIdx];
    if (!sel) return;
    const t = placeTarget(camera);
    if (!t || !t.ok){ if (t && !t.ok) Sound.play('uiError'); return; }
    const { px, py, pz, item } = t;
    const bDef = BLOCKS[item.block];
    if (bDef.machine){
      Factory.place(px, py, pz, item.block, effectiveDir());
      Sound.play('machinePlace');
      if (item.block === 'beacon' && window.Game) window.Game.saveBeaconState();
      Game.onBlockPlaced(item.block);
    } else {
      World.set(px, py, pz, bDef.id);
      Sound.play('place');
      Game.onBlockPlaced(item.block);
    }
    if (!isCreative()){
      sel.n--;
      if (sel.n <= 0) inv[hotIdx] = null;
    }
    swingHeld();
    UI.refreshAll();
  }

  // 目视目标（供交互提示）
  function lookTarget(camera){
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    return World.raycast(camera.position.clone(), dir, 5);
  }

  // ---------- 装备充能（NMS 风格：用资源为系统充能）----------
  const CHARGE_DEFS = {
    laser:  { name: '采矿激光', item: 'carbon', cost: 3, gain: 30, stat: 'laser', max: 'laserMax', bar: true },
    shield: { name: '偏导护盾', item: 'sodium', cost: 2, gain: 2, stat: 'shield', max: 'shieldMax' },
    hp:     { name: '生命系统', item: 'oxygen', cost: 4, gain: 2, stat: 'hp', max: 'hpMax' },
    o2:     { name: '生命维持', item: 'oxygen', cost: 1, gain: 30, stat: 'o2', max: 'o2Max', bar: true },
    haz:    { name: '危险防护', item: 'sodium', cost: 1, gain: 25, stat: 'haz', max: 'hazMax', bar: true },
  };
  function canCharge(kind){
    const d = CHARGE_DEFS[kind];
    if (!d) return false;
    if (stats[d.stat] >= stats[d.max] - 0.01) return false;
    return countItem(d.item) >= d.cost;
  }
  function chargeStat(kind){
    const d = CHARGE_DEFS[kind];
    if (!canCharge(kind)) return false;
    removeItem(d.item, d.cost);
    stats[d.stat] = Math.min(stats[d.max], stats[d.stat] + d.gain);
    Sound.play('recharge');
    return true;
  }

  function recharge(kind){
    if (kind === 'haz' && countItem('sodium') > 0 && stats.haz < stats.hazMax - 5){
      removeItem('sodium', 1);
      stats.haz = Math.min(stats.hazMax, stats.haz + 25);
      Sound.play('recharge');
      return true;
    }
    if (kind === 'o2' && countItem('oxygen') > 0 && stats.o2 < stats.o2Max - 5){
      removeItem('oxygen', 1);
      stats.o2 = Math.min(stats.o2Max, stats.o2 + 30);
      Sound.play('recharge');
      return true;
    }
    return false;
  }

  function serialize(){
    return { pos: pos.toArray(), yaw, pitch, stats: { ...stats }, inv: inv.map(s => s ? { ...s } : null), hotIdx, credits };
  }
  function deserialize(d){
    pos.fromArray(d.pos); yaw = d.yaw; pitch = d.pitch;
    Object.assign(stats, d.stats);
    for (let i = 0; i < inv.length; i++) inv[i] = d.inv[i] ? { ...d.inv[i] } : null;
    hotIdx = d.hotIdx || 0;
    credits = d.credits || 0;
  }

  return {
    pos, vel, stats, inv,
    get yaw(){ return yaw; }, set yaw(v){ yaw = v; },
    get pitch(){ return pitch; }, set pitch(v){ pitch = v; },
    get hotIdx(){ return hotIdx; }, set hotIdx(v){ hotIdx = v; },
    get credits(){ return credits; }, set credits(v){ credits = v; },
    get mineHeld(){ return mineHeld; }, set mineHeld(v){ mineHeld = v; },
    get dead(){ return dead; },
    keys, update, initVisuals, tryPlace, lookTarget, recharge, damage, setToolVisible,
    chargeStat, canCharge, CHARGE_DEFS, cycleRot,
    addItem, removeItem, countItem, hasItems, payItems, throwHeld, spawnDrop,
    serialize, deserialize, spawnParticles,
    tickParticles(dt){ updateParticles(dt); }
  };
})();
window.Player = Player;
