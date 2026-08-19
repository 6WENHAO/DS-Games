/* ==========================================================================
   SPORE · genome.js
   基因组数据结构 + 程序化生物建模 + 骨骼动画 + 能力推导
   —— 五个阶段共用同一套生物表现（细胞/生物/部落成员/市民/被绑架生物）

   genome = {
     kind:'cell'|'creature',
     skin:{h,s,l,pattern},                     // pattern: none/spots/stripes/gradient/scales
     spine:[{x,y,z,r}...],                     // 从尾(索引0)到头(末索引)，z 向前
     parts:[{id,seg,side,off:[x,y,z],scale,rot:[x,y,z]}],
     name:'...'
   }
   ========================================================================== */
SP.Genome = (function () {
  const U = SP.U;

  /* ==================================================== 部件目录 */
  // kind: mouth / eye / foot / grasper / wing / tail / weapon / detail / cell
  // ability: 提供的能力与等级（bite/charge/strike/spit/sing/dance/charm/pose）
  const PARTS = {
    /* ---------- 细胞阶段 ---------- */
    mouth_herb: { name: '草食嘴', ico: '🟢', kind: 'cell', cost: 15, diet: 'plant', stats: { eat: 1 }, desc: '滤食器官，只能吃绿色的植物碎块。' },
    mouth_carn: { name: '肉食嘴', ico: '🔴', kind: 'cell', cost: 15, diet: 'meat', stats: { eat: 1, attack: 2 }, desc: '尖牙利齿，只吃红色的肉块。' },
    mouth_omni: { name: '杂食嘴', ico: '🔵', kind: 'cell', cost: 25, diet: 'both', stats: { eat: 1, attack: 1 }, desc: '双吸管，植物和肉都能吃。' },
    cilia: { name: '纤毛', ico: '〰️', kind: 'cell', cost: 15, stats: { speed: 1.25 }, desc: '细密的纤毛让你在水中更灵活。' },
    flagella: { name: '鞭毛', ico: '🌀', kind: 'cell', cost: 15, stats: { speed: 1.45 }, desc: '强力的尾鞭，直线冲刺更快。' },
    spike_cell: { name: '尖刺', ico: '📌', kind: 'cell', cost: 10, stats: { attack: 4, armor: 1 }, desc: '被撞时反伤，也能主动扎穿别人。' },
    poison_cell: { name: '毒囊', ico: '🟣', kind: 'cell', cost: 15, stats: { poison: 1 }, desc: '喷出毒雾，让附近的细胞麻痹。' },
    electric: { name: '电囊', ico: '⚡', kind: 'cell', cost: 25, stats: { shock: 1 }, desc: '放电麻痹周围一圈的细胞。' },
    jet: { name: '喷射器', ico: '💨', kind: 'cell', cost: 25, stats: { dash: 1 }, desc: '短距离高速冲刺，用来逃命最好。' },

    /* ---------- 嘴（生物阶段） ---------- */
    jaw: { name: '利颚', ico: '🦷', kind: 'mouth', cost: 20, ability: { bite: 3, sing: 1 }, desc: '厚重的下颚，撕咬伤害高。' },
    beak: { name: '尖喙', ico: '🐦', kind: 'mouth', cost: 15, ability: { bite: 2, sing: 3 }, desc: '尖喙叫声清亮，社交与撕咬兼顾。' },
    proboscis: { name: '长吻', ico: '🦟', kind: 'mouth', cost: 15, ability: { spit: 3, sing: 2 }, desc: '细长的吻管，可以远距离吐射。' },
    sucker: { name: '吸盘口', ico: '🫧', kind: 'mouth', cost: 12, ability: { bite: 1, sing: 4 }, desc: '共鸣腔极佳，歌声动人。' },
    tusks: { name: '獠牙', ico: '🦣', kind: 'mouth', cost: 25, ability: { bite: 5, charge: 2 }, desc: '巨大的獠牙，一口重伤。' },

    /* ---------- 眼 ---------- */
    eye_ball: { name: '球眼', ico: '👁️', kind: 'eye', cost: 5, ability: { charm: 2 }, desc: '普通但可靠的眼睛。' },
    eye_stalk: { name: '柄眼', ico: '👀', kind: 'eye', cost: 10, ability: { charm: 3, pose: 1 }, desc: '伸出的眼柄视野更广，也更迷人。' },
    eye_compound: { name: '复眼', ico: '🪰', kind: 'eye', cost: 15, ability: { charm: 4 }, desc: '昆虫式复眼，凝视令人沉迷。' },

    /* ---------- 足 ---------- */
    foot_paw: { name: '掌足', ico: '🐾', kind: 'foot', cost: 15, ability: { charge: 2, dance: 2 }, stats: { speed: 1.15 }, desc: '肉垫掌足，跑得稳。' },
    foot_hoof: { name: '蹄足', ico: '🐴', kind: 'foot', cost: 20, ability: { charge: 4, dance: 1 }, stats: { speed: 1.35 }, desc: '硬蹄，冲撞威力大速度快。' },
    foot_claw: { name: '爪足', ico: '🦖', kind: 'foot', cost: 25, ability: { charge: 3, strike: 2 }, stats: { speed: 1.25 }, desc: '钩爪抓地，兼具攻击性。' },
    foot_fin: { name: '鳍足', ico: '🐟', kind: 'foot', cost: 12, ability: { dance: 4 }, stats: { speed: 1.05 }, desc: '柔软的鳍足，舞姿优美。' },

    /* ---------- 手 / 抓握 ---------- */
    hand_claw: { name: '利爪', ico: '🦅', kind: 'grasper', cost: 20, ability: { strike: 4 }, desc: '三根钩爪，重击伤害高。' },
    hand_palm: { name: '手掌', ico: '✋', kind: 'grasper', cost: 15, ability: { strike: 2, charm: 2 }, desc: '灵巧的手掌，能挥手示好。' },
    hand_pincer: { name: '巨钳', ico: '🦀', kind: 'grasper', cost: 25, ability: { strike: 5 }, desc: '甲壳巨钳，一击致命。' },
    hand_frond: { name: '触叶', ico: '🌿', kind: 'grasper', cost: 12, ability: { charm: 4, pose: 2 }, desc: '柔软的触叶，摆姿优雅。' },

    /* ---------- 尾 / 翼 ---------- */
    tail_whip: { name: '鞭尾', ico: '➰', kind: 'tail', cost: 12, ability: { strike: 2, dance: 2 }, desc: '灵活的长尾，平衡与甩击。' },
    tail_club: { name: '锤尾', ico: '🔨', kind: 'tail', cost: 20, ability: { charge: 3, strike: 3 }, desc: '尾端骨锤，甩起来势不可挡。' },
    tail_fan: { name: '扇尾', ico: '🦚', kind: 'tail', cost: 18, ability: { pose: 5, charm: 2 }, desc: '张开如屏，摆姿一绝。' },
    wing_bat: { name: '膜翼', ico: '🦇', kind: 'wing', cost: 25, ability: { charge: 2, dance: 3 }, stats: { glide: 1 }, desc: '皮膜双翼，可以滑翔。' },
    wing_feather: { name: '羽翼', ico: '🕊️', kind: 'wing', cost: 30, ability: { dance: 4, pose: 3 }, stats: { glide: 1 }, desc: '华丽羽翼，飞行与炫耀。' },

    /* ---------- 武器 / 装饰 ---------- */
    spike_back: { name: '背刺', ico: '🌵', kind: 'weapon', cost: 15, ability: { bite: 1 }, stats: { armor: 2 }, desc: '一排骨刺，威慢也护身。' },
    horn: { name: '独角', ico: '🦄', kind: 'weapon', cost: 20, ability: { charge: 4 }, desc: '前突的角，冲撞主力。' },
    plate: { name: '甲板', ico: '🛡️', kind: 'detail', cost: 18, stats: { armor: 4 }, ability: { pose: 2 }, desc: '厚甲板，减伤显著。' },
    frill: { name: '颈盾', ico: '🦎', kind: 'detail', cost: 14, ability: { pose: 4, charm: 1 }, desc: '张开的颈盾，威吓与摆姿。' },
    fin_dorsal: { name: '背鳍', ico: '🐬', kind: 'detail', cost: 10, ability: { dance: 2 }, stats: { speed: 1.05 }, desc: '流线背鳍。' },
    gland_poison: { name: '毒腺', ico: '☠️', kind: 'weapon', cost: 25, ability: { spit: 5 }, desc: '喷射腐蚀性毒液。' },
    sac_song: { name: '鸣囊', ico: '🎵', kind: 'detail', cost: 20, ability: { sing: 5 }, desc: '巨大的鸣囊，歌声传遍山谷。' }
  };

  const ABILITY_NAMES = {
    bite: '撕咬', charge: '冲撞', strike: '打击', spit: '吐射',
    sing: '歌唱', dance: '舞蹈', charm: '魅惑', pose: '摆姿'
  };
  const COMBAT = ['bite', 'charge', 'strike', 'spit'];
  const SOCIAL = ['sing', 'dance', 'charm', 'pose'];

  /* ==================================================== 初始基因组 */
  function newCell() {
    return {
      kind: 'cell',
      name: '无名微生物',
      skin: { h: 190, s: 65, l: 56, pattern: 'gradient' },
      spine: [{ x: 0, y: 0, z: -.25, r: .34 }, { x: 0, y: 0, z: .25, r: .40 }],
      parts: [
        { id: 'mouth_herb', seg: 1, side: 0, off: [0, 0, .34], scale: 1, rot: [0, 0, 0] },
        { id: 'eye_ball', seg: 1, side: -1, off: [.16, .14, .22], scale: .8, rot: [0, 0, 0] },
        { id: 'eye_ball', seg: 1, side: 1, off: [.16, .14, .22], scale: .8, rot: [0, 0, 0] },
        { id: 'flagella', seg: 0, side: 0, off: [0, 0, -.3], scale: 1, rot: [0, 0, 0] }
      ]
    };
  }
  function newCreature(cell) {
    const skin = cell && cell.skin ? { h: cell.skin.h, s: cell.skin.s, l: cell.skin.l, pattern: cell.skin.pattern } : { h: 30, s: 62, l: 52, pattern: 'spots' };
    const g = {
      kind: 'creature',
      name: '无名生物',
      skin: skin,
      spine: [
        { x: 0, y: .05, z: -1.15, r: .17 },
        { x: 0, y: .12, z: -.62, r: .30 },
        { x: 0, y: .16, z: 0, r: .38 },
        { x: 0, y: .16, z: .58, r: .32 },
        { x: 0, y: .22, z: 1.05, r: .26 }
      ],
      parts: []
    };
    // 继承细胞阶段的食性
    const diet = cell ? dietOf(cell) : 'both';
    g.parts.push({ id: diet === 'plant' ? 'beak' : diet === 'meat' ? 'jaw' : 'sucker', seg: 4, side: 0, off: [0, -.04, .28], scale: 1, rot: [0, 0, 0] });
    g.parts.push({ id: 'eye_ball', seg: 4, side: -1, off: [.16, .16, .12], scale: 1, rot: [0, 0, 0] });
    g.parts.push({ id: 'eye_ball', seg: 4, side: 1, off: [.16, .16, .12], scale: 1, rot: [0, 0, 0] });
    g.parts.push({ id: 'foot_paw', seg: 1, side: -1, off: [.26, -.06, 0], scale: 1, rot: [0, 0, 0] });
    g.parts.push({ id: 'foot_paw', seg: 1, side: 1, off: [.26, -.06, 0], scale: 1, rot: [0, 0, 0] });
    g.parts.push({ id: 'foot_paw', seg: 3, side: -1, off: [.24, -.06, 0], scale: 1, rot: [0, 0, 0] });
    g.parts.push({ id: 'foot_paw', seg: 3, side: 1, off: [.24, -.06, 0], scale: 1, rot: [0, 0, 0] });
    g.parts.push({ id: 'tail_whip', seg: 0, side: 0, off: [0, .02, -.2], scale: 1, rot: [0, 0, 0] });
    return g;
  }
  function dietOf(g) {
    let plant = false, meat = false;
    (g.parts || []).forEach(p => {
      const d = PARTS[p.id] && PARTS[p.id].diet;
      if (d === 'plant') plant = true;
      if (d === 'meat') meat = true;
      if (d === 'both') { plant = true; meat = true; }
    });
    if (plant && meat) return 'both';
    if (meat) return 'meat';
    if (plant) return 'plant';
    return 'plant';
  }

  /* 随机生物（AI 物种 / 外星种族） */
  function random(kind, seed) {
    const rng = U.Rng(seed == null ? Math.floor(Math.random() * 1e9) : seed);
    if (kind === 'cell') {
      const g = newCell();
      g.skin = { h: rng.int(0, 359), s: rng.int(45, 92), l: rng.int(38, 68), pattern: rng.pick(['none', 'spots', 'stripes', 'gradient']) };
      g.parts[0].id = rng.pick(['mouth_herb', 'mouth_carn', 'mouth_omni']);
      g.parts[3].id = rng.pick(['flagella', 'cilia']);
      if (rng.chance(.4)) g.parts.push({ id: 'spike_cell', seg: 1, side: 0, off: [0, .3, 0], scale: 1, rot: [0, 0, 0] });
      if (rng.chance(.25)) g.parts.push({ id: 'electric', seg: 0, side: 0, off: [0, .28, 0], scale: 1, rot: [0, 0, 0] });
      return g;
    }
    const nSeg = rng.int(4, 7);
    const g = { kind: 'creature', name: randName(rng), skin: { h: rng.int(0, 359), s: rng.int(35, 92), l: rng.int(30, 68), pattern: rng.pick(['none', 'spots', 'stripes', 'gradient', 'scales']) }, spine: [], parts: [] };
    const len = rng.range(1.9, 3.4);
    const fat = rng.range(.7, 1.5);
    for (let i = 0; i < nSeg; i++) {
      const t = i / (nSeg - 1);
      g.spine.push({
        x: 0,
        y: .1 + Math.sin(t * Math.PI) * rng.range(.02, .22) + t * rng.range(-.1, .3),
        z: -len / 2 + len * t,
        r: (.14 + Math.sin(t * Math.PI) * .28) * fat
      });
    }
    const head = nSeg - 1;
    g.parts.push({ id: rng.pick(['jaw', 'beak', 'proboscis', 'sucker', 'tusks']), seg: head, side: 0, off: [0, -.04, .26], scale: rng.range(.8, 1.4), rot: [0, 0, 0] });
    const eye = rng.pick(['eye_ball', 'eye_stalk', 'eye_compound']);
    const nEye = rng.chance(.15) ? 2 : 1;
    for (let e = 0; e < nEye; e++) {
      g.parts.push({ id: eye, seg: head - e, side: -1, off: [.15, .16 + e * .06, .1], scale: rng.range(.7, 1.3), rot: [0, 0, 0] });
      g.parts.push({ id: eye, seg: head - e, side: 1, off: [.15, .16 + e * .06, .1], scale: rng.range(.7, 1.3), rot: [0, 0, 0] });
    }
    const foot = rng.pick(['foot_paw', 'foot_hoof', 'foot_claw', 'foot_fin']);
    const pairs = rng.chance(.55) ? 2 : 1;      // 四足或双足
    for (let p = 0; p < pairs; p++) {
      const seg = pairs === 1 ? 1 : (p === 0 ? 1 : Math.max(2, head - 1));
      g.parts.push({ id: foot, seg: seg, side: -1, off: [.24, -.06, 0], scale: rng.range(.85, 1.3), rot: [0, 0, 0] });
      g.parts.push({ id: foot, seg: seg, side: 1, off: [.24, -.06, 0], scale: rng.range(.85, 1.3), rot: [0, 0, 0] });
    }
    if (rng.chance(.7)) {
      const hand = rng.pick(['hand_claw', 'hand_palm', 'hand_pincer', 'hand_frond']);
      const seg = Math.max(1, head - 1);
      g.parts.push({ id: hand, seg: seg, side: -1, off: [.26, .12, 0], scale: rng.range(.8, 1.2), rot: [0, 0, 0] });
      g.parts.push({ id: hand, seg: seg, side: 1, off: [.26, .12, 0], scale: rng.range(.8, 1.2), rot: [0, 0, 0] });
    }
    if (rng.chance(.75)) g.parts.push({ id: rng.pick(['tail_whip', 'tail_club', 'tail_fan']), seg: 0, side: 0, off: [0, .02, -.18], scale: rng.range(.8, 1.3), rot: [0, 0, 0] });
    if (rng.chance(.28)) {
      const w = rng.pick(['wing_bat', 'wing_feather']);
      g.parts.push({ id: w, seg: Math.max(2, head - 2), side: -1, off: [.2, .24, 0], scale: rng.range(.9, 1.4), rot: [0, 0, 0] });
      g.parts.push({ id: w, seg: Math.max(2, head - 2), side: 1, off: [.2, .24, 0], scale: rng.range(.9, 1.4), rot: [0, 0, 0] });
    }
    if (rng.chance(.4)) g.parts.push({ id: rng.pick(['spike_back', 'fin_dorsal', 'plate']), seg: 2, side: 0, off: [0, .3, 0], scale: rng.range(.8, 1.3), rot: [0, 0, 0] });
    if (rng.chance(.3)) g.parts.push({ id: rng.pick(['horn', 'frill']), seg: head, side: 0, off: [0, .22, .12], scale: rng.range(.8, 1.3), rot: [0, 0, 0] });
    if (rng.chance(.2)) g.parts.push({ id: rng.pick(['sac_song', 'gland_poison']), seg: Math.max(1, head - 1), side: 0, off: [0, -.16, 0], scale: 1, rot: [0, 0, 0] });
    return g;
  }
  const NA = ['塔', '兹', '格', '洛', '姆', '维', '库', '拉', '希', '诺', '巴', '锡', '祖', '奎', '瑟', '德'];
  const NB = ['星', '族', '兽', '民', '灵', '猎', '语', '爪', '牙', '羽', '甲', '角'];
  function randName(rng) {
    let s = '';
    const n = rng.int(2, 3);
    for (let i = 0; i < n; i++) s += rng.pick(NA);
    return s + rng.pick(NB);
  }

  /* ==================================================== 数值与能力 */
  function stats(g) {
    let health = 40, attack = 4, speed = 1, armor = 0, glide = 0, eat = 0, social = 4;
    let mass = 0;
    (g.spine || []).forEach(s => mass += s.r * s.r);
    health += mass * 42;
    (g.parts || []).forEach(p => {
      const d = PARTS[p.id]; if (!d) return;
      if (d.stats) {
        if (d.stats.speed) speed *= (1 + (d.stats.speed - 1) * .5);
        if (d.stats.armor) armor += d.stats.armor;
        if (d.stats.glide) glide = 1;
        if (d.stats.eat) eat += d.stats.eat;
        if (d.stats.attack) attack += d.stats.attack;
      }
      if (d.ability) {
        COMBAT.forEach(k => { if (d.ability[k]) attack += d.ability[k] * .8; });
        SOCIAL.forEach(k => { if (d.ability[k]) social += d.ability[k] * .8; });
      }
    });
    return {
      health: Math.round(health), attack: Math.round(attack * 10) / 10,
      speed: Math.round(speed * 100) / 100, armor: armor, glide: glide, eat: eat,
      social: Math.round(social * 10) / 10, mass: Math.round(mass * 100) / 100
    };
  }
  function abilities(g) {
    const out = { bite: 0, charge: 0, strike: 0, spit: 0, sing: 0, dance: 0, charm: 0, pose: 0 };
    (g.parts || []).forEach(p => {
      const d = PARTS[p.id]; if (!d || !d.ability) return;
      for (const k in d.ability) if (out[k] != null) out[k] = Math.max(out[k], d.ability[k]);
    });
    return out;
  }
  function cost(g) {
    let c = 0;
    (g.parts || []).forEach(p => { if (PARTS[p.id]) c += PARTS[p.id].cost; });
    return c;
  }

  /* ==================================================== 建模 */
  function skinMaterial(skin) {
    return new THREE.MeshStandardMaterial({
      map: SP.Tex.skin(skin.h, skin.s, skin.l, skin.pattern),
      color: 0xffffff, roughness: .62, metalness: .04
    });
  }
  function accentMaterial(skin, shift, li) {
    const c = new THREE.Color();
    c.setHSL((((skin.h + (shift || 30)) % 360) / 360), U.clamp(skin.s / 100, 0, 1), U.clamp((li == null ? skin.l - 14 : li) / 100, .05, .95));
    return new THREE.MeshStandardMaterial({ color: c, roughness: .55, metalness: .06 });
  }
  const EYE_WHITE = new THREE.MeshStandardMaterial({ color: 0xf6fbff, roughness: .25 });
  const EYE_DARK = new THREE.MeshBasicMaterial({ color: 0x0a0a12 });
  const TOOTH = new THREE.MeshStandardMaterial({ color: 0xf5efdd, roughness: .35 });

  function capsule(r, h, mat) {
    const g = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(.01, h), 5, 8), mat);
    return g;
  }

  /* ---- 单个部件的模型（返回 Group，附带 userData 供动画使用） ---- */
  function buildPart(p, mats, skin) {
    const d = PARTS[p.id];
    const g = new THREE.Group();
    if (!d) return g;
    const M = mats.body, A = mats.accent;
    g.userData.kind = d.kind;
    g.userData.id = p.id;

    switch (p.id) {
      /* --- 细胞部件 --- */
      case 'mouth_herb': {
        const m = new THREE.Mesh(new THREE.TorusGeometry(.12, .045, 6, 12), A);
        m.rotation.x = Math.PI / 2; g.add(m);
        const inner = new THREE.Mesh(new THREE.CircleGeometry ? new THREE.SphereGeometry(.08, 8, 6) : new THREE.SphereGeometry(.08, 8, 6), EYE_DARK);
        inner.scale.z = .4; g.add(inner);
        break;
      }
      case 'mouth_carn': {
        const m = new THREE.Mesh(new THREE.SphereGeometry(.13, 10, 8), A);
        m.scale.set(1, .7, .8); g.add(m);
        for (let i = 0; i < 6; i++) {
          const t = new THREE.Mesh(new THREE.ConeGeometry(.022, .08, 4), TOOTH);
          const a = (i / 6) * Math.PI * 2;
          t.position.set(Math.cos(a) * .085, Math.sin(a) * .06, .06);
          t.rotation.x = -Math.PI / 2; g.add(t);
        }
        g.userData.jaw = m;
        break;
      }
      case 'mouth_omni': {
        [-1, 1].forEach(s => {
          const m = new THREE.Mesh(new THREE.CylinderGeometry(.05, .07, .16, 8), A);
          m.position.set(s * .07, 0, .06); m.rotation.x = Math.PI / 2; g.add(m);
        });
        break;
      }
      case 'cilia': {
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          const c = capsule(.012, .16, A);
          c.position.set(Math.cos(a) * .04, Math.sin(a) * .04, -.06);
          c.rotation.set(1.4 + Math.sin(a) * .3, a, 0);
          g.add(c);
        }
        g.userData.wave = true;
        break;
      }
      case 'flagella': {
        const segs = [];
        let parent = g;
        for (let i = 0; i < 6; i++) {
          const seg = new THREE.Group();
          const m = capsule(.028 - i * .003, .16, A);
          m.rotation.x = Math.PI / 2; m.position.z = -.08;
          seg.add(m); seg.position.z = i === 0 ? 0 : -.16;
          parent.add(seg); parent = seg; segs.push(seg);
        }
        g.userData.chain = segs;
        break;
      }
      case 'spike_cell': {
        const m = new THREE.Mesh(new THREE.ConeGeometry(.05, .26, 6), A);
        m.rotation.x = -Math.PI / 2; g.add(m);
        break;
      }
      case 'poison_cell': {
        const m = new THREE.Mesh(new THREE.SphereGeometry(.1, 10, 8), new THREE.MeshStandardMaterial({ color: 0x9b3fd8, roughness: .4, emissive: 0x2a0040 }));
        g.add(m); g.userData.pulse = m;
        break;
      }
      case 'electric': {
        const m = new THREE.Mesh(new THREE.OctahedronGeometry(.11, 0), new THREE.MeshStandardMaterial({ color: 0x54e0ff, roughness: .2, emissive: 0x0a4a5a, emissiveIntensity: 1.4 }));
        g.add(m); g.userData.pulse = m;
        break;
      }
      case 'jet': {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(.07, .1, .18, 8), A);
        m.rotation.x = Math.PI / 2; g.add(m);
        const fl = new THREE.Mesh(new THREE.ConeGeometry(.07, .2, 8), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: .7 }));
        fl.rotation.x = Math.PI / 2; fl.position.z = -.2; g.add(fl);
        g.userData.flame = fl;
        break;
      }

      /* --- 嘴 --- */
      case 'jaw': case 'tusks': {
        const upper = new THREE.Mesh(new THREE.BoxGeometry(.26, .12, .3), M);
        upper.position.set(0, .06, .1); g.add(upper);
        const jawG = new THREE.Group();
        const lower = new THREE.Mesh(new THREE.BoxGeometry(.24, .1, .28), M);
        lower.position.set(0, -.06, .12); jawG.add(lower);
        g.add(jawG); g.userData.jaw = jawG;
        for (let i = 0; i < 5; i++) {
          const t1 = new THREE.Mesh(new THREE.ConeGeometry(.022, .07, 4), TOOTH);
          t1.position.set(-.09 + i * .045, .0, .12 + (i % 2) * .04);
          t1.rotation.x = Math.PI; upper.add(t1);
          const t2 = new THREE.Mesh(new THREE.ConeGeometry(.02, .06, 4), TOOTH);
          t2.position.set(-.09 + i * .045, .05, .1); lower.add(t2);
        }
        if (p.id === 'tusks') [-1, 1].forEach(s => {
          const tu = new THREE.Mesh(new THREE.ConeGeometry(.04, .34, 6), TOOTH);
          tu.position.set(s * .12, -.02, .18); tu.rotation.set(-1.9, 0, s * .2);
          g.add(tu);
        });
        break;
      }
      case 'beak': {
        const up = new THREE.Mesh(new THREE.ConeGeometry(.1, .34, 6), A);
        up.rotation.x = Math.PI / 2; up.position.set(0, .04, .16); up.scale.y = .6; g.add(up);
        const jawG = new THREE.Group();
        const lo = new THREE.Mesh(new THREE.ConeGeometry(.085, .28, 6), A);
        lo.rotation.x = Math.PI / 2; lo.position.set(0, -.05, .14); lo.scale.y = .45; jawG.add(lo);
        g.add(jawG); g.userData.jaw = jawG;
        break;
      }
      case 'proboscis': {
        const t = new THREE.Mesh(new THREE.CylinderGeometry(.055, .022, .5, 8), A);
        t.rotation.x = Math.PI / 2; t.position.z = .24; g.add(t);
        const tip = new THREE.Mesh(new THREE.SphereGeometry(.035, 8, 6), EYE_DARK);
        tip.position.z = .48; g.add(tip);
        break;
      }
      case 'sucker': {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(.14, .1, .12, 12), A);
        m.rotation.x = Math.PI / 2; m.position.z = .1; g.add(m);
        const r = new THREE.Mesh(new THREE.TorusGeometry(.13, .03, 6, 14), A);
        r.position.z = .16; g.add(r);
        const inner = new THREE.Mesh(new THREE.SphereGeometry(.09, 10, 8), EYE_DARK);
        inner.position.z = .12; inner.scale.z = .4; g.add(inner);
        g.userData.jaw = r;
        break;
      }

      /* --- 眼 --- */
      case 'eye_ball': case 'eye_stalk': case 'eye_compound': {
        let base = g;
        if (p.id === 'eye_stalk') {
          const st = capsule(.028, .2, M);
          st.position.y = .1; g.add(st);
          base = new THREE.Group(); base.position.y = .22; g.add(base);
        }
        const w = new THREE.Mesh(new THREE.SphereGeometry(.09, 12, 10), p.id === 'eye_compound' ? accentMaterial(skin, 180, 40) : EYE_WHITE);
        base.add(w);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(.045, 10, 8), EYE_DARK);
        pupil.position.z = .07; base.add(pupil);
        const shine = new THREE.Mesh(new THREE.SphereGeometry(.018, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        shine.position.set(.03, .03, .085); base.add(shine);
        if (p.id === 'eye_compound') for (let i = 0; i < 8; i++) {
          const f = new THREE.Mesh(new THREE.SphereGeometry(.03, 6, 5), EYE_DARK);
          const a = i / 8 * Math.PI * 2;
          f.position.set(Math.cos(a) * .06, Math.sin(a) * .06, .06); base.add(f);
        }
        g.userData.eye = base;
        break;
      }

      /* --- 足（三段腿 + 脚） --- */
      case 'foot_paw': case 'foot_hoof': case 'foot_claw': case 'foot_fin': {
        const hip = new THREE.Group();
        const thigh = capsule(.075, .3, M);
        thigh.position.y = -.17; hip.add(thigh);
        const knee = new THREE.Group();
        knee.position.y = -.34; hip.add(knee);
        const shin = capsule(.055, .28, M);
        shin.position.y = -.16; knee.add(shin);
        const ankle = new THREE.Group();
        ankle.position.y = -.32; knee.add(ankle);
        let foot;
        if (p.id === 'foot_hoof') {
          foot = new THREE.Mesh(new THREE.CylinderGeometry(.075, .09, .12, 8), A);
          foot.position.y = -.05;
        } else if (p.id === 'foot_claw') {
          foot = new THREE.Group();
          const pad = new THREE.Mesh(new THREE.BoxGeometry(.14, .06, .2), M);
          pad.position.set(0, -.03, .04); foot.add(pad);
          for (let i = -1; i <= 1; i++) {
            const cl = new THREE.Mesh(new THREE.ConeGeometry(.022, .12, 5), TOOTH);
            cl.position.set(i * .05, -.04, .16); cl.rotation.x = -1.2; foot.add(cl);
          }
        } else if (p.id === 'foot_fin') {
          foot = new THREE.Mesh(new THREE.SphereGeometry(.11, 8, 6), A);
          foot.scale.set(1, .3, 1.5); foot.position.set(0, -.03, .06);
        } else {
          foot = new THREE.Group();
          const pad = new THREE.Mesh(new THREE.SphereGeometry(.09, 9, 7), M);
          pad.scale.set(1, .55, 1.4); pad.position.set(0, -.03, .04); foot.add(pad);
          for (let i = -1; i <= 1; i++) {
            const toe = new THREE.Mesh(new THREE.SphereGeometry(.035, 6, 5), M);
            toe.position.set(i * .05, -.03, .14); foot.add(toe);
          }
        }
        ankle.add(foot);
        g.add(hip);
        g.userData.leg = { hip, knee, ankle, foot, len: .66 };
        break;
      }

      /* --- 手 --- */
      case 'hand_claw': case 'hand_palm': case 'hand_pincer': case 'hand_frond': {
        const sh = new THREE.Group();
        const arm = capsule(.055, .26, M);
        arm.position.y = -.15; sh.add(arm);
        const elbow = new THREE.Group();
        elbow.position.y = -.3; sh.add(elbow);
        const fore = capsule(.045, .22, M);
        fore.position.y = -.13; elbow.add(fore);
        const wrist = new THREE.Group();
        wrist.position.y = -.26; elbow.add(wrist);
        if (p.id === 'hand_pincer') {
          const b = new THREE.Mesh(new THREE.SphereGeometry(.08, 8, 6), A);
          b.scale.set(1, .8, 1.3); wrist.add(b);
          [-1, 1].forEach(s => {
            const c = new THREE.Mesh(new THREE.BoxGeometry(.05, .16, .06), A);
            c.position.set(s * .05, -.08, .06); c.rotation.z = s * .3; wrist.add(c);
          });
        } else if (p.id === 'hand_frond') {
          for (let i = 0; i < 5; i++) {
            const f = new THREE.Mesh(new THREE.SphereGeometry(.045, 6, 5), A);
            f.scale.set(.5, 1.8, .5);
            const a = (i / 5 - .5) * 1.6;
            f.position.set(Math.sin(a) * .07, -.1, Math.cos(a) * .03);
            f.rotation.z = -a; wrist.add(f);
          }
        } else {
          const palm = new THREE.Mesh(new THREE.BoxGeometry(.1, .1, .05), M);
          palm.position.y = -.05; wrist.add(palm);
          for (let i = -1; i <= 1; i++) {
            const fg = p.id === 'hand_claw'
              ? new THREE.Mesh(new THREE.ConeGeometry(.02, .13, 5), TOOTH)
              : capsule(.02, .08, M);
            fg.position.set(i * .035, -.13, .01);
            if (p.id === 'hand_claw') fg.rotation.x = .3;
            wrist.add(fg);
          }
        }
        g.add(sh);
        g.userData.arm = { sh, elbow, wrist };
        break;
      }

      /* --- 尾 --- */
      case 'tail_whip': case 'tail_club': case 'tail_fan': {
        const segs = [];
        let parent = g;
        const n = p.id === 'tail_fan' ? 3 : 5;
        for (let i = 0; i < n; i++) {
          const seg = new THREE.Group();
          const r = .09 - i * .012;
          const m = capsule(Math.max(.02, r), .18, M);
          m.rotation.x = Math.PI / 2; m.position.z = -.1;
          seg.add(m);
          seg.position.z = i === 0 ? 0 : -.2;
          parent.add(seg); parent = seg; segs.push(seg);
        }
        if (p.id === 'tail_club') {
          const club = new THREE.Mesh(new THREE.DodecahedronGeometry(.14, 0), A);
          club.position.z = -.2; parent.add(club);
          for (let i = 0; i < 4; i++) {
            const sp = new THREE.Mesh(new THREE.ConeGeometry(.03, .1, 4), TOOTH);
            const a = i / 4 * Math.PI * 2;
            sp.position.set(Math.cos(a) * .12, Math.sin(a) * .12, -.2);
            sp.rotation.z = -a; parent.add(sp);
          }
        }
        if (p.id === 'tail_fan') {
          const fan = new THREE.Group();
          for (let i = 0; i < 7; i++) {
            const fe = new THREE.Mesh(new THREE.SphereGeometry(.1, 7, 6), accentMaterial(skin, 40 + i * 12, 58));
            fe.scale.set(.3, 2.0, .1);
            const a = (i / 6 - .5) * 1.7;
            fe.position.set(Math.sin(a) * .22, Math.cos(a) * .22, -.12);
            fe.rotation.z = -a;
            fan.add(fe);
          }
          parent.add(fan);
          g.userData.fan = fan;
        }
        g.userData.chain = segs;
        break;
      }

      /* --- 翼 --- */
      case 'wing_bat': case 'wing_feather': {
        const sh = new THREE.Group();
        const bone = capsule(.035, .4, M);
        bone.rotation.z = Math.PI / 2; bone.position.x = .22; sh.add(bone);
        if (p.id === 'wing_bat') {
          const memb = new THREE.Mesh(new THREE.SphereGeometry(.34, 10, 8), accentMaterial(skin, 10, 40));
          memb.scale.set(1.5, .06, 1.1); memb.position.set(.34, -.04, -.1); sh.add(memb);
          for (let i = 0; i < 3; i++) {
            const rib = capsule(.018, .3, M);
            rib.rotation.z = Math.PI / 2 - .5 - i * .35;
            rib.position.set(.34, -.06, -.06 - i * .08);
            sh.add(rib);
          }
        } else {
          for (let i = 0; i < 7; i++) {
            const f = new THREE.Mesh(new THREE.SphereGeometry(.12, 7, 6), accentMaterial(skin, 25 + i * 8, 62));
            f.scale.set(1.9, .07, .38);
            f.position.set(.2 + i * .055, -.02, -.02 - i * .055);
            f.rotation.y = -i * .12;
            sh.add(f);
          }
        }
        g.add(sh);
        g.userData.wing = sh;
        break;
      }

      /* --- 武器 / 装饰 --- */
      case 'spike_back': {
        for (let i = 0; i < 5; i++) {
          const s = new THREE.Mesh(new THREE.ConeGeometry(.05 - i * .004, .22 + Math.sin(i / 4 * Math.PI) * .16, 5), A);
          s.position.set(0, .04, -.16 + i * .085);
          s.rotation.x = -.25; g.add(s);
        }
        break;
      }
      case 'horn': {
        const h = new THREE.Mesh(new THREE.ConeGeometry(.07, .42, 7), TOOTH);
        h.position.set(0, .16, .1); h.rotation.x = -.5; g.add(h);
        break;
      }
      case 'plate': {
        for (let i = 0; i < 4; i++) {
          const pl = new THREE.Mesh(new THREE.SphereGeometry(.2, 9, 7), accentMaterial(skin, 8, 34));
          pl.scale.set(1.1, .3, .7);
          pl.position.set(0, .06, -.18 + i * .13); g.add(pl);
        }
        break;
      }
      case 'frill': {
        const f = new THREE.Group();
        for (let i = 0; i < 9; i++) {
          const sp = new THREE.Mesh(new THREE.SphereGeometry(.14, 7, 6), accentMaterial(skin, 300, 50));
          sp.scale.set(.22, 1.5, .1);
          const a = (i / 8 - .5) * 2.4;
          sp.position.set(Math.sin(a) * .22, Math.cos(a) * .2 + .05, -.05);
          sp.rotation.z = -a; f.add(sp);
        }
        g.add(f); g.userData.fan = f;
        break;
      }
      case 'fin_dorsal': {
        const f = new THREE.Mesh(new THREE.SphereGeometry(.24, 9, 7), accentMaterial(skin, 190, 52));
        f.scale.set(.08, 1.0, 1.4); f.position.y = .18; g.add(f);
        break;
      }
      case 'gland_poison': {
        const s = new THREE.Mesh(new THREE.SphereGeometry(.13, 10, 8), new THREE.MeshStandardMaterial({ color: 0x66d43f, roughness: .35, emissive: 0x143a08 }));
        g.add(s); g.userData.pulse = s;
        break;
      }
      case 'sac_song': {
        const s = new THREE.Mesh(new THREE.SphereGeometry(.17, 12, 10), accentMaterial(skin, 340, 62));
        s.scale.set(1, .85, .9); g.add(s);
        g.userData.sac = s;
        break;
      }
    }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }

  /* ---- 完整生物模型 ---- */
  function build(g, opts) {
    opts = opts || {};
    const scale = opts.scale || 1;
    const skin = g.skin || { h: 30, s: 60, l: 50, pattern: 'none' };
    const mats = { body: skinMaterial(skin), accent: accentMaterial(skin) };

    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);

    const spine = g.spine && g.spine.length ? g.spine : [{ x: 0, y: 0, z: 0, r: .3 }];
    const nodes = [];
    // 身体：球体链 + 连接段
    for (let i = 0; i < spine.length; i++) {
      const s = spine[i];
      const n = new THREE.Group();
      n.position.set(s.x, s.y, s.z);
      const sp = new THREE.Mesh(new THREE.SphereGeometry(s.r, opts.simple ? 8 : 14, opts.simple ? 6 : 12), mats.body);
      sp.scale.set(1, .96, 1.04);
      n.add(sp);
      body.add(n);
      nodes.push(n);
      if (i > 0) {
        const a = spine[i - 1], b = s;
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const link = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(.04, b.r * .92), Math.max(.04, a.r * .92), len, opts.simple ? 6 : 10), mats.body);
        link.position.set(a.x + dx / 2, a.y + dy / 2, a.z + dz / 2);
        link.lookAt(new THREE.Vector3(b.x, b.y, b.z));
        link.rotateX(Math.PI / 2);
        body.add(link);
      }
    }

    const rig = { legs: [], arms: [], wings: [], tails: [], eyes: [], mouths: [], pulses: [], chains: [], fans: [], sacs: [], flames: [], body, nodes, standH: 0, scale };

    let maxLeg = 0;
    (g.parts || []).forEach(p => {
      const seg = U.clamp(p.seg | 0, 0, spine.length - 1);
      const node = nodes[seg];
      const s = spine[seg];
      const pg = buildPart(p, mats, skin);
      const side = p.side || 0;
      const off = p.off || [0, 0, 0];
      pg.position.set(side === 0 ? (off[0] || 0) : side * (off[0] || 0) * (s.r / .3), off[1] || 0, off[2] || 0);
      const ps = p.scale || 1;
      pg.scale.setScalar(ps);
      if (p.rot) pg.rotation.set(p.rot[0] || 0, p.rot[1] || 0, p.rot[2] || 0);
      if (side !== 0) pg.rotation.z += side * .18;
      node.add(pg);

      const ud = pg.userData;
      if (ud.leg) { ud.leg.side = side; ud.leg.group = pg; rig.legs.push(ud.leg); maxLeg = Math.max(maxLeg, ud.leg.len * ps); }
      if (ud.arm) { ud.arm.side = side; rig.arms.push(ud.arm); }
      if (ud.wing) rig.wings.push({ g: ud.wing, side });
      if (ud.chain) rig.chains.push(ud.chain);
      if (ud.eye) rig.eyes.push(ud.eye);
      if (ud.jaw) rig.mouths.push(ud.jaw);
      if (ud.pulse) rig.pulses.push(ud.pulse);
      if (ud.fan) rig.fans.push(ud.fan);
      if (ud.sac) rig.sacs.push(ud.sac);
      if (ud.flame) rig.flames.push(ud.flame);
    });

    // 站立高度：腿长 + 最低身体半径
    let minY = 999;
    spine.forEach(s => minY = Math.min(minY, s.y - s.r));
    rig.standH = maxLeg > 0 ? maxLeg + .06 : Math.max(.1, -minY);
    body.position.y = rig.standH;

    root.scale.setScalar(scale);
    root.userData.rig = rig;
    root.userData.genome = g;
    root.userData.mats = mats;
    root.userData.height = (rig.standH + (spine[spine.length - 1] ? spine[spine.length - 1].y + spine[spine.length - 1].r : .5)) * scale;
    return root;
  }

  /* ---- 动画 ---- */
  function animate(model, t, o) {
    if (!model || !model.userData.rig) return;
    const rig = model.userData.rig;
    o = o || {};
    const move = U.clamp(o.move == null ? 0 : o.move, 0, 1);
    const sp = o.speed || 1;
    const act = o.action || null;
    const phase = t * (4 + sp * 3.5);

    // 呼吸 / 上下起伏
    const breathe = Math.sin(t * 1.7) * .012;
    const bob = move > .02 ? Math.abs(Math.sin(phase)) * .045 * move : 0;
    rig.body.position.y = rig.standH + bob + breathe;
    rig.body.rotation.z = move > .02 ? Math.sin(phase) * .035 * move : Math.sin(t * .9) * .008;
    rig.body.rotation.x = (act === 'attack' ? .18 : 0) + (move > .02 ? .05 * move : 0);

    // 腿
    for (let i = 0; i < rig.legs.length; i++) {
      const L = rig.legs[i];
      const ph = phase + (i % 2 === 0 ? 0 : Math.PI) + Math.floor(i / 2) * .6;
      const sw = Math.sin(ph);
      L.hip.rotation.x = sw * .55 * move;
      L.knee.rotation.x = Math.max(0, -sw) * .8 * move + .12;
      L.ankle.rotation.x = -sw * .25 * move;
      if (move < .02) { L.hip.rotation.x = Math.sin(t * 1.4 + i) * .02; L.knee.rotation.x = .12; }
      if (L.side) L.hip.rotation.z = L.side * .12;
    }
    // 手臂
    for (let i = 0; i < rig.arms.length; i++) {
      const A = rig.arms[i];
      const ph = phase + (i % 2 === 0 ? Math.PI : 0);
      if (act === 'attack') {
        A.sh.rotation.x = -1.5 + Math.sin(t * 18) * .8;
        A.elbow.rotation.x = -.8;
      } else if (act === 'social') {
        A.sh.rotation.x = -1.1 + Math.sin(t * 6 + i) * .7;
        A.elbow.rotation.x = -.5 + Math.sin(t * 8 + i) * .4;
      } else {
        A.sh.rotation.x = Math.sin(ph) * .35 * move + Math.sin(t * 1.3 + i) * .04;
        A.elbow.rotation.x = -.25 - Math.abs(Math.sin(ph)) * .3 * move;
      }
      if (A.side) A.sh.rotation.z = A.side * .22;
    }
    // 翼
    rig.wings.forEach((W, i) => {
      const f = act === 'social' ? Math.sin(t * 9) * .8 : Math.sin(t * 2.2 + i) * .18 + move * .25;
      W.g.rotation.z = (W.side || 1) * (.1 + f * .5);
      W.g.rotation.x = Math.sin(t * 2.2 + i) * .1;
    });
    // 尾 / 鞭毛链
    rig.chains.forEach(chain => {
      for (let i = 0; i < chain.length; i++) {
        chain[i].rotation.y = Math.sin(t * (3 + sp) - i * .55) * (.16 + move * .12);
        chain[i].rotation.x = Math.sin(t * 2.2 - i * .4) * .06;
      }
    });
    // 嘴
    const jawOpen = act === 'attack' ? Math.max(0, Math.sin(t * 16)) * .6
      : act === 'eat' ? Math.abs(Math.sin(t * 10)) * .5
        : act === 'social' ? Math.abs(Math.sin(t * 7)) * .35 : Math.abs(Math.sin(t * 1.1)) * .04;
    rig.mouths.forEach(m => { m.rotation.x = jawOpen; });
    // 眼（眨眼 + 看向）
    rig.eyes.forEach((e, i) => {
      const blink = (Math.sin(t * .7 + i) > .985) ? .1 : 1;
      e.scale.y = blink;
    });
    // 发光腺体脉动
    rig.pulses.forEach((p, i) => {
      const s = 1 + Math.sin(t * 4 + i) * .12;
      p.scale.setScalar(s);
      if (p.material && p.material.emissiveIntensity !== undefined) p.material.emissiveIntensity = 1 + Math.sin(t * 6 + i) * .6;
    });
    // 鸣囊鼓起
    rig.sacs.forEach((s, i) => {
      const k = act === 'social' ? 1 + Math.abs(Math.sin(t * 5)) * .55 : 1 + Math.sin(t * 1.6 + i) * .06;
      s.scale.set(k, k * .9, k * .95);
    });
    // 扇尾/颈盾张开
    rig.fans.forEach(f => {
      const k = act === 'social' ? 1 + Math.abs(Math.sin(t * 3)) * .5 : 1;
      f.scale.set(k, k, 1);
    });
    // 喷射火焰
    rig.flames.forEach(f => {
      f.scale.setScalar(.4 + move * (1 + Math.sin(t * 20) * .3));
      if (f.material) f.material.opacity = .25 + move * .6;
    });
  }

  function tint(model, hsl) {
    if (!model || !model.userData.mats) return;
    const m = model.userData.mats;
    m.body.map = SP.Tex.skin(hsl[0], hsl[1], hsl[2], (model.userData.genome && model.userData.genome.skin.pattern) || 'none');
    m.body.needsUpdate = true;
    const c = new THREE.Color();
    c.setHSL(((hsl[0] + 30) % 360) / 360, U.clamp(hsl[1] / 100, 0, 1), U.clamp((hsl[2] - 14) / 100, .05, .95));
    m.accent.color.copy(c);
  }

  function dispose(model) {
    if (!model) return;
    model.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }

  /* 克隆一份基因组（存档/编辑用） */
  function clone(g) { return JSON.parse(JSON.stringify(g)); }

  return {
    PARTS, ABILITY_NAMES, COMBAT, SOCIAL,
    newCell, newCreature, random, randName,
    stats, abilities, cost, dietOf,
    build, animate, tint, dispose, clone,
    skinMaterial, accentMaterial
  };
})();
