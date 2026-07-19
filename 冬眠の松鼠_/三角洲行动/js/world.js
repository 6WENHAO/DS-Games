/* ===== 世界：零号大坝（风格化还原） ===== */
"use strict";

const World = {
  scene: null, camera: null, renderer: null,
  colliders: [],      // {min:{x,y,z}, max:{x,y,z}}
  ramps: [],          // {x1,z1,x2,z2,y1,y2,axis,minX,maxX,minZ,maxZ}
  solidMeshes: [],    // 可被子弹命中的网格
  containers: [],     // 可搜索容器
  extracts: [],       // 撤离点
  spawns: [],
  enemySpawns: [],
  tracers: [], flashes: [], burnZones: [],
  mapBounds: { min: -160, max: 160 },
  raycaster: null,

  initRenderer() {
    if (this.renderer) return;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    document.getElementById("canvas-wrap").appendChild(this.renderer.domElement);
    window.addEventListener("resize", () => this.syncSize());
  },

  /* 保证画布始终铺满窗口（否则会出现黑边且准星与弹道错位） */
  syncSize() {
    if (!this.renderer) return;
    const w = window.innerWidth, h = window.innerHeight;
    const c = this.renderer.domElement;
    if (c.clientWidth !== w || c.clientHeight !== h) {
      this.renderer.setSize(w, h);
    }
    if (this.camera && Math.abs(this.camera.aspect - w / h) > 1e-4) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  },

  _matCache: {},
  _texCache: {},

  /* 加载内嵌 CC0 贴图（ambientCG） */
  tex(name, srgb) {
    if (!this._texCache[name]) {
      const t = new THREE.TextureLoader().load(TEXTURE_DATA[name]);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      if (srgb) t.encoding = THREE.sRGBEncoding;
      t.anisotropy = this.renderer ? Math.min(8, this.renderer.capabilities.getMaxAnisotropy()) : 8;
      this._texCache[name] = t;
    }
    return this._texCache[name];
  },

  /* 各贴图的金属度（喷漆金属/花纹钢板有反射感） */
  _metalness: { metal: 0.55, plates: 0.6 },

  mat(color, texName, extra) {
    const key = color + "|" + (texName || "") + "|" + JSON.stringify(extra || {});
    if (!this._matCache[key]) {
      if (texName && typeof TEXTURE_DATA !== "undefined" && TEXTURE_DATA[texName]) {
        const params = {
          color,
          map: this.tex(texName, true),
          normalMap: this.tex(texName + "_n", false),
          roughness: 1.0,
          metalness: this._metalness[texName] || 0.0,
          envMapIntensity: 0.7
        };
        if (TEXTURE_DATA[texName + "_r"]) params.roughnessMap = this.tex(texName + "_r", false);
        this._matCache[key] = new THREE.MeshStandardMaterial(Object.assign(params, extra || {}));
      } else {
        this._matCache[key] = new THREE.MeshLambertMaterial(Object.assign({ color }, extra || {}));
      }
    }
    return this._matCache[key];
  },

  /* 按世界尺寸缩放 BoxGeometry 的 UV，保证贴图密度统一（s = 每米重复数） */
  scaleBoxUV(geo, w, h, d, s) {
    const uv = geo.attributes.uv;
    if (!uv) return;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) {
      const du = dims[f][0] * s, dv = dims[f][1] * s;
      for (let i = 0; i < 4; i++) {
        const idx = f * 4 + i;
        uv.setXY(idx, uv.getX(idx) * du, uv.getY(idx) * dv);
      }
    }
    uv.needsUpdate = true;
  },

  /* 添加一个盒子：网格 + 碰撞 + 可命中 */
  box(cx, cy, cz, w, h, d, color, opts) {
    opts = opts || {};
    const geo = new THREE.BoxGeometry(w, h, d);
    if (opts.tex) this.scaleBoxUV(geo, w, h, d, opts.uvScale || 0.4);
    const mesh = new THREE.Mesh(geo, this.mat(color, opts.tex, opts.mat));
    mesh.position.set(cx, cy, cz);
    if (opts.rotY) mesh.rotation.y = opts.rotY;
    mesh.castShadow = !opts.noShadow;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    if (!opts.noCollide && !opts.rotY) {
      this.colliders.push({
        min: { x: cx - w/2, y: cy - h/2, z: cz - d/2 },
        max: { x: cx + w/2, y: cy + h/2, z: cz + d/2 }
      });
    }
    if (!opts.noHit) this.solidMeshes.push(mesh);
    return mesh;
  },

  /* 坡道：沿 axis 从低到高 */
  ramp(cx, cz, w, len, y1, y2, axis, color) {
    const h = 0.3;
    const geo = new THREE.BoxGeometry(axis === "x" ? len : w, h, axis === "x" ? w : len);
    this.scaleBoxUV(geo, axis === "x" ? len : w, h, axis === "x" ? w : len, 0.4);
    const mesh = new THREE.Mesh(geo, this.mat(color || 0xb8bcbf, "concrete"));
    const midY = (y1 + y2) / 2;
    mesh.position.set(cx, midY, cz);
    const ang = Math.atan2(y2 - y1, len);
    if (axis === "x") mesh.rotation.z = ang; else mesh.rotation.x = -ang;
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.solidMeshes.push(mesh);
    const halfW = w / 2, halfL = len / 2;
    this.ramps.push({
      axis, y1, y2,
      minX: axis === "x" ? cx - halfL : cx - halfW,
      maxX: axis === "x" ? cx + halfL : cx + halfW,
      minZ: axis === "x" ? cz - halfW : cz - halfL,
      maxZ: axis === "x" ? cz + halfW : cz + halfL
    });
    return mesh;
  },

  rampHeightAt(x, z) {
    let y = null;
    for (const r of this.ramps) {
      if (x < r.minX || x > r.maxX || z < r.minZ || z > r.maxZ) continue;
      let t;
      if (r.axis === "x") t = (x - r.minX) / (r.maxX - r.minX);
      else t = (z - r.minZ) / (r.maxZ - r.minZ);
      const h = r.y1 + (r.y2 - r.y1) * t;
      if (y === null || h > y) y = h;
    }
    return y;
  },

  /* 建筑：地板 + 四面墙（带门洞窗洞） */
  building(cx, cz, w, d, h, wallColor, doors) {
    const t = 0.4;
    const wallOpts = { tex: "concrete", uvScale: 0.35 };
    this.box(cx, 0.08, cz, w, 0.16, d, 0xb0b3ae, { noHit: true, tex: "concrete", uvScale: 0.3 });
    this.box(cx, h + t/2, cz, w + 0.2, t, d + 0.2, 0x848b91, { tex: "plates", uvScale: 0.3 });
    const mkWall = (side) => {
      const horizontal = (side === "n" || side === "s");
      const wallLen = horizontal ? w : d;
      const wz = side === "n" ? cz - d/2 : cz + d/2;
      const wx = side === "w" ? cx - w/2 : cx + w/2;
      const doorList = (doors || []).filter(dd => dd.side === side);
      let segs = [{ a: -wallLen/2, b: wallLen/2 }];
      for (const dd of doorList) {
        const next = [];
        for (const s of segs) {
          if (dd.off - dd.w/2 > s.a) next.push({ a: s.a, b: Math.min(s.b, dd.off - dd.w/2) });
          if (dd.off + dd.w/2 < s.b) next.push({ a: Math.max(s.a, dd.off + dd.w/2), b: s.b });
        }
        segs = next;
      }
      for (const s of segs) {
        const len = s.b - s.a;
        if (len < 0.05) continue;
        const mid = (s.a + s.b) / 2;
        if (horizontal) this.box(cx + mid, h/2, wz, len, h, t, wallColor, wallOpts);
        else this.box(wx, h/2, cz + mid, t, h, len, wallColor, wallOpts);
      }
      for (const dd of doorList) {
        if (!dd.window) {
          const lintelH = h - 2.2;
          if (lintelH > 0.05) {
            if (horizontal) this.box(cx + dd.off, 2.2 + lintelH/2, wz, dd.w, lintelH, t, wallColor, wallOpts);
            else this.box(wx, 2.2 + lintelH/2, cz + dd.off, t, lintelH, dd.w, wallColor, wallOpts);
          }
        } else {
          if (horizontal) {
            this.box(cx + dd.off, 0.55, wz, dd.w, 1.1, t, wallColor, wallOpts);
            const topH = h - 2.1;
            if (topH > 0.05) this.box(cx + dd.off, 2.1 + topH/2, wz, dd.w, topH, t, wallColor, wallOpts);
          } else {
            this.box(wx, 0.55, cz + dd.off, t, 1.1, dd.w, wallColor, wallOpts);
            const topH = h - 2.1;
            if (topH > 0.05) this.box(wx, 2.1 + topH/2, cz + dd.off, t, topH, dd.w, wallColor, wallOpts);
          }
        }
      }
    };
    ["n","s","w","e"].forEach(mkWall);
  },

  addContainer(type, x, z, opts) {
    opts = opts || {};
    const looks = {
      crate:    { w: 1.1, h: 0.8, d: 0.8, color: 0xc9b58a, tex: "wood" },
      toolbox:  { w: 0.9, h: 0.6, d: 0.6, color: 0xc25a48, tex: "plates" },
      medbox:   { w: 0.8, h: 0.6, d: 0.6, color: 0xe8eef2, tex: "plates" },
      ammobox:  { w: 0.9, h: 0.55, d: 0.6, color: 0x87a06c, tex: "metal" },
      weaponbox:{ w: 1.6, h: 0.55, d: 0.7, color: 0x6d8a87, tex: "plates" },
      safe:     { w: 0.8, h: 1.1, d: 0.8, color: 0x5d6b75, tex: "plates" },
      rare:     { w: 1.3, h: 0.8, d: 0.8, color: 0xd8b04a, tex: "plates" },
      aircase:  { w: 1.4, h: 0.9, d: 0.9, color: 0x6f9e78, tex: "metal" }
    };
    const lk = looks[type] || looks.crate;
    const y = (opts.y || 0) + lk.h / 2;
    const mesh = this.box(x, y, z, lk.w, lk.h, lk.d, lk.color,
      { rotY: opts.rotY || 0, noCollide: !!opts.rotY, tex: lk.tex, uvScale: 1.2 });
    const markerGeo = new THREE.BoxGeometry(lk.w * 0.6, 0.06, lk.d * 0.6);
    this.scaleBoxUV(markerGeo, lk.w * 0.6, 0.06, lk.d * 0.6, 3);
    const marker = new THREE.Mesh(markerGeo,
      this.mat(type === "safe" || type === "rare" || type === "aircase" ? 0xe8c04e : 0xc4ccd2, "plates")
    );
    marker.position.set(x, y + lk.h/2 + 0.03, z);
    this.scene.add(marker);
    const c = {
      type, x, z, y: y, mesh, marker,
      opened: false, searched: false,
      loot: null,
      name: LOOT_TABLES[type].name,
      searchTime: LOOT_TABLES[type].search
    };
    this.containers.push(c);
    return c;
  },

  addCorpseContainer(x, z, extraLoot) {
    const mesh = this.box(x, 0.22, z, 1.5, 0.35, 0.7, 0x6b7261,
      { noCollide: true, rotY: Math.random() * Math.PI, tex: "wood", uvScale: 0.8 });
    const c = {
      type: "corpse", x, z, y: 0.3, mesh, marker: null,
      opened: false, searched: false,
      loot: null, presetLoot: extraLoot || [],
      name: "游荡者遗物", searchTime: LOOT_TABLES.corpse.search
    };
    this.containers.push(c);
    return c;
  },
  addExtract(name, x, z, r, holdTime, y) {
    y = y || 0;
    const geo = new THREE.CylinderGeometry(r, r, 0.15, 24);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0x39d977, transparent: true, opacity: 0.28
    }));
    mesh.position.set(x, y + 0.1, z);
    this.scene.add(mesh);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 26, 8),
      new THREE.MeshBasicMaterial({ color: 0x4dff9a, transparent: true, opacity: 0.35 })
    );
    beam.position.set(x, y + 13, z);
    this.scene.add(beam);
    this.extracts.push({ name, x, z, r, holdTime: holdTime || 8, mesh, beam });
  },

  smokeSign(x, z, color) {
    const g = new THREE.Mesh(
      new THREE.ConeGeometry(0.5, 1.4, 6),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 })
    );
    g.position.set(x, 0.7, z);
    this.scene.add(g);
  },

  build(quality) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9db3c2);
    this.scene.fog = new THREE.Fog(0x9db3c2, 60, 240);
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 500);
    this.scene.add(this.camera);
    this.syncSize();
    this.raycaster = new THREE.Raycaster();
    this.colliders.length = 0; this.ramps.length = 0; this.solidMeshes.length = 0;
    this.containers.length = 0; this.extracts.length = 0; this.spawns.length = 0;
    this.enemySpawns.length = 0; this.tracers.length = 0; this.flashes.length = 0;
    this.burnZones.length = 0;

    /* 渐变天空穹顶 */
    const skyGeo = new THREE.SphereGeometry(400, 16, 12);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x5d87b5) },
        bottom: { value: new THREE.Color(0x9db3c2) }
      },
      vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader: "uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = normalize(vP).y*0.5+0.5; gl_FragColor = vec4(mix(bottom, top, pow(max(h,0.0),0.75)), 1.0); }"
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.raycast = function () {};
    this.scene.add(sky);

    /* 由天空生成环境反射贴图（金属反光） */
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const envScene = new THREE.Scene();
      envScene.add(new THREE.Mesh(skyGeo.clone(), skyMat));
      this.scene.environment = pmrem.fromScene(envScene, 0.04, 0.1, 500).texture;
      pmrem.dispose();
    } catch (e) { console.warn("环境反射生成失败", e); }

    const hemi = new THREE.HemisphereLight(0xcfe4f2, 0x50554a, 0.95);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d8, 1.35);
    sun.position.set(-70, 110, 40);
    sun.castShadow = !!quality.shadows;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -180; sun.shadow.camera.right = 180;
    sun.shadow.camera.top = 180; sun.shadow.camera.bottom = -180;
    sun.shadow.camera.far = 400;
    this.scene.add(sun);

    /* 地面 */
    const groundGeo = new THREE.PlaneGeometry(600, 600);
    {
      const uv = groundGeo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 170, uv.getY(i) * 170);
      uv.needsUpdate = true;
    }
    const ground = new THREE.Mesh(groundGeo, this.mat(0xcfd6c0, "grass"));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.solidMeshes.push(ground);

    /* 主干道（南北向）与东西路 */
    this.box(0, 0.02, 20, 9, 0.06, 260, 0xd8d8d8, { noCollide: true, noHit: true, noShadow: true, tex: "asphalt", uvScale: 0.12 });
    this.box(0, 0.02, 40, 240, 0.06, 8, 0xd8d8d8, { noCollide: true, noHit: true, noShadow: true, tex: "asphalt", uvScale: 0.12 });

    this.buildDamZone();
    this.buildTurbineHall();
    this.buildAdminZone();
    this.buildDormArea();
    this.buildContainerYard();
    this.buildSpillway();
    this.buildScatter();

    /* 边界围栏 */
    const B = this.mapBounds;
    const fenceC = 0x7d868e;
    const fenceOpts = { tex: "plates", uvScale: 0.35 };
    this.box(0, 2.2, B.min, (B.max-B.min), 4.4, 1, fenceC, fenceOpts);
    this.box(0, 2.2, B.max, (B.max-B.min), 4.4, 1, fenceC, fenceOpts);
    this.box(B.min, 2.2, 0, 1, 4.4, (B.max-B.min), fenceC, fenceOpts);
    this.box(B.max, 2.2, 0, 1, 4.4, (B.max-B.min), fenceC, fenceOpts);

    /* 撤离点 */
    this.addExtract("东侧检查站车队", 120, 46, 5, 8);
    this.addExtract("泄洪隧道", -128, 108, 4.5, 8);
    this.addExtract("大坝顶部直升机坪", 46, -145, 5.5, 10, 23);
    for (const e of this.extracts) this.smokeSign(e.x + e.r - 1, e.z, 0x39d977);

    /* 玩家出生点（南侧 / 西侧 / 东南） */
    this.spawns.push({ x: -20, z: 140 }, { x: 60, z: 132 }, { x: -110, z: 20 }, { x: 118, z: 118 });

    /* 敌人巡逻区（位置, 半径, 数量, 精英概率） */
    this.enemySpawns.push(
      { x: 0,    z: -60,  r: 22, n: 3, elite: 0.15 },
      { x: -60,  z: -100, r: 18, n: 2, elite: 0.4 },
      { x: 66,   z: -20,  r: 20, n: 3, elite: 0.15 },
      { x: -70,  z: 30,   r: 20, n: 2, elite: 0.1 },
      { x: 10,   z: 60,   r: 24, n: 3, elite: 0.1 },
      { x: 90,   z: 90,   r: 20, n: 2, elite: 0.2 },
      { x: -100, z: 100,  r: 18, n: 2, elite: 0.2 }
    );
  },
  /* 北侧：大坝主体 */
  buildDamZone() {
    const damZ = -145;
    /* 坝体（巨大混凝土墙） */
    this.box(0, 11, damZ, 300, 22, 14, 0xd2d6da, { tex: "concrete", uvScale: 0.12 });
    /* 坝顶走道与护栏 */
    this.box(0, 22.4, damZ, 300, 0.8, 16, 0xb4b9bd, { tex: "concrete", uvScale: 0.25 });
    this.box(0, 23.6, damZ - 7.5, 300, 1.6, 0.4, 0x9aa1a7, { noCollide: true, tex: "plates", uvScale: 0.5 });
    this.box(0, 23.6, damZ + 7.5, 300, 1.6, 0.4, 0x9aa1a7, { noCollide: true, tex: "plates", uvScale: 0.5 });
    /* 泄水闸门装饰 */
    for (let i = -2; i <= 2; i++) {
      this.box(i * 40, 9, damZ + 7.2, 12, 16, 0.8, 0x7a8b96, { noCollide: true, tex: "plates", uvScale: 0.3 });
    }
    /* 上坝坡道（东侧，两段连续） */
    this.ramp(105, -103, 8, 36, 11, 0, "z");
    this.ramp(105, -129, 8, 16, 22.8, 11, "z");
    /* 直升机坪（坝顶西段走道上） */
    this.box(46, 22.9, -145, 14, 0.3, 14, 0x6e767d, { tex: "asphalt", uvScale: 0.2 });
    /* 坝顶哨塔 */
    this.box(-40, 24.5, damZ, 4, 5, 4, 0xa9b1b8, { tex: "plates", uvScale: 0.6 });
    /* 坝顶物资 */
    this.addContainer("rare", 36, -146, { y: 22.8 });
    this.addContainer("aircase", -20, -146, { y: 22.8 });
    this.addContainer("safe", 98, -140, { y: 22.8 });
    this.addContainer("ammobox", -38, -138, { y: 22.8 });
    this.addContainer("weaponbox", -60, -140, { y: 22.8 });
  },

  /* 水电站厂房（Boss 区） */
  buildTurbineHall() {
    const cx = -60, cz = -100;
    this.building(cx, cz, 40, 26, 7, 0x77706a, [
      { side: "s", off: 0, w: 4 }, { side: "e", off: 4, w: 3.5 },
      { side: "n", off: -10, w: 3 },
      { side: "s", off: -14, w: 3, window: true }, { side: "s", off: 14, w: 3, window: true }
    ]);
    /* 发电机组 */
    for (let i = -1; i <= 1; i++) {
      this.box(cx + i * 12, 1.6, cz - 3, 6, 3.2, 6, 0x5f9b88, { tex: "plates", uvScale: 0.5 });
      this.box(cx + i * 12, 3.6, cz - 3, 2, 0.9, 2, 0x55806f, { noCollide: true, tex: "plates", uvScale: 0.8 });
    }
    /* 管线 */
    this.box(cx, 5.2, cz - 10, 36, 1.2, 1.2, 0xa08a5a, { noCollide: true, tex: "metal", uvScale: 0.6 });
    /* 控制台与战利品 */
    this.box(cx + 14, 0.6, cz + 8, 5, 1.2, 1.5, 0x5a6d7d, { tex: "plates", uvScale: 0.7 });
    this.addContainer("safe", cx + 17.5, cz + 10.5, {});
    this.addContainer("safe", cx - 8, cz + 9.5, {});
    this.addContainer("aircase", cx - 10, cz - 9, {});
    this.addContainer("rare", cx - 16, cz + 9, {});
    this.addContainer("toolbox", cx - 4, cz + 8, {});
    this.addContainer("weaponbox", cx + 5, cz - 9, {});
    this.bossSpot = { x: cx, z: cz + 3 };
  },

  /* 中央管理处 + 检查站 */
  buildAdminZone() {
    this.building(0, -60, 26, 18, 4.5, 0x8a7f6a, [
      { side: "s", off: -6, w: 3.5 }, { side: "n", off: 6, w: 3.5 },
      { side: "w", off: 0, w: 3, window: true }, { side: "e", off: 0, w: 3, window: true }
    ]);
    /* 内部隔墙 */
    this.box(3, 2.25, -60, 0.35, 4.5, 10, 0xc8bda6, { tex: "concrete", uvScale: 0.35 });
    /* 桌椅与柜子 */
    this.box(-6, 0.5, -63, 3.2, 1, 1.4, 0xb08d5e, { tex: "wood", uvScale: 0.8 });
    this.box(8, 1.0, -55, 1.2, 2, 0.6, 0x7d8890, { tex: "plates", uvScale: 0.8 });
    this.addContainer("safe", 9.5, -64.5, {});
    this.addContainer("crate", -9, -55, {});
    this.addContainer("medbox", -6, -63, { y: 1.0 });
    this.addContainer("crate", 8, -57.5, {});

    /* 检查站（路口） */
    this.building(16, 40, 8, 6, 3.2, 0x7c8288, [{ side: "w", off: 0, w: 2.2 }]);
    this.box(-8, 1.1, 40, 6, 2.2, 1.2, 0xc0564a, { noHit: false, tex: "plates", uvScale: 0.6 }); /* 路障 */
    this.box(-16, 0.9, 44, 5, 1.8, 2.2, 0x6d7a84, { tex: "metal", uvScale: 0.6 }); /* 废弃卡车车头 */
    this.addContainer("ammobox", 16, 41.5, {});
    this.addContainer("safe", 13.5, 38.5, {});
    this.addContainer("crate", -15.5, 42.5, { y: 1.8 });

    /* 中央雷达塔 */
    this.box(40, 7, -70, 3, 14, 3, 0x99a3ab, { tex: "plates", uvScale: 0.5 });
    this.addContainer("toolbox", 42.5, -68, {});
    this.addContainer("aircase", 37, -73, {});
  },

  /* 西侧宿舍区 */
  buildDormArea() {
    const houses = [
      { x: -90, z: -20 }, { x: -70, z: -20 }, { x: -90, z: 2 },
      { x: -68, z: 4 }, { x: -104, z: -8 }
    ];
    let k = 0;
    for (const hpos of houses) {
      const doorSide = ["s","e","n","e","s"][k % 5];
      this.building(hpos.x, hpos.z, 10, 8, 3.4, 0x8c8578, [
        { side: doorSide, off: 1, w: 2 },
        { side: doorSide === "s" ? "n" : "s", off: -1.5, w: 2.4, window: true }
      ]);
      const inside = k % 3;
      if (inside === 0) this.addContainer("crate", hpos.x - 2.5, hpos.z + 1.5, {});
      else if (inside === 1) this.addContainer("medbox", hpos.x + 2, hpos.z - 1.5, {});
      else this.addContainer("toolbox", hpos.x - 2, hpos.z - 1.8, {});
      /* 床铺 */
      this.box(hpos.x + 2.8, 0.4, hpos.z + 2, 2, 0.8, 3.4, 0xb59a72, { tex: "wood", uvScale: 0.7 });
      k++;
    }
    this.addContainer("weaponbox", -104, -6, {});
    this.addContainer("crate", -80, -8, {});
    this.addContainer("safe", -92, 4, {});
  },

  /* 南侧集装箱堆场 */
  buildContainerYard() {
    const colors = [0xd07a58, 0x6f9cc0, 0x8fae6a, 0xb8a860, 0x9a82a8];
    const spots = [
      [60, 90, 0], [60, 96.5, 0], [66.5, 93, 1], [80, 84, 0], [86.5, 84, 0],
      [80, 100, 1], [98, 92, 0], [104, 78, 1], [70, 74, 0], [92, 106, 0]
    ];
    let i = 0;
    for (const s of spots) {
      const c = colors[i % colors.length];
      const stacked = s[2] === 1;
      this.box(s[0], 1.3, s[1], 12, 2.6, 3, c, { tex: "metal", uvScale: 0.35 });
      if (stacked) this.box(s[0] + 1, 3.9, s[1], 12, 2.6, 3, colors[(i + 2) % colors.length], { tex: "metal", uvScale: 0.35 });
      i++;
    }
    /* 龙门吊 */
    this.box(80, 9, 92, 1.6, 18, 1.6, 0xd8c04a, { tex: "plates", uvScale: 0.5 });
    this.box(96, 9, 92, 1.6, 18, 1.6, 0xd8c04a, { tex: "plates", uvScale: 0.5 });
    this.box(88, 17.5, 92, 20, 1.4, 2, 0xd8c04a, { noCollide: true, tex: "plates", uvScale: 0.5 });
    this.addContainer("crate", 63, 93.2, { y: 2.6 });
    this.addContainer("crate", 74, 88, {});
    this.addContainer("weaponbox", 92, 98, {});
    this.addContainer("ammobox", 100, 88, {});
    this.addContainer("toolbox", 84, 76, {});
    this.addContainer("rare", 88, 92, {});
    this.addContainer("aircase", 81, 100, { y: 5.2 });

    /* 仓库棚 */
    this.building(30, 100, 18, 14, 5, 0x6e7276, [
      { side: "n", off: 0, w: 5 }, { side: "e", off: 0, w: 4 }
    ]);
    this.addContainer("crate", 26, 96, {});
    this.addContainer("crate", 34, 104, {});
    this.addContainer("medbox", 24, 104, {});
    this.addContainer("safe", 35, 96.5, {});
  },

  /* 西南泄洪渠 */
  buildSpillway() {
    /* 下沉水渠用两侧堤岸表示 */
    this.box(-120, 1.5, 60, 10, 3, 90, 0xc3c8cc, { tex: "concrete", uvScale: 0.2 });
    this.box(-140, 1.5, 60, 10, 3, 90, 0xc3c8cc, { tex: "concrete", uvScale: 0.2 });
    /* 渠底水面 */
    this.box(-130, 0.05, 60, 10, 0.08, 90, 0x39586b, { noCollide: true, noHit: true, mat: { transparent: true, opacity: 0.85 } });
    /* 渠上桥 */
    this.box(-130, 3.2, 30, 30, 0.5, 6, 0xb4b9bd, { tex: "concrete", uvScale: 0.3 });
    this.ramp(-111, 30, 6, 8, 3.2, 0, "x");
    /* 隧道口（撤离点旁装饰） */
    this.box(-128, 3, 116, 14, 6, 4, 0x8f959a, { tex: "concrete", uvScale: 0.25 });
    this.addContainer("crate", -122, 96, {});
    this.addContainer("ammobox", -136, 80, {});
    this.addContainer("aircase", -130, 48, {});
  },

  /* 零散掩体、车辆、岩石、树 */
  buildScatter() {
    const rocks = [
      [-30, 100], [20, -20], [-40, 60], [50, 20], [-20, -30],
      [110, 20], [130, -60], [-60, 120], [10, 120], [70, -80],
      [-110, -60], [-140, -20], [140, 60], [30, -100]
    ];
    for (const r of rocks) {
      const s = 1.5 + Math.random() * 2.5;
      this.box(r[0], s / 2, r[1], s * 1.4, s, s, 0xb8b4ac, { tex: "rock", uvScale: 0.5 });
    }
    const trees = [
      [-30, 80], [-50, 90], [25, 70], [45, 60], [-90, 60], [-70, 80],
      [120, 0], [130, 30], [60, -60], [-20, 110], [-120, -30], [80, 40],
      [140, 100], [-60, -40], [24, -80], [-10, -110]
    ];
    for (const t of trees) {
      this.box(t[0], 1.6, t[1], 0.5, 3.2, 0.5, 0xc7ab8b, { tex: "bark", uvScale: 1.0 });
      const crownGeo = new THREE.ConeGeometry(2 + Math.random(), 4.5, 7);
      const crown = new THREE.Mesh(crownGeo, this.mat(0x4e7040, "grass"));
      crown.position.set(t[0], 5.2, t[1]);
      crown.castShadow = true;
      this.scene.add(crown);
    }
    /* 废弃车辆 */
    const cars = [[8, 74, 0.4], [-14, 10, 1.2], [24, -44, 2.4], [-52, 46, 0.9], [96, 40, 1.9]];
    for (const c of cars) {
      this.box(c[0], 0.75, c[1], 4.4, 1.5, 2, 0x8a99a4, { rotY: c[2], noCollide: true, tex: "metal", uvScale: 0.5 });
      this.colliders.push({
        min: { x: c[0] - 2.4, y: 0, z: c[1] - 2.4 },
        max: { x: c[0] + 2.4, y: 1.6, z: c[1] + 2.4 }
      });
    }
    /* 沙袋掩体 */
    const bags = [[0, 10], [4, -6], [-30, -66], [58, 4], [76, -12], [34, 88], [-96, 88]];
    for (const b of bags) this.box(b[0], 0.55, b[1], 3.4, 1.1, 1, 0xcdb98e, { tex: "concrete", uvScale: 0.9 });
    /* 散落容器 */
    this.addContainer("crate", -34, 62, {});
    this.addContainer("crate", 52, 22, {});
    this.addContainer("medbox", 0, 12, {});
    this.addContainer("crate", 112, 22, {});
    this.addContainer("toolbox", -22, -32, {});
    this.addContainer("crate", 132, -58, {});
    this.addContainer("ammobox", 60, -58, {});
    this.addContainer("crate", -58, 122, {});
  },
  /* ---- 通用工具 ---- */
  groundHeightAt(x, z, fromY) {
    let g = 0;
    for (const c of this.colliders) {
      if (x > c.min.x - 0.3 && x < c.max.x + 0.3 && z > c.min.z - 0.3 && z < c.max.z + 0.3) {
        if (c.max.y <= fromY + 0.51 && c.max.y > g) g = c.max.y;
      }
    }
    const rh = this.rampHeightAt(x, z);
    if (rh !== null && rh <= fromY + 0.7 && rh > g) g = rh;
    return g;
  },

  /* 胶囊水平碰撞（半径 r，脚底 y0 到头顶 y1） */
  resolveCollision(pos, r, y0, y1) {
    for (let iter = 0; iter < 3; iter++) {
      let pushed = false;
      for (const c of this.colliders) {
        if (y1 <= c.min.y + 0.05 || y0 >= c.max.y - 0.25) continue;
        const nx = Math.max(c.min.x, Math.min(pos.x, c.max.x));
        const nz = Math.max(c.min.z, Math.min(pos.z, c.max.z));
        const dx = pos.x - nx, dz = pos.z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          /* 若可以直接跨上去（台阶），跳过 */
          if (c.max.y - y0 <= 0.5) continue;
          const d = Math.sqrt(d2);
          if (d > 1e-5) {
            pos.x = nx + dx / d * r;
            pos.z = nz + dz / d * r;
          } else {
            const cx = (c.min.x + c.max.x) / 2, cz = (c.min.z + c.max.z) / 2;
            const ox = pos.x - cx, oz = pos.z - cz;
            const exX = (c.max.x - c.min.x) / 2 - Math.abs(ox);
            const exZ = (c.max.z - c.min.z) / 2 - Math.abs(oz);
            if (exX < exZ) pos.x += (ox > 0 ? exX + r : -(exX + r));
            else pos.z += (oz > 0 ? exZ + r : -(exZ + r));
          }
          pushed = true;
        }
      }
      if (!pushed) break;
    }
    const B = this.mapBounds;
    pos.x = Math.max(B.min + 1.2, Math.min(B.max - 1.2, pos.x));
    pos.z = Math.max(B.min + 1.2, Math.min(B.max - 1.2, pos.z));
  },

  /* 射线检测：返回 {point, dist, object} 或 null */
  raycast(origin, dir, maxDist, extraTargets) {
    this.raycaster.set(origin, dir);
    this.raycaster.far = maxDist;
    const targets = extraTargets ? this.solidMeshes.concat(extraTargets) : this.solidMeshes;
    const hits = this.raycaster.intersectObjects(targets, true);
    return hits.length ? hits[0] : null;
  },

  hasLOS(a, b) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const dist = dir.length();
    if (dist < 0.01) return true;
    dir.normalize();
    const hit = this.raycast(a, dir, dist - 0.3);
    return !hit;
  },

  /* 曳光弹 */
  addTracer(from, to, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: color || 0xffe9a8, transparent: true, opacity: 0.9
    }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.07 });
  },

  addFlash(pos, color, size, life) {
    const l = new THREE.PointLight(color || 0xffc36b, 2.4, size || 7);
    l.position.copy(pos);
    this.scene.add(l);
    this.flashes.push({ light: l, life: life || 0.06 });
  },

  addImpact(pos) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 5, 5),
      new THREE.MeshBasicMaterial({ color: 0xd9c9a0 }));
    m.position.copy(pos);
    this.scene.add(m);
    this.tracers.push({ line: m, life: 0.25 });
  },

  addBurnZone(x, z, radius, dur, dps) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 0.4, 16),
      new THREE.MeshBasicMaterial({ color: 0xff7229, transparent: true, opacity: 0.42 })
    );
    m.position.set(x, 0.25, z);
    this.scene.add(m);
    const light = new THREE.PointLight(0xff8033, 2, radius * 3.5);
    light.position.set(x, 1.5, z);
    this.scene.add(light);
    this.burnZones.push({ x, z, r: radius, t: dur, dps, mesh: m, light });
  },

  update(dt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) { this.scene.remove(t.line); this.tracers.splice(i, 1); }
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life -= dt;
      if (f.life <= 0) { this.scene.remove(f.light); this.flashes.splice(i, 1); }
    }
    for (let i = this.burnZones.length - 1; i >= 0; i--) {
      const b = this.burnZones[i];
      b.t -= dt;
      b.mesh.material.opacity = 0.2 + Math.random() * 0.3;
      b.light.intensity = 1.4 + Math.random() * 1.4;
      if (b.t <= 0) {
        this.scene.remove(b.mesh); this.scene.remove(b.light);
        this.burnZones.splice(i, 1);
      }
    }
    for (const e of this.extracts) {
      e.beam.material.opacity = 0.25 + 0.15 * Math.sin(performance.now() / 300);
    }
  },

  dispose() {
    if (this.scene) {
      this.scene.traverse(o => {
        if (o.geometry) o.geometry.dispose();
      });
    }
    this.scene = null;
  }
  /*__WORLD_END__*/
};
