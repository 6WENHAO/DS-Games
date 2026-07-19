import { loadAllAssets, Assets } from './core/assets.js';
import { UI } from './ui/ui.js';
import { Game } from './game.js';

// 入口：加载资源 -> 标题界面 -> 开始游戏
const canvas = document.getElementById('game-canvas');
const ui = new UI(document);

const btnNew = document.getElementById('btn-new-game');
const btnContinue = document.getElementById('btn-continue');

btnNew.disabled = true;

Assets.onProgress = (done, total) => {
  ui.loadStatus.textContent = `正在加载资源… ${done}/${total}`;
};

loadAllAssets().then(() => {
  ui.loadStatus.textContent = '加载完成';
  btnNew.disabled = false;
  if (Game.hasSave()) btnContinue.disabled = false;

  let game = null;
  const getGame = () => {
    if (!game) {
      game = new Game(canvas, ui);
      window.__game = game; // 调试用
    }
    return game;
  };

  btnNew.addEventListener('click', () => getGame().newGame());
  btnContinue.addEventListener('click', () => getGame().continueGame());
}).catch((e) => {
  ui.loadStatus.textContent = `资源加载失败：${e.message}`;
  console.error(e);
});
