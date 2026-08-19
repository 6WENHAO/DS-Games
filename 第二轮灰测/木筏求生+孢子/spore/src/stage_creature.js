/* ==========================================================================
   SPORE · stage_creature.js  —— 第二阶段：生物演化
   第三人称 3D / 程序化大陆 / 攻击(咬·冲·击·吐) 与 社交(唱·舞·魅·姿) 双路线
   物种巢穴与关系 / 结盟表演小游戏 / 队伍成员 / 骨骸解锁部件 / Epic 巨兽
   演化条填满 → 部落阶段
   ========================================================================== */
SP.StageCreature = function (game) {
  const U = SP.U, G = SP.Genome, DB = SP.DB, C = SP.DB.CREATURE;
  const self = this;

  let root = null, terrain = null, noise = null;
  let model = null, pos = new THREE.Vector3(), vel = new THREE.Vector3();
  let yaw = 0, camYaw = 0, camPitch = .22, camDist = 8;
  let hp = 100, maxHp = 100, hunger = 100, onGround = true;
  let evo = 0;                    // 演化进度（DNA 计）
  let markers = 0;                // 已达成刻度
  let cds = {}, target = null, actionT = 0, actionKind = null;
  let species = [], nests = [], foods = [], bones = [], props = [], packs = [];
  let epic = null, homeNest = null;
  let social = null;              // 结盟小游戏状态
  let dayT = 8, hudT = 0, msgT = 0;
  let killCount = 0, allyCount = 0;
  const SIZE = C.worldSize;
  const ray = new THREE.Raycaster();

  /* ------------------------------------------------------------ 材质 */
  const M = {};
  function initMats() {
    M.trunk = new THREE.MeshStandardMaterial({ map: SP.Tex.bark(1, 2), roughness: .95 });
    M.leaf = new THREE.MeshStandardMaterial({ color: 0x3f8f36, roughness: .9 });
    M.leaf2 = new THREE.MeshStandardMaterial({ color: 0x6ab04a, roughness: .9 });
    M.rock = new THREE.MeshStandardMaterial({ map: SP.Tex.rock(1, 1), roughness: .95 });
    M.bone = new THREE.MeshStandardMaterial({ color: 0xe8e0c8, roughness: .7 });
    M.fruit = new THREE.MeshStandardMaterial({ color: 0xff5a6a, roughness: .5, emissive: 0x2a0808 });
    M.meat = new THREE.MeshStandardMaterial({ color: 0xc2453f, roughness: .6 });
    M.water = new THREE.MeshStandardMaterial({ map: SP.Tex.water(14, 14), color: 0x2f86b8, roughness: .25, metalness: .15, transparent: true, opacity: .86 });
    M.nest = new THREE.MeshStandardMaterial({ map: SP.Tex.dirt(2, 2), roughness: .95 });
    M.egg = new THREE.MeshStandardMaterial({ color: 0xf2e6c8, roughness: .5 });
    M.spark = new THREE.SpriteMaterial({ map: SP.Tex.glow(), color: 0xfff0a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    M.blood = new THREE.SpriteMaterial({ map: SP.Tex.soft(), color: 0xff5a6a, transparent: true, opacity: .7, depthWrite: false });
    M.note = new THREE.SpriteMaterial({ map: SP.Tex.soft(), color: 0xa56cff, transparent: true, opacity: .8, depthWrite: false });
  }

  /* ------------------------------------------------------------ 地形 */
  function heightAt(x, z) {
    const d = Math.hypot(x, z) / (SIZE * .5);
    const fall = 1 - U.smooth(U.clamp((d - .45) / .55, 0, 1));
    const h = U.fbm(noise, x * .012, z * .012, 5, 2.1, .5) * 16 * fall
      + U.fbm(noise, x * .045 + 30, z * .045 - 20, 3, 2, .5) * 3.2 * fall;
    return h * fall + fall * 3.2 - 2.4;
  }
  function buildTerrain() {
    const seg = 150;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    const colors = new Float32Array(p.count * 3);
    const cSand = new THREE.Color(0xe0cb98), cGrass = new THREE.Color(0x5a9e40),
      cGrass2 = new THREE.Color(0x7fb84f), cRock = new THREE.Color(0x8a8880), cSnow = new THREE.Color(0xf0f6fa);
    const tmp = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const h = heightAt(x, z);
      p.setY(i, h);
      if (h < .5) tmp.copy(cSand);
      else if (h < 4) tmp.copy(cSand).lerp(cGrass, U.smooth(U.clamp((h - .5) / 3.5, 0, 1)));
      else if (h < 9) tmp.copy(cGrass).lerp(cGrass2, U.clamp((h - 4) / 5, 0, 1));
      else if (h < 14) tmp.copy(cGrass2).lerp(cRock, U.clamp((h - 9) / 5, 0, 1));
      else tmp.copy(cRock).lerp(cSnow, U.clamp((h - 14) / 4, 0, 1));
      tmp.offsetHSL(0, 0, U.rand(-.025, .025));
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      map: SP.Tex.grass(48, 48), vertexColors: true, roughness: .95
    }));
    terrain.receiveShadow = true;
    root.add(terrain);

    const sea = new THREE.Mesh(new THREE.PlaneGeometry(SIZE * 2.4, SIZE * 2.4), M.water);
    sea.rotation.x = -Math.PI / 2; sea.position.y = 0;
    root.add(sea);
    root.userData.sea = sea;
  }

  /* ------------------------------------------------------------ 装饰物 */
  function addTree(x, z) {
    const h = heightAt(x, z);
    const g = new THREE.Group();
    const th = U.rand(4, 9);
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(.25, .42, th, 7), M.trunk);
    tr.position.y = th / 2; tr.castShadow = true; g.add(tr);
    const n = U.randi(3, 5);
    for (let i = 0; i < n; i++) {
      const r = U.rand(1.4, 2.6);
      const c = new THREE.Mesh(new THREE.SphereGeometry(r, 9, 7), U.chance(.5) ? M.leaf : M.leaf2);
      c.position.set(U.rand(-1.3, 1.3), th + U.rand(-.4, 1.4), U.rand(-1.3, 1.3));
      c.castShadow = true; g.add(c);
    }
    g.position.set(x, h, z);
    root.add(g);
    props.push({ mesh: g, x: x, z: z, r: 1.0, kind: 'tree' });
  }
  function addRock(x, z) {
    const h = heightAt(x, z);
    const g = new THREE.Group();
    const n = U.randi(2, 5);
    let maxR = .6;
    for (let i = 0; i < n; i++) {
      const r = U.rand(.8, 2.4);
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), M.rock);
      m.position.set(U.rand(-1.4, 1.4), r * .4, U.rand(-1.4, 1.4));
      m.rotation.set(U.rand(0, 3), U.rand(0, 3), U.rand(0, 3));
      m.castShadow = true; m.receiveShadow = true; g.add(m);
      maxR = Math.max(maxR, r);
    }
    g.position.set(x, h, z);
    root.add(g);
    props.push({ mesh: g, x: x, z: z, r: maxR * .9, kind: 'rock' });
  }
  function addBone(x, z) {
    const h = heightAt(x, z);
    const g = new THREE.Group();
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, 3.4, 7), M.bone);
    spine.rotation.z = Math.PI / 2; spine.position.y = .2; g.add(spine);
    for (let i = -3; i <= 3; i++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(.55, .07, 5, 12, Math.PI), M.bone);
      rib.position.set(i * .45, .3, 0); rib.rotation.y = Math.PI / 2; g.add(rib);
    }
    const skull = new THREE.Mesh(new THREE.SphereGeometry(.55, 10, 8), M.bone);
    skull.scale.set(1.4, .9, .9); skull.position.set(2.1, .45, 0); g.add(skull);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: SP.Tex.glow(), color: 0xfff0a0, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(4); glow.position.y = 1.2; g.add(glow);
    g.position.set(x, h, z);
    g.rotation.y = U.rand(0, U.TAU);
    root.add(g);
    const part = U.choice(C.bonePool.filter(p => !game.unlockedParts[p])) || U.choice(C.bonePool);
    bones.push({ mesh: g, x: x, z: z, part: part, dug: false, glow: glow });
  }
  function addFood(x, z, kind) {
    const h = heightAt(x, z);
    const g = new THREE.Group();
    if (kind === 'fruit') {
      const bush = new THREE.Mesh(new THREE.SphereGeometry(1.1, 9, 7), M.leaf);
      bush.scale.y = .8; bush.position.y = .8; bush.castShadow = true; g.add(bush);
      for (let i = 0; i < 5; i++) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(.19, 7, 6), M.fruit);
        f.position.set(U.rand(-.9, .9), .8 + U.rand(-.4, .6), U.rand(-.9, .9));
        g.add(f);
      }
    } else {
      const m = new THREE.Mesh(new THREE.SphereGeometry(.5, 9, 7), M.meat);
      m.scale.set(1.4, .6, 1); m.position.y = .3; g.add(m);
      const b = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 1.1, 6), M.bone);
      b.rotation.z = 1.2; b.position.y = .35; g.add(b);
    }
    g.position.set(x, h, z);
    root.add(g);
    foods.push({ mesh: g, x: x, z: z, kind: kind, amount: kind === 'fruit' ? 5 : 3, t: 0 });
  }

  /* ------------------------------------------------------------ 巢穴与物种 */
  function makeSpecies(i, isHome) {
    const seed = 900 + i * 7717;
    const gen = isHome ? game.genome : G.random('creature', seed);
    const st = G.stats(gen);
    const ab = G.abilities(gen);
    return {
      id: i, name: isHome ? (game.genome.name || '我族') : gen.name,
      genome: gen, stats: st, ab: ab,
      rel: isHome ? 100 : U.randi(-30, 20),
      allied: !!isHome, home: isHome,
      allyProgress: 0, allyRounds: 0,
      color: [gen.skin.h, gen.skin.s, gen.skin.l],
      hostile: !isHome && U.chance(.35)
    };
  }
  function addNest(sp, x, z) {
    const h = heightAt(x, z);
    const g = new THREE.Group();
    const bowl = new THREE.Mesh(new THREE.TorusGeometry(3.2, 1.0, 8, 22), M.nest);
    bowl.rotation.x = Math.PI / 2; bowl.position.y = .5; bowl.receiveShadow = true; g.add(bowl);
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.2, .35, 20), M.nest);
    dish.position.y = .3; g.add(dish);
    for (let i = 0; i < 3; i++) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(.45, 10, 8), M.egg);
      e.scale.y = 1.25;
      const a = i / 3 * U.TAU;
      e.position.set(Math.cos(a) * .8, .7, Math.sin(a) * .8);
      e.castShadow = true; g.add(e);
    }
    // 标识颜色柱
    const totem = new THREE.Mesh(new THREE.ConeGeometry(.5, 3.4, 7),
      new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(sp.color[0] / 360, .7, .55), roughness: .6 }));
    totem.position.set(0, 2.2, -3.6); totem.castShadow = true; g.add(totem);
    g.position.set(x, h, z);
    root.add(g);
    const nest = { sp: sp, mesh: g, x: x, z: z, members: [] };
    nests.push(nest);
    if (sp.home) homeNest = nest;
    // 成员
    const n = sp.home ? 2 : U.randi(3, 5);
    for (let i = 0; i < n; i++) spawnCreature(sp, x + U.rand(-8, 8), z + U.rand(-8, 8), nest);
    return nest;
  }
  function spawnCreature(sp, x, z, nest, big) {
    const scale = (big ? 2.6 : 1) * U.rand(.92, 1.1);
    const mdl = G.build(sp.genome, { scale: scale, simple: true });
    const h = heightAt(x, z);
    mdl.position.set(x, h, z);
    root.add(mdl);
    const st = sp.stats;
    const c = {
      sp: sp, model: mdl, pos: mdl.position, nest: nest,
      hp: (big ? C.epicHp : st.health) * (big ? 1 : 1), maxHp: (big ? C.epicHp : st.health),
      dir: U.rand(0, U.TAU), speed: 3.4 * st.speed * (big ? 1.1 : 1),
      wander: U.rand(0, 9), state: 'wander', atkCd: 0, socialCd: 0, scale: scale,
      big: !!big, ally: false, pack: false, target: null, hitT: 0, perform: null, performT: 0
    };
    if (nest) nest.members.push(c);
    return c;
  }
  function allCreatures() {
    const out = [];
    nests.forEach(n => n.members.forEach(c => { if (c.hp > 0) out.push(c); }));
    if (epic && epic.hp > 0) out.push(epic);
    return out;
  }

  /* ------------------------------------------------------------ 能力 */
  function myAbilities() {
    const ab = G.abilities(game.genome);
    const list = [];
    G.COMBAT.forEach(k => { if (ab[k] > 0) list.push({ k: k, lv: ab[k], def: C.combat[k], type: 'combat' }); });
    G.SOCIAL.forEach(k => { if (ab[k] > 0) list.push({ k: k, lv: ab[k], def: C.social[k], type: 'social' }); });
    return list;
  }
  function refreshActions() {
    const list = myAbilities();
    const acts = list.map((a, i) => ({
      key: String(i + 1), ico: a.def.ico, label: a.def.name + ' ' + a.lv,
      desc: a.def.desc + '<br><b>' + (a.type === 'combat' ? '伤害 ' + a.def.dmg[a.lv - 1] : '社交力 ' + a.def.pow[a.lv - 1]) +
        '</b> · 射程 ' + a.def.range + ' · 冷却 ' + a.def.cd + 's',
      off: (cds[a.k] || 0) > 0,
      cb: () => useAbility(a)
    }));
    acts.push({ key: '9', ico: '🦴', label: '挖掘/交互', desc: '靠近骨骸挖掘可解锁部件；在自己巢穴上可交配并打开编辑器。（也可以按 E）', cb: interact });
    game.ui.setActions(acts);
  }

  function pickTarget(range) {
    let best = null, bs = -1;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    allCreatures().forEach(c => {
      const dx = c.pos.x - pos.x, dz = c.pos.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d > range) return;
      const dot = (dx / d) * fx + (dz / d) * fz;
      if (dot < .35) return;
      const s = dot * 2 - d / range;
      if (s > bs) { bs = s; best = c; }
    });
    return best;
  }

  function useAbility(a) {
    if ((cds[a.k] || 0) > 0) { SP.Audio.play('deny'); return; }
    cds[a.k] = a.def.cd;
    actionT = .55; actionKind = a.type === 'combat' ? 'attack' : 'social';
    const t = pickTarget(a.def.range);
    if (a.type === 'combat') {
      SP.Audio.play(a.k === 'spit' ? 'spit' : a.k === 'charge' ? 'roar' : 'bite');
      if (a.k === 'charge') {
        vel.x += Math.sin(yaw) * 22; vel.z += Math.cos(yaw) * 22;
      }
      if (a.k === 'spit') {
        // 投射物
        const p = new THREE.Mesh(new THREE.SphereGeometry(.28, 8, 6),
          new THREE.MeshBasicMaterial({ color: 0x8ce85a }));
        p.position.copy(pos).add(new THREE.Vector3(0, 1.4, 0));
        root.add(p);
        projectiles.push({ mesh: p, vel: new THREE.Vector3(Math.sin(yaw), .12, Math.cos(yaw)).multiplyScalar(28), dmg: a.def.dmg[a.lv - 1], life: 1.6 });
        return;
      }
      if (!t) { game.ui.float3(pos.clone().add(new THREE.Vector3(0, 2.5, 0)), '没有目标', 'dmg'); return; }
      hitCreature(t, a.def.dmg[a.lv - 1]);
    } else {
      SP.Audio.play(a.k);
      for (let i = 0; i < 6; i++) {
        const s = new THREE.Sprite(M.note.clone());
        s.position.copy(pos).add(new THREE.Vector3(U.rand(-.8, .8), 1.6, U.rand(-.8, .8)));
        s.scale.setScalar(U.rand(.5, 1));
        root.add(s);
        particles.push({ s: s, vel: new THREE.Vector3(U.rand(-.5, .5), U.rand(1.4, 2.4), U.rand(-.5, .5)), life: 1.2, max: 1.2 });
      }
      if (social && social.target && social.target.hp > 0) {
        answerSocial(a.k, a.def.pow[a.lv - 1]);
      } else if (t && !t.big) {
        startSocial(t);
      } else if (!t) {
        game.ui.float3(pos.clone().add(new THREE.Vector3(0, 2.5, 0)), '附近没有可交流的生物', 'dmg');
      }
    }
    refreshActions();
  }

  let projectiles = [], particles = [];

  function hitCreature(c, dmg) {
    const arm = c.sp ? c.sp.stats.armor : 0;
    const d = Math.max(1, dmg - arm * .5);
    c.hp -= d;
    c.hitT = .25;
    c.state = 'fight'; c.target = 'player';
    if (c.sp && !c.sp.home) { c.sp.rel = U.clamp(c.sp.rel - 6, -100, 100); c.sp.allied = false; }
    game.ui.float3(c.pos.clone().add(new THREE.Vector3(0, 2 * c.scale, 0)), '-' + Math.round(d), 'dmg');
    burst(M.blood, c.pos.clone().add(new THREE.Vector3(0, 1.2 * c.scale, 0)), 5, .4, 3);
    SP.Audio.play('hurt', .6);
    if (c.hp <= 0) killCreature(c);
    // 惊动同巢成员
    if (c.nest) c.nest.members.forEach(m => { if (m.hp > 0 && m.pos.distanceTo(c.pos) < 26) { m.state = 'fight'; m.target = 'player'; } });
  }
  function killCreature(c) {
    SP.Audio.play(c.big ? 'epic_roar' : 'die', .8);
    root.remove(c.model); G.dispose(c.model);
    killCount++;
    const dna = c.big ? C.epicDna : Math.round(12 + c.sp.stats.health * .12);
    addEvo(dna);
    game.ui.float3(c.pos, '+' + dna + ' DNA', 'dna');
    if (killCount === 1) game.ui.badge('first_kill');
    if (c.big) { game.ui.badge('epic_slayer'); game.ui.toast('🦖 你击杀了一只 <b>Epic 巨兽</b>！', 'good'); epic = null; }
    addFood(c.pos.x, c.pos.z, 'meat');
    if (c.nest) {
      const i = c.nest.members.indexOf(c);
      if (i >= 0) c.nest.members.splice(i, 1);
      if (c.nest.members.length === 0 && !c.nest.sp.home) {
        game.ui.toast('☠ <b>' + c.nest.sp.name + '</b> 的巢穴被清空了（该物种灭绝）', 'warn');
        c.nest.sp.extinct = true;
        addEvo(30);
      }
    }
  }

  /* ---------------- 结盟表演小游戏 ---------------- */
  function startSocial(c) {
    if (c.sp.home || c.sp.allied) return;
    const mine = myAbilities().filter(a => a.type === 'social');
    if (!mine.length) { game.ui.toast('你还没有社交部件 —— 去编辑器加一张嘴或一双手', 'warn'); return; }
    const theirs = G.SOCIAL.filter(k => c.sp.ab[k] > 0);
    if (!theirs.length) { game.ui.toast('<b>' + c.sp.name + '</b> 没有社交能力，只能用武力解决', 'warn'); return; }
    const n = 3 + Math.min(2, c.sp.allyRounds);
    const seq = [];
    for (let i = 0; i < n; i++) seq.push(U.choice(theirs));
    social = { target: c, seq: seq, idx: 0, fails: 0, t: 0, showT: 0 };
    c.state = 'social';
    game.ui.toast('🤝 <b>' + c.sp.name + '</b> 开始表演 —— 用你的社交技能<b>照着重复</b>它的动作！', '');
    SP.Audio.play('social_ok');
  }
  function answerSocial(k, pow) {
    if (!social) return;
    const want = social.seq[social.idx];
    if (k === want) {
      social.idx++;
      social.target.sp.allyProgress += pow * .5;
      SP.Audio.play('social_ok');
      game.ui.float3(social.target.pos.clone().add(new THREE.Vector3(0, 3, 0)), '✔ ' + G.ABILITY_NAMES[k], 'heal');
      if (social.idx >= social.seq.length) finishSocial(true);
    } else {
      social.fails++;
      SP.Audio.play('social_fail');
      game.ui.float3(social.target.pos.clone().add(new THREE.Vector3(0, 3, 0)), '✘ 应该是 ' + G.ABILITY_NAMES[want], 'dmg');
      if (social.fails >= 2) finishSocial(false);
    }
  }
  function finishSocial(ok) {
    const c = social.target, sp = c.sp;
    if (ok) {
      sp.allyRounds++;
      sp.rel = U.clamp(sp.rel + 34, -100, 100);
      addEvo(24);
      SP.Audio.play('ally');
      if (sp.allyRounds >= 3 || sp.rel >= 95) {
        sp.allied = true; sp.hostile = false;
        allyCount++;
        addEvo(45);
        game.ui.toast('🤝 <b>' + sp.name + '</b> 与你的物种<b>结盟</b>了！它们的成员可以加入你的队伍。', 'good');
        if (allyCount === 1) game.ui.badge('first_ally');
        nests.forEach(n => { if (n.sp === sp) n.members.forEach(m => { m.ally = true; m.state = 'wander'; }); });
      } else {
        game.ui.toast('✔ 表演成功（' + sp.allyRounds + '/3）—— 再来两轮就能结盟', 'good');
      }
    } else {
      sp.rel = U.clamp(sp.rel - 12, -100, 100);
      game.ui.toast('✘ 表演失败，<b>' + sp.name + '</b> 对你失去了兴趣', 'bad');
    }
    c.state = 'wander';
    social = null;
  }

  /* ---------------- 交互（骨骸 / 巢穴 / 吃 / 招募） ---------------- */
  function interact() {
    // 骨骸
    for (const b of bones) {
      if (b.dug) continue;
      if (Math.hypot(b.x - pos.x, b.z - pos.z) < 4.5) {
        b.dug = true;
        b.glow.visible = false;
        b.mesh.rotation.z = .35;
        SP.Audio.play('dig');
        if (game.unlockPart(b.part)) addEvo(18);
        else { addEvo(10); game.ui.toast('🦴 骨骸里的部件你已经有了，获得 10 DNA', ''); }
        burst(M.spark, new THREE.Vector3(b.x, heightAt(b.x, b.z) + 1, b.z), 10, .5, 4);
        refreshActions();
        return;
      }
    }
    // 自己的巢穴 → 交配 + 编辑器
    if (homeNest && Math.hypot(homeNest.x - pos.x, homeNest.z - pos.z) < 6.5) {
      hp = maxHp; hunger = 100;
      SP.Audio.play('levelup');
      game.ui.toast('🥚 回到巢穴：生命与饱腹已恢复', 'good');
      game.ui.openEditor('creature', () => {
        rebuildPlayer();
        game.ui.toast('🧬 你的物种进化了', 'good');
      });
      return;
    }
    // 吃东西
    for (const f of foods) {
      if (f.amount <= 0) continue;
      if (Math.hypot(f.x - pos.x, f.z - pos.z) < 4) {
        const diet = G.dietOf(game.genome);
        const ok = diet === 'both' || (diet === 'plant' && f.kind === 'fruit') || (diet === 'meat' && f.kind === 'meat');
        if (!ok) {
          if (msgT <= 0) { msgT = 3; game.ui.toast(diet === 'plant' ? '你是草食性，吃不了肉' : '你是肉食性，吃不了果子', 'warn'); }
          return;
        }
        f.amount--;
        hunger = Math.min(100, hunger + 26);
        hp = Math.min(maxHp, hp + 8);
        SP.Audio.play('eat');
        game.ui.float3(new THREE.Vector3(f.x, heightAt(f.x, f.z) + 1.5, f.z), '+饱腹', 'heal');
        if (f.amount <= 0) {
          root.remove(f.mesh);
          f.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); });
          foods.splice(foods.indexOf(f), 1);
        }
        return;
      }
    }
    // 招募盟友进队
    const t = pickTarget(9);
    if (t && t.ally && !t.pack && packs.length < C.packMax) {
      t.pack = true; packs.push(t);
      SP.Audio.play('confirm');
      game.ui.toast('🐾 <b>' + t.sp.name + '</b> 的一名成员加入了你的队伍（' + packs.length + '/' + C.packMax + '）', 'good');
      return;
    }
    game.ui.float3(pos.clone().add(new THREE.Vector3(0, 2.6, 0)), '附近没有可交互的东西', 'dmg');
  }

  /* ------------------------------------------------------------ 演化 */
  function addEvo(n) {
    game.addDNA(n);
    evo += n;
    let m = 0;
    C.markers.forEach(v => { if (evo >= v) m++; });
    if (m > markers) {
      markers = m;
      SP.Audio.play('levelup');
      game.ui.flash('dna');
      if (m < 3) {
        game.ui.toast('🧠 大脑变大了！（演化刻度 ' + m + '/3）你的族群开始向新的领地<b>迁徙</b>。', 'good');
        migrate();
      }
    }
    if (evo >= C.evolveGoal) offerTribal();
  }
  function migrate() {
    if (!homeNest) return;
    const a = U.rand(0, U.TAU), r = U.rand(SIZE * .18, SIZE * .3);
    const nx = Math.cos(a) * r, nz = Math.sin(a) * r;
    if (heightAt(nx, nz) < 1.5) return;
    homeNest.x = nx; homeNest.z = nz;
    homeNest.mesh.position.set(nx, heightAt(nx, nz), nz);
    game.ui.toast('🏕 巢穴迁到了新的位置（罗盘上的' + U.dirName(Math.atan2(nx - pos.x, nz - pos.z)) + '方）', '');
  }
  let tribalOffered = false;
  function offerTribal() {
    if (tribalOffered) return;
    tribalOffered = true;
    game.paused = true;
    game.ui.dialog({
      title: '🔥 部 落 的 黎 明',
      body: '<p>你的物种已经足够聪明。它们学会了合作、使用工具，甚至<b>控制火焰</b>。</p>' +
        '<p>击杀 <b>' + killCount + '</b> 只生物 · 结盟 <b>' + allyCount + '</b> 个物种 · 演化 <b>' + evo + '</b> DNA</p>' +
        '<p style="opacity:.8">从此，个体不再重要 —— 你将指挥整个部落。</p>',
      buttons: [
        { label: '🔥 建立部落', cb: () => { game.paused = false; game.advance('tribal', { evo: evo, kills: killCount, allies: allyCount }); } },
        { label: '再多演化一会儿', cb: () => { game.paused = false; tribalOffered = false; } }
      ]
    });
  }

  /* ------------------------------------------------------------ 玩家模型 */
  function rebuildPlayer() {
    if (model) { root.remove(model); G.dispose(model); }
    model = G.build(game.genome, { scale: 1.15 });
    root.add(model);
    const st = G.stats(game.genome);
    maxHp = st.health;
    hp = Math.min(hp <= 0 ? maxHp : hp, maxHp);
    refreshActions();
  }

  function burst(mat, at, n, scale, spd) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(mat.clone());
      s.position.copy(at); s.scale.setScalar(scale * U.rand(.6, 1.3));
      root.add(s);
      particles.push({ s: s, vel: new THREE.Vector3(U.rand(-1, 1), U.rand(.3, 1.4), U.rand(-1, 1)).multiplyScalar(spd), life: U.rand(.4, .9), max: .9 });
    }
  }

  /* ------------------------------------------------------------ HUD */
  function refreshHud() {
    const rel = species.filter(s => !s.home).map(s => {
      const cls = s.extinct ? 'bad' : s.allied ? 'good' : s.hostile ? 'bad' : s.rel > 40 ? 'good' : s.rel < -30 ? 'bad' : 'warn';
      const tag = s.extinct ? '灭绝' : s.allied ? '已结盟' : s.hostile ? '敌对' : s.rel > 40 ? '友好' : '中立';
      return '<div class="kv"><span>' + s.name + '</span><span class="chip ' + cls + '">' + tag + ' ' + Math.round(s.rel) + '</span></div>';
    }).join('');
    let socialHtml = '';
    if (social) {
      socialHtml = '<div class="card"><h4>结 盟 表 演</h4>' +
        '<div style="font-size:12px;opacity:.85;margin-bottom:5px">照着重复 <b>' + social.target.sp.name + '</b> 的动作：</div>' +
        '<div class="row">' + social.seq.map((k, i) =>
          '<span class="chip ' + (i < social.idx ? 'good' : i === social.idx ? 'warn' : '') + '">' +
          C.social[k].ico + G.ABILITY_NAMES[k] + '</span>').join('') + '</div>' +
        '<div style="font-size:11.5px;margin-top:6px;opacity:.75">失误 ' + social.fails + '/2 · 进度 ' + social.idx + '/' + social.seq.length + '</div></div>';
    }
    const dist = homeNest ? Math.round(Math.hypot(homeNest.x - pos.x, homeNest.z - pos.z)) : 0;
    game.ui.setHud(
      socialHtml +
      '<div class="card"><h4>演 化</h4>' +
      '<div class="kv"><span>演化 DNA</span><b>' + evo + ' / ' + C.evolveGoal + '</b></div>' +
      '<div class="mini"><i style="width:' + U.clamp(evo / C.evolveGoal * 100, 0, 100) + '%"></i></div>' +
      '<div class="kv" style="margin-top:6px"><span>大脑刻度</span><b>' + markers + ' / 3</b></div>' +
      '<div class="kv"><span>击杀 / 结盟</span><b>' + killCount + ' / ' + allyCount + '</b></div>' +
      '<div class="kv"><span>队伍</span><b>' + packs.length + ' / ' + C.packMax + '</b></div>' +
      '<div class="kv"><span>巢穴距离</span><b>' + dist + ' m</b></div>' +
      '</div>' +
      '<div class="card"><h4>物 种 关 系</h4>' + (rel || '<div style="opacity:.6">附近没有其他物种</div>') + '</div>' +
      (epic ? '<div class="card"><h4>⚠ Epic 巨兽</h4><div class="kv"><span>' + epic.sp.name + '</span><b>' +
        Math.round(epic.hp) + '/' + epic.maxHp + '</b></div><div class="mini"><i style="width:' +
        (epic.hp / epic.maxHp * 100) + '%;background:linear-gradient(90deg,#ff5f8f,#ffc94d)"></i></div>' +
        '<div style="font-size:11.5px;opacity:.75;margin-top:4px">它极其强大，独自挑战几乎是自杀。带上队伍。</div></div>' : '') +
      '<div class="card"><h4>操 作</h4><div style="font-size:11.5px;line-height:1.7;opacity:.85">' +
      'WASD 移动 · 鼠标视角 · 空格跳跃' + (G.stats(game.genome).glide ? '（按住滑翔）' : '') + '<br>' +
      '<b>1-4</b> 攻击技能 · <b>5-8</b> 社交技能<br><b>E</b> 挖骨骸 / 回巢交配 / 进食 / 招募<br>' +
      '社交技能对准其他生物可开始<b>结盟表演</b></div></div>'
    );
  }

  /* ------------------------------------------------------------ enter / exit */
  this.enter = function (payload) {
    initMats();
    noise = U.makeNoise2D(20260819);
    root = new THREE.Group();
    game.scene.add(root);
    species = []; nests = []; foods = []; bones = []; props = []; packs = [];
    projectiles = []; particles = [];
    evo = 0; markers = 0; killCount = 0; allyCount = 0; tribalOffered = false;
    cds = {}; social = null; epic = null;

    if (game.genome.kind !== 'creature') game.genome = G.newCreature(game.genome);
    if (!game.genome.name || game.genome.name === '无名生物') game.genome.name = G.randName(U.Rng(Math.floor(Math.random() * 1e6)));

    buildTerrain();

    // 光照与天空
    const hemi = new THREE.HemisphereLight(0xbfe6ff, 0x304028, .9); root.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0d0, 1.8);
    sun.position.set(60, 90, 40); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 300;
    sun.shadow.camera.left = -70; sun.shadow.camera.right = 70;
    sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70;
    sun.shadow.bias = -.0006;
    root.add(sun); root.add(sun.target);
    root.userData.sun = sun; root.userData.hemi = hemi;
    game.scene.fog = new THREE.FogExp2(0xa8cfe0, .0032);
    // 天空球
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0x8fc6e8, side: THREE.BackSide, fog: false }));
    root.add(sky); root.userData.sky = sky;

    // 玩家出生
    let ok = false;
    for (let i = 0; i < 200 && !ok; i++) {
      const a = U.rand(0, U.TAU), r = U.rand(10, SIZE * .18);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (heightAt(x, z) > 2.5) { pos.set(x, heightAt(x, z), z); ok = true; }
    }
    if (!ok) pos.set(0, heightAt(0, 0), 0);
    rebuildPlayer();

    // 自己的巢穴
    const home = makeSpecies(0, true);
    species.push(home);
    addNest(home, pos.x + 6, pos.z + 6);

    // 其他物种
    for (let i = 1; i <= C.nests; i++) {
      const sp = makeSpecies(i, false);
      species.push(sp);
      for (let k = 0; k < 60; k++) {
        const a = U.rand(0, U.TAU), r = U.rand(SIZE * .12, SIZE * .42);
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (heightAt(x, z) > 2.2 && Math.hypot(x - pos.x, z - pos.z) > 40) { addNest(sp, x, z); break; }
      }
    }

    // Epic 巨兽
    const espec = makeSpecies(99, false);
    espec.name = '巨型 ' + espec.name;
    espec.hostile = true;
    species.push(espec);
    for (let k = 0; k < 60; k++) {
      const a = U.rand(0, U.TAU), r = U.rand(SIZE * .3, SIZE * .44);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (heightAt(x, z) > 2.5) { epic = spawnCreature(espec, x, z, null, true); break; }
    }

    // 世界装饰
    for (let i = 0; i < 260; i++) {
      const a = U.rand(0, U.TAU), r = Math.sqrt(Math.random()) * SIZE * .46;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = heightAt(x, z);
      if (h < 1.2 || h > 13) continue;
      if (U.chance(.62)) addTree(x, z); else addRock(x, z);
    }
    for (let i = 0; i < 46; i++) {
      const a = U.rand(0, U.TAU), r = Math.sqrt(Math.random()) * SIZE * .44;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (heightAt(x, z) < 1.3) continue;
      addFood(x, z, U.chance(.62) ? 'fruit' : 'meat');
    }
    for (let i = 0; i < 12; i++) {
      const a = U.rand(0, U.TAU), r = Math.sqrt(Math.random()) * SIZE * .44;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (heightAt(x, z) < 1.6) continue;
      addBone(x, z);
    }

    hp = maxHp; hunger = 100;
    camYaw = yaw = 0; camPitch = .22; camDist = 8;
    game.camera.up.set(0, 1, 0);
    game.camera.fov = 62;
    game.camera.updateProjectionMatrix();
    game.wantsPointer = true;
    game.lockPointer(true);
    game.ui.setCrosshair(true);
    game.ui.setObjective('用<b>攻击</b>或<b>社交</b>推进演化条。<br>挖<b>骨骸</b>解锁部件，回<b>巢穴</b>交配进化。<br>填满演化条即可建立<b>部落</b>。');
    game.ui.setProgress(0, '演化进度');
    refreshActions();
    refreshHud();
    SP.Audio.setAmbient('wind_amb', .3);
  };

  this.exit = function () {
    if (root) { game.scene.remove(root); root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    root = null; model = null; terrain = null;
    species = []; nests = []; foods = []; bones = []; props = []; packs = [];
    projectiles = []; particles = [];
    SP.Audio.setAmbient('wind_amb', 0);
    game.wantsPointer = false;
    game.lockPointer(false);
  };

  /* ------------------------------------------------------------ 每帧 */
  this.update = function (dt) {
    const K = game.input.keys, MO = game.input.mouse;
    for (const k in cds) cds[k] = Math.max(0, cds[k] - dt);
    actionT = Math.max(0, actionT - dt);
    msgT = Math.max(0, msgT - dt);
    if (actionT <= 0) actionKind = null;

    /* --- 视角 --- */
    camYaw -= MO.dx * .0024 * game.settings.sens;
    camPitch = U.clamp(camPitch + MO.dy * .0022 * game.settings.sens, -.5, 1.15);
    if (MO.wheel) camDist = U.clamp(camDist + (MO.wheel > 0 ? .8 : -.8), 4, 20);

    /* --- 移动 --- */
    let ix = 0, iz = 0;
    if (K.KeyW || K.ArrowUp) iz += 1;
    if (K.KeyS || K.ArrowDown) iz -= 1;
    if (K.KeyA || K.ArrowLeft) ix -= 1;
    if (K.KeyD || K.ArrowRight) ix += 1;
    const st = G.stats(game.genome);
    const fwd = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    const right = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw));
    const wish = new THREE.Vector3().addScaledVector(fwd, iz).addScaledVector(right, ix);
    const moving = wish.lengthSq() > 0;
    if (moving) wish.normalize();
    const spd = 6.2 * st.speed * (hunger <= 0 ? .55 : 1);
    vel.x = U.damp(vel.x, wish.x * spd, 9, dt);
    vel.z = U.damp(vel.z, wish.z * spd, 9, dt);
    vel.y -= 24 * dt;
    if (st.glide && K.Space && vel.y < -1.5) vel.y = -1.5;      // 滑翔
    if (onGround && K.Space) { vel.y = 9.5; onGround = false; SP.Audio.play('step'); }

    const prevX = pos.x, prevZ = pos.z;
    pos.addScaledVector(vel, dt);

    // 与树木岩石碰撞
    for (const p of props) {
      const dx = pos.x - p.x, dz = pos.z - p.z;
      if (dx * dx + dz * dz < (p.r + .7) * (p.r + .7)) { pos.x = prevX; pos.z = prevZ; break; }
    }
    // 世界边界（走到海里会被推回）
    const gh = heightAt(pos.x, pos.z);
    if (gh < .35) {
      const back = new THREE.Vector3(-pos.x, 0, -pos.z).normalize();
      pos.x = prevX + back.x * dt * 6; pos.z = prevZ + back.z * dt * 6;
      if (msgT <= 0) { msgT = 4; game.ui.toast('🌊 你还不会游泳 —— 陆地才是你的舞台', 'warn'); }
    }
    const groundY = heightAt(pos.x, pos.z);
    if (pos.y <= groundY) {
      if (vel.y < -18) { hurt(Math.min(35, (-vel.y - 18) * 2)); }
      pos.y = groundY; vel.y = 0; onGround = true;
    } else onGround = false;

    if (moving) yaw = Math.atan2(wish.x, wish.z);
    if (model) {
      model.position.copy(pos);
      model.rotation.y = U.damp(model.rotation.y, yaw, 10, dt);
      G.animate(model, game.time, { move: moving ? 1 : 0, action: actionKind, speed: st.speed });
    }

    /* --- 饱腹与生命 --- */
    hunger = U.clamp(hunger - dt * (moving ? .9 : .5), 0, 100);
    if (hunger <= 0) hurt(dt * 2.2, true);
    else if (hunger > 55) hp = Math.min(maxHp, hp + dt * 1.6);

    /* --- E 交互 --- */
    if (K.KeyE) { K.KeyE = false; K.E = false; K.e = false; interact(); }

    /* --- 投射物 --- */
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.vel.y -= 9 * dt;
      let hitOne = false;
      allCreatures().forEach(c => {
        if (hitOne) return;
        if (p.mesh.position.distanceTo(c.pos.clone().add(new THREE.Vector3(0, 1.2 * c.scale, 0))) < 1.6 * c.scale) {
          hitCreature(c, p.dmg); hitOne = true;
        }
      });
      if (hitOne || p.life <= 0 || p.mesh.position.y < heightAt(p.mesh.position.x, p.mesh.position.z)) {
        burst(M.spark, p.mesh.position, 4, .3, 2);
        root.remove(p.mesh); p.mesh.geometry.dispose();
        projectiles.splice(i, 1);
      }
    }

    /* --- 其他生物 AI --- */
    const list = allCreatures();
    for (const c of list) {
      c.atkCd = Math.max(0, c.atkCd - dt);
      c.hitT = Math.max(0, c.hitT - dt);
      const toP = new THREE.Vector3().subVectors(pos, c.pos);
      const dP = toP.length();
      let mv = 0, tx = 0, tz = 0;

      if (c.pack) {
        // 队伍成员：跟着玩家，攻击玩家的目标
        if (dP > 8) { tx = toP.x / dP; tz = toP.z / dP; mv = 1; }
        const foe = list.find(o => o !== c && !o.ally && !o.sp.home && o.state === 'fight' && o.pos.distanceTo(c.pos) < 16);
        if (foe) {
          const tf = new THREE.Vector3().subVectors(foe.pos, c.pos);
          const df = tf.length();
          if (df > 2.4) { tx = tf.x / df; tz = tf.z / df; mv = 1; }
          else if (c.atkCd <= 0) {
            c.atkCd = 1.6;
            foe.hp -= 6 + c.sp.stats.attack;
            game.ui.float3(foe.pos.clone().add(new THREE.Vector3(0, 2, 0)), '-' + Math.round(6 + c.sp.stats.attack), 'dmg');
            if (foe.hp <= 0) killCreature(foe);
          }
        }
      } else if (c.state === 'social') {
        // 表演中：站着做动作
        mv = 0;
        c.performT = (c.performT || 0) + dt;
      } else if (c.state === 'fight' || (c.sp.hostile && !c.sp.allied && dP < (c.big ? 34 : 20))) {
        c.state = 'fight';
        if (dP > (c.big ? 3.6 : 2.4)) { tx = toP.x / dP; tz = toP.z / dP; mv = 1; }
        else if (c.atkCd <= 0) {
          c.atkCd = c.big ? 1.4 : 1.9;
          const dmg = (c.big ? 26 : 6 + c.sp.stats.attack * .9);
          hurt(dmg);
          SP.Audio.play(c.big ? 'epic_roar' : 'bite', .7);
        }
        if (dP > 46) { c.state = 'wander'; c.target = null; }
      } else {
        // 游荡 / 回巢
        c.wander += dt;
        if (c.nest && Math.hypot(c.pos.x - c.nest.x, c.pos.z - c.nest.z) > 30) {
          const t = new THREE.Vector3(c.nest.x - c.pos.x, 0, c.nest.z - c.pos.z).normalize();
          tx = t.x; tz = t.z; mv = .7;
        } else if (Math.sin(c.wander * .4) > 0) {
          c.dir += Math.sin(c.wander * .9) * dt * 1.2;
          tx = Math.sin(c.dir); tz = Math.cos(c.dir); mv = .55;
        }
      }
      if (mv > 0) {
        const s = c.speed * mv;
        const nx = c.pos.x + tx * s * dt, nz = c.pos.z + tz * s * dt;
        if (heightAt(nx, nz) > .6) { c.pos.x = nx; c.pos.z = nz; }
        else c.dir += 2.4;
        c.model.rotation.y = U.damp(c.model.rotation.y, Math.atan2(tx, tz), 8, dt);
      }
      c.pos.y = heightAt(c.pos.x, c.pos.z);
      const act = c.state === 'social' ? 'social' : (c.state === 'fight' && c.atkCd > (c.big ? 1.0 : 1.4)) ? 'attack' : null;
      G.animate(c.model, game.time + c.sp.id, { move: mv, action: act, speed: c.sp.stats.speed });
      if (c.hitT > 0) c.model.position.x += Math.sin(game.time * 60) * .05;
    }

    /* --- 结盟表演：目标每隔一会儿展示一次序列 --- */
    if (social) {
      social.t += dt;
      social.showT = (social.showT || 0) + dt;
      if (social.showT > 1.6) {
        social.showT = 0;
        const k = social.seq[social.idx];
        SP.Audio.play(k, .8);
        for (let i = 0; i < 4; i++) {
          const s = new THREE.Sprite(M.note.clone());
          s.position.copy(social.target.pos).add(new THREE.Vector3(U.rand(-1, 1), 2.2, U.rand(-1, 1)));
          s.scale.setScalar(U.rand(.6, 1.1));
          root.add(s);
          particles.push({ s: s, vel: new THREE.Vector3(0, 1.8, 0), life: 1, max: 1 });
        }
      }
      if (social.target.hp <= 0 || social.target.pos.distanceTo(pos) > 22) {
        game.ui.toast('表演中断了', 'warn');
        if (social.target.state === 'social') social.target.state = 'wander';
        social = null;
      }
      if (social && social.t > 28) { finishSocial(false); }
    }

    /* --- 食物再生 --- */
    foods.forEach(f => {
      f.t += dt;
      if (f.kind === 'fruit' && f.amount < 5 && f.t > 24) { f.amount++; f.t = 0; }
      f.mesh.rotation.y += dt * .05;
    });

    /* --- 粒子 --- */
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.s.position.addScaledVector(p.vel, dt);
      p.s.material.opacity = U.clamp(p.life / p.max, 0, 1) * .8;
      if (p.life <= 0) { root.remove(p.s); particles.splice(i, 1); }
    }
    // 骨骸光晕呼吸
    bones.forEach((b, i) => { if (!b.dug) b.glow.material.opacity = .35 + Math.sin(game.time * 2 + i) * .18; });

    /* --- 昼夜 --- */
    dayT += dt * (24 / 480);
    if (dayT >= 24) dayT -= 24;
    const sunAng = (dayT - 6) / 24 * U.TAU;
    const sd = new THREE.Vector3(Math.cos(sunAng), Math.sin(sunAng), .3).normalize();
    const sun = root.userData.sun, hemi = root.userData.hemi, sky = root.userData.sky;
    if (sun) {
      sun.position.copy(pos).addScaledVector(sd, 120);
      sun.target.position.copy(pos);
      const up = U.clamp(sd.y, 0, 1);
      sun.intensity = .15 + up * 1.9;
      sun.color.setHSL(U.lerp(.07, .13, up), U.lerp(.7, .25, up), U.lerp(.55, .95, up));
      hemi.intensity = .18 + up * .85;
      const skyC = new THREE.Color().setHSL(U.lerp(.62, .55, up), U.lerp(.55, .5, up), U.lerp(.10, .62, up));
      if (sky) sky.material.color.copy(skyC);
      game.scene.fog.color.copy(skyC).lerp(new THREE.Color(0xffffff), .25);
      game.renderer.setClearColor(skyC);
    }
    if (root.userData.sea) root.userData.sea.material.map.offset.x += dt * .006;

    /* --- 相机（第三人称，带地形避让） --- */
    const eye = new THREE.Vector3(pos.x, pos.y + 2.0, pos.z);
    const cy = Math.cos(camPitch), sy = Math.sin(camPitch);
    let cx = eye.x + Math.sin(camYaw) * camDist * cy;
    let cz = eye.z + Math.cos(camYaw) * camDist * cy;
    let cyy = eye.y + sy * camDist + 1.2;
    const th = heightAt(cx, cz) + 1.4;
    if (cyy < th) cyy = th;
    game.camera.position.set(cx, cyy, cz);
    game.camera.lookAt(eye.x, eye.y + .6, eye.z);

    /* --- HUD --- */
    game.ui.setBars([
      { label: '生命', v: hp, max: maxHp, color: 'linear-gradient(90deg,#ff5f8f,#ffb0c4)' },
      { label: '饱腹', v: hunger, max: 100, color: 'linear-gradient(90deg,#ffc94d,#ffe9a8)' },
      { label: '演化', v: evo, max: C.evolveGoal, color: 'linear-gradient(90deg,#a56cff,#3fe8ff)' }
    ]);
    game.ui.setProgress(evo / C.evolveGoal, '演化进度 ' + markers + '/3');
    hudT += dt;
    if (hudT > .4) { hudT = 0; refreshHud(); refreshActions(); }
  };

  function hurt(n, silent) {
    hp -= n;
    if (!silent) { game.ui.flash(); game.ui.float3(pos.clone().add(new THREE.Vector3(0, 2.4, 0)), '-' + Math.round(n), 'dmg'); }
    if (hp <= 0) {
      hp = 0;
      game.die('你 被 杀 死 了', '这片大陆并不宽容。<br>击杀 <b>' + killCount + '</b> · 结盟 <b>' + allyCount +
        '</b> · 演化 <b>' + evo + '</b> DNA<br><span style="opacity:.75">你的族群会在巢穴里孵出新的个体。</span>',
        () => {
          hp = maxHp; hunger = 80;
          if (homeNest) pos.set(homeNest.x + 3, heightAt(homeNest.x + 3, homeNest.z), homeNest.z);
          vel.set(0, 0, 0);
          allCreatures().forEach(c => { if (c.state === 'fight') { c.state = 'wander'; c.target = null; } });
          if (game.wantsPointer) game.lockPointer(true);
        });
    }
  }

  /* ------------------------------------------------------------ 存档 */
  this.serialize = function () {
    return {
      pos: [pos.x, pos.y, pos.z], hp: hp, hunger: hunger, evo: evo, markers: markers,
      kills: killCount, allies: allyCount, dayT: dayT,
      species: species.map(s => ({ id: s.id, rel: s.rel, allied: s.allied, rounds: s.allyRounds, extinct: !!s.extinct })),
      bones: bones.map(b => b.dug ? 1 : 0)
    };
  };
  this.deserialize = function (s) {
    if (!s) return;
    if (s.pos) pos.set(s.pos[0], s.pos[1], s.pos[2]);
    hp = s.hp || maxHp; hunger = s.hunger == null ? 100 : s.hunger;
    evo = s.evo || 0; markers = s.markers || 0;
    killCount = s.kills || 0; allyCount = s.allies || 0;
    dayT = s.dayT == null ? 8 : s.dayT;
    (s.species || []).forEach(ss => {
      const sp = species.find(x => x.id === ss.id);
      if (!sp) return;
      sp.rel = ss.rel; sp.allied = ss.allied; sp.allyRounds = ss.rounds || 0; sp.extinct = ss.extinct;
      if (sp.allied) nests.forEach(n => { if (n.sp === sp) n.members.forEach(m => m.ally = true); });
    });
    (s.bones || []).forEach((d, i) => { if (d && bones[i]) { bones[i].dug = true; bones[i].glow.visible = false; } });
    refreshHud();
  };
};
