/* ==========================================================================
   SPORE · stage_cell.js  —— 第一阶段：细胞
   俯视潮池 / 鼠标导航 / 食性决定能吃什么 / 部件驱动的攻击（刺·毒·电·喷射）
   陨石碎开解锁部件 / 攒 DNA 进编辑器 / 长到上限进化出四肢 → 生物阶段
   ========================================================================== */
SP.StageCell = function (game) {
  const U = SP.U, G = SP.Genome, DB = SP.DB, C = SP.DB.CELL;
  const self = this;

  let root = null, player = null, model = null;
  let foods = [], cells = [], meteors = [], particles = [];
  let size = C.startSize, growth = 0, hp = 30, maxHp = 30;
  let vx = 0, vz = 0, facing = 0;
  let atkCd = 0, dashCd = 0, shockCd = 0, poisonCd = 0, stun = 0;
  let eaten = 0, killed = 0;
  let hurtCd = 0, msgT = 0, spawnT = 0;
  const R = C.poolRadius;
  const ray = new THREE.Raycaster();
  const cursor = new THREE.Vector3();
  const PLANE_Y = 0;

  /* ------------------------------------------------------------ 材质 */
  const M = {};
  function initMats() {
    M.plant = new THREE.MeshStandardMaterial({ color: C.foods.plant.color, roughness: .45, emissive: 0x1a3a10, emissiveIntensity: .5 });
    M.meat = new THREE.MeshStandardMaterial({ color: C.foods.meat.color, roughness: .5, emissive: 0x3a0d0d, emissiveIntensity: .5 });
    M.rock = new THREE.MeshStandardMaterial({ map: SP.Tex.rock(1, 1), roughness: .95 });
    M.crystal = new THREE.MeshStandardMaterial({ color: 0x7ff0ff, roughness: .2, metalness: .3, emissive: 0x105a6a, emissiveIntensity: 1.2 });
    M.bubble = new THREE.SpriteMaterial({ map: SP.Tex.soft(), color: 0xbfeaff, transparent: true, opacity: .45, depthWrite: false });
    M.spark = new THREE.SpriteMaterial({ map: SP.Tex.glow(), color: 0x9ff0ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    M.poison = new THREE.SpriteMaterial({ map: SP.Tex.soft(), color: 0xb46cff, transparent: true, opacity: .5, depthWrite: false });
    M.blood = new THREE.SpriteMaterial({ map: SP.Tex.soft(), color: 0xff5a6a, transparent: true, opacity: .6, depthWrite: false });
  }

  /* ------------------------------------------------------------ 场景 */
  function buildPool() {
    // 池底
    const floorGeo = new THREE.CircleGeometry(R * 1.5, 64);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      map: SP.Tex.water(6, 6), color: 0x2a6f96, roughness: .8, metalness: .1
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -3.2;
    root.add(floor);

    // 池底暗环（营造深度）
    const vig = new THREE.Mesh(new THREE.RingGeometry(R * .88, R * 1.5, 64),
      new THREE.MeshBasicMaterial({ color: 0x04121c, transparent: true, opacity: .82, side: THREE.DoubleSide }));
    vig.rotation.x = -Math.PI / 2; vig.position.y = -2.6;
    root.add(vig);

    // 边界光环
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R, .3, 8, 90),
      new THREE.MeshBasicMaterial({ color: 0x3fe8ff, transparent: true, opacity: .35 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = -.2;
    root.add(ring);

    // 悬浮微粒
    const N = 500, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * U.TAU, r = Math.sqrt(Math.random()) * R;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = U.rand(-2.4, 2.2);
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dust = new THREE.Points(bg, new THREE.PointsMaterial({
      color: 0xaeeaff, size: .12, transparent: true, opacity: .55, depthWrite: false, sizeAttenuation: true
    }));
    root.add(dust);
    root.userData.dust = dust;

    // 装饰：水草
    for (let i = 0; i < 34; i++) {
      const a = Math.random() * U.TAU, r = U.rand(R * .3, R * .95);
      const g = new THREE.Group();
      const n = U.randi(3, 6);
      for (let k = 0; k < n; k++) {
        const h = U.rand(1.4, 3.6);
        const bl = new THREE.Mesh(new THREE.CapsuleGeometry(.08, h, 4, 6),
          new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(U.rand(.28, .42), .55, U.rand(.22, .38)), roughness: .85 }));
        bl.position.set(U.rand(-.5, .5), h / 2 - 3.1, U.rand(-.5, .5));
        bl.rotation.z = U.rand(-.3, .3);
        g.add(bl);
      }
      g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      g.userData.sway = U.rand(0, 9);
      root.add(g);
      if (!root.userData.weeds) root.userData.weeds = [];
      root.userData.weeds.push(g);
    }

    // 光照
    const hemi = new THREE.HemisphereLight(0x9fe4ff, 0x0a2436, 1.1); root.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d0, 1.5);
    sun.position.set(8, 22, 6); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 60;
    sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30;
    root.add(sun);
    const fill = new THREE.PointLight(0x3fe8ff, .8, 40); fill.position.set(0, 6, 0); root.add(fill);

    game.scene.fog = new THREE.FogExp2(0x0a3550, .012);
  }

  /* ------------------------------------------------------------ 食物 */
  function spawnFood(type, at) {
    const d = C.foods[type];
    const m = new THREE.Mesh(new THREE.SphereGeometry(d.size, 8, 6), type === 'plant' ? M.plant : M.meat);
    if (type === 'plant') {
      // 植物是几个小球串成的链
      const g = new THREE.Group();
      const n = U.randi(3, 5);
      for (let i = 0; i < n; i++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(d.size * U.rand(.7, 1.15), 7, 5), M.plant);
        b.position.set(U.rand(-.22, .22), U.rand(-.06, .06), U.rand(-.22, .22));
        g.add(b);
      }
      g.position.copy(at);
      root.add(g);
      foods.push({ type: type, mesh: g, pos: g.position, ph: U.rand(0, 9) });
      return;
    }
    m.scale.set(1, .7, 1.2);
    m.position.copy(at);
    root.add(m);
    foods.push({ type: type, mesh: m, pos: m.position, ph: U.rand(0, 9) });
  }
  function randPos(minR, maxR) {
    const a = Math.random() * U.TAU, r = U.rand(minR || 0, maxR || R * .95);
    return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
  }
  function fillFood() {
    let p = 0, m = 0;
    foods.forEach(f => { if (f.type === 'plant') p++; else m++; });
    while (p < C.foods.plant.count) { spawnFood('plant', randPos(2, R * .96)); p++; }
    while (m < C.foods.meat.count) { spawnFood('meat', randPos(2, R * .96)); m++; }
  }

  /* ------------------------------------------------------------ NPC 细胞 */
  function pickNpc() {
    let tot = 0; C.npcs.forEach(n => tot += n.w);
    let r = Math.random() * tot;
    for (const n of C.npcs) { r -= n.w; if (r <= 0) return n; }
    return C.npcs[0];
  }
  function spawnCell(def, at) {
    def = def || pickNpc();
    const gen = G.random('cell', Math.floor(Math.random() * 1e9));
    // 让外观与原型一致
    gen.parts[0].id = def.diet === 'plant' ? 'mouth_herb' : def.diet === 'meat' ? 'mouth_carn' : 'mouth_omni';
    if (def.part && def.part.indexOf('mouth') !== 0) {
      gen.parts.push({ id: def.part, seg: 1, side: 0, off: [0, .3, 0], scale: 1, rot: [0, 0, 0] });
    }
    const scale = def.size * 1.25;
    const mdl = G.build(gen, { scale: scale, simple: true });
    mdl.position.copy(at || randPos(R * .4, R * .96));
    root.add(mdl);
    cells.push({
      def: def, model: mdl, pos: mdl.position, size: def.size,
      hp: def.hp, maxHp: def.hp, dir: U.rand(0, U.TAU), speed: def.speed,
      wander: U.rand(0, 9), stun: 0, atkCd: U.rand(0, 2), part: def.part || null, gen: gen
    });
  }

  /* ------------------------------------------------------------ 陨石 */
  function spawnMeteor(at) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.DodecahedronGeometry(.85, 0), M.rock);
    core.castShadow = true; g.add(core);
    const partId = U.choice(C.meteorParts);
    for (let i = 0; i < 5; i++) {
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(U.rand(.14, .26), 0), M.crystal);
      const a = i / 5 * U.TAU;
      c.position.set(Math.cos(a) * .6, U.rand(-.2, .5), Math.sin(a) * .6);
      g.add(c);
    }
    g.position.copy(at || randPos(R * .35, R * .9));
    root.add(g);
    meteors.push({ mesh: g, pos: g.position, hp: 4, part: partId, ph: U.rand(0, 9) });
  }

  /* ------------------------------------------------------------ 粒子 */
  function particle(mat, at, scale, vel, life) {
    const s = new THREE.Sprite(mat.clone());
    s.position.copy(at); s.scale.setScalar(scale);
    root.add(s);
    particles.push({ s: s, vel: vel || new THREE.Vector3(), life: life, max: life });
  }
  function burst(mat, at, n, scale, spd) {
    for (let i = 0; i < n; i++) {
      particle(mat, at, scale * U.rand(.6, 1.3),
        new THREE.Vector3(U.rand(-1, 1), U.rand(-.4, .4), U.rand(-1, 1)).multiplyScalar(spd), U.rand(.4, .9));
    }
  }

  /* ------------------------------------------------------------ 玩家能力 */
  function has(id) { return game.genome.parts.some(p => p.id === id); }
  function playerStats() {
    const st = G.stats(game.genome);
    const diet = G.dietOf(game.genome);
    let spd = 5.2;
    if (has('cilia')) spd *= 1.22;
    if (has('flagella')) spd *= 1.4;
    spd /= (1 + (size - C.startSize) * .22);
    return { diet: diet, speed: spd, attack: 5 + (has('spike_cell') ? 6 : 0) + (has('mouth_carn') ? 3 : 0), armor: has('spike_cell') ? 2 : 0 };
  }
  function recomputeHp() {
    maxHp = Math.round(24 + size * 22 + (has('spike_cell') ? 10 : 0));
    hp = Math.min(hp <= 0 ? maxHp : hp, maxHp);
  }
  function rebuildPlayer() {
    if (model) { root.remove(model); G.dispose(model); }
    model = G.build(game.genome, { scale: size * 1.5 });
    model.position.copy(player);
    root.add(model);
    recomputeHp();
    refreshActions();
  }

  /* ------------------------------------------------------------ 攻击 */
  function doAttack() {
    if (stun > 0 || atkCd > 0) return;
    atkCd = .55;
    SP.Audio.play(has('spike_cell') ? 'bite' : 'bite', .8);
    const st = playerStats();
    const fx = Math.sin(facing), fz = Math.cos(facing);
    const tip = new THREE.Vector3(player.x + fx * size * 1.2, 0, player.z + fz * size * 1.2);
    burst(M.spark, tip, 4, .3, 2);
    let hit = false;
    cells.forEach(c => {
      if (c.hp <= 0) return;
      const d = c.pos.distanceTo(tip);
      if (d < size * 1.2 + c.size * 1.1) {
        damageCell(c, st.attack);
        hit = true;
      }
    });
    meteors.forEach(m => {
      if (m.hp <= 0) return;
      if (m.pos.distanceTo(tip) < size * 1.2 + 1.1) crackMeteor(m);
    });
    if (!hit) burst(M.bubble, tip, 3, .2, 1.4);
  }
  function doDash() {
    if (!has('jet') || dashCd > 0 || stun > 0) return;
    dashCd = 2.4;
    const st = playerStats();
    vx += Math.sin(facing) * st.speed * 3.2;
    vz += Math.cos(facing) * st.speed * 3.2;
    SP.Audio.play('jet');
    for (let i = 0; i < 10; i++) particle(M.bubble, player.clone().add(new THREE.Vector3(U.rand(-.4, .4), 0, U.rand(-.4, .4))), .35,
      new THREE.Vector3(-Math.sin(facing) * 3, 0, -Math.cos(facing) * 3), .6);
    refreshActions();
  }
  function doShock() {
    if (!has('electric') || shockCd > 0 || stun > 0) return;
    shockCd = 4.5;
    SP.Audio.play('shock');
    const ringM = new THREE.Mesh(new THREE.TorusGeometry(1, .12, 6, 30),
      new THREE.MeshBasicMaterial({ color: 0x7ff0ff, transparent: true, opacity: .9 }));
    ringM.rotation.x = Math.PI / 2; ringM.position.copy(player);
    root.add(ringM);
    particles.push({ s: ringM, vel: new THREE.Vector3(), life: .55, max: .55, grow: 12, ring: true });
    cells.forEach(c => {
      if (c.hp <= 0) return;
      if (c.pos.distanceTo(player) < 6.5 + size) { c.stun = 2.6; damageCell(c, 6); }
    });
    refreshActions();
  }
  function doPoison() {
    if (!has('poison_cell') || poisonCd > 0 || stun > 0) return;
    poisonCd = 3.6;
    SP.Audio.play('spit');
    const cloud = { pos: player.clone(), r: 4.2, life: 3.4 };
    for (let i = 0; i < 14; i++) particle(M.poison, player.clone().add(new THREE.Vector3(U.rand(-1.4, 1.4), 0, U.rand(-1.4, 1.4))), .9,
      new THREE.Vector3(U.rand(-.3, .3), 0, U.rand(-.3, .3)), 3.2);
    cells.forEach(c => {
      if (c.hp <= 0) return;
      if (c.pos.distanceTo(cloud.pos) < cloud.r + c.size) { c.poison = 3; c.stun = Math.max(c.stun, .6); }
    });
    refreshActions();
  }

  function damageCell(c, dmg) {
    c.hp -= dmg;
    burst(M.blood, c.pos, 4, .28, 2);
    game.ui.float3(c.pos, '-' + Math.round(dmg), 'dmg');
    SP.Audio.play('hurt', .5);
    if (c.hp <= 0) {
      killed++;
      root.remove(c.model); G.dispose(c.model);
      // 掉落肉块
      for (let i = 0; i < Math.max(1, Math.round(c.size * 3)); i++)
        spawnFood('meat', c.pos.clone().add(new THREE.Vector3(U.rand(-.8, .8), 0, U.rand(-.8, .8))));
      // 解锁部件
      if (c.part && !game.unlockedParts[c.part] && G.PARTS[c.part]) {
        game.unlockPart(c.part);
      }
      game.addDNA(4 + Math.round(c.size * 4));
      game.ui.float3(c.pos, '+DNA', 'dna');
      cells.splice(cells.indexOf(c), 1);
      if (killed === 30) game.ui.badge('cell_master');
    }
  }
  function crackMeteor(m) {
    m.hp--;
    burst(M.spark, m.pos, 6, .4, 3);
    SP.Audio.play('dig');
    if (m.hp <= 0) {
      SP.Audio.play('unlock');
      if (!game.unlockedParts[m.part]) game.unlockPart(m.part);
      else { game.addDNA(12); game.ui.toast('🧬 陨石里是重复的部件，转化为 12 DNA', ''); }
      game.addDNA(6);
      root.remove(m.mesh);
      m.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      meteors.splice(meteors.indexOf(m), 1);
      setTimeout(() => { if (root) spawnMeteor(); }, 20000);
    }
  }

  /* ------------------------------------------------------------ 进食 */
  function tryEat() {
    const st = playerStats();
    const mouthR = size * 1.15;
    const mx = player.x + Math.sin(facing) * size * .8;
    const mz = player.z + Math.cos(facing) * size * .8;
    for (let i = foods.length - 1; i >= 0; i--) {
      const f = foods[i];
      const dx = f.pos.x - mx, dz = f.pos.z - mz;
      if (dx * dx + dz * dz > mouthR * mouthR) continue;
      const ok = st.diet === 'both' || (st.diet === 'plant' && f.type === 'plant') || (st.diet === 'meat' && f.type === 'meat');
      if (!ok) {
        if (msgT <= 0) {
          msgT = 4;
          game.ui.toast(st.diet === 'plant' ? '🟢 你的草食嘴吃不了肉块 —— 在编辑器里换成肉食或杂食嘴' :
            '🔴 你的肉食嘴吃不了植物 —— 在编辑器里换成草食或杂食嘴', 'warn');
        }
        continue;
      }
      const nut = C.foods[f.type].nutrition;
      growth += nut * .055;
      game.addDNA(C.dnaPerFood);
      eaten++;
      hp = Math.min(maxHp, hp + 1.2);
      SP.Audio.play('eat', .55);
      burst(f.type === 'plant' ? M.spark : M.blood, f.pos, 3, .22, 1.6);
      root.remove(f.mesh);
      f.mesh.traverse ? f.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); }) : f.mesh.geometry.dispose();
      foods.splice(i, 1);
      if (eaten === 1) game.ui.badge('first_meal');
      const ns = Math.min(C.maxSize, C.startSize + growth);
      if (Math.abs(ns - size) > .02) { size = ns; rebuildPlayer(); }
      if (size >= C.maxSize - .001) checkEvolve();
    }
    // 吃掉小细胞
    for (let i = cells.length - 1; i >= 0; i--) {
      const c = cells[i];
      const d = c.pos.distanceTo(player);
      if (d > size * 1.3 + c.size * .8) continue;
      if (c.size < size * .72) {
        const ok = st.diet !== 'plant';
        if (!ok) continue;
        growth += c.size * .09;
        game.addDNA(3 + Math.round(c.size * 3));
        eaten++; killed++;
        SP.Audio.play('eat');
        burst(M.blood, c.pos, 6, .32, 2.4);
        if (c.part && !game.unlockedParts[c.part]) game.unlockPart(c.part);
        root.remove(c.model); G.dispose(c.model);
        cells.splice(i, 1);
        const ns = Math.min(C.maxSize, C.startSize + growth);
        if (Math.abs(ns - size) > .02) { size = ns; rebuildPlayer(); }
        if (size >= C.maxSize - .001) checkEvolve();
      }
    }
  }

  let evolveOffered = false;
  function checkEvolve() {
    if (evolveOffered) return;
    evolveOffered = true;
    game.paused = true;
    game.ui.dialog({
      title: '🧠 大 脑 形 成 了',
      body: '<p>你的细胞已经长到潮池能容纳的极限。神经组织聚成了一个真正的<b>大脑</b>，' +
        '身体两侧开始长出可以支撑体重的<b>肢芽</b>。</p><p>是时候爬上陆地了。</p>' +
        '<p style="opacity:.8">当前：吃掉 <b>' + eaten + '</b> 份食物 · 击杀 <b>' + killed + '</b> 个细胞 · DNA <b>' + game.dna + '</b></p>',
      buttons: [
        { label: '🦎 进化，爬上陆地', cb: () => { game.paused = false; game.advance('creature', { fromCell: true }); } },
        { label: '再在池子里待一会儿', cb: () => { game.paused = false; evolveOffered = false; } }
      ]
    });
  }

  /* ------------------------------------------------------------ HUD */
  function refreshActions() {
    const acts = [
      { key: '1', ico: '🦷', label: '攻击', desc: '用嘴或尖刺攻击面前的目标。也能敲开陨石。', cb: doAttack }
    ];
    if (has('jet')) acts.push({ key: '2', ico: '💨', label: '冲刺', desc: '喷射器：向前高速冲刺（冷却 2.4 秒）。', cb: doDash, off: dashCd > 0 });
    if (has('electric')) acts.push({ key: '3', ico: '⚡', label: '放电', desc: '电囊：麻痹周围一圈细胞（冷却 4.5 秒）。', cb: doShock, off: shockCd > 0 });
    if (has('poison_cell')) acts.push({ key: '4', ico: '🟣', label: '喷毒', desc: '毒囊：喷出毒雾，中毒的细胞会持续掉血（冷却 3.6 秒）。', cb: doPoison, off: poisonCd > 0 });
    acts.push({ key: '5', ico: '🧬', label: '编辑器', desc: '花 DNA 加装或更换部件（也可以按 E）。', cb: openEd });
    game.ui.setActions(acts);
  }
  function openEd() {
    game.ui.openEditor('cell', () => {
      rebuildPlayer();
      game.ui.toast('🧬 基因已更新', 'good');
    });
  }
  function refreshHud() {
    const st = playerStats();
    const diet = SP.DB.DIET_NAME[st.diet];
    game.ui.setHud(
      '<div class="card"><h4>细 胞 状 态</h4>' +
      '<div class="kv"><span>体型</span><b>' + size.toFixed(2) + ' / ' + C.maxSize.toFixed(1) + '</b></div>' +
      '<div class="kv"><span>食性</span><b>' + diet + '</b></div>' +
      '<div class="kv"><span>速度</span><b>' + st.speed.toFixed(1) + '</b></div>' +
      '<div class="kv"><span>攻击</span><b>' + st.attack + '</b></div>' +
      '<div class="kv"><span>已进食</span><b>' + eaten + '</b></div>' +
      '<div class="kv"><span>击杀</span><b>' + killed + '</b></div>' +
      '<div class="row">' + game.genome.parts.map(p => G.PARTS[p.id] ? '<span class="chip">' + G.PARTS[p.id].ico + G.PARTS[p.id].name + '</span>' : '').join('') + '</div>' +
      '</div>' +
      '<div class="card"><h4>潮 池 提 示</h4>' +
      '<div style="font-size:12px;line-height:1.7;opacity:.85">鼠标控制游动方向，' +
      '<b>左键</b>攻击，<b>E</b> 打开编辑器。<br>绿色是植物，红色是肉 —— 你的嘴决定能吃哪种。<br>' +
      '<b>比你大的细胞会吃你</b>，注意左下角生命。<br>撞开发光的陨石可以解锁新部件。</div></div>'
    );
  }

  /* ------------------------------------------------------------ enter / exit */
  this.enter = function (payload) {
    initMats();
    root = new THREE.Group();
    game.scene.add(root);
    if (game.genome.kind !== 'cell') game.genome = G.newCell();
    player = new THREE.Vector3(0, PLANE_Y, 0);
    size = C.startSize; growth = 0; eaten = 0; killed = 0;
    evolveOffered = false;
    foods = []; cells = []; meteors = []; particles = [];
    buildPool();
    fillFood();
    for (let i = 0; i < 14; i++) spawnCell(null, randPos(R * .35, R * .95));
    for (let i = 0; i < 5; i++) spawnMeteor();
    rebuildPlayer();
    hp = maxHp;

    game.camera.up.set(0, 0, -1);
    game.camera.fov = 52;
    game.camera.updateProjectionMatrix();
    game.wantsPointer = false;
    game.ui.setCrosshair(false);
    game.ui.setObjective('在潮池里<b>进食</b>并长大。<br>攒 <b>DNA</b> 去编辑器加装部件，' +
      '长到体型上限就能进化出四肢，<b>爬上陆地</b>。');
    game.ui.setProgress(0, '成长进度');
    refreshActions();
    refreshHud();
    SP.Audio.setAmbient('water_amb', .5);
  };

  this.exit = function () {
    if (root) { game.scene.remove(root); root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    root = null; model = null;
    foods = []; cells = []; meteors = []; particles = [];
    game.camera.up.set(0, 1, 0);
    SP.Audio.setAmbient('water_amb', 0);
  };

  /* ------------------------------------------------------------ 每帧 */
  this.update = function (dt) {
    const st = playerStats();
    atkCd = Math.max(0, atkCd - dt);
    dashCd = Math.max(0, dashCd - dt);
    shockCd = Math.max(0, shockCd - dt);
    poisonCd = Math.max(0, poisonCd - dt);
    stun = Math.max(0, stun - dt);
    hurtCd = Math.max(0, hurtCd - dt);
    msgT = Math.max(0, msgT - dt);

    /* --- 鼠标目标点 --- */
    ray.setFromCamera({ x: game.input.mouse.x, y: game.input.mouse.y }, game.camera);
    const dir = ray.ray.direction;
    if (Math.abs(dir.y) > 1e-5) {
      const t = (PLANE_Y - ray.ray.origin.y) / dir.y;
      if (t > 0) cursor.copy(ray.ray.origin).addScaledVector(dir, t);
    }

    /* --- 移动 --- */
    let ax = 0, az = 0;
    const K = game.input.keys;
    if (K.KeyW || K.ArrowUp) az -= 1;
    if (K.KeyS || K.ArrowDown) az += 1;
    if (K.KeyA || K.ArrowLeft) ax -= 1;
    if (K.KeyD || K.ArrowRight) ax += 1;
    if (ax === 0 && az === 0) {
      const dx = cursor.x - player.x, dz = cursor.z - player.z;
      const d = Math.hypot(dx, dz);
      if (d > .35) { ax = dx / d; az = dz / d; }
    } else {
      const l = Math.hypot(ax, az); ax /= l; az /= l;
    }
    if (stun > 0) { ax = 0; az = 0; }
    const acc = st.speed * 6;
    vx += ax * acc * dt; vz += az * acc * dt;
    const drag = Math.exp(-3.4 * dt);
    vx *= drag; vz *= drag;
    const sp = Math.hypot(vx, vz);
    const maxSp = st.speed * (has('jet') && dashCd > 2.0 ? 3 : 1);
    if (sp > maxSp) { vx = vx / sp * maxSp; vz = vz / sp * maxSp; }
    player.x += vx * dt; player.z += vz * dt;

    // 池壁
    const pr = Math.hypot(player.x, player.z);
    if (pr > R - size) {
      const k = (R - size) / pr;
      player.x *= k; player.z *= k;
      vx *= .4; vz *= .4;
    }
    if (sp > .3) facing = Math.atan2(vx, vz);

    if (model) {
      model.position.copy(player);
      model.rotation.y = facing;
      G.animate(model, game.time, { move: U.clamp(sp / Math.max(.1, st.speed), 0, 1), action: atkCd > .35 ? 'attack' : null, speed: 1.6 });
    }

    /* --- 左键攻击 --- */
    if (game.input.mouse.down0) doAttack();
    if (game.input.keys.KeyE) { game.input.keys.KeyE = false; openEd(); }

    tryEat();

    /* --- 食物漂浮 --- */
    foods.forEach(f => {
      f.mesh.position.y = Math.sin(game.time * 1.4 + f.ph) * .12;
      f.mesh.rotation.y += dt * .4;
    });

    /* --- NPC AI --- */
    for (let i = cells.length - 1; i >= 0; i--) {
      const c = cells[i];
      c.stun = Math.max(0, (c.stun || 0) - dt);
      c.atkCd = Math.max(0, c.atkCd - dt);
      if (c.poison > 0) {
        c.poison -= dt;
        c.hp -= dt * 3.5;
        if (U.chance(dt * 6)) particle(M.poison, c.pos.clone(), .4, new THREE.Vector3(0, .4, 0), .5);
        if (c.hp <= 0) { damageCell(c, 0); continue; }
      }
      const toP = new THREE.Vector3().subVectors(player, c.pos);
      const dP = toP.length();
      let tx = 0, tz = 0;
      const bigger = c.size > size * 1.15;
      const smaller = c.size < size * .8;

      if (c.stun > 0) { tx = 0; tz = 0; }
      else if (c.def.aggro > 0 && bigger && dP < 22) {
        // 追杀玩家
        tx = toP.x / dP; tz = toP.z / dP;
        if (dP < c.size + size + .6 && c.atkCd <= 0) {
          c.atkCd = 1.5;
          hurtPlayer(3 + c.size * 4, c);
        }
      } else if (smaller && dP < 14) {
        // 逃跑
        tx = -toP.x / dP; tz = -toP.z / dP;
      } else {
        // 找食物
        let best = null, bd = 14;
        for (let k = 0; k < foods.length; k += 3) {
          const f = foods[k];
          const okd = c.def.diet === 'both' || c.def.diet === f.type;
          if (!okd) continue;
          const d = f.pos.distanceTo(c.pos);
          if (d < bd) { bd = d; best = f; }
        }
        if (best) {
          const d = best.pos.clone().sub(c.pos).normalize();
          tx = d.x; tz = d.z;
          if (bd < c.size * 1.1) {
            root.remove(best.mesh);
            best.mesh.traverse ? best.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); }) : best.mesh.geometry.dispose();
            foods.splice(foods.indexOf(best), 1);
            c.hp = Math.min(c.maxHp, c.hp + 1);
          }
        } else {
          c.wander += dt;
          c.dir += Math.sin(c.wander * .8) * dt * 1.6;
          tx = Math.sin(c.dir); tz = Math.cos(c.dir);
        }
      }
      const spd = c.speed * (c.stun > 0 ? 0 : 1);
      c.pos.x += tx * spd * dt; c.pos.z += tz * spd * dt;
      const cr = Math.hypot(c.pos.x, c.pos.z);
      if (cr > R - c.size) { const k = (R - c.size) / cr; c.pos.x *= k; c.pos.z *= k; c.dir += 2.2; }
      if (tx || tz) c.model.rotation.y = Math.atan2(tx, tz);
      G.animate(c.model, game.time + i, { move: c.stun > 0 ? 0 : .8, speed: 1.4 });
      if (c.stun > 0 && U.chance(dt * 8)) particle(M.spark, c.pos.clone(), .25, new THREE.Vector3(0, .5, 0), .4);
    }

    /* --- 陨石 --- */
    meteors.forEach(m => {
      m.mesh.rotation.y += dt * .3;
      m.mesh.position.y = Math.sin(game.time * .9 + m.ph) * .18;
      if (m.pos.distanceTo(player) < 1.2 + size && sp > st.speed * .8) crackMeteor(m);
    });

    /* --- 补充生态 --- */
    spawnT -= dt;
    if (spawnT <= 0) {
      spawnT = 2.2;
      fillFood();
      if (cells.length < 16) spawnCell(null, randPos(R * .7, R * .95));
    }

    /* --- 粒子 --- */
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.s.position.addScaledVector(p.vel, dt);
      const k = U.clamp(p.life / p.max, 0, 1);
      if (p.ring) {
        p.s.scale.setScalar(p.s.scale.x + (p.grow || 6) * dt);
        p.s.material.opacity = k * .9;
      } else {
        p.s.material.opacity = k * .7;
      }
      if (p.life <= 0) {
        root.remove(p.s);
        if (p.s.geometry) p.s.geometry.dispose();
        particles.splice(i, 1);
      }
    }

    /* --- 水草摆动 --- */
    if (root.userData.weeds) root.userData.weeds.forEach((w, i) => {
      w.rotation.z = Math.sin(game.time * .8 + w.userData.sway) * .12;
    });
    if (root.userData.dust) root.userData.dust.rotation.y += dt * .02;

    /* --- 相机 --- */
    const camH = 15 + size * 5.5;
    game.camera.position.set(player.x, camH, player.z + camH * .12);
    game.camera.lookAt(player.x, 0, player.z);

    /* --- HUD --- */
    game.ui.setBars([
      { label: '生命', v: hp, max: maxHp, color: 'linear-gradient(90deg,#ff5f8f,#ffb0c4)' },
      { label: '成长', v: (size - C.startSize), max: (C.maxSize - C.startSize), color: 'linear-gradient(90deg,#8cf05a,#3fe8ff)' }
    ]);
    game.ui.setProgress((size - C.startSize) / (C.maxSize - C.startSize), '成长进度');
    if (Math.random() < dt * 2) refreshHud();
    if (Math.random() < dt * 3) refreshActions();
  };

  function hurtPlayer(dmg, from) {
    const st = playerStats();
    dmg = Math.max(1, dmg - st.armor);
    hp -= dmg;
    game.ui.flash();
    game.ui.float3(player, '-' + Math.round(dmg), 'dmg');
    SP.Audio.play('hurt');
    burst(M.blood, player.clone(), 5, .3, 2);
    // 尖刺反伤
    if (has('spike_cell') && from) damageCell(from, 4);
    if (hp <= 0) {
      hp = 0;
      game.die('你 被 吃 掉 了', '在潮池里，体型就是一切。<br>你吃掉了 <b>' + eaten + '</b> 份食物，' +
        '击杀 <b>' + killed + '</b> 个细胞。<br><span style="opacity:.75">重新孵化会保留你的 DNA 与已解锁部件。</span>',
        () => {
          hp = maxHp;
          player.set(0, PLANE_Y, 0);
          vx = vz = 0;
          growth = Math.max(0, growth - .25);
          size = Math.min(C.maxSize, C.startSize + growth);
          rebuildPlayer();
          // 清掉附近的大细胞，给个缓冲
          cells.slice().forEach(c => { if (c.pos.length() < 12 && c.size > size) { root.remove(c.model); G.dispose(c.model); cells.splice(cells.indexOf(c), 1); } });
        });
    }
  }

  /* ------------------------------------------------------------ 存档 */
  this.serialize = function () {
    return { size: size, growth: growth, hp: hp, eaten: eaten, killed: killed, pos: [player.x, player.z] };
  };
  this.deserialize = function (s) {
    if (!s) return;
    growth = s.growth || 0;
    size = Math.min(C.maxSize, s.size || C.startSize);
    eaten = s.eaten || 0; killed = s.killed || 0;
    if (s.pos) player.set(s.pos[0], PLANE_Y, s.pos[1]);
    rebuildPlayer();
    hp = s.hp || maxHp;
  };
};
