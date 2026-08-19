/* =====================================================================
 * Chat — 聊天框与命令系统
 * ===================================================================== */
import { BLOCKS, blockByName, idByName } from '../data/blocks.js';
import { getItem, ITEM_NAMES } from '../data/items.js';
import { MOB_TYPES } from '../entity/MobModels.js';
import { GAMEMODE } from '../core/Constants.js';
import { bus, EV } from '../core/EventBus.js';

const COMMANDS = [];
function cmd(name, args, desc, fn) { COMMANDS.push({ name, args, desc, fn }); }

export class Chat {
  constructor(game) {
    this.game = game;
    this.logEl = document.getElementById('chat-log');
    this.wrapEl = document.getElementById('chat-input-wrap');
    this.inputEl = document.getElementById('chat-input');
    this.suggestEl = document.getElementById('chat-suggest');
    this.open = false;
    this.history = [];
    this.historyIndex = -1;
    this.lines = [];

    this.inputEl.addEventListener('keydown', (e) => this._onKey(e));
    this.inputEl.addEventListener('input', () => this._updateSuggest());
    bus.on(EV.CHAT, (text, cls) => this.print(text, cls));
    this.print('输入 /help 查看命令，T 打开聊天', 'sys');
  }

  show(prefix = '') {
    this.open = true;
    this.wrapEl.classList.remove('hidden');
    this.inputEl.value = prefix;
    this.inputEl.focus();
    this.game.input.textMode = true;
    this.game.input.enabled = false;
    this._updateSuggest();
    // 显示历史消息
    for (const l of this.lines) l.el.classList.remove('fade');
  }

  hide() {
    this.open = false;
    this.wrapEl.classList.add('hidden');
    this.inputEl.value = '';
    this.suggestEl.style.display = 'none';
    this.game.input.textMode = false;
    this.game.input.enabled = true;
    this.inputEl.blur();
  }

