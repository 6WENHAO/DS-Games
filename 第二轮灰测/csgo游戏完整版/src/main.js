// ---------------------------------------------------------------------------
// 入口：初始化 -> 主菜单 -> 固定步长主循环
// ---------------------------------------------------------------------------

import { Game } from './game/game.js';

const canvas = document.getElementById('game');
const loading = document.getElementById('loading');
const loadBar = document.getElementById('load-bar');
const loadText = document.getElementById('load-text');

function setProgress(f, t) {
  loadBar.style.width = (f * 100).toFixed(0) + '%';
  if (t) loadText.textContent = t;
}

function fatal(msg, err) {
  console.error(err || msg);
  loading.innerHTML = `<div class="load-box">
    <div class="logo">CS<span>:</span>GO<em>WEB</em></div>
    <div style="margin-top:20px;color:#e05d4a;font-size:15px;line-height:1.8">${msg}</div>
    <div style="margin-top:12px;font-size:12px;color:#8b9aa8">${err ? String(err.message || err) : ''}</div>
  </div>`;
  loading.style.pointerEvents = 'auto';
}

let game = null;
const FIXED = 1 / 120;
const MAX_STEPS = 5;

async function boot() {
  try {
    game = new Game(canvas);
  } catch (e) {
    fatal('无法初始化 WebGL2 渲染器。请使用最新版 Chrome / Edge / Firefox，并确认已启用硬件加速。', e);
    return;
  }
  window.game = game;   // 方便在控制台调试

  try {
    await game.init(setProgress);
  } catch (e) {
    fatal('资源初始化失败。', e);
    return;
  }

  setProgress(1, '就绪');
  await new Promise((r) => setTimeout(r, 220));
  loading.style.transition = 'opacity .45s';
  loading.style.opacity = '0';
  setTimeout(() => loading.classList.add('hidden'), 460);
  game.menus.showMain(true);

  // 首次交互解锁音频
  const unlock = () => {
    game.audio.init();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  let last = performance.now();
  let acc = 0;

  function loop(now) {
    requestAnimationFrame(loop);
    const t0 = now;
    let dt = (now - last) / 1000;
    last = now;
    if (!isFinite(dt) || dt < 0) dt = 0;
    dt = Math.min(dt, 0.25);

    // FPS 统计
    game._fpsAcc += dt;
    game._fpsCount++;
    if (game._fpsAcc >= 0.4) {
      game.fps = game._fpsCount / game._fpsAcc;
      game._fpsAcc = 0;
      game._fpsCount = 0;
    }

    if (game.running && !game.paused) {
      acc += dt;
      let steps = 0;
      while (acc >= FIXED && steps < MAX_STEPS) {
        game.update(FIXED);
        acc -= FIXED;
        steps++;
      }
      if (steps === MAX_STEPS) acc = 0;   // 掉帧太严重时丢弃积压
    } else {
      acc = 0;
      // 暂停时仍然刷新一次 HUD/雷达，保持画面不呆滞
      if (game.running) {
        game.hud.update(0);
        game.input.endFrame();
      }
    }

    if (game.world) {
      game.render(dt);
    }
    game.frameMs = performance.now() - t0;
  }
  requestAnimationFrame(loop);
}

boot();
