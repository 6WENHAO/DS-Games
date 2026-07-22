import * as THREE from 'three';
import { Engine } from './core/engine.js';
import { Input } from './core/input.js';
import { AudioManager } from './core/audio.js';
import { Assets } from './core/assets.js';
import { Environment } from './world/environment.js';
import { Terrain } from './world/terrain.js';
import { World, createLayout } from './world/world.js';
import { Effects } from './game/effects.js';
import { Projectiles } from './game/projectiles.js';
import { Battle } from './game/battle.js';
import { PlayerController } from './game/player.js';
import { HUD } from './ui/hud.js';
import { Hangar } from './ui/menu.js';

const $ = (id) => document.getElementById(id);

const canvas = $('game-canvas');
const engine = new Engine(canvas);
const input = new Input(canvas);
const audio = new AudioManager();
const assets = new Assets();

/** 全局上下文（模块间共享） */
const ctx = {
  engine,
  scene: engine.scene,
  camera: engine.camera,
  input,
  audio,
  assets,
  env: null,
  effects: null,
  projectiles: null,
  terrain: null,
  world: null,
  layout: null,
  battle: null,
};

let state = 'loading';
let hangar = null;
let player = null;
let hud = null;
let paused = false;

/* ================= 启动加载 ================= */
async function boot() {
  document.addEventListener('click', () => audio.resume(), { once: true });

  const bar = $('load-bar');
  const status = $('load-status');
  try {
    await assets.loadAll(engine.renderer, audio.ctx, (p, label) => {
      bar.style.width = (p * 100).toFixed(1) + '%';
      status.textContent = `正在加载：${label} (${Math.round(p * 100)}%)`;
    });
  } catch (err) {
    status.textContent = '资源加载失败：' + err.message + '（请使用本地服务器运行，见 README）';
    throw err;
  }
  audio.buffers = assets.audio;

  ctx.env = new Environment(engine.scene, assets);
  ctx.effects = new Effects(engine, assets, null);
  ctx.projectiles = new Projectiles(ctx);
  hangar = new Hangar(ctx);
  hud = new HUD();
  player = new PlayerController(ctx);
  wireUI();

  engine.add({ update: masterUpdate });
  engine.start();

  $('loading-screen').classList.add('hidden');
  enterHangar();
}

/* ================= 主循环 ================= */
function masterUpdate(dt) {
  ctx.effects?.update(dt);
  if (state === 'hangar') {
    hangar.update(dt);
  } else if (state === 'battle') {
    if (!paused) {
      ctx.battle.update(dt);
      player.update(dt);
      hud.update(dt);
      const focus = player.tank ? player.tank.pos : engine.camera.position;
      ctx.env.follow(focus);
    }
  }
}

/* ================= 场景切换 ================= */
function enterHangar() {
  state = 'hangar';
  paused = false;
  input.enabled = false;
  input.unlockPointer();
  hud.hide();
  $('result-screen').classList.add('hidden');
  hangar.enter();
  audio.startWind();
}

function startBattle(tankId) {
  hangar.exit();
  $('loading-screen').classList.remove('hidden');
  $('load-status').textContent = '正在部署战场…';
  $('load-bar').style.width = '100%';

  setTimeout(() => {
    buildWorld();
    ctx.battle = new Battle(ctx, { playerTankId: tankId });
    ctx.battle.cb.playerDestroyed = onPlayerDestroyed;
    ctx.battle.cb.end = onBattleEnd;
    player.attachTank(ctx.battle.playerTank);
    player.enabled = true;
    hud.bind(ctx, ctx.battle, player);
    hud.hideRespawn();

    state = 'battle';
    paused = false;
    input.enabled = true;
    input.lockPointer();
    $('loading-screen').classList.add('hidden');
    hud.centerMsg('夺取并守住 A 点', '消耗敌方票数以取得胜利');
  }, 60);
}

function buildWorld() {
  teardownWorld();
  ctx.layout = createLayout();
  ctx.terrain = new Terrain(assets, ctx.layout);
  engine.scene.add(ctx.terrain.mesh);
  ctx.world = new World(engine.scene, assets, ctx.terrain, ctx.layout);
  ctx.effects.terrain = ctx.terrain;
}

function teardownWorld() {
  if (ctx.battle) {
    ctx.battle.dispose();
    ctx.battle = null;
  }
  if (ctx.terrain) {
    engine.scene.remove(ctx.terrain.mesh);
    ctx.terrain.mesh.geometry.dispose();
    ctx.terrain.mesh.material.dispose();
    ctx.terrain.controlTex?.dispose();
    ctx.terrain = null;
  }
  if (ctx.world) {
    engine.scene.remove(ctx.world.group);
    ctx.world = null;
  }
  ctx.effects?.reset?.();
  ctx.effects && (ctx.effects.terrain = null);
}

/* ================= 战斗事件 ================= */
function onPlayerDestroyed(killer, canRespawn) {
  // 保留 2.4 秒旁观（可环视残骸），随后弹出重生界面
  setTimeout(() => {
    if (state !== 'battle' || ctx.battle.ended) return;
    player.enabled = false;
    input.unlockPointer();
    hud.showRespawn(killer, canRespawn && ctx.battle.playerLives > 0, ctx.battle.playerLives);
  }, 2400);
}

