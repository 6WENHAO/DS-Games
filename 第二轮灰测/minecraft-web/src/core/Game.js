/* =====================================================================
 * Game — 游戏总控：状态机、输入分派、更新与渲染管线、存档
 * ===================================================================== */
import { Loop } from './Loop.js';
import { Input, KEYS } from './Input.js';
import settings from './Settings.js';
import { bus, EV } from './EventBus.js';
import { GAMEMODE, CHUNK_SIZE } from './Constants.js';

import { Renderer } from '../render/Renderer.js';
import { EntityRenderer } from '../render/EntityRenderer.js';
import { Camera } from '../render/Camera.js';

import { World } from '../world/World.js';
import { Player } from '../entity/Player.js';
import { EntityManager } from '../entity/EntityManager.js';

import { ParticleSystem } from '../game/Particles.js';
import { Inventory } from '../game/Inventory.js';
import { Interaction } from '../game/Interaction.js';
import { pickBlock } from '../game/Raycast.js';
import { sound } from '../game/Sound.js';
import { saveWorld, loadWorld, makeWorldId, lastWorldId } from '../game/Storage.js';

import { HUD } from '../ui/HUD.js';
import { DebugOverlay } from '../ui/DebugOverlay.js';
import { Chat } from '../ui/Chat.js';
import { InventoryUI } from '../ui/InventoryUI.js';
import { Menus } from '../ui/Menus.js';
import { initIcons } from '../ui/ItemIcons.js';

import { clamp, clamp01, damp, DEG2RAD } from '../math/MathUtils.js';
import { raycastBlocks } from '../game/Raycast.js';

