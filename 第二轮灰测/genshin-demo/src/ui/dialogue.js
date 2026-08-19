// Dialogue: speaker box + typewriter lines + choices + cinematic letterbox.
const TAU = Math.PI * 2;
const ELEMENT_COLORS = { anemo: '#74c8a8', pyro: '#ff7a55', hydro: '#4fc3f7', electro: '#c88bfa', cryo: '#93e0ef', geo: '#f0b93c', dendro: '#9adb4a' };

function h(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

function drawPortrait(cv, speaker, element) {
  const ctx = cv.getContext('2d');
  const S = cv.width, cx = S / 2, cy = S / 2;
  const el = ELEMENT_COLORS[element] || '#e8d5a8';
  ctx.clearRect(0, 0, S, S);
  const bg = ctx.createLinearGradient(0, 0, 0, S);
  bg.addColorStop(0, 'rgba(60,70,98,.9)'); bg.addColorStop(1, 'rgba(24,30,48,.9)');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#ffdcc2'; ctx.beginPath(); ctx.arc(cx, cy + S * 0.05, S * 0.32, 0, TAU); ctx.fill();
  const hair = { anemo: '#7fae8f', pyro: '#c25a3a', hydro: '#5a8fc2', electro: '#8a5fc0', cryo: '#9fd4e8', geo: '#b08a3a', dendro: '#7aa83a' }[element] || '#c9a24a';
  ctx.fillStyle = hair;
  ctx.beginPath(); ctx.arc(cx, cy + S * 0.02, S * 0.34, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy - S * 0.06, S * 0.3, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
  const ey = cy + S * 0.06;
  ctx.fillStyle = '#2a1c16';
  ctx.beginPath(); ctx.ellipse(cx - S * 0.12, ey, S * 0.04, S * 0.055, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + S * 0.12, ey, S * 0.04, S * 0.055, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(cx - S * 0.11, ey - S * 0.02, S * 0.016, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + S * 0.13, ey - S * 0.02, S * 0.016, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#c97a72'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(cx, cy + S * 0.15, S * 0.07, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  ctx.strokeStyle = el; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.arc(cx, cy, S * 0.46, 0, TAU); ctx.stroke();
}

export class DialogueSystem {
  constructor(ctx, api) {
    this.ctx = ctx; this.api = api;
    this._active = false;
    this._resolve = null;
    this._node = null;
    this._lineIdx = 0;
    this._fullText = ''; this._typed = 0; this._typing = false;
    this._build();
    this._bindInput();
  }

  _build() {
    const root = h('div'); root.id = 'dialogue';
    const box = h('div', 'dlg-box');
    const spk = h('div', 'dlg-speaker');
    this._portrait = h('canvas', 'dlg-portrait'); this._portrait.width = this._portrait.height = 64;
    this._spkName = h('span');
    spk.appendChild(this._portrait); spk.appendChild(this._spkName);
    this._dtext = h('div', 'dlg-text');
    this._choices = h('div', 'dlg-choices');
    this._cue = h('div', 'dlg-cue');
    box.appendChild(spk); box.appendChild(this._dtext); box.appendChild(this._choices); box.appendChild(this._cue);
    root.appendChild(box);
    const host = document.getElementById('ui-root') || document.body;
    host.appendChild(root);
    this._root = root;
    this._box = box;
    this._cue.style.opacity = '0';
  }

  _bindInput() {
    this._onKey = (e) => { if (this._active && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); this._advance(); } };
    addEventListener('keydown', this._onKey);
    this._box.addEventListener('click', () => { if (this._active) this._advance(); });
  }

  start(node) {
    return new Promise((res) => {
      this._resolve = res;
      this._node = node;
      this._lineIdx = 0;
      this._active = true;
      this._root.classList.add('on');
      this._spkName.textContent = node.speaker || '';
      drawPortrait(this._portrait, node.speaker, node.element);
      if (node.cinematic && this.api && this.api.cinematic) this.api.cinematic(true);
      if (this.ctx.events && this.ctx.events.emit) this.ctx.events.emit('ui:dialogueStart', { node });
      this.ctx.paused = true;
      if (this.ctx.input && this.ctx.input.releaseLock) this.ctx.input.releaseLock();
      this._showLine((node.lines && node.lines[0]) || '');
    });
  }

  _showLine(text) {
    this._fullText = text || '';
    this._typed = 0;
    this._typing = this._fullText.length > 0;
    this._dtext.textContent = '';
    this._cue.style.opacity = '0';
    this._choices.innerHTML = '';
  }

  _showChoices(choices) {
    this._cue.style.opacity = '0';
    this._choices.innerHTML = '';
    for (let i = 0; i < choices.length; i++) {
      const c = choices[i];
      const btn = h('button', 'dlg-choice');
      btn.textContent = c.text;
      btn.addEventListener('click', () => this._finish(i));
      this._choices.appendChild(btn);
    }
  }

  _advance() {
    if (!this._active) return;
    if (this._typing) { this._typed = this._fullText.length; return; }
    const node = this._node;
    this._lineIdx++;
    if (this._lineIdx < (node.lines || []).length) { this._showLine(node.lines[this._lineIdx]); return; }
    if (node.choices && node.choices.length) { this._showChoices(node.choices); return; }
    this._finish(0);
  }

  _finish(idx) {
    this._active = false;
    this._root.classList.remove('on');
    if (this._node && this._node.cinematic && this.api && this.api.cinematic) this.api.cinematic(false);
    if (this.ctx.events && this.ctx.events.emit) this.ctx.events.emit('ui:dialogueEnd', { node: this._node });
    if (this._node && this._node.onEnd) { try { this._node.onEnd(this.ctx); } catch (e) { console.error(e); } }
    this.ctx.paused = false;
    const r = this._resolve; this._resolve = null;
    if (r) r(idx);
  }

  update(dt) {
    if (!this._active || !this._typing) return;
    this._typed += dt * 30;
    const n = Math.floor(this._typed);
    if (n >= this._fullText.length) {
      this._typing = false;
      this._dtext.textContent = this._fullText;
      this._cue.style.opacity = '1';
    } else {
      this._dtext.textContent = this._fullText.slice(0, n);
    }
  }

  dispose() { removeEventListener('keydown', this._onKey); if (this._root) this._root.remove(); }
}