  _onKey(e) {
    e.stopPropagation();
    if (e.key === 'Escape') { this.hide(); return; }
    if (e.key === 'Enter') {
      const text = this.inputEl.value.trim();
      this.hide();
      if (text) {
        this.history.unshift(text);
        if (this.history.length > 50) this.history.pop();
        this.historyIndex = -1;
        this.submit(text);
      }
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (this.historyIndex < this.history.length - 1) {
        this.historyIndex++;
        this.inputEl.value = this.history[this.historyIndex];
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (this.historyIndex > 0) {
        this.historyIndex--;
        this.inputEl.value = this.history[this.historyIndex];
      } else { this.historyIndex = -1; this.inputEl.value = ''; }
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      this._complete();
    }
  }

  _updateSuggest() {
    const v = this.inputEl.value;
    if (!v.startsWith('/')) { this.suggestEl.style.display = 'none'; return; }
    const parts = v.slice(1).split(/\s+/);
    if (parts.length === 1) {
      const matches = COMMANDS.filter(c => c.name.startsWith(parts[0])).slice(0, 6);
      if (!matches.length) { this.suggestEl.style.display = 'none'; return; }
      this.suggestEl.textContent = matches.map(c => `/${c.name} ${c.args}`).join('\n');
      this.suggestEl.style.display = 'block';
    } else {
      const c = COMMANDS.find(x => x.name === parts[0]);
      if (!c) { this.suggestEl.style.display = 'none'; return; }
      this.suggestEl.textContent = `/${c.name} ${c.args}\n${c.desc}`;
      this.suggestEl.style.display = 'block';
    }
  }

  _complete() {
    const v = this.inputEl.value;
    if (!v.startsWith('/')) return;
    const parts = v.slice(1).split(/\s+/);
    if (parts.length === 1) {
      const m = COMMANDS.filter(c => c.name.startsWith(parts[0]));
      if (m.length === 1) this.inputEl.value = '/' + m[0].name + ' ';
    } else {
      // 补全物品名
      const last = parts[parts.length - 1];
      const m = ITEM_NAMES.filter(n => n.startsWith(last));
      if (m.length === 1) {
        parts[parts.length - 1] = m[0];
        this.inputEl.value = '/' + parts.join(' ');
      } else if (m.length > 1) {
        this.suggestEl.textContent = m.slice(0, 12).join('  ');
        this.suggestEl.style.display = 'block';
      }
    }
  }

  print(text, cls = '') {
    const el = document.createElement('div');
    el.className = 'chat-line' + (cls ? ' ' + cls : '');
    el.textContent = text;
    this.logEl.appendChild(el);
    const entry = { el, time: performance.now() };
    this.lines.push(entry);
    while (this.lines.length > 60) {
      const old = this.lines.shift();
      old.el.remove();
    }
  }

  update() {
    const now = performance.now();
    if (this.open) return;
    for (const l of this.lines) {
      if (now - l.time > 9000) l.el.classList.add('fade');
    }
  }

  submit(text) {
    if (!text.startsWith('/')) {
      this.print('<玩家> ' + text);
      return;
    }
    const parts = text.slice(1).split(/\s+/).filter(Boolean);
    const name = (parts.shift() || '').toLowerCase();
    const c = COMMANDS.find(x => x.name === name);
    if (!c) {
      this.print(`未知命令: /${name}（输入 /help 查看全部）`, 'err');
      return;
    }
    try {
      const res = c.fn(this.game, parts, this);
      if (res) this.print(res, 'ok');
    } catch (e) {
      this.print('命令执行出错: ' + e.message, 'err');
    }
  }
}

/* ==================================================================== *
 *  命令定义
 * ==================================================================== */
cmd('help', '', '显示所有命令', (game, args, chat) => {
  chat.print('=== 命令列表 ===', 'sys');
  for (const c of COMMANDS) chat.print(`/${c.name} ${c.args} — ${c.desc}`);
  return null;
});

cmd('time', 'set day|night|noon|midnight|<0-24000>', '设置时间', (game, args) => {
  const v = (args[0] === 'set' ? args[1] : args[0]) || '';
  const map = { day: 1000, noon: 6000, night: 14000, midnight: 18000, sunrise: 23000, sunset: 12000 };
  let t = map[v];
  if (t === undefined) t = parseInt(v, 10);
  if (!Number.isFinite(t)) return '用法: /time set day|night|noon|midnight|<刻数>';
  game.world.timeOfDay = ((t % 24000) + 24000) % 24000;
  bus.emit(EV.TIME_CHANGED, game.world.timeOfDay);
  return `时间已设为 ${game.world.timeOfDay}`;
});

cmd('gamemode', 'survival|creative|spectator', '切换游戏模式', (game, args) => {
  const v = (args[0] || '').toLowerCase();
  const alias = { s: 'survival', c: 'creative', sp: 'spectator', '0': 'survival', '1': 'creative' };
  const mode = alias[v] || v;
  if (![GAMEMODE.SURVIVAL, GAMEMODE.CREATIVE, GAMEMODE.SPECTATOR].includes(mode)) {
    return '用法: /gamemode survival|creative|spectator';
  }
  game.player.setGamemode(mode);
  return `游戏模式已切换为 ${mode}`;
});

cmd('tp', '<x> <y> <z>', '传送', (game, args) => {
  if (args.length < 3) return '用法: /tp <x> <y> <z>';
  const [x, y, z] = args.map(Number);
  if (![x, y, z].every(Number.isFinite)) return '坐标无效';
  game.player.teleport(x, y, z);
  game.world.primeAround(Math.floor(x), Math.floor(z), 2);
  return `已传送到 ${x} ${y} ${z}`;
});

cmd('give', '<物品名> [数量]', '获得物品', (game, args) => {
  const name = args[0];
  const n = Math.max(1, Math.min(640, parseInt(args[1] || '1', 10) || 1));
  if (!name) return '用法: /give <物品名> [数量]';
  if (!getItem(name)) {
    const guess = ITEM_NAMES.filter(x => x.includes(name)).slice(0, 6);
    return `未知物品 "${name}"${guess.length ? '，也许是: ' + guess.join(', ') : ''}`;
  }
  const left = game.inventory.add(name, n);
  return `已获得 ${n - left} × ${getItem(name).display}${left ? `（背包已满，剩余 ${left}）` : ''}`;
});

cmd('seed', '', '显示世界种子', (game) => `世界种子: ${game.world.seedString} (hash ${game.world.seed})`);

cmd('weather', 'clear|rain|thunder', '设置天气', (game, args) => {
  const v = (args[0] || '').toLowerCase();
  if (!['clear', 'rain', 'thunder'].includes(v)) return '用法: /weather clear|rain|thunder';
  game.world.weather = v;
  game.world.weatherTimer = 3000;
  bus.emit(EV.WEATHER_CHANGED, v);
  return `天气已设为 ${v}`;
});

cmd('fill', '<方块名> <半径>', '在脚下填充球形区域', (game, args) => {
  const b = blockByName(args[0]);
  const r = Math.max(1, Math.min(12, parseInt(args[1] || '3', 10) || 3));
  if (!b) return '未知方块: ' + args[0];
  const p = game.player.position;
  const cx = Math.floor(p[0]), cy = Math.floor(p[1]) - 1, cz = Math.floor(p[2]);
  let n = 0;
  for (let dy = -r; dy <= r; dy++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy + dz * dz > r * r) continue;
        if (game.world.setBlock(cx + dx, cy + dy, cz + dz, b.id)) n++;
      }
    }
  }
  return `已填充 ${n} 个 ${b.display}`;
});