export const STATE = Object.freeze({
  TITLE: 'title', LOADING: 'loading', PLAYING: 'playing',
  PAUSED: 'paused', INVENTORY: 'inventory', DEAD: 'dead',
});

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = STATE.TITLE;
    this.worldId = null;

    this.renderer = new Renderer(canvas);
    this.entityRenderer = new EntityRenderer(
      this.renderer.glc, this.renderer.atlas, this.renderer.sharedIbo);
    initIcons(this.renderer.atlas);

    this.camera = new Camera();
    this.input = new Input(canvas);
    this.loop = new Loop((dt, now) => this.frame(dt, now), (i) => this.tick(i));

    this.world = null;
    this.player = null;
    this.entities = null;
    this.particles = null;
    this.inventory = new Inventory();
    this.interaction = new Interaction(this);

    this.hit = null;
    this.perspective = 0;          // 0=第一人称 1=第三人称背后 2=第三人称正面
    this.thirdDistance = 4;
    this.underwater = false;
    this.autosaveTimer = 0;
    this.playTime = 0;
    this.damageFlash = 0;
    this.fpsLimitAccum = 0;

    // UI
    this.hud = new HUD(this);
    this.debug = new DebugOverlay(this);
    this.chat = new Chat(this);
    this.inventoryUI = new InventoryUI(this);
    this.menus = new Menus(this);

    this._bindEvents();
    this._resize();
    window.addEventListener('resize', () => this._resize());
    this.loop.start();
  }

  /* ================= 事件 ================= */
  _bindEvents() {
    bus.on('input:keydown', (code, e) => this.onKeyDown(code, e));
    bus.on('input:unlock', () => {
      if (this.state === STATE.PLAYING) this.pause();
    });

    bus.on(EV.PLAYER_DAMAGE, () => { this.damageFlash = 1; this.camera.shake = 0.6; });
    bus.on(EV.PLAYER_DIED, (reason) => this.onDeath(reason));
    bus.on(EV.SETTINGS_CHANGED, (key) => {
      if (key === 'renderDistance' && this.world) this.world.renderDistance = settings.get('renderDistance');
      if (key === 'resolutionScale' || key === '*') this._resize();
      if (key === 'fov') this.camera.fov = settings.get('fov');
    });
    bus.on(EV.WEATHER_CHANGED, (w) => {
      const names = { clear: '天气转晴', rain: '开始下雨了', thunder: '雷雨来临' };
      if (this.state === STATE.PLAYING) this.chat.print(names[w] || w, 'sys');
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === STATE.PLAYING) this.pause();
    });

    this.canvas.addEventListener('mousedown', () => {
      sound.init();
      if (this.state === STATE.PLAYING && !this.input.locked) this.input.requestLock();
    });
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.resize(w, h);
    this.camera.aspect = this.renderer.glc.aspect;
    const scale = settings.get('guiScale');
    document.documentElement.style.setProperty('--gui-scale', scale);
  }

  /* ================= 世界创建 / 载入 ================= */

  async newWorld({ name, seed, type, mode, structures }) {
    this.menus.showLoading('正在生成世界「' + name + '」');
    await frameDelay();

    const finalSeed = seed && seed.length ? seed : String(Math.floor(Math.random() * 1e9));
    this.worldId = makeWorldId(name);
    this.world = new World({
      name, seed: finalSeed, type, structures,
      renderDistance: settings.get('renderDistance'),
    });
    await this._bootstrapWorld(mode);
    this.chat.print(`世界「${name}」已创建，种子 ${finalSeed}`, 'sys');
  }

  async loadAndStart(worldId) {
    const data = loadWorld(worldId);
    if (!data) {
      this.chat.print('存档不存在，创建新世界', 'err');
      return this.newWorld({ name: '新的世界', seed: '', type: 'default', mode: 'creative', structures: true });
    }
    this.menus.showLoading('正在载入「' + (data.name || '世界') + '」');
    await frameDelay();
    this.worldId = worldId;
    this.world = new World({
      name: data.name, seed: data.seed, type: data.type,
      structures: true, renderDistance: settings.get('renderDistance'),
    });
    this.world.loadEdits(data);
    await this._bootstrapWorld(data.player?.gamemode || 'creative', data);
    this.chat.print(`已载入「${data.name}」`, 'sys');
  }

  async _bootstrapWorld(mode, saveData = null) {
    const world = this.world;
    this.particles = new ParticleSystem(world, this.renderer.atlas);
    this.entities = new EntityManager(world, this.particles);
    this.entities.onPickup = (item, count) => this.inventory.add(item, count);

    this.menus.setProgress(0.08, '寻找出生点');
    await frameDelay();

    const spawn = saveData?.player?.position || world.findSpawn();
    this.player = new Player(world, spawn);
    this.player.setGamemode(mode === 'survival' ? GAMEMODE.SURVIVAL : GAMEMODE.CREATIVE);

    // 分批生成初始区块，保持进度条流动
    const radius = 3;
    world.primeAround(Math.floor(spawn[0]), Math.floor(spawn[2]), radius, (p, text) => {
      this.menus.setProgress(0.1 + p * 0.55, text);
    });
    await frameDelay();
    this.menus.setProgress(0.7, '构建网格');

    // 让玩家站在地面上
    if (!saveData) {
      const sy = world.highestSolidY(Math.floor(spawn[0]), Math.floor(spawn[2]));
      this.player.teleport(spawn[0], sy + 0.2, spawn[2]);
      this.player.spawnPoint = [spawn[0], sy + 0.2, spawn[2]];
    }

    // 背包
    this.inventory.clear();
    if (saveData?.inventory) this.inventory.deserialize(saveData.inventory);
    else if (this.player.isCreative) this.inventory.giveCreativeKit();
    else this.inventory.giveStarterKit();

    if (saveData?.player) this.player.deserialize(saveData.player);

    // 相机
    this.camera.fov = settings.get('fov');
    this.camera.position[0] = this.player.position[0];
    this.camera.position[1] = this.player.eyeY;
    this.camera.position[2] = this.player.position[2];
    this.camera.yaw = this.player.yaw;
    this.camera.pitch = this.player.pitch;
    this.camera.far = Math.max(160, settings.get('renderDistance') * CHUNK_SIZE * 2.2);
    this.camera.update(0.016);

    // 预建网格（外环区块要等邻居装饰完成，因此以"没有新进展"作为退出条件）
    let idle = 0;
    for (let i = 0; i < 60; i++) {
      this.renderer.buildMeshes(world, this.camera, 12);
      const built = this.renderer.stats.meshedThisFrame;
      this.menus.setProgress(0.7 + Math.min(1, i / 24) * 0.28,
        `构建网格 ${world.dirtySections.size} 剩余`);
      if (world.dirtySections.size === 0) break;
      idle = built === 0 ? idle + 1 : 0;
      if (idle >= 2) break;              // 剩下的交给主循环渐进完成
      if (i % 5 === 0) await frameDelay();
    }

    if (settings.get('mobs')) this.entities.populateInitial(this.player, 8);

    this.menus.setProgress(1, '完成');
    await frameDelay();

    this.hud.show();
    this.hud.refreshHotbar();
    this.state = STATE.PLAYING;
    this.menus.hideAll();
    this.playTime = 0;
    this.autosaveTimer = 0;
    sound.init();
    this.input.enabled = true;
    this.input.requestLock();
  }

  /* ================= 状态切换 ================= */

  pause() {
    if (this.state !== STATE.PLAYING) return;
    this.state = STATE.PAUSED;
    this.input.exitLock();
    this.input.enabled = false;
    this.menus.showScreen('pause');
  }

  resume() {
    if (this.state !== STATE.PAUSED) return;
    this.state = STATE.PLAYING;
    this.menus.hideAll();
    this.input.enabled = true;
    this.input.requestLock();
  }

  openInventory(mode = null) {
    if (this.state !== STATE.PLAYING) return;
    this.state = STATE.INVENTORY;
    this.input.exitLock();
    this.input.enabled = false;
    this.inventoryUI.show(mode);
  }

  closeInventory() {
    if (this.state !== STATE.INVENTORY) return;
    this.inventoryUI.hide();
    this.state = STATE.PLAYING;
    this.input.enabled = true;
    this.input.requestLock();
    this.hud.refreshHotbar();
  }

  onDeath(reason) {
    this.state = STATE.DEAD;
    this.input.exitLock();
    this.input.enabled = false;
    document.getElementById('death-msg').textContent =
      `${reason || '你死了'} · 存活 ${Math.floor(this.playTime / 60)} 分钟`;
    this.menus.showScreen('death');
  }

  respawn() {
    this.player.respawn();
    this.world.primeAround(
      Math.floor(this.player.position[0]), Math.floor(this.player.position[2]), 2);
    this.state = STATE.PLAYING;
    this.menus.hideAll();
    this.input.enabled = true;
    this.input.requestLock();
  }

  saveAndQuit() {
    this.save();
    this.state = STATE.TITLE;
    this.input.exitLock();
    this.input.enabled = false;
    this.hud.hide();
    this.debug.visible = false;
    this.debug.el.classList.add('hidden');
    this.menus.showScreen('title');
    if (this.world) {
      for (const c of this.world.chunks.values()) this.renderer.dropChunk(c);
      this.world.chunks.clear();
    }
    this.entities?.clear();
    this.particles?.clear();
    this.world = null;
    this.player = null;
  }

  save() {
    if (!this.world || !this.player) return { ok: false, error: '没有世界' };
    const payload = this.world.serialize(this.player.serialize());
    payload.inventory = this.inventory.serialize();
    payload.playTime = this.playTime;
    const res = saveWorld(this.worldId, payload);
    if (res.ok) bus.emit(EV.TOAST, '已保存');
    return res;
  }

  setRenderDistance(n) {
    settings.set('renderDistance', n);
    if (this.world) this.world.renderDistance = n;
    this.camera.far = Math.max(160, n * CHUNK_SIZE * 2.2);
  }

  /* ================= 输入 ================= */

  onKeyDown(code, e) {
    // 全局
    if (code === 'F3') { this.debug.toggle(); return; }
    if (code === 'F11') return;

    if (code === 'Escape') {
      if (this.state === STATE.INVENTORY) { this.closeInventory(); return; }
      if (this.state === STATE.PLAYING) { this.pause(); return; }
      if (this.state === STATE.PAUSED) { this.resume(); return; }
      if (this.menus.current === 'options' || this.menus.current === 'help' ||
          this.menus.current === 'newworld') {
        this.menus.showScreen(this.state === STATE.PAUSED ? 'pause' : 'title');
      }
      return;
    }

    if (this.state === STATE.INVENTORY) {
      if (KEYS.INVENTORY.includes(code)) this.closeInventory();
      return;
    }
    if (this.state !== STATE.PLAYING) return;

    if (KEYS.INVENTORY.includes(code)) { this.openInventory(); return; }
    if (KEYS.CHAT.includes(code)) { this._openChat(''); return; }
    if (code === 'Slash') { this._openChat('/'); return; }
    if (KEYS.PERSPECTIVE.includes(code) || code === 'F5') {
      this.perspective = (this.perspective + 1) % 3;
      bus.emit(EV.TOAST, ['第一人称', '第三人称（背后）', '第三人称（正面）'][this.perspective]);
      return;
    }
    if (KEYS.DROP.includes(code)) { this.interaction.dropSelected(e && e.ctrlKey); return; }

    // 数字键选择快捷栏
    if (code.startsWith('Digit')) {
      const n = parseInt(code.slice(5), 10);
      if (n >= 1 && n <= 9) this.inventory.select(n - 1);
      return;
    }
  }

  _openChat(prefix) {
    this.input.releaseAll();
    this.chat.show(prefix);
  }

  /** 收集移动输入 */
  _moveInput() {
    const i = this.input;
    if (this.state !== STATE.PLAYING || !i.locked) {
      return { forward: 0, strafe: 0, jump: false, sneak: false, sprint: false, jumpPressed: false };
    }
    let forward = 0, strafe = 0;
    if (i.any(KEYS.FORWARD)) forward += 1;
    if (i.any(KEYS.BACK)) forward -= 1;
    if (i.any(KEYS.RIGHT)) strafe += 1;
    if (i.any(KEYS.LEFT)) strafe -= 1;
    return {
      forward, strafe,
      jump: i.any(KEYS.JUMP),
      sneak: i.any(KEYS.SNEAK),
      sprint: i.any(KEYS.SPRINT),
      jumpPressed: i.anyPressed(KEYS.JUMP),
    };
  }

  /* ================= 每帧 ================= */

  frame(dt, now) {
    const maxFps = settings.get('maxFps');
    if (maxFps < 260) {
      this.fpsLimitAccum += dt;
      const target = 1 / maxFps;
      if (this.fpsLimitAccum < target) return;
      this.fpsLimitAccum = 0;
    }

    if (this.state === STATE.TITLE || !this.world) {
      this._renderTitleBackground(dt);
      this.input.endFrame();
      return;
    }

    const playing = this.state === STATE.PLAYING;
    this.playTime += dt;

    // ---- 视角 ----
    if (playing && this.input.locked) {
      const d = this.input.consumeMouseDelta();
      if (d.dx || d.dy) {
        // forward = (-sin yaw, -cos yaw)：向右看 = yaw 减小
        this.player.yaw -= d.dx;
        this.player.pitch = clamp(this.player.pitch - d.dy, -Math.PI / 2 + 0.001, Math.PI / 2 - 0.001);
        if (this.player.yaw > Math.PI) this.player.yaw -= Math.PI * 2;
        if (this.player.yaw < -Math.PI) this.player.yaw += Math.PI * 2;
      }
      const w = this.input.consumeWheel();
      if (w) this.inventory.scroll(w);
      if (this.input.mouseJust.middle) this.interaction.pickBlock(this.hit);
    }

    // ---- 玩家 ----
    if (playing) {
      const wasInWater = this.player.headInWater;
      this.player.update(dt, this._moveInput());
      if (wasInWater !== this.player.headInWater) {
        this.particles.splash(this.player.position[0], this.player.position[1] + 0.2, this.player.position[2], 10);
        bus.emit(EV.SOUND, 'splash', { volume: 0.4 });
      }
    }

    // ---- 相机 ----
    this._updateCamera(dt, playing);

    // ---- 射线拾取 ----
    this.hit = playing || this.state === STATE.INVENTORY
      ? pickBlock(this.world, this.camera, this.player.reach) : null;

    // ---- 交互 ----
    if (playing) this.interaction.update(dt, this.input);

    // ---- 世界与实体 ----
    const budget = settings.get('chunkBudget');
    this.world.update(this.player.position[0], this.player.position[2], budget);
    if (playing) {
      this.entities.update(dt, this.player);
      this.particles.update(dt);
      if (this.world.weather !== 'clear') {
        this.particles.weather(this.player, this.world.weather, dt);
      }
    }
    // 网格构建：积压越多，预算越大（防止移动时出现"透明"窟窿）
    const meshBudget = Math.max(2, Math.min(18, budget * 0.75 +
      this.world.dirtySections.size / 300 * 8));
    this.renderer.buildMeshes(this.world, this.camera, meshBudget);

    // ---- 渲染 ----
    this._render(dt);

    // ---- UI ----
    this.hud.update(dt);
    this.debug.update(dt);
    this.chat.update();
    this._updateOverlays(dt);
    sound.updateMusic(dt, this.world.isNight);

    // ---- 自动存档 ----
    if (settings.get('autoSave') && playing) {
      this.autosaveTimer += dt;
      if (this.autosaveTimer > 30) { this.autosaveTimer = 0; this.save(); }
    }

    this.input.endFrame();
    void now;
  }

  _updateCamera(dt, playing) {
    const p = this.player;
    const cam = this.camera;
    cam.yaw = p.yaw;
    cam.pitch = p.pitch;
    cam.fov = settings.get('fov');
    cam.fovModifier = damp(cam.fovModifier, p.sprinting ? 1.11 : (p.flying ? 1.05 : 1), 6, dt);
    cam.zoomFactor = damp(cam.zoomFactor, this.input.isDown('KeyC') ? 4 : 1, 12, dt);
    cam.bobAmount = settings.get('viewBobbing') && this.perspective === 0 ? p.bobAmount : 0;
    cam.bobPhase = p.bobPhase;
    cam.shake = damp(cam.shake, 0, 6, dt);

    const eyeX = p.position[0], eyeY = p.eyeY, eyeZ = p.position[2];

    if (this.perspective === 0) {
      cam.position[0] = eyeX; cam.position[1] = eyeY; cam.position[2] = eyeZ;
    } else {
      // dir = 相机注视方向（由玩家眼睛指向相机）。1=背后视角(back=+1)相机在玩家身后；
      // 2=正面视角(back=-1)相机在玩家面前，配合下方 yaw+PI/pitch 取反回望玩家。
      const back = this.perspective === 1 ? 1 : -1;
      const dirX = -Math.sin(cam.yaw) * Math.cos(cam.pitch) * back;
      const dirY = Math.sin(cam.pitch) * back;
      const dirZ = -Math.cos(cam.yaw) * Math.cos(cam.pitch) * back;
      let dist = this.thirdDistance;
      const hit = raycastBlocks(this.world, eyeX, eyeY, eyeZ, -dirX, -dirY, -dirZ, dist + 0.4, {});
      if (hit) dist = Math.max(0.6, hit.dist - 0.35);
      cam.position[0] = eyeX - dirX * dist;
      cam.position[1] = eyeY - dirY * dist;
      cam.position[2] = eyeZ - dirZ * dist;
      if (this.perspective === 2) { cam.yaw = p.yaw + Math.PI; cam.pitch = -p.pitch; }
    }

    cam.far = Math.max(160, settings.get('renderDistance') * CHUNK_SIZE * 2.4);
    cam.aspect = this.renderer.glc.aspect;
    cam.update(dt);

    // 水下判定（带迟滞：入水立即生效，出水需眼睛上方已无水体，避免水面浮动导致整屏闪烁）
    const ex = Math.floor(cam.eye[0]), ey = Math.floor(cam.eye[1]), ez = Math.floor(cam.eye[2]);
    const eyeInLiquid = this.world.isLiquid(ex, ey, ez);
    const headStillIn = this.world.isLiquid(ex, Math.floor(cam.eye[1] - 0.35), ez);
    this.underwater = eyeInLiquid || (this.underwater && headStillIn);
    void playing;
  }

  _render(dt) {
    const r = this.renderer;
    const cam = this.camera;
    const world = this.world;
    const biome = world.biomeInfoAt(Math.floor(cam.eye[0]), Math.floor(cam.eye[2]));

    r.render(world, cam, {
      dt, underwater: this.underwater, biomeFog: biome.fog,
    });
    const fog = r._fog;

    // 实体
    this.entityRenderer.stats.entityDraws = 0;
    this.entityRenderer.renderMobs(this.entities.mobs, cam, world, fog);
    if (this.perspective !== 0) {
      this.entityRenderer.renderPlayerModel(this.player, cam, world, fog, this.interaction.swing);
    }
    this.entityRenderer.renderItems(this.entities.items, cam, world, fog);

    // 选择框 + 裂纹
    if (this.hit && this.state === STATE.PLAYING) {
      r.renderSelection(cam, this.hit, this.interaction.breaking ? this.interaction.breakProgress : 0);
    }

    // 粒子
    this.entityRenderer.renderParticles(this.particles, cam, world, fog);

    // 云
    if (settings.get('clouds') && !this.underwater) {
      r.sky.renderClouds(world, cam, settings.get('renderDistance') * CHUNK_SIZE, 1);
    }

    // 半透明（水）
    r.renderTranslucent(world, cam);

    // 手持
    if (this.perspective === 0 && this.state === STATE.PLAYING) {
      const light = world.lightAt(
        Math.floor(cam.eye[0]), Math.floor(cam.eye[1]), Math.floor(cam.eye[2]), world.daylight);
      this.entityRenderer.renderHand(
        cam, this.inventory.selectedItem, this.interaction.swing,
        Math.max(0.45, light), fog, this.interaction.eating);
    }
  }

  _renderTitleBackground(dt) {
    // 标题界面：只清屏（背景由 CSS 负责）
    const glc = this.renderer.glc;
    const t = performance.now() * 0.0002;
    glc.clear(0.05 + Math.sin(t) * 0.02, 0.09, 0.14, 1);
    void dt;
  }

  _updateOverlays(dt) {
    const uw = document.getElementById('fx-underwater');
    uw.style.opacity = this.underwater ? '1' : '0';

    if (this.damageFlash > 0) {
      this.damageFlash = Math.max(0, this.damageFlash - dt * 2.2);
      document.getElementById('fx-damage').style.opacity = String(this.damageFlash * 0.8);
    }
    const lowHealth = this.player && this.player.gamemode === GAMEMODE.SURVIVAL && this.player.health <= 6;
    document.getElementById('fx-vignette').style.opacity = lowHealth ? '0.8' : '0.35';
    document.body.classList.toggle('attacking', this.interaction.swingActive);
  }

  tick(index) {
    if (!this.world || this.state !== STATE.PLAYING) return;
    this.world.tick(index);
    this.renderer.atlas.updateAnimations(50);
  }
}

function frameDelay() {
  return new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
}

export { clamp01, DEG2RAD, lastWorldId };
