// ==== 动效编排：顺序消费游戏事件队列，驱动 DOM 动画 / 音效 / 粒子 ====
import { cardDOM, minionDOM, el } from './cardview.js';
import { sound } from '../audio/sound.js';
import { getCard } from '../data/cards.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

export class Animator {
  constructor(game, renderer, fx) {
    this.game = game;
    this.renderer = renderer;
    this.fx = fx;
    this.busy = false;
  }

  async play(events) {
    this.busy = true;
    for (const ev of events) {
      await this.handle(ev);
    }
    this.renderer.updateAll();
    this.busy = false;
  }

  pulse(node, cls, dur) {
    if (!node) return;
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
    if (dur) setTimeout(() => node.classList.remove(cls), dur);
  }

  async handle(ev) {
    const R = this.renderer;
    const G = this.game;
    switch (ev.t) {
      case 'gameStart':
        sound.play('shuffle');
        await sleep(200);
        break;

      case 'turnStart': {
        R.updateAll();
        if (ev.turnNumber > 1) {
          sound.play('turn', 0.5);
          this.banner(ev.side === 'p1' ? '你的回合' : '敌方回合');
          await sleep(1100);
        }
        break;
      }

      case 'turnEnd':
        break;

      case 'draw': {
        sound.play('draw', 0.5);
        if (ev.side === 'p1') {
          await this.animateDrawP1(ev.cardId);
        } else {
          R.syncEnemyHand();
          await sleep(160);
        }
        R.syncDeck(ev.side);
        break;
      }

      case 'burn': {
        this.toast(`手牌已满，${getCard(ev.cardId).name} 被烧毁了！`);
        const c = R.centerOf(R.deckEls[ev.side]);
        this.fx.burst(c.x, c.y, '#ff7043', 22, 4);
        await sleep(500);
        break;
      }

      case 'fatigue': {
        this.toast(`牌库已空！疲劳伤害 ${ev.amount}`);
        await sleep(500);
        break;
      }

      case 'playCard': {
        if (ev.side === 'p2') {
          // AI 出牌：展示卡面
          sound.play('play', 0.6);
          const show = cardDOM(ev.cardId);
          show.classList.add('played-card-show');
          document.getElementById('overlay-root').appendChild(show);
          R.syncEnemyHand();
          R.syncMana('p2');
          await sleep(1000);
          show.remove();
        } else {
          sound.play('play', 0.6);
          R.syncHand();
          R.syncMana('p1');
        }
        break;
      }

      case 'summon': {
        sound.play('summon', 0.55);
        R.syncBoard(ev.side);
        const node = R.nodes.get(ev.entity.id);
        if (node) {
          this.pulse(node, 'anim-summon', 400);
          const c = R.centerOf(node);
          this.fx.sparkle(c.x, c.y, '#ffe082', 10);
        }
        await sleep(ev.token ? 260 : 340);
        break;
      }

      case 'spellCast': {
        sound.play(getCard(ev.cardId).cost >= 4 ? 'spellBig' : 'spell', 0.65);
        if (ev.targetId != null) {
          const node = R.nodes.get(ev.targetId);
          this.pulse(node, 'anim-spell', 550);
          const c = R.entityCenter(ev.targetId);
          this.fx.burst(c.x, c.y, '#9575cd', 16, 4);
        }
        await sleep(320);
        break;
      }

      case 'heroPower': {
        sound.play('heroPower', 0.6);
        this.toast(ev.powerName, 'rgba(20,40,80,0.9)', '#90caf9');
        R.syncMana(ev.side);
        await sleep(420);
        break;
      }

      case 'attack': {
        const atkNode = R.nodes.get(ev.attackerId);
        const tgtNode = R.nodes.get(ev.targetId);
        if (atkNode && tgtNode) {
          const a = R.centerOf(atkNode);
          const b = R.centerOf(tgtNode);
          atkNode.style.setProperty('--lx', (b.x - a.x) + 'px');
          atkNode.style.setProperty('--ly', (b.y - a.y) + 'px');
          this.pulse(atkNode, 'anim-lunge', 460);
          await sleep(260);
          sound.play('attack', 0.75);
          this.pulse(tgtNode, 'anim-hit', 350);
          const c = R.centerOf(tgtNode);
          this.fx.burst(c.x, c.y, '#ffab40', 20, 5.5);
          await sleep(220);
        }
        break;
      }

      case 'damage': {
        const node = R.nodes.get(ev.id);
        if (node) {
          this.pulse(node, 'anim-flash-red', 450);
          const c = R.centerOf(node);
          this.fx.floatNumber(c.x, c.y, `-${ev.amount}`);
          this.fx.burst(c.x, c.y, '#e53935', 10, 3.5);
          // 同步血量数字
          const entity = G.getEntity(ev.id);
          if (entity) {
            if (entity.kind === 'minion') {
              const span = node.querySelector('.stat.hp span');
              if (span) { span.textContent = ev.hp; span.classList.add('damaged-stat'); }
            } else {
              R.syncHero(entity.side);
            }
          }
        }
        await sleep(ev.spell ? 340 : 240);
        break;
      }

      case 'armorHit': {
        sound.play('armorHit', 0.6);
        const node = R.nodes.get(ev.id);
        if (node) {
          const c = R.centerOf(node);
          this.fx.floatNumber(c.x, c.y - 20, `-${ev.absorbed}`, 'armor-num');
          this.fx.burst(c.x, c.y, '#b0bec5', 10, 3);
        }
        await sleep(160);
        break;
      }

      case 'armor': {
        sound.play('armorHit', 0.5);
        const heroNode = R.nodes.get(ev.id);
        if (heroNode) {
          const c = R.centerOf(heroNode);
          this.fx.floatNumber(c.x, c.y - 10, `+${ev.gained}`, 'armor-num');
          this.fx.sparkle(c.x, c.y, '#cfd8dc', 10);
        }
        for (const s of ['p1', 'p2']) R.syncHero(s);
        await sleep(280);
        break;
      }

      case 'heroAtkBuff': {
        sound.play('spell', 0.6);
        for (const s of ['p1', 'p2']) R.syncHero(s);
        const heroNode = R.nodes.get(ev.id);
        if (heroNode) {
          const c = R.centerOf(heroNode);
          this.fx.sparkle(c.x, c.y, '#ffd54f', 14);
        }
        await sleep(280);
        break;
      }

      case 'shieldPop': {
        sound.play('shieldPop', 0.7);
        const node = R.nodes.get(ev.id);
        if (node) {
          this.pulse(node, 'anim-shield-pop', 500);
          node.classList.remove('divine-shield');
          const c = R.centerOf(node);
          this.fx.sparkle(c.x, c.y, '#ffe082', 20);
        }
        await sleep(320);
        break;
      }

      case 'destroyed': {
        const node = R.nodes.get(ev.id);
        if (node) {
          const c = R.centerOf(node);
          this.fx.burst(c.x, c.y, '#b71c1c', 24, 5);
        }
        await sleep(200);
        break;
      }

      case 'deathrattle': {
        this.toast(`亡语触发：${ev.name}`, 'rgba(40,20,60,0.9)', '#ce93d8');
        await sleep(320);
        break;
      }

      case 'death': {
        sound.play('death', 0.65);
        const node = R.nodes.get(ev.id);
        if (node) {
          const c = R.centerOf(node);
          this.fx.burst(c.x, c.y, '#78909c', 22, 4.5);
          this.pulse(node, 'anim-death');
          await sleep(430);
          node.remove();
          R.nodes.delete(ev.id);
        }
        break;
      }

      case 'transform': {
        sound.play('spell', 0.65);
        const oldNode = R.nodes.get(ev.oldId);
        if (oldNode) {
          const c = R.centerOf(oldNode);
          this.fx.sparkle(c.x, c.y, '#aed581', 22);
          oldNode.remove();
          R.nodes.delete(ev.oldId);
        }
        R.syncBoard(ev.side);
        const newNode = R.nodes.get(ev.entity.id);
        if (newNode) this.pulse(newNode, 'anim-summon', 400);
        await sleep(340);
        break;
      }

      case 'manaUpdate': {
        R.syncMana(ev.side);
        break;
      }

      case 'gameOver':
        await sleep(600);
        break;
    }
  }

