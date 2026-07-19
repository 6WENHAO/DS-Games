// ==== 装配：开场画面 → 创建对局 → 玩家/AI 回合循环 → 结算 ====
import { Game } from '../core/game.js';
import { HEROES, DECKS } from '../data/cards.js';
import { Renderer } from './renderer.js';
import { FX } from './fx.js';
import { Animator } from './animator.js';
import { Interactions } from './interactions.js';
import { nextAction, executeAction } from '../ai/opponent.js';
import { sound } from '../audio/sound.js';
import { el } from './cardview.js';
import { showTutorial, tutorialSeen } from './tutorial.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

export function boot() {
  showStartScreen();
}

function showStartScreen() {
  const root = document.getElementById('screen-root');
  root.innerHTML = '';
  const screen = el('div', 'start-screen', root);

  const h1 = el('h1', null, screen);
  h1.textContent = '炉 石 对 决';
  const sub = el('div', 'subtitle', screen);
  sub.textContent = '—— 网页版卡牌对战 Demo · 选择你的英雄 ——';

  const pick = el('div', 'hero-pick', screen);
  for (const key of ['mage', 'warrior']) {
    const h = HEROES[key];
    const card = el('div', 'pick-card', pick);
    const img = el('img', null, card);
    img.src = `assets/cards/raw/${h.icon}.svg`;
    img.style.filter = `drop-shadow(0 0 14px ${h.tint})`;
    el('div', 'pname', card).textContent = h.name;
    el('div', 'pdesc', card).textContent =
      key === 'mage'
        ? '法术自如，烧尽敌人。英雄技能：火焰冲击（造成1点伤害）'
        : '钢铁之躯，横扫战场。英雄技能：全副武装（获得2点护甲）';
    card.addEventListener('click', () => {
      sound.play('click', 0.6);
      root.innerHTML = '';
      startGame(key);
    });
  }

  const howto = el('button', 't-btn howto-btn', screen);
  howto.textContent = '❓ 如何游玩';
  howto.addEventListener('click', () => {
    sound.play('click', 0.6);
    showTutorial();
  });

  const credits = el('div', 'credits', screen);  credits.innerHTML =
    '美术素材：卡牌图标 © <a href="https://game-icons.net" target="_blank">Game-icons.net</a>' +
    '（Lorc, Delapouite, Skoll, Cathelineau, Faithtoken 等作者，CC BY 3.0） · ' +
    '纹理 <a href="https://ambientcg.com" target="_blank">ambientCG</a>（CC0） · ' +
    '音效 <a href="https://kenney.nl" target="_blank">Kenney.nl</a>（CC0）<br>' +
    '本项目为学习用途的同人 Demo，与暴雪娱乐无关。';
}

async function startGame(playerHeroKey) {
  const aiHeroKey = playerHeroKey === 'mage' ? 'warrior' : 'mage';

  const game = new Game(
    { hero: HEROES[playerHeroKey], deck: DECKS[playerHeroKey] },
    { hero: HEROES[aiHeroKey], deck: DECKS[aiHeroKey] },
  );

  const renderer = new Renderer(game);
  const fx = new FX();
  const animator = new Animator(game, renderer, fx);
  sound.preload();

  const refresh = () => {
    renderer.updateAll();
    renderer.highlightActionables();
    renderer.endTurnBtn.disabled = game.over || game.turn !== 'p1' || animator.busy;
    if (game.over) showResult(game);
  };

  const interactions = new Interactions(game, renderer, fx, animator, {
    afterAction: refresh,
    onEndTurn: async () => {
      renderer.clearHighlights();
      renderer.endTurnBtn.disabled = true;
      await animator.play(game.endTurn());
      if (game.over) { refresh(); return; }
      await aiTurn(game, animator);
      refresh();
    },
  });

  // 对局内帮助按钮
  const helpBtn = el('button', 'help-btn', renderer.table);
  helpBtn.textContent = '?';
  helpBtn.title = '查看新手教程';
  helpBtn.addEventListener('click', () => {
    sound.play('click', 0.6);
    showTutorial();
  });

  // 开局
  const startEvents = game.start();
  await animator.play(startEvents);
  animator.banner('对局开始！');
  await sleep(1000);
  refresh();

  // 首次游玩自动弹出教程
  if (!tutorialSeen()) showTutorial();
}

async function aiTurn(game, animator) {
  await sleep(500);
  let guard = 0;
  while (!game.over && game.turn === 'p2' && guard++ < 40) {
    const action = nextAction(game);
    if (!action) break;
    const r = executeAction(game, action);
    if (!r.ok) break;
    await animator.play(r.events);
    await sleep(340);
  }
  if (!game.over && game.turn === 'p2') {
    await animator.play(game.endTurn());
  }
}

function showResult(game) {
  const win = game.winner === 'p1';
  sound.play(win ? 'victory' : 'defeat', 0.7);
  const root = document.getElementById('screen-root');
  root.innerHTML = '';
  const screen = el('div', 'result-screen', root);
  const title = el('div', `title ${win ? 'win' : 'lose'}`, screen);
  title.textContent = win ? '胜 利 ！' : '战 败';
  const btn = el('button', null, screen);
  btn.textContent = '再来一局';
  btn.addEventListener('click', () => {
    sound.play('click', 0.6);
    location.reload();
  });
}
