// NO BLOCK'S SKY — main game orchestrator.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { audio } from './audio/engine.js';
import { MusicDirector } from './audio/music.js';
import { Input } from './core/input.js';
import { makeRng, strSeed } from './core/rng.js';
import { clamp, lerp } from './core/noise.js';
import { generateSystem } from './data/planets.js';
import { buildAtlasCanvas } from './world/atlas.js';
import { BLOCKS, BID, RT } from './world/blocks.js';
import { World } from './world/world.js';
import { CH_H } from './world/worldgen.js';
import { createTerrainMaterial, createWaterMaterial, createCrackTexture, makeAtlasTexture, shared } from './render/materials.js';
import { Sky } from './render/sky.js';
import { Particles } from './render/particles.js';
import { Palette } from './render/palette.js';
import { Player } from './entities/player.js';
import { CreatureManager } from './entities/creatures.js';
import { Inventory } from './game/inventory.js';
import { Quests } from './game/quests.js';
import { UI } from './ui/hud.js';
import { Icons } from './ui/icons.js';
import { Panels } from './ui/panels.js';
import { ITEMS, itemKeyForBlock, itemLabel, RECIPES } from './data/items.js';
import { Ship } from './ship/ship.js';
import { Transition } from './ship/transition.js';
import { SpaceScene } from './space/space.js';
import { saveGame, loadGame, hasSave, clearSave } from './game/save.js';

const DAY_LENGTH = 1200; // seconds for a full cycle (Minecraft: 20 minutes)

class Game {
  constructor() {
    this.canvas = document.getElementById('gl');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.98;

    this.camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.08, 3000);
    this.sceneSurface = new THREE.Scene();
    this.sceneSpace = new THREE.Scene();
    this.activeScene = this.sceneSurface;

    this.composer = null;
    this.bloom = null;
    // quality: 'auto' | 'high' | 'med' | 'low' — auto starts at med and degrades if the frame rate drops
    this.settings = { bloom: true, viewDist: 5, sens: 0.0022, fov: 78, quality: 'auto', msaa: false, pixelRatio: 1.25, bloomHalfRes: true };
    this.perfLevel = 1;

    this.input = new Input(this.canvas);
    this.audio = audio;
    this.music = new MusicDirector(audio);
    this.ui = new UI(this);
    this.icons = new Icons(null);
    this.panels = new Panels(this);
    this.inventory = new Inventory(24, '外骨骼 EXOSUIT');
    this.inventory.onChange = () => { this.ui.updateHotbar(); this.autoAssignHotbar(); if (this.ui.panelOpen) this._panelRefreshPending = true; };

    this.time = 0;
    this.dayT = 0.06;
    this.storm = false;
    this.stormTimer = 240 + Math.random() * 260;
    this.mode = 'title';
    this.creative = false;
    this.uiBlocking = false;
    this.units = 0;
    this.nanites = 0;
    this.discoveries = [];
    this.flags = {};
    this.stageTime = 0;
    this.paused = false;
    this.frame = 0;
    this.fps = 60;
    this._fpsAcc = 0; this._fpsFrames = 0;

    this.world = null;
    this.sky = null;
    this.particles = null;
    this.palette = new Palette(require_placeholder());
    this.player = new Player(this);
    this.creatures = null;
    this.quests = new Quests(this);
    this.ship = new Ship(this);
    this.transition = new Transition(this);
    this.space = new SpaceScene(this);

    this.scanPulse = -1;
    this.scanOrigin = new THREE.Vector3();
    this.resourceMarkers = [];
    this.saveTimer = 30;

