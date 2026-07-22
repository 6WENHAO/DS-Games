/* ============ 围攻 Web —— 交互式新手教程 ============ */
'use strict';

/*
 * 分步引导：每步有说明文字 + 完成条件（每帧检测，自动进入下一步）。
 * ctx 由 main.js 注入：{ machine, builder, sim, world, cam, getMode }
 */

const TUT_KEY = 'besiege_web_tutorial_done';

class Tutorial {
  constructor(ctx) {
    this.ctx = ctx;
    this.active = false;
    this.stepIndex = 0;
    this.stepState = {};
    this.panel = document.getElementById('tutorial-panel');
    this.titleEl = document.getElementById('tut-title');
    this.textEl = document.getElementById('tut-text');
    this.progEl = document.getElementById('tut-progress');
    this.nextBtn = document.getElementById('tut-next');
    this.skipBtn = document.getElementById('tut-skip');
    this.doneEl = document.getElementById('tut-done-mark');
    this.nextBtn.onclick = () => { SFX.init(); SFX.click(); this._advance(); };
    this.skipBtn.onclick = () => { SFX.init(); this.finish(); };
    this._highlighted = [];
    this.steps = this._makeSteps();
  }

  _makeSteps() {
    const ctx = this.ctx;
    return [
      {
        title: '👋 欢迎来到围攻！',
        text: '你将建造一台中世纪战争机器去讨伐骑士。<br>先学看世界：<b>按住右键拖动</b>旋转视角，<b>滚轮</b>缩放。<br><span class="tut-goal">试着转动一下视角</span>',
        init() { this.yaw0 = ctx.cam.yaw; this.dist0 = ctx.cam.dist; },
        check() {
          return Math.abs(ctx.cam.yaw - this.yaw0) > 0.25 || Math.abs(ctx.cam.dist - this.dist0) > 1.5;
        },
      },
      {
        title: '🧱 第一块积木',
        text: '中间那个黄色笑脸是<b>核心方块</b>——机器的心脏，被摧毁就输了。<br>底部零件栏已选中<b>小木块</b>，把鼠标移到核心方块的<b>侧面</b>，出现绿色虚影后<b>点左键</b>放置。<br><span class="tut-goal">放置 1 个零件</span>',
        highlight: ['#toolbar'],
        init() { this.n0 = ctx.machine.count(); },
        check() { return ctx.machine.count() > this.n0; },
      },
      {
        title: '🚧 加长车身',
        text: '很好！继续点击已有方块的表面来延伸结构。<br><b>右键</b>点方块可以删除，<kbd>Ctrl+Z</kbd> 撤销。<br>提示：车身太短的车容易翻！<br><span class="tut-goal">让机器达到 4 个零件</span>',
        check() { return ctx.machine.count() >= 4; },
      },
      {
        title: '🛞 装上轮子',
        text: '切换到<b>「机械」</b>分类，选<b>动力轮</b>。<br>把轮子装在车身<b>左右两侧</b>（每侧至少 2 个）。放错了就右键删掉重装。<br><span class="tut-goal">装上 4 个动力轮</span>',
        highlight: ['#cat-tabs'],
        check() { return ctx.machine.blocks.filter(b => b.type === 'poweredWheel').length >= 4; },
      },
      {
        title: '⚔️ 加点火力（可选）',
        text: '切到<b>「武器」</b>分类：车头装<b>尖刺</b>（撞击杀伤）或<b>加农炮</b>（按 C 开炮）。<br>用<b>「工具」</b>里的 🔧 扳手点击零件，还能改按键和参数。<br><span class="tut-goal">装一件武器，或直接点「下一步」</span>',
        highlight: ['#cat-tabs'],
        allowNext: true,
        init() {
          this.n0 = ctx.machine.blocks.filter(b => ['spike', 'cannon', 'flamethrower', 'bomb'].includes(b.type)).length;
        },
        check() {
          return ctx.machine.blocks.filter(b => ['spike', 'cannon', 'flamethrower', 'bomb'].includes(b.type)).length > this.n0;
        },
      },
      {
        title: '▶ 发车！',
        text: '按<b>空格</b>（或点上方绿色按钮）开始模拟——机器会落到地面并接受物理规律的考验。<br><span class="tut-goal">开始模拟</span>',
        highlight: ['#btn-sim'],
        check() { return ctx.getMode() === 'sim'; },
      },
      {
        title: '🕹️ 驾驶',
        text: '<kbd>W</kbd><kbd>S</kbd> 前进后退。装了转向零件用 <kbd>A</kbd><kbd>D</kbd> 转向，没装就靠漂移吧！<br><kbd>T</kbd> 切换跟随相机，<kbd>C</kbd> 开炮，<kbd>F</kbd> 喷火。<br><span class="tut-goal">开动机器行驶 8 米</span>',
        init() { this.p0 = null; },
        check() {
          if (ctx.getMode() !== 'sim') return false;
          const p = ctx.sim.corePosition();
          if (!p) return false;
          if (!this.p0) { this.p0 = p.clone(); return false; }
          return p.distanceTo(this.p0) > 8;
        },
      },
      {
        title: '🏰 你的使命',
        text: '平原上游荡着 <b style="color:#e88">6 名骑士</b>，全部消灭即胜利！撞击、火烧、炮轰、丢炸弹都行。<br>城堡也可以撞塌（小心机器散架）。随时按<b>空格</b>回到建造模式修改设计。<br><span class="tut-goal">教程完成！点「完成」开始征服</span>',
        allowNext: true, nextLabel: '完成 🎉',
        check() { return false; },
      },
    ];
  }