function onBattleEnd(winner, reason, stats) {
  setTimeout(() => {
    if (state !== 'battle') return;
    input.unlockPointer();
    input.enabled = false;
    $('pause-menu').classList.add('hidden');
    hud.hideRespawn();
    showResult(winner, reason, stats);
  }, 1600);
}

function showResult(winner, reason, stats) {
  const win = winner === 'A';
  const title = $('result-title');
  title.textContent = win ? '胜 利' : '战 败';
  title.className = win ? 'win' : 'lose';
  $('result-sub').textContent = reason;
  $('result-stats').innerHTML = `
    <tr><td>击毁敌方载具</td><td>${stats.kills}</td></tr>
    <tr><td>助攻</td><td>${stats.assists}</td></tr>
    <tr><td>造成伤害</td><td>${Math.round(stats.damage)}</td></tr>
    <tr><td>占领据点</td><td>${stats.capture}</td></tr>
    <tr><td>阵亡次数</td><td>${stats.deaths}</td></tr>
    <tr><td>总得分</td><td>${stats.score}</td></tr>`;
  $('result-screen').classList.remove('hidden');
  audio.playUI(win ? 'ui_confirm' : 'ui_click', 0.8, win ? 1 : 0.7);
}

/* ================= UI 事件 ================= */
function wireUI() {
  hangar.onBattle = (tankId) => startBattle(tankId);

  $('btn-back-hangar').addEventListener('click', () => {
    audio.playUI('ui_click', 0.5);
    teardownWorld();
    enterHangar();
  });

  // 键位说明
  const controlsModal = $('controls-modal');
  $('btn-controls').addEventListener('click', () => controlsModal.classList.remove('hidden'));
  $('btn-pause-controls').addEventListener('click', () => controlsModal.classList.remove('hidden'));
  $('btn-close-controls').addEventListener('click', () => controlsModal.classList.add('hidden'));

  // 暂停菜单
  $('btn-resume').addEventListener('click', () => {
    $('pause-menu').classList.add('hidden');
    paused = false;
    input.enabled = true;
    input.lockPointer();
  });
  $('btn-quit').addEventListener('click', () => {
    $('pause-menu').classList.add('hidden');
    paused = false;
    input.enabled = false;
    if (ctx.battle && !ctx.battle.ended) {
      ctx.battle.ended = true;
      showResult('B', '已提前撤离战场', ctx.battle.playerStats);
    }
  });

  // 重生
  $('btn-respawn').addEventListener('click', () => {
    if (!ctx.battle || ctx.battle.ended) return;
    if (ctx.battle.respawnPlayer()) {
      player.attachTank(ctx.battle.playerTank);
      player.enabled = true;
      hud.hideRespawn();
      hud._buildShellList();
      input.lockPointer();
    }
  });
  $('btn-giveup').addEventListener('click', () => {
    hud.hideRespawn();
    if (ctx.battle && !ctx.battle.ended) {
      ctx.battle.ended = true;
      showResult('B', '已放弃战斗', ctx.battle.playerStats);
    }
  });

  // 指针锁定丢失 → 暂停
  input.onPointerLockChange = (locked) => {
    if (state !== 'battle') return;
    if (!locked && !ctx.battle.ended && player.tank?.alive &&
        $('respawn-screen').classList.contains('hidden')) {
      paused = true;
      $('pause-menu').classList.remove('hidden');
    } else if (locked) {
      paused = false;
      $('pause-menu').classList.add('hidden');
    }
  };

  // 战斗按键
  input.onKeyDown = (code) => {
    if (state !== 'battle' || !player.tank) return;
    if (code === 'Digit1') { player.tank.switchShell('AP'); audio.playUI('ui_click', 0.4); }
    else if (code === 'Digit2') { player.tank.switchShell('HE'); audio.playUI('ui_click', 0.4); }
    else if (code === 'ShiftLeft' || code === 'ShiftRight') {
      if (player.tank.alive && !paused) player.toggleScope();
    } else if (code === 'KeyM') {
      $('minimap-wrap').classList.toggle('big');
    }
  };
  input.onMouseDown = (button) => {
    if (state !== 'battle' || paused || !player.tank?.alive) return;
    if (button === 2) player.toggleScope();
  };

  // 战斗中点击画布重新锁定鼠标（指针锁意外丢失时的恢复入口）
  canvas.addEventListener('click', () => {
    if (state === 'battle' && !paused && input.enabled && !input.pointerLocked &&
        ctx.battle && !ctx.battle.ended &&
        $('respawn-screen').classList.contains('hidden')) {
      input.lockPointer();
    }
  });

  // 画质选项
  $('opt-shadows').addEventListener('change', (e) => engine.setShadows(e.target.checked));
  $('opt-hq').addEventListener('change', (e) => {
    engine.hqPixelRatio = e.target.checked;
    engine.updatePixelRatio();
    engine.resize();
  });
  $('opt-volume').addEventListener('input', (e) => audio.setVolume(e.target.value / 100));
}

boot();

// 调试钩子（供自动化测试/控制台调试）
window.__game = ctx;
