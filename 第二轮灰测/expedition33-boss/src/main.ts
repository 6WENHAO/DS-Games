import './styles.css';
import { Game } from './app/game';

const container = document.getElementById('app') as HTMLElement;
const canvas = document.getElementById('stage') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;

if (!container || !canvas || !uiRoot) {
  throw new Error('页面结构缺失：需要 #app / #stage / #ui');
}

const game = new Game(container, canvas, uiRoot);
(window as unknown as { __GAME__: Game }).__GAME__ = game;

window.addEventListener('error', (e) => {
  console.error('[未捕获异常]', e.error || e.message);
});
