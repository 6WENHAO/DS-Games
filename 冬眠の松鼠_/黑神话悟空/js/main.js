import * as THREE from 'three';
import { CONFIG } from './config.js';
import { assets } from './core/assets.js';
import { audio } from './core/audio.js';
import { Input } from './core/input.js';
import { World } from './world/world.js';
import { Player } from './entities/player.js';
import { Enemy } from './entities/enemy.js';
import { Boss } from './entities/boss.js';
import { PlayerClone } from './entities/clone.js';
import { Combat } from './combat/combat.js';
import { Effects } from './combat/effects.js';
import { ThirdPersonCamera } from './combat/camera.js';
import { HUD } from './ui/hud.js';
import { Screens } from './ui/screens.js';
import { MANIFEST } from './core/assets.js';
import { rand, clamp } from './core/utils.js';

const $ = (id) => document.getElementById(id);

class Game {
  constructor() {
    this.state = 'loading'; // loading | title | playing | paused | dead | victory
    this.canvas = $('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.88;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, window.innerWidth / window.innerHeight, 0.1, 600);
    this.clock = new THREE.Clock();

    this.input = new Input(this.canvas);
    this.screens = new Screens();
    this.stats = { deaths: 0, startTime: 0 };

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    const unlockAudio = () => audio.unlock();
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    this.debugShot = new URLSearchParams(location.search).has('shot');
  }

  async load() {
    this.screens.setProgress(0.02, '正在入梦……');
    const skipAudio = new URLSearchParams(location.search).has('noaudio');
    await assets.loadAll((k) => {
      const stage = k < 0.5 ? '召唤山灵……' : k < 0.85 ? '搬运白骨……' : '点起长明灯……';
      this.screens.setProgress(k, stage);
    }, { skipAudio });
    this.screens.setProgress(1, '梦已成形');

    this.buildWorld();
    this.screens.hideLoading();

    if (this.debugShot) {
      this.startRun();
    } else {
      this.state = 'title';
      this.screens.showTitle();
      audio.music(MANIFEST.music.ambient, { volume: 0.22 });
    }
    this.bindUI();
    this.loop();
  }

  buildWorld() {
    this.world = new World(this.scene, this.renderer);
    this.world.build();

    this.effects = new Effects(this.scene);
    for (const f of this.world.flames) this.effects.addFlame(f, 1);

    this.combat = new Combat(this.scene, this.world, this.effects);
    this.player = new Player(this.world, this.effects, this.combat);
    this.combat.player = this.player;
    this.scene.add(this.player.group);

    this.tpCamera = new ThirdPersonCamera(this.camera, this.world);
    this.hud = new HUD(this.combat);

    this.boss = new Boss(this.world, this.effects, this.combat);
    this.combat.boss = this.boss;
    this.scene.add(this.boss.group);

    this.spawnEnemies();
    this.bindCombatEvents();
  }

  spawnEnemies() {
    this.combat.enemies.forEach((e) => this.scene.remove(e.group));
    this.combat.enemies.length = 0;

    const spots = [
      ['minion', 4, 52, true], ['minion', -7, 47, true], ['rogue', 10, 40, true],
      ['minion', -12, 30, true], ['warrior', -2, 24, true], ['mage', 12, 22, false],
      ['rogue', -10, 8, true], ['minion', 6, 2, true], ['minion', -4, -2, true],
      ['warrior', 10, -14, true], ['mage', -13, -18, false], ['rogue', 4, -24, true],
      ['minion', -6, -34, true], ['minion', 8, -38, true], ['warrior', -2, -44, true],
      // side pockets near grave clusters
      ['rogue', 26, 14, true], ['minion', 30, 10, true],
      ['mage', -28, -6, false], ['minion', -32, -2, true],
    ];
    for (const [type, x, z, buried] of spots) {
      const e = new Enemy(type, x + rand(-1.5, 1.5), z + rand(-1.5, 1.5), this.world, this.effects, this.combat, { buried });
      this.combat.enemies.push(e);
      this.scene.add(e.group);
    }
  }

  bindCombatEvents() {
    this.combat.on('playerDeath', () => {
      this.stats.deaths++;
      setTimeout(() => {
        if (this.state !== 'playing') return;
        this.state = 'dead';
        this.input.releaseLock();
        this.screens.showDeath();
        audio.music(MANIFEST.music.ambient, { volume: 0.16 });
      }, 1600);
    });

    this.combat.on('playerHurt', (amount) => this.hud.playerDamageNumber(Math.round(amount)));

    this.combat.on('bossDefeated', () => {
      this.hud.hideBossBar();
      setTimeout(() => {
        if (this.state !== 'playing') return;
        this.state = 'victory';
        this.input.releaseLock();
        const t = Math.round((performance.now() - this.stats.startTime) / 1000);
        const mm = String(Math.floor(t / 60)).padStart(2, '0');
        const ss = String(t % 60).padStart(2, '0');
        this.screens.showVictory(`用时 ${mm}:${ss} · 陨落 ${this.stats.deaths} 次 · 灵蕴 ${this.player.souls}`);
        audio.music(MANIFEST.music.ambient, { volume: 0.22 });
      }, 2400);
    });

    this.combat.on('summon', (pos, count) => {
      for (let i = 0; i < count; i++) {
        const a = rand(0, Math.PI * 2);
        const x = pos.x + Math.cos(a) * rand(2.5, 4.5);
        const z = pos.z + Math.sin(a) * rand(2.5, 4.5);
        const solved = this.world.clampToArena(x, z, 2);
        const e = new Enemy('minion', solved.x, solved.z, this.world, this.effects, this.combat, { buried: true });
        this.combat.enemies.push(e);
        this.scene.add(e.group);
      }
    });

    this.combat.on('announce', (text) => this.screens.announce(text));

    this.combat.on('clones', () => {
      const count = CONFIG.player.clone.count;
      for (let i = 0; i < count; i++) {
        const a = this.player.yaw + Math.PI / 2 + (i / Math.max(count - 1, 1)) * Math.PI - Math.PI / 2;
        const c = new PlayerClone(this.player, this.world, this.effects, this.combat, a);
        this.combat.clones.push(c);
        this.scene.add(c.group);
      }
    });
  }

  clearClones() {
    for (const c of this.combat.clones) this.scene.remove(c.group);
    this.combat.clones.length = 0;
  }

  abortQuake() {
    if (this.combat.earthBurial && this.combat.earthBurial.active) {
      this.combat.earthBurial.cleanup();
    }
    if (this.combat.blackHole && this.combat.blackHole.active) {
      this.combat.blackHole.cleanup();
    }
  }

  bindUI() {
    $('btn-start').addEventListener('click', () => {
      audio.play('uiConfirm', { volume: 0.6 });
      this.startRun();
    });
    $('btn-respawn').addEventListener('click', () => {
      audio.play('uiConfirm', { volume: 0.6 });
      this.respawn();
    });
    $('btn-again').addEventListener('click', () => {
      audio.play('uiConfirm', { volume: 0.6 });
      this.screens.hideVictory();
      this.resetRun();
      this.startRun(true);
    });
    $('btn-resume').addEventListener('click', () => this.togglePause(false));
    $('btn-pause-title').addEventListener('click', () => {
      this.togglePause(false);
      this.state = 'title';
      this.input.releaseLock();
      this.screens.showTitle();
      this.hud.hide();
      audio.music(MANIFEST.music.ambient, { volume: 0.22 });
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        if (this.state === 'playing') this.togglePause(true);
        else if (this.state === 'paused') this.togglePause(false);
      }
    });
  }

