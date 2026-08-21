/**
 * main.js
 * ------------------------------------------------------------------
 * Entry point: boots the game, drives the loading screen and reports
 * fatal errors in a way the player can act on.
 */

import { Game } from './game/game.js';
import { GLUnsupportedError } from './gfx/gl.js';

const canvas = document.getElementById('game');
const loading = document.getElementById('loading');
const bar = document.getElementById('loading-bar');
const label = document.getElementById('loading-label');
const errorBox = document.getElementById('error');

/** Updates the loading screen. */
function progress(fraction, text) {
  if (bar) bar.style.width = `${Math.round(fraction * 100)}%`;
  if (label && text) label.textContent = text;
}

/** True once init() finished; after that, errors are not fatal. */
let booted = false;

/** Shows a fatal error instead of a black screen. */
function fail(err) {
  console.error(err);
  if (loading) loading.style.display = 'none';
  if (!errorBox) return;
  errorBox.style.display = 'block';
  const hint = err instanceof GLUnsupportedError
    ? 'Your browser or GPU driver did not provide WebGL2.'
    : 'Open the developer console (F12) for the full stack trace.';
  errorBox.innerHTML = `
    <h1>WebCraft 启动失败 / could not start</h1>
    <p class="msg"></p>
    <p class="hint"></p>
    <pre class="stack"></pre>`;
  errorBox.querySelector('.msg').textContent = err?.message ?? String(err);
  errorBox.querySelector('.hint').textContent = hint;
  errorBox.querySelector('.stack').textContent = String(err?.stack ?? '').split('\n').slice(0, 8).join('\n');
}

/**
 * Errors that browsers raise as part of normal operation and which must
 * not be reported as a crash.
 */
const BENIGN = [
  /user gesture is required/i,
  /pointer ?lock/i,
  /play\(\) request was interrupted/i,
  /The operation was aborted/i,
  /AudioContext was not allowed to start/i,
];

const isBenign = (err) => {
  const message = String(err?.message ?? err ?? '');
  return BENIGN.some((re) => re.test(message));
};

/** After boot, report problems without destroying the running game. */
function report(err) {
  if (isBenign(err)) { console.debug('[webcraft] ignored:', err?.message ?? err); return; }
  if (!booted) { fail(err); return; }
  console.error('[webcraft] runtime error:', err);
  globalThis.__webcraft?.chat?.error?.(`Error: ${err?.message ?? err}`);
}

/** Keeps the drawing buffer in step with the window. */
function installResize(game) {
  const apply = () => {
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    game.renderer.resize(true);
  };
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
  apply();
}

async function boot() {
  try {
    const game = new Game(canvas);
    // Exposed for the debug console and the automated render tests.
    globalThis.__webcraft = game;

    await game.init(progress);
    installResize(game);
    booted = true;

    if (loading) {
      loading.classList.add('done');
      setTimeout(() => { loading.style.display = 'none'; }, 350);
    }

    // Save on exit so a refresh never loses progress.
    window.addEventListener('beforeunload', () => {
      if (game.loaded) game.saveWorld();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && game.loaded) game.saveWorld();
    });
  } catch (err) {
    fail(err);
  }
}

window.addEventListener('error', (e) => report(e.error ?? new Error(e.message)));
window.addEventListener('unhandledrejection', (e) => report(e.reason ?? new Error('unhandled rejection')));

boot();
