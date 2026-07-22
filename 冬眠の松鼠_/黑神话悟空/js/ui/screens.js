import { audio } from '../core/audio.js';

const $ = (id) => document.getElementById(id);

const TIPS = [
  '诀窍：翻滚有无敌之机，莫要贪棍。',
  '轻棍连击积攒棍势，重棍一击倾泻之。',
  '定身术可救急，但妖王体魄强横，禁不了太久。',
  '体力耗尽则无法翻滚，且战且退方为上策。',
  '葫芦中的甘露有限，饮时须寻空隙。',
  '白骨岭的骷髅会破土而出，小心脚下。',
];

export class Screens {
  constructor() {
    this.el = {
      loading: $('loading-screen'),
      loadingBar: $('loading-bar'),
      loadingText: $('loading-text'),
      loadingTip: $('loading-tip'),
      title: $('title-screen'),
      chapter: $('chapter-banner'),
      death: $('overlay-death'),
      victory: $('overlay-victory'),
      victoryStats: $('victory-stats'),
      pause: $('pause-menu'),
    };
    this.el.loadingTip.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
    this.tipTimer = setInterval(() => {
      this.el.loadingTip.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
    }, 3600);

    // panels on title screen
    document.querySelectorAll('.panel-close').forEach((btn) => {
      btn.addEventListener('click', () => {
        $(btn.dataset.close).classList.add('hidden');
        audio.play('uiBack', { volume: 0.5 });
      });
    });
    $('btn-howto').addEventListener('click', () => {
      $('howto-panel').classList.remove('hidden');
      audio.play('uiClick', { volume: 0.5 });
    });
    $('btn-credits').addEventListener('click', () => {
      $('credits-panel').classList.remove('hidden');
      audio.play('uiClick', { volume: 0.5 });
    });
  }

  setProgress(k, text) {
    this.el.loadingBar.style.width = `${Math.round(k * 100)}%`;
    if (text) this.el.loadingText.textContent = text;
  }

  hideLoading() {
    clearInterval(this.tipTimer);
    this.el.loading.classList.add('fade');
    setTimeout(() => this.el.loading.classList.add('hidden'), 900);
  }

  showTitle() { this.el.title.classList.remove('hidden'); }
  hideTitle() { this.el.title.classList.add('hidden'); }

  chapterBanner() {
    this.el.chapter.classList.remove('hidden');
    setTimeout(() => this.el.chapter.classList.add('hidden'), 4700);
  }

  showDeath() { this.el.death.classList.remove('hidden'); }
  hideDeath() { this.el.death.classList.add('hidden'); }

  showVictory(stats) {
    this.el.victoryStats.textContent = stats;
    this.el.victory.classList.remove('hidden');
  }
  hideVictory() { this.el.victory.classList.add('hidden'); }

  showPause() { this.el.pause.classList.remove('hidden'); }
  hidePause() { this.el.pause.classList.add('hidden'); }

  announce(text) {
    const div = document.createElement('div');
    div.style.cssText = `position:fixed;top:20%;left:50%;transform:translateX(-50%);z-index:45;
      font-size:26px;letter-spacing:0.3em;color:#e8dfc8;text-shadow:0 0 18px rgba(212,175,55,0.6),0 2px 8px #000;
      pointer-events:none;opacity:0;transition:opacity 0.5s ease;font-family:inherit;white-space:nowrap;`;
    div.textContent = text;
    document.body.appendChild(div);
    requestAnimationFrame(() => { div.style.opacity = '1'; });
    setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 600); }, 2600);
  }
}