  startRun(skipBanner = false) {
    this.screens.hideTitle();
    this.state = 'playing';
    this.stats.startTime = performance.now();
    this.hud.show();
    this.input.enabled = true;
    this.input.requestLock();
    if (!skipBanner) this.screens.chapterBanner();
    audio.music(MANIFEST.music.ambient, { volume: CONFIG.audio.musicVolume });
  }

  resetRun() {
    // full reset: player, enemies, boss
    this.player.respawn();
    this.player.souls = 0;
    this.stats.deaths = 0;
    this.clearClones();
    this.abortQuake();
    this.spawnEnemies();
    this.resetBoss();
  }

  resetBoss() {
    this.scene.remove(this.boss.group);
    this.boss = new Boss(this.world, this.effects, this.combat);
    this.combat.boss = this.boss;
    this.combat.bossActive = false;
    this.scene.add(this.boss.group);
    this.hud.hideBossBar();
  }

  respawn() {
    this.screens.hideDeath();
    this.player.respawn();
    this.clearClones();
    this.abortQuake();
    // revive road enemies & reset boss if it wasn't slain
    this.spawnEnemies();
    if (this.boss.state !== 'dead') this.resetBoss();
    this.combat.lockTarget = null;
    this.state = 'playing';
    this.input.requestLock();
    audio.music(MANIFEST.music.ambient, { volume: CONFIG.audio.musicVolume });
  }

