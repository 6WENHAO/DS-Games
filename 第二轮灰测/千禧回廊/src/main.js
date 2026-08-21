// ============================================================================
//  main.js —— 入口：装字体渲染器 → 建游戏 → 绑输入 → 跑循环
// ============================================================================

import { installGlyphRenderer } from './gfx/glyph.js';
import { clearTextureCache } from './gfx/textures.js';
import { Game } from './game/game.js';
import { Hud } from './game/hud.js';
import * as A from './game/audio.js';

// 必须在任何材质生成之前装好汉字渲染器（横幅/小广告/门牌上的字靠它）
installGlyphRenderer();
clearTextureCache();

const canvas = document.getElementById('view');
const hud = new Hud();
const game = new Game(canvas, hud);
game.loadZone('stair');
game.render();

// ---------------------------------------------------------------- 输入
const HOLD = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'KeyC',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
]);

function start() {
  if (!game.paused) return;
  A.init();
  A.resume();
  hud.hideTitle();
  game.paused = false;
  game.fadeDir = -1;
  A.setZone(game.zoneId, 2.4);
  canvas.requestPointerLock?.();
}

document.getElementById('title').addEventListener('click', start);

window.addEventListener('keydown', (e) => {
  if (game.paused && (e.code === 'Enter' || e.code === 'Space')) { start(); e.preventDefault(); return; }
  if (HOLD.has(e.code)) { game.keys.add(e.code); e.preventDefault(); }
  if (e.code === 'KeyE') game.interact();
  if (e.code === 'Tab') { hud.toggleLog(); e.preventDefault(); }
  if (e.code === 'KeyM') A.toggleMute();
  if (e.code === 'KeyR' && game.ended) location.reload();
  if (e.code === 'Escape') document.exitPointerLock?.();
});

window.addEventListener('keyup', (e) => { game.keys.delete(e.code); });
window.addEventListener('blur', () => game.keys.clear());

canvas.addEventListener('click', () => {
  if (game.paused) start();
  else if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
});

document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas) {
    game.mouseDX += e.movementX;
    game.mouseDY += e.movementY;
  }
});

// 触屏兜底：左半屏拖动转头，右半屏点一下 = 前进/交互
let touchId = null, lastTX = 0, lastTY = 0;
canvas.addEventListener('touchstart', (e) => {
  if (game.paused) { start(); return; }
  const t = e.changedTouches[0];
  if (t.clientX < window.innerWidth / 2) { touchId = t.identifier; lastTX = t.clientX; lastTY = t.clientY; }
  else game.keys.add('KeyW');
  e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === touchId) {
      game.mouseDX += (t.clientX - lastTX) * 1.6;
      game.mouseDY += (t.clientY - lastTY) * 1.2;
      lastTX = t.clientX; lastTY = t.clientY;
    }
  }
  e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchend', (e) => {
  touchId = null;
  game.keys.delete('KeyW');
  if (game.prompt) game.interact();
}, { passive: false });

// ---------------------------------------------------------------- 主循环
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  game.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 方便调试
window.__QX = { game, hud, A };
