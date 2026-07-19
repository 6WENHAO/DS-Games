/* =========================================================
   world.js — 体素星球：标准方块世界 + 空间弯曲成球
   ========================================================= */
const World = (() => {

  /* ---------- 方块定义 ---------- */
  // tiles: [top, side, bottom]
  const BLOCKS = [
    { id: 'air', solid: false },
    { id: 'grass', tiles: ['grass_top', 'grass_side', 'dirt'], hard: 0.7, drop: 'dirt', mat: 'grass' },
    { id: 'dirt', tiles: ['dirt', 'dirt', 'dirt'], hard: 0.7, drop: 'dirt', mat: 'dirt' },
    { id: 'stone', tiles: ['stone', 'stone', 'stone'], hard: 3.5, tool: 'pickaxe', drop: 'cobble', mat: 'stone' },
    { id: 'cobble', tiles: ['cobble', 'cobble', 'cobble'], hard: 3.2, tool: 'pickaxe', drop: 'cobble', mat: 'stone' },
    { id: 'sand', tiles: ['sand', 'sand', 'sand'], hard: 0.6, drop: 'sand', mat: 'sand' },
    { id: 'log', tiles: ['log_top', 'log_side', 'log_top'], hard: 1.6, drop: 'log', mat: 'wood' },
    { id: 'planks', tiles: ['planks', 'planks', 'planks'], hard: 1.4, drop: 'planks', mat: 'wood' },
    { id: 'leaves', tiles: ['leaves', 'leaves', 'leaves'], hard: 0.3, drop: null, dropChance: { stick: 0.15 }, mat: 'grass' },
    { id: 'glass', tiles: ['glass', 'glass', 'glass'], hard: 0.4, drop: null, mat: 'stone', transparent: true },
    { id: 'water', tiles: ['water', 'water', 'water'], solid: false, liquid: true, transparent: true },
    { id: 'gravel', tiles: ['gravel', 'gravel', 'gravel'], hard: 0.8, drop: 'gravel', mat: 'dirt' },
    { id: 'coal_ore', tiles: ['coal_ore', 'coal_ore', 'coal_ore'], hard: 4, tool: 'pickaxe', drop: 'coal', mat: 'stone' },
    { id: 'iron_ore', tiles: ['iron_ore', 'iron_ore', 'iron_ore'], hard: 4.5, tool: 'pickaxe', drop: 'iron_ingot', mat: 'stone' },
    { id: 'crystal_ore', tiles: ['crystal_ore', 'crystal_ore', 'crystal_ore'], hard: 4.5, tool: 'pickaxe', drop: 'crystal_shard', mat: 'stone' },
    { id: 'crystal_block', tiles: ['crystal_block', 'crystal_block', 'crystal_block'], hard: 3, tool: 'pickaxe', drop: 'crystal_shard', mat: 'stone', glow: 0.6 },
    { id: 'glowlamp', tiles: ['glowlamp', 'glowlamp', 'glowlamp'], hard: 0.9, drop: 'glowlamp', mat: 'wood', glow: 1 },
    { id: 'ancient_brick', tiles: ['ancient_brick', 'ancient_brick', 'ancient_brick'], hard: 9, tool: 'pickaxe', drop: 'ancient_brick', mat: 'stone' },
    { id: 'ancient_tablet', tiles: ['ancient_brick', 'ancient_tablet', 'ancient_brick'], hard: Infinity, mat: 'stone', glow: 0.5, interact: 'tablet' },
    { id: 'metal', tiles: ['metal', 'metal', 'metal'], hard: Infinity, mat: 'metal' },
    { id: 'metal_dark', tiles: ['metal_dark', 'metal_dark', 'metal_dark'], hard: Infinity, mat: 'metal' },
    { id: 'engine', tiles: ['metal_dark', 'engine', 'engine'], hard: Infinity, mat: 'metal', glow: 0.4 },
    { id: 'hull', tiles: ['hull', 'hull', 'hull'], hard: Infinity, mat: 'wood' },
    { id: 'launchpad', tiles: ['launchpad', 'launchpad', 'metal_dark'], hard: Infinity, mat: 'metal' },
    { id: 'basalt', tiles: ['basalt', 'basalt', 'basalt'], hard: 3.8, tool: 'pickaxe', drop: 'basalt', mat: 'stone' },
    { id: 'bedrock', tiles: ['bedrock', 'bedrock', 'bedrock'], hard: Infinity, mat: 'stone' },
    { id: 'chest', tiles: ['chest_top', 'chest_side', 'planks'], hard: Infinity, mat: 'wood', interact: 'chest' },
    { id: 'table', tiles: ['table_top', 'table_side', 'planks'], hard: 1.6, drop: 'table', mat: 'wood', interact: 'table' },
    { id: 'redsand', tiles: ['redsand', 'redsand', 'redsand'], hard: 0.6, drop: 'redsand', mat: 'sand' },
    { id: 'ice', tiles: ['ice', 'ice', 'ice'], hard: 0.8, drop: null, mat: 'stone' },
    { id: 'snow', tiles: ['snow', 'snow', 'snow'], hard: 0.5, drop: null, mat: 'sand' },
    { id: 'signal_stone', tiles: ['signal_stone', 'signal_stone', 'signal_stone'], hard: Infinity, mat: 'metal', glow: 0.7 },
    { id: 'telescope', tiles: ['telescope', 'telescope', 'metal_dark'], hard: Infinity, mat: 'metal', interact: 'telescope' },
    { id: 'campfire', tiles: ['log_top', 'log_side', 'log_top'], hard: Infinity, mat: 'wood', interact: 'campfire', glow: 1 },
  ];
  const BID = {}; BLOCKS.forEach((b, i) => { BID[b.id] = i; b.num = i; if (b.solid === undefined) b.solid = true; });

  /* ---------- 噪声 ---------- */
  function hash2(x, y, seed) {
    let h = seed + x * 374761393 + y * 668265263;
    h = (h ^ (h >>> 13)) >>> 0; h = Math.imul(h, 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function valueNoise(x, y, N, scale, seed) {
    // 周期化：保证绕行星一圈无缝
    const period = Math.max(1, Math.round(N / scale));
    const fx = x / scale, fy = y / scale;
    let x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const w = (a, b) => ((a % b) + b) % b;
    const v00 = hash2(w(x0, period), w(y0, period), seed), v10 = hash2(w(x0 + 1, period), w(y0, period), seed);
    const v01 = hash2(w(x0, period), w(y0 + 1, period), seed), v11 = hash2(w(x0 + 1, period), w(y0 + 1, period), seed);
    const a = v00 + (v10 - v00) * sx;
    const b = v01 + (v11 - v01) * sx;
    return a + (b - a) * sy;
  }
  function fbm(x, y, N, scale, seed, oct) {
    let v = 0, amp = 1, tot = 0, sc = scale;
    for (let i = 0; i < oct; i++) {
      v += valueNoise(x, y, N, sc, seed + i * 77) * amp;
      tot += amp; amp *= 0.5; sc = Math.max(2, sc / 2);
    }
    return v / tot;
  }

  /* ---------- 弯曲着色器 ---------- */
  const VSHADER = `
    uniform vec2 uPlayer; uniform float uN; uniform float uR;
    varying vec2 vUv; varying vec3 vColor; varying float vDist;
    void main() {
      vec4 wp4 = modelMatrix * vec4(position, 1.0);
      vec3 wp = wp4.xyz;
      vec2 d = wp.xz - uPlayer;
      d = mod(d + uN * 0.5, uN) - uN * 0.5;
      float dist = length(d);
      float theta = dist / uR;
      float r = uR + wp.y;
      vec2 dir = dist > 0.0001 ? d / dist : vec2(0.0);
      float s = r * sin(theta);
      vec3 curved = vec3(dir.x * s, r * cos(theta) - uR, dir.y * s);
      vUv = uv; vColor = color;
      vec4 mv = viewMatrix * vec4(curved, 1.0);
      vDist = length(mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`;
  const FSHADER = `
    uniform sampler2D uMap; uniform vec3 uLight; uniform vec3 uFogColor;
    uniform float uFogNear; uniform float uFogFar; uniform float uAlpha; uniform float uCutoff;
    varying vec2 vUv; varying vec3 vColor; varying float vDist;
    void main() {
      vec4 c = texture2D(uMap, vUv);
      if (c.a < uCutoff) discard;
      vec3 col = c.rgb * vColor * uLight;
      float f = smoothstep(uFogNear, uFogFar, vDist);
      col = mix(col, uFogColor, f);
      gl_FragColor = vec4(col, c.a * uAlpha * (1.0 - f * 0.0));
    }`;

  function makeCurvedMaterial(atlasTex, uniforms, opts) {
    opts = opts || {};
    return new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: atlasTex },
        uPlayer: uniforms.uPlayer, uN: uniforms.uN, uR: uniforms.uR,
        uLight: uniforms.uLight, uFogColor: uniforms.uFogColor,
        uFogNear: uniforms.uFogNear, uFogFar: uniforms.uFogFar,
        uAlpha: { value: opts.alpha !== undefined ? opts.alpha : 1 },
        uCutoff: { value: opts.cutoff !== undefined ? opts.cutoff : 0.5 },
      },
      vertexShader: VSHADER, fragmentShader: FSHADER,
      vertexColors: true,
      transparent: !!opts.transparent,
      depthWrite: opts.depthWrite !== undefined ? opts.depthWrite : true,
      side: THREE.FrontSide,
    });
  }

  /* ---------- 星球定义 ---------- */
  const PLANETS = {
    home: {
      id: 'home', name: '炉心星', N: 192, H: 64, sea: 0, curveK: 2.4, gravity: 26,
      sky: 0x8fc4e8, fog: 0xb8d8ee, light: [1, 1, 1], oxygen: true,
      orbit: 950, orbitSpeed: 0.008, orbitPhase: 0.6, spaceColors: ['#74ba4a', '#5a8f3a', '#3d6e8f'],
      desc: '你的家园。绿色的山丘与篝火。',
    },
    ember: {
      id: 'ember', name: '燧沙星', N: 128, H: 56, sea: 0, curveK: 2.0, gravity: 22,
      sky: 0xd8a468, fog: 0xe0b070, light: [1.05, 0.92, 0.8], oxygen: false,
      orbit: 520, orbitSpeed: 0.02, orbitPhase: 2.4, spaceColors: ['#c97440', '#a05228', '#e0a060'],
      desc: '离太阳最近的沙之星球。古族遗迹深埋沙下。',
    },
    brittle: {
      id: 'brittle', name: '碎空星', N: 144, H: 64, sea: 0, curveK: 2.1, gravity: 18,
      sky: 0x2a2438, fog: 0x353048, light: [0.75, 0.72, 0.85], oxygen: false,
      orbit: 1400, orbitSpeed: 0.006, orbitPhase: 4.2, spaceColors: ['#4a4a54', '#35304a', '#40e0ff'],
      desc: '玄武岩的破碎外壳，地下是发光的晶洞。',
    },
    deep: {
      id: 'deep', name: '风暴星', N: 160, H: 72, sea: 34, curveK: 2.2, gravity: 30,
      sky: 0x3a6a5a, fog: 0x4a8a70, light: [0.85, 1, 0.95], oxygen: false,
      orbit: 1900, orbitSpeed: 0.004, orbitPhase: 1.2, spaceColors: ['#3a8a6a', '#2a6a8a', '#e8f0f0'],
      desc: '无尽海洋包裹的星球，古塔耸入风暴。',
    },
    eye: {
      id: 'eye', name: '深空之眼', N: 96, H: 48, sea: 0, curveK: 1.5, gravity: 14,
      sky: 0x0a0a18, fog: 0x141428, light: [0.6, 0.62, 0.8], oxygen: false, hidden: true,
      orbit: 3200, orbitSpeed: 0.002, orbitPhase: 5.5, spaceColors: ['#20203a', '#101024', '#40e0ff'],
      desc: '比宇宙更古老的信号源。',
    },
  };

  /* ---------- 星球世界 ---------- */
  class PlanetWorld {
    constructor(def, atlasTex, edits) {
      this.def = def;
      this.N = def.N; this.H = def.H;
      this.R = (def.N / (2 * Math.PI)) * def.curveK;
      this.data = new Uint8Array(this.N * this.N * this.H);
      this.edits = edits || new Map(); // 循环内的方块修改
      this.specials = new Map();       // "x,y,z" -> {type, ...}
      this.npcs = [];
      this.signals = [];
      this.group = new THREE.Group();
      this.chunks = new Map();
      this.chunkSize = 16;
      this.atlasTex = atlasTex;
      this.uniforms = {
        uPlayer: { value: new THREE.Vector2(0, 0) },
        uN: { value: this.N }, uR: { value: this.R },
        uLight: { value: new THREE.Vector3(def.light[0], def.light[1], def.light[2]) },
        uFogColor: { value: new THREE.Color(def.fog) },
        uFogNear: { value: 38 }, uFogFar: { value: 105 },
      };
      this.matSolid = makeCurvedMaterial(atlasTex, this.uniforms, { cutoff: 0.5 });
      this.matWater = makeCurvedMaterial(atlasTex, this.uniforms, { cutoff: 0.05, alpha: 0.82, transparent: true, depthWrite: false });
      this.generate();
      this.applyEdits();
    }

    idx(x, y, z) { return (y * this.N + z) * this.N + x; }
    wrap(v) { const N = this.N; return ((v % N) + N) % N; }
    wrapD(d) { const N = this.N; return ((d + N / 2) % N + N) % N - N / 2; }

    get(x, y, z) {
      if (y < 0 || y >= this.H) return 0;
      return this.data[this.idx(this.wrap(Math.floor(x)), Math.floor(y), this.wrap(Math.floor(z)))];
    }
    setRaw(x, y, z, id) {
      if (y < 0 || y >= this.H) return;
      this.data[this.idx(this.wrap(x), y, this.wrap(z))] = id;
    }
    set(x, y, z, id, record) {
      x = this.wrap(Math.floor(x)); y = Math.floor(y); z = this.wrap(Math.floor(z));
      if (y < 0 || y >= this.H) return;
      this.setRaw(x, y, z, id);
      if (record) this.edits.set(x + ',' + y + ',' + z, id);
      this.remeshAt(x, z);
      if (x % this.chunkSize === 0) this.remeshAt(x - 1, z);
      if (x % this.chunkSize === this.chunkSize - 1) this.remeshAt(x + 1, z);
      if (z % this.chunkSize === 0) this.remeshAt(x, z - 1);
      if (z % this.chunkSize === this.chunkSize - 1) this.remeshAt(x, z + 1);
    }
    applyEdits() {
      for (const [k, id] of this.edits) {
        const [x, y, z] = k.split(',').map(Number);
        this.setRaw(x, y, z, id);
      }
    }
    surfaceY(x, z) {
      x = this.wrap(Math.floor(x)); z = this.wrap(Math.floor(z));
      for (let y = this.H - 1; y >= 0; y--) {
        const b = this.data[this.idx(x, y, z)];
        if (b !== 0 && b !== BID.water) return y;
      }
      return 0;
    }

    /* ----- 地形生成 ----- */
    generate() {
      const d = this.def, N = this.N;
      const S = { home: 1000, ember: 2000, brittle: 3000, deep: 4000, eye: 5000 }[d.id];
      for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
        let h;
        if (d.id === 'home') h = 26 + fbm(x, z, N, 48, S, 4) * 14;
        else if (d.id === 'ember') h = 22 + fbm(x, z, N, 40, S, 3) * 16;
        else if (d.id === 'brittle') h = 30 + fbm(x, z, N, 36, S, 4) * 10;
        else if (d.id === 'deep') h = 26 + Math.pow(fbm(x, z, N, 44, S, 4), 2.2) * 34;
        else h = 20 + fbm(x, z, N, 32, S, 3) * 6;
        h = Math.floor(h);
        this.colGen(x, z, h, d, S);
      }
      // 海洋
      if (d.sea > 0) {
        for (let z = 0; z < N; z++) for (let x = 0; x < N; x++)
          for (let y = d.sea; y > 0; y--) if (this.data[this.idx(x, y, z)] === 0) this.setRaw(x, y, z, BID.water); else break;
      }
      this.buildStructures();
    }

    colGen(x, z, h, d, S) {
      for (let y = 0; y <= Math.min(h, this.H - 1); y++) {
        let b;
        if (y <= 1) b = BID.bedrock;
        else if (d.id === 'home') {
          if (y === h) b = BID.grass;
          else if (y > h - 3) b = BID.dirt;
          else {
            b = BID.stone;
            const o = hash2(x * 3 + y * 7, z * 5 + y, S + 9);
            if (y < h - 4 && o < 0.045) b = BID.coal_ore;
            else if (y < h - 6 && o > 0.97) b = BID.iron_ore;
          }
        } else if (d.id === 'ember') {
          if (y > h - 4) b = (hash2(x, z, S) < 0.25 ? BID.redsand : BID.sand);
          else b = BID.stone;
        } else if (d.id === 'brittle') {
          // 表面裂隙 → 晶洞
          const crev = fbm(x, z, this.N, 20, S + 5, 3);
          const caveTop = 22, caveBot = 6;
          if (crev > 0.62 && y > caveBot && y < h - 1) { b = 0; }
          else if (y === h) b = BID.basalt;
          else if (y > caveTop) b = (hash2(x + y, z, S) < 0.06 ? BID.crystal_ore : BID.basalt);
          else if (y > caveBot) {
            // 晶洞层：顶与底
            const cv = fbm(x + 31, z + 17, this.N, 16, S + 8, 3);
            if (cv > 0.42 && y > caveBot + 1 && y < caveTop - 1) b = 0;
            else b = (hash2(x * 7, z * 3 + y, S + 2) < 0.18 ? BID.crystal_block : BID.basalt);
          } else b = BID.basalt;
        } else if (d.id === 'deep') {
          if (y === h && h > d.sea + 1) b = BID.grass;
          else if (y > h - 3) b = (h <= d.sea + 1 ? BID.sand : BID.dirt);
          else b = BID.stone;
        } else { // eye
          if (y === h) b = (hash2(x, z, S) < 0.4 ? BID.snow : BID.basalt);
          else b = BID.basalt;
        }
        if (b !== undefined && b !== null) this.setRaw(x, y, z, b);
      }
    }

    flatten(cx, cz, r, h, block, under) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dz * dz > r * r) continue;
        const x = this.wrap(cx + dx), z = this.wrap(cz + dz);
        for (let y = h + 1; y < this.H; y++) this.setRaw(x, y, z, 0);
        this.setRaw(x, h, z, block);
        for (let y = h - 1; y > h - 4; y--) this.setRaw(x, y, z, under);
      }
    }
    box(x0, y0, z0, w, hgt, dep, id, hollow) {
      for (let y = y0; y < y0 + hgt; y++) for (let z = z0; z < z0 + dep; z++) for (let x = x0; x < x0 + w; x++) {
        if (hollow && x > x0 && x < x0 + w - 1 && z > z0 && z < z0 + dep - 1 && y > y0 && y < y0 + hgt - 1) this.setRaw(this.wrap(x), y, this.wrap(z), 0);
        else this.setRaw(this.wrap(x), y, this.wrap(z), id);
      }
    }
    tree(x, z, y) {
      const h = 4 + Math.floor(hash2(x, z, 7) * 3);
      for (let i = 1; i <= h; i++) this.setRaw(x, y + i, z, BID.log);
      for (let dy = h - 1; dy <= h + 1; dy++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy - h) > 4) continue;
        const xx = this.wrap(x + dx), zz = this.wrap(z + dz);
        if (this.data[this.idx(xx, y + dy, zz)] === 0) this.setRaw(xx, y + dy, zz, BID.leaves);
      }
      this.setRaw(x, y + h + 2, z, BID.leaves);
    }

    addSpecial(x, y, z, data) { this.specials.set(this.wrap(x) + ',' + y + ',' + this.wrap(z), data); }
    getSpecial(x, y, z) { return this.specials.get(this.wrap(Math.floor(x)) + ',' + Math.floor(y) + ',' + this.wrap(Math.floor(z))); }

    buildStructures() {
      const d = this.def;
      if (d.id === 'home') this.buildHome();
      if (d.id === 'ember') this.buildEmber();
      if (d.id === 'brittle') this.buildBrittle();
      if (d.id === 'deep') this.buildDeep();
      if (d.id === 'eye') this.buildEye();
    }

    buildHome() {
      const hV = 30;
      // 村庄平台
      this.flatten(28, 28, 15, hV, BID.grass, BID.dirt);
      // 篝火
      this.setRaw(28, hV + 1, 28, BID.campfire);
      this.addSpecial(28, hV + 1, 28, { type: 'campfire' });
      this.signals.push({ x: 28, z: 28, name: '篝火乐声', kind: 'camp' });
      // 原木凳
      this.setRaw(26, hV + 1, 28, BID.log); this.setRaw(30, hV + 1, 28, BID.log);
      // 博物馆小屋
      this.box(34, hV + 1, 24, 7, 5, 7, BID.planks, true);
      this.setRaw(34, hV + 2, 27, 0); this.setRaw(34, hV + 3, 27, 0); // 门
      this.setRaw(33, hV + 1, 27, BID.planks); // 门口台阶
      this.setRaw(34, hV + 3, 24, BID.glass); this.setRaw(37, hV + 3, 24, BID.glass);
      this.setRaw(37, hV + 4, 27, BID.glowlamp);
      this.setRaw(38, hV + 2, 25, BID.chest);
      this.addSpecial(38, hV + 2, 25, { type: 'chest', loot: 'museum_gear', name: '探险装备箱' });
      this.setRaw(38, hV + 2, 29, BID.chest);
      this.addSpecial(38, hV + 2, 29, { type: 'chest', loot: 'museum_food', name: '补给箱' });
      this.setRaw(36, hV + 2, 29, BID.table);
      // 工作台露天一个
      this.setRaw(25, hV + 1, 31, BID.table);
      // 天文台（高台 + 石塔 + 外部阶梯）
      this.flatten(12, 44, 7, hV + 6, BID.cobble, BID.stone);
      this.box(9, hV + 7, 41, 7, 6, 7, BID.cobble, true);
      this.box(9, hV + 13, 41, 7, 1, 7, BID.planks); // 塔顶平台
      this.setRaw(12, hV + 14, 44, BID.telescope);
      this.addSpecial(12, hV + 14, 44, { type: 'telescope' });
      this.setRaw(9, hV + 14, 41, BID.glowlamp); this.setRaw(15, hV + 14, 47, BID.glowlamp);
      this.setRaw(9, hV + 14, 47, BID.glowlamp); this.setRaw(15, hV + 14, 41, BID.glowlamp);
      // 外部阶梯：沿塔东侧 x=16/17，从高台逐级到塔顶
      for (let k = 0; k <= 6; k++) {
        const z = 48 - k;
        for (const sx of [16, 17]) {
          for (let y = hV + 6; y <= hV + 7 + k; y++) this.setRaw(sx, y, z, BID.cobble);
          for (let y = hV + 8 + k; y <= hV + 11 + k; y++) this.setRaw(sx, y, z, 0);
        }
      }
      // 从村庄到高台的土坡（每级 +1 可跳跃通行）
      const rampPath = [[21, 36], [20, 37], [19, 38], [18, 39], [18, 40]];
      for (let i = 0; i < rampPath.length; i++) {
        const [px, pz] = rampPath[i];
        const top = hV + 1 + i;
        for (let y = top; y > hV - 2; y--) this.setRaw(px, y, pz, BID.dirt);
        this.setRaw(px, top, pz, BID.grass);
        for (let y = top + 1; y <= top + 3; y++) this.setRaw(px, y, pz, 0);
      }
      // 发射台 + 飞船
      this.flatten(42, 34, 4, hV, BID.launchpad, BID.stone);
      this.shipPos = { x: 42, y: hV + 1, z: 34 };
      // 矿洞入口
      const mx = 16, mz = 16;
      const mh = this.surfaceY(mx, mz);
      for (let i = 0; i < 10; i++) {
        const y = mh - 1 - Math.floor(i * 0.8);
        this.setRaw(this.wrap(mx - i), y, mz, 0); this.setRaw(this.wrap(mx - i), y + 1, mz, 0); this.setRaw(this.wrap(mx - i), y + 2, mz, 0);
        if (i % 3 === 0) this.setRaw(this.wrap(mx - i), y, mz + 1, BID.glowlamp);
      }
      for (let i = 0; i < 5; i++) {
        this.setRaw(this.wrap(mx - 10 - i), mh - 9, this.wrap(mz + i), BID.coal_ore);
        this.setRaw(this.wrap(mx - 11 - i), mh - 8, this.wrap(mz - i), BID.iron_ore);
      }
      // 树木
      for (let i = 0; i < 46; i++) {
        const x = Math.floor(hash2(i, 1, 501) * this.N), z = Math.floor(hash2(i, 2, 502) * this.N);
        const dx = this.wrapD(x - 28), dz = this.wrapD(z - 28);
        if (dx * dx + dz * dz < 400) continue;
        const y = this.surfaceY(x, z);
        if (this.data[this.idx(x, y, z)] === BID.grass) this.tree(x, z, y);
      }
      // NPC
      this.npcs.push(
        { id: 'elder', x: 27, z: 26.5, yaw: 2.4 },
        { id: 'curator', x: 36.5, z: 27.5, yaw: -1.6, y: hV + 2 },
        { id: 'astronomer', x: 13.5, z: 44.5, yaw: 2.2, y: hV + 14 },
      );
      this.spawn = { x: 28.5, y: hV + 2, z: 30.5 };
    }

    buildEmber() {
      // 埋藏的古族穹顶
      const cx = 64, cz = 64;
      const baseY = 16;
      const surf = this.surfaceY(cx, cz);
      // 穹顶外壳（顶盖为可挖的沙层，底部为古族砖）
      for (let dy = -5; dy <= 5; dy++) for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) {
        const dd = Math.sqrt(dx * dx + dy * dy * 1.4 + dz * dz);
        const x = this.wrap(cx + dx), y = baseY + 5 + dy, z = this.wrap(cz + dz);
        if (y < 2 || y >= this.H) continue;
        if (dd <= 6 && dd > 4.6) {
          if (dy >= 4) this.setRaw(x, y, z, BID.sand); // 顶盖沙层：信标下方即可挖穿
          else this.setRaw(x, y, z, BID.ancient_brick);
        }
        else if (dd <= 4.6) this.setRaw(x, y, z, 0);
      }
      // 石板与灯
      this.setRaw(cx, baseY + 1, cz, BID.ancient_brick);
      this.setRaw(cx, baseY + 2, cz, BID.ancient_tablet);
      this.addSpecial(cx, baseY + 2, cz, { type: 'tablet', tid: 'ember_tablet' });
      this.setRaw(cx - 3, baseY + 1, cz - 3, BID.glowlamp);
      this.setRaw(cx + 3, baseY + 1, cz + 3, BID.glowlamp);
      // 信标塔（指示挖掘点，塔旁即是沙质顶盖）
      for (let i = 1; i <= 4; i++) this.setRaw(cx + 1, surf + i, cz + 1, BID.signal_stone);
      this.signals.push({ x: cx, z: cz, name: '古族信标·沙', kind: 'ancient' });
      // 着陆区
      this.flatten(40, 40, 4, this.surfaceY(40, 40), BID.launchpad, BID.stone);
      this.shipPos = { x: 40, y: this.surfaceY(40, 40) + 1, z: 40 };
      this.spawn = { x: 42.5, y: this.surfaceY(42, 42) + 2, z: 42.5 };
      // 晶石尖柱景观
      for (let i = 0; i < 14; i++) {
        const x = Math.floor(hash2(i, 5, 601) * this.N), z = Math.floor(hash2(i, 6, 602) * this.N);
        const y = this.surfaceY(x, z);
        const h = 2 + Math.floor(hash2(i, 7, 603) * 4);
        for (let j = 1; j <= h; j++) this.setRaw(x, y + j, z, BID.crystal_block);
      }
    }

    buildBrittle() {
      // 晶洞内的石板：在一个裂隙下方
      const cx = 72, cz = 72;
      // 保证此处有洞
      for (let y = 10; y <= this.surfaceY(cx, cz) + 2; y++) { this.setRaw(cx, y, cz, 0); this.setRaw(cx + 1, y, cz, 0); this.setRaw(cx, y, cz + 1, 0); }
      this.box(cx - 3, 7, cz - 3, 7, 1, 7, BID.crystal_block);
      this.setRaw(cx, 8, cz, BID.ancient_brick);
      this.setRaw(cx, 9, cz, BID.ancient_tablet);
      this.addSpecial(cx, 9, cz, { type: 'tablet', tid: 'brittle_tablet' });
      this.setRaw(cx - 2, 8, cz - 2, BID.glowlamp); this.setRaw(cx + 2, 8, cz + 2, BID.glowlamp);
      const surf = this.surfaceY(cx, cz - 4);
      for (let i = 1; i <= 4; i++) this.setRaw(cx, surf + i, cz - 4, BID.signal_stone);
      this.signals.push({ x: cx, z: cz, name: '古族信标·晶', kind: 'ancient' });
      this.flatten(30, 30, 4, this.surfaceY(30, 30), BID.launchpad, BID.basalt);
      this.shipPos = { x: 30, y: this.surfaceY(30, 30) + 1, z: 30 };
      this.spawn = { x: 32.5, y: this.surfaceY(32, 32) + 2, z: 32.5 };
    }

    buildDeep() {
      // 找最高的岛放塔
      let bx = 80, bz = 80, bh = 0;
      for (let z = 0; z < this.N; z += 4) for (let x = 0; x < this.N; x += 4) {
        const h = this.surfaceY(x, z);
        if (h > bh) { bh = h; bx = x; bz = z; }
      }
      this.flatten(bx, bz, 5, bh, BID.grass, BID.dirt);
      // 古塔
      const towerTop = Math.min(this.H - 6, bh + 16);
      this.box(bx - 2, bh + 1, bz - 2, 5, towerTop - bh, 5, BID.ancient_brick, true);
      this.box(bx - 3, towerTop, bz - 3, 7, 1, 7, BID.ancient_brick);
      // 外墙歇脚台（供喷气背包中途回气）
      for (let ly = bh + 4; ly < towerTop; ly += 4) {
        this.setRaw(bx - 3, ly, bz, BID.ancient_brick); this.setRaw(bx + 3, ly, bz, BID.ancient_brick);
        this.setRaw(bx, ly, bz - 3, BID.ancient_brick); this.setRaw(bx, ly, bz + 3, BID.ancient_brick);
      }
      this.setRaw(bx, towerTop + 1, bz, BID.ancient_tablet);
      this.addSpecial(bx, towerTop + 1, bz, { type: 'tablet', tid: 'deep_tablet' });
      this.setRaw(bx - 2, towerTop + 1, bz - 2, BID.glowlamp); this.setRaw(bx + 2, towerTop + 1, bz + 2, BID.glowlamp);
      this.signals.push({ x: bx, z: bz, name: '古族信标·浪', kind: 'ancient' });
      // 着陆岛
      let lx = bx + 20, lz = bz + 8;
      const lh = Math.max(this.surfaceY(lx, lz), this.def.sea + 2);
      this.flatten(lx, lz, 4, lh, BID.launchpad, BID.stone);
      this.shipPos = { x: lx, y: lh + 1, z: lz };
      this.spawn = { x: lx + 2.5, y: lh + 2, z: lz + 2.5 };
      this.towerPos = { x: bx, z: bz };
    }

    buildEye() {
      const cx = 48, cz = 48;
      const h = this.surfaceY(cx, cz);
      this.flatten(cx, cz, 6, h, BID.basalt, BID.basalt);
      // 环形碑阵
      for (let a = 0; a < 8; a++) {
        const x = this.wrap(cx + Math.round(Math.cos(a * Math.PI / 4) * 5));
        const z = this.wrap(cz + Math.round(Math.sin(a * Math.PI / 4) * 5));
        this.setRaw(x, h + 1, z, BID.ancient_brick);
        this.setRaw(x, h + 2, z, BID.crystal_block);
      }
      this.setRaw(cx, h + 1, cz, BID.ancient_brick);
      this.setRaw(cx, h + 2, cz, BID.ancient_tablet);
      this.addSpecial(cx, h + 2, cz, { type: 'tablet', tid: 'eye_core' });
      this.signals.push({ x: cx, z: cz, name: '深空之眼', kind: 'eye' });
      this.flatten(30, 60, 4, this.surfaceY(30, 60), BID.launchpad, BID.basalt);
      this.shipPos = { x: 30, y: this.surfaceY(30, 60) + 1, z: 60 };
      this.spawn = { x: 32.5, y: this.surfaceY(32, 62) + 2, z: 62.5 };
    }

    /* ----- 分块建模 ----- */
    remeshAt(x, z) {
      const cs = this.chunkSize;
      const cx = Math.floor(this.wrap(x) / cs), cz = Math.floor(this.wrap(z) / cs);
      const key = cx + ',' + cz;
      const c = this.chunks.get(key);
      if (c) { this.disposeChunk(c); this.chunks.delete(key); }
      this.buildChunk(cx, cz);
    }
    disposeChunk(c) {
      if (c.solid) { this.group.remove(c.solid); c.solid.geometry.dispose(); }
      if (c.water) { this.group.remove(c.water); c.water.geometry.dispose(); }
    }
    ensureAll() {
      const n = Math.ceil(this.N / this.chunkSize);
      for (let cz = 0; cz < n; cz++) for (let cx = 0; cx < n; cx++) {
        if (!this.chunks.has(cx + ',' + cz)) this.buildChunk(cx, cz);
      }
    }
    updateVisibility(px, pz, viewDist) {
      const cs = this.chunkSize;
      for (const [key, c] of this.chunks) {
        const [cx, cz] = key.split(',').map(Number);
        const dx = this.wrapD(cx * cs + cs / 2 - px), dz = this.wrapD(cz * cs + cs / 2 - pz);
        const vis = Math.sqrt(dx * dx + dz * dz) < viewDist + cs;
        if (c.solid) c.solid.visible = vis;
        if (c.water) c.water.visible = vis;
      }
    }

    buildChunk(cx, cz) {
      const cs = this.chunkSize, N = this.N, H = this.H;
      const sol = { pos: [], uv: [], col: [], idx: [] };
      const wat = { pos: [], uv: [], col: [], idx: [] };
      const x0 = cx * cs, z0 = cz * cs;
      for (let z = z0; z < z0 + cs; z++) for (let x = x0; x < x0 + cs; x++) {
        for (let y = 0; y < H; y++) {
          const id = this.data[this.idx(x, y, z)];
          if (id === 0) continue;
          const b = BLOCKS[id];
          const isWater = !!b.liquid;
          const buf = isWater ? wat : sol;
          for (let f = 0; f < 6; f++) {
            const [dx, dy, dz] = FACE_DIRS[f];
            const nx = this.wrap(x + dx), ny = y + dy, nz = this.wrap(z + dz);
            let nb = 0;
            if (ny >= 0 && ny < H) nb = this.data[this.idx(nx, ny, nz)];
            const nBlock = BLOCKS[nb];
            let show;
            if (isWater) show = (nb === 0) || (!nBlock.liquid && (nBlock.transparent || !nBlock.solid));
            else show = (nb === 0) || nBlock.liquid || nBlock.transparent === true;
            if (nb === id) show = false;
            if (!show) continue;
            this.pushFace(buf, x, y, z, f, b, isWater);
          }
        }
      }
      const c = {};
      if (sol.idx.length) c.solid = this.makeMesh(sol, this.matSolid);
      if (wat.idx.length) c.water = this.makeMesh(wat, this.matWater);
      this.chunks.set(cx + ',' + cz, c);
    }

    pushFace(buf, x, y, z, f, b, isWater) {
      const tiles = b.tiles;
      const tileName = f === 2 ? tiles[0] : (f === 3 ? tiles[2] : tiles[1]);
      const [u0, v0, uw, vh] = Assets.tileUV(tileName);
      const verts = FACE_VERTS[f];
      const base = buf.pos.length / 3;
      const shade = FACE_SHADE[f];
      const glow = b.glow || 0;
      const yTop = isWater ? 0.88 : 1;
      for (let i = 0; i < 4; i++) {
        const v = verts[i];
        buf.pos.push(x + v[0], y + v[1] * yTop, z + v[2]);
        buf.uv.push(u0 + v[3] * uw, v0 + (1 - v[4]) * vh);
        // 简易 AO
        let ao = 1;
        if (!isWater && glow === 0) {
          const ox = v[0] === 0 ? -1 : 1, oy = v[1] === 0 ? -1 : 1, oz = v[2] === 0 ? -1 : 1;
          let n = 0;
          if (this.solidAt(x + ox, y + oy, z)) n++;
          if (this.solidAt(x, y + oy, z + oz)) n++;
          if (this.solidAt(x + ox, y + oy, z + oz)) n++;
          if (f !== 3) ao = 1 - n * 0.08;
        }
        const l = Math.min(1.35, shade * ao + glow * 0.5);
        buf.col.push(l, l, l);
      }
      buf.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    solidAt(x, y, z) {
      const b = BLOCKS[this.get(x, y, z)];
      return b && b.solid && !b.transparent;
    }

    makeMesh(buf, mat) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(buf.pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(buf.col, 3));
      g.setIndex(buf.idx);
      const m = new THREE.Mesh(g, mat);
      m.frustumCulled = false;
      this.group.add(m);
      return m;
    }

    /* ----- 射线（平直空间 DDA） ----- */
    raycast(ox, oy, oz, dx, dy, dz, maxDist) {
      let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
      const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
      const tDX = Math.abs(1 / (dx || 1e-9)), tDY = Math.abs(1 / (dy || 1e-9)), tDZ = Math.abs(1 / (dz || 1e-9));
      let tX = (dx > 0 ? (x + 1 - ox) : (ox - x)) * tDX;
      let tY = (dy > 0 ? (y + 1 - oy) : (oy - y)) * tDY;
      let tZ = (dz > 0 ? (z + 1 - oz) : (oz - z)) * tDZ;
      let face = null, t = 0;
      for (let i = 0; i < 120; i++) {
        if (tX < tY && tX < tZ) { x += stepX; t = tX; tX += tDX; face = [-stepX, 0, 0]; }
        else if (tY < tZ) { y += stepY; t = tY; tY += tDY; face = [0, -stepY, 0]; }
        else { z += stepZ; t = tZ; tZ += tDZ; face = [0, 0, -stepZ]; }
        if (t > maxDist) return null;
        const id = this.get(x, y, z);
        if (id !== 0 && !BLOCKS[id].liquid) {
          return { x: this.wrap(x), y, z: this.wrap(z), id, face, dist: t };
        }
      }
      return null;
    }

    dispose() {
      for (const c of this.chunks.values()) this.disposeChunk(c);
      this.chunks.clear();
      this.matSolid.dispose(); this.matWater.dispose();
    }
  }

  const FACE_DIRS = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  const FACE_SHADE = [0.62, 0.62, 1.0, 0.5, 0.8, 0.8];
  // 每面 4 顶点: [x,y,z,u,v]
  const FACE_VERTS = [
    [[1,0,1,0,0],[1,0,0,1,0],[1,1,0,1,1],[1,1,1,0,1]],
    [[0,0,0,0,0],[0,0,1,1,0],[0,1,1,1,1],[0,1,0,0,1]],
    [[0,1,1,0,0],[1,1,1,1,0],[1,1,0,1,1],[0,1,0,0,1]],
    [[0,0,0,0,0],[1,0,0,1,0],[1,0,1,1,1],[0,0,1,0,1]],
    [[0,0,1,0,0],[1,0,1,1,0],[1,1,1,1,1],[0,1,1,0,1]],
    [[1,0,0,0,0],[0,0,0,1,0],[0,1,0,1,1],[1,1,0,0,1]],
  ];

  /* ---------- 用图集贴图构建盒子网格（飞船/NPC 用） ---------- */
  function makeBoxGeo(w, h, d, tileNames, shadeMul) {
    // tileNames: {px,nx,py,ny,pz,nz} 或统一字符串
    const g = { pos: [], uv: [], col: [], idx: [] };
    const names = typeof tileNames === 'string'
      ? { px: tileNames, nx: tileNames, py: tileNames, ny: tileNames, pz: tileNames, nz: tileNames }
      : tileNames;
    const order = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
    for (let f = 0; f < 6; f++) {
      const [u0, v0, uw, vh] = Assets.tileUV(names[order[f]]);
      const verts = FACE_VERTS[f];
      const base = g.pos.length / 3;
      const shade = FACE_SHADE[f] * (shadeMul || 1);
      for (let i = 0; i < 4; i++) {
        const v = verts[i];
        g.pos.push((v[0] - 0.5) * w, (v[1] - 0.5) * h, (v[2] - 0.5) * d);
        g.uv.push(u0 + v[3] * uw, v0 + (1 - v[4]) * vh);
        g.col.push(shade, shade, shade);
      }
      g.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(g.col, 3));
    geo.setIndex(g.idx);
    return geo;
  }

  return { BLOCKS, BID, PLANETS, PlanetWorld, makeCurvedMaterial, makeBoxGeo, fbm, hash2 };
})();