  togglePause(on) {
    if (on && this.state === 'playing') {
      this.state = 'paused';
      this.screens.showPause();
      this.input.releaseLock();
      audio.play('uiClick', { volume: 0.5 });
    } else if (!on && this.state === 'paused') {
      this.state = 'playing';
      this.screens.hidePause();
      this.input.requestLock();
      audio.play('uiBack', { volume: 0.5 });
    }
  }

  checkBossTrigger() {
    if (this.combat.bossActive || this.boss.state !== 'dormant') return;
    const d = Math.hypot(
      this.player.position.x - CONFIG.arena.x,
      this.player.position.z - CONFIG.arena.z
    );
    if (d < CONFIG.arena.radius - 3) {
      this.combat.bossActive = true;
      this.boss.awaken();
      this.hud.showBossBar(CONFIG.boss.name);
      this.screens.announce('妖气冲天，白骨夫人现身！');
      audio.music(MANIFEST.music.boss, { volume: CONFIG.audio.musicVolume + 0.08 });
    }
  }

  update(dt) {
    const timeScale = this.combat.hitstop > 0 ? 0.06 : 1;
    const sdt = dt * timeScale;

    if (this.state === 'playing') {
      this.tpCamera.applyInput(this.input);

      if (this.input.wasPressed('Tab') || this.input.wasPressed('MMB')) {
        this.combat.toggleLock(this.tpCamera);
      }

      this.player.update(sdt, this.input, this.tpCamera, this.combat.targets);
      this.checkBossTrigger();

      for (let i = this.combat.enemies.length - 1; i >= 0; i--) {
        const e = this.combat.enemies[i];
        const remove = e.update(sdt, this.player);
        if (remove) {
          this.scene.remove(e.group);
          this.combat.enemies.splice(i, 1);
        } else if (e.alive && e.hpSprite.visible) {
          e.hpSprite.visible = e.hp < e.maxHp;
        }
      }

      for (let i = this.combat.clones.length - 1; i >= 0; i--) {
        const c = this.combat.clones[i];
        if (c.update(sdt)) {
          this.scene.remove(c.group);
          this.combat.clones.splice(i, 1);
        }
      }

      if (this.boss.state !== 'dead') this.boss.update(sdt, this.player);
      this.combat.update(sdt);
    }

    this.world.update(sdt, this.player.position);
    this.effects.update(sdt, this.camera);
    this.tpCamera.update(dt, this.player, this.combat.lockTarget, this.combat.trauma);
    this.hud.update(dt, this.player, this.combat.bossActive || this.boss.state === 'dying' ? this.boss : null, this.camera);
  }

  loop() {
    requestAnimationFrame(() => this.loop());
    const dt = clamp(this.clock.getDelta(), 0, 0.05);
    if (this.state === 'playing' || this.state === 'dead' || this.state === 'victory' || this.state === 'title') {
      this.update(this.state === 'playing' ? dt : dt * (this.state === 'title' ? 0 : 0.4));
    }
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
    if (this.debugShot && !window.__shotReady) {
      window.__shotReady = true;
      document.title = 'SHOT_READY';
    }
  }
}

const game = new Game();
game.load().catch((err) => {
  console.error(err);
  window.__errors?.push('load: ' + err.message);
  const el = document.getElementById('err-log');
  if (el) { el.style.display = 'block'; el.textContent += '\nLOAD FAIL: ' + err.message + '\n' + err.stack; }
});
window.__game = game;