  start() {
    this.active = true;
    this.stepIndex = 0;
    this.panel.style.display = 'block';
    this._enterStep();
  }

  finish() {
    this.active = false;
    this.panel.style.display = 'none';
    this._clearHighlight();
    try { localStorage.setItem(TUT_KEY, '1'); } catch (e) { }
  }

  static isDone() {
    try { return localStorage.getItem(TUT_KEY) === '1'; } catch (e) { return false; }
  }

  _enterStep() {
    const s = this.steps[this.stepIndex];
    if (!s) { this.finish(); return; }
    this.stepState = {};
    if (s.init) s.init.call(s);
    this.titleEl.innerHTML = s.title;
    this.textEl.innerHTML = s.text;
    this.nextBtn.style.display = s.allowNext ? 'inline-block' : 'none';
    this.nextBtn.textContent = s.nextLabel || '下一步 ▸';
    this.doneEl.style.display = 'none';
    this.progEl.innerHTML = this.steps.map((_, i) =>
      `<span class="dot${i < this.stepIndex ? ' past' : ''}${i === this.stepIndex ? ' cur' : ''}"></span>`).join('');
    this._clearHighlight();
    if (s.highlight) {
      for (const sel of s.highlight) {
        const el = document.querySelector(sel);
        if (el) { el.classList.add('tut-highlight'); this._highlighted.push(el); }
      }
    }
  }

  _clearHighlight() {
    for (const el of this._highlighted) el.classList.remove('tut-highlight');
    this._highlighted = [];
  }

  _advance() {
    this.stepIndex++;
    if (this.stepIndex >= this.steps.length) this.finish();
    else this._enterStep();
  }

  update() {
    if (!this.active) return;
    const s = this.steps[this.stepIndex];
    if (!s) return;
    if (s.check && s.check.call(s)) {
      // 完成动画：短暂显示 ✓ 后进入下一步
      if (!this._pendingAdvance) {
        this._pendingAdvance = true;
        this.doneEl.style.display = 'block';
        SFX.place();
        setTimeout(() => { this._pendingAdvance = false; this._advance(); }, 900);
      }
    }
  }
}

window.Tutorial = Tutorial;
