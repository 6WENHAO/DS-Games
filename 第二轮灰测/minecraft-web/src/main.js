/* =====================================================================
 * main.js — 入口：创建游戏、错误兜底、URL 参数（自动开始 / 自检）
 *
 * URL 参数:
 *   ?autostart=1        跳过标题画面直接进入世界
 *   ?seed=xxx           指定种子
 *   ?type=flat          世界类型
 *   ?mode=survival      游戏模式
 *   ?rd=6               渲染距离
 *   ?nolock=1           不请求指针锁定（截图/自动化用）
 * ===================================================================== */
import { Game } from './core/Game.js';
import settings from './core/Settings.js';
import { bus, EV } from './core/EventBus.js';
import { armDiagnostics } from './game/Diagnostics.js';

const params = new URLSearchParams(location.search);

function fatal(title, detail) {
  const div = document.createElement('div');
  div.className = 'screen';
  div.innerHTML = `<div class="dialog"><h2>${title}</h2>
    <p style="font-size:12px;line-height:1.7;max-width:520px">${detail}</p></div>`;
  document.body.appendChild(div);
}

function boot() {
  const canvas = document.getElementById('glcanvas');

  let game;
  try {
    game = new Game(canvas);
  } catch (err) {
    console.error(err);
    if (String(err.message).includes('WEBGL2_UNSUPPORTED')) {
      fatal('你的浏览器不支持 WebGL2', `
        MineWeb 需要 WebGL2 才能运行。<br><br>
        请使用最新版 Chrome / Edge / Firefox，并在浏览器设置中启用硬件加速。<br>
        如果你在虚拟机中运行，请尝试启动参数 <code>--enable-unsafe-swiftshader</code>。`);
    } else {
      fatal('启动失败', String(err.message || err) + '<br><br>请打开控制台查看详细堆栈。');
    }
    return;
  }

  window.game = game;   // 方便在控制台调试

  // ---------- URL 参数 ----------
  if (params.has('rd')) {
    const rd = parseInt(params.get('rd'), 10);
    if (Number.isFinite(rd)) settings.set('renderDistance', Math.max(2, Math.min(16, rd)));
  }
  if (params.get('nolock') === '1') {
    game.input.requestLock = () => {};
  }
  if (params.get('sound') === '0') settings.set('sound', false);

  if (params.get('autostart') === '1' || params.has('seed')) {
    const seed = params.get('seed') || String(Math.floor(Math.random() * 1e9));
    const type = params.get('type') || 'default';
    const mode = params.get('mode') || 'creative';
    game.newWorld({ name: params.get('name') || '演示世界', seed, type, mode, structures: true });
  }

  // ---------- 自动化诊断（无人值守验证渲染） ----------
  if (params.has('diag')) {
    const secs = parseFloat(params.get('diag')) || 8;
    armDiagnostics(game, secs);
    console.log('[MineWeb] 诊断模式已启用，将在 ' + secs + ' 秒后输出报告');
  }

  // ---------- 全局错误提示 ----------
  window.addEventListener('error', (e) => {
    console.error('[MineWeb] 未捕获错误', e.error || e.message);
    bus.emit(EV.CHAT, '错误: ' + (e.message || '未知'), 'err');
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.error('[MineWeb] Promise 异常', e.reason);
  });

  // ---------- 离开前保存 ----------
  window.addEventListener('beforeunload', () => {
    if (game.world && settings.get('autoSave')) game.save();
  });

  console.log('%c MineWeb ', 'background:#5d9c3c;color:#fff;font-weight:bold',
    '网页版我的世界已启动 · 在控制台使用 window.game 调试');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
