// ==== 新手教程 ====
import { el, cardDOM, minionDOM } from './cardview.js';
import { sound } from '../audio/sound.js';

const SEEN_KEY = 'stone_tutorial_seen';

export function tutorialSeen() {
  try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return true; }
}

export function markTutorialSeen() {
  try { localStorage.setItem(SEEN_KEY, '1'); } catch {}
}

function fakeMinion(over) {
  return Object.assign({
    id: 0, kind: 'minion', side: 'p1', cardId: null,
    name: '', icon: 'grizzly', tint: '#6d4c41',
    atk: 3, hp: 3, maxHp: 3,
    taunt: false, charge: false, divineShield: false, sleeping: false,
  }, over);
}

const PAGES = [
  {
    title: '欢迎来到炉石对决！',
    demo() {
      const box = el('div');
      const row = el('div', 'crystal-row', box);
      for (let i = 0; i < 5; i++) {
        const img = el('img', null, row);
        img.src = 'assets/frames/gem_mana.svg';
        if (i >= 3) img.style.filter = 'grayscale(1) brightness(0.45)';
      }
      el('div', 'demo-note', box).textContent = '法力水晶：3/5';
      return box;
    },
    html: '你的目标：将<b>敌方英雄的生命值降为 0</b>。<br>' +
      '出牌需要消耗<b>法力水晶</b>（屏幕右下角）。<br>' +
      '每回合开始时法力全部恢复，且上限 <b>+1</b>（最多 10 颗），' +
      '所以越到后期，能打出的牌越强。',
  },
  {
    title: '如何出牌',
    demo() {
      const box = el('div');
      const c = cardDOM('yeti');
      c.classList.add('playable');
      c.style.transform = 'scale(0.92)';
      box.appendChild(c);
      el('div', 'demo-note', box).textContent = '绿光 = 本回合可打出';
      return box;
    },
    html: '手牌中<b>泛绿光</b>的牌当前可以打出。<br>' +
      '<b>随从牌</b>：按住并<b>拖到战场</b>你的半场即可召唤。<br>' +
      '<b>法术牌</b>：拖到<b>目标</b>身上（无目标法术拖到战场任意处）。<br>' +
      '按 <b>右键 / ESC</b> 可以取消操作。',
  },
  {
    title: '随从与攻击',
    demo() {
      const box = el('div');
      const row = el('div', null, box);
      row.style.cssText = 'display:flex;align-items:center;gap:10px;';
      const a = minionDOM(fakeMinion({ icon: 'raptor', tint: '#e53935', atk: 3, hp: 2, maxHp: 2 }));
      a.classList.add('can-attack');
      const arrow = el('div', 'demo-arrow', row);
      row.insertBefore(a, arrow);
      arrow.textContent = '➤';
      const b = minionDOM(fakeMinion({ icon: 'murloc', tint: '#26a69a', atk: 2, hp: 1, maxHp: 1 }));
      row.appendChild(b);
      el('div', 'demo-note', box).textContent = '拖拽发光随从 → 指向目标';
      return box;
    },
    html: '轮到你时，<b>泛绿光的随从</b>可以攻击：<b>按住它拖向</b>敌方随从或英雄。<br>' +
      '攻击时双方会<b>互相造成伤害</b>（攻击力↔生命值）。<br>' +
      '刚召唤的随从有<b>召唤失调</b>（Zzz），要等一回合才能攻击。',
  },
  {
    title: '关键词能力',
    demo() {
      const box = el('div');
      const row = el('div', null, box);
      row.style.cssText = 'display:flex;align-items:center;gap:14px;';
      const t = minionDOM(fakeMinion({ icon: 'frostwolf', tint: '#90a4ae', atk: 2, hp: 2, maxHp: 2, taunt: true }));
      row.appendChild(t);
      const d = minionDOM(fakeMinion({ icon: 'argent_squire', tint: '#e0e0e0', atk: 1, hp: 1, maxHp: 1, divineShield: true }));
      row.appendChild(d);
      el('div', 'demo-note', box).textContent = '左：嘲讽 · 右：圣盾';
      return box;
    },
    html: '<span class="kw">嘲讽</span>：敌方必须先攻击它（石框标识）。<br>' +
      '<span class="kw">冲锋</span>：上场当回合就能攻击。<br>' +
      '<span class="kw">圣盾</span>：抵挡一次伤害（金光泡泡）。<br>' +
      '<span class="kw">战吼</span>：打出时触发效果；<span class="kw">亡语</span>：死亡时触发效果。',
  },
  {
    title: '英雄技能与回合',
    demo() {
      const box = el('div');
      const wrap = el('div', null, box);
      wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:14px;';
      const ring = el('div', null, wrap);
      ring.style.cssText = 'position:relative;width:80px;height:80px;';
      const r1 = el('img', null, ring);
      r1.src = 'assets/frames/power_ring.svg';
      r1.style.cssText = 'width:100%;height:100%;';
      const r2 = el('img', null, ring);
      r2.src = 'assets/cards/raw/hp_fireblast.svg';
      r2.style.cssText = 'position:absolute;inset:20px;width:40px;height:40px;';
      el('div', 'end-turn-demo', wrap).textContent = '结束回合';
      return box;
    },
    html: '<b>英雄技能</b>：点击你头像旁的圆形按钮（消耗2费，每回合一次）。<br>' +
      '法师：造成1点伤害；战士：获得2点护甲。<br>' +
      '做完所有操作后，点击右侧的<b>结束回合</b>按钮。<br>' +
      '随时点击左下角 <b>?</b> 可重新打开本教程。祝你好运！',
  },
];

export function showTutorial(onClose) {
  const root = document.getElementById('screen-root');
  const overlay = el('div', 'tutorial-overlay', root);
  const panel = el('div', 'tutorial-panel', overlay);
  let page = 0;

  function render() {
    panel.innerHTML = '';
    const p = PAGES[page];
    el('h2', null, panel).textContent = p.title;
    el('div', 'tutorial-step-label', panel).textContent = `新手教程 ${page + 1} / ${PAGES.length}`;

    const body = el('div', 'tutorial-body', panel);
    const demo = el('div', 'tutorial-demo', body);
    demo.appendChild(p.demo());
    const text = el('div', 'tutorial-text', body);
    text.innerHTML = p.html;

    const nav = el('div', 'tutorial-nav', panel);
    const left = el('div', null, nav);
    const skip = el('button', 't-btn ghost', left);
    skip.textContent = '跳过教程';
    skip.addEventListener('click', close);

    const dots = el('div', 'tutorial-dots', nav);
    PAGES.forEach((_, i) => {
      const d = el('i', i === page ? 'on' : '', dots);
      if (i === page) d.classList.add('on');
    });

    const right = el('div', null, nav);
    right.style.cssText = 'display:flex;gap:10px;';
    const prev = el('button', 't-btn ghost', right);
    prev.textContent = '上一页';
    prev.disabled = page === 0;
    prev.addEventListener('click', () => { sound.play('click', 0.5); page--; render(); });
    const next = el('button', 't-btn', right);
    next.textContent = page === PAGES.length - 1 ? '开始游戏！' : '下一页';
    next.addEventListener('click', () => {
      sound.play('click', 0.5);
      if (page === PAGES.length - 1) close();
      else { page++; render(); }
    });
  }

  function close() {
    markTutorialSeen();
    overlay.remove();
    if (onClose) onClose();
  }

  render();
  return overlay;
}
