// ============================================================================
//  hud.js —— DOM 外壳：字幕 / 提示 / 记忆手册 / 淡入淡出 / 标题 / 结局
// ============================================================================

import { LINES } from './script.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.elZone = $('zone');
    this.elMem = $('mem');
    this.elItem = $('item');
    this.elPrompt = $('prompt');
    this.elSub = $('sub');
    this.elFade = $('fade');
    this.elBlink = $('blink');
    this.elTitle = $('title');
    this.elLog = $('log');
    this.elLogList = $('logList');
    this.elEnd = $('end');
    this._prompt = '';
    this._sub = '';
    this.memories = [];
    this.needed = 5;
    this.setMemories([], 5);
  }

  setZoneName(n) { this.elZone.textContent = n || ''; }

  setMemories(list, needed) {
    this.memories = list;
    this.needed = needed;
    this.elMem.textContent = `记忆 ${list.length} / ${needed}`;
  }

  flashMemory() {
    this.elMem.classList.remove('flash');
    void this.elMem.offsetWidth;
    this.elMem.classList.add('flash');
  }

  flashItem(name) {
    const label = { key: '拿到了一把钥匙' }[name] || `拿到了 ${name}`;
    this.elItem.textContent = label;
    this.elItem.style.opacity = '1';
    clearTimeout(this._itemT);
    this._itemT = setTimeout(() => { this.elItem.style.opacity = '0'; }, 2200);
  }

  setPrompt(label) {
    if (label === this._prompt) return;
    this._prompt = label;
    if (label) {
      this.elPrompt.innerHTML = `<b>E</b>${label}`;
      this.elPrompt.style.opacity = '1';
    } else {
      this.elPrompt.style.opacity = '0';
    }
  }

  setSubtitle(text) {
    if (text === this._sub) return;
    this._sub = text;
    this.elSub.textContent = text;
    this.elSub.style.opacity = text ? '1' : '0';
  }

  setFade(v) { this.elFade.style.opacity = String(v); }

  /** 传送的一瞬间：一下白光（声控灯的错觉） */
  blink() {
    this.elBlink.style.transition = 'none';
    this.elBlink.style.opacity = '0.5';
    requestAnimationFrame(() => {
      this.elBlink.style.transition = 'opacity .55s ease-out';
      this.elBlink.style.opacity = '0';
    });
  }

  hideTitle() { this.elTitle.style.display = 'none'; }

  toggleLog() {
    const open = this.elLog.classList.toggle('open');
    if (open) this.renderLog();
    return open;
  }
  logOpen() { return this.elLog.classList.contains('open'); }

  renderLog() {
    const names = {
      calendar: '挂历', cabinet: '黄柜子', mirror: '镜子', mahjong: '麻将桌',
      stove: '灶台', phone: '电话', balcony: '阳台', fishtank: '鱼缸',
      picture: '中堂画', glasscab: '玻璃柜', lasttv: '塔顶的电视',
    };
    if (!this.memories.length) {
      this.elLogList.innerHTML = '<li class="empty">还什么都没想起来。</li>';
      return;
    }
    this.elLogList.innerHTML = this.memories.map((id) => {
      const t = (LINES[id] || []).join('<br>');
      return `<li><i>${names[id] || id}</i>${t}</li>`;
    }).join('');
  }

  showEnding(lines) {
    this.setSubtitle('');
    this.setPrompt('');
    this.elEnd.classList.add('open');
    this.elEnd.innerHTML = '';
    const nodes = lines.map((l, i) => {
      const d = document.createElement('div');
      d.className = 'line' + (i === lines.length - 1 ? ' big' : '');
      d.innerHTML = l === '' ? '&nbsp;' : l;
      this.elEnd.appendChild(d);
      return d;
    });
    const again = document.createElement('div');
    again.className = 'again';
    again.textContent = '按 R 再走一遍';
    this.elEnd.appendChild(again);

    let i = 0;
    const step = () => {
      if (i >= nodes.length) { again.classList.add('on'); return; }
      nodes[i].classList.add('on');
      const delay = lines[i] === '' ? 500 : 1500 + lines[i].length * 105;
      i++;
      setTimeout(step, delay);
    };
    setTimeout(step, 900);
  }
}