  async animateDrawP1(cardId) {
    const from = this.renderer.centerOf(this.renderer.deckEls.p1);
    const card = cardDOM(cardId);
    card.classList.add('draw-fly');
    card.style.left = (from.x - 65) + 'px';
    card.style.top = (from.y - 91) + 'px';
    card.style.transform = 'scale(0.45) rotate(12deg)';
    document.getElementById('overlay-root').appendChild(card);
    void card.offsetWidth;
    const handC = this.renderer.centerOf(this.renderer.handZone);
    card.style.transform = `translate(${handC.x - from.x}px, ${handC.y - 60 - from.y}px) scale(0.9) rotate(0deg)`;
    await sleep(430);
    card.style.opacity = '0';
    await sleep(120);
    card.remove();
    this.renderer.syncHand();
  }

  banner(text) {
    const b = el('div', 'turn-banner anim-banner', document.getElementById('overlay-root'));
    b.textContent = text;
    setTimeout(() => b.remove(), 1550);
  }

  toast(text, bg, color) {
    const t = el('div', 'toast-msg anim-toast', document.getElementById('overlay-root'));
    t.textContent = text;
    if (bg) t.style.background = bg;
    if (color) { t.style.color = color; t.style.borderColor = color; }
    setTimeout(() => t.remove(), 1650);
  }
}