    this._panelRefreshPending = false;
    this._bindEvents();
    this._buildSurfaceHelpers();
    this._setupTitle();
  }

  /* =============================== setup =============================== */
  _bindEvents() {
    window.addEventListener('resize', () => this.onResize());
    this.input.on('key', (code) => this.onKey(code));
    document.addEventListener('pointerlockchange', () => {
      if (!this.input.locked && (this.mode === 'surface' || this.mode === 'fly' || this.mode === 'space') && !this.uiBlocking && !this.paused) {
        this.setPaused(true);
      }
    });
  }

  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) this.composer.setSize(w, h);
  }

  _setupComposer() {
    const w = window.innerWidth, h = window.innerHeight;
    const dpr = this.renderer.getPixelRatio();
    const rt = new THREE.WebGLRenderTarget(Math.floor(w * dpr), Math.floor(h * dpr), {
      type: THREE.HalfFloatType,
      samples: this.settings.msaa ? 4 : 0,
    });
    this.composer = new EffectComposer(this.renderer, rt);
    this.renderPass = new RenderPass(this.activeScene, this.camera);
    this.composer.addPass(this.renderPass);
    const bres = this.settings.bloomHalfRes ? 0.5 : 1;
    this.bloom = new UnrealBloomPass(new THREE.Vector2(Math.floor(w * bres), Math.floor(h * bres)), 0.42, 0.55, 0.92);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  /** space needs a far clip in the tens of thousands; the surface wants precision up close */
  _applyCameraRange() {
    const inSpace = this.activeScene === this.sceneSpace;
    const near = inSpace ? 2 : 0.08;
    const far = inSpace ? 60000 : 3000;
    if (this.camera.near !== near || this.camera.far !== far) {
      this.camera.near = near;
      this.camera.far = far;
      this.camera.updateProjectionMatrix();
    }
  }

  /** rebuild the post chain (needed when MSAA / bloom resolution changes) */
  rebuildComposer() {
    if (this.composer) {
      this.composer.passes.length = 0;
      if (this.composer.renderTarget1) this.composer.renderTarget1.dispose();
      if (this.composer.renderTarget2) this.composer.renderTarget2.dispose();
      this.composer = null;
      this.renderPass = null;
      this.bloom = null;
    }
    this._setupComposer();
    if (this.renderPass) this.renderPass.scene = this.activeScene;
  }

  /** apply a quality preset */
  setQuality(level) {
    const presets = {
      high: { bloom: true, msaa: true, viewDist: 7, pixelRatio: 1.5, bloomHalfRes: false },
      med: { bloom: true, msaa: false, viewDist: 5, pixelRatio: 1.25, bloomHalfRes: true },
      low: { bloom: false, msaa: false, viewDist: 4, pixelRatio: 1.0, bloomHalfRes: true },
    };
    const p = presets[level] || presets.med;
    Object.assign(this.settings, p);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, p.pixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    if (this.world) this.world.viewDist = p.viewDist;
    this.rebuildComposer();
    this.perfLevel = level === 'high' ? 0 : level === 'med' ? 1 : 2;
  }

  /** watch the frame rate and drop quality automatically */
  perfWatch(dt) {
    if (this.settings.quality !== 'auto') return;
    this._perfAcc = (this._perfAcc || 0) + dt;
    this._perfFrames = (this._perfFrames || 0) + 1;
    if (this._perfAcc < 4) return;
    const fps = this._perfFrames / this._perfAcc;
    this._perfAcc = 0; this._perfFrames = 0;
    if (this.mode === 'loading' || this.mode === 'title' || this.mode === 'transition') return;
    if (fps < 34 && this.perfLevel < 2) {
      const next = this.perfLevel === 0 ? 'med' : 'low';
      this.setQuality(next);
      this.ui.toast({ kind: 'info', name: '已自动降低画质以提升帧率', amt: next === 'med' ? '中' : '低', dur: 4200 });
    } else if (fps > 58 && this.perfLevel > 1) {
      this.setQuality('med');
    }
  }

  _buildSurfaceHelpers() {
    // block selection outline (Minecraft style)
    const box = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    const edges = new THREE.EdgesGeometry(box);
    this.selBox = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.55, depthTest: true }));
    this.selBox.visible = false;
    this.selBox.renderOrder = 5;
    this.sceneSurface.add(this.selBox);

    // crack overlay
    this.crackTex = createCrackTexture();
    this.crackTex.repeat.set(0.1, 1);
    this.crackMat = new THREE.MeshBasicMaterial({ map: this.crackTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, opacity: 0.95 });
    this.crackBox = new THREE.Mesh(new THREE.BoxGeometry(1.006, 1.006, 1.006), this.crackMat);
    this.crackBox.visible = false;
    this.crackBox.renderOrder = 6;
    this.sceneSurface.add(this.crackBox);

    // mining beam
    const bg = new THREE.CylinderGeometry(0.035, 0.02, 1, 6, 1, true);
    bg.rotateX(Math.PI / 2);
    this.beamMesh = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.beamMesh.visible = false;
    this.sceneSurface.add(this.beamMesh);
    const bg2 = new THREE.CylinderGeometry(0.1, 0.055, 1, 6, 1, true);
    bg2.rotateX(Math.PI / 2);
    this.beamGlow = new THREE.Mesh(bg2, new THREE.MeshBasicMaterial({ color: 0xff7a1e, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.beamGlow.visible = false;
    this.sceneSurface.add(this.beamGlow);

    // beam impact glow
    this.impactSprite = this._makeImpactSprite();
    this.sceneSurface.add(this.impactSprite);

    // first-person multi-tool viewmodel
    this.viewModel = this._buildMultiTool();
    this.viewModel.visible = false;
    this.camera.add(this.viewModel);
    this.sceneSurface.add(this.camera);
  }

  _buildMultiTool() {
    const g = new THREE.Group();
    const mk = (w, h, d, color, x, y, z, emissive = 0) => {
      const mat = new THREE.MeshBasicMaterial({ color, toneMapped: !emissive });
      if (emissive) mat.color.multiplyScalar(1 + emissive);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      g.add(m);
      return m;
    };
    // --- receiver / body (white NMS livery with dark panels)
    mk(0.085, 0.10, 0.30, 0xe4e9ef, 0, 0, -0.06);
    mk(0.092, 0.045, 0.20, 0x2f363f, 0, 0.035, -0.02);
    mk(0.10, 0.055, 0.10, 0x39424d, 0, -0.02, 0.09);
    // --- barrel assembly
    mk(0.042, 0.042, 0.38, 0xb9c2cc, 0, 0.008, -0.34);
    mk(0.058, 0.058, 0.05, 0x2f363f, 0, 0.008, -0.21);
    mk(0.05, 0.05, 0.045, 0x2f363f, 0, 0.008, -0.47);
    // --- coil rings that glow when mining
    this.toolCoils = [];
    for (let i = 0; i < 3; i++) {
      const c = mk(0.062, 0.062, 0.018, 0xffa62b, 0, 0.008, -0.28 - i * 0.06, 0.8);
      this.toolCoils.push(c);
    }
    // --- emitter tip
    this.toolTip = mk(0.036, 0.036, 0.05, 0xffc46b, 0, 0.008, -0.53, 1.8);
    // --- scope / analysis visor optic
    mk(0.032, 0.045, 0.13, 0x22282f, 0, 0.075, -0.14);
    this.toolScope = mk(0.022, 0.022, 0.012, 0x4fe3ff, 0, 0.075, -0.205, 2.4);
    // --- grip + trigger guard
    const grip = mk(0.05, 0.14, 0.065, 0x22282f, 0, -0.085, 0.03);
    grip.rotation.x = 0.3;
    mk(0.03, 0.045, 0.05, 0x3f4954, 0, -0.045, -0.02);
    // --- side plate with status light
    mk(0.10, 0.035, 0.09, 0xcdd5de, 0, -0.045, -0.12);
    this.toolLight = mk(0.016, 0.016, 0.016, 0x4fe3ff, 0.05, 0.03, 0.0, 2.6);
    // --- shoulder brace (NMS tools have a chunky rear)
    mk(0.07, 0.075, 0.09, 0xe4e9ef, 0, 0.01, 0.15);
    mk(0.05, 0.05, 0.05, 0xff8a2b, 0, 0.01, 0.2, 0.35);
    g.position.set(0.26, -0.22, -0.40);
    g.rotation.set(0.02, -0.14, 0.03);
    g.scale.setScalar(1.0);
    return g;
  }

  _makeImpactSprite() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,200,120,0.85)');
    grad.addColorStop(0.6, 'rgba(255,130,40,0.25)');
    grad.addColorStop(1, 'rgba(255,110,20,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.visible = false;
    s.scale.setScalar(0.9);
    return s;
  }

  _setupTitle() {
    const unlock = async () => {
      await this.audio.unlock();
      this.music.start('title');
      document.getElementById('title-foot')?.classList.add('ready');
    };
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });

    document.querySelectorAll('#title-menu .tbtn').forEach((b) => {
      b.addEventListener('mouseenter', () => this.audio.uiHover());
      b.addEventListener('click', () => {
        const act = b.dataset.act;
        this.audio.uiClick();
        if (act === 'new') this.startNewGame();
        else if (act === 'creative') this.startNewGame(null, { creative: true });
        else if (act === 'continue') this.continueGame();
        else if (act === 'help') this.panels.showTitlePanel('help');
        else if (act === 'options') this.panels.showTitlePanel('options');
      });
    });
    document.querySelectorAll('#pause-screen .tbtn').forEach((b) => {
      b.addEventListener('mouseenter', () => this.audio.uiHover());
      b.addEventListener('click', () => {
        const act = b.dataset.act;
        this.audio.uiClick();
        if (act === 'resume') this.setPaused(false);
        else if (act === 'save') { this.save(); this.ui.toast({ kind: 'info', name: '进度已保存', amt: '' }); }
        else if (act === 'help') this.panels.showTitlePanel('help', true);
        else if (act === 'options') this.panels.showTitlePanel('options', true);
        else if (act === 'quit') this.quitToTitle();
      });
    });
    if (hasSave()) {
      const b = document.querySelector('#title-menu .tbtn[data-act="continue"]');
      if (b) b.disabled = false;
    }
  }

  /* =============================== game start =============================== */
  async startNewGame(seedStr, opts = {}) {
    const seed = seedStr || ('NBS-' + Math.floor(Math.random() * 1e9));
    this.creative = !!opts.creative;
    this.seedStr = seed;
    this.system = generateSystem(seed);
    this.units = 1250;
    this.nanites = 0;
    this.discoveries = [];
    this.flags = {};
    this.inventory = new Inventory(24, '外骨骼 EXOSUIT');
    this.inventory.onChange = () => { this.ui.updateHotbar(); this.autoAssignHotbar(); if (this.ui.panelOpen) this._panelRefreshPending = true; };
    this.inventory.add('CARBON', 12);
    this.inventory.add('FERRITE_DUST', 8);
    this.quests = new Quests(this);
    this.player = new Player(this);
    this.player.tool.scanner = false;
    this.player.tool.visor = false;
    this.ship.reset();
    this.worldEdits = {};
    this.applyCreative();

    // pick a habitable-ish starting planet
    const bioRank = { lush: 0, barren: 2, exotic: 3, desert: 4, frozen: 4, radioactive: 5, toxic: 5, volcanic: 6 };
    const start = this.system.planets.slice().sort((a, b) =>
      (bioRank[a.biome] ?? 5) - (bioRank[b.biome] ?? 5) || a.hazardLevel - b.hazardLevel)[0];
    this.startPlanet = start;
    document.getElementById('title-screen').classList.add('hidden');
    this.ui.showHud(true);
    await this.loadPlanet(start, { crashSite: true });
    this.quests.index = 0;
    this.ui.cinematic({ main: this.planet.name, sub: this.planet.biomeCn + ' · ' + this.system.name + ' 星系', dur: 5000 });
    this.audio.teleport();
  }

  async continueGame() {
    const data = loadGame();
    if (!data) { this.startNewGame(); return; }
    this.seedStr = data.seed;
    this.system = generateSystem(data.seed);
    this.units = data.units || 0;
    this.nanites = data.nanites || 0;
    this.discoveries = data.discoveries || [];
    this.flags = data.flags || {};
    this.worldEdits = data.worldEdits || {};
    this.creative = !!data.creative;
    this.inventory = new Inventory(24, '外骨骼 EXOSUIT');
    this.inventory.onChange = () => { this.ui.updateHotbar(); this.autoAssignHotbar(); if (this.ui.panelOpen) this._panelRefreshPending = true; };
    this.inventory.load(data.inventory);
    this.player = new Player(this);
    this.player.load(data.player);
    this.quests = new Quests(this);
    this.quests.load(data.quests);
    this.ship.reset();
    this.ship.load(data.ship);
    this.applyCreative();
    document.getElementById('title-screen').classList.add('hidden');
    this.ui.showHud(true);
    const planet = this.system.planets[data.planetIndex || 0] || this.system.planets[0];
    if (data.inSpace) {
      await this.enterSpaceDirect(planet);
    } else {
      await this.loadPlanet(planet, { spawnPos: data.player?.pos });
    }
  }

  quitToTitle() {
    this.save();
    this.setPaused(false);
    this.input.releaseLock();
    this.mode = 'title';
    this.audio.stopAll();
    this.music.setMode('title');
    if (this.world) { this.world.dispose(); this.world = null; }
    if (this.sky) { this.sky.dispose(); this.sky = null; }
    document.getElementById('title-screen').classList.remove('hidden');
    this.ui.showHud(false);
    this.ui.shipHud(false);
    const b = document.querySelector('#title-menu .tbtn[data-act="continue"]');
    if (b) b.disabled = !hasSave();
  }

  /* =============================== planet load =============================== */
  async loadPlanet(planet, opts = {}) {
    const tips = [
      '提示：按 C 发送扫描脉冲，可以标记附近的资源。',
      '提示：红色植物提供氧，黄色植物提供钠，蓝色晶体提供二氢。',
      '提示：夜晚温度骤降，屋顶能减缓危害防护的流失。',
      '提示：按住空格可以启动喷射背包滑翔。',
      '提示：按 V 打开分析镜，扫描新物种可以获得单位与纳米簇。',
      '提示：敲碎方块可以像我的世界一样重新放置它们 (B 打开建造菜单)。',
      '提示：过度采集会引来哨兵 —— 它们不喜欢破坏行为。',
    ];
    const silent = !!opts.silent;
    if (!silent) {
      this.ui.loading(true, { title: '正在生成星球', sub: 'GENERATING ' + planet.name.toUpperCase(), progress: 0.05, tip: tips[Math.floor(Math.random() * tips.length)] });
      this.mode = 'loading';
    }
    await new Promise((r) => setTimeout(r, 60));

    // dispose previous
    if (this.world) { this.world.dispose(); this.world = null; }
    if (this.sky) { this.sky.dispose(); this.sky = null; }
    if (this.creatures) { this.creatures.dispose(); this.creatures = null; }
    if (this.particles) { this.particles.dispose(); this.particles = null; }

    this.planet = planet;
    this.palette.set(planet.palette);

    // bake the atlas with this planet's palette
    const atlasCanvas = buildAtlasCanvas(planet.palette, planet.seed);
    this.atlasCanvas = atlasCanvas;
    this.icons.setAtlas(atlasCanvas);
    const atlasTex = makeAtlasTexture(atlasCanvas);
    if (this.atlasTex) this.atlasTex.dispose();
    this.atlasTex = atlasTex;
    this.matTerrain = createTerrainMaterial(atlasTex);
    this.matWater = createWaterMaterial(atlasTex);
    shared.uAtlas.value = atlasTex;

    if (!silent) this.ui.loading(true, { progress: 0.2 });

    // fog + ambient from palette
    const P = planet.palette;
    shared.uFogColor.value.setRGB(P.fog[0] / 255 * 0.82, P.fog[1] / 255 * 0.82, P.fog[2] / 255 * 0.82);
    shared.uAmbient.value.setRGB(P.ambient[0] / 255 * 0.44, P.ambient[1] / 255 * 0.44, P.ambient[2] / 255 * 0.44);
    shared.uSunColor.value.setRGB(P.sun[0] / 255, P.sun[1] / 255, P.sun[2] / 255);
    shared.uFogDensity.value = 0.0042;

    this.world = new World(planet, { opaque: this.matTerrain, alpha: this.matWater }, this.sceneSurface, { viewDist: this.settings.viewDist });
    if (this.worldEdits && this.worldEdits[planet.id]) this.world.loadEdits(this.worldEdits[planet.id]);
    this.particles = new Particles(this.sceneSurface);
    this.sky = new Sky(this.sceneSurface, { cloudSeed: planet.seed % 1000, cloudCoverage: planet.biome === 'barren' ? 0.62 : 0.44 });
    this.sky.setPalette(P);
    // companion planets in the sky (NMS signature)
    const rng = makeRng(planet.seed + 7);
    const others = this.system.planets.filter((p) => p !== planet);
    others.slice(0, 2).forEach((o, i) => {
      const dist = 700;
      const ang = rng.range(0, Math.PI * 2);
      const el = rng.range(0.25, 0.75);
      const pos = new THREE.Vector3(Math.cos(ang) * dist, dist * el, Math.sin(ang) * dist);
      this.sky.addCompanion(
        new THREE.Color(o.palette.spaceTint[0] / 255, o.palette.spaceTint[1] / 255, o.palette.spaceTint[2] / 255),
        60 + i * 25, pos, o.ringed
      );
    });
    this.creatures = new CreatureManager(this);

    if (!silent) this.ui.loading(true, { progress: 0.35 });

    // spawn position
    let spawn;
    if (opts.spawnPos) spawn = { x: opts.spawnPos[0], y: opts.spawnPos[1], z: opts.spawnPos[2] };
    else spawn = this.world.gen.findSpawn(Math.floor(Math.random() * 3000 - 1500), Math.floor(Math.random() * 3000 - 1500));
    this.player.spawn(spawn);
    this.player.pos.y = spawn.y + 1;

    // stream in chunks around the spawn
    let guard = 0;
    while (this.world.loadedFraction(this.player.pos, 2) < 0.98 && guard < 420) {
      this.world.update(this.player.pos, 6);
      await new Promise((r) => setTimeout(r, 24));
      guard++;
      if (!silent) this.ui.loading(true, { progress: 0.35 + 0.6 * this.world.loadedFraction(this.player.pos, 2) });
    }
    // drop the player onto the surface
    const sy = this.world.surfaceY(this.player.pos.x, this.player.pos.z);
    this.player.pos.y = sy + 1.6;
    this.player.lastGroundY = this.player.pos.y;

    // place the ship
    if (!opts.fromSpace) this.ship.placeOnSurface(this.player.pos, opts.crashSite);
    if (opts.crashSite) {
      this.player.pos.x = this.ship.object.position.x + 6;
      this.player.pos.z = this.ship.object.position.z + 6;
      this.player.pos.y = this.world.surfaceY(this.player.pos.x, this.player.pos.z) + 1.6;
      this.player.yaw = Math.atan2(this.ship.object.position.x - this.player.pos.x, this.ship.object.position.z - this.player.pos.z) + Math.PI;
    }

    if (!silent) this.ui.loading(true, { progress: 1 });
    this.ui.setPlanet(planet);
    this.ui.updateHotbar();
    this.autoAssignHotbar();
    if (!this.composer) this._setupComposer();
    if (!opts.keepMode) {
      this.mode = 'surface';
      this.activeScene = this.sceneSurface;
      if (this.renderPass) this.renderPass.scene = this.sceneSurface;
      this.viewModel.visible = true;
      this.audio.startAmbience(planet.biome, planet.hazard);
      this.music.setMode('surface');
      await new Promise((r) => setTimeout(r, 200));
      this.ui.loading(false);
      this.input.requestLock();
    } else {
      // the ship keeps flying: make sure the world is parented for flight
      this.sceneSurface.add(this.ship.object);
      this.viewModel.visible = false;
    }
  }

  /** hyperspace jump: build a brand new star system and drop into orbit */
  async jumpToSystem(seed) {
    this.seedStr = 'SYS-' + seed;
    this.system = generateSystem(seed);
    this.system.discovered = true;
    // keep the same physical ship, swap the surroundings
    const planet = this.system.planets[0];
    this.planet = planet;
    this.palette.set(planet.palette);
    await this.space.enter(planet, { fromSurface: false });
    this.activeScene = this.sceneSpace;
    if (this.renderPass) this.renderPass.scene = this.sceneSpace;
    this.flags.inSpace = true;
    this.audio.startSpaceAmbience();
    this.ui.setPlanet(planet);
  }

  async enterSpaceDirect(planet) {
    this.planet = planet;
    this.palette.set(planet.palette);
    if (!this.atlasCanvas) {
      this.atlasCanvas = buildAtlasCanvas(planet.palette, planet.seed);
      this.icons.setAtlas(this.atlasCanvas);
    }
    if (!this.particles) this.particles = new Particles(this.sceneSurface);
    this.ui.loading(true, { title: '进入轨道', sub: 'ENTERING ORBIT', progress: 0.4, tip: '提示：按住 Tab 启动脉冲引擎，M 打开星系地图。' });
    await this.space.enter(planet, { fromSurface: false });
    this.mode = 'space';
    this.activeScene = this.sceneSpace;
    if (this.renderPass) this.renderPass.scene = this.sceneSpace;
    else this._setupComposer();
    this.ui.loading(false);
    this.ui.shipHud(true);
    this.viewModel.visible = false;
    this.music.setMode('space');
    this.audio.startSpaceAmbience();
    this.input.requestLock();
  }

  /* =============================== creative mode =============================== */
  /** 创造模式：无限资源、无危害、飞船全解锁 */
  applyCreative() {
    const on = this.creative;
    this.inventory.creative = on;
    document.body.classList.toggle('creative', on);
    const tag = document.getElementById('creative-tag');
    if (tag) tag.classList.toggle('hidden', !on);
    if (on) {
      // ship is fully operational from the start
      this.ship.systems.launch = true;
      this.ship.systems.pulse = true;
      this.ship.systems.hyper = true;
      this.ship.launchFuel = 1;
      this.ship.pulseFuel = 1;
      this.ship.hull = this.ship.maxHull;
      // multi-tool fully repaired
      this.player.tool.scanner = true;
      this.player.tool.visor = true;
      this.player.tool.power = 12;
      this.giveCreativeKit();
      // creative mode is a sandbox: skip the survival mission chain
      if (this.quests && this.quests.index < 11) {
        this.quests.index = 11;
        this.quests.stageTime = 0;
        this.quests.narrationIndex = 99;
      }
    } else {
      this.player.tool.power = 1.9;
    }
  }

  /** 创造模式物品栏：所有常用方块各 999 */
  giveCreativeKit() {
    const ids = [BID.GRASS, BID.DIRT, BID.STONE, BID.COBBLE, BID.BRICK, BID.SAND, BID.SANDSTONE,
      BID.GRAVEL, BID.BASALT, BID.SNOW, BID.ICE, BID.LOG, BID.PLANKS, BID.LEAVES, BID.GLASS,
      BID.METAL_PANEL, BID.METAL_FLOOR, BID.LUMEN, BID.TABLE, BID.REFINER, BID.CRATE,
      BID.BEACON, BID.COMPUTER, BID.CRYSTAL];
    this.inventory.slots = new Array(this.inventory.size).fill(null);
    ids.slice(0, this.inventory.size).forEach((id, i) => {
      this.inventory.slots[i] = { key: itemKeyForBlock(id), count: 999 };
    });
    for (let i = 0; i < 9; i++) this.player.hotbar[i] = i;
    this.player.selected = 0;
    this.inventory._touch();
    this.ui.updateHotbar();
  }

  toggleCreative() {
    this.creative = !this.creative;
    this.applyCreative();
    this.audio.confirm();
    this.ui.toast({
      kind: this.creative ? 'quest' : 'info',
      name: this.creative ? '创造模式已开启 · CREATIVE' : '生存模式 · SURVIVAL',
      amt: this.creative ? '无限资源' : '', dur: 3600,
    });
    this.ui.subtitle(this.creative
      ? '创造模式：资源无限、不受伤害、飞船已全部解锁 (按 G 关闭)'
      : '生存模式：注意生命维持与危害防护 (按 G 开启创造模式)', 5200);
  }

  /** place the player safely on the surface (used by respawn / debug) */
  safeTeleport(x, z) {
    const y = this.world.surfaceY(x, z) + 2.2;
    this.player.pos.set(x + 0.5, y, z + 0.5);
    this.player.vel.set(0, 0, 0);
    this.player.lastGroundY = y;
    return y;
  }

  /* =============================== input handling =============================== */
  onKey(code) {
    if (this.mode === 'title') return;
    const p = this.player;
    // panel toggles
    if (code === 'Escape') {
      if (this.ui.panelOpen) { this.ui.closePanel(); this.uiBlocking = false; this.input.requestLock(); return; }
      this.setPaused(!this.paused);
      return;
    }
    if (this.paused) return;
    if (code === 'KeyG') { this.toggleCreative(); return; }
    if (code === 'F3') { this.showDebug = !this.showDebug; this.ui.setDebug(this.showDebug); this.audio.uiClick(); return; }
    if (code === 'Tab' && (this.mode === 'space' || this.mode === 'fly')) return; // pulse drive
    if (code === 'Tab') { this.togglePanel('inventory'); return; }
    if (code === 'KeyQ' && this.mode !== 'fly' && this.mode !== 'space') { this.togglePanel('craft'); return; }
    if (code === 'KeyJ') { this.togglePanel('discovery'); return; }
    if (code === 'KeyB' && this.mode === 'surface') { this.togglePanel('build'); return; }
    if (code === 'KeyM' && (this.mode === 'space' || this.mode === 'station')) { this.togglePanel('galaxy'); return; }
    if (this.ui.panelOpen) return;

    if (this.mode === 'surface') {
      if (code === 'KeyV') { if (p.tool.visor) p.toggleVisor(); else { this.audio.uiError(); this.ui.toast({ kind: 'warn', name: '分析镜已损坏', amt: '需修复' }); } return; }
      if (code === 'KeyC') { this.doScanPulse(); return; }
      if (code === 'KeyR') { const ok = p.rechargeSystems(); if (ok) this.flags.rechargedLife = true; return; }
      if (code === 'KeyL') { p.lampOn = !p.lampOn; this.audio.uiClick(); return; }
      if (code === 'KeyE') { this.doInteract(); return; }
      if (code === 'KeyF') { this.tryEnterShip(); return; }
      if (code.startsWith('Digit')) {
        const n = parseInt(code.slice(5), 10);
        if (n >= 1 && n <= 9) { p.selected = n - 1; this.ui.updateHotbar(); this.audio.uiHover(); }
        return;
      }
    } else if (this.mode === 'fly' || this.mode === 'space') {
      if (code === 'KeyF') { this.ship.onKeyF(); return; }
      if (code === 'KeyC') { this.ship.toggleCam(); return; }
      if (code === 'KeyE' && this.mode === 'space') { this.space.onInteract(); return; }
    } else if (this.mode === 'station') {
      if (code === 'KeyE' || code === 'KeyF') { this.space.leaveStation(); return; }
      if (code === 'KeyT') { this.togglePanel('trade'); return; }
    }
  }

  togglePanel(name) {
    if (this.ui.panelOpen === name) {
      this.ui.closePanel();
      this.uiBlocking = false;
      this.input.requestLock();
      return;
    }
    this.panels.open(name);
    this.uiBlocking = true;
    this.input.releaseLock();
  }

  setPaused(v) {
    this.paused = v;
    this.ui.el.pause.classList.toggle('hidden', !v);
    if (v) { this.input.releaseLock(); this.music.duck(0.4); }
    else if (this.mode !== 'title' && !this.ui.panelOpen) this.input.requestLock();
  }

  /* =============================== interactions =============================== */
  doInteract() {
    const p = this.player;
    const hit = p.aimHit;
    if (hit) {
      const def = BLOCKS[hit.id];
      if (def.special === 'refiner') { this.panels.openRefiner(hit); this.uiBlocking = true; this.input.releaseLock(); return; }
      if (def.special === 'table') { this.togglePanel('craft'); return; }
      if (def.special === 'crate') { this.ui.toast({ kind: 'info', name: '储物箱: 直接存取尚未启用', amt: '' }); this.audio.uiError(); return; }
      if (def.special === 'computer') {
        this.flags.baseComputer = true;
        this.flags.baseName = this.flags.baseName || (this.planet.name + ' 前哨基地');
        this.audio.confirm();
        this.ui.toast({ kind: 'quest', name: '基地已建立: ' + this.flags.baseName, amt: '' });
        return;
      }
      if (def.special === 'beacon') {
        this.save();
        this.audio.confirm();
        this.ui.toast({ kind: 'info', name: '进度已保存 (信号灯塔)', amt: '' });
        return;
      }
    }
    // creature interaction
    const c = this.creatures?.nearest(p.eye, 4.5);
    if (c) { this.creatures.feed(c); return; }
    this.audio.uiError();
  }

  tryEnterShip() {
    const d = this.player.pos.distanceTo(this.ship.object.position);
    if (d > 7.5) { this.ui.toast({ kind: 'warn', name: '离飞船太远', amt: Math.round(d) + 'u' }); this.audio.uiError(); return; }
    if (!this.ship.systems.launch && !this.creative) {
      this.panels.openShipRepair();
      this.uiBlocking = true;
      this.input.releaseLock();
      return;
    }
    this.enterShip();
  }

  enterShip() {
    this.mode = 'fly';
    this.ship.enter();
    this.viewModel.visible = false;
    this.player.stopBeam();
    this.player.toggleVisor(false);
    this.ui.shipHud(true);
    this.audio.cockpitEnter();
    this.audio.stopAmbience();
    this.music.setMode('surface');
    this.input.requestLock();
  }

  exitShip() {
    this.mode = 'surface';
    this.ship.exit();
    this.viewModel.visible = true;
    this.ui.shipHud(false);
    this.audio.startAmbience(this.planet.biome, this.planet.hazard);
    this.audio.cockpitEnter();
  }

  doScanPulse() {
    const p = this.player;
    if (!p.tool.scanner) { this.audio.uiError(); this.ui.toast({ kind: 'warn', name: '扫描仪已损坏', amt: '需修复' }); return; }
    this.scanPulse = 0;
    this.scanOrigin.copy(p.pos);
    this.audio.scanPing();
    this.ui.toast({ kind: 'info', name: '扫描脉冲已发射', amt: '' });
    // find resource blocks nearby
    const found = [];
    const R = 44;
    const px = Math.floor(p.pos.x), py = Math.floor(p.pos.y), pz = Math.floor(p.pos.z);
    for (const [, chunk] of this.world.chunks) {
      const bx = chunk.cx * 16, bz = chunk.cz * 16;
      if (Math.abs(bx + 8 - px) > R + 8 || Math.abs(bz + 8 - pz) > R + 8) continue;
      for (let y = Math.max(1, py - 22); y < Math.min(CH_H, py + 22); y++) {
        for (let z = 0; z < 16; z++) {
          for (let x = 0; x < 16; x++) {
            const id = chunk.voxels[x + 16 * (z + 16 * y)];
            if (!id) continue;
            const def = BLOCKS[id];
            if (!def.resource || !def.scan) continue;
            const wx = bx + x, wz = bz + z;
            const d = Math.hypot(wx - p.pos.x, y - p.pos.y, wz - p.pos.z);
            if (d > R) continue;
            found.push({ x: wx + 0.5, y: y + 0.5, z: wz + 0.5, id, d, key: def.resource });
          }
        }
      }
    }
    found.sort((a, b) => a.d - b.d);
    const seen = new Set();
    this.resourceMarkers = found.filter((f) => {
      const k = f.key + ':' + Math.round(f.x / 6) + ',' + Math.round(f.z / 6);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, 10).map((f) => ({ pos: new THREE.Vector3(f.x, f.y, f.z), key: f.key, until: this.time + 30 }));
    this.creatures?.revealAll(30);
  }

  findScanTarget(hit) {
    const p = this.player;
    const eye = p.eye;
    const dir = p.lookDir();
    // creatures first
    const c = this.creatures?.raycast(eye, dir, 90);
    if (c) {
      return {
        type: 'fauna', entity: c, label: c.known ? c.speciesName : '未知生物',
        typeLabel: '动物', dist: eye.distanceTo(c.object.position), known: c.known, id: 'fauna:' + c.speciesId,
      };
    }
    if (hit) {
      const def = BLOCKS[hit.id];
      if (def.scan) {
        const id = def.scan + ':' + hit.id;
        const known = this.discoveries.some((d) => d.id === id);
        return {
          type: def.scan === 'FLORA' ? 'flora' : 'mineral', label: def.cn,
          typeLabel: def.scan === 'FLORA' ? '植物' : '矿物',
          dist: hit.dist, known, id, blockId: hit.id,
          pos: new THREE.Vector3(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5),
        };
      }
    }
    return null;
  }

  completeAnalysis(target) {
    if (target.known) { this.audio.uiError(); return; }
    const rng = makeRng(strSeed(target.id + this.planet.seed));
    const value = target.type === 'fauna' ? 800 + Math.floor(rng.next() * 1400) : target.type === 'flora' ? 250 + Math.floor(rng.next() * 500) : 180 + Math.floor(rng.next() * 400);
    const nan = target.type === 'fauna' ? 12 + Math.floor(rng.next() * 20) : 4 + Math.floor(rng.next() * 10);
    const name = target.entity ? target.entity.speciesName : this.procSpeciesName(rng, target.type);
    if (target.entity) { target.entity.known = true; }
    this.discoveries.push({
      id: target.id, name, type: target.type, planet: this.planet.name,
      value, genus: target.entity ? target.entity.genus : (target.type === 'flora' ? '植物属' : '矿物类'),
      time: Date.now(),
    });
    this.addUnits(value);
    this.addNanites(nan);
    this.audio.analyseComplete();
    this.audio.discovery();
    this.ui.toast({ kind: 'quest', name: '新发现: ' + name, amt: '+' + value + ' ◈', dur: 4200 });
    this.ui.cinematic({ main: name, sub: (target.typeLabel || '') + ' · 已登记到发现日志  +' + nan + ' 纳米簇', dur: 3200 });
  }

  procSpeciesName(rng, type) {
    const A = ['Aq', 'Bel', 'Cor', 'Dun', 'Eth', 'Fal', 'Gor', 'Hy', 'Il', 'Jax', 'Kro', 'Lym', 'Mor', 'Nex', 'Ob', 'Pyr', 'Qua', 'Rul', 'Syn', 'Tor', 'Ux', 'Vel', 'Wyr', 'Xen', 'Yor', 'Zul'];
    const B = ['ara', 'eno', 'ium', 'osa', 'ura', 'ith', 'ora', 'yne', 'ade', 'esk', 'ophi', 'anth'];
    const C = ['', ' Prime', ' Minor', ' Major', ' F32', ' X7', ' Alpha'];
    return rng.pick(A) + rng.pick(B) + rng.pick(C);
  }

  /* =============================== economy / events =============================== */
  addUnits(n) { this.units += n; this.ui.setUnits(this.units, this.nanites); }
  addNanites(n) { this.nanites += n; this.ui.setUnits(this.units, this.nanites); }

  onResourceGained(key, n) {
    if (key === 'OXYGEN') this.flags.gotOxygen = true;
  }

  onBlockBroken(hit, def) {
    this.player.wanted += def.resource ? 0.6 : 0.25;
    this.creatures?.onDisturbance(hit, this.player.wanted);
  }

  onBlockPlaced(x, y, z, id) {
    this.flags.blocksPlaced = (this.flags.blocksPlaced || 0) + 1;
    if (id === BID.COMPUTER) {
      this.flags.baseComputer = true;
      this.flags.baseName = this.planet.name + ' 前哨基地';
      this.flags.basePos = [x, y, z];
      this.audio.confirm();
      this.ui.toast({ kind: 'quest', name: '基地计算机已部署', amt: '' });
    }
  }

  onPlayerDeath() {
    this.audio.explosion(0.8);
    this.ui.cinematic({ main: '外骨骼系统失效', sub: 'SIGNAL LOST — 正在于飞船处重生', dur: 4200 });
    this.ui.flash(0.9);
    this.input.releaseLock();
    // lose some resources like NMS (drop half of one random stack)
    const inv = this.inventory;
    const filled = inv.slots.map((s, i) => (s ? i : -1)).filter((i) => i >= 0);
    if (filled.length) {
      const i = filled[Math.floor(Math.random() * filled.length)];
      const s = inv.slots[i];
      const lost = Math.ceil(s.count * 0.5);
      inv.remove(s.key, lost);
      this.ui.toast({ kind: 'warn', name: '损失 ' + itemLabel(s.key), amt: '-' + lost });
    }
    setTimeout(() => {
      const p = this.player;
      const shipPos = this.ship.object.position;
      p.spawn({ x: shipPos.x + 3, y: this.world.surfaceY(shipPos.x + 3, shipPos.z + 3) + 2, z: shipPos.z + 3 });
      p.health = p.maxHealth; p.shield = p.maxShield * 0.5;
      p.life = p.maxLife; p.hazard = p.maxHazard;
      p.dead = false;
      this.ui.flash(0);
      this.input.requestLock();
    }, 4200);
  }

  autoAssignHotbar() {
    const p = this.player;
    const inv = this.inventory;
    // keep existing assignments valid, then fill blanks with placeable blocks
    for (let i = 0; i < 9; i++) {
      const idx = p.hotbar[i];
      if (idx !== null && idx !== undefined && !inv.slots[idx]) p.hotbar[i] = null;
    }
    const assigned = new Set(p.hotbar.filter((x) => x !== null && x !== undefined));
    for (let s = 0; s < inv.size; s++) {
      const stack = inv.slots[s];
      if (!stack || assigned.has(s)) continue;
      const def = ITEMS[stack.key];
      if (!def || def.type !== 'block') continue;
      const free = p.hotbar.indexOf(null);
      if (free < 0) break;
      p.hotbar[free] = s;
      assigned.add(s);
    }
  }

  /* =============================== save =============================== */
  save() {
    if (!this.system) return;
    if (this.world) {
      this.worldEdits = this.worldEdits || {};
      this.worldEdits[this.planet.id] = this.world.serializeEdits();
    }
    saveGame({
      seed: this.seedStr,
      planetIndex: this.system.planets.indexOf(this.planet),
      inSpace: this.mode === 'space' || this.mode === 'station',
      units: this.units, nanites: this.nanites, creative: this.creative,
      discoveries: this.discoveries, flags: this.flags,
      inventory: this.inventory.serialize(),
      player: this.player.serialize(),
      quests: this.quests.serialize(),
      ship: this.ship.serialize(),
      worldEdits: this.worldEdits,
      time: this.time, dayT: this.dayT,
    });
  }

  /* =============================== per-frame =============================== */
  update(dt) {
    this.time += dt;
    this.frame++;
    if (this.mode === 'title' || this.mode === 'loading') return;
    if (this.paused) return;

    // hotbar scroll
    if (this.input.mouse.wheel && !this.uiBlocking && this.mode === 'surface') {
      this.player.selected = (this.player.selected + (this.input.mouse.wheel > 0 ? 1 : -1) + 9) % 9;
      this.ui.updateHotbar();
      this.audio.uiHover();
    }
    if (this._panelRefreshPending) { this._panelRefreshPending = false; this.panels.refresh(); }

    // day / night
    if (this.mode === 'surface' || this.mode === 'fly') this.dayT = (this.dayT + dt / DAY_LENGTH) % 1;
    shared.uTime.value = this.time;

    // storms
    this.updateWeather(dt);

    this._applyCameraRange();
    this.perfWatch(dt);

    // creative mode keeps the ship fuelled and fully repaired
    if (this.creative) {
      this.ship.launchFuel = 1;
      this.ship.pulseFuel = 1;
      this.ship.systems.launch = true;
      this.ship.systems.pulse = true;
      this.ship.systems.hyper = true;
      this.ship.hull = this.ship.maxHull;
      this.ship.shield = this.ship.maxShield;
    }

    // watchdog: never leave a cinematic armed once the mode moved on
    if (this.transition.active && this.mode !== 'transition') this.transition._end();

    if (this.mode === 'surface') this.updateSurface(dt);
    else if (this.mode === 'fly') this.updateFlight(dt);
    else if (this.mode === 'space' || this.mode === 'station') this.space.update(dt);
    else if (this.mode === 'transition') this.transition.update(dt);

    this.quests.update(dt);
    this.ui.update(dt);
    this.ui.setUnits(this.units, this.nanites);
    this.ui.setClock(this.dayT, this.mode === 'space');
    this.music.update(dt, {
      dayT: this.dayT,
      underground: this.mode === 'surface' && this.world ? this.player.pos.y < this.world.surfaceY(this.player.pos.x, this.player.pos.z) - 3 : false,
      altitude: this.player.pos.y,
      hazard: this.planet ? (this.planet.hazard === 'none' ? 0 : (this.planet.hazardLevel || 1) / 4) : 0,
      health: this.player.health / this.player.maxHealth,
    });

    if (this.showDebug && this.frame % 12 === 0) {
      const p = this.player;
      const info = this.renderer.info;
      this.ui.updateDebug([
        'NO BLOCK\'S SKY  ·  ' + Math.round(this.fps) + ' fps  ·  ' + this.mode,
        'XYZ ' + p.pos.x.toFixed(1) + ' / ' + p.pos.y.toFixed(1) + ' / ' + p.pos.z.toFixed(1),
        'planet ' + (this.planet ? this.planet.name + ' [' + this.planet.biome + ']' : '—') + '  system ' + (this.system ? this.system.name : '—'),
        'chunks ' + (this.world ? this.world.chunks.size : 0) + '  dirty ' + (this.world ? this.world.dirty.size : 0) + '  geom ' + info.memory.geometries + '  tex ' + info.memory.textures,
        'creatures ' + (this.creatures ? this.creatures.list.length : 0) + '  particles ' + (this.particles ? (this.particles.active || 0) : 0) + '  dayT ' + this.dayT.toFixed(3),
        'aim ' + (p.aimHit ? BLOCKS[p.aimHit.id].name + ' @' + p.aimHit.x + ',' + p.aimHit.y + ',' + p.aimHit.z : '—'),
        'quest ' + this.quests.current.id + '  units ' + this.units + '  nanites ' + this.nanites,
      ]);
    }

    // autosave
    this.saveTimer -= dt;
    if (this.saveTimer <= 0) { this.saveTimer = 45; this.save(); }
  }

  updateWeather(dt) {
    if (this.mode !== 'surface' && this.mode !== 'fly') return;
    this.stormTimer -= dt;
    if (this.stormTimer <= 0) {
      this.storm = !this.storm;
      this.stormTimer = this.storm ? 55 + Math.random() * 45 : 220 + Math.random() * 280;
      if (this.storm) {
        this.ui.toast({ kind: 'warn', name: '风暴来袭: ' + (this.planet.weather), amt: '寻找掩体', dur: 5000 });
        this.ui.subtitle('检测到剧烈天气活动 —— 危害防护消耗加剧。', 5200);
        this.audio.sentinelScan();
        this.music.setIntensity(0.85);
      } else {
        this.ui.toast({ kind: 'info', name: '风暴已过去', amt: '', dur: 3000 });
        this.music.setIntensity(0.5);
      }
    }
  }

  updateSurface(dt) {
    const p = this.player;
    const world = this.world;
    world.update(p.pos, 2);
    p.update(dt);
    this.creatures.update(dt);
    this.particles.update(dt, world);

    // camera
    const eye = p.eye;
    const bobAmt = Math.min(1, Math.hypot(p.vel.x, p.vel.z) / 5) * (p.onGround ? 1 : 0.15);
    const bobY = Math.sin(p.bob * 2) * 0.035 * bobAmt;
    const bobX = Math.cos(p.bob) * 0.03 * bobAmt;
    this.camera.position.set(eye.x + bobX * 0.4, eye.y + bobY, eye.z);
    const shake = this.ui.shakeAmt;
    if (shake > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * shake * 0.35;
      this.camera.position.y += (Math.random() - 0.5) * shake * 0.35;
    }
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(p.yaw);
    this.camera.rotateX(p.pitch);
    this.camera.rotateZ(bobX * 0.5 + p.viewRoll);
    const targetFov = this.settings.fov + (p.sprinting ? 4 : 0) + (p.headInWater ? -4 : 0);
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 6);
    this.camera.updateProjectionMatrix();

    // sky + sun
    const sunDir = this.sky.update(dt, this.camera.position, this.dayT, this.time);
    shared.uSunDir.value.copy(sunDir);
    const dayLight = clamp(sunDir.y * 1.6 + 0.28, 0.06, 1);
    const stormMul = this.storm ? 0.55 : 1;
    shared.uSunIntensity.value = dayLight * 0.95 * stormMul;
    const P = this.planet.palette;
    const nightFog = [P.fog[0] * 0.1, P.fog[1] * 0.12, P.fog[2] * 0.17];
    const fogMix = clamp(sunDir.y * 2 + 0.35, 0, 1);
    const fogK = 0.8 * stormMul;
    shared.uFogColor.value.setRGB(
      lerp(nightFog[0], P.fog[0] * fogK, fogMix) / 255,
      lerp(nightFog[1], P.fog[1] * fogK, fogMix) / 255,
      lerp(nightFog[2], P.fog[2] * fogK, fogMix) / 255
    );
    shared.uAmbient.value.setRGB(
      lerp(P.ambient[0] * 0.1, P.ambient[0] * 0.46, fogMix) / 255,
      lerp(P.ambient[1] * 0.11, P.ambient[1] * 0.46, fogMix) / 255,
      lerp(P.ambient[2] * 0.15, P.ambient[2] * 0.46, fogMix) / 255
    );
    this.sky.uniforms.uZenith.value.setRGB(
      lerp(P.sky[0] * 0.06, P.sky[0], fogMix) / 255,
      lerp(P.sky[1] * 0.07, P.sky[1], fogMix) / 255,
      lerp(P.sky[2] * 0.12, P.sky[2], fogMix) / 255
    );
    this.sky.uniforms.uHorizon.value.setRGB(
      lerp(P.skyHorizon[0] * 0.09, P.skyHorizon[0], fogMix) / 255,
      lerp(P.skyHorizon[1] * 0.1, P.skyHorizon[1], fogMix) / 255,
      lerp(P.skyHorizon[2] * 0.16, P.skyHorizon[2], fogMix) / 255
    );

    // player lamp
    const wantLamp = p.lampOn || dayLight < 0.35 || p.pos.y < world.surfaceY(p.pos.x, p.pos.z) - 3;
    shared.uLampStrength.value += ((wantLamp ? 1.15 : 0) - shared.uLampStrength.value) * Math.min(1, dt * 5);
    shared.uLampPos.value.copy(this.camera.position);
    shared.uUnderwater.value = p.headInWater ? 1 : 0;

    // scan pulse
    if (this.scanPulse >= 0) {
      this.scanPulse += dt * 42;
      shared.uScanPulse.value = this.scanPulse;
      shared.uScanOrigin.value.copy(this.scanOrigin);
      if (this.scanPulse > 95) { this.scanPulse = -1; shared.uScanPulse.value = -1; }
    }

    this.updateWeatherFx(dt);
    this.updateAimVisuals(dt);
    this.updateViewModel(dt);
    this.updateHudMarkers();

    this.ui.updateVitals(p);
    this.ui.setMineProgress(p.mining.firing ? p.mining.progress : 0);
    this.ui.setBeamHeat(p.tool.heat, p.tool.overheated);
    if (p.visorOn) {
      const t = p.analyse.target;
      this.ui.setVisorTarget(t, p.analyse.progress);
    }
    // interact prompt
    let prompt = null;
    const shipDist = p.pos.distanceTo(this.ship.object.position);
    if (shipDist < 7.5) prompt = { text: this.ship.systems.launch ? '进入飞船' : '维修飞船', key: 'F' };
    else if (p.aimHit) {
      const def = BLOCKS[p.aimHit.id];
      if (def.special === 'refiner') prompt = { text: '使用精炼器', key: 'E' };
      else if (def.special === 'table') prompt = { text: '使用构筑台', key: 'E' };
      else if (def.special === 'computer') prompt = { text: '基地计算机', key: 'E' };
      else if (def.special === 'beacon') prompt = { text: '保存进度', key: 'E' };
    }
    if (!prompt) {
      const c = this.creatures.nearest(p.eye, 4.5);
      if (c) prompt = { text: '喂食生物', key: 'E' };
    }
    this.ui.setInteract(prompt ? prompt.text : null, prompt ? prompt.key : 'E');
    this.audio.setUnderground(p.pos.y < world.surfaceY(p.pos.x, p.pos.z) - 4);
    this.audio.setUnderwater(p.headInWater);
  }

  /** wind-blown weather: sand / snow / ash / rain streaks driven by the storm state */
  updateWeatherFx(dt) {
    const p = this.player;
    const biome = this.planet.biome;
    const wet = biome === 'lush' || biome === 'toxic';
    const always = biome === 'frozen' || biome === 'volcanic';
    const active = this.storm || always;
    if (!active) return;
    this._windAng = (this._windAng || 0) + dt * 0.08;
    const wx = Math.cos(this._windAng), wz = Math.sin(this._windAng);
    const strength = this.storm ? 1 : 0.28;
    const count = Math.min(9, Math.round((this.storm ? 7 : 2) * Math.min(1, dt * 60)));
    const colors = {
      desert: ['#e8c882', '#d8b872'], frozen: ['#ffffff', '#dceaf6'], volcanic: ['#6a5a52', '#ff7a2e'],
      toxic: ['#b6ff4a', '#8ad06a'], radioactive: ['#6affe0', '#c8ffd6'], exotic: ['#ffb6f2', '#e8c0ff'],
      lush: ['#cfe6ff', '#a8d0f0'], barren: ['#c0b8a8', '#a89f90'],
    }[biome] || ['#dddddd', '#bbbbbb'];
    for (let i = 0; i < count; i++) {
      const r = 6 + Math.random() * 26;
      const a = Math.random() * Math.PI * 2;
      const x = p.pos.x + Math.cos(a) * r - wx * 12;
      const z = p.pos.z + Math.sin(a) * r - wz * 12;
      const y = p.pos.y + 2 + Math.random() * 14;
      const col = colors[Math.random() < 0.7 ? 0 : 1];
      const fast = wet ? 26 : 18;
      this.particles.spawn({
        x, y, z,
        vx: wx * fast * strength + (Math.random() - 0.5) * 3,
        vy: wet ? -22 : -3 - Math.random() * 4,
        vz: wz * fast * strength + (Math.random() - 0.5) * 3,
        life: 0.9 + Math.random() * 0.6,
        size: wet ? 0.07 : 0.11 + Math.random() * 0.09,
        color: col, grav: wet ? 0.4 : 0.05, drag: 0.99, glow: biome === 'volcanic' && Math.random() < 0.3,
      });
    }
  }

  updateAimVisuals(dt) {
    const p = this.player;
    const hit = p.aimHit;
    if (hit && !p.visorOn) {
      this.selBox.visible = true;
      this.selBox.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      if (p.mining.firing && p.mining.progress > 0.02) {
        this.crackBox.visible = true;
        this.crackBox.position.copy(this.selBox.position);
        const stage = Math.min(9, Math.floor(p.mining.progress * 10));
        this.crackTex.offset.x = stage * 0.1;
      } else this.crackBox.visible = false;
    } else {
      this.selBox.visible = false;
      this.crackBox.visible = false;
    }

    // beam
    const firing = p.mining.firing && hit;
    this.beamMesh.visible = firing;
    this.beamGlow.visible = firing;
    if (firing) {
      const muzzle = this.camera.localToWorld(new THREE.Vector3(0.22, -0.16, -0.85));
      const target = new THREE.Vector3(hit.x + 0.5 + hit.nx * 0.5, hit.y + 0.5 + hit.ny * 0.5, hit.z + 0.5 + hit.nz * 0.5);
      const mid = muzzle.clone().add(target).multiplyScalar(0.5);
      const len = muzzle.distanceTo(target);
      for (const m of [this.beamMesh, this.beamGlow]) {
        m.position.copy(mid);
        m.lookAt(target);
        m.scale.set(1, 1, len);
      }
      const flick = 0.75 + Math.random() * 0.35;
      this.beamMesh.material.opacity = 0.85 * flick;
      this.beamGlow.material.opacity = 0.3 * flick;
      shared.uLampStrength.value = Math.max(shared.uLampStrength.value, 0.7);
      this.impactSprite.visible = true;
      this.impactSprite.position.copy(target);
      const heat = this.player.tool.heat;
      this.impactSprite.scale.setScalar((0.75 + heat * 0.8) * (0.85 + Math.random() * 0.3));
      this.impactSprite.material.color.setRGB(1, 0.85 - heat * 0.3, 0.55 - heat * 0.35);
    } else {
      this.impactSprite.visible = false;
    }
  }

  updateViewModel(dt) {
    const p = this.player;
    const vm = this.viewModel;
    if (!vm.visible) return;
    const t = this.time;
    const moveAmt = Math.min(1, Math.hypot(p.vel.x, p.vel.z) / 5);
    const targetPos = new THREE.Vector3(
      0.3 + Math.sin(t * 1.6) * 0.006,
      -0.25 + Math.sin(t * 3.2) * 0.008 + Math.sin(p.bob * 2) * 0.02 * moveAmt,
      -0.45 + (p.mining.firing ? 0.045 + Math.random() * 0.012 : 0)
    );
    vm.position.lerp(targetPos, Math.min(1, dt * 9));
    const targetRot = new THREE.Euler(
      0.02 + (p.mining.firing ? -0.05 : 0) + p.vel.y * -0.004,
      -0.13 + Math.sin(t * 0.9) * 0.01,
      0.03 + Math.cos(p.bob) * 0.02 * moveAmt
    );
    vm.rotation.x += (targetRot.x - vm.rotation.x) * Math.min(1, dt * 8);
    vm.rotation.y += (targetRot.y - vm.rotation.y) * Math.min(1, dt * 8);
    vm.rotation.z += (targetRot.z - vm.rotation.z) * Math.min(1, dt * 8);
    if (this.toolTip) {
      const heat = p.tool.heat;
      const c = this.toolTip.material.color;
      if (p.mining.firing) c.setRGB(2.6, 1.1 + heat * 0.8, 0.3);
      else if (p.visorOn) c.setRGB(0.4, 1.9, 2.4);
      else c.setRGB(1.3 + Math.sin(t * 2) * 0.12, 0.7, 0.24);
      if (this.toolCoils) {
        this.toolCoils.forEach((coil, i) => {
          const phase = Math.sin(t * 12 - i * 1.1) * 0.5 + 0.5;
          const amt = p.mining.firing ? 0.6 + phase * 1.9 : 0.35 + Math.sin(t * 1.5 - i) * 0.1;
          coil.material.color.setRGB(amt * 1.5, amt * 0.65 + heat * 0.5, amt * 0.2);
        });
      }
      if (this.toolScope) {
        const on = p.visorOn ? 3 : 1.4;
        this.toolScope.material.color.setRGB(0.25 * on, 0.85 * on, on);
      }
      if (this.toolLight) {
        const warn = p.tool.overheated || p.life < 20;
        this.toolLight.material.color.setRGB(warn ? 3 : 0.3, warn ? 0.3 : 2.4, warn ? 0.3 : 2.8);
      }
    }
  }

  updateHudMarkers() {
    const cam = this.camera;
    const p = this.player;
    const list = [];
    const project = (v3) => {
      const v = v3.clone().project(cam);
      if (v.z > 1) return null;
      return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight, behind: v.z > 1 };
    };
    // ship
    const shipPos = this.ship.object.position.clone().add(new THREE.Vector3(0, 3, 0));
    const sp = project(shipPos);
    const sd = p.pos.distanceTo(this.ship.object.position);
    if (sp && sd > 6) list.push({ x: sp.x, y: sp.y, icon: '▲', label: '飞船', dist: sd, cls: 'ship' });
    // base
    if (this.flags.basePos) {
      const bp = project(new THREE.Vector3(this.flags.basePos[0] + 0.5, this.flags.basePos[1] + 2, this.flags.basePos[2] + 0.5));
      const bd = p.pos.distanceTo(new THREE.Vector3(this.flags.basePos[0], this.flags.basePos[1], this.flags.basePos[2]));
      if (bp && bd > 8) list.push({ x: bp.x, y: bp.y, icon: '⌂', label: this.flags.baseName || '基地', dist: bd, cls: 'base' });
    }
    // scanned resources
    this.resourceMarkers = this.resourceMarkers.filter((m) => m.until > this.time);
    for (const m of this.resourceMarkers) {
      const mp = project(m.pos);
      const d = p.pos.distanceTo(m.pos);
      if (mp && d > 4) list.push({ x: mp.x, y: mp.y, icon: '◈', label: itemLabel(m.key), dist: d, cls: 'poi', opacity: clamp((m.until - this.time) / 5, 0, 1) });
    }
    // creatures revealed
    for (const c of this.creatures.revealedList()) {
      const cp = project(c.object.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
      const d = p.pos.distanceTo(c.object.position);
      if (cp && d > 5) list.push({ x: cp.x, y: cp.y, icon: c.hostile ? '☠' : '❋', label: c.known ? c.speciesName : '生物', dist: d, cls: c.hostile ? 'warn' : 'scanned' });
    }
    this.ui.setMarkers(list);

    // compass
    const comp = [];
    const bearing = (v) => Math.atan2(v.x - p.pos.x, -(v.z - p.pos.z));
    comp.push({ bearing: bearing(this.ship.object.position), icon: '▲', label: '飞船', cls: 'ship' });
    if (this.flags.basePos) comp.push({ bearing: bearing(new THREE.Vector3(this.flags.basePos[0], 0, this.flags.basePos[2])), icon: '⌂', label: '基地', cls: 'base' });
    this.ui.setCompass(comp, p.yaw);
  }

  updateFlight(dt) {
    this.world.update(this.ship.object.position, 3);
    this.ship.update(dt);
    this.particles.update(dt, null);
    this.creatures.update(dt);
    const sunDir = this.sky.update(dt, this.camera.position, this.dayT, this.time);
    shared.uSunDir.value.copy(sunDir);
    const dayLight = clamp(sunDir.y * 1.6 + 0.28, 0.06, 1);
    shared.uSunIntensity.value = dayLight * 0.95;
    shared.uLampStrength.value *= 0.9;
    shared.uUnderwater.value = 0;
    this.ui.updateVitals(this.player);
  }

  render() {
    if (this.composer) {
      if (this.renderPass) this.renderPass.scene = this.activeScene;
      if (this.bloom) this.bloom.enabled = this.settings.bloom;
      this.composer.render();
    } else {
      this.renderer.render(this.activeScene, this.camera);
    }
  }

  loop(now) {
    const dt = Math.min(0.05, (now - (this._last || now)) / 1000);
    this._last = now;
    this._fpsAcc += dt; this._fpsFrames++;
    if (this._fpsAcc > 0.5) { this.fps = this._fpsFrames / this._fpsAcc; this._fpsAcc = 0; this._fpsFrames = 0; }
    try {
      this.update(dt);
    } catch (e) {
      this._logError('update', e);
    }
    try {
      this.render();
    } catch (e) {
      this._logError('render', e);
    }
    this.input.endFrame();
    requestAnimationFrame((t) => this.loop(t));
  }

  /** never let one bad frame kill the game loop; log the first few of each kind */
  _logError(where, e) {
    this._errCounts = this._errCounts || {};
    const sig = where + ':' + ((e && e.message) || e);
    const n = (this._errCounts[sig] = (this._errCounts[sig] || 0) + 1);
    if (n <= 3) console.error('[' + where + ']', e);
    else if (n === 4) console.error('[' + where + '] further identical errors suppressed:', sig);
  }

  /** advance the simulation without waiting for frames (debug/QA only) */
  debugStep(dtStep = 0.05, times = 20) {
    for (let i = 0; i < times; i++) {
      try { this.update(dtStep); } catch (e) { this._logError('debugStep', e); }
    }
    return { mode: this.mode, t: this.transition.active ? this.transition.t : null };
  }

  start() {
    this._setupComposer();
    requestAnimationFrame((t) => { this._last = t; this.loop(t); });
  }
}

function require_placeholder() {
  // neutral palette so the Palette helper is valid before a planet is loaded
  return {
    grass: [110, 190, 90], grass2: [140, 220, 110], dirt: [125, 90, 58], stone: [139, 144, 152],
    sand: [223, 211, 154], wood: [134, 96, 58], leaf: [79, 168, 61], water: [61, 134, 216],
    rock: [124, 129, 137], glow: [138, 255, 208], floraRed: [224, 72, 61], floraYellow: [242, 201, 58],
    crystal: [73, 200, 255], sky: [90, 162, 232], skyHorizon: [191, 228, 255], fog: [169, 214, 245],
    sun: [255, 243, 214], cloud: [255, 255, 255], ambient: [111, 136, 168], spaceTint: [89, 178, 255],
  };
}

const game = new Game();
window.GAME = game;
window.THREE = THREE;
window.SHARED = shared;
game.start();