cmd('killall', '', '清除所有生物', (game) => {
  const n = game.entities.killAll();
  return `已清除 ${n} 个生物`;
});

cmd('spawn', '<生物> [数量]', '生成生物', (game, args) => {
  const type = args[0];
  if (!MOB_TYPES[type]) return '可用生物: ' + Object.keys(MOB_TYPES).join(', ');
  const n = Math.max(1, Math.min(24, parseInt(args[1] || '1', 10) || 1));
  const p = game.player.position;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = 2 + Math.random() * 4;
    const x = p[0] + Math.cos(a) * d, z = p[2] + Math.sin(a) * d;
    const y = game.world.highestSolidY(Math.floor(x), Math.floor(z));
    game.entities.spawnMob(type, x, Math.max(y, p[1]), z);
  }
  return `已生成 ${n} × ${MOB_TYPES[type].display}`;
});

cmd('clear', '', '清空背包', (game) => {
  game.inventory.clear();
  return '背包已清空';
});

cmd('save', '', '立即存档', (game) => {
  const r = game.save();
  return r.ok ? `已保存（${(r.bytes / 1024).toFixed(1)} KB）` : '保存失败: ' + r.error;
});

cmd('tick', '<倍率>', '调整游戏速度 (0.1-10)', (game, args) => {
  const v = parseFloat(args[0]);
  if (!Number.isFinite(v) || v <= 0) return '用法: /tick <倍率>，例如 /tick 2';
  game.loop.tickScale = Math.max(0.1, Math.min(10, v));
  return `逻辑速度 ×${game.loop.tickScale}`;
});

cmd('heal', '', '恢复满生命与饥饿', (game) => {
  game.player.health = game.player.maxHealth;
  game.player.food = 20;
  game.player.air = game.player.maxAir;
  return '已恢复';
});

cmd('kill', '', '自杀', (game) => {
  game.player.damage(999, '被 /kill 命令处死');
  return null;
});

cmd('xp', '<数量>', '获得经验', (game, args) => {
  const n = parseInt(args[0] || '10', 10) || 10;
  game.player.addXp(n);
  return `获得 ${n} 点经验，当前等级 ${game.player.xpLevel}`;
});

cmd('daylight', 'on|off', '开关昼夜循环', (game, args) => {
  const on = args[0] !== 'off';
  game.world.doDaylightCycle = on;
  return `昼夜循环: ${on ? '开' : '关'}`;
});

cmd('rd', '<2-16>', '设置渲染距离', (game, args) => {
  const v = parseInt(args[0], 10);
  if (!Number.isFinite(v)) return '用法: /rd <2-16>';
  const n = Math.max(2, Math.min(16, v));
  game.setRenderDistance(n);
  return `渲染距离: ${n} 区块`;
});

cmd('blocks', '[关键字]', '列出方块名', (game, args, chat) => {
  const kw = args[0] || '';
  const list = BLOCKS.filter(b => b.id !== 0 && !b.hidden && b.name.includes(kw)).map(b => b.name);
  chat.print(`共 ${list.length} 种方块:`, 'sys');
  for (let i = 0; i < list.length; i += 8) chat.print(list.slice(i, i + 8).join('  '));
  return null;
});

cmd('here', '', '显示当前位置信息', (game) => {
  const p = game.player.position;
  const bx = Math.floor(p[0]), by = Math.floor(p[1]), bz = Math.floor(p[2]);
  const id = game.world.getBlockSafe(bx, by - 1, bz);
  return `位置 ${bx} ${by} ${bz} · 脚下 ${BLOCKS[id]?.display || '空气'} · 群系 ${game.world.biomeInfoAt(bx, bz).name}`;
});

cmd('top', '', '传送到地面', (game) => {
  const p = game.player.position;
  const y = game.world.highestSolidY(Math.floor(p[0]), Math.floor(p[2]));
  game.player.teleport(p[0], y + 0.2, p[2]);
  return '已传送到地表';
});

cmd('light', '', '重算周围光照', (game) => {
  const p = game.player.position;
  const cx = Math.floor(p[0]) >> 4, cz = Math.floor(p[2]) >> 4;
  let n = 0;
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      const c = game.world.getChunk(cx + dx, cz + dz);
      if (!c) continue;
      game.world.lighting.initChunk(c);
      game.world.markChunkDirty(c.cx, c.cz);
      n++;
    }
  }
  game.world.lighting.flush();
  return `已重算 ${n} 个区块的光照`;
});

export { COMMANDS };
void idByName;
