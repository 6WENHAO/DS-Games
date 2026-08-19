/* =====================================================================
 * Menus — 标题 / 新建世界 / 选项 / 帮助 / 暂停 / 死亡 / 加载 界面
 * ===================================================================== */
import settings, { SCHEMA } from '../core/Settings.js';
import { listWorlds, lastWorldId } from '../game/Storage.js';
import { bus, EV } from '../core/EventBus.js';

const SPLASHES = [
  '用 WebGL2 从零手写的我的世界！',
  '零依赖！零构建！',
  '也叫"网页版方块世界"',
  '程序化生成的贴图！',
  '试试 /help',
  '洞穴里有钻石',
  '当心苦力怕！',
  '按 F3 看调试信息',
  '无限地形，随机种子',
  '平滑光照 + 环境光遮蔽',
  '16×16 像素画全是代码画的',
  '晚上记得点火把',
];

const TIPS = [
  '提示：双击空格可以在创造模式下起飞。',
  '提示：按 E 打开物品栏，创造模式里能找到所有方块。',
  '提示：中键点击方块可以直接"取色"获得它。',
  '提示：Shift 潜行时不会从边缘掉下去。',
  '提示：镐挖石头更快，斧砍木头更快。',
  '提示：/time set night 可以直接入夜。',
  '提示：把 3 个木板放成一排可以做面包？不对，那是小麦。',
  '提示：树叶有小概率掉落树苗和苹果。',
  '提示：矿石越深越珍贵，钻石在 y<16。',
  '提示：渲染距离可以在选项里调整以获得更高帧率。',
];

export class Menus {
  constructor(game) {
    this.game = game;
    this.screens = {
      title: document.getElementById('screen-title'),
      newworld: document.getElementById('screen-newworld'),
      options: document.getElementById('screen-options'),
      help: document.getElementById('screen-help'),
      pause: document.getElementById('screen-pause'),
      death: document.getElementById('screen-death'),
      loading: document.getElementById('screen-loading'),
      inventory: document.getElementById('screen-inventory'),
    };
    this.current = 'title';
    this._optionsReturn = 'title';

    document.getElementById('splash').textContent =
      SPLASHES[(Math.random() * SPLASHES.length) | 0];

    this._buildOptions();
    this._bindActions();
    this._prefillNewWorld();
  }

  /* ---------------- 屏幕切换 ---------------- */
  showScreen(name) {
    for (const [key, el] of Object.entries(this.screens)) {
      if (!el) continue;
      if (key === 'inventory') continue;
      el.classList.toggle('hidden', key !== name);
    }
    this.current = name;
    if (name === 'title') {
      document.getElementById('splash').textContent = SPLASHES[(Math.random() * SPLASHES.length) | 0];
    }
  }

  hideAll() {
    for (const [key, el] of Object.entries(this.screens)) {
      if (!el || key === 'inventory') continue;
      el.classList.add('hidden');
    }
    this.current = null;
  }

  get anyOpen() { return this.current !== null; }

  /* ---------------- 加载进度 ---------------- */
  showLoading(title = '正在生成世界…') {
    document.getElementById('loading-title').textContent = title;
    document.getElementById('loading-tip').textContent = TIPS[(Math.random() * TIPS.length) | 0];
    this.setProgress(0, '准备中');
    this.showScreen('loading');
  }

  setProgress(p, text) {
    document.getElementById('loading-fill').style.width = Math.round(p * 100) + '%';
    if (text) document.getElementById('loading-sub').textContent = text;
  }

  /* ---------------- 选项界面 ---------------- */
  _buildOptions() {
    const grid = document.getElementById('options-grid');
    grid.innerHTML = '';
    for (const s of SCHEMA) {
      const row = document.createElement('div');
      row.className = 'opt-row';
      const head = document.createElement('div');
      head.className = 'opt-head';
      const label = document.createElement('span');
      label.textContent = s.label;
      const val = document.createElement('span');
      val.className = 'opt-val';
      head.appendChild(label);
      head.appendChild(val);
      row.appendChild(head);

      if (s.type === 'range') {
        const input = document.createElement('input');
        input.type = 'range';
        input.min = s.min; input.max = s.max; input.step = s.step;
        input.value = settings.get(s.key);
        val.textContent = s.fmt ? s.fmt(input.value) : input.value;
        input.addEventListener('input', () => {
          const v = parseFloat(input.value);
          settings.set(s.key, v);
          val.textContent = s.fmt ? s.fmt(v) : v;
        });
        row.appendChild(input);
      } else {
        const btn = document.createElement('button');
        btn.className = 'toggle';
        const sync = () => {
          const on = !!settings.get(s.key);
          btn.classList.toggle('on', on);
          btn.textContent = on ? '开启' : '关闭';
          val.textContent = on ? 'ON' : 'OFF';
        };
        sync();
        btn.addEventListener('click', () => { settings.toggle(s.key); sync(); });
        row.appendChild(btn);
      }

      if (s.desc) {
        const d = document.createElement('div');
        d.className = 'opt-desc';
        d.textContent = s.desc;
        row.appendChild(d);
      }
      grid.appendChild(row);
    }
  }

  _prefillNewWorld() {
    const seedEl = document.getElementById('nw-seed');
    if (seedEl) seedEl.placeholder = '留空则随机（例如 ' + Math.floor(Math.random() * 1e6) + '）';
    const worlds = listWorlds();
    const playBtn = document.querySelector('[data-action="play"]');
    if (playBtn) {
      const last = lastWorldId();
      const w = worlds.find(x => x.id === last) || worlds[0];
      playBtn.textContent = w ? `继续游戏：${w.name}` : '开始新世界';
      this._continueWorld = w || null;
    }
  }

  /* ---------------- 按钮绑定 ---------------- */
  _bindActions() {
    document.body.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      bus.emit(EV.SOUND, 'click', { volume: 0.4 });
      this._handle(action);
    });
  }

  _handle(action) {
    const game = this.game;
    switch (action) {
      case 'play':
        if (this._continueWorld) game.loadAndStart(this._continueWorld.id);
        else game.newWorld({ name: '新的世界', seed: '', type: 'default', mode: 'creative', structures: true });
        break;
      case 'new-world':
        this.showScreen('newworld');
        break;
      case 'create-world': {
        const name = document.getElementById('nw-name').value || '新的世界';
        const seed = document.getElementById('nw-seed').value.trim();
        const type = document.getElementById('nw-type').value;
        const mode = document.getElementById('nw-mode').value;
        const structures = document.getElementById('nw-structures').checked;
        game.newWorld({ name, seed, type, mode, structures });
        break;
      }
      case 'options':
        this._optionsReturn = this.current === 'pause' ? 'pause' : 'title';
        this.showScreen('options');
        break;
      case 'close-options':
        this.showScreen(this._optionsReturn);
        if (this._optionsReturn === 'pause') { /* 保持暂停 */ }
        break;
      case 'help':
        this.showScreen('help');
        break;
      case 'back-title':
        this._prefillNewWorld();
        this.showScreen('title');
        break;
      case 'resume':
        game.resume();
        break;
      case 'save-quit':
        game.saveAndQuit();
        this._prefillNewWorld();
        break;
      case 'respawn':
        game.respawn();
        break;
      default:
        break;
    }
  }
}
